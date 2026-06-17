/**
 * @module routes/calibrate
 * @description Calibration endpoint — compares predicted KPIs against actual
 * campaign results to measure and track prediction accuracy.
 */

import { Router } from 'express';
import { runCalibration, loadCalibrationHistory } from '../engine/calibrationEngine.js';
import { simulateCampaign } from '../engine/simulator.js';

const router = Router();

/**
 * POST /api/calibrate
 * 
 * Body:
 * - campaignName (string)
 * - campaignText (string) - used to run prediction if predictedKPIs not provided
 * - channel (string)
 * - predictedKPIs (object, optional) - use existing predictions
 * - actualKPIs (object, required) - { actualOpenRate, actualClickRate, ... }
 */
router.post('/', async (req, res) => {
  try {
    const { campaignName, campaignText, channel, predictedKPIs, actualKPIs } = req.body;

    if (!campaignName || !actualKPIs) {
      return res.status(400).json({ error: { message: 'campaignName and actualKPIs are required.' } });
    }

    let preds = predictedKPIs;
    if (!preds) {
      if (!campaignText || !channel) {
        return res.status(400).json({ error: { message: 'If predictedKPIs is omitted, campaignText and channel are required to run a prediction.' } });
      }
      const simResult = await simulateCampaign(campaignText, channel);
      preds = simResult.kpis;
    }

    const result = await runCalibration(campaignName, preds, actualKPIs);
    return res.json(result);

  } catch (err) {
    console.error('[/api/calibrate] Error:', err.message);
    return res.status(500).json({ error: { message: err.message } });
  }
});

/**
 * GET /api/calibrate/history
 * Returns the history of all calibration runs.
 */
router.get('/history', async (req, res) => {
  try {
    const history = await loadCalibrationHistory();
    return res.json({ history });
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
