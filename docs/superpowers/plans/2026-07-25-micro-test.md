# Micro-test Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a consent banner and a post-translation micro-test (3 questions) to `app/page.tsx`, logging responses to `console.log` only.

**Architecture:** Everything lives in the existing single-file `app/page.tsx` client component, following its established pattern of small local helper components (`Section`, `ModalSection`) defined below `Home()`. Two new local components (`ConsentBanner`, `RatingQuestion`) are added the same way. No new files, no new routes, no persistence beyond `localStorage` for the consent flag.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4 (existing utility classes only, no new ones needed). No test runner exists in this project (`package.json` has no `jest`/`vitest`/`playwright`) — verification is `tsc --noEmit`, `npm run lint`, and manual browser checks via `npm run dev`, not automated unit tests.

## Global Constraints

- No database, no external service, no network call for the micro-test — log with `console.log("MICRO_TEST_RESPONSE:", JSON.stringify(response))` only.
- Do not add any new npm dependencies.
- Run `npx tsc --noEmit` after each task and confirm it passes before committing.
- Consent banner text, micro-test question text, and button labels must match the exact Spanish copy given in the spec (see design doc `docs/superpowers/specs/2026-07-25-micro-test-design.md`).
- `level_chosen` mapping: v1 → `"primaria"`, v2 → `"secundaria"`, v3 → `"avanzado"`.
- `mode` is always the literal `"all"`.
- Selected version = `expandedKey` at submit time if it is `"v1"`/`"v2"`/`"v3"`, else `"v2"`.
- `paper_title` = first 60 chars of the extracted paper text that is sent to `/api/translate` (the `text` local variable in `handleTranslate`, captured into state as `paperText`), not `result.source`.

---

### Task 1: Consent banner

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `consent: boolean | null` state (readable by Task 2 to gate the micro-test card).
- Produces: `handleConsent(value: boolean): void` — not consumed elsewhere, but keep the name for consistency if referenced in review.

- [ ] **Step 1: Add consent state and mount-time localStorage read**

In `app/page.tsx`, inside `export default function Home() {`, add to the existing state block (right after the `expandedKey` state declaration, around line 208):

```ts
  const [consent, setConsent] = useState<boolean | null>(null);
```

Add a new `useEffect` right after the existing "Close the expanded reading view on ESC" `useEffect` block (after its closing `}, [expandedKey]);` around line 221):

```ts
  // Read any prior consent decision once on mount.
  useEffect(() => {
    const stored = localStorage.getItem("consent");
    if (stored === "true") setConsent(true);
    else if (stored === "false") setConsent(false);
  }, []);
```

- [ ] **Step 2: Add the consent handler**

Add this function inside `Home()`, near `onFileChange` (around line 223, right before it):

```ts
  function handleConsent(value: boolean) {
    localStorage.setItem("consent", value ? "true" : "false");
    setConsent(value);
  }
```

- [ ] **Step 3: Render the banner above the input section**

In the JSX returned by `Home()`, the outer structure is:

```tsx
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ---- Header ---- */}
```

Insert the banner as the first child of the inner `max-w-6xl` div, before the `{/* ---- Header ---- */}` comment:

```tsx
        {/* ---- Consent banner ---- */}
        {consent === null && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <p className="mb-3">
              Al usar Paper-to-Human, tus respuestas de comprensión pueden
              usarse de forma anónima para investigación educativa.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConsent(true)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Acepto
              </button>
              <button
                onClick={() => handleConsent(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                No participar
              </button>
            </div>
          </div>
        )}

```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open the app in a browser with devtools open on Application → Local Storage:
1. Confirm the banner shows on first load (no `consent` key yet).
2. Click "Acepto" → banner disappears, `localStorage.consent === "true"`.
3. Reload the page → banner does not reappear.
4. In devtools, run `localStorage.removeItem("consent")`, reload → banner reappears.
5. Click "No participar" → banner disappears, `localStorage.consent === "false"`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "Add consent banner for micro-test data collection"
```

---

### Task 2: Micro-test card and submit logging

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `consent: boolean | null` from Task 1 (gates card visibility).
- Consumes: existing `result: TranslateResult | null`, `expandedKey: string | null` state.
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Add the response type and level-mapping constant**

Near the top of `app/page.tsx`, after the existing `TranslateResult` interface (after its closing `}` around line 30), add:

```ts
interface MicroTestResponse {
  paper_title: string;
  level_chosen: string;
  mode: string;
  fh_score: number;
  comprehension_text: string;
  confidence_score: number;
  utility_score: number;
  timestamp: string;
}

