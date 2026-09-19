import { useState, useEffect } from 'react';
import { 
  Trophy, Award, Flame, CheckCircle2, Music, 
  Send, Loader2, AlertCircle, Lock, Search, 
  Share2, Headphones, Disc
} from 'lucide-react';
import Drawer from './Drawer';
import { fetchSupabaseChallenges, AdminChallenge, getAdminChallenges } from '../utils/adminStore';
import { SynapseUser, ConnectedAccount } from '../types';
import { getUserPoints } from '../utils/loyaltyStore';
import { 
  getConstantChallenges, 
  ConstantChallengeConfig, 
  submitTrackProposal, 
  searchMusicCatalog,
  verifyTrackCriteria
} from '../utils/challengesStore';

interface ChallengesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
  activeStationId?: string;
  activeStationName?: string;
  currentUser?: SynapseUser | null;
  connectedAccount?: ConnectedAccount | null;
  onOpenConnectModal?: () => void;
  onOpenAdminPanel?: () => void;
}

export default function ChallengesDrawer({
  isOpen,
  onClose,
  accentColor = '#00f2ff',
  activeStationId,
  activeStationName = 'Radio Synapse',
  currentUser,
  connectedAccount,
  onOpenConnectModal,
}: ChallengesDrawerProps) {
  const [challenges, setChallenges] = useState<AdminChallenge[]>(() => getAdminChallenges());
  const [constantChallenges, setConstantChallenges] = useState<ConstantChallengeConfig[]>(() => getConstantChallenges());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(() => getUserPoints(currentUser));
  const [activeTab, setActiveTab] = useState<'all' | 'suggest_music' | 'share' | 'listening' | 'podiums'>('all');

  // Interactive "Propose ta musique" states
  const [proposeChallengeId, setProposeChallengeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [userComment, setUserComment] = useState('');
  const [submissionSuccessId, setSubmissionSuccessId] = useState<string | null>(null);

  const isUserConnected = !!currentUser || !!connectedAccount;
  const activeUserId = currentUser?.id || currentUser?.email || connectedAccount?.email || connectedAccount?.username || '';
  const activeUserName = currentUser?.username || connectedAccount?.username || 'Auditeur Synapse';

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchSupabaseChallenges();
    if (res.error && res.data.length === 0) {
      setError(res.error);
    } else {
      setChallenges(res.data);
    }
    setConstantChallenges(getConstantChallenges());
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setUserPoints(getUserPoints(currentUser));
    }
  }, [isOpen, currentUser]);

  // Sync points
  useEffect(() => {
    const handlePointsChange = (e: any) => {
      if (typeof e.detail?.points === 'number') {
        setUserPoints(e.detail.points);
      } else {
        setUserPoints(getUserPoints(currentUser));
      }
    };
    window.addEventListener('synapse_points_changed', handlePointsChange);
    return () => window.removeEventListener('synapse_points_changed', handlePointsChange);
  }, [currentUser]);

  // Debounced search for track suggestions
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchMusicCatalog(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle music proposal submission
  const handleSubmitTrack = (challenge: AdminChallenge) => {
    if (!selectedTrack || !activeUserId) return;

    submitTrackProposal({
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      stationId: challenge.stationId || activeStationId || 'all',
      userId: activeUserId,
      userName: activeUserName,
      userEmail: currentUser?.email,
      trackTitle: selectedTrack.title,
      artist: selectedTrack.artist,
      genre: selectedTrack.genre,
      year: selectedTrack.year,
      previewUrl: selectedTrack.previewUrl,
      coverUrl: selectedTrack.coverUrl,
      notes: userComment.trim() || undefined,
      pointsAwarded: challenge.points || 150,
    });

    setSubmissionSuccessId(challenge.id);
    setSelectedTrack(null);
    setSearchQuery('');
    setUserComment('');
    setProposeChallengeId(null);
  };

  // Filter challenges by active station and selected tab
  const filteredChallenges = challenges.filter((c) => {
    const stationMatch = c.stationId === 'all' || !activeStationId || c.stationId === activeStationId;
    if (!stationMatch) return false;

    if (activeTab === 'suggest_music') {
      return c.type === 'suggest_music' || c.type === 'suggest_track';
    }
    if (activeTab === 'share') {
      return c.type === 'share_liked_tracks';
    }
    if (activeTab === 'listening') {
      return c.type === 'listening_time';
    }
    return true;
  });

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
            DÉFIS, PODIUMS & PROPOSITIONS
          </span>
        </div>
      }
      subtitle="Relevez les défis de votre station, proposez vos titres et grimpez au classement"
      maxWidthClass="max-w-2xl"
    >
      <div className="flex flex-col gap-4 py-1">

        {/* 1. NON-CONNECTED LOCK SCREEN */}
        {!isUserConnected ? (
          <div className="py-12 px-6 rounded-3xl bg-zinc-950/80 border border-amber-500/30 flex flex-col items-center justify-center text-center gap-4 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-1.5 max-w-md">
              <h3 className="text-base sm:text-lg font-bold text-white font-futuristic">
                Défis Réservés aux Membres Connectés
              </h3>
              <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                Connectez-vous pour relever les défis de la station, proposer vos morceaux coup de cœur 
                aux programmateurs pour diffusion à l'antenne et accumuler des points de fidélité numériques !
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenConnectModal?.();
              }}
              className="mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-futuristic font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all cursor-pointer transform active:scale-95"
            >
              Se connecter ou Rejoindre Synapse
            </button>
          </div>
        ) : (
          <>
            {/* 2. USER STATUS CARD WITH LIVE POINTS */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900 to-pink-950/30 border border-amber-500/30 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-inner">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                    {userPoints >= 1000 ? 'VIP Platinum' : userPoints >= 500 ? 'VIP Gold' : 'Auditeur Fidèle'}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-bold text-white font-futuristic">
                      {userPoints.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">PTS SYNAPSE</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end text-right">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Station en cours</span>
                <span className="text-xs font-mono font-bold text-white truncate max-w-[140px]">
                  {activeStationName}
                </span>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-white/10">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                Tous les Défis
              </button>

              <button
                onClick={() => setActiveTab('suggest_music')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'suggest_music'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Propose ta Musique</span>
              </button>

              <button
                onClick={() => setActiveTab('share')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'share'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Partages</span>
              </button>

              <button
                onClick={() => setActiveTab('listening')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'listening'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Écoute</span>
              </button>

              <button
                onClick={() => setActiveTab('podiums')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'podiums'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Podiums Hebdo</span>
              </button>
            </div>

            {/* TAB CONTENT 1: PODIUMS HEBDO & DÉFIS CONSTANTS */}
            {activeTab === 'podiums' && (
              <div className="flex flex-col gap-4">
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-amber-500/20 text-xs font-mono text-zinc-300 leading-relaxed">
                  <span className="font-bold text-amber-400">Règles des Défis Constants : </span>
                  Chaque semaine, les meilleurs auditeurs au temps d'écoute cumulé et au nombre de titres likés partagés
                  reçoivent automatiquement leurs récompenses sur le podium du dimanche soir !
                </div>

                {constantChallenges.map((cc) => (
                  <div key={cc.id} className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-3 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-white font-futuristic">{cc.title}</h4>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        Hebdomadaire
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 font-mono">{cc.description}</p>

                    {/* Podium Rewards Bar */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/10">
                      <div className="flex flex-col items-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                        <span className="text-xs font-bold text-amber-300">🥇 1ère Place</span>
                        <span className="text-sm font-futuristic font-black text-white">+{cc.podium.first} pts</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-800/60 border border-zinc-700 text-center">
                        <span className="text-xs font-bold text-zinc-300">🥈 2ème Place</span>
                        <span className="text-sm font-futuristic font-black text-white">+{cc.podium.second} pts</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-xl bg-amber-900/20 border border-amber-800/40 text-center">
                        <span className="text-xs font-bold text-amber-400/80">🥉 3ème Place</span>
                        <span className="text-sm font-futuristic font-black text-white">+{cc.podium.third} pts</span>
                      </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                        Classement en Direct :
                      </span>
                      {cc.currentLeaderboard && cc.currentLeaderboard.length > 0 ? (
                        cc.currentLeaderboard.map((leader) => (
                          <div key={leader.rank} className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 text-xs font-mono">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-5 text-center font-bold ${
                                leader.rank === 1 ? 'text-amber-300' : leader.rank === 2 ? 'text-zinc-300' : 'text-amber-500'
                              }`}>
                                #{leader.rank}
                              </span>
                              <span className="font-bold text-white">{leader.username}</span>
                              {leader.stationName && (
                                <span className="text-[10px] text-zinc-500">({leader.stationName})</span>
                              )}
                            </div>
                            <span className="text-emerald-400 font-bold">{leader.scoreLabel}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center text-xs font-mono text-zinc-500">
                          Aucun auditeur classé pour le moment. Soyez le premier à participer !
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT 2: CHALLENGE LIST */}
            {activeTab !== 'podiums' && (
              <div className="flex flex-col gap-3">
                {isLoading && challenges.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 font-mono text-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <span>Chargement des défis de la station...</span>
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
                        Aucun défi actif dans cette catégorie
                      </span>
                      <p className="text-xs text-zinc-400 font-mono max-w-sm">
                        Sélectionnez un autre filtre ou revenez prochainement pour de nouveaux défis !
                      </p>
                    </div>
                  </div>
                )}

                {/* CHALLENGES CARDS */}
                {filteredChallenges.map((c, idx) => {
                  const isSuggestMusic = c.type === 'suggest_music' || c.type === 'suggest_track';
                  const isShareChallenge = c.type === 'share_liked_tracks';
                  const isListeningChallenge = c.type === 'listening_time';
                  const isProposing = proposeChallengeId === c.id;
                  const hasJustSubmitted = submissionSuccessId === c.id;

                  // Evaluate criteria validation for selected track
                  const verification = selectedTrack ? verifyTrackCriteria(selectedTrack, c.criteria) : null;

                  return (
                    <div
                      key={`chal-${c.id}-${idx}`}
                      className="p-4 rounded-2xl border bg-zinc-950/90 border-white/10 text-left flex flex-col gap-3 transition-all"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <h4 className="text-sm sm:text-base font-bold text-white font-futuristic">
                            {c.title}
                          </h4>
                        </div>

                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>+{c.points} pts</span>
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                        {c.desc}
                      </p>

                      {/* Criteria Badges for "Propose ta musique" */}
                      {isSuggestMusic && c.criteria && (
                        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold w-full mb-1">
                            Critères de diffusion recherchés :
                          </span>
                          {c.criteria.genre && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-mono">
                              Genre : {c.criteria.genre}
                            </span>
                          )}
                          {c.criteria.artist && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-mono">
                              Artiste requis : {c.criteria.artist}
                            </span>
                          )}
                          {c.criteria.year && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                              Époque / Année : {c.criteria.year}
                            </span>
                          )}
                          {c.criteria.emotion && (
                            <span className="px-2 py-0.5 rounded-md bg-pink-500/15 text-pink-300 border border-pink-500/30 text-[10px] font-mono">
                              Vibe : {c.criteria.emotion}
                            </span>
                          )}
                          {c.criteria.referenceTrack && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-mono">
                              Référence : {c.criteria.referenceTrack}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Success notification banner */}
                      {hasJustSubmitted && (
                        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-bold">Proposition envoyée avec succès à la régie !</span>
                            <span className="text-[11px] text-emerald-400/80">
                              L'équipe écoutera votre titre. Vos +{c.points} points seront crédités dès sa sélection.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* PROPOSAL WORKFLOW FOR "PROPOSE TA MUSIQUE" */}
                      {isSuggestMusic && !hasJustSubmitted && (
                        <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                          {!isProposing ? (
                            <button
                              onClick={() => {
                                setProposeChallengeId(c.id);
                                setSelectedTrack(null);
                                setSearchQuery('');
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/20"
                            >
                              <Music className="w-3.5 h-3.5" />
                              <span>Proposer un titre pour ce défi</span>
                            </button>
                          ) : (
                            <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-zinc-900 border border-amber-500/30 mt-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                                  <Search className="w-3.5 h-3.5 text-amber-400" />
                                  Rechercher le morceau à proposer :
                                </span>
                                <button
                                  onClick={() => setProposeChallengeId(null)}
                                  className="text-[10px] font-mono text-zinc-400 hover:text-white"
                                >
                                  Annuler
                                </button>
                              </div>

                              {/* Search Input */}
                              <div className="relative">
                                <input
                                  type="text"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  placeholder="Titre ou artiste (ex: Daft Punk - One More Time)..."
                                  className="w-full py-2 px-3 pl-9 rounded-xl bg-black border border-white/15 text-xs text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none font-mono"
                                />
                                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
                                {isSearching && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 absolute right-3 top-3" />
                                )}
                              </div>

                              {/* Search Results */}
                              {searchResults.length > 0 && !selectedTrack && (
                                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                                  {searchResults.map((track, tIdx) => (
                                    <button
                                      key={tIdx}
                                      onClick={() => setSelectedTrack(track)}
                                      className="p-2 rounded-xl bg-black/60 hover:bg-white/10 border border-white/10 flex items-center justify-between text-left transition-all cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {track.coverUrl ? (
                                          <img
                                            src={track.coverUrl}
                                            alt={track.title}
                                            className="w-8 h-8 rounded-lg object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <Disc className="w-8 h-8 text-zinc-500" />
                                        )}
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-xs font-bold text-white truncate">{track.title}</span>
                                          <span className="text-[11px] text-zinc-400 truncate">{track.artist} ({track.year || 'Année inconnue'})</span>
                                        </div>
                                      </div>
                                      <span className="text-[10px] font-mono text-amber-400 font-bold px-2 py-1 rounded bg-amber-500/10">
                                        Choisir
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Selected Track & Criteria Verification */}
                              {selectedTrack && (
                                <div className="p-3 rounded-xl bg-black/80 border border-amber-500/40 flex flex-col gap-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {selectedTrack.coverUrl && (
                                        <img
                                          src={selectedTrack.coverUrl}
                                          alt={selectedTrack.title}
                                          className="w-10 h-10 rounded-lg object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                      )}
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-white truncate">{selectedTrack.title}</span>
                                        <span className="text-[11px] text-zinc-400 truncate">{selectedTrack.artist}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => setSelectedTrack(null)}
                                      className="text-[10px] font-mono text-zinc-400 hover:text-white underline"
                                    >
                                      Changer
                                    </button>
                                  </div>

                                  {/* Verification feedback */}
                                  {verification && (
                                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/90 border border-white/10 text-[11px] font-mono">
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="text-zinc-300">Conformité aux critères :</span>
                                        <span className={verification.isValid ? 'text-emerald-400' : 'text-amber-400'}>
                                          {verification.score}%
                                        </span>
                                      </div>
                                      {verification.feedback.map((f, fIdx) => (
                                        <span key={fIdx} className="text-zinc-400 text-[10px]">
                                          {f}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Optional comment */}
                                  <input
                                    type="text"
                                    value={userComment}
                                    onChange={(e) => setUserComment(e.target.value)}
                                    placeholder="Pourquoi ce morceau correspond selon vous ? (facultatif)"
                                    className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-950 border border-white/10 text-xs text-white placeholder-zinc-500 font-mono"
                                  />

                                  {/* Submit button */}
                                  <button
                                    onClick={() => handleSubmitTrack(c)}
                                    className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Envoyer ma proposition à l'antenne (+{c.points} pts)</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* PROMPT FOR SHARE CHALLENGE */}
                      {isShareChallenge && (
                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <span className="text-[11px] font-mono text-zinc-400">
                            Objectif : {c.requiredShares || 5} partages de titres likés
                          </span>
                          <span className="text-xs font-mono text-amber-400 font-bold">
                            +20 pts par titre partagé
                          </span>
                        </div>
                      )}

                      {/* PROMPT FOR LISTENING TIME CHALLENGE */}
                      {isListeningChallenge && (
                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <span className="text-[11px] font-mono text-zinc-400">
                            Objectif : {c.requiredMinutes || 30} minutes d'écoute continue
                          </span>
                          <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                            <Headphones className="w-3.5 h-3.5" />
                            <span>Enregistrement automatique</span>
                          </span>
                        </div>
                      )}
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
