import raw from "@/app/data/library.json";

export type LibraryLevel = "primaria" | "secundaria" | "avanzado";

export interface LibraryDiscipline {
  id: string;
  es: string;
  en: string;
}

export interface LibraryVersion {
  summary: string;
  /** "Concepto 1: nombre\ntexto\n\nConcepto 2: ..." */
  concepts: string;
  analogy: string;
}

export interface LibraryQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LibraryArticle {
  id: string;
  discipline: string;
  /** Language of the original paper. The library content itself is Spanish. */
  language: "en" | "es";
  title: string;
  titleEs: string;
  blurb: string;
  authors: string;
  year: number;
  journal: string;
  doi: string;
  url: string;
  license: string;
  attribution: string;
  versions: Record<LibraryLevel, LibraryVersion>;
  /** Fernández-Huerta score per level (a plain number in the JSON). */
  metrics: {
    original: number | null;
    primaria: number | null;
    secundaria: number | null;
    avanzado: number | null;
  };
  quiz: LibraryQuizQuestion[];
}

export interface LibraryData {
  schemaVersion: number;
  generatedAt: string;
  about: string;
  disciplines: LibraryDiscipline[];
  articles: LibraryArticle[];
}

export const library = raw as unknown as LibraryData;
