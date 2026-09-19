export type LiquidsoapAudioFormat = 'mp3' | 'aac' | 'flac' | 'opus';

export interface LiquidsoapStationConfig {
  id: string;
  name: string;
  shortCode: string;
  genre: string;
  tagline: string;
  mountpoint: string;
  format: LiquidsoapAudioFormat;
  bitrate: number; // in kbps (e.g. 128, 192, 320)
  samplerate: number; // 44100 or 48000
  channels: 1 | 2; // 1 = mono, 2 = stereo
  isEncodingActive: boolean;
  currentListeners: number;
  peakListeners: number;
  fallbackMount: string;
  logoUrl?: string;
}

export interface LiquidsoapPlaylist {
  id: string;
  name: string;
  type: 'general' | 'scheduled' | 'jingles' | 'clock_hourly' | 'requests' | 'fallback';
  weight: number; // 1 to 10
  crossfadeDuration: number; // seconds (e.g. 3, 5, 8)
  trackCount: number;
  totalDurationSeconds: number;
  isActive: boolean;
  scheduleRule?: string; // e.g. "Tous les soirs 22h-02h" or "Chaque heure à XX:00"
  color: string;
}

export interface LiquidsoapMediaTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  filePath: string;
  fileSizeMb: number;
  bitrate: number;
  genre: string;
  year?: number;
  bpm?: number;
  playlistIds: string[];
  cueIn?: number; // seconds
  cueOut?: number; // seconds
  replayGainDb?: number;
  coverUrl?: string;
  addedAt: string;
}

export interface LiquidsoapServerConfig {
  vpsHost: string;
  telnetPort: number;
  telnetPassword: string;
  httpApiPort: number;
  harborLivePort: number;
  harborMount: string;
  harborPassword: string;
  icecastHost: string;
  icecastPort: number;
  icecastSourcePassword: string;
  icecastAdminUser: string;
  icecastAdminPassword: string;
  musicStoragePath: string;
  logsPath: string;
}

export interface LiquidsoapMasterStatus {
  onAirState: 'live_dj' | 'autodj' | 'fallback' | 'offline';
  currentTrack: {
    artist: string;
    title: string;
    album: string;
    coverUrl: string;
    duration: number;
    elapsed: number;
    remaining: number;
    startedAt: string;
  };
  nextTrack: {
    artist: string;
    title: string;
    album: string;
  };
  uptimeSeconds: number;
  encoderCpuPercent: number;
  streamLatencyMs: number;
  telnetConnected: boolean;
  harborConnected: boolean;
  activeHarborUser: string | null;
  crossfadeMode: 'smart' | 'normal' | 'cut';
  masterGain: number; // 0.0 to 1.5
  masterLimiterActive: boolean;
  totalListenersAllStreams: number;
}

const STORAGE_KEY_REGIE_CONFIG = 'synapse_regie_liquidsoap_config_v1';
const STORAGE_KEY_REGIE_STATIONS = 'synapse_regie_stations_v1';
const STORAGE_KEY_REGIE_PLAYLISTS = 'synapse_regie_playlists_v1';
const STORAGE_KEY_REGIE_TRACKS = 'synapse_regie_tracks_v1';
const EVENT_REGIE_CHANGED = 'synapse_regie_data_changed';

// Event for app-wide station synchronization
export const EVENT_APP_STATIONS_SYNCED = 'synapse_app_stations_synced';

export interface IcecastMountInfo {
  mountpoint: string;
  name: string;
  format: LiquidsoapAudioFormat;
  bitrate: number;
  isLive: boolean;
  publicUrl: string;
  listeners: number;
  contentType: string;
  matchedStationId?: string;
  isActiveInUserApp: boolean;
}

/**
 * Generates the public stream URL for an Icecast mountpoint
 */
export function getIcecastPublicStreamUrl(serverConfig: LiquidsoapServerConfig, mountpoint: string): string {
  const host = serverConfig.icecastHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanMount = mountpoint.startsWith('/') ? mountpoint : `/${mountpoint}`;
  
  if (host === '127.0.0.1' || host === 'localhost') {
    return `https://cast.radiosynapse.fr${cleanMount}`;
  }
  
  const protocol = serverConfig.icecastPort === 443 ? 'https' : 'http';
  const portSuffix = (serverConfig.icecastPort === 80 || serverConfig.icecastPort === 443) ? '' : `:${serverConfig.icecastPort}`;
  return `${protocol}://${host}${portSuffix}${cleanMount}`;
}

