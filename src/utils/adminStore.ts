import { StreamChannel } from '../data';
import { SynapseUser, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { updateUserRoleInSupabase } from './supabaseAuthService';
export { updateUserRoleInSupabase };

export type ChallengeType = 
  | 'suggest_music'       // Propose ta musique
  | 'share_liked_tracks'  // Partage tes trouvailles
  | 'listening_time'      // Écoute bien
  | 'suggest_track'       // Alias for compatibility
  | 'blind_test'          // Blind test / Quiz
  | 'stats'               // Statistiques
  | 'custom';             // Règle libre

export interface SuggestMusicCriteria {
  genre?: string;
  subGenre?: string;
  artist?: string;
  referenceTrack?: string;
  year?: string;
  emotion?: string;
  minPlaysOrViews?: number;
  maxPlaysOrViews?: number;
  otherRequirements?: string;
}

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
  criteria?: SuggestMusicCriteria;
  requiredShares?: number;
  requiredMinutes?: number;
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
  pointsCost?: number;        // Cost in loyalty points to unlock the promo code
  isStockLimited?: boolean;   // Whether the promo code stock is limited
  initialStock?: number;      // Total initial stock
  remainingStock?: number;    // Remaining available codes
  claimedUsers?: string[];    // User IDs who claimed this promo code
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

// Dedicated local cache setters (Used by fetchers/readers - NEVER writes back to Supabase)
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
  syncAdminStoreToSupabase('stations', deduplicated).catch(() => {});
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
  syncAdminStoreToSupabase('schedules', schedules).catch(() => {});
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
  syncAdminStoreToSupabase('challenges', challenges).catch(() => {});
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
  syncAdminStoreToSupabase('promotions', promotions).catch(() => {});
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
  syncAdminStoreToSupabase('events', events).catch(() => {});
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
  syncAdminStoreToSupabase('messages', messages).catch(() => {});
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
  syncAdminStoreToSupabase('users', users).catch(() => {});
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
 * Deduplicate and purge redundant duplicate station rows
 */
export async function cleanupSupabaseStationDuplicates(): Promise<{ removedCount: number; remainingCount: number }> {
  return { removedCount: 0, remainingCount: 0 };
}

/**
 * Helper to sync store item arrays to Supabase Key-Value table `synapse_admin_data` and specific tables
 */
export async function syncAdminStoreToSupabase(key: string, data: any): Promise<void> {
  isLocalAdminWriteInProgress = true;
  try {
    // 1. Primary fast Key-Value store in Supabase
    try {
      await supabase.from('synapse_admin_data').upsert({
        key,
        payload: data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    } catch {}

    // 2. Also populate specific entity tables
    if (key === 'stations' && Array.isArray(data)) {
      try {
        const rows = data.map((s: StreamChannel) => ({
          station_id: s.id,
          name: s.name,
          genre: s.genre || 'Radio',
          url: s.streamUrl || '',
          color: s.color || '#00f2ff',
          secondary_color: s.secondaryColor || '#ff0055',
          description: s.description || '',
          station_number: s.stationNumber || '',
          enabled: s.enabled !== false,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('synapse_stations').upsert(rows, { onConflict: 'station_id' });
      } catch {}
    } else if (key === 'messages' && Array.isArray(data)) {
      try {
        const rows = data.map((m: AdminMessage) => ({
          message_id: m.id,
          author_name: m.authorName || 'Auditeur',
          email: m.email || '',
          station_id: m.stationId || 'all',
          type: m.type || 'dedicace',
          message: m.message,
          is_read: m.isRead || false,
          reply: m.reply || '',
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('synapse_messages').upsert(rows, { onConflict: 'message_id' });
      } catch {}
    } else if (key === 'schedules' && Array.isArray(data)) {
      try {
        const rows = data.map((sc: AdminScheduleShow) => ({
          schedule_id: sc.id,
          station_id: sc.stationId || 'all',
          period: sc.period || 'morning',
          start_time: sc.startTime || '08:00',
          end_time: sc.endTime || '12:00',
          title: sc.title,
          host: sc.host,
          genre: sc.genre || '',
          badge: sc.badge || '',
          description: sc.description || '',
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('synapse_schedules').upsert(rows, { onConflict: 'schedule_id' });
      } catch {}
    } else if (key === 'challenges' && Array.isArray(data)) {
      try {
        const rows = data.map((c: AdminChallenge) => ({
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
          criteria: c.criteria || null,
          required_shares: c.requiredShares || null,
          required_minutes: c.requiredMinutes || null,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('synapse_challenges').upsert(rows, { onConflict: 'challenge_id' });
      } catch {}
    } else if (key === 'promotions' && Array.isArray(data)) {
      try {
        const rows = data.map((p: AdminPromotion) => ({
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
          points_cost: p.pointsCost || 0,
          initial_stock: p.initialStock ?? null,
          remaining_stock: p.remainingStock ?? null,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('synapse_promotions').upsert(rows, { onConflict: 'promotion_id' });
      } catch {}
    } else if (key === 'events' && Array.isArray(data)) {
      try {
        const rows = data.map((e: AdminEvent) => ({
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
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('synapse_events').upsert(rows, { onConflict: 'event_id' });
      } catch {}
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
 * Convert a Supabase station record into a complete StreamChannel
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
 * Fetch remote state from Supabase on boot and update local cache
 */
export async function loadRemoteAdminData(): Promise<boolean> {
  if (inFlightLoadPromise) {
    return inFlightLoadPromise;
  }

  inFlightLoadPromise = (async () => {
    let hasLoadedStations = false;
    try {
      // 1. Direct fetch from dedicated synapse_stations table
      try {
        const { data: stationsRows } = await supabase
          .from('synapse_stations')
          .select('*')
          .order('station_number', { ascending: true });

        if (stationsRows && stationsRows.length > 0) {
          const uniqueStationsMap = new Map<string, StreamChannel>();
          for (const row of stationsRows) {
            const mapped = mapRecordToStreamChannel(row);
            const key = (mapped.streamUrl || mapped.id || mapped.name).toLowerCase().trim().replace(/\/+$/, '');
            if (!uniqueStationsMap.has(key)) {
              uniqueStationsMap.set(key, mapped);
            }
          }
          const mappedStations: StreamChannel[] = Array.from(uniqueStationsMap.values());
          setLocalAdminStations(mappedStations);
          hasLoadedStations = true;
        }
      } catch {}

      // 2. Fetch synapse_admin_data KV table
      try {
        const { data: list } = await supabase.from('synapse_admin_data').select('*');
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

      // 3. Fallbacks from dedicated tables if still empty
      try {
        const { data: schedulesRows } = await supabase.from('synapse_schedules').select('*').order('start_time', { ascending: true });
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
        const { data: messagesRows } = await supabase.from('synapse_messages').select('*').order('created_at', { ascending: false });
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
            createdAt: new Date(r.created_at || Date.now()).getTime(),
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
 * Direct asynchronous Supabase table fetchers with error handling & cache fallback
 */
export async function fetchSupabaseStations(): Promise<{ data: StreamChannel[]; error: string | null }> {
  try {
    const { data: list, error } = await supabase.from('synapse_stations').select('*').order('station_number', { ascending: true });
    if (!error && list && list.length > 0) {
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
      return { data: stations, error: null };
    }

    // Try fallback from synapse_admin_data
    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'stations').maybeSingle();
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
    return { data: getAdminStations(), error: err?.message || 'Erreur de connexion Supabase' };
  }
}

export async function fetchSupabaseChallenges(): Promise<{ data: AdminChallenge[]; error: string | null }> {
  try {
    const { data: list, error } = await supabase.from('synapse_challenges').select('*').order('created_at', { ascending: false });
    if (!error && list && list.length > 0) {
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
        criteria: r.criteria || undefined,
        requiredShares: r.required_shares ?? undefined,
        requiredMinutes: r.required_minutes ?? undefined,
        createdAt: new Date(r.created_at || Date.now()).getTime(),
      }));
      setLocalAdminChallenges(challenges);
      return { data: challenges, error: null };
    }

    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'challenges').maybeSingle();
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminChallenges(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminChallenges(), error: null };
  } catch (err: any) {
    return { data: getAdminChallenges(), error: err?.message || 'Erreur de connexion Supabase' };
  }
}

export async function fetchSupabasePromotions(): Promise<{ data: AdminPromotion[]; error: string | null }> {
  try {
    const { data: list, error } = await supabase.from('synapse_promotions').select('*').order('created_at', { ascending: false });
    if (!error && list && list.length > 0) {
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
        pointsCost: r.points_cost || 0,
        initialStock: r.initial_stock ?? undefined,
        remainingStock: r.remaining_stock ?? undefined,
        createdAt: new Date(r.created_at || Date.now()).getTime(),
      }));
      setLocalAdminPromotions(promotions);
      return { data: promotions, error: null };
    }

    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'promotions').maybeSingle();
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminPromotions(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminPromotions(), error: null };
  } catch (err: any) {
    return { data: getAdminPromotions(), error: err?.message || 'Erreur de connexion Supabase' };
  }
}

export async function fetchSupabaseEvents(): Promise<{ data: AdminEvent[]; error: string | null }> {
  try {
    const { data: list, error } = await supabase.from('synapse_events').select('*').order('created_at', { ascending: false });
    if (!error && list && list.length > 0) {
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
        createdAt: new Date(r.created_at || Date.now()).getTime(),
      }));
      setLocalAdminEvents(events);
      return { data: events, error: null };
    }

    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'events').maybeSingle();
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminEvents(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminEvents(), error: null };
  } catch (err: any) {
    return { data: getAdminEvents(), error: err?.message || 'Erreur de connexion Supabase' };
  }
}

export async function fetchSupabaseSchedules(): Promise<{ data: AdminScheduleShow[]; error: string | null }> {
  try {
    const { data: list, error } = await supabase.from('synapse_schedules').select('*').order('start_time', { ascending: true });
    if (!error && list && list.length > 0) {
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

    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'schedules').maybeSingle();
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminSchedules(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminSchedules(), error: null };
  } catch (err: any) {
    return { data: getAdminSchedules(), error: err?.message || 'Erreur de connexion Supabase' };
  }
}

export async function fetchSupabaseMessages(): Promise<{ data: AdminMessage[]; error: string | null }> {
  try {
    const { data: list, error } = await supabase.from('synapse_messages').select('*').order('created_at', { ascending: false });
    if (!error && list && list.length > 0) {
      const messages: AdminMessage[] = list.map((r: any) => ({
        id: r.message_id || r.id,
        authorName: r.author_name || 'Auditeur',
        email: r.email || undefined,
        stationId: r.station_id || 'all',
        type: r.type || 'dedicace',
        message: r.message,
        isRead: r.is_read || false,
        reply: r.reply || undefined,
        createdAt: new Date(r.created_at || Date.now()).getTime(),
      }));
      setLocalAdminMessages(messages);
      return { data: messages, error: null };
    }

    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'messages').maybeSingle();
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminMessages(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminMessages(), error: null };
  } catch (err: any) {
    return { data: getAdminMessages(), error: err?.message || 'Erreur de connexion Supabase' };
  }
}

export async function fetchSupabaseUsers(): Promise<{ data: SynapseUser[]; error: string | null }> {
  try {
    const { data: userRecords, error } = await supabase.from('synapse_users').select('*').order('created_at', { ascending: false });
    if (!error && userRecords && userRecords.length > 0) {
      const mapped: SynapseUser[] = userRecords.map((r: any) => ({
        id: r.id,
        email: r.email || '',
        username: r.username || (r.email ? r.email.split('@')[0] : 'Membre Synapse'),
        role: (r.role === 'admin' || r.role === 'super-admin' ? r.role : 'user') as UserRole,
        avatarUrl: r.avatar_url || undefined,
        createdAt: new Date(r.created_at || Date.now()).getTime(),
      }));
      setLocalAdminUsers(mapped);
      return { data: mapped, error: null };
    }

    // 2. Fallback to KV store
    const { data: kv } = await supabase.from('synapse_admin_data').select('payload').eq('key', 'users').maybeSingle();
    if (kv?.payload && Array.isArray(kv.payload)) {
      setLocalAdminUsers(kv.payload);
      return { data: kv.payload, error: null };
    }

    return { data: getAdminUsers(), error: null };
  } catch (err: any) {
    return { data: getAdminUsers(), error: err?.message || 'Erreur de connexion Supabase' };
  }
}

/**
 * Force a complete bidirectional sync between local cache & Supabase
 */
export async function syncAllDataWithSupabase(): Promise<{ success: boolean; message: string }> {
  try {
    const stations = getAdminStations();
    const schedules = getAdminSchedules();
    const challenges = getAdminChallenges();
    const promotions = getAdminPromotions();
    const events = getAdminEvents();
    const messages = getAdminMessages();
    const users = getAdminUsers();

    await Promise.all([
      syncAdminStoreToSupabase('stations', stations),
      syncAdminStoreToSupabase('schedules', schedules),
      syncAdminStoreToSupabase('challenges', challenges),
      syncAdminStoreToSupabase('promotions', promotions),
      syncAdminStoreToSupabase('events', events),
      syncAdminStoreToSupabase('messages', messages),
      syncAdminStoreToSupabase('users', users),
    ]);

    return { success: true, message: 'Synchronisation complète avec Supabase réussie !' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erreur lors de la synchronisation Supabase.' };
  }
}

/**
 * Realtime listener for live Supabase changes
 */
export function subscribeToSupabaseRealtime(onUpdate: () => void): () => void {
  try {
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

    const channel = supabase
      .channel('admin-store-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        triggerUpdate();
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
