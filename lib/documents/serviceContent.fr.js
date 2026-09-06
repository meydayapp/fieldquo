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
// The trades below are the ones translated so far. resolveServiceContent
// falls back to the English text FIELD BY FIELD for any trade or field not
// here, and docs/ROADMAP.md names the gap. Adding a trade is adding a key with
// the same shape as lib/documents/serviceContent.js; there is no second
// registry to keep in step.
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

export const GENERIC_FR = {
  included: [
    "Toute la main-d'œuvre et l'équipement nécessaires pour réaliser les travaux décrits ci-dessus",
    "Protection des surfaces et finis avoisinants pendant notre présence sur place",
    "Nettoyage et enlèvement de nos propres débris à la fin des travaux",
    "Une visite avec vous avant la signature des travaux",
  ],
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
};
