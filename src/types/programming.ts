export type PlaylistPlaybackBehavior = 'shuffle' | 'sequential' | 'weighted';
export type ScheduleRecurrenceType = 'weekly_recurring' | 'specific_date';

export interface LiquidsoapProgramEvent {
  id: string;
  stationId: string; // Target station ID e.g. 'synapse-main' or 'all'
  title: string;     // e.g. "Mix 60/70 Rock'n Roll"
  host: string;      // e.g. "DJ Max", "Sarah", "AutoDJ"
  genre: string;     // e.g. "Rock'n Roll Classic", "Synthwave 80s"
  badge: string;     // e.g. "DIRECT LIVE", "MIX DU SOIR", "CLUBBING", "LO-FI SPECIAL"
  description: string;
  color: string;     // Color for the agenda time block (e.g. '#00f2ff', '#a855f7', '#ff00a0', '#eab308')
  
  // Timing & Calendar
  scheduleType: ScheduleRecurrenceType; // 'weekly_recurring' or 'specific_date'
  daysOfWeek?: number[];                // [0..6] (0 = Dimanche, 1 = Lundi ...) for recurring
  specificDate?: string;                // YYYY-MM-DD for one-off / specific date events up to 3 months
  startTime: string;                    // "HH:MM" e.g. "14:00"
  endTime: string;                      // "HH:MM" e.g. "16:00"

  // Playlists association from Liquidsoap library
  playlistIds: string[];                // IDs from liquidsoap playlists (e.g. ['pl-heavy', 'pl-rock-60-70'])
  playbackBehavior: PlaylistPlaybackBehavior; // 'shuffle', 'sequential', 'weighted'
  loopBehavior: 'loop' | 'fallback_emergency';

  // Jingles & Sound Identity Rules
  jingleIntro: {
    enabled: boolean;
    name: string;      // e.g. "Jingle Entrée Émission Rock"
    filePath?: string; // e.g. "/var/media/synapse/music/jingles/intro_rock.mp3"
  };
  jingleOutro: {
    enabled: boolean;
    name: string;      // e.g. "Jingle Fin de Programme Outro"
    filePath?: string; // e.g. "/var/media/synapse/music/jingles/outro_rock.mp3"
  };
  jingleRotation: {
    enabled: boolean;
    frequencyTracks: number; // e.g. 3 (1 jingle tous les 3 titres)
    jinglePlaylistId?: string; // playlist id for jingles
  };

  // Dynamic Interactive Features during this show
  features: {
    allowLiveChat: boolean;        // Chat direct activé durant le programme
    allowSongRequests: boolean;    // Dédicaces & envois de titres de chansons
    allowLiveVoting: boolean;      // Votes & sondages en direct
    isLiveSpecial: boolean;        // Badge spécial DIRECT / Événement majeur
  };

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
