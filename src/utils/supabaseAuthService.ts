import { supabase } from '../lib/supabase';
import { SynapseUser, UserRole } from '../types';

const LOCAL_USER_KEY = 'radio_synapse_auth_user_v1';

/**
 * Get saved local user profile
 */
export function getStoredSynapseUser(): SynapseUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) {
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
 * Test Supabase connection
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: _data, error } = await supabase.from('synapse_admin_data').select('key').limit(1);
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Connexion Supabase PostgreSQL & Realtime active.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erreur de connexion Supabase' };
  }
}

/**
 * Login user using Supabase Auth (GoTrue)
 */
export async function loginWithSupabase(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: SynapseUser; message?: string; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Supabase auth sign-in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (error || !data.user) {
      return { 
        success: false, 
        message: error?.message || 'Identifiants invalides.',
        error: error?.message || 'Identifiants invalides.' 
      };
    }

    const authUser = data.user;
    
    // 2. Fetch extended profile from public.profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    let role: UserRole = 'user';
    if (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr' || profile?.role === 'super-admin') {
      role = 'super-admin';
    } else if (profile?.role === 'admin') {
      role = 'admin';
    }

    const djAccount = profile?.dj_username ? {
      username: profile.dj_username,
      displayName: profile.dj_display_name || profile.dj_username,
      stationShortcode: profile.dj_station || 'synapse-main',
      linkedAt: profile.dj_linked_at ? new Date(profile.dj_linked_at).getTime() : Date.now(),
    } : null;

    const synapseUser: SynapseUser = {
      id: authUser.id,
      email: cleanEmail,
      username: profile?.display_name || profile?.username || authUser.user_metadata?.username || cleanEmail.split('@')[0],
      firstName: profile?.first_name || authUser.user_metadata?.first_name,
      lastName: profile?.last_name || authUser.user_metadata?.last_name,
      displayName: profile?.display_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.username || cleanEmail.split('@')[0],
      role: role,
      adminProfileId: profile?.admin_profile_id || (role === 'super-admin' ? 'profile_super_admin' : (role === 'admin' ? 'profile_general_admin' : 'profile_animateur')),
      assignedStationId: profile?.assigned_station_id || 'all',
      customPermissions: profile?.custom_permissions || undefined,
      avatarUrl: profile?.avatar_url || authUser.user_metadata?.avatar_url,
      createdAt: new Date(authUser.created_at || Date.now()).getTime(),
      points: profile?.points ?? 100,
      badges: profile?.badges || [],
      authMethod: (profile?.auth_method as any) || 'password',
      passkeyCredentialId: profile?.passkey_credential_id,
      djAccount: djAccount,
      isDjLinked: !!djAccount,
    };

    saveStoredSynapseUser(synapseUser);
    return { success: true, user: synapseUser, message: 'Connexion réussie.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erreur lors de la connexion.', error: err?.message };
  }
}

export const signInWithEmail = loginWithSupabase;

/**
 * Register a new user in Supabase with email + password
 */
export async function registerWithSupabase(
  email: string,
  pass: string,
  username: string,
  firstName?: string,
  lastName?: string
): Promise<{ success: boolean; user?: SynapseUser; message?: string; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim() || cleanEmail.split('@')[0];
    const cleanFirstName = (firstName || '').trim();
    const cleanLastName = (lastName || '').trim();
    const finalDisplayName = `${cleanFirstName} ${cleanLastName}`.trim() || cleanUsername;

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: {
          username: cleanUsername,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          display_name: finalDisplayName,
        },
      },
    });

    if (error || !data.user) {
      return { success: false, message: error?.message || 'Erreur lors de la création du compte.', error: error?.message };
    }

    const authUser = data.user;
    let role: UserRole = (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr') ? 'super-admin' : 'user';

    const synapseUser: SynapseUser = {
      id: authUser.id,
      email: cleanEmail,
      username: cleanUsername,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      displayName: finalDisplayName,
      role,
      adminProfileId: role === 'super-admin' ? 'profile_super_admin' : 'profile_animateur',
      assignedStationId: 'all',
      createdAt: Date.now(),
      points: 100,
      authMethod: 'password',
      isDjLinked: false,
    };

    // Save profile record
    try {
      await supabase.from('profiles').upsert({
        id: authUser.id,
        email: cleanEmail,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        username: cleanUsername,
        display_name: finalDisplayName,
        role,
        auth_method: 'password',
        points: 100,
        updated_at: new Date().toISOString(),
      });
    } catch {}

    saveStoredSynapseUser(synapseUser);
    return { success: true, user: synapseUser, message: 'Compte créé avec succès.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erreur lors de l’inscription.', error: err?.message };
  }
}

