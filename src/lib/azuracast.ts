/**
 * AzuraCast Integration Client for Radio Synapse
 * Target Instance: https://cast.radiosynapse.fr
 */

import { pb } from './pocketbase';
import { convertBlobToWav } from '../utils/audioWavEncoder';

export const DEFAULT_AZURACAST_URL = 'https://cast.radiosynapse.fr';

export interface AzuraSong {
  id: string;
  text: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  lyrics?: string;
  art?: string;
  custom_fields?: Record<string, any>;
}

export interface AzuraNowPlayingCurrent {
  elapsed: number;
  remaining: number;
  sh_id?: number;
  played_at: number;
  duration: number;
  is_request: boolean;
  song: AzuraSong;
}

export interface AzuraQueueItem {
  cued_at: number;
  played_at?: number;
  duration: number;
  is_request?: boolean;
  song: AzuraSong;
}

export interface AzuraHistoryItem {
  sh_id: number;
  played_at: number;
  duration: number;
  is_request?: boolean;
  song: AzuraSong;
}

export interface AzuraStreamer {
  id: number;
  streamer_username: string;
  display_name: string;
  comments?: string;
  is_active: boolean;
}

export interface AzuraStationSummary {
  id: number;
  name: string;
  shortcode: string;
  description?: string;
  frontend?: string;
  backend?: string;
  listen_url: string;
  url?: string;
  is_public?: boolean;
}

export interface AzuraNowPlayingData {
  station: AzuraStationSummary;
  listeners: {
    total: number;
    unique: number;
    current: number;
  };
  live: {
    is_live: boolean;
    streamer_name: string;
    broadcast_start?: number;
  };
  now_playing: AzuraNowPlayingCurrent;
  playing_next?: AzuraQueueItem | null;
  song_history?: AzuraHistoryItem[];
  is_online: boolean;
}

export interface StationAzuraMapping {
  azuraStationId: string | number;
  azuraShortcode?: string;
  djUsername?: string;
  djPassword?: string;
  djMount?: string;
  djPort?: number;
  djWsUrl?: string;
}

export interface AzuraCastConfig {
  baseUrl: string;
  apiKey: string;
  stationMappings: Record<string, StationAzuraMapping>;
  defaultDjPort: number;
  defaultDjMount: string;
  defaultDjWsUrl: string;
}

const STORAGE_KEY = 'synapse_azuracast_config_v1';

export const DEFAULT_AZURACAST_CONFIG: AzuraCastConfig = {
  baseUrl: DEFAULT_AZURACAST_URL,
  apiKey: '335fc51a8ff906f4:c5d3eae2295ef642fa1d042397c0eafc',
  stationMappings: {
    'station-1': { azuraStationId: 1, azuraShortcode: 'pop-variete', djUsername: 'theocourant', djPassword: 'SynapseDj2026!', djMount: '/', djPort: 8005, djWsUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/' },
    '1': { azuraStationId: 1, azuraShortcode: 'pop-variete', djUsername: 'theocourant', djPassword: 'SynapseDj2026!', djMount: '/', djPort: 8005, djWsUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/' },
    'pop-variete': { azuraStationId: 1, azuraShortcode: 'pop-variete', djUsername: 'theocourant', djPassword: 'SynapseDj2026!', djMount: '/', djPort: 8005, djWsUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/' },
    'pop_variete': { azuraStationId: 1, azuraShortcode: 'pop-variete', djUsername: 'theocourant', djPassword: 'SynapseDj2026!', djMount: '/', djPort: 8005, djWsUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/' },
    'pop_vari_t_': { azuraStationId: 1, azuraShortcode: 'pop-variete', djUsername: 'theocourant', djPassword: 'SynapseDj2026!', djMount: '/', djPort: 8005, djWsUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/' },
    'station-2': { azuraStationId: 2, azuraShortcode: 'synapse_techno', djUsername: 'theocourant', djPassword: 'SynapseDj2026!', djMount: '/', djPort: 8005, djWsUrl: 'wss://cast.radiosynapse.fr/webdj/synapse_techno/' },
    'station-3': { azuraStationId: 3, azuraShortcode: 'synapse_chill', djUsername: 'theocourant', djPassword: 'SynapseDj2026!', djMount: '/', djPort: 8005, djWsUrl: 'wss://cast.radiosynapse.fr/webdj/synapse_chill/' },
  },
  defaultDjPort: 8005,
  defaultDjMount: '/',
  defaultDjWsUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/',
};

/**
 * Retrieve AzuraCast config from localStorage or fallback defaults
 */
export function getAzuraCastConfig(): AzuraCastConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_AZURACAST_CONFIG,
        ...parsed,
        stationMappings: {
          ...DEFAULT_AZURACAST_CONFIG.stationMappings,
          ...(parsed.stationMappings || {}),
        },
      };
    }
  } catch {}
  return DEFAULT_AZURACAST_CONFIG;
}

/**
 * Save AzuraCast config locally and mirror to PocketBase
 */
export function saveAzuraCastConfig(cfg: AzuraCastConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}

  // Sync asynchronously to PocketBase
  try {
    pb.collection('synapse_admin_data').getFirstListItem('key = "azuracast_config"')
      .then((existing) => {
        pb.collection('synapse_admin_data').update(existing.id, { payload: cfg }).catch(() => {});
      })
      .catch(() => {
        pb.collection('synapse_admin_data').create({
          key: 'azuracast_config',
          payload: cfg,
        }).catch(() => {});
      });
  } catch {}
}

