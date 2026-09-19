import { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Radio, Copy, Check, 
  ExternalLink, Sparkles, Volume2, ArrowRight
} from 'lucide-react';
import { LikedTrack } from '../types';
import { useCoverColor } from '../utils/coverColorExtractor';
import { getOrCreateSharedFlyer, SharedFlyerRecord } from '../utils/sharedFlyersRegistry';
import BrandLogo from './BrandLogo';

interface StandaloneTrackFlyerPageProps {
  track: LikedTrack;
  onLaunchRadioApp: (stationName?: string) => void;
}

export default function StandaloneTrackFlyerPage({
  track,
  onLaunchRadioApp,
}: StandaloneTrackFlyerPageProps) {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [flyerRecord, setFlyerRecord] = useState<SharedFlyerRecord | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const coverColor = useCoverColor(track.coverUrl, track.title, track.artist);

  useEffect(() => {
    const record = getOrCreateSharedFlyer(track);
    setFlyerRecord(record);
  }, [track]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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
        console.warn('Audio play failed', err);
      });
    }
  };

  const shareUrl = flyerRecord?.flyerUrl || (typeof window !== 'undefined' ? window.location.href : '');

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const platforms = flyerRecord ? [
    {
      id: 'deezer',
      name: 'Deezer',
      action: 'Écouter sur Deezer',
      url: flyerRecord.deezerUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968856.png',
      brandColor: '#A238FF',
      buttonHover: 'hover:border-purple-500/60 hover:bg-purple-950/40',
    },
    {
      id: 'spotify',
      name: 'Spotify',
      action: 'Écouter sur Spotify',
      url: flyerRecord.spotifyUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/174/174872.png',
      brandColor: '#1DB954',
      buttonHover: 'hover:border-emerald-500/60 hover:bg-emerald-950/40',
    },
    {
      id: 'apple',
      name: 'Apple Music',
      action: 'Écouter sur Apple Music',
      url: flyerRecord.appleMusicUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/0/747.png',
      brandColor: '#FC3C44',
      buttonHover: 'hover:border-rose-500/60 hover:bg-rose-950/40',
    },
    {
      id: 'youtube',
      name: 'YouTube Music',
      action: 'Écouter sur YouTube Music',
      url: flyerRecord.youtubeUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
      brandColor: '#FF0000',
      buttonHover: 'hover:border-red-500/60 hover:bg-red-950/40',
    },
    {
      id: 'tidal',
      name: 'TIDAL',
      action: 'Écouter sur TIDAL',
      url: flyerRecord.tidalUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/732/732247.png',
      brandColor: '#00FFFF',
      buttonHover: 'hover:border-white/30 hover:bg-zinc-800',
    },
    {
      id: 'amazon',
      name: 'Amazon Music',
      action: 'Écouter sur Amazon Music',
      url: flyerRecord.amazonMusicUrl,
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968393.png',
      brandColor: '#00A8E1',
      buttonHover: 'hover:border-blue-500/60 hover:bg-blue-950/40',
    },
  ] : [];

  return (
    <div 
      className="min-h-screen w-full bg-[#05060b] text-white flex flex-col justify-between relative overflow-x-hidden selection:bg-white selection:text-black font-sans"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 20%, ${coverColor}25 0%, transparent 60%), radial-gradient(circle at 80% 80%, #00f2ff12 0%, transparent 50%)`
      }}
    >
      {/* Top Header Bar */}
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" withStar={true} />
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-sm font-futuristic font-bold tracking-widest text-white uppercase">
              RADIO SYNAPSE
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              SMARTLINK UNIVERSEL
            </span>
          </div>
        </div>

        <button
          onClick={() => onLaunchRadioApp(track.stationName)}
          className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-md"
        >
          <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
          <span className="hidden sm:inline">Écouter la radio</span>
          <span className="sm:hidden">Radio Live</span>
        </button>
      </header>

      {/* Main Standalone Flyer Card */}
      <main className="w-full max-w-md mx-auto px-4 py-4 sm:py-6 flex-1 flex flex-col justify-center relative z-10">
        <div 
          className="w-full rounded-3xl bg-zinc-950/85 backdrop-blur-2xl border border-white/15 p-5 sm:p-7 shadow-[0_20px_80px_rgba(0,0,0,0.9)] flex flex-col gap-5 relative overflow-hidden"
          style={{
            boxShadow: `0 0 50px ${coverColor}30, 0 25px 80px rgba(0,0,0,0.85)`
          }}
        >
          {/* Subtle glow border aura */}
          <div 
            className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-40 pointer-events-none"
            style={{ backgroundColor: coverColor }}
          />

          {/* Album Artwork & Play Preview Overlay */}
          <div className="flex flex-col items-center gap-4 text-center">
            
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl group bg-black">
              {/* Cover Image */}
              <img
                src={track.coverUrl}
                alt={track.title}
                className="w-full h-full object-cover"
              />

              {/* Central Play/Pause Preview Button */}
              <button
                onClick={handleTogglePreview}
                className="absolute inset-0 bg-black/45 hover:bg-black/60 transition-all flex items-center justify-center cursor-pointer group-hover:scale-105"
                title={isPlayingPreview ? "Arrêter l'extrait" : "Écouter l'extrait audio (30s)"}
              >
                <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-xl group-hover:bg-white/25 transition-all">
                  {isPlayingPreview ? (
                    <Pause className="w-8 h-8 fill-white text-white" />
                  ) : (
                    <Play className="w-8 h-8 fill-white text-white ml-1" />
                  )}
                </div>
              </button>

              {/* Mini tag on artwork */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 border border-white/20 text-[9px] font-mono text-zinc-300">
                Extrait 30s
              </div>
            </div>

            {/* Track Info */}
            <div className="flex flex-col items-center max-w-full px-2">
              <h1 className="text-xl sm:text-2xl font-bold font-futuristic text-white leading-tight break-words">
                {track.title}
              </h1>
              <p className="text-sm sm:text-base font-mono font-bold text-pink-400 uppercase tracking-wider mt-1">
                {track.artist}
              </p>
              {track.album && (
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Album : {track.album}
                </p>
              )}
            </div>

            {/* Audio Preview Scrubber Bar */}
            {isPlayingPreview && (
              <div className="w-full flex flex-col gap-1 px-1">
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-150 rounded-full"
                    style={{ width: `${previewProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-pink-400 font-bold flex items-center gap-1">
                    <Volume2 className="w-3 h-3 animate-pulse" />
                    Lecture en cours...
                  </span>
                  <span>Audio Master Synapse</span>
                </div>
              </div>
            )}

          </div>

          {/* Section: Platform Streaming Links (Universal Multi-Link Style) */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 text-left px-1">
              Écouter le morceau complet :
            </span>

            <div className="grid grid-cols-1 gap-2">
              {platforms.map((plat) => (
                <a
                  key={plat.id}
                  href={plat.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 ${plat.buttonHover} transition-all duration-200 flex items-center justify-between group cursor-pointer shadow-sm active:scale-98`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center p-1.5 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <img
                        src={plat.icon}
                        alt={plat.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-white font-mono group-hover:text-zinc-200 transition-colors truncate">
                        {plat.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {plat.action}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-white px-3 py-1.5 rounded-xl bg-white/10 group-hover:bg-white/20 border border-white/15 flex items-center gap-1.5 flex-shrink-0">
                    <span>Ouvrir</span>
                    <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-white" />
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Copy Link Section */}
          <div className="p-3 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between gap-2">
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="text-[10px] font-mono text-zinc-400 truncate">
                Lien permanent SmartLink :
              </span>
              <span className="text-xs font-mono text-zinc-200 truncate">
                {shareUrl}
              </span>
            </div>

            <button
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                copied
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                  : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>

          {/* Launch Radio Synapse Live Button */}
          <button
            onClick={() => onLaunchRadioApp(track.stationName)}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black border border-white text-white font-futuristic text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg hover:scale-[1.01] active:scale-95"
          >
            <Radio className="w-4 h-4 text-black animate-pulse" />
            <span>Découvrir Radio Synapse Live</span>
            <ArrowRight className="w-4 h-4 text-pink-400" />
          </button>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto px-4 py-4 text-center text-zinc-500 text-[11px] font-mono border-t border-white/5 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span>Radio Synapse • Flyer Numérique Multi-Plateformes</span>
        </div>
        <span>Propulsé par le système SmartLink Synapse</span>
      </footer>
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
