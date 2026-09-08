import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, RefreshCw, MoreVertical, Plus, RotateCcw, 
  ChevronUp, ChevronDown, Check, EyeOff, Radio, Users, 
  Mail, Trophy, Server, Square, 
  Volume2, CalendarDays, Tag, 
  Settings2, LayoutGrid, Mic, Headphones, Activity,
  Clock, Zap, Flame
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser } from '../types';
import { 
  AdminChallenge, 
  AdminPromotion, 
  AdminEvent, 
  AdminMessage,
  AdminScheduleShow,
  getAdminSchedules
} from '../utils/adminStore';
import { 
  DashboardWidgetConfig, 
  DashboardWidgetId, 
  WidgetSize, 
  WidgetDensity 
} from '../types/adminCustomization';
import { 
  getSavedDashboardWidgets, 
  saveDashboardWidgets, 
  resetDashboardWidgets 
} from '../utils/adminCustomizationStore';
import { POCKETBASE_CONFIG } from '../lib/pocketbase';

interface AdminDashboardViewProps {
  stations: StreamChannel[];
  users: SynapseUser[];
  challenges: AdminChallenge[];
  promotions: AdminPromotion[];
  events: AdminEvent[];
  messages: AdminMessage[];
  unreadMessagesCount: number;
  activeStationsCount: number;
  dbStatus: {
    ok: boolean | null;
    message: string;
    isTesting: boolean;
    isSyncing: boolean;
  };
  currentUser?: SynapseUser | null;
  onNavigateTab: (tab: any) => void;
  onOpenAddNew: (tab: any) => void;
  onOpenControlDeck: (station: StreamChannel) => void;
  onRefreshData: () => void;
  onTestDatabase: () => void;
  showToast: (msg: string) => void;
}

