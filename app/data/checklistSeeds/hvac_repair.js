// app/data/checklistSeeds/hvac_repair.js — see ./_build.js for the format.
import { C, S, I, IO, CK, TX, NU, SE, SL, R, O } from "./_build.js";
import { T_PREP, T_WRAP, photoBefore, photoAfter, clientSignature } from "./_common.js";

const HVAC = ["hvac_repair", "hvac_install", "mechanical_contracting"];
const model = () => I(TX, R, "Indoor and outdoor model and serial numbers", "Modèles et numéros de série intérieur et extérieur", "Modelos y números de serie interior y exterior", "Modelli e numeri di serie interna ed esterna", "Modell- und Seriennummern innen und außen", "Моделі й серійні номери внутрішнього й зовнішнього блоків", "Model at serial ng loob at labas na unit");
const runningBefore = () => I(SL, R, "Working when we arrived", "Fonctionnait à l'arrivée", "Funcionaba al llegar", "Funzionava all'arrivo", "Lief bei Ankunft", "Працювала на момент приїзду", "Gumagana nang dumating kami");
const amps = () => I(NU, R, "Compressor running amps", "Intensité du compresseur (A)", "Amperaje del compresor", "Assorbimento del compressore (A)", "Verdichter-Betriebsstrom (A)", "Струм компресора (А)", "Amps ng compressor");
const fanAmps = () => I(NU, O, "Outdoor fan motor amps", "Intensité du moteur de ventilateur extérieur", "Amperaje del motor del ventilador exterior", "Assorbimento motore ventilatore esterno", "Strom Außenventilator (A)", "Струм зовнішнього вентилятора (А)", "Amps ng outdoor fan");
const supply = () => I(NU, R, "Supply temperature", "Température de soufflage", "Temperatura de suministro", "Temperatura di mandata", "Zulufttemperatur", "Температура подачі", "Temperatura ng supply");
const ret = () => I(NU, R, "Return temperature", "Température de reprise", "Temperatura de retorno", "Temperatura di ripresa", "Rücklufttemperatur", "Температура повернення", "Temperatura ng return");
const superheat = () => I(NU, O, "Superheat", "Surchauffe", "Sobrecalentamiento", "Surriscaldamento", "Überhitzung", "Перегрів", "Superheat");
const subcool = () => I(NU, O, "Subcooling", "Sous-refroidissement", "Subenfriamiento", "Sottoraffreddamento", "Unterkühlung", "Переохолодження", "Subcooling");
const volts = () => I(NU, O, "Supply voltage", "Tension d'alimentation", "Voltaje de alimentación", "Tensione di alimentazione", "Netzspannung", "Напруга живлення", "Boltahe ng supply");
const coils = () => I(SL, R, "Indoor and outdoor coil condition", "État des serpentins intérieur et extérieur", "Estado de serpentines interior y exterior", "Stato delle batterie interna ed esterna", "Zustand der Wärmetauscher innen und außen", "Стан внутрішнього й зовнішнього теплообмінників", "Kondisyon ng coil sa loob at labas");
const T_READ = ["Readings", "Relevés", "Lecturas", "Letture", "Messwerte", "Показники", "Mga reading"];
const T_SYS = ["System", "Système", "Sistema", "Impianto", "Anlage", "Система", "Sistema"];

