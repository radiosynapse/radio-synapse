import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, Radio, Trophy, Tag, Calendar, CalendarDays, 
  Mail, Plus, Trash2, CheckCircle2, Link, Edit3, ArrowLeft,
  LayoutDashboard, Sparkles, Menu, X, RefreshCw,
  Server, Database, DownloadCloud, Check, Copy, HardDrive,
  MoreVertical, Settings, RotateCcw, Mic, Zap, Key,
  UserCheck, Unlink, Shield, Sliders, 
  UserPlus, CheckSquare, Square
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser, UserRole, AzuraDjAccount, AdminPermissions, AdminProfileTemplate } from '../types';
import { 
  canUserAccessTab,
  isSuperAdmin,
  getAdminProfileTemplates,
  saveAdminProfileTemplates,
  resetAdminProfileTemplates
} from '../utils/adminRolePermissionsStore';
import { 
  AdminChallenge, 
  AdminPromotion, 
  AdminEvent, 
  AdminMessage,
  ChallengeType,
  getAdminStations, 
  saveAdminStations,
  getAdminChallenges, 
  saveAdminChallenges,
  getAdminPromotions, 
  saveAdminPromotions,
  getAdminEvents, 
  saveAdminEvents,
  getAdminMessages, 
  saveAdminMessages,
  getAdminUsers, 
  saveAdminUsers,
  fetchPocketBaseUsers,
  syncAllDataWithPocketBase,
  loadRemoteAdminData,
  cleanupPocketBaseStationDuplicates
} from '../utils/adminStore';
import { 
  updateUserRoleInPocketBase, 
  getStoredSynapseUser, 
  saveAdminDjAccount, 
  unlinkAdminDjAccount, 
  getLinkedAdminDjAccount, 
  restorePocketBaseAuthSession 
} from '../utils/pocketbaseAuthService';
import { testPocketBaseConnection, POCKETBASE_SQLITE_SCHEMA_SQL } from '../lib/pocketbase';
import { liveBroadcastEngine } from '../utils/liveBroadcastEngine';
import { applyAdminDjCredentialsToStations } from '../lib/azuracast';
import StationControlDeckModal from './StationControlDeckModal';
import AdminServicesTab from './AdminServicesTab';
import AdminDashboardView from './AdminDashboardView';
import AdminSidebarEditorModal from './AdminSidebarEditorModal';
import { AdminTab, SidebarItemConfig } from '../types/adminCustomization';
import { 
  getSavedSidebarOrder, 
  saveSidebarOrder, 
  resetSidebarOrder,
  syncCustomizationsWithPocketBase
} from '../utils/adminCustomizationStore';

interface AdminPanelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentStationId?: string;
  currentUser?: SynapseUser | null;
  onRefreshAppState?: () => void;
}

const TABS_METADATA: Record<AdminTab, { label: string; sublabel: string; icon: any }> = {
  dashboard: { label: 'Tableau de bord', sublabel: "Vue d'ensemble", icon: LayoutDashboard },
  stations: { label: 'Stations Radio', sublabel: 'Flux & fréquences', icon: Radio },
  services: { label: 'Services & API', sublabel: 'AzuraCast, PB & Tiers', icon: Server },
  users: { label: 'Utilisateurs', sublabel: 'Gestion des comptes', icon: Users },
  messages: { label: 'Messagerie Studio', sublabel: 'Dédicaces & direct', icon: Mail },
  programming: { label: 'Grille TV/Radio', sublabel: 'Programmes', icon: Calendar },
  events: { label: 'Événements', sublabel: 'Concerts & lives', icon: CalendarDays },
  challenges: { label: 'Défis & XP', sublabel: 'Gamification', icon: Trophy },
  promotions: { label: 'Promotions', sublabel: 'Boutique', icon: Tag },
  azuracast: { label: 'AzuraCast', sublabel: 'AutoDJ & Régie', icon: Server },
  database: { label: 'PocketBase', sublabel: 'Base SQLite', icon: Database },
};

