import { LiquidsoapProgramEvent } from '../types/programming';
import { LiquidsoapPlaylist } from './liquidsoapBroadcasterService';

const STORAGE_KEY_PROGRAM_EVENTS = 'synapse_liquidsoap_schedule_events_v2';
export const EVENT_SCHEDULE_CHANGED = 'synapse_schedule_data_changed';

export const INITIAL_PROGRAM_EVENTS: LiquidsoapProgramEvent[] = [
  {
    id: 'prog-rock-60-70',
    stationId: 'all',
    title: "Mix 60/70 Rock'n Roll & Vinyl Classics",
    host: 'DJ Mitch & Vintage Crew',
    genre: "Classic Rock & Roll 60s/70s",
    badge: 'ÉMISSION SPÉCIALE',
    description: 'Deux heures de légende : riffs saturés, perles vinyles rares des années 60 et 70. Chat interactif et demandes de titres ouverts !',
    color: '#f97316', // Orange
    scheduleType: 'weekly_recurring',
    daysOfWeek: [3, 6], // Mercredi et Samedi
    startTime: '14:00',
    endTime: '16:00',
    playlistIds: ['pl-heavy'],
    playbackBehavior: 'shuffle',
    loopBehavior: 'loop',
    jingleIntro: {
      enabled: true,
      name: "Jingle Entrée Émission Rock'n Roll 60s",
      filePath: '/var/media/synapse/music/jingles/intro_rock_60_70.mp3',
    },
    jingleOutro: {
      enabled: true,
      name: "Jingle Fin de Programme & Salutations",
      filePath: '/var/media/synapse/music/jingles/outro_rock_60_70.mp3',
    },
    jingleRotation: {
      enabled: true,
      frequencyTracks: 3, // 1 jingle tous les 3 titres
      jinglePlaylistId: 'pl-jingles',
    },
    features: {
      allowLiveChat: true,
      allowSongRequests: true,
      allowLiveVoting: true,
      isLiveSpecial: true,
    },
    isActive: true,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'prog-morning-synth',
    stationId: 'all',
    title: 'Morning Synthwave & Cyber Drive',
    host: 'Alexandre Roy',
    genre: 'Synthwave / Retrowave / Darksynth',
    badge: 'MATINALE 100% ÉNERGIE',
    description: 'Le réveil électronique rétro-futuriste pour bien attaquer la journée avec synthétiseurs analogiques et rythmes percutants.',
    color: '#00f2ff', // Cyan
    scheduleType: 'weekly_recurring',
    daysOfWeek: [1, 2, 3, 4, 5], // Du Lundi au Vendredi
    startTime: '07:00',
    endTime: '10:00',
    playlistIds: ['pl-heavy'],
    playbackBehavior: 'shuffle',
    loopBehavior: 'loop',
    jingleIntro: {
      enabled: true,
      name: 'Matinale Top Synth ID',
      filePath: '/var/media/synapse/music/jingles/synapse_top_horaire.mp3',
    },
    jingleOutro: {
      enabled: true,
      name: 'Transition Flash Matinale',
      filePath: '/var/media/synapse/music/jingles/outro_morning.mp3',
    },
    jingleRotation: {
      enabled: true,
      frequencyTracks: 4,
      jinglePlaylistId: 'pl-jingles',
    },
    features: {
      allowLiveChat: true,
      allowSongRequests: false,
      allowLiveVoting: false,
      isLiveSpecial: false,
    },
    isActive: true,
    createdAt: '2026-09-02T08:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'prog-club-night',
    stationId: 'all',
    title: 'Synapse Club & DJ Residency Live',
    host: 'DJ Guest & Resident Synapse',
    genre: 'Melodic Techno / Tech House / Club',
    badge: 'CLUBBING LIVE',
    description: 'Prise de contrôle en direct de la régie par les DJs résidents avec transitions clubbing et flux sans coupure.',
    color: '#ff00a0', // Magenta
    scheduleType: 'weekly_recurring',
    daysOfWeek: [5, 6], // Vendredi et Samedi
    startTime: '22:00',
    endTime: '02:00',
    playlistIds: ['pl-night'],
    playbackBehavior: 'sequential',
    loopBehavior: 'loop',
    jingleIntro: {
      enabled: true,
      name: 'Clubbing Intro Live Harbor Drop',
      filePath: '/var/media/synapse/music/jingles/club_intro.mp3',
    },
    jingleOutro: {
      enabled: false,
      name: '',
    },
    jingleRotation: {
      enabled: true,
      frequencyTracks: 5,
      jinglePlaylistId: 'pl-jingles',
    },
    features: {
      allowLiveChat: true,
      allowSongRequests: true,
      allowLiveVoting: true,
      isLiveSpecial: true,
    },
    isActive: true,
    createdAt: '2026-09-03T14:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'prog-lofi-sunday',
    stationId: 'all',
    title: 'Sunday Lo-Fi Study & Chillout',
    host: 'AutoDJ Curator Synapse',
    genre: 'Lo-Fi Hip Hop / Chillout / Downtempo',
    badge: 'CHILL & FOCUS',
    description: 'Une après-midi cocooning avec battements feutrés, craquements de vinyles et nappes apaisantes.',
    color: '#a855f7', // Purple
    scheduleType: 'weekly_recurring',
    daysOfWeek: [0], // Dimanche
    startTime: '14:00',
    endTime: '18:00',
    playlistIds: ['pl-soft'],
    playbackBehavior: 'shuffle',
    loopBehavior: 'loop',
    jingleIntro: {
      enabled: true,
      name: 'Lo-Fi Chill Drop',
      filePath: '/var/media/synapse/music/jingles/lofi_intro.mp3',
    },
    jingleOutro: {
      enabled: false,
      name: '',
    },
    jingleRotation: {
      enabled: true,
      frequencyTracks: 6,
      jinglePlaylistId: 'pl-jingles',
    },
    features: {
      allowLiveChat: true,
      allowSongRequests: true,
      allowLiveVoting: false,
      isLiveSpecial: false,
    },
    isActive: true,
    createdAt: '2026-09-04T12:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'prog-listeners-choice',
    stationId: 'all',
    title: 'Le Grand Mix des Auditeurs (Dédicaces)',
    host: 'Sarah & L\'Équipe Synapse',
    genre: 'Multi-Genres / Choix du Public',
    badge: '100% AUDITEURS',
    description: 'Émission interactive où l\'antenne est façonnée par vos dédicaces en direct et vos votes sur le player.',
    color: '#10b981', // Emerald
    scheduleType: 'weekly_recurring',
    daysOfWeek: [4], // Jeudi
    startTime: '20:00',
    endTime: '22:00',
    playlistIds: ['pl-heavy', 'pl-soft'],
    playbackBehavior: 'weighted',
    loopBehavior: 'loop',
    jingleIntro: {
      enabled: true,
      name: 'Jingle Spécial Dédicaces Auditeurs',
      filePath: '/var/media/synapse/music/jingles/dedicaces_intro.mp3',
    },
    jingleOutro: {
      enabled: true,
      name: 'Remerciements et Clôture',
      filePath: '/var/media/synapse/music/jingles/dedicaces_outro.mp3',
    },
    jingleRotation: {
      enabled: true,
      frequencyTracks: 2,
      jinglePlaylistId: 'pl-jingles',
    },
    features: {
      allowLiveChat: true,
      allowSongRequests: true,
      allowLiveVoting: true,
      isLiveSpecial: true,
    },
    isActive: true,
    createdAt: '2026-09-05T16:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  },
];

export function getProgramEvents(): LiquidsoapProgramEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRAM_EVENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading program events from storage:', e);
  }
  return INITIAL_PROGRAM_EVENTS;
}

