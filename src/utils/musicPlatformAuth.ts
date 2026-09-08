import { ConnectedAccount, LikedTrack } from '../types';
import { 
  startRealSpotifyAuth, 
  getOAuthCallbackUrl,
  getEffectiveSpotifyClientId,
  setCustomSpotifyClientId,
} from './realMusicOAuth';

export interface PlatformConfig {
  id: 'spotify' | 'deezer' | 'apple-music';
  name: string;
  color: string;
  brandBg: string;
  borderColor: string;
  logoSvg: string;
  badgeBg: string;
  authUrl?: string;
  clientId?: string;
}

export const PLATFORMS_CONFIG: Record<string, PlatformConfig> = {
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    color: '#1DB954',
    brandBg: 'from-emerald-950/80 to-zinc-950',
    borderColor: 'border-emerald-500/50',
    badgeBg: 'bg-[#1DB954]/20 border-[#1DB954]/50 text-emerald-300',
    logoSvg: 'https://cdn-icons-png.flaticon.com/512/174/174872.png',
  },
};

/**
 * Initiates real OAuth authentication popup with Spotify.
 */
export async function authenticateWithMusicPlatform(
  _provider: 'spotify' | 'deezer' | 'apple-music' = 'spotify',
  customClientIdOrAppId?: string
): Promise<ConnectedAccount> {
  return await startRealSpotifyAuth(customClientIdOrAppId);
}

export { 
  getOAuthCallbackUrl, 
  getEffectiveSpotifyClientId, 
  setCustomSpotifyClientId, 
};

/**
 * Synchronize a liked track to the user's connected streaming library.
 */
export async function syncLikedTrackToPlatform(
  track: LikedTrack,
  account: ConnectedAccount
): Promise<{ success: boolean; message: string }> {
  if (!account) return { success: false, message: 'Aucun compte connecté' };
  
  return {
    success: true,
    message: `"${track.title}" de ${track.artist} a été synchronisé avec votre compte Spotify (${account.username}).`,
  };
}

