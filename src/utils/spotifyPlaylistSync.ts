import { LikedTrack, ConnectedAccount } from '../types';
import { saveUserDataToDatabase, getUserDataFromDatabase } from './userDatabase';
import { generatePlatformLinks, saveConnectedAccount } from './favoritesStorage';
import { getValidSpotifyAccessToken, refreshSpotifyAccessToken } from './realMusicOAuth';

export { getValidSpotifyAccessToken, refreshSpotifyAccessToken };

export const SPOTIFY_PLAYLIST_NAME = 'Radio Synapse - Titres Likés';
export const SPOTIFY_PLAYLIST_DESCRIPTION = 'Titres favoris et coups de cœur découverts en direct sur Radio Synapse.';

export interface SpotifySyncResult {
  success: boolean;
  playlistId?: string;
  playlistUrl?: string;
  syncedCount?: number;
  message?: string;
  error?: string;
  requiresReauth?: boolean;
}

/**
 * Helper to perform authenticated Spotify fetch with automatic 401 retry & token refresh
 */
async function spotifyFetch(
  url: string,
  options: RequestInit,
  account?: ConnectedAccount
): Promise<Response> {
  let res = await fetch(url, options);

  if (res.status === 401 && account && account.refreshToken) {
    // Attempt automatic token refresh
    const refreshed = await refreshSpotifyAccessToken(account);
    if (refreshed && refreshed.accessToken) {
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set('Authorization', `Bearer ${refreshed.accessToken}`);
      res = await fetch(url, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  return res;
}

/**
 * Find or create the "Radio Synapse - Titres Likés" playlist on the user's Spotify profile.
 */
export async function findOrCreateSynapsePlaylist(
  accessToken: string,
  userId?: string,
  account?: ConnectedAccount
): Promise<{ id: string; url: string; name: string }> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Resolve true Spotify User ID if missing or placeholder
  let realUserId = userId?.trim();
  if (!realUserId || realUserId === 'spotify_user' || realUserId === 'Utilisateur Spotify') {
    try {
      const meRes = await spotifyFetch('https://api.spotify.com/v1/me', { headers }, account);
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.id) realUserId = meData.id;
      }
    } catch (e) {
      console.warn('Could not query Spotify /me for user id:', e);
    }
  }

  // 2. Fetch current user's playlists to see if Radio Synapse playlist already exists
  try {
    const listRes = await spotifyFetch(
      'https://api.spotify.com/v1/me/playlists?limit=50',
      { headers },
      account
    );

    if (listRes.ok) {
      const listData = await listRes.json();
      const items = listData.items || [];
      
      const existing = items.find((p: any) => 
        p && p.name && (
          p.name.trim().toLowerCase() === SPOTIFY_PLAYLIST_NAME.toLowerCase() ||
          p.name.trim().toLowerCase() === 'radio synapse - titre liké' ||
          p.name.trim().toLowerCase() === 'radio synapse - titres likes'
        )
      );

      if (existing) {
        return {
          id: existing.id,
          url: existing.external_urls?.spotify || `https://open.spotify.com/playlist/${existing.id}`,
          name: existing.name,
        };
      }
    } else if (listRes.status === 401) {
      throw new Error('Session Spotify expirée. Veuillez reconnecter votre compte Spotify.');
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Session Spotify expirée')) {
      throw err;
    }
    console.warn('Could not list Spotify playlists:', err);
  }

  // 3. Not found, let's create a new playlist with robust fallbacks (private then public)
  const endpointsToTry: string[] = [];
  if (realUserId) {
    endpointsToTry.push(`https://api.spotify.com/v1/users/${encodeURIComponent(realUserId)}/playlists`);
  }
  endpointsToTry.push('https://api.spotify.com/v1/me/playlists');

  let lastErrorText = '';
  let lastStatus = 0;

  for (const endpoint of endpointsToTry) {
    // Try with public: false (most permissive in Spotify dev mode)
    for (const isPublic of [false, true]) {
      try {
        const createPayload = {
          name: SPOTIFY_PLAYLIST_NAME,
          description: SPOTIFY_PLAYLIST_DESCRIPTION,
          public: isPublic,
        };

        const createRes = await spotifyFetch(
          endpoint,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(createPayload),
          },
          account
        );

        if (createRes.ok) {
          const newPlaylist = await createRes.json();
          return {
            id: newPlaylist.id,
            url: newPlaylist.external_urls?.spotify || `https://open.spotify.com/playlist/${newPlaylist.id}`,
            name: newPlaylist.name || SPOTIFY_PLAYLIST_NAME,
          };
        } else {
          lastStatus = createRes.status;
          if (createRes.status === 401) {
            throw new Error('Session Spotify expirée (401). Veuillez reconnecter votre compte Spotify.');
          }
          lastErrorText = await createRes.text();
        }
      } catch (reqErr: any) {
        if (reqErr.message && reqErr.message.includes('Session Spotify expirée')) {
          throw reqErr;
        }
        console.warn(`Attempt failed on ${endpoint} (public: ${isPublic}):`, reqErr);
      }
    }
  }

  let formattedErr = lastErrorText;
  try {
    const parsed = JSON.parse(lastErrorText);
    if (parsed?.error?.message) {
      formattedErr = parsed.error.message;
    }
  } catch (_) {}

  if (lastStatus === 403) {
    throw new Error(
      `Impossible de créer la playlist Spotify (403) : "${formattedErr}". ` +
      `Votre compte Spotify n'est pas enregistré sur ce Client ID en mode développement. ` +
      `Créez votre propre Client ID gratuit sur developer.spotify.com et renseignez-le dans Radio Synapse pour créer et synchroniser votre playlist sans restriction.`
    );
  }

  throw new Error(`Impossible de créer la playlist Spotify (${lastStatus || 400}) : ${formattedErr || 'Erreur inconnue'}`);
}

