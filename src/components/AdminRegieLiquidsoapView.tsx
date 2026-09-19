import { useState, useEffect } from 'react';
import { 
  Radio, 
  Play, 
  Pause, 
  SkipForward, 
  RotateCw, 
  Sliders, 
  Server, 
  Terminal, 
  Music, 
  ListMusic, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Download, 
  Upload, 
  Activity, 
  Disc, 
  Clock, 
  Layers, 
  Copy, 
  HelpCircle, 
  Flame, 
  ShieldCheck, 
  Search, 
  FileText
} from 'lucide-react';
import { 
  LiquidsoapStationConfig, 
  LiquidsoapPlaylist, 
  LiquidsoapMediaTrack, 
  LiquidsoapServerConfig, 
  LiquidsoapMasterStatus,
  getRegieServerConfig,
  saveRegieServerConfig,
  getRegieStations,
  saveRegieStations,
  getRegiePlaylists,
  saveRegiePlaylists,
  getRegieTracks,
  saveRegieTracks,
  generateLiquidsoapScript,
  getLiquidsoapVpsSetupGuide,
  getLiquidsoapMultiVpsSetupGuide,
  getIcecastPublicStreamUrl,
  syncLiquidsoapToUserAppPlayer
} from '../utils/liquidsoapBroadcasterService';

interface AdminRegieLiquidsoapViewProps {
  showToast: (msg: string) => void;
  stations?: any[];
  currentUser?: any;
  onOpenControlDeck?: (st: any) => void;
}

type RegieSubTab = 'remote' | 'stations' | 'playlists' | 'library' | 'icecast' | 'guide';

