import { useState } from 'react';
import { 
  Server, Database, Key, CheckCircle2, RefreshCw, Mic, Radio, 
  HelpCircle, DownloadCloud, HardDrive, Copy, Check,
  ShieldCheck, Globe, Wifi, Music2, MessageSquare, Webhook, Zap,
  Trophy, Tag, CalendarDays
} from 'lucide-react';
import { StreamChannel } from '../data';
import { POCKETBASE_SQLITE_SCHEMA_SQL, POCKETBASE_CONFIG } from '../lib/pocketbase';
import { 
  getAzuraCastConfig, 
  saveAzuraCastConfig, 
  testAzuraCastConnection, 
  createStationStreamer, 
  AzuraCastConfig 
} from '../lib/azuracast';

interface AdminServicesTabProps {
  stations: StreamChannel[];
  onOpenControlDeck: (station: StreamChannel) => void;
  showToast: (msg: string) => void;
  // PocketBase handlers
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
  onCopyJsonSchema: () => void;
  copiedSql: boolean;
  copiedJson: boolean;
  // Dynamic stats
  activeStationsCount: number;
  usersCount: number;
  challengesCount: number;
  promotionsCount: number;
  eventsCount: number;
}

type ServiceSection = 'azuracast' | 'pocketbase' | 'external';

