// Full length audio catalog mapping interface for dynamically resolved audio streams

export interface TrackAudioSource {
  title: string;
  artist: string;
  duration: number;
  audioUrl: string;
  coverUrl: string;
}

export const DISCO_FULL_TRACKS: TrackAudioSource[] = [];
export const ROCK_FULL_TRACKS: TrackAudioSource[] = [];

