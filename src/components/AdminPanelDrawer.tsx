import { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Users, Radio, Trophy, Tag, Calendar, CalendarDays, 
  Mail, Plus, Trash2, CheckCircle2, Link, Edit3, ArrowLeft,
  LayoutDashboard, Sparkles, X, RefreshCw,
  Server, Database, Check, Copy, HardDrive,
  MoreVertical, Settings, RotateCcw, Mic, Zap, Key,
  UserCheck, Unlink, Shield, Sliders, 
  UserPlus, CheckSquare, Square,
  Flame, Music, ListMusic, FileText, Archive, Award,
  PanelLeftClose, PanelLeftOpen,
  Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX
} from 'lucide-react';
import { StreamChannel } from '../data';
import { SynapseUser, UserRole, StreamDjAccount, AdminPermissions, AdminProfileTemplate } from '../types';
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
  fetchSupabaseUsers,
  loadRemoteAdminData,
  cleanupSupabaseStationDuplicates
} from '../utils/adminStore';
import {
  getTrackSubmissions,
  approveTrackSubmission,
  rejectTrackSubmission,
  TrackSubmission,
  getConstantChallenges,
  saveConstantChallenges,
  ConstantChallengeConfig,
  SuggestMusicCriteria
} from '../utils/challengesStore';
import { 
  updateUserRoleInSupabase, 
  getStoredSynapseUser, 
  saveAdminDjAccount, 
  unlinkAdminDjAccount, 
  getLinkedAdminDjAccount, 
  restoreSupabaseAuthSession
} from '../utils/supabaseAuthService';
import { testSupabaseConnection, SUPABASE_SQL_SCHEMA } from '../lib/supabase';
import { liveBroadcastEngine } from '../utils/liveBroadcastEngine';
import { applyAdminDjCredentialsToStations } from '../lib/streamServer';
import StationControlDeckModal from './StationControlDeckModal';
import AdminServicesTab, { ServiceSection } from './AdminServicesTab';
import AdminDashboardView from './AdminDashboardView';
import AdminRegieLiquidsoapView from './AdminRegieLiquidsoapView';
import { AdminStationManagementView } from './AdminStationManagementView';
import { AdminRegieAnimationView } from './AdminRegieAnimationView';
import { AdminMusicLibraryView } from './AdminMusicLibraryView';
import { AdminPlaylistsView } from './AdminPlaylistsView';
import { AdminEmissionPrepView } from './AdminEmissionPrepView';
import AdminInteractiveProgrammingAgenda from './AdminInteractiveProgrammingAgenda';
import { AdminFeatureFlagsView } from './AdminFeatureFlagsView';
import AdminSidebarEditorModal from './AdminSidebarEditorModal';
import { AdminTab, SidebarItemConfig } from '../types/adminCustomization';
import { useSiteFeatureFlags } from '../utils/siteFeatureFlagsStore';
import { 
  getSavedSidebarOrder, 
  saveSidebarOrder, 
  resetSidebarOrder,
  syncCustomizationsWithSupabase
} from '../utils/adminCustomizationStore';

interface AdminPanelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentStationId?: string;
  currentUser?: SynapseUser | null;
  onRefreshAppState?: () => void;
  activeStream?: StreamChannel;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onNextStation?: () => void;
  onPrevStation?: () => void;
  volume?: number;
  onVolumeChange?: (vol: number) => void;
}

const TABS_METADATA: Record<AdminTab, { label: string; sublabel: string; icon: any }> = {
  dashboard: { label: 'Tableau de bord', sublabel: "Vue d'ensemble", icon: LayoutDashboard },
  stations_management: { label: 'Gestion des Stations', sublabel: 'Super-Admin • Flux & Serveurs', icon: Radio },
  regie_animation: { label: 'Régie & Animation', sublabel: 'Micro Direct & Jingles', icon: Mic },
  music_library: { label: 'Bibliothèque Musique', sublabel: 'Titres, tags & audio', icon: Music },
  playlists: { label: 'Playlists & Rotations', sublabel: 'Auto-DJ & Programmation', icon: ListMusic },
  emission_prep: { label: 'Préparation Émissions', sublabel: "Conducteurs d'antenne", icon: FileText },
  programming: { label: 'Grille TV/Radio', sublabel: 'Programmes & Agenda', icon: Calendar },
  messages: { label: 'Messagerie Studio', sublabel: 'Dédicaces & direct', icon: Mail },
  events: { label: 'Événements', sublabel: 'Concerts & lives', icon: CalendarDays },
  challenges: { label: 'Défis & XP', sublabel: 'Gamification', icon: Trophy },
  promotions: { label: 'Promotions', sublabel: 'Boutique', icon: Tag },
  users: { label: 'Utilisateurs', sublabel: 'Gestion des comptes & rôles', icon: Users },
  services: { label: 'Services & API', sublabel: 'Supabase, Liquidsoap & Tiers', icon: Server },
  features: { label: 'Fonctionnalités', sublabel: 'Gestion du site & modules', icon: Sliders },
  stations: { label: 'Stations (Ancien)', sublabel: 'Diffusion & Liquidsoap', icon: Radio },
  streaming: { label: 'Serveur de flux', sublabel: 'Passerelle & Régie', icon: Server },
  database: { label: 'Supabase', sublabel: 'Base PostgreSQL', icon: Database },
};

export const TAB_COLOR_CONFIGS: Record<AdminTab, {
  text: string;
  bg: string;
  border: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  accentGlow: string;
  barBg: string;
}> = {
  dashboard: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    activeBg: 'bg-cyan-500/20',
    activeBorder: 'border-cyan-400/50',
    activeText: 'text-cyan-300',
    accentGlow: 'shadow-[0_0_12px_rgba(6,182,212,0.25)]',
    barBg: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]',
  },
  stations_management: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    activeBg: 'bg-amber-500/20',
    activeBorder: 'border-amber-400/50',
    activeText: 'text-amber-300',
    accentGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    barBg: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
  },
  regie_animation: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    activeBg: 'bg-rose-500/20',
    activeBorder: 'border-rose-400/50',
    activeText: 'text-rose-300',
    accentGlow: 'shadow-[0_0_12px_rgba(251,113,133,0.25)]',
    barBg: 'bg-rose-400 shadow-[0_0_8px_#fb7185]',
  },
  music_library: {
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    activeBg: 'bg-violet-500/20',
    activeBorder: 'border-violet-400/50',
    activeText: 'text-violet-300',
    accentGlow: 'shadow-[0_0_12px_rgba(167,139,250,0.25)]',
    barBg: 'bg-violet-400 shadow-[0_0_8px_#a78bfa]',
  },
  playlists: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    activeBg: 'bg-sky-500/20',
    activeBorder: 'border-sky-400/50',
    activeText: 'text-sky-300',
    accentGlow: 'shadow-[0_0_12px_rgba(56,189,248,0.25)]',
    barBg: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
  },
  emission_prep: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    activeBg: 'bg-amber-500/20',
    activeBorder: 'border-amber-400/50',
    activeText: 'text-amber-300',
    accentGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    barBg: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
  },
  stations: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    activeBg: 'bg-amber-500/20',
    activeBorder: 'border-amber-400/50',
    activeText: 'text-amber-300',
    accentGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    barBg: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
  },
  services: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    activeBg: 'bg-emerald-500/20',
    activeBorder: 'border-emerald-400/50',
    activeText: 'text-emerald-300',
    accentGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    barBg: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
  },
  users: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    activeBg: 'bg-sky-500/20',
    activeBorder: 'border-sky-400/50',
    activeText: 'text-sky-300',
    accentGlow: 'shadow-[0_0_12px_rgba(56,189,248,0.25)]',
    barBg: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
  },
  messages: {
    text: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    activeBg: 'bg-pink-500/20',
    activeBorder: 'border-pink-400/50',
    activeText: 'text-pink-300',
    accentGlow: 'shadow-[0_0_12px_rgba(244,114,182,0.25)]',
    barBg: 'bg-pink-400 shadow-[0_0_8px_#f472b6]',
  },
  programming: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    activeBg: 'bg-purple-500/20',
    activeBorder: 'border-purple-400/50',
    activeText: 'text-purple-300',
    accentGlow: 'shadow-[0_0_12px_rgba(192,132,252,0.25)]',
    barBg: 'bg-purple-400 shadow-[0_0_8px_#c084fc]',
  },
  events: {
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    activeBg: 'bg-rose-500/20',
    activeBorder: 'border-rose-400/50',
    activeText: 'text-rose-300',
    accentGlow: 'shadow-[0_0_12px_rgba(251,113,133,0.25)]',
    barBg: 'bg-rose-400 shadow-[0_0_8px_#fb7185]',
  },
  challenges: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    activeBg: 'bg-yellow-500/20',
    activeBorder: 'border-yellow-400/50',
    activeText: 'text-yellow-300',
    accentGlow: 'shadow-[0_0_12px_rgba(250,204,21,0.25)]',
    barBg: 'bg-yellow-400 shadow-[0_0_8px_#facc15]',
  },
  promotions: {
    text: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
    activeBg: 'bg-teal-500/20',
    activeBorder: 'border-teal-400/50',
    activeText: 'text-teal-300',
    accentGlow: 'shadow-[0_0_12px_rgba(45,212,191,0.25)]',
    barBg: 'bg-teal-400 shadow-[0_0_8px_#2dd4bf]',
  },
  features: {
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    activeBg: 'bg-indigo-500/20',
    activeBorder: 'border-indigo-400/50',
    activeText: 'text-indigo-300',
    accentGlow: 'shadow-[0_0_12px_rgba(129,140,248,0.25)]',
    barBg: 'bg-indigo-400 shadow-[0_0_8px_#818cf8]',
  },
  streaming: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    activeBg: 'bg-emerald-500/20',
    activeBorder: 'border-emerald-400/50',
    activeText: 'text-emerald-300',
    accentGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    barBg: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
  },
  database: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    activeBg: 'bg-emerald-500/20',
    activeBorder: 'border-emerald-400/50',
    activeText: 'text-emerald-300',
    accentGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    barBg: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
  },
};

