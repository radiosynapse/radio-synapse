import { useState, useRef } from 'react';
import { 
  Database, CheckCircle2, Radio, 
  HardDrive, Copy, Check,
  Globe, Webhook, Zap,
  Play, Pause, ExternalLink, Activity
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SUPABASE_CONFIG } from '../lib/supabase';
import { 
  LiquidsoapServerConfig, 
  LiquidsoapStationConfig, 
  getRegieServerConfig, 
  saveRegieServerConfig, 
  getRegieStations, 
  saveRegieStations,
  syncLiquidsoapToUserAppPlayer
} from '../utils/liquidsoapBroadcasterService';

interface AdminServicesTabProps {
  stations: StreamChannel[];
  onOpenControlDeck: (station: StreamChannel) => void;
  showToast: (msg: string) => void;
  // Supabase handlers
  dbStatus: {
    ok: boolean | null;
    message: string;
    isTesting: boolean;
    isSyncing: boolean;
  };
  onTestDatabase: () => void;
  onPullRemoteData: () => void;
  onSyncDatabase: () => void;
  onCopySqlSchema: () => void;
  onCopyJsonSchema?: () => void;
  copiedSql: boolean;
  copiedJson?: boolean;
  // Dynamic stats
  activeStationsCount: number;
  usersCount: number;
  challengesCount: number;
  promotionsCount: number;
  eventsCount?: number;
  // External navigation control
  activeSection?: ServiceSection;
  onSectionChange?: (section: ServiceSection) => void;
}

export type ServiceSection = 'liquidsoap_icecast' | 'supabase' | 'external';

