// lib/workOrder/copy.js
//
// The work order's own words, in the three document languages the PDF and
// the print sheet share. Not the app catalogue: these print on a document
// that keeps the QUOTE's language (non-negotiable #6), not the reader's.
// Falls back to English for the languages the catalogue has and this does
// not — a French work order in English is a smaller failure than a blank.

const COPY = {
  en: {
    title: "Work order — crew copy",
    across: (n) => `across ${n} area${n === 1 ? "" : "s"}`,
    crew: "Crew",
    crewNote: "Crew note",
    done: "Done",
    hiddenNote: (n) => `${n} item${n === 1 ? "" : "s"} on the quote ${n === 1 ? "is" : "are"} not on this page by the office's choice. No prices are printed on a work order.`,
    noPrices: "No prices are printed on a work order.",
  },
  fr: {
    title: "Bon de travail — copie équipe",
    across: (n) => `sur ${n} zone${n === 1 ? "" : "s"}`,
    crew: "Équipe",
    crewNote: "Note équipe",
    done: "Fait",
    hiddenNote: (n) => `${n} élément${n === 1 ? "" : "s"} de la soumission ${n === 1 ? "n'est" : "ne sont"} pas sur cette page, par choix du bureau. Aucun prix n'est imprimé sur un bon de travail.`,
    noPrices: "Aucun prix n'est imprimé sur un bon de travail.",
  },
  es: {
    title: "Orden de trabajo — copia de la cuadrilla",
    across: (n) => `en ${n} área${n === 1 ? "" : "s"}`,
    crew: "Cuadrilla",
    crewNote: "Nota para la cuadrilla",
    done: "Hecho",
    hiddenNote: (n) => `${n} ${n === 1 ? "elemento del presupuesto no está" : "elementos del presupuesto no están"} en esta página por decisión de la oficina. No se imprimen precios en una orden de trabajo.`,
    noPrices: "No se imprimen precios en una orden de trabajo.",
  },
};

export function workOrderCopy(language) {
  return COPY[language] || COPY.en;
}
