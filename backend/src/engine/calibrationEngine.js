/**
 * @module engine/calibrationEngine
 * @description Compares predicted KPIs against actual campaign results to measure
 * prediction accuracy. Computes Mean Absolute Error (MAE) and stores history.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const CALIBRATION_FILE = join(DATA_DIR, 'calibrationHistory.json');

// Ensure data directory exists
async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * Loads calibration history from disk.
 * @returns {Promise<Array<Object>>}
 */
export async function loadCalibrationHistory() {
  try {
    const data = await readFile(CALIBRATION_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new Error('Failed to load calibration history: ' + err.message);
  }
}

/**
 * Saves calibration history to disk.
 * @param {Array<Object>} history 
 */
export async function saveCalibrationHistory(history) {
  await ensureDir();
  await writeFile(CALIBRATION_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * Computes Mean Absolute Error (MAE) between predicted and actual KPIs.
 * 
 * @param {Object} predicted - { predictedOpenRate, predictedClickRate, ... }
 * @param {Object} actual - { actualOpenRate, actualClickRate, ... }
 * @returns {number} The MAE score
 */
function computeMAE(predicted, actual) {
  const metrics = [
    { p: predicted.predictedOpenRate, a: actual.actualOpenRate },
    { p: predicted.predictedClickRate, a: actual.actualClickRate },
    { p: predicted.predictedConversionRate, a: actual.actualConversionRate },
    { p: predicted.predictedUnsubscribeRate, a: actual.actualUnsubscribeRate },
  ];

  let sumError = 0;
  let count = 0;

  for (const m of metrics) {
    if (typeof m.p === 'number' && typeof m.a === 'number') {
      sumError += Math.abs(m.p - m.a);
      count++;
    }
  }

  return count > 0 ? Math.round((sumError / count) * 10) / 10 : 0;
}

/**
 * Processes a new calibration run, comparing predicted vs actuals,
 * computing accuracy, and storing it in history.
 * 
 * @param {string} campaignName 
 * @param {Object} predictedKPIs 
 * @param {Object} actualKPIs 
 */
export async function runCalibration(campaignName, predictedKPIs, actualKPIs) {
  const mae = computeMAE(predictedKPIs, actualKPIs);
  
  // Accuracy percentage (heuristic: 0 MAE = 100%, 20+ MAE = 0%)
  const accuracyScore = Math.max(0, Math.min(100, Math.round(100 - (mae * 5))));
  
  let divergenceFlag = null;
  if (mae > 10) {
    divergenceFlag = 'High divergence detected. Consider re-generating personas with tighter segment parameters or adjusting the simulation temperature.';
  }

  const runRecord = {
    id: 'cal_' + Date.now(),
    timestamp: new Date().toISOString(),
    campaignName,
    predicted: predictedKPIs,
    actual: actualKPIs,
    mae,
    accuracyScore,
    divergenceFlag
  };

  const history = await loadCalibrationHistory();
  history.push(runRecord);
  
  // Keep only the last 20 runs
  if (history.length > 20) {
    history.shift();
  }

  await saveCalibrationHistory(history);

  // Compute trend (is accuracy improving over the last 3 runs?)
  let trend = 'stable';
  if (history.length >= 2) {
    const prev = history[history.length - 2].accuracyScore;
    if (accuracyScore > prev + 5) trend = 'improving';
    else if (accuracyScore < prev - 5) trend = 'degrading';
  }

  return {
    run: runRecord,
    trend,
    historySummary: history.map(h => ({
      id: h.id,
      campaignName: h.campaignName,
      accuracyScore: h.accuracyScore,
      timestamp: h.timestamp
    }))
  };
}
