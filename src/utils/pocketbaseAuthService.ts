import { pb } from '../lib/pocketbase';
import { SynapseUser, UserRole, ConnectedAccount, LikedTrack } from '../types';

const LOCAL_USER_KEY = 'radio_synapse_auth_user_v1';
const LOCAL_SPOTIFY_KEY = 'radio_synapse_connected_spotify_account';

/**
 * Get saved local user profile
 */
export function getStoredSynapseUser(): SynapseUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) {
      // Check if PocketBase authStore has a valid session
      if (pb.authStore.isValid && pb.authStore.record) {
        const rec: any = pb.authStore.record;
        const cleanEmail = (rec.email || '').trim().toLowerCase();
        let role: UserRole = 'user';
        if (rec.role === 'super-admin' || cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr') {
          role = 'super-admin';
        } else if (rec.role === 'admin') {
          role = 'admin';
        }

        const djUsername = rec.azuracast_dj_username || rec.dj_username || '';
        const djAccount = djUsername ? {
          username: djUsername,
          password: rec.azuracast_dj_password || rec.dj_password || '',
          displayName: rec.azuracast_dj_display_name || rec.dj_display_name || djUsername,
          stationShortcode: rec.azuracast_dj_station || 'pop-variete',
          linkedAt: rec.azuracast_dj_linked_at || Date.now(),
        } : null;

        const adminProfileId = rec.admin_profile_id || (role === 'super-admin' ? 'profile_super_admin' : (role === 'admin' ? 'profile_general_admin' : undefined));
        const assignedStationId = rec.assigned_station_id || 'all';
        const customPermissions = rec.custom_permissions || undefined;

        const usr: SynapseUser = {
          id: rec.id,
          email: cleanEmail,
          username: rec.name || rec.username || cleanEmail.split('@')[0] || 'Membre Synapse',
          role: role,
          adminProfileId,
          assignedStationId,
          customPermissions,
          avatarUrl: rec.avatar ? pb.files.getUrl(rec, rec.avatar) : (rec.avatar_url || rec.avatarUrl),
          createdAt: new Date(rec.created || Date.now()).getTime(),
          spotifyAccount: rec.spotify_account || null,
          isSpotifyLinked: !!rec.spotify_account || !!rec.is_spotify_linked,
          azuraDjAccount: djAccount,
          isDjLinked: !!djAccount,
        };
        saveStoredSynapseUser(usr);
        return usr;
      }
      return null;
    }
    const parsed: SynapseUser = JSON.parse(raw);
    if (parsed) {
      const cleanEmail = (parsed.email || '').trim().toLowerCase();
      if (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr' || parsed.role === 'super-admin') {
        parsed.role = 'super-admin';
        parsed.adminProfileId = parsed.adminProfileId || 'profile_super_admin';
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save user profile to local storage
 */
export function saveStoredSynapseUser(user: SynapseUser | null): void {
  if (!user) {
    localStorage.removeItem(LOCAL_USER_KEY);
  } else {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  }
}

/**
 * Helper to safely create an authentic user in PocketBase 'users' auth collection.
 * Tries with extended fields first, then falls back to standard auth fields if custom fields don't exist yet on 'users'.
 */
async function createPocketBaseUserRecord(
  email: string,
  pass: string,
  username: string,
  displayName: string,
  extraData: Record<string, any> = {}
): Promise<any> {
  const cleanEmail = email.trim().toLowerCase();
  let cleanUsername = username.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
  if (!cleanUsername || cleanUsername.length < 3) {
    cleanUsername = `user_${Math.random().toString(36).slice(-6)}`;
  }

  // Attempt 1: Create with all fields (standard + extra)
  try {
    const rec = await pb.collection('users').create({
      email: cleanEmail,
      emailVisibility: true,
      password: pass,
      passwordConfirm: pass,
      username: cleanUsername,
      name: displayName,
      ...extraData,
    });
    return rec;
  } catch (err1: any) {
    console.warn('PocketBase create attempt 1 error, retrying with standard auth fields:', err1?.message || err1);
  }

  // Attempt 2: Create with only standard PocketBase auth collection fields
  try {
    const rec = await pb.collection('users').create({
      email: cleanEmail,
      emailVisibility: true,
      password: pass,
      passwordConfirm: pass,
      username: cleanUsername,
      name: displayName,
    });
    return rec;
  } catch (err2: any) {
    console.warn('PocketBase create attempt 2 error, trying with unique username:', err2?.message || err2);
  }

  // Attempt 3: Username collision fallback
  const uniqueUsername = `${cleanUsername.slice(0, 20)}_${Math.random().toString(36).slice(-4)}`;
  try {
    const rec = await pb.collection('users').create({
      email: cleanEmail,
      emailVisibility: true,
      password: pass,
      passwordConfirm: pass,
      username: uniqueUsername,
      name: displayName,
    });
    return rec;
  } catch (err3: any) {
    console.error('PocketBase user creation final error:', err3?.message || err3);
    throw new Error(err3?.message || 'Impossible de créer le compte utilisateur sur PocketBase.');
  }
}

/**
 * Sign up with Email and Password using PocketBase Auth
 * User is created in PocketBase as a genuine authenticated user with default role 'user'
 */
export async function signUpWithEmail(
  email: string,
  pass: string,
  username?: string,
  initialRole: UserRole = 'user'
): Promise<{ user: SynapseUser; message?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = username?.trim() || cleanEmail.split('@')[0] || 'Membre Synapse';

  // Check if Spotify is already connected locally to link it during signup
  let spotifyAccount: ConnectedAccount | null = null;
  try {
    const rawSpo = localStorage.getItem(LOCAL_SPOTIFY_KEY);
    if (rawSpo) spotifyAccount = JSON.parse(rawSpo);
  } catch {}

  try {
    // 1. Create real authenticated user in PocketBase 'users' collection
    const record = await createPocketBaseUserRecord(
      cleanEmail,
      pass,
      displayName,
      displayName,
      {
        role: initialRole,
        spotify_account: spotifyAccount || null,
        is_spotify_linked: !!spotifyAccount,
      }
    );

    // 2. Authenticate session via PocketBase authWithPassword
    const authData = await pb.collection('users').authWithPassword(cleanEmail, pass);
    const rec: any = authData.record || record;
    const dbRole: UserRole = rec.role === 'admin' ? 'admin' : initialRole;

    const newUser: SynapseUser = {
      id: rec.id,
      email: cleanEmail,
      username: displayName,
      role: dbRole,
      createdAt: Date.now(),
      spotifyAccount: spotifyAccount,
      isSpotifyLinked: !!spotifyAccount,
    };

    saveStoredSynapseUser(newUser);

    // 3. Create/link profile record in PocketBase 'profiles' collection
    await syncUserProfileToDatabase(newUser).catch(() => {});

    return {
      user: newUser,
      message: 'Compte créé et authentifié avec succès dans la base de données !',
    };
  } catch (error: any) {
    throw new Error(error?.message || 'Erreur lors de la création du compte sur PocketBase.');
  }
}

/**
 * Sign in with Email and Password using real PocketBase Authentication
 * User's permissions/role are determined strictly by their database record
 */
export async function signInWithEmail(
  email: string,
  pass: string
): Promise<SynapseUser> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const authData = await pb.collection('users').authWithPassword(cleanEmail, pass);
    const rec: any = authData.record;

    // Fetch database profile for role and metadata
    const dbProfile = await fetchUserProfileFromDatabase(rec.id).catch(() => null);
    const role: UserRole = rec.role === 'admin' || dbProfile?.role === 'admin' ? 'admin' : 'user';
    const displayName = rec.name || rec.username || dbProfile?.username || cleanEmail.split('@')[0] || 'Membre Synapse';

    let spotifyAccount: ConnectedAccount | null = dbProfile?.spotifyAccount || rec.spotify_account || null;

    if (!spotifyAccount) {
      try {
        const rawSpo = localStorage.getItem(LOCAL_SPOTIFY_KEY);
        if (rawSpo) spotifyAccount = JSON.parse(rawSpo);
      } catch {}
    }

    const userProfile: SynapseUser = {
      id: rec.id,
      email: cleanEmail,
      username: displayName,
      role: role,
      avatarUrl: dbProfile?.avatarUrl || (rec.avatar ? pb.files.getUrl(rec, rec.avatar) : undefined),
      createdAt: dbProfile?.createdAt || new Date(rec.created || Date.now()).getTime(),
      spotifyAccount: spotifyAccount,
      isSpotifyLinked: !!spotifyAccount,
    };

    saveStoredSynapseUser(userProfile);
    await syncUserProfileToDatabase(userProfile).catch(() => {});

    return userProfile;
  } catch (error: any) {
    throw new Error(error?.message || 'Email ou mot de passe incorrect.');
  }
}

