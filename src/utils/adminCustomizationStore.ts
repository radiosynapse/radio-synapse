import { SidebarItemConfig, DashboardWidgetConfig } from '../types/adminCustomization';
import { supabase } from '../lib/supabase';

const SIDEBAR_STORAGE_KEY = 'synapse_admin_sidebar_config_v3';
const DASHBOARD_STORAGE_KEY = 'synapse_admin_dashboard_widgets_v4';

const SUPABASE_KEY_SIDEBAR = 'admin_sidebar_layout_v3';
const SUPABASE_KEY_DASHBOARD = 'admin_dashboard_widgets_v4';

export const DEFAULT_SIDEBAR_ITEMS: SidebarItemConfig[] = [
  { id: 'dashboard', visible: true, order: 0 },
  { id: 'stations_management', visible: true, order: 1 },
  { id: 'regie_animation', visible: true, order: 2 },
  { id: 'music_library', visible: true, order: 3 },
  { id: 'playlists', visible: true, order: 4 },
  { id: 'emission_prep', visible: true, order: 5 },
  { id: 'programming', visible: true, order: 6 },
  { id: 'messages', visible: true, order: 7 },
  { id: 'events', visible: true, order: 8 },
  { id: 'challenges', visible: true, order: 9 },
  { id: 'promotions', visible: true, order: 10 },
  { id: 'users', visible: true, order: 11 },
  { id: 'services', visible: true, order: 12 },
  { id: 'features', visible: true, order: 13 },
];

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: 'kpi_overview',
    title: 'Monitoring',
    description: 'Statistiques direct des flux, auditeurs, messages et défis',
    size: 'full',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 0,
  },
  {
    id: 'stations_monitor',
    title: 'Moniteur Stations',
    description: 'État des flux et écoute rapide en direct',
    size: 'wide',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 1,
  },
  {
    id: 'services_status',
    title: 'État Services',
    description: 'Connectivité, latence et synchronisation BDD',
    size: 'third',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 2,
  },
  {
    id: 'station_focus',
    title: 'Cockpit Animateur',
    description: 'Régie, jingles et raccourcis pour la radio sélectionnée',
    size: 'half',
    height: 'tall',
    density: 'normal',
    visible: true,
    order: 3,
  },
  {
    id: 'station_playlist_history',
    title: 'Titres À Venir & Passés',
    description: 'Queue d\'attente et historique de diffusion pour une radio choisie',
    size: 'half',
    height: 'tall',
    density: 'normal',
    visible: true,
    order: 4,
  },
  {
    id: 'recent_messages',
    title: 'Messages & Dédicaces',
    description: 'Derniers messages reçus des auditeurs',
    size: 'third',
    height: 'tall',
    density: 'normal',
    visible: true,
    order: 5,
  },
  {
    id: 'station_song_requests',
    title: 'Dédicaces & Demandes Station',
    description: 'Propositions de titres et dédicaces ciblées par radio',
    size: 'third',
    height: 'tall',
    density: 'normal',
    visible: true,
    order: 6,
  },
  {
    id: 'next_up_schedule',
    title: 'Grille On-Air',
    description: 'Émission en cours et programme suivant par station',
    size: 'third',
    height: 'tall',
    density: 'normal',
    visible: true,
    order: 7,
  },
  {
    id: 'station_live_controls',
    title: 'Régie & Jingles Station',
    description: 'Jingles prioritaires, contrôle direct et régie pour la station',
    size: 'half',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 8,
  },
  {
    id: 'station_stats_listeners',
    title: 'Audience & Métriques Station',
    description: 'Auditeurs live, pics d\'écoute et débit spécifique à la station',
    size: 'third',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 9,
  },
  {
    id: 'broadcast_quick_status',
    title: 'Direct Antenne',
    description: 'Connexion streamer direct et signal micro',
    size: 'third',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 10,
  },
  {
    id: 'quick_actions',
    title: 'Raccourcis Rapides',
    description: 'Création rapide de station, direct, défi ou événement',
    size: 'full',
    height: 'normal',
    density: 'compact',
    visible: true,
    order: 11,
  },
  {
    id: 'active_challenges',
    title: 'Défis Auditeurs',
    description: 'Défis en cours, propositions de musique et quêtes',
    size: 'half',
    height: 'tall',
    density: 'normal',
    visible: true,
    order: 12,
  },
  {
    id: 'community_users',
    title: 'Membres & Communauté',
    description: 'Derniers inscrits et profils administrateurs',
    size: 'third',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 13,
  },
  {
    id: 'upcoming_events',
    title: 'Événements',
    description: 'Prochains concerts et rendez-vous d\'antenne',
    size: 'third',
    height: 'normal',
    density: 'normal',
    visible: true,
    order: 14,
  },
  {
    id: 'promotions_partners',
    title: 'Codes Promo',
    description: 'Offres et codes promo à débloquer avec les points',
    size: 'third',
    height: 'normal',
    density: 'compact',
    visible: false,
    order: 15,
  },
];

