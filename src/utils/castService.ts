/**
 * Direct Pure Native Google Cast Web Sender SDK Integration
 * Interacts directly with Google Cast Framework (window.cast.framework)
 */
import { getOptimizedHighQualityAudioUrl } from './audioStreamPlayer';

export interface CastSessionState {
  connected: boolean;
  deviceName: string | null;
  castType: 'chromecast' | null;
}

type StateChangeListener = (state: CastSessionState) => void;

class PureGoogleCastService {
  private listeners: Set<StateChangeListener> = new Set();
  private stationChangeListeners: Set<(stationId: string, streamUrl?: string) => void> = new Set();
  private readonly CUSTOM_CHANNEL = 'urn:x-cast:fr.radiosynapse.cast';
  private currentSessionState: CastSessionState = {
    connected: false,
    deviceName: null,
    castType: null,
  };

  private castContext: any = null;
  private castSession: any = null;
  private isFrameworkConfigured: boolean = false;

  constructor() {
    this.initGoogleCastSDK();
  }

  public getCastAppId(): string {
    const OFFICIAL_CUSTOM_ID = '0E724BF5';
    const envAppId = (import.meta as any).env?.VITE_GOOGLE_CAST_APP_ID;
    if (envAppId && typeof envAppId === 'string' && envAppId.trim()) {
      return envAppId.trim();
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('google_cast_app_id');
      if (stored && stored.trim()) {
        return stored.trim();
      }
    }
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
    if (this.castContext) {
      try {
        const targetId = this.getCastAppId();
        this.castContext.setOptions({
          receiverApplicationId: targetId,
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED || 0
        });
      } catch (e) {
        console.warn('Set Cast options error:', e);
      }
    }
  }

