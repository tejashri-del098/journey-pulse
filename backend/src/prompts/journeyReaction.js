/**
 * @module prompts/journeyReaction
 * @description Builds the LLM prompt for simulating persona reactions during a
 * multi-step campaign journey. Takes the persona's historical reactions from
 * previous steps into account (e.g. rising fatigue or ignored messages).
 */

/**
 * Builds a prompt for a journey step simulation.
 *
 * @param {Array<Object>} personaStates - Array of persona objects enriched with their journey history
 * @param {string} campaignText - The campaign message text for THIS step
 * @param {string} channel - Delivery channel for THIS step ('email', 'sms', 'push')
 * @param {number} stepNumber - The 1-indexed step number in the journey (e.g., 2 for Day 3 SMS)
 * @returns {string} The formatted prompt string
 */
export function getJourneySimulationPrompt(personaStates, campaignText, channel, stepNumber) {
  const personaProfiles = personaStates.map((p, idx) => {
    // Format the history of interactions if available
    let historyText = 'None (First step)';
    if (p.history && p.history.length > 0) {
      historyText = p.history.map((h, i) => 
        `Step ${i + 1} (${h.channel}): "${h.campaignText.substring(0, 50)}..." -> Reacted with ${h.engagement} engagement. Open: ${h.willOpen}, Click: ${h.willClick}. Thoughts: "${h.reaction}"`
      ).join('\n      ');
    }

    return [
      `--- Persona ${idx + 1} ---`,
      `ID: ${p.id}`,
      `Segment: ${p.segment}`,
      `Preferred Channel: ${p.channelPreference}`,
      `Base Fatigue Level: ${p.fatigueLevel}/10`,
      `Current Journey History:\n      ${historyText}`,
      `Backstory: ${p.backstory}`,
    ].join('\n');
  }).join('\n\n');

  return `You are a behavioral simulation engine. You are simulating STEP ${stepNumber} of a multi-day marketing journey.
You must role-play as EACH of the following customer personas and react to the NEW campaign message below.

=== NEW CAMPAIGN MESSAGE (STEP ${stepNumber}) ===
Channel: ${channel.toUpperCase()}
Message: "${campaignText}"

=== PERSONA PROFILES & HISTORY ===
${personaProfiles}

=== SIMULATION INSTRUCTIONS ===
React to this new message as each persona. CRITICALLY, you must factor in their "Current Journey History".

JOURNEY BEHAVIORAL RULES:
1. **Compounding Fatigue**: If they ignored the previous step, receiving another message so soon (especially on an intrusive channel like SMS or Push) will increase their annoyance. If they ignored an email, an SMS a few days later might prompt an unsubscribe.
2. **Continued Engagement**: If they engaged (clicked/opened) in previous steps, they might be waiting for this follow-up (e.g., a reminder about a discount they already clicked).
3. **Channel Context**: If step 1 was an email they ignored, step 2 as an SMS might feel like being pestered. If step 2 is another email, they might just ignore it again. 
4. **Trust Erosion**: If they flagged a previous step as manipulative, they are highly suspicious of this new step.
5. **Segment Behavior**: "Loyal High-Spenders" expect cohesive journeys; disjointed spam annoys them. "Bargain Hunters" will tolerate spam if the discount gets better.

=== OUTPUT FORMAT ===
Return a JSON array with EXACTLY ${personaStates.length} objects, one per persona, in the SAME ORDER.
Output ONLY the JSON array. No markdown or explanation.

[
  {
    "personaId": "<the persona's ID>",
    "reaction": "<1-3 sentences in FIRST PERSON. Mention how their previous interaction (if any) influences their feeling now.>",
    "engagement": "<one of: 'high', 'medium', 'low', 'none'>",
    "willOpen": <boolean>,
    "willClick": <boolean>,
    "willConvert": <boolean>,
    "willUnsubscribe": <boolean>,
    "manipulationFlag": <boolean>,
    "manipulationReason": "<string explaining why it feels manipulative, or null>"
  }
]`;
}
