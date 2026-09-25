// app/data/checklistSeeds/general_contracting.js — see ./_build.js for the format.
// One list per kind of remodel, the way a GC's estimate types split the work.
import { C, S, I, CK, TX, SL, R, O } from "./_build.js";
import { permitsSection, finalSection, inspection, clientSignature, walkThrough } from "./_common.js";

const GC = ["general_contracting", "general_contracting_reno", "remodeling", "construction"];

const shutoff = () => I(CK, R, "Water, gas and power shut off before demolition", "Eau, gaz et électricité coupés avant la démolition", "Agua, gas y luz cortados antes de demoler", "Acqua, gas e corrente chiusi prima della demolizione", "Wasser, Gas und Strom vor dem Abbruch abgestellt", "Воду, газ і світло вимкнено перед демонтажем", "Pinatay ang tubig, gas at kuryente bago gibain");
const demoDone = () => I(CK, R, "Demolition done to plan", "Démolition faite selon le plan", "Demolición hecha según el plano", "Demolizione eseguita come da progetto", "Abbruch nach Plan erledigt", "Демонтаж виконано за планом", "Tapos ang paggiba ayon sa plano");
const roughElec = () => inspection(R, "Rough electrical inspection", "Inspection de l'électricité brute", "Inspección eléctrica de obra gruesa", "Collaudo impianto elettrico grezzo", "Rohinstallation Elektro abgenommen", "Перевірка чорнової електрики", "Inspeksiyon ng rough electrical");
const roughPlumb = () => inspection(R, "Rough plumbing inspection", "Inspection de la plomberie brute", "Inspección de plomería de obra gruesa", "Collaudo impianto idraulico grezzo", "Rohinstallation Sanitär abgenommen", "Перевірка чорнової сантехніки", "Inspeksiyon ng rough plumbing");
const finalInsp = () => inspection(R, "Final building inspection", "Inspection finale du bâtiment", "Inspección final de obra", "Collaudo finale", "Bauabnahme", "Фінальна будівельна перевірка", "Huling inspeksiyon ng gusali");
const T_DEMO = ["Demolition and rough-in", "Démolition et plomberie/électricité brutes", "Demolición e instalaciones", "Demolizione e impianti grezzi", "Abbruch und Rohinstallation", "Демонтаж і чорнові роботи", "Paggiba at rough-in"];

