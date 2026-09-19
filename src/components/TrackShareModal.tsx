import { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Share2, Sparkles, MessageSquare, 
  Send, Radio, Disc3, Instagram
} from 'lucide-react';
import { LikedTrack } from '../types';
import { useCoverColor } from '../utils/coverColorExtractor';
import { getOrCreateSharedFlyer, SharedFlyerRecord } from '../utils/sharedFlyersRegistry';
import MiniDiscStoryGenerator from './MiniDiscStoryGenerator';

interface TrackShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: LikedTrack | null;
}

export default function TrackShareModal({
  isOpen,
  onClose,
  track,
}: TrackShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [flyerRecord, setFlyerRecord] = useState<SharedFlyerRecord | null>(null);
  const [showStoryGenerator, setShowStoryGenerator] = useState(false);

  const coverColor = useCoverColor(
    track?.coverUrl || '',
    track?.title || '',
    track?.artist || ''
  );

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setCanNativeShare(true);
    }
  }, []);

  useEffect(() => {
    if (track) {
      const record = getOrCreateSharedFlyer(track);
      setFlyerRecord(record);
    } else {
      setFlyerRecord(null);
    }
  }, [track]);

  if (!isOpen || !track || !flyerRecord) return null;

  const shareUrl = flyerRecord.flyerUrl;
  const shareText = `Écoute "${track.title}" de ${track.artist} découvert sur Radio Synapse : ${shareUrl}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${track.title} - ${track.artist}`,
          text: `Découvre "${track.title}" de ${track.artist} sur Radio Synapse :`,
          url: shareUrl,
        });
      } catch {
        // Dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const socialChannels = [
    {
      id: 'sms',
      name: 'SMS / Messages',
      icon: MessageSquare,
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30',
      action: () => {
        window.open(`sms:?&body=${encodedText}`, '_blank');
      },
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: Send,
      color: 'bg-[#25D366]/20 text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/30',
      action: () => {
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
      },
    },
    {
      id: 'snapchat',
      name: 'Snapchat',
      icon: Sparkles,
      color: 'bg-[#FFFC00]/20 text-yellow-300 border-[#FFFC00]/40 hover:bg-[#FFFC00]/30',
      action: () => {
        // Open story generator for snapchat or web share
        setShowStoryGenerator(true);
      },
    },
    {
      id: 'instagram-story',
      name: 'Instagram Story',
      icon: Instagram,
      color: 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border-pink-500/40 hover:from-pink-500/30 hover:to-purple-500/30',
      action: () => {
        setShowStoryGenerator(true);
      },
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Share2,
      color: 'bg-[#1877F2]/20 text-[#1877F2] border-[#1877F2]/40 hover:bg-[#1877F2]/30',
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
      },
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: Send,
      color: 'bg-[#0088cc]/20 text-[#0088cc] border-[#0088cc]/40 hover:bg-[#0088cc]/30',
      action: () => {
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`Écoute ${track.title} - ${track.artist}`)}`, '_blank');
      },
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      icon: Share2,
      color: 'bg-white/10 text-white border-white/20 hover:bg-white/20',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
      },
    },
  ];

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div 
          className="relative w-full max-w-lg rounded-3xl bg-[#09090e] border border-white/15 shadow-[0_25px_90px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col my-auto"
          style={{
            boxShadow: `0 0 65px ${coverColor}25, 0 30px 90px rgba(0,0,0,0.95)`
          }}
        >
          {/* Ambient atmospheric glow */}
          <div 
            className="absolute -top-32 -left-32 -right-32 h-72 opacity-30 blur-3xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${coverColor} 0%, transparent 70%)`
            }}
          />

          {/* Top Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-3 relative z-10 select-none border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-400">
                <Disc3 className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-200">
                  PARTAGER LE TITRE
                </span>
                <span className="text-[9px] font-mono text-zinc-400">
                  Flyer permanent universel & Générateur Story
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="overflow-y-auto px-5 sm:px-6 py-4 flex flex-col gap-4 relative z-10 max-h-[82vh]">

            {/* Track Mini Hero Card */}
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/15 flex items-center gap-3.5 shadow-md">
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/20 flex-shrink-0 bg-zinc-900">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1 text-left">
                <span className="text-sm sm:text-base font-bold text-white font-futuristic leading-tight truncate">
                  {track.title}
                </span>
                <span className="text-xs font-mono font-bold text-pink-400 uppercase tracking-wider truncate mt-0.5">
                  {track.artist}
                </span>
                {track.stationName && (
                  <span className="text-[10px] font-mono text-zinc-400 truncate mt-0.5 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5" />
                    {track.stationName}
                  </span>
                )}
              </div>
            </div>

            {/* Permanent Link Input & Copy */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300 text-left flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  Lien permanent du flyer :
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  Multi-plateformes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full px-3 py-2 rounded-xl bg-black/90 border border-white/15 text-xs font-mono text-zinc-300 select-all focus:outline-none focus:border-white truncate"
                  />
                </div>

                {/* Copy Button */}
                <button
                  onClick={handleCopyLink}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                    copied
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                      : 'bg-white/10 hover:bg-white/20 border-white/15 hover:border-white/30 text-white'
                  }`}
                  title="Copier le lien"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-white" />
                      <span>Copier</span>
                    </>
                  )}
                </button>

                {/* Native Share */}
                {canNativeShare && (
                  <button
                    onClick={handleNativeShare}
                    className="p-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/35 border border-pink-500/40 text-pink-300 transition-all cursor-pointer active:scale-95 flex-shrink-0"
                    title="Partage Système"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Special Section: Social Story Generator (Instagram / Snap / TikTok) */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 border border-pink-500/40 flex flex-col gap-2.5 text-left shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-futuristic font-bold text-pink-300 uppercase">
                  <Instagram className="w-4 h-4 text-pink-400" />
                  <span>Partager en Story Réseaux Sociaux</span>
                </div>
                <span className="text-[9px] font-mono text-zinc-200 font-bold bg-white/10 px-2 py-0.5 rounded-full border border-white/20">
                  Format 9:16
                </span>
              </div>

              <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                Générez un visuel haute définition du boîtier <strong>Mini-Disc</strong> avec la pochette et l'extrait audio 30s pour votre Story Instagram, Snapchat ou TikTok :
              </p>

              <button
                onClick={() => setShowStoryGenerator(true)}
                className="mt-1 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Créer le Visuel Story Mini-Disc</span>
              </button>
            </div>

            {/* Quick Share Buttons by Messenger / SMS / Social Network */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 text-left px-1">
                Partager par message ou réseau social :
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {socialChannels.map((chan) => {
                  const IconComp = chan.icon;
                  return (
                    <button
                      key={chan.id}
                      onClick={chan.action}
                      className={`p-3 rounded-2xl border ${chan.color} transition-all duration-150 flex items-center gap-2.5 cursor-pointer active:scale-95 text-left`}
                    >
                      <IconComp className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs font-mono font-bold truncate">
                        {chan.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* MiniDisc 9:16 Story Generator Submodal */}
      <MiniDiscStoryGenerator
        isOpen={showStoryGenerator}
        onClose={() => setShowStoryGenerator(false)}
        track={track}
        shareUrl={shareUrl}
      />
    </>
  );
}
