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
  ],
};
