import { AdminPermissions, AdminProfileTemplate, SynapseUser } from '../types';
import { AdminTab } from '../types/adminCustomization';
import { supabase } from '../lib/supabase';
import { getStoredSynapseUser } from './supabaseAuthService';

const PROFILES_STORAGE_KEY = 'synapse_admin_profiles_templates_v1';
const PB_KEY_PROFILES = 'admin_profiles_templates_v1';

export const DEFAULT_ADMIN_PROFILES: AdminProfileTemplate[] = [];

/**
 * Get all configured admin profile templates
 */
export function getAdminProfileTemplates(): AdminProfileTemplate[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminProfileTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save updated admin profile templates
 */
export function saveAdminProfileTemplates(templates: AdminProfileTemplate[]): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(templates));
    
    // Persist to Supabase in background
    supabase.from('synapse_admin_data').upsert({
      key: PB_KEY_PROFILES,
      payload: templates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(() => {});
  } catch (err) {
    console.error('Error saving profile templates:', err);
  }
}

/**
 * Reset admin profiles to default presets
 */
export function resetAdminProfileTemplates(): AdminProfileTemplate[] {
  try {
    localStorage.removeItem(PROFILES_STORAGE_KEY);
  } catch {}
  return DEFAULT_ADMIN_PROFILES;
}

/**
 * Check if the active user is a Super Administrator
 */