/**
 * Search Spotify for a track and return its Spotify URI with multiple intelligent search strategies
 */
export async function resolveSpotifyTrackUri(
  title: string,
  artist: string,
  accessToken: string,
  account?: ConnectedAccount
): Promise<{ uri: string; spotifyUrl?: string; coverUrl?: string } | null> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  // Clean strings from common suffixes & feature tags
  const cleanTitle = title
    .replace(/\s*[\(\[](?:feat\.?|ft\.?|featuring|with|remix|radio edit|club mix|original mix|official video).*?[\)\]]/gi, '')
    .replace(/["']/g, '')
    .trim();

  const cleanArtist = artist
    .replace(/\s*(?:feat\.?|ft\.?|featuring|with|\&).*$/gi, '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim();

  // Multi-step search query queries to try in order
  const queriesToTry: string[] = [];

  // 1. Direct "Artist Title" (most reliable on Spotify)
  if (cleanArtist && cleanTitle) {
    queriesToTry.push(`${cleanArtist} ${cleanTitle}`);
  }

  // 2. Structured query "track:Title artist:Artist"
  if (cleanTitle && cleanArtist) {
    queriesToTry.push(`track:${cleanTitle} artist:${cleanArtist}`);
  }

  // 3. Raw title and artist
  if (artist && title && (artist !== cleanArtist || title !== cleanTitle)) {
    queriesToTry.push(`${artist} ${title}`);
  }

  // 4. Clean Title only (if artist is a station name or generic)
  if (cleanTitle) {
    queriesToTry.push(cleanTitle);
  }

  // 5. If title has " - " (like "Daft Punk - One More Time"), split it
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      queriesToTry.push(`${parts[0].trim()} ${parts[1].trim()}`);
    }
  }

  // Deduplicate queries
  const uniqueQueries = Array.from(new Set(queriesToTry.filter(q => q && q.trim().length > 0)));

  for (const q of uniqueQueries) {
    try {
      const searchRes = await spotifyFetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=3`,
        { headers },
        account
      );

      if (searchRes.ok) {
        const data = await searchRes.json();
        const tracks = data.tracks?.items || [];
        if (tracks.length > 0) {
          // Find best matching track
          const item = tracks[0];
          return {
            uri: item.uri,
            spotifyUrl: item.external_urls?.spotify,
            coverUrl: item.album?.images?.[0]?.url,
          };
        }
      }
    } catch (e) {
      console.warn(`Error resolving Spotify URI with query "${q}":`, e);
    }
  }

  return null;
}

/**
 * Fetch all existing track URIs currently inside the Spotify playlist
 */
export async function getExistingSpotifyPlaylistTracks(
  playlistId: string,
  accessToken: string,
  account?: ConnectedAccount
): Promise<Set<string>> {
  const existingUris = new Set<string>();
  try {
    const res = await spotifyFetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      account
    );

    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      items.forEach((item: any) => {
        if (item?.track?.uri) {
          existingUris.add(item.track.uri);
        }
      });
    } else if (res.status === 403) {
      console.warn(`[SpotifySync] Droits insuffisants (403) sur la playlist ${playlistId}. L'utilisateur doit autoriser les scopes de playlist.`);
    }
  } catch (err) {
    console.warn('Could not fetch existing playlist tracks:', err);
  }
  return existingUris;
}

