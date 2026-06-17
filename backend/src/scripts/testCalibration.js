#!/usr/bin/env node

/**
 * Script: Test Calibration
 * 
 * Runs a calibration test comparing predicted vs actual KPIs.
 */

import 'dotenv/config';
import { runCalibration } from '../engine/calibrationEngine.js';

async function run() {
  console.log('🧪 JourneyPulse — Testing Calibration');
  console.log('=====================================\n');

  try {
    const predicted1 = {
      predictedOpenRate: 25.5,
      predictedClickRate: 10.2,
      predictedConversionRate: 3.1,
      predictedUnsubscribeRate: 1.5,
    };
    
    // Slight deviation
    const actual1 = {
      actualOpenRate: 22.0,
      actualClickRate: 11.5,
      actualConversionRate: 2.8,
      actualUnsubscribeRate: 1.8,
    };

    console.log('Run 1: Testing "Spring Sale 2025"');
    const res1 = await runCalibration('Spring Sale 2025', predicted1, actual1);
    console.log(`  MAE: ${res1.run.mae}`);
    console.log(`  Accuracy Score: ${res1.run.accuracyScore}%`);
    console.log(`  Trend: ${res1.trend}`);
    if (res1.run.divergenceFlag) console.log(`  ⚠️ ${res1.run.divergenceFlag}`);

    console.log('\nRun 2: Testing "Summer Promo" (Improving Accuracy)');
    const actual2 = {
      actualOpenRate: 25.0, // closer to predicted 25.5
      actualClickRate: 10.0, // closer to predicted 10.2
      actualConversionRate: 3.0,
      actualUnsubscribeRate: 1.4,
    };
    const res2 = await runCalibration('Summer Promo', predicted1, actual2);
    console.log(`  MAE: ${res2.run.mae}`);
    console.log(`  Accuracy Score: ${res2.run.accuracyScore}%`);
    console.log(`  Trend: ${res2.trend}`);
    
    console.log('\n✅ Calibration test complete!');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  }
}

run();
