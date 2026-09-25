// app/data/serviceSeeds/hvac_repair.js
//
// The service list an HVAC repair company starts from. Read the header of
// ./index.js for the format and the rules every file in this folder follows.
//
// Every benchmark heading for the trade except "System Installation" lands
// here — whole-system installs sit in ./hvac_install.js because the catalogue
// splits the trade in two. The source's "General Maintenance & Controls"
// heading is split into "maintenance" (tune-ups, cleanings, insulation) and
// "controls" (capacitors, contactors, boards, fuses, thermostats), and its
// "Book Now" rows are filed under the category each belongs to, keeping their
// booking length and bookable flag.
//
// The refrigerant rows priced "per pound" carry unit "each" — the quantity on
// the quote line is the number of pounds added — even though the source left
// the unit blank; a flat price on a per-pound charge would be a lie.
//
// No takeoff or price book exists for HVAC, so nothing here is pricedBy.

// Compact constructors — this file imports nothing (see index.js), so they are
// declared here. Every entry below is the same shape as the long-hand ones.
import { L, SHARED, D, T, withTemplates, hdMaterial, tagRows, withLanguages } from "./_templateLines";
import { HD } from "./_materialCosts";
import { materialRef } from "../materialReference.js";
import { I18N } from "./i18n/hvac_repair.js";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "hvac_repair",
  categories: [
    { key: "blower", name: { en: "Blower motors", fr: "Moteurs de ventilateur", es: "Motores del ventilador" } },
    { key: "coils", name: { en: "Coils", fr: "Serpentins", es: "Serpentines" } },
    { key: "compressor", name: { en: "Compressors", fr: "Compresseurs", es: "Compresores" } },
    { key: "condensate", name: { en: "Condensate drain", fr: "Drain de condensat", es: "Drenaje de condensado" } },
    { key: "condenser", name: { en: "Condenser", fr: "Condenseur", es: "Condensador" } },
    { key: "belts", name: { en: "Fan belts and pulleys", fr: "Courroies et poulies", es: "Bandas y poleas" } },
    { key: "air_quality", name: { en: "Filters and air quality", fr: "Filtres et qualité de l'air", es: "Filtros y calidad del aire" } },
    { key: "controls", name: { en: "Electrical and controls", fr: "Électricité et commandes", es: "Eléctrico y controles" } },
    { key: "maintenance", name: { en: "Maintenance and tune-ups", fr: "Entretien et mises au point", es: "Mantenimiento y afinación" } },
    { key: "heat_exchanger", name: { en: "Heat exchangers and venting", fr: "Échangeurs de chaleur et évacuation", es: "Intercambiadores de calor y ventilación" } },
    { key: "refrigerant", name: { en: "Refrigerant and leaks", fr: "Réfrigérant et fuites", es: "Refrigerante y fugas" } },
    { key: "diagnostics", name: { en: "Diagnostics and repair visits", fr: "Diagnostics et visites de réparation", es: "Diagnósticos y visitas de reparación" } },
  ],
  services: [
    // ── Blower motors ────────────────────────────────────────────────────
    {
      seedKey: "fq.hvac_repair.blower.replace_motor",
      category: "blower",
      name: {
        en: "Blower motor replacement",
        fr: "Remplacement du moteur de ventilateur",
        es: "Reemplazo del motor del ventilador",
      },
      description: {
        en: "A failed indoor blower motor swapped for a new one and wired in, bringing airflow through the ducts back to normal.",
        fr: "Moteur de ventilateur intérieur défectueux remplacé par un neuf et câblé, pour rétablir un débit d'air normal dans les conduits.",
        es: "Motor del ventilador interior dañado sustituido por uno nuevo y cableado, para que el aire vuelva a circular normalmente por los ductos.",
      },
      unit: "flat",
      benchmark: { low: 350, median: 639, high: 1000, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.blower.replace_motor_module",
      category: "blower",
      name: {
        en: "Blower motor control module replacement",
        fr: "Remplacement du module de commande du moteur de ventilateur",
        es: "Reemplazo del módulo de control del motor del ventilador",
      },
      description: {
        en: "The electronic module that sets the blower's fan speed is removed and a new one fitted, so the system can again ramp airflow up and down as designed.",
        fr: "Le module électronique qui règle la vitesse du ventilateur est retiré et remplacé par un neuf, pour que le système module de nouveau le débit d'air comme prévu.",
        es: "Se retira el módulo electrónico que regula la velocidad del ventilador y se coloca uno nuevo, para que el sistema vuelva a variar el flujo de aire como fue diseñado.",
      },
      unit: "flat",
      benchmark: { low: 425, median: 800, high: 1344, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.blower.replace_wheel",
      category: "blower",
      name: {
        en: "Blower wheel replacement",
        fr: "Remplacement de la roue du ventilateur",
        es: "Reemplazo de la turbina del ventilador",
      },
      description: {
        en: "A worn, cracked or out-of-balance blower wheel is taken off the motor shaft and replaced, restoring quiet, even airflow.",
        fr: "Roue de ventilateur usée, fissurée ou déséquilibrée retirée de l'arbre du moteur et remplacée, pour un débit d'air régulier et silencieux.",
        es: "Turbina del ventilador desgastada, agrietada o desbalanceada retirada del eje del motor y reemplazada, para un flujo de aire parejo y silencioso.",
      },
      unit: "flat",
      benchmark: { low: 323, median: 428, high: 600, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.blower.clean_motor",
      category: "blower",
      name: {
        en: "Blower motor and assembly cleaning",
        fr: "Nettoyage du moteur et de la cage du ventilateur",
        es: "Limpieza del motor y la turbina del ventilador",
      },
      description: {
        en: "The blower motor, wheel and housing are pulled and cleaned of packed dust and lint that cut airflow and make the motor work harder.",
        fr: "Moteur, roue et boîtier du ventilateur démontés et débarrassés de la poussière et de la charpie accumulées qui étouffent le débit d'air et surchargent le moteur.",
        es: "Motor, turbina y carcasa del ventilador desmontados y limpiados del polvo y la pelusa acumulados que reducen el flujo de aire y sobrecargan el motor.",
      },
      unit: "flat",
      benchmark: { low: 340, median: 415, high: 499, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.blower.evaporator_motor",
      category: "blower",
      name: {
        en: "Evaporator fan motor replacement or installation",
        fr: "Remplacement ou installation du moteur de ventilateur de l'évaporateur",
        es: "Reemplazo o instalación del motor del ventilador del evaporador",
      },
      description: {
        en: "The fan motor that pulls air across the indoor evaporator coil is replaced or newly installed and tested under load.",
        fr: "Moteur du ventilateur qui pousse l'air à travers le serpentin de l'évaporateur remplacé ou installé à neuf, puis testé en charge.",
        es: "Motor del ventilador que mueve el aire a través del serpentín del evaporador reemplazado o instalado nuevo, luego probado bajo carga.",
      },
      unit: "flat",
      benchmark: { low: 400, median: 755, high: 1357, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },

    // ── Coils ────────────────────────────────────────────────────────────
    // ── Online-booking visits (the source's "Book Now" rows) ─────────────
    S("fq.hvac_repair.air_quality.air_quality_visit", "air_quality", "flat", BM(108, 155, 619),
      ["Indoor air quality visit", "Visite qualité de l'air intérieur", "Visita de calidad del aire interior"],
      ["A two-hour visit for dust, allergens, humidity, poor ventilation or filter trouble: the cause is found and the fix is priced on the spot.",
       "Visite de deux heures pour la poussière, les allergènes, l'humidité, une mauvaise ventilation ou un problème de filtre : la cause est trouvée et la correction chiffrée sur place.",
       "Visita de dos horas por polvo, alérgenos, humedad, mala ventilación o problemas de filtro: se encuentra la causa y se cotiza la solución en el momento."],
      { durationMinutes: 120, bookable: true }),
    S("fq.hvac_repair.air_quality.duct_cleaning_visit", "air_quality", "flat", BM(625, 920, 1495),
      ["Duct cleaning — booked visit", "Nettoyage de conduits — visite réservée", "Limpieza de ductos — visita agendada"],
      ["Dust, allergens and debris pulled out of the supply and return ducts, so the air moving through the house is cleaner and the system works less.",
       "Poussière, allergènes et débris retirés des conduits d'alimentation et de retour : l'air qui circule dans la maison est plus propre et le système force moins.",
       "Polvo, alérgenos y residuos extraídos de los ductos de suministro y retorno, para que el aire que circula en la casa sea más limpio y el sistema trabaje menos."],
      { durationMinutes: 120, bookable: true }),
    S("fq.hvac_repair.diagnostics.heating_repair_visit", "diagnostics", "flat", BM(89, 105, 138),
      ["Heating repair visit", "Visite de réparation du chauffage", "Visita de reparación de calefacción"],
      ["For no heat, rooms that never even out, a furnace making new noises or a bill that jumped: a technician finds the fault and repairs it on the same visit where possible.",
       "Pas de chaleur, pièces inégales, fournaise qui fait de nouveaux bruits ou facture qui grimpe : un technicien trouve la panne et la répare pendant la même visite quand c'est possible.",
       "Sin calor, cuartos desparejos, un horno con ruidos nuevos o una factura que subió: un técnico encuentra la falla y la repara en la misma visita cuando es posible."],
      { durationMinutes: 120, bookable: true }),
    S("fq.hvac_repair.diagnostics.cooling_repair_visit", "diagnostics", "flat", BM(85, 95, 125),
      ["Cooling repair visit", "Visite de réparation de la climatisation", "Visita de reparación de aire acondicionado"],
      ["For no cooling, uneven rooms, an air conditioner making new noises or a bill that jumped: the fault is found and repaired on the same visit where possible.",
       "Pas de fraîcheur, pièces inégales, climatiseur bruyant ou facture qui grimpe : la panne est trouvée et réparée pendant la même visite quand c'est possible.",
       "Sin enfriamiento, cuartos desparejos, un aire acondicionado ruidoso o una factura que subió: la falla se encuentra y se repara en la misma visita cuando es posible."],
      { durationMinutes: 120, bookable: true }),
    S("fq.hvac_repair.controls.thermostat_visit", "controls", "flat", BM(99, 139, 225),
      ["Thermostat repair or replacement visit", "Visite thermostat — réparation ou remplacement", "Visita de termostato — reparación o reemplazo"],
      ["A thermostat that reads wrong, will not hold its setting, has a dead display or ignores changes is repaired or replaced with a new unit.",
       "Un thermostat qui affiche mal, ne garde pas sa consigne, a l'écran éteint ou ignore les réglages est réparé ou remplacé par un neuf.",
       "Un termostato que marca mal, no mantiene el ajuste, tiene la pantalla apagada o ignora los cambios se repara o se cambia por uno nuevo."],
      { durationMinutes: 120, bookable: true }),
    {
      seedKey: "fq.hvac_repair.coils.inspect",
      category: "coils",
      name: {
        en: "Coil inspection",
        fr: "Inspection des serpentins",
        es: "Inspección de serpentines",
      },
      description: {
        en: "Evaporator and condenser coils checked for corrosion, bent fins, oil stains and refrigerant leaks, with findings reported before any repair is quoted.",
        fr: "Serpentins de l'évaporateur et du condenseur examinés pour la corrosion, les ailettes pliées, les traces d'huile et les fuites de réfrigérant, constat remis avant toute soumission de réparation.",
        es: "Serpentines del evaporador y del condensador revisados por corrosión, aletas dobladas, manchas de aceite y fugas de refrigerante, con un informe antes de cotizar cualquier reparación.",
      },
      unit: "flat",
      benchmark: { low: 80, median: 125, high: 185, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.coils.clean",
      category: "coils",
      name: {
        en: "Coil cleaning — evaporator and condenser",
        fr: "Nettoyage des serpentins — évaporateur et condenseur",
        es: "Limpieza de serpentines — evaporador y condensador",
      },
      description: {
        en: "Both coils cleaned of the dirt and lint film that blocks heat transfer, so the system cools and heats at full capacity again.",
        fr: "Les deux serpentins débarrassés de la pellicule de saleté qui bloque l'échange de chaleur, pour que le système retrouve toute sa capacité.",
        es: "Ambos serpentines limpiados de la capa de suciedad que bloquea el intercambio de calor, para que el sistema recupere toda su capacidad.",
      },
      unit: "flat",
      benchmark: { low: 250, median: 425, high: 650, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.coils.chemical_clean",
      category: "coils",
      name: {
        en: "Chemical coil cleaning",
        fr: "Nettoyage chimique des serpentins",
        es: "Limpieza química de serpentines",
      },
      description: {
        en: "Heavily fouled coils treated with a coil-safe cleaning agent that lifts baked-on grime a rinse alone cannot, then rinsed clear.",
        fr: "Serpentins fortement encrassés traités avec un produit nettoyant adapté qui dissout les dépôts tenaces qu'un simple rinçage ne retire pas, puis rincés.",
        es: "Serpentines muy sucios tratados con un producto limpiador apto para serpentines que despega la mugre incrustada que un enjuague solo no quita, y luego enjuagados.",
      },
      unit: "flat",
      benchmark: { low: 150, median: 299, high: 475, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.coils.replace",
      category: "coils",
      name: {
        en: "Coil replacement",
        fr: "Remplacement de serpentin",
        es: "Reemplazo de serpentín",
      },
      description: {
        en: "A corroded or leaking coil that is past repair is removed and a matching new coil brazed in, evacuated and recharged.",
        fr: "Serpentin corrodé ou fuyant, irréparable, retiré puis remplacé par un serpentin neuf compatible, brasé, mis sous vide et rechargé.",
        es: "Serpentín corroído o con fugas que ya no se puede reparar, retirado y sustituido por uno nuevo compatible, soldado, evacuado y recargado.",
      },
      unit: "flat",
      benchmark: { low: 1100, median: 2050, high: 3500, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.coils.protective_coating",
      category: "coils",
      name: {
        en: "Protective coil coating",
        fr: "Revêtement protecteur des serpentins",
        es: "Recubrimiento protector de serpentines",
      },
      description: {
        en: "A protective coating applied to clean coils to slow corrosion and keep dirt from bonding to the fins, extending their working life.",
        fr: "Enduit protecteur appliqué sur des serpentins propres pour ralentir la corrosion et empêcher la saleté d'adhérer aux ailettes, prolongeant leur durée de vie.",
        es: "Recubrimiento protector aplicado sobre serpentines limpios para frenar la corrosión y evitar que la suciedad se adhiera a las aletas, alargando su vida útil.",
      },
      unit: "flat",
      benchmark: { low: 375, median: 445, high: 1099, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.coils.repair",
      category: "coils",
      name: {
        en: "Coil repair",
        fr: "Réparation de serpentin",
        es: "Reparación de serpentín",
      },
      description: {
        en: "A leak or damaged section on an evaporator or condenser coil brazed and pressure-tested, keeping a coil that still has life in it instead of replacing it.",
        fr: "Fuite ou section abîmée d'un serpentin d'évaporateur ou de condenseur brasée et testée en pression, pour conserver un serpentin encore en bon état plutôt que de le remplacer.",
        es: "Fuga o sección dañada de un serpentín de evaporador o condensador soldada y probada a presión, conservando un serpentín que aún sirve en lugar de cambiarlo.",
      },
      unit: "flat",
      benchmark: { low: 149, median: 435, high: 1704, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.coils.evaporator_clean",
      category: "coils",
      name: {
        en: "Evaporator coil cleaning",
        fr: "Nettoyage du serpentin de l'évaporateur",
        es: "Limpieza del serpentín del evaporador",
      },
      description: {
        en: "The indoor evaporator coil opened up and cleaned so air passes through freely and the coil no longer ices over.",
        fr: "Serpentin intérieur de l'évaporateur dégagé et nettoyé pour que l'air le traverse librement et qu'il ne givre plus.",
        es: "Serpentín interior del evaporador destapado y limpiado para que el aire pase libremente y deje de congelarse.",
      },
      unit: "flat",
      benchmark: { low: 160, median: 300, high: 495, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.coils.evaporator_install",
      category: "coils",
      name: {
        en: "Evaporator coil installation",
        fr: "Installation d'un serpentin d'évaporateur",
        es: "Instalación de serpentín de evaporador",
      },
      description: {
        en: "A new evaporator coil fitted in the air handler or above the furnace, with the drain, line set and expansion device connected and the whole system checked after start-up.",
        fr: "Serpentin d'évaporateur neuf installé dans le ventilo-convecteur ou au-dessus de la fournaise, drain, conduite et détendeur raccordés, puis vérification complète du système au démarrage.",
        es: "Serpentín de evaporador nuevo instalado en la manejadora o sobre el horno, con drenaje, línea y válvula de expansión conectados y revisión completa del sistema al arrancar.",
      },
      unit: "flat",
      benchmark: { low: 750, median: 1832, high: 3778, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },

    // ── Compressors ──────────────────────────────────────────────────────
    {
      seedKey: "fq.hvac_repair.compressor.replace",
      category: "compressor",
      name: {
        en: "Compressor replacement",
        fr: "Remplacement du compresseur",
        es: "Reemplazo del compresor",
      },
      description: {
        en: "A seized or burnt-out compressor removed from the outdoor unit and a new one brazed in, then the system evacuated and recharged.",
        fr: "Compresseur grippé ou grillé retiré de l'unité extérieure et remplacé par un neuf brasé en place, puis système mis sous vide et rechargé.",
        es: "Compresor trabado o quemado retirado de la unidad exterior y uno nuevo soldado en su lugar, luego el sistema evacuado y recargado.",
      },
      unit: "flat",
      benchmark: { low: 129, median: 300, high: 2000, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.compressor.repair",
      category: "compressor",
      name: {
        en: "Compressor repair",
        fr: "Réparation du compresseur",
        es: "Reparación del compresor",
      },
      description: {
        en: "Repair of a compressor that is struggling or has stopped: damaged parts replaced, leaks fixed and refrigerant topped up, to avoid a full replacement where possible.",
        fr: "Réparation d'un compresseur qui peine ou s'est arrêté : pièces abîmées remplacées, fuites colmatées et réfrigérant complété, pour éviter un remplacement complet quand c'est possible.",
        es: "Reparación de un compresor que falla o se detuvo: piezas dañadas reemplazadas, fugas corregidas y refrigerante completado, para evitar un reemplazo total cuando sea posible.",
      },
      unit: "flat",
      benchmark: { low: 250, median: 945, high: 1952, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.compressor.acid_test",
      category: "compressor",
      name: {
        en: "Refrigerant acid test",
        fr: "Test d'acidité du réfrigérant",
        es: "Prueba de acidez del refrigerante",
      },
      description: {
        en: "A sample of refrigerant tested for acid, which forms after a motor burnout and eats away at the compressor if it is not caught early.",
        fr: "Échantillon de réfrigérant analysé pour détecter l'acidité qui apparaît après un moteur grillé et ronge le compresseur si elle n'est pas décelée à temps.",
        es: "Muestra de refrigerante analizada para detectar acidez, que se forma después de un motor quemado y corroe el compresor si no se detecta a tiempo.",
      },
      unit: "flat",
      benchmark: { low: 44, median: 100, high: 225, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      // The source carries a second compressor-replacement row with its own,
      // much higher benchmark; kept apart so the join holds row by row.
      seedKey: "fq.hvac_repair.compressor.replace_and_startup",
      category: "compressor",
      name: {
        en: "Compressor replacement with system start-up check",
        fr: "Remplacement du compresseur avec vérification au démarrage",
        es: "Reemplazo del compresor con verificación de arranque",
      },
      description: {
        en: "The old compressor swapped for a new one, then the whole system run through a start-up check of pressures, amperage and temperatures before it is handed back.",
        fr: "Ancien compresseur remplacé par un neuf, puis tout le système soumis à une vérification de démarrage des pressions, de l'ampérage et des températures avant la remise.",
        es: "Compresor viejo sustituido por uno nuevo y luego todo el sistema sometido a una verificación de arranque de presiones, amperaje y temperaturas antes de entregarlo.",
      },
      unit: "flat",
      benchmark: { low: 765, median: 1877, high: 3500, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.compressor.hard_start_kit",
      category: "compressor",
      name: {
        en: "Hard start kit installation",
        fr: "Installation d'un kit de démarrage assisté",
        es: "Instalación de kit de arranque asistido",
      },
      description: {
        en: "A hard start capacitor and relay added to the outdoor unit so the compressor starts on the first try and draws less current doing it.",
        fr: "Condensateur et relais de démarrage ajoutés à l'unité extérieure pour que le compresseur démarre du premier coup en tirant moins de courant.",
        es: "Capacitor y relé de arranque añadidos a la unidad exterior para que el compresor arranque al primer intento consumiendo menos corriente.",
      },
      unit: "flat",
      benchmark: { low: 318, median: 405, high: 607, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },

    // ── Condensate drain ─────────────────────────────────────────────────
    {
      seedKey: "fq.hvac_repair.condensate.clean_drain_pan",
      category: "condensate",
      name: {
        en: "Drain pan cleaning",
        fr: "Nettoyage du bac de condensat",
        es: "Limpieza de la bandeja de condensado",
      },
      description: {
        en: "Sludge, algae and debris scooped and flushed out of the condensate pan so water drains away instead of overflowing onto the floor or ceiling.",
        fr: "Boue, algues et débris retirés puis rincés du bac de condensat pour que l'eau s'écoule au lieu de déborder sur le plancher ou le plafond.",
        es: "Lodo, algas y residuos retirados y enjuagados de la bandeja de condensado para que el agua drene en vez de desbordarse sobre el piso o el techo.",
      },
      unit: "flat",
      benchmark: { low: 125, median: 184, high: 295, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.condensate.clean_pump",
      category: "condensate",
      name: {
        en: "Condensate pump cleaning",
        fr: "Nettoyage de la pompe à condensat",
        es: "Limpieza de la bomba de condensado",
      },
      description: {
        en: "The condensate pump reservoir and float cleaned out and the pump test-run, so it lifts water away reliably instead of stalling on sludge.",
        fr: "Réservoir et flotteur de la pompe à condensat nettoyés, puis pompe testée pour qu'elle évacue l'eau de façon fiable au lieu de caler sur les dépôts.",
        es: "Depósito y flotador de la bomba de condensado limpiados y la bomba probada, para que expulse el agua de forma confiable en lugar de atascarse.",
      },
      unit: "flat",
      benchmark: { low: 81, median: 138, high: 225, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.condensate.clear_flush_line",
      category: "condensate",
      name: {
        en: "Condensate drain line clearing and flush",
        fr: "Débouchage et rinçage de la conduite de condensat",
        es: "Destape y lavado de la línea de condensado",
      },
      description: {
        en: "A blocked condensate line cleared with vacuum or pressure and flushed through, ending the drips and shut-offs a clogged line causes.",
        fr: "Conduite de condensat bouchée dégagée par aspiration ou pression puis rincée, ce qui met fin aux dégouttements et aux arrêts qu'un blocage provoque.",
        es: "Línea de condensado obstruida despejada por vacío o presión y luego lavada, terminando los goteos y apagones que causa un tapón.",
      },
      unit: "flat",
      benchmark: { low: 125, median: 178, high: 249, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.condensate.replace_pump",
      category: "condensate",
      name: {
        en: "Condensate pump replacement",
        fr: "Remplacement de la pompe à condensat",
        es: "Reemplazo de la bomba de condensado",
      },
      description: {
        en: "A worn-out or failed condensate pump replaced with a new one, plumbed and wired, including its safety cut-off.",
        fr: "Pompe à condensat usée ou en panne remplacée par une neuve, raccordée et câblée, y compris son interrupteur de sécurité.",
        es: "Bomba de condensado desgastada o averiada sustituida por una nueva, conectada y cableada, incluyendo su corte de seguridad.",
      },
      unit: "flat",
      benchmark: { low: 228, median: 389, high: 595, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.condensate.replace_line",
      category: "condensate",
      name: {
        en: "Condensate drain line replacement",
        fr: "Remplacement de la conduite de condensat",
        es: "Reemplazo de la línea de condensado",
      },
      description: {
        en: "A cracked, sagging or permanently clogged drain line pulled out and a new run installed with proper slope and a trap.",
        fr: "Conduite de drainage fissurée, affaissée ou bouchée en permanence retirée, puis nouvelle conduite posée avec la bonne pente et un siphon.",
        es: "Línea de drenaje agrietada, hundida o tapada de forma permanente retirada y una nueva instalada con la pendiente correcta y un sifón.",
      },
      unit: "flat",
      benchmark: { low: 149, median: 254, high: 492, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.condensate.maintain_drainage",
      category: "condensate",
      name: {
        en: "Drainage system maintenance",
        fr: "Entretien du système de drainage",
        es: "Mantenimiento del sistema de drenaje",
      },
      description: {
        en: "Pan, trap, line and pump all cleaned and checked in one visit, so condensate keeps flowing through the cooling season.",
        fr: "Bac, siphon, conduite et pompe nettoyés et vérifiés en une seule visite, pour que le condensat s'écoule tout au long de la saison de climatisation.",
        es: "Bandeja, sifón, línea y bomba limpiados y revisados en una sola visita, para que el condensado siga fluyendo durante toda la temporada de enfriamiento.",
      },
      unit: "flat",
      benchmark: { low: 100, median: 150, high: 250, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    {
      seedKey: "fq.hvac_repair.condensate.drain_pan_switch",
      category: "condensate",
      name: {
        en: "Drain pan overflow switch installation",
        fr: "Installation d'un interrupteur de trop-plein au bac de condensat",
        es: "Instalación de interruptor de desborde en la bandeja",
      },
      description: {
        en: "A float switch added to the drain pan that shuts the system off when water rises, so a clog cannot turn into a ceiling stain.",
        fr: "Interrupteur à flotteur ajouté au bac de condensat qui coupe le système dès que l'eau monte, pour qu'un bouchon ne finisse pas en tache au plafond.",
        es: "Interruptor de flotador añadido a la bandeja que apaga el sistema cuando sube el agua, para que un tapón no termine en una mancha en el techo.",
      },
      unit: "flat",
      benchmark: { low: 159, median: 285, high: 500, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
      durationMinutes: null,
      bookable: false,
    },
    // ── Condenser ────────────────────────────────────────────────────────
    S("fq.hvac_repair.condenser.clean_coil", "condenser", "flat", BM(126, 230, 389),
      ["Condenser coil cleaning", "Nettoyage du serpentin du condenseur", "Limpieza del serpentín del condensador"],
      ["The outdoor coil washed free of dirt, cottonwood and grass clippings so it can shed heat and the compressor stops working overtime.",
       "Serpentin extérieur lavé de la saleté, du duvet de peuplier et des rognures de gazon pour qu'il évacue la chaleur et que le compresseur cesse de forcer.",
       "Serpentín exterior lavado de tierra, pelusa y recortes de césped para que disipe el calor y el compresor deje de trabajar de más."]),
    S("fq.hvac_repair.condenser.level_risers", "condenser", "flat", BM(200, 350, 600),
      ["Condenser levelling on risers", "Mise à niveau du condenseur sur supports", "Nivelación del condensador sobre soportes"],
      ["A sunken or tilted outdoor unit lifted and set level on risers, so oil returns to the compressor and the fan does not rub.",
       "Unité extérieure affaissée ou inclinée relevée et mise à niveau sur des supports, pour que l'huile revienne au compresseur et que le ventilateur ne frotte pas.",
       "Unidad exterior hundida o inclinada levantada y nivelada sobre soportes, para que el aceite regrese al compresor y el ventilador no roce."]),
    S("fq.hvac_repair.condenser.leak_check", "condenser", "flat", BM(99, 150, 250),
      ["Condenser leak check", "Vérification de fuite au condenseur", "Revisión de fugas en el condensador"],
      ["The outdoor unit's coil, fittings and valves checked for refrigerant loss before a low charge becomes a dead compressor.",
       "Serpentin, raccords et valves de l'unité extérieure vérifiés pour toute perte de réfrigérant, avant qu'une charge basse ne tue le compresseur.",
       "Serpentín, conexiones y válvulas de la unidad exterior revisados por pérdida de refrigerante antes de que una carga baja arruine el compresor."]),
    S("fq.hvac_repair.condenser.replace_service_valve", "condenser", "each", BM(300, 553, 1150),
      ["Liquid or suction service valve replacement", "Remplacement de valve de service liquide ou aspiration", "Reemplazo de válvula de servicio de líquido o succión"],
      ["A leaking or seized service valve on the outdoor unit brazed out and replaced, the system evacuated and recharged afterwards.",
       "Valve de service qui fuit ou grippée sur l'unité extérieure dessoudée et remplacée, le système tiré au vide puis rechargé.",
       "Válvula de servicio con fuga o trabada en la unidad exterior desoldada y reemplazada, con vacío y recarga del sistema después."]),
    S("fq.hvac_repair.condenser.fan_motor_service", "condenser", "flat", BM(215, 530, 850),
      ["Condenser fan motor repair or replacement", "Réparation ou remplacement du moteur de ventilateur du condenseur", "Reparación o reemplazo del motor del ventilador del condensador"],
      ["A fan motor that hums, stalls or runs hot is repaired where it can be and replaced where it cannot, so the outdoor coil gets its airflow back.",
       "Moteur de ventilateur qui bourdonne, cale ou chauffe : réparé quand c'est possible, remplacé sinon, pour redonner son débit d'air au serpentin extérieur.",
       "Motor de ventilador que zumba, se traba o se calienta: se repara cuando se puede y se reemplaza cuando no, para que el serpentín exterior recupere su flujo de aire."]),
    S("fq.hvac_repair.condenser.fan_motor_and_blade", "condenser", "flat", BM(392, 650, 955),
      ["Condenser fan motor and blade replacement", "Remplacement du moteur et de l'hélice du condenseur", "Reemplazo del motor y aspa del ventilador del condensador"],
      ["Motor and fan blade replaced together as a matched pair, which is the right call when the blade is bent or the hub has seized on the old shaft.",
       "Moteur et hélice remplacés ensemble comme paire assortie — le bon choix quand l'hélice est tordue ou que le moyeu est grippé sur l'ancien arbre.",
       "Motor y aspa reemplazados juntos como par: lo correcto cuando el aspa está doblada o el cubo se trabó en el eje viejo."]),
    S("fq.hvac_repair.condenser.replace_fan_blade", "condenser", "each", BM(175, 320, 580),
      ["Condenser fan blade replacement", "Remplacement de l'hélice du condenseur", "Reemplazo del aspa del condensador"],
      ["A cracked or bent outdoor fan blade swapped for a new one and balanced, ending the wobble and the noise.",
       "Hélice extérieure fissurée ou tordue remplacée par une neuve et équilibrée, fini le balourd et le bruit.",
       "Aspa exterior agrietada o doblada cambiada por una nueva y balanceada, se acaba el bamboleo y el ruido."]),
    S("fq.hvac_repair.condenser.remount_fan_blade", "condenser", "flat", BM(148, 331, 554),
      ["Condenser fan blade remount and realignment", "Remontage et réalignement de l'hélice du condenseur", "Remontaje y realineación del aspa del condensador"],
      ["A blade that has slipped on its shaft or gone out of true is reset, aligned and locked down so it spins clear of the shroud.",
       "Hélice qui a glissé sur son arbre ou perdu son alignement remise en place, alignée et bloquée pour tourner sans toucher la grille.",
       "Aspa que se corrió en el eje o se desalineó se reposiciona, alinea y fija para que gire sin tocar la carcasa."]),
    S("fq.hvac_repair.condenser.install_fan_motor", "condenser", "each", BM(225, 484, 756),
      ["Condenser fan motor installation", "Installation d'un moteur de ventilateur de condenseur", "Instalación de motor de ventilador de condensador"],
      ["A new fan motor of the correct horsepower, RPM and rotation fitted to the outdoor unit and wired to its capacitor.",
       "Moteur neuf de la bonne puissance, du bon régime et du bon sens de rotation posé sur l'unité extérieure et raccordé à son condensateur.",
       "Motor nuevo con la potencia, RPM y giro correctos instalado en la unidad exterior y conectado a su capacitor."]),
    S("fq.hvac_repair.condenser.install_condenser", "condenser", "each", BM(285, 900, 2500),
      ["Condenser unit installation", "Installation d'une unité de condensation", "Instalación de unidad condensadora"],
      ["An outdoor condensing unit set on its pad, connected to the line set and electrical, and started up and checked.",
       "Unité de condensation extérieure posée sur sa base, raccordée à la ligne frigorifique et à l'électricité, démarrée et vérifiée.",
       "Unidad condensadora exterior colocada en su base, conectada a la tubería y a la electricidad, arrancada y verificada."],
      { existing: "The full system replacement is in the hvac_install seed; this is the outdoor unit on its own." }),
    // ── Fan belts and pulleys ────────────────────────────────────────────
    S("fq.hvac_repair.belts.adjust_belt_pulley", "belts", "flat", BM(175, 225, 540),
      ["Belt and pulley adjustment", "Ajustement de courroie et poulie", "Ajuste de banda y polea"],
      ["Belt tension and pulley alignment corrected on a belt-driven blower, stopping the squeal and the wear it causes.",
       "Tension de courroie et alignement de poulie corrigés sur un ventilateur à courroie : fini le crissement et l'usure qu'il cause.",
       "Tensión de banda y alineación de polea corregidas en un ventilador de banda, se acaba el chillido y el desgaste que provoca."]),
    S("fq.hvac_repair.belts.replace_belt", "belts", "each", BM(140, 188, 363),
      ["Blower belt replacement", "Remplacement de courroie de ventilateur", "Reemplazo de banda del ventilador"],
      ["A cracked, glazed or stretched blower belt replaced with the correct size and tensioned.",
       "Courroie de ventilateur fissurée, glacée ou étirée remplacée par la bonne taille et tendue.",
       "Banda del ventilador agrietada, vidriada o estirada reemplazada por la medida correcta y tensada."]),
    S("fq.hvac_repair.belts.replace_pulley", "belts", "each", BM(285, 407, 913),
      ["Blower pulley replacement", "Remplacement de poulie de ventilateur", "Reemplazo de polea del ventilador"],
      ["A worn or wobbling blower pulley replaced and the belt re-tensioned so the drive runs true.",
       "Poulie de ventilateur usée ou voilée remplacée et courroie retendue pour un entraînement qui tourne droit.",
       "Polea del ventilador desgastada o bamboleante reemplazada y banda retensada para que el impulso gire parejo."]),
    // ── Filters and air quality ──────────────────────────────────────────
    S("fq.hvac_repair.air_quality.replace_filter", "air_quality", "each", BM(80, 150, 375),
      ["Air filter replacement", "Remplacement du filtre à air", "Reemplazo del filtro de aire"],
      ["The system's filter swapped for a new one of the right size and rating, so air stays clean and the blower is not fighting a clogged filter.",
       "Filtre du système remplacé par un neuf de la bonne taille et du bon indice, pour un air propre et un ventilateur qui ne force pas contre un filtre bouché.",
       "Filtro del sistema cambiado por uno nuevo del tamaño y grado correctos, para aire limpio y un ventilador que no lucha contra un filtro tapado."]),
    S("fq.hvac_repair.air_quality.clean_ducts", "air_quality", "flat", BM(399, 700, 1200),
      ["Air duct cleaning", "Nettoyage des conduits d'air", "Limpieza de ductos de aire"],
      ["Supply and return ducts vacuumed and brushed clean of dust and debris, and the registers wiped down.",
       "Conduits d'alimentation et de retour aspirés et brossés pour retirer poussière et débris, grilles essuyées.",
       "Ductos de suministro y retorno aspirados y cepillados para quitar polvo y residuos, y las rejillas limpiadas."]),
    S("fq.hvac_repair.air_quality.iaq_testing", "air_quality", "flat", BM(99, 150, 1044),
      ["Indoor air quality testing", "Test de qualité de l'air intérieur", "Prueba de calidad del aire interior"],
      ["Particles, humidity, carbon dioxide and volatile compounds measured in the home, with a written result and what would fix each reading.",
       "Particules, humidité, dioxyde de carbone et composés volatils mesurés dans la maison, avec un résultat écrit et ce qui corrigerait chaque lecture.",
       "Partículas, humedad, dióxido de carbono y compuestos volátiles medidos en la casa, con un resultado escrito y lo que corregiría cada lectura."]),
    S("fq.hvac_repair.air_quality.uv_purifier_install", "air_quality", "each", BM(550, 868, 1400),
      ["UV air purifier installation", "Installation d'un purificateur d'air UV", "Instalación de purificador de aire UV"],
      ["A UV lamp fitted in the air handler or duct to keep mould and bacteria off the coil and out of the airstream.",
       "Lampe UV posée dans la fournaise ou le conduit pour garder moisissures et bactéries hors du serpentin et du flux d'air.",
       "Lámpara UV instalada en el manejador de aire o el ducto para mantener moho y bacterias fuera del serpentín y del flujo de aire."]),
    S("fq.hvac_repair.air_quality.seal_insulate_ducts", "air_quality", "flat", BM(375, 850, 2460),
      ["Duct sealing and insulation", "Scellement et isolation des conduits", "Sellado y aislamiento de ductos"],
      ["Leaky joints sealed with mastic and exposed runs wrapped, so conditioned air reaches the rooms instead of the attic or crawlspace.",
       "Joints qui fuient scellés au mastic et tronçons exposés enveloppés, pour que l'air conditionné arrive aux pièces plutôt qu'au grenier ou au vide sanitaire.",
       "Uniones con fugas selladas con masilla y tramos expuestos aislados, para que el aire acondicionado llegue a los cuartos y no al ático o al sótano."]),
    S("fq.hvac_repair.air_quality.replace_uv_bulbs", "air_quality", "each", BM(294, 580, 1033),
      ["UV bulb replacement", "Remplacement des ampoules UV", "Reemplazo de lámparas UV"],
      ["Spent UV lamps in the air purifier replaced — they lose their effect long before they stop glowing.",
       "Ampoules UV épuisées du purificateur remplacées : elles perdent leur effet bien avant de s'éteindre.",
       "Lámparas UV agotadas del purificador reemplazadas: pierden su efecto mucho antes de dejar de encender."]),
    // ── Electrical and controls ──────────────────────────────────────────
    S("fq.hvac_repair.maintenance.furnace_cleaning", "maintenance", "flat", BM(114, 200, 495),
      ["Furnace cleaning", "Nettoyage de fournaise", "Limpieza de horno de calefacción"],
      ["Burners, blower compartment and vents cleaned of dust and soot for a cleaner burn and quieter running.",
       "Brûleurs, compartiment du ventilateur et évents nettoyés de la poussière et de la suie pour une combustion plus propre et un fonctionnement plus silencieux.",
       "Quemadores, compartimento del ventilador y ventilaciones limpiados de polvo y hollín para una combustión más limpia y un funcionamiento más silencioso."]),
    S("fq.hvac_repair.controls.maintain_capacitors", "controls", "flat", BM(175, 249, 325),
      ["Capacitor testing and maintenance", "Vérification et entretien des condensateurs", "Prueba y mantenimiento de capacitores"],
      ["Start and run capacitors tested against their rating and any weak one flagged before it strands the motor on a hot day.",
       "Condensateurs de démarrage et de marche testés selon leur valeur nominale, tout condensateur faible signalé avant qu'il n'immobilise le moteur en pleine canicule.",
       "Capacitores de arranque y marcha probados contra su valor nominal y cualquier capacitor débil señalado antes de que deje el motor parado en un día de calor."]),
    S("fq.hvac_repair.controls.repair_defrost_board", "controls", "flat", BM(104, 200, 425),
      ["Defrost board repair", "Réparation de la carte de dégivrage", "Reparación de tarjeta de descongelamiento"],
      ["A heat pump that ices over or never defrosts has its defrost control board diagnosed and repaired.",
       "Thermopompe qui givre ou ne dégivre jamais : carte de commande de dégivrage diagnostiquée et réparée.",
       "Bomba de calor que se congela o nunca descongela: tarjeta de control de descongelamiento diagnosticada y reparada."]),
    S("fq.hvac_repair.maintenance.seal_attic_crawlspace", "maintenance", "flat", BM(278, 550, 1200),
      ["Attic and crawlspace air sealing", "Étanchéisation du grenier et du vide sanitaire", "Sellado de aire en ático y sótano"],
      ["Gaps, penetrations and openings in the attic and crawlspace sealed against air leakage and rodent entry.",
       "Fentes, percements et ouvertures du grenier et du vide sanitaire scellés contre les fuites d'air et l'entrée des rongeurs.",
       "Grietas, perforaciones y aberturas en el ático y el sótano selladas contra fugas de aire y entrada de roedores."]),
    S("fq.hvac_repair.controls.replace_capacitor", "controls", "each", BM(135, 219, 300),
      ["Capacitor replacement", "Remplacement de condensateur", "Reemplazo de capacitor"],
      ["A failed run or start capacitor replaced with one of matching rating so the compressor or fan starts again.",
       "Condensateur de marche ou de démarrage défectueux remplacé par un de même valeur, pour que le compresseur ou le ventilateur redémarre.",
       "Capacitor de marcha o arranque dañado reemplazado por uno del mismo valor para que el compresor o el ventilador vuelva a arrancar."]),
    S("fq.hvac_repair.controls.replace_contactor", "controls", "each", BM(180, 280, 395),
      ["Contactor replacement", "Remplacement de contacteur", "Reemplazo de contactor"],
      ["A pitted or welded contactor replaced so the outdoor unit switches on and off cleanly instead of chattering or sticking.",
       "Contacteur piqué ou soudé remplacé pour que l'unité extérieure s'allume et s'éteigne franchement au lieu de vibrer ou de coller.",
       "Contactor picado o pegado reemplazado para que la unidad exterior encienda y apague limpiamente en lugar de vibrar o quedarse trabada."]),
    S("fq.hvac_repair.maintenance.blown_in_insulation", "maintenance", "flat", BM(1422, 2625, 4258),
      ["Blown-in attic insulation", "Isolation soufflée du grenier", "Aislamiento soplado en el ático"],
      ["Loose-fill fibreglass blown into the attic to the agreed R-value, evenly over the whole floor and around the hatches.",
       "Fibre de verre en vrac soufflée dans le grenier jusqu'à la valeur R convenue, uniformément sur toute la surface et autour des trappes.",
       "Fibra de vidrio suelta soplada en el ático hasta el valor R acordado, de manera uniforme en todo el piso y alrededor de las trampillas."],
      { existing: "Attic insulation is also priced per sq ft by the insulation trade's takeoff (app/data/tradePriceBooks.js insulation)." }),
    S("fq.hvac_repair.maintenance.ac_tune_up", "maintenance", "flat", BM(89, 119, 158),
      ["Air conditioner tune-up", "Mise au point du climatiseur", "Afinación del aire acondicionado"],
      ["Seasonal check of the cooling system: refrigerant pressures, electrical connections, capacitor, coil condition and drain, with anything off noted.",
       "Vérification saisonnière du système de climatisation : pressions de réfrigérant, connexions électriques, condensateur, état du serpentin et drain, avec toute anomalie notée.",
       "Revisión de temporada del sistema de enfriamiento: presiones de refrigerante, conexiones eléctricas, capacitor, estado del serpentín y drenaje, con cualquier anomalía anotada."]),
    S("fq.hvac_repair.controls.thermostat_wiring", "controls", "flat", BM(98, 175, 350),
      ["Thermostat wiring inspection or replacement", "Inspection ou remplacement du câblage du thermostat", "Inspección o reemplazo del cableado del termostato"],
      ["Thermostat wire checked end to end and replaced where it is broken, shorted or too few conductors for the new thermostat.",
       "Fil du thermostat vérifié d'un bout à l'autre et remplacé s'il est rompu, en court-circuit ou compte trop peu de conducteurs pour le nouveau thermostat.",
       "Cable del termostato revisado de punta a punta y reemplazado si está roto, en corto o con muy pocos conductores para el termostato nuevo."]),
    S("fq.hvac_repair.controls.install_control_board", "controls", "each", BM(224, 399, 682),
      ["Control board installation", "Installation de carte de commande", "Instalación de tarjeta de control"],
      ["A new furnace or air-handler control board fitted, wired and configured so every stage of the system responds again.",
       "Nouvelle carte de commande de fournaise ou de ventilo-convecteur posée, câblée et configurée pour que chaque étage du système réponde de nouveau.",
       "Nueva tarjeta de control del horno o manejador de aire instalada, cableada y configurada para que cada etapa del sistema responda otra vez."]),
    S("fq.hvac_repair.controls.replace_fuses", "controls", "flat", BM(150, 300, 790),
      ["Fuse replacement", "Remplacement de fusibles", "Reemplazo de fusibles"],
      ["Blown fuses on the system replaced with the correct rating, and the reason they blew found before the new ones go in.",
       "Fusibles grillés du système remplacés par le bon calibre, et la cause de leur grillage trouvée avant de poser les neufs.",
       "Fusibles quemados del sistema reemplazados por el calibre correcto, y la causa de la quema encontrada antes de colocar los nuevos."]),
    S("fq.hvac_repair.controls.surge_protector", "controls", "each", BM(345, 488, 672),
      ["HVAC surge protector installation", "Installation d'un parasurtenseur CVC", "Instalación de protector contra sobretensiones para climatización"],
      ["A surge protection device fitted at the outdoor unit or air handler so a lightning strike or utility spike does not take out the control board.",
       "Parasurtenseur posé à l'unité extérieure ou au ventilo-convecteur pour qu'un éclair ou une pointe du réseau ne grille pas la carte de commande.",
       "Protector contra sobretensiones instalado en la unidad exterior o el manejador de aire para que un rayo o un pico de la red no queme la tarjeta de control."]),
    S("fq.hvac_repair.maintenance.repair_insulation", "maintenance", "flat", BM(100, 250, 750),
      ["Line set and duct insulation repair", "Réparation de l'isolation des lignes et conduits", "Reparación del aislamiento de tuberías y ductos"],
      ["Sun-rotted or torn insulation on the refrigerant line and ducts replaced so the system stops losing what it just cooled or heated.",
       "Isolation pourrie par le soleil ou déchirée sur la ligne frigorifique et les conduits remplacée, pour que le système cesse de perdre ce qu'il vient de refroidir ou de chauffer.",
       "Aislamiento podrido por el sol o roto en la tubería de refrigerante y los ductos reemplazado, para que el sistema deje de perder lo que acaba de enfriar o calentar."]),
    S("fq.hvac_repair.maintenance.generator_maintenance", "maintenance", "flat", BM(145, 250, 369),
      ["Backup generator maintenance", "Entretien de génératrice de secours", "Mantenimiento de generador de respaldo"],
      ["Oil, filter, battery and a load test on the standby generator that keeps the heating running through an outage.",
       "Huile, filtre, batterie et essai en charge de la génératrice de secours qui garde le chauffage en marche pendant une panne.",
       "Aceite, filtro, batería y prueba de carga del generador de respaldo que mantiene la calefacción funcionando durante un apagón."]),
    S("fq.hvac_repair.controls.thermostat_repair", "controls", "flat", BM(89, 140, 250),
      ["Thermostat repair", "Réparation de thermostat", "Reparación de termostato"],
      ["A thermostat that misreads, will not hold its setting or has stopped responding repaired and recalibrated.",
       "Thermostat qui affiche mal, ne garde pas sa consigne ou ne répond plus réparé et recalibré.",
       "Termostato que marca mal, no mantiene el ajuste o dejó de responder reparado y recalibrado."]),
    S("fq.hvac_repair.controls.repair_control_board", "controls", "flat", BM(250, 495, 850),
      ["Control board repair", "Réparation de carte de commande", "Reparación de tarjeta de control"],
      ["A control board with a burnt relay, cracked solder joint or failed sensor input diagnosed and repaired rather than replaced outright.",
       "Carte de commande au relais brûlé, à la soudure fissurée ou à l'entrée de capteur défaillante diagnostiquée et réparée plutôt que remplacée d'emblée.",
       "Tarjeta de control con relé quemado, soldadura agrietada o entrada de sensor fallida diagnosticada y reparada en lugar de reemplazada de entrada."]),
    S("fq.hvac_repair.maintenance.furnace_maintenance", "maintenance", "flat", BM(100, 150, 200),
      ["Furnace maintenance", "Entretien de fournaise", "Mantenimiento del horno de calefacción"],
      ["Seasonal check of the furnace: burners, ignition, heat exchanger, blower, safeties and venting, with anything off noted.",
       "Vérification saisonnière de la fournaise : brûleurs, allumage, échangeur de chaleur, ventilateur, sécurités et évacuation, avec toute anomalie notée.",
       "Revisión de temporada del horno: quemadores, encendido, intercambiador de calor, ventilador, seguridades y ventilación, con cualquier anomalía anotada."]),
    // ── Heat exchangers and venting ──────────────────────────────────────
    S("fq.hvac_repair.heat_exchanger.clean_check_burners", "heat_exchanger", "flat", BM(99, 140, 189),
      ["Burner cleaning and check", "Nettoyage et vérification des brûleurs", "Limpieza y revisión de quemadores"],
      ["Furnace burners cleaned, the flame pattern checked and the exchanger surface inspected while the burners are out.",
       "Brûleurs de fournaise nettoyés, forme de la flamme vérifiée et surface de l'échangeur inspectée pendant que les brûleurs sont sortis.",
       "Quemadores del horno limpiados, el patrón de la flama revisado y la superficie del intercambiador inspeccionada mientras los quemadores están fuera."]),
    S("fq.hvac_repair.heat_exchanger.replace", "heat_exchanger", "each", BM(225, 1003, 2996),
      ["Heat exchanger replacement", "Remplacement de l'échangeur de chaleur", "Reemplazo del intercambiador de calor"],
      ["A cracked heat exchanger replaced under or outside warranty so combustion gases stay in the flue and out of the house.",
       "Échangeur de chaleur fissuré remplacé, sous garantie ou non, pour que les gaz de combustion restent dans le conduit et hors de la maison.",
       "Intercambiador de calor agrietado reemplazado, con o sin garantía, para que los gases de combustión se queden en el conducto y fuera de la casa."]),
    S("fq.hvac_repair.heat_exchanger.replace_face_plate", "heat_exchanger", "each", BM(388, 650, 1184),
      ["Heat exchanger face plate replacement", "Remplacement de la plaque avant de l'échangeur", "Reemplazo de la placa frontal del intercambiador"],
      ["A warped or corroded face plate replaced and resealed so the exchanger draws and transfers heat as designed.",
       "Plaque avant voilée ou corrodée remplacée et rescellée pour que l'échangeur tire et transfère la chaleur comme prévu.",
       "Placa frontal deformada o corroída reemplazada y resellada para que el intercambiador aspire y transfiera calor como debe."]),
    S("fq.hvac_repair.heat_exchanger.flue_pipe", "heat_exchanger", "flat", BM(350, 685, 1498),
      ["Flue pipe replacement or installation", "Remplacement ou installation de conduit d'évacuation", "Reemplazo o instalación de tubo de chimenea"],
      ["Rusted, disconnected or wrongly pitched flue pipe replaced with the correct material and slope so exhaust leaves the building.",
       "Conduit d'évacuation rouillé, débranché ou mal incliné remplacé par le bon matériau et la bonne pente pour que les gaz sortent du bâtiment.",
       "Tubo de chimenea oxidado, desconectado o mal inclinado reemplazado con el material y la pendiente correctos para que el escape salga del edificio."]),
    // ── Refrigerant and leaks ────────────────────────────────────────────
    S("fq.hvac_repair.refrigerant.check_levels", "refrigerant", "flat", BM(99, 129, 199),
      ["Refrigerant level check", "Vérification du niveau de réfrigérant", "Revisión del nivel de refrigerante"],
      ["Pressures and temperatures read at the outdoor unit to confirm the charge is correct, with any shortfall reported before it is topped up.",
       "Pressions et températures relevées à l'unité extérieure pour confirmer que la charge est correcte, tout manque signalé avant l'appoint.",
       "Presiones y temperaturas leídas en la unidad exterior para confirmar que la carga es correcta, con cualquier faltante informado antes de recargar."]),
    S("fq.hvac_repair.refrigerant.add_r410a", "refrigerant", "each", BM(150, 311, 630),
      ["R-410A refrigerant charge — per pound", "Charge de réfrigérant R-410A — par livre", "Carga de refrigerante R-410A — por libra"],
      ["R-410A weighed into the system per pound until the pressures match the manufacturer's chart.",
       "R-410A pesé dans le système, à la livre, jusqu'à ce que les pressions correspondent à la table du fabricant.",
       "R-410A cargado en el sistema por libra hasta que las presiones coincidan con la tabla del fabricante."]),
    S("fq.hvac_repair.refrigerant.add_r410a_additional", "refrigerant", "each", BM(160, 300, 600),
      ["Additional R-410A refrigerant — per pound", "R-410A supplémentaire — par livre", "R-410A adicional — por libra"],
      ["Each further pound of R-410A beyond the first, on a system that needs a larger top-up.",
       "Chaque livre de R-410A au-delà de la première, sur un système qui demande un appoint plus important.",
       "Cada libra adicional de R-410A después de la primera, en un sistema que necesita una recarga mayor."]),
    S("fq.hvac_repair.refrigerant.add_r22", "refrigerant", "each", BM(97, 200, 455),
      ["R-22 refrigerant charge — per pound", "Charge de réfrigérant R-22 — par livre", "Carga de refrigerante R-22 — por libra"],
      ["R-22 added per pound to an older system, with a note that this refrigerant is phased out and increasingly costly.",
       "R-22 ajouté à la livre sur un système plus ancien, avec la mention que ce réfrigérant est en voie de retrait et de plus en plus coûteux.",
       "R-22 agregado por libra a un sistema más viejo, con la nota de que este refrigerante está en retiro y cuesta cada vez más."]),
    S("fq.hvac_repair.refrigerant.add_r22_additional", "refrigerant", "each", BM(150, 288, 588),
      ["Additional R-22 refrigerant — per pound", "R-22 supplémentaire — par livre", "R-22 adicional — por libra"],
      ["Each further pound of R-22 beyond the first.",
       "Chaque livre de R-22 au-delà de la première.",
       "Cada libra adicional de R-22 después de la primera."]),
    S("fq.hvac_repair.refrigerant.leak_search", "refrigerant", "flat", BM(179, 275, 425),
      ["Refrigerant leak search", "Recherche de fuite de réfrigérant", "Búsqueda de fugas de refrigerante"],
      ["The whole circuit checked for leaks with an electronic detector, dye or nitrogen pressure test, and every leak point marked.",
       "Circuit complet vérifié au détecteur électronique, au colorant ou à l'azote sous pression, chaque point de fuite marqué.",
       "Todo el circuito revisado con detector electrónico, tinte o prueba de presión con nitrógeno, y cada punto de fuga marcado."]),
    S("fq.hvac_repair.refrigerant.repair_leaks", "refrigerant", "flat", BM(200, 389, 700),
      ["Refrigerant leak repair", "Réparation de fuite de réfrigérant", "Reparación de fuga de refrigerante"],
      ["Leak points found on the search brazed or fitted with new components, then the system pressure-tested to confirm it holds.",
       "Points de fuite trouvés lors de la recherche brasés ou remplacés, puis système testé sous pression pour confirmer qu'il tient.",
       "Puntos de fuga hallados en la búsqueda soldados o reemplazados, y luego el sistema probado a presión para confirmar que aguanta."]),
    S("fq.hvac_repair.refrigerant.leak_repair_recharge", "refrigerant", "flat", BM(237, 395, 750),
      ["Leak repair with evacuation and recharge", "Réparation de fuite avec tirage au vide et recharge", "Reparación de fuga con vacío y recarga"],
      ["A repaired leak followed by a full evacuation to remove moisture and a weighed-in charge to the nameplate amount.",
       "Fuite réparée puis tirage au vide complet pour retirer l'humidité et charge pesée jusqu'à la quantité de la plaque signalétique.",
       "Fuga reparada, seguida de vacío completo para eliminar humedad y carga pesada hasta la cantidad de la placa."]),
    S("fq.hvac_repair.refrigerant.electronic_leak_search", "refrigerant", "flat", BM(85, 169, 268),
      ["Electronic leak detection", "Détection électronique de fuite", "Detección electrónica de fugas"],
      ["A quick sweep of the coils, fittings and line set with an electronic leak detector to locate a suspected loss.",
       "Balayage rapide des serpentins, raccords et ligne frigorifique au détecteur électronique pour localiser une perte suspectée.",
       "Barrido rápido de serpentines, conexiones y tubería con detector electrónico para ubicar una pérdida sospechada."]),
    S("fq.hvac_repair.refrigerant.walk_in_reversing_valve", "refrigerant", "each", BM(190, 467, 1350),
      ["Walk-in freezer reversing valve replacement", "Remplacement de valve d'inversion — congélateur-chambre", "Reemplazo de válvula reversible — cámara congeladora"],
      ["The reversing valve on a walk-in freezer replaced, with the defrost control and sensors checked and replaced as needed.",
       "Valve d'inversion d'un congélateur-chambre remplacée, commande de dégivrage et capteurs vérifiés et remplacés au besoin.",
       "Válvula reversible de una cámara congeladora reemplazada, con el control de descongelamiento y los sensores revisados y reemplazados si hace falta."]),
    S("fq.hvac_repair.refrigerant.repair_lineset", "refrigerant", "flat", BM(235, 600, 1450),
      ["Refrigerant line set repair", "Réparation de la ligne frigorifique", "Reparación de la tubería de refrigerante"],
      ["A kinked, corroded or leaking line set repaired or partly replaced, with any duct or wall modification the reroute needs.",
       "Ligne frigorifique pliée, corrodée ou qui fuit réparée ou partiellement remplacée, avec toute modification de conduit ou de mur que le nouveau tracé exige.",
       "Tubería de refrigerante doblada, corroída o con fuga reparada o parcialmente reemplazada, con cualquier modificación de ducto o pared que exija el nuevo recorrido."]),
    S("fq.hvac_repair.refrigerant.flush_lineset", "refrigerant", "flat", BM(110, 185, 350),
      ["Refrigerant line set flush", "Rinçage de la ligne frigorifique", "Lavado de la tubería de refrigerante"],
      ["The existing line set flushed clean of old oil and contaminants before new equipment is connected to it.",
       "Ligne frigorifique existante rincée de l'huile usée et des contaminants avant d'y raccorder un nouvel équipement.",
       "Tubería existente lavada para eliminar aceite viejo y contaminantes antes de conectarle un equipo nuevo."]),
    S("fq.hvac_repair.refrigerant.txv_replacement", "refrigerant", "each", BM(450, 910, 1600),
      ["Thermal expansion valve replacement", "Remplacement du détendeur thermostatique", "Reemplazo de válvula de expansión termostática"],
      ["A stuck or failed expansion valve removed and a new one brazed in, then the system evacuated and recharged.",
       "Détendeur bloqué ou défaillant retiré et un neuf brasé en place, puis système tiré au vide et rechargé.",
       "Válvula de expansión trabada o dañada retirada y una nueva soldada en su lugar, con vacío y recarga del sistema después."]),
    // ── Diagnostics and repair visits ────────────────────────────────────
    S("fq.hvac_repair.diagnostics.residential", "diagnostics", "flat", BM(85, 99, 124),
      ["Diagnostic visit — residential", "Visite diagnostique — résidentiel", "Visita de diagnóstico — residencial"],
      ["A technician inspects the system, finds the fault and gives a written price for the repair; the fee is credited if the repair goes ahead.",
       "Un technicien inspecte le système, trouve la panne et remet un prix écrit pour la réparation ; les frais sont crédités si la réparation est acceptée.",
       "Un técnico inspecciona el sistema, encuentra la falla y entrega un precio por escrito de la reparación; el cargo se acredita si la reparación se aprueba."]),
    S("fq.hvac_repair.diagnostics.commercial", "diagnostics", "flat", BM(89, 100, 135),
      ["Diagnostic visit — commercial", "Visite diagnostique — commercial", "Visita de diagnóstico — comercial"],
      ["The same diagnostic on a commercial rooftop or split system, with the repair quoted before any work starts.",
       "Le même diagnostic sur un système commercial de toit ou bibloc, avec la réparation chiffrée avant tout travail.",
       "El mismo diagnóstico en un sistema comercial de azotea o dividido, con la reparación cotizada antes de empezar cualquier trabajo."]),
    S("fq.hvac_repair.diagnostics.emergency", "diagnostics", "flat", BM(89, 105, 150),
      ["Diagnostic visit — after hours", "Visite diagnostique — hors des heures", "Visita de diagnóstico — fuera de horario"],
      ["An on-call technician attends outside normal hours, finds the fault and gets the system running or quotes the repair.",
       "Un technicien de garde se déplace hors des heures normales, trouve la panne et remet le système en marche ou chiffre la réparation.",
       "Un técnico de guardia acude fuera del horario normal, encuentra la falla y pone el sistema a funcionar o cotiza la reparación."]),
    S("fq.hvac_repair.diagnostics.out_of_range", "diagnostics", "flat", BM(89, 100, 125),
      ["Diagnostic visit — outside service area", "Visite diagnostique — hors du territoire desservi", "Visita de diagnóstico — fuera del área de servicio"],
      ["The diagnostic visit for an address beyond the usual service area, travel included in the fee.",
       "La visite diagnostique pour une adresse au-delà du territoire habituel, déplacement inclus dans les frais.",
       "La visita de diagnóstico para una dirección fuera del área habitual, con el traslado incluido en el cargo."]),
    // ── Added 2026-09-24 with the estimate templates: the four generic rows the
    //    source seeds for its signup industry, and the full-system inspection
    //    its HVAC template set prices. ─────────────────────────────────────
    S("fq.hvac_repair.diagnostics.system_inspection", "diagnostics", "flat", null,
      ["HVAC system inspection", "Inspection du système de chauffage et climatisation", "Inspección del sistema de climatización"],
      ["Coils, filter, refrigerant pressures, electrical connections and thermostat checked for safety and performance, with the findings written down.",
       "Serpentins, filtre, pressions de frigorigène, connexions électriques et thermostat vérifiés pour la sécurité et le rendement, constats consignés par écrit.",
       "Serpentines, filtro, presiones de refrigerante, conexiones eléctricas y termostato revisados por seguridad y rendimiento, con los hallazgos por escrito."],
      { durationMinutes: 60, bookable: true }),
    S("fq.hvac_repair.diagnostics.diagnostic_visit", "diagnostics", "flat", null,
      ["Diagnostic visit", "Visite de diagnostic", "Visita de diagnóstico"],
      ["A technician finds why the heating or cooling is not working and gives a written price for the fix before any repair.",
       "Un technicien trouve pourquoi le chauffage ou la climatisation ne fonctionne pas et remet un prix écrit avant toute réparation.",
       "Un técnico encuentra por qué no funciona la calefacción o el aire y entrega un precio por escrito antes de reparar."]),
    S("fq.hvac_repair.diagnostics.service_visit", "diagnostics", "flat", null,
      ["Service visit", "Visite de service", "Visita de servicio"],
      ["A call-out to get heating or cooling running again, with the repair made on the spot where the part is on the truck.",
       "Déplacement pour remettre le chauffage ou la climatisation en marche, réparation faite sur place quand la pièce est dans le camion.",
       "Salida para volver a poner en marcha la calefacción o el aire, con la reparación hecha en el momento si la pieza está en la camioneta."]),
    S("fq.hvac_repair.maintenance.preventative_maintenance", "maintenance", "flat", null,
      ["Preventative maintenance", "Entretien préventif", "Mantenimiento preventivo"],
      ["A scheduled visit to clean, adjust and test the system before the season, so small faults are caught before they become a no-heat call.",
       "Visite planifiée pour nettoyer, régler et tester le système avant la saison, afin de repérer les petits défauts avant la panne.",
       "Visita programada para limpiar, ajustar y probar el sistema antes de la temporada y detectar fallas pequeñas antes de una avería."]),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: every templated row carries a benchmark median (the HVAC book is
// the one with insight on all 103 rows), so the totals are set by it and the
// lines are the trade's usual split — a diagnostic fee credited on repair, a
// part at supply-house cost (a 45/5 capacitor ~$15, an ECM blower motor
// ~$350–500, a surge protector ~$180) and the technician's hour at $125–150.
// Labour cost ≈ 50% of price, material ≈ 75% unless a line says otherwise.
//
// Folded in 2026-09-24: the HVAC template capture under docs/research/ (nine
// templates with real unit costs). Its capacitor ($150 labour / $75 part,
// $12 off), recharge ($200 labour + 3 lb at $85, $15 off), tune-up ($129 +
// $20 filter, $7 off), furnace repair, no-cooling diagnostic, system
// inspection and evaporator coil cleaning are carried at the captured prices
// and costs. Refrigerant stays qty 3 with no measurement key: pounds are
// weighed in on site, not read from a takeoff.
const TEMPLATES = {
  // ── Installation ──
  "fq.hvac_repair.controls.surge_protector": T("installation", {
    it: ["Installazione scaricatore di sovratensione HVAC", "Dispositivo di protezione da sovratensioni montato sull'unità esterna o sull'air handler, così un fulmine o un picco di rete non brucia la scheda di controllo."],
    de: ["Einbau eines HLK-Überspannungsschutzes", "Überspannungsschutz am Außengerät oder Lüftungsgerät montiert, damit ein Blitzschlag oder eine Netzspitze nicht die Steuerplatine zerstört."],
    uk: ["Встановлення захисту від перенапруги для HVAC", "Пристрій захисту від перенапруги встановлено на зовнішньому блоці або повітрообробнику, щоб блискавка чи стрибок у мережі не спалили плату керування."],
    tl: ["Pagkabit ng HVAC surge protector", "Surge protection device na ikinabit sa outdoor unit o air handler para hindi masira ng kidlat o spike ng kuryente ang control board."],
  }, [
    L.labour(1, "flat", 220, {
      en: ["Surge protector installation labour", "The device mounted at the disconnect, wired in and its indicator verified."],
      fr: ["Main-d'œuvre — installation du parasurtenseur", "Dispositif posé au sectionneur, câblé et voyant vérifié."],
      es: ["Mano de obra — instalación del protector", "Dispositivo montado en el desconectador, cableado y su indicador verificado."],
      it: ["Manodopera — installazione scaricatore", "Dispositivo montato al sezionatore, cablato e indicatore verificato."],
      de: ["Arbeit — Überspannungsschutz einbauen", "Gerät am Trennschalter montiert, verdrahtet und die Anzeige geprüft."],
      uk: ["Робота — встановлення захисту від перенапруги", "Пристрій змонтовано біля роз'єднувача, під'єднано, індикатор перевірено."],
      tl: ["Labor — pagkabit ng surge protector", "Ikinabit ang device sa disconnect, kinablehan at chineck ang indicator."],
    }),
    L.material(1, "each", 260, {
      en: ["HVAC surge protection device", "Outdoor-rated surge protector for a 240 V condenser or heat pump."],
      fr: ["Parasurtenseur CVC", "Parasurtenseur pour l'extérieur, condenseur ou thermopompe 240 V."],
      es: ["Protector contra sobretensión HVAC", "Protector para exterior, condensador o bomba de calor de 240 V."],
      it: ["Scaricatore di sovratensione HVAC", "Scaricatore per esterni, per condensatore o pompa di calore a 240 V."],
      de: ["HLK-Überspannungsschutz", "Wetterfester Überspannungsschutz für einen 240-V-Verflüssiger oder eine Wärmepumpe."],
      uk: ["Пристрій захисту від перенапруги HVAC", "Вуличний захист від перенапруги для конденсатора або теплового насоса на 240 В."],
      tl: ["HVAC surge protection device", "Outdoor-rated surge protector para sa 240 V condenser o heat pump."],
    }, { cost: 180 }),
  ], D.newCustomer("fixed", 25)),

  "fq.hvac_repair.air_quality.uv_purifier_install": T("installation", {
    it: ["Installazione purificatore d'aria UV", "Lampada UV montata nell'air handler o nel condotto per tenere muffa e batteri lontani dalla batteria e dal flusso d'aria."],
    de: ["Einbau eines UV-Luftreinigers", "UV-Lampe im Lüftungsgerät oder Kanal eingebaut, damit Schimmel und Bakterien vom Register und aus dem Luftstrom bleiben."],
    uk: ["Встановлення УФ-очищувача повітря", "УФ-лампу встановлено у повітрообробнику або повітроводі, щоб цвіль і бактерії не осідали на теплообміннику та не потрапляли в потік повітря."],
    tl: ["Pagkabit ng UV air purifier", "UV lamp na ikinabit sa air handler o duct para hindi tumubo ang amag at bacteria sa coil at sa hangin."],
  }, [
    L.labour(1, "flat", 320, {
      en: ["UV lamp installation labour", "The plenum cut and the lamp mounted over the coil, wired to its own transformer and tested."],
      fr: ["Main-d'œuvre — installation de la lampe UV", "Plénum percé, lampe posée au-dessus du serpentin, câblée à son transformateur et testée."],
      es: ["Mano de obra — instalación de la lámpara UV", "Plénum cortado, lámpara montada sobre el serpentín, cableada a su transformador y probada."],
      it: ["Manodopera — installazione lampada UV", "Plenum forato, lampada montata sopra la batteria, cablata al suo trasformatore e testata."],
      de: ["Arbeit — UV-Lampe einbauen", "Plenum ausgeschnitten, Lampe über dem Register montiert, an den eigenen Trafo angeschlossen und getestet."],
      uk: ["Робота — встановлення УФ-лампи", "Пленум прорізано, лампу змонтовано над теплообмінником, під'єднано до власного трансформатора та перевірено."],
      tl: ["Labor — pagkabit ng UV lamp", "Hiniwa ang plenum, ikinabit ang lamp sa ibabaw ng coil, kinablehan sa sariling transformer at sinubukan."],
    }),
    L.material(1, "each", 550, {
      en: ["Coil-mount UV air purifier", "Dual-lamp UV purifier with 24 V transformer and one-year lamp."],
      fr: ["Purificateur UV pour serpentin", "Purificateur UV à deux lampes avec transformateur 24 V et lampe d'un an."],
      es: ["Purificador UV para serpentín", "Purificador UV de dos lámparas con transformador de 24 V y lámpara de un año."],
      it: ["Purificatore UV per batteria", "Purificatore UV a due lampade con trasformatore 24 V e lampada da un anno."],
      de: ["UV-Luftreiniger für Register", "UV-Reiniger mit zwei Lampen, 24-V-Trafo und Einjahres-Lampe."],
      uk: ["УФ-очищувач для теплообмінника", "Дволамповий УФ-очищувач із трансформатором 24 В і лампою на рік."],
      tl: ["Coil-mount UV air purifier", "Dual-lamp UV purifier na may 24 V transformer at isang taong lamp."],
    }, { cost: 400 }),
  ], D.newCustomer("fixed", 40)),

  "fq.hvac_repair.condensate.drain_pan_switch": T("installation", {
    it: ["Installazione interruttore di troppo pieno vaschetta", "Galleggiante aggiunto alla vaschetta di condensa che spegne l'impianto quando l'acqua sale, così un intasamento non diventa una macchia sul soffitto."],
    de: ["Einbau eines Überlaufschalters für die Kondensatwanne", "Schwimmerschalter in der Kondensatwanne, der die Anlage abschaltet, wenn das Wasser steigt — damit aus einer Verstopfung kein Deckenfleck wird."],
    uk: ["Встановлення датчика переливу піддона", "Поплавковий вимикач у піддоні конденсату вимикає систему, коли вода піднімається, щоб засмічення не стало плямою на стелі."],
    tl: ["Pagkabit ng overflow switch sa drain pan", "Float switch na idinagdag sa drain pan na pumapatay sa sistema kapag tumaas ang tubig, para hindi maging mantsa sa kisame ang bara."],
  }, [
    L.labour(1, "flat", 190, {
      en: ["Float switch installation labour", "The switch fitted in the drain pan or line, wired into the low-voltage circuit and tested."],
      fr: ["Main-d'œuvre — installation du flotteur", "Flotteur posé dans le bac ou la conduite, câblé au circuit basse tension et testé."],
      es: ["Mano de obra — instalación del flotador", "Interruptor colocado en la charola o la línea, cableado al circuito de bajo voltaje y probado."],
      it: ["Manodopera — installazione galleggiante", "Interruttore montato nella vaschetta o sulla linea, cablato al circuito a bassa tensione e testato."],
      de: ["Arbeit — Schwimmerschalter einbauen", "Schalter in Wanne oder Leitung eingesetzt, in den Kleinspannungskreis eingebunden und getestet."],
      uk: ["Робота — встановлення поплавкового вимикача", "Вимикач встановлено в піддон або лінію, під'єднано до низьковольтного кола та перевірено."],
      tl: ["Labor — pagkabit ng float switch", "Ikinabit ang switch sa drain pan o linya, kinablehan sa low-voltage circuit at sinubukan."],
    }),
    L.material(1, "each", 60, {
      en: ["Condensate overflow float switch", "In-pan or in-line float switch, 24 V."],
      fr: ["Flotteur de trop-plein de condensat", "Flotteur pour bac ou en ligne, 24 V."],
      es: ["Interruptor flotador de condensado", "Flotador para charola o en línea, 24 V."],
      it: ["Galleggiante di troppo pieno condensa", "Galleggiante per vaschetta o in linea, 24 V."],
      de: ["Kondensat-Schwimmerschalter", "Schwimmerschalter für Wanne oder Leitung, 24 V."],
      uk: ["Поплавковий датчик переливу конденсату", "Поплавковий вимикач у піддон або в лінію, 24 В."],
      tl: ["Condensate overflow float switch", "In-pan o in-line float switch, 24 V."],
    }),
  ], null),

  // ── Repair ──
  "fq.hvac_repair.controls.replace_capacitor": T("repair", {
    it: ["Sostituzione condensatore", "Condensatore di marcia o di avviamento guasto sostituito con uno di pari valore, così compressore o ventola ripartono."],
    de: ["Kondensatortausch", "Defekter Betriebs- oder Anlaufkondensator durch einen mit gleichen Werten ersetzt, damit Verdichter oder Lüfter wieder anlaufen."],
    uk: ["Заміна конденсатора", "Несправний робочий або пусковий конденсатор замінено на такий самий за номіналом, щоб компресор чи вентилятор знову запускалися."],
    tl: ["Palit ng capacitor", "Sirang run o start capacitor na pinalitan ng parehong rating para umandar ulit ang compressor o fan."],
  }, [
    L.labour(1, "each", 150, {
      en: ["Capacitor replacement labour", "Power isolated, the capacitor discharged and swapped, and the start amps checked."],
      fr: ["Main-d'œuvre — remplacement du condensateur", "Alimentation coupée, condensateur déchargé et remplacé, ampérage de démarrage vérifié."],
      es: ["Mano de obra — reemplazo del capacitor", "Energía aislada, capacitor descargado y cambiado, y el amperaje de arranque revisado."],
      it: ["Manodopera — sostituzione condensatore", "Alimentazione isolata, condensatore scaricato e sostituito, corrente di spunto controllata."],
      de: ["Arbeit — Kondensator tauschen", "Strom getrennt, Kondensator entladen und getauscht, Anlaufstrom geprüft."],
      uk: ["Робота — заміна конденсатора", "Живлення вимкнено, конденсатор розряджено та замінено, пусковий струм перевірено."],
      tl: ["Labor — palit ng capacitor", "Pinatay ang kuryente, dinischarge at pinalitan ang capacitor, at chineck ang start amps."],
    }, { cost: 75 }),
    L.material(1, "each", 75, {
      en: ["Dual run capacitor", "Dual run capacitor, 35/5 to 50/5 µF, 440 V."],
      fr: ["Condensateur double", "Condensateur de marche double, 35/5 à 50/5 µF, 440 V."],
      es: ["Capacitor dual", "Capacitor de marcha dual, 35/5 a 50/5 µF, 440 V."],
      it: ["Condensatore doppio", "Condensatore di marcia doppio, da 35/5 a 50/5 µF, 440 V."],
      de: ["Doppel-Betriebskondensator", "Doppel-Betriebskondensator, 35/5 bis 50/5 µF, 440 V."],
      uk: ["Подвійний робочий конденсатор", "Подвійний робочий конденсатор, 35/5–50/5 мкФ, 440 В."],
      tl: ["Dual run capacitor", "Dual run capacitor, 35/5 hanggang 50/5 µF, 440 V."],
    }, { cost: 35 }),
  ], D.regular("fixed", 12)),

  "fq.hvac_repair.blower.replace_motor": T("repair", {
    it: ["Sostituzione motore ventilatore", "Motore del ventilatore interno guasto sostituito e ricablato, riportando il flusso d'aria nei condotti alla normalità."],
    de: ["Gebläsemotor tauschen", "Defekter Innengebläsemotor gegen einen neuen getauscht und angeschlossen, damit der Luftstrom in den Kanälen wieder stimmt."],
    uk: ["Заміна двигуна вентилятора", "Несправний двигун внутрішнього вентилятора замінено на новий і під'єднано; потік повітря в повітроводах відновлено."],
    tl: ["Palit ng blower motor", "Sirang indoor blower motor na pinalitan ng bago at kinablehan, para bumalik sa normal ang hangin sa duct."],
  }, [
    SHARED.diagnostic(99, { cost: 50 }),
    L.labour(1, "flat", 240, {
      en: ["Blower motor replacement labour", "The blower assembly pulled, the motor and capacitor swapped, the wheel rebalanced and airflow checked."],
      fr: ["Main-d'œuvre — remplacement du moteur", "Ensemble ventilateur retiré, moteur et condensateur remplacés, roue rééquilibrée et débit vérifié."],
      es: ["Mano de obra — reemplazo del motor", "Conjunto del ventilador retirado, motor y capacitor cambiados, la turbina balanceada y el flujo verificado."],
      it: ["Manodopera — sostituzione motore", "Gruppo ventilatore estratto, motore e condensatore sostituiti, girante bilanciata e portata verificata."],
      de: ["Arbeit — Gebläsemotor tauschen", "Gebläseeinheit ausgebaut, Motor und Kondensator getauscht, Rad ausgewuchtet und Luftstrom geprüft."],
      uk: ["Робота — заміна двигуна вентилятора", "Вентиляторний вузол знято, двигун і конденсатор замінено, крильчатку відбалансовано, потік перевірено."],
      tl: ["Labor — palit ng blower motor", "Tinanggal ang blower assembly, pinalitan ang motor at capacitor, binalanse ang wheel at chineck ang hangin."],
    }),
    L.material(1, "each", 380, {
      en: ["PSC blower motor with capacitor", "Direct-drive PSC blower motor, 1/2 HP, with matching run capacitor."],
      fr: ["Moteur de ventilateur PSC avec condensateur", "Moteur PSC à entraînement direct, 1/2 HP, avec condensateur de marche assorti."],
      es: ["Motor de ventilador PSC con capacitor", "Motor PSC de transmisión directa, 1/2 HP, con capacitor de marcha a juego."],
      it: ["Motore ventilatore PSC con condensatore", "Motore PSC a trasmissione diretta, 1/2 HP, con condensatore di marcia abbinato."],
      de: ["PSC-Gebläsemotor mit Kondensator", "Direktantriebs-PSC-Motor, 1/2 PS, mit passendem Betriebskondensator."],
      uk: ["Двигун вентилятора PSC з конденсатором", "Двигун PSC прямого приводу, 1/2 к.с., з відповідним робочим конденсатором."],
      tl: ["PSC blower motor na may capacitor", "Direct-drive PSC blower motor, 1/2 HP, may katernong run capacitor."],
    }, { cost: 250 }),
  ], D.regular("fixed", 20)),

  "fq.hvac_repair.refrigerant.leak_repair_recharge": T("repair", {
    it: ["Riparazione perdita con vuoto e ricarica", "Perdita riparata, poi vuoto completo per togliere l'umidità e carica pesata fino al valore di targa."],
    de: ["Leckreparatur mit Evakuierung und Neubefüllung", "Leck repariert, dann vollständig evakuiert, um Feuchtigkeit zu entfernen, und die Füllmenge nach Typenschild eingewogen."],
    uk: ["Усунення витоку з вакуумуванням і заправкою", "Витік усунено, потім систему повністю відвакуумовано від вологи та заправлено за вагою до паспортної кількості."],
    tl: ["Pag-ayos ng tagas na may evacuation at recharge", "Inayos ang tagas, tapos full evacuation para matanggal ang moisture at tinimbang na charge hanggang sa nameplate."],
  }, [
    L.labour(1, "flat", 200, {
      en: ["Leak repair, evacuation and recharge labour", "The leak brazed or the fitting replaced, the system pulled to 500 microns and the charge weighed in."],
      fr: ["Main-d'œuvre — réparation, tirage au vide et recharge", "Fuite brasée ou raccord remplacé, système tiré au vide à 500 microns et charge pesée."],
      es: ["Mano de obra — reparación, vacío y recarga", "Fuga soldada o conexión reemplazada, sistema llevado a 500 micrones y la carga pesada."],
      it: ["Manodopera — riparazione, vuoto e ricarica", "Perdita brasata o raccordo sostituito, impianto portato a 500 micron e carica pesata."],
      de: ["Arbeit — Reparatur, Evakuierung und Befüllung", "Leck gelötet oder Fitting ersetzt, Anlage auf 500 Mikron evakuiert und die Füllmenge eingewogen."],
      uk: ["Робота — ремонт, вакуумування та заправка", "Витік запаяно або фітинг замінено, систему відвакуумовано до 500 мікрон, заправку зважено."],
      tl: ["Labor — pag-ayos, evacuation at recharge", "Binraze ang tagas o pinalitan ang fitting, binaba sa 500 microns ang sistema at tinimbang ang charge."],
    }),
    L.material(3, "each", 85, {
      en: ["R-410A refrigerant — per pound", "R-410A refrigerant, weighed in per pound."],
      fr: ["Frigorigène R-410A — la livre", "Frigorigène R-410A, pesé à la livre."],
      es: ["Refrigerante R-410A — por libra", "Refrigerante R-410A, pesado por libra."],
      it: ["Refrigerante R-410A — alla libbra", "Refrigerante R-410A, pesato alla libbra."],
      de: ["Kältemittel R-410A — pro Pfund", "Kältemittel R-410A, pro Pfund eingewogen."],
      uk: ["Холодоагент R-410A — за фунт", "Холодоагент R-410A, за вагою на фунт."],
      tl: ["R-410A refrigerant — kada libra", "R-410A refrigerant, tinitimbang kada libra."],
    }, { cost: 45 }),
  ], D.regular("fixed", 15)),

  // ── Inspection ──
  "fq.hvac_repair.diagnostics.residential": T("inspection", {
    it: ["Visita diagnostica — residenziale", "Un tecnico ispeziona l'impianto, trova il guasto e dà un prezzo scritto per la riparazione; la tariffa viene scontata se la riparazione si fa."],
    de: ["Diagnosebesuch — privat", "Ein Techniker prüft die Anlage, findet den Fehler und nennt einen schriftlichen Reparaturpreis; die Gebühr wird bei Auftrag angerechnet."],
    uk: ["Діагностичний візит — житловий", "Технік оглядає систему, знаходить несправність і дає письмову ціну ремонту; плата зараховується, якщо ремонт замовлено."],
    tl: ["Diagnostic visit — bahay", "Sinusuri ng technician ang sistema, hinahanap ang sira at nagbibigay ng nakasulat na presyo; ibinabawas ang bayad kung ituloy ang pag-ayos."],
  }, [
    SHARED.diagnostic(99, { cost: 50 }),
  ], null),

  "fq.hvac_repair.refrigerant.check_levels": T("inspection", {
    it: ["Controllo livello refrigerante", "Pressioni e temperature lette all'unità esterna per confermare che la carica sia corretta, con l'eventuale mancanza segnalata prima del rabbocco."],
    de: ["Kältemittelstand prüfen", "Drücke und Temperaturen am Außengerät gemessen, um die Füllmenge zu bestätigen; ein Mangel wird vor dem Nachfüllen gemeldet."],
    uk: ["Перевірка рівня холодоагенту", "Тиск і температури зчитано на зовнішньому блоці, щоб підтвердити заправку; нестачу повідомляють до дозаправки."],
    tl: ["Check ng refrigerant level", "Binasa ang pressure at temperatura sa outdoor unit para makumpirma ang charge, at ini-report ang kulang bago dagdagan."],
  }, [
    L.labour(1, "flat", 129, {
      en: ["Refrigerant charge check", "Gauges on, superheat and subcooling calculated and the reading written on the ticket."],
      fr: ["Vérification de la charge de frigorigène", "Manomètres branchés, surchauffe et sous-refroidissement calculés, lecture inscrite au bon."],
      es: ["Verificación de la carga de refrigerante", "Manómetros conectados, sobrecalentamiento y subenfriamiento calculados y la lectura anotada."],
      it: ["Controllo della carica di refrigerante", "Manometri collegati, surriscaldamento e sottoraffreddamento calcolati e la lettura annotata."],
      de: ["Prüfung der Kältemittelfüllung", "Manometer angeschlossen, Überhitzung und Unterkühlung berechnet und der Wert notiert."],
      uk: ["Перевірка заправки холодоагентом", "Манометри під'єднано, перегрів і переохолодження розраховано, показники записано."],
      tl: ["Check ng refrigerant charge", "Ikinabit ang gauge, kinuwenta ang superheat at subcooling at isinulat ang reading."],
    }, { cost: 60 }),
  ], null),

  "fq.hvac_repair.air_quality.iaq_testing": T("inspection", {
    it: ["Test della qualità dell'aria interna", "Particolato, umidità, anidride carbonica e composti volatili misurati in casa, con un risultato scritto e cosa correggerebbe ogni valore."],
    de: ["Raumluftqualitätsmessung", "Feinstaub, Feuchte, Kohlendioxid und flüchtige Verbindungen im Haus gemessen, mit schriftlichem Ergebnis und was jeden Wert verbessern würde."],
    uk: ["Тестування якості повітря в приміщенні", "Частинки, вологість, вуглекислий газ і леткі сполуки виміряно в будинку, з письмовим результатом і тим, що виправить кожен показник."],
    tl: ["Indoor air quality testing", "Sinukat ang particles, humidity, carbon dioxide at volatile compounds sa bahay, may nakasulat na resulta at kung ano ang aayos sa bawat reading."],
  }, [
    L.labour(1, "flat", 110, {
      en: ["Air quality measurement", "Particle, humidity, CO2 and VOC readings taken in the main living areas."],
      fr: ["Mesure de la qualité de l'air", "Lectures de particules, d'humidité, de CO2 et de COV prises dans les pièces principales."],
      es: ["Medición de la calidad del aire", "Lecturas de partículas, humedad, CO2 y COV tomadas en las áreas principales."],
      it: ["Misurazione della qualità dell'aria", "Letture di particolato, umidità, CO2 e COV nelle stanze principali."],
      de: ["Luftqualitätsmessung", "Feinstaub-, Feuchte-, CO2- und VOC-Werte in den Hauptwohnräumen gemessen."],
      uk: ["Вимірювання якості повітря", "Показники частинок, вологості, CO2 та ЛОС зняті в основних житлових кімнатах."],
      tl: ["Pagsukat ng kalidad ng hangin", "Kinuha ang reading ng particles, humidity, CO2 at VOC sa mga pangunahing kuwarto."],
    }),
    SHARED.report(40),
  ], null),

  // ── Maintenance ──
  "fq.hvac_repair.maintenance.ac_tune_up": T("maintenance", {
    it: ["Tagliando del climatizzatore", "Controllo stagionale dell'impianto di raffrescamento: pressioni del refrigerante, collegamenti elettrici, condensatore, stato della batteria e scarico, con annotato tutto ciò che non va."],
    de: ["Klimaanlagen-Wartung", "Saisonprüfung der Kühlanlage: Kältemitteldrücke, elektrische Anschlüsse, Kondensator, Registerzustand und Ablauf, mit Vermerk aller Auffälligkeiten."],
    uk: ["Сезонне обслуговування кондиціонера", "Сезонна перевірка системи охолодження: тиск холодоагенту, електричні з'єднання, конденсатор, стан теплообмінника та дренаж; усе, що не в нормі, записано."],
    tl: ["Tune-up ng aircon", "Seasonal check ng cooling system: refrigerant pressure, koneksyon ng kuryente, capacitor, kondisyon ng coil at drain, at nakatala ang lahat ng may problema."],
  }, [
    L.labour(1, "flat", 129, {
      en: ["Cooling system tune-up", "Pressures, amps, capacitor and contactor checked, the condenser coil rinsed and the drain cleared."],
      fr: ["Mise au point du système de climatisation", "Pressions, ampérage, condensateur et contacteur vérifiés, serpentin du condenseur rincé et drain dégagé."],
      es: ["Afinación del sistema de enfriamiento", "Presiones, amperaje, capacitor y contactor revisados, el serpentín del condensador enjuagado y el drenaje destapado."],
      it: ["Tagliando dell'impianto di raffrescamento", "Pressioni, assorbimenti, condensatore e contattore controllati, batteria del condensatore sciacquata e scarico liberato."],
      de: ["Wartung der Kühlanlage", "Drücke, Stromaufnahme, Kondensator und Schütz geprüft, Verflüssigerregister gespült und der Ablauf freigemacht."],
      uk: ["Обслуговування системи охолодження", "Тиск, струм, конденсатор і контактор перевірено, теплообмінник конденсатора промито, дренаж прочищено."],
      tl: ["Tune-up ng cooling system", "Chineck ang pressure, amps, capacitor at contactor, hinugasan ang condenser coil at nilinis ang drain."],
    }, { cost: 65 }),
    L.material(1, "each", 20, {
      en: ["Pleated air filter", "1-inch pleated filter, MERV 8, in the system's size."],
      fr: ["Filtre à air plissé", "Filtre plissé de 1 po, MERV 8, à la dimension du système."],
      es: ["Filtro de aire plisado", "Filtro plisado de 1 pulg, MERV 8, en la medida del sistema."],
      it: ["Filtro aria pieghettato", "Filtro pieghettato da 1 pollice, MERV 8, nella misura dell'impianto."],
      de: ["Faltenfilter", "1-Zoll-Faltenfilter, MERV 8, in der Größe der Anlage."],
      uk: ["Гофрований повітряний фільтр", "Гофрований фільтр 1 дюйм, MERV 8, за розміром системи."],
      tl: ["Pleated air filter", "1-inch pleated filter, MERV 8, sa size ng sistema."],
    }, { cost: 8 }),
  ], D.regular("fixed", 7)),

  "fq.hvac_repair.maintenance.furnace_maintenance": T("maintenance", {
    it: ["Manutenzione caldaia ad aria", "Controllo stagionale della caldaia: bruciatori, accensione, scambiatore, ventilatore, sicurezze e scarico fumi, con annotato tutto ciò che non va."],
    de: ["Heizungswartung", "Saisonprüfung des Warmluftofens: Brenner, Zündung, Wärmetauscher, Gebläse, Sicherheitseinrichtungen und Abgasführung, mit Vermerk aller Auffälligkeiten."],
    uk: ["Обслуговування печі опалення", "Сезонна перевірка печі: пальники, запалювання, теплообмінник, вентилятор, захисти та димохід; усе, що не в нормі, записано."],
    tl: ["Maintenance ng furnace", "Seasonal check ng furnace: burner, ignition, heat exchanger, blower, safeties at venting, at nakatala ang lahat ng may problema."],
  }, [
    L.labour(1, "flat", 150, {
      en: ["Furnace maintenance visit", "Burners cleaned, flame sensor polished, heat exchanger inspected, safeties and venting checked and the blower cleaned."],
      fr: ["Visite d'entretien de la fournaise", "Brûleurs nettoyés, capteur de flamme poli, échangeur inspecté, sécurités et évacuation vérifiées, ventilateur nettoyé."],
      es: ["Visita de mantenimiento de la caldera", "Quemadores limpiados, sensor de flama pulido, intercambiador inspeccionado, seguridades y venteo revisados y el ventilador limpiado."],
      it: ["Visita di manutenzione caldaia", "Bruciatori puliti, sensore di fiamma lucidato, scambiatore ispezionato, sicurezze e scarico controllati, ventilatore pulito."],
      de: ["Heizungswartungsbesuch", "Brenner gereinigt, Flammenfühler poliert, Wärmetauscher geprüft, Sicherheitseinrichtungen und Abgas kontrolliert, Gebläse gereinigt."],
      uk: ["Візит з обслуговування печі", "Пальники очищено, датчик полум'я відполіровано, теплообмінник оглянуто, захисти й димохід перевірено, вентилятор очищено."],
      tl: ["Maintenance visit ng furnace", "Nilinis ang burner, pinakintab ang flame sensor, sinuri ang heat exchanger, chineck ang safeties at venting at nilinis ang blower."],
    }, { cost: 70 }),
    L.material(1, "each", 23.71, {
      en: ["Pleated air filter", "1-inch pleated filter, MERV 11, in the system's size."],
      fr: ["Filtre à air plissé", "Filtre plissé de 1 po, MERV 11, à la dimension du système."],
      es: ["Filtro de aire plisado", "Filtro plisado de 1 pulg, MERV 11, en la medida del sistema."],
      it: ["Filtro aria pieghettato", "Filtro pieghettato da 1 pollice, MERV 11, nella misura dell'impianto."],
      de: ["Faltenfilter", "1-Zoll-Faltenfilter, MERV 11, in der Größe der Anlage."],
      uk: ["Гофрований повітряний фільтр", "Гофрований фільтр 1 дюйм, MERV 11, за розміром системи."],
      tl: ["Pleated air filter", "1-inch pleated filter, MERV 11, sa size ng sistema."],
    }, { cost: 18.97, ref: HD.filter_16x25x1 }),
  ], D.regular("fixed", 10)),

  "fq.hvac_repair.coils.clean": T("maintenance", {
    it: ["Pulizia batterie — evaporatore e condensatore", "Entrambe le batterie pulite dalla patina di sporco e lanugine che blocca lo scambio termico, così l'impianto raffredda e riscalda di nuovo a piena capacità."],
    de: ["Registerreinigung — Verdampfer und Verflüssiger", "Beide Register vom Schmutz- und Flusenfilm befreit, der den Wärmeübergang blockiert, damit die Anlage wieder mit voller Leistung kühlt und heizt."],
    uk: ["Чищення теплообмінників — випарник і конденсатор", "Обидва теплообмінники очищено від плівки бруду й ворсу, що блокує теплообмін, щоб система знову охолоджувала й гріла на повну."],
    tl: ["Paglilinis ng coil — evaporator at condenser", "Nilinis ang dalawang coil mula sa dumi at lint na humaharang sa heat transfer, para bumalik sa full capacity ang sistema."],
  }, [
    L.labour(1, "flat", 340, {
      en: ["Evaporator and condenser coil cleaning", "The condenser coil washed out from the inside and the evaporator coil foamed, rinsed and the drain flushed."],
      fr: ["Nettoyage des serpentins d'évaporateur et de condenseur", "Serpentin du condenseur lavé de l'intérieur, serpentin d'évaporateur moussé et rincé, drain purgé."],
      es: ["Limpieza de serpentines evaporador y condensador", "Serpentín del condensador lavado desde adentro, el del evaporador espumado y enjuagado, y el drenaje purgado."],
      it: ["Pulizia batterie evaporatore e condensatore", "Batteria del condensatore lavata dall'interno, batteria dell'evaporatore schiumata e sciacquata, scarico spurgato."],
      de: ["Reinigung von Verdampfer- und Verflüssigerregister", "Verflüssigerregister von innen gespült, Verdampferregister eingeschäumt und gespült, Ablauf durchgespült."],
      uk: ["Чищення теплообмінників випарника й конденсатора", "Теплообмінник конденсатора промито зсередини, випарник оброблено піною та промито, дренаж прочищено."],
      tl: ["Paglilinis ng evaporator at condenser coil", "Hinugasan mula sa loob ang condenser coil, nilagyan ng foam at hinugasan ang evaporator coil, at ni-flush ang drain."],
    }),
    L.material(1, "each", 40, {
      en: ["Coil cleaner", "Foaming evaporator coil cleaner and condenser coil detergent, one service."],
      fr: ["Nettoyant à serpentin", "Nettoyant moussant pour évaporateur et détergent pour condenseur, un entretien."],
      es: ["Limpiador de serpentín", "Limpiador espumante para evaporador y detergente para condensador, un servicio."],
      it: ["Detergente per batterie", "Schiuma per evaporatore e detergente per condensatore, un intervento."],
      de: ["Registerreiniger", "Schaumreiniger für den Verdampfer und Reiniger für den Verflüssiger, ein Einsatz."],
      uk: ["Засіб для чищення теплообмінників", "Пінний очищувач випарника та мийний засіб для конденсатора, одне обслуговування."],
      tl: ["Coil cleaner", "Foaming evaporator coil cleaner at condenser coil detergent, isang service."],
    }),
  ], D.regular("fixed", 25)),

  // ── Folded in from the captured HVAC template set (2026-09-24): prices and
  //    costs as captured, wording ours. ──────────────────────────────────
  "fq.hvac_repair.diagnostics.heating_repair_visit": T("repair", {
    it: ["Intervento di riparazione del riscaldamento", "Visita prenotata per un riscaldamento che non scalda: guasto trovato e riparato nella stessa visita quando possibile."],
    de: ["Heizungsreparatur-Einsatz", "Gebuchter Besuch bei einer Heizung, die nicht heizt: Fehler gefunden und wenn möglich im selben Besuch behoben."],
    uk: ["Виклик для ремонту опалення", "Запланований візит, коли опалення не гріє: несправність знаходять і усувають за той самий візит, коли можливо."],
    tl: ["Visit para sa pag-ayos ng heating", "Naka-book na visit kapag hindi umiinit: hahanapin at aayusin ang sira sa parehong visit kung kaya."],
  }, [
    SHARED.diagnostic(95, { cost: 80 }),
    L.labour(1, "flat", 500, {
      en: ["Furnace repair", "The furnace fault repaired with quality parts, then the system tested through a full heating cycle."],
      fr: ["Réparation de la fournaise", "Défaut de la fournaise réparé avec des pièces de qualité, puis système testé sur un cycle de chauffe complet."],
      es: ["Reparación de la caldera", "Falla de la caldera reparada con piezas de calidad y el sistema probado en un ciclo completo de calefacción."],
      it: ["Riparazione caldaia", "Guasto della caldaia riparato con ricambi di qualità, poi impianto provato per un ciclo completo di riscaldamento."],
      de: ["Heizungsreparatur", "Fehler am Warmluftofen mit Qualitätsteilen behoben, dann die Anlage über einen vollen Heizzyklus geprüft."],
      uk: ["Ремонт печі опалення", "Несправність печі усунено якісними деталями, систему перевірено на повному циклі нагрівання."],
      tl: ["Pag-ayos ng furnace", "Inayos ang sira ng furnace gamit ang de-kalidad na piyesa at sinubukan ang buong heating cycle."],
    }, { cost: 300 }),
  ], D.regular("percent", 3)),

  "fq.hvac_repair.diagnostics.service_visit": T("repair", {
    it: ["Intervento di assistenza", "Uscita per rimettere in funzione riscaldamento o raffrescamento, con la riparazione fatta sul posto se il ricambio è sul furgone."],
    de: ["Serviceeinsatz", "Einsatz, um Heizung oder Kühlung wieder in Gang zu bringen — repariert vor Ort, wenn das Teil im Wagen ist."],
    uk: ["Сервісний виїзд", "Виїзд, щоб знову запустити опалення чи охолодження, з ремонтом на місці, якщо деталь є в машині."],
    tl: ["Service visit", "Pagpunta para paandarin ulit ang heating o cooling, inaayos agad kung nasa truck ang piyesa."],
  }, [
    SHARED.serviceCall(89),
    SHARED.techHour(1, 135),
  ], D.regular("percent", 3)),

  "fq.hvac_repair.diagnostics.cooling_repair_visit": T("inspection", {
    it: ["Visita diagnostica — nessun raffrescamento", "Il climatizzatore non raffresca: un tecnico viene a casa e trova la causa prima di qualsiasi riparazione."],
    de: ["Diagnosebesuch — keine Kühlung", "Die Klimaanlage kühlt nicht: ein Techniker kommt ins Haus und findet die Ursache vor jeder Reparatur."],
    uk: ["Діагностика — не охолоджує", "Кондиціонер не охолоджує: технік приїжджає додому й знаходить причину до будь-якого ремонту."],
    tl: ["Diagnostic visit — walang lamig", "Hindi lumalamig ang aircon: pupunta ang technician at hahanapin ang sanhi bago mag-ayos."],
  }, [
    SHARED.diagnostic(95, { cost: 80 }),
  ], D.regular("percent", 3)),

  "fq.hvac_repair.diagnostics.system_inspection": T("inspection", {
    it: ["Ispezione dell'impianto HVAC", "Batterie, filtro, pressioni del refrigerante, collegamenti elettrici e termostato controllati per sicurezza e prestazioni, con i risultati per iscritto."],
    de: ["HLK-Anlageninspektion", "Register, Filter, Kältemitteldrücke, elektrische Anschlüsse und Thermostat auf Sicherheit und Leistung geprüft, Befunde schriftlich."],
    uk: ["Огляд системи HVAC", "Теплообмінники, фільтр, тиск холодоагенту, електричні з'єднання та термостат перевірено на безпеку й роботу, результати письмово."],
    tl: ["Inspeksyon ng HVAC system", "Chineck ang coil, filter, refrigerant pressure, koneksyon ng kuryente at thermostat para sa kaligtasan at performance, nakasulat ang resulta."],
  }, [
    L.labour(1, "flat", 99, {
      en: ["Full HVAC system inspection", "Coils, filter, refrigerant levels, electrical connections and thermostat inspected."],
      fr: ["Inspection complète du système", "Serpentins, filtre, niveaux de frigorigène, connexions électriques et thermostat inspectés."],
      es: ["Inspección completa del sistema", "Serpentines, filtro, niveles de refrigerante, conexiones eléctricas y termostato inspeccionados."],
      it: ["Ispezione completa dell'impianto", "Batterie, filtro, livelli del refrigerante, collegamenti elettrici e termostato ispezionati."],
      de: ["Vollständige Anlageninspektion", "Register, Filter, Kältemittelstand, elektrische Anschlüsse und Thermostat geprüft."],
      uk: ["Повний огляд системи", "Оглянуто теплообмінники, фільтр, рівень холодоагенту, електричні з'єднання та термостат."],
      tl: ["Buong inspeksyon ng HVAC", "Sinuri ang coil, filter, refrigerant level, koneksyon ng kuryente at thermostat."],
    }, { cost: 50 }),
  ], D.regular("fixed", 5)),

  "fq.hvac_repair.diagnostics.diagnostic_visit": T("inspection", {
    it: ["Visita diagnostica", "Un tecnico trova perché riscaldamento o raffrescamento non funzionano e dà un prezzo scritto prima di riparare."],
    de: ["Diagnosebesuch", "Ein Techniker findet, warum Heizung oder Kühlung nicht laufen, und nennt vor der Reparatur einen schriftlichen Preis."],
    uk: ["Діагностичний візит", "Технік з'ясовує, чому не працює опалення чи охолодження, і дає письмову ціну до ремонту."],
    tl: ["Diagnostic visit", "Aalamin ng technician kung bakit hindi gumagana ang heating o cooling at magbibigay ng nakasulat na presyo bago mag-ayos."],
  }, [
    SHARED.diagnostic(95, { cost: 80 }),
  ], null),

  "fq.hvac_repair.coils.evaporator_clean": T("maintenance", {
    it: ["Pulizia batteria evaporatore", "Batteria dell'evaporatore pulita con detergente specifico, vaschetta pulita, alette raddrizzate e prestazioni verificate."],
    de: ["Verdampferreinigung", "Verdampferregister mit Spezialreiniger gesäubert, Wanne gereinigt, Lamellen gerichtet und die Leistung geprüft."],
    uk: ["Чищення випарника", "Випарник очищено спеціальним засобом, піддон вимито, ламелі вирівняно, роботу перевірено."],
    tl: ["Paglilinis ng evaporator coil", "Nilinis ang evaporator coil gamit ang espesyal na cleaner, nilinis ang pan, inayos ang fins at sinubukan ang performance."],
  }, [
    L.labour(1, "flat", 500, {
      en: ["Coil cleaning", "Surrounding parts protected, cleaner applied and rinsed, drain pan cleaned, fins combed and the system tested."],
      fr: ["Nettoyage du serpentin", "Pièces voisines protégées, nettoyant appliqué et rincé, bac nettoyé, ailettes redressées et système testé."],
      es: ["Limpieza del serpentín", "Piezas cercanas protegidas, limpiador aplicado y enjuagado, charola limpia, aletas peinadas y el sistema probado."],
      it: ["Pulizia batteria", "Componenti vicini protetti, detergente applicato e risciacquato, vaschetta pulita, alette pettinate e impianto provato."],
      de: ["Registerreinigung", "Umliegende Teile geschützt, Reiniger aufgetragen und gespült, Wanne gereinigt, Lamellen gekämmt, Anlage getestet."],
      uk: ["Чищення теплообмінника", "Сусідні деталі захищено, засіб нанесено й змито, піддон очищено, ламелі вирівняно, систему перевірено."],
      tl: ["Paglilinis ng coil", "Pinrotektahan ang katabing parte, nilagyan ng cleaner at hinugasan, nilinis ang pan, sinuklay ang fins at sinubukan."],
    }, { cost: 200 }),
  ], D.regular("percent", 3)),

  "fq.hvac_repair.maintenance.preventative_maintenance": T("maintenance", {
    it: ["Manutenzione preventiva", "Visita programmata per pulire, regolare e provare l'impianto prima della stagione, così i piccoli difetti si trovano prima del guasto."],
    de: ["Vorbeugende Wartung", "Planmäßiger Besuch, um die Anlage vor der Saison zu reinigen, einzustellen und zu prüfen — kleine Mängel werden vor dem Ausfall gefunden."],
    uk: ["Профілактичне обслуговування", "Плановий візит, щоб очистити, налаштувати й перевірити систему до сезону й виявити дрібні несправності до аварії."],
    tl: ["Preventive maintenance", "Naka-schedule na visit para linisin, ayusin at subukan ang sistema bago ang season, para mahuli ang maliit na sira bago masira."],
  }, [
    L.labour(1, "flat", 129, {
      en: ["Seasonal tune-up", "Coil cleaning, belt check, thermostat calibration, drain flush and safety check."],
      fr: ["Mise au point saisonnière", "Nettoyage des serpentins, vérification de la courroie, étalonnage du thermostat, purge du drain et contrôle de sécurité."],
      es: ["Afinación de temporada", "Limpieza de serpentines, revisión de banda, calibración del termostato, purga del drenaje y revisión de seguridad."],
      it: ["Tagliando stagionale", "Pulizia batterie, controllo cinghia, taratura termostato, lavaggio scarico e verifica di sicurezza."],
      de: ["Saisonwartung", "Registerreinigung, Riemenprüfung, Thermostatkalibrierung, Ablaufspülung und Sicherheitsprüfung."],
      uk: ["Сезонне обслуговування", "Чищення теплообмінників, перевірка ременя, калібрування термостата, промивання дренажу та перевірка безпеки."],
      tl: ["Seasonal tune-up", "Paglilinis ng coil, check ng belt, calibration ng thermostat, flush ng drain at safety check."],
    }, { cost: 65 }),
    L.material(1, "each", 20, {
      en: ["Pleated air filter", "1-inch pleated filter, MERV 8, in the system's size."],
      fr: ["Filtre à air plissé", "Filtre plissé de 1 po, MERV 8, à la dimension du système."],
      es: ["Filtro de aire plisado", "Filtro plisado de 1 pulg, MERV 8, en la medida del sistema."],
      it: ["Filtro aria pieghettato", "Filtro pieghettato da 1 pollice, MERV 8, nella misura dell'impianto."],
      de: ["Faltenfilter", "1-Zoll-Faltenfilter, MERV 8, in der Größe der Anlage."],
      uk: ["Гофрований повітряний фільтр", "Гофрований фільтр 1 дюйм, MERV 8, за розміром системи."],
      tl: ["Pleated air filter", "1-inch pleated filter, MERV 8, sa size ng sistema."],
    }, { cost: 8 }),
  ], D.regular("fixed", 7)),

  // ── The captured one-time duct cleaning (air-duct capture under
  //    docs/research/: $320 at $200 cost, vents and registers $90 at $50,
  //    $20 off). The rest of that set lives in air_duct_cleaning.js; this
  //    row is tagged for that trade below. ───────────────────────────────
  "fq.hvac_repair.air_quality.clean_ducts": T("installation", {
    it: ["Pulizia dei condotti d'aria", "Condotti di mandata e ripresa puliti con aspirazione a pressione negativa e spazzole rotanti."],
    de: ["Luftkanalreinigung", "Zu- und Abluftkanäle mit Unterdruckabsaugung und rotierenden Bürsten gereinigt."],
    uk: ["Чищення повітроводів", "Припливні та зворотні повітроводи очищено негативним тиском і обертовими щітками."],
    tl: ["Paglilinis ng air duct", "Nilinis ang supply at return duct gamit ang negative-pressure vacuum at umiikot na brush."],
  }, [
    L.labour(1, "flat", 320, {
      en: ["Air duct cleaning", "Trunk and branch ducts cleaned under negative pressure with rotary brushes."],
      fr: ["Nettoyage des conduits", "Conduits principaux et secondaires nettoyés sous pression négative avec brosses rotatives."],
      es: ["Limpieza de ductos", "Ductos troncales y ramales limpiados con presión negativa y cepillos rotativos."],
      it: ["Pulizia dei condotti", "Condotti principali e diramazioni puliti in depressione con spazzole rotanti."],
      de: ["Kanalreinigung", "Haupt- und Abzweigkanäle im Unterdruck mit rotierenden Bürsten gereinigt."],
      uk: ["Чищення повітроводів", "Магістральні й відгалужені повітроводи очищено під негативним тиском обертовими щітками."],
      tl: ["Paglilinis ng duct", "Nilinis ang trunk at branch duct sa negative pressure gamit ang rotary brush."],
    }, { cost: 200 }),
    L.labour(1, "flat", 90, {
      en: ["Vent and register cleaning", "Every vent and register removed, washed and refitted."],
      fr: ["Nettoyage des bouches et grilles", "Chaque bouche et grille retirée, lavée et reposée."],
      es: ["Limpieza de rejillas y difusores", "Cada rejilla y difusor retirado, lavado y recolocado."],
      it: ["Pulizia bocchette e griglie", "Ogni bocchetta e griglia tolta, lavata e rimontata."],
      de: ["Auslässe und Gitter reinigen", "Jeder Auslass und jedes Gitter abgenommen, gewaschen und wieder angebracht."],
      uk: ["Чищення решіток і дифузорів", "Кожну решітку й дифузор знято, вимито й встановлено назад."],
      tl: ["Paglilinis ng vent at register", "Tinanggal, hinugasan at ibinalik ang bawat vent at register."],
    }, { cost: 50 }),
  ], D.newCustomer("fixed", 20)),

  // ── Taken from the schema agent's template draft (branch
  //    agent/services-templates-seeds-wip) for rows this file had not
  //    templated; prices and costs as drafted there. ──────────────────
  "fq.hvac_repair.air_quality.replace_filter": T("maintenance", {
    it: ["Sostituzione del filtro dell'aria", "Il filtro dell'impianto sostituito con uno nuovo della misura giusta e la griglia di ripresa pulita."],
    de: ["Luftfilterwechsel", "Der Anlagenfilter durch einen neuen in der richtigen Größe ersetzt und das Rückluftgitter gereinigt."],
    uk: ["Заміна повітряного фільтра", "Фільтр системи замінено на новий потрібного розміру, решітку рециркуляції очищено."],
    tl: ["Pagpapalit ng air filter", "Pinalitan ang filter ng sistema ng bagong tamang sukat at nilinis ang return grille."],
  }, [
    L.labour(1, "flat", 60, {
      en: ["Filter change and return cleaning", "The old filter out, the return grille vacuumed, the new filter in and the airflow arrow checked."],
      fr: ["Changement de filtre et nettoyage du retour d'air", "Ancien filtre retiré, grille de retour aspirée, filtre neuf posé et sens de la flèche vérifié."],
      es: ["Cambio de filtro y limpieza del retorno", "Filtro viejo fuera, rejilla de retorno aspirada, filtro nuevo puesto y la flecha de flujo verificada."],
      it: ["Cambio filtro e pulizia della ripresa", "Filtro vecchio tolto, griglia di ripresa aspirata, filtro nuovo inserito e freccia del flusso controllata."],
      de: ["Filterwechsel und Rückluftreinigung", "Alter Filter raus, Rückluftgitter abgesaugt, neuer Filter rein und der Luftrichtungspfeil geprüft."],
      uk: ["Заміна фільтра та чищення решітки", "Старий фільтр знято, решітку пропилососено, новий фільтр встановлено, стрілку напряму перевірено."],
      tl: ["Pagpapalit ng filter at paglilinis ng return", "Tinanggal ang lumang filter, na-vacuum ang return grille, inilagay ang bago at sinuri ang arrow ng daloy."],
    }, { cost: 30 }),
    L.material(1, "each", 45, {
      en: ["High-efficiency pleated filter", "A MERV 11 pleated filter in the size the system takes."],
      fr: ["Filtre plissé haute efficacité", "Filtre plissé MERV 11 à la dimension du système."],
      es: ["Filtro plisado de alta eficiencia", "Filtro plisado MERV 11 en la medida que usa el sistema."],
      it: ["Filtro pieghettato ad alta efficienza", "Filtro pieghettato MERV 11 nella misura dell'impianto."],
      de: ["Hochleistungs-Faltenfilter", "MERV-11-Faltenfilter in der Größe der Anlage."],
      uk: ["Гофрований фільтр високої ефективності", "Гофрований фільтр MERV 11 потрібного розміру."],
      tl: ["High-efficiency pleated filter", "MERV 11 pleated filter sa sukat ng sistema."],
    }, { cost: 34 }),
  ], null),

  "fq.hvac_repair.coils.inspect": T("inspection", {
    it: ["Ispezione delle batterie", "Batterie dell'evaporatore e del condensatore ispezionate per sporco, corrosione e perdite, con quanto trovato riferito prima di consigliare una pulizia o una riparazione."],
    de: ["Inspektion der Wärmetauscher", "Verdampfer- und Verflüssigerregister auf Verschmutzung, Korrosion und Lecks geprüft; der Befund wird berichtet, bevor eine Reinigung oder Reparatur empfohlen wird."],
    uk: ["Огляд теплообмінників", "Випарник і конденсатор оглянуто на забруднення, корозію та витоки; результат повідомлено до рекомендації чищення або ремонту."],
    tl: ["Inspeksyon ng coil", "Sinuri ang evaporator at condenser coil kung may dumi, kalawang at tagas, at iniulat ang natuklasan bago magrekomenda ng paglilinis o pag-aayos."],
  }, [
    L.labour(1, "flat", 125, {
      en: ["Coil inspection", "Both coils opened up and examined for fouling, corrosion and oil traces that mean a leak."],
      fr: ["Inspection des serpentins", "Les deux serpentins ouverts et examinés pour encrassement, corrosion et traces d'huile signalant une fuite."],
      es: ["Inspección de serpentines", "Ambos serpentines abiertos y examinados en busca de suciedad, corrosión y rastros de aceite que indiquen fuga."],
      it: ["Ispezione delle batterie", "Entrambe le batterie aperte ed esaminate per sporco, corrosione e tracce d'olio che indicano una perdita."],
      de: ["Registerinspektion", "Beide Register geöffnet und auf Verschmutzung, Korrosion und Ölspuren, die auf ein Leck hindeuten, untersucht."],
      uk: ["Огляд теплообмінників", "Обидва теплообмінники відкрито та оглянуто на забруднення, корозію та сліди оливи, що вказують на витік."],
      tl: ["Inspeksyon ng coil", "Binuksan at sinuri ang dalawang coil kung may dumi, kalawang at bakas ng langis na senyales ng tagas."],
    }, { cost: 60 }),
  ], null),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);

// ── Templates added 2026-09-25 ───────────────────────────────────────────────
//
// The owner (2026-09-25): a service added to a quote should arrive with a few
// lines, not as one bare line. The templates above cover twenty-two rows;
// these cover the other sixty-nine. Same evidence as above: the captured
// HVAC templates' shape and prices (the $99 diagnostic credited on repair,
// R-410A at $85 a pound on a $45 cost, labour at $125–150 an hour, labour
// cost 50%), parts at supply-house cost ≈ 70–75% of price, and each row's
// benchmark median for the level. Where the Home Depot reference carries the
// part (capacitor, contactor, condensate pump, thermostat, evaporator coil,
// filter) the line is costed from it.
//
// The refrigerant rows sold per pound keep that unit: their pound line
// carries the `each` key, so the quantity is the pounds typed on the
// estimate. Elsewhere a repair's refrigerant stays a fixed qty with no key —
// pounds are weighed in on site, as the leak-repair template above says.
//
// Where the benchmark median cannot buy the job (compressor replacement at a
// $300 median — the low quartile is a $129 call-out) the lines are priced at
// 2026 trade figures; the median stays the preset price, the lines are the
// estimate.
//
// Kept apart from TEMPLATES and applied in a second pass, before tagRows, so
// every template above stays exactly as it was and the air-duct tags still
// merge onto these rows. A key that already has a template throws instead of
// being overwritten. Punjabi sits inline beside the other seven languages;
// the service's own name in every language is the row's (./i18n/hvac_repair.js).

/** [name, description] in the eight languages, in this order. */
const X = (en, fr, es, it, de, uk, pa, tl) => ({ en, fr, es, it, de, uk, pa, tl });
const A = (kind, lines, opts = {}) => ({ kind, lines, opts });
// A per-item row of the Home Depot reference that _materialCosts.js does not
// list (that file is shared and being edited by every trade at once — hoisting
// these keys into its USES is the follow-up). Same shape its build() returns,
// Canadian cost included where the reference has one.
const REF = (key) => {
  const r = materialRef(key);
  if (!r?.prices?.US || r.coverage) throw new Error(`hvac_repair: ${key} is not a per-item reference row`);
  return { ref: key, cost: r.prices.US.amount, unit: r.unit, per: 1, per_unit: "each", ca: r.prices.CA ? { cost: r.prices.CA.amount, unit: r.prices.CA.unit || r.unit, coverage: null } : null };
};
// Mechanical contractors quote the commercial and heavy HVAC work under their
// own quote type (NEAREST_TRADES borrows hvac_repair's list for them).
const MECH = { categories: ["hvac_repair", "mechanical_contracting"] };

// ── Lines several rows share ──
const DIAG = () => SHARED.diagnostic(99, { cost: 50 });
const R410 = (qty, extra = {}) => L.material(qty, "each", 85, X(
  ["R-410A refrigerant — per pound", "R-410A weighed into the system by the pound."],
  ["Frigorigène R-410A — la livre", "R-410A pesé dans le système à la livre."],
  ["Refrigerante R-410A — por libra", "R-410A cargado al sistema por libra, pesado."],
  ["Refrigerante R-410A — alla libbra", "R-410A caricato nell'impianto a peso, per libbra."],
  ["Kältemittel R-410A — pro Pfund", "R-410A pfundweise in die Anlage eingewogen."],
  ["Холодоагент R-410A — за фунт", "R-410A заправлено в систему за вагою, по фунту."],
  ["R-410A ਰੈਫ਼ਰੀਜਰੈਂਟ — ਪ੍ਰਤੀ ਪੌਂਡ", "R-410A ਤੋਲ ਕੇ ਪੌਂਡ ਦੇ ਹਿਸਾਬ ਨਾਲ ਸਿਸਟਮ ਵਿੱਚ ਭਰਿਆ।"],
  ["R-410A refrigerant — kada libra", "R-410A na tinitimbang papasok sa sistema kada libra."],
), { cost: 45, ...extra });
const R22 = (extra = {}) => L.material(1, "each", 125, X(
  ["R-22 refrigerant — per pound", "Reclaimed R-22 weighed in by the pound; supply is limited since the phase-out."],
  ["Frigorigène R-22 — la livre", "R-22 récupéré pesé à la livre; l'offre est limitée depuis l'abandon progressif."],
  ["Refrigerante R-22 — por libra", "R-22 recuperado cargado por libra; el suministro es limitado desde su retiro."],
  ["Refrigerante R-22 — alla libbra", "R-22 rigenerato caricato a peso, per libbra; la disponibilità è limitata dopo la dismissione."],
  ["Kältemittel R-22 — pro Pfund", "Aufbereitetes R-22 pfundweise eingewogen; seit dem Ausstieg nur begrenzt erhältlich."],
  ["Холодоагент R-22 — за фунт", "Регенерований R-22 за вагою, по фунту; після виведення з обігу його мало."],
  ["R-22 ਰੈਫ਼ਰੀਜਰੈਂਟ — ਪ੍ਰਤੀ ਪੌਂਡ", "ਰੀਕਲੇਮ ਕੀਤਾ R-22 ਪੌਂਡ ਦੇ ਹਿਸਾਬ ਨਾਲ ਤੋਲਿਆ; ਬੰਦ ਹੋਣ ਕਰਕੇ ਸਪਲਾਈ ਘੱਟ ਹੈ।"],
  ["R-22 refrigerant — kada libra", "Reclaimed na R-22 na tinitimbang kada libra; limitado na ang supply mula nang i-phase out."],
), { cost: 75, ...extra });
const CHARGE_LABOUR = (price) => L.labour(1, "flat", price, X(
  ["Charging labour — gauges on, weigh-in", "Gauges connected, the charge weighed in against the scale and superheat or subcooling checked to the manufacturer's chart."],
  ["Main-d'œuvre — charge au manomètre et à la balance", "Manomètres branchés, charge pesée sur la balance et surchauffe ou sous-refroidissement vérifiés selon le tableau du fabricant."],
  ["Mano de obra — carga con manómetros y báscula", "Manómetros conectados, la carga pesada en báscula y el sobrecalentamiento o subenfriamiento revisados con la tabla del fabricante."],
  ["Manodopera — carica con manometri e bilancia", "Manometri collegati, carica pesata sulla bilancia e surriscaldamento o sottoraffreddamento verificati sulla tabella del costruttore."],
  ["Arbeit — Befüllung mit Manometer und Waage", "Manometer angeschlossen, Füllmenge über die Waage eingewogen und Überhitzung oder Unterkühlung nach Herstellertabelle geprüft."],
  ["Робота — заправка з манометрами й вагами", "Манометри під'єднано, заправку зважено, перегрів чи переохолодження перевірено за таблицею виробника."],
  ["ਚਾਰਜਿੰਗ ਲੇਬਰ — ਗੇਜ ਅਤੇ ਤੋਲ", "ਗੇਜ ਲਾਏ, ਕੰਡੇ 'ਤੇ ਤੋਲ ਕੇ ਚਾਰਜ ਭਰਿਆ ਅਤੇ ਕੰਪਨੀ ਦੇ ਚਾਰਟ ਮੁਤਾਬਕ ਸੁਪਰਹੀਟ ਜਾਂ ਸਬਕੂਲਿੰਗ ਜਾਂਚੀ।"],
  ["Labor — pag-charge, gauge at timbang", "Ikinabit ang gauge, tinimbang ang charge sa timbangan at chineck ang superheat o subcooling ayon sa chart ng manufacturer."],
), { cost: price / 2 });
const PER_POUND_LABOUR = () => L.labour(1, "each", 15, X(
  ["Charging time — per additional pound", "The extra time on gauges and scale for each pound past the first."],
  ["Temps de charge — par livre supplémentaire", "Temps supplémentaire aux manomètres et à la balance pour chaque livre après la première."],
  ["Tiempo de carga — por libra adicional", "El tiempo extra con manómetros y báscula por cada libra después de la primera."],
  ["Tempo di carica — per libbra in più", "Il tempo in più con manometri e bilancia per ogni libbra dopo la prima."],
  ["Füllzeit — pro weiteres Pfund", "Die zusätzliche Zeit an Manometer und Waage für jedes Pfund nach dem ersten."],
  ["Час заправки — за кожен додатковий фунт", "Додатковий час із манометрами й вагами на кожен фунт після першого."],
  ["ਚਾਰਜਿੰਗ ਸਮਾਂ — ਹਰ ਵਾਧੂ ਪੌਂਡ", "ਪਹਿਲੇ ਤੋਂ ਬਾਅਦ ਹਰ ਪੌਂਡ ਲਈ ਗੇਜ ਅਤੇ ਕੰਡੇ 'ਤੇ ਵਾਧੂ ਸਮਾਂ।"],
  ["Oras ng pag-charge — kada dagdag na libra", "Dagdag na oras sa gauge at timbangan para sa bawat libra pagkatapos ng una."],
), { measurementKey: "each" });
const BRAZE = (price = 55, cost = 38) => L.material(1, "flat", price, X(
  ["Brazing materials and filter drier", "Silver brazing rod, nitrogen purge and a new liquid-line filter drier."],
  ["Matériel de brasage et filtre déshydrateur", "Baguette de brasage à l'argent, purge à l'azote et nouveau filtre déshydrateur sur la conduite liquide."],
  ["Material de soldadura y filtro deshidratador", "Varilla de plata para soldar, purga con nitrógeno y filtro deshidratador nuevo en la línea de líquido."],
  ["Materiale di brasatura e filtro disidratatore", "Bacchetta di brasatura all'argento, flussaggio con azoto e nuovo filtro disidratatore sulla linea del liquido."],
  ["Lötmaterial und Filtertrockner", "Silberlot, Stickstoffspülung und ein neuer Filtertrockner in der Flüssigkeitsleitung."],
  ["Матеріали для пайки й фільтр-осушувач", "Срібний припій, продування азотом і новий фільтр-осушувач на рідинній лінії."],
  ["ਬ੍ਰੇਜ਼ਿੰਗ ਸਮਾਨ ਅਤੇ ਫ਼ਿਲਟਰ ਡ੍ਰਾਇਰ", "ਸਿਲਵਰ ਬ੍ਰੇਜ਼ਿੰਗ ਰਾਡ, ਨਾਈਟ੍ਰੋਜਨ ਪਰਜ ਅਤੇ ਲਿਕਵਿਡ ਲਾਈਨ ਲਈ ਨਵਾਂ ਫ਼ਿਲਟਰ ਡ੍ਰਾਇਰ।"],
  ["Brazing materials at filter drier", "Silver brazing rod, nitrogen purge at bagong filter drier sa liquid line."],
), { cost });
const COMPRESSOR_LABOUR = (price) => L.labour(1, "flat", price, X(
  ["Compressor replacement labour", "Refrigerant recovered, the old compressor cut out and the new one brazed in under nitrogen, then pressure-tested and evacuated to 500 microns."],
  ["Main-d'œuvre — remplacement du compresseur", "Frigorigène récupéré, ancien compresseur coupé, le neuf brasé sous azote, puis essai de pression et tirage au vide à 500 microns."],
  ["Mano de obra — reemplazo del compresor", "Refrigerante recuperado, compresor viejo cortado y el nuevo soldado con nitrógeno, luego prueba de presión y vacío a 500 micrones."],
  ["Manodopera — sostituzione compressore", "Refrigerante recuperato, vecchio compressore tagliato e il nuovo brasato sotto azoto, poi prova di pressione e vuoto a 500 micron."],
  ["Arbeit — Verdichtertausch", "Kältemittel abgesaugt, alter Verdichter ausgetrennt, der neue unter Stickstoff eingelötet, dann abgedrückt und auf 500 Mikron evakuiert."],
  ["Робота — заміна компресора", "Холодоагент відкачано, старий компресор вирізано, новий упаяно під азотом, потім опресовано й відвакуумовано до 500 мікрон."],
  ["ਕੰਪ੍ਰੈਸਰ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਪੁਰਾਣਾ ਕੰਪ੍ਰੈਸਰ ਕੱਟਿਆ ਅਤੇ ਨਵਾਂ ਨਾਈਟ੍ਰੋਜਨ ਹੇਠ ਬ੍ਰੇਜ਼ ਕੀਤਾ, ਫਿਰ ਪ੍ਰੈਸ਼ਰ ਟੈਸਟ ਅਤੇ 500 ਮਾਈਕ੍ਰੋਨ ਤੱਕ ਵੈਕਿਊਮ।"],
  ["Labor — palit ng compressor", "Na-recover ang refrigerant, tinanggal ang lumang compressor at binraze ang bago sa ilalim ng nitrogen, tapos pressure test at vacuum hanggang 500 microns."],
));
const COMPRESSOR = (price, cost) => L.material(1, "each", price, X(
  ["Replacement compressor", "Scroll or reciprocating compressor matched to the unit's tonnage and refrigerant, with a new run capacitor."],
  ["Compresseur de remplacement", "Compresseur à spirale ou à piston assorti au tonnage et au frigorigène de l'appareil, avec condensateur neuf."],
  ["Compresor de reemplazo", "Compresor scroll o reciprocante según el tonelaje y refrigerante del equipo, con capacitor nuevo."],
  ["Compressore di ricambio", "Compressore scroll o alternativo adatto a tonnellaggio e refrigerante dell'unità, con condensatore nuovo."],
  ["Ersatzverdichter", "Scroll- oder Hubkolbenverdichter passend zu Leistung und Kältemittel des Geräts, mit neuem Betriebskondensator."],
  ["Компресор на заміну", "Спіральний або поршневий компресор під потужність і холодоагент блока, з новим конденсатором."],
  ["ਬਦਲਵਾਂ ਕੰਪ੍ਰੈਸਰ", "ਯੂਨਿਟ ਦੇ ਟਨ ਅਤੇ ਰੈਫ਼ਰੀਜਰੈਂਟ ਮੁਤਾਬਕ ਸਕ੍ਰੋਲ ਜਾਂ ਪਿਸਟਨ ਕੰਪ੍ਰੈਸਰ, ਨਵੇਂ ਕੈਪੇਸਿਟਰ ਸਮੇਤ।"],
  ["Kapalit na compressor", "Scroll o reciprocating na compressor na tugma sa tonelada at refrigerant ng unit, may bagong capacitor."],
), { cost, taxable: false });
const PAN_TABS = () => L.material(1, "flat", 20, X(
  ["Condensate pan treatment tablets", "Slow-release tablets that keep algae and slime from coming back in the pan and line."],
  ["Pastilles de traitement pour bac à condensat", "Pastilles à libération lente qui empêchent les algues et la boue de revenir dans le bac et la conduite."],
  ["Pastillas para charola de condensado", "Pastillas de liberación lenta que evitan que vuelvan las algas y el lodo en la charola y la línea."],
  ["Pastiglie per vaschetta condensa", "Pastiglie a lento rilascio che impediscono ad alghe e melma di tornare in vaschetta e linea."],
  ["Tabletten für die Kondensatwanne", "Depot-Tabletten, die Algen und Schleim in Wanne und Leitung fernhalten."],
  ["Таблетки для піддона конденсату", "Таблетки повільної дії, що не дають водоростям і слизу повернутися в піддон і лінію."],
  ["ਕੰਡੈਂਸੇਟ ਪੈਨ ਲਈ ਗੋਲੀਆਂ", "ਹੌਲੀ-ਹੌਲੀ ਘੁਲਣ ਵਾਲੀਆਂ ਗੋਲੀਆਂ ਜੋ ਪੈਨ ਅਤੇ ਲਾਈਨ ਵਿੱਚ ਕਾਈ ਅਤੇ ਚਿੱਕੜ ਮੁੜ ਨਹੀਂ ਆਉਣ ਦਿੰਦੀਆਂ।"],
  ["Tableta para sa condensate pan", "Slow-release na tableta para hindi bumalik ang lumot at putik sa pan at linya."],
), { cost: 8 });
const COND_FAN_MOTOR = (extra = {}) => L.material(1, "each", 220, X(
  ["Condenser fan motor", "Outdoor fan motor matched for horsepower, RPM and rotation, with mounting hardware."],
  ["Moteur de ventilateur de condenseur", "Moteur de ventilateur extérieur assorti en puissance, en vitesse et en sens de rotation, avec quincaillerie de fixation."],
  ["Motor del ventilador del condensador", "Motor del ventilador exterior según potencia, RPM y giro, con herrajes de montaje."],
  ["Motore ventola condensatore", "Motore ventola esterna adatto per potenza, giri e senso di rotazione, con minuteria di fissaggio."],
  ["Verflüssiger-Lüftermotor", "Außenlüftermotor passend nach Leistung, Drehzahl und Drehrichtung, mit Befestigungsteilen."],
  ["Двигун вентилятора конденсатора", "Двигун зовнішнього вентилятора відповідної потужності, обертів і напрямку, з кріпленням."],
  ["ਕੰਡੈਂਸਰ ਪੱਖਾ ਮੋਟਰ", "ਹਾਰਸਪਾਵਰ, RPM ਅਤੇ ਘੁੰਮਣ ਦੀ ਦਿਸ਼ਾ ਮੁਤਾਬਕ ਬਾਹਰੀ ਪੱਖਾ ਮੋਟਰ, ਫ਼ਿਟਿੰਗ ਸਮੇਤ।"],
  ["Condenser fan motor", "Outdoor fan motor na tugma sa horsepower, RPM at ikot, may kasamang pang-kabit."],
), { cost: 150, ...extra });
const FAN_BLADE = (extra = {}) => L.material(1, "each", 95, X(
  ["Condenser fan blade", "Replacement blade matched for diameter, pitch, bore and rotation."],
  ["Pale de ventilateur de condenseur", "Pale de remplacement assortie en diamètre, pas, alésage et sens de rotation."],
  ["Aspa del ventilador del condensador", "Aspa de reemplazo según diámetro, paso, barreno y giro."],
  ["Pala ventola condensatore", "Pala di ricambio adatta per diametro, passo, foro e senso di rotazione."],
  ["Verflüssiger-Lüfterflügel", "Ersatzflügel passend nach Durchmesser, Steigung, Bohrung und Drehrichtung."],
  ["Крильчатка вентилятора конденсатора", "Крильчатка на заміну відповідного діаметра, кроку, отвору й напрямку обертання."],
  ["ਕੰਡੈਂਸਰ ਪੱਖੇ ਦਾ ਬਲੇਡ", "ਵਿਆਸ, ਪਿੱਚ, ਬੋਰ ਅਤੇ ਘੁੰਮਣ ਦਿਸ਼ਾ ਮੁਤਾਬਕ ਬਦਲਵਾਂ ਬਲੇਡ।"],
  ["Condenser fan blade", "Kapalit na blade na tugma sa diameter, pitch, bore at ikot."],
), { cost: 60, ...extra });
const FAN_CAP = (extra = {}) => L.material(1, "each", 35, X(
  ["Fan run capacitor", "Single run capacitor sized to the new fan motor."],
  ["Condensateur de marche du ventilateur", "Condensateur de marche simple dimensionné pour le nouveau moteur."],
  ["Capacitor de marcha del ventilador", "Capacitor de marcha sencillo del valor del motor nuevo."],
  ["Condensatore di marcia ventola", "Condensatore di marcia singolo dimensionato per il nuovo motore."],
  ["Lüfter-Betriebskondensator", "Einfacher Betriebskondensator passend zum neuen Lüftermotor."],
  ["Робочий конденсатор вентилятора", "Одинарний робочий конденсатор під новий двигун вентилятора."],
  ["ਪੱਖੇ ਦਾ ਰਨ ਕੈਪੇਸਿਟਰ", "ਨਵੀਂ ਪੱਖਾ ਮੋਟਰ ਮੁਤਾਬਕ ਸਿੰਗਲ ਰਨ ਕੈਪੇਸਿਟਰ।"],
  ["Fan run capacitor", "Single run capacitor na tugma sa bagong fan motor."],
), { cost: 12, ...extra });
const COMBUSTION_TEST = (price = 75) => L.labour(1, "flat", price, X(
  ["Combustion and CO test", "Flue draft, combustion and carbon monoxide readings taken after the work, before the furnace is handed back."],
  ["Essai de combustion et de CO", "Tirage, combustion et monoxyde de carbone mesurés après les travaux, avant de remettre la fournaise en service."],
  ["Prueba de combustión y CO", "Tiro, combustión y monóxido de carbono medidos después del trabajo, antes de entregar el horno."],
  ["Prova di combustione e CO", "Tiraggio, combustione e monossido di carbonio misurati dopo il lavoro, prima di riconsegnare la caldaia ad aria."],
  ["Abgas- und CO-Messung", "Zug, Verbrennung und Kohlenmonoxid nach der Arbeit gemessen, bevor der Ofen übergeben wird."],
  ["Перевірка горіння й CO", "Тягу, горіння й чадний газ виміряно після робіт, перед передачею печі клієнту."],
  ["ਕੰਬਸ਼ਨ ਅਤੇ CO ਟੈਸਟ", "ਕੰਮ ਮਗਰੋਂ ਅਤੇ ਫ਼ਰਨੇਸ ਸੌਂਪਣ ਤੋਂ ਪਹਿਲਾਂ ਫ਼ਲੂ ਡ੍ਰਾਫ਼ਟ, ਕੰਬਸ਼ਨ ਅਤੇ ਕਾਰਬਨ ਮੋਨੋਆਕਸਾਈਡ ਮਾਪੇ।"],
  ["Combustion at CO test", "Sinukat ang draft, combustion at carbon monoxide pagkatapos ng trabaho, bago ibalik ang furnace."],
), { cost: Math.round(price * 0.5) });
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
const THERMOSTAT = (extra = {}) => L.material(1, "each", 95, X(
  ["Programmable thermostat", "Seven-day programmable thermostat for single-stage heat and cool, with wall plate."],
  ["Thermostat programmable", "Thermostat programmable sur sept jours pour chauffage et climatisation à un étage, avec plaque murale."],
  ["Termostato programable", "Termostato programable de siete días para calefacción y aire de una etapa, con placa de pared."],
  ["Termostato programmabile", "Termostato programmabile settimanale per caldo e freddo monostadio, con placca a muro."],
  ["Programmierbarer Thermostat", "7-Tage-Thermostat für einstufiges Heizen und Kühlen, mit Wandplatte."],
  ["Програмований термостат", "Тижневий програмований термостат для одноступеневого опалення й охолодження, з настінною пластиною."],
  ["ਪ੍ਰੋਗਰਾਮੇਬਲ ਥਰਮੋਸਟੈਟ", "ਸਿੰਗਲ-ਸਟੇਜ ਗਰਮ ਅਤੇ ਠੰਢ ਲਈ ਸੱਤ-ਦਿਨ ਪ੍ਰੋਗਰਾਮੇਬਲ ਥਰਮੋਸਟੈਟ, ਕੰਧ ਪਲੇਟ ਸਮੇਤ।"],
  ["Programmable thermostat", "Seven-day na programmable thermostat para sa single-stage na init at lamig, may wall plate."],
), { cost: REF("thermostat_basic").cost, ref: REF("thermostat_basic"), ...extra });

const ADDED = {
  // ── Blower ──
  "fq.hvac_repair.blower.replace_motor_module": A("repair", [
    DIAG(),
    L.labour(1, "flat", 250, X(
      ["ECM module replacement labour", "Power isolated, the motor tested to confirm the module is the fault, the new module fitted and programmed for the system, and airflow checked."],
      ["Main-d'œuvre — remplacement du module ECM", "Alimentation coupée, moteur testé pour confirmer que le module est en cause, nouveau module posé et programmé pour le système, débit vérifié."],
      ["Mano de obra — reemplazo del módulo ECM", "Energía aislada, el motor probado para confirmar que falla el módulo, el módulo nuevo colocado y programado para el sistema, y el flujo revisado."],
      ["Manodopera — sostituzione modulo ECM", "Alimentazione isolata, motore provato per confermare che il guasto è il modulo, nuovo modulo montato e programmato per l'impianto, portata verificata."],
      ["Arbeit — ECM-Modul tauschen", "Strom getrennt, Motor geprüft, um das Modul als Ursache zu bestätigen, neues Modul eingebaut und für die Anlage programmiert, Luftstrom geprüft."],
      ["Робота — заміна модуля ECM", "Живлення вимкнено, двигун перевірено, щоб підтвердити несправність модуля, новий модуль встановлено й запрограмовано, потік перевірено."],
      ["ECM ਮੋਡਿਊਲ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਬਿਜਲੀ ਬੰਦ, ਮੋਟਰ ਟੈਸਟ ਕਰਕੇ ਪੱਕਾ ਕੀਤਾ ਕਿ ਨੁਕਸ ਮੋਡਿਊਲ ਵਿੱਚ ਹੈ, ਨਵਾਂ ਮੋਡਿਊਲ ਲਾ ਕੇ ਸਿਸਟਮ ਲਈ ਪ੍ਰੋਗਰਾਮ ਕੀਤਾ ਅਤੇ ਹਵਾ ਜਾਂਚੀ।"],
      ["Labor — palit ng ECM module", "Pinatay ang kuryente, sinubukan ang motor para matiyak na module ang sira, ikinabit at pinrograma ang bagong module at chineck ang hangin."],
    )),
    L.material(1, "each", 420, X(
      ["ECM blower motor control module", "Programmed ECM module matched to the motor and the equipment model."],
      ["Module de commande de moteur ECM", "Module ECM programmé, assorti au moteur et au modèle de l'appareil."],
      ["Módulo de control del motor ECM", "Módulo ECM programado según el motor y el modelo del equipo."],
      ["Modulo di controllo motore ECM", "Modulo ECM programmato, abbinato al motore e al modello dell'apparecchio."],
      ["ECM-Motorsteuermodul", "Programmiertes ECM-Modul passend zu Motor und Gerätemodell."],
      ["Модуль керування двигуном ECM", "Запрограмований модуль ECM під двигун і модель обладнання."],
      ["ECM ਬਲੋਅਰ ਮੋਟਰ ਕੰਟਰੋਲ ਮੋਡਿਊਲ", "ਮੋਟਰ ਅਤੇ ਉਪਕਰਣ ਮਾਡਲ ਮੁਤਾਬਕ ਪ੍ਰੋਗਰਾਮ ਕੀਤਾ ECM ਮੋਡਿਊਲ।"],
      ["ECM blower motor control module", "Programmed na ECM module na tugma sa motor at model ng unit."],
    ), { cost: 315 }),
  ]),

  "fq.hvac_repair.blower.replace_wheel": A("repair", [
    L.labour(1, "flat", 240, X(
      ["Blower wheel replacement labour", "Blower assembly pulled, the old wheel pressed off the shaft, the new one set, centred and balanced, and the assembly refitted."],
      ["Main-d'œuvre — remplacement de la roue", "Ensemble ventilateur sorti, ancienne roue retirée de l'arbre, la neuve posée, centrée et équilibrée, ensemble remonté."],
      ["Mano de obra — reemplazo de la turbina", "Conjunto del ventilador retirado, turbina vieja sacada del eje, la nueva colocada, centrada y balanceada, y el conjunto reinstalado."],
      ["Manodopera — sostituzione girante", "Gruppo ventilatore estratto, vecchia girante sfilata dall'albero, la nuova montata, centrata e bilanciata, gruppo rimontato."],
      ["Arbeit — Gebläserad tauschen", "Gebläseeinheit ausgebaut, altes Rad von der Welle gezogen, das neue gesetzt, zentriert und ausgewuchtet, Einheit wieder eingebaut."],
      ["Робота — заміна крильчатки", "Вентиляторний вузол знято, стару крильчатку знято з валу, нову встановлено, відцентровано й збалансовано, вузол повернуто."],
      ["ਬਲੋਅਰ ਵ੍ਹੀਲ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਬਲੋਅਰ ਅਸੈਂਬਲੀ ਕੱਢੀ, ਪੁਰਾਣਾ ਵ੍ਹੀਲ ਸ਼ਾਫ਼ਟ ਤੋਂ ਉਤਾਰਿਆ, ਨਵਾਂ ਲਾ ਕੇ ਵਿਚਕਾਰ ਅਤੇ ਸੰਤੁਲਿਤ ਕੀਤਾ, ਅਤੇ ਮੁੜ ਫਿੱਟ ਕੀਤਾ।"],
      ["Labor — palit ng blower wheel", "Hinugot ang blower assembly, tinanggal ang lumang wheel sa shaft, ikinabit, sinentro at binalanse ang bago, at ibinalik ang assembly."],
    )),
    L.material(1, "each", 165, X(
      ["Blower wheel", "Squirrel-cage blower wheel matched for diameter, width, bore and rotation."],
      ["Roue de ventilateur", "Roue à cage d'écureuil assortie en diamètre, largeur, alésage et sens de rotation."],
      ["Turbina del ventilador", "Turbina tipo jaula de ardilla según diámetro, ancho, barreno y giro."],
      ["Girante del ventilatore", "Girante a gabbia di scoiattolo adatta per diametro, larghezza, foro e senso di rotazione."],
      ["Gebläserad", "Trommelläufer passend nach Durchmesser, Breite, Bohrung und Drehrichtung."],
      ["Крильчатка вентилятора", "Барабанна крильчатка відповідного діаметра, ширини, отвору й напрямку обертання."],
      ["ਬਲੋਅਰ ਵ੍ਹੀਲ", "ਵਿਆਸ, ਚੌੜਾਈ, ਬੋਰ ਅਤੇ ਘੁੰਮਣ ਦਿਸ਼ਾ ਮੁਤਾਬਕ ਸਕੁਇਰਲ-ਕੇਜ ਬਲੋਅਰ ਵ੍ਹੀਲ।"],
      ["Blower wheel", "Squirrel-cage na blower wheel na tugma sa diameter, lapad, bore at ikot."],
    ), { cost: 110 }),
  ]),

  "fq.hvac_repair.blower.clean_motor": A("maintenance", [
    L.labour(1, "flat", 320, X(
      ["Blower assembly pull and clean", "Blower assembly removed, the wheel, motor and housing degreased and washed, dried and reinstalled."],
      ["Dépose et nettoyage de l'ensemble ventilateur", "Ensemble ventilateur retiré, roue, moteur et boîtier dégraissés et lavés, séchés puis remontés."],
      ["Desmontaje y limpieza del conjunto del ventilador", "Conjunto del ventilador retirado, turbina, motor y carcasa desengrasados y lavados, secados y reinstalados."],
      ["Smontaggio e pulizia del gruppo ventilatore", "Gruppo ventilatore rimosso, girante, motore e chiocciola sgrassati e lavati, asciugati e rimontati."],
      ["Gebläseeinheit ausbauen und reinigen", "Gebläseeinheit ausgebaut, Rad, Motor und Gehäuse entfettet und gewaschen, getrocknet und wieder eingebaut."],
      ["Зняття й чищення вентиляторного вузла", "Вузол знято, крильчатку, двигун і корпус знежирено й вимито, висушено й встановлено назад."],
      ["ਬਲੋਅਰ ਅਸੈਂਬਲੀ ਕੱਢ ਕੇ ਸਫ਼ਾਈ", "ਬਲੋਅਰ ਅਸੈਂਬਲੀ ਕੱਢੀ, ਵ੍ਹੀਲ, ਮੋਟਰ ਅਤੇ ਹਾਊਸਿੰਗ ਦੀ ਚਿਕਨਾਈ ਲਾਹ ਕੇ ਧੋਤੇ, ਸੁਕਾ ਕੇ ਮੁੜ ਲਾਏ।"],
      ["Paghugot at paglinis ng blower assembly", "Tinanggal ang blower assembly, dinegrease at hinugasan ang wheel, motor at housing, pinatuyo at ibinalik."],
    )),
    L.material(1, "flat", 35, X(
      ["Coil-safe degreaser and cleaning supplies", "Non-acid degreaser, brushes and rags for one blower assembly."],
      ["Dégraissant sans danger et fournitures de nettoyage", "Dégraissant sans acide, brosses et chiffons pour un ensemble ventilateur."],
      ["Desengrasante seguro y material de limpieza", "Desengrasante sin ácido, cepillos y trapos para un conjunto de ventilador."],
      ["Sgrassante delicato e materiale di pulizia", "Sgrassante senza acidi, spazzole e stracci per un gruppo ventilatore."],
      ["Schonender Entfetter und Reinigungsmaterial", "Säurefreier Entfetter, Bürsten und Lappen für eine Gebläseeinheit."],
      ["Безпечний знежирювач і засоби для чищення", "Безкислотний знежирювач, щітки й ганчірки на один вузол."],
      ["ਸੁਰੱਖਿਅਤ ਡੀਗ੍ਰੀਜ਼ਰ ਅਤੇ ਸਫ਼ਾਈ ਸਮਾਨ", "ਇੱਕ ਬਲੋਅਰ ਅਸੈਂਬਲੀ ਲਈ ਬਿਨਾਂ-ਤੇਜ਼ਾਬ ਡੀਗ੍ਰੀਜ਼ਰ, ਬੁਰਸ਼ ਅਤੇ ਕੱਪੜੇ।"],
      ["Degreaser at panlinis", "Non-acid na degreaser, brush at basahan para sa isang blower assembly."],
    ), { cost: 20 }),
    L.labour(1, "flat", 50, X(
      ["Airflow and amp-draw check", "After reassembly the motor's amp draw and the static pressure are read against the rating."],
      ["Vérification du débit et de l'ampérage", "Après remontage, ampérage du moteur et pression statique relevés et comparés aux valeurs nominales."],
      ["Revisión de flujo y amperaje", "Después de armar, el amperaje del motor y la presión estática se leen contra los valores nominales."],
      ["Controllo portata e assorbimento", "Dopo il rimontaggio si leggono assorbimento del motore e pressione statica rispetto ai valori di targa."],
      ["Luftstrom- und Stromaufnahmeprüfung", "Nach dem Einbau Motorstrom und statischer Druck gegen die Nennwerte gemessen."],
      ["Перевірка потоку й струму", "Після збирання струм двигуна й статичний тиск звірено з номіналом."],
      ["ਹਵਾ ਅਤੇ ਐਂਪ ਜਾਂਚ", "ਮੁੜ ਜੋੜਨ ਮਗਰੋਂ ਮੋਟਰ ਦੇ ਐਂਪ ਅਤੇ ਸਟੈਟਿਕ ਪ੍ਰੈਸ਼ਰ ਰੇਟਿੰਗ ਨਾਲ ਮਿਲਾਏ।"],
      ["Check ng airflow at amp draw", "Pagkatapos ibalik, binasa ang amp draw ng motor at static pressure laban sa rating."],
    )),
  ]),

  "fq.hvac_repair.blower.evaporator_motor": A("repair", [
    DIAG(),
    L.labour(1, "flat", 260, X(
      ["Evaporator fan motor labour", "The old motor unbolted and unwired, the new one mounted, wired to its capacitor or control and run under load."],
      ["Main-d'œuvre — moteur de ventilateur d'évaporateur", "Ancien moteur déboulonné et débranché, le neuf fixé, raccordé à son condensateur ou à sa commande et testé en charge."],
      ["Mano de obra — motor del ventilador del evaporador", "Motor viejo desatornillado y desconectado, el nuevo montado, conectado a su capacitor o control y probado con carga."],
      ["Manodopera — motore ventola evaporatore", "Vecchio motore sbullonato e scollegato, il nuovo montato, collegato al condensatore o al controllo e provato sotto carico."],
      ["Arbeit — Verdampfer-Lüftermotor", "Alter Motor abgeschraubt und abgeklemmt, der neue montiert, an Kondensator oder Steuerung angeschlossen und unter Last getestet."],
      ["Робота — двигун вентилятора випарника", "Старий двигун відкручено й від'єднано, новий змонтовано, під'єднано до конденсатора чи керування й перевірено під навантаженням."],
      ["ਇਵੈਪੋਰੇਟਰ ਪੱਖਾ ਮੋਟਰ ਦੀ ਲੇਬਰ", "ਪੁਰਾਣੀ ਮੋਟਰ ਖੋਲ੍ਹ ਕੇ ਕੱਢੀ, ਨਵੀਂ ਲਾ ਕੇ ਕੈਪੇਸਿਟਰ ਜਾਂ ਕੰਟਰੋਲ ਨਾਲ ਜੋੜੀ ਅਤੇ ਲੋਡ 'ਤੇ ਚਲਾਈ।"],
      ["Labor — evaporator fan motor", "Tinanggal ang lumang motor, ikinabit ang bago, ikinonekta sa capacitor o control at pinaandar nang may load."],
    )),
    L.material(1, "each", 380, X(
      ["Evaporator fan motor", "PSC or ECM indoor fan motor matched to the equipment, with a new run capacitor where it takes one."],
      ["Moteur de ventilateur d'évaporateur", "Moteur intérieur PSC ou ECM assorti à l'appareil, avec condensateur neuf s'il en prend un."],
      ["Motor del ventilador del evaporador", "Motor interior PSC o ECM según el equipo, con capacitor nuevo si lo lleva."],
      ["Motore ventola evaporatore", "Motore interno PSC o ECM adatto all'apparecchio, con condensatore nuovo se previsto."],
      ["Verdampfer-Lüftermotor", "PSC- oder ECM-Innenmotor passend zum Gerät, mit neuem Betriebskondensator, wo nötig."],
      ["Двигун вентилятора випарника", "Внутрішній двигун PSC або ECM під обладнання, з новим конденсатором, якщо потрібен."],
      ["ਇਵੈਪੋਰੇਟਰ ਪੱਖਾ ਮੋਟਰ", "ਉਪਕਰਣ ਮੁਤਾਬਕ PSC ਜਾਂ ECM ਅੰਦਰਲੀ ਪੱਖਾ ਮੋਟਰ, ਲੋੜ ਹੋਵੇ ਤਾਂ ਨਵੇਂ ਕੈਪੇਸਿਟਰ ਸਮੇਤ।"],
      ["Evaporator fan motor", "PSC o ECM na indoor fan motor na tugma sa unit, may bagong capacitor kung kailangan."],
    ), { cost: 285 }),
  ]),

  // ── Indoor air quality ──
  "fq.hvac_repair.air_quality.air_quality_visit": A("inspection", [
    L.labour(1, "flat", 129, X(
      ["Indoor air quality assessment", "Humidity, particulates and CO₂ measured room by room, the filter and ventilation checked and the source of the complaint found."],
      ["Évaluation de la qualité de l'air intérieur", "Humidité, particules et CO₂ mesurés pièce par pièce, filtre et ventilation vérifiés, source du problème trouvée."],
      ["Evaluación de la calidad del aire interior", "Humedad, partículas y CO₂ medidos cuarto por cuarto, filtro y ventilación revisados y encontrada la causa de la queja."],
      ["Valutazione della qualità dell'aria interna", "Umidità, particolato e CO₂ misurati stanza per stanza, filtro e ventilazione controllati, causa del problema trovata."],
      ["Bewertung der Raumluftqualität", "Feuchte, Feinstaub und CO₂ Raum für Raum gemessen, Filter und Lüftung geprüft und die Ursache der Beschwerde gefunden."],
      ["Оцінка якості повітря в приміщенні", "Вологість, частки й CO₂ виміряно в кожній кімнаті, фільтр і вентиляцію перевірено, джерело скарги знайдено."],
      ["ਅੰਦਰਲੀ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਜਾਂਚ", "ਕਮਰਾ-ਦਰ-ਕਮਰਾ ਨਮੀ, ਕਣ ਅਤੇ CO₂ ਮਾਪੇ, ਫ਼ਿਲਟਰ ਅਤੇ ਹਵਾਦਾਰੀ ਜਾਂਚੀ ਅਤੇ ਸ਼ਿਕਾਇਤ ਦਾ ਕਾਰਨ ਲੱਭਿਆ।"],
      ["Pagsusuri ng kalidad ng hangin sa loob", "Sinukat kuwarto-kuwarto ang humidity, alikabok at CO₂, chineck ang filter at bentilasyon at hinanap ang pinagmulan ng reklamo."],
    ), { cost: 65 }),
    SHARED.report(35),
  ]),

  "fq.hvac_repair.air_quality.duct_cleaning_visit": A("maintenance", [
    L.labour(1, "flat", 550, X(
      ["Whole-system duct cleaning", "Negative-air machine on the trunk, the supply and return ducts agitated and vacuumed, and the blower compartment cleaned."],
      ["Nettoyage complet des conduits", "Aspirateur à pression négative sur le conduit principal, conduits d'alimentation et de retour agités et aspirés, compartiment du ventilateur nettoyé."],
      ["Limpieza completa de ductos", "Máquina de presión negativa en el troncal, ductos de suministro y retorno agitados y aspirados, y el compartimiento del ventilador limpiado."],
      ["Pulizia completa dei condotti", "Aspiratore a pressione negativa sul condotto principale, condotti di mandata e ripresa spazzolati e aspirati, vano ventilatore pulito."],
      ["Komplette Kanalreinigung", "Unterdruckgerät am Hauptkanal, Zu- und Rückluftkanäle abgebürstet und gesaugt, Gebläseraum gereinigt."],
      ["Повне чищення повітроводів", "Установка негативного тиску на магістралі, припливні й зворотні повітроводи прочищено й пропилососено, відсік вентилятора очищено."],
      ["ਪੂਰੇ ਸਿਸਟਮ ਦੀ ਡਕਟ ਸਫ਼ਾਈ", "ਮੁੱਖ ਡਕਟ 'ਤੇ ਨੈਗੇਟਿਵ-ਏਅਰ ਮਸ਼ੀਨ, ਸਪਲਾਈ ਅਤੇ ਰਿਟਰਨ ਡਕਟ ਹਿਲਾ ਕੇ ਵੈਕਿਊਮ, ਅਤੇ ਬਲੋਅਰ ਖਾਨਾ ਸਾਫ਼।"],
      ["Paglilinis ng buong duct system", "Negative-air machine sa trunk, kinalog at binakyum ang supply at return duct, at nilinis ang blower compartment."],
    )),
    VENT(), RETURN(),
    SHARED.protect(45),
  ]),

  // ── Controls ──
  "fq.hvac_repair.controls.thermostat_visit": A("repair", [
    SHARED.serviceCall(89, { cost: 45 }),
    L.labour(1, "flat", 95, X(
      ["Thermostat repair or swap labour", "Wiring and batteries checked, the thermostat recalibrated or replaced, and a full heat and cool call run from it."],
      ["Main-d'œuvre — réparation ou remplacement du thermostat", "Câblage et piles vérifiés, thermostat recalibré ou remplacé, cycle complet de chauffage et de climatisation lancé depuis celui-ci."],
      ["Mano de obra — reparación o cambio de termostato", "Cableado y baterías revisados, termostato recalibrado o reemplazado, y un ciclo completo de calor y frío lanzado desde él."],
      ["Manodopera — riparazione o sostituzione termostato", "Cablaggio e batterie controllati, termostato ricalibrato o sostituito, ciclo completo di caldo e freddo avviato da esso."],
      ["Arbeit — Thermostat reparieren oder tauschen", "Verkabelung und Batterien geprüft, Thermostat neu kalibriert oder ersetzt, ein voller Heiz- und Kühlaufruf gefahren."],
      ["Робота — ремонт або заміна термостата", "Проводку й батареї перевірено, термостат відкалібровано чи замінено, повний цикл опалення й охолодження запущено з нього."],
      ["ਥਰਮੋਸਟੈਟ ਮੁਰੰਮਤ ਜਾਂ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਤਾਰਾਂ ਅਤੇ ਬੈਟਰੀਆਂ ਜਾਂਚੀਆਂ, ਥਰਮੋਸਟੈਟ ਮੁੜ ਕੈਲੀਬ੍ਰੇਟ ਜਾਂ ਬਦਲਿਆ, ਅਤੇ ਇਸ ਤੋਂ ਪੂਰਾ ਗਰਮ ਅਤੇ ਠੰਢਾ ਚੱਕਰ ਚਲਾਇਆ।"],
      ["Labor — ayos o palit ng thermostat", "Chineck ang wiring at baterya, kinalibrate o pinalitan ang thermostat, at pinatakbo mula rito ang buong heat at cool."],
    )),
    THERMOSTAT({ optional: true }),
  ]),

  // ── Coils ──
  "fq.hvac_repair.coils.chemical_clean": A("maintenance", [
    L.labour(1, "flat", 220, X(
      ["Chemical coil cleaning labour", "Panels off, foaming cleaner applied and left to work, then the coil rinsed through until it runs clear and the drain checked."],
      ["Main-d'œuvre — nettoyage chimique du serpentin", "Panneaux retirés, nettoyant moussant appliqué et laissé agir, serpentin rincé jusqu'à eau claire et drain vérifié."],
      ["Mano de obra — limpieza química del serpentín", "Paneles fuera, limpiador espumoso aplicado y dejado actuar, luego el serpentín enjuagado hasta salir limpio y el drenaje revisado."],
      ["Manodopera — pulizia chimica della batteria", "Pannelli tolti, detergente schiumogeno applicato e lasciato agire, poi batteria risciacquata fino ad acqua limpida e scarico verificato."],
      ["Arbeit — chemische Registerreinigung", "Verkleidung ab, Schaumreiniger aufgetragen und einwirken lassen, Register klar gespült und Ablauf geprüft."],
      ["Робота — хімічне чищення теплообмінника", "Панелі знято, пінний засіб нанесено й витримано, потім теплообмінник промито до чистої води, дренаж перевірено."],
      ["ਕੈਮੀਕਲ ਕੋਇਲ ਸਫ਼ਾਈ ਦੀ ਲੇਬਰ", "ਪੈਨਲ ਉਤਾਰੇ, ਝੱਗ ਵਾਲਾ ਕਲੀਨਰ ਲਾ ਕੇ ਛੱਡਿਆ, ਫਿਰ ਕੋਇਲ ਸਾਫ਼ ਪਾਣੀ ਆਉਣ ਤੱਕ ਧੋਤੀ ਅਤੇ ਡ੍ਰੇਨ ਜਾਂਚਿਆ।"],
      ["Labor — chemical na paglinis ng coil", "Tinanggal ang panel, nilagyan ng foaming cleaner at pinababad, tapos binanlawan ang coil hanggang lumiwanag ang tubig at chineck ang drain."],
    )),
    L.material(1, "flat", 35, X(
      ["Foaming coil cleaner", "Coil-safe foaming cleaner, one system."],
      ["Nettoyant moussant pour serpentin", "Nettoyant moussant sans danger pour le serpentin, un système."],
      ["Limpiador espumoso de serpentín", "Limpiador espumoso seguro para serpentín, un sistema."],
      ["Detergente schiumogeno per batterie", "Detergente schiumogeno sicuro per batterie, un impianto."],
      ["Schaum-Registerreiniger", "Registerschonender Schaumreiniger, ein System."],
      ["Пінний засіб для теплообмінника", "Безпечний пінний засіб, одна система."],
      ["ਝੱਗ ਵਾਲਾ ਕੋਇਲ ਕਲੀਨਰ", "ਕੋਇਲ ਲਈ ਸੁਰੱਖਿਅਤ ਝੱਗ ਵਾਲਾ ਕਲੀਨਰ, ਇੱਕ ਸਿਸਟਮ।"],
      ["Foaming coil cleaner", "Foaming cleaner na ligtas sa coil, isang sistema."],
    ), { cost: 18 }),
    L.labour(1, "flat", 60, X(
      ["Fin straightening", "Bent fins combed straight so air passes through the whole face of the coil."],
      ["Redressage des ailettes", "Ailettes pliées peignées pour que l'air traverse toute la surface du serpentin."],
      ["Enderezado de aletas", "Aletas dobladas peinadas para que el aire pase por toda la cara del serpentín."],
      ["Raddrizzatura alette", "Alette piegate pettinate così l'aria passa su tutta la superficie della batteria."],
      ["Lamellen richten", "Verbogene Lamellen gekämmt, damit Luft durch die ganze Registerfläche strömt."],
      ["Вирівнювання ламелей", "Зігнуті ламелі розчесано, щоб повітря проходило всією площею."],
      ["ਫ਼ਿਨ ਸਿੱਧੇ ਕਰਨਾ", "ਮੁੜੇ ਫ਼ਿਨ ਕੰਘੀ ਨਾਲ ਸਿੱਧੇ ਕੀਤੇ ਤਾਂ ਜੋ ਹਵਾ ਪੂਰੀ ਕੋਇਲ ਵਿੱਚੋਂ ਲੰਘੇ।"],
      ["Pag-ayos ng fins", "Sinuklay pantay ang baluktot na fins para dumaan ang hangin sa buong coil."],
    ), { optional: true }),
  ]),

  "fq.hvac_repair.coils.replace": A("repair", [
    L.labour(1, "flat", 900, X(
      ["Coil replacement labour", "Refrigerant recovered, the failed coil cut out and the new one brazed in under nitrogen, pressure-tested, evacuated and recharged."],
      ["Main-d'œuvre — remplacement du serpentin", "Frigorigène récupéré, serpentin défectueux coupé, le neuf brasé sous azote, essai de pression, tirage au vide et recharge."],
      ["Mano de obra — reemplazo del serpentín", "Refrigerante recuperado, serpentín dañado cortado y el nuevo soldado con nitrógeno, prueba de presión, vacío y recarga."],
      ["Manodopera — sostituzione batteria", "Refrigerante recuperato, batteria guasta tagliata e la nuova brasata sotto azoto, prova di pressione, vuoto e ricarica."],
      ["Arbeit — Registertausch", "Kältemittel abgesaugt, defektes Register ausgetrennt, das neue unter Stickstoff eingelötet, abgedrückt, evakuiert und befüllt."],
      ["Робота — заміна теплообмінника", "Холодоагент відкачано, несправний теплообмінник вирізано, новий упаяно під азотом, опресовано, відвакуумовано й заправлено."],
      ["ਕੋਇਲ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਖ਼ਰਾਬ ਕੋਇਲ ਕੱਟੀ ਅਤੇ ਨਵੀਂ ਨਾਈਟ੍ਰੋਜਨ ਹੇਠ ਬ੍ਰੇਜ਼ ਕੀਤੀ, ਪ੍ਰੈਸ਼ਰ ਟੈਸਟ, ਵੈਕਿਊਮ ਅਤੇ ਰੀਚਾਰਜ।"],
      ["Labor — palit ng coil", "Na-recover ang refrigerant, tinanggal ang sirang coil at binraze ang bago sa ilalim ng nitrogen, pressure test, vacuum at recharge."],
    )),
    L.material(1, "each", 950, X(
      ["Replacement coil", "Evaporator or condenser coil matched to the system's tonnage, refrigerant and cabinet."],
      ["Serpentin de remplacement", "Serpentin d'évaporateur ou de condenseur assorti au tonnage, au frigorigène et au boîtier du système."],
      ["Serpentín de reemplazo", "Serpentín de evaporador o condensador según el tonelaje, refrigerante y gabinete del sistema."],
      ["Batteria di ricambio", "Batteria evaporante o condensante adatta a tonnellaggio, refrigerante e mobile dell'impianto."],
      ["Ersatzregister", "Verdampfer- oder Verflüssigerregister passend zu Leistung, Kältemittel und Gehäuse der Anlage."],
      ["Теплообмінник на заміну", "Випарник чи конденсатор під потужність, холодоагент і корпус системи."],
      ["ਬਦਲਵੀਂ ਕੋਇਲ", "ਸਿਸਟਮ ਦੇ ਟਨ, ਰੈਫ਼ਰੀਜਰੈਂਟ ਅਤੇ ਕੈਬਿਨੇਟ ਮੁਤਾਬਕ ਇਵੈਪੋਰੇਟਰ ਜਾਂ ਕੰਡੈਂਸਰ ਕੋਇਲ।"],
      ["Kapalit na coil", "Evaporator o condenser coil na tugma sa tonelada, refrigerant at cabinet ng sistema."],
    ), { cost: 710, taxable: false }),
    BRAZE(),
    R410(4),
  ], MECH),

  "fq.hvac_repair.coils.protective_coating": A("maintenance", [
    L.labour(1, "flat", 95, X(
      ["Coil cleaning before coating", "The coil washed and dried so the coating bonds to bare metal."],
      ["Nettoyage du serpentin avant l'enduit", "Serpentin lavé et séché pour que l'enduit adhère au métal nu."],
      ["Limpieza del serpentín antes del recubrimiento", "Serpentín lavado y secado para que el recubrimiento se adhiera al metal limpio."],
      ["Pulizia della batteria prima del rivestimento", "Batteria lavata e asciugata perché il rivestimento aderisca al metallo nudo."],
      ["Registerreinigung vor der Beschichtung", "Register gewaschen und getrocknet, damit die Beschichtung auf blankem Metall haftet."],
      ["Чищення теплообмінника перед покриттям", "Теплообмінник вимито й висушено, щоб покриття лягло на чистий метал."],
      ["ਕੋਟਿੰਗ ਤੋਂ ਪਹਿਲਾਂ ਕੋਇਲ ਸਫ਼ਾਈ", "ਕੋਇਲ ਧੋ ਕੇ ਸੁਕਾਈ ਤਾਂ ਜੋ ਕੋਟਿੰਗ ਸਾਫ਼ ਧਾਤ 'ਤੇ ਚਿਪਕੇ।"],
      ["Paglinis ng coil bago mag-coat", "Hinugasan at pinatuyo ang coil para kumapit ang coating sa malinis na metal."],
    )),
    L.labour(1, "flat", 280, X(
      ["Coil coating application", "Protective coating sprayed evenly through both faces of the coil and left to cure before start-up."],
      ["Application de l'enduit sur le serpentin", "Enduit protecteur pulvérisé uniformément sur les deux faces du serpentin et laissé durcir avant le démarrage."],
      ["Aplicación del recubrimiento", "Recubrimiento protector rociado parejo por ambas caras del serpentín y dejado curar antes de arrancar."],
      ["Applicazione del rivestimento", "Rivestimento protettivo spruzzato in modo uniforme su entrambe le facce e lasciato indurire prima dell'avvio."],
      ["Beschichtung auftragen", "Schutzbeschichtung gleichmäßig durch beide Registerseiten gesprüht und vor dem Start ausgehärtet."],
      ["Нанесення покриття", "Захисне покриття рівномірно розпилено з обох боків і витримано до запуску."],
      ["ਕੋਇਲ ਕੋਟਿੰਗ ਲਾਉਣਾ", "ਕੋਇਲ ਦੇ ਦੋਵੇਂ ਪਾਸਿਆਂ ਬਰਾਬਰ ਸੁਰੱਖਿਆ ਕੋਟਿੰਗ ਛਿੜਕੀ ਅਤੇ ਚਾਲੂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਸੁੱਕਣ ਦਿੱਤੀ।"],
      ["Paglagay ng coating sa coil", "Pantay na ini-spray ang protective coating sa magkabilang mukha ng coil at pinatuyo bago paandarin."],
    )),
    L.material(1, "flat", 110, X(
      ["Coil protective coating", "Anti-corrosion coil coating, enough for one coil."],
      ["Enduit protecteur pour serpentin", "Enduit anticorrosion pour serpentin, pour un serpentin."],
      ["Recubrimiento protector para serpentín", "Recubrimiento anticorrosivo para un serpentín."],
      ["Rivestimento protettivo per batterie", "Rivestimento anticorrosione, sufficiente per una batteria."],
      ["Register-Schutzbeschichtung", "Korrosionsschutz für ein Register."],
      ["Захисне покриття для теплообмінника", "Антикорозійне покриття на один теплообмінник."],
      ["ਕੋਇਲ ਸੁਰੱਖਿਆ ਕੋਟਿੰਗ", "ਇੱਕ ਕੋਇਲ ਲਈ ਜੰਗ-ਰੋਧਕ ਕੋਟਿੰਗ।"],
      ["Coil protective coating", "Anti-corrosion na coating para sa isang coil."],
    ), { cost: 70 }),
  ]),

  "fq.hvac_repair.coils.repair": A("repair", [
    L.labour(1, "flat", 280, X(
      ["Coil leak repair — braze and pressure test", "Refrigerant recovered, the leak brazed or the damaged section capped, and the coil held under nitrogen to prove it."],
      ["Réparation de fuite du serpentin — brasage et essai", "Frigorigène récupéré, fuite brasée ou section abîmée obturée, serpentin mis sous azote pour le prouver."],
      ["Reparación de fuga del serpentín — soldadura y prueba", "Refrigerante recuperado, fuga soldada o tramo dañado taponado, y el serpentín puesto a presión con nitrógeno para comprobarlo."],
      ["Riparazione perdita batteria — brasatura e prova", "Refrigerante recuperato, perdita brasata o tratto danneggiato chiuso, batteria messa sotto azoto per verificarla."],
      ["Registerleck reparieren — löten und abdrücken", "Kältemittel abgesaugt, Leck gelötet oder beschädigter Abschnitt verschlossen, Register unter Stickstoff geprüft."],
      ["Ремонт витоку теплообмінника — пайка й опресування", "Холодоагент відкачано, витік запаяно чи пошкоджену ділянку заглушено, теплообмінник перевірено азотом."],
      ["ਕੋਇਲ ਲੀਕ ਮੁਰੰਮਤ — ਬ੍ਰੇਜ਼ ਅਤੇ ਪ੍ਰੈਸ਼ਰ ਟੈਸਟ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਲੀਕ ਬ੍ਰੇਜ਼ ਕੀਤੀ ਜਾਂ ਖ਼ਰਾਬ ਹਿੱਸਾ ਬੰਦ ਕੀਤਾ, ਅਤੇ ਨਾਈਟ੍ਰੋਜਨ ਨਾਲ ਪੱਕਾ ਕੀਤਾ।"],
      ["Pag-ayos ng tagas sa coil — braze at pressure test", "Na-recover ang refrigerant, binraze ang tagas o tinakpan ang sirang bahagi, at pinatunayan sa nitrogen."],
    )),
    BRAZE(),
    R410(2),
  ]),

  "fq.hvac_repair.coils.evaporator_install": A("installation", [
    L.labour(1, "flat", 650, X(
      ["Evaporator coil installation labour", "Coil set on the furnace or in the air handler, line set brazed, drain and expansion device connected, evacuated and charged."],
      ["Main-d'œuvre — installation du serpentin d'évaporateur", "Serpentin posé sur la fournaise ou dans l'appareil de traitement d'air, conduites brasées, drain et détendeur raccordés, tirage au vide et charge."],
      ["Mano de obra — instalación del serpentín evaporador", "Serpentín colocado sobre el horno o en el manejador de aire, tubería soldada, drenaje y válvula de expansión conectados, vacío y carga."],
      ["Manodopera — posa batteria evaporante", "Batteria posata sul generatore o nell'unità di trattamento aria, linee brasate, scarico e organo di espansione collegati, vuoto e carica."],
      ["Arbeit — Verdampferregister einbauen", "Register auf den Ofen oder ins Lüftungsgerät gesetzt, Leitungen gelötet, Ablauf und Expansionsorgan angeschlossen, evakuiert und befüllt."],
      ["Робота — монтаж випарника", "Випарник встановлено на піч чи в повітрообробник, трасу впаяно, дренаж і розширювальний пристрій під'єднано, відвакуумовано й заправлено."],
      ["ਇਵੈਪੋਰੇਟਰ ਕੋਇਲ ਲਾਉਣ ਦੀ ਲੇਬਰ", "ਕੋਇਲ ਫ਼ਰਨੇਸ ਉੱਤੇ ਜਾਂ ਏਅਰ ਹੈਂਡਲਰ ਵਿੱਚ ਰੱਖੀ, ਲਾਈਨ ਸੈੱਟ ਬ੍ਰੇਜ਼, ਡ੍ਰੇਨ ਅਤੇ ਐਕਸਪੈਂਸ਼ਨ ਡਿਵਾਈਸ ਜੋੜੇ, ਵੈਕਿਊਮ ਅਤੇ ਚਾਰਜ।"],
      ["Labor — pagkabit ng evaporator coil", "Inilagay ang coil sa furnace o sa air handler, binraze ang line set, ikinonekta ang drain at expansion device, vinacuum at chinarge."],
    )),
    hdMaterial(REF("evap_coil_5t"), X(
      ["Cased evaporator coil", "Upflow cased evaporator coil sized to the condenser, up to 5 tons."],
      ["Serpentin d'évaporateur en boîtier", "Serpentin d'évaporateur en boîtier à flux ascendant, dimensionné pour le condenseur, jusqu'à 5 tonnes."],
      ["Serpentín evaporador con gabinete", "Serpentín evaporador con gabinete de flujo ascendente, del tamaño del condensador, hasta 5 toneladas."],
      ["Batteria evaporante con cassa", "Batteria evaporante con cassa a flusso verticale, dimensionata sul condensatore, fino a 5 tonnellate."],
      ["Verdampferregister im Gehäuse", "Aufwärtsströmendes Verdampferregister im Gehäuse, passend zum Verflüssiger, bis 5 Tonnen."],
      ["Випарник у корпусі", "Випарник у корпусі з висхідним потоком, під конденсатор, до 5 тонн."],
      ["ਕੇਸ ਵਾਲੀ ਇਵੈਪੋਰੇਟਰ ਕੋਇਲ", "ਕੰਡੈਂਸਰ ਮੁਤਾਬਕ ਅੱਪਫ਼ਲੋ ਕੇਸ ਵਾਲੀ ਇਵੈਪੋਰੇਟਰ ਕੋਇਲ, 5 ਟਨ ਤੱਕ।"],
      ["Cased evaporator coil", "Upflow na cased evaporator coil na tugma sa condenser, hanggang 5 tonelada."],
    ), { price: 1050 }),
    BRAZE(65, 45),
    R410(3),
  ], MECH),

  // ── Compressor ──
  "fq.hvac_repair.compressor.replace": A("repair", [COMPRESSOR_LABOUR(700), COMPRESSOR(950, 700), BRAZE(75, 50), R410(4)], MECH),

  "fq.hvac_repair.compressor.repair": A("repair", [
    DIAG(),
    L.labour(1, "flat", 450, X(
      ["Compressor repair labour", "Windings and start circuit tested, the failed start components or terminal replaced, leaks fixed and the compressor run to full load."],
      ["Main-d'œuvre — réparation du compresseur", "Enroulements et circuit de démarrage testés, composants de démarrage ou bornier défectueux remplacés, fuites réparées, compresseur mis en pleine charge."],
      ["Mano de obra — reparación del compresor", "Devanados y circuito de arranque probados, componentes de arranque o terminal dañados reemplazados, fugas reparadas y el compresor llevado a carga plena."],
      ["Manodopera — riparazione compressore", "Avvolgimenti e circuito di avvio provati, componenti di avvio o morsettiera guasti sostituiti, perdite riparate e compressore portato a pieno carico."],
      ["Arbeit — Verdichterreparatur", "Wicklungen und Anlaufkreis geprüft, defekte Anlaufteile oder Klemmen ersetzt, Lecks behoben und der Verdichter unter Volllast gefahren."],
      ["Робота — ремонт компресора", "Обмотки й пусковий ланцюг перевірено, несправні пускові елементи чи клеми замінено, витоки усунено, компресор виведено на повне навантаження."],
      ["ਕੰਪ੍ਰੈਸਰ ਮੁਰੰਮਤ ਦੀ ਲੇਬਰ", "ਵਾਇੰਡਿੰਗ ਅਤੇ ਸਟਾਰਟ ਸਰਕਟ ਟੈਸਟ, ਖ਼ਰਾਬ ਸਟਾਰਟ ਪੁਰਜ਼ੇ ਜਾਂ ਟਰਮੀਨਲ ਬਦਲੇ, ਲੀਕ ਠੀਕ ਅਤੇ ਕੰਪ੍ਰੈਸਰ ਪੂਰੇ ਲੋਡ 'ਤੇ ਚਲਾਇਆ।"],
      ["Labor — pag-ayos ng compressor", "Sinubukan ang winding at start circuit, pinalitan ang sirang start parts o terminal, inayos ang tagas at pinaandar nang full load ang compressor."],
    )),
    L.material(1, "flat", 180, X(
      ["Start components — capacitor, contactor and relay", "The start and run parts the compressor's circuit needs, matched to its rating."],
      ["Composants de démarrage — condensateur, contacteur et relais", "Pièces de démarrage et de marche du circuit du compresseur, assorties à ses valeurs nominales."],
      ["Componentes de arranque — capacitor, contactor y relevador", "Las piezas de arranque y marcha que requiere el circuito del compresor, según su capacidad."],
      ["Componenti di avvio — condensatore, contattore e relè", "I pezzi di avvio e marcia del circuito del compressore, adatti ai suoi valori."],
      ["Anlaufteile — Kondensator, Schütz und Relais", "Die Anlauf- und Betriebsteile des Verdichterkreises, passend zu seinen Nennwerten."],
      ["Пускові елементи — конденсатор, контактор і реле", "Пускові й робочі деталі для ланцюга компресора відповідного номіналу."],
      ["ਸਟਾਰਟ ਪੁਰਜ਼ੇ — ਕੈਪੇਸਿਟਰ, ਕੌਂਟੈਕਟਰ ਅਤੇ ਰੀਲੇਅ", "ਕੰਪ੍ਰੈਸਰ ਸਰਕਟ ਲਈ ਲੋੜੀਂਦੇ ਸਟਾਰਟ ਅਤੇ ਰਨ ਪੁਰਜ਼ੇ, ਉਸਦੀ ਰੇਟਿੰਗ ਮੁਤਾਬਕ।"],
      ["Start parts — capacitor, contactor at relay", "Ang start at run parts na kailangan ng circuit ng compressor, tugma sa rating."],
    ), { cost: 110 }),
    R410(2),
  ]),

  "fq.hvac_repair.compressor.acid_test": A("inspection", [
    L.labour(1, "flat", 75, X(
      ["Refrigerant acid test", "An oil or refrigerant sample drawn from the system and tested, with the reading and what it means written on the ticket."],
      ["Test d'acidité du frigorigène", "Échantillon d'huile ou de frigorigène prélevé et testé, lecture et interprétation inscrites au bon."],
      ["Prueba de acidez del refrigerante", "Muestra de aceite o refrigerante tomada del sistema y probada, con la lectura y su significado anotados."],
      ["Test di acidità del refrigerante", "Campione di olio o refrigerante prelevato e provato, con la lettura e il suo significato annotati."],
      ["Säuretest des Kältemittels", "Öl- oder Kältemittelprobe entnommen und getestet, Ergebnis und Bedeutung auf dem Auftrag notiert."],
      ["Тест холодоагенту на кислотність", "Пробу оливи чи холодоагенту відібрано й перевірено, результат і висновок записано."],
      ["ਰੈਫ਼ਰੀਜਰੈਂਟ ਐਸਿਡ ਟੈਸਟ", "ਸਿਸਟਮ ਤੋਂ ਤੇਲ ਜਾਂ ਰੈਫ਼ਰੀਜਰੈਂਟ ਦਾ ਨਮੂਨਾ ਲੈ ਕੇ ਟੈਸਟ ਕੀਤਾ, ਨਤੀਜਾ ਅਤੇ ਮਤਲਬ ਲਿਖਿਆ।"],
      ["Acid test ng refrigerant", "Kumuha at sinubukan ang sample ng langis o refrigerant, at isinulat ang resulta at kahulugan nito."],
    )),
    L.material(1, "each", 25, X(
      ["Acid test kit", "Single-use refrigerant oil acid test kit."],
      ["Trousse de test d'acidité", "Trousse à usage unique pour tester l'acidité de l'huile frigorifique."],
      ["Kit de prueba de acidez", "Kit desechable para probar la acidez del aceite refrigerante."],
      ["Kit test acidità", "Kit monouso per l'acidità dell'olio frigorifero."],
      ["Säuretest-Set", "Einweg-Set zum Säuretest des Kältemaschinenöls."],
      ["Набір для тесту на кислотність", "Одноразовий набір для перевірки кислотності холодильної оливи."],
      ["ਐਸਿਡ ਟੈਸਟ ਕਿੱਟ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਤੇਲ ਦੇ ਐਸਿਡ ਲਈ ਇੱਕ ਵਾਰ ਵਰਤਣ ਵਾਲੀ ਕਿੱਟ।"],
      ["Acid test kit", "Single-use na kit para sa acid test ng refrigerant oil."],
    ), { cost: 15 }),
  ]),

  "fq.hvac_repair.compressor.replace_and_startup": A("repair", [
    COMPRESSOR_LABOUR(700), COMPRESSOR(950, 700), BRAZE(75, 50), R410(4),
    SHARED.testing(150),
  ], MECH),

  "fq.hvac_repair.compressor.hard_start_kit": A("repair", [
    L.labour(1, "flat", 225, X(
      ["Hard start kit installation labour", "Kit wired across the run capacitor at the compressor terminals, then start-up amps read before and after."],
      ["Main-d'œuvre — pose de la trousse de démarrage", "Trousse câblée sur le condensateur de marche aux bornes du compresseur, ampérage de démarrage lu avant et après."],
      ["Mano de obra — instalación del kit de arranque", "Kit cableado al capacitor de marcha en las terminales del compresor, y el amperaje de arranque medido antes y después."],
      ["Manodopera — posa del kit di avviamento", "Kit collegato sul condensatore di marcia ai morsetti del compressore, corrente di spunto letta prima e dopo."],
      ["Arbeit — Anlaufhilfe einbauen", "Anlaufhilfe parallel zum Betriebskondensator an den Verdichterklemmen angeschlossen, Anlaufstrom vorher und nachher gemessen."],
      ["Робота — встановлення пускового комплекту", "Комплект під'єднано до робочого конденсатора на клемах компресора, пусковий струм виміряно до й після."],
      ["ਹਾਰਡ ਸਟਾਰਟ ਕਿੱਟ ਲਾਉਣ ਦੀ ਲੇਬਰ", "ਕਿੱਟ ਕੰਪ੍ਰੈਸਰ ਟਰਮੀਨਲਾਂ 'ਤੇ ਰਨ ਕੈਪੇਸਿਟਰ ਨਾਲ ਜੋੜੀ, ਫਿਰ ਸਟਾਰਟ ਐਂਪ ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਮਾਪੇ।"],
      ["Labor — pagkabit ng hard start kit", "Kinablehan ang kit sa run capacitor sa terminal ng compressor, at binasa ang start amps bago at pagkatapos."],
    )),
    L.material(1, "each", 95, X(
      ["Hard start kit — capacitor and relay", "Start capacitor with potential relay, sized to the compressor."],
      ["Trousse de démarrage — condensateur et relais", "Condensateur de démarrage avec relais potentiel, dimensionné pour le compresseur."],
      ["Kit de arranque — capacitor y relevador", "Capacitor de arranque con relevador de potencial, del tamaño del compresor."],
      ["Kit di avviamento — condensatore e relè", "Condensatore di avviamento con relè potenziale, dimensionato sul compressore."],
      ["Anlaufhilfe — Kondensator und Relais", "Anlaufkondensator mit Spannungsrelais, passend zum Verdichter."],
      ["Пусковий комплект — конденсатор і реле", "Пусковий конденсатор із потенційним реле під компресор."],
      ["ਹਾਰਡ ਸਟਾਰਟ ਕਿੱਟ — ਕੈਪੇਸਿਟਰ ਅਤੇ ਰੀਲੇਅ", "ਕੰਪ੍ਰੈਸਰ ਮੁਤਾਬਕ ਪੋਟੈਂਸ਼ਲ ਰੀਲੇਅ ਵਾਲਾ ਸਟਾਰਟ ਕੈਪੇਸਿਟਰ।"],
      ["Hard start kit — capacitor at relay", "Start capacitor na may potential relay, tugma sa compressor."],
    ), { cost: 45 }),
  ]),

  // ── Condensate ──
  "fq.hvac_repair.condensate.clean_drain_pan": A("maintenance", [
    L.labour(1, "flat", 135, X(
      ["Drain pan cleaning", "Sludge scooped out, the pan scrubbed and flushed, and the outlet cleared so water leaves freely."],
      ["Nettoyage du bac de drainage", "Boue retirée, bac brossé et rincé, sortie dégagée pour que l'eau s'écoule librement."],
      ["Limpieza de la charola de drenaje", "Lodo retirado, charola tallada y enjuagada, y la salida destapada para que el agua salga libre."],
      ["Pulizia della vaschetta di scarico", "Melma tolta, vaschetta strofinata e risciacquata, uscita liberata perché l'acqua scorra."],
      ["Reinigung der Ablaufwanne", "Schlamm entfernt, Wanne geschrubbt und gespült, Ablauf frei, damit das Wasser abfließt."],
      ["Чищення піддона", "Мул вибрано, піддон вичищено й промито, вихід прочищено для вільного стоку."],
      ["ਡ੍ਰੇਨ ਪੈਨ ਦੀ ਸਫ਼ਾਈ", "ਚਿੱਕੜ ਕੱਢਿਆ, ਪੈਨ ਰਗੜ ਕੇ ਧੋਤਾ ਅਤੇ ਨਿਕਾਸ ਖੋਲ੍ਹਿਆ ਤਾਂ ਜੋ ਪਾਣੀ ਸੌਖਾ ਨਿਕਲੇ।"],
      ["Paglinis ng drain pan", "Sinandok ang putik, kinuskos at binanlawan ang pan, at binuksan ang labasan para malayang dumaloy ang tubig."],
    )),
    L.labour(1, "flat", 45, X(
      ["Drain line flush", "The line flushed through to the discharge point to prove it runs."],
      ["Rinçage de la conduite de drainage", "Conduite rincée jusqu'au point de rejet pour prouver qu'elle s'écoule."],
      ["Enjuague de la línea de drenaje", "La línea enjuagada hasta el punto de descarga para comprobar que corre."],
      ["Lavaggio della linea di scarico", "Linea lavata fino al punto di scarico per provare che scorre."],
      ["Ablaufleitung spülen", "Leitung bis zur Auslaufstelle durchgespült, um den Abfluss zu belegen."],
      ["Промивання дренажної лінії", "Лінію промито до точки скиду, щоб переконатися, що вода йде."],
      ["ਡ੍ਰੇਨ ਲਾਈਨ ਫ਼ਲੱਸ਼", "ਲਾਈਨ ਨਿਕਾਸ ਥਾਂ ਤੱਕ ਧੋਤੀ ਤਾਂ ਜੋ ਪੱਕਾ ਹੋਵੇ ਕਿ ਪਾਣੀ ਜਾਂਦਾ ਹੈ।"],
      ["Flush ng drain line", "Binanlawan ang linya hanggang sa labasan para matiyak na dumadaloy."],
    )),
    PAN_TABS(),
  ]),

  "fq.hvac_repair.condensate.clean_pump": A("maintenance", [
    L.labour(1, "flat", 115, X(
      ["Condensate pump cleaning", "Reservoir emptied and scrubbed, the float and check valve cleaned, and the pump run on a filled reservoir."],
      ["Nettoyage de la pompe à condensat", "Réservoir vidé et brossé, flotteur et clapet nettoyés, pompe testée réservoir plein."],
      ["Limpieza de la bomba de condensado", "Depósito vaciado y tallado, flotador y válvula check limpiados, y la bomba probada con el depósito lleno."],
      ["Pulizia della pompa condensa", "Serbatoio svuotato e strofinato, galleggiante e valvola di ritegno puliti, pompa provata a serbatoio pieno."],
      ["Reinigung der Kondensatpumpe", "Behälter geleert und geschrubbt, Schwimmer und Rückschlagventil gereinigt, Pumpe mit gefülltem Behälter getestet."],
      ["Чищення насоса конденсату", "Резервуар спорожнено й вичищено, поплавець і зворотний клапан очищено, насос перевірено на повному резервуарі."],
      ["ਕੰਡੈਂਸੇਟ ਪੰਪ ਦੀ ਸਫ਼ਾਈ", "ਟੈਂਕੀ ਖ਼ਾਲੀ ਕਰਕੇ ਰਗੜੀ, ਫ਼ਲੋਟ ਅਤੇ ਚੈੱਕ ਵਾਲਵ ਸਾਫ਼, ਅਤੇ ਭਰੀ ਟੈਂਕੀ ਨਾਲ ਪੰਪ ਚਲਾਇਆ।"],
      ["Paglinis ng condensate pump", "Inalisan at kinuskos ang reservoir, nilinis ang float at check valve, at pinaandar ang pump nang puno ang reservoir."],
    )),
    PAN_TABS(),
  ]),

  "fq.hvac_repair.condensate.clear_flush_line": A("repair", [
    L.labour(1, "flat", 140, X(
      ["Drain line clearing and flush", "The clog pulled with a wet vac or blown through, the line flushed and the trap refilled."],
      ["Débouchage et rinçage de la conduite", "Bouchon aspiré ou chassé à l'air, conduite rincée et siphon rempli."],
      ["Destape y enjuague de la línea", "El tapón sacado con aspiradora o soplado, la línea enjuagada y la trampa rellenada."],
      ["Stasatura e lavaggio della linea", "Intasamento aspirato o soffiato via, linea lavata e sifone riempito."],
      ["Ablaufleitung freimachen und spülen", "Verstopfung abgesaugt oder durchgeblasen, Leitung gespült und Siphon wieder gefüllt."],
      ["Прочищення й промивання лінії", "Засмічення висмоктано чи продуто, лінію промито, сифон наповнено."],
      ["ਡ੍ਰੇਨ ਲਾਈਨ ਖੋਲ੍ਹਣਾ ਅਤੇ ਫ਼ਲੱਸ਼", "ਰੁਕਾਵਟ ਵੈਕਿਊਮ ਨਾਲ ਖਿੱਚੀ ਜਾਂ ਫੂਕ ਨਾਲ ਕੱਢੀ, ਲਾਈਨ ਧੋਤੀ ਅਤੇ ਟ੍ਰੈਪ ਮੁੜ ਭਰਿਆ।"],
      ["Pag-alis ng bara at flush ng linya", "Hinigop o hinipan ang bara, binanlawan ang linya at nilagyan ulit ng tubig ang trap."],
    )),
    L.material(1, "flat", 25, X(
      ["Drain treatment and cleanout cap", "Line treatment and a cleanout tee cap so the next flush is quick."],
      ["Traitement de conduite et bouchon de nettoyage", "Traitement de conduite et bouchon de té de nettoyage pour que le prochain rinçage soit rapide."],
      ["Tratamiento de línea y tapón de limpieza", "Tratamiento para la línea y tapón de te de limpieza para que el próximo enjuague sea rápido."],
      ["Trattamento linea e tappo d'ispezione", "Trattamento per la linea e tappo del raccordo d'ispezione, così il prossimo lavaggio è rapido."],
      ["Leitungsbehandlung und Reinigungskappe", "Leitungsbehandlung und Kappe am Reinigungs-T-Stück, damit die nächste Spülung schnell geht."],
      ["Засіб для лінії й ревізійна заглушка", "Засіб для лінії та заглушка ревізійного трійника для швидкого наступного промивання."],
      ["ਡ੍ਰੇਨ ਟ੍ਰੀਟਮੈਂਟ ਅਤੇ ਕਲੀਨਆਊਟ ਕੈਪ", "ਲਾਈਨ ਟ੍ਰੀਟਮੈਂਟ ਅਤੇ ਕਲੀਨਆਊਟ ਟੀ ਦੀ ਕੈਪ ਤਾਂ ਜੋ ਅਗਲੀ ਫ਼ਲੱਸ਼ ਜਲਦੀ ਹੋਵੇ।"],
      ["Drain treatment at cleanout cap", "Treatment sa linya at cleanout tee cap para mabilis ang susunod na flush."],
    ), { cost: 12 }),
  ]),

  "fq.hvac_repair.condensate.replace_pump": A("repair", [
    L.labour(1, "flat", 175, X(
      ["Condensate pump replacement labour", "Old pump out, the new one mounted, tubing and discharge line connected, the safety switch wired to the thermostat circuit and tested."],
      ["Main-d'œuvre — remplacement de la pompe à condensat", "Ancienne pompe retirée, la neuve fixée, tubes et conduite de rejet raccordés, interrupteur de sécurité câblé au circuit du thermostat et testé."],
      ["Mano de obra — reemplazo de la bomba de condensado", "Bomba vieja fuera, la nueva montada, tubos y línea de descarga conectados, el interruptor de seguridad cableado al circuito del termostato y probado."],
      ["Manodopera — sostituzione pompa condensa", "Vecchia pompa tolta, la nuova montata, tubi e linea di scarico collegati, interruttore di sicurezza cablato al circuito del termostato e provato."],
      ["Arbeit — Kondensatpumpe tauschen", "Alte Pumpe raus, die neue montiert, Schläuche und Druckleitung angeschlossen, Sicherheitsschalter in den Thermostatkreis eingebunden und getestet."],
      ["Робота — заміна насоса конденсату", "Старий насос знято, новий змонтовано, трубки й лінію скиду під'єднано, запобіжний вимикач під'єднано до кола термостата й перевірено."],
      ["ਕੰਡੈਂਸੇਟ ਪੰਪ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਪੁਰਾਣਾ ਪੰਪ ਕੱਢਿਆ, ਨਵਾਂ ਲਾਇਆ, ਟਿਊਬਾਂ ਅਤੇ ਨਿਕਾਸ ਲਾਈਨ ਜੋੜੀ, ਸੁਰੱਖਿਆ ਸਵਿੱਚ ਥਰਮੋਸਟੈਟ ਸਰਕਟ ਨਾਲ ਜੋੜ ਕੇ ਟੈਸਟ ਕੀਤਾ।"],
      ["Labor — palit ng condensate pump", "Tinanggal ang luma, ikinabit ang bago, ikinonekta ang tubing at discharge line, kinablehan ang safety switch sa thermostat circuit at sinubukan."],
    )),
    hdMaterial(REF("condensate_pump"), X(
      ["Condensate pump with safety switch", "Automatic condensate removal pump with an overflow safety switch."],
      ["Pompe à condensat avec interrupteur de sécurité", "Pompe automatique d'évacuation du condensat avec interrupteur de trop-plein."],
      ["Bomba de condensado con interruptor de seguridad", "Bomba automática de condensado con interruptor de seguridad por desborde."],
      ["Pompa condensa con interruttore di sicurezza", "Pompa automatica per condensa con interruttore di troppo pieno."],
      ["Kondensatpumpe mit Sicherheitsschalter", "Automatische Kondensathebepumpe mit Überlauf-Sicherheitsschalter."],
      ["Насос конденсату із запобіжним вимикачем", "Автоматичний насос відведення конденсату з вимикачем переливу."],
      ["ਸੁਰੱਖਿਆ ਸਵਿੱਚ ਵਾਲਾ ਕੰਡੈਂਸੇਟ ਪੰਪ", "ਓਵਰਫ਼ਲੋ ਸੁਰੱਖਿਆ ਸਵਿੱਚ ਵਾਲਾ ਆਟੋਮੈਟਿਕ ਕੰਡੈਂਸੇਟ ਪੰਪ।"],
      ["Condensate pump na may safety switch", "Automatic na condensate pump na may overflow safety switch."],
    ), { price: 145 }),
    L.material(1, "flat", 20, X(
      ["Tubing and fittings", "Vinyl discharge tubing, check valve and fittings."],
      ["Tubes et raccords", "Tube de rejet en vinyle, clapet et raccords."],
      ["Tubería y accesorios", "Manguera de vinilo para descarga, válvula check y accesorios."],
      ["Tubi e raccordi", "Tubo di scarico in vinile, valvola di ritegno e raccordi."],
      ["Schlauch und Formteile", "Vinyl-Druckschlauch, Rückschlagventil und Formteile."],
      ["Трубки й фітинги", "Вінілова трубка скиду, зворотний клапан і фітинги."],
      ["ਟਿਊਬਿੰਗ ਅਤੇ ਫ਼ਿਟਿੰਗ", "ਵਿਨਾਈਲ ਨਿਕਾਸ ਟਿਊਬ, ਚੈੱਕ ਵਾਲਵ ਅਤੇ ਫ਼ਿਟਿੰਗ।"],
      ["Tubing at fittings", "Vinyl na discharge tubing, check valve at fittings."],
    ), { cost: 12 }),
  ]),

  "fq.hvac_repair.condensate.replace_line": A("repair", [
    L.labour(1, "flat", 175, X(
      ["Drain line replacement labour", "The old line cut out and a new run installed with a trap, a cleanout and a steady slope to the drain."],
      ["Main-d'œuvre — remplacement de la conduite", "Ancienne conduite retirée et nouvelle installée avec siphon, bouchon de nettoyage et pente régulière vers le drain."],
      ["Mano de obra — reemplazo de la línea", "Línea vieja cortada y una nueva instalada con trampa, registro y pendiente pareja hacia el drenaje."],
      ["Manodopera — sostituzione della linea", "Vecchia linea tagliata e una nuova posata con sifone, ispezione e pendenza costante verso lo scarico."],
      ["Arbeit — Ablaufleitung erneuern", "Alte Leitung ausgebaut und eine neue mit Siphon, Reinigungsöffnung und gleichmäßigem Gefälle verlegt."],
      ["Робота — заміна дренажної лінії", "Стару лінію вирізано, нову прокладено із сифоном, ревізією й рівним ухилом до стоку."],
      ["ਡ੍ਰੇਨ ਲਾਈਨ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਪੁਰਾਣੀ ਲਾਈਨ ਕੱਟ ਕੇ ਟ੍ਰੈਪ, ਕਲੀਨਆਊਟ ਅਤੇ ਡ੍ਰੇਨ ਵੱਲ ਇੱਕਸਾਰ ਢਲਾਣ ਨਾਲ ਨਵੀਂ ਲਾਈਨ ਪਾਈ।"],
      ["Labor — palit ng drain line", "Tinanggal ang lumang linya at nagkabit ng bago na may trap, cleanout at tuloy-tuloy na slope papunta sa drain."],
    )),
    L.material(1, "flat", 45, X(
      ["3/4 in PVC, fittings and trap", "3/4 in PVC pipe, trap, cleanout tee, hangers, primer and cement."],
      ["PVC 3/4 po, raccords et siphon", "Tuyau PVC de 3/4 po, siphon, té de nettoyage, supports, apprêt et colle."],
      ["PVC de 3/4 pulg, accesorios y trampa", "Tubo PVC de 3/4 pulg, trampa, te de registro, soportes, primer y pegamento."],
      ["PVC 3/4 pollice, raccordi e sifone", "Tubo in PVC da 3/4 di pollice, sifone, raccordo d'ispezione, staffe, primer e collante."],
      ["3/4-Zoll-PVC, Formteile und Siphon", "PVC-Rohr 3/4 Zoll, Siphon, Reinigungs-T-Stück, Halter, Primer und Kleber."],
      ["ПВХ 3/4 дюйма, фітинги й сифон", "Труба ПВХ 3/4 дюйма, сифон, ревізійний трійник, кріплення, праймер і клей."],
      ["3/4 ਇੰਚ PVC, ਫ਼ਿਟਿੰਗ ਅਤੇ ਟ੍ਰੈਪ", "3/4 ਇੰਚ PVC ਪਾਈਪ, ਟ੍ਰੈਪ, ਕਲੀਨਆਊਟ ਟੀ, ਹੈਂਗਰ, ਪ੍ਰਾਈਮਰ ਅਤੇ ਸੀਮਿੰਟ।"],
      ["3/4 in PVC, fittings at trap", "3/4 in na PVC pipe, trap, cleanout tee, hanger, primer at cement."],
    ), { cost: 30 }),
  ]),

  "fq.hvac_repair.condensate.maintain_drainage": A("maintenance", [
    L.labour(1, "flat", 125, X(
      ["Drainage system cleaning and check", "Pan, trap, line and pump cleaned in one visit, the float switch tested and the discharge proven."],
      ["Nettoyage et vérification du drainage", "Bac, siphon, conduite et pompe nettoyés en une visite, flotteur testé et rejet vérifié."],
      ["Limpieza y revisión del drenaje", "Charola, trampa, línea y bomba limpiadas en una visita, el flotador probado y la descarga comprobada."],
      ["Pulizia e controllo dello scarico", "Vaschetta, sifone, linea e pompa puliti in una visita, galleggiante provato e scarico verificato."],
      ["Reinigung und Prüfung der Entwässerung", "Wanne, Siphon, Leitung und Pumpe in einem Termin gereinigt, Schwimmerschalter getestet und Ablauf belegt."],
      ["Чищення й перевірка дренажу", "Піддон, сифон, лінію й насос очищено за один візит, поплавковий вимикач перевірено, скид підтверджено."],
      ["ਡ੍ਰੇਨੇਜ ਸਿਸਟਮ ਸਫ਼ਾਈ ਅਤੇ ਜਾਂਚ", "ਇੱਕ ਵਿਜ਼ਿਟ ਵਿੱਚ ਪੈਨ, ਟ੍ਰੈਪ, ਲਾਈਨ ਅਤੇ ਪੰਪ ਸਾਫ਼, ਫ਼ਲੋਟ ਸਵਿੱਚ ਟੈਸਟ ਅਤੇ ਨਿਕਾਸ ਪੱਕਾ।"],
      ["Paglinis at check ng drainage", "Nilinis sa isang visit ang pan, trap, linya at pump, sinubukan ang float switch at pinatunayan ang labasan."],
    )),
    PAN_TABS(),
  ]),

  // ── Condenser ──
  "fq.hvac_repair.condenser.clean_coil": A("maintenance", [
    L.labour(1, "flat", 175, X(
      ["Condenser coil wash", "Power off, the fan top lifted, cleaner applied and the coil washed from the inside out until the fins run clear."],
      ["Lavage du serpentin du condenseur", "Courant coupé, dessus du ventilateur soulevé, nettoyant appliqué et serpentin lavé de l'intérieur vers l'extérieur jusqu'à ailettes propres."],
      ["Lavado del serpentín del condensador", "Energía cortada, tapa del ventilador levantada, limpiador aplicado y el serpentín lavado de adentro hacia afuera hasta que las aletas queden limpias."],
      ["Lavaggio batteria del condensatore", "Corrente staccata, coperchio ventola sollevato, detergente applicato e batteria lavata dall'interno verso l'esterno fino ad alette pulite."],
      ["Verflüssigerregister waschen", "Strom aus, Lüfterdeckel angehoben, Reiniger aufgetragen und das Register von innen nach außen gespült, bis die Lamellen frei sind."],
      ["Миття теплообмінника конденсатора", "Живлення вимкнено, кришку вентилятора піднято, засіб нанесено, теплообмінник промито зсередини назовні до чистих ламелей."],
      ["ਕੰਡੈਂਸਰ ਕੋਇਲ ਧੁਆਈ", "ਬਿਜਲੀ ਬੰਦ, ਪੱਖੇ ਵਾਲਾ ਢੱਕਣ ਚੁੱਕਿਆ, ਕਲੀਨਰ ਲਾ ਕੇ ਕੋਇਲ ਅੰਦਰੋਂ ਬਾਹਰ ਵੱਲ ਧੋਤੀ ਜਦ ਤੱਕ ਫ਼ਿਨ ਸਾਫ਼ ਨਾ ਹੋਣ।"],
      ["Paghugas ng condenser coil", "Pinatay ang kuryente, iniangat ang takip ng fan, nilagyan ng cleaner at hinugasan ang coil mula loob palabas hanggang luminis ang fins."],
    )),
    L.material(1, "flat", 25, X(
      ["Condenser coil cleaner", "Outdoor coil cleaner, one unit."],
      ["Nettoyant pour serpentin de condenseur", "Nettoyant pour serpentin extérieur, un appareil."],
      ["Limpiador de serpentín de condensador", "Limpiador para serpentín exterior, un equipo."],
      ["Detergente per batteria condensante", "Detergente per batteria esterna, un'unità."],
      ["Verflüssigerreiniger", "Reiniger für das Außenregister, ein Gerät."],
      ["Засіб для конденсатора", "Засіб для зовнішнього теплообмінника, один блок."],
      ["ਕੰਡੈਂਸਰ ਕੋਇਲ ਕਲੀਨਰ", "ਬਾਹਰਲੀ ਕੋਇਲ ਲਈ ਕਲੀਨਰ, ਇੱਕ ਯੂਨਿਟ।"],
      ["Condenser coil cleaner", "Panlinis ng outdoor coil, isang unit."],
    ), { cost: 12 }),
  ]),

  "fq.hvac_repair.condenser.level_risers": A("repair", [
    L.labour(1, "flat", 220, X(
      ["Condenser lift and level", "Unit disconnected at the whip, lifted onto risers, levelled both ways and reconnected, with the line set checked for strain."],
      ["Levage et mise de niveau du condenseur", "Appareil débranché au câble, soulevé sur des supports, mis de niveau dans les deux sens et rebranché, conduites vérifiées contre les tensions."],
      ["Elevación y nivelación del condensador", "Equipo desconectado del cable, subido a bases elevadoras, nivelado en ambos sentidos y reconectado, con la tubería revisada por tensión."],
      ["Sollevamento e livellamento del condensatore", "Unità scollegata, sollevata su supporti, livellata nei due sensi e ricollegata, linee controllate contro le tensioni."],
      ["Verflüssiger anheben und ausrichten", "Gerät an der Anschlussleitung getrennt, auf Füße gesetzt, in beiden Richtungen ausgerichtet und wieder angeschlossen, Leitungen auf Spannung geprüft."],
      ["Підйом і вирівнювання конденсатора", "Блок від'єднано, піднято на опори, вирівняно в обох напрямках і під'єднано знову, трасу перевірено на натяг."],
      ["ਕੰਡੈਂਸਰ ਚੁੱਕ ਕੇ ਪੱਧਰ ਕਰਨਾ", "ਯੂਨਿਟ ਦੀ ਤਾਰ ਖੋਲ੍ਹੀ, ਰਾਈਜ਼ਰਾਂ 'ਤੇ ਚੁੱਕਿਆ, ਦੋਵੇਂ ਪਾਸਿਓਂ ਪੱਧਰ ਕਰਕੇ ਮੁੜ ਜੋੜਿਆ, ਅਤੇ ਲਾਈਨ ਸੈੱਟ ਦਾ ਖਿਚਾਅ ਜਾਂਚਿਆ।"],
      ["Pag-angat at pag-level ng condenser", "Dinisconnect ang unit, iniangat sa riser, pinantay sa magkabilang direksyon at ikinonekta ulit, at chineck kung naiipit ang line set."],
    )),
    L.material(1, "flat", 85, X(
      ["Condenser risers — set of four", "Weather-resistant composite risers for an outdoor unit."],
      ["Supports de condenseur — jeu de quatre", "Supports composites résistants aux intempéries pour appareil extérieur."],
      ["Bases elevadoras — juego de cuatro", "Bases de material compuesto resistentes a la intemperie para equipo exterior."],
      ["Piedini per condensatore — set da quattro", "Supporti in composito resistenti alle intemperie per unità esterna."],
      ["Verflüssigerfüße — Satz mit vier", "Witterungsbeständige Verbundfüße für ein Außengerät."],
      ["Опори для конденсатора — комплект із чотирьох", "Композитні опори, стійкі до негоди, для зовнішнього блока."],
      ["ਕੰਡੈਂਸਰ ਰਾਈਜ਼ਰ — ਚਾਰ ਦਾ ਸੈੱਟ", "ਬਾਹਰੀ ਯੂਨਿਟ ਲਈ ਮੌਸਮ-ਰੋਧਕ ਕੰਪੋਜ਼ਿਟ ਰਾਈਜ਼ਰ।"],
      ["Condenser riser — set ng apat", "Weather-resistant na composite riser para sa outdoor unit."],
    ), { cost: 55 }),
  ]),

  "fq.hvac_repair.condenser.leak_check": A("inspection", [
    L.labour(1, "flat", 129, X(
      ["Leak check at the outdoor unit", "Coil, valves, fittings and brazed joints checked with an electronic detector and bubbles, and every find marked."],
      ["Recherche de fuites sur l'appareil extérieur", "Serpentin, vannes, raccords et joints brasés vérifiés au détecteur électronique et à la solution moussante, chaque fuite marquée."],
      ["Revisión de fugas en la unidad exterior", "Serpentín, válvulas, conexiones y soldaduras revisados con detector electrónico y burbujas, y cada hallazgo marcado."],
      ["Ricerca perdite sull'unità esterna", "Batteria, valvole, raccordi e brasature controllati con cercafughe elettronico e bolle, ogni perdita segnata."],
      ["Lecksuche am Außengerät", "Register, Ventile, Verschraubungen und Lötstellen mit elektronischem Suchgerät und Lecksuchspray geprüft, jeder Fund markiert."],
      ["Перевірка витоків на зовнішньому блоці", "Теплообмінник, вентилі, фітинги й паяні шви перевірено електронним шукачем і мильним розчином, кожне місце позначено."],
      ["ਬਾਹਰੀ ਯੂਨਿਟ 'ਤੇ ਲੀਕ ਜਾਂਚ", "ਇਲੈਕਟ੍ਰਾਨਿਕ ਡਿਟੈਕਟਰ ਅਤੇ ਬੁਲਬੁਲਿਆਂ ਨਾਲ ਕੋਇਲ, ਵਾਲਵ, ਫ਼ਿਟਿੰਗ ਅਤੇ ਜੋੜ ਜਾਂਚੇ, ਹਰ ਲੀਕ 'ਤੇ ਨਿਸ਼ਾਨ।"],
      ["Check ng tagas sa outdoor unit", "Chineck ang coil, valve, fitting at brazed joint gamit ang electronic detector at bula, at minarkahan ang bawat nakita."],
    ), { cost: 65 }),
    L.material(1, "flat", 12, X(
      ["Leak detection solution", "Bubble solution for confirming the detector's finds."],
      ["Solution de détection de fuites", "Solution moussante pour confirmer ce que le détecteur a trouvé."],
      ["Solución detectora de fugas", "Solución de burbujas para confirmar lo que marcó el detector."],
      ["Soluzione cercafughe", "Soluzione a bolle per confermare quanto trovato dal cercafughe."],
      ["Lecksuchspray", "Blasenbildendes Mittel, um die Funde des Suchgeräts zu bestätigen."],
      ["Розчин для пошуку витоків", "Мильний розчин для підтвердження знахідок шукача."],
      ["ਲੀਕ ਲੱਭਣ ਵਾਲਾ ਘੋਲ", "ਡਿਟੈਕਟਰ ਦੀਆਂ ਲੱਭਤਾਂ ਪੱਕੀਆਂ ਕਰਨ ਲਈ ਬੁਲਬੁਲਿਆਂ ਵਾਲਾ ਘੋਲ।"],
      ["Leak detection solution", "Bubble solution para kumpirmahin ang nakita ng detector."],
    ), { cost: 5 }),
  ]),

  "fq.hvac_repair.condenser.replace_service_valve": A("repair", [
    L.labour(1, "each", 300, X(
      ["Service valve replacement — per valve", "Refrigerant recovered, the valve cut out and the new one brazed in with a wet rag on the body, then pressure-tested and evacuated."],
      ["Remplacement de vanne de service — l'unité", "Frigorigène récupéré, vanne coupée et la neuve brasée avec un linge mouillé sur le corps, puis essai de pression et tirage au vide."],
      ["Reemplazo de válvula de servicio — por válvula", "Refrigerante recuperado, válvula cortada y la nueva soldada con trapo húmedo en el cuerpo, luego prueba de presión y vacío."],
      ["Sostituzione valvola di servizio — cadauna", "Refrigerante recuperato, valvola tagliata e la nuova brasata con un panno bagnato sul corpo, poi prova di pressione e vuoto."],
      ["Serviceventil tauschen — pro Stück", "Kältemittel abgesaugt, Ventil ausgetrennt und das neue mit nassem Tuch am Gehäuse eingelötet, dann abgedrückt und evakuiert."],
      ["Заміна сервісного вентиля — за штуку", "Холодоагент відкачано, вентиль вирізано, новий упаяно з мокрою ганчіркою на корпусі, потім опресовано й відвакуумовано."],
      ["ਸਰਵਿਸ ਵਾਲਵ ਬਦਲਣਾ — ਪ੍ਰਤੀ ਵਾਲਵ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਵਾਲਵ ਕੱਟਿਆ ਅਤੇ ਗਿੱਲੇ ਕੱਪੜੇ ਨਾਲ ਨਵਾਂ ਬ੍ਰੇਜ਼ ਕੀਤਾ, ਫਿਰ ਪ੍ਰੈਸ਼ਰ ਟੈਸਟ ਅਤੇ ਵੈਕਿਊਮ।"],
      ["Palit ng service valve — kada isa", "Na-recover ang refrigerant, tinanggal ang valve at binraze ang bago na may basang basahan sa katawan, tapos pressure test at vacuum."],
    ), { measurementKey: "each" }),
    L.material(1, "each", 85, X(
      ["Service valve — liquid or suction", "Brazed service valve matched to the line size."],
      ["Vanne de service — liquide ou aspiration", "Vanne de service à braser, assortie au diamètre de la conduite."],
      ["Válvula de servicio — líquido o succión", "Válvula de servicio para soldar, según el diámetro de la línea."],
      ["Valvola di servizio — liquido o aspirazione", "Valvola di servizio da brasare, adatta al diametro della linea."],
      ["Serviceventil — Flüssigkeit oder Saugseite", "Lötbares Serviceventil passend zum Leitungsdurchmesser."],
      ["Сервісний вентиль — рідинний чи всмоктувальний", "Паяний сервісний вентиль під діаметр лінії."],
      ["ਸਰਵਿਸ ਵਾਲਵ — ਲਿਕਵਿਡ ਜਾਂ ਸਕਸ਼ਨ", "ਲਾਈਨ ਦੇ ਸਾਈਜ਼ ਮੁਤਾਬਕ ਬ੍ਰੇਜ਼ ਵਾਲਾ ਸਰਵਿਸ ਵਾਲਵ।"],
      ["Service valve — liquid o suction", "Brazed na service valve na tugma sa laki ng linya."],
    ), { cost: 55, measurementKey: "each" }),
    R410(2),
  ]),

  "fq.hvac_repair.condenser.fan_motor_service": A("repair", [
    DIAG(),
    L.labour(1, "flat", 175, X(
      ["Condenser fan motor repair or replacement labour", "Motor and capacitor tested; bearings freed where they can be, otherwise the motor swapped, the blade reset and rotation checked."],
      ["Main-d'œuvre — réparation ou remplacement du moteur de ventilateur", "Moteur et condensateur testés; roulements dégagés si possible, sinon moteur remplacé, pale replacée et sens de rotation vérifié."],
      ["Mano de obra — reparación o cambio del motor del ventilador", "Motor y capacitor probados; baleros liberados si se puede, si no el motor cambiado, el aspa recolocada y el giro revisado."],
      ["Manodopera — riparazione o sostituzione motore ventola", "Motore e condensatore provati; cuscinetti sbloccati se possibile, altrimenti motore sostituito, pala riposizionata e rotazione verificata."],
      ["Arbeit — Lüftermotor reparieren oder tauschen", "Motor und Kondensator geprüft; Lager gängig gemacht, wo möglich, sonst Motor getauscht, Flügel neu gesetzt und Drehrichtung geprüft."],
      ["Робота — ремонт або заміна двигуна вентилятора", "Двигун і конденсатор перевірено; підшипники розблоковано, де можливо, інакше двигун замінено, крильчатку встановлено, напрямок перевірено."],
      ["ਕੰਡੈਂਸਰ ਪੱਖਾ ਮੋਟਰ ਮੁਰੰਮਤ ਜਾਂ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਮੋਟਰ ਅਤੇ ਕੈਪੇਸਿਟਰ ਟੈਸਟ; ਹੋ ਸਕੇ ਤਾਂ ਬੇਅਰਿੰਗ ਖੋਲ੍ਹੇ, ਨਹੀਂ ਤਾਂ ਮੋਟਰ ਬਦਲੀ, ਬਲੇਡ ਮੁੜ ਲਾਇਆ ਅਤੇ ਘੁੰਮਣ ਦਿਸ਼ਾ ਜਾਂਚੀ।"],
      ["Labor — ayos o palit ng condenser fan motor", "Sinubukan ang motor at capacitor; pinaluwag ang bearing kung kaya, kung hindi pinalitan ang motor, ibinalik ang blade at chineck ang ikot."],
    )),
    COND_FAN_MOTOR(),
  ]),

  "fq.hvac_repair.condenser.fan_motor_and_blade": A("repair", [
    L.labour(1, "flat", 220, X(
      ["Fan motor and blade replacement labour", "Fan top lifted, the seized blade cut free, the motor and blade replaced as a pair, set to the shroud and run."],
      ["Main-d'œuvre — remplacement du moteur et de la pale", "Dessus soulevé, pale grippée dégagée, moteur et pale remplacés ensemble, réglés par rapport au carénage et testés."],
      ["Mano de obra — cambio de motor y aspa", "Tapa levantada, aspa pegada liberada, motor y aspa cambiados juntos, ajustados a la campana y probados."],
      ["Manodopera — sostituzione motore e pala", "Coperchio sollevato, pala bloccata liberata, motore e pala sostituiti insieme, regolati sul convogliatore e provati."],
      ["Arbeit — Lüftermotor und Flügel tauschen", "Deckel angehoben, festsitzender Flügel gelöst, Motor und Flügel paarweise ersetzt, zur Düse eingestellt und getestet."],
      ["Робота — заміна двигуна й крильчатки", "Кришку піднято, заїлу крильчатку знято, двигун і крильчатку замінено разом, виставлено по обичайці й запущено."],
      ["ਪੱਖਾ ਮੋਟਰ ਅਤੇ ਬਲੇਡ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਢੱਕਣ ਚੁੱਕਿਆ, ਜਾਮ ਬਲੇਡ ਕੱਢਿਆ, ਮੋਟਰ ਅਤੇ ਬਲੇਡ ਜੋੜੀ ਵਜੋਂ ਬਦਲੇ, ਸ਼ਰਾਊਡ ਮੁਤਾਬਕ ਸੈੱਟ ਕਰਕੇ ਚਲਾਏ।"],
      ["Labor — palit ng fan motor at blade", "Iniangat ang takip, tinanggal ang dikit na blade, pinalitan nang magkasama ang motor at blade, in-set sa shroud at pinaandar."],
    )),
    COND_FAN_MOTOR(), FAN_BLADE(), FAN_CAP(),
  ]),

  "fq.hvac_repair.condenser.replace_fan_blade": A("repair", [
    L.labour(1, "each", 150, X(
      ["Fan blade replacement — per blade", "The old blade pulled from the shaft, the new one set at the right height in the shroud, locked down and run for wobble."],
      ["Remplacement de pale — l'unité", "Ancienne pale retirée de l'arbre, la neuve posée à la bonne hauteur dans le carénage, bloquée et testée pour le voilage."],
      ["Reemplazo de aspa — por aspa", "Aspa vieja sacada del eje, la nueva puesta a la altura correcta en la campana, apretada y probada por bamboleo."],
      ["Sostituzione pala — cadauna", "Vecchia pala sfilata dall'albero, la nuova montata all'altezza giusta nel convogliatore, bloccata e provata per oscillazioni."],
      ["Lüfterflügel tauschen — pro Stück", "Alter Flügel von der Welle gezogen, der neue auf richtiger Höhe in der Düse gesetzt, festgezogen und auf Unwucht geprüft."],
      ["Заміна крильчатки — за штуку", "Стару крильчатку знято з валу, нову встановлено на потрібній висоті в обичайці, затягнуто й перевірено на биття."],
      ["ਪੱਖੇ ਦਾ ਬਲੇਡ ਬਦਲਣਾ — ਪ੍ਰਤੀ ਬਲੇਡ", "ਪੁਰਾਣਾ ਬਲੇਡ ਸ਼ਾਫ਼ਟ ਤੋਂ ਕੱਢਿਆ, ਨਵਾਂ ਸ਼ਰਾਊਡ ਵਿੱਚ ਸਹੀ ਉਚਾਈ 'ਤੇ ਕੱਸਿਆ ਅਤੇ ਹਿੱਲਣ ਲਈ ਚਲਾ ਕੇ ਦੇਖਿਆ।"],
      ["Palit ng fan blade — kada isa", "Hinugot ang lumang blade sa shaft, ikinabit ang bago sa tamang taas sa shroud, hinigpitan at pinaandar kung umaalog."],
    ), { measurementKey: "each" }),
    FAN_BLADE({ measurementKey: "each" }),
  ]),

  "fq.hvac_repair.condenser.remount_fan_blade": A("repair", [
    DIAG(),
    L.labour(1, "flat", 175, X(
      ["Blade reset and alignment", "Blade freed, the shaft cleaned, the blade set to height and square in the shroud, the set screw locked on the flat and run."],
      ["Remise en place et alignement de la pale", "Pale dégagée, arbre nettoyé, pale réglée en hauteur et d'équerre dans le carénage, vis de blocage serrée sur le méplat et test."],
      ["Recolocación y alineación del aspa", "Aspa liberada, eje limpiado, aspa a la altura y escuadra en la campana, prisionero apretado sobre la parte plana y probada."],
      ["Riposizionamento e allineamento pala", "Pala liberata, albero pulito, pala regolata in altezza e in squadra nel convogliatore, grano serrato sulla parte piana e prova."],
      ["Flügel neu setzen und ausrichten", "Flügel gelöst, Welle gereinigt, Flügel auf Höhe und rechtwinklig in der Düse gesetzt, Madenschraube auf der Abflachung festgezogen und getestet."],
      ["Перевстановлення й вирівнювання крильчатки", "Крильчатку звільнено, вал очищено, виставлено по висоті й рівно в обичайці, гвинт затягнуто на лиску й запущено."],
      ["ਬਲੇਡ ਮੁੜ ਲਾਉਣਾ ਅਤੇ ਸਿੱਧਾ ਕਰਨਾ", "ਬਲੇਡ ਖੋਲ੍ਹਿਆ, ਸ਼ਾਫ਼ਟ ਸਾਫ਼, ਸ਼ਰਾਊਡ ਵਿੱਚ ਸਹੀ ਉਚਾਈ ਅਤੇ ਸਿੱਧਾ ਲਾਇਆ, ਪੇਚ ਕੱਸਿਆ ਅਤੇ ਚਲਾਇਆ।"],
      ["Pag-reset at pag-align ng blade", "Pinaluwag ang blade, nilinis ang shaft, in-set sa tamang taas at diretso sa shroud, hinigpitan ang set screw sa flat at pinaandar."],
    )),
    L.material(1, "flat", 20, X(
      ["Set screw and shaft treatment", "New set screw and anti-seize for the motor shaft."],
      ["Vis de blocage et traitement de l'arbre", "Vis de blocage neuve et antigrippant pour l'arbre du moteur."],
      ["Prisionero y tratamiento del eje", "Prisionero nuevo y antiadherente para el eje del motor."],
      ["Grano e trattamento dell'albero", "Grano nuovo e antigrippaggio per l'albero del motore."],
      ["Madenschraube und Wellenpflege", "Neue Madenschraube und Montagepaste für die Motorwelle."],
      ["Установочний гвинт і мастило валу", "Новий установочний гвинт і антизадирне мастило для валу двигуна."],
      ["ਸੈੱਟ ਪੇਚ ਅਤੇ ਸ਼ਾਫ਼ਟ ਟ੍ਰੀਟਮੈਂਟ", "ਮੋਟਰ ਸ਼ਾਫ਼ਟ ਲਈ ਨਵਾਂ ਸੈੱਟ ਪੇਚ ਅਤੇ ਐਂਟੀ-ਸੀਜ਼।"],
      ["Set screw at shaft treatment", "Bagong set screw at anti-seize para sa shaft ng motor."],
    ), { cost: 8 }),
  ]),

  "fq.hvac_repair.condenser.install_fan_motor": A("installation", [
    L.labour(1, "each", 200, X(
      ["Condenser fan motor installation — per motor", "Motor mounted to the fan top, wired to its capacitor and contactor, rotation set and amp draw checked."],
      ["Pose de moteur de ventilateur de condenseur — l'unité", "Moteur fixé au dessus, raccordé à son condensateur et au contacteur, sens de rotation réglé et ampérage vérifié."],
      ["Instalación de motor de ventilador — por motor", "Motor montado en la tapa, conectado a su capacitor y contactor, giro ajustado y amperaje revisado."],
      ["Posa motore ventola condensatore — cadauno", "Motore montato sul coperchio, collegato a condensatore e contattore, rotazione impostata e assorbimento verificato."],
      ["Verflüssiger-Lüftermotor einbauen — pro Stück", "Motor am Deckel montiert, an Kondensator und Schütz angeschlossen, Drehrichtung eingestellt und Stromaufnahme geprüft."],
      ["Встановлення двигуна вентилятора — за штуку", "Двигун закріплено на кришці, під'єднано до конденсатора й контактора, напрямок виставлено, струм перевірено."],
      ["ਕੰਡੈਂਸਰ ਪੱਖਾ ਮੋਟਰ ਲਾਉਣਾ — ਪ੍ਰਤੀ ਮੋਟਰ", "ਮੋਟਰ ਉੱਪਰਲੇ ਢੱਕਣ 'ਤੇ ਲਾਈ, ਕੈਪੇਸਿਟਰ ਅਤੇ ਕੌਂਟੈਕਟਰ ਨਾਲ ਜੋੜੀ, ਘੁੰਮਣ ਦਿਸ਼ਾ ਸੈੱਟ ਅਤੇ ਐਂਪ ਜਾਂਚੇ।"],
      ["Pagkabit ng condenser fan motor — kada isa", "Ikinabit ang motor sa takip, kinablehan sa capacitor at contactor, in-set ang ikot at chineck ang amp draw."],
    ), { measurementKey: "each" }),
    COND_FAN_MOTOR({ measurementKey: "each" }),
    FAN_CAP({ measurementKey: "each" }),
  ]),

  "fq.hvac_repair.condenser.install_condenser": A("installation", [
    L.labour(1, "flat", 650, X(
      ["Condenser set, connect and start-up", "Unit set level on its pad, the line set brazed and evacuated, the disconnect and whip wired and the system started."],
      ["Pose, raccordement et démarrage du condenseur", "Appareil posé de niveau sur sa base, conduites brasées et tirées au vide, sectionneur et câble raccordés, système démarré."],
      ["Colocación, conexión y arranque del condensador", "Equipo nivelado en su base, tubería soldada y al vacío, desconectador y cable conectados y el sistema arrancado."],
      ["Posa, collegamento e avvio del condensatore", "Unità posata in bolla sul basamento, linee brasate e messe sotto vuoto, sezionatore e cavo collegati, impianto avviato."],
      ["Verflüssiger setzen, anschließen und starten", "Gerät waagerecht auf den Sockel gesetzt, Leitungen gelötet und evakuiert, Trennschalter und Anschlussleitung verdrahtet, Anlage gestartet."],
      ["Встановлення, під'єднання й запуск конденсатора", "Блок рівно встановлено на основу, трасу впаяно й відвакуумовано, вимикач і кабель під'єднано, систему запущено."],
      ["ਕੰਡੈਂਸਰ ਰੱਖਣਾ, ਜੋੜਨਾ ਅਤੇ ਚਾਲੂ ਕਰਨਾ", "ਯੂਨਿਟ ਪੈਡ 'ਤੇ ਪੱਧਰ ਰੱਖਿਆ, ਲਾਈਨ ਸੈੱਟ ਬ੍ਰੇਜ਼ ਅਤੇ ਵੈਕਿਊਮ, ਡਿਸਕਨੈਕਟ ਅਤੇ ਤਾਰ ਜੋੜੀ ਅਤੇ ਸਿਸਟਮ ਚਾਲੂ।"],
      ["Paglagay, pagkonekta at pag-start ng condenser", "Inilagay nang pantay ang unit sa pad, binraze at vinacuum ang line set, kinablehan ang disconnect at whip at pinaandar ang sistema."],
    )),
    L.material(1, "flat", 180, X(
      ["Pad, disconnect and whip", "Composite equipment pad, a fused or non-fused disconnect and a liquid-tight whip."],
      ["Base, sectionneur et câble", "Base composite, sectionneur avec ou sans fusible et câble étanche."],
      ["Base, desconectador y cable", "Base de material compuesto, desconectador con o sin fusible y cable hermético."],
      ["Basamento, sezionatore e cavo", "Basamento in composito, sezionatore con o senza fusibili e cavo a tenuta."],
      ["Sockel, Trennschalter und Anschlussleitung", "Verbundsockel, Trennschalter mit oder ohne Sicherung und flüssigkeitsdichte Anschlussleitung."],
      ["Основа, вимикач і кабель", "Композитна основа, вимикач із запобіжником чи без і герметичний кабель."],
      ["ਪੈਡ, ਡਿਸਕਨੈਕਟ ਅਤੇ ਤਾਰ", "ਕੰਪੋਜ਼ਿਟ ਪੈਡ, ਫ਼ਿਊਜ਼ ਵਾਲਾ ਜਾਂ ਬਿਨਾਂ ਡਿਸਕਨੈਕਟ ਅਤੇ ਲਿਕਵਿਡ-ਟਾਈਟ ਤਾਰ।"],
      ["Pad, disconnect at whip", "Composite na pad, fused o non-fused na disconnect at liquid-tight na whip."],
    ), { cost: 130 }),
    SHARED.testing(150),
  ], MECH),

  // ── Belts and pulleys ──
  "fq.hvac_repair.belts.adjust_belt_pulley": A("maintenance", [
    L.labour(1, "flat", 150, X(
      ["Belt tension and pulley alignment", "Motor and blower pulleys brought into line with a straightedge and the belt set to the right deflection."],
      ["Tension de courroie et alignement des poulies", "Poulies du moteur et du ventilateur alignées à la règle et courroie réglée à la bonne flèche."],
      ["Tensión de banda y alineación de poleas", "Poleas del motor y del ventilador alineadas con regla y la banda ajustada a la deflexión correcta."],
      ["Tensione cinghia e allineamento pulegge", "Pulegge di motore e ventilatore allineate con la riga e cinghia regolata alla giusta freccia."],
      ["Riemenspannung und Scheibenausrichtung", "Motor- und Gebläsescheibe mit dem Lineal ausgerichtet und der Riemen auf die richtige Durchbiegung gespannt."],
      ["Натяг паса й вирівнювання шківів", "Шківи двигуна й вентилятора вирівняно лінійкою, пас натягнуто до правильного прогину."],
      ["ਬੈਲਟ ਕਸਾਵਟ ਅਤੇ ਪੁਲੀ ਅਲਾਈਨਮੈਂਟ", "ਮੋਟਰ ਅਤੇ ਬਲੋਅਰ ਪੁਲੀਆਂ ਸਿੱਧੀ ਪੱਟੀ ਨਾਲ ਇੱਕ ਲਾਈਨ ਵਿੱਚ ਅਤੇ ਬੈਲਟ ਸਹੀ ਢਿੱਲ 'ਤੇ ਸੈੱਟ।"],
      ["Tension ng belt at align ng pulley", "Pinantay gamit ang straightedge ang pulley ng motor at blower at in-set sa tamang luwag ang belt."],
    )),
    L.labour(1, "flat", 45, X(
      ["Bearing lubrication", "Blower and motor bearings greased where they take it and checked for play."],
      ["Lubrification des roulements", "Roulements du ventilateur et du moteur graissés s'ils le permettent et vérifiés pour le jeu."],
      ["Lubricación de baleros", "Baleros del ventilador y del motor engrasados donde se puede y revisados por juego."],
      ["Lubrificazione cuscinetti", "Cuscinetti di ventilatore e motore ingrassati dove previsto e controllati per il gioco."],
      ["Lagerschmierung", "Gebläse- und Motorlager geschmiert, wo vorgesehen, und auf Spiel geprüft."],
      ["Змащення підшипників", "Підшипники вентилятора й двигуна змащено, де передбачено, і перевірено на люфт."],
      ["ਬੇਅਰਿੰਗ ਗ੍ਰੀਸਿੰਗ", "ਜਿੱਥੇ ਹੋ ਸਕੇ ਬਲੋਅਰ ਅਤੇ ਮੋਟਰ ਬੇਅਰਿੰਗਾਂ ਨੂੰ ਗ੍ਰੀਸ ਅਤੇ ਢਿੱਲ ਜਾਂਚੀ।"],
      ["Pag-grasa ng bearing", "Ginrasa ang bearing ng blower at motor kung pwede at chineck kung maluwag."],
    )),
    SHARED.consumables(15),
  ], MECH),

  "fq.hvac_repair.belts.replace_belt": A("repair", [
    L.labour(1, "each", 110, X(
      ["Blower belt replacement — per belt", "Old belt off, the new one sized to the drive, fitted, tensioned and run in."],
      ["Remplacement de courroie — l'unité", "Ancienne courroie retirée, la neuve de la bonne taille posée, tendue et rodée."],
      ["Reemplazo de banda — por banda", "Banda vieja fuera, la nueva de la medida correcta colocada, tensada y asentada."],
      ["Sostituzione cinghia — cadauna", "Vecchia cinghia tolta, la nuova della misura giusta montata, tesa e rodata."],
      ["Keilriemen tauschen — pro Stück", "Alter Riemen ab, der neue in passender Größe aufgelegt, gespannt und eingefahren."],
      ["Заміна паса — за штуку", "Старий пас знято, новий потрібного розміру встановлено, натягнуто й обкатано."],
      ["ਬਲੋਅਰ ਬੈਲਟ ਬਦਲਣਾ — ਪ੍ਰਤੀ ਬੈਲਟ", "ਪੁਰਾਣੀ ਬੈਲਟ ਉਤਾਰੀ, ਡਰਾਈਵ ਮੁਤਾਬਕ ਨਵੀਂ ਲਾਈ, ਕੱਸੀ ਅਤੇ ਚਲਾ ਕੇ ਬਿਠਾਈ।"],
      ["Palit ng blower belt — kada isa", "Tinanggal ang lumang belt, ikinabit, tinensyon at pinatakbo ang bagong belt na tugma sa drive."],
    ), { measurementKey: "each" }),
    L.material(1, "each", 35, X(
      ["Blower belt", "V-belt sized to the blower drive."],
      ["Courroie de ventilateur", "Courroie trapézoïdale à la taille de l'entraînement."],
      ["Banda del ventilador", "Banda en V de la medida de la transmisión."],
      ["Cinghia del ventilatore", "Cinghia trapezoidale della misura della trasmissione."],
      ["Gebläse-Keilriemen", "Keilriemen passend zum Gebläseantrieb."],
      ["Пас вентилятора", "Клиновий пас під привод вентилятора."],
      ["ਬਲੋਅਰ ਬੈਲਟ", "ਬਲੋਅਰ ਡਰਾਈਵ ਮੁਤਾਬਕ V-ਬੈਲਟ।"],
      ["Blower belt", "V-belt na tugma sa blower drive."],
    ), { cost: 18, measurementKey: "each" }),
  ], MECH),

  "fq.hvac_repair.belts.replace_pulley": A("repair", [
    L.labour(1, "each", 220, X(
      ["Blower pulley replacement — per pulley", "Pulley pulled from the shaft, the new one keyed on, aligned with its partner and the belt re-tensioned."],
      ["Remplacement de poulie — l'unité", "Poulie extraite de l'arbre, la neuve clavetée, alignée avec l'autre poulie et courroie retendue."],
      ["Reemplazo de polea — por polea", "Polea sacada del eje, la nueva acuñada, alineada con su pareja y la banda vuelta a tensar."],
      ["Sostituzione puleggia — cadauna", "Puleggia estratta dall'albero, la nuova calettata, allineata all'altra e cinghia ritesa."],
      ["Riemenscheibe tauschen — pro Stück", "Scheibe von der Welle abgezogen, die neue mit Passfeder gesetzt, zur Gegenscheibe ausgerichtet und Riemen nachgespannt."],
      ["Заміна шківа — за штуку", "Шків знято з валу, новий посаджено на шпонку, вирівняно з парним і пас перенатягнуто."],
      ["ਬਲੋਅਰ ਪੁਲੀ ਬਦਲਣਾ — ਪ੍ਰਤੀ ਪੁਲੀ", "ਪੁਲੀ ਸ਼ਾਫ਼ਟ ਤੋਂ ਕੱਢੀ, ਨਵੀਂ ਕੀ ਨਾਲ ਲਾਈ, ਜੋੜੀਦਾਰ ਨਾਲ ਸਿੱਧੀ ਕੀਤੀ ਅਤੇ ਬੈਲਟ ਮੁੜ ਕੱਸੀ।"],
      ["Palit ng blower pulley — kada isa", "Hinugot ang pulley sa shaft, ikinabit ang bago na may key, pinantay sa kapares at tinensyon ulit ang belt."],
    ), { measurementKey: "each" }),
    L.material(1, "each", 95, X(
      ["Blower pulley", "Fixed or adjustable pulley matched for bore and belt section."],
      ["Poulie de ventilateur", "Poulie fixe ou réglable assortie à l'alésage et au profil de courroie."],
      ["Polea del ventilador", "Polea fija o ajustable según el barreno y la sección de la banda."],
      ["Puleggia del ventilatore", "Puleggia fissa o regolabile adatta a foro e sezione della cinghia."],
      ["Gebläse-Riemenscheibe", "Feste oder verstellbare Scheibe passend zu Bohrung und Riemenprofil."],
      ["Шків вентилятора", "Фіксований чи регульований шків під отвір і профіль паса."],
      ["ਬਲੋਅਰ ਪੁਲੀ", "ਬੋਰ ਅਤੇ ਬੈਲਟ ਸੈਕਸ਼ਨ ਮੁਤਾਬਕ ਫ਼ਿਕਸ ਜਾਂ ਅਡਜਸਟੇਬਲ ਪੁਲੀ।"],
      ["Blower pulley", "Fixed o adjustable na pulley na tugma sa bore at belt section."],
    ), { cost: 60, measurementKey: "each" }),
    L.material(1, "flat", 35, X(
      ["Blower belt", "A new V-belt fitted with the pulley."],
      ["Courroie de ventilateur", "Courroie trapézoïdale neuve posée avec la poulie."],
      ["Banda del ventilador", "Banda en V nueva colocada con la polea."],
      ["Cinghia del ventilatore", "Cinghia trapezoidale nuova montata con la puleggia."],
      ["Gebläse-Keilriemen", "Neuer Keilriemen zusammen mit der Scheibe aufgelegt."],
      ["Пас вентилятора", "Новий клиновий пас, встановлений разом зі шківом."],
      ["ਬਲੋਅਰ ਬੈਲਟ", "ਪੁਲੀ ਨਾਲ ਲਾਈ ਨਵੀਂ V-ਬੈਲਟ।"],
      ["Blower belt", "Bagong V-belt na ikinabit kasama ng pulley."],
    ), { cost: 18 }),
  ], MECH),

  // ── Air quality, insulation and sealing ──
  "fq.hvac_repair.air_quality.seal_insulate_ducts": A("repair", [
    L.labour(1, "flat", 400, X(
      ["Duct sealing — joints and seams", "Accessible joints, seams and boot connections brushed with mastic or taped, starting with the ones nearest the air handler."],
      ["Scellement des conduits — joints et coutures", "Joints, coutures et raccords de bouches accessibles enduits de mastic ou rubanés, en commençant près de l'appareil."],
      ["Sellado de ductos — uniones y costuras", "Uniones, costuras y conexiones de botas accesibles selladas con mástique o cinta, empezando por las más cercanas al manejador."],
      ["Sigillatura condotti — giunti e cuciture", "Giunti, cuciture e attacchi accessibili spalmati di mastice o nastrati, partendo da quelli vicini all'unità."],
      ["Kanalabdichtung — Stöße und Nähte", "Zugängliche Stöße, Nähte und Auslassanschlüsse mit Dichtmasse bestrichen oder geklebt, beginnend am Lüftungsgerät."],
      ["Герметизація повітроводів — стики й шви", "Доступні стики, шви й з'єднання бутів промазано мастикою чи обклеєно, починаючи біля повітрообробника."],
      ["ਡਕਟ ਸੀਲਿੰਗ — ਜੋੜ ਅਤੇ ਸੀਮਾਂ", "ਪਹੁੰਚ ਵਾਲੇ ਜੋੜ, ਸੀਮਾਂ ਅਤੇ ਬੂਟ ਕਨੈਕਸ਼ਨ ਮੈਸਟਿਕ ਜਾਂ ਟੇਪ ਨਾਲ ਸੀਲ, ਏਅਰ ਹੈਂਡਲਰ ਦੇ ਨੇੜਿਓਂ ਸ਼ੁਰੂ।"],
      ["Pag-seal ng duct — dugtungan at tahi", "Pinahiran ng mastic o tape ang maaabot na dugtungan, tahi at boot, simula sa pinakamalapit sa air handler."],
    )),
    L.labour(1, "flat", 250, X(
      ["Duct insulation wrap", "Exposed runs in the attic or crawlspace wrapped and the seams taped so the jacket stays closed."],
      ["Isolation des conduits", "Conduits exposés au grenier ou dans le vide sanitaire enveloppés, joints rubanés pour que l'enveloppe reste fermée."],
      ["Aislamiento de ductos", "Tramos expuestos en ático o sótano envueltos y las uniones encintadas para que la cubierta quede cerrada."],
      ["Isolamento dei condotti", "Tratti esposti in sottotetto o vespaio avvolti e giunture nastrate perché il rivestimento resti chiuso."],
      ["Kanaldämmung", "Offene Kanäle im Dachboden oder Kriechkeller ummantelt und die Nähte verklebt, damit die Hülle geschlossen bleibt."],
      ["Утеплення повітроводів", "Відкриті ділянки на горищі чи в підпіллі обгорнуто, шви заклеєно, щоб оболонка трималась."],
      ["ਡਕਟ ਇੰਸੂਲੇਸ਼ਨ ਲਪੇਟ", "ਅਟਾਰੀ ਜਾਂ ਕ੍ਰੌਲਸਪੇਸ ਵਿੱਚ ਖੁੱਲ੍ਹੀਆਂ ਡਕਟਾਂ ਲਪੇਟੀਆਂ ਅਤੇ ਸੀਮਾਂ 'ਤੇ ਟੇਪ ਤਾਂ ਜੋ ਲਪੇਟ ਬੰਦ ਰਹੇ।"],
      ["Pagbalot ng insulation sa duct", "Binalot ang nakalantad na duct sa attic o crawlspace at tinape ang tahi para hindi bumuka."],
    )),
    L.material(1, "flat", 45, X(
      ["Duct mastic and foil tape", "Water-based duct mastic and UL-listed foil tape."],
      ["Mastic à conduits et ruban d'aluminium", "Mastic à base d'eau pour conduits et ruban d'aluminium homologué."],
      ["Mástique para ductos y cinta de aluminio", "Mástique base agua para ductos y cinta de aluminio certificada."],
      ["Mastice per condotti e nastro alluminio", "Mastice all'acqua per condotti e nastro in alluminio certificato."],
      ["Kanaldichtmasse und Alu-Klebeband", "Wasserbasierte Kanaldichtmasse und zugelassenes Alu-Klebeband."],
      ["Мастика для повітроводів і фольгована стрічка", "Мастика на водній основі та сертифікована фольгована стрічка."],
      ["ਡਕਟ ਮੈਸਟਿਕ ਅਤੇ ਫ਼ੌਇਲ ਟੇਪ", "ਪਾਣੀ ਅਧਾਰਤ ਡਕਟ ਮੈਸਟਿਕ ਅਤੇ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਫ਼ੌਇਲ ਟੇਪ।"],
      ["Duct mastic at foil tape", "Water-based na duct mastic at UL-listed na foil tape."],
    ), { cost: 30 }),
    L.material(1, "flat", 150, X(
      ["Duct wrap insulation — R-8", "Foil-faced R-8 duct wrap, enough for the exposed runs."],
      ["Isolant pour conduits — R-8", "Isolant R-8 à pare-vapeur d'aluminium, assez pour les conduits exposés."],
      ["Aislante para ductos — R-8", "Aislante R-8 con cara de aluminio, suficiente para los tramos expuestos."],
      ["Isolante per condotti — R-8", "Isolante R-8 con barriera in alluminio, sufficiente per i tratti esposti."],
      ["Kanaldämmung — R-8", "Alukaschierte Dämmung R-8, ausreichend für die offenen Kanäle."],
      ["Утеплювач для повітроводів — R-8", "Фольгований утеплювач R-8, достатньо для відкритих ділянок."],
      ["ਡਕਟ ਰੈਪ ਇੰਸੂਲੇਸ਼ਨ — R-8", "ਖੁੱਲ੍ਹੀਆਂ ਡਕਟਾਂ ਲਈ ਕਾਫ਼ੀ ਫ਼ੌਇਲ ਵਾਲੀ R-8 ਡਕਟ ਰੈਪ।"],
      ["Duct wrap insulation — R-8", "Foil-faced na R-8 duct wrap, sapat para sa nakalantad na duct."],
    ), { cost: 110 }),
  ]),

  "fq.hvac_repair.air_quality.replace_uv_bulbs": A("maintenance", [
    L.labour(1, "flat", 120, X(
      ["UV lamp replacement labour", "Power to the purifier isolated, the spent lamps removed and the new ones fitted without bare hands, and the indicator checked."],
      ["Main-d'œuvre — remplacement des lampes UV", "Alimentation du purificateur coupée, lampes usées retirées et neuves posées sans les toucher à mains nues, voyant vérifié."],
      ["Mano de obra — cambio de lámparas UV", "Energía del purificador aislada, lámparas gastadas retiradas y las nuevas colocadas sin tocarlas con la mano, y el indicador revisado."],
      ["Manodopera — sostituzione lampade UV", "Alimentazione del purificatore isolata, lampade esauste tolte e le nuove montate senza toccarle a mani nude, spia verificata."],
      ["Arbeit — UV-Lampen tauschen", "Strom zum Reiniger getrennt, verbrauchte Lampen entnommen und die neuen ohne bloße Hände eingesetzt, Anzeige geprüft."],
      ["Робота — заміна УФ-ламп", "Живлення очищувача вимкнено, відпрацьовані лампи знято, нові встановлено без дотику голими руками, індикатор перевірено."],
      ["UV ਲੈਂਪ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਪਿਊਰੀਫ਼ਾਇਰ ਦੀ ਬਿਜਲੀ ਬੰਦ, ਪੁਰਾਣੇ ਲੈਂਪ ਕੱਢੇ ਅਤੇ ਨਵੇਂ ਨੰਗੇ ਹੱਥ ਲਾਏ ਬਿਨਾਂ ਲਾਏ, ਇੰਡੀਕੇਟਰ ਜਾਂਚਿਆ।"],
      ["Labor — palit ng UV lamp", "Pinatay ang kuryente ng purifier, tinanggal ang lumang lamp at ikinabit ang bago nang hindi hinahawakan ng hubad na kamay, at chineck ang indicator."],
    )),
    L.material(1, "each", 185, X(
      ["Replacement UV lamp — per lamp", "OEM or equivalent germicidal UV-C lamp for the installed purifier."],
      ["Lampe UV de remplacement — l'unité", "Lampe germicide UV-C d'origine ou équivalente pour le purificateur installé."],
      ["Lámpara UV de reemplazo — por lámpara", "Lámpara germicida UV-C original o equivalente para el purificador instalado."],
      ["Lampada UV di ricambio — cadauna", "Lampada germicida UV-C originale o equivalente per il purificatore installato."],
      ["UV-Ersatzlampe — pro Stück", "Original- oder gleichwertige UV-C-Entkeimungslampe für den eingebauten Reiniger."],
      ["Лампа УФ на заміну — за штуку", "Оригінальна чи рівноцінна бактерицидна лампа УФ-C для встановленого очищувача."],
      ["ਬਦਲਵਾਂ UV ਲੈਂਪ — ਪ੍ਰਤੀ ਲੈਂਪ", "ਲੱਗੇ ਪਿਊਰੀਫ਼ਾਇਰ ਲਈ ਅਸਲੀ ਜਾਂ ਬਰਾਬਰ UV-C ਕੀਟਾਣੂਨਾਸ਼ਕ ਲੈਂਪ।"],
      ["Kapalit na UV lamp — kada isa", "OEM o katumbas na germicidal UV-C lamp para sa nakakabit na purifier."],
    ), { cost: 125, measurementKey: "each" }),
  ]),

  "fq.hvac_repair.maintenance.furnace_cleaning": A("maintenance", [
    L.labour(1, "flat", 169, X(
      ["Furnace cleaning", "Burners, flame sensor, blower compartment and inducer vacuumed and brushed, and the furnace run through a full heat cycle."],
      ["Nettoyage de la fournaise", "Brûleurs, détecteur de flamme, compartiment du ventilateur et ventilateur d'extraction aspirés et brossés, fournaise testée sur un cycle complet."],
      ["Limpieza del horno", "Quemadores, sensor de flama, compartimiento del ventilador e inductor aspirados y cepillados, y el horno probado en un ciclo completo."],
      ["Pulizia del generatore d'aria calda", "Bruciatori, sensore di fiamma, vano ventilatore ed estrattore aspirati e spazzolati, generatore provato in un ciclo completo."],
      ["Ofenreinigung", "Brenner, Flammenfühler, Gebläseraum und Saugzug gesaugt und gebürstet, Ofen einen vollen Heizzyklus gefahren."],
      ["Чищення печі", "Пальники, датчик полум'я, відсік вентилятора й димосос пропилососено й вичищено, піч перевірено на повному циклі."],
      ["ਫ਼ਰਨੇਸ ਸਫ਼ਾਈ", "ਬਰਨਰ, ਫ਼ਲੇਮ ਸੈਂਸਰ, ਬਲੋਅਰ ਖਾਨਾ ਅਤੇ ਇੰਡਿਊਸਰ ਵੈਕਿਊਮ ਅਤੇ ਬੁਰਸ਼ ਕੀਤੇ, ਅਤੇ ਪੂਰਾ ਗਰਮ ਚੱਕਰ ਚਲਾਇਆ।"],
      ["Paglinis ng furnace", "Binakyum at biniristsa ang burner, flame sensor, blower compartment at inducer, at pinatakbo ang buong heat cycle."],
    ), { cost: 85 }),
    hdMaterial(HD.filter_16x25x1, X(
      ["Pleated furnace filter", "MERV 11 pleated filter sized to the return."],
      ["Filtre plissé de fournaise", "Filtre plissé MERV 11 à la taille du retour."],
      ["Filtro plisado de horno", "Filtro plisado MERV 11 de la medida del retorno."],
      ["Filtro pieghettato", "Filtro pieghettato MERV 11 della misura della ripresa."],
      ["Faltenfilter für den Ofen", "Faltenfilter MERV 11 passend zur Rückluftöffnung."],
      ["Гофрований фільтр печі", "Гофрований фільтр MERV 11 під розмір повернення."],
      ["ਪਲੀਟਿਡ ਫ਼ਰਨੇਸ ਫ਼ਿਲਟਰ", "ਰਿਟਰਨ ਦੇ ਸਾਈਜ਼ ਦਾ MERV 11 ਪਲੀਟਿਡ ਫ਼ਿਲਟਰ।"],
      ["Pleated na furnace filter", "MERV 11 na pleated filter na tugma sa return."],
    ), { price: 25 }),
  ]),

  // ── Controls ──
  "fq.hvac_repair.controls.maintain_capacitors": A("maintenance", [
    L.labour(1, "flat", 125, X(
      ["Capacitor testing", "Every start and run capacitor discharged and read against its rating, with any more than 6% low flagged."],
      ["Test des condensateurs", "Chaque condensateur de démarrage et de marche déchargé et mesuré par rapport à sa valeur, ceux à plus de 6 % sous la valeur signalés."],
      ["Prueba de capacitores", "Cada capacitor de arranque y de marcha descargado y medido contra su valor, marcando los que estén más de 6 % bajos."],
      ["Test dei condensatori", "Ogni condensatore di avvio e di marcia scaricato e misurato rispetto al valore, segnalati quelli oltre il 6 % sotto."],
      ["Kondensatorprüfung", "Jeder Anlauf- und Betriebskondensator entladen und gegen den Nennwert gemessen, alle mehr als 6 % darunter gemeldet."],
      ["Перевірка конденсаторів", "Кожен пусковий і робочий конденсатор розряджено й виміряно, ті, що нижче номіналу більш ніж на 6 %, позначено."],
      ["ਕੈਪੇਸਿਟਰ ਟੈਸਟ", "ਹਰ ਸਟਾਰਟ ਅਤੇ ਰਨ ਕੈਪੇਸਿਟਰ ਡਿਸਚਾਰਜ ਕਰਕੇ ਰੇਟਿੰਗ ਨਾਲ ਮਾਪਿਆ, 6% ਤੋਂ ਵੱਧ ਘੱਟ ਵਾਲੇ ਦੱਸੇ।"],
      ["Testing ng capacitor", "Dinischarge at sinukat laban sa rating ang bawat start at run capacitor, at minarkahan ang kulang nang higit 6%."],
    ), { cost: 60 }),
    L.material(1, "each", 75, X(
      ["Replacement capacitor, if one tests weak", "Dual run capacitor of the same rating, fitted only where a capacitor reads low."],
      ["Condensateur de remplacement, s'il est faible", "Condensateur double de même valeur, posé seulement si un condensateur est sous la valeur."],
      ["Capacitor de reemplazo, si sale débil", "Capacitor dual del mismo valor, colocado solo si alguno mide bajo."],
      ["Condensatore di ricambio, se debole", "Condensatore doppio dello stesso valore, montato solo se uno risulta basso."],
      ["Ersatzkondensator, falls einer schwach ist", "Doppelkondensator mit gleichem Wert, nur eingebaut, wenn einer zu niedrig misst."],
      ["Конденсатор на заміну, якщо слабкий", "Подвійний конденсатор того ж номіналу, лише якщо котрийсь нижче норми."],
      ["ਬਦਲਵਾਂ ਕੈਪੇਸਿਟਰ, ਜੇ ਕਮਜ਼ੋਰ ਨਿਕਲੇ", "ਉਸੇ ਰੇਟਿੰਗ ਦਾ ਡੁਅਲ ਰਨ ਕੈਪੇਸਿਟਰ, ਸਿਰਫ਼ ਜੇ ਕੋਈ ਘੱਟ ਪੜ੍ਹੇ।"],
      ["Kapalit na capacitor, kung mahina", "Dual run capacitor na parehong rating, ikakabit lang kung may mahina."],
    ), { cost: REF("capacitor_45_5").cost, ref: REF("capacitor_45_5"), optional: true }),
  ]),

  "fq.hvac_repair.controls.repair_defrost_board": A("repair", [
    DIAG(),
    L.labour(1, "flat", 150, X(
      ["Defrost board repair labour", "Defrost sensor, relay and timing checked, the failed part replaced or the board reset, and a forced defrost run to prove it."],
      ["Main-d'œuvre — réparation de la carte de dégivrage", "Sonde, relais et minuterie de dégivrage vérifiés, pièce défectueuse remplacée ou carte réinitialisée, dégivrage forcé pour le prouver."],
      ["Mano de obra — reparación de tarjeta de deshielo", "Sensor, relevador y tiempos de deshielo revisados, la pieza dañada reemplazada o la tarjeta reiniciada, y un deshielo forzado para comprobarlo."],
      ["Manodopera — riparazione scheda sbrinamento", "Sonda, relè e tempi di sbrinamento controllati, pezzo guasto sostituito o scheda ripristinata, sbrinamento forzato per provarlo."],
      ["Arbeit — Abtauplatine reparieren", "Abtaufühler, Relais und Zeiten geprüft, defektes Teil ersetzt oder Platine zurückgesetzt, Zwangsabtauung zum Nachweis gefahren."],
      ["Робота — ремонт плати відтавання", "Датчик, реле й таймінг відтавання перевірено, несправну деталь замінено чи плату скинуто, примусове відтавання запущено для перевірки."],
      ["ਡੀਫ੍ਰੌਸਟ ਬੋਰਡ ਮੁਰੰਮਤ ਦੀ ਲੇਬਰ", "ਡੀਫ੍ਰੌਸਟ ਸੈਂਸਰ, ਰੀਲੇਅ ਅਤੇ ਟਾਈਮਿੰਗ ਜਾਂਚੇ, ਖ਼ਰਾਬ ਪੁਰਜ਼ਾ ਬਦਲਿਆ ਜਾਂ ਬੋਰਡ ਰੀਸੈੱਟ, ਅਤੇ ਜ਼ਬਰਦਸਤੀ ਡੀਫ੍ਰੌਸਟ ਚਲਾ ਕੇ ਪੱਕਾ ਕੀਤਾ।"],
      ["Labor — ayos ng defrost board", "Chineck ang defrost sensor, relay at timing, pinalitan ang sirang parte o ni-reset ang board, at nag-force defrost para patunayan."],
    )),
    L.material(1, "flat", 45, X(
      ["Defrost sensor or relay", "The failed defrost thermostat, sensor or relay, matched to the board."],
      ["Sonde ou relais de dégivrage", "Thermostat, sonde ou relais de dégivrage défectueux, assorti à la carte."],
      ["Sensor o relevador de deshielo", "Termostato, sensor o relevador de deshielo dañado, compatible con la tarjeta."],
      ["Sonda o relè di sbrinamento", "Termostato, sonda o relè di sbrinamento guasto, compatibile con la scheda."],
      ["Abtaufühler oder Relais", "Das defekte Abtauthermostat, Fühler oder Relais, passend zur Platine."],
      ["Датчик або реле відтавання", "Несправний термостат, датчик чи реле відтавання під плату."],
      ["ਡੀਫ੍ਰੌਸਟ ਸੈਂਸਰ ਜਾਂ ਰੀਲੇਅ", "ਬੋਰਡ ਮੁਤਾਬਕ ਖ਼ਰਾਬ ਡੀਫ੍ਰੌਸਟ ਥਰਮੋਸਟੈਟ, ਸੈਂਸਰ ਜਾਂ ਰੀਲੇਅ।"],
      ["Defrost sensor o relay", "Ang sirang defrost thermostat, sensor o relay na tugma sa board."],
    ), { cost: 30 }),
  ]),

  "fq.hvac_repair.maintenance.seal_attic_crawlspace": A("repair", [
    L.labour(1, "flat", 420, X(
      ["Air sealing — attic and crawlspace", "Top plates, wire and pipe penetrations, chases and the hatch sealed, and rodent entry points closed with mesh."],
      ["Étanchéisation — grenier et vide sanitaire", "Sablières, passages de fils et de tuyaux, puits techniques et trappe scellés, entrées de rongeurs fermées au grillage."],
      ["Sellado de aire — ático y sótano", "Soleras, pasos de cables y tubos, ductos y la escotilla sellados, y entradas de roedores cerradas con malla."],
      ["Sigillatura — sottotetto e vespaio", "Correnti, passaggi di cavi e tubi, cavedi e botola sigillati, accessi dei roditori chiusi con rete."],
      ["Luftabdichtung — Dachboden und Kriechkeller", "Rähme, Kabel- und Rohrdurchführungen, Schächte und Luke abgedichtet, Nagerzugänge mit Gitter verschlossen."],
      ["Герметизація — горище й підпілля", "Обв'язку, проходи кабелів і труб, шахти й люк загерметизовано, лази гризунів закрито сіткою."],
      ["ਏਅਰ ਸੀਲਿੰਗ — ਅਟਾਰੀ ਅਤੇ ਕ੍ਰੌਲਸਪੇਸ", "ਟੌਪ ਪਲੇਟਾਂ, ਤਾਰ ਅਤੇ ਪਾਈਪ ਦੇ ਛੇਕ, ਚੇਜ਼ ਅਤੇ ਹੈਚ ਸੀਲ ਕੀਤੇ, ਅਤੇ ਚੂਹਿਆਂ ਦੇ ਰਸਤੇ ਜਾਲੀ ਨਾਲ ਬੰਦ।"],
      ["Air sealing — attic at crawlspace", "Sinelyuhan ang top plate, butas ng wire at tubo, chase at hatch, at tinakpan ng mesh ang daanan ng daga."],
    )),
    L.material(1, "flat", 110, X(
      ["Foam, fire-block sealant and mesh", "Spray foam, fire-rated sealant, caulk and steel mesh for the openings found."],
      ["Mousse, scellant coupe-feu et grillage", "Mousse isolante, scellant coupe-feu, calfeutrant et grillage d'acier pour les ouvertures trouvées."],
      ["Espuma, sellador cortafuego y malla", "Espuma, sellador cortafuego, calafateo y malla de acero para las aberturas encontradas."],
      ["Schiuma, sigillante tagliafuoco e rete", "Schiuma, sigillante tagliafuoco, silicone e rete d'acciaio per le aperture trovate."],
      ["Schaum, Brandschutzdichtstoff und Gitter", "Montageschaum, Brandschutzdichtstoff, Fugenmasse und Stahlgitter für die gefundenen Öffnungen."],
      ["Піна, протипожежний герметик і сітка", "Монтажна піна, протипожежний герметик, шпаклівка й сталева сітка для знайдених отворів."],
      ["ਫ਼ੋਮ, ਅੱਗ-ਰੋਧਕ ਸੀਲੈਂਟ ਅਤੇ ਜਾਲੀ", "ਲੱਭੇ ਛੇਕਾਂ ਲਈ ਸਪ੍ਰੇ ਫ਼ੋਮ, ਅੱਗ-ਰੋਧਕ ਸੀਲੈਂਟ, ਕੌਲਕ ਅਤੇ ਸਟੀਲ ਜਾਲੀ।"],
      ["Foam, fire-block sealant at mesh", "Spray foam, fire-rated sealant, caulk at steel mesh para sa mga butas na nakita."],
    ), { cost: 80 }),
  ]),

  "fq.hvac_repair.controls.replace_contactor": A("repair", [
    L.labour(1, "flat", 175, X(
      ["Contactor replacement labour", "Power isolated, the pitted contactor swapped wire for wire, and the outdoor unit cycled on and off from the thermostat."],
      ["Main-d'œuvre — remplacement du contacteur", "Alimentation coupée, contacteur piqué remplacé fil pour fil, appareil extérieur démarré et arrêté depuis le thermostat."],
      ["Mano de obra — reemplazo del contactor", "Energía aislada, contactor picado cambiado cable por cable, y la unidad exterior encendida y apagada desde el termostato."],
      ["Manodopera — sostituzione contattore", "Alimentazione isolata, contattore vaiolato sostituito filo per filo, unità esterna accesa e spenta dal termostato."],
      ["Arbeit — Schütz tauschen", "Strom getrennt, verbranntes Schütz Draht für Draht ersetzt und das Außengerät vom Thermostat aus ein- und ausgeschaltet."],
      ["Робота — заміна контактора", "Живлення вимкнено, обгорілий контактор замінено провід у провід, зовнішній блок увімкнено й вимкнено з термостата."],
      ["ਕੌਂਟੈਕਟਰ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਬਿਜਲੀ ਬੰਦ, ਸੜਿਆ ਕੌਂਟੈਕਟਰ ਤਾਰ-ਦਰ-ਤਾਰ ਬਦਲਿਆ, ਅਤੇ ਥਰਮੋਸਟੈਟ ਤੋਂ ਬਾਹਰੀ ਯੂਨਿਟ ਚਾਲੂ-ਬੰਦ ਕੀਤਾ।"],
      ["Labor — palit ng contactor", "Pinatay ang kuryente, pinalitan wire-per-wire ang sunog na contactor, at in-on at off ang outdoor unit mula sa thermostat."],
    )),
    hdMaterial(REF("contactor_30a"), X(
      ["Contactor — 30 A, 24 V coil", "Definite-purpose contactor with a 24 V coil, matched to the unit's poles."],
      ["Contacteur — 30 A, bobine 24 V", "Contacteur à usage défini, bobine 24 V, assorti aux pôles de l'appareil."],
      ["Contactor — 30 A, bobina de 24 V", "Contactor de propósito definido con bobina de 24 V, según los polos del equipo."],
      ["Contattore — 30 A, bobina 24 V", "Contattore con bobina a 24 V, adatto ai poli dell'unità."],
      ["Schütz — 30 A, 24-V-Spule", "Schütz mit 24-V-Spule passend zur Polzahl des Geräts."],
      ["Контактор — 30 А, котушка 24 В", "Контактор із котушкою 24 В під кількість полюсів блока."],
      ["ਕੌਂਟੈਕਟਰ — 30 A, 24 V ਕੋਇਲ", "ਯੂਨਿਟ ਦੇ ਪੋਲਾਂ ਮੁਤਾਬਕ 24 V ਕੋਇਲ ਵਾਲਾ ਕੌਂਟੈਕਟਰ।"],
      ["Contactor — 30 A, 24 V coil", "Contactor na may 24 V coil na tugma sa poles ng unit."],
    ), { price: 55 }),
  ]),

  "fq.hvac_repair.maintenance.blown_in_insulation": A("installation", [
    L.labour(1, "flat", 150, X(
      ["Attic prep — baffles and hatch dam", "Soffit baffles set so the vents stay open, a dam built around the hatch and depth rulers stapled up."],
      ["Préparation du grenier — déflecteurs et barrage de trappe", "Déflecteurs posés pour garder les soffites ouverts, barrage construit autour de la trappe et règles de profondeur agrafées."],
      ["Preparación del ático — deflectores y barrera de escotilla", "Deflectores colocados para que las ventilas queden libres, barrera alrededor de la escotilla y reglas de profundidad engrapadas."],
      ["Preparazione sottotetto — deflettori e bordo botola", "Deflettori posati perché le prese d'aria restino libere, bordo attorno alla botola e righelli di spessore graffettati."],
      ["Dachbodenvorbereitung — Lüftungskeile und Lukenrand", "Traufkeile gesetzt, damit die Lüftung frei bleibt, ein Rand um die Luke gebaut und Höhenmarken angetackert."],
      ["Підготовка горища — дефлектори й бортик люка", "Дефлектори встановлено, щоб вентиляція лишалась відкритою, бортик навколо люка, лінійки глибини прибито."],
      ["ਅਟਾਰੀ ਤਿਆਰੀ — ਬੈਫ਼ਲ ਅਤੇ ਹੈਚ ਬੰਨ੍ਹ", "ਸੌਫ਼ਿਟ ਬੈਫ਼ਲ ਲਾਏ ਤਾਂ ਜੋ ਵੈਂਟ ਖੁੱਲ੍ਹੇ ਰਹਿਣ, ਹੈਚ ਦੁਆਲੇ ਬੰਨ੍ਹ ਅਤੇ ਡੂੰਘਾਈ ਵਾਲੇ ਨਿਸ਼ਾਨ ਲਾਏ।"],
      ["Paghahanda ng attic — baffle at harang sa hatch", "Ikinabit ang soffit baffle para bukas ang vent, gumawa ng harang sa hatch at nag-staple ng depth ruler."],
    )),
    L.labour(1, "sqft", 0.75, X(
      ["Blown-in insulation — per sq ft", "Loose-fill blown evenly to the agreed depth over the attic floor, checked against the rulers."],
      ["Isolant soufflé — le pi²", "Isolant en vrac soufflé uniformément à l'épaisseur convenue sur le plancher du grenier, vérifié aux règles."],
      ["Aislante soplado — por pie²", "Aislante suelto soplado parejo a la profundidad acordada sobre el piso del ático, revisado con las reglas."],
      ["Isolante insufflato — al piede²", "Isolante sfuso insufflato in modo uniforme allo spessore concordato sul solaio, verificato sui righelli."],
      ["Einblasdämmung — pro Quadratfuß", "Schüttdämmung gleichmäßig in der vereinbarten Höhe auf den Dachboden geblasen, an den Marken geprüft."],
      ["Видувна ізоляція — за кв. фут", "Насипну ізоляцію рівно видуто до погодженої товщини по підлозі горища, перевірено по лінійках."],
      ["ਬਲੋਨ-ਇਨ ਇੰਸੂਲੇਸ਼ਨ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਅਟਾਰੀ ਦੇ ਫ਼ਰਸ਼ 'ਤੇ ਤੈਅ ਡੂੰਘਾਈ ਤੱਕ ਬਰਾਬਰ ਢਿੱਲੀ ਇੰਸੂਲੇਸ਼ਨ ਉਡਾਈ, ਨਿਸ਼ਾਨਾਂ ਨਾਲ ਜਾਂਚੀ।"],
      ["Blown-in insulation — kada sq ft", "Pantay na hinipan ang loose-fill hanggang sa napagkasunduang kapal sa sahig ng attic, chineck sa ruler."],
    ), { measurementKey: "areaSqFt" }),
    L.material(1, "bag", 60, X(
      ["Loose-fill fibreglass — R-38", "Blowing-wool bags; one bag covers about 40 sq ft at R-38."],
      ["Laine de verre en vrac — R-38", "Sacs de laine à souffler; un sac couvre environ 40 pi² à R-38."],
      ["Fibra de vidrio suelta — R-38", "Bolsas de lana para soplar; una bolsa cubre unos 40 pies² a R-38."],
      ["Lana di vetro sfusa — R-38", "Sacchi di lana da insufflaggio; un sacco copre circa 40 piedi² a R-38."],
      ["Glaswolle-Einblasdämmung — R-38", "Säcke Einblaswolle; ein Sack deckt etwa 40 Quadratfuß bei R-38."],
      ["Насипна скловата — R-38", "Мішки вати для видування; один мішок покриває близько 40 кв. футів при R-38."],
      ["ਢਿੱਲੀ ਫ਼ਾਈਬਰਗਲਾਸ — R-38", "ਉਡਾਉਣ ਵਾਲੀ ਉੱਨ ਦੇ ਥੈਲੇ; ਇੱਕ ਥੈਲਾ R-38 'ਤੇ ਲਗਭਗ 40 ਵਰਗ ਫੁੱਟ।"],
      ["Loose-fill fiberglass — R-38", "Bag ng blowing wool; isang bag ay mga 40 sq ft sa R-38."],
    ), { cost: 45, measurementKey: "areaSqFt", coverage: { per: 40, unit: "sqft" } }),
  ]),

  "fq.hvac_repair.controls.thermostat_wiring": A("repair", [
    L.labour(1, "flat", 150, X(
      ["Thermostat wire check and replacement", "Each conductor tested end to end; a broken or short run replaced with new cable pulled from the equipment to the thermostat."],
      ["Vérification et remplacement du fil de thermostat", "Chaque conducteur testé d'un bout à l'autre; un fil coupé ou trop court remplacé par un câble neuf tiré de l'appareil au thermostat."],
      ["Revisión y cambio del cable del termostato", "Cada conductor probado de punta a punta; un tramo roto o corto reemplazado con cable nuevo del equipo al termostato."],
      ["Verifica e sostituzione cavo del termostato", "Ogni conduttore provato da capo a capo; tratto rotto o corto sostituito con cavo nuovo dall'apparecchio al termostato."],
      ["Thermostatleitung prüfen und erneuern", "Jede Ader durchgehend geprüft; eine defekte oder zu kurze Leitung durch neues Kabel vom Gerät zum Thermostat ersetzt."],
      ["Перевірка й заміна кабелю термостата", "Кожну жилу перевірено від кінця до кінця; обірваний чи короткий кабель замінено новим від обладнання до термостата."],
      ["ਥਰਮੋਸਟੈਟ ਤਾਰ ਜਾਂਚ ਅਤੇ ਬਦਲਣਾ", "ਹਰ ਤਾਰ ਸਿਰੇ ਤੋਂ ਸਿਰੇ ਤੱਕ ਟੈਸਟ; ਟੁੱਟੀ ਜਾਂ ਛੋਟੀ ਤਾਰ ਉਪਕਰਣ ਤੋਂ ਥਰਮੋਸਟੈਟ ਤੱਕ ਨਵੀਂ ਕੇਬਲ ਨਾਲ ਬਦਲੀ।"],
      ["Check at palit ng thermostat wire", "Sinubukan ang bawat wire mula dulo hanggang dulo; pinalitan ng bagong cable mula unit hanggang thermostat ang putol o maikli."],
    )),
    L.material(1, "flat", 30, X(
      ["Thermostat cable — 18/8, up to 50 ft", "Eight-conductor 18 AWG thermostat cable."],
      ["Câble de thermostat — 18/8, jusqu'à 50 pi", "Câble de thermostat à huit conducteurs, calibre 18."],
      ["Cable de termostato — 18/8, hasta 50 pies", "Cable de termostato de ocho conductores calibre 18."],
      ["Cavo termostato — 18/8, fino a 50 piedi", "Cavo termostato a otto conduttori, 18 AWG."],
      ["Thermostatkabel — 18/8, bis 50 Fuß", "Achtadriges Thermostatkabel 18 AWG."],
      ["Кабель термостата — 18/8, до 50 футів", "Восьмижильний кабель термостата 18 AWG."],
      ["ਥਰਮੋਸਟੈਟ ਕੇਬਲ — 18/8, 50 ਫੁੱਟ ਤੱਕ", "ਅੱਠ-ਤਾਰ 18 AWG ਥਰਮੋਸਟੈਟ ਕੇਬਲ।"],
      ["Thermostat cable — 18/8, hanggang 50 ft", "Eight-conductor na 18 AWG thermostat cable."],
    ), { cost: 20 }),
  ]),

  "fq.hvac_repair.controls.install_control_board": A("repair", [
    L.labour(1, "flat", 175, X(
      ["Control board installation labour", "Wires labelled and moved over one by one, the board mounted, dip switches set to the old board and every stage run."],
      ["Main-d'œuvre — pose de la carte de commande", "Fils identifiés et transférés un à un, carte fixée, micro-interrupteurs réglés comme l'ancienne et chaque étage testé."],
      ["Mano de obra — instalación de tarjeta de control", "Cables marcados y pasados uno por uno, tarjeta montada, microinterruptores como en la vieja y cada etapa probada."],
      ["Manodopera — posa scheda di controllo", "Fili etichettati e spostati uno a uno, scheda montata, dip switch come la vecchia e ogni stadio provato."],
      ["Arbeit — Steuerplatine einbauen", "Adern beschriftet und einzeln umgeklemmt, Platine montiert, DIP-Schalter wie bei der alten gesetzt und jede Stufe gefahren."],
      ["Робота — встановлення плати керування", "Дроти підписано й перенесено по одному, плату закріплено, перемикачі виставлено як на старій, кожен ступінь перевірено."],
      ["ਕੰਟਰੋਲ ਬੋਰਡ ਲਾਉਣ ਦੀ ਲੇਬਰ", "ਤਾਰਾਂ 'ਤੇ ਲੇਬਲ ਲਾ ਕੇ ਇੱਕ-ਇੱਕ ਕਰਕੇ ਬਦਲੀਆਂ, ਬੋਰਡ ਲਾਇਆ, ਡਿੱਪ ਸਵਿੱਚ ਪੁਰਾਣੇ ਵਾਂਗ ਅਤੇ ਹਰ ਸਟੇਜ ਚਲਾਈ।"],
      ["Labor — pagkabit ng control board", "Nilagyan ng label at inilipat isa-isa ang wire, ikinabit ang board, in-set ang dip switch gaya ng luma at pinatakbo ang bawat stage."],
    )),
    L.material(1, "each", 240, X(
      ["Furnace or air-handler control board", "OEM or universal replacement board matched to the equipment."],
      ["Carte de commande de fournaise ou d'appareil", "Carte d'origine ou universelle assortie à l'appareil."],
      ["Tarjeta de control del horno o manejador", "Tarjeta original o universal compatible con el equipo."],
      ["Scheda di controllo generatore o unità", "Scheda originale o universale adatta all'apparecchio."],
      ["Steuerplatine für Ofen oder Lüftungsgerät", "Original- oder Universalplatine passend zum Gerät."],
      ["Плата керування печі чи повітрообробника", "Оригінальна чи універсальна плата під обладнання."],
      ["ਫ਼ਰਨੇਸ ਜਾਂ ਏਅਰ ਹੈਂਡਲਰ ਕੰਟਰੋਲ ਬੋਰਡ", "ਉਪਕਰਣ ਮੁਤਾਬਕ ਅਸਲੀ ਜਾਂ ਯੂਨੀਵਰਸਲ ਬੋਰਡ।"],
      ["Control board ng furnace o air handler", "OEM o universal na kapalit na board na tugma sa unit."],
    ), { cost: 170 }),
  ]),

  "fq.hvac_repair.controls.replace_fuses": A("repair", [
    DIAG(),
    L.labour(1, "flat", 95, X(
      ["Fuse replacement and cause found", "The short or overload behind the blown fuse traced and cleared before the new fuses go in and the system is run."],
      ["Remplacement des fusibles et cause trouvée", "Court-circuit ou surcharge à l'origine du fusible grillé trouvé et corrigé avant de poser les fusibles neufs et de démarrer."],
      ["Cambio de fusibles y causa encontrada", "El corto o la sobrecarga detrás del fusible fundido localizado y corregido antes de poner los nuevos y arrancar."],
      ["Sostituzione fusibili e causa trovata", "Corto o sovraccarico dietro il fusibile bruciato trovato ed eliminato prima di montare i nuovi e avviare."],
      ["Sicherungen tauschen und Ursache finden", "Kurzschluss oder Überlast hinter der durchgebrannten Sicherung gefunden und behoben, bevor neue eingesetzt und die Anlage gestartet wird."],
      ["Заміна запобіжників і пошук причини", "Коротке замикання чи перевантаження, через які згорів запобіжник, знайдено й усунено до встановлення нових і запуску."],
      ["ਫ਼ਿਊਜ਼ ਬਦਲਣਾ ਅਤੇ ਕਾਰਨ ਲੱਭਣਾ", "ਨਵੇਂ ਫ਼ਿਊਜ਼ ਲਾਉਣ ਅਤੇ ਚਲਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਸੜੇ ਫ਼ਿਊਜ਼ ਪਿਛਲਾ ਸ਼ਾਰਟ ਜਾਂ ਓਵਰਲੋਡ ਲੱਭ ਕੇ ਠੀਕ ਕੀਤਾ।"],
      ["Palit ng fuse at hinanap ang sanhi", "Hinanap at inayos ang short o overload na nagpaputok sa fuse bago ikabit ang bago at paandarin."],
    )),
    L.material(1, "flat", 20, X(
      ["Fuses — correct rating", "Low-voltage and disconnect fuses of the rating on the equipment label."],
      ["Fusibles — bon calibre", "Fusibles basse tension et de sectionneur au calibre indiqué sur l'étiquette de l'appareil."],
      ["Fusibles — capacidad correcta", "Fusibles de bajo voltaje y del desconectador con la capacidad de la etiqueta del equipo."],
      ["Fusibili — portata corretta", "Fusibili a bassa tensione e del sezionatore della portata in targa."],
      ["Sicherungen — richtiger Nennwert", "Kleinspannungs- und Trennschaltersicherungen mit dem Wert vom Typenschild."],
      ["Запобіжники — правильного номіналу", "Низьковольтні запобіжники та запобіжники вимикача номіналу з таблички."],
      ["ਫ਼ਿਊਜ਼ — ਸਹੀ ਰੇਟਿੰਗ", "ਉਪਕਰਣ ਲੇਬਲ ਦੀ ਰੇਟਿੰਗ ਵਾਲੇ ਲੋ-ਵੋਲਟੇਜ ਅਤੇ ਡਿਸਕਨੈਕਟ ਫ਼ਿਊਜ਼।"],
      ["Fuse — tamang rating", "Low-voltage at disconnect na fuse ayon sa rating sa label ng unit."],
    ), { cost: 10 }),
  ]),

  "fq.hvac_repair.maintenance.repair_insulation": A("repair", [
    L.labour(1, "flat", 175, X(
      ["Line set and duct insulation repair", "Rotted or torn insulation cut away, new insulation fitted and the joints sealed and wrapped against sun and moisture."],
      ["Réparation de l'isolant des conduites et conduits", "Isolant pourri ou déchiré retiré, isolant neuf posé, joints scellés et protégés du soleil et de l'humidité."],
      ["Reparación del aislamiento de tubería y ductos", "Aislante podrido o roto retirado, aislante nuevo colocado y las uniones selladas y cubiertas contra sol y humedad."],
      ["Riparazione isolamento linee e condotti", "Isolante marcio o strappato tolto, isolante nuovo montato, giunti sigillati e protetti da sole e umidità."],
      ["Dämmung von Leitungen und Kanälen reparieren", "Morsche oder gerissene Dämmung entfernt, neue angebracht, Stöße gegen Sonne und Feuchte abgedichtet und umwickelt."],
      ["Ремонт ізоляції траси й повітроводів", "Згнилу чи порвану ізоляцію знято, нову встановлено, стики загерметизовано й захищено від сонця й вологи."],
      ["ਲਾਈਨ ਸੈੱਟ ਅਤੇ ਡਕਟ ਇੰਸੂਲੇਸ਼ਨ ਮੁਰੰਮਤ", "ਗਲੀ ਜਾਂ ਫਟੀ ਇੰਸੂਲੇਸ਼ਨ ਕੱਟੀ, ਨਵੀਂ ਲਾਈ ਅਤੇ ਜੋੜ ਧੁੱਪ ਅਤੇ ਨਮੀ ਤੋਂ ਸੀਲ ਕਰਕੇ ਲਪੇਟੇ।"],
      ["Pag-ayos ng insulation ng line set at duct", "Tinanggal ang bulok o punit na insulation, ikinabit ang bago at sinelyuhan at binalot ang dugtungan laban sa araw at halumigmig."],
    )),
    L.material(1, "flat", 45, X(
      ["Line-set insulation and UV wrap", "Closed-cell pipe insulation, UV-resistant wrap and tape."],
      ["Isolant de conduite et ruban anti-UV", "Isolant à cellules fermées, ruban résistant aux UV et adhésif."],
      ["Aislante de tubería y cinta UV", "Aislante de celda cerrada, cinta resistente a UV y adhesivo."],
      ["Isolante per tubi e nastro anti-UV", "Isolante a celle chiuse, fascia resistente ai raggi UV e nastro."],
      ["Leitungsdämmung und UV-Band", "Geschlossenzellige Rohrdämmung, UV-beständiges Wickelband und Klebeband."],
      ["Ізоляція траси та УФ-стрічка", "Закритоклітинна ізоляція, стійка до УФ обмотка й стрічка."],
      ["ਲਾਈਨ ਸੈੱਟ ਇੰਸੂਲੇਸ਼ਨ ਅਤੇ UV ਰੈਪ", "ਕਲੋਜ਼ਡ-ਸੈੱਲ ਪਾਈਪ ਇੰਸੂਲੇਸ਼ਨ, UV-ਰੋਧਕ ਰੈਪ ਅਤੇ ਟੇਪ।"],
      ["Line set insulation at UV wrap", "Closed-cell na pipe insulation, UV-resistant na wrap at tape."],
    ), { cost: 30 }),
  ]),

  "fq.hvac_repair.maintenance.generator_maintenance": A("maintenance", [
    L.labour(1, "flat", 199, X(
      ["Generator service — oil, filters, battery and load test", "Oil and filters changed, the battery and plugs checked, the transfer switch exercised and the set run under load."],
      ["Entretien de génératrice — huile, filtres, batterie et essai en charge", "Huile et filtres changés, batterie et bougies vérifiées, commutateur de transfert actionné et groupe testé en charge."],
      ["Servicio de generador — aceite, filtros, batería y prueba con carga", "Aceite y filtros cambiados, batería y bujías revisadas, el interruptor de transferencia accionado y el equipo probado con carga."],
      ["Manutenzione generatore — olio, filtri, batteria e prova sotto carico", "Olio e filtri cambiati, batteria e candele controllate, commutatore azionato e gruppo provato sotto carico."],
      ["Generatorwartung — Öl, Filter, Batterie und Lasttest", "Öl und Filter gewechselt, Batterie und Zündkerzen geprüft, Umschalter betätigt und das Aggregat unter Last gefahren."],
      ["Обслуговування генератора — олива, фільтри, акумулятор і тест", "Оливу й фільтри замінено, акумулятор і свічки перевірено, перемикач задіяно, агрегат запущено під навантаженням."],
      ["ਜਨਰੇਟਰ ਸਰਵਿਸ — ਤੇਲ, ਫ਼ਿਲਟਰ, ਬੈਟਰੀ ਅਤੇ ਲੋਡ ਟੈਸਟ", "ਤੇਲ ਅਤੇ ਫ਼ਿਲਟਰ ਬਦਲੇ, ਬੈਟਰੀ ਅਤੇ ਪਲੱਗ ਜਾਂਚੇ, ਟ੍ਰਾਂਸਫ਼ਰ ਸਵਿੱਚ ਚਲਾਇਆ ਅਤੇ ਲੋਡ 'ਤੇ ਚਲਾਇਆ।"],
      ["Serbisyo ng generator — langis, filter, baterya at load test", "Pinalitan ang langis at filter, chineck ang baterya at plug, pinagana ang transfer switch at pinaandar nang may load."],
    ), { cost: 100 }),
    L.material(1, "flat", 55, X(
      ["Oil, oil filter and air filter", "Synthetic oil and the filters the generator's service kit calls for."],
      ["Huile, filtre à huile et filtre à air", "Huile synthétique et filtres prévus par la trousse d'entretien de la génératrice."],
      ["Aceite, filtro de aceite y de aire", "Aceite sintético y los filtros del kit de servicio del generador."],
      ["Olio, filtro olio e filtro aria", "Olio sintetico e i filtri del kit di manutenzione del generatore."],
      ["Öl, Ölfilter und Luftfilter", "Synthetiköl und die Filter aus dem Wartungssatz des Generators."],
      ["Олива, масляний і повітряний фільтри", "Синтетична олива й фільтри з сервісного набору генератора."],
      ["ਤੇਲ, ਤੇਲ ਫ਼ਿਲਟਰ ਅਤੇ ਏਅਰ ਫ਼ਿਲਟਰ", "ਸਿੰਥੈਟਿਕ ਤੇਲ ਅਤੇ ਜਨਰੇਟਰ ਦੀ ਸਰਵਿਸ ਕਿੱਟ ਵਾਲੇ ਫ਼ਿਲਟਰ।"],
      ["Langis, oil filter at air filter", "Synthetic na langis at ang mga filter sa service kit ng generator."],
    ), { cost: 40 }),
  ]),

  "fq.hvac_repair.controls.thermostat_repair": A("repair", [
    L.labour(1, "flat", 115, X(
      ["Thermostat repair and recalibration", "Terminals and wiring checked, the sensor offset and settings corrected, and a heat and cool call run from it."],
      ["Réparation et recalibrage du thermostat", "Bornes et câblage vérifiés, décalage de la sonde et réglages corrigés, appel de chauffage et de climatisation lancé."],
      ["Reparación y recalibración del termostato", "Terminales y cableado revisados, el desfase del sensor y los ajustes corregidos, y una llamada de calor y frío lanzada."],
      ["Riparazione e ricalibrazione termostato", "Morsetti e cablaggio controllati, offset della sonda e impostazioni corretti, chiamata di caldo e freddo avviata."],
      ["Thermostat reparieren und kalibrieren", "Klemmen und Verkabelung geprüft, Fühlerabweichung und Einstellungen korrigiert, Heiz- und Kühlaufruf gefahren."],
      ["Ремонт і калібрування термостата", "Клеми й проводку перевірено, зсув датчика й налаштування виправлено, запит на тепло й холод запущено."],
      ["ਥਰਮੋਸਟੈਟ ਮੁਰੰਮਤ ਅਤੇ ਕੈਲੀਬ੍ਰੇਸ਼ਨ", "ਟਰਮੀਨਲ ਅਤੇ ਤਾਰਾਂ ਜਾਂਚੀਆਂ, ਸੈਂਸਰ ਆਫ਼ਸੈੱਟ ਅਤੇ ਸੈਟਿੰਗਾਂ ਠੀਕ, ਅਤੇ ਗਰਮ ਤੇ ਠੰਢਾ ਚਲਾ ਕੇ ਦੇਖਿਆ।"],
      ["Ayos at recalibrate ng thermostat", "Chineck ang terminal at wiring, itinama ang offset ng sensor at setting, at pinatakbo ang heat at cool mula rito."],
    )),
    L.material(1, "flat", 10, X(
      ["Batteries and terminal parts", "Fresh batteries and any sub-base screws or jumpers needed."],
      ["Piles et pièces de bornier", "Piles neuves et vis de socle ou cavaliers nécessaires."],
      ["Baterías y piezas de terminales", "Baterías nuevas y los tornillos de base o puentes necesarios."],
      ["Batterie e minuteria dei morsetti", "Batterie nuove e viti della base o ponticelli necessari."],
      ["Batterien und Klemmenteile", "Neue Batterien und nötige Sockelschrauben oder Brücken."],
      ["Батареї й клемні деталі", "Нові батареї та потрібні гвинти основи чи перемички."],
      ["ਬੈਟਰੀਆਂ ਅਤੇ ਟਰਮੀਨਲ ਪੁਰਜ਼ੇ", "ਨਵੀਆਂ ਬੈਟਰੀਆਂ ਅਤੇ ਲੋੜੀਂਦੇ ਬੇਸ ਪੇਚ ਜਾਂ ਜੰਪਰ।"],
      ["Baterya at piyesa ng terminal", "Bagong baterya at kailangang turnilyo o jumper sa base."],
    ), { cost: 5 }),
    THERMOSTAT({ optional: true }),
  ]),

  "fq.hvac_repair.controls.repair_control_board": A("repair", [
    DIAG(),
    L.labour(1, "flat", 275, X(
      ["Control board repair labour", "The failed relay, fuse or sensor input found on the board, the component replaced or the joint resoldered, and every stage run."],
      ["Main-d'œuvre — réparation de la carte de commande", "Relais, fusible ou entrée de sonde défectueux trouvé sur la carte, composant remplacé ou soudure refaite, chaque étage testé."],
      ["Mano de obra — reparación de tarjeta de control", "Relevador, fusible o entrada de sensor dañado localizado, el componente cambiado o la soldadura rehecha, y cada etapa probada."],
      ["Manodopera — riparazione scheda di controllo", "Relè, fusibile o ingresso sonda guasto trovato, componente sostituito o saldatura rifatta, ogni stadio provato."],
      ["Arbeit — Steuerplatine reparieren", "Defektes Relais, Sicherung oder Fühlereingang auf der Platine gefunden, Bauteil ersetzt oder Lötstelle nachgelötet, jede Stufe gefahren."],
      ["Робота — ремонт плати керування", "Несправне реле, запобіжник чи вхід датчика знайдено, елемент замінено чи пайку відновлено, кожен ступінь перевірено."],
      ["ਕੰਟਰੋਲ ਬੋਰਡ ਮੁਰੰਮਤ ਦੀ ਲੇਬਰ", "ਬੋਰਡ 'ਤੇ ਖ਼ਰਾਬ ਰੀਲੇਅ, ਫ਼ਿਊਜ਼ ਜਾਂ ਸੈਂਸਰ ਇਨਪੁੱਟ ਲੱਭਿਆ, ਪੁਰਜ਼ਾ ਬਦਲਿਆ ਜਾਂ ਟਾਂਕਾ ਮੁੜ ਲਾਇਆ, ਅਤੇ ਹਰ ਸਟੇਜ ਚਲਾਈ।"],
      ["Labor — ayos ng control board", "Hinanap sa board ang sirang relay, fuse o sensor input, pinalitan ang piyesa o hinang ulit ang joint, at pinatakbo ang bawat stage."],
    )),
    L.material(1, "flat", 85, X(
      ["Relay, fuse or sensor parts", "The board-level components the repair needs."],
      ["Relais, fusible ou pièces de sonde", "Les composants de carte que la réparation demande."],
      ["Relevador, fusible o piezas de sensor", "Los componentes de la tarjeta que necesita la reparación."],
      ["Relè, fusibile o pezzi della sonda", "I componenti della scheda richiesti dalla riparazione."],
      ["Relais, Sicherung oder Fühlerteile", "Die Bauteile auf Platinenebene, die die Reparatur braucht."],
      ["Реле, запобіжник чи деталі датчика", "Компоненти плати, потрібні для ремонту."],
      ["ਰੀਲੇਅ, ਫ਼ਿਊਜ਼ ਜਾਂ ਸੈਂਸਰ ਪੁਰਜ਼ੇ", "ਮੁਰੰਮਤ ਲਈ ਲੋੜੀਂਦੇ ਬੋਰਡ ਦੇ ਪੁਰਜ਼ੇ।"],
      ["Relay, fuse o piyesa ng sensor", "Ang mga piyesa sa board na kailangan ng ayos."],
    ), { cost: 55 }),
  ]),

  // ── Heat exchanger and venting ──
  "fq.hvac_repair.heat_exchanger.clean_check_burners": A("maintenance", [
    L.labour(1, "flat", 129, X(
      ["Burner cleaning and flame check", "Burners pulled and brushed, orifices cleared, the flame sensor polished and the flame pattern watched on relight."],
      ["Nettoyage des brûleurs et vérification de la flamme", "Brûleurs sortis et brossés, orifices dégagés, détecteur de flamme poli et forme de la flamme observée au rallumage."],
      ["Limpieza de quemadores y revisión de flama", "Quemadores sacados y cepillados, orificios destapados, sensor de flama pulido y el patrón de flama observado al reencender."],
      ["Pulizia bruciatori e controllo fiamma", "Bruciatori estratti e spazzolati, ugelli liberati, sensore di fiamma lucidato e forma della fiamma osservata alla riaccensione."],
      ["Brennerreinigung und Flammenprüfung", "Brenner ausgebaut und gebürstet, Düsen frei gemacht, Flammenfühler poliert und das Flammenbild beim Wiederzünden beobachtet."],
      ["Чищення пальників і перевірка полум'я", "Пальники знято й вичищено, форсунки прочищено, датчик полум'я відполіровано, форму полум'я перевірено при запуску."],
      ["ਬਰਨਰ ਸਫ਼ਾਈ ਅਤੇ ਲਾਟ ਜਾਂਚ", "ਬਰਨਰ ਕੱਢ ਕੇ ਬੁਰਸ਼ ਕੀਤੇ, ਛੇਕ ਖੋਲ੍ਹੇ, ਫ਼ਲੇਮ ਸੈਂਸਰ ਚਮਕਾਇਆ ਅਤੇ ਮੁੜ ਜਗਾਉਣ 'ਤੇ ਲਾਟ ਦੀ ਸ਼ਕਲ ਦੇਖੀ।"],
      ["Paglinis ng burner at check ng apoy", "Hinugot at biniristsa ang burner, nilinis ang orifice, pinakintab ang flame sensor at tiningnan ang hugis ng apoy pagsindi ulit."],
    ), { cost: 65 }),
    COMBUSTION_TEST(25),
  ]),

  "fq.hvac_repair.heat_exchanger.replace": A("repair", [
    L.labour(1, "flat", 850, X(
      ["Heat exchanger replacement labour", "Furnace stripped down to the exchanger, the cracked one replaced, the furnace rebuilt with new gaskets and fired."],
      ["Main-d'œuvre — remplacement de l'échangeur", "Fournaise démontée jusqu'à l'échangeur, échangeur fissuré remplacé, fournaise remontée avec joints neufs et allumée."],
      ["Mano de obra — reemplazo del intercambiador", "Horno desarmado hasta el intercambiador, el agrietado reemplazado, el horno rearmado con empaques nuevos y encendido."],
      ["Manodopera — sostituzione scambiatore", "Generatore smontato fino allo scambiatore, quello crepato sostituito, rimontato con guarnizioni nuove e acceso."],
      ["Arbeit — Wärmetauscher tauschen", "Ofen bis zum Wärmetauscher zerlegt, der gerissene ersetzt, mit neuen Dichtungen wieder aufgebaut und gezündet."],
      ["Робота — заміна теплообмінника печі", "Піч розібрано до теплообмінника, тріснутий замінено, піч зібрано з новими прокладками й запалено."],
      ["ਹੀਟ ਐਕਸਚੇਂਜਰ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਫ਼ਰਨੇਸ ਐਕਸਚੇਂਜਰ ਤੱਕ ਖੋਲ੍ਹੀ, ਤਿੜਕਿਆ ਐਕਸਚੇਂਜਰ ਬਦਲਿਆ, ਨਵੀਆਂ ਗੈਸਕਟਾਂ ਨਾਲ ਮੁੜ ਜੋੜ ਕੇ ਚਾਲੂ ਕੀਤੀ।"],
      ["Labor — palit ng heat exchanger", "Binaklas ang furnace hanggang exchanger, pinalitan ang basag, binuo ulit na may bagong gasket at sinindihan."],
    )),
    L.material(1, "each", 650, X(
      ["Heat exchanger — when not under warranty", "Replacement exchanger for the furnace model; under warranty the manufacturer supplies it and this line comes off."],
      ["Échangeur — hors garantie", "Échangeur de remplacement pour le modèle de fournaise; sous garantie le fabricant le fournit et cette ligne est retirée."],
      ["Intercambiador — fuera de garantía", "Intercambiador de reemplazo para el modelo del horno; con garantía lo da el fabricante y esta línea se quita."],
      ["Scambiatore — fuori garanzia", "Scambiatore di ricambio per il modello; in garanzia lo fornisce il costruttore e questa riga si toglie."],
      ["Wärmetauscher — außerhalb der Garantie", "Ersatz-Wärmetauscher für das Ofenmodell; in der Garantie liefert ihn der Hersteller und diese Zeile entfällt."],
      ["Теплообмінник — поза гарантією", "Теплообмінник на заміну для моделі печі; за гарантією його дає виробник, і рядок прибирають."],
      ["ਹੀਟ ਐਕਸਚੇਂਜਰ — ਵਾਰੰਟੀ ਤੋਂ ਬਾਹਰ", "ਫ਼ਰਨੇਸ ਮਾਡਲ ਲਈ ਬਦਲਵਾਂ ਐਕਸਚੇਂਜਰ; ਵਾਰੰਟੀ ਵਿੱਚ ਕੰਪਨੀ ਦਿੰਦੀ ਹੈ ਅਤੇ ਇਹ ਲਾਈਨ ਹਟ ਜਾਂਦੀ ਹੈ।"],
      ["Heat exchanger — kung wala nang warranty", "Kapalit na exchanger para sa model ng furnace; kung may warranty, manufacturer ang magbibigay at tatanggalin ang linyang ito."],
    ), { cost: 490, taxable: false, optional: true }),
    COMBUSTION_TEST(150),
  ], MECH),

  "fq.hvac_repair.heat_exchanger.replace_face_plate": A("repair", [
    L.labour(1, "flat", 350, X(
      ["Face plate replacement labour", "Burner assembly out, the warped plate removed, the new plate fitted with fresh gaskets and the burners reset."],
      ["Main-d'œuvre — remplacement de la plaque frontale", "Ensemble de brûleurs retiré, plaque déformée enlevée, plaque neuve posée avec joints neufs, brûleurs replacés."],
      ["Mano de obra — cambio de placa frontal", "Conjunto de quemadores fuera, placa deformada retirada, la nueva colocada con empaques nuevos y los quemadores recolocados."],
      ["Manodopera — sostituzione piastra frontale", "Gruppo bruciatori tolto, piastra deformata rimossa, la nuova montata con guarnizioni nuove e bruciatori rimessi."],
      ["Arbeit — Frontplatte tauschen", "Brennereinheit ausgebaut, verzogene Platte entfernt, neue mit frischen Dichtungen gesetzt und Brenner wieder eingesetzt."],
      ["Робота — заміна лицьової пластини", "Блок пальників знято, деформовану пластину прибрано, нову встановлено з новими прокладками, пальники повернуто."],
      ["ਫ਼ੇਸ ਪਲੇਟ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਬਰਨਰ ਅਸੈਂਬਲੀ ਕੱਢੀ, ਟੇਢੀ ਪਲੇਟ ਹਟਾਈ, ਨਵੀਂ ਗੈਸਕਟਾਂ ਨਾਲ ਲਾਈ ਅਤੇ ਬਰਨਰ ਮੁੜ ਲਾਏ।"],
      ["Labor — palit ng face plate", "Tinanggal ang burner assembly at ang baluktot na plate, ikinabit ang bago na may bagong gasket at ibinalik ang burner."],
    )),
    L.material(1, "each", 180, X(
      ["Face plate and gasket kit", "Heat exchanger face plate with its gasket set for the furnace model."],
      ["Plaque frontale et joints", "Plaque frontale d'échangeur avec son jeu de joints pour le modèle."],
      ["Placa frontal y juego de empaques", "Placa frontal del intercambiador con su juego de empaques para el modelo."],
      ["Piastra frontale e kit guarnizioni", "Piastra frontale dello scambiatore con il suo kit guarnizioni per il modello."],
      ["Frontplatte mit Dichtungssatz", "Wärmetauscher-Frontplatte mit Dichtungssatz für das Ofenmodell."],
      ["Лицьова пластина й прокладки", "Лицьова пластина теплообмінника з комплектом прокладок для моделі."],
      ["ਫ਼ੇਸ ਪਲੇਟ ਅਤੇ ਗੈਸਕਟ ਕਿੱਟ", "ਫ਼ਰਨੇਸ ਮਾਡਲ ਲਈ ਗੈਸਕਟ ਸੈੱਟ ਵਾਲੀ ਹੀਟ ਐਕਸਚੇਂਜਰ ਫ਼ੇਸ ਪਲੇਟ।"],
      ["Face plate at gasket kit", "Face plate ng heat exchanger na may gasket set para sa model."],
    ), { cost: 130 }),
    COMBUSTION_TEST(75),
  ]),

  "fq.hvac_repair.heat_exchanger.flue_pipe": A("repair", [
    L.labour(1, "flat", 400, X(
      ["Flue pipe replacement labour", "Old pipe out, the new run fitted with the right clearances and a steady pitch to the chimney or wall, every joint screwed and sealed."],
      ["Main-d'œuvre — remplacement du tuyau d'évent", "Ancien tuyau retiré, nouveau posé avec les bons dégagements et une pente régulière vers la cheminée ou le mur, chaque joint vissé et scellé."],
      ["Mano de obra — cambio del tubo de ventilación", "Tubo viejo fuera, el nuevo colocado con las holguras correctas y pendiente pareja a la chimenea o pared, cada unión atornillada y sellada."],
      ["Manodopera — sostituzione canna fumaria", "Vecchio tubo tolto, il nuovo posato con le giuste distanze e pendenza costante verso camino o parete, ogni giunto avvitato e sigillato."],
      ["Arbeit — Abgasrohr erneuern", "Altes Rohr raus, das neue mit den richtigen Abständen und gleichmäßigem Gefälle zum Kamin oder zur Wand verlegt, jede Verbindung verschraubt und abgedichtet."],
      ["Робота — заміна димової труби", "Стару трубу знято, нову прокладено з потрібними відступами й рівним ухилом до димаря чи стіни, кожен стик прикручено й загерметизовано."],
      ["ਫ਼ਲੂ ਪਾਈਪ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਪੁਰਾਣੀ ਪਾਈਪ ਕੱਢੀ, ਨਵੀਂ ਸਹੀ ਦੂਰੀਆਂ ਅਤੇ ਚਿਮਨੀ ਜਾਂ ਕੰਧ ਵੱਲ ਇੱਕਸਾਰ ਢਲਾਣ ਨਾਲ ਲਾਈ, ਹਰ ਜੋੜ ਪੇਚ ਅਤੇ ਸੀਲ।"],
      ["Labor — palit ng flue pipe", "Tinanggal ang lumang tubo, ikinabit ang bago na may tamang layo at tuloy-tuloy na slope papunta sa chimney o pader, bawat dugtong ay tinurnilyo at sinelyuhan."],
    )),
    L.material(1, "flat", 180, X(
      ["Flue pipe and fittings", "B-vent or PVC pipe, elbows, hangers and sealant for the run — whichever the appliance is listed for."],
      ["Tuyau d'évent et raccords", "Tuyau de type B ou PVC, coudes, supports et scellant pour le tracé, selon l'homologation de l'appareil."],
      ["Tubo de ventilación y accesorios", "Tubo tipo B o PVC, codos, soportes y sellador para el tramo, según lo que admita el equipo."],
      ["Canna fumaria e raccordi", "Tubo tipo B o PVC, curve, staffe e sigillante per il tratto, secondo l'omologazione dell'apparecchio."],
      ["Abgasrohr und Formteile", "B-Vent- oder PVC-Rohr, Bögen, Halter und Dichtmittel für die Strecke — je nach Zulassung des Geräts."],
      ["Димова труба й фітинги", "Труба типу B чи ПВХ, коліна, кріплення й герметик для траси — залежно від допуску приладу."],
      ["ਫ਼ਲੂ ਪਾਈਪ ਅਤੇ ਫ਼ਿਟਿੰਗ", "ਉਪਕਰਣ ਦੀ ਮਨਜ਼ੂਰੀ ਮੁਤਾਬਕ B-ਵੈਂਟ ਜਾਂ PVC ਪਾਈਪ, ਮੋੜ, ਹੈਂਗਰ ਅਤੇ ਸੀਲੈਂਟ।"],
      ["Flue pipe at fittings", "B-vent o PVC na tubo, siko, hanger at sealant para sa linya — alinman ang listed sa appliance."],
    ), { cost: 130 }),
    COMBUSTION_TEST(75),
  ]),

  // ── Refrigerant ──
  "fq.hvac_repair.refrigerant.add_r410a": A("repair", [CHARGE_LABOUR(150), R410(1, { measurementKey: "each" })]),
  "fq.hvac_repair.refrigerant.add_r410a_additional": A("repair", [PER_POUND_LABOUR(), R410(1, { measurementKey: "each" })]),
  "fq.hvac_repair.refrigerant.add_r22": A("repair", [CHARGE_LABOUR(150), R22({ measurementKey: "each" })]),
  "fq.hvac_repair.refrigerant.add_r22_additional": A("repair", [PER_POUND_LABOUR(), R22({ measurementKey: "each" })]),

  "fq.hvac_repair.refrigerant.leak_search": A("inspection", [
    L.labour(1, "flat", 225, X(
      ["Leak search — electronic, dye or nitrogen", "The whole circuit searched with an electronic detector, UV dye or a standing nitrogen test, and every leak point marked and photographed."],
      ["Recherche de fuites — électronique, colorant ou azote", "Tout le circuit inspecté au détecteur électronique, au colorant UV ou à l'essai d'azote, chaque fuite marquée et photographiée."],
      ["Búsqueda de fugas — electrónica, tinte o nitrógeno", "Todo el circuito revisado con detector electrónico, tinte UV o prueba de nitrógeno, y cada punto de fuga marcado y fotografiado."],
      ["Ricerca perdite — elettronica, tracciante o azoto", "Tutto il circuito controllato con cercafughe, tracciante UV o prova in azoto, ogni perdita segnata e fotografata."],
      ["Lecksuche — elektronisch, Farbstoff oder Stickstoff", "Der ganze Kreislauf mit elektronischem Suchgerät, UV-Farbstoff oder Stickstoff-Standprobe abgesucht, jede Leckstelle markiert und fotografiert."],
      ["Пошук витоків — електронний, барвник чи азот", "Увесь контур перевірено електронним шукачем, УФ-барвником чи тестом азотом, кожне місце позначено й сфотографовано."],
      ["ਲੀਕ ਖੋਜ — ਇਲੈਕਟ੍ਰਾਨਿਕ, ਡਾਈ ਜਾਂ ਨਾਈਟ੍ਰੋਜਨ", "ਪੂਰਾ ਸਰਕਟ ਇਲੈਕਟ੍ਰਾਨਿਕ ਡਿਟੈਕਟਰ, UV ਡਾਈ ਜਾਂ ਨਾਈਟ੍ਰੋਜਨ ਟੈਸਟ ਨਾਲ ਖੋਜਿਆ, ਹਰ ਲੀਕ 'ਤੇ ਨਿਸ਼ਾਨ ਅਤੇ ਫ਼ੋਟੋ।"],
      ["Paghahanap ng tagas — electronic, dye o nitrogen", "Hinanap sa buong circuit gamit ang electronic detector, UV dye o nitrogen test, at minarkahan at kinunan ng litrato ang bawat tagas."],
    )),
    L.material(1, "flat", 45, X(
      ["Nitrogen and leak-detection dye", "Dry nitrogen for the pressure test and UV dye where it is used."],
      ["Azote et colorant de détection", "Azote sec pour l'essai de pression et colorant UV au besoin."],
      ["Nitrógeno y tinte detector", "Nitrógeno seco para la prueba de presión y tinte UV cuando se usa."],
      ["Azoto e tracciante", "Azoto secco per la prova di pressione e tracciante UV dove usato."],
      ["Stickstoff und Lecksuchfarbstoff", "Trockener Stickstoff für die Druckprobe und UV-Farbstoff, wo eingesetzt."],
      ["Азот і барвник для пошуку витоків", "Сухий азот для опресування та УФ-барвник, де потрібно."],
      ["ਨਾਈਟ੍ਰੋਜਨ ਅਤੇ ਲੀਕ ਡਾਈ", "ਪ੍ਰੈਸ਼ਰ ਟੈਸਟ ਲਈ ਸੁੱਕੀ ਨਾਈਟ੍ਰੋਜਨ ਅਤੇ ਲੋੜ ਹੋਵੇ ਤਾਂ UV ਡਾਈ।"],
      ["Nitrogen at leak-detection dye", "Dry nitrogen para sa pressure test at UV dye kung ginagamit."],
    ), { cost: 30 }),
  ]),

  "fq.hvac_repair.refrigerant.repair_leaks": A("repair", [
    L.labour(1, "flat", 250, X(
      ["Leak repair — braze or replace the part", "Refrigerant recovered, each marked leak brazed or the leaking valve core, fitting or flare replaced."],
      ["Réparation de fuites — brasage ou remplacement", "Frigorigène récupéré, chaque fuite marquée brasée ou obus, raccord ou évasement fuyant remplacé."],
      ["Reparación de fugas — soldar o cambiar la pieza", "Refrigerante recuperado, cada fuga marcada soldada o el obús, conexión o abocinado con fuga reemplazado."],
      ["Riparazione perdite — brasare o sostituire", "Refrigerante recuperato, ogni perdita segnata brasata o sostituiti spillo, raccordo o cartella che perdono."],
      ["Leckreparatur — löten oder Teil ersetzen", "Kältemittel abgesaugt, jede markierte Leckstelle gelötet oder undichter Ventileinsatz, Verschraubung oder Bördel ersetzt."],
      ["Ремонт витоків — пайка чи заміна деталі", "Холодоагент відкачано, кожне позначене місце запаяно або замінено золотник, фітинг чи розвальцювання."],
      ["ਲੀਕ ਮੁਰੰਮਤ — ਬ੍ਰੇਜ਼ ਜਾਂ ਪੁਰਜ਼ਾ ਬਦਲਣਾ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਹਰ ਨਿਸ਼ਾਨ ਵਾਲੀ ਲੀਕ ਬ੍ਰੇਜ਼ ਕੀਤੀ ਜਾਂ ਲੀਕ ਕਰਦਾ ਕੋਰ, ਫ਼ਿਟਿੰਗ ਜਾਂ ਫ਼ਲੇਅਰ ਬਦਲਿਆ।"],
      ["Pag-ayos ng tagas — braze o palit ng piyesa", "Na-recover ang refrigerant, binraze ang bawat minarkahang tagas o pinalitan ang tumutulong valve core, fitting o flare."],
    )),
    L.material(1, "flat", 45, X(
      ["Brazing rod, fittings and valve cores", "Silver brazing rod, replacement fittings and Schrader cores for the repair."],
      ["Baguette de brasage, raccords et obus", "Baguette à l'argent, raccords de remplacement et obus Schrader pour la réparation."],
      ["Varilla de soldar, conexiones y obuses", "Varilla de plata, conexiones de reemplazo y obuses Schrader para la reparación."],
      ["Bacchette, raccordi e spilli", "Bacchetta all'argento, raccordi di ricambio e spilli Schrader per la riparazione."],
      ["Lot, Verschraubungen und Ventileinsätze", "Silberlot, Ersatzverschraubungen und Schrader-Einsätze für die Reparatur."],
      ["Припій, фітинги й золотники", "Срібний припій, фітинги на заміну й золотники Шредера для ремонту."],
      ["ਬ੍ਰੇਜ਼ਿੰਗ ਰਾਡ, ਫ਼ਿਟਿੰਗ ਅਤੇ ਵਾਲਵ ਕੋਰ", "ਮੁਰੰਮਤ ਲਈ ਸਿਲਵਰ ਰਾਡ, ਬਦਲਵੀਆਂ ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਸ਼੍ਰੇਡਰ ਕੋਰ।"],
      ["Brazing rod, fittings at valve core", "Silver brazing rod, kapalit na fitting at Schrader core para sa ayos."],
    ), { cost: 30 }),
    L.labour(1, "flat", 75, X(
      ["Nitrogen pressure test", "The repaired circuit held under nitrogen and watched to prove it holds before it is recharged."],
      ["Essai de pression à l'azote", "Circuit réparé mis sous azote et surveillé pour prouver l'étanchéité avant la recharge."],
      ["Prueba de presión con nitrógeno", "El circuito reparado puesto a presión con nitrógeno y vigilado para comprobar que aguanta antes de recargar."],
      ["Prova di pressione in azoto", "Circuito riparato messo sotto azoto e osservato per provarne la tenuta prima della ricarica."],
      ["Stickstoff-Druckprobe", "Der reparierte Kreislauf unter Stickstoff gesetzt und beobachtet, um die Dichtheit vor dem Befüllen zu belegen."],
      ["Опресування азотом", "Відремонтований контур витримано під азотом, щоб підтвердити герметичність до заправки."],
      ["ਨਾਈਟ੍ਰੋਜਨ ਪ੍ਰੈਸ਼ਰ ਟੈਸਟ", "ਮੁਰੰਮਤ ਕੀਤਾ ਸਰਕਟ ਨਾਈਟ੍ਰੋਜਨ ਹੇਠ ਰੱਖ ਕੇ ਦੇਖਿਆ ਕਿ ਰੀਚਾਰਜ ਤੋਂ ਪਹਿਲਾਂ ਟਿਕਦਾ ਹੈ।"],
      ["Nitrogen pressure test", "Pinanatili sa nitrogen at binantayan ang naayos na circuit para patunayang walang tagas bago i-recharge."],
    )),
  ]),

  "fq.hvac_repair.refrigerant.electronic_leak_search": A("inspection", [
    L.labour(1, "flat", 150, X(
      ["Electronic leak sweep", "Coils, fittings, valves and the line set swept slowly with a heated-diode detector."],
      ["Balayage électronique des fuites", "Serpentins, raccords, vannes et conduites balayés lentement au détecteur à diode chauffée."],
      ["Barrido electrónico de fugas", "Serpentines, conexiones, válvulas y tubería barridos despacio con detector de diodo calentado."],
      ["Scansione elettronica delle perdite", "Batterie, raccordi, valvole e linee passati lentamente con cercafughe a diodo riscaldato."],
      ["Elektronische Lecksuche", "Register, Verschraubungen, Ventile und Leitungen langsam mit einem Heizdioden-Suchgerät abgefahren."],
      ["Електронний пошук витоків", "Теплообмінники, фітинги, вентилі й трасу повільно перевірено детектором із нагрітим діодом."],
      ["ਇਲੈਕਟ੍ਰਾਨਿਕ ਲੀਕ ਸਵੀਪ", "ਹੀਟਿਡ-ਡਾਇਓਡ ਡਿਟੈਕਟਰ ਨਾਲ ਕੋਇਲਾਂ, ਫ਼ਿਟਿੰਗਾਂ, ਵਾਲਵ ਅਤੇ ਲਾਈਨ ਸੈੱਟ ਹੌਲੀ-ਹੌਲੀ ਜਾਂਚੇ।"],
      ["Electronic leak sweep", "Dahan-dahang dinaanan ng heated-diode detector ang coil, fitting, valve at line set."],
    ), { cost: 75 }),
    SHARED.report(25),
  ]),

  "fq.hvac_repair.refrigerant.walk_in_reversing_valve": A("repair", [
    L.labour(1, "flat", 350, X(
      ["Reversing valve replacement labour", "Refrigerant recovered, the valve cut out and the new one brazed in cool, the defrost control and sensors checked and the box pulled down to temperature."],
      ["Main-d'œuvre — remplacement de la vanne d'inversion", "Frigorigène récupéré, vanne coupée et la neuve brasée à froid, commande de dégivrage et sondes vérifiées, chambre ramenée à température."],
      ["Mano de obra — cambio de válvula inversora", "Refrigerante recuperado, válvula cortada y la nueva soldada en frío, control de deshielo y sensores revisados y la cámara bajada a temperatura."],
      ["Manodopera — sostituzione valvola di inversione", "Refrigerante recuperato, valvola tagliata e la nuova brasata a freddo, controllo sbrinamento e sonde verificati, cella riportata in temperatura."],
      ["Arbeit — Umschaltventil tauschen", "Kältemittel abgesaugt, Ventil ausgetrennt und das neue gekühlt eingelötet, Abtausteuerung und Fühler geprüft und die Zelle auf Temperatur gebracht."],
      ["Робота — заміна чотириходового клапана", "Холодоагент відкачано, клапан вирізано, новий упаяно з охолодженням, керування відтаванням і датчики перевірено, камеру виведено на температуру."],
      ["ਰਿਵਰਸਿੰਗ ਵਾਲਵ ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਵਾਲਵ ਕੱਟਿਆ ਅਤੇ ਨਵਾਂ ਠੰਢਾ ਰੱਖ ਕੇ ਬ੍ਰੇਜ਼ ਕੀਤਾ, ਡੀਫ੍ਰੌਸਟ ਕੰਟਰੋਲ ਅਤੇ ਸੈਂਸਰ ਜਾਂਚੇ ਅਤੇ ਬਾਕਸ ਤਾਪਮਾਨ 'ਤੇ ਲਿਆਂਦਾ।"],
      ["Labor — palit ng reversing valve", "Na-recover ang refrigerant, tinanggal ang valve at binraze ang bago nang malamig, chineck ang defrost control at sensor at pinalamig ang box sa tamang temperatura."],
    )),
    L.material(1, "each", 160, X(
      ["Reversing valve", "Four-way reversing valve matched to the system's capacity."],
      ["Vanne d'inversion", "Vanne d'inversion à quatre voies assortie à la capacité du système."],
      ["Válvula inversora", "Válvula inversora de cuatro vías según la capacidad del sistema."],
      ["Valvola di inversione", "Valvola a quattro vie adatta alla potenza dell'impianto."],
      ["Umschaltventil", "Vierwege-Umschaltventil passend zur Anlagenleistung."],
      ["Чотириходовий клапан", "Чотириходовий клапан під потужність системи."],
      ["ਰਿਵਰਸਿੰਗ ਵਾਲਵ", "ਸਿਸਟਮ ਦੀ ਸਮਰੱਥਾ ਮੁਤਾਬਕ ਚਾਰ-ਵੇਅ ਰਿਵਰਸਿੰਗ ਵਾਲਵ।"],
      ["Reversing valve", "Four-way na reversing valve na tugma sa kapasidad ng sistema."],
    ), { cost: 125 }),
    L.material(3, "each", 45, X(
      ["Commercial refrigerant — per pound", "The system's refrigerant (R-404A, R-448A or as labelled), weighed in by the pound."],
      ["Frigorigène commercial — la livre", "Frigorigène du système (R-404A, R-448A ou selon la plaque), pesé à la livre."],
      ["Refrigerante comercial — por libra", "El refrigerante del sistema (R-404A, R-448A o según la placa), pesado por libra."],
      ["Refrigerante commerciale — alla libbra", "Il refrigerante dell'impianto (R-404A, R-448A o come da targa), pesato alla libbra."],
      ["Gewerbekältemittel — pro Pfund", "Das Kältemittel der Anlage (R-404A, R-448A oder laut Typenschild), pfundweise eingewogen."],
      ["Комерційний холодоагент — за фунт", "Холодоагент системи (R-404A, R-448A або за табличкою), за вагою по фунту."],
      ["ਕਮਰਸ਼ੀਅਲ ਰੈਫ਼ਰੀਜਰੈਂਟ — ਪ੍ਰਤੀ ਪੌਂਡ", "ਸਿਸਟਮ ਦਾ ਰੈਫ਼ਰੀਜਰੈਂਟ (R-404A, R-448A ਜਾਂ ਲੇਬਲ ਮੁਤਾਬਕ), ਪੌਂਡ ਦੇ ਹਿਸਾਬ ਨਾਲ ਤੋਲਿਆ।"],
      ["Commercial refrigerant — kada libra", "Ang refrigerant ng sistema (R-404A, R-448A o ayon sa label), tinitimbang kada libra."],
    ), { cost: 25 }),
    BRAZE(),
  ], MECH),

  "fq.hvac_repair.refrigerant.repair_lineset": A("repair", [
    L.labour(1, "flat", 400, X(
      ["Line set repair labour", "Refrigerant recovered, the damaged section cut out and new copper brazed in, rerouted where needed, then pressure-tested and evacuated."],
      ["Main-d'œuvre — réparation des conduites", "Frigorigène récupéré, section abîmée coupée et cuivre neuf brasé, retracé au besoin, puis essai de pression et tirage au vide."],
      ["Mano de obra — reparación de la tubería", "Refrigerante recuperado, tramo dañado cortado y cobre nuevo soldado, desviado si hace falta, luego prueba de presión y vacío."],
      ["Manodopera — riparazione linee frigorifere", "Refrigerante recuperato, tratto danneggiato tagliato e rame nuovo brasato, deviato se serve, poi prova di pressione e vuoto."],
      ["Arbeit — Kältemittelleitung reparieren", "Kältemittel abgesaugt, beschädigter Abschnitt ausgetrennt und neues Kupfer eingelötet, bei Bedarf umverlegt, dann abgedrückt und evakuiert."],
      ["Робота — ремонт траси", "Холодоагент відкачано, пошкоджену ділянку вирізано й упаяно нову мідь, за потреби переведено, потім опресовано й відвакуумовано."],
      ["ਲਾਈਨ ਸੈੱਟ ਮੁਰੰਮਤ ਦੀ ਲੇਬਰ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਖ਼ਰਾਬ ਹਿੱਸਾ ਕੱਟ ਕੇ ਨਵਾਂ ਤਾਂਬਾ ਬ੍ਰੇਜ਼, ਲੋੜ ਹੋਵੇ ਤਾਂ ਰਸਤਾ ਬਦਲਿਆ, ਫਿਰ ਪ੍ਰੈਸ਼ਰ ਟੈਸਟ ਅਤੇ ਵੈਕਿਊਮ।"],
      ["Labor — ayos ng line set", "Na-recover ang refrigerant, tinanggal ang sirang bahagi at binraze ang bagong tanso, inilipat ang daan kung kailangan, tapos pressure test at vacuum."],
    )),
    L.material(1, "flat", 120, X(
      ["Copper tubing, fittings and insulation", "ACR copper, couplings and closed-cell insulation for the repaired section."],
      ["Tube de cuivre, raccords et isolant", "Cuivre ACR, manchons et isolant à cellules fermées pour la section réparée."],
      ["Tubo de cobre, conexiones y aislante", "Cobre ACR, coples y aislante de celda cerrada para el tramo reparado."],
      ["Tubo di rame, raccordi e isolante", "Rame ACR, manicotti e isolante a celle chiuse per il tratto riparato."],
      ["Kupferrohr, Formteile und Dämmung", "ACR-Kupfer, Muffen und geschlossenzellige Dämmung für den reparierten Abschnitt."],
      ["Мідна труба, фітинги й ізоляція", "Мідь ACR, муфти й закритоклітинна ізоляція для відремонтованої ділянки."],
      ["ਤਾਂਬੇ ਦੀ ਟਿਊਬ, ਫ਼ਿਟਿੰਗ ਅਤੇ ਇੰਸੂਲੇਸ਼ਨ", "ਮੁਰੰਮਤ ਵਾਲੇ ਹਿੱਸੇ ਲਈ ACR ਤਾਂਬਾ, ਕਪਲਿੰਗ ਅਤੇ ਕਲੋਜ਼ਡ-ਸੈੱਲ ਇੰਸੂਲੇਸ਼ਨ।"],
      ["Tansong tubo, fittings at insulation", "ACR na tanso, coupling at closed-cell na insulation para sa inayos na bahagi."],
    ), { cost: 85 }),
    R410(2),
  ]),

  "fq.hvac_repair.refrigerant.flush_lineset": A("repair", [
    L.labour(1, "flat", 140, X(
      ["Line set flush", "Flush solvent pushed through each line with nitrogen until it runs clean, then the lines blown dry."],
      ["Rinçage des conduites", "Solvant de rinçage poussé dans chaque conduite à l'azote jusqu'à ce qu'il sorte propre, puis conduites séchées au souffle."],
      ["Lavado de la tubería", "Solvente de lavado empujado por cada línea con nitrógeno hasta que salga limpio, y luego las líneas secadas con soplado."],
      ["Lavaggio delle linee", "Solvente di lavaggio spinto in ogni linea con azoto finché esce pulito, poi linee asciugate con soffiaggio."],
      ["Leitungsspülung", "Spülmittel mit Stickstoff durch jede Leitung gedrückt, bis es sauber austritt, dann die Leitungen trocken geblasen."],
      ["Промивання траси", "Промивний розчин проштовхнуто азотом крізь кожну лінію до чистого виходу, потім лінії продуто насухо."],
      ["ਲਾਈਨ ਸੈੱਟ ਫ਼ਲੱਸ਼", "ਨਾਈਟ੍ਰੋਜਨ ਨਾਲ ਹਰ ਲਾਈਨ ਵਿੱਚੋਂ ਫ਼ਲੱਸ਼ ਘੋਲ ਲੰਘਾਇਆ ਜਦ ਤੱਕ ਸਾਫ਼ ਨਾ ਨਿਕਲੇ, ਫਿਰ ਫੂਕ ਨਾਲ ਸੁਕਾਈਆਂ।"],
      ["Flush ng line set", "Itinulak ng nitrogen ang flush solvent sa bawat linya hanggang lumabas na malinis, tapos pinatuyo sa hihip."],
    )),
    L.material(1, "flat", 45, X(
      ["Line set flush solvent", "Non-flammable flush solvent, one line set."],
      ["Solvant de rinçage", "Solvant de rinçage ininflammable, une paire de conduites."],
      ["Solvente de lavado", "Solvente de lavado no inflamable, un juego de tubería."],
      ["Solvente di lavaggio", "Solvente di lavaggio non infiammabile, un set di linee."],
      ["Spülmittel für Leitungen", "Nicht brennbares Spülmittel, ein Leitungssatz."],
      ["Промивний розчин", "Негорючий промивний розчин на одну трасу."],
      ["ਲਾਈਨ ਸੈੱਟ ਫ਼ਲੱਸ਼ ਘੋਲ", "ਨਾ ਬਲਣ ਵਾਲਾ ਫ਼ਲੱਸ਼ ਘੋਲ, ਇੱਕ ਲਾਈਨ ਸੈੱਟ।"],
      ["Flush solvent", "Hindi nasusunog na flush solvent, isang line set."],
    ), { cost: 30 }),
  ]),

  "fq.hvac_repair.refrigerant.txv_replacement": A("repair", [
    L.labour(1, "flat", 450, X(
      ["TXV replacement labour", "Refrigerant recovered, the valve cut out and the new one brazed in with its bulb clamped and insulated, then evacuated and charged to subcooling."],
      ["Main-d'œuvre — remplacement du détendeur", "Frigorigène récupéré, détendeur coupé et le neuf brasé avec son bulbe fixé et isolé, puis tirage au vide et charge au sous-refroidissement."],
      ["Mano de obra — cambio de válvula TXV", "Refrigerante recuperado, válvula cortada y la nueva soldada con el bulbo sujeto y aislado, luego vacío y carga por subenfriamiento."],
      ["Manodopera — sostituzione valvola termostatica", "Refrigerante recuperato, valvola tagliata e la nuova brasata con bulbo fissato e isolato, poi vuoto e carica al sottoraffreddamento."],
      ["Arbeit — Expansionsventil tauschen", "Kältemittel abgesaugt, Ventil ausgetrennt und das neue mit befestigtem und gedämmtem Fühler eingelötet, dann evakuiert und nach Unterkühlung befüllt."],
      ["Робота — заміна ТРВ", "Холодоагент відкачано, клапан вирізано, новий упаяно з закріпленим і утепленим балоном, відвакуумовано й заправлено за переохолодженням."],
      ["TXV ਬਦਲਣ ਦੀ ਲੇਬਰ", "ਰੈਫ਼ਰੀਜਰੈਂਟ ਕੱਢਿਆ, ਵਾਲਵ ਕੱਟ ਕੇ ਨਵਾਂ ਬਲਬ ਕੱਸ ਕੇ ਅਤੇ ਇੰਸੂਲੇਟ ਕਰਕੇ ਬ੍ਰੇਜ਼, ਫਿਰ ਵੈਕਿਊਮ ਅਤੇ ਸਬਕੂਲਿੰਗ ਮੁਤਾਬਕ ਚਾਰਜ।"],
      ["Labor — palit ng TXV", "Na-recover ang refrigerant, tinanggal ang valve at binraze ang bago na naka-clamp at insulated ang bulb, tapos vacuum at charge ayon sa subcooling."],
    )),
    L.material(1, "each", 180, X(
      ["Thermal expansion valve", "TXV matched to the coil's tonnage and refrigerant."],
      ["Détendeur thermostatique", "Détendeur assorti au tonnage et au frigorigène du serpentin."],
      ["Válvula de expansión termostática", "TXV según el tonelaje y el refrigerante del serpentín."],
      ["Valvola di espansione termostatica", "Valvola adatta a tonnellaggio e refrigerante della batteria."],
      ["Thermostatisches Expansionsventil", "Expansionsventil passend zu Leistung und Kältemittel des Registers."],
      ["Терморегулювальний вентиль", "ТРВ під потужність і холодоагент теплообмінника."],
      ["ਥਰਮਲ ਐਕਸਪੈਂਸ਼ਨ ਵਾਲਵ", "ਕੋਇਲ ਦੇ ਟਨ ਅਤੇ ਰੈਫ਼ਰੀਜਰੈਂਟ ਮੁਤਾਬਕ TXV।"],
      ["Thermal expansion valve", "TXV na tugma sa tonelada at refrigerant ng coil."],
    ), { cost: 120 }),
    BRAZE(),
    R410(2),
  ]),

  // ── Diagnostics ──
  "fq.hvac_repair.diagnostics.commercial": A("inspection", [
    DIAG(),
    SHARED.techHour(1, 135, { optional: true }),
  ], MECH),

  "fq.hvac_repair.diagnostics.emergency": A("inspection", [
    DIAG(),
    L.labour(1, "flat", 75, X(
      ["After-hours surcharge", "The on-call premium for a visit outside normal hours, weekends or holidays."],
      ["Supplément hors heures", "Prime de garde pour une visite hors des heures normales, la fin de semaine ou un jour férié."],
      ["Recargo fuera de horario", "El recargo de guardia por una visita fuera de horario, en fin de semana o día festivo."],
      ["Supplemento fuori orario", "Il supplemento di reperibilità per una visita fuori orario, nel fine settimana o nei festivi."],
      ["Zuschlag außerhalb der Geschäftszeit", "Der Bereitschaftszuschlag für einen Einsatz außerhalb der Arbeitszeit, am Wochenende oder Feiertag."],
      ["Доплата за позаробочий час", "Надбавка чергового за виклик у позаробочий час, вихідні чи свята."],
      ["ਸਮੇਂ ਤੋਂ ਬਾਅਦ ਵਾਧੂ ਖ਼ਰਚਾ", "ਆਮ ਘੰਟਿਆਂ ਤੋਂ ਬਾਹਰ, ਵੀਕਐਂਡ ਜਾਂ ਛੁੱਟੀ ਵਾਲੇ ਦਿਨ ਵਿਜ਼ਿਟ ਦਾ ਆਨ-ਕਾਲ ਵਾਧਾ।"],
      ["After-hours surcharge", "Dagdag na bayad sa on-call para sa visit na labas sa oras, weekend o holiday."],
    ), { cost: 45 }),
  ]),

  "fq.hvac_repair.diagnostics.out_of_range": A("inspection", [
    DIAG(),
    L.other(1, "flat", 45, X(
      ["Travel beyond the service area", "Extra drive time and mileage to an address outside the usual service area."],
      ["Déplacement hors zone de service", "Temps de route et kilométrage supplémentaires pour une adresse hors de la zone habituelle."],
      ["Traslado fuera del área de servicio", "Tiempo de manejo y kilometraje extra a una dirección fuera del área habitual."],
      ["Trasferta fuori zona", "Tempo di guida e chilometri in più per un indirizzo fuori dalla zona abituale."],
      ["Anfahrt außerhalb des Einsatzgebiets", "Zusätzliche Fahrzeit und Kilometer zu einer Adresse außerhalb des üblichen Gebiets."],
      ["Виїзд за межі зони обслуговування", "Додатковий час у дорозі й пробіг до адреси поза звичайною зоною."],
      ["ਸਰਵਿਸ ਇਲਾਕੇ ਤੋਂ ਬਾਹਰ ਸਫ਼ਰ", "ਆਮ ਇਲਾਕੇ ਤੋਂ ਬਾਹਰਲੇ ਪਤੇ ਲਈ ਵਾਧੂ ਡਰਾਈਵ ਸਮਾਂ ਅਤੇ ਮੀਲ।"],
      ["Biyahe lampas sa service area", "Dagdag na oras ng biyahe at mileage papunta sa address na labas sa karaniwang lugar."],
    ), { cost: 30 }),
  ]),
};

for (const key of Object.keys(ADDED)) {
  if (SEED.services.find((s) => s.seedKey === key)?.templateLines) throw new Error(`hvac_repair: ${key} already has a template — this pass only adds`);
}
withTemplates(SEED, Object.fromEntries(Object.entries(ADDED).map(([key, a]) => {
  const s = I18N.services[key];
  return [key, T(a.kind, { it: s.it, de: s.de, uk: s.uk, pa: s.pa, tl: s.tl }, a.lines, null, a.opts.categories ? { categories: a.opts.categories } : {})];
})));

// Shared services: one canonical row here, installed for these quote types too.
tagRows(SEED, {
  "fq.hvac_repair.air_quality.clean_ducts": ["air_duct_cleaning"],
  "fq.hvac_repair.air_quality.replace_filter": ["air_duct_cleaning"],
  "fq.hvac_repair.air_quality.seal_insulate_ducts": ["air_duct_cleaning"],
  "fq.hvac_repair.air_quality.uv_purifier_install": ["air_duct_cleaning"],
  "fq.hvac_repair.air_quality.duct_cleaning_visit": ["air_duct_cleaning"],
  "fq.hvac_repair.air_quality.iaq_testing": ["air_duct_cleaning"],
});
