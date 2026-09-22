// app/data/serviceSeeds/snow_removal.js
//
// The service list a snow-removal company starts from. Read the header of
// ./index.js for the format and the rules every file in this folder follows.
//
// The seasonal-contract prices (single / double / triple driveway, basic and
// premium) live in the snow_removal price book (app/data/tradePriceBooks.js)
// and are priced from the takeoff; nothing here restates them. These are the
// one-off and per-visit services a company sells beside the contract.
//
// No benchmark exists for any of these: the capture carried no pricing insight
// for the trade. Every `benchmark` is null on purpose, and the UI says "set
// your rate" rather than inventing a number.

export const SEED = {
  trade: "snow_removal",
  categories: [
    {
      key: "removal",
      name: { en: "Snow removal", fr: "Déneigement", es: "Retiro de nieve" },
    },
  ],
  services: [
    {
      seedKey: "fq.snow_removal.removal.shoveling",
      category: "removal",
      name: {
        en: "Snow shovelling — walkways and steps",
        fr: "Pelletage — allées et marches",
        es: "Paleo de nieve — senderos y escalones",
      },
      description: {
        en: "Hand-clearing of walkways, steps and entrances after a snowfall so every door stays safe to reach.",
        fr: "Dégagement à la pelle des allées, marches et entrées après une bordée, pour que chaque porte reste accessible sans danger.",
        es: "Retiro manual de la nieve en senderos, escalones y entradas después de una nevada, para que cada puerta siga siendo segura de alcanzar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "The seasonal shovelling plan is priced in the snow_removal price book; this is the one-off visit.",
    },
    {
      seedKey: "fq.snow_removal.removal.plowing",
      category: "removal",
      name: {
        en: "Driveway plowing — per visit",
        fr: "Déneigement de l'entrée à la charrue — par visite",
        es: "Despeje de entrada con pala mecánica — por visita",
      },
      description: {
        en: "One plow pass of the driveway and apron after a snowfall, with the pile pushed clear of the garage and the street line.",
        fr: "Un passage de charrue dans l'entrée et le tablier après une bordée, la neige poussée hors de la porte de garage et de la ligne de rue.",
        es: "Una pasada de pala mecánica por la entrada y el acceso después de una nevada, con la nieve empujada lejos del garaje y de la línea de la calle.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "Seasonal plowing contracts (single/double/triple driveway) are priced in the snow_removal price book.",
    },
    {
      seedKey: "fq.snow_removal.removal.blowing",
      category: "removal",
      name: {
        en: "Snow blowing — per visit",
        fr: "Soufflage de neige — par visite",
        es: "Soplado de nieve — por visita",
      },
      description: {
        en: "Driveway and walkways cleared with a snow blower, the snow thrown onto the lawn rather than banked at the street.",
        fr: "Entrée et allées dégagées à la souffleuse, la neige projetée sur la pelouse plutôt qu'entassée à la rue.",
        es: "Entrada y senderos despejados con soplador de nieve, con la nieve lanzada al césped en lugar de acumularse en la calle.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.snow_removal.removal.hauling",
      category: "removal",
      name: {
        en: "Snow removal and hauling",
        fr: "Enlèvement et transport de la neige",
        es: "Retiro y acarreo de nieve",
      },
      description: {
        en: "Accumulated snow loaded and trucked off the property when there is nowhere left to push it — priced per load.",
        fr: "Neige accumulée chargée et transportée hors du terrain quand il n'y a plus d'espace pour la pousser — facturé par chargement.",
        es: "Nieve acumulada cargada y transportada fuera de la propiedad cuando ya no hay dónde empujarla — por carga.",
      },
      unit: "each",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.snow_removal.removal.banking",
      category: "removal",
      name: {
        en: "Snow banking and pile relocation",
        fr: "Mise en banc et déplacement des amas de neige",
        es: "Acumulación y reubicación de montículos de nieve",
      },
      description: {
        en: "Piles moved with a loader to open up parking, sightlines and drainage paths on the property.",
        fr: "Amas déplacés à la chargeuse pour libérer le stationnement, la visibilité et les chemins d'écoulement sur le terrain.",
        es: "Montículos reubicados con cargador para liberar estacionamiento, visibilidad y vías de drenaje en la propiedad.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      // The source's "Something else / I don't know" row, kept so the owner's
      // row-by-row validation joins back cleanly — as the honest catch-all a
      // booking form needs, not as a job with a price.
      seedKey: "fq.snow_removal.removal.other",
      category: "removal",
      name: {
        en: "Other snow work — describe what you need",
        fr: "Autre travail de déneigement — décrivez le besoin",
        es: "Otro trabajo de nieve — describa lo que necesita",
      },
      description: {
        en: "Anything not listed above: tell us what needs clearing and we will price it on site.",
        fr: "Tout ce qui n'apparaît pas ci-dessus : dites-nous ce qu'il faut dégager et le prix sera fixé sur place.",
        es: "Cualquier cosa que no aparezca arriba: cuéntenos qué hay que despejar y se cotiza en el sitio.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
  ],
};
