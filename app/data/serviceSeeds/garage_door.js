// app/data/serviceSeeds/garage_door.js
//
// Garage doors are a TAKEOFF trade: the door itself is priced per size and
// style by the garage_door price book (app/data/tradePriceBooks.js). The
// door installation row is kept as a reference with `pricedBy: "takeoff"`;
// openers, springs, cables, rollers and repairs are flat-priced services.
import { L, SHARED, D, T, withTemplates, withLanguages } from "./_templateLines";
import { I18N } from "./i18n/garage_door.js";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "garage_door",
  categories: [
    { key: "maintenance", name: { en: "Add-ons and maintenance", fr: "Compléments et entretien", es: "Complementos y mantenimiento" } },
    { key: "repair", name: { en: "Garage door repair", fr: "Réparation de porte de garage", es: "Reparación de puerta de garaje" } },
    { key: "opener", name: { en: "Openers and sensors", fr: "Ouvre-portes et capteurs", es: "Abrepuertas y sensores" } },
    { key: "install", name: { en: "Installation and specialty", fr: "Installation et spécialités", es: "Instalación y especialidades" } },
  ],
  services: [
    S("fq.garage_door.maintenance.bottom_seal", "maintenance", "each", null,
      ["Bottom seal replacement", "Remplacement du coupe-froid du bas", "Reemplazo del sello inferior"],
      ["The worn rubber seal along the bottom of the door replaced to keep out water, wind and pests.",
       "Coupe-froid en caoutchouc usé au bas de la porte remplacé pour bloquer l'eau, le vent et la vermine.",
       "Sello de goma gastado en la parte baja de la puerta reemplazado para que no entren agua, viento ni plagas."]),
    S("fq.garage_door.repair.repair_visit", "repair", "flat", null,
      ["Garage door repair visit", "Visite de réparation de porte de garage", "Visita de reparación de puerta de garaje"],
      ["A door that will not open, close or sit straight diagnosed and repaired on a two-hour visit.",
       "Porte qui n'ouvre pas, ne ferme pas ou n'est plus droite diagnostiquée et réparée pendant une visite de deux heures.",
       "Puerta que no abre, no cierra o quedó chueca diagnosticada y reparada en una visita de dos horas."],
      { durationMinutes: 120, bookable: true }),
    S("fq.garage_door.opener.opener_service_visit", "opener", "flat", null,
      ["Garage door opener service visit", "Visite d'entretien d'ouvre-porte", "Visita de servicio de abrepuertas"],
      ["Opener faults — no response, stops halfway, reverses — diagnosed and repaired.",
       "Pannes d'ouvre-porte — ne répond pas, s'arrête à mi-course, revient — diagnostiquées et réparées.",
       "Fallas del abrepuertas (no responde, se detiene a medias, se regresa) diagnosticadas y reparadas."],
      { durationMinutes: 120, bookable: true }),
    S("fq.garage_door.repair.spring_visit", "repair", "flat", null,
      ["Garage door spring replacement visit", "Visite de remplacement de ressort", "Visita de reemplazo de resorte"],
      ["A broken spring replaced safely and the door rebalanced, on a booked visit.",
       "Ressort brisé remplacé en toute sécurité et porte rééquilibrée, lors d'une visite réservée.",
       "Resorte roto reemplazado con seguridad y la puerta rebalanceada, en una visita agendada."],
      { durationMinutes: 120, bookable: true }),
    S("fq.garage_door.repair.track_realignment", "repair", "flat", null,
      ["Track realignment and repair", "Réalignement et réparation des rails", "Realineación y reparación de rieles"],
      ["Tracks and hardware realigned and secured so the door travels smoothly without binding.",
       "Rails et quincaillerie réalignés et fixés pour que la porte se déplace sans coincer.",
       "Rieles y herrajes realineados y asegurados para que la puerta corra sin trabarse."]),
    S("fq.garage_door.repair.panel_replacement", "repair", "each", null,
      ["Panel or section replacement", "Remplacement de panneau ou de section", "Reemplazo de panel o sección"],
      ["A dented or broken door section replaced and the hardware refitted.",
       "Section de porte bosselée ou brisée remplacée et quincaillerie reposée.",
       "Sección de puerta abollada o rota reemplazada y los herrajes reinstalados."]),
    S("fq.garage_door.repair.nylon_rollers", "repair", "flat", null,
      ["Nylon roller replacement", "Remplacement des roulettes en nylon", "Reemplazo de rodillos de nailon"],
      ["Worn, noisy rollers swapped for nylon ones for a quieter, smoother door.",
       "Roulettes usées et bruyantes remplacées par des roulettes en nylon pour une porte plus silencieuse.",
       "Rodillos gastados y ruidosos cambiados por unos de nailon para una puerta más silenciosa y suave."]),
    S("fq.garage_door.repair.cable_replacement", "repair", "flat", null,
      ["Lift cable replacement", "Remplacement des câbles de levage", "Reemplazo de cables de elevación"],
      ["Frayed or snapped lifting cables replaced and the connected hardware inspected.",
       "Câbles de levage effilochés ou rompus remplacés et quincaillerie connexe inspectée.",
       "Cables de elevación deshilachados o rotos reemplazados y los herrajes conectados inspeccionados."]),
    S("fq.garage_door.repair.torsion_spring", "repair", "flat", BM(235, 375, 550),
      ["Torsion spring replacement", "Remplacement de ressort de torsion", "Reemplazo de resorte de torsión"],
      ["Torsion springs replaced and the door rebalanced so the opener is not lifting dead weight.",
       "Ressorts de torsion remplacés et porte rééquilibrée pour que l'ouvre-porte ne soulève pas un poids mort.",
       "Resortes de torsión reemplazados y la puerta rebalanceada para que el abrepuertas no cargue peso muerto."]),
    S("fq.garage_door.opener.repair_service_call", "opener", "flat", BM(89, 125, 160),
      ["Opener repair and service call", "Réparation d'ouvre-porte et appel de service", "Reparación de abrepuertas y visita de servicio"],
      ["Opener issues diagnosed and minor adjustments made on the visit.",
       "Problèmes d'ouvre-porte diagnostiqués et ajustements mineurs faits sur place.",
       "Problemas del abrepuertas diagnosticados y ajustes menores hechos en la visita."]),
    S("fq.garage_door.opener.repair_adjustment", "opener", "flat", BM(75, 99, 164),
      ["Opener repair and adjustment", "Réparation et ajustement d'ouvre-porte", "Reparación y ajuste de abrepuertas"],
      ["The opener and its travel limits and force settings repaired and adjusted.",
       "Ouvre-porte, limites de course et réglages de force réparés et ajustés.",
       "Abrepuertas y sus límites de recorrido y ajustes de fuerza reparados y ajustados."]),
    S("fq.garage_door.opener.safety_sensors", "opener", "flat", BM(115, 125, 195),
      ["Safety sensor replacement or alignment", "Remplacement ou alignement des capteurs de sécurité", "Reemplazo o alineación de sensores de seguridad"],
      ["Photo-eye sensors replaced or realigned and the auto-reverse tested.",
       "Cellules photoélectriques remplacées ou réalignées et inversion automatique testée.",
       "Sensores fotoeléctricos reemplazados o realineados y la reversa automática probada."]),
    S("fq.garage_door.opener.inspection_diagnostic", "opener", "flat", BM(78, 129, 175),
      ["Opener inspection and diagnostic", "Inspection et diagnostic d'ouvre-porte", "Inspección y diagnóstico de abrepuertas"],
      ["The door and opener inspected to find what is failing, with the repair quoted.",
       "Porte et ouvre-porte inspectés pour trouver ce qui fait défaut, réparation chiffrée.",
       "Puerta y abrepuertas inspeccionados para encontrar lo que falla, con la reparación cotizada."]),
    S("fq.garage_door.install.opener_install", "install", "each", null,
      ["Opener installation — chain or belt drive", "Installation d'ouvre-porte — à chaîne ou à courroie", "Instalación de abrepuertas — de cadena o banda"],
      ["A chain- or belt-drive opener installed or replaced, with remotes and wall button programmed.",
       "Ouvre-porte à chaîne ou à courroie installé ou remplacé, télécommandes et bouton mural programmés.",
       "Abrepuertas de cadena o banda instalado o reemplazado, con controles y botón de pared programados."]),
    S("fq.garage_door.install.floor_coating", "install", "flat", null,
      ["Garage floor coating — polyaspartic flake", "Revêtement de plancher de garage — polyaspartique à flocons", "Recubrimiento de piso de garaje — poliaspártico con hojuelas"],
      ["The slab prepared and coated with a polyaspartic flake system, moisture-tested first.",
       "Dalle préparée et revêtue d'un système polyaspartique à flocons, après test d'humidité.",
       "Losa preparada y recubierta con un sistema poliaspártico con hojuelas, con prueba de humedad previa."],
      { existing: "epoxy trade (ServiceCategory epoxy)." }),
    S("fq.garage_door.install.entry_lock_deadbolt", "install", "each", null,
      ["Entry door lock and deadbolt replacement", "Remplacement de serrure et de pêne dormant de porte d'entrée", "Reemplazo de cerradura y cerrojo de puerta de entrada"],
      ["Locks and deadbolts on the entry door replaced and keyed.",
       "Serrures et pênes dormants de la porte d'entrée remplacés et clés fournies.",
       "Cerraduras y cerrojos de la puerta de entrada reemplazados y con llaves."]),
    S("fq.garage_door.install.wood_metal_components", "install", "flat", null,
      ["Wood and metal component replacement", "Remplacement de composants en bois et en métal", "Reemplazo de componentes de madera y metal"],
      ["Damaged trim, panels and brackets replaced.",
       "Moulures, panneaux et supports abîmés remplacés.",
       "Molduras, paneles y soportes dañados reemplazados."]),
    S("fq.garage_door.install.door_install", "install", "each", BM(350, 730, 1040),
      ["Garage door installation — door and basic hardware", "Installation de porte de garage — porte et quincaillerie de base", "Instalación de puerta de garaje — puerta y herrajes básicos"],
      ["A new garage door hung on new tracks and springs with its framing and trim.",
       "Nouvelle porte de garage posée sur rails et ressorts neufs avec son encadrement et ses moulures.",
       "Puerta de garaje nueva instalada en rieles y resortes nuevos con su marco y molduras."],
      { pricedBy: "takeoff", existing: "garage_door price book (per door size and style)." }),
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    S("fq.garage_door.maintenance.tune_up", "maintenance", "flat", null,
      ["Garage door tune-up", "Mise au point de porte de garage", "Afinación de puerta de garaje"],
      ["Springs, cables, rollers and hinges inspected, moving parts lubricated, the door balanced and the auto-reverse tested.",
       "Ressorts, câbles, roulettes et charnières inspectés, pièces mobiles lubrifiées, porte équilibrée et inversion automatique testée.",
       "Resortes, cables, rodillos y bisagras inspeccionados, partes móviles lubricadas, puerta balanceada y reversa automática probada."],
      { durationMinutes: 60, bookable: true }),
    // ── Added 2026-09-24 from the garage template capture ────────────────
    S("fq.garage_door.repair.torsion_spring_single", "repair", "flat", null,
      ["Single torsion spring replacement", "Remplacement d'un ressort de torsion", "Reemplazo de un resorte de torsión"],
      ["A single-spring door's broken torsion spring replaced, wound to the door weight and the door balanced.",
       "Ressort de torsion brisé d'une porte à un ressort remplacé, remonté selon le poids de la porte et porte équilibrée.",
       "Resorte de torsión roto de una puerta de un resorte reemplazado, tensado según el peso y la puerta balanceada."]),
    S("fq.garage_door.repair.extension_spring", "repair", "flat", null,
      ["Extension spring replacement", "Remplacement de ressort d'extension", "Reemplazo de resorte de extensión"],
      ["Side-mounted extension springs replaced with safety cables run through them and the door balanced.",
       "Ressorts d'extension latéraux remplacés avec câbles de sécurité passés au travers et porte équilibrée.",
       "Resortes de extensión laterales reemplazados con cables de seguridad pasados por dentro y puerta balanceada."]),
    S("fq.garage_door.install.opener_smart", "install", "each", null,
      ["Smart opener installation", "Installation d'ouvre-porte intelligent", "Instalación de abridor inteligente"],
      ["A Wi-Fi opener installed with the phone app, remotes and wall console set up and the safety reverse tested.",
       "Ouvre-porte Wi-Fi installé avec l'application, télécommandes et console murale configurées et inversion de sécurité testée.",
       "Abridor Wi-Fi instalado con la aplicación, controles y consola configurados y reversa de seguridad probada."]),
    S("fq.garage_door.install.door_install_double", "install", "each", null,
      ["Double garage door installation", "Installation de porte de garage double", "Instalación de puerta de garaje doble"],
      ["A new 16 ft double door hung on new tracks and springs, balanced and weather-sealed.",
       "Nouvelle porte double de 16 pi posée sur rails et ressorts neufs, équilibrée et étanchéisée.",
       "Puerta doble nueva de 16 pies colgada en rieles y resortes nuevos, balanceada y sellada."]),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the benchmark medians on the rows that have one ($375 torsion
// springs, $125 opener service call, $129 opener diagnostic, $125 sensors,
// $730 door install) set those totals; the others are 2026 garage-door
// figures — $95 service call, a pair of oil-tempered torsion springs $90–120
// at the distributor, a half-horsepower belt-drive opener $260–300, nylon
// rollers $6–8 each. The two sample services a Jobber garage signup shows
// (panel replacement, spring repair) both carry a template.
//
// Folded in 2026-09-24: the garage template capture under docs/research/ —
// labour-only flat prices with no costs: service call $79, torsion springs
// single $125 / pair $225, extension spring $125, opener install $225 /
// smart $275, opener diagnostic $95, section $200, track and rollers $195,
// cable pair $160, tune-up $89, weatherstrip $135, door install single $375 /
// double $500. Those replace the figures above; costs are ours at 50% of
// labour. Springs, openers, rollers, cables and seals are not in the Home
// Depot reference (they are bought from door distributors), so their costs
// stay the 75% rule — a company overwrites them with its supplier's price.
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const CALL = () => SHARED.serviceCall(79);

const TEMPLATES = {
  // ── Installation ──
  "fq.garage_door.install.opener_install": T("installation", n(
    ["Installazione motorizzazione — a catena o cinghia", "Motorizzazione a catena o a cinghia installata o sostituita, con telecomandi e pulsante programmati."],
    ["Torantrieb einbauen — Kette oder Riemen", "Ketten- oder Riemenantrieb eingebaut oder ersetzt, Handsender und Wandtaster programmiert."],
    ["Встановлення приводу — ланцюговий або пасовий", "Ланцюговий або пасовий привід встановлено чи замінено, пульти й настінну кнопку запрограмовано."],
    ["Pagkabit ng opener — chain o belt", "Ikinabit o pinalitan ang chain o belt-drive na opener at prinogram ang remote at wall button."],
  ), [
    L.labour(1, "each", 225, {
      en: ["Opener installation labour", "Old opener off, rail and motor hung, sensors aligned, limits and force set, remotes programmed."],
      fr: ["Main-d'œuvre — installation de l'ouvre-porte", "Ancien ouvre-porte retiré, rail et moteur suspendus, capteurs alignés, limites et force réglées, télécommandes programmées."],
      es: ["Mano de obra — instalación del abridor", "Abridor viejo fuera, riel y motor colgados, sensores alineados, límites y fuerza ajustados, controles programados."],
      it: ["Manodopera — installazione motorizzazione", "Vecchio motore tolto, binario e motore appesi, fotocellule allineate, finecorsa e forza regolati, telecomandi programmati."],
      de: ["Arbeit — Antrieb einbauen", "Alter Antrieb ab, Schiene und Motor montiert, Lichtschranke ausgerichtet, Endlagen und Kraft eingestellt, Sender programmiert."],
      uk: ["Робота — монтаж приводу", "Старий привід знято, рейку й мотор підвішено, датчики вирівняно, межі й зусилля налаштовано, пульти запрограмовано."],
      tl: ["Labor — pagkabit ng opener", "Tinanggal ang luma, isinabit ang rail at motor, inayos ang sensor, limit at force, at prinogram ang remote."],
    }),
    L.material(1, "each", 360, {
      en: ["Belt-drive opener — 1/2 HP", "Belt-drive opener with two remotes, wall console and safety sensors."],
      fr: ["Ouvre-porte à courroie — 1/2 HP", "Ouvre-porte à courroie avec deux télécommandes, console murale et capteurs de sécurité."],
      es: ["Abridor de banda — 1/2 HP", "Abridor de banda con dos controles, consola de pared y sensores de seguridad."],
      it: ["Motorizzazione a cinghia — 1/2 HP", "Motorizzazione a cinghia con due telecomandi, pulsantiera a muro e fotocellule."],
      de: ["Riemenantrieb — 1/2 PS", "Riemenantrieb mit zwei Handsendern, Wandtaster und Lichtschranke."],
      uk: ["Пасовий привід — 1/2 к.с.", "Пасовий привід із двома пультами, настінною панеллю й датчиками безпеки."],
      tl: ["Belt-drive opener — 1/2 HP", "Belt-drive opener na may dalawang remote, wall console at safety sensor."],
    }, { cost: 280 }),
  ], D.newCustomer("fixed", 25)),

  "fq.garage_door.install.door_install": T("installation", n(
    ["Installazione porta garage — porta e ferramenta di base", "Nuova porta del garage montata su binari e molle nuovi con telaio e finiture."],
    ["Garagentor einbauen — Tor und Grundbeschläge", "Neues Garagentor an neuen Schienen und Federn samt Zarge und Blenden montiert."],
    ["Встановлення гаражних воріт — ворота й базова фурнітура", "Нові ворота змонтовано на нових напрямних і пружинах з обрамленням."],
    ["Pagkabit ng garage door — pinto at basic hardware", "Bagong garage door sa bagong track at spring kasama ang frame at trim."],
  ), [
    SHARED.removeOld(150),
    L.labour(1, "each", 375, {
      en: ["Door installation labour", "Sections stacked, tracks and springs set, the door balanced and weather-sealed."],
      fr: ["Main-d'œuvre — pose de la porte", "Sections montées, rails et ressorts posés, porte équilibrée et étanchéisée."],
      es: ["Mano de obra — instalación de la puerta", "Secciones montadas, rieles y resortes colocados, puerta balanceada y sellada."],
      it: ["Manodopera — posa della porta", "Sezioni montate, binari e molle posati, porta bilanciata e sigillata."],
      de: ["Arbeit — Tormontage", "Sektionen gestapelt, Schienen und Federn gesetzt, Tor ausbalanciert und abgedichtet."],
      uk: ["Робота — монтаж воріт", "Секції зібрано, напрямні й пружини встановлено, ворота збалансовано й ущільнено."],
      tl: ["Labor — pagkabit ng pinto", "Pinagpatong ang section, ikinabit ang track at spring, binalanse at sinelyuhan ang pinto."],
    }, { measurementKey: "each" }),
  ], null),

  "fq.garage_door.install.entry_lock_deadbolt": T("installation", n(
    ["Sostituzione serratura e catenaccio", "Serrature e catenacci della porta d'ingresso sostituiti e cifrati."],
    ["Türschloss und Riegel ersetzen", "Schlösser und Riegelschlösser der Eingangstür ersetzt und geschlossen."],
    ["Заміна замка та засувки", "Замки та засувки вхідних дверей замінено й налаштовано на ключ."],
    ["Palit ng lock at deadbolt", "Pinalitan at kinlave ang lock at deadbolt ng pinto."],
  ), [
    L.labour(1, "each", 85, {
      en: ["Lock and deadbolt installation — per door", "Old hardware out, new lockset and deadbolt fitted, strikes aligned."],
      fr: ["Pose de serrure et pêne dormant — la porte", "Ancienne quincaillerie retirée, nouvelle serrure et pêne posés, gâches alignées."],
      es: ["Instalación de cerradura y cerrojo — por puerta", "Herraje viejo fuera, cerradura y cerrojo nuevos, contrachapas alineadas."],
      it: ["Montaggio serratura e catenaccio — per porta", "Vecchia ferramenta tolta, nuova serratura e catenaccio montati, bocchette allineate."],
      de: ["Schloss und Riegel montieren — pro Tür", "Alte Beschläge raus, neues Schloss und Riegel eingesetzt, Schließbleche ausgerichtet."],
      uk: ["Монтаж замка й засувки — за двері", "Стару фурнітуру знято, новий замок і засувку встановлено, планки вирівняно."],
      tl: ["Pagkabit ng lock at deadbolt — kada pinto", "Tinanggal ang luma, ikinabit ang bagong lock at deadbolt at inayos ang strike."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 75, {
      en: ["Keyed-alike lockset and deadbolt", "Entry knob or lever with a matching deadbolt, keyed alike."],
      fr: ["Serrure et pêne à clé identique", "Bouton ou levier d'entrée avec pêne assorti, même clé."],
      es: ["Cerradura y cerrojo con misma llave", "Perilla o manija de entrada con cerrojo a juego, misma llave."],
      it: ["Serratura e catenaccio a chiave unica", "Pomolo o maniglia d'ingresso con catenaccio abbinato, stessa chiave."],
      de: ["Gleichschließendes Schloss mit Riegel", "Eingangsknauf oder -drücker mit passendem Riegel, gleichschließend."],
      uk: ["Замок і засувка під один ключ", "Вхідна ручка або кнопка з відповідною засувкою під один ключ."],
      tl: ["Lockset at deadbolt na iisang susi", "Entry knob o lever na may katernong deadbolt, iisang susi."],
    }, { measurementKey: "each" }),
  ], null),

  // ── Repair ──
  "fq.garage_door.repair.torsion_spring": T("repair", n(
    ["Sostituzione molle di torsione", "Molle di torsione sostituite e porta ribilanciata così che il motore non sollevi un peso morto."],
    ["Torsionsfedern ersetzen", "Torsionsfedern ersetzt und das Tor neu ausbalanciert, damit der Antrieb kein Totgewicht hebt."],
    ["Заміна торсіонних пружин", "Торсіонні пружини замінено, ворота перебалансовано, щоб привід не піднімав мертву вагу."],
    ["Palit ng torsion spring", "Pinalitan ang torsion spring at binalanse ang pinto para hindi buhatin ng opener ang bigat."],
  ), [
    CALL(),
    L.labour(1, "flat", 225, {
      en: ["Spring replacement labour", "Tension let off safely, both springs replaced as a pair, wound, set and the door balanced."],
      fr: ["Main-d'œuvre — remplacement des ressorts", "Tension relâchée en sécurité, deux ressorts remplacés en paire, remontés et porte équilibrée."],
      es: ["Mano de obra — cambio de resortes", "Tensión liberada con seguridad, ambos resortes cambiados en par, tensados y puerta balanceada."],
      it: ["Manodopera — sostituzione molle", "Tensione scaricata in sicurezza, entrambe le molle sostituite in coppia, caricate e porta bilanciata."],
      de: ["Arbeit — Federtausch", "Spannung sicher abgelassen, beide Federn paarweise ersetzt, gespannt und Tor ausbalanciert."],
      uk: ["Робота — заміна пружин", "Натяг безпечно знято, обидві пружини замінено парою, закручено, ворота збалансовано."],
      tl: ["Labor — palit ng spring", "Ligtas na binitawan ang tension, pinalitan ang dalawang spring, pinaikot at binalanse ang pinto."],
    }),
    L.material(1, "each", 150, {
      en: ["Torsion springs — pair", "Oil-tempered torsion springs sized to the door weight, with cones."],
      fr: ["Ressorts de torsion — paire", "Ressorts de torsion trempés à l'huile selon le poids de la porte, avec cônes."],
      es: ["Resortes de torsión — par", "Resortes de torsión templados en aceite según el peso de la puerta, con conos."],
      it: ["Molle di torsione — coppia", "Molle di torsione temprate in olio dimensionate sul peso della porta, con coni."],
      de: ["Torsionsfedern — Paar", "Öl-gehärtete Torsionsfedern passend zum Torgewicht, mit Konen."],
      uk: ["Торсіонні пружини — пара", "Загартовані в олії пружини під вагу воріт, з конусами."],
      tl: ["Torsion springs — pares", "Oil-tempered na torsion spring ayon sa bigat ng pinto, may cone."],
    }, { cost: 110 }),
  ], D.regular("fixed", 15)),

  "fq.garage_door.repair.panel_replacement": T("repair", n(
    ["Sostituzione pannello o sezione", "Sezione della porta ammaccata o rotta sostituita e ferramenta rimontata."],
    ["Paneel oder Sektion ersetzen", "Verbeulte oder gebrochene Torsektion ersetzt und die Beschläge wieder angebracht."],
    ["Заміна панелі або секції", "Пом'яту чи зламану секцію воріт замінено, фурнітуру встановлено назад."],
    ["Palit ng panel o section", "Pinalitan ang yupi o sirang section ng pinto at ikinabit ulit ang hardware."],
  ), [
    CALL(),
    L.labour(1, "each", 200, {
      en: ["Section replacement — per section", "Door secured, hinges and rollers moved to the new section, reset and balanced."],
      fr: ["Remplacement de section — la section", "Porte immobilisée, charnières et roulettes transférées sur la nouvelle section, réglée et équilibrée."],
      es: ["Reemplazo de sección — por sección", "Puerta asegurada, bisagras y rodillos pasados a la sección nueva, ajustada y balanceada."],
      it: ["Sostituzione sezione — per sezione", "Porta bloccata, cerniere e rulli spostati sulla nuova sezione, regolata e bilanciata."],
      de: ["Sektion ersetzen — pro Sektion", "Tor gesichert, Bänder und Rollen auf die neue Sektion umgesetzt, eingestellt und ausbalanciert."],
      uk: ["Заміна секції — за секцію", "Ворота зафіксовано, завіси й ролики перенесено на нову секцію, відрегульовано й збалансовано."],
      tl: ["Palit ng section — kada section", "Sinigurado ang pinto, inilipat ang bisagra at roller sa bagong section at binalanse."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 320, {
      en: ["Replacement door section", "Matching steel section ordered to the door's make, model and colour."],
      fr: ["Section de remplacement", "Section d'acier assortie commandée selon la marque, le modèle et la couleur."],
      es: ["Sección de repuesto", "Sección de acero a juego pedida según marca, modelo y color."],
      it: ["Sezione di ricambio", "Sezione in acciaio abbinata ordinata per marca, modello e colore."],
      de: ["Ersatzsektion", "Passende Stahlsektion nach Hersteller, Modell und Farbe bestellt."],
      uk: ["Змінна секція", "Відповідна сталева секція за маркою, моделлю й кольором."],
      tl: ["Kapalit na section", "Katernong steel section na inorder ayon sa brand, model at kulay."],
    }, { cost: 240, measurementKey: "each" }),
  ], null),

  "fq.garage_door.repair.cable_replacement": T("repair", n(
    ["Sostituzione cavi di sollevamento", "Cavi sfilacciati o rotti sostituiti e ferramenta collegata ispezionata."],
    ["Hubseile ersetzen", "Ausgefranste oder gerissene Hubseile ersetzt und die zugehörigen Beschläge geprüft."],
    ["Заміна підйомних тросів", "Розтріпані чи обірвані троси замінено, пов'язану фурнітуру оглянуто."],
    ["Palit ng lift cable", "Pinalitan ang punit o putol na cable at sinuri ang kaugnay na hardware."],
  ), [
    CALL(),
    L.labour(1, "flat", 160, {
      en: ["Cable replacement labour", "Springs unwound, both cables replaced on the drums, re-tensioned and balanced."],
      fr: ["Main-d'œuvre — remplacement des câbles", "Ressorts détendus, deux câbles remplacés sur les tambours, retendus et équilibrés."],
      es: ["Mano de obra — cambio de cables", "Resortes destensados, ambos cables cambiados en los tambores, tensados y balanceados."],
      it: ["Manodopera — sostituzione cavi", "Molle scaricate, entrambi i cavi sostituiti sui tamburi, ritensionati e bilanciati."],
      de: ["Arbeit — Seiltausch", "Federn entspannt, beide Seile auf den Trommeln ersetzt, neu gespannt und ausbalanciert."],
      uk: ["Робота — заміна тросів", "Пружини розкручено, обидва троси замінено на барабанах, натягнуто й збалансовано."],
      tl: ["Labor — palit ng cable", "Niluwagan ang spring, pinalitan ang dalawang cable sa drum, hinigpitan at binalanse."],
    }),
    L.material(1, "each", 35, {
      en: ["Lift cables — pair", "Galvanised lift cables cut to the door height."],
      fr: ["Câbles de levage — paire", "Câbles galvanisés coupés à la hauteur de la porte."],
      es: ["Cables de elevación — par", "Cables galvanizados cortados a la altura de la puerta."],
      it: ["Cavi di sollevamento — coppia", "Cavi zincati tagliati sull'altezza della porta."],
      de: ["Hubseile — Paar", "Verzinkte Hubseile auf Torhöhe abgelängt."],
      uk: ["Підйомні троси — пара", "Оцинковані троси під висоту воріт."],
      tl: ["Lift cable — pares", "Galvanized na cable na sukat sa taas ng pinto."],
    }),
  ], null),

  "fq.garage_door.repair.nylon_rollers": T("repair", n(
    ["Sostituzione rulli in nylon", "Rulli usurati e rumorosi sostituiti con rulli in nylon per una porta più silenziosa e scorrevole."],
    ["Nylonrollen ersetzen", "Abgenutzte, laute Rollen gegen Nylonrollen getauscht, für ein leiseres, ruhigeres Tor."],
    ["Заміна нейлонових роликів", "Зношені шумні ролики замінено нейлоновими для тихіших і плавніших воріт."],
    ["Palit ng nylon roller", "Pinalitan ang luma at maingay na roller ng nylon para tahimik at makinis ang pinto."],
  ), [
    L.labour(1, "flat", 110, {
      en: ["Roller replacement labour", "Each roller swapped hinge by hinge, bottom brackets done with the springs relaxed."],
      fr: ["Main-d'œuvre — remplacement des roulettes", "Chaque roulette changée charnière par charnière, supports du bas faits ressorts détendus."],
      es: ["Mano de obra — cambio de rodillos", "Cada rodillo cambiado bisagra por bisagra, soportes inferiores con los resortes sin tensión."],
      it: ["Manodopera — sostituzione rulli", "Ogni rullo cambiato cerniera per cerniera, staffe basse con molle scariche."],
      de: ["Arbeit — Rollentausch", "Jede Rolle Band für Band getauscht, untere Halter bei entspannten Federn."],
      uk: ["Робота — заміна роликів", "Кожен ролик замінено по завісах, нижні кронштейни — при розслаблених пружинах."],
      tl: ["Labor — palit ng roller", "Pinalitan isa-isa ang roller sa bawat bisagra, ang ibaba habang maluwag ang spring."],
    }),
    L.material(10, "each", 9, {
      en: ["Sealed-bearing nylon roller", "Quiet nylon roller with a sealed bearing and 4 in stem."],
      fr: ["Roulette de nylon à roulement scellé", "Roulette silencieuse en nylon, roulement scellé, tige de 4 po."],
      es: ["Rodillo de nylon con balero sellado", "Rodillo silencioso de nylon con balero sellado y vástago de 4 pulg."],
      it: ["Rullo in nylon con cuscinetto sigillato", "Rullo silenzioso in nylon con cuscinetto sigillato e perno da 4 pollici."],
      de: ["Nylonrolle mit gekapseltem Lager", "Leise Nylonrolle mit gekapseltem Lager und 4-Zoll-Schaft."],
      uk: ["Нейлоновий ролик із закритим підшипником", "Тихий нейлоновий ролик із закритим підшипником і стрижнем 4 дюйми."],
      tl: ["Nylon roller na sealed bearing", "Tahimik na nylon roller na may sealed bearing at 4 in na stem."],
    }, { cost: 6.5 }),
  ], null),

  "fq.garage_door.repair.track_realignment": T("repair", n(
    ["Riallineamento e riparazione binari", "Binari piegati o disallineati raddrizzati, riallineati e fissati."],
    ["Schienen ausrichten und reparieren", "Verbogene oder verschobene Schienen gerichtet, ausgerichtet und befestigt."],
    ["Вирівнювання й ремонт напрямних", "Погнуті чи зміщені напрямні випрямлено, вирівняно й закріплено."],
    ["Pag-align at pag-ayos ng track", "Itinuwid, in-align at hinigpitan ang baluktot o nalihis na track."],
  ), [
    CALL(),
    L.labour(1, "flat", 195, {
      en: ["Track realignment labour", "Tracks plumbed and spaced, brackets re-lagged and the door run tested."],
      fr: ["Main-d'œuvre — réalignement des rails", "Rails d'aplomb et espacés, supports refixés et porte testée."],
      es: ["Mano de obra — alineación de rieles", "Rieles a plomo y espaciados, soportes refijados y puerta probada."],
      it: ["Manodopera — riallineamento binari", "Binari a piombo e distanziati, staffe rifissate e porta provata."],
      de: ["Arbeit — Schienen ausrichten", "Schienen lotrecht und auf Abstand, Halter neu verschraubt und Torlauf getestet."],
      uk: ["Робота — вирівнювання напрямних", "Напрямні виставлено по вертикалі й відстані, кронштейни перекріплено, хід перевірено."],
      tl: ["Labor — pag-align ng track", "Itinuwid at inayos ang layo ng track, ikinabit ulit ang bracket at sinubukan ang takbo."],
    }),
  ], null),

  // ── Inspection ──
  "fq.garage_door.opener.inspection_diagnostic": T("inspection", n(
    ["Ispezione e diagnosi della motorizzazione", "Porta e motorizzazione ispezionate per trovare cosa si guasta, con la riparazione quotata."],
    ["Antriebsprüfung und Diagnose", "Tor und Antrieb geprüft, um den Fehler zu finden, mit Reparaturangebot."],
    ["Огляд і діагностика приводу", "Ворота й привід оглянуто, щоб знайти несправність, з оцінкою ремонту."],
    ["Inspeksyon at diagnostic ng opener", "Sinuri ang pinto at opener para hanapin ang sira, may presyo ng pag-ayos."],
  ), [SHARED.diagnostic(129, { cost: 60 })], null),

  "fq.garage_door.repair.repair_visit": T("inspection", n(
    ["Intervento di riparazione porta garage", "Una porta che non si apre, non si chiude o non sta dritta diagnosticata e riparata in una visita di due ore."],
    ["Garagentor-Reparatureinsatz", "Ein Tor, das nicht öffnet, schließt oder gerade läuft, in einem Zwei-Stunden-Termin diagnostiziert und repariert."],
    ["Ремонтний виклик для гаражних воріт", "Ворота, що не відчиняються, не зачиняються чи перекошені, діагностовано й відремонтовано за двогодинний візит."],
    ["Repair visit ng garage door", "Pinto na ayaw bumukas, sumara o tumuwid, na-diagnose at inayos sa dalawang oras na visit."],
  ), [CALL(), SHARED.techHour(1, 110)], null),

  "fq.garage_door.opener.opener_service_visit": T("inspection", n(
    ["Intervento di assistenza motorizzazione", "Guasti della motorizzazione — nessuna risposta, si ferma a metà, inverte — diagnosticati e riparati."],
    ["Serviceeinsatz Torantrieb", "Antriebsfehler — keine Reaktion, stoppt auf halber Höhe, reversiert — diagnostiziert und behoben."],
    ["Сервісний виклик для приводу", "Несправності приводу — не реагує, зупиняється посередині, реверсує — діагностовано й усунено."],
    ["Service visit ng opener", "Sira ng opener — walang sagot, humihinto sa gitna, bumabalik — na-diagnose at inayos."],
  ), [SHARED.diagnostic(95, { cost: 48 }), SHARED.techHour(1, 110)], null),

  // ── Maintenance ──
  "fq.garage_door.maintenance.tune_up": T("maintenance", n(
    ["Tagliando porta del garage", "Molle, cavi, rulli e cerniere ispezionati, parti mobili lubrificate, porta bilanciata e inversione automatica provata."],
    ["Garagentor-Wartung", "Federn, Seile, Rollen und Bänder geprüft, bewegliche Teile geschmiert, Tor ausbalanciert und Reversierung getestet."],
    ["Обслуговування гаражних воріт", "Пружини, троси, ролики й завіси оглянуто, рухомі частини змащено, ворота збалансовано, реверс перевірено."],
    ["Tune-up ng garage door", "Sinuri ang spring, cable, roller at bisagra, nilagyan ng lubricant, binalanse at sinubukan ang auto-reverse."],
  ), [
    L.labour(1, "flat", 89, {
      en: ["Tune-up and lubrication", "Every moving part inspected and lubricated, hardware tightened, balance and safety tested."],
      fr: ["Mise au point et lubrification", "Chaque pièce mobile inspectée et lubrifiée, quincaillerie resserrée, équilibre et sécurité testés."],
      es: ["Afinación y lubricación", "Cada parte móvil revisada y lubricada, herrajes apretados, balance y seguridad probados."],
      it: ["Tagliando e lubrificazione", "Ogni parte mobile ispezionata e lubrificata, ferramenta serrata, bilanciamento e sicurezza provati."],
      de: ["Wartung und Schmierung", "Alle beweglichen Teile geprüft und geschmiert, Beschläge nachgezogen, Balance und Sicherheit getestet."],
      uk: ["Обслуговування та змащення", "Кожну рухому частину оглянуто й змащено, кріплення підтягнуто, баланс і безпеку перевірено."],
      tl: ["Tune-up at lubrication", "Sinuri at nilagyan ng lubricant ang bawat gumagalaw na parte, hinigpitan ang hardware, sinubukan ang balanse at safety."],
    }),
    SHARED.consumables(12),
  ], D.seasonal("fixed", 20)),

  "fq.garage_door.maintenance.bottom_seal": T("maintenance", n(
    ["Sostituzione guarnizione inferiore", "Guarnizione in gomma consumata lungo il fondo della porta sostituita per tenere fuori acqua, vento e animali."],
    ["Bodendichtung ersetzen", "Abgenutzte Gummidichtung an der Torunterkante ersetzt, gegen Wasser, Wind und Schädlinge."],
    ["Заміна нижнього ущільнювача", "Зношений гумовий ущільнювач унизу воріт замінено від води, вітру й шкідників."],
    ["Palit ng bottom seal", "Pinalitan ang lumang rubber seal sa ibaba ng pinto laban sa tubig, hangin at peste."],
  ), [
    L.labour(1, "each", 135, {
      en: ["Bottom seal replacement — per door", "Old seal slid out of the retainer, new seal fed in and trimmed."],
      fr: ["Remplacement du coupe-froid — la porte", "Ancien joint retiré du profilé, nouveau glissé et coupé."],
      es: ["Cambio de sello inferior — por puerta", "Sello viejo retirado del riel, nuevo insertado y recortado."],
      it: ["Sostituzione guarnizione — per porta", "Vecchia guarnizione sfilata dal profilo, nuova inserita e rifilata."],
      de: ["Bodendichtung tauschen — pro Tor", "Alte Dichtung aus der Schiene gezogen, neue eingezogen und abgelängt."],
      uk: ["Заміна ущільнювача — за ворота", "Старий ущільнювач витягнуто з профілю, новий заведено й підрізано."],
      tl: ["Palit ng bottom seal — kada pinto", "Hinila ang lumang seal sa retainer, isiningit at pinutol ang bago."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 45, {
      en: ["Bottom seal — per door", "T-style or bulb vinyl bottom seal cut to the door width."],
      fr: ["Coupe-froid bas — la porte", "Joint bas en vinyle en T ou à bulbe coupé à la largeur de la porte."],
      es: ["Sello inferior — por puerta", "Sello inferior de vinilo tipo T o bulbo cortado al ancho de la puerta."],
      it: ["Guarnizione inferiore — per porta", "Guarnizione in vinile a T o a bulbo tagliata sulla larghezza della porta."],
      de: ["Bodendichtung — pro Tor", "T- oder Schlauchdichtung aus Vinyl auf Torbreite abgelängt."],
      uk: ["Нижній ущільнювач — за ворота", "Вініловий Т-подібний або трубчастий ущільнювач під ширину воріт."],
      tl: ["Bottom seal — kada pinto", "T-style o bulb na vinyl seal na sukat sa lapad ng pinto."],
    }, { measurementKey: "each" }),
  ], null),

  "fq.garage_door.opener.safety_sensors": T("maintenance", n(
    ["Sostituzione o allineamento fotocellule", "Fotocellule sostituite o riallineate e inversione automatica provata."],
    ["Lichtschranke ersetzen oder ausrichten", "Lichtschranken ersetzt oder neu ausgerichtet und Reversierung getestet."],
    ["Заміна або вирівнювання датчиків безпеки", "Фотодатчики замінено або вирівняно, автоматичний реверс перевірено."],
    ["Palit o pag-align ng safety sensor", "Pinalitan o in-align ulit ang photo-eye sensor at sinubukan ang auto-reverse."],
  ), [
    L.labour(1, "flat", 85, {
      en: ["Sensor alignment and test", "Sensors cleaned, aligned or replaced and the reversing test passed."],
      fr: ["Alignement et test des capteurs", "Capteurs nettoyés, alignés ou remplacés et test d'inversion réussi."],
      es: ["Alineación y prueba de sensores", "Sensores limpiados, alineados o reemplazados y prueba de reversa aprobada."],
      it: ["Allineamento e test fotocellule", "Fotocellule pulite, allineate o sostituite e test di inversione superato."],
      de: ["Lichtschranke ausrichten und testen", "Sensoren gereinigt, ausgerichtet oder ersetzt, Reversiertest bestanden."],
      uk: ["Вирівнювання та тест датчиків", "Датчики очищено, вирівняно або замінено, тест реверсу пройдено."],
      tl: ["Pag-align at test ng sensor", "Nilinis, in-align o pinalitan ang sensor at pumasa sa reverse test."],
    }),
    L.material(1, "each", 55, {
      en: ["Safety sensor pair", "Replacement photo-eye sensors for the opener brand."],
      fr: ["Paire de capteurs de sécurité", "Capteurs photoélectriques de remplacement pour la marque de l'ouvre-porte."],
      es: ["Par de sensores de seguridad", "Sensores fotoeléctricos de repuesto para la marca del abridor."],
      it: ["Coppia di fotocellule", "Fotocellule di ricambio per la marca della motorizzazione."],
      de: ["Lichtschranken-Paar", "Ersatz-Lichtschranken für die Antriebsmarke."],
      uk: ["Пара датчиків безпеки", "Змінні фотодатчики під марку приводу."],
      tl: ["Pares ng safety sensor", "Kapalit na photo-eye sensor para sa brand ng opener."],
    }),
  ], null),
  // ── Folded in from the garage template capture ──
  "fq.garage_door.repair.torsion_spring_single": T("repair", n(
    ["Sostituzione di una molla di torsione", "Molla di torsione rotta di una porta a molla singola sostituita, caricata sul peso della porta e porta bilanciata."],
    ["Einzelne Torsionsfeder ersetzen", "Gebrochene Torsionsfeder eines Einfedertors ersetzt, auf das Torgewicht gespannt und Tor ausbalanciert."],
    ["Заміна однієї торсіонної пружини", "Зламану пружину воріт з однією пружиною замінено, закручено під вагу, ворота збалансовано."],
    ["Palit ng isang torsion spring", "Pinalitan ang sirang spring ng pintong iisa ang spring, pinaikot ayon sa bigat at binalanse."],
  ), [CALL(), L.labour(1, "flat", 125, {
    en: ["Single spring replacement labour", "Tension let off, the spring replaced, wound and the door balanced."],
    fr: ["Main-d'œuvre — remplacement d'un ressort", "Tension relâchée, ressort remplacé, remonté et porte équilibrée."],
    es: ["Mano de obra — cambio de un resorte", "Tensión liberada, resorte cambiado, tensado y puerta balanceada."],
    it: ["Manodopera — sostituzione di una molla", "Tensione scaricata, molla sostituita, caricata e porta bilanciata."],
    de: ["Arbeit — eine Feder tauschen", "Spannung abgelassen, Feder ersetzt, gespannt und Tor ausbalanciert."],
    uk: ["Робота — заміна однієї пружини", "Натяг знято, пружину замінено, закручено, ворота збалансовано."],
    tl: ["Labor — palit ng isang spring", "Binitawan ang tension, pinalitan, pinaikot at binalanse ang pinto."],
  }), L.material(1, "each", 85, {
    en: ["Torsion spring — single", "Oil-tempered torsion spring sized to the door."],
    fr: ["Ressort de torsion — unité", "Ressort de torsion trempé à l'huile selon la porte."],
    es: ["Resorte de torsión — uno", "Resorte de torsión templado en aceite según la puerta."],
    it: ["Molla di torsione — singola", "Molla di torsione temprata in olio dimensionata sulla porta."],
    de: ["Torsionsfeder — einzeln", "Öl-gehärtete Torsionsfeder passend zum Tor."],
    uk: ["Торсіонна пружина — одна", "Загартована в олії пружина під ворота."],
    tl: ["Torsion spring — isa", "Oil-tempered na torsion spring ayon sa pinto."],
  })], D.regular("fixed", 10)),

  "fq.garage_door.repair.extension_spring": T("repair", n(
    ["Sostituzione molle di estensione", "Molle di estensione laterali sostituite con cavi di sicurezza passati all'interno e porta bilanciata."],
    ["Zugfedern ersetzen", "Seitliche Zugfedern ersetzt, Sicherheitsseile durchgeführt und Tor ausbalanciert."],
    ["Заміна пружин розтягу", "Бічні пружини розтягу замінено, запобіжні троси протягнуто, ворота збалансовано."],
    ["Palit ng extension spring", "Pinalitan ang extension spring sa gilid, dinaanan ng safety cable at binalanse ang pinto."],
  ), [CALL(), L.labour(1, "flat", 125, {
    en: ["Extension spring replacement labour", "Door opened and secured, both springs replaced and safety cables threaded."],
    fr: ["Main-d'œuvre — ressorts d'extension", "Porte ouverte et immobilisée, deux ressorts remplacés, câbles de sécurité passés."],
    es: ["Mano de obra — resortes de extensión", "Puerta abierta y asegurada, ambos resortes cambiados y cables de seguridad pasados."],
    it: ["Manodopera — molle di estensione", "Porta aperta e bloccata, entrambe le molle sostituite e cavi di sicurezza infilati."],
    de: ["Arbeit — Zugfedern tauschen", "Tor geöffnet und gesichert, beide Federn ersetzt und Sicherheitsseile eingefädelt."],
    uk: ["Робота — пружини розтягу", "Ворота відчинено й зафіксовано, обидві пружини замінено, троси протягнуто."],
    tl: ["Labor — extension spring", "Binuksan at sinigurado ang pinto, pinalitan ang dalawang spring at dinaanan ng safety cable."],
  }), L.material(1, "each", 65, {
    en: ["Extension springs — pair", "Colour-coded extension springs for the door weight."],
    fr: ["Ressorts d'extension — paire", "Ressorts d'extension codés par couleur selon le poids de la porte."],
    es: ["Resortes de extensión — par", "Resortes codificados por color según el peso de la puerta."],
    it: ["Molle di estensione — coppia", "Molle a codice colore per il peso della porta."],
    de: ["Zugfedern — Paar", "Farbcodierte Zugfedern passend zum Torgewicht."],
    uk: ["Пружини розтягу — пара", "Пружини з колірним кодом під вагу воріт."],
    tl: ["Extension spring — pares", "Color-coded na spring ayon sa bigat ng pinto."],
  })], D.regular("fixed", 10)),

  "fq.garage_door.install.opener_smart": T("installation", n(
    ["Installazione motorizzazione smart", "Motorizzazione Wi-Fi installata con app, telecomandi e pulsantiera configurati e inversione di sicurezza provata."],
    ["Smarter Torantrieb", "WLAN-Antrieb eingebaut, App, Sender und Wandtaster eingerichtet und Sicherheitsreversierung getestet."],
    ["Встановлення розумного приводу", "Wi-Fi привід встановлено, застосунок, пульти й панель налаштовано, реверс безпеки перевірено."],
    ["Pagkabit ng smart opener", "Ikinabit ang Wi-Fi opener, in-set up ang app, remote at wall console at sinubukan ang safety reverse."],
  ), [L.labour(1, "each", 275, {
    en: ["Smart opener installation labour", "Opener hung and wired, app paired to the owner's phone, limits and force set."],
    fr: ["Main-d'œuvre — ouvre-porte intelligent", "Ouvre-porte suspendu et câblé, application jumelée au téléphone, limites et force réglées."],
    es: ["Mano de obra — abridor inteligente", "Abridor colgado y cableado, app vinculada al teléfono, límites y fuerza ajustados."],
    it: ["Manodopera — motorizzazione smart", "Motore appeso e cablato, app associata al telefono, finecorsa e forza regolati."],
    de: ["Arbeit — smarter Antrieb", "Antrieb montiert und angeschlossen, App mit dem Telefon gekoppelt, Endlagen und Kraft eingestellt."],
    uk: ["Робота — розумний привід", "Привід підвішено й під'єднано, застосунок спарено з телефоном, межі й зусилля налаштовано."],
    tl: ["Labor — smart opener", "Isinabit at kinablehan, ipinares ang app sa phone at in-set ang limit at force."],
  }, { measurementKey: "each" }), L.material(1, "each", 420, {
    en: ["Wi-Fi belt-drive opener", "Smart belt-drive opener with battery backup, two remotes and keypad."],
    fr: ["Ouvre-porte Wi-Fi à courroie", "Ouvre-porte intelligent à courroie avec batterie de secours, deux télécommandes et clavier."],
    es: ["Abridor Wi-Fi de banda", "Abridor inteligente de banda con batería de respaldo, dos controles y teclado."],
    it: ["Motorizzazione Wi-Fi a cinghia", "Motore smart a cinghia con batteria di riserva, due telecomandi e tastierino."],
    de: ["WLAN-Riemenantrieb", "Smarter Riemenantrieb mit Notstromakku, zwei Sendern und Codetastatur."],
    uk: ["Wi-Fi пасовий привід", "Розумний пасовий привід з акумулятором, двома пультами й кодовою панеллю."],
    tl: ["Wi-Fi belt-drive opener", "Smart belt-drive opener na may battery backup, dalawang remote at keypad."],
  }, { measurementKey: "each" })], D.newCustomer("fixed", 25)),

  "fq.garage_door.install.door_install_double": T("installation", n(
    ["Installazione porta garage doppia", "Nuova porta doppia da 16 piedi montata su binari e molle nuovi, bilanciata e sigillata."],
    ["Doppel-Garagentor einbauen", "Neues 16-Fuß-Doppeltor an neuen Schienen und Federn montiert, ausbalanciert und abgedichtet."],
    ["Встановлення подвійних гаражних воріт", "Нові подвійні ворота 16 футів змонтовано на нових напрямних і пружинах, збалансовано й ущільнено."],
    ["Pagkabit ng double garage door", "Bagong 16 ft na double door sa bagong track at spring, binalanse at sinelyuhan."],
  ), [SHARED.removeOld(175), L.labour(1, "each", 500, {
    en: ["Double door installation labour", "Sections stacked, tracks and springs set, the door balanced and weather-sealed."],
    fr: ["Main-d'œuvre — porte double", "Sections montées, rails et ressorts posés, porte équilibrée et étanchéisée."],
    es: ["Mano de obra — puerta doble", "Secciones montadas, rieles y resortes colocados, puerta balanceada y sellada."],
    it: ["Manodopera — porta doppia", "Sezioni montate, binari e molle posati, porta bilanciata e sigillata."],
    de: ["Arbeit — Doppeltor", "Sektionen gestapelt, Schienen und Federn gesetzt, Tor ausbalanciert und abgedichtet."],
    uk: ["Робота — подвійні ворота", "Секції зібрано, напрямні й пружини встановлено, ворота збалансовано й ущільнено."],
    tl: ["Labor — double door", "Pinagpatong ang section, ikinabit ang track at spring, binalanse at sinelyuhan."],
  }, { measurementKey: "each" })], null),

  "fq.garage_door.install.floor_coating": T("installation", n(
    ["Rivestimento pavimento garage — poliaspartico con scaglie", "Soletta levigata e riparata, poi rivestita con poliaspartico a scaglie e finitura trasparente."],
    ["Garagenbodenbeschichtung — Polyaspartic mit Chips", "Bodenplatte geschliffen und ausgebessert, dann mit Polyaspartic, Farbchips und Klarlack beschichtet."],
    ["Покриття підлоги гаража — полиаспартик із чипсами", "Плиту відшліфовано й відремонтовано, потім покрито полиаспартиком із чипсами та прозорим шаром."],
    ["Coating ng sahig ng garahe — polyaspartic flake", "Ginrind at inayos ang slab, nilagyan ng polyaspartic, flake at clear coat."],
  ), [L.labour(1, "sqft", 4.5, {
    en: ["Floor coating labour — per sq ft", "Slab diamond-ground, cracks filled, base coat, full flake broadcast and clear top coat."],
    fr: ["Main-d'œuvre — revêtement, au pi²", "Dalle meulée au diamant, fissures comblées, couche de base, flocons à saturation et couche de finition claire."],
    es: ["Mano de obra — recubrimiento, por pie²", "Losa pulida con diamante, grietas rellenas, capa base, hojuela completa y capa final transparente."],
    it: ["Manodopera — rivestimento, al piede quadro", "Soletta levigata a diamante, crepe riempite, mano di fondo, scaglie a saturazione e finitura trasparente."],
    de: ["Arbeit — Beschichtung, pro sq ft", "Platte diamantgeschliffen, Risse gefüllt, Grundschicht, volle Chipeinstreuung und Klarlack."],
    uk: ["Робота — покриття, за кв. фут", "Плиту відшліфовано алмазом, тріщини заповнено, базовий шар, повна засипка чипсами й прозорий верхній шар."],
    tl: ["Labor — coating, kada sq ft", "Diamond-grind ang slab, tinapalan ang bitak, base coat, full flake at clear top coat."],
  }, { measurementKey: "areaSqFt" }), L.material(1, "sqft", 2.25, {
    en: ["Polyaspartic system — per sq ft", "Polyaspartic base and top coat with decorative flake."],
    fr: ["Système polyaspartique — au pi²", "Couche de base et de finition polyaspartiques avec flocons décoratifs."],
    es: ["Sistema poliaspártico — por pie²", "Capa base y final poliaspártica con hojuela decorativa."],
    it: ["Sistema poliaspartico — al piede quadro", "Fondo e finitura poliaspartici con scaglie decorative."],
    de: ["Polyaspartic-System — pro sq ft", "Polyaspartic-Grund- und Deckschicht mit Dekorchips."],
    uk: ["Полиаспартикова система — за кв. фут", "Полиаспартиковий базовий і верхній шар з декоративними чипсами."],
    tl: ["Polyaspartic system — kada sq ft", "Polyaspartic na base at top coat na may decorative flake."],
  }, { measurementKey: "areaSqFt" })], null, { categories: ["garage_door", "epoxy", "flooring_install"] }),

  // ── Taken from the schema agent's template draft (branch
  //    agent/services-templates-seeds-wip) for rows this file had not
  //    templated; prices and costs as drafted there. ──────────────────
  "fq.garage_door.install.wood_metal_components": T("installation", {
    it: ["Sostituzione di componenti in legno e metallo", "Cornici marce, cerniere piegate o staffe arrugginite sostituite con parti nuove, così la porta scorre dritta e si chiude a tenuta."],
    de: ["Austausch von Holz- und Metallteilen", "Morsche Zargen, verbogene Scharniere oder verrostete Beschläge durch neue Teile ersetzt, damit das Tor gerade läuft und dicht schließt."],
    uk: ["Заміна дерев'яних і металевих елементів", "Гнилу обшивку, зігнуті петлі чи іржаві кронштейни замінено на нові, щоб ворота ходили рівно та щільно зачинялися."],
    tl: ["Pagpapalit ng kahoy at metal na bahagi", "Pinalitan ang bulok na trim, baluktot na bisagra o kalawanging bracket ng bago para tuwid ang takbo at siksik ang sara ng pinto."],
  }, [
    L.labour(1, "flat", 180, {
      en: ["Component replacement labour", "Rotten jamb trim, bent hinges or rusted brackets cut out and replaced, then the door cycled to check its travel."],
      fr: ["Main-d'œuvre — remplacement de composants", "Moulures de jambage pourries, charnières tordues ou supports rouillés retirés et remplacés, puis porte actionnée pour vérifier sa course."],
      es: ["Mano de obra — reemplazo de componentes", "Molduras de jamba podridas, bisagras dobladas o soportes oxidados retirados y reemplazados, y luego la puerta accionada para revisar su recorrido."],
      it: ["Manodopera — sostituzione dei componenti", "Cornici marce, cerniere piegate o staffe arrugginite rimosse e sostituite, poi la porta azionata per verificarne la corsa."],
      de: ["Arbeitsleistung — Bauteiltausch", "Morsche Zargenleisten, verbogene Scharniere oder verrostete Halter herausgetrennt und ersetzt, dann das Tor zur Laufprüfung gefahren."],
      uk: ["Робота — заміна елементів", "Гнилі накладки, зігнуті петлі чи іржаві кронштейни вирізано та замінено, ворота прогнано для перевірки ходу."],
      tl: ["Trabaho — pagpapalit ng bahagi", "Tinanggal at pinalitan ang bulok na jamb trim, baluktot na bisagra o kalawanging bracket, pagkatapos pinaandar ang pinto para masuri ang takbo."],
    }, { cost: 90 }),
    L.material(1, "flat", 120, {
      en: ["Replacement trim, hinges and brackets", "PVC jamb trim, galvanised hinges and brackets in the sizes the door takes."],
      fr: ["Moulures, charnières et supports de rechange", "Moulures de jambage en PVC, charnières et supports galvanisés aux dimensions de la porte."],
      es: ["Molduras, bisagras y soportes de repuesto", "Molduras de jamba de PVC, bisagras y soportes galvanizados en las medidas de la puerta."],
      it: ["Cornici, cerniere e staffe di ricambio", "Cornici in PVC, cerniere e staffe zincate nelle misure della porta."],
      de: ["Ersatzleisten, Scharniere und Halter", "PVC-Zargenleisten, verzinkte Scharniere und Halter in den Maßen des Tors."],
      uk: ["Змінні накладки, петлі та кронштейни", "ПВХ-накладки, оцинковані петлі та кронштейни за розмірами воріт."],
      tl: ["Kapalit na trim, bisagra at bracket", "PVC jamb trim, galvanized na bisagra at bracket sa sukat ng pinto."],
    }, { cost: 90 }),
  ], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);

// ── Added 2026-09-25: the last three rows without a template ───────────────
//
// The booked spring visit and the two opener rows. Figures are the capture's
// (service call $79, torsion pair $225, opener diagnostic $95) and the
// benchmark medians on the opener rows ($125 service call, $99 adjustment);
// a matched pair of oil-tempered springs is $90–120 at the door distributor,
// costed like the other spring lines above. A second withTemplates pass, so
// the templates above stay byte-for-byte what they were. The service names in
// the other languages are read from ./i18n, which already carries every row —
// writing them a second time here would be the copy that rots.
const namesOf = (key) => {
  const s = I18N.services[key];
  return { it: s.it, de: s.de, uk: s.uk, tl: s.tl };
};
const ADDED = {
  "fq.garage_door.repair.spring_visit": T("repair", namesOf("fq.garage_door.repair.spring_visit"), [
    CALL(),
    L.labour(1, "flat", 225, {
      en: ["Torsion spring pair replacement — booked visit", "Door clamped, tension let off, both springs swapped as a pair, wound to the door's weight and the balance tested."],
      fr: ["Remplacement de la paire de ressorts de torsion — visite réservée", "Porte bloquée, tension relâchée, les deux ressorts changés en paire, remontés selon le poids de la porte et équilibre vérifié."],
      es: ["Cambio del par de resortes de torsión — visita agendada", "Puerta asegurada, tensión liberada, ambos resortes cambiados en par, tensados según el peso de la puerta y el balance probado."],
      it: ["Sostituzione coppia molle di torsione — visita prenotata", "Porta bloccata, tensione scaricata, entrambe le molle cambiate in coppia, caricate sul peso della porta e bilanciamento provato."],
      de: ["Torsionsfederpaar tauschen — gebuchter Termin", "Tor gesichert, Spannung abgelassen, beide Federn paarweise getauscht, auf das Torgewicht gespannt und die Balance geprüft."],
      uk: ["Заміна пари торсіонних пружин — запланований візит", "Ворота зафіксовано, натяг знято, обидві пружини замінено парою, закручено під вагу воріт і перевірено баланс."],
      tl: ["Palit ng pares ng torsion spring — naka-book na visit", "Kinlamp ang pinto, binitawan ang tension, pinalitan nang pares ang spring, pinaikot ayon sa bigat ng pinto at sinubukan ang balanse."],
    }),
    L.material(1, "each", 130, {
      en: ["Oil-tempered torsion springs — matched pair", "Two springs sized to the door's weight and height, with new winding cones where needed."],
      fr: ["Ressorts de torsion trempés à l'huile — paire assortie", "Deux ressorts dimensionnés selon le poids et la hauteur de la porte, avec cônes neufs au besoin."],
      es: ["Resortes de torsión templados en aceite — par a juego", "Dos resortes calculados para el peso y la altura de la puerta, con conos nuevos donde haga falta."],
      it: ["Molle di torsione temprate in olio — coppia abbinata", "Due molle dimensionate su peso e altezza della porta, con coni di carica nuovi dove serve."],
      de: ["Ölgehärtete Torsionsfedern — passendes Paar", "Zwei Federn passend zu Gewicht und Höhe des Tors, bei Bedarf mit neuen Spannkonen."],
      uk: ["Загартовані в олії торсіонні пружини — пара", "Дві пружини під вагу й висоту воріт, за потреби з новими конусами."],
      tl: ["Oil-tempered na torsion spring — pares", "Dalawang spring na sukat sa bigat at taas ng pinto, may bagong winding cone kung kailangan."],
    }, { cost: 100 }),
  ], null),

  "fq.garage_door.opener.repair_service_call": T("repair", namesOf("fq.garage_door.opener.repair_service_call"), [
    L.labour(1, "flat", 95, {
      en: ["Opener diagnosis on site", "Power, logic board, gear, sensors and remotes checked until the fault is found, then explained before any part is fitted."],
      fr: ["Diagnostic de l'ouvre-porte sur place", "Alimentation, carte logique, engrenage, capteurs et télécommandes vérifiés jusqu'à trouver la panne, expliquée avant de poser une pièce."],
      es: ["Diagnóstico del abridor en sitio", "Corriente, tarjeta, engrane, sensores y controles revisados hasta encontrar la falla, que se explica antes de poner cualquier pieza."],
      it: ["Diagnosi della motorizzazione sul posto", "Alimentazione, scheda, ingranaggio, fotocellule e telecomandi controllati fino a trovare il guasto, spiegato prima di montare qualsiasi pezzo."],
      de: ["Antriebsdiagnose vor Ort", "Strom, Steuerplatine, Zahnrad, Lichtschranke und Sender geprüft, bis der Fehler gefunden ist, und erklärt, bevor ein Teil eingebaut wird."],
      uk: ["Діагностика приводу на місці", "Живлення, плату, шестерню, датчики й пульти перевірено до виявлення несправності, яку пояснено до встановлення будь-якої деталі."],
      tl: ["Diagnosis ng opener sa bahay", "Chineck ang kuryente, logic board, gear, sensor at remote hanggang makita ang sira, at ipinaliwanag bago magkabit ng piyesa."],
    }),
    L.material(1, "flat", 30, {
      en: ["Small opener parts", "A sensor bracket, remote battery, wire connectors or travel-module screws used on the visit."],
      fr: ["Petites pièces d'ouvre-porte", "Support de capteur, pile de télécommande, connecteurs ou vis de module de course utilisés pendant la visite."],
      es: ["Piezas menores del abridor", "Soporte de sensor, pila del control, conectores o tornillos del módulo de recorrido usados en la visita."],
      it: ["Piccoli ricambi della motorizzazione", "Staffa della fotocellula, batteria del telecomando, morsetti o viti del modulo di corsa usati durante la visita."],
      de: ["Kleinteile für den Antrieb", "Lichtschrankenhalter, Senderbatterie, Klemmen oder Schrauben des Endlagenmoduls, beim Termin verbraucht."],
      uk: ["Дрібні деталі приводу", "Кронштейн датчика, батарейка пульта, клеми чи гвинти модуля ходу, використані під час візиту."],
      tl: ["Maliit na piyesa ng opener", "Sensor bracket, baterya ng remote, wire connector o turnilyo ng travel module na nagamit sa visit."],
    }),
  ], null),

  "fq.garage_door.opener.repair_adjustment": T("repair", namesOf("fq.garage_door.opener.repair_adjustment"), [
    L.labour(1, "flat", 85, {
      en: ["Opener limit and force adjustment", "Up and down travel limits reset, closing force set, sensors realigned and the auto-reverse tested against an obstruction."],
      fr: ["Réglage des limites et de la force de l'ouvre-porte", "Limites de course haut et bas refaites, force de fermeture réglée, capteurs réalignés et inversion automatique testée contre un obstacle."],
      es: ["Ajuste de límites y fuerza del abridor", "Límites de subida y bajada reajustados, fuerza de cierre calibrada, sensores realineados y la reversa automática probada contra un obstáculo."],
      it: ["Regolazione finecorsa e forza della motorizzazione", "Finecorsa di apertura e chiusura reimpostati, forza di chiusura regolata, fotocellule riallineate e inversione automatica provata contro un ostacolo."],
      de: ["Endlagen- und Krafteinstellung am Antrieb", "Endlagen oben und unten neu gesetzt, Schließkraft eingestellt, Lichtschranke ausgerichtet und die Reversierung an einem Hindernis geprüft."],
      uk: ["Налаштування меж ходу та зусилля приводу", "Верхню й нижню межі ходу скинуто, зусилля закриття налаштовано, датчики вирівняно, автореверс перевірено на перешкоді."],
      tl: ["Pag-adjust ng limit at force ng opener", "Inayos ulit ang taas at baba ng travel limit, ang closing force, inayos ang sensor at sinubukan ang auto-reverse sa harang."],
    }),
    SHARED.consumables(15),
  ], null),
};
withTemplates(SEED, ADDED);
