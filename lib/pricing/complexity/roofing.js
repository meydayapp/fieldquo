// lib/pricing/complexity/roofing.js
//
// What makes a roof harder than the last one.
//
// Roofing already measures most of this — lib/pricing/roofLabour.js reads the
// pitch band, the layers, the valleys and the skylights off the takeoff and
// itemises hours for each. So why ask again?
//
// Because those are QUANTITIES and this is CONDITION. roofLabour knows there
// are 40 feet of valley; it does not know the driveway ends 60 feet from the
// eave, that the deck is 1965 plank with rot through it, or that the chimney
// needs rebuilding before anything is flashed to it. Those do not change the
// count of anything — they change how long the same count takes.
//
// The overlap is deliberate and it is not double-counting: `pitch`, `storeys`
// and `layers` appear here as CONDITION BANDS whose weight moves the level,
// while the takeoff's own numbers still drive roofLabour's itemised hours.
// The level's multiplier is applied once, to the total, in tradeLabourHours().
//
// Same provenance caveat as stairs: the weights are an opening position, not a
// measurement. Nobody has timed a 12/12 against a 4/12 to produce the 4 below.

const ROOFING_COMPLEXITY = {
  trade: "roofing_service",
  label: { en: "Roof complexity", fr: "Complexité de la toiture", es: "Complejidad del tejado" },

  // Against a maximum of 27. Lower than stairs because fewer factors carry
  // more weight each: a second storey on a roof is a bigger step than an open
  // side on a staircase.
  thresholds: { moderate: 2, complex: 6, specialty: 16 },

  factors: [
    {
      key: "pitch",
      label: { en: "Pitch", fr: "Pente", es: "Pendiente" },
      options: [
        {
          value: "walkable",
          weight: 0,
          label: { en: "Walkable, up to 6/12", fr: "Praticable, jusqu'à 6/12", es: "Transitable, hasta 6/12" },
        },
        {
          value: "steep",
          weight: 2,
          label: { en: "Steep, 7/12 to 9/12", fr: "Abrupte, 7/12 à 9/12", es: "Empinada, 7/12 a 9/12" },
          reason: {
            en: "Steep pitch — roof jacks and planks staged up the slope before any shingle is touched",
            fr: "Pente abrupte — crochets et madriers installés dans la pente avant de toucher au bardeau",
            es: "Pendiente empinada — soportes y tablones montados en la pendiente antes de tocar una teja",
          },
        },
        {
          value: "very_steep",
          weight: 4,
          label: { en: "Very steep, 10/12 and up", fr: "Très abrupte, 10/12 et plus", es: "Muy empinada, 10/12 o más" },
          reason: {
            en: "Very steep pitch — full staging and fall arrest for the whole crew, and nothing is carried up by hand",
            fr: "Pente très abrupte — échafaudage complet et antichute pour toute l'équipe, rien ne monte à la main",
            es: "Pendiente muy empinada — andamiaje completo y sistema anticaídas para todo el equipo, nada se sube a mano",
          },
        },
      ],
    },
    {
      key: "storeys",
      label: { en: "Storeys", fr: "Étages", es: "Plantas" },
      options: [
        {
          value: "one",
          weight: 0,
          label: { en: "One", fr: "Un", es: "Una" },
        },
        {
          value: "two",
          weight: 2,
          label: { en: "Two", fr: "Deux", es: "Dos" },
          reason: {
            en: "Two-storey roof — longer ladders, a higher staging and every bundle lifted further",
            fr: "Toiture à deux étages — échelles plus longues, montage plus haut et chaque paquet monté plus loin",
            es: "Tejado de dos plantas — escaleras más largas, montaje más alto y cada paquete subido más lejos",
          },
        },
        {
          value: "three_plus",
          weight: 4,
          label: { en: "Three or more", fr: "Trois ou plus", es: "Tres o más" },
          reason: {
            en: "Three storeys or more — a lift or boom is brought in to get material up and debris down safely",
            fr: "Trois étages ou plus — un monte-charge est amené pour monter le matériel et descendre les débris en sécurité",
            es: "Tres plantas o más — se trae un elevador para subir el material y bajar los escombros con seguridad",
          },
        },
      ],
    },
    {
      key: "layers",
      label: { en: "Layers to tear off", fr: "Couches à arracher", es: "Capas a retirar" },
      options: [
        {
          value: "one_or_bare",
          weight: 0,
          label: { en: "One, or a bare deck", fr: "Une, ou support nu", es: "Una, o soporte desnudo" },
        },
        {
          value: "two",
          weight: 2,
          label: { en: "Two", fr: "Deux", es: "Dos" },
          reason: {
            en: "Two layers of old roofing stripped and hauled away",
            fr: "Deux couches de vieille toiture arrachées et évacuées",
            es: "Dos capas de tejado viejo retiradas y llevadas al vertedero",
          },
        },
        {
          value: "three_plus",
          weight: 4,
          label: { en: "Three or more", fr: "Trois ou plus", es: "Tres o más" },
          reason: {
            en: "Three or more layers stripped — extra disposal loads and a deck that has to be re-nailed once it is clear",
            fr: "Trois couches ou plus arrachées — voyages de rebuts supplémentaires et support à reclouer une fois dégagé",
            es: "Tres capas o más retiradas — viajes extra al vertedero y un soporte que hay que reclavar al quedar limpio",
          },
        },
      ],
    },
    {
      key: "access",
      label: { en: "Site access", fr: "Accès au chantier", es: "Acceso al sitio" },
      options: [
        {
          value: "driveway",
          weight: 0,
          label: { en: "Truck to the eave", fr: "Camion jusqu'à l'avant-toit", es: "Camión hasta el alero" },
        },
        {
          value: "tight",
          weight: 1,
          label: { en: "Tight or landscaped", fr: "Restreint ou aménagé", es: "Estrecho o ajardinado" },
          reason: {
            en: "Tight access past landscaping — the garden is boarded and protected and material is carried in",
            fr: "Accès restreint autour de l'aménagement — le jardin est protégé et le matériel est transporté à la main",
            es: "Acceso estrecho junto al jardín — se protege la zona ajardinada y el material se entra a mano",
          },
        },
        {
          value: "no_truck",
          weight: 3,
          label: { en: "No truck access", fr: "Aucun accès camion", es: "Sin acceso de camión" },
          reason: {
            en: "No truck access at the house — every bundle in and every load of debris out is moved by hand",
            fr: "Aucun accès camion à la maison — chaque paquet entrant et chaque charge de débris sortant est déplacé à la main",
            es: "Sin acceso de camión en la casa — cada paquete que entra y cada carga de escombros que sale se mueve a mano",
          },
        },
      ],
    },
    {
      key: "cutUp",
      label: { en: "Valleys, dormers, skylights", fr: "Noues, lucarnes, puits de lumière", es: "Limahoyas, buhardillas, claraboyas" },
      options: [
        {
          value: "simple",
          weight: 0,
          label: { en: "Simple gable, few penetrations", fr: "Pignon simple, peu de pénétrations", es: "Hastial simple, pocas penetraciones" },
        },
        {
          value: "valleys_dormers",
          weight: 2,
          label: { en: "Valleys and a dormer or two", fr: "Noues et une ou deux lucarnes", es: "Limahoyas y una o dos buhardillas" },
          reason: {
            en: "Valleys and dormers — each one is cut, lined and woven in by hand",
            fr: "Noues et lucarnes — chacune est coupée, doublée et tissée à la main",
            es: "Limahoyas y buhardillas — cada una se corta, se forra y se entrelaza a mano",
          },
        },
        {
          value: "cut_up",
          weight: 4,
          label: {
            en: "Cut-up roof with skylights",
            fr: "Toiture découpée avec puits de lumière",
            es: "Tejado muy recortado con claraboyas",
          },
          reason: {
            en: "Cut-up roof with skylights — every skylight is stripped, re-flashed and water-tested, and the offcut waste is far higher",
            fr: "Toiture découpée avec puits de lumière — chacun est démonté, resolinné et testé à l'eau, et les chutes sont bien plus nombreuses",
            es: "Tejado muy recortado con claraboyas — cada una se desmonta, se rehace su tapajuntas y se prueba con agua, y hay mucho más recorte",
          },
        },
      ],
    },
    {
      key: "deck",
      label: { en: "Deck condition", fr: "État du support", es: "Estado del soporte" },
      options: [
        {
          value: "sound",
          weight: 0,
          label: { en: "Sound", fr: "Sain", es: "En buen estado" },
        },
        {
          value: "spot_rot",
          weight: 2,
          label: { en: "Spot rot", fr: "Pourriture localisée", es: "Pudrición puntual" },
          reason: {
            en: "Rotten sheets cut out and replaced as they are found under the old roofing",
            fr: "Panneaux pourris découpés et remplacés à mesure qu'ils apparaissent sous la vieille toiture",
            es: "Tableros podridos recortados y sustituidos según aparecen bajo el tejado viejo",
          },
        },
        {
          value: "widespread",
          weight: 4,
          label: { en: "Widespread replacement", fr: "Remplacement généralisé", es: "Sustitución generalizada" },
          reason: {
            en: "Deck replaced across the roof — the old boards come off with the shingles and a new deck goes down before anything else",
            fr: "Support remplacé sur toute la toiture — les vieilles planches partent avec les bardeaux et un nouveau support est posé avant tout le reste",
            es: "Soporte sustituido en todo el tejado — las tablas viejas salen con las tejas y se coloca un soporte nuevo antes que nada",
          },
        },
      ],
    },
    {
      key: "chimneyFlashing",
      label: { en: "Chimney & flashing", fr: "Cheminée et solins", es: "Chimenea y tapajuntas" },
      options: [
        {
          value: "none_or_reuse",
          weight: 0,
          label: { en: "None, or reuse what is there", fr: "Aucun, ou réutiliser l'existant", es: "Ninguno, o reutilizar lo existente" },
        },
        {
          value: "new_flashing",
          weight: 2,
          label: { en: "New step and counter flashing", fr: "Nouveaux solins à gradins et contre-solins", es: "Tapajuntas escalonado y contratapajuntas nuevos" },
          reason: {
            en: "New step and counter flashing cut into the chimney and sealed — the joint most roofs leak at, done properly",
            fr: "Nouveaux solins à gradins et contre-solins encastrés dans la cheminée et scellés — le joint où la plupart des toitures coulent, fait correctement",
            es: "Tapajuntas escalonado y contratapajuntas nuevos encastrados en la chimenea y sellados — la junta por donde gotean la mayoría de los tejados, bien hecha",
          },
        },
        {
          value: "rebuild_or_specialty",
          weight: 4,
          label: { en: "Chimney rebuild or specialty metal", fr: "Reconstruction de cheminée ou métal spécialisé", es: "Reconstrucción de chimenea o metal especial" },
          reason: {
            en: "Masonry and specialty metalwork at the chimney before the roof can be closed in around it",
            fr: "Maçonnerie et ferblanterie spécialisée à la cheminée avant que la toiture puisse être refermée autour",
            es: "Albañilería y trabajo de metal especial en la chimenea antes de poder cerrar el tejado a su alrededor",
          },
        },
      ],
    },
  ],
};

export default ROOFING_COMPLEXITY;
