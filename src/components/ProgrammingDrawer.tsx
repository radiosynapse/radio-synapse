import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, Clock, Radio, Sparkles, Mic2, 
  Play, Moon, Sun, Sunset, Sunrise
} from 'lucide-react';
import Drawer from './Drawer';
import { StreamChannel } from '../data';
import { getAdminSchedules, AdminScheduleShow } from '../utils/adminStore';

interface ProgrammingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  activeStationId?: string;
  stations?: StreamChannel[];
  onSelectStation?: (stationId: string) => void;
  onOpenAdminPanel?: () => void;
}

interface ScheduleShow {
  id: string;
  startTime: string;
  endTime: string;
  startHour: number;
  endHour: number;
  title: string;
  host: string;
  genre: string;
  badge: string;
  description: string;
  highlights?: string[];
}

interface SchedulePeriod {
  id: 'morning' | 'day' | 'evening' | 'night';
  title: string;
  timeRange: string;
  startHour: number;
  endHour: number;
  icon: typeof Sun;
  color: string;
  bgColor: string;
  borderColor: string;
  shows: ScheduleShow[];
}

// Convert "08:30" string to decimal hours (8.5)
const parseTimeToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h + m / 60;
};

// Generate 14-day window around today
interface DateItem {
  date: Date;
  dateKey: string;
  dayLabel: string;
  dayNumber: number;
  monthLabel: string;
  isToday: boolean;
}

const generateDateList = (): DateItem[] => {
  const dates: DateItem[] = [];
  const today = new Date();

  for (let i = -2; i <= 12; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);

    const isToday = i === 0;
    const dayNames = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
    const monthNames = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];

    dates.push({
      date: d,
      dateKey: d.toISOString().split('T')[0],
      dayLabel: isToday ? 'AUJ.' : dayNames[d.getDay()],
      dayNumber: d.getDate(),
      monthLabel: monthNames[d.getMonth()],
      isToday
    });
  }
  return dates;
};

