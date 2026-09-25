// app/data/checklistSeeds/snow_removal.js — see ./_build.js for the format.
import { C, S, I, IO, CK, TX, NU, SE, SL, PH, R, O } from "./_build.js";
import { T_WORK, T_WRAP } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.snow.route_visit", { trades: ["snow_removal"], autoAddFor: ["snow_removal"] },
    ["Snow removal visit", "Passage de déneigement", "Visita de retiro de nieve", "Intervento di sgombero neve", "Winterdienst-Einsatz", "Прибирання снігу", "Pagtanggal ng niyebe"],
    [
      S(["Arrival", "Arrivée", "Llegada", "Arrivo", "Ankunft", "Прибуття", "Pagdating"], [
        I(NU, R, "Snow depth on arrival (in)", "Épaisseur de neige à l'arrivée (po)", "Profundidad de nieve al llegar (pulg)", "Altezza della neve all'arrivo (cm)", "Schneehöhe bei Ankunft (cm)", "Товщина снігу при прибутті (см)", "Kapal ng niyebe pagdating (pulgada)"),
        IO(SE, R, ["Conditions", "Conditions", "Condiciones", "Condizioni", "Bedingungen", "Умови", "Kalagayan"],
          [["Powder", "Wet and heavy", "Ice"], ["Poudreuse", "Mouillée et lourde", "Glace"], ["Polvo", "Húmeda y pesada", "Hielo"], ["Farinosa", "Bagnata e pesante", "Ghiaccio"], ["Pulver", "Nass und schwer", "Eis"], ["Пухкий", "Мокрий і важкий", "Лід"], ["Pino", "Basa at mabigat", "Yelo"]]),
      ]),
      S(T_WORK, [
        I(CK, R, "Driveway cleared", "Entrée déneigée", "Entrada despejada", "Passo carraio sgombrato", "Einfahrt geräumt", "Заїзд розчищено", "Nalinis ang driveway"),
        I(CK, R, "Walks and steps cleared", "Allées et marches déneigées", "Banquetas y escalones despejados", "Vialetti e gradini sgombrati", "Wege und Stufen geräumt", "Доріжки й сходи розчищено", "Nalinis ang daanan at hagdan"),
        I(CK, O, "Salt or ice melt applied", "Sel ou fondant appliqué", "Sal o descongelante aplicado", "Sale o antighiaccio sparso", "Salz oder Taumittel gestreut", "Посипано сіллю чи реагентом", "Nilagyan ng asin o pantunaw"),
        I(SL, O, "Damage to lawn, curbs or property", "Dommages à la pelouse, bordures ou propriété", "Daños al césped, bordillos o propiedad", "Danni a prato, cordoli o proprietà", "Schäden an Rasen, Bordsteinen oder Grundstück", "Пошкодження газону, бордюрів чи майна", "Sira sa damuhan, gilid o ari-arian"),
      ]),
      S(T_WRAP, [
        I(PH, R, "Photo of the cleared site", "Photo du site déneigé", "Foto del sitio despejado", "Foto del sito sgombrato", "Foto der geräumten Fläche", "Фото розчищеної ділянки", "Larawan ng nalinis na lugar"),
        I(TX, O, "Notes for the next storm", "Notes pour la prochaine tempête", "Notas para la próxima tormenta", "Note per la prossima nevicata", "Hinweise für den nächsten Einsatz", "Нотатки на наступний снігопад", "Tala para sa susunod na bagyo"),
      ]),
    ]),
];
