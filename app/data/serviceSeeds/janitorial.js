// app/data/serviceSeeds/janitorial.js
//
// The service list a janitorial / commercial cleaning company starts from.
// Read ./index.js for the format and the rules. Every row of the benchmark's
// janitorial book, recurring and one-time, in source order; each row is also
// tagged for the commercial_cleaning quote type (the catalogue has both), so
// a company that picked either is seeded once.
import { L, SHARED, D, T, withTemplates, tagRows, withLanguages } from "./_templateLines";
import { I18N } from "./i18n/janitorial.js";
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

// ── Templates added 2026-09-25 ───────────────────────────────────────────────
//
// The owner (2026-09-25): a service added to a quote opens WITH its lines.
// Where a row carries a benchmark the lines add up to its median — lobby $175
// (desk and floor, entrance glass, mats), porter $70 recurring / $220 one-time
// (hours at $32–35 plus the cart), waste $200 / $50, glass $10 a pane
// recurring and $55 for a one-time visit, kitchen and restroom $225 — so the
// preset and the lines tell the same story. Rows without one use 2026
// commercial rates: detail dusting $0.03–0.05 a sq ft, encapsulation $0.12,
// scrub and burnish $0.12, touch-point disinfection $45–75 a visit,
// restocking $25–35 plus supplies at cost plus handling. Floor area is the
// typed `areaSqFt`; panes and restrooms are counts (`each`).
//
// Punjabi is written inline beside the other seven (the line builder reads
// `text.pa` before the language file); the restroom and break-room lines the
// templates above already sell are reused, not retyped.
//
// Not templated: recurring.other and one_time.other — "describe what you
// need" has no typical lines; the walkthrough row carries the visit.
//
// Every row here is already tagged for commercial_cleaning by tagRows below.
const t8 = (en, fr, es, it, de, uk, tl, pa) => ({ en, fr, es, it, de, uk, tl, pa });
const namesOf = (key) => {
  const s = I18N.services?.[key];
  if (!s?.it || !s?.de || !s?.uk || !s?.tl) throw new Error(`janitorial: ${key} has no it/de/uk/tl name in i18n/janitorial.js`);
  return { it: s.it, de: s.de, uk: s.uk, tl: s.tl, pa: s.pa };
};
const BREAK_ROOM = (price) => L.labour(1, "flat", price, TEMPLATES["fq.janitorial.recurring.kitchen_restroom"].lines.find((l) => l.text.en[0] === "Break-room kitchen").text);
const LOBBY = (desk, glass, mats) => [
  L.labour(1, "flat", desk, t8(
    ["Lobby and reception clean", "Reception desk, seating, tables and the lobby floor cleaned, bins emptied."],
    ["Entretien du hall et de l'accueil", "Comptoir d'accueil, sièges, tables et plancher du hall nettoyés, poubelles vidées."],
    ["Limpieza de vestíbulo y recepción", "Mostrador, asientos, mesas y piso del vestíbulo limpios, botes vaciados."],
    ["Pulizia atrio e reception", "Bancone, sedute, tavolini e pavimento dell'atrio puliti, cestini svuotati."],
    ["Foyer- und Empfangsreinigung", "Empfangstheke, Sitzplätze, Tische und Foyerboden gereinigt, Behälter geleert."],
    ["Прибирання холу й рецепції", "Стійку рецепції, сидіння, столики й підлогу холу прибрано, кошики спорожнено."],
    ["Paglilinis ng lobby at reception", "Nilinis ang reception desk, upuan, mesa at sahig ng lobby, inalis ang basura."],
    ["ਲਾਬੀ ਅਤੇ ਰਿਸੈਪਸ਼ਨ ਦੀ ਸਫ਼ਾਈ", "ਰਿਸੈਪਸ਼ਨ ਡੈਸਕ, ਸੀਟਾਂ, ਮੇਜ਼ ਅਤੇ ਲਾਬੀ ਦਾ ਫ਼ਰਸ਼ ਸਾਫ਼, ਕੂੜਾਦਾਨ ਖ਼ਾਲੀ।"],
  )),
  L.labour(1, "flat", glass, t8(
    ["Entrance glass and door detail", "Entry doors, sidelights and push plates cleaned streak-free, handles disinfected."],
    ["Vitres et portes d'entrée en détail", "Portes d'entrée, vitres latérales et plaques de poussée nettoyées sans traces, poignées désinfectées."],
    ["Detalle de vidrios y puertas de entrada", "Puertas de entrada, vidrios laterales y placas de empuje limpios sin marcas, manijas desinfectadas."],
    ["Dettaglio vetri e porte d'ingresso", "Porte d'ingresso, vetri laterali e piastre di spinta puliti senza aloni, maniglie disinfettate."],
    ["Eingangsglas und Türen im Detail", "Eingangstüren, Seitenteile und Schiebeplatten streifenfrei gereinigt, Griffe desinfiziert."],
    ["Детальне чищення вхідного скла й дверей", "Вхідні двері, бічне скло й накладки вимито без розводів, ручки продезінфіковано."],
    ["Detalye ng salamin at pinto sa entrance", "Nilinis nang walang guhit ang pinto, sidelight at push plate, dinisinfect ang hawakan."],
    ["ਦਾਖ਼ਲੇ ਦੇ ਸ਼ੀਸ਼ੇ ਅਤੇ ਦਰਵਾਜ਼ੇ ਦੀ ਬਾਰੀਕ ਸਫ਼ਾਈ", "ਦਾਖ਼ਲੇ ਦੇ ਦਰਵਾਜ਼ੇ, ਪਾਸੇ ਦੇ ਸ਼ੀਸ਼ੇ ਅਤੇ ਪੁਸ਼ ਪਲੇਟਾਂ ਬਿਨਾਂ ਧਾਰੀਆਂ ਸਾਫ਼, ਹੈਂਡਲ ਕੀਟਾਣੂ-ਰਹਿਤ।"],
  )),
  L.labour(1, "flat", mats, t8(
    ["Entry mats", "Walk-off mats vacuumed, spots treated and the floor beneath swept."],
    ["Tapis d'entrée", "Tapis d'entrée aspirés, taches traitées et plancher dessous balayé."],
    ["Tapetes de entrada", "Tapetes de entrada aspirados, manchas tratadas y el piso de abajo barrido."],
    ["Zerbini d'ingresso", "Zerbini aspirati, macchie trattate e pavimento sottostante spazzato."],
    ["Eingangsmatten", "Sauberlaufmatten gesaugt, Flecken behandelt und der Boden darunter gefegt."],
    ["Вхідні килимки", "Килимки пропилососено, плями оброблено, підлогу під ними підметено."],
    ["Mga mat sa entrance", "Binakyum ang walk-off mat, tinrato ang mantsa at winalis ang sahig sa ilalim."],
    ["ਦਾਖ਼ਲੇ ਦੇ ਮੈਟ", "ਪੈਰ ਪੂੰਝਣ ਵਾਲੇ ਮੈਟ ਵੈਕਿਊਮ, ਦਾਗ਼ ਸਾਫ਼ ਅਤੇ ਹੇਠਾਂ ਵਾਲਾ ਫ਼ਰਸ਼ ਹੂੰਝਿਆ।"],
  )),
];
const PORTER = (hours, rate, supplies) => [
  L.labour(hours, "hour", rate, t8(
    ["Day porter — per hour", "A uniformed cleaner on site in business hours: spills, restrooms, touch points and the front of house."],
    ["Préposé de jour — à l'heure", "Préposé en uniforme sur place pendant les heures d'ouverture : dégâts, toilettes, points de contact et accueil."],
    ["Personal de limpieza diurno — por hora", "Personal uniformado en horario de oficina: derrames, sanitarios, puntos de contacto y área de atención."],
    ["Addetto diurno — a ore", "Addetto in divisa sul posto in orario d'ufficio: versamenti, bagni, punti di contatto e ingresso."],
    ["Tagesreinigungskraft — pro Stunde", "Reinigungskraft in Dienstkleidung während der Geschäftszeiten: Verschüttetes, WCs, Kontaktflächen und Empfang."],
    ["Денний прибиральник — за годину", "Прибиральник у формі на місці в робочі години: розливи, туалети, поверхні дотику й зона прийому."],
    ["Day porter — kada oras", "Naka-uniform na cleaner habang bukas: natapon, CR, hinahawakan at harapan."],
    ["ਦਿਨ ਦਾ ਪੋਰਟਰ — ਪ੍ਰਤੀ ਘੰਟਾ", "ਕੰਮ ਦੇ ਘੰਟਿਆਂ ਦੌਰਾਨ ਵਰਦੀ ਵਾਲਾ ਸਫ਼ਾਈ ਕਰਮੀ: ਡੁੱਲ੍ਹਿਆ, ਟਾਇਲਟ, ਛੂਹਣ ਵਾਲੀਆਂ ਥਾਵਾਂ ਅਤੇ ਮੂਹਰਲਾ ਹਿੱਸਾ।"],
  )),
  L.material(1, "flat", supplies, t8(
    ["Porter cart supplies", "Spill kit, disinfectant wipes and microfibre carried on the porter's cart."],
    ["Fournitures du chariot", "Trousse antidéversement, lingettes désinfectantes et microfibre sur le chariot du préposé."],
    ["Insumos del carrito", "Kit para derrames, toallitas desinfectantes y microfibra en el carrito."],
    ["Forniture del carrello", "Kit antisversamento, salviette disinfettanti e microfibra sul carrello dell'addetto."],
    ["Material für den Reinigungswagen", "Auslaufset, Desinfektionstücher und Mikrofaser auf dem Wagen."],
    ["Витратні матеріали для візка", "Набір для розливів, дезінфікуючі серветки й мікрофібра на візку прибиральника."],
    ["Supply sa cart ng porter", "Spill kit, disinfectant wipes at microfibre sa cart ng porter."],
    ["ਪੋਰਟਰ ਦੀ ਗੱਡੀ ਦਾ ਸਮਾਨ", "ਡੁੱਲ੍ਹੇ ਲਈ ਕਿੱਟ, ਕੀਟਾਣੂਨਾਸ਼ਕ ਵਾਈਪਸ ਅਤੇ ਮਾਈਕ੍ਰੋਫ਼ਾਈਬਰ ਪੋਰਟਰ ਦੀ ਗੱਡੀ 'ਤੇ।"],
  )),
];
const DUSTING = (rate, supplies) => [
  AREA(rate, t8(
    ["High and detail dusting — per sq ft", "Vents, ledges, blinds, light fixtures and cabinet tops dusted with extension tools."],
    ["Époussetage en hauteur — au pi²", "Grilles, rebords, stores, luminaires et dessus d'armoires époussetés avec perches."],
    ["Sacudido alto y de detalle — por pie²", "Rejillas, repisas, persianas, lámparas y parte alta de muebles sacudidas con extensiones."],
    ["Spolveratura in alto e di dettaglio — al piede quadro", "Bocchette, davanzali, tende, lampade e sommità dei mobili spolverati con aste telescopiche."],
    ["Hoch- und Detailstaubwischen — pro sq ft", "Lüftungsgitter, Simse, Jalousien, Leuchten und Schrankoberseiten mit Teleskopgeräten entstaubt."],
    ["Висотне й детальне витирання пилу — за кв. фут", "Решітки, виступи, жалюзі, світильники й верх шаф очищено від пилу телескопічними насадками."],
    ["High at detail dusting — kada sq ft", "Pinunasan ang vent, ledge, blinds, ilaw at ibabaw ng cabinet gamit ang extension tool."],
    ["ਉੱਚੀ ਅਤੇ ਬਾਰੀਕ ਧੂੜ-ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਵੈਂਟ, ਕਿਨਾਰੇ, ਬਲਾਈਂਡ, ਲਾਈਟਾਂ ਅਤੇ ਅਲਮਾਰੀਆਂ ਦੇ ਉੱਪਰੋਂ ਲੰਬੇ ਔਜ਼ਾਰਾਂ ਨਾਲ ਧੂੜ ਸਾਫ਼।"],
  )),
  L.material(1, "flat", supplies, t8(
    ["Duster heads and microfibre", "Replaceable duster heads and microfibre cloths used up on the job."],
    ["Têtes de plumeau et microfibre", "Têtes de plumeau remplaçables et chiffons microfibre utilisés sur le chantier."],
    ["Cabezales de plumero y microfibra", "Cabezales de plumero reemplazables y paños de microfibra usados en el trabajo."],
    ["Testine piumino e microfibra", "Testine per piumino sostituibili e panni in microfibra consumati sul lavoro."],
    ["Staubwedelköpfe und Mikrofaser", "Austauschbare Staubwedelköpfe und Mikrofasertücher, die der Auftrag verbraucht."],
    ["Насадки для змітання пилу й мікрофібра", "Змінні насадки й мікрофіброві серветки, що витрачаються на роботі."],
    ["Duster head at microfibre", "Napapalitang duster head at microfibre na tela na nagagamit sa trabaho."],
    ["ਡਸਟਰ ਹੈੱਡ ਅਤੇ ਮਾਈਕ੍ਰੋਫ਼ਾਈਬਰ", "ਬਦਲਣਯੋਗ ਡਸਟਰ ਹੈੱਡ ਅਤੇ ਕੰਮ ਵਿੱਚ ਲੱਗਣ ਵਾਲੇ ਮਾਈਕ੍ਰੋਫ਼ਾਈਬਰ ਕੱਪੜੇ।"],
  )),
];
const PANE = () => L.labour(1, "each", 8, t8(
  ["Interior glass — per pane", "One pane of interior window, partition or door glass cleaned streak-free, frame wiped."],
  ["Vitre intérieure — le carreau", "Un carreau de fenêtre, cloison ou porte vitrée intérieure nettoyé sans traces, cadre essuyé."],
  ["Vidrio interior — por panel", "Un panel de ventana, división o puerta de vidrio interior limpio sin marcas, marco limpiado."],
  ["Vetro interno — per lastra", "Una lastra di finestra, divisorio o porta interna pulita senza aloni, telaio pulito."],
  ["Innenglas — pro Scheibe", "Eine Scheibe von Innenfenster, Trennwand oder Glastür streifenfrei gereinigt, Rahmen gewischt."],
  ["Внутрішнє скло — за шибку", "Одну шибку вікна, перегородки чи дверей усередині вимито без розводів, раму протерто."],
  ["Salamin sa loob — kada pane", "Isang pane ng bintana, partition o pintong salamin sa loob na nilinis nang walang guhit, pinunasan ang frame."],
  ["ਅੰਦਰਲਾ ਸ਼ੀਸ਼ਾ — ਪ੍ਰਤੀ ਪੈਨ", "ਅੰਦਰਲੀ ਖਿੜਕੀ, ਪਾਰਟੀਸ਼ਨ ਜਾਂ ਦਰਵਾਜ਼ੇ ਦਾ ਇੱਕ ਸ਼ੀਸ਼ਾ ਬਿਨਾਂ ਧਾਰੀਆਂ ਸਾਫ਼, ਚੁਗਾਠ ਪੂੰਝੀ।"],
), { measurementKey: "each" });
const GLASS_CLEANER = () => L.material(1, "flat", 2, t8(
  ["Glass cleaner and squeegee rubber", "Streak-free glass solution and replacement squeegee blades."],
  ["Nettoyant à vitres et caoutchouc de raclette", "Solution à vitres sans traces et lames de raclette de rechange."],
  ["Limpiavidrios y hule de jalador", "Solución para vidrio sin marcas y hules de repuesto para jalador."],
  ["Detergente vetri e gomma tergivetro", "Soluzione per vetri senza aloni e lame di ricambio per il tergivetro."],
  ["Glasreiniger und Abziehergummi", "Streifenfreie Glaslösung und Ersatzgummis für den Abzieher."],
  ["Засіб для скла й гума для шкребка", "Розчин для скла без розводів і змінні гумки для віконного шкребка."],
  ["Glass cleaner at goma ng squeegee", "Solution para sa salamin na walang guhit at pamalit na goma ng squeegee."],
  ["ਸ਼ੀਸ਼ਾ ਕਲੀਨਰ ਅਤੇ ਸਕੁਈਜੀ ਰਬੜ", "ਬਿਨਾਂ ਧਾਰੀਆਂ ਵਾਲਾ ਸ਼ੀਸ਼ਾ ਘੋਲ ਅਤੇ ਸਕੁਈਜੀ ਦੇ ਨਵੇਂ ਰਬੜ।"],
));
const RESTOCK = (round, supplies) => [
  L.labour(1, "flat", round, t8(
    ["Restocking round", "Every restroom and kitchen dispenser checked and refilled, stock levels noted."],
    ["Tournée de réapprovisionnement", "Chaque distributeur des toilettes et cuisinettes vérifié et rempli, niveaux de stock notés."],
    ["Ronda de reposición", "Cada despachador de sanitarios y cocinas revisado y rellenado, niveles de inventario anotados."],
    ["Giro di rifornimento", "Ogni dispenser di bagni e cucine controllato e ricaricato, scorte annotate."],
    ["Nachfüllrunde", "Jeder Spender in WCs und Küchen geprüft und aufgefüllt, Bestände notiert."],
    ["Обхід для поповнення", "Кожен дозатор у туалетах і на кухнях перевірено й поповнено, залишки записано."],
    ["Restocking round", "Chineck at nilagyan ang bawat dispenser sa CR at kusina, isinulat ang natitirang stock."],
    ["ਸਮਾਨ ਭਰਨ ਦਾ ਗੇੜਾ", "ਹਰ ਟਾਇਲਟ ਅਤੇ ਰਸੋਈ ਦਾ ਡਿਸਪੈਂਸਰ ਜਾਂਚ ਕੇ ਭਰਿਆ, ਸਟਾਕ ਨੋਟ ਕੀਤਾ।"],
  )),
  L.material(1, "flat", supplies, t8(
    ["Paper, soap and liners", "Toilet tissue, hand towels, hand soap and liners, supplied at cost plus handling."],
    ["Papier, savon et sacs", "Papier hygiénique, essuie-mains, savon et sacs, fournis au coût plus manutention."],
    ["Papel, jabón y bolsas", "Papel higiénico, toallas de mano, jabón y bolsas, al costo más manejo."],
    ["Carta, sapone e sacchi", "Carta igienica, asciugamani, sapone e sacchi, forniti al costo più gestione."],
    ["Papier, Seife und Beutel", "Toilettenpapier, Handtücher, Seife und Müllbeutel, zum Einkaufspreis plus Handling."],
    ["Папір, мило й пакети", "Туалетний папір, рушники, мило й пакети за собівартістю плюс обробка."],
    ["Papel, sabon at liner", "Tissue, hand towel, sabon at liner, sa cost dagdag ang handling."],
    ["ਕਾਗ਼ਜ਼, ਸਾਬਣ ਅਤੇ ਲਾਈਨਰ", "ਟਾਇਲਟ ਪੇਪਰ, ਹੱਥ ਤੌਲੀਏ, ਸਾਬਣ ਅਤੇ ਲਾਈਨਰ, ਲਾਗਤ ਅਤੇ ਹੈਂਡਲਿੰਗ ਨਾਲ।"],
  )),
];
const WASTE = (run, liners) => [
  L.labour(1, "flat", run, t8(
    ["Waste and recycling run", "Every bin emptied and recycling sorted, carried to the building's collection point."],
    ["Tournée des déchets et du recyclage", "Chaque poubelle vidée et recyclage trié, apportés au point de collecte de l'immeuble."],
    ["Ronda de basura y reciclaje", "Cada bote vaciado y reciclaje separado, llevados al punto de recolección del edificio."],
    ["Giro rifiuti e riciclo", "Ogni cestino svuotato e riciclo separato, portati al punto di raccolta dell'edificio."],
    ["Müll- und Recyclingrunde", "Jeder Behälter geleert und Recycling getrennt, zur Sammelstelle des Gebäudes gebracht."],
    ["Обхід для сміття й вторсировини", "Кожен кошик спорожнено, вторсировину розсортовано й віднесено до пункту збору будівлі."],
    ["Pag-ikot para sa basura at recycling", "Inalis ang laman ng bawat basurahan at inihiwalay ang recycling, dinala sa collection point ng building."],
    ["ਕੂੜਾ ਅਤੇ ਰੀਸਾਈਕਲਿੰਗ ਗੇੜਾ", "ਹਰ ਕੂੜਾਦਾਨ ਖ਼ਾਲੀ ਅਤੇ ਰੀਸਾਈਕਲਿੰਗ ਵੱਖ ਕਰਕੇ ਇਮਾਰਤ ਦੇ ਇਕੱਠ-ਸਥਾਨ ਤੱਕ।"],
  )),
  L.material(1, "flat", liners, t8(
    ["Can liners", "Replacement liners sized to each bin."],
    ["Sacs à poubelle", "Sacs de rechange au format de chaque poubelle."],
    ["Bolsas para bote", "Bolsas de repuesto a la medida de cada bote."],
    ["Sacchi per cestini", "Sacchi di ricambio della misura di ogni cestino."],
    ["Müllbeutel", "Ersatzbeutel in der passenden Größe für jeden Behälter."],
    ["Пакети для кошиків", "Змінні пакети під розмір кожного кошика."],
    ["Can liner", "Pamalit na liner na sukat sa bawat basurahan."],
    ["ਕੂੜਾਦਾਨ ਲਾਈਨਰ", "ਹਰ ਕੂੜਾਦਾਨ ਦੇ ਮਾਪ ਦੇ ਨਵੇਂ ਲਾਈਨਰ।"],
  )),
];
const TOUCH_POINTS = (visit, product) => [
  L.labour(1, "flat", visit, t8(
    ["Touch-point disinfection", "Handles, switches, rails, phones and shared equipment disinfected at the label dwell time."],
    ["Désinfection des points de contact", "Poignées, interrupteurs, rampes, téléphones et équipement partagé désinfectés selon le temps de contact."],
    ["Desinfección de puntos de contacto", "Manijas, apagadores, barandales, teléfonos y equipo compartido desinfectados con el tiempo de contacto indicado."],
    ["Disinfezione dei punti di contatto", "Maniglie, interruttori, corrimano, telefoni e attrezzature condivise disinfettati col tempo di contatto."],
    ["Desinfektion der Kontaktflächen", "Griffe, Schalter, Handläufe, Telefone und gemeinsame Geräte mit der Einwirkzeit laut Etikett desinfiziert."],
    ["Дезінфекція поверхонь дотику", "Ручки, вимикачі, поручні, телефони й спільне обладнання продезінфіковано з витримкою за етикеткою."],
    ["Disinfection ng hinahawakan", "Dinisinfect ang hawakan, switch, railing, telepono at shared na gamit ayon sa dwell time."],
    ["ਛੂਹਣ ਵਾਲੀਆਂ ਥਾਵਾਂ ਦੀ ਕੀਟਾਣੂ-ਸਫ਼ਾਈ", "ਹੈਂਡਲ, ਸਵਿੱਚ, ਜੰਗਲੇ, ਫ਼ੋਨ ਅਤੇ ਸਾਂਝਾ ਸਮਾਨ ਲੇਬਲ ਮੁਤਾਬਕ ਸਮੇਂ ਨਾਲ ਕੀਟਾਣੂ-ਰਹਿਤ।"],
  )),
  L.material(1, "flat", product, t8(
    ["Registered disinfectant", "Hospital-grade disinfectant and single-use wipes."],
    ["Désinfectant homologué", "Désinfectant de qualité hospitalière et lingettes à usage unique."],
    ["Desinfectante registrado", "Desinfectante grado hospitalario y toallitas desechables."],
    ["Disinfettante registrato", "Disinfettante di grado ospedaliero e salviette monouso."],
    ["Zugelassenes Desinfektionsmittel", "Desinfektionsmittel in Krankenhausqualität und Einwegtücher."],
    ["Зареєстрований дезінфектант", "Дезінфектант лікарняного класу й одноразові серветки."],
    ["Rehistradong disinfectant", "Hospital-grade na disinfectant at single-use na wipes."],
    ["ਰਜਿਸਟਰਡ ਕੀਟਾਣੂਨਾਸ਼ਕ", "ਹਸਪਤਾਲ ਪੱਧਰ ਦਾ ਕੀਟਾਣੂਨਾਸ਼ਕ ਅਤੇ ਇੱਕ ਵਾਰ ਵਰਤੋਂ ਵਾਲੇ ਵਾਈਪਸ।"],
  )),
];

