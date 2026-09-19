import React, { useState, useEffect, useRef } from 'react';
import { 
  ListMusic, Plus, Trash2, Edit3, X, Clock, Play, Pause,
  Shield, Calendar, ArrowUp, ArrowDown, Search, Check,
  Disc3, Music
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser } from '../types';
import { 
  PlaylistEntry, PlaylistRotationType, getStationPlaylists, 
  addStationPlaylist, updateStationPlaylist, deleteStationPlaylist,
  addTrackToPlaylist, removeTrackFromPlaylist, reorderPlaylistTracks
} from '../utils/playlistsStore';
import { 
  LibraryTrack, getMusicLibraryTracks, getMusicFolders 
} from '../utils/musicLibraryStore';
import { isSuperAdmin, getUserAssignedStations } from '../utils/adminRolePermissionsStore';

interface AdminPlaylistsViewProps {
  stations: StreamChannel[];
  activeStation: StreamChannel;
  currentUser: SynapseUser | null;
  onSelectStation?: (station: StreamChannel) => void;
  showToast: (msg: string) => void;
}

export const AdminPlaylistsView: React.FC<AdminPlaylistsViewProps> = ({
  stations,
  activeStation,
  currentUser,
  showToast,
}) => {
  const isSuper = isSuperAdmin(currentUser);
  const accessibleStations = getUserAssignedStations(currentUser, stations);
  const canSwitch = isSuper || accessibleStations.length > 1;

  const [stationFilter, setStationFilter] = useState<string>(
    isSuper ? 'all' : (accessibleStations[0]?.id || activeStation.id)
  );

  const [playlists, setPlaylists] = useState<PlaylistEntry[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([]);
  
  // Selected Playlist for Inspection / Drill-Down View
  const [inspectedPlaylistId, setInspectedPlaylistId] = useState<string | null>(null);

  // Modal for Edit Playlist Settings
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistEntry | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaylistRotationType>('heavy_rotation');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#06b6d4');
  const [repeatIntervalHours, setRepeatIntervalHours] = useState(2);
  const [weight, setWeight] = useState(8);
  const [targetStationId, setTargetStationId] = useState(activeStation.id);
  const [isFallbackAutoDj, setIsFallbackAutoDj] = useState(true);
  const [fallbackPriority, setFallbackPriority] = useState<number>(1);
  const [fallbackPlayMode, setFallbackPlayMode] = useState<'shuffle' | 'sequential' | 'weighted'>('weighted');

  // Library picker search in drill-down
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryFolderFilter, setLibraryFolderFilter] = useState('all');

  // Audio Preview State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const reloadData = () => {
    const list = getStationPlaylists(stationFilter);
    setPlaylists(list);
    const lib = getMusicLibraryTracks('all');
    setLibraryTracks(lib);
  };

  useEffect(() => {
    reloadData();
  }, [stationFilter]);

  // Audio preview cleanup
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, []);

  const handleTogglePreview = (track: LibraryTrack) => {
    if (playingTrackId === track.id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(track.audioUrl);
      audio.play().catch(() => {
        showToast('Impossible de lire cet aperçu audio');
      });
      audio.onended = () => setPlayingTrackId(null);
      audioPreviewRef.current = audio;
      setPlayingTrackId(track.id);
    }
  };

  const handleOpenCreate = () => {
    setEditingPlaylist(null);
    setName('');
    setType('heavy_rotation');
    setDescription('');
    setColor('#06b6d4');
    setRepeatIntervalHours(2);
    setWeight(8);
    setTargetStationId(stationFilter === 'all' ? (accessibleStations[0]?.id || 'pop-variete') : stationFilter);
    setIsFallbackAutoDj(true);
    setFallbackPriority(1);
    setFallbackPlayMode('weighted');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, pl: PlaylistEntry) => {
    e.stopPropagation(); // Avoid triggering card inspect
    setEditingPlaylist(pl);
    setName(pl.name);
    setType(pl.type);
    setDescription(pl.description);
    setColor(pl.color);
    setRepeatIntervalHours(pl.repeatIntervalHours);
    setWeight(pl.weight);
    setTargetStationId(pl.stationId);
    setIsFallbackAutoDj(pl.isFallbackAutoDj !== false);
    setFallbackPriority(pl.fallbackPriority || 1);
    setFallbackPlayMode(pl.fallbackPlayMode || 'weighted');
    setIsModalOpen(true);
  };

  const handleSavePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingPlaylist) {
      updateStationPlaylist(editingPlaylist.id, {
        name,
        type,
        description,
        color,
        repeatIntervalHours: Number(repeatIntervalHours),
        weight: Number(weight),
        stationId: targetStationId,
        isFallbackAutoDj,
        fallbackPriority: Number(fallbackPriority),
        fallbackPlayMode,
      });
      showToast(`Playlist "${name}" mise à jour`);
    } else {
      const newPl = addStationPlaylist({
        name,
        type,
        description,
        color,
        repeatIntervalHours: Number(repeatIntervalHours),
        weight: Number(weight),
        stationId: targetStationId,
        trackIds: [],
        isActive: true,
        isFallbackAutoDj,
        fallbackPriority: Number(fallbackPriority),
        fallbackPlayMode,
      });
      showToast(`Playlist "${name}" créée avec succès`);
      setInspectedPlaylistId(newPl.id); // Open inspection directly
    }

    setIsModalOpen(false);
    setEditingPlaylist(null);
    reloadData();
  };

  const handleDelete = (e: React.MouseEvent, id: string, plName: string) => {
    e.stopPropagation();
    if (confirm(`Supprimer la playlist "${plName}" ?`)) {
      deleteStationPlaylist(id);
      if (inspectedPlaylistId === id) setInspectedPlaylistId(null);
      reloadData();
      showToast(`Playlist "${plName}" supprimée`);
    }
  };

  // Track manipulation in current inspected playlist
  const inspectedPlaylist = playlists.find(p => p.id === inspectedPlaylistId) || null;

  const handleAddTrack = (trackId: string, trackTitle: string) => {
    if (!inspectedPlaylistId) return;
    addTrackToPlaylist(inspectedPlaylistId, trackId);
    reloadData();
    showToast(`"${trackTitle}" ajouté à la playlist`);
  };

  const handleRemoveTrack = (trackId: string, trackTitle: string) => {
    if (!inspectedPlaylistId) return;
    removeTrackFromPlaylist(inspectedPlaylistId, trackId);
    reloadData();
    showToast(`"${trackTitle}" retiré de la playlist`);
  };

  const handleMoveTrack = (index: number, direction: 'up' | 'down') => {
    if (!inspectedPlaylist) return;
    const newTrackIds = [...inspectedPlaylist.trackIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTrackIds.length) return;

    const temp = newTrackIds[index];
    newTrackIds[index] = newTrackIds[targetIndex];
    newTrackIds[targetIndex] = temp;

    reorderPlaylistTracks(inspectedPlaylist.id, newTrackIds);
    reloadData();
  };

  const handleUpdateFallbackSettings = (updates: Partial<PlaylistEntry>) => {
    if (!inspectedPlaylist) return;
    updateStationPlaylist(inspectedPlaylist.id, updates);
    reloadData();
    showToast('Paramètres du flux continu de secours mis à jour');
  };

  const getRotationBadge = (rotType: PlaylistRotationType) => {
    switch (rotType) {
      case 'heavy_rotation':
        return { label: 'Forte Rotation (Heavy)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      case 'medium_rotation':
        return { label: 'Moyenne Rotation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'soft_rotation':
        return { label: 'Rotation Douce / Découverte', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'gold_classics':
        return { label: 'Gold & Incontournables', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'night_lounge':
        return { label: 'Nocturne / Chill', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      default:
        return { label: 'Thématique Spéciale', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const folders = getMusicFolders('all');

  return (
    <div className="flex flex-col w-full min-w-0">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ListMusic className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
            <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
              Gestion des Playlists & Rotations ({playlists.length})
            </h2>
          </div>
        </div>

        {/* STATION SWITCHER & CREATE BUTTON */}
        <div className="flex items-center gap-2">
          {canSwitch ? (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 pl-2 font-bold hidden sm:inline">Radio :</span>
              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-750 text-white text-xs font-mono font-bold focus:border-amber-400 focus:outline-none cursor-pointer"
              >
                {isSuper && <option value="all">🌐 Toutes les Radios</option>}
                {accessibleStations.map((st) => (
                  <option key={st.id} value={st.id}>
                    📻 {st.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeStation.color || '#00f2ff' }} />
              <span className="text-xs font-mono font-bold text-white">
                {activeStation.name}
              </span>
            </div>
          )}

          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Playlist</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 text-left">
        {/* EXPLANATORY ARCHITECTURAL BANNER: AGENDA vs FALLBACK STREAM */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-futuristic font-bold text-white uppercase tracking-wider">
                  Logique de Diffusion à l'Antenne
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                  Priorité Agenda ➔ Secours Continu
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-300 max-w-3xl leading-relaxed">
                <strong className="text-white">1. Priorité programmée (Agenda) :</strong> C'est l'ordre et les créneaux définis dans l'Agenda de programmation qui fixent quelle playlist ou émission est diffusée à chaque heure précise.<br />
                <strong className="text-amber-400">2. Flux continu de secours (Auto-DJ) :</strong> Les règles, rotations et poids configurés ici dans cette section prennent immédiatement et automatiquement le relais en cas d'interruption du direct ou dès qu'aucun créneau n'est planifié dans l'agenda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Agenda : Actif</span>
            </div>
          </div>
        </div>

        {/* MODAL CREATION / EDITION PLAYLIST SETTINGS */}
        {isModalOpen && (
          <form onSubmit={handleSavePlaylist} className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border border-amber-500/40 flex flex-col gap-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-futuristic font-bold text-white uppercase flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-amber-400" />
                {editingPlaylist ? `Paramètres de la Playlist : ${editingPlaylist.name}` : 'Création d\'une Nouvelle Playlist'}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Nom de la Playlist *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Top Hits & Nouveautés Pop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Type de Rotation</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PlaylistRotationType)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value="heavy_rotation">Forte Rotation (Heavy)</option>
                  <option value="medium_rotation">Moyenne Rotation (Medium)</option>
                  <option value="soft_rotation">Rotation Douce (Soft / Découverte)</option>
                  <option value="gold_classics">Gold & Incontournables</option>
                  <option value="night_lounge">Nocturne / Chill</option>
                  <option value="special_theme">Thématique Spéciale</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Fréquence de Répétition Secours</label>
                <select
                  value={repeatIntervalHours}
                  onChange={(e) => setRepeatIntervalHours(Number(e.target.value))}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value={1}>Toutes les 1 heure</option>
                  <option value={2}>Toutes les 2 heures</option>
                  <option value={4}>Toutes les 4 heures</option>
                  <option value={8}>Toutes les 8 heures</option>
                  <option value={24}>1 fois par jour</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Couleur Repère</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-9 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Poids Auto-DJ (1-10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Radio Assignée</label>
                <select
                  value={targetStationId}
                  onChange={(e) => setTargetStationId(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value="all">🌐 Toutes les Radios</option>
                  {accessibleStations.map((st) => (
                    <option key={st.id} value={st.id}>
                      📻 {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* FALLBACK CONTINUOUS STREAM RULES */}
              <div className="sm:col-span-2 lg:col-span-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="fallbackCheckbox"
                    checked={isFallbackAutoDj}
                    onChange={(e) => setIsFallbackAutoDj(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-zinc-900 border-zinc-700 cursor-pointer"
                  />
                  <label htmlFor="fallbackCheckbox" className="text-xs font-mono font-bold text-white cursor-pointer">
                    Activer dans le flux continu de secours (Auto-DJ secours si agenda inactif)
                  </label>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">Priorité :</span>
                    <select
                      value={fallbackPriority}
                      onChange={(e) => setFallbackPriority(Number(e.target.value))}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs font-mono cursor-pointer"
                    >
                      <option value={1}>#1 (Haute priorité / Hits)</option>
                      <option value={2}>#2 (Moyenne / Gold)</option>
                      <option value={3}>#3 (Lounge / Nuit)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">Mode :</span>
                    <select
                      value={fallbackPlayMode}
                      onChange={(e) => setFallbackPlayMode(e.target.value as any)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs font-mono cursor-pointer"
                    >
                      <option value="weighted">Pondéré par poids</option>
                      <option value="shuffle">Aléatoire (Shuffle)</option>
                      <option value="sequential">Ordre séquentiel</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Description de la règle</label>
                <input
                  type="text"
                  placeholder="ex: Titres vedettes diffusés avec haute priorité en rotation principale"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-mono cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {editingPlaylist ? 'Enregistrer les Réglages' : 'Créer et Ouvrir la Playlist'}
              </button>
            </div>
          </form>
        )}

        {/* DRILL-DOWN INSPECTION DRAWER / MODAL: VIEW & MANAGE TRACKS INSIDE PLAYLIST */}
        {inspectedPlaylist && (
          <div className="p-5 sm:p-6 lg:p-8 rounded-3xl bg-zinc-900 border-2 border-amber-500/50 shadow-2xl flex flex-col gap-6 animate-in fade-in duration-200">
            {/* INSPECTION HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-black font-black text-xl shadow-lg shrink-0"
                     style={{ backgroundColor: inspectedPlaylist.color || '#06b6d4' }}>
                  <ListMusic className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg sm:text-xl font-futuristic font-black tracking-wide text-white">
                      {inspectedPlaylist.name}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase ${getRotationBadge(inspectedPlaylist.type).color}`}>
                      {getRotationBadge(inspectedPlaylist.type).label}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">
                    {inspectedPlaylist.trackIds.length} morceaux • Durée cumulée : {
                      (() => {
                        const totalSec = inspectedPlaylist.trackIds.reduce((acc, id) => {
                          const t = libraryTracks.find(item => item.id === id);
                          return acc + (t ? t.duration : 0);
                        }, 0);
                        return `${Math.floor(totalSec / 60)} min ${totalSec % 60} s`;
                      })()
                    }
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleOpenEdit(e, inspectedPlaylist)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Réglages Playlist</span>
                </button>
                <button
                  onClick={() => setInspectedPlaylistId(null)}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Fermer la vue détaillée"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FALLBACK STREAM PARAMETERS QUICK BAR */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Shield className={`w-5 h-5 ${inspectedPlaylist.isFallbackAutoDj !== false ? 'text-amber-400' : 'text-zinc-600'}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                    Flux Continu de Secours (Auto-DJ) :
                    <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      inspectedPlaylist.isFallbackAutoDj !== false ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {inspectedPlaylist.isFallbackAutoDj !== false ? 'ACTIF (Prend le relais si pas d\'agenda)' : 'INACTIF'}
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Répétition : toutes les {inspectedPlaylist.repeatIntervalHours}h • Priorité de secours : #{inspectedPlaylist.fallbackPriority || 1} • Mode : {inspectedPlaylist.fallbackPlayMode || 'Pondéré'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateFallbackSettings({ isFallbackAutoDj: !(inspectedPlaylist.isFallbackAutoDj !== false) })}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    inspectedPlaylist.isFallbackAutoDj !== false
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {inspectedPlaylist.isFallbackAutoDj !== false ? 'Désactiver secours' : 'Activer pour le secours'}
                </button>
              </div>
            </div>

            {/* 2-COLUMN VIEW: LEFT = TRACKS IN PLAYLIST, RIGHT = PICK FROM LIBRARY */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT COLUMN: TRACKS INSIDE PLAYLIST (7 COLS) */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-cyan-400" />
                    Titres dans la Playlist ({inspectedPlaylist.trackIds.length})
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Utilisez les flèches pour réordonner
                  </span>
                </div>

                {inspectedPlaylist.trackIds.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 text-center flex flex-col items-center justify-center gap-2">
                    <Disc3 className="w-8 h-8 text-zinc-600 animate-spin-slow" />
                    <span className="text-xs font-mono font-bold text-zinc-300">
                      Cette playlist est actuellement vide.
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">
                      Piochez des morceaux dans le panneau de droite pour composer votre sélection.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                    {inspectedPlaylist.trackIds.map((trackId, index) => {
                      const track = libraryTracks.find(t => t.id === trackId);
                      const isPlaying = playingTrackId === trackId;

                      if (!track) {
                        return (
                          <div key={trackId} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-500">
                            <span>Titre introuvable (ID: {trackId})</span>
                            <button
                              onClick={() => handleRemoveTrack(trackId, trackId)}
                              className="text-rose-400 hover:text-rose-300 cursor-pointer"
                            >
                              Retirer
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${track.id}_${index}`}
                          className="p-3 rounded-2xl bg-zinc-950 border border-zinc-850 hover:border-zinc-700 flex items-center justify-between gap-3 group transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* POSITION BADGE */}
                            <span className="w-6 text-center font-mono font-bold text-xs text-zinc-500">
                              #{index + 1}
                            </span>

                            {/* COVER & PREVIEW BUTTON */}
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 group">
                              {track.coverUrl ? (
                                <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                              ) : (
                                <Disc3 className="w-5 h-5 text-zinc-700 m-auto mt-3" />
                              )}
                              <button
                                type="button"
                                onClick={() => handleTogglePreview(track)}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                              >
                                {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                              </button>
                            </div>

                            {/* TRACK DETAILS */}
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-white truncate group-hover:text-amber-400 transition-colors" title={track.title}>
                                {track.title}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400 truncate" title={track.artist}>
                                {track.artist}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {track.genre} • {track.bpm} BPM • {formatDuration(track.duration)}
                              </span>
                            </div>
                          </div>

                          {/* REORDER & REMOVE ACTIONS */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              disabled={index === 0}
                              onClick={() => handleMoveTrack(index, 'up')}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                index === 0
                                  ? 'opacity-30 border-transparent text-zinc-600 cursor-not-allowed'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                              }`}
                              title="Monter d'une position"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              disabled={index === inspectedPlaylist.trackIds.length - 1}
                              onClick={() => handleMoveTrack(index, 'down')}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                index === inspectedPlaylist.trackIds.length - 1
                                  ? 'opacity-30 border-transparent text-zinc-600 cursor-not-allowed'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                              }`}
                              title="Descendre d'une position"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleRemoveTrack(track.id, track.title)}
                              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-rose-950/60 hover:text-rose-400 transition-all cursor-pointer"
                              title="Retirer de la playlist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: PICK FROM MUSIC LIBRARY (5 COLS) */}
              <div className="lg:col-span-5 flex flex-col gap-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-850">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Piocher dans la Bibliothèque
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {libraryTracks.length} titres dispo
                  </span>
                </div>

                {/* SEARCH IN LIBRARY */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Rechercher titre, artiste..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* FOLDER FILTER */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button
                    onClick={() => setLibraryFolderFilter('all')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold whitespace-nowrap cursor-pointer transition-all ${
                      libraryFolderFilter === 'all'
                        ? 'bg-amber-500 text-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Tous
                  </button>
                  {folders.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setLibraryFolderFilter(f.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1 ${
                        libraryFolderFilter === f.id
                          ? 'bg-zinc-800 text-white ring-1 ring-cyan-400'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }} />
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>

                {/* AVAILABLE TRACKS LIST */}
                <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                  {libraryTracks
                    .filter((t) => {
                      const matchesSearch = 
                        t.title.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
                        t.artist.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
                        t.genre.toLowerCase().includes(librarySearchQuery.toLowerCase());
                      const matchesFolder = libraryFolderFilter === 'all' || t.folderId === libraryFolderFilter;
                      return matchesSearch && matchesFolder;
                    })
                    .map((track) => {
                      const isAlreadyIn = inspectedPlaylist.trackIds.includes(track.id);
                      const isPlaying = playingTrackId === track.id;

                      return (
                        <div
                          key={track.id}
                          className="p-2 rounded-xl bg-zinc-900 border border-zinc-850 hover:border-zinc-750 flex items-center justify-between gap-2 group transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                              {track.coverUrl ? (
                                <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                              ) : (
                                <Disc3 className="w-4 h-4 text-zinc-700 m-auto mt-2" />
                              )}
                              <button
                                type="button"
                                onClick={() => handleTogglePreview(track)}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                              >
                                {isPlaying ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                              </button>
                            </div>

                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold text-white truncate" title={track.title}>
                                {track.title}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 truncate" title={track.artist}>
                                {track.artist}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isAlreadyIn ? (
                              <span className="px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span className="hidden sm:inline">Inclus</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddTrack(track.id, track.title)}
                                className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Ajouter</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PLAYLISTS CARDS GRID (CLICKABLE CARDS) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
              Vos Playlists Configurées (Cliquez sur une carte pour gérer ses titres)
            </span>
            <span className="text-xs font-mono text-zinc-500">
              {playlists.length} playlists actives
            </span>
          </div>

          {playlists.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-950/60 border border-zinc-850 text-center flex flex-col items-center justify-center gap-3">
              <ListMusic className="w-8 h-8 text-zinc-600" />
              <div className="text-sm font-futuristic text-zinc-300">Aucune playlist configurée</div>
              <p className="text-xs font-mono text-zinc-500 max-w-md">
                Créez votre première rotation musicale en cliquant sur le bouton « Nouvelle Playlist » ci-dessus.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((pl) => {
              const rot = getRotationBadge(pl.type);
              const stationObj = stations.find(s => s.id === pl.stationId);
              const isSelected = inspectedPlaylistId === pl.id;

              // Calculate total tracks duration
              const totalSec = pl.trackIds.reduce((acc, id) => {
                const t = libraryTracks.find(item => item.id === id);
                return acc + (t ? t.duration : 0);
              }, 0);

              // Gather up to 3 covers for visual collage
              const sampleCovers = pl.trackIds
                .map(id => libraryTracks.find(t => t.id === id)?.coverUrl)
                .filter(Boolean)
                .slice(0, 3) as string[];

              return (
                <div
                  key={pl.id}
                  onClick={() => setInspectedPlaylistId(isSelected ? null : pl.id)}
                  className={`p-5 rounded-2xl transition-all shadow-md group cursor-pointer flex flex-col justify-between gap-4 border ${
                    isSelected
                      ? 'bg-zinc-900 border-amber-500 ring-2 ring-amber-400/40 shadow-xl'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    {/* TOP LINE: COLOR BADGE + ROTATION + AUTO-DJ BADGE */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: pl.color || '#06b6d4' }} />
                        <span className="text-base font-futuristic font-black tracking-wide text-white line-clamp-1 group-hover:text-amber-400 transition-colors">
                          {pl.name}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-amber-400 shrink-0">
                        {pl.trackIds.length} titres
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase ${rot.color}`}>
                        {rot.label}
                      </span>
                      {pl.isFallbackAutoDj !== false ? (
                        <span className="px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Secours : P#{pl.fallbackPriority || 1}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 text-[10px] font-mono font-bold">
                          Secours : Désactivé
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-zinc-400 line-clamp-2">
                      {pl.description || 'Aucune consigne spécifique programmée.'}
                    </p>

                    {/* COVERS PREVIEW STACK */}
                    {sampleCovers.length > 0 && (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="text-[10px] font-mono text-zinc-500 mr-1">Extrait :</span>
                        <div className="flex -space-x-2 overflow-hidden">
                          {sampleCovers.map((c, i) => (
                            <img
                              key={i}
                              src={c}
                              alt="Track cover"
                              className="inline-block h-7 w-7 rounded-lg ring-2 ring-zinc-950 object-cover"
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 ml-2">
                          ~ {Math.floor(totalSec / 60)} min
                        </span>
                      </div>
                    )}

                    {/* REPETITION & RADIO */}
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-850 flex items-center justify-between text-xs font-mono text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        Répétition :
                      </span>
                      <span className="font-bold text-zinc-200">
                        Toutes les {pl.repeatIntervalHours}h
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1">
                      <span>Radio liée :</span>
                      <span className="text-zinc-300 font-bold">
                        {pl.stationId === 'all' ? '🌐 Global' : (stationObj?.name || pl.stationId)}
                      </span>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-850">
                    <span className="text-[11px] font-mono font-bold text-cyan-400 group-hover:text-cyan-300 flex items-center gap-1">
                      <span>{isSelected ? 'Masquer détails ▲' : 'Gérer les titres ▼'}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleOpenEdit(e, pl)}
                        className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
                        title="Paramètres de la playlist"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, pl.id, pl.name)}
                        className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-all cursor-pointer"
                        title="Supprimer la playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPlaylistsView;
