// app/data/checklistSeeds/residential_cleaning.js — see ./_build.js for the format.
// Room by room, the order a clean moves through a house.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";
import { T_PREP, T_WRAP, scopeConfirmed } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.cleaning.home", { trades: ["residential_cleaning", "deep_cleaning", "commercial_cleaning", "janitorial", "property_maintenance"], autoAddFor: ["residential_cleaning", "deep_cleaning"] },
    ["Home cleaning, room by room", "Ménage, pièce par pièce", "Limpieza de casa, cuarto por cuarto", "Pulizia di casa, stanza per stanza", "Hausreinigung, Raum für Raum", "Прибирання, кімната за кімнатою", "Paglilinis ng bahay, bawat silid"],
    [
      S(T_PREP, [
        scopeConfirmed(),
        I(CK, R, "Supplies and equipment ready", "Produits et matériel prêts", "Productos y equipo listos", "Prodotti e attrezzatura pronti", "Mittel und Geräte bereit", "Засоби й інвентар готові", "Handa ang gamit at kagamitan"),
      ]),
      S(["Kitchen", "Cuisine", "Cocina", "Cucina", "Küche", "Кухня", "Kusina"], [
        I(CK, R, "Counters, sink and backsplash", "Comptoirs, évier et dosseret", "Encimeras, fregadero y salpicadero", "Piani, lavello e paraschizzi", "Arbeitsflächen, Spüle und Fliesenspiegel", "Стільниці, мийка й фартух", "Countertop, lababo at backsplash"),
        I(CK, R, "Appliance fronts, inside microwave", "Façades des électroménagers, intérieur du micro-ondes", "Frentes de electrodomésticos, interior del microondas", "Frontali elettrodomestici, interno microonde", "Gerätefronten, Mikrowelle innen", "Фасади техніки, мікрохвильовка всередині", "Harap ng appliances, loob ng microwave"),
        I(CK, O, "Inside oven and fridge, if booked", "Intérieur du four et du frigo, si prévu", "Interior de horno y refrigerador, si se reservó", "Interno forno e frigo, se previsto", "Backofen und Kühlschrank innen, falls gebucht", "Духовка й холодильник всередині, якщо замовлено", "Loob ng oven at ref, kung kasama"),
      ]),
      S(["Bathrooms", "Salles de bain", "Baños", "Bagni", "Bäder", "Ванні кімнати", "Banyo"], [
        I(CK, R, "Toilet, inside and out", "Toilette, dedans et dehors", "Inodoro, por dentro y por fuera", "WC, dentro e fuori", "WC innen und außen", "Унітаз всередині й ззовні", "Inidoro, loob at labas"),
        I(CK, R, "Shower, tub and grout", "Douche, bain et joints", "Ducha, tina y juntas", "Doccia, vasca e fughe", "Dusche, Wanne und Fugen", "Душ, ванна й шви", "Shower, tub at grout"),
        I(CK, R, "Vanity and mirrors", "Meuble-lavabo et miroirs", "Lavabo y espejos", "Lavabo e specchi", "Waschtisch und Spiegel", "Умивальник і дзеркала", "Vanity at salamin"),
      ]),
      S(["Bedrooms and living areas", "Chambres et aires de séjour", "Dormitorios y salas", "Camere e zona giorno", "Schlaf- und Wohnräume", "Спальні й житлові кімнати", "Kuwarto at sala"], [
        I(CK, R, "Dusting, high to low", "Époussetage, de haut en bas", "Sacudir, de arriba abajo", "Spolverare dall'alto in basso", "Staubwischen von oben nach unten", "Витирання пилу згори донизу", "Pagpupunas ng alikabok, taas pababa"),
        I(CK, O, "Beds made, linens changed if asked", "Lits faits, draps changés si demandé", "Camas hechas, sábanas cambiadas si se pidió", "Letti rifatti, lenzuola cambiate se richiesto", "Betten gemacht, Wäsche gewechselt falls gewünscht", "Ліжка заправлено, білизну змінено на прохання", "Naayos ang kama, pinalitan ang kumot kung hiniling"),
        I(CK, O, "Under beds and furniture", "Sous les lits et meubles", "Debajo de camas y muebles", "Sotto letti e mobili", "Unter Betten und Möbeln", "Під ліжками й меблями", "Ilalim ng kama at muwebles"),
        I(CK, O, "Blinds, sills and inside glass", "Stores, rebords et vitres intérieures", "Persianas, alféizares y vidrios interiores", "Tapparelle, davanzali e vetri interni", "Jalousien, Fensterbänke und Glas innen", "Жалюзі, підвіконня й скло зсередини", "Blinds, pasamano ng bintana at salamin sa loob"),
        I(CK, R, "Handles, switches and other high-touch spots", "Poignées, interrupteurs et points de contact", "Manijas, apagadores y puntos de contacto", "Maniglie, interruttori e punti di contatto", "Griffe, Schalter und Kontaktflächen", "Ручки, вимикачі й часто торкані місця", "Hawakan, switch at madalas hawakan"),
      ]),
      S(["Floors", "Planchers", "Pisos", "Pavimenti", "Böden", "Підлога", "Sahig"], [
        I(CK, R, "Vacuumed, including stairs", "Aspirés, escaliers compris", "Aspirados, escaleras incluidas", "Aspirati, scale comprese", "Gesaugt, inklusive Treppe", "Пропилососено, разом зі сходами", "Na-vacuum pati hagdan"),
        I(CK, R, "Hard floors mopped", "Planchers durs lavés", "Pisos duros trapeados", "Pavimenti duri lavati", "Hartböden gewischt", "Тверду підлогу вимито", "Namop ang matigas na sahig"),
      ]),
      S(T_WRAP, [
        I(SL, R, "Final check and touch-ups", "Vérification finale et retouches", "Revisión final y retoques", "Controllo finale e ritocchi", "Endkontrolle und Nacharbeit", "Фінальна перевірка й доопрацювання", "Huling tsek at retoke"),
        I(CK, R, "Trash taken out", "Poubelles sorties", "Basura sacada", "Spazzatura portata fuori", "Müll hinausgebracht", "Сміття винесено", "Nailabas ang basura"),
        I(CK, R, "Doors and windows locked on the way out", "Portes et fenêtres verrouillées en partant", "Puertas y ventanas cerradas al salir", "Porte e finestre chiuse all'uscita", "Türen und Fenster beim Gehen verschlossen", "Двері й вікна замкнено на виході", "Naka-lock ang pinto at bintana paglabas"),
        I(TX, O, "Notes for the next visit", "Notes pour la prochaine visite", "Notas para la próxima visita", "Note per la prossima visita", "Hinweise für den nächsten Termin", "Нотатки на наступний візит", "Tala para sa susunod na bisita"),
      ]),
    ]),
];
