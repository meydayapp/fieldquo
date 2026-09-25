// app/data/checklistSeeds/_common.js
//
// Items and sections several trades share word for word — written once so a
// wording fix lands everywhere rather than in the one copy somebody found.
import { S, I, CK, TX, PH, SG, SL, R, O } from "./_build.js";

export const T_PREP = ["Preparation", "Préparation", "Preparación", "Preparazione", "Vorbereitung", "Підготовка", "Paghahanda"];
export const T_WORK = ["The work", "Les travaux", "El trabajo", "Il lavoro", "Die Arbeit", "Роботи", "Ang trabaho"];
export const T_SAFETY = ["Safety", "Sécurité", "Seguridad", "Sicurezza", "Sicherheit", "Безпека", "Kaligtasan"];
export const T_TESTS = ["Tests", "Essais", "Pruebas", "Prove", "Prüfungen", "Перевірки", "Mga pagsubok"];
export const T_WRAP = ["Wrap-up", "Fin des travaux", "Cierre", "Chiusura", "Abschluss", "Завершення", "Pagtatapos"];
export const T_SIGNOFF = ["Sign-off", "Approbation", "Conformidad", "Firma", "Abnahme", "Підписання", "Pag-apruba"];

export const photoBefore = () => I(PH, O, "Before photo", "Photo avant", "Foto de antes", "Foto prima", "Vorher-Foto", "Фото до", "Larawan bago");
export const photoAfter = () => I(PH, O, "After photo", "Photo après", "Foto de después", "Foto dopo", "Nachher-Foto", "Фото після", "Larawan pagkatapos");
export const scopeConfirmed = (req = R) => I(CK, req, "Scope confirmed with the client", "Portée confirmée avec le client", "Alcance confirmado con el cliente", "Lavori confermati con il cliente", "Umfang mit dem Kunden bestätigt", "Обсяг робіт підтверджено з клієнтом", "Kumpirmado ang saklaw sa kliyente");
export const cleanedUp = (req = R) => I(CK, req, "Work area cleaned up", "Zone de travail nettoyée", "Área de trabajo limpia", "Area di lavoro pulita", "Arbeitsbereich aufgeräumt", "Робочу зону прибрано", "Nalinis ang lugar ng trabaho");
export const walkThrough = (req = R) => I(CK, req, "Walk-through with the client", "Visite avec le client", "Recorrido con el cliente", "Sopralluogo con il cliente", "Begehung mit dem Kunden", "Огляд разом із клієнтом", "Paglibot kasama ang kliyente");
export const clientHappy = (req = O) => I(SL, req, "Client satisfaction", "Satisfaction du client", "Satisfacción del cliente", "Soddisfazione del cliente", "Kundenzufriedenheit", "Задоволеність клієнта", "Kasiyahan ng kliyente");
export const clientSignature = (req = R) => I(SG, req, "Client signature", "Signature du client", "Firma del cliente", "Firma del cliente", "Unterschrift des Kunden", "Підпис клієнта", "Pirma ng kliyente");
export const punchNotes = () => I(TX, O, "Punch-list items still open", "Éléments de liste de fin de travaux encore ouverts", "Pendientes aún abiertos", "Voci della lista finale ancora aperte", "Noch offene Restarbeiten", "Незавершені дрібні доробки", "Mga natitirang ayusin");

/** Permits and site readiness — the opening section of every remodel. */
export const permitsSection = () => S(["Permits and site", "Permis et chantier", "Permisos y obra", "Permessi e cantiere", "Genehmigungen und Baustelle", "Дозволи та майданчик", "Permit at lugar"], [
  I(CK, R, "Permit and HOA approval confirmed", "Permis et approbation du syndicat confirmés", "Permiso y aprobación de la asociación confirmados", "Permesso e approvazione condominiale confermati", "Baugenehmigung und Eigentümerfreigabe bestätigt", "Дозвіл і погодження ОСББ підтверджено", "Kumpirmado ang permit at pag-apruba ng HOA"),
  I(CK, R, "Site access and staging area agreed", "Accès et aire d'entreposage convenus", "Acceso y zona de acopio acordados", "Accesso e area di stoccaggio concordati", "Zugang und Lagerfläche vereinbart", "Доступ і місце складування погоджено", "Napagkasunduan ang daanan at lagayan"),
]);

/** Closing section: walk the work, note what is open, get it signed. */
export const finalSection = () => S(["Final walk-through", "Visite finale", "Recorrido final", "Sopralluogo finale", "Abschlussbegehung", "Фінальний огляд", "Huling paglibot"], [
  walkThrough(),
  punchNotes(),
  clientSignature(),
]);

/** "Inspection booked / passed" — HCP's stop-light pattern for a code inspection. */
export const inspection = (req, ...labels) => I(SL, req, ...labels);
