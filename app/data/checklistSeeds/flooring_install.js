// app/data/checklistSeeds/flooring_install.js — see ./_build.js for the format.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";
import { finalSection, inspection } from "./_common.js";

export const CHECKLISTS = [
  C("fq.cl.flooring.install", { trades: ["flooring_install", "flooring", "general_contracting"], autoAddFor: ["flooring_install", "flooring"] },
    ["Flooring installation", "Pose de plancher", "Instalación de piso", "Posa del pavimento", "Bodenverlegung", "Укладання підлоги", "Pagkakabit ng sahig"],
    [
      S(["Site", "Chantier", "Obra", "Cantiere", "Baustelle", "Майданчик", "Lugar"], [
        inspection(O, "Permit or HOA approval, if needed", "Permis ou approbation du syndicat, au besoin", "Permiso o aprobación de la asociación, si aplica", "Permesso o approvazione condominiale, se serve", "Genehmigung oder Eigentümerfreigabe, falls nötig", "Дозвіл чи погодження ОСББ, якщо потрібно", "Permit o pag-apruba ng HOA, kung kailangan"),
        I(CK, R, "Rooms cleared and access agreed", "Pièces vidées et accès convenu", "Cuartos despejados y acceso acordado", "Stanze sgombre e accesso concordato", "Räume geräumt und Zugang vereinbart", "Кімнати звільнено, доступ погоджено", "Nailigpit ang silid at napagkasunduan ang daanan"),
      ]),
      S(["Subfloor", "Sous-plancher", "Contrapiso", "Sottofondo", "Unterboden", "Основа підлоги", "Subfloor"], [
        inspection(R, "Moisture test within the maker's limit", "Taux d'humidité dans la limite du fabricant", "Humedad dentro del límite del fabricante", "Umidità entro il limite del produttore", "Feuchte im Herstellergrenzwert", "Вологість у межах норми виробника", "Pasok sa limit ng gumawa ang halumigmig"),
        I(CK, R, "Flatness checked, highs and lows marked", "Planéité vérifiée, bosses et creux marqués", "Planitud revisada, altos y bajos marcados", "Planarità verificata, dossi e avvallamenti segnati", "Ebenheit geprüft, Hoch- und Tiefpunkte markiert", "Рівність перевірено, горби й западини позначено", "Nasuri ang pagkapatag, minarkahan ang mataas at mababa"),
        I(TX, O, "Subfloor repairs or levelling done", "Réparations ou nivelage du sous-plancher faits", "Reparaciones o nivelación hechas", "Riparazioni o livellamento eseguiti", "Ausbesserung oder Ausgleich erledigt", "Ремонт чи вирівнювання основи виконано", "Naayos o napantay ang subfloor"),
      ]),
      S(["Install", "Pose", "Instalación", "Posa", "Verlegung", "Укладання", "Pagkakabit"], [
        I(CK, R, "Material acclimatised on site", "Matériau acclimaté sur place", "Material aclimatado en obra", "Materiale acclimatato in cantiere", "Material vor Ort akklimatisiert", "Матеріал акліматизовано на місці", "Na-acclimate sa lugar ang materyal"),
        I(CK, R, "Expansion gap kept at walls and transitions", "Joint de dilatation conservé aux murs et seuils", "Junta de dilatación en muros y transiciones", "Giunto di dilatazione a muri e soglie", "Dehnungsfuge an Wänden und Übergängen", "Компенсаційний зазор біля стін і переходів", "May expansion gap sa pader at transition"),
        inspection(R, "Fastening or adhesive right for the subfloor", "Fixation ou colle adaptée au sous-plancher", "Fijación o adhesivo adecuados al contrapiso", "Fissaggio o colla adatti al sottofondo", "Befestigung oder Kleber passend zum Unterboden", "Кріплення чи клей відповідають основі", "Tama sa subfloor ang pako o pandikit"),
        I(CK, R, "Transitions and thresholds installed", "Moulures de transition et seuils posés", "Perfiles de transición y umbrales instalados", "Profili di raccordo e soglie posati", "Übergangsprofile und Schwellen montiert", "Перехідні профілі й пороги встановлено", "Naikabit ang transition at threshold"),
        inspection(R, "Spot check: gaps, lippage or hollow spots", "Vérification : joints, désaffleurement ou sons creux", "Revisión: juntas, desniveles o huecos", "Controllo: fughe, dislivelli o zone vuote", "Stichprobe: Fugen, Überstände oder Hohlstellen", "Перевірка: щілини, перепади чи порожнини", "Tsek: puwang, hindi pantay o guwang"),
      ]),
      finalSection(),
    ]),
];
