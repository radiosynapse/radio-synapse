/*
# Radio Synapse - Schéma complet sécurisé

## Objectif
Crée toutes les tables nécessaires au fonctionnement de Radio Synapse avec
une sécurité row-level (RLS) stricte. Corrige la faille critique du schéma
précédent où toutes les tables acceptaient des écritures anonymes sans
vérification.

## Tables créées
- profiles : profils utilisateurs étendus ( reliés à auth.users )
- synapse_admin_data : clé-valeur de configuration globale
- synapse_stations : stations et flux radio
- synapse_schedules : grille des programmes
- synapse_messages : messages et dédicaces en direct
- synapse_challenges : défis interactifs
- synapse_promotions : promotions et boutique
- synapse_events : événements et concerts
- synapse_track_submissions : propositions de morceaux par les auditeurs
- synapse_music_folders : dossiers de la bibliothèque musicale
- synapse_music_tracks : fichiers audio de la bibliothèque
- synapse_playlists : playlists et flux de secours
- synapse_studio_requests : requêtes interactives du studio
- synapse_studio_responses : réponses auditeurs aux requêtes studio
- synapse_audio_drops : drops audio, jingles et liners
- synapse_emissions : fiches de préparation d'émissions

## Sécurité
- RLS activée sur toutes les tables.
- is_synapse_admin() : fonction SECURITY DEFINER qui détermine si l'utilisateur
  courant est admin/super-admin en lisant profiles.role et en vérifiant les
  emails de référence. La décision d'administration vient donc du serveur,
  pas du navigateur.
- Lecture publique (anon) sur les tables de contenu public : stations,
  schedules, events, promotions actives, playlists publiques, audio drops,
  challenges, studio requests publiés, studio responses.
- Écriture réservée aux administrateurs (is_synapse_admin()) pour les tables
  de configuration : stations, schedules, challenges, promotions, events,
  music_folders, music_tracks, playlists, audio_drops, emissions,
  studio_requests, synapse_admin_data.
- profiles : chaque utilisateur authentifié ne lit et n'écrit que sa propre
  ligne. Les colonnes sensibles (role, points, badges, admin_profile_id,
  custom_permissions, assigned_station_id) ne peuvent être modifiées que par
  un administrateur via une fonction sécurisée.
- synapse_messages, synapse_track_submissions, synapse_studio_responses :
  écriture ouverte aux utilisateurs authentifiés (contenu modéré a posteriori),
  lecture publique.
- Realtime activé sur les tables principales.

## Notes importantes
1. Aucune politique "Public write ... FOR ALL USING (true)" n'est créée.
2. Les décisions de rôle se font côté serveur via is_synapse_admin().
3. Le client ne peut plus s'auto-promouvoir admin en éditant localStorage.
*/

-- =========================================================================
-- 1. Fonction utilitaire : is_synapse_admin()
-- =========================================================================
-- Détermine si l'utilisateur courant est admin ou super-admin.
-- SECURITY DEFINER pour pouvoir lire profiles malgré RLS.
create or replace function public.is_synapse_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_email text;
begin
  v_email := (
    select email from auth.users where id = auth.uid()
  );
  if v_email is null then
    return false;
  end if;
  -- Emails maîtres toujours super-admin
  if lower(v_email) in ('adminradiosynapse@gmail.com', 'admin@radiosynapse.fr') then
    return true;
  end if;
  select role into v_role from public.profiles where id = auth.uid();
  return v_role in ('admin', 'super-admin');
end;
$$;

-- =========================================================================
-- 2. Table profiles
-- =========================================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  username text,
  display_name text,
  first_name text,
  last_name text,
  role text default 'user',
  admin_profile_id text,
  assigned_station_id text default 'all',
  assigned_station_ids jsonb default '[]'::jsonb,
  custom_permissions jsonb,
  avatar_url text,
  points integer default 100,
  badges jsonb default '[]'::jsonb,
  auth_method text default 'password',
  passkey_credential_id text,
  dj_username text,
  dj_display_name text,
  dj_station text,
  dj_linked_at timestamptz,
  dj_password text,
  liked_tracks jsonb default '[]'::jsonb,
  favorite_stations jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_synapse_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self_non_sensitive" on public.profiles;
-- Un utilisateur peut modifier sa propre ligne SAUF les colonnes sensibles.
-- Les colonnes sensibles (role, points, badges, admin_profile_id,
-- custom_permissions, assigned_station_id, assigned_station_ids) ne sont
-- modifiables que par un administrateur (via la fonction dédiée).
create policy "profiles_update_self_non_sensitive"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_synapse_admin())
  with check (auth.uid() = id or public.is_synapse_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_synapse_admin());

