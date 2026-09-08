import { LikedTrack, ConnectedAccount } from '../types';
import { pb } from '../lib/pocketbase';
import { getStoredSynapseUser } from './pocketbaseAuthService';

const LIKED_TRACKS_KEY = 'radio_synapse_liked_tracks_v1';
const CONNECTED_ACCOUNT_KEY = 'radio_synapse_connected_account_v1';

export function makeTrackId(title: string, artist: string): string {
  return `${artist.toLowerCase().trim()}-${title.toLowerCase().trim()}`.replace(/[^a-z0-9-]/g, '');
}

export function generatePlatformLinks(title: string, artist: string) {
  const query = encodeURIComponent(`${artist} ${title}`);
  return {
    deezerUrl: `https://www.deezer.com/search/${query}`,
    spotifyUrl: `https://open.spotify.com/search/${query}`,
    appleMusicUrl: `https://music.apple.com/search?term=${query}`,
    youtubeUrl: `https://music.youtube.com/search?q=${query}`,
  };
}

export function getLikedTracks(): LikedTrack[] {
  try {
    const raw = localStorage.getItem(LIKED_TRACKS_KEY);
    if (!raw) return getInitialDefaultLikedTracks();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(t => ({ ...t, level: t.level || 1 })) : [];
  } catch {
    return getInitialDefaultLikedTracks();
  }
}

export function isTrackLiked(title: string, artist: string): boolean {
  const id = makeTrackId(title, artist);
  const tracks = getLikedTracks();
  return tracks.some((t) => t.id === id);
}

export function getTrackLikeLevel(title: string, artist: string): 0 | 1 | 2 {
  const id = makeTrackId(title, artist);
  const tracks = getLikedTracks();
  const found = tracks.find((t) => t.id === id);
  if (!found) return 0;
  return found.level === 2 ? 2 : 1;
}

