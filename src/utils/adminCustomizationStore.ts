import { SidebarItemConfig, DashboardWidgetConfig } from '../types/adminCustomization';
import { pb } from '../lib/pocketbase';

const SIDEBAR_STORAGE_KEY = 'synapse_admin_sidebar_config_v3';
const DASHBOARD_STORAGE_KEY = 'synapse_admin_dashboard_widgets_v3';

const PB_KEY_SIDEBAR = 'admin_sidebar_layout_v3';
const PB_KEY_DASHBOARD = 'admin_dashboard_widgets_v3';

export const DEFAULT_SIDEBAR_ITEMS: SidebarItemConfig[] = [
  { id: 'dashboard', visible: true, order: 0 },
  { id: 'stations', visible: true, order: 1 },
  { id: 'programming', visible: true, order: 2 },
  { id: 'messages', visible: true, order: 3 },
  { id: 'events', visible: true, order: 4 },
  { id: 'challenges', visible: true, order: 5 },
  { id: 'promotions', visible: true, order: 6 },
  { id: 'users', visible: true, order: 7 },
  { id: 'services', visible: true, order: 8 },
];

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: 'kpi_overview',
    title: 'Indicateurs Clés & KPIs',
    description: 'Statistiques en direct des stations, auditeurs, messages et quêtes XP',
    size: 'full',
    density: 'normal',
    visible: true,
    order: 0,
  },
  {
    id: 'stations_monitor',
    title: 'Moniteur des Stations Radio & Écoute Rapide',
    description: 'État des flux, voyants d\'activité, écoute rapide au clic / appui maintenu et régie',
    size: 'half',
    density: 'normal',
    visible: true,
    order: 1,
  },
  {
    id: 'station_focus',
    title: 'Cockpit Station Dédiée (Animateur / DJ)',
    description: 'Accès rapide, jingles prioritaires, statut On-Air et raccourcis pour une radio choisie',
    size: 'half',
    density: 'normal',
    visible: true,
    order: 2,
  },
  {
    id: 'quick_actions',
    title: 'Raccourcis & Actions Rapides',
    description: 'Accès direct pour créer une station, lancer un direct, poster un défi ou un événement',
    size: 'full',
    density: 'compact',
    visible: true,
    order: 3,
  },
  {
    id: 'next_up_schedule',
    title: 'Grille On-Air & Prochaines Émissions',
    description: 'Émission actuellement à l\'antenne et programme suivant par station',
    size: 'third',
    density: 'normal',
    visible: true,
    order: 4,
  },
  {
    id: 'broadcast_quick_status',
    title: 'Direct Antenne & Liaison DJ',
    description: 'État de connexion du compte streamer AzuraCast et signal micro',
    size: 'third',
    density: 'normal',
    visible: true,
    order: 5,
  },
  {
    id: 'services_status',
    title: 'État des Services (AzuraCast & PocketBase)',
    description: 'Connectivité, latence, statut des bases et synchronisation',
    size: 'third',
    density: 'normal',
    visible: true,
    order: 6,
  },
  {
    id: 'recent_messages',
    title: 'Dédicaces & Messagerie Directe',
    description: 'Aperçu des derniers messages reçus au studio',
    size: 'half',
    density: 'normal',
    visible: true,
    order: 7,
  },
  {
    id: 'active_challenges',
    title: 'Défis & Quêtes Auditeurs',
    description: 'Défis communautaires en cours et récompenses XP',
    size: 'half',
    density: 'normal',
    visible: true,
    order: 8,
  },
  {
    id: 'community_users',
    title: 'Activité Communauté & Membres',
    description: 'Derniers auditeurs inscrits et profils administrateurs',
    size: 'third',
    density: 'normal',
    visible: true,
    order: 9,
  },
  {
    id: 'upcoming_events',
    title: 'Événements & Concerts en Direct',
    description: 'Prochaines dates programmées et billetterie',
    size: 'third',
    density: 'normal',
    visible: true,
    order: 10,
  },
  {
    id: 'promotions_partners',
    title: 'Offres & Codes Promo',
    description: 'Codes de réduction partenaires actifs',
    size: 'third',
    density: 'compact',
    visible: false,
    order: 11,
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

    // Persist to PocketBase synapse_admin_data in background
    persistCustomizationToPocketBase(PB_KEY_SIDEBAR, normalized);

    // If user is authenticated, also persist to their record
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      pb.collection('users').update(pb.authStore.record.id, {
        sidebar_layout: normalized,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Error saving sidebar order:', err);
  }
}

export function resetSidebarOrder(): SidebarItemConfig[] {
  try {
    localStorage.removeItem(SIDEBAR_STORAGE_KEY);
    persistCustomizationToPocketBase(PB_KEY_SIDEBAR, DEFAULT_SIDEBAR_ITEMS);
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

    // Ensure all default widgets exist in the array
    const existingIds = new Set(validParsed.map(w => w.id));
    const merged = [...validParsed];
    DEFAULT_DASHBOARD_WIDGETS.forEach((def) => {
      if (!existingIds.has(def.id)) {
        merged.push({ ...def, order: merged.length });
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

    // Persist to PocketBase synapse_admin_data in background
    persistCustomizationToPocketBase(PB_KEY_DASHBOARD, normalized);

    // If user is authenticated, also persist to their record
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      pb.collection('users').update(pb.authStore.record.id, {
        dashboard_layout: normalized,
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Error saving dashboard widgets:', err);
  }
}

export function resetDashboardWidgets(): DashboardWidgetConfig[] {
  try {
    localStorage.removeItem(DASHBOARD_STORAGE_KEY);
    persistCustomizationToPocketBase(PB_KEY_DASHBOARD, DEFAULT_DASHBOARD_WIDGETS);
  } catch {}
  return DEFAULT_DASHBOARD_WIDGETS;
}

/**
 * Helper to persist custom layouts to PocketBase synapse_admin_data
 */
async function persistCustomizationToPocketBase(key: string, payload: any): Promise<void> {
  try {
    const existing = await pb.collection('synapse_admin_data').getFirstListItem(`key = "${key}"`).catch(() => null);
    if (existing) {
      await pb.collection('synapse_admin_data').update(existing.id, { payload });
    } else {
      await pb.collection('synapse_admin_data').create({
        key,
        payload,
      });
    }
  } catch (err) {
    // Non-blocking catch
  }
}

/**
 * Fetch and synchronize customization layouts from PocketBase on app/drawer start
 */
export async function syncCustomizationsWithPocketBase(): Promise<{
  sidebar?: SidebarItemConfig[];
  dashboard?: DashboardWidgetConfig[];
}> {
  const result: { sidebar?: SidebarItemConfig[]; dashboard?: DashboardWidgetConfig[] } = {};

  try {
    // 1. Check user record first if authenticated
    if (pb.authStore.isValid && pb.authStore.record?.id) {
      try {
        const userRec: any = await pb.collection('users').getOne(pb.authStore.record.id);
        if (Array.isArray(userRec?.sidebar_layout) && userRec.sidebar_layout.length > 0) {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(userRec.sidebar_layout));
          result.sidebar = userRec.sidebar_layout;
        }
        if (Array.isArray(userRec?.dashboard_layout) && userRec.dashboard_layout.length > 0) {
          const filtered = userRec.dashboard_layout.filter((w: any) => w.id !== 'quick_audio_monitor');
          localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(filtered));
          result.dashboard = filtered;
        }
      } catch {}
    }

    // 2. If not found in user record, check global synapse_admin_data
    if (!result.sidebar) {
      try {
        const sidebarRec: any = await pb.collection('synapse_admin_data').getFirstListItem(`key = "${PB_KEY_SIDEBAR}"`);
        if (Array.isArray(sidebarRec?.payload) && sidebarRec.payload.length > 0) {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(sidebarRec.payload));
          result.sidebar = sidebarRec.payload;
        }
      } catch {}
    }

    if (!result.dashboard) {
      try {
        const dashRec: any = await pb.collection('synapse_admin_data').getFirstListItem(`key = "${PB_KEY_DASHBOARD}"`);
        if (Array.isArray(dashRec?.payload) && dashRec.payload.length > 0) {
          const filtered = dashRec.payload.filter((w: any) => w.id !== 'quick_audio_monitor');
          localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(filtered));
          result.dashboard = filtered;
        }
      } catch {}
    }
  } catch (err) {
    console.warn('PocketBase customization sync error:', err);
  }

  return result;
}
