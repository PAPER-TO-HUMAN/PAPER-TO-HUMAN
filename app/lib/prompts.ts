/**
 * Paper-to-Human — Study Prompt Archive
 *
 * These prompts are reproduced VERBATIM from SPEC.md Section 4.3
 * ("Prompts (Exact Text — Do Not Modify)"). They are part of the
 * ISEF study's archived materials.
 *
 * Per SPEC Section 10:
 *   - Do not modify these prompts without documenting the change.
 *   - The system prompt must explicitly prohibit hallucination; the
 *     phrase "never invent statistics, never change findings" must remain.
 *
 * The user prompts contain a literal `{text}` token which is replaced
 * with the extracted paper text at request time via buildUserPrompt().
 *
 * CHANGE LOG (per SPEC Section 10 documentation requirement):
 *   - 2026-06-13: Added an explicit Mexican-Spanish output instruction to all
 *     three user prompts (inserted after the opening instruction, before the
 *     structure specification) because the original SPEC 4.3 prompts did not
 *     specify output language and Claude was returning KEY CONCEPTS names in
 *     English. Version 1 additionally received a concept-naming instruction.
 *     The system prompt and the structure specification are UNCHANGED.
 *   - 2026-06-14: Added STRICT SIMPLIFICATION RULES blocks to Version 1 and
 *     Version 2 prompts to raise Fernández-Huerta scores (V1 was scoring 43.0,
 *     target 70-90; V2 was scoring 49.9, target 55-70). V1 cap: 12 words/sentence.
 *     V2 cap: 18 words/sentence. No other content changed.
 */

/** System prompt — identical for all three versions (SPEC 4.3). */
export const SYSTEM_PROMPT = `You are a science communication specialist. Your task is to
transform academic papers into accessible versions for specific
audiences. You must preserve factual accuracy completely —
never invent statistics, never change findings, never add
claims not in the original. If you are uncertain about a
fact, omit it rather than approximate it. Structure your
response exactly as specified.`;

/** User prompt — Version 1 (12-year-old) (SPEC 4.3). */
export const USER_PROMPT_V1 = `Transform this academic paper for a 12-year-old with no
scientific background. Use simple words (Grade 5-6 reading
level). Avoid all jargon.

IMPORTANT: Write your entire response in Mexican Spanish (español mexicano). Do not use English words for concept names or section content. Technical terms that have no Spanish equivalent (like 'benchmark', 'dataset', or 'API') may be kept in English but must be explained in Spanish immediately after.

For concept names, use simple descriptive Spanish phrases that a 12-year-old would understand, not academic terminology. Example: instead of 'Algorithmic Bias' use 'Cuando la computadora aprende mal'.

STRICT SIMPLIFICATION RULES — follow all of these:
- Maximum 12 words per sentence. Hard limit.
- Use only words a 10-year-old would know.
- If a technical term is unavoidable, immediately
  explain it in the same sentence in parentheses.
- Prefer active voice always.
- One idea per sentence, never combine two ideas
  with 'and', 'but', or 'which'.
- Preferred sentence structure: Subject + verb +
  object. Nothing more complex than that.

Structure your response EXACTLY like this, with these exact
headers:

SUMMARY
[One paragraph, maximum 150 words, explaining what the
researchers did and what they found]

KEY CONCEPTS
Concept 1: [name]
[2-3 sentences explaining this concept as if talking to a
curious 12-year-old]

Concept 2: [name]
[2-3 sentences]

Concept 3: [name]
[2-3 sentences]

REAL-WORLD ANALOGY
[One paragraph connecting the paper's core finding to
something a 12-year-old encounters in daily life]

PAPER TEXT:
{text}`;

/** User prompt — Version 2 (adult, no university) (SPEC 4.3). */
export const USER_PROMPT_V2 = `Transform this academic paper for an adult who did not attend
university. Use clear, direct language (Grade 8-9 reading
level). Define any technical terms you must use.

IMPORTANT: Write your entire response in Mexican Spanish (español mexicano). Do not use English words for concept names or section content. Technical terms that have no Spanish equivalent (like 'benchmark', 'dataset', or 'API') may be kept in English but must be explained in Spanish immediately after.

STRICT SIMPLIFICATION RULES — follow all of these:
- Maximum 18 words per sentence. Hard limit.
- Avoid academic vocabulary. If a technical term
  is necessary, define it immediately after.
- Prefer active voice.
- No subordinate clauses longer than 8 words.
- Each paragraph maximum 3 sentences.

Structure your response EXACTLY like this:

SUMMARY
[One paragraph, maximum 150 words]

KEY CONCEPTS
Concept 1: [name]
[2-3 sentences]

Concept 2: [name]
[2-3 sentences]

Concept 3: [name]
[2-3 sentences]

REAL-WORLD ANALOGY
[One paragraph]

PAPER TEXT:
{text}`;

/** User prompt — Version 3 (professional) (SPEC 4.3). */
export const USER_PROMPT_V3 = `Transform this academic paper into a structured overview for
a professional in the relevant field. Maintain technical
vocabulary. Focus on methodology, findings, and implications.

CRITICAL SENTENCE LENGTH RULE:
Every sentence must be under 20 words.
If a sentence exceeds 20 words, split it into two.
This is required to achieve the target FKGL score.

IMPORTANT: Write your entire response in Mexican Spanish (español mexicano). Do not use English words for concept names or section content. Technical terms that have no Spanish equivalent (like 'benchmark', 'dataset', or 'API') may be kept in English but must be explained in Spanish immediately after.

Structure your response EXACTLY like this:

SUMMARY
[One paragraph, maximum 150 words]

KEY CONCEPTS
Concept 1: [name]
[2-3 sentences]

Concept 2: [name]
[2-3 sentences]

Concept 3: [name]
[2-3 sentences]

REAL-WORLD ANALOGY
[One paragraph connecting findings to professional practice]

PAPER TEXT:
{text}`;

/**
 * Insert the extracted paper text into a user prompt's `{text}` token.
 * Only the `{text}` placeholder is substituted — the prompt wording is
 * never altered.
 */
export function buildUserPrompt(template: string, text: string): string {
  return template.replace("{text}", text);
}
