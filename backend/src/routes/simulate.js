/**
 * @module routes/simulate
 * @description Express routes for the campaign simulation API.
 * POST / — run a simulation against the persona bank.
 * GET /test-campaigns — return pre-built test campaigns for quick testing.
 */

import { Router } from 'express';
import { simulateCampaign } from '../engine/simulator.js';

const router = Router();

/** Valid delivery channels */
const VALID_CHANNELS = new Set(['email', 'sms', 'push']);

/**
 * Pre-built test campaigns covering the manipulation spectrum.
 * @type {Array<{id: string, label: string, type: string, channel: string, campaignText: string}>}
 */
const TEST_CAMPAIGNS = [
  {
    id: 'test-manipulative',
    label: 'Manipulative Campaign',
    type: 'manipulative',
    channel: 'email',
    campaignText:
      'FINAL WARNING: Your exclusive VIP deal expires in 2 HOURS. Everyone else is already saving. Don\'t be the only one left behind. We know you\'ve been looking at this...',
  },
  {
    id: 'test-neutral',
    label: 'Neutral Campaign',
    type: 'neutral',
    channel: 'email',
    campaignText:
      'Hi! We\'ve got new arrivals this season. Browse our collection and use code WELCOME15 for 15% off your first order.',
  },
  {
    id: 'test-trustworthy',
    label: 'Trustworthy Campaign',
    type: 'trustworthy',
    channel: 'email',
    campaignText:
      'We noticed you\'ve been a loyal customer for 2 years. As a thank-you, here\'s early access to our spring collection — no pressure, just wanted you to see it first.',
  },
];

/**
 * POST /
 * Run a campaign simulation against the persona bank.
 *
 * @body {string} campaignText - The campaign message text (required)
 * @body {string} channel - Delivery channel: 'email', 'sms', or 'push' (required)
 * @body {string} [segment] - Optional segment filter
 * @body {string[]} [personaIds] - Optional specific persona IDs to simulate
 * @returns {Object} Full simulation result with persona reactions, KPIs, and trust score
 */
router.post('/', async (req, res) => {
  try {
    const { campaignText, channel, segment, personaIds } = req.body;

    // --- Validate required fields ---
    const errors = [];

    if (!campaignText || typeof campaignText !== 'string' || campaignText.trim().length === 0) {
      errors.push('campaignText is required and must be a non-empty string.');
    }

    if (!channel || typeof channel !== 'string') {
      errors.push('channel is required and must be a string.');
    } else if (!VALID_CHANNELS.has(channel.toLowerCase())) {
      errors.push(`channel must be one of: ${[...VALID_CHANNELS].join(', ')}. Received: "${channel}".`);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    // --- Run simulation ---
    const result = await simulateCampaign(campaignText.trim(), channel.toLowerCase(), {
      segment: segment || undefined,
      personaIds: personaIds || undefined,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[simulate] POST / error:', err);
    return res.status(500).json({
      error: 'Simulation failed',
      message: err.message || 'An unexpected error occurred.',
    });
  }
});

/**
 * GET /test-campaigns
 * Returns the 3 pre-built test campaigns for quick testing.
 */
router.get('/test-campaigns', (_req, res) => {
  return res.status(200).json({
    campaigns: TEST_CAMPAIGNS,
  });
});

export default router;
