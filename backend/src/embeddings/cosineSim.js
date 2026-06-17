/**
 * @module cosineSim
 * @description Cosine similarity utilities for vector search over persona embeddings.
 * Uses pure JS math (no FAISS) — performant enough for hundreds of personas.
 */

/**
 * Computes the cosine similarity between two vectors.
 *
 * @param {number[]} vecA - First vector (float array).
 * @param {number[]} vecB - Second vector (float array).
 * @returns {number} Similarity score in the range [-1, 1].
 *   1 = identical direction, 0 = orthogonal, -1 = opposite.
 * @throws {Error} If inputs are invalid or dimensions mismatch.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
    throw new Error('Both vecA and vecB must be arrays.');
  }
  if (vecA.length === 0 || vecB.length === 0) {
    throw new Error('Vectors must not be empty.');
  }
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Dimension mismatch: vecA has ${vecA.length} dimensions, vecB has ${vecB.length}.`
    );
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Guard against zero-magnitude vectors (would cause division by zero)
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Finds the topK persona records whose embeddings are MOST similar
 * (highest cosine similarity) to the query embedding.
 *
 * @param {number[]} queryEmbedding - The query vector to compare against.
 * @param {Array<Object>} personaRecords - Array of persona objects, each with
 *   an `embeddingVector` field (number[]).
 * @param {number} [topK=10] - Number of top results to return.
 * @returns {Array<{persona: Object, similarity: number}>} Top-K results sorted
 *   descending by similarity score.
 * @throws {Error} If inputs are invalid.
 */
export function findMostAligned(queryEmbedding, personaRecords, topK = 10) {
  validateSearchInputs(queryEmbedding, personaRecords, topK);

  const scored = scoreAll(queryEmbedding, personaRecords);

  // Sort descending (most similar first)
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}

/**
 * Finds the topK persona records whose embeddings are LEAST similar
 * (lowest cosine similarity / most resistant) to the query embedding.
 *
 * Use this to identify personas most likely to reject or ignore a campaign.
 *
 * @param {number[]} queryEmbedding - The query vector to compare against.
 * @param {Array<Object>} personaRecords - Array of persona objects, each with
 *   an `embeddingVector` field (number[]).
 * @param {number} [topK=10] - Number of bottom results to return.
 * @returns {Array<{persona: Object, similarity: number}>} Bottom-K results sorted
 *   ascending by similarity score.
 * @throws {Error} If inputs are invalid.
 */
export function findMostResistant(queryEmbedding, personaRecords, topK = 10) {
  validateSearchInputs(queryEmbedding, personaRecords, topK);

  const scored = scoreAll(queryEmbedding, personaRecords);

  // Sort ascending (least similar first)
  scored.sort((a, b) => a.similarity - b.similarity);

  return scored.slice(0, topK);
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Scores every persona record against the query embedding.
 *
 * @param {number[]} queryEmbedding
 * @param {Array<Object>} personaRecords
 * @returns {Array<{persona: Object, similarity: number}>}
 * @private
 */
function scoreAll(queryEmbedding, personaRecords) {
  const results = [];

  for (const persona of personaRecords) {
    if (!Array.isArray(persona.embeddingVector) || persona.embeddingVector.length === 0) {
      // Skip personas without valid embeddings rather than crashing
      continue;
    }

    const similarity = cosineSimilarity(queryEmbedding, persona.embeddingVector);
    results.push({ persona, similarity });
  }

  return results;
}

/**
 * Validates common inputs for search functions.
 *
 * @param {number[]} queryEmbedding
 * @param {Array<Object>} personaRecords
 * @param {number} topK
 * @throws {Error} If any input is invalid.
 * @private
 */
function validateSearchInputs(queryEmbedding, personaRecords, topK) {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error('queryEmbedding must be a non-empty array of numbers.');
  }
  if (!Array.isArray(personaRecords)) {
    throw new Error('personaRecords must be an array.');
  }
  if (typeof topK !== 'number' || topK < 1 || !Number.isInteger(topK)) {
    throw new Error('topK must be a positive integer.');
  }
}
