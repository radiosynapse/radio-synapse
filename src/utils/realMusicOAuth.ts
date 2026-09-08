import { ConnectedAccount } from '../types';
import { saveConnectedAccount } from './favoritesStorage';

// Default public or configurable client identifiers
export const DEFAULT_SPOTIFY_CLIENT_ID = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SPOTIFY_CLIENT_ID) || 
  '1aaed58afa3c408cbfd6b89b111077bf'; // Spotify Client ID

// Storage keys for custom client keys configured by user
const STORAGE_SPOTIFY_CLIENT_ID = 'synapse_custom_spotify_client_id';
const STORAGE_SPOTIFY_CODE_VERIFIER = 'synapse_spotify_code_verifier';

export function getEffectiveSpotifyClientId(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_SPOTIFY_CLIENT_ID);
    if (custom && custom.trim().length > 5) return custom.trim();
  }
  return DEFAULT_SPOTIFY_CLIENT_ID;
}

export function setCustomSpotifyClientId(clientId: string): void {
  if (typeof window !== 'undefined') {
    if (clientId.trim()) {
      localStorage.setItem(STORAGE_SPOTIFY_CLIENT_ID, clientId.trim());
    } else {
      localStorage.removeItem(STORAGE_SPOTIFY_CLIENT_ID);
    }
  }
}

export function getOAuthCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback.html`;
  }
  return 'http://localhost:3000/auth/callback.html';
}

/**
 * PKCE Helpers: Code Verifier and Code Challenge Generation
 */
function generateCodeVerifier(length = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map((val) => possible[val % possible.length])
    .join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * 1. REAL SPOTIFY OAUTH FLOW WITH PKCE (Proof Key for Code Exchange)
 * Opens official https://accounts.spotify.com/authorize with response_type=code & PKCE
 * Listens for popup authorization code, exchanges code for access token via https://accounts.spotify.com/api/token
 * Then fetches real user profile via https://api.spotify.com/v1/me
 */
export async function startRealSpotifyAuth(
  clientId?: string
): Promise<ConnectedAccount> {
  const activeClientId = clientId?.trim() || getEffectiveSpotifyClientId();
  const redirectUri = getOAuthCallbackUrl();
  const state = 'spotify_' + Math.random().toString(36).substring(2, 12);

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_SPOTIFY_CODE_VERIFIER, codeVerifier);
  }

  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-library-read',
    'user-library-modify'
  ].join(' ');

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(
    activeClientId
  )}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes)}&code_challenge_method=S256&code_challenge=${encodeURIComponent(
    codeChallenge
  )}&state=${encodeURIComponent(state)}&show_dialog=true`;

  return new Promise<ConnectedAccount>((resolve, reject) => {
    const popupWidth = 540;
    const popupHeight = 720;
    const left = window.screenX + (window.outerWidth - popupWidth) / 2;
    const top = window.screenY + (window.outerHeight - popupHeight) / 2;

    const popup = window.open(
      authUrl,
      'Spotify_OAuth_Login',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
    );

    if (!popup) {
      reject(new Error('Le pop-up d\'authentification a été bloqué par votre navigateur. Veuillez autoriser les pop-ups pour continuer.'));
      return;
    }

    let isHandled = false;

    // Timeout safety (2 minutes)
    const timeoutId = window.setTimeout(() => {
      if (!isHandled) {
        window.removeEventListener('message', handleMessage);
        window.clearInterval(pollInterval);
        isHandled = true;
        reject(new Error('Délai d\'authentification Spotify dépassé.'));
      }
    }, 120000);

    // Listener for postMessage from /auth/callback.html
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'MUSIC_PLATFORM_AUTH_SUCCESS') return;

      const payload = event.data;
      if (payload.error) {
        window.removeEventListener('message', handleMessage);
        window.clearInterval(pollInterval);
        window.clearTimeout(timeoutId);
        isHandled = true;
        reject(new Error(`Erreur Spotify: ${payload.error}`));
        return;
      }

      const code = payload.code || payload.params?.code;
      const directToken = payload.accessToken || payload.params?.access_token;

      if (code || directToken) {
        window.removeEventListener('message', handleMessage);
        window.clearInterval(pollInterval);
        window.clearTimeout(timeoutId);
        isHandled = true;

        try {
          let accessToken = directToken;

          // If we received an authorization code, exchange it using PKCE
          if (code) {
            const savedVerifier = localStorage.getItem(STORAGE_SPOTIFY_CODE_VERIFIER) || codeVerifier;
            const tokenParams = new URLSearchParams({
              client_id: activeClientId,
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: redirectUri,
              code_verifier: savedVerifier,
            });

            const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: tokenParams.toString(),
            });

            if (!tokenRes.ok) {
              const errBody = await tokenRes.json().catch(() => ({}));
              console.warn('Token exchange response error:', errBody);
              throw new Error(errBody.error_description || errBody.error || `Erreur d'authentification Spotify (${tokenRes.status})`);
            }

            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
            const refreshToken = tokenData.refresh_token;
            const expiresIn = tokenData.expires_in || 3600;
            const expiresAt = Date.now() + (expiresIn * 1000);

            // Fetch Real Spotify User Profile via Spotify Web API
            const profile = await fetchSpotifyUserProfile(accessToken, refreshToken, expiresAt);
            saveConnectedAccount(profile);
            resolve(profile);
            return;
          }

          if (accessToken) {
            // Direct token
            const profile = await fetchSpotifyUserProfile(accessToken);
            saveConnectedAccount(profile);
            resolve(profile);
            return;
          }

          reject(new Error('Aucun token ou code d\'autorisation valide reçu de Spotify.'));
        } catch (fetchErr: any) {
          console.error('Error finalizing Spotify profile:', fetchErr);
          reject(fetchErr instanceof Error ? fetchErr : new Error('Erreur lors de la validation Spotify.'));
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Polling fallback to check if popup closed or storage updated
    const pollInterval = window.setInterval(() => {
      if (isHandled) return;

      try {
        const stored = localStorage.getItem('synapse_latest_oauth_result');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < 10000 && (parsed.payload?.code || parsed.payload?.accessToken)) {
            localStorage.removeItem('synapse_latest_oauth_result');
            handleMessage({ data: parsed.payload } as MessageEvent);
            return;
          }
        }
      } catch (e) {}

      if (popup.closed) {
        window.clearInterval(pollInterval);
        window.setTimeout(() => {
          if (!isHandled) {
            window.removeEventListener('message', handleMessage);
            window.clearTimeout(timeoutId);
            isHandled = true;
            reject(new Error('Fenêtre de connexion Spotify fermée avant la validation.'));
          }
        }, 1000);
      }
    }, 800);
  });
}

