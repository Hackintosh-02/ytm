import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { OverlaySettings, loadSettings, saveSettings } from './settings';

let overlay: BrowserWindow | null = null;
let settings: OverlaySettings = loadSettings();

export function getOverlay(): BrowserWindow | null {
  return overlay && !overlay.isDestroyed() ? overlay : null;
}

export function getOverlaySettings(): OverlaySettings {
  return settings;
}

export function updateOverlaySettings(patch: Partial<OverlaySettings>) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
}

function defaultBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 420;
  const height = 260;
  return {
    width,
    height,
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + 24,
  };
}

export function createOverlay(): BrowserWindow {
  const existing = getOverlay();
  if (existing) return existing;

  const bounds = settings.bounds ?? defaultBounds();

  overlay = new BrowserWindow({
    ...bounds,
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

  if (process.env.YTM_DEBUG) {
    overlay.webContents.openDevTools({ mode: 'detach' });
    overlay.webContents.on('preload-error', (_e, preloadPath, err) => {
      console.error('[overlay] preload-error at', preloadPath, err);
    });
  }

  const persistBounds = () => {
    if (!overlay || overlay.isDestroyed()) return;
    const b = overlay.getBounds();
    updateOverlaySettings({ bounds: b });
  };
  overlay.on('move', persistBounds);
  overlay.on('resize', persistBounds);

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

// Force-destroy the overlay before quit. A screen-saver-level +
// visibleOnAllWorkspaces window is not always torn down by app.quit()
// reliably; drop those flags first, then destroy() (which cannot be
// preventDefault'd, unlike close()).
export function destroyOverlay() {
  const win = getOverlay();
  if (!win) return;
  try {
    win.setAlwaysOnTop(false);
    win.setVisibleOnAllWorkspaces(false);
  } catch { /* ignore */ }
  win.destroy();
  overlay = null;
}
