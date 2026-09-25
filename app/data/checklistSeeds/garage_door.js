// app/data/checklistSeeds/garage_door.js — see ./_build.js for the format.
// Every list ends on the safety tests a garage door can hurt someone without:
// balance, auto-reverse, photo-eyes, manual release.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";
import { T_PREP, T_WORK, T_TESTS, T_WRAP, scopeConfirmed, cleanedUp, walkThrough, clientHappy } from "./_common.js";

const GD = ["garage_door"];
const balance = () => I(SL, R, "Balance test: door stays put halfway open", "Essai d'équilibre : la porte tient à mi-course", "Prueba de balance: la puerta se queda a media altura", "Prova di bilanciamento: la porta resta a metà", "Balancetest: Tor bleibt auf halber Höhe", "Тест балансу: ворота тримаються на півдорозі", "Balance test: nananatili sa kalahati ang pinto");
const reverse = () => I(SL, R, "Auto-reverse on contact", "Inversion automatique au contact", "Reversa automática al contacto", "Inversione automatica al contatto", "Automatischer Rücklauf bei Kontakt", "Автореверс при контакті", "Auto-reverse kapag may tumama");
const eyes = () => I(SL, R, "Photo-eyes stop and reverse the door", "Cellules photo arrêtent et inversent la porte", "Fotoceldas detienen y revierten la puerta", "Fotocellule fermano e invertono la porta", "Lichtschranke stoppt und kehrt um", "Фотоелементи зупиняють і реверсують ворота", "Pinapahinto at binabaligtad ng photo-eye ang pinto");
const release = () => I(SL, R, "Manual release works", "Déverrouillage manuel fonctionnel", "Liberación manual funciona", "Sblocco manuale funzionante", "Notentriegelung funktioniert", "Ручне розблокування працює", "Gumagana ang manual release");
const secured = () => I(CK, R, "Door secured before work (clamps on the track)", "Porte immobilisée avant le travail (serre-joints sur le rail)", "Puerta asegurada antes de trabajar (prensas en el riel)", "Porta bloccata prima del lavoro (morsetti sul binario)", "Tor vor der Arbeit gesichert (Zwingen an der Schiene)", "Ворота зафіксовано перед роботою (струбцини на напрямній)", "Naka-secure ang pinto bago magtrabaho (clamp sa riles)");

