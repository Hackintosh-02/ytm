import { globalShortcut } from 'electron';
import { MediaControl } from '../shared/types';

// Register the OS-level media keys. Electron delivers hardware media keys via
// these virtual accelerator names on all three platforms.
export function registerMediaKeys(send: (c: MediaControl) => void) {
  const map: Array<[string, MediaControl]> = [
    ['MediaPlayPause', 'play-pause'],
    ['MediaNextTrack', 'next'],
    ['MediaPreviousTrack', 'previous'],
  ];
  for (const [accel, cmd] of map) {
    const ok = globalShortcut.register(accel, () => send(cmd));
    if (!ok && process.env.YTM_DEBUG) {
      console.warn(`[media-keys] failed to register ${accel}`);
    }
  }
}

export function unregisterMediaKeys() {
  globalShortcut.unregisterAll();
}
