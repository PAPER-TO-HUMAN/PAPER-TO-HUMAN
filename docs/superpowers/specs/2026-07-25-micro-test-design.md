# Micro-test feature — design

## Purpose

After a successful translation, optionally collect a 3-question comprehension
micro-test from consenting users, for the ISEF study. No storage backend yet —
responses are logged via `console.log` only. Supabase storage is a separate,
later session.

## Consent banner

- Renders at the very top of `app/page.tsx`, above the input section.
- Shown only while consent is unresolved (`localStorage.getItem("consent")` is
  absent).
- Text: "Al usar Paper-to-Human, tus respuestas de comprensión pueden usarse de
  forma anónima para investigación educativa. [Acepto] [No participar]"
- "Acepto" → `localStorage.setItem("consent", "true")`, hide banner, micro-test
  becomes eligible to show after a translation.
- "No participar" → `localStorage.setItem("consent", "false")`, hide banner,
  micro-test never shows for this user.
- Consent state is read once on mount into React state (`consent: boolean |
  null`) so the rest of the UI doesn't re-read localStorage repeatedly.

## Micro-test card

- Shown only when: a translation result exists, `consent === true`, and the
  form hasn't already been submitted this session.
- Placed after the complexity comparison table.
- Title: "¿Qué tan bien entendiste el texto? (opcional, 1 min)"
- Collapsible (chevron toggle); open by default the first time it appears.
- Q1: text input, `maxLength={100}` — "En una oración, ¿cuál es la idea más
  importante del texto?"
- Q2: 1–5 radio group — "¿Qué tan bien sientes que entendiste el texto?"
  (1=Nada, 3=Más o menos, 5=Muy bien)
- Q3: 1–5 radio group — "¿Esta versión fue más fácil de entender que el texto
  original?" (1=Mucho más difícil, 3=Igual, 5=Mucho más fácil)
- Submit button "Enviar respuestas", disabled until all three are answered.

## Data derivation (resolves gaps between the request and current app state)

The current app has no per-level selection UI — it always generates and shows
all three versions (v1/v2/v3) simultaneously. To fit the requested schema:

- `mode`: hardcoded `"all"` (matches current, only, behavior).
- `level_chosen`: fixed mapping from version key → Spanish level label:
  - v1 ("12 años") → `"primaria"`
  - v2 ("Público general") → `"secundaria"`
  - v3 ("Profesional") → `"avanzado"`
- **Selected version** for `level_chosen`/`fh_score`: the version the user
  last opened in the expanded reading modal (`expandedKey` at submit time).
  If they never opened one, default to `"v2"` (the study's intervention
  version).
- `paper_title`: first 60 chars of the extracted paper text actually sent to
  `/api/translate` (not `result.source`, which is a filename/URL/title
  label). This requires capturing that text into state (`paperText`) inside
  `handleTranslate`, since it's currently a function-local variable.
- `fh_score`: `metrics[selectedVersion].fh` (may be `null` per the existing
  `Metric` type — the schema types it as `number`, so a `null` FH is coerced
  to `0` at log time rather than changing the schema; this only matters for
  the small fraction of runs where the API declined to score).

## Response object (on submit)

```ts
{
  paper_title: string,        // first 60 chars of extracted paper text
  level_chosen: string,       // "primaria" | "secundaria" | "avanzado"
  mode: string,               // always "all"
  fh_score: number,           // metrics[selectedVersion].fh, 0 if null
  comprehension_text: string, // Q1 answer
  confidence_score: number,   // Q2 answer (1-5)
  utility_score: number,      // Q3 answer (1-5)
  timestamp: string,          // ISO date, new Date().toISOString()
}
```

Logged as `console.log("MICRO_TEST_RESPONSE:", JSON.stringify(response))`.
On success: show "¡Gracias! Tus respuestas ayudan a mejorar Paper-to-Human."
and hide the form (mark submitted so it doesn't reappear).

## Explicitly out of scope

- No database, no Supabase, no network call for the micro-test (console.log
  only, per explicit instruction).
- No new npm dependencies — radios/text input/plain buttons, no rating widget
  library.
- No change to the existing translate/export/PDF flows.

## Verification

- `tsc --noEmit` must pass after changes.
- Manual check in browser: consent banner appears once, choice persists across
  reload, micro-test appears/doesn't appear correctly per consent, submit logs
  the expected object shape to the console.
