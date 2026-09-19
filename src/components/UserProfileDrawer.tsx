import { useState, useEffect } from 'react';
import { 
  User, Sparkles, Smartphone, 
  Sliders, Star, Heart, ArrowRight, AlertCircle, Loader2,
  Mail, Lock, ShieldCheck, Check, LogOut, Link2, X, Flame
} from 'lucide-react';
import { ConnectedAccount, SynapseUser } from '../types';
import BrandLogo from './BrandLogo';
import { authenticateWithMusicPlatform } from '../utils/musicPlatformAuth';
import { getUserPoints } from '../utils/loyaltyStore';
import { 
  signInWithEmail, 
  signUpWithEmail, 
  signOutSynapseUser, 
  authenticateOrRegisterWithSpotify,
  resetPasswordForEmail,
  getStoredSynapseUser
} from '../utils/supabaseAuthService';

// Mini 4-point Chromatic Star matching the BrandLogo star
function ChromaticStarIcon({ className = "w-3.5 h-3.5", isAnimated = false }: { className?: string; isAnimated?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center overflow-visible pointer-events-none flex-shrink-0 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className={`w-full h-full overflow-visible ${isAnimated ? 'animate-[spin_12s_linear_infinite]' : ''}`}
      >
        <defs>
          <linearGradient id="userProfileStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2ff">
              <animate attributeName="stop-color" values="#00f2ff;#ff00a0;#ffd700;#8b5cf6;#00f2ff" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="25%" stopColor="#ffffff">
              <animate attributeName="stop-color" values="#ffffff;#00f2ff;#ff00a0;#ffd700;#ffffff" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#3b82f6">
              <animate attributeName="stop-color" values="#3b82f6;#ffd700;#00f2ff;#ff00a0;#3b82f6" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="75%" stopColor="#ff00a0">
              <animate attributeName="stop-color" values="#ff00a0;#8b5cf6;#ffffff;#00f2ff;#ff00a0" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#ffd700">
              <animate attributeName="stop-color" values="#ffd700;#00f2ff;#ff00a0;#ffffff;#ffd700" dur="6s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>
        
        <path
          d="M 16 1.0 
             C 16.5 10.2 19.6 13.5 31.0 15.2 
             C 19.8 16.8 16.5 19.8 15.8 31.0 
             C 15.2 20.0 12.0 16.5 1.0 16.0 
             C 12.0 15.2 15.5 10.2 16 1.0 Z"
          fill="url(#userProfileStarGrad)"
          style={{
            filter: 'drop-shadow(0 0 5px rgba(0,242,255,0.8)) drop-shadow(0 0 8px rgba(255,0,160,0.6))',
          }}
        />
      </svg>
    </span>
  );
}

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  connectedAccount: ConnectedAccount | null;
  onConnectAccount: (account: ConnectedAccount | null) => void;
  synapseUser?: SynapseUser | null;
  onUpdateSynapseUser?: (user: SynapseUser | null) => void;
  likedTracksCount: number;
  favoriteStationsCount: number;
  quality: 'low' | 'medium' | 'high';
  onChangeQuality?: (quality: 'low' | 'medium' | 'high') => void;
  accentColor?: string;
  onOpenLikedTracks: () => void;
  onOpenFavoriteStations: () => void;
  onSyncWithSpotify?: () => Promise<void>;
  onOpenConnectModal?: () => void;
  onOpenAdminPanel?: () => void;
}

