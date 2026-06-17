/**
 * @module prompts/generatePersona
 * @description Prompt template for generating diverse customer personas via Gemini.
 *
 * Each segment has tailored guidance so the LLM produces realistic attribute
 * ranges (e.g. Loyal High-Spenders get high privacyComfort, Bargain Hunters
 * get high discountSensitivity, etc.).
 */

/**
 * Segment-specific generation guidance injected into the prompt so the LLM
 * produces attribute values that are realistic for the target audience.
 * @type {Record<string, string>}
 */
const SEGMENT_GUIDANCE = {
  'Loyal High-Spenders': `
- These customers are frequent, high-value buyers with strong brand loyalty.
- privacyComfort should be higher (6-10) — they trust the brand with their data.
- discountSensitivity should be low (1-4) — they buy for quality, not deals.
- fatigueLevel can vary widely (1-10) — some enjoy constant contact, others prefer exclusivity.
- lastInteractionDays tends to be low (0-14) — they shop often.
- Backstories should reflect premium expectations, loyalty program engagement, and VIP treatment.`,

  'Bargain Hunters': `
- These customers are highly price-driven and engage primarily through promotions.
- discountSensitivity should be high (7-10) — they will not purchase without a deal.
- privacyComfort should be lower (3-7) — they will share some data for coupons but have limits.
- channelPreference should lean toward 'email' or 'sms' — these are their deal-hunting channels.
- lastInteractionDays can vary (0-60) — they may go dormant between sales.
- Backstories should mention coupon-clipping, comparison shopping, and deal fatigue.`,

  'Privacy-First Skeptics': `
- These customers distrust personalization and flag surveillance-style marketing.
- privacyComfort should be very low (1-4) — they are uncomfortable with data collection.
- fatigueLevel should be high (5-10) — over-targeting annoys them intensely.
- channelPreference should be 'email' — they avoid push/sms as too intrusive.
- discountSensitivity can vary (3-8) — some care about price, but privacy always comes first.
- Backstories should reflect data-privacy awareness, ad-blocker usage, and distrust of algorithms.`,

  'Engaged Newcomers': `
- These customers recently signed up and are still forming opinions about the brand.
- All attributes should be moderate — they haven't settled into patterns yet.
- mood should lean toward 'curious' — they are exploring and open to engagement.
- lastInteractionDays should be recent (0-14) — they just started interacting.
- privacyComfort is moderate (4-7) — they haven't had a reason to distrust yet.
- discountSensitivity is moderate (4-7) — they are open to value but not solely driven by it.
- Backstories should mention first purchases, onboarding experiences, and exploratory browsing.`,
};

/**
 * Returns a prompt string that instructs the LLM to generate `count` unique,
 * realistic customer personas for the given segment.
 *
 * @param {string} segment — one of the four customer segment names
 * @param {number} [count=5] — number of personas to generate in this batch
 * @returns {string} the fully-assembled prompt ready for the Gemini API
 */
export function getPersonaGenerationPrompt(segment, count = 5) {
  const guidance = SEGMENT_GUIDANCE[segment];

  if (!guidance) {
    throw new Error(
      `Unknown segment "${segment}". Valid segments: ${Object.keys(SEGMENT_GUIDANCE).join(', ')}`
    );
  }

  return `You are a customer-data expert. Generate exactly ${count} unique, realistic customer personas for the "${segment}" segment.

REQUIREMENTS:
1. Every persona MUST contain ALL of the following fields — no extras, no omissions:
   - "name": a realistic full name (diverse ethnicities and backgrounds)
   - "age": a number appropriate for the segment (18-75 range)
   - "gender": a string ("Male", "Female", or "Non-binary")
   - "segment": "${segment}"
   - "channelPreference": exactly one of "email", "sms", "push", "any"
   - "discountSensitivity": integer 1-10 (10 = extremely price-sensitive)
   - "fatigueLevel": integer 1-10 (10 = very fatigued/annoyed by marketing)
   - "privacyComfort": integer 1-10 (10 = completely comfortable with data use)
   - "lastInteractionDays": integer, days since last brand interaction (0-90)
   - "mood": exactly one of "happy", "neutral", "frustrated", "curious", "skeptical", "busy"
   - "backstory": 2-3 sentences describing their shopping habits, pain points, and what would make them engage or disengage with a brand

2. DIVERSITY is critical — vary ages, genders, moods, channel preferences, and backstory contexts across the ${count} personas. No two personas should feel like copies.

SEGMENT-SPECIFIC GUIDANCE for "${segment}":
${guidance}

OUTPUT FORMAT:
Return ONLY a valid JSON array of ${count} persona objects. Do NOT include markdown formatting, code fences, or any text outside the JSON array. The response must start with [ and end with ].`;
}
