// app/data/serviceSeeds/flooring_install.js
//
// The service list a flooring installer starts from. Read ./index.js for the
// format and the rules. The benchmark's flooring book is a grid — install or
// repair × material × where in the home — with no pricing insight on any row,
// so the grid is built here from one table per material and one per location
// rather than written out seventy times. Every generated row is a real,
// distinct service with its own key; the shape is identical to the hand-
// written files. Rows are emitted in the source's order so the join-back map
// lines up. Hardwood REFINISHING is the `flooring` trade's takeoff and is not
// in this book at all.

import { L as TL, SHARED, D, T, withTemplates, hdMaterial, tagRows, withLanguages } from "./_templateLines";
import { HD } from "./_materialCosts";
import { I18N } from "./i18n/flooring_install.js";

const L = {
  basement: { key: "basement", en: "basement", fr: "au sous-sol", es: "en el sótano" },
  driveway: { key: "driveway", en: "driveway", fr: "dans l'entrée", es: "en la entrada" },
  garage: { key: "garage", en: "garage", fr: "dans le garage", es: "en el garaje" },
  interior: { key: "interior", en: "interior", fr: "à l'intérieur", es: "en el interior" },
  exterior: { key: "exterior", en: "exterior", fr: "à l'extérieur", es: "en el exterior" },
};

// [slug, name{en,fr,es}, install description{en,fr,es}, repair description{en,fr,es}, unit]
const M = {
  carpet: ["carpet", { en: "Carpet", fr: "Tapis", es: "Alfombra" },
    { en: "New carpet and underpad laid over a prepared subfloor, seams placed out of sight and edges tucked", fr: "Nouveau tapis et sous-tapis posés sur un sous-plancher préparé, joints placés hors de vue et bordures rentrées", es: "Alfombra nueva y bajoalfombra colocadas sobre un subpiso preparado, con uniones fuera de la vista y bordes remetidos" },
    { en: "Torn, burnt or loose sections of carpet patched, re-seamed or re-secured", fr: "Sections de tapis déchirées, brûlées ou décollées rapiécées, rejointes ou refixées", es: "Secciones de alfombra rotas, quemadas o sueltas parchadas, reunidas o reaseguradas" }, "sqft"],
  epoxy: ["epoxy_coating", { en: "Epoxy or coating floor", fr: "Plancher époxy ou revêtement", es: "Piso de epoxi o recubrimiento" },
    { en: "The slab ground and cleaned, then an epoxy or polyaspartic coating applied", fr: "Dalle meulée et nettoyée, puis revêtement époxy ou polyaspartique appliqué", es: "Losa pulida y limpiada, y luego un recubrimiento epóxico o poliaspártico aplicado" },
    { en: "Peeling, chipped or stained coating repaired and blended into the surrounding floor", fr: "Revêtement qui pèle, éclaté ou taché réparé et fondu dans le plancher environnant", es: "Recubrimiento descascarado, desconchado o manchado reparado y fundido con el piso alrededor" }, "sqft"],
  concrete: ["concrete", { en: "Concrete floor", fr: "Plancher de béton", es: "Piso de concreto" },
    { en: "Concrete formed, poured and finished level", fr: "Béton coffré, coulé et fini de niveau", es: "Concreto cimbrado, vaciado y acabado a nivel" },
    { en: "Cracked or spalled concrete repaired and resurfaced", fr: "Béton fissuré ou écaillé réparé et resurfacé", es: "Concreto agrietado o descascarado reparado y resuperficiado" }, "sqft"],
  engineered: ["engineered_wood", { en: "Engineered wood flooring", fr: "Plancher de bois d'ingénierie", es: "Piso de madera de ingeniería" },
    { en: "Engineered wood planks installed floating, glued or nailed as the product requires, with transitions", fr: "Planches de bois d'ingénierie posées flottantes, collées ou clouées selon le produit, avec transitions", es: "Tablas de madera de ingeniería instaladas flotantes, pegadas o clavadas según el producto, con transiciones" },
    { en: "Damaged engineered planks removed and replaced to match", fr: "Planches d'ingénierie abîmées retirées et remplacées à l'identique", es: "Tablas de ingeniería dañadas retiradas y reemplazadas a juego" }, "sqft"],
  subfloor: ["subfloor", { en: "Subfloor", fr: "Sous-plancher", es: "Subpiso" },
    { en: "New subfloor sheathing laid, fastened and levelled ready for the finish floor", fr: "Nouveau sous-plancher posé, fixé et nivelé, prêt pour le revêtement de finition", es: "Subpiso nuevo colocado, fijado y nivelado, listo para el piso de acabado" },
    { en: "Soft, rotten or squeaking subfloor cut out and replaced", fr: "Sous-plancher mou, pourri ou qui craque découpé et remplacé", es: "Subpiso blando, podrido o que rechina cortado y reemplazado" }, "sqft"],
  tile: ["tile", { en: "Tile floor", fr: "Plancher de céramique", es: "Piso de azulejo" },
    { en: "Tile set on a prepared substrate, grouted and sealed", fr: "Carreaux posés sur un support préparé, jointoyés et scellés", es: "Azulejo colocado sobre una base preparada, lechadeado y sellado" },
    { en: "Cracked or loose tiles lifted and replaced, grout matched", fr: "Carreaux fissurés ou décollés retirés et remplacés, joints assortis", es: "Azulejos agrietados o sueltos retirados y reemplazados, con lechada a juego" }, "sqft"],
  vinyl: ["vinyl", { en: "Vinyl flooring", fr: "Plancher de vinyle", es: "Piso vinílico" },
    { en: "Vinyl plank or sheet laid over a smooth, prepared subfloor with transitions", fr: "Vinyle en planches ou en rouleau posé sur un sous-plancher lisse et préparé, avec transitions", es: "Vinilo en tablas o rollo instalado sobre un subpiso liso y preparado, con transiciones" },
    { en: "Lifted, torn or gouged vinyl repaired or the section replaced", fr: "Vinyle soulevé, déchiré ou entaillé réparé ou section remplacée", es: "Vinilo levantado, roto o rayado reparado o la sección reemplazada" }, "sqft"],
  wood: ["wood", { en: "Hardwood flooring", fr: "Plancher de bois franc", es: "Piso de madera dura" },
    { en: "Solid hardwood nailed down over a prepared subfloor and finished", fr: "Bois franc massif cloué sur un sous-plancher préparé et fini", es: "Madera dura maciza clavada sobre un subpiso preparado y terminada" },
    { en: "Damaged hardwood boards cut out and replaced, then blended into the finish", fr: "Planches de bois franc abîmées découpées et remplacées, puis fondues dans le fini", es: "Tablas de madera dañadas cortadas y reemplazadas, y luego integradas al acabado" }, "sqft"],
  pavers: ["pavers", { en: "Pavers", fr: "Pavés", es: "Adoquines" },
    { en: "Pavers laid on a compacted base and bedding sand, edged and jointed", fr: "Pavés posés sur une fondation compactée et un lit de sable, bordés et jointoyés", es: "Adoquines colocados sobre una base compactada y cama de arena, con bordes y juntas" },
    { en: "Sunken or heaved pavers lifted, the base corrected and the pavers relaid", fr: "Pavés affaissés ou soulevés retirés, fondation corrigée et pavés reposés", es: "Adoquines hundidos o levantados retirados, la base corregida y los adoquines recolocados" }, "sqft"],
  blacktop: ["blacktop", { en: "Asphalt", fr: "Asphalte", es: "Asfalto" },
    { en: "Hot-mix asphalt laid and compacted over a graded base", fr: "Asphalte à chaud posé et compacté sur une fondation nivelée", es: "Asfalto en caliente tendido y compactado sobre una base nivelada" },
    { en: "Potholes and cracks in the asphalt cut out, filled and sealed", fr: "Nids-de-poule et fissures de l'asphalte découpés, remplis et scellés", es: "Baches y grietas del asfalto cortados, rellenados y sellados" }, "sqft"],
  wood_deck: ["wood_deck", { en: "Wood deck", fr: "Terrasse en bois", es: "Terraza de madera" },
    { en: "Wood decking laid over the frame, fastened and finished", fr: "Lattes de bois posées sur la structure, fixées et finies", es: "Entablado de madera colocado sobre la estructura, fijado y terminado" },
    { en: "Rotten or split deck boards replaced and refinished", fr: "Planches de terrasse pourries ou fendues remplacées et refinies", es: "Tablas de terraza podridas o partidas reemplazadas y refinadas" }, "sqft"],
  composite_deck: ["composite_deck", { en: "Composite deck", fr: "Terrasse en composite", es: "Terraza de compuesto" },
    { en: "Composite decking laid over the frame with hidden fasteners", fr: "Lattes en composite posées sur la structure avec fixations invisibles", es: "Entablado compuesto colocado sobre la estructura con fijaciones ocultas" },
    { en: "Damaged composite boards swapped and the fasteners reset", fr: "Planches en composite abîmées remplacées et fixations reposées", es: "Tablas compuestas dañadas cambiadas y las fijaciones reajustadas" }, "sqft"],
};

// Repair-only work that has no matching install.
const R = {
  carpet_stretching: [{ en: "Carpet stretching", fr: "Étirement de tapis", es: "Estirado de alfombra" }, { en: "Wrinkled carpet power-stretched and re-secured to the tack strip", fr: "Tapis plissé retendu à la machine et refixé à la bande à clous", es: "Alfombra arrugada estirada con máquina y reasegurada a la tira de clavos" }],
  concrete_repour: [{ en: "Concrete re-pour", fr: "Recoulage de béton", es: "Revaciado de concreto" }, { en: "Failed concrete broken out and a new slab poured and finished", fr: "Béton défaillant démoli et nouvelle dalle coulée et finie", es: "Concreto dañado demolido y una losa nueva vaciada y acabada" }],
  concrete_removal: [{ en: "Concrete removal", fr: "Enlèvement de béton", es: "Retiro de concreto" }, { en: "Old concrete broken up, loaded and hauled away", fr: "Vieux béton cassé, chargé et emporté", es: "Concreto viejo demolido, cargado y llevado" }],
  concrete_polishing: [{ en: "Concrete polishing", fr: "Polissage de béton", es: "Pulido de concreto" }, { en: "The slab ground and polished through successive grits to a finished sheen", fr: "Dalle meulée et polie par grains successifs jusqu'au lustre voulu", es: "Losa pulida en granos sucesivos hasta el brillo deseado" }],
  concrete_sealing: [{ en: "Concrete sealing", fr: "Scellement de béton", es: "Sellado de concreto" }, { en: "The slab cleaned and a penetrating or film sealer applied", fr: "Dalle nettoyée et scellant pénétrant ou pelliculaire appliqué", es: "Losa limpiada y un sellador penetrante o de película aplicado" }],
};

const other = (kind) => ({
  seedKey: `fq.flooring_install.${kind}.other`,
  category: kind,
  name: { en: `Other flooring ${kind === "install" ? "installation" : "repair"} — describe what you need`, fr: `Autre ${kind === "install" ? "installation" : "réparation"} de plancher — décrivez le besoin`, es: `Otra ${kind === "install" ? "instalación" : "reparación"} de piso — describa lo que necesita` },
  description: { en: "Flooring work not listed above, priced after a look at the job.", fr: "Travail de plancher non listé ci-dessus, chiffré après examen sur place.", es: "Trabajo de piso no listado arriba, cotizado después de ver el trabajo." },
  unit: "flat", benchmark: null, durationMinutes: null, bookable: false,
});

const install = (m, loc) => {
  const [slug, name, desc, , unit] = M[m];
  return {
    seedKey: `fq.flooring_install.install.${slug}_${loc.key}`,
    category: "install",
    name: { en: `${name.en} installation — ${loc.en}`, fr: `Installation — ${name.fr.toLowerCase()} ${loc.fr}`, es: `Instalación — ${name.es.toLowerCase()} ${loc.es}` },
    description: { en: `${desc.en}, in the ${loc.en}.`, fr: `${desc.fr}, ${loc.fr}.`, es: `${desc.es}, ${loc.es}.` },
    unit, benchmark: null, durationMinutes: null, bookable: false,
  };
};
const repair = (m, loc) => {
  const [slug, name, , desc, unit] = M[m];
  return {
    seedKey: `fq.flooring_install.repair.${slug}_${loc.key}`,
    category: "repair",
    name: { en: `${name.en} repair — ${loc.en}`, fr: `Réparation — ${name.fr.toLowerCase()} ${loc.fr}`, es: `Reparación — ${name.es.toLowerCase()} ${loc.es}` },
    description: { en: `${desc.en}, in the ${loc.en}.`, fr: `${desc.fr}, ${loc.fr}.`, es: `${desc.es}, ${loc.es}.` },
    unit, benchmark: null, durationMinutes: null, bookable: false,
  };
};
const repairOnly = (r, loc) => {
  const [name, desc] = R[r];
  return {
    seedKey: `fq.flooring_install.repair.${r}_${loc.key}`,
    category: "repair",
    name: { en: `${name.en} — ${loc.en}`, fr: `${name.fr} — ${loc.fr}`, es: `${name.es} — ${loc.es}` },
    description: { en: `${desc.en}, in the ${loc.en}.`, fr: `${desc.fr}, ${loc.fr}.`, es: `${desc.es}, ${loc.es}.` },
    unit: "sqft", benchmark: null, durationMinutes: null, bookable: false,
  };
};

