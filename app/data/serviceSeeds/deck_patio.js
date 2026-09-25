// app/data/serviceSeeds/deck_patio.js
//
// The service list a deck and patio company starts from. Read ./index.js for
// the format and the rules. The benchmark's deck and patio book — install
// and repair of decks, railings and patio surfaces, plus upkeep — with no
// pricing insight, in source order. Deck staining and deck sealing are not
// repeated here: they are canonical rows in exterior_painting.js and
// flooring_install.js tagged for this trade. Deck and patio areas are the
// typed `areaSqFt`, paver patios the traced `areaSqft`.
import { L, SHARED, D, T, withTemplates, hdMaterial, tagRows, withLanguages } from "./_templateLines";
import { HD } from "./_materialCosts";
import { I18N } from "./i18n/deck_patio.js";
const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "deck_patio",
  categories: [
    { key: "install", name: { en: "Deck and patio installation", fr: "Installation de terrasses et patios", es: "Instalación de terrazas y patios" } },
    { key: "repair", name: { en: "Deck and patio repair", fr: "Réparation de terrasses et patios", es: "Reparación de terrazas y patios" } },
    { key: "maintenance", name: { en: "Upkeep and inspection", fr: "Entretien et inspection", es: "Mantenimiento e inspección" } },
  ],
  services: [
    S("fq.deck_patio.install.pavers", "install", "sqft", null,
      ["Paver patio — installation", "Patio en pavés — installation", "Patio de adoquín — instalación"],
      ["Paver patio built on a prepared base or frame, laid true, fastened and finished at the edges.", "Patio en pavés construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Patio de adoquín construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.blacktop", "install", "sqft", null,
      ["Asphalt patio or path — installation", "Patio ou allée en asphalte — installation", "Patio o sendero de asfalto — instalación"],
      ["Asphalt patio or path built on a prepared base or frame, laid true, fastened and finished at the edges.", "Patio ou allée en asphalte construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Patio o sendero de asfalto construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.coating", "install", "sqft", null,
      ["Coated or epoxy patio — installation", "Patio avec revêtement ou époxy — installation", "Patio con recubrimiento o epóxico — instalación"],
      ["Coated or epoxy patio built on a prepared base or frame, laid true, fastened and finished at the edges.", "Patio avec revêtement ou époxy construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Patio con recubrimiento o epóxico construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.concrete", "install", "sqft", null,
      ["Concrete patio — installation", "Patio en béton — installation", "Patio de concreto — instalación"],
      ["Concrete patio built on a prepared base or frame, laid true, fastened and finished at the edges.", "Patio en béton construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Patio de concreto construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.tile", "install", "sqft", null,
      ["Tiled patio — installation", "Patio en céramique — installation", "Patio de azulejo — instalación"],
      ["Tiled patio built on a prepared base or frame, laid true, fastened and finished at the edges.", "Patio en céramique construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Patio de azulejo construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.wood_floor", "install", "sqft", null,
      ["Wood patio decking — installation", "Plancher de patio en bois — installation", "Piso de madera para patio — instalación"],
      ["Wood patio decking built on a prepared base or frame, laid true, fastened and finished at the edges.", "Plancher de patio en bois construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Piso de madera para patio construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.wood_deck", "install", "sqft", null,
      ["Wood deck — installation", "Terrasse en bois — installation", "Terraza de madera — instalación"],
      ["Wood deck built on a prepared base or frame, laid true, fastened and finished at the edges.", "Terrasse en bois construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Terraza de madera construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.composite_deck", "install", "sqft", null,
      ["Composite deck — installation", "Terrasse en composite — installation", "Terraza de compuesto — instalación"],
      ["Composite deck built on a prepared base or frame, laid true, fastened and finished at the edges.", "Terrasse en composite construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Terraza de compuesto construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.wood_railing", "install", "linear_ft", null,
      ["Wood deck railing — installation", "Garde-corps de terrasse en bois — installation", "Barandal de terraza de madera — instalación"],
      ["Wood deck railing built on a prepared base or frame, laid true, fastened and finished at the edges.", "Garde-corps de terrasse en bois construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Barandal de terraza de madera construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.composite_railing", "install", "linear_ft", null,
      ["Composite deck railing — installation", "Garde-corps de terrasse en composite — installation", "Barandal de terraza de compuesto — instalación"],
      ["Composite deck railing built on a prepared base or frame, laid true, fastened and finished at the edges.", "Garde-corps de terrasse en composite construit sur une base ou une structure préparée, posé d'équerre, fixé et fini en bordure.", "Barandal de terraza de compuesto construido sobre base o estructura preparada, colocado a escuadra, fijado y rematado en los bordes."]),
    S("fq.deck_patio.install.other", "install", "flat", null,
      ["Other deck or patio installation — describe what you need", "Autre installation de terrasse ou patio — décrivez le besoin", "Otra instalación de terraza o patio — describa lo que necesita"],
      ["Deck or patio work not listed above, priced after a look at the site.", "Travail de terrasse ou de patio non listé ci-dessus, chiffré après examen sur place.", "Trabajo de terraza o patio no listado arriba, cotizado después de ver el sitio."]),
    S("fq.deck_patio.repair.pavers", "repair", "sqft", null,
      ["Paver patio — repair", "Patio en pavés — réparation", "Patio de adoquín — reparación"],
      ["Damaged, loose or rotted parts of a paver patio repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — patio en pavés.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — patio de adoquín."]),
    S("fq.deck_patio.repair.blacktop", "repair", "sqft", null,
      ["Asphalt patio or path — repair", "Patio ou allée en asphalte — réparation", "Patio o sendero de asfalto — reparación"],
      ["Damaged, loose or rotted parts of a asphalt patio or path repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — patio ou allée en asphalte.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — patio o sendero de asfalto."]),
    S("fq.deck_patio.repair.coating", "repair", "sqft", null,
      ["Coated or epoxy patio — repair", "Patio avec revêtement ou époxy — réparation", "Patio con recubrimiento o epóxico — reparación"],
      ["Damaged, loose or rotted parts of a coated or epoxy patio repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — patio avec revêtement ou époxy.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — patio con recubrimiento o epóxico."]),
    S("fq.deck_patio.repair.concrete", "repair", "sqft", null,
      ["Concrete patio — repair", "Patio en béton — réparation", "Patio de concreto — reparación"],
      ["Damaged, loose or rotted parts of a concrete patio repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — patio en béton.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — patio de concreto."]),
    S("fq.deck_patio.repair.tile", "repair", "sqft", null,
      ["Tiled patio — repair", "Patio en céramique — réparation", "Patio de azulejo — reparación"],
      ["Damaged, loose or rotted parts of a tiled patio repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — patio en céramique.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — patio de azulejo."]),
    S("fq.deck_patio.repair.wood_floor", "repair", "sqft", null,
      ["Wood patio decking — repair", "Plancher de patio en bois — réparation", "Piso de madera para patio — reparación"],
      ["Damaged, loose or rotted parts of a wood patio decking repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — plancher de patio en bois.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — piso de madera para patio."]),
    S("fq.deck_patio.repair.wood_deck", "repair", "sqft", null,
      ["Wood deck — repair", "Terrasse en bois — réparation", "Terraza de madera — reparación"],
      ["Damaged, loose or rotted parts of a wood deck repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — terrasse en bois.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — terraza de madera."]),
    S("fq.deck_patio.repair.composite_deck", "repair", "sqft", null,
      ["Composite deck — repair", "Terrasse en composite — réparation", "Terraza de compuesto — reparación"],
      ["Damaged, loose or rotted parts of a composite deck repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — terrasse en composite.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — terraza de compuesto."]),
    S("fq.deck_patio.repair.wood_railing", "repair", "linear_ft", null,
      ["Wood deck railing — repair", "Garde-corps de terrasse en bois — réparation", "Barandal de terraza de madera — reparación"],
      ["Damaged, loose or rotted parts of a wood deck railing repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — garde-corps de terrasse en bois.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — barandal de terraza de madera."]),
    S("fq.deck_patio.repair.composite_railing", "repair", "linear_ft", null,
      ["Composite deck railing — repair", "Garde-corps de terrasse en composite — réparation", "Barandal de terraza de compuesto — reparación"],
      ["Damaged, loose or rotted parts of a composite deck railing repaired or replaced to match, and the surface made safe.", "Pièces abîmées, lâches ou pourries réparées ou remplacées à l'identique, surface rendue sécuritaire — garde-corps de terrasse en composite.", "Partes dañadas, sueltas o podridas reparadas o reemplazadas a juego y superficie segura — barandal de terraza de compuesto."]),
    S("fq.deck_patio.repair.other", "repair", "flat", null,
      ["Other deck or patio repair — describe what you need", "Autre réparation de terrasse ou patio — décrivez le besoin", "Otra reparación de terraza o patio — describa lo que necesita"],
      ["Deck or patio work not listed above, priced after a look at the site.", "Travail de terrasse ou de patio non listé ci-dessus, chiffré après examen sur place.", "Trabajo de terraza o patio no listado arriba, cotizado después de ver el sitio."]),
    S("fq.deck_patio.maintenance.patio_sealing", "maintenance", "sqft", null,
      ["Driveway and patio sealing", "Scellement d'entrée et de patio", "Sellado de entrada y patio"],
      ["The surface cleaned, cracks filled and a penetrating or film sealer applied so water and stains stay out.", "Surface nettoyée, fissures comblées et scellant pénétrant ou pelliculaire appliqué contre l'eau et les taches.", "Superficie limpia, grietas rellenas y sellador penetrante o de película aplicado contra agua y manchas."]),
    S("fq.deck_patio.maintenance.deck_inspection", "maintenance", "flat", null,
      ["Deck safety inspection", "Inspection de sécurité de terrasse", "Inspección de seguridad de terraza"],
      ["Ledger, joists, posts, stairs and railings checked for rot, loose fasteners and flashing, with a written list of repairs.", "Solive de rive, solives, poteaux, escaliers et garde-corps vérifiés pour la pourriture, les fixations lâches et les solins, liste écrite des réparations.", "Viga de anclaje, vigas, postes, escaleras y barandales revisados por pudrición, fijaciones flojas y tapajuntas, con lista escrita de reparaciones."], { durationMinutes: 45, bookable: true }),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: no benchmark insight for decks and patios; 2026 installed rates —
// pressure-treated deck $25–35 a sq ft built, composite $45–60, pavers
// $15–22 — with Home Depot deck boards (3.7 sq ft of deck each) and paver
// base from the reference.
//
// The patio surfaces, railings and repairs (added 2026-09-25): no benchmark
// either, so each rate is the sum of its per-sq-ft or per-lin-ft lines, set
// against 2026 installed figures — asphalt $7–12 a sq ft, broom-finished
// concrete $10–16, epoxy/polyaspartic $6–12, porcelain on a slab $18–30,
// on-grade wood decking $20–30, wood railing $35–55 a lin ft, composite
// $60–90 — and the captured general-contractor and handyman books: deck
// railing install $35 a lin ft, patio hardscape labour $14 a sq ft, deck board
// replacement $75 a board and ledger repair $250 (the scale the repair rows'
// service call and per-post railing lines are set to). Repairs are a service
// call (or, for asphalt, the paving mobilisation) plus per-sq-ft or
// per-lin-ft patch labour and matching material, so the rate is the patch
// and the visit sits on top. On-grade wood decking sits under the captured
// $28 footing-and-framing rate on purpose: sleepers near the ground are not
// an elevated frame. Tile uses the Home Depot porcelain, thinset and grout;
// wood decking the deck board; paver repair the paver base. Ready-mix is its
// own per-cubic-yard line on `concreteCuYd` — outside the per-sq-ft rate,
// since a yard covers a different area at every slab thickness. Flat lines
// (service call, paving mobilisation, haul-away, fasteners) sit on top of
// the rate.
//
// Tags: a patio of concrete, asphalt, pavers, coating or tile is that quote
// type's work done in a back yard — the same crew, the same materials, the
// same per-sq-ft pricing — so the concrete rows also open under "concrete",
// asphalt and paver repair under "paving", the coating rows under "epoxy" and
// the tiled rows under "tiling". Wood and composite decking and railings are
// deck work only and stay untagged.
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const t7 = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });
// New lines carry Punjabi inline — a per-line pair cannot collide with
// another template's line of the same English name in the i18n lines map.
const t8 = (en, fr, es, it, de, uk, pa, tl) => ({ en, fr, es, it, de, uk, pa, tl });
// The rows below already carry their it/de/uk/pa/tl names from the i18n
// file; T() still asks for them, so they are read from there, not re-typed.
const N = (key) => { const e = I18N.services[key]; return { it: e.it, de: e.de, uk: e.uk, pa: e.pa, tl: e.tl }; };

// Shared by the asphalt install and repair: the roller and truck come once
// per job whatever the area, so it is a flat line, never part of the rate.
const MOBILISE = t8(
  ["Paving crew and roller mobilisation", "Crew, roller and truck brought to the site and taken away; charged once per job."],
  ["Mobilisation de l'équipe et du rouleau", "Équipe, rouleau compacteur et camion amenés et repartis; facturé une fois par chantier."],
  ["Movilización de cuadrilla y aplanadora", "Cuadrilla, aplanadora y camión llevados a la obra y retirados; se cobra una vez por trabajo."],
  ["Trasferimento squadra e rullo", "Squadra, rullo e camion portati in cantiere e riportati via; addebitato una volta per lavoro."],
  ["Anfahrt Kolonne und Walze", "Kolonne, Walze und Lkw zur Baustelle gebracht und abgezogen; einmal pro Auftrag berechnet."],
  ["Доставка бригади й котка", "Бригаду, коток і вантажівку привезено на об'єкт і вивезено; оплачується один раз за роботу."],
  ["ਪੇਵਿੰਗ ਟੀਮ ਅਤੇ ਰੋਲਰ ਦੀ ਆਮਦ", "ਟੀਮ, ਰੋਲਰ ਅਤੇ ਟਰੱਕ ਸਾਈਟ 'ਤੇ ਲਿਆਂਦੇ ਅਤੇ ਵਾਪਸ ਲਿਜਾਏ; ਹਰ ਕੰਮ ਲਈ ਇੱਕ ਵਾਰ।"],
  ["Mobilization ng crew at roller", "Dinala sa site at inalis ang crew, roller at truck; isang beses lang kada trabaho."],
);
// Thinset and grout read the same on a new tiled patio and on a patch.
const THINSET = t8(
  ["Exterior thinset — per bag", "Polymer-modified thinset, 50 lb; about 95 sq ft per bag."],
  ["Mortier-colle extérieur — le sac", "Mortier-colle modifié aux polymères, 50 lb; environ 95 pi² par sac."],
  ["Adhesivo para exterior — por bolsa", "Adhesivo cementoso modificado con polímero, 50 lb; unos 95 pies² por bolsa."],
  ["Adesivo cementizio da esterno — al sacco", "Adesivo modificato con polimeri, 50 lb; circa 95 piedi quadri a sacco."],
  ["Fliesenkleber für außen — pro Sack", "Polymervergüteter Dünnbettmörtel, 50 lb; etwa 95 sq ft pro Sack."],
  ["Зовнішній плитковий клей — за мішок", "Клей із полімерними добавками, 50 фунтів; близько 95 кв. футів на мішок."],
  ["ਬਾਹਰੀ ਥਿਨਸੈੱਟ — ਪ੍ਰਤੀ ਬੈਗ", "ਪੌਲੀਮਰ ਵਾਲਾ ਥਿਨਸੈੱਟ, 50 ਪੌਂਡ; ਹਰ ਬੈਗ ਲਗਭਗ 95 ਵਰਗ ਫੁੱਟ।"],
  ["Exterior thinset — kada sako", "Polymer-modified na thinset, 50 lb; mga 95 sq ft kada sako."],
);
const GROUT = t8(
  ["Exterior grout — per bag", "Sanded grout, 25 lb; about 150 sq ft per bag depending on the joint width."],
  ["Coulis extérieur — le sac", "Coulis sablé, 25 lb; environ 150 pi² par sac selon la largeur des joints."],
  ["Boquilla para exterior — por bolsa", "Boquilla con arena, 25 lb; unos 150 pies² por bolsa según el ancho de junta."],
  ["Stucco per esterni — al sacco", "Stucco sabbiato, 25 lb; circa 150 piedi quadri a sacco secondo la fuga."],
  ["Fugenmörtel für außen — pro Sack", "Gesandeter Fugenmörtel, 25 lb; etwa 150 sq ft pro Sack je nach Fugenbreite."],
  ["Зовнішня затірка — за мішок", "Затірка з піском, 25 фунтів; близько 150 кв. футів на мішок залежно від ширини шва."],
  ["ਬਾਹਰੀ ਗ੍ਰਾਊਟ — ਪ੍ਰਤੀ ਬੈਗ", "ਰੇਤ ਵਾਲਾ ਗ੍ਰਾਊਟ, 25 ਪੌਂਡ; ਜੋੜ ਦੀ ਚੌੜਾਈ ਮੁਤਾਬਕ ਹਰ ਬੈਗ ਲਗਭਗ 150 ਵਰਗ ਫੁੱਟ।"],
  ["Exterior grout — kada sako", "Sanded grout, 25 lb; mga 150 sq ft kada sako depende sa lapad ng joint."],
);

const TEMPLATES = {
  "fq.deck_patio.install.wood_deck": T("installation", n(
    ["Terrazza in legno — installazione", "Terrazza in legno costruita su una struttura preparata, posata in squadra, fissata e rifinita ai bordi."],
    ["Holzterrasse — Bau", "Holzterrasse auf vorbereitetem Unterbau gebaut, gerade verlegt, befestigt und an den Kanten abgeschlossen."],
    ["Дерев'яна тераса — будівництво", "Терасу збудовано на підготовленому каркасі, дошки покладено рівно, закріплено й оброблено по краях."],
    ["Deck na kahoy — pagkabit", "Ginawa sa inihandang frame, inilatag nang tuwid, ikinabit at tinapos sa gilid ang deck na kahoy."],
  ), [
    L.labour(1, "sqft", 14, t7(
      ["Framing — per sq ft of deck", "Footings, beams, ledger with flashing and joists 16 in on centre."],
      ["Charpente — au pi² de terrasse", "Semelles, poutres, lambourde avec solin et solives aux 16 po."],
      ["Estructura — por pie² de terraza", "Zapatas, vigas, viga de anclaje con tapajuntas y viguetas cada 16 pulg."],
      ["Struttura — al piede quadro di terrazza", "Plinti, travi, trave di bordo con scossalina e travetti ogni 16 pollici."],
      ["Unterbau — pro sq ft Terrasse", "Fundamente, Träger, Wandbalken mit Blech und Balken im 16-Zoll-Raster."],
      ["Каркас — за кв. фут тераси", "Фундаменти, балки, опорна балка з відливом і лаги кожні 16 дюймів."],
      ["Framing — kada sq ft ng deck", "Footing, beam, ledger na may flashing at joist bawat 16 in."],
    ), { measurementKey: "areaSqFt" }),
    L.labour(1, "sqft", 6, t7(
      ["Decking — per sq ft", "Boards laid with a consistent gap, screwed and trimmed flush."],
      ["Platelage — au pi²", "Planches posées avec un espacement régulier, vissées et coupées à ras."],
      ["Entablado — por pie²", "Tablas colocadas con separación pareja, atornilladas y recortadas al ras."],
      ["Tavolato — al piede quadro", "Tavole posate con fuga costante, avvitate e rifilate a filo."],
      ["Belag — pro sq ft", "Dielen mit gleichmäßiger Fuge verlegt, verschraubt und bündig abgeschnitten."],
      ["Настил — за кв. фут", "Дошки покладено з рівним зазором, прикручено й обрізано врівень."],
      ["Decking — kada sq ft", "Inilatag nang pantay ang pagitan, tinurnilyo at pinutol nang pantay."],
    ), { measurementKey: "areaSqFt" }),
    hdMaterial(HD.deck_board_area, t7(
      ["Pressure-treated deck boards", "5/4 × 6 pressure-treated decking, by the board."],
      ["Planches de terrasse traitées", "Platelage traité 5/4 × 6, à la planche."],
      ["Tablas tratadas para terraza", "Entablado tratado de 5/4 × 6, por tabla."],
      ["Tavole impregnate per terrazza", "Tavolato impregnato 5/4 × 6, a tavola."],
      ["Druckimprägnierte Terrassendielen", "Terrassendielen 5/4 × 6, druckimprägniert, pro Diele."],
      ["Просочені дошки для тераси", "Просочений настил 5/4 × 6, поштучно."],
      ["Pressure-treated na tabla ng deck", "5/4 × 6 pressure-treated na decking, kada tabla."],
    ), { measurementKey: "areaSqFt", wastePct: 10 }),
  ], D.newCustomer("percent", 5)),

  "fq.deck_patio.install.pavers": T("installation", n(
    ["Patio in autobloccanti — installazione", "Patio in autobloccanti costruito su una base preparata, posato in squadra, fissato e rifinito ai bordi."],
    ["Pflasterterrasse — Bau", "Pflasterterrasse auf vorbereitetem Unterbau gebaut, gerade verlegt, gesichert und an den Kanten abgeschlossen."],
    ["Патіо з бруківки — будівництво", "Патіо з бруківки збудовано на підготовленій основі, покладено рівно, закріплено й оброблено по краях."],
    ["Paver patio — pagkabit", "Ginawa sa inihandang base, inilatag nang tuwid, sinigurado at tinapos sa gilid ang paver patio."],
  ), [
    L.labour(1, "sqft", 12, t7(
      ["Paver installation — per sq ft", "Excavated, base compacted, pavers laid, edge-restrained and joint-sanded."],
      ["Pose de pavés — au pi²", "Excavation, fondation compactée, pavés posés, bordure de retenue et sable aux joints."],
      ["Instalación de adoquín — por pie²", "Excavado, base compactada, adoquines colocados, confinados y arenados."],
      ["Posa autobloccanti — al piede quadro", "Scavo, base compattata, masselli posati, cordolo e sabbia nelle fughe."],
      ["Pflasterverlegung — pro sq ft", "Ausgehoben, Tragschicht verdichtet, Pflaster verlegt, eingefasst und eingesandet."],
      ["Укладання бруківки — за кв. фут", "Викопано, основу ущільнено, бруківку покладено, обрамлено й засипано піском."],
      ["Pagkabit ng pavers — kada sq ft", "Hinukay, siniksik ang base, inilatag ang pavers, nilagyan ng gilid at buhangin."],
    ), { measurementKey: "areaSqft" }),
    hdMaterial(HD.paver_base_half_cuft, t7(
      ["Paver base — per bag", "Paver base; about 1.5 sq ft at four inches per bag."],
      ["Fondation pour pavés — le sac", "Fondation pour pavés; environ 1,5 pi² sur quatre pouces par sac."],
      ["Base para adoquín — por bolsa", "Base para adoquín; unos 1.5 pies² a cuatro pulgadas por bolsa."],
      ["Sottofondo per masselli — al sacco", "Sottofondo; circa 1,5 piedi quadri a quattro pollici per sacco."],
      ["Pflasterunterbau — pro Sack", "Tragschichtmaterial; etwa 1,5 sq ft bei vier Zoll pro Sack."],
      ["Основа під бруківку — за мішок", "Основа; близько 1,5 кв. фута шаром чотири дюйми на мішок."],
      ["Paver base — kada sako", "Paver base; mga 1.5 sq ft sa apat na pulgada kada sako."],
    ), { measurementKey: "areaSqft" }),
    L.material(1, "sqft", 4.5, t7(
      ["Concrete pavers — per sq ft", "Standard concrete pavers and polymeric joint sand."],
      ["Pavés de béton — au pi²", "Pavés de béton standard et sable polymère."],
      ["Adoquín de concreto — por pie²", "Adoquín de concreto estándar y arena polimérica."],
      ["Masselli in calcestruzzo — al piede quadro", "Masselli standard e sabbia polimerica."],
      ["Betonpflaster — pro sq ft", "Standard-Betonpflaster und Polymer-Fugensand."],
      ["Бетонна бруківка — за кв. фут", "Стандартна бруківка й полімерний пісок."],
      ["Concrete pavers — kada sq ft", "Standard na pavers at polymeric sand."],
    ), { measurementKey: "areaSqft" }),
  ], null),

  "fq.deck_patio.install.composite_deck": T("installation", n(
    ["Terrazza in composito — installazione", "Terrazza in composito costruita su una struttura preparata, posata in squadra, fissata e rifinita ai bordi."],
    ["WPC-Terrasse — Bau", "Verbundwerkstoff-Terrasse auf vorbereitetem Unterbau gebaut, gerade verlegt, befestigt und abgeschlossen."],
    ["Композитна тераса — будівництво", "Композитну терасу збудовано на підготовленому каркасі, покладено рівно, закріплено й оброблено."],
    ["Composite deck — pagkabit", "Ginawa sa inihandang frame, inilatag nang tuwid, ikinabit at tinapos ang composite deck."],
  ), [
    L.labour(1, "sqft", 16, t7(
      ["Framing and hidden-fastener decking — per sq ft", "Frame built to the manufacturer's joist spacing, boards laid on hidden clips."],
      ["Charpente et platelage à fixations invisibles — au pi²", "Structure selon l'espacement du fabricant, planches posées sur attaches invisibles."],
      ["Estructura y entablado con fijación oculta — por pie²", "Estructura según la separación del fabricante, tablas sobre clips ocultos."],
      ["Struttura e tavolato a clip nascoste — al piede quadro", "Struttura secondo l'interasse del produttore, tavole su clip nascoste."],
      ["Unterbau und verdeckt befestigter Belag — pro sq ft", "Unterbau nach Herstellerabstand, Dielen auf verdeckten Clips."],
      ["Каркас і настил на прихованому кріпленні — за кв. фут", "Каркас за кроком виробника, дошки на прихованих кліпсах."],
      ["Framing at hidden-fastener decking — kada sq ft", "Frame ayon sa spacing ng manufacturer, tabla sa hidden clip."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 14, t7(
      ["Composite decking and clips — per sq ft", "Capped composite boards, hidden clips and fascia."],
      ["Platelage composite et attaches — au pi²", "Planches composites à coque, attaches invisibles et bordure."],
      ["Entablado compuesto y clips — por pie²", "Tablas compuestas con cubierta, clips ocultos y fascia."],
      ["Tavolato composito e clip — al piede quadro", "Tavole in composito rivestito, clip nascoste e fascia."],
      ["WPC-Dielen und Clips — pro sq ft", "Ummantelte Verbunddielen, verdeckte Clips und Blende."],
      ["Композитні дошки й кліпси — за кв. фут", "Композитні дошки з оболонкою, приховані кліпси й лобова дошка."],
      ["Composite decking at clip — kada sq ft", "Capped na composite board, hidden clip at fascia."],
    ), { measurementKey: "areaSqFt", wastePct: 10 }),
  ], null),

  "fq.deck_patio.repair.wood_deck": T("repair", n(
    ["Terrazza in legno — riparazione", "Parti danneggiate, allentate o marce di una terrazza in legno riparate o sostituite e superficie messa in sicurezza."],
    ["Holzterrasse — Reparatur", "Beschädigte, lose oder morsche Teile einer Holzterrasse repariert oder ersetzt und die Fläche sicher gemacht."],
    ["Дерев'яна тераса — ремонт", "Пошкоджені, хиткі чи гнилі частини тераси відремонтовано або замінено, поверхню зроблено безпечною."],
    ["Deck na kahoy — pag-ayos", "Inayos o pinalitan ang sira, maluwag o bulok na bahagi at ginawang ligtas ang deck."],
  ), [
    SHARED.serviceCall(85),
    L.labour(1, "each", 60, t7(
      ["Board replacement — per board", "Rotted board out, joist checked, new board cut and screwed."],
      ["Remplacement de planche — la planche", "Planche pourrie retirée, solive vérifiée, nouvelle planche coupée et vissée."],
      ["Reemplazo de tabla — por tabla", "Tabla podrida fuera, vigueta revisada, tabla nueva cortada y atornillada."],
      ["Sostituzione tavola — per tavola", "Tavola marcia tolta, travetto controllato, nuova tavola tagliata e avvitata."],
      ["Dielentausch — pro Diele", "Morsche Diele raus, Balken geprüft, neue Diele zugeschnitten und verschraubt."],
      ["Заміна дошки — за дошку", "Гнилу дошку знято, лагу перевірено, нову вирізано й прикручено."],
      ["Palit ng tabla — kada tabla", "Tinanggal ang bulok, chineck ang joist, pinutol at tinurnilyo ang bago."],
    ), { measurementKey: "each" }),
    L.material(1, "board", 9.73, t7(
      ["Pressure-treated deck board", "5/4 × 6 pressure-treated board with coated screws."],
      ["Planche de terrasse traitée", "Planche traitée 5/4 × 6 avec vis enduites."],
      ["Tabla tratada para terraza", "Tabla tratada de 5/4 × 6 con tornillos recubiertos."],
      ["Tavola impregnata", "Tavola impregnata 5/4 × 6 con viti rivestite."],
      ["Druckimprägnierte Diele", "Diele 5/4 × 6, druckimprägniert, mit beschichteten Schrauben."],
      ["Просочена дошка", "Просочена дошка 5/4 × 6 з покритими шурупами."],
      ["Pressure-treated na tabla", "5/4 × 6 pressure-treated na tabla na may coated screw."],
    ), { cost: 7.78, measurementKey: "each", ref: HD.deck_board_5_4x6x8 }),
  ], null),

  "fq.deck_patio.maintenance.deck_inspection": T("inspection", n(
    ["Ispezione di sicurezza della terrazza", "Trave di bordo, travetti, pali, scale e ringhiere controllati per marciume, fissaggi allentati e scossaline, con elenco scritto."],
    ["Sicherheitsprüfung der Terrasse", "Wandbalken, Balken, Pfosten, Treppen und Geländer auf Fäulnis, lose Befestigungen und Bleche geprüft, mit schriftlicher Liste."],
    ["Огляд безпеки тераси", "Опорну балку, лаги, стовпи, сходи й поручні перевірено на гниль, слабке кріплення й відливи, з письмовим переліком."],
    ["Inspeksyon ng kaligtasan ng deck", "Chineck ang ledger, joist, poste, hagdan at railing sa bulok, maluwag na fastener at flashing, may nakasulat na listahan."],
  ), [L.labour(1, "flat", 125, t7(
    ["Deck inspection", "Structure probed and fasteners checked, findings photographed."],
    ["Inspection de terrasse", "Structure sondée et fixations vérifiées, constats photographiés."],
    ["Inspección de terraza", "Estructura sondeada y fijaciones revisadas, hallazgos fotografiados."],
    ["Ispezione della terrazza", "Struttura sondata e fissaggi controllati, rilievi fotografati."],
    ["Terrasseninspektion", "Tragwerk geprüft und Befestigungen kontrolliert, Befunde fotografiert."],
    ["Огляд тераси", "Конструкцію простукано, кріплення перевірено, результати сфотографовано."],
    ["Inspeksyon ng deck", "Sinuri ang istruktura at fastener at kinunan ng litrato."],
  )), SHARED.report(40)], null),

  "fq.deck_patio.maintenance.patio_sealing": T("maintenance", n(
    ["Sigillatura di vialetti e patii", "Superficie pulita, crepe riempite e sigillante applicato perché acqua e macchie restino fuori."],
    ["Versiegelung von Einfahrt und Terrasse", "Fläche gereinigt, Risse gefüllt und Versiegelung aufgebracht, damit Wasser und Flecken draußen bleiben."],
    ["Герметизація під'їзду й патіо", "Поверхню очищено, тріщини заповнено, нанесено герметик від води й плям."],
    ["Pagselyo ng driveway at patio", "Nilinis, tinapalan ang bitak at sinelyuhan para hindi pumasok ang tubig at mantsa."],
  ), [
    L.labour(1, "sqft", 0.75, t7(
      ["Clean and seal — per sq ft", "Surface washed, joints topped up and sealer rolled or sprayed."],
      ["Nettoyage et scellement — au pi²", "Surface lavée, joints complétés et scellant appliqué au rouleau ou au pulvérisateur."],
      ["Lavado y sellado — por pie²", "Superficie lavada, juntas completadas y sellador con rodillo o aspersor."],
      ["Pulizia e sigillatura — al piede quadro", "Superficie lavata, fughe completate e sigillante a rullo o spruzzo."],
      ["Reinigen und versiegeln — pro sq ft", "Fläche gewaschen, Fugen ergänzt und Versiegelung gerollt oder gesprüht."],
      ["Очищення й герметизація — за кв. фут", "Поверхню вимито, шви доповнено, герметик нанесено валиком або розпиленням."],
      ["Linis at selyo — kada sq ft", "Hinugasan, dinagdagan ang joint at nilagyan ng sealer."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 0.35, t7(
      ["Paver and concrete sealer — per sq ft", "Penetrating or wet-look sealer."],
      ["Scellant à pavés et béton — au pi²", "Scellant pénétrant ou à effet mouillé."],
      ["Sellador para adoquín y concreto — por pie²", "Sellador penetrante o efecto mojado."],
      ["Sigillante per masselli e calcestruzzo — al piede quadro", "Sigillante penetrante o effetto bagnato."],
      ["Pflaster- und Betonversiegelung — pro sq ft", "Eindringende oder Nass-Effekt-Versiegelung."],
      ["Герметик для бруківки й бетону — за кв. фут", "Проникний герметик або з ефектом мокрого каменю."],
      ["Sealer sa pavers at kongkreto — kada sq ft", "Penetrating o wet-look na sealer."],
    ), { measurementKey: "areaSqFt" }),
  ], D.seasonal("percent", 10)),

  // ── Patio surfaces and railings — installation ──
  "fq.deck_patio.install.blacktop": T("installation", N("fq.deck_patio.install.blacktop"), [
    L.labour(1, "sqft", 5, t8(
      ["Asphalt paving — per sq ft", "Sod and soil dug out, gravel base graded and compacted, 2 in of hot-mix laid and rolled."],
      ["Pavage d'asphalte — au pi²", "Gazon et terre excavés, fondation de gravier nivelée et compactée, 2 po d'enrobé posé et roulé."],
      ["Pavimentación de asfalto — por pie²", "Pasto y tierra excavados, base de grava nivelada y compactada, 2 pulg. de asfalto caliente tendido y aplanado."],
      ["Asfaltatura — al piede quadro", "Zolle e terra scavate, base di ghiaia livellata e compattata, 2 pollici di conglomerato steso e rullato."],
      ["Asphaltierung — pro sq ft", "Rasen und Erde ausgehoben, Schottertragschicht planiert und verdichtet, 2 Zoll Heißasphalt eingebaut und gewalzt."],
      ["Асфальтування — за кв. фут", "Дерен і ґрунт вибрано, щебеневу основу вирівняно й ущільнено, укладено й прокатано 2 дюйми гарячого асфальту."],
      ["ਐਸਫ਼ਾਲਟ ਵਿਛਾਉਣਾ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਘਾਹ ਅਤੇ ਮਿੱਟੀ ਪੁੱਟੀ, ਬੱਜਰੀ ਦਾ ਬੇਸ ਪੱਧਰਾ ਕਰਕੇ ਦੱਬਿਆ, 2 ਇੰਚ ਗਰਮ ਐਸਫ਼ਾਲਟ ਵਿਛਾ ਕੇ ਰੋਲਰ ਫੇਰਿਆ।"],
      ["Labor — asphalt paving, kada sq ft", "Hinukay ang damo at lupa, pinantay at siniksik ang gravel base, naglatag ng 2 in na hot-mix at ni-roller."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 3.75, t8(
      ["Hot-mix asphalt and gravel base — per sq ft", "Crushed gravel base and hot-mix asphalt delivered for a 2 in compacted mat."],
      ["Enrobé bitumineux et gravier de fondation — au pi²", "Gravier concassé de fondation et enrobé à chaud livrés pour une couche compactée de 2 po."],
      ["Asfalto caliente y base de grava — por pie²", "Grava triturada para la base y mezcla asfáltica caliente para una capa compactada de 2 pulg."],
      ["Conglomerato bituminoso e base in ghiaia — al piede quadro", "Ghiaia frantumata per la base e conglomerato a caldo per uno strato compattato di 2 pollici."],
      ["Heißasphalt und Schottertragschicht — pro sq ft", "Schotter für die Tragschicht und Heißmischgut für eine verdichtete 2-Zoll-Decke."],
      ["Гарячий асфальт і щебенева основа — за кв. фут", "Щебінь для основи й гаряча асфальтова суміш для ущільненого шару 2 дюйми."],
      ["ਗਰਮ ਐਸਫ਼ਾਲਟ ਅਤੇ ਬੱਜਰੀ ਬੇਸ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਬੇਸ ਲਈ ਕੁੱਟੀ ਬੱਜਰੀ ਅਤੇ 2 ਇੰਚ ਦੱਬੀ ਤਹਿ ਲਈ ਗਰਮ ਐਸਫ਼ਾਲਟ।"],
      ["Hot-mix asphalt at gravel base — kada sq ft", "Durog na gravel para sa base at hot-mix asphalt para sa 2 in na siksik na layer."],
    ), { measurementKey: "areaSqFt" }),
    L.labour(1, "flat", 450, MOBILISE),
  ], null, { categories: ["deck_patio", "paving"] }),

  "fq.deck_patio.install.coating": T("installation", N("fq.deck_patio.install.coating"), [
    L.labour(1, "sqft", 2.5, t8(
      ["Diamond grind and crack repair — per sq ft", "Slab ground to open the surface, cracks and spalls filled, dust vacuumed."],
      ["Meulage au diamant et réparation des fissures — au pi²", "Dalle meulée pour ouvrir la surface, fissures et éclats comblés, poussière aspirée."],
      ["Pulido con diamante y reparación de grietas — por pie²", "Losa pulida para abrir el poro, grietas y desconchones rellenados, polvo aspirado."],
      ["Levigatura diamantata e riparazione crepe — al piede quadro", "Soletta levigata per aprire la superficie, crepe e scheggiature riempite, polvere aspirata."],
      ["Diamantschliff und Rissreparatur — pro sq ft", "Platte angeschliffen, Risse und Abplatzungen gefüllt, Staub abgesaugt."],
      ["Шліфування алмазом і ремонт тріщин — за кв. фут", "Плиту відшліфовано для зчеплення, тріщини й сколи заповнено, пил зібрано пилососом."],
      ["ਡਾਇਮੰਡ ਘਿਸਾਈ ਅਤੇ ਤਰੇੜਾਂ ਦੀ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਸਲੈਬ ਘਿਸਾ ਕੇ ਸਤਹ ਖੋਲ੍ਹੀ, ਤਰੇੜਾਂ ਅਤੇ ਟੁੱਟੇ ਹਿੱਸੇ ਭਰੇ, ਧੂੜ ਵੈਕਿਊਮ ਨਾਲ ਚੁੱਕੀ।"],
      ["Labor — diamond grind at ayos ng bitak, kada sq ft", "Ginrind ang slab para kumapit, tinapalan ang bitak at tapyas, vinacuum ang alikabok."],
    ), { measurementKey: "areaSqFt" }),
    L.labour(1, "sqft", 3.5, t8(
      ["Coating application — per sq ft", "Epoxy base coat rolled, colour flake broadcast, UV-stable polyaspartic topcoat applied."],
      ["Application du revêtement — au pi²", "Couche de base époxy au rouleau, flocons de couleur projetés, couche de finition polyaspartique résistante aux UV."],
      ["Aplicación del recubrimiento — por pie²", "Capa base epóxica con rodillo, hojuelas de color esparcidas y capa final poliaspártica resistente a UV."],
      ["Applicazione del rivestimento — al piede quadro", "Mano di fondo epossidica a rullo, scaglie colorate sparse, finitura poliaspartica resistente ai raggi UV."],
      ["Beschichtung auftragen — pro sq ft", "Epoxid-Grundschicht gerollt, Farbchips eingestreut, UV-beständige Polyaspartic-Deckschicht aufgetragen."],
      ["Нанесення покриття — за кв. фут", "Епоксидний базовий шар валиком, кольорові чипси розсипано, УФ-стійкий поліаспартиковий фініш."],
      ["ਕੋਟਿੰਗ ਲਾਉਣੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਐਪੌਕਸੀ ਬੇਸ ਕੋਟ ਰੋਲਰ ਨਾਲ, ਰੰਗਦਾਰ ਫ਼ਲੇਕ ਛਿੜਕੇ, ਧੁੱਪ-ਰੋਧਕ ਪੌਲੀਐਸਪਾਰਟਿਕ ਟੌਪਕੋਟ।"],
      ["Labor — paglagay ng coating, kada sq ft", "Ni-roll ang epoxy base coat, sinabuyan ng color flake, nilagyan ng UV-stable na polyaspartic topcoat."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 2.75, t8(
      ["Epoxy and polyaspartic coating system — per sq ft", "Base coat, decorative flake and topcoat, rated for outdoor use."],
      ["Système époxy et polyaspartique — au pi²", "Couche de base, flocons décoratifs et couche de finition pour l'extérieur."],
      ["Sistema epóxico y poliaspártico — por pie²", "Capa base, hojuela decorativa y capa final para exterior."],
      ["Sistema epossidico e poliaspartico — al piede quadro", "Fondo, scaglie decorative e finitura per esterni."],
      ["Epoxid-Polyaspartic-System — pro sq ft", "Grundschicht, Dekorchips und Deckschicht, für außen geeignet."],
      ["Епоксидно-поліаспартикова система — за кв. фут", "Базовий шар, декоративні чипси й фініш для вулиці."],
      ["ਐਪੌਕਸੀ ਅਤੇ ਪੌਲੀਐਸਪਾਰਟਿਕ ਕੋਟਿੰਗ ਸਿਸਟਮ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਬੇਸ ਕੋਟ, ਸਜਾਵਟੀ ਫ਼ਲੇਕ ਅਤੇ ਟੌਪਕੋਟ, ਬਾਹਰ ਲਈ।"],
      ["Epoxy at polyaspartic coating system — kada sq ft", "Base coat, decorative flake at topcoat, pang-outdoor."],
    ), { measurementKey: "areaSqFt" }),
  ], null, { categories: ["deck_patio", "epoxy"] }),

  "fq.deck_patio.install.concrete": T("installation", N("fq.deck_patio.install.concrete"), [
    L.labour(1, "sqft", 9, t8(
      ["Concrete patio — form, pour and finish per sq ft", "Excavated, forms set, concrete placed, screeded, broom-finished and control-jointed."],
      ["Patio en béton — coffrage, coulée et finition au pi²", "Excavation, coffrages posés, béton coulé, tiré à la règle, fini au balai et joints de retrait taillés."],
      ["Patio de concreto — cimbra, colado y acabado por pie²", "Excavado, cimbra colocada, concreto colado, reglado, acabado escobillado y juntas de control."],
      ["Patio in calcestruzzo — casseri, getto e finitura al piede quadro", "Scavo, casseri posati, getto, staggiatura, finitura a scopa e giunti di controllo."],
      ["Betonterrasse — Schalung, Guss und Oberfläche pro sq ft", "Ausgehoben, geschalt, betoniert, abgezogen, mit Besenstrich und Sollfugen."],
      ["Бетонне патіо — опалубка, заливка й оздоблення за кв. фут", "Викопано, опалубку встановлено, бетон залито, вирівняно правилом, оброблено мітлою, нарізано деформаційні шви."],
      ["ਕੰਕਰੀਟ ਵੇਹੜਾ — ਫ਼ਾਰਮ, ਪਾਉਣਾ ਅਤੇ ਫ਼ਿਨਿਸ਼ ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਖੁਦਾਈ, ਫ਼ਾਰਮ ਲਾਏ, ਕੰਕਰੀਟ ਪਾਇਆ, ਪੱਧਰਾ ਕੀਤਾ, ਝਾੜੂ ਫ਼ਿਨਿਸ਼ ਅਤੇ ਕੰਟਰੋਲ ਜੋੜ ਕੱਟੇ।"],
      ["Labor — concrete patio: forms, buhos at finish, kada sq ft", "Hinukay, nilagyan ng form, binuhusan, ni-screed, broom finish at nilagyan ng control joint."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 2, t8(
      ["Gravel base, wire mesh and forms — per sq ft", "Compacted gravel sub-base, reinforcing mesh or rebar, form lumber and stakes."],
      ["Fondation de gravier, treillis et coffrages — au pi²", "Sous-fondation de gravier compacté, treillis ou armature, bois de coffrage et piquets."],
      ["Base de grava, malla y cimbra — por pie²", "Sub-base de grava compactada, malla electrosoldada o varilla, madera de cimbra y estacas."],
      ["Base in ghiaia, rete e casseri — al piede quadro", "Sottofondo in ghiaia compattata, rete elettrosaldata o tondini, legname per casseri e picchetti."],
      ["Schotterbett, Bewehrung und Schalung — pro sq ft", "Verdichtetes Schotterbett, Baustahlmatte oder Bewehrungsstahl, Schalholz und Pflöcke."],
      ["Щебенева основа, сітка й опалубка — за кв. фут", "Ущільнена щебенева подушка, арматурна сітка або стрижні, дошки для опалубки й кілки."],
      ["ਬੱਜਰੀ ਬੇਸ, ਜਾਲੀ ਅਤੇ ਫ਼ਾਰਮ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਦੱਬਿਆ ਬੱਜਰੀ ਸਬ-ਬੇਸ, ਸਰੀਆ ਜਾਂ ਜਾਲੀ, ਫ਼ਾਰਮ ਦੀ ਲੱਕੜ ਅਤੇ ਕਿੱਲੇ।"],
      ["Gravel base, wire mesh at forms — kada sq ft", "Siniksik na gravel sub-base, wire mesh o rebar, kahoy para sa form at istaka."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "each", 190, t8(
      ["Ready-mix concrete — per cubic yard", "Delivered 4,000 psi air-entrained mix; about 81 sq ft of 4 in slab per yard."],
      ["Béton prêt à l'emploi — la verge cube", "Béton 4 000 psi à air entraîné livré par bétonnière; environ 81 pi² de dalle de 4 po par verge."],
      ["Concreto premezclado — por yarda cúbica", "Mezcla de 4,000 psi con aire incluido entregada en olla; unos 81 pies² de losa de 4 pulg. por yarda."],
      ["Calcestruzzo preconfezionato — per iarda cubica", "Miscela da 4.000 psi con aerante consegnata in autobetoniera; circa 81 piedi quadri di soletta da 4 pollici per iarda."],
      ["Transportbeton — pro Kubikyard", "Gelieferter 4.000-psi-Luftporenbeton; etwa 81 sq ft Platte bei 4 Zoll pro Yard."],
      ["Товарний бетон — за куб. ярд", "Доставлений бетон 4000 psi з повітровтягувальною добавкою; приблизно 81 кв. фут плити 4 дюйми на ярд."],
      ["ਰੈਡੀ-ਮਿਕਸ ਕੰਕਰੀਟ — ਪ੍ਰਤੀ ਘਣ ਗਜ਼", "ਪਹੁੰਚਾਇਆ 4,000 psi ਏਅਰ-ਐਂਟ੍ਰੇਂਡ ਮਿਕਸ; 4 ਇੰਚ ਸਲੈਬ ਲਈ ਹਰ ਗਜ਼ ਲਗਭਗ 81 ਵਰਗ ਫੁੱਟ।"],
      ["Ready-mix concrete — kada cubic yard", "Hinatid na 4,000 psi air-entrained mix; mga 81 sq ft ng 4 in na slab kada yarda."],
    ), { cost: 165, measurementKey: "concreteCuYd" }),
    SHARED.haulAway(175),
  ], null, { categories: ["deck_patio", "concrete"] }),

  "fq.deck_patio.install.tile": T("installation", N("fq.deck_patio.install.tile"), [
    L.labour(1, "sqft", 17, t8(
      ["Outdoor tile setting — per sq ft", "Slab cleaned and checked for slope, tile set in exterior thinset with full coverage, grouted and sealed at the edges."],
      ["Pose de céramique extérieure — au pi²", "Dalle nettoyée et pente vérifiée, carreaux posés au mortier-colle extérieur à plein contact, jointoyés et scellés en bordure."],
      ["Colocación de azulejo exterior — por pie²", "Losa limpia y pendiente revisada, piezas asentadas en adhesivo exterior a cobertura total, emboquilladas y selladas en los bordes."],
      ["Posa di piastrelle da esterno — al piede quadro", "Soletta pulita e pendenza verificata, piastrelle posate in adesivo per esterni a piena copertura, stuccate e sigillate ai bordi."],
      ["Außenfliesen verlegen — pro sq ft", "Platte gereinigt und Gefälle geprüft, Fliesen vollflächig in Außenkleber gesetzt, verfugt und an den Rändern abgedichtet."],
      ["Укладання вуличної плитки — за кв. фут", "Плиту очищено й ухил перевірено, плитку покладено на зовнішній клей із повним заповненням, затерто й загерметизовано по краях."],
      ["ਬਾਹਰੀ ਟਾਈਲ ਲਾਉਣੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਸਲੈਬ ਸਾਫ਼ ਕੀਤੀ ਅਤੇ ਢਲਾਣ ਜਾਂਚੀ, ਟਾਈਲ ਬਾਹਰੀ ਥਿਨਸੈੱਟ ਵਿੱਚ ਪੂਰੀ ਲਗਾਈ, ਗ੍ਰਾਊਟ ਭਰਿਆ ਅਤੇ ਕਿਨਾਰੇ ਸੀਲ ਕੀਤੇ।"],
      ["Labor — pagkabit ng outdoor tile, kada sq ft", "Nilinis ang slab at chineck ang slope, ikinabit ang tile sa exterior thinset nang buo, ni-grout at sinelyuhan ang gilid."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 2.5, t8(
      ["Crack-isolation membrane — per sq ft", "Roll-on or sheet membrane over the slab so hairline cracks do not telegraph through the tile."],
      ["Membrane de désolidarisation — au pi²", "Membrane liquide ou en feuille sur la dalle pour que les microfissures ne traversent pas la céramique."],
      ["Membrana antifracturas — por pie²", "Membrana líquida o en rollo sobre la losa para que las fisuras no se transmitan al azulejo."],
      ["Membrana antifrattura — al piede quadro", "Membrana liquida o in fogli sulla soletta perché le microfessure non passino nelle piastrelle."],
      ["Entkopplungsmatte — pro sq ft", "Flüssige oder Bahnen-Entkopplung auf der Platte, damit Haarrisse nicht in die Fliese durchschlagen."],
      ["Мембрана проти тріщин — за кв. фут", "Рідка або рулонна мембрана на плиту, щоб волосяні тріщини не переходили на плитку."],
      ["ਤਰੇੜ-ਰੋਕੂ ਝਿੱਲੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਸਲੈਬ ਉੱਤੇ ਰੋਲ ਜਾਂ ਸ਼ੀਟ ਵਾਲੀ ਝਿੱਲੀ ਤਾਂ ਜੋ ਬਰੀਕ ਤਰੇੜਾਂ ਟਾਈਲ ਤੱਕ ਨਾ ਪਹੁੰਚਣ।"],
      ["Crack-isolation membrane — kada sq ft", "Roll-on o sheet na membrane sa slab para hindi lumabas sa tile ang maliliit na bitak."],
    ), { measurementKey: "areaSqFt" }),
    hdMaterial(HD.tile_porcelain_case, t8(
      ["Outdoor porcelain tile — per case", "12 × 24 porcelain rated for exterior use; about 15.6 sq ft per case."],
      ["Céramique de porcelaine extérieure — la boîte", "Porcelaine 12 × 24 pour l'extérieur; environ 15,6 pi² par boîte."],
      ["Porcelanato para exterior — por caja", "Porcelanato de 12 × 24 apto para exterior; unos 15.6 pies² por caja."],
      ["Gres porcellanato da esterno — a scatola", "Gres 12 × 24 per esterni; circa 15,6 piedi quadri a scatola."],
      ["Feinsteinzeug für außen — pro Karton", "Feinsteinzeug 12 × 24, für außen geeignet; etwa 15,6 sq ft pro Karton."],
      ["Керамограніт для вулиці — за коробку", "Керамограніт 12 × 24 для зовнішніх робіт; близько 15,6 кв. фута в коробці."],
      ["ਬਾਹਰੀ ਪੋਰਸਿਲੇਨ ਟਾਈਲ — ਪ੍ਰਤੀ ਡੱਬਾ", "ਬਾਹਰ ਲਈ 12 × 24 ਪੋਰਸਿਲੇਨ; ਹਰ ਡੱਬੇ ਵਿੱਚ ਲਗਭਗ 15.6 ਵਰਗ ਫੁੱਟ।"],
      ["Outdoor porcelain tile — kada kahon", "12 × 24 na porcelain na pang-labas; mga 15.6 sq ft kada kahon."],
    ), { measurementKey: "areaSqFt", wastePct: 10 }),
    hdMaterial(HD.thinset_50lb, THINSET, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.grout_25lb, GROUT, { measurementKey: "areaSqFt" }),
  ], null, { categories: ["deck_patio", "tiling"] }),

  "fq.deck_patio.install.wood_floor": T("installation", N("fq.deck_patio.install.wood_floor"), [
    L.labour(1, "sqft", 12, t8(
      ["Low-profile framing on grade — per sq ft", "Pier blocks or footings set, beams and joists built close to grade in ground-contact lumber."],
      ["Charpente basse au niveau du sol — au pi²", "Blocs de pilier ou semelles posés, poutres et solives montées près du sol en bois pour contact avec le sol."],
      ["Estructura baja a ras de suelo — por pie²", "Bloques o zapatas colocados, vigas y viguetas armadas cerca del suelo con madera para contacto con tierra."],
      ["Struttura bassa a filo terreno — al piede quadro", "Plinti o blocchi posati, travi e travetti montati vicino al terreno con legname per contatto col suolo."],
      ["Bodennaher Unterbau — pro sq ft", "Punktfundamente gesetzt, Träger und Balken bodennah aus erdkontaktgeeignetem Holz gebaut."],
      ["Низький каркас біля землі — за кв. фут", "Опорні блоки чи фундаменти встановлено, балки й лаги зібрано низько над землею з деревини для контакту з ґрунтом."],
      ["ਜ਼ਮੀਨ ਨੇੜੇ ਨੀਵੀਂ ਫ਼ਰੇਮਿੰਗ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਪਾਇਰ ਬਲਾਕ ਜਾਂ ਨੀਂਹਾਂ ਰੱਖੀਆਂ, ਜ਼ਮੀਨ-ਸੰਪਰਕ ਲੱਕੜ ਨਾਲ ਜ਼ਮੀਨ ਦੇ ਨੇੜੇ ਬੀਮ ਅਤੇ ਜੋਇਸਟ ਬਣਾਏ।"],
      ["Labor — low-profile framing sa lupa, kada sq ft", "Naglagay ng pier block o footing, ginawa ang beam at joist malapit sa lupa gamit ang ground-contact na kahoy."],
    ), { measurementKey: "areaSqFt" }),
    L.labour(1, "sqft", 6, t8(
      ["Patio board laying — per sq ft", "Boards spaced for drainage, screwed at every joist and the ends trimmed straight."],
      ["Pose des planches de patio — au pi²", "Planches espacées pour le drainage, vissées à chaque solive et bouts coupés droit."],
      ["Colocación de tablas del patio — por pie²", "Tablas separadas para el drenaje, atornilladas en cada vigueta y puntas recortadas derechas."],
      ["Posa delle tavole del patio — al piede quadro", "Tavole distanziate per il drenaggio, avvitate su ogni travetto e testate rifilate dritte."],
      ["Terrassendielen verlegen — pro sq ft", "Dielen mit Entwässerungsfuge, auf jedem Balken verschraubt, Enden gerade abgeschnitten."],
      ["Укладання дошок патіо — за кв. фут", "Дошки з зазором для стоку води, прикручено на кожній лазі, торці обрізано рівно."],
      ["ਵੇਹੜੇ ਦੇ ਫੱਟੇ ਵਿਛਾਉਣੇ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਪਾਣੀ ਨਿਕਲਣ ਲਈ ਵਿੱਥ ਰੱਖ ਕੇ ਫੱਟੇ ਲਾਏ, ਹਰ ਜੋਇਸਟ 'ਤੇ ਪੇਚ ਅਤੇ ਸਿਰੇ ਸਿੱਧੇ ਕੱਟੇ।"],
      ["Labor — paglatag ng tabla sa patio, kada sq ft", "May pagitan ang tabla para sa tubig, tinurnilyo sa bawat joist at pinantay ang dulo."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 4, t8(
      ["Ground-contact framing lumber and hardware — per sq ft", "Pressure-treated beams and joists rated for ground contact, joist hangers and structural screws."],
      ["Bois de charpente contact au sol et quincaillerie — au pi²", "Poutres et solives traitées pour contact avec le sol, étriers et vis structurales."],
      ["Madera estructural para contacto con tierra y herrajes — por pie²", "Vigas y viguetas tratadas para contacto con tierra, estribos y tornillos estructurales."],
      ["Legname strutturale da contatto e ferramenta — al piede quadro", "Travi e travetti impregnati per contatto col suolo, staffe e viti strutturali."],
      ["Erdkontakt-Konstruktionsholz und Beschläge — pro sq ft", "Druckimprägnierte Träger und Balken für Erdkontakt, Balkenschuhe und Konstruktionsschrauben."],
      ["Каркасна деревина для контакту з ґрунтом і кріплення — за кв. фут", "Просочені балки й лаги для контакту з ґрунтом, опори лаг і конструкційні шурупи."],
      ["ਜ਼ਮੀਨ-ਸੰਪਰਕ ਫ਼ਰੇਮਿੰਗ ਲੱਕੜ ਅਤੇ ਹਾਰਡਵੇਅਰ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਜ਼ਮੀਨ-ਸੰਪਰਕ ਲਈ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਬੀਮ ਅਤੇ ਜੋਇਸਟ, ਜੋਇਸਟ ਹੈਂਗਰ ਅਤੇ ਢਾਂਚਾਗਤ ਪੇਚ।"],
      ["Ground-contact na framing lumber at hardware — kada sq ft", "Pressure-treated na beam at joist na pang-lupa, joist hanger at structural screw."],
    ), { measurementKey: "areaSqFt" }),
    hdMaterial(HD.deck_board_area, t8(
      ["Pressure-treated patio boards", "5/4 × 6 pressure-treated boards, by the board; about 3.7 sq ft each."],
      ["Planches de patio traitées", "Planches traitées 5/4 × 6, à la planche; environ 3,7 pi² chacune."],
      ["Tablas tratadas para patio", "Tablas tratadas de 5/4 × 6, por tabla; unos 3.7 pies² cada una."],
      ["Tavole impregnate per patio", "Tavole impregnate 5/4 × 6, a tavola; circa 3,7 piedi quadri ciascuna."],
      ["Druckimprägnierte Patiodielen", "Dielen 5/4 × 6, druckimprägniert, pro Diele; je etwa 3,7 sq ft."],
      ["Просочені дошки для патіо", "Просочені дошки 5/4 × 6, поштучно; близько 3,7 кв. фута кожна."],
      ["ਵੇਹੜੇ ਲਈ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਫੱਟੇ", "5/4 × 6 ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਫੱਟੇ, ਪ੍ਰਤੀ ਫੱਟਾ; ਹਰ ਫੱਟਾ ਲਗਭਗ 3.7 ਵਰਗ ਫੁੱਟ।"],
      ["Pressure-treated na tabla ng patio", "5/4 × 6 pressure-treated na tabla, kada piraso; mga 3.7 sq ft bawat isa."],
    ), { measurementKey: "areaSqFt", wastePct: 10 }),
  ], null),

  "fq.deck_patio.install.wood_railing": T("installation", N("fq.deck_patio.install.wood_railing"), [
    L.labour(1, "linear_ft", 30, t8(
      ["Wood railing — build and install per linear ft", "Posts through-bolted to the rim, top and bottom rails set, balusters spaced under 4 in to code."],
      ["Garde-corps en bois — fabrication et pose au pi lin.", "Poteaux boulonnés à la solive de rive, lisses haute et basse posées, barreaux espacés à moins de 4 po selon le code."],
      ["Barandal de madera — armado e instalación por pie lineal", "Postes atornillados a la viga perimetral, largueros superior e inferior colocados, balaústres a menos de 4 pulg. según código."],
      ["Ringhiera in legno — costruzione e posa al piede lineare", "Montanti imbullonati alla trave di bordo, correnti superiore e inferiore posati, balaustri a meno di 4 pollici come da norma."],
      ["Holzgeländer — Bau und Montage pro lfd. Fuß", "Pfosten durch den Randbalken verschraubt, Ober- und Untergurt gesetzt, Stäbe unter 4 Zoll Abstand nach Vorschrift."],
      ["Дерев'яні поручні — виготовлення й монтаж за пог. фут", "Стовпи прикручено наскрізь до обв'язувальної балки, верхню й нижню перекладини встановлено, балясини з кроком менше 4 дюймів за нормами."],
      ["ਲੱਕੜ ਦੀ ਰੇਲਿੰਗ — ਬਣਾਉਣਾ ਅਤੇ ਲਾਉਣਾ ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਪੋਸਟਾਂ ਰਿਮ ਨਾਲ ਬੋਲਟ ਕੀਤੀਆਂ, ਉੱਪਰਲੀ ਅਤੇ ਹੇਠਲੀ ਰੇਲ ਲਾਈ, ਨਿਯਮ ਮੁਤਾਬਕ ਬਲਸਟਰ 4 ਇੰਚ ਤੋਂ ਘੱਟ ਵਿੱਥ 'ਤੇ।"],
      ["Labor — wood railing, gawa at kabit kada linear ft", "Binolt ang poste sa rim, ikinabit ang taas at babang rail, balusters na mas mababa sa 4 in ang pagitan ayon sa code."],
    ), { measurementKey: "linearFt" }),
    L.material(1, "linear_ft", 15, t8(
      ["Pressure-treated railing lumber — per linear ft", "4 × 4 posts, 2 × 4 rails, 2 × 6 cap and 2 × 2 balusters."],
      ["Bois traité pour garde-corps — au pi lin.", "Poteaux 4 × 4, lisses 2 × 4, main courante 2 × 6 et barreaux 2 × 2."],
      ["Madera tratada para barandal — por pie lineal", "Postes de 4 × 4, largueros de 2 × 4, tapa de 2 × 6 y balaústres de 2 × 2."],
      ["Legname impregnato per ringhiera — al piede lineare", "Montanti 4 × 4, correnti 2 × 4, corrimano 2 × 6 e balaustri 2 × 2."],
      ["Druckimprägniertes Geländerholz — pro lfd. Fuß", "Pfosten 4 × 4, Gurte 2 × 4, Handlauf 2 × 6 und Stäbe 2 × 2."],
      ["Просочена деревина для поручнів — за пог. фут", "Стовпи 4 × 4, перекладини 2 × 4, поручень 2 × 6 і балясини 2 × 2."],
      ["ਰੇਲਿੰਗ ਲਈ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਲੱਕੜ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "4 × 4 ਪੋਸਟਾਂ, 2 × 4 ਰੇਲਾਂ, 2 × 6 ਕੈਪ ਅਤੇ 2 × 2 ਬਲਸਟਰ।"],
      ["Pressure-treated na kahoy para sa railing — kada linear ft", "4 × 4 na poste, 2 × 4 na rail, 2 × 6 na cap at 2 × 2 na balusters."],
    ), { measurementKey: "linearFt" }),
    SHARED.consumables(45),
  ], null),

  "fq.deck_patio.install.composite_railing": T("installation", N("fq.deck_patio.install.composite_railing"), [
    L.labour(1, "linear_ft", 32, t8(
      ["Composite railing — install per linear ft", "Post sleeves fitted over blocked posts, rail sections cut to length, brackets and caps fixed level."],
      ["Garde-corps composite — pose au pi lin.", "Manchons posés sur poteaux renforcés, sections coupées sur mesure, supports et capuchons fixés de niveau."],
      ["Barandal compuesto — instalación por pie lineal", "Fundas de poste sobre postes reforzados, tramos cortados a medida, soportes y tapas fijados a nivel."],
      ["Ringhiera in composito — posa al piede lineare", "Coprimontanti su montanti rinforzati, sezioni tagliate a misura, staffe e cappucci fissati in bolla."],
      ["WPC-Geländer — Montage pro lfd. Fuß", "Pfostenhülsen über verstärkte Pfosten gesetzt, Felder abgelängt, Halter und Kappen waagerecht befestigt."],
      ["Композитні поручні — монтаж за пог. фут", "Кожухи надіто на підсилені стовпи, секції обрізано в розмір, кронштейни й ковпачки закріплено по рівню."],
      ["ਕੰਪੋਜ਼ਿਟ ਰੇਲਿੰਗ — ਲਾਉਣਾ ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਮਜ਼ਬੂਤ ਪੋਸਟਾਂ ਉੱਤੇ ਸਲੀਵ ਚੜ੍ਹਾਏ, ਰੇਲ ਹਿੱਸੇ ਨਾਪ ਨਾਲ ਕੱਟੇ, ਬਰੈਕਟ ਅਤੇ ਕੈਪ ਪੱਧਰ ਨਾਲ ਲਾਏ।"],
      ["Labor — composite railing, kabit kada linear ft", "Isinuot ang post sleeve sa pinatibay na poste, pinutol sa sukat ang rail, ikinabit nang pantay ang bracket at cap."],
    ), { measurementKey: "linearFt" }),
    L.material(1, "linear_ft", 42, t8(
      ["Composite railing kit — per linear ft", "Rails, balusters, post sleeves, caps and skirts from the manufacturer's system."],
      ["Ensemble de garde-corps composite — au pi lin.", "Lisses, barreaux, manchons, capuchons et jupes du système du fabricant."],
      ["Kit de barandal compuesto — por pie lineal", "Largueros, balaústres, fundas, tapas y faldones del sistema del fabricante."],
      ["Kit ringhiera in composito — al piede lineare", "Correnti, balaustri, coprimontanti, cappucci e basi del sistema del produttore."],
      ["WPC-Geländersystem — pro lfd. Fuß", "Gurte, Stäbe, Pfostenhülsen, Kappen und Sockelblenden aus dem Herstellersystem."],
      ["Комплект композитних поручнів — за пог. фут", "Перекладини, балясини, кожухи, ковпачки й накладки із системи виробника."],
      ["ਕੰਪੋਜ਼ਿਟ ਰੇਲਿੰਗ ਕਿੱਟ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਨਿਰਮਾਤਾ ਦੇ ਸਿਸਟਮ ਦੀਆਂ ਰੇਲਾਂ, ਬਲਸਟਰ, ਪੋਸਟ ਸਲੀਵ, ਕੈਪ ਅਤੇ ਸਕਰਟ।"],
      ["Composite railing kit — kada linear ft", "Rail, balusters, post sleeve, cap at skirt mula sa sistema ng manufacturer."],
    ), { measurementKey: "linearFt" }),
    SHARED.consumables(45),
  ], null),

  // ── Patio surfaces, decks and railings — repair ──
  "fq.deck_patio.repair.pavers": T("repair", N("fq.deck_patio.repair.pavers"), [
    SHARED.serviceCall(85),
    L.labour(1, "sqft", 8, t8(
      ["Paver lift and relay — per sq ft", "Sunken or heaved pavers lifted, base re-levelled and compacted, pavers relaid and joints re-sanded."],
      ["Relevage et repose de pavés — au pi²", "Pavés affaissés ou soulevés retirés, fondation remise à niveau et compactée, pavés reposés et joints ressablés."],
      ["Levantar y recolocar adoquín — por pie²", "Adoquines hundidos o levantados retirados, base renivelada y compactada, recolocados y juntas rearenadas."],
      ["Rimozione e riposa masselli — al piede quadro", "Masselli ceduti o sollevati tolti, base rilivellata e compattata, masselli riposati e fughe risabbiate."],
      ["Pflaster aufnehmen und neu verlegen — pro sq ft", "Abgesackte oder hochgedrückte Steine aufgenommen, Bett nivelliert und verdichtet, neu verlegt und nachgesandet."],
      ["Перекладання бруківки — за кв. фут", "Просілу чи випнуту бруківку знято, основу вирівняно й ущільнено, покладено назад і засипано шви."],
      ["ਪੇਵਰ ਚੁੱਕ ਕੇ ਮੁੜ ਵਿਛਾਉਣੇ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਧਸੇ ਜਾਂ ਉੱਭਰੇ ਪੇਵਰ ਚੁੱਕੇ, ਬੇਸ ਪੱਧਰਾ ਕਰਕੇ ਦੱਬਿਆ, ਪੇਵਰ ਮੁੜ ਵਿਛਾਏ ਅਤੇ ਜੋੜਾਂ ਵਿੱਚ ਰੇਤ ਭਰੀ।"],
      ["Labor — pag-angat at muling latag ng pavers, kada sq ft", "Inangat ang lubog o umbok na pavers, pinantay at siniksik ang base, ibinalik at nilagyan ng buhangin ang joint."],
    ), { measurementKey: "areaSqft" }),
    hdMaterial(HD.paver_base_half_cuft, t8(
      ["Paver base top-up — per bag", "Paver base to rebuild the sunken area; about 1.5 sq ft at four inches per bag."],
      ["Complément de fondation pour pavés — le sac", "Fondation pour reconstruire la zone affaissée; environ 1,5 pi² sur quatre pouces par sac."],
      ["Base para adoquín de reposición — por bolsa", "Base para rehacer la zona hundida; unos 1.5 pies² a cuatro pulgadas por bolsa."],
      ["Integrazione sottofondo per masselli — al sacco", "Sottofondo per ricostruire la zona ceduta; circa 1,5 piedi quadri a quattro pollici per sacco."],
      ["Pflasterunterbau zum Auffüllen — pro Sack", "Tragschichtmaterial für die abgesackte Stelle; etwa 1,5 sq ft bei vier Zoll pro Sack."],
      ["Досипання основи під бруківку — за мішок", "Основа для відновлення просілої ділянки; близько 1,5 кв. фута шаром чотири дюйми на мішок."],
      ["ਪੇਵਰ ਬੇਸ ਦੀ ਭਰਾਈ — ਪ੍ਰਤੀ ਬੈਗ", "ਧਸੀ ਥਾਂ ਮੁੜ ਬਣਾਉਣ ਲਈ ਪੇਵਰ ਬੇਸ; ਚਾਰ ਇੰਚ 'ਤੇ ਹਰ ਬੈਗ ਲਗਭਗ 1.5 ਵਰਗ ਫੁੱਟ।"],
      ["Dagdag na paver base — kada sako", "Paver base para ayusin ang lumubog na parte; mga 1.5 sq ft sa apat na pulgada kada sako."],
    ), { measurementKey: "areaSqft" }),
    L.material(1, "sqft", 0.6, t8(
      ["Polymeric joint sand — per sq ft", "Polymeric sand swept into the relaid joints and set with water."],
      ["Sable polymère pour joints — au pi²", "Sable polymère balayé dans les joints reposés et activé à l'eau."],
      ["Arena polimérica para juntas — por pie²", "Arena polimérica barrida en las juntas y activada con agua."],
      ["Sabbia polimerica per fughe — al piede quadro", "Sabbia polimerica spazzata nelle fughe e attivata con acqua."],
      ["Polymer-Fugensand — pro sq ft", "Polymersand in die Fugen gekehrt und mit Wasser abgebunden."],
      ["Полімерний пісок для швів — за кв. фут", "Полімерний пісок замітено у шви й закріплено водою."],
      ["ਜੋੜਾਂ ਲਈ ਪੌਲੀਮਰਿਕ ਰੇਤ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਮੁੜ ਵਿਛਾਏ ਜੋੜਾਂ ਵਿੱਚ ਪੌਲੀਮਰਿਕ ਰੇਤ ਝਾੜ ਕੇ ਪਾਣੀ ਨਾਲ ਜਮਾਈ।"],
      ["Polymeric sand sa joint — kada sq ft", "Winalis ang polymeric sand sa joint at pinatigas gamit ang tubig."],
    ), { measurementKey: "areaSqft" }),
  ], null, { categories: ["deck_patio", "paving"] }),

  "fq.deck_patio.repair.blacktop": T("repair", N("fq.deck_patio.repair.blacktop"), [
    L.labour(1, "flat", 250, MOBILISE),
    L.labour(1, "sqft", 6, t8(
      ["Asphalt patch — cut, compact and re-lay per sq ft", "Failed asphalt saw-cut square, base re-compacted, new asphalt laid, rolled and the edges sealed."],
      ["Rapiéçage d'asphalte — coupe, compactage et repose au pi²", "Asphalte brisé découpé à la scie en carré, fondation recompactée, nouvel enrobé posé, roulé et bords scellés."],
      ["Bacheo de asfalto — corte, compactación y tendido por pie²", "Asfalto dañado cortado en cuadro, base recompactada, asfalto nuevo tendido, aplanado y bordes sellados."],
      ["Rappezzo d'asfalto — taglio, compattazione e stesa al piede quadro", "Asfalto rovinato tagliato a squadra, base ricompattata, nuovo asfalto steso, rullato e bordi sigillati."],
      ["Asphaltflicken — schneiden, verdichten und einbauen pro sq ft", "Schadhafter Asphalt rechteckig ausgeschnitten, Tragschicht nachverdichtet, neu eingebaut, gewalzt und Ränder vergossen."],
      ["Ямковий ремонт асфальту — вирізання, ущільнення й укладання за кв. фут", "Зруйнований асфальт вирізано прямокутником, основу ущільнено, новий асфальт укладено, прокатано, краї загерметизовано."],
      ["ਐਸਫ਼ਾਲਟ ਪੈਚ — ਕੱਟਣਾ, ਦੱਬਣਾ ਅਤੇ ਮੁੜ ਵਿਛਾਉਣਾ ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਖ਼ਰਾਬ ਐਸਫ਼ਾਲਟ ਚੌਰਸ ਕੱਟਿਆ, ਬੇਸ ਮੁੜ ਦੱਬਿਆ, ਨਵਾਂ ਐਸਫ਼ਾਲਟ ਵਿਛਾ ਕੇ ਰੋਲ ਕੀਤਾ ਅਤੇ ਕਿਨਾਰੇ ਸੀਲ ਕੀਤੇ।"],
      ["Labor — asphalt patch: putol, siksik at latag, kada sq ft", "Pinutol nang parisukat ang sirang aspalto, siniksik ulit ang base, naglatag ng bago, ni-roller at sinelyuhan ang gilid."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 2.5, t8(
      ["Patching asphalt and tack coat — per sq ft", "Hot-mix or cold-patch asphalt with tack coat and edge sealer."],
      ["Enrobé de rapiéçage et liant d'accrochage — au pi²", "Enrobé à chaud ou à froid, liant d'accrochage et scellant de bordure."],
      ["Asfalto para bacheo y riego de liga — por pie²", "Asfalto caliente o en frío con riego de liga y sellador de bordes."],
      ["Asfalto da rappezzo e mano d'attacco — al piede quadro", "Conglomerato a caldo o a freddo con mano d'attacco e sigillante per i bordi."],
      ["Flickasphalt und Haftkleber — pro sq ft", "Heiß- oder Kaltasphalt mit Haftkleber und Randvergussmasse."],
      ["Асфальт для латок і підгрунтовка — за кв. фут", "Гарячий або холодний асфальт із бітумною підгрунтовкою й герметиком для країв."],
      ["ਪੈਚ ਵਾਲਾ ਐਸਫ਼ਾਲਟ ਅਤੇ ਟੈਕ ਕੋਟ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਗਰਮ ਜਾਂ ਠੰਢਾ ਪੈਚ ਐਸਫ਼ਾਲਟ, ਟੈਕ ਕੋਟ ਅਤੇ ਕਿਨਾਰਿਆਂ ਲਈ ਸੀਲਰ।"],
      ["Patching asphalt at tack coat — kada sq ft", "Hot-mix o cold-patch na aspalto, may tack coat at sealer sa gilid."],
    ), { measurementKey: "areaSqFt" }),
  ], null, { categories: ["deck_patio", "paving"] }),

  "fq.deck_patio.repair.coating": T("repair", N("fq.deck_patio.repair.coating"), [
    SHARED.serviceCall(85),
    L.labour(1, "sqft", 4.5, t8(
      ["Coating repair — grind, patch and recoat per sq ft", "Peeling or worn coating ground back to sound edges, substrate patched, base, flake and topcoat blended in."],
      ["Réparation du revêtement — meulage, ragréage et recouvrement au pi²", "Revêtement écaillé ou usé meulé jusqu'aux bords sains, support ragréé, base, flocons et finition fondus avec l'existant."],
      ["Reparación del recubrimiento — pulido, resane y recapa por pie²", "Recubrimiento pelado o gastado pulido hasta bordes firmes, base resanada, capa base, hojuela y capa final igualadas."],
      ["Riparazione del rivestimento — levigatura, rasatura e ripristino al piede quadro", "Rivestimento sfogliato o usurato levigato fino ai bordi sani, fondo rasato, base, scaglie e finitura raccordate."],
      ["Beschichtungsreparatur — schleifen, spachteln, neu beschichten pro sq ft", "Abblätternde oder abgenutzte Beschichtung bis zu festen Rändern geschliffen, Untergrund gespachtelt, Grund, Chips und Deckschicht angeglichen."],
      ["Ремонт покриття — шліфування, латання й перекриття за кв. фут", "Відшароване чи стерте покриття зашліфовано до міцних країв, основу залатано, базу, чипси й фініш підігнано."],
      ["ਕੋਟਿੰਗ ਮੁਰੰਮਤ — ਘਿਸਾਈ, ਪੈਚ ਅਤੇ ਮੁੜ ਕੋਟ ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਉੱਖੜੀ ਜਾਂ ਘਸੀ ਕੋਟਿੰਗ ਪੱਕੇ ਕਿਨਾਰਿਆਂ ਤੱਕ ਘਿਸਾਈ, ਹੇਠਲੀ ਸਤਹ ਪੈਚ ਕੀਤੀ, ਬੇਸ, ਫ਼ਲੇਕ ਅਤੇ ਟੌਪਕੋਟ ਮਿਲਾ ਕੇ ਲਾਏ।"],
      ["Labor — ayos ng coating: grind, tapal at recoat, kada sq ft", "Ginrind ang natuklap o gasgas na coating hanggang matibay na gilid, tinapalan ang ilalim, pinagtugma ang base, flake at topcoat."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 2.25, t8(
      ["Coating repair materials — per sq ft", "Patching mortar, epoxy base, matching flake and polyaspartic topcoat."],
      ["Matériaux de réparation du revêtement — au pi²", "Mortier de ragréage, base époxy, flocons assortis et finition polyaspartique."],
      ["Materiales para reparar el recubrimiento — por pie²", "Mortero de resane, base epóxica, hojuela a juego y capa final poliaspártica."],
      ["Materiali per riparare il rivestimento — al piede quadro", "Malta da ripristino, fondo epossidico, scaglie abbinate e finitura poliaspartica."],
      ["Material für die Beschichtungsreparatur — pro sq ft", "Reparaturmörtel, Epoxidgrund, passende Chips und Polyaspartic-Deckschicht."],
      ["Матеріали для ремонту покриття — за кв. фут", "Ремонтна суміш, епоксидна база, чипси в тон і поліаспартиковий фініш."],
      ["ਕੋਟਿੰਗ ਮੁਰੰਮਤ ਦਾ ਸਮਾਨ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਪੈਚ ਮਸਾਲਾ, ਐਪੌਕਸੀ ਬੇਸ, ਮਿਲਦੇ ਫ਼ਲੇਕ ਅਤੇ ਪੌਲੀਐਸਪਾਰਟਿਕ ਟੌਪਕੋਟ।"],
      ["Materyales sa ayos ng coating — kada sq ft", "Patching mortar, epoxy base, katugmang flake at polyaspartic topcoat."],
    ), { measurementKey: "areaSqFt" }),
  ], null, { categories: ["deck_patio", "epoxy"] }),

  "fq.deck_patio.repair.concrete": T("repair", N("fq.deck_patio.repair.concrete"), [
    SHARED.serviceCall(85),
    L.labour(1, "sqft", 6, t8(
      ["Concrete crack and surface repair — per sq ft", "Cracks routed and filled, spalled areas chipped back and patched, resurfacer troweled and broom-finished to match."],
      ["Réparation de fissures et de surface en béton — au pi²", "Fissures ouvertes et comblées, zones écaillées piquées et ragréées, surfaçage à la truelle et fini au balai."],
      ["Reparación de grietas y superficie de concreto — por pie²", "Grietas abiertas y rellenadas, zonas descascaradas picadas y resanadas, resanador aplicado con llana y escobillado."],
      ["Riparazione di crepe e superficie in calcestruzzo — al piede quadro", "Crepe aperte e riempite, zone sfaldate scalpellate e ripristinate, rasante a spatola e finitura a scopa."],
      ["Beton-Riss- und Oberflächenreparatur — pro sq ft", "Risse aufgefräst und verfüllt, Abplatzungen ausgestemmt und geflickt, Feinspachtel aufgezogen und mit Besenstrich angeglichen."],
      ["Ремонт тріщин і поверхні бетону — за кв. фут", "Тріщини розшито й заповнено, відколоті місця вибито й залатано, ремонтну суміш нанесено кельмою й оброблено мітлою."],
      ["ਕੰਕਰੀਟ ਤਰੇੜਾਂ ਅਤੇ ਸਤਹ ਦੀ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਤਰੇੜਾਂ ਖੋਲ੍ਹ ਕੇ ਭਰੀਆਂ, ਉੱਖੜੇ ਹਿੱਸੇ ਛਿੱਲ ਕੇ ਪੈਚ ਕੀਤੇ, ਰੀਸਰਫ਼ੇਸਰ ਕਰੰਡੀ ਨਾਲ ਲਾ ਕੇ ਝਾੜੂ ਫ਼ਿਨਿਸ਼।"],
      ["Labor — ayos ng bitak at surface ng kongkreto, kada sq ft", "Binuksan at pinunan ang bitak, tinapyas at tinapalan ang natuklap, nilagyan ng resurfacer at broom finish para tumugma."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 1.75, t8(
      ["Concrete resurfacer and crack filler — per sq ft", "Polymer-modified resurfacer, crack sealant and bonding agent."],
      ["Surfaceur de béton et bouche-fissures — au pi²", "Surfaceur modifié aux polymères, scellant à fissures et agent de liaison."],
      ["Resanador de concreto y sellador de grietas — por pie²", "Resanador modificado con polímero, sellador de grietas y adhesivo de unión."],
      ["Rasante per calcestruzzo e stucco per crepe — al piede quadro", "Rasante modificato con polimeri, sigillante per crepe e promotore di adesione."],
      ["Betonspachtel und Rissfüller — pro sq ft", "Polymervergüteter Betonspachtel, Rissdichtmasse und Haftbrücke."],
      ["Ремонтна суміш і заповнювач тріщин — за кв. фут", "Полімерна ремонтна суміш, герметик для тріщин і адгезійна ґрунтовка."],
      ["ਕੰਕਰੀਟ ਰੀਸਰਫ਼ੇਸਰ ਅਤੇ ਤਰੇੜ ਭਰਾਈ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਪੌਲੀਮਰ ਵਾਲਾ ਰੀਸਰਫ਼ੇਸਰ, ਤਰੇੜ ਸੀਲੈਂਟ ਅਤੇ ਬੌਂਡਿੰਗ ਏਜੰਟ।"],
      ["Concrete resurfacer at crack filler — kada sq ft", "Polymer-modified na resurfacer, crack sealant at bonding agent."],
    ), { measurementKey: "areaSqFt" }),
  ], null, { categories: ["deck_patio", "concrete"] }),

  "fq.deck_patio.repair.tile": T("repair", N("fq.deck_patio.repair.tile"), [
    SHARED.serviceCall(85),
    L.labour(1, "sqft", 16, t8(
      ["Tile repair — remove, reset and grout per sq ft", "Cracked or hollow tiles cut out, old thinset ground off, new tiles set to match and grouted."],
      ["Réparation de céramique — retrait, repose et coulis au pi²", "Carreaux fissurés ou sonnant creux retirés, ancien mortier meulé, nouveaux carreaux posés à l'identique et jointoyés."],
      ["Reparación de azulejo — retirar, reasentar y emboquillar por pie²", "Piezas rotas o huecas retiradas, adhesivo viejo desbastado, piezas nuevas asentadas a juego y emboquilladas."],
      ["Riparazione piastrelle — rimozione, riposa e stuccatura al piede quadro", "Piastrelle crepate o vuote tolte, vecchio adesivo rimosso, nuove piastrelle posate in accordo e stuccate."],
      ["Fliesenreparatur — ausbauen, neu setzen, verfugen pro sq ft", "Gerissene oder hohl klingende Fliesen ausgebaut, alter Kleber abgeschliffen, neue Fliesen passend gesetzt und verfugt."],
      ["Ремонт плитки — демонтаж, перекладання й затирка за кв. фут", "Трісну чи порожнисту плитку вирізано, старий клей зішліфовано, нову покладено в тон і затерто."],
      ["ਟਾਈਲ ਮੁਰੰਮਤ — ਕੱਢਣਾ, ਮੁੜ ਲਾਉਣਾ ਅਤੇ ਗ੍ਰਾਊਟ ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਟੁੱਟੀਆਂ ਜਾਂ ਖੋਖਲੀਆਂ ਟਾਈਲਾਂ ਕੱਢੀਆਂ, ਪੁਰਾਣਾ ਥਿਨਸੈੱਟ ਘਿਸਾਇਆ, ਮਿਲਦੀਆਂ ਨਵੀਆਂ ਟਾਈਲਾਂ ਲਾ ਕੇ ਗ੍ਰਾਊਟ ਭਰਿਆ।"],
      ["Labor — ayos ng tile: tanggal, kabit ulit at grout, kada sq ft", "Tinanggal ang basag o kopong tile, kinayod ang lumang thinset, ikinabit ang katugmang bagong tile at ni-grout."],
    ), { measurementKey: "areaSqFt" }),
    hdMaterial(HD.tile_porcelain_case, t8(
      ["Matching outdoor porcelain tile — per case", "The closest match to the existing tile; about 15.6 sq ft per case."],
      ["Porcelaine extérieure assortie — la boîte", "Carreau le plus proche de l'existant; environ 15,6 pi² par boîte."],
      ["Porcelanato exterior a juego — por caja", "El más parecido al azulejo existente; unos 15.6 pies² por caja."],
      ["Gres da esterno abbinato — a scatola", "La piastrella più simile all'esistente; circa 15,6 piedi quadri a scatola."],
      ["Passendes Feinsteinzeug für außen — pro Karton", "Möglichst gleiche Fliese wie der Bestand; etwa 15,6 sq ft pro Karton."],
      ["Керамограніт у тон для вулиці — за коробку", "Найближчий до наявної плитки; близько 15,6 кв. фута в коробці."],
      ["ਮਿਲਦੀ ਬਾਹਰੀ ਪੋਰਸਿਲੇਨ ਟਾਈਲ — ਪ੍ਰਤੀ ਡੱਬਾ", "ਮੌਜੂਦਾ ਟਾਈਲ ਨਾਲ ਸਭ ਤੋਂ ਮਿਲਦੀ; ਹਰ ਡੱਬੇ ਵਿੱਚ ਲਗਭਗ 15.6 ਵਰਗ ਫੁੱਟ।"],
      ["Katugmang outdoor porcelain tile — kada kahon", "Pinakamalapit sa kasalukuyang tile; mga 15.6 sq ft kada kahon."],
    ), { measurementKey: "areaSqFt", wastePct: 15 }),
    hdMaterial(HD.thinset_50lb, THINSET, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.grout_25lb, GROUT, { measurementKey: "areaSqFt" }),
  ], null, { categories: ["deck_patio", "tiling"] }),

  "fq.deck_patio.repair.wood_floor": T("repair", N("fq.deck_patio.repair.wood_floor"), [
    SHARED.serviceCall(85),
    L.labour(1, "sqft", 9, t8(
      ["Patio decking repair — per sq ft", "Rotted boards and sleepers pulled, framing sistered or replaced, new boards fastened to match."],
      ["Réparation du plancher de patio — au pi²", "Planches et lambourdes pourries retirées, charpente doublée ou remplacée, nouvelles planches fixées à l'identique."],
      ["Reparación del piso de patio — por pie²", "Tablas y durmientes podridos retirados, estructura reforzada o cambiada, tablas nuevas fijadas a juego."],
      ["Riparazione del tavolato del patio — al piede quadro", "Tavole e magatelli marci tolti, struttura raddoppiata o sostituita, nuove tavole fissate in accordo."],
      ["Reparatur des Patio-Belags — pro sq ft", "Morsche Dielen und Lagerhölzer entfernt, Unterbau aufgedoppelt oder ersetzt, neue Dielen passend befestigt."],
      ["Ремонт настилу патіо — за кв. фут", "Гнилі дошки й лежні знято, каркас підсилено або замінено, нові дошки закріплено в тон."],
      ["ਵੇਹੜੇ ਦੀ ਡੈਕਿੰਗ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਸੜੇ ਫੱਟੇ ਅਤੇ ਸਲੀਪਰ ਕੱਢੇ, ਫ਼ਰੇਮਿੰਗ ਨਾਲ ਜੋੜ ਲਾਏ ਜਾਂ ਬਦਲੀ, ਨਵੇਂ ਫੱਟੇ ਮਿਲਾ ਕੇ ਲਾਏ।"],
      ["Labor — ayos ng patio decking, kada sq ft", "Tinanggal ang bulok na tabla at sleeper, dinagdagan o pinalitan ang frame, ikinabit ang katugmang bagong tabla."],
    ), { measurementKey: "areaSqFt" }),
    hdMaterial(HD.deck_board_area, t8(
      ["Replacement pressure-treated patio boards", "5/4 × 6 pressure-treated boards to match, by the board; about 3.7 sq ft each."],
      ["Planches de patio traitées de remplacement", "Planches traitées 5/4 × 6 assorties, à la planche; environ 3,7 pi² chacune."],
      ["Tablas tratadas de reemplazo para patio", "Tablas tratadas de 5/4 × 6 a juego, por tabla; unos 3.7 pies² cada una."],
      ["Tavole impregnate di ricambio per patio", "Tavole impregnate 5/4 × 6 abbinate, a tavola; circa 3,7 piedi quadri ciascuna."],
      ["Druckimprägnierte Ersatzdielen für den Patio", "Passende Dielen 5/4 × 6, druckimprägniert, pro Diele; je etwa 3,7 sq ft."],
      ["Просочені дошки на заміну для патіо", "Просочені дошки 5/4 × 6 у тон, поштучно; близько 3,7 кв. фута кожна."],
      ["ਵੇਹੜੇ ਲਈ ਬਦਲਵੇਂ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਫੱਟੇ", "ਮਿਲਦੇ 5/4 × 6 ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਫੱਟੇ, ਪ੍ਰਤੀ ਫੱਟਾ; ਹਰ ਫੱਟਾ ਲਗਭਗ 3.7 ਵਰਗ ਫੁੱਟ।"],
      ["Pamalit na pressure-treated na tabla ng patio", "Katugmang 5/4 × 6 pressure-treated na tabla, kada piraso; mga 3.7 sq ft bawat isa."],
    ), { measurementKey: "areaSqFt", wastePct: 15 }),
  ], null),

  "fq.deck_patio.repair.composite_deck": T("repair", N("fq.deck_patio.repair.composite_deck"), [
    SHARED.serviceCall(85),
    L.labour(1, "sqft", 10, t8(
      ["Composite decking repair — per sq ft", "Damaged boards released from the hidden clips, joists checked and shimmed, new boards clipped in to match."],
      ["Réparation de platelage composite — au pi²", "Planches abîmées dégagées des attaches invisibles, solives vérifiées et calées, nouvelles planches clipsées à l'identique."],
      ["Reparación de entablado compuesto — por pie²", "Tablas dañadas liberadas de los clips ocultos, viguetas revisadas y calzadas, tablas nuevas colocadas a juego."],
      ["Riparazione del tavolato in composito — al piede quadro", "Tavole danneggiate sganciate dalle clip nascoste, travetti controllati e spessorati, nuove tavole agganciate in accordo."],
      ["WPC-Belag reparieren — pro sq ft", "Beschädigte Dielen aus den verdeckten Clips gelöst, Balken geprüft und unterfüttert, neue Dielen passend eingeclipst."],
      ["Ремонт композитного настилу — за кв. фут", "Пошкоджені дошки знято з прихованих кліпс, лаги перевірено й підкладено, нові дошки в тон встановлено на кліпси."],
      ["ਕੰਪੋਜ਼ਿਟ ਡੈਕਿੰਗ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਖ਼ਰਾਬ ਫੱਟੇ ਲੁਕਵੇਂ ਕਲਿੱਪਾਂ ਤੋਂ ਖੋਲ੍ਹੇ, ਜੋਇਸਟ ਜਾਂਚ ਕੇ ਪੱਧਰੇ ਕੀਤੇ, ਮਿਲਦੇ ਨਵੇਂ ਫੱਟੇ ਕਲਿੱਪ ਕੀਤੇ।"],
      ["Labor — ayos ng composite decking, kada sq ft", "Tinanggal sa hidden clip ang sirang tabla, chineck at sinapinan ang joist, kinabit ang katugmang bagong tabla."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "sqft", 14, t8(
      ["Replacement composite boards and clips — per sq ft", "Capped composite boards in the closest colour still sold, with hidden clips."],
      ["Planches composites et attaches de remplacement — au pi²", "Planches composites à coque dans la couleur la plus proche encore offerte, avec attaches invisibles."],
      ["Tablas compuestas y clips de reemplazo — por pie²", "Tablas compuestas con cubierta en el color disponible más parecido, con clips ocultos."],
      ["Tavole in composito e clip di ricambio — al piede quadro", "Tavole in composito rivestito nel colore disponibile più vicino, con clip nascoste."],
      ["Ersatz-WPC-Dielen und Clips — pro sq ft", "Ummantelte Verbunddielen im nächstliegenden lieferbaren Farbton, mit verdeckten Clips."],
      ["Композитні дошки й кліпси на заміну — за кв. фут", "Композитні дошки з оболонкою найближчого доступного кольору, з прихованими кліпсами."],
      ["ਬਦਲਵੇਂ ਕੰਪੋਜ਼ਿਟ ਫੱਟੇ ਅਤੇ ਕਲਿੱਪ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਮਿਲਦੇ ਰੰਗ ਵਾਲੇ ਕੈਪਡ ਕੰਪੋਜ਼ਿਟ ਫੱਟੇ, ਲੁਕਵੇਂ ਕਲਿੱਪਾਂ ਸਮੇਤ।"],
      ["Pamalit na composite board at clip — kada sq ft", "Capped na composite board sa pinakamalapit na available na kulay, may hidden clip."],
    ), { measurementKey: "areaSqFt", wastePct: 10 }),
  ], null),

  "fq.deck_patio.repair.wood_railing": T("repair", N("fq.deck_patio.repair.wood_railing"), [
    SHARED.serviceCall(85),
    L.labour(1, "linear_ft", 22, t8(
      ["Wood railing repair — per linear ft", "Loose sections re-fastened, broken rails and balusters replaced, cap straightened."],
      ["Réparation de garde-corps en bois — au pi lin.", "Sections lâches refixées, lisses et barreaux brisés remplacés, main courante redressée."],
      ["Reparación de barandal de madera — por pie lineal", "Tramos flojos refijados, largueros y balaústres rotos reemplazados, pasamanos enderezado."],
      ["Riparazione ringhiera in legno — al piede lineare", "Sezioni allentate rifissate, correnti e balaustri rotti sostituiti, corrimano raddrizzato."],
      ["Holzgeländer reparieren — pro lfd. Fuß", "Lose Felder neu befestigt, gebrochene Gurte und Stäbe ersetzt, Handlauf ausgerichtet."],
      ["Ремонт дерев'яних поручнів — за пог. фут", "Хиткі секції закріплено, зламані перекладини й балясини замінено, поручень вирівняно."],
      ["ਲੱਕੜ ਦੀ ਰੇਲਿੰਗ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਢਿੱਲੇ ਹਿੱਸੇ ਮੁੜ ਕੱਸੇ, ਟੁੱਟੀਆਂ ਰੇਲਾਂ ਅਤੇ ਬਲਸਟਰ ਬਦਲੇ, ਕੈਪ ਸਿੱਧੀ ਕੀਤੀ।"],
      ["Labor — ayos ng wood railing, kada linear ft", "Hinigpitan ang maluwag na parte, pinalitan ang sirang rail at balusters, inayos ang cap."],
    ), { measurementKey: "linearFt" }),
    L.material(1, "linear_ft", 8, t8(
      ["Railing repair lumber — per linear ft", "Pressure-treated rail, baluster and cap stock with coated screws."],
      ["Bois de réparation de garde-corps — au pi lin.", "Lisses, barreaux et main courante en bois traité avec vis enduites."],
      ["Madera para reparar barandal — por pie lineal", "Largueros, balaústres y tapa de madera tratada con tornillos recubiertos."],
      ["Legname per riparare la ringhiera — al piede lineare", "Correnti, balaustri e corrimano impregnati con viti rivestite."],
      ["Holz für die Geländerreparatur — pro lfd. Fuß", "Druckimprägnierte Gurte, Stäbe und Handlauf mit beschichteten Schrauben."],
      ["Деревина для ремонту поручнів — за пог. фут", "Просочені перекладини, балясини й поручень із покритими шурупами."],
      ["ਰੇਲਿੰਗ ਮੁਰੰਮਤ ਲਈ ਲੱਕੜ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਕੋਟੇਡ ਪੇਚਾਂ ਸਮੇਤ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਰੇਲ, ਬਲਸਟਰ ਅਤੇ ਕੈਪ ਦੀ ਲੱਕੜ।"],
      ["Kahoy pang-ayos ng railing — kada linear ft", "Pressure-treated na rail, balusters at cap na may coated screw."],
    ), { measurementKey: "linearFt" }),
    L.labour(1, "each", 65, t8(
      ["Railing post re-anchor — per post", "A wobbly post through-bolted to the rim with structural hardware and blocking."],
      ["Réancrage de poteau de garde-corps — le poteau", "Poteau branlant boulonné à la solive de rive avec quincaillerie structurale et blocage."],
      ["Reanclaje de poste de barandal — por poste", "Poste flojo atornillado a la viga perimetral con herraje estructural y bloqueo."],
      ["Riancoraggio montante — per montante", "Montante traballante imbullonato alla trave di bordo con ferramenta strutturale e rinforzi."],
      ["Geländerpfosten neu verankern — pro Pfosten", "Wackliger Pfosten mit Konstruktionsbeschlägen und Füllholz durch den Randbalken verschraubt."],
      ["Повторне кріплення стовпа — за стовп", "Хиткий стовп наскрізь прикручено до обв'язувальної балки з конструкційним кріпленням і розпірками."],
      ["ਰੇਲਿੰਗ ਪੋਸਟ ਮੁੜ ਪੱਕੀ ਕਰਨੀ — ਪ੍ਰਤੀ ਪੋਸਟ", "ਹਿੱਲਦੀ ਪੋਸਟ ਢਾਂਚਾਗਤ ਹਾਰਡਵੇਅਰ ਅਤੇ ਬਲੌਕਿੰਗ ਨਾਲ ਰਿਮ ਵਿੱਚੋਂ ਬੋਲਟ ਕੀਤੀ।"],
      ["Labor — pag-angkla ulit ng poste ng railing, kada poste", "Binolt sa rim ang umuugang poste gamit ang structural hardware at blocking."],
    ), { measurementKey: "each" }),
  ], null),

  "fq.deck_patio.repair.composite_railing": T("repair", N("fq.deck_patio.repair.composite_railing"), [
    SHARED.serviceCall(85),
    L.labour(1, "linear_ft", 24, t8(
      ["Composite railing repair — per linear ft", "Damaged rail sections and balusters swapped, brackets re-fastened, sleeves and caps reseated."],
      ["Réparation de garde-corps composite — au pi lin.", "Sections et barreaux abîmés remplacés, supports refixés, manchons et capuchons remis en place."],
      ["Reparación de barandal compuesto — por pie lineal", "Tramos y balaústres dañados cambiados, soportes refijados, fundas y tapas reasentadas."],
      ["Riparazione ringhiera in composito — al piede lineare", "Sezioni e balaustri danneggiati sostituiti, staffe rifissate, coprimontanti e cappucci rimessi."],
      ["WPC-Geländer reparieren — pro lfd. Fuß", "Beschädigte Felder und Stäbe getauscht, Halter neu befestigt, Hülsen und Kappen neu gesetzt."],
      ["Ремонт композитних поручнів — за пог. фут", "Пошкоджені секції й балясини замінено, кронштейни закріплено, кожухи й ковпачки посаджено на місце."],
      ["ਕੰਪੋਜ਼ਿਟ ਰੇਲਿੰਗ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਖ਼ਰਾਬ ਰੇਲ ਹਿੱਸੇ ਅਤੇ ਬਲਸਟਰ ਬਦਲੇ, ਬਰੈਕਟ ਮੁੜ ਕੱਸੇ, ਸਲੀਵ ਅਤੇ ਕੈਪ ਮੁੜ ਬਿਠਾਏ।"],
      ["Labor — ayos ng composite railing, kada linear ft", "Pinalitan ang sirang rail at balusters, hinigpitan ang bracket, ibinalik ang sleeve at cap."],
    ), { measurementKey: "linearFt" }),
    L.material(1, "linear_ft", 22, t8(
      ["Composite railing parts — per linear ft", "Replacement rails, balusters and brackets from the manufacturer's line."],
      ["Pièces de garde-corps composite — au pi lin.", "Lisses, barreaux et supports de remplacement de la gamme du fabricant."],
      ["Piezas de barandal compuesto — por pie lineal", "Largueros, balaústres y soportes de reemplazo de la línea del fabricante."],
      ["Ricambi per ringhiera in composito — al piede lineare", "Correnti, balaustri e staffe di ricambio della linea del produttore."],
      ["WPC-Geländerteile — pro lfd. Fuß", "Ersatzgurte, -stäbe und -halter aus der Herstellerserie."],
      ["Деталі композитних поручнів — за пог. фут", "Перекладини, балясини й кронштейни на заміну з лінійки виробника."],
      ["ਕੰਪੋਜ਼ਿਟ ਰੇਲਿੰਗ ਦੇ ਪੁਰਜ਼ੇ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਨਿਰਮਾਤਾ ਦੀ ਲੜੀ ਦੀਆਂ ਬਦਲਵੀਆਂ ਰੇਲਾਂ, ਬਲਸਟਰ ਅਤੇ ਬਰੈਕਟ।"],
      ["Piyesa ng composite railing — kada linear ft", "Pamalit na rail, balusters at bracket mula sa linya ng manufacturer."],
    ), { measurementKey: "linearFt" }),
    L.labour(1, "each", 85, t8(
      ["Composite post sleeve reset — per post", "Sleeve lifted, the post inside re-blocked and bolted, sleeve and skirt reset plumb."],
      ["Remise en place de manchon de poteau composite — le poteau", "Manchon soulevé, poteau intérieur rebloqué et boulonné, manchon et jupe remis d'aplomb."],
      ["Reajuste de funda de poste compuesto — por poste", "Funda levantada, poste interior rebloqueado y atornillado, funda y faldón reasentados a plomo."],
      ["Risistemazione coprimontante in composito — per montante", "Coprimontante sollevato, montante interno rinforzato e imbullonato, coprimontante e base rimessi a piombo."],
      ["WPC-Pfostenhülse neu setzen — pro Pfosten", "Hülse abgenommen, Pfosten darin neu verblockt und verschraubt, Hülse und Sockel lotrecht gesetzt."],
      ["Переустановлення кожуха стовпа — за стовп", "Кожух знято, стовп усередині підсилено й прикручено, кожух і накладку встановлено по виску."],
      ["ਕੰਪੋਜ਼ਿਟ ਪੋਸਟ ਸਲੀਵ ਮੁੜ ਬਿਠਾਉਣੀ — ਪ੍ਰਤੀ ਪੋਸਟ", "ਸਲੀਵ ਚੁੱਕੀ, ਅੰਦਰਲੀ ਪੋਸਟ ਮੁੜ ਬਲੌਕ ਕਰਕੇ ਬੋਲਟ ਕੀਤੀ, ਸਲੀਵ ਅਤੇ ਸਕਰਟ ਸਿੱਧੇ ਬਿਠਾਏ।"],
      ["Labor — pag-reset ng composite post sleeve, kada poste", "Inangat ang sleeve, pinatibay at binolt ang poste sa loob, ibinalik nang tuwid ang sleeve at skirt."],
    ), { measurementKey: "each" }),
  ], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);
tagRows(SEED, { "fq.deck_patio.maintenance.patio_sealing": ["driveway_sealing"] });
