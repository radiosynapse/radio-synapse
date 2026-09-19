import { useState, useEffect } from 'react';
import { 
  User, Sparkles, Smartphone, 
  Sliders, Star, Heart, ArrowRight, AlertCircle, Loader2,
  Mail, Lock, ShieldCheck, Check, LogOut, X, Flame, Key, Fingerprint
} from 'lucide-react';
import { ConnectedAccount, SynapseUser } from '../types';
import BrandLogo from './BrandLogo';
import { getUserPoints } from '../utils/loyaltyStore';
import { 
  signInWithEmail, 
  signUpWithEmail, 
  signOutSynapseUser, 
  resetPasswordForEmail,
  getStoredSynapseUser
} from '../utils/supabaseAuthService';
import {
  isPasskeySupported,
  registerWithPasskey,
  loginWithPasskey
} from '../utils/passkeyAuthService';

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
  onOpenConnectModal?: () => void;
  onOpenAdminPanel?: () => void;
}

export default function UserProfileDrawer({
  isOpen,
  onClose,
  connectedAccount: _connectedAccount,
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
  const [signupType, setSignupType] = useState<'passkey' | 'password'>('passkey');
  
  // Form fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [forgotEmailInput, setForgotEmailInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(true);

  // Fullscreen transition states
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setPasskeySupported(isPasskeySupported());
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
    }
  }, [propSynapseUser]);

  const handleClose = () => {
    onClose();
  };

  // Passkey Login handler
  const handlePasskeyLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await loginWithPasskey(emailInput.trim() || undefined);
      if (!result.success || !result.user) {
        setErrorMessage(result.message || 'Échec de l\'authentification par Passkey.');
        return;
      }
      setSynapseUser(result.user);
      if (onUpdateSynapseUser) onUpdateSynapseUser(result.user);
      onConnectAccount({
        provider: 'passkey',
        username: result.user.username,
        email: result.user.email,
        avatarUrl: result.user.avatarUrl,
        connectedAt: Date.now(),
      });
      setSuccessMessage(`Bienvenue, ${result.user.displayName || result.user.username} !`);
    } catch (err: any) {
      console.error('Passkey login error:', err);
      setErrorMessage(err?.message || 'Erreur lors de la connexion Passkey.');
    } finally {
      setIsLoading(false);
    }
  };

  // Passkey Signup handler
  const handlePasskeySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!emailInput || !emailInput.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse e-mail valide.');
      return;
    }
    if (!usernameInput.trim()) {
      setErrorMessage('Veuillez choisir un pseudo d\'auditeur.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerWithPasskey({
        email: emailInput,
        firstName: firstNameInput,
        lastName: lastNameInput,
        username: usernameInput,
      });

      if (!result.success || !result.user) {
        setErrorMessage(result.message || 'Erreur lors de la création du compte Passkey.');
        return;
      }

      setSynapseUser(result.user);
      if (onUpdateSynapseUser) onUpdateSynapseUser(result.user);
      onConnectAccount({
        provider: 'passkey',
        username: result.user.username,
        email: result.user.email,
        avatarUrl: result.user.avatarUrl,
        connectedAt: Date.now(),
      });
      setSuccessMessage('Compte créé et Passkey liée avec succès !');
    } catch (err: any) {
      console.error('Passkey register error:', err);
      setErrorMessage(err?.message || 'Erreur lors de l\'enregistrement Passkey.');
    } finally {
      setIsLoading(false);
    }
  };

  // Classic Email Auth handler
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!emailInput || !passwordInput) {
      setErrorMessage('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    if (authMode === 'signup' && passwordInput !== confirmPasswordInput) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        const result = await signUpWithEmail(
          emailInput, 
          passwordInput, 
          usernameInput,
          firstNameInput,
          lastNameInput
        );
        if (!result.success || !result.user) {
          setErrorMessage(result.message || result.error || 'Erreur lors de la création du compte.');
          return;
        }
        setSynapseUser(result.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(result.user);
        onConnectAccount({
          provider: 'email',
          username: result.user.username,
          email: result.user.email,
          avatarUrl: result.user.avatarUrl,
          connectedAt: Date.now(),
        });
        setSuccessMessage('Votre compte Radio Synapse a été créé avec succès.');
      } else {
        const result = await signInWithEmail(emailInput, passwordInput);
        if (!result.success || !result.user) {
          setErrorMessage(result.message || result.error || 'Identifiants invalides.');
          return;
        }
        setSynapseUser(result.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(result.user);
        onConnectAccount({
          provider: 'email',
          username: result.user.username,
          email: result.user.email,
          avatarUrl: result.user.avatarUrl,
          connectedAt: Date.now(),
        });
        setSuccessMessage(`Ravi de vous revoir, ${result.user.displayName || result.user.username}.`);
      }

      setPasswordInput('');
      setConfirmPasswordInput('');
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

  const activeUserEmail = synapseUser?.email;
  const isSuperAdminUser = synapseUser?.role === 'super-admin' || activeUserEmail === 'adminradiosynapse@gmail.com' || activeUserEmail === 'admin@radiosynapse.fr';
  const isAdmin = synapseUser?.role === 'admin' || isSuperAdminUser;

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
              <span>{synapseUser ? 'Profil & Session' : 'Connexion & Inscription'}</span>
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

          {/* ALERTS */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-red-500/40 flex items-start gap-3 text-white text-xs font-mono shadow-xl relative overflow-hidden">
              <div className="p-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 flex-shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold uppercase tracking-wider text-red-300 text-[10px]">Alerte</span>
                <span className="leading-relaxed mt-0.5 text-zinc-200">{errorMessage}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-emerald-500/40 flex items-start gap-3 text-white text-xs font-mono shadow-xl relative overflow-hidden">
              <div className="p-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex-shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold uppercase tracking-wider text-emerald-300 text-[10px]">Succès</span>
                <span className="leading-relaxed mt-0.5 text-zinc-200">{successMessage}</span>
              </div>
            </div>
          )}

          {/* SECTION A: AUTHENTICATED USER STATE */}
          {synapseUser ? (
            <div className="p-6 rounded-2xl bg-zinc-950 border border-white/15 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
              
              {/* Subtle ambient chromatic glow */}
              <div 
                className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none opacity-20 blur-3xl"
                style={{
                  background: 'radial-gradient(circle, #00f2ff 0%, #ff00a0 50%, transparent 70%)',
                }}
              />

              {/* USER HEADER & AVATAR */}
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="p-[2px] rounded-2xl chromatic-metallic-gradient shadow-[0_0_16px_rgba(0,242,255,0.3)] flex items-center justify-center">
                      <div className="w-14 h-14 rounded-[14px] overflow-hidden bg-black flex items-center justify-center border border-black/80">
                        {synapseUser.avatarUrl ? (
                          <img 
                            src={synapseUser.avatarUrl} 
                            alt="Avatar" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <User className="w-7 h-7 text-white" />
                        )}
                      </div>
                    </div>
                    <span className="absolute -bottom-1 -right-1 z-10">
                      <ChromaticStarIcon className="w-4 h-4" />
                    </span>
                  </div>

                  <div className="flex flex-col text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-white font-futuristic tracking-wider truncate max-w-[200px]">
                        {synapseUser.displayName || synapseUser.username || 'Auditeur'}
                      </h3>

                      {isSuperAdminUser ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <ShieldCheck className="w-3 h-3 text-pink-400" />
                          <span>SUPER ADMIN</span>
                        </span>
                      ) : isAdmin ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <ShieldCheck className="w-3 h-3 text-cyan-400" />
                          <span>ADMIN</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-zinc-300 text-[9px] font-mono font-bold uppercase tracking-wider">
                          AUDITEUR
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-mono text-zinc-400 truncate mt-1">
                      {activeUserEmail || 'Compte vérifié'}
                    </span>

                    {(synapseUser.firstName || synapseUser.lastName) && (
                      <span className="text-[11px] font-mono text-zinc-400 truncate">
                        {synapseUser.firstName} {synapseUser.lastName}
                      </span>
                    )}
                  </div>
                </div>

                {/* SIGN OUT BUTTON */}
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/15 hover:border-red-500/30 text-zinc-300 transition-all cursor-pointer flex-shrink-0 active:scale-95"
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
                      Gagnés en relevant les défis de la station & échangeables contre des cadeaux
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

              {/* AUTH METHOD DETAILS */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-2">
                  <ChromaticStarIcon className="w-3 h-3" />
                  Mode de connexion sécurisé :
                </span>

                <div className="p-3.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <Key className="w-4 h-4 text-cyan-400" />
                    <span className="text-white font-bold">Sécurité :</span>
                    <span className="text-zinc-300">
                      {synapseUser.authMethod === 'passkey' ? 'Passkey Biométrique (WebAuthn)' : 'E-mail & Mot de passe'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-bold">
                    ACTIF
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* SECTION B: NOT CONNECTED - FORMULAIRE CONNEXION / INSCRIPTION */
            <div className="p-6 sm:p-7 rounded-2xl bg-zinc-950 border border-white/15 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
              
              {/* Header Title with chromatic star */}
              <div className="flex flex-col text-left gap-1">
                <div className="flex items-center gap-2">
                  <ChromaticStarIcon className="w-4 h-4" />
                  <h2 className="text-base sm:text-lg font-futuristic font-black uppercase tracking-wider text-white">
                    {authMode === 'signup' 
                      ? 'Inscription Auditeur' 
                      : authMode === 'forgot'
                      ? 'Mot de Passe Oublié'
                      : 'Espace Connexion'}
                  </h2>
                </div>
                <p className="text-xs font-mono text-zinc-400">
                  {authMode === 'signup'
                    ? 'Inscrivez-vous simplement par Passkey biométrique (sans mot de passe) ou par e-mail classique.'
                    : authMode === 'forgot'
                    ? 'Réinitialisez votre mot de passe pour accéder à votre compte par e-mail.'
                    : 'Connectez-vous instantanément avec votre Passkey ou vos identifiants e-mail.'}
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
                    Indiquez votre adresse e-mail ci-dessous pour recevoir un lien de réinitialisation sécurisé.
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono text-zinc-300 font-bold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-white" />
                      Votre adresse e-mail
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmailInput}
                      onChange={(e) => setForgotEmailInput(e.target.value)}
                      placeholder="votre.email@domaine.fr"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-zinc-400"
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
              ) : authMode === 'login' ? (
                /* VIEW 2: CONNEXION (PASSKEY OU MOT DE PASSE) */
                <div className="flex flex-col gap-4">
                  {/* Option 1: Fast Passkey Login */}
                  {passkeySupported && (
                    <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          <Fingerprint className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-white uppercase font-futuristic">
                            Connexion Passkey (Biométrie)
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            Face ID, Empreinte ou Smartphone
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePasskeyLogin}
                        disabled={isLoading}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-md disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Key className="w-4 h-4" />
                        )}
                        <span>Se connecter avec ma Passkey</span>
                      </button>
                    </div>
                  )}

                  {/* Separator */}
                  <div className="relative my-1 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                    <span className="relative px-3 bg-zinc-950 text-[11px] font-mono uppercase text-zinc-400 font-bold">
                      OU PAR E-MAIL & MOT DE PASSE
                    </span>
                  </div>

                  {/* Classic Email/Password Form */}
                  <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 text-left">
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
                        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-zinc-400"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-mono text-zinc-300 font-bold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-white" />
                          Mot de passe
                        </label>
                        <button
                          type="button"
                          onClick={() => setAuthMode('forgot')}
                          className="text-[10px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-zinc-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-1 w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 active:scale-98"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 text-black animate-spin" />
                      ) : (
                        <>
                          <span>Connexion par e-mail</span>
                          <ArrowRight className="w-4 h-4 text-black" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* VIEW 3: INSCRIPTION (PASSKEY OU E-MAIL) */
                <div className="flex flex-col gap-4">
                  {/* Signup Type Toggle */}
                  <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setSignupType('passkey')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        signupType === 'passkey'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>Passkey (Recommandé)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupType('password')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        signupType === 'password'
                          ? 'bg-zinc-800 text-white border border-white/20'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Mot de passe</span>
                    </button>
                  </div>

                  {signupType === 'passkey' ? (
                    /* Inscription Passkey */
                    <form onSubmit={handlePasskeySignup} className="flex flex-col gap-3 text-left animate-fadeIn">
                      <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] font-mono text-cyan-200 leading-relaxed">
                          Votre profil (adresse mail, nom, prénom et pseudo) est enregistré et la passkey générée par votre appareil est liée à votre compte à la place du mot de passe.
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-300 font-bold">
                          Adresse e-mail *
                        </label>
                        <input
                          type="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="auditeur@exemple.com"
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-mono text-zinc-300 font-bold">
                            Prénom
                          </label>
                          <input
                            type="text"
                            value={firstNameInput}
                            onChange={(e) => setFirstNameInput(e.target.value)}
                            placeholder="Alex"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-mono text-zinc-300 font-bold">
                            Nom
                          </label>
                          <input
                            type="text"
                            value={lastNameInput}
                            onChange={(e) => setLastNameInput(e.target.value)}
                            placeholder="Dupont"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-300 font-bold">
                          Pseudo d'auditeur *
                        </label>
                        <input
                          type="text"
                          required
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          placeholder="Theo Synapse"
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Fingerprint className="w-4 h-4" />
                        )}
                        <span>Créer mon compte avec Passkey</span>
                      </button>
                    </form>
                  ) : (
                    /* Inscription Mot de passe classique */
                    <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 text-left animate-fadeIn">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-300 font-bold">
                          Adresse e-mail *
                        </label>
                        <input
                          type="email"
                          required
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="auditeur@exemple.com"
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-mono text-zinc-300 font-bold">
                            Prénom
                          </label>
                          <input
                            type="text"
                            value={firstNameInput}
                            onChange={(e) => setFirstNameInput(e.target.value)}
                            placeholder="Alex"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-mono text-zinc-300 font-bold">
                            Nom
                          </label>
                          <input
                            type="text"
                            value={lastNameInput}
                            onChange={(e) => setLastNameInput(e.target.value)}
                            placeholder="Dupont"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-300 font-bold">
                          Pseudo d'auditeur *
                        </label>
                        <input
                          type="text"
                          required
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          placeholder="Theo Synapse"
                          className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-mono text-zinc-300 font-bold">
                            Mot de passe *
                          </label>
                          <input
                            type="password"
                            required
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-mono text-zinc-300 font-bold">
                            Confirmer *
                          </label>
                          <input
                            type="password"
                            required
                            value={confirmPasswordInput}
                            onChange={(e) => setConfirmPasswordInput(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 placeholder:text-zinc-400"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-2 w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <ArrowRight className="w-4 h-4 text-black" />}
                        <span>Créer mon compte</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION C: DONNÉES ET QUALITÉ AUDIO */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                Données & Qualité Audio
              </span>
              <span className="text-[10.5px] font-mono text-zinc-300 font-bold">
                {synapseUser ? 'SYNCHRONISÉ' : 'LOCAL'}
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

              {/* Audio Quality Selection Card */}
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

          {/* SECTION D: MULTI-DEVICE SYNC & PASSKEY INFO */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/5 border border-white/15 text-white">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-white font-futuristic uppercase tracking-wider">
                  Synchronisation Multi-Appareils & Passkey
                </span>
                <span className="text-[10px] font-mono text-zinc-400 leading-snug">
                  Vos favoris, flux et réglages sont instantanément synchronisés sur tous vos appareils de manière chiffrée.
                </span>
              </div>
            </div>

            {onOpenConnectModal && (
              <button
                onClick={() => {
                  handleClose();
                  onOpenConnectModal();
                }}
                className="text-[10.5px] font-mono text-zinc-300 hover:text-white text-center pt-2 border-t border-white/10 transition-colors cursor-pointer font-bold flex items-center justify-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <span>Gérer mes identifiants & ma Passkey →</span>
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
