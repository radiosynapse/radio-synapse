/**
 * Connect SDK - Universal Open-Source Multi-Screen / Smart TV Casting Framework
 * Connects web applications to Smart TVs (LG webOS, Samsung Tizen, DLNA / UPnP, Apple TV, Chromecast, Roku)
 * Provides uninterrupted continuous live audio streaming with instant live metadata synchronisation.
 */
import { getOptimizedHighQualityAudioUrl } from './audioStreamPlayer';

export interface ConnectSDKMetaData {
  title: string;
  artist: string;
  albumName?: string;
  thumbnail?: string;
  mimeType?: string;
}

export interface ConnectDevice {
  id: string;
  friendlyName: string;
  modelName?: string;
  serviceName: 'webos' | 'samsung' | 'dlna' | 'airplay' | 'chromecast' | 'remote_playback';
  connected: boolean;
}

export type ConnectSDKStateListener = (state: {
  connected: boolean;
  activeDevice: ConnectDevice | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
}) => void;

class ConnectSDKEngine {
  private listeners: Set<ConnectSDKStateListener> = new Set();
  private activeDevice: ConnectDevice | null = null;
  private isPlaying = false;
  private volume = 1.0;
  private isMuted = false;

  // Track active stream and metadata
  private currentStreamUrl = '';
  private currentMetaData: ConnectSDKMetaData = {
    title: 'Radio Synapse',
    artist: 'En direct',
    albumName: 'Radio Synapse Live',
    thumbnail: '',
    mimeType: 'audio/mpeg'
  };

  // Google Cast integration reference
  private castContext: any = null;
  private castSession: any = null;
  private isCastSdkLoaded = false;

  // Bound HTMLAudioElement
  private registeredAudioElement: HTMLAudioElement | null = null;

  constructor() {
    this.initSystemMediaSession();
  }

