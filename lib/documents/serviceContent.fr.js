// lib/documents/serviceContent.fr.js
//
// What a quote SAYS about each trade — in French.
//
// ── Why a parallel file, and not translation at send time ───────────────────
//
// A document keeps the language it was created in (AGENTS.md non-negotiable
// #6). The prose here is not stored on the quote; resolveServiceContent picks
// it at render time from a STATIC catalogue keyed by the quote's own fixed
// `language`, so a French quote renders the same French sentences on the day
// it is signed and on every day after. Nothing is machine-translated at send
// time, and a viewer's browser language changes nothing.
//
// Before this file, a French quote carried a French frame ("Préparé pour",
// "Ce qui est inclus") over English prose — the owner opened Q-2026-0011 on
// his phone and read "We replace the doors and drawer fronts…" under DEVIS.
//
// ── Coverage, stated ────────────────────────────────────────────────────────
//
// Every trade in lib/documents/serviceContent.js has an entry here, carrying
// every text field its English entry has — description, variants, inclusions,
// process steps with their timelines, "what could change this price" and the
// glossary — plus the generic block's inclusions and steps.
// scripts/check-service-content-languages.mjs --lang=fr enforces it: a new
// English trade or field without its French fails there, not on a client's
// quote. resolveServiceContent still falls back to the English FIELD BY FIELD,
// so a gap is a missed check, never a blank. Adding a trade is adding a key
// with the same shape as the English; there is no second registry to keep in
// step.
//
// Same rules as the English: nothing states a warranty term, a price, a cure
// time, a brand or a number of days. Anything specific stays a [placeholder]
// — in French, and still in square brackets, because the resolver withholds a
// line with a bracket left in it whatever language the bracket is in.

const PREP_APPLY_FINISH = [
  {
    title: "Visite et confirmation",
    body: "Nous confirmons l'étendue des travaux sur place, convenons du fini et des couleurs, et répondons à toute question avant de commencer.",
  },
  {
    title: "Protection et préparation",
    body: "Meubles déplacés ou couverts, surfaces avoisinantes masquées, et toutes les surfaces nettoyées et préparées pour un résultat durable.",
  },
  {
    title: "Réparations et apprêt",
    body: "Imperfections remplies et poncées, et apprêt appliqué là où l'adhérence et la couverture l'exigent.",
  },
  {
    // The same word as the English title, and correct French: the language
    // check lets a single word match (it rejects identical PHRASES only).
    title: "Application",
    body: "Le fini est appliqué en couches complètes, en respectant le temps de séchage que le produit exige réellement entre chacune.",
  },
  {
    title: "Nettoyage et visite finale",
    body: "Masquage retiré, lieux laissés propres, et une visite avec vous avant de déclarer le travail terminé.",
  },
];

const CABINET_REFINISH_WORKFLOW = [
  {
    title: "Préparation et protection de la cuisine",
    body: "Le masquage et le confinement sont installés en premier — planchers, comptoirs, électroménagers et ouvertures vers le reste de la maison — pour que la poussière et les projections restent dans la pièce où l'on travaille.",
  },
  {
    title: "Démontage et étiquetage",
    body: "Portes, façades de tiroirs et quincaillerie sont retirées, et chaque pièce est étiquetée pour retourner sur l'ouverture d'où elle vient.",
  },
  {
    title: "Nettoyage et ponçage",
    body: "Chaque surface est dégraissée puis poncée. Un fini pulvérisé sur de la graisse de cuisson ou sur un vernis d'usine lustré est un fini qui pèle — c'est pourquoi cette étape n'est pas celle à écourter.",
  },
  {
    title: "Apprêt et ponçage fin",
    body: "L'apprêt est appliqué pour bloquer les taches et donner de l'accroche à la couche de finition, avec un ponçage fin entre les couches pour rabattre le grain soulevé par la précédente.",
  },
  {
    title: "Couche de finition, inspection et retouches",
    body: "La couche de finition est pulvérisée en couches complètes, puis inspectée sous un bon éclairage et retouchée avant que quoi que ce soit ne soit remonté.",
  },
  {
    title: "Remontage, nettoyage et visite",
    body: "Portes et façades sont remises sur leurs propres ouvertures, la quincaillerie réinstallée et les portes réalignées, la pièce nettoyée, et nous la parcourons avec vous.",
  },
];

const CABINET_REFACE_WORKFLOW = [
  {
    title: "Mesures et spécifications",
    body: "Chaque ouverture est mesurée sur place, et le style de porte, la couleur et le fini sont confirmés avec vous avant toute commande. Les portes sont fabriquées à ces mesures et ne peuvent pas être redimensionnées ensuite.",
  },
  {
    title: "Commande et fabrication",
    body: "Portes, façades de tiroirs et matériau assorti pour les faces des caissons sont fabriqués aux mesures et au fini confirmés.",
  },
  {
    title: "Démontage",
    body: "Les portes, façades de tiroirs et quincaillerie existantes sont retirées et emportées.",
  },
  {
    title: "Faces des caissons préparées et finies",
    body: "Les faces extérieures visibles des caissons sont nettoyées, préparées et finies pour s'agencer aux nouvelles façades, de sorte que ce que vous gardez et ce que vous remplacez se lisent comme une seule cuisine.",
  },
  {
    title: "Pose et ajustement",
    body: "Charnières installées, positions des poignées percées à l'emplacement que vous avez choisi, et chaque porte et tiroir aligné pour des jeux réguliers.",
  },
  {
    title: "Nettoyage et visite",
    body: "La pièce est nettoyée et nous la parcourons avec vous avant la signature.",
  },
];

const MEASURE_SUPPLY_INSTALL = [
  {
    title: "Consultation et sélection",
    body: "Nous confirmons avec vous l'étendue des travaux, les matériaux et les finis, et répondons à toute question avant de commander.",
  },
  {
    title: "Mesures",
    body: "Mesures exactes prises sur place pour que le matériau soit coupé à votre espace, et non à une estimation.",
  },
  {
    title: "Commande et fabrication",
    body: "Matériaux commandés et préparés aux mesures confirmées.",
  },
  {
    title: "Démontage et préparation",
    body: "Matériau existant retiré et éliminé lorsque cela fait partie des travaux, et zone préparée pour l'installation.",
  },
  {
    title: "Installation et visite",
    body: "Installé, mis de niveau, scellé et nettoyé, suivi d'une visite avec vous.",
  },
];