/**
 * Fetch real user profile from Spotify Web API
 * Requires valid Spotify access token with user-read-private / user-read-email scopes
 */
async function fetchSpotifyUserProfile(
  accessToken: string,
  refreshToken?: string,
  expiresAt?: number
): Promise<ConnectedAccount> {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let errDetail = `Code ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errDetail = errJson.error.message;
      }
    } catch (_) {
      try {
        const text = await response.text();
        if (text) errDetail = text;
      } catch (_) {}
    }

    if (response.status === 403) {
      throw new Error(
        `Accès Spotify refusé (403) : "${errDetail}".\n` +
        `Spotify bloque les requêtes car votre compte n'est pas enregistré comme utilisateur autorisé sur ce Client ID. ` +
        `Pour connecter votre vrai compte personnel et créer votre playlist, renseignez votre propre Client ID Spotify dans les réglages ci-dessous (créé en 30s sur developer.spotify.com).`
      );
    }

    throw new Error(`Erreur API Spotify (${response.status}) : ${errDetail}`);
  }

  const data = await response.json();
  if (!data || !data.id) {
    throw new Error('Données de profil Spotify incomplètes renvoyées par Spotify.');
  }

  const avatar = data.images && data.images.length > 0 ? data.images[0].url : null;
  const username = data.display_name || data.id;
  const email = data.email || undefined;
  const profileUrl = data.external_urls?.spotify || `https://open.spotify.com/user/${data.id}`;

  return {
    provider: 'spotify',
    userId: data.id,
    username,
    email,
    avatarUrl: avatar || 'https://cdn-icons-png.flaticon.com/512/174/174872.png',
    profileUrl,
    accessToken,
    refreshToken,
    expiresAt: expiresAt || Date.now() + 3600000,
    connectedAt: Date.now(),
  };
}

/**
 * Refreshes an expired Spotify access token using the PKCE refresh token flow
 */
export async function refreshSpotifyAccessToken(
  account: ConnectedAccount,
  clientId?: string
): Promise<ConnectedAccount | null> {
  if (!account || !account.refreshToken || account.provider !== 'spotify') {
    return null;
  }

  const activeClientId = clientId?.trim() || getEffectiveSpotifyClientId();

  try {
    const tokenParams = new URLSearchParams({
      client_id: activeClientId,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
    });

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      console.warn('Spotify token refresh rejected by server:', tokenRes.status);
      return null;
    }

    const tokenData = await tokenRes.json();
    const expiresIn = tokenData.expires_in || 3600;
    const updatedAccount: ConnectedAccount = {
      ...account,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || account.refreshToken,
      expiresAt: Date.now() + (expiresIn * 1000),
    };

    saveConnectedAccount(updatedAccount);
    return updatedAccount;
  } catch (e) {
    console.warn('Error refreshing Spotify token:', e);
    return null;
  }
}

/**
 * Validates the current Spotify token and refreshes it automatically if needed.
 * Returns null if token is completely missing or cannot be refreshed.
 */
export async function getValidSpotifyAccessToken(
  account: ConnectedAccount | null
): Promise<{ token: string; account: ConnectedAccount } | null> {
  if (!account || account.provider !== 'spotify' || !account.accessToken) {
    return null;
  }

  // Reject dummy placeholder tokens from obsolete mocks
  if (
    account.accessToken === 'spotify_authenticated' ||
    account.accessToken.startsWith('mock_') ||
    account.accessToken.length < 15
  ) {
    return null;
  }

  // Check if expired or about to expire in less than 45 seconds
  const isExpired = account.expiresAt && Date.now() > account.expiresAt - 45000;

  if (isExpired && account.refreshToken) {
    const refreshed = await refreshSpotifyAccessToken(account);
    if (refreshed && refreshed.accessToken) {
      return { token: refreshed.accessToken, account: refreshed };
    }
  }

  return { token: account.accessToken, account };
}

