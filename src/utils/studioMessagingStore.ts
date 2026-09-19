export type StudioRequestType = 'open_message' | 'poll_mcq' | 'poll_yes_no' | 'song_request';

export interface StudioRequest {
  id: string;
  stationId: string; // 'all' or specific station id
  stationName: string;
  type: StudioRequestType;
  title: string;
  promptMessage?: string;
  options?: string[]; // for poll_mcq
  mcqMode?: 'single' | 'multiple'; // for poll_mcq
  binaryChoices?: [string, string]; // for poll_yes_no (default ['OUI', 'NON'])
  allowDirectComment?: boolean; // allow commentary with poll
  binaryChoiceDirectMessagePrompt?: string;
  songRules?: {
    genre?: string;
    decade?: string;
    customRule?: string;
  };
  durationSeconds: number;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  isActive: boolean;
  maxResponses?: number;
  authorName: string;
}

export interface StudioResponse {
  id: string;
  requestId: string;
  stationId: string;
  type: StudioRequestType;
  userName: string;
  userEmail?: string;
  content: string;
  metadata?: {
    pollChoice?: string;
    pollChoices?: string[];
    directComment?: string;
    comment?: string;
    songTitle?: string;
    songArtist?: string;
    dedication?: string;
    normalizedKey?: string;
  };
  isStarred?: boolean;
  isReadOnAir?: boolean;
  createdAt: string; // ISO
}

const STORAGE_KEY_REQUESTS = 'synapse_studio_requests_v1';
const STORAGE_KEY_RESPONSES = 'synapse_studio_responses_v1';
export const EVENT_STUDIO_REQUEST_CHANGED = 'synapse_studio_request_changed';

function notifySubscribers() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_STUDIO_REQUEST_CHANGED));
  }
}

export function getStudioRequests(): StudioRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REQUESTS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse studio requests', e);
    return [];
  }
}

export function saveStudioRequests(requests: StudioRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
    notifySubscribers();
  } catch (e) {
    console.error('Failed to save studio requests', e);
  }
}

export function getStudioResponses(): StudioResponse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RESPONSES);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse studio responses', e);
    return [];
  }
}

export function saveStudioResponses(responses: StudioResponse[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RESPONSES, JSON.stringify(responses));
    notifySubscribers();
  } catch (e) {
    console.error('Failed to save studio responses', e);
  }
}

/**
 * Returns currently active & unexpired studio request for a station
 */
export function getActiveStudioRequest(stationId: string): StudioRequest | null {
  const requests = getStudioRequests();
  const now = Date.now();

  const active = requests.find((req) => {
    if (!req.isActive) return false;
    const exp = new Date(req.expiresAt).getTime();
    if (exp <= now) return false;
    return req.stationId === 'all' || req.stationId === stationId;
  });

  return active || null;
}

/**
 * Creates and launches a new interactive studio request from the admin console
 */
export function createStudioRequest(params: {
  stationId: string;
  stationName: string;
  type: StudioRequestType;
  title: string;
  promptMessage?: string;
  options?: string[];
  mcqMode?: 'single' | 'multiple';
  binaryChoices?: [string, string];
  allowDirectComment?: boolean;
  binaryChoiceDirectMessagePrompt?: string;
  songRules?: {
    genre?: string;
    decade?: string;
    customRule?: string;
  };
  durationSeconds: number;
  authorName: string;
  maxResponses?: number;
}): StudioRequest {
  const current = getStudioRequests();

  // Deactivate any existing active request on the same station/all to avoid collision
  const deactivated = current.map((r) => {
    if (r.isActive && (r.stationId === 'all' || r.stationId === params.stationId)) {
      return { ...r, isActive: false };
    }
    return r;
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.durationSeconds * 1000).toISOString();

  const newRequest: StudioRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    stationId: params.stationId,
    stationName: params.stationName,
    type: params.type,
    title: params.title,
    promptMessage: params.promptMessage,
    options: params.options,
    mcqMode: params.mcqMode || 'single',
    binaryChoices: params.binaryChoices || ['OUI', 'NON'],
    allowDirectComment: params.allowDirectComment ?? false,
    binaryChoiceDirectMessagePrompt: params.binaryChoiceDirectMessagePrompt,
    songRules: params.songRules,
    durationSeconds: params.durationSeconds,
    createdAt: now.toISOString(),
    expiresAt,
    isActive: true,
    maxResponses: params.maxResponses,
    authorName: params.authorName,
  };

  saveStudioRequests([newRequest, ...deactivated]);
  return newRequest;
}