  public initGoogleCastSDK() {
    if (typeof window === 'undefined') return;

    const setupFramework = () => {
      if (this.isFrameworkConfigured) return;
      try {
        const cast = (window as any).cast;
        const chrome = (window as any).chrome;
        if (!cast?.framework || !chrome?.cast) return;

        this.castContext = cast.framework.CastContext.getInstance();
        this.isFrameworkConfigured = true;
        
        const appId = this.getCastAppId();
        console.log('[Native Google Cast SDK] Initializing CastContext with App ID:', appId);

        this.castContext.setOptions({
          receiverApplicationId: appId,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED
        });

        // Listen directly for session state changes
        this.castContext.addEventListener(
          cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (event: any) => {
            const sessionState = event.sessionState;
            const SessionStates = cast.framework.SessionState;

            if (sessionState === SessionStates.SESSION_STARTED || sessionState === SessionStates.SESSION_RESUMED) {
              this.castSession = this.castContext.getCurrentSession();
              this.setupSessionMessageListener(this.castSession);
              const deviceName = this.castSession?.getCastDevice()?.friendlyName || 'Chromecast / Freebox';
              this.currentSessionState = {
                connected: true,
                deviceName: deviceName,
                castType: 'chromecast'
              };
              this.notifyListeners();
            } else if (sessionState === SessionStates.SESSION_ENDED || sessionState === SessionStates.SESSION_START_FAILED) {
              this.castSession = null;
              this.currentSessionState = {
                connected: false,
                deviceName: null,
                castType: null
              };
              this.notifyListeners();
            }
          }
        );

        const activeSession = this.castContext.getCurrentSession();
        if (activeSession) {
          this.castSession = activeSession;
          this.setupSessionMessageListener(this.castSession);
          this.currentSessionState = {
            connected: true,
            deviceName: activeSession.getCastDevice()?.friendlyName || 'Chromecast / Freebox',
            castType: 'chromecast'
          };
          this.notifyListeners();
        }
      } catch (e) {
        console.warn('[Native Google Cast SDK] Setup error:', e);
      }
    };

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        setupFramework();
      }
    };

    if ((window as any).cast?.framework) {
      setupFramework();
    }
  }

  public async promptCast(_audioElement?: HTMLAudioElement | null): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!this.castContext) {
      this.initGoogleCastSDK();
    }

    if (this.castContext) {
      try {
        const appId = this.getCastAppId();
        console.log('[Native Google Cast SDK] Requesting session for App ID:', appId);

        await this.castContext.requestSession();
        this.castSession = this.castContext.getCurrentSession();
        if (this.castSession) {
          this.setupSessionMessageListener(this.castSession);
          const deviceName = this.castSession.getCastDevice()?.friendlyName || 'Chromecast / Freebox';
          this.currentSessionState = {
            connected: true,
            deviceName: deviceName,
            castType: 'chromecast'
          };
          this.notifyListeners();
          return true;
        }
      } catch (err: any) {
        console.warn('[Native Google Cast SDK] requestSession failed:', err);
      }
    }
    return false;
  }

  public playOnCast(
    url: string,
    title: string,
    artist: string,
    coverUrl: string,
    stationName?: string,
    stationId?: string,
    stations?: Array<{ id: string; name: string; streamUrl?: string; color?: string; stationNumber?: string }>,
    primaryColor?: string,
    secondaryColor?: string,
    duration?: number,
    playedAt?: number,
    elapsed?: number,
    currentTime?: number
  ) {
    if (!this.castSession) return;

    try {
      const chrome = (window as any).chrome;
      if (!chrome?.cast?.media) return;

      const cleanStation = stationName || 'Radio Synapse';
      const optimizedUrl = getOptimizedHighQualityAudioUrl(url);

      const mediaInfo = new chrome.cast.media.MediaInfo(optimizedUrl, 'audio/mpeg');
      mediaInfo.contentUrl = optimizedUrl;
      mediaInfo.contentId = optimizedUrl;
      mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;

      const metadata = new chrome.cast.media.MusicTrackMediaMetadata();
      metadata.title = title || 'Radio Synapse';
      metadata.artist = artist || 'En direct';
      metadata.albumName = cleanStation;
      metadata.songName = title || 'Radio Synapse';

      if (coverUrl) {
        if (typeof chrome.cast.Image === 'function') {
          metadata.images = [new chrome.cast.Image(coverUrl)];
        } else {
          metadata.images = [{ url: coverUrl }];
        }
      }
      mediaInfo.metadata = metadata;
      mediaInfo.customData = {
        duration: duration || 240,
        playedAt: playedAt || 0,
        elapsed: elapsed || 0,
        currentTime: currentTime || 0
      };

      const request = new chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;

      this.castSession.loadMedia(request).then(
        () => console.log('[Native Google Cast SDK] Media loaded successfully on TV'),
        (err: any) => console.warn('[Native Google Cast SDK] Error loading media:', err)
      );

      const optimizedStations = stations?.map(s => ({
        ...s,
        streamUrl: getOptimizedHighQualityAudioUrl(s.streamUrl || '')
      }));

      // Direct custom message payload to receiver for guaranteed stream URL + UI + timeline synchronization
      this.castSession.sendMessage(
        'urn:x-cast:fr.radiosynapse.cast',
        {
          type: 'LOAD_STREAM',
          streamUrl: optimizedUrl,
          title: title || 'Radio Synapse',
          artist: artist || 'En direct',
          coverUrl: coverUrl || '',
          stationName: cleanStation,
          stationId: stationId || '',
          stations: optimizedStations || [],
          primaryColor: primaryColor || '',
          secondaryColor: secondaryColor || '',
          duration: duration || 240,
          playedAt: playedAt || 0,
          elapsed: elapsed || 0,
          currentTime: currentTime || 0
        },
        () => {},
        () => {}
      );
    } catch (e) {
      console.warn('[Native Google Cast SDK] playOnCast error:', e);
    }
  }

  public updateMetadata(
    title: string,
    artist: string,
    coverUrl: string,
    streamUrl?: string,
    stationName?: string,
    stationId?: string,
    primaryColor?: string,
    secondaryColor?: string,
    duration?: number,
    playedAt?: number,
    elapsed?: number,
    currentTime?: number
  ) {
    if (!this.castSession) return;

    try {
      const cleanStation = stationName || 'Radio Synapse';
      const optimizedUrl = streamUrl ? getOptimizedHighQualityAudioUrl(streamUrl) : '';

      // Send custom message payload directly to TV Receiver
      this.castSession.sendMessage(
        this.CUSTOM_CHANNEL,
        {
          type: 'METADATA_UPDATE',
          title: title || 'Radio Synapse',
          artist: artist || 'En direct',
          coverUrl: coverUrl || '',
          stationName: cleanStation,
          stationId: stationId || '',
          streamUrl: optimizedUrl,
          primaryColor: primaryColor || '',
          secondaryColor: secondaryColor || '',
          duration: duration || 240,
          playedAt: playedAt || 0,
          elapsed: elapsed || 0,
          currentTime: currentTime || 0
        },
        () => console.log('[CastService] METADATA_UPDATE sent successfully to receiver'),
        (err: any) => console.warn('[CastService] METADATA_UPDATE error:', err)
      );

      // Also update standard Cast media metadata if standard mediaSession exists
      try {
        const mediaSession = this.castSession.getMediaSession();
        const chrome = (window as any).chrome;
        if (mediaSession && chrome?.cast?.media) {
          const metadata = new chrome.cast.media.MusicTrackMediaMetadata();
          metadata.title = title || 'Radio Synapse';
          metadata.artist = artist || 'En direct';
          metadata.albumName = cleanStation;
          metadata.songName = title || 'Radio Synapse';
          if (coverUrl) {
            if (typeof chrome.cast.Image === 'function') {
              metadata.images = [new chrome.cast.Image(coverUrl)];
            } else {
              metadata.images = [{ url: coverUrl }];
            }
          }
          mediaSession.media.metadata = metadata;
        }
      } catch (mediaErr) {
        // Safe fallback
      }
    } catch (e) {
      console.warn('[Native Google Cast SDK] updateMetadata error:', e);
    }
  }

  public sendHarmony(primaryColor: string, secondaryColor: string) {
    if (!this.castSession || !primaryColor || !secondaryColor) return;
    try {
      this.castSession.sendMessage(
        'urn:x-cast:fr.radiosynapse.cast',
        {
          type: 'HARMONY_UPDATE',
          primaryColor,
          secondaryColor
        },
        () => {},
        () => {}
      );
    } catch (e) {
      console.warn('[CastService] sendHarmony error:', e);
    }
  }

  public sendTimeSync(currentTime: number, duration?: number) {
    if (!this.castSession) return;
    try {
      this.castSession.sendMessage(
        this.CUSTOM_CHANNEL,
        {
          type: 'TIME_SYNC',
          currentTime: Math.max(0, Math.round(currentTime)),
          duration: duration && duration > 0 ? Math.round(duration) : 240
        },
        () => {},
        () => {}
      );
    } catch (e) {
      // Non-critical background sync
    }
  }


  public setPlayStateOnCast(play: boolean) {
    if (!this.castSession) return;
    try {
      const mediaSession = this.castSession.getMediaSession();
      if (mediaSession) {
        if (play) mediaSession.play(null, () => {}, () => {});
        else mediaSession.pause(null, () => {}, () => {});
      }
    } catch {}

    try {
      this.castSession.sendMessage(
        'urn:x-cast:fr.radiosynapse.cast',
        {
          type: 'PLAY_STATE',
          isPlaying: play
        },
        () => {},
        () => {}
      );
    } catch (e) {
      console.warn('[CastService] send PLAY_STATE error:', e);
    }
  }

  public setVolumeOnCast(volume: number) {
    if (!this.castSession) return;
    try {
      this.castSession.setVolume(volume, () => {}, () => {});
    } catch {}
  }

  public setMuteOnCast(isMuted: boolean) {
    if (!this.castSession) return;
    try {
      this.castSession.setMute(isMuted, () => {}, () => {});
    } catch {}
  }

  public syncStations(stations: Array<{ id: string; name: string; streamUrl?: string; color?: string; stationNumber?: string }>) {
    if (!this.castSession) return;
    try {
      const optimizedStations = stations?.map(s => ({
        ...s,
        streamUrl: getOptimizedHighQualityAudioUrl(s.streamUrl || '')
      }));

      this.castSession.sendMessage(
        this.CUSTOM_CHANNEL,
        {
          type: 'SYNC_STATIONS',
          stations: optimizedStations
        },
        () => {},
        () => {}
      );
    } catch (e) {
      console.warn('[CastService] syncStations error:', e);
    }
  }

  public disconnect() {
    if (this.castContext) {
      try {
        this.castContext.endCurrentSession(true);
      } catch {}
    }
    this.castSession = null;
    this.currentSessionState = {
      connected: false,
      deviceName: null,
      castType: null
    };
    this.notifyListeners();
  }

  private setupSessionMessageListener(session: any) {
    if (!session) return;
    try {
      session.addMessageListener(
        this.CUSTOM_CHANNEL,
        (_namespace: string, message: any) => {
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            console.log('[CastService] Received custom message from TV receiver:', data);
            if (data && (data.type === 'STATION_CHANGED' || data.type === 'PLAY_STATION' || data.type === 'RECEIVER_STATUS')) {
              const stationId = data.stationId || data.stationName || '';
              if (stationId) {
                this.notifyStationChange(stationId, data.streamUrl);
              }
            }
          } catch (err) {
            console.warn('[CastService] Parse incoming message error:', err);
          }
        }
      );
    } catch (e) {
      console.warn('[CastService] addMessageListener error:', e);
    }
  }

  public addStationChangeListener(listener: (stationId: string, streamUrl?: string) => void): () => void {
    this.stationChangeListeners.add(listener);
    return () => {
      this.stationChangeListeners.delete(listener);
    };
  }

  private notifyStationChange(stationId: string, streamUrl?: string) {
    this.stationChangeListeners.forEach((listener) => {
      try {
        listener(stationId, streamUrl);
      } catch (err) {
        console.error('[CastService] Error in station change listener:', err);
      }
    });
  }

  public addListener(listener: StateChangeListener) {
    this.listeners.add(listener);
    listener({ ...this.currentSessionState });
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const state = { ...this.currentSessionState };
    this.listeners.forEach((listener) => listener(state));
  }

  public registerAudioElement(_audio: HTMLAudioElement) {}
  public loadGoogleCastSDK() {
    this.initGoogleCastSDK();
  }
}

export const CastService = new PureGoogleCastService();
