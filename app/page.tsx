"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/app/lib/supabase";
import { buildExportFile, versionPlainText } from "@/app/lib/export";
import { jakarta } from "@/app/fonts";

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
// Must match QUIZ_SIZE in app/api/translate/route.ts and the quiz prompt.
const QUIZ_SIZE = 5;

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
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
  // Empty when generation failed — the quiz section simply doesn't render.
  quiz: QuizQuestion[];
}

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

// Consent is read from localStorage via useSyncExternalStore rather than a
// mount-time effect, so this same-tab write also has to notify manually
// (the native "storage" event only fires in *other* tabs).
let consentListeners: Array<() => void> = [];
function notifyConsentChange() {
  for (const listener of consentListeners) listener();
}
function subscribeToConsent(callback: () => void) {
  consentListeners.push(callback);
  return () => {
    consentListeners = consentListeners.filter((cb) => cb !== callback);
  };
}
function getConsentSnapshot(): boolean | null {
  const stored = localStorage.getItem("consent");
  if (stored === "true") return true;
  if (stored === "false") return false;
  return null;
}
function getConsentServerSnapshot(): boolean | null {
  return null;
}

type Mode = "all" | "single";
type Level = "primaria" | "secundaria" | "avanzado";
type Language = "es" | "en";

// Perception survey (Part 2) — six questions, purely local state, no storage.
type YesNo = "si" | "no";
type YesMaybeNo = "si" | "tal_vez" | "no";
interface SurveyAnswers {
  q1: number | null;
  q2: number | null;
  q3: YesMaybeNo | null;
  q4: YesNo | null;
  q5: YesNo | null;
  q6: YesNo | null;
}
const EMPTY_SURVEY: SurveyAnswers = {
  q1: null,
  q2: null,
  q3: null,
  q4: null,
  q5: null,
  q6: null,
};

const LEVEL_KEYS: Level[] = ["primaria", "secundaria", "avanzado"];
const COLUMN_KEYS = ["v1", "v2", "v3"] as const;
// V2 is the study intervention version → first on mobile (SPEC 5.2).
const COLUMN_ORDER: Record<(typeof COLUMN_KEYS)[number], string> = {
  v1: "",
  v2: "order-first md:order-none",
  v3: "",
};

// Maps a selection-mode level to the column key it corresponds to (see
// COLUMN_KEYS below and the mapping mirrored in /api/translate/route.ts).
const LEVEL_TO_COLUMN_KEY: Record<Level, "v1" | "v2" | "v3"> = {
  primaria: "v1",
  secundaria: "v2",
  avanzado: "v3",
};