/**
 * Closes an active studio request immediately
 */
export function closeStudioRequest(requestId: string): void {
  const current = getStudioRequests();
  const updated = current.map((r) => (r.id === requestId ? { ...r, isActive: false } : r));
  saveStudioRequests(updated);
}

/**
 * Adds extra time to an active studio request
 */
export function extendStudioRequestTime(requestId: string, extraSeconds: number): void {
  const current = getStudioRequests();
  const updated = current.map((r) => {
    if (r.id === requestId && r.isActive) {
      const currentExp = new Date(r.expiresAt).getTime();
      const newExp = new Date(Math.max(Date.now(), currentExp) + extraSeconds * 1000).toISOString();
      return {
        ...r,
        expiresAt: newExp,
        durationSeconds: r.durationSeconds + extraSeconds,
      };
    }
    return r;
  });
  saveStudioRequests(updated);
}

/**
 * Submits a listener's answer to a studio request
 */
export function submitStudioResponse(params: {
  requestId: string;
  stationId: string;
  type: StudioRequestType;
  userName: string;
  userEmail?: string;
  content: string;
  metadata?: StudioResponse['metadata'];
}): StudioResponse {
  const current = getStudioResponses();
  const newResponse: StudioResponse = {
    id: `resp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    requestId: params.requestId,
    stationId: params.stationId,
    type: params.type,
    userName: params.userName.trim() || 'Auditeur Anonyme',
    userEmail: params.userEmail,
    content: params.content,
    metadata: params.metadata,
    isStarred: false,
    isReadOnAir: false,
    createdAt: new Date().toISOString(),
  };

  saveStudioResponses([newResponse, ...current]);
  return newResponse;
}

/**
 * Get all responses for a given request
 */
export function getResponsesForRequest(requestId: string): StudioResponse[] {
  const all = getStudioResponses();
  return all.filter((r) => r.requestId === requestId);
}

/**
 * Update response status (star / mark as read on air)
 */
export function updateStudioResponseStatus(
  responseId: string,
  updates: Partial<Pick<StudioResponse, 'isStarred' | 'isReadOnAir'>>
): void {
  const current = getStudioResponses();
  const updated = current.map((r) => (r.id === responseId ? { ...r, ...updates } : r));
  saveStudioResponses(updated);
}

/**
 * Delete a response
 */
export function deleteStudioResponse(responseId: string): void {
  const current = getStudioResponses();
  const updated = current.filter((r) => r.id !== responseId);
  saveStudioResponses(updated);
}

/**
 * Batch update multiple responses (e.g. mark entire group as read on air)
 */
export function batchUpdateStudioResponses(
  responseIds: string[],
  updates: Partial<Pick<StudioResponse, 'isStarred' | 'isReadOnAir'>>
): void {
  if (responseIds.length === 0) return;
  const current = getStudioResponses();
  const idSet = new Set(responseIds);
  const updated = current.map((r) => (idSet.has(r.id) ? { ...r, ...updates } : r));
  saveStudioResponses(updated);
}

/**
 * Batch delete multiple responses
 */
export function batchDeleteStudioResponses(responseIds: string[]): void {
  if (responseIds.length === 0) return;
  const current = getStudioResponses();
  const idSet = new Set(responseIds);
  const updated = current.filter((r) => !idSet.has(r.id));
  saveStudioResponses(updated);
}

/**
 * Normalizes title + artist for precise duplicate detection and grouping
 */
export function normalizeSongKey(title: string, artist: string): string {
  const clean = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
      .replace(/\s+/g, ' ')
      .trim();

  return `${clean(title)}__${clean(artist)}`;
}

/**
 * Checks if a song has already been submitted by another listener for this request
 */
export function isSongAlreadySubmitted(
  requestId: string,
  title: string,
  artist: string,
  customResponses?: StudioResponse[]
): { isDuplicate: boolean; existingSubmitter?: string; existingTitle?: string } {
  if (!title.trim() || !artist.trim()) {
    return { isDuplicate: false };
  }

  const targetKey = normalizeSongKey(title, artist);
  const allResponses = customResponses || getStudioResponses();
  const reqResponses = allResponses.filter((r) => r.requestId === requestId);

  const existing = reqResponses.find((r) => {
    if (r.metadata?.songTitle && r.metadata?.songArtist) {
      return normalizeSongKey(r.metadata.songTitle, r.metadata.songArtist) === targetKey;
    }
    // fallback check content
    const normalizedContent = r.content
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const probe = `${title} ${artist}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return normalizedContent.includes(probe) || probe.includes(normalizedContent);
  });

  if (existing) {
    return {
      isDuplicate: true,
      existingSubmitter: existing.userName,
      existingTitle: existing.metadata?.songTitle
        ? `${existing.metadata.songTitle} - ${existing.metadata.songArtist}`
        : existing.content,
    };
  }

  return { isDuplicate: false };
}

