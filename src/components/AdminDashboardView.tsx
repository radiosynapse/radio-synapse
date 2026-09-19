import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Sparkles, RefreshCw, Plus, RotateCcw, 
  Check, Radio, Users, 
  Mail, Trophy, Server, Square, 
  Volume2, CalendarDays, Tag, 
  Settings2, LayoutGrid, Mic, Headphones, Activity,
  Clock, Zap, Flame, ListMusic, History, Play, Music,
  GripVertical, X
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
import { getTrackSubmissions } from '../utils/challengesStore';
import { 
  DashboardWidgetConfig, 
  DashboardWidgetId, 
  WidgetDensity 
} from '../types/adminCustomization';
import { 
  getSavedDashboardWidgets, 
  saveDashboardWidgets, 
  resetDashboardWidgets 
} from '../utils/adminCustomizationStore';
import { getWidgetPresetConfig, computeDynamicFilledGridSpans } from '../utils/dashboardLayoutPresets';
import { useSiteFeatureFlags } from '../utils/siteFeatureFlagsStore';
import { SUPABASE_CONFIG } from '../lib/supabase';

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
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<DashboardWidgetId | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<DashboardWidgetId | null>(null);

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

  const handleReorderWidgets = (sourceId: DashboardWidgetId, targetId: DashboardWidgetId) => {
    const currentVisible = widgets.filter(w => w.visible);
    const sourceIndex = currentVisible.findIndex(w => w.id === sourceId);
    const targetIndex = currentVisible.findIndex(w => w.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reorderedVisible = [...currentVisible];
    const [movedItem] = reorderedVisible.splice(sourceIndex, 1);
    reorderedVisible.splice(targetIndex, 0, movedItem);

    const hiddenList = widgets.filter(w => !w.visible);
    const combined = [...reorderedVisible, ...hiddenList].map((w, idx) => ({ ...w, order: idx }));
    updateWidgetsState(combined);
    showToast(`Widget déplacé avec succès.`);
  };

  const changeWidgetPreset = (id: DashboardWidgetId, newDensity: WidgetDensity) => {
    const preset = getWidgetPresetConfig(id, newDensity);
    const updated = widgets.map(w => w.id === id ? { 
      ...w, 
      density: newDensity,
      size: preset.size,
      height: preset.height,
    } : w);
    updateWidgetsState(updated);
    const label = newDensity === 'compact' ? 'Compact' : newDensity === 'expanded' ? 'Détaillé' : 'Standard';
    showToast(`Format ${label} appliqué (${preset.label}).`);
  };

  const removeWidget = (id: DashboardWidgetId) => {
    const target = widgets.find(w => w.id === id);
    const updated = widgets.map(w => w.id === id ? { ...w, visible: false } : w);
    updateWidgetsState(updated);
    showToast(`Widget "${target?.title || id}" retiré. La grille s'est automatiquement réajustée.`);
  };

  const addWidgetToDashboard = (id: DashboardWidgetId) => {
    const target = widgets.find(w => w.id === id);
    const updated = widgets.map(w => w.id === id ? { ...w, visible: true } : w);
    updateWidgetsState(updated);
    showToast(`Widget "${target?.title || id}" ajouté au tableau de bord.`);
  };

  const handleUpdateWidgetStation = (id: DashboardWidgetId, stationId: string) => {
    const updated = widgets.map(w => w.id === id ? { ...w, stationId } : w);
    updateWidgetsState(updated);
    showToast('Station assignée au widget mise à jour.');
  };

  const handleResetLayout = () => {
    const defaults = resetDashboardWidgets();
    setWidgets(defaults);
    showToast('Disposition du tableau de bord réinitialisée par défaut.');
  };

  const { isFeatureEnabled } = useSiteFeatureFlags();

  // Filter widgets by both user visibility preference and global site feature flags
  const visibleWidgets = widgets.filter(w => {
    if (!w.visible) return false;
    if (w.id === 'active_challenges' && !isFeatureEnabled('challenges')) return false;
    if (w.id === 'promotions_partners' && !isFeatureEnabled('promotions')) return false;
    if (w.id === 'upcoming_events' && !isFeatureEnabled('events')) return false;
    if (w.id === 'recent_messages' && !isFeatureEnabled('messages')) return false;
    if (w.id === 'next_up_schedule' && !isFeatureEnabled('programming')) return false;
    if (w.id === 'station_song_requests' && !isFeatureEnabled('song_requests')) return false;
    return true;
  });

  const hiddenWidgets = widgets.filter(w => !visibleWidgets.some(v => v.id === w.id));

  // Compute 100% gap-free dynamic packed layout across 12-col grid
  const dynamicPackedLayoutMap = useMemo(
    () => computeDynamicFilledGridSpans(visibleWidgets),
    [visibleWidgets]
  );

  // Helper to get widget metadata (icon and format badge)
  const getWidgetMeta = (id: DashboardWidgetId): { icon: any; formatHint: string; isColumn: boolean } => {
    switch (id) {
      case 'kpi_overview':
        return { icon: Activity, formatHint: 'Format Large (1/1)', isColumn: false };
      case 'stations_monitor':
        return { icon: Radio, formatHint: 'Format Large (2/3)', isColumn: false };
      case 'station_focus':
        return { icon: Mic, formatHint: 'Format Colonne Haut', isColumn: true };
      case 'station_playlist_history':
        return { icon: History, formatHint: 'Format Moyen (1/2)', isColumn: false };
      case 'recent_messages':
        return { icon: Mail, formatHint: 'Format Colonne Haut', isColumn: true };
      case 'station_song_requests':
        return { icon: Headphones, formatHint: 'Format Colonne Haut', isColumn: true };
      case 'next_up_schedule':
        return { icon: Clock, formatHint: 'Format Colonne Haut', isColumn: true };
      case 'station_live_controls':
        return { icon: Zap, formatHint: 'Format Moyen (1/2)', isColumn: false };
      case 'station_stats_listeners':
        return { icon: Flame, formatHint: 'Format Colonne (1/3)', isColumn: true };
      case 'broadcast_quick_status':
        return { icon: Radio, formatHint: 'Format Colonne (1/3)', isColumn: true };
      case 'services_status':
        return { icon: Server, formatHint: 'Format Colonne (1/3)', isColumn: true };
      case 'quick_actions':
        return { icon: Sparkles, formatHint: 'Format Large (1/1)', isColumn: false };
      case 'active_challenges':
        return { icon: Trophy, formatHint: 'Format Colonne Haut', isColumn: true };
      case 'community_users':
        return { icon: Users, formatHint: 'Format Colonne (1/3)', isColumn: true };
      case 'upcoming_events':
        return { icon: CalendarDays, formatHint: 'Format Colonne (1/3)', isColumn: true };
      case 'promotions_partners':
        return { icon: Tag, formatHint: 'Format Colonne (1/3)', isColumn: true };
      default:
        return { icon: LayoutGrid, formatHint: 'Format Standard', isColumn: false };
    }
  };

  return (
    <div className="flex flex-col w-full min-w-0">
      
      {/* STICKY TOP BAR - COLLÉE À LA TOP BAR PRINCIPALE, 100% OPAQUE, SANS ESPACE */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-lg">
        {/* Chromatic fine accent line along the top banner */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] chromatic-line opacity-80 pointer-events-none" />

        <div className="flex items-center gap-2.5 text-left flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full synapse-star-dot shrink-0" />
          <Sparkles className="w-5 h-5 text-white" />
          <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
            Tableau de Bord Synapse
          </h2>
          {isEditMode && (
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-mono font-bold uppercase tracking-wider animate-pulse">
              Mode Glisser-Déposer Actif
            </span>
          )}
          {activeListeningStationId && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              ÉCOUTE RAPIDE EN COURS
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 relative">
          {activeListeningStationId && (
            <button
              id="admin-dashboard-stop-audio-btn"
              onClick={stopStationAudio}
              className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
              title="Couper l'écoute rapide"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Couper audio</span>
            </button>
          )}

          <button
            id="admin-dashboard-refresh-btn"
            onClick={() => {
              onRefreshData();
              setSchedules(getAdminSchedules());
              showToast('Données du tableau de bord actualisées.');
            }}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            title="Rafraîchir les métriques"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-300" />
            <span className="hidden md:inline">Actualiser</span>
          </button>

          {/* PERSONNALISER TOGGLE BUTTON */}
          <button
            id="admin-dashboard-toggle-customize-btn"
            onClick={() => {
              setIsEditMode(!isEditMode);
              setIsAddWidgetOpen(false);
            }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isEditMode
                ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Terminer</span>
              </>
            ) : (
              <>
                <Settings2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white" />
                <span>Personnaliser</span>
              </>
            )}
          </button>

          {/* "+" BUTTON: APPEARS ONLY IN EDIT MODE TO ADD WIDGETS */}
          {isEditMode && (
            <div className="relative">
              <button
                id="admin-dashboard-add-widget-btn"
                onClick={() => setIsAddWidgetOpen(!isAddWidgetOpen)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAddWidgetOpen
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                }`}
                title="Ajouter un widget au tableau de bord"
                aria-label="Ajouter un widget"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Ajouter</span>
                {hiddenWidgets.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                    {hiddenWidgets.length}
                  </span>
                )}
              </button>

              {/* QUICK ADD WIDGET POPOVER */}
              {isAddWidgetOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsAddWidgetOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2.5 z-40 flex flex-col text-left animate-in fade-in zoom-in-95 duration-150 max-h-[80vh] overflow-hidden">
                    <div className="px-3 py-2 border-b border-zinc-850 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                          Ajouter un widget ({hiddenWidgets.length} dispo{hiddenWidgets.length > 1 ? 's' : ''})
                        </span>
                      </div>
                      <button
                        onClick={() => setIsAddWidgetOpen(false)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                        aria-label="Fermer la liste d'ajout"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-1 overflow-y-auto space-y-1.5 custom-scrollbar max-h-[55vh]">
                      {hiddenWidgets.length === 0 ? (
                        <div className="p-5 text-center text-xs font-mono text-zinc-400 flex flex-col items-center gap-2">
                          <Check className="w-6 h-6 text-emerald-400" />
                          <span>Tous les widgets sont déjà actifs sur votre tableau de bord.</span>
                        </div>
                      ) : (
                        hiddenWidgets.map((w) => {
                          const wMeta = getWidgetMeta(w.id);
                          const IconComp = wMeta.icon;

                          return (
                            <div
                              key={w.id}
                              className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-3 transition-colors"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-zinc-800 text-white shrink-0 mt-0.5">
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-mono font-bold text-white truncate">{w.title}</span>
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400 border border-zinc-750">
                                      {wMeta.formatHint}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono text-zinc-400 line-clamp-1">{w.description}</span>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  addWidgetToDashboard(w.id);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Ajouter</span>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-2 border-t border-zinc-850 bg-zinc-950/90 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          handleResetLayout();
                          setIsAddWidgetOpen(false);
                        }}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-amber-400 text-[11px] font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-amber-400" />
                        <span>Rétablir la disposition par défaut</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DASHBOARD CONTENT (PASSES BEHIND STICKY TOP BAR WHEN SCROLLING) */}
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 text-left">
        {/* EDIT MODE NOTIFICATION BANNER */}
      {isEditMode && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/90 border border-zinc-700 text-zinc-200 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-800 text-white shrink-0">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-white">Mode Personnalisation & Glisser-Déposer actif</span>
              <span className="text-[11px] text-zinc-400">
                Glissez les widgets pour les réordonner. Ajustez le format (Compact, Standard, Détaillé). La grille comble automatiquement les espaces.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              id="admin-dashboard-reset-layout-btn"
              onClick={handleResetLayout}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-amber-400 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Rétablir la disposition d'origine"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Rétablir par défaut</span>
            </button>
            <button
              id="admin-dashboard-done-btn"
              onClick={() => setIsEditMode(false)}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-black/40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Valider la disposition</span>
            </button>
          </div>
        </div>
      )}

      {/* DYNAMIC WIDGETS GRID WITH DENSE AUTO-STACKING */}
      <div 
        id="admin-dashboard-widgets-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 auto-rows-auto [grid-auto-flow:dense] gap-4"
      >
        {visibleWidgets.map((widget) => {
          const isDragging = draggedWidgetId === widget.id;
          const isOver = dragOverWidgetId === widget.id && !isDragging;
          const meta = getWidgetMeta(widget.id);
          const WidgetIcon = meta.icon;
          const preset = getWidgetPresetConfig(widget.id, widget.density);
          const packedLayout = dynamicPackedLayoutMap.get(widget.id) || preset;

          return (
            <div
              key={widget.id}
              id={`dashboard-widget-${widget.id}`}
              draggable={isEditMode}
              onDragStart={(e) => {
                if (!isEditMode) return;
                e.dataTransfer.setData('text/plain', widget.id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedWidgetId(widget.id);
              }}
              onDragOver={(e) => {
                if (!isEditMode) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverWidgetId !== widget.id) {
                  setDragOverWidgetId(widget.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverWidgetId === widget.id) {
                  setDragOverWidgetId(null);
                }
              }}
              onDrop={(e) => {
                if (!isEditMode) return;
                e.preventDefault();
                const sourceId = e.dataTransfer.getData('text/plain') || draggedWidgetId;
                if (sourceId && sourceId !== widget.id) {
                  handleReorderWidgets(sourceId as DashboardWidgetId, widget.id);
                }
                setDraggedWidgetId(null);
                setDragOverWidgetId(null);
              }}
              onDragEnd={() => {
                setDraggedWidgetId(null);
                setDragOverWidgetId(null);
              }}
              className={`${packedLayout.colSpanClass} ${packedLayout.rowSpanClass} transition-all duration-200 flex flex-col ${
                isDragging ? 'opacity-30 scale-[0.98]' : ''
              } ${
                isOver ? 'ring-2 ring-white/60 shadow-2xl shadow-black/60 scale-[1.01]' : ''
              }`}
            >
              <div className={`h-full rounded-2xl bg-zinc-900/80 border flex flex-col justify-between shadow-lg overflow-hidden transition-all ${
                isEditMode ? 'border-white/30 ring-1 ring-white/10' : 'border-zinc-800/80 hover:border-zinc-700'
              }`}>
                
                {/* WIDGET CUSTOMIZATION TOOLBAR (VISIBLE IN EDIT MODE: GRIP + TITLE + 3 PRESETS + CLOSE) */}
                {isEditMode && (
                  <div className="px-3.5 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-2 flex-wrap text-xs font-mono select-none">
                    <div className="flex items-center gap-2">
                      {/* DRAG HANDLE */}
                      <div 
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-750 cursor-grab active:cursor-grabbing transition-colors"
                        title="Glisser-déposer pour déplacer ce widget n'importe où sur la grille"
                      >
                        <GripVertical className="w-4 h-4 text-zinc-300" />
                        <span className="text-[11px] font-bold text-zinc-300">Glisser</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-zinc-300">
                        <WidgetIcon className="w-3.5 h-3.5 text-white" />
                        <span className="font-bold truncate max-w-[140px] sm:max-w-none">{widget.title}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* SEUL BOUTON ACCESSIBLE : CHOIX ENTRE LES 3 PROPOSITIONS (COMPACT, STANDARD, DÉTAILLÉ) */}
                      <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5" role="group" aria-label="Format et densité du widget">
                        <button
                          type="button"
                          onClick={() => changeWidgetPreset(widget.id, 'compact')}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                            widget.density === 'compact' 
                              ? 'bg-white text-black font-bold border border-white' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Format Compact (vertical/horizontal condensé selon données)"
                          aria-label="Format Compact"
                        >
                          Compact
                        </button>
                        <button
                          type="button"
                          onClick={() => changeWidgetPreset(widget.id, 'normal')}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                            widget.density === 'normal' || !widget.density 
                              ? 'bg-white text-black font-bold border border-white' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Format Standard (équilibré et ergonomique)"
                          aria-label="Format Standard"
                        >
                          Standard
                        </button>
                        <button
                          type="button"
                          onClick={() => changeWidgetPreset(widget.id, 'expanded')}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                            widget.density === 'expanded' 
                              ? 'bg-white text-black font-bold border border-white' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                          title="Format Détaillé (étendu, analyse approfondie)"
                          aria-label="Format Détaillé"
                        >
                          Détaillé
                        </button>
                      </div>

                      {/* CROIX DE SUPPRESSION (RECALAGE AUTOMATIQUE DE LA GRILLE) */}
                      <button
                        type="button"
                        onClick={() => removeWidget(widget.id)}
                        className="p-1.5 rounded-lg bg-zinc-850 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-colors ml-1 cursor-pointer flex items-center justify-center"
                        title="Retirer ce widget (la grille s'adapte automatiquement)"
                        aria-label={`Supprimer ${widget.title}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* WIDGET CONTENT RENDERING */}
                <div className="p-4 sm:p-5 flex-1 min-h-0 min-w-0 flex flex-col justify-between overflow-y-auto custom-scrollbar">
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
                      widgetStationId: widget.stationId,
                      onUpdateWidgetStation: (stationId: string) => handleUpdateWidgetStation(widget.id, stationId),
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
      </div>

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
    widgetStationId?: string;
    onUpdateWidgetStation?: (stationId: string) => void;
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
                <Sparkles className="w-3.5 h-3.5 text-white" />
                Indicateurs Clés
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">99.8% Uptime</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div 
                onClick={() => ctx.onNavigateTab('stations')} 
                className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 cursor-pointer flex flex-col items-center justify-center text-center"
              >
                <span className="text-base font-mono font-black text-white">{ctx.activeStationsCount}</span>
                <span className="text-[9px] font-mono text-zinc-400 uppercase">Radios</span>
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
              <Sparkles className="w-4 h-4 text-white" />
              Indicateurs Clés & KPIs de la Plateforme
            </span>
            <span className="text-[10px] font-mono text-zinc-400">Temps réel direct</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI 1 */}
            <div 
              onClick={() => ctx.onNavigateTab('stations')}
              className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-zinc-200">
                <span className="text-[10px] font-mono font-bold uppercase">Stations Radio</span>
                <Radio className="w-3.5 h-3.5 text-zinc-300" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-black text-white">
                  {ctx.activeStationsCount} / {ctx.stations.length}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Actives en direct</span>
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
              <span className="text-zinc-300 font-bold">PocketBase SQLite Synchronisé</span>
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
              <Radio className="w-4 h-4 text-white" />
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
                className="text-xs font-mono text-zinc-400 hover:text-white hover:underline cursor-pointer"
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
                <Volume2 className="w-3 h-3 text-zinc-300" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ctx.listenVolume}
                  onChange={(e) => ctx.onSetListenVolume(parseFloat(e.target.value))}
                  className="w-16 accent-white h-1 bg-zinc-800 rounded cursor-pointer"
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
                        ? 'bg-zinc-850 border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.08)] ring-1 ring-white/20' 
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
                            : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800'
                        }`}
                        title="Clic: Écouter/Arrêter | Appui maintenu: Écouter puis relâcher"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                      </button>

                      {/* ICONE RÉGIE */}
                      <button
                        onClick={() => ctx.onOpenControlDeck(st)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer"
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
                      ? 'bg-zinc-850 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.08)] ring-1 ring-white/20' 
                      : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-mono font-bold text-zinc-400 w-4">
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
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${
                          isEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}>
                          {isEnabled ? 'ON-AIR' : 'OFFLINE'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 truncate">
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
                          <Headphones className="w-3.5 h-3.5 text-zinc-300" />
                          <span>Écoute</span>
                        </>
                      )}
                    </button>

                    {/* ICÔNE RÉGIE DIRECTE */}
                    <button
                      onClick={() => ctx.onOpenControlDeck(st)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
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
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-mono text-zinc-200 font-bold cursor-pointer focus:border-white"
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
                  style={{ backgroundColor: selectedStation?.color || '#ffffff' }}
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
                  className="px-3 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-white/10 cursor-pointer"
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
                    <Sparkles className="w-3 h-3 text-zinc-300" />
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
              <Mic className="w-4 h-4 text-zinc-200" />
              <span>Direct Antenne & DJ Streamer</span>
            </div>
            <button
              onClick={() => ctx.onNavigateTab('stations')}
              className="text-xs font-mono text-zinc-400 hover:text-white hover:underline cursor-pointer"
            >
              Régie
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center shrink-0">
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
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px] font-mono border border-zinc-800 cursor-pointer"
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
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10.5px] font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
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
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
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
            {/* SUPABASE STATUS CARD */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-white">Supabase PostgreSQL & Realtime</span>
                  <span className="text-[10px] font-mono text-zinc-400">{SUPABASE_CONFIG.url}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  {ctx.dbStatus.ok ? 'CONNECTÉ' : 'OPÉRATIONNEL'}
                </span>
                <button
                  onClick={ctx.onTestDatabase}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-800 cursor-pointer"
                  title="Tester Supabase"
                >
                  <RefreshCw className={`w-3 h-3 ${ctx.dbStatus.isTesting ? 'animate-spin text-white' : ''}`} />
                </button>
              </div>
            </div>

            {/* LIQUIDSOAP & ICECAST STATUS CARD */}
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-white">Liquidsoap & Icecast Diffusion</span>
                  <span className="text-[10px] font-mono text-zinc-400">Encodage multi-flux & Prise direct Harbor DJ</span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-bold">
                DIFFUSION OK
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
                    ? 'bg-white/20 text-white border-white/40'
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

    // =========================================================
    // 13. GESTION STATION : FILE D'ATTENTE & TITRES PASSÉS
    // =========================================================
    case 'station_playlist_history': {
      const targetStationId = ctx.widgetStationId || (ctx.currentUser?.assignedStationId && ctx.currentUser.assignedStationId !== 'all' ? ctx.currentUser.assignedStationId : 'pop-variete');
      const targetStation = ctx.stations.find((s) => s.id === targetStationId) || ctx.stations[0];

      const upcomingTracks = [
        { time: 'Dans 2m', title: 'Get Lucky (Radio Edit)', artist: 'Daft Punk ft. Pharrell', duration: '4:08' },
        { time: 'Dans 6m', title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20' },
        { time: 'Dans 9m', title: 'One More Time', artist: 'Daft Punk', duration: '5:20' },
      ];

      const pastTracks = [
        { time: '14:28', title: 'Midnight City', artist: 'M83', likes: 28 },
        { time: '14:24', title: 'Instant Crush', artist: 'Daft Punk ft. Julian Casablancas', likes: 42 },
        { time: '14:20', title: 'Starboy', artist: 'The Weeknd ft. Daft Punk', likes: 19 },
      ];

      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-white" />
              <span className="text-xs font-mono font-bold text-white uppercase truncate">
                File & Passés • <span className="text-white">{targetStation?.name || 'Station'}</span>
              </span>
            </div>
            {ctx.onUpdateWidgetStation && (
              <select
                value={targetStation?.id || 'pop-variete'}
                onChange={(e) => ctx.onUpdateWidgetStation!(e.target.value)}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] font-mono cursor-pointer"
              >
                {ctx.stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* FILE D'ATTENTE */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-200 font-bold flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Titres à venir (File d'attente)
              </span>
              <div className="flex flex-col gap-1">
                {upcomingTracks.map((trk, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-900/60 border border-white/5 text-[11px] font-mono">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white truncate">{trk.title}</span>
                      <span className="text-[10px] text-zinc-400 truncate">{trk.artist}</span>
                    </div>
                    <span className="text-[10px] text-zinc-300 font-bold shrink-0">{trk.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TITRES PASSÉS */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950 border border-purple-500/20">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                <History className="w-3 h-3" />
                Titres passés récemment
              </span>
              <div className="flex flex-col gap-1">
                {pastTracks.map((trk, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-900/60 border border-white/5 text-[11px] font-mono">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-zinc-200 truncate">{trk.title}</span>
                      <span className="text-[10px] text-zinc-400 truncate">{trk.artist}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-zinc-500">{trk.time}</span>
                      <span className="text-[10px] text-amber-400 font-bold">♥ {trk.likes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // =========================================================
    // 14. GESTION STATION : CONTRÔLES DIRECT & CARTOUCHES ANIMATEUR
    // =========================================================
    case 'station_live_controls': {
      const targetStationId = ctx.widgetStationId || (ctx.currentUser?.assignedStationId && ctx.currentUser.assignedStationId !== 'all' ? ctx.currentUser.assignedStationId : 'pop-variete');
      const targetStation = ctx.stations.find((s) => s.id === targetStationId) || ctx.stations[0];

      const playCartridge = (name: string) => {
        ctx.showToast(`Lancement cartouche [${name}] sur ${targetStation?.name}`);
      };

      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-red-400" />
              <span className="text-xs font-mono font-bold text-white uppercase truncate">
                Régie & Jingles Direct • <span className="text-red-400">{targetStation?.name || 'Station'}</span>
              </span>
            </div>
            {ctx.onUpdateWidgetStation && (
              <select
                value={targetStation?.id || 'pop-variete'}
                onChange={(e) => ctx.onUpdateWidgetStation!(e.target.value)}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-red-300 text-[10px] font-mono cursor-pointer"
              >
                {ctx.stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => playCartridge('Jingle Officiel')}
              className="p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-left cursor-pointer transition-all flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-red-400 font-bold">F1 • Jingle</span>
                <Play className="w-3 h-3 text-red-400" />
              </div>
              <span className="text-xs font-mono font-bold text-white">Id Station HD</span>
            </button>

            <button
              onClick={() => playCartridge('Top Horaire')}
              className="p-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-left cursor-pointer transition-all flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">F2 • Top</span>
                <Clock className="w-3 h-3 text-amber-400" />
              </div>
              <span className="text-xs font-mono font-bold text-white">Top Horaire Bip</span>
            </button>

            <button
              onClick={() => playCartridge('Voice Intro')}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-750 text-left cursor-pointer transition-all flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-zinc-300 font-bold">F3 • Voix</span>
                <Mic className="w-3 h-3 text-zinc-300" />
              </div>
              <span className="text-xs font-mono font-bold text-white">Liner Animateur</span>
            </button>

            <button
              onClick={() => playCartridge('Bed Fond Parle')}
              className="p-2.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 text-left cursor-pointer transition-all flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-purple-400 font-bold">F4 • Loop</span>
                <Volume2 className="w-3 h-3 text-purple-400" />
              </div>
              <span className="text-xs font-mono font-bold text-white">Bed Talk Show</span>
            </button>

            <button
              onClick={() => playCartridge('Drop Musical')}
              className="p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-left cursor-pointer transition-all flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">F5 • FX</span>
                <Zap className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-xs font-mono font-bold text-white">Impact Transition</span>
            </button>

            <button
              onClick={() => ctx.showToast(`Arrêt d'urgence flux ${targetStation?.name}`)}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-red-950/80 border border-red-500/60 text-left cursor-pointer transition-all flex flex-col gap-1 text-red-300"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-red-500 font-bold">Urgence</span>
                <Square className="w-3 h-3 text-red-500" />
              </div>
              <span className="text-xs font-mono font-bold text-white">Coupure Micro</span>
            </button>
          </div>
        </div>
      );
    }

    // =========================================================
    // 15. GESTION STATION : AUDIENCE & SANTÉ DU FLUX
    // =========================================================
    case 'station_stats_listeners': {
      const targetStationId = ctx.widgetStationId || (ctx.currentUser?.assignedStationId && ctx.currentUser.assignedStationId !== 'all' ? ctx.currentUser.assignedStationId : 'pop-variete');
      const targetStation = ctx.stations.find((s) => s.id === targetStationId) || ctx.stations[0];

      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-bold text-white uppercase truncate">
                Audience Direct • <span className="text-emerald-400">{targetStation?.name || 'Station'}</span>
              </span>
            </div>
            {ctx.onUpdateWidgetStation && (
              <select
                value={targetStation?.id || 'pop-variete'}
                onChange={(e) => ctx.onUpdateWidgetStation!(e.target.value)}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-emerald-300 text-[10px] font-mono cursor-pointer"
              >
                {ctx.stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-emerald-500/20 flex flex-col">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">En Écoute</span>
              <span className="text-lg font-mono font-black text-emerald-400">412</span>
              <span className="text-[9px] font-mono text-zinc-500">Auditeurs live</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Pic 24h</span>
              <span className="text-lg font-mono font-black text-white">584</span>
              <span className="text-[9px] font-mono text-zinc-500">Record journalier</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-purple-500/20 flex flex-col">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Durée Moy.</span>
              <span className="text-lg font-mono font-black text-purple-400">46m</span>
              <span className="text-[9px] font-mono text-zinc-500">Session moyenne</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/20 flex flex-col">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Qualité</span>
              <span className="text-lg font-mono font-black text-amber-400">192k</span>
              <span className="text-[9px] font-mono text-zinc-500">AAC+ Studio HD</span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-[11px] font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Serveur Icecast Synapse Connecté
            </span>
            <span className="text-emerald-400 font-bold">Latence: 1.2s • Zéro coupure</span>
          </div>
        </div>
      );
    }

    // =========================================================
    // 16. GESTION STATION : PROPOSITIONS MUSICALES & DÉDICACES
    // =========================================================
    case 'station_song_requests': {
      const targetStationId = ctx.widgetStationId || (ctx.currentUser?.assignedStationId && ctx.currentUser.assignedStationId !== 'all' ? ctx.currentUser.assignedStationId : 'pop-variete');
      const targetStation = ctx.stations.find((s) => s.id === targetStationId) || ctx.stations[0];

      // Get proposals filtered for this station
      const submissions = getTrackSubmissions().filter(
        (s) => s.stationId === targetStationId || s.stationId === 'all'
      );

      // Get messages / dedications for this station
      const stationMessages = ctx.messages.filter(
        (m) => !m.stationId || m.stationId === targetStationId || m.stationId === 'all'
      );

      return (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-bold text-white uppercase truncate">
                Propositions & Dédicaces • <span className="text-amber-400">{targetStation?.name || 'Station'}</span>
              </span>
            </div>
            {ctx.onUpdateWidgetStation && (
              <select
                value={targetStation?.id || 'pop-variete'}
                onChange={(e) => ctx.onUpdateWidgetStation!(e.target.value)}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-amber-300 text-[10px] font-mono cursor-pointer"
              >
                {ctx.stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* AUDITOR PROPOSALS */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                  <Flame className="w-3 h-3" />
                  Titres Proposés ({submissions.length})
                </span>
                <button
                  onClick={() => ctx.onNavigateTab('challenges')}
                  className="text-[10px] font-mono text-amber-400 hover:underline cursor-pointer"
                >
                  Voir tout
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {submissions.length === 0 ? (
                  <span className="text-[11px] font-mono text-zinc-500 py-3 text-center">
                    Aucune proposition en attente pour cette station.
                  </span>
                ) : (
                  submissions.slice(0, 3).map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-900/60 border border-white/5 text-[11px] font-mono">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white truncate">{sub.trackTitle}</span>
                        <span className="text-[10px] text-zinc-400 truncate">{sub.artist} • Par {sub.userName}</span>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        sub.status === 'selected' ? 'bg-emerald-500/20 text-emerald-300' :
                        sub.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {sub.status === 'selected' ? 'Validé' : sub.status === 'rejected' ? 'Archivé' : 'À valider'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AUDITOR DEDICATIONS */}
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-zinc-950 border border-pink-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-pink-400 font-bold flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  Dédicaces Auditeurs ({stationMessages.length})
                </span>
                <button
                  onClick={() => ctx.onNavigateTab('messages')}
                  className="text-[10px] font-mono text-pink-400 hover:underline cursor-pointer"
                >
                  Voir tout
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {stationMessages.length === 0 ? (
                  <span className="text-[11px] font-mono text-zinc-500 py-3 text-center">
                    Aucune dédicace en attente pour cette station.
                  </span>
                ) : (
                  stationMessages.slice(0, 3).map((msg) => (
                    <div key={msg.id} className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-900/60 border border-white/5 text-[11px] font-mono">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white truncate">{msg.authorName}</span>
                        <span className="text-[10px] text-zinc-400 truncate">"{msg.message}"</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0">Live</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
