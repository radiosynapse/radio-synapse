import { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Radio, 
  Sparkles, 
  MessageSquare, 
  Music, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  FileText, 
  Download, 
  Copy, 
  X
} from 'lucide-react';
import { LiquidsoapProgramEvent, PlaylistPlaybackBehavior, ScheduleRecurrenceType } from '../types/programming';
import { 
  getProgramEvents, 
  addProgramEvent, 
  updateProgramEvent, 
  deleteProgramEvent, 
  getCurrentOnAirProgram,
  generateLiquidsoapScheduleScript,
  formatDateYMD,
  EVENT_SCHEDULE_CHANGED 
} from '../utils/programmingScheduleService';
import { getRegiePlaylists, getRegieServerConfig } from '../utils/liquidsoapBroadcasterService';
import { StreamChannel } from '../data';

interface AdminInteractiveProgrammingAgendaProps {
  stations: StreamChannel[];
  showToast: (msg: string) => void;
}

type AgendaViewMode = 'week' | 'month' | 'list';

const DAYS_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const PRESET_COLORS = [
  '#f97316', // Orange Rock
  '#00f2ff', // Cyan Synth
  '#ff00a0', // Magenta Club
  '#a855f7', // Purple LoFi
  '#10b981', // Emerald Listener
  '#eab308', // Amber Gold
];

