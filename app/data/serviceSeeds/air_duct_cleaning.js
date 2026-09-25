// app/data/serviceSeeds/air_duct_cleaning.js
//
// The service list an air duct and vent cleaning company starts from. Read
// ./index.js for the format and the rules. From the air-duct capture under
// docs/research/ (19 services, two templates) and, for the services the HVAC
// book already carries, by tag rather than by copy: the duct cleaning itself,
// filter replacement, duct sealing, UV purification and dryer vents live in
// hvac_repair.js / appliance_repair.js and list air_duct_cleaning in their
// `categories`, so a duct company is seeded with them once.
//
// The trade prices by the number of supply vents and returns, not by area;
// those lines are keyed `ventCount` / `returnCount`, registered in
// lib/services/measurementKeys.js as counts typed on the estimate — no
// calculator produces them, so the quote builder asks for the count.
import { L, SHARED, D, T, withTemplates, hdMaterial, withLanguages } from "./_templateLines";
import { HD } from "./_materialCosts";
import { I18N } from "./i18n/air_duct_cleaning.js";

const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "air_duct_cleaning",
  categories: [
    { key: "core", name: { en: "Duct and vent cleaning", fr: "Nettoyage des conduits et bouches", es: "Limpieza de ductos y rejillas" } },
    { key: "additional", name: { en: "Treatments and add-ons", fr: "Traitements et options", es: "Tratamientos y complementos" } },
    { key: "inspection", name: { en: "Inspections and checks", fr: "Inspections et vérifications", es: "Inspecciones y revisiones" } },
    { key: "visits", name: { en: "Booked visits", fr: "Visites réservées", es: "Visitas agendadas" } },
  ],
  services: [
    S("fq.air_duct_cleaning.core.system_cleaning", "core", "flat", null,
      ["HVAC system cleaning", "Nettoyage du système de chauffage et climatisation", "Limpieza del sistema de climatización"],
      ["Blower, coil, plenums and ducts cleaned together so the whole system moves clean air.", "Ventilateur, serpentin, plénums et conduits nettoyés ensemble pour que tout le système souffle de l'air propre.", "Ventilador, serpentín, plenos y ductos limpiados juntos para que todo el sistema mueva aire limpio."]),
    S("fq.air_duct_cleaning.core.vent_cleaning", "core", "flat", null,
      ["Vent and register cleaning", "Nettoyage des bouches et grilles", "Limpieza de rejillas y difusores"],
      ["Supply vents and registers taken off, washed and the branch behind each one vacuumed.", "Bouches et grilles d'alimentation retirées, lavées et branche derrière chacune aspirée.", "Rejillas y difusores de suministro retirados, lavados y el ramal detrás de cada uno aspirado."]),
    S("fq.air_duct_cleaning.core.return_cleaning", "core", "flat", null,
      ["Return air cleaning", "Nettoyage des retours d'air", "Limpieza de retornos de aire"],
      ["Return grilles and return ducts cleaned so dust is not pulled back into the system.", "Grilles et conduits de retour nettoyés pour que la poussière ne soit pas réaspirée dans le système.", "Rejillas y ductos de retorno limpiados para que el polvo no regrese al sistema."]),
    S("fq.air_duct_cleaning.additional.sanitization", "additional", "flat", null,
      ["Duct sanitization", "Assainissement des conduits", "Sanitización de ductos"],
      ["An EPA-registered sanitizer fogged through the cleaned ducts to cut bacteria and odour.", "Assainissant homologué nébulisé dans les conduits nettoyés pour réduire bactéries et odeurs.", "Sanitizante registrado nebulizado en los ductos limpios para reducir bacterias y olores."]),
    S("fq.air_duct_cleaning.additional.deodorization", "additional", "flat", null,
      ["Duct deodorization", "Désodorisation des conduits", "Desodorización de ductos"],
      ["Lingering smoke, pet or musty odours in the ductwork neutralised after cleaning.", "Odeurs persistantes de fumée, d'animaux ou de moisi dans les conduits neutralisées après le nettoyage.", "Olores persistentes de humo, mascotas o humedad en los ductos neutralizados después de la limpieza."]),
    S("fq.air_duct_cleaning.additional.mold_treatment", "additional", "flat", null,
      ["Duct mould treatment", "Traitement des moisissures dans les conduits", "Tratamiento de moho en ductos"],
      ["Visible mould in ducts or the air handler cleaned out and treated with a mould inhibitor.", "Moisissure visible dans les conduits ou l'appareil de traitement d'air nettoyée et traitée avec un inhibiteur.", "Moho visible en ductos o manejadora limpiado y tratado con un inhibidor de moho."]),
    S("fq.air_duct_cleaning.additional.air_purification_addon", "additional", "flat", null,
      ["Air purification add-on", "Option de purification de l'air", "Complemento de purificación de aire"],
      ["A purification device added to the system after cleaning to keep the air cleaner between visits.", "Appareil de purification ajouté au système après le nettoyage pour garder l'air plus propre entre les visites.", "Dispositivo de purificación añadido al sistema tras la limpieza para mantener el aire más limpio entre visitas."]),
    S("fq.air_duct_cleaning.inspection.airflow_inspection", "inspection", "flat", null,
      ["Airflow inspection", "Inspection du débit d'air", "Inspección del flujo de aire"],
      ["Airflow measured at each vent and weak rooms traced to kinks, leaks or closed dampers.", "Débit mesuré à chaque bouche et pièces faibles expliquées par des plis, fuites ou registres fermés.", "Flujo medido en cada rejilla y cuartos débiles rastreados a dobleces, fugas o compuertas cerradas."]),
    S("fq.air_duct_cleaning.inspection.duct_inspection", "inspection", "flat", null,
      ["Duct inspection", "Inspection des conduits", "Inspección de ductos"],
      ["The ductwork viewed with a camera at several points to show how dirty it is before cleaning is quoted.", "Conduits examinés à la caméra à plusieurs endroits pour montrer leur état avant de chiffrer le nettoyage.", "Ductos revisados con cámara en varios puntos para mostrar qué tan sucios están antes de cotizar."]),
    S("fq.air_duct_cleaning.inspection.efficiency_check", "inspection", "flat", null,
      ["System efficiency check", "Vérification de l'efficacité du système", "Revisión de eficiencia del sistema"],
      ["Static pressure, temperature split and filter condition checked to see how hard the system is working.", "Pression statique, écart de température et état du filtre vérifiés pour voir l'effort du système.", "Presión estática, diferencia de temperatura y estado del filtro revisados para ver cuánto trabaja el sistema."]),
    S("fq.air_duct_cleaning.core.maintenance_cleaning", "core", "flat", null,
      ["Maintenance duct cleaning", "Nettoyage d'entretien des conduits", "Limpieza de mantenimiento de ductos"],
      ["A lighter yearly cleaning of vents, returns and the main trunk to keep a cleaned system clean.", "Nettoyage annuel léger des bouches, retours et du conduit principal pour garder propre un système déjà nettoyé.", "Limpieza anual ligera de rejillas, retornos y el ducto principal para mantener limpio un sistema ya limpiado."]),
    S("fq.air_duct_cleaning.visits.booked_inspection", "visits", "flat", null,
      ["Air duct inspection — booked visit", "Inspection des conduits — visite réservée", "Inspección de ductos — visita agendada"],
      ["A booked two-hour visit to look over the ducts and vents and leave a written price.", "Visite réservée de deux heures pour examiner les conduits et bouches et laisser un prix écrit.", "Visita agendada de dos horas para revisar ductos y rejillas y dejar un precio por escrito."], { durationMinutes: 120, bookable: true }),
    S("fq.air_duct_cleaning.visits.booked_repair", "visits", "flat", null,
      ["Air duct repair — booked visit", "Réparation de conduits — visite réservée", "Reparación de ductos — visita agendada"],
      ["A booked visit to reconnect, reseal or replace damaged duct runs and vents.", "Visite réservée pour rebrancher, rescellér ou remplacer des conduits et bouches endommagés.", "Visita agendada para reconectar, resellar o reemplazar tramos y rejillas dañados."], { durationMinutes: 120, bookable: true }),
    S("fq.air_duct_cleaning.visits.booked_install", "visits", "flat", null,
      ["Duct installation or upgrade — booked visit", "Installation ou amélioration de conduits — visite réservée", "Instalación o mejora de ductos — visita agendada"],
      ["A booked visit to add a run, a vent or a return, or upgrade registers.", "Visite réservée pour ajouter un conduit, une bouche ou un retour, ou remplacer les grilles.", "Visita agendada para agregar un tramo, una rejilla o un retorno, o mejorar difusores."], { durationMinutes: 120, bookable: true }),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// The captured one-time duct cleaning ($320 at $200 cost plus vents and
// registers $90 at $50, $20 off) sits on hvac_repair's duct-cleaning row,
// tagged for this trade; the captured yearly cleaning ($300/200 + $70/50,
// 4% off) is the maintenance cleaning below. Vents $15, returns $25, fogging
// $95 are 2026 duct-cleaning rates.
const TEMPLATES = {
  "fq.air_duct_cleaning.core.maintenance_cleaning": T("maintenance", {
    it: ["Pulizia di manutenzione dei condotti", "Pulizia annuale leggera di bocchette, riprese e condotto principale per mantenere pulito un impianto già pulito."],
    de: ["Wartungsreinigung der Kanäle", "Leichtere jährliche Reinigung von Auslässen, Rückluft und Hauptkanal, damit ein gereinigtes System sauber bleibt."],
    uk: ["Підтримувальне чищення повітроводів", "Легше щорічне чищення решіток, повернень і магістралі, щоб очищена система лишалася чистою."],
    tl: ["Maintenance na paglilinis ng duct", "Mas magaan na taunang paglilinis ng vent, return at main trunk para manatiling malinis ang sistema."],
  }, [
    L.labour(1, "flat", 300, {
      en: ["Yearly duct cleaning", "Main trunk and branches cleaned on the yearly visit."],
      fr: ["Nettoyage annuel des conduits", "Conduit principal et branches nettoyés lors de la visite annuelle."],
      es: ["Limpieza anual de ductos", "Ducto principal y ramales limpiados en la visita anual."],
      it: ["Pulizia annuale dei condotti", "Condotto principale e diramazioni puliti nella visita annuale."],
      de: ["Jährliche Kanalreinigung", "Hauptkanal und Abzweige beim Jahrestermin gereinigt."],
      uk: ["Щорічне чищення повітроводів", "Магістраль і відгалуження очищено під час щорічного візиту."],
      tl: ["Taunang paglilinis ng duct", "Nilinis ang main trunk at branch sa taunang visit."],
    }, { cost: 200 }),
    L.labour(1, "flat", 70, {
      en: ["Vent and register cleaning", "Every vent and register removed, washed and refitted."],
      fr: ["Nettoyage des bouches et grilles", "Chaque bouche et grille retirée, lavée et reposée."],
      es: ["Limpieza de rejillas y difusores", "Cada rejilla y difusor retirado, lavado y recolocado."],
      it: ["Pulizia bocchette e griglie", "Ogni bocchetta e griglia tolta, lavata e rimontata."],
      de: ["Auslässe und Gitter reinigen", "Jeder Auslass und jedes Gitter abgenommen, gewaschen und wieder angebracht."],
      uk: ["Чищення решіток і дифузорів", "Кожну решітку й дифузор знято, вимито й встановлено назад."],
      tl: ["Paglilinis ng vent at register", "Tinanggal, hinugasan at ibinalik ang bawat vent at register."],
    }, { cost: 50 }),
  ], D.regular("percent", 4)),

  "fq.air_duct_cleaning.core.vent_cleaning": T("maintenance", {
    it: ["Pulizia bocchette e griglie", "Bocchette e griglie di mandata tolte, lavate e il ramo dietro ciascuna aspirato."],
    de: ["Auslässe und Gitter reinigen", "Zuluftauslässe und Gitter abgenommen, gewaschen und der Abzweig dahinter gesaugt."],
    uk: ["Чищення решіток і дифузорів", "Припливні решітки знято, вимито, відгалуження за кожною пропилососено."],
    tl: ["Paglilinis ng vent at register", "Tinanggal at hinugasan ang supply vent at register at binakyum ang branch sa likod."],
  }, [
    L.labour(1, "each", 15, {
      en: ["Supply vent — per vent", "Register off and washed, branch vacuumed to the trunk."],
      fr: ["Bouche d'alimentation — l'unité", "Grille retirée et lavée, branche aspirée jusqu'au conduit principal."],
      es: ["Rejilla de suministro — por rejilla", "Difusor retirado y lavado, ramal aspirado hasta el troncal."],
      it: ["Bocchetta di mandata — cadauna", "Griglia tolta e lavata, diramazione aspirata fino al condotto principale."],
      de: ["Zuluftauslass — pro Stück", "Gitter ab und gewaschen, Abzweig bis zum Hauptkanal gesaugt."],
      uk: ["Припливна решітка — за штуку", "Решітку знято й вимито, відгалуження пропилососено до магістралі."],
      tl: ["Supply vent — kada isa", "Tinanggal at hinugasan ang register at binakyum ang branch hanggang trunk."],
    }, { cost: 8, measurementKey: "ventCount" }),
    L.labour(1, "each", 25, {
      en: ["Return — per return", "Return grille off and washed, the return duct vacuumed."],
      fr: ["Retour d'air — l'unité", "Grille de retour retirée et lavée, conduit de retour aspiré."],
      es: ["Retorno — por retorno", "Rejilla de retorno retirada y lavada, ducto de retorno aspirado."],
      it: ["Ripresa — cadauna", "Griglia di ripresa tolta e lavata, condotto di ripresa aspirato."],
      de: ["Rückluft — pro Stück", "Rückluftgitter ab und gewaschen, Rückluftkanal gesaugt."],
      uk: ["Зворотна решітка — за штуку", "Зворотну решітку знято й вимито, зворотний повітровід пропилососено."],
      tl: ["Return — kada isa", "Tinanggal at hinugasan ang return grille at binakyum ang return duct."],
    }, { cost: 13, measurementKey: "returnCount" }),
  ], null),

  "fq.air_duct_cleaning.additional.sanitization": T("maintenance", {
    it: ["Sanificazione dei condotti", "Sanificante registrato nebulizzato nei condotti puliti per ridurre batteri e odori."],
    de: ["Kanaldesinfektion", "Zugelassenes Desinfektionsmittel in die gereinigten Kanäle vernebelt, gegen Bakterien und Gerüche."],
    uk: ["Дезінфекція повітроводів", "Зареєстрований дезінфектант розпилено в очищені повітроводи проти бактерій і запахів."],
    tl: ["Sanitization ng duct", "Ini-fog ang rehistradong sanitizer sa malinis na duct para bawasan ang bacteria at amoy."],
  }, [
    L.labour(1, "flat", 95, {
      en: ["Duct fogging", "Sanitizer fogged through supply and return with the blower running."],
      fr: ["Nébulisation des conduits", "Assainissant nébulisé dans l'alimentation et le retour, ventilateur en marche."],
      es: ["Nebulización de ductos", "Sanitizante nebulizado en suministro y retorno con el ventilador encendido."],
      it: ["Nebulizzazione dei condotti", "Sanificante nebulizzato in mandata e ripresa con il ventilatore acceso."],
      de: ["Kanalvernebelung", "Desinfektionsmittel bei laufendem Gebläse durch Zu- und Rückluft vernebelt."],
      uk: ["Розпилення в повітроводах", "Дезінфектант розпилено в приплив і повернення при увімкненому вентиляторі."],
      tl: ["Pag-fog ng duct", "Ini-fog ang sanitizer sa supply at return habang tumatakbo ang blower."],
    }),
    L.material(1, "flat", 35, {
      en: ["EPA-registered sanitizer", "Duct-rated sanitizer, one system."],
      fr: ["Assainissant homologué", "Assainissant pour conduits, un système."],
      es: ["Sanitizante registrado", "Sanitizante apto para ductos, un sistema."],
      it: ["Sanificante registrato", "Sanificante per condotti, un impianto."],
      de: ["Zugelassenes Desinfektionsmittel", "Für Kanäle zugelassenes Mittel, ein System."],
      uk: ["Зареєстрований дезінфектант", "Дезінфектант для повітроводів, одна система."],
      tl: ["EPA-registered na sanitizer", "Sanitizer para sa duct, isang sistema."],
    }),
  ], null),

  "fq.air_duct_cleaning.inspection.duct_inspection": T("inspection", {
    it: ["Ispezione dei condotti", "Condotti esaminati con telecamera in più punti per mostrarne lo stato prima di quotare la pulizia."],
    de: ["Kanalinspektion", "Kanäle an mehreren Stellen per Kamera geprüft, um den Zustand vor dem Angebot zu zeigen."],
    uk: ["Огляд повітроводів", "Повітроводи оглянуто камерою в кількох точках, щоб показати стан перед оцінкою чищення."],
    tl: ["Inspeksyon ng duct", "Tiningnan ng camera ang duct sa ilang lugar para ipakita ang dumi bago i-quote."],
  }, [
    L.labour(1, "flat", 89, {
      en: ["Camera duct inspection", "Camera run into the trunk and branches, photos shared with the client."],
      fr: ["Inspection des conduits par caméra", "Caméra passée dans le conduit principal et les branches, photos remises au client."],
      es: ["Inspección de ductos con cámara", "Cámara pasada por troncal y ramales, fotos compartidas con el cliente."],
      it: ["Ispezione con telecamera", "Telecamera nel condotto principale e nelle diramazioni, foto condivise con il cliente."],
      de: ["Kamerainspektion der Kanäle", "Kamera in Haupt- und Abzweigkanäle geführt, Fotos an den Kunden."],
      uk: ["Огляд повітроводів камерою", "Камеру проведено магістраллю й відгалуженнями, фото передано клієнту."],
      tl: ["Camera inspection ng duct", "Pinadaan ang camera sa trunk at branch at ibinahagi ang litrato sa kliyente."],
    }),
  ], null),

  "fq.air_duct_cleaning.inspection.airflow_inspection": T("inspection", {
    it: ["Ispezione del flusso d'aria", "Portata misurata a ogni bocchetta e stanze deboli ricondotte a pieghe, perdite o serrande chiuse."],
    de: ["Luftstromprüfung", "Luftmenge an jedem Auslass gemessen, schwache Räume auf Knicke, Lecks oder geschlossene Klappen zurückgeführt."],
    uk: ["Перевірка потоку повітря", "Потік виміряно на кожній решітці, слабкі кімнати пов'язано з перегинами, витоками чи закритими заслінками."],
    tl: ["Inspeksyon ng airflow", "Sinukat ang hangin sa bawat vent at hinanap ang dahilan ng mahinang kuwarto."],
  }, [
    L.labour(1, "flat", 125, {
      en: ["Airflow measurement", "CFM read at each vent with a flow hood and the weak runs traced."],
      fr: ["Mesure du débit", "Débit lu à chaque bouche avec une hotte de mesure et conduits faibles retracés."],
      es: ["Medición de flujo", "CFM medido en cada rejilla con campana de flujo y tramos débiles rastreados."],
      it: ["Misura della portata", "CFM letti a ogni bocchetta con cappa di misura e tratti deboli tracciati."],
      de: ["Luftmengenmessung", "CFM an jedem Auslass mit Messhaube gemessen und schwache Strecken verfolgt."],
      uk: ["Вимірювання потоку", "CFM зчитано на кожній решітці вимірювальним ковпаком, слабкі ділянки простежено."],
      tl: ["Pagsukat ng airflow", "Binasa ang CFM sa bawat vent gamit ang flow hood at sinundan ang mahinang linya."],
    }),
    SHARED.report(35),
  ], null),

  "fq.air_duct_cleaning.visits.booked_repair": T("repair", {
    it: ["Riparazione condotti — visita prenotata", "Visita prenotata per ricollegare, risigillare o sostituire tratti e bocchette danneggiati."],
    de: ["Kanalreparatur — gebuchter Termin", "Gebuchter Termin, um beschädigte Kanäle und Auslässe neu zu verbinden, abzudichten oder zu ersetzen."],
    uk: ["Ремонт повітроводів — запланований візит", "Запланований візит, щоб з'єднати, загерметизувати чи замінити пошкоджені ділянки й решітки."],
    tl: ["Pag-ayos ng duct — naka-book", "Naka-book na visit para ikonekta, selyuhan o palitan ang sirang duct at vent."],
  }, [
    SHARED.serviceCall(89),
    SHARED.techHour(1.5, 120),
    hdMaterial(HD.flex_duct_6, {
      en: ["Insulated flex duct — per roll", "6 in R6 insulated flex duct, 25 ft roll."],
      fr: ["Conduit flexible isolé — le rouleau", "Conduit flexible isolé R6 de 6 po, rouleau de 25 pi."],
      es: ["Ducto flexible aislado — por rollo", "Ducto flexible aislado R6 de 6 pulg, rollo de 25 pies."],
      it: ["Condotto flessibile isolato — per rotolo", "Condotto flessibile isolato R6 da 6 pollici, rotolo da 25 piedi."],
      de: ["Isolierter Flexkanal — pro Rolle", "6-Zoll-Flexkanal R6, 25-Fuß-Rolle."],
      uk: ["Утеплений гнучкий повітровід — за рулон", "Гнучкий повітровід 6 дюймів R6, рулон 25 футів."],
      tl: ["Insulated flex duct — kada rolyo", "6 in R6 insulated flex duct, 25 ft na rolyo."],
    }, { measurementKey: "linearFt" }),
  ], null),

};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);

