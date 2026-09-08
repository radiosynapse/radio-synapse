import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Splash from './components/Splash';
import MiniDiscPlayer from './components/MiniDiscPlayer';
import Equalizer from './components/Equalizer';
import CastModal from './components/CastModal';
import Drawer from './components/Drawer';
import { MarqueeText } from './components/MarqueeText';
import { StreamChannel, EQUALIZER_PRESETS, STANDBY_STREAM } from './data';
import { 
  Radio, Sliders, History, ChevronDown, 
  RotateCcw, User, Play, Pause, 
  SkipBack, SkipForward, Cast, Volume2, Music2,
  MoreVertical
} from 'lucide-react';
import { motion } from 'motion/react';
import BrandLogo from './components/BrandLogo';
import LikedTracksDrawer from './components/LikedTracksDrawer';
import FavoriteStationsDrawer from './components/FavoriteStationsDrawer';
import AccountConnectModal from './components/AccountConnectModal';
import UserProfileDrawer from './components/UserProfileDrawer';
import FullscreenNavMenu, { NavMenuItemId } from './components/FullscreenNavMenu';
import ProgrammingDrawer from './components/ProgrammingDrawer';
import ChallengesDrawer from './components/ChallengesDrawer';
import PromotionsDrawer from './components/PromotionsDrawer';
import EventsDrawer from './components/EventsDrawer';
import ContactDrawer from './components/ContactDrawer';
import AdminPanelDrawer from './components/AdminPanelDrawer';
import StandaloneTrackFlyerPage from './components/StandaloneTrackFlyerPage';
import DoubleHeartIcon from './components/DoubleHeartIcon';
import ReactiveStationWave from './components/ReactiveStationWave';
import ChromaticStationsLabel from './components/ChromaticStationsLabel';
import { useCoverColor } from './utils/coverColorExtractor';
import { getAdminStations, getActiveAdminStations, loadRemoteAdminData, subscribeToPocketBaseRealtime } from './utils/adminStore';
import { LikedTrack, ConnectedAccount, SynapseUser } from './types';
import { isSuperAdmin } from './utils/adminRolePermissionsStore';
import { 
  restorePocketBaseAuthSession, 
  getStoredSynapseUser, 
  syncUserDataToPocketBaseCloud, 
  fetchUserDataFromPocketBaseCloud,
  linkSpotifyToSynapseUser
} from './utils/pocketbaseAuthService';
import { 
  getLikedTracks, 
  saveLikedTracks,
  addOrCycleLikedTrack,
  getTrackLikeLevel,
  setTrackLevelInStorage,
  removeLikedTrackById, 
  getConnectedAccount, 
  saveConnectedAccount,
  makeTrackId
} from './utils/favoritesStorage';
import { 
  fetchAndRestoreUserData, 
  syncFullLikedTracksToSpotifyPlaylist, 
  addSingleTrackToSpotify, 
  removeSingleTrackFromSpotify,
  getValidSpotifyAccessToken,
  findOrCreateSynapsePlaylist
} from './utils/spotifyPlaylistSync';
import {
  getFavoriteStations,
  toggleFavoriteStation,
  toggleStationNotification,
  isStationFavorite,
  FavoriteStationSetting
} from './utils/favoriteStationsStorage';
import { LiveTimeshiftRecorder } from './utils/timeshiftBuffer';
import { CastService, CastSessionState } from './utils/castService';
import { 
  fetchTrackCover, 
  getCachedTrackCover, 
  getStyleFallbackCover,
  parseTrackMetadata
} from './utils/artworkFetcher';
import { getStreamAudioUrl, matchNowPlayingStation, getGuaranteedStationInfo, probeLiveStreamMetadata } from './utils/streamMetadataFetcher';
import { resolveFullTrackAudio } from './utils/fullAudioResolver';
import { setAndPlayAudioStream, pauseAudioStream, getBestStreamUrl, getOptimizedHighQualityAudioUrl } from './utils/audioStreamPlayer';

