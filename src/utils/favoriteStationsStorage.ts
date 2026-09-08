export interface FavoriteStationSetting {
  stationId: string;
  notificationsEnabled: boolean;
  addedAt: number;
}

const FAVORITE_STATIONS_KEY = 'radio_synapse_favorite_stations_v1';

export function getFavoriteStations(): FavoriteStationSetting[] {
  try {
    const raw = localStorage.getItem(FAVORITE_STATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavoriteStations(items: FavoriteStationSetting[]): void {
  try {
    localStorage.setItem(FAVORITE_STATIONS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save favorite stations', e);
  }
}

export function isStationFavorite(stationId: string): boolean {
  const list = getFavoriteStations();
  return list.some((s) => s.stationId === stationId);
}

export function isStationNotificationEnabled(stationId: string): boolean {
  const list = getFavoriteStations();
  const found = list.find((s) => s.stationId === stationId);
  return found ? found.notificationsEnabled : false;
}

export function toggleFavoriteStation(stationId: string): { list: FavoriteStationSetting[]; isFav: boolean } {
  const list = getFavoriteStations();
  const index = list.findIndex((s) => s.stationId === stationId);
  let updated: FavoriteStationSetting[];
  let isFav = false;

  if (index >= 0) {
    // Remove from favorites
    updated = list.filter((s) => s.stationId !== stationId);
    isFav = false;
  } else {
    // Add to favorites with notifications enabled by default
    updated = [
      ...list,
      {
        stationId,
        notificationsEnabled: true,
        addedAt: Date.now(),
      },
    ];
    isFav = true;
  }

  saveFavoriteStations(updated);
  return { list: updated, isFav };
}

export function toggleStationNotification(stationId: string, enabled?: boolean): FavoriteStationSetting[] {
  const list = getFavoriteStations();
  const updated = list.map((s) => {
    if (s.stationId === stationId) {
      const newSetting = enabled !== undefined ? enabled : !s.notificationsEnabled;
      return { ...s, notificationsEnabled: newSetting };
    }
    return s;
  });
  saveFavoriteStations(updated);
  return updated;
}