export function saveLikedTracks(tracks: LikedTrack[]): void {
  try {
    localStorage.setItem(LIKED_TRACKS_KEY, JSON.stringify(tracks));
    // Trigger background sync to PocketBase if user is logged in
    const user = getStoredSynapseUser();
    if (user && user.id) {
      syncUserLikesToPocketBase(user.id, tracks).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save liked tracks', e);
  }
}

/**
 * Direct sync of liked tracks to PocketBase tables
 */
export async function syncUserLikesToPocketBase(userId: string, tracks: LikedTrack[]): Promise<void> {
  if (!userId) return;
  try {
    // 1. Upsert to user_synapse_data
    try {
      const existing = await pb.collection('user_synapse_data').getFirstListItem(`user_id = "${userId}"`).catch(() => null);
      if (existing) {
        await pb.collection('user_synapse_data').update(existing.id, {
          user_id: userId,
          liked_tracks: tracks,
        });
      } else {
        await pb.collection('user_synapse_data').create({
          user_id: userId,
          liked_tracks: tracks,
        });
      }
    } catch {}

    // 2. Also upsert to individual synapse_user_likes if needed
    if (tracks.length > 0) {
      for (const t of tracks) {
        try {
          const rowPayload = {
            like_id: `${userId}_${t.id}`,
            user_id: userId,
            track_id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album || '',
            cover_url: t.coverUrl,
            station_name: t.stationName || '',
            level: t.level || 1,
            preview_url: t.previewUrl || '',
            spotify_url: t.spotifyUrl || '',
            deezer_url: t.deezerUrl || '',
            apple_music_url: t.appleMusicUrl || '',
            youtube_url: t.youtubeUrl || '',
            liked_at: t.likedAt || Date.now(),
          };
          const existingLike = await pb.collection('synapse_user_likes').getFirstListItem(`like_id = "${rowPayload.like_id}"`).catch(() => null);
          if (existingLike) {
            await pb.collection('synapse_user_likes').update(existingLike.id, rowPayload);
          } else {
            await pb.collection('synapse_user_likes').create(rowPayload);
          }
        } catch {}
      }
    }
  } catch (err) {
    // Silent catch
  }
}

// Legacy alias for backwards compatibility
export const syncUserLikesToSupabase = syncUserLikesToPocketBase;

export async function addOrCycleLikedTrack(
  title: string,
  artist: string,
  coverUrl: string,
  album?: string,
  stationName?: string
): Promise<{ tracks: LikedTrack[]; newLevel: 0 | 1 | 2 }> {
  const id = makeTrackId(title, artist);
  const existing = getLikedTracks();
  const foundIndex = existing.findIndex((t) => t.id === id);

  if (foundIndex >= 0) {
    const currentTrack = existing[foundIndex];
    if (currentTrack.level === 1) {
      // Level 1 -> Level 2 (Super Like)
      const updated = [...existing];
      updated[foundIndex] = { ...currentTrack, level: 2 };
      saveLikedTracks(updated);
      return { tracks: updated, newLevel: 2 };
    } else {
      // Level 2 -> Remove
      const updated = existing.filter((t) => t.id !== id);
      saveLikedTracks(updated);
      return { tracks: updated, newLevel: 0 };
    }
  }

  // Level 0 -> Level 1 (Add as Liked)
  const links = generatePlatformLinks(title, artist);
  
  const newTrack: LikedTrack = {
    id,
    title,
    artist,
    album: album && album !== 'Live On-Air' ? album : undefined,
    coverUrl,
    stationName,
    likedAt: Date.now(),
    level: 1,
    ...links,
  };

  // Fetch preview URL if possible
  try {
    const searchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + title)}&entity=song&limit=1`
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.results && data.results.length > 0) {
        if (data.results[0].previewUrl) {
          newTrack.previewUrl = data.results[0].previewUrl;
        }
        if (data.results[0].collectionViewUrl) {
          newTrack.appleMusicUrl = data.results[0].collectionViewUrl;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch iTunes preview audio for track', err);
  }

  const updated = [newTrack, ...existing];
  saveLikedTracks(updated);
  return { tracks: updated, newLevel: 1 };
}

export function setTrackLevelInStorage(id: string, newLevel: 1 | 2): LikedTrack[] {
  const existing = getLikedTracks();
  const updated = existing.map((t) => (t.id === id ? { ...t, level: newLevel } : t));
  saveLikedTracks(updated);
  return updated;
}

export async function addLikedTrack(
  title: string,
  artist: string,
  coverUrl: string,
  album?: string,
  stationName?: string,
  level: 1 | 2 = 1
): Promise<LikedTrack[]> {
  const id = makeTrackId(title, artist);
  const existing = getLikedTracks();

  if (existing.some((t) => t.id === id)) {
    return existing; // Already liked
  }

  const links = generatePlatformLinks(title, artist);
  
  const newTrack: LikedTrack = {
    id,
    title,
    artist,
    album: album || 'Single',
    coverUrl,
    stationName,
    likedAt: Date.now(),
    level,
    ...links,
  };

  try {
    const searchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + title)}&entity=song&limit=1`
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.results && data.results.length > 0) {
        if (data.results[0].previewUrl) {
          newTrack.previewUrl = data.results[0].previewUrl;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch iTunes preview audio for track', err);
  }

  const updated = [newTrack, ...existing];
  saveLikedTracks(updated);
  return updated;
}

export function removeLikedTrack(title: string, artist: string): LikedTrack[] {
  const id = makeTrackId(title, artist);
  const existing = getLikedTracks();
  const updated = existing.filter((t) => t.id !== id);
  saveLikedTracks(updated);
  return updated;
}

export function removeLikedTrackById(id: string): LikedTrack[] {
  const existing = getLikedTracks();
  const updated = existing.filter((t) => t.id !== id);
  saveLikedTracks(updated);
  return updated;
}

// Account connection storage
export function getConnectedAccount(): ConnectedAccount | null {
  try {
    const raw = localStorage.getItem(CONNECTED_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Discard any broken fallback fake accounts that lack a real userId
    if (parsed && parsed.provider === 'spotify' && (!parsed.userId || parsed.username === 'Auditeur Spotify' || parsed.username === 'Membre Spotify')) {
      localStorage.removeItem(CONNECTED_ACCOUNT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveConnectedAccount(account: ConnectedAccount | null): void {
  try {
    if (!account) {
      localStorage.removeItem(CONNECTED_ACCOUNT_KEY);
    } else {
      localStorage.setItem(CONNECTED_ACCOUNT_KEY, JSON.stringify(account));
    }
  } catch (e) {
    console.error('Failed to save connected account', e);
  }
}

// Clean initial tracks - empty until fetched or liked by listener
function getInitialDefaultLikedTracks(): LikedTrack[] {
  return [];
}
