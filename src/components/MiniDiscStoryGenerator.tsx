import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Download, Share2, Play, Pause, 
  Copy, Check, Radio, Instagram
} from 'lucide-react';
import { LikedTrack } from '../types';
import { useCoverColor } from '../utils/coverColorExtractor';

interface MiniDiscStoryGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  track: LikedTrack;
  shareUrl: string;
}

export default function MiniDiscStoryGenerator({
  isOpen,
  onClose,
  track,
  shareUrl,
}: MiniDiscStoryGeneratorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const coverColor = useCoverColor(track.coverUrl, track.title, track.artist);

  // Audio preview cleanup
  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [isOpen]);

  const toggleAudio = () => {
    const previewSrc = track.previewUrl || getFallbackPreviewUrl(track.title, track.artist);

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(previewSrc);
      audioRef.current = audio;
      audio.volume = 0.9;
      audio.onended = () => setIsPlaying(false);
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Generate 1080x1920 High-Res Story Canvas Image
  const generateStoryCanvasBlob = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // 1. Futuristic Dark Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
      bgGrad.addColorStop(0, '#040407');
      bgGrad.addColorStop(0.3, '#0b0c16');
      bgGrad.addColorStop(0.7, '#070810');
      bgGrad.addColorStop(1, '#020204');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      // 2. Radial Glow matching Cover Color
      const radialGrad = ctx.createRadialGradient(540, 850, 50, 540, 850, 600);
      radialGrad.addColorStop(0, `${coverColor}55`);
      radialGrad.addColorStop(0.6, `${coverColor}15`);
      radialGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Top decorative stars / particles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 40; i++) {
        const px = (Math.sin(i * 99) * 0.5 + 0.5) * 1080;
        const py = (Math.cos(i * 33) * 0.5 + 0.5) * 1920;
        const pr = (i % 3) + 1.5;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Top Radio Synapse Story Header
      ctx.fillStyle = '#00f2ff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RADIO SYNAPSE • ON AIR', 540, 180);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '24px monospace';
      ctx.fillText(track.stationName ? `STATION DIRECT : ${track.stationName.toUpperCase()}` : 'STATION DIRECT 24/7', 540, 225);

      // 4. Draw Mini-Disc Cassette Case
      const caseX = 140;
      const caseY = 320;
      const caseW = 800;
      const caseH = 860;
      const caseRadius = 40;

      // Drop shadow for casing
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 30;

      // Transparent Acrylic Casing Body
      ctx.fillStyle = 'rgba(18, 20, 28, 0.92)';
      drawRoundedRect(ctx, caseX, caseY, caseW, caseH, caseRadius);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Acrylic border with neon edge
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      drawRoundedRect(ctx, caseX, caseY, caseW, caseH, caseRadius);
      ctx.stroke();

      // Metallic Casing Top Shutter (Sony/TDK MiniDisc Style)
      const shutterGrad = ctx.createLinearGradient(caseX, caseY, caseX + caseW, caseY);
      shutterGrad.addColorStop(0, '#52525b');
      shutterGrad.addColorStop(0.2, '#a1a1aa');
      shutterGrad.addColorStop(0.5, '#e4e4e7');
      shutterGrad.addColorStop(0.8, '#a1a1aa');
      shutterGrad.addColorStop(1, '#52525b');
      ctx.fillStyle = shutterGrad;
      drawRoundedRect(ctx, caseX + 30, caseY + 25, caseW - 60, 110, 20);
      ctx.fill();

      // Shutter arrow / laser mark
      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('◀ INSERT THIS END', caseX + 60, caseY + 88);

      ctx.textAlign = 'right';
      ctx.fillText('SYNAPSE MD-90 OPTICAL DISC', caseX + caseW - 60, caseY + 88);

      // Load Cover Artwork
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw album cover inside the cartridge window
        const coverX = caseX + 70;
        const coverY = caseY + 170;
        const coverSize = 400;

        ctx.save();
        drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 24);
        ctx.clip();
        ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
        ctx.restore();

        // Cover border
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 24);
        ctx.stroke();

        // Right side of MiniDisc: Optical Disc Window
        const discCenterX = caseX + 600;
        const discCenterY = caseY + 370;
        const discRadius = 140;

        // Shiny reflective disc circle
        const discGrad = ctx.createRadialGradient(discCenterX, discCenterY, 20, discCenterX, discCenterY, discRadius);
        discGrad.addColorStop(0, '#18181b');
        discGrad.addColorStop(0.4, '#27272a');
        discGrad.addColorStop(0.7, '#3f3f46');
        discGrad.addColorStop(0.85, '#00f2ff');
        discGrad.addColorStop(1, '#ff007f');

        ctx.fillStyle = discGrad;
        ctx.beginPath();
        ctx.arc(discCenterX, discCenterY, discRadius, 0, Math.PI * 2);
        ctx.fill();

        // Disc Center Spindle
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(discCenterX, discCenterY, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e4e4e7';
        ctx.beginPath();
        ctx.arc(discCenterX, discCenterY, 20, 0, Math.PI * 2);
        ctx.fill();

        // Holographic Synapse Badge at bottom of Case
        const badgeY = caseY + 620;
        const holoGrad = ctx.createLinearGradient(caseX + 50, badgeY, caseX + caseW - 50, badgeY);
        holoGrad.addColorStop(0, 'rgba(0, 242, 255, 0.25)');
        holoGrad.addColorStop(0.5, 'rgba(255, 0, 127, 0.25)');
        holoGrad.addColorStop(1, 'rgba(250, 204, 21, 0.25)');
        ctx.fillStyle = holoGrad;
        drawRoundedRect(ctx, caseX + 50, badgeY, caseW - 100, 180, 20);
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        drawRoundedRect(ctx, caseX + 50, badgeY, caseW - 100, 180, 20);
        ctx.stroke();

        // Track title & artist inside holographic badge
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        const truncatedTitle = track.title.length > 26 ? track.title.substring(0, 24) + '...' : track.title;
        ctx.fillText(truncatedTitle, 540, badgeY + 70);

        ctx.fillStyle = '#ff007f';
        ctx.font = 'bold 28px monospace';
        const truncatedArtist = track.artist.length > 32 ? track.artist.substring(0, 30) + '...' : track.artist;
        ctx.fillText(truncatedArtist.toUpperCase(), 540, badgeY + 125);

        // 5. Bottom Call To Action Sticker (Deezer / Spotify Universal Link)
        const ctaY = 1260;
        ctx.fillStyle = 'rgba(10, 12, 20, 0.95)';
        drawRoundedRect(ctx, 160, ctaY, 760, 240, 36);
        ctx.fill();

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#00f2ff';
        drawRoundedRect(ctx, 160, ctaY, 760, 240, 36);
        ctx.stroke();

        ctx.fillStyle = '#00f2ff';
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🔗 STICKER LIEN SMARTLINK', 540, ctaY + 70);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('Écouter sur Deezer, Spotify, Apple...', 540, ctaY + 130);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '22px monospace';
        ctx.fillText('Touchez le lien pour écouter le titre complet', 540, ctaY + 185);

        // Footer Tagline
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('radiosynapse.fr • Flyer Numérique Universel', 540, 1800);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };

      img.onerror = () => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };

      img.src = track.coverUrl;
    });
  }, [track, coverColor]);

  // Handle Download Story PNG
  const handleDownloadStory = async () => {
    setIsGeneratingImage(true);
    setStatusMessage('Génération du visuel 9:16 en cours...');
    try {
      const blob = await generateStoryCanvasBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Story-MiniDisc-${track.artist}-${track.title}.png`.replace(/[^a-zA-Z0-9-_\.]/g, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatusMessage('Visuel téléchargé ! Prêt pour Instagram & Snapchat Story.');
      }
    } catch (e) {
      console.error(e);
      setStatusMessage('Erreur lors de la génération.');
    } finally {
      setIsGeneratingImage(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Handle Share to Native Story via Web Share API
  const handleShareStoryToSocial = async () => {
    setIsGeneratingImage(true);
    setStatusMessage('Préparation du partage Story...');
    try {
      const blob = await generateStoryCanvasBlob();
      if (blob && navigator.share) {
        const file = new File([blob], `Story-MiniDisc-${track.title}.png`, { type: 'image/png' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${track.title} - ${track.artist}`,
            text: `Écoute "${track.title}" de ${track.artist} découvert sur Radio Synapse : ${shareUrl}`,
            files: [file],
          });
          setStatusMessage('Partagé avec succès !');
          return;
        }
      }

      // Fallback: download the story image and copy the link
      await handleDownloadStory();
      handleCopyLink();
      setStatusMessage('Image enregistrée & lien copié ! Collez le lien dans votre sticker Story.');
    } catch (err) {
      // User cancelled share
    } finally {
      setIsGeneratingImage(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300 overflow-y-auto">
      <div 
        className="relative w-full max-w-md rounded-3xl bg-[#09090e] border border-white/20 shadow-[0_30px_100px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col my-auto"
        style={{
          boxShadow: `0 0 60px ${coverColor}30, 0 30px 90px rgba(0,0,0,0.95)`
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300">
              <Instagram className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-futuristic font-bold uppercase tracking-wider text-white">
                GÉNÉRATEUR DE STORY MINI-DISC
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                Format 9:16 pour Instagram, Snapchat & TikTok
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 9:16 Interactive Story Preview */}
        <div className="p-4 sm:p-5 flex flex-col items-center gap-4 max-h-[75vh] overflow-y-auto">
          
          {/* Visual Story Mockup Card */}
          <div 
            className="relative w-full max-w-[280px] aspect-[9/16] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl p-4 flex flex-col justify-between select-none"
            style={{
              background: `linear-gradient(180deg, #05060b 0%, #101220 50%, #030407 100%)`,
              boxShadow: `0 15px 40px ${coverColor}40`
            }}
          >
            {/* Ambient Background Aura */}
            <div 
              className="absolute inset-0 opacity-40 blur-2xl pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, ${coverColor} 0%, transparent 70%)`
              }}
            />

            {/* Story Top Bar */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-white/20 text-white text-[9px] font-mono font-bold">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                <span>RADIO SYNAPSE</span>
              </div>

              <span className="text-[8px] font-mono text-pink-400 font-bold bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30">
                DIRECT STUDIO
              </span>
            </div>

            {/* Realistic Mini-Disc Case in Story */}
            <div className="relative z-10 w-full p-2.5 rounded-2xl bg-zinc-950/80 border border-white/25 shadow-xl flex flex-col gap-2 backdrop-blur-md">
              {/* Metallic Top Shutter */}
              <div className="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-zinc-600 via-zinc-200 to-zinc-600 flex items-center justify-between text-[7px] font-mono font-bold text-zinc-900">
                <span>◀ INSERT</span>
                <span>SYNAPSE MD-90</span>
              </div>

              {/* Cover Artwork & Disc Optical Window */}
              <div className="flex items-center gap-2">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/30 flex-shrink-0">
                  <img 
                    src={track.coverUrl} 
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-tr from-zinc-900 via-zinc-700 to-zinc-900 border border-white/40 shadow-inner flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`}>
                    <div className="w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Artist */}
              <div className="p-1.5 rounded-xl bg-white/5 border border-white/10 flex flex-col text-left">
                <span className="text-[11px] font-bold text-white truncate leading-tight">
                  {track.title}
                </span>
                <span className="text-[9px] font-mono font-bold text-pink-400 truncate">
                  {track.artist}
                </span>
              </div>
            </div>

            {/* Audio Preview Playback in Story */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <button
                onClick={toggleAudio}
                className="px-3 py-1.5 rounded-full bg-pink-500/30 hover:bg-pink-500/50 border border-pink-400 text-white font-mono text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3 h-3 fill-white" />
                    <span>Arrêter l'extrait</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-white ml-0.5" />
                    <span>Écouter extrait (30s)</span>
                  </>
                )}
              </button>

              {/* Simulated Story Sticker */}
              <div className="w-full py-1.5 px-2 rounded-xl bg-white text-black font-futuristic font-bold text-[9px] uppercase tracking-wider text-center shadow-lg">
                🔗 Lien Sticker : Écouter le titre
              </div>
            </div>
          </div>

          {/* Status notification */}
          {statusMessage && (
            <div className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs text-center animate-pulse">
              {statusMessage}
            </div>
          )}

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-2 pt-1">
            
            {/* Primary Share to Social Story button */}
            <button
              disabled={isGeneratingImage}
              onClick={handleShareStoryToSocial}
              className="w-full py-3 rounded-2xl bg-white hover:bg-zinc-200 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg hover:opacity-95 active:scale-98 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>{isGeneratingImage ? 'Création...' : 'Partager en Story (Instagram / Snap)'}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              {/* Download Image */}
              <button
                disabled={isGeneratingImage}
                onClick={handleDownloadStory}
                className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-mono text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-zinc-300" />
                <span>Télécharger 9:16</span>
              </button>

              {/* Copy Sticker Link */}
              <button
                onClick={handleCopyLink}
                className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-mono text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Lien Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-pink-400" />
                    <span>Copier le Lien</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
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