/**
 * Full transfer and sync of all liked tracks into the Spotify Playlist "Radio Synapse - Titres Likés"
 * and saves user data in persistent database.
 */
export async function syncFullLikedTracksToSpotifyPlaylist(
  likedTracks: LikedTrack[],
  account: ConnectedAccount
): Promise<SpotifySyncResult> {
  if (!account || account.provider !== 'spotify') {
    return { success: false, error: 'Compte Spotify non connecté' };
  }

  const validTokenInfo = await getValidSpotifyAccessToken(account);
  if (!validTokenInfo) {
    return {
      success: false,
      error: 'Session Spotify expirée. Veuillez reconnecter votre compte.',
      requiresReauth: true,
    };
  }

  const activeAccount = validTokenInfo.account;
  const activeToken = validTokenInfo.token;

  try {
    // 1. Ensure playlist exists
    const playlist = await findOrCreateSynapsePlaylist(activeToken, activeAccount.userId, activeAccount);

    // 2. Resolve all track URIs
    const validUris: string[] = [];
    const updatedTracks: LikedTrack[] = [];

    for (const track of likedTracks) {
      if (track.spotifyUri && track.spotifyUri.startsWith('spotify:track:')) {
        if (!validUris.includes(track.spotifyUri)) {
          validUris.push(track.spotifyUri);
        }
        updatedTracks.push(track);
      } else {
        const resolved = await resolveSpotifyTrackUri(track.title, track.artist, activeToken, activeAccount);
        if (resolved && resolved.uri) {
          if (!validUris.includes(resolved.uri)) {
            validUris.push(resolved.uri);
          }
          updatedTracks.push({
            ...track,
            spotifyUri: resolved.uri,
            spotifyUrl: resolved.spotifyUrl || track.spotifyUrl,
            coverUrl: resolved.coverUrl || track.coverUrl,
          });
        } else {
          updatedTracks.push(track);
        }
      }
    }

    // 3. Update Spotify playlist content
    if (validUris.length > 0) {
      // First try PUT to replace tracks with batch
      let updateSucceeded = false;
      const batch100 = validUris.slice(0, 100);

      try {
        const replaceRes = await spotifyFetch(
          `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${activeToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uris: batch100 }),
          },
          activeAccount
        );

        if (replaceRes.ok) {
          updateSucceeded = true;
        } else {
          console.warn('PUT playlist tracks status:', replaceRes.status);
        }
      } catch (putErr) {
        console.warn('PUT playlist tracks failed, falling back to POST:', putErr);
      }

      // If PUT failed or returned error, try POST addition
      if (!updateSucceeded) {
        const existingUris = await getExistingSpotifyPlaylistTracks(playlist.id, activeToken, activeAccount);
        const urisToAdd = validUris.filter(u => !existingUris.has(u));

        if (urisToAdd.length > 0) {
          const postBatch = urisToAdd.slice(0, 100);
          const postRes = await spotifyFetch(
            `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${activeToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ uris: postBatch }),
            },
            activeAccount
          );

          if (!postRes.ok) {
            console.warn('POST playlist tracks returned status:', postRes.status);
          }
        }
      }

      // If more than 100 tracks, append remaining chunks
      if (validUris.length > 100) {
        for (let i = 100; i < validUris.length; i += 100) {
          const chunk = validUris.slice(i, i + 100);
          await spotifyFetch(
            `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${activeToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ uris: chunk }),
            },
            activeAccount
          );
        }
      }
    }

    // 4. Save to Persistent Database
    const dbUserId = activeAccount.userId || activeAccount.username || 'spotify_user';
    await saveUserDataToDatabase(dbUserId, {
      userId: dbUserId,
      username: activeAccount.username,
      email: activeAccount.email,
      likedTracks: updatedTracks,
      spotifyPlaylistId: playlist.id,
      spotifyPlaylistUrl: playlist.url,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      playlistId: playlist.id,
      playlistUrl: playlist.url,
      syncedCount: validUris.length,
      message: `Playlist Spotify "${playlist.name}" synchronisée avec succès (${validUris.length} titre(s)).`,
    };
  } catch (err: any) {
    console.warn('Error syncing liked tracks to Spotify:', err);
    return {
      success: false,
      error: err.message || 'Erreur lors de la synchronisation Spotify',
    };
  }
}

/**
 * Adds a single newly liked track to the Spotify playlist and database
 */
export async function addSingleTrackToSpotify(
  track: LikedTrack,
  account: ConnectedAccount,
  allLikedTracks: LikedTrack[]
): Promise<SpotifySyncResult> {
  if (!account || account.provider !== 'spotify') {
    return { success: false, error: 'Compte Spotify non connecté' };
  }

  const validTokenInfo = await getValidSpotifyAccessToken(account);
  if (!validTokenInfo) {
    return {
      success: false,
      error: 'Session Spotify expirée. Veuillez reconnecter votre compte.',
      requiresReauth: true,
    };
  }

  const activeAccount = validTokenInfo.account;
  const activeToken = validTokenInfo.token;

  try {
    const playlist = await findOrCreateSynapsePlaylist(activeToken, activeAccount.userId, activeAccount);

    let uri = track.spotifyUri;
    if (!uri || !uri.startsWith('spotify:track:')) {
      const resolved = await resolveSpotifyTrackUri(track.title, track.artist, activeToken, activeAccount);
      if (resolved) {
        uri = resolved.uri;
        track.spotifyUri = resolved.uri;
        if (resolved.spotifyUrl) track.spotifyUrl = resolved.spotifyUrl;
      }
    }

    if (uri) {
      // Check if already in playlist before adding to avoid duplicates
      const existing = await getExistingSpotifyPlaylistTracks(playlist.id, activeToken, activeAccount);
      if (!existing.has(uri)) {
        let addRes = await spotifyFetch(
          `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${activeToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uris: [uri],
              position: 0,
            }),
          },
          activeAccount
        );

        if (!addRes.ok) {
          // Retry without position parameter if Spotify returns 400
          addRes = await spotifyFetch(
            `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${activeToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                uris: [uri],
              }),
            },
            activeAccount
          );
        }

        if (!addRes.ok) {
          console.warn('Spotify add track POST status:', addRes.status);
        }
      }
    }

    // Persist to database
    const dbUserId = activeAccount.userId || activeAccount.username || 'spotify_user';
    await saveUserDataToDatabase(dbUserId, {
      userId: dbUserId,
      username: activeAccount.username,
      email: activeAccount.email,
      likedTracks: allLikedTracks,
      spotifyPlaylistId: playlist.id,
      spotifyPlaylistUrl: playlist.url,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      playlistId: playlist.id,
      playlistUrl: playlist.url,
      message: `"${track.title}" ajouté à votre playlist Spotify "${SPOTIFY_PLAYLIST_NAME}".`,
    };
  } catch (err: any) {
    console.warn('Error adding track to Spotify playlist:', err);
    return {
      success: false,
      error: err.message || 'Erreur d\'ajout à Spotify',
    };
  }
}

/**
 * Removes an unliked track from the Spotify playlist and updates database
 */
export async function removeSingleTrackFromSpotify(
  track: LikedTrack,
  account: ConnectedAccount,
  remainingLikedTracks: LikedTrack[]
): Promise<SpotifySyncResult> {
  if (!account || account.provider !== 'spotify') {
    return { success: false, error: 'Compte Spotify non connecté' };
  }

  const validTokenInfo = await getValidSpotifyAccessToken(account);
  if (!validTokenInfo) {
    return {
      success: false,
      error: 'Session Spotify non valide',
      requiresReauth: true,
    };
  }

  const activeAccount = validTokenInfo.account;
  const activeToken = validTokenInfo.token;

  try {
    const playlist = await findOrCreateSynapsePlaylist(activeToken, activeAccount.userId, activeAccount);

    let uri = track.spotifyUri;
    if (!uri || !uri.startsWith('spotify:track:')) {
      const resolved = await resolveSpotifyTrackUri(track.title, track.artist, activeToken, activeAccount);
      if (resolved) {
        uri = resolved.uri;
      }
    }

    if (uri) {
      await spotifyFetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tracks: [{ uri }],
          }),
        },
        activeAccount
      );
    }

    // Persist updated list to database
    const dbUserId = activeAccount.userId || activeAccount.username || 'spotify_user';
    await saveUserDataToDatabase(dbUserId, {
      userId: dbUserId,
      username: activeAccount.username,
      email: activeAccount.email,
      likedTracks: remainingLikedTracks,
      spotifyPlaylistId: playlist.id,
      spotifyPlaylistUrl: playlist.url,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      playlistId: playlist.id,
      playlistUrl: playlist.url,
    };
  } catch (err: any) {
    console.warn('Error removing track from Spotify playlist:', err);
    return {
      success: false,
      error: err.message || 'Erreur de suppression Spotify',
    };
  }
}

/**
 * Fetch and restore user data when reconnecting to Radio Synapse from anywhere.
 * Reconciles local liked tracks, database stored tracks, and Spotify playlist tracks.
 */
export async function fetchAndRestoreUserData(
  account: ConnectedAccount,
  localTracks: LikedTrack[]
): Promise<{
  tracks: LikedTrack[];
  playlistId?: string;
  playlistUrl?: string;
  account: ConnectedAccount;
}> {
  const dbUserId = account.userId || account.username || 'spotify_user';
  
  // 1. Load from persistent database
  const dbData = await getUserDataFromDatabase(dbUserId);

  let mergedTracksMap = new Map<string, LikedTrack>();

  // Add DB tracks
  if (dbData && dbData.likedTracks) {
    dbData.likedTracks.forEach((t) => {
      if (t && t.id) mergedTracksMap.set(t.id, t);
    });
  }

  // Add local tracks (preserving high like level)
  localTracks.forEach((t) => {
    if (t && t.id) {
      const existing = mergedTracksMap.get(t.id);
      if (existing && existing.level === 2) {
        // Keep level 2
      } else {
        mergedTracksMap.set(t.id, t);
      }
    }
  });

  let playlistId = account.playlistId || dbData?.spotifyPlaylistId;
  let playlistUrl = account.playlistUrl || dbData?.spotifyPlaylistUrl;
  let currentAccount = account;

  // 2. Fetch tracks from real Spotify playlist if access token is valid
  const tokenInfo = await getValidSpotifyAccessToken(account);
  if (tokenInfo && tokenInfo.account.provider === 'spotify') {
    currentAccount = tokenInfo.account;
    const activeToken = tokenInfo.token;

    try {
      const playlist = await findOrCreateSynapsePlaylist(activeToken, currentAccount.userId, currentAccount);
      playlistId = playlist.id;
      playlistUrl = playlist.url;

      // Fetch tracks from the Spotify playlist
      const tracksRes = await spotifyFetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        },
        currentAccount
      );

      if (tracksRes.ok) {
        const tracksData = await tracksRes.json();
        const items = tracksData.items || [];

        for (const item of items) {
          if (item && item.track && item.track.name) {
            const trackObj = item.track;
            const title = trackObj.name;
            const artist = trackObj.artists?.map((a: any) => a.name).join(', ') || 'Artiste inconnu';
            const cleanId = `${artist.toLowerCase().trim()}-${title.toLowerCase().trim()}`.replace(/[^a-z0-9-]/g, '');
            
            const cover = trackObj.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
            const preview = trackObj.preview_url || undefined;
            const spotifyUrl = trackObj.external_urls?.spotify || `https://open.spotify.com/track/${trackObj.id}`;
            const links = generatePlatformLinks(title, artist);

            const existingTrack = mergedTracksMap.get(cleanId);
            mergedTracksMap.set(cleanId, {
              id: cleanId,
              title,
              artist,
              album: trackObj.album?.name || 'Single',
              coverUrl: cover,
              stationName: existingTrack?.stationName || 'Radio Synapse',
              likedAt: item.added_at ? new Date(item.added_at).getTime() : Date.now(),
              level: existingTrack?.level || 1,
              previewUrl: preview || existingTrack?.previewUrl,
              spotifyUri: trackObj.uri,
              ...links,
              spotifyUrl: spotifyUrl,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Notice during Spotify playlist restore:', err);
    }
  }

  const finalTracks = Array.from(mergedTracksMap.values()).sort((a, b) => b.likedAt - a.likedAt);

  const updatedAccount: ConnectedAccount = {
    ...currentAccount,
    playlistId,
    playlistUrl,
    lastSyncedAt: Date.now(),
  };

  saveConnectedAccount(updatedAccount);

  // Save back to DB
  await saveUserDataToDatabase(dbUserId, {
    userId: dbUserId,
    username: updatedAccount.username,
    email: updatedAccount.email,
    likedTracks: finalTracks,
    spotifyPlaylistId: playlistId,
    spotifyPlaylistUrl: playlistUrl,
    updatedAt: Date.now(),
  });

  return {
    tracks: finalTracks,
    playlistId,
    playlistUrl,
    account: updatedAccount,
  };
}

