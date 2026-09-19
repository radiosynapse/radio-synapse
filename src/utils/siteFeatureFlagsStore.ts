import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Trophy, 
  Tag, 
  CalendarDays, 
  Calendar, 
  Disc3, 
  Mail, 
  Sliders, 
  Cast, 
  Sparkles, 
  History,
  Music2
} from 'lucide-react';
import { AdminTab } from '../types/adminCustomization';

export type SiteFeatureId =
  | 'challenges'
  | 'promotions'
  | 'events'
  | 'programming'
  | 'webdj'
  | 'messages'
  | 'equalizer'
  | 'cast'
  | 'minidisc_stories'
  | 'history_replay'
  | 'song_requests';

export interface SiteFeatureDefinition {
  id: SiteFeatureId;
  name: string;
  category: 'audience' | 'interactive' | 'audio' | 'community';
  description: string;
  defaultEnabled: boolean;
  icon: any;
  color: string;
  associatedAdminTab?: AdminTab;
  userFacingLocations: string[];
}

export const SITE_FEATURES_CATALOG: SiteFeatureDefinition[] = [
  {
    id: 'challenges',
    name: 'Défis & Quêtes Auditeurs',
    category: 'community',
    description: 'Système de gamification, quêtes quotidiennes, points d\'expérience (XP), trophées et récompenses fidélité.',
    defaultEnabled: false, // User explicitly requested challenges to be disabled in v1
    icon: Trophy,
    color: 'text-amber-400',
    associatedAdminTab: 'challenges',
    userFacingLocations: ['Menu Principal', 'Tiroir Compagnon', 'Profil Auditeur', 'Tableau de Bord Admin'],
  },
  {
    id: 'promotions',
    name: 'Boutique & Partenaires',
    category: 'community',
    description: 'Bons plans, codes promo auditeurs, réductions exclusives, boutique de goodies et partenariats.',
    defaultEnabled: true,
    icon: Tag,
    color: 'text-emerald-400',
    associatedAdminTab: 'promotions',
    userFacingLocations: ['Menu Principal', 'Tiroir Compagnon', 'Tableau de Bord Admin'],
  },
  {
    id: 'events',
    name: 'Événements & Agenda Lives',
    category: 'audience',
    description: 'Calendrier des concerts, festivals, directs délocalisés et billetterie partenaire.',
    defaultEnabled: true,
    icon: CalendarDays,
    color: 'text-rose-400',
    associatedAdminTab: 'events',
    userFacingLocations: ['Menu Principal', 'Bannière Live', 'Tableau de Bord Admin'],
  },
  {
    id: 'programming',
    name: 'Grille TV / Radio & Émissions',
    category: 'audience',
    description: 'Planning des émissions hebdomadaires, fiches animateurs, podcasts et alertes de début d\'émission.',
    defaultEnabled: true,
    icon: Calendar,
    color: 'text-purple-400',
    associatedAdminTab: 'programming',
    userFacingLocations: ['Menu Principal', 'Tiroir Compagnon', 'Lecteur MiniDisc', 'Tableau de Bord Admin'],
  },
  {
    id: 'webdj',
    name: 'Studio WebDJ en Direct',
    category: 'audio',
    description: 'Platines virtuelles dans le navigateur, pad de bruitages/jingles et micro pour animateurs à distance.',
    defaultEnabled: true,
    icon: Disc3,
    color: 'text-cyan-400',
    userFacingLocations: ['Cockpit Animateur', 'Régie Direct'],
  },
  {
    id: 'messages',
    name: 'Messagerie & Dédicaces Studio',
    category: 'interactive',
    description: 'Formulaire d\'envoi de dédicaces, messages en direct aux animateurs et modération studio.',
    defaultEnabled: true,
    icon: Mail,
    color: 'text-pink-400',
    associatedAdminTab: 'messages',
    userFacingLocations: ['Menu Principal', 'Bouton Dédicace', 'Tableau de Bord Admin'],
  },
  {
    id: 'equalizer',
    name: 'Égaliseur DSP Studio 10 Bandes',
    category: 'audio',
    description: 'Traitement audio numérique avec 7 presets (Bass Boost, Vocal, Club, Jazz) et réglage custom.',
    defaultEnabled: true,
    icon: Sliders,
    color: 'text-violet-400',
    userFacingLocations: ['Menu Compagnon', 'Lecteur Principal'],
  },
  {
    id: 'cast',
    name: 'Diffusion Sans Fil (Cast & AirPlay)',
    category: 'audio',
    description: 'Compatibilité Google Cast, Chromecast et périphériques audio sans fil du réseau local.',
    defaultEnabled: true,
    icon: Cast,
    color: 'text-blue-400',
    userFacingLocations: ['Bouton Cast Lecteur', 'Menu Compagnon'],
  },
  {
    id: 'minidisc_stories',
    name: 'Générateur de Stories MiniDisc',
    category: 'interactive',
    description: 'Création et export de visuels animés format story 9:16 avec jaquette, spectre audio et QR code.',
    defaultEnabled: true,
    icon: Sparkles,
    color: 'text-amber-300',
    userFacingLocations: ['Partage Titre', 'Bouton Flyer Lecteur'],
  },
  {
    id: 'history_replay',
    name: 'Replay & Historique 15 Minutes',
    category: 'interactive',
    description: 'Buffer de décalage temporel permettant de réécouter les 15 dernières minutes de direct.',
    defaultEnabled: true,
    icon: History,
    color: 'text-sky-400',
    userFacingLocations: ['Tiroir Compagnon', 'Barre de Progression Lecteur'],
  },
  {
    id: 'song_requests',
    name: 'Demandes de Titres Liquidsoap',
    category: 'interactive',
    description: 'Moteur de vote et sélection de titres par les auditeurs injecté directement dans la file Liquidsoap.',
    defaultEnabled: true,
    icon: Music2,
    color: 'text-indigo-400',
    userFacingLocations: ['Recherche Catalogue', 'Régie AutoDJ'],
  },
];

