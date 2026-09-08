import { useState, useEffect, useRef } from 'react';
import { Sliders, RotateCcw, Sparkles, Volume2, Activity } from 'lucide-react';
import { EQUALIZER_PRESETS, EQ_FREQUENCIES } from '../data';

interface EqualizerProps {
  activePreset: string;
  onPresetChange: (presetName: string) => void;
  bands: number[];
  onBandChange: (bandIndex: number, value: number) => void;
  onResetFlat: () => void;
  isPlaying: boolean;
  accentColor: string;
  stationName: string;
}

export default function Equalizer({
  activePreset,
  onPresetChange,
  bands,
  onBandChange,
  onResetFlat,
  isPlaying,
  accentColor,
  stationName,
}: EqualizerProps) {
  // Simulated spectrum bounce synchronized with the 10 bands
  const [liveSpectrum, setLiveSpectrum] = useState<number[]>(bands.map(() => 15));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      const interval = setInterval(() => {
        setLiveSpectrum(prev => prev.map(val => Math.max(val - 3, 10)));
      }, 100);
      return () => clearInterval(interval);
    }

    const animate = () => {
      setLiveSpectrum(() => {
        const time = Date.now() / 150;
        return bands.map((gainDb, idx) => {
          // Normalize gain from -12..+12 to 0.4..1.6 multiplier
          const gainMultiplier = Math.max(0.2, 1.0 + (gainDb / 12) * 0.6);
          const wave = Math.sin(time + idx * 0.7) * 20;
          const noise = Math.random() * 25;
          const baseHeight = 35 * gainMultiplier + wave + noise;
          return Math.max(8, Math.min(100, baseHeight));
        });
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, bands]);

  // Construct smooth SVG curve points based on bands
  // SVG coordinates: Width: 1000, Height: 120 (0dB is at y=60, +12dB at y=10, -12dB at y=110)
  const svgWidth = 1000;
  const svgHeight = 120;
  const paddingX = 40;
  const stepX = (svgWidth - paddingX * 2) / (bands.length - 1);

  const points = bands.map((db, i) => {
    const x = paddingX + i * stepX;
    // Map db (-12 to +12) to y (105 to 15)
    const y = 60 - (db / 12) * 45;
    return { x, y };
  });

  // Create smooth cubic Bézier SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  // Area under curve path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z`;

  return (
    <div 
      id="equalizer-module" 
      className="w-full flex-1 flex flex-col justify-between gap-6 select-none"
    >
      {/* Top Presets & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
            <Sliders className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-mono">
                Égaliseur Graphique 10 Bandes
              </h3>
              <span 
                className="text-[9.5px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-black/60 border border-white/15"
                style={{ color: accentColor }}
              >
                {activePreset}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Profil actif calibré pour <strong className="text-zinc-200">{stationName}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={onResetFlat}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-mono font-medium transition-all transform active:scale-95 cursor-pointer shadow-sm"
            title="Réinitialiser tous les curseurs à 0 dB"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Reset 0dB</span>
          </button>
        </div>
      </div>

      {/* Preset Chips Selector Bar */}
      <div className="flex flex-col gap-2">
        <span className="text-[10.5px] font-mono uppercase tracking-widest text-zinc-400 font-semibold flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Profils Sonores Préréglés & Genres</span>
        </span>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
          {EQUALIZER_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => onPresetChange(preset.name)}
                className={`flex-shrink-0 text-xs font-mono font-semibold px-4 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-white border-white text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.25)]'
                    : 'bg-black/40 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                }`}
              >
                {isSelected && <span className="w-2 h-2 rounded-full bg-black" />}
                <span>{preset.name}</span>
              </button>
            );
          })}

          {/* Custom profile chip */}
          <button
            onClick={() => onPresetChange('PERSONNALISÉ')}
            className={`flex-shrink-0 text-xs font-mono font-semibold px-4 py-2.5 rounded-xl border transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activePreset === 'PERSONNALISÉ'
                ? 'bg-white border-white text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.25)]'
                : 'bg-black/40 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
            }`}
          >
            {activePreset === 'PERSONNALISÉ' && <span className="w-2 h-2 rounded-full bg-black" />}
            <Sparkles className="w-3.5 h-3.5 opacity-80" />
            <span>PERSONNALISÉ</span>
          </button>
        </div>
      </div>

      {/* Visual Dynamic Curve & Audio Spectrum Screen (Taller & Highly Detailed) */}
      <div 
        id="equalizer-response-screen"
        className="w-full bg-black/75 rounded-2xl border border-white/10 p-4 relative overflow-hidden shadow-[inset_0_2px_15px_rgba(0,0,0,0.95)]"
      >
        {/* Subtle background grid lines for dB levels (+12dB, +6dB, 0dB, -6dB, -12dB) */}
        <div className="absolute inset-x-4 top-4 bottom-4 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-b border-dashed border-white flex justify-between text-[8px] font-mono text-zinc-400 px-1">
            <span>+12 dB</span>
            <span>BOOST MAXIMUM</span>
          </div>
          <div className="border-b border-white/60 flex justify-between text-[8px] font-mono text-white/80 px-1">
            <span>0 dB</span>
            <span>RÉFÉRENCE STUDIO (FLAT)</span>
          </div>
          <div className="border-b border-dashed border-white flex justify-between text-[8px] font-mono text-zinc-400 px-1">
            <span>-12 dB</span>
            <span>ATTÉNUATION MAXIMALE</span>
          </div>
        </div>

        {/* Dynamic SVG Response Curve */}
        <svg 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="w-full h-28 sm:h-36 md:h-44 overflow-visible relative z-10"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="eqGlowGradFull" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>
            <filter id="neonGlowFull" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Fill under the curve */}
          <path d={areaD} fill="url(#eqGlowGradFull)" />

          {/* Main glowing response line */}
          <path 
            d={pathD} 
            fill="none" 
            stroke="#ffffff" 
            strokeWidth="4" 
            strokeLinecap="round" 
            filter="url(#neonGlowFull)"
          />

          {/* Interactive anchor nodes on the curve */}
          {points.map((p, i) => (
            <g key={i}>
              <circle 
                cx={p.x} 
                cy={p.y} 
                r="5" 
                fill="#ffffff" 
                stroke="#ffffff" 
                strokeWidth="2.5" 
              />
            </g>
          ))}
        </svg>

        {/* Live Audio Energy Visualizer Spectrum Bars */}
        <div className="absolute inset-x-6 bottom-3 flex justify-between items-end h-6 pointer-events-none opacity-45 z-20">
          {liveSpectrum.map((level, i) => (
            <div 
              key={i} 
              className="w-2 rounded-full bg-white transition-all duration-75"
              style={{
                height: `${Math.max(4, (level / 100) * 22)}px`,
                opacity: isPlaying ? 0.9 : 0.2
              }}
            />
          ))}
        </div>
      </div>

      {/* 10 Precision Physical Faders Grid (Expanded Taller Height for Extreme Ergonomics) */}
      <div 
        id="equalizer-faders-deck"
        className="w-full bg-black/45 rounded-2xl border border-white/10 p-3 sm:p-5 flex-1 flex flex-col justify-center"
      >
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 sm:gap-3 items-center justify-items-center">
          {EQ_FREQUENCIES.map((freq, idx) => {
            const gain = bands[idx] ?? 0;
            const normalizedHeight = ((gain + 12) / 24) * 100;

            return (
              <div 
                key={freq} 
                className="w-full flex flex-col items-center gap-2.5 group p-1.5 sm:p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                {/* Current dB Gain Badge */}
                <span 
                  className={`text-[10.5px] sm:text-xs font-mono font-bold tracking-tight transition-colors ${
                    gain > 0 
                      ? 'text-white' 
                      : gain < 0 
                      ? 'text-rose-400' 
                      : 'text-zinc-400'
                  }`}
                >
                  {gain > 0 ? `+${gain}` : gain}dB
                </span>

                {/* Vertical Fader Track (Taller for touch & mouse ergonomics) */}
                <div className="relative h-40 sm:h-48 md:h-52 w-8 flex items-center justify-center cursor-pointer">
                  {/* Invisible native range input positioned vertically */}
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={gain}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onBandChange(idx, val);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-30"
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                    }}
                  />

                  {/* Fader Track Groove */}
                  <div className="w-2.5 h-full bg-zinc-900/95 rounded-full border border-white/10 overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] flex flex-col justify-end">
                    
                    {/* Zero dB central indicator notch */}
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/40 -translate-y-1/2 z-10 pointer-events-none" />

                    {/* Active Level Fill */}
                    <div 
                      className="w-full transition-all duration-100 ease-out"
                      style={{
                        height: `${normalizedHeight}%`,
                        backgroundColor: gain >= 0 ? accentColor : '#f43f5e',
                        boxShadow: `0 0 12px ${gain >= 0 ? accentColor : '#f43f5e'}`
                      }}
                    />
                  </div>

                  {/* Tactile Metallic Fader Thumb */}
                  <div 
                    className="absolute w-7 h-4 bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-600 rounded-md border border-white/50 shadow-[0_3px_8px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.8)] pointer-events-none transition-all duration-100 flex items-center justify-center"
                    style={{
                      bottom: `calc(${normalizedHeight}% - 8px)`
                    }}
                  >
                    {/* Middle alignment slit with LED glow */}
                    <div 
                      className="w-4 h-[2px] rounded-full" 
                      style={{ backgroundColor: gain !== 0 ? accentColor : '#000000' }}
                    />
                  </div>
                </div>

                {/* Frequency Label */}
                <span className="text-[11px] sm:text-xs font-mono font-bold text-zinc-300 tracking-tight text-center">
                  {freq}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Status / Advice */}
      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-2 py-1 bg-black/30 rounded-xl border border-white/5">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-white" />
          <span>Filtres DSP à phase linéaire active (10 bandes)</span>
        </div>
        <span className="text-zinc-500">Plage : -12 dB / +12 dB</span>
      </div>

    </div>
  );
}
