import { supabase } from '../lib/supabase';

export type RundownSegmentType = 
  | 'jingle_intro'    // Jingle / Top Horaire / Générique
  | 'speech'          // Prise de parole animateur / Chronique
  | 'music_track'     // Titre musical programmé
  | 'interview'       // Interview invité / Appel auditeur
  | 'flash_news'      // Flash Info / Météo / Trafic
  | 'commercial'      // Pause publicitaire / Partenaire
  | 'jingle_outro';   // Décrochage / Fin d'émission

export interface RundownSegment {
  id: string;
  title: string;
  type: RundownSegmentType;
  durationSeconds: number;
  notes?: string;
  assignedSpeaker?: string;
  trackTitle?: string;
  trackArtist?: string;
  isCompleted?: boolean;
}

export interface EmissionShowPrep {
  id: string;
  stationId: string; // specific station or 'all'
  title: string;
  hostName: string;
  coHosts?: string[];
  theme: string;
  scheduledDate: string; // ISO or YYYY-MM-DD
  startTime: string;     // e.g. "18:00"
  endTime: string;       // e.g. "20:00"
  durationMinutes: number;
  status: 'draft' | 'ready' | 'live' | 'archived';
  segments: RundownSegment[];
  guestList?: string[];
  editorialNotes?: string;
  createdAt: number;
}

const STORAGE_KEY = 'synapse_emission_prep_store_v1';
const PB_KEY_EMISSIONS = 'emission_prep_store_v1';

export const INITIAL_EMISSIONS: EmissionShowPrep[] = [];

export function getEmissionShowPreps(stationFilter?: string): EmissionShowPrep[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: EmissionShowPrep[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    if (stationFilter && stationFilter !== 'all') {
      return list.filter(e => e.stationId === 'all' || e.stationId === stationFilter);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveEmissionShowPreps(shows: EmissionShowPrep[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shows));
    supabase.from('synapse_admin_data').upsert({
      key: PB_KEY_EMISSIONS,
      payload: shows,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(() => {});
  } catch (e) {
    console.error('Error saving emissions:', e);
  }
}

export function addEmissionShowPrep(show: Omit<EmissionShowPrep, 'id' | 'createdAt'>): EmissionShowPrep {
  const current = getEmissionShowPreps('all');
  const newShow: EmissionShowPrep = {
    ...show,
    id: `show_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: Date.now(),
  };
  const updated = [newShow, ...current];
  saveEmissionShowPreps(updated);
  return newShow;
}

export function updateEmissionShowPrep(id: string, updates: Partial<EmissionShowPrep>): void {
  const current = getEmissionShowPreps('all');
  const updated = current.map(s => s.id === id ? { ...s, ...updates } : s);
  saveEmissionShowPreps(updated);
}

export function deleteEmissionShowPrep(id: string): void {
  const current = getEmissionShowPreps('all');
  const updated = current.filter(s => s.id !== id);
  saveEmissionShowPreps(updated);
}
