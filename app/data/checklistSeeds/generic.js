// app/data/checklistSeeds/generic.js — see ./_build.js for the format.
// Four lists any trade can use — installed alongside whichever trade a
// company switches on, so a trade with no list of its own still has one.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";
import { T_PREP, T_WORK, T_TESTS, T_WRAP, scopeConfirmed, cleanedUp, walkThrough, clientHappy, clientSignature, photoBefore, photoAfter } from "./_common.js";

const ANY = ["*"];
const explain = () => I(CK, R, "Work explained to the client", "Travaux expliqués au client", "Trabajo explicado al cliente", "Lavoro spiegato al cliente", "Arbeit dem Kunden erklärt", "Роботу пояснено клієнту", "Naipaliwanag ang trabaho sa kliyente");
const findings = (req = R) => I(TX, req, "What we found", "Ce que nous avons constaté", "Lo que encontramos", "Cosa abbiamo trovato", "Was wir vorgefunden haben", "Що ми виявили", "Ang nakita namin");
const followUp = () => I(TX, O, "Follow-up needed", "Suivi nécessaire", "Seguimiento necesario", "Seguito necessario", "Nacharbeit nötig", "Потрібні подальші дії", "Kailangang balikan");

export const CHECKLISTS = [
  C("fq.cl.generic.service_visit", { trades: ANY },
    ["Service visit", "Visite de service", "Visita de servicio", "Intervento", "Serviceeinsatz", "Сервісний візит", "Pagbisita para sa serbisyo"],
    [
      S(T_PREP, [scopeConfirmed(), photoBefore()]),
      S(T_WORK, [findings(), I(CK, R, "Work done to scope", "Travaux faits selon la portée", "Trabajo hecho según lo acordado", "Lavoro eseguito come concordato", "Arbeit wie vereinbart erledigt", "Роботу виконано за обсягом", "Tapos ayon sa saklaw"), followUp()]),
      S(T_WRAP, [photoAfter(), cleanedUp(), walkThrough(), clientHappy()]),
    ]),

  C("fq.cl.generic.installation", { trades: ANY },
    ["Installation", "Installation", "Instalación", "Installazione", "Montage", "Монтаж", "Pagkakabit"],
    [
      S(T_PREP, [
        I(CK, R, "All parts and materials on site", "Toutes les pièces et le matériel sur place", "Todas las piezas y materiales en obra", "Tutti i pezzi e materiali in cantiere", "Alle Teile und Materialien vor Ort", "Усі деталі й матеріали на місці", "Kumpleto ang piyesa at materyales"),
        I(CK, R, "Install location checked", "Emplacement vérifié", "Ubicación revisada", "Posizione verificata", "Einbauort geprüft", "Місце монтажу перевірено", "Nasuri ang lugar ng pagkakabit"),
        photoBefore(),
      ]),
      S(T_WORK, [
        I(CK, R, "Installed to the maker's instructions", "Installé selon les instructions du fabricant", "Instalado según las instrucciones del fabricante", "Installato secondo le istruzioni del produttore", "Nach Herstelleranleitung montiert", "Встановлено за інструкцією виробника", "Naikabit ayon sa instruksiyon ng gumawa"),
        I(TX, O, "Model and serial numbers", "Numéros de modèle et de série", "Números de modelo y serie", "Modello e numeri di serie", "Modell- und Seriennummern", "Моделі й серійні номери", "Model at serial number"),
      ]),
      S(T_TESTS, [I(SL, R, "Tested and working", "Testé et fonctionnel", "Probado y funcionando", "Provato e funzionante", "Geprüft und funktioniert", "Перевірено, працює", "Nasubok at gumagana")]),
      S(T_WRAP, [photoAfter(), cleanedUp(), explain(), I(CK, O, "Manuals and warranty handed over", "Manuels et garantie remis", "Manuales y garantía entregados", "Manuali e garanzia consegnati", "Anleitungen und Garantie übergeben", "Інструкції й гарантію передано", "Naibigay ang manwal at warranty"), clientSignature()]),
    ]),

  C("fq.cl.generic.repair", { trades: ANY },
    ["Repair", "Réparation", "Reparación", "Riparazione", "Reparatur", "Ремонт", "Pagkumpuni"],
    [
      S(T_PREP, [photoBefore(), I(CK, R, "Power, water or gas isolated where needed", "Électricité, eau ou gaz isolés au besoin", "Luz, agua o gas aislados si hace falta", "Corrente, acqua o gas isolati se serve", "Strom, Wasser oder Gas wo nötig getrennt", "Живлення, воду чи газ відключено де потрібно", "Pinatay ang kuryente, tubig o gas kung kailangan")]),
      S(T_WORK, [
        I(TX, R, "Cause found", "Cause trouvée", "Causa encontrada", "Causa individuata", "Ursache gefunden", "Причину знайдено", "Natukoy ang sanhi"),
        I(TX, R, "Repair made and parts used", "Réparation faite et pièces utilisées", "Reparación hecha y piezas usadas", "Riparazione fatta e ricambi usati", "Reparatur und verwendete Teile", "Ремонт і використані деталі", "Ginawang ayos at piyesang ginamit"),
      ]),
      S(T_TESTS, [I(SL, R, "Tested after the repair", "Testé après la réparation", "Probado tras la reparación", "Provato dopo la riparazione", "Nach der Reparatur geprüft", "Перевірено після ремонту", "Nasubok pagkatapos ayusin")]),
      S(T_WRAP, [photoAfter(), cleanedUp(), explain(), clientSignature()]),
    ]),

  C("fq.cl.generic.maintenance", { trades: ANY },
    ["Maintenance visit", "Visite d'entretien", "Visita de mantenimiento", "Manutenzione periodica", "Wartungseinsatz", "Планове обслуговування", "Pagbisita para sa maintenance"],
    [
      S(T_WORK, [
        I(SL, R, "Overall condition", "État général", "Estado general", "Condizioni generali", "Gesamtzustand", "Загальний стан", "Kabuuang kondisyon"),
        I(CK, R, "Scheduled maintenance items done", "Entretien prévu fait", "Mantenimiento programado hecho", "Manutenzione prevista eseguita", "Geplante Wartung erledigt", "Планові роботи виконано", "Tapos ang nakatakdang maintenance"),
        findings(O),
        I(TX, O, "Recommendations before the next visit", "Recommandations avant la prochaine visite", "Recomendaciones antes de la próxima visita", "Raccomandazioni prima della prossima visita", "Empfehlungen bis zum nächsten Termin", "Рекомендації до наступного візиту", "Payo bago ang susunod na bisita"),
      ]),
      S(T_WRAP, [cleanedUp(), clientHappy()]),
    ]),
];
