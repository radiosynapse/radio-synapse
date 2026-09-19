-- =========================================================================
-- RADIO SYNAPSE - SCHEMA COMPLET SUPABASE / POSTGRESQL (TEMPS RÉEL & RLS)
-- Compatible avec Supabase Self-Hosted (Kong, GoTrue, PostgREST, Realtime)
-- À coller et exécuter dans l'onglet "SQL Editor" de votre tableau de bord Supabase
-- =========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE PROFILES (EXTENSIONS DU COMPTE UTILISATEUR AUTH.USERS)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super-admin')),
  admin_profile_id TEXT DEFAULT 'profile_animateur',
  assigned_station_id TEXT DEFAULT 'all',
  avatar_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  badges JSONB DEFAULT '[]'::jsonb,
  custom_permissions JSONB DEFAULT '[]'::jsonb,
  
  -- Harbor Live / DJ Streamer credentials
  dj_username TEXT,
  dj_password TEXT,
  dj_display_name TEXT,
  dj_station TEXT DEFAULT 'synapse-main',
  dj_linked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABLE STATIONS (STATIONS RADIO SYNAPSE & FLUX LIQUIDSOAP / ICECAST)
CREATE TABLE IF NOT EXISTS public.stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  station_number TEXT,
  short_code TEXT,
  genre TEXT NOT NULL,
  description TEXT,
  tagline TEXT,
  color TEXT DEFAULT '#00f2ff',
  stream_url TEXT NOT NULL,
  fallback_mount TEXT DEFAULT '/fallback.mp3',
  liquidsoap_mount TEXT NOT NULL,
  liquidsoap_format TEXT DEFAULT 'mp3',
  liquidsoap_bitrate INTEGER DEFAULT 320,
  liquidsoap_samplerate INTEGER DEFAULT 44100,
  liquidsoap_channels INTEGER DEFAULT 2,
  is_encoding_active BOOLEAN NOT NULL DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  current_listeners INTEGER NOT NULL DEFAULT 0,
  peak_listeners INTEGER NOT NULL DEFAULT 0,
  logo_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE CHALLENGES (DÉFIS & QUÊTES AUDITEURS)
CREATE TABLE IF NOT EXISTS public.challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('suggest_music', 'share_social', 'live_quiz', 'listen_streak', 'community_vote')),
  station_id TEXT NOT NULL DEFAULT 'all',
  points INTEGER NOT NULL DEFAULT 150,
  reward TEXT,
  badge TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_constant BOOLEAN NOT NULL DEFAULT FALSE,
  criteria JSONB DEFAULT '{}'::jsonb,
  completed_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABLE TRACK SUBMISSIONS (PROPOSITIONS DE MUSIQUE PAR LES AUDITEURS)
CREATE TABLE IF NOT EXISTS public.track_submissions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT REFERENCES public.challenges(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  station_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  genre TEXT,
  music_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'added_to_playlist')),
  review_notes TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABLE PROMOTIONS (RÉDUCTIONS & CODES PROMOS PARTENAIRES)
CREATE TABLE IF NOT EXISTS public.promotions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tag TEXT NOT NULL,
  description TEXT NOT NULL,
  price TEXT NOT NULL,
  old_price TEXT,
  promo_code TEXT NOT NULL,
  points_cost INTEGER NOT NULL DEFAULT 150,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  is_stock_limited BOOLEAN NOT NULL DEFAULT FALSE,
  initial_stock INTEGER NOT NULL DEFAULT 25,
  current_stock INTEGER NOT NULL DEFAULT 25,
  unlocked_by JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TABLE EVENTS (ÉVÉNEMENTS & ÉMISSIONS EN DIRECT)
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  broadcast TEXT NOT NULL,
  description TEXT NOT NULL,
  station_id TEXT DEFAULT 'all',
  is_live_soon BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. TABLE MESSAGES (CHAT EN DIRECT, DÉDICACES & NOTIFICATIONS)
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  user_role TEXT DEFAULT 'user',
  station_id TEXT NOT NULL DEFAULT 'all',
  content TEXT NOT NULL,
  is_announcement BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TABLE SITE_FEATURE_FLAGS (ACTIVATION / DÉSACTIVATION DYNAMIQUE DES MODULES)
