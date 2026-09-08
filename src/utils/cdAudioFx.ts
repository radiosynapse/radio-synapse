/**
 * Authentic Web Audio Synthesizer replicating a genuine CD / MiniDisc player reading a disc:
 * - Crisp mechanical disc clamp & micro-latch
 * - Very quiet, subtle high-frequency disc spindle hum (no heavy air rush / no vacuum roar)
 * - Authentic optical laser pickup focus servo chatter ("t-t-t-t-t-k-k-k-k... ch-k-k-k-k-k-k")
 * - Laser tracking seek micro-steps reading the TOC track
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playCdStartupSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Master Bus (calibrated to a clean, crisp listening level)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.55, now);
    masterGain.connect(ctx.destination);

    // =========================================================================
    // 1. CLIC D'ENCLENCHEMENT DU DISQUE (Subtle, dry mechanical clamp snap)
    // =========================================================================
    
    // Dry high-frequency plastic/magnetic latch click (t = 0.03s)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    const snapFilter = ctx.createBiquadFilter();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(3800, now + 0.03);
    snapOsc.frequency.exponentialRampToValueAtTime(800, now + 0.055);

    snapFilter.type = 'bandpass';
    snapFilter.frequency.setValueAtTime(3200, now + 0.03);
    snapFilter.Q.setValueAtTime(4.0, now + 0.03);

    snapGain.gain.setValueAtTime(0.35, now + 0.03);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    snapOsc.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(masterGain);
    snapOsc.start(now + 0.03);
    snapOsc.stop(now + 0.065);

    // Subtle micro-chuck click (t = 0.08s)
    const chuckOsc = ctx.createOscillator();
    const chuckGain = ctx.createGain();
    chuckOsc.type = 'square';
    chuckOsc.frequency.setValueAtTime(2400, now + 0.08);
    chuckOsc.frequency.exponentialRampToValueAtTime(400, now + 0.105);
    chuckGain.gain.setValueAtTime(0.2, now + 0.08);
    chuckGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    chuckOsc.connect(chuckGain);
    chuckGain.connect(masterGain);
    chuckOsc.start(now + 0.08);
    chuckOsc.stop(now + 0.12);

    // =========================================================================
    // 2. ROTATION DISQUE SUBTILE (Clean, subtle spindle motor hum - NOT loud air)
    // =========================================================================
    const motorOsc = ctx.createOscillator();
    const motorGain = ctx.createGain();
    const motorFilter = ctx.createBiquadFilter();

    motorOsc.type = 'sine';
    motorOsc.frequency.setValueAtTime(110, now + 0.15);
    // Smooth, gentle spin-up to 320 Hz
    motorOsc.frequency.exponentialRampToValueAtTime(280, now + 0.9);
    motorOsc.frequency.linearRampToValueAtTime(295, now + 2.5);

    motorFilter.type = 'lowpass';
    motorFilter.frequency.setValueAtTime(380, now + 0.15);
    motorFilter.frequency.exponentialRampToValueAtTime(650, now + 0.9);

    // Very quiet level so it never overpowers the mechanical reading chatter
    motorGain.gain.setValueAtTime(0.001, now + 0.15);
    motorGain.gain.linearRampToValueAtTime(0.065, now + 0.5);
    motorGain.gain.setValueAtTime(0.065, now + 1.8);
    motorGain.gain.exponentialRampToValueAtTime(0.005, now + 2.8);

    motorOsc.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(masterGain);
    motorOsc.start(now + 0.15);
    motorOsc.stop(now + 2.9);

    // Very soft 2nd harmonic for disc spinning presence
    const harmonicOsc = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonicOsc.type = 'triangle';
    harmonicOsc.frequency.setValueAtTime(220, now + 0.15);
    harmonicOsc.frequency.exponentialRampToValueAtTime(560, now + 0.9);
    harmonicGain.gain.setValueAtTime(0.001, now + 0.15);
    harmonicGain.gain.linearRampToValueAtTime(0.025, now + 0.5);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    harmonicOsc.connect(harmonicGain);
    harmonicGain.connect(masterGain);
    harmonicOsc.start(now + 0.15);
    harmonicOsc.stop(now + 2.6);

    // =========================================================================
    // 3. BRUITS DE LECTURE OPTIQUE AUTHENTIQUES (Laser Focus / Tracking Servo Chatter)
    // "ch-k-k-k-k-k-k... t-t-t-t-t-t... k-k-k-k-k-k... zrr-t-t-t"
    // =========================================================================

    // Realistic rapid tracking micro-pulses
    const trackingBursts = [
      // Sled seek 1 (t = 0.25s - 0.55s)
      0.25, 0.28, 0.31, 0.34, 0.37, 0.40, 0.44, 0.48, 0.52,
      // Focus lock attempt (t = 0.68s - 0.95s)
      0.68, 0.71, 0.73, 0.76, 0.78, 0.81, 0.84, 0.87, 0.91, 0.94,
      // TOC data read streams (t = 1.15s - 1.65s)
      1.15, 1.17, 1.20, 1.22, 1.25, 1.27, 1.30, 1.33, 1.37, 1.41, 1.45, 1.48, 1.52, 1.56, 1.60,
      // Final track lock (t = 1.85s - 2.2s)
      1.85, 1.88, 1.92, 1.96, 2.02, 2.08, 2.15, 2.22
    ];

    trackingBursts.forEach((tOffset, i) => {
      const pulseOsc = ctx.createOscillator();
      const pulseGain = ctx.createGain();
      const pulseFilter = ctx.createBiquadFilter();

      // Alternating timbre between metallic tick and soft coil chatter
      pulseOsc.type = i % 3 === 0 ? 'sawtooth' : i % 2 === 0 ? 'square' : 'triangle';
      
      const baseFreq = 1600 + (Math.sin(i * 1.7) * 450);
      pulseOsc.frequency.setValueAtTime(baseFreq, now + tOffset);
      pulseOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + tOffset + 0.014);

      pulseFilter.type = 'bandpass';
      pulseFilter.frequency.setValueAtTime(2200 + (i % 4) * 300, now + tOffset);
      pulseFilter.Q.setValueAtTime(5.5, now + tOffset);

      const vol = (0.12 + Math.sin(i) * 0.04) * (tOffset > 1.8 ? 0.7 : 1.0);
      pulseGain.gain.setValueAtTime(vol, now + tOffset);
      pulseGain.gain.exponentialRampToValueAtTime(0.001, now + tOffset + 0.015);

      pulseOsc.connect(pulseFilter);
      pulseFilter.connect(pulseGain);
      pulseGain.connect(masterGain);

      pulseOsc.start(now + tOffset);
      pulseOsc.stop(now + tOffset + 0.018);
    });

    // Coil servo buzzing sweeps (subtle focus search flutter)
    const servoMoments = [
      { start: 0.65, dur: 0.18, freq1: 680, freq2: 920 },
      { start: 1.12, dur: 0.22, freq1: 820, freq2: 1250 },
      { start: 1.82, dur: 0.15, freq1: 950, freq2: 650 },
    ];

    servoMoments.forEach(({ start, dur, freq1, freq2 }) => {
      const servoOsc = ctx.createOscillator();
      const servoGain = ctx.createGain();
      const servoFilter = ctx.createBiquadFilter();

      servoOsc.type = 'triangle';
      servoOsc.frequency.setValueAtTime(freq1, now + start);
      servoOsc.frequency.linearRampToValueAtTime(freq2, now + start + dur);

      servoFilter.type = 'bandpass';
      servoFilter.frequency.setValueAtTime(1400, now + start);
      servoFilter.Q.setValueAtTime(3.5, now + start);

      servoGain.gain.setValueAtTime(0.001, now + start);
      servoGain.gain.linearRampToValueAtTime(0.07, now + start + 0.03);
      servoGain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      servoOsc.connect(servoFilter);
      servoFilter.connect(servoGain);
      servoGain.connect(masterGain);

      servoOsc.start(now + start);
      servoOsc.stop(now + start + dur + 0.02);
    });

  } catch {
    // Gracefully handle browser policy limitations
  }
}
