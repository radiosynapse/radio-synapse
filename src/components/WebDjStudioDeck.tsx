import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Volume2, Headphones, Sparkles, Music2, 
  Flame, FastForward, ExternalLink, Check, Play, Pause, 
  ShieldCheck, Sliders, Disc, Zap, Wifi, WifiOff,
  Settings, Eye, EyeOff, SkipForward, Activity, RefreshCw
} from 'lucide-react';
import { StreamChannel } from '../data';
import { 
  StreamNowPlayingData, 
  skipStationCurrentTrack 
} from '../lib/streamServer';
import { 
  BroadcastState, 
  VuMeterReading, 
  AudioInputDevice, 
  StreamStats, 
  liveBroadcastEngine 
} from '../utils/liveBroadcastEngine';

interface WebDjStudioDeckProps {
  station: StreamChannel;
  targetStationId: number;
  currentShortcode: string;
  webDjUrl: string;
  nowPlaying: StreamNowPlayingData | null;
  isStreamerLive: boolean;
  liveStreamerName: string;
  broadcastState: BroadcastState;
  broadcastError: string;
  onAirSeconds: number;
  vuReading: VuMeterReading;
  micGain: number;
  setMicGain: (val: number) => void;
  lowCutEnabled: boolean;
  setLowCutEnabled: (val: boolean) => void;
  compressorEnabled: boolean;
  setCompressorEnabled: (val: boolean) => void;
  monitorEnabled: boolean;
  setMonitorEnabled: (val: boolean) => void;
  audioDevices: AudioInputDevice[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  micMode: 'lock' | 'ptt';
  setMicMode: (mode: 'lock' | 'ptt') => void;
  onToggleBroadcast: () => void;
  onPttMouseDown: () => void;
  onPttMouseUp: () => void;
  lastInterventionBlob: Blob | null;
  lastInterventionUrl: string | null;
  lastInterventionDuration: number;
  onInjectIntervention: (mode: 'immediate' | 'next') => void;
  isInjectingIntervention: boolean;
  musicBedActive: boolean;
  setMusicBedActive: (active: boolean) => void;
  musicBedVolume: number;
  setMusicBedVolume: (vol: number) => void;
  onPlayInstantJingle: (name: string, type: 'gong' | 'chime' | 'stinger' | 'applause' | 'horn' | 'laser') => void;
  showToast: (msg: string) => void;
  onCopyText: (text: string, field: string) => void;
  copiedField: string | null;
  onSkipTrack?: () => void;
  isSkippingTrack?: boolean;
}

export const WebDjStudioDeck: React.FC<WebDjStudioDeckProps> = ({
  station,
  targetStationId,
  currentShortcode,
  webDjUrl,
  nowPlaying,
  isStreamerLive,
  liveStreamerName,
  broadcastState,
  broadcastError,
  onAirSeconds,
  vuReading,
  micGain,
  setMicGain,
  lowCutEnabled,
  setLowCutEnabled,
  compressorEnabled,
  setCompressorEnabled,
  monitorEnabled,
  setMonitorEnabled,
  audioDevices,
  selectedDeviceId,
  setSelectedDeviceId,
  micMode,
  setMicMode,
  onToggleBroadcast,
  onPttMouseDown,
  onPttMouseUp,
  lastInterventionBlob,
  lastInterventionUrl,
  lastInterventionDuration,
  onInjectIntervention,
  isInjectingIntervention,
  musicBedActive,
  setMusicBedActive,
  musicBedVolume,
  setMusicBedVolume,
  onPlayInstantJingle,
  showToast,
  onCopyText,
  copiedField,
  onSkipTrack,
  isSkippingTrack,
}) => {
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [interventionAudioPlaying, setInterventionAudioPlaying] = useState<boolean>(false);
  const interventionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Streamer Credentials & Settings
  const initialConfig = liveBroadcastEngine.getStreamerConfig();
  const [wsUrl, setWsUrl] = useState<string>(initialConfig.wsUrl);
  const [mount, setMount] = useState<string>(initialConfig.mount);
  const [username, setUsername] = useState<string>(initialConfig.username);
  const [password, setPassword] = useState<string>(initialConfig.password || '');
  const [isTestingSocket, setIsTestingSocket] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Live streaming stats
  const [streamStats, setStreamStats] = useState<StreamStats>(liveBroadcastEngine.getStreamStats());

  useEffect(() => {
    const unsub = liveBroadcastEngine.subscribeStats((stats) => {
      setStreamStats(stats);
    });
    return () => unsub();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSaveCredentials = () => {
    liveBroadcastEngine.saveCredentials({
      wsUrl,
      mount,
      username,
      password,
    });
    showToast('Paramètres de streaming DJ sauvegardés !');
  };

  const handleTestConnection = async () => {
    setIsTestingSocket(true);
    setTestResult(null);
    try {
      liveBroadcastEngine.saveCredentials({ wsUrl, mount, username, password });
      const ok = await liveBroadcastEngine.connectStream();
      if (ok) {
        setTestResult({
          ok: true,
          message: 'Connecté avec succès au pont WebSocket Icecast ! Handshake validé.',
        });
        showToast('Connexion WebSocket Icecast réussie !');
      } else {
        const err = liveBroadcastEngine.getStreamStats().lastError || 'Échec de connexion WebSocket';
        setTestResult({
          ok: false,
          message: err,
        });
        showToast(`Erreur : ${err}`);
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || 'Erreur inconnue',
      });
    } finally {
      setIsTestingSocket(false);
    }
  };

  // Direct skip via Streaming API
  const handleImmediateSkip = async () => {
    if (onSkipTrack) {
      onSkipTrack();
      return;
    }
    try {
      const res = await skipStationCurrentTrack(targetStationId);
      showToast(res.message || 'Skip effectué sur le flux !');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors du skip');
    }
  };

  // Direct cartridge antenne trigger via Web Audio mixed into live broadcast stream (NO SKIP)
  const handleCartridgeAntennaTrigger = async (name: string, type: 'gong' | 'chime' | 'stinger' | 'applause' | 'horn' | 'laser') => {
    try {
      showToast(`🔴 Diffusion à l'antenne : "${name}" mixé sur le flux direct...`);
      await liveBroadcastEngine.playSynthesizedJingle(type, 'on_air');
      showToast(`🚀 Jingle "${name}" diffusé à l'antenne !`);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la diffusion du jingle');
    }
  };

  const handleCartridgeCueTrigger = async (name: string, type: 'gong' | 'chime' | 'stinger' | 'applause' | 'horn' | 'laser') => {
    try {
      if (onPlayInstantJingle) {
        onPlayInstantJingle(name, type);
      } else {
        await liveBroadcastEngine.playSynthesizedJingle(type, 'cue');
      }
      showToast(`🎧 Pré-écoute CUE : "${name}" dans votre casque (hors antenne)`);
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la pré-écoute');
    }
  };

  const isConnected = streamStats.connectionState === 'connected';
  const isOnAir = broadcastState === 'on_air';
  const isCue = broadcastState === 'cue';

  return (
    <div className="space-y-4 font-sans text-zinc-100">
      
      {/* ERROR BANNER IF ANY */}
      {broadcastError && (
        <div className="p-3 rounded-xl bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-mono flex items-center justify-between">
          <span>⚠️ {broadcastError}</span>
        </div>
      )}

      {/* 1. TOP HEADER: DYNAMIC STATUS BAR (ON AIR vs CUE vs STANDBY) */}
      <div className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 flex-wrap shadow-lg ${
        isOnAir
          ? 'bg-gradient-to-r from-red-950/90 via-red-900/80 to-rose-950/90 border-red-500 text-red-100 shadow-red-950/80 ring-2 ring-red-500/50'
          : isCue
            ? 'bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 border-white/30 text-white shadow-black/70 ring-1 ring-white/20'
            : isStreamerLive
              ? 'bg-amber-950/60 border-amber-500 text-amber-200'
              : 'bg-zinc-900/95 border-zinc-800 text-zinc-300'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-4 h-4 rounded-full flex-shrink-0 transition-all ${
            isOnAir
              ? 'bg-red-500 ring-4 ring-red-500/30 animate-ping'
              : isCue
                ? 'bg-sky-400 ring-4 ring-sky-400/30 animate-pulse'
                : isStreamerLive
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-500'
          }`} />

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h4 className="text-xs font-mono font-black uppercase tracking-wider flex items-center gap-2">
                {isOnAir ? (
                  <span className="text-red-300 flex items-center gap-2">
                    <span>🔴 EN DIRECT SUR L'ANTENNE — {formatTime(onAirSeconds)}</span>
                  </span>
                ) : isCue ? (
                  <span className="text-sky-300 flex items-center gap-2">
                    <span>🎧 CUE / PRÉ-ÉCOUTE LOCALE (HORS ANTENNE)</span>
                  </span>
                ) : isStreamerLive ? (
                  <span className="text-amber-300">🎙️ DJ EXTERNE CONNECTÉ : {liveStreamerName.toUpperCase()}</span>
                ) : (
                  <span className="text-emerald-400">📻 AUTODJ RADIO SYNAPSE ACTIF (ATTENTE INTERVENTION)</span>
                )}
              </h4>

              {/* Protocol Badge */}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 ${
                isConnected
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800'
              }`}>
                {isConnected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-zinc-500" />}
                <span>{isConnected ? 'WebSocket Icecast Connecté' : 'Socket Déconnecté'}</span>
              </span>

              {streamStats.handshakeOk && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-zinc-900 text-zinc-200 border border-zinc-700 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-white" />
                  <span>Handshake Liquidsoap Validé</span>
                </span>
              )}

              <span className="text-[10px] font-mono text-zinc-400">
                • {station.name}
              </span>
              {nowPlaying?.now_playing?.song && (
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[200px]">
                  • Titre : <strong className="text-zinc-200">{nowPlaying.now_playing.song.title}</strong>
                </span>
              )}
            </div>

            <p className="text-[11px] mt-1 opacity-90 leading-tight">
              {isOnAir
                ? 'Transmission audio Ogg/Opus active vers le serveur broadcast. Le flux antenne bascule en direct et atténue la musique !'
                : isCue
                  ? 'Votre voix boucle uniquement dans votre casque (sidetone). Le heartbeat WebSocket maintient la session de stream au chaud sans couper l\'antenne.'
                  : 'Console Web DJ native avec traitement voix broadcast, protocole Icecast WebSocket et injection prioritaire.'}
            </p>
          </div>
        </div>

        {/* Live Stream Telemetry & Quick Action Links */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isOnAir && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-red-950/90 border border-red-500/60 text-[11px] font-mono">
              <span className="text-red-300 font-bold">{streamStats.bitrateKbps || 128} kb/s</span>
              <span className="text-zinc-400">•</span>
              <span className="text-zinc-300">{formatBytes(streamStats.bytesSent)}</span>
              <span className="text-zinc-400">•</span>
              <span className="text-red-400 font-bold">{streamStats.packetsSent} paquets</span>
            </div>
          )}

          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
              showConfig 
                ? 'bg-white text-black border-white shadow-md'  
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-zinc-300" />
            <span>Paramètres WebSocket DJ</span>
          </button>

          <a
            href={webDjUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 hover:text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title={`Lien direct DJ : ${webDjUrl}`}
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-300" />
            <span>Studio WebDJ ({currentShortcode})</span>
          </a>
        </div>
      </div>

      {/* 2. WEBSOCKET & ICECAST STREAMER CONFIGURATION DRAWER */}
      {showConfig && (
        <div className="p-4 rounded-2xl bg-zinc-900/95 border border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-150 space-y-4 font-mono text-xs shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Configuration du Flux WebSocket & Serveur DJ
            </span>
            <span className="text-[10px] text-zinc-500">Station #{targetStationId} • Port DJ : 8005</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* WebSocket URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-zinc-400 block font-bold">URL WebSocket du Serveur</label>
                <button
                  type="button"
                  onClick={() => onCopyText(wsUrl, 'wsUrl')}
                  className="text-[9px] text-zinc-300 hover:underline cursor-pointer"
                >
                  {copiedField === 'wsUrl' ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="wss://cast.radiosynapse.fr/webdj/pop-variete/"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-200 text-[11px] font-mono focus:border-white outline-none"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => setWsUrl('wss://cast.radiosynapse.fr/webdj/pop-variete/')}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                >
                  ⭐ Web DJ (/webdj/pop-variete/)
                </button>
                <button
                  type="button"
                  onClick={() => setWsUrl('wss://cast.radiosynapse.fr/radio/8005/')}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Proxy Radio (/radio/8005/)
                </button>
                <button
                  type="button"
                  onClick={() => setWsUrl('wss://cast.radiosynapse.fr:8005/')}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Port Direct (:8005)
                </button>
              </div>
            </div>

            {/* Mount point */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 block font-bold">Point de Montage (Mount)</label>
              <input
                type="text"
                value={mount}
                onChange={(e) => setMount(e.target.value)}
                placeholder="/"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-white text-[11px] font-mono focus:border-white outline-none"
              />
              <span className="text-[9px] text-zinc-500 block">Défaut Icecast DJ : /</span>
            </div>

            {/* Streamer username */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 block font-bold">Identifiant Streamer DJ</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="theocourant"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-200 text-[11px] font-mono focus:border-white outline-none"
              />
              <span className="text-[9px] text-zinc-500 block">Compte DJ Synapse</span>
            </div>

            {/* Streamer password */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 block font-bold">Mot de Passe Streamer DJ</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe du streamer"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 pr-8 text-white text-[11px] font-mono focus:border-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[9px] text-zinc-500 block">Sauvegardé de manière sécurisée</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-800 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveCredentials}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer les Identifiants</span>
              </button>

              <button
                onClick={handleTestConnection}
                disabled={isTestingSocket}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5 transition-all border border-zinc-700 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSocket ? 'animate-spin text-white' : 'text-zinc-400'}`} />
                <span>{isTestingSocket ? 'Test de Connexion...' : 'Tester Handshake Icecast'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 ${
                testResult.ok ? 'bg-emerald-950/80 border border-emerald-600 text-emerald-300' : 'bg-red-950/80 border border-red-600 text-red-300'
              }`}>
                {testResult.ok ? <Check className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN CONSOLE SURFACE (MASTER DUAL CONTROLS & VOICE PROCESSING) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN: MASTER DUAL ON AIR & CUE CONTROLS */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2">
              <Mic className="w-4 h-4 text-red-400" />
              Contrôle d'Antenne Micro (Web DJ Live)
            </span>

            {/* PTT VS LOCK SWITCH */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[11px] font-mono">
              <button
                onClick={() => setMicMode('lock')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  micMode === 'lock'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Bascule (Lock)
              </button>
              <button
                onClick={() => setMicMode('ptt')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  micMode === 'ptt'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Push-To-Talk (PTT)
              </button>
            </div>
          </div>

          {/* DUAL CENTRAL MASTER BUTTONS: DIRECT ON AIR vs CUE PRÉ-ÉCOUTE */}
          <div className="flex flex-col items-center justify-center gap-4 py-2">
            
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {/* BUTTON 1: ON AIR (ROUGE) */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onMouseDown={() => {
                    if (micMode === 'ptt') onPttMouseDown();
                  }}
                  onMouseUp={() => {
                    if (micMode === 'ptt') onPttMouseUp();
                  }}
                  onClick={async () => {
                    if (micMode === 'lock') {
                      onToggleBroadcast();
                    }
                  }}
                  className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-2xl border-4 ${
                    isOnAir
                      ? 'bg-gradient-to-b from-red-600 to-rose-700 border-red-400 text-white shadow-red-600/70 animate-pulse scale-105'
                      : 'bg-zinc-800 hover:bg-zinc-750 border-zinc-700 text-zinc-300 hover:border-red-500/60 hover:text-white'
                  }`}
                  title="Activer la diffusion en direct vers Liquidsoap"
                >
                  <Mic className={`w-9 h-9 ${isOnAir ? 'text-white animate-bounce' : 'text-red-400'}`} />
                  <div className="text-center">
                    <span className="text-xs font-black font-mono tracking-widest uppercase block">
                      {isOnAir ? 'ON AIR' : 'PASSER ON AIR'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-300">
                      {isOnAir ? formatTime(onAirSeconds) : 'Direct Antenne'}
                    </span>
                  </div>
                </button>
                <span className="text-[10px] font-mono font-bold text-zinc-400">Diffusion Directe</span>
              </div>

              {/* BUTTON 2: CUE / PRÉ-ÉCOUTE (BLEU) */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={async () => {
                    if (isCue) {
                      liveBroadcastEngine.stopBroadcast();
                      showToast('Micro fermé. Retour en veille.');
                    } else {
                      await liveBroadcastEngine.setMode('cue');
                      showToast('🎧 Mode CUE actif : pré-écoute locale dans votre casque.');
                    }
                  }}
                  className={`w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-2xl border-4 ${
                    isCue
                      ? 'bg-white border-zinc-200 text-black shadow-white/20 scale-105 ring-2 ring-white/40'
                      : 'bg-zinc-800 hover:bg-zinc-750 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                  title="Pré-écoute locale dans le casque sans diffuser à l'antenne"
                >
                  <Headphones className={`w-9 h-9 ${isCue ? 'text-black animate-pulse' : 'text-zinc-200'}`} />
                  <div className="text-center">
                    <span className="text-xs font-black font-mono tracking-widest uppercase block">
                      {isCue ? 'CUE ACTIF' : 'ACTIVER CUE'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-300">
                      {isCue ? 'Dans le casque' : 'Pré-écoute'}
                    </span>
                  </div>
                </button>
                <span className="text-[10px] font-mono font-bold text-zinc-400">Hors Antenne</span>
              </div>
            </div>

            {/* PTT Quick Action / Instructions */}
            <div className="text-center max-w-sm">
              <p className="text-xs text-zinc-400 leading-relaxed">
                {micMode === 'ptt' ? (
                  <span className="text-zinc-200 font-mono">
                    💡 Mode PTT : Maintenez le bouton ou la barre d'<strong>ESPACE</strong> pour basculer ON AIR en direct !
                  </span>
                ) : (
                  <span>
                    Basculez librement entre <strong>ON AIR</strong> (antenne radio en direct) et <strong>CUE</strong> (vocal dans le casque uniquement).
                  </span>
                )}
              </p>
            </div>

            {/* Heartbeat Status Indicator */}
            <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80 w-full flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'
                }`} />
                <span>Heartbeat Liquidsoap Keepalive :</span>
              </div>
              <span className="text-white font-bold">
                {isConnected ? 'Actif (toutes les 3s)' : 'En attente'}
              </span>
            </div>
          </div>

          {/* LAST RECORDED INTERVENTION / PRIORITY INJECTION DECK */}
          {lastInterventionBlob && (
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-purple-900/50 flex flex-col gap-2.5 font-mono animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-300 font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Dernière Prise Vocale ({formatTime(lastInterventionDuration)})
                </span>
                {lastInterventionUrl && (
                  <button
                    onClick={() => {
                      if (!interventionAudioRef.current) return;
                      if (interventionAudioPlaying) {
                        interventionAudioRef.current.pause();
                        setInterventionAudioPlaying(false);
                      } else {
                        interventionAudioRef.current.currentTime = 0;
                        interventionAudioRef.current.play();
                        setInterventionAudioPlaying(true);
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {interventionAudioPlaying ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-zinc-300" />}
                    <span>{interventionAudioPlaying ? 'Stop' : 'Écouter'}</span>
                  </button>
                )}
              </div>

              {lastInterventionUrl && (
                <audio
                  ref={interventionAudioRef}
                  src={lastInterventionUrl}
                  onEnded={() => setInterventionAudioPlaying(false)}
                  className="hidden"
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => onInjectIntervention('immediate')}
                  disabled={isInjectingIntervention}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/40 cursor-pointer transition-all"
                >
                  <Flame className={`w-3.5 h-3.5 ${isInjectingIntervention ? 'animate-spin' : ''}`} />
                  <span>Diffuser Direct (Skip AutoDJ)</span>
                </button>

                <button
                  onClick={() => onInjectIntervention('next')}
                  disabled={isInjectingIntervention}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 cursor-pointer transition-all"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Insérer en Prochain Titre</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: HARDWARE STEREO VU-METER & STUDIO DSP PROCESSING */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-4 font-mono text-xs">
          <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
            <span className="text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-zinc-300" />
              Traitement Audio & Modulation Stéréo (48 kHz)
            </span>
            <span className="text-[10px] text-zinc-500">VU-Mètre dBFS</span>
          </div>

          {/* STEREO LED VU-METER */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-bold">Modulation Microphone</span>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  vuReading.isClipping ? 'bg-red-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  CLIP
                </span>
                <span className="text-white font-bold">{vuReading.db > -60 ? `${vuReading.db} dBFS` : '-INF'}</span>
              </div>
            </div>

            {/* Dual stereo meter bars (Left & Right) */}
            <div className="space-y-1.5">
              {/* Left Channel */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-500 w-2.5">L</span>
                <div className="flex-1 h-3.5 bg-zinc-900 rounded-md overflow-hidden p-0.5 border border-zinc-800 flex">
                  <div 
                    className="h-full rounded transition-all duration-75 ease-out flex"
                    style={{ 
                      width: `${Math.min(100, Math.max(0, (vuReading.rms * 100)))}%`,
                      background: vuReading.isClipping 
                        ? 'linear-gradient(to right, #10b981 60%, #f59e0b 80%, #ef4444 100%)'
                        : 'linear-gradient(to right, #10b981 70%, #f59e0b 95%)'
                    }}
                  />
                </div>
              </div>

              {/* Right Channel */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-500 w-2.5">R</span>
                <div className="flex-1 h-3.5 bg-zinc-900 rounded-md overflow-hidden p-0.5 border border-zinc-800 flex">
                  <div 
                    className="h-full rounded transition-all duration-75 ease-out flex"
                    style={{ 
                      width: `${Math.min(100, Math.max(0, (vuReading.rms * 98)))}%`,
                      background: vuReading.isClipping 
                        ? 'linear-gradient(to right, #10b981 60%, #f59e0b 80%, #ef4444 100%)'
                        : 'linear-gradient(to right, #10b981 70%, #f59e0b 95%)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* dB scale markings */}
            <div className="flex justify-between text-[9px] text-zinc-600 px-4">
              <span>-60</span>
              <span>-36</span>
              <span>-24</span>
              <span>-12</span>
              <span>-6</span>
              <span>-3</span>
              <span className="text-red-500 font-bold">0 dB</span>
            </div>
          </div>

          {/* MICROPHONE GAIN FADER */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Master Gain Microphone :</span>
              <span className="text-white font-bold">{Math.round(micGain * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="2.5"
              step="0.05"
              value={micGain}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setMicGain(val);
                liveBroadcastEngine.setMicGain(val);
              }}
              className="w-full accent-white cursor-pointer"
            />
          </div>

          {/* STUDIO PROCESSING CHAIN (LOW-CUT & VOCAL COMPRESSOR) */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              onClick={() => {
                const next = !lowCutEnabled;
                setLowCutEnabled(next);
                liveBroadcastEngine.setLowCut(next);
                showToast(next ? 'Filtre Coupe-Bas 80Hz activé' : 'Filtre Coupe-Bas désactivé');
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                lowCutEnabled
                  ? 'bg-zinc-800 border-zinc-600 text-white'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <div>
                <span className="font-bold block">Coupe-Bas 80Hz</span>
                <span className="text-[9px] text-zinc-500">Anti-plosives & rumble</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${lowCutEnabled ? 'bg-white' : 'bg-zinc-700'}`} />
            </button>

            <button
              onClick={() => {
                const next = !compressorEnabled;
                setCompressorEnabled(next);
                liveBroadcastEngine.setCompressor(next);
                showToast(next ? 'Compresseur Broadcast activé' : 'Compresseur désactivé');
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                compressorEnabled
                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <div>
                <span className="font-bold block">Compresseur Vocal</span>
                <span className="text-[9px] text-zinc-500">Punch & présence radio</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${compressorEnabled ? 'bg-purple-400' : 'bg-zinc-700'}`} />
            </button>
          </div>

          {/* HEADPHONE SIDETONE MONITOR & AUDIO DEVICE SELECTOR */}
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <Headphones className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-300 font-bold">Retour Casque (Sidetone / CUE)</span>
              </div>
              <button
                onClick={() => {
                  const next = !monitorEnabled;
                  setMonitorEnabled(next);
                  liveBroadcastEngine.setMonitorEnabled(next);
                  showToast(next ? 'Retour casque activé' : 'Retour casque coupé');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  monitorEnabled 
                    ? 'bg-sky-500 text-black font-bold' 
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {monitorEnabled ? 'Actif' : 'Coupé'}
              </button>
            </div>

            <select
              value={selectedDeviceId}
              onChange={async (e) => {
                const devId = e.target.value;
                setSelectedDeviceId(devId);
                await liveBroadcastEngine.initMicrophone(devId);
                showToast('Périphérique microphone mis à jour');
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-[11px] text-zinc-200 cursor-pointer"
            >
              {audioDevices.length > 0 ? (
                audioDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label}
                  </option>
                ))
              ) : (
                <option value="">Microphone par défaut</option>
              )}
            </select>
          </div>
        </div>

      </div>

      {/* 4. BOTTOM SECTION: CARTOUCHEUR & INJECTION DIRECTE DES ANNONCES & JINGLES (SANS MICRO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-mono text-xs">
        
        {/* MUSIC BED WITH AUTO-DUCKING */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2">
              <Music2 className="w-3.5 h-3.5 text-zinc-300" />
              Tapis Sonore d'Ambiance (Auto-Ducking)
            </span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
              isOnAir && musicBedActive 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse' 
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              {isOnAir && musicBedActive ? 'DUCKING -75% ACTIF' : 'DUCKING AUTO'}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Boucle d'ambiance harmonieuse pour rythmer vos interventions. Dès que vous passez <strong>ON AIR</strong>, le volume s'atténue automatiquement !
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMusicBedActive(!musicBedActive)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                musicBedActive 
                  ? 'bg-white text-black shadow-md font-black' 
                  : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300'
              }`}
            >
              {musicBedActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{musicBedActive ? 'Arrêter Tapis' : 'Lancer Tapis Radio'}</span>
            </button>

            <div className="flex-1 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicBedVolume}
                onChange={(e) => setMusicBedVolume(parseFloat(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* CARTOUCHEUR EXPRESS & INJECTION DIRECTE SANS MICRO (POINT 3) */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 flex-wrap gap-2">
            <span className="text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Cartoucheur & Jingles Immédiats (Diffusion Directe)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImmediateSkip}
                disabled={isSkippingTrack}
                className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                title="Déclenche le skip immédiat sur le flux en cours"
              >
                <SkipForward className="w-3 h-3 text-red-400" />
                <span>Skip Immédiat</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { name: 'Top Horaire', type: 'chime' as const, color: 'border-zinc-700 hover:border-zinc-500 text-zinc-200' },
              { name: 'Gong Flash', type: 'gong' as const, color: 'border-amber-500/40 hover:border-amber-400 text-amber-300' },
              { name: 'Stinger Pop', type: 'stinger' as const, color: 'border-purple-500/40 hover:border-purple-400 text-purple-300' },
              { name: 'Applaudissements', type: 'applause' as const, color: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-300' },
              { name: 'Klaxon Airhorn', type: 'horn' as const, color: 'border-rose-500/40 hover:border-rose-400 text-rose-300' },
              { name: 'Laser FX', type: 'laser' as const, color: 'border-white/20 hover:border-white/40 text-white' },
            ].map((pad, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-xl bg-zinc-950 border flex flex-col justify-between gap-1.5 transition-all ${pad.color}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Disc className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[11px] font-bold truncate">{pad.name}</span>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-mono">P{idx + 1}</span>
                </div>

                <div className="grid grid-cols-2 gap-1 pt-1">
                  {/* Listen in CUE (headphones only) */}
                  <button
                    onClick={() => handleCartridgeCueTrigger(pad.name, pad.type)}
                    className="py-1 px-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Écouter localement dans le casque (hors antenne)"
                  >
                    <Headphones className="w-2.5 h-2.5 text-sky-400" />
                    <span>CUE</span>
                  </button>

                  {/* Inject directly on Air via Web Audio stream to WebSocket (Antenne) */}
                  <button
                    onClick={() => handleCartridgeAntennaTrigger(pad.name, pad.type)}
                    className="py-1 px-1.5 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Diffuser directement à l'antenne (mixé dans le flux audio Web Audio -> WebSocket, sans skip)"
                  >
                    <Flame className="w-2.5 h-2.5 text-red-400" />
                    <span>Antenne</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
            <span>ℹ️ Les jingles sont mixés en temps réel dans le flux audio de l'antenne (Web Audio -&gt; WebSocket) sans sauter de morceau ni couper le direct.</span>
          </div>
        </div>

      </div>

    </div>
  );
};
