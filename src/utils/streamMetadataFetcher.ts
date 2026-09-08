import { StreamChannel, Track } from '../data';
import { parseTrackMetadata, getCachedTrackCover, fetchTrackCover, getStyleFallbackCover } from './artworkFetcher';

export interface StreamLiveMetadata {
  title: string;
  artist: string;
  coverUrl: string;
  duration: number;
  playedAt?: number;
  elapsed?: number;
  isLive?: boolean;
  history?: Track[];
}

/**
 * Extract clean, playable stream audio URL from a StreamChannel
 */
export function getStreamAudioUrl(stream?: StreamChannel | null): string {
  if (!stream) return '';
  return (stream.streamUrl || stream.tracks?.[0]?.audioUrl || '').trim();
}

/**
 * Extract candidate shortcodes and identifiers from stream URL, stream ID and station name
 */
export function getStationCandidateKeys(stream: StreamChannel): string[] {
  const candidates = new Set<string>();
  const streamUrl = getStreamAudioUrl(stream);

  if (streamUrl) {
    try {
      const parsedUrl = new URL(streamUrl);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      segments.forEach(seg => {
        const clean = seg.replace(/\.(m3u8|mp3|aac|ogg|pls|json)$/i, '').trim();
        if (clean && !['hls', 'listen', 'radio', 'live', 'stream', 'audio'].includes(clean.toLowerCase())) {
          candidates.add(clean);
          candidates.add(clean.replace(/-/g, '_'));
          candidates.add(clean.replace(/_/g, '-'));
        }
      });
    } catch {}
  }

  if (stream.id && stream.id !== 'standby') {
    candidates.add(stream.id);
    candidates.add(stream.id.replace(/-/g, '_'));
    candidates.add(stream.id.replace(/_/g, '-'));
    candidates.add(stream.id.replace(/[-_]t-?$/i, ''));
  }

  if (stream.name) {
    const cleanName = stream.name
      .replace(/^radio\s*synapse\s*[-–—:]\s*/i, '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (cleanName) {
      candidates.add(cleanName);
      candidates.add(cleanName.replace(/-/g, '_'));
    }
  }

  // Common station shortcodes and numerical IDs on AzuraCast
  candidates.add('pop-variete');
  candidates.add('pop_variete');
  candidates.add('1');
  candidates.add('2');
  candidates.add('3');

  return Array.from(candidates);
}

/**
 * Intelligent matcher to find the right station in AzuraCast / Icecast nowplaying API
 */
export function matchNowPlayingStation(azuraList: any[] | null | undefined, stream: StreamChannel | null | undefined): any | null {
  if (!Array.isArray(azuraList) || azuraList.length === 0 || !stream || stream.id === 'standby') {
    return null;
  }

  const streamId = (stream.id || '').toLowerCase().trim();
  const streamUrl = (stream.streamUrl || stream.tracks?.[0]?.audioUrl || '').toLowerCase().trim();
  const streamName = (stream.name || '').toLowerCase().trim();

  // 1. Direct shortcode or station ID match
  const directMatch = azuraList.find((item: any) => {
    const sc = (item?.station?.shortcode || '').toLowerCase().trim();
    const sId = String(item?.station?.id || '').toLowerCase().trim();
    return (
      (sc && sc === streamId) ||
      (sId && sId === streamId) ||
      (sc === 'disco_funk' && streamId === 'disco-funk') ||
      (sc === 'disco-funk' && streamId === 'disco_funk')
    );
  });
  if (directMatch) return directMatch;

  // 2. Stream URL match (mount path, shortcode in URL, or listen_url)
  if (streamUrl) {
    const urlMatch = azuraList.find((item: any) => {
      const listenUrl = (item?.station?.listen_url || '').toLowerCase().trim();
      const sc = (item?.station?.shortcode || '').toLowerCase().trim();
      
      if (listenUrl && (streamUrl.includes(listenUrl) || listenUrl.includes(streamUrl))) {
        return true;
      }
      if (sc && streamUrl.includes(sc)) {
        return true;
      }

      // Check mount points
      if (Array.isArray(item?.station?.mounts)) {
        const hasMount = item.station.mounts.some((m: any) => {
          const mUrl = (m.url || '').toLowerCase().trim();
          const mPath = (m.path || '').toLowerCase().trim();
          return (mUrl && streamUrl.includes(mUrl)) || (mPath && streamUrl.includes(mPath));
        });
        if (hasMount) return true;
      }

      return false;
    });
    if (urlMatch) return urlMatch;
  }

  // 3. Name fuzzy match
  if (streamName) {
    const cleanStreamName = streamName.replace(/^radio\s*synapse\s*[-–—:]\s*/i, '').trim();
    const nameMatch = azuraList.find((item: any) => {
      const itemStationName = (item?.station?.name || '').toLowerCase().trim();
      const cleanItemName = itemStationName.replace(/^radio\s*synapse\s*[-–—:]\s*/i, '').trim();
      return (
        cleanItemName === cleanStreamName ||
        itemStationName.includes(cleanStreamName) ||
        cleanStreamName.includes(cleanItemName)
      );
    });
    if (nameMatch) return nameMatch;
  }

  // 4. Single station fallback: if AzuraCast host has 1 station and user stream is valid, match it
  if (azuraList.length === 1 && stream.id !== 'standby') {
    return azuraList[0];
  }

  return null;
}

/**
 * Probes the live stream endpoint (AzuraCast API or Icecast status) to extract real-time tags and history
 */
