// app/data/serviceSeeds/janitorial.js
//
// The service list a janitorial / commercial cleaning company starts from.
// Read ./index.js for the format and the rules. Every row of the benchmark's
// janitorial book, recurring and one-time, in source order; each row is also
// tagged for the commercial_cleaning quote type (the catalogue has both), so
// a company that picked either is seeded once.
import { L, SHARED, D, T, withTemplates, tagRows } from "./_templateLines";
const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "janitorial",
  categories: [
    { key: "recurring", name: { en: "Recurring janitorial", fr: "Entretien ménager récurrent", es: "Limpieza comercial recurrente" } },
    { key: "one_time", name: { en: "One-time commercial cleaning", fr: "Nettoyage commercial ponctuel", es: "Limpieza comercial única" } },
    { key: "visits", name: { en: "Walkthroughs", fr: "Visites des lieux", es: "Recorridos" } },
  ],
  services: [
    S("fq.janitorial.recurring.office", "recurring", "flat", BM(135, 165, 210),
      ["Office and commercial cleaning — recurring", "Nettoyage de bureaux et commerces — récurrent", "Limpieza de oficinas y comercios — recurrente"],
      ["Desks, surfaces, kitchenette, restrooms and floors cleaned and bins emptied on a set schedule.", "Bureaux, surfaces, cuisinette, toilettes et planchers nettoyés et poubelles vidées selon un horaire fixe.", "Escritorios, superficies, cocineta, sanitarios y pisos limpios y botes vaciados con horario fijo."]),
    S("fq.janitorial.recurring.lobby", "recurring", "flat", BM(140, 175, 280),
      ["Reception and lobby cleaning — recurring", "Nettoyage de réception et de hall — récurrent", "Limpieza de recepción y vestíbulo — recurrente"],
      ["The entrance, reception desk, glass doors and seating area kept presentable for visitors.", "Entrée, comptoir d'accueil, portes vitrées et salle d'attente tenus présentables pour les visiteurs.", "Entrada, recepción, puertas de vidrio y área de espera presentables para los visitantes."]),
    S("fq.janitorial.recurring.kitchen_restroom", "recurring", "flat", BM(20, 40, 100),
      ["Kitchen and restroom cleaning — recurring", "Nettoyage de cuisinette et toilettes — récurrent", "Limpieza de cocina y sanitarios — recurrente"],
      ["Break-room kitchen and restrooms scrubbed and disinfected, fixtures polished and supplies restocked.", "Cuisinette et toilettes récurées et désinfectées, appareils sanitaires polis et fournitures remplies.", "Cocina del comedor y sanitarios tallados y desinfectados, muebles pulidos y consumibles repuestos."]),
    S("fq.janitorial.recurring.daytime", "recurring", "flat", BM(55, 70, 90),
      ["Daytime porter cleaning — recurring", "Entretien de jour — récurrent", "Limpieza diurna — recurrente"],
      ["A cleaner on site during business hours for spills, restrooms, high-touch points and the front of house.", "Préposé sur place pendant les heures d'ouverture pour les dégâts, les toilettes, les points de contact et l'accueil.", "Personal de limpieza en horario de oficina para derrames, sanitarios, puntos de contacto y el área de atención."]),
    S("fq.janitorial.recurring.dusting", "recurring", "flat", null,
      ["High and detail dusting — recurring", "Époussetage en hauteur et de détail — récurrent", "Sacudido alto y de detalle — recurrente"],
      ["Vents, ledges, blinds, light fixtures and the tops of cabinets dusted, the places a nightly clean skips.", "Grilles, rebords, stores, luminaires et dessus d'armoires époussetés, là où l'entretien du soir ne va pas.", "Rejillas, repisas, persianas, lámparas y la parte alta de muebles sacudidas, lo que la limpieza diaria omite."]),
    S("fq.janitorial.recurring.windows", "recurring", "flat", BM(10, 10, 217),
      ["Interior window and glass cleaning — recurring", "Lavage de vitres intérieures — récurrent", "Limpieza de vidrios interiores — recurrente"],
      ["Interior glass, partitions and door glass cleaned streak-free.", "Vitres intérieures, cloisons et portes vitrées nettoyées sans traces.", "Vidrios interiores, divisiones y puertas de vidrio limpios sin marcas."]),
    S("fq.janitorial.recurring.carpet", "recurring", "flat", BM(105, 120, 155),
      ["Commercial carpet cleaning — recurring", "Nettoyage de tapis commercial — récurrent", "Limpieza de alfombra comercial — recurrente"],
      ["Office carpet extracted or encapsulated, traffic lanes pre-treated and spots removed.", "Tapis de bureau extrait ou encapsulé, zones passantes prétraitées et taches enlevées.", "Alfombra de oficina extraída o encapsulada, zonas de tránsito pretratadas y manchas retiradas."]),
    S("fq.janitorial.recurring.hard_floor", "recurring", "flat", BM(100, 140, 184),
      ["Hard-surface floor care — recurring", "Entretien des planchers durs — récurrent", "Cuidado de pisos duros — recurrente"],
      ["Tile, vinyl and sealed concrete machine-scrubbed and, where they carry a finish, burnished.", "Céramique, vinyle et béton scellé récurés à la machine et, s'ils ont un fini, polis.", "Loseta, vinil y concreto sellado tallados a máquina y, si tienen acabado, abrillantados."]),
    S("fq.janitorial.recurring.restocking", "recurring", "flat", null,
      ["Supply restocking — recurring", "Réapprovisionnement des fournitures — récurrent", "Reposición de consumibles — recurrente"],
      ["Paper, soap, liners and sanitiser refilled in every restroom and kitchen.", "Papier, savon, sacs et désinfectant remplis dans chaque toilette et cuisinette.", "Papel, jabón, bolsas y gel sanitizante repuestos en cada sanitario y cocina."]),
    S("fq.janitorial.recurring.waste", "recurring", "flat", BM(50, 200, 225),
      ["Waste and recycling removal — recurring", "Enlèvement des déchets et du recyclage — récurrent", "Retiro de basura y reciclaje — recurrente"],
      ["Bins emptied, liners replaced and waste and recycling taken to the building's collection point.", "Poubelles vidées, sacs remplacés, déchets et recyclage apportés au point de collecte de l'immeuble.", "Botes vaciados, bolsas cambiadas y basura y reciclaje llevados al punto de recolección del edificio."]),
    S("fq.janitorial.recurring.sanitation", "recurring", "flat", null,
      ["Disinfection of touch points — recurring", "Désinfection des points de contact — récurrent", "Desinfección de puntos de contacto — recurrente"],
      ["Handles, switches, rails, phones and shared equipment disinfected with a registered product.", "Poignées, interrupteurs, rampes, téléphones et équipement partagé désinfectés avec un produit homologué.", "Manijas, apagadores, barandales, teléfonos y equipo compartido desinfectados con producto registrado."]),
    S("fq.janitorial.recurring.other", "recurring", "flat", null,
      ["Other commercial cleaning — recurring, describe what you need", "Autre nettoyage commercial — récurrent, décrivez le besoin", "Otra limpieza comercial — recurrente, describa lo que necesita"],
      ["Cleaning work not listed above, priced after a walkthrough of the premises.", "Travail de nettoyage non listé ci-dessus, chiffré après une visite des lieux.", "Trabajo de limpieza no listado arriba, cotizado después de recorrer el local."]),
    S("fq.janitorial.one_time.office", "one_time", "flat", BM(80, 140, 200),
      ["Office and commercial cleaning — one-time", "Nettoyage de bureaux et commerces — ponctuel", "Limpieza de oficinas y comercios — única"],
      ["Desks, surfaces, kitchenette, restrooms and floors cleaned and bins emptied in a single visit.", "Bureaux, surfaces, cuisinette, toilettes et planchers nettoyés et poubelles vidées en une seule visite.", "Escritorios, superficies, cocineta, sanitarios y pisos limpios y botes vaciados en una sola visita."]),
    S("fq.janitorial.one_time.lobby", "one_time", "flat", null,
      ["Reception and lobby cleaning — one-time", "Nettoyage de réception et de hall — ponctuel", "Limpieza de recepción y vestíbulo — única"],
      ["The entrance, reception desk, glass doors and seating area kept presentable for visitors.", "Entrée, comptoir d'accueil, portes vitrées et salle d'attente tenus présentables pour les visiteurs.", "Entrada, recepción, puertas de vidrio y área de espera presentables para los visitantes."]),
    S("fq.janitorial.one_time.kitchen_restroom", "one_time", "flat", BM(150, 225, 225),
      ["Kitchen and restroom cleaning — one-time", "Nettoyage de cuisinette et toilettes — ponctuel", "Limpieza de cocina y sanitarios — única"],
      ["Break-room kitchen and restrooms scrubbed and disinfected, fixtures polished and supplies restocked.", "Cuisinette et toilettes récurées et désinfectées, appareils sanitaires polis et fournitures remplies.", "Cocina del comedor y sanitarios tallados y desinfectados, muebles pulidos y consumibles repuestos."]),
    S("fq.janitorial.one_time.daytime", "one_time", "flat", BM(110, 220, 330),
      ["Daytime porter cleaning — one-time", "Entretien de jour — ponctuel", "Limpieza diurna — única"],
      ["A cleaner on site during business hours for spills, restrooms, high-touch points and the front of house.", "Préposé sur place pendant les heures d'ouverture pour les dégâts, les toilettes, les points de contact et l'accueil.", "Personal de limpieza en horario de oficina para derrames, sanitarios, puntos de contacto y el área de atención."]),
    S("fq.janitorial.one_time.dusting", "one_time", "flat", null,
      ["High and detail dusting — one-time", "Époussetage en hauteur et de détail — ponctuel", "Sacudido alto y de detalle — única"],
      ["Vents, ledges, blinds, light fixtures and the tops of cabinets dusted, the places a nightly clean skips.", "Grilles, rebords, stores, luminaires et dessus d'armoires époussetés, là où l'entretien du soir ne va pas.", "Rejillas, repisas, persianas, lámparas y la parte alta de muebles sacudidas, lo que la limpieza diaria omite."]),
    S("fq.janitorial.one_time.windows", "one_time", "flat", BM(25, 55, 221),
      ["Interior window and glass cleaning — one-time", "Lavage de vitres intérieures — ponctuel", "Limpieza de vidrios interiores — única"],
      ["Interior glass, partitions and door glass cleaned streak-free.", "Vitres intérieures, cloisons et portes vitrées nettoyées sans traces.", "Vidrios interiores, divisiones y puertas de vidrio limpios sin marcas."]),
    S("fq.janitorial.one_time.carpet", "one_time", "flat", BM(104, 200, 271),
      ["Commercial carpet cleaning — one-time", "Nettoyage de tapis commercial — ponctuel", "Limpieza de alfombra comercial — única"],
      ["Office carpet extracted or encapsulated, traffic lanes pre-treated and spots removed.", "Tapis de bureau extrait ou encapsulé, zones passantes prétraitées et taches enlevées.", "Alfombra de oficina extraída o encapsulada, zonas de tránsito pretratadas y manchas retiradas."]),
    S("fq.janitorial.one_time.hard_floor", "one_time", "flat", BM(90, 95, 200),
      ["Hard-surface floor care — one-time", "Entretien des planchers durs — ponctuel", "Cuidado de pisos duros — única"],
      ["Tile, vinyl and sealed concrete machine-scrubbed and, where they carry a finish, burnished.", "Céramique, vinyle et béton scellé récurés à la machine et, s'ils ont un fini, polis.", "Loseta, vinil y concreto sellado tallados a máquina y, si tienen acabado, abrillantados."]),
    S("fq.janitorial.one_time.restocking", "one_time", "flat", null,
      ["Supply restocking — one-time", "Réapprovisionnement des fournitures — ponctuel", "Reposición de consumibles — única"],
      ["Paper, soap, liners and sanitiser refilled in every restroom and kitchen.", "Papier, savon, sacs et désinfectant remplis dans chaque toilette et cuisinette.", "Papel, jabón, bolsas y gel sanitizante repuestos en cada sanitario y cocina."]),
    S("fq.janitorial.one_time.waste", "one_time", "flat", BM(50, 50, 50),
      ["Waste and recycling removal — one-time", "Enlèvement des déchets et du recyclage — ponctuel", "Retiro de basura y reciclaje — única"],
      ["Bins emptied, liners replaced and waste and recycling taken to the building's collection point.", "Poubelles vidées, sacs remplacés, déchets et recyclage apportés au point de collecte de l'immeuble.", "Botes vaciados, bolsas cambiadas y basura y reciclaje llevados al punto de recolección del edificio."]),
    S("fq.janitorial.one_time.sanitation", "one_time", "flat", null,
      ["Disinfection of touch points — one-time", "Désinfection des points de contact — ponctuel", "Desinfección de puntos de contacto — única"],
      ["Handles, switches, rails, phones and shared equipment disinfected with a registered product.", "Poignées, interrupteurs, rampes, téléphones et équipement partagé désinfectés avec un produit homologué.", "Manijas, apagadores, barandales, teléfonos y equipo compartido desinfectados con producto registrado."]),
    S("fq.janitorial.one_time.other", "one_time", "flat", null,
      ["Other commercial cleaning — one-time, describe what you need", "Autre nettoyage commercial — ponctuel, décrivez le besoin", "Otra limpieza comercial — única, describa lo que necesita"],
      ["Cleaning work not listed above, priced after a walkthrough of the premises.", "Travail de nettoyage non listé ci-dessus, chiffré après une visite des lieux.", "Trabajo de limpieza no listado arriba, cotizado después de recorrer el local."]),
    S("fq.janitorial.visits.site_walkthrough", "visits", "flat", null,
      ["Commercial cleaning walkthrough and bid", "Visite des lieux et soumission — nettoyage commercial", "Recorrido y cotización de limpieza comercial"],
      ["The premises walked with the manager, square footage and restrooms counted, access hours noted and a written bid left.", "Locaux parcourus avec le gestionnaire, superficie et toilettes comptées, heures d'accès notées et soumission écrite remise.", "Local recorrido con el encargado, superficie y sanitarios contados, horarios de acceso anotados y cotización por escrito."], { durationMinutes: 45, bookable: true }),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the benchmark medians on the janitorial rows ($165 a recurring
// office visit, $140 a one-time office clean, $40 recurring kitchen and
// restroom, $140 recurring hard floors, $200 one-time carpet) set the
// totals; the lines are 2026 commercial rates — $0.09–0.12 a sq ft for a
// recurring clean, $45 a restroom, floor burnishing $0.20 a sq ft. Office
// area is the typed `areaSqFt`, restrooms a count (`each`).
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const t7 = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });
const AREA = (price, en7) => L.labour(1, "sqft", price, en7, { measurementKey: "areaSqFt" });
const RESTROOM = (price = 45) => L.labour(1, "each", price, t7(
  ["Restroom — per restroom", "Fixtures, partitions, mirrors and floor disinfected, supplies refilled."],
  ["Toilettes — l'unité", "Appareils, cloisons, miroirs et plancher désinfectés, fournitures remplies."],
  ["Sanitario — por sanitario", "Muebles, divisiones, espejos y piso desinfectados, consumibles repuestos."],
  ["Bagno — cadauno", "Sanitari, divisori, specchi e pavimento igienizzati, forniture ripristinate."],
  ["WC-Raum — pro Raum", "Objekte, Trennwände, Spiegel und Boden desinfiziert, Verbrauchsmaterial aufgefüllt."],
  ["Туалет — за приміщення", "Сантехніку, перегородки, дзеркала й підлогу продезінфіковано, витратні матеріали поповнено."],
  ["CR — kada CR", "Dinisinfect ang fixture, partition, salamin at sahig at nilagyan ng supply."],
), { measurementKey: "each" });