export default function AdminPanelDrawer({
  isOpen,
  onClose,
  currentStationId = 'all',
  currentUser: propCurrentUser,
  onRefreshAppState,
}: AdminPanelDrawerProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sidebar Order Customization State
  const [sidebarOrder, setSidebarOrder] = useState<SidebarItemConfig[]>(() => getSavedSidebarOrder());
  const [isSidebarEditorOpen, setIsSidebarEditorOpen] = useState(false);
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);

  // Selected Station for Station Control Deck Modal
  const [selectedStationForControlDeck, setSelectedStationForControlDeck] = useState<StreamChannel | null>(null);

  // PocketBase Database State
  const [dbStatus, setDbStatus] = useState<{
    ok: boolean | null;
    message: string;
    isTesting: boolean;
    isSyncing: boolean;
  }>({
    ok: null,
    message: 'Prêt à synchroniser',
    isTesting: false,
    isSyncing: false,
  });
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // States
  const [users, setUsers] = useState<SynapseUser[]>([]);
  const [stations, setStations] = useState<StreamChannel[]>([]);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [promotions, setPromotions] = useState<AdminPromotion[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);

  // Modals / Forms
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form states
  // 1. User Form & Role/Profile Management
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormRole, setUserFormRole] = useState<UserRole>('user');
  const [userFormProfileId, setUserFormProfileId] = useState<string>('profile_animateur');
  const [userFormAssignedStation, setUserFormAssignedStation] = useState<string>('all');

  // SubTab inside Users: 'accounts' or 'templates'
  const [userAccountsSubTab, setUserAccountsSubTab] = useState<'accounts' | 'templates'>('accounts');
  const [profileTemplates, setProfileTemplates] = useState<AdminProfileTemplate[]>(() => getAdminProfileTemplates());
  const [editingProfileTemplate, setEditingProfileTemplate] = useState<AdminProfileTemplate | null>(null);
  const [selectedUserForRoleEdit, setSelectedUserForRoleEdit] = useState<SynapseUser | null>(null);
  const [roleEditRole, setRoleEditRole] = useState<UserRole>('user');
  const [roleEditProfileId, setRoleEditProfileId] = useState<string>('profile_general_admin');
  const [roleEditAssignedStation, setRoleEditAssignedStation] = useState<string>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'super-admin' | 'admin' | 'user'>('all');

  // 2. Station Form
  const [stationFormName, setStationFormName] = useState('');
  const [stationFormGenre, setStationFormGenre] = useState('');
  const [stationFormDesc, setStationFormDesc] = useState('');
  const [stationFormColor, setStationFormColor] = useState('#00f2ff');
  const [stationFormNumber, setStationFormNumber] = useState('');
  const [stationFormStreamUrl, setStationFormStreamUrl] = useState('');
  const [stationFormEnabled, setStationFormEnabled] = useState(true);

  // 3. Challenge Form
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDesc, setChallengeDesc] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('stats');
  const [challengeStationId, setChallengeStationId] = useState('all');
  const [challengePoints, setChallengePoints] = useState(150);
  const [challengeReward, setChallengeReward] = useState('');

  // 4. Promotion Form
  const [promoTitle, setPromoTitle] = useState('');
  const [promoTag, setPromoTag] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [promoOldPrice, setPromoOldPrice] = useState('');
  const [promoCode, setPromoCode] = useState('');

  // 5. Event Form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventBroadcast, setEventBroadcast] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventIsLiveSoon, setEventIsLiveSoon] = useState(false);

  // --- ADMIN DJ STREAMER ACCOUNT LINKING STATE ---
  const [currentUser, setCurrentUser] = useState<SynapseUser | null>(() => propCurrentUser || getStoredSynapseUser());
  const [djAccount, setDjAccount] = useState<AzuraDjAccount | null>(() => {
    const user = propCurrentUser || getStoredSynapseUser();
    return getLinkedAdminDjAccount(user);
  });
  const [isEditingDjLink, setIsEditingDjLink] = useState(false);
  const [djFormUsername, setDjFormUsername] = useState('');
  const [djFormPassword, setDjFormPassword] = useState('');
  const [djFormDisplayName, setDjFormDisplayName] = useState('');
  const [djFormStation, setDjFormStation] = useState('pop-variete');
  const [isDjSaving, setIsDjSaving] = useState(false);

  useEffect(() => {
    if (propCurrentUser) {
      setCurrentUser(propCurrentUser);
      const linked = getLinkedAdminDjAccount(propCurrentUser);
      setDjAccount(linked);
    } else {
      const user = getStoredSynapseUser();
      setCurrentUser(user);
      const linked = getLinkedAdminDjAccount(user);
      setDjAccount(linked);
    }
  }, [propCurrentUser, isOpen]);

  // Load Data
  const reloadData = () => {
    setUsers(getAdminUsers());
    setStations(getAdminStations());
    setChallenges(getAdminChallenges());
    setPromotions(getAdminPromotions());
    setEvents(getAdminEvents());
    setMessages(getAdminMessages());

    // Refresh current user & DJ account
    const user = getStoredSynapseUser();
    setCurrentUser(user);
    setProfileTemplates(getAdminProfileTemplates());
    const linked = getLinkedAdminDjAccount(user);
    setDjAccount(linked);
    if (linked) {
      setDjFormUsername(linked.username);
      setDjFormPassword(linked.password || '');
      setDjFormDisplayName(linked.displayName || linked.username);
      setDjFormStation(linked.stationShortcode || 'pop-variete');
    }

    // Pull authentic registered users directly from PocketBase database
    fetchPocketBaseUsers().then((res) => {
      if (res.data && res.data.length > 0) {
        setUsers(res.data);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
      
      // Sync layout customizations from PocketBase cloud
      syncCustomizationsWithPocketBase().then((res) => {
        if (res.sidebar) setSidebarOrder(res.sidebar);
      }).catch(() => {});

      // Restore session to check latest DJ account bindings
      restorePocketBaseAuthSession().then((u) => {
        if (u) {
          setCurrentUser(u);
          const linked = getLinkedAdminDjAccount(u);
          setDjAccount(linked);
          if (linked) {
            setDjFormUsername(linked.username);
            setDjFormPassword(linked.password || '');
            setDjFormDisplayName(linked.displayName || linked.username);
            setDjFormStation(linked.stationShortcode || 'pop-variete');
            
            // Sync credentials to broadcast engine and AzuraCast mappings
            liveBroadcastEngine.saveCredentials({
              username: linked.username,
              password: linked.password || '',
            });
            applyAdminDjCredentialsToStations(linked.username, linked.password);
          }
        }
      });

      // Test PocketBase connection silently on open
      testPocketBaseConnection().then((res) => {
        setDbStatus((prev) => ({
          ...prev,
          ok: res.ok,
          message: res.message,
        }));
      });
    }
  }, [isOpen]);

  // Handler: Save & Link DJ Account
  const handleSaveDjAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!djFormUsername.trim()) {
      showToast('Veuillez spécifier un identifiant DJ streamer valide.');
      return;
    }

    setIsDjSaving(true);
    try {
      const activeUser = currentUser || {
        id: 'admin-local',
        email: 'admin@radiosynapse.fr',
        username: 'Admin Synapse',
        role: 'admin',
        createdAt: Date.now(),
        isSpotifyLinked: false,
      };

      const updatedUser = await saveAdminDjAccount(activeUser, {
        username: djFormUsername.trim(),
        password: djFormPassword.trim(),
        displayName: djFormDisplayName.trim() || djFormUsername.trim(),
        stationShortcode: djFormStation || 'pop-variete',
      });

      setCurrentUser(updatedUser);
      setDjAccount(updatedUser.azuraDjAccount || null);
      setIsEditingDjLink(false);

      // Apply credentials to liveBroadcastEngine
      liveBroadcastEngine.saveCredentials({
        username: djFormUsername.trim(),
        password: djFormPassword.trim(),
      });

      // Apply to all AzuraCast station mappings
      applyAdminDjCredentialsToStations(djFormUsername.trim(), djFormPassword.trim());

      showToast(`Compte DJ "${djFormDisplayName || djFormUsername}" lié avec succès !`);
    } catch (err: any) {
      showToast(`Erreur lors de la liaison DJ : ${err?.message || 'Erreur inconnue'}`);
    } finally {
      setIsDjSaving(false);
    }
  };

  // Handler: Unlink DJ Account
  const handleUnlinkDjAccount = async () => {
    if (!currentUser) return;
    setIsDjSaving(true);
    try {
      const updatedUser = await unlinkAdminDjAccount(currentUser);
      setCurrentUser(updatedUser);
      setDjAccount(null);
      setIsEditingDjLink(false);
      setDjFormUsername('');
      setDjFormPassword('');
      setDjFormDisplayName('');
      showToast('Compte DJ dissocié de ce profil administrateur.');
    } catch (err: any) {
      showToast('Erreur lors de la dissociation du compte DJ.');
    } finally {
      setIsDjSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- POCKETBASE DATABASE HANDLERS ---
  const handleTestDatabase = async () => {
    setDbStatus((prev) => ({ ...prev, isTesting: true, message: 'Test de connexion PocketBase en cours...' }));
    const result = await testPocketBaseConnection();
    setDbStatus((prev) => ({
      ...prev,
      isTesting: false,
      ok: result.ok,
      message: result.message,
    }));
    showToast(result.ok ? 'Connexion PocketBase active et fonctionnelle !' : `Information: ${result.message}`);
  };

  const handleSyncDatabase = async () => {
    setDbStatus((prev) => ({ ...prev, isSyncing: true, message: 'Synchronisation PocketBase en cours...' }));
    const result = await syncAllDataWithPocketBase();
    setDbStatus((prev) => ({
      ...prev,
      isSyncing: false,
      ok: result.success,
      message: result.message,
    }));
    showToast(result.message);
    reloadData();
    if (onRefreshAppState) onRefreshAppState();
  };

  const handlePullRemoteData = async () => {
    setDbStatus((prev) => ({ ...prev, isSyncing: true, message: 'Téléchargement depuis PocketBase...' }));
    const success = await loadRemoteAdminData();
    reloadData();
    if (onRefreshAppState) onRefreshAppState();
    setDbStatus((prev) => ({
      ...prev,
      isSyncing: false,
      message: success ? 'Données rechargées avec succès depuis PocketBase !' : 'Données locales préservées.',
    }));
    showToast('Données synchronisées depuis le serveur PocketBase.');
  };

  const handleCopySqlSchema = () => {
    navigator.clipboard.writeText(POCKETBASE_SQLITE_SCHEMA_SQL);
    setCopiedSql(true);
    showToast('Script SQLite PocketBase copié !');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCopyJsonSchema = async () => {
    try {
      const res = await fetch('/pb_schema.json');
      const text = await res.text();
      navigator.clipboard.writeText(text);
      setCopiedJson(true);
      showToast('Schéma PocketBase JSON copié (1-clic import) !');
      setTimeout(() => setCopiedJson(false), 3000);
    } catch {
      showToast('Erreur lors de la lecture du fichier de schéma JSON.');
    }
  };

  // --- USER & ADMIN PROFILES HANDLERS ---
  const handleOpenEditUserRole = (targetUser: SynapseUser) => {
    setSelectedUserForRoleEdit(targetUser);
    setRoleEditRole(targetUser.role || 'user');
    setRoleEditProfileId(
      targetUser.adminProfileId || 
      (targetUser.role === 'super-admin' ? 'profile_super_admin' : (targetUser.role === 'admin' ? 'profile_general_admin' : 'profile_animateur'))
    );
    setRoleEditAssignedStation(targetUser.assignedStationId || 'all');
  };

  const handleSaveUserRole = async () => {
    if (!selectedUserForRoleEdit) return;

    const targetId = selectedUserForRoleEdit.id;
    const finalProfileId = roleEditRole === 'user' ? undefined : (roleEditRole === 'super-admin' ? 'profile_super_admin' : roleEditProfileId);
    const finalStationId = roleEditRole === 'user' ? undefined : roleEditAssignedStation;

    const updated = users.map((u) => {
      if (u.id === targetId) {
        return {
          ...u,
          role: roleEditRole,
          adminProfileId: finalProfileId,
          assignedStationId: finalStationId,
        };
      }
      return u;
    });

    setUsers(updated);
    saveAdminUsers(updated);

    // If current logged in user was modified, update their session too
    if (currentUser && currentUser.id === targetId) {
      const updatedCurrent: SynapseUser = {
        ...currentUser,
        role: roleEditRole,
        adminProfileId: finalProfileId,
        assignedStationId: finalStationId,
      };
      setCurrentUser(updatedCurrent);
    }

    // Persist to PocketBase
    await updateUserRoleInPocketBase(targetId, roleEditRole, finalProfileId, finalStationId).catch(() => {});

    setSelectedUserForRoleEdit(null);
    showToast(`Droits et profil mis à jour pour ${selectedUserForRoleEdit.username || selectedUserForRoleEdit.email} !`);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormEmail.trim()) return;
    const newUser: SynapseUser = {
      id: `usr_${Date.now()}`,
      email: userFormEmail.trim().toLowerCase(),
      username: userFormUsername.trim() || userFormEmail.split('@')[0],
      role: userFormRole,
      adminProfileId: userFormRole === 'super-admin' ? 'profile_super_admin' : (userFormRole === 'admin' ? userFormProfileId : undefined),
      assignedStationId: userFormRole !== 'user' ? userFormAssignedStation : undefined,
      createdAt: Date.now(),
      isSpotifyLinked: false,
    };
    const updated = [newUser, ...users];
    setUsers(updated);
    saveAdminUsers(updated);
    setUserFormEmail('');
    setUserFormUsername('');
    setIsAddingNew(false);
    showToast(`Utilisateur ${newUser.username} (${newUser.role.toUpperCase()}) ajouté avec succès !`);
  };

  const handleDeleteUser = (userId: string) => {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    const updated = users.filter((u) => u.id !== userId);
    setUsers(updated);
    saveAdminUsers(updated);
    showToast('Utilisateur supprimé.');
  };

  // Profile Template Handlers
  const handleSaveProfileTemplate = (updatedTemplate: AdminProfileTemplate) => {
    const updatedList = profileTemplates.map((tpl) => tpl.id === updatedTemplate.id ? updatedTemplate : tpl);
    setProfileTemplates(updatedList);
    saveAdminProfileTemplates(updatedList);
    setEditingProfileTemplate(null);
    showToast(`Modèle de profil "${updatedTemplate.name}" enregistré et synchronisé.`);
  };

  const handleResetProfileTemplatesList = () => {
    if (!confirm('Réinitialiser tous les modèles de profils administrateurs à leurs permissions d\'origine ?')) return;
    const reset = resetAdminProfileTemplates();
    setProfileTemplates(reset);
    setEditingProfileTemplate(null);
    showToast('Modèles de profils administrateurs réinitialisés.');
  };

  // --- STATION HANDLERS ---
  const handleOpenEditStation = (st: StreamChannel) => {
    setEditingItem(st);
    setStationFormName(st.name);
    setStationFormGenre(st.genre);
    setStationFormDesc(st.description);
    setStationFormColor(st.color || '#00f2ff');
    setStationFormNumber(st.stationNumber || '');
    setStationFormStreamUrl(st.streamUrl || st.tracks?.[0]?.audioUrl || '');
    setStationFormEnabled(st.enabled !== false);
    setIsAddingNew(false);
  };

  const handleToggleStationEnabled = (stationId: string) => {
    const updated = stations.map((st) => {
      if (st.id === stationId) {
        const isCurrentlyEnabled = st.enabled !== false;
        return { ...st, enabled: !isCurrentlyEnabled };
      }
      return st;
    });
    setStations(updated);
    saveAdminStations(updated);
    const target = updated.find((s) => s.id === stationId);
    const isNowEnabled = target?.enabled !== false;
    showToast(
      isNowEnabled
        ? `Station "${target?.name}" activée sur le lecteur.`
        : `Station "${target?.name}" désactivée (masquée du lecteur).`
    );
    if (onRefreshAppState) onRefreshAppState();
  };

  const handleSaveStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationFormName.trim()) return;

    const id = editingItem 
      ? editingItem.id 
      : (stationFormName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') || `station-${Date.now()}`);

    const streamUrlToUse = stationFormStreamUrl.trim();

    let updatedTracks = editingItem?.tracks && editingItem.tracks.length > 0 ? [...editingItem.tracks] : [];
    if (updatedTracks.length > 0) {
      if (streamUrlToUse) {
        updatedTracks[0] = {
          ...updatedTracks[0],
          audioUrl: streamUrlToUse,
          artist: stationFormName.trim(),
        };
      }
    } else {
      updatedTracks = [
        {
          id: `${id}-live-stream`,
          title: 'En Direct',
          artist: stationFormName.trim(),
          album: 'Radio Synapse Live',
          duration: 3600,
          coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
          audioUrl: streamUrlToUse || 'https://cast.radiosynapse.fr/listen/radio.mp3'
        }
      ];
    }

    const newStation: StreamChannel = {
      id,
      stationNumber: stationFormNumber.trim() || undefined,
      name: stationFormName.trim(),
      genre: stationFormGenre.trim() || 'Électro / General',
      description: stationFormDesc.trim() || 'Station créée via le panneau administration Radio Synapse.',
      color: stationFormColor || '#00f2ff',
      streamUrl: streamUrlToUse || undefined,
      enabled: stationFormEnabled,
      tracks: updatedTracks,
    };

    let updated: StreamChannel[];
    const normUrl = streamUrlToUse.toLowerCase().trim().replace(/\/+$/, '');
    const normName = stationFormName.trim().toLowerCase();

    const existsIndex = stations.findIndex((s) => {
      if (editingItem && s.id === editingItem.id) return true;
      if (s.id === id) return true;
      if (normUrl && s.streamUrl && s.streamUrl.toLowerCase().trim().replace(/\/+$/, '') === normUrl) return true;
      if (normName && s.name && s.name.toLowerCase().trim() === normName) return true;
      return false;
    });

    if (existsIndex >= 0) {
      updated = [...stations];
      updated[existsIndex] = newStation;
    } else {
      updated = [...stations, newStation];
    }

    setStations(updated);
    saveAdminStations(updated);
    setIsAddingNew(false);
    setEditingItem(null);
    showToast(`Station ${newStation.name} enregistrée avec succès !`);
    if (onRefreshAppState) onRefreshAppState();
  };

  const handleDeleteStation = (stationId: string) => {
    if (!confirm('Supprimer cette station radio ?')) return;
    const updated = stations.filter((s) => s.id !== stationId);
    setStations(updated);
    saveAdminStations(updated);
    showToast('Station supprimée.');
    if (onRefreshAppState) onRefreshAppState();
  };

  // --- CHALLENGE HANDLERS ---
  const handleSaveChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeTitle.trim()) return;

    const newChallenge: AdminChallenge = {
      id: editingItem?.id || `challenge_${Date.now()}`,
      stationId: challengeStationId,
      title: challengeTitle,
      desc: challengeDesc,
      type: challengeType,
      points: Number(challengePoints) || 100,
      reward: challengeReward || 'Badge spécial auditeur',
      total: 5,
      progress: 0,
      completed: false,
      createdAt: Date.now(),
    };

    let updated: AdminChallenge[];
    if (editingItem) {
      updated = challenges.map((c) => (c.id === editingItem.id ? newChallenge : c));
    } else {
      updated = [newChallenge, ...challenges];
    }

    setChallenges(updated);
    saveAdminChallenges(updated);
    setIsAddingNew(false);
    setEditingItem(null);
    showToast(`Défi "${newChallenge.title}" publié avec succès !`);
  };

  const handleDeleteChallenge = (id: string) => {
    const updated = challenges.filter((c) => c.id !== id);
    setChallenges(updated);
    saveAdminChallenges(updated);
    showToast('Défi supprimé.');
  };

  // --- PROMOTION HANDLERS ---
  const handleSavePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoTitle.trim()) return;

    const newPromo: AdminPromotion = {
      id: editingItem?.id || `promo_${Date.now()}`,
      title: promoTitle,
      tag: promoTag || 'Offre Spéciale',
      type: 'Partenariat',
      desc: promoDesc,
      price: promoPrice || 'Gratuit',
      oldPrice: promoOldPrice || undefined,
      codePromo: promoCode || undefined,
      status: 'active',
      createdAt: Date.now(),
    };

    let updated: AdminPromotion[];
    if (editingItem) {
      updated = promotions.map((p) => (p.id === editingItem.id ? newPromo : p));
    } else {
      updated = [newPromo, ...promotions];
    }

    setPromotions(updated);
    saveAdminPromotions(updated);
    setIsAddingNew(false);
    setEditingItem(null);
    showToast(`Promotion "${newPromo.title}" enregistrée !`);
  };

  const handleDeletePromotion = (id: string) => {
    const updated = promotions.filter((p) => p.id !== id);
    setPromotions(updated);
    saveAdminPromotions(updated);
    showToast('Promotion supprimée.');
  };

  // --- EVENT HANDLERS ---
  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    const newEvt: AdminEvent = {
      id: editingItem?.id || `event_${Date.now()}`,
      stationId: currentStationId || 'all',
      title: eventTitle,
      date: eventDate || 'Prochainement',
      location: eventLocation || 'En direct',
      broadcast: eventBroadcast || 'Audio High-Definition',
      type: 'Festival Broadcast',
      desc: eventDesc,
      isLiveSoon: eventIsLiveSoon,
      status: 'upcoming',
      createdAt: Date.now(),
    };

    let updated: AdminEvent[];
    if (editingItem) {
      updated = events.map((ev) => (ev.id === editingItem.id ? newEvt : ev));
    } else {
      updated = [newEvt, ...events];
    }

    setEvents(updated);
    saveAdminEvents(updated);
    setIsAddingNew(false);
    setEditingItem(null);
    showToast(`Événement "${newEvt.title}" créé !`);
  };

  const handleDeleteEvent = (id: string) => {
    const updated = events.filter((ev) => ev.id !== id);
    setEvents(updated);
    saveAdminEvents(updated);
    showToast('Événement supprimé.');
  };

  // --- MESSAGE HANDLERS ---
  const handleToggleMessageRead = (id: string) => {
    const updated = messages.map((m) => (m.id === id ? { ...m, isRead: !m.isRead } : m));
    setMessages(updated);
    saveAdminMessages(updated);
  };

  const handleDeleteMessage = (id: string) => {
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);
    saveAdminMessages(updated);
    showToast('Message supprimé de la messagerie.');
  };

  if (!isOpen) return null;

  const unreadMessagesCount = messages.filter((m) => !m.isRead).length;
  const activeStationsCount = stations.filter((s) => s.enabled !== false).length;

  const tabBadges: Partial<Record<AdminTab, { badge?: string | number; badgeColor?: string }>> = {
    stations: { badge: `${activeStationsCount}/${stations.length}`, badgeColor: 'bg-zinc-800 text-cyan-300 border-zinc-700' },
    services: { 
      badge: dbStatus.ok ? 'Connecté' : 'Actif', 
      badgeColor: dbStatus.ok ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-zinc-800 text-cyan-300 border-zinc-700' 
    },
    users: { badge: users.length },
    messages: { 
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined, 
      badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30' 
    },
    events: { badge: events.length },
    challenges: { badge: challenges.length },
    promotions: { badge: promotions.length },
  };

  const isSuper = isSuperAdmin(currentUser);

  const sidebarLinks = sidebarOrder
    .filter(item => {
      if (isSuper) {
        return item.visible !== false;
      }
      return item.visible && canUserAccessTab(currentUser, item.id);
    })
    .map(item => {
      const meta = TABS_METADATA[item.id] || { label: item.id, sublabel: '', icon: LayoutDashboard };
      const badgeInfo = tabBadges[item.id] || {};
      return {
        id: item.id,
        label: meta.label,
        sublabel: meta.sublabel,
        icon: meta.icon,
        badge: badgeInfo.badge,
        badgeColor: badgeInfo.badgeColor,
      };
    });

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 text-white flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
      {/* FULL PAGE HEADER - SOBRE & ÉPURÉ (DA DU LECTEUR ET DE LA PAGE PROFIL) */}
      <header className="w-full bg-zinc-950/90 border-b border-zinc-800/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 backdrop-blur-xl shrink-0 z-20">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 md:hidden cursor-pointer"
            title="Menu latéral"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-400 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2.5">
              <span className="font-futuristic text-sm sm:text-base font-black uppercase tracking-wider text-white">
                Console Administration
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                EN LIGNE
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              RADIO SYNAPSE • MANAGEMENT & REGIE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncDatabase}
            disabled={dbStatus.isSyncing}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Synchroniser toutes les données avec le serveur PocketBase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${dbStatus.isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Sync PocketBase</span>
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
            title="Quitter le panneau d'administration"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
            <span className="hidden sm:inline">Retour au Lecteur</span>
            <span className="sm:hidden">Retour</span>
          </button>
        </div>
      </header>

      {/* MAIN BODY WITH SIDEBAR */}
      <div className="flex-1 w-full flex min-h-0 overflow-hidden relative">

        {/* SIDEBAR NAVIGATION (COLLAPSIBLE ON HOVER DESKTOP + MOBILE DRAWER) */}
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`fixed md:relative top-0 bottom-0 left-0 z-30 bg-zinc-950 md:bg-zinc-900/40 border-r border-zinc-800/80 flex flex-col backdrop-blur-xl transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
            mobileSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
          } ${
            isSidebarHovered ? 'md:w-64 lg:w-72 shadow-2xl' : 'md:w-[68px]'
          }`}
        >
          {/* SIDEBAR HEADER / BRAND */}
          <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between min-h-[57px] relative">
            <div className={`flex items-center gap-2.5 transition-opacity duration-200 ${
              isSidebarHovered ? 'opacity-100' : 'md:opacity-0 md:w-0'
            }`}>
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2ff]" />
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest whitespace-nowrap">
                NAVIGATION
              </span>
            </div>
            
            {/* Action buttons: 3-dots customization menu + mobile close */}
            <div className="flex items-center gap-1">
              {/* 3 VERTICAL DOTS TO CUSTOMIZE SIDEBAR */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSidebarMenuOpen(!isSidebarMenuOpen);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Personnaliser l'ordre du menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* DROPDOWN MENU */}
                {isSidebarMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSidebarMenuOpen(false);
                      }} 
                    />
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 w-52 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 text-left animate-in fade-in zoom-in-95 duration-150"
                    >
                      <button
                        onClick={() => {
                          setIsSidebarEditorOpen(true);
                          setIsSidebarMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-lg hover:bg-zinc-850 text-xs font-mono text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Éditer le menu</span>
                      </button>
                      <button
                        onClick={() => {
                          const def = resetSidebarOrder();
                          setSidebarOrder(def);
                          setIsSidebarMenuOpen(false);
                          showToast('Ordre du menu réinitialisé par défaut.');
                        }}
                        className="w-full px-3 py-2 rounded-lg hover:bg-zinc-850 text-xs font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ordre par défaut</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SIDEBAR LINKS */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar overflow-x-hidden">
            {sidebarLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'services' && (activeTab === 'azuracast' || activeTab === 'database'));
              return (
                <button
                  key={item.id}
                  title={!isSidebarHovered ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                  onClick={() => {
                    setActiveTab(item.id as AdminTab);
                    setIsAddingNew(false);
                    setEditingItem(null);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center rounded-xl transition-all cursor-pointer group relative ${
                    isSidebarHovered 
                      ? 'justify-between p-3 text-left' 
                      : 'md:justify-center md:p-2.5 justify-between p-3'
                  } ${
                    isActive
                      ? 'bg-zinc-800 text-white border border-zinc-700/80 shadow-sm'
                      : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition-colors shrink-0 relative ${
                        isActive
                          ? 'bg-zinc-700/80 text-cyan-300'
                          : 'bg-zinc-900 text-zinc-400 group-hover:text-zinc-200 group-hover:bg-zinc-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {/* Compact alert dot when sidebar is collapsed */}
                      {!isSidebarHovered && item.badge !== undefined && (
                        <span className="hidden md:block absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-zinc-900" />
                      )}
                    </div>

                    {/* Detailed text visible when hovered or on mobile */}
                    <div className={`flex flex-col min-w-0 transition-opacity duration-200 ${
                      isSidebarHovered ? 'opacity-100' : 'md:hidden'
                    }`}>
                      <span className="text-xs font-mono font-bold tracking-wide truncate">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 truncate">
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge visible when hovered or on mobile */}
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 border transition-opacity duration-200 ${
                        isSidebarHovered ? 'opacity-100' : 'md:hidden'
                      } ${
                        item.badgeColor ||
                        (isActive
                          ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800')
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* SIDEBAR FOOTER ADMIN INFO */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 flex flex-col gap-2 min-h-[61px]">
            <div className={`flex items-center gap-3 ${
              isSidebarHovered ? 'justify-start' : 'md:justify-center justify-start'
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                currentUser?.role === 'super-admin'
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-cyan-300'
              }`}>
                {currentUser?.role === 'super-admin' ? 'SA' : (currentUser?.username?.slice(0, 2).toUpperCase() || 'AD')}
              </div>
              <div className={`flex flex-col text-left transition-opacity duration-200 ${
                isSidebarHovered ? 'opacity-100' : 'md:hidden'
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-zinc-200">
                    {currentUser?.role === 'super-admin' ? 'SUPER ADMIN' : (
                      profileTemplates.find(t => t.id === currentUser?.adminProfileId)?.name || 'ADMIN'
                    )}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {currentUser?.assignedStationId && currentUser.assignedStationId !== 'all' 
                    ? `Station: ${currentUser.assignedStationId}` 
                    : 'Connecté'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* OVERLAY FOR MOBILE SIDEBAR */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 md:hidden"
          />
        )}

        {/* RIGHT CONTENT AREA */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

          {/* TOAST NOTIFICATION */}
          {toastMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-mono flex items-center gap-2 shadow-xl animate-fade-in shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* TAB 0: TABLEAU DE BORD MODULABLE & PERSONNALISABLE */}
          {activeTab === 'dashboard' && (
            <AdminDashboardView
              stations={stations}
              users={users}
              challenges={challenges}
              promotions={promotions}
              events={events}
              messages={messages}
              unreadMessagesCount={unreadMessagesCount}
              activeStationsCount={activeStationsCount}
              dbStatus={dbStatus}
              currentUser={currentUser}
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                setIsAddingNew(false);
                setEditingItem(null);
              }}
              onOpenAddNew={(tab) => {
                setActiveTab(tab);
                setIsAddingNew(true);
                setEditingItem(null);
              }}
              onOpenControlDeck={(st) => setSelectedStationForControlDeck(st)}
              onRefreshData={() => reloadData()}
              onTestDatabase={handleTestDatabase}
              showToast={showToast}
            />
          )}

          {/* TAB 1: GESTION DES UTILISATEURS & PROFILS ADMIN */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-5 text-left animate-in fade-in duration-200">
              
              {/* TOP HEADER & SUBTABS TOGGLE */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm backdrop-blur-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
                      Gestion des Comptes & Droits d'Accès
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold uppercase">
                      Hiérarchie Super-Admin
                    </span>
                  </div>
                  <p className="text-xs font-mono text-zinc-400">
                    Attribuez des rôles (Super-Admin, Admin avec profil spécialisé ou Auditeur) et préconfigurez les droits délégués par station.
                  </p>
                </div>

                {/* SUBTABS SWITCHER */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800 self-stretch sm:self-auto shrink-0">
                  <button
                    onClick={() => setUserAccountsSubTab('accounts')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      userAccountsSubTab === 'accounts'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Comptes ({users.length})</span>
                  </button>

                  <button
                    onClick={() => setUserAccountsSubTab('templates')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      userAccountsSubTab === 'templates'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Modèles de Profils ({profileTemplates.length})</span>
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* SUBTAB 1: COMPTES UTILISATEURS & AFFECTATIONS */}
              {/* ========================================================= */}
              {userAccountsSubTab === 'accounts' && (
                <div className="flex flex-col gap-4">
                  
                  {/* KPI SUMMARY CARDS */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Total Comptes</span>
                      <span className="text-xl font-mono font-black text-white">{users.length}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-red-500/20 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-red-400 font-bold">Super-Admins</span>
                      <span className="text-xl font-mono font-black text-red-300">
                        {users.filter(u => u.role === 'super-admin').length}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-amber-500/20 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Admins & Profils</span>
                      <span className="text-xl font-mono font-black text-amber-300">
                        {users.filter(u => u.role === 'admin').length}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Auditeurs Standards</span>
                      <span className="text-xl font-mono font-black text-zinc-300">
                        {users.filter(u => u.role === 'user' || !u.role).length}
                      </span>
                    </div>
                  </div>

                  {/* ACTION BAR: SEARCH, FILTERS & ADD BUTTON */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <input
                        type="text"
                        placeholder="Rechercher un utilisateur (pseudo, email)..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none flex-1 min-w-[200px]"
                      />

                      <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-850">
                        {(['all', 'super-admin', 'admin', 'user'] as const).map((filterVal) => (
                          <button
                            key={filterVal}
                            onClick={() => setUserRoleFilter(filterVal)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              userRoleFilter === filterVal
                                ? 'bg-zinc-800 text-amber-300 border border-zinc-700'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {filterVal === 'all' ? 'Tous' : filterVal === 'super-admin' ? 'Super-Admin' : filterVal === 'admin' ? 'Admins' : 'Auditeurs'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setIsAddingNew(!isAddingNew)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-md shadow-amber-500/20"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isAddingNew ? 'Fermer le formulaire' : 'Créer un compte'}</span>
                    </button>
                  </div>

                  {/* ADD USER FORM WITH ROLE & PROFILE PICKER */}
                  {isAddingNew && (
                    <form onSubmit={handleCreateUser} className="p-5 rounded-2xl bg-zinc-900/90 border border-amber-500/40 flex flex-col gap-4 shadow-xl animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <span className="text-xs font-mono font-bold text-amber-400 uppercase flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Créer un nouveau compte avec attribution de rôle
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">Sauvegarde locale + PocketBase</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-mono text-zinc-400">Adresse E-mail *</label>
                          <input
                            type="email"
                            required
                            placeholder="ex: animateur@synapse.fm"
                            value={userFormEmail}
                            onChange={(e) => setUserFormEmail(e.target.value)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-mono text-zinc-400">Pseudo / Nom d'antenne</label>
                          <input
                            type="text"
                            placeholder="ex: Alex Radio"
                            value={userFormUsername}
                            onChange={(e) => setUserFormUsername(e.target.value)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-mono text-zinc-400">Rôle Hiérarchique</label>
                          <select
                            value={userFormRole}
                            onChange={(e) => setUserFormRole(e.target.value as UserRole)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                          >
                            <option value="super-admin">👑 Super-Administrateur (Tous droits)</option>
                            <option value="admin">⭐ Administrateur (Selon profil assigné)</option>
                            <option value="user">👤 Auditeur Standard (Utilisateur)</option>
                          </select>
                        </div>
                      </div>

                      {/* CONDITIONAL PROFILE & STATION ASSIGNMENT IF ADMIN */}
                      {userFormRole === 'admin' && (
                        <div className="p-4 rounded-xl bg-zinc-950 border border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10.5px] font-mono text-amber-300 font-bold">
                              Modèle de Profil Administrateur :
                            </label>
                            <select
                              value={userFormProfileId}
                              onChange={(e) => setUserFormProfileId(e.target.value)}
                              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                            >
                              {profileTemplates.filter(t => t.id !== 'profile_super_admin').map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                  {tpl.name} - {tpl.badge}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10.5px] font-mono text-amber-300 font-bold">
                              Station / Fréquence assignée :
                            </label>
                            <select
                              value={userFormAssignedStation}
                              onChange={(e) => setUserFormAssignedStation(e.target.value)}
                              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                            >
                              <option value="all">🌍 Toutes les stations (Global)</option>
                              {stations.map((st) => (
                                <option key={st.id} value={st.id}>
                                  📻 {st.name} ({st.genre})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setIsAddingNew(false)}
                          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono cursor-pointer"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono cursor-pointer shadow-md"
                        >
                          Créer le compte
                        </button>
                      </div>
                    </form>
                  )}

                  {/* USERS LIST CARDS */}
                  <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-inner">
                    {(() => {
                      const filteredUsers = users.filter((u) => {
                        const matchesQuery = 
                          !userSearchQuery.trim() || 
                          u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                          u.email?.toLowerCase().includes(userSearchQuery.toLowerCase());
                        
                        const matchesRole = 
                          userRoleFilter === 'all' || 
                          (userRoleFilter === 'super-admin' && u.role === 'super-admin') ||
                          (userRoleFilter === 'admin' && u.role === 'admin') ||
                          (userRoleFilter === 'user' && (u.role === 'user' || !u.role));

                        return matchesQuery && matchesRole;
                      });

                      if (filteredUsers.length === 0) {
                        return (
                          <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
                              <Users className="w-6 h-6" />
                            </div>
                            <span className="text-sm font-bold font-mono text-zinc-300">Aucun utilisateur trouvé</span>
                            <span className="text-xs font-mono text-zinc-500 max-w-sm">
                              Essayez de modifier votre terme de recherche ou le filtre de rôle.
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="divide-y divide-zinc-850">
                          {filteredUsers.map((usr) => {
                            const isUserSuperAdmin = usr.role === 'super-admin';
                            const isUserAdmin = usr.role === 'admin';
                            const assignedTemplate = profileTemplates.find(t => t.id === usr.adminProfileId) || 
                              profileTemplates.find(t => t.id === (isUserSuperAdmin ? 'profile_super_admin' : 'profile_general_admin'));
                            const assignedStation = stations.find(s => s.id === usr.assignedStationId);

                            return (
                              <div 
                                key={usr.id} 
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors text-left"
                              >
                                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isUserSuperAdmin 
                                      ? 'bg-red-500/10 border-red-500/30 text-red-300' 
                                      : isUserAdmin 
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                  }`}>
                                    {usr.username?.slice(0, 2).toUpperCase() || 'US'}
                                  </div>

                                  <div className="flex flex-col min-w-0 gap-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-white font-mono truncate">
                                        {usr.username || usr.email.split('@')[0]}
                                      </span>

                                      {/* ROLE BADGE */}
                                      {isUserSuperAdmin ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 border border-red-500/40 text-red-300 flex items-center gap-1">
                                          <Shield className="w-3 h-3 text-red-400" />
                                          SUPER-ADMIN
                                        </span>
                                      ) : isUserAdmin ? (
                                        <span 
                                          className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1"
                                          style={{
                                            backgroundColor: `${assignedTemplate?.color || '#f59e0b'}15`,
                                            borderColor: `${assignedTemplate?.color || '#f59e0b'}40`,
                                            color: assignedTemplate?.color || '#f59e0b',
                                          }}
                                        >
                                          <ShieldCheck className="w-3 h-3" />
                                          {assignedTemplate?.name || 'ADMIN'}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-850 text-zinc-400 border border-zinc-800">
                                          AUDITEUR
                                        </span>
                                      )}

                                      {/* ASSIGNED STATION BADGE IF APPLICABLE */}
                                      {(isUserAdmin || isUserSuperAdmin) && usr.assignedStationId && usr.assignedStationId !== 'all' && (
                                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1">
                                          <Radio className="w-3 h-3" />
                                          {assignedStation ? assignedStation.name : usr.assignedStationId}
                                        </span>
                                      )}

                                      {usr.isSpotifyLinked && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono font-bold">
                                          Spotify
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 flex-wrap">
                                      <span>{usr.email}</span>
                                      {isUserAdmin && assignedTemplate && (
                                        <span className="text-zinc-500 text-[10px]">
                                          • Profil : <em>{assignedTemplate.badge}</em>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* USER ACTION BUTTONS */}
                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                  <button
                                    onClick={() => handleOpenEditUserRole(usr)}
                                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 hover:text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                    title="Configurer le rôle et le profil de permissions"
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                    <span>Modifier Droits</span>
                                  </button>

                                  <button
                                    onClick={() => handleDeleteUser(usr.id)}
                                    className="p-2 rounded-xl bg-red-950/30 hover:bg-red-950/70 border border-red-500/30 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                                    title="Supprimer l'utilisateur"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* SUBTAB 2: MODÈLES DE PROFILS ADMIN & PERMISSIONS */}
              {/* ========================================================= */}
              {userAccountsSubTab === 'templates' && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Système de Permissions Déléguées :</strong> Tous les intervenants créés ont un compte admin mais reçoivent les permissions du profil associé préconfiguré ci-dessous.
                      </span>
                    </div>

                    <button
                      onClick={handleResetProfileTemplatesList}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Réinitialiser Modèles</span>
                    </button>
                  </div>

                  {/* GRID OF PROFILE TEMPLATES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {profileTemplates.map((template) => {
                      const enabledPermissionsCount = Object.values(template.permissions).filter(Boolean).length;
                      const isSuper = template.id === 'profile_super_admin';

                      return (
                        <div
                          key={template.id}
                          className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 flex flex-col justify-between gap-4 transition-all text-left shadow-sm"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: template.color }}
                                />
                                <span className="text-sm font-futuristic font-black tracking-wide text-white">
                                  {template.name}
                                </span>
                              </div>

                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
                                style={{
                                  backgroundColor: `${template.color}15`,
                                  borderColor: `${template.color}40`,
                                  color: template.color,
                                }}
                              >
                                {template.badge}
                              </span>
                            </div>

                            <p className="text-xs font-mono text-zinc-400 min-h-[36px]">
                              {template.description}
                            </p>

                            {/* PERMISSIONS PREVIEW PILLS */}
                            <div className="pt-3 border-t border-zinc-900 flex flex-col gap-2">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-zinc-400">Permissions actives :</span>
                                <span className="font-bold text-amber-400">{enabledPermissionsCount} / 11</span>
                              </div>

                              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                                {template.permissions.can_access_dashboard && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Tableau de bord
                                  </span>
                                )}
                                {template.permissions.can_broadcast_live && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 text-[9.5px] font-mono border border-cyan-500/30">
                                    🎙️ Régie Direct
                                  </span>
                                )}
                                {template.permissions.can_manage_stations && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Stations
                                  </span>
                                )}
                                {template.permissions.can_manage_messages && (
                                  <span className="px-1.5 py-0.5 rounded bg-pink-950/60 text-pink-300 text-[9.5px] font-mono border border-pink-500/30">
                                    Dédicaces
                                  </span>
                                )}
                                {template.permissions.can_manage_programming && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 text-[9.5px] font-mono border border-emerald-500/30">
                                    Grille On-Air
                                  </span>
                                )}
                                {template.permissions.can_manage_events && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Événements
                                  </span>
                                )}
                                {template.permissions.can_manage_users && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 text-[9.5px] font-mono border border-amber-500/30">
                                    Comptes
                                  </span>
                                )}
                                {template.permissions.can_manage_database && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 text-[9.5px] font-mono border border-purple-500/30">
                                    PocketBase
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setEditingProfileTemplate(template)}
                            className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isSuper ? 'Voir le modèle' : 'Personnaliser ce profil'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MODAL 1: ATTRIBUTION RÔLE & PROFIL POUR UN UTILISATEUR */}
              {/* ========================================================= */}
              {selectedUserForRoleEdit && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-left animate-in fade-in zoom-in-95 duration-150">
                    
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-amber-400" />
                        <span className="text-base font-futuristic font-black text-white">
                          Attribuer Droits & Profil Administrateur
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedUserForRoleEdit(null)}
                        className="text-zinc-500 hover:text-white p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400 font-bold text-xs">
                        {selectedUserForRoleEdit.username?.slice(0, 2).toUpperCase() || 'US'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-mono font-bold text-white">
                          {selectedUserForRoleEdit.username || selectedUserForRoleEdit.email}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">
                          {selectedUserForRoleEdit.email}
                        </span>
                      </div>
                    </div>

                    {/* ROLE SELECTION */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-mono font-bold text-zinc-300">
                        1. Choisissez le type de compte :
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setRoleEditRole('super-admin')}
                          className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                            roleEditRole === 'super-admin'
                              ? 'bg-red-500/10 border-red-500 text-red-300 shadow-md shadow-red-500/10'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold flex items-center gap-1.5 text-red-400">
                            <Shield className="w-3.5 h-3.5" />
                            Super-Admin
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            Accès total & gestion complète
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoleEditRole('admin')}
                          className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                            roleEditRole === 'admin'
                              ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold flex items-center gap-1.5 text-amber-400">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Admin Délégué
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            Permissions selon profil
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoleEditRole('user')}
                          className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                            roleEditRole === 'user'
                              ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold flex items-center gap-1.5 text-zinc-300">
                            <Users className="w-3.5 h-3.5" />
                            Auditeur
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            Accès standard au lecteur
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* IF ADMIN: PROFILE TEMPLATE PICKER */}
                    {roleEditRole === 'admin' && (
                      <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 animate-in fade-in duration-150">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-mono font-bold text-amber-300">
                            2. Modèle de Profil Préconfiguré :
                          </label>
                          <select
                            value={roleEditProfileId}
                            onChange={(e) => setRoleEditProfileId(e.target.value)}
                            className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                          >
                            {profileTemplates.filter(t => t.id !== 'profile_super_admin').map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name} ({tpl.badge}) — {tpl.description}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-mono font-bold text-amber-300">
                            3. Station Radio Assignée :
                          </label>
                          <select
                            value={roleEditAssignedStation}
                            onChange={(e) => setRoleEditAssignedStation(e.target.value)}
                            className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none cursor-pointer"
                          >
                            <option value="all">🌍 Toutes les stations (Accès multi-fréquences)</option>
                            {stations.map((st) => (
                              <option key={st.id} value={st.id}>
                                📻 {st.name} ({st.genre})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* FOOTER ACTIONS */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setSelectedUserForRoleEdit(null)}
                        className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 text-xs font-mono cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveUserRole}
                        className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                      >
                        <Check className="w-4 h-4" />
                        <span>Enregistrer & Synchroniser</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* MODAL 2: ÉDITEUR D'UN MODÈLE DE PROFIL ADMINISTRATEUR */}
              {/* ========================================================= */}
              {editingProfileTemplate && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-left animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <Sliders className="w-5 h-5 text-amber-400" />
                        <span className="text-base font-futuristic font-black text-white">
                          Personnaliser le Modèle : {editingProfileTemplate.name}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingProfileTemplate(null)}
                        className="text-zinc-500 hover:text-white p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* TEMPLATE META */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-mono text-zinc-400 font-bold">Nom du Profil</label>
                        <input
                          type="text"
                          value={editingProfileTemplate.name}
                          onChange={(e) => setEditingProfileTemplate({
                            ...editingProfileTemplate,
                            name: e.target.value
                          })}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-mono text-zinc-400 font-bold">Badge Affiché</label>
                        <input
                          type="text"
                          value={editingProfileTemplate.badge}
                          onChange={(e) => setEditingProfileTemplate({
                            ...editingProfileTemplate,
                            badge: e.target.value
                          })}
                          className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-mono text-zinc-400 font-bold">Couleur Accent</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editingProfileTemplate.color}
                            onChange={(e) => setEditingProfileTemplate({
                              ...editingProfileTemplate,
                              color: e.target.value
                            })}
                            className="w-10 h-9 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={editingProfileTemplate.color}
                            onChange={(e) => setEditingProfileTemplate({
                              ...editingProfileTemplate,
                              color: e.target.value
                            })}
                            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-mono text-zinc-400 font-bold">Description de la mission</label>
                      <input
                        type="text"
                        value={editingProfileTemplate.description}
                        onChange={(e) => setEditingProfileTemplate({
                          ...editingProfileTemplate,
                          description: e.target.value
                        })}
                        className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    {/* GRANULAR PERMISSION CHECKBOXES */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-zinc-850">
                      <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                        Droits d'accès et modules autorisés :
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                          { key: 'can_access_dashboard', label: 'Tableau de bord modulable', desc: 'Surveillance et statistiques d\'antenne' },
                          { key: 'can_broadcast_live', label: 'Prise d\'antenne régie & DJ', desc: 'Console direct, micro studio et top horaire' },
                          { key: 'can_manage_stations', label: 'Stations & Flux Radio', desc: 'Gestion des fréquences et flux streaming' },
                          { key: 'can_manage_services', label: 'Services API & AzuraCast', desc: 'Gestion des clés API, AutoDJ et connecteurs' },
                          { key: 'can_manage_users', label: 'Gestion des Utilisateurs & Rôles', desc: 'Création et attribution des profils admin' },
                          { key: 'can_manage_messages', label: 'Messagerie & Dédicaces Direct', desc: 'Lecture et modération des messages auditeurs' },
                          { key: 'can_manage_programming', label: 'Grille TV / Radio On-Air', desc: 'Planification des programmes et émissions' },
                          { key: 'can_manage_events', label: 'Événements & Concerts', desc: 'Création et publication des dates d\'antenne' },
                          { key: 'can_manage_challenges', label: 'Quêtes & Défis XP', desc: 'Gamification et récompenses des auditeurs' },
                          { key: 'can_manage_promotions', label: 'Promotions & Boutique', desc: 'Gestion des codes promo et avantages' },
                          { key: 'can_manage_database', label: 'Base PocketBase SQLite', desc: 'Synchronisation et export de schéma' },
                        ].map(({ key, label, desc }) => {
                          const isChecked = !!editingProfileTemplate.permissions[key as keyof AdminPermissions];
                          return (
                            <div
                              key={key}
                              onClick={() => {
                                setEditingProfileTemplate({
                                  ...editingProfileTemplate,
                                  permissions: {
                                    ...editingProfileTemplate.permissions,
                                    [key]: !isChecked,
                                  }
                                });
                              }}
                              className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-zinc-900 border-amber-500/40'
                                  : 'bg-zinc-950 border-zinc-850 opacity-60 hover:opacity-100'
                              }`}
                            >
                              <div className="pt-0.5">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-600" />
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-mono font-bold text-white">{label}</span>
                                <span className="text-[10px] font-mono text-zinc-400">{desc}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setEditingProfileTemplate(null)}
                        className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 text-xs font-mono cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveProfileTemplate(editingProfileTemplate)}
                        className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                      >
                        <Check className="w-4 h-4" />
                        <span>Enregistrer le Profil</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* TAB 2: GESTION DES STATIONS RADIOS */}
        {activeTab === 'stations' && (
          <div className="flex flex-col gap-4">

            {/* SECTION HAUT DE PAGE : LIAISON COMPTE DJ STREAMER AZURACAST */}
            {djAccount && !isEditingDjLink ? (
              /* PASTILLE DJ CONNECTÉ */
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 relative">
                    <Mic className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono text-[10.5px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        DJ Connecté
                      </span>
                      <span className="text-white font-bold font-mono text-sm">
                        {djAccount.displayName}
                      </span>
                      <span className="text-zinc-400 font-mono text-xs">
                        (@{djAccount.username})
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Compte DJ unique autorisé pour la régie à distance & le streaming WebDJ</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDjFormUsername(djAccount.username);
                      setDjFormPassword(djAccount.password || '');
                      setDjFormDisplayName(djAccount.displayName || djAccount.username);
                      setDjFormStation(djAccount.stationShortcode || 'pop-variete');
                      setIsEditingDjLink(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Modifier les identifiants DJ liés"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modifier DJ</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlinkDjAccount}
                    disabled={isDjSaving}
                    className="p-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-300 hover:text-red-200 text-xs font-mono transition-all cursor-pointer"
                    title="Dissocier ce compte DJ du profil admin"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* FORMULAIRE DE LIAISON DJ COMPTE ADMIN */
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-cyan-950/20 border border-cyan-500/40 flex flex-col gap-3.5 shadow-xl text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-2">
                        <span>Liaison Compte DJ Streamer AzuraCast</span>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[9px] font-bold">
                          Admin Requis
                        </span>
                      </h4>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        Renseignez votre compte DJ AzuraCast pour activer la régie en direct, le microphone studio et le pilotage exclusif des stations.
                      </p>
                    </div>
                  </div>
                  {isEditingDjLink && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDjLink(false)}
                      className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="Annuler les modifications"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveDjAccount} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono font-bold text-zinc-300 uppercase flex items-center gap-1">
                      <span>Identifiant DJ :</span>
                      <span className="text-cyan-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ex: theocourant"
                      value={djFormUsername}
                      onChange={(e) => setDjFormUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-cyan-400 text-white text-xs font-mono placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono font-bold text-zinc-300 uppercase flex items-center gap-1">
                      <span>Mot de passe DJ :</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Mot de passe streamer"
                      value={djFormPassword}
                      onChange={(e) => setDjFormPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-cyan-400 text-white text-xs font-mono placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono font-bold text-zinc-300 uppercase flex items-center gap-1">
                      <span>Nom d'antenne (Public) :</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ex: Théo Direct"
                      value={djFormDisplayName}
                      onChange={(e) => setDjFormDisplayName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-cyan-400 text-white text-xs font-mono placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono font-bold text-zinc-300 uppercase flex items-center gap-1">
                      <span>Station par Défaut :</span>
                    </label>
                    <select
                      value={djFormStation}
                      onChange={(e) => setDjFormStation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-cyan-400 text-white text-xs font-mono outline-none transition-all cursor-pointer"
                    >
                      {stations.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between gap-3 pt-2">
                    <span className="text-[10.5px] font-mono text-zinc-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Ce compte sera le seul utilisé pour les prises d'antenne et les actions à distance.</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {isEditingDjLink && (
                        <button
                          type="button"
                          onClick={() => setIsEditingDjLink(false)}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono font-bold cursor-pointer transition-all"
                        >
                          Annuler
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isDjSaving}
                        className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer transition-all"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isDjSaving ? 'Enregistrement...' : 'Enregistrer & Activer DJ'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                Stations Radio Configurées ({stations.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await cleanupPocketBaseStationDuplicates();
                    if (res.removedCount > 0) {
                      showToast(`${res.removedCount} doublons purgés de PocketBase ! Il reste ${res.remainingCount} stations uniques.`);
                    } else {
                      showToast(`Aucun doublon trouvé en BDD (${res.remainingCount} stations uniques).`);
                    }
                    reloadData();
                    if (onRefreshAppState) onRefreshAppState();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Purger tous les doublons de la table synapse_stations sur PocketBase"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Nettoyer Doublons BDD</span>
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setStationFormName('');
                    setStationFormGenre('');
                    setStationFormDesc('');
                    setStationFormColor('#00f2ff');
                    setStationFormNumber(String(stations.length + 1).padStart(2, '0'));
                    setStationFormStreamUrl('');
                    setIsAddingNew(!isAddingNew);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer une Station</span>
                </button>
              </div>
            </div>

            {/* CREATE / EDIT STATION FORM */}
            {(isAddingNew || editingItem) && (
              <form onSubmit={handleSaveStation} className="p-4 rounded-2xl bg-zinc-900/90 border border-cyan-500/30 flex flex-col gap-3 shadow-lg text-left">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                  {editingItem ? 'Éditer la Station' : 'Nouvelle Station Radio'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Numéro de la station */}
                  <div className="flex flex-col gap-1 sm:col-span-1">
                    <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase">
                      N° de Station :
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 01, 88.4, 03..."
                      value={stationFormNumber}
                      onChange={(e) => setStationFormNumber(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-cyan-400"
                    />
                  </div>

                  {/* Nom de la station */}
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase">
                      Nom de la Station :
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nom (ex: Radio Synapse Jazz)"
                      value={stationFormName}
                      onChange={(e) => setStationFormName(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-cyan-400"
                    />
                  </div>

                  {/* Couleur de la station */}
                  <div className="flex flex-col gap-1 sm:col-span-1">
                    <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase">
                      Couleur Thème :
                    </label>
                    <input
                      type="color"
                      value={stationFormColor}
                      onChange={(e) => setStationFormColor(e.target.value)}
                      className="h-9 w-full rounded-xl bg-zinc-950 border border-white/15 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Genre musical */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase">
                      Genre Musical :
                    </label>
                    <input
                      type="text"
                      placeholder="Genre musical (ex: Jazz & Soul)"
                      value={stationFormGenre}
                      onChange={(e) => setStationFormGenre(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-cyan-400"
                    />
                  </div>

                  {/* Lien du flux Stream MP3/AAC */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-cyan-400 font-bold uppercase flex items-center gap-1">
                      <Link className="w-3 h-3 text-cyan-400" />
                      Lien du Flux Audio (Stream URL) :
                    </label>
                    <input
                      type="url"
                      placeholder="https://cast.radiosynapse.fr/listen/nom/radio.mp3"
                      value={stationFormStreamUrl}
                      onChange={(e) => setStationFormStreamUrl(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-cyan-500/40 text-cyan-200 text-xs font-mono focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-zinc-400 font-bold uppercase">
                    Description :
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Description de la station..."
                    value={stationFormDesc}
                    onChange={(e) => setStationFormDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-cyan-400 resize-none"
                  />
                </div>

                {/* Toggle Enable Switch */}
                <div className="flex items-center gap-3 pt-1 bg-zinc-950/60 p-2.5 rounded-xl border border-white/10">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stationFormEnabled}
                      onChange={(e) => setStationFormEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                  <span className="text-xs font-mono text-zinc-200 font-bold">
                    {stationFormEnabled ? 'Station activée sur le lecteur (TOGGLE ON)' : 'Station désactivée (masquée du lecteur) (TOGGLE OFF)'}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setIsAddingNew(false); setEditingItem(null); }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-mono cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-cyan-500 text-black font-bold text-xs font-mono cursor-pointer"
                  >
                    Enregistrer Station
                  </button>
                </div>
              </form>
            )}

            {/* STATIONS LIST */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stations.map((st) => (
                <div key={st.id} className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-3 shadow-md text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: st.color }} />
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-1.5">
                          {st.stationNumber && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              N° {st.stationNumber}
                            </span>
                          )}
                          <span className="text-sm font-bold text-white font-futuristic">{st.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-cyan-400">{st.genre}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleStationEnabled(st.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer border flex-shrink-0 ${
                        st.enabled !== false
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300 shadow-sm'
                          : 'bg-zinc-800 hover:bg-zinc-700 border-white/20 text-zinc-400 hover:text-white'
                      }`}
                      title={st.enabled !== false ? 'Cliquer pour désactiver (masquer du lecteur)' : 'Cliquer pour activer sur le lecteur'}
                    >
                      <span className={`w-2 h-2 rounded-full ${st.enabled !== false ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                      {st.enabled !== false ? 'ACTIF (ON)' : 'INACTIF (OFF)'}
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 text-left">{st.description}</p>

                  {(st.streamUrl || st.tracks?.[0]?.audioUrl) && (
                    <div className="text-[10px] font-mono text-cyan-300/80 bg-zinc-900 px-2.5 py-1 rounded-lg truncate border border-white/5 flex items-center gap-1.5">
                      <Link className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      <span className="truncate">{st.streamUrl || st.tracks?.[0]?.audioUrl}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-white/10 pt-2.5 gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedStationForControlDeck(st)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                      title="Ouvrir la régie et télécommande de cette station"
                    >
                      <Radio className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Régie & Télécommande</span>
                    </button>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[10px] font-mono text-zinc-500 mr-1 hidden sm:inline">ID: {st.id}</span>
                      <button
                        onClick={() => handleOpenEditStation(st)}
                        className="p-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 cursor-pointer"
                        title="Éditer la station"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStation(st.id)}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-red-400 cursor-pointer"
                        title="Supprimer station"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SERVICES & API (AZURACAST, POCKETBASE ET INTÉGRATIONS TIERS) */}
        {(activeTab === 'services' || activeTab === 'azuracast' || activeTab === 'database') && (
          <AdminServicesTab
            stations={stations}
            onOpenControlDeck={(st) => setSelectedStationForControlDeck(st)}
            showToast={showToast}
            dbStatus={dbStatus}
            onTestDatabase={handleTestDatabase}
            onPullRemoteData={handlePullRemoteData}
            onSyncDatabase={handleSyncDatabase}
            onCopySqlSchema={handleCopySqlSchema}
            onCopyJsonSchema={handleCopyJsonSchema}
            copiedSql={copiedSql}
            copiedJson={copiedJson}
            activeStationsCount={activeStationsCount}
            usersCount={users.length}
            challengesCount={challenges.length}
            promotionsCount={promotions.length}
            eventsCount={events.length}
          />
        )}

        {/* TAB 3: GESTION DES DÉFIS & QUÊTES AUDITEURS */}
        {activeTab === 'challenges' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Défis Proposés aux Auditeurs ({challenges.length})
              </span>
              <button
                onClick={() => {
                  setChallengeTitle('');
                  setChallengeDesc('');
                  setChallengeReward('');
                  setIsAddingNew(!isAddingNew);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer un Défi</span>
              </button>
            </div>

            {/* CREATE CHALLENGE FORM */}
            {(isAddingNew || editingItem) && (
              <form onSubmit={handleSaveChallenge} className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/30 flex flex-col gap-3 shadow-lg">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase">Créer ou Éditer un Défi</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Titre du défi (ex: Grand Blind Test Funk)"
                    value={challengeTitle}
                    onChange={(e) => setChallengeTitle(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                  />
                  <select
                    value={challengeType}
                    onChange={(e) => setChallengeType(e.target.value as ChallengeType)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                  >
                    <option value="stats">Type: Statistiques d'Écoute</option>
                    <option value="blind_test">Type: Blind Test / Quiz</option>
                    <option value="suggest_track">Type: Proposer un Titre</option>
                    <option value="custom">Type: Autre / Règle Configurable</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={challengeStationId}
                    onChange={(e) => setChallengeStationId(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                  >
                    <option value="all">Toutes les Stations</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Points (ex: 200)"
                    value={challengePoints}
                    onChange={(e) => setChallengePoints(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                  />
                  <input
                    type="text"
                    placeholder="Récompense (ex: Badge VIP Gold)"
                    value={challengeReward}
                    onChange={(e) => setChallengeReward(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                  />
                </div>

                <textarea
                  rows={2}
                  placeholder="Consignes et description du défi pour l'auditeur..."
                  value={challengeDesc}
                  onChange={(e) => setChallengeDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400 resize-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddingNew(false); setEditingItem(null); }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-mono cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs font-mono cursor-pointer"
                  >
                    Publier Défi
                  </button>
                </div>
              </form>
            )}

            {/* CHALLENGES LIST */}
            <div className="flex flex-col gap-2.5">
              {challenges.map((c) => (
                <div key={c.id} className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-2 text-left">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase">
                        {c.type.toUpperCase().replace('_', ' ')}
                      </span>
                      <h4 className="text-sm font-bold text-white font-futuristic">{c.title}</h4>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-bold">+{c.points} PTS</span>
                  </div>

                  <p className="text-xs text-zinc-400">{c.desc}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] font-mono text-zinc-500">
                    <span>Station: {c.stationId === 'all' ? 'Globale (Toutes)' : c.stationId}</span>
                    <span>Récompense: {c.reward}</span>
                    <button
                      onClick={() => handleDeleteChallenge(c.id)}
                      className="p-1.5 rounded-lg bg-red-950/40 text-red-400 cursor-pointer hover:bg-red-950"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: GESTION DES PROMOTIONS */}
        {activeTab === 'promotions' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                Promotions & Codes Avantages ({promotions.length})
              </span>
              <button
                onClick={() => {
                  setPromoTitle('');
                  setPromoDesc('');
                  setPromoPrice('');
                  setPromoCode('');
                  setIsAddingNew(!isAddingNew);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle Promo</span>
              </button>
            </div>

            {/* CREATE PROMO FORM */}
            {(isAddingNew || editingItem) && (
              <form onSubmit={handleSavePromotion} className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 flex flex-col gap-3 shadow-lg text-left">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Nouvelle Promotion</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Titre (ex: Pass Festival Electro)"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-emerald-400"
                  />
                  <input
                    type="text"
                    placeholder="Tag réduction (ex: -20% code SYNAPSE20)"
                    value={promoTag}
                    onChange={(e) => setPromoTag(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Prix réduit (ex: 28,00 €)"
                    value={promoPrice}
                    onChange={(e) => setPromoPrice(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-emerald-400"
                  />
                  <input
                    type="text"
                    placeholder="Prix d'origine (ex: 35,00 €)"
                    value={promoOldPrice}
                    onChange={(e) => setPromoOldPrice(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-emerald-400"
                  />
                  <input
                    type="text"
                    placeholder="Code Promo (ex: SYNAPSE20)"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-emerald-400"
                  />
                </div>

                <textarea
                  rows={2}
                  placeholder="Description..."
                  value={promoDesc}
                  onChange={(e) => setPromoDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-emerald-400 resize-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddingNew(false); setEditingItem(null); }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-mono cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs font-mono cursor-pointer"
                  >
                    Enregistrer Promo
                  </button>
                </div>
              </form>
            )}

            {/* PROMOTIONS LIST */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {promotions.map((p) => (
                <div key={p.id} className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                      {p.tag}
                    </span>
                    <span className="text-xs font-bold font-mono text-emerald-400">{p.price}</span>
                  </div>

                  <h4 className="text-sm font-bold text-white font-futuristic">{p.title}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-2">{p.desc}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[10px] font-mono text-zinc-500">Code: {p.codePromo || 'Aucun'}</span>
                    <button
                      onClick={() => handleDeletePromotion(p.id)}
                      className="p-1.5 rounded-lg bg-red-950/40 text-red-400 cursor-pointer hover:bg-red-950"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: PROGRAMMATION & GRILLE TV/RADIO */}
        {activeTab === 'programming' && (
          <div className="flex flex-col gap-4 text-left">
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white font-futuristic">Gestion des Tranches Horaires</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Les grilles d'antenne (Morning, Day, Evening, Night) sont automatiquement synchronisées selon la station sélectionnée.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: GESTION DES ÉVÉNEMENTS */}
        {activeTab === 'events' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-purple-400" />
                Événements Live & Retransmissions ({events.length})
              </span>
              <button
                onClick={() => {
                  setEventTitle('');
                  setEventDate('');
                  setEventLocation('');
                  setEventDesc('');
                  setIsAddingNew(!isAddingNew);
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvel Événement</span>
              </button>
            </div>

            {/* CREATE EVENT FORM */}
            {(isAddingNew || editingItem) && (
              <form onSubmit={handleSaveEvent} className="p-4 rounded-2xl bg-zinc-900/90 border border-purple-500/30 flex flex-col gap-3 shadow-lg text-left">
                <span className="text-xs font-mono font-bold text-purple-400 uppercase">Créer un Événement</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Titre de l'événement"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-purple-400"
                  />
                  <input
                    type="text"
                    placeholder="Date (ex: 15 - 18 Mai 2026)"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-purple-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Lieu (ex: Paris Rooftop 11e)"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-purple-400"
                  />
                  <input
                    type="text"
                    placeholder="Mode de diffusion (ex: Audio Spatial 320k)"
                    value={eventBroadcast}
                    onChange={(e) => setEventBroadcast(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-purple-400"
                  />
                </div>

                <textarea
                  rows={2}
                  placeholder="Description..."
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-purple-400 resize-none"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isLiveSoon"
                    checked={eventIsLiveSoon}
                    onChange={(e) => setEventIsLiveSoon(e.target.checked)}
                    className="rounded border-white/20 bg-zinc-950 text-purple-500"
                  />
                  <label htmlFor="isLiveSoon" className="text-xs font-mono text-zinc-300 cursor-pointer">
                    Marquer "DIRECT BIENTÔT"
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddingNew(false); setEditingItem(null); }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-mono cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-purple-500 text-black font-bold text-xs font-mono cursor-pointer"
                  >
                    Créer Événement
                  </button>
                </div>
              </form>
            )}

            {/* EVENTS LIST */}
            <div className="flex flex-col gap-2.5">
              {events.map((ev) => (
                <div key={ev.id} className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-2 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white font-futuristic">{ev.title}</h4>
                    <span className="text-xs font-mono text-purple-400 font-bold">{ev.date}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{ev.desc}</p>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px] font-mono text-zinc-500">
                    <span>Lieu: {ev.location}</span>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-1.5 rounded-lg bg-red-950/40 text-red-400 cursor-pointer hover:bg-red-950"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: GESTION DE LA MESSAGERIE & RÉGIE */}
        {activeTab === 'messages' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                <Mail className="w-4 h-4 text-pink-400" />
                Boîte de Réception & Dédicaces ({messages.length})
              </span>
            </div>

            {messages.length === 0 ? (
              <div className="p-6 rounded-2xl bg-zinc-950 border border-white/10 text-center text-zinc-500 text-xs font-mono">
                Aucun message d'auditeur pour le moment.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 text-left">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      m.isRead ? 'bg-zinc-950/60 border-white/10 opacity-75' : 'bg-zinc-950 border-pink-500/40 shadow-lg'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-mono font-bold uppercase">
                          {m.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-white font-mono">{m.authorName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-200 mt-2 font-mono bg-zinc-900/80 p-2.5 rounded-xl border border-white/5">
                      "{m.message}"
                    </p>

                    <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-2">
                      <span className="text-[10px] font-mono text-zinc-400">
                        Email: {m.email || 'Non renseigné'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleMessageRead(m.id)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[10.5px] font-mono cursor-pointer"
                        >
                          {m.isRead ? 'Marquer Non Lu' : 'Marquer Traité / Lu'}
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(m.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 text-red-400 cursor-pointer hover:bg-red-950"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 8: GESTION DE LA BASE DE DONNÉES POCKETBASE (UNIFIÉE DANS SERVICES & API) */}
        {false && activeTab === 'database' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">

            {/* SYNC ENTITIES STATUS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
              
              {/* ENTITY 1: STATIONS */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-cyan-500/30 flex flex-col justify-between gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono font-bold">
                    <Radio className="w-4 h-4" />
                    <span>STATIONS RADIO</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/40">
                    synapse_stations
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-mono font-black text-white">{stations.length} stations</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {stations.filter(s => s.enabled !== false).length} actives • URLs & métadonnées persistées
                  </span>
                </div>
              </div>

              {/* ENTITY 2: MESSAGES */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-pink-500/30 flex flex-col justify-between gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-pink-300 text-xs font-mono font-bold">
                    <Mail className="w-4 h-4" />
                    <span>MESSAGES & DÉDICACES</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-mono border border-pink-500/40">
                    synapse_messages
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-mono font-black text-white">{messages.length} messages</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {messages.filter(m => !m.isRead).length} non lus • Dédicaces studio persistées
                  </span>
                </div>
              </div>

              {/* ENTITY 3: LIKED TRACKS */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-red-500/30 flex flex-col justify-between gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-300 text-xs font-mono font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>TITRES LIKÉS UTILISATEURS</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-mono border border-red-500/40">
                    user_synapse_data
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-mono font-black text-white">Likes & Superlikes</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Synchronisation automatique par compte utilisateur
                  </span>
                </div>
              </div>

              {/* ENTITY 4: CHALLENGES */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/30 flex flex-col justify-between gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-mono font-bold">
                    <Trophy className="w-4 h-4" />
                    <span>DÉFIS & XP</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/40">
                    synapse_challenges
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-mono font-black text-white">{challenges.length} défis</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    XP, récompenses et progression
                  </span>
                </div>
              </div>

              {/* ENTITY 5: PROMOTIONS */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-emerald-500/30 flex flex-col justify-between gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-mono font-bold">
                    <Tag className="w-4 h-4" />
                    <span>PROMOTIONS & BOUTIQUE</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/40">
                    synapse_promotions
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-mono font-black text-white">{promotions.length} offres</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Codes promo, tarifs et liens boutique
                  </span>
                </div>
              </div>

              {/* ENTITY 6: EVENTS */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-purple-500/30 flex flex-col justify-between gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 text-xs font-mono font-bold">
                    <CalendarDays className="w-4 h-4" />
                    <span>ÉVÉNEMENTS & CONCERTS</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono border border-purple-500/40">
                    synapse_events
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-mono font-black text-white">{events.length} événements</span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Dates, lieux et retransmissions direct
                  </span>
                </div>
              </div>

            </div>

            {/* POCKETBASE 1-CLICK IMPORT JSON CARD */}
            <div className="p-5 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 flex flex-col gap-3 text-left shadow-xl">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Schéma PocketBase JSON (Import en 1 Clic : Settings &gt; Export/Import collections)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/pb_schema.json"
                    download="pb_schema.json"
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Télécharger pb_schema.json</span>
                  </a>
                  <button
                    onClick={handleCopyJsonSchema}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Copié !' : 'Copier pb_schema.json'}</span>
                  </button>
                </div>
              </div>

              <p className="text-xs font-mono text-zinc-400">
                Dans l'interface PocketBase (<code className="text-emerald-300 font-bold">https://db.radiosynapse.fr/_/</code>), allez dans <strong>Settings &gt; Export/Import collections &gt; Load from JSON</strong> et importez ce fichier pour configurer instantanément toutes les collections et API Rules.
              </p>
            </div>

            {/* SQLITE SCHEMA & TABLES INFO CARD */}
            <div className="p-5 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-3 text-left shadow-xl">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Structure SQLite PocketBase (Documentation Technique)
                  </span>
                </div>

                <button
                  onClick={handleCopySqlSchema}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copié !' : 'Copier le script SQL'}</span>
                </button>
              </div>

              <p className="text-xs font-mono text-zinc-400">
                Structure SQLite correspondante aux tables PocketBase créées dans votre instance.
              </p>

              <pre className="p-4 rounded-xl bg-zinc-950 border border-white/10 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-60 custom-scrollbar leading-relaxed">
                {POCKETBASE_SQLITE_SCHEMA_SQL}
              </pre>
            </div>
          </div>
        )}

        </main>
      </div>

      {/* STATION CONTROL DECK MODAL */}
      <StationControlDeckModal
        isOpen={!!selectedStationForControlDeck}
        onClose={() => setSelectedStationForControlDeck(null)}
        station={selectedStationForControlDeck}
        onRefreshData={() => {
          loadRemoteAdminData();
          onRefreshAppState?.();
        }}
      />

      {/* SIDEBAR REORDER & CUSTOMIZATION MODAL */}
      <AdminSidebarEditorModal
        isOpen={isSidebarEditorOpen}
        onClose={() => setIsSidebarEditorOpen(false)}
        items={sidebarOrder}
        tabsMeta={TABS_METADATA}
        onSave={(newOrder) => {
          setSidebarOrder(newOrder);
          saveSidebarOrder(newOrder);
          showToast('Ordre du menu latéral mis à jour avec succès.');
        }}
      />
    </div>
  );
}
