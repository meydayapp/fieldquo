// app/data/serviceSeeds/roofing_service.js
//
// The service list a roofer starts from. Read ./index.js for the format and
// the rules. Roofing is a TAKEOFF trade: a roof installation or replacement
// is priced per square by lib/pricing/roofLabour.js and the roofing_service
// price book, so every full-roof row here is a reference with
// `pricedBy: "takeoff"` and is never written as a flat price. Repairs,
// cleaning, inspection and the smaller installs are flat-priced services.
// The benchmark's roofing book is a grid with no pricing insight on any row,
// so it is built from one table per material; rows are emitted in the
// source's order for the join-back map.

// [slug, name{en,fr,es}]
const MAT = {
  asphalt: ["asphalt_shingle", { en: "Asphalt shingle", fr: "Bardeaux d'asphalte", es: "Teja asfáltica" }],
  clay: ["clay_tile", { en: "Clay tile", fr: "Tuiles d'argile", es: "Teja de arcilla" }],
  concrete: ["concrete_tile", { en: "Concrete tile", fr: "Tuiles de béton", es: "Teja de concreto" }],
  metal: ["metal", { en: "Metal roof", fr: "Toiture métallique", es: "Techo metálico" }],
  other: ["other_materials", { en: "Other roofing material", fr: "Autre matériau de toiture", es: "Otro material de techo" }],
  flat: ["rolled_flat", { en: "Rolled or flat roof", fr: "Toit plat ou en rouleau", es: "Techo plano o rollado" }],
  slate: ["slate", { en: "Slate roof", fr: "Toiture en ardoise", es: "Techo de pizarra" }],
  solar: ["solar_shingle", { en: "Solar shingle", fr: "Bardeaux solaires", es: "Teja solar" }],
  vinyl: ["vinyl", { en: "Vinyl roofing", fr: "Toiture en vinyle", es: "Techo de vinilo" }],
  shake: ["wood_shake", { en: "Wood shake", fr: "Bardeaux de cèdre", es: "Teja de madera" }],
};

const base = (seedKey, category, name, description, extra = {}) => ({
  seedKey, category, name, description, unit: "flat", benchmark: null, durationMinutes: null, bookable: false, ...extra,
});

const fullRoof = (kind, m) => {
  const [slug, n] = MAT[m];
  const replace = kind === "replace";
  return base(
    `fq.roofing_service.${kind}.${slug}`,
    kind,
    replace
      ? { en: `${n.en} roof replacement`, fr: `Remplacement de toiture — ${n.fr.toLowerCase()}`, es: `Reemplazo de techo — ${n.es.toLowerCase()}` }
      : { en: `${n.en} roof installation`, fr: `Installation de toiture — ${n.fr.toLowerCase()}`, es: `Instalación de techo — ${n.es.toLowerCase()}` },
    replace
      ? { en: `The old roof torn off, the deck checked and a new ${n.en.toLowerCase()} roof installed with underlayment, flashing and ridge.`, fr: `Ancienne toiture arrachée, platelage vérifié et nouvelle toiture (${n.fr.toLowerCase()}) posée avec sous-couche, solins et faîte.`, es: `Techo viejo retirado, la cubierta revisada y un techo nuevo (${n.es.toLowerCase()}) instalado con base, tapajuntas y cumbrera.` }
      : { en: `A new ${n.en.toLowerCase()} roof installed over a prepared deck with underlayment, flashing and ridge.`, fr: `Nouvelle toiture (${n.fr.toLowerCase()}) posée sur un platelage préparé avec sous-couche, solins et faîte.`, es: `Techo nuevo (${n.es.toLowerCase()}) instalado sobre una cubierta preparada con base, tapajuntas y cumbrera.` },
    { unit: "sqft", pricedBy: "takeoff", existing: "roofing_service price book (per square, takeoff)." },
  );
};
const repairMat = (m) => {
  const [slug, n] = MAT[m];
  return base(
    `fq.roofing_service.repair.${slug}`,
    "repair",
    { en: `${n.en} roof repair`, fr: `Réparation de toiture — ${n.fr.toLowerCase()}`, es: `Reparación de techo — ${n.es.toLowerCase()}` },
    { en: `Damaged or leaking sections of a ${n.en.toLowerCase()} roof repaired and sealed.`, fr: `Sections abîmées ou qui fuient d'une toiture (${n.fr.toLowerCase()}) réparées et scellées.`, es: `Secciones dañadas o con fugas de un techo (${n.es.toLowerCase()}) reparadas y selladas.` },
  );
};
const item = (kind, slug, name, description, extra) => base(`fq.roofing_service.${kind}.${slug}`, kind, name, description, extra);
const otherRow = (kind, what) => item(kind, `other${what ? "_" + what : ""}`,
  { en: `Other ${kind === "install" ? "installation" : kind === "repair" ? "repair" : "roof cleaning"} — describe what you need`, fr: `Autre ${kind === "install" ? "installation" : kind === "repair" ? "réparation" : "nettoyage de toiture"} — décrivez le besoin`, es: `Otra ${kind === "install" ? "instalación" : kind === "repair" ? "reparación" : "limpieza de techo"} — describa lo que necesita` },
  { en: "Roofing work not listed above, priced after a look at the roof.", fr: "Travail de toiture non listé ci-dessus, chiffré après examen du toit.", es: "Trabajo de techo no listado arriba, cotizado después de ver el techo." });