export const SEED = {
  trade: "flooring_install",
  categories: [
    { key: "install", name: { en: "Flooring installation", fr: "Pose de planchers", es: "Instalación de pisos" } },
    { key: "repair", name: { en: "Flooring repair", fr: "Réparation de planchers", es: "Reparación de pisos" } },
    // Two headings added 2026-09-24 with the estimate templates: the grid had
    // no visit and no care row, and a template needs one under each heading.
    { key: "visits", name: { en: "Measures and inspections", fr: "Mesures et inspections", es: "Mediciones e inspecciones" } },
    { key: "maintenance", name: { en: "Floor care and maintenance", fr: "Entretien des planchers", es: "Cuidado y mantenimiento de pisos" } },
  ],
  services: [
    // Installation — source order: basement, driveway, garage, interior, exterior, other
    install("carpet", L.basement), install("epoxy", L.basement), install("concrete", L.basement), install("engineered", L.basement), install("subfloor", L.basement), install("tile", L.basement), install("vinyl", L.basement), install("wood", L.basement),
    install("pavers", L.driveway), install("blacktop", L.driveway), install("epoxy", L.driveway), install("concrete", L.driveway),
    install("epoxy", L.garage), install("concrete", L.garage), install("tile", L.garage),
    install("carpet", L.interior), install("epoxy", L.interior), install("concrete", L.interior), install("engineered", L.interior), install("subfloor", L.interior), install("tile", L.interior), install("vinyl", L.interior), install("wood", L.interior),
    install("epoxy", L.exterior), install("concrete", L.exterior), install("wood_deck", L.exterior), install("composite_deck", L.exterior), install("tile", L.exterior), install("wood", L.exterior),
    other("install"),
    // Repair
    repair("carpet", L.basement), repairOnly("carpet_stretching", L.basement), repair("epoxy", L.basement), repairOnly("concrete_repour", L.basement), repairOnly("concrete_removal", L.basement), repair("engineered", L.basement), repair("subfloor", L.basement), repair("tile", L.basement), repair("vinyl", L.basement), repair("wood", L.basement), repairOnly("concrete_polishing", L.basement), repairOnly("concrete_sealing", L.basement),
    repair("pavers", L.driveway), repair("blacktop", L.driveway), repair("epoxy", L.driveway), repairOnly("concrete_polishing", L.driveway), repairOnly("concrete_repour", L.driveway), repairOnly("concrete_sealing", L.driveway),
    repair("epoxy", L.garage), repairOnly("concrete_repour", L.garage), repair("tile", L.garage), repairOnly("concrete_sealing", L.garage),
    repair("carpet", L.interior), repairOnly("carpet_stretching", L.interior), repair("epoxy", L.interior), repairOnly("concrete_repour", L.interior), repair("engineered", L.interior), repair("subfloor", L.interior), repair("tile", L.interior), repair("vinyl", L.interior), repair("wood", L.interior), repairOnly("concrete_sealing", L.interior),
    repair("epoxy", L.exterior), repair("concrete", L.exterior), repair("wood_deck", L.exterior), repair("composite_deck", L.exterior), repair("tile", L.exterior), repair("wood", L.exterior), repairOnly("concrete_sealing", L.exterior),
    other("repair"),
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    { seedKey: "fq.flooring_install.install.transitions_trim", category: "install", name: { en: "Transition strips and trim — per linear ft", fr: "Moulures de transition et plinthes — au pi lin.", es: "Molduras de transición y zoclo — por pie lineal" },
      description: { en: "Thresholds, transition strips and base or quarter-round trim fitted at the room boundaries, priced per linear foot.", fr: "Seuils, moulures de transition et plinthes ou quarts-de-rond posés aux limites des pièces, au pied linéaire.", es: "Umbrales, molduras de transición y zoclo o cuarto bocel colocados en los límites de la habitación, por pie lineal." },
      unit: "linear_ft", benchmark: null, durationMinutes: null, bookable: false },
    { seedKey: "fq.flooring_install.visits.measure_visit", category: "visits", name: { en: "On-site measure and estimate", fr: "Mesure sur place et soumission", es: "Medición en sitio y presupuesto" },
      description: { en: "Every room measured, the subfloor looked at and a written price left for the flooring the client has in mind.", fr: "Chaque pièce mesurée, sous-plancher examiné et prix écrit laissé pour le plancher que le client envisage.", es: "Cada habitación medida, el subpiso revisado y un precio por escrito para el piso que el cliente tiene en mente." },
      unit: "flat", benchmark: null, durationMinutes: 60, bookable: true },
    { seedKey: "fq.flooring_install.visits.moisture_test", category: "visits", name: { en: "Subfloor moisture test", fr: "Test d'humidité du sous-plancher", es: "Prueba de humedad del subpiso" },
      description: { en: "Slab or wood subfloor moisture measured with a calibrated meter before any floor goes down, with the readings written up.", fr: "Humidité de la dalle ou du sous-plancher de bois mesurée avec un appareil étalonné avant toute pose, lectures consignées.", es: "Humedad de la losa o del subpiso de madera medida con un medidor calibrado antes de instalar cualquier piso, con las lecturas anotadas." },
      unit: "flat", benchmark: null, durationMinutes: null, bookable: false },
    { seedKey: "fq.flooring_install.visits.floor_inspection", category: "visits", name: { en: "Flooring condition inspection", fr: "Inspection de l'état du plancher", es: "Inspección del estado del piso" },
      description: { en: "Cupping, gaps, squeaks, cracked tile or lifting vinyl looked at and the cause explained, with repair or replacement priced.", fr: "Tuilage, espaces, craquements, carreaux fissurés ou vinyle qui lève examinés et cause expliquée, réparation ou remplacement chiffré.", es: "Abarquillado, separaciones, rechinidos, azulejo agrietado o vinilo levantado revisados y la causa explicada, con reparación o reemplazo cotizado." },
      unit: "flat", benchmark: null, durationMinutes: null, bookable: false },
    { seedKey: "fq.flooring_install.maintenance.hardwood_screen_recoat", category: "maintenance", name: { en: "Hardwood screen and recoat", fr: "Sablage léger et nouvelle couche de fini — bois franc", es: "Lijado ligero y nueva capa de acabado — madera dura" },
      description: { en: "The finish abraded and a fresh coat applied without sanding to bare wood, for a floor that is dull but not damaged.", fr: "Fini abrasé et nouvelle couche appliquée sans sabler jusqu'au bois nu, pour un plancher terne mais pas abîmé.", es: "Acabado desgastado y una capa nueva aplicada sin lijar hasta la madera, para un piso opaco pero no dañado." },
      unit: "sqft", benchmark: null, durationMinutes: null, bookable: false },
    { seedKey: "fq.flooring_install.maintenance.tile_grout_seal", category: "maintenance", name: { en: "Tile and grout cleaning and sealing", fr: "Nettoyage et scellement de céramique et de coulis", es: "Limpieza y sellado de azulejo y lechada" },
      description: { en: "Tile and grout deep-cleaned and a penetrating sealer applied so the grout stops taking stains.", fr: "Céramique et coulis nettoyés en profondeur et scellant pénétrant appliqué pour que le coulis cesse de tacher.", es: "Azulejo y lechada limpiados a fondo y un sellador penetrante aplicado para que la lechada deje de mancharse." },
      unit: "sqft", benchmark: null, durationMinutes: null, bookable: false },
    { seedKey: "fq.flooring_install.maintenance.deck_clean_reseal", category: "maintenance", name: { en: "Deck cleaning and resealing", fr: "Nettoyage et rescellement de terrasse", es: "Limpieza y resellado de terraza" },
      description: { en: "Deck boards washed, brightened and resealed to keep water out of the wood.", fr: "Planches de terrasse lavées, ravivées et rescellées pour garder l'eau hors du bois.", es: "Tablas de la terraza lavadas, avivadas y reselladas para que el agua no entre en la madera." },
      unit: "sqft", benchmark: null, durationMinutes: null, bookable: false },
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: three flooring templates captured on 2026-09-24 from a competitor
// trial signed up as construction and remodelling (docs/research/, the
// construction estimate-template capture) — subfloor prep at $2.50 a sq ft,
// laminate or LVP install labour at $3.50 a sq ft, transition strips and trim
// at $6 a linear ft, all labour-only with a zero cost. Those three are kept
// at their prices with our 50% labour cost; the materials beside them and
// the other nine templates are trade figures for 2026 — LVP $2.75–3.50 a
// sq ft at the flooring supplier, 3/4-in oak $5–7, porcelain tile $3–5,
// hardwood install labour $4–5 a sq ft nailed, tile labour $8–10.
//
// Every per-sq-ft and per-linear-ft line carries a measurement key and keeps
// qty 1: the app fills floor area (`areaSqFt`) or the perimeter run
// (`linearFt`) from the room takeoff.
const TEMPLATES = {
  // ── Installation ──
  "fq.flooring_install.install.subfloor_interior": T("installation", {
    it: ["Posa sottofondo — interni", "Nuovo pannello di sottofondo posato, fissato e livellato, pronto per il pavimento finito, all'interno."],
    de: ["Unterbodenverlegung — innen", "Neue Unterbodenplatten verlegt, befestigt und nivelliert, bereit für den Oberboden, im Innenbereich."],
    uk: ["Влаштування чорнової підлоги — інтер'єр", "Нові листи чорнової підлоги покладено, закріплено та вирівняно під чистове покриття, всередині."],
    tl: ["Pagkabit ng subfloor — loob ng bahay", "Bagong subfloor sheathing na inilatag, ikinabit at nilevel para sa finish floor, sa loob."],
  }, [
    TL.labour(1, "sqft", 2.5, {
      en: ["Subfloor prep and levelling labour — per sq ft", "Moisture tested, levelling compound applied and minor subfloor repairs made."],
      fr: ["Main-d'œuvre — préparation et nivellement du sous-plancher, au pi²", "Humidité testée, composé de nivellement appliqué et petites réparations du sous-plancher faites."],
      es: ["Mano de obra — preparación y nivelación del subpiso, por pie²", "Humedad medida, compuesto nivelador aplicado y reparaciones menores del subpiso hechas."],
      it: ["Manodopera — preparazione e livellamento sottofondo, al piede quadro", "Umidità testata, autolivellante applicato e piccole riparazioni del sottofondo eseguite."],
      de: ["Arbeit — Unterboden vorbereiten und nivellieren, pro sq ft", "Feuchte gemessen, Ausgleichsmasse aufgebracht und kleine Unterbodenreparaturen gemacht."],
      uk: ["Робота — підготовка та вирівнювання чорнової підлоги, за кв. фут", "Вологість перевірено, вирівнювальну суміш нанесено, дрібні ремонти чорнової підлоги виконано."],
      tl: ["Labor — prep at leveling ng subfloor, kada sq ft", "Tinest ang moisture, nilagyan ng leveling compound at inayos ang maliliit na sira sa subfloor."],
    }, { measurementKey: "areaSqFt" }),
    TL.material(1, "sqft", 1.1, {
      en: ["Levelling compound and fasteners — per sq ft", "Self-levelling compound, primer and screws."],
      fr: ["Composé de nivellement et fixations — au pi²", "Composé autonivelant, apprêt et vis."],
      es: ["Compuesto nivelador y tornillería — por pie²", "Compuesto autonivelante, imprimador y tornillos."],
      it: ["Autolivellante e viti — al piede quadro", "Autolivellante, primer e viti."],
      de: ["Ausgleichsmasse und Schrauben — pro sq ft", "Selbstverlaufende Ausgleichsmasse, Grundierung und Schrauben."],
      uk: ["Вирівнювальна суміш і кріплення — за кв. фут", "Самовирівнювальна суміш, ґрунтовка та саморізи."],
      tl: ["Leveling compound at turnilyo — kada sq ft", "Self-leveling compound, primer at turnilyo."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  "fq.flooring_install.install.vinyl_interior": T("installation", {
    it: ["Posa pavimento in vinile — interni", "Vinile in doghe o in rotolo posato su un sottofondo liscio e preparato, con profili di transizione, all'interno."],
    de: ["Vinylbodenverlegung — innen", "Vinylplanken oder Bahnenware auf glattem, vorbereitetem Unterboden verlegt, mit Übergangsprofilen, im Innenbereich."],
    uk: ["Укладання вінілової підлоги — інтер'єр", "Вінілові планки або рулон укладено на рівну підготовлену основу з перехідними профілями, всередині."],
    tl: ["Pagkabit ng vinyl flooring — loob ng bahay", "Vinyl plank o sheet na inilatag sa makinis at inihandang subfloor, may transition, sa loob."],
  }, [
    TL.labour(1, "sqft", 3.5, {
      en: ["Flooring installation labour — per sq ft, builder grade", "Laminate or LVP laid to the manufacturer's spec; materials billed separately."],
      fr: ["Main-d'œuvre — pose de plancher, au pi², gamme constructeur", "Stratifié ou vinyle en planches posé selon les directives du fabricant; matériaux facturés à part."],
      es: ["Mano de obra — instalación de piso, por pie², grado constructor", "Laminado o vinilo en tablas instalado según la especificación del fabricante; materiales facturados aparte."],
      it: ["Manodopera — posa pavimento, al piede quadro, grado base", "Laminato o vinile in doghe posato secondo le indicazioni del produttore; materiali fatturati a parte."],
      de: ["Arbeit — Bodenverlegung, pro sq ft, Standard", "Laminat oder Vinylplanken nach Herstellervorgabe verlegt; Material separat."],
      uk: ["Робота — укладання підлоги, за кв. фут, базовий рівень", "Ламінат або вінілові планки укладено за специфікацією виробника; матеріали окремо."],
      tl: ["Labor — pagkabit ng sahig, kada sq ft, builder grade", "Laminate o LVP na inilatag ayon sa spec ng manufacturer; hiwalay ang materyales."],
    }, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.lvp_box, {
      en: ["Luxury vinyl plank — per box", "Rigid-core click LVP with attached pad; about 22 sq ft a box (confirm per product)."],
      fr: ["Vinyle de luxe en planches — la boîte", "Vinyle à âme rigide à clic avec sous-couche intégrée; environ 22 pi² la boîte (à confirmer selon le produit)."],
      es: ["Vinilo de lujo en tablas — por caja", "Vinilo de núcleo rígido tipo clic con base integrada; unos 22 pies² por caja (confirmar según producto)."],
      it: ["Vinile LVP — per scatola", "LVP ad anima rigida a incastro con materassino; circa 22 piedi quadri a scatola (da verificare per prodotto)."],
      de: ["Vinylplanken — pro Karton", "Rigid-Core-Klick-LVP mit Unterlage; etwa 22 sq ft pro Karton (je Produkt prüfen)."],
      uk: ["Вінілові планки LVP — за коробку", "LVP із жорстким осердям на замку з підкладкою; близько 22 кв. футів у коробці (уточнити за товаром)."],
      tl: ["Luxury vinyl plank — kada kahon", "Rigid-core click LVP na may pad; mga 22 sq ft kada kahon (kumpirmahin ayon sa produkto)."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  "fq.flooring_install.install.transitions_trim": T("installation", {
    it: ["Profili di transizione e battiscopa — al piede lineare", "Soglie, profili di transizione e battiscopa o quarto tondo posati ai confini delle stanze, al piede lineare."],
    de: ["Übergangsprofile und Leisten — pro lfd. Fuß", "Schwellen, Übergangsprofile und Sockel- oder Viertelstableisten an den Raumgrenzen montiert, pro laufendem Fuß."],
    uk: ["Перехідні профілі та плінтуси — за пог. фут", "Пороги, перехідні профілі та плінтуси або галтелі встановлено на межах кімнат, за погонний фут."],
    tl: ["Transition strip at trim — kada linear ft", "Threshold, transition strip at base o quarter-round trim na ikinabit sa gilid ng kuwarto, kada linear ft."],
  }, [
    TL.labour(1, "linear_ft", 6, {
      en: ["Transition strip and trim installation — per linear ft", "Transition strips and trim fitted at the room boundaries."],
      fr: ["Pose de moulures de transition et de plinthes — au pi lin.", "Moulures de transition et plinthes posées aux limites des pièces."],
      es: ["Instalación de molduras de transición y zoclo — por pie lineal", "Molduras de transición y zoclo colocados en los límites de la habitación."],
      it: ["Posa profili di transizione e battiscopa — al piede lineare", "Profili di transizione e battiscopa posati ai confini delle stanze."],
      de: ["Montage von Übergangsprofilen und Leisten — pro lfd. Fuß", "Übergangsprofile und Leisten an den Raumgrenzen montiert."],
      uk: ["Встановлення перехідних профілів і плінтусів — за пог. фут", "Перехідні профілі та плінтуси встановлено на межах кімнат."],
      tl: ["Pagkabit ng transition strip at trim — kada linear ft", "Ikinabit ang transition strip at trim sa gilid ng kuwarto."],
    }, { measurementKey: "linearFt" }),
    hdMaterial(HD.baseboard_mdf_8ft, {
      en: ["Primed MDF baseboard", "3-1/4 in primed MDF baseboard in 8 ft lengths, sold singly or in packs; nails and caulk included."],
      fr: ["Plinthe en MDF apprêté", "Plinthe en MDF apprêté de 3 1/4 po en longueurs de 8 pi, à l'unité ou en paquet; clous et calfeutrant compris."],
      es: ["Zoclo de MDF imprimado", "Zoclo de MDF imprimado de 3-1/4 pulg en tramos de 8 pies, suelto o en paquete; clavos y sellador incluidos."],
      it: ["Battiscopa in MDF primerizzato", "Battiscopa in MDF primerizzato da 3-1/4 pollici in barre da 8 piedi, sfuse o in confezione; chiodi e sigillante inclusi."],
      de: ["Grundierte MDF-Sockelleiste", "3-1/4-Zoll-Sockelleiste aus grundiertem MDF in 8-Fuß-Längen, einzeln oder im Pack; Nägel und Acryl inklusive."],
      uk: ["Ґрунтований МДФ-плінтус", "Плінтус 3-1/4 дюйма з ґрунтованого МДФ довжиною 8 футів, поштучно або в упаковці; цвяхи й герметик включено."],
      tl: ["Primed MDF baseboard", "3-1/4 in primed MDF na baseboard na 8 ft ang haba, isa-isa o naka-pack; kasama ang pako at caulk."],
    }, { measurementKey: "linearFt" }),
  ], null),

  "fq.flooring_install.install.wood_interior": T("installation", {
    it: ["Posa parquet massello — interni", "Legno massello inchiodato su un sottofondo preparato e finito, all'interno."],
    de: ["Massivholzdielen verlegen — innen", "Massivholz auf vorbereitetem Unterboden genagelt und versiegelt, im Innenbereich."],
    uk: ["Укладання масивної дошки — інтер'єр", "Масивну деревину прибито на підготовлену чорнову підлогу та оброблено, всередині."],
    tl: ["Pagkabit ng hardwood flooring — loob ng bahay", "Solid hardwood na ipinako sa inihandang subfloor at tinapos, sa loob."],
  }, [
    TL.labour(1, "sqft", 4.5, {
      en: ["Hardwood installation labour — per sq ft", "Boards racked, nailed down over underlayment and the run finished at the walls."],
      fr: ["Main-d'œuvre — pose de bois franc, au pi²", "Planches disposées, clouées sur la sous-couche et finies aux murs."],
      es: ["Mano de obra — instalación de madera dura, por pie²", "Tablas acomodadas, clavadas sobre la base y rematadas en las paredes."],
      it: ["Manodopera — posa parquet, al piede quadro", "Doghe disposte, inchiodate sul materassino e rifinite alle pareti."],
      de: ["Arbeit — Dielen verlegen, pro sq ft", "Dielen ausgelegt, auf der Unterlage genagelt und an den Wänden abgeschlossen."],
      uk: ["Робота — укладання дошки, за кв. фут", "Дошки розкладено, прибито на підкладку та завершено біля стін."],
      tl: ["Labor — pagkabit ng hardwood, kada sq ft", "Inayos, ipinako sa underlayment at tinapos sa gilid ng pader ang mga tabla."],
    }, { measurementKey: "areaSqFt" }),
    TL.material(1, "sqft", 6.5, {
      en: ["Solid oak flooring — per sq ft", "3/4-in prefinished red oak, 3-1/4 in wide, plus 8% waste and underlayment."],
      fr: ["Plancher de chêne massif — au pi²", "Chêne rouge préfini de 3/4 po, 3 1/4 po de large, plus 8 % de perte et sous-couche."],
      es: ["Piso de roble macizo — por pie²", "Roble rojo prebarnizado de 3/4 pulg, 3-1/4 pulg de ancho, más 8 % de desperdicio y base."],
      it: ["Parquet di rovere massello — al piede quadro", "Rovere rosso prefinito da 3/4 di pollice, largo 3-1/4, più 8% di sfrido e materassino."],
      de: ["Eichendielen massiv — pro sq ft", "3/4-Zoll-Roteiche werkseitig versiegelt, 3-1/4 Zoll breit, plus 8 % Verschnitt und Unterlage."],
      uk: ["Масивна дубова дошка — за кв. фут", "Червоний дуб 3/4 дюйма з заводським покриттям, ширина 3-1/4 дюйма, плюс 8% на підрізку та підкладка."],
      tl: ["Solid oak flooring — kada sq ft", "3/4-in prefinished red oak, 3-1/4 in ang lapad, dagdag 8% tabas at underlayment."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  "fq.flooring_install.install.tile_interior": T("installation", {
    it: ["Posa pavimento in piastrelle — interni", "Piastrelle posate su un supporto preparato, stuccate e sigillate, all'interno."],
    de: ["Fliesenboden verlegen — innen", "Fliesen auf vorbereitetem Untergrund verlegt, verfugt und versiegelt, im Innenbereich."],
    uk: ["Укладання плитки на підлогу — інтер'єр", "Плитку викладено на підготовлену основу, зафуговано та загерметизовано, всередині."],
    tl: ["Pagkabit ng tile sa sahig — loob ng bahay", "Tile na inilagay sa inihandang base, ginrout at sinelyuhan, sa loob."],
  }, [
    TL.labour(1, "sqft", 9, {
      en: ["Tile setting labour — per sq ft", "Layout snapped, tile set in thinset, grouted and the perimeter caulked."],
      fr: ["Main-d'œuvre — pose de céramique, au pi²", "Tracé fait, carreaux posés au ciment-colle, jointoyés et pourtour calfeutré."],
      es: ["Mano de obra — colocación de azulejo, por pie²", "Trazo marcado, azulejo asentado en adhesivo, lechadeado y el perímetro sellado."],
      it: ["Manodopera — posa piastrelle, al piede quadro", "Tracciatura, piastrelle posate su colla, stuccate e perimetro sigillato."],
      de: ["Arbeit — Fliesen legen, pro sq ft", "Raster angerissen, Fliesen in Kleber gesetzt, verfugt und der Rand versiegelt."],
      uk: ["Робота — укладання плитки, за кв. фут", "Розмітку зроблено, плитку викладено на клей, зафуговано, периметр загерметизовано."],
      tl: ["Labor — pag-tile, kada sq ft", "Minarkahan ang layout, inilagay ang tile sa thinset, ginrout at kinaulk ang gilid."],
    }, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.tile_porcelain_case, {
      en: ["Porcelain tile — per case", "12 × 24 glazed porcelain; about 15.6 sq ft a case."],
      fr: ["Carreaux de porcelaine — la caisse", "Porcelaine émaillée 12 × 24; environ 15,6 pi² la caisse."],
      es: ["Porcelanato — por caja", "Porcelanato esmaltado de 12 × 24; unos 15.6 pies² por caja."],
      it: ["Gres porcellanato — per scatola", "Gres porcellanato smaltato 12 × 24; circa 15,6 piedi quadri a scatola."],
      de: ["Feinsteinzeug — pro Karton", "Glasiertes Feinsteinzeug 12 × 24; etwa 15,6 sq ft pro Karton."],
      uk: ["Керамограніт — за коробку", "Глазурований керамограніт 12 × 24; близько 15,6 кв. футів у коробці."],
      tl: ["Porcelain tile — kada kahon", "12 × 24 glazed porcelain; mga 15.6 sq ft kada kahon."],
    }, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.thinset_50lb, {
      en: ["Thinset mortar — per bag", "Modified thinset, 50 lb; one bag sets about 95 sq ft with a 1/4 in notch."],
      fr: ["Ciment-colle — le sac", "Ciment-colle modifié, 50 lb; un sac pose environ 95 pi² à la truelle de 1/4 po."],
      es: ["Adhesivo para azulejo — por bulto", "Adhesivo modificado, 50 lb; un bulto asienta unos 95 pies² con llana de 1/4 pulg."],
      it: ["Colla per piastrelle — al sacco", "Colla modificata, 50 lb; un sacco posa circa 95 piedi quadri con spatola da 1/4 di pollice."],
      de: ["Fliesenkleber — pro Sack", "Flexkleber, 50 lb; ein Sack reicht für etwa 95 sq ft mit 1/4-Zoll-Zahnung."],
      uk: ["Клей для плитки — за мішок", "Модифікований клей, 50 фунтів; мішок на близько 95 кв. футів гребінкою 1/4 дюйма."],
      tl: ["Thinset — kada sako", "Modified thinset, 50 lb; ang isang sako ay para sa mga 95 sq ft sa 1/4 in na notch."],
    }, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.grout_25lb, {
      en: ["Sanded grout", "Sanded grout for the joints; the quantity follows the coverage of the bag size the store sells."],
      fr: ["Coulis sablé", "Coulis sablé pour les joints; la quantité suit le rendement du format de sac vendu."],
      es: ["Lechada con arena", "Lechada con arena para las juntas; la cantidad sigue el rendimiento del tamaño de bolsa de la tienda."],
      it: ["Stucco sabbiato", "Stucco sabbiato per le fughe; la quantità segue la resa del formato del sacco in vendita."],
      de: ["Fugenmasse mit Sand", "Sandhaltige Fugenmasse; die Menge folgt der Ergiebigkeit der Sackgröße im Handel."],
      uk: ["Фуга з піском", "Фуга з піском для швів; кількість залежить від витрати мішка, який продає магазин."],
      tl: ["Sanded grout", "Sanded grout para sa joint; ang dami ay batay sa coverage ng laki ng sako sa tindahan."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  // ── Repair ──
  "fq.flooring_install.repair.carpet_stretching_interior": T("repair", {
    it: ["Ritensionamento moquette — interni", "Moquette ondulata ritesa con il tenditore e rifissata alla striscia di ancoraggio, all'interno."],
    de: ["Teppich nachspannen — innen", "Welligen Teppich mit dem Spanner nachgezogen und an der Nagelleiste neu befestigt, im Innenbereich."],
    uk: ["Натягування килимового покриття — інтер'єр", "Зморшкувате килимове покриття натягнуто стретчером і закріплено на планці з цвяхами, всередині."],
    tl: ["Pag-stretch ng carpet — loob ng bahay", "Kulubot na carpet na ini-power-stretch at ikinabit ulit sa tack strip, sa loob."],
  }, [
    SHARED.serviceCall(65),
    TL.labour(1, "sqft", 0.75, {
      en: ["Power stretching — per sq ft", "Furniture shifted, the carpet released, power-stretched and re-hooked on the tack strip."],
      fr: ["Étirement à la machine — au pi²", "Meubles déplacés, tapis détaché, retendu à la machine et raccroché à la bande à clous."],
      es: ["Estirado con máquina — por pie²", "Muebles movidos, alfombra soltada, estirada con máquina y reenganchada en la tira de clavos."],
      it: ["Ritensionamento — al piede quadro", "Mobili spostati, moquette liberata, ritesa con il tenditore e riagganciata alla striscia."],
      de: ["Nachspannen — pro sq ft", "Möbel verschoben, Teppich gelöst, nachgespannt und an der Nagelleiste neu eingehängt."],
      uk: ["Натягування стретчером — за кв. фут", "Меблі зсунуто, покриття звільнено, натягнуто та зачеплено на планку."],
      tl: ["Power stretching — kada sq ft", "Inilipat ang muwebles, tinanggal, ini-stretch at ikinabit ulit sa tack strip ang carpet."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  "fq.flooring_install.repair.wood_interior": T("repair", {
    it: ["Riparazione parquet — interni", "Doghe danneggiate tagliate e sostituite, poi raccordate alla finitura, all'interno."],
    de: ["Dielenreparatur — innen", "Beschädigte Dielen herausgeschnitten und ersetzt, dann an die Versiegelung angeglichen, im Innenbereich."],
    uk: ["Ремонт дерев'яної підлоги — інтер'єр", "Пошкоджені дошки вирізано й замінено, потім підігнано під покриття, всередині."],
    tl: ["Pag-ayos ng hardwood — loob ng bahay", "Sirang tabla na pinutol at pinalitan, tapos tinugma sa finish, sa loob."],
  }, [
    TL.labour(1, "sqft", 12, {
      en: ["Board replacement labour — per sq ft", "Damaged boards cut out, new boards let in, sanded and finished to blend."],
      fr: ["Main-d'œuvre — remplacement de planches, au pi²", "Planches abîmées découpées, nouvelles planches insérées, sablées et finies pour se fondre."],
      es: ["Mano de obra — reemplazo de tablas, por pie²", "Tablas dañadas cortadas, tablas nuevas insertadas, lijadas y acabadas para integrarse."],
      it: ["Manodopera — sostituzione doghe, al piede quadro", "Doghe danneggiate tagliate, nuove doghe inserite, carteggiate e rifinite per uniformare."],
      de: ["Arbeit — Dielen ersetzen, pro sq ft", "Beschädigte Dielen herausgeschnitten, neue eingesetzt, geschliffen und angepasst versiegelt."],
      uk: ["Робота — заміна дощок, за кв. фут", "Пошкоджені дошки вирізано, нові вставлено, відшліфовано та оброблено в тон."],
      tl: ["Labor — palit ng tabla, kada sq ft", "Pinutol ang sirang tabla, isiningit ang bago, hinasa at tinapos para tumugma."],
    }, { measurementKey: "areaSqFt" }),
    TL.material(1, "sqft", 7, {
      en: ["Matching hardwood and finish — per sq ft", "Boards matched to the species and width, stain and finish."],
      fr: ["Bois franc assorti et fini — au pi²", "Planches assorties à l'essence et à la largeur, teinture et fini."],
      es: ["Madera a juego y acabado — por pie²", "Tablas a juego con la especie y el ancho, tinte y acabado."],
      it: ["Legno abbinato e finitura — al piede quadro", "Doghe abbinate per essenza e larghezza, tinta e finitura."],
      de: ["Passendes Holz und Versiegelung — pro sq ft", "Dielen passend zu Holzart und Breite, Beize und Versiegelung."],
      uk: ["Підібрана деревина та покриття — за кв. фут", "Дошки підібрано за породою та шириною, морилка й покриття."],
      tl: ["Katernong hardwood at finish — kada sq ft", "Tablang tugma sa uri at lapad, stain at finish."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  "fq.flooring_install.repair.tile_interior": T("repair", {
    it: ["Riparazione pavimento in piastrelle — interni", "Piastrelle rotte o staccate rimosse e sostituite, stucco abbinato, all'interno."],
    de: ["Fliesenbodenreparatur — innen", "Gerissene oder lose Fliesen aufgenommen und ersetzt, Fugen angepasst, im Innenbereich."],
    uk: ["Ремонт плиткової підлоги — інтер'єр", "Тріснуту або відсталу плитку знято та замінено, фугу підібрано, всередині."],
    tl: ["Pag-ayos ng tile sa sahig — loob ng bahay", "Basag o maluwag na tile na tinanggal at pinalitan, tinugma ang grout, sa loob."],
  }, [
    SHARED.serviceCall(65),
    TL.labour(1, "sqft", 35, {
      en: ["Tile replacement labour — per sq ft of repair", "The broken tiles chipped out, the bed cleaned, new tiles set and grouted to match."],
      fr: ["Main-d'œuvre — remplacement de carreaux, au pi² réparé", "Carreaux brisés enlevés, lit nettoyé, nouveaux carreaux posés et jointoyés pour s'agencer."],
      es: ["Mano de obra — reemplazo de azulejo, por pie² reparado", "Azulejos rotos retirados, la cama limpiada, azulejos nuevos asentados y lechadeados a juego."],
      it: ["Manodopera — sostituzione piastrelle, al piede quadro riparato", "Piastrelle rotte rimosse, letto pulito, nuove piastrelle posate e stuccate in tinta."],
      de: ["Arbeit — Fliesen ersetzen, pro sq ft Reparatur", "Gebrochene Fliesen ausgestemmt, das Bett gereinigt, neue Fliesen gesetzt und passend verfugt."],
      uk: ["Робота — заміна плитки, за кв. фут ремонту", "Розбиту плитку вибито, основу очищено, нову викладено та зафуговано в тон."],
      tl: ["Labor — palit ng tile, kada sq ft ng inayos", "Tinanggal ang basag na tile, nilinis ang base, nilagyan ng bago at ginrout na tugma."],
    }, { measurementKey: "areaSqFt" }),
    TL.material(1, "sqft", 6, {
      en: ["Replacement tile, thinset and grout — per sq ft", "Matching tile from the client's spares or a close match, thinset and grout."],
      fr: ["Carreaux de remplacement, ciment-colle et coulis — au pi²", "Carreaux assortis tirés des surplus du client ou équivalent proche, ciment-colle et coulis."],
      es: ["Azulejo de reemplazo, adhesivo y lechada — por pie²", "Azulejo a juego de los sobrantes del cliente o uno muy parecido, adhesivo y lechada."],
      it: ["Piastrelle di ricambio, colla e stucco — al piede quadro", "Piastrelle abbinate dalle scorte del cliente o molto simili, colla e stucco."],
      de: ["Ersatzfliesen, Kleber und Fugenmasse — pro sq ft", "Passende Fliesen aus dem Restbestand des Kunden oder sehr ähnliche, Kleber und Fugenmasse."],
      uk: ["Плитка на заміну, клей і фуга — за кв. фут", "Плитка з запасу клієнта або максимально схожа, клей і фуга."],
      tl: ["Kapalit na tile, thinset at grout — kada sq ft", "Tile mula sa reserba ng kliyente o malapit na katulad, thinset at grout."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  // ── Inspection ──
  "fq.flooring_install.visits.measure_visit": T("inspection", {
    it: ["Misurazione in loco e preventivo", "Ogni stanza misurata, sottofondo esaminato e prezzo scritto lasciato per il pavimento che il cliente ha in mente."],
    de: ["Aufmaß vor Ort und Angebot", "Jeder Raum aufgemessen, der Unterboden begutachtet und ein schriftlicher Preis für den gewünschten Boden hinterlassen."],
    uk: ["Замір на місці та кошторис", "Кожну кімнату виміряно, чорнову підлогу оглянуто, залишено письмову ціну на підлогу, яку хоче клієнт."],
    tl: ["Pagsukat sa bahay at estimate", "Sinukat ang bawat kuwarto, tiningnan ang subfloor at iniwan ang nakasulat na presyo para sa gustong sahig ng kliyente."],
  }, [
    TL.labour(1, "flat", 0, {
      en: ["On-site measure", "Every room measured and the subfloor checked; free with a signed quote."],
      fr: ["Mesure sur place", "Chaque pièce mesurée et sous-plancher vérifié; gratuit avec une soumission signée."],
      es: ["Medición en sitio", "Cada habitación medida y el subpiso revisado; gratis con un presupuesto firmado."],
      it: ["Misurazione in loco", "Ogni stanza misurata e sottofondo controllato; gratuita con preventivo firmato."],
      de: ["Aufmaß vor Ort", "Jeder Raum aufgemessen und der Unterboden geprüft; kostenlos bei unterschriebenem Angebot."],
      uk: ["Замір на місці", "Кожну кімнату виміряно, чорнову підлогу перевірено; безкоштовно за підписаного кошторису."],
      tl: ["Pagsukat sa bahay", "Sinukat ang bawat kuwarto at chineck ang subfloor; libre kapag pumirma sa quote."],
    }, { cost: 0 }),
    SHARED.serviceCall(65),
  ], null),

  "fq.flooring_install.visits.moisture_test": T("inspection", {
    it: ["Test di umidità del sottofondo", "Umidità della soletta o del sottofondo in legno misurata con uno strumento tarato prima di posare qualsiasi pavimento, con le letture messe per iscritto."],
    de: ["Feuchtemessung des Unterbodens", "Feuchte der Bodenplatte oder des Holzunterbodens mit kalibriertem Messgerät vor jeder Verlegung gemessen, Werte schriftlich festgehalten."],
    uk: ["Тест вологості чорнової підлоги", "Вологість плити або дерев'яної чорнової підлоги виміряно каліброваним приладом до укладання будь-якої підлоги, показники записано."],
    tl: ["Moisture test ng subfloor", "Sinukat ang moisture ng slab o kahoy na subfloor gamit ang calibrated na meter bago ilagay ang sahig, nakasulat ang readings."],
  }, [
    TL.labour(1, "flat", 125, {
      en: ["Moisture testing", "Pin and calcium-chloride or RH-probe readings taken at several points and logged."],
      fr: ["Test d'humidité", "Lectures à broches et au chlorure de calcium ou à la sonde HR prises en plusieurs points et consignées."],
      es: ["Prueba de humedad", "Lecturas con puntas y cloruro de calcio o sonda de HR tomadas en varios puntos y anotadas."],
      it: ["Test di umidità", "Letture a puntali e al cloruro di calcio o con sonda UR prese in più punti e registrate."],
      de: ["Feuchtemessung", "Messungen mit Einstechfühler und Calciumchlorid oder RH-Sonde an mehreren Stellen genommen und protokolliert."],
      uk: ["Вимірювання вологості", "Показники голковим приладом і кальцій-хлоридним тестом або RH-зондом зняті в кількох точках і записані."],
      tl: ["Moisture testing", "Pin at calcium-chloride o RH-probe readings na kinuha sa ilang lugar at nirekord."],
    }),
    SHARED.report(40),
  ], null),

  "fq.flooring_install.visits.floor_inspection": T("inspection", {
    it: ["Ispezione dello stato del pavimento", "Imbarcamento, fessure, scricchiolii, piastrelle rotte o vinile che si solleva esaminati e causa spiegata, con riparazione o sostituzione quotata."],
    de: ["Inspektion des Bodenzustands", "Schüsseln, Fugen, Knarren, gerissene Fliesen oder sich lösendes Vinyl begutachtet und die Ursache erklärt, Reparatur oder Austausch angeboten."],
    uk: ["Огляд стану підлоги", "Коробління, щілини, скрип, тріснуту плитку або відсталий вініл оглянуто й пояснено причину, з ціною на ремонт або заміну."],
    tl: ["Inspeksyon ng kondisyon ng sahig", "Tiningnan ang cupping, gaps, langitngit, basag na tile o umaangat na vinyl at ipinaliwanag ang sanhi, may presyo ng pag-ayos o palit."],
  }, [
    SHARED.diagnostic(95, { cost: 50 }),
    SHARED.report(40),
  ], null),

  // ── Maintenance ──
  "fq.flooring_install.maintenance.hardwood_screen_recoat": T("maintenance", {
    it: ["Carteggiatura leggera e nuova mano di finitura — parquet", "Finitura abrasa e nuova mano applicata senza carteggiare fino al legno nudo, per un pavimento opaco ma non danneggiato."],
    de: ["Anschleifen und neu versiegeln — Holzboden", "Versiegelung angeschliffen und eine frische Schicht aufgetragen, ohne bis aufs rohe Holz zu schleifen — für einen stumpfen, aber unbeschädigten Boden."],
    uk: ["Легке шліфування та новий шар покриття — дерев'яна підлога", "Покриття зашліфовано й нанесено свіжий шар без шліфування до чистого дерева, для тьмяної, але не пошкодженої підлоги."],
    tl: ["Screen at recoat ng hardwood", "Hinasa nang bahagya ang finish at nilagyan ng bagong patong nang hindi inaabot ang hubad na kahoy, para sa mapurol pero hindi sirang sahig."],
  }, [
    TL.labour(1, "sqft", 1.5, {
      en: ["Screen and recoat labour — per sq ft", "The floor cleaned, abraded with a screen and one coat of finish applied."],
      fr: ["Main-d'œuvre — sablage léger et couche de fini, au pi²", "Plancher nettoyé, abrasé au tamis et une couche de fini appliquée."],
      es: ["Mano de obra — lijado ligero y capa de acabado, por pie²", "Piso limpiado, desgastado con malla y una capa de acabado aplicada."],
      it: ["Manodopera — carteggiatura leggera e mano di finitura, al piede quadro", "Pavimento pulito, abraso con retina e una mano di finitura applicata."],
      de: ["Arbeit — Anschleifen und Versiegeln, pro sq ft", "Boden gereinigt, mit Gitter angeschliffen und eine Schicht Versiegelung aufgetragen."],
      uk: ["Робота — легке шліфування та шар покриття, за кв. фут", "Підлогу очищено, зашліфовано сіткою та нанесено один шар покриття."],
      tl: ["Labor — screen at recoat, kada sq ft", "Nilinis ang sahig, hinasa gamit ang screen at nilagyan ng isang patong ng finish."],
    }, { measurementKey: "areaSqFt" }),
    TL.material(1, "sqft", 0.6, {
      en: ["Water-based finish — per sq ft", "Commercial water-based polyurethane, one coat, and screens."],
      fr: ["Fini à base d'eau — au pi²", "Polyuréthane commercial à base d'eau, une couche, et tamis."],
      es: ["Acabado base agua — por pie²", "Poliuretano comercial base agua, una capa, y mallas."],
      it: ["Finitura all'acqua — al piede quadro", "Poliuretano professionale all'acqua, una mano, e retine."],
      de: ["Wasserbasierte Versiegelung — pro sq ft", "Wasserbasiertes Polyurethan in Profiqualität, eine Schicht, und Schleifgitter."],
      uk: ["Покриття на водній основі — за кв. фут", "Професійний поліуретан на водній основі, один шар, і шліфувальні сітки."],
      tl: ["Water-based finish — kada sq ft", "Commercial water-based polyurethane, isang patong, at screen."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  "fq.flooring_install.maintenance.tile_grout_seal": T("maintenance", {
    it: ["Pulizia e sigillatura di piastrelle e fughe", "Piastrelle e fughe pulite a fondo e sigillante penetrante applicato perché le fughe smettano di macchiarsi."],
    de: ["Fliesen- und Fugenreinigung mit Versiegelung", "Fliesen und Fugen tiefengereinigt und ein penetrierender Versiegler aufgetragen, damit die Fugen keine Flecken mehr annehmen."],
    uk: ["Чищення та герметизація плитки й фуги", "Плитку та фугу глибоко очищено й нанесено проникний герметик, щоб фуга перестала брати плями."],
    tl: ["Paglilinis at pagselyo ng tile at grout", "Malalim na nilinis ang tile at grout at nilagyan ng penetrating sealer para hindi na mamantsa ang grout."],
  }, [
    TL.labour(1, "sqft", 1.25, {
      en: ["Tile and grout cleaning and sealing — per sq ft", "Alkaline cleaner scrubbed and extracted, then the grout lines sealed."],
      fr: ["Nettoyage et scellement de céramique et coulis — au pi²", "Nettoyant alcalin brossé et extrait, puis lignes de coulis scellées."],
      es: ["Limpieza y sellado de azulejo y lechada — por pie²", "Limpiador alcalino tallado y extraído, luego las líneas de lechada selladas."],
      it: ["Pulizia e sigillatura piastrelle e fughe — al piede quadro", "Detergente alcalino strofinato ed estratto, poi le fughe sigillate."],
      de: ["Fliesen- und Fugenreinigung mit Versiegelung — pro sq ft", "Alkalischer Reiniger geschrubbt und abgesaugt, dann die Fugen versiegelt."],
      uk: ["Чищення та герметизація плитки й фуги — за кв. фут", "Лужний засіб втерто та зібрано, потім фуги загерметизовано."],
      tl: ["Paglilinis at pagselyo ng tile at grout — kada sq ft", "Kinuskos at hinigop ang alkaline cleaner, tapos sinelyuhan ang grout."],
    }, { measurementKey: "areaSqFt" }),
    TL.material(1, "sqft", 0.3, {
      en: ["Cleaner and grout sealer — per sq ft", "Alkaline tile cleaner and penetrating grout sealer."],
      fr: ["Nettoyant et scellant à coulis — au pi²", "Nettoyant alcalin et scellant pénétrant pour coulis."],
      es: ["Limpiador y sellador de lechada — por pie²", "Limpiador alcalino y sellador penetrante para lechada."],
      it: ["Detergente e sigillante per fughe — al piede quadro", "Detergente alcalino e sigillante penetrante per fughe."],
      de: ["Reiniger und Fugenversiegler — pro sq ft", "Alkalischer Fliesenreiniger und penetrierender Fugenversiegler."],
      uk: ["Засіб для чищення та герметик для фуги — за кв. фут", "Лужний засіб для плитки та проникний герметик для фуги."],
      tl: ["Cleaner at grout sealer — kada sq ft", "Alkaline tile cleaner at penetrating grout sealer."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  "fq.flooring_install.maintenance.deck_clean_reseal": T("maintenance", {
    it: ["Pulizia e nuova sigillatura del deck", "Tavole del deck lavate, ravvivate e risigillate per tenere l'acqua fuori dal legno."],
    de: ["Terrassenreinigung und Neuversiegelung", "Terrassendielen gewaschen, aufgehellt und neu versiegelt, damit kein Wasser ins Holz zieht."],
    uk: ["Чищення та повторна герметизація тераси", "Дошки тераси вимито, освітлено та знову загерметизовано, щоб вода не проникала в деревину."],
    tl: ["Paglilinis at resealing ng deck", "Hinugasan, pinaliwanag at sinelyuhan ulit ang tabla ng deck para hindi pumasok ang tubig."],
  }, [
    TL.labour(1, "sqft", 1.75, {
      en: ["Deck wash and reseal — per sq ft", "Boards cleaned and brightened, dried, then a penetrating sealer rolled on."],
      fr: ["Lavage et rescellement de terrasse — au pi²", "Planches nettoyées et ravivées, séchées, puis scellant pénétrant appliqué au rouleau."],
      es: ["Lavado y resellado de terraza — por pie²", "Tablas limpiadas y avivadas, secadas y luego un sellador penetrante aplicado con rodillo."],
      it: ["Lavaggio e nuova sigillatura deck — al piede quadro", "Tavole pulite e ravvivate, asciugate, poi sigillante penetrante steso a rullo."],
      de: ["Terrasse waschen und versiegeln — pro sq ft", "Dielen gereinigt und aufgehellt, getrocknet, dann penetrierender Versiegler aufgerollt."],
      uk: ["Миття та герметизація тераси — за кв. фут", "Дошки очищено та освітлено, висушено, потім валиком нанесено проникний герметик."],
      tl: ["Hugas at reseal ng deck — kada sq ft", "Nilinis at pinaliwanag ang tabla, pinatuyo, tapos nirolyo ng penetrating sealer."],
    }, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.deck_stain_gal, {
      en: ["Deck stain — per gallon", "Semi-transparent penetrating stain; one gallon covers about 200 sq ft."],
      fr: ["Teinture pour terrasse — au gallon", "Teinture pénétrante semi-transparente; un gallon couvre environ 200 pi²."],
      es: ["Tinte para terraza — por galón", "Tinte penetrante semitransparente; un galón cubre unos 200 pies²."],
      it: ["Impregnante per deck — al gallone", "Impregnante penetrante semitrasparente; un gallone copre circa 200 piedi quadri."],
      de: ["Terrassenbeize — pro Gallone", "Halbtransparente, eindringende Beize; eine Gallone reicht für etwa 200 sq ft."],
      uk: ["Морилка для тераси — за галон", "Напівпрозора проникна морилка; галон покриває близько 200 кв. футів."],
      tl: ["Deck stain — kada galon", "Semi-transparent na penetrating stain; ang isang galon ay para sa mga 200 sq ft."],
    }, { measurementKey: "areaSqFt" }),
  ], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);

// Shared services: one canonical row here, installed for these quote types too.
tagRows(SEED, {
  "fq.flooring_install.maintenance.tile_grout_seal": ["carpet_cleaning", "handyman", "general_contracting"],
  "fq.flooring_install.maintenance.deck_clean_reseal": ["deck_patio"],
});

// ── Added 2026-09-25: a template for every row of the grid ─────────────────
//
// The owner: a service should open with its line items. The grid above had
// templates on twelve rows; these cover the other sixty-one. The two "Other
// … — describe what you need" rows stay bare on purpose: a template on a
// catch-all would be a guess at a job nobody has described.
//
// Figures, per sq ft unless said: carpet $1.25 labour + $3.25 carpet + $0.75
// pad (installed $4–7); epoxy or polyaspartic $1.75 grind + $2 application +
// $2.25 system ($5–9 installed); a 4 in slab $4.50 labour + $3 ready-mix and
// mesh, $1–1.50 for the base under it ($8–12 installed); engineered wood $4 +
// $5.50; pavers $9 + $4.50 + $2.25 base; asphalt $2 + $2.25 + $1.50 base;
// deck boards $5 labour over the frame, composite $6 + $7.50. Material costs
// are the 75% rule; the Home Depot rows (underlayment, deck boards, deck
// stain) carry their shelf price through hdMaterial. Tile, vinyl and hardwood
// in other rooms reuse the interior templates' own lines — the same line
// objects, read and never changed — with what the room adds (a membrane under
// tile on a slab, a vapour barrier or a nailing base in a basement).
//
// Every area line is keyed to areaSqFt — the figure the room measure fills
// for this trade (lib/measure/reuseTakeoffs.js), and the key the templates
// above already use — and every baseboard, tack-strip or transition line to
// linearFt, the room perimeter the same measure produces.
//
// Rows another quote type sells are tagged for it here — epoxy, tiling,
// concrete, paving, driveway_sealing — so a company quoting under those
// types (none has a seed file of its own; lib/services/confirmServices.js
// NEAREST_TRADES) finds them with their lines. Only rows templated in this
// block are tagged; no existing template's categories change.
//
// A second withTemplates pass, so the templates above stay byte-for-byte
// what they were. The service names in the other languages are read from
// ./i18n, which carries every row already.
const namesOf = (key) => {
  const s = I18N.services[key];
  return { it: s.it, de: s.de, uk: s.uk, tl: s.tl };
};
const SQ = { measurementKey: "areaSqFt" };
const LF = { measurementKey: "linearFt" };
const FX = {
  tearOut: {
    en: ["Tear-out of existing flooring — per sq ft", "The old floor lifted, staples, nails and adhesive scraped off, and the debris hauled away."],
    fr: ["Arrachage du revêtement existant — au pi²", "Ancien revêtement enlevé, agrafes, clous et colle grattés, débris évacués."],
    es: ["Retiro del piso existente — por pie²", "Piso viejo levantado, grapas, clavos y pegamento raspados, y los escombros retirados."],
    it: ["Rimozione del pavimento esistente — al piede quadro", "Vecchio pavimento sollevato, graffe, chiodi e colla raschiati via, detriti portati via."],
    de: ["Rückbau des alten Bodenbelags — pro sq ft", "Alter Belag aufgenommen, Klammern, Nägel und Kleber abgeschabt, Schutt abtransportiert."],
    uk: ["Демонтаж старого покриття — за кв. фут", "Старе покриття знято, скоби, цвяхи й клей зішкрябано, сміття вивезено."],
    tl: ["Pagtanggal ng lumang sahig — kada sq ft", "Tinanggal ang lumang sahig, kinayod ang staple, pako at pandikit, at hinakot ang debris."],
  },
  baseboardReset: {
    en: ["Baseboard removal and reinstall — per linear ft", "Baseboards pulled before the floor goes down, then nailed back, caulked and touched up."],
    fr: ["Dépose et repose des plinthes — au pi lin.", "Plinthes retirées avant la pose, puis reclouées, calfeutrées et retouchées."],
    es: ["Retiro y reinstalación de zoclo — por pie lineal", "Zoclo retirado antes de instalar el piso, luego clavado de nuevo, sellado y retocado."],
    it: ["Smontaggio e rimontaggio battiscopa — al piede lineare", "Battiscopa tolto prima della posa, poi rinchiodato, sigillato e ritoccato."],
    de: ["Sockelleisten ab- und wieder anbauen — pro lfd. Fuß", "Sockelleisten vor dem Verlegen abgenommen, danach wieder genagelt, verfugt und ausgebessert."],
    uk: ["Демонтаж і повторний монтаж плінтусів — за пог. фут", "Плінтуси знято перед укладанням, потім прибито назад, загерметизовано й підфарбовано."],
    tl: ["Pagtanggal at pagbalik ng baseboard — kada linear ft", "Tinanggal ang baseboard bago ilatag ang sahig, tapos ipinako ulit, kinaulk at ni-touch-up."],
  },
  carpetLabour: {
    en: ["Carpet installation labour — per sq ft", "Pad laid and taped, carpet power-stretched onto the tack strip, seams hot-melted and edges tucked at the walls."],
    fr: ["Main-d'œuvre — pose de tapis, au pi²", "Sous-tapis posé et ruban appliqué, tapis tendu à la machine sur la bande à clous, joints thermocollés et bordures rentrées."],
    es: ["Mano de obra — instalación de alfombra, por pie²", "Bajoalfombra colocada y encintada, alfombra estirada con máquina sobre la tira de clavos, uniones termoselladas y bordes remetidos."],
    it: ["Manodopera — posa moquette, al piede quadro", "Sottofondo steso e nastrato, moquette tesa con il tenditore sulla striscia chiodata, giunte termosaldate e bordi rimboccati."],
    de: ["Arbeit — Teppichverlegung, pro sq ft", "Unterlage verlegt und abgeklebt, Teppich auf die Nagelleiste gespannt, Nähte heiß verklebt und Kanten an der Wand eingeschlagen."],
    uk: ["Робота — укладання килимового покриття, за кв. фут", "Підкладку розкладено й проклеєно, покриття натягнуто на планку з цвяхами, шви проварено, краї заправлено біля стін."],
    tl: ["Labor — pagkabit ng carpet, kada sq ft", "Inilatag at tinape ang pad, ini-power-stretch ang carpet sa tack strip, hot-melt ang seam at isiniksik ang gilid sa pader."],
  },
  carpetMat: {
    en: ["Carpet — per sq ft", "Mid-grade residential carpet, with about 10% added for seams and pattern match."],
    fr: ["Tapis — au pi²", "Tapis résidentiel de milieu de gamme, avec environ 10 % ajouté pour les joints et le raccord du motif."],
    es: ["Alfombra — por pie²", "Alfombra residencial de gama media, con cerca de 10 % extra para uniones y empate del diseño."],
    it: ["Moquette — al piede quadro", "Moquette residenziale di fascia media, con circa il 10% in più per giunte e raccordo del disegno."],
    de: ["Teppich — pro sq ft", "Wohnteppich mittlerer Qualität, mit etwa 10 % Zuschlag für Nähte und Musteransatz."],
    uk: ["Килимове покриття — за кв. фут", "Побутове покриття середнього класу, приблизно 10% додатково на шви та підгонку малюнка."],
    tl: ["Carpet — kada sq ft", "Mid-grade na carpet pambahay, may dagdag na mga 10% para sa seam at pagtugma ng pattern."],
  },
  padMat: {
    en: ["Carpet underpad — per sq ft", "7/16 in, 8 lb rebond pad under the whole carpeted area."],
    fr: ["Sous-tapis — au pi²", "Sous-tapis de mousse agglomérée 7/16 po, 8 lb, sous toute la surface tapissée."],
    es: ["Bajoalfombra — por pie²", "Bajoalfombra de espuma reciclada de 7/16 pulg y 8 lb bajo toda el área alfombrada."],
    it: ["Sottomoquette — al piede quadro", "Sottofondo in espanso rigenerato da 7/16 di pollice, 8 lb, sotto tutta l'area in moquette."],
    de: ["Teppichunterlage — pro sq ft", "7/16-Zoll-Verbundschaumunterlage, 8 lb, unter der ganzen Teppichfläche."],
    uk: ["Підкладка під килимове покриття — за кв. фут", "Підкладка з пресованої піни 7/16 дюйма, 8 фунтів, під усією площею покриття."],
    tl: ["Carpet pad — kada sq ft", "7/16 in, 8 lb na rebond pad sa ilalim ng buong may carpet."],
  },
  tackStrip: {
    en: ["Tack strip and transitions — per linear ft", "New tack strip round the room and metal or wood transitions at the doorways."],
    fr: ["Bandes à clous et moulures de transition — au pi lin.", "Nouvelles bandes à clous au pourtour de la pièce et transitions en métal ou en bois aux portes."],
    es: ["Tira de clavos y transiciones — por pie lineal", "Tira de clavos nueva alrededor del cuarto y transiciones de metal o madera en las puertas."],
    it: ["Striscia chiodata e profili di transizione — al piede lineare", "Nuova striscia chiodata lungo il perimetro e profili in metallo o legno sulle porte."],
    de: ["Nagelleiste und Übergangsprofile — pro lfd. Fuß", "Neue Nagelleiste rund um den Raum und Übergangsprofile aus Metall oder Holz an den Türen."],
    uk: ["Планка з цвяхами та перехідні профілі — за пог. фут", "Нова планка з цвяхами по периметру кімнати й металеві чи дерев'яні профілі на порогах."],
    tl: ["Tack strip at transition — kada linear ft", "Bagong tack strip paikot ng kuwarto at metal o kahoy na transition sa mga pinto."],
  },
  carpetRepairLabour: {
    en: ["Carpet patch and re-seam labour — per sq ft", "The damaged section cut out, a matching piece let in on seam tape and the pile brushed to blend."],
    fr: ["Main-d'œuvre — rapiéçage et rejointage de tapis, au pi²", "Section abîmée découpée, pièce assortie insérée sur ruban à joint et poil brossé pour se fondre."],
    es: ["Mano de obra — parche y reunión de alfombra, por pie²", "Sección dañada cortada, pieza a juego insertada sobre cinta de unión y el pelo cepillado para integrarse."],
    it: ["Manodopera — rappezzo e rigiunzione moquette, al piede quadro", "Parte danneggiata tagliata, pezzo abbinato inserito su nastro da giunzione e pelo spazzolato per uniformare."],
    de: ["Arbeit — Teppich flicken und neu nähen, pro sq ft", "Beschädigtes Stück ausgeschnitten, passendes Stück auf Nahtband eingesetzt und der Flor angebürstet."],
    uk: ["Робота — латка та перешивання шва килима, за кв. фут", "Пошкоджену ділянку вирізано, вставлено підібраний шматок на стрічку для швів, ворс розчесано в тон."],
    tl: ["Labor — patch at re-seam ng carpet, kada sq ft", "Pinutol ang sirang bahagi, isiningit ang katugmang piraso sa seam tape at sinuklay ang pile para tumugma."],
  },
  carpetPatchMat: {
    en: ["Seam tape, adhesive and patch carpet", "Hot-melt seam tape and adhesive; the patch cut from the client's remnant or a closet."],
    fr: ["Ruban à joint, adhésif et pièce de tapis", "Ruban thermocollant et adhésif; pièce taillée dans une retaille du client ou un placard."],
    es: ["Cinta de unión, adhesivo y parche de alfombra", "Cinta termoadhesiva y adhesivo; el parche sale de un sobrante del cliente o de un clóset."],
    it: ["Nastro da giunzione, adesivo e pezza di moquette", "Nastro termoadesivo e adesivo; la pezza ricavata da un avanzo del cliente o da un armadio."],
    de: ["Nahtband, Kleber und Flickstück", "Heißklebe-Nahtband und Kleber; das Flickstück aus einem Rest des Kunden oder einem Schrank."],
    uk: ["Стрічка для швів, клей і латка", "Термострічка для швів і клей; латку вирізано із залишку клієнта або з шафи."],
    tl: ["Seam tape, pandikit at pantapal na carpet", "Hot-melt seam tape at pandikit; ang patch ay mula sa tira ng kliyente o sa closet."],
  },
  slabGrind: {
    en: ["Slab grinding and crack repair — per sq ft", "The slab diamond-ground to open the surface, cracks and pits filled and the dust vacuumed up."],
    fr: ["Meulage de la dalle et réparation des fissures — au pi²", "Dalle meulée au diamant pour ouvrir la surface, fissures et trous comblés, poussière aspirée."],
    es: ["Desbaste de la losa y reparación de grietas — por pie²", "Losa desbastada con diamante para abrir el poro, grietas y hoyos rellenados y el polvo aspirado."],
    it: ["Levigatura del massetto e riparazione crepe — al piede quadro", "Massetto levigato a diamante per aprire la superficie, crepe e buchi stuccati, polvere aspirata."],
    de: ["Estrich schleifen und Risse sanieren — pro sq ft", "Platte diamantgeschliffen, damit die Oberfläche offen ist, Risse und Löcher gefüllt, Staub abgesaugt."],
    uk: ["Шліфування плити та ремонт тріщин — за кв. фут", "Плиту відшліфовано алмазом, щоб відкрити поверхню, тріщини й вибоїни заповнено, пил зібрано пилососом."],
    tl: ["Pag-grind ng slab at pag-ayos ng bitak — kada sq ft", "Ginrind ng diamond ang slab para bumuka ang surface, tinapalan ang bitak at butas at binakyum ang alikabok."],
  },
  coatApply: {
    en: ["Coating application labour — per sq ft", "Primer, base coat, decorative flake and clear topcoat applied in turn, with the cure time each one needs."],
    fr: ["Main-d'œuvre — application du revêtement, au pi²", "Apprêt, couche de base, flocons décoratifs et couche de finition transparente appliqués tour à tour, avec le temps de cure de chacun."],
    es: ["Mano de obra — aplicación del recubrimiento, por pie²", "Primario, capa base, hojuela decorativa y capa transparente aplicados uno tras otro, con el curado que pide cada uno."],
    it: ["Manodopera — applicazione del rivestimento, al piede quadro", "Primer, strato di base, scaglie decorative e finitura trasparente applicati in sequenza, con i tempi di indurimento di ciascuno."],
    de: ["Arbeit — Beschichtung auftragen, pro sq ft", "Grundierung, Grundschicht, Farbchips und klare Deckschicht nacheinander aufgebracht, jeweils mit der nötigen Aushärtezeit."],
    uk: ["Робота — нанесення покриття, за кв. фут", "Ґрунт, базовий шар, декоративні чипси й прозорий фініш нанесено по черзі з потрібним часом полімеризації."],
    tl: ["Labor — pag-apply ng coating, kada sq ft", "Primer, base coat, decorative flake at clear topcoat na ipinahid isa-isa, sa tamang oras ng pagtuyo ng bawat isa."],
  },
  coatMat: {
    en: ["Epoxy or polyaspartic coating system — per sq ft", "Primer, pigmented base, flake and a UV-stable clear topcoat, bought as one system."],
    fr: ["Système de revêtement époxy ou polyaspartique — au pi²", "Apprêt, base pigmentée, flocons et couche transparente résistante aux UV, achetés en un seul système."],
    es: ["Sistema de recubrimiento epóxico o poliaspártico — por pie²", "Primario, base pigmentada, hojuela y capa transparente estable a UV, comprados como un solo sistema."],
    it: ["Sistema di rivestimento epossidico o poliaspartico — al piede quadro", "Primer, base pigmentata, scaglie e finitura trasparente stabile ai UV, acquistati come un unico sistema."],
    de: ["Epoxid- oder Polyaspartic-Beschichtungssystem — pro sq ft", "Grundierung, pigmentierte Basis, Chips und UV-stabile Klarschicht, als ein System gekauft."],
    uk: ["Епоксидна або поліаспарагінова система покриття — за кв. фут", "Ґрунт, пігментована основа, чипси й прозорий УФ-стійкий фініш, придбані однією системою."],
    tl: ["Epoxy o polyaspartic coating system — kada sq ft", "Primer, may kulay na base, flake at UV-stable na clear topcoat, binili bilang isang system."],
  },
  coatRepairLabour: {
    en: ["Coating repair labour — per sq ft", "Loose coating ground back to sound edges, the patch primed, recoated and feathered into the floor around it."],
    fr: ["Main-d'œuvre — réparation du revêtement, au pi²", "Revêtement décollé meulé jusqu'aux bords sains, réparation apprêtée, recouverte et fondue dans le plancher autour."],
    es: ["Mano de obra — reparación del recubrimiento, por pie²", "Recubrimiento suelto desbastado hasta bordes firmes, el parche imprimado, recubierto y difuminado con el piso alrededor."],
    it: ["Manodopera — riparazione del rivestimento, al piede quadro", "Rivestimento staccato levigato fino ai bordi sani, rappezzo primerizzato, ricoperto e sfumato nel pavimento circostante."],
    de: ["Arbeit — Beschichtung ausbessern, pro sq ft", "Lose Beschichtung bis zu festen Kanten abgeschliffen, die Stelle grundiert, neu beschichtet und in den Boden ringsum eingearbeitet."],
    uk: ["Робота — ремонт покриття, за кв. фут", "Відшароване покриття зішліфовано до міцних країв, латку заґрунтовано, перекрито й розтушовано в навколишню підлогу."],
    tl: ["Labor — pag-ayos ng coating, kada sq ft", "Ginrind ang maluwag na coating hanggang matibay na gilid, prinimer, kinoatan ulit at pinantay sa paligid na sahig."],
  },
  coatRepairMat: {
    en: ["Coating repair kit — per sq ft", "Patch primer, base in the matching colour, flake and topcoat."],
    fr: ["Trousse de réparation du revêtement — au pi²", "Apprêt de réparation, base de couleur assortie, flocons et couche de finition."],
    es: ["Kit de reparación del recubrimiento — por pie²", "Primario de parcheo, base del color a juego, hojuela y capa final."],
    it: ["Kit di riparazione del rivestimento — al piede quadro", "Primer per rappezzi, base nel colore abbinato, scaglie e finitura."],
    de: ["Reparaturset Beschichtung — pro sq ft", "Reparaturgrundierung, Basis im passenden Farbton, Chips und Deckschicht."],
    uk: ["Ремонтний набір покриття — за кв. фут", "Ремонтний ґрунт, база в тон, чипси й фінішний шар."],
    tl: ["Repair kit ng coating — kada sq ft", "Patch primer, base na katugmang kulay, flake at topcoat."],
  },
  concretePour: {
    en: ["Forming, pouring and finishing — per sq ft", "Forms set, concrete placed and screeded, floated and trowelled or broom-finished, control joints cut."],
    fr: ["Coffrage, coulée et finition — au pi²", "Coffrages posés, béton coulé et régalé, taloché puis truellé ou fini au balai, joints de contrôle sciés."],
    es: ["Cimbrado, colado y acabado — por pie²", "Cimbra colocada, concreto vaciado y reglado, flotado y allanado o terminado con escoba, juntas de control cortadas."],
    it: ["Casseratura, getto e finitura — al piede quadro", "Casseri posati, calcestruzzo gettato e staggiato, frattazzato e lisciato o finito a scopa, giunti di controllo tagliati."],
    de: ["Schalen, Betonieren und Abziehen — pro sq ft", "Schalung gestellt, Beton eingebracht und abgezogen, abgerieben und geglättet oder mit Besenstrich, Scheinfugen geschnitten."],
    uk: ["Опалубка, заливання та оздоблення — за кв. фут", "Опалубку встановлено, бетон залито й розрівняно, затерто й загладжено або оброблено щіткою, деформаційні шви нарізано."],
    tl: ["Forming, pagbuhos at pag-finish — kada sq ft", "Inilagay ang form, ibinuhos at ni-screed ang semento, pinalitada o ni-broom finish, at hiniwa ang control joint."],
  },
  concreteMat: {
    en: ["Ready-mix concrete and reinforcement — per sq ft", "A 4 in slab of 3,000–4,000 psi ready-mix with wire mesh or rebar."],
    fr: ["Béton prêt à l'emploi et armature — au pi²", "Dalle de 4 po en béton prémélangé de 3 000 à 4 000 psi avec treillis ou barres d'armature."],
    es: ["Concreto premezclado y refuerzo — por pie²", "Losa de 4 pulg de concreto premezclado de 3,000 a 4,000 psi con malla o varilla."],
    it: ["Calcestruzzo preconfezionato e armatura — al piede quadro", "Soletta da 4 pollici di calcestruzzo preconfezionato da 3.000–4.000 psi con rete o tondini."],
    de: ["Transportbeton und Bewehrung — pro sq ft", "4-Zoll-Platte aus Transportbeton mit 3.000–4.000 psi, mit Baustahlmatte oder Bewehrungsstahl."],
    uk: ["Товарний бетон і армування — за кв. фут", "Плита 4 дюйми з товарного бетону 3 000–4 000 psi з арматурною сіткою або прутами."],
    tl: ["Ready-mix na semento at rebar — kada sq ft", "4 in na slab ng 3,000–4,000 psi na ready-mix na may wire mesh o rebar."],
  },
  subBase: {
    en: ["Sub-base compaction and vapour barrier — per sq ft", "Fill levelled and compacted, then 6-mil poly laid and taped under the slab."],
    fr: ["Compactage de la fondation et pare-vapeur — au pi²", "Remblai nivelé et compacté, puis polyéthylène 6 mil posé et scellé sous la dalle."],
    es: ["Compactación de la sub-base y barrera de vapor — por pie²", "Relleno nivelado y compactado, luego polietileno de 6 mil colocado y encintado bajo la losa."],
    it: ["Compattazione del sottofondo e barriera al vapore — al piede quadro", "Riempimento livellato e compattato, poi telo in polietilene da 6 mil steso e nastrato sotto la soletta."],
    de: ["Unterbau verdichten und Dampfsperre — pro sq ft", "Auffüllung abgezogen und verdichtet, dann 6-mil-PE-Folie unter der Platte verlegt und abgeklebt."],
    uk: ["Ущільнення основи та пароізоляція — за кв. фут", "Засипку вирівняно й ущільнено, під плитою покладено й проклеєно поліетилен 6 міл."],
    tl: ["Pag-compact ng sub-base at vapour barrier — kada sq ft", "Nilevel at kinompact ang fill, tapos inilatag at tinape ang 6-mil na poly sa ilalim ng slab."],
  },
  gravelBase: {
    en: ["Excavation and gravel base — per sq ft", "The old surface and soil dug out, then a compacted gravel base laid and graded to drain."],
    fr: ["Excavation et fondation de gravier — au pi²", "Ancienne surface et terre creusées, puis fondation de gravier compactée et nivelée pour l'égouttement."],
    es: ["Excavación y base de grava — por pie²", "Superficie vieja y tierra excavadas, luego una base de grava compactada y nivelada para drenar."],
    it: ["Scavo e sottofondo in ghiaia — al piede quadro", "Vecchia superficie e terra scavate, poi sottofondo in ghiaia compattato e livellato per lo scolo."],
    de: ["Aushub und Schotterunterbau — pro sq ft", "Alte Oberfläche und Erdreich ausgehoben, dann verdichteter Schotterunterbau mit Gefälle eingebaut."],
    uk: ["Виймання ґрунту та щебенева основа — за кв. фут", "Старе покриття й ґрунт вибрано, потім укладено ущільнену щебеневу основу з ухилом для стоку."],
    tl: ["Paghuhukay at gravel base — kada sq ft", "Hinukay ang lumang surface at lupa, tapos inilatag ang siniksik na gravel base na may tamang bagsak ng tubig."],
  },
  concreteRepairLabour: {
    en: ["Crack and spall repair labour — per sq ft", "Loose concrete chipped out, cracks routed, bonding agent brushed in and repair mortar trowelled level."],
    fr: ["Main-d'œuvre — réparation de fissures et d'écaillage, au pi²", "Béton friable piqué, fissures ouvertes à la toupie, agent de liaison appliqué et mortier de réparation truellé de niveau."],
    es: ["Mano de obra — reparación de grietas y desconchados, por pie²", "Concreto suelto picado, grietas abiertas, adherente aplicado y mortero de reparación allanado a nivel."],
    it: ["Manodopera — riparazione crepe e sfaldature, al piede quadro", "Calcestruzzo friabile rimosso, crepe aperte, promotore d'adesione applicato e malta da ripristino lisciata a livello."],
    de: ["Arbeit — Riss- und Abplatzungssanierung, pro sq ft", "Loser Beton abgestemmt, Risse aufgefräst, Haftbrücke eingebürstet und Reparaturmörtel eben abgezogen."],
    uk: ["Робота — ремонт тріщин і відколів, за кв. фут", "Пухкий бетон відбито, тріщини розшито, нанесено адгезійний ґрунт і врівень затерто ремонтний розчин."],
    tl: ["Labor — pag-ayos ng bitak at tapyas, kada sq ft", "Tinanggal ang maluwag na semento, binuksan ang bitak, nilagyan ng bonding agent at pinalitada ng repair mortar."],
  },
  concreteRepairMat: {
    en: ["Repair mortar and bonding agent — per sq ft", "Polymer-modified patching mortar or resurfacer with a bonding primer."],
    fr: ["Mortier de réparation et agent de liaison — au pi²", "Mortier de ragréage modifié aux polymères ou resurfaceur, avec apprêt d'adhérence."],
    es: ["Mortero de reparación y adherente — por pie²", "Mortero de parcheo modificado con polímeros o resanador, con primario adherente."],
    it: ["Malta da ripristino e promotore d'adesione — al piede quadro", "Malta da ripristino o rasante modificata con polimeri, con primer d'aggancio."],
    de: ["Reparaturmörtel und Haftbrücke — pro sq ft", "Kunststoffvergüteter Reparaturmörtel oder Feinspachtel mit Haftgrund."],
    uk: ["Ремонтний розчин і адгезійний ґрунт — за кв. фут", "Модифікований полімерами ремонтний розчин або вирівнювач з адгезійним ґрунтом."],
    tl: ["Repair mortar at bonding agent — kada sq ft", "Polymer-modified na patching mortar o resurfacer na may bonding primer."],
  },
  breakOut: {
    en: ["Concrete break-out and load-out — per sq ft", "The slab saw-cut at sound edges, broken up with a breaker and loaded out for disposal."],
    fr: ["Démolition et chargement du béton — au pi²", "Dalle sciée aux bords sains, cassée au marteau piqueur et chargée pour la disposition."],
    es: ["Demolición y carga del concreto — por pie²", "Losa cortada con sierra en bordes sanos, rota con martillo y cargada para desecharla."],
    it: ["Demolizione e carico del calcestruzzo — al piede quadro", "Soletta tagliata a sega sui bordi sani, frantumata col martello demolitore e caricata per lo smaltimento."],
    de: ["Betonabbruch und Abtransport — pro sq ft", "Platte an festen Kanten eingesägt, mit dem Abbruchhammer zerkleinert und zur Entsorgung verladen."],
    uk: ["Демонтаж і вивантаження бетону — за кв. фут", "Плиту надрізано по міцних краях, розбито відбійним молотком і завантажено на утилізацію."],
    tl: ["Pagbasag at paghakot ng semento — kada sq ft", "Hiniwa ng saw ang slab sa matibay na gilid, binasag ng breaker at isinakay para itapon."],
  },
  polishLabour: {
    en: ["Grinding and polishing — per sq ft", "The slab ground and polished through successive diamond grits to the sheen the client chose."],
    fr: ["Meulage et polissage — au pi²", "Dalle meulée et polie par grains de diamant successifs jusqu'au lustre choisi par le client."],
    es: ["Desbaste y pulido — por pie²", "Losa desbastada y pulida con granos de diamante sucesivos hasta el brillo que eligió el cliente."],
    it: ["Levigatura e lucidatura — al piede quadro", "Massetto levigato e lucidato con grane diamantate successive fino alla brillantezza scelta dal cliente."],
    de: ["Schleifen und Polieren — pro sq ft", "Platte in aufeinanderfolgenden Diamantkörnungen geschliffen und poliert, bis zum vom Kunden gewählten Glanz."],
    uk: ["Шліфування та полірування — за кв. фут", "Плиту відшліфовано й відполіровано алмазними дисками зі зростанням зернистості до обраного клієнтом блиску."],
    tl: ["Pag-grind at pag-polish — kada sq ft", "Ginrind at pinakintab ang slab sa sunod-sunod na diamond grit hanggang sa kinang na pinili ng kliyente."],
  },
  polishMat: {
    en: ["Densifier and stain guard — per sq ft", "Lithium densifier between grits and a penetrating stain guard at the end."],
    fr: ["Durcisseur et protecteur anti-taches — au pi²", "Durcisseur au lithium entre les grains et protecteur pénétrant anti-taches à la fin."],
    es: ["Densificador y protector antimanchas — por pie²", "Densificador de litio entre granos y un protector penetrante antimanchas al final."],
    it: ["Indurente e protettivo antimacchia — al piede quadro", "Indurente al litio tra una grana e l'altra e un protettivo antimacchia penetrante alla fine."],
    de: ["Verfestiger und Fleckschutz — pro sq ft", "Lithium-Verfestiger zwischen den Körnungen und ein eindringender Fleckschutz zum Schluss."],
    uk: ["Ущільнювач і захист від плям — за кв. фут", "Літієвий ущільнювач між етапами шліфування та проникний захист від плям наприкінці."],
    tl: ["Densifier at stain guard — kada sq ft", "Lithium densifier sa pagitan ng grit at penetrating stain guard sa huli."],
  },
  sealLabour: {
    en: ["Clean and seal — per sq ft", "The slab scrubbed or pressure-washed, left to dry, then sealer rolled or sprayed on in one or two coats."],
    fr: ["Nettoyage et scellement — au pi²", "Dalle frottée ou lavée à pression, laissée sécher, puis scellant appliqué au rouleau ou au pulvérisateur en une ou deux couches."],
    es: ["Limpieza y sellado — por pie²", "Losa tallada o lavada a presión, dejada secar y luego sellador aplicado con rodillo o aspersor en una o dos manos."],
    it: ["Pulizia e sigillatura — al piede quadro", "Massetto strofinato o idropulito, lasciato asciugare, poi sigillante steso a rullo o a spruzzo in una o due mani."],
    de: ["Reinigen und versiegeln — pro sq ft", "Platte geschrubbt oder mit Hochdruck gereinigt, getrocknet, dann Versiegelung in ein oder zwei Schichten gerollt oder gespritzt."],
    uk: ["Очищення та герметизація — за кв. фут", "Плиту вичищено щіткою або мийкою високого тиску, висушено, потім нанесено герметик валиком чи розпилювачем в один-два шари."],
    tl: ["Linis at seal — kada sq ft", "Kinuskos o pinower-wash ang slab, pinatuyo, tapos ni-roll o ini-spray ang sealer nang isa o dalawang patong."],
  },
  sealMat: {
    en: ["Concrete sealer — per sq ft", "Penetrating silane-siloxane or an acrylic film sealer, whichever the surface calls for."],
    fr: ["Scellant à béton — au pi²", "Scellant pénétrant silane-siloxane ou scellant acrylique filmogène, selon ce que demande la surface."],
    es: ["Sellador para concreto — por pie²", "Sellador penetrante de silano-siloxano o sellador acrílico de película, según pida la superficie."],
    it: ["Sigillante per calcestruzzo — al piede quadro", "Sigillante penetrante silano-silossano o sigillante acrilico filmogeno, secondo la superficie."],
    de: ["Betonversiegelung — pro sq ft", "Eindringende Silan-Siloxan-Imprägnierung oder filmbildende Acrylversiegelung, je nach Oberfläche."],
    uk: ["Герметик для бетону — за кв. фут", "Проникний силан-силоксановий або плівкоутворювальний акриловий герметик, залежно від поверхні."],
    tl: ["Concrete sealer — kada sq ft", "Penetrating na silane-siloxane o acrylic film sealer, depende sa kailangan ng surface."],
  },
  engLabour: {
    en: ["Engineered wood installation labour — per sq ft", "Planks floated, glued or nailed as the maker specifies, expansion gaps left and the run finished at the walls."],
    fr: ["Main-d'œuvre — pose de bois d'ingénierie, au pi²", "Planches posées flottantes, collées ou clouées selon le fabricant, jeu de dilatation laissé et rangs finis aux murs."],
    es: ["Mano de obra — instalación de madera de ingeniería, por pie²", "Tablas flotantes, pegadas o clavadas según el fabricante, con juntas de dilatación y rematadas en las paredes."],
    it: ["Manodopera — posa parquet prefinito, al piede quadro", "Doghe posate flottanti, incollate o inchiodate secondo il produttore, giunti di dilatazione lasciati e file rifinite alle pareti."],
    de: ["Arbeit — Fertigparkett verlegen, pro sq ft", "Dielen schwimmend, verklebt oder genagelt nach Herstellervorgabe, Dehnfugen gelassen und an den Wänden abgeschlossen."],
    uk: ["Робота — укладання інженерної дошки, за кв. фут", "Дошки укладено плаваючим способом, на клей чи цвяхи за вимогами виробника, залишено компенсаційні зазори, ряди завершено біля стін."],
    tl: ["Labor — pagkabit ng engineered wood, kada sq ft", "Ni-float, dinikit o ipinako ang plank ayon sa manufacturer, nag-iwan ng expansion gap at tinapos sa pader."],
  },
  engMat: {
    en: ["Engineered hardwood — per sq ft", "Prefinished engineered planks with a 2–4 mm wear layer, plus 8% for cuts."],
    fr: ["Bois d'ingénierie — au pi²", "Planches d'ingénierie préfinies avec couche d'usure de 2 à 4 mm, plus 8 % pour les coupes."],
    es: ["Madera de ingeniería — por pie²", "Tablas de ingeniería prebarnizadas con capa de uso de 2 a 4 mm, más 8 % para cortes."],
    it: ["Parquet prefinito — al piede quadro", "Doghe prefinite con strato nobile da 2–4 mm, più l'8% per i tagli."],
    de: ["Fertigparkett — pro sq ft", "Werkseitig versiegelte Mehrschichtdielen mit 2–4 mm Nutzschicht, plus 8 % Verschnitt."],
    uk: ["Інженерна дошка — за кв. фут", "Інженерна дошка з заводським покриттям і робочим шаром 2–4 мм, плюс 8% на підрізку."],
    tl: ["Engineered hardwood — kada sq ft", "Prefinished na engineered plank na may 2–4 mm wear layer, dagdag 8% para sa tabas."],
  },
  underlay: {
    en: ["Underlayment — per roll", "Foam underlay with a built-in moisture barrier; one roll covers about 100 sq ft."],
    fr: ["Sous-couche — le rouleau", "Sous-couche de mousse avec pare-humidité intégré; un rouleau couvre environ 100 pi²."],
    es: ["Base acústica — por rollo", "Base de espuma con barrera de humedad integrada; un rollo cubre unos 100 pies²."],
    it: ["Materassino — al rotolo", "Materassino in espanso con barriera all'umidità integrata; un rotolo copre circa 100 piedi quadri."],
    de: ["Trittschalldämmung — pro Rolle", "Schaumunterlage mit integrierter Feuchtesperre; eine Rolle reicht für etwa 100 sq ft."],
    uk: ["Підкладка — за рулон", "Пінна підкладка з вбудованим вологобар'єром; рулон покриває близько 100 кв. футів."],
    tl: ["Underlayment — kada rolyo", "Foam underlay na may moisture barrier; ang isang rolyo ay para sa mga 100 sq ft."],
  },
  engRepairLabour: {
    en: ["Plank replacement labour — per sq ft", "Damaged planks cut or unclicked out, matching planks glued in and the joints blended."],
    fr: ["Main-d'œuvre — remplacement de planches d'ingénierie, au pi²", "Planches abîmées découpées ou déclipsées, planches assorties collées en place et joints fondus."],
    es: ["Mano de obra — reemplazo de tablas de ingeniería, por pie²", "Tablas dañadas cortadas o desenganchadas, tablas a juego pegadas y las juntas igualadas."],
    it: ["Manodopera — sostituzione doghe prefinite, al piede quadro", "Doghe danneggiate tagliate o sganciate, doghe abbinate incollate e giunti uniformati."],
    de: ["Arbeit — Fertigparkettdielen ersetzen, pro sq ft", "Beschädigte Dielen herausgeschnitten oder ausgeklickt, passende Dielen eingeleimt und die Fugen angeglichen."],
    uk: ["Робота — заміна інженерних дощок, за кв. фут", "Пошкоджені дошки вирізано або роз'єднано, підібрані вклеєно, стики підігнано."],
    tl: ["Labor — palit ng engineered plank, kada sq ft", "Pinutol o tinanggal sa click ang sirang plank, dinikit ang katugma at pinantay ang dugtungan."],
  },
  engRepairMat: {
    en: ["Matching engineered planks — per sq ft", "Planks matched to species, colour and wear layer, from the client's spares where there are some."],
    fr: ["Planches d'ingénierie assorties — au pi²", "Planches assorties à l'essence, à la couleur et à la couche d'usure, prises dans les surplus du client s'il y en a."],
    es: ["Tablas de ingeniería a juego — por pie²", "Tablas a juego en especie, color y capa de uso, de los sobrantes del cliente si los hay."],
    it: ["Doghe prefinite abbinate — al piede quadro", "Doghe abbinate per essenza, colore e strato nobile, dalle scorte del cliente se ce ne sono."],
    de: ["Passende Fertigparkettdielen — pro sq ft", "Dielen passend in Holzart, Farbe und Nutzschicht, aus dem Restbestand des Kunden, falls vorhanden."],
    uk: ["Підібрані інженерні дошки — за кв. фут", "Дошки, підібрані за породою, кольором і робочим шаром, із запасу клієнта, якщо він є."],
    tl: ["Katugmang engineered plank — kada sq ft", "Plank na tugma sa uri, kulay at wear layer, mula sa reserba ng kliyente kung mayroon."],
  },
  sfLabour: {
    en: ["Basement subfloor installation labour — per sq ft", "Panels laid over the slab with staggered joints, shimmed flat and fastened where the system calls for it."],
    fr: ["Main-d'œuvre — pose de sous-plancher de sous-sol, au pi²", "Panneaux posés sur la dalle à joints décalés, calés à plat et fixés là où le système le demande."],
    es: ["Mano de obra — instalación de subpiso de sótano, por pie²", "Paneles colocados sobre la losa con juntas alternadas, calzados a nivel y fijados donde lo pida el sistema."],
    it: ["Manodopera — posa sottofondo in seminterrato, al piede quadro", "Pannelli posati sulla soletta a giunti sfalsati, spessorati in piano e fissati dove il sistema lo prevede."],
    de: ["Arbeit — Kellerunterboden verlegen, pro sq ft", "Platten mit versetzten Stößen auf der Bodenplatte verlegt, eben unterlegt und befestigt, wo das System es verlangt."],
    uk: ["Робота — влаштування чорнової підлоги в підвалі, за кв. фут", "Панелі покладено на плиту зі зміщеними стиками, вирівняно підкладками й закріплено там, де вимагає система."],
    tl: ["Labor — pagkabit ng subfloor sa basement, kada sq ft", "Inilatag ang panel sa slab na salitan ang dugtungan, sinapinan para pantay at ikinabit kung saan kailangan."],
  },
  sfBasementMat: {
    en: ["Insulated basement subfloor panels — per sq ft", "2 × 2 ft OSB panels on a dimpled or foam base that keeps the finish floor off a cold, damp slab."],
    fr: ["Panneaux de sous-plancher isolés pour sous-sol — au pi²", "Panneaux d'OSB de 2 × 2 pi sur base alvéolée ou en mousse qui isole le revêtement d'une dalle froide et humide."],
    es: ["Paneles de subpiso aislados para sótano — por pie²", "Paneles de OSB de 2 × 2 pies sobre base de membrana con relieve o espuma que separa el piso de una losa fría y húmeda."],
    it: ["Pannelli isolati per sottofondo in seminterrato — al piede quadro", "Pannelli OSB da 2 × 2 piedi su base bugnata o in espanso che tiene il pavimento lontano da una soletta fredda e umida."],
    de: ["Gedämmte Kellerunterbodenplatten — pro sq ft", "2 × 2 ft OSB-Platten auf Noppen- oder Schaumunterseite, die den Belag von einer kalten, feuchten Bodenplatte trennen."],
    uk: ["Утеплені панелі чорнової підлоги для підвалу — за кв. фут", "Панелі OSB 2 × 2 фути на профільованій чи пінній основі, що відділяє покриття від холодної вологої плити."],
    tl: ["Insulated na subfloor panel pang-basement — kada sq ft", "2 × 2 ft na OSB panel sa dimpled o foam na base para hindi dumikit ang sahig sa malamig at basang slab."],
  },
  sfRepairLabour: {
    en: ["Subfloor cut-out and replacement — per sq ft", "Soft or rotten sheathing cut back to the joists, blocking added and a new panel glued and screwed down."],
    fr: ["Découpe et remplacement du sous-plancher — au pi²", "Revêtement mou ou pourri découpé jusqu'aux solives, entretoises ajoutées et nouveau panneau collé et vissé."],
    es: ["Corte y reemplazo de subpiso — por pie²", "Tablero blando o podrido cortado hasta las vigas, bloqueo añadido y un panel nuevo pegado y atornillado."],
    it: ["Taglio e sostituzione del sottofondo — al piede quadro", "Tavolato molle o marcio tagliato fino ai travetti, rompitratta aggiunti e nuovo pannello incollato e avvitato."],
    de: ["Unterboden ausschneiden und ersetzen — pro sq ft", "Weiche oder morsche Beplankung bis zu den Balken ausgeschnitten, Wechsel eingesetzt und neue Platte verklebt und verschraubt."],
    uk: ["Вирізання та заміна чорнової підлоги — за кв. фут", "М'яку чи гнилу обшивку вирізано до лаг, додано розпірки, нову панель приклеєно й прикручено."],
    tl: ["Pagputol at palit ng subfloor — kada sq ft", "Pinutol hanggang joist ang malambot o bulok na sheathing, dinagdagan ng blocking at dinikit at tinurnilyo ang bagong panel."],
  },
  sfRepairMat: {
    en: ["Subfloor panel, adhesive and screws — per sq ft", "23/32 in tongue-and-groove panel, subfloor adhesive and screws."],
    fr: ["Panneau de sous-plancher, adhésif et vis — au pi²", "Panneau bouveté de 23/32 po, adhésif à sous-plancher et vis."],
    es: ["Panel de subpiso, adhesivo y tornillos — por pie²", "Panel machihembrado de 23/32 pulg, adhesivo para subpiso y tornillos."],
    it: ["Pannello per sottofondo, adesivo e viti — al piede quadro", "Pannello maschio-femmina da 23/32 di pollice, adesivo per sottofondi e viti."],
    de: ["Unterbodenplatte, Kleber und Schrauben — pro sq ft", "23/32-Zoll-Platte mit Nut und Feder, Unterbodenkleber und Schrauben."],
    uk: ["Панель чорнової підлоги, клей і шурупи — за кв. фут", "Шпунтована панель 23/32 дюйма, клей для чорнової підлоги та шурупи."],
    tl: ["Subfloor panel, pandikit at turnilyo — kada sq ft", "23/32 in na tongue-and-groove panel, subfloor adhesive at turnilyo."],
  },
  membrane: {
    en: ["Uncoupling membrane — per sq ft", "Polyethylene membrane set in thinset under the tile, so slab movement and hairline cracks do not reach it."],
    fr: ["Membrane de désolidarisation — au pi²", "Membrane de polyéthylène posée au ciment-colle sous les carreaux, pour que les mouvements et microfissures de la dalle ne les atteignent pas."],
    es: ["Membrana desacopladora — por pie²", "Membrana de polietileno asentada en adhesivo bajo el azulejo, para que el movimiento y las fisuras de la losa no lo alcancen."],
    it: ["Membrana desolidarizzante — al piede quadro", "Membrana in polietilene posata su colla sotto le piastrelle, così movimenti e cavillature del massetto non le raggiungono."],
    de: ["Entkopplungsmatte — pro sq ft", "Polyethylenmatte im Kleberbett unter den Fliesen, damit Bewegungen und Haarrisse der Platte sie nicht erreichen."],
    uk: ["Розділювальна мембрана — за кв. фут", "Поліетиленова мембрана на клею під плиткою, щоб рухи й волосяні тріщини плити до неї не доходили."],
    tl: ["Uncoupling membrane — kada sq ft", "Polyethylene membrane na nakalapat sa thinset sa ilalim ng tile, para hindi umabot dito ang galaw at hairline crack ng slab."],
  },
  vaporFilm: {
    en: ["Vapour barrier film — per sq ft", "6-mil poly laid over the slab with taped, overlapped seams before the planks go down."],
    fr: ["Pare-vapeur — au pi²", "Polyéthylène 6 mil posé sur la dalle, joints chevauchés et rubanés, avant la pose des planches."],
    es: ["Película barrera de vapor — por pie²", "Polietileno de 6 mil sobre la losa con traslapes encintados antes de instalar las tablas."],
    it: ["Telo barriera al vapore — al piede quadro", "Polietilene da 6 mil steso sulla soletta con sormonti nastrati prima della posa delle doghe."],
    de: ["Dampfsperrfolie — pro sq ft", "6-mil-PE-Folie überlappend und abgeklebt auf der Bodenplatte, bevor die Dielen verlegt werden."],
    uk: ["Пароізоляційна плівка — за кв. фут", "Поліетилен 6 міл на плиті з напуском і проклеєними швами перед укладанням планок."],
    tl: ["Vapour barrier film — kada sq ft", "6-mil na poly na inilatag sa slab, naka-overlap at tinape ang dugtungan bago ilatag ang plank."],
  },
  vinylRepairLabour: {
    en: ["Vinyl repair labour — per sq ft", "Damaged planks unclicked back from the nearest wall or cut out and glued in; torn sheet patched with a matched inlay."],
    fr: ["Main-d'œuvre — réparation de vinyle, au pi²", "Planches abîmées déclipsées depuis le mur le plus proche ou découpées et collées; vinyle en rouleau déchiré réparé par une incrustation assortie."],
    es: ["Mano de obra — reparación de vinilo, por pie²", "Tablas dañadas desenganchadas desde la pared más cercana o cortadas y pegadas; vinilo en rollo roto parchado con una incrustación a juego."],
    it: ["Manodopera — riparazione vinile, al piede quadro", "Doghe danneggiate sganciate dalla parete più vicina o tagliate e incollate; vinile in rotolo strappato riparato con un intarsio abbinato."],
    de: ["Arbeit — Vinylreparatur, pro sq ft", "Beschädigte Dielen von der nächsten Wand her ausgeklickt oder ausgeschnitten und eingeklebt; gerissene Bahnenware mit passendem Einsatz geflickt."],
    uk: ["Робота — ремонт вінілу, за кв. фут", "Пошкоджені планки роз'єднано від найближчої стіни або вирізано й вклеєно; розірваний рулонний вініл залатано підібраною вставкою."],
    tl: ["Labor — pag-ayos ng vinyl, kada sq ft", "Tinanggal sa click mula sa pinakamalapit na pader o pinutol at dinikit ang sirang plank; tinapalan ng katugmang inlay ang punit na sheet."],
  },
  vinylRepairMat: {
    en: ["Replacement vinyl — per sq ft", "Matching planks or sheet from the client's spares, or the nearest current match."],
    fr: ["Vinyle de remplacement — au pi²", "Planches ou rouleau assortis tirés des surplus du client, ou l'équivalent actuel le plus proche."],
    es: ["Vinilo de reemplazo — por pie²", "Tablas o rollo a juego de los sobrantes del cliente, o lo más parecido que haya hoy."],
    it: ["Vinile di ricambio — al piede quadro", "Doghe o rotolo abbinati dalle scorte del cliente, o il modello attuale più simile."],
    de: ["Ersatzvinyl — pro sq ft", "Passende Dielen oder Bahnenware aus dem Restbestand des Kunden oder das ähnlichste aktuelle Produkt."],
    uk: ["Вініл на заміну — за кв. фут", "Підібрані планки чи рулон із запасу клієнта або найближчий доступний аналог."],
    tl: ["Kapalit na vinyl — kada sq ft", "Katugmang plank o sheet mula sa reserba ng kliyente, o ang pinakamalapit na katulad na mabibili ngayon."],
  },
  nailBase: {
    en: ["Plywood nailing base and vapour barrier — per sq ft", "Poly vapour barrier and 3/4 in plywood fastened to the slab, so solid boards have something to nail into."],
    fr: ["Base de clouage en contreplaqué et pare-vapeur — au pi²", "Pare-vapeur en polyéthylène et contreplaqué de 3/4 po fixé à la dalle, pour que le bois massif ait où être cloué."],
    es: ["Base de triplay para clavar y barrera de vapor — por pie²", "Barrera de polietileno y triplay de 3/4 pulg fijado a la losa, para que la madera maciza tenga dónde clavarse."],
    it: ["Base in compensato per chiodatura e barriera al vapore — al piede quadro", "Barriera in polietilene e compensato da 3/4 di pollice fissato alla soletta, così il massello ha dove essere inchiodato."],
    de: ["Sperrholz-Nagelgrund und Dampfsperre — pro sq ft", "PE-Dampfsperre und 3/4-Zoll-Sperrholz auf der Bodenplatte befestigt, damit Massivdielen genagelt werden können."],
    uk: ["Фанерна основа під цвяхи та пароізоляція — за кв. фут", "Поліетиленова пароізоляція та фанера 3/4 дюйма, закріплені на плиті, щоб масивну дошку було куди прибити."],
    tl: ["Plywood na pakuan at vapour barrier — kada sq ft", "Poly vapour barrier at 3/4 in na plywood na ikinabit sa slab para may mapagpakuan ang solid na tabla."],
  },
  porchLabour: {
    en: ["Porch flooring installation labour — per sq ft", "Tongue-and-groove porch boards blind-nailed over the joists with a slight slope for runoff, ends sealed."],
    fr: ["Main-d'œuvre — pose de plancher de galerie, au pi²", "Planches de galerie bouvetées clouées en biais sur les solives avec une légère pente pour l'écoulement, bouts scellés."],
    es: ["Mano de obra — instalación de piso de porche, por pie²", "Tablas machihembradas de porche clavadas ocultas sobre las vigas con leve pendiente para el agua, puntas selladas."],
    it: ["Manodopera — posa pavimento del portico, al piede quadro", "Tavole maschio-femmina da portico inchiodate a scomparsa sui travetti con leggera pendenza per lo scolo, teste sigillate."],
    de: ["Arbeit — Veranda-Dielenboden verlegen, pro sq ft", "Nut-und-Feder-Verandadielen verdeckt auf die Balken genagelt, mit leichtem Gefälle zum Ablaufen, Stirnseiten versiegelt."],
    uk: ["Робота — настил підлоги веранди, за кв. фут", "Шпунтовані дошки веранди приховано прибито до лаг із легким ухилом для стоку води, торці загерметизовано."],
    tl: ["Labor — pagkabit ng sahig ng porch, kada sq ft", "Tongue-and-groove na tabla ng porch na blind-nailed sa joist na may bahagyang bagsak para sa tubig, sinelyuhan ang dulo."],
  },
  porchMat: {
    en: ["Hardwood porch boards — per sq ft", "1 × 4 tongue-and-groove tropical hardwood or fir porch flooring, plus 10% for cuts."],
    fr: ["Planches de galerie en bois franc — au pi²", "Plancher de galerie bouveté 1 × 4 en bois exotique ou en sapin, plus 10 % pour les coupes."],
    es: ["Tablas de porche de madera dura — por pie²", "Piso de porche machihembrado de 1 × 4 en madera tropical o abeto, más 10 % para cortes."],
    it: ["Tavole da portico in legno duro — al piede quadro", "Pavimento da portico maschio-femmina 1 × 4 in legno tropicale o abete, più il 10% per i tagli."],
    de: ["Hartholz-Verandadielen — pro sq ft", "1 × 4 Nut-und-Feder-Verandaboden aus Tropenholz oder Douglasie, plus 10 % Verschnitt."],
    uk: ["Дошки для веранди з твердої деревини — за кв. фут", "Шпунтована підлога для веранди 1 × 4 з тропічної деревини або ялиці, плюс 10% на підрізку."],
    tl: ["Hardwood na tabla ng porch — kada sq ft", "1 × 4 tongue-and-groove na tropical hardwood o fir na sahig ng porch, dagdag 10% para sa tabas."],
  },
  porchRepair: {
    en: ["Porch board replacement — per sq ft", "Rotten or split boards cut out over the joists, new boards let in, fastened and end-sealed."],
    fr: ["Remplacement de planches de galerie — au pi²", "Planches pourries ou fendues découpées au droit des solives, nouvelles planches insérées, fixées et bouts scellés."],
    es: ["Reemplazo de tablas de porche — por pie²", "Tablas podridas o partidas cortadas sobre las vigas, tablas nuevas insertadas, fijadas y con las puntas selladas."],
    it: ["Sostituzione tavole del portico — al piede quadro", "Tavole marce o spaccate tagliate sui travetti, nuove tavole inserite, fissate e sigillate in testa."],
    de: ["Verandadielen ersetzen — pro sq ft", "Morsche oder gespaltene Dielen über den Balken ausgeschnitten, neue eingesetzt, befestigt und stirnseitig versiegelt."],
    uk: ["Заміна дощок веранди — за кв. фут", "Гнилі чи розколоті дошки вирізано над лагами, нові вставлено, закріплено й торці загерметизовано."],
    tl: ["Palit ng tabla ng porch — kada sq ft", "Pinutol sa ibabaw ng joist ang bulok o biyak na tabla, isiningit ang bago, ikinabit at sinelyuhan ang dulo."],
  },
  paverLabour: {
    en: ["Paver installation labour — per sq ft", "Base compacted in lifts, bedding sand screeded, pavers laid to pattern, edges cut and the field plate-compacted."],
    fr: ["Main-d'œuvre — pose de pavés, au pi²", "Fondation compactée par couches, lit de sable régalé, pavés posés selon le motif, bordures coupées et surface compactée à la plaque."],
    es: ["Mano de obra — instalación de adoquín, por pie²", "Base compactada por capas, cama de arena reglada, adoquines colocados según el diseño, orillas cortadas y todo compactado con placa."],
    it: ["Manodopera — posa masselli, al piede quadro", "Sottofondo compattato a strati, sabbia di allettamento staggiata, masselli posati a disegno, bordi tagliati e superficie vibrocompattata."],
    de: ["Arbeit — Pflasterverlegung, pro sq ft", "Unterbau lagenweise verdichtet, Bettungssand abgezogen, Steine nach Muster verlegt, Ränder geschnitten und die Fläche abgerüttelt."],
    uk: ["Робота — укладання бруківки, за кв. фут", "Основу ущільнено шарами, піщану подушку розрівняно, бруківку викладено за малюнком, краї підрізано й поле проущільнено віброплитою."],
    tl: ["Labor — pagkabit ng paver, kada sq ft", "Kinompact nang patong-patong ang base, ni-screed ang bedding sand, inilatag ang paver ayon sa pattern, pinutol ang gilid at plate-compact ang buo."],
  },
  paverMat: {
    en: ["Driveway pavers — per sq ft", "80 mm concrete pavers rated for vehicle traffic, plus 5–10% for cuts."],
    fr: ["Pavés d'entrée — au pi²", "Pavés de béton de 80 mm conçus pour la circulation automobile, plus 5 à 10 % pour les coupes."],
    es: ["Adoquín para cochera — por pie²", "Adoquines de concreto de 80 mm aptos para tránsito vehicular, más 5 a 10 % para cortes."],
    it: ["Masselli carrabili — al piede quadro", "Masselli in calcestruzzo da 80 mm carrabili, più il 5–10% per i tagli."],
    de: ["Pflastersteine für Einfahrten — pro sq ft", "80-mm-Betonpflaster für Fahrzeugverkehr, plus 5–10 % Verschnitt."],
    uk: ["Бруківка для в'їзду — за кв. фут", "Бетонна бруківка 80 мм для руху автомобілів, плюс 5–10% на підрізку."],
    tl: ["Paver pang-driveway — kada sq ft", "80 mm na concrete paver na pang-sasakyan, dagdag 5–10% para sa tabas."],
  },
  paverBase: {
    en: ["Gravel base and bedding sand — per sq ft", "Crushed stone base deep enough for a driveway and an inch of bedding sand, delivered in bulk."],
    fr: ["Fondation de gravier et sable de pose — au pi²", "Fondation de pierre concassée assez épaisse pour une entrée et un pouce de sable de pose, livrés en vrac."],
    es: ["Base de grava y arena de asiento — por pie²", "Base de piedra triturada con el espesor que pide una cochera y una pulgada de arena de asiento, entregadas a granel."],
    it: ["Sottofondo in ghiaia e sabbia di allettamento — al piede quadro", "Misto frantumato con lo spessore giusto per un carrabile e un pollice di sabbia di allettamento, consegnati sfusi."],
    de: ["Schotterunterbau und Bettungssand — pro sq ft", "Schotter in einfahrttauglicher Stärke und ein Zoll Bettungssand, lose geliefert."],
    uk: ["Щебенева основа та піщана подушка — за кв. фут", "Основа з щебеню потрібної для в'їзду товщини й дюйм піску для подушки, доставлені насипом."],
    tl: ["Gravel base at bedding sand — kada sq ft", "Durog na batong base na sapat ang kapal para sa driveway at isang pulgadang bedding sand, dineliver nang maramihan."],
  },
  polySand: {
    en: ["Polymeric sand and edge restraint — per sq ft", "Joint sand that hardens when wetted, and edge restraint spiked along the open sides."],
    fr: ["Sable polymère et bordure de retenue — au pi²", "Sable à joints qui durcit une fois mouillé, et bordure de retenue clouée le long des côtés ouverts."],
    es: ["Arena polimérica y restricción de borde — por pie²", "Arena para juntas que endurece al mojarse, y restricción de borde clavada a lo largo de los lados abiertos."],
    it: ["Sabbia polimerica e cordolo di contenimento — al piede quadro", "Sabbia per fughe che indurisce se bagnata e cordolo di contenimento fissato lungo i lati aperti."],
    de: ["Polymersand und Randeinfassung — pro sq ft", "Fugensand, der beim Befeuchten aushärtet, und Randeinfassung an den offenen Seiten festgenagelt."],
    uk: ["Полімерний пісок і бортове обмеження — за кв. фут", "Пісок для швів, що твердне після зволоження, і бортове обмеження, прибите вздовж відкритих країв."],
    tl: ["Polymeric sand at edge restraint — kada sq ft", "Buhangin sa joint na tumitigas kapag nabasa, at edge restraint na ipinako sa bukas na gilid."],
  },
  paverRelay: {
    en: ["Paver lift and relay — per sq ft", "Sunken or heaved pavers lifted, the base topped up and recompacted, the pavers relaid and re-sanded."],
    fr: ["Levée et repose de pavés — au pi²", "Pavés affaissés ou soulevés retirés, fondation rechargée et recompactée, pavés reposés et resablés."],
    es: ["Levantar y recolocar adoquín — por pie²", "Adoquines hundidos o levantados retirados, la base rellenada y recompactada, adoquines recolocados y con arena nueva."],
    it: ["Rimozione e riposa masselli — al piede quadro", "Masselli ceduti o sollevati tolti, sottofondo integrato e ricompattato, masselli riposati e risabbiati."],
    de: ["Pflaster aufnehmen und neu verlegen — pro sq ft", "Abgesackte oder angehobene Steine aufgenommen, Unterbau ergänzt und nachverdichtet, Steine neu verlegt und eingesandet."],
    uk: ["Перекладання бруківки — за кв. фут", "Просілу чи підняту бруківку знято, основу досипано й ущільнено, бруківку покладено знову й засипано піском."],
    tl: ["Pag-angat at muling paglatag ng paver — kada sq ft", "Inangat ang lumubog o umangat na paver, dinagdagan at kinompact ulit ang base, inilatag ulit at nilagyan ng buhangin."],
  },
  paverRepairMat: {
    en: ["Base, bedding and joint sand — per sq ft", "Crushed base to top up, bedding sand and polymeric joint sand."],
    fr: ["Fondation, sable de pose et sable à joints — au pi²", "Pierre concassée d'appoint, sable de pose et sable polymère pour les joints."],
    es: ["Base, arena de asiento y de juntas — por pie²", "Piedra triturada para rellenar, arena de asiento y arena polimérica para juntas."],
    it: ["Sottofondo, sabbia di allettamento e per fughe — al piede quadro", "Misto frantumato per integrare, sabbia di allettamento e sabbia polimerica per le fughe."],
    de: ["Unterbau-, Bettungs- und Fugensand — pro sq ft", "Schotter zum Auffüllen, Bettungssand und polymerer Fugensand."],
    uk: ["Основа, пісок для подушки та швів — за кв. фут", "Щебінь для досипання, пісок для подушки й полімерний пісок для швів."],
    tl: ["Base, bedding at joint sand — kada sq ft", "Durog na bato pandagdag, bedding sand at polymeric na buhangin sa joint."],
  },
  asphaltLabour: {
    en: ["Asphalt paving labour — per sq ft", "Hot-mix spread by paver or by hand, rolled to density and the edges tapered."],
    fr: ["Main-d'œuvre — pavage en asphalte, au pi²", "Enrobé à chaud étendu au finisseur ou à la main, cylindré à densité et bordures biseautées."],
    es: ["Mano de obra — pavimentación con asfalto, por pie²", "Mezcla en caliente tendida con máquina o a mano, compactada con rodillo y las orillas en chaflán."],
    it: ["Manodopera — asfaltatura, al piede quadro", "Conglomerato a caldo steso con vibrofinitrice o a mano, rullato a densità e bordi raccordati."],
    de: ["Arbeit — Asphaltieren, pro sq ft", "Heißasphalt mit Fertiger oder von Hand eingebaut, auf Dichte gewalzt und die Ränder angeschrägt."],
    uk: ["Робота — асфальтування, за кв. фут", "Гарячу суміш розкладено асфальтоукладачем або вручну, укатано до щільності, краї скошено."],
    tl: ["Labor — pag-aspalto, kada sq ft", "Ikinalat ang hot-mix gamit ang paver o kamay, niroller hanggang siksik at tinapyas ang gilid."],
  },
  asphaltMat: {
    en: ["Hot-mix asphalt — per sq ft", "A 2–3 in compacted surface course of hot-mix asphalt."],
    fr: ["Enrobé bitumineux à chaud — au pi²", "Couche de surface d'enrobé à chaud de 2 à 3 po, compactée."],
    es: ["Asfalto en caliente — por pie²", "Carpeta de rodadura de asfalto en caliente de 2 a 3 pulg, compactada."],
    it: ["Conglomerato bituminoso a caldo — al piede quadro", "Strato di usura in conglomerato a caldo da 2–3 pollici, compattato."],
    de: ["Heißasphalt — pro sq ft", "2–3 Zoll verdichtete Deckschicht aus Heißasphalt."],
    uk: ["Гарячий асфальт — за кв. фут", "Ущільнений верхній шар гарячого асфальту 2–3 дюйми."],
    tl: ["Hot-mix na aspalto — kada sq ft", "2–3 in na siniksik na surface course ng hot-mix na aspalto."],
  },
  mobilise: {
    en: ["Crew and equipment mobilisation", "Truck, roller and crew brought to site and taken away, charged once per job."],
    fr: ["Mobilisation de l'équipe et de l'équipement", "Camion, rouleau et équipe amenés sur place et repartis, facturé une fois par chantier."],
    es: ["Traslado de cuadrilla y equipo", "Camión, rodillo y cuadrilla llevados a la obra y retirados, cobrado una vez por trabajo."],
    it: ["Mobilitazione di squadra e mezzi", "Camion, rullo e squadra portati in cantiere e riportati via, addebitato una volta per lavoro."],
    de: ["An- und Abtransport von Team und Gerät", "Lkw, Walze und Team zur Baustelle gebracht und wieder abgezogen, einmal pro Auftrag berechnet."],
    uk: ["Доставка бригади та техніки", "Вантажівку, коток і бригаду доставлено на об'єкт і вивезено, оплата один раз за роботу."],
    tl: ["Pagdala ng crew at kagamitan", "Dinala at inuwi ang truck, roller at crew, isang beses sinisingil bawat trabaho."],
  },
  asphaltRepairLabour: {
    en: ["Pothole and crack repair — per sq ft", "Failed patches saw-cut, the base recompacted, asphalt placed and rolled, cracks routed and filled."],
    fr: ["Réparation de nids-de-poule et de fissures — au pi²", "Zones défaillantes sciées, fondation recompactée, asphalte posé et cylindré, fissures ouvertes et remplies."],
    es: ["Reparación de baches y grietas — por pie²", "Zonas dañadas cortadas con sierra, la base recompactada, asfalto colocado y compactado, grietas abiertas y rellenadas."],
    it: ["Riparazione buche e crepe — al piede quadro", "Zone ammalorate tagliate, sottofondo ricompattato, asfalto steso e rullato, crepe aperte e sigillate."],
    de: ["Schlagloch- und Rissreparatur — pro sq ft", "Schadstellen eingesägt, Unterbau nachverdichtet, Asphalt eingebaut und gewalzt, Risse aufgefräst und vergossen."],
    uk: ["Ремонт ям і тріщин — за кв. фут", "Пошкоджені ділянки вирізано, основу доущільнено, асфальт укладено й укатано, тріщини розшито й заповнено."],
    tl: ["Pag-ayos ng lubak at bitak — kada sq ft", "Hiniwa ang sirang bahagi, kinompact ulit ang base, nilagyan at niroller ang aspalto, binuksan at pinunan ang bitak."],
  },
  asphaltRepairMat: {
    en: ["Patch asphalt and crack filler — per sq ft", "Hot-mix or high-performance cold patch, and rubberised hot-pour crack filler."],
    fr: ["Asphalte de rapiéçage et bouche-fissures — au pi²", "Enrobé à chaud ou asphalte froid haute performance, et bouche-fissures caoutchouté coulé à chaud."],
    es: ["Asfalto para bacheo y sellador de grietas — por pie²", "Mezcla en caliente o bacheo en frío de alto desempeño, y sellador de grietas ahulado de aplicación en caliente."],
    it: ["Asfalto per rappezzi e sigillante per crepe — al piede quadro", "Conglomerato a caldo o asfalto a freddo ad alte prestazioni, e sigillante gommato colato a caldo per le crepe."],
    de: ["Flickasphalt und Rissvergussmasse — pro sq ft", "Heißasphalt oder Hochleistungs-Kaltasphalt und gummierte Heißvergussmasse für Risse."],
    uk: ["Ремонтний асфальт і заповнювач тріщин — за кв. фут", "Гаряча суміш або високоякісний холодний асфальт і гумовий заповнювач тріщин гарячого нанесення."],
    tl: ["Patch na aspalto at crack filler — kada sq ft", "Hot-mix o high-performance cold patch, at rubberized na hot-pour crack filler."],
  },
  deckLabour: {
    en: ["Deck board installation labour — per sq ft", "Boards laid over the frame with even gaps, fastened at every joist and the ends trimmed straight."],
    fr: ["Main-d'œuvre — pose de planches de terrasse, au pi²", "Planches posées sur la structure avec espacement égal, fixées à chaque solive et bouts coupés droit."],
    es: ["Mano de obra — instalación de tablas de terraza, por pie²", "Tablas colocadas sobre la estructura con separación pareja, fijadas en cada viga y las puntas cortadas rectas."],
    it: ["Manodopera — posa tavole del deck, al piede quadro", "Tavole posate sulla struttura con fughe regolari, fissate a ogni travetto e teste rifilate dritte."],
    de: ["Arbeit — Terrassendielen verlegen, pro sq ft", "Dielen mit gleichmäßigen Fugen auf der Unterkonstruktion verlegt, an jedem Balken befestigt und die Enden gerade gekappt."],
    uk: ["Робота — настил дощок тераси, за кв. фут", "Дошки покладено на каркас із рівними зазорами, закріплено на кожній лазі, торці рівно обрізано."],
    tl: ["Labor — pagkabit ng deck board, kada sq ft", "Inilatag ang tabla sa frame na pantay ang puwang, ikinabit sa bawat joist at pinutol nang tuwid ang dulo."],
  },
  deckBoards: {
    en: ["Pressure-treated deck boards — per board", "5/4 × 6 in × 8 ft treated boards; one board covers about 3.7 sq ft."],
    fr: ["Planches de terrasse traitées — la planche", "Planches traitées de 5/4 × 6 po × 8 pi; une planche couvre environ 3,7 pi²."],
    es: ["Tablas de terraza tratadas — por tabla", "Tablas tratadas de 5/4 × 6 pulg × 8 pies; una tabla cubre unos 3.7 pies²."],
    it: ["Tavole da deck impregnate — per tavola", "Tavole impregnate 5/4 × 6 pollici × 8 piedi; una tavola copre circa 3,7 piedi quadri."],
    de: ["Kesseldruckimprägnierte Terrassendielen — pro Diele", "5/4 × 6 Zoll × 8 ft imprägnierte Dielen; eine Diele deckt etwa 3,7 sq ft."],
    uk: ["Просочені дошки для тераси — за дошку", "Просочені дошки 5/4 × 6 дюймів × 8 футів; одна дошка покриває близько 3,7 кв. фута."],
    tl: ["Pressure-treated na deck board — kada tabla", "5/4 × 6 in × 8 ft na treated board; ang isang tabla ay para sa mga 3.7 sq ft."],
  },
  deckFasteners: {
    en: ["Deck screws and joist tape — per sq ft", "Coated deck screws and butyl tape over the joist tops to keep water out of the frame."],
    fr: ["Vis de terrasse et ruban de solive — au pi²", "Vis de terrasse enduites et ruban butyle sur le dessus des solives pour garder l'eau hors de la structure."],
    es: ["Tornillos para terraza y cinta para vigas — por pie²", "Tornillos recubiertos para terraza y cinta de butilo sobre las vigas para que el agua no entre en la estructura."],
    it: ["Viti da deck e nastro per travetti — al piede quadro", "Viti da deck rivestite e nastro butilico sulla testa dei travetti per tenere l'acqua fuori dalla struttura."],
    de: ["Terrassenschrauben und Balkenschutzband — pro sq ft", "Beschichtete Terrassenschrauben und Butylband auf den Balkenoberseiten, damit kein Wasser in die Unterkonstruktion zieht."],
    uk: ["Шурупи для тераси та стрічка для лаг — за кв. фут", "Шурупи з покриттям і бутилова стрічка на верх лаг, щоб вода не потрапляла в каркас."],
    tl: ["Deck screw at joist tape — kada sq ft", "Coated na deck screw at butyl tape sa ibabaw ng joist para hindi pasukin ng tubig ang frame."],
  },
  deckRepairLabour: {
    en: ["Deck board replacement labour — per sq ft", "Bad boards pulled, the joists under them probed for rot, new boards cut in and fastened."],
    fr: ["Main-d'œuvre — remplacement de planches de terrasse, au pi²", "Planches abîmées retirées, solives dessous sondées pour la pourriture, nouvelles planches coupées et fixées."],
    es: ["Mano de obra — reemplazo de tablas de terraza, por pie²", "Tablas malas retiradas, las vigas de abajo revisadas por pudrición, tablas nuevas cortadas y fijadas."],
    it: ["Manodopera — sostituzione tavole del deck, al piede quadro", "Tavole rovinate tolte, travetti sottostanti sondati per il marcio, nuove tavole tagliate e fissate."],
    de: ["Arbeit — Terrassendielen ersetzen, pro sq ft", "Schlechte Dielen entfernt, die Balken darunter auf Fäulnis geprüft, neue Dielen zugeschnitten und befestigt."],
    uk: ["Робота — заміна дощок тераси, за кв. фут", "Погані дошки знято, лаги під ними перевірено на гниль, нові дошки нарізано й закріплено."],
    tl: ["Labor — palit ng deck board, kada sq ft", "Tinanggal ang sirang tabla, sinuri ang joist sa ilalim kung bulok, pinutol at ikinabit ang bagong tabla."],
  },
  compLabour: {
    en: ["Composite decking installation labour — per sq ft", "Boards laid with hidden clips, gapped for expansion and picture-framed at the edges."],
    fr: ["Main-d'œuvre — pose de terrasse en composite, au pi²", "Planches posées avec attaches invisibles, espacées pour la dilatation et encadrées en bordure."],
    es: ["Mano de obra — instalación de terraza de compuesto, por pie²", "Tablas colocadas con clips ocultos, con holgura para dilatación y enmarcadas en las orillas."],
    it: ["Manodopera — posa deck in composito, al piede quadro", "Tavole posate con clip a scomparsa, distanziate per la dilatazione e incorniciate sui bordi."],
    de: ["Arbeit — WPC-Terrasse verlegen, pro sq ft", "Dielen mit verdeckten Clips verlegt, mit Dehnfugen und an den Rändern als Rahmen eingefasst."],
    uk: ["Робота — настил композитної тераси, за кв. фут", "Дошки покладено на приховані кліпси із зазорами на розширення та обрамленням по краях."],
    tl: ["Labor — pagkabit ng composite decking, kada sq ft", "Inilatag ang tabla gamit ang nakatagong clip, may puwang para sa expansion at picture-frame sa gilid."],
  },
  compMat: {
    en: ["Composite deck boards — per sq ft", "Capped composite boards in the chosen colour, plus 10% for cuts."],
    fr: ["Planches de terrasse en composite — au pi²", "Planches de composite à coque protectrice dans la couleur choisie, plus 10 % pour les coupes."],
    es: ["Tablas de terraza de compuesto — por pie²", "Tablas de compuesto con capa protectora en el color elegido, más 10 % para cortes."],
    it: ["Tavole da deck in composito — al piede quadro", "Tavole in composito con guscio protettivo nel colore scelto, più il 10% per i tagli."],
    de: ["WPC-Terrassendielen — pro sq ft", "Ummantelte WPC-Dielen in der gewählten Farbe, plus 10 % Verschnitt."],
    uk: ["Композитні дошки для тераси — за кв. фут", "Композитні дошки із захисною оболонкою в обраному кольорі, плюс 10% на підрізку."],
    tl: ["Composite na deck board — kada sq ft", "Capped na composite board sa napiling kulay, dagdag 10% para sa tabas."],
  },
  compClips: {
    en: ["Hidden fasteners — per sq ft", "Clip-and-screw hidden fastener system made for the boards."],
    fr: ["Fixations invisibles — au pi²", "Système d'attaches invisibles à clips et vis conçu pour les planches."],
    es: ["Fijaciones ocultas — por pie²", "Sistema de fijación oculta de clip y tornillo hecho para esas tablas."],
    it: ["Fissaggi a scomparsa — al piede quadro", "Sistema di fissaggio a scomparsa con clip e viti fatto per quelle tavole."],
    de: ["Verdeckte Befestiger — pro sq ft", "Clip-und-Schrauben-System für verdeckte Befestigung, passend zu den Dielen."],
    uk: ["Приховане кріплення — за кв. фут", "Система прихованого кріплення з кліпс і шурупів, створена для цих дощок."],
    tl: ["Nakatagong fastener — kada sq ft", "Clip-at-turnilyong hidden fastener system na gawa para sa board."],
  },
  compRepair: {
    en: ["Composite board replacement — per sq ft", "Damaged boards unclipped and swapped, the clips reset and the run re-gapped."],
    fr: ["Remplacement de planches en composite — au pi²", "Planches abîmées décrochées et remplacées, attaches reposées et espacement refait."],
    es: ["Reemplazo de tablas de compuesto — por pie²", "Tablas dañadas desenganchadas y cambiadas, clips reajustados y la holgura rehecha."],
    it: ["Sostituzione tavole in composito — al piede quadro", "Tavole danneggiate sganciate e cambiate, clip rimesse e fughe ripristinate."],
    de: ["WPC-Dielen ersetzen — pro sq ft", "Beschädigte Dielen ausgeklippt und getauscht, die Clips neu gesetzt und die Fugen neu eingestellt."],
    uk: ["Заміна композитних дощок — за кв. фут", "Пошкоджені дошки від'єднано й замінено, кліпси переставлено, зазори вирівняно."],
    tl: ["Palit ng composite board — kada sq ft", "Tinanggal sa clip at pinalitan ang sirang board, inayos ang clip at ang puwang."],
  },
};

// The lines, built once each and shared by every row that sells them.
const lab = (price, text, extra = SQ) => TL.labour(1, "sqft", price, text, extra);
const mat = (price, text, cost, extra = SQ) => TL.material(1, "sqft", price, text, { ...extra, cost });
const F = {
  tearOut: TL.labour(1, "sqft", 1.5, FX.tearOut, { ...SQ, optional: true }),
  baseboardReset: TL.labour(1, "linear_ft", 2.5, FX.baseboardReset, LF),
  call: SHARED.serviceCall(65),
  carpetLabour: lab(1.25, FX.carpetLabour),
  carpetMat: mat(3.25, FX.carpetMat, 2.45),
  padMat: mat(0.75, FX.padMat, 0.55),
  tackStrip: TL.material(1, "linear_ft", 1.25, FX.tackStrip, { ...LF, cost: 0.9 }),
  carpetRepairLabour: lab(8, FX.carpetRepairLabour),
  carpetPatchMat: TL.material(1, "flat", 25, FX.carpetPatchMat),
  slabGrind: lab(1.75, FX.slabGrind),
  coatApply: lab(2, FX.coatApply),
  coatMat: mat(2.25, FX.coatMat, 1.7),
  coatRepairLabour: lab(6, FX.coatRepairLabour),
  coatRepairMat: mat(2.5, FX.coatRepairMat, 1.88),
  concretePour: lab(4.5, FX.concretePour),
  concreteMat: mat(3, FX.concreteMat, 2.25),
  subBase: lab(1, FX.subBase),
  gravelBase: lab(1.5, FX.gravelBase),
  concreteRepairLabour: lab(9, FX.concreteRepairLabour),
  concreteRepairMat: mat(2, FX.concreteRepairMat, 1.5),
  breakOut: lab(3, FX.breakOut),
  disposal: SHARED.disposalFee(150),
  bin: SHARED.binRental(450),
  polishLabour: lab(3.5, FX.polishLabour),
  polishMat: mat(0.6, FX.polishMat, 0.45),
  sealLabour: lab(0.9, FX.sealLabour),
  sealMat: mat(0.35, FX.sealMat, 0.26),
  engLabour: lab(4, FX.engLabour),
  engMat: mat(5.5, FX.engMat, 4.1),
  underlay: hdMaterial(HD.underlayment_roll, FX.underlay, SQ),
  engRepairLabour: lab(12, FX.engRepairLabour),
  engRepairMat: mat(7, FX.engRepairMat, 5.25),
  sfLabour: lab(2.75, FX.sfLabour),
  sfBasementMat: mat(2.4, FX.sfBasementMat, 1.8),
  sfRepairLabour: lab(9, FX.sfRepairLabour),
  sfRepairMat: mat(1.75, FX.sfRepairMat, 1.3),
  consumables: SHARED.consumables(25),
  membrane: mat(1.75, FX.membrane, 1.3),
  vaporFilm: mat(0.25, FX.vaporFilm, 0.18),
  vinylRepairLabour: lab(7, FX.vinylRepairLabour),
  vinylRepairMat: mat(4, FX.vinylRepairMat, 3),
  nailBase: mat(2.25, FX.nailBase, 1.7),
  porchLabour: lab(6.5, FX.porchLabour),
  porchMat: mat(8.5, FX.porchMat, 6.4),
  porchRepair: lab(14, FX.porchRepair),
  paverLabour: lab(9, FX.paverLabour),
  paverMat: mat(4.5, FX.paverMat, 3.4),
  paverBase: mat(2.25, FX.paverBase, 1.7),
  polySand: mat(0.5, FX.polySand, 0.38),
  paverRelay: lab(12, FX.paverRelay),
  paverRepairMat: mat(1.5, FX.paverRepairMat, 1.13),
  asphaltLabour: lab(2, FX.asphaltLabour),
  asphaltMat: mat(2.25, FX.asphaltMat, 1.7),
  mobilise: TL.labour(1, "flat", 350, FX.mobilise),
  mobiliseRepair: TL.labour(1, "flat", 175, FX.mobilise),
  asphaltRepairLabour: lab(7, FX.asphaltRepairLabour),
  asphaltRepairMat: mat(1.75, FX.asphaltRepairMat, 1.3),
  deckLabour: lab(5, FX.deckLabour),
  deckBoards: hdMaterial(HD.deck_board_area, FX.deckBoards, SQ),
  deckFasteners: mat(0.35, FX.deckFasteners, 0.26),
  deckRepairLabour: lab(9, FX.deckRepairLabour),
  compLabour: lab(6, FX.compLabour),
  compMat: mat(7.5, FX.compMat, 5.6),
  compClips: mat(0.9, FX.compClips, 0.68),
  compRepair: lab(10, FX.compRepair),
};
// The interior templates' own lines, reused as they are.
const lines = (key) => TEMPLATES[key].lines;
const TILE_SET = lines("fq.flooring_install.install.tile_interior");
const VINYL_SET = lines("fq.flooring_install.install.vinyl_interior");
const WOOD_SET = lines("fq.flooring_install.install.wood_interior");
const TILE_FIX = lines("fq.flooring_install.repair.tile_interior");
const WOOD_FIX = lines("fq.flooring_install.repair.wood_interior");
const STRETCH = lines("fq.flooring_install.repair.carpet_stretching_interior");
const DECK_STAIN = lines("fq.flooring_install.maintenance.deck_clean_reseal")[1];

const RECIPES = {
  // [template kind, lines, the other quote types that sell it]
  carpet_install: ["installation", [F.carpetLabour, F.carpetMat, F.padMat, F.tackStrip, F.tearOut]],
  epoxy_install: ["installation", [F.slabGrind, F.coatApply, F.coatMat], ["epoxy"]],
  concrete_indoor: ["installation", [F.subBase, F.concretePour, F.concreteMat], ["concrete"]],
  concrete_outdoor: ["installation", [F.gravelBase, F.concretePour, F.concreteMat], ["concrete"]],
  engineered_install: ["installation", [F.engLabour, F.engMat, F.underlay, F.baseboardReset, F.tearOut]],
  subfloor_basement: ["installation", [F.sfLabour, F.sfBasementMat, F.consumables]],
  tile_on_slab: ["installation", [...TILE_SET, F.membrane], ["tiling"]],
  vinyl_basement: ["installation", [...VINYL_SET, F.vaporFilm, F.baseboardReset]],
  wood_basement: ["installation", [...WOOD_SET, F.nailBase, F.baseboardReset]],
  wood_porch: ["installation", [F.porchLabour, F.porchMat, DECK_STAIN]],
  pavers_install: ["installation", [F.paverLabour, F.paverMat, F.paverBase, F.polySand], ["paving"]],
  asphalt_install: ["installation", [F.mobilise, F.gravelBase, F.asphaltLabour, F.asphaltMat], ["paving"]],
  deck_install: ["installation", [F.deckLabour, F.deckBoards, F.deckFasteners]],
  composite_install: ["installation", [F.compLabour, F.compMat, F.compClips]],
  carpet_repair: ["repair", [F.call, F.carpetRepairLabour, F.carpetPatchMat]],
  carpet_stretch: ["repair", STRETCH],
  epoxy_repair: ["repair", [F.call, F.coatRepairLabour, F.coatRepairMat], ["epoxy"]],
  concrete_repour: ["repair", [F.breakOut, F.concretePour, F.concreteMat, F.disposal], ["concrete"]],
  concrete_removal: ["repair", [F.breakOut, F.bin], ["concrete"]],
  concrete_repair: ["repair", [F.call, F.concreteRepairLabour, F.concreteRepairMat], ["concrete"]],
  concrete_polish: ["maintenance", [F.polishLabour, F.polishMat], ["concrete"]],
  concrete_seal: ["maintenance", [F.sealLabour, F.sealMat], ["concrete"]],
  concrete_seal_driveway: ["maintenance", [F.sealLabour, F.sealMat], ["concrete", "driveway_sealing"]],
  engineered_repair: ["repair", [F.call, F.engRepairLabour, F.engRepairMat]],
  subfloor_repair: ["repair", [F.call, F.sfRepairLabour, F.sfRepairMat]],
  tile_repair: ["repair", TILE_FIX, ["tiling"]],
  vinyl_repair: ["repair", [F.call, F.vinylRepairLabour, F.vinylRepairMat]],
  wood_repair: ["repair", WOOD_FIX],
  porch_repair: ["repair", [F.call, F.porchRepair, F.porchMat]],
  pavers_repair: ["repair", [F.call, F.paverRelay, F.paverRepairMat], ["paving"]],
  asphalt_repair: ["repair", [F.mobiliseRepair, F.asphaltRepairLabour, F.asphaltRepairMat], ["paving", "driveway_sealing"]],
  deck_repair: ["repair", [F.call, F.deckRepairLabour, F.deckBoards]],
  composite_repair: ["repair", [F.call, F.compRepair, F.compMat]],
};
// seed-key suffix → recipe
const ROWS = {
  "install.carpet_basement": "carpet_install", "install.carpet_interior": "carpet_install",
  "install.epoxy_coating_basement": "epoxy_install", "install.epoxy_coating_driveway": "epoxy_install",
  "install.epoxy_coating_garage": "epoxy_install", "install.epoxy_coating_interior": "epoxy_install",
  "install.epoxy_coating_exterior": "epoxy_install",
  "install.concrete_basement": "concrete_indoor", "install.concrete_garage": "concrete_indoor",
  "install.concrete_interior": "concrete_indoor",
  "install.concrete_driveway": "concrete_outdoor", "install.concrete_exterior": "concrete_outdoor",
  "install.engineered_wood_basement": "engineered_install", "install.engineered_wood_interior": "engineered_install",
  "install.subfloor_basement": "subfloor_basement",
  "install.tile_basement": "tile_on_slab", "install.tile_garage": "tile_on_slab", "install.tile_exterior": "tile_on_slab",
  "install.vinyl_basement": "vinyl_basement",
  "install.wood_basement": "wood_basement",
  "install.wood_exterior": "wood_porch",
  "install.pavers_driveway": "pavers_install",
  "install.blacktop_driveway": "asphalt_install",
  "install.wood_deck_exterior": "deck_install",
  "install.composite_deck_exterior": "composite_install",
  "repair.carpet_basement": "carpet_repair", "repair.carpet_interior": "carpet_repair",
  "repair.carpet_stretching_basement": "carpet_stretch",
  "repair.epoxy_coating_basement": "epoxy_repair", "repair.epoxy_coating_driveway": "epoxy_repair",
  "repair.epoxy_coating_garage": "epoxy_repair", "repair.epoxy_coating_interior": "epoxy_repair",
  "repair.epoxy_coating_exterior": "epoxy_repair",
  "repair.concrete_repour_basement": "concrete_repour", "repair.concrete_repour_driveway": "concrete_repour",
  "repair.concrete_repour_garage": "concrete_repour", "repair.concrete_repour_interior": "concrete_repour",
  "repair.concrete_removal_basement": "concrete_removal",
  "repair.concrete_exterior": "concrete_repair",
  "repair.concrete_polishing_basement": "concrete_polish", "repair.concrete_polishing_driveway": "concrete_polish",
  "repair.concrete_sealing_basement": "concrete_seal", "repair.concrete_sealing_garage": "concrete_seal",
  "repair.concrete_sealing_interior": "concrete_seal", "repair.concrete_sealing_exterior": "concrete_seal",
  "repair.concrete_sealing_driveway": "concrete_seal_driveway",
  "repair.engineered_wood_basement": "engineered_repair", "repair.engineered_wood_interior": "engineered_repair",
  "repair.subfloor_basement": "subfloor_repair", "repair.subfloor_interior": "subfloor_repair",
  "repair.tile_basement": "tile_repair", "repair.tile_garage": "tile_repair", "repair.tile_exterior": "tile_repair",
  "repair.vinyl_basement": "vinyl_repair", "repair.vinyl_interior": "vinyl_repair",
  "repair.wood_basement": "wood_repair",
  "repair.wood_exterior": "porch_repair",
  "repair.pavers_driveway": "pavers_repair",
  "repair.blacktop_driveway": "asphalt_repair",
  "repair.wood_deck_exterior": "deck_repair",
  "repair.composite_deck_exterior": "composite_repair",
};
const ADDED = {};
for (const [suffix, recipe] of Object.entries(ROWS)) {
  const key = `fq.flooring_install.${suffix}`;
  const [kind, recipeLines, tags] = RECIPES[recipe];
  ADDED[key] = T(kind, namesOf(key), recipeLines, null, tags ? { categories: ["flooring_install", ...tags] } : {});
}
withTemplates(SEED, ADDED);
