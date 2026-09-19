export type AdminTab = 
  | 'dashboard' 
  | 'stations_management' // Super-Admin Exclusif : Création, modification, flux Icecast & suppression
  | 'regie_animation'     // Régie & Animation : Studio direct, Micro, Cartouchier, Jingles
  | 'music_library'       // Bibliothèque Musicale : Titres, import, tags, BPM, analyse
  | 'playlists'           // Gestion des Playlists : Rotations Auto-DJ (Heavy, Med, Soft), listes
  | 'emission_prep'       // Préparation des Émissions : Conducteurs d'antenne, blocs & chroniques
  | 'programming'         // Grille On-Air / TV & Radio
  | 'messages'            // Messagerie Studio & Dédicaces
  | 'events'              // Événements & Concerts
  | 'challenges'          // Défis & XP
  | 'promotions'          // Promotions & Boutique
  | 'users'               // Gestion des Utilisateurs & Attribution des radios
  | 'services'            // Services & API (Super-Admin / Tech)
  | 'features'            // Modules du Site (Super-Admin)
  | 'stations'            // Alias de compatibilité
  | 'streaming' 
  | 'database';

export interface SidebarItemConfig {
  id: AdminTab;
  visible: boolean;
  order: number;
}

export type WidgetSize = 'full' | 'wide' | 'half' | 'third';
export type WidgetHeight = 'normal' | 'tall';
export type WidgetDensity = 'compact' | 'normal' | 'expanded';

export type DashboardWidgetId =
  | 'kpi_overview'
  | 'quick_actions'
  | 'stations_monitor'
  | 'station_focus'
  | 'next_up_schedule'
  | 'broadcast_quick_status'
  | 'services_status'
  | 'recent_messages'
  | 'active_challenges'
  | 'upcoming_events'
  | 'promotions_partners'
  | 'community_users'
  | 'station_playlist_history'
  | 'station_live_controls'
  | 'station_stats_listeners'
  | 'station_song_requests';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  stationId?: string; // Specific station ID for station-specific widgets
  title: string;
  description: string;
  size: WidgetSize;
  height?: WidgetHeight;
  density: WidgetDensity;
  visible: boolean;
  order: number;
}
