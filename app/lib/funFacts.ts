export interface FunFact {
  fact: string;
  topic: string;
  paperTitle: string;
  paperUrl: string;
}

export const FUN_FACTS: FunFact[] = [
  {
    fact: "Los hongos no son plantas ni animales — pertenecen a su propio reino, y están más relacionados con los animales que con las plantas.",
    topic: "Biología",
    paperTitle:
      "The Fungal Kingdom: Diverse and Essential Roles in Earth's Ecosystems",
    paperUrl: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6221921/",
  },
  {
    fact: "Los algoritmos de reconocimiento facial cometen hasta 34 veces más errores con mujeres de piel oscura que con hombres de piel clara.",
    topic: "Inteligencia Artificial",
    paperTitle: "Gender Shades — Buolamwini & Gebru (2018)",
    paperUrl: "https://proceedings.mlr.press/v81/buolamwini18a.html",
  },
  {
    fact: "El universo observable tiene un diámetro de 93,000 millones de años luz, pero solo tiene 13,800 millones de años — porque el espacio se expande.",
    topic: "Astronomía",
    paperTitle: "Planck 2018 results — Cosmological parameters",
    paperUrl:
      "https://www.aanda.org/articles/aa/abs/2020/09/aa33910-18/aa33910-18.html",
  },
];

export function randomFunFact(): FunFact {
  return FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
}