export function getSavedSidebarOrder(): SidebarItemConfig[] {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return DEFAULT_SIDEBAR_ITEMS;
    const parsed = JSON.parse(raw) as SidebarItemConfig[];
    
    // Merge with any newly added default tabs if not present
    const existingIds = new Set(parsed.map(i => i.id));
    const merged = [...parsed];
    DEFAULT_SIDEBAR_ITEMS.forEach((def, index) => {
      if (!existingIds.has(def.id)) {
        merged.push({ ...def, visible: true, order: merged.length + index });
      }
    });

    // Ensure essential core admin tabs (users, services, dashboard) are not lost
    return merged.map(item => {
      if ((item.id === 'users' || item.id === 'services' || item.id === 'dashboard') && item.visible === undefined) {
        return { ...item, visible: true };
      }
      return item;
    }).sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_SIDEBAR_ITEMS;
  }
}

export function saveSidebarOrder(items: SidebarItemConfig[]): void {
  try {
    const normalized = items.map((item, idx) => ({ ...item, order: idx }));
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(normalized));

    // Persist to Supabase admin_customizations in background
    persistCustomizationToSupabase(SUPABASE_KEY_SIDEBAR, normalized);
  } catch (err) {
    console.error('Error saving sidebar order:', err);
  }
}

export function resetSidebarOrder(): SidebarItemConfig[] {
  try {
    localStorage.removeItem(SIDEBAR_STORAGE_KEY);
    persistCustomizationToSupabase(SUPABASE_KEY_SIDEBAR, DEFAULT_SIDEBAR_ITEMS);
  } catch {}
  return DEFAULT_SIDEBAR_ITEMS;
}

export function getSavedDashboardWidgets(): DashboardWidgetConfig[] {
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) return DEFAULT_DASHBOARD_WIDGETS;
    const parsed = JSON.parse(raw) as DashboardWidgetConfig[];

    // Filter out removed widgets like quick_audio_monitor
    const validParsed = parsed.filter(w => (w.id as string) !== 'quick_audio_monitor');

    // Ensure all default widgets exist in the array and have valid height
    const defaultMap = new Map(DEFAULT_DASHBOARD_WIDGETS.map(d => [d.id, d]));
    const existingIds = new Set(validParsed.map(w => w.id));
    const merged: DashboardWidgetConfig[] = validParsed.map(w => {
      const def = defaultMap.get(w.id);
      return {
        ...w,
        height: w.height || def?.height || 'normal',
      };
    });
    DEFAULT_DASHBOARD_WIDGETS.forEach((def) => {
      if (!existingIds.has(def.id)) {
        merged.push({ ...def, height: def.height || 'normal', order: merged.length });
      }
    });

    return merged.sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_DASHBOARD_WIDGETS;
  }
}

export function saveDashboardWidgets(widgets: DashboardWidgetConfig[]): void {
  try {
    const normalized = widgets.map((w, idx) => ({ ...w, order: idx }));
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(normalized));

    // Persist to Supabase in background
    persistCustomizationToSupabase(SUPABASE_KEY_DASHBOARD, normalized);
  } catch (err) {
    console.error('Error saving dashboard widgets:', err);
  }
}

export function resetDashboardWidgets(): DashboardWidgetConfig[] {
  try {
    localStorage.removeItem(DASHBOARD_STORAGE_KEY);
    persistCustomizationToSupabase(SUPABASE_KEY_DASHBOARD, DEFAULT_DASHBOARD_WIDGETS);
  } catch {}
  return DEFAULT_DASHBOARD_WIDGETS;
}

/**
 * Helper to persist custom layouts to Supabase admin_customizations
 */
async function persistCustomizationToSupabase(key: string, payload: any): Promise<void> {
  try {
    await supabase.from('admin_customizations').upsert({
      key,
      value: payload,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking catch
  }
}

/**
 * Fetch and synchronize customization layouts from Supabase on app/drawer start
 */
export async function syncCustomizationsWithSupabase(): Promise<{
  sidebar?: SidebarItemConfig[];
  dashboard?: DashboardWidgetConfig[];
}> {
  const result: { sidebar?: SidebarItemConfig[]; dashboard?: DashboardWidgetConfig[] } = {};

  try {
    const { data } = await supabase.from('admin_customizations').select('*');
    if (data && Array.isArray(data)) {
      const sidebarRow = data.find((r: any) => r.key === SUPABASE_KEY_SIDEBAR);
      if (sidebarRow?.value && Array.isArray(sidebarRow.value)) {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(sidebarRow.value));
        result.sidebar = sidebarRow.value;
      }
      const dashRow = data.find((r: any) => r.key === SUPABASE_KEY_DASHBOARD);
      if (dashRow?.value && Array.isArray(dashRow.value)) {
        const filtered = dashRow.value.filter((w: any) => w.id !== 'quick_audio_monitor');
        localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(filtered));
        result.dashboard = filtered;
      }
    }
  } catch (err) {
    console.warn('Supabase customization sync error:', err);
  }

  return result;
}
