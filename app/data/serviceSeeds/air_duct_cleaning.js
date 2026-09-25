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
// those lines are keyed `ventCount` / `returnCount`, keys the measurement
// registry does not carry yet — the loader flags them for the estimator to
// type until it does.
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
