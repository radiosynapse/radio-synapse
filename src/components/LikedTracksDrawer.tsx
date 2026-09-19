import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  ExternalLink, 
  X, 
  Sparkles, 
  Music2, 
  Search,
  Share2,
  Key
} from 'lucide-react';
import { LikedTrack, ConnectedAccount } from '../types';
import Drawer from './Drawer';
import { MarqueeText } from './MarqueeText';
import DoubleHeartIcon from './DoubleHeartIcon';
import TrackShareModal from './TrackShareModal';

interface LikedTracksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  likedTracks: LikedTrack[];
  onRemoveTrack: (id: string) => void;
  onUpdateTrackLevel?: (id: string, newLevel: 1 | 2) => void;
  connectedAccount?: ConnectedAccount | null;
  onOpenConnectModal: () => void;
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
}: LikedTracksDrawerProps) {
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShareTrack, setSelectedShareTrack] = useState<LikedTrack | null>(null);
  const [filterLevel, setFilterLevel] = useState<'all' | 'level2' | 'level1'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        
        {/* Account status info banner */}
        {connectedAccount ? (
          <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-zinc-950/90 border border-white/10 shadow-lg text-left flex-wrap gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-white/10 text-cyan-400 border border-white/15">
                <Key className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white truncate font-futuristic">
                  Compte connecté : {connectedAccount.username || connectedAccount.email}
                </span>
                <span className="text-[10.5px] font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Synchronisation cloud chiffrée active
                </span>
              </div>
            </div>

            <button
              onClick={onOpenConnectModal}
              className="text-xs font-mono text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 transition-colors cursor-pointer"
            >
              Gérer mon profil
            </button>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-zinc-900/90 border border-zinc-700 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white flex-shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 animate-pulse text-zinc-200" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm font-semibold text-white leading-snug">
                  Créez un compte avec Passkey ou e-mail pour sauvegarder vos coups de cœur.
                </span>
                <span className="text-[11px] text-zinc-400 font-mono mt-1">
                  Synchronisation sécurisée sur tous vos appareils en temps réel.
                </span>
              </div>
            </div>

            <button
              onClick={onOpenConnectModal}
              className="flex-shrink-0 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4" />
              <span>Connexion / Inscription</span>
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
                      ? 'bg-white text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Tous ({likedTracks.length})
                </button>
                <button
                  onClick={() => setFilterLevel('level2')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterLevel === 'level2'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-pink-300'
                  }`}
                >
                  <DoubleHeartIcon level={2} sizeClassName="w-3.5 h-3.5" />
                  <span>Ultra ({level2Count})</span>
                </button>
                <button
                  onClick={() => setFilterLevel('level1')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterLevel === 'level1'
                      ? 'bg-pink-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-pink-300'
                  }`}
                >
                  <DoubleHeartIcon level={1} sizeClassName="w-3.5 h-3.5" />
                  <span>Coup de cœur ({level1Count})</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrer par titre, artiste..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono placeholder:text-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tracks List */}
        {likedTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="p-4 rounded-full bg-white/5 border border-white/10 text-zinc-400 mb-4">
              <Music2 className="w-8 h-8 opacity-40" />
            </div>
            <h3 className="text-sm font-bold text-white font-futuristic uppercase tracking-wider mb-1">
              Aucun titre liké pour le moment
            </h3>
            <p className="text-xs font-mono text-zinc-400 max-w-xs leading-relaxed">
              Cliquez ou maintenez le bouton Cœur pendant la diffusion d'un titre pour l'ajouter à vos coups de cœur.
            </p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-zinc-400">
            Aucun morceau ne correspond à votre recherche "{searchQuery}".
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredTracks.map((track) => (
              <LikedTrackRow
                key={track.id}
                track={track}
                isPlayingPreview={playingPreviewId === track.id}
                onTogglePreview={() => handleTogglePreview(track)}
                onRemove={() => onRemoveTrack(track.id)}
                onUpdateLevel={onUpdateTrackLevel ? (lvl) => onUpdateTrackLevel(track.id, lvl) : undefined}
                onOpenShare={() => handleOpenShareSmartLink(track)}
              />
            ))}
          </div>
        )}

      </div>

      {/* Track Share Smart Link Modal */}
      {selectedShareTrack && (
        <TrackShareModal
          isOpen={!!selectedShareTrack}
          onClose={() => setSelectedShareTrack(null)}
          track={selectedShareTrack}
        />
      )}
    </Drawer>
  );
}

