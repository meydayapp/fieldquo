// app/data/serviceSeeds/tree_care_service.js
//
// The service list a tree-care company starts from. Read the header of
// ./index.js for the format and the rules every file in this folder follows.
//
// The source split every row into "Removal" and "Treatment" and then by what
// is being removed or treated; here that is flattened to what the homeowner
// points at — a shrub, a stump, a tree — with removal and care as separate
// categories, so the "one" / "two or more" rows sit beside each other.
//
// No benchmark exists for any of these: the capture carried no pricing
// insight for the trade. Every `benchmark` is null on purpose.

import { L, SHARED, D, T, withTemplates } from "./_templateLines";

export const SEED = {
  trade: "tree_care_service",
  categories: [
    {
      key: "shrub_removal",
      name: { en: "Bush and shrub removal", fr: "Arrachage d'arbustes", es: "Retiro de arbustos" },
    },
    {
      key: "stump_removal",
      name: { en: "Stump removal", fr: "Essouchement", es: "Retiro de tocones" },
    },
    {
      key: "tree_removal",
      name: { en: "Tree removal", fr: "Abattage d'arbres", es: "Remoción de árboles" },
    },
    {
      key: "shrub_care",
      name: { en: "Bush and shrub care", fr: "Entretien des arbustes", es: "Cuidado de arbustos" },
    },
    {
      key: "tree_care",
      name: { en: "Tree care", fr: "Entretien des arbres", es: "Cuidado de árboles" },
    },
  ],
  services: [
    {
      seedKey: "fq.tree_care_service.shrub_removal.one_shrub",
      category: "shrub_removal",
      name: {
        en: "Bush or shrub removal — one",
        fr: "Arrachage d'un arbuste",
        es: "Retiro de un arbusto",
      },
      description: {
        en: "One bush or shrub cut down, its root ball dug out and the hole backfilled, with the debris hauled away.",
        fr: "Un arbuste coupé, sa motte de racines déterrée, le trou remblayé, les débris emportés.",
        es: "Un arbusto cortado, su cepellón desenterrado, el hueco rellenado, los restos retirados del lugar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.shrub_removal.two_plus_shrubs",
      category: "shrub_removal",
      name: {
        en: "Bush or shrub removal — two or more",
        fr: "Arrachage de deux arbustes ou plus",
        es: "Retiro de dos o más arbustos",
      },
      description: {
        en: "Several bushes or shrubs taken out in one visit — cut, roots dug, holes backfilled, everything hauled away.",
        fr: "Plusieurs arbustes enlevés en une visite — coupés, racines déterrées, trous remblayés, tout emporté.",
        es: "Varios arbustos retirados en una sola visita: cortados, raíces desenterradas, huecos rellenados, todo acarreado fuera.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.stump_removal.one_stump",
      category: "stump_removal",
      name: {
        en: "Stump removal — one stump",
        fr: "Essouchement — une souche",
        es: "Retiro de tocón — uno",
      },
      description: {
        en: "One stump ground below grade or pulled out, the grindings raked level and the spot ready for soil or sod.",
        fr: "Une souche déchiquetée sous le niveau du sol ou arrachée, les copeaux nivelés, l'endroit prêt pour de la terre ou de la tourbe.",
        es: "Un tocón triturado por debajo del nivel del suelo o arrancado, las virutas niveladas, el sitio listo para tierra o césped.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.stump_removal.two_plus_stumps",
      category: "stump_removal",
      name: {
        en: "Stump removal — two or more stumps",
        fr: "Essouchement — deux souches ou plus",
        es: "Retiro de tocones — dos o más",
      },
      description: {
        en: "Several stumps ground or pulled in the same visit, each spot raked level and left ready for planting.",
        fr: "Plusieurs souches déchiquetées ou arrachées lors de la même visite, chaque endroit nivelé, prêt à replanter.",
        es: "Varios tocones triturados o arrancados en la misma visita, cada sitio nivelado, listo para plantar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.tree_removal.emergency",
      category: "tree_removal",
      name: {
        en: "Emergency tree removal",
        fr: "Abattage d'urgence",
        es: "Remoción de árbol de emergencia",
      },
      description: {
        en: "A fallen, split or leaning tree made safe and removed on short notice — off the roof, the driveway or the power line — before it does more damage.",
        fr: "Arbre tombé, fendu ou penché sécurisé puis enlevé à court préavis — du toit, de l'entrée ou de la ligne électrique — avant qu'il ne cause d'autres dégâts.",
        es: "Árbol caído, partido o inclinado asegurado y retirado con poco aviso, ya sea del techo, la entrada o el tendido eléctrico, antes de que cause más daños.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.tree_removal.sick_tree",
      category: "tree_removal",
      name: {
        en: "Sick or dying tree removal",
        fr: "Abattage d'un arbre malade",
        es: "Remoción de árbol enfermo",
      },
      description: {
        en: "A diseased or dying tree taken down in sections, its wood chipped or hauled off, before rot or infestation spreads to the healthy ones.",
        fr: "Arbre malade ou mourant abattu par sections, bois déchiqueté ou emporté, avant que la pourriture ou l'infestation ne gagne les arbres sains.",
        es: "Árbol enfermo o moribundo derribado por secciones, madera astillada o acarreada, antes de que la pudrición o la plaga pase a los árboles sanos.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.tree_removal.one_tree",
      category: "tree_removal",
      name: {
        en: "Tree removal — one tree",
        fr: "Abattage d'un arbre",
        es: "Remoción de un árbol",
      },
      description: {
        en: "One tree felled or dismantled from the top down, the trunk cut to length and the brush chipped, with the site raked clean.",
        fr: "Un arbre abattu ou démonté du haut vers le bas, tronc coupé en longueurs, branches déchiquetées, terrain ratissé.",
        es: "Un árbol derribado o desmontado desde la copa, tronco cortado en tramos, ramas astilladas, sitio rastrillado.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.tree_removal.two_trees",
      category: "tree_removal",
      name: {
        en: "Tree removal — two trees",
        fr: "Abattage de deux arbres",
        es: "Remoción de dos árboles",
      },
      description: {
        en: "Two trees felled or dismantled in the same visit, trunks bucked, brush chipped and the site left tidy.",
        fr: "Deux arbres abattus ou démontés lors de la même visite, troncs tronçonnés, branches déchiquetées, terrain laissé propre.",
        es: "Dos árboles derribados o desmontados en la misma visita, troncos troceados, ramas astilladas, sitio ordenado al terminar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      // The source's "Something else / I don't know" removal row, kept as the
      // honest catch-all a booking form needs.
      seedKey: "fq.tree_care_service.tree_removal.other",
      category: "tree_removal",
      name: {
        en: "Other removal work — describe what you need",
        fr: "Autre travail d'abattage — décrivez le besoin",
        es: "Otro trabajo de remoción — describa lo que necesita",
      },
      description: {
        en: "A removal not listed above: tell us what has to come out and we will price it on site.",
        fr: "Un enlèvement qui n'apparaît pas ci-dessus : dites-nous ce qui doit partir, le prix sera fixé sur place.",
        es: "Una remoción que no figura arriba: cuéntenos qué hay que quitar, se cotiza en el sitio.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.shrub_care.trimming",
      category: "shrub_care",
      name: {
        en: "Bush and shrub trimming",
        fr: "Taille d'arbustes",
        es: "Recorte de arbustos",
      },
      description: {
        en: "Hedges and shrubs sheared to shape and size, overgrowth cut back from walls and windows, clippings cleaned up.",
        fr: "Haies et arbustes taillés à la forme et à la taille voulues, pousses excédentaires dégagées des murs et fenêtres, rognures ramassées.",
        es: "Setos y arbustos recortados a la forma y tamaño deseados, crecimiento excesivo despejado de muros y ventanas, restos recogidos.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.shrub_care.pruning",
      category: "shrub_care",
      name: {
        en: "Bush and shrub pruning",
        fr: "Élagage d'arbustes",
        es: "Poda de arbustos",
      },
      description: {
        en: "Selective cuts to remove dead, crossing or diseased stems and open up the plant so it flowers and grows well next season.",
        fr: "Coupes sélectives pour retirer les tiges mortes, croisées ou malades et aérer la plante afin qu'elle fleurisse et pousse bien la saison prochaine.",
        es: "Cortes selectivos para quitar tallos muertos, cruzados o enfermos y abrir la planta, de modo que florezca y crezca bien la próxima temporada.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.tree_care.trimming",
      category: "tree_care",
      name: {
        en: "Tree trimming",
        fr: "Taille d'arbres",
        es: "Recorte de árboles",
      },
      description: {
        en: "Branches cut back from the roof, the wires and the neighbour's side, low limbs raised, and the canopy thinned for light and clearance.",
        fr: "Branches dégagées du toit, des fils et du côté voisin, branches basses relevées, couronne éclaircie pour la lumière et le dégagement.",
        es: "Ramas despejadas del techo, los cables y el lado del vecino, ramas bajas elevadas, copa aclarada para dar luz y espacio.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.tree_care.pruning",
      category: "tree_care",
      name: {
        en: "Tree pruning",
        fr: "Élagage d'arbres",
        es: "Poda de árboles",
      },
      description: {
        en: "Structural cuts made for the tree's health — deadwood, weak crotches and rubbing limbs removed — so it grows strong and stays safe in wind.",
        fr: "Coupes structurales pour la santé de l'arbre — bois mort, fourches faibles et branches qui frottent retirés — pour qu'il pousse solide et résiste au vent.",
        es: "Cortes estructurales por la salud del árbol: madera muerta, horquillas débiles y ramas que rozan retiradas, para que crezca fuerte y aguante el viento.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      // The source's "Something else / I don't know" treatment row, kept as
      // the honest catch-all a booking form needs.
      seedKey: "fq.tree_care_service.tree_care.other",
      category: "tree_care",
      name: {
        en: "Other tree care work — describe what you need",
        fr: "Autre travail d'entretien d'arbres — décrivez le besoin",
        es: "Otro trabajo de cuidado de árboles — describa lo que necesita",
      },
      description: {
        en: "Tree or shrub care not listed above: tell us what is going on and we will price it on site.",
        fr: "Un soin d'arbre ou d'arbuste qui n'apparaît pas ci-dessus : dites-nous ce qui se passe, le prix sera fixé sur place.",
        es: "Un cuidado de árbol o arbusto que no figura arriba: cuéntenos qué ocurre, se cotiza en el sitio.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    {
      seedKey: "fq.tree_care_service.tree_care.planting",
      category: "tree_care",
      name: { en: "Tree planting", fr: "Plantation d'arbres", es: "Plantación de árboles" },
      description: {
        en: "A nursery tree set at the right depth, backfilled, staked where needed, mulched and watered in.",
        fr: "Arbre de pépinière planté à la bonne profondeur, remblayé, tuteuré au besoin, paillé et arrosé.",
        es: "Árbol de vivero plantado a la profundidad correcta, rellenado, tutorado si hace falta, con mantillo y regado.",
      },
      unit: "each",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.tree_care_service.tree_care.arborist_assessment",
      category: "tree_care",
      name: { en: "Arborist tree assessment", fr: "Évaluation d'arbre par un arboriste", es: "Evaluación de árbol por arborista" },
      description: {
        en: "A tree's health, structure and risk to the house assessed, with a written recommendation to prune, treat, cable or remove.",
        fr: "Santé, structure et risque d'un arbre pour la maison évalués, avec recommandation écrite d'élaguer, traiter, haubaner ou abattre.",
        es: "Salud, estructura y riesgo de un árbol para la casa evaluados, con recomendación escrita de podar, tratar, cablear o retirar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: 45,
      bookable: true,
    },
    {
      seedKey: "fq.tree_care_service.tree_care.storm_inspection",
      category: "tree_care",
      name: { en: "Storm damage tree inspection", fr: "Inspection des arbres après une tempête", es: "Inspección de árboles tras tormenta" },
      description: {
        en: "Trees checked after a storm for split limbs, hangers and lean, with what must come down first marked.",
        fr: "Arbres vérifiés après une tempête pour branches fendues, branches suspendues et inclinaison, en marquant ce qui doit tomber d'abord.",
        es: "Árboles revisados tras una tormenta por ramas partidas, colgantes e inclinación, marcando lo que debe caer primero.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the benchmark has no insight for tree work, so these are 2026
// residential figures: a two-person climbing crew $150–175 an hour, a
// medium tree removed $650–1,200, a stump ground $150–250 plus $3–5 an inch
// of diameter above the first, shrub trimming $55–70 a crew hour, a planted
// 2-in-caliper tree $250–350 installed. Trees and stumps are counted with
// `each`; everything else is crew time.
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const t7 = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });
const CREW = (hours, price = 165) => L.labour(hours, "hour", price, t7(
  ["Climbing crew — per hour", "Arborist and ground person with saws, rigging and chipper."],
  ["Équipe d'élagage — à l'heure", "Arboriste et aide au sol avec scies, gréement et déchiqueteuse."],
  ["Cuadrilla de poda — por hora", "Arborista y ayudante con motosierras, aparejos y trituradora."],
  ["Squadra di potatura — a ore", "Arboricoltore e aiutante a terra con motoseghe, carrucole e cippatrice."],
  ["Kletterteam — pro Stunde", "Baumpfleger und Bodenhelfer mit Sägen, Seiltechnik und Häcksler."],
  ["Бригада арбористів — за годину", "Арборист і помічник з пилами, такелажем і подрібнювачем."],
  ["Climbing crew — kada oras", "Arborist at katulong sa lupa na may lagari, rigging at chipper."],
));
const CHIP = (price = 95) => L.labour(1, "flat", price, t7(
  ["Chipping and cleanup", "Brush chipped and hauled, logs cut to length, the site raked."],
  ["Déchiquetage et nettoyage", "Branches déchiquetées et évacuées, billes coupées, terrain râtelé."],
  ["Triturado y limpieza", "Ramas trituradas y retiradas, troncos cortados, terreno rastrillado."],
  ["Cippatura e pulizia", "Ramaglie cippate e portate via, tronchi tagliati, area rastrellata."],
  ["Häckseln und Aufräumen", "Astwerk gehäckselt und abgefahren, Stämme abgelängt, Fläche gerecht."],
  ["Подрібнення й прибирання", "Гілля подрібнено й вивезено, колоди порізано, ділянку згребено."],
  ["Chipping at paglilinis", "Dinurog at hinakot ang sanga, pinutol ang troso at kinalaykay ang lugar."],
));

const TEMPLATES = {
  // ── Installation ──
  "fq.tree_care_service.tree_care.planting": T("installation", n(
    ["Messa a dimora di alberi", "Albero da vivaio piantato alla giusta profondità, rinterrato, tutorato se serve, pacciamato e irrigato."],
    ["Baumpflanzung", "Baumschulbaum in richtiger Tiefe gepflanzt, verfüllt, bei Bedarf angepfählt, gemulcht und angegossen."],
    ["Висадка дерев", "Саджанець висаджено на правильну глибину, засипано, підв'язано за потреби, замульчовано й полито."],
    ["Pagtatanim ng puno", "Itinanim sa tamang lalim, tinabunan, nilagyan ng tukod kung kailangan, mulch at dinilig."],
  ), [
    L.labour(1, "each", 125, t7(
      ["Tree planting — per tree", "Hole dug twice the root ball, tree set and backfilled, staked and mulched."],
      ["Plantation — l'arbre", "Trou deux fois la motte, arbre posé et remblayé, tuteuré et paillé."],
      ["Plantación — por árbol", "Hoyo del doble del cepellón, árbol colocado y rellenado, tutorado y con mantillo."],
      ["Messa a dimora — per albero", "Buca doppia della zolla, albero posato e rinterrato, tutorato e pacciamato."],
      ["Pflanzung — pro Baum", "Pflanzloch doppelt so groß wie der Ballen, Baum gesetzt, verfüllt, angepfählt und gemulcht."],
      ["Висадка — за дерево", "Яму вдвічі більшу за ком викопано, дерево встановлено, засипано, підв'язано й замульчовано."],
      ["Pagtatanim — kada puno", "Hinukay nang doble sa root ball, inilagay at tinabunan, tinukuran at nilagyan ng mulch."],
    ), { measurementKey: "each" }),
    L.material(1, "each", 175, t7(
      ["Nursery tree — 2 in caliper", "Balled-and-burlapped shade or ornamental tree, 2 in caliper."],
      ["Arbre de pépinière — calibre 2 po", "Arbre d'ombrage ou d'ornement en motte, calibre de 2 po."],
      ["Árbol de vivero — calibre 2 pulg", "Árbol de sombra u ornamental con cepellón, calibre de 2 pulg."],
      ["Albero da vivaio — calibro 2 pollici", "Albero da ombra o ornamentale in zolla, calibro 2 pollici."],
      ["Baumschulware — 2 Zoll Stammumfang", "Schatten- oder Zierbaum mit Ballen, 2 Zoll Stammdurchmesser."],
      ["Саджанець — діаметр 2 дюйми", "Тіньове чи декоративне дерево з комом, діаметр стовбура 2 дюйми."],
      ["Nursery tree — 2 in caliper", "Balled-and-burlapped na shade o ornamental na puno, 2 in caliper."],
    ), { measurementKey: "each" }),
  ], null),

  "fq.tree_care_service.tree_removal.one_tree": T("installation", n(
    ["Abbattimento — un albero", "Un albero abbattuto o smontato dall'alto, tronco tagliato a misura e ramaglie cippate, area rastrellata."],
    ["Baumfällung — ein Baum", "Ein Baum gefällt oder von oben abgetragen, Stamm abgelängt, Astwerk gehäckselt, Fläche gerecht."],
    ["Видалення дерева — одне дерево", "Одне дерево зрізано або розібрано згори, стовбур порізано, гілля подрібнено, ділянку згребено."],
    ["Pagputol ng puno — isang puno", "Isang puno na pinutol o binaklas mula taas, pinutol ang troso at dinurog ang sanga, kinalaykay."],
  ), [CREW(5), CHIP(), SHARED.disposalFee(60)], null),

  "fq.tree_care_service.shrub_removal.one_shrub": T("installation", n(
    ["Rimozione di un arbusto", "Un arbusto tagliato, zolla estirpata, buca rinterrata e residui portati via."],
    ["Strauch entfernen — einer", "Ein Strauch geschnitten, Wurzelballen ausgegraben, Loch verfüllt und Reste abgefahren."],
    ["Видалення одного куща", "Кущ зрізано, кореневу систему викопано, яму засипано, залишки вивезено."],
    ["Pagtanggal ng isang halaman", "Pinutol, hinukay ang ugat, tinabunan ang butas at hinakot ang tira."],
  ), [L.labour(1, "each", 120, t7(
    ["Shrub removal — per shrub", "Cut down, root ball dug out and the hole backfilled."],
    ["Arrachage d'arbuste — l'arbuste", "Coupé, motte déterrée et trou remblayé."],
    ["Retiro de arbusto — por arbusto", "Cortado, cepellón desenterrado y hoyo rellenado."],
    ["Rimozione arbusto — per arbusto", "Tagliato, zolla estirpata e buca rinterrata."],
    ["Strauchentfernung — pro Strauch", "Abgeschnitten, Wurzelballen ausgegraben und Loch verfüllt."],
    ["Видалення куща — за кущ", "Зрізано, корінь викопано, яму засипано."],
    ["Pagtanggal — kada halaman", "Pinutol, hinukay ang ugat at tinabunan ang butas."],
  ), { measurementKey: "each" })], null),

  // ── Repair ──
  "fq.tree_care_service.tree_removal.emergency": T("repair", n(
    ["Abbattimento d'emergenza", "Albero caduto, spaccato o inclinato messo in sicurezza e rimosso con urgenza, dal tetto, dal vialetto o dalla linea elettrica."],
    ["Notfall-Baumfällung", "Umgestürzter, gespaltener oder schiefer Baum kurzfristig gesichert und entfernt — vom Dach, der Einfahrt oder der Leitung."],
    ["Аварійне видалення дерева", "Упале, розколоте чи нахилене дерево терміново знешкоджено й прибрано з даху, під'їзду чи лінії."],
    ["Emergency na pagputol ng puno", "Bumagsak, biyak o nakahilig na puno na ginawang ligtas at tinanggal agad sa bubong, driveway o linya."],
  ), [
    L.labour(1, "flat", 250, t7(
      ["Emergency call-out", "Crew dispatched after hours or in storm conditions."],
      ["Intervention d'urgence", "Équipe dépêchée hors des heures ou en pleine tempête."],
      ["Salida de emergencia", "Cuadrilla enviada fuera de horario o durante la tormenta."],
      ["Uscita d'emergenza", "Squadra inviata fuori orario o durante la tempesta."],
      ["Notfalleinsatz", "Team außerhalb der Zeiten oder bei Sturm ausgerückt."],
      ["Аварійний виїзд", "Бригаду направлено в неробочий час або під час бурі."],
      ["Emergency call-out", "Ipinadala ang crew sa labas ng oras o habang may bagyo."],
    )),
    CREW(4, 195), CHIP(125),
  ], null),

  "fq.tree_care_service.tree_removal.sick_tree": T("repair", n(
    ["Abbattimento albero malato o morente", "Albero malato o morto abbattuto in sicurezza prima che ceda, con legno e ramaglie portati via."],
    ["Fällung eines kranken oder absterbenden Baums", "Kranker oder abgestorbener Baum sicher gefällt, bevor er bricht, Holz und Astwerk abgefahren."],
    ["Видалення хворого чи сухого дерева", "Хворе чи сухе дерево безпечно видалено до того, як воно впаде, деревину й гілля вивезено."],
    ["Pagputol ng may sakit o namamatay na puno", "Ligtas na pinutol bago bumagsak ang may sakit o patay na puno, hinakot ang kahoy at sanga."],
  ), [CREW(4), CHIP(), SHARED.disposalFee(60)], null),

  "fq.tree_care_service.stump_removal.one_stump": T("repair", n(
    ["Rimozione ceppaia — una", "Una ceppaia fresata sotto il livello del terreno, trucioli livellati e area pronta per terra o prato."],
    ["Stubbenentfernung — einer", "Ein Stubben unter Geländeniveau gefräst, Späne eingeebnet, Fläche bereit für Erde oder Rasen."],
    ["Видалення пня — один", "Пень подрібнено нижче рівня ґрунту, тріску розрівняно, місце готове під ґрунт чи газон."],
    ["Pagtanggal ng tuod — isa", "Ginrind ang tuod sa ilalim ng lupa, pinatag ang pinagkayasan at handa na para sa lupa o damo."],
  ), [
    L.labour(1, "each", 175, t7(
      ["Stump grinding — per stump", "Stump ground 6–8 in below grade, surface roots chased."],
      ["Essouchement — la souche", "Souche broyée de 6 à 8 po sous le niveau, racines de surface suivies."],
      ["Molido de tocón — por tocón", "Tocón molido de 6 a 8 pulg bajo el nivel, raíces superficiales seguidas."],
      ["Fresatura ceppaia — per ceppaia", "Ceppaia fresata 6–8 pollici sotto il livello, radici superficiali seguite."],
      ["Stubbenfräsen — pro Stubben", "Stubben 6–8 Zoll unter Niveau gefräst, Oberflächenwurzeln verfolgt."],
      ["Подрібнення пня — за пень", "Пень подрібнено на 6–8 дюймів нижче рівня, поверхневі корені прибрано."],
      ["Stump grinding — kada tuod", "Ginrind ang tuod 6–8 in sa ilalim ng lupa at sinundan ang ugat sa ibabaw."],
    ), { measurementKey: "each" }),
    L.labour(1, "flat", 45, t7(
      ["Grindings cleanup", "Chips raked out and the hole topped with soil."],
      ["Nettoyage des copeaux", "Copeaux râtelés et trou comblé de terre."],
      ["Limpieza de viruta", "Viruta rastrillada y hoyo cubierto con tierra."],
      ["Pulizia trucioli", "Trucioli rastrellati e buca colmata di terra."],
      ["Späne aufräumen", "Späne ausgerecht und Loch mit Erde aufgefüllt."],
      ["Прибирання тріски", "Тріску згребено, яму засипано землею."],
      ["Paglilinis ng pinagkayasan", "Kinalaykay ang chips at tinabunan ng lupa ang butas."],
    )),
  ], null),

  "fq.tree_care_service.stump_removal.two_plus_stumps": T("repair", n(
    ["Rimozione ceppaie — due o più", "Più ceppaie fresate sotto il livello del terreno nella stessa visita, trucioli livellati."],
    ["Stubbenentfernung — zwei oder mehr", "Mehrere Stubben im selben Einsatz unter Niveau gefräst, Späne eingeebnet."],
    ["Видалення пнів — два й більше", "Кілька пнів подрібнено нижче рівня ґрунту за один візит, тріску розрівняно."],
    ["Pagtanggal ng tuod — dalawa o higit", "Ginrind ang ilang tuod sa isang visit at pinatag ang pinagkayasan."],
  ), [L.labour(1, "each", 125, t7(
    ["Stump grinding — per additional stump", "Each stump after the first, ground below grade."],
    ["Essouchement — par souche supplémentaire", "Chaque souche après la première, broyée sous le niveau."],
    ["Molido — por tocón adicional", "Cada tocón después del primero, molido bajo el nivel."],
    ["Fresatura — per ceppaia aggiuntiva", "Ogni ceppaia dopo la prima, fresata sotto il livello."],
    ["Stubbenfräsen — pro weiterem Stubben", "Jeder weitere Stubben unter Niveau gefräst."],
    ["Подрібнення — за кожен наступний пень", "Кожен пень після першого подрібнено нижче рівня."],
    ["Stump grinding — kada dagdag na tuod", "Bawat tuod pagkatapos ng una, ginrind sa ilalim ng lupa."],
  ), { measurementKey: "each" }), L.labour(1, "flat", 175, t7(
    ["First stump and set-up", "Grinder delivered and the first stump ground."],
    ["Première souche et installation", "Broyeuse livrée et première souche broyée."],
    ["Primer tocón e instalación", "Trituradora llevada y primer tocón molido."],
    ["Prima ceppaia e installazione", "Fresaceppi portata e prima ceppaia fresata."],
    ["Erster Stubben und Rüsten", "Fräse angeliefert und erster Stubben gefräst."],
    ["Перший пень і підготовка", "Подрібнювач доставлено, перший пень подрібнено."],
    ["Unang tuod at setup", "Dinala ang grinder at ginrind ang unang tuod."],
  ))], D.bundle("percent", 10)),

  // ── Inspection ──
  "fq.tree_care_service.tree_care.arborist_assessment": T("inspection", n(
    ["Valutazione dell'albero da parte di un arboricoltore", "Salute, struttura e rischio di un albero per la casa valutati, con raccomandazione scritta."],
    ["Baumgutachten durch Baumpfleger", "Gesundheit, Statik und Risiko eines Baums für das Haus bewertet, mit schriftlicher Empfehlung."],
    ["Оцінка дерева арбористом", "Здоров'я, структуру й ризик дерева для будинку оцінено з письмовою рекомендацією."],
    ["Arborist na pagsuri ng puno", "Sinuri ang kalusugan, istruktura at panganib ng puno sa bahay, may nakasulat na rekomendasyon."],
  ), [L.labour(1, "flat", 125, t7(
    ["Arborist assessment", "Tree walked, trunk and canopy checked, risk rated and options written up."],
    ["Évaluation par l'arboriste", "Arbre examiné, tronc et cime vérifiés, risque évalué et options rédigées."],
    ["Evaluación del arborista", "Árbol revisado, tronco y copa inspeccionados, riesgo calificado y opciones escritas."],
    ["Valutazione dell'arboricoltore", "Albero esaminato, tronco e chioma controllati, rischio valutato e opzioni redatte."],
    ["Baumpflegergutachten", "Baum begutachtet, Stamm und Krone geprüft, Risiko bewertet und Optionen notiert."],
    ["Оцінка арбориста", "Дерево оглянуто, стовбур і крону перевірено, ризик оцінено, варіанти записано."],
    ["Pagsuri ng arborist", "Tiningnan ang puno, chineck ang katawan at canopy, sinukat ang panganib at isinulat ang opsyon."],
  ))], null),

  "fq.tree_care_service.tree_care.storm_inspection": T("inspection", n(
    ["Ispezione alberi dopo una tempesta", "Alberi controllati dopo una tempesta per rami spaccati, sospesi e inclinazione, segnando cosa abbattere prima."],
    ["Bauminspektion nach Sturm", "Bäume nach einem Sturm auf gespaltene, hängende Äste und Schieflage geprüft, Dringendes markiert."],
    ["Огляд дерев після бурі", "Дерева перевірено після бурі на розколоті, звислі гілки й нахил, позначено першочергове."],
    ["Inspeksyon ng puno pagkatapos ng bagyo", "Chineck ang puno pagkatapos ng bagyo sa biyak, nakabitin na sanga at hilig, minarkahan ang uunahin."],
  ), [L.labour(1, "flat", 95, t7(
    ["Storm inspection", "Every tree near the house checked and hazards marked in order of urgency."],
    ["Inspection après tempête", "Chaque arbre près de la maison vérifié et dangers marqués par ordre d'urgence."],
    ["Inspección tras tormenta", "Cada árbol cerca de la casa revisado y peligros marcados por urgencia."],
    ["Ispezione dopo tempesta", "Ogni albero vicino alla casa controllato e pericoli segnati per urgenza."],
    ["Sturminspektion", "Jeder Baum nahe am Haus geprüft und Gefahren nach Dringlichkeit markiert."],
    ["Огляд після бурі", "Кожне дерево біля будинку перевірено, небезпеки позначено за терміновістю."],
    ["Inspeksyon pagkatapos ng bagyo", "Chineck ang bawat punong malapit sa bahay at minarkahan ang panganib ayon sa urgency."],
  )), SHARED.report(35)], null),

  "fq.tree_care_service.tree_removal.other": T("inspection", n(
    ["Altro lavoro di rimozione — descrivi cosa serve", "Lavoro di rimozione non elencato, quotato dopo averlo visto."],
    ["Andere Entfernungsarbeit — beschreiben Sie den Bedarf", "Nicht aufgeführte Entfernungsarbeit, nach Besichtigung angeboten."],
    ["Інша робота з видалення — опишіть потребу", "Робота з видалення, якої немає в переліку, оцінена після огляду."],
    ["Ibang pagtanggal — ilarawan ang kailangan", "Pagtanggal na wala sa listahan, pinresyuhan pagkakita."],
  ), [SHARED.serviceCall(60)], null),

  // ── Maintenance ──
  "fq.tree_care_service.tree_care.trimming": T("maintenance", n(
    ["Potatura di contenimento", "Rami accorciati da tetto, cavi e lato del vicino, rami bassi rialzati e chioma sfoltita."],
    ["Baumschnitt", "Äste von Dach, Leitungen und Nachbarseite zurückgeschnitten, untere Äste aufgeastet und Krone ausgelichtet."],
    ["Обрізка дерев", "Гілки вкорочено від даху, дротів і сусіда, нижні підняті, крону проріджено."],
    ["Pag-trim ng puno", "Pinutol ang sanga palayo sa bubong, kawad at kapitbahay, itinaas ang mababa at pinanipis ang canopy."],
  ), [CREW(3), CHIP(75)], D.seasonal("percent", 10)),

  "fq.tree_care_service.tree_care.pruning": T("maintenance", n(
    ["Potatura strutturale", "Tagli per la salute dell'albero — legno secco, inserzioni deboli e rami che sfregano rimossi."],
    ["Erziehungs- und Pflegeschnitt", "Schnitte für die Baumgesundheit — Totholz, schwache Gabelungen und scheuernde Äste entfernt."],
    ["Формувальна обрізка", "Обрізка для здоров'я дерева — сухі, слабкі розгалуження й гілки, що труться, видалено."],
    ["Structural pruning", "Pagputol para sa kalusugan ng puno — tinanggal ang patay na sanga, mahinang sanga at nagkikiskisan."],
  ), [CREW(2.5), CHIP(75)], D.seasonal("percent", 10)),

  "fq.tree_care_service.shrub_care.trimming": T("maintenance", n(
    ["Rifilatura siepi e arbusti", "Siepi e arbusti rifilati in forma, ricacci tagliati via da muri e finestre, sfalci raccolti."],
    ["Hecken- und Strauchschnitt", "Hecken und Sträucher in Form geschnitten, Wuchs von Wänden und Fenstern zurückgenommen, Schnittgut entfernt."],
    ["Стрижка живоплоту й кущів", "Живопліт і кущі підстрижено за формою, пагони від стін і вікон зрізано, обрізки прибрано."],
    ["Pag-trim ng halaman at hedge", "Hinubog ang hedge at halaman, pinutol ang tumutubo sa pader at bintana, inipon ang pinutol."],
  ), [L.labour(2, "hour", 65, t7(
    ["Shrub trimming — per crew hour", "Hedges and shrubs sheared to shape and clippings collected."],
    ["Taille d'arbustes — par heure d'équipe", "Haies et arbustes taillés en forme, résidus ramassés."],
    ["Recorte de arbustos — por hora de cuadrilla", "Setos y arbustos recortados en forma y restos recogidos."],
    ["Rifilatura arbusti — per ora di squadra", "Siepi e arbusti rifilati in forma e sfalci raccolti."],
    ["Strauchschnitt — pro Teamstunde", "Hecken und Sträucher in Form geschnitten und Schnittgut gesammelt."],
    ["Стрижка кущів — за годину бригади", "Живопліт і кущі підстрижено, обрізки зібрано."],
    ["Pag-trim ng halaman — kada oras ng crew", "Hinubog ang hedge at halaman at inipon ang pinutol."],
  )), SHARED.disposalFee(25)], D.seasonal("percent", 10)),

  "fq.tree_care_service.shrub_care.pruning": T("maintenance", n(
    ["Potatura degli arbusti", "Tagli selettivi per togliere rami secchi, incrociati o malati così che fiorisca e cresca bene."],
    ["Strauchpflege-Schnitt", "Gezielte Schnitte gegen tote, kreuzende oder kranke Triebe, damit der Strauch gut blüht und wächst."],
    ["Санітарна обрізка кущів", "Вибіркова обрізка сухих, перехресних чи хворих пагонів для гарного цвітіння й росту."],
    ["Pruning ng halaman", "Piling pagputol sa patay, nagkakrus o may sakit na sanga para mamulaklak at lumago nang maayos."],
  ), [L.labour(1.5, "hour", 70, t7(
    ["Shrub pruning — per hour", "Selective thinning and heading cuts made by hand."],
    ["Élagage d'arbustes — à l'heure", "Coupes d'éclaircie et de rabattage faites à la main."],
    ["Poda de arbustos — por hora", "Cortes selectivos de aclareo y despunte hechos a mano."],
    ["Potatura arbusti — a ore", "Tagli selettivi di diradamento e raccorciamento a mano."],
    ["Strauchschnitt — pro Stunde", "Auslichtungs- und Rückschnitte von Hand."],
    ["Обрізка кущів — за годину", "Вибіркове проріджування й укорочення вручну."],
    ["Pruning — kada oras", "Piling thinning at heading cut gamit ang kamay."],
  ))], null),
};

withTemplates(SEED, TEMPLATES);
