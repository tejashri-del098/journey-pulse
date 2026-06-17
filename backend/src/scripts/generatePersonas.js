#!/usr/bin/env node

/**
 * Script: Generate Personas
 * 
 * Batch-generates 60-80 customer personas across all 4 segments,
 * generates embeddings for each, and saves everything to the data directory.
 * 
 * Usage: npm run generate-personas
 * Requires: GEMINI_API_KEY in .env file
 */

import 'dotenv/config';
import { generateAndEmbedAll } from '../engine/personaGenerator.js';

console.log('🧑‍🤝‍🧑 JourneyPulse — Persona Generation');
console.log('========================================\n');

const startTime = Date.now();

try {
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment.');
    console.error('   Copy .env.example to .env and add your API key:');
    console.error('   cp .env.example .env');
    process.exit(1);
  }

  console.log('📡 Using Gemini model:', process.env.GEMINI_MODEL || 'gemini-2.0-flash');
  console.log('📡 Embedding model:', process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004');
  console.log('');

  const result = await generateAndEmbedAll({ perSegment: 2 });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n✅ Persona generation complete!');
  console.log(`   Total personas: ${result.totalPersonas}`);
  console.log(`   Embeddings generated: ${result.embeddingsGenerated}`);
  console.log(`   Time elapsed: ${elapsed}s`);
  console.log(`\n   Personas saved to: src/data/personas.json`);
  console.log(`   Embeddings saved to: src/data/embeddings.json`);
} catch (err) {
  console.error('\n❌ Generation failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
