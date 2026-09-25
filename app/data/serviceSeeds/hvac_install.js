// app/data/serviceSeeds/hvac_install.js
//
// The service list an HVAC installation company starts from. Read the header
// of ./index.js for the format and the rules every file in this folder follows.
//
// This file carries only the benchmark's "System Installation" heading — whole
// systems, ductless heads, and the components that go in with them. Every
// other HVAC heading (repairs, tune-ups, refrigerant, controls) sits in
// ./hvac_repair.js, because the catalogue splits the trade in two and a
// company usually picks one.
//
// Two rows here are not installations — a heat-pump repair and a system
// relocation — but the source filed them under installation and the join-back
// map has to hold row by row, so they are kept under "additional" rather than
// moved to the repair file.
//
// No takeoff or price book exists for HVAC, so nothing here is pricedBy; every
// row is a flat-priced service the company sets its own rate on.

import { L, SHARED, D, T, withTemplates } from "./_templateLines";

export const SEED = {
  trade: "hvac_install",
  categories: [
    {
      key: "central",
      name: {
        en: "Central systems",
        fr: "Systèmes centraux",
        es: "Sistemas centrales",
      },
    },
    {
      key: "ductless",
      name: {
        en: "Ductless mini-splits",
        fr: "Thermopompes murales sans conduits",
        es: "Mini splits sin ductos",
      },
    },
    {
      key: "components",
      name: {
        en: "Components and add-on equipment",
        fr: "Composants et équipements complémentaires",
        es: "Componentes y equipos adicionales",
      },
    },
    {
      key: "additional",
      name: {
        en: "Additional installation work",
        fr: "Travaux d'installation complémentaires",
        es: "Trabajos de instalación adicionales",
      },
    },
  ],
  services: [
    // ── Central systems ──────────────────────────────────────────────────
    {
      seedKey: "fq.hvac_install.central.split_3_5_ton",
      category: "central",
      name: {
        en: "3.5-ton split system installation — air handler, condenser and heat kit",
        fr: "Système bibloc de 3,5 tonnes — ventilo-convecteur, condenseur et bloc chauffant",
        es: "Sistema split de 3.5 toneladas — manejadora, condensador y kit de calefacción",
      },
      description: {
        en: "A complete 3.5-ton split system: indoor air handler, outdoor condenser and electric heat kit set in place and connected, with the duct joints sealed and the equipment warranty registered.",
        fr: "Système bibloc complet de 3,5 tonnes : ventilo-convecteur intérieur, condenseur extérieur et bloc chauffant électrique posés et raccordés, joints de conduits scellés et garantie du fabricant enregistrée.",
        es: "Sistema split completo de 3.5 toneladas: manejadora interior, condensador exterior y kit de calefacción eléctrica instalados y conectados, con las uniones de ductos selladas y la garantía registrada.",
      },
      unit: "flat",
      benchmark: { low: 6998, median: 9480, high: 12900, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.central.split_ac_4_ton",
      category: "central",
      name: {
        en: "4-ton split air conditioning installation",
        fr: "Installation d'un climatiseur bibloc de 4 tonnes",
        es: "Instalación de aire acondicionado split de 4 toneladas",
      },
      description: {
        en: "Removal of the old equipment and installation of a 4-ton split air conditioner, tied into the existing ductwork, electrical and refrigerant lines.",
        fr: "Retrait de l'ancien équipement et pose d'un climatiseur bibloc de 4 tonnes, raccordé aux conduits, à l'alimentation électrique et aux conduites frigorifiques existants.",
        es: "Retiro del equipo viejo e instalación de un aire acondicionado split de 4 toneladas, conectado a los ductos, la electricidad y las líneas de refrigerante existentes.",
      },
      unit: "flat",
      benchmark: { low: 5700, median: 8800, high: 12162, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.central.heat_pump_2_5_ton",
      category: "central",
      name: {
        en: "2.5-ton heat pump system installation",
        fr: "Installation d'une thermopompe centrale de 2,5 tonnes",
        es: "Instalación de bomba de calor de 2.5 toneladas",
      },
      description: {
        en: "The existing system is taken out and a 2.5-ton heat pump is installed in its place, giving both heating and cooling from one outdoor unit.",
        fr: "Le système en place est retiré et une thermopompe de 2,5 tonnes est installée à sa place, pour chauffer comme climatiser à partir d'une seule unité extérieure.",
        es: "Se retira el sistema actual y se instala una bomba de calor de 2.5 toneladas en su lugar, que calienta y enfría desde una sola unidad exterior.",
      },
      unit: "flat",
      benchmark: { low: 6200, median: 8423, high: 11315, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.central.system_2_to_3_5_ton",
      category: "central",
      name: {
        en: "2 to 3.5-ton central system installation",
        fr: "Installation d'un système central de 2 à 3,5 tonnes",
        es: "Instalación de sistema central de 2 a 3.5 toneladas",
      },
      description: {
        en: "A central heating and cooling system sized between 2 and 3.5 tons, installed, wired and started up along with its thermostat and accessories.",
        fr: "Système central de chauffage et de climatisation de 2 à 3,5 tonnes, installé, câblé et mis en marche avec son thermostat et ses accessoires.",
        es: "Sistema central de calefacción y enfriamiento de entre 2 y 3.5 toneladas, instalado, cableado y puesto en marcha junto a su termostato y accesorios.",
      },
      unit: "flat",
      benchmark: { low: 2800, median: 5763, high: 8700, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.central.system_5_ton",
      category: "central",
      name: {
        en: "5-ton central system installation — air handler, condenser and furnace",
        fr: "Système central de 5 tonnes — ventilo-convecteur, condenseur et fournaise",
        es: "Instalación de sistema central de 5 toneladas — manejadora, condensador y horno",
      },
      description: {
        en: "A 5-ton system installed as a set: air handler, outdoor condenser and furnace, including the duct, electrical and gas modifications needed to fit it.",
        fr: "Système de 5 tonnes installé en ensemble : ventilo-convecteur, condenseur extérieur et fournaise, y compris les modifications aux conduits, à l'électricité et au gaz nécessaires pour l'adapter.",
        es: "Sistema de 5 toneladas instalado como conjunto: manejadora, condensador exterior y horno, incluyendo las modificaciones de ductos, electricidad y gas necesarias para adaptarlo.",
      },
      unit: "flat",
      benchmark: { low: 5512, median: 9249, high: 13175, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },

    // ── Ductless mini-splits ─────────────────────────────────────────────
    {
      seedKey: "fq.hvac_install.ductless.mini_split",
      category: "ductless",
      name: {
        en: "Ductless mini-split installation — single zone",
        fr: "Installation d'une thermopompe murale sans conduits — une zone",
        es: "Instalación de mini split sin ductos — una zona",
      },
      description: {
        en: "One indoor head and its outdoor unit mounted, piped and wired, then set up and commissioned so it heats and cools one room or open area.",
        fr: "Une unité intérieure murale et son unité extérieure fixées, raccordées et câblées, puis configurées et mises en service pour chauffer et climatiser une pièce ou une aire ouverte.",
        es: "Una unidad interior y su unidad exterior montadas, conectadas y cableadas, luego configuradas y puestas en marcha para calentar y enfriar una habitación o área abierta.",
      },
      unit: "flat",
      benchmark: { low: 1174, median: 3600, high: 6500, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.ductless.cold_climate_heat_pump",
      category: "ductless",
      name: {
        en: "Cold-climate mini-split heat pump installation",
        fr: "Installation d'une thermopompe murale pour climat froid",
        es: "Instalación de mini split bomba de calor para clima frío",
      },
      description: {
        en: "A mini-split heat pump rated for deep winter, installed so it keeps producing efficient heat when the outdoor temperature drops well below freezing.",
        fr: "Thermopompe murale conçue pour l'hiver québécois, installée de façon à continuer de chauffer efficacement quand le mercure descend bien sous zéro.",
        es: "Mini split bomba de calor diseñado para inviernos severos, instalado para que siga calentando de forma eficiente cuando la temperatura exterior baja muy por debajo de cero.",
      },
      unit: "flat",
      benchmark: { low: 4747, median: 7832, high: 12995, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.ductless.multi_zone",
      category: "ductless",
      name: {
        en: "Multi-zone mini-split installation",
        fr: "Installation d'une thermopompe murale multizone",
        es: "Instalación de mini split multizona",
      },
      description: {
        en: "Several indoor heads run from one outdoor unit, each room on its own control, with all line sets, wiring and mounts included and the warranty registered.",
        fr: "Plusieurs unités intérieures alimentées par une seule unité extérieure, chaque pièce réglée séparément, conduites, câblage et supports compris, garantie enregistrée.",
        es: "Varias unidades interiores alimentadas por una sola unidad exterior, cada habitación con su propio control, incluyendo líneas, cableado y soportes, más el registro de garantía.",
      },
      unit: "flat",
      benchmark: { low: 1254, median: 4261, high: 8750, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.ductless.condenser",
      category: "ductless",
      name: {
        en: "Mini-split condenser installation",
        fr: "Installation du condenseur d'une thermopompe murale",
        es: "Instalación de condensador de mini split",
      },
      description: {
        en: "The outdoor mini-split unit set on its pad or bracket, wired, joined to the copper line set and checked for leaks before start-up.",
        fr: "Unité extérieure de thermopompe murale posée sur sa base ou son support, câblée, raccordée à la conduite de cuivre et vérifiée contre les fuites avant la mise en marche.",
        es: "Unidad exterior de mini split colocada sobre su base o soporte, cableada, unida a la línea de cobre y revisada contra fugas antes de arrancar.",
      },
      unit: "flat",
      benchmark: { low: 600, median: 2525, high: 5217, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },

    // ── Components and add-on equipment ──────────────────────────────────
    {
      seedKey: "fq.hvac_install.components.dehumidifiers",
      category: "components",
      name: {
        en: "Whole-home dehumidifier installation and service",
        fr: "Installation et entretien de déshumidificateurs centraux",
        es: "Instalación y servicio de deshumidificadores centrales",
      },
      description: {
        en: "One or more ducted dehumidifiers fitted to the air system, the connections sealed, and the system checked over once they are running.",
        fr: "Un ou plusieurs déshumidificateurs raccordés aux conduits de ventilation, connexions scellées, puis vérification complète du système une fois en marche.",
        es: "Uno o más deshumidificadores conectados a los ductos, con las uniones selladas y una revisión del sistema una vez en funcionamiento.",
      },
      unit: "flat",
      benchmark: { low: 380, median: 1474, high: 4042, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.components.ductwork",
      category: "components",
      name: {
        en: "Ductwork installation",
        fr: "Installation de conduits de ventilation",
        es: "Instalación de ductos",
      },
      description: {
        en: "New supply and return ducts run, hung and sealed so conditioned air reaches every room at the right volume.",
        fr: "Conduits d'alimentation et de retour posés, suspendus et scellés pour que l'air traité atteigne chaque pièce au bon débit.",
        es: "Ductos de suministro y retorno nuevos, tendidos, colgados y sellados para que el aire acondicionado llegue a cada habitación en el volumen correcto.",
      },
      unit: "flat",
      benchmark: { low: 600, median: 1653, high: 4840, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.components.air_handler",
      category: "components",
      name: {
        en: "Air handler installation",
        fr: "Installation d'un ventilo-convecteur",
        es: "Instalación de manejadora de aire",
      },
      description: {
        en: "An indoor air handler set in place and joined to the ducts, drain, refrigerant lines and power, then started and balanced.",
        fr: "Ventilo-convecteur intérieur mis en place et raccordé aux conduits, au drain, aux conduites frigorifiques et au courant, puis démarré et équilibré.",
        es: "Manejadora de aire interior instalada y conectada a los ductos, el drenaje, las líneas de refrigerante y la corriente, luego arrancada y balanceada.",
      },
      unit: "flat",
      benchmark: { low: 450, median: 1242, high: 3027, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.components.boiler_zone_valves",
      category: "components",
      name: {
        en: "Boiler installation and zone valve replacement — owner-supplied boiler",
        fr: "Installation d'une chaudière fournie par le client et remplacement des vannes de zone",
        es: "Instalación de caldera suministrada por el cliente y reemplazo de válvulas de zona",
      },
      description: {
        en: "A boiler you have already bought is set and piped in, the zone valves are replaced, the gas line is re-run as needed and everything is left ready for inspection.",
        fr: "Chaudière fournie par le propriétaire posée et raccordée, vannes de zone remplacées, conduite de gaz refaite au besoin, le tout prêt pour l'inspection.",
        es: "Caldera comprada por el propietario instalada y conectada, válvulas de zona reemplazadas, línea de gas reubicada según haga falta y todo listo para inspección.",
      },
      unit: "flat",
      benchmark: { low: 350, median: 1183, high: 4739, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.components.generator",
      category: "components",
      name: {
        en: "Backup generator installation for heating and cooling",
        fr: "Installation d'une génératrice de secours pour le chauffage et la climatisation",
        es: "Instalación de generador de respaldo para calefacción y aire acondicionado",
      },
      description: {
        en: "A standby generator installed and wired so the furnace, heat pump or air conditioner keeps running through a power outage.",
        fr: "Génératrice de secours installée et câblée pour que la fournaise, la thermopompe ou le climatiseur continue de fonctionner pendant une panne de courant.",
        es: "Generador de respaldo instalado y cableado para que el horno, la bomba de calor o el aire acondicionado sigan funcionando durante un apagón.",
      },
      unit: "flat",
      benchmark: { low: 275, median: 1260, high: 5406, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },

    // ── Additional installation work ─────────────────────────────────────
    {
      // The source files this repair under "System Installation"; it stays
      // here so the join-back map holds, not because it is an install.
      seedKey: "fq.hvac_install.additional.heat_pump_repair",
      category: "additional",
      name: {
        en: "Heat pump repair",
        fr: "Réparation de thermopompe",
        es: "Reparación de bomba de calor",
      },
      description: {
        en: "Fault-finding and repair on a heat pump that is short on heat or cooling, so it gets back to full output.",
        fr: "Recherche de panne et réparation d'une thermopompe qui manque de chauffage ou de climatisation, pour la ramener à plein rendement.",
        es: "Diagnóstico y reparación de una bomba de calor que no calienta o enfría como debe, para devolverla a su rendimiento completo.",
      },
      unit: "flat",
      benchmark: { low: 130, median: 249, high: 984, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.relocate_system",
      category: "additional",
      name: {
        en: "HVAC system relocation",
        fr: "Déplacement d'un système de chauffage et climatisation",
        es: "Reubicación de sistema de climatización",
      },
      description: {
        en: "Existing equipment moved to a new spot on the property, reconnected with any components that need replacing, then tuned up so it runs as it should.",
        fr: "Équipement existant déplacé à un nouvel emplacement sur la propriété, raccordé de nouveau en remplaçant les composants nécessaires, puis mis au point pour fonctionner correctement.",
        es: "Equipo existente trasladado a otro punto de la propiedad, reconectado reemplazando los componentes necesarios, y afinado para que funcione como corresponde.",
      },
      unit: "flat",
      benchmark: { low: 178, median: 647, high: 2080, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    {
      seedKey: "fq.hvac_install.central.ac_economy",
      category: "central",
      name: { en: "Central air conditioner installation — economy, 14 SEER", fr: "Installation de climatiseur central — économique, 14 SEER", es: "Instalación de aire acondicionado central — económico, 14 SEER" },
      description: {
        en: "The old condenser removed and a single-stage 14 SEER air conditioner set, connected to the existing line set and power, and started up.",
        fr: "Ancien condenseur retiré et climatiseur 14 SEER à une vitesse posé, raccordé aux conduites et à l'alimentation existantes, puis mis en marche.",
        es: "Condensador viejo retirado y un aire acondicionado de 14 SEER de una etapa colocado, conectado a la tubería y la alimentación existentes y puesto en marcha.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.central.ac_top_shelf",
      category: "central",
      name: { en: "Central air conditioner installation — top shelf, 16 SEER", fr: "Installation de climatiseur central — haut de gamme, 16 SEER", es: "Instalación de aire acondicionado central — gama alta, 16 SEER" },
      description: {
        en: "A 16 SEER communicating air conditioner with a touch-screen thermostat installed in place of the old unit, with a ten-year labour warranty.",
        fr: "Climatiseur communicant 16 SEER avec thermostat à écran tactile installé à la place de l'ancien appareil, garantie de main-d'œuvre de dix ans.",
        es: "Aire acondicionado comunicante de 16 SEER con termostato de pantalla táctil instalado en lugar del equipo viejo, con garantía de mano de obra de diez años.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.standard_install",
      category: "additional",
      name: { en: "Standard installation", fr: "Installation standard", es: "Instalación estándar" },
      description: {
        en: "Heating or cooling equipment the client has chosen installed, connected and started, priced by the job.",
        fr: "Équipement de chauffage ou de climatisation choisi par le client installé, raccordé et mis en marche, prix à forfait.",
        es: "Equipo de calefacción o enfriamiento elegido por el cliente instalado, conectado y puesto en marcha, cotizado por trabajo.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.mini_split_repair",
      category: "additional",
      name: { en: "Ductless mini-split repair", fr: "Réparation de thermopompe murale", es: "Reparación de mini split" },
      description: {
        en: "A head that will not heat or cool, drips or shows an error code traced to the board, sensor, fan or refrigerant and repaired.",
        fr: "Unité murale qui ne chauffe ni ne refroidit, coule ou affiche un code d'erreur : cause trouvée à la carte, sonde, ventilateur ou frigorigène et réparée.",
        es: "Unidad que no calienta ni enfría, gotea o muestra un código de error: causa localizada en la tarjeta, sensor, ventilador o refrigerante y reparada.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.ductwork_repair",
      category: "additional",
      name: { en: "Ductwork repair", fr: "Réparation de conduits", es: "Reparación de ductos" },
      description: {
        en: "Crushed, disconnected or leaking duct runs reconnected, resealed and re-hung so the air reaches the rooms it was meant for.",
        fr: "Conduits écrasés, déconnectés ou qui fuient reconnectés, rescellés et resuspendus pour que l'air atteigne les bonnes pièces.",
        es: "Ductos aplastados, desconectados o con fugas reconectados, resellados y recolgados para que el aire llegue a las habitaciones previstas.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.load_calculation",
      category: "additional",
      name: { en: "Heating and cooling load calculation", fr: "Calcul de charge thermique", es: "Cálculo de carga térmica" },
      description: {
        en: "The house measured room by room and a load calculation run so the new system is sized to the home, not to the old unit.",
        fr: "Maison mesurée pièce par pièce et calcul de charge fait pour dimensionner le nouveau système selon la maison, pas selon l'ancien appareil.",
        es: "Casa medida habitación por habitación y cálculo de carga hecho para dimensionar el equipo nuevo según la casa, no según el equipo viejo.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.install_estimate_visit",
      category: "additional",
      name: { en: "Replacement estimate visit", fr: "Visite d'estimation de remplacement", es: "Visita de presupuesto de reemplazo" },
      description: {
        en: "The existing equipment, ducts and electrical looked over and good, better and best replacement options priced in writing.",
        fr: "Équipement, conduits et électricité existants examinés et options de remplacement bonne, meilleure et supérieure chiffrées par écrit.",
        es: "Equipo, ductos y electricidad existentes revisados y opciones de reemplazo buena, mejor y superior cotizadas por escrito.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: 60,
      bookable: true,
    },
    {
      seedKey: "fq.hvac_install.additional.duct_leakage_test",
      category: "additional",
      name: { en: "Duct leakage test", fr: "Test d'étanchéité des conduits", es: "Prueba de fugas en ductos" },
      description: {
        en: "The duct system pressurised and its leakage measured, with the worst joints located for sealing.",
        fr: "Réseau de conduits mis sous pression et fuites mesurées, pires joints localisés pour le scellement.",
        es: "Sistema de ductos presurizado y sus fugas medidas, con las peores uniones ubicadas para sellarlas.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.mini_split_cleaning",
      category: "additional",
      name: { en: "Mini-split deep cleaning — per head", fr: "Nettoyage en profondeur de thermopompe murale — par unité", es: "Limpieza profunda de mini split — por unidad" },
      description: {
        en: "The indoor head bagged and washed through, the blower wheel and coil cleaned and the drain flushed, so it stops smelling and blows full air.",
        fr: "Unité intérieure ensachée et lavée, roue et serpentin nettoyés et drain purgé, pour qu'elle cesse de sentir et souffle à plein débit.",
        es: "Unidad interior embolsada y lavada, turbina y serpentín limpios y drenaje purgado, para que deje de oler y sople a pleno.",
      },
      unit: "each",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_install.additional.first_year_service",
      category: "additional",
      name: { en: "New system first-year service", fr: "Entretien de première année du nouveau système", es: "Servicio del primer año del equipo nuevo" },
      description: {
        en: "The first check after an installation: refrigerant charge, drain, electrical and airflow confirmed and the warranty registration checked.",
        fr: "Première vérification après l'installation : charge de frigorigène, drain, électricité et débit confirmés, enregistrement de la garantie vérifié.",
        es: "Primera revisión tras la instalación: carga de refrigerante, drenaje, electricidad y flujo de aire confirmados y el registro de la garantía verificado.",
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
// Evidence: the HVAC template capture under docs/research/ — A/C installation
// "Economy" ($12,500 14 SEER unit at $12,000 cost, $200 removal, $200 install,
// $400 off) and "Top Shelf" ($14,000 16 SEER unit at $13,500, $600 thermostat
// at $550, same labour and discount) — carried at the captured prices and
// costs. The other templates are priced to the benchmark medians on their
// rows ($3,600 single-zone mini-split, $8,423 heat pump, $249 heat-pump
// repair) or, where the row has none, to 2026 trade figures: $135–150 an
// hour, a Manual J at $250–350, a mini-split deep clean at $175–225 a head.
const AC_REMOVE = () => SHARED.removeOld(200, { cost: 100 });
const AC_INSTALL = () => L.labour(1, "flat", 200, {
  en: ["A/C installation", "The new condenser set on its pad and connected to the existing line set and electrical."],
  fr: ["Installation du climatiseur", "Nouveau condenseur posé sur sa base et raccordé aux conduites et à l'électricité existantes."],
  es: ["Instalación del aire acondicionado", "Condensador nuevo colocado en su base y conectado a la tubería y la electricidad existentes."],
  it: ["Installazione del climatizzatore", "Nuova unità esterna posata sulla base e collegata a linee frigorifere e impianto elettrico esistenti."],
  de: ["Klimagerät einbauen", "Neues Außengerät auf den Sockel gesetzt und an die vorhandenen Leitungen und die Elektrik angeschlossen."],
  uk: ["Монтаж кондиціонера", "Новий зовнішній блок встановлено на основу й під'єднано до наявних трас і електрики."],
  tl: ["Pagkabit ng A/C", "Inilagay ang bagong condenser sa pad at ikinonekta sa existing na line set at kuryente."],
}, { cost: 100 });

const TEMPLATES = {
  // ── Installation ──
  "fq.hvac_install.central.ac_economy": T("installation", {
    it: ["Installazione climatizzatore centralizzato — economico, 14 SEER", "Vecchia unità esterna rimossa e climatizzatore monostadio 14 SEER posato, collegato a linee e alimentazione esistenti e avviato."],
    de: ["Zentrale Klimaanlage — Einstiegsmodell, 14 SEER", "Altes Außengerät ausgebaut und ein einstufiges 14-SEER-Gerät gesetzt, an Leitungen und Strom angeschlossen und in Betrieb genommen."],
    uk: ["Встановлення центрального кондиціонера — економ, 14 SEER", "Старий зовнішній блок знято, встановлено одноступеневий кондиціонер 14 SEER, під'єднано до наявних трас і живлення та запущено."],
    tl: ["Pagkabit ng central aircon — economy, 14 SEER", "Tinanggal ang lumang condenser at ikinabit ang single-stage 14 SEER na aircon, ikinonekta sa existing na line set at kuryente at pinaandar."],
  }, [
    AC_REMOVE(), AC_INSTALL(),
    L.material(1, "each", 12500, {
      en: ["14 SEER air conditioner — economy", "Single-stage 14 SEER air conditioner with a five-year manufacturer's warranty."],
      fr: ["Climatiseur 14 SEER — économique", "Climatiseur 14 SEER à une vitesse, garantie du fabricant de cinq ans."],
      es: ["Aire acondicionado 14 SEER — económico", "Aire acondicionado de 14 SEER de una etapa con garantía de fábrica de cinco años."],
      it: ["Climatizzatore 14 SEER — economico", "Climatizzatore monostadio 14 SEER con garanzia del produttore di cinque anni."],
      de: ["Klimagerät 14 SEER — Einstieg", "Einstufiges 14-SEER-Klimagerät mit fünf Jahren Herstellergarantie."],
      uk: ["Кондиціонер 14 SEER — економ", "Одноступеневий кондиціонер 14 SEER з п'ятирічною гарантією виробника."],
      tl: ["14 SEER na aircon — economy", "Single-stage 14 SEER na aircon na may limang taong warranty ng manufacturer."],
    }, { cost: 12000 }),
  ], D.newCustomer("fixed", 400)),

  "fq.hvac_install.central.ac_top_shelf": T("installation", {
    it: ["Installazione climatizzatore centralizzato — top di gamma, 16 SEER", "Climatizzatore comunicante 16 SEER con termostato touch installato al posto del vecchio, con garanzia sulla manodopera di dieci anni."],
    de: ["Zentrale Klimaanlage — Spitzenmodell, 16 SEER", "Kommunizierendes 16-SEER-Klimagerät mit Touch-Thermostat anstelle des alten eingebaut, zehn Jahre Garantie auf die Arbeit."],
    uk: ["Встановлення центрального кондиціонера — преміум, 16 SEER", "Комунікуючий кондиціонер 16 SEER із сенсорним термостатом встановлено замість старого, гарантія на роботу десять років."],
    tl: ["Pagkabit ng central aircon — top shelf, 16 SEER", "Communicating na 16 SEER na aircon na may touch-screen thermostat kapalit ng luma, may sampung taong warranty sa labor."],
  }, [
    AC_REMOVE(), AC_INSTALL(),
    L.material(1, "each", 14000, {
      en: ["16 SEER air conditioner — top shelf", "Communicating 16 SEER air conditioner with a five-year manufacturer's warranty."],
      fr: ["Climatiseur 16 SEER — haut de gamme", "Climatiseur communicant 16 SEER, garantie du fabricant de cinq ans."],
      es: ["Aire acondicionado 16 SEER — gama alta", "Aire acondicionado comunicante de 16 SEER con garantía de fábrica de cinco años."],
      it: ["Climatizzatore 16 SEER — top di gamma", "Climatizzatore comunicante 16 SEER con garanzia del produttore di cinque anni."],
      de: ["Klimagerät 16 SEER — Spitzenmodell", "Kommunizierendes 16-SEER-Klimagerät mit fünf Jahren Herstellergarantie."],
      uk: ["Кондиціонер 16 SEER — преміум", "Комунікуючий кондиціонер 16 SEER з п'ятирічною гарантією виробника."],
      tl: ["16 SEER na aircon — top shelf", "Communicating na 16 SEER na aircon na may limang taong warranty ng manufacturer."],
    }, { cost: 13500 }),
    L.material(1, "each", 600, {
      en: ["Touch-screen thermostat", "Programmable touch-screen thermostat."],
      fr: ["Thermostat à écran tactile", "Thermostat programmable à écran tactile."],
      es: ["Termostato de pantalla táctil", "Termostato programable de pantalla táctil."],
      it: ["Termostato touch screen", "Termostato programmabile con schermo touch."],
      de: ["Touch-Thermostat", "Programmierbarer Thermostat mit Touchscreen."],
      uk: ["Сенсорний термостат", "Програмований термостат із сенсорним екраном."],
      tl: ["Touch-screen thermostat", "Programmable na thermostat na touch-screen."],
    }, { cost: 550 }),
  ], D.newCustomer("fixed", 400)),

  "fq.hvac_install.ductless.mini_split": T("installation", {
    it: ["Installazione split senza canali — monozona", "Un'unità interna e la sua unità esterna montate, collegate e cablate, poi messe in servizio per scaldare e raffrescare un ambiente."],
    de: ["Split-Klimagerät ohne Kanäle — eine Zone", "Ein Innengerät und sein Außengerät montiert, verrohrt und verdrahtet, dann in Betrieb genommen, um einen Raum zu heizen und zu kühlen."],
    uk: ["Встановлення безканальної спліт-системи — одна зона", "Внутрішній і зовнішній блоки змонтовано, з'єднано трасою та електрикою й запущено для обігріву й охолодження однієї кімнати."],
    tl: ["Pagkabit ng ductless mini-split — isang zone", "Ikinabit, pinaipan at kinablehan ang isang indoor head at outdoor unit, at pinaandar para painitin at palamigin ang isang kuwarto."],
  }, [
    L.labour(1, "flat", 1400, {
      en: ["Mini-split installation labour", "Head and condenser mounted, line set and condensate run, vacuumed, charged and commissioned."],
      fr: ["Main-d'œuvre — installation de thermopompe murale", "Unités intérieure et extérieure posées, conduites et condensat installés, tirage au vide, charge et mise en service."],
      es: ["Mano de obra — instalación de mini split", "Unidades interior y exterior montadas, tubería y condensado instalados, vacío, carga y puesta en marcha."],
      it: ["Manodopera — installazione split", "Unità interna ed esterna montate, linee e condensa posate, vuoto, carica e messa in servizio."],
      de: ["Arbeit — Split-Gerät montieren", "Innen- und Außengerät montiert, Leitungen und Kondensat verlegt, evakuiert, befüllt und in Betrieb genommen."],
      uk: ["Робота — монтаж спліт-системи", "Блоки змонтовано, трасу й дренаж прокладено, вакуумовано, заправлено та запущено."],
      tl: ["Labor — pagkabit ng mini-split", "Ikinabit ang head at condenser, inilatag ang line set at condensate, vinacuum, chinarge at pinaandar."],
    }),
    L.material(1, "each", 1900, {
      en: ["Single-zone heat pump mini-split — 12,000 BTU", "Inverter heat-pump head and condenser with line-set kit and wall bracket."],
      fr: ["Thermopompe murale monozone — 12 000 BTU", "Unité intérieure et condenseur à inverseur avec trousse de conduites et support mural."],
      es: ["Mini split bomba de calor monozona — 12,000 BTU", "Unidad interior y condensador inverter con kit de tubería y soporte de pared."],
      it: ["Split pompa di calore monozona — 12.000 BTU", "Unità interna ed esterna inverter con kit linee e staffa a muro."],
      de: ["Einzonen-Split-Wärmepumpe — 12.000 BTU", "Inverter-Innengerät und Außengerät mit Leitungsset und Wandkonsole."],
      uk: ["Однозонний спліт-тепловий насос — 12 000 BTU", "Інверторні внутрішній і зовнішній блоки з комплектом траси та настінним кронштейном."],
      tl: ["Single-zone heat pump mini-split — 12,000 BTU", "Inverter na head at condenser na may line-set kit at wall bracket."],
    }, { cost: 1400 }),
  ], D.newCustomer("fixed", 150)),

  "fq.hvac_install.central.heat_pump_2_5_ton": T("installation", {
    it: ["Installazione pompa di calore da 2,5 tonnellate", "Impianto esistente rimosso e pompa di calore da 2,5 tonnellate installata al suo posto, per riscaldare e raffrescare con una sola unità esterna."],
    de: ["Wärmepumpenanlage 2,5 Tonnen", "Bestehende Anlage ausgebaut und eine 2,5-Tonnen-Wärmepumpe eingebaut, die mit einem Außengerät heizt und kühlt."],
    uk: ["Встановлення теплового насоса 2,5 тонни", "Наявну систему знято, встановлено тепловий насос 2,5 тонни, що гріє й охолоджує одним зовнішнім блоком."],
    tl: ["Pagkabit ng 2.5-ton heat pump", "Tinanggal ang lumang sistema at ikinabit ang 2.5-ton heat pump na nagpapainit at nagpapalamig gamit ang isang outdoor unit."],
  }, [
    SHARED.removeOld(300),
    L.labour(1, "flat", 2800, {
      en: ["Heat pump system installation labour", "Condenser and air handler set, line set replaced, wired, vacuumed, charged and commissioned."],
      fr: ["Main-d'œuvre — installation de thermopompe", "Condenseur et appareil de traitement d'air posés, conduites remplacées, câblage, tirage au vide, charge et mise en service."],
      es: ["Mano de obra — instalación de bomba de calor", "Condensador y manejadora colocados, tubería reemplazada, cableado, vacío, carga y puesta en marcha."],
      it: ["Manodopera — installazione pompa di calore", "Unità esterna e unità di trattamento aria posate, linee sostituite, cablaggio, vuoto, carica e messa in servizio."],
      de: ["Arbeit — Wärmepumpe einbauen", "Außengerät und Lüftungsgerät gesetzt, Leitungen erneuert, verdrahtet, evakuiert, befüllt und in Betrieb genommen."],
      uk: ["Робота — монтаж теплового насоса", "Зовнішній блок і повітрообробник встановлено, трасу замінено, під'єднано, вакуумовано, заправлено й запущено."],
      tl: ["Labor — pagkabit ng heat pump", "Ikinabit ang condenser at air handler, pinalitan ang line set, kinablehan, vinacuum, chinarge at pinaandar."],
    }),
    L.material(1, "each", 5300, {
      en: ["2.5-ton heat pump and air handler", "Matched 15.2 SEER2 heat pump and variable-speed air handler with heat strip."],
      fr: ["Thermopompe 2,5 tonnes et appareil de traitement d'air", "Thermopompe 15,2 SEER2 et appareil à vitesse variable assortis, avec élément chauffant."],
      es: ["Bomba de calor de 2.5 toneladas y manejadora", "Bomba de calor 15.2 SEER2 y manejadora de velocidad variable a juego, con resistencia."],
      it: ["Pompa di calore 2,5 t e unità di trattamento aria", "Pompa di calore 15,2 SEER2 e unità a velocità variabile abbinate, con resistenza."],
      de: ["2,5-Tonnen-Wärmepumpe und Lüftungsgerät", "Abgestimmte 15,2-SEER2-Wärmepumpe und drehzahlgeregeltes Lüftungsgerät mit Heizregister."],
      uk: ["Тепловий насос 2,5 тонни та повітрообробник", "Узгоджені тепловий насос 15,2 SEER2 і повітрообробник зі змінною швидкістю та нагрівачем."],
      tl: ["2.5-ton heat pump at air handler", "Magkatugmang 15.2 SEER2 heat pump at variable-speed air handler na may heat strip."],
    }),
  ], D.newCustomer("fixed", 250)),

  "fq.hvac_install.additional.standard_install": T("installation", {
    it: ["Installazione standard", "Apparecchio di riscaldamento o raffrescamento scelto dal cliente installato, collegato e avviato, prezzo a corpo."],
    de: ["Standardinstallation", "Vom Kunden gewähltes Heiz- oder Kühlgerät eingebaut, angeschlossen und in Betrieb genommen, Pauschalpreis."],
    uk: ["Стандартне встановлення", "Обране клієнтом обладнання для опалення чи охолодження встановлено, під'єднано й запущено, ціна за роботу."],
    tl: ["Standard installation", "Ikinabit, ikinonekta at pinaandar ang heating o cooling equipment na pinili ng kliyente, presyo kada trabaho."],
  }, [
    SHARED.techHour(4, 140),
    SHARED.testing(95),
    SHARED.consumables(60),
  ], null),

  // ── Repair ──
  "fq.hvac_install.additional.heat_pump_repair": T("repair", {
    it: ["Riparazione pompa di calore", "Ricerca guasti e riparazione di una pompa di calore che scalda o raffresca poco, fino a riportarla alla piena resa."],
    de: ["Wärmepumpenreparatur", "Fehlersuche und Reparatur an einer Wärmepumpe mit zu wenig Heiz- oder Kühlleistung, bis sie wieder voll leistet."],
    uk: ["Ремонт теплового насоса", "Пошук і усунення несправності теплового насоса, що слабко гріє чи охолоджує, до повної потужності."],
    tl: ["Pag-ayos ng heat pump", "Hinanap at inayos ang sira ng heat pump na kulang sa init o lamig hanggang bumalik sa full output."],
  }, [
    SHARED.diagnostic(99, { cost: 50 }),
    SHARED.techHour(1, 150),
  ], D.regular("percent", 3)),

  "fq.hvac_install.additional.mini_split_repair": T("repair", {
    it: ["Riparazione split senza canali", "Unità che non scalda né raffresca, gocciola o mostra un codice errore: causa trovata in scheda, sonda, ventola o refrigerante e riparata."],
    de: ["Split-Gerät-Reparatur", "Innengerät heizt oder kühlt nicht, tropft oder zeigt einen Fehlercode: Ursache an Platine, Fühler, Lüfter oder Kältemittel gefunden und behoben."],
    uk: ["Ремонт безканальної спліт-системи", "Блок не гріє й не охолоджує, капає або показує код помилки: причину в платі, датчику, вентиляторі чи холодоагенті знайдено й усунено."],
    tl: ["Pag-ayos ng ductless mini-split", "Head na hindi umiinit o lumalamig, tumutulo o may error code: hinanap sa board, sensor, fan o refrigerant ang sanhi at inayos."],
  }, [
    SHARED.diagnostic(99, { cost: 50 }),
    SHARED.techHour(1.5, 150),
    L.material(1, "flat", 180, {
      en: ["Mini-split repair parts", "Sensor, fan motor, board or drain parts as the fault needs."],
      fr: ["Pièces de réparation", "Sonde, moteur de ventilateur, carte ou pièces de drain selon le défaut."],
      es: ["Piezas de reparación", "Sensor, motor de ventilador, tarjeta o piezas de drenaje según la falla."],
      it: ["Ricambi per la riparazione", "Sonda, motore ventola, scheda o parti dello scarico secondo il guasto."],
      de: ["Reparaturteile", "Fühler, Lüftermotor, Platine oder Ablaufteile je nach Fehler."],
      uk: ["Запчастини для ремонту", "Датчик, двигун вентилятора, плата або деталі дренажу залежно від несправності."],
      tl: ["Piyesa sa pag-ayos", "Sensor, fan motor, board o drain parts depende sa sira."],
    }),
  ], D.regular("percent", 3)),

  "fq.hvac_install.additional.ductwork_repair": T("repair", {
    it: ["Riparazione canali", "Tratti di canale schiacciati, staccati o che perdono ricollegati, risigillati e riappesi."],
    de: ["Kanalreparatur", "Gequetschte, gelöste oder undichte Kanalstrecken wieder verbunden, neu abgedichtet und neu abgehängt."],
    uk: ["Ремонт повітроводів", "Зім'яті, від'єднані або дірчасті ділянки повітроводів з'єднано, загерметизовано й підвішено."],
    tl: ["Pag-ayos ng ductwork", "Ikinonekta, sinelyuhan at isinabit ulit ang yupi, nakahiwalay o tumatagas na duct."],
  }, [
    L.labour(1, "linear_ft", 18, {
      en: ["Duct repair labour — per linear ft", "Runs reconnected, taped and mastic-sealed, and re-hung on strap."],
      fr: ["Main-d'œuvre — réparation de conduits, au pi lin.", "Conduits reconnectés, rubanés, scellés au mastic et resuspendus."],
      es: ["Mano de obra — reparación de ductos, por pie lineal", "Tramos reconectados, encintados, sellados con mástique y recolgados."],
      it: ["Manodopera — riparazione canali, al piede lineare", "Tratti ricollegati, nastrati, sigillati con mastice e riappesi."],
      de: ["Arbeit — Kanalreparatur, pro lfd. Fuß", "Strecken verbunden, geklebt, mit Mastix abgedichtet und neu abgehängt."],
      uk: ["Робота — ремонт повітроводів, за пог. фут", "Ділянки з'єднано, проклеєно, загерметизовано мастикою й підвішено."],
      tl: ["Labor — pag-ayos ng duct, kada linear ft", "Ikinonekta, tinape, sinelyuhan ng mastic at isinabit ulit."],
    }, { measurementKey: "linearFt" }),
    L.material(1, "linear_ft", 6, {
      en: ["Duct, mastic and strap — per linear ft", "Insulated flex or sheet-metal duct, mastic, foil tape and hanger strap."],
      fr: ["Conduit, mastic et courroie — au pi lin.", "Conduit flexible isolé ou en tôle, mastic, ruban d'aluminium et courroie de suspension."],
      es: ["Ducto, mástique y fleje — por pie lineal", "Ducto flexible aislado o de lámina, mástique, cinta de aluminio y fleje."],
      it: ["Canale, mastice e reggetta — al piede lineare", "Canale flessibile isolato o in lamiera, mastice, nastro alluminio e reggetta."],
      de: ["Kanal, Mastix und Band — pro lfd. Fuß", "Isolierter Flex- oder Blechkanal, Mastix, Alu-Klebeband und Lochband."],
      uk: ["Повітровід, мастика та стрічка — за пог. фут", "Утеплений гнучкий або жерстяний повітровід, мастика, алюмінієва стрічка та підвіс."],
      tl: ["Duct, mastic at strap — kada linear ft", "Insulated flex o sheet-metal duct, mastic, foil tape at hanger strap."],
    }, { measurementKey: "linearFt" }),
  ], null),

  // ── Inspection ──
  "fq.hvac_install.additional.load_calculation": T("inspection", {
    it: ["Calcolo del carico termico", "Casa misurata stanza per stanza e calcolo del carico eseguito, così il nuovo impianto è dimensionato sulla casa e non sulla vecchia unità."],
    de: ["Heiz- und Kühllastberechnung", "Haus Raum für Raum aufgemessen und die Last berechnet, damit die neue Anlage zum Haus passt und nicht zum alten Gerät."],
    uk: ["Розрахунок теплового навантаження", "Будинок виміряно кімната за кімнатою та розраховано навантаження, щоб нову систему підібрати під будинок, а не під старий блок."],
    tl: ["Load calculation para sa heating at cooling", "Sinukat ang bahay kuwarto-kuwarto at kinuwenta ang load para tama ang sukat ng bagong sistema sa bahay, hindi sa lumang unit."],
  }, [
    L.labour(1, "flat", 295, {
      en: ["Load calculation", "Rooms, windows and insulation measured and a room-by-room load calculation produced."],
      fr: ["Calcul de charge", "Pièces, fenêtres et isolation mesurées et calcul de charge pièce par pièce produit."],
      es: ["Cálculo de carga", "Habitaciones, ventanas y aislamiento medidos y un cálculo de carga por habitación elaborado."],
      it: ["Calcolo del carico", "Stanze, finestre e isolamento misurati e calcolo del carico stanza per stanza prodotto."],
      de: ["Lastberechnung", "Räume, Fenster und Dämmung aufgemessen und eine raumweise Lastberechnung erstellt."],
      uk: ["Розрахунок навантаження", "Кімнати, вікна та утеплення виміряно, підготовлено розрахунок навантаження по кімнатах."],
      tl: ["Load calculation", "Sinukat ang kuwarto, bintana at insulation at ginawa ang room-by-room na load calculation."],
    }),
    SHARED.report(55),
  ], null),

  "fq.hvac_install.additional.install_estimate_visit": T("inspection", {
    it: ["Sopralluogo per preventivo di sostituzione", "Apparecchi, canali e impianto elettrico esistenti esaminati e opzioni di sostituzione buona, migliore e ottima quotate per iscritto."],
    de: ["Besichtigung für ein Austauschangebot", "Vorhandene Geräte, Kanäle und Elektrik begutachtet und Austauschoptionen gut, besser, am besten schriftlich angeboten."],
    uk: ["Візит для оцінки заміни", "Наявне обладнання, повітроводи й електрику оглянуто, варіанти заміни добрий, кращий, найкращий оцінено письмово."],
    tl: ["Estimate visit para sa pagpapalit", "Tiningnan ang existing na equipment, duct at kuryente at nagbigay ng nakasulat na presyo ng good, better, best na opsyon."],
  }, [
    L.labour(1, "flat", 0, {
      en: ["Replacement estimate", "Existing system assessed and three options priced; free with a signed quote."],
      fr: ["Estimation de remplacement", "Système existant évalué et trois options chiffrées; gratuit avec une soumission signée."],
      es: ["Presupuesto de reemplazo", "Sistema existente evaluado y tres opciones cotizadas; gratis con un presupuesto firmado."],
      it: ["Preventivo di sostituzione", "Impianto esistente valutato e tre opzioni quotate; gratuito con preventivo firmato."],
      de: ["Austauschangebot", "Bestehende Anlage bewertet und drei Optionen angeboten; kostenlos bei unterschriebenem Angebot."],
      uk: ["Оцінка заміни", "Наявну систему оцінено, три варіанти прораховано; безкоштовно за підписаного кошторису."],
      tl: ["Estimate ng pagpapalit", "Sinuri ang existing na sistema at nagbigay ng presyo ng tatlong opsyon; libre kapag pumirma sa quote."],
    }, { cost: 0 }),
    SHARED.serviceCall(59),
  ], null),

  "fq.hvac_install.additional.duct_leakage_test": T("inspection", {
    it: ["Prova di tenuta dei canali", "Rete di canali messa in pressione e perdite misurate, con i giunti peggiori individuati per la sigillatura."],
    de: ["Kanal-Dichtheitsprüfung", "Kanalnetz unter Druck gesetzt und die Leckage gemessen, die schlimmsten Stöße zum Abdichten geortet."],
    uk: ["Тест герметичності повітроводів", "Систему повітроводів піддано тиску й виміряно витоки, найгірші стики знайдено для герметизації."],
    tl: ["Duct leakage test", "Pinressurize ang duct system at sinukat ang tagas, at hinanap ang pinakamalalang dugtungan para selyuhan."],
  }, [
    L.labour(1, "flat", 275, {
      en: ["Duct pressurisation test", "Registers sealed, the duct system pressurised with a duct blaster and leakage recorded."],
      fr: ["Test de pressurisation des conduits", "Grilles obturées, réseau mis sous pression au ventilateur calibré et fuites consignées."],
      es: ["Prueba de presurización de ductos", "Rejillas selladas, sistema presurizado con ventilador calibrado y fugas registradas."],
      it: ["Prova di pressurizzazione dei canali", "Bocchette chiuse, rete pressurizzata con ventilatore calibrato e perdite registrate."],
      de: ["Kanal-Druckprüfung", "Auslässe abgeklebt, Kanalnetz mit Messgebläse unter Druck gesetzt und Leckage protokolliert."],
      uk: ["Тест тиском повітроводів", "Решітки закрито, систему піддано тиску каліброваним вентилятором, витоки записано."],
      tl: ["Pressurization test ng duct", "Tinakpan ang register, pinressurize gamit ang duct blaster at nirekord ang tagas."],
    }),
    SHARED.report(50),
  ], null),

  // ── Maintenance ──
  "fq.hvac_install.components.dehumidifiers": T("maintenance", {
    it: ["Installazione e manutenzione deumidificatore centralizzato", "Deumidificatore per tutta la casa installato o revisionato: filtro, scarico e umidostato controllati."],
    de: ["Ganzhaus-Entfeuchter einbauen und warten", "Ganzhaus-Entfeuchter eingebaut oder gewartet: Filter, Ablauf und Hygrostat geprüft."],
    uk: ["Встановлення та обслуговування осушувача для всього будинку", "Осушувач для всього будинку встановлено або обслуговано: фільтр, дренаж і гігростат перевірено."],
    tl: ["Pagkabit at service ng whole-home dehumidifier", "Ikinabit o sinerbisyuhan ang whole-home dehumidifier: chineck ang filter, drain at humidistat."],
  }, [
    L.labour(1, "flat", 165, {
      en: ["Dehumidifier service", "Filter changed, coil and drain cleaned, humidistat checked against a reference."],
      fr: ["Entretien du déshumidificateur", "Filtre changé, serpentin et drain nettoyés, humidistat vérifié avec un appareil de référence."],
      es: ["Servicio del deshumidificador", "Filtro cambiado, serpentín y drenaje limpios, humidostato verificado contra una referencia."],
      it: ["Manutenzione deumidificatore", "Filtro cambiato, batteria e scarico puliti, umidostato verificato con uno strumento di riferimento."],
      de: ["Entfeuchterwartung", "Filter gewechselt, Register und Ablauf gereinigt, Hygrostat mit Referenzgerät geprüft."],
      uk: ["Обслуговування осушувача", "Фільтр замінено, теплообмінник і дренаж очищено, гігростат звірено з еталоном."],
      tl: ["Service ng dehumidifier", "Pinalitan ang filter, nilinis ang coil at drain, chineck ang humidistat gamit ang reference."],
    }),
    L.material(1, "each", 45, {
      en: ["Dehumidifier filter", "Replacement MERV 11 filter for the whole-home dehumidifier."],
      fr: ["Filtre de déshumidificateur", "Filtre MERV 11 de rechange pour le déshumidificateur central."],
      es: ["Filtro del deshumidificador", "Filtro MERV 11 de repuesto para el deshumidificador central."],
      it: ["Filtro del deumidificatore", "Filtro MERV 11 di ricambio per il deumidificatore centralizzato."],
      de: ["Entfeuchterfilter", "Ersatzfilter MERV 11 für den Ganzhaus-Entfeuchter."],
      uk: ["Фільтр осушувача", "Змінний фільтр MERV 11 для осушувача всього будинку."],
      tl: ["Filter ng dehumidifier", "Kapalit na MERV 11 filter para sa whole-home dehumidifier."],
    }),
  ], D.regular("fixed", 10)),

  "fq.hvac_install.additional.mini_split_cleaning": T("maintenance", {
    it: ["Pulizia profonda split — per unità", "Unità interna insaccata e lavata, ventola e batteria pulite e scarico spurgato, così smette di puzzare e soffia a pieno."],
    de: ["Split-Gerät-Tiefenreinigung — pro Innengerät", "Innengerät eingetütet und durchgewaschen, Walze und Register gereinigt, Ablauf gespült — kein Geruch mehr, volle Luftleistung."],
    uk: ["Глибоке чищення спліт-системи — за блок", "Внутрішній блок обгорнуто й промито, крильчатку та теплообмінник очищено, дренаж промито — без запаху, повний потік."],
    tl: ["Deep cleaning ng mini-split — kada head", "Binalot at hinugasan ang indoor head, nilinis ang blower wheel at coil at ni-flush ang drain para mawala ang amoy at lumakas ang hangin."],
  }, [
    L.labour(1, "each", 195, {
      en: ["Head deep clean — per head", "Wash bag fitted, coil and blower wheel washed through, drain flushed and the head tested."],
      fr: ["Nettoyage en profondeur — par unité", "Housse de lavage posée, serpentin et roue lavés, drain purgé et unité testée."],
      es: ["Limpieza profunda — por unidad", "Bolsa de lavado colocada, serpentín y turbina lavados, drenaje purgado y la unidad probada."],
      it: ["Pulizia profonda — per unità", "Sacco di lavaggio montato, batteria e ventola lavate, scarico spurgato e unità provata."],
      de: ["Tiefenreinigung — pro Innengerät", "Waschsack angelegt, Register und Walze durchgespült, Ablauf gespült und Gerät getestet."],
      uk: ["Глибоке чищення — за блок", "Мийний чохол встановлено, теплообмінник і крильчатку промито, дренаж прочищено, блок перевірено."],
      tl: ["Deep clean — kada head", "Nilagyan ng wash bag, hinugasan ang coil at blower wheel, ni-flush ang drain at sinubukan."],
    }, { measurementKey: "each" }),
  ], D.regular("fixed", 15)),

  "fq.hvac_install.additional.first_year_service": T("maintenance", {
    it: ["Assistenza del primo anno sul nuovo impianto", "Primo controllo dopo l'installazione: carica refrigerante, scarico, parte elettrica e portata confermati e registrazione della garanzia verificata."],
    de: ["Erstjahresservice der neuen Anlage", "Erste Prüfung nach dem Einbau: Kältemittelfüllung, Ablauf, Elektrik und Luftstrom bestätigt und die Garantieregistrierung kontrolliert."],
    uk: ["Сервіс першого року нової системи", "Перша перевірка після монтажу: заправку, дренаж, електрику й потік підтверджено, реєстрацію гарантії перевірено."],
    tl: ["First-year service ng bagong sistema", "Unang check pagkatapos ikabit: kinumpirma ang refrigerant charge, drain, kuryente at hangin, at chineck ang warranty registration."],
  }, [
    L.labour(1, "flat", 149, {
      en: ["First-year check", "Charge, drain, electrical and airflow verified against the start-up readings."],
      fr: ["Vérification de première année", "Charge, drain, électricité et débit vérifiés par rapport aux lectures de mise en service."],
      es: ["Revisión del primer año", "Carga, drenaje, electricidad y flujo verificados contra las lecturas del arranque."],
      it: ["Controllo del primo anno", "Carica, scarico, parte elettrica e portata verificati rispetto alle letture di avvio."],
      de: ["Erstjahresprüfung", "Füllung, Ablauf, Elektrik und Luftstrom mit den Inbetriebnahmewerten verglichen."],
      uk: ["Перевірка першого року", "Заправку, дренаж, електрику й потік звірено з показниками запуску."],
      tl: ["First-year check", "Ikinumpara ang charge, drain, kuryente at hangin sa readings noong start-up."],
    }),
  ], null),
};

withTemplates(SEED, TEMPLATES);