// Sub-component for each individual liked track card
interface LikedTrackRowProps {
  track: LikedTrack;
  isPlayingPreview: boolean;
  onTogglePreview: () => void;
  onRemove: () => void;
  onUpdateLevel?: (newLevel: 1 | 2) => void;
  onOpenShare: () => void;
}

function LikedTrackRow({
  track,
  isPlayingPreview,
  onTogglePreview,
  onRemove,
  onUpdateLevel,
  onOpenShare,
}: LikedTrackRowProps) {
  const currentLevel = track.level || 1;

  const handleCycleLevel = () => {
    if (!onUpdateLevel) return;
    const nextLevel = currentLevel === 1 ? 2 : 1;
    onUpdateLevel(nextLevel);
  };

  return (
    <div 
      className={`p-3 sm:p-3.5 rounded-2xl bg-zinc-950 border transition-all flex flex-col gap-3 group relative overflow-hidden ${
        currentLevel === 2 
          ? 'border-pink-500/40 shadow-[0_0_15px_rgba(255,0,160,0.15)] bg-gradient-to-r from-pink-950/20 via-zinc-950 to-purple-950/20' 
          : 'border-white/10 hover:border-white/25'
      }`}
    >
      {/* Top Main Row */}
      <div className="flex items-center justify-between gap-3">
        
        {/* Cover + Play Preview Trigger */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-900 border border-white/15">
          <img
            src={track.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80'}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <button
            onClick={onTogglePreview}
            className={`absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all cursor-pointer ${
              isPlayingPreview ? 'opacity-100 bg-pink-600/40' : 'opacity-0 group-hover:opacity-100'
            }`}
            title={isPlayingPreview ? 'Arrêter l\'extrait' : 'Écouter un extrait de 30s'}
            aria-label="Écouter un extrait"
          >
            {isPlayingPreview ? (
              <div className="flex items-end gap-0.5 h-4">
                <span className="w-1 bg-pink-400 animate-bounce h-3 rounded-full" />
                <span className="w-1 bg-pink-300 animate-bounce h-4 rounded-full" />
                <span className="w-1 bg-pink-400 animate-bounce h-2 rounded-full" />
              </div>
            ) : (
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col text-left">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              {track.stationName || 'RADIO SYNAPSE'}
            </span>
            {track.album && (
              <>
                <span className="text-zinc-600 text-[10px]">•</span>
                <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[120px]">
                  {track.album}
                </span>
              </>
            )}
          </div>

          <MarqueeText
            text={track.title}
            className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider block font-futuristic"
          />
          <MarqueeText
            text={track.artist}
            className="text-xs text-pink-400 font-bold uppercase tracking-wider block mt-0.5 font-mono"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          
          {/* Level Toggle Button */}
          <button
            onClick={handleCycleLevel}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
              currentLevel === 2
                ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 shadow-sm'
                : 'bg-white/5 border-white/10 hover:border-white/30 text-zinc-400 hover:text-pink-300'
            }`}
            title={currentLevel === 2 ? 'Coup de cœur Ultra (cliquer pour rétrograder)' : 'Coup de cœur Standard (cliquer pour Ultra)'}
            aria-label="Changer le niveau de favori"
          >
            <DoubleHeartIcon level={currentLevel} sizeClassName="w-4 h-4" />
          </button>

          {/* Share Smart Link Button */}
          <button
            onClick={onOpenShare}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Partager le smart link multi-plateformes"
            aria-label="Partager le titre"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Remove Button */}
          <button
            onClick={onRemove}
            className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
            title="Supprimer des coups de cœur"
            aria-label="Supprimer le titre"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Multi-link Streaming Buttons (Deezer, Apple Music, YouTube Music, Web Search) */}
      <div className="pt-2.5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {/* Deezer */}
        <a
          href={track.deezerUrl || `https://www.deezer.com/search/${encodeURIComponent(track.title + ' ' + track.artist)}`}
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
          <ExternalLink className="w-3 h-3 text-zinc-400 group-hover/link:text-pink-400 flex-shrink-0" />
        </a>

        {/* Apple Music */}
        <a
          href={track.appleMusicUrl || `https://music.apple.com/search?term=${encodeURIComponent(track.title + ' ' + track.artist)}`}
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
              Apple Music
            </span>
          </div>
          <ExternalLink className="w-3 h-3 text-zinc-400 group-hover/link:text-red-400 flex-shrink-0" />
        </a>

        {/* YouTube Music */}
        <a
          href={track.youtubeUrl || `https://music.youtube.com/search?q=${encodeURIComponent(track.title + ' ' + track.artist)}`}
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
          <ExternalLink className="w-3 h-3 text-zinc-400 group-hover/link:text-red-400 flex-shrink-0" />
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