export function AdminRegieLiquidsoapView({ showToast }: AdminRegieLiquidsoapViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<RegieSubTab>('remote');
  
  // Data state
  const [serverConfig, setServerConfig] = useState<LiquidsoapServerConfig>(getRegieServerConfig);
  const [stations, setStations] = useState<LiquidsoapStationConfig[]>(getRegieStations);
  const [playlists, setPlaylists] = useState<LiquidsoapPlaylist[]>(getRegiePlaylists);
  const [tracks, setTracks] = useState<LiquidsoapMediaTrack[]>(getRegieTracks);

  // Master live remote status
  const [masterStatus, setMasterStatus] = useState<LiquidsoapMasterStatus>({
    onAirState: 'autodj',
    currentTrack: {
      artist: 'Daft Punk',
      title: 'One More Time (12" Extended Club Mix)',
      album: 'Discovery',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
      duration: 320,
      elapsed: 145,
      remaining: 175,
      startedAt: new Date(Date.now() - 145000).toISOString(),
    },
    nextTrack: {
      artist: 'The Weeknd ft. Daft Punk',
      title: 'Starboy (Kygo Remix VIP)',
      album: 'Starboy Remixed',
    },
    uptimeSeconds: 84320,
    encoderCpuPercent: 4.2,
    streamLatencyMs: 18,
    telnetConnected: true,
    harborConnected: false,
    activeHarborUser: null,
    crossfadeMode: 'smart',
    masterGain: 1.0,
    masterLimiterActive: true,
    totalListenersAllStreams: 323,
  });

  // Telnet Terminal Console state
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ id: string; time: string; type: 'cmd' | 'ok' | 'info' | 'err'; text: string }>>([
    { id: '1', time: '10:00:01', type: 'info', text: 'Connexion établie au démon Liquidsoap (127.0.0.1:8572)...' },
    { id: '2', time: '10:00:02', type: 'ok', text: 'Liquidsoap 2.2.5 [release] prêt. Harbor input en écoute sur 0.0.0.0:8005' },
    { id: '3', time: '10:00:03', type: 'info', text: 'Icecast2 maître connecté : 4 points de montage actifs (/synapse_hd.mp3, /synapse_club.mp3, /synapse_chill.aac, /synapse_lossless.flac)' },
    { id: '4', time: '10:00:04', type: 'ok', text: 'AutoDJ: Rotation Heavy chargée (148 titres) | Jingles chargés (32 drops)' },
  ]);

  // Search & Filter in Media Library
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaylistFilter, setSelectedPlaylistFilter] = useState<string>('all');
  
  // Track Editor modal
  const [editingTrack, setEditingTrack] = useState<LiquidsoapMediaTrack | null>(null);
  
  // Station Editor modal
  const [editingStation, setEditingStation] = useState<LiquidsoapStationConfig | null>(null);

  // Playlist Editor modal
  const [editingPlaylist, setEditingPlaylist] = useState<LiquidsoapPlaylist | null>(null);

  // Active guide in documentation tab: 'mono' (provisoire) or 'multi' (final)
  const [selectedGuideType, setSelectedGuideType] = useState<'mono' | 'multi'>('mono');

  // Live timer for track elapsed
  useEffect(() => {
    const timer = setInterval(() => {
      setMasterStatus((prev) => {
        const nextElapsed = prev.currentTrack.elapsed + 1;
        if (nextElapsed >= prev.currentTrack.duration) {
          // Track ended -> rotate
          return {
            ...prev,
            currentTrack: {
              artist: prev.nextTrack.artist,
              title: prev.nextTrack.title,
              album: prev.nextTrack.album,
              coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
              duration: 244,
              elapsed: 0,
              remaining: 244,
              startedAt: new Date().toISOString(),
            },
            nextTrack: {
              artist: 'M83',
              title: 'Midnight City (Synapse Rework)',
              album: 'Hurry Up, We\'re Dreaming',
            },
          };
        }
        return {
          ...prev,
          currentTrack: {
            ...prev.currentTrack,
            elapsed: nextElapsed,
            remaining: prev.currentTrack.duration - nextElapsed,
          },
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Skip track command
  const handleSkipTrack = () => {
    const oldTitle = masterStatus.currentTrack.title;
    setMasterStatus((prev) => ({
      ...prev,
      currentTrack: {
        artist: prev.nextTrack.artist,
        title: prev.nextTrack.title,
        album: prev.nextTrack.album,
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
        duration: 243,
        elapsed: 0,
        remaining: 243,
        startedAt: new Date().toISOString(),
      },
      nextTrack: {
        artist: 'HOME',
        title: 'Resonance',
        album: 'Odyssey',
      },
    }));

    addLog('cmd', 'radio.skip');
    addLog('ok', `Titre passé avec succès : "${oldTitle}" -> "${masterStatus.nextTrack.title}"`);
    showToast(`⏭️ Titre passé : ${masterStatus.nextTrack.title}`);
  };

  // Reload playlists command
  const handleReloadPlaylists = () => {
    addLog('cmd', 'playlists.reload_all');
    addLog('ok', `Rechargement de ${playlists.length} playlists terminé (384 titres scannés sur le VPS).`);
    showToast('🔄 Playlists rechargées sur Liquidsoap');
  };

  // Drop Instant Jingle
  const handleDropJingle = () => {
    addLog('cmd', 'jingles.push /var/media/synapse/music/jingles/synapse_top_horaire.mp3');
    addLog('ok', 'Jingle "Top Horaire Synth 2026" injecté en direct avec auto-ducking (-6dB)');
    showToast('🔔 Jingle injecté sur l\'antenne !');
  };

  // Toggle Live DJ Harbor switch simulation
  const handleToggleHarbor = () => {
    const newState = !masterStatus.harborConnected;
    setMasterStatus((prev) => ({
      ...prev,
      harborConnected: newState,
      activeHarborUser: newState ? 'dj_synapse_live' : null,
      onAirState: newState ? 'live_dj' : 'autodj',
    }));

    if (newState) {
      addLog('info', 'CONNEXION HARBOR EN DIRECT DÉTECTÉE sur port 8005 (Utilisateur: dj_synapse_live)');
      addLog('ok', 'Bascule automatique : Priorité 1 activée -> ANTENNE EN DIRECT DJ !');
      showToast('🎙️ Prise d\'antenne DJ en direct activée !');
    } else {
      addLog('info', 'DÉCONNEXION HARBOR : Le DJ a libéré la ligne.');
      addLog('ok', 'Retour doux à l\'AutoDJ avec smart crossfade.');
      showToast('📻 Retour automatique à l\'AutoDJ');
    }
  };

  // Send interactive telnet command
  const handleSendTerminalCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = terminalCommand.trim();
    if (!cmd) return;

    addLog('cmd', cmd);
    setTerminalCommand('');

    // Simulate Liquidsoap standard responses
    setTimeout(() => {
      const lower = cmd.toLowerCase();
      if (lower.includes('help') || lower === '?') {
        addLog('info', 'Commandes disponibles : radio.skip, playlists.reload, harbor.status, output.icecast.status, request.metadata, server.uptime');
      } else if (lower.includes('skip')) {
        handleSkipTrack();
      } else if (lower.includes('reload')) {
        handleReloadPlaylists();
      } else if (lower.includes('uptime')) {
        addLog('ok', `Uptime Liquidsoap: ${Math.floor(masterStatus.uptimeSeconds / 3600)}h ${Math.floor((masterStatus.uptimeSeconds % 3600) / 60)}m`);
      } else if (lower.includes('harbor')) {
        addLog('ok', `Harbor state: ${masterStatus.harborConnected ? 'CONNECTED (DJ LIVE)' : 'DISCONNECTED (WAITING ON PORT 8005)'}`);
      } else if (lower.includes('icecast') || lower.includes('output')) {
        addLog('ok', `Icecast Outputs: 4 streams active, ${masterStatus.totalListenersAllStreams} total listeners.`);
      } else {
        addLog('ok', `OK [liquidsoap telnet daemon ack]: "${cmd}"`);
      }
    }, 150);
  };

  const addLog = (type: 'cmd' | 'ok' | 'info' | 'err', text: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setTerminalLogs((prev) => [...prev.slice(-40), { id: Math.random().toString(), time, type, text }]);
  };

  // Toggle station encoding
  const handleToggleStationEncoding = (stationId: string) => {
    const updated = stations.map((st) => {
      if (st.id === stationId) {
        const nextState = !st.isEncodingActive;
        showToast(nextState ? `▶️ Encodeur activé pour ${st.name}` : `⏸️ Encodeur suspendu pour ${st.name}`);
        return { ...st, isEncodingActive: nextState };
      }
      return st;
    });
    setStations(updated);
    saveRegieStations(updated);
  };

  // Copy liquidsoap script to clipboard
  const handleCopyScript = () => {
    const script = generateLiquidsoapScript(serverConfig, stations, playlists);
    navigator.clipboard.writeText(script);
    showToast('📋 Script Liquidsoap copié dans le presse-papier !');
  };

  // Download script as radio.liq
  const handleDownloadScript = () => {
    const script = generateLiquidsoapScript(serverConfig, stations, playlists);
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'radio.liq';
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Fichier radio.liq téléchargé');
  };

  // Handle file drop/upload simulation in Media Library
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: LiquidsoapMediaTrack[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const nameClean = file.name.replace(/\.[^/.]+$/, '');
      const parts = nameClean.split(' - ');
      const artist = parts.length > 1 ? parts[0] : 'Artiste Inconnu';
      const title = parts.length > 1 ? parts[1] : nameClean;

      newTracks.push({
        id: `track-${Date.now()}-${i}`,
        title: title,
        artist: artist,
        album: 'Téléversement Récent',
        duration: 210,
        filePath: `${serverConfig.musicStoragePath}/${file.name}`,
        fileSizeMb: parseFloat((file.size / (1024 * 1024)).toFixed(1)),
        bitrate: 320,
        genre: 'Électro / Pop',
        playlistIds: ['pl-heavy'],
        cueIn: 0.0,
        cueOut: 210.0,
        replayGainDb: 0.0,
        addedAt: new Date().toISOString(),
      });
    }

    const updated = [...newTracks, ...tracks];
    setTracks(updated);
    saveRegieTracks(updated);
    showToast(`✅ ${newTracks.length} morceau(x) ajouté(s) à la médiathèque VPS !`);
  };

  // Filtered tracks
  const filteredTracks = tracks.filter((t) => {
    const matchesSearch = 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.album.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.genre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlaylist = 
      selectedPlaylistFilter === 'all' || t.playlistIds.includes(selectedPlaylistFilter);

    return matchesSearch && matchesPlaylist;
  });

  return (
    <div className="flex flex-col w-full min-w-0">
      
      {/* 1. STICKY TOP BAR - FIRST ELEMENT, FLUSH TO MAIN TOP BAR, 100% OPAQUE */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
            <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
              Régie de Diffusion & Liquidsoap
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              AUTONOME VPS
            </span>
          </div>
        </div>

        {/* SUB-TABS NAVIGATION IN TOP BAR */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            id="regie-tab-remote"
            onClick={() => setActiveSubTab('remote')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'remote'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console & Télécommande</span>
          </button>

          <button
            id="regie-tab-stations"
            onClick={() => setActiveSubTab('stations')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'stations'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Radios & Encodeurs ({stations.length})</span>
          </button>

          <button
            id="regie-tab-playlists"
            onClick={() => setActiveSubTab('playlists')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'playlists'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Playlists ({playlists.length})</span>
          </button>

          <button
            id="regie-tab-library"
            onClick={() => setActiveSubTab('library')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'library'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Médiathèque ({tracks.length})</span>
          </button>

          <button
            id="regie-tab-icecast"
            onClick={() => setActiveSubTab('icecast')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'icecast'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Icecast & Script .liq</span>
          </button>

          <button
            id="regie-tab-guide"
            onClick={() => setActiveSubTab('guide')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'guide'
                ? 'bg-white text-black shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guide VPS</span>
          </button>
        </div>
      </div>

      {/* CONTENT CONTAINER (PASSES BEHIND STICKY TOP BAR) */}
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 text-left">
        
      {/* 3. SUB-TAB CONTENTS */}

      {/* SUB-TAB 1: CONSOLE & TELECOMMANDE DIRECT */}
      {activeSubTab === 'remote' && (
        <div className="flex flex-col gap-6">
          {/* MASTER BANNER & REAL-TIME ON-AIR TELECOMMAND */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col gap-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 right-0 h-[2px] chromatic-line opacity-90 pointer-events-none" />

            {/* Master Live State Chip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
                <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
                  État de Diffusion Antenne Liquidsoap
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                {masterStatus.onAirState === 'live_dj' ? (
                  <div className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 font-mono font-bold text-xs flex items-center gap-2 animate-pulse shadow-lg shadow-rose-500/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>DIRECT DJ HARBOR ACTIF</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>AUTODJ EN DIRECT (320 kbps)</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{masterStatus.totalListenersAllStreams} auditeurs</span>
                </div>
              </div>
            </div>

            {/* ON-AIR COCKPIT & LIVE TELECOMMANDE (ACTION BUTTONS) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* NOW PLAYING TRACK DISPLAY */}
              <div className="lg:col-span-7 flex items-center gap-4 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <img 
                  src={masterStatus.currentTrack.coverUrl} 
                  alt={masterStatus.currentTrack.title}
                  className="w-16 h-16 rounded-lg object-cover border border-zinc-700/60 shrink-0 shadow-md"
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3" /> À L'ANTENNE
                    </span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-[10px] font-mono text-zinc-400 truncate">{masterStatus.currentTrack.album}</span>
                  </div>
                  <h3 className="text-base font-bold text-white truncate">{masterStatus.currentTrack.title}</h3>
                  <p className="text-xs text-zinc-300 truncate font-mono">{masterStatus.currentTrack.artist}</p>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-mono text-zinc-400">{formatTime(masterStatus.currentTrack.elapsed)}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 to-white rounded-full transition-all duration-1000"
                        style={{ width: `${(masterStatus.currentTrack.elapsed / masterStatus.currentTrack.duration) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">-{formatTime(masterStatus.currentTrack.remaining)}</span>
                  </div>
                </div>
              </div>

              {/* TELECOMMANDE DIRECT BUTTONS */}
              <div className="lg:col-span-5 flex flex-col gap-2">
                <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                  <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-white" /> Télécommande Antenne
                  </span>
                  <span className="text-[10px] text-zinc-500">Prochain : {masterStatus.nextTrack.title.slice(0, 20)}...</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Skip */}
                  <button
                    id="regie-btn-skip"
                    onClick={handleSkipTrack}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold flex flex-col items-center justify-center gap-1 border border-zinc-700 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Passer au titre suivant immédiatement"
                  >
                    <SkipForward className="w-4 h-4 text-amber-400" />
                    <span>Passer</span>
                  </button>

                  {/* Drop Jingle */}
                  <button
                    id="regie-btn-jingle"
                    onClick={handleDropJingle}
                    className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-xs font-bold flex flex-col items-center justify-center gap-1 border border-amber-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Injecter le jingle horaire instantanément"
                  >
                    <Disc className="w-4 h-4 text-amber-400" />
                    <span>Jingle</span>
                  </button>

                  {/* Reload */}
                  <button
                    id="regie-btn-reload"
                    onClick={handleReloadPlaylists}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold flex flex-col items-center justify-center gap-1 border border-zinc-700 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Recharger toutes les playlists"
                  >
                    <RotateCw className="w-4 h-4 text-cyan-400" />
                    <span>Recharger</span>
                  </button>

                  {/* DJ Harbor Live Toggle */}
                  <button
                    id="regie-btn-harbor"
                    onClick={handleToggleHarbor}
                    className={`px-3 py-2 rounded-xl font-mono text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer shadow-sm active:scale-95 ${
                      masterStatus.harborConnected
                        ? 'bg-rose-500 text-white border-rose-400'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    }`}
                    title="Simuler ou forcer la prise d'antenne DJ Harbor"
                  >
                    <Radio className={`w-4 h-4 ${masterStatus.harborConnected ? 'text-white' : 'text-rose-400'}`} />
                    <span>{masterStatus.harborConnected ? 'Couper DJ' : 'Harbor DJ'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Master Source Priority Stack & VU-Meters */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Source Priority Card */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Hiérarchie des Sources d'Antenne
                </span>
                <span className="text-[10px] font-mono text-zinc-400">Fallback automatique</span>
              </div>

              <div className="flex flex-col gap-2">
                {/* Prio 1: Harbor Live DJ */}
                <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  masterStatus.onAirState === 'live_dj'
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-400'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center font-mono font-black text-xs">1</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">Harbor DJ Direct (Port {serverConfig.harborLivePort})</span>
                      <span className="text-[10px] font-mono text-zinc-400">Prise d'antenne prioritaire animateur</span>
                    </div>
                  </div>
                  {masterStatus.onAirState === 'live_dj' ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-500 text-white">ACTIF</span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-500">En attente</span>
                  )}
                </div>

                {/* Prio 2: AutoDJ Playlists */}
                <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  masterStatus.onAirState === 'autodj'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-800/80 text-zinc-400'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center font-mono font-black text-xs">2</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">AutoDJ & Rotation des Playlists</span>
                      <span className="text-[10px] font-mono text-zinc-400">Diffusion continue avec smart crossfade</span>
                    </div>
                  </div>
                  {masterStatus.onAirState === 'autodj' ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500 text-black">ACTIF</span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-500">Standby</span>
                  )}
                </div>

                {/* Prio 3: Emergency Fallback Loop */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-zinc-400 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center font-mono font-black text-xs">3</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-300">Boucle de Secours d'Urgence</span>
                      <span className="text-[10px] font-mono text-zinc-500">Prise de relais si coupure de playlist</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">Sécurité</span>
                </div>
              </div>
            </div>

            {/* Audio Master DSP & VU-Meters */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Traitement Audio & Niveaux Master
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">Limiteur Actif</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {/* L / R Stereo Bars */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>CANAL GAUCHE (L)</span>
                    <span className="text-emerald-400">-1.8 dBFS</span>
                  </div>
                  <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 flex">
                    <div className="h-full bg-emerald-500 w-[78%]" />
                    <div className="h-full bg-amber-400 w-[12%]" />
                    <div className="h-full bg-rose-500 w-[4%]" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>CANAL DROIT (R)</span>
                    <span className="text-emerald-400">-1.6 dBFS</span>
                  </div>
                  <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 flex">
                    <div className="h-full bg-emerald-500 w-[80%]" />
                    <div className="h-full bg-amber-400 w-[11%]" />
                    <div className="h-full bg-rose-500 w-[3%]" />
                  </div>
                </div>

                {/* Crossfade Selector */}
                <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400">Mode de Transition :</span>
                  <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    {(['smart', 'normal', 'cut'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setMasterStatus((prev) => ({ ...prev, crossfadeMode: mode }));
                          showToast(`Mode transition : ${mode.toUpperCase()}`);
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                          masterStatus.crossfadeMode === mode
                            ? 'bg-white text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Live Liquidsoap Telnet Terminal Console */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col h-full shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase">Console Interactive Telnet Liquidsoap</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-zinc-300">127.0.0.1:{serverConfig.telnetPort}</span>
                </div>
              </div>

              {/* Terminal Logs Window */}
              <div className="my-3 flex-1 min-h-[300px] max-h-[420px] overflow-y-auto custom-scrollbar font-mono text-xs flex flex-col gap-1.5 p-2 bg-black/60 rounded-xl border border-zinc-900 select-text">
                {terminalLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-zinc-600 shrink-0 select-none">[{log.time}]</span>
                    {log.type === 'cmd' && (
                      <span className="text-cyan-400 font-bold">$ {log.text}</span>
                    )}
                    {log.type === 'ok' && (
                      <span className="text-emerald-400">{log.text}</span>
                    )}
                    {log.type === 'info' && (
                      <span className="text-zinc-300">{log.text}</span>
                    )}
                    {log.type === 'err' && (
                      <span className="text-rose-400 font-bold">{log.text}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Terminal Command Input */}
              <form onSubmit={handleSendTerminalCommand} className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                <span className="text-emerald-400 font-mono font-bold text-xs select-none">&gt;</span>
                <input
                  type="text"
                  value={terminalCommand}
                  onChange={(e) => setTerminalCommand(e.target.value)}
                  placeholder="Ex: radio.skip, playlists.reload, harbor.status, help..."
                  className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white/40"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs cursor-pointer transition-all"
                >
                  Envoyer
                </button>
              </form>

              {/* Quick macros buttons */}
              <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-zinc-800/60 flex-wrap text-[10px] font-mono">
                <span className="text-zinc-500">Macros rapides :</span>
                {['radio.skip', 'playlists.reload', 'harbor.status', 'server.uptime', 'output.icecast.status'].map((macro) => (
                  <button
                    key={macro}
                    type="button"
                    onClick={() => {
                      setTerminalCommand(macro);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer transition-colors"
                  >
                    {macro}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
      )}

      {/* SUB-TAB 2: STATIONS & ENCODEURS */}
      {activeSubTab === 'stations' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Gestion des Stations & Encodeurs Liquidsoap</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Icecast2 Direct
                </span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Chaque station correspond à un encodage dédié (MP3, AAC, FLAC) dispatché vers son point de montage Icecast2 et synchronisable sur l'application utilisateur
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <button
                onClick={() => {
                  syncLiquidsoapToUserAppPlayer(stations, serverConfig);
                  showToast('✅ Stations Liquidsoap synchronisées avec le lecteur utilisateur !');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                title="Synchroniser immédiatement tous les flux encodés avec le lecteur audio de l'application"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Synchroniser l'application</span>
              </button>
              <button
                onClick={() => {
                  const newSt: LiquidsoapStationConfig = {
                    id: `station-${Date.now()}`,
                    name: 'Nouvelle Station',
                    shortCode: 'SYNAPSE-NEW',
                    genre: 'Généraliste',
                    tagline: 'Nouveau flux en direct',
                    mountpoint: `/station_${Date.now()}.mp3`,
                    format: 'mp3',
                    bitrate: 320,
                    samplerate: 44100,
                    channels: 2,
                    isEncodingActive: true,
                    currentListeners: 0,
                    peakListeners: 0,
                    fallbackMount: '/fallback.mp3',
                  };
                  const updated = [...stations, newSt];
                  setStations(updated);
                  saveRegieStations(updated);
                  syncLiquidsoapToUserAppPlayer(updated, serverConfig);
                  showToast('📻 Nouvelle station ajoutée !');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une station</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stations.map((station) => {
              const streamPublicUrl = getIcecastPublicStreamUrl(serverConfig, station.mountpoint);

              return (
                <div 
                  key={station.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                    station.isEncodingActive
                      ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                      : 'bg-zinc-950/60 border-zinc-900 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-black text-xs text-white shrink-0">
                        {station.format.toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{station.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                            station.isEncodingActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {station.isEncodingActive ? 'ENCODAGE ACTIF' : 'ARRÊTÉ'}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 truncate">{station.genre}</span>
                        <a 
                          href={streamPublicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-cyan-400 hover:underline mt-0.5 truncate flex items-center gap-1"
                          title="Lien direct du flux Icecast2"
                        >
                          <span>{streamPublicUrl}</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStationEncoding(station.id)}
                        className={`p-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                          station.isEncodingActive
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border-zinc-700'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
                        }`}
                        title={station.isEncodingActive ? 'Suspendre l\'encodage & désactiver du lecteur' : 'Activer l\'encodage & rendre visible sur le lecteur'}
                      >
                        {station.isEncodingActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingStation(station)}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 cursor-pointer"
                        title="Configurer les paramètres d'encodage"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Technical specs banner */}
                  <div className="grid grid-cols-4 gap-2 text-center font-mono text-[10px] bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                    <div className="flex flex-col">
                      <span className="text-zinc-500">FORMAT</span>
                      <span className="font-bold text-white">{station.format.toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500">DÉBIT</span>
                      <span className="font-bold text-amber-400">{station.bitrate} kbps</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500">FRÉQUENCE</span>
                      <span className="font-bold text-zinc-300">{(station.samplerate / 1000).toFixed(1)} kHz</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500">MONTAGE</span>
                      <span className="font-bold text-cyan-400 truncate">{station.mountpoint}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PLAYLISTS & AUTODJ */}
      {activeSubTab === 'playlists' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white">Gestion des Playlists & Rotations AutoDJ</h3>
              <p className="text-xs text-zinc-400 font-mono">
                Organisez vos fichiers stockés sur le VPS par type de rotation, poids de diffusion et règles horaires
              </p>
            </div>
            <button
              onClick={() => {
                const newPl: LiquidsoapPlaylist = {
                  id: `pl-${Date.now()}`,
                  name: 'Nouvelle Playlist AutoDJ',
                  type: 'general',
                  weight: 5,
                  crossfadeDuration: 4,
                  trackCount: 0,
                  totalDurationSeconds: 0,
                  isActive: true,
                  color: '#00f2ff',
                };
                const updated = [...playlists, newPl];
                setPlaylists(updated);
                saveRegiePlaylists(updated);
                showToast('📑 Nouvelle playlist créée !');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer une playlist</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <div 
                key={pl.id}
                className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: pl.color }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white leading-snug">{pl.name}</span>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">{pl.type}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                    pl.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {pl.isActive ? 'ACTIF' : 'PAUSE'}
                  </span>
                </div>

                {pl.scheduleRule && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10.5px] font-mono text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{pl.scheduleRule}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px] bg-zinc-950 p-2 rounded-xl border border-zinc-800/60">
                  <div>
                    <span className="text-zinc-500">TITRES</span>
                    <p className="font-bold text-white">{pl.trackCount}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">POIDS</span>
                    <p className="font-bold text-cyan-400">{pl.weight} / 10</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">FONDU</span>
                    <p className="font-bold text-zinc-300">{pl.crossfadeDuration}s</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 text-[10px]">ID: {pl.id}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedPlaylistFilter(pl.id);
                        setActiveSubTab('library');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] underline cursor-pointer"
                    >
                      Voir les titres
                    </button>
                    <button
                      onClick={() => setEditingPlaylist(pl)}
                      className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                      title="Modifier les règles"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MEDIATHEQUE & FICHIERS STOCKES */}
      {activeSubTab === 'library' && (
        <div className="flex flex-col gap-4">
          {/* Header with Search and File Upload Dropzone */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Médiathèque & Fichiers Audio du VPS</h3>
                <p className="text-xs text-zinc-400 font-mono">
                  Stockage cible : <code className="text-amber-300">{serverConfig.musicStoragePath}</code>
                </p>
              </div>

              {/* Upload button with hidden file input */}
              <label className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-md">
                <Upload className="w-3.5 h-3.5" />
                <span>Téléverser des morceaux</span>
                <input 
                  type="file" 
                  multiple 
                  accept="audio/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-zinc-800">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par titre, artiste, album ou genre..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white/40"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-mono text-zinc-400 shrink-0">Filtrer par playlist :</span>
                <select
                  value={selectedPlaylistFilter}
                  onChange={(e) => setSelectedPlaylistFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                >
                  <option value="all">Toutes les playlists ({tracks.length})</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tracks Table */}
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-zinc-950 text-zinc-400 text-[10px] uppercase border-b border-zinc-800">
                  <tr>
                    <th className="p-3">Titre & Artiste</th>
                    <th className="p-3">Album / Genre</th>
                    <th className="p-3">Durée</th>
                    <th className="p-3">BPM / Poids</th>
                    <th className="p-3">Playlists</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredTracks.map((track) => (
                    <tr key={track.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Music className="w-4 h-4 text-cyan-400 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white truncate">{track.title}</span>
                            <span className="text-[10.5px] text-zinc-400 truncate">{track.artist}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-zinc-300">
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{track.album}</span>
                          <span className="text-[10px] text-zinc-500">{track.genre}</span>
                        </div>
                      </td>
                      <td className="p-3 text-zinc-300 font-bold">{formatTime(track.duration)}</td>
                      <td className="p-3 text-zinc-400">
                        <div className="flex flex-col">
                          <span>{track.bpm ? `${track.bpm} BPM` : 'N/A'}</span>
                          <span className="text-[10px] text-zinc-500">{track.fileSizeMb} Mo ({track.bitrate}k)</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {track.playlistIds.map((plId) => {
                            const pl = playlists.find((p) => p.id === plId);
                            return (
                              <span 
                                key={plId}
                                className="px-2 py-0.5 rounded text-[9px] font-bold border"
                                style={{
                                  backgroundColor: `${pl?.color || '#3b82f6'}15`,
                                  borderColor: `${pl?.color || '#3b82f6'}40`,
                                  color: pl?.color || '#93c5fd',
                                }}
                              >
                                {pl?.name ? pl.name.split(' ')[0] : plId}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              // Direct push to now playing simulation
                              setMasterStatus((prev) => ({
                                ...prev,
                                currentTrack: {
                                  artist: track.artist,
                                  title: track.title,
                                  album: track.album,
                                  coverUrl: track.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
                                  duration: track.duration,
                                  elapsed: 0,
                                  remaining: track.duration,
                                  startedAt: new Date().toISOString(),
                                },
                              }));
                              showToast(`▶️ Lecture forcée à l'antenne : ${track.title}`);
                            }}
                            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 cursor-pointer"
                            title="Diffuser immédiatement à l'antenne"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingTrack(track)}
                            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                            title="Éditer les tags et Cue points"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const updated = tracks.filter((t) => t.id !== track.id);
                              setTracks(updated);
                              saveRegieTracks(updated);
                              showToast(`🗑️ Morceau supprimé de la médiathèque`);
                            }}
                            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-rose-400 cursor-pointer"
                            title="Supprimer du catalogue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: RELAIS ICECAST & GENERATION SCRIPT */}
      {activeSubTab === 'icecast' && (
        <div className="flex flex-col gap-6">
          
          {/* Icecast Server Configuration Form */}
          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Paramètres Serveur Liquidsoap & Relais Icecast2</h3>
              </div>
              <button
                onClick={() => {
                  saveRegieServerConfig(serverConfig);
                  showToast('💾 Paramètres serveur sauvegardés');
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Sauvegarder la configuration</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400">Hôte VPS (IP / Domaine)</label>
                <input
                  type="text"
                  value={serverConfig.vpsHost}
                  onChange={(e) => setServerConfig({ ...serverConfig, vpsHost: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400">Port Telnet Liquidsoap</label>
                <input
                  type="number"
                  value={serverConfig.telnetPort}
                  onChange={(e) => setServerConfig({ ...serverConfig, telnetPort: parseInt(e.target.value) || 8572 })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400">Port Harbor (DJ Live)</label>
                <input
                  type="number"
                  value={serverConfig.harborLivePort}
                  onChange={(e) => setServerConfig({ ...serverConfig, harborLivePort: parseInt(e.target.value) || 8005 })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400">Port Icecast 2</label>
                <input
                  type="number"
                  value={serverConfig.icecastPort}
                  onChange={(e) => setServerConfig({ ...serverConfig, icecastPort: parseInt(e.target.value) || 8000 })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400">Mot de passe Source Icecast</label>
                <input
                  type="password"
                  value={serverConfig.icecastSourcePassword}
                  onChange={(e) => setServerConfig({ ...serverConfig, icecastSourcePassword: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400">Dossier Musiques VPS</label>
                <input
                  type="text"
                  value={serverConfig.musicStoragePath}
                  onChange={(e) => setServerConfig({ ...serverConfig, musicStoragePath: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Generated Script Viewer */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white font-mono">Script Maître radio.liq (Liquidsoap 2.2+)</h3>
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  Script complet prêt à être exécuté par le service Liquidsoap sur votre VPS Linux
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-zinc-700"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copier le script</span>
                </button>
                <button
                  onClick={handleDownloadScript}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger radio.liq</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-black/80 border border-zinc-900 font-mono text-xs text-zinc-300 overflow-x-auto max-h-[400px] custom-scrollbar select-text leading-relaxed">
              {generateLiquidsoapScript(serverConfig, stations, playlists)}
            </pre>
          </div>

        </div>
      )}

      {/* SUB-TAB 6: VPS STEP-BY-STEP SETUP GUIDE (DUAL GUIDES MONO & MULTI-VPS) */}
      {activeSubTab === 'guide' && (
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col gap-5 text-zinc-200 select-text leading-relaxed shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-white">Guides de Déploiement VPS & Haute Disponibilité</h3>
                <p className="text-xs font-mono text-zinc-400">
                  Documentation d'infrastructure pour Liquidsoap 2.2+, Icecast2 et Supabase en architecture autonome
                </p>
              </div>
            </div>

            {/* Architecture Selector Buttons */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto font-mono text-xs">
              <button
                onClick={() => setSelectedGuideType('mono')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                  selectedGuideType === 'mono'
                    ? 'bg-amber-400 text-black font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Guide 1 : Mono-VPS (Provisoire)</span>
              </button>
              <button
                onClick={() => setSelectedGuideType('multi')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                  selectedGuideType === 'multi'
                    ? 'bg-cyan-400 text-black font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Guide 2 : Multi-VPS (Final Dédié)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-300">
              {selectedGuideType === 'mono'
                ? '📌 Architecture Provisoire : 1 VPS tout-en-un (App + Régie Liquidsoap + Supabase + Icecast)'
                : '🚀 Architecture Finale : VPS 1 (App/Régie/BDD) + VPS 2 (Relais Icecast dédié 15 000+ auditeurs)'}
            </span>

            <button
              onClick={() => {
                const text = selectedGuideType === 'mono'
                  ? getLiquidsoapVpsSetupGuide(serverConfig)
                  : getLiquidsoapMultiVpsSetupGuide(serverConfig);
                navigator.clipboard.writeText(text);
                showToast(`📋 Guide ${selectedGuideType === 'mono' ? 'Mono-VPS' : 'Multi-VPS'} copié !`);
              }}
              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copier le guide</span>
            </button>
          </div>

          <div className="prose prose-invert max-w-none text-xs font-mono whitespace-pre-line p-4 rounded-xl bg-black/60 border border-zinc-900 overflow-x-auto">
            {selectedGuideType === 'mono'
              ? getLiquidsoapVpsSetupGuide(serverConfig)
              : getLiquidsoapMultiVpsSetupGuide(serverConfig)}
          </div>
        </div>
      )}

      {/* MODAL: EDIT TRACK */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono">Édition Métadonnées & Cue Points</h3>
            
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div>
                <label className="text-zinc-400">Titre</label>
                <input
                  type="text"
                  value={editingTrack.title}
                  onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-zinc-400">Artiste</label>
                <input
                  type="text"
                  value={editingTrack.artist}
                  onChange={(e) => setEditingTrack({ ...editingTrack, artist: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400">Cue In (début sonore en sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingTrack.cueIn || 0}
                    onChange={(e) => setEditingTrack({ ...editingTrack, cueIn: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-400">Cue Out (point de fondu)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingTrack.cueOut || editingTrack.duration}
                    onChange={(e) => setEditingTrack({ ...editingTrack, cueOut: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setEditingTrack(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const updated = tracks.map((t) => (t.id === editingTrack.id ? editingTrack : t));
                  setTracks(updated);
                  saveRegieTracks(updated);
                  setEditingTrack(null);
                  showToast('✅ Morceau mis à jour');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STATION */}
      {editingStation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono">Configuration Encodeur Station</h3>
            
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div>
                <label className="text-zinc-400">Nom de la station</label>
                <input
                  type="text"
                  value={editingStation.name}
                  onChange={(e) => setEditingStation({ ...editingStation, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-zinc-400">Point de montage Icecast (Mountpoint)</label>
                <input
                  type="text"
                  value={editingStation.mountpoint}
                  onChange={(e) => setEditingStation({ ...editingStation, mountpoint: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400">Format d'encodage</label>
                  <select
                    value={editingStation.format}
                    onChange={(e) => setEditingStation({ ...editingStation, format: e.target.value as any })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                  >
                    <option value="mp3">MP3 (Lame)</option>
                    <option value="aac">AAC+ (FDK-AAC)</option>
                    <option value="flac">FLAC (Lossless)</option>
                    <option value="opus">Opus (Ogg)</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400">Débit (Bitrate kbps)</label>
                  <select
                    value={editingStation.bitrate}
                    onChange={(e) => setEditingStation({ ...editingStation, bitrate: parseInt(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                  >
                    <option value={64}>64 kbps (Eco)</option>
                    <option value={128}>128 kbps (Standard)</option>
                    <option value={192}>192 kbps (Haute)</option>
                    <option value={256}>256 kbps (Très Haute)</option>
                    <option value={320}>320 kbps (Master HD)</option>
                    <option value={1411}>1411 kbps (Lossless)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setEditingStation(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const updated = stations.map((s) => (s.id === editingStation.id ? editingStation : s));
                  setStations(updated);
                  saveRegieStations(updated);
                  setEditingStation(null);
                  showToast('✅ Station mise à jour');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PLAYLIST */}
      {editingPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono">Configuration de la Playlist</h3>
            
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div>
                <label className="text-zinc-400">Nom de la playlist</label>
                <input
                  type="text"
                  value={editingPlaylist.name}
                  onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400">Poids de diffusion (1 à 10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editingPlaylist.weight}
                    onChange={(e) => setEditingPlaylist({ ...editingPlaylist, weight: parseInt(e.target.value) || 1 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-400">Durée du crossfade (sec)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={editingPlaylist.crossfadeDuration}
                    onChange={(e) => setEditingPlaylist({ ...editingPlaylist, crossfadeDuration: parseInt(e.target.value) || 0 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400">Règle de planification horaire (Optionnel)</label>
                <input
                  type="text"
                  value={editingPlaylist.scheduleRule || ''}
                  onChange={(e) => setEditingPlaylist({ ...editingPlaylist, scheduleRule: e.target.value })}
                  placeholder="Ex: Tous les soirs 22:00 - 04:00"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setEditingPlaylist(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const updated = playlists.map((p) => (p.id === editingPlaylist.id ? editingPlaylist : p));
                  setPlaylists(updated);
                  saveRegiePlaylists(updated);
                  setEditingPlaylist(null);
                  showToast('✅ Playlist mise à jour');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

export default AdminRegieLiquidsoapView;
