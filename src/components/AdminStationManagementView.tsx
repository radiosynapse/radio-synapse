import React, { useState } from 'react';
import { 
  Radio, Plus, Trash2, Edit3, X, ShieldAlert,
  Server, ShieldCheck, Users, CheckSquare, Square
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser } from '../types';
import { isSuperAdmin } from '../utils/adminRolePermissionsStore';

interface AdminStationManagementViewProps {
  stations: StreamChannel[];
  users: SynapseUser[];
  currentUser: SynapseUser | null;
  onSaveStations: (stations: StreamChannel[]) => void;
  onUpdateUserStations: (userId: string, stationIds: string[]) => void;
  showToast: (msg: string) => void;
}

export const AdminStationManagementView: React.FC<AdminStationManagementViewProps> = ({
  stations,
  users,
  currentUser,
  onSaveStations,
  onUpdateUserStations,
  showToast,
}) => {
  const isSuper = isSuperAdmin(currentUser);

  const [isAddingStation, setIsAddingStation] = useState(false);
  const [editingStation, setEditingStation] = useState<StreamChannel | null>(null);
  const [assigningAdminsStation, setAssigningAdminsStation] = useState<StreamChannel | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#00f2ff');
  const [number, setNumber] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamUrlLow, setStreamUrlLow] = useState('');
  const [streamUrlHigh, setStreamUrlHigh] = useState('');
  const [mountPoint, setMountPoint] = useState('');
  const [icecastPassword, setIcecastPassword] = useState('');

  if (!isSuper) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center gap-4 text-zinc-400">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-base font-futuristic font-bold text-white">Accès Réservé au Super-Administrateur</h3>
        <p className="text-xs font-mono max-w-md text-zinc-400">
          La création, modification technique d'infrastructure et suppression de stations radios sont strictement réservées au Super-Admin.
        </p>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingStation(null);
    setName('');
    setGenre('');
    setDescription('');
    setColor('#00f2ff');
    setNumber(`0${stations.length + 1}`);
    setStreamUrl('https://stream.radiosynapse.fr/live.mp3');
    setStreamUrlLow('');
    setStreamUrlHigh('');
    setMountPoint(`/stream_${Date.now().toString().slice(-4)}`);
    setIcecastPassword('SynapseRadioStreamPass');
    setIsAddingStation(true);
  };

  const handleOpenEdit = (st: StreamChannel) => {
    setEditingStation(st);
    setName(st.name);
    setGenre(st.genre);
    setDescription(st.description || '');
    setColor(st.color || '#00f2ff');
    setNumber(st.number || '');
    setStreamUrl(st.urls?.medium || st.streamUrl || '');
    setStreamUrlLow(st.urls?.low || '');
    setStreamUrlHigh(st.urls?.high || '');
    setMountPoint(st.mountPoint || `/${st.id}`);
    setIcecastPassword(st.icecastPassword || '');
    setIsAddingStation(true);
  };

  const handleSaveStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingStation) {
      const updated = stations.map((s) => {
        if (s.id === editingStation.id) {
          return {
            ...s,
            name,
            genre,
            description,
            color,
            number: number || s.number,
            streamUrl: streamUrl || s.streamUrl,
            urls: {
              low: streamUrlLow || streamUrl || s.urls?.low || '',
              medium: streamUrl || s.urls?.medium || '',
              high: streamUrlHigh || streamUrl || s.urls?.high || '',
            },
            mountPoint: mountPoint || s.mountPoint,
            icecastPassword: icecastPassword || s.icecastPassword,
          };
        }
        return s;
      });
      onSaveStations(updated);
      showToast(`Station "${name}" modifiée avec succès`);
    } else {
      const newId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `station-${Date.now()}`;
      const newStation: StreamChannel = {
        id: newId,
        name,
        genre,
        description,
        color,
        number: number || `0${stations.length + 1}`,
        streamUrl: streamUrl || 'https://stream.radiosynapse.fr/live.mp3',
        urls: {
          low: streamUrlLow || streamUrl || 'https://stream.radiosynapse.fr/live.mp3',
          medium: streamUrl || 'https://stream.radiosynapse.fr/live.mp3',
          high: streamUrlHigh || streamUrl || 'https://stream.radiosynapse.fr/live.mp3',
        },
        mountPoint: mountPoint || `/${newId}`,
        icecastPassword: icecastPassword || 'SynapsePass',
        tracks: [],
      };
      onSaveStations([...stations, newStation]);
      showToast(`Station "${name}" créée avec succès`);
    }

    setIsAddingStation(false);
    setEditingStation(null);
  };

  const handleDeleteStation = (stationId: string, stationName: string) => {
    if (confirm(`Êtes-vous absolument sûr de vouloir supprimer définitivement la station "${stationName}" ?`)) {
      const updated = stations.filter((s) => s.id !== stationId);
      onSaveStations(updated);
      showToast(`Station "${stationName}" supprimée`);
    }
  };

  const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'super-admin');

  return (
    <div className="flex flex-col w-full min-w-0">
      {/* STICKY TOP BAR */}
      <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
            <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
              Gestion des Stations & Infrastructure ({stations.length})
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold uppercase">
              Super-Admin Exclusif
            </span>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Créer une Station</span>
        </button>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 text-left">
        {/* SUPER ADMIN NOTICE BANNER */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-zinc-300 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Contrôle d'Antenne Centralisé :</strong> Seul le Super-Admin peut ajouter, modifier la topologie technique des flux Icecast/Liquidsoap, ou supprimer une radio. Vous pouvez également affecter les administrateurs et animateurs à chaque radio.
            </span>
          </div>
        </div>

        {/* MODAL / FORM CREATE & EDIT */}
        {isAddingStation && (
          <form onSubmit={handleSaveStation} className="p-5 sm:p-6 rounded-2xl bg-zinc-900/95 border border-zinc-700 flex flex-col gap-4 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-futuristic font-bold text-white uppercase flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400" />
                {editingStation ? `Modifier la Station : ${editingStation.name}` : 'Créer une Nouvelle Station Radio'}
              </span>
              <button
                type="button"
                onClick={() => setIsAddingStation(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Nom de la Station *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Synapse Pop & Hits"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Genre / Format Musical *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Pop, Hits & Variétés"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Numéro de Canal</label>
                <input
                  type="text"
                  placeholder="ex: 01"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-mono text-zinc-300 font-bold">Description de l'Antenne</label>
                <input
                  type="text"
                  placeholder="ex: Le meilleur de la pop actuelle et des nouveautés francophones 24h/24."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-zinc-300 font-bold">Couleur d'Identité</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none flex-1"
                  />
                </div>
              </div>
            </div>

            {/* FLUX STREAMING & LIQUIDSOAP */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase flex items-center gap-2">
                <Server className="w-3.5 h-3.5" />
                Paramètres Techniques des Flux de Diffusion (Icecast / Liquidsoap)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-zinc-400">URL Flux Principal (192 kbps MP3)</label>
                  <input
                    type="url"
                    placeholder="https://stream.radiosynapse.fr/stream.mp3"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-zinc-400">Point de Montage Icecast (Mount Point)</label>
                  <input
                    type="text"
                    placeholder="ex: /pop-variete"
                    value={mountPoint}
                    onChange={(e) => setMountPoint(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-zinc-400">Mot de passe Source Icecast / DJ</label>
                  <input
                    type="text"
                    placeholder="ex: StreamPass2025"
                    value={icecastPassword}
                    onChange={(e) => setIcecastPassword(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAddingStation(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {editingStation ? 'Enregistrer les Modifications' : 'Créer la Station'}
              </button>
            </div>
          </form>
        )}

        {/* STATIONS LIST CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((station) => {
            // Find admins who have access to this station
            const assignedAdmins = adminUsers.filter(u => {
              if (u.role === 'super-admin') return true;
              if (Array.isArray(u.assignedStationIds) && u.assignedStationIds.includes(station.id)) return true;
              if (u.assignedStationId === station.id || u.assignedStationId === 'all') return true;
              return false;
            });

            return (
              <div
                key={station.id}
                className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-4 transition-all shadow-md group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: station.color || '#00f2ff' }}
                      />
                      <span className="text-base font-futuristic font-black tracking-wide text-white">
                        {station.name}
                      </span>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-750 text-zinc-300">
                      Canal {station.number || '01'}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {station.genre}
                  </span>

                  <p className="text-xs font-mono text-zinc-400 line-clamp-2">
                    {station.description || 'Aucune description configurée pour cette antenne.'}
                  </p>

                  {/* STREAM MOUNT & URL INFO */}
                  <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-850 flex flex-col gap-1 text-[11px] font-mono text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span>Mount Point :</span>
                      <span className="text-zinc-200 font-bold">{station.mountPoint || `/${station.id}`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Flux Principal :</span>
                      <span className="text-zinc-400 truncate max-w-[170px]">{station.urls?.medium || station.streamUrl}</span>
                    </div>
                  </div>

                  {/* ASSIGNED ADMINS PILL */}
                  <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      Admins autorisés :
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 font-bold">
                      {assignedAdmins.length} membre{assignedAdmins.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-850">
                  <button
                    onClick={() => setAssigningAdminsStation(station)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Gérer les animateurs et admins assignés à cette radio"
                  >
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Déléguer</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(station)}
                      className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white transition-all cursor-pointer"
                      title="Modifier les paramètres techniques de la station"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStation(station.id, station.name)}
                      className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-500/40 text-zinc-400 hover:text-rose-400 transition-all cursor-pointer"
                      title="Supprimer définitivement cette station"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* MODAL DELEGATION ADMINS TO STATION */}
        {assigningAdminsStation && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-left animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span className="text-base font-futuristic font-black text-white">
                    Déléguer la Radio : {assigningAdminsStation.name}
                  </span>
                </div>
                <button
                  onClick={() => setAssigningAdminsStation(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs font-mono text-zinc-400">
                Sélectionnez les administrateurs et animateurs autorisés à piloter cette antenne (régie, playlists, conducteur, messagerie).
              </p>

              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar divide-y divide-zinc-900">
                {adminUsers.map((usr) => {
                  const isSuper = usr.role === 'super-admin';
                  const userStations = Array.isArray(usr.assignedStationIds) && usr.assignedStationIds.length > 0
                    ? usr.assignedStationIds
                    : (usr.assignedStationId && usr.assignedStationId !== 'none' ? [usr.assignedStationId] : []);
                  
                  const isAssigned = isSuper || userStations.includes('all') || userStations.includes(assigningAdminsStation.id);

                  return (
                    <div
                      key={usr.id}
                      onClick={() => {
                        if (isSuper) return; // Super admin always has access
                        const current = new Set(userStations);
                        if (current.has(assigningAdminsStation.id)) {
                          current.delete(assigningAdminsStation.id);
                        } else {
                          current.add(assigningAdminsStation.id);
                        }
                        onUpdateUserStations(usr.id, Array.from(current));
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isAssigned
                          ? 'bg-zinc-900 border-amber-500/40 text-white'
                          : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isAssigned ? (
                          <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                        )}
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-white">
                            {usr.username || usr.email}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {usr.email} {isSuper && '• Super-Admin (Accès Global)'}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300">
                        {usr.role === 'super-admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAssigningAdminsStation(null)}
                  className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs font-mono cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStationManagementView;
