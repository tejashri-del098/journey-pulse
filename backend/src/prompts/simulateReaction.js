/**
 * @module prompts/simulateReaction
 * @description Builds the LLM prompt for simulating persona reactions to a campaign message.
 * The prompt instructs Gemini to role-play as each persona and produce structured
 * engagement predictions including manipulation detection.
 */

/**
 * Builds a simulation prompt that instructs the LLM to role-play as each persona
 * and react to a campaign message delivered via a specific channel.
 *
 * @param {Array<Object>} personas - Array of persona profile objects
 * @param {string} personas[].id - Unique persona identifier
 * @param {string} personas[].segment - Customer segment name
 * @param {string} personas[].name - Persona's name
 * @param {number} personas[].age - Persona's age
 * @param {string} personas[].gender - Persona's gender
 * @param {string} personas[].channelPreference - Preferred communication channel (email/sms/push)
 * @param {number} personas[].discountSensitivity - Sensitivity to discounts (1-10)
 * @param {number} personas[].fatigueLevel - Marketing fatigue level (1-10)
 * @param {number} personas[].privacyComfort - Comfort with personalization (1-10, 10 = very comfortable)
 * @param {number} personas[].lastInteractionDays - Days since last brand interaction
 * @param {string} personas[].mood - Current emotional state
 * @param {string} personas[].backstory - Detailed persona backstory
 * @param {string} campaignText - The campaign message text to react to
 * @param {string} channel - Delivery channel: 'email', 'sms', or 'push'
 * @returns {string} The formatted prompt string for the LLM
 */
export function getSimulationPrompt(personas, campaignText, channel) {
  const personaProfiles = personas.map((p, idx) => {
    return [
      `--- Persona ${idx + 1} ---`,
      `ID: ${p.id}`,
      `Name: ${p.name} | Age: ${p.age} | Gender: ${p.gender}`,
      `Segment: ${p.segment}`,
      `Preferred Channel: ${p.channelPreference}`,
      `Discount Sensitivity: ${p.discountSensitivity}/10`,
      `Fatigue Level: ${p.fatigueLevel}/10`,
      `Privacy Comfort: ${p.privacyComfort}/10`,
      `Days Since Last Interaction: ${p.lastInteractionDays}`,
      `Current Mood: ${p.mood}`,
      `Backstory: ${p.backstory}`,
    ].join('\n');
  }).join('\n\n');

  return `You are a behavioral simulation engine. Your task is to role-play as EACH of the following customer personas and react authentically to a marketing campaign message.

=== CAMPAIGN MESSAGE ===
Channel: ${channel.toUpperCase()}
Message: "${campaignText}"

=== PERSONA PROFILES ===
${personaProfiles}

=== SIMULATION INSTRUCTIONS ===
For EACH persona above, immerse yourself in their identity. Consider their backstory, current mood, fatigue level, privacy comfort, and channel preferences. Then react to the campaign message AS THAT PERSON.

CRITICAL BEHAVIORAL RULES:
1. **Channel Mismatch**: If a persona prefers "${channel}" they are neutral about the channel. If they prefer a DIFFERENT channel, they should feel mildly to strongly annoyed depending on the mismatch. SMS when they prefer email feels intrusive. Push notifications when they prefer email feels spammy.
2. **Fatigue Effects**: Personas with fatigueLevel >= 7 are exhausted by marketing. They are significantly more likely to ignore, delete, or unsubscribe. Fatigue 9-10 means they are on the verge of unsubscribing from EVERYTHING.
3. **Privacy Sensitivity**: Personas with privacyComfort <= 3 are deeply uncomfortable with personalized messaging. If the campaign text contains phrases that imply surveillance or tracking (e.g., "we noticed you...", "based on your browsing...", "we know you..."), they MUST flag it as manipulative.
4. **Discount Sensitivity**: Personas with high discountSensitivity (7+) will respond more favorably to discount offers. Those with low sensitivity (1-3) may find heavy discounting cheap or desperate.
5. **Segment Behavior**:
   - "Loyal High-Spenders": Expect premium treatment, exclusivity. Generic mass messages disappoint them.
   - "Bargain Hunters": Light up at discounts but are fickle. Without a deal, engagement is low.
   - "Privacy-First Skeptics": Hyper-vigilant about tracking language. Will flag even mild personalization if it implies data collection.
   - "Engaged Newcomers": Open-minded but easy to overwhelm. Too aggressive = instant unsubscribe.
6. **Mood Influence**: A persona in a "frustrated" or "annoyed" mood will react more negatively. An "excited" or "curious" persona will be more receptive.

=== OUTPUT FORMAT ===
Return a JSON array with EXACTLY ${personas.length} objects, one per persona, in the SAME ORDER as the personas listed above. Each object must have these exact fields:

[
  {
    "personaId": "<the persona's ID>",
    "reaction": "<1-3 sentences of the persona's internal monologue in FIRST PERSON. Be vivid and authentic. e.g., 'Ugh, another spam text. I never signed up for SMS alerts. This is going straight to trash.'>",
    "engagement": "<one of: 'high', 'medium', 'low', 'none'>",
    "willOpen": <boolean — would they open/read this message?>,
    "willClick": <boolean — would they click any link in the message?>,
    "willConvert": <boolean — would they complete a purchase as a result?>,
    "willUnsubscribe": <boolean — would this message push them to unsubscribe?>,
    "manipulationFlag": <boolean — does this campaign feel manipulative, deceptive, or unethical to THIS persona?>,
    "manipulationReason": "<string explaining WHAT specific phrase or tactic feels manipulative, or null if not flagged>"
  }
]

IMPORTANT:
- Every persona MUST have an entry. Do not skip any.
- The "reaction" must be in FIRST PERSON from the persona's perspective.
- Be realistic — not every persona will react the same way.
- manipulationReason must be null (not empty string) if manipulationFlag is false.
- Output ONLY the JSON array. No markdown, no commentary, no wrapping.`;
}
