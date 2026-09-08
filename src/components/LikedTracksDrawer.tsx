import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  ExternalLink, 
  X, 
  Sparkles, 
  Music2, 
  Search,
  Share2,
  RefreshCw,
  Loader2,
  Check
} from 'lucide-react';
import { LikedTrack, ConnectedAccount } from '../types';
import Drawer from './Drawer';
import { MarqueeText } from './MarqueeText';
import DoubleHeartIcon from './DoubleHeartIcon';
import TrackShareModal from './TrackShareModal';
import { useCoverColor } from '../utils/coverColorExtractor';

interface LikedTracksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  likedTracks: LikedTrack[];
  onRemoveTrack: (id: string) => void;
  onUpdateTrackLevel?: (id: string, newLevel: 1 | 2) => void;
  connectedAccount: ConnectedAccount | null;
  onOpenConnectModal: () => void;
  onSyncWithSpotify?: () => Promise<void>;
  accentColor?: string;
}

export default function LikedTracksDrawer({
  isOpen,
  onClose,
  likedTracks,
  onRemoveTrack,
  onUpdateTrackLevel,
  connectedAccount,
  onOpenConnectModal,
  onSyncWithSpotify,
}: LikedTracksDrawerProps) {
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShareTrack, setSelectedShareTrack] = useState<LikedTrack | null>(null);
  const [filterLevel, setFilterLevel] = useState<'all' | 'level2' | 'level1'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleManualSync = async () => {
    if (!onSyncWithSpotify) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      await onSyncWithSpotify();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (e) {
      console.warn('Manual sync error', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Stop audio preview when drawer closes
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setPlayingPreviewId(null);
    }
  }, [isOpen]);

  const handleTogglePreview = (track: LikedTrack) => {
    const previewSrc = track.previewUrl || getFallbackPreviewUrl(track.title, track.artist);

    if (playingPreviewId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingPreviewId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const newAudio = new Audio(previewSrc);
      audioRef.current = newAudio;
      newAudio.volume = 0.85;
      newAudio.play().then(() => {
        setPlayingPreviewId(track.id);
      }).catch((err) => {
        console.warn('Playback error for preview', err);
      });

      newAudio.onended = () => {
        setPlayingPreviewId(null);
      };
    }
  };

  const handleOpenShareSmartLink = (track: LikedTrack) => {
    setSelectedShareTrack(track);
  };

  const filteredTracks = likedTracks.filter((t) => {
    const matchesQuery = 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.album && t.album.toLowerCase().includes(searchQuery.toLowerCase()));

    const trackLvl = t.level || 1;
    if (filterLevel === 'level2') return matchesQuery && trackLvl === 2;
    if (filterLevel === 'level1') return matchesQuery && trackLvl === 1;
    return matchesQuery;
  });

  const level2Count = likedTracks.filter(t => (t.level || 1) === 2).length;
  const level1Count = likedTracks.filter(t => (t.level || 1) === 1).length;

  return (
    <Drawer
      id="liked-tracks-drawer"
      isOpen={isOpen}
      onClose={onClose}
      isFullScreen={true}
      title={
        <div className="flex items-center gap-2.5">
          <DoubleHeartIcon level={2} sizeClassName="w-5 h-5" />
          <span className="font-futuristic text-[11px] sm:text-xs font-bold uppercase tracking-widest text-white">
            MES TITRES LIKÉS
          </span>
        </div>
      }
      maxWidthClass="max-w-2xl sm:max-w-3xl"
    >
      <div className="flex flex-col gap-5">
        
        {/* Account status: minimal badge if connected, or prompt if not connected */}
        {connectedAccount ? (
          <div className="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-2xl bg-zinc-950/90 border border-emerald-500/30 shadow-lg text-left">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-emerald-400 flex-shrink-0 shadow-sm">
                  <img
                    src={connectedAccount.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/174/174872.png'}
                    alt="Spotify"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white truncate font-futuristic">
                      {connectedAccount.username}
                    </span>
                    <button
                      onClick={onOpenConnectModal}
                      className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                    >
                      Gérer
                    </button>
                  </div>
                  <span className="text-[10.5px] font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Spotify lié & synchronisé en direct
                  </span>
                </div>
              </div>

              {/* Right Side: Direct Link to Spotify Playlist or Sync Button */}
              <div className="flex items-center gap-2">
                {connectedAccount.playlistUrl ? (
                  <a
                    href={connectedAccount.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/50 text-emerald-300 text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title="Ouvrir la playlist Radio Synapse - Titres Likés sur Spotify"
                  >
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/174/174872.png"
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span>Ouvrir sur Spotify</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                  </a>
                ) : (
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/50 text-emerald-300 text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>{isSyncing ? 'Synchronisation...' : 'Créer la Playlist Spotify'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Playlist Information and manual resync */}
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/5 flex-wrap gap-2">
              <span className="truncate">
                Playlist liée : <strong className="text-zinc-200 font-bold">Radio Synapse - Titres Likés</strong>
              </span>
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors text-[11px] font-semibold"
                title="Forcer la resynchronisation de tous les titres avec Spotify"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Synchronisation...</span>
                  </>
                ) : syncSuccess ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Synchronisé !</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Resynchroniser</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-cyan-950/40 border border-white/15 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-pink-500/20 border border-pink-400/30 text-pink-300 flex-shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-semibold text-white leading-snug">
                  Connectez votre compte de plateforme musicale pour retrouver directement vos titres likés dans votre bibliothèque.
                </span>
                <span className="text-[11px] text-zinc-400 font-mono mt-1">
                  Synchronisation instantanée avec votre bibliothèque Spotify.
                </span>
              </div>
            </div>

            <button
              onClick={onOpenConnectModal}
              className="flex-shrink-0 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_18px_rgba(236,72,153,0.3)] hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Music2 className="w-4 h-4" />
              <span>Connecter un compte</span>
            </button>
          </div>
        )}

        {/* Level Filters & Search Bar */}
        {likedTracks.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setFilterLevel('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    filterLevel === 'all'
                      ? 'bg-white/15 text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Tous ({likedTracks.length})
                </button>

                <button
                  onClick={() => setFilterLevel('level2')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    filterLevel === 'level2'
                      ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border border-rose-400/50 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                      : 'text-rose-400 hover:text-rose-200'
                  }`}
                >
                  <DoubleHeartIcon level={2} sizeClassName="w-3.5 h-3.5" />
                  <span>Super Like ({level2Count})</span>
                </button>

                <button
                  onClick={() => setFilterLevel('level1')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    filterLevel === 'level1'
                      ? 'bg-red-500/30 border border-red-500/60 text-red-300 shadow'
                      : 'text-red-400 hover:text-red-200'
                  }`}
                >
                  <DoubleHeartIcon level={1} sizeClassName="w-3.5 h-3.5" />
                  <span>Like ({level1Count})</span>
                </button>
              </div>

              {likedTracks.length > 2 && (
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par titre ou artiste..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-400 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Liked tracks list */}
        <div className="flex flex-col gap-3.5">
          {likedTracks.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-black/30 border border-white/5 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                <DoubleHeartIcon level={2} sizeClassName="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-white font-futuristic uppercase tracking-wider">
                Aucun titre en favori
              </p>
              <p className="text-xs font-mono text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
                Pendant l'écoute, cliquez 1 fois pour un Like ❤️ ou 2 fois pour un Super Like ❤️❤️.
              </p>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center py-8 text-zinc-300 font-mono text-xs">
              Aucun titre ne correspond aux filtres sélectionnés.
            </div>
          ) : (
            filteredTracks.map((track, idx) => (
              <LikedTrackRowItem
                key={`liked-track-${track.id || 'trk'}-${idx}`}
                track={track}
                isPlayingThis={playingPreviewId === track.id}
                onTogglePreview={() => handleTogglePreview(track)}
                onRemoveTrack={() => onRemoveTrack(track.id)}
                onUpdateTrackLevel={onUpdateTrackLevel}
                onShareMultiLink={() => handleOpenShareSmartLink(track)}
              />
            ))
          )}
        </div>

      </div>

      {/* Social Track Share Modal with Permanent Link & MiniDisc Story Generator */}
      <TrackShareModal
        isOpen={!!selectedShareTrack}
        onClose={() => setSelectedShareTrack(null)}
        track={selectedShareTrack}
      />
    </Drawer>
  );
}

// Sub-component for individual track row with aligned heart icon, share button, and top-right close cross
function LikedTrackRowItem({
  track,
  isPlayingThis,
  onTogglePreview,
  onRemoveTrack,
  onUpdateTrackLevel,
  onShareMultiLink,
}: {
  track: LikedTrack;
  isPlayingThis: boolean;
  onTogglePreview: () => void;
  onRemoveTrack: () => void;
  onUpdateTrackLevel?: (id: string, newLevel: 1 | 2) => void;
  onShareMultiLink: () => void;
}) {
  const currentLvl = track.level || 1;
  const coverColorHarmony = useCoverColor(track.coverUrl, track.title, track.artist);

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl bg-black/60 border transition-all duration-300 flex flex-col gap-3 relative overflow-hidden group shadow-lg ${
        currentLvl === 2
          ? 'border-rose-500/30 hover:border-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.15)] bg-gradient-to-r from-rose-950/20 via-black/70 to-black/70'
          : 'border-white/10 hover:border-white/25'
      }`}
    >
      {/* Top Right: Simple Cross 'X' Button to remove track */}
      <button
        onClick={onRemoveTrack}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-zinc-400 hover:text-red-400 transition-all cursor-pointer z-10"
        title="Retirer des favoris"
        aria-label="Retirer des favoris"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Main Row: Cover + Info + Heart Icon + Share Button */}
      <div className="flex items-center gap-3 min-w-0 pr-8">
        
        {/* Album Cover with Play/Wave Overlay */}
        <div className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-white/15 flex-shrink-0 shadow-md group-hover:border-pink-500/50 transition-colors">
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          
          {/* Interactive Cover Overlay: Animated Wave when playing, Play Icon on hover */}
          <button
            onClick={onTogglePreview}
            className={`absolute inset-0 flex items-center justify-center transition-all cursor-pointer ${
              isPlayingThis
                ? 'bg-black/75 opacity-100 shadow-[inset_0_0_15px_rgba(236,72,153,0.5)]'
                : 'bg-black/40 opacity-0 group-hover:opacity-100 hover:bg-black/60'
            }`}
            title={isPlayingThis ? 'Arrêter l\'extrait' : 'Écouter l\'extrait (30s)'}
          >
            {isPlayingThis ? (
              <div className="flex items-end justify-center gap-0.5 h-5 px-1">
                <span className="w-1 bg-gradient-to-t from-pink-500 to-cyan-400 rounded-full animate-bounce [animation-duration:0.6s] h-4" />
                <span className="w-1 bg-gradient-to-t from-pink-500 to-cyan-400 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.15s] h-5" />
                <span className="w-1 bg-gradient-to-t from-pink-500 to-cyan-400 rounded-full animate-bounce [animation-duration:0.5s] [animation-delay:0.3s] h-3.5" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-white/90 text-black shadow-md">
                <Play className="w-4 h-4 ml-0.5 fill-current" />
              </div>
            )}
          </button>
        </div>

        {/* Track Title + Heart Icon (No text) + Share button + Artist */}
        <div className="flex flex-col min-w-0 flex-1 justify-center">
          {/* Row with Title aligned with Heart Icon & Share Button */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex-shrink truncate">
              <MarqueeText
                text={track.title}
                className="text-sm sm:text-base font-bold text-white group-hover:text-pink-300 transition-colors block"
              />
            </div>

            {/* Pure Heart Icon (No text inside) */}
            <button
              onClick={() => {
                if (onUpdateTrackLevel) {
                  onUpdateTrackLevel(track.id, currentLvl === 1 ? 2 : 1);
                }
              }}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex-shrink-0 flex items-center justify-center hover:scale-110 ${
                currentLvl === 2
                  ? 'bg-rose-950/60 border-rose-400/60 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                  : 'bg-red-950/60 border-red-500/40'
              }`}
              title={currentLvl === 2 ? 'Super Like (Cliquer pour passer en Like)' : 'Like (Cliquer pour passer en Super Like)'}
            >
              <DoubleHeartIcon level={currentLvl} customColor={coverColorHarmony} sizeClassName="w-3.5 h-3.5" />
            </button>

            {/* Multi-link Share Button directly to the right of Heart Icon */}
            <button
              onClick={onShareMultiLink}
              className="p-1.5 rounded-lg border bg-white/5 hover:bg-pink-500/20 border-white/10 hover:border-pink-400/50 text-zinc-400 hover:text-pink-300 transition-all cursor-pointer flex-shrink-0 flex items-center justify-center hover:scale-110 active:scale-95 shadow-sm"
              title="Générer et partager la page SmartLink multi-plateforme"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Artist line */}
          <MarqueeText
            text={track.artist}
            className="text-xs text-pink-400 font-bold uppercase tracking-wider block mt-0.5 font-mono"
          />
        </div>

      </div>

      {/* Multi-link Streaming Buttons (Deezer, Spotify, Apple Music, YouTube Music) */}
      <div className="pt-2.5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Deezer */}
        <a
          href={track.deezerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-pink-950/60 border border-white/10 hover:border-pink-500/50 text-white transition-all cursor-pointer flex items-center justify-between group/link"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <img
              src="https://cdn-icons-png.flaticon.com/512/5968/5968856.png"
              alt="Deezer"
              className="w-3.5 h-3.5 object-contain flex-shrink-0"
            />
            <span className="text-[11px] font-bold font-mono group-hover/link:text-pink-300 transition-colors truncate">
              Deezer
            </span>
          </div>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover/link:text-pink-400 flex-shrink-0" />
        </a>

        {/* Spotify */}
        <a
          href={track.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-emerald-950/60 border border-white/10 hover:border-emerald-500/50 text-white transition-all cursor-pointer flex items-center justify-between group/link"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <img
              src="https://cdn-icons-png.flaticon.com/512/174/174872.png"
              alt="Spotify"
              className="w-3.5 h-3.5 object-contain flex-shrink-0"
            />
            <span className="text-[11px] font-bold font-mono group-hover/link:text-emerald-300 transition-colors truncate">
              Spotify
            </span>
          </div>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover/link:text-emerald-400 flex-shrink-0" />
        </a>

        {/* Apple Music */}
        <a
          href={track.appleMusicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-red-950/60 border border-white/10 hover:border-red-500/50 text-white transition-all cursor-pointer flex items-center justify-between group/link"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <img
              src="https://cdn-icons-png.flaticon.com/512/0/747.png"
              alt="Apple Music"
              className="w-3.5 h-3.5 object-contain flex-shrink-0"
            />
            <span className="text-[11px] font-bold font-mono group-hover/link:text-red-300 transition-colors truncate">
              Apple
            </span>
          </div>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover/link:text-red-400 flex-shrink-0" />
        </a>

        {/* YouTube Music */}
        <a
          href={track.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-red-950/60 border border-white/10 hover:border-red-500/50 text-white transition-all cursor-pointer flex items-center justify-between group/link"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <img
              src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png"
              alt="YouTube Music"
              className="w-3.5 h-3.5 object-contain flex-shrink-0"
            />
            <span className="text-[11px] font-bold font-mono group-hover/link:text-red-300 transition-colors truncate">
              YouTube
            </span>
          </div>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover/link:text-red-400 flex-shrink-0" />
        </a>
      </div>
    </div>
  );
}

// Fallback preview audio if iTunes search is unreachable
function getFallbackPreviewUrl(title: string, artist: string): string {
  const samples = [
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo126/v4/4c/76/90/4c7690a2-25e2-8e36-53d3-703a95d7f1d4/mzaf_15783300588669528743.plus.aac.p.m4a',
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo125/v4/0c/33/c0/0c33c09b-1b03-f390-3bbd-c6a6552a48ea/mzaf_10334882194935406798.plus.aac.p.m4a',
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioVideo115/v4/80/7e/ea/807eeaec-87d4-e6ed-3b7c-f8319e7bc445/mzaf_16480376170668902507.plus.aac.p.m4a',
  ];
  const hash = Math.abs(title.length + artist.length);
  return samples[hash % samples.length];
}