/**
 * Grouped Response Data Structure for Host/Studio Monitor
 */
export interface GroupedStudioResponse {
  key: string;
  displayContent: string;
  subtitle?: string;
  type: StudioRequestType;
  count: number;
  percentage: number; // 0 to 100
  items: StudioResponse[];
  allReadOnAir: boolean;
  anyStarred: boolean;
  lastCreatedAt: string;
}

/**
 * Normalizes general text message for clustering identical / near-identical listener messages
 */
export function normalizeMessageContentKey(content: string): string {
  return content
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Groups raw responses into aggregated clusters with proportion calculation
 */
export function groupStudioResponses(
  responses: StudioResponse[],
  _request?: StudioRequest | null
): GroupedStudioResponse[] {
  if (!responses || responses.length === 0) return [];

  const groupsMap = new Map<string, {
    displayContent: string;
    subtitle?: string;
    type: StudioRequestType;
    items: StudioResponse[];
  }>();

  for (const resp of responses) {
    // 1. MCQ POLL
    if (resp.type === 'poll_mcq') {
      // If multi choices were submitted
      const choices = resp.metadata?.pollChoices && resp.metadata.pollChoices.length > 0
        ? resp.metadata.pollChoices
        : [resp.content];

      for (const choice of choices) {
        const key = `mcq_${choice.trim().toLowerCase()}`;
        const existing = groupsMap.get(key);
        if (existing) {
          existing.items.push(resp);
        } else {
          groupsMap.set(key, {
            displayContent: choice.trim(),
            type: 'poll_mcq',
            items: [resp],
          });
        }
      }
      continue;
    }

    // 2. SONG REQUEST
    if (resp.type === 'song_request') {
      const songTitle = resp.metadata?.songTitle || resp.content.split('-')[0]?.trim() || resp.content;
      const songArtist = resp.metadata?.songArtist || resp.content.split('-')[1]?.trim() || '';
      const key = `song_${normalizeSongKey(songTitle, songArtist)}`;
      const displayContent = songArtist ? `${songTitle} • ${songArtist}` : songTitle;

      const existing = groupsMap.get(key);
      if (existing) {
        existing.items.push(resp);
      } else {
        groupsMap.set(key, {
          displayContent,
          subtitle: songArtist ? `Artiste : ${songArtist}` : undefined,
          type: 'song_request',
          items: [resp],
        });
      }
      continue;
    }

    // 3. POLL YES/NO / BINARY
    if (resp.type === 'poll_yes_no') {
      const choice = resp.metadata?.pollChoice || resp.content || 'OUI';
      const key = `binary_${choice.trim().toUpperCase()}`;

      const existing = groupsMap.get(key);
      if (existing) {
        existing.items.push(resp);
      } else {
        groupsMap.set(key, {
          displayContent: choice.trim().toUpperCase(),
          type: 'poll_yes_no',
          items: [resp],
        });
      }
      continue;
    }

    // 4. OPEN MESSAGE / REACTION
    const normKey = normalizeMessageContentKey(resp.content);
    const key = `msg_${normKey || resp.id}`;

    const existing = groupsMap.get(key);
    if (existing) {
      existing.items.push(resp);
      // Pick the cleaner title if longer / better capitalized
      if (resp.content.length > existing.displayContent.length && !resp.content.endsWith('...')) {
        existing.displayContent = resp.content;
      }
    } else {
      groupsMap.set(key, {
        displayContent: resp.content,
        type: 'open_message',
        items: [resp],
      });
    }
  }

  // Calculate total votes / weight
  const totalSubmissions = responses.length;

  const result: GroupedStudioResponse[] = [];

  groupsMap.forEach((val, key) => {
    const items = val.items;
    const count = items.length;
    const percentage = totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0;
    const allReadOnAir = items.every((i) => i.isReadOnAir);
    const anyStarred = items.some((i) => i.isStarred);
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    result.push({
      key,
      displayContent: val.displayContent,
      subtitle: val.subtitle,
      type: val.type,
      count,
      percentage,
      items: sorted,
      allReadOnAir,
      anyStarred,
      lastCreatedAt: sorted[0]?.createdAt || new Date().toISOString(),
    });
  });

  // Sort groups by count descending, then latest createdAt
  return result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime();
  });
}