/**
 * Scan and detect available encoded Icecast streams from Liquidsoap
 */
export async function detectIcecastStreams(
  serverConfig: LiquidsoapServerConfig = getRegieServerConfig(),
  stations: LiquidsoapStationConfig[] = getRegieStations()
): Promise<IcecastMountInfo[]> {
  // Build expected mounts from active liquidsoap station configurations
  return stations.map((st) => {
    const publicUrl = getIcecastPublicStreamUrl(serverConfig, st.mountpoint);
    const contentType = 
      st.format === 'mp3' ? 'audio/mpeg' :
      st.format === 'aac' ? 'audio/aac' :
      st.format === 'flac' ? 'audio/flac' : 'audio/ogg';

    return {
      mountpoint: st.mountpoint,
      name: st.name,
      format: st.format,
      bitrate: st.bitrate,
      isLive: st.isEncodingActive,
      publicUrl,
      listeners: st.currentListeners,
      contentType,
      matchedStationId: st.id,
      isActiveInUserApp: st.isEncodingActive,
    };
  });
}

/**
 * Synchronize Liquidsoap stations to the user application frontend player
 */
export function syncLiquidsoapToUserAppPlayer(stations: LiquidsoapStationConfig[], serverConfig: LiquidsoapServerConfig = getRegieServerConfig()): void {
  try {
    const existingRaw = localStorage.getItem('synapse_stations_v1') || localStorage.getItem('synapse_stations');
    let existingStations: any[] = [];
    if (existingRaw) {
      try { existingStations = JSON.parse(existingRaw); } catch {}
    }

    const appStations = stations.map((st, idx) => {
      const existing = existingStations.find((e: any) => e.id === st.id || e.shortCode === st.shortCode);
      const streamUrl = getIcecastPublicStreamUrl(serverConfig, st.mountpoint);

      return {
        id: st.id,
        name: st.name,
        genre: st.genre,
        description: st.tagline || `${st.genre} - Stream ${st.bitrate} kbps ${st.format.toUpperCase()}`,
        color: existing?.color || (idx === 0 ? '#00f2ff' : idx === 1 ? '#ff00a0' : idx === 2 ? '#a855f7' : '#10b981'),
        stationNumber: existing?.stationNumber || String(idx + 1).padStart(2, '0'),
        streamUrl: streamUrl,
        urls: {
          low: streamUrl,
          medium: streamUrl,
          high: streamUrl,
        },
        enabled: st.isEncodingActive,
        isCustom: true,
        liquidsoapMount: st.mountpoint,
        liquidsoapFormat: st.format,
        liquidsoapBitrate: st.bitrate,
      };
    });

    localStorage.setItem('synapse_stations_v1', JSON.stringify(appStations));
    localStorage.setItem('synapse_stations', JSON.stringify(appStations));

    // Dispatch global event for immediate player update
    window.dispatchEvent(new CustomEvent(EVENT_APP_STATIONS_SYNCED, { detail: { stations: appStations } }));
  } catch (err) {
    console.error('Failed to sync Liquidsoap stations to user app player:', err);
  }
}

export const DEFAULT_REGIE_SERVER_CONFIG: LiquidsoapServerConfig = {
  vpsHost: '127.0.0.1',
  telnetPort: 8572,
  telnetPassword: 'synapse_telnet_pwd',
  httpApiPort: 8080,
  harborLivePort: 8005,
  harborMount: '/live',
  harborPassword: 'synapse_dj_live_pass',
  icecastHost: '127.0.0.1',
  icecastPort: 8000,
  icecastSourcePassword: 'synapse_icecast_source',
  icecastAdminUser: 'admin',
  icecastAdminPassword: 'synapse_icecast_admin',
  musicStoragePath: '/var/media/synapse/music',
  logsPath: '/var/log/liquidsoap/radio.log',
};

