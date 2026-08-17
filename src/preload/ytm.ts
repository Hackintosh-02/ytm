import { ipcRenderer } from 'electron';
import { IPC, MediaControl, TrackInfo } from '../shared/types';

// Preload runs in the sandboxed page; process.env is not available for
// arbitrary vars, but process.env.YTM_DEBUG is, since it was set at Electron
// launch. Fall back to false in packaged builds.
const DEBUG = !!process.env.YTM_DEBUG;

// Runs in the YTM page context. Polls mediaSession + DOM + the video element
// to emit track-change and periodic playback ticks to the main process.

function findVideo(): HTMLVideoElement | null {
  return document.querySelector('video') as HTMLVideoElement | null;
}

function textOf(sel: string): string {
  const el = document.querySelector(sel) as HTMLElement | null;
  return el?.textContent?.trim() ?? '';
}

function readFromDom(): { title: string; artist: string; album: string; artwork: string | null } | null {
  // YTM player bar structure:
  //   .ytmusic-player-bar .title              -> song title
  //   .ytmusic-player-bar .byline             -> "Artist • Album • Year" or similar
  //   .ytmusic-player-bar .image (img)        -> thumbnail
  const title = textOf('.ytmusic-player-bar .title');
  if (!title) return null;
  const bylineRaw = textOf('.ytmusic-player-bar .byline');
  const parts = bylineRaw.split('•').map((s) => s.trim()).filter(Boolean);
  const artist = parts[0] ?? '';
  const album = parts[1] ?? '';
  const img = document.querySelector('.ytmusic-player-bar img.image') as HTMLImageElement | null;
  const artwork = img?.src ?? null;
  return { title, artist, album, artwork };
}

function readTrack(): TrackInfo | null {
  const video = findVideo();
  const duration = video && isFinite(video.duration) ? video.duration : 0;

  const meta = navigator.mediaSession?.metadata;
  if (meta && meta.title) {
    return {
      title: meta.title,
      artist: meta.artist || '',
      album: meta.album || '',
      artwork: meta.artwork?.[meta.artwork.length - 1]?.src ?? null,
      duration,
    };
  }

  const dom = readFromDom();
  if (dom) return { ...dom, duration };

  return null;
}

function trackKey(t: TrackInfo | null): string {
  return t ? `${t.title}::${t.artist}::${t.album}` : '';
}

let lastKey = '';
let logCount = 0;

function tick() {
  const video = findVideo();
  const track = readTrack();
  const key = trackKey(track);

  if (key !== lastKey) {
    lastKey = key;
    if (DEBUG) console.log('[ytm-preload] track changed →', track);
    ipcRenderer.send(IPC.TrackChanged, track);
  } else if (DEBUG && logCount++ % 20 === 0) {
    console.log('[ytm-preload] tick, track=', track?.title ?? '(none)', 'video=', !!video);
  }

  ipcRenderer.send(IPC.PlaybackTick, {
    currentTime: video?.currentTime ?? 0,
    isPlaying: !!video && !video.paused && !video.ended,
  });
}

function start() {
  if (DEBUG) console.log('[ytm-preload] loaded, starting poll');
  setInterval(tick, 250);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

ipcRenderer.on(IPC.MediaControl, (_e, cmd: MediaControl) => {
  const video = findVideo();
  if (cmd === 'play-pause' && video) {
    if (video.paused) void video.play();
    else video.pause();
    return;
  }
  const selector =
    cmd === 'next' ? '.next-button, tp-yt-paper-icon-button.next-button'
    : '.previous-button, tp-yt-paper-icon-button.previous-button'
    ;
  const btn = document.querySelector(selector) as HTMLElement | null;
  btn?.click();
});
