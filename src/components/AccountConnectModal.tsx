import { useState, useEffect } from 'react';
import { 
  X, Check, Sparkles, ExternalLink, ShieldCheck, 
  AlertCircle, Copy, Key
} from 'lucide-react';
import { ConnectedAccount } from '../types';
import { 
  authenticateWithMusicPlatform, 
  getOAuthCallbackUrl, 
  getEffectiveSpotifyClientId, 
  setCustomSpotifyClientId,
} from '../utils/musicPlatformAuth';

interface AccountConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: ConnectedAccount | null;
  onConnectAccount: (account: ConnectedAccount | null) => void;
}

export default function AccountConnectModal({
  isOpen,
  onClose,
  currentAccount,
  onConnectAccount,
}: AccountConnectModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spotifyClientIdInput, setSpotifyClientIdInput] = useState('');
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [copiedAltCallback, setCopiedAltCallback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSpotifyClientIdInput(getEffectiveSpotifyClientId());
      setErrorMessage(null);
      setIsConnecting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const callbackUrl = getOAuthCallbackUrl();
  const altCallbackUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/auth/callback` 
    : 'http://localhost:3000/auth/callback';

  const handleRealConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);

    try {
      // Save any custom developer client IDs
      if (spotifyClientIdInput) {
        setCustomSpotifyClientId(spotifyClientIdInput);
      }

      // Launch REAL Spotify OAuth popup directly with official provider URL
      const realAccount = await authenticateWithMusicPlatform('spotify', spotifyClientIdInput);

      onConnectAccount(realAccount);
      setIsConnecting(false);
      onClose();
    } catch (err: any) {
      console.error('Spotify OAuth connection error:', err);
      setIsConnecting(false);
      setErrorMessage(err?.message || 'La connexion à Spotify a échoué.');
    }
  };

  const handleCopyCallback = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(callbackUrl);
      setCopiedCallback(true);
      setTimeout(() => setCopiedCallback(false), 2000);
    }
  };

  const handleCopyAltCallback = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(altCallbackUrl);
      setCopiedAltCallback(true);
      setTimeout(() => setCopiedAltCallback(false), 2000);
    }
  };

  const handleDisconnect = () => {
    onConnectAccount(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0a0a0f] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center p-2.5">
              <img 
                src="https://cdn-icons-png.flaticon.com/512/174/174872.png" 
                alt="Spotify" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-futuristic uppercase tracking-wider text-white">
                Connexion Spotify
              </h3>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                Authentification officielle Spotify OAuth
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="p-3.5 mb-4 rounded-2xl bg-red-950/60 border border-red-500/50 flex items-start gap-3 text-red-200 text-xs font-mono">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold">Échec de la connexion</span>
              <p className="text-zinc-300 text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Current status if connected */}
        {currentAccount ? (
          <div className="flex flex-col gap-5 relative z-10">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-400 shadow-md">
                  {currentAccount.avatarUrl ? (
                    <img src={currentAccount.avatarUrl} alt={currentAccount.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-emerald-900 flex items-center justify-center text-emerald-300">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                    COMPTE SPOTIFY CONNECTÉ
                  </span>
                  <span className="text-sm font-bold text-white block">
                    {currentAccount.username}
                  </span>
                  {currentAccount.email && (
                    <span className="text-[11px] font-mono text-zinc-400 block">
                      {currentAccount.email}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="text-xs font-mono text-red-400 hover:text-red-300 px-3 py-1.5 rounded-xl bg-red-950/50 border border-red-500/30 hover:border-red-400 transition-all cursor-pointer font-bold"
              >
                Déconnecter
              </button>
            </div>

            {currentAccount.playlistUrl && (
              <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#1DB954]/20 flex items-center justify-center flex-shrink-0">
                    <img 
                      src="https://cdn-icons-png.flaticon.com/512/174/174872.png" 
                      alt="Spotify" 
                      className="w-4 h-4 object-contain" 
                    />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-white font-mono">Radio Synapse - Titres Likés</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Playlist synchronisée</span>
                  </div>
                </div>

                <a
                  href={currentAccount.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/50 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                >
                  <span>Ouvrir</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Votre compte Spotify est lié. Vos morceaux likés et votre profil sont synchronisés sur Radio Synapse.
            </p>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-mono font-bold uppercase tracking-wider text-xs transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 relative z-10">
            <p className="text-xs font-mono text-zinc-300">
              Connectez votre compte Spotify pour synchroniser vos titres likés et votre playlist :
            </p>

            {/* Spotify Single Primary Connect Button */}
            <div className="flex flex-col gap-3">
              <button
                disabled={isConnecting}
                onClick={handleRealConnect}
                className="w-full p-4 rounded-2xl border bg-gradient-to-r from-emerald-950/90 to-zinc-900 border-emerald-500/50 hover:border-emerald-400 transition-all duration-300 cursor-pointer flex items-center justify-between group text-left relative overflow-hidden active:scale-[0.99] shadow-lg"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#1DB954]/20 border border-[#1DB954]/50 flex items-center justify-center p-2.5 group-hover:scale-110 transition-transform">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174872.png" alt="Spotify" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                      Se connecter avec Spotify
                      <Sparkles className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 line-clamp-1">
                      Connexion officielle avec profil réel & synchronisation playlist
                    </span>
                  </div>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-[#1DB954]/20 group-hover:bg-[#1DB954]/35 border border-[#1DB954]/50 text-[11px] font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0">
                  {isConnecting ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>Connexion...</span>
                    </div>
                  ) : (
                    <>
                      <span>Connecter</span>
                      <ExternalLink className="w-3 h-3" />
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Spotify Developer Client ID Configuration Section */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/30 flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-white font-bold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Votre Client ID Spotify</span>
                </label>
                <a
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10.5px] font-mono text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1 font-bold"
                >
                  <span>Créer mon App Spotify</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={spotifyClientIdInput}
                  onChange={(e) => {
                    setSpotifyClientIdInput(e.target.value);
                    setCustomSpotifyClientId(e.target.value);
                  }}
                  placeholder="Collez votre Client ID Spotify ici"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-900/90 border border-white/15 text-emerald-300 text-xs font-mono focus:outline-none focus:border-emerald-400 placeholder:text-zinc-600"
                />
                <p className="text-[10.5px] font-mono text-zinc-400 leading-relaxed">
                  Spotify exige que chaque utilisateur soit propriétaire de son application pour créer et synchroniser des playlists réelles en direct.
                </p>
              </div>

              {/* Redirect URIs to add on developer.spotify.com */}
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  URIs de redirection à ajouter dans votre App Spotify :
                </span>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={callbackUrl}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-emerald-300 text-[10.5px] font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyCallback}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-[10.5px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all flex-shrink-0"
                    title="Copier l'URL de redirection"
                  >
                    {copiedCallback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCallback ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={altCallbackUrl}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-emerald-300 text-[10.5px] font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyAltCallback}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-[10.5px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all flex-shrink-0"
                    title="Copier l'URL alternative"
                  >
                    {copiedAltCallback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAltCallback ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-[10px] font-mono text-zinc-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Authentification officielle Spotify sécurisée (PKCE). Les jetons restent privés sur votre navigateur.</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


