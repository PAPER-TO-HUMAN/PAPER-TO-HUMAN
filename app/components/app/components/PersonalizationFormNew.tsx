"use client";

import { useState } from "react";

export type PersonalizationAnswers = {
  familiarity: "none" | "some" | "knowledgeable";
  purpose: "class" | "curiosity" | "research";
  style: "examples" | "definitions" | "analogies";
};

type Props = {
  onComplete: (answers: PersonalizationAnswers) => void;
};

const QUESTIONS = [
  {
    key: "familiarity" as const,
    text: "¿Qué tanto sabes sobre el tema de este artículo?",
    options: [
      { value: "none", label: "No sé nada al respecto" },
      { value: "some", label: "Sé algo, pero no lo domino" },
      { value: "knowledgeable", label: "Ya tengo bastante conocimiento sobre el tema" },
    ],
  },
  {
    key: "purpose" as const,
    text: "¿Para qué estás leyendo este artículo?",
    options: [
      { value: "class", label: "Es una tarea o actividad de clase" },
      { value: "curiosity", label: "Tengo curiosidad personal sobre el tema" },
      { value: "research", label: "Estoy investigando o haciendo un proyecto" },
    ],
  },
  {
    key: "style" as const,
    text: "¿Cómo prefieres que te expliquen algo nuevo?",
    options: [
      { value: "examples", label: "Con ejemplos de la vida cotidiana" },
      { value: "definitions", label: "Con definiciones claras y directas" },
      { value: "analogies", label: "Con comparaciones y analogías" },
    ],
  },
];

export default function PersonalizationForm({ onComplete }: Props) {
  const [answers, setAnswers] = useState<Partial<PersonalizationAnswers>>({});

  const allAnswered =
    answers.familiarity && answers.purpose && answers.style;

  const handleSelect = (key: keyof PersonalizationAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (allAnswered) {
      onComplete(answers as PersonalizationAnswers);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8">
      {QUESTIONS.map((q) => (
        <div key={q.key} className="space-y-3">
          <p className="font-medium">{q.text}</p>
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  answers[q.key] === opt.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name={q.key}
                  value={opt.value}
                  checked={answers[q.key] === opt.value}
                  onChange={() => handleSelect(q.key, opt.value)}
                  required
                  className="accent-blue-600"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allAnswered}
        className={`w-full py-3 rounded-lg font-medium transition ${
          allAnswered
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
      >
        Continuar
      </button>
    </div>
  );
}
