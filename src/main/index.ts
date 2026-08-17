import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import { IPC, MediaControl, PlaybackState, TrackInfo } from '../shared/types';
import { initTray } from './tray';
import { registerMediaKeys, unregisterMediaKeys } from './mediaKeys';
import { toggleOverlay } from './overlayWindow';

const playback: PlaybackState = {
  track: null,
  currentTime: 0,
  isPlaying: false,
};

ipcMain.on(IPC.TrackChanged, (_e, track: TrackInfo | null) => {
  playback.track = track;
  if (process.env.YTM_DEBUG) console.log('[track]', track?.title, '—', track?.artist);
});

ipcMain.on(IPC.PlaybackTick, (_e, tick: { currentTime: number; isPlaying: boolean }) => {
  playback.currentTime = tick.currentTime;
  playback.isPlaying = tick.isPlaying;
});

const YTM_URL = 'https://music.youtube.com';
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const isMac = process.platform === 'darwin';
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createMainWindow(): BrowserWindow {
  const ytmSession = session.fromPartition('persist:ytm');
  ytmSession.setUserAgent(CHROME_UA);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'YTM Desktop',
    backgroundColor: '#030303',
    webPreferences: {
      session: ytmSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../preload/ytm.js'),
    },
  });

  win.loadURL(YTM_URL, { userAgent: CHROME_UA });

  // On macOS, closing the window hides it rather than quitting. The user
  // reopens from the dock or Cmd+Tab. Full quit goes through Cmd+Q.
  win.on('close', (event) => {
    if (isMac && !isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function sendMediaControl(cmd: MediaControl) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.MediaControl, cmd);
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
    return;
  }
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

// Prevent multiple app instances — second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());

  app.whenReady().then(() => {
    mainWindow = createMainWindow();
    initTray({
      playback,
      showMain: showMainWindow,
      sendControl: sendMediaControl,
      toggleOverlay,
      quit: () => app.quit(),
    });
    registerMediaKeys(sendMediaControl);
    app.on('activate', () => showMainWindow());
  });

  app.on('will-quit', () => unregisterMediaKeys());

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
