/**
 * @module embedder
 * @description Wrapper around Google Gemini's text-embedding-004 model.
 * Provides helpers for embedding persona profiles, campaign text, and
 * arbitrary strings with automatic retry logic.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = 'text-embedding-004';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000; // exponential back-off base

/**
 * Lazily-initialised Gemini client and embedding model.
 * Deferred so the module can be imported before env vars are set (e.g. in tests).
 */
let _model = null;

/**
 * Returns the singleton embedding model instance.
 *
 * @returns {import('@google/generative-ai').GenerativeModel}
 * @throws {Error} If GEMINI_API_KEY is not set.
 * @private
 */
function getModel() {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is not set. ' +
        'Please set it before calling any embedding function.'
      );
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    _model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  }
  return _model;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Embeds a single text string.
 *
 * @param {string} text - The text to embed.
 * @returns {Promise<number[]>} A float array representing the embedding vector.
 * @throws {Error} If the text is empty or the API call fails after retries.
 */
export async function embedText(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('embedText requires a non-empty string.');
  }

  return withRetries(async () => {
    const model = getModel();
    const result = await model.embedContent(text);
    return result.embedding.values;
  }, `embedText("${text.slice(0, 60)}…")`);
}

/**
 * Embeds an array of texts efficiently using batch embedding.
 *
 * @param {string[]} texts - Array of non-empty strings to embed.
 * @returns {Promise<number[][]>} Array of embedding vectors (one per input text).
 * @throws {Error} If any text is invalid or the API call fails after retries.
 */
export async function embedBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('embedBatch requires a non-empty array of strings.');
  }

  const invalid = texts.findIndex(
    (t) => typeof t !== 'string' || t.trim().length === 0
  );
  if (invalid !== -1) {
    throw new Error(`embedBatch: item at index ${invalid} is not a valid non-empty string.`);
  }

  return withRetries(async () => {
    const model = getModel();
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { parts: [{ text }] },
      })),
    });
    return result.embeddings.map((e) => e.values);
  }, 'embedBatch');
}

/**
 * Builds a natural-language profile string from a persona object and embeds it.
 *
 * The profile captures all key dimensions used for similarity matching:
 * segment, demographics, behavioural scores, mood, and backstory.
 *
 * @param {Object} persona - A persona object with the standard schema fields.
 * @param {string} persona.segment - Customer segment name.
 * @param {number} persona.age - Age of the persona.
 * @param {string} persona.gender - Gender of the persona.
 * @param {string} persona.backstory - Short backstory narrative.
 * @param {string} persona.mood - Current emotional state.
 * @param {string} persona.channelPreference - Preferred marketing channel.
 * @param {number} persona.discountSensitivity - Discount sensitivity (1-10).
 * @param {number} persona.fatigueLevel - Marketing fatigue level (1-10).
 * @param {number} persona.privacyComfort - Comfort with data use (1-10).
 * @returns {Promise<number[]>} The embedding vector for the persona profile.
 */
export async function embedPersonaProfile(persona) {
  if (!persona || typeof persona !== 'object') {
    throw new Error('embedPersonaProfile requires a valid persona object.');
  }

  const profileText = buildPersonaProfileText(persona);
  return embedText(profileText);
}

/**
 * Embeds campaign text for retrieval / similarity matching against personas.
 *
 * @param {string} campaignText - The campaign copy or description to embed.
 * @returns {Promise<number[]>} The embedding vector for the campaign text.
 * @throws {Error} If campaignText is empty or API call fails.
 */
export async function embedCampaignText(campaignText) {
  if (typeof campaignText !== 'string' || campaignText.trim().length === 0) {
    throw new Error('embedCampaignText requires a non-empty campaign text string.');
  }

  return embedText(`Marketing campaign: ${campaignText}`);
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Constructs a rich text representation of a persona for embedding.
 * The wording is chosen to maximise semantic signal for the embedding model.
 *
 * @param {Object} persona
 * @returns {string}
 * @private
 */
function buildPersonaProfileText(persona) {
  const parts = [
    `Customer segment: ${persona.segment ?? 'unknown'}.`,
    `Age: ${persona.age ?? 'unknown'}, Gender: ${persona.gender ?? 'unknown'}.`,
    `Preferred channel: ${persona.channelPreference ?? 'unknown'}.`,
    `Discount sensitivity: ${persona.discountSensitivity ?? '?'}/10.`,
    `Marketing fatigue level: ${persona.fatigueLevel ?? '?'}/10.`,
    `Privacy comfort with data use: ${persona.privacyComfort ?? '?'}/10.`,
    `Current mood: ${persona.mood ?? 'neutral'}.`,
    `Backstory: ${persona.backstory ?? 'No backstory provided.'}`,
  ];

  return parts.join(' ');
}

/**
 * Executes an async function with exponential back-off retries.
 *
 * @param {() => Promise<T>} fn - The async function to attempt.
 * @param {string} label - A human-readable label for log messages.
 * @param {number} [maxRetries=MAX_RETRIES] - Maximum number of attempts.
 * @returns {Promise<T>} The result of the successful call.
 * @throws {Error} The last error if all retries are exhausted.
 * @template T
 * @private
 */
async function withRetries(fn, label, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        console.error(
          `[embedder] ${label} failed after ${maxRetries} attempts:`,
          error.message
        );
      } else {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[embedder] ${label} attempt ${attempt}/${maxRetries} failed: ${error.message}. ` +
          `Retrying in ${delay}ms…`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Promise-based sleep helper.
 *
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 * @private
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
