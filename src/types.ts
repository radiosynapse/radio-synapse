export interface Stream {
  id: string;
  name: string;
  genre: string;
  description: string;
  urls: {
    low: string;    // 128 kbps
    medium: string; // 192 kbps
    high: string;   // 320 kbps
  };
  color: string;   // Accent color for themes
}

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number; // in seconds
  currentTime: number;
}

export interface EqualizerPreset {
  name: string;
  bass: number; // -12 to +12 dB
  mid: number;  // -12 to +12 dB
  treble: number; // -12 to +12 dB
}

export interface CastDevice {
  id: string;
  name: string;
  type: 'google-cast' | 'airplay' | 'wifi';
  icon: string;
}

export interface LikedTrack {
  id: string; // unique key e.g. artist-title
  title: string;
  artist: string;
  album?: string;
  coverUrl: string;
  stationName?: string;
  likedAt: number; // timestamp
  level?: 1 | 2; // 1 = Aime bien, 2 = Aime beaucoup (double cœur)
  previewUrl?: string; // 30s audio preview
  spotifyUri?: string;
  deezerUrl?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
}

export interface ConnectedAccount {
  provider: 'deezer' | 'spotify' | 'apple-music' | 'email';
  username: string;
  userId?: string; // Spotify User ID
  email?: string;
  avatarUrl?: string;
  profileUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // timestamp when accessToken expires
  playlistId?: string; // ID of the 'Radio Synapse - Titres Likés' playlist
  playlistUrl?: string; // URL of the 'Radio Synapse - Titres Likés' playlist
  lastSyncedAt?: number;
  connectedAt: number;
}

export type UserRole = 'super-admin' | 'admin' | 'user';

export interface AdminPermissions {
  can_access_dashboard: boolean;
  can_manage_stations: boolean;
  can_broadcast_live: boolean;
  can_manage_services: boolean;
  can_manage_users: boolean;
  can_manage_messages: boolean;
  can_manage_programming: boolean;
  can_manage_events: boolean;
  can_manage_challenges: boolean;
  can_manage_promotions: boolean;
  can_manage_database: boolean;
  station_restriction?: string; // 'all' or specific station ID (e.g. 'pop-variete')
}

export type AdminProfileTypeId =
  | 'profile_super_admin'
  | 'profile_general_admin'
  | 'profile_animateur'
  | 'profile_podcasteur'
  | 'profile_technicien'
  | 'profile_moderateur'
  | 'profile_programmateur'
  | 'profile_invite'
  | 'profile_custom'
  | string;

export interface AdminProfileTemplate {
  id: string;
  name: string;
  badge: string;
  description: string;
  color: string;
  permissions: AdminPermissions;
  defaultStation?: string;
}

export interface AzuraDjAccount {
  username: string;
  password?: string;
  displayName: string;
  stationShortcode?: string;
  linkedAt: number;
}

export interface SynapseUser {
  id: string; // PocketBase user ID or email
  email: string;
  username: string;
  role: UserRole;
  adminProfileId?: AdminProfileTypeId; // Linked profile type (animateur, podcasteur, etc.)
  assignedStationId?: string; // Associated radio shortcode e.g. 'pop-variete' or 'all'
  customPermissions?: Partial<AdminPermissions>; // Custom override by super-admin
  avatarUrl?: string;
  createdAt: number;
  spotifyAccount?: ConnectedAccount | null; // Linked Spotify account
  isSpotifyLinked: boolean;
  azuraDjAccount?: AzuraDjAccount | null; // Linked AzuraCast DJ account
  isDjLinked?: boolean;
  likedTracksCount?: number;
  favoriteStationsCount?: number;
}

