import { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, X, Check, Copy, Share2, 
  ExternalLink, Radio, Disc3, Sparkles
} from 'lucide-react';
import { LikedTrack } from '../types';
import { useCoverColor } from '../utils/coverColorExtractor';
import { getOrCreateSharedFlyer, SharedFlyerRecord } from '../utils/sharedFlyersRegistry';

interface DigitalTrackFlyerProps {
  isOpen: boolean;
  onClose: () => void;
  track: LikedTrack | null;
  onListenLive?: (stationName?: string) => void;
  isStandalonePage?: boolean;
}

export default function DigitalTrackFlyer({
  isOpen,
  onClose,
  track,
  onListenLive,
  isStandalonePage = false,
}: DigitalTrackFlyerProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [flyerRecord, setFlyerRecord] = useState<SharedFlyerRecord | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if native Web Share is available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setCanShare(true);
    }
  }, []);

  // Whenever track changes, get or create the reusable canonical flyer record
  useEffect(() => {
    if (track) {
      const record = getOrCreateSharedFlyer(track);
      setFlyerRecord(record);
    } else {
      setFlyerRecord(null);
    }
  }, [track]);

  // Audio preview cleanup
  useEffect(() => {
    if (!isOpen || !track) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingPreview(false);
      setPreviewProgress(0);
    }
  }, [isOpen, track]);

  const coverColor = useCoverColor(
    track?.coverUrl || '',
    track?.title || '',
    track?.artist || ''
  );

  if (!isOpen || !track || !flyerRecord) return null;

  const shareUrl = flyerRecord.flyerUrl;

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
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${track.title} - ${track.artist}`,
          text: `Découvre "${track.title}" de ${track.artist} entendu sur Radio Synapse :`,
          url: shareUrl,
        });
      } catch {
        // user dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleTogglePreview = () => {
    const previewSrc = track.previewUrl || getFallbackPreviewUrl(track.title, track.artist);

    if (isPlayingPreview) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlayingPreview(false);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(previewSrc);
      audioRef.current = audio;
      audio.volume = 0.85;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setPreviewProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setIsPlayingPreview(false);
        setPreviewProgress(0);
      };

      audio.play().then(() => {
        setIsPlayingPreview(true);
      }).catch((err) => {
        console.warn('Preview playback failed', err);
      });
    }
  };

  const platforms = [
    {
      id: 'spotify',
      name: 'Spotify',
      action: 'Écouter sur Spotify',
      url: flyerRecord.spotifyUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/174/174872.png',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      buttonBg: 'hover:bg-emerald-950/60 hover:border-emerald-500/50',
      brandColor: '#1DB954',
    },
    {
      id: 'deezer',
      name: 'Deezer',
      action: 'Écouter sur Deezer',
      url: flyerRecord.deezerUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968856.png',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      buttonBg: 'hover:bg-purple-950/60 hover:border-purple-500/50',
      brandColor: '#A238FF',
    },
    {
      id: 'apple',
      name: 'Apple Music',
      action: 'Écouter sur Apple Music',
      url: flyerRecord.appleMusicUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/0/747.png',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      buttonBg: 'hover:bg-rose-950/60 hover:border-rose-500/50',
      brandColor: '#FC3C44',
    },
    {
      id: 'youtube',
      name: 'YouTube Music',
      action: 'Écouter sur YouTube Music',
      url: flyerRecord.youtubeUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
      buttonBg: 'hover:bg-red-950/60 hover:border-red-500/50',
      brandColor: '#FF0000',
    },
    {
      id: 'tidal',
      name: 'TIDAL',
      action: 'Écouter sur TIDAL',
      url: flyerRecord.tidalUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/732/732247.png',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      buttonBg: 'hover:bg-cyan-950/60 hover:border-cyan-500/50',
      brandColor: '#00FFFF',
    },
    {
      id: 'amazon',
      name: 'Amazon Music',
      action: 'Écouter sur Amazon Music',
      url: flyerRecord.amazonMusicUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968393.png',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      buttonBg: 'hover:bg-blue-950/60 hover:border-blue-500/50',
      brandColor: '#00A8E1',
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isStandalonePage) onClose();
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
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-2 relative z-10 select-none border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-400">
              <Disc3 className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-zinc-200">
                FLYER NUMÉRIQUE SMARTLINK
              </span>
              <span className="text-[9px] font-mono text-cyan-400">
                Lien permanent unifié • Toutes plateformes
              </span>
            </div>
          </div>

          {!isStandalonePage && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              aria-label="Fermer le flyer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable Flyer Content */}
        <div className="overflow-y-auto px-5 sm:px-6 py-4 flex flex-col gap-4 relative z-10 max-h-[80vh]">

          {/* Vinyl Release Artwork Hero Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-white/15 flex flex-col gap-3.5 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-4">
              
              {/* Spinning Vinyl & Artwork Cover Container */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                {/* Vinyl Record Peeking Out */}
                <div 
                  className={`absolute -right-3 top-1/2 -translate-y-1/2 w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-zinc-950 border-2 border-zinc-700 shadow-md flex items-center justify-center transition-transform duration-700 ${
                    isPlayingPreview ? 'rotate-180 translate-x-2' : ''
                  }`}
                  style={{
                    backgroundImage: 'repeating-radial-gradient(#18181b 0, #18181b 2px, #09090b 3px, #09090b 4px)'
                  }}
                >
                  <div className="w-6 h-6 rounded-full bg-pink-500/40 border border-pink-400 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-zinc-950" />
                  </div>
                </div>

                {/* Album Cover */}
                <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/20 shadow-2xl group z-10 bg-black">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={handleTogglePreview}
                    className="absolute inset-0 bg-black/50 hover:bg-black/75 flex items-center justify-center transition-all cursor-pointer text-white"
                    title={isPlayingPreview ? "Arrêter l'extrait" : "Écouter l'extrait (30s)"}
                  >
                    {isPlayingPreview ? (
                      <Pause className="w-7 h-7 fill-white" />
                    ) : (
                      <Play className="w-7 h-7 fill-white ml-0.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Track Metadata */}
              <div className="flex flex-col min-w-0 flex-1 text-left">
                <span className="text-base sm:text-lg font-bold text-white font-futuristic leading-tight truncate">
                  {track.title}
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-pink-400 uppercase tracking-wider truncate mt-0.5">
                  {track.artist}
                </span>
                {track.album && (
                  <span className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                    Album : {track.album}
                  </span>
                )}
                {track.stationName && (
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-cyan-300">
                    <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span>Découvert sur Radio Synapse ({track.stationName})</span>
                  </div>
                )}
              </div>
            </div>

            {/* 30s Audio Preview Progress */}
            {isPlayingPreview && (
              <div className="flex flex-col gap-1 pt-1.5 border-t border-white/10">
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-cyan-400 transition-all duration-150 rounded-full"
                    style={{ width: `${previewProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                  <span className="text-pink-400 font-bold">Extrait 30s Master en cours...</span>
                  <span>Audio HQ Synapse</span>
                </div>
              </div>
            )}
          </div>

          {/* Reusable Share Link Copy Box */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-2 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-300 text-left flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Lien de partage du titre :
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                Lien permanent
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full px-3 py-2 rounded-xl bg-black/90 border border-white/15 text-xs font-mono text-zinc-300 select-all focus:outline-none focus:border-cyan-400 truncate"
                />
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopyLink}
                className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 active:scale-95 ${
                  copied
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'bg-white/10 hover:bg-cyan-500/20 border-white/15 hover:border-cyan-400/50 text-white'
                }`}
                title="Copier le lien du flyer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copier</span>
                  </>
                )}
              </button>

              {/* Mobile Native Share */}
              {canShare && (
                <button
                  onClick={handleNativeShare}
                  className="p-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/35 border border-pink-500/40 text-pink-300 transition-all cursor-pointer active:scale-95 flex-shrink-0"
                  title="Partager"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Platform Direct Streaming Links (Deezer / Spotify / Apple Music, etc.) */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 text-left px-1">
              Écouter sur votre plateforme de streaming :
            </span>

            <div className="grid grid-cols-1 gap-2">
              {platforms.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3 rounded-2xl bg-zinc-900/80 border border-white/10 ${p.buttonBg} transition-all duration-200 flex items-center justify-between group/plat cursor-pointer shadow-sm`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center p-1.5 flex-shrink-0 group-hover/plat:scale-105 transition-transform">
                      <img
                        src={p.icon}
                        alt={p.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-white font-mono group-hover/plat:text-white transition-colors truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {p.action}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-mono font-bold text-white px-3 py-1 rounded-xl bg-white/10 group-hover/plat:bg-white/20 border border-white/10 flex items-center gap-1.5">
                      <span>Ouvrir</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover/plat:text-white transition-colors" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Live Radio Synapse Call To Action */}
          {onListenLive && (
            <button
              onClick={() => {
                onClose();
                onListenLive(track.stationName);
              }}
              className="mt-1 w-full p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900/90 to-zinc-900/90 border border-white/30 hover:border-white text-white font-futuristic font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.01] active:scale-95"
            >
              <Radio className="w-4 h-4 text-white animate-pulse" />
              <span>Écouter Radio Synapse en direct</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

function getFallbackPreviewUrl(title: string, artist: string): string {
  const samples = [
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo126/v4/4c/76/90/4c7690a2-25e2-8e36-53d3-703a95d7f1d4/mzaf_15783300588669528743.plus.aac.p.m4a',
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo125/v4/0c/33/c0/0c33c09b-1b03-f390-3bbd-c6a6552a48ea/mzaf_10334882194935406798.plus.aac.p.m4a',
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo115/v4/80/7e/ea/807eeaec-87d4-e6ed-3b7c-f8319e7bc445/mzaf_16480376170668902507.plus.aac.p.m4a',
  ];
  const hash = Math.abs(title.length + artist.length);
  return samples[hash % samples.length];
}
