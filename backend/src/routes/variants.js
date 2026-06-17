/**
 * @module routes/variants
 * @description Variant generation endpoint — creates alternative campaign messages
 * that resolve the Chief Concern flagged on the original, simulates each variant,
 * and returns a ranked comparison.
 *
 * POST /api/variants — generate, simulate, and rank campaign variants
 */

import { Router } from 'express';
import { generateAndCompareVariants } from '../engine/variantGenerator.js';
import { simulateCampaign } from '../engine/simulator.js';

const router = Router();

/**
 * POST / — Generate and compare campaign variants
 *
 * Request body:
 *   - campaignText (string, required): Original campaign text
 *   - channel (string, required): 'email' | 'sms' | 'push'
 *   - segment (string, optional): Filter to a specific customer segment
 *   - originalResult (object, optional): Pre-computed simulation result to skip re-simulating original
 *
 * Response:
 *   - original: simulation results for the original campaign
 *   - variants: array of 3 variant results (each with strategy, KPIs, trust score)
 *   - ranking: all options ranked by conversion + trust
 *   - bestChoice: the top-ranked option
 *   - improvement: delta metrics (trust, conversion, unsubscribe) vs. original
 *   - metadata: processing time, variant counts
 */
router.post('/', async (req, res) => {
  try {
    const { campaignText, channel, segment, originalResult } = req.body;

    // --- Validate required fields ---
    if (!campaignText || typeof campaignText !== 'string') {
      return res.status(400).json({
        error: { message: 'Missing or invalid "campaignText" — must be a non-empty string.' },
      });
    }

    const validChannels = ['email', 'sms', 'push'];
    if (!channel || !validChannels.includes(channel)) {
      return res.status(400).json({
        error: {
          message: `Invalid "channel" — must be one of: ${validChannels.join(', ')}`,
        },
      });
    }

    console.log(`[/api/variants] Generating variants for ${channel} campaign (${campaignText.length} chars)`);

    // --- Run the full variant pipeline ---
    const result = await generateAndCompareVariants(campaignText, channel, {
      originalResult: originalResult || undefined,
      segment: segment || undefined,
    });

    return res.json(result);
  } catch (err) {
    console.error('[/api/variants] Error:', err.message);
    return res.status(500).json({
      error: { message: err.message },
    });
  }
});

/**
 * POST /quick — Generate variant texts only (no simulation)
 *
 * Faster endpoint for previewing variant copy without running full simulations.
 * Useful for iterating on copy before committing to a full comparison.
 *
 * Request body:
 *   - campaignText (string, required): Original campaign text
 *   - channel (string, required): 'email' | 'sms' | 'push'
 *   - chiefConcern (string, optional): Known trust concern to fix
 *   - trustScore (number, optional): Original trust score
 *   - trustBand (string, optional): Original trust band
 *
 * Response:
 *   - variants: array of 3 variant texts with strategies
 */
router.post('/quick', async (req, res) => {
  try {
    const { campaignText, channel, chiefConcern, trustScore, trustBand } = req.body;

    if (!campaignText || typeof campaignText !== 'string') {
      return res.status(400).json({
        error: { message: 'Missing or invalid "campaignText".' },
      });
    }

    const validChannels = ['email', 'sms', 'push'];
    if (!channel || !validChannels.includes(channel)) {
      return res.status(400).json({
        error: { message: `Invalid "channel" — must be one of: ${validChannels.join(', ')}` },
      });
    }

    // If no simulation result provided, run one quickly to get trust data
    let concern = chiefConcern || null;
    let score = trustScore || 50;
    let band = trustBand || 'Caution';
    let kpis = {
      predictedOpenRate: 0,
      predictedClickRate: 0,
      predictedConversionRate: 0,
      predictedUnsubscribeRate: 0,
    };

    if (!chiefConcern) {
      try {
        console.log('[/api/variants/quick] Running quick simulation for trust data...');
        const simResult = await simulateCampaign(campaignText, channel);
        concern = simResult.chiefConcern;
        score = simResult.trustScore;
        band = simResult.trustBand;
        kpis = simResult.kpis;
      } catch {
        console.warn('[/api/variants/quick] Could not run simulation, proceeding with defaults.');
      }
    }

    // Import and call the generation function directly
    const { getVariantGenerationPrompt } = await import('../prompts/generateVariants.js');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: { message: 'GEMINI_API_KEY is not configured.' },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.9,
      },
    });

    const prompt = getVariantGenerationPrompt(campaignText, channel, concern, score, band, kpis);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let variants;
    try {
      variants = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        variants = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse variant generation response.');
      }
    }

    return res.json({
      variants: variants.slice(0, 3),
      originalTrust: { trustScore: score, trustBand: band, chiefConcern: concern },
    });
  } catch (err) {
    console.error('[/api/variants/quick] Error:', err.message);
    return res.status(500).json({
      error: { message: err.message },
    });
  }
});

export default router;