export const CHECKLISTS = [
  C("fq.cl.hvac.maintenance_ac_hp", { trades: HVAC },
    ["AC and heat pump maintenance", "Entretien climatiseur et thermopompe", "Mantenimiento de aire y bomba de calor", "Manutenzione climatizzatore e pompa di calore", "Wartung Klimaanlage und Wärmepumpe", "Обслуговування кондиціонера й теплового насоса", "Maintenance ng AC at heat pump"],
    [
      S(T_SYS, [
        runningBefore(),
        IO(SE, R, ["System type", "Type de système", "Tipo de sistema", "Tipo di impianto", "Anlagentyp", "Тип системи", "Uri ng sistema"],
          [["Heat pump", "AC only"], ["Thermopompe", "Climatisation seulement"], ["Bomba de calor", "Solo aire acondicionado"], ["Pompa di calore", "Solo climatizzatore"], ["Wärmepumpe", "Nur Klimaanlage"], ["Тепловий насос", "Лише кондиціонер"], ["Heat pump", "AC lang"]]),
        model(),
        I(SL, R, "Thermostat working", "Thermostat fonctionnel", "Termostato funcionando", "Termostato funzionante", "Thermostat funktioniert", "Термостат працює", "Gumagana ang thermostat"),
        I(TX, O, "Defrost controls tested — findings", "Dégivrage testé — constats", "Control de deshielo probado — hallazgos", "Sbrinamento provato — esito", "Abtauung geprüft — Befund", "Розморожування перевірено — висновки", "Nasubok ang defrost — nakita"),
        I(TX, O, "Backup heat type", "Type de chauffage d'appoint", "Tipo de calefacción auxiliar", "Tipo di riscaldamento ausiliario", "Art der Zusatzheizung", "Тип резервного обігріву", "Uri ng backup heat"),
      ]),
      S(["Electrical", "Électricité", "Eléctrico", "Parte elettrica", "Elektrik", "Електрика", "Elektrikal"], [
        amps(), fanAmps(),
        I(NU, O, "Run capacitor (µF)", "Condensateur de marche (µF)", "Capacitor de marcha (µF)", "Condensatore di marcia (µF)", "Betriebskondensator (µF)", "Робочий конденсатор (мкФ)", "Run capacitor (µF)"),
        I(SL, R, "Contactor condition", "État du contacteur", "Estado del contactor", "Stato del contattore", "Zustand des Schützes", "Стан контактора", "Kondisyon ng contactor"),
        volts(),
      ]),
      S(T_READ, [
        coils(), supply(), ret(), superheat(), subcool(),
        I(TX, R, "Filter size and condition", "Format et état du filtre", "Tamaño y estado del filtro", "Misura e stato del filtro", "Filtergröße und Zustand", "Розмір і стан фільтра", "Sukat at kondisyon ng filter"),
      ]),
      S(T_WRAP, [
        I(TX, O, "Recommendations for the client", "Recommandations au client", "Recomendaciones al cliente", "Raccomandazioni al cliente", "Empfehlungen für den Kunden", "Рекомендації клієнту", "Payo sa kliyente"),
      ]),
    ]),

  C("fq.cl.hvac.maintenance_minisplit", { trades: HVAC },
    ["Mini-split maintenance", "Entretien de thermopompe murale", "Mantenimiento de minisplit", "Manutenzione split", "Wartung Split-Klimagerät", "Обслуговування спліт-системи", "Maintenance ng mini-split"],
    [
      S(T_SYS, [
        runningBefore(),
        I(NU, R, "Indoor heads", "Unités intérieures", "Unidades interiores", "Unità interne", "Innengeräte", "Внутрішні блоки", "Bilang ng indoor unit"),
        model(),
        I(SL, R, "Remote working", "Télécommande fonctionnelle", "Control remoto funcionando", "Telecomando funzionante", "Fernbedienung funktioniert", "Пульт працює", "Gumagana ang remote"),
      ]),
      S(T_READ, [
        amps(), fanAmps(),
        I(NU, O, "Indoor fan motor amps", "Intensité du ventilateur intérieur", "Amperaje del ventilador interior", "Assorbimento ventilatore interno", "Strom Innenventilator (A)", "Струм внутрішнього вентилятора (А)", "Amps ng indoor fan"),
        coils(), supply(), ret(), superheat(), subcool(),
        I(TX, O, "Refrigerant pressures", "Pressions de frigorigène", "Presiones de refrigerante", "Pressioni del refrigerante", "Kältemitteldrücke", "Тиски холодоагенту", "Presyon ng refrigerant"),
        volts(),
      ]),
    ]),

  C("fq.cl.hvac.repair", { trades: HVAC, autoAddFor: ["hvac_repair"] },
    ["HVAC repair", "Réparation CVC", "Reparación de HVAC", "Riparazione HVAC", "HLK-Reparatur", "Ремонт ОВК", "Pagkumpuni ng HVAC"],
    [
      S(T_PREP, [
        I(CK, O, "Service history reviewed", "Historique de service consulté", "Historial de servicio revisado", "Storico interventi consultato", "Servicehistorie geprüft", "Історію обслуговування переглянуто", "Nirebyu ang kasaysayan ng serbisyo"),
        I(CK, R, "Power or gas isolated before work", "Électricité ou gaz isolé avant le travail", "Luz o gas aislados antes de trabajar", "Corrente o gas isolati prima del lavoro", "Strom oder Gas vor der Arbeit getrennt", "Живлення чи газ відключено перед роботою", "Pinatay ang kuryente o gas bago magtrabaho"),
        photoBefore(),
      ]),
      S(["Diagnosis and repair", "Diagnostic et réparation", "Diagnóstico y reparación", "Diagnosi e riparazione", "Diagnose und Reparatur", "Діагностика й ремонт", "Diyagnosis at pagkumpuni"], [
        I(TX, R, "Root cause found", "Cause trouvée", "Causa encontrada", "Causa individuata", "Ursache gefunden", "Причину знайдено", "Natukoy ang sanhi"),
        I(TX, R, "Work done and parts used", "Travaux faits et pièces utilisées", "Trabajo hecho y piezas usadas", "Lavoro fatto e ricambi usati", "Ausgeführte Arbeit und Teile", "Виконані роботи й використані деталі", "Ginawang trabaho at piyesang ginamit"),
        I(SL, R, "System tested after the repair", "Système testé après la réparation", "Sistema probado tras la reparación", "Impianto provato dopo la riparazione", "Anlage nach Reparatur geprüft", "Систему перевірено після ремонту", "Nasubok ang sistema pagkatapos"),
        photoAfter(),
      ]),
      S(T_WRAP, [
        I(CK, R, "Repair explained, with any recommendations", "Réparation expliquée, avec recommandations", "Reparación explicada, con recomendaciones", "Riparazione spiegata, con raccomandazioni", "Reparatur erklärt, mit Empfehlungen", "Ремонт пояснено, з рекомендаціями", "Naipaliwanag ang pagkumpuni at payo"),
        clientSignature(),
      ]),
    ]),
];
