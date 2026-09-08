import { useState, useEffect } from 'react';
import { Track, StreamChannel } from '../data';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { preloadImage } from '../utils/artworkFetcher';

interface MiniDiscPlayerProps {
  isPlaying: boolean;
  currentTrack: Track;
  accentColor: string;
  activeStream: StreamChannel;
  allStations?: StreamChannel[];
  shutterForceClosed?: boolean;
  isFavoriteStation?: boolean;
  onToggleFavoriteStation?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
}

export default function MiniDiscPlayer({
  isPlaying,
  currentTrack,
  accentColor,
  activeStream,
  allStations,
  shutterForceClosed = false,
  isFavoriteStation = false,
  onToggleFavoriteStation,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}: MiniDiscPlayerProps) {
  
  // Touch/Mouse gesture states for station swiping and swipe-up to open stations
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [mouseDownX, setMouseDownX] = useState<number | null>(null);
  const [mouseDownY, setMouseDownY] = useState<number | null>(null);
  const [isSwiped, setIsSwiped] = useState(false);

  // Seamless zero-sursaut cover crossfader
  const [displayedCover, setDisplayedCover] = useState(currentTrack.coverUrl || '');
  const [outgoingCover, setOutgoingCover] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    if (currentTrack.coverUrl && currentTrack.coverUrl !== displayedCover) {
      preloadImage(currentTrack.coverUrl).then(() => {
        if (!isMounted) return;
        setOutgoingCover(displayedCover);
        setDisplayedCover(currentTrack.coverUrl);
        timer = setTimeout(() => {
          if (isMounted) {
            setOutgoingCover(null);
          }
        }, 220);
      });
    } else if (currentTrack.coverUrl && !displayedCover) {
      setDisplayedCover(currentTrack.coverUrl);
    }

    return () => {
      isMounted = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [currentTrack.coverUrl, displayedCover]);

  const activeDiscCover = displayedCover || currentTrack.coverUrl || '';

  // Generate deterministic dynamic appearance variables for physical variation when changing stations
  const streamIdStr = activeStream?.id || 'default';
  let hashVal = 0;
  for (let i = 0; i < streamIdStr.length; i++) {
    hashVal = streamIdStr.charCodeAt(i) + ((hashVal << 5) - hashVal);
  }
  const seed = Math.abs(hashVal);
  const designIndex = seed % 5;

  const stationList = allStations && allStations.length > 0 ? allStations : (activeStream ? [activeStream] : []);
  const streamIndex = stationList.findIndex(s => s.id === activeStream.id);
  const stationNumber = activeStream?.stationNumber || (streamIndex >= 0 ? String(streamIndex + 1).padStart(2, '0') : '01');

  // Real 90s translucent "Color Collection" MD casings (Sony Style)
  const getCasingStyle = (idx: number) => {
    switch (idx) {
      case 0: // Cobalt Blue Translucent Case
        return {
          bg: 'bg-[#0b172a]/75 border-blue-500/35 shadow-[0_30px_70px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.65)]',
          accent: '#3b82f6',
          label: 'MD-80 PREMIUM BLUE',
          hubGradient: 'from-zinc-400 via-zinc-100 to-zinc-500',
          hubBorder: 'border-zinc-300/40',
          spindleDot: 'bg-zinc-400',
          grooveCount: 7,
          rotationAngle: 'rotate-[30deg]',
          hasCrosshairs: true,
          hasDashedCircles: false,
          hasHexPattern: false
        };
      case 1: // Ruby Pink Translucent Case
        return {
          bg: 'bg-[#210912]/75 border-rose-500/35 shadow-[0_30px_70px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.65)]',
          accent: '#ff007f',
          label: 'MD-80 PREMIUM RUBY',
          hubGradient: 'from-stone-500 via-stone-200 to-stone-600',
          hubBorder: 'border-stone-400/40',
          spindleDot: 'bg-rose-400',
          grooveCount: 9,
          rotationAngle: 'rotate-[-60deg]',
          hasCrosshairs: false,
          hasDashedCircles: true,
          hasHexPattern: false
        };
      case 2: // Amber Gold Translucent Case
        return {
          bg: 'bg-[#1c0e05]/75 border-amber-500/35 shadow-[0_30px_70px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.65)]',
          accent: '#f59e0b',
          label: 'MD-80 PREMIUM GOLD',
          hubGradient: 'from-amber-600 via-amber-200 to-amber-700',
          hubBorder: 'border-amber-400/45',
          spindleDot: 'bg-amber-400',
          grooveCount: 6,
          rotationAngle: 'rotate-[120deg]',
          hasCrosshairs: false,
          hasDashedCircles: false,
          hasHexPattern: true
        };
      case 3: // Emerald Teal Translucent Case
        return {
          bg: 'bg-[#021c12]/75 border-emerald-500/35 shadow-[0_30px_70px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.65)]',
          accent: '#10b981',
          label: 'MD-80 PREMIUM EMERALD',
          hubGradient: 'from-teal-600 via-zinc-200 to-teal-700',
          hubBorder: 'border-teal-400/40',
          spindleDot: 'bg-emerald-400',
          grooveCount: 8,
          rotationAngle: 'rotate-[180deg]',
          hasCrosshairs: true,
          hasDashedCircles: false,
          hasHexPattern: false
        };
      default: // Smokey Quartz Graphite Case
        return {
          bg: 'bg-[#141416]/75 border-zinc-500/35 shadow-[0_30px_70px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.65)]',
          accent: '#a1a1aa',
          label: 'MD-80 PREMIUM SMOKEY',
          hubGradient: 'from-zinc-400 via-zinc-100 to-zinc-500',
          hubBorder: 'border-zinc-300/40',
          spindleDot: 'bg-white/40',
          grooveCount: 5,
          rotationAngle: 'rotate-[-45deg]',
          hasCrosshairs: false,
          hasDashedCircles: false,
          hasHexPattern: false
        };
    }
  };

  const hexToRgb = (hexStr: string): string => {
    let c = hexStr.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
  };

  const casingStyle = getCasingStyle(designIndex);

  // La couleur du boîtier et ses reflets s'adaptent dynamiquement à la pochette active (accentColor) !
  const casingColor = accentColor || casingStyle.accent || '#00f2ff';
  const casingRgb = hexToRgb(casingColor);

  // Plastique brillant hautement transparent (opacité réduite à 18% pour laisser voir le disque dessous)
  const dynamicCasingBgStyle = `rgba(${casingRgb}, 0.18)`;
  const dynamicCasingBorderStyle = `rgba(${casingRgb}, 0.35)`;

  const bgParts = casingStyle.bg.split(' ');
  const shadowClass = bgParts.find(p => p.startsWith('shadow-')) || '';

  // A helper function to create the beautiful, hyper-realistic silver CD gradient tinted with the active cover's dominant accentColor
  const getTintedCdGradient = (color: string) => {
    const primaryTint = color || '#00f2ff';
    const startAngle = 100 + (seed * 43) % 160; // Deterministic random start angle per station
    const centerX = 47 + (seed % 7); // Center offset X shifts slightly
    const centerY = 47 + ((seed >> 2) % 7); // Center offset Y shifts slightly
    // Reflets métalliques spéculaires intenses accordés à la couleur de la pochette active
    return `radial-gradient(circle, transparent 97%, rgba(255,255,255,0.2) 97.5%, rgba(0,0,0,0.5) 98%, transparent 100%), conic-gradient(from ${startAngle}deg at ${centerX}% ${centerY}%, #94a3b8 0%, ${primaryTint}40 10%, #f1f5f9 20%, #475569 35%, ${primaryTint}50 45%, #ffffff55 50%, ${primaryTint}30 55%, #64748b 70%, ${primaryTint}40 85%, #94a3b8 100%)`;
  };

  // Swipe handlers (horizontal for station switch, vertical up for stations view)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    // Detect Vertical Swipe UP to reveal stations
    if (diffY < -50 && Math.abs(diffY) > Math.abs(diffX)) {
      onSwipeUp?.();
    } 
    // Detect Horizontal Swipe for station change
    else if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDownX(e.clientX);
    setMouseDownY(e.clientY);
    setIsSwiped(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseDownX === null || mouseDownY === null || isSwiped) return;
    const diffX = e.clientX - mouseDownX;
    const diffY = e.clientY - mouseDownY;

    if (diffY < -60 && Math.abs(diffY) > Math.abs(diffX)) {
      onSwipeUp?.();
      setIsSwiped(true);
      setMouseDownX(null);
      setMouseDownY(null);
    } else if (Math.abs(diffX) > 60) {
      if (diffX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
      setIsSwiped(true);
      setMouseDownX(null);
      setMouseDownY(null);
    }
  };

  const handleMouseUp = () => {
    setMouseDownX(null);
    setMouseDownY(null);
  };

  return (
    <div id="minidisc-system-wrapper" className="relative flex items-center justify-center w-full px-6 mx-auto select-none">
      
      {/* Animations & Responsive Shutter Variables style block */}
      <style>{`
        @keyframes md-spin-centered {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-md-spin-centered {
          animation: md-spin-centered 15s linear infinite;
        }

        #sony-minidisc-cartridge {
          --track-w: 160px;
          --shutter-w: 125px;
          --slide-dist: -35px;
        }
      `}</style>

      {/* PURE FLOATING SIDE ARROWS NEAR SCREEN EDGES OUTSIDE THE MINIDISC CARTRIDGE */}
      <button
        onClick={onSwipeRight}
        className="absolute -left-1 top-1/2 -translate-y-1/2 z-30 p-2 text-zinc-400 hover:text-white transition-all duration-300 transform hover:scale-125 active:scale-90 group cursor-pointer drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] flex items-center justify-center"
        title="Station précédente"
        aria-label="Station précédente"
      >
        <ChevronLeft className="w-8 h-8 transition-transform group-hover:-translate-x-1 text-white/80 group-hover:text-amber-400" />
      </button>

      <button
        onClick={onSwipeLeft}
        className="absolute -right-1 top-1/2 -translate-y-1/2 z-30 p-2 text-zinc-400 hover:text-white transition-all duration-300 transform hover:scale-125 active:scale-90 group cursor-pointer drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] flex items-center justify-center"
        title="Station suivante"
        aria-label="Station suivante"
      >
        <ChevronRight className="w-8 h-8 transition-transform group-hover:translate-x-1 text-white/80 group-hover:text-amber-400" />
      </button>
      
      {/* 1. SONY MD CARTRIDGE PANEL (RECALIBRATED PROPORTIONS) */}
      <div
        id="sony-minidisc-cartridge"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`relative w-[275px] h-[275px] aspect-square rounded-[26px] border-t border-l border-b-2 border-r-2 p-3 flex flex-col justify-between overflow-hidden transition-all duration-1000 cursor-grab active:cursor-grabbing select-none ${shadowClass}`}
        style={{
          backgroundColor: dynamicCasingBgStyle,
          borderColor: dynamicCasingBorderStyle,
          boxShadow: `0 35px 80px rgba(0,0,0,0.95), inset 0 3px 6px rgba(255,255,255,0.25), inset 0 -4px 8px rgba(0,0,0,0.8), 0 10px 25px ${casingColor}20`,
        }}
      >
        {/* 100% UNIFORM HIGH-GLOSS TRANSLUCENT FRONT FACE WITH A CRYSTAL CLEAR CENTER WINDOW OVER THE ARTWORK */}
        <div 
          className="absolute inset-0 pointer-events-none z-[8] rounded-[32px] overflow-hidden"
          style={{
            background: `radial-gradient(circle at center, transparent 18.5%, rgba(255,255,255,0.12) 18.8%, rgba(0,0,0,0.25) 19.2%, rgba(${casingRgb}, 0.2) 19.8%)`,
          }}
        />

        {/* HIGH-GLOSS EXTERNAL ACRYLIC PLASTIC SHINE & SPECULAR SURFACE GLARE */}
        {/* Corner specular shine (angle and intensity vary deterministically by station) */}
        <div 
          className="absolute inset-0 pointer-events-none z-[21] rounded-[32px] overflow-hidden"
          style={{
            background: `linear-gradient(${115 + (seed * 19) % 40}deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 18%, transparent 40%, rgba(255,255,255,0.02) 48%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 53%, transparent 72%, rgba(255,255,255,0.08) 100%)`,
            mixBlendMode: 'overlay',
          }}
        />
        {/* Full skew glare streak crossing the surface (skew angle, width and position shift per station) */}
        <div 
          className="absolute top-0 bottom-0 pointer-events-none z-[21]"
          style={{
            left: `${-45 + (seed % 25)}%`,
            width: `${140 + (seed % 40)}%`,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)',
            transform: `skewX(${-20 - (seed % 15)}deg)`,
            mixBlendMode: 'screen',
          }}
        />
        {/* Top edge curved highlight mimicking molded light reflection on acrylic */}
        <div className="absolute top-[3px] inset-x-[12px] h-[3px] bg-white/20 rounded-t-full blur-[0.5px] pointer-events-none z-[21]" />

        {/* Dynamic station number mark in top-right foreground on the casing surface, aligned directly left of the Mini Disc logo */}
        <div className="absolute top-[20px] right-[62px] pointer-events-none z-[22] select-none flex items-center">
          <span 
            className="font-sans font-black text-3xl tracking-tighter leading-none"
            style={{
              color: 'rgba(255, 255, 255, 0.46)',
              textShadow: '-1.5px -1.5px 1px rgba(0,0,0,0.85), 1.5px 1.5px 1.5px rgba(255,255,255,0.7)',
            }}
          >
            {stationNumber}
          </span>
        </div>

        {/* HIGH-FIDELITY REAL SONY MINIDISC INTERNAL MOLDED PLASTIC CASING & SPACERS (Replicating download.jpg) */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none z-[14]" 
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Mask isolating the spandrels (between outer cartridge and center circular disc chamber) */}
            <mask id="md-corner-spandrels-mask">
              <rect x="8" y="8" width="384" height="384" rx="24" fill="white" />
              {/* Central circular disc opening (completely open for the disc) */}
              <circle cx="200" cy="200" r="172" fill="black" />
            </mask>

            {/* Specular plastic rib highlight gradient */}
            <linearGradient id="polycarbBevel" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
            </linearGradient>
          </defs>

          {/* 1. MOLDED CIRCULAR DISC WELL LIP & RECESS (Surrounding the disc) */}
          <circle cx="200" cy="200" r="174" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="200" r="175.5" stroke="rgba(0,0,0,0.7)" strokeWidth="1.5" fill="none" />
          <circle cx="200" cy="200" r="179" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />

          {/* 2. AUTHENTIC CORNER & EDGE CASING MOLDINGS (Mapped strictly outside the disc) */}
          <g mask="url(#md-corner-spandrels-mask)">
            {/* Subtle frosted/textured polycarbonate casing background outside the disc */}
            <rect x="8" y="8" width="384" height="384" rx="24" fill={`rgba(${casingRgb}, 0.08)`} />

            {/* Outer perimeter mold channel step */}
            <rect x="14" y="14" width="372" height="372" rx="20" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" fill="none" />
            <rect x="16" y="16" width="368" height="368" rx="18" stroke="rgba(0,0,0,0.55)" strokeWidth="1.5" fill="none" />

            {/* === TOP-LEFT CORNER MOLDINGS === */}
            {/* Dual molded locator / ejector pin circular dimples ("O O" as on real Sony MD) */}
            <g id="top-left-mold-pins">
              <circle cx="42" cy="42" r="12" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" />
              <circle cx="42" cy="42" r="9.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" fill="none" />
              <circle cx="42" cy="42" r="4" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

              <circle cx="72" cy="42" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="rgba(0,0,0,0.2)" />
              <circle cx="72" cy="42" r="7.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" fill="none" />
              <circle cx="72" cy="42" r="3" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

              {/* Vertical alignment groove */}
              <line x1="28" y1="28" x2="28" y2="85" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <line x1="29.5" y1="28" x2="29.5" y2="85" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />

              {/* Molded corner stiffening rib */}
              <path d="M 28,68 Q 50,68 68,50 L 68,28" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" fill="none" />
            </g>

            {/* === TOP CENTER INSERTION NOTCH & ARROW === */}
            <g id="top-center-arrow">
              {/* Triangular arrow recess */}
              <polygon points="200,24 190,40 210,40" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <polygon points="200,28 193,38 207,38" fill="rgba(255,255,255,0.15)" />
              {/* Latch slots */}
              <rect x="140" y="16" width="22" height="6" rx="2" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <rect x="238" y="16" width="22" height="6" rx="2" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </g>

            {/* === TOP-RIGHT CORNER SONY 80 / MINIDISC LOGO MOLDINGS === */}
            <g id="top-right-sony-markings">
              {/* Molded "Mini Disc" logo badge frame */}
              <rect x="332" y="32" width="46" height="46" rx="6" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="rgba(0,0,0,0.3)" />
              <rect x="334" y="34" width="42" height="42" rx="4" stroke="rgba(0,0,0,0.6)" strokeWidth="1" fill="none" />
              
              {/* Mini Disc text & micro dot matrix inside box */}
              <text x="337" y="48" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="900" fill="rgba(255,255,255,0.85)">Mini</text>
              <g fill="rgba(255,255,255,0.7)">
                <rect x="337" y="52" width="2.5" height="2.5" />
                <rect x="341" y="52" width="2.5" height="2.5" />
                <rect x="345" y="52" width="2.5" height="2.5" />
                <rect x="349" y="52" width="2.5" height="2.5" />
                <rect x="353" y="52" width="2.5" height="2.5" />
              </g>
              <text x="337" y="68" fontFamily="system-ui, sans-serif" fontSize="13" fontWeight="900" fill="rgba(255,255,255,0.9)">DISC</text>

              {/* "Recordable MD" molded caption cleanly centered under the Mini Disc logo frame */}
              <text 
                x="355" 
                y="88" 
                textAnchor="middle" 
                fontFamily="system-ui, sans-serif" 
                fontSize="7.5" 
                fontWeight="700" 
                fill="rgba(255,255,255,0.55)" 
                letterSpacing="0.5px"
              >
                Recordable MD
              </text>
            </g>

            {/* === BOTTOM-LEFT CORNER (Write Protect Tab & Alignment Ports) === */}
            <g id="bottom-left-moldings">
              {/* Write Protect slider switch port */}
              <rect x="30" y="338" width="36" height="24" rx="4" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <rect x="34" y="342" width="16" height="16" rx="2" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <circle cx="42" cy="350" r="3" fill="rgba(255,255,255,0.4)" />

              {/* Molded guide rib */}
              <line x1="28" y1="310" x2="28" y2="370" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <line x1="29.5" y1="310" x2="29.5" y2="370" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
              
              {/* Small square positioning port */}
              <rect x="74" y="346" width="14" height="14" rx="2" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            </g>

            {/* === BOTTOM-RIGHT CORNER (Dual Locator Holes & Grip Grooves) === */}
            <g id="bottom-right-moldings">
              {/* Dual circular locator pin holes ("O O" bottom right as in reference image) */}
              <circle cx="330" cy="352" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" />
              <circle cx="330" cy="352" r="7.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" fill="none" />
              <circle cx="330" cy="352" r="3" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

              <circle cx="358" cy="352" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" />
              <circle cx="358" cy="352" r="7.5" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" fill="none" />
              <circle cx="358" cy="352" r="3" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

              {/* 3 Horizontal Molded Grip Ribs above the locator pins */}
              <line x1="285" y1="316" x2="370" y2="316" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5" />
              <line x1="285" y1="318" x2="370" y2="318" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />

              <line x1="290" y1="324" x2="370" y2="324" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5" />
              <line x1="290" y1="326" x2="370" y2="326" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />

              <line x1="295" y1="332" x2="370" y2="332" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5" />
              <line x1="295" y1="334" x2="370" y2="334" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
            </g>

            {/* === CENTER OPTICAL APERTURE BRIDGE / U-SHAPED WINDOW OUTLINE === */}
            {/* The transparent optical laser pickup window running towards the center */}
            <path 
              d="M 235,108 L 380,108 L 380,292 L 235,292 L 235,260 Q 155,245 155,200 Q 155,155 235,140 Z" 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="2" 
              fill="rgba(0,0,0,0.15)" 
            />
            <path 
              d="M 233,106 L 382,106 L 382,294 L 233,294 L 233,262 Q 153,247 153,200 Q 153,153 233,138 Z" 
              stroke="rgba(0,0,0,0.6)" 
              strokeWidth="1.5" 
              fill="none" 
            />
          </g>
        </svg>

        {/* Real molded polycarbonate double bezel (inner bevel depth) */}
        <div className="absolute inset-[3px] rounded-[29px] border border-white/10 pointer-events-none z-15" />
        <div className="absolute inset-[5px] rounded-[27px] border border-black/60 pointer-events-none z-15" />
        <div className="absolute inset-[8px] rounded-[24px] border border-white/5 pointer-events-none z-15" />

        {/* Acrylic / Polycarbonate highly reflective glossy glare overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.08] opacity-90 pointer-events-none rounded-[32px] z-25" />

        {/* Realistic Screws in all 4 Corners to simulate physical assembly */}
        {/* Top Left Screw */}
        <div className="absolute top-4 left-4 w-3.5 h-3.5 rounded-full bg-zinc-700 border border-zinc-800 shadow-[inset_0_1px_3.5px_rgba(0,0,0,0.95),0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center z-25 pointer-events-none">
          <div className="w-2.5 h-[1.5px] bg-zinc-400/80 rotate-45 shadow-[0_0.5px_0_rgba(255,255,255,0.15)]" />
        </div>
        {/* Top Right Screw */}
        <div className="absolute top-4 right-4 w-3.5 h-3.5 rounded-full bg-zinc-700 border border-zinc-800 shadow-[inset_0_1px_3.5px_rgba(0,0,0,0.95),0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center z-25 pointer-events-none">
          <div className="w-2.5 h-[1.5px] bg-zinc-400/80 -rotate-12 shadow-[0_0.5px_0_rgba(255,255,255,0.15)]" />
        </div>
        {/* Bottom Left Screw */}
        <div className="absolute bottom-4 left-4 w-3.5 h-3.5 rounded-full bg-zinc-700 border border-zinc-800 shadow-[inset_0_1px_3.5px_rgba(0,0,0,0.95),0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center z-25 pointer-events-none">
          <div className="w-2.5 h-[1.5px] bg-zinc-400/80 rotate-[75deg] shadow-[0_0.5px_0_rgba(255,255,255,0.15)]" />
        </div>
        {/* Bottom Right Screw */}
        <div className="absolute bottom-4 right-4 w-3.5 h-3.5 rounded-full bg-zinc-700 border border-zinc-800 shadow-[inset_0_1px_3.5px_rgba(0,0,0,0.95),0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center z-25 pointer-events-none">
          <div className="w-2.5 h-[1.5px] bg-zinc-400/80 rotate-[135deg] shadow-[0_0.5px_0_rgba(255,255,255,0.15)]" />
        </div>

        {/* Tactile Side Grip Ribs (Left Margin) */}
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-20 opacity-55 pointer-events-none">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="w-1.5 h-5 bg-black/65 rounded-sm border-r border-b border-white/5 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.9)]" />
          ))}
        </div>

        {/* Inscription: INSERT THIS END ▲ (Matches reference image at top center) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 opacity-65 select-none pointer-events-none z-20">
          <span className="text-[6.5px] font-mono tracking-[0.22em] text-white/90 font-black uppercase">INSERT THIS END</span>
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[5px] border-b-white/90 mt-0.5" />
        </div>

        {/* Insertion arrow removed per request */}

        {/* Embossed casing grooves (bas-relief effect using light/dark shadow pairs) */}
        <div className="absolute inset-[14px] border border-black/45 rounded-[22px] pointer-events-none z-10" />
        <div className="absolute inset-[15px] border border-white/5 rounded-[21px] pointer-events-none z-10" />

        {/* Horizontal structural mold line with 3D bas-relief highlight */}
        <div className="absolute top-[50%] left-6 right-6 h-[1.5px] bg-black/60 pointer-events-none z-10" />
        <div className="absolute top-[calc(50%+1.5px)] left-6 right-6 h-[1px] bg-white/5 pointer-events-none z-10" />

        {/* Vertical structural mold line with 3D bas-relief highlight */}
        <div className="absolute left-[38%] top-6 bottom-6 w-[1.5px] bg-black/60 pointer-events-none z-10" />
        <div className="absolute left-[calc(38%+1.5px)] top-6 bottom-6 w-[1px] bg-white/5 pointer-events-none z-10" />

        {/* Write-protect slide tab removed per request */}

        {/* PHYSICAL 3D BACKPLATE - SOLID CASING BACKING VISIBLE UNDER THE TRANSLUCENT FRONT PANEL */}
        <div className="absolute inset-[15px] rounded-[22px] bg-neutral-950 pointer-events-none z-0 overflow-hidden shadow-[inset_0_4px_16px_rgba(0,0,0,0.98)]">
          {/* Molded Circular Well where the disc resides */}
          <div className="absolute inset-[6px] rounded-full bg-zinc-950/95 border border-black/90 shadow-[inset_0_10px_28px_rgba(0,0,0,1)] flex items-center justify-center">
            {/* Concentric molded mechanical details on the backplate */}
            <div className="absolute w-[80%] h-[80%] rounded-full border border-zinc-900/40 bg-zinc-900/5 shadow-inner" />
            <div className="absolute w-[60%] h-[60%] rounded-full border border-zinc-900/60" />
            <div className="absolute w-[40%] h-[40%] rounded-full border border-black/80" />
            
            {/* Plastic reinforcing ribs / structural diagonals of the physical back tray */}
            <div className="absolute w-full h-[1px] bg-zinc-900/25" />
            <div className="absolute h-full w-[1px] bg-zinc-900/25" />
            <div className="absolute w-full h-[1px] rotate-45 bg-zinc-900/10" />
            <div className="absolute w-full h-[1px] -rotate-45 bg-zinc-900/10" />

            {/* Central dark plastic spindle block */}
            <div className="w-20 h-20 rounded-full bg-neutral-900 border border-black shadow-[0_3px_8px_rgba(0,0,0,0.9)]" />
          </div>
        </div>

        {/* INCRIPTION: SHOCK ABSORBING MECHANISM (Matches reference image at middle-left) */}
        <div className="absolute left-[8%] top-[31%] flex items-center gap-2 opacity-50 pointer-events-none z-10 select-none">
          {/* Target Wave Icon */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-white" />
            <div className="absolute inset-[3px] rounded-full border border-dashed border-white/60" />
            <svg className="w-7 h-5 text-white absolute" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1,6 L7,6 L9,2 L12,10 L15,4 L17,6 L23,6" />
            </svg>
          </div>
          <div className="flex flex-col text-left font-sans select-none">
            <span className="text-[7px] font-black tracking-widest text-white leading-none">SHOCK</span>
            <span className="text-[7px] font-black tracking-widest text-white leading-none mt-0.5">ABSORBING</span>
            <span className="text-[5.5px] font-bold text-zinc-300 tracking-wider leading-none mt-0.5">MECHANISM</span>
          </div>
        </div>

        {/* THE SPINNING DISC - PERFECTLY CENTERED WITH INSET-BASED AUTO-ALIGNMENT */}
        <div
          id="md-rotating-magnetic-platter"
          className={`absolute inset-[22px] rounded-full border border-white/20 flex items-center justify-center transition-all m-auto z-5 ${
            isPlaying ? 'animate-md-spin-centered' : ''
          }`}
          style={{
            transform: isPlaying ? undefined : `rotate(${(seed * 17) % 360}deg)`,
            background: getTintedCdGradient(accentColor),
            boxShadow: isPlaying 
              ? 'inset 0 0 12px rgba(0,0,0,0.8), inset 0 0 4px rgba(255,255,255,0.5), 0 8px 30px rgba(0,0,0,0.75)' 
              : 'inset 0 0 12px rgba(0,0,0,0.8), inset 0 0 4px rgba(255,255,255,0.5), 0 6px 18px rgba(0,0,0,0.5)',
          }}
        >
          {/* PRISMATIC CD DIFFRACTION RAINBOW RAYS (As seen on real MiniDisc in download.jpg) */}
          <div 
            className="absolute inset-0 rounded-full pointer-events-none z-10 opacity-70"
            style={{
              background: `conic-gradient(from 45deg at 50% 50%, transparent 0%, rgba(255,0,128,0.25) 8%, rgba(0,255,255,0.3) 14%, rgba(255,255,0,0.35) 20%, transparent 28%, transparent 50%, rgba(255,0,128,0.25) 58%, rgba(0,255,255,0.3) 64%, rgba(255,255,0,0.35) 70%, transparent 78%)`,
              mixBlendMode: 'screen',
            }}
          />

          {/* Outer disc clear polycarbonate perimeter rim */}
          <div className="absolute inset-0 rounded-full border-[3px] border-black/40 pointer-events-none z-10" />
          <div className="absolute inset-[3px] rounded-full border border-white/10 pointer-events-none z-10" />

          {/* Concentric physical micro-grooves */}
          {Array.from({ length: 8 }).map((_, i) => {
            const step = (110 / 9) * (i + 1);
            return (
              <div 
                key={i} 
                className="absolute rounded-full border border-white/[0.08] pointer-events-none"
                style={{
                  inset: `${step}px`,
                  opacity: 0.2 + (i % 2) * 0.15
                }}
              />
            );
          })}

          {/* Printed album artwork cover inside spinning CD platter (Expanded size with seamless crossfading) */}
          <div 
            className="absolute w-[155px] h-[155px] rounded-full bg-zinc-950 overflow-hidden border-2 border-black/85 shadow-lg flex items-center justify-center z-15 select-none pointer-events-none"
          >
            <div className="relative w-full h-full">
              {/* Outgoing cover layer staying fully visible during crossfade to eliminate blank frame/sursaut */}
              {outgoingCover && (
                <img 
                  src={outgoingCover} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover rounded-full" 
                  referrerPolicy="no-referrer"
                />
              )}
              {/* Active incoming cover layer */}
              <img 
                key={activeDiscCover}
                src={activeDiscCover} 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover rounded-full transition-opacity duration-200 ease-out" 
                referrerPolicy="no-referrer"
              />
              {/* CD spindle center inner cover rim */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black border border-black/60 shadow-inner z-10" />
            </div>
          </div>

          {/* LASER-ETCHED SERIAL RING & CLAMPING APERTURE RING (As seen in download.jpg with `80010-...` etchings) */}
          <div className="absolute inset-[65px] rounded-full border border-white/20 bg-black/10 shadow-inner flex items-center justify-center pointer-events-none z-15">
            <span className="text-[5.5px] font-mono tracking-widest text-white/30 font-bold uppercase rotate-45 select-none">
              MD-RECORDABLE 80MIN SYNAPSE-AUDIO
            </span>
          </div>

          {/* REAL SONY CLAMPING PLATE WITH CIRCULAR RECTANGULAR BALANCE TEETH (download.jpg match) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-neutral-900 border border-white/30 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9),0_2px_8px_rgba(0,0,0,0.7)] flex items-center justify-center z-20 pointer-events-none">
            {/* Outer teeth ring */}
            <div className="absolute inset-1 rounded-full flex items-center justify-center">
              {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i}
                  className="absolute w-1.5 h-2.5 bg-neutral-950 border border-white/20 rounded-[1px]"
                  style={{
                    transform: `rotate(${i * 30}deg) translateY(-26px)`,
                  }}
                />
              ))}
            </div>

            {/* Stainless steel clamping disk */}
            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-tr from-neutral-300 via-neutral-100 to-neutral-400 border border-white shadow-md flex items-center justify-center">
              {/* Spindle center hole */}
              <div className="w-5 h-5 rounded-full bg-[#050505] border border-neutral-700 shadow-inner flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
              </div>
            </div>
          </div>
        </div>

        {/* RECESSED SHUTTER GUIDE TRACK (Flush with right edge & with mathematically limited slide depth) */}
        <div 
          className="absolute h-[98px] top-1/2 right-0 w-[var(--track-w)] -translate-y-1/2 bg-black/12 rounded-l-xl border-l border-t border-b border-black/85 shadow-[inset_2px_3px_6px_rgba(0,0,0,0.9),_inset_-1px_-1px_3px_rgba(255,255,255,0.08)] overflow-hidden z-[24]"
        >
          {/* Read/Write Laser Cutout Window (Fenêtre de lecture laser visible quand le shutter s'écarte) */}
          <div className="absolute h-[84%] top-[8%] right-2 w-[115px] bg-transparent rounded-lg border border-white/10 shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Subtle holographic lens prism effect representing the optical pick-up head beneath the slot */}
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-cyan-400 via-purple-500 to-rose-400 blur-[0.5px] opacity-75 shadow-[0_0_8px_rgba(6,182,212,0.6)] animate-pulse flex items-center justify-center">
              {/* Shiny tiny optical lens center glass reflection */}
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-200/90 border border-white/50 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white" />
              </div>
            </div>
          </div>

          {/* SONY METAL SHUTTER SLIDER (RECESSED TO EXACT FLUSH LIMITS WITH SHORTER SLIDE) */}
          <div
            id="sony-sliding-shutter-door"
            className="absolute h-full top-0 right-0 bg-gradient-to-r from-neutral-300 via-neutral-100 to-neutral-350 border-l border-white/70 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),_inset_-1px_-1px_2px_rgba(0,0,0,0.5),0_3px_8px_rgba(0,0,0,0.4)] opacity-100 rounded-l-lg transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] z-[25] flex flex-col justify-between p-2"
            style={{
              width: 'var(--shutter-w)',
              transform: (isPlaying && !shutterForceClosed) 
                ? 'translateX(var(--slide-dist))' 
                : 'translateX(0px)',
            }}
          >
            {/* Shutter rail detail */}
            <div className="flex items-center justify-between border-b border-black/[0.12] pb-1">
              <div className="flex gap-[3px] items-center">
                <span className="w-1 h-2 bg-black/35 rounded-full" />
                <span className="w-1 h-2 bg-black/35 rounded-full" />
                <span className="w-1 h-2 bg-black/35 rounded-full" />
              </div>
              
              {/* Right side: Star favorite icon (pure star, no circle/bg) + Voyant LED */}
              <div className="flex items-center gap-1.5">
                {/* Étoile favoris dorée (icône 5 branches classique) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavoriteStation?.();
                  }}
                  className="p-1 transition-all duration-300 cursor-pointer flex items-center justify-center hover:scale-125 active:scale-90"
                  title={isFavoriteStation ? "Station favorite (Cliquer pour retirer)" : "Ajouter la station aux favoris"}
                  aria-label={isFavoriteStation ? "Retirer la station des favoris" : "Ajouter la station aux favoris"}
                >
                  <Star 
                    className={`w-3.5 h-3.5 transition-all ${
                      isFavoriteStation 
                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] scale-110' 
                        : 'text-amber-500/70 hover:text-amber-300'
                    }`} 
                  />
                </button>

                {/* Voyant LED (Rouge si arrêté, Vert si en lecture) */}
                <div 
                  className="w-3.5 h-2 bg-black/90 p-[1.5px] rounded-[1.5px] flex justify-end"
                  title={isPlaying ? "Lecture en cours (VERT)" : "Lecture arrêtée (ROUGE)"}
                >
                  <div 
                    className={`w-1.5 h-full rounded-[1.5px] transition-all duration-300 ${
                      isPlaying 
                        ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' 
                        : 'bg-[#ef4444] shadow-[0_0_6px_#ef4444]'
                    }`} 
                  />
                </div>
              </div>
            </div>

            {/* Station Name Inset Engraved Bas-Relief Frame on metal shutter */}
            <div className="flex-1 flex flex-col justify-center items-center py-0.5 px-0.5 select-none pointer-events-none">
              <div className="w-full border border-black/35 rounded-md p-1.5 bg-gradient-to-b from-neutral-200/95 via-neutral-250/95 to-neutral-300/95 shadow-[inset_0_2.5px_5px_rgba(0,0,0,0.4),inset_0_-1.5px_2px_rgba(255,255,255,0.85)] flex items-center justify-center text-center">
                <span 
                  className="font-futuristic font-black tracking-wider uppercase text-neutral-950 text-[11px] leading-tight break-words whitespace-normal text-center"
                  style={{
                    fontFamily: '"Orbitron", "Syncopate", sans-serif',
                    fontWeight: 900,
                    WebkitTextStroke: '0.45px rgba(0, 0, 0, 0.95)',
                    /* Deep Intaglio / Recessed carved text effect: dark upper-left incision + crisp specular metallic bottom-right bevel highlight */
                    textShadow: '-1.2px -1.2px 1px rgba(0,0,0,0.98), 1.2px 1.2px 1px rgba(255,255,255,0.95), 0 0 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {activeStream.name.replace('Radio Synapse - ', '')}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-end text-[5.5px] font-bold text-black/70 font-mono select-none">
              <span className="opacity-80">MADE IN FRANCE</span>
              <span>SLIDE ◀▶</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
