import { StreamChannel } from '../data';
import { SynapseUser, UserRole } from '../types';
import { pb } from '../lib/pocketbase';
import { updateUserRoleInPocketBase } from './pocketbaseAuthService';
export { updateUserRoleInPocketBase };

export type ChallengeType = 'stats' | 'blind_test' | 'suggest_track' | 'custom';

export interface AdminChallenge {
  id: string;
  stationId: string; // 'all' or specific station ID e.g. 'disco-funk'
  title: string;
  desc: string;
  type: ChallengeType;
  points: number;
  reward: string;
  total: number;
  progress: number;
  completed: boolean;
  createdAt: number;
}

export interface AdminPromotion {
  id: string;
  title: string;
  tag: string;
  type: 'Merchandising' | 'Billetterie' | 'Hardware Audio' | 'Partenariat' | 'Autre';
  desc: string;
  price: string;
  oldPrice?: string;
  codePromo?: string;
  linkUrl?: string;
  status: 'active' | 'draft';
  createdAt: number;
}

export interface AdminScheduleShow {
  id: string;
  stationId: string;
  period: 'morning' | 'day' | 'evening' | 'night';
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "12:00"
  title: string;
  host: string;
  genre: string;
  badge: string;
  description: string;
}

export interface AdminEvent {
  id: string;
  stationId: string;
  title: string;
  date: string;
  location: string;
  broadcast: string;
  type: string;
  desc: string;
  isLiveSoon: boolean;
  status: 'upcoming' | 'ongoing' | 'past';
  createdAt: number;
}

export interface AdminMessage {
  id: string;
  authorName: string;
  email?: string;
  stationId?: string;
  type: 'dedicace' | 'proposition_titre' | 'contact_general';
  message: string;
  createdAt: number;
  isRead: boolean;
  reply?: string;
}

// Initial Default Initial State (Empty Clean Slate ready for database sync)
const DEFAULT_CHALLENGES: AdminChallenge[] = [];
const DEFAULT_PROMOTIONS: AdminPromotion[] = [];
const DEFAULT_EVENTS: AdminEvent[] = [];
const DEFAULT_MESSAGES: AdminMessage[] = [];
const DEFAULT_USERS: SynapseUser[] = [];

// Storage Keys
const STORAGE_KEYS = {
  STATIONS: 'radio_synapse_admin_stations_v1',
  CHALLENGES: 'radio_synapse_admin_challenges_v1',
  PROMOTIONS: 'radio_synapse_admin_promotions_v1',
  SCHEDULES: 'radio_synapse_admin_schedules_v1',
  EVENTS: 'radio_synapse_admin_events_v1',
  MESSAGES: 'radio_synapse_admin_messages_v1',
  USERS: 'radio_synapse_admin_users_v1',
};

// Guard to prevent local administrative writes from triggering recursive realtime echo loops
let isLocalAdminWriteInProgress = false;

// Dedicated local cache setters (Used by fetchers/readers - NEVER writes back to PocketBase)
export function setLocalAdminStations(stations: StreamChannel[]): void {
  const uniqueMap = new Map<string, StreamChannel>();
  for (const s of stations) {
    const key = (s.streamUrl || s.name || s.id).toLowerCase().trim().replace(/\/+$/, '');
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, s);
    }
  }
  localStorage.setItem(STORAGE_KEYS.STATIONS, JSON.stringify(Array.from(uniqueMap.values())));
}

export function setLocalAdminSchedules(schedules: AdminScheduleShow[]): void {
  localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
}

export function setLocalAdminChallenges(challenges: AdminChallenge[]): void {
  localStorage.setItem(STORAGE_KEYS.CHALLENGES, JSON.stringify(challenges));
}

export function setLocalAdminPromotions(promotions: AdminPromotion[]): void {
  localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(promotions));
}

export function setLocalAdminEvents(events: AdminEvent[]): void {
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
}

export function setLocalAdminMessages(messages: AdminMessage[]): void {
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

export function setLocalAdminUsers(users: SynapseUser[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

// --- GETTERS ---
export function getAdminStations(): StreamChannel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // In-memory deduplication fallback
    const uniqueMap = new Map<string, StreamChannel>();
    for (const s of parsed) {
      const key = (s.streamUrl || s.name || s.id).toLowerCase().trim().replace(/\/+$/, '');
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, s);
      }
    }
    return Array.from(uniqueMap.values());
  } catch {
    return [];
  }
}

export function getActiveAdminStations(): StreamChannel[] {
  const all = getAdminStations();
  return all.filter((s) => s.enabled !== false);
}

