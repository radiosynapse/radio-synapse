import { Heart } from 'lucide-react';

interface DoubleHeartIconProps {
  className?: string;
  sizeClassName?: string;
  level?: 0 | 1 | 2; // 0 = not liked, 1 = Like (single heart), 2 = Super Like (coeur dans un coeur)
  customColor?: string; // Cover art dynamic color harmony
}

export function DoubleHeartIcon({
  className = '',
  sizeClassName = 'w-6 h-6',
  level = 2,
  customColor,
}: DoubleHeartIconProps) {
  const activeColor = customColor || '#ef4444';
  const superColor = customColor || '#e11d48';

  if (level === 0) {
    return (
      <Heart 
        className={`${sizeClassName} transition-all duration-300 group-hover:scale-110 ${className}`} 
        style={{
          color: activeColor,
          opacity: 0.85,
          filter: `drop-shadow(0 0 6px ${activeColor}50)`
        }}
      />
    );
  }

  if (level === 1) {
    return (
      <Heart 
        className={`${sizeClassName} transition-all duration-300 group-hover:scale-110 ${className}`}
        style={{
          fill: activeColor,
          color: activeColor,
          filter: `drop-shadow(0 0 10px ${activeColor})`
        }}
      />
    );
  }

  // Level 2: Super Like - Coeur dans un coeur (Double Heart)
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${sizeClassName} ${className}`}>
      {/* Outer Heart (larger, vibrant cover color with animated pulse and glow) */}
      <Heart 
        className="w-full h-full text-amber-300 stroke-[1.5] animate-pulse" 
        style={{
          fill: superColor,
          filter: `drop-shadow(0 0 14px ${superColor})`
        }}
      />
      {/* Inner Heart (embedded inside) */}
      <Heart 
        className="w-[52%] h-[52%] absolute fill-white stroke-[1.5] drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]" 
        style={{
          color: superColor
        }}
      />
    </div>
  );
}

export default DoubleHeartIcon;
