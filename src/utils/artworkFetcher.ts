/**
 * High-Performance Intelligent Artwork & Metadata Engine for Radio Synapse
 * Features:
 * - Intelligent artist/title sanitization (strips YouTube tags, labels, brackets, suffixes)
 * - Multi-tier cover lookup: iTunes Search API (600x600/1000x1000), Deezer, MusicBrainz & Cover Art Archive
 * - AzuraCast live tag extraction
 * - Persistent memory & localStorage cache
 * - Curated high-res vinyl/analog fallbacks (strictly NO generic DJ controller placeholders)
 */

export interface ParsedTrackInfo {
  cleanArtist: string;
  cleanTitle: string;
  searchQuery: string;
  isStationPlaceholder: boolean;
}

// In-memory cache for instant retrieval within the session
const artworkMemoryCache = new Map<string, string>();

// Pre-load from browser storage if available
try {
  const stored = localStorage.getItem('synapse_artwork_cache');
  if (stored) {
    const parsed = JSON.parse(stored);
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v === 'string') artworkMemoryCache.set(k, v);
    });
  }
} catch {
  // Safe storage access
}

function persistCache() {
  try {
    const obj: Record<string, string> = {};
    let count = 0;
    for (const [k, v] of artworkMemoryCache.entries()) {
      if (count++ > 200) break; // Limit to 200 items in localStorage
      obj[k] = v;
    }
    localStorage.setItem('synapse_artwork_cache', JSON.stringify(obj));
  } catch {
    // Safe storage access
  }
}

/**
 * Transforms all-lowercase or all-uppercase text into clean Title Case
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  // Check if string is all lowercase or all uppercase
  const isAllLower = str === str.toLowerCase();
  const isAllUpper = str === str.toUpperCase() && str.length > 3;
  
  if (!isAllLower && !isAllUpper) {
    return str.trim();
  }

  const smallWords = /^(a|an|and|as|at|but|by|en|for|if|in|nor|of|on|or|per|the|to|v.?|vs.?|via)$/i;

  return str
    .toLowerCase()
    .split(' ')
    .map((word, index, arr) => {
      if (!word) return '';
      // If it's in parentheses or brackets, capitalize inside
      if (word.startsWith('(') || word.startsWith('[')) {
        const prefix = word[0];
        const inner = word.slice(1);
        return prefix + inner.charAt(0).toUpperCase() + inner.slice(1);
      }
      if (index === 0 || index === arr.length - 1 || !smallWords.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word.toLowerCase();
    })
    .join(' ')
    .trim();
}

/**
 * Intelligent parser to clean up raw stream tags, YouTube rips, record labels, and formatting noise
 */
export function parseTrackMetadata(rawTitle?: string, rawArtist?: string, rawText?: string): ParsedTrackInfo {
  let combined = (rawText || '').trim();
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  // If we have raw text like "Artist - Title", and artist is empty or generic
  if ((!artist || artist.toLowerCase() === 'radio synapse' || artist.toLowerCase().includes('live')) && combined) {
    const splitIndex = combined.indexOf(' - ');
    if (splitIndex !== -1) {
      artist = combined.substring(0, splitIndex).trim();
      title = combined.substring(splitIndex + 3).trim();
    }
  } else if (!artist && title.includes(' - ')) {
    const splitIndex = title.indexOf(' - ');
    artist = title.substring(0, splitIndex).trim();
    title = title.substring(splitIndex + 3).trim();
  }

  // Remove known YouTube Channel / Label prefixes
  // e.g. "Blanco y Negro Music - Bonka - I Like It" -> "Bonka - I Like It"
  const labelPrefixRegex = /^(?:blanco\s+y\s+negro(?:\s+music)?|pornostar\s+records|houseum|spinnin['’]?\s+records|defected(?:\s+records)?|ultra\s+(?:music|records)|selected\.|armada(?:\s+music)?|radio\s+synapse)\s*[-–—:]\s*/i;
  
  if (labelPrefixRegex.test(artist)) {
    artist = artist.replace(labelPrefixRegex, '').trim();
  }
  if (labelPrefixRegex.test(title)) {
    title = title.replace(labelPrefixRegex, '').trim();
    if (title.includes(' - ')) {
      const parts = title.split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }
    }
  }

  // If artist still contains multiple dashes e.g. "Bonka - I Like It", separate them
  if (artist.includes(' - ') && (!title || title.toLowerCase() === artist.toLowerCase())) {
    const parts = artist.split(/\s*[-–—]\s*/);
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  // Clean title from common bracketed noise
  // [official music video], (Official Audio), [hd upgrade], (extended mix), #club, #dance, etc.
  const cleanupRegexes = [
    /\[[^\]]*(?:official|video|audio|clip|hd|upgrade|remaster|mix|records|glasgow|underground|4k|version|edit)[^\]]*\]/gi,
    /\([^\)]*(?:official\s*(?:video|audio|music\s*video)|video\s*clip|hd\s*upgrade|long\s*version|remaster(?:ed)?|clip\s*officiel)[^\)]*\)/gi,
    /#[a-z0-9_-]+/gi,
    /\s{2,}/g
  ];

  cleanupRegexes.forEach(rg => {
    title = title.replace(rg, ' ');
    artist = artist.replace(rg, ' ');
  });

  // Strip trailing dashes, commas or brackets
  title = title.replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, '').trim();
  artist = artist.replace(/^[\s\-–—:,]+|[\s\-–—:,]+$/g, '').trim();

  // If title is empty but artist has content, handle gracefully
  if (!title && artist) {
    title = artist;
    artist = 'Radio Synapse';
  } else if (!artist && title) {
    artist = 'Radio Synapse';
  }

  const cleanArtist = toTitleCase(artist || 'Radio Synapse');
  const cleanTitle = toTitleCase(title || 'En Direct');

  const isStationPlaceholder = 
    cleanTitle.toLowerCase().includes('en direct') ||
    cleanTitle.toLowerCase().includes('disco funk direct') ||
    cleanTitle.toLowerCase().includes('rock station live') ||
    cleanTitle.toLowerCase() === 'radio synapse';

  // Search query optimized for iTunes / Deezer
  // Remove (Original Mix) or (Extended Mix) from search query for higher match rate
  const searchTitle = cleanTitle
    .replace(/\([^\)]*(?:original|extended|club|radio)\s*mix[^\)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const searchQuery = `${cleanArtist} ${searchTitle}`.trim();

  return {
    cleanArtist,
    cleanTitle,
    searchQuery,
    isStationPlaceholder
  };
}