export function saveAdminStations(stations: StreamChannel[]): void {
  // Deduplicate before saving
  const uniqueMap = new Map<string, StreamChannel>();
  for (const s of stations) {
    const key = (s.streamUrl || s.name || s.id).toLowerCase().trim().replace(/\/+$/, '');
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, s);
    }
  }
  const deduplicated = Array.from(uniqueMap.values());
  setLocalAdminStations(deduplicated);
  syncAdminStoreToPocketBase('stations', deduplicated).catch(() => {});
}

export function getAdminSchedules(): AdminScheduleShow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAdminSchedules(schedules: AdminScheduleShow[]): void {
  localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
  syncAdminStoreToPocketBase('schedules', schedules).catch(() => {});
}

export function getAdminChallenges(): AdminChallenge[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHALLENGES);
    if (!raw) return DEFAULT_CHALLENGES;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CHALLENGES;
  }
}

export function saveAdminChallenges(challenges: AdminChallenge[]): void {
  localStorage.setItem(STORAGE_KEYS.CHALLENGES, JSON.stringify(challenges));
  syncAdminStoreToPocketBase('challenges', challenges).catch(() => {});
}

export function getAdminPromotions(): AdminPromotion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROMOTIONS);
    if (!raw) return DEFAULT_PROMOTIONS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_PROMOTIONS;
  }
}

export function saveAdminPromotions(promotions: AdminPromotion[]): void {
  localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(promotions));
  syncAdminStoreToPocketBase('promotions', promotions).catch(() => {});
}

export function getAdminEvents(): AdminEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!raw) return DEFAULT_EVENTS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_EVENTS;
  }
}

export function saveAdminEvents(events: AdminEvent[]): void {
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  syncAdminStoreToPocketBase('events', events).catch(() => {});
}

export function getAdminMessages(): AdminMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!raw) return DEFAULT_MESSAGES;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MESSAGES;
  }
}

export function saveAdminMessages(messages: AdminMessage[]): void {
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  syncAdminStoreToPocketBase('messages', messages).catch(() => {});
}

export function getAdminUsers(): SynapseUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) return DEFAULT_USERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

export function saveAdminUsers(users: SynapseUser[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  syncAdminStoreToPocketBase('users', users).catch(() => {});
}

/**
 * Add a new user message sent by a listener
 */
export function addListenerMessage(
  authorName: string,
  email: string,
  message: string,
  type: 'dedicace' | 'proposition_titre' | 'contact_general' = 'dedicace',
  stationId?: string
): AdminMessage {
  const messages = getAdminMessages();
  const newMsg: AdminMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    authorName: authorName.trim() || 'Auditeur Anonyme',
    email: email.trim(),
    message: message.trim(),
    type,
    stationId,
    createdAt: Date.now(),
    isRead: false,
  };

  messages.unshift(newMsg);
  saveAdminMessages(messages);
  return newMsg;
}

/**
 * Deduplicate and purge redundant duplicate station rows in PocketBase
 */
export async function cleanupPocketBaseStationDuplicates(): Promise<{ removedCount: number; remainingCount: number }> {
  try {
    const allRows = await pb.collection('synapse_stations').getFullList({ requestKey: null as any }).catch(() => []);
    if (!allRows || allRows.length === 0) return { removedCount: 0, remainingCount: 0 };

    const seenMap = new Map<string, any>();
    const toDeleteIds: string[] = [];

    for (const row of allRows) {
      const urlKey = (row.url || row.stream_url || '').toLowerCase().trim().replace(/\/+$/, '');
      const nameKey = (row.name || '').toLowerCase().trim();
      const stationIdKey = (row.station_id || '').toLowerCase().trim();

      const key = urlKey || nameKey || stationIdKey || row.id;

      if (seenMap.has(key)) {
        toDeleteIds.push(row.id);
      } else {
        seenMap.set(key, row);
      }
    }

    let removedCount = 0;
    for (const id of toDeleteIds) {
      try {
        await pb.collection('synapse_stations').delete(id);
        removedCount++;
      } catch {}
    }

    return { removedCount, remainingCount: seenMap.size };
  } catch {
    return { removedCount: 0, remainingCount: 0 };
  }
}

/**
 * Helper to sync store item arrays to PocketBase Key-Value collection `synapse_admin_data` and specific collections
 */
