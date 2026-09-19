import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, ThumbsUp, ThumbsDown, HelpCircle, Disc3, 
  Clock, Send, X, CheckCircle, Sparkles, Music, AlertTriangle,
  ShieldAlert, CheckSquare, Square, Info
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser } from '../types';
import { 
  StudioRequest, 
  getActiveStudioRequest, 
  submitStudioResponse, 
  EVENT_STUDIO_REQUEST_CHANGED,
  isSongAlreadySubmitted,
  getResponsesForRequest,
  StudioResponse
} from '../utils/studioMessagingStore';
import { checkProfanity } from '../utils/profanityFilter';

interface ListenerStudioRequestPopupProps {
  activeStation: StreamChannel;
  currentUser: SynapseUser | null;
  showToast?: (msg: string) => void;
}

export const ListenerStudioRequestPopup: React.FC<ListenerStudioRequestPopupProps> = ({
  activeStation,
  currentUser,
  showToast,
}) => {
  const [activeRequest, setActiveRequest] = useState<StudioRequest | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stationResponses, setStationResponses] = useState<StudioResponse[]>([]);

  // Response form states
  const [userName, setUserName] = useState('');
  const [openMessageText, setOpenMessageText] = useState('');
  const [selectedMcqOptions, setSelectedMcqOptions] = useState<string[]>([]);
  const [pollDirectComment, setPollDirectComment] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [dedicationText, setDedicationText] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time profanity states
  const [profanityWarning, setProfanityWarning] = useState<string | null>(null);

  // Load answered state for this user/session
  const checkHasAnswered = (requestId: string) => {
    try {
      const answeredKeys = JSON.parse(localStorage.getItem('synapse_answered_requests') || '[]');
      return answeredKeys.includes(requestId);
    } catch {
      return false;
    }
  };

  const markAsAnswered = (requestId: string) => {
    try {
      const answeredKeys = JSON.parse(localStorage.getItem('synapse_answered_requests') || '[]');
      if (!answeredKeys.includes(requestId)) {
        answeredKeys.push(requestId);
        localStorage.setItem('synapse_answered_requests', JSON.stringify(answeredKeys));
      }
    } catch {
      // ignore
    }
  };

  // Sync active request & current responses for duplicate detection
  const updateCurrentRequest = () => {
    const req = getActiveStudioRequest(activeStation.id);
    setActiveRequest(req);
    if (req) {
      const now = Date.now();
      const exp = new Date(req.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((exp - now) / 1000));
      setSecondsLeft(remaining);
      setHasAnswered(checkHasAnswered(req.id));
      setStationResponses(getResponsesForRequest(req.id));
    } else {
      setSecondsLeft(0);
      setIsDialogOpen(false);
      setStationResponses([]);
    }
  };

  useEffect(() => {
    updateCurrentRequest();

    const handleStudioChange = () => {
      updateCurrentRequest();
    };

    window.addEventListener(EVENT_STUDIO_REQUEST_CHANGED, handleStudioChange);
    window.addEventListener('storage', handleStudioChange);

    const timer = setInterval(() => {
      if (activeRequest) {
        const now = Date.now();
        const exp = new Date(activeRequest.expiresAt).getTime();
        const remaining = Math.max(0, Math.floor((exp - now) / 1000));
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          setActiveRequest(null);
          setIsDialogOpen(false);
        }
      } else {
        const req = getActiveStudioRequest(activeStation.id);
        if (req) {
          setActiveRequest(req);
          setHasAnswered(checkHasAnswered(req.id));
          setStationResponses(getResponsesForRequest(req.id));
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener(EVENT_STUDIO_REQUEST_CHANGED, handleStudioChange);
      window.removeEventListener('storage', handleStudioChange);
      clearInterval(timer);
    };
  }, [activeStation.id, activeRequest?.id]);

  // Init user name
  useEffect(() => {
    if (currentUser?.displayName) {
      setUserName(currentUser.displayName);
    } else if (!userName) {
      const saved = localStorage.getItem('synapse_listener_pseudo');
      if (saved) setUserName(saved);
    }
  }, [currentUser]);

  // Real-time profanity validation on input fields
  useEffect(() => {
    let textToValidate = '';
    if (activeRequest?.type === 'open_message') {
      textToValidate = openMessageText;
    } else if (activeRequest?.type === 'poll_yes_no') {
      textToValidate = pollDirectComment;
    } else if (activeRequest?.type === 'song_request') {
      textToValidate = `${songTitle} ${songArtist} ${dedicationText}`;
    }

    if (!textToValidate.trim()) {
      setProfanityWarning(null);
      return;
    }

    const check = checkProfanity(textToValidate);
    if (check.hasProfanity) {
      setProfanityWarning(check.warningMessage || 'Propos inapproprié détecté.');
    } else {
      setProfanityWarning(null);
    }
  }, [openMessageText, pollDirectComment, songTitle, songArtist, dedicationText, activeRequest?.type]);

  // Duplicate song check
  const duplicateSongInfo = useMemo(() => {
    if (activeRequest?.type !== 'song_request' || !songTitle.trim() || !songArtist.trim()) {
      return null;
    }
    const check = isSongAlreadySubmitted(activeRequest.id, songTitle, songArtist, stationResponses);
    if (check.isDuplicate) {
      return check;
    }
    return null;
  }, [activeRequest?.id, activeRequest?.type, songTitle, songArtist, stationResponses]);

  // List of already submitted songs for inspiration / avoiding duplicates
  const existingSongs = useMemo(() => {
    if (activeRequest?.type !== 'song_request') return [];
    const list: { title: string; artist: string; user: string }[] = [];
    stationResponses.forEach((r) => {
      if (r.metadata?.songTitle && r.metadata?.songArtist) {
        list.push({
          title: r.metadata.songTitle,
          artist: r.metadata.songArtist,
          user: r.userName,
        });
      }
    });
    return list;
  }, [activeRequest?.type, stationResponses]);

  if (!activeRequest || secondsLeft <= 0) {
    return null;
  }

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getRequestVisuals = (type: StudioRequest['type']) => {
    switch (type) {
      case 'poll_yes_no':
        return {
          icon: ThumbsUp,
          label: 'Sondage OUI / NON',
          color: '#10b981',
          bgBorder: 'border-emerald-500/50 bg-zinc-950/90 hover:bg-emerald-950/40 text-emerald-400',
          glow: 'shadow-emerald-500/20',
        };
      case 'poll_mcq':
        return {
          icon: HelpCircle,
          label: activeRequest.mcqMode === 'multiple' ? 'Sondage QCM (Choix Multiples)' : 'Sondage QCM Antenne',
          color: '#f59e0b',
          bgBorder: 'border-amber-500/50 bg-zinc-950/90 hover:bg-amber-950/40 text-amber-400',
          glow: 'shadow-amber-500/20',
        };
      case 'song_request':
        return {
          icon: Disc3,
          label: 'Requête de Titre',
          color: '#06b6d4',
          bgBorder: 'border-cyan-500/50 bg-zinc-950/90 hover:bg-cyan-950/40 text-cyan-400',
          glow: 'shadow-cyan-500/20',
        };
      case 'open_message':
      default:
        return {
          icon: MessageSquare,
          label: 'Message & Réaction Directe',
          color: '#ec4899',
          bgBorder: 'border-pink-500/50 bg-zinc-950/90 hover:bg-pink-950/40 text-pink-400',
          glow: 'shadow-pink-500/20',
        };
    }
  };

  const visuals = getRequestVisuals(activeRequest.type);
  const IconComponent = visuals.icon;

  const notify = (msg: string) => {
    if (showToast) {
      showToast(msg);
    }
  };

  const handleToggleMcqOption = (option: string) => {
    if (activeRequest.mcqMode === 'multiple') {
      setSelectedMcqOptions((prev) => 
        prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
      );
    } else {
      setSelectedMcqOptions([option]);
    }
  };

  const handleSubmitResponse = (forcedChoice?: string) => {
    if (!activeRequest) return;

    // Block submission if profanity is detected
    if (profanityWarning) {
      notify('⚠️ Impossible d\'envoyer : votre message contient des termes inappropriés.');
      return;
    }

    let finalContent = forcedChoice || '';
    let metadata: any = {};

    if (activeRequest.type === 'poll_yes_no') {
      const choice = forcedChoice || activeRequest.binaryChoices?.[0] || 'OUI';
      finalContent = choice;
      metadata = { 
        pollChoice: choice,
        directComment: pollDirectComment.trim() || undefined,
      };
    } else if (activeRequest.type === 'poll_mcq') {
      if (selectedMcqOptions.length === 0) {
        notify('Veuillez sélectionner au moins une option.');
        return;
      }
      finalContent = selectedMcqOptions.join(', ');
      metadata = { 
        pollChoices: selectedMcqOptions,
        pollChoice: selectedMcqOptions[0],
      };
    } else if (activeRequest.type === 'song_request') {
      if (!songTitle.trim() || !songArtist.trim()) {
        notify('Veuillez renseigner le titre et l\'artiste.');
        return;
      }

      // Check duplicate strictly
      const dup = isSongAlreadySubmitted(activeRequest.id, songTitle, songArtist, stationResponses);
      if (dup.isDuplicate) {
        notify(`🚫 Ce titre a déjà été proposé par ${dup.existingSubmitter || 'un auditeur'}.`);
        return;
      }

      finalContent = `${songTitle.trim()} - ${songArtist.trim()}`;
      metadata = {
        songTitle: songTitle.trim(),
        songArtist: songArtist.trim(),
        dedication: dedicationText.trim() || undefined,
      };
    } else {
      // open message
      if (!openMessageText.trim()) {
        notify('Veuillez saisir votre message pour le studio');
        return;
      }
      finalContent = openMessageText.trim();
    }

    setIsSubmitting(true);

    const pseudo = userName.trim() || 'Auditeur';
    localStorage.setItem('synapse_listener_pseudo', pseudo);

    submitStudioResponse({
      requestId: activeRequest.id,
      stationId: activeStation.id,
      type: activeRequest.type,
      userName: pseudo,
      userEmail: currentUser?.email,
      content: finalContent,
      metadata,
    });

    markAsAnswered(activeRequest.id);
    setHasAnswered(true);
    setIsSubmitting(false);
    notify('✨ Transmis en direct à la régie studio !');
  };

  const binaryChoiceA = activeRequest.binaryChoices?.[0] || 'OUI';
  const binaryChoiceB = activeRequest.binaryChoices?.[1] || 'NON';

  return (
    <>
      {/* FLOATING POPUP BUTTON ON LISTENER SCREEN */}
      <div className="fixed bottom-24 right-4 sm:right-6 z-40 flex flex-col items-end gap-2 animate-in slide-in-from-bottom-5 duration-300">
        <button
          onClick={() => setIsDialogOpen(true)}
          className={`px-4 py-2.5 rounded-full border backdrop-blur-xl shadow-2xl transition-all cursor-pointer flex items-center gap-3 group hover:scale-105 active:scale-95 ${visuals.bgBorder} ${visuals.glow}`}
          style={{ borderColor: visuals.color }}
        >
          {/* Animated pulse ring */}
          <span className="relative flex h-3.5 w-3.5">
            <span 
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: visuals.color }}
            />
            <span 
              className="relative inline-flex rounded-full h-3.5 w-3.5"
              style={{ backgroundColor: visuals.color }}
            />
          </span>

          <IconComponent className="w-4 h-4 animate-bounce" style={{ color: visuals.color }} />

          <div className="flex flex-col text-left">
            <span className="text-[11px] font-futuristic font-black uppercase tracking-wider text-white line-clamp-1">
              {visuals.label}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatCountdown(secondsLeft)} restant</span>
            </span>
          </div>

          <div 
            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-black"
            style={{ backgroundColor: visuals.color }}
          >
            {hasAnswered ? 'Envoyé ✓' : 'Participer'}
          </div>
        </button>
      </div>

      {/* INTERACTIVE DIALOG MODAL */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden text-left animate-in zoom-in-95 duration-200">
            {/* MODAL HEADER */}
            <div className="p-5 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/70">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                  style={{ backgroundColor: visuals.color }}
                >
                  <IconComponent className="w-5 h-5 text-black" />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-400 uppercase">
                      Requête Studio
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                      📻 {activeRequest.stationName}
                    </span>
                  </div>
                  <span className="text-sm font-futuristic font-bold text-white">
                    {visuals.label}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatCountdown(secondsLeft)}</span>
                </div>

                <button
                  onClick={() => setIsDialogOpen(false)}
                  className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* MODAL BODY (Scrollable) */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
              {/* THE PROMPT TITLE */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-1.5">
                <span className="text-base sm:text-lg font-bold text-white leading-snug">
                  "{activeRequest.title}"
                </span>
                {activeRequest.promptMessage && (
                  <span className="text-xs font-mono text-zinc-400">
                    {activeRequest.promptMessage}
                  </span>
                )}

                {/* SONG RULES (IF SONG REQUEST) */}
                {activeRequest.type === 'song_request' && activeRequest.songRules && (
                  <div className="mt-2 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col gap-1 text-xs font-mono">
                    <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Règles imposées par l'animateur :
                    </span>
                    {activeRequest.songRules.genre && (
                      <span className="text-zinc-300">
                        • <strong>Genre :</strong> {activeRequest.songRules.genre}
                      </span>
                    )}
                    {activeRequest.songRules.decade && (
                      <span className="text-zinc-300">
                        • <strong>Époque :</strong> {activeRequest.songRules.decade}
                      </span>
                    )}
                    {activeRequest.songRules.customRule && (
                      <span className="text-cyan-200">
                        • <strong>Consigne :</strong> {activeRequest.songRules.customRule}
                      </span>
                    )}
                  </div>
                )}

                <span className="text-[10px] font-mono text-zinc-500 pt-1">
                  Lancé par : <strong className="text-zinc-300">{activeRequest.authorName}</strong>
                </span>
              </div>

              {/* ALREADY ANSWERED STATE */}
              {hasAnswered ? (
                <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center flex flex-col items-center justify-center gap-2">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                  <span className="text-sm font-futuristic font-bold text-emerald-300">
                    Votre réponse a bien été transmise à la régie !
                  </span>
                  <span className="text-xs font-mono text-zinc-400 max-w-sm">
                    L'animateur regroupe et traite vos participations en direct à l'antenne. Merci pour votre fidélité.
                  </span>
                  <button
                    onClick={() => setIsDialogOpen(false)}
                    className="mt-3 px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-mono font-bold cursor-pointer"
                  >
                    Fermer la fenêtre
                  </button>
                </div>
              ) : (
                /* INTERACTIVE FORM DEPENDING ON REQUEST TYPE */
                <div className="flex flex-col gap-4">
                  {/* PSEUDO INPUT */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-mono text-zinc-400 font-bold">
                      Votre Prénom ou Pseudo d'auditeur :
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Julien, Sarah_92, Alex..."
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* PROFANITY WARNING BANNER */}
                  {profanityWarning && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 flex items-start gap-2.5 text-xs font-mono text-rose-300 animate-in fade-in">
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-rose-400">Filtre Antenne Actif</span>
                        <span>{profanityWarning}</span>
                      </div>
                    </div>
                  )}

                  {/* 1. OUI / NON POLL (OR CUSTOM BINARY CHOICES + OPTIONAL DIRECT COMMENT) */}
                  {activeRequest.type === 'poll_yes_no' && (
                    <div className="flex flex-col gap-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={!!profanityWarning || isSubmitting}
                          onClick={() => handleSubmitResponse(binaryChoiceA)}
                          className="py-4 px-3 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border-2 border-emerald-500/60 hover:border-emerald-400 text-emerald-300 font-futuristic font-bold text-sm sm:text-base flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-center"
                        >
                          <ThumbsUp className="w-5 h-5 text-emerald-400" />
                          <span className="break-words line-clamp-1 uppercase">{binaryChoiceA}</span>
                        </button>

                        <button
                          type="button"
                          disabled={!!profanityWarning || isSubmitting}
                          onClick={() => handleSubmitResponse(binaryChoiceB)}
                          className="py-4 px-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border-2 border-rose-500/60 hover:border-rose-400 text-rose-300 font-futuristic font-bold text-sm sm:text-base flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-center"
                        >
                          <ThumbsDown className="w-5 h-5 text-rose-400" />
                          <span className="break-words line-clamp-1 uppercase">{binaryChoiceB}</span>
                        </button>
                      </div>

                      {/* OPTIONAL DIRECT COMMENT BOX FOR BINARY POLL */}
                      {activeRequest.allowDirectComment && (
                        <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-850">
                          <label className="text-[11px] font-mono text-zinc-400 font-bold flex items-center justify-between">
                            <span>💬 Commentaire ou précision pour l'antenne (optionnel) :</span>
                            <span className="text-[10px] text-zinc-500 font-normal">Sera associé à votre vote</span>
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Expliquez en quelques mots pourquoi vous avez voté ainsi..."
                            value={pollDirectComment}
                            onChange={(e) => setPollDirectComment(e.target.value)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-emerald-400 focus:outline-none resize-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. MCQ POLL (SINGLE OR MULTIPLE CHOICES) */}
                  {activeRequest.type === 'poll_mcq' && (
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-mono text-zinc-400 font-bold">
                          {activeRequest.mcqMode === 'multiple' 
                            ? 'Sélectionnez une ou plusieurs options :' 
                            : 'Sélectionnez votre choix unique :'}
                        </label>
                        {activeRequest.mcqMode === 'multiple' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            {selectedMcqOptions.length} sélectionnée(s)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                        {activeRequest.options && activeRequest.options.map((opt, idx) => {
                          const isSelected = selectedMcqOptions.includes(opt);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleToggleMcqOption(opt)}
                              className={`p-3 rounded-xl border text-left text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                              }`}
                            >
                              <span>{opt}</span>
                              {activeRequest.mcqMode === 'multiple' ? (
                                isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-600" />
                                )
                              ) : (
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-amber-400 bg-amber-400' : 'border-zinc-700'
                                }`}>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={selectedMcqOptions.length === 0 || isSubmitting}
                        onClick={() => handleSubmitResponse()}
                        className="mt-2 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-futuristic font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {activeRequest.mcqMode === 'multiple'
                            ? `Valider mes choix (${selectedMcqOptions.length})`
                            : 'Valider mon vote'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* 3. SONG REQUEST (WITH DUPLICATE FILTER & RULES) */}
                  {activeRequest.type === 'song_request' && (
                    <div className="flex flex-col gap-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-mono text-zinc-400 font-bold">
                            Titre du Morceau * :
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="ex: Get Lucky, One More Time..."
                            value={songTitle}
                            onChange={(e) => setSongTitle(e.target.value)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-mono text-zinc-400 font-bold">
                            Artiste * :
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="ex: Daft Punk, The Weeknd..."
                            value={songArtist}
                            onChange={(e) => setSongArtist(e.target.value)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* DUPLICATE WARNING */}
                      {duplicateSongInfo && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-start gap-2.5 text-xs font-mono text-amber-200 animate-in fade-in">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-amber-400">Titre déjà proposé !</span>
                            <span>
                              Ce morceau (« <strong>{duplicateSongInfo.existingTitle}</strong> ») a déjà été demandé par{' '}
                              <strong>{duplicateSongInfo.existingSubmitter}</strong>. Afin d'assurer la diversité de l'antenne, merci de proposer un titre différent !
                            </span>
                          </div>
                        </div>
                      )}

                      {/* LIST OF ALREADY PROPOSED SONGS BY OTHER LISTENERS */}
                      {existingSongs.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-1.5">
                          <span className="text-[10px] font-mono text-zinc-400 font-bold flex items-center gap-1">
                            <Disc3 className="w-3 h-3 text-cyan-400" />
                            Morceaux déjà proposés ({existingSongs.length}) :
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                            {existingSongs.map((s, idx) => (
                              <span 
                                key={idx} 
                                className="px-2 py-0.5 rounded-md bg-zinc-850 border border-zinc-750 text-[10px] font-mono text-zinc-300"
                              >
                                {s.title} • {s.artist}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-mono text-zinc-400 font-bold">
                          Dédicace ou mot pour l'antenne (optionnel) :
                        </label>
                        <input
                          type="text"
                          placeholder="ex: Pour toute l'équipe de nuit, bon mix !"
                          value={dedicationText}
                          onChange={(e) => setDedicationText(e.target.value)}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={
                          !songTitle.trim() || 
                          !songArtist.trim() || 
                          !!duplicateSongInfo || 
                          !!profanityWarning ||
                          isSubmitting
                        }
                        onClick={() => handleSubmitResponse()}
                        className="mt-2 w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-futuristic font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                      >
                        <Music className="w-3.5 h-3.5" />
                        <span>Transmettre ma requête musicale</span>
                      </button>
                    </div>
                  )}

                  {/* 4. OPEN MESSAGE / REACTION */}
                  {activeRequest.type === 'open_message' && (
                    <div className="flex flex-col gap-2 pt-1">
                      <label className="text-[11px] font-mono text-zinc-400 font-bold flex items-center justify-between">
                        <span>Votre message ou dédicace pour l'animateur :</span>
                        <span className="text-[10px] text-zinc-500 font-normal">Filtre anti-injures actif</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Écrivez votre message direct à l'attention du studio..."
                        value={openMessageText}
                        onChange={(e) => setOpenMessageText(e.target.value)}
                        className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-pink-400 focus:outline-none resize-none"
                      />

                      <button
                        type="button"
                        disabled={!openMessageText.trim() || !!profanityWarning || isSubmitting}
                        onClick={() => handleSubmitResponse()}
                        className="mt-2 w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-futuristic font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-pink-500/20"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Envoyer au studio</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* MODAL FOOTER NOTE */}
            <div className="p-3.5 border-t border-zinc-850 bg-zinc-900/30 text-center text-[10px] font-mono text-zinc-500 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>
                Messagerie studio modérée : transmission à sens unique sécurisée vers la régie ON-AIR
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ListenerStudioRequestPopup;
