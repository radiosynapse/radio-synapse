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
  deezerUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
}

export interface ConnectedAccount {
  provider: 'email' | 'passkey' | 'deezer' | 'apple-music';
  username: string;
  email?: string;
  avatarUrl?: string;
  profileUrl?: string;
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

export interface StreamDjAccount {
  username: string;
  password?: string;
  displayName: string;
  stationShortcode?: string;
  linkedAt: number;
}

export interface UserNotification {
  id: string;
  title: string;
  message: string;
  type: 'points_earned' | 'track_selected' | 'track_rejected' | 'challenge_completed' | 'promo_purchased' | 'general';
  points?: number;
  timestamp: number;
  read: boolean;
}

export interface SynapseUser {
  id: string; // Supabase user ID or email
  email: string;
  username: string; // pseudo
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role: UserRole;
  adminProfileId?: AdminProfileTypeId; // Linked profile type (animateur, podcasteur, etc.)
  assignedStationId?: string; // Associated radio shortcode e.g. 'pop-variete' or 'all' (legacy / primary)
  assignedStationIds?: string[]; // Array of assigned radio station IDs decided by super-admin (e.g. ['pop-variete', 'urban-groove'])
  customPermissions?: Partial<AdminPermissions>; // Custom override by super-admin
  avatarUrl?: string;
  createdAt: number;
  authMethod?: 'password' | 'passkey' | 'email';
  passkeyCredentialId?: string;
  passkeyCreatedAt?: number;
  djAccount?: StreamDjAccount | null; // Linked Stream DJ account
  isDjLinked?: boolean;
  likedTracksCount?: number;
  favoriteStationsCount?: number;
  points?: number; // Loyalty points gained through challenges & podiums
  level?: number;
  badges?: string[];
  purchasedPromoCodes?: string[]; // Array of promotion IDs unlocked with points
  notifications?: UserNotification[]; // User in-app notifications
}

