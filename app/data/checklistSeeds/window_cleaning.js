// app/data/checklistSeeds/window_cleaning.js — see ./_build.js for the format.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";
import { T_PREP, T_WORK, T_WRAP } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.window_cleaning.visit", { trades: ["window_cleaning"], autoAddFor: ["window_cleaning"] },
    ["Window cleaning", "Lavage de vitres", "Limpieza de ventanas", "Pulizia vetri", "Fensterreinigung", "Миття вікон", "Paglilinis ng bintana"],
    [
      S(T_PREP, [
        I(CK, R, "Window coverings moved or removed", "Rideaux et stores déplacés ou retirés", "Cortinas y persianas movidas o retiradas", "Tende spostate o rimosse", "Vorhänge und Rollos beiseite oder abgenommen", "Штори й жалюзі відсунуто чи знято", "Nailipat o tinanggal ang kurtina"),
        I(TX, O, "Chips, cracks or failed seals found", "Éclats, fissures ou joints défaillants relevés", "Desportillados, grietas o sellos dañados encontrados", "Scheggiature, crepe o guarnizioni rotte rilevate", "Abplatzer, Risse oder defekte Dichtungen gefunden", "Виявлені сколи, тріщини чи зношені ущільнювачі", "Nakitang bitak o sirang selyo"),
      ]),
      S(T_WORK, [
        I(CK, R, "Sills and tracks cleaned", "Rebords et rails nettoyés", "Alféizares y rieles limpios", "Davanzali e binari puliti", "Fensterbänke und Schienen gereinigt", "Підвіконня й напрямні почищено", "Nalinis ang pasamano at riles"),
        I(CK, R, "Glass washed and squeegeed top to bottom", "Vitres lavées et raclées de haut en bas", "Vidrio lavado y secado de arriba abajo", "Vetri lavati e asciugati dall'alto in basso", "Glas gewaschen und von oben nach unten abgezogen", "Скло вимито й зібрано згори донизу", "Hinugasan at ni-squeegee pababa ang salamin"),
        I(CK, R, "Edges and corners detailed", "Bords et coins soignés", "Bordes y esquinas detallados", "Bordi e angoli rifiniti", "Ränder und Ecken nachgearbeitet", "Краї й кути доочищено", "Nilinis ang gilid at sulok"),
        I(CK, O, "Frames and screens wiped", "Cadres et moustiquaires essuyés", "Marcos y mosquiteros limpios", "Telai e zanzariere puliti", "Rahmen und Fliegengitter abgewischt", "Рами й сітки протерто", "Pinunasan ang frame at screen"),
        I(CK, O, "High windows done from pole or ladder safely", "Fenêtres hautes faites à la perche ou à l'échelle en sécurité", "Ventanas altas con pértiga o escalera de forma segura", "Finestre alte con asta o scala in sicurezza", "Hohe Fenster sicher mit Stange oder Leiter", "Високі вікна безпечно з жердиною чи драбиною", "Ligtas na nalinis ang mataas na bintana"),
      ]),
      S(T_WRAP, [
        I(SL, R, "No streaks under daylight", "Aucune trace à la lumière du jour", "Sin marcas con luz de día", "Nessun alone alla luce del giorno", "Keine Streifen bei Tageslicht", "Без розводів при денному світлі", "Walang guhit sa liwanag ng araw"),
        I(CK, R, "Coverings back and home left as found", "Rideaux replacés, maison laissée comme trouvée", "Cortinas en su lugar, casa como estaba", "Tende rimesse, casa lasciata com'era", "Vorhänge zurück, Haus wie vorgefunden", "Штори повернуто, дім як був", "Naibalik ang kurtina, gaya ng dati ang bahay"),
      ]),
    ]),
];
