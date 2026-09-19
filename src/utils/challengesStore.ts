import { addPointsToUser } from './loyaltyStore';
import { supabase } from '../lib/supabase';

export type ChallengeType = 
  | 'suggest_music'       // "Propose ta musique"
  | 'share_liked_tracks'  // "Partage tes trouvailles"
  | 'listening_time'      // "Écoute bien"
  | 'blind_test'          // Blind test / Quiz
  | 'stats'               // Statistiques
  | 'custom';             // Autre règle

export interface SuggestMusicCriteria {
  genre?: string;
  subGenre?: string;
  artist?: string;
  referenceTrack?: string;
  year?: string;          // e.g. "1980s", "2023", "Années 90"
  emotion?: string;       // e.g. "Feel Good", "Mélancolique", "Énergique", "Chill / Relax"
  minPlaysOrViews?: number;
  maxPlaysOrViews?: number;
  otherRequirements?: string; // e.g. "Titre francophone", "Solo de guitare", "Version live"
}

export interface ExtendedAdminChallenge {
  id: string;
  stationId: string; // 'all' or specific station ID
  title: string;
  desc: string;
  type: ChallengeType;
  points: number;
  reward: string;
  total: number;
  progress: number;
  completed: boolean;
  createdAt: number;
  
  // Specific settings by type
  criteria?: SuggestMusicCriteria;      // For 'suggest_music'
  requiredShares?: number;             // For 'share_liked_tracks'
  requiredMinutes?: number;            // For 'listening_time'
}

export interface TrackSubmission {
  id: string;
  challengeId: string;
  challengeTitle: string;
  stationId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  trackTitle: string;
  artist: string;
  genre?: string;
  year?: string;
  emotion?: string;
  previewUrl?: string; // 30s audio preview
  coverUrl?: string;
  externalUrl?: string;
  notes?: string;
  submittedAt: number;
  status: 'pending' | 'selected' | 'rejected';
  rejectionReason?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  pointsAwarded?: number;
}

export interface WeeklyPodiumRewards {
  first: number;
  second: number;
  third: number;
}

export interface ConstantChallengeConfig {
  id: string;
  title: string;
  type: 'weekly_listening' | 'weekly_shares' | 'custom_constant';
  description: string;
  stationId: string; // 'all' or specific station
  podium: WeeklyPodiumRewards;
  currentLeaderboard: {
    rank: number;
    userId: string;
    username: string;
    avatarUrl?: string;
    score: number;
    scoreLabel: string;
    stationName?: string;
  }[];
  enabled: boolean;
}

// STORAGE KEYS
const SUBMISSIONS_KEY = 'radio_synapse_track_submissions_v2';
const CONSTANT_CHALLENGES_KEY = 'radio_synapse_constant_challenges_v2';
const USER_LISTENING_KEY = 'radio_synapse_user_listening_time_v2';
const USER_SHARES_KEY = 'radio_synapse_user_shared_tracks_v2';

// DEFAULT CONSTANT CHALLENGES
export const DEFAULT_CONSTANT_CHALLENGES: ConstantChallengeConfig[] = [];

