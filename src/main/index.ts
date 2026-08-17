import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import { IPC, MediaControl, OverlayLyrics, PlaybackState, TrackInfo } from '../shared/types';
import { destroyTray, initTray } from './tray';
import { registerMediaKeys, unregisterMediaKeys } from './mediaKeys';
import { buildAppMenu } from './appMenu';
import { destroyOverlay, getOverlay, getOverlaySettings, toggleOverlay, updateOverlaySettings } from './overlayWindow';
import { fetchLyrics } from './lyrics';

const playback: PlaybackState = {
  track: null,
  currentTime: 0,
  isPlaying: false,
};

let currentLyrics: OverlayLyrics = { track: null, synced: null, plain: null, status: 'idle' };
let lyricsToken = 0;

function sendOverlayLyrics() {
  const win = getOverlay();
  win?.webContents.send(IPC.OverlayLyrics, currentLyrics);
}

async function refreshLyricsFor(track: TrackInfo) {
  const token = ++lyricsToken;
  currentLyrics = { track, synced: null, plain: null, status: 'loading' };
  sendOverlayLyrics();
  const result = await fetchLyrics(track);
  if (token !== lyricsToken) return; // song already changed
  currentLyrics = {
    track,
    synced: result.synced,
    plain: result.plain,
    status: result.synced || result.plain ? 'ready' : 'not-found',
  };
  sendOverlayLyrics();
}

ipcMain.on(IPC.TrackChanged, (_e, track: TrackInfo | null) => {
  playback.track = track;
  if (process.env.YTM_DEBUG) console.log('[track]', track?.title, '—', track?.artist);
  if (track && track.title) {
    void refreshLyricsFor(track);
  } else {
    lyricsToken++;
    currentLyrics = { track: null, synced: null, plain: null, status: 'idle' };
    sendOverlayLyrics();
  }
});

ipcMain.on(IPC.PlaybackTick, (_e, tick: { currentTime: number; isPlaying: boolean }) => {
  playback.currentTime = tick.currentTime;
  playback.isPlaying = tick.isPlaying;
  const win = getOverlay();
  win?.webContents.send(IPC.OverlayTick, tick);
});

// Push current lyrics + settings when the overlay opens or reloads.
ipcMain.on('ytm:overlay-ready', () => {
  sendOverlayLyrics();
  const win = getOverlay();
  win?.webContents.send(IPC.OverlaySettings, getOverlaySettings());
});

ipcMain.on(IPC.OverlaySettingsUpdate, (_e, patch: any) => {
  updateOverlaySettings(patch);
  const win = getOverlay();
  win?.webContents.send(IPC.OverlaySettings, getOverlaySettings());
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

  // Google's OAuth ("Couldn't sign you in — This browser or app may not be
  // secure") rejects spoofed Chrome UAs because the accompanying Sec-CH-UA
  // client hints do not match a real Chrome build — but it accepts the raw
  // Electron UA. So: use CHROME_UA for YTM itself (needed for feature
  // detection), but on requests to accounts.google.com send the native
  // Electron UA and strip the fake Chrome client hints. This is the same
  // trick th-ch/youtube-music uses.
  const ELECTRON_UA = ytmSession.getUserAgent().includes('Electron')
    ? ytmSession.getUserAgent()
    : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) YTMDesktop/${app.getVersion()} Electron/${process.versions.electron} Safari/537.36`;

  ytmSession.webRequest.onBeforeSendHeaders((details, cb) => {
    const url = details.url;
    const isGoogleAuth = url.startsWith('https://accounts.google.com');
    const headers = { ...details.requestHeaders };
    if (isGoogleAuth) {
      for (const key of Object.keys(headers)) {
        if (/^sec-ch-ua/i.test(key)) delete headers[key];
      }
      headers['User-Agent'] = ELECTRON_UA;
    }
    cb({ requestHeaders: headers });
  });

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

  // Prevent a stray beforeunload handler in the YTM page from silently
  // cancelling app.quit(). This is one of the top causes of "Cmd+Q does
  // nothing" in Electron apps that wrap third-party sites.
  win.webContents.on('will-prevent-unload', (e) => e.preventDefault());

  // Open DevTools only when explicitly debugging.
  if (process.env.YTM_DEBUG) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // On macOS, closing the window hides it rather than quitting. The user
  // reopens from the dock or Cmd+Tab. Full quit goes through Cmd+Q.
  win.on('close', (event) => {
    if (isMac && !isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  // Fix black-screen after exiting native fullscreen on macOS. When the
  // window animates back out of its own Space, Chromium sometimes drops the
  // frame and the window paints solid black. Reliable fix: hide + re-show
  // after the transition animation, which forces AppKit to reattach the
  // content view. Suppress during quit so we do not fight the shutdown.
  win.on('leave-full-screen', () => {
    if (isQuitting) return;
    setTimeout(() => {
      if (isQuitting || win.isDestroyed() || !win.isVisible()) return;
      win.hide();
      setTimeout(() => {
        if (isQuitting || win.isDestroyed()) return;
        win.show();
        win.webContents.invalidate();
      }, 50);
    }, 200);
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
    app.setName('YTM Desktop');
    buildAppMenu();
    // In dev the dock/menubar shows generic Electron branding. Point the
    // dock icon at our real app icon so the running app is identifiable.
    if (isMac && !app.isPackaged) {
      try {
        const iconPath = path.join(__dirname, '../../build/icon.png');
        app.dock?.setIcon(iconPath);
      } catch {
        // best-effort; not critical
      }
    }
    mainWindow = createMainWindow();
    initTray({
      playback,
      showMain: showMainWindow,
      sendControl: sendMediaControl,
      toggleOverlay,
      quit: () => app.quit(),
    });
    registerMediaKeys(sendMediaControl);
    // Overlay never auto-opens. User toggles it from the tray menu, Lyrics
    // menu, or Cmd+Shift+L for the current session. This keeps launch quiet
    // and predictable — no surprise floating window every time.
    app.on('activate', () => showMainWindow());
  });

  app.on('before-quit', () => {
    isQuitting = true;
    // Explicitly tear down the overlay first. A frameless transparent
    // window at screen-saver level with visibleOnAllWorkspaces is not
    // torn down reliably by the default quit sequence — destroy() bypasses
    // any close-event handling so quit cannot hang here.
    destroyOverlay();
  });

  app.on('will-quit', () => {
    unregisterMediaKeys();
    // Remove tray last so no ghost icon lingers in the menubar.
    destroyTray();
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
