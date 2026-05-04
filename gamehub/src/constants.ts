import { Country } from "./types";

export const DEFAULT_COUNTRIES: Country[] = [
  {
    id: "brazil",
    nome: "Brasil/Portugal",
    cidades: [
      { id: "santa", nome: "Santa" },
      { id: "nobre", nome: "Nobre" },
      { id: "maresia", nome: "Maresia" },
      { id: "grande", nome: "Grande" },
      { id: "malta", nome: "Malta" },
      { id: "fronteira", nome: "Fronteira" },
    ],
  },
  {
    id: "english",
    nome: "Inglês",
    cidades: [
      { id: "kng", nome: "KNG" },
      { id: "district99", nome: "District99" },
      { id: "boomerang", nome: "Boomerang" },
      { id: "royal", nome: "Royal" },
      { id: "liberty99", nome: "Liberty99" },
    ],
  },
  {
    id: "spanish",
    nome: "Espanhol",
    cidades: [
      { id: "real", nome: "Real" },
      { id: "prime", nome: "Prime" },
    ],
  },
];
