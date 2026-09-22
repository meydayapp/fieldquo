// lib/quotes/textBlockDefaults.js
//
// The blocks a painting company's library opens with, in English, French
// and Spanish — hand-written, not machine-drafted, so the first thing a
// homeowner reads on a French quote was read by a person first.
//
// ── Seeding rules ───────────────────────────────────────────────────────────
//
// Seeded ONCE per company, the first time the library is read for a company
// that has a painting trade switched on and no blocks yet
// (lib/quotes/textBlockSeed.js). Each row keeps its `seedKey`, so a company
// that deletes "Painter for a day" is not handed it back, and a company that
// has written its own blocks is never seeded at all — their library is
// theirs. Nothing here is padded onto a non-painting company: a plumber's
// library opens empty, which is the truth about what we have written for
// them.
//
// The block is stored in the company's own default language with the other
// two as stored translations, so a bilingual Quebec painter's French quote
// and English quote read the same nine blocks with no AI call and nothing to
// review.
//
// ── Prices ──────────────────────────────────────────────────────────────────
//
// Only the popcorn rate carries a number, and it is the same 3.50/sqft the
// pre-area-model complexity book has always charged
// (app/data/tradePriceBooks.js popcornRemovalPricePerSqft). "Painter for a
// day" is hourly at whatever rate the estimator types (the dialog prefills
// the trade's hourly sell rate); the paint upgrade is per gallon at a price
// the company sets, because a premium line's uplift is theirs to know. A
// number we invented would be a rate card we published.

export const TEXT_BLOCK_SEED_LANGUAGES = Object.freeze(["en", "fr", "es"]);

/** Trades whose companies get these defaults. */
export const PAINTING_CATEGORY_KEYS = Object.freeze([
  "interior_painting",
  "exterior_painting",
  "painting",
  "cabinet_refinishing",
]);

