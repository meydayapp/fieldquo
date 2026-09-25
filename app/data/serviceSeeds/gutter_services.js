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

// ── Templates for the rest of the grid (2026-09-25) ──────────────────────────
//
// The quote builder adds a service WITH its template lines, so the gutter
// rows without one landed as a bare line. Rates are the ones above, by
// material: sectional aluminium $8–10 a foot installed, half-round $14,
// copper $30–35, a rebuilt and lined box gutter $40; a clean-out $1.50–2.50 a
// foot; a French drain $30–35 a foot.
//
// Measurement keys. Installing and maintaining the gutters covers the whole
// run, so those lines read the gutter measurement (`gutterFt`, `downspouts`).
// A REPAIR is to a section: its per-foot lines read the typed run
// (`linearFt`) and its per-downspout lines the typed count (`each`) — the
// whole-house figures would bill the entire system for one bad seam. A French
// drain is its own trench, measured on its own, so it reads `linearFt` too.
//
// Left without a template on purpose: the three "describe what you need"
// catch-alls (install.other, maintenance.other, repair.other) and the
// replacement estimate visit, which is free — its only line would be $0.
//
// Quote type without a seed file that sells these rows (NEAREST_TRADES in
// lib/services/confirmServices.js): property_maintenance gets the routine
// clean-outs of the common gutters (sectional, seamless, K-style) and
// downspouts — not box, copper or half-round work, which is a gutter
// specialist's.

// Word for word the seamless template's gutter line and the seamless repair's
// reseal line above, so the Punjabi in the language file serves both.
const ALUM_GUTTER = () => hdMaterial(HD.gutter_5k_10, t7(
  ["Aluminium gutter — per 10 ft length", "5 in K-style aluminium gutter with hangers, end caps and outlets."],
  ["Gouttière d'aluminium — la longueur de 10 pi", "Gouttière en aluminium style K de 5 po avec crochets, embouts et sorties."],
  ["Canaleta de aluminio — por tramo de 10 pies", "Canaleta de aluminio estilo K de 5 pulg con ganchos, tapas y salidas."],
  ["Grondaia in alluminio — per barra da 10 piedi", "Grondaia in alluminio stile K da 5 pollici con staffe, testate e bocchettoni."],
  ["Aluminiumrinne — pro 10-Fuß-Länge", "5-Zoll-K-Profil-Rinne aus Aluminium mit Haltern, Endkappen und Stutzen."],
  ["Алюмінієва ринва — за 10-футову довжину", "Ринва K-профілю 5 дюймів з алюмінію з гаками, заглушками й воронками."],
  ["Aluminum gutter — kada 10 ft na haba", "5 in K-style na aluminum gutter na may hanger, end cap at outlet."],
), { measurementKey: "gutterFt" });
const RESEAL = (price = 65) => L.labour(1, "flat", price, t7(
  ["Seam and corner resealing", "Leaking seams, corners and end caps cleaned and resealed."],
  ["Rescellement des joints et coins", "Joints, coins et embouts qui fuient nettoyés et rescellés."],
  ["Resellado de uniones y esquinas", "Uniones, esquinas y tapas con fuga limpiadas y reselladas."],
  ["Risigillatura giunti e angoli", "Giunti, angoli e testate che perdono puliti e risigillati."],
  ["Nähte und Ecken neu abdichten", "Undichte Nähte, Ecken und Endkappen gereinigt und neu abgedichtet."],
  ["Повторна герметизація швів і кутів", "Протікаючі шви, кути й заглушки очищено й загерметизовано."],
  ["Pagselyo ulit ng dugtungan at kanto", "Nilinis at sinelyuhan ulit ang tumutulong dugtungan, kanto at end cap."],
));
const MICRO_MESH = () => L.material(1, "linear_ft", 3.1, t7(
  ["Micro-mesh gutter guard — per linear ft", "Stainless micro-mesh guard on an aluminium frame."],
  ["Protège-gouttière à micromaille — au pi lin.", "Protecteur à micromaille inox sur cadre d'aluminium."],
  ["Protector de micromalla — por pie lineal", "Protector de micromalla inoxidable sobre marco de aluminio."],
  ["Paraf fogliame a micro-rete — al piede lineare", "Protezione in micro-rete inox su telaio in alluminio."],
  ["Mikro-Mesh-Laubschutz — pro lfd. Fuß", "Edelstahl-Mikrogitter auf Aluminiumrahmen."],
  ["Мікросітка для ринв — за пог. фут", "Мікросітка з нержавійки на алюмінієвій рамі."],
  ["Micro-mesh na gutter guard — kada linear ft", "Stainless micro-mesh na guard sa aluminum frame."],
), { cost: 2.49, measurementKey: "linearFt" });

