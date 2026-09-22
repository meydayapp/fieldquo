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
  ],
};