export const signUpWithEmail = registerWithSupabase;

/**
 * Reset password for email
 */
export async function resetPasswordForEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Email de réinitialisation envoyé.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Erreur lors de la réinitialisation.' };
  }
}

/**
 * Sync user favorites and points to Supabase Cloud
 */
export async function syncUserDataToSupabaseCloud(user: SynapseUser, data: any): Promise<void> {
  if (!user?.id) return;
  try {
    await supabase.from('profiles').update({
      ...data,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
  } catch {}
}

/**
 * Fetch user data from Supabase Cloud
 */
export async function fetchUserDataFromSupabaseCloud(user: SynapseUser): Promise<any> {
  if (!user?.id) return null;
  try {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    return data;
  } catch {
    return null;
  }
}

/**
 * Restore user session from Supabase client
 */
export async function restoreSupabaseAuthSession(): Promise<SynapseUser | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      return getStoredSynapseUser();
    }

    const authUser = data.session.user;
    const cleanEmail = (authUser.email || '').trim().toLowerCase();

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    let role: UserRole = 'user';
    if (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr' || profile?.role === 'super-admin') {
      role = 'super-admin';
    } else if (profile?.role === 'admin') {
      role = 'admin';
    }

    const djAccount = profile?.dj_username ? {
      username: profile.dj_username,
      displayName: profile.dj_display_name || profile.dj_username,
      stationShortcode: profile.dj_station || 'synapse-main',
      linkedAt: profile.dj_linked_at ? new Date(profile.dj_linked_at).getTime() : Date.now(),
    } : null;

    const user: SynapseUser = {
      id: authUser.id,
      email: cleanEmail,
      username: profile?.display_name || profile?.username || cleanEmail.split('@')[0],
      firstName: profile?.first_name,
      lastName: profile?.last_name,
      displayName: profile?.display_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.username || cleanEmail.split('@')[0],
      role,
      adminProfileId: profile?.admin_profile_id || (role === 'super-admin' ? 'profile_super_admin' : (role === 'admin' ? 'profile_general_admin' : 'profile_animateur')),
      assignedStationId: profile?.assigned_station_id || 'all',
      customPermissions: profile?.custom_permissions || undefined,
      avatarUrl: profile?.avatar_url,
      createdAt: new Date(authUser.created_at).getTime(),
      points: profile?.points ?? 100,
      badges: profile?.badges || [],
      authMethod: (profile?.auth_method as any) || 'password',
      passkeyCredentialId: profile?.passkey_credential_id,
      djAccount: djAccount,
      isDjLinked: !!djAccount,
    };

    saveStoredSynapseUser(user);
    return user;
  } catch {
    return getStoredSynapseUser();
  }
}

/**
 * Logout from Supabase
 */
export async function logoutSupabase(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {}
  saveStoredSynapseUser(null);
}

export const signOutSynapseUser = logoutSupabase;

/**
 * Update user role and admin profile in Supabase
 */