// SUBMISSIONS MANAGEMENT
export function getTrackSubmissions(): TrackSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTrackSubmissions(submissions: TrackSubmission[]): void {
  try {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('synapse_track_submissions_updated', { detail: submissions }));
    }
  } catch {}

  // Sync to Supabase synapse_admin_data
  supabase.from('synapse_admin_data').upsert({
    key: 'track_submissions_cache',
    payload: submissions,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' }).then(() => {});
}

/**
 * Load submissions from Supabase table `synapse_track_submissions`
 */
export async function loadTrackSubmissionsFromSupabase(): Promise<TrackSubmission[]> {
  try {
    const { data: records, error } = await supabase
      .from('synapse_track_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !records || records.length === 0) return getTrackSubmissions();

    const mapped: TrackSubmission[] = records.map((r: any) => ({
      id: r.submission_id || r.id,
      challengeId: r.challenge_id || '',
      challengeTitle: r.challenge_title || 'Défi Musical',
      stationId: r.station_id || 'all',
      userId: r.user_id || '',
      userName: r.user_name || 'Auditeur',
      userEmail: r.user_email || '',
      trackTitle: r.track_title || 'Titre inconnu',
      artist: r.artist || 'Artiste inconnu',
      genre: r.genre || '',
      year: r.year || '',
      emotion: r.emotion || '',
      previewUrl: r.preview_url || '',
      coverUrl: r.cover_url || '',
      notes: r.notes || '',
      status: r.status || 'pending',
      submittedAt: new Date(r.created_at || Date.now()).getTime(),
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).getTime() : undefined,
      reviewedBy: r.reviewed_by,
      pointsAwarded: r.points_awarded || 150,
      rejectionReason: r.rejection_reason,
    }));

    if (mapped.length > 0) {
      saveTrackSubmissions(mapped);
    }
    return mapped;
  } catch {
    return getTrackSubmissions();
  }
}

export function submitTrackProposal(
  submissionData: Omit<TrackSubmission, 'id' | 'submittedAt' | 'status'>
): TrackSubmission {
  const submissions = getTrackSubmissions();
  const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newSubmission: TrackSubmission = {
    ...submissionData,
    id: subId,
    submittedAt: Date.now(),
    status: 'pending',
  };

  const updated = [newSubmission, ...submissions];
  saveTrackSubmissions(updated);

  // Direct asynchronous write to Supabase table
  try {
    supabase.from('synapse_track_submissions').insert({
      submission_id: subId,
      challenge_id: newSubmission.challengeId || '',
      station_id: newSubmission.stationId || 'all',
      user_id: newSubmission.userId || 'guest',
      user_name: newSubmission.userName || 'Auditeur',
      user_email: newSubmission.userEmail || '',
      track_title: newSubmission.trackTitle,
      artist: newSubmission.artist,
      genre: newSubmission.genre || '',
      year: newSubmission.year || '',
      emotion: newSubmission.emotion || '',
      preview_url: newSubmission.previewUrl || '',
      cover_url: newSubmission.coverUrl || '',
      notes: newSubmission.notes || '',
      status: 'pending',
    }).then(() => {});
  } catch {}

  return newSubmission;
}

export function approveTrackSubmission(
  submissionId: string,
  adminName: string = 'Régie Radio Synapse'
): { success: boolean; submission?: TrackSubmission; pointsAwarded: number } {
  const submissions = getTrackSubmissions();
  const subIndex = submissions.findIndex((s) => s.id === submissionId);
  if (subIndex === -1) return { success: false, pointsAwarded: 0 };

  const sub = submissions[subIndex];
  const points = sub.pointsAwarded || 150;

  const updatedSub: TrackSubmission = {
    ...sub,
    status: 'selected',
    reviewedAt: Date.now(),
    reviewedBy: adminName,
    pointsAwarded: points,
  };

  submissions[subIndex] = updatedSub;
  saveTrackSubmissions(submissions);

  // Update Supabase
  try {
    supabase.from('synapse_track_submissions')
      .update({
        status: 'selected',
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
        points_awarded: points,
      })
      .eq('submission_id', submissionId)
      .then(() => {});
  } catch {}

  // Award points to the user who proposed the track
  addPointsToUser(
    sub.userId,
    points,
    `Votre titre proposé "${sub.trackTitle} - ${sub.artist}" a été sélectionné pour l'antenne par l'équipe !`
  );

  return { success: true, submission: updatedSub, pointsAwarded: points };
}

export function rejectTrackSubmission(
  submissionId: string,
  reason: string = 'Ne correspond pas aux critères de diffusion actuels.'
): { success: boolean; submission?: TrackSubmission } {
  const submissions = getTrackSubmissions();
  const subIndex = submissions.findIndex((s) => s.id === submissionId);
  if (subIndex === -1) return { success: false };

  const sub = submissions[subIndex];
  const updatedSub: TrackSubmission = {
    ...sub,
    status: 'rejected',
    rejectionReason: reason,
    reviewedAt: Date.now(),
    reviewedBy: 'Régie Radio Synapse',
  };

  submissions[subIndex] = updatedSub;
  saveTrackSubmissions(submissions);

  // Update Supabase
  try {
    supabase.from('synapse_track_submissions')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_by: 'Régie Radio Synapse',
        reviewed_at: new Date().toISOString(),
      })
      .eq('submission_id', submissionId)
      .then(() => {});
  } catch {}

  return { success: true, submission: updatedSub };
}

export function getSelectedSubmissions(): TrackSubmission[] {
  return getTrackSubmissions().filter((s) => s.status === 'selected');
}

export function getArchivedSubmissions(): TrackSubmission[] {
  return getTrackSubmissions().filter((s) => s.status === 'rejected');
}

export function getPendingSubmissions(): TrackSubmission[] {
  return getTrackSubmissions().filter((s) => s.status === 'pending');
}