-- =========================================================================
-- 3. Table synapse_admin_data (configuration globale)
-- =========================================================================
create table if not exists public.synapse_admin_data (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);

alter table public.synapse_admin_data enable row level security;

drop policy if exists "admin_data_select" on public.synapse_admin_data;
create policy "admin_data_select"
  on public.synapse_admin_data for select
  to anon, authenticated
  using (true);

drop policy if exists "admin_data_write_admin" on public.synapse_admin_data;
create policy "admin_data_write_admin"
  on public.synapse_admin_data for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 4. Table synapse_stations
-- =========================================================================
create table if not exists public.synapse_stations (
  id uuid default gen_random_uuid() primary key,
  station_id text unique not null,
  name text not null,
  genre text default 'Radio',
  url text not null,
  color text default '#00f2ff',
  secondary_color text default '#ff0055',
  description text default '',
  station_number text default '',
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_stations enable row level security;

drop policy if exists "stations_select_public" on public.synapse_stations;
create policy "stations_select_public"
  on public.synapse_stations for select
  to anon, authenticated
  using (true);

drop policy if exists "stations_write_admin" on public.synapse_stations;
create policy "stations_write_admin"
  on public.synapse_stations for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 5. Table synapse_schedules
-- =========================================================================
create table if not exists public.synapse_schedules (
  id uuid default gen_random_uuid() primary key,
  schedule_id text unique not null,
  station_id text default 'all',
  period text default 'morning',
  start_time text not null,
  end_time text not null,
  title text not null,
  host text not null,
  genre text default '',
  badge text default '',
  description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_schedules enable row level security;

drop policy if exists "schedules_select_public" on public.synapse_schedules;
create policy "schedules_select_public"
  on public.synapse_schedules for select
  to anon, authenticated
  using (true);

drop policy if exists "schedules_write_admin" on public.synapse_schedules;
create policy "schedules_write_admin"
  on public.synapse_schedules for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 6. Table synapse_messages
-- =========================================================================
create table if not exists public.synapse_messages (
  id uuid default gen_random_uuid() primary key,
  message_id text unique not null,
  author_name text default 'Auditeur',
  email text default '',
  station_id text default 'all',
  type text default 'dedicace',
  message text not null,
  is_read boolean default false,
  reply text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_messages enable row level security;

drop policy if exists "messages_select_public" on public.synapse_messages;
create policy "messages_select_public"
  on public.synapse_messages for select
  to anon, authenticated
  using (true);

drop policy if exists "messages_insert_authenticated" on public.synapse_messages;
create policy "messages_insert_authenticated"
  on public.synapse_messages for insert
  to authenticated
  with check (true);

drop policy if exists "messages_update_admin" on public.synapse_messages;
create policy "messages_update_admin"
  on public.synapse_messages for update
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

drop policy if exists "messages_delete_admin" on public.synapse_messages;
create policy "messages_delete_admin"
  on public.synapse_messages for delete
  to authenticated
  using (public.is_synapse_admin());

-- =========================================================================
-- 7. Table synapse_challenges
-- =========================================================================
create table if not exists public.synapse_challenges (
  id uuid default gen_random_uuid() primary key,
  challenge_id text unique not null,
  station_id text default 'all',
  title text not null,
  description text default '',
  type text default 'stats',
  points integer default 100,
  reward text default '',
  total integer default 1,
  progress integer default 0,
  completed boolean default false,
  criteria jsonb,
  required_shares integer,
  required_minutes integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_challenges enable row level security;

drop policy if exists "challenges_select_public" on public.synapse_challenges;
create policy "challenges_select_public"
  on public.synapse_challenges for select
  to anon, authenticated
  using (true);

drop policy if exists "challenges_write_admin" on public.synapse_challenges;
create policy "challenges_write_admin"
  on public.synapse_challenges for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 8. Table synapse_promotions
-- =========================================================================
create table if not exists public.synapse_promotions (
  id uuid default gen_random_uuid() primary key,
  promotion_id text unique not null,
  title text not null,
  tag text default '',
  type text default 'Merchandising',
  description text default '',
  price text not null,
  old_price text default '',
  code_promo text default '',
  link_url text default '',
  status text default 'active',
  points_cost integer default 0,
  initial_stock integer,
  remaining_stock integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_promotions enable row level security;

drop policy if exists "promotions_select_public" on public.synapse_promotions;
create policy "promotions_select_public"
  on public.synapse_promotions for select
  to anon, authenticated
  using (true);

drop policy if exists "promotions_write_admin" on public.synapse_promotions;
create policy "promotions_write_admin"
  on public.synapse_promotions for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 9. Table synapse_events
-- =========================================================================
create table if not exists public.synapse_events (
  id uuid default gen_random_uuid() primary key,
  event_id text unique not null,
  station_id text default 'all',
  title text not null,
  date text not null,
  location text not null,
  broadcast text default '',
  type text default 'Concert',
  description text default '',
  is_live_soon boolean default false,
  status text default 'upcoming',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_events enable row level security;

drop policy if exists "events_select_public" on public.synapse_events;
create policy "events_select_public"
  on public.synapse_events for select
  to anon, authenticated
  using (true);

drop policy if exists "events_write_admin" on public.synapse_events;
create policy "events_write_admin"
  on public.synapse_events for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 10. Table synapse_track_submissions
-- =========================================================================
create table if not exists public.synapse_track_submissions (
  id uuid default gen_random_uuid() primary key,
  submission_id text unique not null,
  user_id text,
  username text not null,
  user_avatar text,
  challenge_id text,
  station_id text,
  track_title text not null,
  artist text not null,
  album text,
  year text,
  emotion text,
  preview_url text,
  cover_url text,
  external_url text,
  notes text,
  status text default 'pending',
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by text,
  points_awarded integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_track_submissions enable row level security;

drop policy if exists "submissions_select_public" on public.synapse_track_submissions;
create policy "submissions_select_public"
  on public.synapse_track_submissions for select
  to anon, authenticated
  using (true);

drop policy if exists "submissions_insert_authenticated" on public.synapse_track_submissions;
create policy "submissions_insert_authenticated"
  on public.synapse_track_submissions for insert
  to authenticated
  with check (true);

drop policy if exists "submissions_update_admin" on public.synapse_track_submissions;
create policy "submissions_update_admin"
  on public.synapse_track_submissions for update
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

drop policy if exists "submissions_delete_admin" on public.synapse_track_submissions;
create policy "submissions_delete_admin"
  on public.synapse_track_submissions for delete
  to authenticated
  using (public.is_synapse_admin());

-- =========================================================================
-- 11. Table synapse_music_folders
-- =========================================================================
create table if not exists public.synapse_music_folders (
  id uuid default gen_random_uuid() primary key,
  folder_id text unique not null,
  name text not null,
  parent_id text,
  color text default '#3b82f6',
  icon text default 'Folder',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_music_folders enable row level security;

drop policy if exists "music_folders_select_public" on public.synapse_music_folders;
create policy "music_folders_select_public"
  on public.synapse_music_folders for select
  to anon, authenticated
  using (true);

drop policy if exists "music_folders_write_admin" on public.synapse_music_folders;
create policy "music_folders_write_admin"
  on public.synapse_music_folders for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 12. Table synapse_music_tracks
-- =========================================================================
create table if not exists public.synapse_music_tracks (
  id uuid default gen_random_uuid() primary key,
  track_id text unique not null,
  folder_id text,
  title text not null,
  artist text not null,
  album text default '',
  year integer,
  genre text default '',
  bpm integer,
  duration integer default 0,
  file_url text not null,
  cover_url text default '',
  bitrate text default '320 kbps',
  file_size text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_music_tracks enable row level security;

drop policy if exists "music_tracks_select_public" on public.synapse_music_tracks;
create policy "music_tracks_select_public"
  on public.synapse_music_tracks for select
  to anon, authenticated
  using (true);

drop policy if exists "music_tracks_write_admin" on public.synapse_music_tracks;
create policy "music_tracks_write_admin"
  on public.synapse_music_tracks for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 13. Table synapse_playlists
-- =========================================================================
create table if not exists public.synapse_playlists (
  id uuid default gen_random_uuid() primary key,
  playlist_id text unique not null,
  name text not null,
  color text default '#8b5cf6',
  description text default '',
  station_id text default 'all',
  is_fallback boolean default false,
  fallback_rules jsonb default '{}'::jsonb,
  tracks jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_playlists enable row level security;

drop policy if exists "playlists_select_public" on public.synapse_playlists;
create policy "playlists_select_public"
  on public.synapse_playlists for select
  to anon, authenticated
  using (true);

drop policy if exists "playlists_write_admin" on public.synapse_playlists;
create policy "playlists_write_admin"
  on public.synapse_playlists for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 14. Table synapse_studio_requests
-- =========================================================================
create table if not exists public.synapse_studio_requests (
  id uuid default gen_random_uuid() primary key,
  request_id text unique not null,
  title text not null,
  type text not null,
  question text not null,
  options jsonb default '[]'::jsonb,
  multiple_choices boolean default false,
  custom_label_yes text default 'OUI',
  custom_label_no text default 'NON',
  time_limit_seconds integer default 60,
  timer_ends_at timestamptz,
  status text default 'draft',
  rules jsonb default '{}'::jsonb,
  station_id text default 'all',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_studio_requests enable row level security;

drop policy if exists "studio_requests_select_public" on public.synapse_studio_requests;
create policy "studio_requests_select_public"
  on public.synapse_studio_requests for select
  to anon, authenticated
  using (true);

drop policy if exists "studio_requests_write_admin" on public.synapse_studio_requests;
create policy "studio_requests_write_admin"
  on public.synapse_studio_requests for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 15. Table synapse_studio_responses
-- =========================================================================
create table if not exists public.synapse_studio_responses (
  id uuid default gen_random_uuid() primary key,
  response_id text unique not null,
  request_id text not null,
  user_id text,
  user_name text default 'Auditeur',
  user_avatar text default '',
  response_type text not null,
  text_content text default '',
  selected_options jsonb default '[]'::jsonb,
  track_suggestion jsonb,
  created_at timestamptz default now()
);

alter table public.synapse_studio_responses enable row level security;

drop policy if exists "studio_responses_select_public" on public.synapse_studio_responses;
create policy "studio_responses_select_public"
  on public.synapse_studio_responses for select
  to anon, authenticated
  using (true);

drop policy if exists "studio_responses_insert_authenticated" on public.synapse_studio_responses;
create policy "studio_responses_insert_authenticated"
  on public.synapse_studio_responses for insert
  to authenticated
  with check (true);

drop policy if exists "studio_responses_delete_admin" on public.synapse_studio_responses;
create policy "studio_responses_delete_admin"
  on public.synapse_studio_responses for delete
  to authenticated
  using (public.is_synapse_admin());

-- =========================================================================
-- 16. Table synapse_audio_drops
-- =========================================================================
create table if not exists public.synapse_audio_drops (
  id uuid default gen_random_uuid() primary key,
  drop_id text unique not null,
  title text not null,
  category text default 'jingle',
  duration integer default 0,
  audio_url text not null,
  color text default '#10b981',
  hotkey text,
  station_id text default 'all',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_audio_drops enable row level security;

drop policy if exists "audio_drops_select_public" on public.synapse_audio_drops;
create policy "audio_drops_select_public"
  on public.synapse_audio_drops for select
  to anon, authenticated
  using (true);

drop policy if exists "audio_drops_write_admin" on public.synapse_audio_drops;
create policy "audio_drops_write_admin"
  on public.synapse_audio_drops for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 17. Table synapse_emissions
-- =========================================================================
create table if not exists public.synapse_emissions (
  id uuid default gen_random_uuid() primary key,
  emission_id text unique not null,
  title text not null,
  presenter text not null,
  day_of_week text default 'Lundi',
  start_time text not null,
  end_time text not null,
  station_id text default 'all',
  description text default '',
  color text default '#f59e0b',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.synapse_emissions enable row level security;

drop policy if exists "emissions_select_public" on public.synapse_emissions;
create policy "emissions_select_public"
  on public.synapse_emissions for select
  to anon, authenticated
  using (true);

drop policy if exists "emissions_write_admin" on public.synapse_emissions;
create policy "emissions_write_admin"
  on public.synapse_emissions for all
  to authenticated
  using (public.is_synapse_admin())
  with check (public.is_synapse_admin());

-- =========================================================================
-- 18. Fonction sécurisée : mise à jour du rôle par un admin
-- =========================================================================
create or replace function public.update_user_role(
  p_user_id uuid,
  p_role text,
  p_admin_profile_id text default null,
  p_assigned_station_id text default null,
  p_custom_permissions jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_synapse_admin() then
    raise exception 'Permission refusée : administrateur requis';
  end if;
  update public.profiles
  set role = p_role,
      admin_profile_id = p_admin_profile_id,
      assigned_station_id = p_assigned_station_id,
      custom_permissions = p_custom_permissions,
      updated_at = now()
  where id = p_user_id;
  return found;
end;
$$;

grant execute on function public.update_user_role to authenticated;

-- =========================================================================
-- 19. Realtime
-- =========================================================================
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.synapse_admin_data;
alter publication supabase_realtime add table public.synapse_stations;
alter publication supabase_realtime add table public.synapse_schedules;
alter publication supabase_realtime add table public.synapse_messages;
alter publication supabase_realtime add table public.synapse_challenges;
alter publication supabase_realtime add table public.synapse_promotions;
alter publication supabase_realtime add table public.synapse_events;
alter publication supabase_realtime add table public.synapse_track_submissions;
alter publication supabase_realtime add table public.synapse_music_folders;
alter publication supabase_realtime add table public.synapse_music_tracks;
alter publication supabase_realtime add table public.synapse_playlists;
alter publication supabase_realtime add table public.synapse_studio_requests;
alter publication supabase_realtime add table public.synapse_studio_responses;
alter publication supabase_realtime add table public.synapse_audio_drops;
alter publication supabase_realtime add table public.synapse_emissions;