  /**
   * Initialize Global MediaSession API for DLNA / Bluetooth / AirPlay and TV Receivers
   */
  private initSystemMediaSession() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('stop', () => this.stop());
      } catch (e) {
        // MediaSession actions unsupported on some browsers
      }
    }
  }

  /**
   * Subscribe to Connect SDK state changes
   */
  public addListener(listener: ConnectSDKStateListener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  public getState() {
    return {
      connected: !!this.activeDevice?.connected,
      activeDevice: this.activeDevice,
      isPlaying: this.isPlaying,
      volume: this.volume,
      isMuted: this.isMuted
    };
  }

  /**
   * Register active HTML Audio Element with Connect SDK
   */
  public registerAudioElement(audio: HTMLAudioElement) {
    if (!audio) return;
    this.registeredAudioElement = audio;

    // 1. Apple AirPlay connection listener
    if ('webkitShowPlaybackTargetPicker' in HTMLAudioElement.prototype) {
      const handleAirPlayTarget = () => {
        this.activeDevice = {
          id: 'apple-airplay-tv',
          friendlyName: 'Apple AirPlay / TV',
          serviceName: 'airplay',
          connected: true
        };
        this.isPlaying = !audio.paused;
        this.notify();
      };
      audio.addEventListener('webkitcurrentplaybacktargetchanged' as any, handleAirPlayTarget);
    }

    // 2. Open W3C Remote Playback API (Smart TVs / DLNA)
    if ('remote' in audio && (audio as any).remote) {
      const remote = (audio as any).remote;
      remote.addEventListener?.('connect', () => {
        this.activeDevice = {
          id: 'smart-tv-remote',
          friendlyName: 'Smart TV Sans Fil (DLNA / Miracast)',
          serviceName: 'remote_playback',
          connected: true
        };
        this.isPlaying = !audio.paused;
        this.notify();
      });

      remote.addEventListener?.('disconnect', () => {
        if (this.activeDevice?.serviceName === 'remote_playback') {
          this.activeDevice = null;
          this.notify();
        }
      });
    }
  }

  /**
   * Loads Google Cast CAF sender component if available on the network
   */
  public initCastProvider() {
    if (typeof window === 'undefined' || this.isCastSdkLoaded) return;

    (window as any).__initRadioSynapseCast = (isAvailable: boolean) => {
      if (isAvailable) {
        this.setupCastService();
      }
    };

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        this.setupCastService();
      }
    };

    if ((window as any).cast?.framework) {
      this.setupCastService();
    }
  }

  private getCastAppId(): string {
    const OFFICIAL_CUSTOM_ID = '0E724BF5'; // Radio Synapse Custom Receiver App ID

    // Priority 1: Environment secret VITE_GOOGLE_CAST_APP_ID
    const envAppId = (import.meta as any).env?.VITE_GOOGLE_CAST_APP_ID;
    if (envAppId && typeof envAppId === 'string' && envAppId.trim()) {
      return envAppId.trim();
    }

    // Priority 2: User explicitly saved custom ID or mode in localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('google_cast_app_id');
      if (stored && stored.trim()) {
        return stored.trim();
      }
    }

    // Priority 3: Custom Receiver Radio Synapse (0E724BF5)
    return OFFICIAL_CUSTOM_ID;
  }

  public setCastAppId(appId: string) {
    if (typeof window !== 'undefined') {
      if (appId && appId.trim()) {
        localStorage.setItem('google_cast_app_id', appId.trim());
      } else {
        localStorage.removeItem('google_cast_app_id');
      }
    }

    // Update active CastContext receiver options if Cast SDK is ready
    if (this.castContext && (window as any).chrome?.cast) {
      try {
        this.castContext.setOptions({
          receiverApplicationId: this.getCastAppId(),
          autoJoinPolicy: (window as any).chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });
      } catch (e) {
        console.warn('Cast options update:', e);
      }
    }
  }

  private setupCastService() {
    try {
      const cast = (window as any).cast;
      const chrome = (window as any).chrome;
      if (!cast?.framework || !chrome?.cast) return;

      this.isCastSdkLoaded = true;
      this.castContext = cast.framework.CastContext.getInstance();
      this.castContext.setOptions({
        receiverApplicationId: this.getCastAppId(),
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });

      this.castContext.addEventListener(
        cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (event: any) => {
          const sessionState = event.sessionState;
          const SessionStates = cast.framework.SessionState;

          if (sessionState === SessionStates.SESSION_STARTED || sessionState === SessionStates.SESSION_RESUMED) {
            this.castSession = this.castContext.getCurrentSession();
            const deviceName = this.castSession?.getCastDevice()?.friendlyName || 'Téléviseur Connecté';
            this.activeDevice = {
              id: this.castSession?.getSessionId() || 'cast-device',
              friendlyName: deviceName,
              serviceName: 'chromecast',
              connected: true
            };
            this.notify();
          } else if (sessionState === SessionStates.SESSION_ENDED || sessionState === SessionStates.SESSION_START_FAILED) {
            this.castSession = null;
            if (this.activeDevice?.serviceName === 'chromecast') {
              this.activeDevice = null;
              this.notify();
            }
          }
        }
      );

      const existingSession = this.castContext.getCurrentSession();
      if (existingSession) {
        this.castSession = existingSession;
        this.activeDevice = {
          id: existingSession.getSessionId() || 'cast-device',
          friendlyName: existingSession.getCastDevice()?.friendlyName || 'Téléviseur Connecté',
          serviceName: 'chromecast',
          connected: true
        };
        this.notify();
      }
    } catch (e) {
      console.warn('Connect SDK Cast service initialization:', e);
    }
  }

  /**
   * Discover and Prompt Connect SDK Target Devices (Smart TVs / DLNA / AirPlay / Cast)
   */
  public async promptDevicePicker(): Promise<boolean> {
    // 1. Google Cast / TV prompt with official Custom Receiver App ID (0E724BF5)
    if (!this.isCastSdkLoaded || !this.castContext) {
      this.initCastProvider();
      if ((window as any).cast?.framework) {
        this.setupCastService();
      }
    }

    if (this.castContext) {
      try {
        const appIdToUse = this.getCastAppId();
        console.log('Initiating Google Cast session with App ID:', appIdToUse);
        
        // Re-apply latest options right before opening device picker
        this.castContext.setOptions({
          receiverApplicationId: appIdToUse,
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED || 0
        });

        await this.castContext.requestSession();
        this.castSession = this.castContext.getCurrentSession();
        if (this.activeDevice?.connected) {
          return true;
        }
      } catch (err: any) {
        console.warn('Connect SDK Cast requestSession failed:', err);
      }
    }

    // 2. Open standard W3C Remote Playback (Smart TV / DLNA)
    if (this.registeredAudioElement && 'remote' in this.registeredAudioElement && (this.registeredAudioElement as any).remote?.prompt) {
      try {
        await (this.registeredAudioElement as any).remote.prompt();
        return true;
      } catch (err) {
        console.warn('Connect SDK Remote Playback prompt:', err);
      }
    }

    // 3. Apple AirPlay device picker
    if (this.registeredAudioElement && 'webkitShowPlaybackTargetPicker' in this.registeredAudioElement) {
      try {
        (this.registeredAudioElement as any).webkitShowPlaybackTargetPicker();
        return true;
      } catch (err) {
        console.warn('Connect SDK AirPlay picker:', err);
      }
    }

    return false;
  }

  /**
   * Connect SDK - MediaPlayer.playMedia
   * Starts playback on the remote TV or audio receiver
   */
  public playMedia(url: string, meta: ConnectSDKMetaData) {
    const optimizedUrl = getOptimizedHighQualityAudioUrl(url);
    this.currentStreamUrl = optimizedUrl;
    this.currentMetaData = { ...this.currentMetaData, ...meta };
    this.isPlaying = true;

    // 1. Update OS & Browser MediaSession
    this.syncSystemMediaSession(meta);

    // 2. Play on Cast / Smart TV if active
    if (this.castSession && this.activeDevice?.serviceName === 'chromecast') {
      try {
        const chrome = (window as any).chrome;
        if (chrome?.cast?.media) {
          const mediaSession = this.castSession.getMediaSession();
          if (mediaSession) {
            // Already streaming live: just update metadata without cutting audio
            this.updateMetaData(meta);
            return;
          }

          const mediaInfo = new chrome.cast.media.MediaInfo(optimizedUrl, meta.mimeType || 'audio/mpeg');
          mediaInfo.contentUrl = optimizedUrl;
          mediaInfo.contentId = optimizedUrl;
          mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;

          const metadata = new chrome.cast.media.MusicTrackMediaMetadata();
          metadata.title = meta.title || 'Radio Synapse';
          metadata.artist = meta.artist || 'En direct';
          metadata.albumName = meta.albumName || 'Radio Synapse Live';
          metadata.songName = meta.title || 'Radio Synapse';
          if (meta.thumbnail) {
            if (typeof chrome.cast.Image === 'function') {
              metadata.images = [new chrome.cast.Image(meta.thumbnail)];
            } else {
              metadata.images = [{ url: meta.thumbnail }];
            }
          }
          mediaInfo.metadata = metadata;

          const request = new chrome.cast.media.LoadRequest(mediaInfo);
          request.autoplay = true;
          this.castSession.loadMedia(request).catch(() => {});
        }
      } catch (err) {
        console.warn('Connect SDK Cast playMedia:', err);
      }
    }

    this.notify();
  }

  /**
   * Connect SDK - MediaPlayer.updateMetaData
   * Updates song title, artist and album cover on the TV screen IN REAL TIME
   * WITHOUT RELOADING OR INTERRUPTING THE AUDIO STREAM.
   */
  public updateMetaData(meta: Partial<ConnectSDKMetaData>) {
    this.currentMetaData = {
      ...this.currentMetaData,
      ...meta
    };

    // 1. Update MediaSession on all connected TVs, receivers and lockscreens
    this.syncSystemMediaSession(this.currentMetaData);

    // 2. Update Chromecast / TV screen metadata seamlessly
    if (this.castSession && this.activeDevice?.serviceName === 'chromecast') {
      try {
        const chrome = (window as any).chrome;
        if (chrome?.cast?.media) {
          const mediaSession = this.castSession.getMediaSession();
          if (mediaSession) {
            const metadata = new chrome.cast.media.MusicTrackMediaMetadata();
            metadata.title = this.currentMetaData.title || 'Radio Synapse';
            metadata.artist = this.currentMetaData.artist || 'En direct';
            metadata.albumName = this.currentMetaData.albumName || 'Radio Synapse Live';
            metadata.songName = this.currentMetaData.title || 'Radio Synapse';
            if (this.currentMetaData.thumbnail) {
              if (typeof chrome.cast.Image === 'function') {
                metadata.images = [new chrome.cast.Image(this.currentMetaData.thumbnail)];
              } else {
                metadata.images = [{ url: this.currentMetaData.thumbnail }];
              }
            }

            // Apply to active media metadata
            if (mediaSession.media) {
              mediaSession.media.metadata = metadata;
            }

            // Dispatch live QUEUE_UPDATE protocol to notify TV UI directly without stream reset
            const queuePayload = {
              type: 'QUEUE_UPDATE',
              requestId: Math.floor(Math.random() * 1000000),
              mediaSessionId: mediaSession.mediaSessionId,
              items: [
                {
                  media: {
                    contentId: this.currentStreamUrl,
                    streamType: 'LIVE',
                    contentType: 'audio/mpeg',
                    metadata: {
                      type: 3,
                      metadataType: 3,
                      title: this.currentMetaData.title,
                      artist: this.currentMetaData.artist,
                      songName: this.currentMetaData.title,
                      albumName: this.currentMetaData.albumName || 'Radio Synapse Live',
                      images: this.currentMetaData.thumbnail ? [{ url: this.currentMetaData.thumbnail }] : []
                    }
                  }
                }
              ]
            };

            this.castSession.sendMessage(
              'urn:x-cast:com.google.cast.media',
              queuePayload,
              () => {},
              () => {}
            );

            // Send to Radio Synapse Custom Web Receiver namespace
            this.castSession.sendMessage(
              'urn:x-cast:fr.radiosynapse.cast',
              {
                type: 'METADATA_UPDATE',
                title: this.currentMetaData.title,
                artist: this.currentMetaData.artist,
                coverUrl: this.currentMetaData.thumbnail,
                stationName: this.currentMetaData.albumName
              },
              () => {},
              () => {}
            );
          }
        }
      } catch (err) {
        console.warn('Connect SDK live metadata update dispatch:', err);
      }
    }
  }

  private syncSystemMediaSession(meta: ConnectSDKMetaData) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: meta.title || 'Radio Synapse',
          artist: meta.artist || 'En direct',
          album: meta.albumName || 'Radio Synapse Live',
          artwork: meta.thumbnail
            ? [
                { src: meta.thumbnail, sizes: '96x96', type: 'image/jpeg' },
                { src: meta.thumbnail, sizes: '256x256', type: 'image/jpeg' },
                { src: meta.thumbnail, sizes: '512x512', type: 'image/jpeg' }
              ]
            : []
        });
      } catch (e) {
        // MediaMetadata error catch
      }
    }
  }

  public play() {
    this.isPlaying = true;
    if (this.castSession) {
      try {
        this.castSession.getMediaSession()?.play(null, () => {}, () => {});
      } catch {}
    }
    this.notify();
  }

  public pause() {
    this.isPlaying = false;
    if (this.castSession) {
      try {
        this.castSession.getMediaSession()?.pause(null, () => {}, () => {});
      } catch {}
    }
    this.notify();
  }

  public stop() {
    this.isPlaying = false;
    this.notify();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.castSession) {
      try {
        this.castSession.setVolume(this.volume, () => {}, () => {});
      } catch {}
    }
    this.notify();
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.castSession) {
      try {
        this.castSession.setMute(muted, () => {}, () => {});
      } catch {}
    }
    this.notify();
  }

  public disconnect() {
    if (this.castContext) {
      try {
        this.castContext.endCurrentSession(true);
      } catch {}
    }
    this.activeDevice = null;
    this.isPlaying = false;
    this.notify();
  }
}

export const ConnectSDK = new ConnectSDKEngine();
