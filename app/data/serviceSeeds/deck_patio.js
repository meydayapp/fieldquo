// app/data/serviceSeeds/deck_patio.js
//
// The service list a deck and patio company starts from. Read ./index.js for
// the format and the rules. The benchmark's deck and patio book — install
// and repair of decks, railings and patio surfaces, plus upkeep — with no
// pricing insight, in source order. Deck staining and deck sealing are not
// repeated here: they are canonical rows in exterior_painting.js and
// flooring_install.js tagged for this trade. Deck and patio areas are the
// typed `areaSqFt`, paver patios the traced `areaSqft`.
import { L, SHARED, D, T, withTemplates, hdMaterial, tagRows } from "./_templateLines";
import { HD } from "./_materialCosts";
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
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const t7 = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });

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
};

withTemplates(SEED, TEMPLATES);
tagRows(SEED, { "fq.deck_patio.maintenance.patio_sealing": ["driveway_sealing"] });