/**
 * Returns cached cover if available
 */
export function getCachedTrackCover(title: string, artist: string): string | null {
  const key = `${artist || ''} - ${title || ''}`.toLowerCase().trim();
  return artworkMemoryCache.get(key) || null;
}

/**
 * Tests if an artwork URL is an AzuraCast generic placeholder, station logo or invalid image
 */
export function isAzuraCastDefaultLogo(url: string | null | undefined): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('radiosynapse.fr') ||
    lower.includes('/api/station/') ||
    lower.includes('/static/uploads/') ||
    lower.includes('generic_song') ||
    lower.includes('default_album_art') ||
    lower.includes('placeholder') ||
    lower.includes('no-cover') ||
    lower.includes('blank') ||
    lower.includes('azuracast')
  );
}

/**
 * High-definition, aesthetic analog/vinyl fallback covers for all radio genres
 */
export function getStyleFallbackCover(title: string, artist: string, genre?: string): string {
  const combined = `${title || ''} ${artist || ''} ${genre || ''}`.toLowerCase();

  // Rock, Metal, Punk, Alternative
  if (
    combined.includes('rock') || 
    combined.includes('metal') || 
    combined.includes('punk') || 
    combined.includes('grunge') || 
    combined.includes('guitar') || 
    combined.includes('nirvana') || 
    combined.includes('metallica') || 
    combined.includes('ac/dc') ||
    combined.includes('punch')
  ) {
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80'; // Dark vinyl with warm light
  }

  // Disco, Funk, Soul, Groove, 70s, 80s
  if (
    combined.includes('disco') || 
    combined.includes('funk') || 
    combined.includes('soul') || 
    combined.includes('groove') || 
    combined.includes('70s') || 
    combined.includes('80s') || 
    combined.includes('boogie') ||
    combined.includes('earth wind')
  ) {
    return 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&auto=format&fit=crop&q=80'; // Golden vinyl record groove
  }

  // Electronic, House, Techno, Synthwave, Electro, EDM
  if (
    combined.includes('electro') || 
    combined.includes('house') || 
    combined.includes('techno') || 
    combined.includes('synth') || 
    combined.includes('dance') || 
    combined.includes('club') || 
    combined.includes('edm') || 
    combined.includes('trance')
  ) {
    return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80'; // Neon concert / synth vibes
  }

  // Hip-Hop, Rap, R&B, Urban
  if (
    combined.includes('hip') || 
    combined.includes('rap') || 
    combined.includes('r&b') || 
    combined.includes('trap') || 
    combined.includes('urban')
  ) {
    return 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80'; // Urban music & turntable
  }

  // Jazz, Blues, Lounge, Chillout, Acoustic
  if (
    combined.includes('jazz') || 
    combined.includes('blues') || 
    combined.includes('lounge') || 
    combined.includes('chill') || 
    combined.includes('acoustic') || 
    combined.includes('ambient')
  ) {
    return 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&auto=format&fit=crop&q=80'; // Vintage saxophone & jazz club
  }

  // Pop, Hits, Top 40, Chart
  if (
    combined.includes('pop') || 
    combined.includes('hit') || 
    combined.includes('chart') || 
    combined.includes('top')
  ) {
    return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'; // Dynamic DJ & stage lighting
  }

  // Default Synapse Studio Vinyl Artwork
  return 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&auto=format&fit=crop&q=80';
}