// ── Templates added 2026-09-25 ───────────────────────────────────────────────
//
// The owner (2026-09-25): a service added to a quote should arrive with a few
// lines, not as one bare line. The templates above cover six rows; these
// cover the other eight. None of these rows carries a benchmark, so the
// levels come from the captured duct templates ($300–320 for the ducts,
// $70–90 for vents and registers, labour cost ≈ 50–65%) and 2026 trade
// figures for the add-ons. Whole-system and return cleaning price by the
// count of vents and returns, like the vent-cleaning template above, so
// those rows show no flat preset until the counts are typed.
//
// Kept apart from TEMPLATES and applied in a second pass, so every template
// above stays exactly as it was — a key that already has a template throws
// instead of being overwritten. Punjabi sits inline beside the other seven
// languages; the service's own name in every language is the row's
// (./i18n/air_duct_cleaning.js).

/** [name, description] in the eight languages, in this order. */
const X = (en, fr, es, it, de, uk, pa, tl) => ({ en, fr, es, it, de, uk, pa, tl });
const VENT = () => L.labour(1, "each", 15, X(
  ["Supply vent — per vent", "Register off and washed, branch vacuumed to the trunk."],
  ["Bouche d'alimentation — l'unité", "Grille retirée et lavée, branche aspirée jusqu'au conduit principal."],
  ["Rejilla de suministro — por rejilla", "Difusor retirado y lavado, ramal aspirado hasta el troncal."],
  ["Bocchetta di mandata — cadauna", "Griglia tolta e lavata, diramazione aspirata fino al condotto principale."],
  ["Zuluftauslass — pro Stück", "Gitter ab und gewaschen, Abzweig bis zum Hauptkanal gesaugt."],
  ["Припливна решітка — за штуку", "Решітку знято й вимито, відгалуження пропилососено до магістралі."],
  ["ਸਪਲਾਈ ਵੈਂਟ — ਪ੍ਰਤੀ ਵੈਂਟ", "ਰਜਿਸਟਰ ਉਤਾਰ ਕੇ ਧੋਤਾ, ਮੁੱਖ ਡਕਟ ਤੱਕ ਬ੍ਰਾਂਚ ਵੈਕਿਊਮ ਕੀਤੀ।"],
  ["Supply vent — kada isa", "Tinanggal at hinugasan ang register at binakyum ang branch hanggang trunk."],
), { cost: 8, measurementKey: "ventCount" });
const RETURN = () => L.labour(1, "each", 25, X(
  ["Return — per return", "Return grille off and washed, the return duct vacuumed."],
  ["Retour d'air — l'unité", "Grille de retour retirée et lavée, conduit de retour aspiré."],
  ["Retorno — por retorno", "Rejilla de retorno retirada y lavada, ducto de retorno aspirado."],
  ["Ripresa — cadauna", "Griglia di ripresa tolta e lavata, condotto di ripresa aspirato."],
  ["Rückluft — pro Stück", "Rückluftgitter ab und gewaschen, Rückluftkanal gesaugt."],
  ["Зворотна решітка — за штуку", "Зворотну решітку знято й вимито, зворотний повітровід пропилососено."],
  ["ਰਿਟਰਨ — ਪ੍ਰਤੀ ਰਿਟਰਨ", "ਰਿਟਰਨ ਗਰਿੱਲ ਉਤਾਰ ਕੇ ਧੋਤੀ, ਰਿਟਰਨ ਡਕਟ ਵੈਕਿਊਮ ਕੀਤੀ।"],
  ["Return — kada isa", "Tinanggal at hinugasan ang return grille at binakyum ang return duct."],
), { cost: 13, measurementKey: "returnCount" });

