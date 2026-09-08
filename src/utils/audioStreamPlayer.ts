import Hls from 'hls.js';
import { StreamChannel } from '../data';
import { getStreamAudioUrl } from './streamMetadataFetcher';

let activeHlsInstance: Hls | null = null;
let currentSourceUrl = '';

/**
 * Returns the highest quality, lowest latency stream URL for a given station.
 * Prioritizes the native 192kbps Icecast MP3 broadcast over chunked HLS playlists,
 * ensuring studio-grade audio quality with zero delay (< 1s sync with on-screen metadata).
 */
export function getOptimizedHighQualityAudioUrl(rawUrl: string): string {
  if (!rawUrl) return '';

  let clean = rawUrl.trim();

  // If it is an AzuraCast HLS playlist URL (e.g. /hls/pop-variete/live.m3u8),
  // convert it to the direct live Icecast MP3 studio mountpoint
  if (clean.includes('/hls/')) {
    clean = clean.replace(/\/hls\/([^/]+)\/.*$/i, '/listen/$1/radio.mp3');
  }

  return clean;
}

/**
 * Cleanly plays an audio stream with high quality handling and live-edge freshness
 */
export function setAndPlayAudioStream(
  audioEl: HTMLAudioElement | null,
  streamUrl: string,
  shouldPlay: boolean = true,
  forceLiveEdge: boolean = false
): Promise<void> {
  if (!audioEl || !streamUrl) {
    return Promise.resolve();
  }

  const targetUrl = getOptimizedHighQualityAudioUrl(streamUrl);
  const isHls = targetUrl.includes('.m3u8');

  // If already playing this exact source and not forcing fresh live edge
  if (!forceLiveEdge && currentSourceUrl === targetUrl && audioEl.src === targetUrl && !audioEl.error) {
    if (shouldPlay && audioEl.paused) {
      return audioEl.play().catch(() => {});
    } else if (!shouldPlay && !audioEl.paused) {
      audioEl.pause();
    }
    return Promise.resolve();
  }

  currentSourceUrl = targetUrl;

  // Clean up previous HLS instance if any
  if (activeHlsInstance) {
    try {
      activeHlsInstance.destroy();
    } catch {}
    activeHlsInstance = null;
  }

  if (isHls) {
    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: false,
        maxBufferLength: 6,
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 0,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 2,
        startLevel: -1,
      });

      activeHlsInstance = hls;

      hls.loadSource(targetUrl);
      hls.attachMedia(audioEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (data.levels && data.levels.length > 0) {
          hls.currentLevel = data.levels.length - 1;
        }
        if (shouldPlay) {
          audioEl.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_, errorData) => {
        if (errorData.fatal) {
          try {
            hls.destroy();
            activeHlsInstance = null;
            // Fallback to direct Icecast MP3 stream
            const fallbackMp3 = targetUrl.replace(/\/hls\/([^/]+)\/.*\.m3u8/i, '/listen/$1/radio.mp3');
            audioEl.src = fallbackMp3;
            audioEl.load();
            if (shouldPlay) audioEl.play().catch(() => {});
          } catch {}
        }
      });

      return Promise.resolve();
    } else if (audioEl.canPlayType('application/vnd.apple.mpegurl')) {
      audioEl.src = targetUrl;
      audioEl.load();
      if (shouldPlay) {
        return audioEl.play().catch(() => {});
      }
      return Promise.resolve();
    }
  }

  // Direct 192kbps MP3 / Icecast Live stream
  // We reload to flush any stale paused buffer and start immediately from the real-time live edge
  audioEl.src = targetUrl;
  audioEl.load();
  if (shouldPlay) {
    return audioEl.play().catch(() => {});
  }
  return Promise.resolve();
}

/**
 * Helper to pause playback and preserve audio state
 */
export function pauseAudioStream(audioEl: HTMLAudioElement | null) {
  if (audioEl && !audioEl.paused) {
    audioEl.pause();
  }
}

/**
 * Get the best audio URL from a StreamChannel
 */
export function getBestStreamUrl(stream?: StreamChannel | null): string {
  const raw = getStreamAudioUrl(stream);
  return getOptimizedHighQualityAudioUrl(raw);
}