const ADDED = {
  // ── Installation (one-time first cleans) ──
  "fq.janitorial.one_time.lobby": T("installation", namesOf("fq.janitorial.one_time.lobby"), LOBBY(130, 45, 30), null),

  // ── Repair (one-time restorative) ──
  "fq.janitorial.one_time.kitchen_restroom": T("repair", namesOf("fq.janitorial.one_time.kitchen_restroom"), [
    RESTROOM(65), BREAK_ROOM(60),
    L.labour(1, "flat", 100, t8(
      ["Deep scrub — grout and fixtures", "Restroom grout machine-scrubbed, fixtures descaled and partitions washed top to bottom."],
      ["Récurage en profondeur — joints et appareils", "Joints des toilettes récurés à la machine, appareils détartrés et cloisons lavées de haut en bas."],
      ["Tallado profundo — lechada y muebles", "Lechada de sanitarios tallada a máquina, muebles desincrustados y divisiones lavadas de arriba abajo."],
      ["Lavaggio a fondo — fughe e sanitari", "Fughe dei bagni lavate a macchina, sanitari disincrostati e divisori lavati da cima a fondo."],
      ["Grundreinigung — Fugen und Sanitärobjekte", "Fugen im Sanitärbereich maschinell geschrubbt, Objekte entkalkt und Trennwände komplett gewaschen."],
      ["Глибоке миття — шви й сантехніка", "Шви в туалетах вимито машиною, сантехніку очищено від накипу, перегородки вимито згори донизу."],
      ["Deep scrub — grout at fixture", "Kinuskos ng makina ang grout ng CR, tinanggalan ng kaliskis ang fixture at hinugasan ang partition."],
      ["ਡੂੰਘੀ ਰਗੜਾਈ — ਗ੍ਰਾਊਟ ਅਤੇ ਫ਼ਿਕਸਚਰ", "ਟਾਇਲਟ ਦਾ ਗ੍ਰਾਊਟ ਮਸ਼ੀਨ ਨਾਲ ਰਗੜਿਆ, ਫ਼ਿਕਸਚਰ ਤੋਂ ਪੱਥਰੀ ਹਟਾਈ ਅਤੇ ਪਾਰਟੀਸ਼ਨ ਉੱਪਰੋਂ ਹੇਠਾਂ ਤੱਕ ਧੋਤੇ।"],
    )),
  ], null),
  "fq.janitorial.one_time.dusting": T("repair", namesOf("fq.janitorial.one_time.dusting"), DUSTING(0.05, 15), null),
  "fq.janitorial.one_time.windows": T("repair", namesOf("fq.janitorial.one_time.windows"), [
    L.labour(1, "flat", 45, t8(
      ["Minimum visit charge", "Covers travel and set-up for a stand-alone glass visit."],
      ["Frais minimum de visite", "Couvre le déplacement et l'installation pour une visite de vitres seule."],
      ["Cargo mínimo por visita", "Cubre traslado y preparación de una visita solo de vidrios."],
      ["Costo minimo di uscita", "Copre viaggio e allestimento per un intervento solo vetri."],
      ["Mindesteinsatzpauschale", "Deckt Anfahrt und Aufbau für einen reinen Glaseinsatz."],
      ["Мінімальна плата за виїзд", "Покриває дорогу й підготовку для окремого виїзду на миття скла."],
      ["Minimum na bayad sa visit", "Sakop ang biyahe at setup para sa hiwalay na visit para sa salamin."],
      ["ਘੱਟੋ-ਘੱਟ ਵਿਜ਼ਿਟ ਫ਼ੀਸ", "ਸਿਰਫ਼ ਸ਼ੀਸ਼ਿਆਂ ਵਾਲੀ ਵੱਖਰੀ ਵਿਜ਼ਿਟ ਲਈ ਆਉਣ-ਜਾਣ ਅਤੇ ਤਿਆਰੀ।"],
    )),
    PANE(), GLASS_CLEANER(),
  ], null),
  "fq.janitorial.one_time.sanitation": T("repair", namesOf("fq.janitorial.one_time.sanitation"), [
    ...TOUCH_POINTS(75, 15),
    L.labour(1, "sqft", 0.08, t8(
      ["Add-on: electrostatic spraying — per sq ft", "Disinfectant applied by electrostatic sprayer so it wraps every surface in the room."],
      ["Option : pulvérisation électrostatique — au pi²", "Désinfectant appliqué au pulvérisateur électrostatique pour envelopper toutes les surfaces."],
      ["Extra: rociado electrostático — por pie²", "Desinfectante aplicado con rociador electrostático para que cubra todas las superficies."],
      ["Extra: nebulizzazione elettrostatica — al piede quadro", "Disinfettante applicato con nebulizzatore elettrostatico perché avvolga ogni superficie."],
      ["Zusatz: elektrostatisches Sprühen — pro sq ft", "Desinfektionsmittel elektrostatisch versprüht, damit es jede Fläche im Raum umhüllt."],
      ["Додатково: електростатичне розпилення — за кв. фут", "Дезінфектант нанесено електростатичним розпилювачем, щоб він огорнув усі поверхні."],
      ["Add-on: electrostatic spraying — kada sq ft", "Disinfectant gamit ang electrostatic sprayer para mabalot ang bawat ibabaw sa kuwarto."],
      ["ਵਾਧੂ: ਇਲੈਕਟ੍ਰੋਸਟੈਟਿਕ ਛਿੜਕਾਅ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਇਲੈਕਟ੍ਰੋਸਟੈਟਿਕ ਸਪਰੇਅਰ ਨਾਲ ਕੀਟਾਣੂਨਾਸ਼ਕ ਤਾਂ ਜੋ ਕਮਰੇ ਦੀ ਹਰ ਸਤਹ 'ਤੇ ਲੱਗੇ।"],
    ), { measurementKey: "areaSqFt", optional: true }),
  ], null),

  // ── Maintenance (recurring, and the one-time rows that are service calls) ──
  "fq.janitorial.recurring.lobby": T("maintenance", namesOf("fq.janitorial.recurring.lobby"), LOBBY(110, 40, 25), null),
  "fq.janitorial.recurring.daytime": T("maintenance", namesOf("fq.janitorial.recurring.daytime"), PORTER(2, 32, 6), null),
  "fq.janitorial.one_time.daytime": T("maintenance", namesOf("fq.janitorial.one_time.daytime"), PORTER(6, 35, 10), null),
  "fq.janitorial.recurring.dusting": T("maintenance", namesOf("fq.janitorial.recurring.dusting"), DUSTING(0.03, 10), null),
  "fq.janitorial.recurring.windows": T("maintenance", namesOf("fq.janitorial.recurring.windows"), [PANE(), GLASS_CLEANER()], null),
  "fq.janitorial.recurring.carpet": T("maintenance", namesOf("fq.janitorial.recurring.carpet"), [
    AREA(0.12, t8(
      ["Carpet encapsulation — per sq ft", "Low-moisture encapsulation cleaning with a rotary machine; the carpet is walkable within the hour."],
      ["Encapsulation de tapis — au pi²", "Nettoyage par encapsulation à faible humidité à la machine rotative; tapis praticable en moins d'une heure."],
      ["Encapsulado de alfombra — por pie²", "Limpieza por encapsulado de baja humedad con máquina rotativa; se puede pisar en menos de una hora."],
      ["Incapsulamento moquette — al piede quadro", "Pulizia a incapsulamento a bassa umidità con monospazzola; calpestabile entro un'ora."],
      ["Teppich-Verkapselung — pro sq ft", "Feuchtigkeitsarme Verkapselungsreinigung mit Rotationsmaschine; nach einer Stunde begehbar."],
      ["Інкапсуляція покриття — за кв. фут", "Маловологе інкапсуляційне чищення роторною машиною; можна ходити за годину."],
      ["Carpet encapsulation — kada sq ft", "Low-moisture na encapsulation gamit ang rotary machine; puwedeng lakaran sa loob ng isang oras."],
      ["ਕਾਰਪੈੱਟ ਐਨਕੈਪਸੂਲੇਸ਼ਨ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਰੋਟਰੀ ਮਸ਼ੀਨ ਨਾਲ ਘੱਟ ਨਮੀ ਵਾਲੀ ਐਨਕੈਪਸੂਲੇਸ਼ਨ ਸਫ਼ਾਈ; ਘੰਟੇ ਅੰਦਰ ਤੁਰਨ ਯੋਗ।"],
    )),
    L.material(1, "flat", 15, t8(
      ["Encapsulation detergent", "Crystallising detergent that dries and vacuums out with the soil."],
      ["Détergent d'encapsulation", "Détergent cristallisant qui sèche et s'aspire avec la saleté."],
      ["Detergente de encapsulado", "Detergente cristalizante que se seca y se aspira con la suciedad."],
      ["Detergente incapsulante", "Detergente cristallizzante che asciuga e si aspira insieme allo sporco."],
      ["Verkapselungsreiniger", "Kristallisierender Reiniger, der trocknet und mit dem Schmutz abgesaugt wird."],
      ["Інкапсуляційний засіб", "Кристалізуючий засіб, що висихає й видаляється пилососом разом із брудом."],
      ["Encapsulation detergent", "Detergent na nagiging kristal pagkatuyo at nababakyum kasama ng dumi."],
      ["ਐਨਕੈਪਸੂਲੇਸ਼ਨ ਡਿਟਰਜੈਂਟ", "ਕ੍ਰਿਸਟਲ ਬਣਨ ਵਾਲਾ ਡਿਟਰਜੈਂਟ ਜੋ ਸੁੱਕ ਕੇ ਗੰਦਗੀ ਸਮੇਤ ਵੈਕਿਊਮ ਹੋ ਜਾਂਦਾ ਹੈ।"],
    )),
  ], D.regular("percent", 5)),
  "fq.janitorial.recurring.hard_floor": T("maintenance", namesOf("fq.janitorial.recurring.hard_floor"), [
    AREA(0.12, t8(
      ["Scrub and burnish — per sq ft", "Floor auto-scrubbed with a neutral cleaner, then burnished to restore the gloss."],
      ["Récurage et polissage — au pi²", "Plancher récuré à l'autorécureuse au nettoyant neutre, puis poli pour redonner le lustre."],
      ["Tallado y abrillantado — por pie²", "Piso tallado con lavadora automática y limpiador neutro, luego abrillantado."],
      ["Lavaggio e lucidatura — al piede quadro", "Pavimento lavato con lavasciuga e detergente neutro, poi lucidato per ridare brillantezza."],
      ["Scheuern und Polieren — pro sq ft", "Boden mit Scheuersaugmaschine und Neutralreiniger gereinigt, dann auf Glanz poliert."],
      ["Миття й полірування — за кв. фут", "Підлогу вимито поломийною машиною з нейтральним засобом, потім відполіровано до блиску."],
      ["Scrub at burnish — kada sq ft", "Kinuskos ng auto-scrubber gamit ang neutral cleaner, saka pinakintab para bumalik ang kinang."],
      ["ਰਗੜਾਈ ਅਤੇ ਪਾਲਿਸ਼ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਫ਼ਰਸ਼ ਆਟੋ-ਸਕ੍ਰਬਰ ਨਾਲ ਨਿਊਟ੍ਰਲ ਕਲੀਨਰ ਨਾਲ ਧੋਤਾ, ਫਿਰ ਚਮਕ ਲਈ ਪਾਲਿਸ਼।"],
    )),
    L.material(1, "flat", 20, t8(
      ["Neutral cleaner and burnishing pads", "Floor-safe neutral cleaner and the scrub and burnish pads the visit wears out."],
      ["Nettoyant neutre et tampons de polissage", "Nettoyant neutre pour planchers et les tampons de récurage et de polissage usés à la visite."],
      ["Limpiador neutro y discos de abrillantado", "Limpiador neutro para pisos y los discos de tallado y abrillantado que se desgastan."],
      ["Detergente neutro e dischi lucidanti", "Detergente neutro per pavimenti e i dischi di lavaggio e lucidatura consumati."],
      ["Neutralreiniger und Polierpads", "Bodenschonender Neutralreiniger und die Scheuer- und Polierpads, die der Einsatz verbraucht."],
      ["Нейтральний засіб і полірувальні пади", "Нейтральний засіб для підлоги та пади для миття й полірування, що зношуються."],
      ["Neutral cleaner at burnishing pad", "Neutral na cleaner para sa sahig at mga scrub at burnish pad na nauubos."],
      ["ਨਿਊਟ੍ਰਲ ਕਲੀਨਰ ਅਤੇ ਪਾਲਿਸ਼ ਪੈਡ", "ਫ਼ਰਸ਼ ਲਈ ਸੁਰੱਖਿਅਤ ਨਿਊਟ੍ਰਲ ਕਲੀਨਰ ਅਤੇ ਘਿਸਣ ਵਾਲੇ ਰਗੜਾਈ ਤੇ ਪਾਲਿਸ਼ ਪੈਡ।"],
    )),
  ], D.regular("percent", 5)),
  "fq.janitorial.recurring.restocking": T("maintenance", namesOf("fq.janitorial.recurring.restocking"), RESTOCK(25, 60), null),
  "fq.janitorial.one_time.restocking": T("maintenance", namesOf("fq.janitorial.one_time.restocking"), RESTOCK(35, 75), null),
  "fq.janitorial.recurring.waste": T("maintenance", namesOf("fq.janitorial.recurring.waste"), WASTE(165, 35), null),
  "fq.janitorial.one_time.waste": T("maintenance", namesOf("fq.janitorial.one_time.waste"), WASTE(40, 10), null),
  "fq.janitorial.recurring.sanitation": T("maintenance", namesOf("fq.janitorial.recurring.sanitation"), TOUCH_POINTS(45, 10), null),
};
// This pass only adds: a row that already has a template keeps it untouched.
for (const key of Object.keys(ADDED)) if (TEMPLATES[key]) throw new Error(`janitorial: ${key} is already templated above`);

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);
withTemplates(SEED, ADDED);

// Janitorial and commercial cleaning are two catalogue trades for one kind of
// company; every row is offered on both.
tagRows(SEED, Object.fromEntries(SEED.services.map((s) => [s.seedKey, ["commercial_cleaning"]])));
