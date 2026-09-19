import { supabase } from '../lib/supabase';

export const EVENT_REALTIME_STATIONS = 'synapse:realtime:stations';
export const EVENT_REALTIME_CHALLENGES = 'synapse:realtime:challenges';
export const EVENT_REALTIME_PROMOTIONS = 'synapse:realtime:promotions';
export const EVENT_REALTIME_EVENTS = 'synapse:realtime:events';
export const EVENT_REALTIME_MESSAGES = 'synapse:realtime:messages';
export const EVENT_REALTIME_FLAGS = 'synapse:realtime:flags';
export const EVENT_REALTIME_CUSTOMIZATIONS = 'synapse:realtime:customizations';

let isSubscribed = false;

/**
 * Initializes Supabase Realtime Channels for automatic live data synchronization
 */
export function initSupabaseRealtimeSubscriptions() {
  if (isSubscribed) return;
  isSubscribed = true;

  try {
    const channel = supabase
      .channel('synapse-live-broadcast')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stations' },
        (payload) => {
          window.dispatchEvent(new CustomEvent(EVENT_REALTIME_STATIONS, { detail: payload }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challenges' },
        (payload) => {
          window.dispatchEvent(new CustomEvent(EVENT_REALTIME_CHALLENGES, { detail: payload }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promotions' },
        (payload) => {
          window.dispatchEvent(new CustomEvent(EVENT_REALTIME_PROMOTIONS, { detail: payload }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          window.dispatchEvent(new CustomEvent(EVENT_REALTIME_EVENTS, { detail: payload }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          window.dispatchEvent(new CustomEvent(EVENT_REALTIME_MESSAGES, { detail: payload }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_feature_flags' },
        (payload) => {
          window.dispatchEvent(new CustomEvent(EVENT_REALTIME_FLAGS, { detail: payload }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_customizations' },
        (payload) => {
          window.dispatchEvent(new CustomEvent(EVENT_REALTIME_CUSTOMIZATIONS, { detail: payload }));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Écoute active sur toutes les tables de Radio Synapse.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      isSubscribed = false;
    };
  } catch (err) {
    console.error('[Supabase Realtime] Erreur initialisation:', err);
  }
}