export async function updateUserRoleInSupabase(
  userId: string,
  role: UserRole,
  adminProfileId?: string,
  assignedStationId?: string,
  customPermissions?: string[]
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_user_role', {
      p_user_id: userId,
      p_role: role,
      p_admin_profile_id: adminProfileId ?? null,
      p_assigned_station_id: assignedStationId ?? null,
      p_custom_permissions: customPermissions ?? null,
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Save DJ Harbor account association for a user.
 * The DJ password is no longer persisted to localStorage in plaintext.
 * It is only sent to the server profile for backend use, and even there
 * storage of raw credentials should be replaced by a token in the future.
 */
export async function saveAdminDjAccount(
  user: SynapseUser,
  djData: { username: string; password?: string; displayName?: string; stationShortcode?: string }
): Promise<SynapseUser> {
  const djAccount = {
    username: djData.username.trim(),
    displayName: djData.displayName?.trim() || djData.username.trim(),
    stationShortcode: djData.stationShortcode || 'synapse-main',
    linkedAt: Date.now(),
  };

  const updatedUser: SynapseUser = {
    ...user,
    djAccount: djAccount,
    isDjLinked: true,
  };

  saveStoredSynapseUser(updatedUser);
  localStorage.setItem('synapse_admin_dj_account', JSON.stringify(djAccount));

  if (user.id) {
    try {
      await supabase.from('profiles').update({
        dj_username: djAccount.username,
        dj_display_name: djAccount.displayName,
        dj_station: djAccount.stationShortcode,
        dj_linked_at: new Date().toISOString(),
      }).eq('id', user.id);
    } catch {}
  }

  return updatedUser;
}

/**
 * Unlink DJ account
 */
export async function unlinkAdminDjAccount(user: SynapseUser): Promise<SynapseUser> {
  const updatedUser: SynapseUser = {
    ...user,
    djAccount: null,
    isDjLinked: false,
  };

  saveStoredSynapseUser(updatedUser);
  localStorage.removeItem('synapse_admin_dj_account');

  if (user.id) {
    try {
      await supabase.from('profiles').update({
        dj_username: null,
        dj_password: null,
        dj_display_name: null,
        dj_station: null,
        dj_linked_at: null,
      }).eq('id', user.id);
    } catch {}
  }

  return updatedUser;
}

/**
 * Get linked DJ account
 */
export function getLinkedAdminDjAccount(user?: SynapseUser | null) {
  if (user?.djAccount) return user.djAccount;
  try {
    const raw = localStorage.getItem('synapse_admin_dj_account');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Fetch all registered users from Supabase profiles
 */
export async function fetchSupabaseUsers(): Promise<{ data: SynapseUser[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return { data: [], error: error?.message || 'Impossible de récupérer les utilisateurs' };
    }

    const users: SynapseUser[] = data.map((rec) => {
      const cleanEmail = (rec.email || '').trim().toLowerCase();
      let role: UserRole = 'user';
      if (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr' || rec.role === 'super-admin') {
        role = 'super-admin';
      } else if (rec.role === 'admin') {
        role = 'admin';
      }

      const djAccount = rec.dj_username ? {
        username: rec.dj_username,
        displayName: rec.dj_display_name || rec.dj_username,
        stationShortcode: rec.dj_station || 'synapse-main',
        linkedAt: rec.dj_linked_at ? new Date(rec.dj_linked_at).getTime() : Date.now(),
      } : null;

      return {
        id: rec.id,
        email: cleanEmail,
        username: rec.display_name || rec.username || cleanEmail.split('@')[0],
        firstName: rec.first_name,
        lastName: rec.last_name,
        displayName: rec.display_name || `${rec.first_name || ''} ${rec.last_name || ''}`.trim() || rec.username || cleanEmail.split('@')[0],
        role,
        adminProfileId: rec.admin_profile_id || (role === 'super-admin' ? 'profile_super_admin' : (role === 'admin' ? 'profile_general_admin' : 'profile_animateur')),
        assignedStationId: rec.assigned_station_id || 'all',
        customPermissions: rec.custom_permissions || undefined,
        avatarUrl: rec.avatar_url,
        createdAt: new Date(rec.created_at || Date.now()).getTime(),
        points: rec.points ?? 0,
        badges: rec.badges || [],
        authMethod: (rec.auth_method as any) || 'password',
        passkeyCredentialId: rec.passkey_credential_id,
        djAccount: djAccount,
        isDjLinked: !!djAccount,
      };
    });

    return { data: users, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Erreur réseau' };
  }
}
