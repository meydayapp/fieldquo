// app/data/checklistSeeds/cabinet_refinishing.js — see ./_build.js for the format.
import { C, S, I, CK, TX, NU, SL, PH, SG, R, O } from "./_build.js";

export const CHECKLISTS = [
  C("fq.cl.cabinet_refinishing.painting", { trades: ["cabinet_refinishing", "interior_painting"], autoAddFor: ["cabinet_refinishing"] },
    ["Cabinet painting", "Peinture d'armoires", "Pintura de gabinetes", "Verniciatura di mobili da cucina", "Küchenfronten lackieren", "Фарбування кухонних фасадів", "Pagpipinta ng cabinet"],
    [
      S(["Preparation", "Préparation", "Preparación", "Preparazione", "Vorbereitung", "Підготовка", "Paghahanda"], [
        I(NU, R, "Doors and drawer fronts counted", "Portes et façades de tiroir comptées", "Puertas y frentes de cajón contados", "Ante e frontali cassetto contati", "Türen und Schubladenfronten gezählt", "Кількість дверцят і фасадів шухляд", "Bilang ng pinto at harap ng drawer"),
        I(CK, R, "Hardware removed and bagged by location", "Quincaillerie retirée et ensachée par emplacement", "Herrajes retirados y embolsados por ubicación", "Ferramenta rimossa e divisa per posizione", "Beschläge abgebaut und nach Position verpackt", "Фурнітуру знято й розкладено за місцями", "Tinanggal ang hardware at naka-bag ayon sa puwesto"),
        I(PH, O, "Before photo", "Photo avant", "Foto de antes", "Foto prima", "Vorher-Foto", "Фото до", "Larawan bago"),
      ]),
      S(["Inspection", "Inspection", "Inspección", "Ispezione", "Prüfung", "Огляд", "Inspeksiyon"], [
        I(TX, O, "Existing damage to boxes or doors", "Dommages existants aux caissons ou portes", "Daños existentes en cajas o puertas", "Danni esistenti a scocche o ante", "Vorhandene Schäden an Korpussen oder Türen", "Наявні пошкодження корпусів чи дверцят", "Dating sira sa kahon o pinto"),
        I(CK, R, "Grease and residue removed", "Graisse et résidus enlevés", "Grasa y residuos eliminados", "Grasso e residui rimossi", "Fett und Rückstände entfernt", "Жир і залишки видалено", "Natanggal ang mantika at dumi"),
      ]),
      S(["Safety", "Sécurité", "Seguridad", "Sicurezza", "Sicherheit", "Безпека", "Kaligtasan"], [
        I(CK, R, "Spray area ventilated", "Zone de pulvérisation ventilée", "Zona de pulverizado ventilada", "Zona di spruzzatura aerata", "Spritzbereich belüftet", "Зону розпилення провітрено", "May bentilasyon ang lugar ng spray"),
        I(CK, R, "Respirator and protective gear on", "Respirateur et protection portés", "Respirador y protección puestos", "Respiratore e protezioni indossati", "Atemschutz und Schutzausrüstung getragen", "Респіратор і захист вдягнено", "Suot ang respirator at proteksiyon"),
      ]),
      S(["The work", "Les travaux", "El trabajo", "Il lavoro", "Die Arbeit", "Роботи", "Ang trabaho"], [
        I(CK, R, "Sanded or deglossed", "Poncé ou dépoli", "Lijado o desengrasado", "Carteggiato o opacizzato", "Angeschliffen oder mattiert", "Відшліфовано або знежирено", "Nailiha o tinanggalan ng kinang"),
        I(CK, R, "Bonding primer applied", "Apprêt d'adhérence appliqué", "Imprimación de adherencia aplicada", "Primer aggrappante applicato", "Haftgrund aufgetragen", "Адгезійний ґрунт нанесено", "Nilagyan ng bonding primer"),
        I(TX, O, "Application method", "Méthode d'application", "Método de aplicación", "Metodo di applicazione", "Auftragsverfahren", "Спосіб нанесення", "Paraan ng paglalagay"),
        I(NU, O, "Finish coats", "Couches de finition", "Manos de acabado", "Mani di finitura", "Deckschichten", "Шарів фінішу", "Bilang ng patong ng finish"),
        I(SL, R, "Finish quality: no runs, orange peel or brush marks", "Qualité du fini : sans coulures, peau d'orange ni traces", "Calidad del acabado: sin chorreados, piel de naranja ni marcas", "Qualità della finitura: niente colature, buccia d'arancia o segni", "Oberfläche: keine Läufer, Orangenhaut oder Pinselspuren", "Якість фінішу: без патьоків, «апельсинової кірки» й слідів пензля", "Kalidad ng finish: walang tulo, orange peel o marka ng brotsa"),
      ]),
      S(["Reinstall and handover", "Réinstallation et remise", "Reinstalación y entrega", "Rimontaggio e consegna", "Montage und Übergabe", "Монтаж і передача", "Pagkabit muli at pagbibigay"], [
        I(CK, R, "Doors rehung and aligned", "Portes remontées et alignées", "Puertas colgadas y alineadas", "Ante rimontate e allineate", "Türen eingehängt und ausgerichtet", "Дверцята навішено й вирівняно", "Naikabit at pantay ang mga pinto"),
        I(PH, O, "After photo", "Photo après", "Foto de después", "Foto dopo", "Nachher-Foto", "Фото після", "Larawan pagkatapos"),
        I(CK, R, "Final walk-through with the client", "Visite finale avec le client", "Recorrido final con el cliente", "Sopralluogo finale con il cliente", "Abschlussbegehung mit dem Kunden", "Фінальний огляд із клієнтом", "Huling paglibot kasama ang kliyente"),
        I(SG, R, "Client signature", "Signature du client", "Firma del cliente", "Firma del cliente", "Unterschrift des Kunden", "Підпис клієнта", "Pirma ng kliyente"),
      ]),
    ]),
];
