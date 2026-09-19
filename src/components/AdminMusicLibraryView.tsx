import React, { useState, useEffect, useRef } from 'react';
import { 
  Music, Plus, Search, Trash2, Edit3, Play, Pause, X,
  Folder, FolderPlus, Upload, LayoutGrid, List, Layers,
  Disc3, Image as ImageIcon
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser } from '../types';
import { 
  LibraryTrack, MusicFolder, getMusicLibraryTracks, addMusicTrack, 
  updateMusicTrack, deleteMusicTrack, getMusicFolders, 
  addMusicFolder, updateMusicFolder, deleteMusicFolder
} from '../utils/musicLibraryStore';
import { isSuperAdmin, getUserAssignedStations } from '../utils/adminRolePermissionsStore';

interface AdminMusicLibraryViewProps {
  stations: StreamChannel[];
  activeStation: StreamChannel;
  currentUser: SynapseUser | null;
  onSelectStation?: (station: StreamChannel) => void;
  showToast: (msg: string) => void;
}

type LibraryViewMode = 'grid' | 'list' | 'explorer';

export const AdminMusicLibraryView: React.FC<AdminMusicLibraryViewProps> = ({
  stations,
  activeStation,
  currentUser,
  showToast,
}) => {
  const isSuper = isSuperAdmin(currentUser);
  const accessibleStations = getUserAssignedStations(currentUser, stations);
  const canSwitch = isSuper || accessibleStations.length > 1;

  // Selected station filter
  const [stationFilter, setStationFilter] = useState<string>(
    isSuper ? 'all' : (accessibleStations[0]?.id || activeStation.id)
  );

  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [folders, setFolders] = useState<MusicFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all'); // 'all', 'none', or folder.id

  // View Mode: 'grid' (Grandes pochettes), 'list' (Tableau), 'explorer' (Dossiers + contenu)
  const [viewMode, setViewMode] = useState<LibraryViewMode>('grid');

  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [energyFilter, setEnergyFilter] = useState('all');

  // Track Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<LibraryTrack | null>(null);

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  // Folder Create/Edit Modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<MusicFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#06b6d4');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderStationId, setFolderStationId] = useState('all');

  // Audio Preview State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Form inputs for Track Edit/Create
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [duration, setDuration] = useState(210);
  const [genre, setGenre] = useState('Pop / Hits');
  const [bpm, setBpm] = useState(120);
  const [year, setYear] = useState(2025);
  const [energyLevel, setEnergyLevel] = useState<'calm' | 'medium' | 'high' | 'peak'>('high');
  const [audioUrl, setAudioUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [trackFolderId, setTrackFolderId] = useState<string>('none');
  const [targetStationId, setTargetStationId] = useState('all');
  const [cueIn, setCueIn] = useState<number>(0);
  const [cueOut, setCueOut] = useState<number>(0);

  // Reload data
  const reloadData = () => {
    const list = getMusicLibraryTracks(stationFilter);
    setTracks(list);
    const fList = getMusicFolders(stationFilter);
    setFolders(fList);
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

  // Folder CRUD handlers
  const handleOpenCreateFolder = () => {
    setEditingFolder(null);
    setFolderName('');
    setFolderColor('#06b6d4');
    setFolderDesc('');
    setFolderStationId(stationFilter === 'all' ? (accessibleStations[0]?.id || 'pop-variete') : stationFilter);
    setIsFolderModalOpen(true);
  };

  const handleOpenEditFolder = (f: MusicFolder) => {
    setEditingFolder(f);
    setFolderName(f.name);
    setFolderColor(f.color);
    setFolderDesc(f.description || '');
    setFolderStationId(f.stationId || 'all');
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    if (editingFolder) {
      updateMusicFolder(editingFolder.id, {
        name: folderName,
        color: folderColor,
        description: folderDesc,
        stationId: folderStationId,
      });
      showToast(`Dossier "${folderName}" mis à jour`);
    } else {
      addMusicFolder({
        name: folderName,
        color: folderColor,
        description: folderDesc,
        stationId: folderStationId,
      });
      showToast(`Dossier "${folderName}" créé avec succès`);
    }

    setIsFolderModalOpen(false);
    reloadData();
  };

  const handleDeleteFolder = (id: string, name: string) => {
    if (confirm(`Supprimer le dossier "${name}" ? Les titres qu'il contient ne seront pas supprimés mais placés à la racine.`)) {
      deleteMusicFolder(id);
      if (selectedFolderId === id) setSelectedFolderId('all');
      reloadData();
      showToast(`Dossier "${name}" supprimé`);
    }
  };

  // Track CRUD handlers
  const handleOpenCreateTrack = () => {
    setEditingTrack(null);
    setTitle('');
    setArtist('');
    setAlbum('');
    setDuration(210);
    setGenre('Pop / Hits');
    setBpm(120);
    setYear(2025);
    setEnergyLevel('high');
    setAudioUrl('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3');
    setCoverUrl('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop');
    setTrackFolderId(selectedFolderId !== 'all' && selectedFolderId !== 'none' ? selectedFolderId : (folders[0]?.id || 'none'));
    setTargetStationId(stationFilter === 'all' ? (accessibleStations[0]?.id || 'pop-variete') : stationFilter);
    setCueIn(0);
    setCueOut(0);
    setIsModalOpen(true);
  };

  const handleOpenEditTrack = (t: LibraryTrack) => {
    setEditingTrack(t);
    setTitle(t.title);
    setArtist(t.artist);
    setAlbum(t.album);
    setDuration(t.duration);
    setGenre(t.genre);
    setBpm(t.bpm);
    setYear(t.year || 2025);
    setEnergyLevel(t.energyLevel || 'medium');
    setAudioUrl(t.audioUrl);
    setCoverUrl(t.coverUrl || '');
    setTrackFolderId(t.folderId || 'none');
    setTargetStationId(t.stationId);
    setCueIn(t.cueIn || 0);
    setCueOut(t.cueOut || 0);
    setIsModalOpen(true);
  };

  const handleSaveTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;

    const assignedFolder = trackFolderId === 'none' ? undefined : trackFolderId;

    if (editingTrack) {
      updateMusicTrack(editingTrack.id, {
        title,
        artist,
        album,
        duration: Number(duration),
        genre,
        bpm: Number(bpm),
        year: Number(year),
        energyLevel,
        audioUrl: audioUrl || editingTrack.audioUrl,
        coverUrl: coverUrl || editingTrack.coverUrl,
        folderId: assignedFolder,
        stationId: targetStationId,
        cueIn: Number(cueIn),
        cueOut: Number(cueOut),
      });
      showToast(`Titre "${title}" mis à jour`);
    } else {
      addMusicTrack({
        title,
        artist,
        album,
        duration: Number(duration),
        genre,
        bpm: Number(bpm),
        year: Number(year),
        energyLevel,
        audioUrl: audioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
        coverUrl: coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop',
        folderId: assignedFolder,
        stationId: targetStationId,
        cueIn: Number(cueIn),
        cueOut: Number(cueOut),
      });
      showToast(`Titre "${title}" ajouté au catalogue`);
    }

    setIsModalOpen(false);
    setEditingTrack(null);
    reloadData();
  };

  const handleDeleteTrack = (id: string, name: string) => {
    if (confirm(`Supprimer le titre "${name}" de la bibliothèque ?`)) {
      deleteMusicTrack(id);
      if (playingTrackId === id && audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        setPlayingTrackId(null);
      }
      reloadData();
      showToast(`Titre "${name}" supprimé`);
    }
  };

  // Upload handler for audio files
  const handleUploadAudioFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let addedCount = 0;
    Array.from(files).forEach((file) => {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      let parsedArtist = 'Artiste Inconnu';
      let parsedTitle = fileNameWithoutExt;

      if (fileNameWithoutExt.includes(' - ')) {
        const parts = fileNameWithoutExt.split(' - ');
        parsedArtist = parts[0].trim();
        parsedTitle = parts.slice(1).join(' - ').trim();
      }

      // Generate local object URL for preview
      const localAudioUrl = URL.createObjectURL(file);
      const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));

      // Random default aesthetic cover
      const fallbackCovers = [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&auto=format&fit=crop',
      ];
      const randomCover = fallbackCovers[Math.floor(Math.random() * fallbackCovers.length)];

      addMusicTrack({
        title: parsedTitle,
        artist: parsedArtist,
        album: 'Téléversement Récent',
        duration: 210,
        genre: 'Pop / Variété',
        bpm: 122,
        year: 2025,
        energyLevel: 'high',
        audioUrl: localAudioUrl,
        coverUrl: randomCover,
        folderId: selectedFolderId !== 'all' && selectedFolderId !== 'none' ? selectedFolderId : undefined,
        stationId: stationFilter === 'all' ? (accessibleStations[0]?.id || 'pop-variete') : stationFilter,
        fileSizeMb: sizeMb,
        fileName: file.name,
      });
      addedCount++;
    });

    reloadData();
    setIsUploadModalOpen(false);
    showToast(`${addedCount} fichier(s) audio téléversé(s) avec succès`);
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
  };

  // Cover file upload for modal
  const handleUploadCoverImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverUrl(reader.result);
        showToast('Pochette d\'album chargée');
      }
    };
    reader.readAsDataURL(file);
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  // Filtered tracks
  const filteredTracks = tracks.filter((t) => {
    const matchesSearch = 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.album && t.album.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.genre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGenre = genreFilter === 'all' || t.genre.toLowerCase().includes(genreFilter.toLowerCase());
    const matchesEnergy = energyFilter === 'all' || t.energyLevel === energyFilter;
    
    let matchesFolder = true;
    if (selectedFolderId === 'none') {
      matchesFolder = !t.folderId;
    } else if (selectedFolderId !== 'all') {
      matchesFolder = t.folderId === selectedFolderId;
    }

    return matchesSearch && matchesGenre && matchesEnergy && matchesFolder;
  });

  return (
    <div className="flex flex-col w-full min-w-0">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Music className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
            <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
              Bibliothèque Musicale ({tracks.length} titres • {folders.length} dossiers)
            </h2>
          </div>
        </div>

        {/* CONTROLS: VIEW SWITCHER + ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* VIEW MODE TOGGLE */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Vue Grille avec Grandes Pochettes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Pochettes</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Vue Liste / Tableau Détaillé"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tableau</span>
            </button>
            <button
              onClick={() => setViewMode('explorer')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'explorer' 
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' 
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Vue Explorateur de Dossiers"
            >
              <Folder className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Dossiers</span>
            </button>
          </div>

          {/* STATION SELECTOR */}
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

          {/* FOLDER CREATE BUTTON */}
          <button
            onClick={handleOpenCreateFolder}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-750 text-zinc-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Créer un nouveau dossier de musique"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">Nouveau Dossier</span>
          </button>

          {/* UPLOAD BUTTON */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Upload className="w-4 h-4" />
            <span>Téléverser</span>
          </button>

          {/* MANUAL ADD TRACK BUTTON */}
          <button
            onClick={handleOpenCreateTrack}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter Titre</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 text-left">
        {/* FOLDERS QUICK FILTER BAR */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-850 flex flex-col gap-3 shadow-md">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Dossiers Principaux
              </span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 text-[10px] font-mono font-bold">
                {folders.length} dossiers
              </span>
            </div>

            <button
              onClick={handleOpenCreateFolder}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Gérer les dossiers</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedFolderId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                selectedFolderId === 'all'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tous les Titres ({tracks.length})</span>
            </button>

            {folders.map((f) => {
              const count = tracks.filter((t) => t.folderId === f.id).length;
              const isSelected = selectedFolderId === f.id;
              return (
                <div key={f.id} className="flex items-center group">
                  <button
                    onClick={() => setSelectedFolderId(f.id)}
                    className={`px-3 py-1.5 rounded-l-xl text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 text-white border border-zinc-700 shadow-md ring-1 ring-cyan-400/50'
                        : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                    <span>{f.name}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-zinc-950/80 text-[10px] text-zinc-400 font-mono">
                      {count}
                    </span>
                  </button>
                  <button
                    onClick={() => handleOpenEditFolder(f)}
                    className={`px-1.5 py-1.5 rounded-r-xl border border-l-0 text-zinc-400 hover:text-white transition-colors cursor-pointer ${
                      isSelected ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800'
                    }`}
                    title="Modifier le dossier"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => setSelectedFolderId('none')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                selectedFolderId === 'none'
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-md ring-1 ring-amber-400/50'
                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-800'
              }`}
            >
              <span>Sans dossier ({tracks.filter((t) => !t.folderId).length})</span>
            </button>
          </div>
        </div>

        {/* SEARCH AND FILTERS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Rechercher un titre, un artiste, un album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les genres</option>
              <option value="pop">Pop / Variété</option>
              <option value="urban">Urban / Hip-Hop</option>
              <option value="rock">Rock / Alternative</option>
              <option value="electro">Electro / House</option>
              <option value="jazz">Jazz / Lounge</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={energyFilter}
              onChange={(e) => setEnergyFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
            >
              <option value="all">Toutes les énergies</option>
              <option value="peak">Peak Energy (High BPM)</option>
              <option value="high">High Energy</option>
              <option value="medium">Medium Tempo</option>
              <option value="calm">Calm / Lounge</option>
            </select>
          </div>
        </div>

        {/* MODAL: UPLOAD AUDIO FILES */}
        {isUploadModalOpen && (
          <div className="p-6 rounded-2xl bg-zinc-900 border border-cyan-500/40 flex flex-col gap-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-futuristic font-bold text-white uppercase flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                Téléverser de Nouveaux Fichiers Musicaux
              </span>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 rounded-2xl border-2 border-dashed border-cyan-500/40 bg-zinc-950/60 hover:bg-zinc-950 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer"
                 onClick={() => uploadFileInputRef.current?.click()}>
              <input
                ref={uploadFileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.aac,.flac,.ogg,.m4a"
                onChange={handleUploadAudioFiles}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-mono font-bold text-white">
                  Cliquez ou glissez-déposez vos morceaux ici
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  Formats supportés : MP3, WAV, AAC, FLAC, M4A, OGG
                </span>
              </div>
              <div className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-mono font-bold">
                Dossier de destination : {selectedFolderId !== 'all' && selectedFolderId !== 'none' ? (folders.find(f => f.id === selectedFolderId)?.name || 'Dossier actif') : 'Dossier principal'}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: FOLDER CREATION / EDITION */}
        {isFolderModalOpen && (
          <form onSubmit={handleSaveFolder} className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border border-cyan-500/40 flex flex-col gap-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-futuristic font-bold text-white uppercase flex items-center gap-2">
                <Folder className="w-4 h-4 text-cyan-400" />
                {editingFolder ? `Modifier le Dossier : ${editingFolder.name}` : 'Nouveau Dossier Musical'}
              </span>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-mono text-zinc-300 font-bold">Nom du Dossier *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Nouveautés Pop 2025 ou Jingles & Sweepers"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Couleur Repère</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={folderColor}
                    onChange={(e) => setFolderColor(e.target.value)}
                    className="w-10 h-9 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={folderColor}
                    onChange={(e) => setFolderColor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-mono text-zinc-300 font-bold">Description / Rôle</label>
                <input
                  type="text"
                  placeholder="ex: Titres frais reçus des maisons de disques à intégrer aux rotations"
                  value={folderDesc}
                  onChange={(e) => setFolderDesc(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Radio Assignée</label>
                <select
                  value={folderStationId}
                  onChange={(e) => setFolderStationId(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-cyan-400 focus:outline-none cursor-pointer"
                >
                  <option value="all">🌐 Toutes les Radios</option>
                  {accessibleStations.map((st) => (
                    <option key={st.id} value={st.id}>
                      📻 {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              {editingFolder && (
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(editingFolder.id, editingFolder.name)}
                  className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/40 text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ce dossier</span>
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-mono cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs font-mono cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  {editingFolder ? 'Mettre à Jour' : 'Créer le Dossier'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* MODAL: TRACK ADD / EDIT */}
        {isModalOpen && (
          <form onSubmit={handleSaveTrack} className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border border-zinc-700 flex flex-col gap-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-futuristic font-bold text-white uppercase flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" />
                {editingTrack ? `Édition du Fichier : ${editingTrack.title}` : 'Ajout Manuel d\'un Titre Musical'}
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
              {/* COVER PREVIEW & UPLOAD */}
              <div className="flex flex-col gap-2 sm:row-span-2">
                <label className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Pochette de l'Album (Cover)
                </label>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center group shadow-md">
                  {coverUrl ? (
                    <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <Disc3 className="w-16 h-16 text-zinc-700 animate-spin-slow" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3 text-center">
                    <button
                      type="button"
                      onClick={() => coverFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-mono font-bold cursor-pointer"
                    >
                      Changer l'image
                    </button>
                    <span className="text-[10px] text-zinc-300 font-mono">PNG, JPG, WebP</span>
                  </div>
                </div>
                <input
                  ref={coverFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadCoverImage}
                  className="hidden"
                />
                <input
                  type="url"
                  placeholder="URL directe de la pochette..."
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-[11px] font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* TITLE */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Titre du Morceau *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Midnight Echoes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* ARTIST */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Artiste / Groupe *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Luna Solaris"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* ALBUM */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Album</label>
                <input
                  type="text"
                  placeholder="ex: Neon Horizon"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* DOSSIER PARENT */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Dossier Principal</label>
                <select
                  value={trackFolderId}
                  onChange={(e) => setTrackFolderId(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value="none">📁 Sans dossier (Racine)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* GENRE */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Genre Musical</label>
                <input
                  type="text"
                  placeholder="ex: Pop / Synthwave"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* BPM */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Tempo (BPM)</label>
                <input
                  type="number"
                  placeholder="124"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* DURATION */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Durée (secondes)</label>
                <input
                  type="number"
                  placeholder="215"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* ENERGY LEVEL */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Niveau d'Énergie Antenne</label>
                <select
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(e.target.value as any)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                >
                  <option value="peak">🔥 Peak Energy (Haute tension)</option>
                  <option value="high">⚡ High Energy (Dynamique)</option>
                  <option value="medium">✨ Medium Tempo (Modéré)</option>
                  <option value="calm">🌙 Calm / Chill (Détente)</option>
                </select>
              </div>

              {/* AUDIO URL */}
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-mono text-zinc-300 font-bold">Lien Fichier Audio / Stream</label>
                <input
                  type="url"
                  placeholder="https://.../track.mp3"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* CUE POINTS */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Cue In (début en sec)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cueIn}
                  onChange={(e) => setCueIn(Number(e.target.value))}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Cue Out (fin en sec)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cueOut}
                  onChange={(e) => setCueOut(Number(e.target.value))}
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
                {editingTrack ? 'Enregistrer les Modifications' : 'Ajouter le Titre'}
              </button>
            </div>
          </form>
        )}

        {/* VIEW MODE 1: GRID / GRANDES POCHETTES */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredTracks.length === 0 ? (
              <div className="col-span-full py-12 text-center text-zinc-500 font-mono text-xs">
                Aucun titre musical trouvé dans cette sélection.
              </div>
            ) : (
              filteredTracks.map((track) => {
                const isPlaying = playingTrackId === track.id;
                const folderObj = folders.find((f) => f.id === track.folderId);
                const stationObj = stations.find((s) => s.id === track.stationId);

                return (
                  <div
                    key={track.id}
                    className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-850 hover:border-zinc-700 flex flex-col justify-between gap-3 transition-all shadow-md group hover:shadow-xl hover:bg-zinc-900/40"
                  >
                    {/* BIG COVER ART WITH HOVER PLAY BUTTON */}
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-inner group-hover:border-zinc-700 transition-all">
                      {track.coverUrl ? (
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700">
                          <Disc3 className="w-16 h-16" />
                        </div>
                      )}

                      {/* PLAY BUTTON OVERLAY */}
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(track)}
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform transform hover:scale-110 cursor-pointer ${
                            isPlaying
                              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/50 ring-4 ring-amber-400/30'
                              : 'bg-white text-black shadow-lg'
                          }`}
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
                        </button>
                      </div>

                      {/* BPM & DURATION BADGES OVER COVER */}
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-amber-400 border border-white/10">
                          {track.bpm} BPM
                        </span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>

                    {/* TRACK METADATA */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-futuristic font-bold text-white line-clamp-1 group-hover:text-amber-400 transition-colors" title={track.title}>
                          {track.title}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 line-clamp-1" title={track.artist}>
                        {track.artist}
                      </span>
                      {track.album && (
                        <span className="text-[10px] font-mono text-zinc-500 line-clamp-1 italic">
                          {track.album}
                        </span>
                      )}

                      {/* FOLDER & GENRE TAGS */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {folderObj ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: folderObj.color }} />
                            <span className="line-clamp-1 max-w-[90px]">{folderObj.name}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-zinc-500 bg-zinc-900/60 border border-zinc-850">
                            Racine
                          </span>
                        )}

                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-850">
                          {track.genre}
                        </span>
                      </div>
                    </div>

                    {/* ACTIONS BOTTOM BAR */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-850">
                      <span className="text-[10px] font-mono text-zinc-500 line-clamp-1 max-w-[100px]">
                        {track.stationId === 'all' ? '🌐 Global' : (stationObj?.name || track.stationId)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditTrack(track)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                          title="Éditer les métadonnées"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTrack(track.id, track.title)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* VIEW MODE 2: LIST / TABLEAU AVEC MINI-POCHETTES */}
        {viewMode === 'list' && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                    <th className="py-3 px-4 w-12 text-center">Écoute</th>
                    <th className="py-3 px-3 w-14">Cover</th>
                    <th className="py-3 px-4">Titre & Artiste</th>
                    <th className="py-3 px-4">Dossier</th>
                    <th className="py-3 px-4">Genre</th>
                    <th className="py-3 px-4">BPM</th>
                    <th className="py-3 px-4">Durée</th>
                    <th className="py-3 px-4">Radio</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredTracks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-500">
                        Aucun titre ne correspond à votre recherche.
                      </td>
                    </tr>
                  ) : (
                    filteredTracks.map((track) => {
                      const isPlaying = playingTrackId === track.id;
                      const folderObj = folders.find((f) => f.id === track.folderId);
                      const stationObj = stations.find((s) => s.id === track.stationId);

                      return (
                        <tr key={track.id} className="hover:bg-zinc-900/40 transition-colors group">
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleTogglePreview(track)}
                              className={`p-2 rounded-xl transition-all cursor-pointer ${
                                isPlaying 
                                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-400' 
                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                            </button>
                          </td>

                          <td className="py-3 px-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0">
                              {track.coverUrl ? (
                                <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                  <Disc3 className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-xs">
                                {track.title}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                {track.artist} {track.album && `• ${track.album}`}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {folderObj ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folderObj.color }} />
                                {folderObj.name}
                              </span>
                            ) : (
                              <span className="text-zinc-600 text-[11px]">Racine</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px]">
                              {track.genre}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-amber-400 font-bold">
                            {track.bpm} BPM
                          </td>

                          <td className="py-3 px-4 text-zinc-400">
                            {formatDuration(track.duration)}
                          </td>

                          <td className="py-3 px-4">
                            {track.stationId === 'all' ? (
                              <span className="text-zinc-500 text-[11px]">🌐 Global</span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stationObj?.color || '#00f2ff' }} />
                                {stationObj?.name || track.stationId}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditTrack(track)}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
                                title="Modifier"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTrack(track.id, track.title)}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-all cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW MODE 3: EXPLORER / DOSSIERS + CONTENU */}
        {viewMode === 'explorer' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* DOSSIERS SIDEBAR */}
            <div className="lg:col-span-1 flex flex-col gap-2 p-4 rounded-2xl bg-zinc-950 border border-zinc-850">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-1">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-cyan-400" />
                  Arborescence
                </span>
                <button
                  onClick={handleOpenCreateFolder}
                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  title="Ajouter un dossier"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setSelectedFolderId('all')}
                className={`p-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between text-left transition-all cursor-pointer ${
                  selectedFolderId === 'all'
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Tous les Titres
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/30 font-bold">
                  {tracks.length}
                </span>
              </button>

              {folders.map((f) => {
                const count = tracks.filter((t) => t.folderId === f.id).length;
                const isSelected = selectedFolderId === f.id;
                return (
                  <div
                    key={f.id}
                    className={`p-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between text-left transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-zinc-800 text-white border border-zinc-700 shadow-md ring-1 ring-cyan-400'
                        : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-850'
                    }`}
                    onClick={() => setSelectedFolderId(f.id)}
                  >
                    <div className="flex items-center gap-2 line-clamp-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-full bg-zinc-950 text-[10px] text-zinc-400">
                        {count}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditFolder(f);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-cyan-400 transition-opacity"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => setSelectedFolderId('none')}
                className={`p-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between text-left transition-all cursor-pointer ${
                  selectedFolderId === 'none'
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-md ring-1 ring-amber-400'
                    : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400'
                }`}
              >
                <span>Sans dossier</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-950 text-zinc-400 font-bold">
                  {tracks.filter((t) => !t.folderId).length}
                </span>
              </button>
            </div>

            {/* TRACKS IN SELECTED FOLDER */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-futuristic font-bold text-white">
                    {selectedFolderId === 'all' 
                      ? 'Tous les morceaux' 
                      : (selectedFolderId === 'none' ? 'Titres sans dossier' : (folders.find(f => f.id === selectedFolderId)?.name || 'Dossier'))}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 text-xs font-mono">
                    {filteredTracks.length} titres
                  </span>
                </div>

                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Ajouter dans ce dossier</span>
                </button>
              </div>

              {/* LIST OF TRACKS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredTracks.map((track) => {
                  const isPlaying = playingTrackId === track.id;
                  return (
                    <div
                      key={track.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 hover:border-zinc-700 flex items-center justify-between gap-3 shadow-sm group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 group">
                          {track.coverUrl ? (
                            <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                          ) : (
                            <Disc3 className="w-6 h-6 text-zinc-700 m-auto mt-3" />
                          )}
                          <button
                            type="button"
                            onClick={() => handleTogglePreview(track)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                          >
                            {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                          </button>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-white truncate" title={track.title}>
                            {track.title}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 truncate" title={track.artist}>
                            {track.artist}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {track.bpm} BPM • {formatDuration(track.duration)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditTrack(track)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTrack(track.id, track.title)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMusicLibraryView;
