/**
 * @module engine/personaBank
 * @description Persona bank — persistence, validation, filtering, and
 * semantic retrieval of customer personas.
 *
 * Data lives in JSON files so we avoid any database dependency while still
 * supporting vector-based retrieval via cosine similarity.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Path setup (ESM __dirname equivalent)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const PERSONAS_PATH = join(DATA_DIR, 'personas.json');
const EMBEDDINGS_PATH = join(DATA_DIR, 'embeddings.json');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Required field names every valid persona object must have.
 * @type {string[]}
 */
export const PERSONA_SCHEMA_FIELDS = [
  'id',
  'segment',
  'name',
  'age',
  'gender',
  'channelPreference',
  'discountSensitivity',
  'fatigueLevel',
  'privacyComfort',
  'lastInteractionDays',
  'mood',
  'backstory',
];

/**
 * Valid values for enum-like persona fields.
 * @type {Record<string, string[]>}
 */
const ENUM_VALUES = {
  channelPreference: ['email', 'sms', 'push', 'any'],
  mood: ['happy', 'neutral', 'frustrated', 'curious', 'skeptical', 'busy'],
};

/**
 * Numeric fields and their allowed [min, max] ranges.
 * @type {Record<string, [number, number]>}
 */
const NUMERIC_RANGES = {
  age: [1, 120],
  discountSensitivity: [1, 10],
  fatigueLevel: [1, 10],
  privacyComfort: [1, 10],
  lastInteractionDays: [0, 9999],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a persona object against the schema.
 *
 * @param {object} persona — the persona to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePersona(persona) {
  const errors = [];

  if (!persona || typeof persona !== 'object') {
    return { valid: false, errors: ['Persona must be a non-null object'] };
  }

  // --- Required fields ---
  for (const field of PERSONA_SCHEMA_FIELDS) {
    if (!(field in persona) || persona[field] === undefined || persona[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // If critical fields are missing, short-circuit — further checks would throw.
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // --- Type checks ---
  if (typeof persona.id !== 'string' || persona.id.length === 0) {
    errors.push('"id" must be a non-empty string');
  }
  if (typeof persona.name !== 'string' || persona.name.trim().length === 0) {
    errors.push('"name" must be a non-empty string');
  }
  if (typeof persona.segment !== 'string' || persona.segment.trim().length === 0) {
    errors.push('"segment" must be a non-empty string');
  }
  if (typeof persona.gender !== 'string' || persona.gender.trim().length === 0) {
    errors.push('"gender" must be a non-empty string');
  }
  if (typeof persona.backstory !== 'string' || persona.backstory.trim().length === 0) {
    errors.push('"backstory" must be a non-empty string');
  }

  // --- Numeric range checks ---
  for (const [field, [min, max]] of Object.entries(NUMERIC_RANGES)) {
    const val = persona[field];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      errors.push(`"${field}" must be a finite number, got ${typeof val}`);
    } else if (val < min || val > max) {
      errors.push(`"${field}" must be between ${min} and ${max}, got ${val}`);
    }
  }

  // --- Enum checks ---
  for (const [field, allowed] of Object.entries(ENUM_VALUES)) {
    if (!allowed.includes(persona[field])) {
      errors.push(
        `"${field}" must be one of [${allowed.join(', ')}], got "${persona[field]}"`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Persistence — Personas
// ---------------------------------------------------------------------------

/**
 * Loads personas from the JSON data file.
 *
 * @returns {Promise<object[]>} array of persona objects (may be empty)
 */
export async function loadPersonas() {
  try {
    const raw = await readFile(PERSONAS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Saves an array of personas to the JSON data file.
 *
 * @param {object[]} personas — array of persona objects to persist
 * @returns {Promise<void>}
 */
export async function savePersonas(personas) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PERSONAS_PATH, JSON.stringify(personas, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Persistence — Embeddings
// ---------------------------------------------------------------------------

/**
 * Loads the embeddings map (personaId → vector) from the JSON data file.
 *
 * @returns {Promise<Record<string, number[]>>}
 */
export async function loadEmbeddings() {
  try {
    const raw = await readFile(EMBEDDINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

/**
 * Saves the embeddings map to the JSON data file.
 *
 * @param {Record<string, number[]>} embeddings — map of personaId → vector
 * @returns {Promise<void>}
 */
export async function saveEmbeddings(embeddings) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(EMBEDDINGS_PATH, JSON.stringify(embeddings), 'utf-8');
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

/**
 * Returns personas belonging to the given segment.
 *
 * @param {string} segment — segment name to filter by
 * @param {object[]} personas — full persona array
 * @returns {object[]}
 */
export function getPersonasBySegment(segment, personas) {
  return personas.filter(
    (p) => p.segment?.toLowerCase() === segment.toLowerCase()
  );
}

/**
 * Returns personas whose IDs are in the given array.
 *
 * @param {string[]} ids — array of persona IDs
 * @param {object[]} personas — full persona array
 * @returns {object[]}
 */
export function getPersonasByIds(ids, personas) {
  const idSet = new Set(ids);
  return personas.filter((p) => idSet.has(p.id));
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

/**
 * Computes the cosine similarity between two equal-length vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Semantic retrieval
// ---------------------------------------------------------------------------

/**
 * Retrieves the most relevant (and optionally most resistant) personas for a
 * given campaign text using cosine-similarity over embedding vectors.
 *
 * Falls back to segment-based filtering when embeddings are unavailable.
 *
 * @param {string} campaignText — the campaign / message to match against
 * @param {object} [options]
 * @param {number} [options.topK=10] — number of most-aligned personas to return
 * @param {boolean} [options.includeResistant=false] — also return the bottomK least-aligned
 * @param {number} [options.bottomK=5] — number of resistant personas (only if includeResistant)
 * @param {string} [options.segmentFilter] — restrict search to a single segment
 * @param {Function} [options.embedFn] — async (text) => number[] embedding function
 * @returns {Promise<{ aligned: object[], resistant: object[] }>}
 */
export async function retrieveRelevantPersonas(campaignText, options = {}) {
  const {
    topK = 10,
    includeResistant = false,
    bottomK = 5,
    segmentFilter,
    embedFn,
  } = options;

  let personas = await loadPersonas();
  const embeddings = await loadEmbeddings();

  // Optional segment filter
  if (segmentFilter) {
    personas = getPersonasBySegment(segmentFilter, personas);
  }

  // ---- Attempt vector-based retrieval --------------------------------
  const hasEmbeddings =
    Object.keys(embeddings).length > 0 && typeof embedFn === 'function';

  if (hasEmbeddings) {
    try {
      const campaignVec = await embedFn(campaignText);

      // Score each persona that has an embedding
      const scored = personas
        .filter((p) => embeddings[p.id])
        .map((p) => ({
          persona: p,
          score: cosineSimilarity(campaignVec, embeddings[p.id]),
        }))
        .sort((a, b) => b.score - a.score);

      const aligned = scored.slice(0, topK).map((s) => s.persona);

      const resistant = includeResistant
        ? scored
            .slice(-bottomK)
            .reverse()
            .map((s) => s.persona)
        : [];

      return { aligned, resistant };
    } catch (err) {
      // Fall through to fallback
      console.warn(
        '[personaBank] Embedding-based retrieval failed, falling back to segment filter:',
        err.message
      );
    }
  }

  // ---- Fallback: return a diverse slice from available personas ------
  console.info(
    '[personaBank] Using fallback segment-based retrieval (no embeddings available)'
  );

  // Shuffle for variety, then slice
  const shuffled = [...personas].sort(() => Math.random() - 0.5);
  const aligned = shuffled.slice(0, topK);
  const resistant = includeResistant ? shuffled.slice(-bottomK).reverse() : [];

  return { aligned, resistant };
}