// CONSTANT CHALLENGES MANAGEMENT
export function getConstantChallenges(): ConstantChallengeConfig[] {
  try {
    const raw = localStorage.getItem(CONSTANT_CHALLENGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConstantChallenges(configs: ConstantChallengeConfig[]): void {
  try {
    localStorage.setItem(CONSTANT_CHALLENGES_KEY, JSON.stringify(configs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('synapse_constant_challenges_updated', { detail: configs }));
    }
  } catch {}

  // Sync to Supabase synapse_admin_data and dedicated table
  try {
    supabase.from('synapse_admin_data').upsert({
      key: 'constant_challenges_list',
      payload: configs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' }).then(() => {});

    // Also sync records to synapse_constant_challenges
    const rows = configs.map((c) => ({
      challenge_key: c.id,
      title: c.title,
      type: c.type,
      description: c.description,
      station_id: c.stationId || 'all',
      podium_first: c.podium.first,
      podium_second: c.podium.second,
      podium_third: c.podium.third,
      leaderboard_data: c.currentLeaderboard,
      enabled: c.enabled,
      updated_at: new Date().toISOString(),
    }));
    supabase.from('synapse_constant_challenges').upsert(rows, { onConflict: 'challenge_key' }).then(() => {});
  } catch {}
}

export async function loadConstantChallengesFromSupabase(): Promise<ConstantChallengeConfig[]> {
  try {
    const { data: records, error } = await supabase.from('synapse_constant_challenges').select('*');
    if (error || !records || records.length === 0) return getConstantChallenges();

    const mapped: ConstantChallengeConfig[] = records.map((r: any) => ({
      id: r.challenge_key || r.id,
      title: r.title,
      type: (r.type as any) || 'weekly_listening',
      description: r.description || '',
      stationId: r.station_id || 'all',
      podium: {
        first: Number(r.podium_first) || 300,
        second: Number(r.podium_second) || 150,
        third: Number(r.podium_third) || 75,
      },
      currentLeaderboard: Array.isArray(r.leaderboard_data) ? r.leaderboard_data : [],
      enabled: Boolean(r.enabled),
    }));

    if (mapped.length > 0) {
      saveConstantChallenges(mapped);
    }
    return mapped;
  } catch {
    return getConstantChallenges();
  }
}

// INTELLIGENT MUSIC VALIDATION ENGINE
// Verifies whether a song matches the criteria defined by the challenge administrator
export function verifyTrackCriteria(
  track: {
    title: string;
    artist: string;
    genre?: string;
    year?: string;
    emotion?: string;
  },
  criteria?: SuggestMusicCriteria
): {
  isValid: boolean;
  score: number;
  feedback: string[];
  matchingDetails: Record<string, boolean>;
} {
  if (!criteria) {
    return { isValid: true, score: 100, feedback: ['Tous les titres sont acceptés.'], matchingDetails: {} };
  }

  const feedback: string[] = [];
  const matchingDetails: Record<string, boolean> = {};
  let totalCriteria = 0;
  let matchedCriteria = 0;

  // 1. Genre check
  if (criteria.genre && criteria.genre.trim()) {
    totalCriteria++;
    const reqGenre = criteria.genre.toLowerCase().trim();
    const trackGenre = (track.genre || '').toLowerCase().trim();
    const match = !trackGenre || trackGenre.includes(reqGenre) || reqGenre.includes(trackGenre);
    matchingDetails.genre = match;
    if (match) {
      matchedCriteria++;
      feedback.push(`✓ Genre correspondant : ${criteria.genre}`);
    } else {
      feedback.push(`✗ Le genre requis est "${criteria.genre}" (renseigné : ${track.genre || 'Inconnu'})`);
    }
  }

  // 2. Artist check
  if (criteria.artist && criteria.artist.trim()) {
    totalCriteria++;
    const reqArtist = criteria.artist.toLowerCase().trim();
    const trackArtist = (track.artist || '').toLowerCase().trim();
    const match = trackArtist.includes(reqArtist) || reqArtist.includes(trackArtist);
    matchingDetails.artist = match;
    if (match) {
      matchedCriteria++;
      feedback.push(`✓ Artiste requis respecté : ${criteria.artist}`);
    } else {
      feedback.push(`✗ L'artiste requis doit être ou comporter "${criteria.artist}"`);
    }
  }

  // 3. Reference track check
  if (criteria.referenceTrack && criteria.referenceTrack.trim()) {
    totalCriteria++;
    const reqRef = criteria.referenceTrack.toLowerCase().trim();
    const trackTitle = (track.title || '').toLowerCase().trim();
    const match = trackTitle.includes(reqRef) || reqRef.includes(trackTitle);
    matchingDetails.referenceTrack = match;
    if (match) {
      matchedCriteria++;
      feedback.push(`✓ Titre de référence correspondant : ${criteria.referenceTrack}`);
    } else {
      feedback.push(`✗ Doit correspondre ou être lié au titre de référence : "${criteria.referenceTrack}"`);
    }
  }

  // 4. Year / Period check
  if (criteria.year && criteria.year.trim()) {
    totalCriteria++;
    const reqYear = criteria.year.toLowerCase().trim();
    const trackYear = (track.year || '').toLowerCase().trim();
    
    // Check match or decade
    let yearMatch = false;
    if (!trackYear) {
      yearMatch = true; // neutral if unverified
    } else if (reqYear.includes('80') && (trackYear.startsWith('198') || trackYear.includes('80'))) {
      yearMatch = true;
    } else if (reqYear.includes('90') && (trackYear.startsWith('199') || trackYear.includes('90'))) {
      yearMatch = true;
    } else if (reqYear.includes('2000') && (trackYear.startsWith('200') || trackYear.includes('2000'))) {
      yearMatch = true;
    } else if (trackYear.includes(reqYear) || reqYear.includes(trackYear)) {
      yearMatch = true;
    }

    matchingDetails.year = yearMatch;
    if (yearMatch) {
      matchedCriteria++;
      feedback.push(`✓ Période / Année validée : ${criteria.year}`);
    } else {
      feedback.push(`✗ L'année ou décennie demandée est "${criteria.year}"`);
    }
  }

  // 5. Emotion / Mood check
  if (criteria.emotion && criteria.emotion.trim()) {
    totalCriteria++;
    const reqEmotion = criteria.emotion.toLowerCase().trim();
    const trackEmotion = (track.emotion || '').toLowerCase().trim();
    const match = !trackEmotion || trackEmotion.includes(reqEmotion) || reqEmotion.includes(trackEmotion);
    matchingDetails.emotion = match;
    if (match) {
      matchedCriteria++;
      feedback.push(`✓ Vibe / Émotion validée : ${criteria.emotion}`);
    } else {
      feedback.push(`✗ L'ambiance attendue est "${criteria.emotion}"`);
    }
  }

  // 6. Other requirements check
  if (criteria.otherRequirements && criteria.otherRequirements.trim()) {
    feedback.push(`ℹ Condition spéciale : ${criteria.otherRequirements}`);
  }

  const score = totalCriteria > 0 ? Math.round((matchedCriteria / totalCriteria) * 100) : 100;
  // If at least 70% or all specified criteria matched, consider valid
  const isValid = totalCriteria === 0 || score >= 60;

  return {
    isValid,
    score,
    feedback,
    matchingDetails,
  };
}

// FAST SEARCH / LOOKUP MUSIC HELPER VIA PUBLIC ITUNES API (No Auth Key Required)
export async function searchMusicCatalog(query: string): Promise<Array<{
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  previewUrl: string;
  coverUrl: string;
}>> {
  if (!query || query.trim().length < 2) return [];
  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${encoded}&entity=song&limit=6`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((item: any) => ({
      title: item.trackName || item.collectionName || 'Titre inconnu',
      artist: item.artistName || 'Artiste',
      album: item.collectionName || '',
      genre: item.primaryGenreName || 'Pop',
      year: item.releaseDate ? item.releaseDate.slice(0, 4) : '',
      previewUrl: item.previewUrl || '',
      coverUrl: (item.artworkUrl100 || '').replace('100x100bb', '300x300bb'),
    }));
  } catch (e) {
    console.warn('Music catalog lookup error:', e);
    return [];
  }
}

// TRACK LISTENER STATS TRACKERS
export function recordTrackShare(stationId: string, userId: string, trackTitle: string): void {
  try {
    const raw = localStorage.getItem(USER_SHARES_KEY);
    const shares: Record<string, number> = raw ? JSON.parse(raw) : {};
    const count = (shares[userId] || 0) + 1;
    shares[userId] = count;
    if (stationId) {
      shares[`${userId}_${stationId}`] = (shares[`${userId}_${stationId}`] || 0) + 1;
    }
    localStorage.setItem(USER_SHARES_KEY, JSON.stringify(shares));

    // Award immediate XP points for sharing a liked track (+20 pts)
    addPointsToUser(userId, 20, `Partage du titre "${trackTitle}" sur la station.`);
  } catch {}
}

export function recordListeningTime(stationId: string, userId: string, durationSeconds: number): void {
  try {
    const raw = localStorage.getItem(USER_LISTENING_KEY);
    const times: Record<string, number> = raw ? JSON.parse(raw) : {};
    const current = (times[userId] || 0) + durationSeconds;
    times[userId] = current;
    if (stationId) {
      times[`${userId}_${stationId}`] = (times[`${userId}_${stationId}`] || 0) + durationSeconds;
    }
    localStorage.setItem(USER_LISTENING_KEY, JSON.stringify(times));

    // Every 15 minutes of listening (900s), award 15 points
    if (Math.floor(current / 900) > Math.floor((current - durationSeconds) / 900)) {
      addPointsToUser(userId, 15, `Fidélité d'écoute (15 min sur l'antenne).`);
    }
  } catch {}
}
