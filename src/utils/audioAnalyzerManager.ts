// Web Audio Analyser & Real-time Audio Spectrum Processor
// Logarithmic frequency distribution: Basses (left) -> Mids (center) -> Treble/Aiguës (right)

let sharedAudioCtx: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let attachedSource: MediaElementAudioSourceNode | null = null;
let currentAttachedEl: HTMLAudioElement | null = null;

export interface SpectrumData {
  bars: number[];       // 16-36 frequency bands normalized 0..100 (left=bass, right=treble)
  bass: number;         // 0..1 (lows)
  mids: number;         // 0..1 (mids)
  treble: number;       // 0..1 (highs)
  overall: number;      // 0..1 (total energy)
  isLiveSignal: boolean;
}

let isGestureListenerAttached = false;

function ensureGestureResume() {
  if (isGestureListenerAttached || typeof window === 'undefined') return;
  isGestureListenerAttached = true;

  const resume = () => {
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };

  window.addEventListener('pointerdown', resume, { passive: true, once: true });
  window.addEventListener('keydown', resume, { passive: true, once: true });
  window.addEventListener('touchstart', resume, { passive: true, once: true });
}

export function getOrCreateAudioContext(): AudioContext | null {
  try {
    ensureGestureResume();
    if (!sharedAudioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    return null;
  }
}

export function attachAudioElement(audioEl: HTMLAudioElement | null): AnalyserNode | null {
  if (!audioEl) return null;

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return null;

    if (currentAttachedEl === audioEl && sharedAnalyser) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return sharedAnalyser;
    }

    if (attachedSource) {
      try {
        attachedSource.disconnect();
      } catch (e) {}
    }

    if (!sharedAnalyser) {
      sharedAnalyser = ctx.createAnalyser();
      sharedAnalyser.fftSize = 256; // 128 frequency bins
      sharedAnalyser.smoothingTimeConstant = 0.75;
      sharedAnalyser.minDecibels = -90;
      sharedAnalyser.maxDecibels = -10;
    }

    try {
      attachedSource = ctx.createMediaElementSource(audioEl);
      attachedSource.connect(sharedAnalyser);
      sharedAnalyser.connect(ctx.destination);
      currentAttachedEl = audioEl;
    } catch (attachErr) {
      console.debug('MediaElement attach notice:', attachErr);
    }

    return sharedAnalyser;
  } catch (err) {
    return sharedAnalyser;
  }
}

let simStep = 0;

