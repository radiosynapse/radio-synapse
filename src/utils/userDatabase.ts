import { LikedTrack } from '../types';

export interface UserPersistedData {
  userId: string;
  username: string;
  email?: string;
  likedTracks: LikedTrack[];
  spotifyPlaylistId?: string;
  spotifyPlaylistUrl?: string;
  favoriteStations?: string[];
  updatedAt: number;
}

const DB_PREFIX = 'radio_synapse_db_user_';

/**
 * Save user data to persistent database (local storage & cloud API endpoint)
 */
export async function saveUserDataToDatabase(
  userId: string,
  data: Partial<UserPersistedData>
): Promise<UserPersistedData> {
  const cleanId = userId.trim().toLowerCase();
  const existing = await getUserDataFromDatabase(cleanId);
  
  const updatedData: UserPersistedData = {
    userId: cleanId,
    username: data.username || existing?.username || 'Membre Synapse',
    email: data.email || existing?.email,
    likedTracks: data.likedTracks || existing?.likedTracks || [],
    spotifyPlaylistId: data.spotifyPlaylistId || existing?.spotifyPlaylistId,
    spotifyPlaylistUrl: data.spotifyPlaylistUrl || existing?.spotifyPlaylistUrl,
    favoriteStations: data.favoriteStations || existing?.favoriteStations || [],
    updatedAt: Date.now(),
  };

  // 1. Save locally with user ID key
  try {
    localStorage.setItem(`${DB_PREFIX}${cleanId}`, JSON.stringify(updatedData));
    localStorage.setItem('radio_synapse_last_active_user_id', cleanId);
  } catch (e) {
    console.error('Failed to save to local storage DB', e);
  }

  // 2. Post to backend persistence endpoint if available
  try {
    await fetch(`/api/user-data/${encodeURIComponent(cleanId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    }).catch(() => {
      // Offline or client-side fallback
    });
  } catch {}

  return updatedData;
}

/**
 * Retrieve user data from database by Spotify User ID
 */
export async function getUserDataFromDatabase(
  userId: string
): Promise<UserPersistedData | null> {
  const cleanId = userId.trim().toLowerCase();

  // 1. Try local storage first for instant loading
  try {
    const raw = localStorage.getItem(`${DB_PREFIX}${cleanId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed;
    }
  } catch (e) {
    console.warn('Error reading user local DB', e);
  }

  // 2. Try backend API
  try {
    const res = await fetch(`/api/user-data/${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.userId) {
        localStorage.setItem(`${DB_PREFIX}${cleanId}`, JSON.stringify(data));
        return data;
      }
    }
  } catch {}

  return null;
}
