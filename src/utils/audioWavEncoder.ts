/**
 * Radio Synapse - Audio WAV PCM 16-bit Broadcast Encoder
 * Converts any browser audio recording (WebM, OGG, Opus) into standard RIFF PCM 16-bit WAV.
 * This guarantees 100% compatibility with Liquidsoap, Icecast and AutoDJ streaming engines without skips.
 */

export async function convertBlobToWav(blob: Blob, targetSampleRate: number = 44100): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return encodeAudioBufferToWav(audioBuffer, targetSampleRate);
  } finally {
    try {
      await ctx.close();
    } catch {}
  }
}

export function encodeAudioBufferToWav(audioBuffer: AudioBuffer, targetSampleRate: number = 44100): Blob {
  const numChannels = Math.min(2, audioBuffer.numberOfChannels);
  const sourceSampleRate = audioBuffer.sampleRate;
  const length = Math.floor((audioBuffer.length * targetSampleRate) / sourceSampleRate);
  
  // Resample channels if sample rates differ, or copy
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    const srcData = audioBuffer.getChannelData(c);
    if (sourceSampleRate === targetSampleRate) {
      channels.push(srcData);
    } else {
      // Linear interpolation resampling
      const resampled = new Float32Array(length);
      const ratio = (audioBuffer.length - 1) / (length - 1);
      for (let i = 0; i < length; i++) {
        const srcIdx = i * ratio;
        const low = Math.floor(srcIdx);
        const high = Math.min(audioBuffer.length - 1, low + 1);
        const frac = srcIdx - low;
        resampled[i] = srcData[low] * (1 - frac) + srcData[high] * frac;
      }
      channels.push(resampled);
    }
  }

  // Interleave channels & convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = targetSampleRate * blockAlign;
  const dataByteLength = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // File length - 8
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Write 16-bit PCM audio samples
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, Math.floor(intSample), true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
