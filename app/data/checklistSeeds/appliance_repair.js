// app/data/checklistSeeds/appliance_repair.js — see ./_build.js for the format.
import { C, S, I, IO, CK, TX, SE, SL, R, O } from "./_build.js";
import { T_WORK, T_TESTS, T_WRAP, cleanedUp, clientSignature, photoBefore } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.appliance.diagnostic", { trades: ["appliance_repair"], autoAddFor: ["appliance_repair"] },
    ["Appliance diagnostic and repair", "Diagnostic et réparation d'électroménager", "Diagnóstico y reparación de electrodomésticos", "Diagnosi e riparazione elettrodomestici", "Gerätediagnose und Reparatur", "Діагностика й ремонт побутової техніки", "Diyagnosis at ayos ng appliance"],
    [
      S(["Diagnosis", "Diagnostic", "Diagnóstico", "Diagnosi", "Diagnose", "Діагностика", "Diyagnosis"], [
        IO(SE, R, ["Appliance", "Appareil", "Aparato", "Apparecchio", "Gerät", "Прилад", "Appliance"],
          [["Refrigerator", "Washer", "Dryer", "Dishwasher", "Range or oven", "Other"], ["Réfrigérateur", "Laveuse", "Sécheuse", "Lave-vaisselle", "Cuisinière ou four", "Autre"], ["Refrigerador", "Lavadora", "Secadora", "Lavavajillas", "Estufa u horno", "Otro"], ["Frigorifero", "Lavatrice", "Asciugatrice", "Lavastoviglie", "Cucina o forno", "Altro"], ["Kühlschrank", "Waschmaschine", "Trockner", "Geschirrspüler", "Herd oder Backofen", "Sonstiges"], ["Холодильник", "Пральна машина", "Сушарка", "Посудомийка", "Плита чи духовка", "Інше"], ["Ref", "Washer", "Dryer", "Dishwasher", "Kalan o oven", "Iba pa"]]),
        I(TX, R, "Brand, model and serial number", "Marque, modèle et numéro de série", "Marca, modelo y número de serie", "Marca, modello e numero di serie", "Marke, Modell und Seriennummer", "Марка, модель і серійний номер", "Tatak, model at serial number"),
        I(TX, R, "Symptom the client describes", "Symptôme décrit par le client", "Síntoma que describe el cliente", "Sintomo descritto dal cliente", "Vom Kunden geschildertes Symptom", "Симптом зі слів клієнта", "Sintomas ayon sa kliyente"),
        I(TX, R, "Fault found", "Défaut trouvé", "Falla encontrada", "Guasto individuato", "Gefundener Fehler", "Знайдена несправність", "Nakitang sira"),
        photoBefore(),
      ]),
      S(T_WORK, [
        I(TX, O, "Parts replaced", "Pièces remplacées", "Piezas reemplazadas", "Ricambi sostituiti", "Ersetzte Teile", "Замінені деталі", "Pinalitang piyesa"),
        I(CK, O, "Parts ordered — return visit needed", "Pièces commandées — retour nécessaire", "Piezas pedidas — hace falta volver", "Ricambi ordinati — serve un ritorno", "Teile bestellt — zweiter Termin nötig", "Деталі замовлено — потрібен повторний візит", "Nag-order ng piyesa — kailangang bumalik"),
      ]),
      S(T_TESTS, [I(SL, R, "Runs a full cycle after the repair", "Fait un cycle complet après la réparation", "Completa un ciclo tras la reparación", "Completa un ciclo dopo la riparazione", "Läuft nach der Reparatur einen vollen Zyklus", "Після ремонту проходить повний цикл", "Nakakabuo ng buong cycle pagkatapos ayusin")]),
      S(T_WRAP, [cleanedUp(), clientSignature()]),
    ]),
];
