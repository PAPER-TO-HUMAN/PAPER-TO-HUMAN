import Anthropic from "@anthropic-ai/sdk";
import { sentenceCount, syllableCount, wordCount } from "@/app/lib/syllables";
import {
  SYSTEM_PROMPT,
  USER_PROMPT_V1,
  USER_PROMPT_V2,
  USER_PROMPT_V3,
  buildUserPrompt,
} from "@/app/lib/prompts";
import { checkEnv, checkOrigin, checkRateLimit } from "@/app/lib/http";

export const runtime = "nodejs";

// Three parallel Claude calls at up to 4,000 output tokens each routinely take
// 30–50s. Without this, Vercel's default function timeout (10s) kills the
// request before Claude answers and the user sees a generic failure. 60 is the
// hard ceiling on the Hobby plan without Fluid Compute.
export const maxDuration = 60;

// Model is fixed by the study (SPEC Section 3). Archived as study material.
const MODEL = "claude-sonnet-4-6";
const MAX_CHARS = 12_000; // SPEC 4.1 — truncate extracted text before processing
const MIN_CHARS = 200; // SPEC 7 — "Not enough text to process"
const MAX_TOTAL_TOKENS = 15_000; // safety cap on total input tokens across all 3 prompts

// Output cap per version. The three sections total ~450 words of Spanish, but
// Spanish tokenizes less densely than English and a truncated response is
// silently unparseable, so this is deliberately generous.
const MAX_OUTPUT_TOKENS = 4_000;

// Per-call ceiling, comfortably inside maxDuration so a stuck upstream call
// surfaces as our own timeout message rather than the platform killing the
// whole function with no response body.
const CLAUDE_TIMEOUT_MS = 45_000;

// Each request costs three Claude calls, so the window is deliberately tight.
const RATE_LIMIT = { name: "translate", limit: 10, windowMs: 60_000 };

const missingEnv = checkEnv("ANTHROPIC_API_KEY");

/** Rough token estimate (~4 chars/token) — used only for the safety cap. */
function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

interface Version {
  summary: string;
  concepts: string;
  analogy: string;
}

interface Metric {
  /** Fernández-Huerta score, or null when the text was too degenerate to score. */
  fh: number | null;
}

