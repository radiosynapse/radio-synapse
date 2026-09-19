import { useState, useEffect } from 'react';
import { 
  X, Check, Sparkles, ShieldCheck, 
  AlertCircle, Key, Smartphone, Mail, Lock, 
  User, ArrowRight, Loader2, Fingerprint, LogOut
} from 'lucide-react';
import { ConnectedAccount, SynapseUser } from '../types';
import { 
  isPasskeySupported, 
  registerWithPasskey, 
  loginWithPasskey 
} from '../utils/passkeyAuthService';
import { 
  loginWithSupabase, 
  registerWithSupabase, 
  signOutSynapseUser, 
  getStoredSynapseUser 
} from '../utils/supabaseAuthService';

interface AccountConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: ConnectedAccount | null;
  onConnectAccount: (account: ConnectedAccount | null) => void;
  synapseUser?: SynapseUser | null;
  onUpdateSynapseUser?: (user: SynapseUser | null) => void;
}

export default function AccountConnectModal({
  isOpen,
  onClose,
  currentAccount: _currentAccount,
  onConnectAccount,
  synapseUser: propSynapseUser,
  onUpdateSynapseUser,
}: AccountConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [signupMode, setSignupMode] = useState<'passkey' | 'email'>('passkey');

  // Active user state
  const [activeUser, setActiveUser] = useState<SynapseUser | null>(propSynapseUser || getStoredSynapseUser());

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup Form
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Statuses
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsLoading(false);
      setPasskeyAvailable(isPasskeySupported());
      const stored = propSynapseUser || getStoredSynapseUser();
      setActiveUser(stored);
    }
  }, [isOpen, propSynapseUser]);

  if (!isOpen) return null;

  // Handle Passkey Login
  const handlePasskeyLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await loginWithPasskey(loginEmail.trim() || undefined);
      if (res.success && res.user) {
        setActiveUser(res.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(res.user);
        onConnectAccount({
          provider: 'passkey',
          username: res.user.username,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl,
          connectedAt: Date.now(),
        });
        setSuccessMessage(res.message || 'Connexion Passkey réussie !');
        setTimeout(() => onClose(), 1200);
      } else {
        setErrorMessage(res.message || 'Authentification par Passkey échouée.');
      }
    } catch (err: any) {
      console.error('Passkey login error:', err);
      setErrorMessage(err?.message || 'Erreur lors de la connexion Passkey.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Classic Email Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMessage('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await loginWithSupabase(loginEmail, loginPassword);
      if (res.success && res.user) {
        setActiveUser(res.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(res.user);
        onConnectAccount({
          provider: 'email',
          username: res.user.username,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl,
          connectedAt: Date.now(),
        });
        setSuccessMessage(`Bienvenue, ${res.user.displayName || res.user.username} !`);
        setTimeout(() => onClose(), 1000);
      } else {
        setErrorMessage(res.message || 'Identifiants incorrects.');
      }
    } catch (err: any) {
      console.error('Email login error:', err);
      setErrorMessage(err?.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Passkey Registration
  const handlePasskeySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse e-mail valide.');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Veuillez choisir un pseudo.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await registerWithPasskey({
        email,
        firstName,
        lastName,
        username,
      });

      if (res.success && res.user) {
        setActiveUser(res.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(res.user);
        onConnectAccount({
          provider: 'passkey',
          username: res.user.username,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl,
          connectedAt: Date.now(),
        });
        setSuccessMessage(`Compte créé et Passkey liée avec succès !`);
        setTimeout(() => onClose(), 1500);
      } else {
        setErrorMessage(res.message || 'Échec de l\'enregistrement de la Passkey.');
      }
    } catch (err: any) {
      console.error('Passkey registration error:', err);
      setErrorMessage(err?.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Classic Email Registration
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Veuillez renseigner une adresse e-mail valide.');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Veuillez renseigner un pseudo.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await registerWithSupabase(email, password, username, firstName, lastName);
      if (res.success && res.user) {
        setActiveUser(res.user);
        if (onUpdateSynapseUser) onUpdateSynapseUser(res.user);
        onConnectAccount({
          provider: 'email',
          username: res.user.username,
          email: res.user.email,
          avatarUrl: res.user.avatarUrl,
          connectedAt: Date.now(),
        });
        setSuccessMessage('Compte créé avec succès !');
        setTimeout(() => onClose(), 1200);
      } else {
        setErrorMessage(res.message || 'Erreur lors de la création du compte.');
      }
    } catch (err: any) {
      console.error('Email registration error:', err);
      setErrorMessage(err?.message || 'Erreur lors de l\'inscription.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await signOutSynapseUser();
      setActiveUser(null);
      if (onUpdateSynapseUser) onUpdateSynapseUser(null);
      onConnectAccount(null);
      setSuccessMessage('Déconnexion effectuée.');
    } catch (err) {
      console.error('Signout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0a0a0f] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden max-h-[92vh] overflow-y-auto">
        
        {/* Background neon glows */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center p-2.5 text-cyan-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-futuristic uppercase tracking-wider text-white">
                Compte Auditeur
              </h3>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                Authentification E-mail & Passkey sécurisée
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fermer la modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Already Connected User View */}
        {activeUser ? (
          <div className="flex flex-col gap-6 relative z-10 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-zinc-950/80 border border-cyan-500/30 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-cyan-400/50 flex-shrink-0 bg-cyan-950/50 flex items-center justify-center">
                {activeUser.avatarUrl ? (
                  <img src={activeUser.avatarUrl} alt={activeUser.username} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-cyan-400" />
                )}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white font-futuristic truncate">
                    {activeUser.displayName || activeUser.username}
                  </span>
                  {activeUser.role === 'super-admin' && (
                    <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/40 text-[10px] font-mono font-bold uppercase">
                      Super Admin
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-zinc-400 truncate mt-0.5">
                  {activeUser.email}
                </span>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    {activeUser.authMethod === 'passkey' ? 'Passkey liée' : 'Connexion Email'}
                  </span>
                  <span className="text-[11px] font-mono text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20">
                    {activeUser.points || 0} XP
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-red-500/20 hover:text-red-400 border border-white/10 hover:border-red-500/40 text-zinc-300 font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Se déconnecter</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <span>Fermer</span>
              </button>
            </div>
          </div>
        ) : (
          /* Authentication Forms */
          <div className="relative z-10 flex flex-col gap-5">
            {/* Tabs: Connexion vs Inscription */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-900/80 border border-white/10">
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setErrorMessage(null); }}
                className={`py-2.5 px-4 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('signup'); setErrorMessage(null); }}
                className={`py-2.5 px-4 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'signup'
                    ? 'bg-gradient-to-r from-cyan-500 to-pink-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Inscription
              </button>
            </div>

            {/* TAB 1: CONNEXION */}
            {activeTab === 'login' && (
              <div className="flex flex-col gap-4 animate-fadeIn">
                {/* 1. Fast Passkey Login Button */}
                {passkeyAvailable && (
                  <div className="flex flex-col gap-2 p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-blue-950/20 border border-cyan-500/30">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase tracking-wider font-futuristic">
                          Connexion rapide par Passkey
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          Empreinte, Face ID, Clé FIDO2 ou Smartphone
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={isLoading}
                      className="mt-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Smartphone className="w-4 h-4" />
                      )}
                      <span>Se connecter avec ma Passkey</span>
                    </button>
                  </div>
                )}

                {/* Divider */}
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/10" />
                  <span className="flex-shrink mx-3 text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
                    Ou par e-mail classique
                  </span>
                  <div className="flex-grow border-t border-white/10" />
                </div>

                {/* Classic Email Login Form */}
                <form onSubmit={handleEmailLogin} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                      Adresse e-mail
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="votre-email@exemple.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none transition-all placeholder:text-zinc-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none transition-all placeholder:text-zinc-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-1 w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Se connecter</span>
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: INSCRIPTION */}
            {activeTab === 'signup' && (
              <div className="flex flex-col gap-4 animate-fadeIn">
                {/* Method selector: Passkey vs Email */}
                <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-900/60 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setSignupMode('passkey')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      signupMode === 'passkey'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Passkey (Recommandé)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupMode('email')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      signupMode === 'email'
                        ? 'bg-zinc-800 text-white border border-white/20'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>E-mail & Mot de passe</span>
                  </button>
                </div>

                {signupMode === 'passkey' ? (
                  /* Formulaire Inscription Passkey */
                  <form onSubmit={handlePasskeySignup} className="flex flex-col gap-3.5 animate-fadeIn">
                    <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-mono text-cyan-200/90 leading-relaxed">
                        Votre téléphone ou appareil va générer une clé biométrique sécurisée (Passkey). Vos informations (e-mail, prénom, nom, pseudo) seront enregistrées et liées à cette clé sans mot de passe à retenir.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                        Adresse e-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="auditeur@exemple.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Prénom
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Alex"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Dupont"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                        Pseudo d'auditeur *
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="SynapseLover"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
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
                  /* Formulaire Inscription E-mail Classique */
                  <form onSubmit={handleEmailSignup} className="flex flex-col gap-3 animate-fadeIn">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                        Adresse e-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="auditeur@exemple.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Prénom
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Alex"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Dupont"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                        Pseudo *
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="SynapseFan"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Mot de passe *
                        </label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                          Confirmer *
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-cyan-400 text-white text-xs font-mono outline-none placeholder:text-zinc-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="mt-2 w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      <span>Créer mon compte</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Authentification chiffrée WebAuthn & Supabase PostgreSQL</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
