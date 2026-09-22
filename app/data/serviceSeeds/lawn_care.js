// app/data/serviceSeeds/lawn_care.js
//
// The service list a lawn and landscaping company starts from. Read the
// header of ./index.js for the format and the rules every file in this
// folder follows.
//
// The treatment PROGRAMS (fertilization, weed control, aeration, grub
// control, mosquito and perimeter pest add-ons) are priced by lawn-size band
// in the lawn_care instant estimator (lib/estimate/lawnCare.js, seeded by
// lib/estimate/lawnCareSeed.js). That is an estimator, not a takeoff or a
// price book, so nothing here is marked pricedBy; the rows that overlap it
// carry an `existing` note instead so the two are merged, not duplicated.
//
// No benchmark exists for any of these: the capture carried no pricing
// insight for the trade. Every `benchmark` is null on purpose.

export const SEED = {
  trade: "lawn_care",
  categories: [
    {
      key: "core",
      name: { en: "Core services", fr: "Services de base", es: "Servicios principales" },
    },
    {
      key: "additional",
      name: { en: "Additional services", fr: "Services complémentaires", es: "Servicios adicionales" },
    },
    {
      key: "maintenance",
      name: { en: "Maintenance and inspection", fr: "Entretien et inspection", es: "Mantenimiento e inspección" },
    },
  ],
  services: [
    {
      seedKey: "fq.lawn_care.core.lawn_mowing",
      category: "core",
      name: {
        en: "Lawn mowing",
        fr: "Tonte de pelouse",
        es: "Corte de césped",
      },
      description: {
        en: "Grass cut to a healthy height on a regular visit, edges trimmed along walks and beds, clippings mulched or bagged.",
        fr: "Gazon coupé à une hauteur saine lors d'une visite régulière, bordures taillées le long des allées et des plates-bandes, rognures déchiquetées ou ensachées.",
        es: "Pasto cortado a una altura saludable en cada visita programada, bordes recortados junto a senderos y canteros, recortes triturados o embolsados.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "Per-visit mowing banded by lot size is the lawn_mowing instant estimator (lib/estimate/instantEstimate.js); this row is the service line on a quote.",
    },
    {
      seedKey: "fq.lawn_care.core.fertilization",
      category: "core",
      name: {
        en: "Lawn fertilization",
        fr: "Fertilisation de la pelouse",
        es: "Fertilización del césped",
      },
      description: {
        en: "A granular or liquid feed applied across the lawn to thicken the turf, deepen its colour and keep growth even through the season.",
        fr: "Engrais granulaire ou liquide appliqué sur toute la pelouse pour épaissir le gazon, en raviver la couleur et garder une pousse régulière toute la saison.",
        es: "Fertilizante granular o líquido aplicado en todo el césped para engrosar el pasto, intensificar su color y mantener un crecimiento parejo durante la temporada.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "The lawn_care instant estimator prices fertilization by lawn-size band (lawnCareSeed.js key `fertilization`).",
    },
    {
      seedKey: "fq.lawn_care.core.weed_control",
      category: "core",
      name: {
        en: "Weed control treatment",
        fr: "Traitement contre les mauvaises herbes",
        es: "Control de malezas",
      },
      description: {
        en: "Broadleaf and grassy weeds treated where they grow so the turf keeps the water and nutrients for itself.",
        fr: "Mauvaises herbes à feuilles larges et graminées traitées là où elles poussent, pour que le gazon garde l'eau et les éléments nutritifs pour lui.",
        es: "Malezas de hoja ancha y gramíneas tratadas donde crecen, para que el pasto conserve el agua y los nutrientes para sí mismo.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "The lawn_care instant estimator prices weed control by lawn-size band (lawnCareSeed.js key `weed_control`).",
    },
    {
      seedKey: "fq.lawn_care.core.landscape_maintenance",
      category: "core",
      name: {
        en: "Landscape maintenance",
        fr: "Entretien paysager",
        es: "Mantenimiento de jardines",
      },
      description: {
        en: "Recurring care of the lawn, beds and plantings — weeding, edging, light pruning and tidying — so nothing grows wild or gets damaged between visits.",
        fr: "Entretien récurrent de la pelouse, des plates-bandes et des plantations — désherbage, bordures, taille légère et remise en ordre — pour que rien ne pousse à l'abandon entre les visites.",
        es: "Cuidado recurrente del césped, canteros y plantas: deshierbe, bordes, poda ligera y orden general, para que nada crezca descontrolado entre visitas.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.core.tree_shrub_trimming",
      category: "core",
      name: {
        en: "Tree and shrub trimming",
        fr: "Taille des arbres et arbustes",
        es: "Poda de árboles y arbustos",
      },
      description: {
        en: "Trees and shrubs cut back and shaped, dead wood taken out, so they stay healthy and in proportion to the yard.",
        fr: "Arbres et arbustes rabattus et façonnés, bois mort retiré, pour qu'ils restent sains et proportionnés au terrain.",
        es: "Árboles y arbustos recortados y moldeados, madera muerta retirada, para que se mantengan sanos y en proporción al jardín.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.core.sod_installation",
      category: "core",
      name: {
        en: "Sod installation",
        fr: "Pose de tourbe",
        es: "Instalación de césped en rollo",
      },
      description: {
        en: "Ground graded and prepared, fresh sod laid tight and rolled, then watered in for a finished lawn the same day.",
        fr: "Sol nivelé et préparé, tourbe fraîche posée bord à bord et roulée, puis arrosée pour une pelouse finie le jour même.",
        es: "Terreno nivelado y preparado, césped en rollo colocado sin juntas y compactado, luego regado para tener un jardín terminado el mismo día.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.additional.seasonal_yard_cleanup",
      category: "additional",
      name: {
        en: "Seasonal yard cleanup",
        fr: "Nettoyage saisonnier du terrain",
        es: "Limpieza estacional del jardín",
      },
      description: {
        en: "Leaves, fallen branches and winter or summer buildup raked, collected and hauled away so the yard is ready for the next season.",
        fr: "Feuilles, branches tombées et débris de l'hiver ou de l'été ratissés, ramassés et emportés pour que le terrain soit prêt pour la saison suivante.",
        es: "Hojas, ramas caídas y acumulación de invierno o verano rastrilladas, recogidas y retiradas para dejar el jardín listo para la próxima temporada.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.additional.mulch_installation",
      category: "additional",
      name: {
        en: "Mulch installation",
        fr: "Pose de paillis",
        es: "Colocación de mantillo",
      },
      description: {
        en: "Beds edged and topped with a fresh layer of mulch to hold moisture, keep weeds down and give the garden a clean finish.",
        fr: "Plates-bandes délimitées et recouvertes d'une couche fraîche de paillis pour retenir l'humidité, freiner les mauvaises herbes et donner un fini propre au jardin.",
        es: "Canteros delimitados y cubiertos por una capa nueva de mantillo para retener la humedad, frenar las malezas y dar al jardín un acabado limpio.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.additional.landscape_design",
      category: "additional",
      name: {
        en: "Landscape design",
        fr: "Conception d'aménagement paysager",
        es: "Diseño de paisajismo",
      },
      description: {
        en: "A plan for the outdoor space — beds, plant choices, paths and lawn areas — drawn up to fit how the property is used and to lift its curb appeal.",
        fr: "Un plan pour l'espace extérieur — plates-bandes, choix de végétaux, sentiers et zones de pelouse — dessiné selon l'usage du terrain pour en rehausser l'apparence.",
        es: "Un plan para el espacio exterior: canteros, selección de plantas, senderos y zonas de césped, diseñado según el uso de la propiedad para realzar su fachada.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.additional.irrigation_install",
      category: "additional",
      name: {
        en: "Irrigation system installation",
        fr: "Installation d'un système d'irrigation",
        es: "Instalación de sistema de riego",
      },
      description: {
        en: "Underground lines, heads and a controller installed and zoned so every part of the lawn and beds gets watered evenly on a schedule.",
        fr: "Conduites souterraines, têtes d'arrosage et programmateur installés par zones pour que chaque partie de la pelouse et des plates-bandes soit arrosée uniformément selon un horaire.",
        es: "Líneas subterráneas, aspersores y controlador instalados por zonas para que cada parte del césped y los canteros reciba riego parejo según un horario.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.additional.drainage_solutions",
      category: "additional",
      name: {
        en: "Drainage solutions",
        fr: "Solutions de drainage",
        es: "Soluciones de drenaje",
      },
      description: {
        en: "Standing water and runoff problems fixed by regrading, French drains or catch basins so the lawn drains and the foundation stays dry.",
        fr: "Problèmes d'eau stagnante et de ruissellement corrigés par nivellement, drain français ou puisard, pour que la pelouse s'égoutte et que les fondations restent au sec.",
        es: "Problemas de agua estancada y escorrentía corregidos mediante nivelación, drenaje francés o cajas de captación, para que el césped drene y los cimientos se mantengan secos.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.additional.hardscape_install",
      category: "additional",
      name: {
        en: "Hardscape installation — patios, walkways and stone features",
        fr: "Aménagement minéral — patios, allées et ouvrages en pierre",
        es: "Instalación de hardscape: patios, senderos y elementos de piedra",
      },
      description: {
        en: "Pavers, flagstone or retaining walls set on a compacted base to build a patio, a walkway or a garden feature that lasts.",
        fr: "Pavés, dalles ou murets de soutènement posés sur une base compactée pour créer un patio, une allée ou un élément de jardin durable.",
        es: "Adoquines, lajas o muros de contención asentados sobre una base compactada para construir un patio, un sendero o un elemento de jardín duradero.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.maintenance.irrigation_service",
      category: "maintenance",
      name: {
        en: "Irrigation system service and repair",
        fr: "Entretien et réparation du système d'irrigation",
        es: "Servicio y reparación del sistema de riego",
      },
      description: {
        en: "Zones run and checked, broken heads and leaking lines replaced, controller reprogrammed so the system waters properly without waste.",
        fr: "Zones activées et vérifiées, têtes brisées et conduites qui fuient remplacées, programmateur reprogrammé pour un arrosage correct sans gaspillage.",
        es: "Zonas activadas y revisadas, aspersores rotos y líneas con fugas reemplazados, controlador reprogramado para que el sistema riegue bien sin desperdicio.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.maintenance.lawn_health_inspection",
      category: "maintenance",
      name: {
        en: "Lawn health inspection",
        fr: "Inspection de la santé de la pelouse",
        es: "Inspección de la salud del césped",
      },
      description: {
        en: "A walk of the lawn to check turf density, soil condition, thin or brown patches and signs of pests, ending in a written plan of what to treat.",
        fr: "Tour de la pelouse pour vérifier la densité du gazon, l'état du sol, les zones clairsemées ou brunies et les signes d'insectes, suivi d'un plan écrit des traitements à faire.",
        es: "Recorrido del césped para revisar densidad del pasto, estado del suelo, zonas ralas o amarillentas y señales de plagas, seguido de un plan escrito de qué tratar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.maintenance.seasonal_lawn_treatment",
      category: "maintenance",
      name: {
        en: "Seasonal lawn treatment",
        fr: "Traitement saisonnier de la pelouse",
        es: "Tratamiento estacional del césped",
      },
      description: {
        en: "A spring, summer or fall application timed to the season — feed, weed control or winterizer — to carry the lawn through the weather ahead.",
        fr: "Application de printemps, d'été ou d'automne calée sur la saison — engrais, désherbage ou préparation hivernale — pour aider la pelouse à traverser la météo à venir.",
        es: "Aplicación de primavera, verano u otoño ajustada a la temporada, ya sea fertilizante, control de malezas o preparación invernal, para que el césped resista el clima que viene.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "Season-bundled treatments are the lawn_care estimator's programs (lawnCareSeed.js keys `fall_tune_up`, `essential_program`).",
    },
    {
      seedKey: "fq.lawn_care.maintenance.lawn_pest_control",
      category: "maintenance",
      name: {
        en: "Lawn pest control",
        fr: "Contrôle des insectes de pelouse",
        es: "Control de plagas del césped",
      },
      description: {
        en: "Grubs, chinch bugs and other turf insects treated before they chew through roots and leave dead patches.",
        fr: "Vers blancs, punaises velues et autres insectes du gazon traités avant qu'ils ne rongent les racines et laissent des plaques mortes.",
        es: "Gusanos blancos, chinches y otros insectos del pasto tratados antes de que dañen las raíces y dejen parches muertos.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "The lawn_care estimator prices surface insect and grub control as add-ons (lawnCareSeed.js keys `surface_insect_control`, `grub_control_preventative`).",
    },
    {
      seedKey: "fq.lawn_care.maintenance.landscape_maintenance_plan",
      category: "maintenance",
      name: {
        en: "Landscape maintenance plan",
        fr: "Forfait d'entretien paysager",
        es: "Plan de mantenimiento de jardines",
      },
      description: {
        en: "A season-long schedule of visits that keeps the lawn fed, the beds tidy and the plantings pruned, priced as one plan rather than visit by visit.",
        fr: "Calendrier de visites pour toute la saison qui garde la pelouse nourrie, les plates-bandes propres et les plantations taillées, facturé en un seul forfait plutôt qu'à la visite.",
        es: "Calendario de visitas para toda la temporada que mantiene el césped fertilizado, los canteros ordenados y las plantas podadas, cotizado como un solo plan en lugar de visita por visita.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.lawn_care.maintenance.inspection_visit",
      category: "maintenance",
      name: {
        en: "Lawn and landscape inspection visit",
        fr: "Visite d'inspection de la pelouse et du terrain",
        es: "Visita de inspección de césped y jardín",
      },
      description: {
        en: "A booked two-hour visit to look over the whole property and leave clear recommendations on what needs doing.",
        fr: "Visite réservée de deux heures pour examiner l'ensemble du terrain et laisser des recommandations claires sur ce qu'il faut faire.",
        es: "Visita agendada de dos horas para revisar toda la propiedad y dejar recomendaciones claras sobre lo que hace falta hacer.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: 120,
      bookable: true,
    },
    {
      seedKey: "fq.lawn_care.additional.repair_visit",
      category: "additional",
      name: {
        en: "Lawn and landscape repair visit",
        fr: "Visite de réparation de la pelouse et du terrain",
        es: "Visita de reparación de césped y jardín",
      },
      description: {
        en: "A booked two-hour visit to fix what is not working — a bare patch, a washed-out bed, a sunken path — and bring it back to how it should look.",
        fr: "Visite réservée de deux heures pour corriger ce qui ne va pas — plaque dégarnie, plate-bande érodée, sentier affaissé — et lui redonner l'apparence voulue.",
        es: "Visita agendada de dos horas para arreglar lo que no funciona, sea un parche pelado, un cantero erosionado o un sendero hundido, y devolverle su aspecto.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: 120,
      bookable: true,
    },
    {
      seedKey: "fq.lawn_care.additional.install_upgrade_visit",
      category: "additional",
      name: {
        en: "Landscape installation or upgrade visit",
        fr: "Visite d'installation ou d'amélioration paysagère",
        es: "Visita de instalación o mejora de jardín",
      },
      description: {
        en: "A booked two-hour visit to install something new or improve what is there — plantings, edging, a bed, a small feature.",
        fr: "Visite réservée de deux heures pour installer du neuf ou améliorer l'existant — végétaux, bordures, plate-bande, petit aménagement.",
        es: "Visita agendada de dos horas para instalar algo nuevo o mejorar lo existente: plantas, bordes, un cantero, un elemento pequeño.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: 120,
      bookable: true,
    },
  ],
};
