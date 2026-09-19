import { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, X, Check, Copy, Share2, 
  ExternalLink, Radio, Disc3
} from 'lucide-react';
import { LikedTrack } from '../types';
import { useCoverColor } from '../utils/coverColorExtractor';

interface SmartLinkShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: LikedTrack | null;
  onListenLive?: (stationName?: string) => void;
}

export default function SmartLinkShareModal({
  isOpen,
  onClose,
  track,
  onListenLive,
}: SmartLinkShareModalProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if native Web Share is available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setCanShare(true);
    }
  }, []);

  // Cleanup audio preview on close or track change
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

  if (!isOpen || !track) return null;

  // Generate the full SmartLink URL that can be shared and opened anywhere
  const getSmartShareUrl = (): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://radiosynapse.fr';
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    
    const params = new URLSearchParams();
    params.set('share_track', track.title);
    params.set('artist', track.artist);
    if (track.album) params.set('album', track.album);
    if (track.coverUrl) params.set('cover', track.coverUrl);
    if (track.stationName) params.set('station', track.stationName);
    if (track.previewUrl) params.set('preview', track.previewUrl);
    if (track.deezerUrl) params.set('deezer', track.deezerUrl);
    if (track.spotifyUrl) params.set('spotify', track.spotifyUrl);
    if (track.appleMusicUrl) params.set('apple', track.appleMusicUrl);
    if (track.youtubeUrl) params.set('yt', track.youtubeUrl);

    return `${origin}${path}?${params.toString()}`;
  };

  const shareUrl = getSmartShareUrl();

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers or iframe context
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
        // Ignored if user dismissed
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

  const deezerLink = track.deezerUrl || `https://www.deezer.com/search/${encodeURIComponent(`${track.artist} ${track.title}`)}`;
  const spotifyLink = track.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(`${track.artist} ${track.title}`)}`;
  const appleMusicLink = track.appleMusicUrl || `https://music.apple.com/fr/search?term=${encodeURIComponent(`${track.artist} ${track.title}`)}`;
  const youtubeMusicLink = track.youtubeUrl || `https://music.youtube.com/search?q=${encodeURIComponent(`${track.artist} ${track.title}`)}`;
  const tidalLink = `https://listen.tidal.com/search?q=${encodeURIComponent(`${track.artist} ${track.title}`)}`;
  const amazonMusicLink = `https://music.amazon.fr/search/${encodeURIComponent(`${track.artist} ${track.title}`)}`;

  const platforms = [
    {
      id: 'deezer',
      name: 'Deezer',
      action: 'Écouter sur Deezer',
      url: deezerLink,
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968856.png',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      buttonBg: 'hover:bg-purple-950/50 hover:border-purple-500/50',
    },
    {
      id: 'spotify',
      name: 'Spotify',
      action: 'Écouter sur Spotify',
      url: spotifyLink,
      icon: 'https://cdn-icons-png.flaticon.com/512/174/174872.png',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      buttonBg: 'hover:bg-emerald-950/50 hover:border-emerald-500/50',
    },
    {
      id: 'apple',
      name: 'Apple Music',
      action: 'Écouter sur Apple Music',
      url: appleMusicLink,
      icon: 'https://cdn-icons-png.flaticon.com/512/0/747.png',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      buttonBg: 'hover:bg-rose-950/50 hover:border-rose-500/50',
    },
    {
      id: 'youtube',
      name: 'YouTube Music',
      action: 'Écouter sur YouTube Music',
      url: youtubeMusicLink,
      icon: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
      buttonBg: 'hover:bg-red-950/50 hover:border-red-500/50',
    },
    {
      id: 'tidal',
      name: 'TIDAL',
      action: 'Écouter sur TIDAL',
      url: tidalLink,
      icon: 'https://cdn-icons-png.flaticon.com/512/732/732247.png',
      badgeColor: 'bg-zinc-800 text-zinc-200 border-zinc-700',
      buttonBg: 'hover:bg-zinc-800 hover:border-zinc-700',
    },
    {
      id: 'amazon',
      name: 'Amazon Music',
      action: 'Écouter sur Amazon Music',
      url: amazonMusicLink,
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968393.png',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      buttonBg: 'hover:bg-blue-950/50 hover:border-blue-500/50',
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-[#09090d] border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          boxShadow: `0 0 60px ${coverColor}25, 0 25px 80px rgba(0,0,0,0.9)`
        }}
      >
        {/* Glow backdrop with track artwork */}
        <div 
          className="absolute -top-24 -left-24 -right-24 h-64 opacity-25 blur-3xl pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${coverColor} 0%, transparent 70%)`
          }}
        />

        {/* Top Header bar with Close Button */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-2 relative z-10 select-none">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-400">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">
              SMARTLINK • TOUTES LES PLATEFORMES
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-5 sm:px-6 pb-6 pt-2 flex flex-col gap-4 relative z-10">

          {/* Hero Track Card (Deezer / Songlink style) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-black/60 border border-white/10 flex flex-col gap-3.5 shadow-md relative overflow-hidden">
            <div className="flex items-center gap-3.5">
              {/* Artwork with 30s preview play button */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-white/20 flex-shrink-0 shadow-lg group">
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handleTogglePreview}
                  className="absolute inset-0 bg-black/50 hover:bg-black/70 flex items-center justify-center transition-all cursor-pointer text-white"
                  title={isPlayingPreview ? "Arrêter l'extrait" : "Écouter l'extrait (30s)"}
                >
                  {isPlayingPreview ? (
                    <Pause className="w-6 h-6 fill-white" />
                  ) : (
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  )}
                </button>
              </div>

              {/* Info */}
              <div className="flex flex-col min-w-0 flex-1 text-left">
                <span className="text-base sm:text-lg font-bold text-white font-futuristic leading-snug truncate">
                  {track.title}
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-pink-400 uppercase tracking-wider truncate mt-0.5">
                  {track.artist}
                </span>
                {track.stationName && (
                  <span className="text-[10px] font-mono text-zinc-400 mt-1 flex items-center gap-1">
                    <Radio className="w-3 h-3 text-zinc-300" />
                    Entendu sur Radio Synapse ({track.stationName})
                  </span>
                )}
              </div>
            </div>

            {/* Audio 30s preview waveform / progress bar */}
            {isPlayingPreview && (
              <div className="flex flex-col gap-1 pt-1">
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-150 rounded-full"
                    style={{ width: `${previewProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                  <span className="text-pink-400 font-bold">Extrait 30s en cours...</span>
                  <span>Audio HQ Synapse</span>
                </div>
              </div>
            )}
          </div>

          {/* Share Link Copy Box with One-Click Button */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-2 shadow-inner">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 text-left flex items-center gap-1.5">
              <Disc3 className="w-3.5 h-3.5 text-white" />
              Lien de partage unique multi-plateforme :
            </span>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full px-3 py-2 rounded-xl bg-black/80 border border-white/10 text-xs font-mono text-zinc-300 select-all focus:outline-none focus:border-white truncate"
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
                title="Copier le lien de partage"
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

              {/* Native Share button on mobile */}
              {canShare && (
                <button
                  onClick={handleNativeShare}
                  className="p-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/35 border border-pink-500/40 text-pink-300 transition-all cursor-pointer active:scale-95 flex-shrink-0"
                  title="Partager via mes applications"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Direct Platform Links Section (Deezer style list) */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 text-left px-1">
              Choisir votre application d'écoute :
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
                    <img
                      src={p.icon}
                      alt={p.name}
                      className="w-6 h-6 object-contain flex-shrink-0"
                    />
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-white font-mono group-hover/plat:text-zinc-200 transition-colors truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {p.action}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-mono font-bold text-white px-3 py-1 rounded-xl bg-white/10 group-hover/plat:bg-white/20 border border-white/10 flex items-center gap-1.5">
                      <span>Écouter</span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover/plat:text-white transition-colors" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Radio Synapse Live Player Call To Action */}
          {onListenLive && (
            <button
              onClick={() => {
                onClose();
                onListenLive(track.stationName);
              }}
              className="mt-2 w-full p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-white font-futuristic font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.01] active:scale-95"
            >
              <Radio className="w-4 h-4 text-zinc-300 animate-pulse" />
              <span>Écouter la radio en direct sur Radio Synapse</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// Fallback preview audio if previewUrl is missing
function getFallbackPreviewUrl(title: string, artist: string): string {
  const samples = [
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo126/v4/4c/76/90/4c7690a2-25e2-8e36-53d3-703a95d7f1d4/mzaf_15783300588669528743.plus.aac.p.m4a',
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo125/v4/0c/33/c0/0c33c09b-1b03-f390-3bbd-c6a6552a48ea/mzaf_10334882194935406798.plus.aac.p.m4a',
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo115/v4/80/7e/ea/807eeaec-87d4-e6ed-3b7c-f8319e7bc445/mzaf_16480376170668902507.plus.aac.p.m4a',
  ];
  const hash = Math.abs(title.length + artist.length);
  return samples[hash % samples.length];
}
