import { supabase } from '../lib/supabase';

export interface MusicFolder {
  id: string;
  name: string;
  color: string;
  stationId?: string; // 'all' or station ID
  description?: string;
  createdAt?: number;
}

export interface LibraryTrack {
  id: string;
  stationId: string; // 'all' or specific station ID (e.g. 'pop-variete')
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  genre: string;
  bpm: number;
  year?: number;
  energyLevel?: 'calm' | 'medium' | 'high' | 'peak';
  audioUrl: string;
  coverUrl?: string;
  folderId?: string; // ID of the parent folder or undefined for root
  fileSizeMb?: number;
  fileName?: string;
  cueIn?: number;  // start point in seconds
  cueOut?: number; // end point in seconds
  fadeDuration?: number; // fade in/out seconds
  addedAt: number;
  playCount?: number;
  rating?: number; // 1 to 5
}

const STORAGE_KEY = 'synapse_music_library_v1';
const FOLDERS_STORAGE_KEY = 'synapse_music_folders_v1';
const PB_KEY_TRACKS = 'music_library_tracks_v1';
const PB_KEY_FOLDERS = 'music_library_folders_v1';

export const INITIAL_MUSIC_FOLDERS: MusicFolder[] = [];

export const INITIAL_MUSIC_TRACKS: LibraryTrack[] = [];

export function getMusicLibraryTracks(stationFilter?: string): LibraryTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: LibraryTrack[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    
    if (stationFilter && stationFilter !== 'all') {
      return list.filter(t => t.stationId === 'all' || t.stationId === stationFilter);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveMusicLibraryTracks(tracks: LibraryTrack[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    supabase.from('synapse_admin_data').upsert({
      key: PB_KEY_TRACKS,
      payload: tracks,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(() => {});
  } catch (e) {
    console.error('Error saving music library:', e);
  }
}

export function addMusicTrack(track: Omit<LibraryTrack, 'id' | 'addedAt'>): LibraryTrack {
  const current = getMusicLibraryTracks('all');
  const newTrack: LibraryTrack = {
    ...track,
    id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    addedAt: Date.now(),
    playCount: 0,
    rating: track.rating || 4,
  };
  const updated = [newTrack, ...current];
  saveMusicLibraryTracks(updated);
  return newTrack;
}

export function updateMusicTrack(id: string, updates: Partial<LibraryTrack>): void {
  const current = getMusicLibraryTracks('all');
  const updated = current.map(t => t.id === id ? { ...t, ...updates } : t);
  saveMusicLibraryTracks(updated);
}

export function deleteMusicTrack(id: string): void {
  const current = getMusicLibraryTracks('all');
  const updated = current.filter(t => t.id !== id);
  saveMusicLibraryTracks(updated);
}

export function getMusicFolders(stationFilter?: string): MusicFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
    let list: MusicFolder[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    if (stationFilter && stationFilter !== 'all') {
      return list.filter(f => !f.stationId || f.stationId === 'all' || f.stationId === stationFilter);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveMusicFolders(folders: MusicFolder[]): void {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    supabase.from('synapse_admin_data').upsert({
      key: PB_KEY_FOLDERS,
      payload: folders,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(() => {});
  } catch (e) {
    console.error('Error saving music folders:', e);
  }
}

export function addMusicFolder(folder: Omit<MusicFolder, 'id'>): MusicFolder {
  const current = getMusicFolders('all');
  const newFolder: MusicFolder = {
    ...folder,
    id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: Date.now(),
  };
  const updated = [...current, newFolder];
  saveMusicFolders(updated);
  return newFolder;
}

export function updateMusicFolder(id: string, updates: Partial<MusicFolder>): void {
  const current = getMusicFolders('all');
  const updated = current.map(f => f.id === id ? { ...f, ...updates } : f);
  saveMusicFolders(updated);
}

export function deleteMusicFolder(id: string): void {
  const current = getMusicFolders('all');
  const updated = current.filter(f => f.id !== id);
  saveMusicFolders(updated);

  // Move tracks from deleted folder to root (folderId: undefined)
  const tracks = getMusicLibraryTracks('all');
  const updatedTracks = tracks.map(t => t.folderId === id ? { ...t, folderId: undefined } : t);
  saveMusicLibraryTracks(updatedTracks);
}

