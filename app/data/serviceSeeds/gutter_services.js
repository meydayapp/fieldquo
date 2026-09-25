// app/data/serviceSeeds/gutter_services.js
//
// The service list a gutter company starts from. Read ./index.js for the
// format and the rules. The benchmark's gutter book is a grid — install,
// maintain or repair × gutter type — with no pricing insight, built here from
// one table per type and emitted in source order. Its two "Cleaning" rows are
// not repeated: gutter cleaning is one canonical row in window_cleaning.js
// tagged for this trade (lib/services/seeds.js#serviceSeedsForCompanyTrade).
// Lengths are the gutter measurement's `gutterFt`, downspouts its count.
import { L, SHARED, D, T, withTemplates, hdMaterial, withLanguages } from "./_templateLines";
import { HD } from "./_materialCosts";
import { I18N } from "./i18n/gutter_services.js";
const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "gutter_services",
  categories: [
    { key: "install", name: { en: "Gutter installation", fr: "Installation de gouttières", es: "Instalación de canaletas" } },
    { key: "maintenance", name: { en: "Gutter maintenance", fr: "Entretien de gouttières", es: "Mantenimiento de canaletas" } },
    { key: "repair", name: { en: "Gutter repair", fr: "Réparation de gouttières", es: "Reparación de canaletas" } },
    { key: "visits", name: { en: "Inspections and estimates", fr: "Inspections et soumissions", es: "Inspecciones y presupuestos" } },
  ],
  services: [
    S("fq.gutter_services.install.regular", "install", "linear_ft", null,
      ["Sectional gutters — installation", "Gouttières à sections — installation", "Canaletas seccionales — instalación"],
      ["Sectional gutters measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de gouttières à sections : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de canaletas seccionales: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.seamless", "install", "linear_ft", null,
      ["Seamless gutters — installation", "Gouttières sans joint — installation", "Canaletas sin costura — instalación"],
      ["Seamless gutters measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de gouttières sans joint : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de canaletas sin costura: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.downspouts", "install", "each", null,
      ["Downspouts — installation", "Descentes pluviales — installation", "Bajantes — instalación"],
      ["Downspouts measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de descentes pluviales : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de bajantes: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.box", "install", "linear_ft", null,
      ["Box gutters — installation", "Gouttières en caisson — installation", "Canaletas de caja — instalación"],
      ["Box gutters measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de gouttières en caisson : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de canaletas de caja: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.copper", "install", "linear_ft", null,
      ["Copper gutters — installation", "Gouttières en cuivre — installation", "Canaletas de cobre — instalación"],
      ["Copper gutters measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de gouttières en cuivre : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de canaletas de cobre: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.guards", "install", "linear_ft", null,
      ["Gutter guards — installation", "Protège-gouttières — installation", "Protectores de canaleta — instalación"],
      ["Gutter guards measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de protège-gouttières : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de protectores de canaleta: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.half_round", "install", "linear_ft", null,
      ["Half-round gutters — installation", "Gouttières demi-rondes — installation", "Canaletas de media caña — instalación"],
      ["Half-round gutters measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de gouttières demi-rondes : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de canaletas de media caña: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.k_style", "install", "linear_ft", null,
      ["K-style gutters — installation", "Gouttières de style K — installation", "Canaletas estilo K — instalación"],
      ["K-style gutters measured, hung on hidden hangers or brackets, pitched to the outlets and sealed at every joint.", "Installation de gouttières de style K : mesure, pose sur crochets dissimulés ou supports, pente vers les sorties et joints scellés.", "Instalación de canaletas estilo K: medición, colocación con ganchos ocultos o soportes, pendiente hacia las salidas y uniones selladas."]),
    S("fq.gutter_services.install.french_drain", "install", "linear_ft", null,
      ["French drains — installation", "Drains français — installation", "Drenes franceses — instalación"],
      ["A gravel trench with perforated pipe laid to carry water from the downspouts away from the foundation.", "Tranchée de gravier avec tuyau perforé posée pour éloigner l'eau des descentes de la fondation.", "Zanja de grava con tubo perforado para alejar el agua de las bajantes de la cimentación."]),
    S("fq.gutter_services.install.other", "install", "flat", null,
      ["Other gutter installation — describe what you need", "Autre installation de gouttières — décrivez le besoin", "Otra instalación de canaletas — describa lo que necesita"],
      ["Gutter work not listed above, priced after a look at the roofline.", "Travail de gouttières non listé ci-dessus, chiffré après examen de la toiture.", "Trabajo de canaletas no listado arriba, cotizado después de revisar el alero."]),
    S("fq.gutter_services.maintenance.regular", "maintenance", "linear_ft", null,
      ["Sectional gutters — maintenance", "Gouttières à sections — entretien", "Canaletas seccionales — mantenimiento"],
      ["Sectional gutters checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de gouttières à sections : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de canaletas seccionales: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.seamless", "maintenance", "linear_ft", null,
      ["Seamless gutters — maintenance", "Gouttières sans joint — entretien", "Canaletas sin costura — mantenimiento"],
      ["Seamless gutters checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de gouttières sans joint : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de canaletas sin costura: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.downspouts", "maintenance", "each", null,
      ["Downspouts — maintenance", "Descentes pluviales — entretien", "Bajantes — mantenimiento"],
      ["Downspouts checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de descentes pluviales : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de bajantes: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.box", "maintenance", "linear_ft", null,
      ["Box gutters — maintenance", "Gouttières en caisson — entretien", "Canaletas de caja — mantenimiento"],
      ["Box gutters checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de gouttières en caisson : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de canaletas de caja: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.copper", "maintenance", "linear_ft", null,
      ["Copper gutters — maintenance", "Gouttières en cuivre — entretien", "Canaletas de cobre — mantenimiento"],
      ["Copper gutters checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de gouttières en cuivre : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de canaletas de cobre: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.guards", "maintenance", "linear_ft", null,
      ["Gutter guards — maintenance", "Protège-gouttières — entretien", "Protectores de canaleta — mantenimiento"],
      ["Gutter guards checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de protège-gouttières : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de protectores de canaleta: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.half_round", "maintenance", "linear_ft", null,
      ["Half-round gutters — maintenance", "Gouttières demi-rondes — entretien", "Canaletas de media caña — mantenimiento"],
      ["Half-round gutters checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de gouttières demi-rondes : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de canaletas de media caña: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.k_style", "maintenance", "linear_ft", null,
      ["K-style gutters — maintenance", "Gouttières de style K — entretien", "Canaletas estilo K — mantenimiento"],
      ["K-style gutters checked, cleared, re-secured and resealed where needed so they keep draining through the season.", "Entretien de gouttières de style K : vérification, dégagement, refixation et rescellement au besoin pour un bon écoulement toute la saison.", "Mantenimiento de canaletas estilo K: revisión, limpieza, refijado y resellado donde haga falta para que drenen toda la temporada."]),
    S("fq.gutter_services.maintenance.painting", "maintenance", "linear_ft", null,
      ["Gutter painting — maintenance", "Peinture de gouttières — entretien", "Pintura de canaletas — mantenimiento"],
      ["Faded or peeling gutters and downspouts cleaned, primed and painted to match the trim.", "Gouttières et descentes décolorées ou écaillées nettoyées, apprêtées et peintes assorties aux moulures.", "Canaletas y bajantes descoloridas o descascaradas limpiadas, imprimadas y pintadas a juego con las molduras."]),
    S("fq.gutter_services.maintenance.other", "maintenance", "flat", null,
      ["Other gutter maintenance — describe what you need", "Autre entretien de gouttières — décrivez le besoin", "Otro mantenimiento de canaletas — describa lo que necesita"],
      ["Gutter work not listed above, priced after a look at the roofline.", "Travail de gouttières non listé ci-dessus, chiffré après examen de la toiture.", "Trabajo de canaletas no listado arriba, cotizado después de revisar el alero."]),
    S("fq.gutter_services.repair.regular", "repair", "linear_ft", null,
      ["Sectional gutters — repair", "Gouttières à sections — réparation", "Canaletas seccionales — reparación"],
      ["Leaks, sags and loose sections of sectional gutters repaired, re-hung and resealed at the fault.", "Réparation de gouttières à sections : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de canaletas seccionales: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.seamless", "repair", "linear_ft", null,
      ["Seamless gutters — repair", "Gouttières sans joint — réparation", "Canaletas sin costura — reparación"],
      ["Leaks, sags and loose sections of seamless gutters repaired, re-hung and resealed at the fault.", "Réparation de gouttières sans joint : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de canaletas sin costura: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.downspouts", "repair", "each", null,
      ["Downspouts — repair", "Descentes pluviales — réparation", "Bajantes — reparación"],
      ["Leaks, sags and loose sections of downspouts repaired, re-hung and resealed at the fault.", "Réparation de descentes pluviales : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de bajantes: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.box", "repair", "linear_ft", null,
      ["Box gutters — repair", "Gouttières en caisson — réparation", "Canaletas de caja — reparación"],
      ["Leaks, sags and loose sections of box gutters repaired, re-hung and resealed at the fault.", "Réparation de gouttières en caisson : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de canaletas de caja: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.copper", "repair", "linear_ft", null,
      ["Copper gutters — repair", "Gouttières en cuivre — réparation", "Canaletas de cobre — reparación"],
      ["Leaks, sags and loose sections of copper gutters repaired, re-hung and resealed at the fault.", "Réparation de gouttières en cuivre : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de canaletas de cobre: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.guards", "repair", "linear_ft", null,
      ["Gutter guards — repair", "Protège-gouttières — réparation", "Protectores de canaleta — reparación"],
      ["Leaks, sags and loose sections of gutter guards repaired, re-hung and resealed at the fault.", "Réparation de protège-gouttières : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de protectores de canaleta: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.half_round", "repair", "linear_ft", null,
      ["Half-round gutters — repair", "Gouttières demi-rondes — réparation", "Canaletas de media caña — reparación"],
      ["Leaks, sags and loose sections of half-round gutters repaired, re-hung and resealed at the fault.", "Réparation de gouttières demi-rondes : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de canaletas de media caña: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.k_style", "repair", "linear_ft", null,
      ["K-style gutters — repair", "Gouttières de style K — réparation", "Canaletas estilo K — reparación"],
      ["Leaks, sags and loose sections of k-style gutters repaired, re-hung and resealed at the fault.", "Réparation de gouttières de style K : fuites, affaissements et sections lâches réparés, refixés et rescellés au point défaillant.", "Reparación de canaletas estilo K: fugas, hundimientos y tramos sueltos reparados, recolgados y resellados en la falla."]),
    S("fq.gutter_services.repair.painting", "repair", "linear_ft", null,
      ["Gutter painting — repair", "Peinture de gouttières — réparation", "Pintura de canaletas — reparación"],
      ["Bare or rusting spots on gutters touched up and repainted so the metal is protected again.", "Zones nues ou rouillées des gouttières retouchées et repeintes pour protéger de nouveau le métal.", "Zonas desnudas u oxidadas de las canaletas retocadas y repintadas para proteger el metal otra vez."]),
    S("fq.gutter_services.repair.french_drain", "repair", "linear_ft", null,
      ["French drains — repair", "Drains français — réparation", "Drenes franceses — reparación"],
      ["A clogged or crushed French drain opened, flushed or relaid so water leaves the foundation again.", "Drain français bouché ou écrasé ouvert, rincé ou reposé pour que l'eau s'éloigne de nouveau de la fondation.", "Dren francés tapado o aplastado abierto, enjuagado o recolocado para que el agua se aleje otra vez de la cimentación."]),
    S("fq.gutter_services.repair.other", "repair", "flat", null,
      ["Other gutter repair — describe what you need", "Autre réparation de gouttières — décrivez le besoin", "Otra reparación de canaletas — describa lo que necesita"],
      ["Gutter work not listed above, priced after a look at the roofline.", "Travail de gouttières non listé ci-dessus, chiffré après examen de la toiture.", "Trabajo de canaletas no listado arriba, cotizado después de revisar el alero."]),
    S("fq.gutter_services.visits.inspection", "visits", "flat", null,
      ["Gutter and drainage inspection", "Inspection des gouttières et du drainage", "Inspección de canaletas y drenaje"],
      ["Every run, outlet and downspout checked and where the water lands traced, with photos and a written quote.", "Chaque section, sortie et descente vérifiée et trajet de l'eau suivi, avec photos et soumission écrite.", "Cada tramo, salida y bajante revisado y el recorrido del agua seguido, con fotos y cotización por escrito."], { durationMinutes: 45, bookable: true }),
    S("fq.gutter_services.visits.estimate_visit", "visits", "flat", null,
      ["Gutter replacement estimate", "Soumission de remplacement de gouttières", "Presupuesto de reemplazo de canaletas"],
      ["The eaves measured, colours and profiles chosen and a written price left for new gutters and downspouts.", "Avant-toits mesurés, couleurs et profils choisis et prix écrit laissé pour de nouvelles gouttières et descentes.", "Aleros medidos, colores y perfiles elegidos y un precio por escrito para canaletas y bajantes nuevas."], { durationMinutes: 30, bookable: true }),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the benchmark has no gutter insight; these are 2026 installed
// rates — seamless aluminium $9–12 a linear ft, downspouts $10–14 a foot run
// or ~$95 each, micro-mesh guards $8–12 a foot installed, copper $25–35 a
// foot — with the Home Depot reference for aluminium gutter lengths. Runs
// are the gutter measurement's `gutterFt`, downspouts its `downspouts`.
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const t7 = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });
const GUTTER_LABOUR = (price) => L.labour(1, "linear_ft", price, t7(
  ["Gutter installation — per linear ft", "Gutter formed or cut, hung on hidden hangers every 24 in and pitched to the outlets."],
  ["Pose de gouttière — au pi lin.", "Gouttière formée ou coupée, suspendue aux crochets dissimulés aux 24 po et en pente vers les sorties."],
  ["Instalación de canaleta — por pie lineal", "Canaleta formada o cortada, colgada con ganchos ocultos cada 24 pulg y con pendiente a las salidas."],
  ["Posa grondaia — al piede lineare", "Grondaia profilata o tagliata, appesa a staffe nascoste ogni 24 pollici e in pendenza verso gli scarichi."],
  ["Rinnenmontage — pro lfd. Fuß", "Rinne geformt oder geschnitten, alle 24 Zoll an verdeckten Haltern und mit Gefälle zu den Stutzen."],
  ["Монтаж ринви — за пог. фут", "Ринву сформовано чи нарізано, підвішено на приховані гаки кожні 24 дюйми з ухилом до воронок."],
  ["Pagkabit ng gutter — kada linear ft", "Hinubog o pinutol, isinabit sa hidden hanger bawat 24 in at may slope papunta sa outlet."],
), { measurementKey: "gutterFt" });
const DOWNSPOUT = (price = 95) => L.labour(1, "each", price, t7(
  ["Downspout — per downspout", "Outlet cut, elbows and a 10 ft downspout fitted, strapped and turned away from the wall."],
  ["Descente — l'unité", "Sortie découpée, coudes et descente de 10 pi posés, fixés et dirigés loin du mur."],
  ["Bajante — por bajante", "Salida cortada, codos y bajante de 10 pies colocados, fijados y desviados del muro."],
  ["Pluviale — cadauno", "Scarico tagliato, gomiti e pluviale da 10 piedi montati, fissati e deviati dal muro."],
  ["Fallrohr — pro Stück", "Stutzen geschnitten, Bögen und 10-Fuß-Fallrohr montiert, befestigt und von der Wand weggeführt."],
  ["Водостічна труба — за трубу", "Воронку вирізано, коліна й трубу 10 футів встановлено, закріплено й відведено від стіни."],
  ["Downspout — kada isa", "Hiniwa ang outlet, ikinabit ang elbow at 10 ft na downspout, sinigurado at inilayo sa pader."],
), { measurementKey: "downspouts" });

const TEMPLATES = {
  "fq.gutter_services.install.seamless": T("installation", n(
    ["Grondaie senza giunture — installazione", "Grondaie senza giunture misurate, appese su staffe nascoste, in pendenza verso gli scarichi e sigillate a ogni giunto."],
    ["Nahtlose Dachrinnen — Montage", "Nahtlose Rinnen aufgemessen, an verdeckten Haltern montiert, mit Gefälle zu den Stutzen und an jeder Verbindung abgedichtet."],
    ["Безшовні ринви — монтаж", "Безшовні ринви виміряно, підвішено на приховані гаки з ухилом до воронок, кожен стик загерметизовано."],
    ["Seamless gutters — pagkabit", "Sinukat, isinabit sa hidden hanger, may slope sa outlet at sinelyuhan ang bawat dugtungan ang seamless gutter."],
  ), [
    SHARED.removeOld(150),
    GUTTER_LABOUR(5),
    DOWNSPOUT(),
    hdMaterial(HD.gutter_5k_10, t7(
      ["Aluminium gutter — per 10 ft length", "5 in K-style aluminium gutter with hangers, end caps and outlets."],
      ["Gouttière d'aluminium — la longueur de 10 pi", "Gouttière en aluminium style K de 5 po avec crochets, embouts et sorties."],
      ["Canaleta de aluminio — por tramo de 10 pies", "Canaleta de aluminio estilo K de 5 pulg con ganchos, tapas y salidas."],
      ["Grondaia in alluminio — per barra da 10 piedi", "Grondaia in alluminio stile K da 5 pollici con staffe, testate e bocchettoni."],
      ["Aluminiumrinne — pro 10-Fuß-Länge", "5-Zoll-K-Profil-Rinne aus Aluminium mit Haltern, Endkappen und Stutzen."],
      ["Алюмінієва ринва — за 10-футову довжину", "Ринва K-профілю 5 дюймів з алюмінію з гаками, заглушками й воронками."],
      ["Aluminum gutter — kada 10 ft na haba", "5 in K-style na aluminum gutter na may hanger, end cap at outlet."],
    ), { measurementKey: "gutterFt" }),
  ], D.newCustomer("fixed", 50)),

  "fq.gutter_services.install.guards": T("installation", n(
    ["Paraf fogliame per grondaie — installazione", "Paraf fogliame montati sulle grondaie esistenti, fissati sotto il primo corso di tegole o al bordo anteriore."],
    ["Laubschutz — Montage", "Laubschutzgitter auf die vorhandenen Rinnen montiert, unter der ersten Schindelreihe oder an der Vorderkante befestigt."],
    ["Сітки для ринв — монтаж", "Захисні сітки встановлено на наявні ринви й закріплено під першим рядом покрівлі або по передньому краю."],
    ["Gutter guards — pagkabit", "Ikinabit ang gutter guard sa existing na gutter, nakakabit sa ilalim ng unang shingle o sa harap na gilid."],
  ), [
    L.labour(1, "linear_ft", 4, t7(
      ["Guard installation — per linear ft", "Gutters cleaned first, guards fitted and fastened along the run."],
      ["Pose de protège-gouttières — au pi lin.", "Gouttières nettoyées d'abord, protecteurs posés et fixés sur la longueur."],
      ["Instalación de protectores — por pie lineal", "Canaletas limpiadas primero, protectores colocados y fijados en todo el tramo."],
      ["Posa paraf fogliame — al piede lineare", "Grondaie pulite prima, protezioni montate e fissate lungo il tratto."],
      ["Laubschutz montieren — pro lfd. Fuß", "Rinnen zuerst gereinigt, Gitter eingesetzt und über die Strecke befestigt."],
      ["Монтаж сітки — за пог. фут", "Ринви спершу очищено, сітки встановлено й закріплено по всій довжині."],
      ["Pagkabit ng guard — kada linear ft", "Nilinis muna ang gutter, ikinabit at hinigpitan ang guard sa buong haba."],
    ), { measurementKey: "gutterFt" }),
    L.material(1, "linear_ft", 3.1, t7(
      ["Micro-mesh gutter guard — per linear ft", "Stainless micro-mesh guard on an aluminium frame."],
      ["Protège-gouttière à micromaille — au pi lin.", "Protecteur à micromaille inox sur cadre d'aluminium."],
      ["Protector de micromalla — por pie lineal", "Protector de micromalla inoxidable sobre marco de aluminio."],
      ["Paraf fogliame a micro-rete — al piede lineare", "Protezione in micro-rete inox su telaio in alluminio."],
      ["Mikro-Mesh-Laubschutz — pro lfd. Fuß", "Edelstahl-Mikrogitter auf Aluminiumrahmen."],
      ["Мікросітка для ринв — за пог. фут", "Мікросітка з нержавійки на алюмінієвій рамі."],
      ["Micro-mesh na gutter guard — kada linear ft", "Stainless micro-mesh na guard sa aluminum frame."],
    ), { cost: 2.49, measurementKey: "gutterFt" }),
  ], D.bundle("percent", 10)),

  "fq.gutter_services.install.downspouts": T("installation", n(
    ["Pluviali — installazione", "Pluviali montati alle uscite, fissati al muro e deviati lontano dalle fondazioni."],
    ["Fallrohre — Montage", "Fallrohre an den Stutzen montiert, an der Wand befestigt und vom Fundament weggeführt."],
    ["Водостічні труби — монтаж", "Труби встановлено до воронок, закріплено до стіни й відведено від фундаменту."],
    ["Downspouts — pagkabit", "Ikinabit sa outlet, sinigurado sa pader at inilayo sa pundasyon ang downspout."],
  ), [DOWNSPOUT(), L.material(1, "each", 30, t7(
    ["Splash block or extension", "Concrete splash block or a 4 ft downspout extension."],
    ["Bloc parapluie ou rallonge", "Bloc parapluie en béton ou rallonge de descente de 4 pi."],
    ["Bloque de salpique o extensión", "Bloque de concreto o extensión de bajante de 4 pies."],
    ["Paraspruzzi o prolunga", "Paraspruzzi in calcestruzzo o prolunga del pluviale da 4 piedi."],
    ["Spritzschutz oder Verlängerung", "Betonspritzschutz oder 4-Fuß-Fallrohrverlängerung."],
    ["Відбійник або подовжувач", "Бетонний відбійник або подовжувач труби 4 фути."],
    ["Splash block o extension", "Concrete splash block o 4 ft na extension ng downspout."],
  ), { measurementKey: "downspouts" })], null),

  "fq.gutter_services.repair.seamless": T("repair", n(
    ["Grondaie senza giunture — riparazione", "Perdite, cedimenti e tratti allentati riparati, riappesi e risigillati nel punto del guasto."],
    ["Nahtlose Dachrinnen — Reparatur", "Lecks, Durchhang und lose Stücke an der Schadstelle repariert, neu aufgehängt und abgedichtet."],
    ["Безшовні ринви — ремонт", "Протікання, провисання й слабкі ділянки відремонтовано, перевішано й загерметизовано в місці дефекту."],
    ["Seamless gutters — pag-ayos", "Inayos, isinabit ulit at sinelyuhan ang tagas, lubog at maluwag na bahagi sa may sira."],
  ), [SHARED.serviceCall(95), L.labour(1, "each", 12, t7(
    ["Hanger replacement — per hanger", "Loose spikes or hangers replaced with screw-in hidden hangers."],
    ["Remplacement de crochet — l'unité", "Clous ou crochets lâches remplacés par des crochets dissimulés vissés."],
    ["Reemplazo de gancho — por gancho", "Clavos o ganchos flojos cambiados por ganchos ocultos atornillados."],
    ["Sostituzione staffa — cadauna", "Chiodi o staffe allentati sostituiti con staffe nascoste avvitate."],
    ["Halter ersetzen — pro Stück", "Lose Nägel oder Halter durch verschraubte verdeckte Halter ersetzt."],
    ["Заміна гака — за гак", "Слабкі костилі чи гаки замінено прихованими гаками на шурупах."],
    ["Palit ng hanger — kada isa", "Pinalitan ng screw-in hidden hanger ang maluwag na pako o hanger."],
  ), { measurementKey: "each" }), L.labour(1, "flat", 65, t7(
    ["Seam and corner resealing", "Leaking seams, corners and end caps cleaned and resealed."],
    ["Rescellement des joints et coins", "Joints, coins et embouts qui fuient nettoyés et rescellés."],
    ["Resellado de uniones y esquinas", "Uniones, esquinas y tapas con fuga limpiadas y reselladas."],
    ["Risigillatura giunti e angoli", "Giunti, angoli e testate che perdono puliti e risigillati."],
    ["Nähte und Ecken neu abdichten", "Undichte Nähte, Ecken und Endkappen gereinigt und neu abgedichtet."],
    ["Повторна герметизація швів і кутів", "Протікаючі шви, кути й заглушки очищено й загерметизовано."],
    ["Pagselyo ulit ng dugtungan at kanto", "Nilinis at sinelyuhan ulit ang tumutulong dugtungan, kanto at end cap."],
  ))], null),

  "fq.gutter_services.visits.inspection": T("inspection", n(
    ["Ispezione grondaie e drenaggio", "Ogni tratto, scarico e pluviale controllato e percorso dell'acqua seguito, con foto e preventivo scritto."],
    ["Inspektion von Rinnen und Entwässerung", "Jede Strecke, jeder Stutzen und jedes Fallrohr geprüft und der Wasserweg verfolgt, mit Fotos und schriftlichem Angebot."],
    ["Огляд ринв і дренажу", "Кожну ділянку, воронку й трубу перевірено, шлях води простежено, з фото й письмовою оцінкою."],
    ["Inspeksyon ng gutter at drainage", "Chineck ang bawat bahagi, outlet at downspout at sinundan ang daloy ng tubig, may litrato at quote."],
  ), [L.labour(1, "flat", 95, t7(
    ["Gutter and drainage inspection", "Runs, hangers, outlets and grading checked from the ladder and the ground."],
    ["Inspection des gouttières et du drainage", "Sections, crochets, sorties et pente du terrain vérifiés à l'échelle et au sol."],
    ["Inspección de canaletas y drenaje", "Tramos, ganchos, salidas y pendiente del terreno revisados desde la escalera y el suelo."],
    ["Ispezione grondaie e drenaggio", "Tratti, staffe, scarichi e pendenze controllati dalla scala e da terra."],
    ["Rinnen- und Entwässerungsinspektion", "Strecken, Halter, Stutzen und Gefälle von Leiter und Boden aus geprüft."],
    ["Огляд ринв і дренажу", "Ділянки, гаки, воронки й ухил ґрунту перевірено з драбини й землі."],
    ["Inspeksyon ng gutter at drainage", "Chineck mula sa hagdan at lupa ang bahagi, hanger, outlet at slope ng lupa."],
  )), SHARED.report(35)], null),

  "fq.gutter_services.maintenance.guards": T("maintenance", n(
    ["Paraf fogliame — manutenzione", "Paraf fogliame controllati, puliti e rifissati dove serve perché la grondaia continui a scaricare."],
    ["Laubschutz — Wartung", "Laubschutz geprüft, gereinigt und wo nötig neu befestigt, damit die Rinne weiter abläuft."],
    ["Сітки для ринв — обслуговування", "Сітки перевірено, очищено й закріплено, де треба, щоб ринва й далі відводила воду."],
    ["Gutter guards — maintenance", "Chineck, nilinis at ikinabit ulit kung kailangan ang guard para dumaloy pa rin ang gutter."],
  ), [L.labour(1, "linear_ft", 1, t7(
    ["Guard brushing and flush — per linear ft", "Debris brushed off the guards and the gutter below flushed."],
    ["Brossage et rinçage — au pi lin.", "Débris brossés des protecteurs et gouttière rincée dessous."],
    ["Cepillado y enjuague — por pie lineal", "Residuos cepillados de los protectores y la canaleta enjuagada."],
    ["Spazzolatura e lavaggio — al piede lineare", "Detriti spazzolati via dalle protezioni e grondaia sottostante sciacquata."],
    ["Abbürsten und Spülen — pro lfd. Fuß", "Ablagerungen vom Gitter gebürstet und die Rinne darunter gespült."],
    ["Чищення й промивання — за пог. фут", "Сміття зметено з сіток, ринву під ними промито."],
    ["Pag-brush at flush — kada linear ft", "Binrush ang dumi sa guard at ni-flush ang gutter sa ilalim."],
  ), { measurementKey: "gutterFt" }), SHARED.serviceCall(75)], D.seasonal("fixed", 20)),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);
