import { contextBridge, ipcRenderer } from 'electron';
import { IPC, OverlayLyrics, OverlayTick } from '../shared/types';

contextBridge.exposeInMainWorld('overlayAPI', {
  onLyrics(cb: (lyrics: OverlayLyrics) => void) {
    ipcRenderer.on(IPC.OverlayLyrics, (_e, l: OverlayLyrics) => cb(l));
  },
  onTick(cb: (tick: OverlayTick) => void) {
    ipcRenderer.on(IPC.OverlayTick, (_e, t: OverlayTick) => cb(t));
  },
  ready() {
    ipcRenderer.send('ytm:overlay-ready');
  },
});