export default function AdminPanelDrawer({
  isOpen,
  onClose,
  currentStationId = 'all',
  currentUser: propCurrentUser,
  onRefreshAppState,
  activeStream: propActiveStream,
  isPlaying = false,
  onTogglePlay,
  onNextStation,
  onPrevStation,
  volume = 0.85,
  onVolumeChange,
}: AdminPanelDrawerProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [regieSubTab, setRegieSubTab] = useState<'liquidsoap' | 'stations_meta'>('liquidsoap');
  const [servicesSubTab, setServicesSubTab] = useState<ServiceSection>('liquidsoap_icecast');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarManuallyOpen, setIsSidebarManuallyOpen] = useState(false);
  const hoveredIconsRef = useRef<Set<string>>(new Set());
  const isSidebarDeployed = isSidebarHovered || isSidebarManuallyOpen || mobileSidebarOpen;
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mobile station player & retractable volume state
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!isVolumeOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (volumeContainerRef.current && !volumeContainerRef.current.contains(e.target as Node)) {
        setIsVolumeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVolumeOpen]);

  // 1 SCROLL = 1 ICON SNAP-SCROLL LOGIC (NO MOUSE SCROLLBAR)
  const [sidebarScrollIndex, setSidebarScrollIndex] = useState(0);
  const isThrottlingWheelRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);

  // Reactive Site Feature Flags
  const { isFeatureEnabled, flags: siteFeatureFlags } = useSiteFeatureFlags();

  // Sidebar Order Customization State
  const [sidebarOrder, setSidebarOrder] = useState<SidebarItemConfig[]>(() => getSavedSidebarOrder());
  const [isSidebarEditorOpen, setIsSidebarEditorOpen] = useState(false);
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);

  // Selected Station for Station Control Deck Modal
  const [selectedStationForControlDeck, setSelectedStationForControlDeck] = useState<StreamChannel | null>(null);

  // Supabase Database State
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
  const [copiedJson] = useState(false);

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
  const [roleEditAssignedStations, setRoleEditAssignedStations] = useState<string[]>([]);
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

  // 3. Challenge Management State & SubTabs
  const [challengeTab, setChallengeTab] = useState<'active' | 'submissions' | 'selected' | 'archives' | 'constant'>('active');
  const [submissions, setSubmissions] = useState<TrackSubmission[]>(() => getTrackSubmissions());
  const [constantChallenges, setConstantChallenges] = useState<ConstantChallengeConfig[]>(() => getConstantChallenges());
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeDesc, setChallengeDesc] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('suggest_music');
  const [challengeStationId, setChallengeStationId] = useState('all');
  const [challengePoints, setChallengePoints] = useState(150);
  const [challengeReward, setChallengeReward] = useState('');

  // Specific criteria for "Propose ta musique"
  const [challengeGenre, setChallengeGenre] = useState('');
  const [challengeSubGenre, setChallengeSubGenre] = useState('');
  const [challengeArtist, setChallengeArtist] = useState('');
  const [challengeRefTrack, setChallengeRefTrack] = useState('');
  const [challengeYear, setChallengeYear] = useState('');
  const [challengeEmotion, setChallengeEmotion] = useState('');
  const [challengeMinPlays, setChallengeMinPlays] = useState<number | undefined>();
  const [challengeOtherReq, setChallengeOtherReq] = useState('');

  // Specific criteria for "Partage tes trouvailles" & "Écoute bien"
  const [challengeRequiredShares, setChallengeRequiredShares] = useState(5);
  const [challengeRequiredMinutes, setChallengeRequiredMinutes] = useState(30);

  // 4. Promotion Form
  const [promoTitle, setPromoTitle] = useState('');
  const [promoTag, setPromoTag] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [promoOldPrice, setPromoOldPrice] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoPointsCost, setPromoPointsCost] = useState(150);
  const [promoIsStockLimited, setPromoIsStockLimited] = useState(false);
  const [promoInitialStock, setPromoInitialStock] = useState(25);

  // 5. Event Form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventBroadcast, setEventBroadcast] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventIsLiveSoon, setEventIsLiveSoon] = useState(false);

  // --- ADMIN DJ STREAMER ACCOUNT LINKING STATE ---
  const [currentUser, setCurrentUser] = useState<SynapseUser | null>(() => propCurrentUser || getStoredSynapseUser());
  const [djAccount, setDjAccount] = useState<StreamDjAccount | null>(() => {
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
    setSubmissions(getTrackSubmissions());
    setConstantChallenges(getConstantChallenges());

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

    // Pull authentic registered users directly from Supabase database
    fetchSupabaseUsers().then((res) => {
      if (res.data && res.data.length > 0) {
        setUsers(res.data);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
      
      // Sync layout customizations from Supabase cloud
      syncCustomizationsWithSupabase().then((res) => {
        if (res.sidebar) setSidebarOrder(res.sidebar);
      }).catch(() => {});

      // Restore session to check latest DJ account bindings
      restoreSupabaseAuthSession().then((u) => {
        if (u) {
          setCurrentUser(u);
          const linked = getLinkedAdminDjAccount(u);
          setDjAccount(linked);
          if (linked) {
            setDjFormUsername(linked.username);
            setDjFormPassword(linked.password || '');
            setDjFormDisplayName(linked.displayName || linked.username);
            setDjFormStation(linked.stationShortcode || 'pop-variete');
            
            // Sync credentials to broadcast engine and station mappings
            liveBroadcastEngine.saveCredentials({
              username: linked.username,
              password: linked.password || '',
            });
            setStations(prev => applyAdminDjCredentialsToStations(prev, linked));
          }
        }
      });

      // Test Supabase connection silently on open
      testSupabaseConnection().then((res: { ok: boolean; message: string }) => {
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
      };

      const updatedUser = await saveAdminDjAccount(activeUser, {
        username: djFormUsername.trim(),
        password: djFormPassword.trim(),
        displayName: djFormDisplayName.trim() || djFormUsername.trim(),
        stationShortcode: djFormStation || 'pop-variete',
      });

      setCurrentUser(updatedUser);
      setDjAccount(updatedUser.djAccount || null);
      setIsEditingDjLink(false);

      // Apply credentials to liveBroadcastEngine
      liveBroadcastEngine.saveCredentials({
        username: djFormUsername.trim(),
        password: djFormPassword.trim(),
      });

      // Apply to all station mappings
      setStations(prev => applyAdminDjCredentialsToStations(prev, updatedUser.djAccount));

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

  // --- SUPABASE DATABASE HANDLERS ---
  const handleTestDatabase = async () => {
    setDbStatus((prev) => ({ ...prev, isTesting: true, message: 'Vérification Supabase...' }));
    const result = await testSupabaseConnection();
    setDbStatus((prev) => ({
      ...prev,
      isTesting: false,
      ok: result.ok,
      message: result.message,
    }));
    showToast(result.ok ? 'Connexion Supabase PostgreSQL & Realtime active !' : result.message);
  };

  const handleSyncDatabase = async () => {
    setDbStatus((prev) => ({
      ...prev,
      isSyncing: false,
      ok: true,
      message: 'Canaux Realtime Supabase connectés.',
    }));
    showToast('Synchronisation automatique en temps réel active.');
    reloadData();
    if (onRefreshAppState) onRefreshAppState();
  };

  const handlePullRemoteData = async () => {
    setDbStatus((prev) => ({ ...prev, isSyncing: true, message: 'Vérification données...' }));
    const success = await loadRemoteAdminData();
    reloadData();
    if (onRefreshAppState) onRefreshAppState();
    setDbStatus((prev) => ({
      ...prev,
      isSyncing: false,
      message: success ? 'Données chargées depuis Supabase !' : 'Données locales prêtes.',
    }));
    showToast('Données synchronisées en temps réel.');
  };

  const handleCopySqlSchema = async () => {
    try {
      const res = await fetch('/supabase_schema.sql');
      const text = await res.text();
      navigator.clipboard.writeText(text);
      setCopiedSql(true);
      showToast('Script SQL Supabase copié !');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      showToast('Impossible de copier le schéma SQL.');
    }
  };

  const handleCopyJsonSchema = async () => {
    window.open('/vps-infrastructure-guide.html', '_blank');
  };

  // --- USER & ADMIN PROFILES HANDLERS ---
  const handleOpenEditUserRole = (targetUser: SynapseUser) => {
    setSelectedUserForRoleEdit(targetUser);
    setRoleEditRole(targetUser.role || 'user');
    setRoleEditProfileId(
      targetUser.adminProfileId || 
      (targetUser.role === 'super-admin' ? 'profile_super_admin' : (targetUser.role === 'admin' ? 'profile_general_admin' : 'profile_animateur'))
    );
    setRoleEditAssignedStations(
      targetUser.assignedStationIds && targetUser.assignedStationIds.length > 0 
        ? targetUser.assignedStationIds 
        : (targetUser.assignedStationId && targetUser.assignedStationId !== 'all' ? [targetUser.assignedStationId] : [])
    );
  };

  const handleSaveUserRole = async () => {
    if (!selectedUserForRoleEdit) return;

    const targetId = selectedUserForRoleEdit.id;
    const finalProfileId = roleEditRole === 'user' ? undefined : (roleEditRole === 'super-admin' ? 'profile_super_admin' : roleEditProfileId);
    const finalStationIds = roleEditRole === 'user' ? undefined : roleEditAssignedStations;
    const finalStationId = roleEditRole === 'user' ? undefined : (roleEditAssignedStations.length === 1 ? roleEditAssignedStations[0] : (roleEditAssignedStations.length === 0 ? 'all' : roleEditAssignedStations[0]));

    const updated = users.map((u) => {
      if (u.id === targetId) {
        return {
          ...u,
          role: roleEditRole,
          adminProfileId: finalProfileId,
          assignedStationId: finalStationId,
          assignedStationIds: finalStationIds,
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
        assignedStationIds: finalStationIds,
      };
      setCurrentUser(updatedCurrent);
    }

    // Persist to Supabase
    await updateUserRoleInSupabase(targetId, roleEditRole, finalProfileId, finalStationId).catch(() => {});

    setSelectedUserForRoleEdit(null);
    showToast(`Droits et profil mis à jour pour ${selectedUserForRoleEdit.username || selectedUserForRoleEdit.email} !`);
  };

  const handleUpdateUserStations = (userId: string, stationIds: string[]) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          assignedStationIds: stationIds,
          assignedStationId: stationIds.length === 1 ? stationIds[0] : (stationIds.length === 0 ? undefined : 'all'),
        };
      }
      return u;
    });
    setUsers(updated);
    saveAdminUsers(updated);
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({
        ...currentUser,
        assignedStationIds: stationIds,
        assignedStationId: stationIds.length === 1 ? stationIds[0] : (stationIds.length === 0 ? undefined : 'all'),
      });
    }
    showToast('Attribution des stations mise à jour.');
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
      points: 100,
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

    const criteria: SuggestMusicCriteria | undefined = challengeType === 'suggest_music' ? {
      genre: challengeGenre.trim() || undefined,
      subGenre: challengeSubGenre.trim() || undefined,
      artist: challengeArtist.trim() || undefined,
      referenceTrack: challengeRefTrack.trim() || undefined,
      year: challengeYear.trim() || undefined,
      emotion: challengeEmotion.trim() || undefined,
      minPlaysOrViews: challengeMinPlays ? Number(challengeMinPlays) : undefined,
      otherRequirements: challengeOtherReq.trim() || undefined,
    } : undefined;

    const newChallenge: AdminChallenge = {
      id: editingItem?.id || `challenge_${Date.now()}`,
      stationId: challengeStationId,
      title: challengeTitle,
      desc: challengeDesc,
      type: challengeType,
      points: Number(challengePoints) || 100,
      reward: challengeReward || 'Points & Badge auditeur',
      total: challengeType === 'share_liked_tracks' ? (challengeRequiredShares || 5) : challengeType === 'listening_time' ? (challengeRequiredMinutes || 30) : 5,
      progress: 0,
      completed: false,
      createdAt: Date.now(),
      criteria,
      requiredShares: challengeType === 'share_liked_tracks' ? Number(challengeRequiredShares) : undefined,
      requiredMinutes: challengeType === 'listening_time' ? Number(challengeRequiredMinutes) : undefined,
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

  const handleApproveTrackSubmission = (subId: string) => {
    const res = approveTrackSubmission(subId);
    if (res.success) {
      setSubmissions(getTrackSubmissions());
      showToast("Titre validé ! Les points ont été crédités à l'auditeur et le titre est sélectionné pour l'antenne.");
    }
  };

  const handleRejectTrackSubmission = (subId: string) => {
    const res = rejectTrackSubmission(subId);
    if (res.success) {
      setSubmissions(getTrackSubmissions());
      showToast('Proposition refusée et archivée.');
    }
  };

  const handleSaveConstantChallengePodium = (
    configId: string,
    place: 'first' | 'second' | 'third',
    val: number
  ) => {
    const updated = constantChallenges.map((c) =>
      c.id === configId ? { ...c, podium: { ...c.podium, [place]: val } } : c
    );
    setConstantChallenges(updated);
    saveConstantChallenges(updated);
    showToast('Configuration des points podiums hebdomadaires mise à jour !');
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
      pointsCost: promoPointsCost ? Number(promoPointsCost) : undefined,
      isStockLimited: promoIsStockLimited,
      initialStock: promoIsStockLimited ? Number(promoInitialStock) : undefined,
      remainingStock: promoIsStockLimited ? (editingItem?.remainingStock ?? Number(promoInitialStock)) : undefined,
      claimedUsers: editingItem?.claimedUsers || [],
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

  const unreadMessagesCount = messages.filter((m) => !m.isRead).length;
  const activeStationsCount = stations.filter((s) => s.enabled !== false).length;

  // Dynamic Activity & Alert tracking per tab
  const tabIndicators: Partial<Record<AdminTab, { activityCount: number; alertCount: number }>> = {
    dashboard: {
      activityCount: activeStationsCount,
      alertCount: (!dbStatus.ok ? 1 : 0) + (unreadMessagesCount > 0 ? 1 : 0),
    },
    stations_management: {
      activityCount: stations.length,
      alertCount: stations.filter((s) => s.enabled === false).length,
    },
    regie_animation: {
      activityCount: activeStationsCount,
      alertCount: 0,
    },
    music_library: {
      activityCount: 1,
      alertCount: 0,
    },
    playlists: {
      activityCount: activeStationsCount,
      alertCount: 0,
    },
    emission_prep: {
      activityCount: 1,
      alertCount: 0,
    },
    stations: {
      activityCount: activeStationsCount,
      alertCount: stations.filter((s) => s.enabled === false).length,
    },
    programming: {
      activityCount: 1,
      alertCount: 0,
    },
    services: {
      activityCount: 2, // Streaming API + Supabase
      alertCount: !dbStatus.ok ? 1 : 0,
    },
    users: {
      activityCount: users.length,
      alertCount: 0,
    },
    messages: {
      activityCount: messages.length,
      alertCount: unreadMessagesCount,
    },
    challenges: {
      activityCount: challenges.length,
      alertCount: submissions.filter((s) => s.status === 'pending').length,
    },
    promotions: {
      activityCount: promotions.length,
      alertCount: promotions.filter((p) => p.isStockLimited && (p.initialStock ?? 0) <= 5).length,
    },
    events: {
      activityCount: events.length,
      alertCount: events.filter((e) => e.isLiveSoon).length,
    },
    features: {
      activityCount: Object.values(siteFeatureFlags).filter(Boolean).length,
      alertCount: 0,
    },
  };

  const isSuper = isSuperAdmin(currentUser);

  const sidebarLinks = sidebarOrder
    .filter(item => {
      // Check feature flags: if a site feature is disabled, non-super-admins cannot see it
      if (item.id === 'challenges' && !isFeatureEnabled('challenges') && !isSuper) return false;
      if (item.id === 'promotions' && !isFeatureEnabled('promotions') && !isSuper) return false;
      if (item.id === 'events' && !isFeatureEnabled('events') && !isSuper) return false;
      if (item.id === 'messages' && !isFeatureEnabled('messages') && !isSuper) return false;
      if (item.id === 'programming' && !isFeatureEnabled('programming') && !isSuper) return false;
      if (item.id === 'features' && !isSuper) return false;

      if (isSuper) {
        return item.visible !== false;
      }
      return item.visible && canUserAccessTab(currentUser, item.id);
    })
    .map(item => {
      const meta = TABS_METADATA[item.id] || { label: item.id, sublabel: '', icon: LayoutDashboard };
      const indicator = tabIndicators[item.id] || { activityCount: 0, alertCount: 0 };
      return {
        id: item.id,
        label: meta.label,
        sublabel: meta.sublabel,
        icon: meta.icon,
        activityCount: indicator.activityCount,
        alertCount: indicator.alertCount,
      };
    });

  // 1 SCROLL = 1 ICON SNAP-SCROLL LOGIC (NO MOUSE SCROLLBAR)
  const ITEM_HEIGHT = 50; // 44px button + 6px gap

  // Keep index within bounds
  const maxScrollIndex = Math.max(0, sidebarLinks.length - 1);

  const handleSidebarWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isThrottlingWheelRef.current) return;
    if (Math.abs(e.deltaY) >= 10) {
      if (e.deltaY > 0) {
        setSidebarScrollIndex((prev) => Math.min(prev + 1, maxScrollIndex));
      } else {
        setSidebarScrollIndex((prev) => Math.max(prev - 1, 0));
      }
      isThrottlingWheelRef.current = true;
      setTimeout(() => {
        isThrottlingWheelRef.current = false;
      }, 130);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null || isThrottlingWheelRef.current) return;
    const delta = touchStartYRef.current - e.touches[0].clientY;
    if (Math.abs(delta) >= 20) {
      if (delta > 0) {
        setSidebarScrollIndex((prev) => Math.min(prev + 1, maxScrollIndex));
      } else {
        setSidebarScrollIndex((prev) => Math.max(prev - 1, 0));
      }
      touchStartYRef.current = e.touches[0].clientY;
      isThrottlingWheelRef.current = true;
      setTimeout(() => {
        isThrottlingWheelRef.current = false;
      }, 140);
    }
  };

  const handleTouchEnd = () => {
    touchStartYRef.current = null;
  };

  // Mobile slide & temporary title bubble states
  const [mobileCurrentSectionTitle, setMobileCurrentSectionTitle] = useState<string>('Tableau de Bord Synapse');
  const [isMobileTitleBubbleVisible, setIsMobileTitleBubbleVisible] = useState<boolean>(false);
  const [isMobileTopBarVisible, setIsMobileTopBarVisible] = useState<boolean>(true);
  const mobileBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileTouchStartXRef = useRef<number | null>(null);
  const mobileTouchStartYRef = useRef<number | null>(null);

  const triggerMobileHeaderReveal = (title: string) => {
    setMobileCurrentSectionTitle(title);
    setIsMobileTitleBubbleVisible(true);
    setIsMobileTopBarVisible(true);
    if (mobileBubbleTimerRef.current) clearTimeout(mobileBubbleTimerRef.current);
    mobileBubbleTimerRef.current = setTimeout(() => {
      setIsMobileTitleBubbleVisible(false);
      setIsMobileTopBarVisible(false);
    }, 2800);
  };

  const dismissMobileHeaderOnInteraction = () => {
    if (isMobileTitleBubbleVisible || isMobileTopBarVisible) {
      setIsMobileTitleBubbleVisible(false);
      setIsMobileTopBarVisible(false);
      if (mobileBubbleTimerRef.current) clearTimeout(mobileBubbleTimerRef.current);
    }
  };

  const handleMobileSwipeNavigation = (direction: 'next' | 'prev') => {
    // 1. If currently in a tab with subtabs, cycle through subtabs
    if (activeTab === 'stations') {
      if (direction === 'next') {
        setRegieSubTab('stations_meta');
        triggerMobileHeaderReveal('Fréquences & Métadonnées');
      } else {
        setRegieSubTab('liquidsoap');
        triggerMobileHeaderReveal('Régie Liquidsoap');
      }
      return;
    }

    if (activeTab === 'users') {
      if (direction === 'next') {
        setUserAccountsSubTab('templates');
        triggerMobileHeaderReveal('Modèles de Profils Admin');
      } else {
        setUserAccountsSubTab('accounts');
        triggerMobileHeaderReveal('Comptes & Droits Utilisateurs');
      }
      return;
    }

    if (activeTab === 'challenges') {
      const tabs: Array<'active' | 'submissions' | 'selected' | 'archives' | 'constant'> = [
        'active',
        'submissions',
        'selected',
        'archives',
        'constant',
      ];
      const currentIndex = tabs.indexOf(challengeTab);
      const nextIndex = direction === 'next' 
        ? (currentIndex + 1) % tabs.length 
        : (currentIndex - 1 + tabs.length) % tabs.length;
      setChallengeTab(tabs[nextIndex]);
      const titles: Record<string, string> = {
        active: 'Défis Actifs',
        submissions: 'Propositions de Morceaux',
        selected: 'Titres Sélectionnés',
        archives: 'Archives & Historique',
        constant: 'Défis Permanents',
      };
      triggerMobileHeaderReveal(titles[tabs[nextIndex]] || 'Défis & Quêtes');
      return;
    }

    if (activeTab === 'services') {
      const tabs: ServiceSection[] = ['liquidsoap_icecast', 'supabase', 'external'];
      const currentIndex = tabs.indexOf(servicesSubTab);
      const nextIndex = direction === 'next'
        ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length;
      setServicesSubTab(tabs[nextIndex]);
      const titles: Record<ServiceSection, string> = {
        liquidsoap_icecast: 'Liquidsoap & Icecast',
        supabase: 'Supabase Base & Realtime',
        external: 'Services Tiers & Intégrations',
      };
      triggerMobileHeaderReveal(titles[tabs[nextIndex]]);
      return;
    }

    // 2. Otherwise navigate to previous / next main tab in sidebarLinks
    const currentTabIdx = sidebarLinks.findIndex((l) => l.id === activeTab);
    if (currentTabIdx !== -1) {
      const nextTabIdx = direction === 'next'
        ? (currentTabIdx + 1) % sidebarLinks.length
        : (currentTabIdx - 1 + sidebarLinks.length) % sidebarLinks.length;
      const targetTab = sidebarLinks[nextTabIdx];
      setActiveTab(targetTab.id as AdminTab);
      setIsAddingNew(false);
      setEditingItem(null);
      triggerMobileHeaderReveal(targetTab.label);
    }
  };

  // Progressive Section-by-Section Vertical Wheel Scroll
  const mainContentRef = useRef<HTMLElement>(null);
  const isProgressiveScrollingRef = useRef(false);

  const handleProgressiveWheel = (e: React.WheelEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.closest('pre'))
    ) {
      return;
    }

    if (isProgressiveScrollingRef.current) return;
    const container = mainContentRef.current;
    if (!container) return;

    if (Math.abs(e.deltaY) < 16) return;

    const direction = e.deltaY > 0 ? 1 : -1;
    const currentScrollTop = container.scrollTop;

    // Find section/module boundaries within active page
    const modules = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-admin-module], .admin-module, section, article, form, .grid > div, .space-y-4 > div'
      )
    );

    let targetScroll: number | null = null;
    if (modules.length > 0) {
      const sortedOffsets = modules
        .map((m) => m.offsetTop - 75)
        .filter((offset) => offset >= 0)
        .sort((a, b) => a - b);

      if (direction > 0) {
        targetScroll = sortedOffsets.find((offset) => offset > currentScrollTop + 35) ?? null;
      } else {
        const prevOffsets = sortedOffsets.filter((offset) => offset < currentScrollTop - 35);
        if (prevOffsets.length > 0) {
          targetScroll = prevOffsets[prevOffsets.length - 1];
        } else {
          targetScroll = 0;
        }
      }
    }

    const destination =
      targetScroll !== null
        ? targetScroll
        : Math.max(0, currentScrollTop + direction * 280);

    e.preventDefault();
    isProgressiveScrollingRef.current = true;
    container.scrollTo({
      top: destination,
      behavior: 'smooth',
    });

    setTimeout(() => {
      isProgressiveScrollingRef.current = false;
    }, 180);
  };

  const activeStation = propActiveStream || stations.find((s) => s.id === currentStationId) || stations[0] || null;
  const activeStationName = activeStation?.name?.replace(/^Radio Synapse\s*-\s*/i, '') || 'Radio Synapse';

  const handlePrevStationClick = () => {
    if (onPrevStation) {
      onPrevStation();
    } else if (stations.length > 0) {
      const idx = stations.findIndex((s) => s.id === activeStation?.id);
      const prev = stations[(idx - 1 + stations.length) % stations.length];
      setSelectedStationForControlDeck(prev);
    }
  };

  const handleNextStationClick = () => {
    if (onNextStation) {
      onNextStation();
    } else if (stations.length > 0) {
      const idx = stations.findIndex((s) => s.id === activeStation?.id);
      const next = stations[(idx + 1) % stations.length];
      setSelectedStationForControlDeck(next);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 text-white flex flex-col h-screen w-screen overflow-hidden animate-in fade-in duration-200">
      {/* 1. DESKTOP CONSOLE HEADER (HIDDEN ON MOBILE) */}
      <header className="hidden md:flex w-full bg-zinc-950/90 border-b border-zinc-800/80 px-4 sm:px-6 py-3 items-center justify-between gap-4 backdrop-blur-xl shrink-0 z-20 relative">
        {/* Chromatic fine accent line along the bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] chromatic-line opacity-75 pointer-events-none" />

        <div className="flex items-center gap-3.5">
          {/* ICON WITHOUT CHROMATIC DOT */}
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white flex-shrink-0 relative shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
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
            {/* SUBTITLE WITHOUT CHROMATIC DOT */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <span>RADIO SYNAPSE • MANAGEMENT & REGIE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden md:inline font-medium text-zinc-300">Supabase Temps Réel</span>
          </div>

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

      {/* 2. MOBILE FIXED RADIO SYNAPSE STATION PLAYER HEADER (REPLACES ADMIN CONSOLE TOP BAR ON MOBILE) */}
      <header className="flex md:hidden w-full bg-zinc-950/95 border-b border-zinc-800/80 px-3 py-2 items-center justify-between gap-2 backdrop-blur-xl shrink-0 z-30 relative select-none shadow-md">
        {/* Chromatic fine accent line along the bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] chromatic-line opacity-75 pointer-events-none" />

        {/* Station Identity / Name / Live Indicator */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white shrink-0 relative shadow-inner">
            <Radio className={`w-4 h-4 ${isPlaying ? 'text-emerald-400 animate-pulse' : 'text-zinc-400'}`} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-white truncate max-w-[120px] xs:max-w-[150px]">
                {activeStationName}
              </span>
              {isPlaying && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              )}
            </div>
            <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[120px] xs:max-w-[150px]">
              {activeStation?.genre || 'Direct'}
            </span>
          </div>
        </div>

        {/* Player Controls & Retractable Volume */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Switch Previous Station */}
          <button
            onClick={handlePrevStationClick}
            className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800/80 active:scale-95 transition-all cursor-pointer"
            title="Station précédente"
            aria-label="Station précédente"
          >
            <SkipBack className="w-3.5 h-3.5 text-zinc-300" />
          </button>

          {/* Simple Play / Pause Button */}
          <button
            onClick={() => onTogglePlay?.()}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 shadow-md cursor-pointer ${
              isPlaying
                ? 'bg-zinc-800 border-zinc-600 text-emerald-400 shadow-emerald-500/10'
                : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
            }`}
            title={isPlaying ? 'Mettre en pause' : 'Lancer la lecture'}
            aria-label={isPlaying ? 'Mettre en pause' : 'Lancer la lecture'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-emerald-400 text-emerald-400" />
            ) : (
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            )}
          </button>

          {/* Switch Next Station */}
          <button
            onClick={handleNextStationClick}
            className="p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800/80 active:scale-95 transition-all cursor-pointer"
            title="Station suivante"
            aria-label="Station suivante"
          >
            <SkipForward className="w-3.5 h-3.5 text-zinc-300" />
          </button>

          {/* Retractable Volume */}
          <div ref={volumeContainerRef} className="relative flex items-center">
            {isVolumeOpen && (
              <div className="absolute right-0 top-11 z-50 p-2.5 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150 min-w-[150px]">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={localVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setLocalVolume(val);
                    onVolumeChange?.(val);
                  }}
                  className="w-24 h-1.5 accent-white bg-zinc-800 rounded-lg cursor-pointer"
                  aria-label="Volume de lecture"
                />
                <span className="text-[11px] font-mono font-bold text-zinc-300 w-8 text-right">
                  {Math.round(localVolume * 100)}%
                </span>
              </div>
            )}

            <button
              onClick={() => setIsVolumeOpen(!isVolumeOpen)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isVolumeOpen
                  ? 'bg-zinc-800 text-white border-zinc-600'
                  : 'bg-zinc-900/90 text-zinc-300 hover:text-white border-zinc-800/80 hover:bg-zinc-800'
              }`}
              title={isVolumeOpen ? 'Masquer le volume' : 'Régler le volume'}
              aria-label={isVolumeOpen ? 'Masquer le réglage du volume' : 'Ouvrir le réglage du volume'}
            >
              {localVolume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
              ) : localVolume < 0.5 ? (
                <Volume1 className="w-3.5 h-3.5 text-zinc-200" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-zinc-200" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN BODY WITH SIDEBAR */}
      <div className="flex-1 w-full flex min-h-0 overflow-hidden relative">

        {/* STATIC SPACER FOR DESKTOP (COLLAPSED WIDTH 68PX) TO PREVENT CONTENT FROM BEING PUSHED */}
        <div className="hidden md:block w-[68px] shrink-0 h-full pointer-events-none" />

        {/* BACKDROP OVERLAY WHEN SIDEBAR IS DEPLOYED OVER THE CONTENT */}
        {isSidebarDeployed && (
          <div
            onClick={() => {
              setIsSidebarHovered(false);
              setIsSidebarManuallyOpen(false);
              setMobileSidebarOpen(false);
              hoveredIconsRef.current.clear();
            }}
            className="hidden md:block absolute inset-0 bg-black/75 backdrop-blur-xs z-30 transition-opacity duration-300 animate-in fade-in"
          />
        )}

        {/* DESKTOP SIDEBAR NAVIGATION (ICONS POSITION STRICTLY FIXED, WIDTH TRANSITIONS SMOOTHLY) */}
        <aside
          onMouseLeave={() => {
            if (!isSidebarManuallyOpen) {
              setIsSidebarHovered(false);
            }
            hoveredIconsRef.current.clear();
          }}
          className={`hidden md:flex absolute top-0 bottom-0 left-0 z-40 bg-zinc-950 border-r border-zinc-800 flex-col transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 overflow-hidden ${
            isSidebarDeployed ? 'w-72 shadow-2xl' : 'w-[68px]'
          }`}
        >
          {/* SIDEBAR HEADER / BRAND */}
          <div className="h-14 border-b border-zinc-800/80 flex items-center relative overflow-hidden shrink-0">
            {/* 68px left slot: toggle button is strictly centered, never moves */}
            <div className="w-[68px] h-full shrink-0 flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSidebarManuallyOpen(!isSidebarManuallyOpen);
                  setIsSidebarHovered(false);
                  hoveredIconsRef.current.clear();
                }}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title={isSidebarDeployed ? "Rétracter le menu" : "Déployer le menu"}
                aria-label={isSidebarDeployed ? "Rétracter le menu" : "Déployer le menu"}
              >
                {isSidebarDeployed ? (
                  <PanelLeftClose className="w-4 h-4 text-zinc-300" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4 text-zinc-300" />
                )}
              </button>
            </div>

            {/* Expandable right slot: Title and customization button (only displayed when deployed) */}
            <div
              className={`flex-1 flex items-center justify-between pr-3 min-w-0 transition-all duration-300 ease-out ${
                isSidebarDeployed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 pointer-events-none'
              }`}
            >
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest truncate">
                NAVIGATION
              </span>
              
              {/* 3 VERTICAL DOTS TO CUSTOMIZE SIDEBAR (ONLY DISPLAYED WHEN DEPLOYED) */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSidebarMenuOpen(!isSidebarMenuOpen);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Personnaliser l'ordre du menu"
                  aria-label="Personnaliser l'ordre du menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

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
                      className="absolute right-0 top-full mt-1 w-52 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 text-left animate-in fade-in zoom-in-95 duration-150"
                    >
                      <button
                        onClick={() => {
                          setIsSidebarEditorOpen(true);
                          setIsSidebarMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 rounded-lg hover:bg-zinc-850 text-xs font-mono text-zinc-200 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-zinc-300" />
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
            </div>
          </div>

          {/* SIDEBAR LINKS - 1 SCROLL = 1 ICON, NO SCROLLBAR */}
          <nav 
            ref={sidebarNavRef}
            onWheel={handleSidebarWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 overflow-hidden p-2 relative select-none"
          >
            <div 
              className="flex flex-col gap-1.5 transition-transform duration-200 ease-out will-change-transform"
              style={{ transform: `translateY(-${sidebarScrollIndex * ITEM_HEIGHT}px)` }}
            >
              {sidebarLinks.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.id === 'services' && (activeTab === 'streaming' || activeTab === 'database'));
                const colorScheme = TAB_COLOR_CONFIGS[item.id as AdminTab] || TAB_COLOR_CONFIGS.dashboard;

                return (
                  <button
                    key={item.id}
                    title={!isSidebarDeployed ? item.label : undefined}
                    aria-label={item.label}
                    onMouseEnter={() => {
                      if (!isSidebarDeployed) {
                        hoveredIconsRef.current.add(item.id);
                        if (hoveredIconsRef.current.size >= 3) {
                          setIsSidebarHovered(true);
                        }
                      }
                    }}
                    onClick={() => {
                      setActiveTab(item.id as AdminTab);
                      setIsAddingNew(false);
                      setEditingItem(null);
                      setMobileSidebarOpen(false);
                    }}
                    className={`h-[44px] w-full flex items-center rounded-xl transition-colors cursor-pointer group relative shrink-0 ${
                      isActive
                        ? 'text-white bg-transparent'
                        : 'hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {/* Active vertical selection bar: left of icon, colored with the tab chromatic hue */}
                    {isActive && (
                      <div className={`absolute left-0 -top-1 -bottom-1 w-1 rounded-full ${colorScheme.barBg} z-10`} />
                    )}

                    {/* FIXED ICON SLOT (52px wide, centered — NEVER MOVES BETWEEN RETRACTED & DEPLOYED) */}
                    <div className="w-[52px] h-[44px] shrink-0 flex items-center justify-center relative">
                      <div
                        className={`p-2 rounded-xl transition-all duration-200 shrink-0 relative border ${
                          isActive
                            ? `${colorScheme.activeBg} ${colorScheme.activeBorder} ${colorScheme.activeText} ${colorScheme.accentGlow}`
                            : `bg-zinc-900/90 border-zinc-800/80 ${colorScheme.text} group-hover:border-zinc-700 group-hover:bg-zinc-850 group-hover:scale-105`
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? colorScheme.activeText : colorScheme.text}`} />

                        {/* ALERT BADGE (PRIORITY OVER ACTIVITY) */}
                        {item.alertCount && item.alertCount > 0 ? (
                          <span 
                            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center justify-center ring-2 ring-zinc-950 shadow-md animate-pulse z-10"
                            title={`${item.alertCount} alerte(s)`}
                          >
                            {item.alertCount}
                          </span>
                        ) : item.activityCount && item.activityCount > 0 ? (
                          /* ACTIVITY BADGE */
                          <span 
                            className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-[8px] font-mono font-bold flex items-center justify-center ring-1 ring-zinc-950 shadow-xs z-10"
                            title={`${item.activityCount} processus actif(s)`}
                          >
                            {item.activityCount}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* EXPANDABLE LABELS & BADGES (FADES IN SMOOTHLY TO THE RIGHT WITHOUT SHIFTING ICON) */}
                    <div 
                      className={`flex-1 flex items-center justify-between min-w-0 pr-3 transition-all duration-300 ease-out ${
                        isSidebarDeployed 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 -translate-x-3 pointer-events-none'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className={`text-xs font-mono font-bold tracking-wide truncate ${isActive ? colorScheme.activeText : 'text-zinc-300 group-hover:text-white'}`}>
                          {item.label}
                        </span>
                      </div>

                      {/* BADGE ON DEPLOYED SIDEBAR: ALERT IN PRIORITY, ELSE ACTIVITY */}
                      {item.alertCount && item.alertCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                          <span>{item.alertCount} alerte{item.alertCount > 1 ? 's' : ''}</span>
                        </span>
                      ) : item.activityCount && item.activityCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 bg-zinc-900 text-zinc-300 border border-zinc-800 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>{item.activityCount} actif{item.activityCount > 1 ? 's' : ''}</span>
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* SIDEBAR FOOTER ADMIN INFO */}
          <div className="h-16 border-t border-zinc-800/80 bg-zinc-950 flex items-center shrink-0">
            {/* 52px slot with 8px margin aligns with nav items */}
            <div className="ml-2 w-[52px] h-full shrink-0 flex items-center justify-center">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                currentUser?.role === 'super-admin'
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-white'
              }`}>
                {currentUser?.role === 'super-admin' ? 'SA' : (currentUser?.username?.slice(0, 2).toUpperCase() || 'AD')}
              </div>
            </div>
            
            <div className={`flex-1 flex flex-col text-left pr-3 min-w-0 transition-all duration-300 ease-out ${
              isSidebarDeployed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 pointer-events-none'
            }`}>
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs font-mono font-bold text-zinc-200 truncate">
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
        </aside>

        {/* FLOATING MOBILE SECTION TITLE BUBBLE */}
        {isMobileTitleBubbleVisible && (
          <div className="md:hidden fixed top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-zinc-900/95 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{mobileCurrentSectionTitle}</span>
          </div>
        )}

        {/* RIGHT CONTENT AREA - ZERO SCROLLBAR, PROGRESSIVE SECTION-BY-SECTION SCROLL */}
        <main 
          ref={mainContentRef}
          onWheel={handleProgressiveWheel}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              mobileTouchStartXRef.current = e.touches[0].clientX;
              mobileTouchStartYRef.current = e.touches[0].clientY;
            }
            dismissMobileHeaderOnInteraction();
          }}
          onTouchEnd={(e) => {
            if (mobileTouchStartXRef.current === null || mobileTouchStartYRef.current === null) return;
            const deltaX = e.changedTouches[0].clientX - mobileTouchStartXRef.current;
            const deltaY = e.changedTouches[0].clientY - mobileTouchStartYRef.current;
            mobileTouchStartXRef.current = null;
            mobileTouchStartYRef.current = null;

            if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
              handleMobileSwipeNavigation(deltaX > 0 ? 'prev' : 'next');
            }
          }}
          onScroll={() => {
            dismissMobileHeaderOnInteraction();
          }}
          className="flex-1 overflow-y-auto no-scrollbar scroll-smooth flex flex-col relative min-w-0 admin-main-scroll pb-24 md:pb-8"
        >

          {/* FLOATING TOAST NOTIFICATION (DOES NOT PUSH DOWN CONTENT OR STICKY BAR) */}
          {toastMessage && (
            <div className="fixed top-20 right-6 z-50 p-3.5 rounded-xl bg-emerald-950/95 border border-emerald-500/60 text-emerald-200 text-xs font-mono flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
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
            <div className="flex flex-col w-full min-w-0">
              
              {/* TOP HEADER & SUBTABS TOGGLE (STICKY TOP BAR) */}
              <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
                    <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
                      Gestion des Comptes & Droits d'Accès
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-750 text-zinc-300 text-[10px] font-mono font-bold uppercase">
                      Hiérarchie Super-Admin
                    </span>
                  </div>
                </div>

                {/* SUBTABS SWITCHER */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 self-stretch sm:self-auto shrink-0">
                  <button
                    onClick={() => setUserAccountsSubTab('accounts')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      userAccountsSubTab === 'accounts'
                        ? 'bg-zinc-800 text-white border border-zinc-600 shadow-xs'
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
                        ? 'bg-zinc-800 text-white border border-zinc-600 shadow-xs'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Modèles de Profils ({profileTemplates.length})</span>
                  </button>
                </div>
              </div>

              {/* CONTENT CONTAINER */}
              <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-5 text-left">

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
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Super-Admins</span>
                      <span className="text-xl font-mono font-black text-zinc-200">
                        {users.filter(u => u.role === 'super-admin').length}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-1">
                      <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Admins & Profils</span>
                      <span className="text-xl font-mono font-black text-zinc-200">
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
                        className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-white placeholder-zinc-500 focus:border-zinc-400 focus:outline-none flex-1 min-w-[200px]"
                      />

                      <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-850">
                        {(['all', 'super-admin', 'admin', 'user'] as const).map((filterVal) => (
                          <button
                            key={filterVal}
                            onClick={() => setUserRoleFilter(filterVal)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              userRoleFilter === filterVal
                                ? 'bg-zinc-800 text-white border border-zinc-700'
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
                      className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-md"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isAddingNew ? 'Fermer le formulaire' : 'Créer un compte'}</span>
                    </button>
                  </div>

                  {/* ADD USER FORM WITH ROLE & PROFILE PICKER */}
                  {isAddingNew && (
                    <form onSubmit={handleCreateUser} className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-700 flex flex-col gap-4 shadow-xl animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <span className="text-xs font-mono font-bold text-zinc-200 uppercase flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-zinc-400" />
                          Créer un nouveau compte avec attribution de rôle
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">Sauvegarde locale + Supabase</span>
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
                            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-zinc-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-mono text-zinc-400">Pseudo / Nom d'antenne</label>
                          <input
                            type="text"
                            placeholder="ex: Alex Radio"
                            value={userFormUsername}
                            onChange={(e) => setUserFormUsername(e.target.value)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-zinc-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10.5px] font-mono text-zinc-400">Rôle Hiérarchique</label>
                          <select
                            value={userFormRole}
                            onChange={(e) => setUserFormRole(e.target.value as UserRole)}
                            className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-zinc-400 focus:outline-none cursor-pointer"
                          >
                            <option value="super-admin">👑 Super-Administrateur (Tous droits)</option>
                            <option value="admin">⭐ Administrateur (Selon profil assigné)</option>
                            <option value="user">👤 Auditeur Standard (Utilisateur)</option>
                          </select>
                        </div>
                      </div>

                      {/* CONDITIONAL PROFILE & STATION ASSIGNMENT IF ADMIN */}
                      {userFormRole === 'admin' && (
                        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10.5px] font-mono text-zinc-300 font-bold">
                              Modèle de Profil Administrateur :
                            </label>
                            <select
                              value={userFormProfileId}
                              onChange={(e) => setUserFormProfileId(e.target.value)}
                              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-zinc-400 focus:outline-none cursor-pointer"
                            >
                              {profileTemplates.filter(t => t.id !== 'profile_super_admin').map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                  {tpl.name} - {tpl.badge}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10.5px] font-mono text-zinc-300 font-bold">
                              Station / Fréquence assignée :
                            </label>
                            <select
                              value={userFormAssignedStation}
                              onChange={(e) => setUserFormAssignedStation(e.target.value)}
                              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-zinc-400 focus:outline-none cursor-pointer"
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
                          className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs font-mono cursor-pointer shadow-md"
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
                                        <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-white text-[10px] font-mono font-bold flex items-center gap-1">
                                          <Radio className="w-3 h-3" />
                                          {assignedStation ? assignedStation.name : usr.assignedStationId}
                                        </span>
                                      )}

                                      {usr.authMethod === 'passkey' && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-mono font-bold">
                                          Passkey
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
                                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                    title="Configurer le rôle et le profil de permissions"
                                  >
                                    <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Modifier Droits</span>
                                  </button>

                                  <button
                                    onClick={() => handleDeleteUser(usr.id)}
                                    className="p-2 rounded-xl bg-zinc-900 hover:bg-red-950/60 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
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
                  <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>
                        <strong>Système de Permissions Déléguées :</strong> Tous les intervenants créés ont un compte admin mais reçoivent les permissions du profil associé préconfiguré ci-dessous.
                      </span>
                    </div>

                    <button
                      onClick={handleResetProfileTemplatesList}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Réinitialiser Modèles</span>
                    </button>
                  </div>

                  {/* GRID OF PROFILE TEMPLATES */}
                  {profileTemplates.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-zinc-950/60 border border-zinc-850 text-center flex flex-col items-center justify-center gap-3">
                      <ShieldCheck className="w-8 h-8 text-zinc-600" />
                      <div className="text-sm font-futuristic text-zinc-300">Aucun modèle de profil créé</div>
                      <p className="text-xs font-mono text-zinc-500 max-w-md">
                        Le super-administrateur n'a pas encore créé de profil de permissions. Cliquez sur « Nouveau Modèle » pour en définir un.
                      </p>
                    </div>
                  ) : (
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
                                  className="w-3 h-3 rounded-full bg-zinc-400"
                                />
                                <span className="text-sm font-futuristic font-black tracking-wide text-white">
                                  {template.name}
                                </span>
                              </div>

                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-750 text-zinc-300"
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
                                <span className="font-bold text-white">{enabledPermissionsCount} / 11</span>
                              </div>

                              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                                {template.permissions.can_access_dashboard && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Tableau de bord
                                  </span>
                                )}
                                {template.permissions.can_broadcast_live && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-200 text-[9.5px] font-mono border border-zinc-700">
                                    🎙️ Régie Direct
                                  </span>
                                )}
                                {template.permissions.can_manage_stations && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Stations
                                  </span>
                                )}
                                {template.permissions.can_manage_messages && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Dédicaces
                                  </span>
                                )}
                                {template.permissions.can_manage_programming && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Grille On-Air
                                  </span>
                                )}
                                {template.permissions.can_manage_events && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Événements
                                  </span>
                                )}
                                {template.permissions.can_manage_users && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Comptes
                                  </span>
                                )}
                                {template.permissions.can_manage_database && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px] font-mono border border-zinc-800">
                                    Supabase
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setEditingProfileTemplate(template)}
                            className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{isSuper ? 'Voir le modèle' : 'Personnaliser ce profil'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  )}
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
                        <ShieldCheck className="w-5 h-5 text-zinc-300" />
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
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 font-bold text-xs">
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
                              ? 'bg-zinc-800 border-zinc-500 text-white shadow-xs'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold flex items-center gap-1.5 text-zinc-200">
                            <Shield className="w-3.5 h-3.5 text-zinc-400" />
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
                              ? 'bg-zinc-800 border-zinc-500 text-white shadow-xs'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold flex items-center gap-1.5 text-zinc-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
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
                              ? 'bg-zinc-800 border-zinc-500 text-white'
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
                      <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 animate-in fade-in duration-150">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-mono font-bold text-zinc-200">
                            2. Modèle de Profil Préconfiguré :
                          </label>
                          <select
                            value={roleEditProfileId}
                            onChange={(e) => setRoleEditProfileId(e.target.value)}
                            className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:border-zinc-400 focus:outline-none cursor-pointer"
                          >
                            {profileTemplates.filter(t => t.id !== 'profile_super_admin').map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name} ({tpl.badge}) — {tpl.description}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-mono font-bold text-zinc-200">
                            3. Attribution des Stations Radio :
                          </label>
                          <div className="text-[11px] font-mono text-zinc-400">
                            Cochez les radios que cet administrateur est autorisé à animer et gérer :
                          </div>
                          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto custom-scrollbar p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                            <button
                              type="button"
                              onClick={() => {
                                if (roleEditAssignedStations.length === stations.length) {
                                  setRoleEditAssignedStations([]);
                                } else {
                                  setRoleEditAssignedStations(stations.map(s => s.id));
                                }
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 hover:text-white flex items-center justify-between cursor-pointer"
                            >
                              <span>🌍 Toutes les stations ({roleEditAssignedStations.length}/{stations.length})</span>
                              <span className="text-[10px] text-zinc-500">
                                {roleEditAssignedStations.length === stations.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                              </span>
                            </button>

                            {stations.map((st) => {
                              const isChecked = roleEditAssignedStations.includes(st.id);
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => {
                                    if (isChecked) {
                                      setRoleEditAssignedStations(roleEditAssignedStations.filter(id => id !== st.id));
                                    } else {
                                      setRoleEditAssignedStations([...roleEditAssignedStations, st.id]);
                                    }
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                                    isChecked
                                      ? 'bg-zinc-850 border-amber-500/40 text-amber-300'
                                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {isChecked ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                    )}
                                    <span className="truncate">{st.name}</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-500 shrink-0 ml-2">{st.genre}</span>
                                </button>
                              );
                            })}
                          </div>
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
                        className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md"
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
                          { key: 'can_manage_services', label: 'Services API & Serveurs de Flux', desc: 'Gestion des clés API, AutoDJ et connecteurs' },
                          { key: 'can_manage_users', label: 'Gestion des Utilisateurs & Rôles', desc: 'Création et attribution des profils admin' },
                          { key: 'can_manage_messages', label: 'Messagerie & Dédicaces Direct', desc: 'Lecture et modération des messages auditeurs' },
                          { key: 'can_manage_programming', label: 'Grille TV / Radio On-Air', desc: 'Planification des programmes et émissions' },
                          { key: 'can_manage_events', label: 'Événements & Concerts', desc: 'Création et publication des dates d\'antenne' },
                          { key: 'can_manage_challenges', label: 'Quêtes & Défis XP', desc: 'Gamification et récompenses des auditeurs' },
                          { key: 'can_manage_promotions', label: 'Promotions & Boutique', desc: 'Gestion des codes promo et avantages' },
                          { key: 'can_manage_database', label: 'Base Supabase PostgreSQL', desc: 'Synchronisation et export de schéma SQL' },
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
            </div>
          )}

        {/* SEPARATED DOMAIN TAB 1: GESTION DES STATIONS (SUPER ADMIN ONLY) */}
        {activeTab === 'stations_management' && (
          <AdminStationManagementView
            stations={stations}
            users={users}
            currentUser={currentUser}
            onSaveStations={(updatedStations) => {
              setStations(updatedStations);
              saveAdminStations(updatedStations);
              if (onRefreshAppState) onRefreshAppState();
            }}
            onUpdateUserStations={handleUpdateUserStations}
            showToast={showToast}
          />
        )}

        {/* SEPARATED DOMAIN TAB 2: RÉGIE & ANIMATION STUDIO (ADMIN & SUPER ADMIN) */}
        {activeTab === 'regie_animation' && (
          <AdminRegieAnimationView
            stations={stations}
            activeStation={selectedStationForControlDeck || activeStation || stations[0]}
            currentUser={currentUser}
            onSelectStation={(st) => setSelectedStationForControlDeck(st)}
            showToast={showToast}
            onOpenControlDeck={(st) => setSelectedStationForControlDeck(st)}
          />
        )}

        {/* SEPARATED DOMAIN TAB 3: BIBLIOTHÈQUE MUSIQUE */}
        {activeTab === 'music_library' && (
          <AdminMusicLibraryView
            stations={stations}
            activeStation={selectedStationForControlDeck || activeStation || stations[0]}
            currentUser={currentUser}
            onSelectStation={(st) => setSelectedStationForControlDeck(st)}
            showToast={showToast}
          />
        )}

        {/* SEPARATED DOMAIN TAB 4: PLAYLISTS & ROTATIONS AUTO-DJ */}
        {activeTab === 'playlists' && (
          <AdminPlaylistsView
            stations={stations}
            activeStation={selectedStationForControlDeck || activeStation || stations[0]}
            currentUser={currentUser}
            onSelectStation={(st) => setSelectedStationForControlDeck(st)}
            showToast={showToast}
          />
        )}

        {/* SEPARATED DOMAIN TAB 5: PRÉPARATION DES ÉMISSIONS & CONDUCTEURS D'ANTENNE */}
        {activeTab === 'emission_prep' && (
          <AdminEmissionPrepView
            stations={stations}
            activeStation={selectedStationForControlDeck || activeStation || stations[0]}
            currentUser={currentUser}
            onSelectStation={(st) => setSelectedStationForControlDeck(st)}
            showToast={showToast}
          />
        )}

        {/* TAB 2: GESTION DE LA RÉGIE & STATIONS RADIOS (LIQUIDSOAP & VPS DIRECT) */}
        {activeTab === 'stations' && (
          <div className="flex flex-col w-full min-w-0">
            {/* SUBTAB 1: RÉGIE & MOTEUR LIQUIDSOAP DIRECT */}
            {regieSubTab === 'liquidsoap' && (
              <AdminRegieLiquidsoapView
                stations={stations}
                currentUser={currentUser}
                showToast={showToast}
                onOpenControlDeck={(st: StreamChannel) => setSelectedStationForControlDeck(st)}
              />
            )}

            {/* SUBTAB 2: CONFIGURATION DES FRÉQUENCES & CARTES STATIONS */}
            {regieSubTab === 'stations_meta' && (
              <div className="flex flex-col w-full min-w-0">
                {/* STICKY TOP BAR - FIRST ELEMENT, FLUSH, OPAQUE */}
                <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
                      <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
                        Fréquences & Métadonnées ({stations.length})
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRegieSubTab('liquidsoap')}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Server className="w-3.5 h-3.5" />
                      <span>Régie Liquidsoap</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setStationFormName('');
                        setStationFormGenre('');
                        setStationFormDesc('');
                        setStationFormColor('#00f2ff');
                        setStationFormNumber('');
                        setStationFormStreamUrl('');
                        setStationFormEnabled(true);
                        setIsAddingNew(!isAddingNew);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nouvelle Station</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4 text-left">
            {/* SECTION HAUT DE PAGE : LIAISON COMPTE DJ STREAMER DIRECT */}
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
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-zinc-900/95 to-zinc-950 border border-zinc-700 flex flex-col gap-3.5 shadow-xl text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-white">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wide flex items-center gap-2">
                        <span>Liaison Compte DJ Streamer Direct</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-bold">
                          Admin Requis
                        </span>
                      </h4>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        Renseignez votre compte DJ streamer pour activer la régie en direct, le microphone studio et le pilotage exclusif des stations.
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
                      <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ex: theocourant"
                      value={djFormUsername}
                      onChange={(e) => setDjFormUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-white text-white text-xs font-mono placeholder:text-zinc-600 outline-none transition-all"
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
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-white text-white text-xs font-mono placeholder:text-zinc-600 outline-none transition-all"
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
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-white text-white text-xs font-mono placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono font-bold text-zinc-300 uppercase flex items-center gap-1">
                      <span>Station par Défaut :</span>
                    </label>
                    <select
                      value={djFormStation}
                      onChange={(e) => setDjFormStation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-700 focus:border-white text-white text-xs font-mono outline-none transition-all cursor-pointer"
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
                        className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-white/10 cursor-pointer transition-all"
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
                <Radio className="w-4 h-4 text-white" />
                Stations Radio Configurées ({stations.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await cleanupSupabaseStationDuplicates();
                    if (res.removedCount > 0) {
                      showToast(`${res.removedCount} doublons purgés de Supabase ! Il reste ${res.remainingCount} stations uniques.`);
                    } else {
                      showToast(`Aucun doublon trouvé en BDD (${res.remainingCount} stations uniques).`);
                    }
                    reloadData();
                    if (onRefreshAppState) onRefreshAppState();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Purger tous les doublons de la table synapse_stations sur Supabase"
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
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer une Station</span>
                </button>
              </div>
            </div>

            {/* CREATE / EDIT STATION FORM */}
            {(isAddingNew || editingItem) && (
              <form onSubmit={handleSaveStation} className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700 flex flex-col gap-3 shadow-lg text-left">
                <span className="text-xs font-mono font-bold text-white uppercase">
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
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-white"
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
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-white"
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
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-white"
                    />
                  </div>

                  {/* Lien du flux Stream MP3/AAC */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-zinc-300 font-bold uppercase flex items-center gap-1">
                      <Link className="w-3 h-3 text-zinc-400" />
                      Lien du Flux Audio (Stream URL) :
                    </label>
                    <input
                      type="url"
                      placeholder="https://cast.radiosynapse.fr/listen/nom/radio.mp3"
                      value={stationFormStreamUrl}
                      onChange={(e) => setStationFormStreamUrl(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono focus:border-white"
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
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-white resize-none"
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
                    className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs font-mono cursor-pointer"
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
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/10 text-zinc-200 border border-white/20">
                              N° {st.stationNumber}
                            </span>
                          )}
                          <span className="text-sm font-bold text-white font-futuristic">{st.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">{st.genre}</span>
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
                    <div className="text-[10px] font-mono text-zinc-300/80 bg-zinc-900 px-2.5 py-1 rounded-lg truncate border border-white/5 flex items-center gap-1.5">
                      <Link className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{st.streamUrl || st.tracks?.[0]?.audioUrl}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-white/10 pt-2.5 gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedStationForControlDeck(st)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                      title="Ouvrir la régie et télécommande de cette station"
                    >
                      <Radio className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Régie & Télécommande</span>
                    </button>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[10px] font-mono text-zinc-500 mr-1 hidden sm:inline">ID: {st.id}</span>
                      <button
                        onClick={() => handleOpenEditStation(st)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
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
              </div>
            )}
          </div>
        )}

        {/* TAB: GESTION DES FONCTIONNALITÉS & MODULES DU SITE (SUPER-ADMIN ONLY) */}
        {activeTab === 'features' && (
          <AdminFeatureFlagsView showToast={showToast} />
        )}

        {/* TAB: SERVICES & API (SUPABASE, LIQUIDSOAP ET INTÉGRATIONS TIERS) */}
        {(activeTab === 'services' || activeTab === 'streaming' || activeTab === 'database') && (
          <AdminServicesTab
            activeSection={servicesSubTab}
            onSectionChange={setServicesSubTab}
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
          <div className="flex flex-col w-full min-w-0">
            {/* STICKY TOP BAR - FIRST ELEMENT, FLUSH, OPAQUE */}
            <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
                  <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
                    Défis & Quêtes Auditeurs
                  </h2>
                </div>
              </div>

              {/* SUB-TABS NAVIGATION BAR */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 max-w-full">
                <button
                  onClick={() => setChallengeTab('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    challengeTab === 'active'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Défis Actifs ({challenges.length})</span>
                </button>

                <button
                  onClick={() => setChallengeTab('submissions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    challengeTab === 'submissions'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>Propositions</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-orange-500/30 text-[10px]">
                    {submissions.filter((s) => s.status === 'pending').length}
                  </span>
                </button>

                <button
                  onClick={() => setChallengeTab('selected')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    challengeTab === 'selected'
                      ? 'bg-emerald-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sélectionnés</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-[10px]">
                    {submissions.filter((s) => s.status === 'selected').length}
                  </span>
                </button>

                <button
                  onClick={() => setChallengeTab('archives')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    challengeTab === 'archives'
                      ? 'bg-zinc-700 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archives ({submissions.filter((s) => s.status === 'rejected').length})</span>
                </button>

                <button
                  onClick={() => setChallengeTab('constant')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                    challengeTab === 'constant'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-purple-300" />
                  <span>Constants</span>
                </button>
              </div>
            </div>

            {/* CONTENT WRAPPER */}
            <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4 text-left">

            {/* SUB-VIEW 1: DÉFIS ACTIFS & FORMULAIRE DE CRÉATION */}
            {challengeTab === 'active' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Quêtes et Défis Ponctuels ({challenges.length})
                  </span>
                  <button
                    onClick={() => {
                      setChallengeTitle('');
                      setChallengeDesc('');
                      setChallengeReward('');
                      setChallengeGenre('');
                      setChallengeSubGenre('');
                      setChallengeArtist('');
                      setChallengeRefTrack('');
                      setChallengeYear('');
                      setChallengeEmotion('');
                      setChallengeMinPlays(undefined);
                      setChallengeOtherReq('');
                      setIsAddingNew(!isAddingNew);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer un Défi</span>
                  </button>
                </div>

                {/* FORMULAIRE DE CRÉATION DE DÉFI */}
                {(isAddingNew || editingItem) && (
                  <form onSubmit={handleSaveChallenge} className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/30 flex flex-col gap-3 shadow-lg text-left">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase">
                      {editingItem ? 'Modifier le Défi' : 'Créer un Nouveau Défi'}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Titre du défi (ex: Pépite Indie Pop Française)"
                        value={challengeTitle}
                        onChange={(e) => setChallengeTitle(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                      />
                      <select
                        value={challengeType}
                        onChange={(e) => setChallengeType(e.target.value as ChallengeType)}
                        className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                      >
                        <option value="suggest_music">Type: "Propose ta musique" (Critères antenne)</option>
                        <option value="share_liked_tracks">Type: "Partage tes trouvailles" (Viralité)</option>
                        <option value="listening_time">Type: "Écoute bien" (Temps d'antenne)</option>
                        <option value="blind_test">Type: Blind Test / Quiz</option>
                        <option value="stats">Type: Statistiques d'Écoute</option>
                        <option value="custom">Type: Autre Règle Spécifique</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        value={challengeStationId}
                        onChange={(e) => setChallengeStationId(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                      >
                        <option value="all">Radio concernée: Toutes les Stations</option>
                        {stations.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Points attribués (ex: 200)"
                        value={challengePoints}
                        onChange={(e) => setChallengePoints(Number(e.target.value))}
                        className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                      />
                      <input
                        type="text"
                        placeholder="Récompense (ex: Badge Pépiteur VIP)"
                        value={challengeReward}
                        onChange={(e) => setChallengeReward(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-zinc-950 border border-white/15 text-white text-xs font-mono focus:border-amber-400"
                      />
                    </div>

                    {/* CRITÈRES SPÉCIFIQUES POUR "PROPOSE TA MUSIQUE" */}
                    {challengeType === 'suggest_music' && (
                      <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col gap-2.5">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                          Critères Spécifiques pour la Programmation
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <input
                            type="text"
                            placeholder="Genre (ex: Synthwave, Rock)"
                            value={challengeGenre}
                            onChange={(e) => setChallengeGenre(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Sous-genre (ex: Darksynth, Shoegaze)"
                            value={challengeSubGenre}
                            onChange={(e) => setChallengeSubGenre(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Artiste ciblé / imposé"
                            value={challengeArtist}
                            onChange={(e) => setChallengeArtist(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Titre de référence (inspiration)"
                            value={challengeRefTrack}
                            onChange={(e) => setChallengeRefTrack(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Année ou période (ex: 80s, 2024)"
                            value={challengeYear}
                            onChange={(e) => setChallengeYear(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Émotion / Mood (ex: Nuit, Énergique)"
                            value={challengeEmotion}
                            onChange={(e) => setChallengeEmotion(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                          <input
                            type="number"
                            placeholder="Écoutes / Streams max (< 100k)"
                            value={challengeMinPlays || ''}
                            onChange={(e) => setChallengeMinPlays(e.target.value ? Number(e.target.value) : undefined)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                          <input
                            type="text"
                            placeholder="Autre exigence (ex: Voix féminine)"
                            value={challengeOtherReq}
                            onChange={(e) => setChallengeOtherReq(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* SPÉCIFIQUE "PARTAGE TES TROUVAILLES" */}
                    {challengeType === 'share_liked_tracks' && (
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-between gap-3">
                        <span className="text-xs font-mono text-zinc-200">
                          Nombre de partages requis sur la station :
                        </span>
                        <input
                          type="number"
                          value={challengeRequiredShares}
                          onChange={(e) => setChallengeRequiredShares(Number(e.target.value))}
                          className="w-24 px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/15 text-white text-xs font-mono text-center"
                        />
                      </div>
                    )}

                    {/* SPÉCIFIQUE "ÉCOUTE BIEN" */}
                    {challengeType === 'listening_time' && (
                      <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between gap-3">
                        <span className="text-xs font-mono text-purple-300">
                          Durée d'écoute requise sur la station (en minutes) :
                        </span>
                        <input
                          type="number"
                          value={challengeRequiredMinutes}
                          onChange={(e) => setChallengeRequiredMinutes(Number(e.target.value))}
                          className="w-24 px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/15 text-white text-xs font-mono text-center"
                        />
                      </div>
                    )}

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

                {/* LISTE DES DÉFIS ACTIFS */}
                <div className="flex flex-col gap-2.5">
                  {challenges.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-2 text-left">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            c.type === 'suggest_music' ? 'bg-amber-500/20 text-amber-300' :
                            c.type === 'share_liked_tracks' ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' :
                            c.type === 'listening_time' ? 'bg-purple-500/20 text-purple-300' :
                            'bg-zinc-800 text-zinc-300'
                          }`}>
                            {c.type === 'suggest_music' ? 'Propose ta musique' :
                             c.type === 'share_liked_tracks' ? 'Partage tes trouvailles' :
                             c.type === 'listening_time' ? 'Écoute bien' :
                             c.type.toUpperCase().replace('_', ' ')}
                          </span>
                          <h4 className="text-sm font-bold text-white font-futuristic">{c.title}</h4>
                        </div>
                        <span className="text-xs font-mono text-emerald-400 font-bold">+{c.points} PTS</span>
                      </div>

                      <p className="text-xs text-zinc-400">{c.desc}</p>

                      {/* CRITERIA TAGS */}
                      {c.criteria && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {c.criteria.genre && <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-amber-300">Genre: {c.criteria.genre}</span>}
                          {c.criteria.artist && <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-zinc-300">Artiste: {c.criteria.artist}</span>}
                          {c.criteria.year && <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-purple-300">Période: {c.criteria.year}</span>}
                          {c.criteria.emotion && <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-pink-300">Mood: {c.criteria.emotion}</span>}
                          {c.criteria.otherRequirements && <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono text-emerald-300">{c.criteria.otherRequirements}</span>}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] font-mono text-zinc-500">
                        <span>Station: {c.stationId === 'all' ? 'Globale (Toutes)' : (stations.find(s => s.id === c.stationId)?.name || c.stationId)}</span>
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

            {/* SUB-VIEW 2: PROPOSITIONS AUDITEURS (EN ATTENTE) */}
            {challengeTab === 'submissions' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    Propositions Musicales des Auditeurs (En attente de validation)
                  </span>
                </div>

                {submissions.filter((s) => s.status === 'pending').length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-950 border border-white/10 text-center flex flex-col items-center gap-2">
                    <Flame className="w-8 h-8 text-zinc-600" />
                    <span className="text-xs font-mono text-zinc-400">Aucune proposition en attente pour le moment.</span>
                    <span className="text-[11px] font-mono text-zinc-500">Dès qu'un auditeur propose un morceau depuis l'onglet Défis, il apparaîtra ici.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {submissions.filter((s) => s.status === 'pending').map((sub) => (
                      <div key={sub.id} className="p-4 rounded-2xl bg-zinc-950 border border-orange-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-mono font-bold">
                              EN ATTENTE
                            </span>
                            <span className="text-sm font-bold text-white font-mono">{sub.trackTitle}</span>
                            <span className="text-xs font-mono text-zinc-400">par <strong className="text-white">{sub.artist}</strong></span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400">
                            <span>Radio: <strong className="text-white">{stations.find(s => s.id === sub.stationId)?.name || sub.stationId}</strong></span>
                            <span>Proposé par: <strong className="text-amber-300">{sub.userName}</strong></span>
                            <span>Points en jeu: <strong className="text-emerald-400">+{sub.pointsAwarded ?? 100} PTS</strong></span>
                            <span>Date: {new Date(sub.submittedAt).toLocaleDateString('fr-FR')}</span>
                          </div>

                          {sub.notes && (
                            <p className="text-xs text-zinc-300 bg-zinc-900/60 p-2 rounded-lg border border-white/5 font-mono italic">
                              "{sub.notes}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveTrackSubmission(sub.id)}
                            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                            title="Valider et créditer les points"
                          >
                            <Check className="w-4 h-4" />
                            <span>Valider (✓)</span>
                          </button>
                          <button
                            onClick={() => handleRejectTrackSubmission(sub.id)}
                            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-red-950/80 border border-zinc-700 hover:border-red-500/50 text-zinc-400 hover:text-red-300 font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Refuser et archiver"
                          >
                            <X className="w-4 h-4" />
                            <span>Refuser</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-VIEW 3: TITRES SÉLECTIONNÉS POUR L'ANTENNE */}
            {challengeTab === 'selected' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                    <Music className="w-4 h-4 text-emerald-400" />
                    Titres Validés & Sélectionnés pour la Programmation Radio
                  </span>
                </div>

                {submissions.filter((s) => s.status === 'selected').length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-950 border border-white/10 text-center flex flex-col items-center gap-2">
                    <Music className="w-8 h-8 text-zinc-600" />
                    <span className="text-xs font-mono text-zinc-400">Aucun titre sélectionné pour le moment.</span>
                    <span className="text-[11px] font-mono text-zinc-500">Validez des propositions d'auditeurs pour les retrouver ici prêts pour votre grille d'antenne !</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {submissions.filter((s) => s.status === 'selected').map((sub) => (
                      <div key={sub.id} className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                              SÉLECTIONNÉ ANTENNE
                            </span>
                            <span className="text-sm font-bold text-white font-mono">{sub.trackTitle}</span>
                            <span className="text-xs font-mono text-zinc-400">par <strong className="text-white">{sub.artist}</strong></span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400">
                            <span>Radio: <strong className="text-white">{stations.find(s => s.id === sub.stationId)?.name || sub.stationId}</strong></span>
                            <span>Proposé par: <strong className="text-amber-300">{sub.userName}</strong></span>
                            <span>Points attribués: <strong className="text-emerald-400">+{sub.pointsAwarded ?? 100} PTS</strong></span>
                            {sub.reviewedAt && (
                              <span>Validé le: {new Date(sub.reviewedAt).toLocaleDateString('fr-FR')}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono text-emerald-400 font-bold px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                            Prêt diffusion
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-VIEW 4: ARCHIVES DES PROPOSITIONS */}
            {challengeTab === 'archives' && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-mono text-zinc-300 font-bold flex items-center gap-2">
                  <Archive className="w-4 h-4 text-zinc-400" />
                  Historique des Propositions Rejetées ou Diffusées
                </span>

                {submissions.filter((s) => s.status === 'rejected').length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-950 border border-white/10 text-center flex flex-col items-center gap-2">
                    <Archive className="w-8 h-8 text-zinc-600" />
                    <span className="text-xs font-mono text-zinc-400">Aucune archive.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {submissions.filter((s) => s.status === 'rejected').map((sub) => (
                      <div key={sub.id} className="p-3 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-between gap-3 text-left">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-mono font-bold text-zinc-400 truncate">{sub.trackTitle} - {sub.artist}</span>
                          <span className="text-[10px] font-mono text-zinc-500 truncate">Par {sub.userName} • Radio {stations.find(s => s.id === sub.stationId)?.name || sub.stationId}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 shrink-0">Archivé</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-VIEW 5: DÉFIS CONSTANTS & PODIUMS HEBDOMADAIRES */}
            {challengeTab === 'constant' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex flex-col gap-2">
                  <span className="text-xs font-mono font-bold text-purple-300 uppercase flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-400" />
                    Configuration des Défis Constants & Récompenses Podiums Hebdo
                  </span>
                  <p className="text-xs font-mono text-zinc-400">
                    Définissez les points numériques de fidélité accordés chaque semaine aux auditeurs les plus assidus sur les différentes radios.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {constantChallenges.map((cc) => (
                    <div key={cc.id} className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-3 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white uppercase">{cc.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase">Hebdo</span>
                      </div>
                      <p className="text-xs text-zinc-400">{cc.description}</p>

                      <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Barème des points par place :</span>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-white/5 text-xs font-mono">
                          <span className="font-bold text-amber-300">1ère Place (Or)</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={cc.podium.first}
                              onChange={(e) => handleSaveConstantChallengePodium(cc.id, 'first', Number(e.target.value))}
                              className="w-20 px-2 py-1 rounded bg-zinc-950 border border-white/15 text-emerald-400 font-bold text-xs text-center"
                            />
                            <span className="text-zinc-500 text-[10px]">PTS</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-white/5 text-xs font-mono">
                          <span className="font-bold text-zinc-300">2ème Place (Argent)</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={cc.podium.second}
                              onChange={(e) => handleSaveConstantChallengePodium(cc.id, 'second', Number(e.target.value))}
                              className="w-20 px-2 py-1 rounded bg-zinc-950 border border-white/15 text-emerald-400 font-bold text-xs text-center"
                            />
                            <span className="text-zinc-500 text-[10px]">PTS</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-white/5 text-xs font-mono">
                          <span className="font-bold text-amber-600">3ème Place (Bronze)</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={cc.podium.third}
                              onChange={(e) => handleSaveConstantChallengePodium(cc.id, 'third', Number(e.target.value))}
                              className="w-20 px-2 py-1 rounded bg-zinc-950 border border-white/15 text-emerald-400 font-bold text-xs text-center"
                            />
                            <span className="text-zinc-500 text-[10px]">PTS</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* TAB 4: GESTION DES PROMOTIONS */}
        {activeTab === 'promotions' && (
          <div className="flex flex-col w-full min-w-0">
            {/* STICKY TOP BAR - FIRST ELEMENT, FLUSH, OPAQUE */}
            <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
                  <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
                    Promotions & Codes Avantages ({promotions.length})
                  </h2>
                </div>
              </div>

              <button
                onClick={() => {
                  setPromoTitle('');
                  setPromoDesc('');
                  setPromoPrice('');
                  setPromoCode('');
                  setPromoPointsCost(150);
                  setPromoIsStockLimited(false);
                  setPromoInitialStock(25);
                  setIsAddingNew(!isAddingNew);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle Promotion</span>
              </button>
            </div>

            {/* CONTENT WRAPPER */}
            <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4 text-left">
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

                {/* FIDÉLITÉ & STOCK LIMITÉ */}
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      Achat avec points de fidélité :
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Coût en points (ex: 150)"
                        value={promoPointsCost || ''}
                        onChange={(e) => setPromoPointsCost(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-emerald-400 font-bold text-xs font-mono"
                      />
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0">PTS</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Les auditeurs connectés peuvent débloquer le code en dépensant leurs points de fidélité.
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono font-bold text-zinc-200 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={promoIsStockLimited}
                        onChange={(e) => setPromoIsStockLimited(e.target.checked)}
                        className="w-4 h-4 rounded bg-zinc-900 text-zinc-200 cursor-pointer"
                      />
                      Stock de codes limité
                    </label>
                    {promoIsStockLimited && (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          placeholder="Nombre initial de codes (ex: 20)"
                          value={promoInitialStock}
                          onChange={(e) => setPromoInitialStock(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-white font-bold text-xs font-mono"
                        />
                        <span className="text-[11px] font-mono text-zinc-400 shrink-0">codes</span>
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-zinc-500">
                      Quand le stock atteint zéro, l'offre passe en statut "Épuisé".
                    </span>
                  </div>
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                      {p.tag}
                    </span>
                    <span className="text-xs font-bold font-mono text-emerald-400">{p.price}</span>
                  </div>

                  <h4 className="text-sm font-bold text-white font-futuristic">{p.title}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-2">{p.desc}</p>

                  {/* POINTS COST & STOCK BADGES */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {p.pointsCost && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        {p.pointsCost} PTS Fidélité
                      </span>
                    )}

                    {p.isStockLimited && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        (p.remainingStock ?? p.initialStock ?? 0) <= 0
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-white/10 text-zinc-200 border border-white/20'
                      }`}>
                        Stock: {p.remainingStock ?? p.initialStock ?? 0}/{p.initialStock ?? 0} restants
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[10px] font-mono text-zinc-500">Code: <code className="text-zinc-300 font-bold">{p.codePromo || 'Aucun'}</code></span>
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
          </div>
        )}

        {/* TAB 5: PROGRAMMATION & GRILLE TV/RADIO (AGENDA INTERACTIF LIQUIDSOAP) */}
        {activeTab === 'programming' && (
          <AdminInteractiveProgrammingAgenda
            stations={stations}
            showToast={showToast}
          />
        )}

        {/* TAB 6: GESTION DES ÉVÉNEMENTS */}
        {activeTab === 'events' && (
          <div className="flex flex-col w-full min-w-0">
            {/* STICKY TOP BAR - FIRST ELEMENT, FLUSH, OPAQUE */}
            <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
                  <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
                    Événements Live & Retransmissions ({events.length})
                  </h2>
                </div>
              </div>

              <button
                onClick={() => {
                  setEventTitle('');
                  setEventDate('');
                  setEventLocation('');
                  setEventDesc('');
                  setIsAddingNew(!isAddingNew);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvel Événement</span>
              </button>
            </div>

            {/* CONTENT WRAPPER */}
            <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4 text-left">
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
          </div>
        )}

        {/* TAB 7: GESTION DE LA MESSAGERIE & RÉGIE */}
        {activeTab === 'messages' && (
          <div className="flex flex-col w-full min-w-0">
            {/* STICKY TOP BAR - FIRST ELEMENT, FLUSH, OPAQUE */}
            <div className="sticky top-0 z-20 w-full bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2 h-2 rounded-full synapse-star-dot shrink-0" />
                  <h2 className="text-base sm:text-lg font-futuristic font-black tracking-wide text-white">
                    Messagerie Studio & Dédicaces ({messages.length})
                  </h2>
                </div>
              </div>
            </div>

            {/* CONTENT WRAPPER */}
            <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-4 text-left">
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
          </div>
        )}

        {/* TAB 8: GESTION DE LA BASE DE DONNÉES SUPABASE (UNIFIÉE DANS SERVICES & API) */}
        {false && activeTab === 'database' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">

            {/* SYNC ENTITIES STATUS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
              
              {/* ENTITY 1: STATIONS */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-700 flex flex-col justify-between gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white text-xs font-mono font-bold">
                    <Radio className="w-4 h-4" />
                    <span>STATIONS RADIO</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono border border-zinc-700">
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

            {/* SUPABASE SQL SCHEMA CARD */}
            <div className="p-5 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-3 text-left shadow-xl">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Structure PostgreSQL Supabase (Documentation & Tables)
                  </span>
                </div>

                <button
                  onClick={handleCopySqlSchema}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copié !' : 'Copier le script SQL'}</span>
                </button>
              </div>

              <p className="text-xs font-mono text-zinc-400">
                Structure PostgreSQL correspondante aux tables Supabase et abonnements Realtime créées dans votre instance.
              </p>

              <pre className="p-4 rounded-xl bg-zinc-950 border border-white/10 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-60 custom-scrollbar leading-relaxed">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>
        )}

        </main>
      </div>

      {/* MOBILE FIXED BOTTOM NAVIGATION BAR WITH HORIZONTAL SCROLL (NO SCROLLBAR) */}
      <nav 
        aria-label="Navigation mobile d'administration"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-xl px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-2xl select-none"
      >
        {sidebarLinks.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'services' && (activeTab === 'streaming' || activeTab === 'database'));

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as AdminTab);
                setIsAddingNew(false);
                setEditingItem(null);
                triggerMobileHeaderReveal(item.label);
                if (mainContentRef.current) {
                  mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[58px] min-h-[44px] py-1 px-2 rounded-xl transition-all shrink-0 relative cursor-pointer ${
                isActive
                  ? 'bg-zinc-800 text-white border border-zinc-700 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {/* Priority alert badge, else activity badge */}
                {item.alertCount && item.alertCount > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-mono font-bold flex items-center justify-center ring-1 ring-zinc-950 shadow-md animate-pulse">
                    {item.alertCount}
                  </span>
                ) : item.activityCount && item.activityCount > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[12px] h-3 px-0.5 rounded-full bg-emerald-500/30 border border-emerald-500/60 text-emerald-300 text-[7.5px] font-mono font-bold flex items-center justify-center ring-1 ring-zinc-950">
                    {item.activityCount}
                  </span>
                ) : null}
              </div>
              <span className="text-[9.5px] font-mono font-bold mt-0.5 truncate max-w-[54px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* STATION CONTROL DECK MODAL */}
      {selectedStationForControlDeck && (
        <StationControlDeckModal
          isOpen={!!selectedStationForControlDeck}
          onClose={() => setSelectedStationForControlDeck(null)}
          station={selectedStationForControlDeck}
          onRefreshData={() => {
            loadRemoteAdminData();
            onRefreshAppState?.();
          }}
        />
      )}

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
