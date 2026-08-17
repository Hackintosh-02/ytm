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

export const IPC = {
  TrackChanged: 'ytm:track-changed',
  PlaybackTick: 'ytm:playback-tick',
  MediaControl: 'ytm:media-control',
} as const;

export type MediaControl = 'play-pause' | 'next' | 'previous';
