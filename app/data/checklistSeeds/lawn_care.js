// app/data/checklistSeeds/lawn_care.js — see ./_build.js for the format.
import { C, S, I, IO, CK, TX, MS, SL, R, O } from "./_build.js";
import { T_PREP, T_WORK, T_WRAP } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.lawn.service_visit", { trades: ["lawn_care", "lawn_mowing", "landscaping_design", "irrigation", "property_maintenance"], autoAddFor: ["lawn_care", "lawn_mowing"] },
    ["Lawn service visit", "Visite d'entretien de pelouse", "Visita de mantenimiento de césped", "Intervento di manutenzione prato", "Rasenpflege-Einsatz", "Догляд за газоном", "Serbisyo sa damuhan"],
    [
      S(T_PREP, [
        I(CK, R, "Gates, pets and obstacles checked", "Barrières, animaux et obstacles vérifiés", "Portones, mascotas y obstáculos revisados", "Cancelli, animali e ostacoli verificati", "Tore, Haustiere und Hindernisse geprüft", "Хвіртки, тварин і перешкоди перевірено", "Nasuri ang gate, alagang hayop at harang"),
        I(CK, O, "Debris picked up before mowing", "Débris ramassés avant la tonte", "Basura recogida antes de cortar", "Detriti raccolti prima del taglio", "Unrat vor dem Mähen aufgesammelt", "Сміття прибрано перед покосом", "Pinulot ang kalat bago maggapas"),
      ]),
      S(T_WORK, [
        IO(MS, R, ["Services done", "Services faits", "Servicios hechos", "Servizi eseguiti", "Erledigte Leistungen", "Виконані послуги", "Mga serbisyong ginawa"],
          [["Mow", "Edge", "Trim", "Blow", "Weed", "Fertilise"], ["Tonte", "Bordures", "Taille", "Soufflage", "Désherbage", "Fertilisation"], ["Cortar", "Orillar", "Recortar", "Soplar", "Deshierbar", "Fertilizar"], ["Taglio", "Bordi", "Rifinitura", "Soffiatura", "Diserbo", "Concimazione"], ["Mähen", "Kanten", "Trimmen", "Blasen", "Unkraut", "Düngen"], ["Покіс", "Бордюри", "Підрізка", "Здування", "Прополювання", "Підживлення"], ["Gapas", "Gilid", "Trim", "Blower", "Damo", "Pataba"]]),
        I(TX, O, "Mowing height", "Hauteur de tonte", "Altura de corte", "Altezza di taglio", "Schnitthöhe", "Висота покосу", "Taas ng gapas"),
        I(SL, R, "Lawn health", "Santé de la pelouse", "Salud del césped", "Salute del prato", "Rasenzustand", "Стан газону", "Kalusugan ng damuhan"),
        I(TX, O, "Pests, disease or irrigation problems seen", "Ravageurs, maladies ou problèmes d'arrosage vus", "Plagas, enfermedades o problemas de riego vistos", "Parassiti, malattie o problemi di irrigazione visti", "Schädlinge, Krankheiten oder Bewässerungsprobleme", "Помічені шкідники, хвороби чи проблеми з поливом", "Nakitang peste, sakit o problema sa dilig"),
      ]),
      S(T_WRAP, [
        I(CK, R, "Walks and driveway blown clean", "Allées et entrée soufflées", "Banquetas y entrada limpias", "Vialetti e ingresso puliti", "Wege und Einfahrt abgeblasen", "Доріжки й заїзд очищено", "Nalinis ang daanan at driveway"),
        I(CK, R, "Gates closed behind us", "Barrières refermées", "Portones cerrados al salir", "Cancelli richiusi", "Tore wieder geschlossen", "Хвіртки зачинено", "Isinara ang gate paglabas"),
      ]),
    ]),
];
