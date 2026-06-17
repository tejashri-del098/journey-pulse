/**
 * @module prompts/generateVariants
 * @description LLM prompt template for generating alternative campaign messages
 * that explicitly resolve the Chief Concern flagged on the original campaign.
 * Each variant uses a distinct rewriting strategy.
 */

/**
 * Strategy labels applied to generated variants.
 * @type {string[]}
 */
export const VARIANT_STRATEGIES = [
  'Tone Softening',
  'Transparency Rewrite',
  'Value-First Reframe',
];

/**
 * Builds a prompt that generates 2-3 campaign variants, each designed to fix
 * the trust issue identified in the original campaign.
 *
 * @param {string} originalText - The original campaign text
 * @param {string} channel - Delivery channel ('email', 'sms', 'push')
 * @param {string|null} chiefConcern - The Chief Concern from trust scoring (may be null)
 * @param {number} trustScore - The trust score of the original (0-100)
 * @param {string} trustBand - The trust band label ('Risky', 'Caution', 'Trustworthy')
 * @param {Object} kpis - The predicted KPIs from the original simulation
 * @returns {string} The complete prompt string
 */
export function getVariantGenerationPrompt(
  originalText,
  channel,
  chiefConcern,
  trustScore,
  trustBand,
  kpis
) {
  const channelConstraints = {
    email: 'Email allows longer copy (up to 200 words). You can use subject line + body.',
    sms: 'SMS is limited to 160 characters. Be extremely concise. No subject lines.',
    push: 'Push notifications are limited to 100 characters. Ultra-short, punchy, no fluff.',
  };

  const constraint = channelConstraints[channel] || channelConstraints.email;

  return `You are an expert marketing copywriter and ethical messaging strategist.

## TASK
Generate exactly 3 alternative versions of the following marketing campaign message.
Each variant MUST fix the trust issue identified below while maintaining or improving engagement.

## ORIGINAL CAMPAIGN
Channel: ${channel}
Text: "${originalText}"

## TRUST ANALYSIS OF ORIGINAL
- Trust Score: ${trustScore}/100 (${trustBand})
- Chief Concern: ${chiefConcern || 'No specific concern identified — but improvements are still possible.'}
- Predicted Open Rate: ${kpis.predictedOpenRate}%
- Predicted Click Rate: ${kpis.predictedClickRate}%
- Predicted Conversion Rate: ${kpis.predictedConversionRate}%
- Predicted Unsubscribe Rate: ${kpis.predictedUnsubscribeRate}%

## REWRITING STRATEGIES
Each variant must use a DIFFERENT strategy. Label each variant with its strategy name:

1. **Tone Softening** — Keep the same offer/message but remove aggressive language, false urgency, or pressure tactics. Replace threatening phrases with inviting ones.

2. **Transparency Rewrite** — Rebuild the message around honesty and clarity. Explicitly state what the offer is, why the customer is receiving it, and what happens if they don't act. No hidden implications.

3. **Value-First Reframe** — Completely restructure the message to lead with customer value and benefit. Focus on what the customer gains, not what they'll lose. Use aspirational rather than fear-based framing.

## CHANNEL CONSTRAINT
${constraint}

## RULES
- Each variant MUST directly address and resolve the Chief Concern
- Do NOT use: fake urgency ("last chance", "act now", "don't miss out"), fake scarcity ("only X left"), guilt-tripping, surveillance language ("we noticed you browsing"), social pressure ("everyone is buying")
- Variants should feel like they come from the SAME brand, just with better ethics
- Maintain the core value proposition of the original
- Each variant should be a complete, ready-to-send message

## OUTPUT FORMAT
Return a valid JSON array with exactly 3 objects. No markdown, no explanation — ONLY the JSON array.

Each object must have:
- "strategy": the strategy name (one of "Tone Softening", "Transparency Rewrite", "Value-First Reframe")
- "campaignText": the full rewritten campaign message
- "changesSummary": one sentence explaining what you changed and why it resolves the Chief Concern
- "expectedImpact": one sentence predicting how this change will affect engagement and trust

Example output format:
[
  {
    "strategy": "Tone Softening",
    "campaignText": "...",
    "changesSummary": "Replaced 'FINAL WARNING' and countdown pressure with a friendly reminder...",
    "expectedImpact": "Should reduce unsubscribe rate while maintaining click-through by..."
  },
  ...
]`;
}
