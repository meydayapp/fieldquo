// app/data/checklistSeeds/roofing_service.js — see ./_build.js for the format.
import { C, S, I, CK, TX, NU, SL, R, O } from "./_build.js";
import { T_PREP, T_WRAP, photoBefore, photoAfter, walkThrough, clientSignature } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.roofing.tearoff_dryin", { trades: ["roofing_service", "gutter_services", "chimney_sweep"], autoAddFor: ["roofing_service"] },
    ["Roof tear-off and dry-in", "Arrachage et mise hors d'eau de toiture", "Retiro de techo e impermeabilización", "Rimozione del manto e messa all'asciutto", "Dach abdecken und dicht machen", "Демонтаж покрівлі й гідроізоляція", "Pagtanggal ng bubong at dry-in"],
    [
      S(T_PREP, [
        I(CK, R, "Forecast checked for the tear-off window", "Météo vérifiée pour l'arrachage", "Pronóstico revisado para el retiro", "Meteo verificato per la rimozione", "Wetter für das Abdecken geprüft", "Прогноз погоди перевірено", "Nasuri ang panahon bago magtanggal"),
        I(CK, R, "Landscaping, AC unit and windows protected", "Aménagement, climatiseur et fenêtres protégés", "Jardín, aire acondicionado y ventanas protegidos", "Giardino, climatizzatore e finestre protetti", "Garten, Klimagerät und Fenster geschützt", "Озеленення, кондиціонер і вікна захищено", "Protektado ang halaman, AC at bintana"),
        I(CK, R, "Fall protection anchored", "Protection antichute ancrée", "Protección anticaídas anclada", "Anticaduta ancorato", "Absturzsicherung angeschlagen", "Страхувальну систему закріплено", "Nakakabit ang fall protection"),
        photoBefore(),
      ]),
      S(["Tear-off and deck", "Arrachage et platelage", "Retiro y cubierta", "Rimozione e tavolato", "Abdecken und Schalung", "Демонтаж і настил", "Pagtanggal at deck"], [
        I(CK, R, "Old roofing removed to the deck", "Ancienne couverture retirée jusqu'au platelage", "Techo viejo retirado hasta la cubierta", "Vecchio manto rimosso fino al tavolato", "Alte Eindeckung bis zur Schalung entfernt", "Старе покриття знято до настилу", "Natanggal ang lumang bubong hanggang deck"),
        I(SL, R, "Deck condition", "État du platelage", "Estado de la cubierta", "Stato del tavolato", "Zustand der Schalung", "Стан настилу", "Kondisyon ng deck"),
        I(NU, O, "Sheets of decking replaced", "Panneaux de platelage remplacés", "Hojas de cubierta reemplazadas", "Pannelli del tavolato sostituiti", "Ersetzte Schalungsplatten", "Замінено листів настилу", "Bilang ng pinalitang decking"),
      ]),
      S(["Dry-in", "Mise hors d'eau", "Impermeabilización", "Messa all'asciutto", "Dicht machen", "Гідроізоляція", "Dry-in"], [
        I(CK, R, "Ice and water shield at eaves, valleys and penetrations", "Membrane autocollante aux avant-toits, noues et percées", "Barrera de hielo y agua en aleros, limahoyas y pasos", "Guaina impermeabile a gronde, compluvi e passaggi", "Eisschutzbahn an Traufe, Kehlen und Durchdringungen", "Захисна мембрана на звисах, ендовах і проходах", "May ice and water shield sa eaves, valley at butas"),
        I(CK, R, "Underlayment lapped and fastened", "Sous-couche chevauchée et fixée", "Membrana traslapada y fijada", "Sottomanto sormontato e fissato", "Unterdeckbahn überlappt und befestigt", "Підкладковий шар з напуском і закріплено", "Magkapatong at nakakabit ang underlayment"),
        I(CK, R, "Drip edge and flashing installed", "Larmier et solins posés", "Goteros y tapajuntas instalados", "Gocciolatoio e scossaline posati", "Tropfkante und Anschlussbleche montiert", "Карнизну планку й відливи встановлено", "Naikabit ang drip edge at flashing"),
        I(SL, R, "Roof watertight at end of day", "Toit étanche en fin de journée", "Techo impermeable al final del día", "Tetto impermeabile a fine giornata", "Dach am Tagesende dicht", "Дах герметичний наприкінці дня", "Hindi tinatagusan ang bubong sa hapon"),
      ]),
      S(T_WRAP, [
        I(CK, R, "Nails swept with a magnet", "Clous ramassés à l'aimant", "Clavos recogidos con imán", "Chiodi raccolti con il magnete", "Nägel mit Magnet eingesammelt", "Цвяхи зібрано магнітом", "Nilinis ng magnet ang mga pako"),
        I(TX, O, "Anything found to raise with the client", "Constats à signaler au client", "Hallazgos para comentar con el cliente", "Cose da segnalare al cliente", "Befunde für den Kunden", "Що потрібно обговорити з клієнтом", "Mga nakita na sasabihin sa kliyente"),
        photoAfter(), walkThrough(), clientSignature(),
      ]),
    ]),
];