/**
 * Send a password reset email via PocketBase
 */
export async function resetPasswordForEmail(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Veuillez saisir une adresse e-mail valide.');
  }

  try {
    await pb.collection('users').requestPasswordReset(cleanEmail);
    return `Un lien sécurisé a été envoyé à ${cleanEmail} via PocketBase. Il vous permettra de réinitialiser votre mot de passe.`;
  } catch (error: any) {
    throw new Error(error?.message || "Impossible d'envoyer l'e-mail de réinitialisation.");
  }
}

/**
 * Register or Sign In directly using a connected Spotify account.
 * Both "Se connecter avec Spotify" and "Créer un compte avec Spotify" create a genuine account
 * in PocketBase (users & profiles collections) if it does not already exist, with email and Spotify profile URL.
 * Guarantees that admin role granted in either 'profiles' or 'users' collection is strictly preserved,
 * and eliminates duplicate user profiles across logouts and logins.
 */
export async function authenticateOrRegisterWithSpotify(
  spotifyAccount: ConnectedAccount
): Promise<{ user: SynapseUser; isNewUser: boolean; message: string }> {
  const cleanEmail = (spotifyAccount.email || '').trim().toLowerCase();
  const spotifyId = spotifyAccount.userId || '';
  const spotifyProfileUrl = spotifyAccount.profileUrl || (spotifyId ? `https://open.spotify.com/user/${spotifyId}` : '');
  const displayName = spotifyAccount.username || (cleanEmail ? cleanEmail.split('@')[0] : 'Utilisateur Spotify');
  
  // Deterministic email and password for Spotify authentication in PocketBase
  const fallbackEmail = spotifyId ? `${spotifyId.replace(/[^a-zA-Z0-9]/g, '')}@spotify.radiosynapse.fr` : `spotify_${Date.now()}@spotify.radiosynapse.fr`;
  const effectiveEmail = cleanEmail || fallbackEmail;
  const spotifyAuthPassword = `SynapseSp_${(spotifyId || 'user').replace(/[^a-zA-Z0-9]/g, '_')}_!2026`;

  let pbUserId = '';
  let dbRole: UserRole = 'user';
  let isNewUser = false;
  let userRecord: any = null;

  // 1. Try authenticating directly with PocketBase auth collection using effectiveEmail
  try {
    const authData = await pb.collection('users').authWithPassword(effectiveEmail, spotifyAuthPassword);
    if (authData?.record) {
      userRecord = authData.record;
      pbUserId = userRecord.id;
    }
  } catch {}

  // If email was custom and failed, also attempt with fallbackEmail
  if (!userRecord && cleanEmail && fallbackEmail && cleanEmail !== fallbackEmail) {
    try {
      const authData = await pb.collection('users').authWithPassword(fallbackEmail, spotifyAuthPassword);
      if (authData?.record) {
        userRecord = authData.record;
        pbUserId = userRecord.id;
      }
    } catch {}
  }

  // 2. Query 'profiles' collection for any existing profile linked by spotify_id, user_id, or email
  const searchFilterParts = [
    spotifyId ? `spotify_id = "${spotifyId}"` : null,
    spotifyId ? `user_id = "${spotifyId}"` : null,
    effectiveEmail ? `(email != "" && email = "${effectiveEmail}")` : null,
    cleanEmail ? `(email != "" && email = "${cleanEmail}")` : null,
    pbUserId ? `user_id = "${pbUserId}"` : null,
  ].filter(Boolean);

  let existingProfiles: any[] = [];
  if (searchFilterParts.length > 0) {
    try {
      existingProfiles = await pb.collection('profiles').getFullList({
        filter: searchFilterParts.join(' || '),
        sort: '-created',
      });
    } catch {}
  }

  // Check if ANY existing profile or user record has 'admin' role
  const hasAdminRole =
    (userRecord?.role === 'admin') ||
    existingProfiles.some((p: any) => p.role === 'admin');
  if (hasAdminRole) {
    dbRole = 'admin';
  }

  // Select primary profile (prefer the one with role === 'admin' if multiple exist)
  let primaryProfile = existingProfiles.find((p: any) => p.role === 'admin') || existingProfiles[0] || null;

  // If userRecord was not authenticated yet, check if primaryProfile has a valid user_id
  if (!userRecord && primaryProfile?.user_id) {
    try {
      userRecord = await pb.collection('users').getOne(primaryProfile.user_id);
      if (userRecord) {
        pbUserId = userRecord.id;
        if (userRecord.role === 'admin') dbRole = 'admin';
      }
    } catch {}
  }

  // 3. If userRecord or primaryProfile exists, this is an existing user
  if (userRecord || primaryProfile) {
    isNewUser = false;
    if (!pbUserId && primaryProfile?.user_id) {
      pbUserId = primaryProfile.user_id;
    }

    // Try logging in to refresh auth session if not valid
    if (!pb.authStore.isValid && userRecord?.email) {
      try {
        await pb.collection('users').authWithPassword(userRecord.email, spotifyAuthPassword);
      } catch {}
    }

    // Update PocketBase 'users' auth record if we have an ID
    if (userRecord?.id) {
      try {
        await pb.collection('users').update(userRecord.id, {
          name: displayName,
          role: dbRole,
          spotify_account: spotifyAccount,
          is_spotify_linked: true,
          spotify_url: spotifyProfileUrl,
          spotify_id: spotifyId,
        });
      } catch {
        // Safe catch if custom fields aren't on users
      }
    }
  } else {
    // 4. Truly NEW user in PocketBase
    isNewUser = true;
    userRecord = await createPocketBaseUserRecord(
      effectiveEmail,
      spotifyAuthPassword,
      displayName,
      displayName,
      {
        role: 'user',
        spotify_account: spotifyAccount,
        is_spotify_linked: true,
        spotify_url: spotifyProfileUrl,
        spotify_id: spotifyId,
      }
    );

    pbUserId = userRecord?.id;
    dbRole = 'user';

    try {
      const authData = await pb.collection('users').authWithPassword(effectiveEmail, spotifyAuthPassword);
      if (authData?.record) {
        userRecord = authData.record;
        pbUserId = userRecord.id;
      }
    } catch (authErr) {
      console.warn('PocketBase authWithPassword notice:', authErr);
    }
  }

  // 5. Synchronize and deduplicate 'profiles' collection: ensure exactly ONE profile exists
  if (pbUserId || primaryProfile?.id) {
    const profPayload = {
      user_id: pbUserId || primaryProfile?.user_id || spotifyId,
      email: cleanEmail || userRecord?.email || primaryProfile?.email || effectiveEmail,
      username: displayName,
      role: dbRole,
      avatar_url: spotifyAccount.avatarUrl || userRecord?.avatar_url || primaryProfile?.avatar_url || '',
      spotify_url: spotifyProfileUrl,
      spotify_id: spotifyId,
      spotify_account: spotifyAccount,
      is_spotify_linked: true,
    };

    try {
      if (primaryProfile?.id) {
        await pb.collection('profiles').update(primaryProfile.id, profPayload);

        // Delete any duplicate profiles found with the same identity to clean the database
        if (existingProfiles.length > 1) {
          for (const extra of existingProfiles) {
            if (extra.id !== primaryProfile.id) {
              await pb.collection('profiles').delete(extra.id).catch(() => {});
            }
          }
        }
      } else {
        const created = await pb.collection('profiles').create(profPayload);
        primaryProfile = created;
      }
    } catch (e) {
      console.warn('PocketBase profiles sync notice:', e);
    }
  }

  const authenticatedUser: SynapseUser = {
    id: pbUserId || primaryProfile?.user_id || spotifyId || `user_${Date.now()}`,
    email: cleanEmail || userRecord?.email || effectiveEmail,
    username: displayName,
    role: dbRole,
    avatarUrl: spotifyAccount.avatarUrl || primaryProfile?.avatar_url,
    createdAt: userRecord?.created ? new Date(userRecord.created).getTime() : Date.now(),
    spotifyAccount: {
      ...spotifyAccount,
      email: cleanEmail || userRecord?.email || effectiveEmail,
      profileUrl: spotifyProfileUrl,
    },
    isSpotifyLinked: true,
  };

  saveStoredSynapseUser(authenticatedUser);

  try {
    localStorage.setItem(LOCAL_SPOTIFY_KEY, JSON.stringify(spotifyAccount));
  } catch {}

  return {
    user: authenticatedUser,
    isNewUser,
    message: isNewUser
      ? `Compte créé avec succès et synchronisé avec Spotify (${displayName}) !`
      : (dbRole === 'admin'
          ? `Connexion Spotify réussie (${displayName}) — Accès Administrateur validé.`
          : `Connexion Spotify réussie (${displayName}) !`),
  };
}