export default function ProgrammingDrawer({
  isOpen,
  onClose,
  activeStationId,
  stations = [],
  onSelectStation,
  onOpenAdminPanel,
}: ProgrammingDrawerProps) {
  const availableStations = stations && stations.length > 0 ? stations : [];
  
  const [selectedStationId, setSelectedStationId] = useState<string>(
    activeStationId || availableStations[0]?.id || ''
  );

  // Synchronize when station or drawer opens
  useEffect(() => {
    if (isOpen && activeStationId) {
      setSelectedStationId(activeStationId);
    } else if (availableStations.length > 0 && (!selectedStationId || !availableStations.some(s => s.id === selectedStationId))) {
      setSelectedStationId(availableStations[0].id);
    }
  }, [isOpen, activeStationId, availableStations, selectedStationId]);

  const dateList = useMemo(() => generateDateList(), []);
  const todayKey = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const isSelectedDateToday = selectedDateKey === todayKey;

  const stationsCarouselRef = useRef<HTMLDivElement>(null);
  const datesCarouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && datesCarouselRef.current) {
      const todayElem = datesCarouselRef.current.querySelector(`[data-date-today="true"]`);
      if (todayElem) {
        todayElem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [isOpen]);

  const now = new Date();
  const currentDecimalHour = now.getHours() + now.getMinutes() / 60;

  const currentPeriodId = useMemo<'morning' | 'day' | 'evening' | 'night'>(() => {
    if (currentDecimalHour >= 5 && currentDecimalHour < 10) return 'morning';
    if (currentDecimalHour >= 10 && currentDecimalHour < 17) return 'day';
    if (currentDecimalHour >= 17 && currentDecimalHour < 24) return 'evening';
    return 'night';
  }, [currentDecimalHour]);

  // Load schedules from real database store
  const allSchedules = useMemo(() => {
    return getAdminSchedules();
  }, [isOpen]);

  const basePeriods = useMemo<SchedulePeriod[]>(() => {
    if (!selectedStationId) return [];

    const stationShows = allSchedules.filter((s: AdminScheduleShow) => 
      s.stationId === selectedStationId || s.stationId === 'all'
    );

    const mapToShow = (s: AdminScheduleShow): ScheduleShow => ({
      id: s.id,
      startTime: s.startTime || '00:00',
      endTime: s.endTime || '00:00',
      startHour: parseTimeToDecimal(s.startTime),
      endHour: parseTimeToDecimal(s.endTime),
      title: s.title,
      host: s.host,
      genre: s.genre,
      badge: s.badge || 'Émission',
      description: s.description,
      highlights: []
    });

    const morningShows = stationShows.filter(s => s.period === 'morning').map(mapToShow);
    const dayShows = stationShows.filter(s => s.period === 'day').map(mapToShow);
    const eveningShows = stationShows.filter(s => s.period === 'evening').map(mapToShow);
    const nightShows = stationShows.filter(s => s.period === 'night').map(mapToShow);

    return [
      {
        id: 'morning',
        title: 'Programme du matin',
        timeRange: '05h00 - 10h00',
        startHour: 5,
        endHour: 10,
        icon: Sunrise,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        shows: morningShows
      },
      {
        id: 'day',
        title: 'Programme de la journée',
        timeRange: '10h00 - 17h00',
        startHour: 10,
        endHour: 17,
        icon: Sun,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/30',
        shows: dayShows
      },
      {
        id: 'evening',
        title: 'Programme du soir',
        timeRange: '17h00 - 00h00',
        startHour: 17,
        endHour: 24,
        icon: Sunset,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
        shows: eveningShows
      },
      {
        id: 'night',
        title: 'Programme de la nuit',
        timeRange: '00h00 - 05h00',
        startHour: 0,
        endHour: 5,
        icon: Moon,
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-500/10',
        borderColor: 'border-indigo-500/30',
        shows: nightShows
      }
    ];
  }, [allSchedules, selectedStationId]);

  const orderedPeriods = useMemo(() => {
    if (!isSelectedDateToday || basePeriods.length === 0) {
      return basePeriods;
    }

    const periodOrder: Array<'morning' | 'day' | 'evening' | 'night'> = ['morning', 'day', 'evening', 'night'];
    const currentIndex = periodOrder.indexOf(currentPeriodId);
    if (currentIndex === -1) return basePeriods;

    const rotatedOrder: SchedulePeriod[] = [];
    for (let i = 0; i < 4; i++) {
      const idx = (currentIndex + i) % 4;
      const targetId = periodOrder[idx];
      const matched = basePeriods.find(p => p.id === targetId);
      if (matched) rotatedOrder.push(matched);
    }
    return rotatedOrder;
  }, [basePeriods, isSelectedDateToday, currentPeriodId]);

  const totalShowsCount = useMemo(() => {
    return basePeriods.reduce((acc, p) => acc + p.shows.length, 0);
  }, [basePeriods]);

  const selectedStation = availableStations.find(s => s.id === selectedStationId) || availableStations[0];

  return (
    <Drawer
      id="programming-schedule-drawer"
      isOpen={isOpen}
      onClose={onClose}
      isFullScreen={true}
      maxWidthClass="max-w-4xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-futuristic text-xs sm:text-sm font-bold uppercase tracking-widest text-white">
              Grille des Programmes & Direct
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              Horaires 24h/24 • Synchronisation Supabase
            </span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-2 w-full max-w-3xl mx-auto">
        {availableStations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-zinc-950/60 border border-dashed border-white/15">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-zinc-500">
              <Radio className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-2 font-futuristic">
              Aucune station programmée
            </h3>
            <p className="text-sm text-zinc-400 max-w-md font-mono leading-relaxed mb-4">
              Les grilles de programmes apparaîtront ici dès qu'une station sera configurée dans le panneau d'administration ou synchronisée avec Supabase.
            </p>
            {onOpenAdminPanel && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                Configurer une station dans l'Admin
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 1. Station Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-white" />
                  1. Choisissez votre station
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {availableStations.length} station{availableStations.length > 1 ? 's' : ''}
                </span>
              </div>

              <div 
                ref={stationsCarouselRef}
                className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory select-none"
              >
                {availableStations.map((st, sIdx) => {
                  const isSelected = st.id === selectedStationId;
                  const isCurrentlyPlaying = st.id === activeStationId;

                  return (
                    <button
                      key={`prog-st-${st.id || 'station'}-${sIdx}`}
                      onClick={() => setSelectedStationId(st.id)}
                      className={`snap-start flex-shrink-0 flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-left ${
                        isSelected
                          ? 'bg-zinc-900 border-white text-white shadow-[0_0_18px_rgba(255,255,255,0.15)] min-w-[210px] sm:min-w-[240px]'
                          : 'bg-black/40 hover:bg-zinc-900/60 border-white/10 hover:border-white/25 text-zinc-400 min-w-[190px] sm:min-w-[220px]'
                      }`}
                    >
                      <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-white/20 flex-shrink-0">
                        <img 
                          src={st.tracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80'} 
                          alt={st.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        {isCurrentlyPlaying && (
                          <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black shadow-[0_0_8px_#10b981]" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={`text-xs sm:text-sm font-futuristic font-bold uppercase tracking-wider truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                          {st.name.replace(/^Radio Synapse\s*-\s*/i, '')}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                          {st.genre}
                        </span>
                        {isCurrentlyPlaying && (
                          <span className="text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            À L'ÉCOUTE
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Date Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-white" />
                  2. Date de la programmation
                </span>
                <span className="text-[10px] font-mono text-zinc-300 font-bold">
                  {isSelectedDateToday ? 'AUJOURD’HUI EN DIRECT' : selectedDateKey}
                </span>
              </div>

              <div 
                ref={datesCarouselRef}
                className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory select-none"
              >
                {dateList.map((item, dIdx) => {
                  const isSelected = item.dateKey === selectedDateKey;

                  return (
                    <button
                      key={`prog-date-${item.dateKey}-${dIdx}`}
                      data-date-today={item.isToday ? "true" : undefined}
                      onClick={() => setSelectedDateKey(item.dateKey)}
                      className={`snap-start flex-shrink-0 flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 cursor-pointer min-w-[70px] sm:min-w-[82px] relative overflow-hidden ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-[0_0_18px_rgba(255,255,255,0.25)] font-bold'
                          : item.isToday
                          ? 'bg-zinc-900/90 text-white border-white/30 hover:border-white/50'
                          : 'bg-black/40 hover:bg-zinc-900/60 border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {item.isToday && (
                        <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full mb-1 ${
                          isSelected ? 'bg-black text-white' : 'bg-white/20 text-white'
                        }`}>
                          AUJ.
                        </span>
                      )}
                      <span className={`text-[10px] font-mono font-bold tracking-wider ${isSelected ? 'text-black/80' : 'text-zinc-400'}`}>
                        {item.dayLabel}
                      </span>
                      <span className={`text-base sm:text-lg font-futuristic font-bold my-0.5 ${isSelected ? 'text-black' : 'text-white'}`}>
                        {item.dayNumber}
                      </span>
                      <span className={`text-[9px] font-mono tracking-widest ${isSelected ? 'text-black/70' : 'text-zinc-500'}`}>
                        {item.monthLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Station Quick Summary Bar */}
            {selectedStation && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-white/15 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-futuristic font-bold text-white uppercase tracking-wider truncate">
                        {selectedStation.name}
                      </span>
                      {isSelectedDateToday && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse flex-shrink-0">
                          DIRECT ACTIF
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 truncate">
                      {selectedStation.description}
                    </span>
                  </div>
                </div>

                {onSelectStation && (
                  <button
                    onClick={() => {
                      onClose();
                      onSelectStation(selectedStation.id);
                    }}
                    className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">Écouter</span>
                  </button>
                )}
              </div>
            )}

            {/* 3. Programming Sections */}
            {totalShowsCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl bg-zinc-950/60 border border-dashed border-white/15">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-zinc-500">
                  <Calendar className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1 font-futuristic">
                  Aucune émission enregistrée
                </h4>
                <p className="text-xs text-zinc-400 max-w-sm font-mono leading-relaxed mb-4">
                  Aucun créneau d'émission n'est actuellement configuré pour cette station. Ajoutez des émissions dans le panneau d'administration pour remplir cette grille.
                </p>
                {onOpenAdminPanel && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAdminPanel();
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md"
                  >
                    Ajouter une émission dans l'Admin
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5 pt-1">
                {orderedPeriods.map((period, periodIndex) => {
                  const PeriodIcon = period.icon;
                  const isPeriodCurrentlyActive = isSelectedDateToday && period.id === currentPeriodId;

                  if (period.shows.length === 0) return null;

                  return (
                    <div 
                      key={`prog-period-${period.id}-${periodIndex}`}
                      className={`flex flex-col gap-3 rounded-2xl border transition-all p-4 sm:p-5 ${
                        isPeriodCurrentlyActive
                          ? 'bg-zinc-950/90 border-white/40 shadow-[0_0_24px_rgba(255,255,255,0.08)] relative overflow-hidden'
                          : 'bg-black/40 border-white/10'
                      }`}
                    >
                      {isPeriodCurrentlyActive && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent" />
                      )}

                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl border ${period.bgColor} ${period.borderColor} ${period.color}`}>
                            <PeriodIcon className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <div className="flex items-center gap-2">
                              <h3 className="font-futuristic text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                                {period.title}
                              </h3>
                              {isPeriodCurrentlyActive && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                                  EN COURS
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-zinc-400">
                              Créneau officiel : {period.timeRange}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-zinc-400 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 font-bold">
                          {periodIndex === 0 && isSelectedDateToday ? 'ACTUELLEMENT' : `BLOC ${periodIndex + 1}/4`}
                        </span>
                      </div>

                      <div className="flex flex-col gap-3">
                        {period.shows.map((show, showIdx) => {
                          const isShowLiveNow = isSelectedDateToday && (
                            (show.startHour <= currentDecimalHour && currentDecimalHour < show.endHour) ||
                            (show.startHour > show.endHour && (currentDecimalHour >= show.startHour || currentDecimalHour < show.endHour))
                          );

                          return (
                            <div
                              key={`prog-show-${period.id}-${show.id || 'show'}-${showIdx}`}
                              className={`p-3.5 sm:p-4 rounded-xl border transition-all text-left flex flex-col gap-2.5 ${
                                isShowLiveNow
                                  ? 'bg-white/10 border-white shadow-lg'
                                  : 'bg-black/30 border-white/5 hover:border-white/15'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs font-mono font-bold">
                                  <Clock className="w-3.5 h-3.5 text-zinc-300" />
                                  <span className="text-white">{show.startTime} — {show.endTime}</span>
                                  {isShowLiveNow && (
                                    <span className="inline-flex items-center gap-1.5 text-[9.5px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 uppercase font-bold animate-pulse">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                      DIRECT SUR L'ANTENNE
                                    </span>
                                  )}
                                </div>

                                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                                  {show.badge}
                                </span>
                              </div>

                              <div>
                                <h4 className="text-sm sm:text-base font-bold text-white font-futuristic">
                                  {show.title}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-mono mt-1 text-zinc-300">
                                  <div className="flex items-center gap-1 text-white font-semibold">
                                    <Mic2 className="w-3 h-3 text-zinc-400" />
                                    <span>{show.host}</span>
                                  </div>
                                  <span className="text-zinc-600">•</span>
                                  <span className="text-zinc-400">{show.genre}</span>
                                </div>
                              </div>

                              {show.description && (
                                <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                                  {show.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