// The durations are the English file's (a real contractor's published
// figures), carried over as they are — translated, never re-estimated.
const SHELL_SEQUENCE = [
  {
    title: "Revue des plans",
    body: "Vous fournissez les plans d'architecture et de structure. Nous examinons les exigences de charpente, déterminons les besoins en poutres ou colonnes d'acier, et signalons les problèmes d'accès au chantier avant qu'ils ne deviennent des retards sur le chantier.",
    timeline: "1–2 jours",
  },
  {
    title: "Visite du terrain",
    body: "Nous parcourons la propriété pour évaluer les voies d'accès, les aires d'entreposage et tout ce qui est propre au site — y compris la façon dont les matériaux seront livrés sur un terrain exigu.",
    timeline: "1–2 heures",
  },
  {
    title: "Soumission détaillée",
    body: "Prix détaillés, avec l'étendue des travaux et l'échéancier mis par écrit. Rien n'arrive plus tard par surprise.",
    timeline: "3–5 jours ouvrables",
  },
  {
    title: "Charpente",
    body: "Une fois la fondation prête et approuvée à l'inspection, les planchers, les murs et le toit sont charpentés et les fonds de clouage sont installés pour l'électricité, la plomberie et les accessoires. La structure est laissée prête pour l'installation brute de la mécanique.",
    timeline: "2–4 semaines",
  },
  {
    title: "Isolation",
    body: "Une fois l'installation brute de mécanique et d'électricité inspectée, l'isolant prévu est posé — mousse giclée, laine en natte ou une combinaison des deux, selon les plans et les exigences énergétiques.",
    timeline: "3–7 jours",
  },
  {
    title: "Gypse",
    body: "Panneaux posés, joints tirés et finis au niveau 4, ou au niveau 5 lorsque c'est spécifié. Murs laissés prêts pour l'apprêt et la peinture, et nos aires de travail nettoyées.",
    timeline: "1–2 semaines",
  },
];

const ASSESS_REPAIR_TEST = [
  {
    title: "Évaluation",
    body: "Nous diagnostiquons le problème sur place et confirmons ce qui est nécessaire avant d'engager quelque travail ou pièce que ce soit.",
  },
  {
    title: "Confirmation avec vous",
    body: "Si le travail s'avère différent de ce qui figure à la soumission, vous en êtes informé avant que nous poursuivions — pas après coup, sur la facture.",
  },
  {
    title: "Les travaux",
    body: "Réalisés conformément au code, avec les pièces et les méthodes prévues dans cette soumission.",
  },
  {
    title: "Essais",
    body: "Tout est mis à l'essai dans des conditions normales d'utilisation avant que nous remballions.",
  },
  {
    title: "Nettoyage et remise",
    body: "Les lieux sont laissés comme nous les avons trouvés, et nous vous expliquons ce qui a été fait et ce qu'il faut surveiller.",
  },
];

const VISIT_SERVICE_VERIFY = [
  {
    title: "Confirmation des détails",
    body: "Nous confirmons l'accès, l'horaire et tout point particulier auquel vous souhaitez que nous portions attention.",
  },
  {
    title: "Préparation",
    body: "La zone est préparée et tout ce qui doit être protégé est couvert avant de commencer.",
  },
  {
    title: "Les travaux",
    body: "Réalisés selon l'étendue des travaux décrite dans cette soumission, avec notre propre équipement et nos propres matériaux, sauf indication contraire.",
  },
  {
    title: "Vérification finale",
    body: "Nous vérifions le travail avant de partir et corrigeons tout ce qui n'est pas à la hauteur.",
  },
];

const INSPECT_REPORT_REVIEW = [
  {
    title: "Rendez-vous et accès",
    body: "Nous confirmons la propriété, l'heure et la façon dont l'accès est organisé. Vous êtes invité à être présent — la plupart des clients tirent davantage de l'inspection lorsqu'ils le sont.",
  },
  {
    title: "Inspection sur place",
    body: "Une inspection visuelle des zones et des systèmes facilement accessibles décrits ci-dessus. Elle est non invasive : rien n'est démonté, aucune surface finie n'est ouverte, et les effets entreposés ne sont pas déplacés.",
  },
  {
    title: "Constatations sur place",
    body: "Nous passons en revue nos constatations avec vous avant de partir, pour que vous entendiez les éléments importants en personne et puissiez poser vos questions sur-le-champ.",
  },
  {
    title: "Rapport écrit",
    body: "Un rapport écrit avec photos de chaque constatation importante, de ce qu'elle signifie et de ce que nous suggérons de faire.",
  },
  {
    title: "Questions après coup",
    body: "Le rapport soulève des questions une fois que vous le lisez à tête reposée. Nous restons disponibles pour en discuter.",
  },
];

const PLAN_BUILD_HANDOVER = [
  {
    title: "Étendue des travaux et échéancier",
    body: "Nous confirmons l'étendue complète des travaux, planifions l'ordre des corps de métier, et convenons avec vous d'une date de début et d'une durée prévue.",
  },
  {
    title: "Permis et préparation",
    body: "Les permis et inspections requis sont organisés, et le chantier est préparé et protégé.",
  },
  {
    title: "Démolition et installations brutes",
    body: "Matériaux existants retirés, et travaux de structure, d'électricité et de plomberie menés jusqu'à l'étape de l'inspection.",
  },
  {
    title: "Finitions",
    body: "Surfaces, accessoires et finis installés selon les spécifications convenues ci-dessus.",
  },
  {
    title: "Inspection et remise des travaux",
    body: "Inspection finale, liste des déficiences réglée, chantier nettoyé, et une visite avec vous.",
  },
];