const TEMPLATES = {
  "fq.janitorial.one_time.office": T("installation", n(
    ["Pulizia uffici e locali commerciali — una tantum", "Scrivanie, superfici, angolo cottura, bagni e pavimenti puliti e cestini svuotati in una sola visita."],
    ["Büro- und Gewerbereinigung — einmalig", "Schreibtische, Flächen, Teeküche, WCs und Böden gereinigt und Behälter geleert, in einem Einsatz."],
    ["Прибирання офісів і комерційних приміщень — разове", "Столи, поверхні, міні-кухню, туалети й підлогу прибрано, кошики спорожнено за один візит."],
    ["Paglilinis ng opisina at commercial — isang beses", "Nilinis ang mesa, ibabaw, pantry, CR at sahig at inalis ang basura sa isang visit."],
  ), [AREA(0.14, t7(
    ["Initial office clean — per sq ft", "A top-to-bottom first clean of the office floor area."],
    ["Nettoyage initial — au pi²", "Premier nettoyage complet de la surface des bureaux."],
    ["Limpieza inicial — por pie²", "Primera limpieza completa del área de oficinas."],
    ["Pulizia iniziale — al piede quadro", "Prima pulizia completa della superficie degli uffici."],
    ["Grundreinigung — pro sq ft", "Erste gründliche Reinigung der Bürofläche."],
    ["Початкове прибирання — за кв. фут", "Перше повне прибирання площі офісу."],
    ["Initial na paglilinis — kada sq ft", "Unang buong paglilinis ng sahig ng opisina."],
  )), RESTROOM(55)], D.newCustomer("percent", 10)),

  "fq.janitorial.one_time.carpet": T("repair", n(
    ["Pulizia moquette commerciale — una tantum", "Moquette dell'ufficio estratta o incapsulata, corsie di passaggio pretrattate e macchie rimosse."],
    ["Gewerbliche Teppichreinigung — einmalig", "Büroteppich extrahiert oder verkapselt, Laufstraßen vorbehandelt und Flecken entfernt."],
    ["Чищення комерційного покриття — разове", "Офісне покриття екстраговано чи інкапсульовано, доріжки попередньо оброблено, плями видалено."],
    ["Paglilinis ng commercial carpet — isang beses", "In-extract o in-encapsulate ang carpet ng opisina, pre-treated ang daanan at inalis ang mantsa."],
  ), [AREA(0.25, t7(
    ["Commercial carpet extraction — per sq ft", "Pre-sprayed, extracted and groomed, furniture worked around."],
    ["Extraction de tapis commercial — au pi²", "Prévaporisé, extrait et peigné, autour du mobilier."],
    ["Extracción de alfombra comercial — por pie²", "Prerrociado, extraído y peinado, alrededor del mobiliario."],
    ["Estrazione moquette commerciale — al piede quadro", "Pretrattata, estratta e pettinata, attorno agli arredi."],
    ["Teppichextraktion gewerblich — pro sq ft", "Vorgesprüht, extrahiert und gebürstet, um die Möbel herum."],
    ["Екстракція комерційного покриття — за кв. фут", "Попередньо оброблено, екстраговано й розчесано навколо меблів."],
    ["Commercial carpet extraction — kada sq ft", "Pre-spray, extract at sinuklay, iniikutan ang muwebles."],
  ))], null),

  "fq.janitorial.one_time.hard_floor": T("repair", n(
    ["Cura pavimenti duri — una tantum", "Piastrelle, vinile e calcestruzzo sigillato lavati a macchina e, se hanno finitura, lucidati."],
    ["Hartbodenpflege — einmalig", "Fliesen, Vinyl und versiegelter Beton maschinell geschrubbt und, wo beschichtet, poliert."],
    ["Догляд за твердими підлогами — разовий", "Плитку, вініл і герметизований бетон вимито машиною та, де є покриття, відполіровано."],
    ["Pag-aalaga ng matigas na sahig — isang beses", "Kinuskos ng makina ang tile, vinyl at sealed concrete at pinakintab kung may finish."],
  ), [AREA(0.35, t7(
    ["Strip and refinish — per sq ft", "Old finish stripped, floor rinsed, three coats of finish laid and burnished."],
    ["Décapage et refinition — au pi²", "Ancien fini décapé, plancher rincé, trois couches de fini appliquées et polies."],
    ["Decapado y reacabado — por pie²", "Acabado viejo retirado, piso enjuagado, tres capas de acabado y abrillantado."],
    ["Decerata e rifinitura — al piede quadro", "Vecchia finitura rimossa, pavimento risciacquato, tre mani di finitura e lucidatura."],
    ["Grundreinigung und Neubeschichtung — pro sq ft", "Alte Beschichtung entfernt, Boden gespült, drei Schichten aufgetragen und poliert."],
    ["Зняття й нове покриття — за кв. фут", "Старе покриття знято, підлогу промито, нанесено три шари й відполіровано."],
    ["Strip at refinish — kada sq ft", "Tinanggal ang lumang finish, binanlawan, tatlong patong at pinakintab."],
  )), L.material(1, "sqft", 0.08, t7(
    ["Floor finish and stripper — per sq ft", "Commercial floor stripper and high-solids finish."],
    ["Fini et décapant — au pi²", "Décapant commercial et fini à haute teneur en solides."],
    ["Acabado y removedor — por pie²", "Removedor comercial y acabado de alto sólido."],
    ["Finitura e decerante — al piede quadro", "Decerante professionale e finitura ad alto residuo secco."],
    ["Beschichtung und Stripper — pro sq ft", "Gewerblicher Stripper und Hochfeststoff-Beschichtung."],
    ["Покриття та засіб для зняття — за кв. фут", "Професійний засіб для зняття й покриття з високим сухим залишком."],
    ["Floor finish at stripper — kada sq ft", "Commercial stripper at high-solids na finish."],
  ), { measurementKey: "areaSqFt" })], null),

  "fq.janitorial.visits.site_walkthrough": T("inspection", n(
    ["Sopralluogo e offerta per pulizia commerciale", "Locali percorsi con il responsabile, superficie e bagni contati, orari di accesso annotati e offerta scritta."],
    ["Objektbegehung und Angebot Gewerbereinigung", "Räume mit der Leitung begangen, Fläche und WCs gezählt, Zugangszeiten notiert und schriftliches Angebot hinterlassen."],
    ["Огляд і пропозиція на комерційне прибирання", "Приміщення обійдено з керівником, площу й туалети пораховано, години доступу записано, залишено письмову пропозицію."],
    ["Walkthrough at bid ng commercial na paglilinis", "Nilibot kasama ang manager, binilang ang sukat at CR, isinulat ang oras ng access at iniwan ang bid."],
  ), [L.labour(1, "flat", 0, t7(
    ["Walkthrough and bid", "Areas measured and a written bid left; free."],
    ["Visite et soumission", "Surfaces mesurées et soumission écrite remise; gratuit."],
    ["Recorrido y cotización", "Áreas medidas y cotización por escrito; sin costo."],
    ["Sopralluogo e offerta", "Aree misurate e offerta scritta lasciata; gratuito."],
    ["Begehung und Angebot", "Flächen gemessen und schriftliches Angebot hinterlassen; kostenlos."],
    ["Огляд і пропозиція", "Площі виміряно, письмову пропозицію залишено; безкоштовно."],
    ["Walkthrough at bid", "Sinukat ang lugar at iniwan ang nakasulat na bid; libre."],
  ), { cost: 0 })], null),

  "fq.janitorial.recurring.office": T("maintenance", n(
    ["Pulizia uffici e locali commerciali — ricorrente", "Scrivanie, superfici, angolo cottura, bagni e pavimenti puliti e cestini svuotati secondo un calendario fisso."],
    ["Büro- und Gewerbereinigung — regelmäßig", "Schreibtische, Flächen, Teeküche, WCs und Böden nach festem Plan gereinigt, Behälter geleert."],
    ["Прибирання офісів і комерційних приміщень — регулярне", "Столи, поверхні, міні-кухню, туалети й підлогу прибрано за сталим графіком, кошики спорожнено."],
    ["Paglilinis ng opisina at commercial — regular", "Nililinis ang mesa, ibabaw, pantry, CR at sahig at inaalis ang basura sa nakatakdang schedule."],
  ), [AREA(0.09, t7(
    ["Recurring office clean — per sq ft per visit", "Floors, surfaces and break area cleaned and trash removed each visit."],
    ["Entretien récurrent — au pi² par visite", "Planchers, surfaces et salle de pause nettoyés, poubelles vidées à chaque visite."],
    ["Limpieza recurrente — por pie² por visita", "Pisos, superficies y comedor limpios y basura retirada en cada visita."],
    ["Pulizia ricorrente — al piede quadro per visita", "Pavimenti, superfici e area ristoro puliti e rifiuti rimossi a ogni visita."],
    ["Unterhaltsreinigung — pro sq ft und Einsatz", "Böden, Flächen und Pausenraum bei jedem Einsatz gereinigt, Müll entsorgt."],
    ["Регулярне прибирання — за кв. фут за візит", "Підлогу, поверхні й зону відпочинку прибрано, сміття винесено щоразу."],
    ["Regular na paglilinis — kada sq ft kada visit", "Nililinis ang sahig, ibabaw at break area at inaalis ang basura bawat visit."],
  )), RESTROOM()], D.regular("percent", 5)),

  "fq.janitorial.recurring.kitchen_restroom": T("maintenance", n(
    ["Pulizia cucina e bagni — ricorrente", "Cucina della sala pausa e bagni strofinati e igienizzati, sanitari lucidati e forniture ripristinate."],
    ["Küchen- und WC-Reinigung — regelmäßig", "Teeküche und WCs geschrubbt und desinfiziert, Armaturen poliert und Verbrauchsmaterial aufgefüllt."],
    ["Прибирання кухні й туалетів — регулярне", "Кухню й туалети відтерто й продезінфіковано, сантехніку відполіровано, витратні матеріали поповнено."],
    ["Paglilinis ng kusina at CR — regular", "Kinuskos at dinisinfect ang pantry at CR, pinakintab ang fixture at nilagyan ng supply."],
  ), [RESTROOM(), L.labour(1, "flat", 35, t7(
    ["Break-room kitchen", "Counters, sink, appliances and floor cleaned."],
    ["Cuisinette", "Comptoirs, évier, appareils et plancher nettoyés."],
    ["Cocina del comedor", "Cubiertas, fregadero, electrodomésticos y piso limpios."],
    ["Angolo cottura", "Piani, lavello, elettrodomestici e pavimento puliti."],
    ["Teeküche", "Arbeitsflächen, Spüle, Geräte und Boden gereinigt."],
    ["Міні-кухня", "Стільниці, мийку, техніку й підлогу прибрано."],
    ["Pantry", "Nilinis ang counter, lababo, appliance at sahig."],
  ))], null),
};

withTemplates(SEED, TEMPLATES);

// Janitorial and commercial cleaning are two catalogue trades for one kind of
// company; every row is offered on both.
tagRows(SEED, Object.fromEntries(SEED.services.map((s) => [s.seedKey, ["commercial_cleaning"]])));
