/**
 * Antenne & Chat Profanity Filter for Synapse Radio
 * Detects insults, slurs, hate speech and vulgarities in French and English,
 * with leetspeak and accent normalization.
 */

// Common profane words in French & English (roots and stems)
const PROFANE_WORDS = [
  // French insults & slurs
  'connard', 'connasse', 'conne', 'conard', 'salope', 'salopard', 'pute', 'putain',
  'batard', 'bâtard', 'encule', 'enculé', 'enculee', 'enculée', 'fdp', 'ntm',
  'nique', 'niquer', 'niquez', 'baiser', 'baise', 'baisé', 'chienne', 'chienasse',
  'trouduc', 'trouduk', 'trouducu', 'foutre', 'merde', 'merdeux', 'chier',
  'bite', 'couille', 'couilles', 'chatte', 'zizi', 'gueule', 'ta gueule', 'tg',
  'bougnoule', 'negro', 'nègre', 'youpin', 'pede', 'pédé', 'gouine', 'mongol',
  'retard', 'debile', 'débile', 'abruti', 'abrutie', 'taré', 'tare', 'salaud',
  
  // English common profanities
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'bastard', 'asshole', 'dick', 'pussy', 'cunt', 'slut', 'whore', 'fag', 'faggot',
  'nigger', 'nigga', 'retard'
];

/**
 * Normalizes text for profanity detection:
 * - strips accents
 * - maps leetspeak numbers/symbols to letters
 * - collapses repeated letters (e.g. "coooonnnard" -> "connard")
 */
export function normalizeTextForFilter(input: string): string {
  if (!input) return '';

  let text = input.toLowerCase();

  // Strip accents
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Leetspeak replacements
  text = text
    .replace(/[@4]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[8]/g, 'b');

  // Collapse repeated identical characters (3 or more -> 1 or 2)
  text = text.replace(/(.)\1{2,}/g, '$1$1');

  return text;
}

export interface ProfanityCheckResult {
  hasProfanity: boolean;
  matchedWords: string[];
  warningMessage?: string;
}

/**
 * Checks if a string contains inappropriate words or insults
 */
export function checkProfanity(input: string): ProfanityCheckResult {
  if (!input || !input.trim()) {
    return { hasProfanity: false, matchedWords: [] };
  }

  const normalized = normalizeTextForFilter(input);
  const matchedWords: string[] = [];

  // 1. Direct word boundaries check and acronyms
  const words = normalized.split(/[\s,.;:!?_\-/\\]+/).filter(Boolean);

  for (const word of words) {
    if (PROFANE_WORDS.includes(word)) {
      matchedWords.push(word);
    }
  }

  // 2. Substring check for severe compound insults (e.g., "filsdepute", "tagueule")
  const compact = normalized.replace(/\s+/g, '');
  const severeCompounds = ['fdp', 'ntm', 'filsdepute', 'tagueule', 'encule', 'salope', 'connard', 'nique'];
  for (const compound of severeCompounds) {
    if (compact.includes(compound) && !matchedWords.includes(compound)) {
      matchedWords.push(compound);
    }
  }

  if (matchedWords.length > 0) {
    return {
      hasProfanity: true,
      matchedWords,
      warningMessage: `⚠️ Propos inapproprié détecté pour l'antenne (« ${matchedWords[0]} »). Merci de reformuler avec courtoisie.`,
    };
  }

  return {
    hasProfanity: false,
    matchedWords: [],
  };
}