export const DEFAULT_REGIE_STATIONS: LiquidsoapStationConfig[] = [
  {
    id: 'synapse-main',
    name: 'Radio Synapse HD',
    shortCode: 'SYNAPSE-HD',
    genre: 'Électro, Synthwave, Chill & Pop',
    tagline: 'Le flux haute fidélité Master 320k',
    mountpoint: '/synapse_hd.mp3',
    format: 'mp3',
    bitrate: 320,
    samplerate: 44100,
    channels: 2,
    isEncodingActive: true,
    currentListeners: 142,
    peakListeners: 380,
    fallbackMount: '/fallback.mp3',
    logoUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'synapse-club',
    name: 'Synapse Club & DJ Sets',
    shortCode: 'SYNAPSE-CLUB',
    genre: 'Club, Tech House, Melodic Techno',
    tagline: 'Sets DJ en direct et clubbing non-stop',
    mountpoint: '/synapse_club.mp3',
    format: 'mp3',
    bitrate: 320,
    samplerate: 48000,
    channels: 2,
    isEncodingActive: true,
    currentListeners: 89,
    peakListeners: 245,
    fallbackMount: '/fallback.mp3',
    logoUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'synapse-chill',
    name: 'Synapse Lo-Fi & Chillout',
    shortCode: 'SYNAPSE-CHILL',
    genre: 'Lo-Fi Beats, Ambient, Downtempo',
    tagline: 'Atmosphère calme pour coder, lire ou travailler',
    mountpoint: '/synapse_chill.aac',
    format: 'aac',
    bitrate: 192,
    samplerate: 44100,
    channels: 2,
    isEncodingActive: true,
    currentListeners: 64,
    peakListeners: 180,
    fallbackMount: '/fallback.mp3',
    logoUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&auto=format&fit=crop&q=80',
  },
  {
    id: 'synapse-flac',
    name: 'Synapse Audiophile Lossless',
    shortCode: 'SYNAPSE-LOSSLESS',
    genre: 'Master Direct Studio Non Compressé',
    tagline: 'Diffusion FLAC 24-bit pure qualité studio',
    mountpoint: '/synapse_lossless.flac',
    format: 'flac',
    bitrate: 1411,
    samplerate: 48000,
    channels: 2,
    isEncodingActive: true,
    currentListeners: 28,
    peakListeners: 92,
    fallbackMount: '/fallback.mp3',
    logoUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
  },
];

export const DEFAULT_REGIE_PLAYLISTS: LiquidsoapPlaylist[] = [
  {
    id: 'pl-heavy',
    name: 'Rotation Heavy (Tubes & Nouveautés)',
    type: 'general',
    weight: 8,
    crossfadeDuration: 4,
    trackCount: 148,
    totalDurationSeconds: 31200,
    isActive: true,
    color: '#00f2ff',
  },
  {
    id: 'pl-soft',
    name: 'Rotation Soft & Gold Classiques',
    type: 'general',
    weight: 4,
    crossfadeDuration: 5,
    trackCount: 220,
    totalDurationSeconds: 46800,
    isActive: true,
    color: '#a855f7',
  },
  {
    id: 'pl-night',
    name: 'Sessions Clubbing Nocturne (22h - 04h)',
    type: 'scheduled',
    weight: 10,
    crossfadeDuration: 6,
    trackCount: 85,
    totalDurationSeconds: 24000,
    isActive: true,
    scheduleRule: 'Tous les jours 22:00 - 04:00',
    color: '#ff00a0',
  },
  {
    id: 'pl-jingles',
    name: 'Habillage, Drops & Jingles Synapse',
    type: 'jingles',
    weight: 5,
    crossfadeDuration: 2,
    trackCount: 32,
    totalDurationSeconds: 480,
    isActive: true,
    scheduleRule: '1 jingle tous les 4 titres',
    color: '#eab308',
  },
  {
    id: 'pl-clock',
    name: 'Top Horloge & Synthèse de l\'Heure',
    type: 'clock_hourly',
    weight: 10,
    crossfadeDuration: 2,
    trackCount: 24,
    totalDurationSeconds: 360,
    isActive: true,
    scheduleRule: 'Chaque heure précise à XX:00:00',
    color: '#10b981',
  },
  {
    id: 'pl-fallback',
    name: 'Boucle de Secours d\'Urgence (Offline Safe)',
    type: 'fallback',
    weight: 1,
    crossfadeDuration: 3,
    trackCount: 15,
    totalDurationSeconds: 3600,
    isActive: true,
    scheduleRule: 'En cas de coupure de source principale',
    color: '#ef4444',
  },
];