/**
 * Sign out user from PocketBase and clear local session
 */
export async function signOutSynapseUser(): Promise<void> {
  try {
    pb.authStore.clear();
  } catch (e) {
    console.warn('PocketBase signout notice:', e);
  }
  saveStoredSynapseUser(null);
}

/**
 * Link or Update a Spotify account to the active Radio Synapse user account.
 * NEVER creates a phantom user or database profile when unauthenticated.
 */
export async function linkSpotifyToSynapseUser(
  spotifyAccount: ConnectedAccount
): Promise<SynapseUser | null> {
  let currentUser = getStoredSynapseUser();
  if (!currentUser) {
    // If no user is logged in, Spotify is only connected as an audio service, not a user profile
    try {
      localStorage.setItem(LOCAL_SPOTIFY_KEY, JSON.stringify(spotifyAccount));
    } catch {}
    return null;
  }

  const spotifyId = spotifyAccount.userId || '';
  const spotifyProfileUrl = spotifyAccount.profileUrl || (spotifyId ? `https://open.spotify.com/user/${spotifyId}` : '');

  currentUser.spotifyAccount = spotifyAccount;
  currentUser.isSpotifyLinked = true;
  if (spotifyAccount.avatarUrl && !currentUser.avatarUrl) {
    currentUser.avatarUrl = spotifyAccount.avatarUrl;
  }
  if (spotifyAccount.email && !currentUser.email) {
    currentUser.email = spotifyAccount.email;
  }

  saveStoredSynapseUser(currentUser);

  try {
    localStorage.setItem(LOCAL_SPOTIFY_KEY, JSON.stringify(spotifyAccount));
  } catch {}

  // Update PocketBase user record if logged in
  if (pb.authStore.isValid && pb.authStore.record?.id) {
    try {
      await pb.collection('users').update(pb.authStore.record.id, {
        spotify_account: spotifyAccount,
        is_spotify_linked: true,
        spotify_url: spotifyProfileUrl,
        spotify_id: spotifyId,
      });
    } catch {}
  }

  await syncUserProfileToDatabase(currentUser).catch(() => {});

  return currentUser;
}

