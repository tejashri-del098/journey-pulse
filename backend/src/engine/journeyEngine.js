/**
 * @module engine/journeyEngine
 * @description Simulates a multi-step campaign journey. Runs campaigns through a sequence
 * of channels, carrying persona state forward (e.g., fatigue, past engagement).
 * Computes journey-level insights like drop-off points and re-engagement recommendations.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import { getJourneySimulationPrompt } from '../prompts/journeyReaction.js';
import { scoreCampaign } from './trustScorer.js';
import { retrieveRelevantPersonas, getPersonasBySegment, loadPersonas } from './personaBank.js';

// ---------------------------------------------------------------------------
// Configuration & Init
// ---------------------------------------------------------------------------

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 12;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

let model = null;
function getModel() {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
    });
  }
  return model;
}

const journeyCache = new LRUCache({ max: 50, ttl: 1000 * 60 * 30 });

function journeyCacheKey(sequence, segment) {
  const raw = JSON.stringify(sequence) + '|' + (segment || 'all');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function processJourneyBatch(personaBatch, campaignText, channel, stepNumber, retryCount = 0) {
  try {
    const prompt = getJourneySimulationPrompt(personaBatch, campaignText, channel, stepNumber);
    const result = await getModel().generateContent(prompt);
    const text = result.response.text();

    let reactions;
    try {
      reactions = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) reactions = JSON.parse(match[0]);
      else throw new Error('Failed to parse JSON array');
    }

    if (!Array.isArray(reactions)) throw new Error('Response not an array');

    return reactions.map((r, idx) => ({
      ...r,
      segment: personaBatch[idx]?.segment || 'unknown',
    }));
  } catch (err) {
    if (retryCount < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
      return processJourneyBatch(personaBatch, campaignText, channel, stepNumber, retryCount + 1);
    }
    console.warn(`[journeyEngine] Batch failed at step ${stepNumber}, using fallbacks.`);
    return personaBatch.map(p => ({
      personaId: p.id,
      segment: p.segment,
      reaction: 'Simulation failed for this step.',
      engagement: 'none',
      willOpen: false, willClick: false, willConvert: false, willUnsubscribe: false,
      manipulationFlag: false, manipulationReason: null, error: true
    }));
  }
}

function computeStepKPIs(reactions) {
  const total = reactions.length || 1;
  const pct = (count) => Math.round((count / total) * 1000) / 10;
  return {
    predictedOpenRate: pct(reactions.filter(r => r.willOpen).length),
    predictedClickRate: pct(reactions.filter(r => r.willClick).length),
    predictedConversionRate: pct(reactions.filter(r => r.willConvert).length),
    predictedUnsubscribeRate: pct(reactions.filter(r => r.willUnsubscribe).length),
  };
}

// ---------------------------------------------------------------------------
// Journey Analysis
// ---------------------------------------------------------------------------

/**
 * Computes journey-level insights from the final persona states.
 * 
 * @param {Array<Object>} personaStates - Personas with complete history arrays
 * @param {number} totalSteps - Number of steps in the sequence
 */
function analyzeJourney(personaStates, totalSteps) {
  // 1. Drop-off analysis
  const engagementByStep = Array(totalSteps).fill(0);
  let totalUnsubs = 0;

  personaStates.forEach(p => {
    let hasUnsubscribed = false;
    p.history.forEach((h, i) => {
      if (hasUnsubscribed) return;
      if (h.willOpen || h.willClick) engagementByStep[i]++;
      if (h.willUnsubscribe) {
        hasUnsubscribed = true;
        totalUnsubs++;
      }
    });
  });

  const total = personaStates.length;
  const dropOffRates = engagementByStep.map((eng, i) => {
    if (i === 0) return 0;
    const prev = engagementByStep[i-1];
    if (prev === 0) return 0;
    return Math.round(((prev - eng) / prev) * 100);
  });

  // 2. Journey Fatigue Score (0-100, higher = worse)
  // Base fatigue + compounding penalties for ignoring multiple steps + unsubscribing
  let totalFatiguePoints = 0;
  
  personaStates.forEach(p => {
    let ignoreCount = 0;
    p.history.forEach(h => {
      if (!h.willOpen && !h.willClick) ignoreCount++;
      if (h.willUnsubscribe) ignoreCount += 3; // heavy penalty for unsub
    });
    totalFatiguePoints += ignoreCount;
  });

  const maxPossiblePoints = total * (totalSteps + 2); // heuristic max
  const journeyFatigueScore = Math.min(100, Math.round((totalFatiguePoints / maxPossiblePoints) * 100));

  // 3. Re-engagement Recommendation
  let recommendation = '';
  let rationale = '';
  const finalStepUnsubs = personaStates.filter(p => p.history[totalSteps-1]?.willUnsubscribe).length;
  
  if (journeyFatigueScore > 70 || finalStepUnsubs > total * 0.1) {
    recommendation = 'Pause communication for 14+ days.';
    rationale = `Fatigue is critical. ${Math.round((totalUnsubs/total)*100)}% of the audience unsubscribed over this journey. Give them a cool-down period.`;
  } else if (engagementByStep[totalSteps-1] < engagementByStep[0] * 0.3) {
    recommendation = 'Shift to SMS/Push with a strong discount in 48 hours.';
    rationale = 'Engagement dropped heavily by the final step. The audience is blind to standard channels; a channel pivot with high value is needed to wake them up.';
  } else {
    recommendation = 'Maintain cadence, but vary content.';
    rationale = 'Audience is sustaining engagement across touches. Journey fatigue is low.';
  }

  return {
    journeyFatigueScore,
    cumulativeUnsubscribeRate: Math.round((totalUnsubs / total) * 1000) / 10,
    engagementByStep: engagementByStep.map(count => Math.round((count / total) * 1000) / 10),
    dropOffRates,
    recommendation,
    rationale
  };
}

