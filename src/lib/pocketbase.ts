import PocketBase from 'pocketbase';

export const DEFAULT_POCKETBASE_URL = 'https://db.radiosynapse.fr';

/**
 * Resolve the PocketBase base URL with runtime environment variable fallback
 */
function getPocketbaseUrl(): string {
  try {
    const envUrl = import.meta.env?.VITE_POCKETBASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
      return envUrl.trim().replace(/\/+$/, '');
    }
  } catch {}
  return DEFAULT_POCKETBASE_URL;
}

export const POCKETBASE_URL = getPocketbaseUrl();

/**
 * PocketBase Singleton Client
 */
export const pb = new PocketBase(POCKETBASE_URL);

// Disable auto-cancellation globally to allow batched or concurrent background queries
pb.autoCancellation(false);

export const POCKETBASE_CONFIG = {
  url: POCKETBASE_URL,
};

/**
 * Health check / Connection test for PocketBase instance
 */
export async function testPocketBaseConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const health = await pb.health.check();
    if (health && (health.code === 200 || health.code === 0)) {
      return { ok: true, message: 'Connexion PocketBase active et opérationnelle (200 OK)' };
    }
    return { ok: true, message: 'Connexion PocketBase active' };
  } catch (err: any) {
    // If /api/health is restricted, test querying public collections
    try {
      await pb.collection('synapse_admin_data').getList(1, 1);
      return { ok: true, message: 'Connexion PocketBase active et opérationnelle' };
    } catch (innerErr: any) {
      if (innerErr?.status === 404) {
        return { ok: true, message: 'Connecté à PocketBase (Collections prêtes à être importées)' };
      }
      return { ok: false, message: err?.message || innerErr?.message || 'Impossible de joindre le serveur PocketBase' };
    }
  }
}

/**
 * SQLite SQL Schema for PocketBase underlying database (Documentation & Reference)
 */
export const POCKETBASE_SQLITE_SCHEMA_SQL = `-- =========================================================================
-- RADIO SYNAPSE - STRUCTURE SQLITE POCKETBASE (DOCUMENTATION & REFERENCE)
-- =========================================================================

-- 1. Table synapse_admin_data (Magasin Clé-Valeur Global)
CREATE TABLE IF NOT EXISTS synapse_admin_data (
    id TEXT PRIMARY KEY NOT NULL,
    key TEXT NOT NULL,
    payload JSON DEFAULT '{}',
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pb_synapse_admin_data_key ON synapse_admin_data (key);

-- 2. Table synapse_stations (Web Radios & Flux)
CREATE TABLE IF NOT EXISTS synapse_stations (
    id TEXT PRIMARY KEY NOT NULL,
    station_id TEXT,
    name TEXT NOT NULL,
    genre TEXT DEFAULT 'Radio',
    url TEXT NOT NULL,
    color TEXT DEFAULT '#00f2ff',
    secondary_color TEXT DEFAULT '#ff0055',
    station_number TEXT DEFAULT '01',
    description TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pb_synapse_stations_enabled ON synapse_stations (enabled, station_number);

-- 3. Table synapse_schedules (Grille des programmes)
CREATE TABLE IF NOT EXISTS synapse_schedules (
    id TEXT PRIMARY KEY NOT NULL,
    schedule_id TEXT,
    station_id TEXT NOT NULL,
    title TEXT NOT NULL,
    host TEXT NOT NULL,
    genre TEXT DEFAULT '',
    period TEXT NOT NULL DEFAULT 'day', -- 'morning', 'day', 'evening', 'night'
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    start_hour INTEGER DEFAULT 0,
    badge TEXT DEFAULT 'Émission',
    description TEXT DEFAULT '',
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pb_synapse_schedules_station ON synapse_schedules (station_id, period);

-- 4. Table synapse_challenges (Défis d'écoute)
CREATE TABLE IF NOT EXISTS synapse_challenges (
    id TEXT PRIMARY KEY NOT NULL,
    challenge_id TEXT,
    station_id TEXT DEFAULT 'all',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT DEFAULT 'stats', -- 'stats', 'blind_test', 'suggest_track', 'custom'
    points INTEGER DEFAULT 100,
    reward TEXT DEFAULT '',
    total INTEGER DEFAULT 1,
    progress INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pb_synapse_challenges_completed ON synapse_challenges (completed, points);

-- 5. Table synapse_promotions (Offres et Codes Promo)
CREATE TABLE IF NOT EXISTS synapse_promotions (
    id TEXT PRIMARY KEY NOT NULL,
    promotion_id TEXT,
    title TEXT NOT NULL,
    tag TEXT DEFAULT '',
    type TEXT DEFAULT 'Merchandising',
    description TEXT DEFAULT '',
    price TEXT DEFAULT '0 €',
    old_price TEXT,
    code_promo TEXT,
    link_url TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'draft'
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pb_synapse_promotions_status ON synapse_promotions (status);

-- 6. Table synapse_events (Évènements & Directs)
CREATE TABLE IF NOT EXISTS synapse_events (
    id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT,
    station_id TEXT DEFAULT 'all',
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    broadcast TEXT DEFAULT '',
    type TEXT DEFAULT 'Concert',
    description TEXT DEFAULT '',
    is_live_soon INTEGER DEFAULT 0,
    status TEXT DEFAULT 'upcoming', -- 'upcoming', 'ongoing', 'past'
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pb_synapse_events_status ON synapse_events (status, is_live_soon);

-- 7. Table synapse_messages (Dédicaces et contact)
CREATE TABLE IF NOT EXISTS synapse_messages (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT,
    author_name TEXT NOT NULL,
    email TEXT,
    station_id TEXT DEFAULT 'all',
    type TEXT DEFAULT 'dedicace', -- 'dedicace', 'proposition_titre', 'contact_general'
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    reply TEXT,
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pb_synapse_messages_read ON synapse_messages (is_read, created);

-- 8. Table synapse_user_likes (Titres likés)
CREATE TABLE IF NOT EXISTS synapse_user_likes (
    id TEXT PRIMARY KEY NOT NULL,
    like_id TEXT,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    cover_url TEXT,
    station_name TEXT,
    level INTEGER DEFAULT 1,
    preview_url TEXT,
    spotify_url TEXT,
    deezer_url TEXT,
    apple_music_url TEXT,
    youtube_url TEXT,
    liked_at INTEGER,
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_pb_synapse_user_likes_user ON synapse_user_likes (user_id, liked_at);

-- 9. Table user_synapse_data (Synchronisation Profils & Données Cloud)
CREATE TABLE IF NOT EXISTS user_synapse_data (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT,
    username TEXT,
    liked_tracks JSON DEFAULT '[]',
    favorite_stations JSON DEFAULT '[]',
    profile_data JSON DEFAULT '{}',
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pb_user_synapse_data_user ON user_synapse_data (user_id);

-- 10. Table profiles (Profils Utilisateurs)
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT,
    username TEXT,
    role TEXT DEFAULT 'user', -- 'user', 'admin'
    avatar_url TEXT,
    spotify_url TEXT,
    spotify_id TEXT,
    spotify_account JSON,
    is_spotify_linked INTEGER DEFAULT 0,
    created TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now')),
    updated TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pb_profiles_user_id ON profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_pb_profiles_email ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_pb_profiles_spotify_id ON profiles (spotify_id);
`;
