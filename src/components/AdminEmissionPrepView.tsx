import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, X
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser } from '../types';
import { 
  EmissionShowPrep, RundownSegment, RundownSegmentType,
  getEmissionShowPreps, addEmissionShowPrep, updateEmissionShowPrep, deleteEmissionShowPrep 
} from '../utils/emissionPrepStore';
import { isSuperAdmin, getUserAssignedStations } from '../utils/adminRolePermissionsStore';

interface AdminEmissionPrepViewProps {
  stations: StreamChannel[];
  activeStation: StreamChannel;
  currentUser: SynapseUser | null;
  onSelectStation?: (station: StreamChannel) => void;
  showToast: (msg: string) => void;
}

export const AdminEmissionPrepView: React.FC<AdminEmissionPrepViewProps> = ({
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

  const [shows, setShows] = useState<EmissionShowPrep[]>([]);
  const [selectedShow, setSelectedShow] = useState<EmissionShowPrep | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<EmissionShowPrep | null>(null);

  // Form states for Show
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [theme, setTheme] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('20:00');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [editorialNotes, setEditorialNotes] = useState('');
  const [targetStationId, setTargetStationId] = useState(activeStation.id);

  // New segment input inside selected show
  const [segmentTitle, setSegmentTitle] = useState('');
  const [segmentType, setSegmentType] = useState<RundownSegmentType>('speech');
  const [segmentDurationSeconds, setSegmentDurationSeconds] = useState(120);
  const [segmentNotes, setSegmentNotes] = useState('');

  const reloadShows = () => {
    const list = getEmissionShowPreps(stationFilter);
    setShows(list);
    if (selectedShow) {
      const refreshed = list.find(s => s.id === selectedShow.id);
      setSelectedShow(refreshed || list[0] || null);
    } else if (list.length > 0) {
      setSelectedShow(list[0]);
    }
  };

  useEffect(() => {
    reloadShows();
  }, [stationFilter]);

  const handleOpenCreate = () => {
    setEditingShow(null);
    setTitle('');
    setHostName(currentUser?.displayName || currentUser?.username || 'Animateur');
    setTheme('');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setStartTime('18:00');
    setEndTime('20:00');
    setDurationMinutes(120);
    setEditorialNotes('');
    setTargetStationId(stationFilter === 'all' ? (accessibleStations[0]?.id || 'pop-variete') : stationFilter);
    setIsModalOpen(true);
  };

  const handleSaveShow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingShow) {
      updateEmissionShowPrep(editingShow.id, {
        title,
        hostName,
        theme,
        scheduledDate,
        startTime,
        endTime,
        durationMinutes: Number(durationMinutes),
        editorialNotes,
        stationId: targetStationId,
      });
      showToast(`Émission "${title}" mise à jour`);
    } else {
      const created = addEmissionShowPrep({
        title,
        hostName,
        theme,
        scheduledDate,
        startTime,
        endTime,
        durationMinutes: Number(durationMinutes),
        editorialNotes,
        stationId: targetStationId,
        status: 'ready',
        segments: [
          {
            id: `seg_${Date.now()}_1`,
            title: 'Top Horaire & Générique d\'ouverture',
            type: 'jingle_intro',
            durationSeconds: 30,
          },
          {
            id: `seg_${Date.now()}_2`,
            title: 'Présentation & Lancement du Sommaire',
            type: 'speech',
            durationSeconds: 90,
            assignedSpeaker: hostName,
          }
        ],
      });
      showToast(`Conducteur "${title}" créé`);
      setSelectedShow(created);
    }

    setIsModalOpen(false);
    setEditingShow(null);
    reloadShows();
  };

  const handleAddSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShow || !segmentTitle.trim()) return;

    const newSeg: RundownSegment = {
      id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: segmentTitle,
      type: segmentType,
      durationSeconds: Number(segmentDurationSeconds),
      notes: segmentNotes,
    };

    const updatedSegments = [...selectedShow.segments, newSeg];
    updateEmissionShowPrep(selectedShow.id, { segments: updatedSegments });
    setSegmentTitle('');
    setSegmentNotes('');
    setSegmentDurationSeconds(120);
    reloadShows();
    showToast(`Élément ajouté au conducteur`);
  };

  const handleDeleteSegment = (segId: string) => {
    if (!selectedShow) return;
    const updated = selectedShow.segments.filter(s => s.id !== segId);
    updateEmissionShowPrep(selectedShow.id, { segments: updated });
    reloadShows();
  };

  const handleDeleteShow = (id: string, name: string) => {
    if (confirm(`Supprimer le conducteur "${name}" ?`)) {
      deleteEmissionShowPrep(id);
      setSelectedShow(null);
      reloadShows();
      showToast(`Émission "${name}" supprimée`);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const getSegmentTypeBadge = (t: RundownSegmentType) => {
    switch (t) {
      case 'jingle_intro':
      case 'jingle_outro':
        return { label: 'Jingle / Générique', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'speech':
        return { label: 'Prise de Parole', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'music_track':
        return { label: 'Titre Musical', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'interview':
        return { label: 'Interview Direct', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      case 'flash_news':
        return { label: 'Flash Info / Météo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      default:
        return { label: 'Bloc Antenne', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  return (
    <div className="flex flex-col w-full min-w-0">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
            <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
              Préparation des Émissions & Conducteur d'Antenne
            </h2>
          </div>
        </div>

        {/* STATION SWITCHER & CREATE BUTTON */}
        <div className="flex items-center gap-2">
          {canSwitch ? (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] font-mono text-zinc-400 pl-2 font-bold">Radio :</span>
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
            <span>Nouveau Conducteur</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 text-left">
        {/* MODAL CREATION EMISSION */}
        {isModalOpen && (
          <form onSubmit={handleSaveShow} className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border border-zinc-700 flex flex-col gap-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-futuristic font-bold text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                {editingShow ? `Modifier l'émission : ${editingShow.title}` : 'Préparer une Nouvelle Émission'}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-mono text-zinc-300 font-bold">Nom de l'Émission / Tranche Horaire *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Le Grand Morning Synapse"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Animateur Principal *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Alexandre & Julie"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Date Prévue</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Horaire de Début</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Horaire de Fin</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-3">
                <label className="text-xs font-mono text-zinc-300 font-bold">Thématique & Sommaire</label>
                <input
                  type="text"
                  placeholder="ex: Matinale hits, flash info, invité en direct à 08h15, jeu concours VIP"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
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
                {editingShow ? 'Enregistrer' : 'Créer le Conducteur'}
              </button>
            </div>
          </form>
        )}

        {/* 2 COLS: SHOW SELECTOR & RUNDOWN DETAIL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SHOWS LIST */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
              Émissions Programmées ({shows.length})
            </span>

            <div className="flex flex-col gap-2.5">
              {shows.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-850 text-center flex flex-col items-center justify-center gap-2">
                  <FileText className="w-6 h-6 text-zinc-600" />
                  <div className="text-xs font-futuristic text-zinc-300">Aucun conducteur préparé</div>
                  <p className="text-[11px] font-mono text-zinc-500">
                    Cliquez sur « Préparer une Émission » pour créer votre premier conducteur d'antenne.
                  </p>
                </div>
              ) : (
                shows.map((show) => {
                const isSelected = selectedShow?.id === show.id;
                const stationObj = stations.find(s => s.id === show.stationId);

                return (
                  <div
                    key={show.id}
                    onClick={() => setSelectedShow(show)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-400/60 shadow-xl'
                        : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {show.startTime} - {show.endTime}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
                        {show.segments.length} éléments
                      </span>
                    </div>

                    <span className="text-sm font-futuristic font-bold text-white">
                      {show.title}
                    </span>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-900">
                      <span>Animé par : {show.hostName}</span>
                      <span className="text-zinc-500">{show.stationId === 'all' ? 'Global' : (stationObj?.name || show.stationId)}</span>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </div>

          {/* RUNDOWN (CONDUCTEUR D'ANTENNE) DETAIL */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {selectedShow ? (
              <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col gap-6 shadow-xl">
                
                {/* SHOW HEADER */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-850 pb-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-mono text-amber-400 font-bold">
                      Conducteur d'Antenne • {selectedShow.scheduledDate} ({selectedShow.startTime} - {selectedShow.endTime})
                    </span>
                    <h3 className="text-lg font-futuristic font-black text-white">
                      {selectedShow.title}
                    </h3>
                    <p className="text-xs font-mono text-zinc-400">
                      {selectedShow.theme || 'Aucune note éditoriale définie.'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteShow(selectedShow.id, selectedShow.title)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-all cursor-pointer self-end sm:self-center"
                    title="Supprimer cette émission"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* SEGMENTS LIST */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
                    Déroulé Minute par Minute (Rundown)
                  </span>

                  {selectedShow.segments.map((seg, idx) => {
                    const badge = getSegmentTypeBadge(seg.type);

                    return (
                      <div
                        key={seg.id}
                        className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {idx + 1}
                          </span>

                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white truncate">
                              {seg.title}
                            </span>
                            {seg.notes && (
                              <span className="text-[11px] text-zinc-400 truncate">
                                Note : {seg.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.color}`}>
                            {badge.label}
                          </span>

                          <span className="text-zinc-300 font-bold text-xs">
                            {formatDuration(seg.durationSeconds)}
                          </span>

                          <button
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ADD NEW SEGMENT FORM */}
                <form onSubmit={handleAddSegment} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col gap-3">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                    + Ajouter un élément au conducteur
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        required
                        placeholder="Titre de l'intervention / nom du morceau / chronique"
                        value={segmentTitle}
                        onChange={(e) => setSegmentTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <select
                        value={segmentType}
                        onChange={(e) => setSegmentType(e.target.value as RundownSegmentType)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                      >
                        <option value="speech">Prise de Parole (Micro)</option>
                        <option value="music_track">Titre Musical</option>
                        <option value="jingle_intro">Jingle / Top Horaire</option>
                        <option value="interview">Interview Invité</option>
                        <option value="flash_news">Flash Infos / Météo</option>
                        <option value="commercial">Partenaire / Pub</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Consignes d'animation, points clés à aborder..."
                        value={segmentNotes}
                        onChange={(e) => setSegmentNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Durée (sec)"
                        value={segmentDurationSeconds}
                        onChange={(e) => setSegmentDurationSeconds(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono cursor-pointer shrink-0"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                </form>

              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs font-mono rounded-2xl bg-zinc-950 border border-zinc-800">
                Sélectionnez une émission pour afficher son conducteur d'antenne.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEmissionPrepView;
