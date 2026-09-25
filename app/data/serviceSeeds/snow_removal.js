// app/data/serviceSeeds/snow_removal.js
//
// The service list a snow-removal company starts from. Read the header of
// ./index.js for the format and the rules every file in this folder follows.
//
// The seasonal-contract prices (single / double / triple driveway, basic and
// premium) live in the snow_removal price book (app/data/tradePriceBooks.js)
// and are priced from the takeoff; nothing here restates them. These are the
// one-off and per-visit services a company sells beside the contract.
//
// No benchmark exists for any of these: the capture carried no pricing insight
// for the trade. Every `benchmark` is null on purpose, and the UI says "set
// your rate" rather than inventing a number.

import { L, SHARED, D, T, withTemplates, withLanguages } from "./_templateLines";
import { I18N } from "./i18n/snow_removal.js";

export const SEED = {
  trade: "snow_removal",
  categories: [
    {
      key: "removal",
      name: { en: "Snow removal", fr: "Déneigement", es: "Retiro de nieve" },
    },
  ],
  services: [
    {
      seedKey: "fq.snow_removal.removal.shoveling",
      category: "removal",
      name: {
        en: "Snow shovelling — walkways and steps",
        fr: "Pelletage — allées et marches",
        es: "Paleo de nieve — senderos y escalones",
      },
      description: {
        en: "Hand-clearing of walkways, steps and entrances after a snowfall so every door stays safe to reach.",
        fr: "Dégagement à la pelle des allées, marches et entrées après une bordée, pour que chaque porte reste accessible sans danger.",
        es: "Retiro manual de la nieve en senderos, escalones y entradas después de una nevada, para que cada puerta siga siendo segura de alcanzar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "The seasonal shovelling plan is priced in the snow_removal price book; this is the one-off visit.",
    },
    {
      seedKey: "fq.snow_removal.removal.plowing",
      category: "removal",
      name: {
        en: "Driveway plowing — per visit",
        fr: "Déneigement de l'entrée à la charrue — par visite",
        es: "Despeje de entrada con pala mecánica — por visita",
      },
      description: {
        en: "One plow pass of the driveway and apron after a snowfall, with the pile pushed clear of the garage and the street line.",
        fr: "Un passage de charrue dans l'entrée et le tablier après une bordée, la neige poussée hors de la porte de garage et de la ligne de rue.",
        es: "Una pasada de pala mecánica por la entrada y el acceso después de una nevada, con la nieve empujada lejos del garaje y de la línea de la calle.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
      existing: "Seasonal plowing contracts (single/double/triple driveway) are priced in the snow_removal price book.",
    },
    {
      seedKey: "fq.snow_removal.removal.blowing",
      category: "removal",
      name: {
        en: "Snow blowing — per visit",
        fr: "Soufflage de neige — par visite",
        es: "Soplado de nieve — por visita",
      },
      description: {
        en: "Driveway and walkways cleared with a snow blower, the snow thrown onto the lawn rather than banked at the street.",
        fr: "Entrée et allées dégagées à la souffleuse, la neige projetée sur la pelouse plutôt qu'entassée à la rue.",
        es: "Entrada y senderos despejados con soplador de nieve, con la nieve lanzada al césped en lugar de acumularse en la calle.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.snow_removal.removal.hauling",
      category: "removal",
      name: {
        en: "Snow removal and hauling",
        fr: "Enlèvement et transport de la neige",
        es: "Retiro y acarreo de nieve",
      },
      description: {
        en: "Accumulated snow loaded and trucked off the property when there is nowhere left to push it — priced per load.",
        fr: "Neige accumulée chargée et transportée hors du terrain quand il n'y a plus d'espace pour la pousser — facturé par chargement.",
        es: "Nieve acumulada cargada y transportada fuera de la propiedad cuando ya no hay dónde empujarla — por carga.",
      },
      unit: "each",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.snow_removal.removal.banking",
      category: "removal",
      name: {
        en: "Snow banking and pile relocation",
        fr: "Mise en banc et déplacement des amas de neige",
        es: "Acumulación y reubicación de montículos de nieve",
      },
      description: {
        en: "Piles moved with a loader to open up parking, sightlines and drainage paths on the property.",
        fr: "Amas déplacés à la chargeuse pour libérer le stationnement, la visibilité et les chemins d'écoulement sur le terrain.",
        es: "Montículos reubicados con cargador para liberar estacionamiento, visibilidad y vías de drenaje en la propiedad.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      // The source's "Something else / I don't know" row, kept so the owner's
      // row-by-row validation joins back cleanly — as the honest catch-all a
      // booking form needs, not as a job with a price.
      seedKey: "fq.snow_removal.removal.other",
      category: "removal",
      name: {
        en: "Other snow work — describe what you need",
        fr: "Autre travail de déneigement — décrivez le besoin",
        es: "Otro trabajo de nieve — describa lo que necesita",
      },
      description: {
        en: "Anything not listed above: tell us what needs clearing and we will price it on site.",
        fr: "Tout ce qui n'apparaît pas ci-dessus : dites-nous ce qu'il faut dégager et le prix sera fixé sur place.",
        es: "Cualquier cosa que no aparezca arriba: cuéntenos qué hay que despejar y se cotiza en el sitio.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    {
      seedKey: "fq.snow_removal.removal.salting",
      category: "removal",
      name: { en: "De-icing and salting", fr: "Déglaçage et épandage de sel", es: "Deshielo y aplicación de sal" },
      description: {
        en: "Walks, steps and the driveway treated with de-icer or salt after clearing so they do not refreeze.",
        fr: "Allées, marches et entrée traitées au fondant ou au sel après le déneigement pour éviter le regel.",
        es: "Senderos, escalones y entrada tratados con descongelante o sal después de despejar para que no se vuelvan a congelar.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.snow_removal.removal.roof_snow",
      category: "removal",
      name: { en: "Roof snow removal", fr: "Déneigement de toiture", es: "Retiro de nieve del techo" },
      description: {
        en: "Heavy snow raked or shovelled off the roof edge to take the load off and stop ice dams forming.",
        fr: "Neige lourde retirée au râteau ou à la pelle du bord du toit pour alléger la charge et éviter les barrages de glace.",
        es: "Nieve pesada retirada con rastrillo o pala del borde del techo para aliviar la carga y evitar presas de hielo.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.snow_removal.removal.site_assessment",
      category: "removal",
      name: { en: "Site assessment for a snow contract", fr: "Évaluation du site pour un contrat de déneigement", es: "Evaluación del sitio para contrato de nieve" },
      description: {
        en: "The driveway, walks and piling areas measured and marked, obstacles noted, and a seasonal or per-visit price written up.",
        fr: "Entrée, allées et zones d'empilement mesurées et marquées, obstacles notés, prix saisonnier ou par visite rédigé.",
        es: "Entrada, senderos y zonas de acopio medidos y marcados, obstáculos anotados, y un precio por temporada o por visita.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: 30,
      bookable: true,
    },
    {
      seedKey: "fq.snow_removal.removal.seasonal_contract",
      category: "removal",
      name: { en: "Seasonal snow contract set-up", fr: "Mise en place du contrat de déneigement saisonnier", es: "Alta de contrato de nieve por temporada" },
      description: {
        en: "Driveway markers staked along the edges before the first snowfall and the property added to the plow route for the season.",
        fr: "Balises plantées le long de l'entrée avant la première neige et propriété ajoutée à la tournée pour la saison.",
        es: "Estacas marcadoras colocadas en los bordes antes de la primera nevada y la propiedad añadida a la ruta de la temporada.",
      },
      unit: "flat",
      benchmark: null,
      durationMinutes: null,
      bookable: false,
    },
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the benchmark has no insight for snow removal, so these are 2026
// residential figures for a northern market: a plow visit $55–75 for a
// two-car drive, walks shovelled $35–45, de-icer $25–35 a visit plus the
// product, hauling $150–250 a load, a seasonal marker set-up $50. Walks are
// the typed `linearFt`, driveways the traced `areaSqft` where a per-area
// price holds at a cent (salt by the bag does not, so salt is per visit).
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const t7 = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });

const TEMPLATES = {
  "fq.snow_removal.removal.seasonal_contract": T("installation", n(
    ["Avvio contratto neve stagionale", "Paletti segnalatori piantati lungo i bordi prima della prima nevicata e proprietà aggiunta al giro della stagione."],
    ["Saisonvertrag Winterdienst einrichten", "Markierungsstäbe vor dem ersten Schnee entlang der Ränder gesetzt und das Grundstück in die Saisonroute aufgenommen."],
    ["Оформлення сезонного договору на прибирання снігу", "Віхи встановлено вздовж країв до першого снігу, ділянку додано до маршруту на сезон."],
    ["Setup ng seasonal na kontrata sa niyebe", "Nilagyan ng marker stake ang gilid bago ang unang niyebe at isinama ang property sa ruta ng season."],
  ), [
    L.labour(1, "flat", 50, t7(
      ["Driveway marker staking", "Reflective stakes set along the drive and walk edges."],
      ["Pose de balises", "Balises réfléchissantes plantées le long de l'entrée et des allées."],
      ["Colocación de estacas", "Estacas reflectantes colocadas en los bordes de la entrada y senderos."],
      ["Posa dei paletti", "Paletti riflettenti piantati lungo i bordi di vialetto e passaggi."],
      ["Markierungsstäbe setzen", "Reflektierende Stäbe entlang Einfahrt und Wegen gesetzt."],
      ["Встановлення віх", "Світловідбивні віхи встановлено вздовж під'їзду й доріжок."],
      ["Paglagay ng marker stake", "Reflective na stake sa gilid ng driveway at daanan."],
    )),
    L.material(1, "each", 3, t7(
      ["Reflective driveway marker", "Fibreglass driveway marker, 48 in."],
      ["Balise réfléchissante", "Balise d'entrée en fibre de verre, 48 po."],
      ["Estaca reflectante", "Estaca de fibra de vidrio para entrada, 48 pulg."],
      ["Paletto riflettente", "Paletto in fibra di vetro, 48 pollici."],
      ["Reflektierender Markierungsstab", "Glasfaser-Markierungsstab, 48 Zoll."],
      ["Світловідбивна віха", "Склопластикова віха 48 дюймів."],
      ["Reflective na marker", "Fiberglass na marker, 48 in."],
    ), { measurementKey: "each" }),
  ], D.newCustomer("fixed", 25)),

  "fq.snow_removal.removal.plowing": T("maintenance", n(
    ["Sgombero neve del vialetto — per passaggio", "Un passaggio di lama sul vialetto dopo una nevicata, con il cumulo spostato lontano da garage e strada."],
    ["Einfahrt räumen — pro Einsatz", "Ein Räumgang auf der Einfahrt nach Schneefall, Haufen weg von Garage und Straße geschoben."],
    ["Розчищення під'їзду — за виїзд", "Один прохід відвалом по під'їзду після снігопаду, купу відсунуто від гаража й вулиці."],
    ["Pag-plow ng driveway — kada visit", "Isang pasada ng plow sa driveway pagkatapos umulan ng niyebe, inilayo ang tambak sa garahe at kalsada."],
  ), [L.labour(1, "flat", 65, t7(
    ["Driveway plow — per visit", "Drive and apron plowed and the windrow at the street cleared."],
    ["Déneigement de l'entrée — la visite", "Entrée et tablier déneigés, bourrelet de rue dégagé."],
    ["Retiro con arado — por visita", "Entrada y acceso limpiados y el cordón de nieve de la calle retirado."],
    ["Sgombero vialetto — per passaggio", "Vialetto e accesso sgomberati e cordolo di neve stradale rimosso."],
    ["Einfahrt räumen — pro Einsatz", "Einfahrt und Zufahrt geräumt, Schneewall an der Straße entfernt."],
    ["Розчищення під'їзду — за виїзд", "Під'їзд і з'їзд розчищено, вал снігу від вулиці прибрано."],
    ["Pag-plow — kada visit", "Na-plow ang driveway at apron at tinanggal ang tambak sa kalsada."],
  ))], D.seasonal("percent", 10)),

  "fq.snow_removal.removal.shoveling": T("maintenance", n(
    ["Spalatura neve — vialetti e gradini", "Sgombero a mano di vialetti, gradini e ingressi dopo una nevicata."],
    ["Schneeschaufeln — Wege und Stufen", "Wege, Stufen und Eingänge nach Schneefall von Hand geräumt."],
    ["Прибирання снігу лопатою — доріжки й сходи", "Доріжки, сходи й входи розчищено вручну після снігопаду."],
    ["Pagpala ng niyebe — daanan at hagdan", "Pinala sa kamay ang daanan, hagdan at pasukan pagkatapos ng niyebe."],
  ), [L.labour(1, "linear_ft", 0.5, t7(
    ["Walk shovelling — per linear ft", "Walks and steps shovelled edge to edge."],
    ["Pelletage des allées — au pi lin.", "Allées et marches pelletées d'un bord à l'autre."],
    ["Paleo de senderos — por pie lineal", "Senderos y escalones paleados de orilla a orilla."],
    ["Spalatura vialetti — al piede lineare", "Vialetti e gradini spalati da bordo a bordo."],
    ["Wege schaufeln — pro lfd. Fuß", "Wege und Stufen von Rand zu Rand geschaufelt."],
    ["Розчищення доріжок — за пог. фут", "Доріжки й сходи розчищено від краю до краю."],
    ["Pagpala ng daanan — kada linear ft", "Pinala ang daanan at hagdan mula gilid hanggang gilid."],
  ), { measurementKey: "linearFt" }), L.labour(1, "flat", 25, t7(
    ["Steps and entrances", "Front and back steps and landings cleared."],
    ["Marches et entrées", "Marches et paliers avant et arrière dégagés."],
    ["Escalones y entradas", "Escalones y descansos del frente y atrás despejados."],
    ["Gradini e ingressi", "Gradini e pianerottoli davanti e dietro sgomberati."],
    ["Stufen und Eingänge", "Vordere und hintere Stufen und Podeste geräumt."],
    ["Сходи та входи", "Передні й задні сходи та майданчики розчищено."],
    ["Hagdan at pasukan", "Nilinis ang hagdan at landing sa harap at likod."],
  ))], D.seasonal("percent", 10)),

  "fq.snow_removal.removal.blowing": T("maintenance", n(
    ["Sgombero con fresaneve — per passaggio", "Neve soffiata via da vialetto e passaggi e lanciata lontano dagli ingressi."],
    ["Schneefräsen — pro Einsatz", "Schnee von Einfahrt und Wegen gefräst und weg von den Eingängen geworfen."],
    ["Снігоприбирач — за виїзд", "Сніг з під'їзду й доріжок прибрано снігоприбирачем і відкинуто від входів."],
    ["Snow blowing — kada visit", "Hinipan ang niyebe sa driveway at daanan palayo sa pasukan."],
  ), [L.labour(1, "flat", 55, t7(
    ["Snow blowing — per visit", "Drive and walks cleared with a two-stage blower."],
    ["Soufflage — la visite", "Entrée et allées dégagées à la souffleuse à deux phases."],
    ["Soplado de nieve — por visita", "Entrada y senderos despejados con soplador de dos etapas."],
    ["Fresaneve — per passaggio", "Vialetto e passaggi sgomberati con fresaneve a due stadi."],
    ["Schneefräsen — pro Einsatz", "Einfahrt und Wege mit zweistufiger Fräse geräumt."],
    ["Снігоприбирач — за виїзд", "Під'їзд і доріжки розчищено двоступеневим снігоприбирачем."],
    ["Snow blowing — kada visit", "Nilinis ang driveway at daanan gamit ang two-stage blower."],
  ))], D.seasonal("percent", 10)),

  "fq.snow_removal.removal.hauling": T("maintenance", n(
    ["Rimozione e trasporto neve", "Neve accumulata caricata e portata via quando non c'è più spazio per spostarla — prezzo per carico."],
    ["Schneeabtransport", "Angehäufter Schnee verladen und abgefahren, wenn kein Platz mehr ist — Preis pro Ladung."],
    ["Вивезення снігу", "Накопичений сніг завантажено й вивезено, коли нема куди відсунути — ціна за рейс."],
    ["Paghakot ng niyebe", "Kinarga at hinakot ang naipong niyebe kapag wala nang mapaglagyan — presyo kada load."],
  ), [L.labour(1, "each", 195, t7(
    ["Snow haul — per load", "Loader and dump truck, one load removed from site."],
    ["Transport de neige — le voyage", "Chargeuse et camion-benne, un voyage évacué du site."],
    ["Acarreo de nieve — por carga", "Cargador y volteo, una carga retirada del sitio."],
    ["Trasporto neve — per carico", "Pala e autocarro, un carico portato via."],
    ["Schneeabfuhr — pro Ladung", "Lader und Kipper, eine Ladung abgefahren."],
    ["Вивезення снігу — за рейс", "Навантажувач і самоскид, один рейс вивезено."],
    ["Paghakot — kada load", "Loader at dump truck, isang load na hinakot."],
  ), { measurementKey: "each" })], null),

  "fq.snow_removal.removal.salting": T("maintenance", n(
    ["Antighiaccio e salatura", "Vialetti, gradini e accesso trattati con antighiaccio o sale dopo lo sgombero perché non rigelino."],
    ["Enteisen und Streuen", "Wege, Stufen und Einfahrt nach dem Räumen mit Taumittel oder Salz behandelt, damit nichts überfriert."],
    ["Протиожеледна обробка", "Доріжки, сходи й під'їзд оброблено реагентом або сіллю після розчищення, щоб не підмерзали."],
    ["De-icing at pag-asin", "Nilagyan ng de-icer o asin ang daanan, hagdan at driveway para hindi muling magyelo."],
  ), [L.labour(1, "flat", 30, t7(
    ["De-icer application", "Walks, steps and drive spread with de-icer."],
    ["Épandage de fondant", "Allées, marches et entrée traitées au fondant."],
    ["Aplicación de descongelante", "Senderos, escalones y entrada con descongelante."],
    ["Spargimento antighiaccio", "Vialetti, gradini e accesso trattati con antighiaccio."],
    ["Taumittel streuen", "Wege, Stufen und Einfahrt mit Taumittel bestreut."],
    ["Посипання реагентом", "Доріжки, сходи й під'їзд посипано реагентом."],
    ["Paglagay ng de-icer", "Sinaboyan ng de-icer ang daanan, hagdan at driveway."],
  )), L.material(1, "each", 18, t7(
    ["Ice melt — per bag", "Pet-safe calcium or magnesium chloride ice melt, 20 lb bag."],
    ["Fondant à glace — le sac", "Fondant au chlorure de calcium ou de magnésium sans danger pour les animaux, sac de 20 lb."],
    ["Derretidor de hielo — por bolsa", "Derretidor de cloruro de calcio o magnesio seguro para mascotas, bolsa de 20 lb."],
    ["Sciogli-ghiaccio — per sacco", "Sciogli-ghiaccio al cloruro di calcio o magnesio sicuro per animali, sacco da 20 lb."],
    ["Taumittel — pro Sack", "Haustierfreundliches Calcium- oder Magnesiumchlorid, 20-lb-Sack."],
    ["Реагент — за мішок", "Хлорид кальцію або магнію, безпечний для тварин, мішок 20 фунтів."],
    ["Ice melt — kada sako", "Pet-safe na calcium o magnesium chloride, 20 lb na sako."],
  ), { measurementKey: "each" })], D.seasonal("percent", 10)),

  "fq.snow_removal.removal.banking": T("repair", n(
    ["Spostamento cumuli di neve", "Cumuli spostati con la pala per liberare posteggi, visuale e scoli."],
    ["Schneehaufen versetzen", "Haufen mit dem Lader versetzt, um Parkplätze, Sicht und Abläufe freizumachen."],
    ["Переміщення снігових куп", "Купи переміщено навантажувачем, щоб звільнити паркування, огляд і стоки."],
    ["Paglipat ng tambak ng niyebe", "Inilipat gamit ang loader ang tambak para lumuwag ang parking, tanaw at daluyan."],
  ), [L.labour(1, "hour", 150, t7(
    ["Loader time — per hour", "Skid steer or loader with operator, by the hour."],
    ["Chargeuse — à l'heure", "Mini-chargeuse ou chargeuse avec opérateur, à l'heure."],
    ["Cargador — por hora", "Minicargador o cargador con operador, por hora."],
    ["Pala — a ore", "Minipala o pala con operatore, a ore."],
    ["Lader — pro Stunde", "Kompakt- oder Radlader mit Fahrer, nach Stunden."],
    ["Навантажувач — за годину", "Міні-навантажувач або навантажувач з оператором, погодинно."],
    ["Loader — kada oras", "Skid steer o loader na may operator, kada oras."],
  ))], null),

  "fq.snow_removal.removal.roof_snow": T("repair", n(
    ["Rimozione neve dal tetto", "Neve pesante rastrellata o spalata dal bordo del tetto per alleggerire il carico ed evitare barriere di ghiaccio."],
    ["Dachschnee räumen", "Schwerer Schnee von der Dachkante gerecht oder geschaufelt, um die Last zu senken und Eisdämme zu verhindern."],
    ["Прибирання снігу з даху", "Важкий сніг згорнуто граблями чи лопатою з краю даху, щоб зменшити навантаження й уникнути крижаних гребель."],
    ["Pagtanggal ng niyebe sa bubong", "Kinalaykay o pinala ang mabigat na niyebe sa gilid ng bubong para gumaan at hindi mag-ice dam."],
  ), [L.labour(1, "linear_ft", 3, t7(
    ["Roof edge raking — per linear ft of eave", "Snow pulled off the lower slope along the eaves."],
    ["Déneigement du bord du toit — au pi lin. d'avant-toit", "Neige tirée du bas du versant le long des avant-toits."],
    ["Rastrillado del borde del techo — por pie lineal de alero", "Nieve jalada de la parte baja del techo a lo largo de los aleros."],
    ["Rastrellatura bordo tetto — al piede lineare di gronda", "Neve tirata giù dalla parte bassa della falda lungo le gronde."],
    ["Dachkante abziehen — pro lfd. Fuß Traufe", "Schnee am unteren Dachbereich entlang der Traufe abgezogen."],
    ["Зчищення краю даху — за пог. фут карниза", "Сніг стягнуто з нижньої частини схилу вздовж карнизів."],
    ["Pagkalaykay sa gilid ng bubong — kada linear ft ng eave", "Hinila ang niyebe sa mababang bahagi ng bubong sa kahabaan ng eave."],
  ), { measurementKey: "eaveFt" })], null),

  "fq.snow_removal.removal.site_assessment": T("inspection", n(
    ["Sopralluogo per contratto neve", "Vialetto, passaggi e zone di accumulo misurati e segnati, ostacoli annotati e prezzo stagionale o a passaggio redatto."],
    ["Objektbesichtigung für Winterdienst", "Einfahrt, Wege und Schneelagerflächen aufgemessen und markiert, Hindernisse notiert, Saison- oder Einsatzpreis erstellt."],
    ["Оцінка ділянки для договору", "Під'їзд, доріжки й місця складування виміряно й позначено, перешкоди записано, сезонну чи разову ціну складено."],
    ["Pagsuri ng lote para sa kontrata", "Sinukat at minarkahan ang driveway, daanan at tambakan, isinulat ang harang at presyo kada season o visit."],
  ), [L.labour(1, "flat", 0, t7(
    ["Site assessment", "Areas measured and a seasonal price written; free with a signed contract."],
    ["Évaluation du site", "Surfaces mesurées et prix saisonnier rédigé; gratuit avec un contrat signé."],
    ["Evaluación del sitio", "Áreas medidas y precio de temporada redactado; gratis con contrato firmado."],
    ["Sopralluogo", "Aree misurate e prezzo stagionale redatto; gratuito con contratto firmato."],
    ["Objektbesichtigung", "Flächen gemessen und Saisonpreis erstellt; kostenlos bei unterschriebenem Vertrag."],
    ["Оцінка ділянки", "Площі виміряно, сезонну ціну складено; безкоштовно за підписаного договору."],
    ["Pagsuri ng lote", "Sinukat ang lugar at isinulat ang presyo; libre kapag pumirma sa kontrata."],
  ), { cost: 0 })], null),

  "fq.snow_removal.removal.other": T("inspection", n(
    ["Altro lavoro neve — descrivi cosa serve", "Tutto ciò che non è elencato: dicci cosa va sgomberato e lo quotiamo sul posto."],
    ["Andere Schneearbeit — beschreiben Sie den Bedarf", "Alles nicht Aufgeführte: sagen Sie, was geräumt werden muss, der Preis wird vor Ort festgelegt."],
    ["Інша робота зі снігом — опишіть потребу", "Усе, чого немає вище: скажіть, що розчистити, ціну визначимо на місці."],
    ["Ibang trabaho sa niyebe — ilarawan ang kailangan", "Anumang wala sa listahan: sabihin kung ano ang lilinisin at pepresyuhan sa lugar."],
  ), [SHARED.serviceCall(45)], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);
