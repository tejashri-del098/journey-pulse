#!/usr/bin/env node

/**
 * Script: Test Campaigns
 * 
 * Runs the 3 built-in test campaigns (manipulative, neutral, trustworthy)
 * through the simulation engine and validates trust scores.
 * 
 * Usage: npm run test-campaigns
 * Requires: GEMINI_API_KEY in .env and personas generated
 */

import 'dotenv/config';
import { simulateCampaign } from '../engine/simulator.js';

const TEST_CAMPAIGNS = [
  {
    name: '🚨 Manipulative',
    text: 'FINAL WARNING: Your exclusive VIP deal expires in 2 HOURS. Everyone else is already saving. Don\'t be the only one left behind. We know you\'ve been looking at this...',
    channel: 'email',
    expectedBand: 'Risky',
  },
  {
    name: '⚠️ Neutral',
    text: 'Hi! We\'ve got new arrivals this season. Browse our collection and use code WELCOME15 for 15% off your first order.',
    channel: 'email',
    expectedBand: 'Caution',
  },
  {
    name: '✅ Trustworthy',
    text: 'We noticed you\'ve been a loyal customer for 2 years. As a thank-you, here\'s early access to our spring collection — no pressure, just wanted you to see it first.',
    channel: 'email',
    expectedBand: 'Trustworthy',
  },
];

console.log('🧪 JourneyPulse — Campaign Trust Test');
console.log('=======================================\n');

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found. Set it in .env');
  process.exit(1);
}

let passed = 0;
let failed = 0;

for (const campaign of TEST_CAMPAIGNS) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Testing: ${campaign.name}`);
  console.log(`Channel: ${campaign.channel}`);
  console.log(`Text: "${campaign.text.substring(0, 80)}..."`);
  console.log(`Expected band: ${campaign.expectedBand}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    const result = await simulateCampaign(campaign.text, campaign.channel, {
      skipCache: true,
    });

    console.log(`\n  📊 Results:`);
    console.log(`     Trust Score:  ${result.trustScore} (${result.trustBand})`);
    console.log(`     Chief Concern: ${result.chiefConcern || 'None'}`);
    console.log(`     Open Rate:    ${result.kpis.predictedOpenRate}%`);
    console.log(`     Click Rate:   ${result.kpis.predictedClickRate}%`);
    console.log(`     Convert Rate: ${result.kpis.predictedConversionRate}%`);
    console.log(`     Unsub Rate:   ${result.kpis.predictedUnsubscribeRate}%`);
    console.log(`     Personas:     ${result.metadata.totalPersonas}`);
    console.log(`     Time:         ${result.metadata.processingTimeMs}ms`);

    if (result.trustBand === campaign.expectedBand) {
      console.log(`\n  ✅ PASS — Trust band matches expected`);
      passed++;
    } else {
      console.log(`\n  ❌ FAIL — Expected "${campaign.expectedBand}" but got "${result.trustBand}"`);
      failed++;
    }
  } catch (err) {
    console.error(`\n  ❌ ERROR: ${err.message}`);
    failed++;
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${TEST_CAMPAIGNS.length}`);
console.log(`${'═'.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