export async function syncAdminStoreToPocketBase(key: string, data: any): Promise<void> {
  isLocalAdminWriteInProgress = true;
  try {
    // 1. Primary fast Key-Value store in PocketBase
    try {
      const existing = await pb.collection('synapse_admin_data').getFirstListItem(`key = "${key}"`).catch(() => null);
      if (existing) {
        await pb.collection('synapse_admin_data').update(existing.id, {
          key,
          payload: data,
        });
      } else {
        await pb.collection('synapse_admin_data').create({
          key,
          payload: data,
        });
      }
    } catch {}

    // 2. Also populate specific entity collections if they exist in PocketBase
    if (key === 'stations' && Array.isArray(data)) {
      try {
        // First deduplicate payload in memory
        const uniqueStationsMap = new Map<string, StreamChannel>();
        for (const s of data) {
          const k = (s.streamUrl || s.name || s.id).toLowerCase().trim().replace(/\/+$/, '');
          if (!uniqueStationsMap.has(k)) {
            uniqueStationsMap.set(k, s);
          }
        }
        const cleanStations = Array.from(uniqueStationsMap.values());

        // Fetch all existing rows currently in synapse_stations
        const existingRows = await pb.collection('synapse_stations').getFullList({ requestKey: null as any }).catch(() => []);
        const processedRowIds = new Set<string>();

        for (const s of cleanStations) {
          const payload = {
            station_id: s.id,
            name: s.name,
            genre: s.genre || 'Radio',
            url: s.streamUrl || '',
            color: s.color || '#00f2ff',
            secondary_color: s.secondaryColor || '#ff0055',
            description: s.description || '',
            station_number: s.stationNumber || '',
            enabled: s.enabled !== false,
          };

          // Find all rows matching this station
          const matchingRows = existingRows.filter((row: any) => {
            const matchesId = (row.station_id && row.station_id === s.id) || row.id === s.id;
            const matchesUrl = row.url && s.streamUrl && row.url.trim().toLowerCase().replace(/\/+$/, '') === s.streamUrl.trim().toLowerCase().replace(/\/+$/, '');
            const matchesName = row.name && s.name && row.name.trim().toLowerCase() === s.name.trim().toLowerCase();
            return Boolean(matchesId || matchesUrl || matchesName);
          });

          if (matchingRows.length > 0) {
            // Update the primary row
            const primary = matchingRows[0];
            processedRowIds.add(primary.id);
            await pb.collection('synapse_stations').update(primary.id, payload).catch(() => {});

            // CRITICAL: Delete any duplicate rows matching this station
            for (let i = 1; i < matchingRows.length; i++) {
              await pb.collection('synapse_stations').delete(matchingRows[i].id).catch(() => {});
            }
          } else {
            // Create exactly one row
            const created = await pb.collection('synapse_stations').create(payload).catch(() => null);
            if (created) {
              processedRowIds.add(created.id);
            }
          }
        }

        // Delete any orphaned rows from synapse_stations that are no longer in cleanStations (e.g. deleted stations)
        for (const row of existingRows) {
          if (!processedRowIds.has(row.id)) {
            const isMatchForAny = cleanStations.some((s) => {
              const matchesId = (row.station_id && row.station_id === s.id) || row.id === s.id;
              const matchesUrl = row.url && s.streamUrl && row.url.trim().toLowerCase().replace(/\/+$/, '') === s.streamUrl.trim().toLowerCase().replace(/\/+$/, '');
              const matchesName = row.name && s.name && row.name.trim().toLowerCase() === s.name.trim().toLowerCase();
              return Boolean(matchesId || matchesUrl || matchesName);
            });
            if (!isMatchForAny) {
              await pb.collection('synapse_stations').delete(row.id).catch(() => {});
            }
          }
        }
      } catch {}
    } else if (key === 'messages' && Array.isArray(data)) {
      for (const m of data) {
        try {
          const payload = {
            message_id: m.id,
            author_name: m.authorName || 'Auditeur',
            email: m.email || '',
            station_id: m.stationId || 'all',
            type: m.type || 'dedicace',
            message: m.message,
            is_read: m.isRead || false,
            reply: m.reply || '',
          };
          const existing = await pb.collection('synapse_messages').getFirstListItem(`message_id = "${m.id}"`).catch(() => null);
          if (existing) {
            await pb.collection('synapse_messages').update(existing.id, payload);
          } else {
            await pb.collection('synapse_messages').create(payload);
          }
        } catch {}
      }
    } else if (key === 'schedules' && Array.isArray(data)) {
      for (const sc of data) {
        try {
          const payload = {
            schedule_id: sc.id,
            station_id: sc.stationId || 'all',
            period: sc.period || 'morning',
            start_time: sc.startTime || '08:00',
            end_time: sc.endTime || '12:00',
            start_hour: parseInt((sc.startTime || '0').split(':')[0], 10) || 0,
            title: sc.title,
            host: sc.host,
            genre: sc.genre || '',
            badge: sc.badge || '',
            description: sc.description || '',
          };
          const existing = await pb.collection('synapse_schedules').getFirstListItem(`schedule_id = "${sc.id}"`).catch(() => null);
          if (existing) {
            await pb.collection('synapse_schedules').update(existing.id, payload);
          } else {
            await pb.collection('synapse_schedules').create(payload);
          }
        } catch {}
      }
    } else if (key === 'challenges' && Array.isArray(data)) {
      for (const c of data) {
        try {
          const payload = {
            challenge_id: c.id,
            station_id: c.stationId || 'all',
            title: c.title,
            description: c.desc || '',
            type: c.type || 'stats',
            points: c.points || 100,
            reward: c.reward || '',
            total: c.total || 1,
            progress: c.progress || 0,
            completed: c.completed || false,
          };
          const existing = await pb.collection('synapse_challenges').getFirstListItem(`challenge_id = "${c.id}"`).catch(() => null);
          if (existing) {
            await pb.collection('synapse_challenges').update(existing.id, payload);
          } else {
            await pb.collection('synapse_challenges').create(payload);
          }
        } catch {}
      }
    } else if (key === 'promotions' && Array.isArray(data)) {
      for (const p of data) {
        try {
          const payload = {
            promotion_id: p.id,
            title: p.title,
            tag: p.tag || '',
            type: p.type || 'Merchandising',
            description: p.desc || '',
            price: p.price,
            old_price: p.oldPrice || '',
            code_promo: p.codePromo || '',
            link_url: p.linkUrl || '',
            status: p.status || 'active',
          };
          const existing = await pb.collection('synapse_promotions').getFirstListItem(`promotion_id = "${p.id}"`).catch(() => null);
          if (existing) {
            await pb.collection('synapse_promotions').update(existing.id, payload);
          } else {
            await pb.collection('synapse_promotions').create(payload);
          }
        } catch {}
      }
    } else if (key === 'events' && Array.isArray(data)) {
      for (const e of data) {
        try {
          const payload = {
            event_id: e.id,
            station_id: e.stationId || 'all',
            title: e.title,
            date: e.date,
            location: e.location,
            broadcast: e.broadcast || '',
            type: e.type || 'Concert',
            description: e.desc || '',
            is_live_soon: e.isLiveSoon || false,
            status: e.status || 'upcoming',
          };
          const existing = await pb.collection('synapse_events').getFirstListItem(`event_id = "${e.id}"`).catch(() => null);
          if (existing) {
            await pb.collection('synapse_events').update(existing.id, payload);
          } else {
            await pb.collection('synapse_events').create(payload);
          }
        } catch {}
      }
    }
  } catch (err) {
    // Silent catch
  } finally {
    setTimeout(() => {
      isLocalAdminWriteInProgress = false;
    }, 1200);
  }
}

