// NOTE: This file is loaded as a plain <script> tag, not a module. It must
// stay free of top-level import/export syntax, otherwise tsc emits CommonJS
// boilerplate (Object.defineProperty(exports, ...)) that blows up at runtime
// with "exports is not defined". Types are declared inline for the same
// reason.

interface RTrack {
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  duration: number;
}
interface RSyncedLine { time: number; text: string }
interface ROverlayLyrics {
  track: RTrack | null;
  synced: RSyncedLine[] | null;
  plain: string | null;
  status: 'loading' | 'ready' | 'not-found' | 'idle';
}
interface ROverlayTick { currentTime: number; isPlaying: boolean }
interface ROverlaySettings { fontSize: number; opacity: number; offset: number }

interface OverlayAPI {
  onLyrics(cb: (l: ROverlayLyrics) => void): void;
  onTick(cb: (t: ROverlayTick) => void): void;
  onSettings(cb: (s: ROverlaySettings) => void): void;
  updateSettings(patch: Partial<ROverlaySettings>): void;
  ready(): void;
}
declare const overlayAPI: OverlayAPI;

console.log('[overlay-renderer] loaded, overlayAPI=', typeof (window as any).overlayAPI);

const statusEl = document.getElementById('status') as HTMLElement;
const lyricsEl = document.getElementById('lyrics') as HTMLElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const panel = document.getElementById('panel') as HTMLElement;
const inFont = document.getElementById('in-font') as HTMLInputElement;
const inOpacity = document.getElementById('in-opacity') as HTMLInputElement;
const inOffset = document.getElementById('in-offset') as HTMLInputElement;
const offsetReadout = document.getElementById('offset-readout') as HTMLElement;

let current: ROverlayLyrics = { track: null, synced: null, plain: null, status: 'idle' };
let currentTime = 0;
let offset = 0;
let activeIdx = -1;

// How many lines to show above and below the active line.
const WINDOW_BEFORE = 2;
const WINDOW_AFTER = 2;

function applySettings(s: ROverlaySettings) {
  document.body.style.setProperty('--font-size', `${s.fontSize}px`);
  document.body.style.setProperty('--bg-opacity', String(s.opacity));
  offset = s.offset;
  inFont.value = String(s.fontSize);
  inOpacity.value = String(s.opacity);
  inOffset.value = String(s.offset);
  offsetReadout.textContent = `${s.offset >= 0 ? '+' : ''}${s.offset.toFixed(1)}s`;
}

function setHeader() {
  const t = current.track;
  const header = t ? `${t.title} — ${t.artist}` : '';
  statusEl.textContent =
    current.status === 'idle' ? 'Waiting for a song…' :
    current.status === 'loading' ? `${header}   ·   loading lyrics…` :
    current.status === 'not-found' ? `${header}   ·   no lyrics found` :
    header;
}

function renderWindow() {
  lyricsEl.innerHTML = '';
  if (current.status === 'idle') return;

  if (current.synced && current.synced.length) {
    const total = current.synced.length;
    const center = activeIdx >= 0 ? activeIdx : 0;
    const start = Math.max(0, center - WINDOW_BEFORE);
    const end = Math.min(total - 1, center + WINDOW_AFTER);
    for (let i = start; i <= end; i++) {
      const line = current.synced[i];
      const div = document.createElement('div');
      const distance = Math.abs(i - center);
      const cls = i === center ? 'active' : distance === 1 ? 'near' : 'far';
      div.className = `line ${cls}`;
      div.textContent = line.text || '♪';
      lyricsEl.appendChild(div);
    }
  } else if (current.plain) {
    // No synced lyrics: show all plain lines, all "active", scrollable.
    lyricsEl.style.overflowY = 'auto';
    lyricsEl.style.justifyContent = 'flex-start';
    for (const raw of current.plain.split(/\r?\n/)) {
      const div = document.createElement('div');
      div.className = 'line active';
      div.textContent = raw;
      lyricsEl.appendChild(div);
    }
  }
}

function render() {
  activeIdx = -1;
  lyricsEl.style.overflowY = 'hidden';
  lyricsEl.style.justifyContent = 'center';
  setHeader();
  renderWindow();
}

function findActiveIndex(lines: RSyncedLine[], t: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

function syncHighlight() {
  if (!current.synced || !current.synced.length) return;
  const idx = findActiveIndex(current.synced, currentTime - offset);
  if (idx === activeIdx) return;
  activeIdx = idx;
  renderWindow();
}

btnSettings.addEventListener('click', () => panel.classList.toggle('open'));

const api = (window as any).overlayAPI as OverlayAPI | undefined;

function pushSetting(patch: Partial<ROverlaySettings>) {
  api?.updateSettings(patch);
  applySettings({
    fontSize: parseFloat(inFont.value),
    opacity: parseFloat(inOpacity.value),
    offset: parseFloat(inOffset.value),
    ...patch,
  });
}

inFont.addEventListener('input', () => pushSetting({ fontSize: parseFloat(inFont.value) }));
inOpacity.addEventListener('input', () => pushSetting({ opacity: parseFloat(inOpacity.value) }));
inOffset.addEventListener('input', () => pushSetting({ offset: parseFloat(inOffset.value) }));

if (!api) {
  statusEl.textContent = 'overlayAPI missing — preload did not load';
} else {
  api.onLyrics((l) => {
    console.log('[overlay-renderer] lyrics', l.status, l.track?.title);
    current = l;
    render();
    syncHighlight();
  });
  api.onTick((tick) => {
    currentTime = tick.currentTime;
    syncHighlight();
  });
  api.onSettings((s) => applySettings(s));
  render();
  api.ready();
}