export async function probeLiveStreamMetadata(stream: StreamChannel): Promise<{
  title: string;
  artist: string;
  coverUrl?: string;
  duration?: number;
  playedAt?: number;
  elapsed?: number;
  history?: Track[];
} | null> {
  const streamUrl = getStreamAudioUrl(stream);
  if (!streamUrl || stream.id === 'standby') return null;

  try {
    const urlObj = new URL(streamUrl);
    const origin = urlObj.origin;
    const candidates = getStationCandidateKeys(stream);
    const cacheBuster = Date.now();

    // 1. Try AzuraCast dedicated station endpoints first (handles both public and private stations)
    for (const key of candidates) {
      const endpoints = [
        `${origin}/api/nowplaying/${encodeURIComponent(key)}?_t=${cacheBuster}`,
        `${origin}/api/nowplaying_static/${encodeURIComponent(key)}.json?_t=${cacheBuster}`,
      ];

      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(ep, { signal: controller.signal, cache: 'no-store' });
          clearTimeout(t);
          if (res.ok) {
            const data = await res.json();
            const songObj = data?.now_playing?.song || (Array.isArray(data) ? data[0]?.now_playing?.song : null);
            if (songObj) {
              const { title, artist, text, art } = songObj;
              const parsed = parseTrackMetadata(title, artist, text);
              
              // Extract history if available
              let historyTracks: Track[] = [];
              const rawHistory = data?.song_history || (Array.isArray(data) ? data[0]?.song_history : null);
              if (Array.isArray(rawHistory) && rawHistory.length > 0) {
                historyTracks = rawHistory.map((h: any, idx: number) => {
                  const hParsed = parseTrackMetadata(h.song?.title, h.song?.artist, h.song?.text);
                  return {
                    id: `hist-${h.sh_id || idx}-${Date.now()}`,
                    title: hParsed.cleanTitle,
                    artist: hParsed.cleanArtist,
                    album: h.song?.album || hParsed.cleanTitle,
                    coverUrl: h.song?.art || '',
                    duration: h.duration || 240,
                    audioUrl: streamUrl,
                  };
                });
              }

              // Resolve real cover art via iTunes/Deezer/AzuraCast
              const realCover = await fetchTrackCover(parsed.cleanTitle, parsed.cleanArtist, text, art, stream.genre);

              return {
                title: parsed.cleanTitle,
                artist: parsed.cleanArtist,
                coverUrl: realCover || art,
                duration: Math.round(data?.now_playing?.duration || 240),
                playedAt: data?.now_playing?.played_at,
                elapsed: data?.now_playing?.elapsed,
                history: historyTracks,
              };
            }
          }
        } catch {}
      }
    }

    // 2. Try global AzuraCast nowplaying
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${origin}/api/nowplaying?_t=${cacheBuster}`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const matched = matchNowPlayingStation(data, stream);
          if (matched?.now_playing?.song) {
            const { title, artist, text, art } = matched.now_playing.song;
            const parsed = parseTrackMetadata(title, artist, text);
            const realCover = await fetchTrackCover(parsed.cleanTitle, parsed.cleanArtist, text, art, stream.genre);
            return {
              title: parsed.cleanTitle,
              artist: parsed.cleanArtist,
              coverUrl: realCover || art,
              duration: Math.round(matched.now_playing.duration || 240),
              playedAt: matched.now_playing.played_at,
              elapsed: matched.now_playing.elapsed,
            };
          }
        }
      }
    } catch {}

    // 3. Try Icecast status-json.json on station origin
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${origin}/status-json.json`, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        const sources = Array.isArray(data?.icestats?.source) 
          ? data.icestats.source 
          : (data?.icestats?.source ? [data.icestats.source] : []);

        const matchedSource = sources.find((s: any) => {
          const mount = (s.listenurl || s.mount || '').toLowerCase();
          return mount && streamUrl.toLowerCase().includes(mount);
        }) || sources[0];

        if (matchedSource) {
          const rawTitle = matchedSource.title || matchedSource.yp_currently_playing;
          const rawArtist = matchedSource.artist;
          if (rawTitle || rawArtist) {
            const parsed = parseTrackMetadata(rawTitle, rawArtist);
            const realCover = await fetchTrackCover(parsed.cleanTitle, parsed.cleanArtist, undefined, undefined, stream.genre);
            return {
              title: parsed.cleanTitle,
              artist: parsed.cleanArtist,
              coverUrl: realCover,
              duration: 240,
            };
          }
        }
      }
    } catch {}
  } catch {}

  return null;
}

/**
 * Extract guaranteed, non-empty Title, Artist and Cover for ANY stream channel
 */
export function getGuaranteedStationInfo(stream: StreamChannel): {
  title: string;
  artist: string;
  coverUrl: string;
  duration: number;
} {
  if (!stream || stream.id === 'standby') {
    return {
      title: 'En attente de diffusion',
      artist: 'Radio Synapse',
      coverUrl: getStyleFallbackCover('Radio Synapse', 'Radio Synapse'),
      duration: 240,
    };
  }

  const defaultTrack = stream.tracks?.[0];
  const stationName = stream.name || 'Radio Synapse';
  const genre = stream.genre || '';

  const title = defaultTrack?.title && defaultTrack.title !== 'En direct' && defaultTrack.title !== stationName
    ? defaultTrack.title
    : (stationName.replace(/^radio\s*synapse\s*[-–—:]\s*/i, '').trim() || stationName);

  const artist = defaultTrack?.artist && defaultTrack.artist !== 'Radio Synapse' && defaultTrack.artist !== genre
    ? defaultTrack.artist
    : (genre ? genre : stationName);

  const cachedCover = getCachedTrackCover(title, artist);
  const coverUrl = cachedCover 
    || defaultTrack?.coverUrl 
    || stream.coverUrl 
    || '';

  return {
    title,
    artist,
    coverUrl,
    duration: defaultTrack?.duration || 240,
  };
}
