import { AdminPermissions, AdminProfileTemplate, SynapseUser } from '../types';
import { AdminTab } from '../types/adminCustomization';
import { supabase } from '../lib/supabase';
import { getStoredSynapseUser } from './supabaseAuthService';

const PROFILES_STORAGE_KEY = 'synapse_admin_profiles_templates_v1';
const PB_KEY_PROFILES = 'admin_profiles_templates_v1';

export const DEFAULT_ADMIN_PROFILES: AdminProfileTemplate[] = [
  {
    id: 'profile_super_admin',
    name: 'Super Administrateur',
    badge: 'SUPER ADMIN',
    description: 'Accès total à toute la plateforme, gestion des rôles, bases de données et services.',
    color: '#00f2ff',
    permissions: {
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
      station_restriction: 'all',
    },
  },
  {
    id: 'profile_general_admin',
    name: 'Administrateur Général',
    badge: 'ADMIN',
    description: 'Gestion des contenus opérationnels (stations, grille, dédicaces, événements, défis).',
    color: '#3b82f6',
    permissions: {
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
    },
  },
  {
    id: 'profile_animateur',
    name: 'Animateur Radio / DJ',
    badge: 'ANIMATEUR',
    description: 'Prise d\'antenne en direct, accès régie AzuraCast, lecture des dédicaces et grille des émissions.',
    color: '#10b981',
    permissions: {
      can_access_dashboard: true,
      can_manage_stations: true,
      can_broadcast_live: true,
      can_manage_services: false,
      can_manage_users: false,
      can_manage_messages: true,
      can_manage_programming: true,
      can_manage_events: true,
      can_manage_challenges: false,
      can_manage_promotions: false,
      can_manage_database: false,
      station_restriction: 'all',
    },
  },
  {
    id: 'profile_podcasteur',
    name: 'Podcasteur & Chroniqueur',
    badge: 'PODCASTEUR',
    description: 'Gestion des événements lives, épisodes podcast, programmation et contact auditeurs.',
    color: '#a855f7',
    permissions: {
      can_access_dashboard: true,
      can_manage_stations: false,
      can_broadcast_live: false,
      can_manage_services: false,
      can_manage_users: false,
      can_manage_messages: true,
      can_manage_programming: true,
      can_manage_events: true,
      can_manage_challenges: false,
      can_manage_promotions: false,
      can_manage_database: false,
      station_restriction: 'all',
    },
  },
  {
    id: 'profile_technicien',
    name: 'Technicien Régie & Flux',
    badge: 'RÉGIE / TECH',
    description: 'Contrôle des flux audio, configuration AzuraCast, liaison DJ et moniteur audio en direct.',
    color: '#f59e0b',
    permissions: {
      can_access_dashboard: true,
      can_manage_stations: true,
      can_broadcast_live: true,
      can_manage_services: true,
      can_manage_users: false,
      can_manage_messages: false,
      can_manage_programming: true,
      can_manage_events: false,
      can_manage_challenges: false,
      can_manage_promotions: false,
      can_manage_database: false,
      station_restriction: 'all',
    },
  },
  {
    id: 'profile_moderateur',
    name: 'Modérateur Messagerie & Défis',
    badge: 'MODÉRATEUR',
    description: 'Gestion des dédicaces reçues au studio, validation des messages et animation des défis auditeurs.',
    color: '#ec4899',
    permissions: {
      can_access_dashboard: true,
      can_manage_stations: false,
      can_broadcast_live: false,
      can_manage_services: false,
      can_manage_users: false,
      can_manage_messages: true,
      can_manage_programming: false,
      can_manage_events: false,
      can_manage_challenges: true,
      can_manage_promotions: false,
      can_manage_database: false,
      station_restriction: 'all',
    },
  },
  {
    id: 'profile_programmateur',
    name: 'Programmateur Musical',
    badge: 'PROGRAMMATEUR',
    description: 'Gestion des stations radios, de la grille des programmes et des partenariats / promotions.',
    color: '#6366f1',
    permissions: {
      can_access_dashboard: true,
      can_manage_stations: true,
      can_broadcast_live: false,
      can_manage_services: false,
      can_manage_users: false,
      can_manage_messages: false,
      can_manage_programming: true,
      can_manage_events: true,
      can_manage_challenges: true,
      can_manage_promotions: true,
      can_manage_database: false,
      station_restriction: 'all',
    },
  },
  {
    id: 'profile_invite',
    name: 'Invité Antenne',
    badge: 'INVITÉ',
    description: 'Accès restreint au micro et direct régie lors d\'un passage à l\'antenne.',
    color: '#14b8a6',
    permissions: {
      can_access_dashboard: true,
      can_manage_stations: false,
      can_broadcast_live: true,
      can_manage_services: false,
      can_manage_users: false,
      can_manage_messages: false,
      can_manage_programming: false,
      can_manage_events: false,
      can_manage_challenges: false,
      can_manage_promotions: false,
      can_manage_database: false,
      station_restriction: 'all',
    },
  },
];

/**
 * Get all configured admin profile templates
 */
export function getAdminProfileTemplates(): AdminProfileTemplate[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_PROFILES;
    const parsed = JSON.parse(raw) as AdminProfileTemplate[];
    
    // Ensure all default templates exist
    const existingIds = new Set(parsed.map(p => p.id));
    const merged = [...parsed];
    DEFAULT_ADMIN_PROFILES.forEach(def => {
      if (!existingIds.has(def.id)) {
        merged.push(def);
      }
    });
    return merged;
  } catch {
    return DEFAULT_ADMIN_PROFILES;
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
    return true; // Standalone admin panel session fallback
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
  if (!user) return true;
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
  const matchedTemplate = templates.find(t => t.id === profileId) || templates[1] || DEFAULT_ADMIN_PROFILES[1];

  const basePermissions: AdminPermissions = { ...matchedTemplate.permissions };

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
 * Check if a user has access to a specific admin tab
 */
export function canUserAccessTab(user: SynapseUser | null, tab: AdminTab): boolean {
  if (tab === 'features') {
    return isSuperAdmin(user);
  }
  if (isSuperAdmin(user)) return true;
  if (!isAdminOrAbove(user)) return false;

  const perms = getUserEffectivePermissions(user);

  switch (tab) {
    case 'dashboard':
      return perms.can_access_dashboard;
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
    case 'azuracast':
      return perms.can_manage_services || perms.can_broadcast_live;
    case 'database':
      return perms.can_manage_database;
    default:
      return true;
  }
}
