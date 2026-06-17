/**
 * @module engine/personaGenerator
 * @description Generates customer personas via the Gemini LLM, validates them,
 * assigns unique IDs, and persists them alongside their embedding vectors.
 *
 * Personas are generated in batches of 5 per LLM call (3 batches → 15 per
 * segment) to stay well within token limits while maintaining diversity.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPersonaGenerationPrompt } from '../prompts/generatePersona.js';
import {
  validatePersona,
  loadPersonas,
  savePersonas,
  loadEmbeddings,
  saveEmbeddings,
} from './personaBank.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.0-flash';
const BATCH_SIZE = 5;
const MAX_RETRIES = 3;

/** All four customer segments supported by JourneyPulse. */
const SEGMENTS = [
  'Loyal High-Spenders',
  'Bargain Hunters',
  'Privacy-First Skeptics',
  'Engaged Newcomers',
];

/** Short codes used in persona IDs (e.g. persona_lhs_001). */
const SEGMENT_SHORT_CODES = {
  'Loyal High-Spenders': 'lhs',
  'Bargain Hunters': 'bh',
  'Privacy-First Skeptics': 'pfs',
  'Engaged Newcomers': 'en',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a configured Gemini generative model instance.
 *
 * @returns {import('@google/generative-ai').GenerativeModel}
 * @throws {Error} if GEMINI_API_KEY is not set
 */
function getModel() {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. ' +
      'Please set it before generating personas.'
    );
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 1.0, // higher creativity for diverse personas
    },
  });
}

/**
 * Pads a number to a zero-filled string of the given width.
 *
 * @param {number} num
 * @param {number} width
 * @returns {string}
 */
function zeroPad(num, width = 3) {
  return String(num).padStart(width, '0');
}

/**
 * Waits for the specified number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Batch generation
// ---------------------------------------------------------------------------

/**
 * Generates a single batch of personas for a segment, with retry logic.
 *
 * @param {import('@google/generative-ai').GenerativeModel} model
 * @param {string} segment
 * @param {number} count — personas to generate in this batch
 * @returns {Promise<object[]>} array of raw (un-ID'd) persona objects
 */
async function generateBatch(model, segment, count) {
  const prompt = getPersonaGenerationPrompt(segment, count);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Parse JSON — Gemini should return a pure JSON array in JSON mode
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Attempt to extract JSON array from potential markdown wrapping
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) {
          throw new Error('Response does not contain a valid JSON array');
        }
        parsed = JSON.parse(match[0]);
      }

      if (!Array.isArray(parsed)) {
        throw new Error(`Expected a JSON array, got ${typeof parsed}`);
      }

      console.info(
        `  [batch] Received ${parsed.length} persona(s) for "${segment}" (attempt ${attempt})`
      );

      return parsed;
    } catch (err) {
      console.warn(
        `  [batch] Attempt ${attempt}/${MAX_RETRIES} failed for "${segment}": ${err.message}`
      );

      if (attempt === MAX_RETRIES) {
        console.error(
          `  [batch] All ${MAX_RETRIES} attempts exhausted for "${segment}". Returning empty batch.`
        );
        return [];
      }

      // Exponential back-off: 1s, 2s, 4s
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }

  return []; // unreachable, but satisfies lint
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates `count` personas for a given segment by batching LLM calls.
 *
 * Each persona is validated and assigned a unique ID of the form
 * `persona_<segment_short>_<index>` (e.g. `persona_lhs_001`).
 *
 * @param {string} segment — one of the four segment names
 * @param {number} [count=15] — total personas to generate
 * @returns {Promise<object[]>} validated persona objects with IDs
 */
