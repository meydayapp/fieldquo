// app/data/checklistSeeds/handyman.js — see ./_build.js for the format.
// Ten short lists, one per kind of handyman call.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";
import { T_WORK, T_TESTS, T_WRAP, scopeConfirmed, cleanedUp, walkThrough, clientHappy } from "./_common.js";

const HM = ["handyman", "property_maintenance"];
const partsPresent = () => I(CK, R, "All parts and hardware present", "Toutes les pièces et la quincaillerie présentes", "Todas las piezas y herrajes presentes", "Tutti i pezzi e la ferramenta presenti", "Alle Teile und Beschläge vorhanden", "Усі деталі й кріплення на місці", "Kumpleto ang piyesa at hardware");

export const CHECKLISTS = [
  C("fq.cl.handyman.service_visit", { trades: HM, autoAddFor: ["handyman", "property_maintenance"] },
    ["Handyman service visit", "Visite d'homme à tout faire", "Visita de mantenimiento general", "Intervento tuttofare", "Hausmeister-Einsatz", "Виклик майстра на всі руки", "Pagbisita ng handyman"],
    [
      S(T_WORK, [
        scopeConfirmed(),
        I(CK, R, "No electrical or gas hazards in the work area", "Aucun danger électrique ou gaz dans la zone", "Sin riesgos eléctricos ni de gas en la zona", "Nessun pericolo elettrico o gas nell'area", "Keine Elektro- oder Gasgefahr im Bereich", "Немає небезпеки від електрики чи газу", "Walang panganib sa kuryente o gas"),
        I(CK, R, "Work finished to the agreed scope", "Travaux faits selon la portée convenue", "Trabajo terminado según lo acordado", "Lavoro finito come concordato", "Arbeit wie vereinbart erledigt", "Роботу виконано за погодженим обсягом", "Tapos ayon sa napagkasunduan"),
      ]),
      S(T_WRAP, [cleanedUp(), walkThrough(), clientHappy()]),
    ]),

  C("fq.cl.handyman.punch_list", { trades: HM, phase: "post" },
    ["Punch list — several small jobs", "Liste de petits travaux", "Lista de trabajos pequeños", "Lista di piccoli lavori", "Liste kleiner Arbeiten", "Список дрібних робіт", "Listahan ng maliliit na trabaho"],
    [
      S(T_WORK, [
        I(CK, R, "List reviewed with the client", "Liste revue avec le client", "Lista revisada con el cliente", "Lista rivista con il cliente", "Liste mit dem Kunden durchgegangen", "Список переглянуто з клієнтом", "Nirebyu ang listahan kasama ang kliyente"),
        I(CK, R, "Each item done", "Chaque élément fait", "Cada punto hecho", "Ogni voce fatta", "Jeder Punkt erledigt", "Кожен пункт виконано", "Tapos ang bawat item"),
        I(TX, O, "Anything needing a return visit", "Ce qui demande un retour", "Lo que requiere otra visita", "Cosa richiede un ritorno", "Was einen weiteren Termin braucht", "Що потребує повторного візиту", "Kailangang balikan"),
        I(CK, R, "Client confirmed everything is done", "Client a confirmé que tout est fait", "Cliente confirmó que todo está hecho", "Cliente ha confermato che è tutto fatto", "Kunde hat Erledigung bestätigt", "Клієнт підтвердив виконання", "Kinumpirma ng kliyente na tapos lahat"),
      ]),
    ]),

  C("fq.cl.handyman.drywall_paint", { trades: [...HM, "drywall"] },
    ["Drywall and paint repair", "Réparation de gypse et peinture", "Reparación de tablaroca y pintura", "Riparazione cartongesso e pittura", "Trockenbau- und Malerausbesserung", "Ремонт гіпсокартону й фарбування", "Ayos ng drywall at pintura"],
    [
      S(T_WORK, [
        I(TX, R, "Damage and its cause", "Dommage et sa cause", "Daño y su causa", "Danno e sua causa", "Schaden und Ursache", "Пошкодження та його причина", "Sira at sanhi nito"),
        I(TX, O, "How the paint was matched", "Comment la peinture a été appariée", "Cómo se igualó la pintura", "Come è stato abbinato il colore", "Wie die Farbe abgestimmt wurde", "Як підібрано фарбу", "Paano itinugma ang pintura"),
        I(CK, R, "Cut out and patched", "Découpé et rapiécé", "Cortado y parchado", "Tagliato e rattoppato", "Ausgeschnitten und geflickt", "Вирізано й закладено латку", "Hiniwa at tinapalan"),
        I(CK, R, "Sanded and feathered", "Poncé et adouci", "Lijado y difuminado", "Carteggiato e sfumato", "Geschliffen und beigeschliffen", "Відшліфовано з плавним переходом", "Nailiha at pinakinis ang gilid"),
        I(CK, R, "Primed and painted", "Apprêté et peint", "Imprimado y pintado", "Primer e pittura", "Grundiert und gestrichen", "Заґрунтовано й пофарбовано", "Nilagyan ng primer at pintura"),
        I(SL, R, "Invisible under raking light", "Invisible sous éclairage rasant", "Invisible con luz rasante", "Invisibile con luce radente", "Unsichtbar im Streiflicht", "Непомітно при бічному світлі", "Hindi makita sa pahilis na ilaw"),
      ]),
    ]),

  C("fq.cl.handyman.cabinet_shelf", { trades: [...HM, "installation_services"] },
    ["Cabinet and shelf install", "Pose d'armoires et tablettes", "Instalación de gabinetes y repisas", "Montaggio di pensili e mensole", "Montage von Schränken und Regalen", "Монтаж шаф і полиць", "Pagkakabit ng cabinet at istante"],
    [
      S(T_WORK, [
        partsPresent(),
        I(CK, R, "Studs found and wall checked", "Montants repérés et mur vérifié", "Montantes ubicados y muro revisado", "Montanti trovati e muro verificato", "Ständer gefunden und Wand geprüft", "Стійки знайдено, стіну перевірено", "Natukoy ang stud at nasuri ang pader"),
        I(CK, R, "Height and layout agreed with the client", "Hauteur et disposition convenues avec le client", "Altura y distribución acordadas con el cliente", "Altezza e disposizione concordate", "Höhe und Anordnung mit Kunde abgestimmt", "Висоту й розташування погоджено", "Napagkasunduan ang taas at ayos"),
        I(CK, R, "Mounted and secured", "Fixé solidement", "Montado y asegurado", "Montato e fissato", "Montiert und gesichert", "Змонтовано й закріплено", "Naikabit at matibay"),
      ]),
      S(T_TESTS, [
        I(SL, R, "Level", "De niveau", "Nivelado", "In bolla", "Waagerecht", "Рівно", "Pantay"),
        I(SL, R, "Holds weight, no movement", "Supporte la charge sans bouger", "Aguanta peso sin moverse", "Regge il peso senza muoversi", "Trägt Last ohne Bewegung", "Тримає вагу, не хитається", "Kaya ang bigat, hindi gumagalaw"),
        cleanedUp(),
      ]),
    ]),

  C("fq.cl.handyman.assembly", { trades: HM },
    ["Furniture and fixture assembly", "Assemblage de meubles et d'accessoires", "Armado de muebles y accesorios", "Montaggio di mobili e accessori", "Möbel- und Leuchtenmontage", "Складання меблів і світильників", "Pag-assemble ng muwebles at fixture"],
    [
      S(T_WORK, [
        partsPresent(),
        I(TX, O, "Wall or floor it is fixed to", "Mur ou plancher de fixation", "Muro o piso donde se fija", "Muro o pavimento di fissaggio", "Wand oder Boden der Befestigung", "Стіна чи підлога для кріплення", "Pader o sahig na pagkakabitan"),
        I(CK, R, "Assembled to the instructions", "Assemblé selon les instructions", "Armado según las instrucciones", "Montato secondo le istruzioni", "Nach Anleitung montiert", "Зібрано за інструкцією", "Na-assemble ayon sa instruksiyon"),
        I(SL, R, "Stable, tip-over restraint fitted where needed", "Stable, anti-basculement posé au besoin", "Estable, con anclaje antivuelco si hace falta", "Stabile, con fissaggio antiribaltamento se serve", "Standfest, Kippsicherung wo nötig", "Стійко, захист від перекидання де потрібно", "Matatag, may anti-tip kung kailangan"),
        I(CK, O, "Packaging taken away", "Emballage emporté", "Empaques retirados", "Imballaggi portati via", "Verpackung mitgenommen", "Упаковку вивезено", "Inalis ang balot"),
      ]),
    ]),

  C("fq.cl.handyman.gutters", { trades: [...HM, "gutter_services"], autoAddFor: ["gutter_services"] },
    ["Gutter and exterior maintenance", "Entretien des gouttières et de l'extérieur", "Mantenimiento de canaletas y exterior", "Manutenzione grondaie ed esterni", "Dachrinnen- und Außenwartung", "Обслуговування ринв і фасаду", "Maintenance ng alulod at labas"],
    [
      S(T_WORK, [
        I(CK, R, "Gutters, downspouts and fascia inspected", "Gouttières, descentes et bordures inspectées", "Canaletas, bajantes y fascia inspeccionadas", "Grondaie, pluviali e frontalini ispezionati", "Rinnen, Fallrohre und Traufbrett geprüft", "Ринви, водостоки й лобову дошку оглянуто", "Nasuri ang alulod, downspout at fascia"),
        I(SL, R, "Slope and drainage", "Pente et écoulement", "Pendiente y desagüe", "Pendenza e scarico", "Gefälle und Ablauf", "Ухил і відведення води", "Dalisdis at daloy ng tubig"),
        I(CK, R, "Debris cleared and downspouts flushed", "Débris enlevés et descentes rincées", "Basura retirada y bajantes lavadas", "Detriti rimossi e pluviali lavati", "Laub entfernt und Fallrohre gespült", "Сміття прибрано, водостоки промито", "Nalinis ang kalat at downspout"),
        I(CK, O, "Loose sections resealed or refastened", "Sections lâches rescellées ou refixées", "Tramos sueltos resellados o fijados", "Tratti allentati risigillati o fissati", "Lose Teile neu abgedichtet oder befestigt", "Хиткі секції загерметизовано чи закріплено", "Naselyo o naikabit muli ang maluwag"),
        I(SL, R, "Water test: flows to the downspouts", "Essai d'eau : l'eau va aux descentes", "Prueba de agua: fluye a las bajantes", "Prova dell'acqua: scorre ai pluviali", "Wassertest: fließt zu den Fallrohren", "Перевірка водою: стікає у водостоки", "Pagsubok ng tubig: dumadaloy sa downspout"),
      ]),
    ]),

  C("fq.cl.handyman.tile_grout", { trades: [...HM, "tiling"] },
    ["Tile and grout repair", "Réparation de carreaux et coulis", "Reparación de azulejo y lechada", "Riparazione piastrelle e fughe", "Fliesen- und Fugenreparatur", "Ремонт плитки й затирки", "Ayos ng tile at grout"],
    [
      S(T_WORK, [
        I(TX, R, "Damage found", "Dommage constaté", "Daño encontrado", "Danno rilevato", "Festgestellter Schaden", "Виявлене пошкодження", "Nakitang sira"),
        I(CK, R, "Damaged tile or grout removed", "Carreaux ou coulis abîmés retirés", "Azulejo o lechada dañados retirados", "Piastrelle o fughe danneggiate rimosse", "Beschädigte Fliesen oder Fugen entfernt", "Пошкоджену плитку чи затирку видалено", "Tinanggal ang sirang tile o grout"),
        I(CK, R, "Replaced or regrouted to match", "Remplacé ou rejointoyé assorti", "Reemplazado o relechado igualando", "Sostituito o stuccato abbinando", "Passend ersetzt oder neu verfugt", "Замінено чи перезатерто в тон", "Pinalitan o ni-regrout nang tugma"),
        I(CK, O, "Cure time told to the client", "Temps de cure indiqué au client", "Tiempo de curado indicado al cliente", "Tempo di indurimento comunicato", "Aushärtezeit dem Kunden gesagt", "Клієнту повідомлено час затвердіння", "Sinabi sa kliyente ang tagal ng pagtuyo"),
        I(SL, R, "Flush and even", "Affleurant et uniforme", "Al ras y parejo", "A filo e uniforme", "Bündig und eben", "Урівень і рівномірно", "Kapantay at pantay"),
      ]),
    ]),

  C("fq.cl.handyman.flooring_repair", { trades: [...HM, "flooring"] },
    ["Floor repair", "Réparation de plancher", "Reparación de piso", "Riparazione del pavimento", "Bodenreparatur", "Ремонт підлоги", "Ayos ng sahig"],
    [
      S(T_WORK, [
        I(TX, R, "Flooring type and repair needed", "Type de plancher et réparation requise", "Tipo de piso y reparación necesaria", "Tipo di pavimento e riparazione", "Bodenart und nötige Reparatur", "Тип підлоги й потрібний ремонт", "Uri ng sahig at kailangang ayos"),
        I(SL, R, "Subfloor rot, dips or moisture", "Pourriture, creux ou humidité du sous-plancher", "Podredumbre, hundimientos o humedad", "Marciume, avvallamenti o umidità del sottofondo", "Fäulnis, Mulden oder Feuchte im Unterboden", "Гниль, просідання чи волога основи", "Bulok, lubog o basa sa subfloor"),
        I(CK, R, "Damaged boards removed", "Planches abîmées retirées", "Tablas dañadas retiradas", "Doghe danneggiate rimosse", "Beschädigte Dielen entfernt", "Пошкоджені дошки знято", "Tinanggal ang sirang tabla"),
        I(CK, O, "Subfloor repaired where found", "Sous-plancher réparé au besoin", "Contrapiso reparado donde hacía falta", "Sottofondo riparato dove serve", "Unterboden wo nötig repariert", "Основу відремонтовано де потрібно", "Naayos ang subfloor kung kailangan"),
        I(CK, R, "Matching replacement installed", "Remplacement assorti posé", "Reemplazo igual instalado", "Sostituzione abbinata posata", "Passender Ersatz verlegt", "Встановлено підібрану заміну", "Naikabit ang katugmang kapalit"),
        I(SL, R, "Flush and matches the floor around it", "Affleurant et assorti au reste", "Al ras e igual al resto", "A filo e uguale al resto", "Bündig und passend zum Rest", "Урівень і в тон решті", "Kapantay at tugma sa paligid"),
      ]),
    ]),

  C("fq.cl.handyman.door_window", { trades: [...HM, "doors_windows", "locksmith"] },
    ["Door and window repair", "Réparation de porte et fenêtre", "Reparación de puerta y ventana", "Riparazione di porte e finestre", "Tür- und Fensterreparatur", "Ремонт дверей і вікон", "Ayos ng pinto at bintana"],
    [
      S(T_WORK, [
        I(TX, R, "Problem found", "Problème constaté", "Problema encontrado", "Problema rilevato", "Festgestelltes Problem", "Виявлена проблема", "Nakitang problema"),
        I(CK, R, "Repaired to the diagnosis", "Réparé selon le diagnostic", "Reparado según el diagnóstico", "Riparato secondo la diagnosi", "Nach Befund repariert", "Відремонтовано за діагнозом", "Naayos ayon sa diyagnosis"),
        I(CK, O, "Broken glass handled and bagged safely", "Verre brisé manipulé et emballé sans danger", "Vidrio roto manejado y embolsado con cuidado", "Vetro rotto gestito e insacchettato in sicurezza", "Glasbruch sicher entsorgt", "Бите скло безпечно зібрано", "Ligtas na nailigpit ang basag na salamin"),
        I(SL, R, "Opens, closes and locks properly", "S'ouvre, se ferme et se verrouille bien", "Abre, cierra y asegura bien", "Si apre, chiude e blocca bene", "Öffnet, schließt und verriegelt richtig", "Відчиняється, зачиняється й замикається", "Maayos magbukas, magsara at mag-lock"),
      ]),
    ]),

  C("fq.cl.handyman.deck_fence", { trades: [...HM, "fence_repair", "fence_services", "deck_patio"], autoAddFor: ["fence_repair"] },
    ["Deck and fence repair", "Réparation de terrasse et clôture", "Reparación de terraza y cerca", "Riparazione di terrazza e recinzione", "Terrassen- und Zaunreparatur", "Ремонт тераси й паркану", "Ayos ng deck at bakod"],
    [
      S(["Inspection", "Inspection", "Inspección", "Ispezione", "Prüfung", "Огляд", "Inspeksiyon"], [
        I(SL, R, "Ledger attachment and flashing", "Fixation et solin de la lambourde", "Fijación y tapajuntas de la viga de amarre", "Fissaggio e scossalina della trave", "Wandbalken-Befestigung und Blech", "Кріплення й відлив опорного бруса", "Kabit at flashing ng ledger"),
        I(CK, R, "Rot, insects and rusted fasteners checked", "Pourriture, insectes et attaches rouillées vérifiés", "Podredumbre, insectos y tornillos oxidados revisados", "Marciume, insetti e viti arrugginite verificati", "Fäulnis, Insekten und Rost geprüft", "Гниль, комах та іржаве кріплення перевірено", "Nasuri ang bulok, insekto at kalawang"),
        I(SL, R, "Posts and footings stable", "Poteaux et semelles stables", "Postes y zapatas estables", "Pali e plinti stabili", "Pfosten und Fundamente stabil", "Стовпи й опори стійкі", "Matatag ang poste at footing"),
      ]),
      S(T_WORK, [
        I(CK, R, "Boards or pickets replaced", "Planches ou lattes remplacées", "Tablas o piquetes reemplazados", "Assi o stecche sostituite", "Dielen oder Latten ersetzt", "Дошки чи штакетник замінено", "Pinalitan ang tabla o picket"),
        I(CK, R, "Fasteners resecured", "Attaches refixées", "Tornillería reapretada", "Fissaggi ripristinati", "Befestigungen nachgezogen", "Кріплення підтягнуто", "Hinigpitan ang mga pako"),
        I(CK, O, "Sealer or stain applied", "Scellant ou teinture appliqué", "Sellador o tinte aplicado", "Impregnante o mordente applicato", "Versiegelung oder Lasur aufgetragen", "Нанесено просочення чи морилку", "Nilagyan ng sealer o stain"),
        I(SL, R, "Stable, level and safe", "Stable, de niveau et sûr", "Estable, nivelado y seguro", "Stabile, in bolla e sicuro", "Stabil, eben und sicher", "Стійко, рівно й безпечно", "Matatag, pantay at ligtas"),
      ]),
    ]),
];
