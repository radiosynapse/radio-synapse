import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Radio, Mic, MicOff, Play, Disc3, Sliders, 
  Activity, Clock, Zap, Music, MessageSquare, ThumbsUp,
  HelpCircle, Star, Trash2, Send, Plus, X, Users,
  CheckCircle2, Sparkles, Layers, ChevronRight, CheckCheck, Eye
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser } from '../types';
import { isSuperAdmin, getUserAssignedStations } from '../utils/adminRolePermissionsStore';
import { 
  StudioRequest, 
  StudioResponse, 
  StudioRequestType,
  GroupedStudioResponse,
  getStudioRequests, 
  getStudioResponses, 
  createStudioRequest, 
  closeStudioRequest, 
  extendStudioRequestTime, 
  updateStudioResponseStatus, 
  deleteStudioResponse,
  batchUpdateStudioResponses,
  batchDeleteStudioResponses,
  groupStudioResponses,
  EVENT_STUDIO_REQUEST_CHANGED 
} from '../utils/studioMessagingStore';
import { AudioDrop, getAudioDrops } from '../utils/audioDropsStore';

interface AdminRegieAnimationViewProps {
  stations: StreamChannel[];
  activeStation: StreamChannel;
  currentUser: SynapseUser | null;
  onSelectStation: (station: StreamChannel) => void;
  showToast: (msg: string) => void;
  onOpenControlDeck?: (station: StreamChannel) => void;
}