export function isSuperAdmin(user: SynapseUser | null): boolean {
  const active = user || getStoredSynapseUser();
  if (!active) {
    return false;
  }

  const cleanEmail = (active.email || '').toLowerCase().trim();
  // If user role is 'super-admin' or email is admin master
  if (active.role === 'super-admin') return true;
  if (active.adminProfileId === 'profile_super_admin') return true;
  if (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr') return true;
  // If user is admin with no restrictive profile set, treat as super admin by default
  if (active.role === 'admin' && (!active.adminProfileId || active.adminProfileId === 'profile_super_admin' || active.adminProfileId === 'profile_general_admin')) return true;
  return false;
}

/**
 * Check if user has admin privileges
 */
export function isAdminOrAbove(user: SynapseUser | null): boolean {
  if (!user) return false;
  if (user.role === 'user') {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    if (cleanEmail === 'adminradiosynapse@gmail.com' || cleanEmail === 'admin@radiosynapse.fr') return true;
    return false;
  }
  return user.role === 'super-admin' || user.role === 'admin' || isSuperAdmin(user);
}

/**
 * Calculate the effective permissions for a user based on their role, associated profile, and overrides
 */
export function getUserEffectivePermissions(user: SynapseUser | null): AdminPermissions {
  // If super-admin, full permissions
  if (isSuperAdmin(user)) {
    return {
      can_access_dashboard: true,
      can_manage_stations: true,
      can_broadcast_live: true,
      can_manage_services: true,
      can_manage_users: true,
      can_manage_messages: true,
      can_manage_programming: true,
      can_manage_events: true,
      can_manage_challenges: true,
      can_manage_promotions: true,
      can_manage_database: true,
      station_restriction: user?.assignedStationId || 'all',
    };
  }

  // If standard user, no admin permissions
  if (!user || user.role === 'user') {
    return {
      can_access_dashboard: false,
      can_manage_stations: false,
      can_broadcast_live: false,
      can_manage_services: false,
      can_manage_users: false,
      can_manage_messages: false,
      can_manage_programming: false,
      can_manage_events: false,
      can_manage_challenges: false,
      can_manage_promotions: false,
      can_manage_database: false,
      station_restriction: 'none',
    };
  }

  // For Admin role: look up associated profile template
  const templates = getAdminProfileTemplates();
  const profileId = user.adminProfileId || 'profile_general_admin';
  const matchedTemplate = templates.find(t => t.id === profileId);

  const defaultAdminPermissions: AdminPermissions = {
    can_access_dashboard: true,
    can_manage_stations: true,
    can_broadcast_live: true,
    can_manage_services: false,
    can_manage_users: false,
    can_manage_messages: true,
    can_manage_programming: true,
    can_manage_events: true,
    can_manage_challenges: true,
    can_manage_promotions: true,
    can_manage_database: false,
    station_restriction: 'all',
  };

  const basePermissions: AdminPermissions = matchedTemplate
    ? { ...matchedTemplate.permissions }
    : defaultAdminPermissions;

  // Apply custom permissions overrides if present
  if (user.customPermissions) {
    Object.assign(basePermissions, user.customPermissions);
  }

  if (user.assignedStationId) {
    basePermissions.station_restriction = user.assignedStationId;
  }

  return basePermissions;
}

/**
 * Get the list of stations accessible to a user.
 * - Super-Admin: Has unrestricted access to all stations.
 * - Delegated Admin: Only has access to stations assigned to them by Super-Admin (single or multiple).
 */
export function getUserAssignedStations<T extends { id: string }>(user: SynapseUser | null, allStations: T[]): T[] {
  if (isSuperAdmin(user)) {
    return allStations;
  }
  if (!user || user.role === 'user') {
    return [];
  }

  // Check array of assigned station IDs first, fallback to legacy single string
  const assignedIds = new Set<string>();
  if (Array.isArray(user.assignedStationIds) && user.assignedStationIds.length > 0) {
    user.assignedStationIds.forEach(id => assignedIds.add(id));
  } else if (user.assignedStationId && user.assignedStationId !== 'none') {
    assignedIds.add(user.assignedStationId);
  }

  // If set to 'all' or no restriction specified on an admin account, return all stations
  if (assignedIds.has('all') || assignedIds.size === 0) {
    return allStations;
  }

  const filtered = allStations.filter(st => assignedIds.has(st.id));
  return filtered.length > 0 ? filtered : (allStations.slice(0, 1));
}

/**
 * Check if the user is allowed to switch between stations.
 * - Super Admin can always switch between all stations.
 * - Delegated Admin with multiple assigned stations can switch between their assigned stations only.
 * - Delegated Admin with 1 station is locked to that single station.
 */
export function canUserSwitchStations<T extends { id: string }>(user: SynapseUser | null, allStations: T[]): boolean {
  if (isSuperAdmin(user)) return true;
  const accessible = getUserAssignedStations(user, allStations);
  return accessible.length > 1;
}

/**
 * Check if the user has permission to create, edit core infrastructure, or delete stations.
 * Strictly reserved to Super-Admin!
 */
export function canUserManageStationInfrastructure(user: SynapseUser | null): boolean {
  return isSuperAdmin(user);
}

/**
 * Check if a user has access to a specific admin tab
 */
export function canUserAccessTab(user: SynapseUser | null, tab: AdminTab): boolean {
  if (isSuperAdmin(user)) return true;
  if (!isAdminOrAbove(user)) return false;

  // Tabs strictly reserved for super-admin
  if (tab === 'features' || tab === 'stations_management') {
    return false;
  }

  const perms = getUserEffectivePermissions(user);

  switch (tab) {
    case 'dashboard':
      return perms.can_access_dashboard;
    case 'regie_animation':
      return perms.can_broadcast_live || perms.can_manage_stations;
    case 'music_library':
      return perms.can_manage_stations || perms.can_manage_programming || perms.can_broadcast_live;
    case 'playlists':
      return perms.can_manage_stations || perms.can_manage_programming;
    case 'emission_prep':
      return perms.can_manage_programming || perms.can_broadcast_live;
    case 'stations':
      return perms.can_manage_stations || perms.can_broadcast_live;
    case 'services':
      return perms.can_manage_services;
    case 'users':
      return perms.can_manage_users;
    case 'messages':
      return perms.can_manage_messages;
    case 'programming':
      return perms.can_manage_programming;
    case 'events':
      return perms.can_manage_events;
    case 'challenges':
      return perms.can_manage_challenges;
    case 'promotions':
      return perms.can_manage_promotions;
    case 'streaming':
      return perms.can_manage_services || perms.can_broadcast_live;
    case 'database':
      return perms.can_manage_database;
    default:
      return true;
  }
}
