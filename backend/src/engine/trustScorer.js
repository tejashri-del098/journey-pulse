/**
 * @module engine/trustScorer
 * @description Computes trust scores for campaign simulations based on persona
 * manipulation flags. Weights privacy-sensitive personas higher and synthesizes
 * a "chief concern" from the most commonly flagged manipulation tactics.
 */

/**
 * Trust band definitions — each band maps a score range to a label, emoji, and color.
 * @type {Array<{min: number, max: number, label: string, emoji: string, color: string}>}
 */
export const TRUST_BANDS = [
  { min: 80, max: 100, label: 'Trustworthy', emoji: '✅', color: '#22c55e' },
  { min: 50, max: 79,  label: 'Caution',     emoji: '⚠️', color: '#f59e0b' },
  { min: 0,  max: 49,  label: 'Risky',       emoji: '🚨', color: '#ef4444' },
];

/**
 * Privacy-sensitive segments whose manipulation flags carry 1.5x weight.
 * @type {Set<string>}
 */
const PRIVACY_SENSITIVE_SEGMENTS = new Set([
  'Privacy-First Skeptics',
]);

/**
 * Computes a trust score (0–100) from persona reactions.
 *
 * Manipulation flags from privacy-sensitive personas are weighted 1.5x,
 * while flags from other segments carry a 1.0x weight. The score is
 * calculated as: 100 - (weightedFlaggedCount / totalWeightedCount * 100).
 *
 * @param {Array<Object>} personaReactions - Array of persona reaction objects
 * @param {boolean} personaReactions[].manipulationFlag - Whether the persona flagged manipulation
 * @param {string} [personaReactions[].segment] - Persona's customer segment
 * @returns {number} Trust score clamped between 0 and 100, rounded to 1 decimal
 */
