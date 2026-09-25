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

import { L, SHARED, D, T, withTemplates, hdMaterial } from "./_templateLines";
import { HD } from "./_materialCosts";

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

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the landscaping capture under docs/research/ names the twenty
// services and ships no templates, forms or materials, so the templates here
// are authored: 2026 residential rates (mowing $45 a visit, cleanup crews
// $60 an hour, sod laid $0.90 a sq ft, mulch spread $1.25 a sq ft of bed,
// pavers laid $14 a sq ft) and the Home Depot costs in _materialCosts.js for
// mulch, sod, seed, edging, paver base and gravel.
//
// The treatment PROGRAMS — fertilization, weed control, seasonal treatment,
// pest control — are NOT templated here: their price is the owner's measured
// competitor card in lib/estimate/lawnCareSeed.js, a base at the minimum lawn
// band plus a step per 1,000 sq ft, and the lawn-care estimator prices them.
// A template line cannot carry "step per 1,000 sq ft" (a labour line has no
// coverage, and a per-sq-ft rate rounds to a cent), so copying those numbers
// here would re-price them in a second, lossy place.
//
// Keys (lib/services/measurementKeys.js): lawn area `lotSize`, bed edge
// `edgingFt`, planting beds the typed `areaSqFt`, paver areas the traced
// `areaSqft`, drain runs `linearFt`.
const n = (it, de, uk, tl) => ({ it, de, uk, tl });

