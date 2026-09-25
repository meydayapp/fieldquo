// app/data/serviceSeeds/window_cleaning.js
//
// The service list a window and exterior cleaning company starts from. Read
// ./index.js for the format and the rules. Written in source order.
import { L, SHARED, D, T, withTemplates } from "./_templateLines";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "window_cleaning",
  categories: [
    { key: "visits", name: { en: "Booked visits", fr: "Visites réservées", es: "Visitas agendadas" } },
    { key: "exterior", name: { en: "Exterior cleaning", fr: "Nettoyage extérieur", es: "Limpieza exterior" } },
    { key: "specialty", name: { en: "Specialty surfaces", fr: "Surfaces spéciales", es: "Superficies especiales" } },
    { key: "windows", name: { en: "Window cleaning", fr: "Lavage de vitres", es: "Limpieza de ventanas" } },
  ],
  services: [
    S("fq.window_cleaning.visits.inspection", "visits", "flat", null,
      ["Inspection visit — windows and exterior", "Visite d'inspection — vitres et extérieur", "Visita de inspección — ventanas y exterior"],
      ["The windows and exterior surfaces assessed on site with clear recommendations and a price.",
       "Vitres et surfaces extérieures évaluées sur place avec des recommandations claires et un prix.",
       "Ventanas y superficies exteriores evaluadas en sitio con recomendaciones claras y un precio."], { durationMinutes: 120, bookable: true }),
    S("fq.window_cleaning.visits.repair", "visits", "flat", null,
      ["Repair visit — screens and hardware", "Visite de réparation — moustiquaires et quincaillerie", "Visita de reparación — mosquiteros y herrajes"],
      ["Screens, tracks and hardware repaired on a booked visit.",
       "Moustiquaires, rails et quincaillerie réparés lors d'une visite réservée.",
       "Mosquiteros, rieles y herrajes reparados en una visita agendada."], { durationMinutes: 120, bookable: true }),
    S("fq.window_cleaning.visits.install_upgrade", "visits", "flat", null,
      ["Installation or upgrade visit", "Visite d'installation ou de mise à niveau", "Visita de instalación o actualización"],
      ["New screens, guards or fittings installed on a booked visit.",
       "Nouveaux moustiquaires, protections ou accessoires installés lors d'une visite réservée.",
       "Mosquiteros, protectores o accesorios nuevos instalados en una visita agendada."], { durationMinutes: 120, bookable: true }),
    S("fq.window_cleaning.exterior.driveway_pressure_wash", "exterior", "sqft", null,
      ["Driveway and concrete pressure washing", "Lavage à pression d'entrée et de béton", "Lavado a presión de entrada y concreto"],
      ["Dirt, stains and mildew blasted off concrete driveways, walks and patios.",
       "Saleté, taches et moisissure décapées des entrées, trottoirs et patios en béton.",
       "Tierra, manchas y moho removidos de entradas, andadores y patios de concreto."],
      { existing: "pressure_washing_driveway trade." }),
    S("fq.window_cleaning.exterior.power_soft_wash", "exterior", "flat", null,
      ["Exterior power or soft wash — home and surroundings", "Lavage à pression ou à basse pression — maison et abords", "Lavado a presión o suave — casa y alrededores"],
      ["The house and surrounding hard surfaces cleaned with the right pressure for each material.",
       "Maison et surfaces dures environnantes nettoyées avec la pression adaptée à chaque matériau.",
       "Casa y superficies duras alrededor limpiadas con la presión adecuada para cada material."],
      { existing: "pressure_washing_house trade." }),
    S("fq.window_cleaning.exterior.house_soft_wash", "exterior", "flat", null,
      ["House soft wash — siding and exterior surfaces", "Lavage à basse pression — revêtement et surfaces extérieures", "Lavado suave de casa — revestimiento y superficies exteriores"],
      ["Siding and exterior surfaces cleaned at low pressure with a detergent that lifts algae and grime.",
       "Revêtement et surfaces extérieures nettoyés à basse pression avec un détergent qui décolle algues et crasse.",
       "Revestimiento y superficies exteriores limpiados a baja presión con un detergente que remueve algas y mugre."],
      { existing: "pressure_washing_house trade." }),
    S("fq.window_cleaning.exterior.gutter_cleaning", "exterior", "flat", BM(128, 209, 299),
      ["Gutter cleaning", "Nettoyage de gouttières", "Limpieza de canaletas"],
      ["Gutters and downspouts cleared of leaves and debris and flushed to check they drain.",
       "Gouttières et descentes débarrassées des feuilles et débris et rincées pour vérifier l'écoulement.",
       "Canaletas y bajantes despejadas de hojas y residuos y enjuagadas para comprobar que drenan."],
      { existing: "gutter_services seed." }),
    S("fq.window_cleaning.specialty.natural_stone_house", "specialty", "flat", null,
      ["Natural stone cleaning — whole house", "Nettoyage de pierre naturelle — maison complète", "Limpieza de piedra natural — casa completa"],
      ["Natural stone surfaces around the home cleaned with products safe for the stone.",
       "Surfaces en pierre naturelle de la maison nettoyées avec des produits sûrs pour la pierre.",
       "Superficies de piedra natural de la casa limpiadas con productos seguros para la piedra."]),
    S("fq.window_cleaning.specialty.solar_panels", "specialty", "flat", BM(150, 199, 250),
      ["Solar panel cleaning", "Nettoyage de panneaux solaires", "Limpieza de paneles solares"],
      ["Panels washed with a soft brush and purified-water rinse so they produce at full output.",
       "Panneaux lavés à la brosse douce et rincés à l'eau purifiée pour un rendement maximal.",
       "Paneles lavados con cepillo suave y enjuague de agua purificada para que produzcan al máximo."]),
    S("fq.window_cleaning.specialty.screen_repair", "specialty", "each", BM(40, 75, 150),
      ["Window or door screen repair or replacement", "Réparation ou remplacement de moustiquaire", "Reparación o reemplazo de mosquitero"],
      ["A screen removed, re-meshed or replaced and refitted.",
       "Moustiquaire retiré, retoilé ou remplacé et reposé.",
       "Mosquitero retirado, con malla nueva o reemplazado y reinstalado."]),
    S("fq.window_cleaning.windows.recurring", "windows", "flat", null,
      ["Recurring window washing", "Lavage de vitres récurrent", "Lavado de ventanas recurrente"],
      ["Scheduled window cleaning to keep the glass clear and streak-free.",
       "Lavage de vitres planifié pour garder le verre clair et sans traces.",
       "Lavado de ventanas programado para mantener el vidrio claro y sin marcas."]),
    S("fq.window_cleaning.windows.one_time", "windows", "flat", null,
      ["One-time window washing", "Lavage de vitres unique", "Lavado de ventanas único"],
      ["A single professional cleaning to remove dirt, streaks and build-up from the windows.",
       "Un seul lavage professionnel pour retirer saleté, traces et dépôts des vitres.",
       "Una sola limpieza profesional para quitar tierra, marcas y acumulación de las ventanas."]),
    S("fq.window_cleaning.windows.skylights", "windows", "each", null,
      ["Skylight cleaning", "Nettoyage de puits de lumière", "Limpieza de tragaluces"],
      ["Skylight glass cleaned inside and outside where it can be reached.",
       "Verre des puits de lumière nettoyé à l'intérieur et à l'extérieur là où il est accessible.",
       "Vidrio de tragaluces limpiado por dentro y por fuera donde se alcance."]),
    S("fq.window_cleaning.windows.whole_property_int_ext", "windows", "flat", BM(128, 235, 375),
      ["Whole-property window cleaning — interior and exterior", "Lavage de toutes les vitres — intérieur et extérieur", "Limpieza de ventanas de toda la propiedad — interior y exterior"],
      ["Every window on the property washed inside and out.",
       "Toutes les vitres de la propriété lavées des deux côtés.",
       "Todas las ventanas de la propiedad lavadas por dentro y por fuera."]),
    S("fq.window_cleaning.windows.int_ext_tracks_sills_screens", "windows", "flat", BM(99, 189, 325),
      ["Window cleaning — interior and exterior with tracks, sills and screens", "Lavage de vitres — intérieur et extérieur avec rails, appuis et moustiquaires", "Limpieza de ventanas — interior y exterior con rieles, alféizares y mosquiteros"],
      ["Windows washed both sides, with tracks, sills and screens cleaned as well.",
       "Vitres lavées des deux côtés, rails, appuis et moustiquaires nettoyés aussi.",
       "Ventanas lavadas por ambos lados, con rieles, alféizares y mosquiteros limpiados también."]),
    S("fq.window_cleaning.windows.exterior_glass_frames", "windows", "flat", BM(90, 157, 250),
      ["Exterior window cleaning — glass and frames", "Lavage de vitres extérieur — verre et cadres", "Limpieza exterior de ventanas — vidrio y marcos"],
      ["Outside glass and frames cleaned to a spot-free finish.",
       "Verre et cadres extérieurs nettoyés sans taches.",
       "Vidrio y marcos exteriores limpiados sin manchas."]),
    S("fq.window_cleaning.windows.commercial", "windows", "flat", BM(60, 144, 300),
      ["Commercial window and glass door cleaning with sill wipe", "Lavage de vitres et portes vitrées commerciales avec essuyage des appuis", "Limpieza comercial de ventanas y puertas de vidrio con limpieza de alféizares"],
      ["Accessible commercial windows and glass doors cleaned inside and out, sills wiped.",
       "Vitres et portes vitrées commerciales accessibles nettoyées des deux côtés, appuis essuyés.",
       "Ventanas y puertas de vidrio comerciales accesibles limpiadas por dentro y por fuera, con alféizares limpiados."]),
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    S("fq.window_cleaning.exterior.gutter_roof_rinse", "exterior", "flat", null,
      ["Gutter cleaning with roof rinse", "Nettoyage de gouttières et rinçage du toit", "Limpieza de canaletas y enjuague del techo"],
      ["Gutters and downspouts cleared and flushed, and loose debris blown off the roof and rinsed down.", "Gouttières et descentes dégagées et rincées, débris soufflés du toit et rincés.", "Canaletas y bajantes despejadas y enjuagadas, y los residuos del techo soplados y enjuagados."]),
    S("fq.window_cleaning.exterior.gutter_inspection", "exterior", "flat", null,
      ["Gutter and downspout inspection", "Inspection des gouttières et descentes", "Inspección de canaletas y bajantes"],
      ["Every run checked for sag, leaks, loose hangers and blocked outlets, with photos and a written list.", "Chaque section vérifiée pour l'affaissement, les fuites, les crochets lâches et les sorties bouchées, avec photos et liste écrite.", "Cada tramo revisado por hundimiento, fugas, ganchos flojos y salidas tapadas, con fotos y una lista escrita."]),
    S("fq.window_cleaning.visits.estimate_visit", "visits", "flat", null,
      ["Window count and estimate visit", "Visite de comptage des fenêtres et soumission", "Visita de conteo de ventanas y presupuesto"],
      ["Every window counted by type — standard, French pane, patio door, basement well — and a written price left.", "Chaque fenêtre comptée par type — standard, à carreaux, porte-patio, puits de sous-sol — et prix écrit laissé.", "Cada ventana contada por tipo — estándar, de cuadros, puerta de patio, pozo de sótano — y un precio por escrito."], { durationMinutes: 30, bookable: true }),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the window and exterior cleaning capture under docs/research/ —
// six templates with real costs: house soft wash ($250/120) with a window
// rinse ($75/40) and solution ($30/15), $18 off; the same with a driveway
// pressure wash ($150/75) and solution ($40/20), $22 off; gutter cleaning
// ($150/75) with a downspout flush ($50/25), $10 off, and with a roof rinse
// ($150/75), $15 off; quarterly window cleaning ($300/200, 4% off) and a
// one-time window cleaning ($350/200, $20 off). Carried at those prices and
// costs. Its booking form prices PER WINDOW by type, so the per-window lines
// here count windows with the registry's generic `each` (there is no window
// key yet; per-type keys are the follow-up). Driveways are the traced
// `areaSqft`, gutters the gutter measurement `gutterFt` and `downspouts`,
// house washes the exterior takeoff's `wallSqft`.
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const PER_WINDOW = (price, cost, text) => L.labour(1, "each", price, text, { cost, measurementKey: "each" });
const OUTSIDE = (price = 7, cost = 3.5) => PER_WINDOW(price, cost, {
  en: ["Window — outside, per window", "Exterior glass and frame washed and squeegeed."],
  fr: ["Fenêtre — extérieur, la fenêtre", "Vitre et cadre extérieurs lavés et raclés."],
  es: ["Ventana — exterior, por ventana", "Vidrio y marco exterior lavados y secados con jalador."],
  it: ["Finestra — esterno, per finestra", "Vetro e telaio esterni lavati e passati con il tergivetro."],
  de: ["Fenster — außen, pro Fenster", "Außenglas und Rahmen gewaschen und abgezogen."],
  uk: ["Вікно — зовні, за вікно", "Зовнішнє скло й раму вимито й протерто склоочисником."],
  tl: ["Bintana — labas, kada bintana", "Hinugasan at kinuskos ng squeegee ang salamin at frame sa labas."],
});
const IN_OUT = (price = 12, cost = 6) => PER_WINDOW(price, cost, {
  en: ["Window — inside and out, per window", "Glass washed both sides and the frames wiped."],
  fr: ["Fenêtre — intérieur et extérieur, la fenêtre", "Vitre lavée des deux côtés et cadres essuyés."],
  es: ["Ventana — por dentro y por fuera, por ventana", "Vidrio lavado por ambos lados y marcos limpios."],
  it: ["Finestra — interno ed esterno, per finestra", "Vetro lavato su entrambi i lati e telai puliti."],
  de: ["Fenster — innen und außen, pro Fenster", "Glas beidseitig gewaschen und Rahmen gewischt."],
  uk: ["Вікно — всередині та зовні, за вікно", "Скло вимито з обох боків, рами протерто."],
  tl: ["Bintana — loob at labas, kada bintana", "Hinugasan ang salamin sa magkabilang side at pinunasan ang frame."],
});
const ALL_IN = (price = 18, cost = 9) => PER_WINDOW(price, cost, {
  en: ["Window — all-inclusive, per window", "Both sides of the glass plus tracks, sills and screens."],
  fr: ["Fenêtre — tout compris, la fenêtre", "Vitre des deux côtés, glissières, rebords et moustiquaires."],
  es: ["Ventana — todo incluido, por ventana", "Vidrio por ambos lados más rieles, alféizares y mosquiteros."],
  it: ["Finestra — tutto incluso, per finestra", "Vetro su entrambi i lati più binari, davanzali e zanzariere."],
  de: ["Fenster — komplett, pro Fenster", "Glas beidseitig plus Schienen, Fensterbänke und Fliegengitter."],
  uk: ["Вікно — все включено, за вікно", "Скло з обох боків, напрямні, підвіконня й москітні сітки."],
  tl: ["Bintana — all-inclusive, kada bintana", "Salamin sa magkabilang side at track, sill at screen."],
});
const WINDOW_VISIT = (price, cost, text) => L.labour(1, "flat", price, text, { cost });

const TEMPLATES = {
  // ── Installation (first / one-time services) ──
  "fq.window_cleaning.visits.install_upgrade": T("installation", n(
    ["Visita di installazione o miglioria", "Nuove zanzariere, protezioni o accessori installati in una visita prenotata."],
    ["Einbau- oder Nachrüsttermin", "Neue Fliegengitter, Schutzgitter oder Beschläge bei einem gebuchten Termin montiert."],
    ["Візит для встановлення чи модернізації", "Нові сітки, захисні ґрати чи фурнітуру встановлено за запланований візит."],
    ["Installation o upgrade visit", "Ikinabit ang bagong screen, guard o fitting sa naka-book na visit."],
  ), [
    L.labour(1, "each", 45, {
      en: ["Screen or guard installation — per window", "New screen or guard measured, fitted and secured."],
      fr: ["Pose de moustiquaire ou de grille — la fenêtre", "Nouvelle moustiquaire ou grille mesurée, posée et fixée."],
      es: ["Instalación de mosquitero o protector — por ventana", "Mosquitero o protector nuevo medido, colocado y asegurado."],
      it: ["Montaggio zanzariera o protezione — per finestra", "Nuova zanzariera o protezione misurata, montata e fissata."],
      de: ["Gitter- oder Schutzmontage — pro Fenster", "Neues Gitter oder Schutz vermessen, eingesetzt und gesichert."],
      uk: ["Встановлення сітки чи ґрат — за вікно", "Нову сітку чи ґрати виміряно, встановлено й закріплено."],
      tl: ["Pagkabit ng screen o guard — kada bintana", "Sinukat, ikinabit at sinigurado ang bagong screen o guard."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 35, {
      en: ["Custom screen — per window", "Aluminium frame with fibreglass mesh, cut to size."],
      fr: ["Moustiquaire sur mesure — la fenêtre", "Cadre en aluminium et toile de fibre de verre, coupés sur mesure."],
      es: ["Mosquitero a la medida — por ventana", "Marco de aluminio con malla de fibra de vidrio, cortado a la medida."],
      it: ["Zanzariera su misura — per finestra", "Telaio in alluminio con rete in fibra di vetro, tagliato su misura."],
      de: ["Maßgitter — pro Fenster", "Aluminiumrahmen mit Glasfasergewebe, auf Maß geschnitten."],
      uk: ["Сітка на замовлення — за вікно", "Алюмінієва рама зі склотканинною сіткою, під розмір."],
      tl: ["Custom na screen — kada bintana", "Aluminum frame na may fiberglass mesh, sukat sa bintana."],
    }, { measurementKey: "each" }),
  ], null),

  "fq.window_cleaning.windows.one_time": T("installation", n(
    ["Lavaggio vetri una tantum", "Una pulizia professionale per togliere sporco, aloni e depositi dai vetri."],
    ["Einmalige Fensterreinigung", "Eine professionelle Reinigung, die Schmutz, Schlieren und Ablagerungen von den Fenstern entfernt."],
    ["Разове миття вікон", "Одне професійне миття, щоб прибрати бруд, розводи й наліт зі скла."],
    ["Isang beses na paghugas ng bintana", "Isang propesyonal na paglilinis para matanggal ang dumi, guhit at naipon sa bintana."],
  ), [WINDOW_VISIT(350, 200, {
    en: ["One-time window cleaning", "Every window cleaned inside and out on a single visit."],
    fr: ["Lavage de vitres ponctuel", "Toutes les fenêtres lavées à l'intérieur et à l'extérieur en une visite."],
    es: ["Limpieza de ventanas única", "Todas las ventanas limpias por dentro y por fuera en una visita."],
    it: ["Lavaggio vetri una tantum", "Tutte le finestre lavate dentro e fuori in una sola visita."],
    de: ["Einmalige Fensterreinigung", "Alle Fenster bei einem Termin innen und außen gereinigt."],
    uk: ["Разове миття вікон", "Усі вікна вимито зсередини й ззовні за один візит."],
    tl: ["Isang beses na paglinis ng bintana", "Nilinis ang lahat ng bintana sa loob at labas sa isang visit."],
  })], D.newCustomer("fixed", 20)),

  "fq.window_cleaning.exterior.house_soft_wash": T("installation", n(
    ["Lavaggio a bassa pressione della casa", "Rivestimento e superfici esterne puliti a bassa pressione con un detergente che toglie alghe e sporco."],
    ["Sanfte Hauswäsche", "Fassade und Außenflächen mit Niederdruck und einem Reiniger gegen Algen und Schmutz gewaschen."],
    ["М'яке миття будинку", "Обшивку й зовнішні поверхні вимито низьким тиском із засобом проти водоростей і бруду."],
    ["Soft wash ng bahay", "Nilinis ang siding at panlabas sa mababang pressure gamit ang detergent na nag-aalis ng algae at dumi."],
  ), [
    WINDOW_VISIT(250, 120, {
      en: ["House soft wash", "Siding soft-washed top to bottom and rinsed."],
      fr: ["Lavage doux de la maison", "Revêtement lavé en douceur de haut en bas et rincé."],
      es: ["Lavado suave de la casa", "Revestimiento lavado suave de arriba abajo y enjuagado."],
      it: ["Lavaggio delicato della casa", "Rivestimento lavato delicatamente dall'alto in basso e risciacquato."],
      de: ["Sanfte Hauswäsche", "Fassade von oben nach unten sanft gewaschen und gespült."],
      uk: ["М'яке миття будинку", "Обшивку м'яко вимито згори донизу й прополоскано."],
      tl: ["Soft wash ng bahay", "Sinoft-wash ang siding mula taas hanggang baba at binanlawan."],
    }),
    WINDOW_VISIT(75, 40, {
      en: ["Window exterior rinse", "Exterior glass rinsed with purified water after the wash."],
      fr: ["Rinçage extérieur des fenêtres", "Vitres extérieures rincées à l'eau purifiée après le lavage."],
      es: ["Enjuague exterior de ventanas", "Vidrios exteriores enjuagados con agua purificada tras el lavado."],
      it: ["Risciacquo esterno delle finestre", "Vetri esterni risciacquati con acqua purificata dopo il lavaggio."],
      de: ["Fenster außen spülen", "Außenglas nach der Wäsche mit Reinwasser gespült."],
      uk: ["Ополіскування вікон зовні", "Зовнішнє скло після миття прополоскано очищеною водою."],
      tl: ["Pagbanlaw ng bintana sa labas", "Binanlawan ng purified water ang salamin sa labas pagkatapos maghugas."],
    }),
    L.material(1, "flat", 30, {
      en: ["Soft-wash solution", "Biodegradable house-wash detergent."],
      fr: ["Solution de lavage doux", "Détergent biodégradable pour lavage de maison."],
      es: ["Solución de lavado suave", "Detergente biodegradable para lavado de casas."],
      it: ["Soluzione per lavaggio delicato", "Detergente biodegradabile per lavaggio facciate."],
      de: ["Softwash-Lösung", "Biologisch abbaubarer Fassadenreiniger."],
      uk: ["Розчин для м'якого миття", "Біорозкладний засіб для миття будинку."],
      tl: ["Soft-wash solution", "Biodegradable na detergent para sa bahay."],
    }, { cost: 15 }),
  ], D.newCustomer("fixed", 18)),

  "fq.window_cleaning.exterior.power_soft_wash": T("installation", n(
    ["Lavaggio esterno — casa e dintorni", "Lavaggio della casa più il vialetto d'accesso in un unico pacchetto."],
    ["Außenwäsche — Haus und Umgebung", "Hauswäsche plus Einfahrt als ein Paket."],
    ["Зовнішнє миття — будинок і територія", "Миття будинку та під'їзної доріжки одним пакетом."],
    ["Panlabas na wash — bahay at paligid", "Paghugas ng bahay at driveway bilang isang package."],
  ), [
    L.labour(1, "sqft", 0.15, {
      en: ["House soft wash — per sq ft of wall", "Siding soft-washed and rinsed."],
      fr: ["Lavage doux — au pi² de mur", "Revêtement lavé en douceur et rincé."],
      es: ["Lavado suave — por pie² de muro", "Revestimiento lavado suave y enjuagado."],
      it: ["Lavaggio delicato — al piede quadro di parete", "Rivestimento lavato delicatamente e risciacquato."],
      de: ["Sanfte Wäsche — pro sq ft Wand", "Fassade sanft gewaschen und gespült."],
      uk: ["М'яке миття — за кв. фут стіни", "Обшивку м'яко вимито й прополоскано."],
      tl: ["Soft wash — kada sq ft ng pader", "Sinoft-wash at binanlawan ang siding."],
    }, { measurementKey: "wallSqft" }),
    WINDOW_VISIT(150, 75, {
      en: ["Driveway pressure wash", "Driveway surface-cleaned and rinsed."],
      fr: ["Lavage à pression de l'entrée", "Entrée nettoyée au laveur de surface et rincée."],
      es: ["Lavado a presión de la entrada", "Entrada limpiada con limpiador de superficies y enjuagada."],
      it: ["Idropulizia del vialetto", "Vialetto pulito con lavasuperfici e risciacquato."],
      de: ["Hochdruckreinigung der Einfahrt", "Einfahrt mit Flächenreiniger gereinigt und gespült."],
      uk: ["Миття під'їзду під тиском", "Під'їзд очищено поверхневою насадкою й прополоскано."],
      tl: ["Pressure wash ng driveway", "Nilinis gamit ang surface cleaner at binanlawan ang driveway."],
    }),
    L.material(1, "flat", 40, {
      en: ["Cleaning solution", "House-wash detergent and concrete degreaser."],
      fr: ["Solution de nettoyage", "Détergent pour maison et dégraissant à béton."],
      es: ["Solución de limpieza", "Detergente para casas y desengrasante de concreto."],
      it: ["Soluzione detergente", "Detergente per facciate e sgrassatore per calcestruzzo."],
      de: ["Reinigungslösung", "Fassadenreiniger und Betonentfetter."],
      uk: ["Мийний розчин", "Засіб для миття будинку та знежирювач бетону."],
      tl: ["Cleaning solution", "Detergent sa bahay at degreaser sa kongkreto."],
    }, { cost: 20 }),
  ], D.newCustomer("fixed", 22)),

  // ── Repair ──
  "fq.window_cleaning.visits.repair": T("repair", n(
    ["Intervento di riparazione — zanzariere e ferramenta", "Zanzariere, binari e ferramenta riparati in una visita prenotata."],
    ["Reparatureinsatz — Gitter und Beschläge", "Fliegengitter, Schienen und Beschläge bei einem gebuchten Termin repariert."],
    ["Ремонтний візит — сітки та фурнітура", "Сітки, напрямні та фурнітуру відремонтовано за запланований візит."],
    ["Repair visit — screen at hardware", "Inayos ang screen, track at hardware sa naka-book na visit."],
  ), [SHARED.serviceCall(65), SHARED.techHour(1, 70)], null),

  "fq.window_cleaning.specialty.screen_repair": T("repair", n(
    ["Riparazione o sostituzione zanzariera", "Zanzariera tolta, ritesa o sostituita e rimontata."],
    ["Fliegengitter reparieren oder ersetzen", "Gitter ausgebaut, neu bespannt oder ersetzt und wieder eingesetzt."],
    ["Ремонт або заміна сітки", "Сітку знято, перетягнуто або замінено й встановлено назад."],
    ["Pag-ayos o palit ng screen", "Tinanggal, pinalitan ang mesh o buong screen at ibinalik."],
  ), [
    L.labour(1, "each", 55, {
      en: ["Screen re-mesh — per screen", "Old mesh out, new mesh and spline rolled in, corners squared."],
      fr: ["Nouvelle toile — la moustiquaire", "Ancienne toile retirée, nouvelle toile et cordon posés, coins d'équerre."],
      es: ["Cambio de malla — por mosquitero", "Malla vieja fuera, malla y cordón nuevos, esquinas a escuadra."],
      it: ["Nuova rete — per zanzariera", "Vecchia rete tolta, nuova rete e cordino inseriti, angoli in squadra."],
      de: ["Neu bespannen — pro Gitter", "Altes Gewebe raus, neues Gewebe und Keder eingerollt, Ecken ausgerichtet."],
      uk: ["Перетягування сітки — за сітку", "Стару сітку знято, нову сітку й шнур вкатано, кути вирівняно."],
      tl: ["Palit ng mesh — kada screen", "Tinanggal ang lumang mesh, inilagay ang bagong mesh at spline, inayos ang kanto."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 12, {
      en: ["Mesh and spline — per screen", "Fibreglass mesh and vinyl spline."],
      fr: ["Toile et cordon — la moustiquaire", "Toile de fibre de verre et cordon en vinyle."],
      es: ["Malla y cordón — por mosquitero", "Malla de fibra de vidrio y cordón de vinilo."],
      it: ["Rete e cordino — per zanzariera", "Rete in fibra di vetro e cordino in vinile."],
      de: ["Gewebe und Keder — pro Gitter", "Glasfasergewebe und Vinylkeder."],
      uk: ["Сітка та шнур — за сітку", "Склотканинна сітка та вініловий шнур."],
      tl: ["Mesh at spline — kada screen", "Fiberglass mesh at vinyl spline."],
    }, { measurementKey: "each" }),
  ], null),

  "fq.window_cleaning.specialty.natural_stone_house": T("repair", n(
    ["Pulizia pietra naturale — tutta la casa", "Superfici in pietra naturale della casa pulite con prodotti sicuri per la pietra e risciacquate."],
    ["Natursteinreinigung — ganzes Haus", "Natursteinflächen am Haus mit steinschonenden Mitteln gereinigt und gespült."],
    ["Чищення натурального каменю — весь будинок", "Кам'яні поверхні будинку очищено безпечними для каменю засобами й прополоскано."],
    ["Paglilinis ng natural stone — buong bahay", "Nilinis ng stone-safe na produkto at binanlawan ang natural stone ng bahay."],
  ), [
    L.labour(1, "sqft", 0.45, {
      en: ["Stone cleaning — per sq ft", "Stone pre-wetted, a pH-neutral cleaner applied and rinsed at low pressure."],
      fr: ["Nettoyage de pierre — au pi²", "Pierre mouillée, nettoyant au pH neutre appliqué et rincé à basse pression."],
      es: ["Limpieza de piedra — por pie²", "Piedra humedecida, limpiador de pH neutro aplicado y enjuagado a baja presión."],
      it: ["Pulizia pietra — al piede quadro", "Pietra bagnata, detergente a pH neutro applicato e risciacquato a bassa pressione."],
      de: ["Steinreinigung — pro sq ft", "Stein vorgenässt, pH-neutraler Reiniger aufgetragen und mit Niederdruck gespült."],
      uk: ["Чищення каменю — за кв. фут", "Камінь змочено, нанесено pH-нейтральний засіб і змито низьким тиском."],
      tl: ["Paglilinis ng bato — kada sq ft", "Binasa, nilagyan ng pH-neutral na cleaner at binanlawan sa mababang pressure."],
    }, { measurementKey: "wallSqft" }),
  ], null),

  // ── Inspection ──
  "fq.window_cleaning.visits.inspection": T("inspection", n(
    ["Visita di ispezione — finestre ed esterni", "Finestre e superfici esterne valutate sul posto con raccomandazioni chiare e un prezzo."],
    ["Inspektionstermin — Fenster und Außenflächen", "Fenster und Außenflächen vor Ort beurteilt, mit klaren Empfehlungen und Preis."],
    ["Огляд — вікна та зовнішні поверхні", "Вікна та зовнішні поверхні оцінено на місці з чіткими рекомендаціями й ціною."],
    ["Inspection visit — bintana at labas", "Sinuri sa lugar ang bintana at panlabas, may malinaw na rekomendasyon at presyo."],
  ), [L.labour(1, "flat", 75, {
    en: ["Exterior inspection", "Glass, seals, screens and exterior surfaces checked and written up."],
    fr: ["Inspection extérieure", "Vitres, joints, moustiquaires et surfaces extérieures vérifiés et consignés."],
    es: ["Inspección exterior", "Vidrios, sellos, mosquiteros y superficies exteriores revisados y anotados."],
    it: ["Ispezione esterna", "Vetri, guarnizioni, zanzariere e superfici esterne controllati e annotati."],
    de: ["Außeninspektion", "Glas, Dichtungen, Gitter und Außenflächen geprüft und dokumentiert."],
    uk: ["Зовнішній огляд", "Скло, ущільнювачі, сітки й зовнішні поверхні перевірено й описано."],
    tl: ["Inspeksyon sa labas", "Chineck at isinulat ang salamin, seal, screen at panlabas na ibabaw."],
  })], null),

  "fq.window_cleaning.visits.estimate_visit": T("inspection", n(
    ["Conteggio finestre e preventivo", "Ogni finestra contata per tipo — standard, a riquadri, porta-finestra, bocca di lupo — e prezzo scritto lasciato."],
    ["Fensterzählung und Angebot", "Jedes Fenster nach Typ gezählt — Standard, Sprossen, Terrassentür, Kellerschacht — und ein schriftlicher Preis hinterlassen."],
    ["Підрахунок вікон і кошторис", "Кожне вікно пораховано за типом — стандартне, з розкладкою, двері на терасу, приямок — залишено письмову ціну."],
    ["Pagbilang ng bintana at estimate", "Binilang ang bawat bintana ayon sa uri — standard, French pane, patio door, basement well — at iniwan ang presyo."],
  ), [L.labour(1, "flat", 0, {
    en: ["Window count", "Windows counted by type; free with a booked cleaning."],
    fr: ["Comptage des fenêtres", "Fenêtres comptées par type; gratuit avec un lavage réservé."],
    es: ["Conteo de ventanas", "Ventanas contadas por tipo; gratis al agendar la limpieza."],
    it: ["Conteggio finestre", "Finestre contate per tipo; gratuito con una pulizia prenotata."],
    de: ["Fensterzählung", "Fenster nach Typ gezählt; kostenlos bei gebuchter Reinigung."],
    uk: ["Підрахунок вікон", "Вікна пораховано за типом; безкоштовно за замовленого миття."],
    tl: ["Pagbilang ng bintana", "Binilang ayon sa uri; libre kapag nag-book ng paglilinis."],
  }, { cost: 0 })], null),

  "fq.window_cleaning.exterior.gutter_inspection": T("inspection", n(
    ["Ispezione grondaie e pluviali", "Ogni tratto controllato per cedimenti, perdite, staffe allentate e scarichi ostruiti, con foto e lista scritta."],
    ["Inspektion von Rinnen und Fallrohren", "Jede Strecke auf Durchhang, Lecks, lose Halter und verstopfte Abläufe geprüft, mit Fotos und schriftlicher Liste."],
    ["Огляд ринв і водостічних труб", "Кожну ділянку перевірено на провисання, протікання, слабкі гаки та забиті випуски, з фото й письмовим переліком."],
    ["Inspeksyon ng gutter at downspout", "Chineck ang bawat bahagi sa paglubog, tagas, maluwag na hanger at baradong outlet, may litrato at listahan."],
  ), [L.labour(1, "flat", 95, {
    en: ["Gutter inspection", "Runs, hangers, seams and outlets checked from the ladder."],
    fr: ["Inspection des gouttières", "Sections, crochets, joints et sorties vérifiés à l'échelle."],
    es: ["Inspección de canaletas", "Tramos, ganchos, uniones y salidas revisados desde la escalera."],
    it: ["Ispezione grondaie", "Tratti, staffe, giunti e bocchettoni controllati dalla scala."],
    de: ["Rinneninspektion", "Strecken, Halter, Nähte und Abläufe von der Leiter geprüft."],
    uk: ["Огляд ринв", "Ділянки, гаки, шви та випуски перевірено з драбини."],
    tl: ["Inspeksyon ng gutter", "Chineck mula sa hagdan ang bawat bahagi, hanger, dugtungan at outlet."],
  }), SHARED.report(35)], null),

  // ── Maintenance ──
  "fq.window_cleaning.windows.recurring": T("maintenance", n(
    ["Lavaggio vetri periodico", "Pulizia programmata delle finestre per mantenere i vetri limpidi e senza aloni."],
    ["Regelmäßige Fensterreinigung", "Geplante Fensterreinigung für klare, schlierenfreie Scheiben."],
    ["Регулярне миття вікон", "Планове миття, щоб скло було чистим і без розводів."],
    ["Regular na paghugas ng bintana", "Naka-schedule na paglilinis para malinaw at walang guhit ang salamin."],
  ), [WINDOW_VISIT(300, 200, {
    en: ["Quarterly window cleaning", "Every window cleaned inside and out, four visits a year."],
    fr: ["Lavage de vitres trimestriel", "Toutes les fenêtres lavées intérieur et extérieur, quatre visites par an."],
    es: ["Limpieza de ventanas trimestral", "Todas las ventanas por dentro y por fuera, cuatro visitas al año."],
    it: ["Lavaggio vetri trimestrale", "Tutte le finestre dentro e fuori, quattro visite l'anno."],
    de: ["Vierteljährliche Fensterreinigung", "Alle Fenster innen und außen, vier Termine im Jahr."],
    uk: ["Щоквартальне миття вікон", "Усі вікна зсередини й ззовні, чотири візити на рік."],
    tl: ["Quarterly na paglinis ng bintana", "Lahat ng bintana sa loob at labas, apat na visit kada taon."],
  })], D.regular("percent", 4)),

  "fq.window_cleaning.windows.whole_property_int_ext": T("maintenance", n(
    ["Pulizia vetri di tutta la proprietà — interno ed esterno", "Tutte le finestre della proprietà lavate dentro e fuori."],
    ["Fensterreinigung ganzes Objekt — innen und außen", "Alle Fenster des Objekts innen und außen gewaschen."],
    ["Миття вікон усього об'єкта — зсередини та ззовні", "Усі вікна на об'єкті вимито зсередини й ззовні."],
    ["Paglilinis ng bintana ng buong property — loob at labas", "Hinugasan sa loob at labas ang lahat ng bintana ng property."],
  ), [IN_OUT()], null),

  "fq.window_cleaning.windows.int_ext_tracks_sills_screens": T("maintenance", n(
    ["Pulizia vetri — interno ed esterno con binari, davanzali e zanzariere", "Finestre lavate su entrambi i lati, con binari, davanzali e zanzariere puliti."],
    ["Fensterreinigung — innen und außen mit Schienen, Bänken und Gittern", "Fenster beidseitig gewaschen, dazu Schienen, Bänke und Gitter gereinigt."],
    ["Миття вікон — з напрямними, підвіконнями й сітками", "Вікна вимито з обох боків, напрямні, підвіконня й сітки очищено."],
    ["Paglinis ng bintana — may track, sill at screen", "Hinugasan ang bintana sa dalawang side at nilinis ang track, sill at screen."],
  ), [ALL_IN()], null),

  "fq.window_cleaning.windows.exterior_glass_frames": T("maintenance", n(
    ["Pulizia vetri esterni — vetro e telai", "Vetri e telai esterni lavati e passati con il tergivetro."],
    ["Fensterreinigung außen — Glas und Rahmen", "Außenglas und Rahmen gewaschen und abgezogen."],
    ["Миття вікон зовні — скло й рами", "Зовнішнє скло й рами вимито й протерто."],
    ["Paglinis ng bintana sa labas — salamin at frame", "Hinugasan at kinuskos ng squeegee ang salamin at frame sa labas."],
  ), [OUTSIDE()], null),

  "fq.window_cleaning.windows.skylights": T("maintenance", n(
    ["Pulizia lucernari", "Lucernari puliti da tetto o dall'interno, telaio e guarnizioni controllati."],
    ["Dachfensterreinigung", "Dachfenster vom Dach oder von innen gereinigt, Rahmen und Dichtungen geprüft."],
    ["Миття мансардних вікон", "Мансардні вікна вимито з даху або зсередини, раму й ущільнювачі перевірено."],
    ["Paglilinis ng skylight", "Nilinis ang skylight mula bubong o loob, chineck ang frame at seal."],
  ), [L.labour(1, "each", 35, {
    en: ["Skylight cleaning — per skylight", "Outer glass cleaned from the roof, inner glass from a ladder."],
    fr: ["Lavage de puits de lumière — l'unité", "Vitre extérieure lavée depuis le toit, vitre intérieure depuis une échelle."],
    es: ["Limpieza de tragaluz — por tragaluz", "Vidrio exterior limpiado desde el techo, interior desde una escalera."],
    it: ["Pulizia lucernario — cadauno", "Vetro esterno pulito dal tetto, interno da una scala."],
    de: ["Dachfenster reinigen — pro Fenster", "Außenglas vom Dach, Innenglas von der Leiter gereinigt."],
    uk: ["Миття мансардного вікна — за вікно", "Зовнішнє скло вимито з даху, внутрішнє — з драбини."],
    tl: ["Paglilinis ng skylight — kada isa", "Nilinis ang panlabas na salamin mula bubong at panloob mula hagdan."],
  }, { measurementKey: "each" })], null),

  "fq.window_cleaning.specialty.solar_panels": T("maintenance", n(
    ["Pulizia pannelli solari", "Pannelli lavati con spazzola morbida e risciacquo ad acqua purificata per la piena resa."],
    ["Solarmodulreinigung", "Module mit weicher Bürste und Reinwasser gespült, damit sie volle Leistung bringen."],
    ["Миття сонячних панелей", "Панелі вимито м'якою щіткою й очищеною водою для повної віддачі."],
    ["Paglilinis ng solar panel", "Hinugasan ng malambot na brush at purified water para buo ang output."],
  ), [L.labour(1, "each", 10, {
    en: ["Solar panel cleaning — per panel", "Soft-brushed and rinsed with purified water, no detergent."],
    fr: ["Nettoyage de panneau solaire — le panneau", "Brossé en douceur et rincé à l'eau purifiée, sans détergent."],
    es: ["Limpieza de panel solar — por panel", "Cepillado suave y enjuagado con agua purificada, sin detergente."],
    it: ["Pulizia pannello solare — per pannello", "Spazzolato delicatamente e risciacquato con acqua purificata, senza detergente."],
    de: ["Solarmodul reinigen — pro Modul", "Sanft gebürstet und mit Reinwasser gespült, ohne Reinigungsmittel."],
    uk: ["Миття сонячної панелі — за панель", "М'яко вичищено щіткою й прополоскано очищеною водою, без миючих засобів."],
    tl: ["Paglilinis ng solar panel — kada panel", "Malambot na brush at purified water, walang detergent."],
  }, { cost: 4.5, measurementKey: "each" }), SHARED.serviceCall(75)], null),

  "fq.window_cleaning.exterior.gutter_cleaning": T("maintenance", n(
    ["Pulizia grondaie", "Grondaie e pluviali liberati da foglie e detriti e sciacquati per verificare lo scarico."],
    ["Dachrinnenreinigung", "Rinnen und Fallrohre von Laub und Schmutz befreit und gespült, um den Abfluss zu prüfen."],
    ["Чищення ринв", "Ринви й труби очищено від листя та сміття й промито для перевірки стоку."],
    ["Paglilinis ng gutter", "Nilinis ang gutter at downspout mula sa dahon at dumi at binuhusan para makitang dumadaloy."],
  ), [
    WINDOW_VISIT(150, 75, {
      en: ["Gutter cleaning", "Debris cleared from every run by hand."],
      fr: ["Nettoyage de gouttières", "Débris retirés à la main de chaque section."],
      es: ["Limpieza de canaletas", "Residuos retirados a mano de cada tramo."],
      it: ["Pulizia grondaie", "Detriti tolti a mano da ogni tratto."],
      de: ["Rinnenreinigung", "Schmutz aus jeder Strecke von Hand entfernt."],
      uk: ["Чищення ринв", "Сміття вибрано вручну з кожної ділянки."],
      tl: ["Paglilinis ng gutter", "Kinuha sa kamay ang dumi sa bawat bahagi."],
    }),
    WINDOW_VISIT(50, 25, {
      en: ["Downspout flush", "Every downspout flushed and checked to drain."],
      fr: ["Rinçage des descentes", "Chaque descente rincée et vérifiée."],
      es: ["Enjuague de bajantes", "Cada bajante enjuagada y verificada."],
      it: ["Lavaggio pluviali", "Ogni pluviale lavato e controllato."],
      de: ["Fallrohre spülen", "Jedes Fallrohr gespült und auf Abfluss geprüft."],
      uk: ["Промивання труб", "Кожну водостічну трубу промито й перевірено."],
      tl: ["Pag-flush ng downspout", "Binuhusan at chineck ang bawat downspout."],
    }),
  ], D.regular("fixed", 10)),

  "fq.window_cleaning.exterior.gutter_roof_rinse": T("maintenance", n(
    ["Pulizia grondaie con risciacquo del tetto", "Grondaie e pluviali liberati e sciacquati, detriti soffiati via dal tetto e risciacquati."],
    ["Rinnenreinigung mit Dachspülung", "Rinnen und Fallrohre gereinigt und gespült, lose Ablagerungen vom Dach geblasen und abgespült."],
    ["Чищення ринв із промиванням даху", "Ринви й труби очищено й промито, сміття здуто з даху й змито."],
    ["Paglilinis ng gutter at banlaw ng bubong", "Nilinis at binuhusan ang gutter at downspout, hinipan at binanlawan ang dumi sa bubong."],
  ), [
    L.labour(1, "linear_ft", 1.5, {
      en: ["Gutter cleaning — per linear ft", "Gutters cleared and flushed along every run."],
      fr: ["Nettoyage de gouttières — au pi lin.", "Gouttières dégagées et rincées sur chaque section."],
      es: ["Limpieza de canaletas — por pie lineal", "Canaletas despejadas y enjuagadas en cada tramo."],
      it: ["Pulizia grondaie — al piede lineare", "Grondaie liberate e sciacquate lungo ogni tratto."],
      de: ["Rinnenreinigung — pro lfd. Fuß", "Rinnen auf jeder Strecke gereinigt und gespült."],
      uk: ["Чищення ринв — за пог. фут", "Ринви очищено й промито на кожній ділянці."],
      tl: ["Paglilinis ng gutter — kada linear ft", "Nilinis at binuhusan ang bawat bahagi ng gutter."],
    }, { measurementKey: "gutterFt" }),
    L.labour(1, "each", 12, {
      en: ["Downspout flush — per downspout", "Downspout flushed and the outlet checked."],
      fr: ["Rinçage de descente — l'unité", "Descente rincée et sortie vérifiée."],
      es: ["Enjuague de bajante — por bajante", "Bajante enjuagada y salida revisada."],
      it: ["Lavaggio pluviale — cadauno", "Pluviale lavato e scarico controllato."],
      de: ["Fallrohr spülen — pro Stück", "Fallrohr gespült und Auslauf geprüft."],
      uk: ["Промивання труби — за трубу", "Трубу промито, випуск перевірено."],
      tl: ["Pag-flush ng downspout — kada isa", "Binuhusan ang downspout at chineck ang outlet."],
    }, { measurementKey: "downspouts" }),
    WINDOW_VISIT(150, 75, {
      en: ["Roof debris blow-off and rinse", "Loose debris blown off the roof and the surface rinsed."],
      fr: ["Soufflage et rinçage du toit", "Débris soufflés du toit et surface rincée."],
      es: ["Soplado y enjuague del techo", "Residuos soplados del techo y superficie enjuagada."],
      it: ["Soffiatura e risciacquo del tetto", "Detriti soffiati via dal tetto e superficie risciacquata."],
      de: ["Dach abblasen und spülen", "Lose Ablagerungen vom Dach geblasen und Fläche gespült."],
      uk: ["Здування сміття й промивання даху", "Сміття здуто з даху, поверхню прополоскано."],
      tl: ["Pagtanggal ng dumi at banlaw ng bubong", "Hinipan ang dumi sa bubong at binanlawan."],
    }),
  ], D.regular("fixed", 15)),

  "fq.window_cleaning.exterior.driveway_pressure_wash": T("maintenance", n(
    ["Idropulizia vialetti e calcestruzzo", "Vialetti e superfici in calcestruzzo lavati a pressione per togliere sporco, macchie e muffa."],
    ["Hochdruckreinigung von Einfahrt und Beton", "Einfahrten und Betonflächen mit Hochdruck von Schmutz, Flecken und Schimmel befreit."],
    ["Миття під тиском під'їзду та бетону", "Під'їзди й бетонні поверхні вимито під тиском від бруду, плям і цвілі."],
    ["Pressure washing ng driveway at kongkreto", "Pinower-wash ang driveway at kongkreto para matanggal ang dumi, mantsa at amag."],
  ), [
    L.labour(1, "sqft", 0.25, {
      en: ["Surface cleaning — per sq ft", "Pre-treated, surface-cleaned and rinsed edge to edge."],
      fr: ["Nettoyage de surface — au pi²", "Prétraité, nettoyé au laveur de surface et rincé d'un bord à l'autre."],
      es: ["Limpieza de superficie — por pie²", "Pretratado, limpiado con limpiador de superficies y enjuagado de orilla a orilla."],
      it: ["Pulizia superficie — al piede quadro", "Pretrattato, pulito con lavasuperfici e risciacquato da bordo a bordo."],
      de: ["Flächenreinigung — pro sq ft", "Vorbehandelt, mit Flächenreiniger gesäubert und von Kante zu Kante gespült."],
      uk: ["Очищення поверхні — за кв. фут", "Попередньо оброблено, очищено поверхневою насадкою й прополоскано від краю до краю."],
      tl: ["Surface cleaning — kada sq ft", "Pre-treated, nilinis ng surface cleaner at binanlawan mula gilid hanggang gilid."],
    }, { measurementKey: "areaSqft" }),
    L.material(1, "sqft", 0.04, {
      en: ["Concrete cleaner — per sq ft", "Degreaser and mildew pre-treatment for concrete."],
      fr: ["Nettoyant à béton — au pi²", "Dégraissant et prétraitement antimoisissure pour béton."],
      es: ["Limpiador de concreto — por pie²", "Desengrasante y pretratamiento antimoho para concreto."],
      it: ["Detergente per calcestruzzo — al piede quadro", "Sgrassatore e pretrattamento antimuffa per calcestruzzo."],
      de: ["Betonreiniger — pro sq ft", "Entfetter und Schimmel-Vorbehandlung für Beton."],
      uk: ["Засіб для бетону — за кв. фут", "Знежирювач і обробка від цвілі для бетону."],
      tl: ["Concrete cleaner — kada sq ft", "Degreaser at pang-amag na pre-treatment sa kongkreto."],
    }, { cost: 0.02, measurementKey: "areaSqft" }),
  ], D.seasonal("percent", 10)),

  "fq.window_cleaning.windows.commercial": T("maintenance", n(
    ["Pulizia vetri e porte a vetro commerciali con davanzali", "Vetrine e porte a vetro di un'attività pulite con i davanzali passati."],
    ["Gewerbliche Fenster- und Glastürreinigung mit Bänken", "Schaufenster und Glastüren eines Geschäfts gereinigt, Fensterbänke gewischt."],
    ["Миття комерційних вікон і скляних дверей з підвіконнями", "Вітрини й скляні двері закладу вимито, підвіконня протерто."],
    ["Commercial na paglinis ng bintana at salaming pinto na may sill", "Nilinis ang storefront at salaming pinto ng negosyo at pinunasan ang sill."],
  ), [IN_OUT(9, 4.5)], D.regular("percent", 5)),
};

withTemplates(SEED, TEMPLATES);