CREATE TABLE IF NOT EXISTS public.site_feature_flags (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. TABLE ADMIN_CUSTOMIZATIONS (PERSONNALISATION DU DASHBOARD & DE LA SIDEBAR)
CREATE TABLE IF NOT EXISTS public.admin_customizations (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. TABLE LIQUIDSOAP_CONFIG (CONFIGURATION DU SERVEUR VPS LIQUIDSOAP & ICECAST)
CREATE TABLE IF NOT EXISTS public.liquidsoap_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  vps_host TEXT NOT NULL DEFAULT '127.0.0.1',
  telnet_port INTEGER NOT NULL DEFAULT 8572,
  telnet_password TEXT DEFAULT 'synapse_telnet_pwd',
  http_api_port INTEGER NOT NULL DEFAULT 8080,
  harbor_live_port INTEGER NOT NULL DEFAULT 8005,
  harbor_mount TEXT NOT NULL DEFAULT '/live',
  harbor_password TEXT DEFAULT 'synapse_dj_live_pass',
  icecast_host TEXT NOT NULL DEFAULT '127.0.0.1',
  icecast_port INTEGER NOT NULL DEFAULT 8000,
  icecast_source_password TEXT DEFAULT 'synapse_icecast_source',
  icecast_admin_user TEXT DEFAULT 'admin',
  icecast_admin_password TEXT DEFAULT 'synapse_icecast_admin',
  music_storage_path TEXT DEFAULT '/var/media/synapse/music',
  logs_path TEXT DEFAULT '/var/log/liquidsoap/radio.log',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- TRIGGER AUTOMATIQUE DE CRÉATION DE PROFIL LORS DE L'INSCRIPTION AUTH.USERS
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_email TEXT;
  user_role TEXT := 'user';
  admin_prof TEXT := 'profile_animateur';
BEGIN
  clean_email := lower(trim(new.email));
  
  -- Définition automatique des super-administrateurs par défaut
  IF clean_email = 'adminradiosynapse@gmail.com' OR clean_email = 'admin@radiosynapse.fr' THEN
    user_role := 'super-admin';
    admin_prof := 'profile_super_admin';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    username,
    display_name,
    role,
    admin_profile_id,
    avatar_url,
    points,
    level,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    clean_email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(clean_email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(clean_email, '@', 1)),
    user_role,
    admin_prof,
    new.raw_user_meta_data->>'avatar_url',
    100,
    1,
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déclencheur sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidsoap_config ENABLE ROW LEVEL SECURITY;

-- Helper pour vérifier si l'utilisateur est admin ou super-admin
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profils : Lecture publique, modification de son propre profil ou par un admin
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin_or_superadmin());
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- 2. Stations : Lecture publique, modification par admin
CREATE POLICY "Stations are viewable by everyone" ON public.stations FOR SELECT USING (true);
CREATE POLICY "Admins can insert stations" ON public.stations FOR INSERT WITH CHECK (public.is_admin_or_superadmin() OR auth.role() = 'anon');
CREATE POLICY "Admins can update stations" ON public.stations FOR UPDATE USING (public.is_admin_or_superadmin() OR auth.role() = 'anon');
CREATE POLICY "Admins can delete stations" ON public.stations FOR DELETE USING (public.is_admin_or_superadmin() OR auth.role() = 'anon');

-- 3. Défis : Lecture publique, gestion par admin
CREATE POLICY "Challenges viewable by everyone" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Challenges manage by admin" ON public.challenges FOR ALL USING (public.is_admin_or_superadmin() OR auth.role() = 'anon');

-- 4. Submissions : Lecture publique, insertion par utilisateur authentifié, modération admin
CREATE POLICY "Submissions viewable by everyone" ON public.track_submissions FOR SELECT USING (true);
CREATE POLICY "Users can submit tracks" ON public.track_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can moderate submissions" ON public.track_submissions FOR ALL USING (public.is_admin_or_superadmin() OR auth.role() = 'anon');

-- 5. Promotions : Lecture publique, gestion par admin
CREATE POLICY "Promotions viewable by everyone" ON public.promotions FOR SELECT USING (true);
CREATE POLICY "Promotions manage by admin" ON public.promotions FOR ALL USING (public.is_admin_or_superadmin() OR auth.role() = 'anon');

-- 6. Events : Lecture publique, gestion par admin
CREATE POLICY "Events viewable by everyone" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events manage by admin" ON public.events FOR ALL USING (public.is_admin_or_superadmin() OR auth.role() = 'anon');

-- 7. Messages : Lecture publique, envoi par tous, modération admin
CREATE POLICY "Messages viewable by everyone" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can delete messages" ON public.messages FOR DELETE USING (public.is_admin_or_superadmin() OR auth.role() = 'anon');

-- 8. Feature Flags & Customizations & Liquidsoap
CREATE POLICY "Flags viewable by everyone" ON public.site_feature_flags FOR SELECT USING (true);
CREATE POLICY "Flags manage by admin" ON public.site_feature_flags FOR ALL USING (true);

CREATE POLICY "Customizations viewable by everyone" ON public.admin_customizations FOR SELECT USING (true);
CREATE POLICY "Customizations manage by admin" ON public.admin_customizations FOR ALL USING (true);

CREATE POLICY "Liquidsoap config viewable by everyone" ON public.liquidsoap_config FOR SELECT USING (true);
CREATE POLICY "Liquidsoap config manage by admin" ON public.liquidsoap_config FOR ALL USING (true);

-- =========================================================================
-- ACTIVATION DU TEMPS RÉEL SUR TOUTES LES TABLES (SUPABASE REALTIME)
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.track_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_feature_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_customizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.liquidsoap_config;

-- =========================================================================
-- JEU DE DONNÉES INITIAL (SEED DATA)
-- =========================================================================

-- Stations Radio Synapse
INSERT INTO public.stations (
  id, name, station_number, short_code, genre, description, tagline, color, 
  stream_url, liquidsoap_mount, liquidsoap_format, liquidsoap_bitrate, is_encoding_active, enabled, display_order
) VALUES 
(
  'synapse-main',
  'Radio Synapse HD',
  '01',
  'SYNAPSE-HD',
  'Électro, Synthwave, Chill & Pop',
  'Le flux principal haute définition de Radio Synapse.',
  'Le flux haute fidélité Master 320k',
  '#00f2ff',
  'https://db.radiosynapse.fr:8000/synapse_hd.mp3',
  '/synapse_hd.mp3',
  'mp3',
  320,
  TRUE,
  TRUE,
  1
),
(
  'synapse-club',
  'Synapse Club & DJ Sets',
  '02',
  'SYNAPSE-CLUB',
  'House, Techno & Mix Live',
  'La station clubbing non-stop avec sets live exclusifs.',
  'Clubbing & Résidences DJ',
  '#ff007f',
  'https://db.radiosynapse.fr:8000/synapse_club.mp3',
  '/synapse_club.mp3',
  'mp3',
  320,
  TRUE,
  TRUE,
  2
),
(
  'synapse-ambient',
  'Synapse Deep & Ambient',
  '03',
  'SYNAPSE-AMBIENT',
  'Chillout, Downtempo & Lo-Fi',
  'Atmosphères relaxantes, méditatives et paysages sonores électroniques.',
  'Immersion sonore & détente',
  '#7928ca',
  'https://db.radiosynapse.fr:8000/synapse_ambient.mp3',
  '/synapse_ambient.mp3',
  'mp3',
  256,
  TRUE,
  TRUE,
  3
),
(
  'synapse-underground',
  'Synapse Underground & Bass',
  '04',
  'SYNAPSE-BASS',
  'Drum & Bass, Dubstep, Bass Music',
  'Sélection explosive et underground pour les amateurs de grosses basses.',
  'Bass music & Underground vibes',
  '#ff9900',
  'https://db.radiosynapse.fr:8000/synapse_bass.mp3',
  '/synapse_bass.mp3',
  'mp3',
  320,
  TRUE,
  TRUE,
  4
)
ON CONFLICT (id) DO NOTHING;

-- Configuration globale Liquidsoap
INSERT INTO public.liquidsoap_config (
  id, vps_host, telnet_port, telnet_password, http_api_port, 
  harbor_live_port, harbor_mount, harbor_password, 
  icecast_host, icecast_port, icecast_source_password, icecast_admin_user, icecast_admin_password
) VALUES (
  'global', '127.0.0.1', 8572, 'synapse_telnet_pwd', 8080,
  8005, '/live', 'synapse_dj_live_pass',
  '127.0.0.1', 8000, 'synapse_icecast_source', 'admin', 'synapse_icecast_admin'
) ON CONFLICT (id) DO NOTHING;