/** Round a readability score to one decimal, guarding against NaN/Infinity. */
function score(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

/**
 * Fernández-Huerta readability index — the validated Spanish adaptation of
 * Flesch Reading Ease. Higher score = MORE readable (0–100 scale). FKGL/SMOG
 * were calibrated for English and overestimate Spanish complexity, so the
 * study uses Fernández-Huerta instead.
 *
 * Official formula (Fernández Huerta, 1959):
 *
 *   FH = 206.84 − 0.60 × P − 1.02 × F
 *
 * where P = syllables per 100 words and F = average words per sentence.
 * Since P = 100 × (syllables / word), the 0.60 coefficient becomes 60 when
 * expressed per-word, which is the form computed below.
 *
 * Syllables come from app/lib/syllables.ts, which implements Spanish
 * syllabification rules. `text-readability`'s counter is English-calibrated
 * and scored 32/47 on a Spanish test set vs 47/47 for the Spanish rules —
 * and the syllable term carries a coefficient of 60, so its error propagates
 * directly into the study's headline metric.
 */
function fernandezHuerta(text: string): number {
  const syllablesPerWord = syllableCount(text) / wordCount(text);
  const wordsPerSentence = wordCount(text) / sentenceCount(text);
  return 206.84 - 60.0 * syllablesPerWord - 1.02 * wordsPerSentence;
}

/**
 * Score a text, or return `null` when it is too degenerate to score.
 *
 * The null case matters: on empty or word-less input, text-readability
 * returns 0 syllables/word and 0 words/sentence, so the formula yields 206.84
 * — which, clamped, would report a perfect 100 "Muy fácil" for text that does
 * not exist. Refusing to score is the only honest answer there.
 */
function metricsFor(text: string): Metric {
  if (wordCount(text) === 0 || sentenceCount(text) === 0) return { fh: null };

  const raw = score(fernandezHuerta(text));
  if (raw === null) return { fh: null };

  // Clamp to the documented 0–100 scale.
  return { fh: Math.max(0, Math.min(100, raw)) };
}

// Section headers, matched at line start. Both the English headers the prompts
// specify AND the Spanish forms Claude emits when told to respond in Spanish
// (RESUMEN / CONCEPTOS CLAVE / ANALOGÍA), optionally wrapped in markdown (#, *).
// CONCEPTS is matched before SUMMARY-style prefixes can swallow it, and the
// accent-optional forms cover models that drop diacritics.
const RE_SUMMARY = /(?:^|\n)[#*\s]*(?:SUMMARY|RESUMEN)\b/i;
const RE_CONCEPTS = /(?:^|\n)[#*\s]*(?:KEY CONCEPTS|CONCEPTOS CLAVE)\b/i;
const RE_ANALOGY =
  /(?:^|\n)[#*\s]*(?:REAL[-\s]?WORLD ANALOGY|ANALOG[IÍ]A(?:\s+DEL\s+MUNDO\s+REAL)?|ANALOGY)\b/i;

interface ParseResult {
  version: Version;
  /** Non-fatal problems worth logging — empty when the response parsed cleanly. */
  warnings: string[];
}

/**
 * Split a structured version response into its three sections, tolerating both
 * the English headers the prompts mandate and the Spanish headers the model
 * produces for Spanish output.
 *
 * Every failure mode is reported through `warnings` rather than silently
 * yielding blank fields — a missing header or an empty section means the study
 * is about to score text that is not what it claims to be.
 */
function parseVersion(raw: string): ParseResult {
  const warnings: string[] = [];
  const text = raw.trim();

  if (!text) {
    return {
      version: { summary: "", concepts: "", analogy: "" },
      warnings: ["empty response from model"],
    };
  }

  const mSummary = RE_SUMMARY.exec(text);
  const mConcepts = RE_CONCEPTS.exec(text);
  const mAnalogy = RE_ANALOGY.exec(text);

  const missing = [
    !mSummary && "SUMMARY/RESUMEN",
    !mConcepts && "KEY CONCEPTS/CONCEPTOS CLAVE",
    !mAnalogy && "REAL-WORLD ANALOGY/ANALOGÍA",
  ].filter(Boolean);

  if (!mSummary || !mConcepts || !mAnalogy) {
    // Fall back to placing everything in `summary` so no content is lost, but
    // say so — the three-section structure the study depends on is absent.
    return {
      version: { summary: text, concepts: "", analogy: "" },
      warnings: [`missing section header(s): ${missing.join(", ")}`],
    };
  }

  // The slicing below assumes the documented order. Out-of-order headers would
  // otherwise produce silently empty sections from reversed slice bounds.
  if (!(mSummary.index < mConcepts.index && mConcepts.index < mAnalogy.index)) {
    return {
      version: { summary: text, concepts: "", analogy: "" },
      warnings: ["section headers out of order"],
    };
  }

  const version: Version = {
    summary: text.slice(mSummary.index + mSummary[0].length, mConcepts.index).trim(),
    concepts: text.slice(mConcepts.index + mConcepts[0].length, mAnalogy.index).trim(),
    analogy: text.slice(mAnalogy.index + mAnalogy[0].length).trim(),
  };

  for (const [name, value] of Object.entries(version)) {
    if (!value) warnings.push(`empty section: ${name}`);
  }

  return { version, warnings };
}

/** Concatenate parsed sections back into plain text for scoring. */
function versionText(v: Version): string {
  return [v.summary, v.concepts, v.analogy].filter(Boolean).join("\n\n");
}

/** Map an Anthropic SDK error onto a user-facing message and HTTP status. */
function describeClaudeError(err: unknown): { error: string; status: number } {
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      error: "Generation is taking longer than expected. Please try again.",
      status: 504,
    };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      error: "Could not reach the translation service. Please try again.",
      status: 502,
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
      status: 429,
    };
  }
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  ) {
    // Misconfiguration on our side — never leak which credential is wrong.
    return { error: "Translation service is not configured.", status: 500 };
  }
  // Covers 5xx and 529 "overloaded" — transient upstream trouble, worth a retry.
  if (err instanceof Anthropic.InternalServerError) {
    return {
      error: "Translation failed. Please try again in a moment.",
      status: 503,
    };
  }
  return {
    error: "Translation failed. Please try again in a moment.",
    status: 500,
  };
}