/**
 * Update user role and admin profile directly in PocketBase database (super-admin / admin profiles)
 */
export async function updateUserRoleInPocketBase(
  userId: string, 
  role: UserRole,
  adminProfileId?: string,
  assignedStationId?: string,
  customPermissions?: any
): Promise<void> {
  if (!userId) return;

  const payload: any = { role };
  if (adminProfileId !== undefined) payload.admin_profile_id = adminProfileId;
  if (assignedStationId !== undefined) payload.assigned_station_id = assignedStationId;
  if (customPermissions !== undefined) payload.custom_permissions = customPermissions;

  // 1. Update in PocketBase users collection
  try {
    await pb.collection('users').update(userId, payload);
  } catch {}

  // 2. Update in PocketBase profiles collection
  try {
    const profs = await pb.collection('profiles').getFullList({
      filter: `user_id = "${userId}" || id = "${userId}" || spotify_id = "${userId}"`,
    }).catch(() => []);

    for (const prof of profs) {
      await pb.collection('profiles').update(prof.id, payload).catch(() => {});
      if (prof.user_id && prof.user_id !== userId) {
        await pb.collection('users').update(prof.user_id, payload).catch(() => {});
      }
    }
  } catch {}
}

/**
 * Sync profile data to PocketBase `profiles` collection without creating duplicates
 */
