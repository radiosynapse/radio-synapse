import { supabase } from '../lib/supabase';

export type PlaylistRotationType = 
  | 'heavy_rotation'   // Forte rotation (titres stars toutes les 2h)
  | 'medium_rotation'  // Moyenne rotation (titres récents toutes les 4h)
  | 'soft_rotation'    // Rotation douce / Nouveautés découvertes
  | 'gold_classics'    // Les classiques incontournables
  | 'night_lounge'     // Ambiance nocturne & chill
  | 'special_theme'    // Playlist thématique / Mix spécial
  | 'jingles_sweepers'; // Jingles & autopromos

export interface PlaylistEntry {
  id: string;
  stationId: string; // 'all' or specific station ID (e.g. 'pop-variete')
  name: string;
  type: PlaylistRotationType;
  description: string;
  color: string;
  trackIds: string[]; // array of track IDs
  isActive: boolean;
  repeatIntervalHours: number; // e.g. 2, 4, 8
  weight: number; // probability weight in Auto-DJ (1 to 10)
  targetDayparts?: string[]; // e.g. ['morning', 'day', 'evening', 'night']
  isFallbackAutoDj?: boolean; // Inclus dans le flux continu de secours
  fallbackPriority?: number; // 1 to 5 (priorité de secours si interruption)
  fallbackPlayMode?: 'shuffle' | 'sequential' | 'weighted'; // Mode de lecture secours
  createdAt: number;
}

const STORAGE_KEY = 'synapse_playlists_store_v1';
const PB_KEY_PLAYLISTS = 'playlists_store_v1';

export const INITIAL_PLAYLISTS: PlaylistEntry[] = [];

export function getStationPlaylists(stationFilter?: string): PlaylistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: PlaylistEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    if (stationFilter && stationFilter !== 'all') {
      return list.filter(p => p.stationId === 'all' || p.stationId === stationFilter);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveStationPlaylists(playlists: PlaylistEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    supabase.from('synapse_admin_data').upsert({
      key: PB_KEY_PLAYLISTS,
      payload: playlists,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(() => {});
  } catch (e) {
    console.error('Error saving playlists:', e);
  }
}

export function addStationPlaylist(playlist: Omit<PlaylistEntry, 'id' | 'createdAt'>): PlaylistEntry {
  const current = getStationPlaylists('all');
  const newPl: PlaylistEntry = {
    ...playlist,
    id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: Date.now(),
  };
  const updated = [newPl, ...current];
  saveStationPlaylists(updated);
  return newPl;
}

export function updateStationPlaylist(id: string, updates: Partial<PlaylistEntry>): void {
  const current = getStationPlaylists('all');
  const updated = current.map(p => p.id === id ? { ...p, ...updates } : p);
  saveStationPlaylists(updated);
}

export function deleteStationPlaylist(id: string): void {
  const current = getStationPlaylists('all');
  const updated = current.filter(p => p.id !== id);
  saveStationPlaylists(updated);
}

export function addTrackToPlaylist(playlistId: string, trackId: string): void {
  const current = getStationPlaylists('all');
  const updated = current.map(p => {
    if (p.id === playlistId) {
      if (!p.trackIds.includes(trackId)) {
        return { ...p, trackIds: [...p.trackIds, trackId] };
      }
    }
    return p;
  });
  saveStationPlaylists(updated);
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string): void {
  const current = getStationPlaylists('all');
  const updated = current.map(p => {
    if (p.id === playlistId) {
      return { ...p, trackIds: p.trackIds.filter(id => id !== trackId) };
    }
    return p;
  });
  saveStationPlaylists(updated);
}

export function reorderPlaylistTracks(playlistId: string, trackIds: string[]): void {
  const current = getStationPlaylists('all');
  const updated = current.map(p => {
    if (p.id === playlistId) {
      return { ...p, trackIds };
    }
    return p;
  });
  saveStationPlaylists(updated);
}