export async function POST(req: Request) {
  // Guard 1 — only our own front-end may call this route.
  const originError = checkOrigin(req);
  if (originError) return originError;

  // Guard 2 — bound abuse; each request costs three Claude calls.
  const rateError = checkRateLimit(req, RATE_LIMIT);
  if (rateError) return rateError;

  // Guard 3 — refuse early and clearly if the deploy is misconfigured.
  if (missingEnv.length > 0) {
    return Response.json(
      { error: "Translation service is not configured." },
      { status: 500 },
    );
  }

  let body: { text?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const source = typeof body.source === "string" ? body.source : "unknown";
  let text = (typeof body.text === "string" ? body.text : "").trim();

  if (text.length < MIN_CHARS) {
    return Response.json(
      { error: "Not enough text to process. Please upload the full paper." },
      { status: 400 },
    );
  }

  // SPEC 4.1 — truncate to first 12,000 characters for processing.
  let truncated = false;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
    truncated = true;
  }

  // Guard 4 — total-token safety cap across all three prompts. The 12,000-char
  // truncation above normally keeps this well under MAX_TOTAL_TOKENS; this is a
  // defensive net (e.g. if MAX_CHARS is ever raised).
  const totalTokens = [USER_PROMPT_V1, USER_PROMPT_V2, USER_PROMPT_V3].reduce(
    (sum, template) =>
      sum +
      estimateTokens(SYSTEM_PROMPT) +
      estimateTokens(buildUserPrompt(template, text)),
    0,
  );
  if (totalTokens > MAX_TOTAL_TOKENS) {
    return Response.json(
      {
        error:
          "Texto demasiado largo para procesar con los créditos disponibles.",
      },
      { status: 400 },
    );
  }

  const client = new Anthropic({ timeout: CLAUDE_TIMEOUT_MS });

  async function generate(
    label: string,
    template: string,
  ): Promise<{ text: string; warnings: string[] }> {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(template, text) }],
    });

    const warnings: string[] = [];

    // A response cut off at the token cap loses its trailing sections, which
    // the parser cannot distinguish from a model that simply omitted them.
    // Surface it instead of scoring a half-written version as if it were whole.
    if (message.stop_reason === "max_tokens") {
      warnings.push(`${label}: response truncated at max_tokens`);
    }
    if (message.stop_reason === "refusal") {
      warnings.push(`${label}: model declined to respond`);
    }

    const out = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return { text: out, warnings };
  }

  /**
   * Is this error worth a second attempt?
   *
   * A 400 or an auth failure will fail identically every time; retrying only
   * burns latency. Timeouts, rate limits, connection drops and upstream 5xx
   * are transient. (The SDK already retries some of these internally, but not
   * timeouts of the whole call, which is the case that actually bites here.)
   */
  function isRetryable(err: unknown): boolean {
    return (
      err instanceof Anthropic.APIConnectionError ||
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.InternalServerError
    );
  }

  const VERSIONS: Array<[string, string]> = [
    ["v1", USER_PROMPT_V1],
    ["v2", USER_PROMPT_V2],
    ["v3", USER_PROMPT_V3],
  ];

  // SPEC 4.2 — generate all three versions simultaneously.
  //
  // allSettled rather than all: Promise.all rejects on the first failure and
  // discards the other two responses even though they succeeded and were paid
  // for. Here only the failed version is retried — the two that succeeded are
  // kept, so a transient blip costs one extra call instead of three.
  const settled = await Promise.allSettled(
    VERSIONS.map(([label, template]) => generate(label, template)),
  );

  const results = await Promise.all(
    settled.map(async (result, i) => {
      if (result.status === "fulfilled") return result;

      const [label, template] = VERSIONS[i];
      if (!isRetryable(result.reason)) return result;

      console.warn(`Claude API error (${label}), retrying once:`, result.reason);
      try {
        return {
          status: "fulfilled" as const,
          value: await generate(label, template),
        };
      } catch (err) {
        return { status: "rejected" as const, reason: err as unknown };
      }
    }),
  );

  const failures = results.flatMap((result, i) =>
    result.status === "rejected"
      ? [{ label: VERSIONS[i][0], reason: result.reason as unknown }]
      : [],
  );

  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`Claude API error (${f.label}):`, f.reason);
    }
    // Report the first failure's specific cause; a timeout and a rate limit
    // need different things from the user.
    const { error, status } = describeClaudeError(failures[0].reason);
    return Response.json(
      { error, failedVersions: failures.map((f) => f.label) },
      { status },
    );
  }

  const generated = results.map(
    (r) => (r as PromiseFulfilledResult<{ text: string; warnings: string[] }>).value,
  );

  const parsed = generated.map((r) => parseVersion(r.text));
  const warnings = [
    ...generated.flatMap((r) => r.warnings),
    ...parsed.flatMap((p, i) => p.warnings.map((w) => `${VERSIONS[i][0]}: ${w}`)),
  ];

  if (warnings.length > 0) {
    // Not fatal — the user still gets output — but these are exactly the cases
    // where a version silently is not what the study assumes it is.
    console.warn("Translate response warnings:", warnings);
  }

  const [v1, v2, v3] = parsed.map((p) => p.version);

  // SPEC 4.4 / Section 10 — Fernández-Huerta for the original and each version.
  const metrics = {
    original: metricsFor(text),
    v1: metricsFor(versionText(v1)),
    v2: metricsFor(versionText(v2)),
    v3: metricsFor(versionText(v3)),
  };

  return Response.json({ v1, v2, v3, metrics, source, truncated, warnings });
}
