"use client";

import { useEffect, useRef, useState } from "react";
import { buildExportFile, versionPlainText } from "@/app/lib/export";
import { randomFunFact, type FunFact } from "@/app/lib/funFacts";

// ---- Types (match the /api/translate payload confirmed in Session 1) ----
interface Version {
  summary: string;
  concepts: string;
  analogy: string;
}
interface Metric {
  /** null when the API could not score the text (e.g. empty model output). */
  fh: number | null;
}
interface TranslateResult {
  // null for levels not generated in single-level mode.
  v1: Version | null;
  v2: Version | null;
  v3: Version | null;
  metrics: {
    original: Metric;
    v1: Metric | null;
    v2: Metric | null;
    v3: Metric | null;
  };
  source: string;
  truncated: boolean;
  /** Non-fatal parse/generation problems reported by the API. */
  warnings?: string[];
}

type Mode = "all" | "single";
type Level = "primaria" | "secundaria" | "avanzado";

const LEVEL_OPTIONS: Array<{ key: Level; label: string }> = [
  { key: "primaria", label: "Nivel Primaria" },
  { key: "secundaria", label: "Nivel Secundaria" },
  { key: "avanzado", label: "Nivel Avanzado (Preparatoria / Universidad)" },
];

// Maps a selection-mode level to the column key it corresponds to (see
// COLUMNS below and the mapping mirrored in /api/translate/route.ts).
const LEVEL_TO_COLUMN_KEY: Record<Level, "v1" | "v2" | "v3"> = {
  primaria: "v1",
  secundaria: "v2",
  avanzado: "v3",
};