// ---------------------------------------------------------------------------
// Main Engine
// ---------------------------------------------------------------------------

/**
 * Simulates a multi-step connected campaign journey.
 * 
 * @param {Array<{day: number, channel: string, text: string}>} sequence 
 * @param {Object} options 
 */
export async function simulateJourney(sequence, options = {}) {
  const startTime = performance.now();

  if (!Array.isArray(sequence) || sequence.length === 0) {
    throw new Error('Journey sequence must be a non-empty array of steps.');
  }

  // Cache check
  const key = journeyCacheKey(sequence, options.segment);
  if (!options.skipCache) {
    const cached = journeyCache.get(key);
    if (cached) return { ...cached, metadata: { ...cached.metadata, fromCache: true } };
  }

  // Load personas (use the first step's text for semantic retrieval if needed,
  // but usually for journeys we want a broad segment baseline)
  let personas = [];
  try {
    const bank = await loadPersonas();
    personas = options.segment ? getPersonasBySegment(options.segment, bank) : bank;
  } catch (err) {
    throw new Error('Failed to load personas for journey: ' + err.message);
  }

  // Limit to 50 for journey (multi-step is expensive)
  if (personas.length > 50) {
    // Basic shuffle and take top 50
    personas = personas.sort(() => 0.5 - Math.random()).slice(0, 50);
  }

  // Initialize state map
  const personaStates = new Map();
  personas.forEach(p => {
    personaStates.set(p.id, { ...p, history: [] });
  });

  const stepResults = [];

  console.log(`[journeyEngine] Simulating ${sequence.length}-step journey for ${personas.length} personas`);

  // Run steps sequentially
  for (let i = 0; i < sequence.length; i++) {
    const step = sequence[i];
    const stepNumber = i + 1;
    console.log(`[journeyEngine] --- Step ${stepNumber}: ${step.channel.toUpperCase()} ---`);

    // Prepare active personas (filter out those who already unsubscribed)
    const activeStates = Array.from(personaStates.values()).filter(p => {
      if (p.history.length === 0) return true;
      return !p.history[p.history.length - 1].willUnsubscribe;
    });

    if (activeStates.length === 0) {
      console.log(`[journeyEngine] All personas unsubscribed by step ${stepNumber}. Stopping.`);
      break;
    }

    const batches = chunkArray(activeStates, BATCH_SIZE);
    const batchPromises = batches.map(batch => 
      processJourneyBatch(batch, step.text, step.channel, stepNumber)
    );

    const stepReactions = (await Promise.all(batchPromises)).flat();

    // Update state and collect results
    stepReactions.forEach(reaction => {
      const state = personaStates.get(reaction.personaId);
      if (state) {
        state.history.push({
          step: stepNumber,
          channel: step.channel,
          campaignText: step.text,
          ...reaction
        });
      }
    });

    const kpis = computeStepKPIs(stepReactions);
    const trust = scoreCampaign(stepReactions);

    stepResults.push({
      stepNumber,
      day: step.day || stepNumber,
      channel: step.channel,
      kpis,
      trustScore: trust.trustScore,
      trustBand: trust.bandLabel,
      chiefConcern: trust.chiefConcern,
      activePersonas: activeStates.length
    });
  }

  // Final analysis
  const finalStatesArray = Array.from(personaStates.values());
  const insights = analyzeJourney(finalStatesArray, sequence.length);

  const processingTimeMs = Math.round(performance.now() - startTime);

  const result = {
    steps: stepResults,
    insights,
    personaJourneys: finalStatesArray.map(p => ({
      id: p.id,
      segment: p.segment,
      history: p.history
    })),
    metadata: {
      totalSteps: sequence.length,
      initialPersonas: personas.length,
      processingTimeMs,
      fromCache: false
    }
  };

  journeyCache.set(key, result);
  console.log(`[journeyEngine] Journey simulation complete in ${processingTimeMs}ms`);

  return result;
}