const STORAGE_KEY = 'synapse_site_features_v1';
const EVENT_NAME = 'synapse_features_changed';

/**
 * Get initial state of feature flags from localStorage or catalog defaults
 */
export function getSiteFeatureFlags(): Record<SiteFeatureId, boolean> {
  const defaults: Record<SiteFeatureId, boolean> = {} as any;
  SITE_FEATURES_CATALOG.forEach((item) => {
    defaults[item.id] = item.defaultEnabled;
  });

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    console.error('Error reading feature flags from storage:', e);
  }

  return defaults;
}

/**
 * Update a specific feature flag
 */
export function setSiteFeatureFlag(featureId: SiteFeatureId, enabled: boolean): void {
  try {
    const current = getSiteFeatureFlags();
    const updated = { ...current, [featureId]: enabled };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));

    // Supabase background sync
    supabase.from('site_feature_flags').upsert({
      key: featureId,
      name: featureId,
      enabled,
      updated_at: new Date().toISOString(),
    }).then(() => {});
  } catch (e) {
    console.error('Error saving feature flag:', e);
  }
}

/**
 * Toggle a specific feature flag
 */
export function toggleSiteFeatureFlag(featureId: SiteFeatureId): boolean {
  const current = getSiteFeatureFlags();
  const newState = !current[featureId];
  setSiteFeatureFlag(featureId, newState);
  return newState;
}

/**
 * Batch update multiple feature flags
 */
export function updateSiteFeatureFlags(updates: Partial<Record<SiteFeatureId, boolean>>): void {
  try {
    const current = getSiteFeatureFlags();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));

    // Batch upsert to Supabase
    const rows = Object.entries(updates).map(([key, enabled]) => ({
      key,
      name: key,
      enabled,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      supabase.from('site_feature_flags').upsert(rows).then(() => {});
    }
  } catch (e) {
    console.error('Error saving feature flags batch:', e);
  }
}

/**
 * Reset all feature flags to factory default
 */
export function resetSiteFeatureFlags(): void {
  try {
    const defaults: Record<SiteFeatureId, boolean> = {} as any;
    SITE_FEATURES_CATALOG.forEach((item) => {
      defaults[item.id] = item.defaultEnabled;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: defaults }));
  } catch (e) {
    console.error('Error resetting feature flags:', e);
  }
}

/**
 * Fast synchronous check if a feature is enabled
 */
export function isSiteFeatureEnabled(featureId: SiteFeatureId): boolean {
  const flags = getSiteFeatureFlags();
  return flags[featureId] ?? true;
}

/**
 * React hook to reactively track site feature flags
 */
export function useSiteFeatureFlags(): {
  flags: Record<SiteFeatureId, boolean>;
  isFeatureEnabled: (id: SiteFeatureId) => boolean;
  setFlag: (id: SiteFeatureId, enabled: boolean) => void;
  toggleFlag: (id: SiteFeatureId) => boolean;
  resetFlags: () => void;
} {
  const [flags, setFlags] = useState<Record<SiteFeatureId, boolean>>(() => getSiteFeatureFlags());

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<SiteFeatureId, boolean>>;
      if (customEvent.detail) {
        setFlags(customEvent.detail);
      } else {
        setFlags(getSiteFeatureFlags());
      }
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return {
    flags,
    isFeatureEnabled: (id: SiteFeatureId) => flags[id] ?? true,
    setFlag: setSiteFeatureFlag,
    toggleFlag: toggleSiteFeatureFlag,
    resetFlags: resetSiteFeatureFlags,
  };
}
