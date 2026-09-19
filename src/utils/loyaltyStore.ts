import { SynapseUser, UserNotification } from '../types';
import { getStoredSynapseUser, saveStoredSynapseUser } from './supabaseAuthService';

const LOYALTY_STORAGE_KEY = 'synapse_user_loyalty_points_v2';
const NOTIFICATIONS_STORAGE_KEY = 'synapse_user_notifications_v2';
const PURCHASED_PROMOS_KEY = 'synapse_purchased_promos_v2';

// In-memory / localStorage cache for points by userId
function getPointsMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOYALTY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePointsMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(LOYALTY_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function getUserPoints(user?: SynapseUser | null): number {
  const activeUser = user || getStoredSynapseUser();
  if (!activeUser) return 0;

  const map = getPointsMap();
  const userId = activeUser.id || activeUser.email;
  if (typeof map[userId] === 'number') {
    return map[userId];
  }

  // Initial welcome points for a registered member
  const initial = typeof activeUser.points === 'number' ? activeUser.points : 250;
  map[userId] = initial;
  savePointsMap(map);
  return initial;
}

export function addPointsToUser(userId: string, points: number, reason: string): number {
  if (!userId || points <= 0) return 0;
  const map = getPointsMap();
  const current = map[userId] ?? 250;
  const updated = current + points;
  map[userId] = updated;
  savePointsMap(map);

  // Update stored user if active
  const stored = getStoredSynapseUser();
  if (stored && (stored.id === userId || stored.email === userId)) {
    stored.points = updated;
    saveStoredSynapseUser(stored);
  }

  // Add notification
  notifyUser(userId, {
    title: `+${points} Points Gagnés !`,
    message: reason,
    type: 'points_earned',
    points,
  });

  // Dispatch global event for instant UI reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('synapse_points_changed', { 
      detail: { userId, points: updated, delta: points, reason } 
    }));
  }

  return updated;
}

export function spendUserPoints(userId: string, points: number, promoId: string): boolean {
  if (!userId || points <= 0) return false;
  const map = getPointsMap();
  const current = map[userId] ?? 250;
  if (current < points) return false;

  const updated = current - points;
  map[userId] = updated;
  savePointsMap(map);

  // Save purchased promo for this user
  try {
    const raw = localStorage.getItem(PURCHASED_PROMOS_KEY);
    const purchased: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    const userPromos = purchased[userId] || [];
    if (!userPromos.includes(promoId)) {
      userPromos.push(promoId);
      purchased[userId] = userPromos;
      localStorage.setItem(PURCHASED_PROMOS_KEY, JSON.stringify(purchased));
    }
  } catch {}

  // Update active user in storage
  const stored = getStoredSynapseUser();
  if (stored && (stored.id === userId || stored.email === userId)) {
    stored.points = updated;
    stored.purchasedPromoCodes = stored.purchasedPromoCodes || [];
    if (!stored.purchasedPromoCodes.includes(promoId)) {
      stored.purchasedPromoCodes.push(promoId);
    }
    saveStoredSynapseUser(stored);
  }

  // Notify user
  notifyUser(userId, {
    title: 'Code Promo Débloqué !',
    message: `Vous avez échangé ${points} points pour ce code promo.`,
    type: 'promo_purchased',
    points: -points,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('synapse_points_changed', { 
      detail: { userId, points: updated, delta: -points, promoId } 
    }));
  }

  return true;
}

export function isPromoPurchasedByUser(userId: string, promoId: string): boolean {
  if (!userId || !promoId) return false;
  try {
    const raw = localStorage.getItem(PURCHASED_PROMOS_KEY);
    const purchased: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    const userPromos = purchased[userId] || [];
    return userPromos.includes(promoId);
  } catch {
    return false;
  }
}

// Notifications management
export function getUserNotifications(userId: string): UserNotification[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function notifyUser(
  userId: string,
  notification: Omit<UserNotification, 'id' | 'timestamp' | 'read'>
): void {
  if (!userId) return;
  try {
    const list = getUserNotifications(userId);
    const newNotif: UserNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...notification,
      timestamp: Date.now(),
      read: false,
    };
    const updated = [newNotif, ...list].slice(0, 50);
    localStorage.setItem(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('synapse_user_notification', { detail: newNotif }));
    }
  } catch {}
}

export function markNotificationsAsRead(userId: string): void {
  if (!userId) return;
  try {
    const list = getUserNotifications(userId);
    const updated = list.map((n) => ({ ...n, read: true }));
    localStorage.setItem(`${NOTIFICATIONS_STORAGE_KEY}_${userId}`, JSON.stringify(updated));
  } catch {}
}
