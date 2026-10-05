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
    doors: (n) => `${n} door${n === 1 ? "" : "s"}`,
    drawers: (n) => `${n} drawer${n === 1 ? "" : "s"}`,
    colour: "Colour",
    sheen: "Sheen",
    doorStyle: "Door style",
    primerCoats: "Primer coats",
    topCoats: "Top coats",
    twoTone: "Two-tone",
    threeTone: "Three-tone",
    included: "What's included",
    addOns: "Options the client chose",
    materials: "Materials",
    checklist: "Checklist",
    required: "required",
    visits: "Visits",
  },
  fr: {
    title: "Bon de travail — copie équipe",
    across: (n) => `sur ${n} zone${n === 1 ? "" : "s"}`,
    crew: "Équipe",
    crewNote: "Note équipe",
    done: "Fait",
    hiddenNote: (n) => `${n} élément${n === 1 ? "" : "s"} de la soumission ${n === 1 ? "n'est" : "ne sont"} pas sur cette page, par choix du bureau. Aucun prix n'est imprimé sur un bon de travail.`,
    noPrices: "Aucun prix n'est imprimé sur un bon de travail.",
    doors: (n) => `${n} porte${n === 1 ? "" : "s"}`,
    drawers: (n) => `${n} tiroir${n === 1 ? "" : "s"}`,
    colour: "Couleur",
    sheen: "Lustre",
    doorStyle: "Style de porte",
    primerCoats: "Couches d'apprêt",
    topCoats: "Couches de finition",
    twoTone: "Deux tons",
    threeTone: "Trois tons",
    included: "Ce qui est inclus",
    addOns: "Options choisies par le client",
    materials: "Matériaux",
    checklist: "Liste de vérification",
    required: "obligatoire",
    visits: "Visites",
  },
  es: {
    title: "Orden de trabajo — copia de la cuadrilla",
    across: (n) => `en ${n} área${n === 1 ? "" : "s"}`,
    crew: "Cuadrilla",
    crewNote: "Nota para la cuadrilla",
    done: "Hecho",
    hiddenNote: (n) => `${n} ${n === 1 ? "elemento del presupuesto no está" : "elementos del presupuesto no están"} en esta página por decisión de la oficina. No se imprimen precios en una orden de trabajo.`,
    noPrices: "No se imprimen precios en una orden de trabajo.",
    doors: (n) => `${n} puerta${n === 1 ? "" : "s"}`,
    drawers: (n) => (n === 1 ? `${n} cajón` : `${n} cajones`),
    colour: "Color",
    sheen: "Brillo",
    doorStyle: "Estilo de puerta",
    primerCoats: "Capas de imprimación",
    topCoats: "Capas de acabado",
    twoTone: "Dos tonos",
    threeTone: "Tres tonos",
    included: "Qué incluye",
    addOns: "Opciones que eligió el cliente",
    materials: "Materiales",
    checklist: "Lista de verificación",
    required: "obligatorio",
    visits: "Visitas",
  },
};

export function workOrderCopy(language) {
  return COPY[language] || COPY.en;
}

/**
 * The counts and finish of one area as short phrases in the document's
 * language — "32 doors · 12 drawers", "Colour: Hale Navy · Top coats: 2".
 * Shared by the PDF and the print sheet so the two cannot word it apart.
 */
export function areaFactLines(area, c) {
  const counts = [];
  if (area?.counts?.doors > 0) counts.push(c.doors(area.counts.doors));
  if (area?.counts?.drawers > 0) counts.push(c.drawers(area.counts.drawers));
  const f = area?.finish || {};
  const finish = [
    f.colour && `${c.colour}: ${f.colour}`,
    f.sheen && `${c.sheen}: ${f.sheen}`,
    f.doorStyle && `${c.doorStyle}: ${f.doorStyle}`,
    f.primerCoats && `${c.primerCoats}: ${f.primerCoats}`,
    f.topCoats && `${c.topCoats}: ${f.topCoats}`,
    f.twoTone && c.twoTone,
    f.threeTone && c.threeTone,
  ].filter(Boolean);
  return { counts: counts.join(" · "), finish: finish.join(" · ") };
}
