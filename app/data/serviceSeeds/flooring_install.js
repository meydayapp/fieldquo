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

import { L as TL, SHARED, D, T, withTemplates, hdMaterial, tagRows } from "./_templateLines";
import { HD } from "./_materialCosts";

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

withTemplates(SEED, TEMPLATES);

// Shared services: one canonical row here, installed for these quote types too.
tagRows(SEED, {
  "fq.flooring_install.maintenance.tile_grout_seal": ["carpet_cleaning", "handyman", "general_contracting"],
  "fq.flooring_install.maintenance.deck_clean_reseal": ["deck_patio"],
});
