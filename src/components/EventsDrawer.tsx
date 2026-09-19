import { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Radio, Sparkles, ExternalLink, Music, Loader2, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import Drawer from './Drawer';
import { fetchSupabaseEvents, AdminEvent, getAdminEvents } from '../utils/adminStore';

interface EventsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  onOpenAdminPanel?: () => void;
}

export default function EventsDrawer({
  isOpen,
  onClose,
  accentColor = '#00f2ff',
  onOpenAdminPanel,
}: EventsDrawerProps) {
  const [events, setEvents] = useState<AdminEvent[]>(() => getAdminEvents());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchSupabaseEvents();
    if (res.error && res.data.length === 0) {
      setError(res.error);
    } else {
      setEvents(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  return (
    <Drawer
      id="events-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div 
            className="p-1.5 rounded-lg bg-white/10 border border-white/20 text-white"
            style={{ borderColor: `${accentColor}60` }}
          >
            <CalendarDays className="w-4 h-4" />
          </div>
          <span className="font-futuristic text-[11px] sm:text-xs font-bold uppercase tracking-widest text-zinc-100">
            ÉVÈNEMENTS & DIRECTS SPÉCIAUX
          </span>
        </div>
      }
      subtitle="Festivals partenaires, sessions live extérieures et soirées Radio Synapse"
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-3 py-1">

        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
            Agenda des Soirées & Festivals ({events.length})
          </span>
          <button
            onClick={loadData}
            disabled={isLoading}
            title="Actualiser depuis Supabase"
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isLoading && events.length === 0 && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
            <span>Chargement des événements depuis Supabase...</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && events.length === 0 && (
          <div className="py-10 px-4 rounded-2xl bg-zinc-950/60 border border-dashed border-white/15 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-white font-futuristic">
                Aucun évènement à l'affiche
              </span>
              <p className="text-xs text-zinc-400 font-mono max-w-sm">
                Les festivals partenaires, sessions live extérieures et soirées programmées par l'équipe s'afficheront ici.
              </p>
            </div>
            {onOpenAdminPanel && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Programmer un évènement dans l'Admin</span>
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {events.map((ev, index) => (
            <div
              key={`event-card-${ev.id || 'ev'}-${index}`}
              className="p-4 rounded-2xl bg-black/50 border border-white/10 hover:border-white/30 transition-all text-left flex flex-col gap-2.5 shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-white border border-white/20">
                  {ev.type}
                </span>

                {ev.isLiveSoon && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 uppercase animate-pulse">
                    <Radio className="w-3 h-3 text-pink-400" />
                    Bientôt en direct
                  </span>
                )}
              </div>

              <h4 className="text-sm sm:text-base font-bold text-white font-futuristic">
                {ev.title}
              </h4>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-zinc-300" />
                  <span>{ev.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-pink-400" />
                  <span>{ev.location}</span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                {ev.desc}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                  <Music className="w-3 h-3" />
                  <span>{ev.broadcast}</span>
                </div>

                <button
                  onClick={() => alert(`Informations et alertes pour l'évènement "${ev.title}" activées !`)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>M'alerter</span>
                  <ExternalLink className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </Drawer>
  );
}
