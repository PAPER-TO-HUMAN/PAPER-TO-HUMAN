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
- Consent is read via `useSyncExternalStore` over a tiny module-level
  pub-sub, not a mount-time `useEffect` + `setState` — this project's ESLint
  config (`react-hooks/set-state-in-effect`, part of the React Compiler
  rule set) forbids synchronous `setState` inside an effect body and
  explicitly recommends `useSyncExternalStore` for external mutable sources
  like `localStorage`. The native `storage` event only fires in *other*
  tabs, so `handleConsent` calls a manual `notifyConsentChange()` after
  writing, to update the current tab too.

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

**Update (post-review):** a concurrent commit (`4c97150`) landed on `main`
during this feature's design and added real `mode: "all" | "single"` and
`selectedLevel: Level` ("primaria"|"secundaria"|"avanzado") state, plus a
`LEVEL_TO_COLUMN_KEY` mapping and nullable `Version`/`Metric` fields (single
mode only generates one version). The derivation below uses that real state
instead of inferring it, which is more accurate for the study data.

- `mode`: a snapshot of `mode` taken when `result` was set (`resultMode`),
  not the live toggle state — the mode/level toggle isn't disabled once a
  translation finishes, so a user could flip it after seeing results but
  before submitting the micro-test, which would otherwise attribute the
  response to a level/mode they never actually read.
- **Selected version key**:
  - `mode === "single"` → `LEVEL_TO_COLUMN_KEY[selectedLevel]` (the only
    version that was generated).
  - `mode === "all"` → the version the user last opened in the expanded
    reading modal (`expandedKey` at submit time, if it is `"v1"`/`"v2"`/
    `"v3"`), defaulting to `"v2"` if they never opened one.
- `level_chosen`:
  - `mode === "single"` → `selectedLevel` directly.
  - `mode === "all"` → derived from the selected version key via the
    existing `LEVEL_TO_COLUMN_KEY` mapping, inverted (v1→primaria,
    v2→secundaria, v3→avanzado), reusing that constant rather than adding a
    duplicate.
- `paper_title`: first 60 chars of the extracted paper text actually sent to
  `/api/translate` (not `result.source`, which is a filename/URL/title
  label). This requires capturing that text into state (`paperText`) inside
  `handleTranslate`, since it's currently a function-local variable.
- `fh_score`: `metrics[selectedVersionKey]?.fh` (both the version and its
  metric are now nullable per the current `TranslateResult` type — the
  schema types `fh_score` as `number`, so a missing/`null` FH is coerced to
  `0` at log time rather than changing the schema).

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
