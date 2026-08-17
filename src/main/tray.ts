import { app, Menu, Tray, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';
import { IPC, MediaControl, PlaybackState } from '../shared/types';

let tray: Tray | null = null;

function iconPath(): string {
  // In production the app is asar-packed; assets/ is copied alongside.
  return path.join(app.getAppPath(), 'assets', 'trayTemplate.png');
}

export function initTray(opts: {
  playback: PlaybackState;
  showMain: () => void;
  sendControl: (c: MediaControl) => void;
  toggleOverlay: () => void;
  quit: () => void;
}) {
  const image = nativeImage.createFromPath(iconPath());
  image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip('YTM Desktop');

  const rebuild = () => {
    if (!tray) return;
    const t = opts.playback.track;
    const nowPlaying = t
      ? `${t.title} — ${t.artist}`.slice(0, 60)
      : 'Nothing playing';
    const menu = Menu.buildFromTemplate([
      { label: nowPlaying, enabled: false },
      { type: 'separator' },
      { label: opts.playback.isPlaying ? 'Pause' : 'Play', click: () => opts.sendControl('play-pause') },
      { label: 'Next', click: () => opts.sendControl('next') },
      { label: 'Previous', click: () => opts.sendControl('previous') },
      { type: 'separator' },
      { label: 'Show YTM', click: () => opts.showMain() },
      { label: 'Toggle Lyrics Overlay', click: () => opts.toggleOverlay() },
      { type: 'separator' },
      { label: 'Quit', click: () => opts.quit() },
    ]);
    tray.setContextMenu(menu);
  };

  rebuild();
  // Rebuild whenever the playback state changes (cheap enough to poll).
  const interval = setInterval(rebuild, 1000);
  app.on('before-quit', () => clearInterval(interval));
}
