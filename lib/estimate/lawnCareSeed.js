// lib/estimate/lawnCareSeed.js
//
// The STARTING POINT for a lawn-care company's programs and add-ons — what
// the settings form opens on before the owner has typed anything. Never
// published as-is (non-negotiable #4): the public estimator prices off the
// company's SAVED row, and a company that never saved one is not offered
// (computeInstantEstimate returns needsConfig).
//
// ══ Where the numbers come from ═══════════════════════════════════════════
//
// A competitor's published instant quotes, collected by the product owner in
// September 2026 for two addresses — one in Ottawa (English site, CAD) and
// one in Gatineau (French site, CAD). Both quotes printed "estimated lawn
// size 1,500 sq ft", which is their minimum pricing band rather than either
// house's lawn (see lib/estimate/lawnCare.js), so every `base` below is the
// price AT THAT BAND. The Ottawa 2026 figures are the seed; the Gatineau
// figures are recorded in the comments beside the items they price, because
// they are the same products at a different price point and an owner in
// Gatineau will want them.
//
//   Ottawa 2026 (CAD, at 1,500 sq ft)
//     Fall Tune-Up program           151.76 = weed control 75.88 + fertilization 75.88
//     Aeration (fall)                111.73
//     Grub control (preventative)    147.48
//     Aeration + overseeding (fall)  230.66
//     Crack & crevice control        106.02   (add-on program)
//     Mosquito control                96.90   (add-on program)
//     Tick / perimeter pest control  141.55   (add-on program)
//
//   Ottawa 2024 — the annual program, six visits
//     Essential program              392.88
//     Natural crabgrass control      146.11
//     Natural grub control           186.94
//     Spring aeration                125.66
//     Spring aeration + overseeding  274.70
//
//   Gatineau 2026 (CAD, at 1,500 sq ft)
//     Programme d'automne            139.16 = mauvaises herbes 69.58 + fertilisation 69.58
//     Contrôle des vers blancs       151.16
//     Aération (automne)              99.93
//     Programme de contrôle de végétation  69.58
//
// ══ The per-1,000 sq ft increment is NOT observed ═════════════════════════
//
// The competitor showed ONE band for both houses, so nothing in the owner's
// evidence says what they charge for the next thousand square feet. The
// `perThousand` figures below are a SEED ESTIMATE at 15% of the base per
// 1,000 sq ft: the product and the walking time scale with area, the trip,
// the set-up and the paperwork do not, and 15% is the low end of what
// granular-treatment companies publish for the step from 1,500 to 2,500 sq
// ft. It is a starting figure for the owner to overwrite, flagged as such on
// the settings screen, and the check script asserts it stays proportional so
// a later edit here cannot turn it into a hidden price.
//
// ══ The descriptions are FieldQuo's own words ═════════════════════════════
//
// The competitor's marketing copy is theirs. What is here says what each
// treatment IS, plainly, in the three languages the owner sells in — the
// owner replaces any of it on the settings screen, per language.

const SEED_INCREMENT_SHARE = 0.15;
const inc = (base) => Math.round(base * SEED_INCREMENT_SHARE * 100) / 100;
const priced = (base) => ({ base, perThousand: inc(base) });

export const LAWN_CARE_SEED_INCREMENT_SHARE = SEED_INCREMENT_SHARE;

const WEED_CONTROL = {
  key: "weed_control",
  name: { en: "Weed Control", fr: "Gestion des mauvaises herbes", es: "Control de malezas" },
  description: {
    en: "A targeted broadleaf weed treatment across the whole lawn, applied by a licensed technician, to clear dandelions, clover and plantain before they seed.",
    fr: "Un traitement ciblé des mauvaises herbes à feuilles larges sur toute la pelouse, appliqué par un technicien certifié, pour éliminer pissenlits, trèfle et plantain avant qu'ils ne montent en graine.",
    es: "Un tratamiento dirigido contra malezas de hoja ancha en todo el césped, aplicado por un técnico certificado, para eliminar dientes de león, trébol y llantén antes de que produzcan semilla.",
  },
  window: { en: "September – October", fr: "Septembre – octobre", es: "Septiembre – octubre" },
  ...priced(75.88),
};

const FERTILIZATION = {
  key: "fertilization",
  name: { en: "Fertilization", fr: "Fertilisation", es: "Fertilización" },
  description: {
    en: "A slow-release granular fertilizer applied across the lawn to build root strength through the cold months, so the grass greens up earlier and thicker in spring.",
    fr: "Un engrais granulaire à libération lente appliqué sur toute la pelouse pour renforcer les racines pendant la saison froide, pour un gazon plus vert et plus dense au printemps.",
    es: "Un fertilizante granular de liberación lenta aplicado en todo el césped para fortalecer las raíces durante los meses fríos, de modo que la hierba reverdezca antes y más densa en primavera.",
  },
  window: { en: "September – October", fr: "Septembre – octobre", es: "Septiembre – octubre" },
  ...priced(75.88),
};