const LEVEL_BY_VERSION: Record<"v1" | "v2" | "v3", string> = {
  v1: "primaria",
  v2: "secundaria",
  v3: "avanzado",
};
```

- [ ] **Step 2: Add micro-test state**

In `Home()`, add to the state block, right after the `consent` line added in Task 1:

```ts
  const [paperText, setPaperText] = useState("");
  const [microTestOpen, setMicroTestOpen] = useState(true);
  const [microTestDone, setMicroTestDone] = useState(false);
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<number | null>(null);
```

- [ ] **Step 3: Capture the extracted text and reset micro-test state on each translate**

In `handleTranslate`, the function currently starts with (around line 236):

```ts
  async function handleTranslate() {
    setError(null);
    setResult(null);
    setCharCount(null);
```

Change it to also reset the micro-test form, so a second translation in the same session doesn't show a stale "submitted" state:

```ts
  async function handleTranslate() {
    setError(null);
    setResult(null);
    setCharCount(null);
    setPaperText("");
    setMicroTestDone(false);
    setMicroTestOpen(true);
    setQ1("");
    setQ2(null);
    setQ3(null);
```

Then, further down in the same function, right after (around line 276):

```ts
      setCharCount(text.length);
```

add:

```ts
      setPaperText(text);
```

- [ ] **Step 4: Add the selected-version helper and submit handler**

Add these functions inside `Home()`, near `handleDownload` (after its closing `}`, around line 330):

```ts
  function selectedVersionKey(): "v1" | "v2" | "v3" {
    if (expandedKey === "v1" || expandedKey === "v2" || expandedKey === "v3") {
      return expandedKey;
    }
    return "v2";
  }

  function handleMicroTestSubmit() {
    if (!result || !q1.trim() || q2 === null || q3 === null) return;

    const key = selectedVersionKey();
    const response: MicroTestResponse = {
      paper_title: paperText.slice(0, 60),
      level_chosen: LEVEL_BY_VERSION[key],
      mode: "all",
      fh_score: result.metrics[key].fh ?? 0,
      comprehension_text: q1.trim(),
      confidence_score: q2,
      utility_score: q3,
      timestamp: new Date().toISOString(),
    };

    console.log("MICRO_TEST_RESPONSE:", JSON.stringify(response));
    setMicroTestDone(true);
  }
```

- [ ] **Step 5: Render the micro-test card**

The complexity table section currently ends with (around line 578-580):

```tsx
          </section>
        )}

        {/* ---- Footer (SPEC 5.3) ---- */}
```

Insert the card between the complexity table's closing `)}` and the footer comment:

```tsx
        {/* ---- Micro-test (post-translation feedback) ---- */}
        {result && consent === true && (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {microTestDone ? (
              <p className="text-sm text-slate-700">
                ¡Gracias! Tus respuestas ayudan a mejorar Paper-to-Human.
              </p>
            ) : (
              <>
                <button
                  onClick={() => setMicroTestOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-lg font-semibold text-slate-900">
                    ¿Qué tan bien entendiste el texto? (opcional, 1 min)
                  </h2>
                  <span className="text-slate-400">
                    {microTestOpen ? "▲" : "▼"}
                  </span>
                </button>

                {microTestOpen && (
                  <div className="mt-4 space-y-5">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        En una oración, ¿cuál es la idea más importante del
                        texto?
                      </label>
                      <input
                        type="text"
                        value={q1}
                        onChange={(e) => setQ1(e.target.value.slice(0, 100))}
                        maxLength={100}
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                    </div>

                    <RatingQuestion
                      label="¿Qué tan bien sientes que entendiste el texto?"
                      lowLabel="Nada"
                      midLabel="Más o menos"
                      highLabel="Muy bien"
                      value={q2}
                      onChange={setQ2}
                    />

                    <RatingQuestion
                      label="¿Esta versión fue más fácil de entender que el texto original?"
                      lowLabel="Mucho más difícil"
                      midLabel="Igual"
                      highLabel="Mucho más fácil"
                      value={q3}
                      onChange={setQ3}
                    />

                    <button
                      onClick={handleMicroTestSubmit}
                      disabled={!q1.trim() || q2 === null || q3 === null}
                      className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Enviar respuestas
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

```

- [ ] **Step 6: Add the `RatingQuestion` helper component**

At the bottom of `app/page.tsx`, after the existing `ModalSection` function (after its closing `}`), add:

```tsx
function RatingQuestion({
  label,
  lowLabel,
  midLabel,
  highLabel,
  value,
  onChange,
}: {
  label: string;
  lowLabel: string;
  midLabel: string;
  highLabel: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="flex flex-col items-center gap-1 text-xs text-slate-500"
          >
            <input
              type="radio"
              name={label}
              checked={value === n}
              onChange={() => onChange(n)}
              className="h-4 w-4"
            />
            {n}
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>1 = {lowLabel}</span>
        <span>3 = {midLabel}</span>
        <span>5 = {highLabel}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual verification**

Run `npm run dev`:
1. With `consent` set to `false` (or unresolved), translate a paper → confirm the micro-test card never appears.
2. Set `localStorage.consent = "true"` (via "Acepto" or devtools), translate a paper → card appears below the complexity table, open by default.
3. Try clicking "Enviar respuestas" with fields empty → button stays disabled.
4. Fill Q1, pick a Q2 and Q3 rating, submit → open the browser devtools console and confirm a line `MICRO_TEST_RESPONSE: {...}` appears with the expected shape (check `level_chosen` is `"secundaria"` if you never opened the expanded view, or matches whichever version you expanded).
5. Confirm the form is replaced by the "¡Gracias! ..." message and does not reappear.
6. Click the chevron to collapse/expand the card before submitting, confirm it toggles.
7. Run a second translation (different or same paper) → confirm the micro-test card resets (shows the form again, not the thank-you message).

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx
git commit -m "Add post-translation micro-test with console-logged responses"
```

---

### Task 3: Final checks

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (warnings acceptable only if they pre-exist on `main`).

- [ ] **Step 3: Confirm no new dependencies were added**

Run: `git diff main -- package.json package-lock.json`
Expected: no output (empty diff).