const TEMPLATES = {
  // ── Maintenance ──
  "fq.lawn_care.core.lawn_mowing": T("maintenance", n(
    ["Taglio del prato", "Erba tagliata a un'altezza sana a ogni visita, bordi rifiniti lungo vialetti e aiuole, sfalci triturati o raccolti."],
    ["Rasenmähen", "Rasen bei jedem Termin auf gesunde Höhe gemäht, Kanten an Wegen und Beeten geschnitten, Schnittgut gemulcht oder eingesammelt."],
    ["Косіння газону", "Траву скошено на здорову висоту під час кожного візиту, краї вздовж доріжок і клумб підрізано, покіс подрібнено або зібрано."],
    ["Paggapas ng damuhan", "Ginapas sa tamang taas bawat visit, tinrim ang gilid sa daanan at taniman, dinurog o sinako ang ginapas."],
  ), [
    L.labour(1, "flat", 45, {
      en: ["Mowing and trimming", "Mowed, string-trimmed around obstacles and hard surfaces blown clean."],
      fr: ["Tonte et taille", "Tondu, taillé au coupe-bordure autour des obstacles et surfaces dures soufflées."],
      es: ["Corte y orillado", "Cortado, orillado con desbrozadora alrededor de obstáculos y superficies duras sopladas."],
      it: ["Taglio e rifinitura", "Tagliato, rifinito col decespugliatore attorno agli ostacoli e superfici dure soffiate."],
      de: ["Mähen und Trimmen", "Gemäht, um Hindernisse getrimmt und befestigte Flächen abgeblasen."],
      uk: ["Косіння та підрізання", "Скошено, підрізано тримером навколо перешкод, тверді поверхні продуто."],
      tl: ["Paggapas at trimming", "Ginapas, tinrim sa paligid ng harang at hinipan ang semento."],
    }),
    L.labour(1, "linear_ft", 0.1, {
      en: ["Edging — per linear ft", "Walks, drive and bed lines edged with a blade edger."],
      fr: ["Bordures — au pi lin.", "Allées, entrée et plates-bandes bordurées à la coupe-bordure."],
      es: ["Bordeado — por pie lineal", "Banquetas, entrada y canteros bordeados con orilladora."],
      it: ["Bordatura — al piede lineare", "Vialetti, accesso e aiuole rifiniti con tagliabordi."],
      de: ["Kantenschnitt — pro lfd. Fuß", "Wege, Einfahrt und Beetkanten mit dem Kantenschneider gestochen."],
      uk: ["Окантовка — за пог. фут", "Доріжки, в'їзд і межі клумб окантовано кантувальником."],
      tl: ["Edging — kada linear ft", "Nilinyahan ang daanan, driveway at gilid ng taniman gamit ang edger."],
    }, { measurementKey: "edgingFt" }),
  ], D.bundle("percent", 5)),

  "fq.lawn_care.additional.seasonal_yard_cleanup": T("maintenance", n(
    ["Pulizia stagionale del giardino", "Foglie, rami caduti e accumuli di stagione rastrellati, raccolti e portati via."],
    ["Saisonale Gartenreinigung", "Laub, heruntergefallene Äste und saisonale Ablagerungen gerecht, gesammelt und abgefahren."],
    ["Сезонне прибирання подвір'я", "Листя, гілки й сезонні нашарування згребено, зібрано й вивезено."],
    ["Seasonal na paglilinis ng bakuran", "Kinalaykay, inipon at hinakot ang dahon, sanga at naipong dumi ng season."],
  ), [
    L.labour(3, "hour", 60, {
      en: ["Leaf and debris cleanup — per crew hour", "Lawn and beds raked or blown, debris bagged or tarped."],
      fr: ["Ramassage de feuilles et débris — par heure d'équipe", "Pelouse et plates-bandes râtelées ou soufflées, débris ensachés."],
      es: ["Limpieza de hojas y residuos — por hora de cuadrilla", "Césped y canteros rastrillados o soplados, residuos embolsados."],
      it: ["Raccolta foglie e detriti — per ora di squadra", "Prato e aiuole rastrellati o soffiati, detriti insaccati."],
      de: ["Laub- und Schnittgutreinigung — pro Teamstunde", "Rasen und Beete gerecht oder geblasen, Material eingesackt."],
      uk: ["Прибирання листя та сміття — за годину бригади", "Газон і клумби згребено або продуто, сміття запаковано."],
      tl: ["Paglilinis ng dahon at dumi — kada oras ng crew", "Kinalaykay o hinipan ang damuhan at taniman, sinako ang dumi."],
    }),
    SHARED.disposalFee(45),
  ], D.seasonal("percent", 10)),

  "fq.lawn_care.core.landscape_maintenance": T("maintenance", n(
    ["Manutenzione del verde", "Aiuole diserbate, arbusti rifilati e bordi ripuliti a ogni visita programmata."],
    ["Gartenpflege", "Beete gejätet, Sträucher in Form geschnitten und Kanten bei jedem Termin gepflegt."],
    ["Догляд за ландшафтом", "Клумби прополото, кущі підстрижено, краї підрівняно під час кожного планового візиту."],
    ["Maintenance ng landscape", "Binunutan ng damo ang taniman, tinrim ang halaman at inayos ang gilid bawat visit."],
  ), [
    L.labour(1, "sqft", 0.08, {
      en: ["Bed maintenance — per sq ft of bed", "Weeds pulled, spent growth cut back and beds tidied."],
      fr: ["Entretien des plates-bandes — au pi²", "Mauvaises herbes arrachées, tiges fanées coupées et plates-bandes rangées."],
      es: ["Mantenimiento de canteros — por pie²", "Maleza arrancada, crecimiento seco cortado y canteros ordenados."],
      it: ["Manutenzione aiuole — al piede quadro", "Erbacce estirpate, parti secche tagliate e aiuole riordinate."],
      de: ["Beetpflege — pro sq ft Beet", "Unkraut gezogen, Verblühtes zurückgeschnitten und Beete aufgeräumt."],
      uk: ["Догляд за клумбами — за кв. фут", "Бур'яни виполото, відцвіле обрізано, клумби впорядковано."],
      tl: ["Maintenance ng taniman — kada sq ft", "Binunot ang damo, pinutol ang lanta at inayos ang taniman."],
    }, { measurementKey: "areaSqFt" }),
    SHARED.helperHour(1, 55),
  ], D.bundle("percent", 5)),

  // ── Installation ──
  "fq.lawn_care.core.sod_installation": T("installation", n(
    ["Posa di prato a rotoli", "Terreno livellato e preparato, zolle nuove posate strette e rullate, poi irrigate per un prato finito in giornata."],
    ["Rollrasen verlegen", "Boden planiert und vorbereitet, frischer Rollrasen dicht verlegt und gewalzt, dann eingewässert — fertiger Rasen am selben Tag."],
    ["Укладання рулонного газону", "Ґрунт вирівняно й підготовлено, свіжий дерн укладено щільно й прикатано, полито — готовий газон того ж дня."],
    ["Pagkabit ng sod", "Pinatag at inihanda ang lupa, inilatag nang dikit at ni-roll ang sod, dinilig para tapos na damuhan sa araw ding iyon."],
  ), [
    L.labour(1, "sqft", 0.45, {
      en: ["Soil prep and grading — per sq ft", "Old turf stripped, soil loosened, graded and rolled."],
      fr: ["Préparation du sol et nivellement — au pi²", "Ancien gazon enlevé, sol ameubli, nivelé et roulé."],
      es: ["Preparación y nivelación — por pie²", "Pasto viejo retirado, suelo aflojado, nivelado y compactado."],
      it: ["Preparazione e livellamento — al piede quadro", "Vecchio manto rimosso, terreno smosso, livellato e rullato."],
      de: ["Bodenvorbereitung und Planum — pro sq ft", "Alte Grasnarbe entfernt, Boden gelockert, planiert und gewalzt."],
      uk: ["Підготовка й вирівнювання ґрунту — за кв. фут", "Старий дерн знято, ґрунт розпушено, вирівняно й прикатано."],
      tl: ["Paghahanda at grading — kada sq ft", "Tinanggal ang lumang damo, niluwagan, pinatag at ni-roll ang lupa."],
    }, { measurementKey: "lotSize" }),
    L.labour(1, "sqft", 0.45, {
      en: ["Sod laying — per sq ft", "Rolls laid with staggered seams, cut to edges, rolled and watered in."],
      fr: ["Pose de tourbe — au pi²", "Rouleaux posés à joints décalés, coupés aux bordures, roulés et arrosés."],
      es: ["Colocación de pasto en rollo — por pie²", "Rollos colocados con juntas alternadas, cortados a los bordes, compactados y regados."],
      it: ["Posa zolle — al piede quadro", "Rotoli posati a giunti sfalsati, tagliati ai bordi, rullati e irrigati."],
      de: ["Rollrasen verlegen — pro sq ft", "Rollen versetzt verlegt, an Kanten geschnitten, gewalzt und gewässert."],
      uk: ["Укладання дерну — за кв. фут", "Рулони укладено зі зміщенням швів, підрізано по краях, прикатано й полито."],
      tl: ["Paglatag ng sod — kada sq ft", "Inilatag nang salit-salitan ang dugtungan, pinutol sa gilid, ni-roll at dinilig."],
    }, { measurementKey: "lotSize" }),
    hdMaterial(HD.sod_pallet, {
      en: ["Sod — per pallet", "Bluegrass sod; one pallet covers 500 sq ft."],
      fr: ["Tourbe — la palette", "Tourbe de pâturin; une palette couvre 500 pi²."],
      es: ["Pasto en rollo — por tarima", "Pasto bluegrass; una tarima cubre 500 pies²."],
      it: ["Prato a rotoli — per bancale", "Zolle di poa; un bancale copre 500 piedi quadri."],
      de: ["Rollrasen — pro Palette", "Rispengras-Rollrasen; eine Palette deckt 500 sq ft."],
      uk: ["Рулонний газон — за палету", "Дерн тонконогу; палета покриває 500 кв. футів."],
      tl: ["Sod — kada pallet", "Bluegrass na sod; ang isang pallet ay 500 sq ft."],
    }, { measurementKey: "lotSize" }),
  ], null),

  "fq.lawn_care.additional.mulch_installation": T("installation", n(
    ["Stesura pacciamatura", "Aiuole rifilate e coperte da uno strato fresco di pacciamatura che trattiene l'umidità e frena le infestanti."],
    ["Mulch ausbringen", "Beete abgestochen und mit frischem Mulch bedeckt, der Feuchte hält und Unkraut unterdrückt."],
    ["Мульчування", "Краї клумб підрізано, клумби вкрито свіжим шаром мульчі, що тримає вологу й стримує бур'яни."],
    ["Paglagay ng mulch", "Nilinyahan ang taniman at nilagyan ng bagong mulch para mapanatili ang halumigmig at pigilan ang damo."],
  ), [
    L.labour(1, "sqft", 1.25, {
      en: ["Mulch spreading — per sq ft of bed", "Beds weeded, edged and mulch spread three inches deep."],
      fr: ["Épandage de paillis — au pi² de plate-bande", "Plates-bandes désherbées, bordurées et paillis étendu sur trois pouces."],
      es: ["Esparcido de mantillo — por pie² de cantero", "Canteros deshierbados, bordeados y mantillo esparcido a tres pulgadas."],
      it: ["Stesura pacciamatura — al piede quadro di aiuola", "Aiuole diserbate, rifilate e pacciamatura stesa per tre pollici."],
      de: ["Mulch verteilen — pro sq ft Beet", "Beete gejätet, abgestochen und Mulch drei Zoll dick verteilt."],
      uk: ["Розкладання мульчі — за кв. фут клумби", "Клумби прополото, окантовано, мульчу розкладено шаром три дюйми."],
      tl: ["Paglatag ng mulch — kada sq ft ng taniman", "Binunutan, nilinyahan at nilatagan ng tatlong pulgadang mulch."],
    }, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.mulch_2cuft, {
      en: ["Mulch — per bag", "2 cu ft bag of shredded mulch; about 8 sq ft at three inches."],
      fr: ["Paillis — le sac", "Sac de 2 pi³ de paillis déchiqueté; environ 8 pi² sur trois pouces."],
      es: ["Mantillo — por bolsa", "Bolsa de 2 pies³ de mantillo triturado; unos 8 pies² a tres pulgadas."],
      it: ["Pacciamatura — al sacco", "Sacco da 2 piedi cubi di pacciamatura; circa 8 piedi quadri a tre pollici."],
      de: ["Mulch — pro Sack", "2-Kubikfuß-Sack Rindenmulch; etwa 8 sq ft bei drei Zoll."],
      uk: ["Мульча — за мішок", "Мішок подрібненої мульчі 2 куб. фути; близько 8 кв. футів шаром три дюйми."],
      tl: ["Mulch — kada sako", "2 cu ft na sako ng shredded mulch; mga 8 sq ft sa tatlong pulgada."],
    }, { measurementKey: "areaSqFt" }),
    hdMaterial(HD.edging_20ft, {
      en: ["Bed edging — per kit", "No-dig landscape edging; one kit runs 20 linear ft."],
      fr: ["Bordure de plate-bande — l'ensemble", "Bordure sans creusage; un ensemble fait 20 pi lin."],
      es: ["Borde para cantero — por kit", "Borde sin excavación; un kit rinde 20 pies lineales."],
      it: ["Bordura per aiuole — per kit", "Bordura senza scavo; un kit fa 20 piedi lineari."],
      de: ["Beeteinfassung — pro Set", "Einfassung ohne Graben; ein Set reicht für 20 lfd. Fuß."],
      uk: ["Бордюр для клумби — за комплект", "Бордюр без копання; комплект на 20 пог. футів."],
      tl: ["Edging ng taniman — kada kit", "No-dig na landscape edging; ang isang kit ay 20 linear ft."],
    }, { measurementKey: "edgingFt" }),
  ], null),

  "fq.lawn_care.additional.hardscape_install": T("installation", n(
    ["Posa hardscape — patii, vialetti ed elementi in pietra", "Masselli, lastre o muretti posati su una base compattata per un patio, un vialetto o un elemento che dura."],
    ["Hardscape — Terrassen, Wege und Steinelemente", "Pflaster, Platten oder Stützmauern auf verdichtetem Unterbau für eine dauerhafte Terrasse, einen Weg oder ein Element."],
    ["Мощення — патіо, доріжки та кам'яні елементи", "Бруківку, плиту чи підпірні стінки укладено на ущільнену основу для міцного патіо, доріжки чи елемента."],
    ["Hardscape — patio, daanan at batong elemento", "Pavers, flagstone o retaining wall sa siksik na base para sa matibay na patio, daanan o elemento."],
  ), [
    L.labour(1, "sqft", 14, {
      en: ["Paver installation — per sq ft", "Excavated, base compacted in lifts, pavers laid, edged and joint-sanded."],
      fr: ["Pose de pavés — au pi²", "Excavé, fondation compactée par couches, pavés posés, bordés et jointoyés au sable."],
      es: ["Instalación de adoquín — por pie²", "Excavado, base compactada por capas, adoquines colocados, confinados y arenados."],
      it: ["Posa autobloccanti — al piede quadro", "Scavato, base compattata a strati, masselli posati, bordati e sigillati a sabbia."],
      de: ["Pflasterverlegung — pro sq ft", "Ausgehoben, Tragschicht lagenweise verdichtet, Pflaster verlegt, eingefasst und eingesandet."],
      uk: ["Укладання бруківки — за кв. фут", "Викопано, основу ущільнено шарами, бруківку укладено, обрамлено й засипано піском."],
      tl: ["Pagkabit ng pavers — kada sq ft", "Hinukay, siniksik ang base nang paisa-isang layer, inilatag, nilagyan ng gilid at buhangin."],
    }, { measurementKey: "areaSqft" }),
    hdMaterial(HD.paver_base_half_cuft, {
      en: ["Paver base — per bag", "0.5 cu ft bag of paver base; about 1.5 sq ft at four inches."],
      fr: ["Fondation pour pavés — le sac", "Sac de 0,5 pi³; environ 1,5 pi² sur quatre pouces."],
      es: ["Base para adoquín — por bolsa", "Bolsa de 0.5 pies³; unos 1.5 pies² a cuatro pulgadas."],
      it: ["Sottofondo per masselli — al sacco", "Sacco da 0,5 piedi cubi; circa 1,5 piedi quadri a quattro pollici."],
      de: ["Pflasterunterbau — pro Sack", "0,5-Kubikfuß-Sack; etwa 1,5 sq ft bei vier Zoll."],
      uk: ["Основа під бруківку — за мішок", "Мішок 0,5 куб. фута; близько 1,5 кв. фута шаром чотири дюйми."],
      tl: ["Paver base — kada sako", "0.5 cu ft na sako; mga 1.5 sq ft sa apat na pulgada."],
    }, { measurementKey: "areaSqft" }),
    L.material(1, "sqft", 4.5, {
      en: ["Concrete pavers — per sq ft", "Standard concrete pavers, edge restraint and polymeric joint sand."],
      fr: ["Pavés de béton — au pi²", "Pavés de béton standard, bordure de retenue et sable polymère."],
      es: ["Adoquín de concreto — por pie²", "Adoquín de concreto estándar, confinamiento y arena polimérica."],
      it: ["Masselli in calcestruzzo — al piede quadro", "Masselli standard, cordolo di contenimento e sabbia polimerica."],
      de: ["Betonpflaster — pro sq ft", "Standard-Betonpflaster, Randeinfassung und Polymer-Fugensand."],
      uk: ["Бетонна бруківка — за кв. фут", "Стандартна бетонна бруківка, бордюрний обмежувач і полімерний пісок."],
      tl: ["Concrete pavers — kada sq ft", "Standard na concrete pavers, edge restraint at polymeric sand."],
    }, { measurementKey: "areaSqft" }),
  ], null),

  "fq.lawn_care.additional.irrigation_install": T("installation", n(
    ["Installazione impianto di irrigazione", "Linee interrate, irrigatori e centralina installati e suddivisi in zone per annaffiare in modo uniforme."],
    ["Bewässerungsanlage einbauen", "Unterirdische Leitungen, Regner und Steuerung eingebaut und in Zonen geteilt, für gleichmäßige Bewässerung."],
    ["Встановлення поливної системи", "Підземні лінії, зрошувачі й контролер встановлено й поділено на зони для рівномірного поливу."],
    ["Pagkabit ng irrigation system", "Ikinabit ang linya sa ilalim ng lupa, sprinkler at controller at hinati sa zone para pantay ang dilig."],
  ), [
    L.labour(1, "each", 650, {
      en: ["Irrigation zone installation — per zone", "Trenching, pipe, heads and valve for one zone, tested for coverage."],
      fr: ["Installation de zone d'irrigation — la zone", "Tranchée, tuyau, arroseurs et vanne pour une zone, couverture testée."],
      es: ["Instalación de zona de riego — por zona", "Zanja, tubería, aspersores y válvula de una zona, cobertura probada."],
      it: ["Installazione zona irrigua — per zona", "Scavo, tubo, irrigatori e valvola per una zona, copertura provata."],
      de: ["Bewässerungszone — pro Zone", "Graben, Rohr, Regner und Ventil für eine Zone, Abdeckung getestet."],
      uk: ["Монтаж зони поливу — за зону", "Траншея, труба, зрошувачі та клапан на одну зону, покриття перевірено."],
      tl: ["Pagkabit ng irrigation zone — kada zone", "Kanal, tubo, sprinkler head at valve para sa isang zone, sinubukan ang abot."],
    }, { measurementKey: "each" }),
    L.material(1, "flat", 280, {
      en: ["Controller and backflow parts", "Smart controller, wire and backflow connection fittings."],
      fr: ["Contrôleur et pièces anti-refoulement", "Contrôleur intelligent, fil et raccords anti-refoulement."],
      es: ["Controlador y piezas antirretorno", "Controlador inteligente, cable y conexiones antirretorno."],
      it: ["Centralina e parti antiriflusso", "Centralina smart, cavo e raccordi antiriflusso."],
      de: ["Steuerung und Rückflussteile", "Smarte Steuerung, Kabel und Rückflussverhinderer-Anschlüsse."],
      uk: ["Контролер і деталі зворотного клапана", "Розумний контролер, дріт і фітинги зворотного клапана."],
      tl: ["Controller at backflow parts", "Smart controller, wire at backflow fittings."],
    }),
  ], null),

  // ── Repair ──
  "fq.lawn_care.maintenance.irrigation_service": T("repair", n(
    ["Assistenza e riparazione irrigazione", "Zone provate, irrigatori rotti e linee che perdono sostituiti, centralina riprogrammata."],
    ["Bewässerung warten und reparieren", "Zonen getestet, defekte Regner und undichte Leitungen ersetzt, Steuerung neu programmiert."],
    ["Обслуговування та ремонт поливу", "Зони перевірено, зламані зрошувачі й протікаючі лінії замінено, контролер перепрограмовано."],
    ["Service at pag-ayos ng irrigation", "Sinubukan ang mga zone, pinalitan ang sirang head at tumutulong linya, ni-reprogram ang controller."],
  ), [
    SHARED.serviceCall(85),
    SHARED.techHour(1, 85),
    L.material(1, "each", 18, {
      en: ["Replacement spray head — per head", "Pop-up spray or rotor head with nozzle."],
      fr: ["Arroseur de remplacement — l'unité", "Arroseur escamotable ou rotor avec buse."],
      es: ["Aspersor de repuesto — por pieza", "Aspersor emergente o rotor con boquilla."],
      it: ["Irrigatore di ricambio — cadauno", "Irrigatore a scomparsa o rotore con ugello."],
      de: ["Ersatzregner — pro Stück", "Versenk- oder Getrieberegner mit Düse."],
      uk: ["Змінний зрошувач — за штуку", "Висувний зрошувач або ротор із соплом."],
      tl: ["Kapalit na spray head — kada isa", "Pop-up spray o rotor head na may nozzle."],
    }, { measurementKey: "each" }),
  ], null),

  "fq.lawn_care.additional.drainage_solutions": T("repair", n(
    ["Soluzioni di drenaggio", "Ristagni e ruscellamento risolti con rimodellamento, drenaggi francesi o pozzetti."],
    ["Entwässerungslösungen", "Staunässe und Abfluss durch Neuprofilierung, Sickerrohre oder Einläufe behoben."],
    ["Дренажні рішення", "Застійну воду й стік усунено перепрофілюванням, французьким дренажем або дощоприймачами."],
    ["Solusyon sa drainage", "Inayos ang nakatenggang tubig at agos sa regrading, French drain o catch basin."],
  ), [
    L.labour(1, "linear_ft", 28, {
      en: ["French drain — per linear ft", "Trench dug to fall, fabric laid, perforated pipe set in gravel and backfilled."],
      fr: ["Drain français — au pi lin.", "Tranchée creusée en pente, géotextile posé, tuyau perforé dans le gravier et remblayé."],
      es: ["Drenaje francés — por pie lineal", "Zanja con pendiente, geotextil, tubo perforado en grava y relleno."],
      it: ["Drenaggio francese — al piede lineare", "Scavo in pendenza, geotessuto, tubo forato nella ghiaia e rinterro."],
      de: ["Sickerdrain — pro lfd. Fuß", "Graben mit Gefälle, Vlies, Drainrohr in Kies gebettet und verfüllt."],
      uk: ["Французький дренаж — за пог. фут", "Траншею викопано з ухилом, укладено геотекстиль, перфоровану трубу в гравій і засипано."],
      tl: ["French drain — kada linear ft", "Hinukay ang kanal na may slope, nilagyan ng tela, perforated pipe sa graba at tinabunan."],
    }, { measurementKey: "linearFt" }),
    hdMaterial(HD.gravel_trench, {
      en: ["Drainage gravel — per bag", "0.5 cu ft bag of all-purpose rock; half a foot of a 12 × 12 in trench."],
      fr: ["Gravier de drainage — le sac", "Sac de 0,5 pi³ de pierre tout usage."],
      es: ["Grava de drenaje — por bolsa", "Bolsa de 0.5 pies³ de grava multiuso."],
      it: ["Ghiaia drenante — al sacco", "Sacco da 0,5 piedi cubi di ghiaia multiuso."],
      de: ["Drainagekies — pro Sack", "0,5-Kubikfuß-Sack Allzweckkies."],
      uk: ["Дренажний гравій — за мішок", "Мішок універсального гравію 0,5 куб. фута."],
      tl: ["Drainage gravel — kada sako", "0.5 cu ft na sako ng all-purpose na bato."],
    }, { measurementKey: "linearFt" }),
  ], null),

  "fq.lawn_care.additional.repair_visit": T("repair", n(
    ["Intervento di riparazione prato e giardino", "Visita prenotata di due ore per sistemare ciò che non va — una chiazza spoglia, un'aiuola dilavata, un vialetto ceduto."],
    ["Reparatureinsatz Rasen und Garten", "Gebuchter Zwei-Stunden-Termin, um zu beheben, was nicht passt — eine kahle Stelle, ein ausgespültes Beet, ein abgesackter Weg."],
    ["Ремонтний виїзд для газону й саду", "Запланований двогодинний візит, щоб виправити проблему — лисину, розмите клумбу, просілу доріжку."],
    ["Repair visit sa damuhan at landscape", "Naka-book na dalawang oras na visit para ayusin ang sira — kalbong bahagi, nasirang taniman, lumubog na daanan."],
  ), [
    L.labour(2, "hour", 75, {
      en: ["Landscape repair labour", "Patch seeding, bed rebuilding or path levelling, by the hour."],
      fr: ["Main-d'œuvre — réparation paysagère", "Réensemencement localisé, reconstruction de plate-bande ou nivellement d'allée, à l'heure."],
      es: ["Mano de obra — reparación de jardín", "Resiembra en parches, reconstrucción de canteros o nivelación de senderos, por hora."],
      it: ["Manodopera — riparazione giardino", "Risemina a chiazze, ricostruzione aiuole o livellamento vialetti, a ore."],
      de: ["Arbeit — Gartenreparatur", "Nachsaat, Beete neu anlegen oder Wege nivellieren, nach Stunden."],
      uk: ["Робота — ремонт ландшафту", "Підсівання, відновлення клумб або вирівнювання доріжок, погодинно."],
      tl: ["Labor — pag-ayos ng landscape", "Patch seeding, pag-ayos ng taniman o pagpatag ng daanan, kada oras."],
    }),
    hdMaterial(HD.grass_seed_20lb, {
      en: ["Grass seed — per bag", "Contractor mix, 20 lb; one bag seeds about 6,600 sq ft."],
      fr: ["Semences de gazon — le sac", "Mélange entrepreneur, 20 lb; un sac ensemence environ 6 600 pi²."],
      es: ["Semilla de pasto — por bolsa", "Mezcla para contratista, 20 lb; una bolsa siembra unos 6,600 pies²."],
      it: ["Semi per prato — al sacco", "Miscela professionale, 20 lb; un sacco semina circa 6.600 piedi quadri."],
      de: ["Rasensamen — pro Sack", "Profimischung, 20 lb; ein Sack reicht für etwa 6.600 sq ft."],
      uk: ["Насіння газону — за мішок", "Професійна суміш, 20 фунтів; мішок на близько 6600 кв. футів."],
      tl: ["Buto ng damo — kada sako", "Contractor mix, 20 lb; ang isang sako ay para sa mga 6,600 sq ft."],
    }, { measurementKey: "areaSqFt" }),
  ], null),

  // ── Inspection ──
  "fq.lawn_care.maintenance.lawn_health_inspection": T("inspection", n(
    ["Ispezione della salute del prato", "Prato percorso per verificare densità, terreno, chiazze e parassiti, con un piano scritto di cosa trattare."],
    ["Rasen-Gesundheitscheck", "Rasen begangen, um Dichte, Boden, kahle Stellen und Schädlinge zu prüfen, mit schriftlichem Behandlungsplan."],
    ["Огляд стану газону", "Газон обійдено для перевірки густоти, ґрунту, плям і шкідників, із письмовим планом обробки."],
    ["Inspeksyon ng kalusugan ng damuhan", "Nilakaran ang damuhan para tingnan ang kapal, lupa, kalbo at peste, may nakasulat na plano."],
  ), [
    L.labour(1, "flat", 75, {
      en: ["Lawn assessment and soil test", "Turf and soil checked, a soil sample pulled and a treatment plan written."],
      fr: ["Évaluation de pelouse et analyse de sol", "Gazon et sol vérifiés, échantillon prélevé et plan de traitement rédigé."],
      es: ["Evaluación del césped y análisis de suelo", "Pasto y suelo revisados, muestra tomada y plan de tratamiento escrito."],
      it: ["Valutazione prato e analisi del terreno", "Manto e terreno controllati, campione prelevato e piano di trattamento redatto."],
      de: ["Rasenbewertung und Bodenprobe", "Rasen und Boden geprüft, Probe gezogen und Behandlungsplan geschrieben."],
      uk: ["Оцінка газону й аналіз ґрунту", "Дерн і ґрунт перевірено, взято пробу, складено план обробки."],
      tl: ["Assessment ng damuhan at soil test", "Chineck ang damo at lupa, kumuha ng sample at isinulat ang plano."],
    }),
    L.material(1, "each", 25, {
      en: ["Soil test kit", "Lab soil test for pH and nutrients."],
      fr: ["Trousse d'analyse de sol", "Analyse de sol en laboratoire pour le pH et les nutriments."],
      es: ["Kit de análisis de suelo", "Análisis de laboratorio de pH y nutrientes."],
      it: ["Kit analisi del terreno", "Analisi di laboratorio di pH e nutrienti."],
      de: ["Bodentest-Set", "Laboranalyse für pH-Wert und Nährstoffe."],
      uk: ["Набір для аналізу ґрунту", "Лабораторний аналіз pH і поживних речовин."],
      tl: ["Soil test kit", "Lab soil test para sa pH at nutrients."],
    }),
  ], null),

  "fq.lawn_care.maintenance.inspection_visit": T("inspection", n(
    ["Visita di ispezione prato e giardino", "Visita prenotata di due ore per esaminare tutta la proprietà e lasciare raccomandazioni chiare."],
    ["Inspektionstermin Rasen und Garten", "Gebuchter Zwei-Stunden-Termin, um das ganze Grundstück anzusehen und klare Empfehlungen zu geben."],
    ["Огляд газону та ландшафту", "Запланований двогодинний візит, щоб оглянути всю ділянку й залишити чіткі рекомендації."],
    ["Inspection visit ng damuhan at landscape", "Naka-book na dalawang oras na visit para tingnan ang buong property at mag-iwan ng malinaw na rekomendasyon."],
  ), [
    L.labour(1, "flat", 95, {
      en: ["Property walkthrough", "Lawn, beds, trees and drainage looked over and a written list of recommendations left."],
      fr: ["Visite de la propriété", "Pelouse, plates-bandes, arbres et drainage examinés, liste écrite de recommandations laissée."],
      es: ["Recorrido de la propiedad", "Césped, canteros, árboles y drenaje revisados y una lista escrita de recomendaciones."],
      it: ["Giro della proprietà", "Prato, aiuole, alberi e drenaggio esaminati e lista scritta di raccomandazioni lasciata."],
      de: ["Grundstücksbegehung", "Rasen, Beete, Bäume und Entwässerung angesehen, schriftliche Empfehlungsliste hinterlassen."],
      uk: ["Обхід ділянки", "Газон, клумби, дерева й дренаж оглянуто, залишено письмові рекомендації."],
      tl: ["Walkthrough ng property", "Tiningnan ang damuhan, taniman, puno at drainage at iniwan ang nakasulat na rekomendasyon."],
    }),
  ], null),

  "fq.lawn_care.additional.landscape_design": T("inspection", n(
    ["Progettazione del paesaggio", "Un progetto dello spazio esterno — aiuole, piante, percorsi e prato — su misura per l'uso della proprietà."],
    ["Landschaftsplanung", "Ein Plan für den Außenbereich — Beete, Pflanzen, Wege und Rasen — passend zur Nutzung des Grundstücks."],
    ["Ландшафтний дизайн", "План зовнішнього простору — клумби, рослини, доріжки й газон — під те, як використовується ділянка."],
    ["Disenyo ng landscape", "Plano ng labas — taniman, halaman, daanan at damuhan — angkop sa gamit ng property."],
  ), [
    L.labour(1, "flat", 450, {
      en: ["Design consultation and plan", "Site measured, needs discussed and a scaled planting and hardscape plan drawn."],
      fr: ["Consultation et plan de conception", "Terrain mesuré, besoins discutés et plan à l'échelle des plantations et aménagements dessiné."],
      es: ["Consulta y plano de diseño", "Terreno medido, necesidades conversadas y un plano a escala de plantas y pavimentos dibujado."],
      it: ["Consulenza e progetto", "Area misurata, esigenze discusse e un progetto in scala di piante e pavimentazioni disegnato."],
      de: ["Planungsgespräch und Plan", "Grundstück aufgemessen, Wünsche besprochen und ein maßstäblicher Pflanz- und Hardscape-Plan gezeichnet."],
      uk: ["Консультація та план", "Ділянку виміряно, потреби обговорено, накреслено масштабний план насаджень і мощення."],
      tl: ["Konsultasyon at plano", "Sinukat ang lote, pinag-usapan ang kailangan at ginuhit ang scaled na plano ng halaman at hardscape."],
    }),
  ], null),
};

withTemplates(SEED, TEMPLATES);
