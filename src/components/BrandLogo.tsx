interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withStar?: boolean;
  className?: string;
  isAnimated?: boolean;
  isChromaticText?: boolean;
}

export default function BrandLogo({
  size = 'md',
  withStar = true,
  className = '',
  isAnimated = false,
  isChromaticText = false,
}: BrandLogoProps) {
  // Sizing scales matching font-futuristic hierarchy
  const sizeClasses = {
    sm: 'text-[11px] sm:text-xs tracking-[0.2em] mr-[-0.2em]',
    md: 'text-xs sm:text-sm md:text-base tracking-[0.22em] mr-[-0.22em]',
    lg: 'text-lg sm:text-xl md:text-2xl tracking-[0.25em] mr-[-0.25em]',
    xl: 'text-2xl sm:text-3xl md:text-4xl tracking-[0.28em] mr-[-0.28em]',
  };

  const starSizes = {
    sm: 'w-3.5 h-3.5 top-0 right-0 -translate-y-1/2 translate-x-1/2',
    md: 'w-4 h-4 top-0 right-0 -translate-y-1/2 translate-x-1/2',
    lg: 'w-6 h-6 top-0 right-0 -translate-y-1/2 translate-x-1/2',
    xl: 'w-8 h-8 top-0 right-0 -translate-y-1/2 translate-x-1/2',
  };

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <div className="relative inline-block">
        {/* Main Brand Typography in bold white or optional chromatic sweep */}
        <span 
          className={`font-futuristic font-black uppercase whitespace-nowrap leading-none ${
            isChromaticText ? 'chromatic-text-sweep' : 'text-white'
          } ${sizeClasses[size]}`}
          style={!isChromaticText ? {
            textShadow: '0 0 16px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.8)',
          } : undefined}
        >
          <span>RADIO </span>
          <span>SYNAPS</span>
          <span className="relative inline-block">
            E
            {/* Chromatic Star-Synapse Hybrid positioned precisely over top-right corner of 'E' */}
            {withStar && (
              <span className={`absolute ${starSizes[size]} pointer-events-none z-10 flex items-center justify-center overflow-visible`}>
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  className={`w-full h-full overflow-visible ${isAnimated ? 'animate-[spin_12s_linear_infinite]' : ''}`}
                >
                  <defs>
                    {/* Multi-stop liquid chromatic metal gradient with animated sheen sweep */}
                    <linearGradient id="logoSynapseStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00f2ff">
                        <animate attributeName="stop-color" values="#00f2ff;#ff00a0;#ffd700;#8b5cf6;#00f2ff" dur="6s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="25%" stopColor="#ffffff">
                        <animate attributeName="stop-color" values="#ffffff;#00f2ff;#ff00a0;#ffd700;#ffffff" dur="6s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="50%" stopColor="#3b82f6">
                        <animate attributeName="stop-color" values="#3b82f6;#ffd700;#00f2ff;#ff00a0;#3b82f6" dur="6s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="75%" stopColor="#ff00a0">
                        <animate attributeName="stop-color" values="#ff00a0;#8b5cf6;#ffffff;#00f2ff;#ff00a0" dur="6s" repeatCount="indefinite" />
                      </stop>
                      <stop offset="100%" stopColor="#ffd700">
                        <animate attributeName="stop-color" values="#ffd700;#00f2ff;#ff00a0;#ffffff;#ffd700" dur="6s" repeatCount="indefinite" />
                      </stop>
                    </linearGradient>
                  </defs>
                  
                  {/* Clean, sleek 4-point solid star with refined slender center and slim tapered branch bases */}
                  <path
                    d="M 16 1.0 
                       C 16.5 10.2 19.6 13.5 31.0 15.2 
                       C 19.8 16.8 16.5 19.8 15.8 31.0 
                       C 15.2 20.0 12.0 16.5 1.0 16.0 
                       C 12.0 15.2 15.5 10.2 16 1.0 Z"
                    fill="url(#logoSynapseStarGrad)"
                    style={{
                      filter: 'drop-shadow(0 0 6px rgba(0,242,255,0.85)) drop-shadow(0 0 10px rgba(255,0,160,0.65))',
                    }}
                  />
                </svg>
              </span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