export const DEFAULT_REGIE_TRACKS: LiquidsoapMediaTrack[] = [
  {
    id: 'track-1',
    title: 'Midnight City (Synapse Rework)',
    artist: 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    duration: 243,
    filePath: '/var/media/synapse/music/m83_midnight_city_rework.mp3',
    fileSizeMb: 9.8,
    bitrate: 320,
    genre: 'Synthwave / Electro',
    year: 2011,
    bpm: 105,
    playlistIds: ['pl-heavy'],
    cueIn: 0.5,
    cueOut: 242.0,
    replayGainDb: -1.2,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    addedAt: '2026-09-10T12:00:00Z',
  },
  {
    id: 'track-2',
    title: 'Starboy (Kygo Remix VIP)',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy Remixed',
    duration: 244,
    filePath: '/var/media/synapse/music/the_weeknd_starboy_kygo.mp3',
    fileSizeMb: 9.6,
    bitrate: 320,
    genre: 'Electro Pop',
    year: 2016,
    bpm: 120,
    playlistIds: ['pl-heavy', 'pl-night'],
    cueIn: 0.0,
    cueOut: 243.5,
    replayGainDb: -0.8,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    addedAt: '2026-09-11T14:30:00Z',
  },
  {
    id: 'track-3',
    title: 'Resonance',
    artist: 'HOME',
    album: 'Odyssey',
    duration: 212,
    filePath: '/var/media/synapse/music/home_resonance.mp3',
    fileSizeMb: 8.5,
    bitrate: 320,
    genre: 'Chillwave / Synthwave',
    year: 2014,
    bpm: 85,
    playlistIds: ['pl-soft'],
    cueIn: 0.2,
    cueOut: 211.5,
    replayGainDb: 0.0,
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&auto=format&fit=crop&q=80',
    addedAt: '2026-09-12T09:15:00Z',
  },
  {
    id: 'track-4',
    title: 'One More Time (12" Extended Club Mix)',
    artist: 'Daft Punk',
    album: 'Discovery',
    duration: 320,
    filePath: '/var/media/synapse/music/daft_punk_one_more_time_club.mp3',
    fileSizeMb: 12.8,
    bitrate: 320,
    genre: 'French House',
    year: 2001,
    bpm: 123,
    playlistIds: ['pl-heavy', 'pl-night'],
    cueIn: 0.4,
    cueOut: 319.0,
    replayGainDb: -1.5,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    addedAt: '2026-09-13T16:00:00Z',
  },
  {
    id: 'track-5',
    title: 'Synapse Radio - Top Horaire Synth 2026',
    artist: 'Radio Synapse FX',
    album: 'Station ID 2026',
    duration: 15,
    filePath: '/var/media/synapse/music/jingles/synapse_top_horaire.mp3',
    fileSizeMb: 0.8,
    bitrate: 320,
    genre: 'Jingle / Station ID',
    year: 2026,
    bpm: 120,
    playlistIds: ['pl-clock', 'pl-jingles'],
    cueIn: 0.0,
    cueOut: 15.0,
    replayGainDb: +1.0,
    addedAt: '2026-09-14T10:00:00Z',
  },
];

// Helper functions for state retrieval & persistence
export function getRegieServerConfig(): LiquidsoapServerConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGIE_CONFIG);
    if (raw) return { ...DEFAULT_REGIE_SERVER_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_REGIE_SERVER_CONFIG;
}

export function saveRegieServerConfig(config: LiquidsoapServerConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_REGIE_CONFIG, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(EVENT_REGIE_CHANGED));
  } catch (e) {
    console.error('Error saving regie server config:', e);
  }
}