export function getAudioSpectrum(analyser: AnalyserNode | null, isPlaying: boolean, barCount: number = 28): SpectrumData {
  if (!isPlaying) {
    return {
      bars: new Array(barCount).fill(0),
      bass: 0,
      mids: 0,
      treble: 0,
      overall: 0,
      isLiveSignal: false,
    };
  }

  // 1. Real Web Audio FFT with Logarithmic Frequency Scaling
  if (analyser) {
    try {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }

      // If audio signal is flowing through analyser
      if (sum > 15) {
        const bars: number[] = [];
        const minFreq = 1;
        const maxFreq = Math.min(bufferLength - 1, 96);

        for (let i = 0; i < barCount; i++) {
          const norm = i / (barCount - 1);
          const startBin = Math.floor(minFreq * Math.pow(maxFreq / minFreq, i / barCount));
          const endBin = Math.max(startBin, Math.floor(minFreq * Math.pow(maxFreq / minFreq, (i + 1) / barCount)));

          let binSum = 0;
          let count = 0;
          for (let b = startBin; b <= endBin && b < bufferLength; b++) {
            binSum += dataArray[b] || 0;
            count++;
          }
          const avg = count > 0 ? binSum / count : (dataArray[startBin] || 0);

          // Equalization boost across bands with responsive scaling
          const freqBoost = 1.0 + norm * 0.85;
          const normalized = Math.min(1, (avg / 255) * freqBoost);
          const expanded = Math.pow(normalized, 1.25) * 100;
          bars.push(Math.max(4, Math.min(100, expanded)));
        }

        const bassAvg = (bars[0] + bars[1] + bars[2] + bars[3]) / 400;
        const midsAvg = (bars[Math.floor(barCount * 0.4)] + bars[Math.floor(barCount * 0.5)] + bars[Math.floor(barCount * 0.6)]) / 300;
        const trebleAvg = (bars[barCount - 4] + bars[barCount - 3] + bars[barCount - 2] + bars[barCount - 1]) / 400;

        return {
          bars,
          bass: Math.min(1, bassAvg),
          mids: Math.min(1, midsAvg),
          treble: Math.min(1, trebleAvg),
          overall: Math.min(1, (sum / (bufferLength * 255))),
          isLiveSignal: true,
        };
      }
    } catch (e) {}
  }

  // 2. High-Energy Music Frequency Synthesizer:
  // Distinctive rhythmic movement across all bands (Basses gauche -> Médiums centre -> Aiguës droite)
  simStep += 0.075;
  const now = Date.now() / 1000;
  const bpm = 124;
  const beat = (now * (bpm / 60)) % 1;

  // Punchy 4-on-the-floor kick punch (left bass bands)
  const kick = Math.pow(Math.max(0, Math.sin(beat * Math.PI)), 5);
  // Snare/clap hit on beats 2 & 4 (center mids)
  const snare = Math.pow(Math.max(0, Math.sin(((beat + 0.5) % 1) * Math.PI)), 4) * 0.9;
  // 16th-note rhythmic hi-hat & shaker ticks (right treble bands)
  const hihat1 = Math.pow(Math.max(0, Math.sin((beat * 4) * Math.PI)), 3);
  const hihat2 = (Math.sin(simStep * 6.8) + 1) * 0.5;
  const cymbalDecay = Math.pow((Math.sin(simStep * 2.5) + 1) * 0.5, 2);

  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const norm = i / (barCount - 1); // 0.0 (bass) to 1.0 (treble)

    let energy = 0;
    if (norm < 0.30) {
      // BASSES (Gauche): Heavy kick impacts and sub-bass resonance
      const bandFactor = 1 - (norm / 0.30) * 0.6;
      const subRumble = Math.sin(simStep * 3.2 + i * 0.55) * 14;
      const groove = Math.sin(simStep * 1.8 + i * 0.4) * 8;
      energy = 10 + (kick * 82 * bandFactor) + subRumble + groove;
    } else if (norm < 0.70) {
      // MEDIUMS (Centre): Snare body, vocal melody waves, synth chords
      const midNorm = (norm - 0.30) / 0.40;
      const midBell = Math.sin(midNorm * Math.PI);
      const chordWave = Math.sin(simStep * 4.5 + i * 0.8) * 18;
      const vocalHarmonic = Math.cos(simStep * 3.1 - i * 0.6) * 12;
      energy = 8 + (snare * 72 * midBell) + chordWave + vocalHarmonic + (kick * 18 * midBell);
    } else {
      // AIGUES (Droite): Hi-hats, rapid transient sizzle, cymbal air
      const trebleNorm = (norm - 0.70) / 0.30;
      const airFactor = 0.5 + trebleNorm * 0.5;
      const fastSizzle = Math.sin(simStep * 9.2 + i * 1.4) * 12;
      const shimmer = Math.cos(simStep * 12.0 - i * 1.8) * 8;
      energy = 6 + (hihat1 * 60 * airFactor) + (hihat2 * 25 * airFactor) + (cymbalDecay * 30 * airFactor) + fastSizzle + shimmer;
    }

    bars.push(Math.max(4, Math.min(98, energy)));
  }

  return {
    bars,
    bass: 0.35 + kick * 0.65,
    mids: 0.25 + snare * 0.55,
    treble: 0.25 + hihat1 * 0.55,
    overall: 0.35 + kick * 0.4 + snare * 0.25,
    isLiveSignal: false,
  };
}
