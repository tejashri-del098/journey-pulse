#!/usr/bin/env node

/**
 * Script: Test Journey Simulator
 * 
 * Runs a 3-step connected journey simulation.
 */

import 'dotenv/config';
import { simulateJourney } from '../engine/journeyEngine.js';

const SEQUENCE = [
  { day: 1, channel: 'email', text: 'Welcome to our premium club! Take 10% off your first order.' },
  { day: 3, channel: 'sms', text: 'Reminder: your 10% off expires soon. Use it today!' },
  { day: 5, channel: 'push', text: 'Last chance! 10% off ends tonight.' }
];

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found. Set it in .env');
    process.exit(1);
  }

  console.log('🧪 JourneyPulse — Testing Connected Journey Simulation');
  console.log('====================================================\n');

  try {
    const result = await simulateJourney(SEQUENCE, { skipCache: true });
    
    console.log(`✅ Journey simulation complete in ${result.metadata.processingTimeMs}ms\n`);
    
    console.log('--- Step KPIs ---');
    result.steps.forEach(step => {
      console.log(`Step ${step.stepNumber} (Day ${step.day} - ${step.channel}):`);
      console.log(`  Open: ${step.kpis.predictedOpenRate}%, Click: ${step.kpis.predictedClickRate}%, Unsub: ${step.kpis.predictedUnsubscribeRate}%`);
      console.log(`  Trust Score: ${step.trustScore} (${step.trustBand})`);
    });

    console.log('\n--- Journey Insights ---');
    console.log(`Fatigue Score: ${result.insights.journeyFatigueScore}/100`);
    console.log(`Cumulative Unsubscribe Rate: ${result.insights.cumulativeUnsubscribeRate}%`);
    console.log(`Drop-off Rates: ${result.insights.dropOffRates.join('% -> ')}%`);
    console.log(`Recommendation: ${result.insights.recommendation}`);
    console.log(`Rationale: ${result.insights.rationale}`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  }
}

run();
