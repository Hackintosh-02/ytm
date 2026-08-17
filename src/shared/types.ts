export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  duration: number; // seconds
}

export interface PlaybackState {
  track: TrackInfo | null;
  currentTime: number; // seconds
  isPlaying: boolean;
}

export interface SyncedLine {
  time: number;
  text: string;
}

export interface OverlayLyrics {
  track: TrackInfo | null;
  synced: SyncedLine[] | null;
  plain: string | null;
  status: 'loading' | 'ready' | 'not-found' | 'idle';
}

export interface OverlayTick {
  currentTime: number;
  isPlaying: boolean;
}

export const IPC = {
  TrackChanged: 'ytm:track-changed',
  PlaybackTick: 'ytm:playback-tick',
  MediaControl: 'ytm:media-control',
  OverlayLyrics: 'ytm:overlay-lyrics',
  OverlayTick: 'ytm:overlay-tick',
} as const;

export type MediaControl = 'play-pause' | 'next' | 'previous';