/**
 * Convert a PocketBase station record into a complete StreamChannel
 */
export function mapRecordToStreamChannel(r: any): StreamChannel {
  const stationId = r.station_id || r.id || `st-${Date.now()}`;
  const streamUrl = r.url || r.stream_url || r.streamUrl || '';
  const stationName = r.name || 'Station';
  const genre = r.genre || '';
  const coverUrl = r.cover_url || r.logo_url || r.artwork_url || '';

  return {
    id: stationId,
    name: stationName,
    genre: genre,
    streamUrl: streamUrl,
    color: r.color || '#00f2ff',
    secondaryColor: r.secondary_color || '#ff0055',
    description: r.description || '',
    stationNumber: r.station_number || '01',
    enabled: r.enabled !== false,
    coverUrl: coverUrl,
    tracks: Array.isArray(r.tracks) && r.tracks.length > 0 ? r.tracks : [
      {
        id: `${stationId}-live`,
        title: stationName,
        artist: genre || stationName,
        album: stationName,
        duration: 240,
        coverUrl: coverUrl,
        audioUrl: streamUrl,
      }
    ],
  };
}

let inFlightLoadPromise: Promise<boolean> | null = null;

/**
 * Fetch remote state from PocketBase on boot and update local cache
 */
export async function loadRemoteAdminData(): Promise<boolean> {
  if (inFlightLoadPromise) {
    return inFlightLoadPromise;
  }

  inFlightLoadPromise = (async () => {
    let hasLoadedStations = false;
    try {
      // 1. Direct fetch from dedicated synapse_stations collection
      try {
        const stationsRows = await pb.collection('synapse_stations').getFullList({ 
          sort: 'station_number',
          requestKey: null as any 
        });
        if (stationsRows && stationsRows.length > 0) {
          const uniqueStationsMap = new Map<string, StreamChannel>();
          for (const row of stationsRows) {
            const mapped = mapRecordToStreamChannel(row);
            // Key by clean streamUrl or clean station identifier to deduplicate
            const key = (mapped.streamUrl || mapped.id || mapped.name).toLowerCase().trim().replace(/\/+$/, '');
            if (!uniqueStationsMap.has(key)) {
              uniqueStationsMap.set(key, mapped);
            }
          }
          const mappedStations: StreamChannel[] = Array.from(uniqueStationsMap.values());
          setLocalAdminStations(mappedStations);
          hasLoadedStations = true;

          // If redundant duplicate rows exist in PocketBase (e.g. 1000 duplicated rows), auto-purge them!
          if (stationsRows.length > uniqueStationsMap.size) {
            cleanupPocketBaseStationDuplicates().catch(() => {});
          }
        }
      } catch {
        // Fallback gracefully
      }

      // 2. Fetch synapse_admin_data KV table
      try {
        const list = await pb.collection('synapse_admin_data').getFullList({ requestKey: null as any }).catch(() => []);
        if (list && list.length > 0) {
          list.forEach((row: any) => {
            if (row.key && row.payload) {
              if (row.key === 'stations' && !hasLoadedStations) {
                const rawList = Array.isArray(row.payload) ? row.payload : [];
                const uniqueStationsMap = new Map<string, StreamChannel>();
                for (const s of rawList) {
                  const mapped = mapRecordToStreamChannel(s);
                  const key = (mapped.streamUrl || mapped.id || mapped.name).toLowerCase().trim().replace(/\/+$/, '');
                  if (!uniqueStationsMap.has(key)) {
                    uniqueStationsMap.set(key, mapped);
                  }
                }
                const mapped = Array.from(uniqueStationsMap.values());
                if (mapped.length > 0) {
                  setLocalAdminStations(mapped);
                  hasLoadedStations = true;
                }
              }
              if (row.key === 'schedules') setLocalAdminSchedules(row.payload);
              if (row.key === 'challenges') setLocalAdminChallenges(row.payload);
              if (row.key === 'promotions') setLocalAdminPromotions(row.payload);
              if (row.key === 'events') setLocalAdminEvents(row.payload);
              if (row.key === 'messages') setLocalAdminMessages(row.payload);
              if (row.key === 'users') setLocalAdminUsers(row.payload);
            }
          });
        }
      } catch {}

      // 3. Fallbacks from dedicated collections if still empty
      try {
        const schedulesRows = await pb.collection('synapse_schedules').getFullList({ sort: 'start_hour', requestKey: null as any }).catch(() => []);
        if (schedulesRows && schedulesRows.length > 0) {
          const mappedSchedules: AdminScheduleShow[] = schedulesRows.map((r: any) => ({
            id: r.schedule_id || r.id,
            stationId: r.station_id,
            period: r.period,
            startTime: r.start_time,
            endTime: r.end_time,
            title: r.title,
            host: r.host,
            genre: r.genre || '',
            badge: r.badge || '',
            description: r.description || '',
          }));
          setLocalAdminSchedules(mappedSchedules);
        }
      } catch {}

      try {
        const messagesRows = await pb.collection('synapse_messages').getFullList({ sort: '-created', requestKey: null as any }).catch(() => []);
        if (messagesRows && messagesRows.length > 0) {
          const mappedMessages: AdminMessage[] = messagesRows.map((r: any) => ({
            id: r.message_id || r.id,
            authorName: r.author_name || 'Auditeur',
            email: r.email,
            stationId: r.station_id,
            type: r.type || 'dedicace',
            message: r.message,
            isRead: r.is_read || false,
            reply: r.reply,
            createdAt: new Date(r.created || Date.now()).getTime(),
          }));
          setLocalAdminMessages(mappedMessages);
        }
      } catch {}

      return true;
    } catch {
      return false;
    } finally {
      inFlightLoadPromise = null;
    }
  })();

  return inFlightLoadPromise;
}