// ---- UI copy (all languages). Internal values — form choices, survey codes
// like "si"/"no"/"tal_vez" — stay identical across languages; only the
// user-facing labels differ. The Claude-generated result content (summary /
// concepts / analogy) is governed by the locked SPEC 4.3 prompts and always
// comes back in Mexican Spanish regardless of `language` — this toggle only
// translates the surrounding interface.
const translations = {
  es: {
    appTitle: "Paper-to-Human",
    appSubtitle: "Traduce un artículo académico en tres niveles de lectura.",
    consent: {
      message:
        "Al usar Paper-to-Human, tus respuestas de comprensión pueden usarse de forma anónima para investigación educativa.",
      accept: "Acepto",
      decline: "No participar",
    },
    steps: ["Preferencias", "Artículo", "Resultado"],
    modeToggle: { all: "Ver los 3 niveles", single: "Elegir un nivel" },
    levelLabels: {
      primaria: "Nivel Primaria",
      secundaria: "Nivel Secundaria",
      avanzado: "Nivel Avanzado (Preparatoria / Universidad)",
    },
    form: {
      title: "Antes de comenzar",
      familiarity: {
        label: "¿Qué tanto sabes sobre el tema de este artículo?",
        options: [
          { value: "none", label: "No sé nada al respecto" },
          { value: "some", label: "Sé algo, pero no lo domino" },
          { value: "knowledgeable", label: "Ya tengo bastante conocimiento" },
        ],
      },
      purpose: {
        label: "¿Para qué estás leyendo este artículo?",
        options: [
          { value: "class", label: "Es una tarea o actividad de clase" },
          { value: "curiosity", label: "Tengo curiosidad personal" },
          { value: "research", label: "Estoy investigando o haciendo un proyecto" },
        ],
      },
      style: {
        label: "¿Cómo prefieres que te expliquen algo nuevo?",
        options: [
          { value: "examples", label: "Con ejemplos de la vida cotidiana" },
          { value: "definitions", label: "Con definiciones claras y directas" },
          { value: "analogies", label: "Con comparaciones y analogías" },
        ],
      },
    },
    formIncomplete: "Responde las preguntas anteriores para continuar.",
    upload: {
      uploadLabel: "Sube un PDF",
      uploadHint: "Solo .pdf · máximo 5MB",
      or: "O",
      urlLabel: "Pega la URL del artículo",
      urlPlaceholder: "https://example.com/paper",
    },
    translateButton: "Traducir",
    translateButtonBusy: "Procesando…",
    charCountExtracted: (n: number) => `Se extrajeron ${n.toLocaleString()} caracteres`,
    charCountTruncated: (n: number) =>
      `· Texto recortado a ${n.toLocaleString()} caracteres para procesamiento.`,
    loadingMessage: "Simplificando el artículo... esto puede tomar hasta 30 segundos",
    processing: "Procesando...",
    pdfTooLarge: "El PDF supera el límite de 5MB.",
    pdfEmpty: "El PDF está vacío.",
    pdfPasswordProtected:
      "Este PDF está protegido con contraseña. Quita la protección e intenta de nuevo.",
    pdfCorrupt: "No se pudo leer este PDF. Puede estar dañado o no ser un PDF válido.",
    pdfNoPages: "Este PDF no tiene páginas.",
    pdfNoTextLayer:
      "Este PDF no tiene texto seleccionable (puede ser un escaneo). Intenta copiar el texto manualmente.",
    genericError: "Algo salió mal.",
    copyFailed: "No se pudo copiar al portapapeles.",
    errors: {
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
      "Demasiadas solicitudes. Espera un momento e intenta de nuevo.":
        "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
      "Texto demasiado largo para procesar con los créditos disponibles.":
        "Texto demasiado largo para procesar con los créditos disponibles.",
    } as Record<string, string>,
    columns: {
      v1: { label: "Nivel Primaria", tableLabel: "Versión 1 (12 años)" },
      v2: { label: "Nivel Secundaria", tableLabel: "Versión 2 (Público general)" },
      v3: {
        label: "Nivel Avanzado (Preparatoria / Universidad)",
        tableLabel: "Versión 3 (Profesional)",
      },
    },
    fhLevels: {
      veryEasy: "Muy fácil",
      easy: "Fácil",
      standard: "Estándar",
      difficult: "Difícil",
      veryDifficult: "Muy difícil",
      noData: "Sin datos",
    },
    fhDescriptions: {
      veryEasy: "Accesible para cualquier lector",
      easy: "Apto para estudiantes de primaria",
      standard: "Nivel de secundaria",
      difficult: "Requiere conocimiento previo del tema",
      veryDifficult: "Nivel universitario o especializado",
    },
    sectionTitles: { summary: "Resumen", concepts: "Conceptos clave", analogy: "Analogía" },
    expand: "Ampliar",
    close: "Cerrar",
    copy: "Copiar",
    copied: "Copiado ✓",
    download: "Descargar .txt",
    comparisonTable: {
      title: "Comparación de complejidad",
      colText: "Texto",
      colFH: "Fernández-Huerta",
      colLevel: "Nivel",
      noComparison: "No se pudo calcular la comparación de legibilidad para estas versiones.",
      improved: "mejoró",
      reduced: "redujo",
      noChange: "no cambió",
      increaseOf: (z: string) => `un aumento de ${z} puntos`,
      decreaseOf: (z: string) => `una disminución de ${z} puntos`,
      noChangeText: "sin cambio",
      summarySentence: (verbo: string, x: string, y: string, cambio: string) =>
        `Paper-to-Human ${verbo} la legibilidad de ${x} a ${y} puntos Fernández-Huerta en la versión para público general — ${cambio}.`,
    },
    quiz: {
      title: "¿Entendiste el artículo?",
      subtitle: "Responde estas preguntas sobre lo que acabas de leer",
      submit: "Enviar respuestas",
      resultText: (score: number) => `Obtuviste ${score} de ${QUIZ_SIZE} respuestas correctas.`,
      recommendReread: "Te recomendamos releer el resumen.",
      goodJob: "¡Buen trabajo!",
    },
    survey: {
      title: "Cuéntanos tu experiencia",
      subtitle: "Tus respuestas nos ayudan a mejorar la herramienta",
      progress: (n: number) => `${n} de 6 preguntas respondidas`,
      thankYou:
        "¡Gracias por tu respuesta! Tus datos nos ayudan a mejorar el acceso al conocimiento científico.",
      submit: "Enviar respuestas",
      q1: {
        label:
          "Después de leer esta versión, ¿qué tan interesado estás en aprender más sobre este tema?",
        low: "Nada",
        mid: "Algo",
        high: "Mucho",
      },
      q2: {
        label: "¿Qué tan difícil te pareció entender el texto?",
        low: "Nada",
        mid: "Algo",
        high: "Mucho",
      },
      q3: {
        label: "¿Usarías esta herramienta para leer otros artículos científicos por tu cuenta?",
        options: [
          { value: "si", label: "Sí" },
          { value: "tal_vez", label: "Tal vez" },
          { value: "no", label: "No" },
        ],
      },
      q4: {
        label: "¿La recomendarías a un compañero?",
        options: [
          { value: "si", label: "Sí" },
          { value: "no", label: "No" },
        ],
      },
      q5: {
        label: "¿Habías leído un artículo científico completo antes de hoy?",
        options: [
          { value: "si", label: "Sí" },
          { value: "no", label: "No" },
        ],
      },
      q6: {
        label: "¿Sientes que puedes aprender más usando Paper-to-Human?",
        options: [
          { value: "si", label: "Sí" },
          { value: "no", label: "No" },
        ],
      },
    },
    microTest: {
      toggleTitle: "¿Qué tan bien entendiste el texto? (opcional, 1 min)",
      thanks: "¡Gracias! Tus respuestas ayudan a mejorar Paper-to-Human.",
      q1Label: "En una oración, ¿cuál es la idea más importante del texto?",
      q2: {
        label: "¿Qué tan bien sientes que entendiste el texto?",
        low: "Nada",
        mid: "Más o menos",
        high: "Muy bien",
      },
      q3: {
        label: "¿Esta versión fue más fácil de entender que el texto original?",
        low: "Mucho más difícil",
        mid: "Igual",
        high: "Mucho más fácil",
      },
      submit: "Enviar respuestas",
    },
    footer:
      "Paper-to-Human es parte de un estudio de investigación ISEF sobre traducción de complejidad mediada por IA. Todos los resultados deben verificarse contra la fuente original antes de usarse en contextos académicos o educativos.",
  },
  en: {
    appTitle: "Paper-to-Human",
    appSubtitle: "Translate an academic paper into three reading levels.",
    consent: {
      message:
        "By using Paper-to-Human, your comprehension answers may be used anonymously for educational research.",
      accept: "I Agree",
      decline: "Don't Participate",
    },
    steps: ["Preferences", "Paper", "Result"],
    modeToggle: { all: "View all 3 levels", single: "Choose one level" },
    levelLabels: {
      primaria: "Elementary Level",
      secundaria: "Middle School Level",
      avanzado: "Advanced Level (High School / University)",
    },
    form: {
      title: "Before you begin",
      familiarity: {
        label: "How much do you know about this paper's topic?",
        options: [
          { value: "none", label: "I know nothing about it" },
          { value: "some", label: "I know a little, but not well" },
          { value: "knowledgeable", label: "I already know quite a bit" },
        ],
      },
      purpose: {
        label: "Why are you reading this paper?",
        options: [
          { value: "class", label: "It's a class assignment or activity" },
          { value: "curiosity", label: "I'm personally curious" },
          { value: "research", label: "I'm researching or working on a project" },
        ],
      },
      style: {
        label: "How do you prefer new things explained to you?",
        options: [
          { value: "examples", label: "With everyday life examples" },
          { value: "definitions", label: "With clear, direct definitions" },
          { value: "analogies", label: "With comparisons and analogies" },
        ],
      },
    },
    formIncomplete: "Answer the questions above to continue.",
    upload: {
      uploadLabel: "Upload a PDF",
      uploadHint: "PDF only · 5MB max",
      or: "OR",
      urlLabel: "Paste the paper's URL",
      urlPlaceholder: "https://example.com/paper",
    },
    translateButton: "Translate",
    translateButtonBusy: "Processing…",
    charCountExtracted: (n: number) => `Extracted ${n.toLocaleString()} characters`,
    charCountTruncated: (n: number) =>
      `· Text truncated to ${n.toLocaleString()} characters for processing.`,
    loadingMessage: "Simplifying the paper... this can take up to 30 seconds",
    processing: "Processing...",
    pdfTooLarge: "The PDF exceeds the 5MB limit.",
    pdfEmpty: "The PDF is empty.",
    pdfPasswordProtected:
      "This PDF is password-protected. Remove the protection and try again.",
    pdfCorrupt: "Could not read this PDF. It may be corrupted or not a valid PDF.",
    pdfNoPages: "This PDF has no pages.",
    pdfNoTextLayer:
      "This PDF has no selectable text (it may be a scan). Try copying the text manually.",
    genericError: "Something went wrong.",
    copyFailed: "Could not copy to clipboard.",
    errors: {
      "Could not extract text from this PDF. Try copying the text manually.":
        "Could not extract text from this PDF. Try copying the text manually.",
      "Could not access this URL. Try downloading the PDF directly.":
        "Could not access this URL. Try downloading the PDF directly.",
      "Generation is taking longer than expected. Please try again.":
        "Generation is taking longer than expected. Please try again.",
      "Not enough text to process. Please upload the full paper.":
        "Not enough text to process. Please upload the full paper.",
      "Translation failed. Please try again in a moment.":
        "Translation failed. Please try again in a moment.",
      "Could not reach the translation service. Please try again.":
        "Could not reach the translation service. Please try again.",
      "Translation service is not configured.":
        "Translation service is not configured. Please notify the administrator.",
      "This URL took too long to respond. Try downloading the PDF directly.":
        "This URL took too long to respond. Try downloading the PDF directly.",
      "This file is too large to process. Try downloading the PDF and uploading it directly.":
        "This file is too large to process. Try downloading the PDF and uploading it directly.",
      "This PDF has no selectable text (it may be a scan). Try copying the text manually.":
        "This PDF has no selectable text (it may be a scan). Try copying the text manually.",
      "Could not extract text from this page. Try copying the text manually.":
        "Could not extract text from this page. Try copying the text manually.",
      "Could not extract enough text from this page. Try copying the text manually.":
        "Could not extract enough text from this page. Try copying the text manually.",
      "Invalid request body.": "Invalid request.",
      "No autorizado.": "Not authorized.",
      "Demasiadas solicitudes. Espera un momento e intenta de nuevo.":
        "Too many requests. Please wait a moment and try again.",
      "Texto demasiado largo para procesar con los créditos disponibles.":
        "Text is too long to process with the available credits.",
    } as Record<string, string>,
    columns: {
      v1: { label: "Elementary Level", tableLabel: "Version 1 (age 12)" },
      v2: { label: "Middle School Level", tableLabel: "Version 2 (General public)" },
      v3: {
        label: "Advanced Level (High School / University)",
        tableLabel: "Version 3 (Professional)",
      },
    },
    fhLevels: {
      veryEasy: "Very easy",
      easy: "Easy",
      standard: "Standard",
      difficult: "Difficult",
      veryDifficult: "Very difficult",
      noData: "No data",
    },
    fhDescriptions: {
      veryEasy: "Accessible to any reader",
      easy: "Suitable for elementary school students",
      standard: "High school level",
      difficult: "Requires prior knowledge of the topic",
      veryDifficult: "University or specialized level",
    },
    sectionTitles: { summary: "Summary", concepts: "Key Concepts", analogy: "Analogy" },
    expand: "Expand",
    close: "Close",
    copy: "Copy",
    copied: "Copied ✓",
    download: "Download .txt",
    comparisonTable: {
      title: "Complexity comparison",
      colText: "Text",
      colFH: "Fernández-Huerta",
      colLevel: "Level",
      noComparison: "Readability comparison could not be calculated for these versions.",
      improved: "improved",
      reduced: "reduced",
      noChange: "did not change",
      increaseOf: (z: string) => `an increase of ${z} points`,
      decreaseOf: (z: string) => `a decrease of ${z} points`,
      noChangeText: "no change",
      summarySentence: (verbo: string, x: string, y: string, cambio: string) =>
        `Paper-to-Human ${verbo} the readability from ${x} to ${y} Fernández-Huerta points in the general-public version — ${cambio}.`,
    },
    quiz: {
      title: "Did you understand the paper?",
      subtitle: "Answer these questions about what you just read",
      submit: "Submit answers",
      resultText: (score: number) => `You got ${score} out of ${QUIZ_SIZE} correct.`,
      recommendReread: "We recommend re-reading the summary.",
      goodJob: "Great job!",
    },
    survey: {
      title: "Tell us about your experience",
      subtitle: "Your answers help us improve the tool",
      progress: (n: number) => `${n} of 6 questions answered`,
      thankYou:
        "Thank you for your response! Your data helps us improve access to scientific knowledge.",
      submit: "Submit answers",
      q1: {
        label:
          "After reading this version, how interested are you in learning more about this topic?",
        low: "Not at all",
        mid: "Somewhat",
        high: "A lot",
      },
      q2: {
        label: "How difficult was it to understand the text?",
        low: "Not at all",
        mid: "Somewhat",
        high: "A lot",
      },
      q3: {
        label: "Would you use this tool to read other scientific papers on your own?",
        options: [
          { value: "si", label: "Yes" },
          { value: "tal_vez", label: "Maybe" },
          { value: "no", label: "No" },
        ],
      },
      q4: {
        label: "Would you recommend it to a friend?",
        options: [
          { value: "si", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      q5: {
        label: "Had you read a full scientific paper before today?",
        options: [
          { value: "si", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      q6: {
        label: "Do you feel you can learn more using Paper-to-Human?",
        options: [
          { value: "si", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    },
    microTest: {
      toggleTitle: "How well did you understand the text? (optional, 1 min)",
      thanks: "Thank you! Your answers help improve Paper-to-Human.",
      q1Label: "In one sentence, what is the most important idea of the text?",
      q2: {
        label: "How well do you feel you understood the text?",
        low: "Not at all",
        mid: "Somewhat",
        high: "Very well",
      },
      q3: {
        label: "Was this version easier to understand than the original text?",
        low: "Much harder",
        mid: "The same",
        high: "Much easier",
      },
      submit: "Submit answers",
    },
    footer:
      "Paper-to-Human is part of an ISEF research study on AI-mediated complexity translation. All results should be verified against the original source before being used in academic or educational contexts.",
  },
} as const;

type UIText = (typeof translations)[Language];

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

// Display-time translation of API/route error strings (routes stay English/untouched).
function translateError(msg: string, t: UIText): string {
  return t.errors[msg] ?? msg;
}

// Fernández-Huerta level name (higher score = more readable).
// `null` means the API declined to score the text; the "no data" label is the
// only honest option — a numeric fallback would report fabricated readability.
function fhLevel(score: number | null, t: UIText): string {
  if (score === null) return t.fhLevels.noData;
  if (score >= 90) return t.fhLevels.veryEasy;
  if (score >= 70) return t.fhLevels.easy;
  if (score >= 50) return t.fhLevels.standard;
  if (score >= 30) return t.fhLevels.difficult;
  return t.fhLevels.veryDifficult;
}

// Plain-language gloss for the FH tier, shown under the badge. No gloss for
// "no data" — there's nothing honest to say about a score that doesn't exist.
function fhDescription(score: number | null, t: UIText): string {
  if (score === null) return "";
  if (score >= 90) return t.fhDescriptions.veryEasy;
  if (score >= 70) return t.fhDescriptions.easy;
  if (score >= 50) return t.fhDescriptions.standard;
  if (score >= 30) return t.fhDescriptions.difficult;
  return t.fhDescriptions.veryDifficult;
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
 * or surfaced as a generic error: encrypted files, corrupt files, and scans
 * with no text layer.
 */
async function extractPdfText(file: File, t: UIText): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  if (data.byteLength === 0) {
    throw new Error(t.pdfEmpty);
  }

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") {
      throw new Error(t.pdfPasswordProtected);
    }
    throw new Error(t.pdfCorrupt);
  }

  try {
    if (doc.numPages === 0) {
      throw new Error(t.pdfNoPages);
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
      throw new Error(t.pdfNoTextLayer);
    }
    return trimmed;
  } finally {
    await doc.destroy();
  }
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("es");
  const t = translations[language];

  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [charCount, setCharCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );
  const [paperText, setPaperText] = useState("");
  const [microTestOpen, setMicroTestOpen] = useState(true);
  const [microTestDone, setMicroTestDone] = useState(false);
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<number | null>(null);
  // Perception survey — shown after a translation result is available.
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswers>(EMPTY_SURVEY);
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  // Comprehension quiz — purely local state, nothing is sent anywhere.
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>(
    Array(QUIZ_SIZE).fill(null),
  );
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [mode, setMode] = useState<Mode>("all");
  const [selectedLevel, setSelectedLevel] = useState<Level>("secundaria");
  // Snapshot of mode/selectedLevel at the moment `result` was generated —
  // the toggle above isn't disabled after translation finishes, so reading
  // live `mode`/`selectedLevel` at micro-test submit time could attribute
  // the response to a level/mode the user never actually saw.
  const [resultMode, setResultMode] = useState<Mode>("all");
  const [resultLevel, setResultLevel] = useState<Level>("secundaria");
  // Snapshot of the personalization answers used for this result — the form
  // state itself is cleared when a new translation starts.
  const [resultProfile, setResultProfile] = useState<{
    familiarity: string | null;
    purpose: string | null;
    style: string | null;
  }>({ familiarity: null, purpose: null, style: null });
  // Personalization form — must be fully answered before the upload section appears.
  const [familiarity, setFamiliarity] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const formComplete = familiarity !== null && purpose !== null && style !== null;
  // Step indicator (visual only — doesn't gate anything already gated above).
  const currentStep: 1 | 2 | 3 = result ? 3 : formComplete ? 2 : 1;

  const busy = status === "extracting" || status === "translating";
  const canTranslate = (!!file || url.trim().length > 0) && !busy;

  const levelOptions = LEVEL_KEYS.map((key) => ({ key, label: t.levelLabels[key] }));
  const columns = COLUMN_KEYS.map((key) => ({
    key,
    order: COLUMN_ORDER[key],
    label: t.columns[key].label,
    tableLabel: t.columns[key].tableLabel,
  }));

  // Close the expanded reading view on ESC.
  useEffect(() => {
    if (!expandedKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedKey(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedKey]);

  function handleConsent(value: boolean) {
    localStorage.setItem("consent", value ? "true" : "false");
    notifyConsentChange();
  }

  // Switching the language mid-flow would leave stale results and answers in
  // the other language, so the toggle resets everything back to a clean slate.
  function handleLanguageChange(lang: Language) {
    if (lang === language) return;
    setLanguage(lang);
    setUrl("");
    setFile(null);
    setCharCount(null);
    setStatus("idle");
    setError(null);
    setResult(null);
    setCopiedKey(null);
    setExpandedKey(null);
    setPaperText("");
    setMicroTestOpen(true);
    setMicroTestDone(false);
    setQ1("");
    setQ2(null);
    setQ3(null);
    setSurveyAnswers(EMPTY_SURVEY);
    setSurveySubmitted(false);
    setQuizAnswers(Array(QUIZ_SIZE).fill(null));
    setQuizSubmitted(false);
    setFamiliarity(null);
    setPurpose(null);
    setStyle(null);
    setMode("all");
    setSelectedLevel("secundaria");
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && f.size > MAX_PDF_BYTES) {
      setFile(null);
      setError(t.pdfTooLarge);
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
    setPaperText("");
    setMicroTestDone(false);
    setMicroTestOpen(true);
    setQ1("");
    setQ2(null);
    setQ3(null);
    setSurveyAnswers(EMPTY_SURVEY);
    setSurveySubmitted(false);
    setQuizAnswers(Array(QUIZ_SIZE).fill(null));
    setQuizSubmitted(false);
    setFamiliarity(null);
    setPurpose(null);
    setStyle(null);

    try {
      // ---- 1. Obtain the paper text (PDF upload or URL) ----
      let text = "";
      let source = "";

      setStatus("extracting");
      if (file) {
        text = await extractPdfText(file, t);
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
      setPaperText(text);

      // ---- 2. Translate into three versions ----
      setStatus("translating");
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source,
          mode,
          selectedLevel,
          familiarity,
          purpose,
          style,
          language,
        }),
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
      setResultMode(mode);
      setResultLevel(selectedLevel);
      setResultProfile({ familiarity, purpose, style });
      setStatus("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.genericError;
      setError(translateError(msg, t));
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
      setError(t.copyFailed);
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

  function selectedVersionKey(): "v1" | "v2" | "v3" {
    if (resultMode === "single") return LEVEL_TO_COLUMN_KEY[resultLevel];
    if (expandedKey === "v1" || expandedKey === "v2" || expandedKey === "v3") {
      return expandedKey;
    }
    return "v2";
  }

  function levelForVersionKey(key: "v1" | "v2" | "v3"): Level {
    return (Object.keys(LEVEL_TO_COLUMN_KEY) as Level[]).find(
      (level) => LEVEL_TO_COLUMN_KEY[level] === key,
    )!;
  }

  function handleMicroTestSubmit() {
    if (!result || !q1.trim() || q2 === null || q3 === null) return;

    const key = selectedVersionKey();
    const response: MicroTestResponse = {
      paper_title: paperText.slice(0, 60),
      level_chosen:
        resultMode === "single" ? resultLevel : levelForVersionKey(key),
      mode: resultMode,
      fh_score: result.metrics[key]?.fh ?? 0,
      comprehension_text: q1.trim(),
      confidence_score: q2,
      utility_score: q3,
      timestamp: new Date().toISOString(),
    };

    console.log("MICRO_TEST_RESPONSE:", JSON.stringify(response));
    setMicroTestDone(true);
  }

  function handleSurveySubmit() {
    if (Object.values(surveyAnswers).some((v) => v === null)) return;
    setSurveySubmitted(true);
  }

  function quizScore(): number {
    if (!result) return 0;
    return result.quiz.reduce(
      (n, q, i) => (quizAnswers[i] === q.correctIndex ? n + 1 : n),
      0,
    );
  }

  function handleQuizSubmit() {
    if (quizAnswers.some((a) => a === null)) return;
    setQuizSubmitted(true);

    if (result) {
      void supabase
        .from("test_responses")
        .insert([
          {
            paper_title: result.source,
            paper_url: file ? null : url.trim() || null,
            grade_level:
              resultMode === "single"
                ? resultLevel
                : levelForVersionKey(selectedVersionKey()),
            familiarity: resultProfile.familiarity,
            purpose: resultProfile.purpose,
            style: resultProfile.style,
            score: quizScore(),
            total_questions: result.quiz.length,
          },
        ])
        .then(({ error }) => {
          if (error) console.error("Error guardando respuesta:", error.message);
        });
    }
  }

  return (
    <div className="min-h-screen bg-background-base text-text-primary">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ---- Language toggle ---- */}
        <div className="mb-4 flex justify-end">
          <div className="inline-flex items-center gap-1 rounded-full border border-light-blue bg-white px-1 py-1 text-sm shadow-sm">
            <button
              type="button"
              onClick={() => handleLanguageChange("es")}
              className={`rounded-full px-3 py-1 transition ${
                language === "es"
                  ? "font-bold text-primary-blue"
                  : "text-text-primary/40 hover:text-text-primary"
              }`}
            >
              ES
            </button>
            <span className="text-text-primary/30">|</span>
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`rounded-full px-3 py-1 transition ${
                language === "en"
                  ? "font-bold text-primary-blue"
                  : "text-text-primary/40 hover:text-text-primary"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* ---- Consent banner ---- */}
        {consent === null && (
          <div className="mb-6 rounded-xl border border-light-blue bg-white p-4 text-sm text-text-primary shadow-sm">
            <p className="mb-3">{t.consent.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConsent(true)}
                className="rounded-lg bg-primary-blue px-4 py-2 text-xs font-semibold text-white transition hover:bg-medium-blue"
              >
                {t.consent.accept}
              </button>
              <button
                onClick={() => handleConsent(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-slate-100"
              >
                {t.consent.decline}
              </button>
            </div>
          </div>
        )}

        {/* ---- Header ---- */}
        <header className="mb-8 text-center">
          <h1 className={`${jakarta.className} text-3xl font-bold tracking-tight text-primary-blue sm:text-4xl`}>
            {t.appTitle}
          </h1>
          <p className="mt-2 text-base text-text-primary">{t.appSubtitle}</p>
        </header>

        {/* ---- Step indicator ---- */}
        <StepIndicator step={currentStep} labels={t.steps} />

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
              {t.modeToggle.all}
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
              {t.modeToggle.single}
            </button>
          </div>

          {mode === "single" && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
              {levelOptions.map((opt) => (
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

        {/* ---- Personalization form (must be completed before upload appears) ---- */}
        <section className="mb-8 rounded-2xl border border-light-blue bg-light-blue p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-primary-blue">
            {t.form.title}
          </h2>
          <div className="space-y-6">
            <ChoiceQuestion
              label={t.form.familiarity.label}
              options={t.form.familiarity.options}
              value={familiarity}
              onChange={setFamiliarity}
            />
            <ChoiceQuestion
              label={t.form.purpose.label}
              options={t.form.purpose.options}
              value={purpose}
              onChange={setPurpose}
            />
            <ChoiceQuestion
              label={t.form.style.label}
              options={t.form.style.options}
              value={style}
              onChange={setStyle}
            />
          </div>
        </section>

        {/* ---- Input section (hidden until the personalization form is complete) ---- */}
        {formComplete ? (
          <section className="mb-8 rounded-2xl border border-light-blue bg-light-blue p-6 shadow-sm">
            <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              {/* PDF upload */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  {t.upload.uploadLabel}
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={onFileChange}
                  disabled={busy}
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 text-sm text-text-primary file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                <p className="mt-1 text-xs text-text-primary">{t.upload.uploadHint}</p>
              </div>

              {/* OR divider */}
              <div className="hidden text-center text-sm font-medium text-text-primary sm:block">
                {t.upload.or}
              </div>

              {/* URL field */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">
                  {t.upload.urlLabel}
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (e.target.value) setFile(null);
                    setCharCount(null);
                  }}
                  placeholder={t.upload.urlPlaceholder}
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
                {busy ? t.translateButtonBusy : t.translateButton}
              </button>

              {charCount !== null && (
                <p className="text-xs text-text-primary">
                  {t.charCountExtracted(charCount)}
                  {charCount > MAX_CHARS && (
                    <span className="ml-1 text-amber-600">
                      {t.charCountTruncated(MAX_CHARS)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </section>
        ) : (
          <p className="mb-8 text-center text-sm text-text-primary">
            {t.formIncomplete}
          </p>
        )}

        {/* ---- Loading state ---- */}
        {busy && (
          <div className="animate-pulse-subtle mb-8 rounded-xl border border-light-blue bg-white p-6 shadow-sm">
            <div className="flex items-center justify-center gap-3 text-text-primary">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-light-blue border-t-primary-blue" />
              <span className="text-sm font-medium">{t.loadingMessage}</span>
            </div>
            <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-light-blue">
              <span className="animate-progress-indeterminate absolute inset-y-0 rounded-full bg-primary-blue" />
            </div>
            <p className="mt-3 text-center text-xs text-text-primary">
              {t.processing} <ElapsedSeconds />s
            </p>
          </div>
        )}

        {/* ---- Error state ---- */}
        {error && (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ---- Three-column output (SPEC 5.2), or a single card in single-level mode ---- */}
        {result && (
          <section
            className={`animate-fade-in grid grid-cols-1 gap-6 ${mode === "single" ? "" : "md:grid-cols-3"}`}
          >
            {columns.map((col) => {
              const version = result[col.key];
              const metric = result.metrics[col.key];
              if (!version || !metric) return null;
              return (
                <article
                  key={col.key}
                  className={`flex flex-col rounded-2xl border border-light-blue bg-light-blue p-5 shadow-sm ${col.order}`}
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <span className="rounded-full bg-primary-blue px-3 py-1 text-xs font-semibold text-white">
                      {col.label}
                    </span>
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col items-end">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${fhBadgeClasses(
                            metric.fh,
                          )}`}
                        >
                          {fhLevel(metric.fh, t)}
                        </span>
                        {fhDescription(metric.fh, t) && (
                          <span className="mt-1 text-right text-[11px] italic text-slate-500">
                            {fhDescription(metric.fh, t)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedKey(col.key)}
                        aria-label={t.expand}
                        title={t.expand}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs leading-none text-text-primary transition hover:bg-slate-100"
                      >
                        ⛶
                      </button>
                    </div>
                  </div>

                  <Section title={t.sectionTitles.summary} body={version.summary} />
                  <Section title={t.sectionTitles.concepts} body={version.concepts} />
                  <Section title={t.sectionTitles.analogy} body={version.analogy} />

                  {/* Export actions (SPEC 4.5) */}
                  <div className="mt-auto flex gap-2 pt-4">
                    <button
                      onClick={() =>
                        handleCopy(col.key, versionPlainText(version))
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-slate-100"
                    >
                      {copiedKey === col.key ? t.copied : t.copy}
                    </button>
                    <button
                      onClick={() =>
                        handleDownload(
                          `paper-to-human-${col.key}.txt`,
                          buildExportFile({
                            version,
                            metric,
                            nivel: fhLevel(metric.fh, t),
                            source: result.source,
                          }),
                        )
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-slate-100"
                    >
                      {t.download}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* ---- Complexity table (SPEC 4.4 / 5.1) — below the three columns ---- */}
        {result && (
          <section className="animate-fade-in mt-8 rounded-2xl border border-light-blue bg-light-blue p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-primary-blue">
              {t.comparisonTable.title}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-text-primary">
                    <th className="py-2 pr-4 font-semibold">{t.comparisonTable.colText}</th>
                    <th className="py-2 pr-4 font-semibold">{t.comparisonTable.colFH}</th>
                    <th className="py-2 font-semibold">{t.comparisonTable.colLevel}</th>
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
                  {(mode === "single"
                    ? [
                        {
                          key: LEVEL_TO_COLUMN_KEY[selectedLevel],
                          label: columns.find(
                            (c) => c.key === LEVEL_TO_COLUMN_KEY[selectedLevel],
                          )!.tableLabel,
                          m: result.metrics[LEVEL_TO_COLUMN_KEY[selectedLevel]],
                        },
                      ]
                    : columns.map((c) => ({
                        key: c.key,
                        label: c.tableLabel,
                        m: result.metrics[c.key],
                      }))
                  ).map((row) => (
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
                        {fhLevel(row.m?.fh ?? null, t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mode === "all" && (
              <p className="mt-4 text-sm text-text-primary">
                {(() => {
                  // Same-language (Spanish→Spanish) comparison: the professional
                  // version is the baseline, the general-public version is the
                  // intervention. The English original is excluded because FH is a
                  // Spanish-calibrated index and a cross-language gap is invalid.
                  const x = result.metrics.v3?.fh ?? null;
                  const y = result.metrics.v2?.fh ?? null;

                  if (x === null || y === null) {
                    return t.comparisonTable.noComparison;
                  }

                  const z = Math.round((y - x) * 10) / 10;
                  // The direction is asserted, not assumed: the previous wording
                  // claimed an improvement even when the score went down.
                  const verbo =
                    z > 0
                      ? t.comparisonTable.improved
                      : z < 0
                        ? t.comparisonTable.reduced
                        : t.comparisonTable.noChange;
                  const cambio =
                    z > 0
                      ? t.comparisonTable.increaseOf(z.toFixed(1))
                      : z < 0
                        ? t.comparisonTable.decreaseOf(Math.abs(z).toFixed(1))
                        : t.comparisonTable.noChangeText;

                  return t.comparisonTable.summarySentence(
                    verbo,
                    x.toFixed(1),
                    y.toFixed(1),
                    cambio,
                  );
                })()}
              </p>
            )}
          </section>
        )}

        {/* ---- Comprehension quiz (SPEC extension) — based on the simplified
            text the user just read, never the original paper. ---- */}
        {result && result.quiz.length === QUIZ_SIZE && (
          <section className="animate-fade-in mt-8 rounded-2xl border border-light-blue bg-light-blue p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-primary-blue">{t.quiz.title}</h2>
            <p className="mb-4 mt-1 text-sm text-text-primary">{t.quiz.subtitle}</p>

            <div className="space-y-6">
              {result.quiz.map((q, qi) => (
                <div
                  key={qi}
                  className="animate-fade-in"
                  style={{
                    animationDelay: `${qi * 100}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <p className="mb-2 text-sm font-medium text-text-primary">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className="flex items-center gap-2 text-sm text-text-primary"
                      >
                        <input
                          type="radio"
                          name={`quiz-${qi}`}
                          checked={quizAnswers[qi] === oi}
                          disabled={quizSubmitted}
                          onChange={() =>
                            setQuizAnswers((a) => {
                              const next = [...a];
                              next[qi] = oi;
                              return next;
                            })
                          }
                          className="h-4 w-4 border-light-blue text-primary-blue focus:ring-primary-blue"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {quizSubmitted ? (
              <p className="mt-6 text-sm font-semibold text-text-primary">
                {t.quiz.resultText(quizScore())}{" "}
                {quizScore() < Math.ceil(QUIZ_SIZE / 2) ? t.quiz.recommendReread : t.quiz.goodJob}
              </p>
            ) : (
              <button
                onClick={handleQuizSubmit}
                disabled={quizAnswers.some((a) => a === null)}
                className="mt-6 rounded-lg bg-primary-blue px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-medium-blue disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {t.quiz.submit}
              </button>
            )}
          </section>
        )}

        {/* ---- Perception survey (shown after a translation result is available,
            and after the quiz — when there is one — has been submitted) ---- */}
        {result && (result.quiz.length !== QUIZ_SIZE || quizSubmitted) && (
          <section className="animate-fade-in mt-8 rounded-2xl border border-light-blue bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-primary-blue">{t.survey.title}</h2>
            <p className="mb-4 mt-1 text-sm text-text-primary">{t.survey.subtitle}</p>

            {!surveySubmitted && (
              <p
                className={`mb-4 text-xs font-semibold transition-colors duration-300 ${
                  Object.values(surveyAnswers).filter((v) => v !== null)
                    .length === 6
                    ? "text-primary-blue"
                    : "text-text-primary/60"
                }`}
              >
                {t.survey.progress(
                  Object.values(surveyAnswers).filter((v) => v !== null).length,
                )}
              </p>
            )}

            {surveySubmitted ? (
              <p className="text-sm font-semibold text-text-primary">
                {t.survey.thankYou}
              </p>
            ) : (
              <div className="space-y-6">
                <RatingQuestion
                  label={t.survey.q1.label}
                  lowLabel={t.survey.q1.low}
                  midLabel={t.survey.q1.mid}
                  highLabel={t.survey.q1.high}
                  value={surveyAnswers.q1}
                  onChange={(v) => setSurveyAnswers((s) => ({ ...s, q1: v }))}
                />

                <RatingQuestion
                  label={t.survey.q2.label}
                  lowLabel={t.survey.q2.low}
                  midLabel={t.survey.q2.mid}
                  highLabel={t.survey.q2.high}
                  value={surveyAnswers.q2}
                  onChange={(v) => setSurveyAnswers((s) => ({ ...s, q2: v }))}
                />

                <ChoiceQuestion
                  label={t.survey.q3.label}
                  options={t.survey.q3.options}
                  value={surveyAnswers.q3}
                  onChange={(v) =>
                    setSurveyAnswers((s) => ({ ...s, q3: v as YesMaybeNo }))
                  }
                />

                <ChoiceQuestion
                  label={t.survey.q4.label}
                  options={t.survey.q4.options}
                  value={surveyAnswers.q4}
                  onChange={(v) =>
                    setSurveyAnswers((s) => ({ ...s, q4: v as YesNo }))
                  }
                />

                <ChoiceQuestion
                  label={t.survey.q5.label}
                  options={t.survey.q5.options}
                  value={surveyAnswers.q5}
                  onChange={(v) =>
                    setSurveyAnswers((s) => ({ ...s, q5: v as YesNo }))
                  }
                />

                <ChoiceQuestion
                  label={t.survey.q6.label}
                  options={t.survey.q6.options}
                  value={surveyAnswers.q6}
                  onChange={(v) =>
                    setSurveyAnswers((s) => ({ ...s, q6: v as YesNo }))
                  }
                />

                <button
                  onClick={handleSurveySubmit}
                  disabled={Object.values(surveyAnswers).some((v) => v === null)}
                  className="rounded-lg bg-primary-blue px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-medium-blue disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {t.survey.submit}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ---- Micro-test (post-translation feedback) ---- */}
        {result && consent === true && (
          <section className="animate-fade-in mt-8 rounded-2xl border border-light-blue bg-light-blue p-6 shadow-sm">
            {microTestDone ? (
              <p className="text-sm text-text-primary">{t.microTest.thanks}</p>
            ) : (
              <>
                <button
                  onClick={() => setMicroTestOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-lg font-semibold text-primary-blue">
                    {t.microTest.toggleTitle}
                  </h2>
                  <span className="text-text-primary">
                    {microTestOpen ? "▲" : "▼"}
                  </span>
                </button>

                {microTestOpen && (
                  <div className="mt-4 space-y-5">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-primary">
                        {t.microTest.q1Label}
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
                      label={t.microTest.q2.label}
                      lowLabel={t.microTest.q2.low}
                      midLabel={t.microTest.q2.mid}
                      highLabel={t.microTest.q2.high}
                      value={q2}
                      onChange={setQ2}
                    />

                    <RatingQuestion
                      label={t.microTest.q3.label}
                      lowLabel={t.microTest.q3.low}
                      midLabel={t.microTest.q3.mid}
                      highLabel={t.microTest.q3.high}
                      value={q3}
                      onChange={setQ3}
                    />

                    <button
                      onClick={handleMicroTestSubmit}
                      disabled={!q1.trim() || q2 === null || q3 === null}
                      className="rounded-lg bg-primary-blue px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-medium-blue disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {t.microTest.submit}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ---- Footer (SPEC 5.3) ---- */}
        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs leading-relaxed text-text-primary">
          {t.footer}
        </footer>
      </div>

      {/* ---- Expanded reading view (modal) ---- */}
      {result &&
        expandedKey &&
        (() => {
          const col = columns.find((c) => c.key === expandedKey)!;
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
                  aria-label={t.close}
                  title={t.close}
                  className="absolute right-4 top-4 rounded-full p-2 text-lg leading-none text-text-primary transition hover:bg-slate-100"
                >
                  ✕
                </button>

                <div className="mb-6 flex flex-wrap items-start gap-2">
                  <span className="rounded-full bg-primary-blue px-3 py-1 text-xs font-semibold text-white">
                    {col.label}
                  </span>
                  <div className="flex flex-col">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${fhBadgeClasses(
                        metric.fh,
                      )}`}
                    >
                      {fhLevel(metric.fh, t)}
                    </span>
                    {fhDescription(metric.fh, t) && (
                      <span className="mt-1 text-[11px] italic text-slate-500">
                        {fhDescription(metric.fh, t)}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="text-text-primary"
                  style={{ fontSize: "18px", lineHeight: 1.8 }}
                >
                  <ModalSection title={t.sectionTitles.summary} body={version.summary} />
                  <ModalSection title={t.sectionTitles.concepts} body={version.concepts} />
                  <ModalSection title={t.sectionTitles.analogy} body={version.analogy} />
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// Mounted only while the loading card is shown, so it always starts fresh at 0.
function ElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{seconds}</>;
}

function StepIndicator({
  step,
  labels,
}: {
  step: 1 | 2 | 3;
  labels: readonly string[];
}) {
  const steps: Array<{ n: 1 | 2 | 3; label: string }> = [
    { n: 1, label: labels[0] },
    { n: 2, label: labels[1] },
    { n: 3, label: labels[2] },
  ];
  return (
    <div className="mb-8 flex items-center justify-center">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                s.n === step
                  ? "bg-primary-blue text-white"
                  : s.n < step
                    ? "bg-medium-blue text-white"
                    : "bg-light-blue text-text-primary"
              }`}
            >
              {s.n}
            </span>
            <span
              className={`text-xs font-medium transition-colors duration-300 ${
                s.n === step ? "text-primary-blue" : "text-text-primary/50"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`mb-5 mx-2 h-0.5 w-10 transition-colors duration-300 sm:w-16 ${
                s.n < step ? "bg-medium-blue" : "bg-light-blue"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h3 className={`${jakarta.className} mb-1 text-xs font-bold uppercase tracking-wide text-text-primary`}>
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
      <h3 className={`${jakarta.className} mb-2 text-sm font-bold uppercase tracking-wide text-text-primary`}>
        {title}
      </h3>
      <p className="whitespace-pre-line">{body}</p>
    </div>
  );
}

function ChoiceQuestion({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text-primary">{label}</p>
      <div className="flex flex-wrap gap-6">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-text-primary transition-all duration-150 ${
                selected
                  ? "scale-[1.03] bg-light-blue ring-1 ring-inset ring-primary-blue"
                  : "scale-100"
              }`}
            >
              <input
                type="radio"
                name={label}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="h-4 w-4 border-light-blue text-primary-blue focus:ring-primary-blue"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

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
      <p className="mb-2 text-sm font-medium text-text-primary">{label}</p>
      <div className="flex items-center gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="flex flex-col items-center gap-1 text-xs text-text-primary"
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
      <div className="mt-1 flex justify-between text-xs text-text-primary">
        <span>1 = {lowLabel}</span>
        <span>3 = {midLabel}</span>
        <span>5 = {highLabel}</span>
      </div>
    </div>
  );
}
