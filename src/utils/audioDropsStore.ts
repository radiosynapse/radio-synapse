/**
 * Audio Drops & Jinglothèque Store for Radio Synapse
 * Manages jingles, station drops, emergency announcements, and live soundboard pads.
 */

import { supabase } from '../lib/supabase';

export type AudioDropCategory = 'jingle' | 'voice_drop' | 'announcement' | 'emergency' | 'intro';

export interface AudioDrop {
  id: string;
  name: string;
  category: AudioDropCategory;
  stationId?: string; // 'all' or specific station ID
  audioUrl: string; // Base64 data URL, blob URL, or PocketBase file URL
  duration: number; // in seconds
  createdAt: number;
  createdBy?: string;
  notes?: string;
  priority?: boolean;
  padColor?: string; // Hex color for the soundboard pad
}

const STORAGE_KEY = 'synapse_audio_drops_v1';

/**
 * Built-in audio procedural generator so soundboard pads ALWAYS work out-of-the-box
 * with rich futuristic radio FM sound effects!
 */
export function generateRadioJingleAudio(type: 'top_horaire' | 'frequency_drop' | 'emergency_alert' | 'station_sweep' | 'voice_intro'): string {
  try {
    const sampleRate = 44100;
    let durationSec = 3.5;
    if (type === 'top_horaire') durationSec = 3.0;
    if (type === 'emergency_alert') durationSec = 4.0;
    if (type === 'station_sweep') durationSec = 2.5;

    const numSamples = Math.floor(sampleRate * durationSec);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    const buffer = audioContext.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      if (type === 'top_horaire') {
        // 3 beeps then final high pitch resonant chime
        if (t < 0.6) {
          sample = Math.sin(2 * Math.PI * 440 * t) * 0.3 * Math.exp(-((t % 0.2) * 15));
        } else if (t < 1.2) {
          sample = Math.sin(2 * Math.PI * 440 * t) * 0.3 * Math.exp(-(((t - 0.6) % 0.2) * 15));
        } else if (t < 1.8) {
          sample = Math.sin(2 * Math.PI * 440 * t) * 0.3 * Math.exp(-(((t - 1.2) % 0.2) * 15));
        } else {
          // Master top horaire harmonic strike
          const t2 = t - 1.8;
          sample = (
            Math.sin(2 * Math.PI * 880 * t2) * 0.4 +
            Math.sin(2 * Math.PI * 1320 * t2) * 0.25 +
            Math.sin(2 * Math.PI * 1760 * t2) * 0.15
          ) * Math.exp(-t2 * 1.5);
        }
      } else if (type === 'emergency_alert') {
        // Dual-tone alert siren (853Hz + 960Hz standard EAS frequency)
        const sirenMod = Math.sin(2 * Math.PI * 4 * t) * 120;
        sample = (
          Math.sin(2 * Math.PI * (853 + sirenMod) * t) * 0.3 +
          Math.sin(2 * Math.PI * (960 - sirenMod) * t) * 0.3
        ) * Math.min(1, t * 5) * Math.max(0, 1 - (t / durationSec));
      } else if (type === 'frequency_drop') {
        // Sub drop with resonant laser sweep
        const freq = Math.max(40, 600 * Math.exp(-t * 3));
        const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.5;
        const sweep = Math.sin(2 * Math.PI * freq * t) * 0.4;
        sample = (sub + sweep) * Math.exp(-t * 0.8);
      } else {
        // Station sweep / jingle pad chord
        const chord = (
          Math.sin(2 * Math.PI * 523.25 * t) * 0.3 + // C5
          Math.sin(2 * Math.PI * 659.25 * t) * 0.25 + // E5
          Math.sin(2 * Math.PI * 783.99 * t) * 0.25 + // G5
          Math.sin(2 * Math.PI * 1046.50 * t) * 0.2 // C6
        ) * Math.exp(-t * 1.2);
        sample = chord;
      }

      // Add gentle stereo spread
      left[i] = sample * 0.7;
      right[i] = sample * 0.7;
    }

    // Convert AudioBuffer to WAV Base64 Data URL
    return audioBufferToWavDataUrl(buffer);
  } catch {
    return '';
  }
}

