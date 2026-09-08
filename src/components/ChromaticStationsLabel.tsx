import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';

interface ChromaticStationsLabelProps {
  stationId: string;
  primaryColor?: string;
  secondaryColor?: string;
  onClick?: () => void;
}

export default function ChromaticStationsLabel({
  stationId,
  secondaryColor = '#ff007f',
  onClick,
}: ChromaticStationsLabelProps) {
  const [animKey, setAnimKey] = useState(0);
  const stationChangeCount = useRef(0);
  const isFirstMount = useRef(true);

  // Track station changes: trigger animation every 2 station changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    stationChangeCount.current += 1;

    // Trigger animation when station changes twice (every 2 changes)
    if (stationChangeCount.current > 0 && stationChangeCount.current % 2 === 0) {
      setAnimKey((prev) => prev + 1);
    }
  }, [stationId]);

  const totalDuration = 5.0; // Total 5-second precise sequence timeline

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center justify-center cursor-pointer select-none group px-4 z-50 overflow-visible py-0 pb-0"
      title="Afficher la liste complète des stations radio"
    >
      {/* Container holding Arrow + Text: Rested at y:15 so ONLY the arrow tip protrudes at the bottom edge, rises just 15px to reveal text */}
      <motion.div
        key={`container-${animKey}`}
        className="flex flex-col items-center justify-center relative z-50 overflow-visible"
        initial={{ y: 15 }}
        animate={
          animKey > 0
            ? {
                // 1. Arrow ascends UP just enough to reveal text height from bottom edge (0s -> 0.8s)
                // 2. Holds position while text illuminates & arrow bounces (0.8s -> 4.3s)
                // 3. Descends BACK DOWN (4.3s -> 5.0s)
                y: [15, 0, 0, 0, 15],
              }
            : { y: 15 }
        }
        transition={{
          duration: totalDuration,
          times: [0, 0.16, 0.20, 0.86, 1.0],
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {/* Upward Arrow Indicator: Always visible at top of container, protrudes at bottom edge in resting state */}
        <motion.div
          className="flex items-center justify-center py-0.5 relative z-50 overflow-visible"
          initial={{ y: 0, scale: 1 }}
          animate={
            animKey > 0
              ? {
                  // Remains at 0 during ascend (0s - 1.0s), bounces when glare/flash starts (1.0s - 3.6s), then at rest (3.6s - 5.0s)
                  y: [0, 0, -7, 0, -4, 0, 0],
                  scale: [1, 1, 1.15, 1, 1.08, 1, 1],
                }
              : { y: 0, scale: 1 }
          }
          transition={{
            duration: totalDuration,
            times: [0, 0.20, 0.35, 0.48, 0.60, 0.72, 1.0],
            ease: 'easeInOut',
          }}
        >
          <svg
            viewBox="0 0 24 10"
            className="w-7 h-2.5 sm:w-8 sm:h-3 transition-colors duration-300 group-hover:scale-y-90 transform drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
            style={{ color: secondaryColor }}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8l10-6 10 6" />
          </svg>
        </motion.div>

        {/* Text Animation Container: Hidden (opacity: 0) while arrow ascends, appears ONLY WHEN arrow starts bouncing */}
        <div className="relative inline-flex items-center justify-center -mt-0.5 h-4 z-50 overflow-visible">
          {/* Layer 1: Metallic Glare Sweep */}
          <motion.span
            className="font-futuristic font-black tracking-[0.14em] uppercase text-xs sm:text-sm select-none"
            style={{
              background: `linear-gradient(110deg, #000000 0%, #000000 35%, #18181b 40%, #52525b 44%, #e2e8f0 48%, #ffffff 50%, #cbd5e1 52%, #71717a 56%, #18181b 60%, #000000 65%, #000000 100%)`,
              backgroundSize: '360% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              WebkitTextStroke: '0.5px rgba(255, 255, 255, 0.65)',
              display: 'inline-block',
              transform: 'scaleY(0.75)',
              transformOrigin: 'center center',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.95))',
            }}
            initial={{ opacity: 0, backgroundPosition: '190% 0' }}
            animate={
              animKey > 0
                ? {
                    // Opacity remains STRICTLY 0 while arrow ascends (0s - 1.0s), fades in at 1.0s, stays 1 during sweep, fades out to 0 at 4.2s BEFORE arrow descends
                    opacity: [0, 0, 1, 1, 0, 0],
                    backgroundPosition: ['190% 0', '190% 0', '50% 0', '50% 0', '-190% 0', '-190% 0'],
                  }
                : { opacity: 0, backgroundPosition: '190% 0' }
            }
            transition={{
              duration: totalDuration,
              times: [0, 0.20, 0.56, 0.76, 0.84, 1.0],
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            STATIONS
          </motion.span>

          {/* Layer 2: Full Text Illumination & Fade Out */}
          <motion.span
            className="absolute inset-0 font-futuristic font-black tracking-[0.14em] uppercase text-xs sm:text-sm pointer-events-none select-none text-center"
            style={{
              background: `linear-gradient(180deg, #ffffff 0%, #cbd5e1 50%, #64748b 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              WebkitTextStroke: '0.5px rgba(255, 255, 255, 0.95)',
              display: 'inline-block',
              transform: 'scaleY(0.75)',
              transformOrigin: 'center center',
            }}
            initial={{ opacity: 0 }}
            animate={
              animKey > 0
                ? {
                    // Opacity remains 0 while arrow ascends and glare moves to center, then flashes 1 (2.8s - 3.8s), then fades back to 0 at 4.2s
                    opacity: [0, 0, 0, 1, 1, 0, 0],
                    filter: [
                      'drop-shadow(0 0 0px rgba(255,255,255,0))',
                      'drop-shadow(0 0 0px rgba(255,255,255,0))',
                      'drop-shadow(0 0 0px rgba(255,255,255,0))',
                      'drop-shadow(0 0 12px rgba(255,255,255,0.85)) drop-shadow(0 0 3px rgba(255,255,255,0.95))',
                      'drop-shadow(0 0 8px rgba(255,255,255,0.5))',
                      'drop-shadow(0 0 0px rgba(255,255,255,0))',
                      'drop-shadow(0 0 0px rgba(255,255,255,0))',
                    ],
                  }
                : { opacity: 0 }
            }
            transition={{
              duration: totalDuration,
              times: [0, 0.20, 0.56, 0.68, 0.76, 0.84, 1.0],
              ease: 'easeInOut',
            }}
          >
            STATIONS
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
}