export async function syncUserProfileToDatabase(user: SynapseUser): Promise<void> {
  if (!user || !user.id) return;

  const spotifyId = user.spotifyAccount?.userId || '';
  const spotifyProfileUrl = user.spotifyAccount?.profileUrl || (spotifyId ? `https://open.spotify.com/user/${spotifyId}` : '');

  const filterParts = [
    `user_id = "${user.id}"`,
    user.id ? `id = "${user.id}"` : null,
    spotifyId ? `spotify_id = "${spotifyId}"` : null,
    spotifyId ? `user_id = "${spotifyId}"` : null,
    user.email ? `(email != "" && email = "${user.email}")` : null,
  ].filter(Boolean);

  try {
    const existing = await pb.collection('profiles').getFirstListItem(filterParts.join(' || ')).catch(() => null);

    // CRITICAL: Protect the admin role! Never downgrade admin to user on background sync!
    const finalRole: UserRole = (existing?.role === 'admin' || user.role === 'admin') ? 'admin' : user.role;

    const payload = {
      user_id: user.id,
      email: user.email,
      username: user.username,
      role: finalRole,
      avatar_url: user.avatarUrl || existing?.avatar_url || '',
      spotify_url: spotifyProfileUrl || existing?.spotify_url || '',
      spotify_id: spotifyId || existing?.spotify_id || '',
      spotify_account: user.spotifyAccount || existing?.spotify_account || null,
      is_spotify_linked: !!user.isSpotifyLinked || !!existing?.is_spotify_linked,
    };

    if (existing) {
      await pb.collection('profiles').update(existing.id, payload);
    } else {
      await pb.collection('profiles').create(payload);
    }
  } catch (err) {
    // Silent catch
  }
}