/**
 * Direct asynchronous PocketBase table fetchers with error handling & cache fallback
 */
export async function fetchPocketBaseStations(): Promise<{ data: StreamChannel[]; error: string | null }> {
  try {
    const list = await pb.collection('synapse_stations').getFullList({ sort: 'station_number' });
    if (list && list.length > 0) {
      const uniqueStationsMap = new Map<string, StreamChannel>();
      for (const row of list) {
        const mapped = mapRecordToStreamChannel(row);
        const key = (mapped.streamUrl || mapped.id || mapped.name).toLowerCase().trim().replace(/\/+$/, '');
        if (!uniqueStationsMap.has(key)) {
          uniqueStationsMap.set(key, mapped);
        }
      }
      const stations: StreamChannel[] = Array.from(uniqueStationsMap.values());
      setLocalAdminStations(stations);

      // Clean up duplicates if found in PocketBase
      if (list.length > uniqueStationsMap.size) {
        cleanupPocketBaseStationDuplicates().catch(() => {});
      }

      return { data: stations, error: null };
    }

    // Try fallback from synapse_admin_data
    const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "stations"').catch(() => null);
    if (kv?.payload && Array.isArray(kv.payload)) {
      const uniqueStationsMap = new Map<string, StreamChannel>();
      for (const s of kv.payload) {
        const mapped = mapRecordToStreamChannel(s);
        const key = (mapped.streamUrl || mapped.id || mapped.name).toLowerCase().trim().replace(/\/+$/, '');
        if (!uniqueStationsMap.has(key)) {
          uniqueStationsMap.set(key, mapped);
        }
      }
      const mapped = Array.from(uniqueStationsMap.values());
      setLocalAdminStations(mapped);
      return { data: mapped, error: null };
    }

    return { data: getAdminStations(), error: null };
  } catch (err: any) {
    // Try KV store fallback
    try {
      const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "stations"').catch(() => null);
      if (kv?.payload && Array.isArray(kv.payload)) {
        const mapped = kv.payload.map(mapRecordToStreamChannel);
        setLocalAdminStations(mapped);
        return { data: mapped, error: null };
      }
    } catch {}
    return { data: getAdminStations(), error: err?.message || 'Erreur de connexion PocketBase' };
  }
}

