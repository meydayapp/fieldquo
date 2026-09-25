// app/data/planTemplateSeeds.js
//
// Starter maintenance plans for the trades where repeat work is the business —
// cleaning, carpet, windows, HVAC, plumbing, lawn, pest, pool, gutters,
// chimneys, irrigation, garage doors, janitorial, property care, house washing.
// Installed into a company's own ServicePlanTemplate rows by
// lib/servicePlans/seedTemplates.js, on the same three paths that seed a
// trade's services (signup, a trade switched on, "Add missing services") and
// from Settings → Maintenance plans. Only for companies of that trade, never
// overwriting a row the company already holds (matched by seedKey).
//
// ── Where the figures come from ─────────────────────────────────────────────
//
// Housecall Pro's per-industry plan templates (captured 2026-09-24): cleaning
// "Quarterly Deep Clean — $50/mo or $599/yr, 4 visits", "Monthly Maintenance —
// $125/mo or $1,499/yr, 12 visits"; carpet and window "$17/mo·$199/yr, 2
// visits" and "$30/mo·$349/yr, 4 visits"; plumbing $99 / $199 / $299 a year.
// HCP bills a flat fee; FieldQuo bills per visit (see ServicePlanTemplate in
// the schema), so each is re-expressed as a PER-VISIT price and a discount
// whose year lands on HCP's figure: $165 a visit less 10% = $148.50 × 4 =
// $594 a year, $49.50 a month. Trades HCP had no plan for (HVAC, lawn, pest,
// pool, gutters, chimney, irrigation, garage door, janitorial) carry round
// national-average visit prices in the same spirit.
//
// `usd` is a USD figure. lib/pricing/benchmarkFx.js converts it for a CAD
// company (rounded to $5, labelled a suggestion) and gives NULL for any other
// currency — such a template is installed unpriced and says "set your price";
// it is never given a placeholder. The price is written once, at install; the
// row is the company's from then on.
//
// `includes` names service seed keys (app/data/serviceSeeds). Resolved to the
// company's own Product ids at install, when it holds them — never created.
//
// Wording: hand-written in all eight document languages, like the checklist
// and service seeds. A benefit per line in `description`.

const PLAN = (key, trades, { frequency, visitCount, usd, discountPct, includes = [] }, name, description) => ({
  seedKey: `fq.plan.${key}`,
  trades,
  frequency,
  visitCount,
  usd,
  discountPct,
  includes,
  name,
  description,
});