export async function generatePersonasForSegment(segment, count = 15) {
  const shortCode = SEGMENT_SHORT_CODES[segment];
  if (!shortCode) {
    throw new Error(
      `Unknown segment "${segment}". Valid: ${SEGMENTS.join(', ')}`
    );
  }

  console.info(`\n🔄 Generating ${count} personas for "${segment}"…`);

  const model = getModel();
  const allRaw = [];

  // Split into batches of BATCH_SIZE
  const batches = Math.ceil(count / BATCH_SIZE);

  for (let b = 0; b < batches; b++) {
    const batchCount = Math.min(BATCH_SIZE, count - allRaw.length);
    const raw = await generateBatch(model, segment, batchCount);
    allRaw.push(...raw);

    // Small delay between batches to avoid rate limits
    if (b < batches - 1) {
      await sleep(500);
    }
  }

  // Validate and assign IDs
  const validated = [];
  let index = 1;

  for (const raw of allRaw) {
    // Ensure segment is set correctly (LLM may deviate)
    raw.segment = segment;

    // Assign ID before validation so the ID field exists
    raw.id = `persona_${shortCode}_${zeroPad(index)}`;

    const { valid, errors } = validatePersona(raw);

    if (valid) {
      validated.push(raw);
      index++;
    } else {
      console.warn(
        `  ⚠️  Skipping invalid persona "${raw.name || '(unnamed)'}": ${errors.join('; ')}`
      );
    }
  }

  console.info(`✅ "${segment}": ${validated.length}/${allRaw.length} personas valid\n`);
  return validated;
}

/**
 * Generates personas for all four segments and saves them to the persona bank.
 *
 * @param {object} [options]
 * @param {number} [options.perSegment=15] — personas per segment
 * @returns {Promise<{ total: number, perSegment: Record<string, number> }>}
 */
export async function generateAllPersonas({ perSegment = 15 } = {}) {
  console.info('═══════════════════════════════════════════════');
  console.info('  JourneyPulse — Persona Generation');
  console.info('═══════════════════════════════════════════════\n');

  const allPersonas = [];
  const counts = {};

  for (const segment of SEGMENTS) {
    const personas = await generatePersonasForSegment(segment, perSegment);
    allPersonas.push(...personas);
    counts[segment] = personas.length;
  }

  // Re-index IDs globally to avoid collisions across runs
  allPersonas.forEach((p, i) => {
    const shortCode = SEGMENT_SHORT_CODES[p.segment];
    const segIndex =
      allPersonas
        .slice(0, i + 1)
        .filter((x) => x.segment === p.segment).length;
    p.id = `persona_${shortCode}_${zeroPad(segIndex)}`;
  });

  await savePersonas(allPersonas);

  console.info('═══════════════════════════════════════════════');
  console.info(`  Total personas generated: ${allPersonas.length}`);
  for (const [seg, cnt] of Object.entries(counts)) {
    console.info(`    • ${seg}: ${cnt}`);
  }
  console.info('═══════════════════════════════════════════════\n');

  return { total: allPersonas.length, perSegment: counts };
}

/**
 * Generates all personas AND their embedding vectors, saving both to disk.
 *
 * This is the recommended entry-point for initial setup — it produces a
 * fully-populated persona bank ready for semantic retrieval.
 *
 * @param {object} [options]
 * @param {number} [options.perSegment=15] — personas per segment
 * @returns {Promise<{ total: number, perSegment: Record<string, number>, embeddingsCount: number }>}
 */
export async function generateAndEmbedAll({ perSegment = 15 } = {}) {
  // Step 1 — Generate personas
  const result = await generateAllPersonas({ perSegment });

  // Step 2 — Generate embeddings
  console.info('🔗 Generating embeddings for all personas…\n');

  let embedder;
  try {
    // Dynamic import so this module doesn't hard-fail if the embedder isn't
    // set up yet (e.g. during early development / testing).
    const embedModule = await import('../embeddings/embedder.js');
    embedder = embedModule;
  } catch (err) {
    console.warn(
      '⚠️  Could not load embedder module — skipping embedding generation.',
      err.message
    );
    return { ...result, embeddingsCount: 0 };
  }

  const personas = await loadPersonas();
  const existingEmbeddings = await loadEmbeddings();
  const embeddingsMap = { ...existingEmbeddings };
  let embeddedCount = 0;

  for (const persona of personas) {
    try {
      // Use the embedder's purpose-built persona profiler
      const vector = await embedder.embedPersonaProfile(persona);
      embeddingsMap[persona.id] = vector;
      embeddedCount++;
    } catch (err) {
      console.warn(`  ⚠️  Failed to embed persona "${persona.id}": ${err.message}`);
    }
  }

  await saveEmbeddings(embeddingsMap);

  console.info(`\n✅ Embeddings generated: ${embeddedCount}/${personas.length}`);
  return { ...result, embeddingsCount: embeddedCount };
}