export const CHECKLISTS = [
  C("fq.cl.garage_door.spring", { trades: GD },
    ["Spring repair and replacement", "Réparation et remplacement de ressorts", "Reparación y cambio de resortes", "Riparazione e sostituzione molle", "Federreparatur und -tausch", "Ремонт і заміна пружин", "Pagkumpuni at pagpalit ng spring"],
    [
      S(T_PREP, [
        secured(),
        I(TX, R, "Spring type, wind and wire size", "Type de ressort, sens d'enroulement et calibre", "Tipo de resorte, sentido y calibre", "Tipo di molla, senso di carica e diametro filo", "Federtyp, Wickelrichtung und Drahtstärke", "Тип пружини, напрям навивки й діаметр дроту", "Uri ng spring, ikot at kapal ng wire"),
        I(CK, R, "Proper winding bars used", "Barres de tension adéquates utilisées", "Barras de tensión correctas usadas", "Barre di carica corrette usate", "Richtige Spannstangen verwendet", "Використано правильні ключі для навивки", "Tamang winding bar ang ginamit"),
      ]),
      S(T_WORK, [
        I(CK, R, "Both torsion springs replaced as a pair", "Les deux ressorts remplacés en paire", "Ambos resortes cambiados en par", "Entrambe le molle sostituite in coppia", "Beide Torsionsfedern paarweise getauscht", "Обидві пружини замінено парою", "Pinalitan nang pares ang dalawang spring"),
        I(CK, O, "Springs, hinges and rollers lubricated", "Ressorts, charnières et galets lubrifiés", "Resortes, bisagras y rodillos lubricados", "Molle, cerniere e rulli lubrificati", "Federn, Scharniere und Rollen geschmiert", "Пружини, петлі й ролики змащено", "Nilagyan ng langis ang spring, bisagra at roller"),
        I(SL, R, "Spring tension set", "Tension des ressorts réglée", "Tensión del resorte ajustada", "Tensione della molla regolata", "Federspannung eingestellt", "Натяг пружини налаштовано", "Naitakda ang tension ng spring"),
        I(SL, R, "Cable drum set screws tight", "Vis des tambours de câble serrées", "Tornillos de los tambores apretados", "Grani dei tamburi serrati", "Madenschrauben der Seiltrommeln fest", "Гвинти барабанів тросів затягнуто", "Mahigpit ang set screw ng cable drum"),
      ]),
      S(T_TESTS, [balance(), reverse()]),
    ]),

  C("fq.cl.garage_door.opener", { trades: GD },
    ["Opener install and repair", "Installation et réparation d'ouvre-porte", "Instalación y reparación de abridor", "Installazione e riparazione motore", "Torantrieb: Einbau und Reparatur", "Монтаж і ремонт приводу", "Pagkakabit at ayos ng opener"],
    [
      S(T_WORK, [
        I(CK, R, "Opener power and drive suit the door", "Puissance et entraînement adaptés à la porte", "Potencia y transmisión adecuadas a la puerta", "Potenza e trasmissione adatte alla porta", "Antriebsleistung passt zum Tor", "Потужність і тип приводу відповідають воротам", "Tugma sa pinto ang lakas at drive ng opener"),
        I(CK, R, "Mounted to the bracket spec", "Fixé selon les supports prescrits", "Montado según las especificaciones del soporte", "Montato secondo le specifiche delle staffe", "Nach Halterungsvorgabe montiert", "Змонтовано за вимогами кронштейнів", "Naikabit ayon sa spec ng bracket"),
        I(CK, R, "Photo-eyes about 6 in off the floor", "Cellules photo à environ 15 cm du sol", "Fotoceldas a unos 15 cm del piso", "Fotocellule a circa 15 cm dal pavimento", "Lichtschranke ca. 15 cm über dem Boden", "Фотоелементи приблизно 15 см від підлоги", "Mga 6 na pulgada mula sahig ang photo-eye"),
        I(CK, R, "Remotes and keypad programmed", "Télécommandes et clavier programmés", "Controles y teclado programados", "Telecomandi e tastierino programmati", "Handsender und Codeschloss programmiert", "Пульти й клавіатуру запрограмовано", "Na-program ang remote at keypad"),
        I(CK, R, "Travel and force limits set", "Limites de course et de force réglées", "Límites de recorrido y fuerza ajustados", "Finecorsa e forza regolati", "Endlagen und Kraft eingestellt", "Межі ходу й зусилля налаштовано", "Naitakda ang travel at force limit"),
      ]),
      S(T_TESTS, [reverse(), eyes(), release()]),
      S(T_WRAP, [I(CK, O, "App and smart features shown to the client", "Appli et fonctions intelligentes montrées au client", "App y funciones inteligentes mostradas al cliente", "App e funzioni smart mostrate al cliente", "App und Smart-Funktionen gezeigt", "Застосунок і смарт-функції показано клієнту", "Naipakita ang app at smart feature")]),
    ]),

  C("fq.cl.garage_door.new_door", { trades: GD },
    ["New garage door install", "Pose de porte de garage neuve", "Instalación de puerta de garaje nueva", "Installazione di nuova porta da garage", "Neues Garagentor einbauen", "Монтаж нових гаражних воріт", "Pagkakabit ng bagong pinto ng garahe"],
    [
      S(T_PREP, [
        I(CK, R, "Opening measured, headroom and side room checked", "Ouverture mesurée, dégagements vérifiés", "Vano medido, holguras revisadas", "Vano misurato, spazi verificati", "Öffnung gemessen, Sturz und Seitenraum geprüft", "Проріз виміряно, запаси перевірено", "Nasukat ang butas at nasuri ang espasyo"),
        I(SL, R, "Framing square and level", "Cadre d'équerre et de niveau", "Marco a escuadra y nivelado", "Telaio in squadra e in bolla", "Zarge rechtwinklig und im Lot", "Рама рівна й під прямим кутом", "Pantay at naka-squared ang frame"),
      ]),
      S(T_WORK, [
        I(CK, R, "Tracks, hinges and rollers installed", "Rails, charnières et galets posés", "Rieles, bisagras y rodillos instalados", "Binari, cerniere e rulli installati", "Schienen, Scharniere und Rollen montiert", "Напрямні, петлі й ролики встановлено", "Naikabit ang riles, bisagra at roller"),
        I(CK, R, "Springs matched to the door weight", "Ressorts adaptés au poids de la porte", "Resortes según el peso de la puerta", "Molle adatte al peso della porta", "Federn passend zum Torgewicht", "Пружини підібрано під вагу воріт", "Tugma sa bigat ng pinto ang spring"),
        I(CK, R, "Weatherstrip and bottom seal fitted", "Coupe-froid et seuil posés", "Burletes y sello inferior colocados", "Guarnizioni e battuta inferiore montate", "Dichtungen und Bodendichtung montiert", "Ущільнювачі й нижню гумку встановлено", "Naikabit ang weatherstrip at bottom seal"),
        I(SL, R, "Track alignment", "Alignement des rails", "Alineación de rieles", "Allineamento dei binari", "Schienenausrichtung", "Вирівнювання напрямних", "Pagkakahanay ng riles"),
      ]),
      S(T_TESTS, [balance(), reverse()]),
    ]),

  C("fq.cl.garage_door.service_visit", { trades: GD, autoAddFor: ["garage_door"] },
    ["Garage door service visit", "Visite de service de porte de garage", "Visita de servicio de puerta de garaje", "Intervento sulla porta da garage", "Garagentor-Serviceeinsatz", "Сервісний виклик до гаражних воріт", "Serbisyo sa pinto ng garahe"],
    [
      S(T_PREP, [
        scopeConfirmed(),
        I(TX, O, "Door make, model and age", "Marque, modèle et âge de la porte", "Marca, modelo y edad de la puerta", "Marca, modello ed età della porta", "Hersteller, Modell und Alter", "Виробник, модель і вік воріт", "Tatak, model at edad ng pinto"),
        I(CK, R, "Springs and cables inspected", "Ressorts et câbles inspectés", "Resortes y cables inspeccionados", "Molle e cavi ispezionati", "Federn und Seile geprüft", "Пружини й троси оглянуто", "Nasuri ang spring at cable"),
        secured(),
      ]),
      S(T_WORK, [I(CK, R, "Work done to scope", "Travaux faits selon la portée", "Trabajo hecho según lo acordado", "Lavoro eseguito come concordato", "Arbeit wie vereinbart erledigt", "Роботу виконано за обсягом", "Tapos ayon sa saklaw")]),
      S(T_TESTS, [balance(), reverse()]),
      S(T_WRAP, [cleanedUp(), walkThrough(), clientHappy()]),
    ]),
];