/**
 * Utility to serialize an AudioBuffer to a WAV data URL
 */
function audioBufferToWavDataUrl(buffer: AudioBuffer): string {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const length = buffer.length;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

/**
 * Initial starter audio drops
 */
export const DEFAULT_AUDIO_DROPS: AudioDrop[] = [
  {
    id: 'drop_top_horaire',
    name: 'Top Horaire Synapse (Bips FM)',
    category: 'jingle',
    stationId: 'all',
    duration: 3,
    createdAt: Date.now() - 3600000 * 24 * 7,
    createdBy: 'Radio Synapse Studio',
    notes: '3 bips de synchronisation suivis du carillon de l\'heure',
    padColor: '#00f2ff',
    audioUrl: generateRadioJingleAudio('top_horaire'),
  },
  {
    id: 'drop_freq_drop',
    name: 'Synapse Bass Drop & Sub Riser',
    category: 'voice_drop',
    stationId: 'all',
    duration: 3.5,
    createdAt: Date.now() - 3600000 * 24 * 6,
    createdBy: 'Régie Master',
    notes: 'Impact sub-basse avec balayage laser haute énergie',
    padColor: '#bd00ff',
    audioUrl: generateRadioJingleAudio('frequency_drop'),
  },
  {
    id: 'drop_station_sweep',
    name: 'Jingle Signature Synthétiseur',
    category: 'jingle',
    stationId: 'all',
    duration: 2.5,
    createdAt: Date.now() - 3600000 * 24 * 5,
    createdBy: 'Design Audio',
    notes: 'Accord cristallin signature Radio Synapse',
    padColor: '#00ffa3',
    audioUrl: generateRadioJingleAudio('station_sweep'),
  },
  {
    id: 'drop_flash_urgent',
    name: 'Signal Alerte Info Prioritaire',
    category: 'emergency',
    stationId: 'all',
    duration: 4,
    createdAt: Date.now() - 3600000 * 24 * 4,
    createdBy: 'Régie Direct',
    notes: 'Double tonalité d\'urgence avec sirène pour interruption prioritaire',
    priority: true,
    padColor: '#ff0055',
    audioUrl: generateRadioJingleAudio('emergency_alert'),
  },
];

/**
 * Retrieve all audio drops (localStorage cache + PocketBase)
 */
export function getAudioDrops(): AudioDrop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_AUDIO_DROPS;
}

/**
 * Save audio drops locally and sync to PocketBase
 */
export function saveAudioDrops(drops: AudioDrop[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drops));
  } catch {}

  // Sync to Supabase synapse_admin_data
  try {
    supabase.from('synapse_admin_data').upsert({
      key: 'audio_drops_list',
      payload: drops,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(() => {});
  } catch {}
}

/**
 * Fetch drops from Supabase with fallback
 */
export async function loadAudioDropsFromPocketBase(): Promise<AudioDrop[]> {
  try {
    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'audio_drops_list').maybeSingle();
    if (kv?.payload && Array.isArray(kv.payload) && kv.payload.length > 0) {
      saveAudioDrops(kv.payload);
      return kv.payload;
    }
  } catch {}

  return getAudioDrops();
}

/**
 * Add a new audio drop to the library
 */
export async function createAudioDrop(drop: Omit<AudioDrop, 'id' | 'createdAt'>): Promise<AudioDrop> {
  const current = getAudioDrops();
  const id = 'drop_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newDrop: AudioDrop = {
    ...drop,
    id,
    createdAt: Date.now(),
  };

  const updated = [newDrop, ...current];
  saveAudioDrops(updated);

  return newDrop;
}

/**
 * Delete an audio drop from library
 */
export async function deleteAudioDrop(id: string): Promise<void> {
  const current = getAudioDrops();
  const filtered = current.filter((d) => d.id !== id);
  saveAudioDrops(filtered);
}
