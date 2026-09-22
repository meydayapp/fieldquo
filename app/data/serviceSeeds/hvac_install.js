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
  ],
};