export function getRegieStations(): LiquidsoapStationConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGIE_STATIONS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_REGIE_STATIONS;
}

export function saveRegieStations(stations: LiquidsoapStationConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REGIE_STATIONS, JSON.stringify(stations));
    window.dispatchEvent(new CustomEvent(EVENT_REGIE_CHANGED));
  } catch (e) {
    console.error('Error saving regie stations:', e);
  }
}

export function getRegiePlaylists(): LiquidsoapPlaylist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGIE_PLAYLISTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_REGIE_PLAYLISTS;
}

export function saveRegiePlaylists(playlists: LiquidsoapPlaylist[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REGIE_PLAYLISTS, JSON.stringify(playlists));
    window.dispatchEvent(new CustomEvent(EVENT_REGIE_CHANGED));
  } catch (e) {
    console.error('Error saving regie playlists:', e);
  }
}

export function getRegieTracks(): LiquidsoapMediaTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGIE_TRACKS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_REGIE_TRACKS;
}

export function saveRegieTracks(tracks: LiquidsoapMediaTrack[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REGIE_TRACKS, JSON.stringify(tracks));
    window.dispatchEvent(new CustomEvent(EVENT_REGIE_CHANGED));
  } catch (e) {
    console.error('Error saving regie tracks:', e);
  }
}

/**
 * Generate a complete, ready-to-run Liquidsoap 2.x script for the VPS
 */