const G = {
  joints: (price) => L.material(1, "linear_ft", price, t7(
    ["Joint connectors and sealant — per linear ft", "Slip connectors, rivets and gutter sealant for the seams of a sectional run."],
    ["Raccords de joint et scellant — au pi lin.", "Raccords coulissants, rivets et scellant à gouttière pour les joints d'une gouttière à sections."],
    ["Conectores de unión y sellador — por pie lineal", "Conectores deslizantes, remaches y sellador de canaleta para las uniones de un tramo seccional."],
    ["Giunti e sigillante — al piede lineare", "Giunti a scorrimento, rivetti e sigillante per le giunture di una grondaia a sezioni."],
    ["Rinnenverbinder und Dichtstoff — pro lfd. Fuß", "Rinnenverbinder, Nieten und Rinnendichtstoff für die Stöße einer Rinne aus Einzelstücken."],
    ["З'єднувачі та герметик — за пог. фут", "З'єднувачі, заклепки та герметик для стиків секційної ринви."],
    ["Joint connector at sealant — kada linear ft", "Slip connector, rivet at gutter sealant para sa dugtungan ng sectional na gutter."],
  ), { measurementKey: "gutterFt" }),
  halfLab: (price) => L.labour(1, "linear_ft", price, t7(
    ["Half-round gutter installation — per linear ft", "Half-round gutter hung on exposed or hidden brackets, pitched to the outlets and sealed."],
    ["Pose de gouttière demi-ronde — au pi lin.", "Gouttière demi-ronde posée sur supports apparents ou dissimulés, en pente vers les sorties et scellée."],
    ["Instalación de canaleta de media caña — por pie lineal", "Canaleta de media caña colgada en soportes visibles u ocultos, con pendiente a las salidas y sellada."],
    ["Posa grondaia semitonda — al piede lineare", "Grondaia semitonda appesa su staffe a vista o nascoste, in pendenza verso gli scarichi e sigillata."],
    ["Halbrundrinne montieren — pro lfd. Fuß", "Halbrundrinne an sichtbaren oder verdeckten Haltern montiert, mit Gefälle zu den Stutzen und abgedichtet."],
    ["Монтаж напівкруглої ринви — за пог. фут", "Напівкруглу ринву навішено на відкриті чи приховані кронштейни з ухилом до воронок і загерметизовано."],
    ["Pagkabit ng half-round gutter — kada linear ft", "Isinabit ang half-round gutter sa nakikita o nakatagong bracket, may slope sa outlet at sinelyuhan."],
  ), { measurementKey: "gutterFt" }),
  halfGutter: (price) => L.material(1, "linear_ft", price, t7(
    ["Aluminium half-round gutter — per linear ft", "6 in half-round aluminium gutter with brackets, end caps and outlets."],
    ["Gouttière demi-ronde d'aluminium — au pi lin.", "Gouttière demi-ronde en aluminium de 6 po avec supports, embouts et sorties."],
    ["Canaleta de media caña de aluminio — por pie lineal", "Canaleta de media caña de aluminio de 6 pulg con soportes, tapas y salidas."],
    ["Grondaia semitonda in alluminio — al piede lineare", "Grondaia semitonda in alluminio da 6 pollici con staffe, testate e bocchettoni."],
    ["Aluminium-Halbrundrinne — pro lfd. Fuß", "6-Zoll-Halbrundrinne aus Aluminium mit Haltern, Endkappen und Stutzen."],
    ["Алюмінієва напівкругла ринва — за пог. фут", "Напівкругла алюмінієва ринва 6 дюймів із кронштейнами, заглушками й воронками."],
    ["Aluminum half-round gutter — kada linear ft", "6 in na half-round aluminum gutter na may bracket, end cap at outlet."],
  ), { measurementKey: "gutterFt" }),
  boxLab: (price) => L.labour(1, "linear_ft", price, t7(
    ["Box gutter rebuild and lining — per linear ft", "The built-in trough rebuilt where rotted, re-pitched and lined, and the lining turned up under the roofing."],
    ["Réfection et doublage de gouttière en caisson — au pi lin.", "Caisson intégré refait là où il est pourri, remis en pente et doublé, le revêtement remonté sous la toiture."],
    ["Reconstrucción y forrado de canaleta de caja — por pie lineal", "Canal integrado rehecho donde está podrido, con nueva pendiente y forrado, y el forro subido bajo el techo."],
    ["Rifacimento e rivestimento grondaia a cassetta — al piede lineare", "Canale incassato rifatto dove marcio, ripristinata la pendenza e rivestito, con il rivestimento risvoltato sotto il manto."],
    ["Kastenrinne erneuern und auskleiden — pro lfd. Fuß", "Eingebaute Rinne wo morsch erneuert, neu ins Gefälle gelegt und ausgekleidet, die Auskleidung unter die Deckung geführt."],
    ["Відновлення та облицювання коробчастої ринви — за пог. фут", "Вбудований жолоб відновлено там, де він згнив, виставлено ухил і облицьовано з заведенням під покрівлю."],
    ["Pag-rebuild at lining ng box gutter — kada linear ft", "Inayos ang built-in na kanal kung saan bulok, inayos ang slope at nilagyan ng lining na nakapasok sa ilalim ng bubong."],
  ), { measurementKey: "gutterFt" }),
  boxLiner: (price) => L.material(1, "linear_ft", price, t7(
    ["Box gutter liner — per linear ft", "EPDM or pre-finished metal liner, with outlet sleeves and sealant."],
    ["Doublure de gouttière en caisson — au pi lin.", "Doublure en EPDM ou en métal prépeint, avec manchons de sortie et scellant."],
    ["Forro de canaleta de caja — por pie lineal", "Forro de EPDM o lámina prepintada, con mangas de salida y sellador."],
    ["Rivestimento grondaia a cassetta — al piede lineare", "Rivestimento in EPDM o lamiera preverniciata, con manicotti di scarico e sigillante."],
    ["Kastenrinnen-Auskleidung — pro lfd. Fuß", "EPDM- oder vorbeschichtete Blechauskleidung mit Ablaufstutzen und Dichtstoff."],
    ["Облицювання коробчастої ринви — за пог. фут", "Облицювання з EPDM чи фарбованого металу з гільзами воронок і герметиком."],
    ["Box gutter liner — kada linear ft", "EPDM o pre-finished na metal liner, may outlet sleeve at sealant."],
  ), { measurementKey: "gutterFt" }),
  copperLab: (price) => L.labour(1, "linear_ft", price, t7(
    ["Copper gutter installation — per linear ft", "Copper gutter hung on copper brackets, seams soldered and pitched to the outlets."],
    ["Pose de gouttière en cuivre — au pi lin.", "Gouttière en cuivre posée sur supports en cuivre, joints soudés et pente vers les sorties."],
    ["Instalación de canaleta de cobre — por pie lineal", "Canaleta de cobre colgada en soportes de cobre, uniones soldadas y pendiente a las salidas."],
    ["Posa grondaia in rame — al piede lineare", "Grondaia in rame appesa su staffe in rame, giunti saldati e in pendenza verso gli scarichi."],
    ["Kupferrinne montieren — pro lfd. Fuß", "Kupferrinne an Kupferhaltern montiert, Nähte gelötet und mit Gefälle zu den Stutzen."],
    ["Монтаж мідної ринви — за пог. фут", "Мідну ринву навішено на мідні кронштейни, шви пропаяно, ухил до воронок."],
    ["Pagkabit ng copper gutter — kada linear ft", "Isinabit ang copper gutter sa copper bracket, sinolder ang dugtungan at may slope sa outlet."],
  ), { measurementKey: "gutterFt" }),
  copperGutter: (price) => L.material(1, "linear_ft", price, t7(
    ["Copper gutter — per linear ft", "16 oz copper gutter in half-round or K-style, with brackets, end caps and outlets."],
    ["Gouttière en cuivre — au pi lin.", "Gouttière en cuivre de 16 oz, demi-ronde ou style K, avec supports, embouts et sorties."],
    ["Canaleta de cobre — por pie lineal", "Canaleta de cobre de 16 oz, media caña o estilo K, con soportes, tapas y salidas."],
    ["Grondaia in rame — al piede lineare", "Grondaia in rame da 16 once, semitonda o stile K, con staffe, testate e bocchettoni."],
    ["Kupferrinne — pro lfd. Fuß", "16-oz-Kupferrinne halbrund oder im K-Profil, mit Haltern, Endkappen und Stutzen."],
    ["Мідна ринва — за пог. фут", "Мідна ринва 16 унцій, напівкругла чи K-профілю, з кронштейнами, заглушками й воронками."],
    ["Copper gutter — kada linear ft", "16 oz na copper gutter, half-round o K-style, may bracket, end cap at outlet."],
  ), { measurementKey: "gutterFt" }),
  copperDownspout: (price) => L.labour(1, "each", price, t7(
    ["Copper downspout — per downspout", "Copper outlet, elbows and a 10 ft round or rectangular downspout fitted and strapped."],
    ["Descente en cuivre — l'unité", "Sortie, coudes et descente de 10 pi ronde ou rectangulaire en cuivre posés et fixés."],
    ["Bajante de cobre — por bajante", "Salida, codos y bajante de cobre de 10 pies, redonda o rectangular, colocados y fijados."],
    ["Pluviale in rame — cadauno", "Bocchettone, gomiti e pluviale in rame da 10 piedi, tondo o rettangolare, montati e fissati."],
    ["Kupferfallrohr — pro Stück", "Kupferstutzen, Bögen und ein 10-Fuß-Fallrohr rund oder eckig montiert und befestigt."],
    ["Мідна водостічна труба — за трубу", "Мідну воронку, коліна та трубу 10 футів, круглу чи прямокутну, встановлено й закріплено."],
    ["Copper downspout — kada isa", "Copper outlet, elbow at 10 ft na bilog o parihabang downspout na ikinabit at sinigurado."],
  ), { measurementKey: "downspouts" }),
  drainLab: (price) => L.labour(1, "linear_ft", price, t7(
    ["French drain trenching and installation — per linear ft", "The trench dug to fall, lined with fabric, pipe laid in drain rock and the trench closed."],
    ["Tranchée et pose de drain français — au pi lin.", "Tranchée creusée en pente, tapissée de géotextile, drain posé dans la pierre nette et tranchée refermée."],
    ["Zanja e instalación de dren francés — por pie lineal", "Zanja cavada con pendiente, forrada con geotextil, tubo tendido en grava y zanja cerrada."],
    ["Scavo e posa drenaggio — al piede lineare", "Scavo eseguito in pendenza, rivestito di geotessile, tubo posato nel ghiaietto e scavo richiuso."],
    ["Sickerdrainage graben und verlegen — pro lfd. Fuß", "Graben mit Gefälle ausgehoben, mit Vlies ausgelegt, Rohr im Drainkies verlegt und geschlossen."],
    ["Траншея та монтаж дренажу — за пог. фут", "Траншею викопано з ухилом, вистелено геотекстилем, трубу покладено в щебінь і засипано."],
    ["Paghukay at pagkabit ng French drain — kada linear ft", "Hinukay nang may slope, nilagyan ng fabric, inilatag ang tubo sa drain rock at tinabunan."],
  ), { measurementKey: "linearFt" }),
  drainRock: (price) => L.material(1, "linear_ft", price, t7(
    ["Drain rock — per linear ft", "Washed 3/4 in clear stone delivered in bulk, about a cubic foot per foot of trench."],
    ["Pierre de drainage — au pi lin.", "Pierre nette lavée de 3/4 po livrée en vrac, environ un pied cube par pied de tranchée."],
    ["Grava de drenaje — por pie lineal", "Grava lavada de 3/4 pulg a granel, cerca de un pie cúbico por pie de zanja."],
    ["Ghiaietto drenante — al piede lineare", "Ghiaietto lavato da 3/4 di pollice sfuso, circa un piede cubo per piede di scavo."],
    ["Drainkies — pro lfd. Fuß", "Gewaschener 3/4-Zoll-Kies als Schüttgut, etwa ein Kubikfuß pro Fuß Graben."],
    ["Дренажний щебінь — за пог. фут", "Митий щебінь 3/4 дюйма насипом, близько кубічного фута на фут траншеї."],
    ["Drain rock — kada linear ft", "Hinugasang 3/4 in na clear stone na bulk, mga isang cubic foot kada foot ng kanal."],
  ), { measurementKey: "linearFt" }),
  drainPipe: (price) => L.material(1, "linear_ft", price, t7(
    ["Perforated drain pipe and fabric — per linear ft", "4 in perforated pipe, filter fabric and the fittings to the outlet."],
    ["Drain perforé et géotextile — au pi lin.", "Tuyau perforé de 4 po, géotextile filtrant et raccords jusqu'à la sortie."],
    ["Tubo perforado y geotextil — por pie lineal", "Tubo perforado de 4 pulg, geotextil filtrante y conexiones hasta la salida."],
    ["Tubo drenante e geotessile — al piede lineare", "Tubo fessurato da 4 pollici, geotessile filtrante e raccordi fino allo scarico."],
    ["Drainagerohr und Vlies — pro lfd. Fuß", "4-Zoll-Drainagerohr, Filtervlies und Formteile bis zum Auslass."],
    ["Перфорована труба та геотекстиль — за пог. фут", "Перфорована труба 4 дюйми, фільтрувальний геотекстиль і фітинги до випуску."],
    ["Perforated drain pipe at fabric — kada linear ft", "4 in na perforated pipe, filter fabric at fitting hanggang outlet."],
  ), { measurementKey: "linearFt" }),
  downspoutTie: (price) => L.labour(1, "flat", price, t7(
    ["Downspout connection and pop-up outlet", "The downspout tied into the drain and a pop-up emitter set where the water comes out."],
    ["Raccord de descente et sortie escamotable", "Descente raccordée au drain et bouche escamotable posée à la sortie de l'eau."],
    ["Conexión de bajante y salida emergente", "Bajante unida al dren y una salida emergente colocada donde sale el agua."],
    ["Collegamento pluviale e bocchetta a scomparsa", "Pluviale collegato al drenaggio e bocchetta a scomparsa posata dove esce l'acqua."],
    ["Fallrohranschluss und Auslasstopf", "Fallrohr an die Drainage angeschlossen und ein Pop-up-Auslass am Wasseraustritt gesetzt."],
    ["Підключення труби та випуск", "Водостічну трубу під'єднано до дренажу, на виході встановлено відкидний випуск."],
    ["Koneksyon ng downspout at pop-up outlet", "Ikinonekta ang downspout sa drain at inilagay ang pop-up emitter kung saan lumalabas ang tubig."],
  )),
  maintLab: (price) => L.labour(1, "linear_ft", price, t7(
    ["Gutter clean-out and tune-up — per linear ft", "Gutters scooped and flushed, loose hangers re-secured and small leaks resealed."],
    ["Nettoyage et mise au point des gouttières — au pi lin.", "Gouttières vidées et rincées, crochets lâches refixés et petites fuites rescellées."],
    ["Limpieza y ajuste de canaletas — por pie lineal", "Canaletas vaciadas y enjuagadas, ganchos flojos refijados y pequeñas fugas reselladas."],
    ["Pulizia e messa a punto grondaie — al piede lineare", "Grondaie svuotate e sciacquate, staffe allentate rifissate e piccole perdite risigillate."],
    ["Rinnenreinigung und Wartung — pro lfd. Fuß", "Rinnen ausgeräumt und gespült, lose Halter nachbefestigt und kleine Lecks abgedichtet."],
    ["Чищення та налаштування ринв — за пог. фут", "Ринви вичищено й промито, слабкі гаки закріплено, дрібні протікання загерметизовано."],
    ["Linis at tune-up ng gutter — kada linear ft", "Kinuha ang dumi at binuhusan ang gutter, hinigpitan ang maluwag na hanger at sinelyuhan ang maliit na tagas."],
  ), { measurementKey: "gutterFt" }),
  boxMaint: (price) => L.labour(1, "linear_ft", price, t7(
    ["Box gutter clean-out and liner check — per linear ft", "The trough cleared by hand, the liner and its seams inspected and the outlets flushed."],
    ["Nettoyage de gouttière en caisson et vérification de la doublure — au pi lin.", "Caisson vidé à la main, doublure et joints inspectés et sorties rincées."],
    ["Limpieza de canaleta de caja y revisión del forro — por pie lineal", "Canal limpiado a mano, forro y uniones inspeccionados y salidas enjuagadas."],
    ["Pulizia grondaia a cassetta e controllo rivestimento — al piede lineare", "Canale pulito a mano, rivestimento e giunti ispezionati e scarichi sciacquati."],
    ["Kastenrinne reinigen und Auskleidung prüfen — pro lfd. Fuß", "Rinne von Hand geräumt, Auskleidung und Nähte geprüft und Stutzen gespült."],
    ["Чищення коробчастої ринви та огляд облицювання — за пог. фут", "Жолоб очищено вручну, облицювання та шви оглянуто, воронки промито."],
    ["Linis ng box gutter at check ng liner — kada linear ft", "Nilinis nang mano-mano ang kanal, sinuri ang liner at dugtungan at binuhusan ang outlet."],
  ), { measurementKey: "gutterFt" }),
  copperTouchUp: (price) => L.labour(1, "flat", price, t7(
    ["Copper seam touch-up", "Seams and outlets checked, and any pinhole or open joint cleaned, fluxed and soldered."],
    ["Retouche des joints en cuivre", "Joints et sorties vérifiés, trous d'épingle ou joints ouverts nettoyés, décapés et soudés."],
    ["Retoque de uniones de cobre", "Uniones y salidas revisadas, y cada poro o junta abierta limpiada, con fundente y soldada."],
    ["Ritocco dei giunti in rame", "Giunti e bocchettoni controllati, fori o giunti aperti puliti, flussati e saldati."],
    ["Kupfernähte nachlöten", "Nähte und Stutzen geprüft, Nadellöcher oder offene Stöße gereinigt, geflusst und gelötet."],
    ["Підпаювання мідних швів", "Шви й воронки перевірено, мікроотвори чи розійшлі стики очищено, оброблено флюсом і пропаяно."],
    ["Touch-up ng copper seam", "Chineck ang seam at outlet, at nilinis, nilagyan ng flux at sinolder ang butas o bukas na dugtungan."],
  )),
  dsFlush: (price) => L.labour(1, "each", price, t7(
    ["Downspout flush — per downspout", "Each downspout flushed from the top and cleared at the elbows until it runs free."],
    ["Rinçage de descente — l'unité", "Chaque descente rincée par le haut et dégagée aux coudes jusqu'à écoulement libre."],
    ["Enjuague de bajante — por bajante", "Cada bajante enjuagada desde arriba y destapada en los codos hasta que corra libre."],
    ["Lavaggio pluviale — cadauno", "Ogni pluviale sciacquato dall'alto e liberato ai gomiti finché scorre libero."],
    ["Fallrohr spülen — pro Stück", "Jedes Fallrohr von oben gespült und an den Bögen freigemacht, bis es frei läuft."],
    ["Промивання труби — за трубу", "Кожну трубу промито згори й прочищено на колінах до вільного стоку."],
    ["Flush ng downspout — kada isa", "Binuhusan mula sa taas ang bawat downspout at nilinis ang elbow hanggang lumusot."],
  ), { measurementKey: "downspouts" }),
  dsMaint: (price) => L.labour(1, "each", price, t7(
    ["Downspout clearing and re-securing — per downspout", "The downspout cleared top to bottom, loose straps re-fastened and the elbows resealed."],
    ["Dégagement et refixation de descente — l'unité", "Descente dégagée de haut en bas, attaches lâches refixées et coudes rescellés."],
    ["Destape y refijado de bajante — por bajante", "Bajante destapada de arriba abajo, abrazaderas flojas refijadas y codos resellados."],
    ["Pulizia e rifissaggio pluviale — cadauno", "Pluviale liberato da cima a fondo, fascette allentate rifissate e gomiti risigillati."],
    ["Fallrohr freimachen und nachbefestigen — pro Stück", "Fallrohr von oben bis unten frei gemacht, lose Schellen nachbefestigt und Bögen neu abgedichtet."],
    ["Прочищення та закріплення труби — за трубу", "Трубу прочищено згори донизу, слабкі хомути закріплено, коліна загерметизовано."],
    ["Linis at higpit ng downspout — kada isa", "Nilinis mula taas hanggang baba ang downspout, hinigpitan ang maluwag na strap at sinelyuhan ang elbow."],
  ), { measurementKey: "downspouts" }),
  dsStraps: (price) => L.material(1, "each", price, t7(
    ["Downspout straps and screws — per downspout", "Two straps, screws and sealant for each downspout."],
    ["Attaches et vis de descente — l'unité", "Deux attaches, vis et scellant pour chaque descente."],
    ["Abrazaderas y tornillos de bajante — por bajante", "Dos abrazaderas, tornillos y sellador por cada bajante."],
    ["Fascette e viti per pluviale — cadauno", "Due fascette, viti e sigillante per ogni pluviale."],
    ["Fallrohrschellen und Schrauben — pro Stück", "Zwei Schellen, Schrauben und Dichtstoff pro Fallrohr."],
    ["Хомути та шурупи для труби — за трубу", "Два хомути, шурупи й герметик на кожну трубу."],
    ["Strap at turnilyo ng downspout — kada isa", "Dalawang strap, turnilyo at sealant bawat downspout."],
  ), { measurementKey: "downspouts" }),
  paintLab: (price) => L.labour(1, "linear_ft", price, t7(
    ["Gutter and downspout painting — per linear ft", "Gutters washed and deglossed, bare spots primed and two coats brushed on to match the trim."],
    ["Peinture des gouttières et descentes — au pi lin.", "Gouttières lavées et dépolies, zones nues apprêtées et deux couches appliquées assorties aux moulures."],
    ["Pintura de canaletas y bajantes — por pie lineal", "Canaletas lavadas y desengrasadas, zonas desnudas imprimadas y dos manos aplicadas a juego con las molduras."],
    ["Verniciatura grondaie e pluviali — al piede lineare", "Grondaie lavate e irruvidite, parti nude trattate con primer e due mani stese abbinate ai profili."],
    ["Rinnen und Fallrohre streichen — pro lfd. Fuß", "Rinnen gewaschen und angeschliffen, blanke Stellen grundiert und zweimal passend zur Verkleidung gestrichen."],
    ["Фарбування ринв і труб — за пог. фут", "Ринви вимито й знежирено, оголені місця заґрунтовано, нанесено два шари в тон оздоблення."],
    ["Pagpintura ng gutter at downspout — kada linear ft", "Hinugasan at dineglos ang gutter, prinimer ang lantad na bahagi at dalawang patong na katerno ng trim."],
  ), { measurementKey: "gutterFt" }),
  paintMat: (price) => L.material(1, "linear_ft", price, t7(
    ["Bonding primer and exterior paint — per linear ft", "Metal bonding primer and exterior acrylic paint for the run."],
    ["Apprêt d'adhérence et peinture extérieure — au pi lin.", "Apprêt d'adhérence pour métal et peinture acrylique extérieure pour la longueur."],
    ["Primario de adherencia y pintura exterior — por pie lineal", "Primario de adherencia para metal y pintura acrílica exterior para el tramo."],
    ["Primer aggrappante e pittura per esterni — al piede lineare", "Primer aggrappante per metallo e pittura acrilica per esterni per il tratto."],
    ["Haftgrund und Außenfarbe — pro lfd. Fuß", "Metall-Haftgrund und Acryl-Außenfarbe für die Strecke."],
    ["Адгезійний ґрунт і фасадна фарба — за пог. фут", "Адгезійний ґрунт для металу та акрилова фасадна фарба на довжину."],
    ["Bonding primer at exterior paint — kada linear ft", "Metal bonding primer at exterior acrylic paint para sa haba."],
  ), { measurementKey: "gutterFt" }),
  sectionRepair: (price) => L.labour(1, "linear_ft", price, t7(
    ["Gutter section repair — per linear ft", "The damaged run cut out or re-hung, new stock spliced in, sealed and pitched to the outlet."],
    ["Réparation de section de gouttière — au pi lin.", "Section abîmée coupée ou refixée, nouvelle pièce raccordée, scellée et remise en pente vers la sortie."],
    ["Reparación de tramo de canaleta — por pie lineal", "Tramo dañado cortado o recolgado, pieza nueva empalmada, sellada y con pendiente a la salida."],
    ["Riparazione tratto di grondaia — al piede lineare", "Tratto danneggiato tagliato o riappeso, nuovo pezzo giuntato, sigillato e in pendenza verso lo scarico."],
    ["Rinnenstück reparieren — pro lfd. Fuß", "Beschädigtes Stück herausgeschnitten oder neu aufgehängt, neues Material eingesetzt, abgedichtet und ins Gefälle gelegt."],
    ["Ремонт ділянки ринви — за пог. фут", "Пошкоджену ділянку вирізано чи перевішано, нову вставку з'єднано, загерметизовано й виставлено ухил."],
    ["Pag-ayos ng bahagi ng gutter — kada linear ft", "Pinutol o isinabit ulit ang sirang bahagi, dinugtungan ng bago, sinelyuhan at inayos ang slope sa outlet."],
  ), { measurementKey: "linearFt" }),
  sectionStock: (price) => L.material(1, "linear_ft", price, t7(
    ["Replacement gutter stock — per linear ft", "Gutter of the same profile, material and colour, with hangers and end caps where needed."],
    ["Gouttière de remplacement — au pi lin.", "Gouttière de même profil, matériau et couleur, avec crochets et embouts au besoin."],
    ["Canaleta de reposición — por pie lineal", "Canaleta del mismo perfil, material y color, con ganchos y tapas donde haga falta."],
    ["Grondaia di ricambio — al piede lineare", "Grondaia dello stesso profilo, materiale e colore, con staffe e testate dove servono."],
    ["Ersatzrinne — pro lfd. Fuß", "Rinne in gleichem Profil, Material und Farbe, mit Haltern und Endkappen wo nötig."],
    ["Ринва на заміну — за пог. фут", "Ринва того ж профілю, матеріалу й кольору, з гаками та заглушками, де треба."],
    ["Pamalit na gutter — kada linear ft", "Gutter na pareho ang profile, materyal at kulay, may hanger at end cap kung kailangan."],
  ), { measurementKey: "linearFt" }),
  copperSolder: (price) => L.labour(1, "flat", price, t7(
    ["Copper seam soldering", "Leaking copper seams cleaned, fluxed and re-soldered."],
    ["Soudure des joints en cuivre", "Joints en cuivre qui fuient nettoyés, décapés et ressoudés."],
    ["Soldadura de uniones de cobre", "Uniones de cobre con fuga limpiadas, con fundente y resoldadas."],
    ["Saldatura giunti in rame", "Giunti in rame che perdono puliti, flussati e risaldati."],
    ["Kupfernähte löten", "Undichte Kupfernähte gereinigt, geflusst und neu gelötet."],
    ["Пайка мідних швів", "Протікаючі мідні шви очищено, оброблено флюсом і перепаяно."],
    ["Pag-solder ng copper seam", "Nilinis, nilagyan ng flux at sinolder ulit ang tumutulong copper seam."],
  )),
  dsRepair: (price) => L.labour(1, "each", price, t7(
    ["Downspout repair — per downspout", "Crushed or split sections and elbows replaced, the joints riveted and the downspout re-strapped."],
    ["Réparation de descente — l'unité", "Sections et coudes écrasés ou fendus remplacés, joints rivetés et descente refixée."],
    ["Reparación de bajante — por bajante", "Tramos y codos aplastados o partidos reemplazados, uniones remachadas y bajante refijada."],
    ["Riparazione pluviale — cadauno", "Tratti e gomiti schiacciati o spaccati sostituiti, giunti rivettati e pluviale rifissato."],
    ["Fallrohrreparatur — pro Stück", "Gequetschte oder gerissene Stücke und Bögen ersetzt, Stöße vernietet und Fallrohr neu befestigt."],
    ["Ремонт водостічної труби — за трубу", "Зім'яті чи тріснуті ділянки й коліна замінено, стики заклепано, трубу закріплено."],
    ["Pag-ayos ng downspout — kada isa", "Pinalitan ang yupi o biyak na bahagi at elbow, rinivet ang dugtungan at sinigurado ulit ang downspout."],
  ), { measurementKey: "each" }),
  dsParts: (price) => L.material(1, "each", price, t7(
    ["Downspout elbows and straps — per downspout", "Elbows, a replacement section where needed, straps and rivets."],
    ["Coudes et attaches de descente — l'unité", "Coudes, section de remplacement au besoin, attaches et rivets."],
    ["Codos y abrazaderas de bajante — por bajante", "Codos, un tramo de reposición si hace falta, abrazaderas y remaches."],
    ["Gomiti e fascette per pluviale — cadauno", "Gomiti, un tratto di ricambio se serve, fascette e rivetti."],
    ["Fallrohrbögen und Schellen — pro Stück", "Bögen, bei Bedarf ein Ersatzstück, Schellen und Nieten."],
    ["Коліна та хомути для труби — за трубу", "Коліна, відрізок на заміну за потреби, хомути та заклепки."],
    ["Elbow at strap ng downspout — kada isa", "Elbow, pamalit na bahagi kung kailangan, strap at rivet."],
  ), { measurementKey: "each" }),
  guardRefit: (price) => L.labour(1, "linear_ft", price, t7(
    ["Guard refit — per linear ft", "Bent or lifted guards taken off, the gutter cleared underneath and the guards refastened or replaced."],
    ["Remise en place des protège-gouttières — au pi lin.", "Protecteurs tordus ou soulevés retirés, gouttière dégagée dessous et protecteurs refixés ou remplacés."],
    ["Reajuste de protectores — por pie lineal", "Protectores doblados o levantados retirados, canaleta limpiada por debajo y protectores refijados o cambiados."],
    ["Rimontaggio paraf fogliame — al piede lineare", "Protezioni piegate o sollevate tolte, grondaia pulita sotto e protezioni rifissate o sostituite."],
    ["Laubschutz neu befestigen — pro lfd. Fuß", "Verbogene oder angehobene Gitter abgenommen, Rinne darunter geräumt und Gitter neu befestigt oder ersetzt."],
    ["Повторне кріплення сітки — за пог. фут", "Погнуті чи підняті сітки знято, ринву під ними очищено, сітки закріплено чи замінено."],
    ["Pag-refit ng guard — kada linear ft", "Tinanggal ang baluktot o umangat na guard, nilinis ang gutter sa ilalim at ikinabit ulit o pinalitan."],
  ), { measurementKey: "linearFt" }),
  spotPaint: (price) => L.labour(1, "linear_ft", price, t7(
    ["Spot scrape, prime and repaint — per linear ft", "Rust and peeling paint scraped back to sound metal, spot-primed and repainted to match."],
    ["Grattage, apprêt et retouche — au pi lin.", "Rouille et peinture écaillée grattées jusqu'au métal sain, apprêt localisé et retouche assortie."],
    ["Raspado, primario y repintado — por pie lineal", "Óxido y pintura descascarada raspados hasta el metal sano, primario localizado y repintado a juego."],
    ["Raschiatura, primer e ritocco — al piede lineare", "Ruggine e pittura scrostata raschiate fino al metallo sano, primer localizzato e ritocco abbinato."],
    ["Ausbessern, grundieren und nachstreichen — pro lfd. Fuß", "Rost und abblätternde Farbe bis aufs gesunde Metall abgekratzt, punktuell grundiert und passend nachgestrichen."],
    ["Зачищення, ґрунтування та фарбування — за пог. фут", "Іржу й відшаровану фарбу зачищено до здорового металу, місцево заґрунтовано й підфарбовано в тон."],
    ["Kayod, primer at pintura — kada linear ft", "Kinayod ang kalawang at nababakbak na pintura hanggang matibay na metal, prinimer at pininturahan na katerno."],
  ), { measurementKey: "linearFt" }),
  rustPaint: (price) => L.material(1, "linear_ft", price, t7(
    ["Rust-inhibiting primer and paint — per linear ft", "Rust-inhibiting metal primer and exterior paint for the repaired run."],
    ["Apprêt antirouille et peinture — au pi lin.", "Apprêt antirouille pour métal et peinture extérieure pour la section réparée."],
    ["Primario anticorrosivo y pintura — por pie lineal", "Primario anticorrosivo para metal y pintura exterior para el tramo reparado."],
    ["Primer antiruggine e pittura — al piede lineare", "Primer antiruggine per metallo e pittura per esterni per il tratto riparato."],
    ["Rostschutzgrund und Farbe — pro lfd. Fuß", "Rostschutz-Metallgrund und Außenfarbe für das reparierte Stück."],
    ["Антикорозійний ґрунт і фарба — за пог. фут", "Антикорозійний ґрунт для металу та фасадна фарба для відремонтованої ділянки."],
    ["Anti-rust primer at pintura — kada linear ft", "Anti-rust na metal primer at exterior paint para sa inayos na bahagi."],
  ), { measurementKey: "linearFt" }),
  drainFlush: (price) => L.labour(1, "flat", price, t7(
    ["Drain flush and camera check", "The drain jetted from the downspout end and a camera run to find the clog or crushed section."],
    ["Rinçage du drain et vérification par caméra", "Drain rincé sous pression depuis la descente et caméra passée pour trouver le bouchon ou l'écrasement."],
    ["Enjuague del dren y revisión con cámara", "Dren lavado a presión desde la bajante y cámara pasada para encontrar la obstrucción o el tramo aplastado."],
    ["Lavaggio del drenaggio e videoispezione", "Drenaggio lavato a pressione dal pluviale e telecamera passata per trovare l'ostruzione o il tratto schiacciato."],
    ["Drainage spülen und Kamerakontrolle", "Drainage vom Fallrohr aus gespült und mit der Kamera die Verstopfung oder das gequetschte Stück gesucht."],
    ["Промивання дренажу та перевірка камерою", "Дренаж промито від труби, камерою знайдено засмічення чи зім'яту ділянку."],
    ["Flush ng drain at camera check", "Ni-jet ang drain mula sa downspout at pinadaan ang camera para hanapin ang bara o yuping bahagi."],
  )),
  drainRelay: (price) => L.labour(1, "linear_ft", price, t7(
    ["Drain excavation and relay — per linear ft", "The failed section dug out, the pipe cleaned or replaced, re-bedded in fresh rock and backfilled."],
    ["Excavation et repose du drain — au pi lin.", "Section défaillante déterrée, tuyau nettoyé ou remplacé, reposé dans de la pierre neuve et remblayé."],
    ["Excavación y recolocación del dren — por pie lineal", "Tramo dañado desenterrado, tubo limpiado o cambiado, reasentado en grava nueva y rellenado."],
    ["Scavo e riposa del drenaggio — al piede lineare", "Tratto guasto scavato, tubo pulito o sostituito, riposato in ghiaietto nuovo e reinterrato."],
    ["Drainage aufgraben und neu verlegen — pro lfd. Fuß", "Defektes Stück freigelegt, Rohr gereinigt oder ersetzt, in frischem Kies neu gebettet und verfüllt."],
    ["Розкопка та перекладання дренажу — за пог. фут", "Несправну ділянку розкопано, трубу очищено чи замінено, покладено в новий щебінь і засипано."],
    ["Paghukay at muling paglatag ng drain — kada linear ft", "Hinukay ang sirang bahagi, nilinis o pinalitan ang tubo, inilatag ulit sa bagong rock at tinabunan."],
  ), { measurementKey: "linearFt" }),
};