/**
 * Primary Strategy: iTunes Search API (Ultra-crisp 600x600 / 1000x1000 artwork with global CORS)
 */
async function searchItunesArtwork(query: string): Promise<string | null> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=3`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.results && data.results.length > 0) {
      const best = data.results[0];
      const rawArt = best.artworkUrl100 || best.artworkUrl60;
      if (rawArt) {
        // Upgrade from 100x100 thumbnail to ultra-high resolution 600x600 or 1000x1000
        return rawArt
          .replace('/100x100bb.jpg', '/600x600bb.jpg')
          .replace('/60x60bb.jpg', '/600x600bb.jpg');
      }
    }
  } catch {
    // Network or timeout
  }
  return null;
}

/**
 * Secondary Strategy: Deezer API
 */
async function searchDeezerArtwork(query: string): Promise<string | null> {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.data && data.data.length > 0) {
      const track = data.data[0];
      return track.album?.cover_xl || track.album?.cover_big || track.artist?.picture_xl || null;
    }
  } catch {
    // Network or timeout
  }
  return null;
}

/**
 * Tertiary Strategy: MusicBrainz & Cover Art Archive
 */
async function searchMusicBrainzArtwork(artist: string, title: string): Promise<string | null> {
  try {
    const url = `https://musicbrainz.org/ws/2/recording?query=artist:"${encodeURIComponent(artist)}" AND recording:"${encodeURIComponent(title)}"&fmt=json&limit=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RadioSynapse/2.0.0 (https://radiosynapse.fr)',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = await res.json();
    const recording = data.recordings?.[0];
    if (recording?.releases?.[0]?.id) {
      const releaseId = recording.releases[0].id;
      const archiveRes = await fetch(`https://coverartarchive.org/release/${releaseId}`);
      if (archiveRes.ok) {
        const archiveData = await archiveRes.json();
        const front = archiveData.images?.find((img: any) => img.front) || archiveData.images?.[0];
        if (front) {
          return front.thumbnails?.['500'] || front.thumbnails?.['1200'] || front.image || null;
        }
      }
    }
  } catch {
    // Network or timeout
  }
  return null;
}

/**
 * Preloads an image into the browser's disk & memory cache so it renders instantaneously
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }
    const img = new Image();
    img.src = url;
    if (img.complete) {
      resolve();
    } else {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    }
  });
}

/**
 * Master Cover Art Resolver
 * Resolves the genuine high-resolution album cover for any song played on the station
 */
export async function fetchTrackCover(
  title: string,
  artist: string,
  rawText?: string,
  serverArtUrl?: string,
  genre?: string
): Promise<string> {
  const parsed = parseTrackMetadata(title, artist, rawText);

  // Return fallback for generic radio station identifiers
  if (parsed.isStationPlaceholder) {
    const fallback = getStyleFallbackCover(parsed.cleanTitle, parsed.cleanArtist, genre);
    preloadImage(fallback);
    return fallback;
  }

  const cacheKey = `${parsed.cleanArtist} - ${parsed.cleanTitle}`.toLowerCase();

  // 1. Check in-memory cache
  const cached = artworkMemoryCache.get(cacheKey);
  if (cached) {
    preloadImage(cached);
    return cached;
  }

  // 2. Query iTunes with full query (Artist + Title)
  let foundUrl: string | null = await searchItunesArtwork(parsed.searchQuery);

  // 3. If no match, try iTunes with just clean Title or clean Artist
  if (!foundUrl && parsed.cleanTitle && parsed.cleanTitle.length > 3) {
    foundUrl = await searchItunesArtwork(parsed.cleanTitle);
  }

  // 4. Try Deezer
  if (!foundUrl) {
    foundUrl = await searchDeezerArtwork(parsed.searchQuery);
  }

  // 5. Try MusicBrainz
  if (!foundUrl && parsed.cleanArtist && parsed.cleanTitle) {
    foundUrl = await searchMusicBrainzArtwork(parsed.cleanArtist, parsed.cleanTitle);
  }

  // 6. If external APIs found nothing, check if the server gave a real valid cover
  if (!foundUrl && serverArtUrl && !isAzuraCastDefaultLogo(serverArtUrl)) {
    foundUrl = serverArtUrl;
  }

  // 7. Last resort: high-definition aesthetic vinyl fallback matching the genre
  if (!foundUrl) {
    foundUrl = getStyleFallbackCover(parsed.cleanTitle, parsed.cleanArtist, genre);
  }

  // Cache and preload valid resolved artwork
  if (foundUrl) {
    artworkMemoryCache.set(cacheKey, foundUrl);
    persistCache();
    preloadImage(foundUrl);
  }

  return foundUrl;
}