export async function fetchPocketBaseChallenges(): Promise<{ data: AdminChallenge[]; error: string | null }> {
  try {
    const list = await pb.collection('synapse_challenges').getFullList({ sort: '-created' });
    if (list && list.length > 0) {
      const challenges: AdminChallenge[] = list.map((r: any) => ({
        id: r.challenge_id || r.id,
        stationId: r.station_id || 'all',
        title: r.title,
        desc: r.description || '',
        type: r.type || 'stats',
        points: r.points || 100,
        reward: r.reward || '',
        total: r.total || 1,
        progress: r.progress || 0,
        completed: r.completed || false,
        createdAt: new Date(r.created || Date.now()).getTime(),
      }));
      setLocalAdminChallenges(challenges);
      return { data: challenges, error: null };
    }

    const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "challenges"').catch(() => null);
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminChallenges(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminChallenges(), error: null };
  } catch (err: any) {
    try {
      const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "challenges"').catch(() => null);
      if (kv?.payload && Array.isArray(kv.payload)) {
        setLocalAdminChallenges(kv.payload);
        return { data: kv.payload, error: null };
      }
    } catch {}
    return { data: getAdminChallenges(), error: err?.message || 'Erreur de connexion PocketBase' };
  }
}

export async function fetchPocketBasePromotions(): Promise<{ data: AdminPromotion[]; error: string | null }> {
  try {
    const list = await pb.collection('synapse_promotions').getFullList({ sort: '-created' });
    if (list && list.length > 0) {
      const promotions: AdminPromotion[] = list.map((r: any) => ({
        id: r.promotion_id || r.id,
        title: r.title,
        tag: r.tag || '',
        type: r.type || 'Merchandising',
        desc: r.description || '',
        price: r.price,
        oldPrice: r.old_price || undefined,
        codePromo: r.code_promo || undefined,
        linkUrl: r.link_url || undefined,
        status: r.status || 'active',
        createdAt: new Date(r.created || Date.now()).getTime(),
      }));
      setLocalAdminPromotions(promotions);
      return { data: promotions, error: null };
    }

    const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "promotions"').catch(() => null);
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminPromotions(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminPromotions(), error: null };
  } catch (err: any) {
    try {
      const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "promotions"').catch(() => null);
      if (kv?.payload && Array.isArray(kv.payload)) {
        setLocalAdminPromotions(kv.payload);
        return { data: kv.payload, error: null };
      }
    } catch {}
    return { data: getAdminPromotions(), error: err?.message || 'Erreur de connexion PocketBase' };
  }
}

export async function fetchPocketBaseEvents(): Promise<{ data: AdminEvent[]; error: string | null }> {
  try {
    const list = await pb.collection('synapse_events').getFullList({ sort: '-created' });
    if (list && list.length > 0) {
      const events: AdminEvent[] = list.map((r: any) => ({
        id: r.event_id || r.id,
        stationId: r.station_id || 'all',
        title: r.title,
        date: r.date,
        location: r.location,
        broadcast: r.broadcast || '',
        type: r.type || 'Concert',
        desc: r.description || '',
        isLiveSoon: r.is_live_soon || false,
        status: r.status || 'upcoming',
        createdAt: new Date(r.created || Date.now()).getTime(),
      }));
      setLocalAdminEvents(events);
      return { data: events, error: null };
    }

    const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "events"').catch(() => null);
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminEvents(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminEvents(), error: null };
  } catch (err: any) {
    try {
      const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "events"').catch(() => null);
      if (kv?.payload && Array.isArray(kv.payload)) {
        setLocalAdminEvents(kv.payload);
        return { data: kv.payload, error: null };
      }
    } catch {}
    return { data: getAdminEvents(), error: err?.message || 'Erreur de connexion PocketBase' };
  }
}