/**
 * Parse a JSON response, tolerating a non-JSON body.
 *
 * A platform-level failure (gateway timeout, function crash) returns an HTML
 * error page, and the bare `res.json()` this replaced threw a SyntaxError that
 * surfaced to the user as "Unexpected token '<'".
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Pull an error message out of an API response body, with a fallback. */
function apiError(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

type Status = "idle" | "extracting" | "translating" | "done" | "error";

const MAX_PDF_BYTES = 5 * 1024 * 1024; // SPEC 4.1 — 5MB max
// Must match MAX_CHARS in /api/translate; the notice below lied if they drifted.
const MAX_CHARS = 12_000;
// Must match MIN_CHARS in /api/translate.
const MIN_CHARS = 200;

// SPEC 5.2 — column labels (UI in Mexican Spanish; "Versión"/"Grade" per request).
const COLUMNS = [
  { key: "v1", label: "Nivel Primaria", tableLabel: "Versión 1 (12 años)", order: "" },
  // V2 is the study intervention version → first on mobile (SPEC 5.2).
  {
    key: "v2",
    label: "Nivel Secundaria",
    tableLabel: "Versión 2 (Público general)",
    order: "order-first md:order-none",
  },
  {
    key: "v3",
    label: "Nivel Avanzado (Preparatoria / Universidad)",
    tableLabel: "Versión 3 (Profesional)",
    order: "",
  },
] as const;

// Display-time translation of API/route error strings (routes stay English/untouched).
const ERROR_ES: Record<string, string> = {
  "Could not extract text from this PDF. Try copying the text manually.":
    "No se pudo extraer texto de este PDF. Intenta copiar el texto manualmente.",
  "Could not access this URL. Try downloading the PDF directly.":
    "No se pudo acceder a esta URL. Intenta descargar el PDF directamente.",
  "Generation is taking longer than expected. Please try again.":
    "La generación está tardando más de lo esperado. Por favor intenta de nuevo.",
  "Not enough text to process. Please upload the full paper.":
    "No hay suficiente texto para procesar. Por favor sube el artículo completo.",
  "Translation failed. Please try again in a moment.":
    "La traducción falló. Por favor intenta de nuevo en un momento.",
  "Could not reach the translation service. Please try again.":
    "No se pudo contactar el servicio de traducción. Por favor intenta de nuevo.",
  "Translation service is not configured.":
    "El servicio de traducción no está configurado. Avisa al administrador.",
  "This URL took too long to respond. Try downloading the PDF directly.":
    "Esta URL tardó demasiado en responder. Intenta descargar el PDF directamente.",
  "This file is too large to process. Try downloading the PDF and uploading it directly.":
    "Este archivo es demasiado grande. Intenta descargar el PDF y subirlo directamente.",
  "This PDF has no selectable text (it may be a scan). Try copying the text manually.":
    "Este PDF no tiene texto seleccionable (puede ser un escaneo). Intenta copiar el texto manualmente.",
  "Could not extract text from this page. Try copying the text manually.":
    "No se pudo extraer texto de esta página. Intenta copiar el texto manualmente.",
  "Could not extract enough text from this page. Try copying the text manually.":
    "No se pudo extraer suficiente texto de esta página. Intenta copiar el texto manualmente.",
  "Invalid request body.": "La solicitud no es válida.",
  "No autorizado.": "No autorizado.",
};
function translateError(msg: string): string {
  return ERROR_ES[msg] ?? msg;
}

// Fernández-Huerta level name (higher score = more readable).
// `null` means the API declined to score the text; showing "Sin datos" is the
// only honest option — a numeric fallback would report fabricated readability.
function fhLevel(score: number | null): string {
  if (score === null) return "Sin datos";
  if (score >= 90) return "Muy fácil";
  if (score >= 70) return "Fácil";
  if (score >= 50) return "Estándar";
  if (score >= 30) return "Difícil";
  return "Muy difícil";
}

// Badge colors: blue scale for every tier except "Estándar", which is the
// one badge the palette allows in yellow (SPEC — yellow usage rules).
function fhBadgeClasses(score: number | null): string {
  if (score === null) return "bg-light-blue text-text-primary ring-light-blue";
  if (score >= 70) return "bg-light-blue text-primary-blue ring-medium-blue";
  if (score >= 50) return "bg-yellow-soft text-text-primary ring-yellow-accent";
  return "bg-medium-blue text-white ring-primary-blue";
}

/** Format a score for display, or "—" when there is none. */
function fhText(score: number | null): string {
  return score === null ? "—" : score.toFixed(1);
}

/**
 * Extract plain text from a PDF in the browser via pdf.js (lazy-loaded).
 *
 * Throws a user-facing message for the cases that previously failed silently
 * or surfaced as a generic "Algo salió mal": encrypted files, corrupt files,
 * and scans with no text layer.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  if (data.byteLength === 0) {
    throw new Error("El PDF está vacío.");
  }

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") {
      throw new Error(
        "Este PDF está protegido con contraseña. Quita la protección e intenta de nuevo.",
      );
    }
    throw new Error(
      "No se pudo leer este PDF. Puede estar dañado o no ser un PDF válido.",
    );
  }

  try {
    if (doc.numPages === 0) {
      throw new Error("Este PDF no tiene páginas.");
    }

    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const content = await page.getTextContent();
        text +=
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ") + "\n";
      } finally {
        // pdf.js caches per-page render/text resources until released.
        page.cleanup();
      }
    }

    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS) {
      // A scanned PDF parses fine and yields (almost) nothing. Saying so beats
      // the downstream "Please upload the full paper", which blames the user
      // for a file that simply has no text layer.
      throw new Error(
        "Este PDF no tiene texto seleccionable (puede ser un escaneo). Intenta copiar el texto manualmente.",
      );
    }
    return trimmed;
  } finally {
    await doc.destroy();
  }
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [charCount, setCharCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [funFact, setFunFact] = useState<FunFact | null>(null);
  const inputSectionRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>("all");
  const [selectedLevel, setSelectedLevel] = useState<Level>("secundaria");

  const busy = status === "extracting" || status === "translating";
  const canTranslate = (!!file || url.trim().length > 0) && !busy;

  // Fun facts card — pre-fill the URL input with the fact's source paper and
  // scroll back up, rather than auto-triggering a translation mid-render.
  function handleUseFunFactPaper(paperUrl: string) {
    setFile(null);
    setUrl(paperUrl);
    setCharCount(null);
    inputSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Close the expanded reading view on ESC.
  useEffect(() => {
    if (!expandedKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedKey(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedKey]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > MAX_PDF_BYTES) {
      setFile(null);
      setError("El PDF supera el límite de 5MB.");
      return;
    }
    setFile(f);
    if (f) setUrl(""); // file takes precedence; clear URL for clarity
    setCharCount(null);
  }

  async function handleTranslate() {
    setError(null);
    setResult(null);
    setCharCount(null);

    try {
      // ---- 1. Obtain the paper text (PDF upload or URL) ----
      let text = "";
      let source = "";

      setStatus("extracting");
      if (file) {
        text = await extractPdfText(file);
        source = file.name;
      } else {
        const res = await fetch("/api/fetch-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        const data = await readJson(res);
        if (!res.ok) {
          throw new Error(
            apiError(
              data,
              "Could not access this URL. Try downloading the PDF directly.",
            ),
          );
        }
        text = typeof data.text === "string" ? data.text : "";
        source = (typeof data.title === "string" && data.title) || url.trim();
      }

      if (text.trim().length < MIN_CHARS) {
        // Caught here rather than after a pointless round trip to /api/translate.
        throw new Error(
          "Not enough text to process. Please upload the full paper.",
        );
      }

      setCharCount(text.length);

      // ---- 2. Translate into three versions ----
      setStatus("translating");
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source, mode, selectedLevel }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(
          apiError(data, "Translation failed. Please try again in a moment."),
        );
      }

      const payload = data as unknown as TranslateResult;
      if (payload.warnings?.length) {
        // Surfaced in the console rather than the UI: the output is usable,
        // but these flag versions that may not match the study's structure.
        console.warn("Paper-to-Human: advertencias del API", payload.warnings);
      }

      setResult(payload);
      setFunFact(randomFunFact());
      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo salió mal.";
      setError(translateError(msg));
      setStatus("error");
    }
  }

  // SPEC 4.5 — Copy plain text; label flips to "Copiado ✓" for 2s.
  async function handleCopy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  }

  // SPEC 4.5 — Download .txt with the mandated header block (kept in English).
  function handleDownload(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="min-h-screen bg-background-base text-text-primary">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ---- Header ---- */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary-blue sm:text-4xl">
            Paper-to-Human
          </h1>
          <p className="mt-2 text-base text-text-primary">
            Traduce un artículo académico en tres niveles de lectura.
          </p>
        </header>

        {/* ---- Level selection mode toggle ---- */}
        <section className="mb-6 rounded-2xl border border-light-blue bg-light-blue p-4 shadow-sm">
          <div className="inline-flex rounded-full border border-light-blue bg-white p-1">
            <button
              type="button"
              onClick={() => setMode("all")}
              disabled={busy}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                mode === "all"
                  ? "bg-primary-blue text-white shadow-sm"
                  : "text-text-primary hover:bg-light-blue"
              }`}
            >
              Ver los 3 niveles
            </button>
            <button
              type="button"
              onClick={() => setMode("single")}
              disabled={busy}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                mode === "single"
                  ? "bg-primary-blue text-white shadow-sm"
                  : "text-text-primary hover:bg-light-blue"
              }`}
            >
              Elegir un nivel
            </button>
          </div>

          {mode === "single" && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
              {LEVEL_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 text-sm text-text-primary"
                >
                  <input
                    type="radio"
                    name="selectedLevel"
                    value={opt.key}
                    checked={selectedLevel === opt.key}
                    onChange={() => setSelectedLevel(opt.key)}
                    disabled={busy}
                    className="h-4 w-4 border-light-blue text-primary-blue focus:ring-primary-blue"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
        </section>

        {/* ---- Input section ---- */}
        <section
          ref={inputSectionRef}
          className="mb-8 rounded-2xl border border-light-blue bg-light-blue p-6 shadow-sm"
        >
          <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            {/* PDF upload */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Sube un PDF
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={onFileChange}
                disabled={busy}
                className="block w-full cursor-pointer rounded-lg border border-slate-300 text-sm text-text-primary file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1 text-xs text-text-primary">Solo .pdf · máximo 5MB</p>
            </div>

            {/* OR divider */}
            <div className="hidden text-center text-sm font-medium text-text-primary sm:block">
              O
            </div>

            {/* URL field */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Pega la URL del artículo
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (e.target.value) setFile(null);
                  setCharCount(null);
                }}
                placeholder="https://example.com/paper"
                disabled={busy}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={handleTranslate}
              disabled={!canTranslate}
              className="inline-flex items-center justify-center rounded-lg bg-primary-blue px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-medium-blue disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? "Procesando…" : "Traducir"}
            </button>

            {charCount !== null && (
              <p className="text-xs text-text-primary">
                Se extrajeron {charCount.toLocaleString()} caracteres
                {charCount > MAX_CHARS && (
                  <span className="ml-1 text-amber-600">
                    · Texto recortado a {MAX_CHARS.toLocaleString()} caracteres
                    para procesamiento.
                  </span>
                )}
              </p>
            )}
          </div>
        </section>

        {/* ---- Loading state ---- */}
        {busy && (
          <div className="mb-8 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <span className="text-sm font-medium">
              {status === "extracting"
                ? "Extrayendo texto…"
                : "Generando tres versiones…"}
            </span>
          </div>
        )}

        {/* ---- Error state ---- */}
        {error && (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ---- Three-column output (SPEC 5.2) ---- */}
        {result && (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {COLUMNS.map((col) => {
              const version = result[col.key];
              const metric = result.metrics[col.key];
              if (!version || !metric) return null;
              return (
                <article
                  key={col.key}
                  className={`flex flex-col rounded-2xl border border-light-blue bg-light-blue p-5 shadow-sm ${col.order}`}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-primary-blue px-3 py-1 text-xs font-semibold text-white">
                      {col.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${fhBadgeClasses(
                          metric.fh,
                        )}`}
                      >
                        {fhLevel(metric.fh)}
                      </span>
                      <button
                        onClick={() => setExpandedKey(col.key)}
                        aria-label="Ampliar"
                        title="Ampliar"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs leading-none text-text-primary transition hover:bg-slate-100"
                      >
                        ⛶
                      </button>
                    </div>
                  </div>

                  <Section title="Resumen" body={version.summary} />
                  <Section title="Conceptos clave" body={version.concepts} />
                  <Section title="Analogía" body={version.analogy} />

                  {/* Export actions (SPEC 4.5) */}
                  <div className="mt-auto flex gap-2 pt-4">
                    <button
                      onClick={() =>
                        handleCopy(col.key, versionPlainText(version))
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-slate-100"
                    >
                      {copiedKey === col.key ? "Copiado ✓" : "Copiar"}
                    </button>
                    <button
                      onClick={() =>
                        handleDownload(
                          `paper-to-human-${col.key}.txt`,
                          buildExportFile({
                            version,
                            metric,
                            nivel: fhLevel(metric.fh),
                            source: result.source,
                          }),
                        )
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-slate-100"
                    >
                      Descargar .txt
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* ---- Complexity table (SPEC 4.4 / 5.1) — below the three columns ---- */}
        {result && (
          <section className="mt-8 rounded-2xl border border-light-blue bg-light-blue p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-primary-blue">
              Comparación de complejidad
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-text-primary">
                    <th className="py-2 pr-4 font-semibold">Texto</th>
                    <th className="py-2 pr-4 font-semibold">Fernández-Huerta</th>
                    <th className="py-2 font-semibold">Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {/*
                    The English original is deliberately absent. Fernández-Huerta
                    is calibrated for Spanish, so scoring English text produces a
                    number with no meaning — and putting it in the same column as
                    the Spanish versions invited reading it as a baseline. The
                    API still returns metrics.original for the study's raw data.
                  */}
                  {[
                    { label: "Versión 1 (12 años)", m: result.metrics.v1 },
                    { label: "Versión 2 (Público general)", m: result.metrics.v2 },
                    { label: "Versión 3 (Profesional)", m: result.metrics.v3 },
                  ].map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium text-text-primary">
                        {row.label}
                      </td>
                      <td className="py-2 pr-4 text-text-primary">
                        {fhText(row.m?.fh ?? null)}
                      </td>
                      <td className="py-2 text-text-primary">
                        {fhLevel(row.m?.fh ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-text-primary">
              {(() => {
                // Same-language (Spanish→Spanish) comparison: the professional
                // version is the baseline, the general-public version is the
                // intervention. The English original is excluded because FH is a
                // Spanish-calibrated index and a cross-language gap is invalid.
                const x = result.metrics.v3?.fh ?? null;
                const y = result.metrics.v2?.fh ?? null;

                if (x === null || y === null) {
                  return "No se pudo calcular la comparación de legibilidad para estas versiones.";
                }

                const z = Math.round((y - x) * 10) / 10;
                // The direction is asserted, not assumed: the previous wording
                // claimed an improvement even when the score went down.
                const verbo =
                  z > 0 ? "mejoró" : z < 0 ? "redujo" : "no cambió";
                const cambio =
                  z > 0
                    ? `un aumento de ${z.toFixed(1)} puntos`
                    : z < 0
                      ? `una disminución de ${Math.abs(z).toFixed(1)} puntos`
                      : "sin cambio";

                return `Paper-to-Human ${verbo} la legibilidad de ${x.toFixed(
                  1,
                )} a ${y.toFixed(
                  1,
                )} puntos Fernández-Huerta en la versión para público general — ${cambio}.`;
              })()}
            </p>
          </section>
        )}

        {/* ---- Fun fact card ---- */}
        {result && funFact && (
          <section className="mt-8 rounded-2xl border-l-4 border-yellow-accent bg-yellow-soft p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span aria-hidden className="text-xl">💡</span>
              <h2 className="text-base font-semibold text-medium-blue">
                ¿Sabías que...?
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-text-primary">
              {funFact.fact}
            </p>
            <span className="mt-3 inline-block rounded-full bg-light-blue px-2.5 py-1 text-xs font-semibold text-primary-blue">
              {funFact.topic}
            </span>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <a
                href={funFact.paperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-medium-blue underline-offset-2 hover:underline"
              >
                Leer el paper original →
              </a>
              <button
                onClick={() => handleUseFunFactPaper(funFact.paperUrl)}
                className="rounded-lg bg-primary-blue px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-medium-blue"
              >
                Simplificar este paper
              </button>
            </div>
          </section>
        )}

        {/* ---- Footer (SPEC 5.3) ---- */}
        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs leading-relaxed text-text-primary">
          Paper-to-Human es parte de un estudio de investigación ISEF sobre
          traducción de complejidad mediada por IA. Todos los resultados deben
          verificarse contra la fuente original antes de usarse en contextos
          académicos o educativos.
        </footer>
      </div>

      {/* ---- Expanded reading view (modal) ---- */}
      {result &&
        expandedKey &&
        (() => {
          const col = COLUMNS.find((c) => c.key === expandedKey)!;
          const version = result[col.key];
          const metric = result.metrics[col.key];
          if (!version || !metric) return null;
          return (
            <div
              onClick={() => setExpandedKey(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 sm:p-6"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative h-screen w-screen overflow-y-auto bg-white sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[680px] sm:rounded-2xl"
                style={{ padding: "48px" }}
              >
                <button
                  onClick={() => setExpandedKey(null)}
                  aria-label="Cerrar"
                  title="Cerrar"
                  className="absolute right-4 top-4 rounded-full p-2 text-lg leading-none text-text-primary transition hover:bg-slate-100"
                >
                  ✕
                </button>

                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-blue px-3 py-1 text-xs font-semibold text-white">
                    {col.label}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${fhBadgeClasses(
                      metric.fh,
                    )}`}
                  >
                    {fhLevel(metric.fh)}
                  </span>
                </div>

                <div
                  className="text-text-primary"
                  style={{ fontSize: "18px", lineHeight: 1.8 }}
                >
                  <ModalSection title="Resumen" body={version.summary} />
                  <ModalSection title="Conceptos clave" body={version.concepts} />
                  <ModalSection title="Analogía" body={version.analogy} />
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-text-primary">
        {title}
      </h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
        {body}
      </p>
    </div>
  );
}

function ModalSection({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-text-primary">
        {title}
      </h3>
      <p className="whitespace-pre-line">{body}</p>
    </div>
  );
}
