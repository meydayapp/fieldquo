// app/data/serviceSeeds/appliance_repair.js
//
// The service list an appliance repair company starts from. Read ./index.js
// for the format and the rules. No row carried a pricing insight.
import { L, SHARED, D, T, withTemplates, hdMaterial, tagRows, withLanguages } from "./_templateLines";
import { HD } from "./_materialCosts";
import { I18N } from "./i18n/appliance_repair.js";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "appliance_repair",
  categories: [
    { key: "repair", name: { en: "Appliance repair", fr: "Réparation d'électroménagers", es: "Reparación de electrodomésticos" } },
    { key: "additional", name: { en: "Installation and additional services", fr: "Installation et services complémentaires", es: "Instalación y servicios adicionales" } },
    { key: "maintenance", name: { en: "Maintenance and inspection", fr: "Entretien et inspection", es: "Mantenimiento e inspección" } },
  ],
  services: [
    S("fq.appliance_repair.repair.general", "repair", "flat", null,
      ["Appliance repair", "Réparation d'électroménager", "Reparación de electrodoméstico"],
      ["The faulty part found and replaced so the appliance works as it should.",
       "Pièce défectueuse trouvée et remplacée pour que l'appareil fonctionne comme il se doit.",
       "Pieza defectuosa localizada y reemplazada para que el electrodoméstico funcione como debe."]),
    S("fq.appliance_repair.repair.refrigerator", "repair", "flat", null,
      ["Refrigerator repair", "Réparation de réfrigérateur", "Reparación de refrigerador"],
      ["Cooling loss, leaks and noise traced to the compressor, fan, seal or thermostat and repaired.",
       "Perte de froid, fuites et bruit attribués au compresseur, au ventilateur, au joint ou au thermostat et réparés.",
       "Pérdida de frío, fugas y ruido atribuidos al compresor, ventilador, empaque o termostato y reparados."]),
    S("fq.appliance_repair.repair.dishwasher", "repair", "flat", null,
      ["Dishwasher repair", "Réparation de lave-vaisselle", "Reparación de lavavajillas"],
      ["Drainage, cleaning and mechanical faults on the dishwasher repaired.",
       "Problèmes de vidange, de lavage et mécaniques du lave-vaisselle réparés.",
       "Fallas de drenaje, lavado y mecánicas del lavavajillas reparadas."]),
    S("fq.appliance_repair.repair.oven_range", "repair", "flat", null,
      ["Oven and range repair", "Réparation de four et de cuisinière", "Reparación de horno y estufa"],
      ["Elements, igniters, sensors and controls repaired so the oven heats accurately and safely.",
       "Éléments, allumeurs, capteurs et commandes réparés pour que le four chauffe avec précision et en sécurité.",
       "Resistencias, encendedores, sensores y controles reparados para que el horno caliente con precisión y seguridad."]),
    S("fq.appliance_repair.repair.washer", "repair", "flat", null,
      ["Washer repair", "Réparation de laveuse", "Reparación de lavadora"],
      ["Leaks, drainage problems and mechanical failures on the washing machine repaired.",
       "Fuites, problèmes de vidange et pannes mécaniques de la laveuse réparés.",
       "Fugas, problemas de drenaje y fallas mecánicas de la lavadora reparados."]),
    S("fq.appliance_repair.repair.dryer", "repair", "flat", null,
      ["Dryer repair", "Réparation de sécheuse", "Reparación de secadora"],
      ["Heating and airflow faults on the dryer repaired so clothes dry in one cycle again.",
       "Problèmes de chauffage et de circulation d'air de la sécheuse réparés pour que le linge sèche en un cycle.",
       "Fallas de calentamiento y flujo de aire de la secadora reparadas para que la ropa seque en un ciclo."]),
    S("fq.appliance_repair.additional.installation", "additional", "each", null,
      ["Appliance installation", "Installation d'électroménager", "Instalación de electrodoméstico"],
      ["A new appliance set in place, connected to water, gas or power and tested.",
       "Nouvel appareil mis en place, raccordé à l'eau, au gaz ou au courant et testé.",
       "Electrodoméstico nuevo colocado, conectado a agua, gas o corriente y probado."]),
    S("fq.appliance_repair.additional.dryer_vent_cleaning", "additional", "flat", null,
      ["Dryer vent cleaning", "Nettoyage d'évent de sécheuse", "Limpieza del ducto de secadora"],
      ["Lint cleared from the dryer vent to restore airflow and cut the fire risk.",
       "Charpie retirée de l'évent de sécheuse pour rétablir le débit d'air et réduire le risque d'incendie.",
       "Pelusa retirada del ducto de la secadora para recuperar el flujo de aire y reducir el riesgo de incendio."]),
    S("fq.appliance_repair.additional.leak_diagnosis", "additional", "flat", null,
      ["Leak diagnosis and repair", "Diagnostic et réparation de fuite", "Diagnóstico y reparación de fugas"],
      ["The source of a water leak from an appliance found and repaired.",
       "Source d'une fuite d'eau d'un appareil trouvée et réparée.",
       "Origen de una fuga de agua de un electrodoméstico localizado y reparado."]),
    S("fq.appliance_repair.additional.electrical_troubleshooting", "additional", "flat", null,
      ["Electrical troubleshooting", "Dépannage électrique", "Diagnóstico eléctrico"],
      ["Electrical faults that stop an appliance running diagnosed and corrected.",
       "Défauts électriques qui empêchent un appareil de fonctionner diagnostiqués et corrigés.",
       "Fallas eléctricas que impiden que un electrodoméstico funcione diagnosticadas y corregidas."]),
    S("fq.appliance_repair.additional.smart_setup", "additional", "flat", null,
      ["Smart appliance setup", "Configuration d'appareil connecté", "Configuración de electrodoméstico inteligente"],
      ["Wi-Fi and app features on a smart appliance connected and configured.",
       "Fonctions Wi-Fi et application d'un appareil connecté raccordées et configurées.",
       "Funciones Wi-Fi y de aplicación de un electrodoméstico inteligente conectadas y configuradas."]),
    S("fq.appliance_repair.additional.cleaning", "additional", "flat", null,
      ["Appliance cleaning", "Nettoyage d'électroménager", "Limpieza de electrodoméstico"],
      ["Grease, scale and residue removed from an appliance to restore performance.",
       "Graisse, tartre et résidus retirés d'un appareil pour rétablir ses performances.",
       "Grasa, sarro y residuos eliminados de un electrodoméstico para recuperar su rendimiento."]),
    S("fq.appliance_repair.additional.parts_replacement", "additional", "flat", null,
      ["Parts replacement", "Remplacement de pièces", "Reemplazo de piezas"],
      ["Worn or damaged components replaced with the correct parts.",
       "Composants usés ou abîmés remplacés par les bonnes pièces.",
       "Componentes gastados o dañados reemplazados con las piezas correctas."]),
    S("fq.appliance_repair.maintenance.tune_up", "maintenance", "flat", null,
      ["Appliance tune-up", "Mise au point d'électroménager", "Afinación de electrodoméstico"],
      ["Components inspected and calibrated for efficiency and longer life.",
       "Composants inspectés et calibrés pour l'efficacité et la longévité.",
       "Componentes inspeccionados y calibrados para eficiencia y mayor vida útil."]),
    S("fq.appliance_repair.maintenance.preventative", "maintenance", "flat", null,
      ["Preventative maintenance", "Entretien préventif", "Mantenimiento preventivo"],
      ["Routine maintenance that catches problems early and extends the appliance's life.",
       "Entretien de routine qui repère les problèmes tôt et prolonge la vie de l'appareil.",
       "Mantenimiento de rutina que detecta problemas a tiempo y alarga la vida del electrodoméstico."]),
    S("fq.appliance_repair.maintenance.inspection", "maintenance", "flat", null,
      ["Appliance inspection", "Inspection d'électroménager", "Inspección de electrodoméstico"],
      ["The appliance's condition and performance assessed and any issue reported.",
       "État et performance de l'appareil évalués et tout problème signalé.",
       "Estado y rendimiento del electrodoméstico evaluados y cualquier problema informado."]),
    S("fq.appliance_repair.maintenance.performance_optimization", "maintenance", "flat", null,
      ["Performance optimisation", "Optimisation des performances", "Optimización del rendimiento"],
      ["Settings and components adjusted for better efficiency.",
       "Réglages et composants ajustés pour une meilleure efficacité.",
       "Ajustes y componentes afinados para mayor eficiencia."]),
    S("fq.appliance_repair.maintenance.filter_replacement", "maintenance", "each", null,
      ["Filter replacement", "Remplacement de filtre", "Reemplazo de filtro"],
      ["Water and air filters on the appliance replaced.",
       "Filtres à eau et à air de l'appareil remplacés.",
       "Filtros de agua y aire del electrodoméstico reemplazados."]),
    S("fq.appliance_repair.maintenance.inspection_visit", "maintenance", "flat", null,
      ["Appliance inspection — booked visit", "Inspection d'électroménager — visite réservée", "Inspección de electrodoméstico — visita agendada"],
      ["A booked visit to evaluate an appliance and give clear recommendations.",
       "Visite réservée pour évaluer un appareil et donner des recommandations claires.",
       "Visita agendada para evaluar un electrodoméstico y dar recomendaciones claras."],
      { durationMinutes: 120, bookable: true }),
    S("fq.appliance_repair.repair.repair_visit", "repair", "flat", null,
      ["Appliance repair — booked visit", "Réparation d'électroménager — visite réservée", "Reparación de electrodoméstico — visita agendada"],
      ["A booked repair visit to get the appliance working again.",
       "Visite de réparation réservée pour remettre l'appareil en marche.",
       "Visita de reparación agendada para que el electrodoméstico vuelva a funcionar."],
      { durationMinutes: 120, bookable: true }),
    S("fq.appliance_repair.additional.install_upgrade_visit", "additional", "flat", null,
      ["Appliance installation or upgrade — booked visit", "Installation ou mise à niveau d'électroménager — visite réservée", "Instalación o actualización de electrodoméstico — visita agendada"],
      ["A booked visit to install a new appliance or replace an old one.",
       "Visite réservée pour installer un nouvel appareil ou en remplacer un ancien.",
       "Visita agendada para instalar un electrodoméstico nuevo o reemplazar uno viejo."],
      { durationMinutes: 120, bookable: true }),
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    S("fq.appliance_repair.additional.laundry_hookup", "additional", "each", null,
      ["Washer and dryer hookup", "Raccordement de laveuse et sécheuse", "Conexión de lavadora y secadora"],
      ["A washer and dryer set in place, water, drain, power or gas and the dryer vent connected, levelled and run through a cycle.",
       "Laveuse et sécheuse mises en place, eau, drain, électricité ou gaz et évent de sécheuse raccordés, mises de niveau et testées sur un cycle.",
       "Lavadora y secadora colocadas, agua, drenaje, corriente o gas y ducto de la secadora conectados, niveladas y probadas en un ciclo."]),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the appliance capture under docs/research/ names the 21 services
// and ships only two generic templates (diagnostic $100/80, repair
// $200/100), so these are authored at 2026 appliance-repair rates: an $89
// diagnostic credited on repair, $150–185 of repair labour, installs at
// $150–225. Parts vary by model and are carried as a pass-through line at
// cost (kind "other"), replaced on the quote by the actual part; supply
// lines are costed from the Home Depot table.
const n = (it, de, uk, tl) => ({ it, de, uk, tl });
const DIAG = () => SHARED.diagnostic(89, { cost: 45 });
const PARTS = (price) => L.other(1, "flat", price, {
  en: ["Replacement parts — pass-through", "OEM or equivalent part for this model, billed at cost; the actual part replaces this allowance."],
  fr: ["Pièces de remplacement — refacturées", "Pièce d'origine ou équivalente pour ce modèle, facturée au coût; la pièce réelle remplace cette allocation."],
  es: ["Refacciones — al costo", "Pieza original o equivalente para este modelo, cobrada al costo; la pieza real sustituye esta provisión."],
  it: ["Ricambi — al costo", "Ricambio originale o equivalente per questo modello, fatturato al costo; il ricambio reale sostituisce questa voce."],
  de: ["Ersatzteile — durchgereicht", "Original- oder gleichwertiges Teil für dieses Modell zum Einkaufspreis; das tatsächliche Teil ersetzt diesen Posten."],
  uk: ["Запчастини — за собівартістю", "Оригінальна чи рівноцінна деталь для цієї моделі за собівартістю; фактична деталь замінить цей рядок."],
  tl: ["Kapalit na piyesa — pass-through", "OEM o katumbas na piyesa para sa model, sinisingil sa cost; papalitan ng totoong piyesa."],
});
const REPAIR = (price, what) => L.labour(1, "flat", price, what);
const t7 = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });

const TEMPLATES = {
  // ── Repair ──
  "fq.appliance_repair.repair.refrigerator": T("repair", n(
    ["Riparazione frigorifero", "Perdita di freddo, perdite d'acqua e rumori ricondotti a compressore, ventola, guarnizione o termostato e riparati."],
    ["Kühlschrankreparatur", "Kühlverlust, Lecks und Geräusche auf Verdichter, Lüfter, Dichtung oder Thermostat zurückgeführt und behoben."],
    ["Ремонт холодильника", "Втрату холоду, протікання й шум зведено до компресора, вентилятора, ущільнювача чи термостата й усунено."],
    ["Pag-ayos ng ref", "Nahanap sa compressor, fan, seal o thermostat ang dahilan ng hindi paglamig, tagas at ingay at inayos."],
  ), [DIAG(), REPAIR(185, t7(
    ["Refrigerator repair labour", "The failed component replaced and the fridge run until it holds temperature."],
    ["Main-d'œuvre — réparation de réfrigérateur", "Composant défaillant remplacé et réfrigérateur testé jusqu'à ce qu'il tienne la température."],
    ["Mano de obra — reparación de refrigerador", "Componente dañado reemplazado y el refrigerador probado hasta mantener la temperatura."],
    ["Manodopera — riparazione frigorifero", "Componente guasto sostituito e frigorifero provato finché mantiene la temperatura."],
    ["Arbeit — Kühlschrankreparatur", "Defektes Bauteil ersetzt und Kühlschrank betrieben, bis er die Temperatur hält."],
    ["Робота — ремонт холодильника", "Несправний вузол замінено, холодильник перевірено до стабільної температури."],
    ["Labor — pag-ayos ng ref", "Pinalitan ang sirang parte at pinaandar hanggang tumama ang lamig."],
  )), PARTS(120)], D.regular("fixed", 10)),

  "fq.appliance_repair.repair.dishwasher": T("repair", n(
    ["Riparazione lavastoviglie", "Lavastoviglie che non lava, non scarica o perde riparata e provata con un ciclo completo."],
    ["Geschirrspülerreparatur", "Spüler, der nicht spült, nicht abpumpt oder leckt, repariert und mit einem vollen Programm getestet."],
    ["Ремонт посудомийної машини", "Машину, що не миє, не зливає чи протікає, відремонтовано й перевірено повним циклом."],
    ["Pag-ayos ng dishwasher", "Inayos ang dishwasher na hindi naglilinis, hindi nag-drain o tumutulo at sinubukan sa buong cycle."],
  ), [DIAG(), REPAIR(165, t7(
    ["Dishwasher repair labour", "Pump, valve, float or door seal repaired and a full cycle run."],
    ["Main-d'œuvre — réparation de lave-vaisselle", "Pompe, valve, flotteur ou joint de porte réparé et cycle complet lancé."],
    ["Mano de obra — reparación de lavavajillas", "Bomba, válvula, flotador o sello de puerta reparado y ciclo completo probado."],
    ["Manodopera — riparazione lavastoviglie", "Pompa, valvola, galleggiante o guarnizione riparati e ciclo completo eseguito."],
    ["Arbeit — Spülerreparatur", "Pumpe, Ventil, Schwimmer oder Türdichtung repariert und ein volles Programm gefahren."],
    ["Робота — ремонт посудомийки", "Насос, клапан, поплавець чи ущільнювач відремонтовано, повний цикл запущено."],
    ["Labor — pag-ayos ng dishwasher", "Inayos ang pump, valve, float o door seal at pinatakbo ang buong cycle."],
  )), PARTS(90)], D.regular("fixed", 10)),

  "fq.appliance_repair.repair.oven_range": T("repair", n(
    ["Riparazione forno e piano cottura", "Forno o piano cottura che non scalda o non accende riparato e tarato."],
    ["Backofen- und Herdreparatur", "Backofen oder Herd, der nicht heizt oder zündet, repariert und kalibriert."],
    ["Ремонт духовки й плити", "Духовку чи плиту, що не гріє або не запалює, відремонтовано й відкалібровано."],
    ["Pag-ayos ng oven at kalan", "Inayos at kinalibrate ang oven o kalan na hindi umiinit o hindi nagsisindi."],
  ), [DIAG(), REPAIR(165, t7(
    ["Oven and range repair labour", "Element, igniter, sensor or board replaced and the temperature checked."],
    ["Main-d'œuvre — réparation de four et cuisinière", "Élément, allumeur, sonde ou carte remplacé et température vérifiée."],
    ["Mano de obra — reparación de horno y estufa", "Resistencia, encendedor, sensor o tarjeta reemplazado y temperatura revisada."],
    ["Manodopera — riparazione forno", "Resistenza, accenditore, sonda o scheda sostituiti e temperatura verificata."],
    ["Arbeit — Herdreparatur", "Heizelement, Zünder, Fühler oder Platine ersetzt und Temperatur geprüft."],
    ["Робота — ремонт духовки й плити", "ТЕН, запальник, датчик чи плату замінено, температуру перевірено."],
    ["Labor — pag-ayos ng oven at kalan", "Pinalitan ang element, igniter, sensor o board at chineck ang temperatura."],
  )), PARTS(95)], D.regular("fixed", 10)),

  "fq.appliance_repair.repair.washer": T("repair", n(
    ["Riparazione lavatrice", "Perdite, problemi di scarico e guasti meccanici della lavatrice riparati."],
    ["Waschmaschinenreparatur", "Lecks, Abpumpprobleme und mechanische Defekte der Waschmaschine behoben."],
    ["Ремонт пральної машини", "Протікання, проблеми зі зливом і механічні несправності пральної машини усунено."],
    ["Pag-ayos ng washing machine", "Inayos ang tagas, problema sa drain at sirang mekanikal ng washing machine."],
  ), [DIAG(), REPAIR(165, t7(
    ["Washer repair labour", "Pump, belt, lid switch, bearing or valve replaced and a load run."],
    ["Main-d'œuvre — réparation de laveuse", "Pompe, courroie, interrupteur de couvercle, roulement ou valve remplacé et brassée testée."],
    ["Mano de obra — reparación de lavadora", "Bomba, banda, interruptor de tapa, balero o válvula reemplazado y una carga probada."],
    ["Manodopera — riparazione lavatrice", "Pompa, cinghia, interruttore coperchio, cuscinetto o valvola sostituiti e lavaggio provato."],
    ["Arbeit — Waschmaschinenreparatur", "Pumpe, Riemen, Deckelschalter, Lager oder Ventil ersetzt und eine Ladung gewaschen."],
    ["Робота — ремонт пральної машини", "Насос, пас, вимикач кришки, підшипник чи клапан замінено, прання перевірено."],
    ["Labor — pag-ayos ng washer", "Pinalitan ang pump, belt, lid switch, bearing o valve at sinubukan sa isang load."],
  )), PARTS(85)], D.regular("fixed", 10)),

  "fq.appliance_repair.repair.dryer": T("repair", n(
    ["Riparazione asciugatrice", "Guasti di riscaldamento e flusso d'aria dell'asciugatrice riparati perché asciughi di nuovo in un ciclo."],
    ["Trocknerreparatur", "Heiz- und Luftstromfehler des Trockners behoben, damit er wieder in einem Durchgang trocknet."],
    ["Ремонт сушильної машини", "Несправності нагріву й потоку повітря усунено, щоб білизна знову сохла за один цикл."],
    ["Pag-ayos ng dryer", "Inayos ang sira sa init at hangin ng dryer para matuyo ulit sa isang cycle."],
  ), [DIAG(), REPAIR(165, t7(
    ["Dryer repair labour", "Element, thermal fuse, belt or roller replaced and the vent airflow checked."],
    ["Main-d'œuvre — réparation de sécheuse", "Élément, fusible thermique, courroie ou roulette remplacé et débit de l'évent vérifié."],
    ["Mano de obra — reparación de secadora", "Resistencia, fusible térmico, banda o rodillo reemplazado y flujo del ducto revisado."],
    ["Manodopera — riparazione asciugatrice", "Resistenza, fusibile termico, cinghia o rullo sostituiti e flusso dello scarico verificato."],
    ["Arbeit — Trocknerreparatur", "Heizelement, Thermosicherung, Riemen oder Rolle ersetzt und Abluftstrom geprüft."],
    ["Робота — ремонт сушарки", "ТЕН, термозапобіжник, пас чи ролик замінено, потік вентиляції перевірено."],
    ["Labor — pag-ayos ng dryer", "Pinalitan ang element, thermal fuse, belt o roller at chineck ang hangin sa vent."],
  )), PARTS(60)], D.regular("fixed", 10)),

  "fq.appliance_repair.additional.leak_diagnosis": T("repair", n(
    ["Diagnosi e riparazione perdite", "La fonte di una perdita d'acqua da un elettrodomestico trovata e riparata."],
    ["Leckdiagnose und Reparatur", "Die Quelle eines Wasserlecks an einem Gerät gefunden und behoben."],
    ["Діагностика й усунення протікання", "Джерело протікання побутового приладу знайдено й усунено."],
    ["Diagnosis at pag-ayos ng tagas", "Nahanap at inayos ang pinagmulan ng tagas ng appliance."],
  ), [DIAG(), REPAIR(140, t7(
    ["Leak repair labour", "Hose, seal, valve or fitting replaced and the appliance run dry-checked."],
    ["Main-d'œuvre — réparation de fuite", "Tuyau, joint, valve ou raccord remplacé et appareil testé à sec."],
    ["Mano de obra — reparación de fuga", "Manguera, sello, válvula o conexión reemplazado y aparato probado sin fugas."],
    ["Manodopera — riparazione perdita", "Tubo, guarnizione, valvola o raccordo sostituiti e apparecchio verificato senza perdite."],
    ["Arbeit — Leckreparatur", "Schlauch, Dichtung, Ventil oder Anschluss ersetzt und Gerät auf Dichtheit geprüft."],
    ["Робота — усунення протікання", "Шланг, ущільнювач, клапан чи фітинг замінено, прилад перевірено на сухість."],
    ["Labor — pag-ayos ng tagas", "Pinalitan ang hose, seal, valve o fitting at sinubukan kung tuyo na."],
  )), PARTS(40)], null),

  // ── Installation ──
  "fq.appliance_repair.additional.installation": T("installation", n(
    ["Installazione elettrodomestico", "Un elettrodomestico nuovo posizionato, collegato ad acqua, gas o corrente e provato."],
    ["Geräteinstallation", "Ein neues Gerät aufgestellt, an Wasser, Gas oder Strom angeschlossen und getestet."],
    ["Встановлення побутової техніки", "Новий прилад встановлено, під'єднано до води, газу чи електрики й перевірено."],
    ["Pagkabit ng appliance", "Inilagay, ikinonekta sa tubig, gas o kuryente at sinubukan ang bagong appliance."],
  ), [
    L.labour(1, "each", 175, t7(
      ["Dishwasher installation labour", "Old unit out, new dishwasher set, water, drain and power connected, levelled and cycled."],
      ["Main-d'œuvre — installation de lave-vaisselle", "Ancien appareil retiré, nouveau lave-vaisselle posé, eau, drain et électricité raccordés, nivelé et testé."],
      ["Mano de obra — instalación de lavavajillas", "Equipo viejo fuera, lavavajillas nuevo colocado, agua, drenaje y corriente conectados, nivelado y probado."],
      ["Manodopera — installazione lavastoviglie", "Vecchio apparecchio tolto, nuova lavastoviglie posata, acqua, scarico e corrente collegati, livellata e provata."],
      ["Arbeit — Spüler einbauen", "Altgerät raus, neuer Spüler gesetzt, Wasser, Ablauf und Strom angeschlossen, ausgerichtet und getestet."],
      ["Робота — встановлення посудомийки", "Старий прилад знято, нову машину встановлено, воду, злив і живлення під'єднано, вирівняно й перевірено."],
      ["Labor — pagkabit ng dishwasher", "Tinanggal ang luma, inilagay ang bago, ikinonekta ang tubig, drain at kuryente, nilevel at sinubukan."],
    )),
    hdMaterial(HD.supply_line, t7(
      ["Braided supply line", "Stainless braided dishwasher supply line."],
      ["Flexible tressé", "Flexible d'alimentation tressé en inox pour lave-vaisselle."],
      ["Flexible trenzado", "Flexible de suministro trenzado de acero inoxidable para lavavajillas."],
      ["Flessibile intrecciato", "Flessibile di alimentazione in acciaio intrecciato per lavastoviglie."],
      ["Geflochtener Zulaufschlauch", "Edelstahlgeflochtener Zulaufschlauch für den Spüler."],
      ["Обплетена підводка", "Підводка для посудомийки в обплетенні з нержавіючої сталі."],
      ["Braided supply line", "Stainless braided na supply line para sa dishwasher."],
    )),
    L.material(1, "each", 40, t7(
      ["Drain hose and power cord kit", "Dishwasher drain hose extension and a 3-prong power cord."],
      ["Tuyau de drain et cordon d'alimentation", "Rallonge de tuyau de drain et cordon d'alimentation à 3 broches."],
      ["Manguera de drenaje y cable de corriente", "Extensión de manguera de drenaje y cable de 3 puntas."],
      ["Tubo di scarico e cavo di alimentazione", "Prolunga del tubo di scarico e cavo a 3 poli."],
      ["Ablaufschlauch und Netzkabel", "Ablaufschlauchverlängerung und dreipoliges Netzkabel."],
      ["Зливний шланг і шнур живлення", "Подовжувач зливного шланга та трижильний шнур живлення."],
      ["Drain hose at power cord", "Extension ng drain hose at 3-prong na power cord."],
    )),
  ], null),

  "fq.appliance_repair.additional.install_upgrade_visit": T("installation", n(
    ["Installazione o sostituzione elettrodomestico — visita prenotata", "Visita prenotata per installare un elettrodomestico nuovo o sostituirne uno vecchio."],
    ["Geräteinstallation oder -austausch — gebuchter Termin", "Gebuchter Termin, um ein neues Gerät einzubauen oder ein altes zu ersetzen."],
    ["Встановлення чи заміна техніки — запланований візит", "Запланований візит, щоб встановити новий прилад або замінити старий."],
    ["Pagkabit o palit ng appliance — naka-book", "Naka-book na visit para ikabit ang bagong appliance o palitan ang luma."],
  ), [
    L.labour(1, "each", 175, t7(
      ["Range or cooktop installation", "Old unit out, the new range or cooktop connected to its cord or gas line, anti-tip bracket fitted and tested."],
      ["Pose de cuisinière ou de table de cuisson", "Ancien appareil retiré, nouvelle cuisinière ou table raccordée au cordon ou au gaz, support antibasculement posé et testé."],
      ["Instalación de estufa o parrilla", "Equipo viejo fuera, estufa o parrilla nueva conectada al cable o al gas, soporte antivuelco colocado y probado."],
      ["Installazione cucina o piano cottura", "Vecchio apparecchio tolto, nuova cucina o piano collegati al cavo o al gas, staffa antiribaltamento montata e provata."],
      ["Herd- oder Kochfeldeinbau", "Altgerät raus, neuer Herd oder Kochfeld an Kabel oder Gas angeschlossen, Kippschutz montiert und getestet."],
      ["Встановлення плити чи варильної поверхні", "Старий прилад знято, нову плиту під'єднано до шнура чи газу, кронштейн від перекидання встановлено й перевірено."],
      ["Pagkabit ng range o cooktop", "Tinanggal ang luma, ikinonekta ang bago sa cord o gas line, ikinabit ang anti-tip bracket at sinubukan."],
    ), { measurementKey: "each" }),
    L.material(1, "each", 45, t7(
      ["Range cord or gas connector", "4-wire range cord or a coated gas connector with fittings."],
      ["Cordon de cuisinière ou raccord de gaz", "Cordon de cuisinière à 4 fils ou raccord de gaz enrobé avec raccords."],
      ["Cable de estufa o conector de gas", "Cable de 4 hilos o conector de gas recubierto con conexiones."],
      ["Cavo cucina o raccordo gas", "Cavo a 4 fili o raccordo gas rivestito con raccordi."],
      ["Herdanschlusskabel oder Gasanschluss", "Vieradriges Herdkabel oder ummantelter Gasanschluss mit Fittings."],
      ["Шнур плити або газовий з'єднувач", "Чотирижильний шнур або газовий шланг у покритті з фітингами."],
      ["Range cord o gas connector", "4-wire na range cord o coated na gas connector na may fittings."],
    ), { measurementKey: "each" }),
  ], null),

  "fq.appliance_repair.additional.laundry_hookup": T("installation", n(
    ["Collegamento lavatrice e asciugatrice", "Lavatrice e asciugatrice posizionate, acqua, scarico, corrente o gas e condotto collegati, livellate e provate."],
    ["Waschmaschine und Trockner anschließen", "Waschmaschine und Trockner aufgestellt, Wasser, Ablauf, Strom oder Gas und Abluft angeschlossen, ausgerichtet und getestet."],
    ["Підключення пральної й сушильної машин", "Машини встановлено, воду, злив, живлення чи газ і вентиляцію сушарки під'єднано, вирівняно й перевірено."],
    ["Pagkabit ng washer at dryer", "Inilagay ang washer at dryer, ikinonekta ang tubig, drain, kuryente o gas at vent, nilevel at sinubukan."],
  ), [
    L.labour(1, "each", 150, t7(
      ["Laundry pair hookup", "Both machines connected, levelled and run through a short cycle."],
      ["Raccordement de la paire", "Les deux appareils raccordés, mis de niveau et testés sur un cycle court."],
      ["Conexión del par", "Ambos equipos conectados, nivelados y probados en un ciclo corto."],
      ["Collegamento della coppia", "Entrambe le macchine collegate, livellate e provate con un ciclo breve."],
      ["Anschluss beider Geräte", "Beide Geräte angeschlossen, ausgerichtet und kurz getestet."],
      ["Підключення пари", "Обидві машини під'єднано, вирівняно й перевірено коротким циклом."],
      ["Pagkabit ng pares", "Ikinonekta, nilevel at sinubukan sa maikling cycle ang dalawang makina."],
    ), { measurementKey: "each" }),
    hdMaterial(HD.supply_line, t7(
      ["Braided supply line", "Stainless braided washer supply line."],
      ["Flexible tressé", "Flexible d'alimentation tressé en inox pour laveuse."],
      ["Flexible trenzado", "Flexible trenzado de acero inoxidable para lavadora."],
      ["Flessibile intrecciato", "Flessibile in acciaio intrecciato per lavatrice."],
      ["Geflochtener Zulaufschlauch", "Edelstahlgeflochtener Zulaufschlauch für die Waschmaschine."],
      ["Обплетена підводка", "Підводка для пральної машини в обплетенні з нержавійки."],
      ["Braided supply line", "Stainless braided na supply line para sa washer."],
    ), { measurementKey: "each" }),
    L.material(1, "each", 35, t7(
      ["Dryer vent transition kit", "Semi-rigid aluminium transition duct and clamps."],
      ["Ensemble de raccord d'évent", "Conduit de transition en aluminium semi-rigide et colliers."],
      ["Kit de transición del ducto", "Ducto de transición de aluminio semirrígido y abrazaderas."],
      ["Kit di raccordo scarico", "Condotto di transizione in alluminio semirigido e fascette."],
      ["Abluft-Übergangsset", "Halbstarrer Aluminium-Übergangsschlauch und Schellen."],
      ["Комплект перехідника вентиляції", "Напівжорсткий алюмінієвий перехідник і хомути."],
      ["Dryer vent transition kit", "Semi-rigid na aluminum transition duct at clamp."],
    ), { measurementKey: "each" }),
  ], null),

  // ── Inspection ──
  "fq.appliance_repair.maintenance.inspection": T("inspection", n(
    ["Ispezione elettrodomestico", "Condizioni e prestazioni dell'elettrodomestico valutate e ogni problema segnalato."],
    ["Geräteinspektion", "Zustand und Leistung des Geräts beurteilt und jedes Problem gemeldet."],
    ["Огляд побутової техніки", "Стан і роботу приладу оцінено, про кожну проблему повідомлено."],
    ["Inspeksyon ng appliance", "Sinuri ang kondisyon at performance ng appliance at ini-report ang anumang problema."],
  ), [DIAG(), SHARED.report(25)], null),

  "fq.appliance_repair.maintenance.inspection_visit": T("inspection", n(
    ["Ispezione elettrodomestico — visita prenotata", "Visita prenotata per valutare un elettrodomestico e dare raccomandazioni chiare."],
    ["Geräteinspektion — gebuchter Termin", "Gebuchter Termin, um ein Gerät zu beurteilen und klare Empfehlungen zu geben."],
    ["Огляд техніки — запланований візит", "Запланований візит для оцінки приладу з чіткими рекомендаціями."],
    ["Inspeksyon ng appliance — naka-book", "Naka-book na visit para suriin ang appliance at magbigay ng malinaw na rekomendasyon."],
  ), [DIAG()], null),

  "fq.appliance_repair.additional.electrical_troubleshooting": T("inspection", n(
    ["Ricerca guasti elettrici", "Problemi elettrici di un elettrodomestico — non si accende, fa saltare l'interruttore — individuati e spiegati."],
    ["Elektrische Fehlersuche", "Elektrische Probleme eines Geräts — geht nicht an, löst den Automaten aus — gefunden und erklärt."],
    ["Пошук електричних несправностей", "Електричні проблеми приладу — не вмикається, вибиває автомат — знайдено й пояснено."],
    ["Electrical troubleshooting", "Nahanap at ipinaliwanag ang problema sa kuryente ng appliance — ayaw bumukas, nagti-trip ang breaker."],
  ), [DIAG(), SHARED.techHour(1, 95)], null),

  // ── Maintenance ──
  "fq.appliance_repair.additional.dryer_vent_cleaning": T("maintenance", n(
    ["Pulizia condotto dell'asciugatrice", "Lanugine rimossa dal condotto dell'asciugatrice per ripristinare il flusso d'aria e ridurre il rischio d'incendio."],
    ["Trocknerabluft reinigen", "Flusen aus der Trocknerabluft entfernt, für freien Luftstrom und weniger Brandgefahr."],
    ["Чищення вентканалу сушарки", "Ворс видалено з каналу сушарки, щоб відновити потік повітря й знизити ризик пожежі."],
    ["Paglilinis ng dryer vent", "Inalis ang lint sa dryer vent para bumalik ang hangin at bumaba ang panganib ng sunog."],
  ), [
    L.labour(1, "each", 129, t7(
      ["Dryer vent cleaning — per dryer", "Duct brushed and vacuumed from the dryer to the outside hood, airflow checked."],
      ["Nettoyage du conduit — la sécheuse", "Conduit brossé et aspiré de la sécheuse au capuchon extérieur, débit vérifié."],
      ["Limpieza del ducto — por secadora", "Ducto cepillado y aspirado de la secadora a la campana exterior, flujo revisado."],
      ["Pulizia condotto — per asciugatrice", "Condotto spazzolato e aspirato dall'asciugatrice alla griglia esterna, flusso verificato."],
      ["Abluftreinigung — pro Trockner", "Kanal vom Trockner bis zur Außenhaube gebürstet und gesaugt, Luftstrom geprüft."],
      ["Чищення каналу — за сушарку", "Канал прочищено й пропилососено від сушарки до ковпака, потік перевірено."],
      ["Paglilinis ng vent — kada dryer", "Binrush at binakyum mula dryer hanggang hood at chineck ang hangin."],
    ), { measurementKey: "each" }),
  ], null),

  "fq.appliance_repair.maintenance.tune_up": T("maintenance", n(
    ["Tagliando elettrodomestico", "Componenti ispezionati e regolati per efficienza e durata."],
    ["Gerätewartung", "Bauteile geprüft und eingestellt, für Effizienz und längere Lebensdauer."],
    ["Обслуговування техніки", "Вузли оглянуто й відрегульовано для ефективності та довговічності."],
    ["Tune-up ng appliance", "Sinuri at inayos ang mga parte para sa efficiency at mas mahabang buhay."],
  ), [L.labour(1, "each", 99, t7(
    ["Appliance tune-up — per appliance", "Coils, seals, filters, hoses and controls checked, cleaned and adjusted."],
    ["Mise au point — l'appareil", "Serpentins, joints, filtres, tuyaux et commandes vérifiés, nettoyés et réglés."],
    ["Afinación — por aparato", "Serpentines, sellos, filtros, mangueras y controles revisados, limpiados y ajustados."],
    ["Tagliando — per apparecchio", "Batterie, guarnizioni, filtri, tubi e comandi controllati, puliti e regolati."],
    ["Wartung — pro Gerät", "Register, Dichtungen, Filter, Schläuche und Steuerung geprüft, gereinigt und eingestellt."],
    ["Обслуговування — за прилад", "Теплообмінники, ущільнювачі, фільтри, шланги й керування перевірено, очищено й налаштовано."],
    ["Tune-up — kada appliance", "Chineck, nilinis at inayos ang coil, seal, filter, hose at control."],
  ), { measurementKey: "each" })], D.bundle("percent", 10)),

  "fq.appliance_repair.maintenance.filter_replacement": T("maintenance", n(
    ["Sostituzione filtri", "Filtri dell'acqua e dell'aria dell'elettrodomestico sostituiti."],
    ["Filterwechsel", "Wasser- und Luftfilter des Geräts ersetzt."],
    ["Заміна фільтрів", "Водяні й повітряні фільтри приладу замінено."],
    ["Palit ng filter", "Pinalitan ang water at air filter ng appliance."],
  ), [
    L.labour(1, "each", 35, t7(
      ["Filter change — per filter", "Old filter out, new one seated and the water line flushed."],
      ["Changement de filtre — le filtre", "Ancien filtre retiré, nouveau posé et conduite d'eau purgée."],
      ["Cambio de filtro — por filtro", "Filtro viejo fuera, nuevo colocado y línea de agua purgada."],
      ["Cambio filtro — per filtro", "Vecchio filtro tolto, nuovo inserito e linea dell'acqua spurgata."],
      ["Filterwechsel — pro Filter", "Alter Filter raus, neuer eingesetzt und Wasserleitung gespült."],
      ["Заміна фільтра — за фільтр", "Старий фільтр знято, новий встановлено, лінію промито."],
      ["Palit ng filter — kada filter", "Tinanggal ang luma, ikinabit ang bago at ni-flush ang water line."],
    ), { measurementKey: "each" }),
    L.material(1, "each", 45, t7(
      ["Refrigerator water filter", "OEM-compatible fridge water filter, six-month rating."],
      ["Filtre à eau de réfrigérateur", "Filtre à eau compatible d'origine, durée de six mois."],
      ["Filtro de agua para refrigerador", "Filtro de agua compatible con el original, duración de seis meses."],
      ["Filtro acqua frigorifero", "Filtro acqua compatibile originale, durata sei mesi."],
      ["Kühlschrank-Wasserfilter", "Originalkompatibler Wasserfilter, sechs Monate Laufzeit."],
      ["Фільтр для води холодильника", "Сумісний з оригіналом фільтр, ресурс шість місяців."],
      ["Water filter ng ref", "OEM-compatible na water filter, anim na buwang gamit."],
    ), { measurementKey: "each" }),
  ], null),

  "fq.appliance_repair.maintenance.preventative": T("maintenance", n(
    ["Manutenzione preventiva", "Visita programmata per pulire e controllare gli elettrodomestici prima che si guastino."],
    ["Vorbeugende Wartung", "Geplanter Termin, um Geräte zu reinigen und zu prüfen, bevor sie ausfallen."],
    ["Профілактичне обслуговування", "Плановий візит, щоб очистити й перевірити техніку до поломки."],
    ["Preventive maintenance", "Naka-schedule na visit para linisin at suriin ang appliance bago masira."],
  ), [L.labour(1, "flat", 149, t7(
    ["Whole-kitchen maintenance visit", "Fridge coils vacuumed, dishwasher filter cleaned, range and washer checked."],
    ["Visite d'entretien de la cuisine", "Serpentins du frigo aspirés, filtre du lave-vaisselle nettoyé, cuisinière et laveuse vérifiées."],
    ["Visita de mantenimiento de cocina", "Serpentines del refrigerador aspirados, filtro del lavavajillas limpio, estufa y lavadora revisadas."],
    ["Visita di manutenzione cucina", "Batteria del frigo aspirata, filtro lavastoviglie pulito, cucina e lavatrice controllate."],
    ["Wartungstermin Küche", "Kühlschrankregister gesaugt, Spülerfilter gereinigt, Herd und Waschmaschine geprüft."],
    ["Обслуговування кухні", "Теплообмінник холодильника пропилососено, фільтр посудомийки очищено, плиту й пралку перевірено."],
    ["Maintenance visit ng kusina", "Binakyum ang coil ng ref, nilinis ang filter ng dishwasher, chineck ang range at washer."],
  ))], D.bundle("percent", 10)),

  // ── Taken from the schema agent's template draft (branch
  //    agent/services-templates-seeds-wip) for rows this file had not
  //    templated; prices and costs as drafted there. ──────────────────
  "fq.appliance_repair.additional.smart_setup": T("installation", {
    it: ["Configurazione di elettrodomestico smart", "L'elettrodomestico collegato al Wi-Fi di casa, l'app installata sul telefono del cliente e le notifiche e i programmi impostati insieme."],
    de: ["Einrichtung eines Smart-Geräts", "Das Gerät mit dem WLAN verbunden, die App auf dem Telefon des Kunden eingerichtet und Benachrichtigungen und Programme gemeinsam eingestellt."],
    uk: ["Налаштування розумної техніки", "Прилад підключено до домашнього Wi-Fi, застосунок встановлено на телефон клієнта, сповіщення та програми налаштовано разом."],
    tl: ["Pag-set up ng smart appliance", "Ikinonekta ang appliance sa Wi-Fi ng bahay, inilagay ang app sa telepono ng customer at magkasamang inayos ang notification at program."],
  }, [
    L.labour(1, "flat", 95, {
      en: ["Smart appliance set-up", "Wi-Fi pairing, app installation on the customer's phone, and notifications and schedules set up together."],
      fr: ["Configuration d'appareil connecté", "Jumelage Wi-Fi, installation de l'application sur le téléphone du client, notifications et horaires configurés ensemble."],
      es: ["Configuración de electrodoméstico inteligente", "Emparejamiento Wi-Fi, instalación de la app en el teléfono del cliente y notificaciones y horarios configurados juntos."],
      it: ["Configurazione di elettrodomestico smart", "Abbinamento Wi-Fi, installazione dell'app sul telefono del cliente, notifiche e programmi impostati insieme."],
      de: ["Einrichtung des Smart-Geräts", "WLAN-Kopplung, App-Installation auf dem Kundentelefon, Benachrichtigungen und Zeitpläne gemeinsam eingerichtet."],
      uk: ["Налаштування розумного приладу", "Підключення до Wi-Fi, встановлення застосунку на телефон клієнта, спільне налаштування сповіщень і розкладів."],
      tl: ["Pag-set up ng smart appliance", "Wi-Fi pairing, pag-install ng app sa telepono ng customer, at magkasamang pag-set up ng notification at schedule."],
    }, { cost: 45 }),
  ], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);

// ── Templates added 2026-09-25 ───────────────────────────────────────────────
//
// The owner (2026-09-25): a service added to a quote should arrive with a few
// lines, not as one bare line. The templates above cover seventeen rows;
// these cover the last five — the generic repair and repair visit, parts
// replacement, cleaning and performance optimisation — on the same footing:
// the capture's two generic templates (diagnostic $100 on $80, repair $200
// on $100), the $89 diagnostic and pass-through parts line above, and 2026
// appliance-repair rates. None carries a benchmark, so each range comes from
// its own lines.
//
// Kept apart from TEMPLATES and applied in a second pass, so every template
// above stays exactly as it was — a key that already has a template throws
// instead of being overwritten. Punjabi sits inline beside the other seven
// languages (the shared diagnostic and parts lines carry theirs already); the
// service's own name in every language is the row's (./i18n/appliance_repair.js).

/** [name, description] in the eight languages, in this order. */
const X = (en, fr, es, it, de, uk, pa, tl) => ({ en, fr, es, it, de, uk, pa, tl });
const GENERAL_REPAIR = () => REPAIR(175, X(
  ["Appliance repair labour", "The failed part replaced and the appliance run through a full cycle to confirm the fix."],
  ["Main-d'œuvre — réparation d'appareil", "Pièce défectueuse remplacée et appareil testé sur un cycle complet pour confirmer la réparation."],
  ["Mano de obra — reparación de electrodoméstico", "Pieza dañada reemplazada y el aparato probado en un ciclo completo para confirmar el arreglo."],
  ["Manodopera — riparazione elettrodomestico", "Pezzo guasto sostituito e apparecchio provato in un ciclo completo per confermare la riparazione."],
  ["Arbeit — Gerätereparatur", "Defektes Teil ersetzt und das Gerät einen vollen Zyklus betrieben, um die Reparatur zu bestätigen."],
  ["Робота — ремонт техніки", "Несправну деталь замінено, прилад перевірено повним циклом для підтвердження ремонту."],
  ["ਉਪਕਰਣ ਮੁਰੰਮਤ ਦੀ ਲੇਬਰ", "ਖ਼ਰਾਬ ਪੁਰਜ਼ਾ ਬਦਲਿਆ ਅਤੇ ਠੀਕ ਹੋਣ ਦੀ ਪੁਸ਼ਟੀ ਲਈ ਉਪਕਰਣ ਪੂਰਾ ਚੱਕਰ ਚਲਾਇਆ।"],
  ["Labor — pag-ayos ng appliance", "Pinalitan ang sirang piyesa at pinatakbo ang appliance sa buong cycle para matiyak ang ayos."],
));

const ADDED = {
  "fq.appliance_repair.repair.general": { kind: "repair", lines: [DIAG(), GENERAL_REPAIR(), PARTS(100)] },
  "fq.appliance_repair.repair.repair_visit": { kind: "repair", lines: [DIAG(), GENERAL_REPAIR(), PARTS(100)] },

  "fq.appliance_repair.additional.parts_replacement": { kind: "repair", lines: [
    REPAIR(125, X(
      ["Part replacement labour", "The worn or damaged part removed, the new one fitted and the appliance tested."],
      ["Main-d'œuvre — remplacement de pièce", "Pièce usée ou abîmée retirée, la neuve posée et appareil testé."],
      ["Mano de obra — cambio de pieza", "Pieza gastada o dañada retirada, la nueva colocada y el aparato probado."],
      ["Manodopera — sostituzione pezzo", "Pezzo usurato o danneggiato tolto, il nuovo montato e apparecchio provato."],
      ["Arbeit — Teiletausch", "Verschlissenes oder beschädigtes Teil ausgebaut, das neue eingebaut und das Gerät getestet."],
      ["Робота — заміна деталі", "Зношену чи пошкоджену деталь знято, нову встановлено, прилад перевірено."],
      ["ਪੁਰਜ਼ਾ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਘਸਿਆ ਜਾਂ ਖ਼ਰਾਬ ਪੁਰਜ਼ਾ ਕੱਢਿਆ, ਨਵਾਂ ਲਾਇਆ ਅਤੇ ਉਪਕਰਣ ਟੈਸਟ ਕੀਤਾ।"],
      ["Labor — palit ng piyesa", "Tinanggal ang luma o sirang piyesa, ikinabit ang bago at sinubukan ang appliance."],
    )),
    PARTS(120),
  ] },

  "fq.appliance_repair.additional.cleaning": { kind: "maintenance", lines: [
    L.labour(1, "flat", 129, X(
      ["Appliance deep clean", "Grease, scale and residue removed from the interior, seals, filters and vents, and the appliance run to check it."],
      ["Nettoyage en profondeur de l'appareil", "Graisse, tartre et résidus retirés de l'intérieur, des joints, des filtres et des évents, appareil testé ensuite."],
      ["Limpieza profunda del electrodoméstico", "Grasa, sarro y residuos retirados del interior, sellos, filtros y ventilas, y el aparato probado."],
      ["Pulizia a fondo dell'elettrodomestico", "Grasso, calcare e residui tolti da interno, guarnizioni, filtri e prese d'aria, poi apparecchio provato."],
      ["Gründliche Gerätereinigung", "Fett, Kalk und Rückstände aus Innenraum, Dichtungen, Filtern und Lüftungen entfernt, danach Probelauf."],
      ["Глибоке чищення приладу", "Жир, накип і залишки прибрано з середини, ущільнювачів, фільтрів і вентиляції, прилад перевірено."],
      ["ਉਪਕਰਣ ਦੀ ਡੂੰਘੀ ਸਫ਼ਾਈ", "ਅੰਦਰੋਂ, ਸੀਲਾਂ, ਫ਼ਿਲਟਰਾਂ ਅਤੇ ਵੈਂਟਾਂ ਤੋਂ ਚਿਕਨਾਈ, ਚੂਨਾ ਅਤੇ ਰਹਿੰਦ-ਖੂੰਹਦ ਹਟਾਈ, ਫਿਰ ਚਲਾ ਕੇ ਦੇਖਿਆ।"],
      ["Deep clean ng appliance", "Tinanggal ang grasa, kaliskis at dumi sa loob, seal, filter at vent, at pinaandar para i-check."],
    ), { cost: 65 }),
    L.material(1, "flat", 25, X(
      ["Descaler, degreaser and cleaning supplies", "Appliance-safe descaler, degreaser and cloths for one appliance."],
      ["Détartrant, dégraissant et fournitures", "Détartrant et dégraissant sans danger pour l'appareil, et chiffons, pour un appareil."],
      ["Descalcificador, desengrasante y material", "Descalcificador y desengrasante seguros para el aparato, y paños, para un aparato."],
      ["Anticalcare, sgrassante e materiale", "Anticalcare e sgrassante sicuri per l'apparecchio, e panni, per un apparecchio."],
      ["Entkalker, Entfetter und Reinigungsmaterial", "Gerätesicherer Entkalker und Entfetter sowie Tücher für ein Gerät."],
      ["Засіб від накипу, знежирювач і матеріали", "Безпечні для приладу засоби від накипу й жиру та серветки на один прилад."],
      ["ਡੀਸਕੇਲਰ, ਡੀਗ੍ਰੀਜ਼ਰ ਅਤੇ ਸਫ਼ਾਈ ਸਮਾਨ", "ਇੱਕ ਉਪਕਰਣ ਲਈ ਸੁਰੱਖਿਅਤ ਡੀਸਕੇਲਰ, ਡੀਗ੍ਰੀਜ਼ਰ ਅਤੇ ਕੱਪੜੇ।"],
      ["Descaler, degreaser at panlinis", "Ligtas sa appliance na descaler, degreaser at basahan para sa isang appliance."],
    ), { cost: 12 }),
  ] },

  "fq.appliance_repair.maintenance.performance_optimization": { kind: "maintenance", lines: [
    L.labour(1, "flat", 139, X(
      ["Tune-up and adjustment", "Temperatures, water levels, belts and door seals checked and set to the manufacturer's figures, and settings adjusted for efficiency."],
      ["Mise au point et réglage", "Températures, niveaux d'eau, courroies et joints de porte vérifiés et réglés selon le fabricant, réglages ajustés pour l'efficacité."],
      ["Afinación y ajuste", "Temperaturas, niveles de agua, bandas y sellos de puerta revisados y ajustados a los valores del fabricante, y la configuración afinada para eficiencia."],
      ["Messa a punto e regolazione", "Temperature, livelli d'acqua, cinghie e guarnizioni verificati e regolati sui valori del costruttore, impostazioni ottimizzate."],
      ["Wartung und Einstellung", "Temperaturen, Wasserstände, Riemen und Türdichtungen geprüft und auf Herstellerwerte eingestellt, Einstellungen auf Effizienz angepasst."],
      ["Налаштування й регулювання", "Температури, рівні води, паси й ущільнювачі дверей перевірено й виставлено за виробником, налаштування оптимізовано."],
      ["ਟਿਊਨ-ਅੱਪ ਅਤੇ ਐਡਜਸਟਮੈਂਟ", "ਤਾਪਮਾਨ, ਪਾਣੀ ਦਾ ਪੱਧਰ, ਬੈਲਟਾਂ ਅਤੇ ਦਰਵਾਜ਼ੇ ਦੀਆਂ ਸੀਲਾਂ ਜਾਂਚ ਕੇ ਕੰਪਨੀ ਮੁਤਾਬਕ ਸੈੱਟ, ਅਤੇ ਬੱਚਤ ਲਈ ਸੈਟਿੰਗਾਂ ਠੀਕ।"],
      ["Tune-up at adjustment", "Chineck at in-set ayon sa manufacturer ang temperatura, lebel ng tubig, belt at seal ng pinto, at inayos ang setting para makatipid."],
    ), { cost: 70 }),
    L.material(1, "flat", 25, X(
      ["Gaskets, filters and small parts", "Small wear parts found during the tune-up — a filter, a gasket, a clip."],
      ["Joints, filtres et petites pièces", "Petites pièces d'usure repérées pendant la mise au point — un filtre, un joint, une attache."],
      ["Empaques, filtros y piezas menores", "Piezas menores de desgaste halladas en la afinación: un filtro, un empaque, un clip."],
      ["Guarnizioni, filtri e minuteria", "Piccoli pezzi d'usura trovati durante la messa a punto — un filtro, una guarnizione, una clip."],
      ["Dichtungen, Filter und Kleinteile", "Kleine Verschleißteile, die bei der Wartung auffallen — ein Filter, eine Dichtung, ein Clip."],
      ["Ущільнювачі, фільтри й дрібні деталі", "Дрібні зношувані деталі, знайдені під час налаштування, — фільтр, прокладка, затискач."],
      ["ਗੈਸਕਟ, ਫ਼ਿਲਟਰ ਅਤੇ ਛੋਟੇ ਪੁਰਜ਼ੇ", "ਟਿਊਨ-ਅੱਪ ਦੌਰਾਨ ਮਿਲੇ ਛੋਟੇ ਘਸਣ ਵਾਲੇ ਪੁਰਜ਼ੇ — ਫ਼ਿਲਟਰ, ਗੈਸਕਟ, ਕਲਿੱਪ।"],
      ["Gasket, filter at maliliit na piyesa", "Maliliit na piyesang pudpod na nakita sa tune-up — filter, gasket, clip."],
    ), { cost: 15 }),
  ] },
};

for (const key of Object.keys(ADDED)) {
  if (SEED.services.find((s) => s.seedKey === key)?.templateLines) throw new Error(`appliance_repair: ${key} already has a template — this pass only adds`);
}
withTemplates(SEED, Object.fromEntries(Object.entries(ADDED).map(([key, a]) => {
  const s = I18N.services[key];
  return [key, T(a.kind, { it: s.it, de: s.de, uk: s.uk, pa: s.pa, tl: s.tl }, a.lines, null)];
})));

// Shared services: one canonical row here, installed for these quote types too.
tagRows(SEED, {
  "fq.appliance_repair.additional.dryer_vent_cleaning": ["air_duct_cleaning", "hvac_repair"],
});