export default function AdminInteractiveProgrammingAgenda({
  stations,
  showToast,
}: AdminInteractiveProgrammingAgendaProps) {
  const [events, setEvents] = useState<LiquidsoapProgramEvent[]>(getProgramEvents());
  const [playlists] = useState(getRegiePlaylists());
  const serverConfig = useMemo(() => getRegieServerConfig(), []);

  // Agenda navigation & filters
  const [viewMode, setViewMode] = useState<AgendaViewMode>('week');
  const [selectedStationId, setSelectedStationId] = useState<string>('all');
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Modal editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Form fields
  const [formStationId, setFormStationId] = useState('all');
  const [formTitle, setFormTitle] = useState('');
  const [formHost, setFormHost] = useState('');
  const [formGenre, setFormGenre] = useState('');
  const [formBadge, setFormBadge] = useState('ÉMISSION');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formScheduleType, setFormScheduleType] = useState<ScheduleRecurrenceType>('weekly_recurring');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1]); // default Lundi
  const [formSpecificDate, setFormSpecificDate] = useState<string>(() => formatDateYMD(new Date()));
  const [formStartTime, setFormStartTime] = useState('14:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formPlaylistIds, setFormPlaylistIds] = useState<string[]>(['pl-heavy']);
  const [formPlaybackBehavior, setFormPlaybackBehavior] = useState<PlaylistPlaybackBehavior>('shuffle');
  const [formJingleIntroEnabled, setFormJingleIntroEnabled] = useState(true);
  const [formJingleIntroName, setFormJingleIntroName] = useState('Drop Intro Émission');
  const [formJingleIntroPath, setFormJingleIntroPath] = useState('/var/media/synapse/music/jingles/intro.mp3');
  const [formJingleOutroEnabled, setFormJingleOutroEnabled] = useState(true);
  const [formJingleOutroName, setFormJingleOutroName] = useState('Outro Fin de Créneau');
  const [formJingleOutroPath, setFormJingleOutroPath] = useState('/var/media/synapse/music/jingles/outro.mp3');
  const [formJingleRotationEnabled, setFormJingleRotationEnabled] = useState(true);
  const [formJingleFrequency, setFormJingleFrequency] = useState(3);
  const [formAllowChat, setFormAllowChat] = useState(true);
  const [formAllowSongRequests, setFormAllowSongRequests] = useState(true);
  const [formAllowLiveVoting, setFormAllowLiveVoting] = useState(false);
  const [formIsLiveSpecial, setFormIsLiveSpecial] = useState(false);

  // Modal Script Viewer
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  // Sync listener
  useEffect(() => {
    const handleSync = () => {
      setEvents(getProgramEvents());
    };
    window.addEventListener(EVENT_SCHEDULE_CHANGED, handleSync);
    return () => window.removeEventListener(EVENT_SCHEDULE_CHANGED, handleSync);
  }, []);

  // Filtered events
  const stationFilteredEvents = useMemo(() => {
    if (selectedStationId === 'all') return events;
    return events.filter((e) => e.stationId === 'all' || e.stationId === selectedStationId);
  }, [events, selectedStationId]);

  // Current on-air program
  const currentOnAir = useMemo(() => {
    return getCurrentOnAirProgram(selectedStationId === 'all' ? 'synapse-main' : selectedStationId);
  }, [selectedStationId, events]);

  // Generate days for week view (Monday to Sunday)
  const currentWeekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Dimanche, 1 = Lundi, ...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + currentWeekOffset * 7);

    const weekDays: Array<{ date: Date; dateStr: string; dayIndex: number; isToday: boolean; label: string }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.toDateString() === today.toDateString();
      const dateStr = formatDateYMD(d);
      const dayIndex = d.getDay(); // 0-6

      weekDays.push({
        date: d,
        dateStr,
        dayIndex,
        isToday,
        label: `${DAYS_SHORT[dayIndex]} ${d.getDate()}/${d.getMonth() + 1}`,
      });
    }

    return weekDays;
  }, [currentWeekOffset]);

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditingEventId(null);
    setFormStationId(selectedStationId);
    setFormTitle('');
    setFormHost('');
    setFormGenre('');
    setFormBadge('ÉMISSION');
    setFormDescription('');
    setFormColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setFormScheduleType('weekly_recurring');
    setFormDaysOfWeek([1]);
    setFormSpecificDate(formatDateYMD(new Date()));
    setFormStartTime('14:00');
    setFormEndTime('16:00');
    setFormPlaylistIds(['pl-heavy']);
    setFormPlaybackBehavior('shuffle');
    setFormJingleIntroEnabled(true);
    setFormJingleIntroName('Jingle Entrée de Programme');
    setFormJingleIntroPath('/var/media/synapse/music/jingles/intro.mp3');
    setFormJingleOutroEnabled(true);
    setFormJingleOutroName('Jingle Fin de Programme');
    setFormJingleOutroPath('/var/media/synapse/music/jingles/outro.mp3');
    setFormJingleRotationEnabled(true);
    setFormJingleFrequency(3);
    setFormAllowChat(true);
    setFormAllowSongRequests(true);
    setFormAllowLiveVoting(false);
    setFormIsLiveSpecial(false);
    setIsEditorOpen(true);
  };

  // Open editor for existing event
  const handleOpenEdit = (ev: LiquidsoapProgramEvent) => {
    setEditingEventId(ev.id);
    setFormStationId(ev.stationId);
    setFormTitle(ev.title);
    setFormHost(ev.host);
    setFormGenre(ev.genre);
    setFormBadge(ev.badge);
    setFormDescription(ev.description);
    setFormColor(ev.color);
    setFormScheduleType(ev.scheduleType);
    setFormDaysOfWeek(ev.daysOfWeek || [1]);
    setFormSpecificDate(ev.specificDate || formatDateYMD(new Date()));
    setFormStartTime(ev.startTime);
    setFormEndTime(ev.endTime);
    setFormPlaylistIds(ev.playlistIds || ['pl-heavy']);
    setFormPlaybackBehavior(ev.playbackBehavior);
    setFormJingleIntroEnabled(ev.jingleIntro.enabled);
    setFormJingleIntroName(ev.jingleIntro.name);
    setFormJingleIntroPath(ev.jingleIntro.filePath || '');
    setFormJingleOutroEnabled(ev.jingleOutro.enabled);
    setFormJingleOutroName(ev.jingleOutro.name);
    setFormJingleOutroPath(ev.jingleOutro.filePath || '');
    setFormJingleRotationEnabled(ev.jingleRotation.enabled);
    setFormJingleFrequency(ev.jingleRotation.frequencyTracks || 3);
    setFormAllowChat(ev.features.allowLiveChat);
    setFormAllowSongRequests(ev.features.allowSongRequests);
    setFormAllowLiveVoting(ev.features.allowLiveVoting);
    setFormIsLiveSpecial(ev.features.isLiveSpecial);
    setIsEditorOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('⚠️ Veuillez donner un titre à votre émission');
      return;
    }

    const payload = {
      stationId: formStationId,
      title: formTitle.trim(),
      host: formHost.trim() || 'AutoDJ Synapse',
      genre: formGenre.trim() || 'Multi-Genres',
      badge: formBadge.trim() || 'DIRECT',
      description: formDescription.trim(),
      color: formColor,
      scheduleType: formScheduleType,
      daysOfWeek: formScheduleType === 'weekly_recurring' ? formDaysOfWeek : undefined,
      specificDate: formScheduleType === 'specific_date' ? formSpecificDate : undefined,
      startTime: formStartTime,
      endTime: formEndTime,
      playlistIds: formPlaylistIds.length > 0 ? formPlaylistIds : ['pl-heavy'],
      playbackBehavior: formPlaybackBehavior,
      loopBehavior: 'loop' as const,
      jingleIntro: {
        enabled: formJingleIntroEnabled,
        name: formJingleIntroName.trim(),
        filePath: formJingleIntroPath.trim(),
      },
      jingleOutro: {
        enabled: formJingleOutroEnabled,
        name: formJingleOutroName.trim(),
        filePath: formJingleOutroPath.trim(),
      },
      jingleRotation: {
        enabled: formJingleRotationEnabled,
        frequencyTracks: formJingleFrequency,
        jinglePlaylistId: 'pl-jingles',
      },
      features: {
        allowLiveChat: formAllowChat,
        allowSongRequests: formAllowSongRequests,
        allowLiveVoting: formAllowLiveVoting,
        isLiveSpecial: formIsLiveSpecial,
      },
      isActive: true,
    };

    if (editingEventId) {
      updateProgramEvent(editingEventId, payload);
      showToast(`✅ Émission « ${formTitle} » mise à jour avec succès`);
    } else {
      addProgramEvent(payload);
      showToast(`🎉 Nouvelle émission « ${formTitle} » programmée`);
    }

    setIsEditorOpen(false);
  };

  const handleDeleteEvent = (id: string, title: string) => {
    if (window.confirm(`Confirmez-vous la suppression du créneau « ${title} » ?`)) {
      deleteProgramEvent(id);
      showToast(`🗑️ Émission supprimée de la grille d'antenne`);
    }
  };

  const handleToggleEventActive = (id: string, current: boolean) => {
    updateProgramEvent(id, { isActive: !current });
    showToast(current ? '⏸️ Programme suspendu' : '▶️ Programme activé');
  };

  const toggleDaySelection = (dayIdx: number) => {
    setFormDaysOfWeek((prev) => {
      if (prev.includes(dayIdx)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== dayIdx);
      } else {
        return [...prev, dayIdx].sort();
      }
    });
  };

  const togglePlaylistSelection = (plId: string) => {
    setFormPlaylistIds((prev) => {
      if (prev.includes(plId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== plId);
      } else {
        return [...prev, plId];
      }
    });
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `agenda_synapse_liquidsoap_${formatDateYMD(new Date())}.json`;
    a.click();
    showToast('📥 Agenda exporté au format JSON');
  };

  // Copy liquidsoap code
  const generatedScript = useMemo(() => {
    return generateLiquidsoapScheduleScript(events, playlists, serverConfig.musicStoragePath);
  }, [events, playlists, serverConfig]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    showToast('📋 Code Liquidsoap copié dans le presse-papier !');
  };

  return (
    <div className="flex flex-col w-full min-w-0">
      
      {/* 1. TOP STICKY BAR POUR L'AGENDA (COLLÉE À LA TOP BAR PRINCIPALE, 100% OPAQUE, SANS ESPACE) */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        
        {/* Left side: Station Filter & View Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono">
            <Radio className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-zinc-400 text-[11px]">Radio :</span>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="bg-transparent text-white font-bold font-mono focus:outline-none cursor-pointer"
            >
              <option value="all">Toutes les radios (Maître)</option>
              {stations.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* View mode buttons */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-white/10 text-xs font-mono">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'week' ? 'bg-white text-black font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'month' ? 'bg-white text-black font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              3 Mois (Calendrier)
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-black font-bold shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Liste ({stationFilteredEvents.length})
            </button>
          </div>
        </div>

        {/* Right side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {viewMode === 'week' && (
            <div className="flex items-center bg-zinc-950 px-1 py-1 rounded-xl border border-white/10 text-xs font-mono">
              <button
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                title="Semaine précédente"
                aria-label="Semaine précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentWeekOffset(0)}
                className="px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white font-bold cursor-pointer"
              >
                {currentWeekOffset === 0 ? 'Cette semaine' : `${currentWeekOffset > 0 ? '+' : ''}${currentWeekOffset} sem`}
              </button>
              <button
                onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                title="Semaine suivante"
                aria-label="Semaine suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={() => setIsScriptModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Afficher le script d'aiguillage Liquidsoap généré"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Script Liquidsoap (.liq)</span>
            <span className="md:hidden">.liq</span>
          </button>

          <button
            onClick={handleExportJson}
            className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
            title="Exporter l'agenda au format JSON"
            aria-label="Exporter l'agenda"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-400/20"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un Créneau</span>
          </button>
        </div>
      </div>

      {/* AGENDA CONTENT CONTAINER (PASSES BEHIND STICKY TOP BAR) */}
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 text-left">
        {/* 2. BANNIÈRE ÉTAT ACTUEL EN DIRECT SUR LA GRILLE */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                EN ONDE ACTUELLEMENT
              </span>
              <span className="text-xs font-bold text-white font-mono">
                {currentOnAir ? currentOnAir.title : 'AutoDJ Régulier & Rotation Automatique'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
              {currentOnAir 
                ? `Animé par ${currentOnAir.host} • Horaires : ${currentOnAir.startTime} - ${currentOnAir.endTime} • Style : ${currentOnAir.genre}`
                : 'Aucune émission spéciale planifiée sur ce créneau horaire. Le flux principal diffuse la médiathèque standard.'}
            </p>
          </div>
        </div>

        {currentOnAir && (
          <div className="flex items-center gap-2 flex-wrap">
            {currentOnAir.features.allowLiveChat && (
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Chat Live Actif
              </span>
            )}
            {currentOnAir.features.allowSongRequests && (
              <span className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[11px] font-mono flex items-center gap-1">
                <Music className="w-3 h-3" /> Dédicaces & Demandes de titres
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-300 text-[11px] font-mono border border-zinc-800">
              Jingle tous les {currentOnAir.jingleRotation.frequencyTracks} titres
            </span>
          </div>
        )}
      </div>

      {/* 3. VUE 1 : GRILLE HEBDOMADAIRE CHRONOLOGIQUE (7 JOURS) */}
      {viewMode === 'week' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {currentWeekDays.map((day) => {
              // Get events for this specific day
              const dayEvents = stationFilteredEvents.filter((ev) => {
                if (ev.scheduleType === 'weekly_recurring') {
                  return ev.daysOfWeek?.includes(day.dayIndex);
                }
                if (ev.scheduleType === 'specific_date') {
                  return ev.specificDate === day.dateStr;
                }
                return false;
              }).sort((a, b) => a.startTime.localeCompare(b.startTime));

              return (
                <div
                  key={day.dateStr}
                  className={`flex flex-col rounded-2xl border transition-all ${
                    day.isToday 
                      ? 'bg-zinc-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5' 
                      : 'bg-zinc-950/70 border-zinc-800/80'
                  }`}
                >
                  {/* Day Header */}
                  <div className={`p-3 border-b flex items-center justify-between ${
                    day.isToday ? 'border-amber-500/30 bg-amber-500/10' : 'border-zinc-800/80 bg-zinc-900/40'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-mono font-bold ${day.isToday ? 'text-amber-400' : 'text-zinc-200'}`}>
                        {day.label}
                      </span>
                      {day.isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {dayEvents.length} créneau(x)
                    </span>
                  </div>

                  {/* Program Events for the day */}
                  <div className="p-2.5 flex flex-col gap-2.5 min-h-[220px]">
                    {dayEvents.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800/80 rounded-xl text-zinc-600">
                        <Calendar className="w-5 h-5 mb-1 opacity-40" />
                        <span className="text-[11px] font-mono">Rotation AutoDJ</span>
                      </div>
                    ) : (
                      dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          style={{ borderLeftColor: ev.color }}
                          className={`p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/90 border-l-4 flex flex-col gap-2 text-left shadow hover:border-zinc-700 transition-all ${
                            !ev.isActive ? 'opacity-50' : ''
                          }`}
                        >
                          {/* Time & Badge */}
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-xs font-bold font-mono text-white flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-400" />
                              {ev.startTime} - {ev.endTime}
                            </span>
                            <span
                              style={{ backgroundColor: `${ev.color}25`, color: ev.color }}
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase truncate max-w-[110px]"
                            >
                              {ev.badge}
                            </span>
                          </div>

                          {/* Title & Host */}
                          <div>
                            <h4 className="text-xs font-bold text-white line-clamp-1 font-mono">
                              {ev.title}
                            </h4>
                            <p className="text-[10.5px] text-zinc-400 font-mono line-clamp-1 mt-0.5">
                              {ev.host} • <span className="text-zinc-500">{ev.genre}</span>
                            </p>
                          </div>

                          {/* Features Pills */}
                          <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-zinc-800/80">
                            {ev.features.allowLiveChat && (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/20 text-[9.5px] font-mono" title="Chat live activé">
                                Chat
                              </span>
                            )}
                            {ev.features.allowSongRequests && (
                              <span className="px-1.5 py-0.5 rounded bg-pink-950/60 text-pink-400 border border-pink-500/20 text-[9.5px] font-mono" title="Demandes de chansons autorisées">
                                Dédicaces
                              </span>
                            )}
                            {ev.jingleRotation.enabled && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-500/20 text-[9.5px] font-mono" title={`Jingle tous les ${ev.jingleRotation.frequencyTracks} titres`}>
                                Jingle /{ev.jingleRotation.frequencyTracks}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[11px] font-mono">
                            <button
                              onClick={() => handleToggleEventActive(ev.id, ev.isActive)}
                              className={`text-[10px] cursor-pointer ${ev.isActive ? 'text-emerald-400' : 'text-zinc-500'}`}
                            >
                              {ev.isActive ? 'En service' : 'Désactivé'}
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(ev)}
                                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                                title="Modifier ce créneau"
                                aria-label="Modifier"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(ev.id, ev.title)}
                                className="p-1 rounded text-red-400/80 hover:text-red-300 hover:bg-red-950/40 cursor-pointer"
                                title="Supprimer ce créneau"
                                aria-label="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. VUE 2 : CALENDRIER 3 MOIS (90 JOURS À L'AVANCE) */}
      {viewMode === 'month' && (
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Planification Temporelle à 3 Mois</span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Créez des événements ponctuels ou récurrents étalés sur les 90 prochains jours pour anticiper les grilles estivales, fêtes ou émissions spéciales.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Programmer sur une date</span>
            </button>
          </div>

          {/* 3 months display preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((monthIndex) => {
              const targetDate = new Date();
              targetDate.setMonth(targetDate.getMonth() + monthIndex);
              const monthName = targetDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
              
              const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
              const firstDayOfWeek = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getDay(); // 0-6

              return (
                <div key={monthIndex} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col gap-3">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                    {monthName}
                  </span>

                  {/* Day labels */}
                  <div className="grid grid-cols-7 gap-1 text-[10px] font-mono text-zinc-500 text-center">
                    {DAYS_SHORT.map((d) => (
                      <span key={d}>{d[0]}</span>
                    ))}
                  </div>

                  {/* Month days grid */}
                  <div className="grid grid-cols-7 gap-1 text-xs font-mono">
                    {Array.from({ length: firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 }).map((_, i) => (
                      <div key={`empty-${i}`} className="p-1.5 text-zinc-800 text-center" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNumber = i + 1;
                      const dayDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), dayNumber);
                      const dayDateStr = formatDateYMD(dayDate);
                      const isToday = formatDateYMD(new Date()) === dayDateStr;

                      // Check count of programs on this day
                      const dayEvents = stationFilteredEvents.filter((ev) => {
                        if (ev.scheduleType === 'weekly_recurring') {
                          return ev.daysOfWeek?.includes(dayDate.getDay());
                        }
                        if (ev.scheduleType === 'specific_date') {
                          return ev.specificDate === dayDateStr;
                        }
                        return false;
                      });

                      const hasEvents = dayEvents.length > 0;

                      return (
                        <button
                          key={dayNumber}
                          onClick={() => {
                            setSelectedDateFilter(selectedDateFilter === dayDateStr ? null : dayDateStr);
                          }}
                          className={`p-1.5 rounded-lg text-center cursor-pointer transition-all flex flex-col items-center justify-center relative ${
                            selectedDateFilter === dayDateStr
                              ? 'bg-amber-400 text-black font-bold ring-2 ring-amber-400'
                              : isToday
                              ? 'bg-zinc-800 text-amber-300 font-bold border border-amber-500/40'
                              : hasEvents
                              ? 'bg-zinc-900 text-white hover:bg-zinc-800 border border-white/10'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                          }`}
                        >
                          <span>{dayNumber}</span>
                          {hasEvents && (
                            <span className="w-1 h-1 rounded-full bg-amber-400 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Date Details */}
          {selectedDateFilter && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-amber-500/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Émissions programmées pour le {selectedDateFilter} :
                </span>
                <button
                  onClick={() => setSelectedDateFilter(null)}
                  className="text-xs font-mono text-zinc-400 hover:text-white cursor-pointer"
                >
                  Fermer filtre
                </button>
              </div>

              {stationFilteredEvents.filter((ev) => {
                const d = new Date(selectedDateFilter);
                if (ev.scheduleType === 'weekly_recurring') return ev.daysOfWeek?.includes(d.getDay());
                if (ev.scheduleType === 'specific_date') return ev.specificDate === selectedDateFilter;
                return false;
              }).map((ev) => (
                <div key={ev.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-amber-400">{ev.startTime} - {ev.endTime}</span>
                    <span className="text-xs font-mono font-bold text-white">{ev.title}</span>
                    <span className="text-[11px] font-mono text-zinc-400">({ev.host})</span>
                  </div>
                  <button
                    onClick={() => handleOpenEdit(ev)}
                    className="text-xs font-mono text-zinc-300 hover:text-white underline cursor-pointer"
                  >
                    Modifier
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. VUE 3 : LISTE CHRONOLOGIQUE COMPLÈTE */}
      {viewMode === 'list' && (
        <div className="flex flex-col gap-3">
          {stationFilteredEvents.map((ev) => {
            const playlistNames = ev.playlistIds
              .map((id) => playlists.find((p) => p.id === id)?.name || id)
              .join(', ');

            return (
              <div
                key={ev.id}
                style={{ borderLeftColor: ev.color }}
                className={`p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 border-l-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  !ev.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="flex flex-col gap-2 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      style={{ backgroundColor: `${ev.color}20`, color: ev.color }}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                    >
                      {ev.badge}
                    </span>
                    <h3 className="text-sm sm:text-base font-mono font-bold text-white">
                      {ev.title}
                    </h3>
                    <span className="text-xs font-mono text-zinc-400">
                      par <strong className="text-zinc-200">{ev.host}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 font-mono line-clamp-2">
                    {ev.description || 'Aucune description rédigée pour ce créneau.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400 pt-1">
                    <span className="flex items-center gap-1 text-white font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {ev.startTime} - {ev.endTime}
                    </span>
                    <span>•</span>
                    <span>
                      {ev.scheduleType === 'weekly_recurring'
                        ? `Chaque ${ev.daysOfWeek?.map((d) => DAYS_NAMES[d]).join(', ')}`
                        : `Date unique : ${ev.specificDate}`}
                    </span>
                    <span>•</span>
                    <span className="text-zinc-300">Playlists : <strong>{playlistNames}</strong> ({ev.playbackBehavior})</span>
                  </div>

                  {/* Jingles & Interactivity info */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {ev.jingleIntro.enabled && (
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10.5px] font-mono text-zinc-300">
                        Intro Drop ✓
                      </span>
                    )}
                    {ev.jingleOutro.enabled && (
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10.5px] font-mono text-zinc-300">
                        Outro Drop ✓
                      </span>
                    )}
                    {ev.jingleRotation.enabled && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10.5px] font-mono">
                        1 jingle tous les {ev.jingleRotation.frequencyTracks} titres
                      </span>
                    )}
                    {ev.features.allowLiveChat && (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10.5px] font-mono">
                        Chat en direct
                      </span>
                    )}
                    {ev.features.allowSongRequests && (
                      <span className="px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/30 text-[10.5px] font-mono">
                        Dédicaces ouvertes
                      </span>
                    )}
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleToggleEventActive(ev.id, ev.isActive)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                      ev.isActive
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {ev.isActive ? 'Actif' : 'En pause'}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(ev)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 cursor-pointer"
                    title="Modifier l'émission"
                    aria-label="Modifier l'émission"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteEvent(ev.id, ev.title)}
                    className="p-2 rounded-xl bg-red-950/40 hover:bg-red-950 border border-red-500/30 text-red-400 cursor-pointer"
                    title="Supprimer du planning"
                    aria-label="Supprimer du planning"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* 6. MODAL FORMULAIRE DE CRÉATION / ÉDITION D'UNE ÉMISSION */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-2xl w-full flex flex-col gap-5 shadow-2xl my-auto text-left">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">
                    {editingEventId ? 'Modifier le Programme d\'Antenne' : 'Programmer une Nouvelle Émission'}
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono">
                    Paramétrez le timing, les playlists Liquidsoap, les jingles et les modules en direct
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Fermer la fenêtre"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEvent} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-1">
              
              {/* SECTION A: INFORMATIONS GÉNÉRALES */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-3 font-mono text-xs">
                <span className="text-amber-400 font-bold uppercase text-[11px] tracking-wider">
                  1. Identification du Programme
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 block mb-1">Titre de l'émission *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mix 60/70 Rock'n Roll"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Animateur(s) / DJ</label>
                    <input
                      type="text"
                      placeholder="Ex: DJ Max, Sarah, AutoDJ"
                      value={formHost}
                      onChange={(e) => setFormHost(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-zinc-400 block mb-1">Genre / Style Musical</label>
                    <input
                      type="text"
                      placeholder="Ex: Rock Classic, Synthwave"
                      value={formGenre}
                      onChange={(e) => setFormGenre(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Badge d'Affichage</label>
                    <input
                      type="text"
                      placeholder="Ex: DIRECT LIVE, MIX DU SOIR"
                      value={formBadge}
                      onChange={(e) => setFormBadge(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Radio Cible</label>
                    <select
                      value={formStationId}
                      onChange={(e) => setFormStationId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="all">Toutes les radios (Flux Maître)</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Description pour les auditeurs</label>
                  <textarea
                    rows={2}
                    placeholder="Présentation du show, thématiques, artistes à l'honneur..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                {/* Color Selector */}
                <div>
                  <label className="text-zinc-400 block mb-1.5">Couleur visuelle dans l'agenda</label>
                  <div className="flex items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-7 h-7 rounded-xl transition-all cursor-pointer ${
                          formColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        aria-label={`Choisir couleur ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION B: CALENDRIER & CHRONOLOGIE (JUSQU'À 3 MOIS) */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-3 font-mono text-xs">
                <span className="text-cyan-400 font-bold uppercase text-[11px] tracking-wider">
                  2. Timing & Horaires de Diffusion
                </span>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleType"
                      checked={formScheduleType === 'weekly_recurring'}
                      onChange={() => setFormScheduleType('weekly_recurring')}
                      className="text-amber-400"
                    />
                    <span>Récurrence Hebdomadaire</span>
                  </label>
                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleType"
                      checked={formScheduleType === 'specific_date'}
                      onChange={() => setFormScheduleType('specific_date')}
                      className="text-amber-400"
                    />
                    <span>Date Spécifique (Jusqu'à 3 mois)</span>
                  </label>
                </div>

                {formScheduleType === 'weekly_recurring' ? (
                  <div>
                    <label className="text-zinc-400 block mb-1.5">Jours de diffusion chaque semaine :</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                        const isSelected = formDaysOfWeek.includes(dayIdx);
                        return (
                          <button
                            key={dayIdx}
                            type="button"
                            onClick={() => toggleDaySelection(dayIdx)}
                            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-400 text-black shadow'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                            }`}
                          >
                            {DAYS_NAMES[dayIdx]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-zinc-400 block mb-1">Date de l'événement (jusqu'à 3 mois) :</label>
                    <input
                      type="date"
                      value={formSpecificDate}
                      onChange={(e) => setFormSpecificDate(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    />
                  </div>
                )}

                {/* Start & End Time */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-zinc-400 block mb-1">Heure de début (HH:MM)</label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Heure de fin (HH:MM)</label>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION C: ASSOCIATION DES PLAYLISTS EXISTANTES & COMPORTEMENT */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-3 font-mono text-xs">
                <span className="text-emerald-400 font-bold uppercase text-[11px] tracking-wider">
                  3. Playlists Liquidsoap & Comportement de Lecture
                </span>

                <div>
                  <label className="text-zinc-400 block mb-2">
                    Sélectionnez une ou plusieurs playlists de la médiathèque :
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {playlists.map((pl) => {
                      const isChecked = formPlaylistIds.includes(pl.id);
                      return (
                        <div
                          key={pl.id}
                          onClick={() => togglePlaylistSelection(pl.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              style={{ backgroundColor: pl.color }}
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                            />
                            <span className="font-bold">{pl.name}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500">{pl.trackCount} titres</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1.5">Comportement de lecture :</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'shuffle', label: 'Aléatoire (Shuffle)' },
                      { id: 'sequential', label: 'Séquentiel (Ordre strict)' },
                      { id: 'weighted', label: 'Pondéré par poids' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFormPlaybackBehavior(b.id as any)}
                        className={`p-2 rounded-xl text-center font-mono text-xs transition-all cursor-pointer ${
                          formPlaybackBehavior === b.id
                            ? 'bg-emerald-400 text-black font-bold shadow'
                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION D: RÈGLES D'HABILLAGE SONORE & JINGLES */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-3 font-mono text-xs">
                <span className="text-purple-400 font-bold uppercase text-[11px] tracking-wider">
                  4. Habillage Sonore & Règles des Jingles
                </span>

                {/* Intro Jingle */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-white font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formJingleIntroEnabled}
                        onChange={(e) => setFormJingleIntroEnabled(e.target.checked)}
                        className="rounded text-purple-500"
                      />
                      <span>Jingle d'entrée au démarrage du programme</span>
                    </label>
                    <span className="text-[10px] text-purple-400 font-bold">Intro Drop</span>
                  </div>
                  {formJingleIntroEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Libellé (ex: Drop Rock'n Roll)"
                        value={formJingleIntroName}
                        onChange={(e) => setFormJingleIntroName(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-[11px]"
                      />
                      <input
                        type="text"
                        placeholder="Fichier audio (/var/media/...)"
                        value={formJingleIntroPath}
                        onChange={(e) => setFormJingleIntroPath(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-[11px]"
                      />
                    </div>
                  )}
                </div>

                {/* Outro Jingle */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-white font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formJingleOutroEnabled}
                        onChange={(e) => setFormJingleOutroEnabled(e.target.checked)}
                        className="rounded text-purple-500"
                      />
                      <span>Jingle de sortie à la fin du programme</span>
                    </label>
                    <span className="text-[10px] text-purple-400 font-bold">Outro Drop</span>
                  </div>
                  {formJingleOutroEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Libellé (ex: Fin de créneau Salutations)"
                        value={formJingleOutroName}
                        onChange={(e) => setFormJingleOutroName(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-[11px]"
                      />
                      <input
                        type="text"
                        placeholder="Fichier audio (/var/media/...)"
                        value={formJingleOutroPath}
                        onChange={(e) => setFormJingleOutroPath(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white text-[11px]"
                      />
                    </div>
                  )}
                </div>

                {/* Frequency Rotation */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-white font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formJingleRotationEnabled}
                        onChange={(e) => setFormJingleRotationEnabled(e.target.checked)}
                        className="rounded text-purple-500"
                      />
                      <span>Jingle d'antenne régulier pendant le show</span>
                    </label>
                    <span className="text-[10px] text-amber-400 font-bold">Rotation</span>
                  </div>
                  {formJingleRotationEnabled && (
                    <div className="flex items-center justify-between gap-3 mt-1">
                      <span className="text-zinc-400 text-xs">Fréquence : passer 1 jingle tous les :</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={formJingleFrequency}
                          onChange={(e) => setFormJingleFrequency(parseInt(e.target.value) || 3)}
                          className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-amber-300 font-bold font-mono cursor-pointer"
                        >
                          <option value={1}>1 titre (Très dense)</option>
                          <option value={2}>2 titres</option>
                          <option value={3}>3 titres (Recommandé)</option>
                          <option value={4}>4 titres</option>
                          <option value={5}>5 titres</option>
                          <option value={6}>6 titres (Espacé)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION E: FONCTIONNALITÉS EN DIRECT PENDANT LE SHOW */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col gap-3 font-mono text-xs">
                <span className="text-pink-400 font-bold uppercase text-[11px] tracking-wider">
                  5. Fonctionnalités Interactives en Direct pour ce Programme
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-white font-bold flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                        Chat en direct
                      </span>
                      <span className="text-[10px] text-zinc-400">Ouvre le canal de discussion en direct</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formAllowChat}
                      onChange={(e) => setFormAllowChat(e.target.checked)}
                      className="rounded text-cyan-400"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-white font-bold flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-pink-400" />
                        Envoi de titres & Dédicaces
                      </span>
                      <span className="text-[10px] text-zinc-400">Les auditeurs peuvent demander des chansons</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formAllowSongRequests}
                      onChange={(e) => setFormAllowSongRequests(e.target.checked)}
                      className="rounded text-pink-400"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-white font-bold flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        Votes & Réactions Live
                      </span>
                      <span className="text-[10px] text-zinc-400">Sondages en temps réel sur le player</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formAllowLiveVoting}
                      onChange={(e) => setFormAllowLiveVoting(e.target.checked)}
                      className="rounded text-orange-400"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between cursor-pointer">
                    <div className="flex flex-col">
                      <span className="text-white font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Événement Majeur / Spécial
                      </span>
                      <span className="text-[10px] text-zinc-400">Affiche une animation néon sur le lecteur</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formIsLiveSpecial}
                      onChange={(e) => setFormIsLiveSpecial(e.target.checked)}
                      className="rounded text-amber-400"
                    />
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-400/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer l'Émission</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL LIQUIDSOAP SCRIPT VIEWER */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-3xl w-full flex flex-col gap-4 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Script d'Aiguillage Liquidsoap (schedule_synapse.liq)
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Ce bloc Liquidsoap intègre les règles d'agenda, switches horaires, jingles d'entrée/sortie et rotations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-black/90 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto max-h-[450px] custom-scrollbar select-text leading-relaxed">
              {generatedScript}
            </pre>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={handleCopyScript}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Copier le Code</span>
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([generatedScript], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'schedule_synapse.liq';
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('💾 Fichier schedule_synapse.liq téléchargé');
                }}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger .liq</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