/**
 * Fetch profile row from PocketBase `profiles` collection
 */
export async function fetchUserProfileFromDatabase(userId: string): Promise<Partial<SynapseUser> | null> {
  try {
    const data: any = await pb.collection('profiles').getFirstListItem(`user_id = "${userId}" || id = "${userId}" || spotify_id = "${userId}"`);
    if (!data) return null;

    return {
      id: data.user_id || data.id,
      email: data.email,
      username: data.username,
      role: data.role as UserRole,
      avatarUrl: data.avatar_url,
      spotifyAccount: data.spotify_account,
      isSpotifyLinked: data.is_spotify_linked,
    };
  } catch {
    return null;
  }
}

/**
 * Sync user's liked tracks and favorite stations to PocketBase `user_synapse_data` collection
 */
export async function syncUserDataToPocketBaseCloud(
  userId: string,
  likedTracks: LikedTrack[],
  favoriteStations: string[]
): Promise<void> {
  if (!userId) return;

  const payload = {
    user_id: userId,
    liked_tracks: likedTracks,
    favorite_stations: favoriteStations,
  };

  try {
    const existing = await pb.collection('user_synapse_data').getFirstListItem(`user_id = "${userId}"`).catch(() => null);
    if (existing) {
      await pb.collection('user_synapse_data').update(existing.id, payload);
    } else {
      await pb.collection('user_synapse_data').create(payload);
    }
  } catch (err) {
    // Silent catch
  }
}