export const AdminRegieAnimationView: React.FC<AdminRegieAnimationViewProps> = ({
  stations,
  activeStation,
  currentUser,
  onSelectStation,
  showToast,
  onOpenControlDeck,
}) => {
  const isSuper = isSuperAdmin(currentUser);
  const accessibleStations = getUserAssignedStations(currentUser, stations);
  const canSwitch = isSuper || accessibleStations.length > 1;

  // Microphone & Live Broadcast state
  const [isLiveBroadcasting, setIsLiveBroadcasting] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micVolume, setMicVolume] = useState(85);
  const [isDuckingActive, setIsDuckingActive] = useState(true);
  const [onAirTimeSeconds, setOnAirTimeSeconds] = useState(0);
  const [activeCartoucheId, setActiveCartoucheId] = useState<string | null>(null);

  // Cartouchier Soundboard items
  const [soundboardItems, setSoundboardItems] = useState<AudioDrop[]>(() => getAudioDrops());

  useEffect(() => {
    setSoundboardItems(getAudioDrops());
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ----------------------------------------------------
  // STUDIO MESSAGING & INTERACTIVE REQUESTS STATE
  // ----------------------------------------------------
  const [requests, setRequests] = useState<StudioRequest[]>([]);
  const [responses, setResponses] = useState<StudioResponse[]>([]);
  const [activeRequestSecondsLeft, setActiveRequestSecondsLeft] = useState<number>(0);

  // New request form state
  const [newRequestType, setNewRequestType] = useState<StudioRequestType>('poll_yes_no');
  const [newRequestTitle, setNewRequestTitle] = useState('');
  const [newRequestPrompt, setNewRequestPrompt] = useState('');
  const [newRequestDuration, setNewRequestDuration] = useState<number>(180); // 3 mins default
  const [newRequestTargetStation, setNewRequestTargetStation] = useState<string>(activeStation.id);
  const [mcqOptions, setMcqOptions] = useState<string[]>(['Option A', 'Option B', 'Option C']);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [isLaunchingRequest, setIsLaunchingRequest] = useState(false);

  // Flexible Poll / Rules configurations
  const [mcqMode, setMcqMode] = useState<'single' | 'multiple'>('single');
  const [binaryChoiceA, setBinaryChoiceA] = useState('OUI');
  const [binaryChoiceB, setBinaryChoiceB] = useState('NON');
  const [allowDirectComment, setAllowDirectComment] = useState(true);
  const [songGenreRule, setSongGenreRule] = useState('');
  const [songDecadeRule, setSongDecadeRule] = useState('');
  const [songCustomRule, setSongCustomRule] = useState('');

  // Responses view mode & filter
  const [inboxViewMode, setInboxViewMode] = useState<'grouped' | 'individual'>('grouped');
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<GroupedStudioResponse | null>(null);
  const [responseFilter, setResponseFilter] = useState<'all' | 'starred' | 'unread'>('all');

  const reloadStudioMessaging = () => {
    const allReq = getStudioRequests();
    const allResp = getStudioResponses();
    setRequests(allReq);
    setResponses(allResp);
  };

  useEffect(() => {
    reloadStudioMessaging();

    const handleSync = () => {
      reloadStudioMessaging();
    };

    window.addEventListener(EVENT_STUDIO_REQUEST_CHANGED, handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener(EVENT_STUDIO_REQUEST_CHANGED, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Update target station when activeStation changes
  useEffect(() => {
    setNewRequestTargetStation(activeStation.id);
  }, [activeStation.id]);

  // Active request for current station or global
  const activeRequest = requests.find((r) => {
    if (!r.isActive) return false;
    const exp = new Date(r.expiresAt).getTime();
    if (exp <= Date.now()) return false;
    return r.stationId === 'all' || r.stationId === activeStation.id;
  }) || null;

  // Active request countdown
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeRequest) {
        const remaining = Math.max(0, Math.floor((new Date(activeRequest.expiresAt).getTime() - Date.now()) / 1000));
        setActiveRequestSecondsLeft(remaining);
        if (remaining <= 0) {
          reloadStudioMessaging();
        }
      } else {
        setActiveRequestSecondsLeft(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeRequest]);

  // Live broadcast timer
  useEffect(() => {
    let interval: any = null;
    if (isLiveBroadcasting) {
      interval = setInterval(() => {
        setOnAirTimeSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setOnAirTimeSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isLiveBroadcasting]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const hrs = Math.floor(mins / 60);
    const displayMins = mins % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${displayMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${displayMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMic = () => {
    if (!isMicActive) {
      setIsMicActive(true);
      showToast('Microphone Studio ouvert ON-AIR');
    } else {
      setIsMicActive(false);
      showToast('Microphone Studio coupé');
    }
  };

  const toggleBroadcast = () => {
    if (!isLiveBroadcasting) {
      setIsLiveBroadcasting(true);
      showToast(`Prise d'antenne LIVE sur ${activeStation.name}`);
    } else {
      setIsLiveBroadcasting(false);
      setIsMicActive(false);
      showToast(`Fin de prise d'antenne - Retour à l'Auto-DJ sur ${activeStation.name}`);
    }
  };

  const triggerSound = (item: AudioDrop) => {
    if (activeCartoucheId === item.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setActiveCartoucheId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const soundUrl = item.audioUrl || (item as any).url;
      if (!soundUrl) {
        showToast(`Aucun fichier audio lié à ${item.name}`);
        return;
      }
      const audio = new Audio(soundUrl);
      audio.volume = 0.8;
      audio.play().catch(() => {});
      audio.onended = () => setActiveCartoucheId(null);
      audioRef.current = audio;
      setActiveCartoucheId(item.id);
      showToast(`Lancement : ${item.name}`);
    }
  };

  // ----------------------------------------------------
  // STUDIO MESSAGING HANDLERS
  // ----------------------------------------------------
  const handleAddMcqOption = () => {
    if (!newOptionInput.trim()) return;
    setMcqOptions([...mcqOptions, newOptionInput.trim()]);
    setNewOptionInput('');
  };

  const handleRemoveMcqOption = (index: number) => {
    setMcqOptions(mcqOptions.filter((_, i) => i !== index));
  };

  const handleLaunchStudioRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestTitle.trim()) {
      showToast('Veuillez renseigner le titre de la question');
      return;
    }

    if (newRequestType === 'poll_mcq' && mcqOptions.length < 2) {
      showToast('Un sondage QCM requiert au moins 2 options');
      return;
    }

    const stObj = stations.find(s => s.id === newRequestTargetStation);
    const stationLabel = newRequestTargetStation === 'all' ? 'Toutes les Radios' : (stObj?.name || 'Radio');

    const created = createStudioRequest({
      stationId: newRequestTargetStation,
      stationName: stationLabel,
      type: newRequestType,
      title: newRequestTitle.trim(),
      promptMessage: newRequestPrompt.trim() || undefined,
      options: newRequestType === 'poll_mcq' ? mcqOptions : undefined,
      durationSeconds: newRequestDuration,
      authorName: currentUser?.displayName || 'Animateur Studio',
      mcqMode: newRequestType === 'poll_mcq' ? mcqMode : undefined,
      binaryChoices: newRequestType === 'poll_yes_no' ? [
        binaryChoiceA.trim() || 'OUI',
        binaryChoiceB.trim() || 'NON'
      ] : undefined,
      allowDirectComment: newRequestType === 'poll_yes_no' ? allowDirectComment : undefined,
      songRules: newRequestType === 'song_request' ? {
        genre: songGenreRule.trim() || undefined,
        decade: songDecadeRule.trim() || undefined,
        customRule: songCustomRule.trim() || undefined,
      } : undefined,
    });

    setIsLaunchingRequest(false);
    setNewRequestTitle('');
    setNewRequestPrompt('');
    reloadStudioMessaging();
    showToast(`🚀 Requête lancée à l'antenne sur ${stationLabel} (${Math.floor(created.durationSeconds / 60)} min)`);
  };

  const handleCloseActiveRequest = () => {
    if (!activeRequest) return;
    closeStudioRequest(activeRequest.id);
    reloadStudioMessaging();
    showToast('Requête studio clôturée');
  };

  const handleExtendActiveRequest = (extraSec: number) => {
    if (!activeRequest) return;
    extendStudioRequestTime(activeRequest.id, extraSec);
    reloadStudioMessaging();
    showToast(`+${Math.floor(extraSec / 60)} minute(s) ajoutée(s) à la requête en cours`);
  };

  const handleToggleStar = (resp: StudioResponse) => {
    updateStudioResponseStatus(resp.id, { isStarred: !resp.isStarred });
    reloadStudioMessaging();
  };

  const handleToggleReadOnAir = (resp: StudioResponse) => {
    updateStudioResponseStatus(resp.id, { isReadOnAir: !resp.isReadOnAir });
    reloadStudioMessaging();
    showToast(!resp.isReadOnAir ? 'Marqué comme traité / lu à l\'antenne' : 'Remis en attente');
  };

  const handleDeleteResponse = (id: string) => {
    deleteStudioResponse(id);
    reloadStudioMessaging();
    showToast('Réponse retirée');
  };

  // Bulk grouped actions
  const handleBulkMarkGroupRead = (group: GroupedStudioResponse) => {
    const ids = group.items.map(i => i.id);
    batchUpdateStudioResponses(ids, { isReadOnAir: true });
    reloadStudioMessaging();
    showToast(`✓ ${group.count} réponse(s) marquée(s) comme traitée(s) à l'antenne`);
    if (selectedGroupDetail && selectedGroupDetail.key === group.key) {
      setSelectedGroupDetail(prev => prev ? {
        ...prev,
        allReadOnAir: true,
        items: prev.items.map(i => ({ ...i, isReadOnAir: true }))
      } : null);
    }
  };

  const handleBulkMarkGroupStarred = (group: GroupedStudioResponse) => {
    const ids = group.items.map(i => i.id);
    const newStar = !group.anyStarred;
    batchUpdateStudioResponses(ids, { isStarred: newStar });
    reloadStudioMessaging();
    showToast(newStar ? `⭐ Groupe ajouté aux favoris` : `Groupe retiré des favoris`);
    if (selectedGroupDetail && selectedGroupDetail.key === group.key) {
      setSelectedGroupDetail(prev => prev ? {
        ...prev,
        anyStarred: newStar,
        items: prev.items.map(i => ({ ...i, isStarred: newStar }))
      } : null);
    }
  };

  const handleDeleteGroup = (group: GroupedStudioResponse) => {
    const ids = group.items.map(i => i.id);
    batchDeleteStudioResponses(ids);
    reloadStudioMessaging();
    if (selectedGroupDetail && selectedGroupDetail.key === group.key) {
      setSelectedGroupDetail(null);
    }
    showToast(`🗑️ ${group.count} réponse(s) supprimée(s)`);
  };

  // Filtered responses for current station / active request
  const currentStationResponses = responses.filter(r => {
    const matchesStation = r.stationId === 'all' || r.stationId === activeStation.id;
    if (!matchesStation) return false;
    if (responseFilter === 'starred') return r.isStarred;
    if (responseFilter === 'unread') return !r.isReadOnAir;
    return true;
  });

  // Dynamically group similar responses with percentage & frequency
  const groupedStationResponses = useMemo(() => {
    return groupStudioResponses(currentStationResponses, activeRequest);
  }, [currentStationResponses, activeRequest]);

  // Calculate live poll stats if active request is a poll
  const activeRequestResponses = activeRequest ? responses.filter(r => r.requestId === activeRequest.id) : [];

  const pollStats = (() => {
    if (!activeRequest) return null;
    if (activeRequest.type === 'poll_yes_no') {
      const labelA = activeRequest.binaryChoices?.[0] || 'OUI';
      const labelB = activeRequest.binaryChoices?.[1] || 'NON';
      const countA = activeRequestResponses.filter(r => r.content.toUpperCase() === labelA.toUpperCase()).length;
      const countB = activeRequestResponses.filter(r => r.content.toUpperCase() === labelB.toUpperCase()).length;
      const total = countA + countB;
      return {
        labelA,
        labelB,
        total,
        countA,
        countB,
        percentA: total > 0 ? Math.round((countA / total) * 100) : 50,
        percentB: total > 0 ? Math.round((countB / total) * 100) : 50,
      };
    }
    if (activeRequest.type === 'poll_mcq' && activeRequest.options) {
      const counts: Record<string, number> = {};
      activeRequest.options.forEach(opt => { counts[opt] = 0; });
      activeRequestResponses.forEach(r => {
        // Handle comma-separated multiple choice answers
        const tokens = r.content.split(',').map(s => s.trim());
        tokens.forEach(token => {
          if (counts[token] !== undefined) counts[token]++;
        });
      });
      const total = activeRequestResponses.length;
      return {
        total,
        options: activeRequest.options.map(opt => ({
          name: opt,
          count: counts[opt] || 0,
          percent: total > 0 ? Math.round(((counts[opt] || 0) / total) * 100) : 0,
        }))
      };
    }
    return null;
  })();

  return (
    <div className="flex flex-col w-full min-w-0">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
            <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
              Régie Studio & Animation d'Antenne
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Console Direct
            </span>
          </div>
        </div>

        {/* STATION SCOPE & SWITCHER */}
        <div className="flex items-center gap-2">
          {canSwitch ? (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 pl-2 pr-1 font-bold">Radio Active :</span>
              <select
                value={activeStation.id}
                onChange={(e) => {
                  const target = stations.find(s => s.id === e.target.value);
                  if (target) onSelectStation(target);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-750 text-white text-xs font-mono font-bold focus:border-amber-400 focus:outline-none cursor-pointer"
              >
                {accessibleStations.map((st) => (
                  <option key={st.id} value={st.id}>
                    📻 {st.name} ({st.genre})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeStation.color || '#00f2ff' }} />
              <span className="text-xs font-mono font-bold text-white">
                {activeStation.name}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">(Station Assignée)</span>
            </div>
          )}

          {onOpenControlDeck && (
            <button
              onClick={() => onOpenControlDeck(activeStation)}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Pont Régie</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 text-left">
        {/* TOP ON-AIR STATUS BAR & LIVE CONSOLE */}
        <div className={`p-5 sm:p-6 rounded-2xl border transition-all shadow-xl ${
          isLiveBroadcasting 
            ? 'bg-gradient-to-br from-rose-950/40 via-zinc-900 to-zinc-950 border-rose-500/50 shadow-rose-950/30' 
            : 'bg-zinc-950 border-zinc-800'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* STATION & ON-AIR BADGE */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg border"
                  style={{ 
                    backgroundColor: `${activeStation.color || '#00f2ff'}20`,
                    borderColor: `${activeStation.color || '#00f2ff'}40` 
                  }}
                >
                  <Radio className="w-7 h-7" style={{ color: activeStation.color || '#00f2ff' }} />
                </div>
                {isLiveBroadcasting && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-futuristic font-black text-white">
                    {activeStation.name}
                  </h3>
                  {isLiveBroadcasting ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-rose-500 text-white animate-pulse flex items-center gap-1.5 shadow-md shadow-rose-500/30">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      EN DIRECT À L'ANTENNE
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Auto-DJ Actif (Diffusion Continue)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 flex-wrap">
                  <span>Format : <strong className="text-zinc-200">{activeStation.genre}</strong></span>
                  <span>•</span>
                  <span>Mount : <strong className="text-zinc-300">{activeStation.mountPoint || `/${activeStation.id}`}</strong></span>
                  {isLiveBroadcasting && (
                    <>
                      <span>•</span>
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Chrono Direct : {formatTimer(onAirTimeSeconds)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* MASTER LIVE BUTTONS */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={toggleMic}
                disabled={!isLiveBroadcasting}
                className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  !isLiveBroadcasting 
                    ? 'opacity-40 cursor-not-allowed bg-zinc-900 border border-zinc-800 text-zinc-500'
                    : isMicActive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400 animate-pulse'
                    : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200'
                }`}
              >
                {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-zinc-400" />}
                <span>{isMicActive ? 'MICRO OUVERT' : 'Micro Coupé'}</span>
              </button>

              <button
                onClick={toggleBroadcast}
                className={`px-5 py-2.5 rounded-xl font-mono text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isLiveBroadcasting
                    ? 'bg-zinc-800 hover:bg-zinc-700 border border-rose-500/50 text-rose-300'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>{isLiveBroadcasting ? 'RENDRE L\'ANTENNE (AUTO-DJ)' : 'PRENDRE L\'ANTENNE EN DIRECT'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* NEW SPECIFICATION: MESSAGERIE STUDIO & REQUÊTES INTERACTIVES SENS UNIQUE */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0 mt-0.5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-futuristic font-bold text-white uppercase tracking-wider">
                    Messagerie Studio & Requêtes Ciblées (Sens Unique Modéré)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-mono font-bold">
                    Interactivité Maîtrisée
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-300 max-w-3xl leading-relaxed">
                  Pas de chat continu ou de déferlement ingérable : <strong>c'est vous qui déclenchez</strong> une requête (Message, QCM, Oui/Non, Requête de Titre) avec un <strong>compte à rebours précis</strong>. Les auditeurs voient alors apparaître un bouton pop-up sur leur lecteur pour y répondre avant que le timer n'expire.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsLaunchingRequest(!isLaunchingRequest)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-amber-500 text-black font-futuristic font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-pink-500/20 shrink-0 self-end md:self-center"
            >
              <Plus className="w-4 h-4" />
              <span>{isLaunchingRequest ? 'Fermer le lanceur' : 'Nouvelle Requête Studio'}</span>
            </button>
          </div>

          {/* ACTIVE REQUEST REAL-TIME MONITORING BANNER */}
          {activeRequest && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border-2 border-pink-500/50 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-pink-400 uppercase">
                        Requête en Direct à l'Antenne
                      </span>
                      <span className="px-2 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                        📻 {activeRequest.stationName}
                      </span>
                    </div>
                    <span className="text-base font-futuristic font-black text-white">
                      "{activeRequest.title}"
                    </span>
                  </div>
                </div>

                {/* TIMER & CONTROLS */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-400 font-mono font-black text-sm flex items-center gap-1.5 shadow-inner">
                    <Clock className="w-4 h-4" />
                    <span>{formatTimer(activeRequestSecondsLeft)} restant</span>
                  </div>

                  <button
                    onClick={() => handleExtendActiveRequest(60)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Ajouter 1 minute"
                  >
                    <span>+1 Min</span>
                  </button>

                  <button
                    onClick={handleCloseActiveRequest}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Clôturer Maintenant</span>
                  </button>
                </div>
              </div>

              {/* LIVE STATS & POLL PROGRESS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs font-mono text-zinc-400">Réponses Reçues :</span>
                  </div>
                  <span className="text-lg font-mono font-black text-white">
                    {activeRequestResponses.length}
                  </span>
                </div>

                {/* POLL YES/NO BREAKDOWN */}
                {pollStats && activeRequest.type === 'poll_yes_no' && (
                  <div className="md:col-span-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 flex flex-col justify-center gap-2">
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span className="text-emerald-400">{pollStats.labelA} : {pollStats.countA} ({pollStats.percentA}%)</span>
                      <span className="text-rose-400">{pollStats.labelB} : {pollStats.countB} ({pollStats.percentB}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-900 overflow-hidden flex">
                      <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${pollStats.percentA}%` }} />
                      <div className="bg-rose-500 transition-all duration-300" style={{ width: `${pollStats.percentB}%` }} />
                    </div>
                  </div>
                )}

                {/* POLL MCQ BREAKDOWN */}
                {pollStats && activeRequest.type === 'poll_mcq' && 'options' in pollStats && pollStats.options && (
                  <div className="md:col-span-2 p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 flex flex-col gap-2">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Répartition des votes QCM :</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pollStats.options.map((opt, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="flex justify-between text-[11px] font-mono text-zinc-300">
                            <span className="truncate">{opt.name}</span>
                            <span className="font-bold text-amber-400">{opt.percent}% ({opt.count})</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${opt.percent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LAUNCH STUDIO REQUEST FORM (DRAWER / COLLAPSIBLE DECK) */}
          {isLaunchingRequest && (
            <form onSubmit={handleLaunchStudioRequest} className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border border-pink-500/40 flex flex-col gap-5 shadow-2xl animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-sm font-futuristic font-bold text-white uppercase flex items-center gap-2">
                  <Send className="w-4 h-4 text-pink-400" />
                  Configuration d'une Nouvelle Requête Studio
                </span>
                <button
                  type="button"
                  onClick={() => setIsLaunchingRequest(false)}
                  className="text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. POLL YES/NO */}
                <button
                  type="button"
                  onClick={() => setNewRequestType('poll_yes_no')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    newRequestType === 'poll_yes_no'
                      ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/40'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ThumbsUp className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-mono text-zinc-500 font-bold">Instantané</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">Sondage OUI / NON</span>
                  <span className="text-[10px] font-mono text-zinc-400">Pour valider un titre ou avoir un vote flash</span>
                </button>

                {/* 2. POLL MCQ */}
                <button
                  type="button"
                  onClick={() => setNewRequestType('poll_mcq')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    newRequestType === 'poll_mcq'
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <HelpCircle className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] font-mono text-zinc-500 font-bold">Multi-choix</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">Sondage QCM</span>
                  <span className="text-[10px] font-mono text-zinc-400">Proposer des choix définis aux auditeurs</span>
                </button>

                {/* 3. SONG REQUEST */}
                <button
                  type="button"
                  onClick={() => setNewRequestType('song_request')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    newRequestType === 'song_request'
                      ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/40'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Disc3 className="w-5 h-5 text-cyan-400" />
                    <span className="text-[10px] font-mono text-zinc-500 font-bold">Musique</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">Requête de Titre</span>
                  <span className="text-[10px] font-mono text-zinc-400">Dédicaces et morceaux demandés par l'auditeur</span>
                </button>

                {/* 4. OPEN MESSAGE */}
                <button
                  type="button"
                  onClick={() => setNewRequestType('open_message')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    newRequestType === 'open_message'
                      ? 'bg-pink-500/20 border-pink-400 ring-2 ring-pink-400/40'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <MessageSquare className="w-5 h-5 text-pink-400" />
                    <span className="text-[10px] font-mono text-zinc-500 font-bold">Libre</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white">Message & Réaction</span>
                  <span className="text-[10px] font-mono text-zinc-400">Réponse texte libre à une question posée</span>
                </button>
              </div>

              {/* QUESTION & DETAILS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-mono text-zinc-300 font-bold">
                    Titre ou Question posée aux auditeurs * :
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Quel titre voulez-vous pour le drop de minuit ?"
                    value={newRequestTitle}
                    onChange={(e) => setNewRequestTitle(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-pink-400 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-mono text-zinc-300 font-bold">
                    Radio Ciblée :
                  </label>
                  <select
                    value={newRequestTargetStation}
                    onChange={(e) => setNewRequestTargetStation(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-pink-400 focus:outline-none cursor-pointer"
                  >
                    {isSuper && <option value="all">🌐 Toutes les Radios</option>}
                    {accessibleStations.map((st) => (
                      <option key={st.id} value={st.id}>
                        📻 {st.name} ({st.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-mono text-zinc-300 font-bold">
                    Précision ou Consigne facultative :
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Les 3 morceaux les plus plébiscités seront mixés par DJ Mitch"
                    value={newRequestPrompt}
                    onChange={(e) => setNewRequestPrompt(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-pink-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* MCQ OPTIONS BUILDER & MODE */}
              {newRequestType === 'poll_mcq' && (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-4">
                  {/* MCQ SELECTION MODE */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-850">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                      Mode de vote du QCM :
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMcqMode('single')}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          mcqMode === 'single'
                            ? 'bg-amber-500 text-black shadow-md'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        Choix Unique (1 vote)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMcqMode('multiple')}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          mcqMode === 'multiple'
                            ? 'bg-amber-500 text-black shadow-md'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                      >
                        Choix Multiple (plusieurs réponses possibles)
                      </button>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-zinc-300">
                    Options du sondage ({mcqOptions.length}) :
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {mcqOptions.map((opt, i) => (
                      <div key={i} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 flex items-center gap-2 text-xs font-mono text-zinc-200">
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMcqOption(i)}
                          className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Ajouter une option..."
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMcqOption(); } }}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddMcqOption}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-bold cursor-pointer"
                    >
                      Ajouter l'option
                    </button>
                  </div>
                </div>
              )}

              {/* BINARY CHOICES CUSTOMIZATION (YES / NO OR CUSTOM PAIR) */}
              {newRequestType === 'poll_yes_no' && (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
                      Intitulés des 2 Choix Binaires :
                    </span>
                    {/* PRESETS */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-zinc-500">Préréglages :</span>
                      {[
                        { a: 'OUI', b: 'NON' },
                        { a: 'POUR', b: 'CONTRE' },
                        { a: 'TOP', b: 'FLOP' },
                        { a: 'VALIDÉ', b: 'RECALÉ' },
                        { a: 'CHAUD', b: 'FROID' },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => { setBinaryChoiceA(preset.a); setBinaryChoiceB(preset.b); }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                            binaryChoiceA === preset.a && binaryChoiceB === preset.b
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
                          }`}
                        >
                          {preset.a}/{preset.b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-mono text-zinc-400 font-bold">
                        Choix 1 (Positif / Option A) :
                      </label>
                      <input
                        type="text"
                        value={binaryChoiceA}
                        onChange={(e) => setBinaryChoiceA(e.target.value)}
                        placeholder="OUI"
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-mono font-bold focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-mono text-zinc-400 font-bold">
                        Choix 2 (Négatif / Option B) :
                      </label>
                      <input
                        type="text"
                        value={binaryChoiceB}
                        onChange={(e) => setBinaryChoiceB(e.target.value)}
                        placeholder="NON"
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-rose-400 text-xs font-mono font-bold focus:border-rose-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* ALLOW DIRECT COMMENT */}
                  <label className="flex items-center gap-2 pt-1 text-xs font-mono text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDirectComment}
                      onChange={(e) => setAllowDirectComment(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-emerald-400/40 cursor-pointer"
                    />
                    <span>Autoriser les auditeurs à ajouter un commentaire ou une explication à leur vote</span>
                  </label>
                </div>
              )}

              {/* SONG REQUEST RULES & CHALLENGE OPTIONS */}
              {newRequestType === 'song_request' && (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                      <Disc3 className="w-3.5 h-3.5 text-cyan-400" />
                      Règles & Défi "Propose une track" :
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold">
                      Anti-doublon activé
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-mono text-zinc-400">
                        Genre imposé (optionnel) :
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Electro, Pop/Rock, Funk, Hip-Hop..."
                        value={songGenreRule}
                        onChange={(e) => setSongGenreRule(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-mono text-zinc-400">
                        Époque ou Année (optionnel) :
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Années 80, 90s, Nouveauté 2024..."
                        value={songDecadeRule}
                        onChange={(e) => setSongDecadeRule(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="text-[11px] font-mono text-zinc-400">
                        Consigne libre pour le défi antenne :
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Proposez votre track club préférée sans remixes"
                        value={songCustomRule}
                        onChange={(e) => setSongCustomRule(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-850 text-[11px] font-mono text-zinc-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span>Les auditeurs ne pourront pas envoyer un morceau déjà proposé par un autre auditeur pour éviter les doublons.</span>
                  </div>
                </div>
              )}

              {/* OPEN MESSAGE NOTIFICATION */}
              {newRequestType === 'open_message' && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <span>Filtre anti-injures actif pour assurer des réactions courtoises à l'antenne.</span>
                  </div>
                  <span className="text-[10px] text-pink-400 font-bold uppercase">Filtrage direct</span>
                </div>
              )}

              {/* TIMER RULES & PRESETS */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-pink-400" />
                    Durée d'ouverture du pop-up sur le lecteur :
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Passé ce délai, le bouton disparaît automatiquement côté auditeur.
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[60, 120, 180, 300, 600].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setNewRequestDuration(sec)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        newRequestDuration === sec
                          ? 'bg-pink-500 text-black shadow-md'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {sec / 60} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsLaunchingRequest(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-mono cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-amber-500 hover:opacity-90 text-black font-futuristic font-black text-xs uppercase cursor-pointer shadow-lg shadow-pink-500/20"
                >
                  🚀 Lancer la Requête Antenne (ON-AIR)
                </button>
              </div>
            </form>
          )}

          {/* AUDIENCE RESPONSES INBOX / SERENITY PROCESSING */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-850 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-futuristic font-bold text-white uppercase tracking-wide">
                      Boîte de Traitement Sérénité des Réponses
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-[10px] font-mono font-bold">
                      {currentStationResponses.length} message(s) • {groupedStationResponses.length} groupe(s)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Regroupement automatique des messages similaires, calcul de pourcentages et consultation tranquille
                  </span>
                </div>
              </div>

              {/* CONTROLS: VIEW TOGGLE & QUICK FILTERS */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* VIEW MODE TOGGLE */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
                  <button
                    onClick={() => setInboxViewMode('grouped')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      inboxViewMode === 'grouped'
                        ? 'bg-gradient-to-r from-pink-500 to-amber-500 text-black shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Grouper les réponses similaires avec pourcentages"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Groupées & %</span>
                  </button>
                  <button
                    onClick={() => setInboxViewMode('individual')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      inboxViewMode === 'individual'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Affichage carte par carte individuel"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Détaillées</span>
                  </button>
                </div>

                {/* FILTERS */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
                  <button
                    onClick={() => setResponseFilter('all')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      responseFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Toutes
                  </button>
                  <button
                    onClick={() => setResponseFilter('starred')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      responseFilter === 'starred' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Star className="w-3 h-3 fill-current" />
                    <span>Favoris</span>
                  </button>
                  <button
                    onClick={() => setResponseFilter('unread')}
                    className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      responseFilter === 'unread' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    À Traiter
                  </button>
                </div>
              </div>
            </div>

            {/* RESPONSES CARDS LIST */}
            {currentStationResponses.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-850 text-center flex flex-col items-center justify-center gap-2">
                <MessageSquare className="w-8 h-8 text-zinc-600" />
                <span className="text-xs font-mono font-bold text-zinc-300">
                  Aucune réponse d'auditeur en attente.
                </span>
                <span className="text-[11px] font-mono text-zinc-500">
                  Lancez une requête studio ci-dessus pour récolter des votes ou des morceaux.
                </span>
              </div>
            ) : inboxViewMode === 'grouped' ? (
              /* GROUPED VIEW WITH PROPORTIONS & CLICK-TO-DETAIL */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
                {groupedStationResponses.map((group) => (
                  <div
                    key={group.key}
                    onClick={() => setSelectedGroupDetail(group)}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer hover:border-pink-500/50 hover:shadow-lg ${
                      group.allReadOnAir
                        ? 'bg-zinc-900/40 border-zinc-850 opacity-80'
                        : 'bg-zinc-900 border-zinc-750 shadow-md'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      {/* CARD HEADER: PERCENTAGE BADGE & LISTENER COUNT */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300 font-mono font-black text-xs shadow-sm">
                            {group.percentage}%
                          </span>
                          <span className="text-xs font-mono font-bold text-zinc-300 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{group.count} auditeur{group.count > 1 ? 's' : ''}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {group.anyStarred && (
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          )}
                          {group.allReadOnAir ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                              Traité
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold">
                              À citer
                            </span>
                          )}
                        </div>
                      </div>

                      {/* MAIN CONTENT DISPLAY */}
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 flex flex-col gap-1">
                        <span className="text-xs font-mono font-black text-white line-clamp-2">
                          {group.displayContent}
                        </span>
                        {group.subtitle && (
                          <span className="text-[11px] font-mono text-cyan-400 font-bold truncate">
                            {group.subtitle}
                          </span>
                        )}
                      </div>

                      {/* PERCENTAGE PROGRESS BAR */}
                      <div className="w-full flex flex-col gap-1">
                        <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-pink-500 to-amber-500 rounded-full transition-all duration-300"
                            style={{ width: `${group.percentage}%` }}
                          />
                        </div>
                      </div>

                      {/* CONTRIBUTORS PREVIEW */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <span className="truncate">
                          👤 {group.items.slice(0, 2).map(i => i.userName).join(', ')}
                          {group.items.length > 2 && ` +${group.items.length - 2}`}
                        </span>
                        <span className="text-pink-400 font-bold flex items-center gap-0.5 shrink-0">
                          Détails <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>

                    {/* QUICK ACTION BUTTONS */}
                    <div className="pt-2 border-t border-zinc-850 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleBulkMarkGroupRead(group)}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          group.allReadOnAir
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{group.allReadOnAir ? 'Traité ✓' : 'Marquer Traité'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkMarkGroupStarred(group)}
                        className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
                        title="Favori pour tout le groupe"
                      >
                        <Star className={`w-3.5 h-3.5 ${group.anyStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group)}
                        className="p-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Supprimer ce groupe"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* INDIVIDUAL FLAT CARDS VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                {currentStationResponses.map((resp) => (
                  <div
                    key={resp.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      resp.isReadOnAir 
                        ? 'bg-zinc-900/40 border-zinc-850 opacity-75' 
                        : 'bg-zinc-900 border-zinc-750 shadow-md'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                          <span className="text-xs font-mono font-black text-white truncate">
                            {resp.userName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleStar(resp)}
                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                              resp.isStarred ? 'text-amber-400 fill-amber-400' : 'text-zinc-600 hover:text-zinc-400'
                            }`}
                            title="Mettre en favori"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteResponse(resp.id)}
                            className="p-1 rounded-lg text-zinc-600 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* CONTENT DISPLAY */}
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-850 flex flex-col gap-1">
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {resp.content}
                        </span>
                        {resp.metadata?.dedication && (
                          <span className="text-[11px] font-mono text-zinc-400 italic">
                            "{resp.metadata.dedication}"
                          </span>
                        )}
                        {(resp.metadata?.directComment || resp.metadata?.comment) && (
                          <span className="text-[11px] font-mono text-emerald-400 italic">
                            💬 "{resp.metadata?.directComment || resp.metadata?.comment}"
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>{new Date(resp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="capitalize">{resp.type.replace('_', ' ')}</span>
                      </div>
                    </div>

                    {/* STATUS ACTION */}
                    <div className="pt-2 border-t border-zinc-850 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleReadOnAir(resp)}
                        className={`w-full py-1.5 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          resp.isReadOnAir
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{resp.isReadOnAir ? 'Traité à l\'antenne ✓' : 'Marquer comme Traité / Lu'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GROUP DRILL-DOWN DETAIL MODAL */}
          {selectedGroupDetail && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
              onClick={() => setSelectedGroupDetail(null)}
            >
              <div 
                className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* MODAL HEADER */}
                <div className="p-5 border-b border-zinc-850 flex items-center justify-between gap-3 bg-zinc-900/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-3 py-1 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-300 font-mono font-black text-sm">
                      {selectedGroupDetail.percentage}%
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-mono uppercase text-pink-400 font-bold">
                        Détail du groupe ({selectedGroupDetail.count} auditeur{selectedGroupDetail.count > 1 ? 's' : ''})
                      </span>
                      <h3 className="text-base font-futuristic font-black text-white truncate">
                        {selectedGroupDetail.displayContent}
                      </h3>
                      {selectedGroupDetail.subtitle && (
                        <span className="text-xs font-mono text-cyan-400 font-bold truncate">
                          {selectedGroupDetail.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedGroupDetail(null)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* BULK ACTIONS BAR */}
                <div className="px-5 py-3 bg-zinc-900 border-b border-zinc-850 flex items-center justify-between gap-3 flex-wrap text-xs font-mono">
                  <span className="text-zinc-400 font-bold">Actions groupées :</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkMarkGroupRead(selectedGroupDetail)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-700/60 hover:bg-emerald-900 text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tout marquer comme Traité</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkMarkGroupStarred(selectedGroupDetail)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Star className={`w-3.5 h-3.5 ${selectedGroupDetail.anyStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                      <span>Favoris</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(selectedGroupDetail)}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-800/40 hover:bg-rose-900 text-rose-300 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer le groupe</span>
                    </button>
                  </div>
                </div>

                {/* AUDIENCE CONTRIBUTORS LIST */}
                <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3 scrollbar-thin">
                  <span className="text-xs font-mono font-bold text-zinc-400 uppercase">
                    Liste des auditeurs ayant soumis cette réponse :
                  </span>
                  {selectedGroupDetail.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                          <span className="text-xs font-mono font-black text-white">
                            {item.userName}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStar(item)}
                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                              item.isStarred ? 'text-amber-400 fill-amber-400' : 'text-zinc-600 hover:text-zinc-400'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleToggleReadOnAir(item);
                              setSelectedGroupDetail(prev => prev ? {
                                ...prev,
                                items: prev.items.map(i => i.id === item.id ? { ...i, isReadOnAir: !i.isReadOnAir } : i)
                              } : null);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer ${
                              item.isReadOnAir
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>{item.isReadOnAir ? 'Traité' : 'À traiter'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteResponse(item.id);
                              setSelectedGroupDetail(prev => prev ? {
                                ...prev,
                                count: prev.count - 1,
                                items: prev.items.filter(i => i.id !== item.id)
                              } : null);
                            }}
                            className="p-1 rounded-lg text-zinc-600 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* DEDICATION OR COMMENT */}
                      {item.metadata?.dedication && (
                        <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-850 text-xs font-mono text-zinc-300 italic">
                          Dédicace : "{item.metadata.dedication}"
                        </div>
                      )}
                      {(item.metadata?.directComment || item.metadata?.comment) && (
                        <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-850 text-xs font-mono text-emerald-400 italic">
                          💬 Commentaire : "{item.metadata?.directComment || item.metadata?.comment}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2-COLUMN MAIN STUDIO INTERACTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT 2 COLS: CARTOUCHIER / SOUNDBOARD JINGLES & BEDS */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-futuristic font-bold text-white uppercase tracking-wide">
                  Cartouchier Studio & Effets Antenne
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                Déclenchement instantané en superposition
              </span>
            </div>

            {soundboardItems.length === 0 ? (
              <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-850 text-center flex flex-col items-center justify-center gap-2">
                <Music className="w-6 h-6 text-zinc-600" />
                <div className="text-xs font-futuristic text-zinc-300">Cartouchier vide</div>
                <p className="text-[11px] font-mono text-zinc-500">
                  Aucun jingle ou effet sonore n'est configuré pour le direct.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {soundboardItems.map((item) => {
                  const isPlayingThis = activeCartoucheId === item.id;
                  const durationFormatted = typeof item.duration === 'number' 
                    ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}`
                    : String(item.duration || '0:00');

                  return (
                    <button
                      key={item.id}
                      onClick={() => triggerSound(item)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer relative overflow-hidden group ${
                        isPlayingThis
                          ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400 shadow-xl'
                          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.padColor || (item as any).color || '#f59e0b' }}
                        />
                        <span className="text-[10px] font-mono text-zinc-400 font-bold">
                          {durationFormatted}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold text-white line-clamp-1">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase mt-0.5">
                          {item.category.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px] font-mono">
                        <span className={isPlayingThis ? 'text-amber-300 font-bold' : 'text-zinc-500'}>
                          {isPlayingThis ? 'EN LECTURE...' : 'Cliquer pour lancer'}
                        </span>
                        <Play className={`w-3.5 h-3.5 ${isPlayingThis ? 'text-amber-400 fill-amber-400' : 'text-zinc-500'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* TALKOVER & DUCKING CONTROLS */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">Auto-Ducking & Volume Micro</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDuckingActive(!isDuckingActive);
                        showToast(`Auto-Ducking ${!isDuckingActive ? 'activé (-14dB)' : 'désactivé'}`);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        isDuckingActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {isDuckingActive ? 'DUCKING ACTIF' : 'DUCKING DÉSACTIVÉ'}
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Baisse automatique de la musique à -14dB lorsque le micro studio est ouvert
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={micVolume}
                  onChange={(e) => setMicVolume(Number(e.target.value))}
                  className="w-28 accent-cyan-400 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-cyan-300 min-w-[36px]">{micVolume}%</span>

                {onOpenControlDeck && (
                  <button
                    type="button"
                    onClick={() => onOpenControlDeck(activeStation)}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-300 text-xs font-mono font-bold cursor-pointer"
                  >
                    Deck Dédié
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COL: CONDUCTEUR D'ANTENNE EN DIRECT & TITRE EN COURS */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-futuristic font-bold text-white uppercase tracking-wide">
                En Cours & Prochains Titres
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Diffusion Actuelle
              </span>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <Disc3 className="w-8 h-8 text-amber-400 animate-spin shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-mono font-bold text-white truncate">
                    Midnight Echoes
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 truncate">
                    Luna Solaris • Album Neon Horizon
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-900 flex flex-col gap-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">À Suivre dans la rotation :</span>
                
                <div className="flex flex-col gap-1.5 text-xs font-mono text-zinc-300">
                  <div className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-850 flex items-center justify-between">
                    <span className="truncate max-w-[160px]">1. Boulevard des Étoiles</span>
                    <span className="text-[10px] text-zinc-500">3:18</span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-850 flex items-center justify-between">
                    <span className="truncate max-w-[160px]">2. Golden Horizon</span>
                    <span className="text-[10px] text-zinc-500">4:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRegieAnimationView;