const REFACE_TAIL =
  " Les faces extérieures visibles des caissons sont finies pour s'agencer, les charnières sont fournies, posées et ajustées, les positions des poignées sont percées à l'emplacement que vous choisissez, et les anciennes portes et façades sont emportées.";

const REFACE_DESCRIPTION =
  "Nous remplaçons les portes et les façades de tiroirs, et finissons les faces extérieures visibles des caissons pour qu'elles s'agencent, de sorte que votre cuisine conserve sa disposition et ses caissons actuels. Le style de porte au prix indiqué ci-dessus est celui qui sera fabriqué; les charnières sont fournies, posées et ajustées, les positions des poignées sont percées à l'emplacement que vous choisissez, et les anciennes portes et façades sont emportées. L'intérieur des armoires n'est pas refini sauf si une ligne ci-dessus l'indique.";

const REFACE_DOOR_VARIANTS = {
  thermofoil:
    "Les portes et façades de tiroirs de cette soumission sont en thermoplastique (thermofoil) : un cœur de MDF recouvert d'une pellicule de vinyle thermoformée et finie en usine dans la couleur que vous avez choisie. Elles arrivent complètes — rien n'est poncé, apprêté ni pulvérisé sur place, et la couleur ne peut pas être changée plus tard sans remplacer la porte." +
    REFACE_TAIL,
  painted_mdf:
    "Les portes et façades de tiroirs de cette soumission sont en MDF peint : une porte de MDF usinée, pulvérisée dans la couleur que vous avez choisie. Le MDF n'a pas de grain qui transparaît sous la peinture, ce qui permet un fini peint uniforme et sans joint apparent, et il peut être repeint plus tard." +
    REFACE_TAIL,
  red_oak:
    "Les portes et façades de tiroirs de cette soumission sont en chêne rouge massif : une porte de bois naturel au grain ouvert et prononcé qui transparaît sous le fini, de sorte qu'aucune porte n'est identique à une autre. Le bois travaille avec les saisons, et de fines lignes qui s'ouvrent et se referment aux joints entre traverses et montants sont normales et ne constituent pas un défaut." +
    REFACE_TAIL,
  white_oak:
    "Les portes et façades de tiroirs de cette soumission sont en chêne blanc massif : une porte de bois naturel au grain plus serré et plus droit que le chêne rouge, qui transparaît sous le fini, de sorte qu'aucune porte n'est identique à une autre. Le bois travaille avec les saisons, et de fines lignes qui s'ouvrent et se referment aux joints entre traverses et montants sont normales et ne constituent pas un défaut." +
    REFACE_TAIL,
};

// Keyed like the English GUTTER_WORK_VARIANTS (GUTTER_WORK_TYPES in
// lib/pricing/tradeScope.js). Each still ends by naming what is NOT included —
// the fascia, the roof, the other runs — because that is the dispute it exists
// to prevent, in any language.
const GUTTER_WORK_VARIANTS = {
  cleaning:
    "Nous vidons les gouttières et les descentes pluviales existantes, les rinçons pour prouver qu'elles s'écoulent, et inspectons les sections pendant qu'elles sont vides — supports, jonctions, joints et la bordure de toit derrière — en scellant au fur et à mesure les petits défauts que nous trouvons. Ce qui est au prix ici, ce sont les travaux énumérés ci-dessus : remplacer une section, en refaire la pente ou réparer une bordure de toit pourrie est un travail distinct et n'apparaît que là où vous le voyez au prix.",
  install:
    "Nous fournissons et installons de nouvelles gouttières sur les sections au prix indiqué ci-dessus, formées sur place à la longueur de votre bordure de toit et posées selon une pente qui mène l'eau jusqu'aux sorties, avec les descentes pluviales énumérées ci-dessus dirigées là où vous voulez que l'eau aille. Seules les sections et descentes au prix indiqué ci-dessus sont installées — protège-gouttières, câbles chauffants, soffites, bordures de toit et tous travaux de toiture sont des lignes distinctes et ne sont inclus que là où vous les voyez au prix.",
  replacement:
    "Nous démontons vos gouttières existantes, les emportons, et posons de nouvelles gouttières à leur place sur les sections au prix indiqué ci-dessus, formées sur place et réglées selon une pente qui mène l'eau jusqu'aux sorties, avec les descentes pluviales énumérées ci-dessus. Le démontage et l'élimination des anciennes gouttières font partie de ce que vous payez ici — vous le verrez soit dans le tarif au pied, soit sur une ligne distincte. Une bordure de toit trouvée pourrie une fois l'ancienne gouttière retirée vous est signalée avec photos et chiffrée avant toute réparation. Seules les sections et descentes au prix indiqué ci-dessus sont remplacées.",
  repair:
    "Nous réparons les défauts énumérés ci-dessus — rescellage des jonctions et des joints, refixation des supports, et reprise de la pente sur de courtes sections pour que la gouttière s'écoule au lieu de retenir l'eau — et faisons couler de l'eau dans les sections réparées avant de partir, pour que vous puissiez constater l'écoulement. Les réparations sont tarifées par section dans cette soumission. Remplacer une section complète, refaire la pente de tout le système ou remettre en état une bordure de toit pourrie est un travail distinct et n'apparaît que là où vous le voyez au prix.",
  guard_only:
    "Nous posons le protège-gouttière au prix indiqué ci-dessus sur les sections énumérées ci-dessus. Un protège-gouttière doit être posé sur une gouttière propre, sinon il ne fait qu'emprisonner les débris en dessous; toute section qui n'est pas dégagée est donc nettoyée d'abord — ce nettoyage est un travail distinct et n'est inclus que là où vous le voyez au prix. Seules les sections au prix indiqué ci-dessus reçoivent un protège-gouttière, et les descentes pluviales, le toit et tout ce qui se trouve au-dessus de la ligne de gouttière sont des lignes distinctes aux mêmes conditions.",
};

