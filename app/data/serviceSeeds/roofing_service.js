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

import { L, SHARED, D, T, withTemplates, hdMaterial, withLanguages } from "./_templateLines";
import { HD } from "./_materialCosts";
import { materialRef } from "../materialReference.js";
import { I18N } from "./i18n/roofing_service.js";

// [slug, name{en,fr,es}] — the English is the material alone: the names
// append "roof" themselves, so "Metal roof" here printed "Metal roof roof".
const MAT = {
  asphalt: ["asphalt_shingle", { en: "Asphalt shingle", fr: "Bardeaux d'asphalte", es: "Teja asfáltica" }],
  clay: ["clay_tile", { en: "Clay tile", fr: "Tuiles d'argile", es: "Teja de arcilla" }],
  concrete: ["concrete_tile", { en: "Concrete tile", fr: "Tuiles de béton", es: "Teja de concreto" }],
  metal: ["metal", { en: "Metal", fr: "Toiture métallique", es: "Techo metálico" }],
  other: ["other_materials", { en: "Other-material", fr: "Autre matériau de toiture", es: "Otro material de techo" }],
  flat: ["rolled_flat", { en: "Rolled or flat", fr: "Toit plat ou en rouleau", es: "Techo plano o rollado" }],
  slate: ["slate", { en: "Slate", fr: "Toiture en ardoise", es: "Techo de pizarra" }],
  solar: ["solar_shingle", { en: "Solar shingle", fr: "Bardeaux solaires", es: "Teja solar" }],
  vinyl: ["vinyl", { en: "Vinyl", fr: "Toiture en vinyle", es: "Techo de vinilo" }],
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
    { en: `Damaged or leaking sections of ${/^[aeiou]/.test(n.en.toLowerCase()) ? "an" : "a"} ${n.en.toLowerCase()} roof repaired and sealed.`, fr: `Sections abîmées ou qui fuient d'une toiture (${n.fr.toLowerCase()}) réparées et scellées.`, es: `Secciones dañadas o con fugas de un techo (${n.es.toLowerCase()}) reparadas y selladas.` },
  );
};
const item = (kind, slug, name, description, extra) => base(`fq.roofing_service.${kind}.${slug}`, kind, name, description, extra);
// The source has two repair catch-alls ("shingles" and "other"); the shingle
// one says so, so a company's list never shows the same name twice
// (check-service-seeds section I).
const otherRow = (kind, what) => item(kind, `other${what ? "_" + what : ""}`,
  what === "shingles"
    ? { en: "Other shingle repair — describe what you need", fr: "Autre réparation de bardeaux — décrivez le besoin", es: "Otra reparación de tejas — describa lo que necesita" }
    : { en: `Other ${kind === "install" ? "installation" : kind === "repair" ? "repair" : "roof cleaning"} — describe what you need`, fr: `Autre ${kind === "install" ? "installation" : kind === "repair" ? "réparation" : "nettoyage de toiture"} — décrivez le besoin`, es: `Otra ${kind === "install" ? "instalación" : kind === "repair" ? "reparación" : "limpieza de techo"} — describa lo que necesita` },
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
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    item("inspection", "storm_damage", { en: "Storm and hail damage inspection", fr: "Inspection de dommages de tempête et de grêle", es: "Inspección de daños por tormenta y granizo" },
      { en: "The roof checked slope by slope for wind, hail and impact damage, photographed and written up for the insurance claim.", fr: "Toit vérifié versant par versant pour les dommages de vent, de grêle et d'impact, photographié et documenté pour la réclamation d'assurance.", es: "Techo revisado agua por agua en busca de daños por viento, granizo e impactos, fotografiado y documentado para el reclamo al seguro." }),
    item("inspection", "measure_estimate", { en: "Roof measure and estimate visit", fr: "Visite de mesure et de soumission de toiture", es: "Visita de medición y presupuesto de techo" },
      { en: "The satellite measurement confirmed on site, the deck and ventilation checked and a written price left for the roof.", fr: "Mesure satellite confirmée sur place, platelage et ventilation vérifiés et prix écrit laissé pour la toiture.", es: "Medición satelital confirmada en sitio, cubierta y ventilación revisadas y un precio por escrito para el techo." },
      { durationMinutes: 60, bookable: true }),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the roofing price book's own labour and material figures (tear-off
// and install productivity in lib/pricing/roofLabour.js, shingle and
// underlayment costs read at Home Depot Canada in tradePriceBooks.js) and the
// Roofr catalog study under docs/research/ — items mapped to a measurement
// with a waste % on top. 2026 sell prices: tear-off $85 a square, shingle
// labour $175, architectural shingles $140, standing-seam panels $450 a
// square, ridge cap $5.50 a linear ft, seamless gutters $10.50 installed.
//
// Every per-square and per-linear-foot line carries the satellite report's
// key (lib/measure/roofGeometry.js) and keeps qty 1; the report fills it.
// Waste is the loader's `wastePct` on the material line (10%, the rate
// card's default): shingles by the bundle are keyed to the roof area
// `areaSqft` with a coverage of 33.3 sq ft, so qty = ceil(area × 1.10 ÷ 33.3)
// — a separate "waste line" would count the same bundles twice.
const SQ = "square", LF = "linear_ft";
const TEAR_OFF = () => L.labour(1, SQ, 85, {
  en: ["Tear-off and disposal — per square", "Existing roofing stripped to the deck, nails pulled and the debris loaded for disposal."],
  fr: ["Arrachage et disposition — au carré", "Revêtement existant arraché jusqu'au platelage, clous retirés et débris chargés pour disposition."],
  es: ["Retiro y desecho — por cuadro", "Techo existente retirado hasta la cubierta, clavos sacados y escombros cargados para desecho."],
  it: ["Rimozione e smaltimento — per square", "Copertura esistente rimossa fino al tavolato, chiodi tolti e detriti caricati per lo smaltimento."],
  de: ["Abriss und Entsorgung — pro Square", "Alte Eindeckung bis auf die Schalung entfernt, Nägel gezogen und der Schutt zur Entsorgung verladen."],
  uk: ["Демонтаж і утилізація — за сквер", "Старе покриття знято до настилу, цвяхи вийнято, сміття завантажено на утилізацію."],
  tl: ["Tear-off at pagtapon — kada square", "Tinanggal hanggang deck ang lumang bubong, binunot ang pako at ikinarga ang debris para itapon."],
}, { measurementKey: "squares" });
const SHINGLE_LABOUR = () => L.labour(1, SQ, 175, {
  en: ["Shingle installation — per square", "Underlayment, starter and architectural shingles installed to the manufacturer's nailing pattern."],
  fr: ["Pose de bardeaux — au carré", "Sous-couche, bande de départ et bardeaux architecturaux posés selon le clouage du fabricant."],
  es: ["Instalación de tejas — por cuadro", "Base, inicio y tejas arquitectónicas instaladas con el patrón de clavado del fabricante."],
  it: ["Posa tegole bituminose — per square", "Sottomanto, fila di partenza e tegole architettoniche posati secondo lo schema di chiodatura del produttore."],
  de: ["Schindeln verlegen — pro Square", "Unterdeckbahn, Startreihe und Architekturschindeln nach Nagelschema des Herstellers verlegt."],
  uk: ["Укладання гонту — за сквер", "Підкладку, стартову смугу та архітектурний гонт укладено за схемою цвяхування виробника."],
  tl: ["Pagkabit ng shingles — kada square", "Ikinabit ang underlayment, starter at architectural shingles ayon sa nailing pattern ng manufacturer."],
}, { measurementKey: "squares" });
const SHINGLES = () => hdMaterial(HD.shingles_bundle, {
  en: ["Architectural shingles — per bundle", "Laminated architectural shingles; three bundles make a square."],
  fr: ["Bardeaux architecturaux — le paquet", "Bardeaux architecturaux laminés; trois paquets font un carré."],
  es: ["Tejas arquitectónicas — por paquete", "Tejas arquitectónicas laminadas; tres paquetes hacen un cuadro."],
  it: ["Tegole architettoniche — per pacco", "Tegole bituminose architettoniche laminate; tre pacchi fanno uno square."],
  de: ["Architekturschindeln — pro Bündel", "Laminierte Architekturschindeln; drei Bündel ergeben ein Square."],
  uk: ["Архітектурний гонт — за пачку", "Ламінований архітектурний гонт; три пачки — один сквер."],
  tl: ["Architectural shingles — kada bundle", "Laminated architectural shingles; tatlong bundle ang isang square."],
}, { measurementKey: "areaSqft", wastePct: 10 });
const UNDERLAYMENT = () => hdMaterial(HD.roof_underlayment_roll, {
  en: ["Synthetic underlayment — per roll", "1,000 sq ft roll of synthetic underlayment; one roll covers ten squares."],
  fr: ["Sous-couche synthétique — le rouleau", "Rouleau de 1 000 pi² de sous-couche synthétique; un rouleau couvre dix carrés."],
  es: ["Base sintética — por rollo", "Rollo de 1,000 pies² de base sintética; un rollo cubre diez cuadros."],
  it: ["Sottomanto sintetico — per rotolo", "Rotolo da 1.000 piedi quadri di sottomanto sintetico; un rotolo copre dieci square."],
  de: ["Synthetische Unterdeckbahn — pro Rolle", "Rolle mit 1.000 sq ft synthetischer Unterdeckbahn; eine Rolle deckt zehn Squares."],
  uk: ["Синтетична підкладка — за рулон", "Рулон синтетичної підкладки 1000 кв. футів; рулон покриває десять скверів."],
  tl: ["Synthetic underlayment — kada rolyo", "1,000 sq ft na rolyo ng synthetic underlayment; ang isang rolyo ay sampung square."],
}, { measurementKey: "areaSqft", wastePct: 10 });

const TEMPLATES = {
  // ── Installation ──
  "fq.roofing_service.replace.asphalt_shingle": T("installation", {
    it: ["Rifacimento tetto in tegole bituminose", "Vecchia copertura rimossa, tavolato controllato e nuovo tetto in tegole bituminose posato con sottomanto, scossaline e colmo."],
    de: ["Dachsanierung mit Bitumenschindeln", "Alte Eindeckung abgerissen, Schalung geprüft und ein neues Schindeldach mit Unterdeckung, Blechen und First verlegt."],
    uk: ["Заміна покрівлі з бітумного гонту", "Старе покриття знято, настил перевірено, новий дах з бітумного гонту укладено з підкладкою, відливами та гребенем."],
    tl: ["Palit ng asphalt shingle na bubong", "Tinanggal ang lumang bubong, chineck ang deck at ikinabit ang bagong asphalt shingle na may underlayment, flashing at ridge."],
  }, [
    TEAR_OFF(), SHINGLE_LABOUR(),
    L.labour(1, LF, 6, {
      en: ["Valley flashing — per linear ft", "Ice-and-water membrane and metal valley installed along every valley."],
      fr: ["Solin de noue — au pi lin.", "Membrane pare-glace et noue métallique posées le long de chaque noue."],
      es: ["Tapajuntas de limahoya — por pie lineal", "Membrana contra hielo y agua y limahoya metálica instaladas en cada limahoya."],
      it: ["Scossalina di compluvio — al piede lineare", "Membrana anti-ghiaccio e compluvio metallico posati lungo ogni compluvio."],
      de: ["Kehlblech — pro lfd. Fuß", "Eis- und Wassersperrbahn und Metallkehle in jeder Kehle verlegt."],
      uk: ["Ендова — за пог. фут", "Протильодову мембрану та металеву ендову укладено вздовж кожної ендови."],
      tl: ["Valley flashing — kada linear ft", "Ice-and-water membrane at metal valley na ikinabit sa bawat valley."],
    }, { measurementKey: "valleyFt" }),
    SHINGLES(),
    L.material(1, LF, 5.5, {
      en: ["Ridge cap shingles — per linear ft", "Pre-cut ridge cap shingles and ridge vent where the attic needs it."],
      fr: ["Bardeaux de faîte — au pi lin.", "Bardeaux de faîte précoupés et évent de faîte là où le grenier en a besoin."],
      es: ["Tejas de cumbrera — por pie lineal", "Tejas de cumbrera precortadas y ventila de cumbrera donde el ático la necesita."],
      it: ["Tegole di colmo — al piede lineare", "Tegole di colmo pretagliate e aeratore di colmo dove il sottotetto lo richiede."],
      de: ["Firstschindeln — pro lfd. Fuß", "Vorgeschnittene Firstschindeln und Firstlüfter, wo der Dachboden ihn braucht."],
      uk: ["Гонт для гребеня — за пог. фут", "Нарізаний гонт для гребеня та гребеневий аератор, де потрібна вентиляція горища."],
      tl: ["Ridge cap shingles — kada linear ft", "Pre-cut ridge cap shingles at ridge vent kung kailangan ng attic."],
    }, { measurementKey: "ridgeFt" }),
  ], D.newCustomer("fixed", 250)),

  "fq.roofing_service.install.asphalt_shingle": T("installation", {
    it: ["Nuovo tetto in tegole bituminose", "Nuovo tetto in tegole bituminose posato su tavolato preparato con sottomanto, scossaline e colmo."],
    de: ["Neues Dach mit Bitumenschindeln", "Neues Schindeldach auf vorbereiteter Schalung mit Unterdeckung, Blechen und First verlegt."],
    uk: ["Новий дах з бітумного гонту", "Новий дах з бітумного гонту укладено на підготовлений настил з підкладкою, відливами та гребенем."],
    tl: ["Bagong asphalt shingle na bubong", "Bagong asphalt shingle na bubong sa inihandang deck na may underlayment, flashing at ridge."],
  }, [
    SHINGLE_LABOUR(),
    L.labour(1, LF, 2.5, {
      en: ["Drip edge at the eaves — per linear ft", "Drip edge fastened along every eave under the starter course."],
      fr: ["Larmier aux avant-toits — au pi lin.", "Larmier fixé le long de chaque avant-toit sous la bande de départ."],
      es: ["Gotero en aleros — por pie lineal", "Gotero fijado en cada alero bajo la hilera de inicio."],
      it: ["Gocciolatoio in gronda — al piede lineare", "Gocciolatoio fissato lungo ogni gronda sotto la fila di partenza."],
      de: ["Tropfkante an der Traufe — pro lfd. Fuß", "Tropfkante an jeder Traufe unter der Startreihe befestigt."],
      uk: ["Капельник на звисах — за пог. фут", "Капельник закріплено вздовж кожного карнизного звису під стартовим рядом."],
      tl: ["Drip edge sa eaves — kada linear ft", "Ikinabit ang drip edge sa bawat eave sa ilalim ng starter course."],
    }, { measurementKey: "eaveFt" }),
    L.labour(1, LF, 2.5, {
      en: ["Drip edge at the rakes — per linear ft", "Drip edge fastened up every rake over the underlayment."],
      fr: ["Larmier aux rives — au pi lin.", "Larmier fixé sur chaque rive par-dessus la sous-couche."],
      es: ["Gotero en hastiales — por pie lineal", "Gotero fijado en cada hastial sobre la base."],
      it: ["Gocciolatoio sui bordi laterali — al piede lineare", "Gocciolatoio fissato su ogni bordo laterale sopra il sottomanto."],
      de: ["Tropfkante am Ortgang — pro lfd. Fuß", "Tropfkante an jedem Ortgang über der Unterdeckung befestigt."],
      uk: ["Капельник на фронтонах — за пог. фут", "Капельник закріплено вздовж кожного фронтонного звису поверх підкладки."],
      tl: ["Drip edge sa rakes — kada linear ft", "Ikinabit ang drip edge sa bawat rake sa ibabaw ng underlayment."],
    }, { measurementKey: "rakeFt" }),
    SHINGLES(), UNDERLAYMENT(),
  ], null),

  "fq.roofing_service.replace.metal": T("installation", {
    it: ["Rifacimento tetto in metallo", "Vecchia copertura rimossa, tavolato controllato e nuovo tetto in lamiera aggraffata posato con sottomanto, scossaline e colmo."],
    de: ["Dachsanierung mit Metalldach", "Alte Eindeckung abgerissen, Schalung geprüft und ein neues Stehfalzdach mit Unterdeckung, Blechen und First verlegt."],
    uk: ["Заміна покрівлі на металеву", "Старе покриття знято, настил перевірено, новий фальцевий дах укладено з підкладкою, відливами та гребенем."],
    tl: ["Palit ng bubong na metal", "Tinanggal ang lumang bubong, chineck ang deck at ikinabit ang bagong standing-seam na metal na may underlayment, flashing at ridge."],
  }, [
    TEAR_OFF(),
    L.labour(1, SQ, 325, {
      en: ["Metal panel installation — per square", "Synthetic underlayment and standing-seam panels installed with concealed clips."],
      fr: ["Pose de panneaux métalliques — au carré", "Sous-couche synthétique et panneaux à joint debout posés avec agrafes dissimulées."],
      es: ["Instalación de paneles metálicos — por cuadro", "Base sintética y paneles de junta alzada instalados con clips ocultos."],
      it: ["Posa pannelli metallici — per square", "Sottomanto sintetico e pannelli aggraffati posati con clip nascoste."],
      de: ["Metallpaneele verlegen — pro Square", "Synthetische Unterdeckung und Stehfalzpaneele mit verdeckten Haften verlegt."],
      uk: ["Монтаж металевих панелей — за сквер", "Синтетичну підкладку та фальцеві панелі змонтовано на прихованих кляймерах."],
      tl: ["Pagkabit ng metal panel — kada square", "Ikinabit ang synthetic underlayment at standing-seam panel gamit ang nakatagong clip."],
    }, { measurementKey: "squares" }),
    L.labour(1, LF, 7, {
      en: ["Hip trim installation — per linear ft", "Hip closures and trim fitted and sealed along every hip."],
      fr: ["Pose des arêtiers — au pi lin.", "Closoirs et moulures d'arêtier posés et scellés le long de chaque arêtier."],
      es: ["Instalación de limatesas — por pie lineal", "Cierres y remates de limatesa colocados y sellados en cada limatesa."],
      it: ["Posa scossaline di displuvio — al piede lineare", "Chiusure e scossaline di displuvio posate e sigillate lungo ogni displuvio."],
      de: ["Gratabdeckung montieren — pro lfd. Fuß", "Gratabschlüsse und -bleche an jedem Grat montiert und abgedichtet."],
      uk: ["Монтаж планок ребер — за пог. фут", "Ущільнювачі та планки ребер встановлено й загерметизовано вздовж кожного ребра."],
      tl: ["Pagkabit ng hip trim — kada linear ft", "Ikinabit at sinelyuhan ang hip closure at trim sa bawat hip."],
    }, { measurementKey: "hipFt" }),
    L.material(1, SQ, 450, {
      en: ["Standing-seam panels — per square", "24-gauge painted steel standing-seam panels, 16 in wide."],
      fr: ["Panneaux à joint debout — au carré", "Panneaux d'acier peint calibre 24 à joint debout, 16 po de large."],
      es: ["Paneles de junta alzada — por cuadro", "Paneles de acero pintado calibre 24 de junta alzada, 16 pulg de ancho."],
      it: ["Pannelli aggraffati — per square", "Pannelli in acciaio verniciato calibro 24 aggraffati, larghi 16 pollici."],
      de: ["Stehfalzpaneele — pro Square", "Stehfalzpaneele aus beschichtetem Stahl, 24 Gauge, 16 Zoll breit."],
      uk: ["Фальцеві панелі — за сквер", "Фальцеві панелі з фарбованої сталі калібру 24, ширина 16 дюймів."],
      tl: ["Standing-seam panels — kada square", "24-gauge painted steel standing-seam panel, 16 in ang lapad."],
    }, { measurementKey: "squares", wastePct: 10 }),
    L.material(1, LF, 9, {
      en: ["Ridge cap and closures — per linear ft", "Vented ridge cap, foam closures and fasteners."],
      fr: ["Faîtière et closoirs — au pi lin.", "Faîtière ventilée, closoirs en mousse et fixations."],
      es: ["Cumbrera y cierres — por pie lineal", "Cumbrera ventilada, cierres de espuma y fijaciones."],
      it: ["Colmo e chiusure — al piede lineare", "Colmo ventilato, chiusure in schiuma e fissaggi."],
      de: ["Firstkappe und Abschlüsse — pro lfd. Fuß", "Belüftete Firstkappe, Schaumstoffabschlüsse und Befestigungen."],
      uk: ["Гребінь і ущільнювачі — за пог. фут", "Вентильований гребінь, пінні ущільнювачі та кріплення."],
      tl: ["Ridge cap at closure — kada linear ft", "Vented ridge cap, foam closure at fastener."],
    }, { measurementKey: "ridgeFt" }),
  ], D.newCustomer("fixed", 400)),

  "fq.roofing_service.components.gutters": T("installation", {
    it: ["Installazione grondaie", "Grondaie senza giunture e pluviali posati lungo le gronde."],
    de: ["Dachrinnenmontage", "Nahtlose Dachrinnen und Fallrohre entlang der Traufen montiert."],
    uk: ["Монтаж ринв", "Безшовні ринви та водостічні труби змонтовано вздовж карнизів."],
    tl: ["Pagkabit ng gutter", "Seamless gutter at downspout na ikinabit sa mga eave."],
  }, [
    L.labour(1, LF, 5, {
      en: ["Gutter installation — per linear ft", "Seamless gutter formed on site, hung on hidden hangers and pitched to the downspouts."],
      fr: ["Pose de gouttières — au pi lin.", "Gouttière sans joint formée sur place, suspendue sur crochets dissimulés et en pente vers les descentes."],
      es: ["Instalación de canaletas — por pie lineal", "Canaleta sin costura formada en sitio, colgada con ganchos ocultos y con pendiente hacia las bajantes."],
      it: ["Posa grondaie — al piede lineare", "Grondaia senza giunture profilata sul posto, appesa su staffe nascoste e in pendenza verso i pluviali."],
      de: ["Rinnenmontage — pro lfd. Fuß", "Nahtlose Rinne vor Ort geformt, an verdeckten Haltern aufgehängt und mit Gefälle zu den Fallrohren."],
      uk: ["Монтаж ринв — за пог. фут", "Безшовну ринву сформовано на місці, повішено на приховані гаки з ухилом до труб."],
      tl: ["Pagkabit ng gutter — kada linear ft", "Seamless gutter na hinubog sa lugar, isinabit sa hidden hanger at may slope papunta sa downspout."],
    }, { measurementKey: "eaveFt" }),
    hdMaterial(HD.gutter_5k_10, {
      en: ["Aluminium gutter — per 10 ft length", "5 in K-style aluminium gutter; hangers, end caps and outlets with it."],
      fr: ["Gouttière d'aluminium — la longueur de 10 pi", "Gouttière en aluminium style K de 5 po; crochets, embouts et sorties avec."],
      es: ["Canaleta de aluminio — por tramo de 10 pies", "Canaleta de aluminio estilo K de 5 pulg; ganchos, tapas y salidas incluidos."],
      it: ["Grondaia in alluminio — per barra da 10 piedi", "Grondaia in alluminio stile K da 5 pollici; staffe, testate e bocchettoni inclusi."],
      de: ["Aluminiumrinne — pro 10-Fuß-Länge", "5-Zoll-K-Profil-Rinne aus Aluminium; Halter, Endkappen und Stutzen dazu."],
      uk: ["Алюмінієва ринва — за 10-футову довжину", "Ринва K-профілю 5 дюймів з алюмінію; гаки, заглушки й воронки в комплекті."],
      tl: ["Aluminum gutter — kada 10 ft na haba", "5 in K-style na aluminum gutter; kasama ang hanger, end cap at outlet."],
    }, { measurementKey: "eaveFt" }),
  ], null),

  // ── Repair ──
  "fq.roofing_service.repair.missing_shingles": T("repair", {
    it: ["Sostituzione tegole mancanti", "Tegole strappate dal vento o mancanti sostituite e le linguette vicine risigillate."],
    de: ["Fehlende Schindeln ersetzen", "Vom Wind abgerissene oder fehlende Schindeln ersetzt und die benachbarten Lappen neu verklebt."],
    uk: ["Заміна відсутнього гонту", "Зірваний вітром або відсутній гонт замінено, сусідні пелюстки заново проклеєно."],
    tl: ["Palit ng nawawalang shingles", "Pinalitan ang nilipad o nawawalang shingles at sinelyuhan ulit ang katabing tab."],
  }, [
    SHARED.serviceCall(125),
    L.labour(1, "hour", 110, {
      en: ["Roof repair labour", "Damaged shingles lifted out, new ones woven in and every tab sealed, by the hour."],
      fr: ["Main-d'œuvre — réparation de toiture", "Bardeaux abîmés retirés, nouveaux insérés et chaque languette scellée, à l'heure."],
      es: ["Mano de obra — reparación de techo", "Tejas dañadas retiradas, nuevas entretejidas y cada pestaña sellada, por hora."],
      it: ["Manodopera — riparazione tetto", "Tegole danneggiate tolte, nuove inserite e ogni linguetta sigillata, a ore."],
      de: ["Arbeit — Dachreparatur", "Beschädigte Schindeln herausgenommen, neue eingewoben und jeder Lappen verklebt, nach Stunden."],
      uk: ["Робота — ремонт покрівлі", "Пошкоджений гонт знято, новий вплетено, кожну пелюстку проклеєно, погодинно."],
      tl: ["Labor — pag-ayos ng bubong", "Tinanggal ang sirang shingles, isiningit ang bago at sinelyuhan ang bawat tab, kada oras."],
    }),
    L.material(1, "each", 55, {
      en: ["Matching shingles and sealant", "A bundle of the closest-matching shingles, nails and roofing sealant."],
      fr: ["Bardeaux assortis et scellant", "Un paquet de bardeaux les plus assortis possible, clous et scellant à toiture."],
      es: ["Tejas a juego y sellador", "Un paquete de las tejas más parecidas, clavos y sellador para techo."],
      it: ["Tegole abbinate e sigillante", "Un pacco delle tegole più simili, chiodi e sigillante per coperture."],
      de: ["Passende Schindeln und Dichtmasse", "Ein Bündel möglichst passender Schindeln, Nägel und Dachdichtmasse."],
      uk: ["Підібраний гонт і герметик", "Пачка максимально схожого гонту, цвяхи та покрівельний герметик."],
      tl: ["Katernong shingles at sealant", "Isang bundle ng pinakakamukhang shingles, pako at roofing sealant."],
    }),
  ], null),

  "fq.roofing_service.repair.flashing": T("repair", {
    it: ["Riparazione scossaline", "Scossaline sollevate, arrugginite o spaccate risigillate o sostituite nel punto della perdita."],
    de: ["Anschlussbleche reparieren", "Gelöste, rostige oder gerissene Bleche an der Leckstelle neu abgedichtet oder ersetzt."],
    uk: ["Ремонт відливів і примикань", "Підняті, іржаві або тріснуті примикання загерметизовано або замінено в місці протікання."],
    tl: ["Pag-ayos ng flashing", "Sinelyuhan o pinalitan ang umangat, kinakalawang o biyak na flashing sa tumutulong bahagi."],
  }, [
    SHARED.serviceCall(125),
    L.labour(1, LF, 12, {
      en: ["Step flashing replacement — per linear ft", "Shingles lifted along the wall, the old step flashing out and new pieces woven in with counter-flashing sealed."],
      fr: ["Remplacement des solins en escalier — au pi lin.", "Bardeaux soulevés le long du mur, anciens solins retirés et nouveaux insérés avec contre-solin scellé."],
      es: ["Reemplazo de tapajuntas escalonado — por pie lineal", "Tejas levantadas junto al muro, tapajuntas viejo retirado y piezas nuevas entretejidas con contratapajuntas sellado."],
      it: ["Sostituzione scossaline a gradini — al piede lineare", "Tegole sollevate lungo il muro, vecchie scossaline tolte e nuove inserite con controscossalina sigillata."],
      de: ["Stufenbleche ersetzen — pro lfd. Fuß", "Schindeln an der Wand angehoben, alte Stufenbleche raus, neue eingewoben und Überhangblech abgedichtet."],
      uk: ["Заміна ступінчастих примикань — за пог. фут", "Гонт уздовж стіни піднято, старі примикання знято, нові вплетено, контрпримикання загерметизовано."],
      tl: ["Palit ng step flashing — kada linear ft", "Inangat ang shingles sa tabi ng pader, tinanggal ang lumang step flashing at isiningit ang bago na may selyadong counter-flashing."],
    }, { measurementKey: "linearFt" }),
    L.material(1, LF, 3, {
      en: ["Step flashing and sealant — per linear ft", "Pre-bent aluminium step flashing, counter-flashing and polyurethane sealant."],
      fr: ["Solins en escalier et scellant — au pi lin.", "Solins en aluminium prépliés, contre-solin et scellant polyuréthane."],
      es: ["Tapajuntas escalonado y sellador — por pie lineal", "Tapajuntas de aluminio predoblado, contratapajuntas y sellador de poliuretano."],
      it: ["Scossaline a gradini e sigillante — al piede lineare", "Scossaline in alluminio prepiegate, controscossalina e sigillante poliuretanico."],
      de: ["Stufenbleche und Dichtmasse — pro lfd. Fuß", "Vorgekantete Alu-Stufenbleche, Überhangblech und PU-Dichtmasse."],
      uk: ["Ступінчасті примикання та герметик — за пог. фут", "Загнуті алюмінієві примикання, контрпримикання та поліуретановий герметик."],
      tl: ["Step flashing at sealant — kada linear ft", "Pre-bent na aluminum step flashing, counter-flashing at polyurethane sealant."],
    }, { measurementKey: "linearFt" }),
  ], null),

  "fq.roofing_service.repair.roof_vents": T("repair", {
    it: ["Riparazione aeratori del tetto", "Aeratori del tetto crepati o che perdono risigillati o sostituiti."],
    de: ["Dachlüfter reparieren", "Gerissene oder undichte Dachlüfter neu abgedichtet oder ersetzt."],
    uk: ["Ремонт покрівельних аераторів", "Тріснуті або протікаючі аератори загерметизовано або замінено."],
    tl: ["Pag-ayos ng roof vent", "Sinelyuhan o pinalitan ang basag o tumutulong roof vent."],
  }, [
    L.labour(1, "each", 120, {
      en: ["Vent replacement labour — per vent", "The old vent out, a new one flashed into the shingle courses and sealed."],
      fr: ["Main-d'œuvre — remplacement d'évent, l'unité", "Ancien évent retiré, nouvel évent intégré aux rangs de bardeaux et scellé."],
      es: ["Mano de obra — reemplazo de ventila, por pieza", "Ventila vieja retirada, nueva integrada en las hileras de tejas y sellada."],
      it: ["Manodopera — sostituzione aeratore, cadauno", "Vecchio aeratore tolto, nuovo inserito tra le file di tegole e sigillato."],
      de: ["Arbeit — Lüfter tauschen, pro Stück", "Alter Lüfter raus, neuer in die Schindelreihen eingebunden und abgedichtet."],
      uk: ["Робота — заміна аератора, за штуку", "Старий аератор знято, новий вплетено в ряди гонту й загерметизовано."],
      tl: ["Labor — palit ng vent, kada isa", "Tinanggal ang lumang vent, isiningit ang bago sa shingle courses at sinelyuhan."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 45, {
      en: ["Roof vent — per vent", "Low-profile static roof vent with nails and sealant."],
      fr: ["Évent de toit — l'unité", "Évent statique à profil bas avec clous et scellant."],
      es: ["Ventila de techo — por pieza", "Ventila estática de perfil bajo con clavos y sellador."],
      it: ["Aeratore — cadauno", "Aeratore statico a basso profilo con chiodi e sigillante."],
      de: ["Dachlüfter — pro Stück", "Flacher statischer Dachlüfter mit Nägeln und Dichtmasse."],
      uk: ["Аератор — за штуку", "Низькопрофільний статичний аератор із цвяхами та герметиком."],
      tl: ["Roof vent — kada isa", "Low-profile na static roof vent na may pako at sealant."],
    }, { measurementKey: "each" }),
  ], null),

  // ── Inspection ──
  "fq.roofing_service.inspection.expert_inspection": T("inspection", {
    it: ["Ispezione del tetto", "Tetto percorso o ispezionato con drone, ogni penetrazione e scossalina controllata, e relazione scritta con foto."],
    de: ["Dachinspektion", "Dach begangen oder per Drohne erfasst, jede Durchdringung und jedes Blech geprüft, schriftlicher Bericht mit Fotos."],
    uk: ["Огляд покрівлі", "Дах обійдено або обстежено дроном, кожен прохід і примикання перевірено, письмовий звіт із фото."],
    tl: ["Inspeksyon ng bubong", "Nilakaran o dinrone ang bubong, chineck ang bawat penetration at flashing, at may nakasulat na report na may litrato."],
  }, [
    L.labour(1, "flat", 225, {
      en: ["Roof inspection", "Every slope, penetration, flashing and the attic ventilation checked."],
      fr: ["Inspection de toiture", "Chaque versant, percement, solin et la ventilation du grenier vérifiés."],
      es: ["Inspección de techo", "Cada agua, penetración, tapajuntas y la ventilación del ático revisados."],
      it: ["Ispezione del tetto", "Ogni falda, penetrazione, scossalina e la ventilazione del sottotetto controllate."],
      de: ["Dachinspektion", "Jede Dachfläche, Durchdringung, jedes Blech und die Dachbodenlüftung geprüft."],
      uk: ["Огляд покрівлі", "Кожен схил, прохід, примикання та вентиляцію горища перевірено."],
      tl: ["Inspeksyon ng bubong", "Chineck ang bawat slope, penetration, flashing at bentilasyon ng attic."],
    }),
    SHARED.report(75),
  ], null),

  "fq.roofing_service.inspection.storm_damage": T("inspection", {
    it: ["Ispezione danni da tempesta e grandine", "Tetto controllato falda per falda per danni da vento, grandine e impatti, fotografato e documentato per il sinistro."],
    de: ["Sturm- und Hagelschadeninspektion", "Dach Fläche für Fläche auf Wind-, Hagel- und Einschlagschäden geprüft, fotografiert und für die Versicherung dokumentiert."],
    uk: ["Огляд пошкоджень від бурі та граду", "Дах перевірено схил за схилом на пошкодження вітром, градом і ударами, сфотографовано й задокументовано для страховки."],
    tl: ["Inspeksyon ng pinsala ng bagyo at yelo", "Chineck ang bubong slope-slope para sa pinsala ng hangin, yelo at tama, kinunan ng litrato at dinokumento para sa insurance claim."],
  }, [
    L.labour(1, "flat", 250, {
      en: ["Damage inspection and test squares", "Test squares marked on each slope, hits counted and photographed for the adjuster."],
      fr: ["Inspection des dommages et carrés d'essai", "Carrés d'essai marqués sur chaque versant, impacts comptés et photographiés pour l'expert."],
      es: ["Inspección de daños y cuadros de prueba", "Cuadros de prueba marcados en cada agua, impactos contados y fotografiados para el ajustador."],
      it: ["Ispezione danni e quadrati di prova", "Quadrati di prova segnati su ogni falda, impatti contati e fotografati per il perito."],
      de: ["Schadensinspektion und Testflächen", "Testflächen auf jeder Dachfläche markiert, Einschläge gezählt und für den Gutachter fotografiert."],
      uk: ["Огляд пошкоджень і тестові квадрати", "Тестові квадрати позначено на кожному схилі, удари пораховано й сфотографовано для оцінювача."],
      tl: ["Inspeksyon ng pinsala at test squares", "Minarkahan ang test square sa bawat slope, binilang at kinunan ng litrato ang tama para sa adjuster."],
    }),
    SHARED.report(100),
  ], null),

  "fq.roofing_service.inspection.measure_estimate": T("inspection", {
    it: ["Sopralluogo di misura e preventivo del tetto", "Misura satellitare confermata sul posto, tavolato e ventilazione controllati e prezzo scritto lasciato."],
    de: ["Aufmaß- und Angebotstermin fürs Dach", "Satellitenaufmaß vor Ort bestätigt, Schalung und Lüftung geprüft und ein schriftlicher Preis hinterlassen."],
    uk: ["Візит для заміру та кошторису даху", "Супутниковий замір підтверджено на місці, настил і вентиляцію перевірено, залишено письмову ціну."],
    tl: ["Visit para sukatin at i-estimate ang bubong", "Kinumpirma sa lugar ang satellite measurement, chineck ang deck at bentilasyon at iniwan ang nakasulat na presyo."],
  }, [
    L.labour(1, "flat", 0, {
      en: ["Roof measure and estimate", "The satellite report checked against the roof; free with a signed quote."],
      fr: ["Mesure et soumission de toiture", "Rapport satellite vérifié sur le toit; gratuit avec une soumission signée."],
      es: ["Medición y presupuesto de techo", "Informe satelital verificado en el techo; gratis con un presupuesto firmado."],
      it: ["Misura e preventivo del tetto", "Rapporto satellitare verificato sul tetto; gratuito con preventivo firmato."],
      de: ["Dachaufmaß und Angebot", "Satellitenbericht am Dach geprüft; kostenlos bei unterschriebenem Angebot."],
      uk: ["Замір і кошторис даху", "Супутниковий звіт звірено з дахом; безкоштовно за підписаного кошторису."],
      tl: ["Sukat at estimate ng bubong", "Chineck ang satellite report laban sa bubong; libre kapag pumirma sa quote."],
    }, { cost: 0 }),
    SHARED.serviceCall(75),
  ], null),

  // ── Maintenance ──
  "fq.roofing_service.cleaning.roof_cleaning": T("maintenance", {
    it: ["Pulizia del tetto", "Muschio, alghe e detriti rimossi dal tetto con un lavaggio a bassa pressione che non solleva le tegole."],
    de: ["Dachreinigung", "Moos, Algen und Schmutz mit einer Niederdruckwäsche vom Dach entfernt, ohne die Schindeln anzuheben."],
    uk: ["Чищення даху", "Мох, водорості й сміття видалено з даху мийкою низького тиску, що не піднімає гонт."],
    tl: ["Paglilinis ng bubong", "Tinanggal ang lumot, algae at dumi sa bubong gamit ang low-pressure wash na hindi umaangat ang shingles."],
  }, [
    L.labour(1, SQ, 35, {
      en: ["Soft-wash roof cleaning — per square", "Algaecide applied, left to dwell and rinsed at low pressure."],
      fr: ["Nettoyage basse pression — au carré", "Algicide appliqué, laissé agir et rincé à basse pression."],
      es: ["Lavado suave del techo — por cuadro", "Alguicida aplicado, dejado actuar y enjuagado a baja presión."],
      it: ["Lavaggio a bassa pressione — per square", "Alghicida applicato, lasciato agire e risciacquato a bassa pressione."],
      de: ["Sanfte Dachwäsche — pro Square", "Algizid aufgetragen, einwirken lassen und mit Niederdruck abgespült."],
      uk: ["М'яке миття даху — за сквер", "Альгіцид нанесено, витримано й змито низьким тиском."],
      tl: ["Soft-wash ng bubong — kada square", "Nilagyan ng algaecide, pinaupo at hinugasan sa mababang pressure."],
    }, { measurementKey: "squares" }),
    L.material(1, SQ, 6, {
      en: ["Roof wash solution — per square", "Sodium hypochlorite mix with surfactant."],
      fr: ["Solution de lavage — au carré", "Mélange d'hypochlorite de sodium et de surfactant."],
      es: ["Solución de lavado — por cuadro", "Mezcla de hipoclorito de sodio con surfactante."],
      it: ["Soluzione di lavaggio — per square", "Miscela di ipoclorito di sodio e tensioattivo."],
      de: ["Waschlösung — pro Square", "Natriumhypochlorit-Mischung mit Tensid."],
      uk: ["Мийний розчин — за сквер", "Суміш гіпохлориту натрію з ПАР."],
      tl: ["Roof wash solution — kada square", "Halo ng sodium hypochlorite at surfactant."],
    }, { measurementKey: "squares" }),
  ], D.seasonal("percent", 10)),

  "fq.roofing_service.cleaning.gutter_clean_out": T("maintenance", {
    it: ["Pulizia grondaie", "Grondaie e pluviali liberati e sciacquati così che l'acqua lasci il tetto."],
    de: ["Dachrinnenreinigung", "Rinnen und Fallrohre freigemacht und gespült, damit das Wasser vom Dach abläuft."],
    uk: ["Чищення ринв", "Ринви та труби прочищено й промито, щоб вода сходила з даху."],
    tl: ["Paglilinis ng gutter", "Nilinis at binuhusan ang gutter at downspout para dumaloy ang tubig palabas ng bubong."],
  }, [
    L.labour(1, LF, 1.5, {
      en: ["Gutter clean-out — per linear ft", "Gutters scooped and flushed and every downspout cleared."],
      fr: ["Nettoyage de gouttières — au pi lin.", "Gouttières vidées et rincées, chaque descente dégagée."],
      es: ["Limpieza de canaletas — por pie lineal", "Canaletas vaciadas y enjuagadas, cada bajante destapada."],
      it: ["Pulizia grondaie — al piede lineare", "Grondaie svuotate e sciacquate, ogni pluviale liberato."],
      de: ["Rinnenreinigung — pro lfd. Fuß", "Rinnen ausgeräumt und gespült, jedes Fallrohr freigemacht."],
      uk: ["Чищення ринв — за пог. фут", "Ринви вичищено й промито, кожну трубу прочищено."],
      tl: ["Paglilinis ng gutter — kada linear ft", "Kinuha ang dumi at binuhusan ang gutter, nilinis ang bawat downspout."],
    }, { measurementKey: "eaveFt" }),
    SHARED.serviceCall(75),
  ], D.seasonal("fixed", 20)),

  "fq.roofing_service.components.roof_treatment": T("maintenance", {
    it: ["Trattamento del tetto", "Trattamento protettivo o antimuschio applicato sulla superficie del tetto."],
    de: ["Dachbehandlung", "Schutz- oder Antimoosbehandlung auf die Dachfläche aufgetragen."],
    uk: ["Обробка покрівлі", "Захисну або протимохову обробку нанесено на поверхню даху."],
    tl: ["Treatment ng bubong", "Protective o anti-lumot na treatment na inilagay sa ibabaw ng bubong."],
  }, [
    L.labour(1, SQ, 25, {
      en: ["Treatment application — per square", "Moss inhibitor or protective coating sprayed evenly over every slope."],
      fr: ["Application du traitement — au carré", "Inhibiteur de mousse ou revêtement protecteur pulvérisé uniformément sur chaque versant."],
      es: ["Aplicación del tratamiento — por cuadro", "Inhibidor de musgo o recubrimiento protector rociado de forma pareja en cada agua."],
      it: ["Applicazione del trattamento — per square", "Antimuschio o rivestimento protettivo spruzzato in modo uniforme su ogni falda."],
      de: ["Behandlung auftragen — pro Square", "Moosschutz oder Schutzbeschichtung gleichmäßig auf jede Dachfläche gesprüht."],
      uk: ["Нанесення обробки — за сквер", "Засіб від моху або захисне покриття рівномірно розпилено на кожен схил."],
      tl: ["Paglagay ng treatment — kada square", "Pantay na ini-spray ang moss inhibitor o protective coating sa bawat slope."],
    }, { measurementKey: "squares" }),
    L.material(1, SQ, 18, {
      en: ["Moss inhibitor — per square", "Zinc-based moss and algae inhibitor."],
      fr: ["Inhibiteur de mousse — au carré", "Inhibiteur de mousse et d'algues à base de zinc."],
      es: ["Inhibidor de musgo — por cuadro", "Inhibidor de musgo y algas a base de zinc."],
      it: ["Antimuschio — per square", "Inibitore di muschio e alghe a base di zinco."],
      de: ["Moosschutz — pro Square", "Moos- und Algenschutz auf Zinkbasis."],
      uk: ["Засіб від моху — за сквер", "Засіб від моху та водоростей на основі цинку."],
      tl: ["Moss inhibitor — kada square", "Zinc-based na pampigil sa lumot at algae."],
    }, { measurementKey: "squares" }),
  ], null),
};

// ── Templates for the rest of the list (2026-09-25) ──────────────────────────
//
// The quote builder adds a service WITH its template lines, so the roofing
// rows without one landed as a bare line. These follow the captured template
// shape — a call-out, the labour, the material — at the 2026 figures above:
// roof repair labour $110–150 an hour (tile, slate and solar dearer than
// asphalt), a $125 roofer's call-out. Rows without a benchmark take their
// preset from the lines (rangeFor); a flat row whose lines are all by the
// foot has no flat preset and says so (rangeBasis "measured").
//
// Measurement keys. The components that follow a roof edge read the
// satellite report: soffit, fascia and de-icing cable run the eaves
// (`eaveFt`); attic insulation covers the building's footprint
// (`footprintSqft`). Siding reads the walls the siding takeoff measures
// (`wallSqft`, held back in a siding group whose calculator already bills
// them — lib/quotes/serviceTemplateLines.js). A REPAIR is to a section, not
// the whole roof edge, so repairs by the foot or square foot read the typed
// run or area (`linearFt`, `areaSqFt`), and per-window or per-vent work reads
// `each` — none of these is the whole-house figure the report would fill.
//
// Left without a template on purpose: the four "describe what you need"
// catch-alls (cleaning.other, install.other, repair.other_shingles,
// repair.other_other) — priced after a look at the roof.
//
// Quote types without a seed file that sell these rows (NEAREST_TRADES in
// lib/services/confirmServices.js): siding gets the siding install and
// repair, insulation the attic insulation install and repair, solar_energy
// the solar-shingle repair, chimney_sweep the chimney-cricket repair.

// A reference row _materialCosts.js does not list yet, built the way its
// build() builds one. Kept here because that file is shared by every seed
// being written in parallel; fold these keys into its USES when they merge.
const refItem = (key) => {
  const r = materialRef(key);
  if (!r?.prices?.US) throw new Error(`roofing_service: reference ${key} has no US price`);
  const cov = r.coverage;
  const ca = r.prices.CA ? { cost: r.prices.CA.amount, unit: r.prices.CA.unit || r.unit, coverage: r.prices.CA.coverage || cov } : null;
  return { ref: key, cost: r.prices.US.amount, unit: r.unit, per: cov ? cov.per : 1, per_unit: cov ? cov.unit : "each", ca };
};
const tx = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });
// The service's own it/de/uk/tl/pa already sit in the language file; T wants
// them named, and reading them from there keeps one copy.
const nm = (key) => I18N.services[key];
const CALL = () => SHARED.serviceCall(125);
// A per-hour repair line; each roof material names its own work.
const hours = (qty, price, text) => L.labour(qty, "hour", price, text);

const RF = {
  // Word for word the missing-shingle template's lines above, so the
  // Punjabi in the language file serves both.
  shingleHours: (qty) => hours(qty, 110, tx(
    ["Roof repair labour", "Damaged shingles lifted out, new ones woven in and every tab sealed, by the hour."],
    ["Main-d'œuvre — réparation de toiture", "Bardeaux abîmés retirés, nouveaux insérés et chaque languette scellée, à l'heure."],
    ["Mano de obra — reparación de techo", "Tejas dañadas retiradas, nuevas entretejidas y cada pestaña sellada, por hora."],
    ["Manodopera — riparazione tetto", "Tegole danneggiate tolte, nuove inserite e ogni linguetta sigillata, a ore."],
    ["Arbeit — Dachreparatur", "Beschädigte Schindeln herausgenommen, neue eingewoben und jeder Lappen verklebt, nach Stunden."],
    ["Робота — ремонт покрівлі", "Пошкоджений гонт знято, новий вплетено, кожну пелюстку проклеєно, погодинно."],
    ["Labor — pag-ayos ng bubong", "Tinanggal ang sirang shingles, isiningit ang bago at sinelyuhan ang bawat tab, kada oras."],
  )),
  matchingShingles: () => L.material(1, "each", 55, tx(
    ["Matching shingles and sealant", "A bundle of the closest-matching shingles, nails and roofing sealant."],
    ["Bardeaux assortis et scellant", "Un paquet de bardeaux les plus assortis possible, clous et scellant à toiture."],
    ["Tejas a juego y sellador", "Un paquete de las tejas más parecidas, clavos y sellador para techo."],
    ["Tegole abbinate e sigillante", "Un pacco delle tegole più simili, chiodi e sigillante per coperture."],
    ["Passende Schindeln und Dichtmasse", "Ein Bündel möglichst passender Schindeln, Nägel und Dachdichtmasse."],
    ["Підібраний гонт і герметик", "Пачка максимально схожого гонту, цвяхи та покрівельний герметик."],
    ["Katernong shingles at sealant", "Isang bundle ng pinakakamukhang shingles, pako at roofing sealant."],
  )),
  roofVent: () => L.material(1, "each", 45, tx(
    ["Roof vent — per vent", "Low-profile static roof vent with nails and sealant."],
    ["Évent de toit — l'unité", "Évent statique à profil bas avec clous et scellant."],
    ["Ventila de techo — por pieza", "Ventila estática de perfil bajo con clavos y sellador."],
    ["Aeratore — cadauno", "Aeratore statico a basso profilo con chiodi e sigillante."],
    ["Dachlüfter — pro Stück", "Flacher statischer Dachlüfter mit Nägeln und Dichtmasse."],
    ["Аератор — за штуку", "Низькопрофільний статичний аератор із цвяхами та герметиком."],
    ["Roof vent — kada isa", "Low-profile na static roof vent na may pako at sealant."],
  ), { measurementKey: "each" }),
  ventCutIn: (price) => L.labour(1, "each", price, tx(
    ["Vent cut-in and flashing — per vent", "The deck cut for the vent, the vent flashed into the shingle courses and sealed."],
    ["Découpe et pose d'évent — l'unité", "Platelage découpé pour l'évent, évent intégré aux rangs de bardeaux et scellé."],
    ["Corte e instalación de ventila — por pieza", "Cubierta cortada para la ventila, integrada en las hileras de tejas y sellada."],
    ["Taglio e posa aeratore — cadauno", "Tavolato tagliato per l'aeratore, inserito tra le file di tegole e sigillato."],
    ["Lüfter einschneiden und eindecken — pro Stück", "Schalung für den Lüfter ausgeschnitten, Lüfter in die Schindelreihen eingebunden und abgedichtet."],
    ["Вирізання та монтаж аератора — за штуку", "Настил прорізано під аератор, його вплетено в ряди гонту й загерметизовано."],
    ["Pag-cut at pagkabit ng vent — kada isa", "Binutas ang deck para sa vent, isiningit sa shingle courses at sinelyuhan."],
  ), { measurementKey: "each" }),
  heatCableLab: (price) => L.labour(1, "linear_ft", price, tx(
    ["Heat cable installation — per linear ft", "Cable clipped in a zig-zag along the eaves and run through the gutters and downspouts."],
    ["Pose de câble chauffant — au pi lin.", "Câble fixé en zigzag le long des avant-toits et passé dans les gouttières et descentes."],
    ["Instalación de cable calefactor — por pie lineal", "Cable fijado en zigzag a lo largo de los aleros y pasado por canaletas y bajantes."],
    ["Posa cavo scaldante — al piede lineare", "Cavo fissato a zig-zag lungo le gronde e fatto passare in grondaie e pluviali."],
    ["Heizkabel verlegen — pro lfd. Fuß", "Kabel im Zickzack entlang der Traufe befestigt und durch Rinnen und Fallrohre geführt."],
    ["Монтаж нагрівального кабелю — за пог. фут", "Кабель закріплено зигзагом уздовж карнизів і проведено ринвами та трубами."],
    ["Pagkabit ng heat cable — kada linear ft", "Ikinabit nang zig-zag ang cable sa eaves at pinadaan sa gutter at downspout."],
  ), { measurementKey: "eaveFt" }),
  heatCable: (price) => L.material(1, "linear_ft", price, tx(
    ["Roof and gutter heat cable — per linear ft", "Self-regulating de-icing cable with roof clips and spacers."],
    ["Câble chauffant toit et gouttières — au pi lin.", "Câble de déglaçage autorégulant avec attaches de toit et espaceurs."],
    ["Cable calefactor de techo y canaleta — por pie lineal", "Cable de deshielo autorregulable con clips de techo y separadores."],
    ["Cavo scaldante tetto e grondaie — al piede lineare", "Cavo antighiaccio autoregolante con clip da tetto e distanziali."],
    ["Dach- und Rinnenheizkabel — pro lfd. Fuß", "Selbstregelndes Abtaukabel mit Dachclips und Abstandhaltern."],
    ["Кабель для даху та ринв — за пог. фут", "Саморегульований кабель протизледеніння з кліпсами та дистанціонерами."],
    ["Heat cable sa bubong at gutter — kada linear ft", "Self-regulating na de-icing cable na may roof clip at spacer."],
  ), { measurementKey: "eaveFt" }),
  controller: (price) => L.labour(1, "flat", price, tx(
    ["Controller and GFCI connection", "Snow-and-ice controller mounted and the cable connected to a GFCI-protected outlet."],
    ["Contrôleur et branchement DDFT", "Contrôleur neige et glace posé et câble branché sur une prise protégée par DDFT."],
    ["Controlador y conexión GFCI", "Controlador de nieve y hielo montado y el cable conectado a un contacto con protección GFCI."],
    ["Centralina e collegamento differenziale", "Centralina neve e ghiaccio montata e cavo collegato a una presa protetta da differenziale."],
    ["Steuerung und FI-Anschluss", "Schnee- und Eissteuerung montiert und das Kabel an eine FI-geschützte Steckdose angeschlossen."],
    ["Контролер і підключення через ПЗВ", "Контролер снігу й льоду встановлено, кабель під'єднано до розетки з ПЗВ."],
    ["Controller at GFCI na koneksyon", "Ikinabit ang snow-and-ice controller at ikinonekta ang cable sa GFCI outlet."],
  )),
  flashingLab: (price) => L.labour(1, "linear_ft", price, tx(
    ["Flashing installation — per linear ft", "Shingles lifted, new step, apron or counter-flashing fitted at the wall, chimney or valley and sealed."],
    ["Pose de solins — au pi lin.", "Bardeaux soulevés, nouveaux solins en escalier, tablier ou contre-solin posés au mur, à la cheminée ou à la noue et scellés."],
    ["Instalación de tapajuntas — por pie lineal", "Tejas levantadas, tapajuntas escalonado, delantal o contratapajuntas nuevo colocado en muro, chimenea o limahoya y sellado."],
    ["Posa scossaline — al piede lineare", "Tegole sollevate, nuove scossaline a gradini, grembiale o controscossalina posate a muro, camino o compluvio e sigillate."],
    ["Anschlussbleche montieren — pro lfd. Fuß", "Schindeln angehoben, neue Stufen-, Schürzen- oder Überhangbleche an Wand, Kamin oder Kehle gesetzt und abgedichtet."],
    ["Монтаж примикань — за пог. фут", "Гонт піднято, нові ступінчасті, фартухові чи контрпримикання встановлено біля стіни, комина чи ендови й загерметизовано."],
    ["Pagkabit ng flashing — kada linear ft", "Inangat ang shingles, ikinabit ang bagong step, apron o counter-flashing sa pader, chimney o valley at sinelyuhan."],
  ), { measurementKey: "linearFt" }),
  flashingMat: (price) => L.material(1, "linear_ft", price, tx(
    ["Flashing metal and sealant — per linear ft", "Pre-bent aluminium or galvanised flashing, fasteners and polyurethane sealant."],
    ["Métal de solin et scellant — au pi lin.", "Solins préformés en aluminium ou galvanisés, fixations et scellant polyuréthane."],
    ["Lámina de tapajuntas y sellador — por pie lineal", "Tapajuntas predoblado de aluminio o galvanizado, fijaciones y sellador de poliuretano."],
    ["Lamiera per scossaline e sigillante — al piede lineare", "Scossaline prepiegate in alluminio o zincate, fissaggi e sigillante poliuretanico."],
    ["Blech und Dichtmasse — pro lfd. Fuß", "Vorgekantete Alu- oder verzinkte Bleche, Befestigungen und PU-Dichtmasse."],
    ["Метал для примикань і герметик — за пог. фут", "Загнуті алюмінієві чи оцинковані примикання, кріплення та поліуретановий герметик."],
    ["Flashing metal at sealant — kada linear ft", "Pre-bent na aluminum o galvanized na flashing, fastener at polyurethane sealant."],
  ), { measurementKey: "linearFt" }),
  setUp: (price) => L.labour(1, "flat", price, tx(
    ["Roof access and set-up", "Ladders, roof anchors and harnesses set up and the work area protected below."],
    ["Accès au toit et installation", "Échelles, ancrages et harnais installés et zone de travail protégée au sol."],
    ["Acceso al techo y preparación", "Escaleras, anclajes y arneses instalados y el área de abajo protegida."],
    ["Accesso al tetto e allestimento", "Scale, ancoraggi e imbracature montati e area di lavoro sottostante protetta."],
    ["Dachzugang und Einrichtung", "Leitern, Anschlagpunkte und Gurte eingerichtet und der Bereich darunter geschützt."],
    ["Доступ на дах і підготовка", "Драбини, анкери та страхувальні пояси встановлено, робочу зону внизу захищено."],
    ["Access sa bubong at set-up", "Inihanda ang hagdan, roof anchor at harness at pinrotektahan ang lugar sa ibaba."],
  )),
  sofFasLab: (price) => L.labour(1, "linear_ft", price, tx(
    ["Soffit and fascia installation — per linear ft", "Old boards covered or removed, new fascia and vented soffit fitted along the eave."],
    ["Pose de soffites et bordures — au pi lin.", "Anciennes planches recouvertes ou retirées, nouvelle bordure et soffite ventilé posés le long de l'avant-toit."],
    ["Instalación de sofito y fascia — por pie lineal", "Tablas viejas cubiertas o retiradas, fascia nueva y sofito ventilado colocados a lo largo del alero."],
    ["Posa sottogronda e frontalino — al piede lineare", "Vecchie tavole coperte o tolte, nuovo frontalino e sottogronda ventilato posati lungo la gronda."],
    ["Traufuntersicht und Stirnbrett montieren — pro lfd. Fuß", "Alte Bretter verkleidet oder entfernt, neues Stirnbrett und belüftete Untersicht entlang der Traufe montiert."],
    ["Монтаж софітів і лобової дошки — за пог. фут", "Старі дошки обшито чи знято, нову лобову дошку та вентильований софіт встановлено вздовж карниза."],
    ["Pagkabit ng soffit at fascia — kada linear ft", "Tinakpan o tinanggal ang lumang tabla, ikinabit ang bagong fascia at vented soffit sa eave."],
  ), { measurementKey: "eaveFt" }),
  sofFasMat: (price) => L.material(1, "linear_ft", price, tx(
    ["Aluminium soffit and fascia — per linear ft", "Vented aluminium soffit panels, fascia wrap, J-channel and trim nails."],
    ["Soffite et bordure d'aluminium — au pi lin.", "Panneaux de soffite ventilés en aluminium, revêtement de bordure, moulure en J et clous."],
    ["Sofito y fascia de aluminio — por pie lineal", "Paneles de sofito ventilados de aluminio, forro de fascia, canal J y clavos."],
    ["Sottogronda e frontalino in alluminio — al piede lineare", "Pannelli sottogronda ventilati in alluminio, rivestimento frontalino, profilo a J e chiodi."],
    ["Alu-Untersicht und Stirnbrettverkleidung — pro lfd. Fuß", "Belüftete Alu-Untersichtpaneele, Stirnbrettverkleidung, J-Profil und Nägel."],
    ["Алюмінієві софіти й лобова планка — за пог. фут", "Вентильовані алюмінієві софітні панелі, облицювання лобової дошки, J-профіль і цвяхи."],
    ["Aluminum soffit at fascia — kada linear ft", "Vented na aluminum soffit panel, fascia wrap, J-channel at pako."],
  ), { measurementKey: "eaveFt" }),
  cricketFrame: (price) => L.labour(1, "flat", price, tx(
    ["Cricket framing and sheathing", "A saddle framed behind the chimney and sheathed so water sheds to both sides."],
    ["Charpente et platelage du chevalet", "Chevalet charpenté derrière la cheminée et recouvert pour que l'eau s'écoule des deux côtés."],
    ["Estructura y cubierta del caballete", "Caballete armado detrás de la chimenea y cubierto para que el agua corra a ambos lados."],
    ["Struttura e tavolato del displuvio", "Displuvio costruito dietro il camino e rivestito perché l'acqua scoli ai due lati."],
    ["Sattel aufbauen und beplanken", "Hinter dem Kamin ein Sattel gezimmert und beplankt, damit das Wasser zu beiden Seiten abläuft."],
    ["Каркас і обшивка розжолобка", "Розжолобок змонтовано за комином і обшито, щоб вода стікала в обидва боки."],
    ["Framing at sheathing ng cricket", "Ginawa ang saddle sa likod ng chimney at nilagyan ng sheathing para dumaloy ang tubig sa magkabilang gilid."],
  )),
  cricketMat: (price) => L.material(1, "flat", price, tx(
    ["Sheathing, membrane and flashing metal", "Plywood, ice-and-water membrane and the metal that wraps the cricket to the chimney."],
    ["Platelage, membrane et métal de solin", "Contreplaqué, membrane pare-glace et le métal qui relie le chevalet à la cheminée."],
    ["Cubierta, membrana y lámina de tapajuntas", "Triplay, membrana contra hielo y agua y la lámina que une el caballete a la chimenea."],
    ["Tavolato, membrana e lamiera", "Compensato, membrana anti-ghiaccio e la lamiera che raccorda il displuvio al camino."],
    ["Beplankung, Bahn und Blech", "Sperrholz, Eis- und Wassersperrbahn und das Blech, das den Sattel an den Kamin anschließt."],
    ["Обшивка, мембрана та метал", "Фанера, протильодова мембрана та метал, що з'єднує розжолобок із комином."],
    ["Sheathing, membrane at flashing metal", "Plywood, ice-and-water membrane at metal na nagdudugtong ng cricket sa chimney."],
  )),
  cricketTieIn: (price) => L.labour(1, "flat", price, tx(
    ["Shingle tie-in around the cricket", "The surrounding shingles lifted, woven over the cricket and sealed."],
    ["Raccord des bardeaux au chevalet", "Bardeaux voisins soulevés, repris par-dessus le chevalet et scellés."],
    ["Unión de tejas alrededor del caballete", "Tejas de alrededor levantadas, entretejidas sobre el caballete y selladas."],
    ["Raccordo delle tegole al displuvio", "Tegole circostanti sollevate, raccordate sopra il displuvio e sigillate."],
    ["Schindelanschluss um den Sattel", "Umliegende Schindeln angehoben, über den Sattel eingebunden und abgedichtet."],
    ["Примикання гонту навколо розжолобка", "Навколишній гонт піднято, вплетено над розжолобком і загерметизовано."],
    ["Pagdugtong ng shingles sa paligid ng cricket", "Inangat ang katabing shingles, isiningit sa ibabaw ng cricket at sinelyuhan."],
  )),
  insulLab: (price) => L.labour(1, "sqft", price, tx(
    ["Attic insulation installation — per sq ft", "Baffles checked at the eaves and insulation laid to the agreed R-value without blocking the vents."],
    ["Pose d'isolant de grenier — au pi²", "Déflecteurs vérifiés aux avant-toits et isolant posé à la valeur R convenue sans boucher la ventilation."],
    ["Instalación de aislamiento de ático — por pie²", "Deflectores revisados en los aleros y aislamiento colocado al valor R acordado sin tapar la ventilación."],
    ["Posa isolante sottotetto — al piede quadro", "Deflettori controllati in gronda e isolante posato al valore R concordato senza chiudere la ventilazione."],
    ["Dachbodendämmung einbringen — pro sq ft", "Lüftungskeile an der Traufe geprüft und Dämmung bis zum vereinbarten R-Wert verlegt, ohne die Lüftung zu verschließen."],
    ["Утеплення горища — за кв. фут", "Дефлектори на карнизах перевірено, утеплювач укладено до погодженого R без перекриття вентиляції."],
    ["Pagkabit ng insulation sa attic — kada sq ft", "Chineck ang baffle sa eaves at inilatag ang insulation sa napagkasunduang R-value nang hindi natatakpan ang vent."],
  ), { measurementKey: "footprintSqft" }),
  insulRoll: (measurementKey) => hdMaterial(refItem("insulation_r19"), tx(
    ["R-19 insulation — per roll", "Faced R-19 batts, 15 in × 39 ft; one roll covers about 49 sq ft."],
    ["Isolant R-19 — le rouleau", "Nattes R-19 avec pare-vapeur, 15 po × 39 pi; un rouleau couvre environ 49 pi²."],
    ["Aislamiento R-19 — por rollo", "Colchoneta R-19 con barrera, 15 pulg × 39 pies; un rollo cubre unos 49 pies²."],
    ["Isolante R-19 — per rotolo", "Pannelli R-19 con barriera, 15 pollici × 39 piedi; un rotolo copre circa 49 piedi quadri."],
    ["R-19-Dämmung — pro Rolle", "Kaschierte R-19-Matten, 15 Zoll × 39 Fuß; eine Rolle deckt rund 49 sq ft."],
    ["Утеплювач R-19 — за рулон", "Мати R-19 з пароізоляцією, 15 дюймів × 39 футів; рулон покриває близько 49 кв. футів."],
    ["R-19 insulation — kada rolyo", "Faced R-19 batts, 15 in × 39 ft; ang isang rolyo ay mga 49 sq ft."],
  ), { measurementKey }),
  baffles: (price) => L.labour(1, "flat", price, tx(
    ["Baffles and air sealing", "Rafter baffles fitted at the eaves and the top plates and penetrations sealed before insulating."],
    ["Déflecteurs et étanchéité à l'air", "Déflecteurs posés aux avant-toits, sablières et percements scellés avant l'isolation."],
    ["Deflectores y sellado de aire", "Deflectores colocados en los aleros y soleras y penetraciones sellados antes de aislar."],
    ["Deflettori e sigillatura all'aria", "Deflettori montati in gronda, travi di banchina e passaggi sigillati prima di isolare."],
    ["Lüftungskeile und Luftdichtung", "Lüftungskeile an der Traufe gesetzt, Rähme und Durchdringungen vor dem Dämmen abgedichtet."],
    ["Дефлектори та герметизація", "Дефлектори встановлено на карнизах, обв'язку й проходи загерметизовано перед утепленням."],
    ["Baffles at air sealing", "Ikinabit ang rafter baffle sa eaves at sinelyuhan ang top plate at butas bago mag-insulate."],
  )),
  insulRemove: (price) => L.labour(1, "sqft", price, tx(
    ["Damaged insulation removal — per sq ft", "Wet, compressed or soiled insulation bagged and removed from the affected area."],
    ["Retrait d'isolant endommagé — au pi²", "Isolant mouillé, tassé ou souillé ensaché et retiré de la zone touchée."],
    ["Retiro de aislamiento dañado — por pie²", "Aislamiento mojado, compactado o sucio embolsado y retirado del área afectada."],
    ["Rimozione isolante danneggiato — al piede quadro", "Isolante bagnato, schiacciato o sporco insaccato e rimosso dalla zona colpita."],
    ["Beschädigte Dämmung entfernen — pro sq ft", "Nasse, verdichtete oder verschmutzte Dämmung im betroffenen Bereich eingesackt und entfernt."],
    ["Видалення пошкодженого утеплювача — за кв. фут", "Мокрий, злежаний чи забруднений утеплювач спаковано й винесено з ураженої ділянки."],
    ["Pagtanggal ng sirang insulation — kada sq ft", "Isinako at inalis ang basa, siksik o maruming insulation sa apektadong bahagi."],
  ), { measurementKey: "areaSqFt" }),
  sidingLab: (price) => L.labour(1, "sqft", price, tx(
    ["Siding installation — per sq ft", "House wrap lapped and taped, starter and siding hung level and locked, corners and openings trimmed."],
    ["Pose de revêtement — au pi²", "Pare-air chevauché et ruban appliqué, départ et revêtement posés de niveau, coins et ouvertures finis."],
    ["Instalación de revestimiento — por pie²", "Membrana traslapada y encintada, arranque y revestimiento colocados a nivel, esquinas y vanos rematados."],
    ["Posa rivestimento — al piede quadro", "Telo traspirante sormontato e nastrato, partenza e doghe posate in bolla, angoli e aperture rifiniti."],
    ["Fassadenverkleidung montieren — pro sq ft", "Winddichtung überlappt und verklebt, Startleiste und Paneele waagerecht eingehängt, Ecken und Öffnungen verkleidet."],
    ["Монтаж сайдингу — за кв. фут", "Вітрозахист укладено внапуск і проклеєно, стартову планку й сайдинг змонтовано за рівнем, кути й прорізи оздоблено."],
    ["Pagkabit ng siding — kada sq ft", "Inilatag at tinape ang house wrap, ikinabit nang pantay ang starter at siding, at tinapos ang kanto at bukasan."],
  ), { measurementKey: "wallSqft" }),
  vinylSiding: () => hdMaterial(refItem("vinyl_siding"), tx(
    ["Vinyl siding — per piece", "Double 4 in vinyl siding, 12.5 ft pieces; about 8.3 sq ft each."],
    ["Revêtement de vinyle — la pièce", "Déclin de vinyle double 4 po, pièces de 12,5 pi; environ 8,3 pi² chacune."],
    ["Revestimiento de vinilo — por pieza", "Siding de vinilo doble de 4 pulg, piezas de 12.5 pies; unos 8.3 pies² cada una."],
    ["Rivestimento in vinile — al pezzo", "Doghe in vinile doppie da 4 pollici, pezzi da 12,5 piedi; circa 8,3 piedi quadri ciascuno."],
    ["Vinyl-Fassadenpaneel — pro Stück", "Doppel-4-Zoll-Vinylpaneele, 12,5 Fuß lang; je rund 8,3 sq ft."],
    ["Вініловий сайдинг — за панель", "Вініловий сайдинг подвійний 4 дюйми, панелі 12,5 фута; близько 8,3 кв. фута кожна."],
    ["Vinyl siding — kada piraso", "Double 4 in na vinyl siding, 12.5 ft ang piraso; mga 8.3 sq ft bawat isa."],
  ), { measurementKey: "wallSqft", wastePct: 10 }),
  houseWrap: () => hdMaterial(refItem("house_wrap"), tx(
    ["House wrap — per roll", "Woven weather-resistive barrier, 9 × 150 ft roll."],
    ["Pare-air — le rouleau", "Membrane pare-intempéries tissée, rouleau de 9 × 150 pi."],
    ["Membrana envolvente — por rollo", "Barrera tejida resistente a la intemperie, rollo de 9 × 150 pies."],
    ["Telo traspirante — per rotolo", "Barriera tessuta contro le intemperie, rotolo da 9 × 150 piedi."],
    ["Winddichtungsbahn — pro Rolle", "Gewebte, wetterfeste Fassadenbahn, Rolle 9 × 150 Fuß."],
    ["Вітрозахисна мембрана — за рулон", "Тканий погодозахисний бар'єр, рулон 9 × 150 футів."],
    ["House wrap — kada rolyo", "Woven na weather-resistive barrier, 9 × 150 ft na rolyo."],
  ), { measurementKey: "wallSqft" }),
  sidingTrim: (price) => L.material(1, "flat", price, tx(
    ["Trim, J-channel and corner posts", "Starter strip, J-channel, outside and inside corners and utility trim for the walls."],
    ["Moulures, profilés en J et coins", "Bande de départ, profilés en J, coins extérieurs et intérieurs et moulure de finition pour les murs."],
    ["Molduras, canal J y esquineros", "Tira de arranque, canal J, esquineros exteriores e interiores y moldura de remate para los muros."],
    ["Profili, canali a J e angolari", "Profilo di partenza, canali a J, angolari esterni e interni e profilo di finitura per le pareti."],
    ["Profile, J-Leisten und Eckprofile", "Startleiste, J-Profile, Außen- und Innenecken und Abschlussprofil für die Wände."],
    ["Планки, J-профілі та кути", "Стартова планка, J-профілі, зовнішні й внутрішні кути та фінішна планка для стін."],
    ["Trim, J-channel at corner post", "Starter strip, J-channel, labas at loob na kanto at utility trim para sa pader."],
  )),
  windowLab: (price) => L.labour(1, "each", price, tx(
    ["Window installation — per window", "The opening checked and flashed, the window set plumb and level, insulated and sealed inside and out."],
    ["Pose de fenêtre — l'unité", "Ouverture vérifiée et munie de solins, fenêtre posée d'aplomb et de niveau, isolée et scellée dedans et dehors."],
    ["Instalación de ventana — por pieza", "Vano revisado y con tapajuntas, ventana colocada a plomo y nivel, aislada y sellada por dentro y por fuera."],
    ["Posa finestra — cadauna", "Apertura controllata e protetta, finestra posata a piombo e in bolla, isolata e sigillata dentro e fuori."],
    ["Fenstereinbau — pro Fenster", "Öffnung geprüft und abgedichtet, Fenster lot- und waagerecht gesetzt, gedämmt und innen wie außen versiegelt."],
    ["Монтаж вікна — за вікно", "Проріз перевірено й ізольовано, вікно встановлено по рівню та виску, утеплено й загерметизовано всередині та ззовні."],
    ["Pagkabit ng bintana — kada isa", "Chineck at nilagyan ng flashing ang bukasan, ikinabit nang tuwid at pantay, ininsulate at sinelyuhan sa loob at labas."],
  ), { measurementKey: "each" }),
  windowUnit: (price) => L.material(1, "each", price, tx(
    ["Replacement window — vinyl double-hung", "Standard-size vinyl double-hung window, low-E double glazing."],
    ["Fenêtre de remplacement — guillotine double en vinyle", "Fenêtre à guillotine double en vinyle de format standard, double vitrage à faible émissivité."],
    ["Ventana de reemplazo — guillotina doble de vinilo", "Ventana de guillotina doble de vinilo de medida estándar, doble vidrio low-E."],
    ["Finestra sostitutiva — a ghigliottina in vinile", "Finestra a doppia ghigliottina in vinile di misura standard, doppio vetro basso emissivo."],
    ["Ersatzfenster — Vinyl-Schiebefenster", "Vinyl-Doppelschiebefenster in Standardgröße, Low-E-Zweifachverglasung."],
    ["Вікно на заміну — вінілове підйомне", "Вінілове вікно з двома підйомними стулками стандартного розміру, енергоощадний склопакет."],
    ["Pamalit na bintana — vinyl double-hung", "Standard na sukat na vinyl double-hung na bintana, low-E double glazing."],
  ), { measurementKey: "each" }),
  windowFlash: (price) => L.material(1, "each", price, tx(
    ["Flashing tape, foam and sealant — per window", "Self-adhered flashing tape, low-expansion foam and exterior sealant for one opening."],
    ["Ruban de solin, mousse et scellant — par fenêtre", "Ruban de solin autocollant, mousse à faible expansion et scellant extérieur pour une ouverture."],
    ["Cinta tapajuntas, espuma y sellador — por ventana", "Cinta tapajuntas autoadherible, espuma de baja expansión y sellador exterior para un vano."],
    ["Nastro, schiuma e sigillante — per finestra", "Nastro autoadesivo per raccordi, schiuma a bassa espansione e sigillante esterno per un'apertura."],
    ["Anschlussband, Schaum und Dichtstoff — pro Fenster", "Selbstklebendes Anschlussband, Montageschaum mit geringer Ausdehnung und Außendichtstoff für eine Öffnung."],
    ["Стрічка, піна та герметик — на вікно", "Самоклейна ізоляційна стрічка, піна малого розширення та зовнішній герметик на один проріз."],
    ["Flashing tape, foam at sealant — kada bintana", "Self-adhered na flashing tape, low-expansion foam at exterior sealant para sa isang bukasan."],
  ), { measurementKey: "each" }),
  windowReseal: (price) => L.labour(1, "each", price, tx(
    ["Window reflash and reseal — per window", "Failed caulk cut out, the head and sill reflashed and the frame resealed to the siding."],
    ["Reprise des solins et du scellant — par fenêtre", "Calfeutrant défaillant coupé, tête et appui refaits avec solins et cadre rescellé au revêtement."],
    ["Nuevo tapajuntas y sellado — por ventana", "Sellador dañado retirado, cabezal y alféizar con tapajuntas nuevos y marco resellado al revestimiento."],
    ["Nuove scossaline e sigillatura — per finestra", "Sigillante rovinato tolto, architrave e davanzale riprotetti e telaio risigillato al rivestimento."],
    ["Neu abdichten — pro Fenster", "Defekte Fuge herausgeschnitten, Sturz und Bank neu eingeblecht und Rahmen zur Fassade neu versiegelt."],
    ["Нова ізоляція й герметизація — за вікно", "Зіпсований герметик вирізано, верх і підвіконня заізольовано наново, раму загерметизовано до облицювання."],
    ["Bagong flashing at selyo — kada bintana", "Tinanggal ang sirang caulk, nilagyan ulit ng flashing ang head at sill at sinelyuhan ang frame sa siding."],
  ), { measurementKey: "each" }),
  tileHours: (qty) => hours(qty, 125, tx(
    ["Tile roof repair labour", "Broken tiles lifted out without cracking their neighbours, the underlayment patched and new tiles hooked in, by the hour."],
    ["Main-d'œuvre — réparation de toit en tuiles", "Tuiles brisées retirées sans fendre les voisines, sous-couche réparée et nouvelles tuiles accrochées, à l'heure."],
    ["Mano de obra — reparación de techo de teja", "Tejas rotas retiradas sin quebrar las vecinas, base parchada y tejas nuevas enganchadas, por hora."],
    ["Manodopera — riparazione tetto in coppi o tegole", "Tegole rotte tolte senza incrinare le vicine, sottomanto riparato e nuove tegole agganciate, a ore."],
    ["Arbeit — Ziegeldachreparatur", "Gebrochene Ziegel entnommen, ohne die Nachbarn zu beschädigen, Unterdeckung geflickt und neue Ziegel eingehängt, nach Stunden."],
    ["Робота — ремонт черепичного даху", "Биту черепицю знято без пошкодження сусідньої, підкладку залатано, нову черепицю навішено, погодинно."],
    ["Labor — pag-ayos ng tile na bubong", "Tinanggal ang basag na tile nang hindi nababasag ang katabi, tinagpian ang underlayment at ikinabit ang bago, kada oras."],
  )),
  clayTiles: (price) => L.material(1, "flat", price, tx(
    ["Replacement clay tiles and underlayment patch", "Matching clay tiles, hooks and a patch of underlayment for the repair."],
    ["Tuiles d'argile de remplacement et réparation de sous-couche", "Tuiles d'argile assorties, crochets et pièce de sous-couche pour la réparation."],
    ["Tejas de arcilla de reposición y parche de base", "Tejas de arcilla a juego, ganchos y un parche de base para la reparación."],
    ["Coppi in cotto di ricambio e toppa di sottomanto", "Coppi in cotto abbinati, ganci e una toppa di sottomanto per la riparazione."],
    ["Ersatz-Tonziegel und Unterdeckflicken", "Passende Tonziegel, Haken und ein Stück Unterdeckbahn für die Reparatur."],
    ["Керамічна черепиця на заміну та латка підкладки", "Підібрана керамічна черепиця, гачки та латка підкладки для ремонту."],
    ["Pamalit na clay tile at patch ng underlayment", "Katernong clay tile, hook at patch ng underlayment para sa pag-ayos."],
  )),
  concreteTiles: (price) => L.material(1, "flat", price, tx(
    ["Replacement concrete tiles and underlayment patch", "Matching concrete tiles, hooks and a patch of underlayment for the repair."],
    ["Tuiles de béton de remplacement et réparation de sous-couche", "Tuiles de béton assorties, crochets et pièce de sous-couche pour la réparation."],
    ["Tejas de concreto de reposición y parche de base", "Tejas de concreto a juego, ganchos y un parche de base para la reparación."],
    ["Tegole in cemento di ricambio e toppa di sottomanto", "Tegole in cemento abbinate, ganci e una toppa di sottomanto per la riparazione."],
    ["Ersatz-Betondachsteine und Unterdeckflicken", "Passende Betondachsteine, Haken und ein Stück Unterdeckbahn für die Reparatur."],
    ["Бетонна черепиця на заміну та латка підкладки", "Підібрана бетонна черепиця, гачки та латка підкладки для ремонту."],
    ["Pamalit na concrete tile at patch ng underlayment", "Katernong concrete tile, hook at patch ng underlayment para sa pag-ayos."],
  )),
  cableRepairHours: (qty) => hours(qty, 110, tx(
    ["De-icing cable repair labour", "The fault traced along the cable, the damaged section spliced or replaced and the circuit tested, by the hour."],
    ["Main-d'œuvre — réparation du câble de déglaçage", "Défaut localisé sur le câble, section abîmée épissée ou remplacée et circuit testé, à l'heure."],
    ["Mano de obra — reparación del cable de deshielo", "Falla localizada en el cable, tramo dañado empalmado o reemplazado y el circuito probado, por hora."],
    ["Manodopera — riparazione cavo antighiaccio", "Guasto individuato lungo il cavo, tratto danneggiato giuntato o sostituito e circuito provato, a ore."],
    ["Arbeit — Heizkabel reparieren", "Fehler entlang des Kabels gesucht, beschädigtes Stück gespleißt oder ersetzt und Stromkreis geprüft, nach Stunden."],
    ["Робота — ремонт кабелю протизледеніння", "Несправність знайдено вздовж кабелю, пошкоджену ділянку з'єднано чи замінено, коло перевірено, погодинно."],
    ["Labor — pag-ayos ng de-icing cable", "Hinanap ang sira sa cable, dinugtong o pinalitan ang sirang bahagi at sinubok ang circuit, kada oras."],
  )),
  cableSplice: (price) => L.material(1, "flat", price, tx(
    ["Heat cable section and splice kit", "A length of matching self-regulating cable with a rated splice kit and clips."],
    ["Section de câble chauffant et trousse d'épissure", "Longueur de câble autorégulant assorti avec trousse d'épissure homologuée et attaches."],
    ["Tramo de cable calefactor y kit de empalme", "Tramo de cable autorregulable compatible con kit de empalme certificado y clips."],
    ["Tratto di cavo scaldante e kit di giunzione", "Tratto di cavo autoregolante compatibile con kit di giunzione omologato e clip."],
    ["Heizkabelstück und Spleißset", "Ein Stück passendes selbstregelndes Kabel mit zugelassenem Spleißset und Clips."],
    ["Відрізок нагрівального кабелю та з'єднувальний набір", "Відрізок сумісного саморегульованого кабелю із сертифікованим з'єднувачем і кліпсами."],
    ["Heat cable at splice kit", "Katernong self-regulating cable na may rated splice kit at clip."],
  )),
  metalHours: (qty) => hours(qty, 125, tx(
    ["Metal roof repair labour", "Loose fasteners replaced with oversized screws, seams resealed and damaged panels patched, by the hour."],
    ["Main-d'œuvre — réparation de toit métallique", "Vis desserrées remplacées par des vis surdimensionnées, joints rescellés et panneaux abîmés rapiécés, à l'heure."],
    ["Mano de obra — reparación de techo metálico", "Tornillos flojos cambiados por unos de mayor calibre, juntas reselladas y paneles dañados parchados, por hora."],
    ["Manodopera — riparazione tetto in metallo", "Viti allentate sostituite con viti maggiorate, giunti risigillati e pannelli danneggiati rattoppati, a ore."],
    ["Arbeit — Metalldachreparatur", "Lose Befestiger durch größere Schrauben ersetzt, Nähte neu abgedichtet und beschädigte Paneele geflickt, nach Stunden."],
    ["Робота — ремонт металевого даху", "Послаблені кріплення замінено більшими шурупами, шви загерметизовано, пошкоджені панелі залатано, погодинно."],
    ["Labor — pag-ayos ng metal na bubong", "Pinalitan ng mas malaking turnilyo ang maluwag, sinelyuhan ulit ang seam at tinagpian ang sirang panel, kada oras."],
  )),
  metalPatch: (price) => L.material(1, "flat", price, tx(
    ["Panel patch, closures and fasteners", "Matching panel or patch metal, foam closures, gasketed screws and butyl tape."],
    ["Pièce de panneau, closoirs et fixations", "Panneau assorti ou métal de réparation, closoirs en mousse, vis à rondelle et ruban butyle."],
    ["Parche de panel, cierres y fijaciones", "Panel a juego o lámina de parche, cierres de espuma, tornillos con empaque y cinta butílica."],
    ["Toppa, chiusure e fissaggi", "Pannello abbinato o lamiera di riparazione, chiusure in schiuma, viti con guarnizione e nastro butilico."],
    ["Paneelflicken, Abschlüsse und Befestiger", "Passendes Paneel oder Flickblech, Schaumstoffabschlüsse, Dichtschrauben und Butylband."],
    ["Латка, ущільнювачі та кріплення", "Підібрана панель або метал для латки, пінні ущільнювачі, шурупи з прокладкою та бутилова стрічка."],
    ["Patch ng panel, closure at fastener", "Katernong panel o patch metal, foam closure, turnilyong may gasket at butyl tape."],
  )),
  generalHours: (qty) => hours(qty, 110, tx(
    ["Roof repair labour — general", "The leak or damaged area opened, the roofing and underlayment repaired to match and sealed, by the hour."],
    ["Main-d'œuvre — réparation de toiture générale", "Fuite ou zone abîmée ouverte, couverture et sous-couche réparées à l'identique et scellées, à l'heure."],
    ["Mano de obra — reparación de techo general", "Fuga o zona dañada abierta, cubierta y base reparadas igual que el resto y selladas, por hora."],
    ["Manodopera — riparazione tetto generica", "Perdita o zona danneggiata aperta, manto e sottomanto riparati in modo uniforme e sigillati, a ore."],
    ["Arbeit — allgemeine Dachreparatur", "Leck oder Schadstelle geöffnet, Deckung und Unterdeckung passend repariert und abgedichtet, nach Stunden."],
    ["Робота — загальний ремонт покрівлі", "Місце протікання чи пошкодження розкрито, покриття й підкладку відновлено в тон і загерметизовано, погодинно."],
    ["Labor — pangkalahatang pag-ayos ng bubong", "Binuksan ang tumutulo o sirang bahagi, inayos ang bubong at underlayment na katerno at sinelyuhan, kada oras."],
  )),
  flatHours: (qty) => hours(qty, 110, tx(
    ["Flat roof repair labour", "Blisters and splits cut out, the area primed and a membrane patch torched or adhered over it, by the hour."],
    ["Main-d'œuvre — réparation de toit plat", "Cloques et fissures découpées, zone apprêtée et pièce de membrane soudée ou collée par-dessus, à l'heure."],
    ["Mano de obra — reparación de techo plano", "Ampollas y grietas cortadas, zona imprimada y un parche de membrana soldado o adherido encima, por hora."],
    ["Manodopera — riparazione tetto piano", "Bolle e crepe tagliate, zona trattata con primer e toppa di membrana saldata o incollata sopra, a ore."],
    ["Arbeit — Flachdachreparatur", "Blasen und Risse ausgeschnitten, Fläche grundiert und ein Bahnenflicken aufgeschweißt oder verklebt, nach Stunden."],
    ["Робота — ремонт плоского даху", "Пухирі й тріщини вирізано, ділянку заґрунтовано, латку мембрани наплавлено чи наклеєно, погодинно."],
    ["Labor — pag-ayos ng flat na bubong", "Pinutol ang paltos at biyak, nilagyan ng primer at idinikit o tinorch ang membrane patch sa ibabaw, kada oras."],
  )),
  modBitPatch: (price) => L.material(1, "flat", price, tx(
    ["Modified bitumen patch and primer", "Modified bitumen cap sheet, asphalt primer and roofing cement for the patch."],
    ["Pièce de bitume modifié et apprêt", "Membrane de finition en bitume modifié, apprêt bitumineux et ciment à toiture pour la réparation."],
    ["Parche de asfalto modificado y primario", "Lámina de asfalto modificado, primario asfáltico y cemento para techo para el parche."],
    ["Toppa in bitume modificato e primer", "Membrana in bitume modificato, primer bituminoso e mastice per coperture per la toppa."],
    ["Bitumenbahnflicken und Voranstrich", "Polymerbitumen-Oberlage, Bitumenvoranstrich und Dachkitt für den Flicken."],
    ["Латка з модифікованого бітуму та праймер", "Модифікована бітумна мембрана, бітумний праймер і покрівельна мастика для латки."],
    ["Modified bitumen patch at primer", "Modified bitumen cap sheet, asphalt primer at roofing cement para sa patch."],
  )),
  slateHours: (qty) => hours(qty, 135, tx(
    ["Slate repair labour", "Broken slates cut out with a slate ripper and new ones hung on copper nails or hooks, by the hour."],
    ["Main-d'œuvre — réparation d'ardoise", "Ardoises brisées retirées au tire-clou et nouvelles posées aux clous de cuivre ou crochets, à l'heure."],
    ["Mano de obra — reparación de pizarra", "Pizarras rotas sacadas con arrancaclavos y nuevas colgadas con clavos de cobre o ganchos, por hora."],
    ["Manodopera — riparazione ardesia", "Lastre rotte tolte con lo strappachiodi e nuove appese con chiodi di rame o ganci, a ore."],
    ["Arbeit — Schieferreparatur", "Gebrochene Schiefer mit dem Schieferhaken entfernt und neue mit Kupfernägeln oder Haken eingehängt, nach Stunden."],
    ["Робота — ремонт сланцевого даху", "Биті сланцеві плитки видалено гачком, нові навішено на мідні цвяхи чи гачки, погодинно."],
    ["Labor — pag-ayos ng slate", "Tinanggal ang basag na slate gamit ang slate ripper at ikinabit ang bago sa copper nail o hook, kada oras."],
  )),
  slates: (price) => L.material(1, "flat", price, tx(
    ["Replacement slates, hooks and copper nails", "Salvaged or new slates matched in colour and size, with hooks and copper nails."],
    ["Ardoises de remplacement, crochets et clous de cuivre", "Ardoises récupérées ou neuves assorties en couleur et format, avec crochets et clous de cuivre."],
    ["Pizarras de reposición, ganchos y clavos de cobre", "Pizarras recuperadas o nuevas del mismo color y tamaño, con ganchos y clavos de cobre."],
    ["Ardesie di ricambio, ganci e chiodi di rame", "Ardesie di recupero o nuove abbinate per colore e misura, con ganci e chiodi di rame."],
    ["Ersatzschiefer, Haken und Kupfernägel", "Gebrauchte oder neue Schiefer in passender Farbe und Größe, mit Haken und Kupfernägeln."],
    ["Сланець на заміну, гачки та мідні цвяхи", "Вживаний або новий сланець у тон і розмір, із гачками та мідними цвяхами."],
    ["Pamalit na slate, hook at copper nail", "Salvaged o bagong slate na katerno ang kulay at sukat, may hook at copper nail."],
  )),
  solarHours: (qty) => hours(qty, 150, tx(
    ["Solar shingle repair labour", "The array isolated, the failed or cracked solar shingle lifted out and a new one fitted and wired, by the hour."],
    ["Main-d'œuvre — réparation de bardeau solaire", "Installation isolée, bardeau solaire défaillant ou fissuré retiré et nouveau posé et câblé, à l'heure."],
    ["Mano de obra — reparación de teja solar", "Sistema aislado, teja solar dañada o rota retirada y una nueva colocada y cableada, por hora."],
    ["Manodopera — riparazione tegola fotovoltaica", "Impianto isolato, tegola solare guasta o crepata tolta e nuova montata e cablata, a ore."],
    ["Arbeit — Solarschindelreparatur", "Anlage freigeschaltet, defekte oder gerissene Solarschindel entnommen und neue eingesetzt und verdrahtet, nach Stunden."],
    ["Робота — ремонт сонячної черепиці", "Систему відключено, несправну чи тріснуту сонячну черепицю знято, нову встановлено й під'єднано, погодинно."],
    ["Labor — pag-ayos ng solar shingle", "Inihiwalay ang system, tinanggal ang sira o basag na solar shingle at ikinabit at kinablehan ang bago, kada oras."],
  )),
  solarShingle: (price) => L.material(1, "flat", price, tx(
    ["Solar shingle or tile replacement", "Manufacturer-matched solar shingle or tile with its connectors."],
    ["Bardeau ou tuile solaire de remplacement", "Bardeau ou tuile solaire d'origine du fabricant avec ses connecteurs."],
    ["Teja solar de reemplazo", "Teja solar original del fabricante con sus conectores."],
    ["Tegola fotovoltaica di ricambio", "Tegola solare originale del produttore con i suoi connettori."],
    ["Ersatz-Solarschindel", "Original-Solarschindel oder -ziegel des Herstellers mit Steckverbindern."],
    ["Сонячна черепиця на заміну", "Оригінальна сонячна черепиця виробника з конекторами."],
    ["Pamalit na solar shingle o tile", "Solar shingle o tile na tugma sa manufacturer, kasama ang connector."],
  )),
  solarCheck: (price) => L.labour(1, "flat", price, tx(
    ["System check and reconnection", "The string tested, the array reconnected and production confirmed on the inverter or app."],
    ["Vérification et remise en service", "Chaîne testée, installation reconnectée et production confirmée sur l'onduleur ou l'application."],
    ["Revisión del sistema y reconexión", "Cadena probada, sistema reconectado y producción confirmada en el inversor o la app."],
    ["Verifica e ricollegamento dell'impianto", "Stringa provata, impianto ricollegato e produzione confermata sull'inverter o sull'app."],
    ["Anlagenprüfung und Wiederanschluss", "String geprüft, Anlage wieder angeschlossen und Ertrag am Wechselrichter oder in der App bestätigt."],
    ["Перевірка та підключення системи", "Стрінг перевірено, систему під'єднано, вироблення підтверджено на інверторі чи в застосунку."],
    ["System check at reconnection", "Sinubok ang string, ikinonekta ulit ang system at kinumpirma ang production sa inverter o app."],
  )),
  membraneHours: (qty) => hours(qty, 115, tx(
    ["Membrane roof repair labour", "The membrane cleaned around the damage and a patch hot-air welded over it, seams probed, by the hour."],
    ["Main-d'œuvre — réparation de membrane", "Membrane nettoyée autour du dommage et pièce soudée à l'air chaud par-dessus, joints vérifiés, à l'heure."],
    ["Mano de obra — reparación de membrana", "Membrana limpiada alrededor del daño y un parche soldado con aire caliente encima, juntas revisadas, por hora."],
    ["Manodopera — riparazione manto sintetico", "Membrana pulita attorno al danno e toppa saldata ad aria calda sopra, giunti verificati, a ore."],
    ["Arbeit — Kunststoffbahn reparieren", "Bahn um die Schadstelle gereinigt, Flicken mit Heißluft aufgeschweißt und Nähte geprüft, nach Stunden."],
    ["Робота — ремонт мембранного даху", "Мембрану навколо пошкодження очищено, латку приварено гарячим повітрям, шви перевірено, погодинно."],
    ["Labor — pag-ayos ng membrane na bubong", "Nilinis ang membrane sa paligid ng sira at hot-air weld ang patch, chineck ang seam, kada oras."],
  )),
  pvcPatch: (price) => L.material(1, "flat", price, tx(
    ["PVC membrane patch and cleaner", "Matching PVC membrane, membrane cleaner and cut-edge sealant."],
    ["Pièce de membrane PVC et nettoyant", "Membrane PVC assortie, nettoyant à membrane et scellant de rive."],
    ["Parche de membrana PVC y limpiador", "Membrana de PVC a juego, limpiador de membrana y sellador de bordes."],
    ["Toppa in membrana PVC e detergente", "Membrana in PVC abbinata, detergente per membrane e sigillante per bordi."],
    ["PVC-Bahnflicken und Reiniger", "Passende PVC-Bahn, Bahnenreiniger und Schnittkantendichtung."],
    ["Латка з ПВХ-мембрани та очисник", "Підібрана ПВХ-мембрана, очисник мембрани та герметик для кромок."],
    ["PVC membrane patch at cleaner", "Katernong PVC membrane, membrane cleaner at cut-edge sealant."],
  )),
  shakeHours: (qty) => hours(qty, 120, tx(
    ["Shake roof repair labour", "Split or rotted shakes cut out, the felt interlay patched and new shakes fitted and nailed, by the hour."],
    ["Main-d'œuvre — réparation de bardeaux de cèdre", "Bardeaux fendus ou pourris retirés, feutre intercalaire réparé et nouveaux bardeaux posés et cloués, à l'heure."],
    ["Mano de obra — reparación de teja de madera", "Tejas partidas o podridas retiradas, fieltro intermedio parchado y tejas nuevas colocadas y clavadas, por hora."],
    ["Manodopera — riparazione scandole in legno", "Scandole spaccate o marce tolte, feltro intermedio riparato e nuove scandole posate e chiodate, a ore."],
    ["Arbeit — Holzschindelreparatur", "Gespaltene oder morsche Schindeln entfernt, Zwischenlage geflickt und neue Schindeln eingesetzt und genagelt, nach Stunden."],
    ["Робота — ремонт дерев'яної гонти", "Розколоту чи гнилу гонту вирізано, прокладку залатано, нову гонту встановлено й прибито, погодинно."],
    ["Labor — pag-ayos ng wood shake", "Tinanggal ang biyak o bulok na shake, tinagpian ang felt interlay at ikinabit at pinakuan ang bago, kada oras."],
  )),
  shakes: (price) => L.material(1, "flat", price, tx(
    ["Cedar shakes and stainless nails", "Matching cedar shakes, felt interlay and stainless ring-shank nails."],
    ["Bardeaux de cèdre et clous inox", "Bardeaux de cèdre assortis, feutre intercalaire et clous annelés en inox."],
    ["Tejas de cedro y clavos inoxidables", "Tejas de cedro a juego, fieltro intermedio y clavos anillados de acero inoxidable."],
    ["Scandole di cedro e chiodi inox", "Scandole di cedro abbinate, feltro intermedio e chiodi ad aderenza migliorata inox."],
    ["Zedernschindeln und Edelstahlnägel", "Passende Zedernschindeln, Zwischenlage und Edelstahl-Rillennägel."],
    ["Кедрова гонта та нержавіючі цвяхи", "Підібрана кедрова гонта, прокладка та нержавіючі йоржисті цвяхи."],
    ["Cedar shakes at stainless na pako", "Katernong cedar shakes, felt interlay at stainless ring-shank na pako."],
  )),
  cricketReflash: (price) => L.labour(1, "flat", price, tx(
    ["Cricket reflashing labour", "Shingles lifted around the cricket, the old metal and membrane replaced and the counter-flashing resealed to the chimney."],
    ["Main-d'œuvre — réfection des solins du chevalet", "Bardeaux soulevés autour du chevalet, ancien métal et membrane remplacés et contre-solin rescellé à la cheminée."],
    ["Mano de obra — nuevo tapajuntas del caballete", "Tejas levantadas alrededor del caballete, lámina y membrana viejas cambiadas y contratapajuntas resellado a la chimenea."],
    ["Manodopera — rifacimento scossaline del displuvio", "Tegole sollevate attorno al displuvio, vecchia lamiera e membrana sostituite e controscossalina risigillata al camino."],
    ["Arbeit — Sattel neu einblechen", "Schindeln um den Sattel angehoben, altes Blech und Bahn ersetzt und Überhangblech am Kamin neu abgedichtet."],
    ["Робота — перекриття розжолобка", "Гонт навколо розжолобка піднято, старий метал і мембрану замінено, контрпримикання до комина загерметизовано."],
    ["Labor — bagong flashing ng cricket", "Inangat ang shingles sa paligid ng cricket, pinalitan ang lumang metal at membrane at sinelyuhan ulit ang counter-flashing sa chimney."],
  )),
  flashingKit: (price) => L.material(1, "flat", price, tx(
    ["Flashing metal, membrane and sealant", "Pre-bent flashing, ice-and-water membrane and chimney sealant for the repair."],
    ["Métal de solin, membrane et scellant", "Solins préformés, membrane pare-glace et scellant à cheminée pour la réparation."],
    ["Lámina de tapajuntas, membrana y sellador", "Tapajuntas predoblado, membrana contra hielo y agua y sellador para chimenea."],
    ["Lamiera, membrana e sigillante", "Scossaline prepiegate, membrana anti-ghiaccio e sigillante per camini per la riparazione."],
    ["Blech, Bahn und Dichtmasse", "Vorgekantete Bleche, Eis- und Wassersperrbahn und Kamindichtmasse für die Reparatur."],
    ["Метал, мембрана та герметик", "Загнуті примикання, протильодова мембрана та герметик для комина."],
    ["Flashing metal, membrane at sealant", "Pre-bent na flashing, ice-and-water membrane at chimney sealant para sa pag-ayos."],
  )),
  gutterHours: (qty) => hours(qty, 95, tx(
    ["Gutter repair labour", "Sagging runs re-hung on new hangers, leaking seams resealed and the pitch reset, by the hour."],
    ["Main-d'œuvre — réparation de gouttières", "Sections affaissées refixées sur crochets neufs, joints qui fuient rescellés et pente refaite, à l'heure."],
    ["Mano de obra — reparación de canaletas", "Tramos caídos recolgados con ganchos nuevos, uniones con fuga reselladas y pendiente corregida, por hora."],
    ["Manodopera — riparazione grondaie", "Tratti ceduti riappesi con staffe nuove, giunti che perdono risigillati e pendenza ripristinata, a ore."],
    ["Arbeit — Dachrinnenreparatur", "Durchhängende Rinnen an neuen Haltern aufgehängt, undichte Nähte neu abgedichtet und Gefälle neu eingestellt, nach Stunden."],
    ["Робота — ремонт ринв", "Провислі ділянки перевішано на нові гаки, протікаючі шви загерметизовано, ухил виправлено, погодинно."],
    ["Labor — pag-ayos ng gutter", "Isinabit ulit sa bagong hanger ang lumubog na bahagi, sinelyuhan ang tumutulong dugtungan at inayos ang slope, kada oras."],
  )),
  gutterParts: (price) => L.material(1, "flat", price, tx(
    ["Hangers, sealant and gutter patch", "Hidden hangers with screws, gutter sealant and patch stock for the repair."],
    ["Crochets, scellant et pièce de gouttière", "Crochets dissimulés avec vis, scellant à gouttière et pièce de réparation."],
    ["Ganchos, sellador y parche de canaleta", "Ganchos ocultos con tornillos, sellador de canaletas y material de parche."],
    ["Staffe, sigillante e toppa per grondaia", "Staffe nascoste con viti, sigillante per grondaie e materiale per toppe."],
    ["Halter, Dichtstoff und Rinnenflicken", "Verdeckte Halter mit Schrauben, Rinnendichtstoff und Flickmaterial für die Reparatur."],
    ["Гаки, герметик і латка для ринви", "Приховані гаки з шурупами, герметик для ринв і матеріал для латки."],
    ["Hanger, sealant at patch ng gutter", "Hidden hanger na may turnilyo, gutter sealant at patch para sa pag-ayos."],
  )),
  sidingHours: (qty) => hours(qty, 95, tx(
    ["Siding repair labour", "Damaged panels unlocked and cut out, the wrap patched and new panels locked in, by the hour."],
    ["Main-d'œuvre — réparation de revêtement", "Panneaux abîmés décrochés et retirés, pare-air réparé et nouveaux panneaux emboîtés, à l'heure."],
    ["Mano de obra — reparación de revestimiento", "Paneles dañados destrabados y retirados, membrana parchada y paneles nuevos trabados, por hora."],
    ["Manodopera — riparazione rivestimento", "Doghe danneggiate sganciate e tolte, telo riparato e nuove doghe agganciate, a ore."],
    ["Arbeit — Fassadenreparatur", "Beschädigte Paneele ausgehakt und herausgeschnitten, Winddichtung geflickt und neue Paneele eingeklickt, nach Stunden."],
    ["Робота — ремонт сайдингу", "Пошкоджені панелі розчеплено й вирізано, мембрану залатано, нові панелі защеплено, погодинно."],
    ["Labor — pag-ayos ng siding", "Kinalas at tinanggal ang sirang panel, tinagpian ang wrap at ikinabit ang bagong panel, kada oras."],
  )),
  sidingPanels: (price) => L.material(1, "flat", price, tx(
    ["Matching siding panels and trim", "Siding panels and trim pieces matched as closely as the profile and colour allow."],
    ["Panneaux de revêtement et moulures assortis", "Panneaux et moulures aussi assortis que le profil et la couleur le permettent."],
    ["Paneles de revestimiento y molduras a juego", "Paneles y molduras lo más parecidos que permitan el perfil y el color."],
    ["Doghe di rivestimento e profili abbinati", "Doghe e profili abbinati per quanto lo consentono profilo e colore."],
    ["Passende Fassadenpaneele und Profile", "Paneele und Profile so passend, wie Profil und Farbe es zulassen."],
    ["Підібрані панелі сайдингу та планки", "Панелі й планки, максимально підібрані за профілем і кольором."],
    ["Katernong siding panel at trim", "Siding panel at trim na pinakakatugma sa profile at kulay."],
  )),
  sofFasRepair: (price) => L.labour(1, "linear_ft", price, tx(
    ["Soffit and fascia repair — per linear ft", "Rotted board cut back to sound wood, new stock scarfed in, primed and fixed, soffit refitted."],
    ["Réparation de soffite et bordure — au pi lin.", "Planche pourrie coupée jusqu'au bois sain, nouvelle pièce ajustée, apprêtée et fixée, soffite reposé."],
    ["Reparación de sofito y fascia — por pie lineal", "Tabla podrida cortada hasta madera sana, pieza nueva empalmada, imprimada y fijada, sofito recolocado."],
    ["Riparazione sottogronda e frontalino — al piede lineare", "Tavola marcia tagliata fino al legno sano, nuovo pezzo giuntato, trattato e fissato, sottogronda rimontato."],
    ["Untersicht und Stirnbrett reparieren — pro lfd. Fuß", "Morsches Brett bis ins gesunde Holz zurückgeschnitten, neues Stück angeschäftet, grundiert und befestigt, Untersicht wieder montiert."],
    ["Ремонт софітів і лобової дошки — за пог. фут", "Гнилу дошку зрізано до здорової деревини, нову вставку зрощено, заґрунтовано й закріплено, софіт повернуто."],
    ["Pag-ayos ng soffit at fascia — kada linear ft", "Pinutol ang bulok na tabla hanggang matibay na kahoy, isiningit ang bago, prinimer at ikinabit, at ibinalik ang soffit."],
  ), { measurementKey: "linearFt" }),
  sofFasStock: (price) => L.material(1, "linear_ft", price, tx(
    ["Soffit and fascia stock — per linear ft", "Primed fascia board, soffit panel and fasteners for the repaired run."],
    ["Matériaux de soffite et bordure — au pi lin.", "Planche de bordure apprêtée, panneau de soffite et fixations pour la section réparée."],
    ["Material de sofito y fascia — por pie lineal", "Tabla de fascia imprimada, panel de sofito y fijaciones para el tramo reparado."],
    ["Materiale per sottogronda e frontalino — al piede lineare", "Tavola frontalino trattata, pannello sottogronda e fissaggi per il tratto riparato."],
    ["Material für Untersicht und Stirnbrett — pro lfd. Fuß", "Grundiertes Stirnbrett, Untersichtpaneel und Befestigungen für das reparierte Stück."],
    ["Матеріали для софітів і лобової дошки — за пог. фут", "Заґрунтована лобова дошка, софітна панель і кріплення для відремонтованої ділянки."],
    ["Materyales ng soffit at fascia — kada linear ft", "Primed na fascia board, soffit panel at fastener para sa inayos na bahagi."],
  ), { measurementKey: "linearFt" }),
};

const R = (key) => `fq.roofing_service.${key}`;
const MORE_TEMPLATES = {
  // ── Components ──
  [R("components.melt_system")]: T("installation", nm(R("components.melt_system")), [RF.heatCableLab(9), RF.heatCable(6), RF.controller(250), SHARED.consumables(45)], null),
  [R("components.flashing")]: T("installation", nm(R("components.flashing")), [RF.setUp(125), RF.flashingLab(14), RF.flashingMat(4)], null),
  [R("components.roof_vents")]: T("installation", nm(R("components.roof_vents")), [RF.ventCutIn(150), RF.roofVent()], null),
  [R("components.soffit_fascia")]: T("installation", nm(R("components.soffit_fascia")), [RF.sofFasLab(12), RF.sofFasMat(8), SHARED.haulAway(150)], D.newCustomer("fixed", 100)),
  [R("components.chimney_cricket")]: T("installation", nm(R("components.chimney_cricket")), [RF.cricketFrame(450), RF.cricketMat(225), RF.cricketTieIn(175)], null),
  [R("components.insulation")]: T("installation", nm(R("components.insulation")), [RF.insulLab(0.85), RF.insulRoll("footprintSqft"), RF.baffles(150)], null, { categories: ["roofing_service", "insulation"] }),
  [R("components.siding")]: T("installation", nm(R("components.siding")), [RF.sidingLab(3.5), RF.vinylSiding(), RF.houseWrap(), RF.sidingTrim(275)], D.newCustomer("fixed", 250), { categories: ["roofing_service", "siding"] }),
  [R("components.windows")]: T("installation", nm(R("components.windows")), [RF.windowLab(225), RF.windowUnit(350), RF.windowFlash(35)], null),

  // ── Repair ──
  [R("repair.asphalt_shingle")]: T("repair", nm(R("repair.asphalt_shingle")), [CALL(), RF.shingleHours(2), RF.matchingShingles()], null),
  [R("repair.cracked_shingles")]: T("repair", nm(R("repair.cracked_shingles")), [CALL(), RF.shingleHours(1.5), RF.matchingShingles()], null),
  [R("repair.clay_tile")]: T("repair", nm(R("repair.clay_tile")), [CALL(), RF.tileHours(3), RF.clayTiles(150)], null),
  [R("repair.concrete_tile")]: T("repair", nm(R("repair.concrete_tile")), [CALL(), RF.tileHours(3), RF.concreteTiles(110)], null),
  [R("repair.melt_system")]: T("repair", nm(R("repair.melt_system")), [CALL(), RF.cableRepairHours(1.5), RF.cableSplice(85)], null),
  [R("repair.metal")]: T("repair", nm(R("repair.metal")), [CALL(), RF.metalHours(2), RF.metalPatch(110)], null),
  [R("repair.other_materials")]: T("repair", nm(R("repair.other_materials")), [CALL(), RF.generalHours(2), SHARED.materialsAllowance(100)], null),
  [R("repair.rolled_flat")]: T("repair", nm(R("repair.rolled_flat")), [CALL(), RF.flatHours(2), RF.modBitPatch(120)], null),
  [R("repair.slate")]: T("repair", nm(R("repair.slate")), [CALL(), RF.slateHours(3), RF.slates(140)], null),
  [R("repair.soffit_fascia")]: T("repair", nm(R("repair.soffit_fascia")), [CALL(), RF.sofFasRepair(18), RF.sofFasStock(7)], null),
  [R("repair.solar_shingle")]: T("repair", nm(R("repair.solar_shingle")), [SHARED.serviceCall(150), RF.solarHours(3), RF.solarShingle(450), RF.solarCheck(175)], null, { categories: ["roofing_service", "solar_energy"] }),
  [R("repair.vinyl")]: T("repair", nm(R("repair.vinyl")), [CALL(), RF.membraneHours(2), RF.pvcPatch(95)], null),
  [R("repair.wood_shake")]: T("repair", nm(R("repair.wood_shake")), [CALL(), RF.shakeHours(2.5), RF.shakes(120)], null),
  [R("repair.chimney_cricket")]: T("repair", nm(R("repair.chimney_cricket")), [CALL(), RF.cricketReflash(375), RF.flashingKit(120)], null, { categories: ["roofing_service", "chimney_sweep"] }),
  [R("repair.gutters")]: T("repair", nm(R("repair.gutters")), [CALL(), RF.gutterHours(1.5), RF.gutterParts(45)], null),
  [R("repair.insulation")]: T("repair", nm(R("repair.insulation")), [RF.insulRemove(1.25), RF.insulRoll("areaSqFt"), SHARED.disposalFee(75)], null, { categories: ["roofing_service", "insulation"] }),
  [R("repair.siding")]: T("repair", nm(R("repair.siding")), [CALL(), RF.sidingHours(2), RF.sidingPanels(120), SHARED.consumables(35)], null, { categories: ["roofing_service", "siding"] }),
  [R("repair.windows")]: T("repair", nm(R("repair.windows")), [RF.windowReseal(175), RF.windowFlash(35)], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, { ...TEMPLATES, ...MORE_TEMPLATES });
