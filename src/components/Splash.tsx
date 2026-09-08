import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playCdStartupSound } from '../utils/cdAudioFx';

interface SplashProps {
  onTopBarAppear?: () => void;
  onComplete: () => void;
}

export default function Splash({ onTopBarAppear, onComplete }: SplashProps) {
  const onTopBarAppearRef = useRef(onTopBarAppear);
  onTopBarAppearRef.current = onTopBarAppear;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(false);

  const [phase, setPhase] = useState<'appear' | 'sweep' | 'star' | 'exit'>('appear');
  const logoRef = useRef<HTMLDivElement>(null);
  const [targetTransform, setTargetTransform] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: -320,
    scale: 0.38,
  });

  const calculateTargetTransform = () => {
    const targetEl = document.getElementById('topbar-brand-logo-target');
    const splashTextEl = document.getElementById('splash-brand-logo-text') || logoRef.current;
    
    if (targetEl && splashTextEl) {
      const targetRect = targetEl.getBoundingClientRect();
      const splashRect = splashTextEl.getBoundingClientRect();
      
      if (targetRect.width > 0 && splashRect.width > 0) {
        // Target logo center coordinates on screen
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        // Splash logo center coordinates on screen (before exit transform)
        const splashCenterX = splashRect.left + splashRect.width / 2;
        const splashCenterY = splashRect.top + splashRect.height / 2;

        const deltaX = targetCenterX - splashCenterX;
        const deltaY = targetCenterY - splashCenterY;
        const scale = targetRect.width / splashRect.width;

        setTargetTransform({
          x: deltaX,
          y: deltaY,
          scale: scale,
        });
      }
    }
  };

  useEffect(() => {
    calculateTargetTransform();
    window.addEventListener('resize', calculateTargetTransform);
    return () => window.removeEventListener('resize', calculateTargetTransform);
  }, []);

  useEffect(() => {
    // Play sound once on mount
    playCdStartupSound();

    // Phase 1: Text appears, start chromatic sweep inside letters
    const tSweep = setTimeout(() => {
      setPhase('sweep');
    }, 300);

    // Phase 2: Sweep reaches top-right corner of 'E' -> Star bursts into existence
    const tStar = setTimeout(() => {
      setPhase('star');
    }, 950);

    // Phase 3: Smooth exit transition towards top bar (Top bar appears simultaneously)
    const tExit = setTimeout(() => {
      calculateTargetTransform();
      setPhase('exit');
      onTopBarAppearRef.current?.();
    }, 1800);

    // Phase 4: Complete transition and trigger player entrance (850ms after exit starts)
    const tComplete = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 2650);

    return () => {
      clearTimeout(tSweep);
      clearTimeout(tStar);
      clearTimeout(tExit);
      clearTimeout(tComplete);
    };
  }, []); // Run ONCE on mount

  const handleSkip = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      onTopBarAppearRef.current?.();
      onCompleteRef.current();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        id="splash-screen-container"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={handleSkip}
        className={`fixed inset-0 flex items-center justify-center p-0 text-white z-50 select-none overflow-hidden ${
          phase === 'exit' ? 'pointer-events-none' : 'cursor-pointer'
        }`}
        title="Cliquer pour passer directement au lecteur"
      >
        {/* Subtle deep space background vignette - Fades out on exit to reveal the player screen underneath */}
        <motion.div 
          initial={{ opacity: 1 }}
          animate={{ opacity: phase === 'exit' ? 0 : 1 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 bg-[#000000] pointer-events-none z-0"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,20,30,0.5)_0%,rgba(0,0,0,1)_100%)]" />
        </motion.div>

        {/* Centerpiece: Animated RADIO SYNAPSE centered on all axes (Star overlay does not offset text) */}
        <div className="relative flex items-center justify-center z-20 w-full h-full">
          <div className="relative inline-flex items-center justify-center text-center">
            
            {/* Primary Typography Layer in font-futuristic, bold & high-contrast */}
            <motion.div
              ref={logoRef}
              initial={{ opacity: 0, scale: 0.92, x: 0, y: 0 }}
              animate={
                phase === 'exit'
                  ? {
                      x: targetTransform.x,
                      y: targetTransform.y,
                      scale: targetTransform.scale,
                      opacity: 1,
                    }
                  : { opacity: 1, scale: 1, x: 0, y: 0 }
              }
              transition={{ 
                duration: phase === 'exit' ? 0.85 : 0.8, 
                ease: [0.22, 1, 0.36, 1] 
              }}
              className="relative inline-flex items-center justify-center select-none transform-gpu"
              style={{
                willChange: 'transform, opacity',
                transformOrigin: 'center center',
                WebkitFontSmoothing: 'antialiased',
                backfaceVisibility: 'hidden',
              }}
            >
              <h1
                id="splash-brand-logo-text"
                className="font-futuristic font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl tracking-[0.22em] mr-[-0.22em] uppercase leading-none whitespace-nowrap relative z-10 text-white flex items-center justify-center"
                style={{
                  textShadow: '0 0 25px rgba(255,255,255,0.4), 0 4px 12px rgba(0,0,0,0.9)',
                }}
              >
                <span>RADIO </span>
                <span>SYNAPS</span>
                <span className="relative inline-block">
                  E

                  {/* 🌟 4-POINT CHROMATIC NEURAL STAR PRECISELY OVER THE UPPER RIGHT CORNER OF 'E' */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={
                      phase === 'star' || phase === 'exit'
                        ? {
                            scale: [0, 1.35, 1],
                            opacity: 1,
                          }
                        : { scale: 0, opacity: 0 }
                    }
                    transition={{
                      duration: 0.35,
                      ease: [0.175, 0.885, 0.32, 1.275],
                    }}
                    className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 pointer-events-none z-30 flex items-center justify-center overflow-visible"
                  >
                    <svg
                      viewBox="0 0 40 40"
                      fill="none"
                      className="w-full h-full overflow-visible animate-[spin_10s_linear_infinite]"
                    >
                      <defs>
                        <linearGradient id="splashStarGradV2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#00f2ff" />
                          <stop offset="30%" stopColor="#ffffff" />
                          <stop offset="65%" stopColor="#ff00a0" />
                          <stop offset="100%" stopColor="#ffd700" />
                        </linearGradient>
                      </defs>

                      {/* Clean Solid 4-Point Star with refined slender center and slim tapered branch bases */}
                      <path
                        d="M 20 1.5 
                           C 20.5 12.5 24.5 16.8 38.8 19.0 
                           C 24.8 21.0 20.6 24.8 19.8 38.8 
                           C 19.0 25.0 15.0 20.6 1.2 20.0 
                           C 15.0 19.0 19.2 12.5 20 1.5 Z"
                        fill="url(#splashStarGradV2)"
                        style={{
                          filter: 'drop-shadow(0 0 8px rgba(0,242,255,0.95)) drop-shadow(0 0 16px rgba(255,0,160,0.8))',
                        }}
                      />
                    </svg>

                    {/* ⚡ ULTRA-BRIEF OPTICAL SPECULAR LIGHT FLASH (0.22s, pure burst with NO expanding rings) */}
                    {phase === 'star' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.3, 1.8, 0.4] }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="absolute -inset-4 pointer-events-none flex items-center justify-center"
                      >
                        {/* Crisp horizontal and vertical optical lens flares */}
                        <div className="absolute w-24 sm:w-36 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_12px_#ffffff]" />
                        <div className="absolute h-24 sm:h-36 w-[2px] bg-gradient-to-b from-transparent via-white to-transparent shadow-[0_0_12px_#ffffff]" />
                        <div className="w-6 h-6 rounded-full bg-cyan-200 blur-[2px] opacity-90" />
                      </motion.div>
                    )}
                  </motion.div>
                </span>

                {/* ✨ TRAVELING PRISMATIC CD-ROM GLINT - ULTRA-FLUID, DYNAMIC, HIGHER VISIBILITY (0.65s) */}
                {phase === 'sweep' && (
                  <motion.div
                    initial={{
                      left: '0%',
                      top: '48%',
                      scale: 0.8,
                      opacity: 0,
                    }}
                    animate={{
                      left: [
                        '0%', '15%', '32%', '50%', '68%', '84%', '94%', '100%'
                      ],
                      top: [
                        '48%', '58%', '42%', '56%', '45%', '54%', '30%', '0%'
                      ],
                      scale: [
                        0.8, 1.0, 1.15, 1.25, 1.35, 1.45, 1.6, 1.7
                      ],
                      opacity: [
                        0, 1, 1, 1, 1, 1, 1, 0.2
                      ],
                    }}
                    transition={{
                      duration: 0.65,
                      ease: [0.38, 0, 0.45, 1], // Smooth, progressive acceleration
                      times: [
                        0, 0.15, 0.32, 0.50, 0.68, 0.84, 0.94, 1
                      ],
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 pointer-events-none z-35 flex items-center justify-center"
                  >
                    {/* Prismatic CD diffraction holographic flares (vibrant & wide) */}
                    <div className="absolute w-20 sm:w-28 h-[3px] rotate-[-25deg] bg-gradient-to-r from-transparent via-[#00f2ff] via-[#ffffff] via-[#ff00a0] to-transparent shadow-[0_0_15px_#00f2ff,0_0_25px_#ff00a0]" />
                    <div className="absolute w-14 sm:w-20 h-[2px] rotate-[65deg] bg-gradient-to-r from-transparent via-[#ffd700] via-[#ffffff] via-[#00f2ff] to-transparent shadow-[0_0_12px_#ffd700]" />
                    
                    {/* Glowing chromatic diffusion aura */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00f2ff]/80 via-[#ff00a0]/70 to-[#ffd700]/80 blur-[8px] animate-pulse" />
                    <div className="absolute inset-2 rounded-full bg-white/60 blur-[3px]" />
                    
                    {/* Super bright specular white core */}
                    <div className="w-3.5 sm:w-4.5 h-3.5 sm:h-4.5 rounded-full bg-white shadow-[0_0_15px_#ffffff,0_0_30px_#00f2ff,0_0_45px_#ff00a0]" />
                  </motion.div>
                )}

                {/* ✨ CHROMATIC CD-ROM REFLECTION SWEEP - INTENSE PRISMATIC CONTRAST ACROSS LETTERS */}
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 select-none pointer-events-none z-20"
                  style={{
                    backgroundImage:
                      'linear-gradient(115deg, transparent 0%, rgba(0,242,255,0) 10%, rgba(0,242,255,0.95) 24%, rgba(0,255,180,1) 34%, #ffffff 48%, rgba(255,230,0,1) 58%, rgba(255,0,160,0.95) 70%, rgba(180,0,255,0.85) 82%, transparent 100%)',
                    backgroundSize: '240% 100%',
                    backgroundRepeat: 'no-repeat',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 12px rgba(0,242,255,0.7)) drop-shadow(0 0 20px rgba(255,0,160,0.5))',
                  }}
                  initial={{ backgroundPosition: '200% 0%', opacity: 0 }}
                  animate={
                    phase === 'sweep' || phase === 'star' || phase === 'exit'
                      ? {
                          backgroundPosition: ['200% 0%', '-40% 0%'],
                          opacity: [0, 1, 1, 0.9, 0],
                        }
                      : { backgroundPosition: '200% 0%', opacity: 0 }
                  }
                  transition={{
                    duration: 0.65,
                    ease: [0.38, 0, 0.45, 1],
                    times: [0, 1],
                  }}
                >
                  <span>RADIO </span>
                  <span>SYNAPSE</span>
                </motion.span>
              </h1>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

