// app/data/checklistSeeds/hvac_install.js — see ./_build.js for the format.
// Replacement install and start-up: the readings are numbers, not ticks.
import { C, S, I, CK, TX, NU, SL, R, O } from "./_build.js";
import { photoBefore, photoAfter, cleanedUp, clientSignature } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.hvac.install_startup", { trades: ["hvac_install", "hvac_repair", "mechanical_contracting"], autoAddFor: ["hvac_install"] },
    ["HVAC install and start-up", "Installation et mise en service CVC", "Instalación y arranque de HVAC", "Installazione e avviamento HVAC", "HLK-Einbau und Inbetriebnahme", "Монтаж і запуск ОВК", "Pagkakabit at pagsisimula ng HVAC"],
    [
      S(["Before removal", "Avant le retrait", "Antes de retirar", "Prima della rimozione", "Vor dem Ausbau", "Перед демонтажем", "Bago tanggalin"], [
        I(CK, R, "Equipment on the truck matches the proposal", "Équipement conforme à la soumission", "Equipo coincide con la propuesta", "Apparecchi conformi al preventivo", "Geräte entsprechen dem Angebot", "Обладнання відповідає пропозиції", "Tugma sa proposal ang dalang kagamitan"),
        photoBefore(),
        I(CK, R, "Power locked out", "Alimentation cadenassée", "Energía bloqueada", "Alimentazione sezionata e bloccata", "Strom abgeschaltet und gesichert", "Живлення вимкнено й заблоковано", "Naka-lockout ang kuryente"),
        I(CK, O, "Gas shut off and confirmed safe", "Gaz coupé et sécurité confirmée", "Gas cerrado y confirmado seguro", "Gas chiuso e verificato", "Gas abgesperrt und geprüft", "Газ перекрито, безпеку підтверджено", "Sarado at ligtas ang gas"),
      ]),
      S(["Equipment", "Équipement", "Equipo", "Apparecchi", "Geräte", "Обладнання", "Kagamitan"], [
        I(TX, R, "Model and serial numbers", "Numéros de modèle et de série", "Números de modelo y serie", "Modello e numeri di serie", "Modell- und Seriennummern", "Моделі й серійні номери", "Model at serial number"),
        I(CK, R, "Set level with the maker's clearances", "De niveau avec les dégagements du fabricant", "Nivelado con las distancias del fabricante", "In bolla con le distanze del produttore", "Waagerecht mit Herstellerabständen", "Рівно, з відступами за виробником", "Pantay at may tamang clearance"),
        I(CK, R, "Breaker size and disconnect correct", "Calibre du disjoncteur et sectionneur conformes", "Interruptor y desconectador correctos", "Interruttore e sezionatore corretti", "Sicherung und Trennschalter korrekt", "Автомат і вимикач відповідають", "Tama ang breaker at disconnect"),
        I(CK, O, "Gas line leak-tested", "Conduite de gaz testée contre les fuites", "Línea de gas probada contra fugas", "Linea gas provata contro le perdite", "Gasleitung auf Dichtheit geprüft", "Газову лінію перевірено на витік", "Sinubok sa tagas ang linya ng gas"),
        I(NU, R, "Vacuum reached (microns)", "Vide atteint (microns)", "Vacío alcanzado (micrones)", "Vuoto raggiunto (micron)", "Erreichtes Vakuum (Mikron)", "Досягнутий вакуум (мікрони)", "Naabot na vacuum (microns)"),
        I(CK, R, "Refrigerant charge to the maker's spec", "Charge de frigorigène selon le fabricant", "Carga de refrigerante según el fabricante", "Carica di refrigerante secondo il produttore", "Kältemittelfüllung nach Herstellervorgabe", "Заправка холодоагентом за виробником", "Ayon sa gumawa ang refrigerant charge"),
        I(CK, R, "Condensate drain trapped and tested", "Drain de condensat siphonné et testé", "Drenaje de condensado con sifón y probado", "Scarico condensa sifonato e provato", "Kondensatablauf mit Siphon geprüft", "Дренаж конденсату з сифоном перевірено", "May trap at nasubok ang condensate drain"),
        I(CK, O, "Flue sloped and sealed", "Conduit d'évacuation en pente et scellé", "Ducto de humos con pendiente y sellado", "Canna fumaria in pendenza e sigillata", "Abgasrohr mit Gefälle und dicht", "Димохід з ухилом і герметичний", "May dalisdis at selyado ang flue"),
      ]),
      S(["Start-up readings", "Relevés de mise en service", "Lecturas de arranque", "Letture di avviamento", "Inbetriebnahme-Messwerte", "Показники запуску", "Mga reading sa pagsisimula"], [
        I(NU, R, "Static pressure (in. w.c.)", "Pression statique (po CE)", "Presión estática (pulg. c.a.)", "Pressione statica (Pa)", "Statischer Druck (Pa)", "Статичний тиск (Па)", "Static pressure"),
        I(NU, R, "Supply air temperature", "Température d'air soufflé", "Temperatura de suministro", "Temperatura di mandata", "Zulufttemperatur", "Температура подачі", "Temperatura ng supply"),
        I(NU, R, "Return air temperature", "Température d'air de reprise", "Temperatura de retorno", "Temperatura di ripresa", "Rücklufttemperatur", "Температура повернення", "Temperatura ng return"),
        I(SL, R, "Heating and cooling cycle normally", "Chauffage et climatisation fonctionnent normalement", "Calefacción y enfriamiento funcionan bien", "Riscaldamento e raffrescamento regolari", "Heizen und Kühlen laufen normal", "Обігрів і охолодження працюють нормально", "Normal ang pag-init at paglamig"),
        I(NU, O, "Carbon monoxide reading (ppm)", "Mesure de monoxyde de carbone (ppm)", "Lectura de monóxido de carbono (ppm)", "Lettura di monossido di carbonio (ppm)", "CO-Messwert (ppm)", "Показник чадного газу (ppm)", "Reading ng carbon monoxide (ppm)"),
        I(SL, R, "Safeties and high limit working", "Dispositifs de sécurité fonctionnels", "Seguridades y límite alto funcionando", "Sicurezze e limite alto funzionanti", "Sicherheitseinrichtungen funktionieren", "Запобіжники й обмежувач працюють", "Gumagana ang safety at high limit"),
      ]),
      S(["Handover", "Remise", "Entrega", "Consegna", "Übergabe", "Передача", "Pagbibigay"], [
        photoAfter(),
        I(CK, R, "Old equipment removed from the property", "Ancien équipement retiré", "Equipo viejo retirado", "Vecchio apparecchio rimosso", "Altgerät entsorgt", "Старе обладнання вивезено", "Naalis ang lumang kagamitan"),
        cleanedUp(),
        I(CK, R, "Warranty registered", "Garantie enregistrée", "Garantía registrada", "Garanzia registrata", "Garantie registriert", "Гарантію зареєстровано", "Nairehistro ang warranty"),
        I(CK, R, "Thermostat, filter and maintenance explained", "Thermostat, filtre et entretien expliqués", "Termostato, filtro y mantenimiento explicados", "Termostato, filtro e manutenzione spiegati", "Thermostat, Filter und Wartung erklärt", "Термостат, фільтр і обслуговування пояснено", "Naipaliwanag ang thermostat, filter at maintenance"),
        clientSignature(),
      ]),
    ]),
];