export default function UserProfileDrawer({
  isOpen,
  onClose,
  connectedAccount,
  onConnectAccount,
  synapseUser: propSynapseUser,
  onUpdateSynapseUser,
  likedTracksCount,
  favoriteStationsCount,
  quality,
  onChangeQuality,
  onOpenLikedTracks,
  onOpenFavoriteStations,
  onOpenConnectModal,
  onOpenAdminPanel,
}: UserProfileDrawerProps) {
  const [synapseUser, setSynapseUser] = useState<SynapseUser | null>(propSynapseUser || getStoredSynapseUser());
  const [userPoints, setUserPoints] = useState<number>(() => getUserPoints(propSynapseUser || getStoredSynapseUser()));
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Form fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [forgotEmailInput, setForgotEmailInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fullscreen transition states
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      document.body.style.overflow = 'hidden';
    } else if (isRendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (propSynapseUser !== undefined) {
      setSynapseUser(propSynapseUser);
      setUserPoints(getUserPoints(propSynapseUser));
    } else {
      const stored = getStoredSynapseUser();
      setSynapseUser(stored);
      setUserPoints(getUserPoints(stored));
    }
  }, [propSynapseUser, isOpen]);

  // Listen for points updates
  useEffect(() => {
    const handlePointsChanged = (e: any) => {
      if (typeof e.detail?.points === 'number') {
        setUserPoints(e.detail.points);
      } else {
        setUserPoints(getUserPoints(synapseUser));
      }
    };
    window.addEventListener('synapse_points_changed', handlePointsChanged);
    return () => window.removeEventListener('synapse_points_changed', handlePointsChanged);
  }, [synapseUser]);

  // Keyboard Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!emailInput || !passwordInput) {
      setErrorMessage('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        const result = await signUpWithEmail(emailInput, passwordInput, usernameInput);
        if (!result.success || !result.user) {
          setErrorMessage(result.message || result.error || 'Erreur lors de la création du compte.');
          return;
        }
        setSynapseUser(result.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(result.user);
        setSuccessMessage(result.message || 'Votre compte Radio Synapse a été créé avec succès.');
      } else {
        const result = await signInWithEmail(emailInput, passwordInput);
        if (!result.success || !result.user) {
          setErrorMessage(result.message || result.error || 'Identifiants invalides.');
          return;
        }
        setSynapseUser(result.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(result.user);
        setSuccessMessage(`Ravi de vous revoir, ${result.user.username}.`);
      }

      setEmailInput('');
      setPasswordInput('');
      setUsernameInput('');
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMessage(err?.message || 'Une erreur est survenue lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!forgotEmailInput) {
      setErrorMessage('Veuillez saisir votre adresse e-mail.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPasswordForEmail(forgotEmailInput);
      if (res.success) {
        setSuccessMessage(res.message);
        setForgotEmailInput('');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setErrorMessage(err?.message || 'Impossible d\'envoyer le lien de réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Universal Spotify Login / Registration
   * - In "Inscription": "Créer un compte avec Spotify" (direct creation & linking via Spotify email, no password needed)
   * - In "Connexion": "Se connecter avec Spotify" (if account doesn't exist, behaves identically)
   */
  const handleSpotifyDirectAuth = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const spotifyAccount = await authenticateWithMusicPlatform('spotify');

      const result = await authenticateOrRegisterWithSpotify(spotifyAccount);
      if (result.user) {
        setSynapseUser(result.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(result.user);
      }

      onConnectAccount(spotifyAccount);

      setSuccessMessage(result.message || 'Compte Spotify synchronisé avec succès.');
    } catch (e: any) {
      console.error('Spotify auth error:', e);
      setErrorMessage(e?.message || 'Connexion Spotify échouée.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOutSynapseUser();
      setSynapseUser(null);
      if (onUpdateSynapseUser) onUpdateSynapseUser(null);
      onConnectAccount(null);
      setSuccessMessage('Déconnexion réussie.');
    } catch (err) {
      console.error('Signout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRendered) return null;

  const activeUserEmail = synapseUser?.email || connectedAccount?.email;
  const isAdmin = synapseUser?.role === 'admin';

  return (
    <div 
      id="user-profile-fullscreen-view"
      className={`fixed inset-0 z-50 bg-[#050508]/98 backdrop-blur-3xl flex flex-col justify-between select-none overflow-hidden h-screen h-[100dvh] max-h-[100dvh] w-full max-w-full ${
        isClosing ? 'animate-slide-down-full' : 'animate-slide-up-full'
      }`}
      style={{
        backgroundColor: 'rgba(5, 5, 8, 0.98)',
      }}
    >
      {/* 1. TOP HEADER BAR WITH CHROMATIC STAR ACCENTS & DISCREET CLOSE BUTTON */}
      <header className="w-full flex-shrink-0 border-b border-white/10 bg-black/60 backdrop-blur-md relative z-20">
        <div className="w-full max-w-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          
          {/* Left: Brand Identity with chromatic star */}
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" withStar={true} />
            <span className="hidden sm:inline-block w-[1px] h-3.5 bg-white/20" />
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-400">
              <ChromaticStarIcon className="w-3 h-3" />
              <span>{synapseUser || connectedAccount ? 'Profil & Session' : 'Connexion & Inscription'}</span>
            </div>
          </div>

          {/* Right: Sober Monochromatic Close Button */}
          <button
            onClick={handleClose}
            className="group relative p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
            title="Fermer"
            aria-label="Fermer la vue"
          >
            <X className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Liquid Chromatic Shimmer Separator Line */}
        <div className="w-full h-[1px] relative overflow-hidden bg-white/5">
          <div 
            className="absolute inset-y-0 w-1/2 left-1/4 opacity-75"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, #00f2ff 25%, #ffffff 50%, #ff00a0 75%, transparent 100%)',
              filter: 'blur(0.5px)',
            }}
          />
        </div>
      </header>

      {/* 2. SCROLLABLE SOBER BLACK & WHITE CONTENT CONTAINER */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain w-full">
        <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-5">

          {/* ALERTS (Error & Success in Sober High-Contrast Monochromatic Style) */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-white/30 flex items-start gap-3 text-white text-xs font-mono shadow-xl relative overflow-hidden">
              <div className="p-1 rounded-lg bg-white/10 border border-white/20 text-white flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold uppercase tracking-wider text-zinc-300 text-[10px]">Notification</span>
                <span className="leading-relaxed mt-0.5 text-zinc-200">{errorMessage}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-white/30 flex items-start gap-3 text-white text-xs font-mono shadow-xl relative overflow-hidden">
              <div className="p-1 rounded-lg bg-white/10 border border-white/20 text-white flex-shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold uppercase tracking-wider text-zinc-300 text-[10px]">Confirmation</span>
                <span className="leading-relaxed mt-0.5 text-zinc-200">{successMessage}</span>
              </div>
            </div>
          )}

          {/* SECTION A: AUTHENTICATED USER STATE (SOBER B&W WITH CHROMATIC ACCENTS) */}
          {synapseUser || connectedAccount ? (
            <div className="p-6 rounded-2xl bg-zinc-950 border border-white/15 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
              
              {/* Subtle ambient chromatic glow */}
              <div 
                className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none opacity-20 blur-3xl"
                style={{
                  background: 'radial-gradient(circle, #00f2ff 0%, #ff00a0 50%, transparent 70%)',
                }}
              />

              {/* USER HEADER & CHROMATIC AVATAR RING */}
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative flex-shrink-0">
                    {/* Chromatic star metal ring */}
                    <div className="p-[2px] rounded-2xl chromatic-metallic-gradient shadow-[0_0_16px_rgba(0,242,255,0.3)] flex items-center justify-center">
                      <div className="w-14 h-14 rounded-[14px] overflow-hidden bg-black flex items-center justify-center border border-black/80">
                        {synapseUser?.avatarUrl || connectedAccount?.avatarUrl ? (
                          <img 
                            src={synapseUser?.avatarUrl || connectedAccount?.avatarUrl} 
                            alt="Avatar" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <User className="w-7 h-7 text-white" />
                        )}
                      </div>
                    </div>
                    {/* Chromatic mini star indicator pinned on bottom corner */}
                    <span className="absolute -bottom-1 -right-1 z-10">
                      <ChromaticStarIcon className="w-4 h-4" />
                    </span>
                  </div>

                  <div className="flex flex-col text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-white font-futuristic tracking-wider truncate max-w-[200px]">
                        {synapseUser?.username || connectedAccount?.username || 'Membre Synapse'}
                      </h3>

                      {isAdmin ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/30 text-white text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <ShieldCheck className="w-3 h-3 text-white" />
                          <span>ADMIN</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[9px] font-mono font-bold uppercase tracking-wider">
                          MEMBRE
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-mono text-zinc-400 truncate mt-1">
                      {activeUserEmail || 'Compte vérifié'}
                    </span>
                  </div>
                </div>

                {/* SIGN OUT BUTTON */}
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-zinc-300 hover:text-white transition-all cursor-pointer flex-shrink-0 active:scale-95"
                  title="Déconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* LOYALTY POINTS DIGITAL CARD */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-zinc-900 to-amber-500/5 border border-amber-500/30 flex items-center justify-between shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex-shrink-0 shadow-inner">
                    <Flame className="w-6 h-6 fill-amber-500/30 text-amber-400 animate-pulse" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400/90 font-bold">
                      Points de Fidélité Numériques
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl font-futuristic font-black text-amber-300 tracking-wider">
                        {userPoints.toLocaleString('fr-FR')}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400/90">PTS</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      Gagnés en relevant les défis de la station & échangeables contre des promos
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm">
                    {userPoints >= 1000 ? 'VIP Platinum' : userPoints >= 500 ? 'VIP Gold' : 'Auditeur Actif'}
                  </span>
                </div>
              </div>

              {/* ADMIN ACCESS BUTTON (IF PRIVILEGED) */}
              {isAdmin && onOpenAdminPanel && (
                <div className="p-[1.5px] rounded-xl chromatic-metallic-gradient shadow-lg">
                  <button
                    onClick={() => {
                      handleClose();
                      onOpenAdminPanel();
                    }}
                    className="w-full py-3 px-4 rounded-[10.5px] bg-black hover:bg-zinc-950 text-white font-futuristic font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>PANEL ADMIN RADIO SYNAPSE</span>
                  </button>
                </div>
              )}

              {/* LINKED IDENTITIES (SOBER B&W) */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
                  <ChromaticStarIcon className="w-3 h-3" />
                  Comptes & Synchronisation :
                </span>

                {/* Email Account */}
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <Mail className="w-4 h-4 text-white" />
                    <span className="text-white font-bold">Email :</span>
                    <span className="text-zinc-300 truncate max-w-[180px]">{activeUserEmail || 'Non configuré'}</span>
                  </div>
                  <Check className="w-4 h-4 text-white" />
                </div>

                {/* Spotify Account */}
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <Link2 className="w-4 h-4 text-white" />
                    <span className="text-white font-bold">Spotify :</span>
                    {connectedAccount || synapseUser?.spotifyAccount ? (
                      <span className="text-zinc-200 font-bold">
                        {connectedAccount?.username || synapseUser?.spotifyAccount?.username}
                      </span>
                    ) : (
                      <span className="text-zinc-500">Non synchronisé</span>
                    )}
                  </div>

                  {connectedAccount || synapseUser?.spotifyAccount ? (
                    <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/20 font-bold">
                      SYNCHRONISÉ
                    </span>
                  ) : (
                    <button
                      onClick={handleSpotifyDirectAuth}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-mono font-bold transition-all cursor-pointer"
                    >
                      Lier Spotify
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* SECTION B: NOT CONNECTED - FORMULAIRE CONNEXION / INSCRIPTION SOBER B&W */
            <div className="p-6 sm:p-7 rounded-2xl bg-zinc-950 border border-white/15 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
              
              {/* Header Title with chromatic star */}
              <div className="flex flex-col text-left gap-1">
                <div className="flex items-center gap-2">
                  <ChromaticStarIcon className="w-4 h-4" />
                  <h2 className="text-base sm:text-lg font-futuristic font-black uppercase tracking-wider text-white">
                    {authMode === 'signup' 
                      ? 'Inscription Synapse' 
                      : authMode === 'forgot'
                      ? 'Mot de Passe Oublié'
                      : 'Mon Compte'}
                  </h2>
                </div>
                <p className="text-xs font-mono text-zinc-400">
                  {authMode === 'signup'
                    ? 'Créez votre compte pour sauvegarder vos favoris et synchroniser vos appareils.'
                    : authMode === 'forgot'
                    ? 'Définissez ou réinitialisez votre mot de passe pour accéder à votre compte par e-mail.'
                    : 'Accédez à vos stations favorites, titres likés et synchronisation multi-appareils.'}
                </p>
              </div>

              {/* TABS: CONNEXION / INSCRIPTION */}
              <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 select-none">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    authMode === 'login'
                      ? 'bg-white text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {authMode === 'login' && <ChromaticStarIcon className="w-2.5 h-2.5" />}
                  <span>Connexion</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    authMode === 'signup'
                      ? 'bg-white text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {authMode === 'signup' && <ChromaticStarIcon className="w-2.5 h-2.5" />}
                  <span>Inscription</span>
                </button>
              </div>

              {/* VIEW 1: FORGOT PASSWORD FORM */}
              {authMode === 'forgot' ? (
                <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col gap-3.5 text-left">
                  <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 text-xs font-mono text-zinc-300 leading-relaxed">
                    Si vous avez créé votre compte avec Spotify ou si vous avez oublié votre mot de passe, indiquez votre adresse e-mail ci-dessous. Vous recevrez un lien pour créer votre mot de passe et vous connecter par e-mail en toute circonstance.
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono text-zinc-300 font-bold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-white" />
                      Votre adresse e-mail (liée au compte ou à Spotify)
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmailInput}
                      onChange={(e) => setForgotEmailInput(e.target.value)}
                      placeholder="votre.email@domaine.fr"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-white transition-colors placeholder:text-zinc-600"
                    />
                  </div>

                  <div className="p-[1.5px] rounded-xl chromatic-metallic-gradient mt-2 transition-transform hover:scale-[1.01] active:scale-[0.98]">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 px-4 rounded-[10.5px] bg-black hover:bg-zinc-950 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <>
                          <span>Envoyer le lien de réinitialisation</span>
                          <ArrowRight className="w-4 h-4 text-white" />
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-xs font-mono text-zinc-400 hover:text-white transition-colors text-center mt-2 cursor-pointer"
                  >
                    ← Retour à la Connexion
                  </button>
                </form>
              ) : (
                /* VIEW 2: STANDARD CONNEXION / INSCRIPTION FORM */
                <div className="flex flex-col gap-4">
                  
                  {/* SPOTIFY BUTTON DEDICATED PER TAB */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleSpotifyDirectAuth}
                      disabled={isLoading}
                      className="w-full py-3.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/20 text-white font-mono font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] shadow-md group"
                    >
                      <Link2 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                      <span>
                        {authMode === 'signup' 
                          ? 'Créer un compte avec Spotify' 
                          : 'Se connecter avec Spotify'}
                      </span>
                    </button>
                    <span className="text-[11px] font-mono text-zinc-400 text-center">
                      {authMode === 'signup'
                        ? 'Crée directement votre compte avec votre adresse e-mail Spotify, aucun mot de passe requis.'
                        : 'Accès instantané via vos identifiants Spotify sans mot de passe requis.'}
                    </span>
                  </div>

                  {/* SEPARATOR */}
                  <div className="relative my-1 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                    <span className="relative px-3 bg-zinc-950 text-[11px] font-mono uppercase text-zinc-400 font-bold">
                      OU PAR E-MAIL
                    </span>
                  </div>

                  {/* EMAIL / PASSWORD FORM */}
                  <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 text-left">
                    
                    {authMode === 'signup' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-300 font-bold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-white" />
                          Nom d'utilisateur / Pseudo
                        </label>
                        <input
                          type="text"
                          required
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          placeholder="Ex: Theo Synapse"
                          className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-white transition-colors placeholder:text-zinc-600"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono text-zinc-300 font-bold flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-white" />
                        Adresse e-mail
                      </label>
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="votre.email@domaine.fr"
                        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-white transition-colors placeholder:text-zinc-600"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-mono text-zinc-300 font-bold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-white" />
                          Mot de passe
                        </label>
                        {authMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => setAuthMode('forgot')}
                            className="text-[10px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            Mot de passe oublié ?
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-white transition-colors placeholder:text-zinc-600"
                      />
                    </div>

                    {/* LUXURY SUBMIT BUTTON WITH SLIGHT CHROMATIC BORDER TOUCH */}
                    <div className="p-[1.5px] rounded-xl chromatic-metallic-gradient mt-2 transition-transform hover:scale-[1.01] active:scale-[0.98]">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 px-4 rounded-[10.5px] bg-black hover:bg-zinc-950 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <>
                            <span>{authMode === 'signup' ? "S'inscrire sur Radio Synapse" : "Connexion par e-mail"}</span>
                            <ArrowRight className="w-4 h-4 text-white" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* SECTION C: DONNÉES ET QUALITÉ AUDIO (SOBER BLACK & WHITE BENTO) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                Données & Qualité Audio
              </span>
              <span className="text-[10.5px] font-mono text-zinc-300 font-bold">
                {synapseUser || connectedAccount ? 'SYNCHRONISÉ' : 'LOCAL'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              {/* Liked Tracks Card */}
              <button
                onClick={() => {
                  handleClose();
                  onOpenLikedTracks();
                }}
                className="p-4 rounded-2xl bg-zinc-950 border border-white/10 hover:border-white/30 transition-all cursor-pointer flex flex-col text-left group active:scale-95"
              >
                <div className="flex items-center justify-between w-full">
                  <Heart className="w-4 h-4 text-white fill-white/20 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-mono font-bold text-white">{likedTracksCount}</span>
                </div>
                <span className="text-xs font-bold text-white mt-2">Coups de cœur</span>
                <span className="text-[11px] font-mono text-zinc-400">Titres sauvegardés</span>
              </button>

              {/* Favorite Stations Card */}
              <button
                onClick={() => {
                  handleClose();
                  onOpenFavoriteStations();
                }}
                className="p-4 rounded-2xl bg-zinc-950 border border-white/10 hover:border-white/30 transition-all cursor-pointer flex flex-col text-left group active:scale-95"
              >
                <div className="flex items-center justify-between w-full">
                  <Star className="w-4 h-4 text-white fill-white/20 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-mono font-bold text-white">{favoriteStationsCount}</span>
                </div>
                <span className="text-xs font-bold text-white mt-2">Stations favorites</span>
                <span className="text-[11px] font-mono text-zinc-400">Accès rapide</span>
              </button>

              {/* Audio Quality Selection Card - Replaces Studio Preset */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col justify-between text-left">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-white" />
                    <span className="text-xs font-bold text-white">Qualité</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold uppercase text-zinc-300">
                    {quality === 'high' ? '320 kbps' : quality === 'medium' ? '192 kbps' : '128 kbps'}
                  </span>
                </div>

                {/* Direct Segmented Selector for Audio Quality */}
                <div className="mt-2.5 flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-white/10">
                  {(['low', 'medium', 'high'] as const).map((q) => {
                    const labels = { low: 'Éco', medium: 'Standard', high: 'Master' };
                    const isSelected = quality === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onChangeQuality && onChangeQuality(q)}
                        className={`flex-1 py-1 px-1 rounded-lg text-[11px] font-mono font-bold uppercase transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-white text-black shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                        title={q === 'high' ? '320 kbps (HQ Master)' : q === 'medium' ? '192 kbps (Standard)' : '128 kbps (Éco)'}
                      >
                        {labels[q]}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] font-mono text-zinc-400 mt-1.5 truncate">
                  {quality === 'high' ? '320 kbps Master FLAC' : quality === 'medium' ? '192 kbps AAC Standard' : '128 kbps Flux Éco'}
                </span>
              </div>

            </div>
          </div>

          {/* SECTION D: MULTI-DEVICE SYNC BANNER (SOBER B&W) */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/5 border border-white/15 text-white">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-white font-futuristic uppercase tracking-wider">
                  Synchronisation Multi-Appareils
                </span>
                <span className="text-[10px] font-mono text-zinc-400 leading-snug">
                  Vos favoris, flux et réglages sont instantanément synchronisés sur tous vos écrans.
                </span>
              </div>
            </div>

            {onOpenConnectModal && (
              <button
                onClick={() => {
                  handleClose();
                  onOpenConnectModal();
                }}
                className="text-[10.5px] font-mono text-zinc-300 hover:text-white text-center pt-2 border-t border-white/10 transition-colors cursor-pointer font-bold"
              >
                Configurer un Client ID Spotify personnalisé & Redirections →
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
