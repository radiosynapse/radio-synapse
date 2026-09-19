import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Square, SkipForward, RotateCcw, Mic, Volume2, 
  VolumeX, Headphones, Sparkles, Music2, Users, 
  Wifi, X, Flame, ListMusic, 
  History, Upload, Trash2, FastForward, RefreshCw,
  Play
} from 'lucide-react';
import { StreamChannel } from '../data';
import { 
  getAzuraCastConfig, 
  fetchStationNowPlaying, 
  skipStationCurrentTrack, 
  stopStationBackend,
  startStationBackend,
  fetchStationQueue, 
  fetchStationHistory, 
  restartStationBackend, 
  uploadAndInjectPriorityAudio,
  getStationWebDjUrl,
  slugifyStationName,
  AzuraNowPlayingData, 
  AzuraQueueItem, 
  AzuraHistoryItem 
} from '../lib/azuracast';
import { 
  getAudioDrops, 
  createAudioDrop, 
  deleteAudioDrop, 
  AudioDrop 
} from '../utils/audioDropsStore';
import { 
  liveBroadcastEngine, 
  BroadcastState, 
  VuMeterReading, 
  AudioInputDevice 
} from '../utils/liveBroadcastEngine';
import { getLinkedAdminDjAccount } from '../utils/supabaseAuthService';
import { WebDjStudioDeck } from './WebDjStudioDeck';
import { convertBlobToWav } from '../utils/audioWavEncoder';

interface StationControlDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: StreamChannel | null;
  onRefreshData?: () => void;
}

type ControlTab = 'monitoring' | 'controls' | 'webrtc' | 'jingles';

