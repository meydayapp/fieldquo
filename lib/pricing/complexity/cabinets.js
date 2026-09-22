// lib/pricing/complexity/cabinets.js
//
// Cabinet refinishing and refacing, moved onto the shared factor model.
//
// ── What this replaces, and what it must not break ─────────────────────────
//
// app/data/cabinetPricing.js has chips (Standard / Moderate +$20 / High +$40 /
// Custom) and a flat checklist of seventeen reasons in three headings. The
// chips priced; the checklist did not. An estimator could tick five reasons
// and leave the chip on Standard, and nothing anywhere noticed.
//
// The seventeen reasons are folded into the seven factors below — each one is
// now an ANSWER to a question, so ticking it moves the level and the level
// moves the price. Nothing is lost: every reason in the old list appears in a
// factor's wording, and the two that were really the same thing (poor
// ventilation, limited staging) became one answer because they are one
// condition of the same site.
//
// ── An existing quote must price to the cent ───────────────────────────────
//
// Old groups carry `complexityLevel` and `complexityReasons` and NO
// `complexity` object. app/data/cabinetPricing.js's finalUnitPrice() checks for
// the `factors_v1` discriminator first and falls straight through to the
// original arithmetic when it is absent, so every quote written before today
// returns the same number it always did. scripts/check-complexity.mjs asserts
// it on the real shapes, including the Custom upcharge.
//
// A NEW group on this model maps its level onto the SAME per-unit uplift grid
// the company already edits — `complexityUpchargePerUnit` on the price book.
// Standard 0, Moderate its moderate figure, Complex its high figure. That is
// deliberate: the trade's revenue model is per door, the company has already
// tuned those two numbers, and introducing a second, parallel cabinet
// surcharge would be the copy that rots.

