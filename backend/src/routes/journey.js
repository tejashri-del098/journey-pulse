/**
 * @module routes/journey
 * @description Connected journey simulation endpoint — runs a campaign through
 * a multi-day, multi-channel sequence with persona state carryover.
 */

import { Router } from 'express';
import { simulateJourney } from '../engine/journeyEngine.js';

const router = Router();

/**
 * POST /api/journey
 * 
 * Request body:
 *   - sequence (array required): Array of step objects { day: number, channel: string, text: string }
 *   - segment (string optional): Filter to a specific segment
 * 
 * Example sequence:
 * [
 *   { day: 1, channel: 'email', text: 'Welcome! Here is 10% off.' },
 *   { day: 3, channel: 'sms', text: 'Reminder: 10% off expires soon.' }
 * ]
 */
router.post('/', async (req, res) => {
  try {
    const { sequence, segment } = req.body;

    if (!Array.isArray(sequence) || sequence.length === 0) {
      return res.status(400).json({
        error: { message: 'Missing or invalid "sequence" — must be a non-empty array.' },
      });
    }

    const validChannels = ['email', 'sms', 'push'];
    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      if (!step.channel || !validChannels.includes(step.channel)) {
        return res.status(400).json({
          error: { message: `Step ${i+1}: Invalid channel. Must be one of ${validChannels.join(', ')}` }
        });
      }
      if (!step.text || typeof step.text !== 'string') {
        return res.status(400).json({
          error: { message: `Step ${i+1}: Missing text.` }
        });
      }
    }

    const result = await simulateJourney(sequence, { segment });
    return res.json(result);

  } catch (err) {
    console.error('[/api/journey] Error:', err.message);
    return res.status(500).json({
      error: { message: err.message }
    });
  }
});

export default router;
