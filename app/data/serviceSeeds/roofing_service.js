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

import { L, SHARED, D, T, withTemplates, hdMaterial } from "./_templateLines";
import { HD } from "./_materialCosts";

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

withTemplates(SEED, TEMPLATES);
