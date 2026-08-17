import type { OverlayLyrics, OverlayTick, SyncedLine } from '../../shared/types';

declare global {
  interface Window {
    overlayAPI: {
      onLyrics(cb: (l: OverlayLyrics) => void): void;
      onTick(cb: (t: OverlayTick) => void): void;
      ready(): void;
    };
  }
}

const statusEl = document.getElementById('status') as HTMLElement;
const lyricsEl = document.getElementById('lyrics') as HTMLElement;

let current: OverlayLyrics = { track: null, synced: null, plain: null, status: 'idle' };
let currentTime = 0;
let lineEls: HTMLDivElement[] = [];
let activeIdx = -1;

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
  const idx = findActiveIndex(current.synced, currentTime);
  if (idx === activeIdx) return;
  if (activeIdx >= 0 && lineEls[activeIdx]) lineEls[activeIdx].classList.remove('active');
  activeIdx = idx;
  if (idx >= 0 && lineEls[idx]) {
    lineEls[idx].classList.add('active');
    // Center the active line
    const target = lineEls[idx];
    const parent = lyricsEl;
    const offset = target.offsetTop - parent.clientHeight / 2 + target.clientHeight / 2;
    parent.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
  }
}

window.overlayAPI.onLyrics((l) => {
  current = l;
  render();
  syncHighlight();
});

window.overlayAPI.onTick((tick) => {
  currentTime = tick.currentTime;
  syncHighlight();
});

render();
window.overlayAPI.ready();
export {};
