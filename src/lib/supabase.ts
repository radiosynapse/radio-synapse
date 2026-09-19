import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://db.radiosynapse.fr';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM0MTI4MDB9.CRXP1A7WOeoJeXxjNni_nUf7AdBf4WvY1iNekfE1w08';

/**
 * Resolve Supabase URL from environment variables or default to the VPS Kong Gateway
 */
function getSupabaseUrl(): string {
  try {
    const envUrl = import.meta.env?.VITE_SUPABASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().startsWith('http')) {
      return envUrl.trim().replace(/\/+$/, '');
    }
  } catch {}
  return DEFAULT_SUPABASE_URL;
}

/**
 * Resolve Supabase Anon Key from environment variables
 */
function getSupabaseAnonKey(): string {
  try {
    const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 10) {
      return envKey.trim();
    }
  } catch {}
  return DEFAULT_SUPABASE_ANON_KEY;
}

export const SUPABASE_URL = getSupabaseUrl();
export const SUPABASE_ANON_KEY = getSupabaseAnonKey();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'radio_synapse_supabase_auth_token',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};

/**
 * Health check & Real-time connection test for the Supabase instance
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string; details?: any }> {
  try {
    // 1. Try simple auth health or public select
    const { data: _data, error } = await supabase.from('synapse_stations').select('id').limit(1);
    
    if (error) {
      // If table doesn't exist yet, it means connected to PostgREST but schema not imported
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return { 
          ok: true, 
          message: 'Connecté à Supabase PostgREST (Schéma SQL à exécuter dans le SQL Editor)',
          details: error 
        };
      }
      return { 
        ok: false, 
        message: `Erreur Supabase : ${error.message}`,
        details: error 
      };
    }

    return { 
      ok: true, 
      message: 'Connexion Supabase active et fonctionnelle (PostgreSQL + Realtime OK)' 
    };
  } catch (err: any) {
    return { 
      ok: false, 
      message: err?.message || 'Impossible de joindre le serveur Supabase Kong / PostgREST' 
    };
  }
}

export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- RADIO SYNAPSE - SCHEMA POSTGRESQL COMPLET POUR SUPABASE
-- À exécuter dans le 'SQL Editor' de votre tableau de bord Supabase (db.radiosynapse.fr)
-- =========================================================================

-- 1. Table des profils utilisateurs étendus (reliée à auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  username TEXT,
  display_name TEXT,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  points INTEGER DEFAULT 100,
  badges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table clé-valeur d'administration et configuration globale
CREATE TABLE IF NOT EXISTS public.synapse_admin_data (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table des stations et flux radio
CREATE TABLE IF NOT EXISTS public.synapse_stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  genre TEXT DEFAULT 'Radio',
  url TEXT NOT NULL,
  color TEXT DEFAULT '#00f2ff',
  secondary_color TEXT DEFAULT '#ff0055',
  description TEXT DEFAULT '',
  station_number TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table de la grille des programmes et émissions
CREATE TABLE IF NOT EXISTS public.synapse_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id TEXT UNIQUE NOT NULL,
  station_id TEXT DEFAULT 'all',
  period TEXT DEFAULT 'morning',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  host TEXT NOT NULL,
  genre TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table des messages et dédicaces en direct
CREATE TABLE IF NOT EXISTS public.synapse_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  author_name TEXT DEFAULT 'Auditeur',
  email TEXT DEFAULT '',
  station_id TEXT DEFAULT 'all',
  type TEXT DEFAULT 'dedicace',
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  reply TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table des défis interactifs
CREATE TABLE IF NOT EXISTS public.synapse_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id TEXT UNIQUE NOT NULL,
  station_id TEXT DEFAULT 'all',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'stats',
  points INTEGER DEFAULT 100,
  reward TEXT DEFAULT '',
  total INTEGER DEFAULT 1,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  criteria JSONB,
  required_shares INTEGER,
  required_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Table des promotions et boutique
CREATE TABLE IF NOT EXISTS public.synapse_promotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  tag TEXT DEFAULT '',
  type TEXT DEFAULT 'Merchandising',
  description TEXT DEFAULT '',
  price TEXT NOT NULL,
  old_price TEXT DEFAULT '',
  code_promo TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  points_cost INTEGER DEFAULT 0,
  initial_stock INTEGER,
  remaining_stock INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Table des événements et concerts
CREATE TABLE IF NOT EXISTS public.synapse_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  station_id TEXT DEFAULT 'all',
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  broadcast TEXT DEFAULT '',
  type TEXT DEFAULT 'Concert',
  description TEXT DEFAULT '',
  is_live_soon BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Table des propositions de morceaux par les auditeurs
CREATE TABLE IF NOT EXISTS public.synapse_track_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  username TEXT NOT NULL,
  user_avatar TEXT,
  challenge_id TEXT,
  station_id TEXT,
  track_title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  year TEXT,
  emotion TEXT,
  preview_url TEXT,
  cover_url TEXT,
  external_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Table des dossiers de la bibliothèque musicale
CREATE TABLE IF NOT EXISTS public.synapse_music_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'Folder',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Table des fichiers audio et morceaux de la bibliothèque
CREATE TABLE IF NOT EXISTS public.synapse_music_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id TEXT UNIQUE NOT NULL,
  folder_id TEXT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT DEFAULT '',
  year INTEGER,
  genre TEXT DEFAULT '',
  bpm INTEGER,
  duration INTEGER DEFAULT 0,
  file_url TEXT NOT NULL,
  cover_url TEXT DEFAULT '',
  bitrate TEXT DEFAULT '320 kbps',
  file_size TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Table des playlists (et flux de secours)
CREATE TABLE IF NOT EXISTS public.synapse_playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8b5cf6',
  description TEXT DEFAULT '',
  station_id TEXT DEFAULT 'all',
  is_fallback BOOLEAN DEFAULT false,
  fallback_rules JSONB DEFAULT '{}'::jsonb,
  tracks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Table des requêtes interactives du studio d'animation
CREATE TABLE IF NOT EXISTS public.synapse_studio_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  multiple_choices BOOLEAN DEFAULT false,
  custom_label_yes TEXT DEFAULT 'OUI',
  custom_label_no TEXT DEFAULT 'NON',
  time_limit_seconds INTEGER DEFAULT 60,
  timer_ends_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  rules JSONB DEFAULT '{}'::jsonb,
  station_id TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Table des réponses auditeurs aux requêtes studio
CREATE TABLE IF NOT EXISTS public.synapse_studio_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id TEXT UNIQUE NOT NULL,
  request_id TEXT NOT NULL,
  user_id TEXT,
  user_name TEXT DEFAULT 'Auditeur',
  user_avatar TEXT DEFAULT '',
  response_type TEXT NOT NULL,
  text_content TEXT DEFAULT '',
  selected_options JSONB DEFAULT '[]'::jsonb,
  track_suggestion JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Table des drops audio, jingles et liners
CREATE TABLE IF NOT EXISTS public.synapse_audio_drops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drop_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'jingle',
  duration INTEGER DEFAULT 0,
  audio_url TEXT NOT NULL,
  color TEXT DEFAULT '#10b981',
  hotkey TEXT,
  station_id TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Table des fiches de préparation d'émissions
CREATE TABLE IF NOT EXISTS public.synapse_emissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  emission_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  presenter TEXT NOT NULL,
  day_of_week TEXT DEFAULT 'Lundi',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  station_id TEXT DEFAULT 'all',
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activer les publications Realtime sur toutes les tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_admin_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_stations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_promotions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_track_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_music_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_music_tracks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_playlists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_studio_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_studio_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_audio_drops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.synapse_emissions;

-- Activer Row Level Security (RLS) avec règles permissives publiques pour l'application
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_admin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_track_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_music_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_studio_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_studio_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_audio_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synapse_emissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public write profiles" ON public.profiles FOR ALL USING (true);

CREATE POLICY "Public read admin data" ON public.synapse_admin_data FOR SELECT USING (true);
CREATE POLICY "Public write admin data" ON public.synapse_admin_data FOR ALL USING (true);

CREATE POLICY "Public read stations" ON public.synapse_stations FOR SELECT USING (true);
CREATE POLICY "Public write stations" ON public.synapse_stations FOR ALL USING (true);

CREATE POLICY "Public read schedules" ON public.synapse_schedules FOR SELECT USING (true);
CREATE POLICY "Public write schedules" ON public.synapse_schedules FOR ALL USING (true);

CREATE POLICY "Public read messages" ON public.synapse_messages FOR SELECT USING (true);
CREATE POLICY "Public write messages" ON public.synapse_messages FOR ALL USING (true);

CREATE POLICY "Public read challenges" ON public.synapse_challenges FOR SELECT USING (true);
CREATE POLICY "Public write challenges" ON public.synapse_challenges FOR ALL USING (true);

CREATE POLICY "Public read promotions" ON public.synapse_promotions FOR SELECT USING (true);
CREATE POLICY "Public write promotions" ON public.synapse_promotions FOR ALL USING (true);

CREATE POLICY "Public read events" ON public.synapse_events FOR SELECT USING (true);
CREATE POLICY "Public write events" ON public.synapse_events FOR ALL USING (true);

CREATE POLICY "Public read submissions" ON public.synapse_track_submissions FOR SELECT USING (true);
CREATE POLICY "Public write submissions" ON public.synapse_track_submissions FOR ALL USING (true);

CREATE POLICY "Public read music folders" ON public.synapse_music_folders FOR SELECT USING (true);
CREATE POLICY "Public write music folders" ON public.synapse_music_folders FOR ALL USING (true);

CREATE POLICY "Public read music tracks" ON public.synapse_music_tracks FOR SELECT USING (true);
CREATE POLICY "Public write music tracks" ON public.synapse_music_tracks FOR ALL USING (true);

CREATE POLICY "Public read playlists" ON public.synapse_playlists FOR SELECT USING (true);
CREATE POLICY "Public write playlists" ON public.synapse_playlists FOR ALL USING (true);

CREATE POLICY "Public read studio requests" ON public.synapse_studio_requests FOR SELECT USING (true);
CREATE POLICY "Public write studio requests" ON public.synapse_studio_requests FOR ALL USING (true);

CREATE POLICY "Public read studio responses" ON public.synapse_studio_responses FOR SELECT USING (true);
CREATE POLICY "Public write studio responses" ON public.synapse_studio_responses FOR ALL USING (true);

CREATE POLICY "Public read audio drops" ON public.synapse_audio_drops FOR SELECT USING (true);
CREATE POLICY "Public write audio drops" ON public.synapse_audio_drops FOR ALL USING (true);

CREATE POLICY "Public read emissions" ON public.synapse_emissions FOR SELECT USING (true);
CREATE POLICY "Public write emissions" ON public.synapse_emissions FOR ALL USING (true);
`;