/**
 * Restore user's data from PocketBase `user_synapse_data` collection on boot
 */
export async function fetchUserDataFromPocketBaseCloud(
  userId: string
): Promise<{ likedTracks?: LikedTrack[]; favoriteStations?: string[] } | null> {
  if (!userId) return null;

  try {
    const data: any = await pb.collection('user_synapse_data').getFirstListItem(`user_id = "${userId}"`);
    if (!data) return null;

    return {
      likedTracks: data.liked_tracks || [],
      favoriteStations: data.favorite_stations || [],
    };
  } catch {
    return null;
  }
}

/**
 * Restore current session on boot using PocketBase authStore, strictly verifying admin role
 */
export async function restorePocketBaseAuthSession(): Promise<SynapseUser | null> {
  try {
    if (pb.authStore.isValid && pb.authStore.token) {
      // Refresh session with PocketBase backend
      const authData = await pb.collection('users').authRefresh().catch(() => null);
      const rec: any = authData?.record || pb.authStore.record;
      if (rec) {
        const cleanEmail = (rec.email || '').trim().toLowerCase();
        let role: UserRole = (rec.role === 'super-admin' || rec.role === 'admin') ? rec.role : 'user';
        if (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr') {
          role = 'super-admin';
        }

        // If not admin on users collection, check linked profile in profiles collection
        if (role === 'user') {
          const prof = await fetchUserProfileFromDatabase(rec.id).catch(() => null);
          if (prof?.role === 'admin' || prof?.role === 'super-admin') {
            role = prof.role;
            // Sync role to users record in background
            pb.collection('users').update(rec.id, { role }).catch(() => {});
          }
        }

        const displayName = rec.name || rec.username || cleanEmail.split('@')[0] || 'Membre Synapse';

        const djUsername = rec.azuracast_dj_username || rec.dj_username || '';
        const djAccount = djUsername ? {
          username: djUsername,
          password: rec.azuracast_dj_password || rec.dj_password || '',
          displayName: rec.azuracast_dj_display_name || rec.dj_display_name || djUsername,
          stationShortcode: rec.azuracast_dj_station || 'pop-variete',
          linkedAt: rec.azuracast_dj_linked_at || Date.now(),
        } : null;

        const adminProfileId = rec.admin_profile_id || (role === 'super-admin' ? 'profile_super_admin' : (role === 'admin' ? 'profile_general_admin' : undefined));
        const assignedStationId = rec.assigned_station_id || 'all';
        const customPermissions = rec.custom_permissions || undefined;

        const restoredUser: SynapseUser = {
          id: rec.id,
          email: cleanEmail,
          username: displayName,
          role: role,
          adminProfileId,
          assignedStationId,
          customPermissions,
          avatarUrl: rec.avatar ? pb.files.getUrl(rec, rec.avatar) : (rec.avatar_url || undefined),
          createdAt: new Date(rec.created || Date.now()).getTime(),
          spotifyAccount: rec.spotify_account || null,
          isSpotifyLinked: !!rec.spotify_account || !!rec.is_spotify_linked,
          azuraDjAccount: djAccount,
          isDjLinked: !!djAccount,
        };

        saveStoredSynapseUser(restoredUser);
        return restoredUser;
      }
    }
  } catch (e) {
    console.warn('Failed to restore PocketBase session:', e);
  }

  return getStoredSynapseUser();
}

const ADMIN_DJ_STORAGE_KEY = 'synapse_admin_dj_account_link_v1';