export const DEFAULT_TEXT_BLOCKS = Object.freeze([
  {
    seedKey: "interior_prep",
    priceMode: "none",
    hiddenOnWorkOrder: false,
    tags: ["painting", "interior"],
    text: {
      en: {
        name: "Interior preparation",
        body: "Furniture is moved to the centre of the room or covered, and floors are protected with drop sheets. Nail holes and small dents are filled, gaps at trim are caulked, surfaces are sanded and spot-primed before two finish coats.",
      },
      fr: {
        name: "Préparation intérieure",
        body: "Les meubles sont déplacés au centre de la pièce ou recouverts, et les planchers sont protégés par des toiles. Les trous de clous et les petites bosses sont remplis, les joints des moulures sont calfeutrés, les surfaces sont sablées et apprêtées localement avant deux couches de finition.",
      },
      es: {
        name: "Preparación interior",
        body: "Los muebles se mueven al centro de la habitación o se cubren, y los pisos se protegen con lonas. Se rellenan los agujeros de clavos y las abolladuras pequeñas, se sellan las juntas de las molduras, se lijan las superficies y se aplica imprimación en puntos antes de dos capas de acabado.",
      },
    },
  },
  {
    seedKey: "daily_setup_cleanup",
    priceMode: "none",
    hiddenOnWorkOrder: false,
    tags: ["painting"],
    text: {
      en: {
        name: "Daily set-up and clean-up",
        body: "Each day the crew sets up on arrival and tidies before leaving: tools and materials are stored together, walkways are cleared, and any dust is vacuumed. Your home stays livable throughout the job.",
      },
      fr: {
        name: "Installation et nettoyage quotidiens",
        body: "Chaque jour, l'équipe s'installe à l'arrivée et range avant de partir : outils et matériaux sont regroupés, les passages sont dégagés et la poussière est aspirée. Votre maison reste habitable pendant toute la durée des travaux.",
      },
      es: {
        name: "Instalación y limpieza diarias",
        body: "Cada día el equipo se instala al llegar y ordena antes de irse: las herramientas y los materiales se guardan juntos, los pasillos quedan despejados y se aspira el polvo. Su casa sigue siendo habitable durante todo el trabajo.",
      },
    },
  },
  {
    seedKey: "final_walkthrough",
    priceMode: "none",
    hiddenOnWorkOrder: false,
    tags: ["painting"],
    text: {
      en: {
        name: "Final walkthrough",
        body: "When the work is finished we walk every room with you. Anything you point out is touched up before we leave, and the final invoice is only issued once you are satisfied.",
      },
      fr: {
        name: "Inspection finale",
        body: "Une fois les travaux terminés, nous faisons le tour de chaque pièce avec vous. Tout ce que vous signalez est retouché avant notre départ, et la facture finale n'est émise qu'une fois que vous êtes satisfait.",
      },
      es: {
        name: "Recorrido final",
        body: "Al terminar el trabajo recorremos cada habitación con usted. Todo lo que señale se retoca antes de irnos, y la factura final solo se emite cuando esté satisfecho.",
      },
    },
  },
  {
    seedKey: "exclusions",
    priceMode: "none",
    hiddenOnWorkOrder: true,
    tags: ["painting", "terms"],
    text: {
      en: {
        name: "Exclusions",
        body: "This quote does not include:\n- Repair of water damage, mould or structural cracks\n- Removal or reinstallation of fixtures, appliances or built-ins\n- Wallpaper removal unless listed above\n- Paint for surfaces not listed above\n\nAnything found once the work starts is priced separately and agreed before it is done.",
      },
      fr: {
        name: "Exclusions",
        body: "Cette soumission ne comprend pas :\n- La réparation des dégâts d'eau, de moisissure ou de fissures structurelles\n- Le retrait ou la réinstallation de luminaires, d'électroménagers ou d'éléments encastrés\n- L'enlèvement de papier peint, sauf s'il est indiqué ci-dessus\n- La peinture des surfaces non indiquées ci-dessus\n\nTout ce qui est découvert une fois les travaux commencés est évalué séparément et convenu avant d'être exécuté.",
      },
      es: {
        name: "Exclusiones",
        body: "Esta cotización no incluye:\n- Reparación de daños por agua, moho o grietas estructurales\n- Retiro o reinstalación de accesorios, electrodomésticos o muebles empotrados\n- Retiro de papel tapiz salvo que se indique arriba\n- Pintura para superficies no indicadas arriba\n\nCualquier cosa que se descubra una vez iniciado el trabajo se cotiza por separado y se acuerda antes de hacerse.",
      },
    },
  },
  {
    seedKey: "deposit_information",
    priceMode: "none",
    hiddenOnWorkOrder: true,
    tags: ["terms"],
    text: {
      en: {
        name: "Deposit information",
        body: "A deposit is due when you approve this quote and reserves your start date. The balance is invoiced when the work is complete. Your deposit is fully refundable until materials are ordered.",
      },
      fr: {
        name: "Renseignements sur l'acompte",
        body: "Un acompte est exigible à l'approbation de cette soumission et réserve votre date de début. Le solde est facturé à la fin des travaux. Votre acompte est entièrement remboursable jusqu'à la commande des matériaux.",
      },
      es: {
        name: "Información sobre el depósito",
        body: "El depósito se paga al aprobar esta cotización y reserva su fecha de inicio. El saldo se factura cuando el trabajo esté terminado. Su depósito es totalmente reembolsable hasta que se pidan los materiales.",
      },
    },
  },
  {
    seedKey: "paint_upgrade",
    priceMode: "quantity",
    unit: "gal",
    price: null,
    hiddenOnWorkOrder: false,
    tags: ["painting", "upgrade"],
    text: {
      en: {
        name: "Paint upgrade",
        body: "Upgrade to a premium washable line for the rooms above. Better hide, a more even sheen and a finish that stands up to scrubbing in kitchens, hallways and children's rooms.",
      },
      fr: {
        name: "Peinture de qualité supérieure",
        body: "Passez à une gamme lavable haut de gamme pour les pièces ci-dessus. Meilleur pouvoir couvrant, lustre plus uniforme et fini qui résiste au récurage dans les cuisines, les couloirs et les chambres d'enfants.",
      },
      es: {
        name: "Pintura de gama superior",
        body: "Cambie a una línea lavable de alta calidad para las habitaciones indicadas. Mayor cubrimiento, un brillo más uniforme y un acabado que resiste el fregado en cocinas, pasillos y habitaciones infantiles.",
      },
    },
  },
  {
    seedKey: "popcorn_removal",
    priceMode: "quantity",
    unit: "sqft",
    price: 3.5,
    hiddenOnWorkOrder: false,
    tags: ["painting", "interior", "ceiling"],
    text: {
      en: {
        name: "Popcorn ceiling removal",
        body: "We scrape the stipple, skim-coat and sand the ceiling smooth, then prime before the finish coats. **Asbestos:** ceilings installed before 1990 are tested first; removal waits for the result.",
      },
      fr: {
        name: "Enlèvement de plafond texturé",
        body: "Nous grattons le stucco, appliquons un enduit de lissage et sablons le plafond, puis apprêtons avant les couches de finition. **Amiante :** les plafonds installés avant 1990 sont d'abord testés ; l'enlèvement attend le résultat.",
      },
      es: {
        name: "Retiro de cielo raso texturizado",
        body: "Raspamos la textura, aplicamos pasta niveladora y lijamos el cielo raso hasta dejarlo liso, luego imprimamos antes de las capas de acabado. **Asbesto:** los cielos rasos instalados antes de 1990 se analizan primero; el retiro espera el resultado.",
      },
    },
  },
  {
    seedKey: "painter_for_a_day",
    priceMode: "hourly",
    price: null,
    hiddenOnWorkOrder: false,
    tags: ["painting"],
    text: {
      en: {
        name: "Painter for a day",
        body: "One painter for the hours listed, for the small jobs that never make it onto a quote: a scuffed door, a stairwell wall, a touch-up list. Paint and supplies are extra.",
      },
      fr: {
        name: "Peintre à la journée",
        body: "Un peintre pour le nombre d'heures indiqué, pour les petits travaux qui ne figurent jamais dans une soumission : une porte éraflée, un mur de cage d'escalier, une liste de retouches. La peinture et les fournitures sont en sus.",
      },
      es: {
        name: "Pintor por un día",
        body: "Un pintor por las horas indicadas, para los trabajos pequeños que nunca llegan a una cotización: una puerta rayada, una pared de escalera, una lista de retoques. La pintura y los materiales se cobran aparte.",
      },
    },
  },
  {
    seedKey: "colour_consult",
    priceMode: "custom",
    price: 0,
    hiddenOnWorkOrder: true,
    tags: ["painting", "upgrade"],
    text: {
      en: {
        name: "Complimentary colour consult",
        body: "A one-hour visit before we start to choose colours and sheens room by room, with sample pots on your own walls. Included with this quote.",
      },
      fr: {
        name: "Consultation couleur offerte",
        body: "Une visite d'une heure avant le début des travaux pour choisir les couleurs et les lustres pièce par pièce, avec des échantillons sur vos propres murs. Incluse avec cette soumission.",
      },
      es: {
        name: "Asesoría de color de cortesía",
        body: "Una visita de una hora antes de empezar para elegir colores y brillos habitación por habitación, con muestras en sus propias paredes. Incluida con esta cotización.",
      },
    },
  },
]);

/**
 * The rows to insert for a company: each default in the company's language
 * with the other two seeded as reviewed translations.
 *
 * @param language  the company's default language; anything outside the
 *                  three shipped languages stores English as the source and
 *                  the other two as translations, which is honest — nothing
 *                  here was written in Punjabi.
 */
export function seedRowsFor(companyId, language) {
  const source = TEXT_BLOCK_SEED_LANGUAGES.includes(language) ? language : "en";
  return DEFAULT_TEXT_BLOCKS.map((d, i) => {
    const translations = {};
    for (const code of TEXT_BLOCK_SEED_LANGUAGES) {
      if (code !== source) translations[code] = { ...d.text[code] };
    }
    return {
      companyId,
      seedKey: d.seedKey,
      name: d.text[source].name,
      body: d.text[source].body,
      priceMode: d.priceMode,
      price: d.price ?? null,
      unit: d.unit ?? null,
      hiddenOnWorkOrder: d.hiddenOnWorkOrder,
      language: source,
      translations,
      tags: [...d.tags],
      sortOrder: i,
    };
  });
}