export const LAWN_CARE_SEED = {
  minSqft: 1500,
  programs: [
    {
      key: "fall_tune_up",
      name: { en: "Fall Tune-Up", fr: "Programme d'automne", es: "Puesta a punto de otoño" },
      description: {
        en: "Two autumn visits that set the lawn up for winter: weed control and a fall fertilizer, timed for the weeks when roots grow fastest.",
        fr: "Deux visites d'automne pour préparer la pelouse à l'hiver : gestion des mauvaises herbes et fertilisation d'automne, au moment où les racines poussent le plus vite.",
        es: "Dos visitas de otoño que preparan el césped para el invierno: control de malezas y un fertilizante de otoño, programados para las semanas en que las raíces crecen más rápido.",
      },
      window: { en: "September – October", fr: "Septembre – octobre", es: "Septiembre – octubre" },
      services: [WEED_CONTROL, FERTILIZATION],
    },
    {
      key: "essential_program",
      name: { en: "Essential Program", fr: "Programme Essentiel", es: "Programa Esencial" },
      description: {
        en: "The full-season program: six visits from spring to fall covering fertilizer, weed control and surface-insect control, with a visit report left after each one.",
        fr: "Le programme pour toute la saison : six visites du printemps à l'automne couvrant fertilisation, gestion des mauvaises herbes et contrôle des insectes de surface, avec un rapport laissé après chaque visite.",
        es: "El programa de temporada completa: seis visitas de primavera a otoño que cubren fertilizante, control de malezas y control de insectos de superficie, con un informe después de cada visita.",
      },
      window: { en: "April – October", fr: "Avril – octobre", es: "Abril – octubre" },
      // The 2024 annual price split evenly over its six visits: the competitor
      // published only the total (392.88), so each service here is one sixth
      // of it, and the owner prices them individually if their books say
      // otherwise. Surface insect control was advertised as free; it is a
      // real visit and carries a sixth like the others rather than a $0 that
      // would read as a missing price.
      services: [
        {
          key: "spring_fertilizer",
          name: { en: "Spring granular fertilizer", fr: "Fertilisation granulaire de printemps", es: "Fertilizante granular de primavera" },
          description: { en: "The first feed of the year, to wake the lawn up and green it evenly.", fr: "La première fertilisation de l'année, pour réveiller la pelouse et la verdir uniformément.", es: "La primera alimentación del año, para despertar el césped y reverdecerlo de manera uniforme." },
          window: { en: "April – May", fr: "Avril – mai", es: "Abril – mayo" },
          ...priced(65.48),
        },
        {
          key: "spring_weed_control",
          name: { en: "Spring weed control", fr: "Gestion des mauvaises herbes – printemps", es: "Control de malezas de primavera" },
          description: { en: "Broadleaf weeds treated as they emerge, before they flower.", fr: "Les mauvaises herbes à feuilles larges traitées dès leur apparition, avant la floraison.", es: "Malezas de hoja ancha tratadas cuando emergen, antes de florecer." },
          window: { en: "May – June", fr: "Mai – juin", es: "Mayo – junio" },
          ...priced(65.48),
        },
        {
          key: "summer_weed_control",
          name: { en: "Summer weed control", fr: "Gestion des mauvaises herbes – été", es: "Control de malezas de verano" },
          description: { en: "A second pass on the weeds that come up with the heat.", fr: "Un second passage sur les mauvaises herbes qui apparaissent avec la chaleur.", es: "Una segunda pasada sobre las malezas que brotan con el calor." },
          window: { en: "June – July", fr: "Juin – juillet", es: "Junio – julio" },
          ...priced(65.48),
        },
        {
          key: "surface_insect_control",
          name: { en: "Surface insect control", fr: "Contrôle des insectes de surface", es: "Control de insectos de superficie" },
          description: { en: "Chinch bugs and other surface feeders treated before they brown the lawn.", fr: "Punaises velues et autres insectes de surface traités avant qu'ils ne brunissent la pelouse.", es: "Chinches y otros insectos de superficie tratados antes de que amarilleen el césped." },
          window: { en: "July", fr: "Juillet", es: "Julio" },
          ...priced(65.48),
        },
        {
          key: "summer_fertilizer",
          name: { en: "Summer granular fertilizer", fr: "Fertilisation granulaire d'été", es: "Fertilizante granular de verano" },
          description: { en: "A slow-release feed to carry the lawn through the dry weeks.", fr: "Un engrais à libération lente pour soutenir la pelouse pendant les semaines sèches.", es: "Una alimentación de liberación lenta para sostener el césped durante las semanas secas." },
          window: { en: "July – August", fr: "Juillet – août", es: "Julio – agosto" },
          ...priced(65.48),
        },
        {
          key: "fall_weed_and_fertilizer",
          name: { en: "Fall weed control & fertilizer", fr: "Mauvaises herbes et fertilisation d'automne", es: "Control de malezas y fertilizante de otoño" },
          description: { en: "The last visit of the season: weed control and the winterizing feed together.", fr: "La dernière visite de la saison : gestion des mauvaises herbes et fertilisation hivernale ensemble.", es: "La última visita de la temporada: control de malezas y la alimentación de invierno juntos." },
          window: { en: "September – October", fr: "Septembre – octobre", es: "Septiembre – octubre" },
          ...priced(65.48),
        },
      ],
    },
  ],
  addOns: [
    {
      key: "aeration_fall",
      kind: "service",
      name: { en: "Aeration (Fall)", fr: "Aération (automne)", es: "Aireación (otoño)" },
      description: {
        en: "Core aeration pulls plugs of soil out of the lawn so water, air and fertilizer reach the roots. Best done in fall, when the grass is recovering from summer.",
        fr: "L'aération par carottage retire des carottes de sol pour que l'eau, l'air et l'engrais atteignent les racines. Idéale à l'automne, quand le gazon se remet de l'été.",
        es: "La aireación con extracción de núcleos saca tapones de tierra del césped para que el agua, el aire y el fertilizante lleguen a las raíces. Mejor en otoño, cuando la hierba se recupera del verano.",
      },
      window: { en: "September – October", fr: "Septembre – octobre", es: "Septiembre – octubre" },
      ...priced(111.73), // Gatineau 2026: 99.93
    },
    {
      key: "grub_control_preventative",
      kind: "service",
      name: { en: "Grub Control (Preventative)", fr: "Contrôle des vers blancs (préventif)", es: "Control de gusanos blancos (preventivo)" },
      description: {
        en: "A preventative treatment applied before grubs hatch, so the larvae never get to feed on the roots — the damage shows as dead patches that lift like carpet.",
        fr: "Un traitement préventif appliqué avant l'éclosion des vers blancs, pour que les larves ne se nourrissent jamais des racines — les dégâts se voient en plaques mortes qui se soulèvent comme un tapis.",
        es: "Un tratamiento preventivo aplicado antes de que eclosionen los gusanos, para que las larvas nunca lleguen a alimentarse de las raíces — el daño aparece como parches muertos que se levantan como una alfombra.",
      },
      window: { en: "June – July", fr: "Juin – juillet", es: "Junio – julio" },
      ...priced(147.48), // Gatineau 2026: 151.16
    },
    {
      key: "aeration_overseeding_fall",
      kind: "service",
      name: { en: "Aeration and Overseeding (Fall)", fr: "Aération et sursemis (automne)", es: "Aireación y resiembra (otoño)" },
      description: {
        en: "Core aeration followed by a spread of quality grass seed into the open holes, to thicken a thin lawn and crowd out weeds next year.",
        fr: "Aération par carottage suivie d'un sursemis de semences de qualité dans les trous ouverts, pour densifier une pelouse clairsemée et étouffer les mauvaises herbes l'an prochain.",
        es: "Aireación con extracción de núcleos seguida de una resiembra con semilla de calidad en los orificios abiertos, para engrosar un césped ralo y desplazar las malezas el próximo año.",
      },
      window: { en: "September – October", fr: "Septembre – octobre", es: "Septiembre – octubre" },
      ...priced(230.66),
    },
    {
      key: "natural_crabgrass_control",
      kind: "service",
      name: { en: "Natural Crabgrass Control", fr: "Contrôle naturel de la digitaire", es: "Control natural de la garranchuelo" },
      description: {
        en: "A corn-gluten pre-emergent applied in early spring to stop crabgrass seed germinating along driveways and sidewalks.",
        fr: "Un pré-levée à base de gluten de maïs appliqué tôt au printemps pour empêcher la digitaire de germer le long des entrées et des trottoirs.",
        es: "Un preemergente a base de gluten de maíz aplicado a principios de primavera para impedir que la semilla de garranchuelo germine junto a entradas y aceras.",
      },
      window: { en: "April – May", fr: "Avril – mai", es: "Abril – mayo" },
      ...priced(146.11),
    },
    {
      key: "natural_grub_control",
      kind: "service",
      name: { en: "Natural Grub Control", fr: "Contrôle naturel des vers blancs", es: "Control natural de gusanos blancos" },
      description: {
        en: "Beneficial nematodes watered into the lawn to control grubs without a synthetic insecticide.",
        fr: "Des nématodes bénéfiques arrosés dans la pelouse pour contrôler les vers blancs sans insecticide de synthèse.",
        es: "Nematodos beneficiosos regados en el césped para controlar los gusanos blancos sin un insecticida sintético.",
      },
      window: { en: "August – September", fr: "Août – septembre", es: "Agosto – septiembre" },
      ...priced(186.94),
    },
    {
      key: "aeration_spring",
      kind: "service",
      name: { en: "Spring Aeration", fr: "Aération de printemps", es: "Aireación de primavera" },
      description: {
        en: "Core aeration in spring, to relieve the compaction winter leaves behind and let the first fertilizer reach the roots.",
        fr: "Aération par carottage au printemps, pour soulager le compactage laissé par l'hiver et laisser la première fertilisation atteindre les racines.",
        es: "Aireación con extracción de núcleos en primavera, para aliviar la compactación que deja el invierno y permitir que el primer fertilizante llegue a las raíces.",
      },
      window: { en: "April – May", fr: "Avril – mai", es: "Abril – mayo" },
      ...priced(125.66),
    },
    {
      key: "aeration_overseeding_spring",
      kind: "service",
      name: { en: "Spring Aeration and Overseeding", fr: "Aération et sursemis de printemps", es: "Aireación y resiembra de primavera" },
      description: {
        en: "Spring core aeration with grass seed spread into the holes, for a lawn that needs thickening before summer.",
        fr: "Aération par carottage au printemps avec sursemis dans les trous, pour une pelouse à densifier avant l'été.",
        es: "Aireación con extracción de núcleos en primavera con semilla esparcida en los orificios, para un césped que necesita engrosarse antes del verano.",
      },
      window: { en: "April – May", fr: "Avril – mai", es: "Abril – mayo" },
      ...priced(274.7),
    },
    {
      key: "crack_and_crevice",
      kind: "program",
      name: { en: "Crack and Crevice Control", fr: "Contrôle des fissures et interstices", es: "Control de grietas y fisuras" },
      description: {
        en: "A season-long program keeping weeds and grass out of the cracks in driveways, walkways, patios and interlock.",
        fr: "Un programme pour toute la saison qui garde les mauvaises herbes hors des fissures des entrées, allées, patios et pavés.",
        es: "Un programa de toda la temporada que mantiene las malezas y la hierba fuera de las grietas de entradas, senderos, patios y adoquines.",
      },
      window: { en: "May – September", fr: "Mai – septembre", es: "Mayo – septiembre" },
      ...priced(106.02), // Gatineau 2026 "Programme de contrôle de végétation": 69.58
    },
    {
      key: "mosquito_control",
      kind: "program",
      name: { en: "Mosquito Control", fr: "Contrôle des moustiques", es: "Control de mosquitos" },
      description: {
        en: "Regular treatments of the shrubs, beds and shaded areas where mosquitoes rest, through the months you actually use the yard.",
        fr: "Des traitements réguliers des arbustes, plates-bandes et zones ombragées où les moustiques se reposent, pendant les mois où vous profitez de la cour.",
        es: "Tratamientos regulares de los arbustos, canteros y zonas de sombra donde descansan los mosquitos, durante los meses en que realmente usa el jardín.",
      },
      window: { en: "June – September", fr: "Juin – septembre", es: "Junio – septiembre" },
      ...priced(96.9),
    },
    {
      key: "perimeter_pest_control",
      kind: "program",
      name: { en: "Tick Control / Perimeter Pest Control", fr: "Contrôle des tiques / périmètre", es: "Control de garrapatas / perímetro" },
      description: {
        en: "A barrier treatment around the edge of the property and the foundation, for ticks, ants, spiders and the crawling insects that come in from the treeline.",
        fr: "Un traitement barrière le long du périmètre et des fondations, contre les tiques, fourmis, araignées et insectes rampants venant de la lisière boisée.",
        es: "Un tratamiento de barrera alrededor del borde de la propiedad y los cimientos, contra garrapatas, hormigas, arañas y los insectos rastreros que llegan desde la arboleda.",
      },
      window: { en: "May – September", fr: "Mai – septembre", es: "Mayo – septiembre" },
      ...priced(141.55),
    },
  ],
};