const CABINET_COMPLEXITY = {
  trade: "cabinet_refinishing",
  label: { en: "Kitchen complexity", fr: "Complexité de la cuisine", es: "Complejidad de la cocina" },

  // Against a maximum of 20.
  thresholds: { moderate: 2, complex: 6, specialty: 15 },

  factors: [
    {
      key: "surface",
      label: { en: "Surface condition", fr: "État des surfaces", es: "Estado de las superficies" },
      options: [
        {
          value: "sound",
          weight: 0,
          label: { en: "Sound and clean", fr: "Saines et propres", es: "Sanas y limpias" },
        },
        {
          value: "worn",
          weight: 2,
          label: { en: "Worn, minor damage", fr: "Usées, dommages mineurs", es: "Desgastadas, daño menor" },
          reason: {
            en: "Scratches and dents filled and sanded flat before the first coat",
            fr: "Égratignures et bosses remplies et sablées à plat avant la première couche",
            es: "Rayones y golpes rellenados y lijados antes de la primera capa",
          },
        },
        {
          value: "failing",
          weight: 4,
          label: {
            en: "Peeling, deep or water damage",
            fr: "Écaillage, dommages profonds ou d'eau",
            es: "Descascarillado, daño profundo o por agua",
          },
          reason: {
            en: "Failing paint stripped back and water-damaged or swollen sections rebuilt before any new finish",
            fr: "Peinture écaillée décapée et sections gonflées ou abîmées par l'eau reconstruites avant tout nouveau fini",
            es: "Pintura descascarillada retirada y secciones hinchadas o dañadas por agua reconstruidas antes del nuevo acabado",
          },
        },
      ],
    },
    {
      key: "contamination",
      label: { en: "Grease & bleed-through", fr: "Graisse et saignement", es: "Grasa y sangrado" },
      options: [
        {
          value: "light",
          weight: 0,
          label: { en: "Light", fr: "Légère", es: "Ligera" },
        },
        {
          value: "heavy_grease",
          weight: 1,
          label: { en: "Heavy kitchen grease", fr: "Graisse de cuisine tenace", es: "Grasa de cocina fuerte" },
          reason: {
            en: "Multiple degreasing passes so the new finish has clean wood to hold on to",
            fr: "Plusieurs passes de dégraissage pour que le nouveau fini adhère à du bois propre",
            es: "Varias pasadas de desengrase para que el acabado nuevo agarre en madera limpia",
          },
        },
        {
          value: "bleed_risk",
          weight: 3,
          label: {
            en: "Bleed-through risk — oak tannin, pine knots",
            fr: "Risque de saignement — tanin de chêne, nœuds de pin",
            es: "Riesgo de sangrado — tanino de roble, nudos de pino",
          },
          reason: {
            en: "Stain-blocking primer over the tannins and knots so nothing bleeds through the finished colour later",
            fr: "Apprêt bloquant appliqué sur les tanins et les nœuds pour que rien ne ressorte à travers la couleur finie",
            es: "Imprimación bloqueadora sobre taninos y nudos para que nada sangre a través del color terminado",
          },
        },
      ],
    },
    {
      key: "hardware",
      label: { en: "Hardware & boxes", fr: "Quincaillerie et caissons", es: "Herrajes y cajas" },
      options: [
        {
          value: "sound",
          weight: 0,
          label: { en: "Sound", fr: "En bon état", es: "En buen estado" },
        },
        {
          value: "seized_hinges",
          weight: 1,
          label: { en: "Seized or stripped hinges", fr: "Charnières grippées ou foirées", es: "Bisagras agarrotadas o pasadas" },
          reason: {
            en: "Seized and stripped hinge screws extracted one at a time rather than forced",
            fr: "Vis de charnières grippées ou foirées extraites une à une plutôt que forcées",
            es: "Tornillos de bisagra agarrotados o pasados extraídos uno a uno en vez de forzados",
          },
        },
        {
          value: "out_of_square",
          weight: 3,
          label: { en: "Boxes out of square", fr: "Caissons hors d'équerre", es: "Cajas fuera de escuadra" },
          reason: {
            en: "Doors realigned to boxes that are no longer square, so every gap reads straight when the kitchen goes back together",
            fr: "Portes réalignées sur des caissons qui ne sont plus d'équerre, pour que chaque jeu soit droit au remontage",
            es: "Puertas realineadas a cajas que ya no están a escuadra, para que cada holgura quede recta al montar la cocina",
          },
        },
      ],
    },
    {
      key: "doorProfiles",
      label: { en: "Door profiles", fr: "Profils de portes", es: "Perfiles de puertas" },
      options: [
        {
          value: "flat_or_shaker",
          weight: 0,
          label: { en: "One profile — flat or shaker", fr: "Un seul profil — plat ou shaker", es: "Un solo perfil — liso o shaker" },
        },
        {
          value: "moulded",
          weight: 1,
          label: { en: "Raised panel or moulded", fr: "Panneau relevé ou mouluré", es: "Panel elevado o moldurado" },
          reason: {
            en: "Moulded panel doors — the profiles are sanded and sprayed by hand so the detail stays crisp",
            fr: "Portes à panneau mouluré — les profils sont sablés et pulvérisés à la main pour garder le détail net",
            es: "Puertas de panel moldurado — los perfiles se lijan y se pulverizan a mano para que el detalle quede nítido",
          },
        },
        {
          value: "mixed_and_glass",
          weight: 3,
          label: { en: "Mixed profiles, glass inserts", fr: "Profils variés, vitrages", es: "Perfiles mixtos, vidrios" },
          reason: {
            en: "Several door profiles and glass inserts — separate spray setups and every pane masked individually",
            fr: "Plusieurs profils de portes et des vitrages — montages de pulvérisation distincts et chaque vitre masquée individuellement",
            es: "Varios perfiles de puerta y vidrios — montajes de pulverizado separados y cada cristal enmascarado por separado",
          },
        },
      ],
    },
    {
      key: "site",
      label: { en: "Site conditions", fr: "Conditions du chantier", es: "Condiciones del sitio" },
      options: [
        {
          value: "empty_ventilated",
          weight: 0,
          label: { en: "Empty, well ventilated", fr: "Vide, bien ventilé", es: "Vacío, bien ventilado" },
        },
        {
          value: "occupied",
          weight: 1,
          label: { en: "Occupied home", fr: "Maison occupée", es: "Vivienda ocupada" },
          reason: {
            en: "Occupied home — the kitchen is made usable again at the end of each working day",
            fr: "Maison occupée — la cuisine est remise en état d'utilisation à la fin de chaque journée",
            es: "Vivienda ocupada — la cocina se deja utilizable al final de cada jornada",
          },
        },
        {
          value: "poor_ventilation",
          weight: 2,
          label: {
            en: "Poor ventilation, limited staging",
            fr: "Ventilation faible, espace de séchage limité",
            es: "Poca ventilación, espacio de secado limitado",
          },
          reason: {
            en: "Limited ventilation and drying space — coats are given longer to cure rather than being rushed",
            fr: "Ventilation et espace de séchage limités — les couches sèchent plus longtemps plutôt que d'être précipitées",
            es: "Ventilación y espacio de secado limitados — se da más tiempo de curado a cada capa en vez de apurarla",
          },
        },
      ],
    },
    {
      key: "access",
      label: { en: "Access", fr: "Accès", es: "Acceso" },
      options: [
        {
          value: "standard",
          weight: 0,
          label: { en: "Standard", fr: "Standard", es: "Estándar" },
        },
        {
          value: "high_uppers",
          weight: 1,
          label: { en: "High uppers — ladder work", fr: "Armoires hautes — travail d'échelle", es: "Altos elevados — trabajo de escalera" },
          reason: {
            en: "High upper cabinets worked from ladders throughout",
            fr: "Armoires hautes travaillées à l'échelle d'un bout à l'autre",
            es: "Armarios altos trabajados desde escalera de principio a fin",
          },
        },
        {
          value: "tight",
          weight: 2,
          label: { en: "Tight or awkward access", fr: "Accès restreint ou difficile", es: "Acceso estrecho o incómodo" },
          reason: {
            en: "Tight access around the run — the pieces are removed, carried and returned by hand",
            fr: "Accès restreint autour de l'ensemble — les pièces sont retirées, transportées et remises à la main",
            es: "Acceso estrecho alrededor del conjunto — las piezas se retiran, se transportan y se devuelven a mano",
          },
        },
      ],
    },
    {
      key: "colourChange",
      label: { en: "Colour direction", fr: "Changement de couleur", es: "Cambio de color" },
      options: [
        {
          value: "similar",
          weight: 0,
          label: { en: "Similar to what is there", fr: "Semblable à l'existant", es: "Similar a lo existente" },
        },
        {
          value: "light_to_dark",
          weight: 1,
          label: { en: "Light to dark", fr: "Du pâle au foncé", es: "De claro a oscuro" },
          reason: {
            en: "Going darker — an extra coat so the new colour is even across every door",
            fr: "Vers un ton plus foncé — une couche de plus pour que la couleur soit uniforme sur chaque porte",
            es: "Hacia un tono más oscuro — una capa extra para que el color quede parejo en cada puerta",
          },
        },
        {
          value: "dark_to_light",
          weight: 3,
          // Same company switch as the staircase, off by default.
          forcesWhen: "darkToLight",
          label: { en: "Dark to light", fr: "Du foncé au pâle", es: "De oscuro a claro" },
          reason: {
            en: "Dark to light — sealed and primed so the old colour cannot read through, then built back up in the new one",
            fr: "Du foncé au pâle — scellé et apprêté pour que l'ancienne couleur ne transparaisse pas, puis remonté dans la nouvelle",
            es: "De oscuro a claro — sellado e imprimado para que el color viejo no se transparente, y luego construido en el nuevo",
          },
        },
      ],
    },
  ],
};

export default CABINET_COMPLEXITY;
