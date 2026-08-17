import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

let overlay: BrowserWindow | null = null;

export function getOverlay(): BrowserWindow | null {
  return overlay && !overlay.isDestroyed() ? overlay : null;
}

export function createOverlay(): BrowserWindow {
  const existing = getOverlay();
  if (existing) return existing;

  const { workArea } = screen.getPrimaryDisplay();
  const width = 420;
  const height = 220;

  overlay = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + 24,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../preload/overlay.js'),
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlay.loadFile(path.join(__dirname, '../renderer/overlay/index.html'));

  overlay.on('closed', () => {
    overlay = null;
  });

  return overlay;
}

export function toggleOverlay() {
  const win = getOverlay();
  if (!win) {
    createOverlay();
    return;
  }
  if (win.isVisible()) win.hide();
  else win.show();
}
