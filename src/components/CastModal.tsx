import { X, Tv, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CastService, CastSessionState } from '../utils/castService';

interface CastModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  audioElement: HTMLAudioElement | null;
}

export default function CastModal({
  isOpen,
  onClose,
  accentColor,
  audioElement
}: CastModalProps) {
  const [castState, setCastState] = useState<CastSessionState>({
    connected: false,
    deviceName: null,
    castType: null,
  });

  const [castAppId, setCastAppId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('google_cast_app_id') || CastService.getCastAppId();
    }
    return '0E724BF5';
  });
  const [showIdSettings, setShowIdSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Monitor connection states and loading of casting APIs
  useEffect(() => {
    if (!isOpen) return;

    // Proactively load Chromecast/Google Cast if possible
    CastService.loadGoogleCastSDK();

    const unsubscribe = CastService.addListener((state) => {
      setCastState(state);
      if (state.connected) {
        setErrorMessage(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const handleSaveAppId = (id: string) => {
    setCastAppId(id);
    CastService.setCastAppId(id);
    setErrorMessage(null);
  };

  if (!isOpen) return null;

  const handleDeviceTrigger = async () => {
    setErrorMessage(null);
    const ok = await CastService.promptCast(audioElement);
    if (ok) {
      onClose();
    } else {
      setErrorMessage("Échec de connexion Cast (session_error)");
    }
  };

  const handleDisconnect = () => {
    CastService.disconnect();
    if (audioElement) {
      audioElement.play().catch(() => {});
    }
    onClose();
  };

  return (
    <div 
      id="cast-modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in cursor-pointer"
    >
      <div 
        id="cast-modal-panel" 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm p-6 relative overflow-hidden flex flex-col gap-5 shadow-[0_30px_70px_rgba(0,0,0,0.95)] border border-white/10 rounded-[28px] bg-[#09090b]/98"
      >
        {/* Soft background glow */}
        <div 
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-15 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />

        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold tracking-widest font-mono text-zinc-300 uppercase">
              DIFFUSION AUDIO
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection State View */}
        {castState.connected ? (
          /* Active Cast Connection View */
          <div className="flex flex-col gap-4 text-center py-1">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <Wifi className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest mt-1">
                DIFFUSION EN COURS
              </span>
            </div>

            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                Appareil connecté
              </span>
              <span className="text-base font-bold text-white block">
                {castState.deviceName || "Appareil externe"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              Arrêter la diffusion
            </button>
          </div>
        ) : (
          /* Available Connection View */
          <div className="flex flex-col gap-4">
            <div className="text-center py-2">
              <p className="text-xs text-zinc-400 font-mono uppercase tracking-wide leading-relaxed">
                PROJETER LE FLUX AUDIO SUR VOTRE TÉLÉVISEUR OU ENCEINTE CONNECTÉE
              </p>
            </div>

            <button
              type="button"
              onClick={handleDeviceTrigger}
              className="w-full p-4 rounded-2xl border text-center transition-all duration-300 cursor-pointer bg-white/[0.03] border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.06] hover:shadow-[0_0_20px_rgba(6,182,212,0.12)] flex items-center justify-center gap-2.5 group active:scale-[0.98]"
            >
              <Wifi className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors uppercase tracking-wider">
                Rechercher un appareil
              </span>
            </button>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex flex-col gap-1 text-left">
                <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-wide">
                  ⚠️ Erreur Cast ({errorMessage})
                </span>
                <span className="text-[9px] text-zinc-400 leading-normal">
                  Chrome signale que l'App ID <code className="text-amber-300">{castAppId}</code> n'a pas pu charger la page de votre Receiver TV. Vérifiez que l'URL du Receiver dans votre console Google Cast pointe bien vers <code className="text-cyan-300">https://.../receiver.html</code>.
                </span>
              </div>
            )}

            {/* If in Preview / iframe notice */}
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1.5 text-center">
              <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wide">
                Astuce Google Chrome :
              </span>
              <span className="text-[10px] text-zinc-500 leading-tight">
                Vous pouvez également cliquer sur les <strong className="text-zinc-300">trois petits points (⋮)</strong> en haut à droite de Chrome &gt; <strong className="text-cyan-400">Caster...</strong> pour sélectionner votre Freebox.
              </span>
            </div>

            {/* Custom Google Cast App ID & Mode Setup */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowIdSettings(!showIdSettings)}
                className="text-[10px] font-mono text-zinc-400 hover:text-cyan-400 transition-colors uppercase tracking-wider block w-full text-center py-1 cursor-pointer"
              >
                {showIdSettings ? '▲ Masquer paramètres du Receiver' : '⚙️ Configurer Receiver Google Cast'}
              </button>

              {showIdSettings && (
                <div className="mt-1 flex flex-col gap-2.5 p-3 bg-black/50 border border-white/10 rounded-xl">
                  <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-wide">
                    Mode de Receiver Google Cast :
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveAppId('CC1AD845')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-mono font-bold uppercase border transition-all cursor-pointer ${
                        castAppId === 'CC1AD845' || !castAppId
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Universel (CC1AD845)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveAppId(castAppId && castAppId !== 'CC1AD845' ? castAppId : '0E724BF5')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-mono font-bold uppercase border transition-all cursor-pointer ${
                        castAppId && castAppId !== 'CC1AD845'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Personnalisé
                    </button>
                  </div>

                  {castAppId && castAppId !== 'CC1AD845' && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <label htmlFor="cast-app-id-input" className="text-[9px] font-mono text-zinc-400 uppercase tracking-wide">
                        ID Application Custom Web Receiver :
                      </label>
                      <input
                        id="cast-app-id-input"
                        type="text"
                        placeholder="Ex: 0E724BF5"
                        value={castAppId}
                        onChange={(e) => handleSaveAppId(e.target.value.trim().toUpperCase())}
                        className="w-full bg-black/80 border border-white/15 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-zinc-600 outline-none uppercase tracking-widest"
                      />
                    </div>
                  )}

                  <p className="text-[8px] font-mono text-zinc-400 leading-tight">
                    💡 Si vous obtenez « Échec de la diffusion », l'App ID personnalisé n'est pas publié sur la console Google Cast. Choisissez <strong>Mode Universel (CC1AD845)</strong> pour diffuser sur votre TV sans restriction !
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Minimal Footer */}
        <div className="text-[8px] font-mono text-zinc-600 text-center uppercase tracking-widest">
          Radio Synapse Wireless Node
        </div>
      </div>
    </div>
  );
}
