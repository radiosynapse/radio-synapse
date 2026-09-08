import { useState, useEffect } from 'react';
import { Trophy, Award, Flame, CheckCircle2, Star, Sparkles, Music, Send, Loader2, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import Drawer from './Drawer';
import { fetchSupabaseChallenges, AdminChallenge, getAdminChallenges } from '../utils/adminStore';

interface ChallengesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  activeStationId?: string;
  onOpenAdminPanel?: () => void;
}

export default function ChallengesDrawer({
  isOpen,
  onClose,
  accentColor = '#00f2ff',
  activeStationId,
  onOpenAdminPanel,
}: ChallengesDrawerProps) {
  const [challenges, setChallenges] = useState<AdminChallenge[]>(() => getAdminChallenges());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactiveAnswers, setInteractiveAnswers] = useState<Record<string, string>>({});
  const [completedStatus, setCompletedStatus] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchSupabaseChallenges();
    if (res.error && res.data.length === 0) {
      setError(res.error);
    } else {
      setChallenges(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleActionChallenge = (challengeId: string) => {
    setCompletedStatus((prev) => ({ ...prev, [challengeId]: true }));
  };

  // Filter or prioritize station-specific challenges
  const filteredChallenges = challenges.filter(
    (c) => c.stationId === 'all' || !activeStationId || c.stationId === activeStationId
  );

  return (
    <Drawer
      id="challenges-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div 
            className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300"
            style={{ borderColor: `${accentColor}60` }}
          >
            <Trophy className="w-4 h-4" />
          </div>
          <span className="font-futuristic text-[11px] sm:text-xs font-bold uppercase tracking-widest text-zinc-100">
            DÉFIS & BADGES AUDITEUR
          </span>
        </div>
      }
      subtitle="Participez aux défis d'écoute, blind tests et concours créés pour votre station"
      maxWidthClass="max-w-xl"
    >
      <div className="flex flex-col gap-4 py-1">

        {/* User Level Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/50 via-zinc-900 to-pink-950/40 border border-amber-500/30 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-inner">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                NIVEAU 3 • AUDITEUR VIP
              </span>
              <span className="text-sm sm:text-base font-bold text-white font-futuristic">
                500 Points Synapse
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Série en cours</span>
            <span className="text-sm font-mono font-bold text-emerald-400">🔥 5 Jours</span>
          </div>
        </div>

        {/* Challenge list */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Défis Disponibles ({filteredChallenges.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                disabled={isLoading}
                title="Actualiser depuis Supabase"
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {activeStationId && (
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
                  Station: {activeStationId}
                </span>
              )}
            </div>
          </div>

          {isLoading && challenges.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span>Chargement des défis depuis Supabase...</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && filteredChallenges.length === 0 && (
            <div className="py-10 px-4 rounded-2xl bg-zinc-950/60 border border-dashed border-white/15 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-white font-futuristic">
                  Aucun défi actif pour le moment
                </span>
                <p className="text-xs text-zinc-400 font-mono max-w-sm">
                  Les nouveaux défis d'écoute, blind tests et quêtes créés par l'administration apparaîtront ici.
                </p>
              </div>
              {onOpenAdminPanel && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdminPanel();
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer un défi dans l'Admin</span>
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5">
            {filteredChallenges.map((c, idx) => {
              const isCompleted = completedStatus[c.id] || c.completed;
              return (
                <div
                  key={`challenge-${c.id || 'chal'}-${idx}`}
                  className={`p-4 rounded-2xl border transition-all text-left flex flex-col gap-2.5 ${
                    isCompleted
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-black/50 border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-bold text-white font-futuristic">
                        {c.title}
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      +{c.points} pts
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 font-mono">
                    {c.desc}
                  </p>

                  {/* INTERACTIVE CHALLENGE INPUTS DEPENDING ON TYPE */}
                  {!isCompleted && c.type === 'blind_test' && (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Votre réponse (Titre ou Artiste)..."
                        value={interactiveAnswers[c.id] || ''}
                        onChange={(e) => setInteractiveAnswers({ ...interactiveAnswers, [c.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => handleActionChallenge(c.id)}
                        disabled={!interactiveAnswers[c.id]}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs font-mono cursor-pointer flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Valider</span>
                      </button>
                    </div>
                  )}

                  {!isCompleted && c.type === 'suggest_track' && (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Proposer un titre (ex: Daft Punk - One More Time)..."
                        value={interactiveAnswers[c.id] || ''}
                        onChange={(e) => setInteractiveAnswers({ ...interactiveAnswers, [c.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => handleActionChallenge(c.id)}
                        disabled={!interactiveAnswers[c.id]}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs font-mono cursor-pointer flex items-center gap-1"
                      >
                        <Music className="w-3 h-3" />
                        <span>Envoyer</span>
                      </button>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>Progression : {isCompleted ? c.total : c.progress} / {c.total}</span>
                      <span>{isCompleted ? '100%' : `${Math.round((c.progress / c.total) * 100)}%`}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted
                            ? 'bg-emerald-400'
                            : 'bg-gradient-to-r from-amber-500 to-pink-500'
                        }`}
                        style={{ width: isCompleted ? '100%' : `${(c.progress / c.total) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 pt-1 border-t border-white/5">
                    <Star className="w-3 h-3 text-pink-400" />
                    <span>Récompense : <strong className="text-zinc-200">{c.reward}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Drawer>
  );
}