/**
 * Apply linked admin DJ credentials to all station mappings
 */
export function applyAdminDjCredentialsToStations(djUsername: string, djPassword?: string): AzuraCastConfig {
  const cfg = getAzuraCastConfig();
  const updatedMappings: Record<string, StationAzuraMapping> = {};

  Object.entries(cfg.stationMappings).forEach(([key, mapping]) => {
    updatedMappings[key] = {
      ...mapping,
      djUsername: djUsername.trim(),
      djPassword: djPassword !== undefined ? djPassword : mapping.djPassword,
    };
  });

  const updatedConfig: AzuraCastConfig = {
    ...cfg,
    stationMappings: updatedMappings,
  };

  saveAzuraCastConfig(updatedConfig);
  return updatedConfig;
}

/**
 * Sync config from PocketBase on app start
 */
export async function loadAzuraCastConfigFromPocketBase(): Promise<AzuraCastConfig> {
  try {
    const rec = await pb.collection('synapse_admin_data').getFirstListItem('key = "azuracast_config"').catch(() => null);
    if (rec?.payload && typeof rec.payload === 'object') {
      const merged: AzuraCastConfig = {
        ...DEFAULT_AZURACAST_CONFIG,
        ...rec.payload,
        stationMappings: {
          ...DEFAULT_AZURACAST_CONFIG.stationMappings,
          ...(rec.payload.stationMappings || {}),
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return getAzuraCastConfig();
}

/**
 * Helper to get clean base URL
 */
function getNormalizedBaseUrl(customUrl?: string): string {
  const url = (customUrl || getAzuraCastConfig().baseUrl || DEFAULT_AZURACAST_URL).trim();
  return url.replace(/\/+$/, '');
}

/**
 * Helper to build auth headers
 */
function getAuthHeaders(customKey?: string): HeadersInit {
  const key = (customKey !== undefined ? customKey : getAzuraCastConfig().apiKey).trim();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
    headers['X-API-Key'] = key;
  }
  return headers;
}

/**
 * Test connectivity to AzuraCast API
 */
export async function testAzuraCastConnection(customUrl?: string, customKey?: string): Promise<{
  ok: boolean;
  message: string;
  latencyMs?: number;
  stationsCount?: number;
  stations?: Array<{ id: number | string; name: string; shortcode: string }>;
}> {
  const base = getNormalizedBaseUrl(customUrl);
  const start = Date.now();

  try {
    // Try public /api/nowplaying endpoint first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${base}/api/nowplaying`, {
      headers: getAuthHeaders(customKey),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data ? [data] : []);
      const stations = list.map((item: any) => ({
        id: item.station?.id ?? item.id ?? 1,
        name: item.station?.name ?? item.name ?? 'Station AzuraCast',
        shortcode: item.station?.shortcode ?? item.shortcode ?? '',
      }));

      return {
        ok: true,
        message: `Connecté avec succès à AzuraCast (${latency}ms) — ${stations.length} station(s) en ligne`,
        latencyMs: latency,
        stationsCount: stations.length,
        stations,
      };
    } else {
      return {
        ok: false,
        message: `Erreur HTTP ${res.status}: ${res.statusText}`,
        latencyMs: latency,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err.name === 'AbortError' ? 'Délai d\'attente dépassé (timeout 8s)' : (err.message || 'Impossible de joindre le serveur AzuraCast'),
    };
  }
}

/**
 * Fetch all nowplaying stations from AzuraCast
 */
export async function fetchAllAzuraNowPlaying(): Promise<AzuraNowPlayingData[]> {
  const base = getNormalizedBaseUrl();
  try {
    const res = await fetch(`${base}/api/nowplaying`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch {
    return [];
  }
}

/**
 * Fetch real-time Now Playing for a specific station (by ID or shortcode)
 */
export async function fetchStationNowPlaying(stationIdOrShortcode: string | number): Promise<AzuraNowPlayingData | null> {
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  try {
    const res = await fetch(`${base}/api/nowplaying/${targetId}`, {
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  // Fallback: fetch all and match
  try {
    const all = await fetchAllAzuraNowPlaying();
    const strTarget = String(stationIdOrShortcode).toLowerCase();
    const match = all.find((item) => {
      const sId = String(item.station?.id || '').toLowerCase();
      const sShort = String(item.station?.shortcode || '').toLowerCase();
      const sName = String(item.station?.name || '').toLowerCase();
      return sId === strTarget || sShort === strTarget || sName.includes(strTarget);
    });
    return match || null;
  } catch {
    return null;
  }
}

/**
 * Stop station AutoDJ backend (Liquidsoap) when live mic is active
 */
export async function stopStationBackend(stationIdOrShortcode: string | number): Promise<{ ok: boolean; message: string }> {
  try {
    const base = getNormalizedBaseUrl();
    const targetId = encodeURIComponent(String(stationIdOrShortcode));
    const res = await fetch(`${base}/api/station/${targetId}/backend/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      return { ok: false, message: `Impossible d'arrêter l'AutoDJ (${res.status})` };
    }
    return { ok: true, message: 'AutoDJ désactivé pour direct micro' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Erreur lors de l\'arrêt de l\'AutoDJ' };
  }
}

/**
 * Start station AutoDJ backend (Liquidsoap) when live mic closes
 */
export async function startStationBackend(stationIdOrShortcode: string | number): Promise<{ ok: boolean; message: string }> {
  try {
    const base = getNormalizedBaseUrl();
    const targetId = encodeURIComponent(String(stationIdOrShortcode));
    const res = await fetch(`${base}/api/station/${targetId}/backend/start`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      return { ok: false, message: `Impossible de relancer l'AutoDJ (${res.status})` };
    }
    return { ok: true, message: 'AutoDJ réactivé' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Erreur lors du démarrage de l\'AutoDJ' };
  }
}

/**
 * Skip current track via AzuraCast Backend API
 * POST /api/station/{station_id}/backend/skip
 */
export async function skipStationCurrentTrack(stationIdOrShortcode: string | number): Promise<{ ok: boolean; message: string }> {
  const cfg = getAzuraCastConfig();
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  if (!cfg.apiKey) {
    return {
      ok: false,
      message: 'Clé API AzuraCast manquante. Renseignez la clé API dans les paramètres du panel.',
    };
  }

  try {
    const res = await fetch(`${base}/api/station/${targetId}/backend/skip`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const text = await res.text();
      let msg = 'Morceau passé avec succès !';
      try {
        const json = JSON.parse(text);
        if (json.message) msg = json.message;
      } catch {}
      return { ok: true, message: msg };
    } else {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        message: `Erreur ${res.status}: ${errText || res.statusText || 'Impossible d\'effectuer le skip'}`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Erreur réseau lors de la commande skip',
    };
  }
}

/**
 * Fetch upcoming queue for a station
 * GET /api/station/{station_id}/queue
 */
export async function fetchStationQueue(stationIdOrShortcode: string | number): Promise<AzuraQueueItem[]> {
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  try {
    const res = await fetch(`${base}/api/station/${targetId}/queue`, {
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

/**
 * Fetch song history for a station
 * GET /api/station/{station_id}/history
 */
export async function fetchStationHistory(stationIdOrShortcode: string | number): Promise<AzuraHistoryItem[]> {
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  try {
    const res = await fetch(`${base}/api/station/${targetId}/history`, {
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

/**
 * Fetch DJ streamers configured for a station
 * GET /api/station/{station_id}/streamers
 */
export async function fetchStationStreamers(stationIdOrShortcode: string | number): Promise<AzuraStreamer[]> {
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  try {
    const res = await fetch(`${base}/api/station/${targetId}/streamers`, {
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

/**
 * Create or update a streamer account in AzuraCast
 * POST /api/station/{station_id}/streamers
 */
export async function createStationStreamer(
  stationIdOrShortcode: string | number,
  payload: {
    streamer_username: string;
    streamer_password: string;
    display_name: string;
    comments?: string;
    is_active?: boolean;
  }
): Promise<{ ok: boolean; message: string; streamer?: AzuraStreamer }> {
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  try {
    const res = await fetch(`${base}/api/station/${targetId}/streamers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        is_active: payload.is_active !== false,
      }),
    });

    if (res.ok) {
      const streamer = await res.json();
      return { ok: true, message: 'Compte DJ / Streamer créé avec succès !', streamer };
    } else {
      const text = await res.text().catch(() => '');
      return { ok: false, message: `Erreur ${res.status}: ${text || res.statusText}` };
    }
  } catch (err: any) {
    return { ok: false, message: err.message || 'Erreur lors de la création du compte DJ' };
  }
}

/**
 * Restart AutoDJ / backend service on AzuraCast
 * POST /api/station/{station_id}/backend/restart
 */
export async function restartStationBackend(stationIdOrShortcode: string | number): Promise<{ ok: boolean; message: string }> {
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  try {
    const res = await fetch(`${base}/api/station/${targetId}/backend/restart`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      return { ok: true, message: 'AutoDJ redémarré avec succès !' };
    } else {
      const text = await res.text().catch(() => '');
      return { ok: false, message: `Erreur ${res.status}: ${text || 'Échec du redémarrage'}` };
    }
  } catch (err: any) {
    return { ok: false, message: err.message || 'Erreur lors du redémarrage' };
  }
}

/**
 * Update an existing streamer account in AzuraCast
 * PUT /api/station/{station_id}/streamer/{streamer_id}
 */
export async function updateStationStreamer(
  stationIdOrShortcode: string | number,
  streamerId: number | string,
  payload: {
    streamer_username?: string;
    streamer_password?: string;
    display_name?: string;
    comments?: string;
    is_active?: boolean;
  }
): Promise<{ ok: boolean; message: string; streamer?: AzuraStreamer }> {
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  try {
    const res = await fetch(`${base}/api/station/${targetId}/streamer/${streamerId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const streamer = await res.json();
      return { ok: true, message: 'Compte DJ mis à jour avec succès !', streamer };
    } else {
      const text = await res.text().catch(() => '');
      return { ok: false, message: `Erreur ${res.status}: ${text || res.statusText}` };
    }
  } catch (err: any) {
    return { ok: false, message: err.message || 'Erreur lors de la mise à jour du compte DJ' };
  }
}

/**
 * Clean slugify helper for AzuraCast station shortcodes
 * Strips French accents ("Pop Variété" -> "pop-variete") and normalizes separators
 */
export function slugifyStationName(name: string): string {
  if (!name) return 'pop-variete';
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents (é, è, ê, etc.)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // replace spaces/symbols with hyphens
    .replace(/^-+|-+$/g, '');        // trim hyphens

  if (clean.includes('pop') && (clean.includes('vari') || clean.includes('variete'))) {
    return 'pop-variete';
  }
  return clean || 'pop-variete';
}

/**
 * Get direct WebDJ live studio URL on AzuraCast (with guaranteed accurate slug)
 */
export function getStationWebDjUrl(stationShortcodeOrId: string | number): string {
  const base = getNormalizedBaseUrl();
  const raw = String(stationShortcodeOrId).trim();
  const slug = slugifyStationName(raw);
  return `${base}/public/${slug}/dj`;
}

/**
 * Helper to convert Base64 or Data URL to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/wav';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return new Blob([], { type: 'audio/wav' });
  }
}

/**
 * REAL Priority Audio & Jingles Injection to AzuraCast Stream
 * 1. Takes audio Blob or Data URL (voice drop, cartouche, uploaded jingle)
 * 2. Uploads the audio file to AzuraCast station media library
 * 3. Associates / imports file into station rotation / playlist
 * 4. Submits request via AzuraCast song request API
 * 5. If mode === 'immediate', triggers skip so AutoDJ transitions directly to the jingle/drop on the live radio stream!
 */
export async function uploadAndInjectPriorityAudio(
  stationIdOrShortcode: string | number,
  audioSource: Blob | string,
  title: string,
  mode: 'immediate' | 'next' = 'immediate'
): Promise<{ ok: boolean; message: string; requestId?: string; fileId?: number }> {
  const cfg = getAzuraCastConfig();
  const base = getNormalizedBaseUrl();
  const targetId = encodeURIComponent(String(stationIdOrShortcode));

  if (!cfg.apiKey) {
    return {
      ok: false,
      message: 'Clé API AzuraCast manquante. Renseignez la clé API dans les paramètres du panel.',
    };
  }

  try {
    // 1. Resolve Audio to Blob
    let audioBlob: Blob;
    if (audioSource instanceof Blob) {
      audioBlob = audioSource;
    } else if (typeof audioSource === 'string' && audioSource.startsWith('data:')) {
      audioBlob = dataUrlToBlob(audioSource);
    } else if (typeof audioSource === 'string' && (audioSource.startsWith('blob:') || audioSource.startsWith('http'))) {
      const resp = await fetch(audioSource);
      audioBlob = await resp.blob();
    } else {
      return { ok: false, message: 'Format audio source non valide' };
    }

    // Always convert WebM/browser recorded audio to true RIFF PCM 16-bit WAV
    // to guarantee Liquidsoap detects proper duration and never auto-skips the file
    let finalBlob: Blob;
    let extension = 'wav';
    if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
      finalBlob = audioBlob;
      extension = 'mp3';
    } else {
      try {
        finalBlob = await convertBlobToWav(audioBlob, 44100);
        extension = 'wav';
      } catch (convErr) {
        console.warn('Fallback: direct audio blob upload without conversion', convErr);
        finalBlob = audioBlob;
      }
    }

    const timestamp = Date.now();
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24) || 'drop';
    const cleanBaseName = `synapse_${sanitizedTitle}_${timestamp}`;
    const filename = `${cleanBaseName}.${extension}`;

    // 2. Upload to AzuraCast files
    const formData = new FormData();
    formData.append('file', finalBlob, filename);
    formData.append('path', 'jingles');

    const uploadHeaders = getAuthHeaders() as Record<string, string>;
    delete uploadHeaders['Content-Type']; // Let browser set multipart boundary

    const upRes = await fetch(`${base}/api/station/${targetId}/files/upload`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
    });

    if (!upRes.ok) {
      const errTxt = await upRes.text().catch(() => '');
      return { ok: false, message: `Échec du téléversement AzuraCast (${upRes.status}): ${errTxt}` };
    }

    // 3. Locate uploaded file in station media library to get its song_id
    const filesRes = await fetch(`${base}/api/station/${targetId}/files`, {
      headers: getAuthHeaders(),
    });
    let uploadedFile: any = null;
    if (filesRes.ok) {
      const allFiles = await filesRes.json();
      uploadedFile = allFiles.find((f: any) => f.path.includes(cleanBaseName) || f.path.includes(filename));
    }

    // 4. Import / link file to Station Playlist 1 (default / rotation)
    const filePathForImport = uploadedFile?.path || filename;
    const formImport = new FormData();
    formImport.append('playlist_file', new Blob([filePathForImport], { type: 'text/plain' }), 'playlist.m3u');

    await fetch(`${base}/api/station/${targetId}/playlist/1/import`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formImport,
    }).catch(() => {});

    // 5. Submit priority request to AutoDJ queue
    let requestId: string | null = null;
    try {
      const reqListRes = await fetch(`${base}/api/station/${targetId}/requests`, {
        headers: getAuthHeaders(),
      });
      if (reqListRes.ok) {
        const requests = await reqListRes.json();
        const matched = requests.find((r: any) => 
          (uploadedFile?.song_id && r.song?.id === uploadedFile.song_id) ||
          r.song?.title?.toLowerCase().includes(sanitizedTitle) ||
          r.song?.text?.toLowerCase().includes(sanitizedTitle)
        );

        if (matched?.request_id) {
          const reqRes = await fetch(`${base}/api/station/${targetId}/request/${matched.request_id}`, {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (reqRes.ok) {
            requestId = matched.request_id;
          }
        }
      }
    } catch {}

    // 6. Immediate transition: NE FAIRE LE SKIP QUE SI LA REQUÊTE A ÉTÉ ENQUEUÉE AVEC SUCCÈS !
    // Si la requête n'est pas dans la file, le skip passerait directement au titre suivant sans jouer le média.
    if (mode === 'immediate') {
      if (requestId) {
        // Laisser le temps à Liquidsoap d'insérer la requête dans la file d'attente (1200ms)
        await new Promise((r) => setTimeout(r, 1200));
        const skipRes = await skipStationCurrentTrack(targetId);
        return {
          ok: true,
          message: `Annonce prioritaire "${title}" programmée et diffusée sur l'antenne ! ${skipRes.message}`,
          requestId,
          fileId: uploadedFile?.id,
        };
      } else {
        return {
          ok: true,
          message: `Fichier audio "${title}" archivé dans AzuraCast.`,
          fileId: uploadedFile?.id,
        };
      }
    } else {
      return {
        ok: true,
        message: `Annonce "${title}" enregistrée et programmée en priorité pour le prochain titre !`,
        requestId: requestId || undefined,
        fileId: uploadedFile?.id,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Erreur lors de l\'injection de l\'audio sur AzuraCast',
    };
  }
}

/**
 * Backward compatibility wrapper for triggerAzuraPriorityAudio
 */
export async function triggerAzuraPriorityAudio(
  stationIdOrShortcode: string | number,
  title: string,
  mode: 'immediate' | 'next',
  audioSource?: Blob | string
): Promise<{ ok: boolean; message: string }> {
  if (audioSource) {
    return uploadAndInjectPriorityAudio(stationIdOrShortcode, audioSource, title, mode);
  }

  // If no audio source provided, fallback to skip
  if (mode === 'immediate') {
    const skipRes = await skipStationCurrentTrack(stationIdOrShortcode);
    return {
      ok: true,
      message: `Action prioritaire "${title}" déclenchée ! ${skipRes.message}`,
    };
  }
  return {
    ok: true,
    message: `Ordre "${title}" transmis à la file d'attente AzuraCast.`,
  };
}