export default function AdminDashboardView({
  stations,
  users,
  challenges,
  promotions,
  events,
  messages,
  unreadMessagesCount,
  activeStationsCount,
  dbStatus,
  currentUser,
  onNavigateTab,
  onOpenAddNew,
  onOpenControlDeck,
  onRefreshData,
  onTestDatabase,
  showToast,
}: AdminDashboardViewProps) {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => getSavedDashboardWidgets());
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);

  // Schedules state for Next-Up & Station Focus
  const [schedules, setSchedules] = useState<AdminScheduleShow[]>(() => getAdminSchedules());

  // Station focus widget: selected station ID (persisted in localStorage)
  const [focusedStationId, setFocusedStationId] = useState<string>(() => {
    return localStorage.getItem('synapse_dashboard_focused_station') || stations[0]?.id || 'pop-variete';
  });

  // QUICK LISTEN AUDIO ENGINE
  // State: actively playing station ID (null if stopped), and whether it is locked in toggle mode or hold mode
  const [activeListeningStationId, setActiveListeningStationId] = useState<string | null>(null);
  const [isListenHeld, setIsListenHeld] = useState<boolean>(false);
  const [listenVolume, setListenVolume] = useState<number>(0.85);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const holdTimeoutRef = useRef<any>(null);

  // Initialize or clean up audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = listenVolume;
    audioPlayerRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioPlayerRef.current = null;
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = listenVolume;
    }
  }, [listenVolume]);

  // Audio start helper
  const playStationAudio = useCallback((station: StreamChannel) => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    const streamUrl = station.streamUrl || station.tracks?.[0]?.audioUrl;
    if (!streamUrl) {
      showToast(`Aucun flux audio disponible pour "${station.name}".`);
      return;
    }

    try {
      if (audio.src !== streamUrl) {
        audio.src = streamUrl;
      }
      audio.volume = listenVolume;
      audio.play().then(() => {
        setActiveListeningStationId(station.id);
      }).catch(() => {
        showToast(`Impossible de démarrer l'écoute rapide de "${station.name}".`);
        setActiveListeningStationId(null);
      });
    } catch (e) {
      showToast(`Erreur audio sur "${station.name}".`);
      setActiveListeningStationId(null);
    }
  }, [listenVolume, showToast]);

  // Audio stop helper
  const stopStationAudio = useCallback(() => {
    const audio = audioPlayerRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setActiveListeningStationId(null);
    setIsListenHeld(false);
  }, []);

  // Toggle click handler (click once to start, click once to stop)
  const handleToggleQuickListen = (station: StreamChannel) => {
    if (activeListeningStationId === station.id && !isListenHeld) {
      stopStationAudio();
      showToast(`Écoute rapide arrêtée (${station.name})`);
    } else {
      playStationAudio(station);
      showToast(`Écoute rapide en direct : ${station.name}`);
    }
  };

  // Push-to-listen (hold to listen, release to stop)
  const handleHoldListenStart = (station: StreamChannel) => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = setTimeout(() => {
      setIsListenHeld(true);
      playStationAudio(station);
    }, 150); // slight debounce so simple clicks don't feel glitchy
  };

  const handleHoldListenEnd = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (isListenHeld) {
      stopStationAudio();
    }
  };

  // Focus station selector handler
  const handleSelectFocusedStation = (stationId: string) => {
    setFocusedStationId(stationId);
    localStorage.setItem('synapse_dashboard_focused_station', stationId);
  };

  // Widget management handlers
  const updateWidgetsState = (newWidgets: DashboardWidgetConfig[]) => {
    setWidgets(newWidgets);
    saveDashboardWidgets(newWidgets);
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgets.length) return;

    const updated = [...widgets];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updateWidgetsState(updated);
  };

  const changeWidgetSize = (id: DashboardWidgetId, newSize: WidgetSize) => {
    const updated = widgets.map(w => w.id === id ? { ...w, size: newSize } : w);
    updateWidgetsState(updated);
  };

  const changeWidgetDensity = (id: DashboardWidgetId, newDensity: WidgetDensity) => {
    const updated = widgets.map(w => w.id === id ? { ...w, density: newDensity } : w);
    updateWidgetsState(updated);
  };

  const toggleWidgetVisibility = (id: DashboardWidgetId) => {
    const updated = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    updateWidgetsState(updated);
    showToast('Disposition du tableau de bord mise à jour.');
  };

  const handleResetLayout = () => {
    const defaults = resetDashboardWidgets();
    setWidgets(defaults);
    setIsMenuOpen(false);
    showToast('Disposition du tableau de bord réinitialisée par défaut.');
  };

  // Helper for Tailwind grid col span based on widget size
  const getSizeClass = (size: WidgetSize) => {
    switch (size) {
      case 'full':
        return 'col-span-12';
      case 'half':
        return 'col-span-12 lg:col-span-6';
      case 'third':
        return 'col-span-12 md:col-span-6 lg:col-span-4';
      default:
        return 'col-span-12';
    }
  };

  const visibleWidgets = widgets.filter(w => w.visible);
  const hiddenWidgets = widgets.filter(w => !w.visible);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* HEADER BANNER WITH ACTIONS & 3-DOTS MENU */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm relative backdrop-blur-sm">
        <div className="flex flex-col gap-1 text-left">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg sm:text-xl font-futuristic font-black tracking-wide text-white">
              Tableau de Bord Synapse
            </h2>
            {isEditMode && (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider animate-pulse">
                Mode Édition Actif
              </span>
            )}
            {activeListeningStationId && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                ÉCOUTE RAPIDE EN COURS
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-zinc-400 max-w-2xl">
            Surveillance en temps réel des fréquences, raccourcis animateur, prises d'antenne et personnalisation avancée des blocs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 relative">
          {activeListeningStationId && (
            <button
              onClick={stopStationAudio}
              className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
              title="Couper l'écoute rapide"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Couper audio</span>
            </button>
          )}

          <button
            onClick={() => {
              onRefreshData();
              setSchedules(getAdminSchedules());
              showToast('Données du tableau de bord actualisées.');
            }}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            title="Rafraîchir les métriques"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Actualiser</span>
          </button>

          {/* EDIT MODE TOGGLE BUTTON */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isEditMode
                ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{isEditMode ? 'Terminer' : 'Personnaliser'}</span>
          </button>

          {/* 3 VERTICAL DOTS MENU TRIGGER */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
              title="Options du tableau de bord"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* 3 DOTS DROPDOWN MENU */}
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-40 flex flex-col gap-1 text-left animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setIsEditMode(!isEditMode);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-zinc-850 text-xs font-mono text-zinc-200 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-cyan-400" />
                      <span>{isEditMode ? 'Quitter le mode édition' : 'Éditer les widgets'}</span>
                    </div>
                    {isEditMode && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setIsAddWidgetModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-zinc-850 text-xs font-mono text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Gérer les widgets ({hiddenWidgets.length} masqués)</span>
                  </button>

                  <div className="my-1 border-t border-zinc-850" />

                  <button
                    onClick={handleResetLayout}
                    className="w-full px-3 py-2 rounded-lg hover:bg-zinc-850 text-xs font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span>Rétablir disposition d'origine</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODE NOTIFICATION BAR */}
      {isEditMode && (
        <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Mode personnalisation activé :</strong> Changez la taille (1/3, 1/2, 1/1), le niveau de vue (Compact, Standard, Détaillé) ou réordonnez chaque bloc.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddWidgetModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gérer ({visibleWidgets.length} actifs)</span>
            </button>
            <button
              onClick={() => setIsEditMode(false)}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Valider</span>
            </button>
          </div>
        </div>
      )}

      {/* DYNAMIC WIDGETS GRID */}
      <div className="grid grid-cols-12 gap-4">
        {visibleWidgets.map((widget, index) => {
          const isFirst = index === 0;
          const isLast = index === visibleWidgets.length - 1;

          return (
            <div
              key={widget.id}
              className={`${getSizeClass(widget.size)} transition-all duration-200 flex flex-col`}
            >
              <div className={`h-full rounded-2xl bg-zinc-900/80 border flex flex-col justify-between shadow-lg overflow-hidden transition-all ${
                isEditMode ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-zinc-800/80 hover:border-zinc-750'
              }`}>
                
                {/* WIDGET CUSTOMIZATION TOOLBAR (VISIBLE IN EDIT MODE) */}
                {isEditMode && (
                  <div className="px-4 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Ordre:</span>
                      <button
                        onClick={() => moveWidget(index, 'up')}
                        disabled={isFirst}
                        className="p-1 rounded bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 disabled:opacity-30 cursor-pointer"
                        title="Monter"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveWidget(index, 'down')}
                        disabled={isLast}
                        className="p-1 rounded bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 disabled:opacity-30 cursor-pointer"
                        title="Descendre"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* SIZE SWITCHER */}
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Largeur:</span>
                      <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
                        <button
                          onClick={() => changeWidgetSize(widget.id, 'third')}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            widget.size === 'third' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Tiers (33%)"
                        >
                          1/3
                        </button>
                        <button
                          onClick={() => changeWidgetSize(widget.id, 'half')}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            widget.size === 'half' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Moitié (50%)"
                        >
                          1/2
                        </button>
                        <button
                          onClick={() => changeWidgetSize(widget.id, 'full')}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            widget.size === 'full' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Pleine largeur (100%)"
                        >
                          1/1
                        </button>
                      </div>

                      {/* DENSITY SWITCHER */}
                      <span className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Vue:</span>
                      <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
                        <button
                          onClick={() => changeWidgetDensity(widget.id, 'compact')}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            widget.density === 'compact' ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Format condensé (micro)"
                        >
                          Compact
                        </button>
                        <button
                          onClick={() => changeWidgetDensity(widget.id, 'normal')}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            widget.density === 'normal' ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Format standard"
                        >
                          Standard
                        </button>
                        <button
                          onClick={() => changeWidgetDensity(widget.id, 'expanded')}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                            widget.density === 'expanded' ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Format détaillé (complet)"
                        >
                          Détaillé
                        </button>
                      </div>

                      {/* HIDE WIDGET */}
                      <button
                        onClick={() => toggleWidgetVisibility(widget.id)}
                        className="p-1 rounded bg-zinc-850 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-colors ml-1 cursor-pointer"
                        title="Masquer ce widget"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* WIDGET CONTENT RENDERING */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  {renderWidgetContent(
                    widget.id, 
                    widget.density,
                    {
                      stations,
                      users,
                      challenges,
                      promotions,
                      events,
                      messages,
                      schedules,
                      unreadMessagesCount,
                      activeStationsCount,
                      dbStatus,
                      currentUser,
                      focusedStationId,
                      onSelectFocusedStation: handleSelectFocusedStation,
                      activeListeningStationId,
                      isListenHeld,
                      listenVolume,
                      onSetListenVolume: setListenVolume,
                      onToggleQuickListen: handleToggleQuickListen,
                      onHoldListenStart: handleHoldListenStart,
                      onHoldListenEnd: handleHoldListenEnd,
                      onNavigateTab,
                      onOpenAddNew,
                      onOpenControlDeck,
                      onTestDatabase,
                      showToast,
                    }
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL AJOUTER / GÉRER LES WIDGETS */}
      {isAddWidgetModalOpen && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
          >
            <div className="p-5 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <h3 className="text-base font-futuristic font-black text-white">
                    Bibliothèque de Widgets Synapse
                  </h3>
                  <p className="text-xs font-mono text-zinc-400">
                    Activez ou désactivez les blocs affichés sur votre tableau de bord
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddWidgetModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {widgets.map((w) => (
                <div
                  key={w.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    w.visible 
                      ? 'bg-zinc-900/80 border-zinc-800 text-white' 
                      : 'bg-zinc-950/80 border-zinc-900 text-zinc-400'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">{w.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-850 text-zinc-400 border border-zinc-800">
                        {w.size === 'full' ? 'Plein écran' : w.size === 'half' ? '1/2 largeur' : '1/3 largeur'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 mt-0.5">{w.description}</span>
                  </div>

                  <button
                    onClick={() => toggleWidgetVisibility(w.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      w.visible
                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {w.visible ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Masquer</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Afficher</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-850 bg-zinc-950 flex items-center justify-between">
              <button
                onClick={handleResetLayout}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" />
                <span>Rétablir tout par défaut</span>
              </button>
              <button
                onClick={() => setIsAddWidgetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs transition-all cursor-pointer"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// -------------------------------------------------------------
// SUB-RENDERER FOR EACH INDIVIDUAL WIDGET WITH TRIPLE DENSITY
// -------------------------------------------------------------
function renderWidgetContent(
  widgetId: DashboardWidgetId, 
  density: WidgetDensity,
  ctx: {
    stations: StreamChannel[];
    users: SynapseUser[];
    challenges: AdminChallenge[];
    promotions: AdminPromotion[];
    events: AdminEvent[];
    messages: AdminMessage[];
    schedules: AdminScheduleShow[];
    unreadMessagesCount: number;
    activeStationsCount: number;
    dbStatus: any;
    currentUser?: SynapseUser | null;
    focusedStationId: string;
    onSelectFocusedStation: (id: string) => void;
    activeListeningStationId: string | null;
    isListenHeld: boolean;
    listenVolume: number;
    onSetListenVolume: (vol: number) => void;
    onToggleQuickListen: (station: StreamChannel) => void;
    onHoldListenStart: (station: StreamChannel) => void;
    onHoldListenEnd: () => void;
    onNavigateTab: (tab: any) => void;
    onOpenAddNew: (tab: any) => void;
    onOpenControlDeck: (station: StreamChannel) => void;
    onTestDatabase: () => void;
    showToast: (msg: string) => void;
  }
) {
  switch (widgetId) {
    // =========================================================
    // 1. KPI OVERVIEW
    // =========================================================
    case 'kpi_overview': {
      if (density === 'compact') {
        return (
          <div className="flex flex-col gap-2.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Indicateurs Clés
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">99.8% Uptime</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div 
                onClick={() => ctx.onNavigateTab('stations')} 
                className="p-2 rounded-lg bg-zinc-950 border border-cyan-500/20 hover:border-cyan-500/40 cursor-pointer flex flex-col items-center justify-center text-center"
              >
                <span className="text-base font-mono font-black text-white">{ctx.activeStationsCount}</span>
                <span className="text-[9px] font-mono text-cyan-300 uppercase">Radios</span>
              </div>
              <div 
                onClick={() => ctx.onNavigateTab('users')} 
                className="p-2 rounded-lg bg-zinc-950 border border-purple-500/20 hover:border-purple-500/40 cursor-pointer flex flex-col items-center justify-center text-center"
              >
                <span className="text-base font-mono font-black text-white">{ctx.users.length}</span>
                <span className="text-[9px] font-mono text-purple-300 uppercase">Membres</span>
              </div>
              <div 
                onClick={() => ctx.onNavigateTab('messages')} 
                className="p-2 rounded-lg bg-zinc-950 border border-pink-500/20 hover:border-pink-500/40 cursor-pointer flex flex-col items-center justify-center text-center"
              >
                <span className="text-base font-mono font-black text-white">{ctx.unreadMessagesCount}</span>
                <span className="text-[9px] font-mono text-pink-300 uppercase">Dédicaces</span>
              </div>
              <div 
                onClick={() => ctx.onNavigateTab('challenges')} 
                className="p-2 rounded-lg bg-zinc-950 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer flex flex-col items-center justify-center text-center"
              >
                <span className="text-base font-mono font-black text-white">{ctx.challenges.length}</span>
                <span className="text-[9px] font-mono text-amber-300 uppercase">Quêtes</span>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Indicateurs Clés & KPIs de la Plateforme
            </span>
            <span className="text-[10px] font-mono text-zinc-400">Temps réel direct</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI 1 */}
            <div 
              onClick={() => ctx.onNavigateTab('stations')}
              className="p-3.5 rounded-xl bg-zinc-950 border border-cyan-500/20 hover:border-cyan-500/50 flex flex-col justify-between gap-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-cyan-400">
                <span className="text-[10px] font-mono font-bold uppercase">Stations Radio</span>
                <Radio className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-black text-white">
                  {ctx.activeStationsCount} / {ctx.stations.length}
                </span>
                <span className="text-[10px] font-mono text-cyan-300">Actives en direct</span>
              </div>
            </div>

            {/* KPI 2 */}
            <div 
              onClick={() => ctx.onNavigateTab('users')}
              className="p-3.5 rounded-xl bg-zinc-950 border border-purple-500/20 hover:border-purple-500/50 flex flex-col justify-between gap-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-purple-400">
                <span className="text-[10px] font-mono font-bold uppercase">Membres Inscrits</span>
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-black text-white">
                  {ctx.users.length}
                </span>
                <span className="text-[10px] font-mono text-purple-300">Auditeurs & Équipe</span>
              </div>
            </div>

            {/* KPI 3 */}
            <div 
              onClick={() => ctx.onNavigateTab('messages')}
              className="p-3.5 rounded-xl bg-zinc-950 border border-pink-500/20 hover:border-pink-500/50 flex flex-col justify-between gap-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-pink-400">
                <span className="text-[10px] font-mono font-bold uppercase">Dédicaces Studio</span>
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-black text-white">
                  {ctx.unreadMessagesCount} <span className="text-xs text-pink-400 font-normal">non lus</span>
                </span>
                <span className="text-[10px] font-mono text-pink-300">{ctx.messages.length} reçus au total</span>
              </div>
            </div>

            {/* KPI 4 */}
            <div 
              onClick={() => ctx.onNavigateTab('challenges')}
              className="p-3.5 rounded-xl bg-zinc-950 border border-amber-500/20 hover:border-amber-500/50 flex flex-col justify-between gap-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[10px] font-mono font-bold uppercase">Quêtes & Défis</span>
                <Trophy className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-black text-white">
                  {ctx.challenges.length}
                </span>
                <span className="text-[10px] font-mono text-amber-300">Défis actifs en cours</span>
              </div>
            </div>
          </div>

          {density === 'expanded' && (
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Activity className="w-3.5 h-3.5" />
                  Signal Global : 100% Qualité HD
                </span>
                <span className="text-zinc-500">|</span>
                <span>Latence moyenne AzuraCast : <strong>12ms</strong></span>
              </div>
              <span className="text-cyan-300 font-bold">PocketBase SQLite Synchronisé</span>
            </div>
          )}
        </div>
      );
    }

    // =========================================================
    // 2. STATIONS MONITOR WITH QUICK LISTEN & REGIE
    // =========================================================
    case 'stations_monitor': {
      const itemsToShow = density === 'compact' ? 3 : density === 'expanded' ? 10 : 5;
      
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Moniteur des Stations ({ctx.stations.length})</span>
            </div>
            
            <div className="flex items-center gap-2">
              {ctx.activeListeningStationId && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  ÉCOUTE DIRECTE
                </div>
              )}
              <button
                onClick={() => ctx.onNavigateTab('stations')}
                className="text-xs font-mono text-cyan-400 hover:underline cursor-pointer"
              >
                Voir tout
              </button>
            </div>
          </div>

          {/* Quick instructions banner when in expanded view */}
          {density === 'expanded' && (
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 text-[10.5px] font-mono text-zinc-400 flex items-center justify-between gap-2">
              <span>🎧 <strong>Écoute rapide :</strong> Cliquez pour allumer/éteindre, ou <em>maintenez appuyé</em> pour écouter puis relâchez pour couper instantanément.</span>
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3 h-3 text-cyan-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ctx.listenVolume}
                  onChange={(e) => ctx.onSetListenVolume(parseFloat(e.target.value))}
                  className="w-16 accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
                  title="Volume d'écoute"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
            {ctx.stations.slice(0, itemsToShow).map((st, idx) => {
              const isEnabled = st.enabled !== false;
              const isListening = ctx.activeListeningStationId === st.id;

              if (density === 'compact') {
                return (
                  <div
                    key={st.id}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      isListening 
                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_12px_rgba(0,242,255,0.15)]' 
                        : 'bg-zinc-950 border-zinc-850 hover:border-zinc-750'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* VOYANT D'ACTIVITÉ */}
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        {isEnabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isEnabled ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-zinc-600'}`} />
                      </span>
                      <span className="text-xs font-mono font-bold text-white truncate">{st.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* BOUTON ÉCOUTE RAPIDE COMPACT */}
                      <button
                        onClick={() => ctx.onToggleQuickListen(st)}
                        onMouseDown={() => ctx.onHoldListenStart(st)}
                        onMouseUp={ctx.onHoldListenEnd}
                        onTouchStart={() => ctx.onHoldListenStart(st)}
                        onTouchEnd={ctx.onHoldListenEnd}
                        className={`p-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                          isListening
                            ? 'bg-emerald-500 text-black border-emerald-400 font-bold shadow-md shadow-emerald-500/30'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                        }`}
                        title="Clic: Écouter/Arrêter | Appui maintenu: Écouter puis relâcher"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                      </button>

                      {/* ICONE RÉGIE */}
                      <button
                        onClick={() => ctx.onOpenControlDeck(st)}
                        className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition-all cursor-pointer"
                        title="Ouvrir la régie de cette station"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={st.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isListening 
                      ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_15px_rgba(0,242,255,0.15)] ring-1 ring-cyan-500/30' 
                      : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-zinc-500 w-4">
                      #{idx + 1}
                    </span>

                    {/* VOYANT D'ACTIVITÉ */}
                    <div className="relative flex items-center justify-center shrink-0">
                      {isEnabled ? (
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                        </span>
                      ) : (
                        <span className="w-3 h-3 rounded-full bg-zinc-600" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white truncate">
                          {st.name}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${
                          isEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        }`}>
                          {isEnabled ? 'ON-AIR' : 'OFFLINE'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 truncate">
                        {st.genre} {density === 'expanded' && st.streamUrl ? `• 320 kbps HD` : ''}
                      </span>
                    </div>
                  </div>

                  {/* CONTROLS (ÉCOUTE RAPIDE + RÉGIE) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* BOUTON ÉCOUTE RAPIDE DOUBLE MODE (CLIC OU MAINTIEN) */}
                    <button
                      onClick={() => ctx.onToggleQuickListen(st)}
                      onMouseDown={() => ctx.onHoldListenStart(st)}
                      onMouseUp={ctx.onHoldListenEnd}
                      onTouchStart={() => ctx.onHoldListenStart(st)}
                      onTouchEnd={ctx.onHoldListenEnd}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all select-none cursor-pointer ${
                        isListening
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/30 animate-pulse'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-750 hover:border-zinc-600'
                      }`}
                      title="1 clic: Démarrer/Arrêter | Maintenir enfoncé: Écouter tant que pressé"
                    >
                      {isListening ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Écoute</span>
                        </>
                      )}
                    </button>

                    {/* ICÔNE RÉGIE DIRECTE */}
                    <button
                      onClick={() => ctx.onOpenControlDeck(st)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Ouvrir la régie et le direct antenne"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Régie</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // =========================================================
    // 3. STATION FOCUS DECK (SPECIALIZED HOST COCKPIT)
    // =========================================================
    case 'station_focus': {
      const selectedStation = ctx.stations.find(s => s.id === ctx.focusedStationId) || ctx.stations[0];
      const isListeningFocus = ctx.activeListeningStationId === selectedStation?.id;
      const currentStationSchedule = ctx.schedules.filter(s => s.stationId === selectedStation?.id || s.stationId === 'all');
      const currentShow = currentStationSchedule[0] || { title: 'Direct Live & Musique Non-Stop', host: 'AutoDJ Régie', startTime: '00:00', endTime: '23:59' };

      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Cockpit Station Dédiée</span>
            </div>

            {/* STATION SELECTOR */}
            <select
              value={ctx.focusedStationId}
              onChange={(e) => ctx.onSelectFocusedStation(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 font-bold cursor-pointer focus:border-cyan-400"
            >
              {ctx.stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.genre})
                </option>
              ))}
            </select>
          </div>

          {/* MAIN COCKPIT CARD */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-black shrink-0 shadow-lg"
                  style={{ backgroundColor: selectedStation?.color || '#00f2ff' }}
                >
                  <Radio className="w-5 h-5 text-zinc-950" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-futuristic font-black text-white truncate">
                      {selectedStation?.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ON-AIR
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 truncate">
                    Émission : <strong className="text-zinc-200">{currentShow.title}</strong> ({currentShow.host})
                  </span>
                </div>
              </div>

              {/* DIRECT ACTION BUTTONS */}
              <div className="flex items-center gap-2 shrink-0">
                {/* QUICK LISTEN */}
                <button
                  onClick={() => selectedStation && ctx.onToggleQuickListen(selectedStation)}
                  onMouseDown={() => selectedStation && ctx.onHoldListenStart(selectedStation)}
                  onMouseUp={ctx.onHoldListenEnd}
                  onTouchStart={() => selectedStation && ctx.onHoldListenStart(selectedStation)}
                  onTouchEnd={ctx.onHoldListenEnd}
                  className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all select-none cursor-pointer ${
                    isListeningFocus
                      ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/30 animate-pulse'
                      : 'bg-zinc-900 hover:bg-zinc-850 text-white border-zinc-800'
                  }`}
                  title="Écoute rapide (Clic ou maintien)"
                >
                  <Headphones className="w-4 h-4" />
                  <span className="hidden sm:inline">{isListeningFocus ? 'Arrêter' : 'Écouter'}</span>
                </button>

                {/* OPEN REGIE */}
                <button
                  onClick={() => selectedStation && ctx.onOpenControlDeck(selectedStation)}
                  className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Régie Direct</span>
                </button>
              </div>
            </div>

            {/* EXPANDED HOST SHORTCUTS & JINGLES */}
            {density === 'expanded' && (
              <div className="pt-3 border-t border-zinc-900 flex flex-col gap-2">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-400">
                  Raccourcis Animateur & Jingles Prioritaires :
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => ctx.showToast(`Lancement Drop Top Horaire sur "${selectedStation?.name}" !`)}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>Top Horaire</span>
                  </button>
                  <button
                    onClick={() => ctx.showToast(`Jingle Station envoyé au flux "${selectedStation?.name}"`)}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Jingle Radio</span>
                  </button>
                  <button
                    onClick={() => {
                      ctx.onNavigateTab('messages');
                      ctx.showToast(`Filtrage des dédicaces pour ${selectedStation?.name}`);
                    }}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3 h-3 text-pink-400" />
                    <span>Dédicaces</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // =========================================================
    // 4. ON-AIR SCHEDULE & NEXT-UP WIDGET
    // =========================================================
    case 'next_up_schedule': {
      const displaySchedules = ctx.schedules.slice(0, density === 'compact' ? 2 : density === 'expanded' ? 6 : 3);
      
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Grille On-Air & Prochaines Émissions</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('programming')}
              className="text-xs font-mono text-emerald-400 hover:underline cursor-pointer"
            >
              Grille complète
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {displaySchedules.length === 0 ? (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-500 text-center">
                Grille automatique AutoDJ en cours.
              </div>
            ) : (
              displaySchedules.map((sch) => (
                <div
                  key={sch.id}
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-mono font-bold text-white truncate">{sch.title}</span>
                    <span className="text-[10px] font-mono text-zinc-400 truncate">Par {sch.host || 'Animateur Synapse'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold shrink-0">
                    {sch.startTime} - {sch.endTime}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // =========================================================
    // 5. BROADCAST QUICK STATUS & DJ LINK
    // =========================================================
    case 'broadcast_quick_status': {
      const djAccount = ctx.currentUser?.azuraDjAccount;
      
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Mic className="w-4 h-4 text-cyan-400" />
              <span>Direct Antenne & DJ Streamer</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('stations')}
              className="text-xs font-mono text-cyan-400 hover:underline cursor-pointer"
            >
              Régie
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-white">
                    {djAccount?.displayName || djAccount?.username || 'Compte DJ non lié'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {djAccount ? `Station assignée: ${djAccount.stationShortcode || 'Toutes'}` : 'Prêt pour prise d\'antenne'}
                  </span>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                djAccount ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {djAccount ? 'LIÉ AZURACAST' : 'STUDIO PRÊT'}
              </span>
            </div>

            {density === 'expanded' && (
              <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>Signal WebDJ : <strong>Stéréo 48kHz Opus</strong></span>
                <button
                  onClick={() => ctx.onOpenControlDeck(ctx.stations[0])}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-300 text-[10px] font-mono border border-zinc-800 cursor-pointer"
                >
                  Ouvrir Console
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // =========================================================
    // 6. QUICK ACTIONS
    // =========================================================
    case 'quick_actions': {
      if (density === 'compact') {
        return (
          <div className="flex flex-col gap-2.5 text-left">
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase">
              Raccourcis Studio
            </span>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => { ctx.onNavigateTab('stations'); ctx.onOpenAddNew('stations'); }}
                className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10.5px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Station</span>
              </button>
              <button
                onClick={() => { ctx.onNavigateTab('challenges'); ctx.onOpenAddNew('challenges'); }}
                className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10.5px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Défi</span>
              </button>
              <button
                onClick={() => { ctx.onNavigateTab('events'); ctx.onOpenAddNew('events'); }}
                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10.5px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Event</span>
              </button>
              <button
                onClick={() => { ctx.onNavigateTab('promotions'); ctx.onOpenAddNew('promotions'); }}
                className="p-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[10.5px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Promo</span>
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              Raccourcis & Actions Rapides
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => {
                ctx.onNavigateTab('stations');
                ctx.onOpenAddNew('stations');
              }}
              className="p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Nouvelle Station</span>
            </button>

            <button
              onClick={() => {
                ctx.onNavigateTab('challenges');
                ctx.onOpenAddNew('challenges');
              }}
              className="p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Nouveau Défi XP</span>
            </button>

            <button
              onClick={() => {
                ctx.onNavigateTab('promotions');
                ctx.onOpenAddNew('promotions');
              }}
              className="p-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-pink-400" />
              <span>Ajouter Promo</span>
            </button>

            <button
              onClick={() => {
                ctx.onNavigateTab('events');
                ctx.onOpenAddNew('events');
              }}
              className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Programmer Event</span>
            </button>
          </div>
        </div>
      );
    }

    // =========================================================
    // 7. SERVICES STATUS
    // =========================================================
    case 'services_status': {
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>État des Services & API</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('services')}
              className="text-xs font-mono text-emerald-400 hover:underline cursor-pointer"
            >
              Gérer
            </button>
          </div>

          <div className="space-y-2.5">
            {/* POCKETBASE STATUS CARD */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-white">PocketBase v0.40+</span>
                  <span className="text-[10px] font-mono text-zinc-400">{POCKETBASE_CONFIG.url}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  {ctx.dbStatus.ok ? 'CONNECTÉ' : 'OPÉRATIONNEL'}
                </span>
                <button
                  onClick={ctx.onTestDatabase}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-800 cursor-pointer"
                  title="Tester PocketBase"
                >
                  <RefreshCw className={`w-3 h-3 ${ctx.dbStatus.isTesting ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* AZURACAST STATUS CARD */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2ff]" />
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-white">AzuraCast AutoDJ & Régie</span>
                  <span className="text-[10px] font-mono text-zinc-400">Streamer DJ, Direct Antenne & Files</span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">
                PRÊT
              </span>
            </div>
          </div>
        </div>
      );
    }

    // =========================================================
    // 8. RECENT MESSAGES / DEDICACES
    // =========================================================
    case 'recent_messages': {
      const displayMsgs = ctx.messages.slice(0, density === 'compact' ? 2 : density === 'expanded' ? 6 : 3);
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Mail className="w-4 h-4 text-pink-400" />
              <span>Dernières Dédicaces ({ctx.messages.length})</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('messages')}
              className="text-xs font-mono text-pink-400 hover:underline cursor-pointer"
            >
              Messagerie
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {displayMsgs.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-xs font-mono text-zinc-500">
                Aucun message reçu pour le moment.
              </div>
            ) : (
              displayMsgs.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white">{m.authorName || 'Auditeur'}</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : 'Récemment'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-zinc-300 line-clamp-2">
                    "{m.message}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // =========================================================
    // 9. ACTIVE CHALLENGES
    // =========================================================
    case 'active_challenges': {
      const displayChallenges = ctx.challenges.slice(0, density === 'compact' ? 2 : density === 'expanded' ? 5 : 3);
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Défis & Quêtes Actives ({ctx.challenges.length})</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('challenges')}
              className="text-xs font-mono text-amber-400 hover:underline cursor-pointer"
            >
              Voir tout
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {displayChallenges.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-mono font-bold text-white truncate">{c.title}</span>
                  <span className="text-[10px] font-mono text-zinc-400 line-clamp-1">{c.desc}</span>
                </div>
                <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold shrink-0">
                  +{c.points} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // =========================================================
    // 10. COMMUNITY USERS
    // =========================================================
    case 'community_users': {
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Membres Inscrits ({ctx.users.length})</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('users')}
              className="text-xs font-mono text-purple-400 hover:underline cursor-pointer"
            >
              Gérer
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {ctx.users.slice(0, 3).map((u) => (
              <div
                key={u.id}
                className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-300 shrink-0">
                    {u.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-mono font-bold text-white truncate">{u.username}</span>
                    <span className="text-[10px] font-mono text-zinc-500 truncate">{u.email}</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  u.role === 'super-admin'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                    : u.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                }`}>
                  {u.role === 'super-admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Auditeur'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // =========================================================
    // 11. UPCOMING EVENTS
    // =========================================================
    case 'upcoming_events': {
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <CalendarDays className="w-4 h-4 text-emerald-400" />
              <span>Événements & Lives ({ctx.events.length})</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('events')}
              className="text-xs font-mono text-emerald-400 hover:underline cursor-pointer"
            >
              Calendrier
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {ctx.events.length === 0 ? (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-500 text-center">
                Aucun événement futur.
              </div>
            ) : (
              ctx.events.slice(0, 3).map((e) => (
                <div
                  key={e.id}
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white truncate">{e.title}</span>
                    <span className="text-[10px] font-mono text-emerald-400">{e.date}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">{e.location || 'En direct antenne'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // =========================================================
    // 12. PROMOTIONS & PARTNERS
    // =========================================================
    case 'promotions_partners': {
      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase">
              <Tag className="w-4 h-4 text-pink-400" />
              <span>Promotions Actives ({ctx.promotions.length})</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('promotions')}
              className="text-xs font-mono text-pink-400 hover:underline cursor-pointer"
            >
              Boutique
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {ctx.promotions.slice(0, 2).map((p) => (
              <div
                key={p.id}
                className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-mono font-bold text-white truncate">{p.title}</span>
                  <span className="text-[10px] font-mono text-zinc-400">Code: <code className="text-pink-300">{p.codePromo || 'SYNAPSE'}</code></span>
                </div>
                <span className="text-xs font-mono font-bold text-pink-400 shrink-0">{p.price}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