export function computeTrustScore(personaReactions) {
  if (!personaReactions || personaReactions.length === 0) {
    return 100;
  }

  const totalCount = personaReactions.length;
  let weightedFlaggedCount = 0;

  for (const reaction of personaReactions) {
    if (reaction.manipulationFlag === true) {
      const segment = reaction.segment || '';
      const weight = PRIVACY_SENSITIVE_SEGMENTS.has(segment) ? 1.5 : 1.0;
      weightedFlaggedCount += weight;
    }
  }

  const score = 100 - (weightedFlaggedCount / totalCount * 100);

  // Clamp between 0 and 100
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

/**
 * Returns the trust band object for a given numeric score.
 *
 * @param {number} score - Trust score (0–100)
 * @returns {{min: number, max: number, label: string, emoji: string, color: string}} The matching band
 */
export function getBand(score) {
  for (const band of TRUST_BANDS) {
    if (score >= band.min && score <= band.max) {
      return band;
    }
  }
  // Fallback to the lowest band if score is somehow out of range
  return TRUST_BANDS[TRUST_BANDS.length - 1];
}

/**
 * Common stop words to filter out during phrase tokenization.
 * @type {Set<string>}
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'to', 'of', 'in', 'for', 'on', 'and',
  'or', 'but', 'with', 'as', 'at', 'by', 'this', 'that', 'was', 'are',
  'be', 'has', 'have', 'had', 'do', 'does', 'did', 'not', 'no', 'so',
  'if', 'they', 'them', 'their', 'its', 'my', 'me', 'i', 'we', 'you',
  'he', 'she', 'his', 'her', 'from', 'up', 'out', 'about', 'than',
  'too', 'very', 'just', 'like', 'feel', 'feels', 'felt', 'makes',
  'made', 'using', 'use', 'uses', 'being', 'been',
]);

/**
 * Known manipulation tactic patterns to look for in reasons.
 * Maps a pattern keyword/phrase to a human-readable tactic label.
 * @type {Array<{pattern: RegExp, label: string}>}
 */
const TACTIC_PATTERNS = [
  { pattern: /urgency|urgent|hurry|expires?|countdown|limited.?time|act now|hours? left/i, label: 'artificial urgency' },
  { pattern: /scarcity|running out|only \d+ left|almost gone|selling fast|while supplies/i, label: 'false scarcity' },
  { pattern: /fear.?of.?missing|fomo|left behind|everyone else|don'?t miss|missing out/i, label: 'fear of missing out (FOMO)' },
  { pattern: /social.?proof|everyone is|others are|people like you|popular|trending/i, label: 'social pressure' },
  { pattern: /guilt|shame|disappoint|let.*down|you owe/i, label: 'guilt-tripping' },
  { pattern: /track|watch|monitor|we know|we noticed|we'?ve seen|browsing|based on your/i, label: 'surveillance-based personalization' },
  { pattern: /final warning|last chance|warning|alert/i, label: 'threatening language' },
  { pattern: /exclusive|vip|special|chosen|selected/i, label: 'false exclusivity' },
  { pattern: /manipulat|deceiv|trick|dishonest|mislead|dark.?pattern/i, label: 'deceptive practices' },
  { pattern: /pressure|pressur|forced|coerce|aggressive/i, label: 'high-pressure tactics' },
];

/**
 * Extracts key phrases from a manipulation reason string.
 * Tokenizes into 1-3 word n-grams after removing stop words.
 *
 * @param {string} reason - The manipulation reason text
 * @returns {string[]} Array of key phrases
 */
function extractKeyPhrases(reason) {
  if (!reason) return [];

  const phrases = [];

  // First, check against known tactic patterns
  for (const { pattern, label } of TACTIC_PATTERNS) {
    if (pattern.test(reason)) {
      phrases.push(label);
    }
  }

  // Also extract quoted phrases from the reason (e.g., 'act now or lose out')
  const quotedMatches = reason.match(/['""'](.*?)['""']/g);
  if (quotedMatches) {
    for (const match of quotedMatches) {
      const cleaned = match.replace(/['"'""']/g, '').trim().toLowerCase();
      if (cleaned.length > 2) {
        phrases.push(cleaned);
      }
    }
  }

  return phrases;
}

/**
 * Computes the "chief concern" — the most commonly flagged manipulation tactic
 * across all persona reactions.
 *
 * @param {Array<Object>} personaReactions - Array of persona reaction objects
 * @param {boolean} personaReactions[].manipulationFlag - Whether manipulation was flagged
 * @param {string|null} personaReactions[].manipulationReason - Explanation of the flag
 * @param {string} [personaReactions[].segment] - Persona's customer segment
 * @returns {string|null} A synthesized sentence describing the chief concern, or null if none
 */
export function computeChiefConcern(personaReactions) {
  if (!personaReactions || personaReactions.length === 0) {
    return null;
  }

  // Collect all non-null manipulation reasons
  const flaggedReactions = personaReactions.filter(
    (r) => r.manipulationFlag === true && r.manipulationReason
  );

  if (flaggedReactions.length === 0) {
    return null;
  }

  // Build frequency map of key phrases/tactics
  /** @type {Map<string, {count: number, segments: Set<string>}>} */
  const phraseFrequency = new Map();

  for (const reaction of flaggedReactions) {
    const phrases = extractKeyPhrases(reaction.manipulationReason);
    const segment = reaction.segment || 'unknown';

    for (const phrase of phrases) {
      const normalized = phrase.toLowerCase();
      if (!phraseFrequency.has(normalized)) {
        phraseFrequency.set(normalized, { count: 0, segments: new Set() });
      }
      const entry = phraseFrequency.get(normalized);
      entry.count += 1;
      entry.segments.add(segment);
    }
  }

  if (phraseFrequency.size === 0) {
    // Fallback: just report the raw count
    const totalFlagged = flaggedReactions.length;
    const totalPersonas = personaReactions.length;
    return `${totalFlagged} of ${totalPersonas} personas flagged this campaign as potentially manipulative.`;
  }

  // Find the most frequently mentioned tactic
  let topPhrase = '';
  let topEntry = { count: 0, segments: new Set() };

  for (const [phrase, entry] of phraseFrequency) {
    if (entry.count > topEntry.count) {
      topPhrase = phrase;
      topEntry = entry;
    }
  }

  // Synthesize a human-readable chief concern
  const totalFlagged = flaggedReactions.length;
  const totalPersonas = personaReactions.length;
  const segmentList = [...topEntry.segments];
  const segmentDesc = segmentList.length === 1
    ? segmentList[0]
    : segmentList.slice(0, -1).join(', ') + ' and ' + segmentList[segmentList.length - 1];

  // Check if the top phrase is a quoted phrase from the campaign or a tactic label
  const isQuotedPhrase = !TACTIC_PATTERNS.some(({ label }) => label === topPhrase);

  if (isQuotedPhrase) {
    return `The phrase '${topPhrase}' was flagged by ${topEntry.count} of ${totalPersonas} personas (${segmentDesc} segments) as manipulative.`;
  }

  return `${topEntry.count} of ${totalPersonas} personas flagged this campaign for ${topPhrase}, primarily from ${segmentDesc} segments.`;
}

/**
 * Full campaign trust scoring — computes the trust score, band, chief concern,
 * and flagged persona details.
 *
 * @param {Array<Object>} personaReactions - Array of persona reaction objects with segment info
 * @returns {{
 *   trustScore: number,
 *   band: {min: number, max: number, label: string, emoji: string, color: string},
 *   bandLabel: string,
 *   bandEmoji: string,
 *   bandColor: string,
 *   chiefConcern: string|null,
 *   flaggedCount: number,
 *   totalCount: number,
 *   flaggedPersonas: Array<{personaId: string, segment: string, reason: string|null}>
 * }}
 */
export function scoreCampaign(personaReactions) {
  const trustScore = computeTrustScore(personaReactions);
  const band = getBand(trustScore);
  const chiefConcern = computeChiefConcern(personaReactions);

  const flaggedPersonas = personaReactions
    .filter((r) => r.manipulationFlag === true)
    .map((r) => ({
      personaId: r.personaId,
      segment: r.segment || 'unknown',
      reason: r.manipulationReason || null,
    }));

  return {
    trustScore,
    band,
    bandLabel: band.label,
    bandEmoji: band.emoji,
    bandColor: band.color,
    chiefConcern,
    flaggedCount: flaggedPersonas.length,
    totalCount: personaReactions.length,
    flaggedPersonas,
  };
}