export interface PastTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
  audioUrl?: string;
  timeAgo: string;
  playedAt: string;
  minutesAgo: number;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [topBarVisible, setTopBarVisible] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);

  const handleSplashTopBarAppear = useCallback(() => {
    setTopBarVisible(true);
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    setTopBarVisible(true);
    setPlayerVisible(true);
  }, []);
  // Dynamic Admin Stations state & active stations filter (toggle on)
  const [allAdminStations, setAllAdminStations] = useState<StreamChannel[]>(() => getAdminStations());

  const activeStations = useMemo(() => {
    return allAdminStations.filter((s) => s.enabled !== false);
  }, [allAdminStations]);

  const [activeStream, setActiveStream] = useState<StreamChannel>(() => {
    const activeList = getActiveAdminStations();
    return activeList[0] || STANDBY_STREAM;
  });

  // Automatically keep activeStream aligned with activeStations and handle standby state
  useEffect(() => {
    if (activeStations.length === 0) {
      if (activeStream.id !== 'standby') {
        setActiveStream(STANDBY_STREAM);
        setIsPlaying(false);
      }
    } else {
      if (activeStream.id === 'standby' || !activeStations.some(s => s.id === activeStream.id)) {
        setActiveStream(activeStations[0]);
      }
    }
  }, [activeStations, activeStream.id]);

  const handleRefreshAppState = useCallback(() => {
    setAllAdminStations(getAdminStations());
  }, []);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [rewindBadge, setRewindBadge] = useState<string | null>(null);
  
  // Audio settings
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  
  // 10-Band Equalizer states (Default loaded to match the stream's genre)
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('DISCO & FUNK');
  const [eqBands, setEqBands] = useState<number[]>([...EQUALIZER_PRESETS[0].bands]);

  // Drawers and Views states
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showUserProfileDrawer, setShowUserProfileDrawer] = useState(false);
  const [showNavOverlayMenu, setShowNavOverlayMenu] = useState(false);
  const [showProgrammingDrawer, setShowProgrammingDrawer] = useState(false);
  const [showChallengesDrawer, setShowChallengesDrawer] = useState(false);
  const [showPromotionsDrawer, setShowPromotionsDrawer] = useState(false);
  const [showEventsDrawer, setShowEventsDrawer] = useState(false);
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showStationsView, setShowStationsView] = useState(false);
  const [showLikedDrawer, setShowLikedDrawer] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [shutterForceClosed, setShutterForceClosed] = useState(false);

  // Favorites & Connected Account state
  const [synapseUser, setSynapseUser] = useState<SynapseUser | null>(() => getStoredSynapseUser());
  const [likedTracks, setLikedTracks] = useState<LikedTrack[]>(() => getLikedTracks());
  const [favoriteStations, setFavoriteStations] = useState<FavoriteStationSetting[]>(() => getFavoriteStations());
  const [showFavoriteStationsDrawer, setShowFavoriteStationsDrawer] = useState(false);
  const [expandedStations, setExpandedStations] = useState<Record<string, boolean>>({});
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(() => getConnectedAccount());
  const [sharedSmartLinkTrack, setSharedSmartLinkTrack] = useState<LikedTrack | null>(null);

  // Proportional viewport scale calculation to lock in the mobile reference layout across all screen sizes
  const [viewportScale, setViewportScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      // Golden mobile reference chassis dimensions
      const REF_W = 390;
      const REF_H = 710;

      // Available window area with 16px safe margin
      const availW = Math.max(280, window.innerWidth - 16);
      const availH = Math.max(480, window.innerHeight - 16);

      // Uniform proportional containment scaling (preserving all relative positions and aspect ratios)
      const scaleX = availW / REF_W;
      const scaleY = availH / REF_H;
      const calculatedScale = Math.min(scaleX, scaleY);

      // Clamped scale: seamless downscaling for small devices, capped up to 1.35x for desktop Hi-Fi console
      const finalScale = Math.min(Math.max(calculatedScale, 0.65), 1.35);
      setViewportScale(finalScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Auto-detect SmartLink / Digital Flyer in URL query parameters on load (?flyer=... or ?share_track=... or ?track=...)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.search) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const title = params.get('title') || params.get('share_track') || params.get('track');
      const artist = params.get('artist');
      if (title && artist) {
        const trackObj: LikedTrack = {
          id: `flyer-${Date.now()}`,
          title: title,
          artist: artist,
          album: params.get('album') || undefined,
          coverUrl: params.get('cover') || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
          stationName: params.get('station') || undefined,
          likedAt: Date.now(),
          level: 2,
          previewUrl: params.get('preview') || undefined,
          deezerUrl: params.get('deezer') || `https://www.deezer.com/search/${encodeURIComponent(`${artist} ${title}`)}`,
          spotifyUrl: params.get('spotify') || `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${title}`)}`,
          appleMusicUrl: params.get('apple') || `https://music.apple.com/fr/search?term=${encodeURIComponent(`${artist} ${title}`)}`,
          youtubeUrl: params.get('yt') || `https://music.youtube.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`,
        };
        setSharedSmartLinkTrack(trackObj);
      }
    } catch (err) {
      console.warn('Failed to parse share url params', err);
    }
  }, []);

  // Synchronize and restore PocketBase Auth, Stations, Messages & Admin Data on boot
  useEffect(() => {
    // 1. Fetch remote stations, messages, challenges, events from PocketBase
    loadRemoteAdminData().then(() => {
      const updated = getAdminStations();
      setAllAdminStations(updated);
      const activeList = updated.filter(s => s.enabled !== false);
      if (activeList.length > 0) {
        setActiveStream(prev => (prev.id === 'standby' ? activeList[0] : prev));
      }
    });

    // 2. Realtime subscription to live PocketBase updates
    const unsubscribe = subscribeToPocketBaseRealtime(() => {
      const updated = getAdminStations();
      setAllAdminStations(updated);
      const activeList = updated.filter(s => s.enabled !== false);
      if (activeList.length > 0) {
        setActiveStream(prev => (prev.id === 'standby' ? activeList[0] : prev));
      }
    });

    // 3. Restore user authentication session & cloud data
    restorePocketBaseAuthSession().then((user) => {
      if (user) {
        setSynapseUser(user);
        if (user.spotifyAccount) {
          setConnectedAccount(user.spotifyAccount);
          saveConnectedAccount(user.spotifyAccount);
        }
        fetchUserDataFromPocketBaseCloud(user.id).then((cloudData) => {
          if (cloudData?.likedTracks && cloudData.likedTracks.length > 0) {
            setLikedTracks(cloudData.likedTracks);
            saveLikedTracks(cloudData.likedTracks);
          }
        }).catch(() => {});
      }
    });

    const initAcc = getConnectedAccount();
    if (initAcc && initAcc.provider === 'spotify' && initAcc.accessToken) {
      fetchAndRestoreUserData(initAcc, getLikedTracks()).then((res) => {
        if (res && res.tracks) {
          setLikedTracks(res.tracks);
          saveLikedTracks(res.tracks);
        }
        if (res && res.account) {
          setConnectedAccount(res.account);
          saveConnectedAccount(res.account);
        }
      }).catch((err) => {
        console.warn('Initial Spotify restore sync notice:', err);
      });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Synchronize liked tracks and favorite stations to PocketBase Database
  useEffect(() => {
    if (synapseUser && synapseUser.id) {
      syncUserDataToPocketBaseCloud(
        synapseUser.id,
        likedTracks,
        favoriteStations.map((s) => s.stationId)
      ).catch(() => {});
    }
  }, [synapseUser, likedTracks, favoriteStations]);

  const handleSelectNavMenuItem = (id: NavMenuItemId) => {
    setShowNavOverlayMenu(false);
    switch (id) {
      case 'liked-tracks':
        setShowLikedDrawer(true);
        break;
      case 'programming':
        setShowProgrammingDrawer(true);
        break;
      case 'challenges':
        setShowChallengesDrawer(true);
        break;
      case 'promotions':
        setShowPromotionsDrawer(true);
        break;
      case 'events':
        setShowEventsDrawer(true);
        break;
      case 'contact':
        setShowContactDrawer(true);
        break;
      case 'admin':
        setShowAdminPanel(true);
        break;
    }
  };

  const handleListenLiveFromShare = (stationName?: string) => {
    if (stationName) {
      const matched = activeStations.find(
        (s) => s.name.toLowerCase().includes(stationName.toLowerCase()) || 
               stationName.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matched) {
        handleStreamChange(matched, true);
        return;
      }
    }
    setIsPlaying(true);
    if (audioRef.current && (!castState.connected || castState.castType !== 'chromecast')) {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleToggleFavoriteStation = (stationId: string) => {
    const { list } = toggleFavoriteStation(stationId);
    setFavoriteStations(list);
  };

  const handleToggleStationNotification = (stationId: string) => {
    const list = toggleStationNotification(stationId);
    setFavoriteStations(list);
  };

  // Long press detection for player heart button
  const heartPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  
  // Cache for all stations now-playing API info to ensure immediate zapping without any mock/placeholder title flashes
  const [cachedNowPlaying, setCachedNowPlaying] = useState<any[] | null>(null);


  // Audio HTML container
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cast devices state
  const [castState, setCastState] = useState<CastSessionState>({
    connected: false,
    deviceName: null,
    castType: null,
  });
  const [isCastModalOpen, setIsCastModalOpen] = useState(false);

  // Synchronize Google Cast and AirPlay session states
  useEffect(() => {
    CastService.loadGoogleCastSDK();
    const unsubscribe = CastService.addListener((state) => {
      setCastState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Register native audio element with CastService for TV / Cast / AirPlay events
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      CastService.registerAudioElement(audio);
    }
  }, [audioRef.current]);

  // Touch handlers for vertical slide on the main player to show/hide stations
  const [mainTouchStartY, setMainTouchStartY] = useState<number | null>(null);
  const [mainTouchStartX, setMainTouchStartX] = useState<number | null>(null);

  // Mouse handlers for vertical slide on the main player to show/hide stations
  const [mainMouseDownY, setMainMouseDownY] = useState<number | null>(null);
  const [mainMouseDownX, setMainMouseDownX] = useState<number | null>(null);

  // Live Timeshift background recorder instance (records live Icecast stream in memory)
  const timeshiftRecorderRef = useRef<LiveTimeshiftRecorder | null>(null);
  const [bufferedLiveSeconds, setBufferedLiveSeconds] = useState(0);
  const lastCastedUrlRef = useRef<string | null>(null);

  // Initialize and start background timeshift recorder
  useEffect(() => {
    const recorder = new LiveTimeshiftRecorder((sec) => {
      setBufferedLiveSeconds(sec);
    });
    timeshiftRecorderRef.current = recorder;

    const liveUrl = getBestStreamUrl(activeStream);
    if (liveUrl) {
      recorder.start(liveUrl);
    }

    return () => {
      recorder.stop();
    };
  }, [activeStream]);

  // Dynamic past tracks catalogue (last 15 minutes)
  const [historyTracks, setHistoryTracks] = useState<PastTrack[]>([]);

  // Seek handler for timeline scrubber: seeks to precise second, switching to deferred stream if needed
  const handleSeek = async (time: number) => {
    const targetTime = Math.max(0, time);
    setCurrentTime(targetTime);

    if (!rewindBadge) {
      // Scrubbed back in live broadcast: enter deferred mode at the exact timestamp chosen
      setRewindBadge(`DIFFÉRÉ • ${Math.floor(targetTime / 60)}:${(Math.floor(targetTime % 60)).toString().padStart(2, '0')}`);
      const fullAudio = await resolveFullTrackAudio(liveTrack.title, liveTrack.artist, activeStream.id, liveTrack.duration);
      if (audioRef.current) {
        if (!audioRef.current.src.includes(fullAudio.audioUrl)) {
          audioRef.current.src = fullAudio.audioUrl;
          audioRef.current.load();
        }
        audioRef.current.currentTime = targetTime;
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(true);
        });
      }
    } else {
      // Already in deferred mode: seek directly to the exact second of the song
      if (audioRef.current) {
        try {
          audioRef.current.currentTime = targetTime;
          if (!isPlaying) {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        } catch (e) {
          console.warn("Seek error:", e);
        }
      }
    }
  };

  // Dynamic live track playing metadata state with real on-air timing
  const [liveTrack, setLiveTrack] = useState<{
    title: string;
    artist: string;
    coverUrl: string;
    duration: number;
    playedAt?: number;
    elapsed?: number;
    fetchTimestamp?: number;
  }>(() => {
    const guaranteed = getGuaranteedStationInfo(activeStream);
    return {
      title: guaranteed.title,
      artist: guaranteed.artist,
      coverUrl: guaranteed.coverUrl,
      duration: guaranteed.duration,
    };
  });

  // Keep liveTrack immediately aligned when activeStream changes
  useEffect(() => {
    if (activeStream.id === 'standby') {
      setLiveTrack({
        title: 'En attente de diffusion',
        artist: 'Radio Synapse',
        coverUrl: getStyleFallbackCover('Radio Synapse', 'Radio Synapse'),
        duration: 240,
      });
      return;
    }

    const matched = matchNowPlayingStation(cachedNowPlaying, activeStream);
    if (matched?.now_playing?.song) {
      const { title, artist, text, art } = matched.now_playing.song;
      const parsed = parseTrackMetadata(title, artist, text);
      const songDuration = Math.round(matched.now_playing.duration || 240);
      const cachedCover = getCachedTrackCover(parsed.cleanTitle, parsed.cleanArtist);
      const initialCover = cachedCover || art || getGuaranteedStationInfo(activeStream).coverUrl;
      setLiveTrack({
        title: parsed.cleanTitle,
        artist: parsed.cleanArtist,
        coverUrl: initialCover,
        duration: songDuration,
      });
      fetchTrackCover(parsed.cleanTitle, parsed.cleanArtist, text, art, activeStream.genre).then(resolved => {
        if (resolved) {
          setLiveTrack(prev => ({ ...prev, coverUrl: resolved }));
        }
      });
    } else {
      const guaranteed = getGuaranteedStationInfo(activeStream);
      setLiveTrack({
        title: guaranteed.title,
        artist: guaranteed.artist,
        coverUrl: guaranteed.coverUrl,
        duration: guaranteed.duration,
      });
      fetchTrackCover(guaranteed.title, guaranteed.artist, undefined, undefined, activeStream.genre).then(resolved => {
        if (resolved) {
          setLiveTrack(prev => ({ ...prev, coverUrl: resolved }));
        }
      });
    }
  }, [activeStream.id, activeStream.name, activeStream.streamUrl, activeStream.genre]);

  // Automatically fetch high-resolution album cover for current liveTrack
  useEffect(() => {
    let active = true;
    const fetchCover = async () => {
      if (!liveTrack.title || !liveTrack.artist) return;
      if (liveTrack.title === 'En attente de diffusion') return;
      const fetchedUrl = await fetchTrackCover(liveTrack.title, liveTrack.artist, undefined, liveTrack.coverUrl, activeStream.genre);
      if (fetchedUrl && active) {
        setLiveTrack(prev => {
          if (prev.title === liveTrack.title && prev.artist === liveTrack.artist) {
            return { ...prev, coverUrl: fetchedUrl };
          }
          return prev;
        });
      }
    };
    fetchCover();
    return () => {
      active = false;
    };
  }, [liveTrack.title, liveTrack.artist, activeStream.genre]);

  // Fetch real AzuraCast / Icecast API for Now Playing and Song History
  useEffect(() => {
    let active = true;

    const generateRelativeFallbacks = () => {
      return [];
    };

    const fetchNowPlaying = async () => {
      if (activeStream.id === 'standby') return;

      try {
        // 1. First check if the station stream host directly gives live metadata
        const directProbe = await probeLiveStreamMetadata(activeStream);
        if (directProbe && directProbe.title && directProbe.artist && active && !rewindBadge) {
          const cachedCover = getCachedTrackCover(directProbe.title, directProbe.artist);
          const initialCover = directProbe.coverUrl || cachedCover || '';
          
          setLiveTrack(prev => ({
            title: directProbe.title,
            artist: directProbe.artist,
            coverUrl: prev.title === directProbe.title && prev.coverUrl ? prev.coverUrl : initialCover,
            duration: directProbe.duration || 240,
            playedAt: directProbe.playedAt,
            elapsed: directProbe.elapsed || 0,
            fetchTimestamp: Math.floor(Date.now() / 1000)
          }));

          if (directProbe.history && directProbe.history.length > 0) {
            const pastMapped: PastTrack[] = directProbe.history.map((h, idx) => {
              const minutesAgo = (idx + 1) * 3;
              return {
                id: h.id || `hist-${idx}`,
                title: h.title,
                artist: h.artist,
                duration: h.duration || 240,
                coverUrl: h.coverUrl || '',
                minutesAgo,
                timeAgo: `Il y a ${minutesAgo} min`,
                playedAt: ''
              };
            });
            setHistoryTracks(pastMapped);
          }

          if (!directProbe.coverUrl || directProbe.coverUrl.includes('generic_song')) {
            fetchTrackCover(directProbe.title, directProbe.artist, undefined, directProbe.coverUrl, activeStream.genre).then(resolvedArt => {
              if (active && resolvedArt) {
                setLiveTrack(prev => {
                  if (prev.title === directProbe.title && prev.artist === directProbe.artist) {
                    return { ...prev, coverUrl: resolvedArt };
                  }
                  return prev;
                });
              }
            });
          }
          return;
        }

        // 2. Query Central AzuraCast API
        const res = await fetch(`https://cast.radiosynapse.fr/api/nowplaying?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error("Fetch failed");
        const data = await res.json();
        
        if (Array.isArray(data)) {
          if (active) {
            setCachedNowPlaying(data);
          }
          
          const matchedStation = matchNowPlayingStation(data, activeStream);

          if (matchedStation) {
            // Update Current Track if playing live and not manually rewound
            if (matchedStation?.now_playing?.song) {
              const { title, artist, text, art } = matchedStation.now_playing.song;
              const parsed = parseTrackMetadata(title, artist, text);
              const songDuration = Math.round(matchedStation?.now_playing?.duration || 240);
              const playedAt = matchedStation?.now_playing?.played_at;
              const elapsed = matchedStation?.now_playing?.elapsed;
              const nowSec = Math.floor(Date.now() / 1000);

              let realElapsed = 0;
              if (typeof elapsed === 'number' && elapsed >= 0) {
                realElapsed = Math.max(0, Math.min(songDuration, Math.round(elapsed)));
              } else if (playedAt && playedAt > 0) {
                realElapsed = Math.max(0, Math.min(songDuration, nowSec - playedAt));
              }

              if (active && !rewindBadge) {
                const cachedCover = getCachedTrackCover(parsed.cleanTitle, parsed.cleanArtist);
                
                setLiveTrack(prev => {
                  const isSameTrack = prev.title === parsed.cleanTitle && prev.artist === parsed.cleanArtist;
                  const initialCover = cachedCover || art || (prev.coverUrl ? prev.coverUrl : getStyleFallbackCover(parsed.cleanTitle, parsed.cleanArtist, activeStream.genre));
                  return {
                    title: parsed.cleanTitle,
                    artist: parsed.cleanArtist,
                    coverUrl: isSameTrack ? (prev.coverUrl || initialCover) : initialCover,
                    duration: songDuration,
                    playedAt: playedAt || (nowSec - realElapsed),
                    elapsed: realElapsed,
                    fetchTimestamp: nowSec
                  };
                });

                // Asynchronously resolve authentic high-res album cover from iTunes / Deezer
                fetchTrackCover(parsed.cleanTitle, parsed.cleanArtist, text, art, activeStream.genre).then(resolvedArt => {
                  if (active && resolvedArt) {
                    setLiveTrack(prev => {
                      if (prev.title === parsed.cleanTitle && prev.artist === parsed.cleanArtist) {
                        return { ...prev, coverUrl: resolvedArt };
                      }
                      return prev;
                    });
                  }
                });

                setCurrentTime(realElapsed);
              }
            }

            // Extract Real Song History from AzuraCast for past tracks
            if (Array.isArray(matchedStation.song_history) && matchedStation.song_history.length > 0) {
              const nowSec = Math.floor(Date.now() / 1000);

              const realPastTracks: PastTrack[] = matchedStation.song_history
                .filter((entry: any) => {
                  const playedAt = entry.played_at || 0;
                  const diffSec = nowSec - playedAt;
                  return diffSec > 0;
                })
                .slice(0, 10)
                .map((entry: any, index: number) => {
                  const diffSec = Math.max(1, nowSec - (entry.played_at || 0));
                  const minutesAgo = Math.max(1, Math.round(diffSec / 60));
                  const playedDate = new Date((entry.played_at || 0) * 1000);
                  const playedHours = playedDate.getHours().toString().padStart(2, '0');
                  const playedMins = playedDate.getMinutes().toString().padStart(2, '0');

                  const rawTitle = entry.song?.title;
                  const rawArtist = entry.song?.artist;
                  const rawText = entry.song?.text;
                  const rawArt = entry.song?.art;
                  const parsedHistory = parseTrackMetadata(rawTitle, rawArtist, rawText);

                  const cachedCover = getCachedTrackCover(parsedHistory.cleanTitle, parsedHistory.cleanArtist);
                  const historyArt = cachedCover || rawArt || getStyleFallbackCover(parsedHistory.cleanTitle, parsedHistory.cleanArtist, activeStream.genre);

                  // Trigger background cover lookup for history items if not cached
                  if (!cachedCover) {
                    fetchTrackCover(parsedHistory.cleanTitle, parsedHistory.cleanArtist, rawText, rawArt, activeStream.genre).then(resolved => {
                      if (active && resolved) {
                        setHistoryTracks(currentHistory => 
                          currentHistory.map(h => 
                            (h.title === parsedHistory.cleanTitle && h.artist === parsedHistory.cleanArtist) 
                              ? { ...h, coverUrl: resolved } 
                              : h
                          )
                        );
                      }
                    });
                  }

                  return {
                    id: entry.sh_id ? String(entry.sh_id) : `sh-${index}`,
                    title: parsedHistory.cleanTitle,
                    artist: parsedHistory.cleanArtist,
                    duration: entry.duration || 240,
                    coverUrl: historyArt,
                    minutesAgo: minutesAgo,
                    timeAgo: `Il y a ${minutesAgo} min`,
                    playedAt: `${playedHours}:${playedMins}`
                  };
                });

              if (realPastTracks.length > 0 && active) {
                setHistoryTracks(realPastTracks);
                return;
              }
            }
          } else if (activeStream.id !== 'standby' && active) {
            // Station not found in AzuraCast nowplaying API: display guaranteed station metadata
            const guaranteed = getGuaranteedStationInfo(activeStream);
            setLiveTrack(prev => {
              if (prev.title === 'En attente de diffusion' || !prev.title) {
                return {
                  title: guaranteed.title,
                  artist: guaranteed.artist,
                  coverUrl: guaranteed.coverUrl,
                  duration: guaranteed.duration,
                };
              }
              return prev;
            });
          }
        }

        // Fallback relative calculated tracks if API history is not filled
        if (active) {
          setHistoryTracks(generateRelativeFallbacks());
        }
      } catch (err) {
        if (active) {
          if (activeStream.id !== 'standby') {
            const guaranteed = getGuaranteedStationInfo(activeStream);
            setLiveTrack(prev => {
              if (prev.title === 'En attente de diffusion' || !prev.title) {
                return {
                  title: guaranteed.title,
                  artist: guaranteed.artist,
                  coverUrl: guaranteed.coverUrl,
                  duration: guaranteed.duration,
                };
              }
              return prev;
            });
          }
          setHistoryTracks(generateRelativeFallbacks());
        }
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeStream, currentTrackIndex, rewindBadge]);

  const defaultTrack = activeStream.tracks?.[currentTrackIndex] || activeStream.tracks?.[0] || {
    id: `${activeStream.id}-track`,
    title: activeStream.name || 'En direct',
    artist: activeStream.genre || 'Radio Synapse',
    album: activeStream.name || 'Radio Synapse',
    duration: 240,
    coverUrl: '',
    audioUrl: getStreamAudioUrl(activeStream),
  };

  const guaranteedInfo = getGuaranteedStationInfo(activeStream);

  const currentTrack = {
    ...defaultTrack,
    title: (liveTrack.title && liveTrack.title !== 'En attente de diffusion') 
      ? liveTrack.title 
      : guaranteedInfo.title,
    artist: (liveTrack.artist && liveTrack.artist !== 'Radio Synapse') 
      ? liveTrack.artist 
      : guaranteedInfo.artist,
    coverUrl: liveTrack.coverUrl || guaranteedInfo.coverUrl || defaultTrack.coverUrl,
    duration: liveTrack.duration || guaranteedInfo.duration || defaultTrack.duration || 240,
    audioUrl: getStreamAudioUrl(activeStream) || defaultTrack.audioUrl || '',
  };

  const currentTrackLikeLevel = getTrackLikeLevel(currentTrack.title, currentTrack.artist);
  const currentTrackColor = useCoverColor(currentTrack.coverUrl, currentTrack.title, currentTrack.artist);

  const handleToggleLikeCurrentTrack = async () => {
    const res = await addOrCycleLikedTrack(
      currentTrack.title,
      currentTrack.artist,
      currentTrack.coverUrl,
      currentTrack.album,
      activeStream.name
    );
    setLikedTracks(res.tracks);

    // Auto-sync with connected Spotify Account and create/update 'Radio Synapse - Titres Likés'
    if (connectedAccount && connectedAccount.provider === 'spotify' && connectedAccount.accessToken) {
      if (res.newLevel > 0) {
        const liked = res.tracks.find(t => t.id === makeTrackId(currentTrack.title, currentTrack.artist));
        if (liked) {
          addSingleTrackToSpotify(liked, connectedAccount, res.tracks).then((syncRes) => {
            if (syncRes.playlistId && (!connectedAccount.playlistId || !connectedAccount.playlistUrl)) {
              const updatedAcc = {
                ...connectedAccount,
                playlistId: syncRes.playlistId,
                playlistUrl: syncRes.playlistUrl,
                lastSyncedAt: Date.now(),
              };
              setConnectedAccount(updatedAcc);
              saveConnectedAccount(updatedAcc);
            }
          });
        }
      } else {
        // Track unliked/removed
        const unlikedTrack: LikedTrack = {
          id: makeTrackId(currentTrack.title, currentTrack.artist),
          title: currentTrack.title,
          artist: currentTrack.artist,
          coverUrl: currentTrack.coverUrl,
          likedAt: Date.now(),
        };
        removeSingleTrackFromSpotify(unlikedTrack, connectedAccount, res.tracks);
      }
    }
  };

  const handleRemoveLikedTrack = (id: string) => {
    const target = likedTracks.find(t => t.id === id);
    const updated = removeLikedTrackById(id);
    setLikedTracks(updated);

    // Auto-sync deletion with connected Spotify Account
    if (target && connectedAccount && connectedAccount.provider === 'spotify' && connectedAccount.accessToken) {
      removeSingleTrackFromSpotify(target, connectedAccount, updated);
    }
  };

  const handleUpdateTrackLevel = (id: string, newLevel: 1 | 2) => {
    const updated = setTrackLevelInStorage(id, newLevel);
    setLikedTracks(updated);
  };

  const handleConnectAccount = async (account: ConnectedAccount | null) => {
    setConnectedAccount(account);
    saveConnectedAccount(account);

    if (account) {
      const updatedUser = await linkSpotifyToSynapseUser(account);
      if (updatedUser) {
        setSynapseUser(updatedUser);
      }
    }

    if (account && account.provider === 'spotify' && account.accessToken) {
      try {
        // 1. Fetch & restore existing playlist and database data across devices
        const restoreResult = await fetchAndRestoreUserData(account, likedTracks);
        setLikedTracks(restoreResult.tracks);
        saveLikedTracks(restoreResult.tracks);
        
        let activeAccount = restoreResult.account;

        // 2. Ensure Spotify playlist exists right now on their account
        if (!activeAccount.playlistId || !activeAccount.playlistUrl) {
          const tokenInfo = await getValidSpotifyAccessToken(activeAccount);
          if (tokenInfo) {
            try {
              const playlist = await findOrCreateSynapsePlaylist(
                tokenInfo.token,
                tokenInfo.account.userId,
                tokenInfo.account
              );
              activeAccount = {
                ...activeAccount,
                playlistId: playlist.id,
                playlistUrl: playlist.url,
                lastSyncedAt: Date.now(),
              };
            } catch (pErr) {
              console.warn('Initial playlist creation error:', pErr);
            }
          }
        }

        // 3. Transfer existing liked tracks list to "Radio Synapse - Titres Likés" playlist on Spotify
        if (restoreResult.tracks.length > 0) {
          const syncRes = await syncFullLikedTracksToSpotifyPlaylist(restoreResult.tracks, activeAccount);
          if (syncRes.playlistId) {
            activeAccount = {
              ...activeAccount,
              playlistId: syncRes.playlistId,
              playlistUrl: syncRes.playlistUrl,
              lastSyncedAt: Date.now(),
            };
          }
        }

        setConnectedAccount(activeAccount);
        saveConnectedAccount(activeAccount);
      } catch (err) {
        console.warn('Spotify initial sync warning:', err);
      }
    }
  };

  const handleManualSyncSpotify = async () => {
    if (!connectedAccount || connectedAccount.provider !== 'spotify' || !connectedAccount.accessToken) {
      return;
    }
    const syncRes = await syncFullLikedTracksToSpotifyPlaylist(likedTracks, connectedAccount);
    if (syncRes.playlistId) {
      const finalAcc: ConnectedAccount = {
        ...connectedAccount,
        playlistId: syncRes.playlistId,
        playlistUrl: syncRes.playlistUrl,
        lastSyncedAt: Date.now(),
      };
      setConnectedAccount(finalAcc);
      saveConnectedAccount(finalAcc);
    }
  };

  // Touch and Mouse handlers for heart button long-press
  const handleHeartTouchStart = () => {
    isLongPressRef.current = false;
    heartPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowLikedDrawer(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleHeartTouchEnd = () => {
    if (heartPressTimerRef.current) {
      clearTimeout(heartPressTimerRef.current);
    }
    if (!isLongPressRef.current) {
      handleToggleLikeCurrentTrack();
    }
  };

  const handleHeartMouseDown = () => {
    isLongPressRef.current = false;
    heartPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowLikedDrawer(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleHeartMouseUp = () => {
    if (heartPressTimerRef.current) {
      clearTimeout(heartPressTimerRef.current);
    }
    if (!isLongPressRef.current) {
      handleToggleLikeCurrentTrack();
    }
  };
  
  // Helper to convert RGB to Hex
  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (c: number) => {
      const h = Math.max(0, Math.min(255, c)).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Cache for extracted album cover color palettes so switching tracks or stations is instantaneous
  const extractedHarmonyCache = useRef<Map<string, { primary: string; secondary: string }>>(new Map());

  // Ultra-precise fallback harmonies when canvas extraction is not ready or blocked by CORS
  const getFallbackHarmony = (title: string, artist: string, coverUrl: string, streamId: string) => {
    const t = (title || "").toLowerCase();
    const a = (artist || "").toLowerCase();
    const u = (coverUrl || "").toLowerCase();

    // Oh Honey, Angelo Ferreri or Disco/Funk live station -> Orange and Magenta / Fuchsia
    if (
      streamId === "disco-funk" || 
      t.includes("honey") || 
      a.includes("angelo") || 
      a.includes("ferreri") || 
      t.includes("groove") || 
      t.includes("disco") || 
      t.includes("funk") ||
      u.includes("photo-1514525253161-7a46d19cd819")
    ) {
      return {
        primary: "#f97316", // Orange vif d'interface
        secondary: "#d946ef", // Magenta rétro disco
      };
    }

    // Rock station fallback -> Volcanic Red and Warm Amber / Flame Orange (no cold blue flash)
    if (
      streamId === "rock" || 
      t.includes("rock") || 
      t.includes("metal") || 
      t.includes("sandman") || 
      t.includes("back") ||
      a.includes("ac/dc") ||
      a.includes("nirvana") ||
      a.includes("metallica") ||
      u.includes("photo-1498038432885-c6f3f1b912ee")
    ) {
      return {
        primary: "#ef4444", // Rouge volcanique
        secondary: "#fb923c", // Ambre / Orange flamme rock
      };
    }

    // Default matches for built-in catalog
    if (t.includes("night") || u.includes("photo-1470225620780-dba8ba36b745") || t.includes("freak")) {
      return {
        primary: "#f43f5e", // Rose chaud rétro
        secondary: "#fbbf24", // Ambre / Or chaud
      };
    }
    if (t.includes("down") || u.includes("photo-1511671782779-c97d3d27a1d4")) {
      return {
        primary: "#eab308", // Or métallique lumineux
        secondary: "#f97316", // Orange couchant
      };
    }
    if (t.includes("celebration") || u.includes("photo-1487180142328-054b783ef471")) {
      return {
        primary: "#a855f7", // Améthyste pastel
        secondary: "#ff8a75", // Pêche corail doux
      };
    }
    if (t.includes("sweet") || u.includes("photo-1460661419201-fd4cecdf8a8b")) {
      return {
        primary: "#0d9488", // Vert sarcelle / Teal
        secondary: "#f97316", // Orange couchant
      };
    }
    if (t.includes("teen") || u.includes("photo-1511192336575-5a79af67a629")) {
      return {
        primary: "#d97706", // Ambre cuivré chaleureux
        secondary: "#8b5cf6", // Violet électrique
      };
    }

    // Fallback based on deterministic hash of titles
    const combined = t + " " + a;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    const PREMIUM_HARMONIES = [
      { primary: "#f97316", secondary: "#d946ef" }, // Orange & Magenta
      { primary: "#d946ef", secondary: "#f97316" }, // Magenta & Orange
      { primary: "#ef4444", secondary: "#fb923c" }, // Rouge & Ambre
      { primary: "#10b981", secondary: "#f59e0b" }, // Émeraude & Ambre
      { primary: "#6366f1", secondary: "#f43f5e" }, // Indigo & Rose
      { primary: "#eab308", secondary: "#8b5cf6" }, // Or & Violet
      { primary: "#0d9488", secondary: "#f97316" }, // Sarcelle & Orange
      { primary: "#06b6d4", secondary: "#ec4899" }, // Cyan & Rose
    ];

    return PREMIUM_HARMONIES[hash % PREMIUM_HARMONIES.length];
  };

  // Real-time reactive state holding extracted colors (falls back immediately to smart defaults)
  const [coverHarmony, setCoverHarmony] = useState<{ primary: string; secondary: string }>(() => 
    getFallbackHarmony(liveTrack.title, liveTrack.artist, liveTrack.coverUrl || defaultTrack.coverUrl, activeStream.id)
  );

  // Dynamic color extraction effect from active image (with canvas and crossOrigin)
  useEffect(() => {
    let active = true;
    const coverUrl = currentTrack.coverUrl;
    if (!coverUrl) return;

    // Check if we already computed harmony for this coverUrl
    const cached = extractedHarmonyCache.current.get(coverUrl);
    if (cached) {
      setCoverHarmony(cached);
      return;
    }

    // Load fallback first for zero-latency state update
    const initialFallback = getFallbackHarmony(currentTrack.title, currentTrack.artist, coverUrl, activeStream.id);
    setCoverHarmony(initialFallback);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = coverUrl;

    img.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 12;
        canvas.height = 12;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 12, 12);
        const imgData = ctx.getImageData(0, 0, 12, 12).data;

        const colors: { r: number; g: number; b: number; h: number; s: number; l: number; weight: number }[] = [];

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 150) continue; // Skip transparent/dark edges

          // Convert to HSL
          const rN = r / 255;
          const gN = g / 255;
          const bN = b / 255;
          const max = Math.max(rN, gN, bN);
          const min = Math.min(rN, gN, bN);
          let h = 0, s = 0, l = (max + min) / 2;

          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
              case gN: h = (bN - rN) / d + 2; break;
              case bN: h = (rN - gN) / d + 4; break;
            }
            h /= 6;
          }

          // We look for vibrant, colored pixels (saturation > 20% and reasonable brightness)
          if (s > 0.2 && l > 0.15 && l < 0.8) {
            const weight = s * (1 - Math.abs(l - 0.5) * 2);
            colors.push({ r, g, b, h: h * 360, s, l, weight });
          }
        }

        if (colors.length > 2) {
          // Sort by vibrancy weight
          colors.sort((a, b) => b.weight - a.weight);

          const primaryCol = colors[0];
          const primaryHex = rgbToHex(primaryCol.r, primaryCol.g, primaryCol.b);

          // Find secondary color with at least 35 degrees of hue separation
          let secondaryCol = colors[1];
          for (let i = 1; i < colors.length; i++) {
            const hueDiff = Math.abs(colors[i].h - primaryCol.h);
            const normalizedDiff = hueDiff > 180 ? 360 - hueDiff : hueDiff;
            if (normalizedDiff > 35) {
              secondaryCol = colors[i];
              break;
            }
          }
          const secondaryHex = rgbToHex(secondaryCol.r, secondaryCol.g, secondaryCol.b);

          const extracted = {
            primary: primaryHex,
            secondary: secondaryHex,
          };

          extractedHarmonyCache.current.set(coverUrl, extracted);
          setCoverHarmony(extracted);
        }
      } catch (err) {
        // Fallback already set above
      }
    };

    img.onerror = () => {
      // Fallback already set above
    };

    return () => {
      active = false;
    };
  }, [currentTrack.coverUrl, activeStream.id]);

  // Helper function to gently boost color saturation ONLY if harmony colors are too whitish/grayish
  const boostColorSaturation = (r: number, g: number, b: number) => {
    const rN = r / 255;
    const gN = g / 255;
    const bN = b / 255;
    const max = Math.max(rN, gN, bN);
    const min = Math.min(rN, gN, bN);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
        case gN: h = (bN - rN) / d + 2; break;
        case bN: h = (rN - gN) / d + 4; break;
      }
      h /= 6;
    }

    // ONLY target truly whitish (high lightness + low saturation) or grayish (very low saturation)
    const isWhitishOrGrayish = (s < 0.12 && l > 0.60) || (s < 0.08);

    if (isWhitishOrGrayish) {
      // Apply a subtle, natural boost (max saturation ~0.35, not fluo/neon)
      s = Math.min(0.38, Math.max(0.28, s + 0.25));
      if (l > 0.78) l = 0.68; // Slightly soften blinding white

      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      return {
        r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
      };
    }

    return { r, g, b };
  };

  // Helper functions for smooth hex/RGB color harmony transitions
  const parseHexToRgb = (hex: string) => {
    let clean = (hex || '#00f2ff').replace('#', '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    const rawRgb = {
      r: parseInt(clean.substring(0, 2), 16) || 0,
      g: parseInt(clean.substring(2, 4), 16) || 0,
      b: parseInt(clean.substring(4, 6), 16) || 0,
    };
    return boostColorSaturation(rawRgb.r, rawRgb.g, rawRgb.b);
  };

  const rgbToHexStr = (rgb: { r: number; g: number; b: number }) => {
    const toHex = (n: number) => {
      const h = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  };

  // Smooth interpolated color harmony state for continuous silky transitions on station / track changes
  const [smoothHarmony, setSmoothHarmony] = useState<{ primary: string; secondary: string }>(coverHarmony);

  // Persistent ref for current RGB values to allow uninterrupted lerping even on rapid station changes
  const currentRgbRef = useRef<{ primary: { r: number; g: number; b: number }; secondary: { r: number; g: number; b: number } }>({
    primary: parseHexToRgb(coverHarmony.primary),
    secondary: parseHexToRgb(coverHarmony.secondary),
  });

  useEffect(() => {
    const targetPrimaryRgb = parseHexToRgb(coverHarmony.primary);
    const targetSecondaryRgb = parseHexToRgb(coverHarmony.secondary);

    const startPrimaryRgb = { ...currentRgbRef.current.primary };
    const startSecondaryRgb = { ...currentRgbRef.current.secondary };

    const startTime = performance.now();
    const duration = 1200; // 1.2 seconds ultra-smooth color harmony morphing

    let animId: number;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Ease-out cubic curve
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const curPri = {
        r: startPrimaryRgb.r + (targetPrimaryRgb.r - startPrimaryRgb.r) * easeOut,
        g: startPrimaryRgb.g + (targetPrimaryRgb.g - startPrimaryRgb.g) * easeOut,
        b: startPrimaryRgb.b + (targetPrimaryRgb.b - startPrimaryRgb.b) * easeOut,
      };

      const curSec = {
        r: startSecondaryRgb.r + (targetSecondaryRgb.r - startSecondaryRgb.r) * easeOut,
        g: startSecondaryRgb.g + (targetSecondaryRgb.g - startSecondaryRgb.g) * easeOut,
        b: startSecondaryRgb.b + (targetSecondaryRgb.b - startSecondaryRgb.b) * easeOut,
      };

      currentRgbRef.current = { primary: curPri, secondary: curSec };

      setSmoothHarmony({
        primary: rgbToHexStr(curPri),
        secondary: rgbToHexStr(curSec),
      });

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };

    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [coverHarmony]);

  // Smooth crossfader for the ambient blurred background cover image on track/station change
  const [bgCoverCurrent, setBgCoverCurrent] = useState<string>(currentTrack.coverUrl);
  const [bgCoverPrevious, setBgCoverPrevious] = useState<string | null>(null);
  const [bgCrossfadeOpacity, setBgCrossfadeOpacity] = useState<number>(1);

  useEffect(() => {
    if (currentTrack.coverUrl && currentTrack.coverUrl !== bgCoverCurrent) {
      setBgCoverPrevious(bgCoverCurrent);
      setBgCoverCurrent(currentTrack.coverUrl);
      setBgCrossfadeOpacity(0);
      
      const startTime = performance.now();
      const duration = 1200; // 1.2s smooth ambient cover crossfade

      let animId: number;
      const animateCrossfade = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        
        const eased = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        setBgCrossfadeOpacity(eased);

        if (progress < 1) {
          animId = requestAnimationFrame(animateCrossfade);
        } else {
          setBgCoverPrevious(null);
        }
      };

      animId = requestAnimationFrame(animateCrossfade);
      return () => cancelAnimationFrame(animId);
    }
  }, [currentTrack.coverUrl, bgCoverCurrent]);

  const primaryColor = smoothHarmony.primary;
  const secondaryColor = smoothHarmony.secondary;
  const accentColor = primaryColor;

  const hexToRgba = (hex: string, alpha: number) => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Central Google Cast & AirPlay Synchronizer / Coordinator
  const prevCastConnectedRef = useRef(false);
  useEffect(() => {
    if (!castState.connected || castState.castType !== 'chromecast') {
      // If we just disconnected from Chromecast, resume local playback if user is playing
      if (prevCastConnectedRef.current && isPlaying && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      prevCastConnectedRef.current = false;
      lastCastedUrlRef.current = null;
      return;
    }

    // Chromecast is actively connected: silence and pause the local device immediately so audio plays ONLY on the TV!
    prevCastConnectedRef.current = true;
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }

    // Determine the stream URL to play on Cast
    let urlToCast = getBestStreamUrl(activeStream) || 'https://cast.radiosynapse.fr/listen/disco-funk/radio.mp3';
    
    // Use audioRef src if it's a valid remote MP3 / Icecast stream URL
    if (
      audioRef.current?.src && 
      (audioRef.current.src.startsWith('http://') || audioRef.current.src.startsWith('https://')) && 
      !audioRef.current.src.includes(window.location.hostname) &&
      !audioRef.current.src.startsWith('blob:')
    ) {
      urlToCast = getOptimizedHighQualityAudioUrl(audioRef.current.src);
    }

    if (!urlToCast) return;

    const coverToCast = currentTrack.coverUrl || activeStream.tracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80';

    const stationName = (activeStream.name || '').replace(/^Radio Synapse\s*-\s*/i, '').trim() || activeStream.name || 'Radio Synapse';
    const stationId = activeStream.id;
    const stationsPayload = activeStations.map(s => ({
      id: s.id,
      name: (s.name || '').replace(/^Radio Synapse\s*-\s*/i, '').trim() || s.name,
      streamUrl: getBestStreamUrl(s),
      color: s.color || '#00f2ff',
      stationNumber: s.stationNumber || '',
    }));

    const trackDuration = currentTrack.duration || liveTrack.duration || 240;
    const trackPlayedAt = liveTrack.playedAt || 0;
    const trackElapsed = liveTrack.elapsed || 0;

    if (urlToCast !== lastCastedUrlRef.current) {
      // Stream URL actually changed (e.g. station changed): trigger clean stream load on Chromecast
      CastService.playOnCast(
        urlToCast,
        currentTrack.title,
        currentTrack.artist,
        coverToCast,
        stationName,
        stationId,
        stationsPayload,
        primaryColor,
        secondaryColor,
        trackDuration,
        trackPlayedAt,
        trackElapsed,
        currentTime
      );
      lastCastedUrlRef.current = urlToCast;
    } else {
      // Song title, artist or artwork updated on the ACTIVE continuous stream:
      // Dynamically update metadata without restarting/reloading the live stream so music transition remains 100% seamless!
      CastService.updateMetadata(
        currentTrack.title,
        currentTrack.artist,
        coverToCast,
        urlToCast,
        stationName,
        stationId,
        primaryColor,
        secondaryColor,
        trackDuration,
        trackPlayedAt,
        trackElapsed,
        currentTime
      );
    }
  }, [
    castState.connected,
    castState.castType,
    activeStream,
    currentTrack.title,
    currentTrack.artist,
    currentTrack.coverUrl,
    currentTrack.duration,
    liveTrack.duration,
    liveTrack.playedAt,
    liveTrack.elapsed,
    isPlaying,
    primaryColor,
    secondaryColor
  ]);

  // Synchronize color harmony in real-time with Custom Receiver TV
  useEffect(() => {
    if (castState.connected && castState.castType === 'chromecast' && primaryColor && secondaryColor) {
      CastService.sendHarmony(primaryColor, secondaryColor);
    }
  }, [primaryColor, secondaryColor, castState.connected, castState.castType]);

  // Synchronize play state (play/pause) on Cast
  useEffect(() => {
    if (castState.connected && castState.castType === 'chromecast') {
      CastService.setPlayStateOnCast(isPlaying);
    }
  }, [isPlaying, castState.connected, castState.castType]);

  // Periodic high-precision timeline sync with Chromecast TV receiver (eliminates 10-second delay)
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const currentDurationRef = useRef(currentTrack.duration || liveTrack.duration || 240);
  currentDurationRef.current = currentTrack.duration || liveTrack.duration || 240;

  useEffect(() => {
    if (!castState.connected || castState.castType !== 'chromecast') return;

    // Send immediate sync
    CastService.sendTimeSync(currentTimeRef.current, currentDurationRef.current);

    // Sync every 2 seconds during active playback
    const syncInterval = setInterval(() => {
      CastService.sendTimeSync(currentTimeRef.current, currentDurationRef.current);
    }, 2000);

    return () => clearInterval(syncInterval);
  }, [castState.connected, castState.castType, isPlaying]);

  // Synchronize OS / Lockscreen / Bluetooth MediaSession in real time
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      try {
        const cleanAlbumName = (activeStream.name || '').replace(/^Radio Synapse\s*-\s*/i, '').trim() || 'Radio Synapse';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: cleanAlbumName,
          artwork: currentTrack.coverUrl ? [
            { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' },
            { src: currentTrack.coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.coverUrl, sizes: '96x96', type: 'image/jpeg' }
          ] : []
        });

        navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', handleSkipBack);
        navigator.mediaSession.setActionHandler('nexttrack', handleSkipForward);
      } catch {
        // Safe access for browsers with partial MediaSession support
      }
    }
  }, [currentTrack.title, currentTrack.artist, currentTrack.coverUrl, activeStream.name]);

  // Format seconds to MM:SS
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs) || timeInSecs === null) return '00:00';
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = currentTrack.duration > 0 
    ? (currentTime / currentTrack.duration) * 100 
    : 0;

  // Preset & Equalizer Handlers
  const handlePresetChange = (presetName: string) => {
    setActivePreset(presetName);
    const found = EQUALIZER_PRESETS.find(p => p.name === presetName);
    if (found) {
      setEqBands([...found.bands]);
    }
  };

  const handleBandChange = (bandIndex: number, value: number) => {
    setEqBands(prev => {
      const next = [...prev];
      next[bandIndex] = value;
      return next;
    });
    setActivePreset('PERSONNALISÉ');
  };

  const handleResetFlat = () => {
    setEqBands([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setActivePreset('FLAT (LINÉAIRE)');
  };

  // Change channels cleanly with animated physical shutter overlay swipe transition
  const handleStreamChange = (stream: StreamChannel, autoPlay: boolean = false) => {
    const targetUrl = getBestStreamUrl(stream);

    // Synchronously trigger play inside user click context to prevent browser autoplay blocking
    if (autoPlay || isPlaying) {
      setIsPlaying(true);
      if (audioRef.current && targetUrl) {
        if (!castState.connected || castState.castType !== 'chromecast') {
          setAndPlayAudioStream(audioRef.current, targetUrl, true).catch((err) => {
            console.log("Audio play gesture:", err);
          });
        } else {
          pauseAudioStream(audioRef.current);
        }
      }
    }

    if (stream.id === activeStream.id) {
      return;
    }
    
    setShutterForceClosed(true);
    setRewindBadge(null);
    
    setTimeout(() => {
      setActiveStream(stream);
      setCurrentTrackIndex(0);
      setCurrentTime(0);

      // Instantly lookup the real song playing on the target station from our pre-cached now-playing metadata
      const matchedFromCache = matchNowPlayingStation(cachedNowPlaying, stream);

      const nowSec = Math.floor(Date.now() / 1000);

      if (matchedFromCache?.now_playing?.song) {
        const { title, artist, text, art } = matchedFromCache.now_playing.song;
        const parsed = parseTrackMetadata(title, artist, text);
        const songDuration = Math.round(matchedFromCache.now_playing.duration || 240);
        const playedAt = matchedFromCache.now_playing.played_at;
        const elapsed = matchedFromCache.now_playing.elapsed;

        let realElapsed = 0;
        if (playedAt && playedAt > 0) {
          realElapsed = Math.max(0, Math.min(songDuration, nowSec - playedAt));
        } else if (typeof elapsed === 'number') {
          realElapsed = Math.max(0, Math.min(songDuration, Math.round(elapsed)));
        }

        const cachedCover = getCachedTrackCover(parsed.cleanTitle, parsed.cleanArtist);
        const highResCover = cachedCover || art || getStyleFallbackCover(parsed.cleanTitle, parsed.cleanArtist);
        setLiveTrack({
          title: parsed.cleanTitle,
          artist: parsed.cleanArtist,
          coverUrl: highResCover,
          duration: songDuration,
          playedAt: playedAt || (nowSec - realElapsed),
          elapsed: realElapsed,
          fetchTimestamp: nowSec
        });

        // Background lookup if not cached
        if (!cachedCover) {
          fetchTrackCover(parsed.cleanTitle, parsed.cleanArtist, text).then(resolved => {
            if (resolved) {
              setLiveTrack(prev => (prev.title === parsed.cleanTitle && prev.artist === parsed.cleanArtist) ? { ...prev, coverUrl: resolved } : prev);
            }
          });
        }
        setCurrentTime(realElapsed);
      } else {
        const nextDefaultTr = stream.tracks?.[0];
        setLiveTrack({
          title: nextDefaultTr?.title || stream.name || 'En direct',
          artist: nextDefaultTr?.artist || stream.genre || 'Radio Synapse',
          coverUrl: getCachedTrackCover(nextDefaultTr?.title || stream.name, nextDefaultTr?.artist || stream.genre || '') || nextDefaultTr?.coverUrl || '',
          duration: nextDefaultTr?.duration || 240
        });
        setCurrentTime(0);
      }
      
      if (stream.id === 'disco-funk') {
        handlePresetChange('DISCO & FUNK');
      } else if (stream.id === 'rock') {
        handlePresetChange('ROCK & PUNCH');
      }

      if (audioRef.current && (isPlaying || autoPlay) && targetUrl) {
        if (!castState.connected || castState.castType !== 'chromecast') {
          setAndPlayAudioStream(audioRef.current, targetUrl, true).catch(() => {});
        } else {
          pauseAudioStream(audioRef.current);
        }
      }

      setTimeout(() => {
        setShutterForceClosed(false);
      }, 250);
    }, 450);
  };

  // Previous & Next Stream / Station handlers
  const handleSwipeLeft = () => {
    const currentIndex = activeStations.findIndex(s => s.id === activeStream.id);
    const nextIndex = (currentIndex + 1) % activeStations.length;
    handleStreamChange(activeStations[nextIndex]);
  };

  const handleSwipeRight = () => {
    const currentIndex = activeStations.findIndex(s => s.id === activeStream.id);
    const prevIndex = (currentIndex - 1 + activeStations.length) % activeStations.length;
    handleStreamChange(activeStations[prevIndex]);
  };

  const handlePrevStation = () => {
    handleSwipeRight();
  };

  const handleNextStation = () => {
    handleSwipeLeft();
  };

  // Two-way synchronization: update sender station when changed on TV Cast receiver
  useEffect(() => {
    const unsubscribeStation = CastService.addStationChangeListener((stationId: string, streamUrl?: string) => {
      console.log('[App] TV Cast receiver requested station change to:', stationId, streamUrl);
      const activeList = getActiveAdminStations();
      if (activeList.length === 0) return;

      const target = activeList.find(s => 
        s.id === stationId || 
        s.name.toLowerCase() === stationId.toLowerCase() ||
        (s.name.replace(/^Radio Synapse\s*-\s*/i, '').toLowerCase() === stationId.toLowerCase()) ||
        (streamUrl && (s.streamUrl === streamUrl || s.tracks[0]?.audioUrl === streamUrl))
      ) || activeList.find(s => stationId && s.id.toLowerCase().includes(stationId.toLowerCase())) || activeList[0];

      if (target && target.id !== activeStream.id) {
        const targetUrl = target.streamUrl || target.tracks[0]?.audioUrl || streamUrl;
        if (targetUrl) {
          lastCastedUrlRef.current = targetUrl;
        }
        handleStreamChange(target, isPlaying);
      }
    });

    return () => {
      unsubscribeStation();
    };
  }, [activeStream.id, isPlaying, handleStreamChange]);

  // Skip Back: If playing, rewinds to beginning 0:00 of the song; if already at beginning, jumps to previous past track in full length!
  const handleSkipBack = async () => {
    if (currentTime > 3) {
      if (!rewindBadge) {
        setRewindBadge(`DIFFÉRÉ • 00:00`);
        const fullAudio = await resolveFullTrackAudio(liveTrack.title, liveTrack.artist, activeStream.id, liveTrack.duration);
        if (audioRef.current) {
          if (!audioRef.current.src.includes(fullAudio.audioUrl)) {
            audioRef.current.src = fullAudio.audioUrl;
            audioRef.current.load();
          }
          audioRef.current.currentTime = 0;
          if (!castState.connected || castState.castType !== 'chromecast') {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(true));
          } else {
            setIsPlaying(true);
            CastService.playOnCast(fullAudio.audioUrl, liveTrack.title, liveTrack.artist, liveTrack.coverUrl);
          }
        }
        setCurrentTime(0);
      } else {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          if (!isPlaying) {
            if (!castState.connected || castState.castType !== 'chromecast') {
              audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            } else {
              setIsPlaying(true);
            }
          }
        }
        setCurrentTime(0);
      }
      return;
    }

    // At beginning: switch to previous played song from history
    if (historyTracks.length > 0) {
      const currentIndexInHistory = historyTracks.findIndex(h => h.title === liveTrack.title && h.artist === liveTrack.artist);
      let targetIndex = 0;
      if (currentIndexInHistory >= 0 && currentIndexInHistory + 1 < historyTracks.length) {
        targetIndex = currentIndexInHistory + 1;
      }
      handleSelectPastTrack(historyTracks[targetIndex], targetIndex);
    } else {
      handlePrevStation();
    }
  };

  // Skip Forward: If in deferred mode, advance to next more recent song or return to DIRECT
  const handleSkipForward = () => {
    if (rewindBadge) {
      const currentIndexInHistory = historyTracks.findIndex(h => h.title === liveTrack.title && h.artist === liveTrack.artist);
      if (currentIndexInHistory > 0) {
        handleSelectPastTrack(historyTracks[currentIndexInHistory - 1], currentIndexInHistory - 1);
      } else {
        handleReturnToDirect();
      }
    } else {
      handleNextStation();
    }
  };

  // Select a past track from history:
  // Resolves 100% full length track (NO 30-second preview cuts!) and plays from 0:00
  const handleSelectPastTrack = async (track: PastTrack, _index: number) => {
    // 1. Close history drawer
    setShowHistoryDrawer(false);

    // 2. Physical shutter mechanical close animation
    setShutterForceClosed(true);

    // 3. Set prominent rewind badge indicator
    setRewindBadge(`-${track.minutesAgo} MIN • ${track.playedAt}`);

    // 4. Resolve 100% full-length audio stream
    const fullAudio = await resolveFullTrackAudio(track.title, track.artist, activeStream.id, track.duration);
    const trackDuration = track.duration && track.duration > 30 ? track.duration : fullAudio.duration;
    const highResCover = getCachedTrackCover(track.title, track.artist) || track.coverUrl;

    // 5. Update track metadata to the selected past track with full duration
    setLiveTrack({
      title: track.title,
      artist: track.artist,
      coverUrl: highResCover,
      duration: trackDuration
    });
    setCurrentTime(0);

    // 6. Set real audio stream in audio player, rewind to 0, and start full track playback
    if (audioRef.current) {
      audioRef.current.src = fullAudio.audioUrl;
      audioRef.current.currentTime = 0;
      audioRef.current.load();
      if (!castState.connected || castState.castType !== 'chromecast') {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn("Audio play error:", err);
          setIsPlaying(true);
        });
      } else {
        setIsPlaying(true);
        CastService.playOnCast(fullAudio.audioUrl, track.title, track.artist, highResCover);
      }
    }

    // 7. Open shutter revealing the selected past track spinning on MiniDisc
    setTimeout(() => {
      setShutterForceClosed(false);
    }, 450);
  };

  // Return to direct stream
  const handleReturnToDirect = () => {
    setRewindBadge(null);
    setShutterForceClosed(true);

    const matchedFromCache = cachedNowPlaying?.find((item: any) => {
      const sc = item?.station?.shortcode;
      return sc === activeStream.id || (sc === 'disco_funk' && activeStream.id === 'disco-funk');
    });

    const nowSec = Math.floor(Date.now() / 1000);
    if (matchedFromCache?.now_playing?.song) {
      const { title, artist, text } = matchedFromCache.now_playing.song;
      const parsed = parseTrackMetadata(title, artist, text);
      const songDuration = Math.round(matchedFromCache.now_playing.duration || 240);
      const playedAt = matchedFromCache.now_playing.played_at;
      const elapsed = matchedFromCache.now_playing.elapsed;

      let realElapsed = 0;
      if (playedAt && playedAt > 0) {
        realElapsed = Math.max(0, Math.min(songDuration, nowSec - playedAt));
      } else if (typeof elapsed === 'number') {
        realElapsed = Math.max(0, Math.min(songDuration, Math.round(elapsed)));
      }

      const cachedCover = getCachedTrackCover(parsed.cleanTitle, parsed.cleanArtist);
      const highResCover = cachedCover || getStyleFallbackCover(parsed.cleanTitle, parsed.cleanArtist);
      setLiveTrack({
        title: parsed.cleanTitle,
        artist: parsed.cleanArtist,
        coverUrl: highResCover,
        duration: songDuration,
        playedAt: playedAt || (nowSec - realElapsed),
        elapsed: realElapsed,
        fetchTimestamp: nowSec
      });

      if (!cachedCover) {
        fetchTrackCover(parsed.cleanTitle, parsed.cleanArtist, text).then(resolved => {
          if (resolved) {
            setLiveTrack(prev => (prev.title === parsed.cleanTitle && prev.artist === parsed.cleanArtist) ? { ...prev, coverUrl: resolved } : prev);
          }
        });
      }
      setCurrentTime(realElapsed);
    } else {
      setCurrentTime(0);
    }

    const liveUrl = getBestStreamUrl(activeStream);
    
    setTimeout(() => {
      if (audioRef.current && liveUrl) {
        if (!castState.connected || castState.castType !== 'chromecast') {
          setAndPlayAudioStream(audioRef.current, liveUrl, true).then(() => {
            setIsPlaying(true);
          }).catch(() => {
            setIsPlaying(true);
          });
        } else {
          setIsPlaying(true);
          CastService.playOnCast(liveUrl, liveTrack.title, liveTrack.artist, liveTrack.coverUrl);
        }
      }
      setShutterForceClosed(false);
    }, 300);
  };

  // Synchronize dynamic Web Audio API stream on initial mount / stream change when in direct mode
  useEffect(() => {
    if (rewindBadge) return; // Don't override if user is listening in deferred/past mode
    const audio = audioRef.current;
    if (!audio) return;

    const targetUrl = getBestStreamUrl(activeStream);
    if (targetUrl) {
      if (!castState.connected || castState.castType !== 'chromecast') {
        if (isPlaying) {
          setAndPlayAudioStream(audio, targetUrl, true).catch((err) => {
            console.warn("Audio autoplay blocked by browser:", err);
          });
        }
      }
    }
  }, [activeStream, isPlaying, castState.connected, castState.castType, rewindBadge]);

  // Handle play / pause toggle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (castState.connected && castState.castType === 'chromecast') {
      // Audio is routed to Chromecast TV only, sender device remains silent
      pauseAudioStream(audio);
      return;
    }

    if (isPlaying) {
      if (!rewindBadge) {
        const targetUrl = getBestStreamUrl(activeStream);
        setAndPlayAudioStream(audio, targetUrl, true).catch(() => {
          console.log("Active browser interaction required to unlock audio.");
        });
      } else {
        audio.play().catch(() => {});
      }
    } else {
      pauseAudioStream(audio);
    }
  }, [isPlaying, castState.connected, castState.castType, rewindBadge, activeStream]);

  // Live progress ticker: synchronizes progress bar with real on-air song elapsed time
  useEffect(() => {
    if (rewindBadge) return;

    const updateLiveTime = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const trackDuration = liveTrack.duration || 240;

      if (typeof liveTrack.elapsed === 'number' && liveTrack.fetchTimestamp) {
        const delta = nowSec - liveTrack.fetchTimestamp;
        const realElapsed = liveTrack.elapsed + delta;
        setCurrentTime(Math.min(trackDuration, Math.max(0, realElapsed)));
        return;
      } else if (liveTrack.playedAt && liveTrack.playedAt > 0) {
        const realElapsed = nowSec - liveTrack.playedAt;
        if (realElapsed >= 0) {
          setCurrentTime(Math.min(trackDuration, realElapsed));
          return;
        }
      }

      // Fallback
      if (isPlaying) {
        setCurrentTime((prev) => (prev < trackDuration ? prev + 1 : 0));
      }
    };

    updateLiveTime();
    const ticker = setInterval(updateLiveTime, 1000);

    return () => clearInterval(ticker);
  }, [liveTrack.playedAt, liveTrack.elapsed, liveTrack.fetchTimestamp, liveTrack.duration, rewindBadge, isPlaying]);

  // Main container touch vertical swipe handling (Swipe UP -> show stations, Swipe DOWN -> hide stations)
  const handleMainTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't drag if touching interactive elements or inside the physical MiniDisc cartridge (which has its own swipe station logic)
    if (
      target.closest('button, a, input, select, textarea, [role="button"], .cursor-pointer') ||
      target.closest('#sony-minidisc-cartridge')
    ) {
      return;
    }
    setMainTouchStartY(e.touches[0].clientY);
    setMainTouchStartX(e.touches[0].clientX);
  };

  const handleMainTouchEnd = (e: React.TouchEvent) => {
    if (mainTouchStartY === null || mainTouchStartX === null) return;
    const diffY = e.changedTouches[0].clientY - mainTouchStartY;
    const diffX = e.changedTouches[0].clientX - mainTouchStartX;

    // Swipe UP to reveal Stations
    if (diffY < -50 && Math.abs(diffY) > Math.abs(diffX)) {
      setShowStationsView(true);
    } 
    // Swipe DOWN when stations view is open
    else if (diffY > 50 && Math.abs(diffY) > Math.abs(diffX) && showStationsView) {
      setShowStationsView(false);
    }
    setMainTouchStartY(null);
    setMainTouchStartX(null);
  };

  // Main container mouse vertical drag handling (Drag UP -> show stations, Drag DOWN -> hide stations)
  const handleMainMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't drag if clicking interactive elements or inside the physical MiniDisc cartridge
    if (
      target.closest('button, a, input, select, textarea, [role="button"], .cursor-pointer') ||
      target.closest('#sony-minidisc-cartridge')
    ) {
      return;
    }
    setMainMouseDownY(e.clientY);
    setMainMouseDownX(e.clientX);
  };

  const handleMainMouseMove = (e: React.MouseEvent) => {
    if (mainMouseDownY === null || mainMouseDownX === null) return;
    const diffY = e.clientY - mainMouseDownY;
    const diffX = e.clientX - mainMouseDownX;

    // Detect pull up/down
    if (Math.abs(diffY) > 55 && Math.abs(diffY) > Math.abs(diffX)) {
      if (diffY < -55) {
        // Drag UP to show stations
        setShowStationsView(true);
        setMainMouseDownY(null);
        setMainMouseDownX(null);
      } else if (diffY > 55 && showStationsView) {
        // Drag DOWN to hide stations
        setShowStationsView(false);
        setMainMouseDownY(null);
        setMainMouseDownX(null);
      }
    }
  };

  const handleMainMouseUp = () => {
    setMainMouseDownY(null);
    setMainMouseDownX(null);
  };

  // Direct native Cast prompt on desktop browser vs. helper modal on mobile devices
  const handleCastButtonClick = () => {
    const isMobile = typeof window !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
      (window.matchMedia && window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches)
    );

    if (isMobile) {
      setIsCastModalOpen(true);
    } else {
      // Directly trigger native browser Google Cast / Smart TV picker
      CastService.promptCast(audioRef.current);
    }
  };

  // IF OPENED VIA A SHARED FLYER URL, RENDER ONLY THE STANDALONE FLYER LANDING PAGE
  if (sharedSmartLinkTrack) {
    return (
      <StandaloneTrackFlyerPage
        track={sharedSmartLinkTrack}
        onLaunchRadioApp={(stationName) => {
          if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setSharedSmartLinkTrack(null);
          handleListenLiveFromShare(stationName);
        }}
      />
    );
  }

  return (
    <div 
      id="app-container" 
      onTouchStart={handleMainTouchStart}
      onTouchEnd={handleMainTouchEnd}
      onMouseDown={handleMainMouseDown}
      onMouseMove={handleMainMouseMove}
      onMouseUp={handleMainMouseUp}
      className="h-screen h-[100dvh] max-h-[100dvh] w-full max-w-full bg-[#040406] text-white flex flex-col items-center justify-between p-2 sm:p-3.5 md:p-5 select-none relative overflow-hidden font-sans min-h-0"
    >
      {/* 0. Splash Screen overlay transition during boot */}
      {showSplash && (
        <Splash 
          onTopBarAppear={handleSplashTopBarAppear}
          onComplete={handleSplashComplete} 
        />
      )}

      {/* 1. Global background cover with blur and dimming layers for rich ambiance */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden scale-110">
        {bgCoverPrevious && (
          <img 
            src={bgCoverPrevious} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover blur-[85px] scale-110" 
            style={{ opacity: 0.5 * (1 - bgCrossfadeOpacity) }}
            referrerPolicy="no-referrer"
          />
        )}
        <img 
          src={bgCoverCurrent} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover blur-[85px] scale-110" 
          style={{ opacity: 0.5 * bgCrossfadeOpacity }}
          referrerPolicy="no-referrer"
        />
        {/* Soft dark background overlay for high contrast and modern ergonomics */}
        <div className="absolute inset-0 bg-[#040406]/80 backdrop-blur-[3px]" />
        {/* Physical vignette around viewport edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/95 opacity-90" />
      </div>

      {/* Dynamic ambient background glow - Primary Color Harmony */}
      <div 
        className="fixed top-[-250px] left-1/2 -translate-x-1/2 w-[850px] h-[850px] rounded-full opacity-20 blur-3xl pointer-events-none z-0"
        style={{
          background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`
        }}
      />

      {/* Dynamic ambient background glow - Secondary Color Harmony */}
      <div 
        className="fixed bottom-[-200px] left-1/2 -translate-x-1/2 w-[750px] h-[750px] rounded-full opacity-15 blur-3xl pointer-events-none z-0"
        style={{
          background: `radial-gradient(circle, ${secondaryColor} 0%, transparent 70%)`
        }}
      />

      {/* Hidden native HTML5 Audio element for audio pipeline & cast support */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={() => {
          if (rewindBadge && audioRef.current && !isNaN(audioRef.current.currentTime)) {
            setCurrentTime(Math.floor(audioRef.current.currentTime));
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && rewindBadge && audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
            setLiveTrack(prev => ({
              ...prev,
              duration: Math.floor(audioRef.current!.duration)
            }));
          }
        }}
        onEnded={() => {
          if (rewindBadge) {
            handleReturnToDirect();
          } else {
            handleNextStation();
          }
        }}
      />
      
      {/* 2. PROPORTIONALLY SCALED RETRO-FUTURISTIC MINIDISC CONSOLE CHASSIS */}
      <div 
        id="app-viewport-scaler" 
        className="relative flex items-center justify-center w-full h-full flex-1 min-h-0 overflow-hidden z-10"
      >
        <div 
          id="minidisc-console-chassis"
          style={{
            width: '390px',
            height: '710px',
            transform: `scale(${viewportScale})`,
            transformOrigin: 'center center',
          }}
          className="relative flex flex-col items-center justify-between select-none shrink-0 w-[390px] h-[710px] p-2"
        >
          {/* Top Brand & Streaming Header Bar */}
          <motion.header 
            id="app-top-branding-bar" 
            initial={{ opacity: 0 }}
            animate={topBarVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="w-full relative flex items-center justify-between border-b border-white/10 pb-2.5 z-10 h-12 shrink-0"
          >
            {/* Left Section: User Profile Avatar (Compte connecté & Synchro Multi-appareils) */}
            <div className="flex items-center">
              <button
                onClick={() => setShowUserProfileDrawer(true)}
                className="group relative flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                title={connectedAccount ? `Compte ${connectedAccount.provider.toUpperCase()} (${connectedAccount.username}) - Synchronisé` : "Gérer mon compte & synchronisation multi-appareils"}
                aria-label="Compte et profil utilisateur"
              >
                <div 
                  className="p-[2px] rounded-full flex items-center justify-center transition-all duration-700 ease-out"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, #ffffff 45%, ${secondaryColor})`,
                    boxShadow: `0 0 16px ${hexToRgba(primaryColor, 0.55)}, 0 0 22px ${hexToRgba(secondaryColor, 0.35)}`,
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden border border-black/40">
                    {connectedAccount?.avatarUrl ? (
                      <img src={connectedAccount.avatarUrl} alt={connectedAccount.username} className="w-full h-full object-cover" />
                    ) : (
                      <User 
                        className="w-4 h-4 text-white transition-colors duration-700" 
                        style={{ color: primaryColor }}
                      />
                    )}
                  </div>
                </div>

                {/* Voyant actif à cheval sur le bord extérieur du cercle de l'avatar */}
                {connectedAccount && (
                  <span 
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-zinc-950 z-20 transition-all duration-700"
                    style={{
                      backgroundColor: primaryColor,
                      boxShadow: `0 0 8px ${hexToRgba(primaryColor, 0.9)}`,
                    }}
                  />
                )}
              </button>
            </div>
            
            {/* Centered Section: Brand Logo (Positioned high up near top edge of screen) */}
            <div 
              id="topbar-brand-logo-target"
              className={`absolute left-1/2 top-0.5 -translate-x-1/2 z-10 flex items-center justify-center pointer-events-auto transition-opacity duration-150 ${
                showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <BrandLogo size="md" withStar={true} isAnimated={true} />
            </div>
            
            {/* Right Section: On-Air / Rewound Status Badge & Companion Sandwich Menu */}
            <div className="flex items-center gap-2 min-w-[64px] justify-end z-20">
              {rewindBadge && (
                <button
                  onClick={handleReturnToDirect}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-[11px] font-mono text-amber-300 hover:bg-amber-500/30 transition-all cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse"
                  title="Cliquer pour revenir au direct"
                >
                  <RotateCcw className="w-3 h-3 text-amber-300 animate-spin" />
                  <span className="font-bold uppercase tracking-wider">{rewindBadge} • DIRECT</span>
                </button>
              )}
              
              {/* Overlay Navigation Sandwich Menu Button */}
              <button
                onClick={() => setShowNavOverlayMenu(true)}
                className="group relative p-[1.5px] rounded-xl transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, #ffffff 50%, ${secondaryColor})`,
                  boxShadow: `0 0 14px ${hexToRgba(primaryColor, 0.4)}, 0 0 20px ${hexToRgba(secondaryColor, 0.25)}`,
                }}
                title="Menu de Navigation Synapse"
                aria-label="Menu principal de navigation"
              >
                <div className="p-2 rounded-[10.5px] bg-zinc-950/90 backdrop-blur-md flex items-center justify-center relative overflow-hidden">
                  {/* White 3-bar hamburger lines with clean white glow */}
                  <div className="w-5 h-4 flex flex-col justify-between items-center relative z-10">
                    <span className="w-full h-[2.5px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)] group-hover:bg-white transition-colors" />
                    <span className="w-3.5 h-[2.5px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)] self-end group-hover:w-full group-hover:bg-white transition-all" />
                    <span className="w-full h-[2.5px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)] group-hover:bg-white transition-colors" />
                  </div>
                </div>
              </button>
            </div>
          </motion.header>

          {/* VIEW CONTAINER (MAIN PLAYER vs. STATIONS VIEW SLIDE TRANSITION) */}
          <div className="relative w-full flex-1 min-h-0 flex flex-col items-center justify-between overflow-hidden z-10 py-0.5">
            
            {/* MAIN SPACIOUS PLAYER INTERFACE (SLIDES UP WHEN STATIONS VIEW IS OPEN) */}
            <main 
              id="app-main-interface-casing" 
              className={`w-full flex flex-col items-center justify-between flex-1 min-h-0 gap-1 py-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-30 ${
                !playerVisible
                  ? 'opacity-0 pointer-events-none translate-y-8'
                  : showStationsView 
                    ? '-translate-y-[110%] opacity-0 pointer-events-none scale-95' 
                    : 'translate-y-0 opacity-100 scale-100'
              }`}
            >
              {/* 1. SONY MINIDISC DECK PLAYER (SLIDES UP WITH FADE) */}
              <motion.div 
                initial={{ opacity: 0, y: 55 }}
                animate={playerVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 55 }}
                transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex-1 min-h-0 flex items-center justify-center -mb-5 sm:-mb-7"
              >
                <MiniDiscPlayer
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                  accentColor={accentColor}
                  activeStream={activeStream}
                  allStations={activeStations}
                  shutterForceClosed={shutterForceClosed}
                  isFavoriteStation={isStationFavorite(activeStream.id)}
                  onToggleFavoriteStation={() => handleToggleFavoriteStation(activeStream.id)}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                  onSwipeUp={() => setShowStationsView(true)}
                />
              </motion.div>

              {/* 2. PLAYBACK STATUS & NAVIGATION CONTROLS (SLIDES DOWN FROM BEHIND THE SEPARATION LINE) */}
              <div 
                id="playback-status-deck" 
                className="w-full px-3 pt-2 pb-1 select-none flex flex-col bg-transparent transition-all duration-300 relative overflow-hidden z-10 shrink-0 -mt-2"
                style={{
                  ['--primary-color' as any]: primaryColor,
                  ['--primary-color-glow' as any]: hexToRgba(primaryColor, 0.45),
                  ['--primary-color-dim' as any]: hexToRgba(primaryColor, 0.18),
                  ['--primary-color-border' as any]: hexToRgba(primaryColor, 0.35),
                  ['--secondary-color' as any]: secondaryColor,
                  ['--secondary-color-glow' as any]: hexToRgba(secondaryColor, 0.45),
                  ['--secondary-color-dim' as any]: hexToRgba(secondaryColor, 0.18),
                  ['--secondary-color-border' as any]: hexToRgba(secondaryColor, 0.35),
                }}
              >
                {/* Glowing Separation Line (Positioned snugly right under the MiniDisc case) */}
                <div className="absolute top-0 left-2 right-2 h-[2px] pointer-events-none z-20 overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={playerVisible ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
                    transition={{ duration: 0.65, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full h-full relative"
                    style={{
                      transformOrigin: 'left center',
                      background: `linear-gradient(90deg, transparent 0%, var(--primary-color) 25%, #ffffff 50%, var(--secondary-color) 75%, transparent 100%)`,
                      boxShadow: `0 0 14px var(--primary-color-glow), 0 0 22px var(--secondary-color-glow)`,
                    }}
                  >
                    {/* Light sheen sweep from left to right */}
                    <motion.div
                      initial={{ x: '-100%' }}
                      animate={playerVisible ? { x: '100%' } : { x: '-100%' }}
                      transition={{ duration: 0.85, delay: 0.6, ease: 'easeInOut' }}
                      className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white to-transparent opacity-90"
                    />
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: -45 }}
                  animate={playerVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -45 }}
                  transition={{ duration: 0.8, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full flex flex-col pt-1"
                >

                  {/* Track Info Header (Spacious, Clear & High Contrast) + Enlarged Retro-Futuristic MiniDisc Play Button */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0 pr-1">
                      <MarqueeText
                        text={currentTrack.title}
                        className="font-futuristic text-base sm:text-lg md:text-xl font-black text-white tracking-wider block leading-tight hover:opacity-80 transition-colors"
                        style={{ textShadow: isPlaying ? '0 0 16px var(--primary-color-glow)' : undefined }}
                      />
                      
                      <div className="flex items-center gap-2 mt-1 flex-wrap min-w-0">
                        <div className="flex-1 min-w-0">
                          <MarqueeText
                            text={currentTrack.artist}
                            className="text-xs sm:text-sm font-bold uppercase tracking-widest block font-mono transition-colors duration-500"
                            style={{ color: 'var(--secondary-color)' }}
                          />
                        </div>
                        {rewindBadge && (
                          <button
                            onClick={handleReturnToDirect}
                            className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-950/80 border border-amber-400/70 text-amber-300 flex items-center gap-1.5 shadow-md hover:bg-amber-900 transition-colors cursor-pointer animate-pulse shrink-0"
                          >
                            <RotateCcw className="w-3 h-3 animate-spin" />
                            DIRECT
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Play / Pause button on the right of title & artist - Retro-Futuristic MiniDisc Deck Stylized */}
                    <button
                      id="header-play-pause-btn"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="group relative w-[48px] h-[48px] rounded-full flex items-center justify-center text-white transition-all duration-300 transform hover:scale-105 active:scale-95 active:translate-y-[1px] cursor-pointer shrink-0 select-none"
                      style={{
                        background: `linear-gradient(135deg, #d4d4d8 0%, #71717a 35%, #27272a 70%, #52525b 100%)`,
                        padding: '1.5px',
                        boxShadow: isPlaying
                          ? `0 4px 14px rgba(0,0,0,0.85), 0 0 16px var(--primary-color-glow), inset 0 1px 1px rgba(255,255,255,0.8)`
                          : `0 3px 10px rgba(0,0,0,0.75), inset 0 1px 1px rgba(255,255,255,0.7)`,
                      }}
                      title={isPlaying ? "Mettre en pause (PAUSE ❚❚)" : "Lancer la lecture (PLAY ▶)"}
                      aria-label={isPlaying ? "Mettre en pause" : "Lancer la lecture"}
                    >
                      {/* Subtle Ambient Pulsing Glow Halo */}
                      <div 
                        className={`absolute -inset-1 rounded-full transition-all duration-500 pointer-events-none ${
                          isPlaying ? 'opacity-80 animate-pulse' : 'opacity-0 group-hover:opacity-60'
                        }`}
                        style={{
                          backgroundColor: 'var(--primary-color-glow)',
                          filter: 'blur(8px)',
                        }}
                      />
                      
                      {/* Outer Lathe-Brushed Metallic Chamfer Ring */}
                      <div className="w-full h-full rounded-full p-[1.5px] bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center shadow-inner relative overflow-hidden">
                        {/* Concentric micro-machined circular texture */}
                        <div 
                          className="absolute inset-0 rounded-full pointer-events-none opacity-40"
                          style={{
                            background: 'radial-gradient(circle, transparent 40%, rgba(255,255,255,0.15) 42%, transparent 44%, rgba(0,0,0,0.6) 70%, rgba(255,255,255,0.2) 98%)',
                          }}
                        />

                        {/* Stepped Recessed Ring with Station Accent Rim */}
                        <div 
                          className="w-full h-full rounded-full p-[1px] transition-all duration-500 relative flex flex-col items-center justify-center overflow-hidden"
                          style={{
                            background: isPlaying
                              ? `radial-gradient(circle at 35% 30%, #2a2b33 0%, #111216 75%, #08080a 100%)`
                              : `radial-gradient(circle at 35% 30%, #222328 0%, #0d0e11 80%, #050507 100%)`,
                            border: isPlaying 
                              ? '1px solid var(--primary-color)' 
                              : '1px solid rgba(255,255,255,0.25)',
                            boxShadow: isPlaying 
                              ? 'inset 0 2px 4px rgba(0,0,0,0.9), 0 0 6px var(--primary-color-glow)' 
                              : 'inset 0 2px 4px rgba(0,0,0,0.95)',
                          }}
                        >
                          {/* Prismatic micro-reflection ray */}
                          <div 
                            className="absolute inset-0 rounded-full opacity-35 pointer-events-none"
                            style={{
                              background: 'conic-gradient(from 215deg at 50% 50%, transparent 0%, rgba(255,255,255,0.3) 15%, transparent 30%, transparent 50%, rgba(255,255,255,0.2) 65%, transparent 80%)',
                            }}
                          />

                          {/* Main Center Vector Glyph - Kept prominent at w-6.5 h-6.5 */}
                          <div className="relative z-10 flex items-center justify-center">
                            {isPlaying ? (
                              <Pause 
                                className="w-6.5 h-6.5 fill-white text-white transition-all duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                                style={{ filter: `drop-shadow(0 0 8px var(--primary-color))` }}
                              />
                            ) : (
                              <Play 
                                className="w-6.5 h-6.5 fill-white text-white translate-x-[2px] transition-all duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                                style={{ filter: `drop-shadow(0 0 8px var(--primary-color))` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Interactive Scrubbing Slider (Spotify Signature Bar) - Kept ABOVE the navigation */}
                  <div className="flex flex-col gap-1 pt-0.5">
                    <div className="relative group w-full flex items-center py-1.5 cursor-pointer">
                      <input 
                        type="range"
                        min="0"
                        max={currentTrack.duration || 100}
                        value={currentTime}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleSeek(val);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-35"
                      />
                      
                      {/* Slider Track */}
                      <div className="w-full h-1.5 group-hover:h-2 bg-white/15 rounded-full transition-all duration-200 relative overflow-hidden flex items-center">
                        <div 
                          className="h-full rounded-full transition-all duration-150 ease-out"
                          style={{
                            width: `${progressPercent}%`,
                            backgroundColor: rewindBadge ? '#f59e0b' : 'var(--primary-color)',
                            boxShadow: isPlaying ? (rewindBadge ? '0 0 12px #f59e0b' : `0 0 12px var(--primary-color)`) : 'none'
                          }}
                        />
                      </div>

                      {/* Glowing Thumb Handle */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                        style={{
                          left: `calc(${progressPercent}% - 7px)`,
                          boxShadow: `0 0 10px var(--primary-color)`,
                        }}
                      />
                    </div>

                    {/* Timestamps (Current / Total Duration) */}
                    <div className="flex justify-between items-center text-[11px] font-mono text-zinc-300 select-none">
                      <span className="font-semibold text-zinc-200 tracking-wider">
                        {formatTime(currentTime)}
                      </span>
                      <span className="text-zinc-400 tracking-wider">
                        {formatTime(currentTrack.duration || 240)}
                      </span>
                    </div>
                  </div>

                  {/* NAVIGATION CONTROLS ROW - Placed BELOW the scrubbing bar */}
                  <div className="flex items-center justify-between w-full pt-2 px-1">
                    
                    {/* 1. PAST TRACKS / HISTORIQUE */}
                    <button
                      id="past-tracks-btn"
                      onClick={() => setShowHistoryDrawer(true)}
                      className="p-2.5 hover:text-white transition-all duration-300 transform hover:scale-115 active:scale-90 cursor-pointer flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group relative"
                      title="Historique des titres passés (15 dernières minutes)"
                    >
                      <History 
                        className="w-5.5 h-5.5 transition-all duration-500 group-hover:-rotate-12" 
                        style={{ color: 'var(--secondary-color)' }}
                      />
                    </button>

                    {/* 2. PREVIOUS TRACK / REWIND */}
                    <button
                      id="prev-station-btn"
                      onClick={handleSkipBack}
                      className="p-2.5 hover:text-white transition-all duration-300 transform hover:scale-115 active:scale-90 cursor-pointer flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                      style={{ color: 'var(--secondary-color)' }}
                      title="Retour en arrière (Début du titre / Titre précédent)"
                    >
                      <SkipBack className="w-6 h-6 fill-current transition-colors duration-500" />
                    </button>

                    {/* 2b. LIKE / FAVORITE HEART BUTTON (Long-press opens Liked Tracks page) */}
                    <button
                      id="like-track-btn"
                      onMouseDown={handleHeartMouseDown}
                      onMouseUp={handleHeartMouseUp}
                      onTouchStart={handleHeartTouchStart}
                      onTouchEnd={handleHeartTouchEnd}
                      className="p-2.5 transition-all duration-300 transform hover:scale-125 active:scale-90 cursor-pointer flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group relative"
                      title={
                        currentTrackLikeLevel === 0
                          ? "Cliquer pour aimer (1-clic: Like, 2-clics: Super Like). Maintien prolongé pour la liste."
                          : currentTrackLikeLevel === 1
                          ? "Niveau 1 : Like. Cliquer à nouveau pour Super Like (Double cœur)"
                          : "Niveau 2 : Super Like (Double cœur). Cliquer à nouveau pour retirer."
                      }
                    >
                      <DoubleHeartIcon 
                        level={currentTrackLikeLevel}
                        customColor={currentTrackColor}
                        sizeClassName="w-6 h-6"
                      />
                    </button>

                    {/* 3. NEXT TRACK / ADVANCE */}
                    <button
                      id="next-station-btn"
                      onClick={handleSkipForward}
                      className="p-2.5 hover:text-white transition-all duration-300 transform hover:scale-115 active:scale-90 cursor-pointer flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                      style={{ color: 'var(--secondary-color)' }}
                      title={rewindBadge ? "Avancer (Titre suivant / Direct)" : "Station suivante"}
                    >
                      <SkipForward className="w-6 h-6 fill-current transition-colors duration-500" />
                    </button>

                    {/* 4. EQUALIZER */}
                    <button
                      id="equalizer-quick-btn"
                      onClick={() => setShowEqualizer(true)}
                      className="p-2.5 hover:text-white transition-all duration-300 transform hover:scale-115 active:scale-90 cursor-pointer flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group relative"
                      style={{ color: 'var(--secondary-color)' }}
                      title="Ouvrir l'égaliseur audio studio"
                    >
                      <Sliders className="w-5.5 h-5.5 transition-all duration-500 group-hover:scale-110" />
                    </button>

                    {/* 5. GOOGLE CAST / AIRPLAY */}
                    <button
                      id="player-navigation-cast-btn"
                      onClick={handleCastButtonClick}
                      className="p-2.5 hover:text-white transition-all duration-300 transform hover:scale-115 active:scale-90 cursor-pointer flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group relative"
                      style={{ color: castState.connected ? 'var(--primary-color)' : 'var(--secondary-color)' }}
                      title={castState.connected ? `Connecté à ${castState.deviceName}` : "Diffuser le flux audio (Cast / AirPlay)"}
                    >
                      <Cast className={`w-5.5 h-5.5 transition-all duration-500 group-hover:scale-110 ${castState.connected ? 'animate-pulse' : ''}`} />
                    </button>

                  </div>
                </motion.div>
              </div>

          {/* Upward Arrow Indicator & Metallic "STATIONS" Label */}
          <ChromaticStationsLabel
            stationId={activeStream.id}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onClick={() => setShowStationsView(true)}
          />
        </main>

        {/* STATIONS LIST VIEW (SLIDES IN WHEN USER SWIPES UP ON PLAYER) */}
        <section
          id="stations-slide-screen"
          className={`absolute inset-0 w-full h-full flex flex-col justify-between p-4 sm:p-6 bg-[#08080c]/95 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 ${
            showStationsView 
              ? 'translate-y-0 opacity-100 pointer-events-auto' 
              : 'translate-y-[110%] opacity-0 pointer-events-none'
          }`}
        >
          {/* Header with pull down handle & close action */}
          <div className="flex flex-col items-center border-b border-white/10 pb-3">
            <button 
              onClick={() => setShowStationsView(false)}
              className="w-16 h-1.5 bg-zinc-700 hover:bg-white rounded-full mb-3 cursor-pointer transition-colors"
              title="Fermer la liste des stations"
              aria-label="Fermer la liste des stations"
            />
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-white" />
                <h2 className="font-futuristic text-xs sm:text-sm font-bold uppercase tracking-widest text-white">
                  Stations Radio Synapse
                </h2>
              </div>

              <button 
                onClick={() => setShowStationsView(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                title="Fermer la liste des stations"
                aria-label="Fermer"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stations Single-Column Top-Aligned List */}
          <div className="flex-1 flex flex-col justify-start gap-3 py-3 overflow-y-auto w-full">
            <div className="flex flex-col gap-3 w-full">
              {activeStations.map((st, index) => {
                const isActive = st.id === activeStream.id;
                const isExpanded = !!expandedStations[st.id];

                // Extract live playing song from AzuraCast cached metadata for this station
                const stationNowPlaying = cachedNowPlaying?.find((item: any) => {
                  const shortcode = item?.station?.shortcode;
                  return shortcode === st.id || (shortcode === 'disco_funk' && st.id === 'disco-funk');
                });

                let trackTitle = '';
                let trackArtist = '';
                let trackCover = '';

                if (isActive) {
                  trackTitle = currentTrack.title;
                  trackArtist = currentTrack.artist;
                  trackCover = currentTrack.coverUrl;
                } else if (stationNowPlaying?.now_playing?.song) {
                  const parsed = parseTrackMetadata(
                    stationNowPlaying.now_playing.song.title,
                    stationNowPlaying.now_playing.song.artist,
                    stationNowPlaying.now_playing.song.text
                  );
                  trackTitle = parsed.cleanTitle;
                  trackArtist = parsed.cleanArtist;
                  trackCover = getCachedTrackCover(parsed.cleanTitle, parsed.cleanArtist) || getStyleFallbackCover(parsed.cleanTitle, parsed.cleanArtist);
                } else {
                  trackTitle = 'En Direct';
                  trackArtist = 'Radio Synapse';
                  trackCover = st.tracks[0]?.coverUrl || '';
                }

                const displayTrack = {
                  title: trackTitle,
                  artist: trackArtist,
                  coverUrl: trackCover
                };

                const stationColor = isActive ? currentTrackColor : (st.color || '#00f2ff');

                return (
                  <div
                    key={`station-card-${st.id || 'st'}-${index}`}
                    className={`w-full rounded-2xl border transition-all duration-700 ease-out relative overflow-hidden flex flex-col ${
                      isActive
                        ? 'bg-gradient-to-r from-zinc-900/90 via-black/85 to-black/95 border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.08)]'
                        : 'bg-black/50 border-white/10 hover:border-white/25 hover:bg-black/75'
                    }`}
                    style={{
                      borderColor: isActive ? stationColor : undefined,
                      boxShadow: isActive
                        ? `0 0 24px ${hexToRgba(stationColor, 0.25)}, inset 0 0 16px ${hexToRgba(stationColor, 0.08)}`
                        : undefined,
                    }}
                  >
                    {/* Real-time Sound Reactive Equalizer in Background for Active Station (Harmonized with Track Cover Colors) */}
                    {isActive && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-70 transition-opacity duration-700">
                        <ReactiveStationWave
                          isPlaying={isPlaying}
                          primaryColor={primaryColor}
                          secondaryColor={secondaryColor}
                          audioElement={audioRef.current}
                          className="w-full h-full transition-all duration-700"
                        />
                      </div>
                    )}

                    {/* Main Clickable Header & Track Info */}
                    <div 
                      onClick={() => {
                        handleStreamChange(st, true);
                        setShowStationsView(false);
                      }}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer group relative z-10"
                    >
                      {/* Left: Cover Artwork + Station Name & Current Track Title */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Cover Artwork Thumbnail */}
                        <div 
                          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border flex-shrink-0 shadow-md transition-all duration-700 ease-out"
                          style={{ borderColor: `${stationColor}90` }}
                        >
                          <img
                            src={displayTrack.coverUrl}
                            alt={displayTrack.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          {isActive && isPlaying && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center transition-all duration-500">
                              <Volume2 className="w-5 h-5 text-white animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Station & Track Details */}
                        <div className="flex flex-col min-w-0 flex-1">
                          {/* Station Name */}
                          <div className="flex items-center gap-2">
                            <span className="font-futuristic text-xs sm:text-sm font-bold uppercase tracking-wider text-white group-hover:text-zinc-200 transition-colors truncate">
                              {st.name}
                            </span>
                          </div>

                          {/* Currently Playing Track */}
                          <div className="flex items-center gap-1.5 mt-1 min-w-0">
                            <Music2 className="w-3.5 h-3.5 flex-shrink-0 transition-colors duration-700 ease-out" style={{ color: stationColor }} />
                            <span className="text-xs font-semibold text-zinc-100 truncate transition-colors duration-500">
                              {displayTrack.title}
                            </span>
                            <span className="text-xs text-zinc-400 truncate">
                              — {displayTrack.artist}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Play/Pause Action Button + 3-Dot Vertical Menu */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 relative z-10">
                        {/* Play/Pause Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isActive) {
                              if (isPlaying) {
                                setIsPlaying(false);
                                if (audioRef.current) audioRef.current.pause();
                              } else {
                                setIsPlaying(true);
                                if (audioRef.current) audioRef.current.play().catch(() => {});
                              }
                            } else {
                              handleStreamChange(st, true);
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition-all duration-700 ease-out cursor-pointer flex items-center justify-center ${
                            isActive
                              ? 'text-white border-transparent'
                              : 'bg-white/10 hover:bg-white/20 border-white/15 text-white hover:scale-105 active:scale-95'
                          }`}
                          style={
                            isActive
                              ? {
                                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                                  borderColor: primaryColor,
                                  boxShadow: isPlaying
                                    ? `0 0 16px ${hexToRgba(primaryColor, 0.65)}, 0 0 24px ${hexToRgba(secondaryColor, 0.45)}`
                                    : `0 0 10px ${hexToRgba(primaryColor, 0.35)}`,
                                }
                              : undefined
                          }
                          title={isActive && isPlaying ? "Mettre en pause" : `Écouter ${st.name}`}
                          aria-label={isActive && isPlaying ? "Mettre en pause" : `Écouter ${st.name}`}
                        >
                          {isActive && isPlaying ? (
                            <Pause className="w-4 h-4 fill-current text-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5 text-white" />
                          )}
                        </button>

                        {/* 3-Dot Vertical Menu (Toggles Description) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedStations((prev) => ({ ...prev, [st.id]: !prev[st.id] }));
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                            isExpanded
                              ? 'bg-white/20 border-white/40 text-white'
                              : 'bg-white/5 hover:bg-white/15 border-white/10 text-zinc-400 hover:text-white'
                          }`}
                          title={isExpanded ? "Masquer la description" : "Afficher la description de la station"}
                          aria-label="Options et description de la station"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Folding Description Panel */}
                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-2 border-t border-white/10 bg-black/60 text-xs font-mono text-zinc-300 leading-relaxed relative z-10">
                        {st.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

          </div>
        </div>
      </div>

      {/* 3. MODAL BACKDROP */}
      {(showEqualizer || showHistoryDrawer || showUserProfileDrawer || showProgrammingDrawer || showChallengesDrawer || showPromotionsDrawer || showEventsDrawer || showContactDrawer || showLikedDrawer || showFavoriteStationsDrawer) && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 transition-all duration-350 ease-out"
          onClick={() => {
            setShowEqualizer(false);
            setShowHistoryDrawer(false);
            setShowUserProfileDrawer(false);
            setShowProgrammingDrawer(false);
            setShowChallengesDrawer(false);
            setShowPromotionsDrawer(false);
            setShowEventsDrawer(false);
            setShowContactDrawer(false);
            setShowLikedDrawer(false);
            setShowFavoriteStationsDrawer(false);
          }}
        />
      )}

      {/* 4. SLIDE-UP DRAWER: TITRES PASSÉS (15 DERNIÈRES MINUTES AVEC RETOUR EN ARRIÈRE DYNAMIQUE ET VRAIE DIFFUSION AUDIO) */}
      <Drawer
        id="history-drawer"
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        title={
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-white" />
            <span className="font-futuristic text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-100 truncate">
              TITRES PASSÉS (15 DERNIÈRES MINUTES) • {activeStream.name}
            </span>
          </div>
        }
        subtitle={
          bufferedLiveSeconds > 10 
            ? `Mémoire tampon direct active (${Math.floor(bufferedLiveSeconds / 60)} min ${bufferedLiveSeconds % 60} s enregistrées) • Lecture différée complète` 
            : "Cliquez sur un titre pour reculer et écouter la musique jouée en direct"
        }
        maxWidthClass="max-w-xl sm:max-w-2xl"
      >
        <div className="flex flex-col gap-2.5">
          {historyTracks.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm font-mono">
              Chargement de l'historique en direct...
            </div>
          ) : (
            historyTracks.map((track, index) => (
              <button
                key={`history-track-${track.id || 'trk'}-${index}`}
                onClick={() => handleSelectPastTrack(track, index)}
                className="w-full text-left p-3.5 rounded-2xl flex items-center justify-between transition-all duration-300 group border cursor-pointer bg-black/40 border-white/5 hover:bg-white/[0.06] hover:border-white/30 hover:shadow-[0_0_22px_rgba(255,255,255,0.08)] relative overflow-hidden"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 group-hover:border-white transition-colors shadow-md">
                    <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <RotateCcw className="w-5 h-5 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <MarqueeText
                      text={track.title}
                      className="text-sm sm:text-base font-bold text-white group-hover:text-zinc-200 transition-colors block"
                    />
                    <MarqueeText
                      text={track.artist}
                      className="text-[11px] sm:text-xs text-zinc-300 font-bold uppercase tracking-wider block mt-0.5 font-mono"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-zinc-300 font-bold flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {track.timeAgo} ({track.playedAt})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end flex-shrink-0 ml-3 gap-1.5">
                  <span className="text-xs font-mono text-zinc-400">
                    {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 group-hover:border-white/40 group-hover:bg-white/20 transition-all flex items-center gap-1.5 shadow-sm">
                    <RotateCcw className="w-3 h-3 text-white" />
                    Écouter (-{track.minutesAgo} min)
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </Drawer>

      {/* 4.b SLIDE-UP DRAWER: GESTION DU PROFIL */}
      <UserProfileDrawer
        isOpen={showUserProfileDrawer}
        onClose={() => setShowUserProfileDrawer(false)}
        connectedAccount={connectedAccount}
        onConnectAccount={handleConnectAccount}
        synapseUser={synapseUser}
        onUpdateSynapseUser={(user) => {
          setSynapseUser(user);
          if (user?.spotifyAccount) {
            setConnectedAccount(user.spotifyAccount);
            saveConnectedAccount(user.spotifyAccount);
          }
        }}
        likedTracksCount={likedTracks.length}
        favoriteStationsCount={favoriteStations.length}
        quality={quality}
        onChangeQuality={(newQuality) => setQuality(newQuality)}
        accentColor={accentColor}
        onOpenLikedTracks={() => setShowLikedDrawer(true)}
        onOpenFavoriteStations={() => setShowFavoriteStationsDrawer(true)}
        onSyncWithSpotify={handleManualSyncSpotify}
        onOpenConnectModal={() => {
          setShowUserProfileDrawer(false);
          setShowConnectModal(true);
        }}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
      />

      {/* 4.c OVERLAY PLEIN ÉCRAN (80% OPACITÉ) : NAVIGATION DU MENU SANDWICH */}
      <FullscreenNavMenu
        isOpen={showNavOverlayMenu}
        onClose={() => setShowNavOverlayMenu(false)}
        onSelectMenuItem={handleSelectNavMenuItem}
        likedTracksCount={likedTracks.length}
        isAdmin={synapseUser?.role === 'admin' || synapseUser?.role === 'super-admin' || isSuperAdmin(synapseUser)}
      />

      {/* 4.d COMPLEMENTARY DRAWERS ACCESSIBLE FROM SANDWICH MENU */}
      <ProgrammingDrawer
        isOpen={showProgrammingDrawer}
        onClose={() => setShowProgrammingDrawer(false)}
        accentColor={accentColor}
        activeStationId={activeStream.id}
        stations={activeStations}
        onSelectStation={(stId) => {
          const matched = activeStations.find(s => s.id === stId);
          if (matched) {
            handleStreamChange(matched, true);
          }
        }}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
      />

      <ChallengesDrawer
        isOpen={showChallengesDrawer}
        onClose={() => setShowChallengesDrawer(false)}
        accentColor={accentColor}
        activeStationId={activeStream.id}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
      />

      <PromotionsDrawer
        isOpen={showPromotionsDrawer}
        onClose={() => setShowPromotionsDrawer(false)}
        accentColor={accentColor}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
      />

      <EventsDrawer
        isOpen={showEventsDrawer}
        onClose={() => setShowEventsDrawer(false)}
        accentColor={accentColor}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
      />

      <ContactDrawer
        isOpen={showContactDrawer}
        onClose={() => setShowContactDrawer(false)}
        accentColor={accentColor}
      />

      <AdminPanelDrawer
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        currentStationId={activeStream.id}
        currentUser={synapseUser}
        onRefreshAppState={handleRefreshAppState}
      />

      {/* 5. FULL-SCREEN SLIDE-UP EQUALIZER & AUDIO SETTINGS DRAWER */}
      <Drawer
        id="equalizer-drawer"
        isOpen={showEqualizer}
        onClose={() => setShowEqualizer(false)}
        isFullScreen={true}
        title={
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-white flex-shrink-0" />
            <span className="text-sm sm:text-base md:text-lg font-mono font-bold uppercase tracking-wider text-white truncate">
              Studio & Traitement Audio Synapse
            </span>
          </div>
        }
        subtitle="Égaliseur graphique 10 bandes, résolution master & traitement acoustique"
        maxWidthClass="max-w-4xl"
      >
        <div className="flex-1 flex flex-col gap-5 justify-between">
          {/* 10-Band Graphic Equalizer Component (Expanded to Full Height) */}
          <Equalizer
            activePreset={activePreset}
            onPresetChange={handlePresetChange}
            bands={eqBands}
            onBandChange={handleBandChange}
            onResetFlat={handleResetFlat}
            isPlaying={isPlaying}
            accentColor={accentColor}
            stationName={activeStream.name}
          />
        </div>
      </Drawer>

      {/* 6. AIRPLAY & CAST DEVICES SELECTOR POPUP MODAL */}
      <CastModal
        isOpen={isCastModalOpen}
        onClose={() => setIsCastModalOpen(false)}
        accentColor={accentColor}
        audioElement={audioRef.current}
      />

      {/* 7. LIKED TRACKS FAVORITES DRAWER */}
      <LikedTracksDrawer
        isOpen={showLikedDrawer}
        onClose={() => setShowLikedDrawer(false)}
        likedTracks={likedTracks}
        onRemoveTrack={handleRemoveLikedTrack}
        onUpdateTrackLevel={handleUpdateTrackLevel}
        connectedAccount={connectedAccount}
        onSyncWithSpotify={handleManualSyncSpotify}
        onOpenConnectModal={() => {
          setShowLikedDrawer(false);
          setShowConnectModal(true);
        }}
        accentColor={accentColor}
      />

      {/* 8. CONNECT MUSIC ACCOUNT MODAL */}
      <AccountConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        currentAccount={connectedAccount}
        onConnectAccount={handleConnectAccount}
      />

      {/* 9. FAVORITE STATIONS MANAGEMENT DRAWER */}
      <FavoriteStationsDrawer
        isOpen={showFavoriteStationsDrawer}
        onClose={() => setShowFavoriteStationsDrawer(false)}
        favoriteStations={favoriteStations}
        onToggleFavorite={handleToggleFavoriteStation}
        onToggleNotification={handleToggleStationNotification}
        activeStream={activeStream}
        isPlaying={isPlaying}
        onSelectStation={(stream) => {
          handleStreamChange(stream, true);
          setShowFavoriteStationsDrawer(false);
        }}
        availableStations={activeStations}
      />

    </div>
  );
}