const ADDED = {
  "fq.air_duct_cleaning.core.system_cleaning": { kind: "maintenance", lines: [
    L.labour(1, "flat", 250, X(
      ["Blower, coil and plenum cleaning", "Blower compartment and wheel cleaned, the evaporator coil face brushed and the supply and return plenums vacuumed."],
      ["Nettoyage du ventilateur, du serpentin et des plénums", "Compartiment et roue du ventilateur nettoyés, face du serpentin brossée, plénums d'alimentation et de retour aspirés."],
      ["Limpieza de ventilador, serpentín y plenos", "Compartimiento y turbina del ventilador limpiados, cara del serpentín cepillada y plenos de suministro y retorno aspirados."],
      ["Pulizia ventilatore, batteria e plenum", "Vano e girante del ventilatore puliti, faccia della batteria spazzolata, plenum di mandata e ripresa aspirati."],
      ["Reinigung von Gebläse, Register und Plenum", "Gebläseraum und -rad gereinigt, Registerfläche gebürstet, Zu- und Rückluftplenum gesaugt."],
      ["Чищення вентилятора, теплообмінника й пленумів", "Відсік і крильчатку вентилятора очищено, поверхню теплообмінника вичищено, припливний і зворотний пленуми пропилососено."],
      ["ਬਲੋਅਰ, ਕੋਇਲ ਅਤੇ ਪਲੈਨਮ ਸਫ਼ਾਈ", "ਬਲੋਅਰ ਖਾਨਾ ਅਤੇ ਵ੍ਹੀਲ ਸਾਫ਼, ਕੋਇਲ ਦਾ ਮੂੰਹ ਬੁਰਸ਼ ਕੀਤਾ ਅਤੇ ਸਪਲਾਈ ਤੇ ਰਿਟਰਨ ਪਲੈਨਮ ਵੈਕਿਊਮ।"],
      ["Paglinis ng blower, coil at plenum", "Nilinis ang blower compartment at wheel, biniristsa ang mukha ng coil at binakyum ang supply at return plenum."],
    ), { cost: 150 }),
    VENT(), RETURN(),
    hdMaterial(HD.filter_16x25x1, X(
      ["Pleated filter", "MERV 11 pleated filter fitted after the cleaning."],
      ["Filtre plissé", "Filtre plissé MERV 11 posé après le nettoyage."],
      ["Filtro plisado", "Filtro plisado MERV 11 colocado después de la limpieza."],
      ["Filtro pieghettato", "Filtro pieghettato MERV 11 montato dopo la pulizia."],
      ["Faltenfilter", "Faltenfilter MERV 11 nach der Reinigung eingesetzt."],
      ["Гофрований фільтр", "Гофрований фільтр MERV 11, встановлений після чищення."],
      ["ਪਲੀਟਿਡ ਫ਼ਿਲਟਰ", "ਸਫ਼ਾਈ ਮਗਰੋਂ ਲਾਇਆ MERV 11 ਪਲੀਟਿਡ ਫ਼ਿਲਟਰ।"],
      ["Pleated filter", "MERV 11 na pleated filter na ikinabit pagkatapos maglinis."],
    ), { price: 25 }),
  ] },

  "fq.air_duct_cleaning.core.return_cleaning": { kind: "maintenance", lines: [
    L.labour(1, "flat", 95, X(
      ["Return trunk cleaning", "Negative-air machine on the return side and the return trunk agitated and vacuumed back to the air handler."],
      ["Nettoyage du conduit de retour principal", "Aspirateur à pression négative côté retour, conduit de retour principal agité et aspiré jusqu'à l'appareil."],
      ["Limpieza del troncal de retorno", "Máquina de presión negativa en el retorno y el troncal de retorno agitado y aspirado hasta el manejador."],
      ["Pulizia del condotto di ripresa", "Aspiratore a pressione negativa sulla ripresa, condotto principale spazzolato e aspirato fino all'unità."],
      ["Rückluft-Hauptkanal reinigen", "Unterdruckgerät auf der Rückluftseite, Rückluft-Hauptkanal bis zum Lüftungsgerät abgebürstet und gesaugt."],
      ["Чищення зворотної магістралі", "Установка негативного тиску на зворотному боці, магістраль прочищено й пропилососено до повітрообробника."],
      ["ਰਿਟਰਨ ਮੁੱਖ ਡਕਟ ਸਫ਼ਾਈ", "ਰਿਟਰਨ ਪਾਸੇ ਨੈਗੇਟਿਵ-ਏਅਰ ਮਸ਼ੀਨ, ਅਤੇ ਰਿਟਰਨ ਮੁੱਖ ਡਕਟ ਏਅਰ ਹੈਂਡਲਰ ਤੱਕ ਹਿਲਾ ਕੇ ਵੈਕਿਊਮ।"],
      ["Paglinis ng return trunk", "Negative-air machine sa return side at kinalog at binakyum ang return trunk hanggang air handler."],
    ), { cost: 55 }),
    RETURN(),
  ] },

  "fq.air_duct_cleaning.additional.deodorization": { kind: "maintenance", lines: [
    L.labour(1, "flat", 85, X(
      ["Duct deodorizing treatment", "Odour neutraliser fogged through the clean supply and return with the blower running."],
      ["Traitement désodorisant des conduits", "Neutralisant d'odeurs nébulisé dans l'alimentation et le retour propres, ventilateur en marche."],
      ["Tratamiento desodorizante de ductos", "Neutralizador de olores nebulizado en el suministro y retorno limpios con el ventilador encendido."],
      ["Trattamento deodorante dei condotti", "Neutralizzatore di odori nebulizzato in mandata e ripresa pulite con il ventilatore acceso."],
      ["Geruchsbehandlung der Kanäle", "Geruchsneutralisierer bei laufendem Gebläse durch die gereinigte Zu- und Rückluft vernebelt."],
      ["Дезодорація повітроводів", "Нейтралізатор запахів розпилено в чисті приплив і повернення при увімкненому вентиляторі."],
      ["ਡਕਟ ਬਦਬੂ ਹਟਾਉਣ ਦਾ ਇਲਾਜ", "ਬਲੋਅਰ ਚੱਲਦੇ ਹੋਏ ਸਾਫ਼ ਸਪਲਾਈ ਅਤੇ ਰਿਟਰਨ ਵਿੱਚ ਬਦਬੂ ਨਿਊਟ੍ਰਲਾਈਜ਼ਰ ਫ਼ੌਗ ਕੀਤਾ।"],
      ["Deodorizing treatment ng duct", "Ini-fog ang odor neutralizer sa malinis na supply at return habang tumatakbo ang blower."],
    )),
    L.material(1, "flat", 30, X(
      ["Odour neutraliser", "Duct-safe odour neutraliser for smoke, pet and musty odours, one system."],
      ["Neutralisant d'odeurs", "Neutralisant sans danger pour les conduits contre la fumée, les animaux et le moisi, un système."],
      ["Neutralizador de olores", "Neutralizador seguro para ductos contra humo, mascotas y humedad, un sistema."],
      ["Neutralizzatore di odori", "Neutralizzatore sicuro per condotti contro fumo, animali e muffa, un impianto."],
      ["Geruchsneutralisierer", "Kanalgeeigneter Neutralisierer gegen Rauch-, Tier- und Modergeruch, ein System."],
      ["Нейтралізатор запахів", "Безпечний для повітроводів нейтралізатор диму, тварин і затхлості, одна система."],
      ["ਬਦਬੂ ਨਿਊਟ੍ਰਲਾਈਜ਼ਰ", "ਧੂੰਏਂ, ਪਾਲਤੂ ਜਾਨਵਰਾਂ ਅਤੇ ਸਲ੍ਹਾਬੇ ਦੀ ਬਦਬੂ ਲਈ ਡਕਟ-ਸੁਰੱਖਿਅਤ ਨਿਊਟ੍ਰਲਾਈਜ਼ਰ, ਇੱਕ ਸਿਸਟਮ।"],
      ["Odor neutralizer", "Ligtas sa duct na odor neutralizer para sa usok, alaga at amoy-kulob, isang sistema."],
    ), { cost: 15 }),
  ] },

  "fq.air_duct_cleaning.additional.mold_treatment": { kind: "repair", lines: [
    L.labour(1, "flat", 250, X(
      ["Mould cleanup at the air handler and ducts", "Visible growth cleaned from the cabinet, coil area and affected duct runs under containment, and the surfaces treated."],
      ["Nettoyage de moisissure à l'appareil et aux conduits", "Moisissure visible nettoyée dans le boîtier, près du serpentin et dans les conduits touchés sous confinement, surfaces traitées."],
      ["Limpieza de moho en el manejador y ductos", "Moho visible limpiado del gabinete, zona del serpentín y tramos afectados con contención, y las superficies tratadas."],
      ["Pulizia muffa nell'unità e nei condotti", "Muffa visibile pulita da mobile, zona batteria e tratti colpiti con confinamento, superfici trattate."],
      ["Schimmelbeseitigung an Gerät und Kanälen", "Sichtbarer Befall unter Abschottung aus Gehäuse, Registerbereich und betroffenen Kanälen entfernt, Oberflächen behandelt."],
      ["Прибирання цвілі в повітрообробнику й повітроводах", "Видиму цвіль прибрано з корпусу, зони теплообмінника й уражених ділянок під ізоляцією, поверхні оброблено."],
      ["ਏਅਰ ਹੈਂਡਲਰ ਅਤੇ ਡਕਟਾਂ ਵਿੱਚ ਉੱਲੀ ਸਫ਼ਾਈ", "ਘੇਰਾ ਬਣਾ ਕੇ ਕੈਬਿਨੇਟ, ਕੋਇਲ ਵਾਲੀ ਥਾਂ ਅਤੇ ਪ੍ਰਭਾਵਿਤ ਡਕਟਾਂ ਤੋਂ ਦਿਸਦੀ ਉੱਲੀ ਸਾਫ਼, ਅਤੇ ਸਤ੍ਹਾ 'ਤੇ ਇਲਾਜ।"],
      ["Paglinis ng amag sa air handler at duct", "Nilinis na may containment ang nakikitang amag sa cabinet, paligid ng coil at apektadong duct, at tinratong ang surface."],
    )),
    L.material(1, "flat", 55, X(
      ["Mould inhibitor", "EPA-registered mould inhibitor rated for HVAC surfaces."],
      ["Inhibiteur de moisissure", "Inhibiteur de moisissure homologué pour les surfaces CVC."],
      ["Inhibidor de moho", "Inhibidor de moho registrado apto para superficies HVAC."],
      ["Inibitore di muffa", "Inibitore di muffa registrato, adatto alle superfici HVAC."],
      ["Schimmelhemmer", "Zugelassener Schimmelhemmer für HLK-Oberflächen."],
      ["Інгібітор цвілі", "Зареєстрований інгібітор цвілі для поверхонь HVAC."],
      ["ਉੱਲੀ ਰੋਕੂ", "HVAC ਸਤ੍ਹਾ ਲਈ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਉੱਲੀ ਰੋਕੂ।"],
      ["Mold inhibitor", "EPA-registered na mold inhibitor para sa HVAC na surface."],
    ), { cost: 35 }),
    SHARED.report(35),
  ] },

  "fq.air_duct_cleaning.additional.air_purification_addon": { kind: "installation", lines: [
    L.labour(1, "flat", 175, X(
      ["Purifier installation", "The purifier mounted in the supply plenum or return, wired to the air handler so it runs with the blower, and tested."],
      ["Pose du purificateur", "Purificateur fixé dans le plénum d'alimentation ou au retour, raccordé à l'appareil pour fonctionner avec le ventilateur, et testé."],
      ["Instalación del purificador", "Purificador montado en el pleno de suministro o en el retorno, cableado al manejador para que funcione con el ventilador, y probado."],
      ["Posa del purificatore", "Purificatore montato nel plenum di mandata o nella ripresa, collegato all'unità per funzionare col ventilatore, e provato."],
      ["Luftreiniger einbauen", "Reiniger im Zuluftplenum oder in der Rückluft montiert, am Lüftungsgerät angeschlossen, damit er mit dem Gebläse läuft, und getestet."],
      ["Монтаж очищувача", "Очищувач встановлено в припливному пленумі чи на поверненні, під'єднано до повітрообробника для роботи з вентилятором і перевірено."],
      ["ਪਿਊਰੀਫ਼ਾਇਰ ਲਾਉਣਾ", "ਪਿਊਰੀਫ਼ਾਇਰ ਸਪਲਾਈ ਪਲੈਨਮ ਜਾਂ ਰਿਟਰਨ ਵਿੱਚ ਲਾਇਆ, ਬਲੋਅਰ ਨਾਲ ਚੱਲਣ ਲਈ ਏਅਰ ਹੈਂਡਲਰ ਨਾਲ ਜੋੜਿਆ ਅਤੇ ਟੈਸਟ ਕੀਤਾ।"],
      ["Pagkabit ng purifier", "Ikinabit ang purifier sa supply plenum o return, kinablehan sa air handler para sumabay sa blower, at sinubukan."],
    )),
    L.material(1, "each", 450, X(
      ["In-duct air purifier", "In-duct UV or bipolar-ionization purifier sized to the system."],
      ["Purificateur d'air pour conduit", "Purificateur UV ou à ionisation bipolaire pour conduit, dimensionné pour le système."],
      ["Purificador de aire para ducto", "Purificador UV o de ionización bipolar para ducto, del tamaño del sistema."],
      ["Purificatore d'aria per condotto", "Purificatore UV o a ionizzazione bipolare per condotto, dimensionato sull'impianto."],
      ["Kanal-Luftreiniger", "UV- oder Bipolar-Ionisations-Reiniger für den Kanal, passend zur Anlage."],
      ["Канальний очищувач повітря", "Канальний УФ- чи біполярний іонізаційний очищувач під систему."],
      ["ਡਕਟ ਵਿੱਚ ਲੱਗਣ ਵਾਲਾ ਏਅਰ ਪਿਊਰੀਫ਼ਾਇਰ", "ਸਿਸਟਮ ਮੁਤਾਬਕ ਡਕਟ ਵਿੱਚ UV ਜਾਂ ਬਾਇਪੋਲਰ-ਆਇਓਨਾਈਜ਼ੇਸ਼ਨ ਪਿਊਰੀਫ਼ਾਇਰ।"],
      ["In-duct na air purifier", "In-duct na UV o bipolar-ionization na purifier na sukat sa sistema."],
    ), { cost: 340 }),
  ] },

  "fq.air_duct_cleaning.inspection.efficiency_check": { kind: "inspection", lines: [
    L.labour(1, "flat", 125, X(
      ["Static pressure and temperature split test", "Total external static pressure and the supply-return temperature split measured and read against the equipment's rating, and the filter checked."],
      ["Mesure de pression statique et d'écart de température", "Pression statique externe totale et écart de température alimentation-retour mesurés et comparés aux valeurs de l'appareil, filtre vérifié."],
      ["Prueba de presión estática y diferencia de temperatura", "Presión estática externa total y diferencia de temperatura entre suministro y retorno medidas contra los valores del equipo, y el filtro revisado."],
      ["Prova di pressione statica e salto termico", "Pressione statica esterna totale e salto termico mandata-ripresa misurati rispetto ai valori dell'apparecchio, filtro controllato."],
      ["Messung von statischem Druck und Temperaturspreizung", "Gesamter externer statischer Druck und Temperaturdifferenz zwischen Zu- und Rückluft gegen die Gerätewerte gemessen, Filter geprüft."],
      ["Тест статичного тиску й перепаду температур", "Загальний зовнішній статичний тиск і перепад температур подачі й повернення виміряно й звірено з номіналом, фільтр перевірено."],
      ["ਸਟੈਟਿਕ ਪ੍ਰੈਸ਼ਰ ਅਤੇ ਤਾਪਮਾਨ ਫ਼ਰਕ ਟੈਸਟ", "ਕੁੱਲ ਬਾਹਰੀ ਸਟੈਟਿਕ ਪ੍ਰੈਸ਼ਰ ਅਤੇ ਸਪਲਾਈ-ਰਿਟਰਨ ਤਾਪਮਾਨ ਫ਼ਰਕ ਮਾਪ ਕੇ ਉਪਕਰਣ ਦੀ ਰੇਟਿੰਗ ਨਾਲ ਮਿਲਾਏ, ਅਤੇ ਫ਼ਿਲਟਰ ਜਾਂਚਿਆ।"],
      ["Static pressure at temperature split test", "Sinukat ang total external static pressure at ang temperature split ng supply at return laban sa rating ng unit, at chineck ang filter."],
    ), { cost: 60 }),
    SHARED.report(35),
  ] },

  "fq.air_duct_cleaning.visits.booked_inspection": { kind: "inspection", lines: [
    L.labour(1, "flat", 89, X(
      ["Duct and vent inspection", "Camera run into the trunk and branches, vents and returns counted and checked, and the cleaning priced on the spot."],
      ["Inspection des conduits et des bouches", "Caméra passée dans le conduit principal et les branches, bouches et retours comptés et vérifiés, nettoyage chiffré sur place."],
      ["Inspección de ductos y rejillas", "Cámara pasada por troncal y ramales, rejillas y retornos contados y revisados, y la limpieza cotizada en el momento."],
      ["Ispezione di condotti e bocchette", "Telecamera nel condotto principale e nelle diramazioni, bocchette e riprese contate e controllate, pulizia quotata sul posto."],
      ["Inspektion von Kanälen und Auslässen", "Kamera in Haupt- und Abzweigkanäle geführt, Auslässe und Rückluftgitter gezählt und geprüft, Reinigung vor Ort angeboten."],
      ["Огляд повітроводів і решіток", "Камеру проведено магістраллю й відгалуженнями, решітки й повернення пораховано й перевірено, чищення оцінено на місці."],
      ["ਡਕਟ ਅਤੇ ਵੈਂਟ ਜਾਂਚ", "ਮੁੱਖ ਡਕਟ ਅਤੇ ਬ੍ਰਾਂਚਾਂ ਵਿੱਚ ਕੈਮਰਾ, ਵੈਂਟ ਅਤੇ ਰਿਟਰਨ ਗਿਣ ਕੇ ਜਾਂਚੇ, ਅਤੇ ਸਫ਼ਾਈ ਦਾ ਰੇਟ ਉੱਥੇ ਹੀ ਦਿੱਤਾ।"],
      ["Inspeksyon ng duct at vent", "Pinadaan ang camera sa trunk at branch, binilang at chineck ang vent at return, at in-quote agad ang paglilinis."],
    ), { cost: 45 }),
    SHARED.report(35),
  ] },

  "fq.air_duct_cleaning.visits.booked_install": { kind: "installation", lines: [
    SHARED.serviceCall(89),
    SHARED.techHour(2, 120),
    L.material(1, "flat", 85, X(
      ["Register, boot and duct fittings", "A register and boot, a takeoff and the fittings to add or upgrade one run."],
      ["Grille, botte et raccords de conduit", "Une grille et sa botte, un départ et les raccords pour ajouter ou améliorer un conduit."],
      ["Rejilla, bota y accesorios de ducto", "Una rejilla y su bota, una derivación y los accesorios para agregar o mejorar un tramo."],
      ["Bocchetta, raccordo e pezzi speciali", "Una bocchetta con raccordo, uno stacco e i pezzi per aggiungere o migliorare una tratta."],
      ["Auslass, Stutzen und Kanalformteile", "Ein Auslass mit Stutzen, ein Abzweig und die Formteile, um eine Strecke zu ergänzen oder zu verbessern."],
      ["Решітка, бут і фітинги повітроводу", "Решітка з бутом, відвід і фітинги, щоб додати чи покращити одну ділянку."],
      ["ਰਜਿਸਟਰ, ਬੂਟ ਅਤੇ ਡਕਟ ਫ਼ਿਟਿੰਗ", "ਇੱਕ ਲਾਈਨ ਜੋੜਨ ਜਾਂ ਸੁਧਾਰਨ ਲਈ ਰਜਿਸਟਰ ਅਤੇ ਬੂਟ, ਟੇਕਆਫ਼ ਅਤੇ ਫ਼ਿਟਿੰਗ।"],
      ["Register, boot at duct fittings", "Register at boot, takeoff at fittings para magdagdag o mag-upgrade ng isang linya."],
    ), { cost: 60 }),
  ] },
};

for (const key of Object.keys(ADDED)) {
  if (SEED.services.find((s) => s.seedKey === key)?.templateLines) throw new Error(`air_duct_cleaning: ${key} already has a template — this pass only adds`);
}
withTemplates(SEED, Object.fromEntries(Object.entries(ADDED).map(([key, a]) => {
  const s = I18N.services[key];
  return [key, T(a.kind, { it: s.it, de: s.de, uk: s.uk, pa: s.pa, tl: s.tl }, a.lines, null)];
})));