/**
 * Get linked DJ credentials from user profile or fallback storage
 */
export function getLinkedAdminDjAccount(currentUser?: SynapseUser | null): {
  username: string;
  password?: string;
  displayName: string;
  stationShortcode?: string;
  linkedAt: number;
} | null {
  if (currentUser?.azuraDjAccount?.username) {
    return currentUser.azuraDjAccount;
  }
  const stored = getStoredSynapseUser();
  if (stored?.azuraDjAccount?.username) {
    return stored.azuraDjAccount;
  }
  try {
    const raw = localStorage.getItem(ADMIN_DJ_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

/**
 * Link an AzuraCast DJ account to the admin profile & persist to PocketBase
 */
export async function saveAdminDjAccount(
  user: SynapseUser,
  djData: {
    username: string;
    password?: string;
    displayName: string;
    stationShortcode?: string;
  }
): Promise<SynapseUser> {
  const djAccount = {
    username: djData.username.trim(),
    password: djData.password || '',
    displayName: djData.displayName.trim() || djData.username.trim(),
    stationShortcode: djData.stationShortcode || 'pop-variete',
    linkedAt: Date.now(),
  };

  const updatedUser: SynapseUser = {
    ...user,
    azuraDjAccount: djAccount,
    isDjLinked: true,
  };

  // 1. Save locally
  saveStoredSynapseUser(updatedUser);
  try {
    localStorage.setItem(ADMIN_DJ_STORAGE_KEY, JSON.stringify(djAccount));
  } catch {}

  // 2. Persist to PocketBase users & profiles
  if (user.id) {
    try {
      await pb.collection('users').update(user.id, {
        azuracast_dj_username: djAccount.username,
        azuracast_dj_password: djAccount.password,
        azuracast_dj_display_name: djAccount.displayName,
        azuracast_dj_station: djAccount.stationShortcode,
        azuracast_dj_linked_at: djAccount.linkedAt,
      }).catch(() => {});
    } catch {}

    try {
      const prof = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`).catch(() => null);
      if (prof) {
        await pb.collection('profiles').update(prof.id, {
          azuracast_dj_username: djAccount.username,
          azuracast_dj_password: djAccount.password,
          azuracast_dj_display_name: djAccount.displayName,
        }).catch(() => {});
      }
    } catch {}

    try {
      // Mirror to synapse_admin_data for remote recovery
      const adminDataKey = `admin_dj_${user.id}`;
      const existing = await pb.collection('synapse_admin_data').getFirstListItem(`key = "${adminDataKey}"`).catch(() => null);
      if (existing) {
        await pb.collection('synapse_admin_data').update(existing.id, { payload: djAccount }).catch(() => {});
      } else {
        await pb.collection('synapse_admin_data').create({
          key: adminDataKey,
          payload: djAccount,
        }).catch(() => {});
      }
    } catch {}
  }

  return updatedUser;
}

/**
 * Unlink AzuraCast DJ account
 */
export async function unlinkAdminDjAccount(user: SynapseUser): Promise<SynapseUser> {
  const updatedUser: SynapseUser = {
    ...user,
    azuraDjAccount: null,
    isDjLinked: false,
  };

  saveStoredSynapseUser(updatedUser);
  try {
    localStorage.removeItem(ADMIN_DJ_STORAGE_KEY);
  } catch {}

  if (user.id) {
    try {
      await pb.collection('users').update(user.id, {
        azuracast_dj_username: '',
        azuracast_dj_password: '',
        azuracast_dj_display_name: '',
      }).catch(() => {});
    } catch {}

    try {
      const prof = await pb.collection('profiles').getFirstListItem(`user_id = "${user.id}"`).catch(() => null);
      if (prof) {
        await pb.collection('profiles').update(prof.id, {
          azuracast_dj_username: '',
          azuracast_dj_password: '',
          azuracast_dj_display_name: '',
        }).catch(() => {});
      }
    } catch {}
  }

  return updatedUser;
}
