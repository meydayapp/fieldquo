// app/data/checklistSeeds/tree_care_service.js — see ./_build.js for the format.
import { C, S, I, CK, TX, NU, SL, R, O } from "./_build.js";
import { T_SAFETY, T_WORK, T_WRAP, photoBefore, photoAfter, clientSignature } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.tree.hazard_check", { trades: ["tree_care_service", "landscaping_design"], autoAddFor: ["tree_care_service"] },
    ["Tree hazard check and work", "Évaluation des risques et travaux d'arbre", "Revisión de riesgo y trabajo en árbol", "Verifica dei rischi e lavori sull'albero", "Baumgefahrenprüfung und Arbeiten", "Оцінка небезпеки й роботи з деревом", "Tsek ng panganib at trabaho sa puno"],
    [
      S(["Assessment", "Évaluation", "Evaluación", "Valutazione", "Beurteilung", "Оцінка", "Pagtatasa"], [
        I(TX, R, "Species and approximate height", "Essence et hauteur approximative", "Especie y altura aproximada", "Specie e altezza approssimativa", "Baumart und ungefähre Höhe", "Порода й приблизна висота", "Uri at tantiyang taas"),
        I(NU, O, "Trunk diameter (in)", "Diamètre du tronc (po)", "Diámetro del tronco (pulg)", "Diametro del tronco (cm)", "Stammdurchmesser (cm)", "Діаметр стовбура (см)", "Diyametro ng puno (pulgada)"),
        I(SL, R, "Deadwood, cracks, decay or lean", "Bois mort, fissures, pourriture ou inclinaison", "Madera muerta, grietas, pudrición o inclinación", "Legno morto, crepe, carie o inclinazione", "Totholz, Risse, Fäule oder Schieflage", "Сухостій, тріщини, гниль чи нахил", "Patay na sanga, bitak, bulok o hilig"),
        I(SL, R, "Targets: house, lines, cars, people", "Cibles : maison, fils, autos, personnes", "Objetivos: casa, cables, autos, personas", "Bersagli: casa, linee, auto, persone", "Gefährdete Ziele: Haus, Leitungen, Autos, Personen", "Під загрозою: будинок, дроти, авто, люди", "Maaaring tamaan: bahay, linya, kotse, tao"),
        photoBefore(),
      ]),
      S(T_SAFETY, [
        I(CK, R, "Drop zone set and marked", "Zone de chute délimitée", "Zona de caída marcada", "Zona di caduta delimitata", "Fallbereich abgesperrt", "Зону падіння позначено", "Minarkahan ang babagsakan"),
        I(CK, R, "Power lines checked — no work within the clearance", "Lignes électriques vérifiées — aucun travail dans la distance d'approche", "Líneas eléctricas revisadas — sin trabajo dentro de la distancia", "Linee elettriche verificate — nessun lavoro entro la distanza", "Stromleitungen geprüft — kein Arbeiten im Schutzabstand", "Лінії електропередач перевірено — без робіт у зоні", "Nasuri ang linya ng kuryente — walang trabaho sa loob ng layo"),
        I(CK, R, "Climbing and rigging gear inspected", "Équipement de grimpe et de gréage inspecté", "Equipo de escalada y aparejo inspeccionado", "Attrezzatura di arrampicata e tiro ispezionata", "Kletter- und Seilausrüstung geprüft", "Спорядження для лазіння й такелажу перевірено", "Nasuri ang gamit sa pag-akyat at rigging"),
      ]),
      S(T_WORK, [
        I(TX, R, "Work done: prune, removal, stump", "Travaux faits : élagage, abattage, souche", "Trabajo hecho: poda, retiro, tocón", "Lavoro fatto: potatura, abbattimento, ceppo", "Ausgeführt: Schnitt, Fällung, Stubben", "Виконано: обрізка, видалення, пень", "Ginawa: pruning, pagtanggal, tuod"),
        I(CK, R, "Wood and brush cleared as agreed", "Bois et branches enlevés comme convenu", "Madera y ramas retiradas según lo acordado", "Legna e ramaglie rimosse come concordato", "Holz und Reisig wie vereinbart entfernt", "Деревину й гілля прибрано, як домовлено", "Nailigpit ang kahoy at sanga ayon sa usapan"),
      ]),
      S(T_WRAP, [photoAfter(), clientSignature()]),
    ]),
];
