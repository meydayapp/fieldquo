// app/data/serviceSeeds/interior_painting.js
//
// The service list an interior painter starts from. Read ./index.js for the
// format and the rules. Interior painting is a TAKEOFF trade: whole rooms and
// whole homes are priced per sq ft of wall, per ceiling, per door and per
// closet by lib/pricing/paintTakeoff.js and the interior_painting price book
// (app/data/tradePriceBooks.js). Those services are kept here as a reference
// with `pricedBy: "takeoff"` and are never written as a flat-priced Product;
// the add-ons, prep and specialty jobs are ordinary flat-priced services.
// Written in source order (every row of the source's painting book except its
// "Exterior Components", which are in ./exterior_painting.js).
import { L, SHARED, D, T, withTemplates, hdMaterial } from "./_templateLines";
import { PAINT } from "./_paintLines";
import { HD } from "./_materialCosts";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "interior_painting",
  categories: [
    { key: "add_ons", name: { en: "Add-on services", fr: "Services complémentaires", es: "Servicios adicionales" } },
    { key: "visits", name: { en: "Booked visits", fr: "Visites réservées", es: "Visitas agendadas" } },
    { key: "commercial", name: { en: "Commercial painting", fr: "Peinture commerciale", es: "Pintura comercial" } },
    { key: "core", name: { en: "Interior painting", fr: "Peinture intérieure", es: "Pintura interior" } },
    { key: "cabinets", name: { en: "Cabinet painting", fr: "Peinture d'armoires", es: "Pintura de gabinetes" } },
    { key: "prep", name: { en: "Prep and repair", fr: "Préparation et réparation", es: "Preparación y reparación" } },
  ],
  services: [
    S("fq.interior_painting.add_ons.touch_up", "add_ons", "flat", null,
      ["Touch-up painting", "Retouches de peinture", "Retoques de pintura"],
      ["Scuffs, chips and small damaged patches spot-primed and painted to blend with the surrounding wall.",
       "Éraflures, éclats et petites zones abîmées apprêtées localement et repeintes pour se fondre dans le mur.",
       "Rayones, desconchados y pequeñas zonas dañadas imprimadas puntualmente y pintadas para fundirse con la pared."]),
    S("fq.interior_painting.add_ons.trim_baseboard", "add_ons", "flat", null,
      ["Trim and baseboard painting", "Peinture des moulures et plinthes", "Pintura de molduras y zócalos"],
      ["Baseboards, casings and mouldings sanded, caulked and painted in a durable trim enamel.",
       "Plinthes, cadrages et moulures sablés, calfeutrés et peints avec un émail à boiseries durable.",
       "Zócalos, marcos y molduras lijados, calafateados y pintados con un esmalte durable para madera."],
      { existing: "The takeoff prices trim per room (interior_painting trimPrice)." }),
    S("fq.interior_painting.add_ons.door_painting", "add_ons", "each", null,
      ["Door painting", "Peinture de porte", "Pintura de puerta"],
      ["An interior or exterior door prepped and painted both faces and edges, hardware removed and refitted.",
       "Porte intérieure ou extérieure préparée et peinte sur les deux faces et les chants, quincaillerie retirée et reposée.",
       "Puerta interior o exterior preparada y pintada por ambas caras y cantos, con la herrería retirada y reinstalada."],
      { existing: "The takeoff prices doors each (interior_painting doorPrice)." }),
    S("fq.interior_painting.add_ons.accent_wall", "add_ons", "each", null,
      ["Accent wall painting", "Peinture d'un mur d'accent", "Pintura de pared de acento"],
      ["One wall painted in a contrasting colour or finish, edges cut sharp against the adjoining walls.",
       "Un mur peint dans une couleur ou un fini contrastant, les bordures découpées net contre les murs voisins.",
       "Una pared pintada en un color o acabado contrastante, con los bordes cortados limpios contra las paredes vecinas."]),
    S("fq.interior_painting.add_ons.roller_shades_supplies", "add_ons", "flat", BM(150, 225, 313),
      ["Roller shade installation and painting supplies", "Installation de stores à rouleau et fournitures de peinture", "Instalación de persianas enrollables y materiales de pintura"],
      ["Roller shades supplied and hung after painting, with the paint sundries for the job billed alongside.",
       "Stores à rouleau fournis et posés après la peinture, avec les fournitures de peinture du chantier facturées à côté.",
       "Persianas enrollables suministradas y colgadas después de pintar, con los materiales de pintura del trabajo facturados junto."]),
    S("fq.interior_painting.add_ons.urethane_enamel", "add_ons", "flat", BM(400, 1458, 4400),
      ["Interior painting in urethane trim enamel", "Peinture intérieure à l'émail uréthane", "Pintura interior con esmalte de uretano"],
      ["Trim, doors or cabinets finished in a hard-wearing urethane enamel that levels smooth and resists chipping.",
       "Moulures, portes ou armoires finies avec un émail uréthane résistant qui se nivelle et résiste aux éclats.",
       "Molduras, puertas o gabinetes acabados con un esmalte de uretano resistente que nivela liso y no se desconcha."]),
    S("fq.interior_painting.visits.interior_service", "visits", "flat", null,
      ["Interior painting — booked visit", "Peinture intérieure — visite réservée", "Pintura interior — visita agendada"],
      ["A booked visit to measure the rooms, agree colours and finishes and price the interior painting.",
       "Visite réservée pour mesurer les pièces, convenir des couleurs et finis et chiffrer la peinture intérieure.",
       "Visita agendada para medir los cuartos, acordar colores y acabados y cotizar la pintura interior."],
      { durationMinutes: 120, bookable: true, pricedBy: "takeoff", existing: "Priced by the painting takeoff." }),
    S("fq.interior_painting.visits.exterior_service", "visits", "flat", null,
      ["Exterior painting — booked visit", "Peinture extérieure — visite réservée", "Pintura exterior — visita agendada"],
      ["A booked visit to walk the exterior, check the condition of the surfaces and price the repaint.",
       "Visite réservée pour faire le tour de l'extérieur, vérifier l'état des surfaces et chiffrer la peinture.",
       "Visita agendada para recorrer el exterior, revisar el estado de las superficies y cotizar el repintado."],
      { durationMinutes: 120, bookable: true, pricedBy: "takeoff", existing: "Priced by the painting takeoff (exterior scope)." }),
    S("fq.interior_painting.visits.room_repaint", "visits", "flat", null,
      ["Room repaint and colour update — booked visit", "Repeinture d'une pièce et changement de couleur — visite réservée", "Repintado de un cuarto y cambio de color — visita agendada"],
      ["One room repainted in a new colour and finish, priced from the takeoff after a booked visit.",
       "Une pièce repeinte dans une nouvelle couleur et un nouveau fini, chiffrée à partir du relevé après une visite réservée.",
       "Un cuarto repintado en un color y acabado nuevos, cotizado a partir del levantamiento tras una visita agendada."],
      { durationMinutes: 120, bookable: true, pricedBy: "takeoff", existing: "interior_painting colorChangeSurcharge and wallPricePerSqft." }),
    S("fq.interior_painting.commercial.commercial", "commercial", "flat", null,
      ["Commercial painting", "Peinture commerciale", "Pintura comercial"],
      ["Offices, shops and common areas painted around the business's hours with durable finishes and minimal disruption.",
       "Bureaux, commerces et aires communes peints autour des heures d'ouverture, avec des finis durables et peu de dérangement.",
       "Oficinas, locales y áreas comunes pintados fuera del horario del negocio, con acabados durables y mínima interrupción."]),
    S("fq.interior_painting.core.per_room", "core", "flat", null,
      ["Interior painting — per room", "Peinture intérieure — par pièce", "Pintura interior — por cuarto"],
      ["One room's walls painted with basic prep, two coats, cut in cleanly at ceiling and trim.",
       "Murs d'une pièce peints avec préparation de base, deux couches, découpés proprement au plafond et aux moulures.",
       "Paredes de un cuarto pintadas con preparación básica, dos manos, recortadas limpiamente en techo y molduras."],
      { pricedBy: "takeoff", existing: "interior_painting wallPricePerSqft per room." }),
    S("fq.interior_painting.core.whole_home", "core", "flat", null,
      ["Interior painting — whole home", "Peinture intérieure — maison complète", "Pintura interior — casa completa"],
      ["Walls, ceilings and trim throughout the home painted as specified, room by room, with furniture protected.",
       "Murs, plafonds et moulures de toute la maison peints selon le devis, pièce par pièce, meubles protégés.",
       "Paredes, techos y molduras de toda la casa pintados según lo acordado, cuarto por cuarto, con los muebles protegidos."],
      { pricedBy: "takeoff", existing: "The painting takeoff sums every room." }),
    S("fq.interior_painting.core.exterior_full_home", "core", "flat", null,
      ["Exterior painting — full home", "Peinture extérieure — maison complète", "Pintura exterior — casa completa"],
      ["Siding, trim and the other major exterior surfaces washed, scraped, primed where bare and painted.",
       "Revêtement, moulures et autres grandes surfaces extérieures lavés, grattés, apprêtés aux endroits nus et peints.",
       "Revestimiento, molduras y demás superficies exteriores lavados, raspados, imprimados donde estén desnudos y pintados."],
      { pricedBy: "takeoff", existing: "exterior_painting siding / trim per sq ft." }),
    S("fq.interior_painting.cabinets.cabinet_painting", "cabinets", "flat", null,
      ["Cabinet painting", "Peinture d'armoires", "Pintura de gabinetes"],
      ["Kitchen or bathroom cabinets cleaned, sanded and sprayed in a durable coating for a factory-like finish.",
       "Armoires de cuisine ou de salle de bain nettoyées, sablées et pulvérisées avec un revêtement durable pour un fini d'usine.",
       "Gabinetes de cocina o baño limpiados, lijados y rociados con un recubrimiento durable para un acabado de fábrica."],
      { pricedBy: "book", existing: "cabinet_refinishing price book (per door / per drawer)." }),
    S("fq.interior_painting.core.interior_staining", "core", "flat", BM(960, 1590, 4000),
      ["Interior staining — labour and materials", "Teinture intérieure — main-d'œuvre et matériaux", "Tinte interior — mano de obra y materiales"],
      ["Interior wood — trim, doors, railings or built-ins — stained and sealed, materials included.",
       "Bois intérieur — moulures, portes, rampes ou meubles intégrés — teint et scellé, matériaux inclus.",
       "Madera interior (molduras, puertas, barandales o muebles empotrados) teñida y sellada, materiales incluidos."]),
    S("fq.interior_painting.core.ceilings", "core", "flat", BM(273, 784, 1632),
      ["Interior ceiling painting", "Peinture de plafonds intérieurs", "Pintura de techos interiores"],
      ["Ceilings rolled in a flat ceiling paint, fixtures masked and the walls cut in cleanly.",
       "Plafonds roulés avec une peinture mate pour plafond, luminaires masqués et murs découpés proprement.",
       "Techos pintados con rodillo en pintura mate para techo, luminarias cubiertas y paredes recortadas limpiamente."],
      { existing: "interior_painting ceilingPrice per room." }),
    S("fq.interior_painting.core.interior_exterior_residential", "core", "flat", BM(300, 700, 1700),
      ["Interior and exterior painting — residential", "Peinture intérieure et extérieure — résidentiel", "Pintura interior y exterior — residencial"],
      ["A combined interior and exterior job — doors, trim, cabinets and surfaces as listed — priced as one project.",
       "Chantier combiné intérieur et extérieur — portes, moulures, armoires et surfaces selon la liste — chiffré comme un seul projet.",
       "Trabajo combinado interior y exterior (puertas, molduras, gabinetes y superficies según la lista) cotizado como un solo proyecto."]),
    S("fq.interior_painting.core.rooms_and_ceilings", "core", "flat", BM(600, 1200, 2600),
      ["Interior painting — rooms and ceilings", "Peinture intérieure — pièces et plafonds", "Pintura interior — cuartos y techos"],
      ["Walls and ceilings of the listed rooms prepped and painted, labour and materials included.",
       "Murs et plafonds des pièces listées préparés et peints, main-d'œuvre et matériaux inclus.",
       "Paredes y techos de los cuartos listados preparados y pintados, mano de obra y materiales incluidos."],
      { existing: "The takeoff prices the same scope per room." }),
    S("fq.interior_painting.core.rooms_color_change", "core", "flat", BM(433, 865, 2391),
      ["Interior painting — rooms with colour change", "Peinture intérieure — pièces avec changement de couleur", "Pintura interior — cuartos con cambio de color"],
      ["The listed rooms painted in a new colour or sheen, with the extra coat a colour change needs.",
       "Pièces listées peintes dans une nouvelle couleur ou un nouveau lustre, avec la couche supplémentaire qu'un changement de couleur exige.",
       "Cuartos listados pintados en un color o brillo nuevo, con la mano extra que exige un cambio de color."],
      { existing: "interior_painting colorChangeSurcharge." }),
    S("fq.interior_painting.core.rooms_and_cabinetry", "core", "flat", BM(725, 1886, 4449),
      ["Interior painting — rooms and cabinetry", "Peinture intérieure — pièces et armoires", "Pintura interior — cuartos y gabinetes"],
      ["Rooms and kitchen or bathroom cabinets painted in one project, the cabinets sprayed for a smooth finish.",
       "Pièces et armoires de cuisine ou de salle de bain peintes dans un même projet, armoires pulvérisées pour un fini lisse.",
       "Cuartos y gabinetes de cocina o baño pintados en un mismo proyecto, con los gabinetes rociados para un acabado liso."]),
    S("fq.interior_painting.core.residential_spaces", "core", "flat", BM(1771, 3336, 5732),
      ["Interior painting — residential spaces", "Peinture intérieure — espaces résidentiels", "Pintura interior — espacios residenciales"],
      ["Several rooms and areas of a home painted, labour and materials included, scheduled to keep the house livable.",
       "Plusieurs pièces et aires d'une maison peintes, main-d'œuvre et matériaux inclus, planifiées pour garder la maison habitable.",
       "Varios cuartos y áreas de una casa pintados, mano de obra y materiales incluidos, programados para mantener la casa habitable."]),
    S("fq.interior_painting.core.premium_latex_interior_exterior", "core", "flat", BM(519, 1472, 4550),
      ["Interior and exterior painting — premium acrylic latex", "Peinture intérieure et extérieure — latex acrylique haut de gamme", "Pintura interior y exterior — látex acrílico premium"],
      ["Interior and exterior surfaces painted with a premium acrylic latex for coverage and longevity.",
       "Surfaces intérieures et extérieures peintes avec un latex acrylique haut de gamme pour le pouvoir couvrant et la durée.",
       "Superficies interiores y exteriores pintadas con un látex acrílico premium por su cobertura y duración."]),
    S("fq.interior_painting.core.interior_exterior_full", "core", "flat", BM(1300, 3242, 6276),
      ["Interior and exterior painting — walls, ceilings, trim and exterior", "Peinture intérieure et extérieure — murs, plafonds, moulures et extérieur", "Pintura interior y exterior — paredes, techos, molduras y exterior"],
      ["Walls, ceilings and trim inside plus the exterior surfaces, painted as one project with quality paint.",
       "Murs, plafonds et moulures à l'intérieur plus les surfaces extérieures, peints en un seul projet avec une peinture de qualité.",
       "Paredes, techos y molduras por dentro más las superficies exteriores, pintados como un solo proyecto con pintura de calidad."]),
    S("fq.interior_painting.core.two_bedroom_unit_walls", "core", "flat", BM(350, 500, 900),
      ["Interior wall painting — two-bedroom unit", "Peinture des murs — logement de deux chambres", "Pintura de paredes — unidad de dos recámaras"],
      ["The walls of a two-bedroom apartment or condo painted between tenants or for a refresh.",
       "Murs d'un appartement ou d'un condo de deux chambres peints entre deux locataires ou pour rafraîchir.",
       "Paredes de un apartamento o condominio de dos recámaras pintadas entre inquilinos o para renovar."]),
    S("fq.interior_painting.core.walls_ceilings_trim", "core", "flat", BM(900, 2100, 4550),
      ["Interior painting — walls, ceilings and trim", "Peinture intérieure — murs, plafonds et moulures", "Pintura interior — paredes, techos y molduras"],
      ["Walls, ceilings and trim of the listed rooms painted, each in the right sheen.",
       "Murs, plafonds et moulures des pièces listées peints, chacun dans le bon lustre.",
       "Paredes, techos y molduras de los cuartos listados pintados, cada uno en el brillo adecuado."],
      { existing: "The takeoff prices walls, ceiling and trim per room." }),
    S("fq.interior_painting.core.walls_and_ceilings", "core", "flat", BM(503, 1103, 3155),
      ["Interior painting — walls and ceilings", "Peinture intérieure — murs et plafonds", "Pintura interior — paredes y techos"],
      ["Walls and ceilings of the listed rooms painted for a clean, even finish.",
       "Murs et plafonds des pièces listées peints pour un fini propre et uniforme.",
       "Paredes y techos de los cuartos listados pintados para un acabado limpio y parejo."]),
    S("fq.interior_painting.cabinets.kitchen_refinish_full", "cabinets", "flat", BM(600, 2500, 4425),
      ["Kitchen cabinet refinishing and full paint", "Refinition et peinture complète d'armoires de cuisine", "Refinado y pintura completa de gabinetes de cocina"],
      ["Doors, drawer fronts and boxes degreased, sanded, primed and sprayed for a like-new kitchen without replacing the cabinets.",
       "Portes, façades de tiroirs et caissons dégraissés, sablés, apprêtés et pulvérisés pour une cuisine comme neuve sans remplacer les armoires.",
       "Puertas, frentes de cajón y cajas desengrasados, lijados, imprimados y rociados para una cocina como nueva sin reemplazar los gabinetes."],
      { pricedBy: "book", existing: "cabinet_refinishing price book (per door / per drawer)." }),
    S("fq.interior_painting.core.ceilings_flat_latex", "core", "flat", BM(476, 1200, 3600),
      ["Interior ceiling painting — flat interior latex", "Peinture de plafonds — latex intérieur mat", "Pintura de techos — látex interior mate"],
      ["Ceilings painted with a quality flat interior latex that hides roller marks and imperfections.",
       "Plafonds peints avec un latex intérieur mat de qualité qui masque les traces de rouleau et les imperfections.",
       "Techos pintados con un látex interior mate de calidad que oculta marcas de rodillo e imperfecciones."]),
    S("fq.interior_painting.core.one_bedroom_apartment", "core", "flat", BM(300, 450, 866),
      ["Interior wall painting — one-bedroom apartment", "Peinture des murs — appartement d'une chambre", "Pintura de paredes — apartamento de una recámara"],
      ["Walls and ceilings of a one-bedroom apartment painted, typically a turnover repaint.",
       "Murs et plafonds d'un appartement d'une chambre peints, typiquement une repeinture entre locataires.",
       "Paredes y techos de un apartamento de una recámara pintados, típicamente un repintado entre inquilinos."]),
    S("fq.interior_painting.core.apartment_various", "core", "flat", BM(703, 1594, 3758),
      ["Apartment painting — various room sizes", "Peinture d'appartement — pièces de tailles variées", "Pintura de apartamento — cuartos de varios tamaños"],
      ["Walls, ceilings and touch-ups across an apartment's rooms, priced by room size.",
       "Murs, plafonds et retouches dans les pièces d'un appartement, chiffrés selon la taille des pièces.",
       "Paredes, techos y retoques en los cuartos de un apartamento, cotizados por tamaño de cuarto."]),
    S("fq.interior_painting.cabinets.kitchen_paint_refinish", "cabinets", "flat", BM(2160, 3746, 5537),
      ["Kitchen cabinet painting and refinishing", "Peinture et refinition d'armoires de cuisine", "Pintura y refinado de gabinetes de cocina"],
      ["Kitchen cabinets refinished with a sprayed, durable coating chosen for daily wear.",
       "Armoires de cuisine refinies avec un revêtement pulvérisé et durable, choisi pour l'usage quotidien.",
       "Gabinetes de cocina refinados con un recubrimiento rociado y durable elegido para el uso diario."],
      { pricedBy: "book", existing: "cabinet_refinishing price book (per door / per drawer)." }),
    S("fq.interior_painting.prep.surface_preparation", "prep", "flat", null,
      ["Surface preparation", "Préparation des surfaces", "Preparación de superficies"],
      ["Cleaning, sanding, patching and priming so the paint bonds and the finish lasts.",
       "Nettoyage, sablage, rebouchage et apprêt pour que la peinture adhère et que le fini dure.",
       "Limpieza, lijado, resane e imprimación para que la pintura adhiera y el acabado dure."],
      { existing: "interior_painting drywallPrepPrice per room." }),
    S("fq.interior_painting.prep.drywall_patch", "prep", "flat", null,
      ["Drywall patch and repair", "Réparation de gypse", "Resane y reparación de panel de yeso"],
      ["Holes, dents and cracks patched, taped and sanded smooth, ready for paint.",
       "Trous, bosses et fissures rebouchés, rubanés et sablés lisses, prêts pour la peinture.",
       "Agujeros, golpes y grietas resanados, encintados y lijados lisos, listos para pintar."],
      { existing: "interior_painting drywallPrepPrice per room." }),
    S("fq.interior_painting.prep.caulking_sealing", "prep", "flat", null,
      ["Caulking and sealing", "Calfeutrage et scellement", "Calafateo y sellado"],
      ["Gaps at trim, corners and seams caulked before painting for a tight, finished line.",
       "Joints aux moulures, coins et raccords calfeutrés avant la peinture pour une ligne nette et finie.",
       "Juntas en molduras, esquinas y uniones calafateadas antes de pintar para una línea limpia y terminada."]),
    S("fq.interior_painting.prep.rooms_with_prep", "prep", "flat", BM(800, 1650, 3400),
      ["Interior painting with full preparation — several rooms", "Peinture intérieure avec préparation complète — plusieurs pièces", "Pintura interior con preparación completa — varios cuartos"],
      ["Kitchen, bathrooms, living and dining rooms prepped and painted as one job, with the patching and priming included.",
       "Cuisine, salles de bain, salon et salle à manger préparés et peints en un seul chantier, rebouchage et apprêt inclus.",
       "Cocina, baños, sala y comedor preparados y pintados como un solo trabajo, con el resane y la imprimación incluidos."]),
    S("fq.interior_painting.prep.popcorn_removal_paint", "prep", "flat", BM(730, 1800, 4125),
      ["Popcorn ceiling removal and painting", "Retrait de plafond texturé et peinture", "Retiro de techo de palomitas y pintura"],
      ["Textured ceiling scraped off, the surface skimmed and sanded, then primed and painted flat.",
       "Plafond texturé gratté, surface enduite et sablée, puis apprêtée et peinte en fini mat.",
       "Techo texturizado raspado, la superficie enmasillada y lijada, luego imprimada y pintada en mate."],
      { existing: "interior_painting global.popcornRemovalPricePerSqft." }),
    // ── Added 2026-09-24: a Jobber painting signup seeds "Wallpaper Removal"
    //    and the book had no row for it (docs/research/jobber-seeded-services.md).
    S("fq.interior_painting.prep.wallpaper_removal", "prep", "flat", null,
      ["Wallpaper removal", "Enlèvement de papier peint", "Retiro de papel tapiz"],
      ["Wallpaper stripped, the adhesive washed off, damaged drywall repaired and the walls primed ready for paint.",
       "Papier peint arraché, colle lavée, gypse abîmé réparé et murs apprêtés, prêts pour la peinture.",
       "Papel tapiz retirado, el adhesivo lavado, el panel de yeso dañado reparado y los muros imprimados listos para pintar."]),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the painting price-book capture under docs/research/ (41 services
// in six groups, every one $0 with no cost and no lines — the competitor ships
// no painting templates at all) for WHICH services exist, the benchmark
// quartiles on the rows for the totals, and the 2026 repaint rates in
// _paintLines.js for the lines. Every row here — all 37, the 36 captured plus
// Wallpaper Removal — carries a template, and every per-surface line is keyed
// to the field lib/pricing/paintTakeoff.js measures for a room.
//
// Quote types (owner, 2026-09-24): `categories` names the ServiceCategory the
// template attaches to and `estimateTypes` the PAINT_ESTIMATE_TYPES sub-type.
// Interior rooms → interior; cabinet rows → cabinet_refinishing + cabinets;
// commercial → interior and exterior + commercial; trim, doors, caulking and
// the combined interior/exterior jobs → both trades.
const IN = { categories: ["interior_painting"], estimateTypes: ["interior"] };
const BOTH = { categories: ["interior_painting", "exterior_painting"], estimateTypes: ["interior", "exterior"] };
const CAB = { categories: ["cabinet_refinishing"], estimateTypes: ["cabinets"] };
const PREP_PATCH = (price = 65) => L.labour(1, "flat", price, {
  en: ["Patching and spot priming", "Nail holes and dings filled, sanded and spot-primed before paint."],
  fr: ["Rebouchage et apprêt localisé", "Trous de clous et coups comblés, sablés et apprêtés avant la peinture."],
  es: ["Resanado e imprimación en puntos", "Agujeros de clavos y golpes rellenados, lijados e imprimados antes de pintar."],
  it: ["Stuccatura e primer a punti", "Fori di chiodi e ammaccature stuccati, carteggiati e primerizzati prima della pittura."],
  de: ["Spachteln und punktuell grundieren", "Nagellöcher und Dellen gefüllt, geschliffen und vor dem Anstrich grundiert."],
  uk: ["Шпаклювання та точкове ґрунтування", "Отвори від цвяхів і вм'ятини зашпакльовано, відшліфовано й заґрунтовано перед фарбуванням."],
  tl: ["Pagtapal at spot priming", "Tinapalan, hinasa at nilagyan ng primer ang butas ng pako at yupi bago pinturahan."],
});
const n = (it, de, uk, tl) => ({ it, de, uk, tl });

const TEMPLATES = {
  // ── Add-on services ──
  "fq.interior_painting.add_ons.touch_up": T("maintenance", n(
    ["Ritocchi di pittura", "Segni, scheggiature e piccole zone danneggiate primerizzate a punti e ridipinte in tinta con la parete."],
    ["Ausbesserungsanstrich", "Streifen, Abplatzer und kleine Schadstellen punktuell grundiert und passend zur Wand überstrichen."],
    ["Підфарбовування", "Потертості, сколи й дрібні пошкодження точково заґрунтовано й підфарбовано в тон стіни."],
    ["Touch-up na pintura", "Nilagyan ng primer at pinintahan ang gasgas, chip at maliit na sira para tumugma sa pader."],
  ), [
    L.labour(1.5, "hour", 75, {
      en: ["Touch-up labour", "Marks spot-primed and colour-matched paint feathered in, by the hour."],
      fr: ["Main-d'œuvre — retouches", "Marques apprêtées localement et peinture assortie fondue, à l'heure."],
      es: ["Mano de obra — retoques", "Marcas imprimadas en puntos y pintura igualada difuminada, por hora."],
      it: ["Manodopera — ritocchi", "Segni primerizzati a punti e pittura in tinta sfumata, a ore."],
      de: ["Arbeit — Ausbessern", "Stellen punktuell grundiert und farbgleich eingearbeitet, nach Stunden."],
      uk: ["Робота — підфарбовування", "Плями точково заґрунтовано, фарбу в тон розтушовано, погодинно."],
      tl: ["Labor — touch-up", "Nilagyan ng primer at pinahiran ng katugmang pintura, kada oras."],
    }),
    SHARED.consumables(20),
  ], null, IN),

  "fq.interior_painting.add_ons.trim_baseboard": T("installation", n(
    ["Pittura battiscopa e cornici", "Battiscopa, mostre e cornici carteggiati, sigillati e verniciati con smalto resistente."],
    ["Leisten- und Sockelanstrich", "Sockelleisten, Zargen und Profile geschliffen, versiegelt und mit strapazierfähigem Lack gestrichen."],
    ["Фарбування плінтусів і лиштв", "Плінтуси, лиштви й молдинги відшліфовано, загерметизовано й пофарбовано зносостійкою емаллю."],
    ["Pintura ng trim at baseboard", "Hinasa, kinaulk at pinintahan ng matibay na enamel ang baseboard, casing at molding."],
  ), [PAINT.trim(), PAINT.windows(), PAINT.trimPaint()], null, BOTH),

  "fq.interior_painting.add_ons.door_painting": T("installation", n(
    ["Pittura porte", "Porta interna o esterna preparata e verniciata su entrambe le facce e i bordi, ferramenta smontata e rimontata."],
    ["Türanstrich", "Innen- oder Außentür vorbereitet und beidseitig samt Kanten gestrichen, Beschläge ab- und wieder angebaut."],
    ["Фарбування дверей", "Внутрішні або зовнішні двері підготовлено й пофарбовано з обох боків і торців, фурнітуру знято й повернуто."],
    ["Pintura ng pinto", "Inihanda at pinintahan ang dalawang mukha at gilid ng pinto sa loob o labas, tinanggal at ibinalik ang hardware."],
  ), [PAINT.doors(), PAINT.doorPaint()], null, BOTH),

  "fq.interior_painting.add_ons.accent_wall": T("installation", n(
    ["Parete d'accento", "Una parete dipinta in un colore o una finitura a contrasto, con bordi netti sulle pareti adiacenti."],
    ["Akzentwand", "Eine Wand in Kontrastfarbe oder -oberfläche gestrichen, Kanten scharf zu den Nachbarwänden."],
    ["Акцентна стіна", "Одну стіну пофарбовано в контрастний колір чи фактуру з чіткими краями до сусідніх стін."],
    ["Accent wall", "Isang pader na pininturahan ng ibang kulay o finish, malinis ang gilid sa katabing pader."],
  ), [PAINT.walls(1.9), PAINT.wallPaint(0.55)], null, IN),

  "fq.interior_painting.add_ons.roller_shades_supplies": T("installation", n(
    ["Tende a rullo e materiali di pittura", "Tende a rullo fornite e montate dopo la pittura, con i materiali di consumo del lavoro fatturati a parte."],
    ["Rollos und Malerbedarf", "Rollos nach dem Anstrich geliefert und montiert, der Malerbedarf des Auftrags mitberechnet."],
    ["Рулонні штори та малярні матеріали", "Рулонні штори поставлено й повішено після фарбування, витратні матеріали роботи враховано окремо."],
    ["Roller shade at gamit sa pagpipinta", "Dinala at ikinabit ang roller shade pagkatapos magpinta, kasama ang gamit sa pagpipinta sa trabaho."],
  ), [
    L.labour(1, "each", 45, {
      en: ["Roller shade installation — per shade", "Brackets fixed, the shade hung, levelled and tested."],
      fr: ["Pose de store à rouleau — l'unité", "Supports fixés, store accroché, mis de niveau et testé."],
      es: ["Instalación de persiana enrollable — por pieza", "Soportes fijados, persiana colgada, nivelada y probada."],
      it: ["Montaggio tenda a rullo — cadauna", "Staffe fissate, tenda appesa, livellata e provata."],
      de: ["Rollomontage — pro Rollo", "Halter befestigt, Rollo eingehängt, ausgerichtet und getestet."],
      uk: ["Монтаж рулонної штори — за штуку", "Кронштейни закріплено, штору повішено, вирівняно й перевірено."],
      tl: ["Pagkabit ng roller shade — kada isa", "Ikinabit ang bracket, isinabit, nilevel at sinubukan ang shade."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 85, {
      en: ["Light-filtering roller shade — per shade", "Made-to-width roller shade with brackets."],
      fr: ["Store à rouleau tamisant — l'unité", "Store à rouleau coupé sur mesure avec supports."],
      es: ["Persiana enrollable traslúcida — por pieza", "Persiana enrollable a la medida con soportes."],
      it: ["Tenda a rullo filtrante — cadauna", "Tenda a rullo su misura con staffe."],
      de: ["Lichtdurchlässiges Rollo — pro Rollo", "Rollo nach Maß mit Haltern."],
      uk: ["Світлорозсіювальна рулонна штора — за штуку", "Рулонна штора під ширину вікна з кронштейнами."],
      tl: ["Light-filtering roller shade — kada isa", "Roller shade na sukat sa lapad, may bracket."],
    }, { measurementKey: "each" }),
    SHARED.consumables(45),
  ], null, IN),

  "fq.interior_painting.add_ons.urethane_enamel": T("installation", n(
    ["Pittura interni con smalto uretanico", "Cornici, porte o mobili rifiniti con smalto uretanico resistente che si distende liscio e non si scheggia."],
    ["Innenanstrich mit Urethanlack", "Leisten, Türen oder Schränke mit strapazierfähigem Urethanlack beschichtet, der glatt verläuft und nicht abplatzt."],
    ["Фарбування інтер'єру уретановою емаллю", "Плінтуси, двері чи шафи покрито зносостійкою уретановою емаллю, що розтікається гладко й не відколюється."],
    ["Pintura sa loob gamit ang urethane enamel", "Trim, pinto o cabinet na tinapos ng matibay na urethane enamel na makinis at hindi nagcha-chip."],
  ), [PAINT.trim(2.75), PAINT.doors(110), PAINT.trimPaint(0.6)], null, IN),

  // ── Book-now visits ──
  "fq.interior_painting.visits.interior_service": T("inspection", n(
    ["Pittura interni — visita prenotata", "Visita prenotata per misurare le stanze, concordare colori e finiture e quotare la pittura interna."],
    ["Innenanstrich — gebuchter Termin", "Gebuchter Termin, um die Räume aufzumessen, Farben und Oberflächen festzulegen und den Innenanstrich anzubieten."],
    ["Фарбування інтер'єру — запланований візит", "Запланований візит, щоб виміряти кімнати, погодити кольори й фактуру та оцінити роботу."],
    ["Pintura sa loob — naka-book na visit", "Naka-book na visit para sukatin ang kuwarto, pagkasunduan ang kulay at finish at i-quote ang pagpipinta."],
  ), [
    L.labour(1, "flat", 0, {
      en: ["Free assessment", "Rooms measured, colours and sheens agreed and a written price left."],
      fr: ["Évaluation gratuite", "Pièces mesurées, couleurs et lustres convenus et prix écrit remis."],
      es: ["Evaluación gratuita", "Habitaciones medidas, colores y brillos acordados y un precio por escrito."],
      it: ["Valutazione gratuita", "Stanze misurate, colori e finiture concordati e prezzo scritto lasciato."],
      de: ["Kostenlose Besichtigung", "Räume aufgemessen, Farben und Glanzgrade festgelegt und ein schriftlicher Preis hinterlassen."],
      uk: ["Безкоштовна оцінка", "Кімнати виміряно, кольори й ступінь блиску погоджено, залишено письмову ціну."],
      tl: ["Libreng assessment", "Sinukat ang kuwarto, pinagkasunduan ang kulay at sheen at iniwan ang nakasulat na presyo."],
    }, { cost: 0 }),
  ], null, IN),

  "fq.interior_painting.visits.exterior_service": T("inspection", n(
    ["Pittura esterni — visita prenotata", "Visita prenotata per percorrere l'esterno, verificare le superfici e quotare la ripittura."],
    ["Außenanstrich — gebuchter Termin", "Gebuchter Termin, um das Äußere abzugehen, die Flächen zu prüfen und den Neuanstrich anzubieten."],
    ["Фарбування фасаду — запланований візит", "Запланований візит, щоб оглянути зовнішні поверхні та оцінити перефарбування."],
    ["Pintura sa labas — naka-book na visit", "Naka-book na visit para libutin ang labas, tingnan ang kondisyon at i-quote ang pagpipinta."],
  ), [
    L.labour(1, "flat", 0, {
      en: ["Free exterior assessment", "Siding, trim and wood condition checked and a written price left."],
      fr: ["Évaluation extérieure gratuite", "État du revêtement, des moulures et du bois vérifié et prix écrit remis."],
      es: ["Evaluación exterior gratuita", "Estado del revestimiento, molduras y madera revisado y un precio por escrito."],
      it: ["Valutazione esterna gratuita", "Stato di rivestimento, cornici e legno controllato e prezzo scritto lasciato."],
      de: ["Kostenlose Außenbesichtigung", "Zustand von Fassade, Leisten und Holz geprüft und ein schriftlicher Preis hinterlassen."],
      uk: ["Безкоштовна оцінка фасаду", "Стан обшивки, лиштв і деревини перевірено, залишено письмову ціну."],
      tl: ["Libreng assessment sa labas", "Chineck ang kondisyon ng siding, trim at kahoy at iniwan ang nakasulat na presyo."],
    }, { cost: 0 }),
  ], null, { categories: ["exterior_painting"], estimateTypes: ["exterior"] }),

  "fq.interior_painting.visits.room_repaint": T("inspection", n(
    ["Ripittura stanza e cambio colore — visita prenotata", "Una stanza ridipinta in un nuovo colore e finitura, quotata dalla misura dopo una visita prenotata."],
    ["Raum neu streichen, Farbwechsel — gebuchter Termin", "Ein Raum in neuer Farbe und Oberfläche gestrichen, nach gebuchtem Termin aus dem Aufmaß angeboten."],
    ["Перефарбування кімнати та зміна кольору — візит", "Одну кімнату перефарбовано в новий колір і фактуру, ціна із заміру після візиту."],
    ["Repaint ng kuwarto at bagong kulay — naka-book", "Isang kuwarto na pininturahan ng bagong kulay at finish, presyo mula sa sukat pagkatapos ng visit."],
  ), [PAINT.walls(1.75), PAINT.wallPaint(0.5), PREP_PATCH()], null, IN),

  // ── Commercial ──
  "fq.interior_painting.commercial.commercial": T("installation", n(
    ["Pittura commerciale", "Uffici, negozi e spazi comuni dipinti fuori orario con finiture resistenti e il minimo disturbo."],
    ["Gewerbeanstrich", "Büros, Läden und Gemeinschaftsflächen außerhalb der Geschäftszeiten mit strapazierfähigen Oberflächen gestrichen."],
    ["Комерційне фарбування", "Офіси, магазини й спільні зони пофарбовано поза робочими годинами зносостійкими покриттями."],
    ["Commercial na pagpipinta", "Opisina, tindahan at common area na pininturahan sa labas ng oras ng negosyo gamit ang matibay na finish."],
  ), [PAINT.walls(1.45), PAINT.ceilings(1.25), PAINT.wallPaint(0.4)], null, { categories: ["interior_painting", "exterior_painting"], estimateTypes: ["commercial"] }),

  // ── Core painting ──
  "fq.interior_painting.core.per_room": T("installation", n(
    ["Pittura interni — per stanza", "Pareti di una stanza dipinte con preparazione di base, due mani, profili netti a soffitto e cornici."],
    ["Innenanstrich — pro Raum", "Wände eines Raums mit Grundvorbereitung zweimal gestrichen, sauber an Decke und Leisten beigeschnitten."],
    ["Фарбування інтер'єру — за кімнату", "Стіни однієї кімнати пофарбовано з базовою підготовкою у два шари, чисто по стелі та плінтусах."],
    ["Pintura sa loob — kada kuwarto", "Pader ng isang kuwarto na pininturahan na may basic prep, dalawang patong, malinis sa kisame at trim."],
  ), [PAINT.walls(), PREP_PATCH(), PAINT.wallPaint()], null, IN),

  "fq.interior_painting.core.whole_home": T("installation", n(
    ["Pittura interni — tutta la casa", "Pareti, soffitti e cornici di tutta la casa dipinti come concordato, stanza per stanza, con i mobili protetti."],
    ["Innenanstrich — ganzes Haus", "Wände, Decken und Leisten im ganzen Haus wie vereinbart Raum für Raum gestrichen, Möbel geschützt."],
    ["Фарбування інтер'єру — весь будинок", "Стіни, стелі й плінтуси в усьому будинку пофарбовано за домовленістю, кімната за кімнатою, меблі захищено."],
    ["Pintura sa loob — buong bahay", "Pader, kisame at trim sa buong bahay na pininturahan kuwarto-kuwarto, protektado ang muwebles."],
  ), [PAINT.walls(), PAINT.ceilings(), PAINT.trim(), PAINT.wallPaint(), PAINT.ceilingPaint(), PAINT.trimPaint()], null, IN),

  "fq.interior_painting.core.exterior_full_home": T("installation", n(
    ["Pittura esterni — tutta la casa", "Rivestimento, cornici e altre superfici esterne lavati, raschiati, primerizzati dove nudi e verniciati."],
    ["Außenanstrich — ganzes Haus", "Fassade, Leisten und übrige Außenflächen gewaschen, abgekratzt, blanke Stellen grundiert und gestrichen."],
    ["Фарбування фасаду — весь будинок", "Обшивку, лиштви та інші зовнішні поверхні вимито, зачищено, оголені місця заґрунтовано й пофарбовано."],
    ["Pintura sa labas — buong bahay", "Hinugasan, kinayod, nilagyan ng primer ang hubad at pininturahan ang siding, trim at ibang panlabas na bahagi."],
  ), [PAINT.siding(), PAINT.trim(2.5), PAINT.exteriorPaint()], null, { categories: ["exterior_painting"], estimateTypes: ["exterior"] }),

  "fq.interior_painting.core.interior_staining": T("installation", n(
    ["Mordenzatura interni — manodopera e materiali", "Legno interno — cornici, porte, ringhiere o arredi su misura — mordenzato e sigillato, materiali inclusi."],
    ["Innenbeizen — Arbeit und Material", "Innenholz — Leisten, Türen, Geländer oder Einbauten — gebeizt und versiegelt, Material inklusive."],
    ["Тонування в інтер'єрі — робота й матеріали", "Внутрішню деревину — лиштви, двері, поруччя чи вбудовані меблі — протоновано й покрито захистом, матеріали включено."],
    ["Pag-stain sa loob — labor at materyales", "Kahoy sa loob — trim, pinto, railing o built-in — na ini-stain at sinelyuhan, kasama ang materyales."],
  ), [PAINT.stainWood(3.25, "linearFt"), PAINT.stain(0.7, "linearFt")], null, { categories: ["interior_painting"], estimateTypes: ["staining"] }),

  "fq.interior_painting.core.ceilings": T("installation", n(
    ["Pittura soffitti interni", "Soffitti rullati con pittura opaca, lampade mascherate e pareti profilate pulite."],
    ["Deckenanstrich innen", "Decken mit matter Deckenfarbe gerollt, Leuchten abgeklebt und sauber zur Wand beigeschnitten."],
    ["Фарбування стелі в інтер'єрі", "Стелі прокатано матовою фарбою, світильники заклеєно, краї біля стін обведено чисто."],
    ["Pintura ng kisame sa loob", "Nirolyo ang kisame ng flat na pintura, tinakpan ang ilaw at malinis ang gilid sa pader."],
  ), [PAINT.ceilings(), PREP_PATCH(85), PAINT.ceilingPaint()], null, IN),

  "fq.interior_painting.core.interior_exterior_residential": T("installation", n(
    ["Pittura interni ed esterni — residenziale", "Lavoro combinato interno ed esterno — porte, cornici, mobili e superfici come elencato — quotato come un unico progetto."],
    ["Innen- und Außenanstrich — Wohnhaus", "Kombinierter Innen- und Außenauftrag — Türen, Leisten, Schränke und Flächen wie aufgeführt — als ein Projekt angeboten."],
    ["Фарбування інтер'єру та фасаду — житловий", "Поєднана внутрішня й зовнішня робота — двері, лиштви, шафи й поверхні за переліком — як один проєкт."],
    ["Pintura sa loob at labas — bahay", "Pinagsamang trabaho sa loob at labas — pinto, trim, cabinet at ibabaw ayon sa listahan — bilang isang proyekto."],
  ), [PAINT.walls(), PAINT.siding(), PAINT.doors(), PAINT.wallPaint(), PAINT.exteriorPaint(), PAINT.doorPaint()], null, BOTH),

  "fq.interior_painting.core.rooms_and_ceilings": T("installation", n(
    ["Pittura interni — stanze e soffitti", "Pareti e soffitti delle stanze elencate preparati e dipinti, manodopera e materiali inclusi."],
    ["Innenanstrich — Räume und Decken", "Wände und Decken der aufgeführten Räume vorbereitet und gestrichen, Arbeit und Material inklusive."],
    ["Фарбування інтер'єру — кімнати та стелі", "Стіни й стелі переліченних кімнат підготовлено й пофарбовано, робота й матеріали включено."],
    ["Pintura sa loob — kuwarto at kisame", "Inihanda at pininturahan ang pader at kisame ng mga nakalistang kuwarto, kasama ang labor at materyales."],
  ), [PAINT.walls(), PAINT.ceilings(), PAINT.wallPaint(), PAINT.ceilingPaint()], null, IN),

  "fq.interior_painting.core.rooms_color_change": T("installation", n(
    ["Pittura interni — stanze con cambio colore", "Stanze elencate dipinte in un nuovo colore o finitura, con la mano in più che un cambio colore richiede."],
    ["Innenanstrich — Räume mit Farbwechsel", "Aufgeführte Räume in neuer Farbe oder Glanzgrad gestrichen, mit dem zusätzlichen Anstrich, den ein Farbwechsel braucht."],
    ["Фарбування інтер'єру — кімнати зі зміною кольору", "Перелічені кімнати пофарбовано в новий колір або блиск із додатковим шаром, якого потребує зміна кольору."],
    ["Pintura sa loob — kuwarto na bagong kulay", "Nakalistang kuwarto na pininturahan ng bagong kulay o sheen, may dagdag na patong na kailangan sa palit-kulay."],
  ), [
    PAINT.walls(2.1),
    L.labour(1, "sqft", 0.45, {
      en: ["Tinted primer coat — per sq ft", "A tinted primer rolled first so a dark-to-light change covers in two finish coats."],
      fr: ["Couche d'apprêt teinté — au pi²", "Apprêt teinté appliqué d'abord pour qu'un passage du foncé au pâle couvre en deux couches."],
      es: ["Capa de imprimador entintado — por pie²", "Imprimador entintado aplicado primero para que un cambio de oscuro a claro cubra en dos manos."],
      it: ["Mano di primer colorato — al piede quadro", "Primer colorato steso prima perché un passaggio da scuro a chiaro copra in due mani."],
      de: ["Getönte Grundierung — pro sq ft", "Getönte Grundierung zuerst gerollt, damit ein Wechsel von dunkel zu hell mit zwei Deckanstrichen deckt."],
      uk: ["Тонований ґрунт — за кв. фут", "Спершу нанесено тонований ґрунт, щоб перехід з темного на світлий перекрився двома шарами."],
      tl: ["Tinted primer — kada sq ft", "Tinted primer muna para matakpan ng dalawang patong ang palit mula madilim papuntang maliwanag."],
    }, { measurementKey: "wallSqft" }),
    PAINT.wallPaint(0.6),
  ], null, IN),

  "fq.interior_painting.core.rooms_and_cabinetry": T("installation", n(
    ["Pittura interni — stanze e mobili", "Stanze e mobili di cucina o bagno dipinti in un unico progetto, i mobili a spruzzo per una finitura liscia."],
    ["Innenanstrich — Räume und Schränke", "Räume und Küchen- oder Badschränke in einem Projekt gestrichen, die Schränke gespritzt für eine glatte Oberfläche."],
    ["Фарбування інтер'єру — кімнати та шафи", "Кімнати та кухонні чи ванні шафи пофарбовано в одному проєкті, шафи — розпиленням для гладкого покриття."],
    ["Pintura sa loob — kuwarto at cabinet", "Kuwarto at cabinet sa kusina o banyo sa iisang proyekto, ini-spray ang cabinet para makinis."],
  ), [PAINT.walls(), PAINT.cabinetDoors(), PAINT.cabinetDrawers(), PAINT.wallPaint(), PAINT.cabinetCoating()], null,
    { categories: ["interior_painting", "cabinet_refinishing"], estimateTypes: ["interior", "cabinets"] }),

  "fq.interior_painting.core.residential_spaces": T("installation", n(
    ["Pittura interni — spazi residenziali", "Più stanze e zone di una casa dipinte, manodopera e materiali inclusi, programmate per lasciare la casa vivibile."],
    ["Innenanstrich — Wohnräume", "Mehrere Räume und Bereiche eines Hauses gestrichen, Arbeit und Material inklusive, so geplant, dass das Haus bewohnbar bleibt."],
    ["Фарбування інтер'єру — житлові приміщення", "Кілька кімнат і зон будинку пофарбовано, робота й матеріали включено, за графіком, щоб у домі можна було жити."],
    ["Pintura sa loob — mga espasyo sa bahay", "Ilang kuwarto at lugar ng bahay na pininturahan, kasama labor at materyales, naka-schedule para matirhan pa rin."],
  ), [PAINT.walls(), PAINT.ceilings(), PAINT.trim(), PAINT.wallPaint(), PAINT.ceilingPaint(), PAINT.trimPaint()], null, IN),

  "fq.interior_painting.core.premium_latex_interior_exterior": T("installation", n(
    ["Pittura interni ed esterni — lattice acrilico premium", "Superfici interne ed esterne dipinte con un lattice acrilico premium per copertura e durata."],
    ["Innen- und Außenanstrich — Premium-Acryllatex", "Innen- und Außenflächen mit Premium-Acryllatex für Deckkraft und Haltbarkeit gestrichen."],
    ["Фарбування інтер'єру й фасаду — преміальний акриловий латекс", "Внутрішні та зовнішні поверхні пофарбовано преміальним акриловим латексом для покриття й довговічності."],
    ["Pintura sa loob at labas — premium acrylic latex", "Loob at labas na pininturahan ng premium acrylic latex para sa takip at tibay."],
  ), [PAINT.walls(1.7), PAINT.siding(2.2), PAINT.wallPaint(0.6), PAINT.exteriorPaint(0.7)], null, BOTH),

  "fq.interior_painting.core.interior_exterior_full": T("installation", n(
    ["Pittura interni ed esterni — pareti, soffitti, cornici ed esterno", "Pareti, soffitti e cornici interni più le superfici esterne, dipinti come unico progetto con pittura di qualità."],
    ["Innen- und Außenanstrich — Wände, Decken, Leisten und Fassade", "Wände, Decken und Leisten innen plus die Außenflächen, als ein Projekt mit Qualitätsfarbe gestrichen."],
    ["Фарбування інтер'єру й фасаду — стіни, стелі, лиштви та зовні", "Стіни, стелі й лиштви всередині плюс зовнішні поверхні, як один проєкт якісною фарбою."],
    ["Pintura sa loob at labas — pader, kisame, trim at labas", "Pader, kisame at trim sa loob at mga panlabas na bahagi, bilang isang proyekto na de-kalidad na pintura."],
  ), [PAINT.walls(), PAINT.ceilings(), PAINT.siding(), PAINT.wallPaint(), PAINT.ceilingPaint(), PAINT.exteriorPaint()], null, BOTH),

  "fq.interior_painting.core.two_bedroom_unit_walls": T("installation", n(
    ["Pittura pareti — bilocale con due camere", "Pareti di un appartamento con due camere dipinte tra un inquilino e l'altro o per un rinnovo."],
    ["Wandanstrich — Wohnung mit zwei Schlafzimmern", "Wände einer Wohnung mit zwei Schlafzimmern zwischen zwei Mietern oder zur Auffrischung gestrichen."],
    ["Фарбування стін — квартира з двома спальнями", "Стіни квартири з двома спальнями пофарбовано між орендарями або для оновлення."],
    ["Pintura ng pader — unit na may dalawang kuwarto", "Pader ng apartment na may dalawang kuwarto na pininturahan sa pagitan ng umuupa o para mag-refresh."],
  ), [PAINT.walls(1.2), PAINT.wallPaint(0.35)], null, IN),

  "fq.interior_painting.core.walls_ceilings_trim": T("installation", n(
    ["Pittura interni — pareti, soffitti e cornici", "Pareti, soffitti e cornici delle stanze elencate dipinti, ciascuno nella finitura giusta."],
    ["Innenanstrich — Wände, Decken und Leisten", "Wände, Decken und Leisten der aufgeführten Räume gestrichen, jedes im passenden Glanzgrad."],
    ["Фарбування інтер'єру — стіни, стелі та лиштви", "Стіни, стелі й лиштви переліченних кімнат пофарбовано, кожне з відповідним блиском."],
    ["Pintura sa loob — pader, kisame at trim", "Pader, kisame at trim ng nakalistang kuwarto, bawat isa sa tamang sheen."],
  ), [PAINT.walls(), PAINT.ceilings(), PAINT.trim(), PAINT.wallPaint(), PAINT.ceilingPaint(), PAINT.trimPaint()], null, IN),

  "fq.interior_painting.core.walls_and_ceilings": T("installation", n(
    ["Pittura interni — pareti e soffitti", "Pareti e soffitti delle stanze elencate dipinti per una finitura pulita e uniforme."],
    ["Innenanstrich — Wände und Decken", "Wände und Decken der aufgeführten Räume für ein sauberes, gleichmäßiges Ergebnis gestrichen."],
    ["Фарбування інтер'єру — стіни та стелі", "Стіни й стелі переліченних кімнат пофарбовано для чистого, рівного результату."],
    ["Pintura sa loob — pader at kisame", "Pader at kisame ng nakalistang kuwarto para sa malinis at pantay na finish."],
  ), [PAINT.walls(), PAINT.ceilings(), PAINT.wallPaint(), PAINT.ceilingPaint()], null, IN),

  "fq.interior_painting.core.ceilings_flat_latex": T("installation", n(
    ["Pittura soffitti — lattice opaco per interni", "Soffitti dipinti con un lattice opaco di qualità che nasconde segni del rullo e imperfezioni."],
    ["Deckenanstrich — matter Innenlatex", "Decken mit hochwertigem mattem Innenlatex gestrichen, der Rollspuren und Unebenheiten verbirgt."],
    ["Фарбування стелі — матовий латекс", "Стелі пофарбовано якісним матовим латексом, що приховує сліди валика й нерівності."],
    ["Pintura ng kisame — flat interior latex", "Kisame na pininturahan ng de-kalidad na flat latex na nagtatago ng marka ng roller at depekto."],
  ), [PAINT.ceilings(1.5), PAINT.ceilingPaint(0.4)], null, IN),

  "fq.interior_painting.core.one_bedroom_apartment": T("installation", n(
    ["Pittura pareti — monolocale con una camera", "Pareti e soffitti di un appartamento con una camera dipinti, di solito una ripittura al cambio inquilino."],
    ["Wandanstrich — Einzimmerwohnung", "Wände und Decken einer Wohnung mit einem Schlafzimmer gestrichen, meist ein Anstrich beim Mieterwechsel."],
    ["Фарбування стін — однокімнатна квартира", "Стіни й стелі квартири з однією спальнею пофарбовано, зазвичай при зміні орендаря."],
    ["Pintura ng pader — apartment na may isang kuwarto", "Pader at kisame ng apartment na may isang kuwarto, karaniwang repaint sa pagpapalit ng umuupa."],
  ), [PAINT.walls(1.2), PAINT.ceilings(1.1), PAINT.wallPaint(0.35), PAINT.ceilingPaint(0.3)], null, IN),

  "fq.interior_painting.core.apartment_various": T("installation", n(
    ["Pittura appartamento — stanze di varie dimensioni", "Pareti, soffitti e ritocchi nelle stanze di un appartamento, quotati per dimensione della stanza."],
    ["Wohnungsanstrich — verschiedene Raumgrößen", "Wände, Decken und Ausbesserungen in den Räumen einer Wohnung, nach Raumgröße angeboten."],
    ["Фарбування квартири — кімнати різного розміру", "Стіни, стелі й підфарбовування в кімнатах квартири, ціна за розміром кімнати."],
    ["Pintura ng apartment — iba't ibang laki ng kuwarto", "Pader, kisame at touch-up sa mga kuwarto ng apartment, presyo ayon sa laki."],
  ), [PAINT.walls(1.3), PAINT.ceilings(1.2), PAINT.wallPaint(0.4), PAINT.ceilingPaint(0.3)], null, IN),

  "fq.interior_painting.prep.rooms_with_prep": T("installation", n(
    ["Pittura interni con preparazione completa — più stanze", "Cucina, bagni, soggiorno e sala da pranzo preparati e dipinti come un unico lavoro, stuccatura e primer inclusi."],
    ["Innenanstrich mit voller Vorbereitung — mehrere Räume", "Küche, Bäder, Wohn- und Esszimmer als ein Auftrag vorbereitet und gestrichen, Spachteln und Grundieren inklusive."],
    ["Фарбування інтер'єру з повною підготовкою — кілька кімнат", "Кухню, ванні, вітальню та їдальню підготовлено й пофарбовано як одну роботу, шпаклювання й ґрунт включено."],
    ["Pintura sa loob na may buong prep — ilang kuwarto", "Inihanda at pininturahan ang kusina, banyo, sala at kainan bilang isang trabaho, kasama ang tapal at primer."],
  ), [PAINT.walls(1.8), PREP_PATCH(150), PAINT.wallPaint(0.55)], null, IN),

  // ── Cabinets ──
  "fq.interior_painting.cabinets.cabinet_painting": T("installation", n(
    ["Pittura mobili", "Mobili di cucina o bagno puliti, carteggiati e verniciati a spruzzo con un rivestimento resistente per una finitura da fabbrica."],
    ["Schrankanstrich", "Küchen- oder Badschränke gereinigt, geschliffen und mit strapazierfähiger Beschichtung gespritzt — wie ab Werk."],
    ["Фарбування шаф", "Кухонні чи ванні шафи очищено, відшліфовано й пофарбовано розпиленням зносостійким покриттям, як із заводу."],
    ["Pintura ng cabinet", "Nilinis, hinasa at ini-spray ng matibay na coating ang cabinet sa kusina o banyo para parang galing pabrika."],
  ), [PAINT.cabinetDoors(), PAINT.cabinetDrawers(), PAINT.cabinetCoating()], null, CAB),

  "fq.interior_painting.cabinets.kitchen_refinish_full": T("installation", n(
    ["Rinnovo mobili cucina e pittura completa", "Ante, frontali e scocche sgrassati, carteggiati, primerizzati e verniciati a spruzzo per una cucina come nuova senza sostituire i mobili."],
    ["Küchenschränke komplett neu lackieren", "Türen, Schubladenfronten und Korpusse entfettet, geschliffen, grundiert und gespritzt — wie neu, ohne Austausch."],
    ["Оновлення кухонних шаф і повне фарбування", "Дверцята, фасади та корпуси знежирено, відшліфовано, заґрунтовано й пофарбовано розпиленням — як нова кухня без заміни шаф."],
    ["Refinish at buong pintura ng cabinet sa kusina", "Nilinis, hinasa, nilagyan ng primer at ini-spray ang pinto, drawer at box para parang bago nang hindi pinapalitan."],
  ), [
    PAINT.cabinetDoors(115), PAINT.cabinetDrawers(80),
    L.labour(1, "flat", 450, {
      en: ["Cabinet box painting", "Face frames and exposed box ends sanded, primed and brushed or sprayed on site."],
      fr: ["Peinture des caissons", "Cadres de façade et côtés apparents sablés, apprêtés et peints au pinceau ou au pistolet sur place."],
      es: ["Pintura de cajas de gabinete", "Marcos frontales y costados visibles lijados, imprimados y pintados a brocha o pistola en sitio."],
      it: ["Pittura delle scocche", "Telai frontali e fianchi a vista carteggiati, primerizzati e verniciati a pennello o spruzzo sul posto."],
      de: ["Korpusanstrich", "Rahmen und sichtbare Seiten geschliffen, grundiert und vor Ort gestrichen oder gespritzt."],
      uk: ["Фарбування корпусів", "Фасадні рамки та видимі боковини відшліфовано, заґрунтовано й пофарбовано на місці."],
      tl: ["Pintura ng cabinet box", "Hinasa, nilagyan ng primer at pininturahan sa lugar ang face frame at nakikitang gilid ng box."],
    }),
    PAINT.cabinetCoating(16),
  ], null, CAB),

  "fq.interior_painting.cabinets.kitchen_paint_refinish": T("installation", n(
    ["Pittura e rinnovo mobili cucina", "Mobili di cucina rinnovati con un rivestimento a spruzzo resistente scelto per l'uso quotidiano."],
    ["Küchenschränke streichen und auffrischen", "Küchenschränke mit einer gespritzten, strapazierfähigen Beschichtung für den Alltag neu beschichtet."],
    ["Фарбування та оновлення кухонних шаф", "Кухонні шафи оновлено зносостійким покриттям розпиленням, розрахованим на щоденне користування."],
    ["Pintura at refinish ng cabinet sa kusina", "Ni-refinish ang cabinet sa kusina gamit ang matibay na spray coating para sa araw-araw na gamit."],
  ), [PAINT.cabinetDoors(), PAINT.cabinetDrawers(), PAINT.cabinetCoating()], null, CAB),

  // ── Prep and repair ──
  "fq.interior_painting.prep.surface_preparation": T("repair", n(
    ["Preparazione delle superfici", "Pulizia, carteggiatura, stuccatura e primer perché la pittura aderisca e la finitura duri."],
    ["Untergrundvorbereitung", "Reinigen, Schleifen, Spachteln und Grundieren, damit die Farbe haftet und hält."],
    ["Підготовка поверхонь", "Очищення, шліфування, шпаклювання та ґрунтування, щоб фарба трималася й служила довго."],
    ["Paghahanda ng ibabaw", "Paglilinis, paghasa, pagtapal at priming para kumapit ang pintura at tumagal."],
  ), [
    L.labour(1, "sqft", 0.55, {
      en: ["Surface prep — per sq ft", "Walls washed, scuff-sanded, patched and primed where needed."],
      fr: ["Préparation — au pi²", "Murs lavés, égrenés, rebouchés et apprêtés au besoin."],
      es: ["Preparación — por pie²", "Muros lavados, lijados, resanados e imprimados donde hace falta."],
      it: ["Preparazione — al piede quadro", "Pareti lavate, carteggiate, stuccate e primerizzate dove serve."],
      de: ["Vorbereitung — pro sq ft", "Wände gewaschen, angeschliffen, gespachtelt und wo nötig grundiert."],
      uk: ["Підготовка — за кв. фут", "Стіни вимито, зашліфовано, зашпакльовано й заґрунтовано, де потрібно."],
      tl: ["Prep — kada sq ft", "Hinugasan, hinasa, tinapalan at nilagyan ng primer ang pader kung kailangan."],
    }, { measurementKey: "wallSqft" }),
    L.material(1, "sqft", 0.15, {
      en: ["Primer and filler — per sq ft", "Stain-blocking primer, filler and sandpaper."],
      fr: ["Apprêt et bouche-pores — au pi²", "Apprêt bloque-taches, pâte à reboucher et papier sablé."],
      es: ["Imprimador y resanador — por pie²", "Imprimador bloqueador de manchas, resanador y lija."],
      it: ["Primer e stucco — al piede quadro", "Primer antimacchia, stucco e carta abrasiva."],
      de: ["Grundierung und Spachtel — pro sq ft", "Sperrgrund, Spachtelmasse und Schleifpapier."],
      uk: ["Ґрунт і шпаклівка — за кв. фут", "Ґрунт, що блокує плями, шпаклівка та наждачний папір."],
      tl: ["Primer at filler — kada sq ft", "Stain-blocking na primer, filler at liha."],
    }, { measurementKey: "wallSqft" }),
  ], null, IN),

  "fq.interior_painting.prep.drywall_patch": T("repair", n(
    ["Riparazione e rappezzo cartongesso", "Buchi, ammaccature e crepe stuccati, nastrati e carteggiati lisci, pronti per la pittura."],
    ["Trockenbau flicken und reparieren", "Löcher, Dellen und Risse gespachtelt, verbandet und glatt geschliffen, streichfertig."],
    ["Латання й ремонт гіпсокартону", "Дірки, вм'ятини й тріщини зашпакльовано, проклеєно й відшліфовано гладко під фарбування."],
    ["Patch at pag-ayos ng drywall", "Tinapalan, tinape at hinasa nang makinis ang butas, yupi at bitak, handa sa pintura."],
  ), [
    L.labour(1, "each", 75, {
      en: ["Drywall patch — per patch", "Hole cut square, backed, patched, three coats of compound and sanded."],
      fr: ["Rapiéçage de gypse — la pièce", "Trou équarri, renforcé, rapiécé, trois couches de composé et sablé."],
      es: ["Parche de panel de yeso — por parche", "Agujero escuadrado, reforzado, parchado, tres manos de pasta y lijado."],
      it: ["Rappezzo cartongesso — per rappezzo", "Buco squadrato, rinforzato, rappezzato, tre mani di stucco e carteggiato."],
      de: ["Trockenbauflicken — pro Stelle", "Loch rechtwinklig geschnitten, hinterlegt, geflickt, drei Lagen Spachtel und geschliffen."],
      uk: ["Латка гіпсокартону — за латку", "Отвір вирівняно, підкріплено, залатано, три шари шпаклівки й шліфування."],
      tl: ["Patch ng drywall — kada patch", "Pinakuwadrado, nilagyan ng backer, tinapalan, tatlong patong ng compound at hinasa."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 9, {
      en: ["Patch materials — per patch", "Drywall offcut or mesh patch, compound and tape."],
      fr: ["Matériaux de rapiéçage — la pièce", "Retaille de gypse ou treillis, composé et ruban."],
      es: ["Material de parche — por parche", "Recorte de panel o malla, pasta y cinta."],
      it: ["Materiale per rappezzo — per rappezzo", "Ritaglio di cartongesso o rete, stucco e nastro."],
      de: ["Flickmaterial — pro Stelle", "Plattenrest oder Gewebe, Spachtel und Band."],
      uk: ["Матеріали для латки — за латку", "Обрізок гіпсокартону або сітка, шпаклівка та стрічка."],
      tl: ["Materyales sa patch — kada patch", "Tirang drywall o mesh, compound at tape."],
    }, { measurementKey: "each" }),
  ], null, IN),

  "fq.interior_painting.prep.caulking_sealing": T("maintenance", n(
    ["Sigillatura", "Fessure su cornici, angoli e giunti sigillate prima della pittura per una linea netta."],
    ["Fugen abdichten", "Spalten an Leisten, Ecken und Stößen vor dem Anstrich versiegelt für eine saubere Linie."],
    ["Герметизація", "Щілини біля лиштв, у кутах і на стиках загерметизовано перед фарбуванням для чистої лінії."],
    ["Caulking at sealing", "Kinaulk ang puwang sa trim, kanto at dugtungan bago magpinta para malinis ang linya."],
  ), [
    L.labour(1, "linear_ft", 1.5, {
      en: ["Caulking — per linear ft", "Old caulk cut out where cracked and a fresh paintable bead tooled in."],
      fr: ["Calfeutrage — au pi lin.", "Vieux calfeutrant fissuré enlevé et nouveau cordon peinturable lissé."],
      es: ["Sellado — por pie lineal", "Sellador viejo agrietado retirado y un cordón nuevo pintable alisado."],
      it: ["Sigillatura — al piede lineare", "Vecchio sigillante crepato tolto e nuovo cordone verniciabile lisciato."],
      de: ["Verfugen — pro lfd. Fuß", "Gerissene alte Fuge entfernt und eine neue überstreichbare Raupe gezogen."],
      uk: ["Герметизація — за пог. фут", "Тріснутий старий герметик видалено, новий шов під фарбування розгладжено."],
      tl: ["Caulking — kada linear ft", "Tinanggal ang basag na lumang caulk at nilagyan ng bagong paintable na linya."],
    }, { measurementKey: "linearFt" }),
    hdMaterial(HD.caulk_tube, {
      en: ["Caulk — per tube", "Paintable elastomeric sealant; one tube runs about 40 linear ft."],
      fr: ["Calfeutrant — le tube", "Scellant élastomère peinturable; un tube fait environ 40 pi lin."],
      es: ["Sellador — por tubo", "Sellador elastomérico pintable; un tubo rinde unos 40 pies lineales."],
      it: ["Sigillante — per cartuccia", "Sigillante elastomerico verniciabile; una cartuccia fa circa 40 piedi lineari."],
      de: ["Dichtstoff — pro Kartusche", "Überstreichbarer elastischer Dichtstoff; eine Kartusche reicht für etwa 40 lfd. Fuß."],
      uk: ["Герметик — за тубу", "Еластичний герметик під фарбування; туба на близько 40 пог. футів."],
      tl: ["Caulk — kada tubo", "Paintable na elastomeric sealant; ang isang tubo ay para sa mga 40 linear ft."],
    }, { measurementKey: "linearFt" }),
  ], null, BOTH),

  "fq.interior_painting.prep.popcorn_removal_paint": T("repair", n(
    ["Rimozione soffitto a buccia d'arancia e pittura", "Intonaco a spruzzo raschiato, superficie rasata e carteggiata, poi primerizzata e dipinta opaca."],
    ["Popcorn-Decke entfernen und streichen", "Spritzputz abgekratzt, Fläche gespachtelt und geschliffen, dann grundiert und matt gestrichen."],
    ["Зняття «попкорн»-стелі та фарбування", "Фактурне покриття зішкрябано, поверхню зашпакльовано й відшліфовано, заґрунтовано й пофарбовано матово."],
    ["Pagtanggal ng popcorn ceiling at pintura", "Kinayod ang popcorn texture, sinkim at hinasa, nilagyan ng primer at flat na pintura."],
  ), [
    L.labour(1, "sqft", 2.75, {
      en: ["Popcorn removal and skim — per sq ft", "Room sealed off, texture wetted and scraped, the ceiling skim-coated and sanded."],
      fr: ["Enlèvement du crépi et lissage — au pi²", "Pièce isolée, crépi mouillé et gratté, plafond enduit et sablé."],
      es: ["Retiro de popcorn y alisado — por pie²", "Habitación sellada, textura mojada y raspada, techo alisado con pasta y lijado."],
      it: ["Rimozione e rasatura — al piede quadro", "Stanza isolata, intonaco bagnato e raschiato, soffitto rasato e carteggiato."],
      de: ["Entfernen und Spachteln — pro sq ft", "Raum abgeschottet, Putz eingeweicht und abgekratzt, Decke gespachtelt und geschliffen."],
      uk: ["Зняття фактури та шпаклювання — за кв. фут", "Кімнату ізольовано, фактуру змочено й зішкрябано, стелю зашпакльовано й відшліфовано."],
      tl: ["Pagtanggal at skim — kada sq ft", "Sinelyuhan ang kuwarto, binasa at kinayod ang texture, sinkim at hinasa ang kisame."],
    }, { measurementKey: "ceilingSqft" }),
    PAINT.ceilings(),
    PAINT.ceilingPaint(0.45),
  ], null, IN),

  "fq.interior_painting.prep.wallpaper_removal": T("repair", n(
    ["Rimozione carta da parati", "Carta da parati strappata, colla lavata, cartongesso danneggiato riparato e pareti primerizzate per la pittura."],
    ["Tapete entfernen", "Tapete abgezogen, Kleister abgewaschen, beschädigter Trockenbau repariert und Wände für den Anstrich grundiert."],
    ["Зняття шпалер", "Шпалери знято, клей змито, пошкоджений гіпсокартон відремонтовано, стіни заґрунтовано під фарбування."],
    ["Pagtanggal ng wallpaper", "Tinanggal ang wallpaper, hinugasan ang pandikit, inayos ang sirang drywall at nilagyan ng primer ang pader."],
  ), [
    L.labour(1, "sqft", 1.75, {
      en: ["Wallpaper stripping — per sq ft", "Paper scored and steamed off, adhesive washed and the wall repaired."],
      fr: ["Décollage du papier peint — au pi²", "Papier entaillé et décollé à la vapeur, colle lavée et mur réparé."],
      es: ["Retiro de papel tapiz — por pie²", "Papel rayado y retirado con vapor, adhesivo lavado y muro reparado."],
      it: ["Rimozione carta — al piede quadro", "Carta incisa e staccata a vapore, colla lavata e parete riparata."],
      de: ["Tapete ablösen — pro sq ft", "Tapete perforiert und abgedampft, Kleister abgewaschen und Wand repariert."],
      uk: ["Зняття шпалер — за кв. фут", "Шпалери надрізано й знято парою, клей змито, стіну відремонтовано."],
      tl: ["Pagtanggal ng wallpaper — kada sq ft", "Ginasgas at pinasingawan ang papel, hinugasan ang pandikit at inayos ang pader."],
    }, { measurementKey: "wallSqft" }),
    L.material(1, "sqft", 0.2, {
      en: ["Oil-based primer — per sq ft", "Oil or shellac primer that seals leftover adhesive before paint."],
      fr: ["Apprêt à l'huile — au pi²", "Apprêt à l'huile ou à la gomme-laque qui scelle les résidus de colle avant la peinture."],
      es: ["Imprimador base aceite — por pie²", "Imprimador de aceite o goma laca que sella restos de adhesivo antes de pintar."],
      it: ["Primer a olio — al piede quadro", "Primer a olio o gommalacca che sigilla i residui di colla prima della pittura."],
      de: ["Ölbasierte Grundierung — pro sq ft", "Öl- oder Schellackgrund, der Kleisterreste vor dem Anstrich absperrt."],
      uk: ["Ґрунт на олійній основі — за кв. фут", "Олійний або шелаковий ґрунт, що ізолює залишки клею перед фарбуванням."],
      tl: ["Oil-based primer — kada sq ft", "Oil o shellac primer na nagsasara ng natirang pandikit bago pinturahan."],
    }, { measurementKey: "wallSqft" }),
  ], null, IN),
};

withTemplates(SEED, TEMPLATES);
