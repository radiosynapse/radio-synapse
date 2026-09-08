import { 
  Radio, Sliders, History, Heart, Star, Cast, 
  Timer, Moon, Volume2, Check, ArrowRight 
} from 'lucide-react';
import { StreamChannel } from '../data';
import Drawer from './Drawer';

interface CompanionMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeStream: StreamChannel;
  isPlaying: boolean;
  likedTracksCount: number;
  favoriteStationsCount: number;
  quality: 'low' | 'medium' | 'high';
  onSetQuality: (q: 'low' | 'medium' | 'high') => void;
  sleepTimerMinutes: number | null;
  sleepTimerRemaining: number | null; // seconds
  onSetSleepTimer: (minutes: number | null) => void;
  onOpenStations: () => void;
  onOpenFavoriteStations: () => void;
  onOpenLikedTracks: () => void;
  onOpenHistory: () => void;
  onOpenEqualizer: () => void;
  onOpenCastModal: () => void;
  accentColor?: string;
}

export default function CompanionMenuDrawer({
  isOpen,
  onClose,
  activeStream,
  isPlaying,
  likedTracksCount,
  favoriteStationsCount,
  quality,
  onSetQuality,
  sleepTimerMinutes,
  sleepTimerRemaining,
  onSetSleepTimer,
  onOpenStations,
  onOpenFavoriteStations,
  onOpenLikedTracks,
  onOpenHistory,
  onOpenEqualizer,
  onOpenCastModal,
  accentColor = '#00f2ff',
}: CompanionMenuDrawerProps) {
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Drawer
      id="companion-tools-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div 
            className="p-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300"
            style={{ borderColor: `${accentColor}60` }}
          >
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <span className="font-futuristic text-[11px] sm:text-xs font-bold uppercase tracking-widest text-zinc-100">
            FONCTIONNALITÉS COMPAGNONNES & OUTILS
          </span>
        </div>
      }
      subtitle="Outils additionnels et commandes avancées en parallèle du lecteur"
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-3 py-1">

        {/* Current Active Station Mini Summary Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-white/15 flex-shrink-0 shadow">
              <img 
                src={activeStream.tracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80'} 
                alt={activeStream.name} 
                className="w-full h-full object-cover"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="flex items-center gap-0.5">
                    <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" />
                    <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  FLUX ACTIF
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-sm font-bold text-white truncate font-futuristic">
                {activeStream.name}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 truncate">
                {activeStream.genre} • {activeStream.tracks[0]?.artist} - {activeStream.tracks[0]?.title}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenStations();
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all flex-shrink-0"
          >
            <span>Stations</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Companion Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

          {/* 1. Stations Favorites & Alertes */}
          <button
            onClick={() => {
              onClose();
              onOpenFavoriteStations();
            }}
            className="p-3.5 rounded-2xl bg-black/40 hover:bg-amber-950/40 border border-white/10 hover:border-amber-500/40 transition-all cursor-pointer flex items-center justify-between group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 group-hover:scale-110 transition-transform">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                  Stations Favorites
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {favoriteStationsCount} station{favoriteStationsCount > 1 ? 's' : ''} • Alertes live
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
          </button>

          {/* 2. Titres Likés & Coups de Cœur */}
          <button
            onClick={() => {
              onClose();
              onOpenLikedTracks();
            }}
            className="p-3.5 rounded-2xl bg-black/40 hover:bg-pink-950/40 border border-white/10 hover:border-pink-500/40 transition-all cursor-pointer flex items-center justify-between group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 group-hover:scale-110 transition-transform">
                <Heart className="w-5 h-5 fill-pink-500 text-pink-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                  Mes Titres Likés
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {likedTracksCount} morceau{likedTracksCount > 1 ? 'x' : ''} • Extraits 30s
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-pink-400 transition-colors" />
          </button>

          {/* 3. Replay & Historique 15 min */}
          <button
            onClick={() => {
              onClose();
              onOpenHistory();
            }}
            className="p-3.5 rounded-2xl bg-black/40 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 group-hover:scale-110 transition-transform">
                <History className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Historique & Replay
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  15 dernières min de direct
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
          </button>

          {/* 4. Égaliseur Audio Studio */}
          <button
            onClick={() => {
              onClose();
              onOpenEqualizer();
            }}
            className="p-3.5 rounded-2xl bg-black/40 hover:bg-purple-950/40 border border-white/10 hover:border-purple-500/40 transition-all cursor-pointer flex items-center justify-between group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:scale-110 transition-transform">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                  Égaliseur Studio
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  10 bandes & 7 presets DSP
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 transition-colors" />
          </button>

          {/* 5. Cast & AirPlay */}
          <button
            onClick={() => {
              onClose();
              onOpenCastModal();
            }}
            className="p-3.5 rounded-2xl bg-black/40 hover:bg-emerald-950/40 border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between group text-left col-span-1 sm:col-span-2"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-110 transition-transform">
                <Cast className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Diffusion Sans Fil & Multiroom
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  Chromecast, Google Cast, AirPlay, Enceintes Bluetooth & Réseau
                </span>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30">
              Connecter
            </span>
          </button>

        </div>

        {/* 6. Minuteur de Sommeil (Sleep Timer Companion) */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-400">
                <Timer className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-white font-futuristic uppercase tracking-wider">
                  Minuteur de Sommeil (Sleep Timer)
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  Arrêt progressif et doux de la musique
                </span>
              </div>
            </div>

            {sleepTimerRemaining !== null && sleepTimerRemaining > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 font-mono text-xs font-bold animate-pulse flex items-center gap-1.5">
                <Moon className="w-3 h-3" />
                {formatTimer(sleepTimerRemaining)}
              </span>
            )}
          </div>

          {/* Sleep Timer Preset Buttons */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { label: 'Off', val: null },
              { label: '15m', val: 15 },
              { label: '30m', val: 30 },
              { label: '45m', val: 45 },
              { label: '60m', val: 60 },
            ].map((t) => {
              const isSelected = sleepTimerMinutes === t.val;
              return (
                <button
                  key={t.label}
                  onClick={() => onSetSleepTimer(t.val)}
                  className={`py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-indigo-500/30 border border-indigo-400 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                      : 'bg-black/40 hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 7. Débit & Résolution Audio Direct Switcher */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-white font-futuristic uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              Débit & Résolution Master
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              Flux haute fidélité sans coupure
            </span>
          </div>

          <div className="flex gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10">
            {(['low', 'medium', 'high'] as const).map((qual) => {
              const labels = { low: '128k (Eco)', medium: '192k (Std)', high: '320k (Master)' };
              const isSelected = quality === qual;
              return (
                <button
                  key={qual}
                  onClick={() => onSetQuality(qual)}
                  className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg transition-all uppercase cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-300'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-cyan-400" />}
                  <span>{labels[qual]}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </Drawer>
  );
}