const GK = (key) => `fq.gutter_services.${key}`;
const nm = (key) => I18N.services[key];
const PM = { categories: ["gutter_services", "property_maintenance"] };
const MORE_TEMPLATES = {
  // ── Installation ──
  [GK("install.regular")]: T("installation", nm(GK("install.regular")), [SHARED.removeOld(150), GUTTER_LABOUR(5.5), DOWNSPOUT(), ALUM_GUTTER(), G.joints(0.75)], D.newCustomer("fixed", 50)),
  [GK("install.k_style")]: T("installation", nm(GK("install.k_style")), [SHARED.removeOld(150), GUTTER_LABOUR(5), DOWNSPOUT(), ALUM_GUTTER()], D.newCustomer("fixed", 50)),
  [GK("install.half_round")]: T("installation", nm(GK("install.half_round")), [SHARED.removeOld(150), G.halfLab(8), G.halfGutter(6), DOWNSPOUT(115)], D.newCustomer("fixed", 50)),
  [GK("install.box")]: T("installation", nm(GK("install.box")), [G.boxLab(28), G.boxLiner(12), DOWNSPOUT(125), SHARED.haulAway(200)], null),
  [GK("install.copper")]: T("installation", nm(GK("install.copper")), [SHARED.removeOld(150), G.copperLab(14), G.copperGutter(18), G.copperDownspout(275)], D.newCustomer("fixed", 100)),
  [GK("install.french_drain")]: T("installation", nm(GK("install.french_drain")), [G.drainLab(22), G.drainRock(6), G.drainPipe(4), G.downspoutTie(95)], null),

  // ── Maintenance ──
  [GK("maintenance.regular")]: T("maintenance", nm(GK("maintenance.regular")), [G.maintLab(1.75), G.dsFlush(15), SHARED.consumables(25), SHARED.serviceCall(75)], D.seasonal("fixed", 20), PM),
  [GK("maintenance.seamless")]: T("maintenance", nm(GK("maintenance.seamless")), [G.maintLab(1.5), G.dsFlush(15), SHARED.consumables(25), SHARED.serviceCall(75)], D.seasonal("fixed", 20), PM),
  [GK("maintenance.k_style")]: T("maintenance", nm(GK("maintenance.k_style")), [G.maintLab(1.5), G.dsFlush(15), SHARED.consumables(25), SHARED.serviceCall(75)], D.seasonal("fixed", 20), PM),
  [GK("maintenance.half_round")]: T("maintenance", nm(GK("maintenance.half_round")), [G.maintLab(1.75), G.dsFlush(15), SHARED.consumables(25), SHARED.serviceCall(75)], D.seasonal("fixed", 20)),
  [GK("maintenance.box")]: T("maintenance", nm(GK("maintenance.box")), [G.boxMaint(3.5), G.dsFlush(15), SHARED.consumables(45), SHARED.serviceCall(75)], D.seasonal("fixed", 20)),
  [GK("maintenance.copper")]: T("maintenance", nm(GK("maintenance.copper")), [G.maintLab(2.25), G.dsFlush(15), G.copperTouchUp(85), SHARED.serviceCall(75)], D.seasonal("fixed", 20)),
  [GK("maintenance.downspouts")]: T("maintenance", nm(GK("maintenance.downspouts")), [G.dsMaint(35), G.dsStraps(4), SHARED.serviceCall(75)], D.seasonal("fixed", 20), PM),
  [GK("maintenance.painting")]: T("maintenance", nm(GK("maintenance.painting")), [G.paintLab(4.5), G.paintMat(0.75)], null),

  // ── Repair ──
  [GK("repair.regular")]: T("repair", nm(GK("repair.regular")), [SHARED.serviceCall(95), G.sectionRepair(8), G.sectionStock(4), RESEAL()], null),
  [GK("repair.k_style")]: T("repair", nm(GK("repair.k_style")), [SHARED.serviceCall(95), G.sectionRepair(8), G.sectionStock(4), RESEAL()], null),
  [GK("repair.half_round")]: T("repair", nm(GK("repair.half_round")), [SHARED.serviceCall(95), G.sectionRepair(9), G.sectionStock(6), RESEAL()], null),
  [GK("repair.box")]: T("repair", nm(GK("repair.box")), [SHARED.serviceCall(95), G.sectionRepair(20), G.sectionStock(10), RESEAL(95)], null),
  [GK("repair.copper")]: T("repair", nm(GK("repair.copper")), [SHARED.serviceCall(95), G.sectionRepair(16), G.sectionStock(18), G.copperSolder(125)], null),
  [GK("repair.downspouts")]: T("repair", nm(GK("repair.downspouts")), [SHARED.serviceCall(95), G.dsRepair(65), G.dsParts(18)], null),
  [GK("repair.guards")]: T("repair", nm(GK("repair.guards")), [SHARED.serviceCall(95), G.guardRefit(3), MICRO_MESH()], null),
  [GK("repair.painting")]: T("repair", nm(GK("repair.painting")), [SHARED.serviceCall(95), G.spotPaint(6), G.rustPaint(1)], null),
  [GK("repair.french_drain")]: T("repair", nm(GK("repair.french_drain")), [SHARED.serviceCall(95), G.drainFlush(250), G.drainRelay(30), G.drainPipe(4)], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, { ...TEMPLATES, ...MORE_TEMPLATES });
