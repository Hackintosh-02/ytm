import type { OverlayLyrics, OverlayTick, SyncedLine } from '../../shared/types';

interface OverlaySettings {
  fontSize: number;
  opacity: number;
  offset: number;
}

declare global {
  interface Window {
    overlayAPI: {
      onLyrics(cb: (l: OverlayLyrics) => void): void;
      onTick(cb: (t: OverlayTick) => void): void;
      onSettings(cb: (s: OverlaySettings) => void): void;
      updateSettings(patch: Partial<OverlaySettings>): void;
      ready(): void;
    };
  }
}

console.log('[overlay-renderer] loaded, overlayAPI=', typeof window.overlayAPI);
const statusEl = document.getElementById('status') as HTMLElement;
const lyricsEl = document.getElementById('lyrics') as HTMLElement;
const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement;
const panel = document.getElementById('panel') as HTMLElement;
const inFont = document.getElementById('in-font') as HTMLInputElement;
const inOpacity = document.getElementById('in-opacity') as HTMLInputElement;
const inOffset = document.getElementById('in-offset') as HTMLInputElement;
const offsetReadout = document.getElementById('offset-readout') as HTMLElement;

let current: OverlayLyrics = { track: null, synced: null, plain: null, status: 'idle' };
let currentTime = 0;
let offset = 0;
let lineEls: HTMLDivElement[] = [];
let activeIdx = -1;

function applySettings(s: OverlaySettings) {
  document.body.style.setProperty('--font-size', `${s.fontSize}px`);
  document.body.style.setProperty('--bg-opacity', String(s.opacity));
  offset = s.offset;
  inFont.value = String(s.fontSize);
  inOpacity.value = String(s.opacity);
  inOffset.value = String(s.offset);
  offsetReadout.textContent = `${s.offset >= 0 ? '+' : ''}${s.offset.toFixed(1)}s`;
}

function render() {
  lyricsEl.innerHTML = '';
  lineEls = [];
  activeIdx = -1;

  if (current.status === 'idle') {
    statusEl.textContent = 'Waiting for a song…';
    return;
  }
  const t = current.track;
  const header = t ? `${t.title} — ${t.artist}` : '';
  statusEl.textContent =
    current.status === 'loading' ? `${header}   ·   loading lyrics…` :
    current.status === 'not-found' ? `${header}   ·   no lyrics found` :
    header;

  if (current.synced && current.synced.length) {
    for (const line of current.synced) {
      const div = document.createElement('div');
      div.className = 'line';
      div.textContent = line.text || '♪';
      lyricsEl.appendChild(div);
      lineEls.push(div);
    }
  } else if (current.plain) {
    for (const raw of current.plain.split(/\r?\n/)) {
      const div = document.createElement('div');
      div.className = 'line active';
      div.textContent = raw;
      lyricsEl.appendChild(div);
    }
  }
}

function findActiveIndex(lines: SyncedLine[], t: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

function syncHighlight() {
  if (!current.synced || !current.synced.length || !lineEls.length) return;
  const idx = findActiveIndex(current.synced, currentTime - offset);
  if (idx === activeIdx) return;
  if (activeIdx >= 0 && lineEls[activeIdx]) lineEls[activeIdx].classList.remove('active');
  activeIdx = idx;
  if (idx >= 0 && lineEls[idx]) {
    const target = lineEls[idx];
    target.classList.add('active');
    const offsetY = target.offsetTop - lyricsEl.clientHeight / 2 + target.clientHeight / 2;
    lyricsEl.scrollTo({ top: Math.max(0, offsetY), behavior: 'smooth' });
  }
}

btnSettings.addEventListener('click', () => panel.classList.toggle('open'));

function pushSetting(patch: Partial<OverlaySettings>) {
  window.overlayAPI.updateSettings(patch);
  // Optimistically apply locally so drag feels responsive
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

if (!window.overlayAPI) {
  statusEl.textContent = 'overlayAPI missing — preload did not load';
} else {
  window.overlayAPI.onLyrics((l) => {
    console.log('[overlay-renderer] lyrics', l.status, l.track?.title);
    current = l;
    render();
    syncHighlight();
  });

  window.overlayAPI.onTick((tick) => {
    currentTime = tick.currentTime;
    syncHighlight();
  });

  window.overlayAPI.onSettings((s) => applySettings(s));

  render();
  window.overlayAPI.ready();
}
export {};