export const SEED = {
  trade: "roofing_service",
  categories: [
    { key: "cleaning", name: { en: "Roof and gutter cleaning", fr: "Nettoyage de toiture et de gouttières", es: "Limpieza de techo y canaletas" } },
    { key: "inspection", name: { en: "Inspection", fr: "Inspection", es: "Inspección" } },
    { key: "install", name: { en: "New roof installation", fr: "Installation de toiture neuve", es: "Instalación de techo nuevo" } },
    { key: "replace", name: { en: "Roof replacement", fr: "Remplacement de toiture", es: "Reemplazo de techo" } },
    { key: "components", name: { en: "Roof components", fr: "Composants de toiture", es: "Componentes del techo" } },
    { key: "repair", name: { en: "Roof repair", fr: "Réparation de toiture", es: "Reparación de techo" } },
  ],
  services: [
    item("cleaning", "roof_cleaning", { en: "Roof cleaning", fr: "Nettoyage de toiture", es: "Limpieza de techo" },
      { en: "Moss, algae and debris removed from the roof with a low-pressure wash that does not lift the shingles.", fr: "Mousse, algues et débris retirés du toit par un lavage à basse pression qui ne soulève pas les bardeaux.", es: "Musgo, algas y residuos retirados del techo con un lavado a baja presión que no levanta las tejas." }),
    item("cleaning", "gutter_clean_out", { en: "Gutter clean-out", fr: "Nettoyage de gouttières", es: "Limpieza de canaletas" },
      { en: "Gutters and downspouts cleared and flushed so water leaves the roof.", fr: "Gouttières et descentes dégagées et rincées pour que l'eau quitte le toit.", es: "Canaletas y bajantes despejadas y enjuagadas para que el agua salga del techo." },
      { existing: "gutter_services seed." }),
    otherRow("cleaning"),
    item("inspection", "expert_inspection", { en: "Roof inspection", fr: "Inspection de toiture", es: "Inspección de techo" },
      { en: "The roof walked or drone-surveyed, every penetration and flashing checked, and a written report with photos.", fr: "Toit parcouru ou relevé par drone, chaque percement et solin vérifié, et rapport écrit avec photos.", es: "Techo recorrido o inspeccionado con dron, cada penetración y tapajuntas revisado, y un informe escrito con fotos." }),
    ...["asphalt", "clay", "concrete", "metal", "other", "flat", "slate", "solar", "vinyl", "shake"].map((m) => fullRoof("install", m)),
    ...["asphalt", "clay", "concrete", "metal", "other", "flat", "slate", "solar", "vinyl", "shake"].map((m) => fullRoof("replace", m)),
    item("components", "melt_system", { en: "Roof de-icing system installation", fr: "Installation de système de déglaçage de toiture", es: "Instalación de sistema de deshielo de techo" },
      { en: "Heat cable laid along the eaves, valleys and gutters to stop ice dams forming.", fr: "Câble chauffant posé le long des avant-toits, noues et gouttières pour empêcher les barrages de glace.", es: "Cable calefactor tendido en aleros, limahoyas y canaletas para evitar la formación de presas de hielo." }),
    item("components", "flashing", { en: "Roof flashing installation", fr: "Installation de solins", es: "Instalación de tapajuntas" },
      { en: "New flashing fitted at walls, chimneys, vents and valleys and sealed.", fr: "Nouveaux solins posés aux murs, cheminées, évents et noues, et scellés.", es: "Tapajuntas nuevos colocados en muros, chimeneas, ventilas y limahoyas, y sellados." }),
    item("components", "roof_treatment", { en: "Roof treatment", fr: "Traitement de toiture", es: "Tratamiento de techo" },
      { en: "A protective or moss-inhibiting treatment applied to the roof surface.", fr: "Traitement protecteur ou anti-mousse appliqué sur la surface du toit.", es: "Tratamiento protector o antimusgo aplicado a la superficie del techo." }),
    item("components", "roof_vents", { en: "Roof vent installation", fr: "Installation d'évents de toit", es: "Instalación de ventilas de techo" },
      { en: "Roof, ridge or gable vents cut in and flashed to ventilate the attic.", fr: "Évents de toit, de faîte ou de pignon découpés et posés avec solins pour ventiler le grenier.", es: "Ventilas de techo, cumbrera o hastial cortadas y con tapajuntas para ventilar el ático." },
      { unit: "each" }),
    item("components", "soffit_fascia", { en: "Soffit and fascia installation", fr: "Installation de soffites et de bordures de toit", es: "Instalación de sofito y fascia" },
      { en: "New soffit and fascia fitted along the eaves, vented where the attic needs it.", fr: "Nouveaux soffites et bordures posés le long des avant-toits, ventilés là où le grenier l'exige.", es: "Sofito y fascia nuevos colocados a lo largo de los aleros, ventilados donde el ático lo requiera." },
      { unit: "linear_ft" }),
    item("components", "shingles", { en: "Shingle installation", fr: "Pose de bardeaux", es: "Instalación de tejas" },
      { en: "Shingles installed on a prepared section of roof.", fr: "Bardeaux posés sur une section de toit préparée.", es: "Tejas instaladas en una sección de techo preparada." },
      { unit: "sqft", pricedBy: "takeoff", existing: "roofing_service price book (per square, takeoff)." }),
    item("components", "chimney_cricket", { en: "Chimney cricket or saddle installation", fr: "Installation de chevalet de cheminée", es: "Instalación de caballete de chimenea" },
      { en: "A cricket built and flashed behind the chimney so water and snow shed around it.", fr: "Chevalet construit et posé avec solins derrière la cheminée pour que l'eau et la neige s'écoulent autour.", es: "Caballete construido y con tapajuntas detrás de la chimenea para que el agua y la nieve se desvíen." }),
    item("components", "gutters", { en: "Gutter installation", fr: "Installation de gouttières", es: "Instalación de canaletas" },
      { en: "Seamless gutters and downspouts installed along the eaves.", fr: "Gouttières sans joint et descentes posées le long des avant-toits.", es: "Canaletas sin costura y bajantes instaladas a lo largo de los aleros." },
      { unit: "linear_ft", existing: "gutter_services price book (per linear ft, takeoff)." }),
    item("components", "insulation", { en: "Attic insulation installation", fr: "Installation d'isolant de grenier", es: "Instalación de aislamiento de ático" },
      { en: "Attic insulation added to the agreed R-value while the roof is open or from inside.", fr: "Isolant de grenier ajouté jusqu'à la valeur R convenue, pendant que le toit est ouvert ou de l'intérieur.", es: "Aislamiento de ático agregado hasta el valor R acordado, con el techo abierto o desde adentro." },
      { unit: "sqft", existing: "insulation price book (per sq ft, takeoff)." }),
    item("components", "siding", { en: "Siding installation", fr: "Installation de revêtement extérieur", es: "Instalación de revestimiento" },
      { en: "Siding installed on the walls with house wrap, trim and flashing.", fr: "Revêtement posé sur les murs avec pare-air, moulures et solins.", es: "Revestimiento instalado en las paredes con membrana, molduras y tapajuntas." },
      { unit: "sqft", existing: "siding price book (per sq ft, takeoff)." }),
    otherRow("install"),
    item("components", "windows", { en: "Window installation", fr: "Installation de fenêtres", es: "Instalación de ventanas" },
      { en: "Windows installed, flashed and sealed as part of the exterior work.", fr: "Fenêtres posées, avec solins et scellement, dans le cadre des travaux extérieurs.", es: "Ventanas instaladas, con tapajuntas y selladas, como parte del trabajo exterior." },
      { unit: "each", existing: "doors_windows seed." }),
    repairMat("asphalt"), repairMat("clay"), repairMat("concrete"),
    item("repair", "cracked_shingles", { en: "Cracked or broken shingle repair", fr: "Réparation de bardeaux fissurés ou brisés", es: "Reparación de tejas agrietadas o rotas" },
      { en: "Cracked and broken shingles replaced with matching ones and sealed.", fr: "Bardeaux fissurés et brisés remplacés par des bardeaux assortis et scellés.", es: "Tejas agrietadas y rotas reemplazadas por otras iguales y selladas." }),
    item("repair", "melt_system", { en: "Roof de-icing system repair", fr: "Réparation de système de déglaçage", es: "Reparación de sistema de deshielo" },
      { en: "Failed heat cable sections or controls repaired or replaced.", fr: "Sections de câble chauffant ou commandes défaillantes réparées ou remplacées.", es: "Secciones de cable calefactor o controles dañados reparados o reemplazados." }),
    repairMat("metal"), repairMat("other"),
    item("repair", "missing_shingles", { en: "Missing shingle replacement", fr: "Remplacement de bardeaux manquants", es: "Reemplazo de tejas faltantes" },
      { en: "Wind-blown or missing shingles replaced and the surrounding tabs resealed.", fr: "Bardeaux arrachés par le vent ou manquants remplacés et les languettes voisines rescellées.", es: "Tejas volteadas por el viento o faltantes reemplazadas y las pestañas cercanas reselladas." }),
    repairMat("flat"),
    item("repair", "flashing", { en: "Roof flashing repair", fr: "Réparation de solins", es: "Reparación de tapajuntas" },
      { en: "Lifted, rusted or split flashing resealed or replaced at the leak point.", fr: "Solins soulevés, rouillés ou fendus rescellés ou remplacés au point de fuite.", es: "Tapajuntas levantados, oxidados o partidos resellados o reemplazados en el punto de fuga." }),
    item("repair", "roof_vents", { en: "Roof vent repair", fr: "Réparation d'évents de toit", es: "Reparación de ventilas de techo" },
      { en: "Cracked or leaking roof vents resealed or replaced.", fr: "Évents de toit fissurés ou qui fuient rescellés ou remplacés.", es: "Ventilas de techo agrietadas o con fugas reselladas o reemplazadas." },
      { unit: "each" }),
    repairMat("slate"),
    item("repair", "soffit_fascia", { en: "Soffit and fascia repair", fr: "Réparation de soffites et de bordures", es: "Reparación de sofito y fascia" },
      { en: "Rotted or damaged soffit and fascia sections cut out and replaced.", fr: "Sections de soffite et de bordure pourries ou abîmées découpées et remplacées.", es: "Secciones de sofito y fascia podridas o dañadas cortadas y reemplazadas." },
      { unit: "linear_ft" }),
    repairMat("solar"),
    otherRow("repair", "shingles"),
    repairMat("vinyl"), repairMat("shake"),
    item("repair", "chimney_cricket", { en: "Chimney cricket or saddle repair", fr: "Réparation de chevalet de cheminée", es: "Reparación de caballete de chimenea" },
      { en: "A leaking cricket behind the chimney reflashed and sealed.", fr: "Chevalet qui fuit derrière la cheminée refait avec solins et scellé.", es: "Caballete con fuga detrás de la chimenea con tapajuntas nuevos y sellado." }),
    item("repair", "gutters", { en: "Gutter repair", fr: "Réparation de gouttières", es: "Reparación de canaletas" },
      { en: "Sagging, leaking or detached gutters re-hung, resealed and re-pitched.", fr: "Gouttières affaissées, qui fuient ou décrochées reposées, rescellées et remises en pente.", es: "Canaletas pandeadas, con fugas o sueltas recolgadas, reselladas y con pendiente corregida." },
      { existing: "gutter_services seed." }),
    item("repair", "insulation", { en: "Attic insulation repair", fr: "Réparation d'isolant de grenier", es: "Reparación de aislamiento de ático" },
      { en: "Wet, compressed or displaced attic insulation removed and replaced.", fr: "Isolant de grenier mouillé, tassé ou déplacé retiré et remplacé.", es: "Aislamiento de ático mojado, compactado o desplazado retirado y reemplazado." },
      { unit: "sqft" }),
    item("repair", "siding", { en: "Siding repair", fr: "Réparation de revêtement extérieur", es: "Reparación de revestimiento" },
      { en: "Damaged siding panels replaced and the wall reflashed.", fr: "Panneaux de revêtement abîmés remplacés et mur refait avec solins.", es: "Paneles de revestimiento dañados reemplazados y la pared con tapajuntas nuevos." },
      { existing: "siding seed." }),
    otherRow("repair", "other"),
    item("repair", "windows", { en: "Window repair", fr: "Réparation de fenêtres", es: "Reparación de ventanas" },
      { en: "Leaking or damaged windows reflashed, resealed or repaired.", fr: "Fenêtres qui fuient ou abîmées refaites avec solins, rescellées ou réparées.", es: "Ventanas con fugas o dañadas con tapajuntas nuevos, reselladas o reparadas." },
      { unit: "each", existing: "doors_windows seed." }),
  ],
};