export default function AdminServicesTab({
  stations,
  onOpenControlDeck,
  showToast,
  dbStatus,
  onTestDatabase,
  onPullRemoteData,
  onSyncDatabase,
  onCopySqlSchema,
  onCopyJsonSchema,
  copiedSql,
  copiedJson,
  activeStationsCount,
  usersCount,
  challengesCount,
  promotionsCount,
  eventsCount,
}: AdminServicesTabProps) {
  const [activeSection, setActiveSection] = useState<ServiceSection>('azuracast');

  // AzuraCast state
  const [azuraConfig, setAzuraConfig] = useState<AzuraCastConfig>(getAzuraCastConfig());
  const [azuraBaseUrl, setAzuraBaseUrl] = useState(azuraConfig.baseUrl);
  const [azuraApiKey, setAzuraApiKey] = useState(azuraConfig.apiKey);
  const [showAzuraApiKey, setShowAzuraApiKey] = useState(false);
  const [azuraTestStatus, setAzuraTestStatus] = useState<{
    ok: boolean | null;
    message: string;
    latency?: number;
    isTesting: boolean;
    stationsCount?: number;
  }>({
    ok: null,
    message: 'Prêt à tester la liaison API AzuraCast',
    isTesting: false,
  });

  // DJ Streamer state
  const [djUsername, setDjUsername] = useState('');
  const [djPassword, setDjPassword] = useState('');
  const [djDisplayName, setDjDisplayName] = useState('');
  const [djTargetStationId, setDjTargetStationId] = useState<number>(1);
  const [isCreatingDj, setIsCreatingDj] = useState(false);

  // External services configuration mock / state
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('synapse_discord_webhook') || '' : ''
  );
  const [spotifyClientId, setSpotifyClientId] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('synapse_spotify_client_id') || '' : ''
  );
  const [lastFmApiKey, setLastFmApiKey] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('synapse_lastfm_key') || '' : ''
  );

  const handleSaveAzura = () => {
    saveAzuraCastConfig({
      ...azuraConfig,
      baseUrl: azuraBaseUrl.trim(),
      apiKey: azuraApiKey.trim(),
    });
    setAzuraConfig(getAzuraCastConfig());
    showToast('Configuration AzuraCast enregistrée avec succès !');
  };

  const handleTestAzura = async () => {
    setAzuraTestStatus((prev) => ({ ...prev, isTesting: true }));
    const result = await testAzuraCastConnection();
    setAzuraTestStatus({
      ok: result.ok,
      message: result.message,
      latency: result.latencyMs,
      isTesting: false,
      stationsCount: result.stations?.length,
    });
    showToast(result.ok ? `Connexion AzuraCast réussie (${result.latencyMs || 0}ms)` : 'Échec de connexion AzuraCast');
  };

  const handleCreateDj = async () => {
    if (!djUsername.trim() || !djPassword.trim()) return;
    setIsCreatingDj(true);
    try {
      const res = await createStationStreamer(djTargetStationId, {
        streamer_username: djUsername.trim(),
        streamer_password: djPassword.trim(),
        display_name: djDisplayName.trim() || djUsername.trim(),
        is_active: true,
      });
      showToast(res.message);
      setDjUsername('');
      setDjPassword('');
      setDjDisplayName('');
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la création du compte streamer DJ');
    } finally {
      setIsCreatingDj(false);
    }
  };

  const handleSaveExternalServices = () => {
    try {
      localStorage.setItem('synapse_discord_webhook', discordWebhookUrl.trim());
      localStorage.setItem('synapse_spotify_client_id', spotifyClientId.trim());
      localStorage.setItem('synapse_lastfm_key', lastFmApiKey.trim());
      showToast('Paramètres des intégrations externes sauvegardés');
    } catch {
      showToast('Impossible d\'enregistrer les paramètres externes');
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left animate-in fade-in duration-200">
      
      {/* SERVICES HEADER BANNER - SOBRE & ÉPURÉ */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-cyan-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-futuristic font-black uppercase tracking-wider text-white">
                Services & Connexions API
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                HUB CENTRALISÉ
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              Gérez vos points d'accès AzuraCast, PocketBase et les intégrations futures au même endroit.
            </p>
          </div>
        </div>

        {/* Global summary pills */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-zinc-400">AzuraCast :</span>
            <span className="text-zinc-200 font-bold">cast.radiosynapse.fr</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-400">PocketBase :</span>
            <span className="text-zinc-200 font-bold">db.radiosynapse.fr</span>
          </div>
        </div>
      </div>

      {/* SEGMENTED SERVICE TABS NAV */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md w-full overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveSection('azuracast')}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeSection === 'azuracast'
              ? 'bg-zinc-800 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
          }`}
        >
          <Radio className="w-4 h-4 text-cyan-400" />
          <span>AzuraCast Radio API</span>
        </button>

        <button
          onClick={() => setActiveSection('pocketbase')}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeSection === 'pocketbase'
              ? 'bg-zinc-800 text-emerald-300 border border-emerald-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>PocketBase Base & Realtime</span>
        </button>

        <button
          onClick={() => setActiveSection('external')}
          className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeSection === 'external'
              ? 'bg-zinc-800 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
          }`}
        >
          <Zap className="w-4 h-4 text-purple-400" />
          <span>Services Tiers & Futurs</span>
        </button>
      </div>

      {/* SECTION 1: AZURACAST RADIO API */}
      {activeSection === 'azuracast' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* AZURACAST CONFIG CARD */}
            <div className="lg:col-span-7 p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Paramètres d'Accès API AzuraCast
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTestAzura}
                  disabled={azuraTestStatus.isTesting}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-cyan-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${azuraTestStatus.isTesting ? 'animate-spin' : ''}`} />
                  <span>{azuraTestStatus.isTesting ? 'Test...' : 'Tester Connexion'}</span>
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">URL de l'Instance AzuraCast :</label>
                  <input
                    type="url"
                    value={azuraBaseUrl}
                    onChange={(e) => setAzuraBaseUrl(e.target.value)}
                    placeholder="https://cast.radiosynapse.fr"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-400">Clé d'API Administrateur (API Key) :</label>
                    <button
                      type="button"
                      onClick={() => setShowAzuraApiKey(!showAzuraApiKey)}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      {showAzuraApiKey ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                  <input
                    type={showAzuraApiKey ? 'text' : 'password'}
                    value={azuraApiKey}
                    onChange={(e) => setAzuraApiKey(e.target.value)}
                    placeholder="Collez ici votre clé API AzuraCast..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Créée dans AzuraCast via : <span className="text-zinc-300">Mon Compte &gt; Clés d'API &gt; Ajouter une clé d'API</span>.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveAzura}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs font-mono transition-colors cursor-pointer"
                  >
                    Enregistrer Configuration
                  </button>
                </div>
              </div>

              {/* TEST RESULT */}
              {azuraTestStatus.ok !== null && (
                <div className={`p-3.5 rounded-xl border font-mono text-xs flex items-center justify-between gap-3 ${
                  azuraTestStatus.ok 
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-950/20 border-red-500/30 text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 ${azuraTestStatus.ok ? 'text-emerald-400' : 'text-red-400'}`} />
                    <span>{azuraTestStatus.message}</span>
                  </div>
                  {azuraTestStatus.latency && (
                    <span className="text-[10px] opacity-80">{azuraTestStatus.latency} ms</span>
                  )}
                </div>
              )}
            </div>

            {/* CREATE STREAMER ACCOUNT */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Créer un Compte Streamer / DJ Direct
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Station Cible :</label>
                  <select
                    value={djTargetStationId}
                    onChange={(e) => setDjTargetStationId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-purple-400 focus:outline-none"
                  >
                    {stations.map((s, idx) => (
                      <option key={s.id} value={parseInt(s.stationNumber || '1', 10) || idx + 1}>
                        #{s.stationNumber || idx + 1} — {s.name} ({s.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Identifiant DJ :</label>
                    <input
                      type="text"
                      value={djUsername}
                      onChange={(e) => setDjUsername(e.target.value)}
                      placeholder="theocourant"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Mot de Passe DJ :</label>
                    <input
                      type="password"
                      value={djPassword}
                      onChange={(e) => setDjPassword(e.target.value)}
                      placeholder="SynapseDj2026!"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Nom d'Affichage à l'Antenne :</label>
                  <input
                    type="text"
                    value={djDisplayName}
                    onChange={(e) => setDjDisplayName(e.target.value)}
                    placeholder="DJ Théo • Live Session"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-purple-400 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={isCreatingDj || !djUsername || !djPassword}
                  onClick={handleCreateDj}
                  className="w-full mt-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreatingDj ? 'Création en cours...' : 'Créer le Streamer sur AzuraCast'}
                </button>
              </div>
            </div>
          </div>

          {/* STATIONS CONTROL REMOTES MATRIX */}
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Télécommandes Régie & Contrôle Direct par Station
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stations.map((st) => (
                <div key={st.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: st.color }}
                      />
                      <span className="font-bold text-white text-xs">{st.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                      N° {st.stationNumber || '01'}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 font-mono truncate">{st.genre}</p>

                  <button
                    type="button"
                    onClick={() => onOpenControlDeck(st)}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Ouvrir Régie & Enregistreur</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SETUP GUIDE */}
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Guide Rapide : Liaison API AzuraCast
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center text-[10px] border border-cyan-500/30">1</span>
                  <span>Clé d'API Administrateur</span>
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Rendez-vous sur <a href="https://cast.radiosynapse.fr" target="_blank" rel="noreferrer" className="text-cyan-400 underline">cast.radiosynapse.fr</a> &gt; Mon Compte &gt; Clés d'API. Générez une clé avec les droits d'administration de la station.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-[10px] border border-purple-500/30">2</span>
                  <span>Streamer DJ & Direct Antenne</span>
                </div>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Pour parler en direct au micro ou utiliser WebDJ, assurez-vous d'avoir créé un compte streamer dans le formulaire ci-dessus, puis activez la prise d'antenne depuis la régie.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* SECTION 2: POCKETBASE BASE & REALTIME */}
      {activeSection === 'pocketbase' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          
          {/* POCKETBASE STATUS & ACTIONS */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1 text-left">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-futuristic font-black tracking-wide text-white">
                  Serveur Base de Données PocketBase
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  dbStatus.ok 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}>
                  {dbStatus.ok ? 'CONNECTÉ' : 'OPÉRATIONNEL'}
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-400">
                URL : <span className="text-emerald-300 font-semibold">{POCKETBASE_CONFIG.url}</span>
              </p>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                Synchronisation bidirectionnelle automatique pour les stations, dédicaces, likes auditeurs, profils et challenges.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={onTestDatabase}
                disabled={dbStatus.isTesting}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Server className={`w-3.5 h-3.5 ${dbStatus.isTesting ? 'animate-pulse text-emerald-400' : ''}`} />
                <span>Tester Connexion</span>
              </button>

              <button
                onClick={onPullRemoteData}
                disabled={dbStatus.isSyncing}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-cyan-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                title="Restaurer le cache local depuis PocketBase"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-cyan-400" />
                <span>Restaurer de PB</span>
              </button>

              <button
                onClick={onSyncDatabase}
                disabled={dbStatus.isSyncing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${dbStatus.isSyncing ? 'animate-spin' : ''}`} />
                <span>Synchroniser (2 Voies)</span>
              </button>
            </div>
          </div>

          {/* COLLECTIONS STATUS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
            
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono font-bold">
                  <Radio className="w-4 h-4" />
                  <span>STATIONS RADIO</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-cyan-300 text-[11px] font-mono border border-zinc-800">
                  {activeStationsCount}/{stations.length} actives
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">Collection: <code className="text-zinc-300">synapse_stations</code></p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-mono font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>UTILISATEURS & AUTH</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-purple-300 text-[11px] font-mono border border-zinc-800">
                  {usersCount} comptes
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">Collection: <code className="text-zinc-300">users</code> (Auth)</p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-bold">
                  <Trophy className="w-4 h-4" />
                  <span>DÉFIS & QUÊTES</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-amber-300 text-[11px] font-mono border border-zinc-800">
                  {challengesCount} quêtes
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">Collection: <code className="text-zinc-300">synapse_challenges</code></p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-pink-300 text-xs font-mono font-bold">
                  <Tag className="w-4 h-4" />
                  <span>CODES PROMO</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-pink-300 text-[11px] font-mono border border-zinc-800">
                  {promotionsCount} promos
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">Collection: <code className="text-zinc-300">synapse_promotions</code></p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-bold">
                  <CalendarDays className="w-4 h-4" />
                  <span>ÉVÉNEMENTS & LIVES</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-emerald-300 text-[11px] font-mono border border-zinc-800">
                  {eventsCount} events
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">Collection: <code className="text-zinc-300">synapse_events</code></p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300 text-xs font-mono font-bold">
                  <MessageSquare className="w-4 h-4" />
                  <span>MESSAGES STUDIO</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 text-[11px] font-mono border border-zinc-800">
                  Actif
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">Collection: <code className="text-zinc-300">synapse_messages</code></p>
            </div>
          </div>

          {/* JSON SCHEMA EXPORT & IMPORT (POCKETBASE v0.40+) */}
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Schéma Complet PocketBase (pb_schema.json v0.40.2)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/pb_schema.json"
                  download="pb_schema.json"
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  <span>Télécharger pb_schema.json</span>
                </a>
                <button
                  onClick={onCopyJsonSchema}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copié !' : 'Copier pb_schema.json'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs font-mono text-zinc-400">
              Dans l'interface PocketBase (<code className="text-emerald-300 font-bold">https://db.radiosynapse.fr/_/</code>), allez dans <strong>Settings &gt; Export/Import collections &gt; Load from JSON</strong> et importez ce fichier pour configurer instantanément toutes les tables, API Rules et collections système requises.
            </p>
          </div>

          {/* SQLITE SCHEMA CARD */}
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-3 text-left">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Structure SQLite PocketBase (Documentation)
                </span>
              </div>

              <button
                onClick={onCopySqlSchema}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copié !' : 'Copier script SQL'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 overflow-x-auto max-h-52 custom-scrollbar leading-relaxed">
              {POCKETBASE_SQLITE_SCHEMA_SQL}
            </pre>
          </div>

        </div>
      )}

      {/* SECTION 3: EXTERNAL SERVICES & FUTURE INTEGRATIONS */}
      {activeSection === 'external' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* SPOTIFY WEB API & OAUTH */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Music2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Spotify Web API & OAuth
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Intégré
                </span>
              </div>

              <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                Permet aux auditeurs de synchroniser leurs coups de cœur Radio Synapse avec leurs playlists personnelles Spotify et d'enrichir les métadonnées.
              </p>

              <div className="space-y-3 font-mono text-xs mt-auto">
                <div>
                  <label className="text-zinc-400 block mb-1">Spotify Client ID (OAuth) :</label>
                  <input
                    type="text"
                    value={spotifyClientId}
                    onChange={(e) => setSpotifyClientId(e.target.value)}
                    placeholder="ex: 4a2b9c8d7e6f5..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* DISCORD WEBHOOK STUDIO */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Webhook className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Discord Studio Webhook
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  Prêt à brancher
                </span>
              </div>

              <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                Notifie automatiquement un salon Discord communautaire dès qu'un DJ prend l'antenne en direct ou lors d'annonces spéciales.
              </p>

              <div className="space-y-3 font-mono text-xs mt-auto">
                <div>
                  <label className="text-zinc-400 block mb-1">URL Webhook Discord :</label>
                  <input
                    type="url"
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-indigo-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* LAST.FM & MUSICBRAINZ SCROBBLER */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-red-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Last.fm & MusicBrainz
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Optionnel
                </span>
              </div>

              <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                Récupération automatique des biographies d'artistes, discographies et jaquettes haute résolution pour le lecteur MiniDisc.
              </p>

              <div className="space-y-3 font-mono text-xs mt-auto">
                <div>
                  <label className="text-zinc-400 block mb-1">Clé API Last.fm :</label>
                  <input
                    type="text"
                    value={lastFmApiKey}
                    onChange={(e) => setLastFmApiKey(e.target.value)}
                    placeholder="Clé d'API Last.fm"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:border-red-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* EXTERNAL STREAM RELAYS (ICECAST / SHOUTCAST) */}
            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Relais Icecast / SHOUTcast Externes
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Passerelle
                </span>
              </div>

              <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                Diffusion simultanée vers des annuaires radio externes (TuneIn, Radio France, vTuner) via les points de montage AzuraCast.
              </p>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400 mt-auto">
                Configuration active via les points de montage <code className="text-amber-300">/radio.mp3</code> et relais de broadcast.
              </div>
            </div>

          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveExternalServices}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs font-mono transition-colors cursor-pointer"
            >
              Enregistrer les Intégrations Externes
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
