# YTM Desktop

Unofficial YouTube Music desktop app for macOS (and Windows/Linux) with a
floating, always-on-top lyrics overlay powered by [LRCLIB](https://lrclib.net).

## Features

- Native window wrapping music.youtube.com with persistent login
- System tray with now-playing and play/pause/next/previous
- Hardware media keys (play/pause, next, previous) — works when unfocused
- Frameless, transparent, always-on-top lyrics overlay
  - Live synced lyric highlighting from LRCLIB
  - Follows you across Spaces and stays visible in fullscreen apps
  - Per-session font size, opacity, and timing offset controls (⚙ on hover)
  - Remembers position and size between launches
- Disk-cached lyrics so each song hits the network once
- Single-instance, hide-on-close, dock-reactivation — behaves like a real Mac app

## Requirements

- Node.js 18+
- npm 9+

## Development

```sh
npm install
npm run dev
```

`npm run dev` compiles TypeScript, copies static overlay assets into `dist/`,
and launches Electron.

Set `YTM_DEBUG=1` to log track changes and lyrics-fetch failures.

## Building a Mac DMG

```sh
npm run dist:mac
```

Output lands in `release/` as arm64 + x64 DMGs. Builds are **unsigned** —
right-click the app the first time to bypass Gatekeeper, or run:

```sh
xattr -dr com.apple.quarantine "/Applications/YTM Desktop.app"
```

Windows and Linux targets exist (`dist:win`, `dist:linux`) but are untested.

## How the lyrics overlay works

Rather than fingerprinting system audio (as an earlier iteration did on
Linux via PulseAudio + Shazam), the overlay reads the current track directly
from the YTM page's `navigator.mediaSession.metadata` and the underlying
`<video>` element's `currentTime`. Track metadata is sent to
[LRCLIB](https://lrclib.net), and synced lyrics are highlighted in real time.

The advantages:

- No system-audio capture — no BlackHole/PulseAudio required, fully cross-platform
- No ~10s Shazam identification delay — track changes register instantly
- Timing accuracy is limited only by the LRC file, not by fingerprint alignment

## Project layout

```
src/
  main/            Electron main process (window, tray, media keys, lyrics fetch)
  preload/         Preload scripts (contextIsolation-safe IPC bridges)
  renderer/        Renderer UIs (currently just the overlay)
  shared/          IPC channel names + shared types
build/             App icon (source PNG, electron-builder auto-converts)
assets/            Runtime assets copied into the packaged app
scripts/           Build helpers
```

## Credits

- Lyrics data from [LRCLIB](https://lrclib.net) — please consider donating
- Inspired by (and much smaller than) [th-ch/youtube-music](https://github.com/th-ch/youtube-music)
- Descends from [Hackintosh-02/lyrics-live](https://github.com/Hackintosh-02/lyrics-live)

## License

MIT
