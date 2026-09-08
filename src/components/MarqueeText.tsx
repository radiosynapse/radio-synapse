import React, { useState, useRef, useEffect } from 'react';

interface MarqueeTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  speedMultiplier?: number;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  className = '',
  style,
  speedMultiplier = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const overflowing = textRef.current.scrollWidth > containerRef.current.clientWidth + 2;
        setIsOverflowing(overflowing);
      }
    };

    // Initial check and observe size changes
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', checkOverflow);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [text]);

  // Calculate duration dynamically based on text length for a smooth reading speed
  const duration = Math.max(8, Math.min(30, text.length * 0.5)) / speedMultiplier;

  if (!isOverflowing) {
    return (
      <div ref={containerRef} className="w-full overflow-hidden">
        <span ref={textRef} className={`block truncate ${className}`} style={style}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden relative marquee-mask">
      <div
        className="flex w-max whitespace-nowrap animate-marquee"
        style={{
          animationDuration: `${duration}s`,
        }}
      >
        <span ref={textRef} className={`pr-10 inline-block ${className}`} style={style}>
          {text}
        </span>
        <span className={`pr-10 inline-block ${className}`} style={style}>
          {text}
        </span>
      </div>
    </div>
  );
};