export default function StationControlDeckModal({
  isOpen,
  onClose,
  station,
  onRefreshData,
}: StationControlDeckModalProps) {
  const [activeTab, setActiveTab] = useState<ControlTab>('monitoring');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // AzuraCast live data
  const [nowPlaying, setNowPlaying] = useState<AzuraNowPlayingData | null>(null);
  const [queue, setQueue] = useState<AzuraQueueItem[]>([]);
  const [history, setHistory] = useState<AzuraHistoryItem[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);
  const [isSkipping, setIsSkipping] = useState<boolean>(false);
  const [isRestarting, setIsRestarting] = useState<boolean>(false);

  // WebRTC / Live broadcast state
  const [broadcastState, setBroadcastState] = useState<BroadcastState>('idle');
  const [broadcastError, setBroadcastError] = useState<string>('');
  const [onAirSeconds, setOnAirSeconds] = useState<number>(0);
  const [vuReading, setVuReading] = useState<VuMeterReading>({ rms: 0, peak: 0, db: -60, isClipping: false });
  const [micGain, setMicGain] = useState<number>(1.0);
  const [monitorEnabled, setMonitorEnabled] = useState<boolean>(false);
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Audio drops / Jinglothèque
  const [audioDrops, setAudioDrops] = useState<AudioDrop[]>([]);
  const [activeDropPlaying, setActiveDropPlaying] = useState<string | null>(null);
  const [injectingDropId, setInjectingDropId] = useState<string | null>(null);
  const [isInjectingAudio, setIsInjectingAudio] = useState<boolean>(false);
  const dropAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice drop recorder state
  const [isRecordingDrop, setIsRecordingDrop] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [voiceDropTitle, setVoiceDropTitle] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Local monitor stream preview player
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Web DJ In-House Console state
  const [micMode, setMicMode] = useState<'lock' | 'ptt'>('lock');
  const [lowCutEnabled, setLowCutEnabled] = useState<boolean>(true);
  const [compressorEnabled, setCompressorEnabled] = useState<boolean>(true);
  const [lastInterventionBlob, setLastInterventionBlob] = useState<Blob | null>(null);
  const [lastInterventionUrl, setLastInterventionUrl] = useState<string | null>(null);
  const [lastInterventionDuration, setLastInterventionDuration] = useState<number>(0);
  const [isInjectingIntervention, setIsInjectingIntervention] = useState<boolean>(false);

  // Music Bed (Tapis sonore) with auto-ducking
  const [musicBedActive, setMusicBedActive] = useState<boolean>(false);
  const [musicBedVolume, setMusicBedVolume] = useState<number>(0.35);
  const musicBedSynthRef = useRef<{ stop: () => void; setGain: (g: number) => void } | null>(null);

  const azuraConfig = getAzuraCastConfig();
  const stationMapping = station ? (azuraConfig.stationMappings[station.id] || 
    azuraConfig.stationMappings[station.name] || {
      azuraStationId: station.stationNumber ? parseInt(station.stationNumber, 10) || 1 : 1,
      azuraShortcode: slugifyStationName(station.name),
    }) : { azuraStationId: 1, azuraShortcode: '' };
  const targetAzuraId = Number(stationMapping.azuraStationId) || 1;
  const currentShortcode = nowPlaying?.station?.shortcode || stationMapping.azuraShortcode || (station ? slugifyStationName(station.name) : '');
  const webDjUrl = getStationWebDjUrl(currentShortcode);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // 1. Initial Load & Metadata Polling
  useEffect(() => {
    if (!isOpen || !station) return;
    let isMounted = true;
    setAudioDrops(getAudioDrops());

    // Apply linked Admin DJ credentials if available
    const linkedDj = getLinkedAdminDjAccount();
    if (linkedDj?.username) {
      liveBroadcastEngine.saveCredentials({
        username: linkedDj.username,
        password: linkedDj.password || '',
      });
    }

    const loadData = async () => {
      if (!isMounted) return;
      setIsLoadingMetadata(true);
      try {
        const np = await fetchStationNowPlaying(targetAzuraId);
        if (isMounted && np) setNowPlaying(np);

        const q = await fetchStationQueue(targetAzuraId);
        if (isMounted) setQueue(q);

        const h = await fetchStationHistory(targetAzuraId);
        if (isMounted) setHistory(h);
      } catch {}
      if (isMounted) setIsLoadingMetadata(false);
    };

    loadData();
    const pollInterval = setInterval(loadData, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [station?.id, targetAzuraId]);

  // 2. WebRTC Live Broadcast Engine Subscriptions
  useEffect(() => {
    const unsubState = liveBroadcastEngine.subscribeState((state, err) => {
      setBroadcastState(state);
      setBroadcastError(err || '');
    });

    const unsubVu = liveBroadcastEngine.subscribeVuMeter((reading) => {
      setVuReading(reading);
    });

    const unsubTimer = liveBroadcastEngine.subscribeTimer((sec) => {
      setOnAirSeconds(sec);
    });

    const unsubIntervention = liveBroadcastEngine.subscribeIntervention((blob) => {
      setLastInterventionBlob(blob);
      setLastInterventionDuration(onAirSeconds || 5);
      setLastInterventionUrl(URL.createObjectURL(blob));
    });

    liveBroadcastEngine.getAvailableAudioDevices().then((devs) => {
      setAudioDevices(devs);
      if (devs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devs[0].deviceId);
      }
    });

    return () => {
      unsubState();
      unsubVu();
      unsubTimer();
      unsubIntervention();
    };
  }, []);

  // Cleanup on modal close
  useEffect(() => {
    return () => {
      if (dropAudioRef.current) {
        dropAudioRef.current.pause();
        dropAudioRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  // Handle Skip Action
  const handleSkipTrack = async () => {
    setIsSkipping(true);
    try {
      const res = await skipStationCurrentTrack(targetAzuraId);
      showToast(res.message);
      // Refresh nowplaying immediately
      setTimeout(async () => {
        const np = await fetchStationNowPlaying(targetAzuraId);
        if (np) setNowPlaying(np);
        setIsSkipping(false);
        onRefreshData?.();
      }, 1200);
    } catch (err: any) {
      showToast(err.message || 'Échec du skip');
      setIsSkipping(false);
    }
  };

  // Handle Restart Backend / AutoDJ
  const handleRestartAutoDj = async () => {
    setIsRestarting(true);
    try {
      const res = await restartStationBackend(targetAzuraId);
      showToast(res.message);
      onRefreshData?.();
    } catch (err: any) {
      showToast(err.message || 'Échec du redémarrage');
    } finally {
      setIsRestarting(false);
    }
  };

  // Music Bed (Tapis sonore) Web Audio Synthesizer with Ducking
  useEffect(() => {
    if (!musicBedActive) {
      if (musicBedSynthRef.current) {
        musicBedSynthRef.current.stop();
        musicBedSynthRef.current = null;
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      const targetGain = broadcastState === 'on_air' ? musicBedVolume * 0.25 : musicBedVolume;
      masterGain.gain.setValueAtTime(targetGain, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Warm broadcast ambient chords: Fmaj7 -> Am7 -> Dm7 -> Bbmaj7
      const chords = [
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [220.00, 261.63, 329.63, 392.00], // Am7
        [146.83, 220.00, 261.63, 349.23], // Dm7
        [116.54, 233.08, 293.66, 349.23], // Bbmaj7
      ];

      let chordIndex = 0;
      let activeOscs: OscillatorNode[] = [];
      let isPlaying = true;

      const playChord = () => {
        if (!isPlaying) return;
        activeOscs.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
        activeOscs = [];

        const currentFreqs = chords[chordIndex % chords.length];
        chordIndex++;

        currentFreqs.forEach(freq => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const oscGain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(500, ctx.currentTime);

          oscGain.gain.setValueAtTime(0, ctx.currentTime);
          oscGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.3);
          oscGain.gain.setValueAtTime(0.06, ctx.currentTime + 3.4);
          oscGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 3.9);

          osc.connect(filter);
          filter.connect(oscGain);
          oscGain.connect(masterGain);

          osc.start();
          osc.stop(ctx.currentTime + 4.0);
          activeOscs.push(osc);
        });
      };

      playChord();
      const chordInterval = setInterval(playChord, 3800);

      musicBedSynthRef.current = {
        stop: () => {
          isPlaying = false;
          clearInterval(chordInterval);
          activeOscs.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
          try { ctx.close(); } catch {}
        },
        setGain: (g: number) => {
          if (ctx.state !== 'closed') {
            masterGain.gain.setTargetAtTime(g, ctx.currentTime, 0.08);
          }
        },
      };
    } catch {
      setMusicBedActive(false);
    }

    return () => {
      if (musicBedSynthRef.current) {
        musicBedSynthRef.current.stop();
        musicBedSynthRef.current = null;
      }
    };
  }, [musicBedActive]);

  // Adjust Music Bed Ducking on Mic status change
  useEffect(() => {
    if (musicBedSynthRef.current) {
      const target = broadcastState === 'on_air' ? musicBedVolume * 0.25 : musicBedVolume;
      musicBedSynthRef.current.setGain(target);
    }
  }, [broadcastState, musicBedVolume]);

  // Push-To-Talk Spacebar hotkey listener in Web DJ tab
  useEffect(() => {
    if (activeTab !== 'webrtc') return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space' && !e.repeat && micMode === 'ptt') {
        e.preventDefault();
        await liveBroadcastEngine.setMode('on_air');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space' && micMode === 'ptt') {
        e.preventDefault();
        liveBroadcastEngine.switchToCue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTab, micMode]);

  // Handle Live Mic Toggle (LOCK mode)
  const handleToggleBroadcast = async () => {
    if (broadcastState === 'on_air') {
      liveBroadcastEngine.switchToCue();
      // Reprendre automatiquement l'AutoDJ dès que le micro est coupé
      await startStationBackend(targetAzuraId);
      showToast('🎧 Micro coupé. L\'AutoDJ a repris l\'antenne.');
    } else {
      // Désactiver l'AutoDJ pour laisser le champ libre au micro direct
      await stopStationBackend(targetAzuraId);
      const ok = await liveBroadcastEngine.setMode('on_air');
      if (ok) {
        showToast('🔴 MICRO EN DIRECT ! L\'AutoDJ est en pause, vous êtes à l\'antenne.');
      } else {
        // En cas d'erreur, restaurer l'AutoDJ
        await startStationBackend(targetAzuraId);
        showToast(broadcastError || 'Impossible d\'activer le flux micro direct');
      }
    }
  };

  // Push-To-Talk Mouse down / up handlers
  const handlePttMouseDown = async () => {
    if (micMode !== 'ptt') return;
    await stopStationBackend(targetAzuraId);
    await liveBroadcastEngine.setMode('on_air');
  };

  const handlePttMouseUp = async () => {
    if (micMode !== 'ptt') return;
    liveBroadcastEngine.switchToCue();
    await startStationBackend(targetAzuraId);
  };

  // Inject recorded intervention into AzuraCast live stream
  const handleInjectIntervention = async (mode: 'immediate' | 'next') => {
    if (!lastInterventionBlob) return;
    setIsInjectingIntervention(true);
    try {
      const title = `Intervention Micro DJ (${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`;
      if (mode === 'immediate') {
        showToast(`🔴 Diffusion EN DIRECT de l'intervention sur la station...`);
      } else {
        showToast(`Programmation de l'intervention pour le prochain titre...`);
      }
      const res = await uploadAndInjectPriorityAudio(targetAzuraId, lastInterventionBlob, title, mode);
      showToast(res.message);
      onRefreshData?.();
    } catch (err: any) {
      showToast(err.message || 'Échec de la diffusion de l\'intervention');
    } finally {
      setIsInjectingIntervention(false);
    }
  };

  // Instant SFX trigger for Web DJ soundboard
  const handlePlayInstantJingle = async (name: string, soundType: 'gong' | 'chime' | 'stinger' | 'applause' | 'horn' | 'laser') => {
    try {
      const targetMode = (broadcastState === 'on_air' || liveBroadcastEngine.getMode() === 'on_air') ? 'on_air' : 'cue';
      await liveBroadcastEngine.playSynthesizedJingle(soundType, targetMode);
      if (targetMode === 'on_air') {
        showToast(`🔴 Jingle "${name}" diffusé EN DIRECT à l'antenne !`);
      } else {
        showToast(`🎧 Jingle "${name}" déclenché en pré-écoute CUE`);
      }
    } catch (err: any) {
      console.warn('Erreur déclenchement jingle:', err);
    }
  };

  // Play an Audio Drop
  const handlePlayDrop = (drop: AudioDrop) => {
    if (activeDropPlaying === drop.id && dropAudioRef.current) {
      dropAudioRef.current.pause();
      dropAudioRef.current.currentTime = 0;
      setActiveDropPlaying(null);
      return;
    }

    if (dropAudioRef.current) {
      dropAudioRef.current.pause();
    }

    try {
      const audio = new Audio(drop.audioUrl);
      dropAudioRef.current = audio;
      setActiveDropPlaying(drop.id);

      audio.onended = () => {
        setActiveDropPlaying(null);
      };
      audio.onerror = () => {
        setActiveDropPlaying(null);
        showToast('Erreur lors de la lecture du jingle');
      };

      audio.play().catch(() => {
        setActiveDropPlaying(null);
      });
      showToast(`Jingle déclenché : "${drop.name}"`);
    } catch {
      setActiveDropPlaying(null);
    }
  };

  // Quick Voice Drop Recorder
  const handleStartVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const rawBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const wavBlob = await convertBlobToWav(rawBlob);
          const url = URL.createObjectURL(wavBlob);
          setRecordedAudioUrl(url);
          recordedChunksRef.current = [wavBlob];
        } catch {
          const rawBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(rawBlob);
          setRecordedAudioUrl(url);
        }
        setRecordedDuration(recordingSeconds);
        // Stop raw tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(100);
      setIsRecordingDrop(true);
      setRecordingSeconds(0);
      setRecordedAudioUrl(null);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showToast('Impossible d\'accéder au micro pour l\'enregistrement : ' + (err.message || 'Erreur'));
    }
  };

  const handleStopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingDrop) {
      mediaRecorderRef.current.stop();
      setIsRecordingDrop(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      showToast('Enregistrement terminé ! Vous pouvez réécouter ou diffuser.');
    }
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    showToast(`Copié : ${text}`);
    setTimeout(() => {
      setCopiedField((prev) => (prev === fieldKey ? null : prev));
    }, 2000);
  };

  // Deploy voice drop (Immediate vs Next Track) using REAL AzuraCast & Live Engine injection
  const handleDeployVoiceDrop = async (mode: 'immediate' | 'next') => {
    if (!recordedAudioUrl) return;
    setIsInjectingAudio(true);
    const title = voiceDropTitle.trim() || `Annonce Direct ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

    try {
      let blob: Blob | null = null;
      if (recordedChunksRef.current && recordedChunksRef.current.length > 0) {
        blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
      } else {
        const resp = await fetch(recordedAudioUrl);
        blob = await resp.blob();
      }

      if (mode === 'immediate') {
        showToast(`🔴 Envoi prioritaire de votre annonce vocale "${title}"...`);
        const res = await uploadAndInjectPriorityAudio(targetAzuraId, blob, title, 'immediate');
        showToast(res.message);
      } else {
        showToast(`Programmation de l'annonce "${title}" pour le prochain titre...`);
        const res = await uploadAndInjectPriorityAudio(targetAzuraId, blob, title, 'next');
        showToast(res.message);
      }

      // Auto-archive to jinglothèque
      await createAudioDrop({
        name: title,
        category: mode === 'immediate' ? 'emergency' : 'voice_drop',
        stationId: station?.id || 'all',
        audioUrl: recordedAudioUrl,
        duration: recordedDuration || 4,
        createdBy: 'Régie Direct',
        priority: mode === 'immediate',
        padColor: mode === 'immediate' ? '#ff0055' : '#bd00ff',
        notes: `Drop vocal enregistré à ${new Date().toLocaleTimeString()}`,
      });
      setAudioDrops(getAudioDrops());
      setRecordedAudioUrl(null);
      setVoiceDropTitle('');

      // Refresh nowplaying & queue
      setTimeout(async () => {
        const np = await fetchStationNowPlaying(targetAzuraId);
        if (np) setNowPlaying(np);
        const q = await fetchStationQueue(targetAzuraId);
        if (q) setQueue(q);
        onRefreshData?.();
      }, 1200);
    } catch (err: any) {
      showToast(`Erreur d'injection : ${err.message || 'Échec'}`);
    } finally {
      setIsInjectingAudio(false);
    }
  };

  // Inject a Cartouche / Jingle directly to the live stream
  const handleInjectCartouche = async (drop: AudioDrop, mode: 'immediate' | 'next') => {
    setInjectingDropId(drop.id);
    try {
      if (mode === 'immediate') {
        showToast(`🔥 Envoi prioritaire du jingle "${drop.name}" sur la station...`);
        const res = await uploadAndInjectPriorityAudio(targetAzuraId, drop.audioUrl, drop.name, 'immediate');
        showToast(res.message);
      } else {
        showToast(`Programmation du jingle "${drop.name}" pour le prochain titre...`);
        const res = await uploadAndInjectPriorityAudio(targetAzuraId, drop.audioUrl, drop.name, 'next');
        showToast(res.message);
      }

      // Refresh nowplaying & queue
      setTimeout(async () => {
        const np = await fetchStationNowPlaying(targetAzuraId);
        if (np) setNowPlaying(np);
        const q = await fetchStationQueue(targetAzuraId);
        if (q) setQueue(q);
        onRefreshData?.();
      }, 1200);
    } catch (err: any) {
      showToast(`Erreur d'envoi : ${err.message || 'Échec'}`);
    } finally {
      setInjectingDropId(null);
    }
  };

  // Upload external jingle file
  const handleUploadCustomJingle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const newDrop = await createAudioDrop({
        name: file.name.replace(/\.[^/.]+$/, ''),
        category: 'jingle',
        stationId: station?.id || 'all',
        audioUrl: dataUrl,
        duration: 5,
        createdBy: 'Admin Upload',
        padColor: '#00ffa3',
      });
      setAudioDrops(getAudioDrops());
      showToast(`Jingle "${newDrop.name}" ajouté à la Jinglothèque !`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen || !station) return null;

  const isStreamerLive = Boolean(nowPlaying?.live?.is_live);
  const liveStreamerName = nowPlaying?.live?.streamer_name || 'theocourant';
  const isOnAir = isStreamerLive || broadcastState === 'on_air';
  const songTitle = nowPlaying?.now_playing?.song?.title || station.tracks[0]?.title || 'Diffusion Continue AutoDJ';
  const songArtist = nowPlaying?.now_playing?.song?.artist || station.tracks[0]?.artist || station.name;
  const songArt = nowPlaying?.now_playing?.song?.art || station.coverUrl || station.tracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
  const totalListeners = nowPlaying?.listeners?.total ?? 42;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[850px] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-zinc-100 font-sans">
        
        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="absolute top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-zinc-900/95 border border-zinc-700 text-zinc-100 text-xs font-mono font-bold shadow-xl flex items-center gap-2 animate-in slide-in-from-top duration-200">
            <Sparkles className="w-4 h-4 text-white animate-spin" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="px-5 py-4 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs font-mono shadow-inner border"
              style={{ backgroundColor: `${station.color}20`, borderColor: station.color, color: station.color }}
            >
              {station.stationNumber || '01'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  <span>{station.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Station Control Deck
                  </span>
                </h2>
                {isStreamerLive ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono tracking-wider bg-red-600 text-white animate-pulse flex items-center gap-1.5 shadow-lg shadow-red-900/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    DIRECT DJ : {liveStreamerName.toUpperCase()}
                  </span>
                ) : broadcastState === 'on_air' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono tracking-wider bg-amber-600 text-white animate-pulse flex items-center gap-1.5 shadow-lg shadow-amber-900/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    MICRO RÉGIE EN COURS
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    AutoDJ Actif
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                <span>Azura ID: #{targetAzuraId}</span>
                <span>•</span>
                <span className="text-zinc-400">{station.genre}</span>
                <span>•</span>
                <span className="text-zinc-500 truncate max-w-[200px] sm:max-w-xs">{station.streamUrl || 'cast.radiosynapse.fr'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime Listeners Counter */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-emerald-400">{totalListeners}</span>
              <span className="text-zinc-500">auditeurs</span>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Fermer la télécommande"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'monitoring'
                ? 'bg-zinc-800 text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-white" />
            <span>1. Monitoring Direct</span>
          </button>

          <button
            onClick={() => setActiveTab('controls')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'controls'
                ? 'bg-zinc-800 text-white border border-zinc-600 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <FastForward className="w-3.5 h-3.5 text-white" />
            <span>2. Télécommande & File</span>
          </button>

          <button
            onClick={() => setActiveTab('webrtc')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'webrtc'
                ? 'bg-red-500/20 text-red-300 border border-red-400/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-red-400" />
            <span>3. Web DJ & Micro</span>
            {isOnAir && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
          </button>

          <button
            onClick={() => setActiveTab('jingles')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'jingles'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>4. Jingles & Annonces</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-950 text-purple-300 border border-purple-800">
              {audioDrops.length}
            </span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 p-5 overflow-y-auto">
          
          {/* ========================================================================= */}
          {/* ZONE 1: MONITORING DIRECT                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'monitoring' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* CURRENT TRACK CARD */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-zinc-300" />
                    Titre en cours de diffusion
                  </span>
                  <button
                    onClick={() => {
                      fetchStationNowPlaying(targetAzuraId).then((np) => {
                        if (np) setNowPlaying(np);
                        showToast('Métadonnées actualisées');
                      });
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-mono flex items-center gap-1 transition-colors"
                    title="Rafraîchir les métadonnées"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingMetadata ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Rafraîchir</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden shadow-2xl border border-zinc-700 flex-shrink-0 group">
                    <img 
                      src={songArt} 
                      alt={songTitle} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                      <span className="text-[10px] font-mono text-white/90 bg-black/60 px-1.5 py-0.5 rounded">
                        AutoDJ
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col justify-center">
                    <span className="text-xs font-mono text-white font-bold tracking-wide">
                      {songArtist}
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-white truncate mt-0.5">
                      {songTitle}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-1">
                      {nowPlaying?.now_playing?.song?.album || 'Radio Synapse Master Stream'}
                    </p>

                    {/* Stream Audio Preview in Studio */}
                    <div className="mt-3 flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                      <button
                        onClick={() => {
                          if (isPreviewPlaying && previewAudioRef.current) {
                            previewAudioRef.current.pause();
                            setIsPreviewPlaying(false);
                          } else {
                            const streamUrl = station.streamUrl || 'https://cast.radiosynapse.fr/listen/synapse/radio.mp3';
                            const audio = new Audio(streamUrl);
                            previewAudioRef.current = audio;
                            audio.play().then(() => setIsPreviewPlaying(true)).catch(() => {
                              showToast('Erreur lors du démarrage du flux de monitoring');
                              setIsPreviewPlaying(false);
                            });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          isPreviewPlaying 
                            ? 'bg-amber-500 text-black border border-amber-400 shadow-md' 
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                        }`}
                      >
                        {isPreviewPlaying ? <VolumeX className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5 text-zinc-300" />}
                        <span>{isPreviewPlaying ? 'Couper Pré-Écoute Studio' : 'Pré-Écoute Régie'}</span>
                      </button>

                      <button
                        onClick={handleSkipTrack}
                        disabled={isSkipping}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <SkipForward className={`w-3.5 h-3.5 ${isSkipping ? 'animate-spin' : ''}`} />
                        <span>{isSkipping ? 'Saut en cours...' : 'Passer le morceau (Skip)'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* PLAYING NEXT PREVIEW */}
                {nowPlaying?.playing_next && (
                  <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-zinc-500">Prochain titre :</span>
                      <span className="text-white font-bold truncate">
                        {nowPlaying.playing_next.song.artist} — {nowPlaying.playing_next.song.title}
                      </span>
                    </div>
                    <span className="text-zinc-400 text-[10px] whitespace-nowrap">
                      {formatTime(nowPlaying.playing_next.duration || 180)}
                    </span>
                  </div>
                )}
              </div>

              {/* TECHNICAL METRICS & SERVER STATUS */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col gap-4">
                <span className="text-xs font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  État du Serveur & Flux
                </span>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400">Statut Diffusion :</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Opérationnel (200 OK)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400">Auditeurs en Direct :</span>
                    <span className="text-white font-black text-sm">{totalListeners}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400">Qualité Débit :</span>
                    <span className="text-zinc-300 font-bold">320 kbps MP3 HD</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400">Serveur Backend :</span>
                    <span className="text-zinc-300 truncate max-w-[130px]">AzuraCast Icecast</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-400">Point de Montage :</span>
                    <span className="text-zinc-400 truncate max-w-[130px]">/radio.mp3</span>
                  </div>
                </div>

                <div className="pt-2 mt-auto">
                  <button
                    onClick={handleRestartAutoDj}
                    disabled={isRestarting}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                    <span>{isRestarting ? 'Redémarrage en cours...' : 'Redémarrer le Service AutoDJ'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ZONE 2: TÉLÉCOMMANDE & FILE D'ATTENTE                                     */}
          {/* ========================================================================= */}
          {activeTab === 'controls' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* PLAYLIST QUEUE */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-zinc-300" />
                    File d'Attente Programmée ({queue.length || station.tracks.length})
                  </span>
                  <button
                    onClick={handleSkipTrack}
                    disabled={isSkipping}
                    className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Passer Titre</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {(queue.length > 0 ? queue : station.tracks.slice(1)).map((item: any, idx: number) => {
                    const title = item.song?.title || item.title;
                    const artist = item.song?.artist || item.artist;
                    const art = item.song?.art || item.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80';
                    const duration = item.duration || 180;

                    return (
                      <div 
                        key={idx} 
                        className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs font-mono transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-zinc-600 font-bold w-4 text-right">{idx + 1}</span>
                          <img src={art} alt="" className="w-9 h-9 rounded-lg object-cover border border-zinc-800 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{title}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{artist}</p>
                          </div>
                        </div>
                        <span className="text-zinc-500 text-[11px] flex-shrink-0">
                          {formatTime(duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RECENT PLAYBACK HISTORY */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col gap-3">
                <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  Historique Récent des Diffusions
                </span>

                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {(history.length > 0 ? history : station.tracks.slice(0, 5)).map((item: any, idx: number) => {
                    const title = item.song?.title || item.title;
                    const artist = item.song?.artist || item.artist;
                    const art = item.song?.art || item.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80';

                    return (
                      <div 
                        key={idx} 
                        className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800/60 flex items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={art} alt="" className="w-8 h-8 rounded-lg object-cover border border-zinc-800 opacity-80 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-zinc-200 truncate">{title}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{artist}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                          {idx === 0 ? 'Il y a 3 min' : `Diffusé #${idx}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ZONE 3: MON PROPRE WEB DJ & INTERVENTIONS MICRO DIRECT                    */}
          {/* ========================================================================= */}
          {activeTab === 'webrtc' && (
            <WebDjStudioDeck
              station={station}
              targetAzuraId={targetAzuraId}
              currentShortcode={currentShortcode}
              webDjUrl={webDjUrl}
              nowPlaying={nowPlaying}
              isStreamerLive={isStreamerLive}
              liveStreamerName={liveStreamerName}
              broadcastState={broadcastState}
              broadcastError={broadcastError}
              onAirSeconds={onAirSeconds}
              vuReading={vuReading}
              micGain={micGain}
              setMicGain={setMicGain}
              lowCutEnabled={lowCutEnabled}
              setLowCutEnabled={setLowCutEnabled}
              compressorEnabled={compressorEnabled}
              setCompressorEnabled={setCompressorEnabled}
              monitorEnabled={monitorEnabled}
              setMonitorEnabled={setMonitorEnabled}
              audioDevices={audioDevices}
              selectedDeviceId={selectedDeviceId}
              setSelectedDeviceId={setSelectedDeviceId}
              micMode={micMode}
              setMicMode={setMicMode}
              onToggleBroadcast={handleToggleBroadcast}
              onPttMouseDown={handlePttMouseDown}
              onPttMouseUp={handlePttMouseUp}
              lastInterventionBlob={lastInterventionBlob}
              lastInterventionUrl={lastInterventionUrl}
              lastInterventionDuration={lastInterventionDuration}
              onInjectIntervention={handleInjectIntervention}
              isInjectingIntervention={isInjectingIntervention}
              musicBedActive={musicBedActive}
              setMusicBedActive={setMusicBedActive}
              musicBedVolume={musicBedVolume}
              setMusicBedVolume={setMusicBedVolume}
              onPlayInstantJingle={handlePlayInstantJingle}
              showToast={showToast}
              onCopyText={handleCopyText}
              copiedField={copiedField}
              onSkipTrack={handleSkipTrack}
              isSkippingTrack={isSkipping}
            />
          )}

          {/* ========================================================================= */}
          {/* ZONE 4: JINGLES / ANNONCES & CARTOUCHEUR RADIO AVEC DIFFUSION DIRECTE    */}
          {/* ========================================================================= */}
          {activeTab === 'jingles' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* QUICK VOICE DROP RECORDER */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between gap-4">
                <div>
                  <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Mic className="w-4 h-4 text-purple-400" />
                    Enregistreur Vocal Express (Voice Drop)
                  </span>

                  <p className="text-xs text-zinc-400 mb-4">
                    Enregistrez un message ou une annonce flash, pré-écoutez, puis injectez-le directement sur le flux AzuraCast en priorité absolue !
                  </p>

                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col items-center gap-4 text-center">
                    {isRecordingDrop ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-red-600/90 animate-pulse flex items-center justify-center shadow-lg shadow-red-900/50">
                          <Square className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-lg font-mono font-black text-red-400 animate-pulse">
                          {formatTime(recordingSeconds)}
                        </span>
                        <button
                          onClick={handleStopVoiceRecording}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold transition-all cursor-pointer shadow-md"
                        >
                          Arrêter l'Enregistrement
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={handleStartVoiceRecording}
                          className="w-14 h-14 rounded-full bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
                        >
                          <Mic className="w-6 h-6" />
                        </button>
                        <span className="text-xs font-mono text-zinc-400">
                          Cliquer pour enregistrer votre voix
                        </span>
                      </div>
                    )}

                    {/* Recorded Audio Preview & Injection Controls */}
                    {recordedAudioUrl && !isRecordingDrop && (
                      <div className="w-full pt-3 border-t border-zinc-800 space-y-3 animate-in fade-in">
                        <audio src={recordedAudioUrl} controls className="w-full h-8" />

                        <input
                          type="text"
                          placeholder="Nom de l'annonce (ex: Dédicace live)"
                          value={voiceDropTitle}
                          onChange={(e) => setVoiceDropTitle(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                        />

                        {isInjectingAudio ? (
                          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-600/50 flex items-center justify-center gap-2 text-xs font-mono text-purple-200">
                            <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                            <span>Injection sur le flux AzuraCast en cours...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                            <button
                              onClick={() => handleDeployVoiceDrop('immediate')}
                              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                              title="Diffuser immédiatement sur le flux direct de l'antenne"
                            >
                              <Flame className="w-3.5 h-3.5" />
                              <span>Diffuser Direct</span>
                            </button>

                            <button
                              onClick={() => handleDeployVoiceDrop('next')}
                              className="px-3 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                              title="Programmé comme prochain élément dans la file d'attente"
                            >
                              <FastForward className="w-3.5 h-3.5" />
                              <span>Prochain Titre</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* JINGLOTHÈQUE SOUNDBOARD PADS WITH DIRECT ON-AIR TRIGGER */}
              <div className="lg:col-span-7 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-zinc-300" />
                      Cartoucheur Radio (Diffusion Directe)
                    </span>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      Cliquez sur un pad pour pré-écouter, ou utilisez les boutons Direct/Next pour l'injecter sur le flux antenne !
                    </p>
                  </div>

                  <label className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Importer Audio (.mp3/.wav)</span>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={handleUploadCustomJingle}
                    />
                  </label>
                </div>

                {/* Soundboard Pad Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-[460px] pr-1">
                  {audioDrops.map((drop) => {
                    const isPlaying = activeDropPlaying === drop.id;
                    const isInjecting = injectingDropId === drop.id;
                    const isUrgent = drop.category === 'emergency';

                    return (
                      <div
                        key={drop.id}
                        className={`group relative p-3 rounded-2xl border transition-all flex flex-col justify-between h-32 shadow-md ${
                          isInjecting
                            ? 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/50'
                            : isPlaying 
                            ? 'bg-white/10 border-white/40 ring-2 ring-white/20' 
                            : isUrgent 
                            ? 'bg-red-950/40 border-red-800/80 hover:border-red-500' 
                            : 'bg-zinc-950/90 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {/* Top: indicator + trash */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: drop.padColor || '#00f2ff' }}
                            />
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {drop.duration}s
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteAudioDrop(drop.id);
                              setAudioDrops(getAudioDrops());
                              showToast(`Jingle "${drop.name}" supprimé`);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
                            title="Supprimer le jingle"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Center: Title + Preview click */}
                        <div 
                          className="min-w-0 cursor-pointer"
                          onClick={() => handlePlayDrop(drop)}
                          title="Cliquer pour pré-écouter au casque régie"
                        >
                          <h5 className="text-xs font-bold text-white truncate group-hover:text-zinc-200 transition-colors flex items-center gap-1">
                            {isPlaying ? <Volume2 className="w-3 h-3 text-white animate-pulse" /> : <Play className="w-3 h-3 text-zinc-500" />}
                            <span className="truncate">{drop.name}</span>
                          </h5>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            {isPlaying ? 'Écoute casque en cours...' : 'Cliquer pour pré-écoute'}
                          </p>
                        </div>

                        {/* Bottom: Injection triggers to REAL AzuraCast stream */}
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-zinc-800/80 font-mono text-[10px]">
                          <button
                            disabled={isInjecting}
                            onClick={() => handleInjectCartouche(drop, 'immediate')}
                            className="flex-1 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Diffuser immédiatement sur l'antenne radio"
                          >
                            <Flame className="w-2.5 h-2.5" />
                            <span>Direct</span>
                          </button>

                          <button
                            disabled={isInjecting}
                            onClick={() => handleInjectCartouche(drop, 'next')}
                            className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-white font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Programmer au prochain morceau"
                          >
                            <FastForward className="w-2.5 h-2.5" />
                            <span>Next</span>
                          </button>
                        </div>

                        {/* Overlay when injecting */}
                        {isInjecting && (
                          <div className="absolute inset-0 rounded-2xl bg-purple-950/80 backdrop-blur-sm border-2 border-purple-500 flex items-center justify-center">
                            <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-[9px] font-black font-mono tracking-wider animate-pulse flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 animate-spin" />
                              INJECTION...
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER BAR */}
        <div className="px-5 py-3 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-500 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span>Serveur AzuraCast : <span className="text-zinc-300">{azuraConfig.baseUrl}</span></span>
            <span>•</span>
            <span>PocketBase DB : <span className="text-emerald-400">db.radiosynapse.fr</span></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer"
          >
            Fermer le Control Deck
          </button>
        </div>

      </div>
    </div>
  );
}