export async function fetchPocketBaseSchedules(): Promise<{ data: AdminScheduleShow[]; error: string | null }> {
  try {
    const list = await pb.collection('synapse_schedules').getFullList({ sort: 'start_hour' });
    if (list && list.length > 0) {
      const schedules: AdminScheduleShow[] = list.map((r: any) => ({
        id: r.schedule_id || r.id,
        stationId: r.station_id,
        period: r.period,
        startTime: r.start_time,
        endTime: r.end_time,
        title: r.title,
        host: r.host,
        genre: r.genre || '',
        badge: r.badge || '',
        description: r.description || '',
      }));
      setLocalAdminSchedules(schedules);
      return { data: schedules, error: null };
    }

    const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "schedules"').catch(() => null);
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminSchedules(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminSchedules(), error: null };
  } catch (err: any) {
    try {
      const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "schedules"').catch(() => null);
      if (kv?.payload && Array.isArray(kv.payload)) {
        setLocalAdminSchedules(kv.payload);
        return { data: kv.payload, error: null };
      }
    } catch {}
    return { data: getAdminSchedules(), error: err?.message || 'Erreur de connexion PocketBase' };
  }
}

export async function fetchPocketBaseMessages(): Promise<{ data: AdminMessage[]; error: string | null }> {
  try {
    const list = await pb.collection('synapse_messages').getFullList({ sort: '-created' });
    if (list && list.length > 0) {
      const messages: AdminMessage[] = list.map((r: any) => ({
        id: r.message_id || r.id,
        authorName: r.author_name || 'Auditeur',
        email: r.email || undefined,
        stationId: r.station_id || 'all',
        type: r.type || 'dedicace',
        message: r.message,
        isRead: r.is_read || false,
        reply: r.reply || undefined,
        createdAt: new Date(r.created || Date.now()).getTime(),
      }));
      setLocalAdminMessages(messages);
      return { data: messages, error: null };
    }

    const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "messages"').catch(() => null);
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminMessages(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminMessages(), error: null };
  } catch (err: any) {
    try {
      const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "messages"').catch(() => null);
      if (kv?.payload && Array.isArray(kv.payload)) {
        setLocalAdminMessages(kv.payload);
        return { data: kv.payload, error: null };
      }
    } catch {}
    return { data: getAdminMessages(), error: err?.message || 'Erreur de connexion PocketBase' };
  }
}

