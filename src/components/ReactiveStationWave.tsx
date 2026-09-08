import { useEffect, useRef } from 'react';
import { attachAudioElement, getAudioSpectrum } from '../utils/audioAnalyzerManager';

interface ReactiveStationWaveProps {
  isPlaying: boolean;
  primaryColor: string;
  secondaryColor: string;
  audioElement?: HTMLAudioElement | null;
  className?: string;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export default function ReactiveStationWave({
  isPlaying,
  primaryColor,
  secondaryColor,
  audioElement,
  className = '',
}: ReactiveStationWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const POINT_COUNT = 36;
  const smoothedPointsPrimary = useRef<number[]>(new Array(POINT_COUNT).fill(0));
  const smoothedPointsSecondary = useRef<number[]>(new Array(POINT_COUNT).fill(0));

  // Dynamic color interpolation states (smoothly morphs between track cover colors)
  const currentPrimaryRgb = useRef<RGBColor>(hexToRgbObj(primaryColor));
  const currentSecondaryRgb = useRef<RGBColor>(hexToRgbObj(secondaryColor));

  // Phase counters for smooth idle flow
  const idlePhase = useRef<number>(0);

  // Attach Web Audio analyser when playing or when audio element is ready
  useEffect(() => {
    if (audioElement && isPlaying) {
      analyserRef.current = attachAudioElement(audioElement);
    }
  }, [audioElement, isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1));
    let height = (canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      height = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    const render = () => {
      // 1. Smooth color morphing towards current target track colors (transition animation)
      const targetPri = hexToRgbObj(primaryColor);
      const targetSec = hexToRgbObj(secondaryColor);
      const colorLerp = 0.05;

      currentPrimaryRgb.current.r += (targetPri.r - currentPrimaryRgb.current.r) * colorLerp;
      currentPrimaryRgb.current.g += (targetPri.g - currentPrimaryRgb.current.g) * colorLerp;
      currentPrimaryRgb.current.b += (targetPri.b - currentPrimaryRgb.current.b) * colorLerp;

      currentSecondaryRgb.current.r += (targetSec.r - currentSecondaryRgb.current.r) * colorLerp;
      currentSecondaryRgb.current.g += (targetSec.g - currentSecondaryRgb.current.g) * colorLerp;
      currentSecondaryRgb.current.b += (targetSec.b - currentSecondaryRgb.current.b) * colorLerp;

      // 2. Fetch real-time spectral frequency bars
      const spectrum = getAudioSpectrum(analyserRef.current, isPlaying, POINT_COUNT);
      idlePhase.current += 0.025;

      // 3. Smooth point physics for fluid wave motion
      for (let i = 0; i < POINT_COUNT; i++) {
        let target = isPlaying ? spectrum.bars[i] || 0 : 0;

        // Add subtle idle organic motion if not playing or during low energy
        const idleWave = Math.sin(idlePhase.current + (i / POINT_COUNT) * Math.PI * 3) * 6 + 4;
        if (!isPlaying) {
          target = idleWave;
        }

        const currPri = smoothedPointsPrimary.current[i] || 0;
        const currSec = smoothedPointsSecondary.current[i] || 0;

        // Primary wave: snappy attack, smooth decay
        if (target > currPri) {
          smoothedPointsPrimary.current[i] = currPri + (target - currPri) * 0.45;
        } else {
          smoothedPointsPrimary.current[i] = Math.max(0, currPri - 1.8);
        }

        // Secondary wave: slightly softer lag for layered depth
        const targetSecVal = target * 0.82 + Math.cos(idlePhase.current * 1.4 + i * 0.4) * 5;
        if (targetSecVal > currSec) {
          smoothedPointsSecondary.current[i] = currSec + (targetSecVal - currSec) * 0.32;
        } else {
          smoothedPointsSecondary.current[i] = Math.max(0, currSec - 1.4);
        }
      }

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const dpr = window.devicePixelRatio || 1;
      const baselineY = height;
      const maxWaveHeight = height * 0.52;

      const priColorStr = rgbaFromRgbObj(currentPrimaryRgb.current, 1);
      const secColorStr = rgbaFromRgbObj(currentSecondaryRgb.current, 1);

      // Gradient horizontally across the canvas
      const waveGrad = ctx.createLinearGradient(0, 0, width, 0);
      waveGrad.addColorStop(0, priColorStr);
      waveGrad.addColorStop(1, secColorStr);

      // --- LAYER 1: Secondary Ambient Fluid Wave (Depth Layer) ---
      drawFluidWaveLayer(
        ctx,
        smoothedPointsSecondary.current,
        width,
        baselineY,
        maxWaveHeight * 0.85,
        dpr,
        rgbaFromRgbObj(currentSecondaryRgb.current, isPlaying ? 0.12 : 0.05),
        rgbaFromRgbObj(currentSecondaryRgb.current, isPlaying ? 0.35 : 0.15),
        1.2 * dpr,
        false
      );

      // --- LAYER 2: Primary Unified Smooth Wave (Main Foreground) ---
      const fillGrad = ctx.createLinearGradient(0, height - maxWaveHeight, 0, height);
      fillGrad.addColorStop(0, rgbaFromRgbObj(currentPrimaryRgb.current, isPlaying ? 0.25 : 0.08));
      fillGrad.addColorStop(0.6, rgbaFromRgbObj(currentSecondaryRgb.current, isPlaying ? 0.12 : 0.04));
      fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      drawFluidWaveLayer(
        ctx,
        smoothedPointsPrimary.current,
        width,
        baselineY,
        maxWaveHeight,
        dpr,
        fillGrad,
        waveGrad,
        2.2 * dpr,
        true
      );

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      resizeObserver.disconnect();
    };
  }, [isPlaying, primaryColor, secondaryColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full block pointer-events-none ${className}`}
    />
  );
}

/**
 * Draws a continuous, smooth spline wave curve across the canvas width
 */
function drawFluidWaveLayer(
  ctx: CanvasRenderingContext2D,
  points: number[],
  width: number,
  baselineY: number,
  maxHeight: number,
  dpr: number,
  fillStyle: string | CanvasGradient,
  strokeStyle: string | CanvasGradient,
  lineWidth: number,
  withGlow: boolean
) {
  const count = points.length;
  if (count < 2) return;

  const pointCoords: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * width;
    const val = points[i] || 0;
    const y = baselineY - (val / 100) * maxHeight;
    pointCoords.push({ x, y });
  }

  // 1. Draw Filled Wave Path
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(pointCoords[0].x, pointCoords[0].y);

  for (let i = 0; i < count - 1; i++) {
    const p0 = pointCoords[i];
    const p1 = pointCoords[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
  }
  ctx.lineTo(pointCoords[count - 1].x, pointCoords[count - 1].y);
  ctx.lineTo(width, baselineY);
  ctx.closePath();

  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();

  // 2. Draw Glowing Top Wave Stroke Line
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pointCoords[0].x, pointCoords[0].y);

  for (let i = 0; i < count - 1; i++) {
    const p0 = pointCoords[i];
    const p1 = pointCoords[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
  }
  ctx.lineTo(pointCoords[count - 1].x, pointCoords[count - 1].y);

  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (withGlow) {
    ctx.shadowColor = typeof strokeStyle === 'string' ? strokeStyle : 'rgba(0, 242, 255, 0.6)';
    ctx.shadowBlur = 6 * dpr;
  }

  ctx.stroke();
  ctx.restore();
}

function hexToRgbObj(hex: string): RGBColor {
  if (!hex) return { r: 0, g: 242, b: 255 };
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) {
    return { r: 0, g: 242, b: 255 };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbaFromRgbObj(rgb: RGBColor, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
