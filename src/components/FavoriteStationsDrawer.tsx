import { useState } from 'react';
import { 
  Play, 
  Bell, 
  BellOff, 
  Radio, 
  Volume2,
  Star
} from 'lucide-react';
import { StreamChannel } from '../data';
import Drawer from './Drawer';
import { FavoriteStationSetting } from '../utils/favoriteStationsStorage';

interface FavoriteStationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteStations: FavoriteStationSetting[];
  onToggleFavorite: (stationId: string) => void;
  onToggleNotification: (stationId: string) => void;
  activeStream: StreamChannel;
  isPlaying: boolean;
  onSelectStation: (stream: StreamChannel) => void;
  availableStations?: StreamChannel[];
}

export default function FavoriteStationsDrawer({
  isOpen,
  onClose,
  favoriteStations,
  onToggleFavorite,
  onToggleNotification,
  activeStream,
  isPlaying,
  onSelectStation,
  availableStations,
}: FavoriteStationsDrawerProps) {
  const [filterMode, setFilterMode] = useState<'favorites' | 'all'>('favorites');

  const stationsToUse = availableStations || [];

  // Map favorite setting ids to full stationsToUse objects
  const favoritedStreamIds = new Set(favoriteStations.map((s) => s.stationId));
  const favoriteStreamsList = stationsToUse.filter((stream) => favoritedStreamIds.has(stream.id));

  return (
    <Drawer
      id="favorite-stations-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <Star className="w-5 h-5 fill-amber-400 text-amber-400 animate-pulse" />
          <span className="font-futuristic text-[11px] sm:text-xs font-bold uppercase tracking-widest text-white">
            STATIONS FAVORITES ({favoriteStations.length})
          </span>
        </div>
      }
      subtitle="Gérez vos radios préférées et vos préférences de notifications"
      maxWidthClass="max-w-2xl"
    >
      <div className="flex flex-col gap-5">
        
        {/* Banner with notification explanation */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/40 via-yellow-950/30 to-black/60 border border-amber-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 flex-shrink-0 mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-semibold text-white leading-snug flex items-center gap-1.5">
                Notifications personnalisées par station
              </span>
              <p className="text-[11px] text-zinc-300 font-mono mt-1 leading-relaxed">
                Activez ou désactivez les alertes pour chaque station afin de recevoir uniquement les notifications des directs et titres qui vous intéressent.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Favorites vs All Stations */}
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10 self-start">
          <button
            onClick={() => setFilterMode('favorites')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              filterMode === 'favorites'
                ? 'bg-amber-500/25 border border-amber-400/50 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Mes Favoris ({favoriteStations.length})</span>
          </button>

          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white/15 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-zinc-300" />
            <span>Toutes les Stations ({stationsToUse.length})</span>
          </button>
        </div>

        {/* Stations List */}
        <div className="flex flex-col gap-3">
          {filterMode === 'favorites' && favoriteStreamsList.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-sm font-bold text-white font-futuristic uppercase tracking-wider">
                Aucune station favorite
              </p>
              <p className="text-xs font-mono text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
                Cliquez sur l'étoile dorée au-dessus de la station sur le lecteur pour l'ajouter à vos favoris.
              </p>
              <button
                onClick={() => setFilterMode('all')}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold transition-all cursor-pointer"
              >
                Découvrir toutes les stations
              </button>
            </div>
          ) : filterMode === 'all' && stationsToUse.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <Radio className="w-8 h-8 text-zinc-500" />
              </div>
              <p className="text-sm font-bold text-white font-futuristic uppercase tracking-wider">
                Aucune station configurée
              </p>
              <p className="text-xs font-mono text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
                Aucune radio n'est actuellement enregistrée. Créez vos stations dans le Panel Administrateur pour les voir apparaître ici.
              </p>
            </div>
          ) : (
            (filterMode === 'favorites' ? favoriteStreamsList : stationsToUse).map((stream, idx) => {
              const isFav = favoritedStreamIds.has(stream.id);
              const favSetting = favoriteStations.find((s) => s.stationId === stream.id);
              const notifEnabled = favSetting ? favSetting.notificationsEnabled : false;
              const isActive = activeStream.id === stream.id;

              return (
                <div
                  key={`fav-station-${stream.id || 'stream'}-${idx}`}
                  className={`p-4 rounded-2xl bg-black/60 border transition-all duration-300 flex items-center justify-between gap-3 shadow-md ${
                    isActive
                      ? 'border-amber-400/60 bg-gradient-to-r from-amber-950/30 via-black/80 to-black/80 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  {/* Left: Station info & play */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    
                    {/* Stream Cover / Icon */}
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-white/15 flex-shrink-0 shadow-md">
                      <img
                        src={stream.tracks[0]?.coverUrl}
                        alt={stream.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={() => {
                          onSelectStation(stream);
                        }}
                        className={`absolute inset-0 flex items-center justify-center transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/30 text-amber-200'
                            : 'bg-black/40 hover:bg-black/60 text-white opacity-90'
                        }`}
                        title={isActive && isPlaying ? "En cours de lecture" : `Écouter ${stream.name}`}
                      >
                        {isActive && isPlaying ? (
                          <Volume2 className="w-5 h-5 text-amber-300 animate-pulse" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5 fill-current" />
                        )}
                      </button>
                    </div>

                    {/* Stream Details */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate block">
                          {stream.name.replace('Radio Synapse - ', '')}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex-shrink-0">
                            ON AIR
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-amber-400/90 font-bold uppercase tracking-wider block font-mono mt-0.5">
                        {stream.genre}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
                        {stream.description}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions: Notification Toggle + Favorite Star Toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    
                    {/* Notification Toggle Button (Only active if favorited) */}
                    {isFav && (
                      <button
                        onClick={() => onToggleNotification(stream.id)}
                        className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          notifEnabled
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                            : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300'
                        }`}
                        title={notifEnabled ? "Désactiver les notifications" : "Activer les notifications"}
                      >
                        {notifEnabled ? (
                          <Bell className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ) : (
                          <BellOff className="w-4 h-4 text-zinc-500" />
                        )}
                        <span className="hidden sm:inline text-[10px]">
                          {notifEnabled ? 'Notifs On' : 'Notifs Off'}
                        </span>
                      </button>
                    )}

                    {/* Favorite Star Button */}
                    <button
                      onClick={() => onToggleFavorite(stream.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        isFav
                          ? 'bg-amber-400 border-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-400 hover:text-amber-300'
                      }`}
                      title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-black text-black' : 'fill-none text-current'}`} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </Drawer>
  );
}