export async function fetchPocketBaseUsers(): Promise<{ data: SynapseUser[]; error: string | null }> {
  try {
    // 1. Fetch both authentic auth users and profiles in parallel
    const [userRecords, profiles] = await Promise.all([
      pb.collection('users').getFullList({ sort: '-created' }).catch(() => []),
      pb.collection('profiles').getFullList({ sort: '-created' }).catch(() => []),
    ]);

    const mergedMap = new Map<string, SynapseUser>();

    // Process 'users' auth records first
    for (const r of (userRecords || [])) {
      const spoAcc = r.spotify_account || (r.spotify_url ? {
        provider: 'spotify',
        username: r.name || r.username,
        profileUrl: r.spotify_url,
        userId: r.spotify_id,
        connectedAt: Date.now(),
      } : null);

      const userObj: SynapseUser = {
        id: r.id,
        email: r.email || '',
        username: r.name || r.username || (r.email ? r.email.split('@')[0] : 'Membre Synapse'),
        role: (r.role === 'admin' ? 'admin' : 'user') as UserRole,
        avatarUrl: r.avatar ? pb.files.getUrl(r, r.avatar) : (r.avatar_url || undefined),
        createdAt: new Date(r.created || Date.now()).getTime(),
        spotifyAccount: spoAcc,
        isSpotifyLinked: !!spoAcc || !!r.is_spotify_linked,
      };

      mergedMap.set(r.id, userObj);
    }

    // Merge 'profiles' records and deduplicate
    for (const p of (profiles || [])) {
      const spoAcc = p.spotify_account || (p.spotify_url ? {
        provider: 'spotify',
        username: p.username,
        profileUrl: p.spotify_url,
        userId: p.spotify_id,
        connectedAt: Date.now(),
      } : null);

      // Search for existing matching user in map
      let matchedKey: string | null = null;
      for (const [k, u] of mergedMap.entries()) {
        const matchesId = p.user_id && (k === p.user_id || u.id === p.user_id);
        const matchesEmail = p.email && u.email && p.email.trim().toLowerCase() === u.email.trim().toLowerCase();
        const matchesSpotify = p.spotify_id && u.spotifyAccount?.userId === p.spotify_id;

        if (matchesId || matchesEmail || matchesSpotify) {
          matchedKey = k;
          break;
        }
      }

      if (matchedKey) {
        const existing = mergedMap.get(matchedKey)!;
        // Merge profile attributes; preserve admin role
        if (p.role === 'admin') existing.role = 'admin';
        if (p.avatar_url && !existing.avatarUrl) existing.avatarUrl = p.avatar_url;
        if (spoAcc && !existing.spotifyAccount) existing.spotifyAccount = spoAcc;
        if (p.is_spotify_linked) existing.isSpotifyLinked = true;
        if (p.username && (!existing.username || existing.username === 'Membre Synapse')) {
          existing.username = p.username;
        }
      } else {
        // Unique standalone profile
        const profUser: SynapseUser = {
          id: p.user_id || p.id,
          email: p.email || '',
          username: p.username || (p.email ? p.email.split('@')[0] : 'Membre Synapse'),
          role: (p.role === 'admin' ? 'admin' : 'user') as UserRole,
          avatarUrl: p.avatar_url || undefined,
          createdAt: new Date(p.created || Date.now()).getTime(),
          spotifyAccount: spoAcc,
          isSpotifyLinked: !!spoAcc || !!p.is_spotify_linked,
        };
        mergedMap.set(p.user_id || p.id, profUser);
      }
    }

    const mergedList = Array.from(mergedMap.values());
    if (mergedList.length > 0) {
      setLocalAdminUsers(mergedList);
      return { data: mergedList, error: null };
    }

    // 2. Fallback to KV store
    const kv = await pb.collection('synapse_admin_data').getFirstListItem('key = "users"').catch(() => null);
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminUsers(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminUsers(), error: null };
  } catch (err: any) {
    return { data: getAdminUsers(), error: err?.message || 'Erreur de connexion PocketBase' };
  }
}

/**
 * Force a complete bidirectional sync between local cache & PocketBase
 */
export async function syncAllDataWithPocketBase(): Promise<{ success: boolean; message: string }> {
  try {
    const stations = getAdminStations();
    const schedules = getAdminSchedules();
    const challenges = getAdminChallenges();
    const promotions = getAdminPromotions();
    const events = getAdminEvents();
    const messages = getAdminMessages();
    const users = getAdminUsers();

    await Promise.all([
      syncAdminStoreToPocketBase('stations', stations),
      syncAdminStoreToPocketBase('schedules', schedules),
      syncAdminStoreToPocketBase('challenges', challenges),
      syncAdminStoreToPocketBase('promotions', promotions),
      syncAdminStoreToPocketBase('events', events),
      syncAdminStoreToPocketBase('messages', messages),
      syncAdminStoreToPocketBase('users', users),
    ]);

    return { success: true, message: 'Synchronisation complète avec PocketBase réussie !' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erreur lors de la synchronisation PocketBase.' };
  }
}

/**
 * Realtime listener for live PocketBase changes
 */
export function subscribeToPocketBaseRealtime(onUpdate: () => void): () => void {
  try {
    const collections = [
      'synapse_admin_data',
      'synapse_stations',
      'synapse_schedules',
      'synapse_challenges',
      'synapse_promotions',
      'synapse_events',
      'synapse_messages',
    ];

    let debounceTimer: any = null;
    const triggerUpdate = () => {
      if (isLocalAdminWriteInProgress) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isLocalAdminWriteInProgress) return;
        loadRemoteAdminData().then(() => {
          onUpdate();
        });
      }, 500);
    };

    collections.forEach((col) => {
      pb.collection(col).subscribe('*', () => {
        triggerUpdate();
      }).catch(() => {});
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      collections.forEach((col) => {
        pb.collection(col).unsubscribe('*').catch(() => {});
      });
    };
  } catch {
    return () => {};
  }
}

// Backwards compatibility aliases
export const syncAllDataWithSupabase = syncAllDataWithPocketBase;
export const subscribeToSupabaseRealtime = subscribeToPocketBaseRealtime;
export const fetchSupabaseStations = fetchPocketBaseStations;
export const fetchSupabaseChallenges = fetchPocketBaseChallenges;
export const fetchSupabasePromotions = fetchPocketBasePromotions;
export const fetchSupabaseEvents = fetchPocketBaseEvents;
export const fetchSupabaseSchedules = fetchPocketBaseSchedules;
export const fetchSupabaseMessages = fetchPocketBaseMessages;
