/**
 * In-Browser Web DJ & Live Microphone Broadcast Engine for Radio Synapse
 * Custom radio console engine featuring:
 * - Real-time Web Audio API voice processing (Low-cut 80Hz filter, Broadcast Compressor)
 * - Hardware Stereo Peak/RMS VU-Meter with dBFS scale & clipping detection
 * - Push-to-Talk (PTT) & Lock On-Air modes
 * - Sidetone headphone monitor with independent volume
 * - Live intervention recorder for instant stream injection via Streaming API
 * - Auto-ducking support for background music beds
 */

export type BroadcastState = 'idle' | 'requesting_permission' | 'ready' | 'connecting' | 'on_air' | 'cue' | 'error';
export type BroadcastMode = 'on_air' | 'cue';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

import { convertBlobToWav } from './audioWavEncoder';

export interface VuMeterReading {
  rms: number; // 0 to 1
  peak: number; // 0 to 1
  db: number; // -60 to 0 dBFS
  isClipping: boolean;
}

export interface StreamStats {
  bytesSent: number;
  packetsSent: number;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  handshakeOk: boolean;
  bitrateKbps: number;
  lastHeartbeat: number;
  lastError: string;
  serverUrl: string;
}

export interface StreamerConfig {
  wsUrl: string;
  mount: string;
  username: string;
  password?: string;
}

const DJ_CREDENTIALS_STORAGE_KEY = 'synapse_dj_streamer_credentials_v1';

class LiveBroadcastEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private lowCutFilter: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private streamDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  // MediaRecorder & Live WebSocket Streaming
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private lastRecordedIntervention: Blob | null = null;
  private socket: WebSocket | null = null;
  private webSocket: WebSocket | null = null;
  private heartbeatInterval: any = null;
  private statsInterval: any = null;
  private lastPacketSentTime: number = 0;
  private bytesSentPeriod: number = 0;
  private isHandshakeReady: boolean = false;

  // Configuration & State
  private state: BroadcastState = 'idle';
  private mode: BroadcastMode = 'cue';
  private errorMessage: string = '';
  private micGain: number = 1.0;
  private monitorEnabled: boolean = true;
  private monitorVolume: number = 0.65;
  private lowCutEnabled: boolean = true;
  private compressorEnabled: boolean = true;
  private selectedDeviceId: string = '';

  private streamerConfig: StreamerConfig = {
    wsUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/',
    mount: '/',
    username: 'theocourant',
    password: 'SynapseDj2026!',
  };

  private streamStats: StreamStats = {
    bytesSent: 0,
    packetsSent: 0,
    connectionState: 'disconnected',
    handshakeOk: false,
    bitrateKbps: 0,
    lastHeartbeat: 0,
    lastError: '',
    serverUrl: 'wss://cast.radiosynapse.fr/webdj/pop-variete/',
  };

  private onAirStartTime: number = 0;
  private onAirTimerInterval: any = null;
  private onAirSeconds: number = 0;

  // Reconnection management to prevent infinite loop storms
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS: number = 3;

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Listeners
  private vuListeners: Array<(reading: VuMeterReading) => void> = [];
  private stateListeners: Array<(state: BroadcastState, error?: string) => void> = [];
  private timerListeners: Array<(seconds: number) => void> = [];
  private interventionListeners: Array<(blob: Blob) => void> = [];
  private statsListeners: Array<(stats: StreamStats) => void> = [];

  constructor() {
    this.loadSavedCredentials();
  }

  private loadSavedCredentials(): void {
    try {
      const saved = localStorage.getItem(DJ_CREDENTIALS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.streamerConfig = {
          ...this.streamerConfig,
          ...parsed,
        };
        this.streamStats.serverUrl = this.streamerConfig.wsUrl;
      }
    } catch {}
  }

  public saveCredentials(config: Partial<StreamerConfig>): void {
    this.streamerConfig = {
      ...this.streamerConfig,
      ...config,
    };
    this.streamStats.serverUrl = this.streamerConfig.wsUrl;
    try {
      localStorage.setItem(DJ_CREDENTIALS_STORAGE_KEY, JSON.stringify(this.streamerConfig));
    } catch {}
    this.emitStats();
  }

  public getStreamerConfig(): StreamerConfig {
    return { ...this.streamerConfig };
  }

  public getState(): BroadcastState {
    return this.state;
  }

  public getMode(): BroadcastMode {
    return this.mode;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public getOnAirSeconds(): number {
    return this.onAirSeconds;
  }

  public getMicGain(): number {
    return this.micGain;
  }

  public isMonitorEnabled(): boolean {
    return this.monitorEnabled;
  }

  public isLowCutEnabled(): boolean {
    return this.lowCutEnabled;
  }

  public isCompressorEnabled(): boolean {
    return this.compressorEnabled;
  }

  public getStreamStats(): StreamStats {
    return { ...this.streamStats };
  }

  public getLastRecordedIntervention(): Blob | null {
    return this.lastRecordedIntervention;
  }

  /**
   * Enumerate available microphone devices
   */
  public async getAvailableAudioDevices(): Promise<AudioInputDevice[]> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Ensure AudioContext and stream destination are initialized
   */
  public async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 48000 });
      this.streamDestinationNode = this.audioContext.createMediaStreamDestination();
      this.startContinuousEncoder();
    }
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {}
    }
    return this.audioContext;
  }

  /**
   * Initialize and request microphone capture with studio processing chain
   */
  public async initMicrophone(deviceId?: string): Promise<boolean> {
    try {
      this.setState('requesting_permission');

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Votre navigateur ne supporte pas la capture microphone (getUserMedia)');
      }

      if (deviceId) {
        this.selectedDeviceId = deviceId;
      }

      // Stop any existing stream
      this.cleanupStream();

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: false, // Studio high fidelity
          autoGainControl: false,
          sampleRate: 48000,
          channelCount: 2,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;

      // Initialize or resume Web Audio graph
      await this.ensureAudioContext();
      if (!this.audioContext || !this.streamDestinationNode) {
        throw new Error('Impossible d\'initialiser le moteur Web Audio');
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // 1. Studio Highpass Filter (Low-Cut 80Hz) to remove table rumbles & plosives
      this.lowCutFilter = this.audioContext.createBiquadFilter();
      this.lowCutFilter.type = 'highpass';
      this.lowCutFilter.frequency.value = this.lowCutEnabled ? 80 : 20;

      // 2. Mic Gain fader node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.micGain;

      // 3. Broadcast Dynamics Compressor Node
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-24, this.audioContext.currentTime);
      this.compressorNode.knee.setValueAtTime(30, this.audioContext.currentTime);
      this.compressorNode.ratio.setValueAtTime(this.compressorEnabled ? 4 : 1, this.audioContext.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.audioContext.currentTime);

      // 4. Analyser node for hardware stereo VU-Meter
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.65;

      // 5. Monitor node (headphones sidetone / CUE)
      this.monitorGainNode = this.audioContext.createGain();
      this.monitorGainNode.gain.value = this.monitorEnabled ? this.monitorVolume : 0;

      // Connect graph:
      // source -> lowCut -> gain -> compressor -> analyser
      this.sourceNode.connect(this.lowCutFilter);
      this.lowCutFilter.connect(this.gainNode);
      this.gainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.analyserNode);

      // Connect to destination (sidetone headphones monitor)
      this.compressorNode.connect(this.monitorGainNode);
      this.monitorGainNode.connect(this.audioContext.destination);

      // Connect to encoder stream destination
      this.compressorNode.connect(this.streamDestinationNode);

      // Start VU-meter polling loop
      this.startVuMeterLoop();

      this.setState('ready');
      return true;
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Accès au microphone refusé par l\'utilisateur.'
        : (err.message || 'Impossible d\'initialiser le microphone');
      this.setState('error', msg);
      return false;
    }
  }

  /**
   * Continuous MediaRecorder encoder pipeline producing Opus/Ogg chunks
   */
  private startContinuousEncoder(): void {
    if (!this.streamDestinationNode) return;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }

    try {
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      }

      this.mediaRecorder = new MediaRecorder(this.streamDestinationNode.stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      this.mediaRecorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;

        // Keep local buffer for review/priority injection
        this.recordedChunks.push(e.data);
        if (this.recordedChunks.length > 200) {
          this.recordedChunks.shift(); // keep sliding window
        }

        // IF IN "ON AIR" MODE, WEBSOCKET OPEN, AND HANDSHAKE CONFIRMED: STREAM BINARY AUDIO TO STREAM SERVER/LIQUIDSOAP
        if (this.mode === 'on_air' && this.webSocket && this.webSocket.readyState === WebSocket.OPEN && this.isHandshakeReady) {
          try {
            const buffer = await e.data.arrayBuffer();
            // Re-verify socket state after async arrayBuffer conversion
            if (
              this.mode === 'on_air' &&
              this.webSocket &&
              this.webSocket.readyState === WebSocket.OPEN &&
              this.isHandshakeReady &&
              buffer.byteLength > 0
            ) {
              this.webSocket.send(buffer);
              this.streamStats.bytesSent += buffer.byteLength;
              this.streamStats.packetsSent += 1;
              this.bytesSentPeriod += buffer.byteLength;
              this.lastPacketSentTime = Date.now();
              this.emitStats();
            }
          } catch (sendErr) {
            console.warn('[LiveBroadcast] Error streaming audio chunk to WebSocket:', sendErr);
          }
        }
      };

      // Generate timesliced audio chunks every 150ms for low broadcast latency
      this.mediaRecorder.start(150);
    } catch (err) {
      console.error('[LiveBroadcast] Failed to start MediaRecorder continuous encoder:', err);
    }
  }

  /**
   * Connect to Liquidsoap Icecast DJ WebSocket endpoint
   * Uses single persistent WebSocket connection across DJ session
   */
  public async connectStream(customConfig?: Partial<StreamerConfig>, forceReconnect: boolean = false): Promise<boolean> {
    if (customConfig) {
      this.saveCredentials(customConfig);
    }

    const { wsUrl, username, password } = this.streamerConfig;
    if (!wsUrl) {
      this.updateStats({ connectionState: 'error', lastError: 'URL WebSocket manquante' });
      return false;
    }

    const cleanUrl = wsUrl.trim();

    // Re-use existing socket if already open or connecting (single persistent session)
    if (!forceReconnect && this.webSocket) {
      if (this.webSocket.readyState === WebSocket.OPEN) {
        this.updateStats({ connectionState: 'connected', handshakeOk: true });
        return true;
      }
      if (this.webSocket.readyState === WebSocket.CONNECTING) {
        return new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 6000);
          const interval = setInterval(() => {
            if (!this.webSocket || this.webSocket.readyState === WebSocket.CLOSED) {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve(false);
            } else if (this.webSocket.readyState === WebSocket.OPEN) {
              clearTimeout(timeout);
              clearInterval(interval);
              resolve(true);
            }
          }, 100);
        });
      }
    }

    // Only close if forceReconnect is true or socket was disconnected
    this.disconnectStream();

    this.updateStats({
      connectionState: 'connecting',
      lastError: '',
      handshakeOk: false,
    });

    try {
      this.isHandshakeReady = false;
      // Étape 1 : Déclaration obligatoire du sous-protocole 'webcast' et binaryType = 'arraybuffer'
      const socket = new WebSocket(cleanUrl, ['webcast']);
      socket.binaryType = 'arraybuffer';
      this.socket = socket;
      this.webSocket = socket;

      return new Promise<boolean>((resolve) => {
        let isSettled = false;
        const connectionTimeout = setTimeout(() => {
          if (!isSettled && this.webSocket?.readyState !== WebSocket.OPEN) {
            isSettled = true;
            this.updateStats({
              connectionState: 'error',
              lastError: 'Délai de connexion WebSocket dépassé (timeout 7s)',
            });
            resolve(false);
          }
        }, 7000);

        socket.onopen = () => {
          clearTimeout(connectionTimeout);
          this.reconnectAttempts = 0;
          this.clearReconnectTimer();
          this.updateStats({ connectionState: 'connected' });

          // Étape 2 : À l'événement 'open', envoie la trame JSON hello conforme au protocole officiel WebDJ
          const webcastConfig = JSON.stringify({
            type: 'hello',
            data: {
              mime: this.mediaRecorder?.mimeType || 'audio/webm;codecs=opus',
              user: username || 'theocourant',
              password: password || 'SynapseDj2026!',
            },
          });

          try {
            socket.send(webcastConfig);
          } catch (err) {
            console.warn('[LiveBroadcast] Erreur envoi trame webcast config:', err);
          }

          // Étape 3 : N'active l'envoi des buffers audio du MediaRecorder / AudioWorklet
          // qu'après réception de l'acquittement ou 200 ms après la trame de config
          setTimeout(() => {
            this.isHandshakeReady = true;
            this.updateStats({ handshakeOk: true });
          }, 200);

          this.startHeartbeatLoop();
          this.startStatsBitrateLoop();

          if (!isSettled) {
            isSettled = true;
            resolve(true);
          }
        };

        socket.onmessage = (event) => {
          const data = event.data;
          this.isHandshakeReady = true;
          this.updateStats({ handshakeOk: true });
          if (typeof data === 'string') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'ready' || parsed.status === 'ok' || parsed.connected) {
                this.isHandshakeReady = true;
                this.updateStats({ handshakeOk: true });
              }
            } catch {
              if (data.includes('200 OK') || data.includes('OK') || data.includes('ready')) {
                this.isHandshakeReady = true;
                this.updateStats({ handshakeOk: true });
              }
            }
          }
        };

        socket.onerror = (evt: any) => {
          clearTimeout(connectionTimeout);
          console.warn('[LiveBroadcast] WebSocket error:', evt);
          this.updateStats({
            connectionState: 'error',
            lastError: 'Erreur de connexion socket sur ' + wsUrl,
          });
          if (!isSettled) {
            isSettled = true;
            resolve(false);
          }
        };

        socket.onclose = (evt) => {
          clearTimeout(connectionTimeout);
          this.isHandshakeReady = false;
          const wasConnected = this.streamStats.connectionState === 'connected' && this.streamStats.handshakeOk;
          this.updateStats({
            connectionState: 'disconnected',
            handshakeOk: false,
            lastError: wasConnected && evt.code !== 1000 ? `Connexion fermée (Code ${evt.code})` : '',
          });
          this.stopHeartbeatLoop();

          // Uniquement en cas de déconnexion inattendue pendant un direct actif (ON AIR confirmé)
          // et avec un maximum de 3 tentatives avec backoff progressif
          if (wasConnected && this.mode === 'on_air' && evt.code !== 1000 && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
            console.warn(`[LiveBroadcast] Reconnexion automatique ON AIR ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} dans ${delay}ms...`);
            this.clearReconnectTimer();
            this.reconnectTimer = setTimeout(async () => {
              if (this.mode === 'on_air') {
                const ok = await this.connectStream(undefined, true);
                if (!ok && this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
                  console.warn('[LiveBroadcast] Nombre maximum de tentatives atteint. Retour en mode CUE.');
                  this.switchToCue();
                  this.setState('cue', 'Connexion direct interrompue. Mode CUE actif.');
                }
              }
            }, delay);
          } else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS && this.mode === 'on_air') {
            this.switchToCue();
            this.setState('cue', 'Connexion direct interrompue. Mode CUE actif.');
          }

          if (!isSettled) {
            isSettled = true;
            resolve(false);
          }
        };
      });
    } catch (err: any) {
      this.updateStats({
        connectionState: 'error',
        lastError: err.message || 'Impossible d\'ouvrir la WebSocket',
      });
      return false;
    }
  }

  /**
   * Heartbeat keepalive loop to prevent Liquidsoap 60-120s harbor timeout
   */
  private startHeartbeatLoop(): void {
    this.stopHeartbeatLoop();
    this.heartbeatInterval = setInterval(() => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      // Uniquement si en mode CUE (pas de flux audio) et inactif depuis > 3s
      if (this.mode === 'cue' && now - this.lastPacketSentTime >= 3000) {
        this.sendKeepalivePacket();
      }
    }, 3000);
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send lightweight keepalive packet
   */
  private sendKeepalivePacket(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) return;
    try {
      this.updateStats({ lastHeartbeat: Date.now() });
    } catch (err) {
      console.warn('[LiveBroadcast] Failed to send keepalive packet:', err);
    }
  }

  /**
   * Calculate live bitrate every 2 seconds
   */
  private startStatsBitrateLoop(): void {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.bytesSentPeriod = 0;

    this.statsInterval = setInterval(() => {
      const kbps = Math.round(((this.bytesSentPeriod * 8) / 2000) * 10) / 10;
      this.bytesSentPeriod = 0;
      this.updateStats({ bitrateKbps: kbps });
    }, 2000);
  }

  /**
   * Disconnect live streaming socket
   */
  public disconnectStream(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.stopHeartbeatLoop();
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.isHandshakeReady = false;

    const safelyClose = (ws: WebSocket | null) => {
      if (!ws) return;
      try {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Intentional disconnect');
        }
      } catch {}
    };

    safelyClose(this.socket);
    safelyClose(this.webSocket);
    this.socket = null;
    this.webSocket = null;

    this.updateStats({
      connectionState: 'disconnected',
      handshakeOk: false,
      bitrateKbps: 0,
    });
  }

  /**
   * Set broadcast mode: 'on_air' (Direct Rouge) vs 'cue' (Pré-écoute Bleu)
   */
  public async setMode(newMode: BroadcastMode): Promise<boolean> {
    if (!this.mediaStream) {
      const ok = await this.initMicrophone();
      if (!ok) return false;
    }

    if (newMode === 'on_air') {
      this.clearReconnectTimer();
      // Connect socket if not yet connected
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        this.setState('connecting');
        const ok = await this.connectStream();
        if (!ok) {
          // If socket couldn't connect, remain in CUE but inform user
          this.mode = 'cue';
          this.setState('cue', this.streamStats.lastError || 'Échec de connexion au serveur DJ');
          return false;
        }
      }

      this.mode = 'on_air';
      this.setState('on_air');
      this.onAirStartTime = Date.now();
      this.onAirSeconds = 0;

      if (this.onAirTimerInterval) clearInterval(this.onAirTimerInterval);
      this.onAirTimerInterval = setInterval(() => {
        this.onAirSeconds = Math.floor((Date.now() - this.onAirStartTime) / 1000);
        this.emitTimerTick(this.onAirSeconds);
      }, 1000);

      return true;
    } else {
      this.clearReconnectTimer();
      this.reconnectAttempts = 0;
      this.mode = 'cue';
      // Switch to CUE mode
      if (this.onAirTimerInterval) {
        clearInterval(this.onAirTimerInterval);
        this.onAirTimerInterval = null;
      }
      this.onAirSeconds = 0;
      this.emitTimerTick(0);

      // Save recorded chunk as true PCM WAV if any
      if (this.recordedChunks.length > 0) {
        try {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const rawBlob = new Blob(this.recordedChunks, { type: mimeType });
          convertBlobToWav(rawBlob).then((wavBlob) => {
            this.lastRecordedIntervention = wavBlob;
            this.emitIntervention(wavBlob);
          }).catch(() => {
            this.lastRecordedIntervention = rawBlob;
            this.emitIntervention(rawBlob);
          });
        } catch {}
      }

      this.setState('cue');
      // Ensure headphone sidetone is audible in CUE
      this.setMonitorEnabled(true, this.monitorVolume);

      return true;
    }
  }

  /**
   * Start live broadcast directly to ON AIR
   */
  public async startBroadcast(): Promise<boolean> {
    return this.setMode('on_air');
  }

  /**
   * Drop to CUE mode (local sidetone loopback, keepalive heartbeat maintained)
   */
  public switchToCue(): void {
    this.setMode('cue');
  }

  /**
   * Stop broadcast completely (OFF AIR / STANDBY)
   */
  public stopBroadcast(): Blob | null {
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    if (this.onAirTimerInterval) {
      clearInterval(this.onAirTimerInterval);
      this.onAirTimerInterval = null;
    }

    let savedBlob: Blob | null = null;
    if (this.recordedChunks.length > 0) {
      try {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        savedBlob = new Blob(this.recordedChunks, { type: mimeType });
        this.lastRecordedIntervention = savedBlob;
        this.emitIntervention(savedBlob);
      } catch {}
    }

    this.mode = 'cue';
    this.disconnectStream();
    this.setState('ready');
    this.onAirSeconds = 0;
    this.emitTimerTick(0);

    return savedBlob;
  }

  /**
   * Play synthesized jingle (Chime, Gong, Stinger, Applause, Airhorn, Laser)
   * If target is 'cue': outputs ONLY to DJ headphones/speakers (local monitor)
   * If target is 'on_air': outputs to DJ headphones AND mixes directly into streamDestinationNode (Web Audio -> WebSocket to broadcast server/Liquidsoap)
   */
  public async playSynthesizedJingle(
    soundType: 'gong' | 'chime' | 'stinger' | 'applause' | 'horn' | 'laser',
    target: 'cue' | 'on_air' = 'on_air'
  ): Promise<void> {
    const ctx = await this.ensureAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }
    const now = ctx.currentTime;
    const wasAlreadyOnAir = this.mode === 'on_air';

    // Si diffusion à l'antenne demandée, s'assurer que la socket est connectée et en mode ON AIR
    if (target === 'on_air') {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        await this.connectStream();
      }
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN && this.mode !== 'on_air') {
        await this.setMode('on_air');
      }
    }

    const jingleGain = ctx.createGain();
    jingleGain.gain.setValueAtTime(0.85, now);

    // Retour casque DJ permanent pour écoute locale
    jingleGain.connect(ctx.destination);

    // Si ON AIR: mixe directement dans le flux broadcast de l'antenne (MediaStreamDestinationNode)
    if (target === 'on_air' && this.streamDestinationNode) {
      jingleGain.connect(this.streamDestinationNode);
    }

    if (!wasAlreadyOnAir && target === 'on_air') {
      setTimeout(() => {
        if (this.mode === 'on_air') {
          this.switchToCue();
        }
      }, 2600);
    }

    if (soundType === 'chime') {
      // Carillon 4 notes harmonique radio (C5, E5, G5, C6)
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const noteStart = now + idx * 0.12;
        g.gain.setValueAtTime(0.001, noteStart);
        g.gain.exponentialRampToValueAtTime(0.28, noteStart + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.8);
        osc.connect(g);
        g.connect(jingleGain);
        osc.start(noteStart);
        osc.stop(noteStart + 1.85);
      });
    } else if (soundType === 'gong') {
      // Gong radio avec résonance basse et pitch-bend
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 2.2);
      osc2.frequency.setValueAtTime(165, now);
      osc2.frequency.exponentialRampToValueAtTime(112, now + 2.2);
      g.gain.setValueAtTime(0.55, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      osc.connect(g);
      osc2.connect(g);
      g.connect(jingleGain);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 2.4);
      osc2.stop(now + 2.4);
    } else if (soundType === 'stinger') {
      // Stinger Pop Fanfare dynamique
      [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const noteStart = now + idx * 0.09;
        g.gain.setValueAtTime(0.18, noteStart);
        g.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.9);
        osc.connect(g);
        g.connect(jingleGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.9);
      });
    } else if (soundType === 'horn') {
      // Airhorn Dancehall radio : 2 salves courtes + 1 salve longue
      const bursts = [
        { start: 0, dur: 0.14 },
        { start: 0.20, dur: 0.14 },
        { start: 0.42, dur: 0.55 },
      ];
      bursts.forEach(({ start, dur }) => {
        const bStart = now + start;
        [466.16, 587.33, 700.0].forEach((freq) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, bStart);
          osc.frequency.linearRampToValueAtTime(freq * 0.96, bStart + dur);
          g.gain.setValueAtTime(0.2, bStart);
          g.gain.exponentialRampToValueAtTime(0.001, bStart + dur);
          osc.connect(g);
          g.connect(jingleGain);
          osc.start(bStart);
          osc.stop(bStart + dur);
        });
      });
    } else if (soundType === 'laser') {
      // Laser radio SFX pitch drop
      [0, 0.18].forEach((offset) => {
        const lStart = now + offset;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2400, lStart);
        osc.frequency.exponentialRampToValueAtTime(140, lStart + 0.24);
        g.gain.setValueAtTime(0.25, lStart);
        g.gain.exponentialRampToValueAtTime(0.001, lStart + 0.24);
        osc.connect(g);
        g.connect(jingleGain);
        osc.start(lStart);
        osc.stop(lStart + 0.25);
      });
    } else {
      // Applaudissements / Crowd cheer via bruit blanc modulé et filtré
      const bufferSize = Math.floor(ctx.sampleRate * 2.0);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.8));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      noise.connect(filter);
      filter.connect(g);
      g.connect(jingleGain);
      noise.start(now);
      noise.stop(now + 2.0);
    }
  }

  /**
   * Play any audio URL or Blob (e.g. jingle file, audio drop, recorded intervention)
   * If target is 'cue': outputs ONLY to DJ headphones/speakers
   * If target is 'on_air': outputs to DJ headphones AND mixes directly into streamDestinationNode (broadcast to server/Liquidsoap)
   */
  public async playAudioFile(
    urlOrBlob: string | Blob,
    target: 'cue' | 'on_air' = 'on_air'
  ): Promise<void> {
    const ctx = await this.ensureAudioContext();

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    const wasAlreadyOnAir = this.mode === 'on_air';

    if (target === 'on_air') {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        await this.connectStream();
      }
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN && this.mode !== 'on_air') {
        await this.setMode('on_air');
      }
    }

    let arrayBuffer: ArrayBuffer;
    if (typeof urlOrBlob === 'string') {
      if (urlOrBlob.startsWith('data:')) {
        const commaIdx = urlOrBlob.indexOf(',');
        const b64 = commaIdx >= 0 ? urlOrBlob.slice(commaIdx + 1) : urlOrBlob;
        const binaryStr = atob(b64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        const resp = await fetch(urlOrBlob);
        if (!resp.ok) throw new Error('Impossible de charger le fichier audio : ' + resp.statusText);
        arrayBuffer = await resp.arrayBuffer();
      }
    } else {
      arrayBuffer = await urlOrBlob.arrayBuffer();
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

    // Retour casque / moniteur régie
    gainNode.connect(ctx.destination);

    // Diffusion sur le flux de l'antenne (MediaStreamDestinationNode -> MediaRecorder -> WebSocket)
    if (this.streamDestinationNode) {
      gainNode.connect(this.streamDestinationNode);
    }

    source.onended = () => {
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {}

      // Si le mode était cue avant ce drop ponctuel, repasser en cue pour libérer l'antenne en douceur
      if (!wasAlreadyOnAir && target === 'on_air' && this.mode === 'on_air') {
        this.switchToCue();
      }
    };

    source.connect(gainNode);
    source.start();
  }

  /**
   * Set microphone gain level (0.0 to 2.5 = 0% to 250%)
   */
  public setMicGain(gain: number): void {
    const clamped = Math.max(0, Math.min(2.5, gain));
    this.micGain = clamped;
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(clamped, this.audioContext.currentTime, 0.02);
    }
  }

  /**
   * Toggle 80Hz Low-Cut high-pass filter
   */
  public setLowCut(enabled: boolean): void {
    this.lowCutEnabled = enabled;
    if (this.lowCutFilter && this.audioContext) {
      this.lowCutFilter.frequency.setTargetAtTime(enabled ? 80 : 20, this.audioContext.currentTime, 0.05);
    }
  }

  /**
   * Toggle broadcast voice compressor
   */
  public setCompressor(enabled: boolean): void {
    this.compressorEnabled = enabled;
    if (this.compressorNode && this.audioContext) {
      this.compressorNode.ratio.setTargetAtTime(enabled ? 4 : 1, this.audioContext.currentTime, 0.05);
    }
  }

  /**
   * Toggle headphone monitoring (sidetone)
   */
  public setMonitorEnabled(enabled: boolean, volume = 0.65): void {
    this.monitorEnabled = enabled;
    this.monitorVolume = Math.max(0, Math.min(1, volume));
    if (this.monitorGainNode && this.audioContext) {
      const target = enabled ? this.monitorVolume : 0;
      this.monitorGainNode.gain.setTargetAtTime(target, this.audioContext.currentTime, 0.05);
    }
  }

  /**
   * Completely shut down engine and release mic
   */
  public shutdown(): void {
    this.stopBroadcast();
    this.disconnectStream();
    this.stopVuMeterLoop();
    this.cleanupStream();
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.setState('idle');
  }

  private cleanupStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  private startVuMeterLoop(): void {
    if (!this.analyserNode) return;
    const bufferLength = this.analyserNode.frequencyBinCount;
    const timeData = new Float32Array(bufferLength);

    const update = () => {
      if (!this.analyserNode) return;
      this.analyserNode.getFloatTimeDomainData(timeData);

      let sum = 0;
      let peak = 0;

      for (let i = 0; i < bufferLength; i++) {
        const abs = Math.abs(timeData[i]);
        if (abs > peak) peak = abs;
        sum += abs * abs;
      }

      const rms = Math.sqrt(sum / bufferLength);
      // Compute dBFS (range -60 to 0)
      const db = rms > 0.0001 ? Math.max(-60, Math.min(0, 20 * Math.log10(rms))) : -60;
      const isClipping = peak >= 0.98;

      const reading: VuMeterReading = {
        rms: Math.min(1, rms * 2.5),
        peak: Math.min(1, peak),
        db: Math.round(db * 10) / 10,
        isClipping,
      };

      this.emitVuMeter(reading);
      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  private stopVuMeterLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateStats(patch: Partial<StreamStats>): void {
    this.streamStats = { ...this.streamStats, ...patch };
    this.emitStats();
  }

  private setState(state: BroadcastState, error?: string): void {
    this.state = state;
    this.errorMessage = error || '';
    this.stateListeners.forEach((fn) => fn(state, this.errorMessage));
  }

  private emitVuMeter(reading: VuMeterReading): void {
    this.vuListeners.forEach((fn) => fn(reading));
  }

  private emitTimerTick(sec: number): void {
    this.timerListeners.forEach((fn) => fn(sec));
  }

  private emitIntervention(blob: Blob): void {
    this.interventionListeners.forEach((fn) => fn(blob));
  }

  private emitStats(): void {
    this.statsListeners.forEach((fn) => fn({ ...this.streamStats }));
  }

  public subscribeState(listener: (state: BroadcastState, error?: string) => void): () => void {
    this.stateListeners.push(listener);
    listener(this.state, this.errorMessage);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  public subscribeVuMeter(listener: (reading: VuMeterReading) => void): () => void {
    this.vuListeners.push(listener);
    return () => {
      this.vuListeners = this.vuListeners.filter((l) => l !== listener);
    };
  }

  public subscribeTimer(listener: (seconds: number) => void): () => void {
    this.timerListeners.push(listener);
    return () => {
      this.timerListeners = this.timerListeners.filter((l) => l !== listener);
    };
  }

  public subscribeIntervention(listener: (blob: Blob) => void): () => void {
    this.interventionListeners.push(listener);
    return () => {
      this.interventionListeners = this.interventionListeners.filter((l) => l !== listener);
    };
  }

  public subscribeStats(listener: (stats: StreamStats) => void): () => void {
    this.statsListeners.push(listener);
    listener({ ...this.streamStats });
    return () => {
      this.statsListeners = this.statsListeners.filter((l) => l !== listener);
    };
  }
}

export const liveBroadcastEngine = new LiveBroadcastEngine();