export function saveProgramEvents(events: LiquidsoapProgramEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROGRAM_EVENTS, JSON.stringify(events));
    window.dispatchEvent(new CustomEvent(EVENT_SCHEDULE_CHANGED, { detail: events }));
  } catch (e) {
    console.error('Error saving program events to storage:', e);
  }
}

export function addProgramEvent(event: Omit<LiquidsoapProgramEvent, 'id' | 'createdAt' | 'updatedAt'>): LiquidsoapProgramEvent {
  const current = getProgramEvents();
  const newEvent: LiquidsoapProgramEvent = {
    ...event,
    id: `prog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = [...current, newEvent];
  saveProgramEvents(updated);
  return newEvent;
}

export function updateProgramEvent(id: string, updates: Partial<LiquidsoapProgramEvent>): void {
  const current = getProgramEvents();
  const updated = current.map((ev) => (ev.id === id ? { ...ev, ...updates, updatedAt: new Date().toISOString() } : ev));
  saveProgramEvents(updated);
}

export function deleteProgramEvent(id: string): void {
  const current = getProgramEvents();
  const updated = current.filter((ev) => ev.id !== id);
  saveProgramEvents(updated);
}

/**
 * Safe local date formatting (YYYY-MM-DD) avoiding UTC midnight timezone shift
 */
export function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Filter events for a given station
 */
export function getEventsForStation(stationId: string): LiquidsoapProgramEvent[] {
  const all = getProgramEvents();
  return all.filter((ev) => ev.isActive && (ev.stationId === 'all' || ev.stationId === stationId));
}

/**
 * Filter events occurring on a specific Date
 */
export function getEventsForDate(stationId: string, date: Date): LiquidsoapProgramEvent[] {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const dateString = formatDateYMD(date); // YYYY-MM-DD
  const stationEvents = getEventsForStation(stationId);

  return stationEvents.filter((ev) => {
    if (ev.scheduleType === 'weekly_recurring') {
      return ev.daysOfWeek?.includes(dayOfWeek);
    }
    if (ev.scheduleType === 'specific_date') {
      return ev.specificDate === dateString;
    }
    return false;
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Check if an event is currently on air right now
 */
export function getCurrentOnAirProgram(stationId: string): LiquidsoapProgramEvent | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayEvents = getEventsForDate(stationId, now);

  for (const ev of todayEvents) {
    const [startH, startM] = ev.startTime.split(':').map(Number);
    const [endH, endM] = ev.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    // Handle midnight crossing (e.g. 22:00 to 02:00)
    if (endMinutes < startMinutes) {
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return ev;
      }
    } else {
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return ev;
      }
    }
  }

  return null;
}

/**
 * Generate Liquidsoap configuration code reflecting the interactive agenda
 */
export function generateLiquidsoapScheduleScript(
  events: LiquidsoapProgramEvent[],
  _playlists?: LiquidsoapPlaylist[],
  mediaPath: string = '/var/media/synapse/music'
): string {
  const activeEvents = events.filter((e) => e.isActive);

  let script = `# ==============================================================================
# RADIO SYNAPSE - PROGRAMMATION CHRONOLOGIQUE LIQUIDSOAP
# Généré automatiquement depuis l'Agenda Interactif Synapse
# Événements actifs : ${activeEvents.length} créneaux planifiés
# ==============================================================================

# Source jingles globale
jingles_source = playlist(id="synapse_jingles", reload_mode="watch", "${mediaPath}/jingles")

`;

  // 1. Déclaration de chaque émission programmée
  activeEvents.forEach((ev) => {
    const cleanId = ev.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const plVarNames = ev.playlistIds.map((plId) => `playlist_${plId.replace(/-/g, '_')}`);
    const plFirst = plVarNames[0] || 'autodj_mixed';

    const modeFlag = ev.playbackBehavior === 'shuffle' ? 'mode="randomize"' : 'mode="normal"';

    script += `# ------------------------------------------------------------------------------
# PROGRAMME : ${ev.title} (Animateur : ${ev.host}) [${modeFlag}]
# ------------------------------------------------------------------------------
# Source playlist principale pour ${cleanId}
${cleanId}_source = ${plFirst}

`;

    // Rotation des jingles réguliers
    if (ev.jingleRotation.enabled && ev.jingleRotation.frequencyTracks > 0) {
      script += `# Jingle tous les ${ev.jingleRotation.frequencyTracks} titres
${cleanId}_with_jingles = rotate(weights=[${ev.jingleRotation.frequencyTracks}, 1], [${cleanId}_source, jingles_source])
`;
    } else {
      script += `${cleanId}_with_jingles = ${cleanId}_source\n`;
    }

    // Intro / Outro sequence
    if (ev.jingleIntro.enabled && ev.jingleIntro.filePath) {
      script += `${cleanId}_intro = single("${ev.jingleIntro.filePath}")
${cleanId}_ready = sequence([${cleanId}_intro, ${cleanId}_with_jingles])
`;
    } else {
      script += `${cleanId}_ready = ${cleanId}_with_jingles\n`;
    }

    script += '\n';
  });

  // 2. Aiguillage chronologique (Switch temporel)
  script += `# ==============================================================================
# AIGUILLAGE HORAIRE DE L'ANTENNE (LIQUIDSOAP TIME-SWITCH)
# ==============================================================================
scheduled_broadcast = switch([
`;

  activeEvents.forEach((ev) => {
    const cleanId = ev.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const [sH, sM] = ev.startTime.split(':');
    const [eH, eM] = ev.endTime.split(':');
    const timeRange = `${sH}h${sM}-${eH}h${eM}`;

    if (ev.scheduleType === 'weekly_recurring' && ev.daysOfWeek && ev.daysOfWeek.length > 0) {
      const daysCondition = ev.daysOfWeek.map((d) => `${d}w`).join(' or ');
      script += `  ({ (${daysCondition}) and ${timeRange} }, ${cleanId}_ready),\n`;
    } else if (ev.scheduleType === 'specific_date' && ev.specificDate) {
      // Date format YYYY-MM-DD
      script += `  # Date spécifique : ${ev.specificDate} de ${ev.startTime} à ${ev.endTime}\n`;
      script += `  ({ ${timeRange} }, ${cleanId}_ready),\n`;
    }
  });

  script += `  # Fallback automatique si aucun créneau n'est actif
  ({ true }, autodj_mixed)
])
`;

  return script;
}
