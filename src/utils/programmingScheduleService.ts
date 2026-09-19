import { LiquidsoapProgramEvent } from '../types/programming';
import { LiquidsoapPlaylist } from './liquidsoapBroadcasterService';
import { getStationPlaylists } from './playlistsStore';

const STORAGE_KEY_PROGRAM_EVENTS = 'synapse_liquidsoap_schedule_events_v2';
export const EVENT_SCHEDULE_CHANGED = 'synapse_schedule_data_changed';

export const INITIAL_PROGRAM_EVENTS: LiquidsoapProgramEvent[] = [];

export function getProgramEvents(): LiquidsoapProgramEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRAM_EVENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading program events from storage:', e);
  }
  return [];
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

  // 2. Configuration du flux continu de secours (Auto-DJ Fallback)
  const fallbackPlaylists = getStationPlaylists('all').filter((p) => p.isActive && p.isFallbackAutoDj !== false);

  script += `# ==============================================================================
# FLUX CONTINU DE SECOURS (AUTO-DJ BACKUP)
# Déclenché si aucun créneau de l'agenda n'est actif ou en cas de coupure de direct
# ==============================================================================
`;
  if (fallbackPlaylists.length > 0) {
    fallbackPlaylists.forEach((fpl) => {
      const cleanPlId = fpl.id.replace(/[^a-zA-Z0-9_]/g, '_');
      const plMode = fpl.fallbackPlayMode === 'shuffle' ? 'mode="randomize"' : 'mode="normal"';
      script += `# Playlist de secours : ${fpl.name} (Priorité #${fpl.fallbackPriority || 1}, Poids: ${fpl.weight}/10, Répétition: ${fpl.repeatIntervalHours}h)
autodj_pl_${cleanPlId} = playlist(id="${cleanPlId}", ${plMode}, reload_mode="watch", "${mediaPath}/playlists/${cleanPlId}")
`;
    });

    const fallbackSources = fallbackPlaylists.map((f) => `autodj_pl_${f.id.replace(/[^a-zA-Z0-9_]/g, '_')}`);
    const fallbackWeights = fallbackPlaylists.map((f) => f.weight || 5);

    script += `\n# Mix pondéré du flux continu de secours selon les règles de la section Playlists
autodj_mixed = rotate(weights=[${fallbackWeights.join(', ')}], [${fallbackSources.join(', ')}])\n\n`;
  } else {
    script += `autodj_mixed = playlist(id="default_fallback", mode="randomize", "${mediaPath}/default")\n\n`;
  }

  // 3. Aiguillage chronologique (Switch temporel)
  script += `# ==============================================================================
# AIGUILLAGE HORAIRE DE L'ANTENNE (LIQUIDSOAP TIME-SWITCH)
# Priorité 1 : Grille programmée de l'Agenda
# Priorité 2 : Flux continu de secours configuré ci-dessus
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

  script += `  # Fallback automatique vers le flux continu si aucun créneau n'est actif
  ({ true }, autodj_mixed)
])
`;

  return script;
}
