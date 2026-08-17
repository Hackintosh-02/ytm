import { contextBridge, ipcRenderer } from 'electron';
import { IPC, OverlayLyrics, OverlayTick } from '../shared/types';

contextBridge.exposeInMainWorld('ytmDebug', !!process.env.YTM_DEBUG);

contextBridge.exposeInMainWorld('overlayAPI', {
  onLyrics(cb: (lyrics: OverlayLyrics) => void) {
    ipcRenderer.on(IPC.OverlayLyrics, (_e, l: OverlayLyrics) => cb(l));
  },
  onTick(cb: (tick: OverlayTick) => void) {
    ipcRenderer.on(IPC.OverlayTick, (_e, t: OverlayTick) => cb(t));
  },
  onSettings(cb: (s: any) => void) {
    ipcRenderer.on(IPC.OverlaySettings, (_e, s: any) => cb(s));
  },
  updateSettings(patch: any) {
    ipcRenderer.send(IPC.OverlaySettingsUpdate, patch);
  },
  ready() {
    ipcRenderer.send('ytm:overlay-ready');
  },
});