export default function AdminServicesTab({
  stations: _stations,
  onOpenControlDeck: _onOpenControlDeck,
  showToast,
  dbStatus,
  onTestDatabase,
  onPullRemoteData: _onPullRemoteData,
  onSyncDatabase: _onSyncDatabase,
  onCopySqlSchema,
  copiedSql,
  activeStationsCount,
  usersCount,
  challengesCount,
  promotionsCount,
  eventsCount: _eventsCount,
  activeSection: externalActiveSection,
  onSectionChange,
}: AdminServicesTabProps) {
  const [internalSection, setInternalSection] = useState<ServiceSection>('liquidsoap_icecast');
  
  const currentSection = externalActiveSection ?? internalSection;
  const setActiveSection = (sec: ServiceSection) => {
    setInternalSection(sec);
    onSectionChange?.(sec);
  };

  // Liquidsoap & Icecast Server Config state
  const [serverConfig, setServerConfig] = useState<LiquidsoapServerConfig>(getRegieServerConfig());
  const [regieStations, setRegieStations] = useState<LiquidsoapStationConfig[]>(getRegieStations());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Audio preview player state
  const [testingStreamUrl, setTestingStreamUrl] = useState<string | null>(null);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState<boolean>(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  // DJ Streamer state for Harbor Direct
  const [djUsername, setDjUsername] = useState('');
  const [djPassword, setDjPassword] = useState('');
  const [djDisplayName, setDjDisplayName] = useState('');
  const [djTargetStationId, setDjTargetStationId] = useState<string>(regieStations[0]?.id || 'synapse-main');
  const [isCreatingDj, setIsCreatingDj] = useState(false);

  // External services configuration state
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(() => {
    return localStorage.getItem('synapse_discord_webhook_url') || '';
  });
  const [lastFmApiKey, setLastFmApiKey] = useState(() => {
    return localStorage.getItem('synapse_lastfm_api_key') || '';
  });

  const handleSaveServerConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveRegieServerConfig(serverConfig);
    showToast('Configuration du serveur Liquidsoap / Icecast enregistrée.');
  };

  const handleToggleStationEncoding = (stationId: string) => {
    const updated = regieStations.map((st) => {
      if (st.id === stationId) {
        return { ...st, isEncodingActive: !st.isEncodingActive };
      }
      return st;
    });
    setRegieStations(updated);
    saveRegieStations(updated);
    syncLiquidsoapToUserAppPlayer(updated, serverConfig);
    showToast('Statut de diffusion mis à jour.');
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    showToast(`${label} copié !`);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleTestAudioStream = (streamUrl: string) => {
    if (testingStreamUrl === streamUrl && isPlayingTestAudio) {
      if (testAudioRef.current) {
        testAudioRef.current.pause();
      }
      setIsPlayingTestAudio(false);
      return;
    }

    if (testAudioRef.current) {
      testAudioRef.current.pause();
    }

    const audio = new Audio(streamUrl);
    testAudioRef.current = audio;
    setTestingStreamUrl(streamUrl);
    setIsPlayingTestAudio(true);

    audio.play().catch(() => {
      setIsPlayingTestAudio(false);
      showToast('Impossible de lire le flux audio (Vérifiez le serveur Icecast).');
    });

    audio.onended = () => setIsPlayingTestAudio(false);
    audio.onerror = () => {
      setIsPlayingTestAudio(false);
      showToast('Erreur de lecture du flux Icecast.');
    };
  };

  const handleCreateHarborDj = (e: React.FormEvent) => {
    e.preventDefault();
    if (!djUsername.trim() || !djPassword.trim()) {
      showToast('Veuillez renseigner un identifiant et un mot de passe DJ.');
      return;
    }

    const newDjAccount = {
      username: djUsername.trim(),
      password: djPassword.trim(),
      displayName: djDisplayName.trim() || djUsername.trim(),
      stationShortcode: djTargetStationId,
      linkedAt: Date.now(),
    };

    localStorage.setItem('synapse_admin_dj_account', JSON.stringify(newDjAccount));
    setIsCreatingDj(false);
    setDjUsername('');
    setDjPassword('');
    setDjDisplayName('');
    showToast(`Identifiants DJ Harbor créés pour ${newDjAccount.displayName} !`);
  };

  const handleSaveExternalServices = () => {
    localStorage.setItem('synapse_discord_webhook_url', discordWebhookUrl.trim());
    localStorage.setItem('synapse_lastfm_api_key', lastFmApiKey.trim());
    showToast('Intégrations tierces enregistrées avec succès.');
  };

  return (
    <div className="flex flex-col flex-1 pb-16">
      {/* STICKY TOP SUB-BAR */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Infrastructure & Services
            </h2>
            <p className="text-xs text-zinc-400 font-mono">
              Liquidsoap • Icecast • Supabase PostgreSQL • Realtime
            </p>
          </div>
        </div>

        {/* SEGMENTED SERVICE TABS NAV */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            onClick={() => setActiveSection('liquidsoap_icecast')}
            className={`py-1.5 px-3.5 rounded-lg font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              currentSection === 'liquidsoap_icecast'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-zinc-300" />
            <span>Liquidsoap & Icecast</span>
          </button>

          <button
            onClick={() => setActiveSection('supabase')}
            className={`py-1.5 px-3.5 rounded-lg font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              currentSection === 'supabase'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-zinc-300" />
            <span>Supabase & Realtime</span>
          </button>

          <button
            onClick={() => setActiveSection('external')}
            className={`py-1.5 px-3.5 rounded-lg font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              currentSection === 'external'
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-zinc-300" />
            <span>Services Tiers</span>
          </button>
        </div>
      </div>

      {/* CONTENT CONTAINER */}
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 text-left">
        
        {/* Global summary pills */}
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-zinc-400">Icecast :</span>
              <span className="text-zinc-200 font-bold">{serverConfig.icecastHost}:{serverConfig.icecastPort}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-zinc-400">Supabase :</span>
              <span className="text-emerald-400 font-bold">Connecté (Realtime Live)</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              <span className="text-zinc-400">Harbor Live :</span>
              <span className="text-zinc-200 font-bold">Port {serverConfig.harborLivePort}</span>
            </div>
          </div>

          <a
            href="/vps-infrastructure-guide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-750 flex items-center gap-1.5 text-xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            <span>Guide Infrastructure & Manuel</span>
          </a>
        </div>

        {/* SECTION 1: LIQUIDSOAP & ICECAST */}
        {currentSection === 'liquidsoap_icecast' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            
            {/* SERVER CONFIGURATION FORM */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-zinc-300" />
                  Configuration Serveur Liquidsoap & Icecast
                </span>
                <span className="text-xs font-mono text-zinc-400">Réseau Docker unifié</span>
              </div>

              <form onSubmit={handleSaveServerConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400">Hôte VPS / Liquidsoap</label>
                  <input
                    type="text"
                    value={serverConfig.vpsHost}
                    onChange={(e) => setServerConfig({ ...serverConfig, vpsHost: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    placeholder="127.0.0.1 ou db.radiosynapse.fr"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400">Port Telnet Liquidsoap</label>
                  <input
                    type="number"
                    value={serverConfig.telnetPort}
                    onChange={(e) => setServerConfig({ ...serverConfig, telnetPort: parseInt(e.target.value) || 8572 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    placeholder="8572"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400">Port Prise d'antenne Harbor DJ</label>
                  <input
                    type="number"
                    value={serverConfig.harborLivePort}
                    onChange={(e) => setServerConfig({ ...serverConfig, harborLivePort: parseInt(e.target.value) || 8005 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    placeholder="8005"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400">Hôte Icecast 2</label>
                  <input
                    type="text"
                    value={serverConfig.icecastHost}
                    onChange={(e) => setServerConfig({ ...serverConfig, icecastHost: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    placeholder="127.0.0.1 ou stream.radiosynapse.fr"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400">Port Icecast 2</label>
                  <input
                    type="number"
                    value={serverConfig.icecastPort}
                    onChange={(e) => setServerConfig({ ...serverConfig, icecastPort: parseInt(e.target.value) || 8000 })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    placeholder="8000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-zinc-400">Mot de passe Source Icecast</label>
                  <input
                    type="password"
                    value={serverConfig.icecastSourcePassword}
                    onChange={(e) => setServerConfig({ ...serverConfig, icecastSourcePassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-colors cursor-pointer"
                  >
                    Enregistrer la configuration serveur
                  </button>
                </div>
              </form>
            </div>

            {/* STATIONS ENCODING & STREAMING MONITOR */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-300" />
                  Flux & Stations Radio Synapse Actives
                </span>
                <span className="text-xs font-mono text-zinc-400">{regieStations.length} flux configurés</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {regieStations.map((station) => {
                  const streamUrl = `http://${serverConfig.icecastHost || 'stream.radiosynapse.fr'}:${serverConfig.icecastPort || 8000}${station.mountpoint}`;
                  return (
                    <div
                      key={station.id}
                      className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${station.isEncodingActive ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-zinc-600'}`} />
                            <span className="text-xs font-bold text-white">{station.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                              {station.genre}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-zinc-300 mt-1">
                            {streamUrl}
                          </p>
                        </div>

                        <button
                          onClick={() => handleToggleStationEncoding(station.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            station.isEncodingActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                          }`}
                        >
                          {station.isEncodingActive ? 'Actif' : 'Pause'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-900 font-mono text-xs">
                        <span className="text-zinc-400">
                          {station.bitrate}k {station.format.toUpperCase()} • Mont: {station.mountpoint}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(streamUrl, 'Lien Icecast')}
                            className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedUrl === streamUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copier</span>
                          </button>
                          <button
                            onClick={() => handleTestAudioStream(streamUrl)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                              testingStreamUrl === streamUrl && isPlayingTestAudio
                                ? 'bg-zinc-100 text-zinc-950 font-bold'
                                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-750'
                            }`}
                          >
                            {testingStreamUrl === streamUrl && isPlayingTestAudio ? (
                              <>
                                <Pause className="w-3 h-3" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                <span>Écouter</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* HARBOR DJ LIVE CREATION */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-zinc-300" />
                  Prise d'Antenne Direct Harbor DJ (Liquidsoap)
                </span>
                <button
                  onClick={() => setIsCreatingDj(!isCreatingDj)}
                  className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-750 text-xs font-mono font-bold transition-all cursor-pointer"
                >
                  {isCreatingDj ? 'Fermer' : '+ Associer un animateur DJ'}
                </button>
              </div>

              {isCreatingDj && (
                <form onSubmit={handleCreateHarborDj} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 animate-in fade-in duration-150">
                  <div>
                    <label className="text-xs font-mono text-zinc-400">Identifiant DJ</label>
                    <input
                      type="text"
                      value={djUsername}
                      onChange={(e) => setDjUsername(e.target.value)}
                      placeholder="dj_animateur"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400">Mot de passe Live</label>
                    <input
                      type="password"
                      value={djPassword}
                      onChange={(e) => setDjPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400">Nom d'affichage</label>
                    <input
                      type="text"
                      value={djDisplayName}
                      onChange={(e) => setDjDisplayName(e.target.value)}
                      placeholder="DJ Max"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-zinc-400">Station cible</label>
                    <select
                      value={djTargetStationId}
                      onChange={(e) => setDjTargetStationId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                    >
                      {regieStations.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-colors cursor-pointer"
                    >
                      Enregistrer les identifiants DJ
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        )}

        {/* SECTION 2: SUPABASE POSTGRESQL & REALTIME */}
        {currentSection === 'supabase' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* SUPABASE STATUS CARD */}
              <div className="lg:col-span-7 p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-zinc-300" />
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      État Supabase PostgreSQL & Realtime
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onTestDatabase}
                    disabled={dbStatus.isTesting}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>{dbStatus.isTesting ? 'Vérification...' : 'Tester la connexion'}</span>
                  </button>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                    <span className="text-zinc-400">Passerelle Kong API :</span>
                    <span className="text-white font-bold">{SUPABASE_CONFIG.url}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                    <span className="text-zinc-400">Moteur Base de Données :</span>
                    <span className="text-white font-bold">PostgreSQL 15 (Supabase Self-Hosted)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                    <span className="text-zinc-400">Canal Temps Réel :</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 font-bold">WebSockets Realtime Actifs</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                    <span className="text-zinc-400">Sécurité & Permissions :</span>
                    <span className="text-zinc-300 font-bold">Row Level Security (RLS) Activé</span>
                  </div>
                </div>

                {dbStatus.ok !== null && (
                  <div className={`p-3.5 rounded-xl border font-mono text-xs flex items-center gap-2.5 ${
                    dbStatus.ok 
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                      : 'bg-red-950/20 border-red-500/30 text-red-300'
                  }`}>
                    <CheckCircle2 className={`w-4 h-4 ${dbStatus.ok ? 'text-emerald-400' : 'text-red-400'}`} />
                    <span>{dbStatus.message}</span>
                  </div>
                )}
              </div>

              {/* LIVE METRICS / STATS CARD */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Volumes Synchronisés en Temps Réel
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 font-mono">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col">
                    <span className="text-xs text-zinc-400">STATIONS</span>
                    <span className="text-lg font-bold text-white mt-1">{activeStationsCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col">
                    <span className="text-xs text-zinc-400">UTILISATEURS</span>
                    <span className="text-lg font-bold text-white mt-1">{usersCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col">
                    <span className="text-xs text-zinc-400">DÉFIS & QUÊTES</span>
                    <span className="text-lg font-bold text-white mt-1">{challengesCount}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col">
                    <span className="text-xs text-zinc-400">PROMOTIONS</span>
                    <span className="text-lg font-bold text-white mt-1">{promotionsCount}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-zinc-400">Toutes les tables sont synchronisées automatiquement.</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                </div>
              </div>
            </div>

            {/* SQL SCRIPT & SCHEMA ACTIONS */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4 h-4 text-zinc-300" />
                  Initialisation SQL Supabase
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href="/vps-infrastructure-guide.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Ouvrir le Guide VPS & SQL</span>
                  </a>
                  <button
                    type="button"
                    onClick={onCopySqlSchema}
                    className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-zinc-950" /> : <Copy className="w-3.5 h-3.5 text-zinc-950" />}
                    <span>{copiedSql ? 'SQL Copié !' : 'Copier supabase_schema.sql'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400">
                Collez ce script dans l'onglet <strong>SQL Editor</strong> de Supabase Studio pour initialiser les tables, la sécurité RLS et le canal temps réel.
              </div>
            </div>

          </div>
        )}

        {/* SECTION 3: EXTERNAL SERVICES */}
        {currentSection === 'external' && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* DISCORD WEBHOOK */}
              <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-3.5">
                <div className="flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-zinc-300" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Webhook Discord Studio
                  </span>
                </div>
                <input
                  type="url"
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                />
              </div>

              {/* LAST.FM API KEY */}
              <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-3.5">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-zinc-300" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Last.fm API Key
                  </span>
                </div>
                <input
                  type="text"
                  value={lastFmApiKey}
                  onChange={(e) => setLastFmApiKey(e.target.value)}
                  placeholder="Clé API Last.fm"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveExternalServices}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition-colors cursor-pointer"
              >
                Enregistrer les intégrations tierces
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
