import { LikedTrack } from '../types';
import { makeTrackId } from './favoritesStorage';

export interface SharedFlyerRecord {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl: string;
  stationName?: string;
  previewUrl?: string;
  deezerUrl: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  youtubeUrl: string;
  tidalUrl: string;
  amazonMusicUrl: string;
  createdAt: number;
  shareCount: number;
  flyerUrl: string;
}

const FLYERS_REGISTRY_KEY = 'radio_synapse_shared_flyers_registry_v1';

export function getSharedFlyersRegistry(): Record<string, SharedFlyerRecord> {
  try {
    const raw = localStorage.getItem(FLYERS_REGISTRY_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSharedFlyersRegistry(registry: Record<string, SharedFlyerRecord>): void {
  try {
    localStorage.setItem(FLYERS_REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('Failed to save flyers registry', e);
  }
}

/**
 * Returns the existing flyer or creates a permanent one if it does not exist yet.
 * Re-uses the exact same share link whenever any user shares this track.
 */
export function getOrCreateSharedFlyer(track: LikedTrack): SharedFlyerRecord {
  const registry = getSharedFlyersRegistry();
  const canonicalTrackKey = makeTrackId(track.title, track.artist);

  if (registry[canonicalTrackKey]) {
    // Re-use existing shared flyer link and increment counter
    const existing = registry[canonicalTrackKey];
    existing.shareCount = (existing.shareCount || 1) + 1;
    saveSharedFlyersRegistry(registry);
    return existing;
  }

  // Create permanent unique flyer record
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://radiosynapse.fr';
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  const flyerId = `syn-${canonicalTrackKey}`;
  const queryParams = new URLSearchParams();
  queryParams.set('flyer', flyerId);
  queryParams.set('title', track.title);
  queryParams.set('artist', track.artist);
  if (track.album) queryParams.set('album', track.album);
  if (track.coverUrl) queryParams.set('cover', track.coverUrl);
  if (track.stationName) queryParams.set('station', track.stationName);
  if (track.previewUrl) queryParams.set('preview', track.previewUrl);
  
  const permanentFlyerUrl = `${origin}${path}?${queryParams.toString()}`;

  const query = encodeURIComponent(`${track.artist} ${track.title}`);

  const newRecord: SharedFlyerRecord = {
    id: flyerId,
    trackId: canonicalTrackKey,
    title: track.title,
    artist: track.artist,
    album: track.album,
    coverUrl: track.coverUrl,
    stationName: track.stationName,
    previewUrl: track.previewUrl,
    deezerUrl: track.deezerUrl || `https://www.deezer.com/search/${query}`,
    spotifyUrl: track.spotifyUrl || `https://open.spotify.com/search/${query}`,
    appleMusicUrl: track.appleMusicUrl || `https://music.apple.com/fr/search?term=${query}`,
    youtubeUrl: track.youtubeUrl || `https://music.youtube.com/search?q=${query}`,
    tidalUrl: `https://listen.tidal.com/search?q=${query}`,
    amazonMusicUrl: `https://music.amazon.fr/search/${query}`,
    createdAt: Date.now(),
    shareCount: 1,
    flyerUrl: permanentFlyerUrl,
  };

  registry[canonicalTrackKey] = newRecord;
  saveSharedFlyersRegistry(registry);
  return newRecord;
}