export const GENERIC_FR = {
  included: [
    "Toute la main-d'œuvre et l'équipement nécessaires pour réaliser les travaux décrits ci-dessus",
    "Protection des surfaces et finis avoisinants pendant notre présence sur place",
    "Nettoyage et enlèvement de nos propres débris à la fin des travaux",
    "Une visite avec vous avant la signature des travaux",
  ],
  steps: VISIT_SERVICE_VERIFY,
};

export const CONTENT_FR = {
  interior_painting: {
    description:
      "Nous peignons les pièces et les surfaces au prix indiqué ci-dessus. Les meubles sont déplacés ou couverts et les planchers protégés, les trous de clous et les fissures sont remplis, les joints calfeutrés, et les surfaces poncées et apprêtées là où c'est nécessaire avant les couches de finition. Seules les surfaces énumérées ci-dessus sont peintes — plafonds, moulures, portes et intérieurs de placards sont des lignes distinctes et ne sont inclus que là où vous les voyez au prix.",
    included: [
      "Meubles déplacés ou couverts et planchers protégés du début à la fin",
      "Trous de clous et fissures remplis, zones rugueuses poncées, joints calfeutrés",
      "Apprêt appliqué là où c'est nécessaire pour un changement de couleur, des réparations ou des surfaces nues",
      "Couches complètes de peinture de qualité supérieure sur chaque surface énumérée ci-dessus",
      "Découpe au pinceau sur les moulures, les bordures et les détails, plutôt que des lignes au ruban",
      "Plaques de prises et quincaillerie retirées puis remises en place",
    ],
    steps: PREP_APPLY_FINISH,
  },
  exterior_painting: {
    description:
      "Nous lavons les surfaces extérieures au prix indiqué ci-dessus et les laissons sécher, grattons la matière qui se décolle et s'écaille, ponçons les zones rugueuses, calfeutrons les joints et les jonctions ouverts, apprêtons les endroits nus et réparés, puis appliquons les couches de finition. Seules les surfaces énumérées ci-dessus sont recouvertes — moulures, soffites, bordures de toit, portes et volets sont des lignes distinctes et ne sont inclus que là où vous les voyez au prix.",
    included: [
      "Surfaces lavées et laissées sécher correctement avant toute application",
      "Matière qui se décolle et s'écaille grattée, zones rugueuses poncées",
      "Joints, jonctions et interstices calfeutrés; petites réparations de surface effectuées",
      "Apprêt de qualité extérieure sur les zones nues et réparées",
      "Couches complètes de peinture extérieure sur chaque surface énumérée ci-dessus",
      "Site laissé exempt de masquage, de toiles de protection et de débris",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refinishing: {
    description:
      "Nous refinissons les armoires que vous avez déjà. Les portes, les façades de tiroirs et les faces extérieures visibles des caissons sont dégraissées, poncées, apprêtées et pulvérisées d'un nouveau fini dans la couleur et le lustre que vous choisissez. Rien n'est remplacé : les caissons, la disposition et le style de porte restent exactement tels quels, et l'intérieur des armoires n'est pas refini sauf si une ligne ci-dessus l'indique.",
    included: [
      "Couleur et lustre convenus avec vous avant toute commande",
      "Cuisine masquée et confinée pour que la poussière et les projections restent dans la pièce",
      "Portes, façades de tiroirs et quincaillerie retirées, étiquetées et remises en place",
      "Toutes les surfaces dégraissées, poncées et préparées pour l'adhérence",
      "Apprêt appliqué pour bloquer les taches et donner de l'accroche à la couche de finition",
      "Couche de finition pulvérisée sur les deux faces de chaque porte et façade de tiroir",
      "Faces extérieures des caissons finies pour s'agencer",
      "Quincaillerie remise en place, portes réalignées, et une visite avec vous",
      "Apprêt : [combien de couches, et quel apprêt vous utilisez]",
      // Brackets are capped at 80 characters by unfilledPlaceholders(); a
      // longer one would print WITH its brackets on a client's quote.
      "Couche de finition : [combien de couches, quel produit, et le ratio de catalyseur s'il y a lieu]",
      "Garantie contre le décollement : [votre durée, et ce qu'elle couvre]",
      "Temps habituel sur place : [combien de jours, du début à la visite finale]",
    ],
    steps: CABINET_REFINISH_WORKFLOW,
  },
  cabinet_refacing: {
    description: REFACE_DESCRIPTION,
    variantLabel: "le matériau des portes",
    variants: REFACE_DOOR_VARIANTS,
    included: [
      "Style de porte, couleur et fini confirmés avec vous avant la commande",
      "Chaque ouverture mesurée sur place, pour des portes faites à votre cuisine",
      "Nouvelles portes et façades de tiroirs fabriquées à ces mesures",
      "Faces extérieures des caissons finies pour s'agencer aux nouvelles façades",
      "Charnières fournies, posées et ajustées pour des portes bien d'aplomb",
      "Positions des poignées percées à l'emplacement que vous avez choisi",
      "Portes, façades et quincaillerie existantes retirées et emportées",
      "Portes et tiroirs ajustés à la remise des travaux, avec une visite",
      "Construction et fini des portes : [votre fournisseur, et le fini que vous spécifiez]",
      "Garantie sur les portes et le fini : [votre durée, et ce qu'elle couvre]",
      "Délai habituel entre la commande et l'installation : [votre délai]",
    ],
    steps: CABINET_REFACE_WORKFLOW,
  },
  stairs: {
    description:
      "Nous refinissons l'escalier tel qu'il est. Les murs, les barreaux et le plancher avoisinant sont masqués, les composants au prix indiqué ci-dessus sont poncés jusqu'au bois nu, les bosses et les interstices sont remplis, la teinture est appliquée là où une couleur a été choisie, et les couches protectrices suivent avec un léger ponçage entre chacune. Seuls les composants énumérés ci-dessus sont refinis — marches, contremarches, barreaux, poteaux, main courante et palier sont des lignes distinctes. Remplacer un composant, plutôt que le refinir, est un travail distinct.",
    included: [
      "Murs, barreaux et plancher avoisinants masqués et protégés",
      "Marches et composants poncés, prêts pour le fini",
      "Interstices, bosses et imperfections remplis",
      "Teinture appliquée uniformément sur toutes les surfaces préparées",
      "Couches de finition protectrices avec léger ponçage entre chacune",
      "Conseils d'entretien et de séchage à la remise des travaux",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring: {
    description:
      "Nous refinissons les planchers de bois que vous avez déjà dans les zones au prix indiqué ci-dessus. Les lames lâches sont fixées, puis le plancher est poncé avec des grains de plus en plus fins pour enlever l'ancien fini et égaliser la surface, les trous et les interstices sont remplis, la teinture est appliquée là où une couleur a été choisie, et les couches protectrices suivent avec un égrenage entre chacune. Les lames abîmées au-delà de ce que le ponçage peut corriger relèvent du remplacement et sont tarifées à part.",
    included: [
      "Meubles déplacés au besoin et zones avoisinantes protégées",
      "Lames lâches fixées et plancher vérifié avant le ponçage",
      "Ponçage progressif pour enlever l'ancien fini et égaliser la surface",
      "Trous de clous et interstices remplis avant la dernière passe",
      "Teinture appliquée uniformément là où une couleur a été choisie",
      "Couches de finition protectrices avec égrenage entre chacune",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring_install: { steps: MEASURE_SUPPLY_INSTALL },
  countertop: {
    description:
      "Nous prenons le gabarit de vos armoires sur place, fabriquons le comptoir dans le matériau au prix indiqué ci-dessus selon ces mesures, retirons et éliminons le comptoir existant, puis installons, mettons de niveau et jointons le nouveau. Les découpes et le profil de chant énumérés ci-dessus sont ce qui sera fabriqué — ce qui n'est pas énuméré n'est pas découpé. Débrancher et rebrancher la plomberie, l'électricité et le gaz est un travail distinct et ne figure ci-dessus que si vous l'avez demandé.",
    included: [
      "Matériau fourni selon les spécifications établies ci-dessus",
      "Gabarit pris sur place pour un ajustement à vos armoires réelles",
      "Comptoir existant retiré et éliminé",
      "Fabrication incluant le profil de chant et toute découpe énumérée",
      "Installation, mise de niveau et jointoiement",
      "Joints, jonctions et périmètre scellés",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  tiling: { steps: MEASURE_SUPPLY_INSTALL },
  drywall: { steps: SHELL_SEQUENCE },
  drywall_install: { steps: SHELL_SEQUENCE },

  // ── Mécanique et électricité ─────────────────────────────────────────────
  plumbing: { steps: ASSESS_REPAIR_TEST },
  electrical: { steps: ASSESS_REPAIR_TEST },
  hvac_install: { steps: MEASURE_SUPPLY_INSTALL },
  hvac_repair: { steps: ASSESS_REPAIR_TEST },
  appliance_repair: { steps: ASSESS_REPAIR_TEST },
  garage_door: {
    description:
      "Nous fournissons et installons la ou les portes au prix indiqué ci-dessus, avec les rails, les ressorts, les câbles et la quincaillerie sur lesquels elles fonctionnent, et la porte est équilibrée puis actionnée au moteur sur plusieurs cycles avant notre départ. Le recouvrement du cadre et les moulures sont des lignes distinctes et ne sont inclus que là où vous les voyez au prix. Les travaux d'électricité, un nouvel ouvre-porte et toute modification de la taille ou de la charpente de l'ouverture sont des travaux distincts et ne sont pas inclus sauf si une ligne ci-dessus l'indique.",
    steps: ASSESS_REPAIR_TEST,
  },
  locksmith: { steps: ASSESS_REPAIR_TEST },
  well_water: { steps: ASSESS_REPAIR_TEST },
  elevator_services: { steps: ASSESS_REPAIR_TEST },
  mechanical_contracting: { steps: ASSESS_REPAIR_TEST },
  installation_services: { steps: MEASURE_SUPPLY_INSTALL },

  // ── Structure et enveloppe ───────────────────────────────────────────────
  roofing_service: {
    description:
      "Nous retirons le revêtement de toiture existant jusqu'au pontage, inspectons les panneaux en dessous et construisons un nouveau toit par-dessus : sous-couche, solins à chaque mur, cheminée, noue et évent, le revêtement au prix indiqué ci-dessus, et la ventilation au faîte et aux entrées d'air dont le toit a besoin pour sécher. Les matériaux arrachés sont emportés hors du site et le terrain est balayé pour ramasser les clous avant notre départ. Ce qui est au prix ici, c'est la surface de toiture énumérée ci-dessus — soffites, bordures de toit, gouttières, isolation et réparations structurales sont des travaux distincts et n'apparaissent que là où vous les voyez au prix.",
    included: [
      "Matériaux existants arrachés et emportés hors du site",
      "Pontage inspecté et toute section endommagée signalée avant son remplacement",
      "Sous-couche, solins et ventilation selon les besoins",
      "Nouvelle toiture installée selon les spécifications du fabricant",
      "Terrain dégagé et balayé pour ramasser les clous et les débris",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
    mayChange: [
      {
        title: "Plus de couches que prévu",
        body: "Cette soumission est établie selon les couches que nous avons pu voir ou sonder. Une deuxième ou une troisième couche en dessous représente plus de temps d'arrachage et plus d'élimination, et nous vous en informerons avant de poursuivre.",
      },
      {
        title: "L'état du pontage",
        body: "Les panneaux sous l'ancienne toiture ne peuvent pas être inspectés avant qu'elle soit retirée. Un pontage sain est recouvert comme prévu à la soumission; les sections pourries sont remplacées au tarif par feuille de cette soumission, comptées et montrées à vous.",
      },
      {
        title: "Météo",
        body: "Un toit ouvert ne reste pas ouvert pendant la nuit. Une semaine pluvieuse repousse la date de fin et rien d'autre — le prix ne change pas parce qu'il a plu.",
      },
    ],
    glossary: [
      {
        term: "Carré",
        body: "100 pieds carrés de surface de toit. L'unité dans laquelle tout le métier commande et établit ses prix — un toit de 2 400 pi² fait 24 carrés.",
      },
      {
        term: "Pente",
        body: "L'inclinaison, exprimée en élévation sur une course de 12 pouces. Un toit qui monte de 6 pouces pour chaque 12 pouces à l'horizontale est un « 6/12 ». Un toit en pente a plus de surface que le sol qu'il couvre, et un toit plus abrupt est plus lent à travailler.",
      },
      {
        term: "Pontage (support de couverture)",
        body: "Les panneaux structuraux posés sur les chevrons, auxquels tout le reste est fixé. Son état ne peut être connu qu'une fois l'ancien revêtement retiré.",
      },
      {
        term: "Arrachage",
        body: "Le retrait du revêtement existant. Les couches comprises dans le prix sont indiquées sur la soumission; toute couche supplémentaire représente de la main-d'œuvre et de l'élimination en plus.",
      },
      {
        term: "Sous-couche",
        body: "La membrane posée sur le pontage avant le revêtement. C'est la couche qui empêche l'eau d'entrer quand le vent la pousse sous un bardeau.",
      },
    ],
  },
  gutter_services: {
    description: GUTTER_WORK_VARIANTS.cleaning,
    variantLabel: "le type de travaux de gouttières",
    variants: GUTTER_WORK_VARIANTS,
    included: [
      "Gouttières vidées à la main et débris emportés, pas soufflés sur le terrain",
      "Chaque descente pluviale rincée et son écoulement confirmé",
      "Sections, supports et jonctions inspectés pendant qu'ils sont vides",
      "Scellement mineur là où une jonction ou un joint en a besoin",
      "Tout problème qui demande plus qu'un scellement est signalé avec photos avant d'être réglé",
    ],
    steps: [
      {
        title: "Vider les gouttières",
        body: "Chaque section vidée à la main des feuilles, des granules et des débris accumulés, et les débris emportés plutôt que chassés dans les descentes pluviales ou laissés sur le terrain.",
      },
      {
        title: "Rincer les descentes pluviales",
        body: "Chaque descente pluviale est rincée et observée, pour confirmer que ce qui sort de la gouttière se rend bien au sol. Une gouttière propre au-dessus d'une descente bouchée déborde quand même.",
      },
      {
        title: "Inspecter et sceller",
        body: "Une fois les sections vides, nous vérifions les supports, les jonctions, les joints et la bordure de toit derrière pour déceler jeu, dommages et fuites, et scellons les défauts mineurs que nous trouvons. Tout problème plus important est signalé avant d'être réglé, pas ajouté à la facture.",
      },
      {
        title: "Protège-gouttière — en option",
        body: "Lorsqu'il figure sur cette soumission, un protège-gouttière en aluminium Smart Screen est posé sur les sections vidées. N'apparaît ci-dessus que s'il a réellement été vendu; un protège-gouttière posé sur une gouttière non nettoyée emprisonne les débris en dessous.",
      },
      {
        title: "Remise des travaux",
        body: "La pose du protège-gouttière est couverte par une garantie de [durée de la garantie] couvrant [ce qu'elle couvre]. Les gouttières sont laissées en bon écoulement et l'aire de travail dégagée.",
      },
    ],
    mayChange: [
      {
        title: "L'état des sections une fois vidées",
        body: "Un support lâche, une jonction fendue ou une bordure de toit pourrie derrière la gouttière ne se voient pas à travers une gouttière pleine. Le scellement mineur est compris dans le prix ci-dessus; tout problème structural est signalé avec photos et chiffré séparément avant que quoi que ce soit ne soit fait.",
      },
      {
        title: "Comment on accède au toit",
        body: "Une section qui exige un échafaudage, un écarteur d'échelle au-dessus d'un solarium, ou une deuxième personne pour la sécurité prend plus de temps qu'une section accessible par une échelle sur un sol de niveau.",
      },
      {
        title: "Le nombre de descentes pluviales dont la section a réellement besoin",
        body: "Les descentes pluviales de cette soumission sont celles que la maison a actuellement. Une section qui manquait de descentes avant en manquera encore avec du métal neuf; là où nous pensons qu'une sortie supplémentaire est nécessaire, nous le disons et la chiffrons séparément plutôt que de supposer que vous en voulez une.",
      },
    ],
    glossary: [
      {
        term: "Descente pluviale",
        body: "Le tuyau vertical qui mène l'eau de la gouttière jusqu'au sol. Vider la gouttière sans prouver que la descente s'écoule ne règle que la moitié du problème.",
      },
      {
        term: "Support",
        body: "Le crochet qui retient la gouttière à la bordure de toit. Un support lâche laisse la section s'affaisser, et une section affaissée retient l'eau au lieu de l'évacuer.",
      },
      {
        term: "Bordure de toit (fascia)",
        body: "La planche derrière la gouttière dans laquelle les supports sont vissés. Les travaux de gouttières s'arrêtent là où commence une bordure pourrie, parce que rien ne tient dans du bois mou — c'est pourquoi une soumission de remplacement ne peut être sûre de la bordure qu'une fois l'ancienne gouttière retirée.",
      },
      {
        term: "Gouttière sans joint",
        body: "Gouttière formée sur place à partir d'un seul rouleau continu, à la longueur exacte de votre section, de sorte que les seuls joints se trouvent aux coins et aux sorties. Une gouttière en sections est jointe à quelques pieds d'intervalle, et chaque joint est un endroit qui peut finir par fuir.",
      },
      {
        term: "Cinq pouces et six pouces",
        body: "La largeur de la gouttière. Une gouttière de six pouces avec une sortie plus grande évacue beaucoup plus d'eau qu'une de cinq, ce dont ont besoin un grand toit, un toit à forte pente ou une noue qui se déverse dans un seul coin.",
      },
      {
        term: "Protège-gouttière à micromaille",
        body: "Un grillage fin qui bloque les granules de bardeaux, les graines et les aiguilles de pin en plus des feuilles. Un grillage de base bloque les feuilles et laisse passer les petits débris, et c'est cette différence que décrivent les deux prix.",
      },
      {
        term: "Protège-gouttière",
        body: "Un grillage posé sur la gouttière qui bloque les feuilles tout en laissant passer l'eau. Il réduit le nettoyage sans l'éliminer, et il doit être posé sur une gouttière propre.",
      },
      {
        term: "Frais de service minimum",
        body: "Une courte section coûte presque autant à atteindre qu'une longue — le même camion, les mêmes échelles, le même déplacement. Les petites visites sont donc facturées selon un minimum plutôt qu'au pied, et lorsque c'est le cas, la soumission montre le complément sur une ligne distincte au lieu de gonfler discrètement le tarif.",
      },
    ],
  },

  siding: {
    description:
      "Nous retirons le revêtement extérieur existant des murs au prix indiqué ci-dessus, vérifions le revêtement intermédiaire derrière et remettons en état les sections que prévoit cette soumission, puis posons une membrane pare-intempéries et le nouveau revêtement énuméré ci-dessus, avec des moulures aux coins, aux fenêtres et aux portes. Seuls les murs au prix indiqué ci-dessus reçoivent un nouveau revêtement. Soffites, bordures de toit, gouttières, fenêtres et isolation sont des lignes distinctes et ne sont inclus que là où vous les voyez au prix.",
    steps: MEASURE_SUPPLY_INSTALL,
  },

  insulation: {
    description:
      "Nous isolons les zones au prix indiqué ci-dessus jusqu'à la valeur R indiquée dans cette soumission. Les fuites d'air sont traitées en premier — sablières, pénétrations et trappe d'accès — parce que l'isolant ralentit la chaleur mais n'arrête pas un courant d'air; le matériau est ensuite installé à l'épaisseur qu'exige cette valeur R, en gardant ouvert le passage de ventilation là où l'assemblage en comporte un. L'isolant existant reste en place sauf si une ligne ci-dessus indique qu'il est retiré, et l'épaisseur réellement installée est notée et marquée pour pouvoir être vérifiée plus tard.",
    included: [
      "Conditions existantes et épaisseur notées avant que quoi que ce soit ne soit recouvert",
      "Fuites d'air scellées aux sablières, aux pénétrations et à la trappe d'accès",
      "Passage de ventilation gardé ouvert là où l'assemblage en a besoin",
      "Matériau installé à l'épaisseur qu'exige la valeur R indiquée",
      "Repères d'épaisseur laissés en place et aire de travail dégagée",
    ],
    steps: [
      {
        title: "Revue du projet",
        body: "Nous passons en revue les plans ou parcourons l'espace, et convenons exactement des zones à isoler — sous-sol, solives de rive, plafond de garage, entretoit.",
        timeline: "1–2 jours",
      },
      {
        title: "Soumission",
        body: "Établie selon les zones à couvrir, le matériau, et l'épaisseur dont chaque assemblage a besoin pour atteindre sa valeur R.",
        timeline: "2–4 jours",
      },
      {
        title: "Planification",
        body: "Prévue pour commencer une fois la charpente et l'installation brute de mécanique et d'électricité terminées et inspectées. Isoler avant cette inspection oblige à tout rouvrir.",
        timeline: "Au besoin",
      },
      {
        title: "Préparation du site",
        body: "Zones dégagées, et fenêtres, accessoires et surfaces finies masqués et protégés.",
        timeline: "1–2 heures",
      },
      {
        title: "Application de l'isolant",
        body: "Matériau installé à l'épaisseur spécifiée, en plusieurs passes lorsque l'épaisseur l'exige.",
        timeline: "1–3 jours",
      },
      {
        title: "Coupe de l'excédent et nettoyage",
        body: "Excédent coupé à égalité avec la charpente, surpulvérisation nettoyée, épaisseur notée, et zone remise prête pour le corps de métier suivant.",
        timeline: "Le jour même",
      },
    ],
    mayChange: [
      {
        title: "Ce que l'on découvre une fois l'espace ouvert",
        body: "Un isolant mouillé, tassé ou contaminé doit être retiré avant que quoi que ce soit soit installé, et un câblage à boutons et tubes ou un ventilateur de salle de bain qui évacue dans l'entretoit doit être réglé d'abord. Rien de cela n'est visible depuis la trappe.",
      },
      {
        title: "L'épaisseur que la cavité peut réellement contenir",
        body: "Une cavité fermée contient ce qu'elle contient. Là où l'espace ne permet pas d'atteindre la valeur R visée avec le matériau prévu, nous vous le dirons et vous présenterons les options plutôt que d'en installer moins sans rien dire.",
      },
    ],
    glossary: [
      {
        term: "Valeur R",
        body: "La résistance de l'assemblage au passage de la chaleur — plus elle est élevée, mieux c'est. C'est ce que demandent autant un programme de subvention qu'un inspecteur en bâtiment, et c'est pourquoi l'épaisseur sur cette soumission est celle-là.",
      },
      {
        term: "R par pouce",
        body: "La valeur R que fournit chaque pouce d'un matériau. C'est pourquoi deux matériaux qui atteignent la même valeur R n'ont pas la même épaisseur, et pourquoi l'un d'eux peut ne pas entrer dans l'espace.",
      },
      {
        term: "Étanchéisation à l'air",
        body: "Fermer les interstices par lesquels l'air circule réellement avant de les recouvrir. L'isolant ralentit la chaleur; il n'arrête pas un courant d'air, et souffler de l'isolant dans un entretoit non scellé est la raison la plus courante pour laquelle un travail donne de moins bons résultats que prévu.",
      },
      {
        term: "Déflecteur",
        body: "Un canal qui garde ouvert le passage entre l'évent de soffite et l'entretoit une fois l'isolant en place. Sans déflecteurs, les évents se bouchent et le pontage du toit ne sèche plus.",
      },
    ],
  },
  masonry: { steps: MEASURE_SUPPLY_INSTALL },
  concrete: { steps: MEASURE_SUPPLY_INSTALL },
  paving: {
    description:
      "Nous excavons la zone au prix indiqué ci-dessus, posons une membrane géotextile de séparation et construisons une fondation granulaire compactée par couches, puis posons les pavés énumérés ci-dessus selon le motif convenu, d'équerre avec la maison et encadrés d'un rang de bordure. Les rives sont stabilisées par des retenues, les joints sont remplis et compactés, et la surface est réglée selon une pente qui s'éloigne du bâtiment. Le terrain perturbé autour des travaux est nivelé et remis en état. Le déplacement des services publics, le drainage au-delà de la zone de travail et les permis sont en sus.",
    steps: MEASURE_SUPPLY_INSTALL,
  },
  driveway_sealing: {
    description:
      "Nous balayons et soufflons la surface, traitons les taches d'huile et de graisse pour que le scellant adhère, masquons les bordures, et appliquons le scellant sur la surface de l'entrée au prix indiqué ci-dessus selon le nombre de couches que prévoit cette soumission. Le scellement est de l'entretien sur une surface saine : il ralentit les dommages causés par l'eau et le soleil. Il ne répare pas un asphalte déjà désagrégé, et il ne cache pas les fissures ni les rapiéçages existants — le remplissage des fissures est une ligne distincte et n'est inclus que là où vous le voyez au prix.",
    steps: PREP_APPLY_FINISH,
  },
  fence_services: { steps: MEASURE_SUPPLY_INSTALL },
  chimney_sweep: { steps: VISIT_SERVICE_VERIFY },
  restoration: { steps: ASSESS_REPAIR_TEST },
  excavation: { steps: PLAN_BUILD_HANDOVER },
  demolition: { steps: PLAN_BUILD_HANDOVER },
  demolition_contractor: { steps: PLAN_BUILD_HANDOVER },

  home_inspection: {
    description:
      "Nous inspectons les zones et les systèmes facilement accessibles de la propriété et vous remettons un rapport écrit, avec photos, de ce que nous avons constaté et de ce que cela signifie. L'inspection est visuelle et non invasive : rien n'est démonté, aucune surface finie n'est ouverte, et les effets entreposés ne sont pas déplacés — un défaut caché derrière eux est donc un défaut que nous ne pouvons pas signaler. Les analyses de radon et de qualité de l'air, l'inspection des appareils de chauffage au bois, et les analyses de puits et de fosse septique sont des services distincts et ne sont réalisés que là où vous les voyez au prix ci-dessus.",
    included: [
      "Une inspection visuelle des zones facilement accessibles de la propriété",
      "Toiture, revêtement extérieur, nivellement du terrain et drainage, dans la mesure où ils peuvent être atteints en sécurité",
      "Structure, fondation, et sous-sol ou vide sanitaire là où l'on peut y entrer",
      "Systèmes de chauffage, de climatisation, de plomberie et d'électricité actionnés par leurs commandes normales",
      "Finis intérieurs, fenêtres, portes, isolation et ventilation de l'entretoit",
      "Un rapport écrit avec photos des constatations importantes",
      "Du temps sur place à la fin pour vous expliquer ce qui a été constaté",
    ],
    steps: INSPECT_REPORT_REVIEW,
  },

  // ── Projets complets ─────────────────────────────────────────────────────
  general_contracting: { steps: SHELL_SEQUENCE },
  general_contracting_reno: { steps: PLAN_BUILD_HANDOVER },
  construction: { steps: SHELL_SEQUENCE },
  remodeling: { steps: PLAN_BUILD_HANDOVER },
  carpentry: { steps: MEASURE_SUPPLY_INSTALL },
  handyman: { steps: VISIT_SERVICE_VERIFY },
  property_maintenance: { steps: VISIT_SERVICE_VERIFY },

  // ── Nettoyage ────────────────────────────────────────────────────────────
  residential_cleaning: {
    included: [
      "Tous les produits et l'équipement de nettoyage fournis par nous",
      "Chaque pièce et surface énumérée ci-dessus",
      "Robinetterie, accessoires et surfaces souvent touchées essuyés",
      "Déchets enlevés et sacs de poubelle remplacés",
    ],
    steps: VISIT_SERVICE_VERIFY,
  },
  deep_cleaning: { steps: VISIT_SERVICE_VERIFY },
  commercial_cleaning: { steps: VISIT_SERVICE_VERIFY },
  janitorial: { steps: VISIT_SERVICE_VERIFY },
  carpet_cleaning: { steps: VISIT_SERVICE_VERIFY },
  window_cleaning: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_house: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_driveway: { steps: VISIT_SERVICE_VERIFY },
  auto_detailing: { steps: VISIT_SERVICE_VERIFY },
  junk_removal: { steps: VISIT_SERVICE_VERIFY },

  // ── Terrain ──────────────────────────────────────────────────────────────
  landscaping_design: { steps: PLAN_BUILD_HANDOVER },
  lawn_care: { steps: VISIT_SERVICE_VERIFY },
  lawn_mowing: { steps: VISIT_SERVICE_VERIFY },
  irrigation: { steps: MEASURE_SUPPLY_INSTALL },
  tree_care_service: { steps: VISIT_SERVICE_VERIFY },
  snow_removal: {
    description:
      "Nous déneigeons les zones au prix indiqué ci-dessus selon le forfait que prévoit cette soumission, pour la saison qu'elle couvre. Des balises sont installées avant la neige pour que les bordures de pelouse et les plates-bandes restent visibles et soient évitées. Les allées piétonnes, les marches et l'épandage de sel sont des lignes distinctes et ne sont déneigés ou traités que là où vous les voyez au prix. Les toits, les balcons et tout objet laissé dans la zone de déneigement et enfoui hors de vue ne sont pas inclus.",
    steps: VISIT_SERVICE_VERIFY,
  },
  pest_control: { steps: VISIT_SERVICE_VERIFY },
  pool_spa: { steps: VISIT_SERVICE_VERIFY },
  dog_walking: { steps: VISIT_SERVICE_VERIFY },
  pooper_scooper: { steps: VISIT_SERVICE_VERIFY },
};
