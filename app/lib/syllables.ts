/**
 * Paper-to-Human — Spanish syllable counting.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Fernández-Huerta index is `206.84 − 60·(syllables/word) − 1.02·(words/sentence)`.
 * The syllable term is multiplied by 60, so a systematic error of 0.2
 * syllables per word shifts every reported score by ~12 points.
 *
 * `text-readability` implements an English syllabification heuristic. Applied
 * to Spanish it is wrong in both directions — it splits Spanish diphthongs
 * that are a single syllable (`ciudad` → 3, actually 2) and merges hiatuses
 * that are two (`aéreo` → 3, actually 4). Since every version the study scores
 * is Spanish, that error is on the study's headline metric.
 *
 * Spanish is far more regular than English here: syllable count equals the
 * number of vowel nuclei, and whether two adjacent vowels form one nucleus
 * (diphthong) or two (hiatus) follows from a short set of rules. This module
 * implements those rules directly.
 *
 * SCOPE: this counts *orthographic* syllables, the convention readability
 * formulas are built on. Dialectal synaeresis (`teatro` as 2 syllables in fast
 * speech) is out of scope, as it is for the original formula.
 */

/** Open ("strong") vowels — two of them adjacent always form a hiatus. */
const STRONG = new Set(["a", "e", "o", "á", "é", "ó"]);

/** Closed ("weak") vowels — combine with others to form diphthongs. */
const WEAK = new Set(["i", "u", "ü"]);

/** Accented closed vowels — the accent breaks the diphthong (`día` = dí-a). */
const WEAK_ACCENTED = new Set(["í", "ú"]);

const VOWELS = new Set([...STRONG, ...WEAK, ...WEAK_ACCENTED]);

/** Strip the accent so `á` and `a` compare equal for the same-vowel rule. */
const DEACCENT: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u",
};

function base(v: string): string {
  return DEACCENT[v] ?? v;
}

/**
 * Do two adjacent vowels split into separate syllables?
 *
 *   hiatus  (2 syllables): strong+strong, any accented weak, identical vowels
 *   diphthong (1 syllable): every other combination
 */
function isHiatus(a: string, b: string): boolean {
  if (WEAK_ACCENTED.has(a) || WEAK_ACCENTED.has(b)) return true;
  if (STRONG.has(a) && STRONG.has(b)) return true;
  if (base(a) === base(b)) return true; // leer → le-er, cooperar → co-o-pe-rar
  return false;
}

/**
 * Normalize a word before scanning for vowel nuclei.
 *
 * Three orthographic quirks have to be resolved first:
 *
 *  - `qu`/`gu` before `e`/`i`: the `u` is silent and is not a nucleus
 *    (`queso` = que-so, `guitarra` = gui-ta-rra). `ü` is exempt — the
 *    diaeresis exists precisely to mark it as pronounced (`pingüino`).
 *  - `y`: a vowel (equivalent to `i`) unless a vowel follows it, in which case
 *    it is a consonant (`rey` = 1, but `playa` = pla-ya = 2).
 *  - `h`: always silent, but it still separates vowels for orthographic
 *    syllabification (`ahora` = a-ho-ra, `prohibir` = pro-hi-bir). It is left
 *    in place as a consonant rather than deleted, which is what keeps those
 *    vowel pairs from being read as diphthongs.
 */
function normalize(word: string): string {
  let w = word.toLowerCase();

  // Silent u in que/qui/gue/gui. Marked with a placeholder consonant so it
  // still separates anything around it.
  w = w.replace(/([qg])u([eéií])/g, "$1·$2");

  // y → i when it is acting as a vowel.
  w = w.replace(/y/g, (_m, offset: number, full: string) => {
    const next = full[offset + 1];
    return next && VOWELS.has(next) ? "·" : "i";
  });

  return w;
}

/** Count syllables in a single Spanish word. */
export function syllablesInWord(word: string): number {
  const w = normalize(word);

  let count = 0;
  let group: string[] = [];

  const flush = () => {
    if (group.length === 0) return;
    // A run of adjacent vowels is one syllable, plus one for each hiatus
    // boundary inside it.
    count += 1;
    for (let i = 1; i < group.length; i++) {
      if (isHiatus(group[i - 1], group[i])) count += 1;
    }
    group = [];
  };

  for (const ch of w) {
    if (VOWELS.has(ch)) group.push(ch);
    else flush();
  }
  flush();

  // Tokens with no vowel nucleus (acronyms, numerals, stray symbols) still
  // occupy a word slot in the average, so scoring them as 0 would deflate
  // syllables-per-word. One is the conservative floor.
  return count === 0 ? 1 : count;
}

/** Split text into word tokens, keeping Spanish letters and internal hyphens. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-záéíóúüñ]+/i)
    .filter(Boolean);
}

/** Total syllables across all words in the text. */
export function syllableCount(text: string): number {
  return words(text).reduce((sum, w) => sum + syllablesInWord(w), 0);
}

/** Number of word tokens in the text. */
export function wordCount(text: string): number {
  return words(text).length;
}

/**
 * Number of sentences.
 *
 * Counts terminal punctuation runs (`.`, `!`, `?`, `…`), collapsing repeats so
 * `!?` and `...` count once. Spanish opening marks (`¿`, `¡`) are not terminal
 * and are ignored. Text with no terminal punctuation counts as one sentence,
 * so a headline or fragment does not divide by zero.
 */
export function sentenceCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[.!?…]+(?=\s|$)/g);
  return matches && matches.length > 0 ? matches.length : 1;
}
