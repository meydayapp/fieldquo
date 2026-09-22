// app/data/serviceSeeds/carpentry.js
//
// The cabinetry book of the benchmark, filed under carpentry: cabinet
// installation, hardware and repair. Refinishing is priced per door by the
// cabinet_refinishing price book and is kept here as a reference only.
const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "carpentry",
  categories: [
    { key: "cabinet_install", name: { en: "Cabinet installation", fr: "Installation d'armoires", es: "Instalación de gabinetes" } },
    { key: "cabinet_repair", name: { en: "Cabinet repair", fr: "Réparation d'armoires", es: "Reparación de gabinetes" } },
  ],
  services: [
    S("fq.carpentry.cabinet_install.cabinets", "cabinet_install", "each", BM(200, 344, 779),
      ["Cabinet installation", "Installation d'armoires", "Instalación de gabinetes"],
      ["Base and wall cabinets set level and plumb, screwed to the studs and to each other, doors and drawers aligned.",
       "Armoires du bas et du haut posées de niveau et d'aplomb, vissées aux montants et entre elles, portes et tiroirs alignés.",
       "Gabinetes bajos y altos colocados a nivel y a plomo, atornillados a los montantes y entre sí, con puertas y cajones alineados."]),
    S("fq.carpentry.cabinet_install.hardware", "cabinet_install", "each", BM(75, 75, 75),
      ["Cabinet hardware installation", "Installation de quincaillerie d'armoires", "Instalación de herrajes de gabinetes"],
      ["Handles, pulls and knobs drilled and fitted with a jig so every one lines up.",
       "Poignées et boutons percés et posés au gabarit pour que tout soit aligné.",
       "Jaladeras y perillas perforadas e instaladas con plantilla para que todas queden alineadas."],
      { existing: "standardAddOns cabinet_refinishing 'New Handles — supply & install'." }),
    S("fq.carpentry.cabinet_install.other", "cabinet_install", "flat", null,
      ["Other cabinet installation — describe what you need", "Autre installation d'armoires — décrivez le besoin", "Otra instalación de gabinetes — describa lo que necesita"],
      ["Cabinet installation work not listed above, priced after a look at the job.",
       "Travail d'installation d'armoires non listé ci-dessus, chiffré après examen sur place.",
       "Trabajo de instalación de gabinetes no listado arriba, cotizado después de ver el trabajo."]),
    S("fq.carpentry.cabinet_repair.refinishing", "cabinet_repair", "flat", null,
      ["Cabinet refinishing", "Refinition d'armoires", "Refinado de gabinetes"],
      ["Existing cabinets sanded and refinished in paint or stain rather than replaced.",
       "Armoires existantes sablées et refinies en peinture ou en teinture plutôt que remplacées.",
       "Gabinetes existentes lijados y refinados con pintura o tinte en lugar de reemplazarlos."],
      { existing: "cabinet_refinishing price book (per door / per drawer)." }),
    S("fq.carpentry.cabinet_repair.cabinets", "cabinet_repair", "flat", BM(125, 216, 376),
      ["Cabinet repair", "Réparation d'armoires", "Reparación de gabinetes"],
      ["Sagging doors, split panels, loose shelves and broken drawer boxes repaired and re-secured.",
       "Portes affaissées, panneaux fendus, tablettes lâches et caissons de tiroir brisés réparés et refixés.",
       "Puertas caídas, paneles partidos, repisas flojas y cajones rotos reparados y reasegurados."]),
    S("fq.carpentry.cabinet_repair.hardware", "cabinet_repair", "each", BM(85, 189, 304),
      ["Cabinet hardware repair", "Réparation de quincaillerie d'armoires", "Reparación de herrajes de gabinetes"],
      ["Hinges, slides and catches adjusted or replaced so doors close true and drawers glide.",
       "Charnières, coulisses et loquets ajustés ou remplacés pour que les portes ferment droit et que les tiroirs glissent.",
       "Bisagras, correderas y cierres ajustados o reemplazados para que las puertas cierren derecho y los cajones deslicen."],
      { existing: "standardAddOns 'Soft-Close Hinges' / 'Soft-Close Drawer Slides'." }),
    S("fq.carpentry.cabinet_repair.other", "cabinet_repair", "flat", null,
      ["Other cabinet repair — describe what you need", "Autre réparation d'armoires — décrivez le besoin", "Otra reparación de gabinetes — describa lo que necesita"],
      ["Cabinet repair work not listed above, priced after a look at the job.",
       "Travail de réparation d'armoires non listé ci-dessus, chiffré après examen sur place.",
       "Trabajo de reparación de gabinetes no listado arriba, cotizado después de ver el trabajo."]),
  ],
};