export const CHECKLISTS = [
  C("fq.cl.general_contracting.preconstruction", { trades: GC, autoAddFor: ["general_contracting", "general_contracting_reno", "remodeling"], phase: "pre" },
    ["Pre-construction and permits", "Avant-chantier et permis", "Preconstrucción y permisos", "Pre-cantiere e permessi", "Bauvorbereitung und Genehmigungen", "Підготовка до будівництва й дозволи", "Bago magtayo at mga permit"],
    [
      S(["Permits and approvals", "Permis et approbations", "Permisos y aprobaciones", "Permessi e approvazioni", "Genehmigungen und Freigaben", "Дозволи й погодження", "Mga permit at pag-apruba"], [
        I(CK, R, "Permit requirements checked with the city", "Exigences de permis vérifiées auprès de la ville", "Requisitos de permiso consultados con el municipio", "Requisiti di permesso verificati con il comune", "Genehmigungspflicht bei der Behörde geprüft", "Вимоги до дозволу уточнено в міськраді", "Nasuri sa munisipyo ang kailangang permit"),
        I(TX, R, "Permit numbers", "Numéros de permis", "Números de permiso", "Numeri di permesso", "Genehmigungsnummern", "Номери дозволів", "Mga numero ng permit"),
        I(TX, R, "HOA or design review status", "État de l'approbation du syndicat ou d'architecture", "Estado de la revisión de la asociación", "Stato dell'approvazione condominiale", "Stand der Eigentümer- oder Gestaltungsfreigabe", "Стан погодження ОСББ чи архітектури", "Estado ng pag-apruba ng HOA"),
      ]),
      S(["Site readiness", "Préparation du chantier", "Preparación de la obra", "Preparazione del cantiere", "Baustellenvorbereitung", "Готовність майданчика", "Kahandaan ng lugar"], [
        I(CK, R, "Underground utilities located before digging", "Services souterrains localisés avant de creuser", "Servicios subterráneos localizados antes de excavar", "Sottoservizi individuati prima di scavare", "Erdleitungen vor dem Graben geortet", "Підземні мережі визначено перед копанням", "Natukoy ang mga linya sa ilalim bago maghukay"),
        I(CK, R, "Access, parking and staging agreed", "Accès, stationnement et entreposage convenus", "Acceso, estacionamiento y acopio acordados", "Accesso, parcheggio e stoccaggio concordati", "Zugang, Parken und Lagerfläche vereinbart", "Доступ, паркування й складування погоджено", "Napagkasunduan ang daanan, paradahan at lagayan"),
      ]),
      S(["Client agreement", "Entente avec le client", "Acuerdo con el cliente", "Accordo con il cliente", "Vereinbarung mit dem Kunden", "Домовленість із клієнтом", "Kasunduan sa kliyente"], [
        I(CK, R, "Signed contract and scope on file", "Contrat et portée signés au dossier", "Contrato y alcance firmados archivados", "Contratto e lavori firmati in archivio", "Unterschriebener Vertrag und Umfang abgelegt", "Підписаний договір і обсяг робіт є в справі", "Nakatala ang pirmadong kontrata at saklaw"),
        I(CK, R, "Payment schedule reviewed with the client", "Échéancier de paiement revu avec le client", "Calendario de pagos revisado con el cliente", "Piano dei pagamenti rivisto con il cliente", "Zahlungsplan mit dem Kunden besprochen", "Графік оплат обговорено з клієнтом", "Nirebyu ang iskedyul ng bayad sa kliyente"),
        I(TX, O, "Allowances and finish selections", "Allocations et choix de finis", "Asignaciones y selección de acabados", "Budget e scelte delle finiture", "Budgetposten und Materialauswahl", "Бюджетні позиції та вибір оздоблення", "Allowance at mga napiling finish"),
      ]),
    ]),

  C("fq.cl.general_contracting.bathroom", { trades: GC },
    ["Bathroom remodel", "Rénovation de salle de bain", "Remodelación de baño", "Ristrutturazione del bagno", "Badsanierung", "Ремонт ванної кімнати", "Remodel ng banyo"],
    [
      permitsSection(),
      S(["Demolition and waterproofing", "Démolition et imperméabilisation", "Demolición e impermeabilización", "Demolizione e impermeabilizzazione", "Abbruch und Abdichtung", "Демонтаж і гідроізоляція", "Paggiba at waterproofing"], [
        shutoff(), demoDone(),
        inspection(R, "Waterproof membrane checked before tile", "Membrane d'étanchéité vérifiée avant la céramique", "Membrana impermeable revisada antes del azulejo", "Membrana impermeabile verificata prima delle piastrelle", "Abdichtung vor dem Fliesen geprüft", "Гідроізоляцію перевірено перед плиткою", "Nasuri ang waterproof membrane bago mag-tile"),
        roughPlumb(),
      ]),
      S(["Fixtures and tile", "Appareils et céramique", "Muebles y azulejo", "Sanitari e piastrelle", "Sanitärobjekte und Fliesen", "Сантехніка й плитка", "Mga fixture at tile"], [
        I(CK, R, "Tile layout matches the approved plan", "Calepinage conforme au plan approuvé", "Distribución del azulejo según el plano aprobado", "Posa delle piastrelle come da progetto", "Fliesenplan entspricht der Freigabe", "Розкладка плитки відповідає погодженому плану", "Tugma sa plano ang ayos ng tile"),
        I(CK, R, "Vanity, tub or shower and fixtures installed", "Meuble-lavabo, bain ou douche et appareils installés", "Mueble, tina o ducha y griferías instalados", "Mobile, vasca o doccia e sanitari installati", "Waschtisch, Wanne oder Dusche und Armaturen montiert", "Тумбу, ванну чи душ і сантехніку встановлено", "Naikabit ang vanity, tub o shower at fixtures"),
        inspection(R, "Every fixture water-tested for leaks", "Chaque appareil testé contre les fuites", "Cada grifo probado contra fugas", "Ogni sanitario provato contro le perdite", "Jede Armatur auf Dichtheit geprüft", "Кожен прилад перевірено на протікання", "Sinubok sa tagas ang bawat fixture"),
      ]),
      finalSection(),
    ]),

  C("fq.cl.general_contracting.kitchen", { trades: [...GC, "kitchen_design"], autoAddFor: ["kitchen_design"] },
    ["Kitchen remodel", "Rénovation de cuisine", "Remodelación de cocina", "Ristrutturazione della cucina", "Küchenumbau", "Ремонт кухні", "Remodel ng kusina"],
    [
      permitsSection(),
      S(T_DEMO, [shutoff(), demoDone(), roughElec(), roughPlumb()]),
      S(["Cabinets and finish", "Armoires et finition", "Gabinetes y acabados", "Mobili e finiture", "Schränke und Ausbau", "Шафи й оздоблення", "Cabinet at finish"], [
        I(CK, R, "Cabinet layout matches the approved plan", "Disposition des armoires conforme au plan", "Distribución de gabinetes según el plano", "Disposizione dei mobili come da progetto", "Schrankplanung entspricht der Freigabe", "Розташування шаф відповідає плану", "Tugma sa plano ang ayos ng cabinet"),
        I(CK, R, "Countertop templated", "Gabarit du comptoir pris", "Plantilla de encimera tomada", "Dima del piano di lavoro presa", "Arbeitsplatte aufgemessen", "Шаблон стільниці знято", "Nasukat na ang countertop"),
        I(CK, R, "Appliance openings and hook-ups checked", "Ouvertures et raccords des électroménagers vérifiés", "Huecos y conexiones de electrodomésticos revisados", "Vani e allacci degli elettrodomestici verificati", "Geräteausschnitte und Anschlüsse geprüft", "Ніші й підключення техніки перевірено", "Nasuri ang puwang at koneksyon ng appliances"),
        I(SL, O, "Backsplash and finish quality", "Qualité du dosseret et des finitions", "Calidad del salpicadero y acabados", "Qualità del paraschizzi e delle finiture", "Qualität von Fliesenspiegel und Ausbau", "Якість фартуха й оздоблення", "Kalidad ng backsplash at finish"),
      ]),
      finalSection(),
    ]),

  C("fq.cl.general_contracting.basement", { trades: GC },
    ["Basement finishing", "Finition de sous-sol", "Acabado de sótano", "Finitura del seminterrato", "Kellerausbau", "Облаштування підвалу", "Pagtatapos ng basement"],
    [
      permitsSection(),
      S(["Moisture and structure", "Humidité et structure", "Humedad y estructura", "Umidità e struttura", "Feuchte und Tragwerk", "Волога й конструкція", "Halumigmig at istruktura"], [
        inspection(R, "Slab and walls moisture-tested before framing", "Dalle et murs testés pour l'humidité avant l'ossature", "Losa y muros probados por humedad antes del armazón", "Soletta e muri testati per l'umidità prima dell'orditura", "Bodenplatte und Wände vor dem Ständerwerk auf Feuchte geprüft", "Плиту й стіни перевірено на вологу перед каркасом", "Sinubok sa halumigmig ang sahig at pader bago mag-frame"),
        I(CK, R, "Sump pump and drainage working", "Pompe de puisard et drainage fonctionnels", "Bomba de sumidero y drenaje funcionando", "Pompa di drenaggio funzionante", "Pumpensumpf und Entwässerung funktionieren", "Дренажний насос і дренаж працюють", "Gumagana ang sump pump at drainage"),
        I(CK, R, "Treated bottom plate against concrete", "Lisse basse traitée contre le béton", "Solera tratada contra el concreto", "Traversa inferiore trattata contro il cemento", "Imprägnierte Schwelle am Beton", "Нижня обв'язка з обробленої деревини на бетоні", "Treated na bottom plate sa semento"),
      ]),
      S(["Framing and rough-in", "Ossature et installations brutes", "Armazón e instalaciones", "Orditura e impianti grezzi", "Ständerwerk und Rohinstallation", "Каркас і чорнові роботи", "Framing at rough-in"], [
        I(CK, R, "Egress window meets code for any bedroom", "Fenêtre d'évacuation conforme pour toute chambre", "Ventana de escape reglamentaria en cada dormitorio", "Finestra di fuga a norma per ogni camera", "Rettungsfenster normgerecht für jedes Schlafzimmer", "Евакуаційне вікно за нормами для кожної спальні", "Pasado sa code ang egress window ng kuwarto"),
        I(CK, R, "Ceiling height meets code", "Hauteur sous plafond conforme", "Altura de techo reglamentaria", "Altezza del soffitto a norma", "Deckenhöhe normgerecht", "Висота стелі відповідає нормам", "Pasado sa code ang taas ng kisame"),
        roughElec(),
        I(SL, O, "Radon vent routed and sealed, if present", "Évent de radon acheminé et scellé, s'il y en a un", "Ventilación de radón instalada y sellada, si existe", "Sfiato radon posato e sigillato, se presente", "Radonentlüftung verlegt und abgedichtet, falls vorhanden", "Радонову витяжку прокладено й загерметизовано, якщо є", "Naikabit at selyado ang radon vent, kung mayroon"),
      ]),
      S(["Finish and code", "Finition et code", "Acabado y código", "Finiture e norme", "Ausbau und Vorschriften", "Оздоблення й норми", "Finish at code"], [
        I(CK, R, "Drywall and finishes installed to plan", "Gypse et finitions posés selon le plan", "Tablaroca y acabados instalados según plano", "Cartongesso e finiture posati come da progetto", "Trockenbau und Ausbau nach Plan", "Гіпсокартон і оздоблення виконано за планом", "Naikabit ayon sa plano ang drywall at finish"),
        inspection(R, "Fixtures and outlets tested", "Appareils et prises testés", "Aparatos y enchufes probados", "Apparecchi e prese provati", "Geräte und Steckdosen geprüft", "Прилади й розетки перевірено", "Nasubok ang fixtures at saksakan"),
        finalInsp(),
      ]),
      finalSection(),
    ]),

  C("fq.cl.general_contracting.deck_patio", { trades: [...GC, "deck_patio"], autoAddFor: ["deck_patio"] },
    ["Deck and patio build", "Construction de terrasse et patio", "Construcción de terraza y patio", "Costruzione di terrazza e patio", "Terrassen- und Patiobau", "Будівництво тераси й патіо", "Pagtatayo ng deck at patio"],
    [
      permitsSection(),
      S(["Footings and framing", "Semelles et ossature", "Zapatas y estructura", "Plinti e struttura", "Fundamente und Unterkonstruktion", "Фундаменти й каркас", "Footing at framing"], [
        I(CK, R, "Footings below the frost line", "Semelles sous la ligne de gel", "Zapatas bajo la línea de congelación", "Plinti sotto la linea del gelo", "Fundamente unter der Frostgrenze", "Фундамент нижче глибини промерзання", "Nasa ilalim ng frost line ang footing"),
        inspection(R, "Footing inspection", "Inspection des semelles", "Inspección de zapatas", "Collaudo dei plinti", "Fundamentabnahme", "Перевірка фундаменту", "Inspeksiyon ng footing"),
        I(CK, R, "Beams and joists sized to the span table", "Poutres et solives selon la table de portées", "Vigas y viguetas según tabla de claros", "Travi e travetti secondo la tabella delle luci", "Träger und Balken nach Spannweitentabelle", "Балки й лаги за таблицею прольотів", "Tama sa span table ang beam at joist"),
        inspection(R, "Ledger flashed where it meets the house", "Lambourde solinée contre la maison", "Viga de amarre con tapajuntas en la casa", "Trave di appoggio con scossalina sulla casa", "Wandbalken am Haus eingeblecht", "Опорний брус біля будинку захищено відливом", "May flashing ang ledger sa bahay"),
        I(CK, R, "Fasteners and hangers rated for treated lumber", "Attaches et étriers pour bois traité", "Tornillería y estribos para madera tratada", "Viteria e staffe per legno trattato", "Verbinder und Balkenschuhe für imprägniertes Holz", "Кріплення для обробленої деревини", "Pang-treated na lumber ang pako at hanger"),
        inspection(R, "Framing inspection", "Inspection de l'ossature", "Inspección de estructura", "Collaudo della struttura", "Abnahme der Unterkonstruktion", "Перевірка каркаса", "Inspeksiyon ng framing"),
      ]),
      S(["Patio base", "Fondation du patio", "Base del patio", "Sottofondo del patio", "Patio-Unterbau", "Основа патіо", "Base ng patio"], [
        I(CK, R, "Base depth and compaction checked", "Épaisseur et compaction de la fondation vérifiées", "Espesor y compactación de la base revisados", "Spessore e compattazione del sottofondo verificati", "Tragschichtstärke und Verdichtung geprüft", "Товщину й ущільнення основи перевірено", "Nasuri ang lalim at siksik ng base"),
        I(CK, R, "Slope drains away from the house", "Pente éloignant l'eau de la maison", "Pendiente que aleja el agua de la casa", "Pendenza che allontana l'acqua dalla casa", "Gefälle vom Haus weg", "Ухил відводить воду від будинку", "Palayo sa bahay ang dalisdis ng tubig"),
      ]),
      S(["Railings and code", "Garde-corps et code", "Barandales y código", "Parapetti e norme", "Geländer und Vorschriften", "Поручні й норми", "Railing at code"], [
        I(CK, R, "Guard height meets code", "Hauteur du garde-corps conforme", "Altura del barandal reglamentaria", "Altezza del parapetto a norma", "Geländerhöhe normgerecht", "Висота огорожі за нормами", "Pasado sa code ang taas ng guard"),
        I(CK, R, "Baluster gaps under 4 in", "Espacement des barreaux sous 4 po", "Separación de balaustres menor de 4 pulg", "Spazio tra i montanti sotto 10 cm", "Stababstand unter 10 cm", "Проміжки між балясинами менше 10 см", "Wala pang 4 na pulgada ang pagitan ng baluster"),
        I(CK, R, "Stair rise, run and handrail meet code", "Hauteur, giron et main courante conformes", "Contrahuella, huella y pasamanos reglamentarios", "Alzata, pedata e corrimano a norma", "Steigung, Auftritt und Handlauf normgerecht", "Висота, ширина сходинок і поруччя за нормами", "Pasado sa code ang baitang at hawakan"),
        finalInsp(),
      ]),
      S(["Handover", "Remise", "Entrega", "Consegna", "Übergabe", "Передача", "Pagbibigay"], [walkThrough(), clientSignature()]),
    ]),

  C("fq.cl.general_contracting.siding_windows", { trades: [...GC, "siding", "doors_windows"], autoAddFor: ["siding", "doors_windows"] },
    ["Siding and window replacement", "Remplacement de revêtement et fenêtres", "Cambio de revestimiento y ventanas", "Sostituzione di rivestimento e finestre", "Fassaden- und Fenstertausch", "Заміна обшивки й вікон", "Pagpapalit ng siding at bintana"],
    [
      permitsSection(),
      S(["Weather barrier", "Pare-intempéries", "Barrera climática", "Barriera all'acqua", "Wetterschutz", "Вітрозахист", "Harang sa panahon"], [
        inspection(R, "House wrap checked before siding", "Pare-air vérifié avant le revêtement", "Envoltura revisada antes del revestimiento", "Telo traspirante verificato prima del rivestimento", "Fassadenbahn vor der Verkleidung geprüft", "Вітрозахисну мембрану перевірено перед обшивкою", "Nasuri ang house wrap bago ang siding"),
        inspection(R, "Window and door flashing tied into the barrier", "Solins de fenêtres et portes raccordés au pare-air", "Tapajuntas de ventanas y puertas unidos a la barrera", "Scossaline di finestre e porte raccordate alla barriera", "Fenster- und Türanschlüsse in die Bahn eingebunden", "Відливи вікон і дверей з'єднано з мембраною", "Nakakabit sa harang ang flashing ng bintana at pinto"),
      ]),
      S(["Siding", "Revêtement", "Revestimiento", "Rivestimento", "Verkleidung", "Обшивка", "Siding"], [
        I(CK, R, "Starter strip and J-channel level and square", "Bande de départ et moulure en J de niveau et d'équerre", "Tira inicial y canal J nivelados", "Profilo di partenza e canale J in bolla", "Startleiste und J-Profil waagerecht", "Стартова планка й J-профіль рівні", "Pantay ang starter strip at J-channel"),
        I(CK, R, "Nailing to the maker's pattern, not overdriven", "Clouage selon le fabricant, sans enfoncer trop", "Clavado según el fabricante, sin hundir", "Chiodatura secondo il produttore, senza affondare", "Nagelung nach Herstellervorgabe, nicht zu fest", "Кріплення за інструкцією виробника, без перетягування", "Ayon sa gumawa ang pagpako, hindi sobra"),
        I(CK, R, "Material, colour and style match the selection", "Matériau, couleur et style conformes au choix", "Material, color y estilo según lo elegido", "Materiale, colore e stile come da scelta", "Material, Farbe und Profil wie ausgewählt", "Матеріал, колір і стиль відповідають вибору", "Tugma sa pinili ang materyal, kulay at estilo"),
      ]),
      S(["Windows", "Fenêtres", "Ventanas", "Finestre", "Fenster", "Вікна", "Bintana"], [
        I(CK, R, "Rough openings match the ordered sizes", "Ouvertures brutes conformes aux dimensions commandées", "Vanos coinciden con las medidas pedidas", "Vani grezzi conformi alle misure ordinate", "Rohbauöffnungen passen zu den Bestellmaßen", "Прорізи відповідають замовленим розмірам", "Tugma sa inorder ang sukat ng butas"),
        inspection(R, "Windows flashed and sealed to the maker's instructions", "Fenêtres solinées et scellées selon le fabricant", "Ventanas selladas según el fabricante", "Finestre sigillate secondo il produttore", "Fenster nach Herstellervorgabe abgedichtet", "Вікна загерметизовано за інструкцією виробника", "Selyado ang bintana ayon sa gumawa"),
        I(CK, R, "Foam gap filled without bowing the frame", "Mousse posée sans déformer le cadre", "Espuma aplicada sin deformar el marco", "Schiuma applicata senza deformare il telaio", "Fuge ausgeschäumt ohne Rahmenverzug", "Піну нанесено без деформації рами", "Napuno ng foam nang hindi bumabaluktot ang frame"),
        I(CK, R, "Egress checked on bedroom windows", "Évacuation vérifiée aux fenêtres de chambre", "Salida de emergencia revisada en dormitorios", "Via di fuga verificata nelle camere", "Rettungsweg an Schlafzimmerfenstern geprüft", "Евакуаційні вікна спалень перевірено", "Nasuri ang egress sa bintana ng kuwarto"),
        I(CK, R, "Trim and caulking finished inside and out", "Moulures et calfeutrage finis dedans et dehors", "Molduras y sellado terminados por dentro y fuera", "Coprifili e sigillature finiti dentro e fuori", "Leisten und Fugen innen und außen fertig", "Лиштви й герметик завершено зсередини та ззовні", "Tapos ang trim at caulk sa loob at labas"),
      ]),
      S(["Handover", "Remise", "Entrega", "Consegna", "Übergabe", "Передача", "Pagbibigay"], [
        walkThrough(),
        inspection(R, "Water test around the new windows", "Essai d'eau autour des nouvelles fenêtres", "Prueba de agua alrededor de las ventanas nuevas", "Prova dell'acqua attorno alle nuove finestre", "Wassertest an den neuen Fenstern", "Перевірка водою навколо нових вікон", "Pagsubok ng tubig sa bagong bintana"),
        clientSignature(),
      ]),
    ]),

  C("fq.cl.general_contracting.punch_list", { trades: GC, phase: "post" },
    ["Punch list and change orders", "Liste de fin de travaux et avenants", "Lista de pendientes y órdenes de cambio", "Lista finale e varianti", "Restarbeiten und Nachträge", "Доробки й зміни до замовлення", "Punch list at change order"],
    [
      S(["Change orders", "Avenants", "Órdenes de cambio", "Varianti", "Nachträge", "Зміни до замовлення", "Change order"], [
        I(TX, R, "Where the change came from: client, found condition or code", "Origine du changement : client, condition découverte ou code", "Origen del cambio: cliente, condición encontrada o código", "Origine della variante: cliente, condizione rilevata o norma", "Anlass: Kundenwunsch, vorgefundener Zustand oder Vorschrift", "Причина зміни: клієнт, виявлений стан чи норми", "Pinagmulan ng pagbabago: kliyente, nakita o code"),
        I(TX, R, "Change and its effect on price", "Changement et effet sur le prix", "Cambio y su efecto en el precio", "Variante e suo effetto sul prezzo", "Änderung und Auswirkung auf den Preis", "Зміна та її вплив на ціну", "Pagbabago at epekto sa presyo"),
        I(CK, R, "Client approval before going ahead", "Approbation du client avant de continuer", "Aprobación del cliente antes de seguir", "Approvazione del cliente prima di procedere", "Freigabe des Kunden vor Weiterarbeit", "Згода клієнта перед продовженням", "Pag-apruba ng kliyente bago ituloy"),
      ]),
      S(["Punch list", "Liste de fin de travaux", "Pendientes", "Lista finale", "Restarbeiten", "Доробки", "Punch list"], [
        walkThrough(),
        I(TX, R, "Open items with room and description", "Éléments ouverts avec pièce et description", "Pendientes con cuarto y descripción", "Voci aperte con stanza e descrizione", "Offene Punkte mit Raum und Beschreibung", "Відкриті пункти з кімнатою та описом", "Mga bukas na item, silid at paliwanag"),
      ]),
      S(["Close-out", "Clôture", "Cierre", "Chiusura", "Abschluss", "Закриття", "Pagsasara"], [
        I(CK, R, "Every punch-list item resolved", "Tous les éléments réglés", "Todos los pendientes resueltos", "Tutte le voci risolte", "Alle Restarbeiten erledigt", "Усі доробки виконано", "Naayos ang lahat ng item"),
        I(CK, O, "Warranty and care instructions handed over", "Garantie et instructions d'entretien remises", "Garantía e instrucciones de cuidado entregadas", "Garanzia e istruzioni di manutenzione consegnate", "Garantie und Pflegehinweise übergeben", "Гарантію й інструкції з догляду передано", "Naibigay ang warranty at gabay sa pag-aalaga"),
        clientSignature(),
      ]),
    ]),
];