export function generateLiquidsoapScript(
  config: LiquidsoapServerConfig,
  stations: LiquidsoapStationConfig[],
  playlists: LiquidsoapPlaylist[]
): string {
  const activeStations = stations.filter((s) => s.isEncodingActive);

  return `#!/usr/bin/liquidsoap
# ==============================================================================
# RADIO SYNAPSE - SCRIPT MAÎTRE DE RÉGIE LIQUIDSOAP (v2.2+)
# Généré automatiquement par la Console d'Administration Synapse
# VPS Host: ${config.vpsHost} | Icecast: ${config.icecastHost}:${config.icecastPort}
# ==============================================================================

# 1. PARAMÈTRES GLOBAUX & TELNET / SOCKET DE CONTRÔLE
set("log.file.path", "${config.logsPath}")
set("log.level", 3)
set("server.telnet", true)
set("server.telnet.bind_addr", "127.0.0.1")
set("server.telnet.port", ${config.telnetPort})
set("server.timeout", 30.0)

# 2. SOURCE HARBOR : ENTRÉE EN DIRECT POUR LES ANIMATEURS / DJS (Port ${config.harborLivePort})
# Permet la connexion avec BUTT, Mixxx, Traktor, VirtualDJ en direct
live_harbor = input.harbor(
  "${config.harborMount}",
  port = ${config.harborLivePort},
  password = "${config.harborPassword}",
  user = "source",
  max = 30.0
)

# 3. PLAYLISTS AUTODJ DE LA MÉDIATHÈQUE
# Emplacement des fichiers audio : ${config.musicStoragePath}
${playlists
  .filter((p) => p.isActive && p.type === 'general')
  .map(
    (p) =>
      `playlist_${p.id.replace(/-/g, '_')} = playlist(id="${p.id}", reload_mode="watch", "${config.musicStoragePath}/${p.id}")`
  )
  .join('\n')}

# Jingles et habillage d'antenne
jingles_source = playlist(id="synapse_jingles", reload_mode="watch", "${config.musicStoragePath}/jingles")

# Boucle d'urgence de secours (Fallback en cas de coupure de fichier)
fallback_emergency = single(id="fallback_safe", "${config.musicStoragePath}/fallback/emergency.mp3")

# 4. ROTATION DES PLAYLISTS AVEC PONDÉRATION INTELLIGENTE
autodj_mixed = rotate(weights = [${playlists
    .filter((p) => p.isActive && p.type === 'general')
    .map((p) => p.weight)
    .join(', ')}], [
  ${playlists
    .filter((p) => p.isActive && p.type === 'general')
    .map((p) => `playlist_${p.id.replace(/-/g, '_')}`)
    .join(',\n  ')}
])

# 5. INSERTION DES JINGLES & TRANSITIONS SMART CROSSFADE
# Ajoute 1 jingle tous les 4 titres avec fondu enchaîné
radio_with_jingles = rotate(weights=[4, 1], [autodj_mixed, jingles_source])

# Fondu enchaîné dynamique (Smart Crossfade 4s)
def smart_crossfade(a, b)
  add(normalize=false, [
    fade.out(duration=4.0, a),
    fade.in(duration=3.5, b)
  ])
end

radio_crossfaded = cross(smart_crossfade, radio_with_jingles)

# 6. HIÉRARCHIE DES SOURCES AVEC BASCULE AUTOMATIQUE SANS BLANC
# Priorité 1 : Entrée DJ Live (Harbor)
# Priorité 2 : AutoDJ avec playlists
# Priorité 3 : Fichier d'urgence
radio_master = fallback(track_sensitive = false, [
  live_harbor,
  radio_crossfaded,
  fallback_emergency
])

# 7. TRAITEMENT AUDIO DYNAMIQUE (NORMALISATION & COMPRESSION MASTER)
radio_master = nrj(radio_master)
radio_master = audio_process(radio_master)

# 8. SORTIES VERS LES RELAIS ICECAST ENCODAGE MULTI-FLUX
${activeStations
  .map((st) => {
    let encCmd = `output.icecast(%mp3(bitrate=${st.bitrate}, samplerate=${st.samplerate}),`;
    if (st.format === 'aac') {
      encCmd = `output.icecast(%fdkaac(bitrate=${st.bitrate}, samplerate=${st.samplerate}, aot="mpeg4_he_aac_v2"),`;
    } else if (st.format === 'flac') {
      encCmd = `output.icecast(%flac(samplerate=${st.samplerate}),`;
    } else if (st.format === 'opus') {
      encCmd = `output.icecast(%opus(bitrate=${st.bitrate}, samplerate=${st.samplerate}),`;
    }

    return `${encCmd}
  host = "${config.icecastHost}",
  port = ${config.icecastPort},
  password = "${config.icecastSourcePassword}",
  mount = "${st.mountpoint}",
  name = "${st.name}",
  description = "${st.tagline}",
  genre = "${st.genre}",
  url = "https://radiosynapse.fr",
  public = true,
  fallthrough = true,
  radio_master
)`;
  })
  .join('\n\n')}

# Fin du script - Radio Synapse Liquidsoap Régie
print(">>> [SYNAPSE RÉGIE] Liquidsoap démarré avec succès sur le VPS.")
`;
}

/**
 * VPS step-by-step installation instructions for Liquidsoap + Icecast2
 */
export function getLiquidsoapVpsSetupGuide(config: LiquidsoapServerConfig): string {
  return `# GUIDE D'INSTALLATION & CONFIGURATION VPS LIQUIDSOAP / ICECAST2 POUR RADIO SYNAPSE

Ce guide vous permet d'héberger votre régie de diffusion autonome directement sur votre VPS Linux (Debian / Ubuntu).

---

### ÉTAPE 1 : INSTALLATION DES PAQUETS SUR LE VPS

Connectez-vous à votre VPS en root (SSH) et exécutez :

\`\`\`bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y icecast2 liquidsoap libmp3lame0 libfdk-aac2 opus-tools netcat-traditional
\`\`\`

Lors de l'installation d'Icecast2 :
1. Choisissez "Oui" pour configurer Icecast2.
2. Nom d'hôte : \`${config.icecastHost}\` (ou l'IP/domaine de votre VPS).
3. Mot de passe source : \`${config.icecastSourcePassword}\`
4. Mot de passe relais : \`${config.icecastSourcePassword}\`
5. Mot de passe admin : \`${config.icecastAdminPassword}\`

---

### ÉTAPE 2 : CRÉATION DE L'ARBORESCENCE POUR LES MUSIQUES & JINGLES

Créez les dossiers qui contiendront vos morceaux :

\`\`\`bash
sudo mkdir -p ${config.musicStoragePath}/{heavy,soft,night,jingles,clock,fallback}
sudo mkdir -p /var/log/liquidsoap
sudo chown -R liquidsoap:liquidsoap ${config.musicStoragePath}
sudo chown -R liquidsoap:liquidsoap /var/log/liquidsoap
\`\`\`

Déposez vos fichiers MP3 dans les sous-dossiers correspondants.

---

### ÉTAPE 3 : DÉPLOIEMENT DU SCRIPT LIQUIDSOAP

1. Copiez le script généré depuis l'onglet "Régie" du panel admin.
2. Créez le fichier de configuration sur le VPS :

\`\`\`bash
sudo nano /etc/liquidsoap/radio.liq
\`\`\`

3. Collez le script et sauvegardez (\`Ctrl+O\`, \`Entrée\`, puis \`Ctrl+X\`).
4. Donnez les droits d'exécution à Liquidsoap :

\`\`\`bash
sudo chown liquidsoap:liquidsoap /etc/liquidsoap/radio.liq
sudo chmod +x /etc/liquidsoap/radio.liq
\`\`\`

---

### ÉTAPE 4 : CRÉATION DU SERVICE SYSTEMD (DÉMARRAGE AUTOMATIQUE)

Activez et démarrez Liquidsoap comme un service d'arrière-plan résilient :

\`\`\`bash
sudo systemctl enable icecast2
sudo systemctl restart icecast2

sudo systemctl enable liquidsoap@radio
sudo systemctl restart liquidsoap@radio
sudo systemctl status liquidsoap@radio
\`\`\`

---

### ÉTAPE 5 : OUVERTURE DU PARE-FEU (UFW)

Si vous utilisez un pare-feu UFW, ouvrez les ports nécessaires :

\`\`\`bash
# Port d'écoute public Icecast (auditeurs du lecteur web)
sudo ufw allow 8000/tcp

# Port Harbor (Prise d'antenne DJ en direct)
sudo ufw allow 8005/tcp

# Le port Telnet 8572 reste STRICTEMENT interne (127.0.0.1) pour des raisons de sécurité
\`\`\`

---

### ÉTAPE 6 : CONNEXION DES ANIMATEURS EN DIRECT (HARBOR)

Vos animateurs peuvent se connecter avec le logiciel BUTT (Broadcast Using This Tool), Mixxx ou VirtualDJ :
- **Serveur** : IP ou domaine de votre VPS
- **Port** : \`${config.harborLivePort}\`
- **Type** : Icecast 2
- **Point de montage** : \`${config.harborMount}\`
- **Utilisateur** : \`source\`
- **Mot de passe** : \`${config.harborPassword}\`

Dès qu'un DJ se connecte, Liquidsoap coupe en douceur l'AutoDJ et bascule l'antenne sur le live DJ !
`;
}

/**
 * Multi-VPS step-by-step installation instructions (Final High-Availability setup)
 * 1 VPS for App/Admin/Liquidsoap/DB + 1 VPS for Icecast Relay
 */
export function getLiquidsoapMultiVpsSetupGuide(config: LiquidsoapServerConfig): string {
  return `# GUIDE D'INSTALLATION FINALE (INFRASTRUCTURE SÉPARÉE MULTI-VPS)
## RADIO SYNAPSE • HAUTE DISPONIBILITÉ & SCALABILITÉ

Dans cette architecture définitive en production :
- **VPS 1 (Maître Applicatif, Régie & Données)** : Application Web, Panel Admin, Base PocketBase, Liquidsoap 2.2+, Stockage audio local et Port Harbor DJ Live.
- **VPS 2 (Relais Icecast Dédié Haute Capacité)** : Démon Icecast 2 optimisé pour encaisser 15 000+ auditeurs simultanés sans impacter la régie ni la base de données.

---

### PARTIE A : CONFIGURATION DU VPS 2 (RELAIS DE DIFFUSION ICECAST DÉDIÉ)

#### 1. Installation des paquets sur le VPS 2 (IP: ex: 198.51.100.20)
\`\`\`bash
sudo apt update && sudo apt install -y icecast2 nginx certbot python3-certbot-nginx
\`\`\`

#### 2. Configuration d'Icecast 2 (/etc/icecast2/icecast.xml sur VPS 2)
\`\`\`xml
<icecast>
    <location>Datacenter Paris - CDN Relay 01</location>
    <admin>noc@radiosynapse.fr</admin>
    <limits>
        <clients>15000</clients>
        <sources>20</sources>
        <queue-size>1048576</queue-size>
        <client-timeout>30</client-timeout>
        <header-timeout>15</header-timeout>
        <source-timeout>10</source-timeout>
        <burst-on-connect>1</burst-on-connect>
        <burst-size>131072</burst-size>
    </limits>
    <authentication>
        <source-password>${config.icecastSourcePassword}</source-password>
        <relay-password>${config.icecastSourcePassword}</relay-password>
        <admin-user>synapse_admin</admin-user>
        <admin-password>${config.icecastAdminPassword}</admin-password>
    </authentication>
    <listen-socket>
        <port>8000</port>
        <bind-address>0.0.0.0</bind-address>
    </listen-socket>
    <mount type="normal">
        <mount-name>/synapse_hd.mp3</mount-name>
        <fallback-mount>/synapse_fallback.mp3</fallback-mount>
        <fallback-override>1</fallback-override>
        <bitrate>320</bitrate>
        <type>audio/mpeg</type>
    </mount>
    <mount type="normal">
        <mount-name>/synapse_club.mp3</mount-name>
        <bitrate>256</bitrate>
        <type>audio/mpeg</type>
    </mount>
    <mount type="normal">
        <mount-name>/synapse_chill.aac</mount-name>
        <bitrate>192</bitrate>
        <type>audio/aac</type>
    </mount>
</icecast>
\`\`\`

#### 3. Démarrage d'Icecast et Pare-feu sur VPS 2
\`\`\`bash
sudo sed -i 's/ENABLE=false/ENABLE=true/g' /etc/default/icecast2
sudo systemctl restart icecast2
sudo systemctl enable icecast2

# Pare-feu UFW sur VPS 2
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Autoriser le port source 8000 uniquement pour le VPS 1 (IP du VPS 1)
sudo ufw allow from [IP_VPS_1] to any port 8000 proto tcp
sudo ufw enable
\`\`\`

#### 4. Nginx Reverse Proxy & Certificat SSL sur VPS 2 (stream.radiosynapse.fr)
\`\`\`nginx
# /etc/nginx/sites-available/stream.conf
server {
    listen 80;
    server_name stream.radiosynapse.fr;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name stream.radiosynapse.fr;
    ssl_certificate /etc/letsencrypt/live/stream.radiosynapse.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stream.radiosynapse.fr/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_buffering off;
        tcp_nodelay on;
        add_header Access-Control-Allow-Origin *;
    }
}
\`\`\`

---

### PARTIE B : CONFIGURATION DU VPS 1 (MAÎTRE APPLICATIF & RÉGIE)

Sur le VPS 1 (IP: ex: 203.0.113.10) tournent l'application web, PocketBase et Liquidsoap.

#### 1. Configuration de radio.liq pour diffuser vers le VPS 2
Dans /etc/liquidsoap/radio.liq sur le VPS 1, configurez l'adresse IP du VPS 2 :
\`\`\`liq
ICECAST_HOST = "stream.radiosynapse.fr"  # Ou IP publique du VPS 2
ICECAST_PORT = 8000
ICECAST_PASSWORD = "${config.icecastSourcePassword}"

output.icecast(
  %mp3(bitrate=320, samplerate=44100, stereo=true),
  host = ICECAST_HOST,
  port = ICECAST_PORT,
  password = ICECAST_PASSWORD,
  mount = "/synapse_hd.mp3",
  name = "Radio Synapse HD",
  fallible = true,
  master_processed
)
\`\`\`

#### 2. Démarrage de Liquidsoap sur VPS 1
\`\`\`bash
sudo systemctl restart liquidsoap@radio
sudo systemctl status liquidsoap@radio
\`\`\`

Le flux audio produit par Liquidsoap sur le VPS 1 est propulsé directement sur le relais dédié VPS 2. Vos auditeurs écoutent sur https://stream.radiosynapse.fr sans consommer la moindre ressource sur le VPS 1 !
`;
}
