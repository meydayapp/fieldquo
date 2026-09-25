// app/data/checklistSeeds/exterior_painting.js — see ./_build.js for the format.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";

export const CHECKLISTS = [
  C("fq.cl.exterior_painting.pressure_washing", { trades: ["exterior_painting", "pressure_washing_house", "pressure_washing_driveway"], autoAddFor: ["pressure_washing_house", "pressure_washing_driveway"] },
    ["Pressure washing", "Lavage à pression", "Lavado a presión", "Idropulitura", "Hochdruckreinigung", "Миття під тиском", "Pressure washing"],
    [
      S(["Preparation", "Préparation", "Preparación", "Preparazione", "Vorbereitung", "Підготовка", "Paghahanda"], [
        I(CK, R, "Water source confirmed", "Source d'eau confirmée", "Fuente de agua confirmada", "Fonte d'acqua confermata", "Wasseranschluss bestätigt", "Джерело води підтверджено", "Kumpirmado ang pagkukunan ng tubig"),
        I(TX, R, "Surface type", "Type de surface", "Tipo de superficie", "Tipo di superficie", "Oberflächenart", "Тип поверхні", "Uri ng ibabaw"),
      ]),
      S(["Safety", "Sécurité", "Seguridad", "Sicurezza", "Sicherheit", "Безпека", "Kaligtasan"], [
        I(CK, R, "Pressure and tip right for the surface", "Pression et buse adaptées à la surface", "Presión y boquilla adecuadas a la superficie", "Pressione e ugello adatti alla superficie", "Druck und Düse passend zur Oberfläche", "Тиск і насадка відповідають поверхні", "Tama ang presyon at nozzle para sa ibabaw"),
        I(CK, R, "Plants, windows and fixtures protected", "Plantes, fenêtres et luminaires protégés", "Plantas, ventanas y lámparas protegidas", "Piante, finestre e lampade protette", "Pflanzen, Fenster und Leuchten geschützt", "Рослини, вікна й світильники захищено", "Protektado ang halaman, bintana at ilaw"),
      ]),
      S(["The work", "Les travaux", "El trabajo", "Il lavoro", "Die Arbeit", "Роботи", "Ang trabaho"], [
        I(CK, O, "Cleaning solution applied", "Solution nettoyante appliquée", "Solución limpiadora aplicada", "Detergente applicato", "Reinigungsmittel aufgetragen", "Мийний засіб нанесено", "Nilagyan ng panlinis"),
        I(SL, R, "Surface evenly clean", "Surface uniformément propre", "Superficie limpia de forma pareja", "Superficie pulita in modo uniforme", "Oberfläche gleichmäßig sauber", "Поверхня рівномірно чиста", "Pantay na malinis ang ibabaw"),
        I(TX, O, "Problem areas found", "Zones problématiques relevées", "Zonas problemáticas encontradas", "Zone problematiche rilevate", "Problemstellen gefunden", "Виявлені проблемні ділянки", "Nakitang problemang bahagi"),
      ]),
      S(["Wrap-up", "Fin des travaux", "Cierre", "Chiusura", "Abschluss", "Завершення", "Pagtatapos"], [
        I(CK, R, "Client happy with the result", "Client satisfait du résultat", "Cliente satisfecho con el resultado", "Cliente soddisfatto del risultato", "Kunde mit dem Ergebnis zufrieden", "Клієнт задоволений результатом", "Masaya ang kliyente sa resulta"),
      ]),
    ]),
];