export const PLAN_TEMPLATE_SEEDS = [
  // ── Home cleaning ────────────────────────────────────────────────────────
  PLAN("cleaning.quarterly_deep", ["residential_cleaning", "deep_cleaning"],
    { frequency: "quarterly", visitCount: 4, usd: 165, discountPct: 10 },
    {
      en: "Quarterly Deep Clean Plan",
      fr: "Forfait grand ménage trimestriel",
      es: "Plan de limpieza profunda trimestral",
      it: "Piano pulizia profonda trimestrale",
      de: "Vierteljährlicher Grundreinigungsplan",
      uk: "Щоквартальне генеральне прибирання",
      pa: "ਤਿਮਾਹੀ ਡੂੰਘੀ ਸਫ਼ਾਈ ਯੋਜਨਾ",
      tl: "Plano ng quarterly na malalim na paglilinis",
    },
    {
      en: "4 seasonal deep cleans a year\nInside appliances and cabinets included\nPriority scheduling",
      fr: "4 grands ménages saisonniers par année\nIntérieur des électroménagers et des armoires inclus\nPriorité à l'horaire",
      es: "4 limpiezas profundas de temporada al año\nInterior de electrodomésticos y gabinetes incluido\nPrioridad en la agenda",
      it: "4 pulizie profonde stagionali all'anno\nInterno di elettrodomestici e mobili incluso\nPriorità negli appuntamenti",
      de: "4 saisonale Grundreinigungen pro Jahr\nGeräte und Schränke innen inklusive\nBevorzugte Terminvergabe",
      uk: "4 сезонні генеральні прибирання на рік\nВсередині техніки та шаф — включено\nПріоритетний запис",
      pa: "ਸਾਲ ਵਿੱਚ 4 ਮੌਸਮੀ ਡੂੰਘੀਆਂ ਸਫ਼ਾਈਆਂ\nਉਪਕਰਣਾਂ ਅਤੇ ਅਲਮਾਰੀਆਂ ਦੇ ਅੰਦਰ ਦੀ ਸਫ਼ਾਈ ਸ਼ਾਮਲ\nਸਮਾਂ-ਸਾਰਣੀ ਵਿੱਚ ਪਹਿਲ",
      tl: "4 na seasonal na malalim na paglilinis bawat taon\nKasama ang loob ng mga appliance at kabinet\nUnang prayoridad sa iskedyul",
    }),
  PLAN("cleaning.monthly_maintenance", ["residential_cleaning"],
    { frequency: "monthly", visitCount: 12, usd: 145, discountPct: 15, includes: ["fq.residential_cleaning.core.routine_general"] },
    {
      en: "Monthly Maintenance Plan",
      fr: "Forfait d'entretien mensuel",
      es: "Plan de mantenimiento mensual",
      it: "Piano di manutenzione mensile",
      de: "Monatlicher Pflegeplan",
      uk: "Щомісячне обслуговування",
      pa: "ਮਹੀਨਾਵਾਰ ਰੱਖ-ਰਖਾਅ ਯੋਜਨਾ",
      tl: "Buwanang plano sa pagmementena",
    },
    {
      en: "12 cleans a year, one a month\nThe same crew, a checklist you can change\nPriority and flexible scheduling",
      fr: "12 ménages par année, un par mois\nLa même équipe, une liste que vous pouvez modifier\nHoraire prioritaire et souple",
      es: "12 limpiezas al año, una al mes\nEl mismo equipo y una lista que puede cambiar\nAgenda prioritaria y flexible",
      it: "12 pulizie all'anno, una al mese\nLa stessa squadra e una lista che può modificare\nAppuntamenti prioritari e flessibili",
      de: "12 Reinigungen im Jahr, eine pro Monat\nDasselbe Team, eine Checkliste nach Ihren Wünschen\nBevorzugte, flexible Termine",
      uk: "12 прибирань на рік, одне щомісяця\nТа сама бригада і список, який можна змінити\nПріоритетний і гнучкий запис",
      pa: "ਸਾਲ ਵਿੱਚ 12 ਸਫ਼ਾਈਆਂ, ਹਰ ਮਹੀਨੇ ਇੱਕ\nਉਹੀ ਟੀਮ, ਅਤੇ ਸੂਚੀ ਜੋ ਤੁਸੀਂ ਬਦਲ ਸਕਦੇ ਹੋ\nਪਹਿਲ ਅਤੇ ਲਚਕੀਲਾ ਸਮਾਂ",
      tl: "12 paglilinis bawat taon, isa kada buwan\nParehong crew at checklist na mapapalitan ninyo\nPrayoridad at flexible na iskedyul",
    }),

  // ── Carpet ───────────────────────────────────────────────────────────────
  PLAN("carpet.seasonal", ["carpet_cleaning"],
    { frequency: "semiannual", visitCount: 2, usd: 110, discountPct: 10, includes: ["fq.carpet_cleaning.carpet.recurring"] },
    {
      en: "Seasonal Carpet Clean Plan",
      fr: "Forfait nettoyage de tapis saisonnier",
      es: "Plan de limpieza de alfombras de temporada",
      it: "Piano pulizia moquette stagionale",
      de: "Saisonaler Teppichreinigungsplan",
      uk: "Сезонне чищення килимів",
      pa: "ਮੌਸਮੀ ਕਾਰਪੇਟ ਸਫ਼ਾਈ ਯੋਜਨਾ",
      tl: "Seasonal na plano sa paglilinis ng karpet",
    },
    {
      en: "Spring and fall hot-water extraction\nSpot treatment on every visit\nPriority booking",
      fr: "Extraction à l'eau chaude au printemps et à l'automne\nDétachage à chaque visite\nRéservation prioritaire",
      es: "Extracción con agua caliente en primavera y otoño\nTratamiento de manchas en cada visita\nReserva prioritaria",
      it: "Estrazione ad acqua calda in primavera e in autunno\nTrattamento delle macchie a ogni visita\nPrenotazione prioritaria",
      de: "Heißwasser-Sprühextraktion im Frühling und Herbst\nFleckbehandlung bei jedem Termin\nBevorzugte Terminbuchung",
      uk: "Екстракція гарячою водою навесні та восени\nВиведення плям на кожному візиті\nПріоритетний запис",
      pa: "ਬਸੰਤ ਅਤੇ ਪਤਝੜ ਵਿੱਚ ਗਰਮ ਪਾਣੀ ਨਾਲ ਸਫ਼ਾਈ\nਹਰ ਫੇਰੀ 'ਤੇ ਦਾਗ਼ਾਂ ਦਾ ਇਲਾਜ\nਬੁਕਿੰਗ ਵਿੱਚ ਪਹਿਲ",
      tl: "Hot-water extraction tuwing tagsibol at taglagas\nPaggamot ng mantsa sa bawat bisita\nPrayoridad sa booking",
    }),
  PLAN("carpet.quarterly_refresh", ["carpet_cleaning"],
    { frequency: "quarterly", visitCount: 4, usd: 100, discountPct: 15, includes: ["fq.carpet_cleaning.carpet.recurring"] },
    {
      en: "Quarterly Carpet Refresh Plan",
      fr: "Forfait rafraîchissement de tapis trimestriel",
      es: "Plan trimestral de renovación de alfombras",
      it: "Piano trimestrale di rinnovo moquette",
      de: "Vierteljährlicher Teppichauffrischungsplan",
      uk: "Щоквартальне освіження килимів",
      pa: "ਤਿਮਾਹੀ ਕਾਰਪੇਟ ਤਾਜ਼ਗੀ ਯੋਜਨਾ",
      tl: "Quarterly na plano sa pagpapapresko ng karpet",
    },
    {
      en: "A cleaning every three months for high-traffic areas\nSpot and odour treatment included\nPriority booking",
      fr: "Un nettoyage aux trois mois pour les zones passantes\nDétachage et traitement des odeurs inclus\nRéservation prioritaire",
      es: "Una limpieza cada tres meses en zonas de mucho tránsito\nTratamiento de manchas y olores incluido\nReserva prioritaria",
      it: "Una pulizia ogni tre mesi per le zone di passaggio\nTrattamento di macchie e odori incluso\nPrenotazione prioritaria",
      de: "Alle drei Monate eine Reinigung der Laufzonen\nFleck- und Geruchsbehandlung inklusive\nBevorzugte Terminbuchung",
      uk: "Чищення кожні три місяці для прохідних зон\nВиведення плям і запахів включено\nПріоритетний запис",
      pa: "ਵੱਧ ਆਵਾਜਾਈ ਵਾਲੀਆਂ ਥਾਵਾਂ ਦੀ ਹਰ ਤਿੰਨ ਮਹੀਨੇ ਸਫ਼ਾਈ\nਦਾਗ਼ ਅਤੇ ਬਦਬੂ ਦਾ ਇਲਾਜ ਸ਼ਾਮਲ\nਬੁਕਿੰਗ ਵਿੱਚ ਪਹਿਲ",
      tl: "Paglilinis kada tatlong buwan sa mga daanang madalas lakaran\nKasama ang paggamot sa mantsa at amoy\nPrayoridad sa booking",
    }),

  // ── Windows ──────────────────────────────────────────────────────────────
  PLAN("window.seasonal", ["window_cleaning"],
    { frequency: "semiannual", visitCount: 2, usd: 110, discountPct: 10, includes: ["fq.window_cleaning.windows.recurring"] },
    {
      en: "Seasonal Window Plan",
      fr: "Forfait lavage de vitres saisonnier",
      es: "Plan de ventanas de temporada",
      it: "Piano finestre stagionale",
      de: "Saisonaler Fensterreinigungsplan",
      uk: "Сезонне миття вікон",
      pa: "ਮੌਸਮੀ ਖਿੜਕੀ ਸਫ਼ਾਈ ਯੋਜਨਾ",
      tl: "Seasonal na plano sa paglilinis ng bintana",
    },
    {
      en: "Spring and fall window cleaning, inside and out\nFrames, sills and tracks wiped\nPriority booking",
      fr: "Lavage des vitres intérieur et extérieur au printemps et à l'automne\nCadres, rebords et glissières essuyés\nRéservation prioritaire",
      es: "Limpieza de ventanas por dentro y por fuera en primavera y otoño\nMarcos, alféizares y rieles limpios\nReserva prioritaria",
      it: "Pulizia vetri dentro e fuori in primavera e in autunno\nTelai, davanzali e binari puliti\nPrenotazione prioritaria",
      de: "Fensterreinigung innen und außen im Frühling und Herbst\nRahmen, Fensterbänke und Schienen gewischt\nBevorzugte Terminbuchung",
      uk: "Миття вікон зсередини і ззовні навесні та восени\nРами, підвіконня та напрямні протерті\nПріоритетний запис",
      pa: "ਬਸੰਤ ਅਤੇ ਪਤਝੜ ਵਿੱਚ ਖਿੜਕੀਆਂ ਦੀ ਅੰਦਰੋਂ-ਬਾਹਰੋਂ ਸਫ਼ਾਈ\nਫ਼ਰੇਮ, ਸਿਲ ਅਤੇ ਟਰੈਕ ਸਾਫ਼\nਬੁਕਿੰਗ ਵਿੱਚ ਪਹਿਲ",
      tl: "Paglilinis ng bintana sa loob at labas tuwing tagsibol at taglagas\nPinupunasan ang frame, pasamano at riles\nPrayoridad sa booking",
    }),
  PLAN("window.quarterly_exterior", ["window_cleaning"],
    { frequency: "quarterly", visitCount: 4, usd: 100, discountPct: 15, includes: ["fq.window_cleaning.windows.exterior_glass_frames"] },
    {
      en: "Quarterly Exterior Window Plan",
      fr: "Forfait vitres extérieures trimestriel",
      es: "Plan trimestral de ventanas exteriores",
      it: "Piano trimestrale finestre esterne",
      de: "Vierteljährlicher Außenfensterplan",
      uk: "Щоквартальне миття вікон ззовні",
      pa: "ਤਿਮਾਹੀ ਬਾਹਰੀ ਖਿੜਕੀ ਯੋਜਨਾ",
      tl: "Quarterly na plano sa labas ng bintana",
    },
    {
      en: "Exterior glass and frames every three months\nScreens brushed and rinsed\nPriority booking",
      fr: "Vitres et cadres extérieurs aux trois mois\nMoustiquaires brossées et rincées\nRéservation prioritaire",
      es: "Vidrios y marcos exteriores cada tres meses\nMosquiteros cepillados y enjuagados\nReserva prioritaria",
      it: "Vetri e telai esterni ogni tre mesi\nZanzariere spazzolate e risciacquate\nPrenotazione prioritaria",
      de: "Außenglas und Rahmen alle drei Monate\nFliegengitter gebürstet und abgespült\nBevorzugte Terminbuchung",
      uk: "Зовнішнє скло та рами кожні три місяці\nСітки почищені та промиті\nПріоритетний запис",
      pa: "ਹਰ ਤਿੰਨ ਮਹੀਨੇ ਬਾਹਰੀ ਸ਼ੀਸ਼ਾ ਅਤੇ ਫ਼ਰੇਮ\nਜਾਲੀਆਂ ਬੁਰਸ਼ ਕਰਕੇ ਧੋਤੀਆਂ\nਬੁਕਿੰਗ ਵਿੱਚ ਪਹਿਲ",
      tl: "Salamin at frame sa labas kada tatlong buwan\nSinisipilyo at binabanlawan ang mga screen\nPrayoridad sa booking",
    }),

  // ── Plumbing ─────────────────────────────────────────────────────────────
  PLAN("plumbing.maintenance", ["plumbing"],
    { frequency: "annual", visitCount: 1, usd: 110, discountPct: 10 },
    {
      en: "Plumbing Maintenance Plan",
      fr: "Forfait d'entretien de plomberie",
      es: "Plan de mantenimiento de plomería",
      it: "Piano di manutenzione idraulica",
      de: "Sanitär-Wartungsplan",
      uk: "План обслуговування сантехніки",
      pa: "ਪਲੰਬਿੰਗ ਰੱਖ-ਰਖਾਅ ਯੋਜਨਾ",
      tl: "Plano sa pagmementena ng tubero",
    },
    {
      en: "Annual whole-home plumbing inspection\nWater heater check\nWritten findings after every visit",
      fr: "Inspection annuelle de la plomberie de toute la maison\nVérification du chauffe-eau\nRapport écrit après chaque visite",
      es: "Inspección anual de la plomería de toda la casa\nRevisión del calentador de agua\nInforme escrito después de cada visita",
      it: "Ispezione annuale dell'impianto idraulico di tutta la casa\nControllo dello scaldabagno\nResoconto scritto dopo ogni visita",
      de: "Jährliche Prüfung der gesamten Hausinstallation\nCheck des Warmwasserbereiters\nSchriftlicher Befund nach jedem Termin",
      uk: "Щорічна перевірка сантехніки всього будинку\nПеревірка водонагрівача\nПисьмовий звіт після кожного візиту",
      pa: "ਪੂਰੇ ਘਰ ਦੀ ਪਲੰਬਿੰਗ ਦੀ ਸਾਲਾਨਾ ਜਾਂਚ\nਵਾਟਰ ਹੀਟਰ ਦੀ ਜਾਂਚ\nਹਰ ਫੇਰੀ ਤੋਂ ਬਾਅਦ ਲਿਖਤੀ ਰਿਪੋਰਟ",
      tl: "Taunang inspeksyon ng tubero sa buong bahay\nPagsusuri ng water heater\nNakasulat na ulat pagkatapos ng bawat bisita",
    }),
  PLAN("plumbing.care", ["plumbing"],
    { frequency: "semiannual", visitCount: 2, usd: 115, discountPct: 15 },
    {
      en: "Plumbing Care Plan",
      fr: "Forfait soins de plomberie",
      es: "Plan de cuidado de plomería",
      it: "Piano cura impianto idraulico",
      de: "Sanitär-Pflegeplan",
      uk: "План догляду за сантехнікою",
      pa: "ਪਲੰਬਿੰਗ ਦੇਖਭਾਲ ਯੋਜਨਾ",
      tl: "Plano sa pag-aalaga ng tubero",
    },
    {
      en: "Spring and fall check-ups\nFixtures, shut-offs and drains tested\nPriority scheduling",
      fr: "Vérifications au printemps et à l'automne\nAppareils, robinets d'arrêt et drains testés\nPriorité à l'horaire",
      es: "Revisiones en primavera y otoño\nPrueba de accesorios, llaves de paso y desagües\nPrioridad en la agenda",
      it: "Controlli in primavera e in autunno\nSanitari, rubinetti d'arresto e scarichi verificati\nPriorità negli appuntamenti",
      de: "Checks im Frühling und Herbst\nArmaturen, Absperrventile und Abflüsse geprüft\nBevorzugte Terminvergabe",
      uk: "Огляди навесні та восени\nПеревірка приладів, запірних кранів і стоків\nПріоритетний запис",
      pa: "ਬਸੰਤ ਅਤੇ ਪਤਝੜ ਵਿੱਚ ਜਾਂਚ\nਫਿਕਸਚਰ, ਸ਼ੱਟ-ਆਫ਼ ਅਤੇ ਨਾਲੀਆਂ ਦੀ ਜਾਂਚ\nਸਮਾਂ-ਸਾਰਣੀ ਵਿੱਚ ਪਹਿਲ",
      tl: "Pagsusuri tuwing tagsibol at taglagas\nSinusubukan ang mga fixture, shut-off at alulod\nPrayoridad sa iskedyul",
    }),
  PLAN("plumbing.total_care", ["plumbing"],
    { frequency: "semiannual", visitCount: 2, usd: 185, discountPct: 20 },
    {
      en: "Plumbing Total Care Plan",
      fr: "Forfait plomberie tout inclus",
      es: "Plan de cuidado total de plomería",
      it: "Piano idraulico completo",
      de: "Sanitär-Rundum-Plan",
      uk: "Повний план догляду за сантехнікою",
      pa: "ਪਲੰਬਿੰਗ ਪੂਰੀ ਦੇਖਭਾਲ ਯੋਜਨਾ",
      tl: "Kumpletong plano sa pag-aalaga ng tubero",
    },
    {
      en: "Spring and fall check-ups\nAnnual water heater flush\nPriority emergency response",
      fr: "Vérifications au printemps et à l'automne\nVidange annuelle du chauffe-eau\nIntervention d'urgence prioritaire",
      es: "Revisiones en primavera y otoño\nLavado anual del calentador de agua\nAtención prioritaria de emergencias",
      it: "Controlli in primavera e in autunno\nLavaggio annuale dello scaldabagno\nIntervento d'emergenza prioritario",
      de: "Checks im Frühling und Herbst\nJährliche Spülung des Warmwasserbereiters\nBevorzugter Notdienst",
      uk: "Огляди навесні та восени\nЩорічне промивання водонагрівача\nПріоритетний аварійний виїзд",
      pa: "ਬਸੰਤ ਅਤੇ ਪਤਝੜ ਵਿੱਚ ਜਾਂਚ\nਵਾਟਰ ਹੀਟਰ ਦੀ ਸਾਲਾਨਾ ਫ਼ਲੱਸ਼ਿੰਗ\nਐਮਰਜੈਂਸੀ ਵਿੱਚ ਪਹਿਲ",
      tl: "Pagsusuri tuwing tagsibol at taglagas\nTaunang flush ng water heater\nPrayoridad sa emergency",
    }),

  // ── HVAC ─────────────────────────────────────────────────────────────────
  PLAN("hvac.comfort_club", ["hvac_repair", "hvac_install"],
    { frequency: "semiannual", visitCount: 2, usd: 129, discountPct: 15, includes: ["fq.hvac_repair.maintenance.ac_tune_up", "fq.hvac_repair.maintenance.furnace_maintenance"] },
    {
      en: "Heating & Cooling Tune-Up Plan",
      fr: "Forfait mise au point chauffage et climatisation",
      es: "Plan de puesta a punto de calefacción y aire",
      it: "Piano di messa a punto riscaldamento e climatizzazione",
      de: "Heizungs- und Klima-Wartungsplan",
      uk: "План налаштування опалення та кондиціювання",
      pa: "ਹੀਟਿੰਗ ਅਤੇ ਕੂਲਿੰਗ ਟਿਊਨ-ਅੱਪ ਯੋਜਨਾ",
      tl: "Plano sa tune-up ng heating at cooling",
    },
    {
      en: "Air-conditioning tune-up in spring\nFurnace tune-up in fall\nFilter check and priority service",
      fr: "Mise au point de la climatisation au printemps\nMise au point de la fournaise à l'automne\nVérification du filtre et service prioritaire",
      es: "Puesta a punto del aire acondicionado en primavera\nPuesta a punto de la calefacción en otoño\nRevisión del filtro y servicio prioritario",
      it: "Messa a punto del climatizzatore in primavera\nMessa a punto della caldaia in autunno\nControllo del filtro e assistenza prioritaria",
      de: "Klimaanlagen-Wartung im Frühling\nHeizungs-Wartung im Herbst\nFilterprüfung und bevorzugter Service",
      uk: "Налаштування кондиціонера навесні\nНалаштування котла восени\nПеревірка фільтра та пріоритетне обслуговування",
      pa: "ਬਸੰਤ ਵਿੱਚ ਏਅਰ-ਕੰਡੀਸ਼ਨਿੰਗ ਟਿਊਨ-ਅੱਪ\nਪਤਝੜ ਵਿੱਚ ਫ਼ਰਨੇਸ ਟਿਊਨ-ਅੱਪ\nਫ਼ਿਲਟਰ ਜਾਂਚ ਅਤੇ ਪਹਿਲ ਵਾਲੀ ਸੇਵਾ",
      tl: "Tune-up ng aircon tuwing tagsibol\nTune-up ng furnace tuwing taglagas\nPagsusuri ng filter at prayoridad na serbisyo",
    }),
  PLAN("hvac.annual_tune_up", ["hvac_repair", "hvac_install"],
    { frequency: "annual", visitCount: 1, usd: 149, discountPct: 10, includes: ["fq.hvac_repair.maintenance.furnace_maintenance"] },
    {
      en: "Annual Furnace Tune-Up Plan",
      fr: "Forfait mise au point annuelle de la fournaise",
      es: "Plan anual de puesta a punto de la calefacción",
      it: "Piano annuale di messa a punto della caldaia",
      de: "Jährlicher Heizungs-Wartungsplan",
      uk: "Щорічне налаштування котла",
      pa: "ਸਾਲਾਨਾ ਫ਼ਰਨੇਸ ਟਿਊਨ-ਅੱਪ ਯੋਜਨਾ",
      tl: "Taunang plano sa tune-up ng furnace",
    },
    {
      en: "One full heating tune-up a year, before winter\nSafety and carbon-monoxide check\nFilter check",
      fr: "Une mise au point complète du chauffage par année, avant l'hiver\nVérification de sécurité et du monoxyde de carbone\nVérification du filtre",
      es: "Una puesta a punto completa de la calefacción al año, antes del invierno\nRevisión de seguridad y de monóxido de carbono\nRevisión del filtro",
      it: "Una messa a punto completa del riscaldamento all'anno, prima dell'inverno\nControllo di sicurezza e del monossido di carbonio\nControllo del filtro",
      de: "Eine vollständige Heizungswartung pro Jahr, vor dem Winter\nSicherheits- und Kohlenmonoxid-Prüfung\nFilterprüfung",
      uk: "Одне повне налаштування опалення на рік, перед зимою\nПеревірка безпеки та чадного газу\nПеревірка фільтра",
      pa: "ਸਰਦੀ ਤੋਂ ਪਹਿਲਾਂ ਸਾਲ ਵਿੱਚ ਇੱਕ ਪੂਰਾ ਹੀਟਿੰਗ ਟਿਊਨ-ਅੱਪ\nਸੁਰੱਖਿਆ ਅਤੇ ਕਾਰਬਨ-ਮੋਨੋਆਕਸਾਈਡ ਜਾਂਚ\nਫ਼ਿਲਟਰ ਜਾਂਚ",
      tl: "Isang buong tune-up ng heating bawat taon, bago ang taglamig\nPagsusuri sa kaligtasan at carbon monoxide\nPagsusuri ng filter",
    }),

  // ── Lawn ─────────────────────────────────────────────────────────────────
  PLAN("lawn.weekly_mowing", ["lawn_care", "lawn_mowing"],
    { frequency: "weekly", visitCount: 26, usd: 55, discountPct: 10, includes: ["fq.lawn_care.core.lawn_mowing"] },
    {
      en: "Weekly Mowing Season Plan",
      fr: "Forfait tonte hebdomadaire de la saison",
      es: "Plan de corte semanal de temporada",
      it: "Piano taglio settimanale di stagione",
      de: "Wöchentlicher Mähplan für die Saison",
      uk: "Щотижневе косіння на сезон",
      pa: "ਹਫ਼ਤਾਵਾਰ ਘਾਹ ਕਟਾਈ ਸੀਜ਼ਨ ਯੋਜਨਾ",
      tl: "Lingguhang plano sa paggapas sa buong season",
    },
    {
      en: "26 weekly mows through the growing season\nTrimming and edging on every visit\nClippings blown off paths and driveway",
      fr: "26 tontes hebdomadaires pendant la saison de pousse\nTaille des bordures à chaque visite\nRésidus soufflés hors des allées et de l'entrée",
      es: "26 cortes semanales durante la temporada de crecimiento\nRecorte y bordes en cada visita\nRestos soplados de senderos y entrada",
      it: "26 tagli settimanali durante la stagione di crescita\nRifinitura dei bordi a ogni visita\nSfalci soffiati via da vialetti e passo carraio",
      de: "26 wöchentliche Schnitte in der Wachstumssaison\nTrimmen und Kantenschnitt bei jedem Termin\nSchnittgut von Wegen und Einfahrt geblasen",
      uk: "26 щотижневих косінь протягом сезону\nПідрізання та окантовка на кожному візиті\nТраву здуваємо з доріжок і під'їзду",
      pa: "ਵਧਣ ਦੇ ਸੀਜ਼ਨ ਦੌਰਾਨ 26 ਹਫ਼ਤਾਵਾਰ ਕਟਾਈਆਂ\nਹਰ ਫੇਰੀ 'ਤੇ ਕਿਨਾਰਿਆਂ ਦੀ ਕਟਾਈ\nਰਸਤਿਆਂ ਅਤੇ ਡਰਾਈਵਵੇਅ ਤੋਂ ਘਾਹ ਉਡਾਇਆ ਜਾਂਦਾ ਹੈ",
      tl: "26 na lingguhang paggapas sa buong growing season\nPag-trim at edging sa bawat bisita\nHinihipan ang damo mula sa daanan at driveway",
    }),
  PLAN("lawn.treatment_program", ["lawn_care"],
    { frequency: "monthly", visitCount: 6, usd: 75, discountPct: 10, includes: ["fq.lawn_care.maintenance.seasonal_lawn_treatment"] },
    {
      en: "Seasonal Lawn Treatment Program",
      fr: "Programme de traitement de pelouse saisonnier",
      es: "Programa de tratamiento de césped de temporada",
      it: "Programma stagionale di trattamento del prato",
      de: "Saisonales Rasenpflegeprogramm",
      uk: "Сезонна програма догляду за газоном",
      pa: "ਮੌਸਮੀ ਲਾਅਨ ਇਲਾਜ ਪ੍ਰੋਗਰਾਮ",
      tl: "Seasonal na programa sa paggamot ng damuhan",
    },
    {
      en: "6 monthly treatments, spring to fall\nFertiliser and weed control timed to the season\nLawn health check on every visit",
      fr: "6 traitements mensuels, du printemps à l'automne\nEngrais et désherbage selon la saison\nBilan de la pelouse à chaque visite",
      es: "6 tratamientos mensuales, de primavera a otoño\nFertilizante y control de malezas según la temporada\nRevisión del césped en cada visita",
      it: "6 trattamenti mensili, dalla primavera all'autunno\nConcime e diserbo in base alla stagione\nControllo del prato a ogni visita",
      de: "6 monatliche Behandlungen, Frühling bis Herbst\nDünger und Unkrautbekämpfung passend zur Saison\nRasen-Check bei jedem Termin",
      uk: "6 щомісячних обробок, з весни до осені\nДобрива та боротьба з бур'янами за сезоном\nОгляд газону на кожному візиті",
      pa: "ਬਸੰਤ ਤੋਂ ਪਤਝੜ ਤੱਕ 6 ਮਹੀਨਾਵਾਰ ਇਲਾਜ\nਮੌਸਮ ਅਨੁਸਾਰ ਖਾਦ ਅਤੇ ਨਦੀਨ ਕੰਟਰੋਲ\nਹਰ ਫੇਰੀ 'ਤੇ ਲਾਅਨ ਦੀ ਜਾਂਚ",
      tl: "6 na buwanang paggamot, mula tagsibol hanggang taglagas\nPataba at pagkontrol ng damo ayon sa season\nPagsusuri ng damuhan sa bawat bisita",
    }),

  // ── Pest control ─────────────────────────────────────────────────────────
  PLAN("pest.quarterly", ["pest_control"],
    { frequency: "quarterly", visitCount: 4, usd: 140, discountPct: 15 },
    {
      en: "Quarterly Pest Protection Plan",
      fr: "Forfait protection antiparasitaire trimestriel",
      es: "Plan trimestral de protección contra plagas",
      it: "Piano trimestrale di protezione dai parassiti",
      de: "Vierteljährlicher Schädlingsschutzplan",
      uk: "Щоквартальний захист від шкідників",
      pa: "ਤਿਮਾਹੀ ਕੀਟ ਸੁਰੱਖਿਆ ਯੋਜਨਾ",
      tl: "Quarterly na plano laban sa peste",
    },
    {
      en: "Exterior perimeter treatment every three months\nInterior treatment when needed\nFree re-service between visits",
      fr: "Traitement du périmètre extérieur aux trois mois\nTraitement intérieur au besoin\nRetour gratuit entre les visites",
      es: "Tratamiento del perímetro exterior cada tres meses\nTratamiento interior cuando haga falta\nRepaso gratuito entre visitas",
      it: "Trattamento del perimetro esterno ogni tre mesi\nTrattamento interno quando serve\nIntervento aggiuntivo gratuito tra le visite",
      de: "Außenbehandlung rund ums Haus alle drei Monate\nInnenbehandlung bei Bedarf\nKostenlose Nachbehandlung zwischen den Terminen",
      uk: "Обробка зовнішнього периметра кожні три місяці\nОбробка всередині за потреби\nБезкоштовний повторний виїзд між візитами",
      pa: "ਹਰ ਤਿੰਨ ਮਹੀਨੇ ਬਾਹਰੀ ਘੇਰੇ ਦਾ ਇਲਾਜ\nਲੋੜ ਪੈਣ 'ਤੇ ਅੰਦਰੂਨੀ ਇਲਾਜ\nਫੇਰੀਆਂ ਵਿਚਕਾਰ ਮੁਫ਼ਤ ਦੁਬਾਰਾ ਸੇਵਾ",
      tl: "Paggamot sa paligid ng bahay kada tatlong buwan\nPaggamot sa loob kung kailangan\nLibreng pagbalik sa pagitan ng mga bisita",
    }),

  // ── Pools ────────────────────────────────────────────────────────────────
  PLAN("pool.weekly_service", ["pool_spa"],
    { frequency: "weekly", visitCount: null, usd: 95, discountPct: 10 },
    {
      en: "Weekly Pool Service Plan",
      fr: "Forfait entretien de piscine hebdomadaire",
      es: "Plan de servicio semanal de piscina",
      it: "Piano di servizio piscina settimanale",
      de: "Wöchentlicher Pool-Serviceplan",
      uk: "Щотижневе обслуговування басейну",
      pa: "ਹਫ਼ਤਾਵਾਰ ਪੂਲ ਸੇਵਾ ਯੋਜਨਾ",
      tl: "Lingguhang plano sa serbisyo ng pool",
    },
    {
      en: "Water tested and balanced every week\nSkim, brush and vacuum\nFilter and equipment check",
      fr: "Eau testée et équilibrée chaque semaine\nÉcumage, brossage et aspiration\nVérification du filtre et de l'équipement",
      es: "Agua analizada y equilibrada cada semana\nDesnatado, cepillado y aspirado\nRevisión del filtro y del equipo",
      it: "Acqua analizzata e bilanciata ogni settimana\nSchiumatura, spazzolatura e aspirazione\nControllo di filtro e attrezzature",
      de: "Wasser jede Woche getestet und eingestellt\nAbschöpfen, Bürsten und Saugen\nFilter- und Technikprüfung",
      uk: "Щотижневий аналіз і балансування води\nЗбирання сміття, чищення щіткою та пилососом\nПеревірка фільтра та обладнання",
      pa: "ਹਰ ਹਫ਼ਤੇ ਪਾਣੀ ਦੀ ਜਾਂਚ ਅਤੇ ਸੰਤੁਲਨ\nਸਕਿਮਿੰਗ, ਬੁਰਸ਼ ਅਤੇ ਵੈਕਿਊਮ\nਫ਼ਿਲਟਰ ਅਤੇ ਉਪਕਰਣ ਦੀ ਜਾਂਚ",
      tl: "Sinusuri at binabalanse ang tubig linggo-linggo\nSkim, sipilyo at vacuum\nPagsusuri ng filter at kagamitan",
    }),
  PLAN("pool.open_close", ["pool_spa"],
    { frequency: "semiannual", visitCount: 2, usd: 250, discountPct: 10 },
    {
      en: "Pool Opening & Closing Plan",
      fr: "Forfait ouverture et fermeture de piscine",
      es: "Plan de apertura y cierre de piscina",
      it: "Piano apertura e chiusura piscina",
      de: "Pool-Plan für Saisonstart und Einwinterung",
      uk: "Відкриття та консервація басейну",
      pa: "ਪੂਲ ਖੋਲ੍ਹਣ ਅਤੇ ਬੰਦ ਕਰਨ ਦੀ ਯੋਜਨਾ",
      tl: "Plano sa pagbubukas at pagsasara ng pool",
    },
    {
      en: "Spring opening: cover off, start-up, water balanced\nFall closing: winterised and covered\nEquipment check at both visits",
      fr: "Ouverture au printemps : toile retirée, mise en marche, eau équilibrée\nFermeture à l'automne : hivernisation et toile posée\nVérification de l'équipement aux deux visites",
      es: "Apertura en primavera: cubierta retirada, arranque y agua equilibrada\nCierre en otoño: preparación para el invierno y cubierta\nRevisión del equipo en ambas visitas",
      it: "Apertura in primavera: telo tolto, avvio, acqua bilanciata\nChiusura in autunno: svernamento e copertura\nControllo delle attrezzature a entrambe le visite",
      de: "Frühjahrsstart: Abdeckung ab, Inbetriebnahme, Wasser eingestellt\nHerbst: winterfest gemacht und abgedeckt\nTechnikprüfung bei beiden Terminen",
      uk: "Весняне відкриття: зняття накриття, запуск, баланс води\nОсіння консервація: підготовка до зими та накриття\nПеревірка обладнання на обох візитах",
      pa: "ਬਸੰਤ ਵਿੱਚ ਖੋਲ੍ਹਣਾ: ਕਵਰ ਹਟਾਉਣਾ, ਚਾਲੂ ਕਰਨਾ, ਪਾਣੀ ਸੰਤੁਲਿਤ\nਪਤਝੜ ਵਿੱਚ ਬੰਦ ਕਰਨਾ: ਸਰਦੀਆਂ ਲਈ ਤਿਆਰ ਅਤੇ ਢੱਕਿਆ\nਦੋਵੇਂ ਫੇਰੀਆਂ 'ਤੇ ਉਪਕਰਣ ਦੀ ਜਾਂਚ",
      tl: "Pagbubukas sa tagsibol: tanggal ang takip, pag-start, balanse ang tubig\nPagsasara sa taglagas: inihahanda sa taglamig at tinatakpan\nPagsusuri ng kagamitan sa parehong bisita",
    }),

  // ── Gutters ──────────────────────────────────────────────────────────────
  PLAN("gutter.spring_fall", ["gutter_services"],
    { frequency: "semiannual", visitCount: 2, usd: 175, discountPct: 10, includes: ["fq.window_cleaning.exterior.gutter_cleaning"] },
    {
      en: "Spring & Fall Gutter Plan",
      fr: "Forfait gouttières printemps et automne",
      es: "Plan de canalones de primavera y otoño",
      it: "Piano grondaie primavera e autunno",
      de: "Dachrinnenplan Frühling & Herbst",
      uk: "Чищення ринв навесні та восени",
      pa: "ਬਸੰਤ ਅਤੇ ਪਤਝੜ ਗਟਰ ਯੋਜਨਾ",
      tl: "Plano sa alulod tuwing tagsibol at taglagas",
    },
    {
      en: "Gutters cleared in spring and after the leaves fall\nDownspouts flushed\nPhotos of any damage found",
      fr: "Gouttières vidées au printemps et après la chute des feuilles\nDescentes pluviales rincées\nPhotos de tout dommage constaté",
      es: "Canalones limpios en primavera y tras la caída de las hojas\nBajantes enjuagados\nFotos de cualquier daño encontrado",
      it: "Grondaie pulite in primavera e dopo la caduta delle foglie\nPluviali lavati\nFoto di eventuali danni riscontrati",
      de: "Dachrinnen im Frühling und nach dem Laubfall geräumt\nFallrohre gespült\nFotos von festgestellten Schäden",
      uk: "Ринви чистимо навесні та після листопаду\nВодостічні труби промиваємо\nФото будь-яких виявлених пошкоджень",
      pa: "ਬਸੰਤ ਵਿੱਚ ਅਤੇ ਪੱਤੇ ਡਿੱਗਣ ਤੋਂ ਬਾਅਦ ਗਟਰ ਸਾਫ਼\nਡਾਊਨਸਪਾਊਟ ਧੋਤੇ ਜਾਂਦੇ ਹਨ\nਮਿਲੇ ਕਿਸੇ ਵੀ ਨੁਕਸਾਨ ਦੀਆਂ ਫ਼ੋਟੋਆਂ",
      tl: "Nililinis ang alulod tuwing tagsibol at pagkatapos malaglag ang mga dahon\nBinabanlawan ang mga downspout\nMay litrato ng anumang sirang makita",
    }),

  // ── Chimney ──────────────────────────────────────────────────────────────
  PLAN("chimney.annual", ["chimney_sweep"],
    { frequency: "annual", visitCount: 1, usd: 250, discountPct: 10 },
    {
      en: "Annual Chimney Sweep & Inspection Plan",
      fr: "Forfait ramonage et inspection annuels",
      es: "Plan anual de deshollinado e inspección",
      it: "Piano annuale di pulizia e ispezione della canna fumaria",
      de: "Jährlicher Kaminkehr- und Inspektionsplan",
      uk: "Щорічне чищення та огляд димоходу",
      pa: "ਸਾਲਾਨਾ ਚਿਮਨੀ ਸਫ਼ਾਈ ਅਤੇ ਜਾਂਚ ਯੋਜਨਾ",
      tl: "Taunang plano sa paglilinis at inspeksyon ng tsimenea",
    },
    {
      en: "Full sweep once a year, before the burning season\nFlue and cap inspection\nWritten report with photos",
      fr: "Ramonage complet une fois par année, avant la saison de chauffage\nInspection du conduit et du chapeau\nRapport écrit avec photos",
      es: "Deshollinado completo una vez al año, antes de la temporada de uso\nInspección del conducto y la tapa\nInforme escrito con fotos",
      it: "Pulizia completa una volta l'anno, prima della stagione d'uso\nIspezione di canna e comignolo\nRelazione scritta con foto",
      de: "Vollständige Reinigung einmal im Jahr, vor der Heizsaison\nPrüfung von Zug und Kaminhaube\nSchriftlicher Bericht mit Fotos",
      uk: "Повне чищення раз на рік, перед опалювальним сезоном\nОгляд димоходу та ковпака\nПисьмовий звіт із фото",
      pa: "ਅੱਗ ਬਾਲਣ ਦੇ ਮੌਸਮ ਤੋਂ ਪਹਿਲਾਂ ਸਾਲ ਵਿੱਚ ਇੱਕ ਵਾਰ ਪੂਰੀ ਸਫ਼ਾਈ\nਫ਼ਲੂ ਅਤੇ ਕੈਪ ਦੀ ਜਾਂਚ\nਫ਼ੋਟੋਆਂ ਸਮੇਤ ਲਿਖਤੀ ਰਿਪੋਰਟ",
      tl: "Buong paglilinis isang beses bawat taon, bago ang panahon ng paggamit\nInspeksyon ng flue at takip\nNakasulat na ulat na may litrato",
    }),

  // ── Irrigation ───────────────────────────────────────────────────────────
  PLAN("irrigation.seasonal", ["irrigation"],
    { frequency: "semiannual", visitCount: 2, usd: 95, discountPct: 10 },
    {
      en: "Sprinkler Start-Up & Winterization Plan",
      fr: "Forfait mise en marche et hivernisation de l'arrosage",
      es: "Plan de arranque e invernización de riego",
      it: "Piano di avvio e svernamento dell'irrigazione",
      de: "Beregnungsplan: Inbetriebnahme & Winterfestmachung",
      uk: "Запуск і консервація поливу",
      pa: "ਸਪ੍ਰਿੰਕਲਰ ਚਾਲੂ ਕਰਨ ਅਤੇ ਸਰਦੀਆਂ ਲਈ ਤਿਆਰੀ ਯੋਜਨਾ",
      tl: "Plano sa pag-start at pag-winterize ng sprinkler",
    },
    {
      en: "Spring start-up and zone check\nFall blow-out before the freeze\nHeads adjusted at both visits",
      fr: "Mise en marche au printemps et vérification des zones\nPurge à l'air à l'automne avant le gel\nTêtes ajustées aux deux visites",
      es: "Arranque en primavera y revisión de zonas\nPurgado con aire en otoño antes de las heladas\nAspersores ajustados en ambas visitas",
      it: "Avvio in primavera e controllo delle zone\nSvuotamento ad aria in autunno prima del gelo\nIrrigatori regolati a entrambe le visite",
      de: "Inbetriebnahme im Frühling und Zonenprüfung\nAusblasen im Herbst vor dem Frost\nRegner bei beiden Terminen eingestellt",
      uk: "Весняний запуск і перевірка зон\nОсіння продувка перед морозами\nРегулювання зрошувачів на обох візитах",
      pa: "ਬਸੰਤ ਵਿੱਚ ਚਾਲੂ ਕਰਨਾ ਅਤੇ ਜ਼ੋਨਾਂ ਦੀ ਜਾਂਚ\nਠੰਢ ਤੋਂ ਪਹਿਲਾਂ ਪਤਝੜ ਵਿੱਚ ਹਵਾ ਨਾਲ ਖ਼ਾਲੀ ਕਰਨਾ\nਦੋਵੇਂ ਫੇਰੀਆਂ 'ਤੇ ਹੈੱਡ ਠੀਕ ਕੀਤੇ",
      tl: "Pag-start tuwing tagsibol at pagsusuri ng mga zone\nBlow-out tuwing taglagas bago ang lamig\nInaayos ang mga sprinkler head sa parehong bisita",
    }),

  // ── Garage doors ─────────────────────────────────────────────────────────
  PLAN("garage.annual_tune_up", ["garage_door"],
    { frequency: "annual", visitCount: 1, usd: 120, discountPct: 10 },
    {
      en: "Annual Garage Door Tune-Up Plan",
      fr: "Forfait mise au point annuelle de porte de garage",
      es: "Plan anual de ajuste de puerta de garaje",
      it: "Piano annuale di manutenzione del portone del garage",
      de: "Jährlicher Garagentor-Wartungsplan",
      uk: "Щорічне обслуговування гаражних воріт",
      pa: "ਸਾਲਾਨਾ ਗੈਰਾਜ ਦਰਵਾਜ਼ਾ ਟਿਊਨ-ਅੱਪ ਯੋਜਨਾ",
      tl: "Taunang plano sa tune-up ng pinto ng garahe",
    },
    {
      en: "Springs, cables and rollers checked and lubricated\nSafety reverse and sensors tested\nBalance and opener adjusted",
      fr: "Ressorts, câbles et roulettes vérifiés et lubrifiés\nInversion de sécurité et capteurs testés\nÉquilibre et ouvre-porte ajustés",
      es: "Resortes, cables y rodillos revisados y lubricados\nPrueba del retroceso de seguridad y los sensores\nBalance y abridor ajustados",
      it: "Molle, cavi e rulli controllati e lubrificati\nInversione di sicurezza e sensori verificati\nBilanciamento e motore regolati",
      de: "Federn, Seile und Rollen geprüft und geschmiert\nSicherheitsrücklauf und Sensoren getestet\nAusgleich und Antrieb eingestellt",
      uk: "Перевірка та змащення пружин, тросів і роликів\nПеревірка реверсу безпеки та датчиків\nРегулювання балансу та приводу",
      pa: "ਸਪ੍ਰਿੰਗ, ਕੇਬਲ ਅਤੇ ਰੋਲਰ ਜਾਂਚੇ ਅਤੇ ਤੇਲ ਲਗਾਇਆ\nਸੁਰੱਖਿਆ ਰਿਵਰਸ ਅਤੇ ਸੈਂਸਰਾਂ ਦੀ ਜਾਂਚ\nਸੰਤੁਲਨ ਅਤੇ ਓਪਨਰ ਠੀਕ ਕੀਤਾ",
      tl: "Sinusuri at nilalangisan ang spring, kable at roller\nSinusubukan ang safety reverse at mga sensor\nInaayos ang balanse at opener",
    }),

  // ── Commercial cleaning ──────────────────────────────────────────────────
  PLAN("janitorial.weekly_office", ["janitorial", "commercial_cleaning"],
    { frequency: "weekly", visitCount: null, usd: 150, discountPct: 5, includes: ["fq.janitorial.recurring.office"] },
    {
      en: "Weekly Office Cleaning Plan",
      fr: "Forfait entretien de bureau hebdomadaire",
      es: "Plan de limpieza semanal de oficina",
      it: "Piano di pulizia settimanale dell'ufficio",
      de: "Wöchentlicher Büroreinigungsplan",
      uk: "Щотижневе прибирання офісу",
      pa: "ਹਫ਼ਤਾਵਾਰ ਦਫ਼ਤਰ ਸਫ਼ਾਈ ਯੋਜਨਾ",
      tl: "Lingguhang plano sa paglilinis ng opisina",
    },
    {
      en: "Floors, desks and common areas every week\nWashrooms and kitchen sanitised\nTrash and recycling out",
      fr: "Planchers, bureaux et aires communes chaque semaine\nToilettes et cuisine désinfectées\nDéchets et recyclage sortis",
      es: "Pisos, escritorios y áreas comunes cada semana\nBaños y cocina desinfectados\nBasura y reciclaje retirados",
      it: "Pavimenti, scrivanie e aree comuni ogni settimana\nBagni e cucina igienizzati\nRifiuti e riciclo portati fuori",
      de: "Böden, Schreibtische und Gemeinschaftsflächen jede Woche\nWaschräume und Küche desinfiziert\nMüll und Wertstoffe entsorgt",
      uk: "Підлоги, столи та спільні зони щотижня\nДезінфекція вбиралень і кухні\nВинесення сміття та вторсировини",
      pa: "ਹਰ ਹਫ਼ਤੇ ਫ਼ਰਸ਼, ਮੇਜ਼ ਅਤੇ ਸਾਂਝੀਆਂ ਥਾਵਾਂ\nਵਾਸ਼ਰੂਮ ਅਤੇ ਰਸੋਈ ਕੀਟਾਣੂ-ਰਹਿਤ\nਕੂੜਾ ਅਤੇ ਰੀਸਾਈਕਲਿੰਗ ਬਾਹਰ",
      tl: "Sahig, mesa at mga karaniwang lugar linggo-linggo\nNililinis at dini-disinfect ang CR at kusina\nInilalabas ang basura at recycling",
    }),

  // ── Property care ────────────────────────────────────────────────────────
  PLAN("property.monthly_check", ["property_maintenance"],
    { frequency: "monthly", visitCount: 12, usd: 120, discountPct: 10 },
    {
      en: "Monthly Property Check Plan",
      fr: "Forfait vérification mensuelle de la propriété",
      es: "Plan de revisión mensual de la propiedad",
      it: "Piano di controllo mensile della proprietà",
      de: "Monatlicher Objekt-Check-Plan",
      uk: "Щомісячний огляд нерухомості",
      pa: "ਮਹੀਨਾਵਾਰ ਜਾਇਦਾਦ ਜਾਂਚ ਯੋਜਨਾ",
      tl: "Buwanang plano sa pagsusuri ng ari-arian",
    },
    {
      en: "A walk-through every month, inside and out\nSmall repairs handled on the visit\nPhotos and a short report each time",
      fr: "Une tournée chaque mois, intérieur et extérieur\nPetites réparations faites pendant la visite\nPhotos et court rapport à chaque fois",
      es: "Un recorrido cada mes, por dentro y por fuera\nPequeñas reparaciones durante la visita\nFotos y un breve informe cada vez",
      it: "Un sopralluogo ogni mese, dentro e fuori\nPiccole riparazioni durante la visita\nFoto e un breve resoconto ogni volta",
      de: "Jeden Monat ein Rundgang, innen und außen\nKleine Reparaturen direkt beim Termin\nFotos und ein kurzer Bericht jedes Mal",
      uk: "Щомісячний обхід, всередині та ззовні\nДрібний ремонт під час візиту\nФото та короткий звіт щоразу",
      pa: "ਹਰ ਮਹੀਨੇ ਅੰਦਰ ਅਤੇ ਬਾਹਰ ਦਾ ਜਾਇਜ਼ਾ\nਫੇਰੀ ਦੌਰਾਨ ਛੋਟੀਆਂ ਮੁਰੰਮਤਾਂ\nਹਰ ਵਾਰ ਫ਼ੋਟੋਆਂ ਅਤੇ ਛੋਟੀ ਰਿਪੋਰਟ",
      tl: "Pag-ikot bawat buwan, sa loob at labas\nMaliliit na pagkukumpuni sa mismong bisita\nMga litrato at maikling ulat tuwing bisita",
    }),

  // ── House washing ────────────────────────────────────────────────────────
  PLAN("pressure.annual_wash", ["pressure_washing_house"],
    { frequency: "annual", visitCount: 1, usd: 300, discountPct: 10 },
    {
      en: "Annual House Wash Plan",
      fr: "Forfait lavage annuel de la maison",
      es: "Plan anual de lavado de la casa",
      it: "Piano annuale di lavaggio della casa",
      de: "Jährlicher Fassadenreinigungsplan",
      uk: "Щорічне миття фасаду будинку",
      pa: "ਸਾਲਾਨਾ ਘਰ ਧੁਆਈ ਯੋਜਨਾ",
      tl: "Taunang plano sa paghuhugas ng bahay",
    },
    {
      en: "Soft wash of the siding once a year\nWindows rinsed on the outside\nMould and mildew treated",
      fr: "Lavage à basse pression du revêtement une fois par année\nFenêtres rincées à l'extérieur\nMoisissures traitées",
      es: "Lavado suave del revestimiento una vez al año\nVentanas enjuagadas por fuera\nTratamiento de moho",
      it: "Lavaggio a bassa pressione del rivestimento una volta l'anno\nFinestre risciacquate all'esterno\nMuffa trattata",
      de: "Schonende Fassadenwäsche einmal im Jahr\nFenster außen abgespült\nSchimmel und Stockflecken behandelt",
      uk: "М'яке миття обшивки раз на рік\nВікна ззовні промиті\nОбробка від цвілі",
      pa: "ਸਾਲ ਵਿੱਚ ਇੱਕ ਵਾਰ ਸਾਈਡਿੰਗ ਦੀ ਨਰਮ ਧੁਆਈ\nਖਿੜਕੀਆਂ ਬਾਹਰੋਂ ਧੋਤੀਆਂ\nਉੱਲੀ ਦਾ ਇਲਾਜ",
      tl: "Soft wash ng siding isang beses bawat taon\nBinabanlawan ang bintana sa labas\nGinagamot ang amag",
    }),
];

/** The starter plans for one trade (a ServiceCategory.key), in listed order. */
export function planTemplateSeedsForTrade(trade) {
  if (!trade) return [];
  return PLAN_TEMPLATE_SEEDS.filter((s) => s.trades.includes(trade));
}

/** Every trade that has at least one starter plan. */
export function tradesWithPlanTemplates() {
  return [...new Set(PLAN_TEMPLATE_SEEDS.flatMap((s) => s.trades))];
}
