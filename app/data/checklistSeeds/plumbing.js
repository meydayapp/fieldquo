// app/data/checklistSeeds/plumbing.js — see ./_build.js for the format.
// Installation carries before/after photos and serial numbers; the two
// inspections are a column of stop-lights, one per fixture or component.
import { C, S, I, CK, TX, NU, SL, R, O } from "./_build.js";
import { T_PREP, T_WORK, T_TESTS, T_WRAP, photoBefore, photoAfter, cleanedUp, clientSignature } from "./_common.js";

const PL = ["plumbing", "sewer_septic", "well_water"];
const waterOff = () => I(CK, R, "Water shut off and system drained where needed", "Eau coupée et réseau vidangé au besoin", "Agua cerrada y sistema drenado si hace falta", "Acqua chiusa e impianto svuotato se serve", "Wasser abgestellt und entleert wo nötig", "Воду перекрито й злито де потрібно", "Sinara ang tubig at pinatuyo kung kailangan");
const leakTest = () => I(SL, R, "Leak test under pressure", "Essai d'étanchéité sous pression", "Prueba de fugas con presión", "Prova di tenuta in pressione", "Dichtheitsprüfung unter Druck", "Перевірка на протікання під тиском", "Pagsubok sa tagas habang may presyon");
const explained = () => I(CK, R, "Work explained to the client", "Travaux expliqués au client", "Trabajo explicado al cliente", "Lavoro spiegato al cliente", "Arbeit dem Kunden erklärt", "Роботу пояснено клієнту", "Naipaliwanag ang trabaho sa kliyente");
const sl = (...labels) => I(SL, R, ...labels);

export const CHECKLISTS = [
  C("fq.cl.plumbing.installation", { trades: PL },
    ["Plumbing install — rough-in and final", "Installation de plomberie — brute et finale", "Instalación de plomería — obra gruesa y final", "Installazione idraulica — grezzo e finale", "Sanitärinstallation — Roh- und Fertigmontage", "Монтаж сантехніки — чорновий і фінальний", "Pagkakabit ng tubero — rough-in at final"],
    [
      S(T_PREP, [photoBefore(), waterOff(), I(CK, R, "Fixture and parts match the order", "Appareil et pièces conformes à la commande", "Aparato y piezas según el pedido", "Sanitario e ricambi conformi all'ordine", "Objekt und Teile wie bestellt", "Прилад і деталі відповідають замовленню", "Tugma sa order ang fixture at piyesa")]),
      S(["Rough-in", "Installation brute", "Obra gruesa", "Grezzo", "Rohmontage", "Чорновий монтаж", "Rough-in"], [
        I(CK, R, "Supply and drain lines run and supported", "Alimentation et drain posés et supportés", "Líneas de suministro y drenaje tendidas y sujetas", "Linee di adduzione e scarico posate e fissate", "Zu- und Abwasserleitungen verlegt und befestigt", "Подачу й каналізацію прокладено та закріплено", "Nailatag at may suporta ang supply at drain"),
        I(CK, R, "Drain slope and venting correct", "Pente du drain et ventilation conformes", "Pendiente y ventilación del drenaje correctas", "Pendenza e ventilazione dello scarico corrette", "Gefälle und Entlüftung korrekt", "Ухил і вентиляція каналізації правильні", "Tama ang dalisdis at vent ng drain"),
        leakTest(),
      ]),
      S(["Final", "Finale", "Final", "Finale", "Fertigmontage", "Фінальний монтаж", "Final"], [
        I(TX, R, "Model and serial numbers", "Numéros de modèle et de série", "Números de modelo y serie", "Modello e numeri di serie", "Modell- und Seriennummern", "Моделі й серійні номери", "Model at serial number"),
        I(SL, R, "Fixture runs, drains and holds without leaks", "L'appareil fonctionne, se vide et ne fuit pas", "El aparato funciona, drena y no gotea", "Il sanitario funziona, scarica e non perde", "Objekt läuft, entleert und ist dicht", "Прилад працює, зливає й не протікає", "Gumagana, umaagos at walang tagas"),
        photoAfter(),
      ]),
      S(T_WRAP, [cleanedUp(), explained(), clientSignature()]),
    ]),

  C("fq.cl.plumbing.repair", { trades: PL, autoAddFor: ["plumbing"] },
    ["Plumbing repair", "Réparation de plomberie", "Reparación de plomería", "Riparazione idraulica", "Sanitärreparatur", "Сантехнічний ремонт", "Pagkumpuni ng tubero"],
    [
      S(T_PREP, [photoBefore(), waterOff()]),
      S(T_WORK, [
        I(TX, R, "Cause found", "Cause trouvée", "Causa encontrada", "Causa individuata", "Ursache gefunden", "Причину знайдено", "Natukoy ang sanhi"),
        I(TX, R, "Repair made and parts used", "Réparation faite et pièces utilisées", "Reparación hecha y piezas usadas", "Riparazione fatta e ricambi usati", "Reparatur und verwendete Teile", "Ремонт і використані деталі", "Ginawang ayos at piyesang ginamit"),
        leakTest(),
        photoAfter(),
      ]),
      S(T_WRAP, [cleanedUp(), explained(), clientSignature()]),
    ]),

  C("fq.cl.plumbing.diagnostic", { trades: PL, phase: "pre" },
    ["Plumbing diagnostic", "Diagnostic de plomberie", "Diagnóstico de plomería", "Diagnosi idraulica", "Sanitär-Diagnose", "Діагностика сантехніки", "Diyagnosis ng tubero"],
    [
      S(T_WORK, [
        I(TX, R, "What the client reported", "Ce que le client a signalé", "Lo que reportó el cliente", "Cosa ha segnalato il cliente", "Was der Kunde gemeldet hat", "Що повідомив клієнт", "Iniulat ng kliyente"),
        I(SL, R, "Visible leaks or water damage", "Fuites visibles ou dégâts d'eau", "Fugas visibles o daño por agua", "Perdite visibili o danni da acqua", "Sichtbare Lecks oder Wasserschäden", "Видимі протікання чи пошкодження водою", "Nakikitang tagas o sira dahil sa tubig"),
        I(NU, O, "Static water pressure (psi)", "Pression d'eau statique (psi)", "Presión estática del agua (psi)", "Pressione statica dell'acqua (bar)", "Ruhedruck Wasser (bar)", "Статичний тиск води (бар)", "Static na presyon ng tubig (psi)"),
        I(TX, R, "Diagnosis", "Diagnostic", "Diagnóstico", "Diagnosi", "Befund", "Діагноз", "Diyagnosis"),
        I(TX, O, "Options and prices given to the client", "Options et prix remis au client", "Opciones y precios dados al cliente", "Opzioni e prezzi dati al cliente", "Optionen und Preise genannt", "Варіанти й ціни надано клієнту", "Mga opsiyon at presyong ibinigay"),
        photoBefore(),
      ]),
    ]),

  C("fq.cl.plumbing.maintenance", { trades: PL },
    ["Plumbing maintenance", "Entretien de plomberie", "Mantenimiento de plomería", "Manutenzione idraulica", "Sanitärwartung", "Обслуговування сантехніки", "Maintenance ng tubero"],
    [
      S(T_WORK, [
        sl("Water heater: flushed, relief valve tested", "Chauffe-eau : vidangé, soupape testée", "Calentador: purgado, válvula de alivio probada", "Scaldabagno: spurgato, valvola di sicurezza provata", "Warmwasserbereiter gespült, Sicherheitsventil geprüft", "Бойлер промито, запобіжний клапан перевірено", "Water heater: na-flush, nasubok ang relief valve"),
        sl("Main shut-off turns freely", "Robinet principal tourne librement", "Llave de paso principal gira libremente", "Rubinetto generale gira liberamente", "Hauptabsperrung gängig", "Головний кран вільно повертається", "Malayang umiikot ang main shut-off"),
        sl("Drains clear", "Drains dégagés", "Drenajes despejados", "Scarichi liberi", "Abflüsse frei", "Зливи прохідні", "Malinis ang drain"),
        sl("Under-sink supply lines and traps", "Alimentations et siphons sous évier", "Líneas y sifones bajo el fregadero", "Tubi e sifoni sotto il lavello", "Anschlüsse und Siphons unter der Spüle", "Підводки й сифони під мийкою", "Supply line at trap sa ilalim ng lababo"),
        sl("Toilets: fill valve, flapper and seal", "Toilettes : robinet, clapet et joint", "Inodoros: válvula, sapo y sello", "WC: galleggiante, valvola e guarnizione", "WC: Füllventil, Klappe und Dichtung", "Унітази: клапан, заслінка й ущільнення", "Inidoro: fill valve, flapper at selyo"),
        I(TX, O, "Recommendations", "Recommandations", "Recomendaciones", "Raccomandazioni", "Empfehlungen", "Рекомендації", "Mga payo"),
      ]),
    ]),

  C("fq.cl.plumbing.whole_house", { trades: PL, phase: "pre" },
    ["Whole-house plumbing inspection", "Inspection complète de la plomberie", "Inspección de plomería de toda la casa", "Ispezione idraulica di tutta la casa", "Sanitär-Gesamtprüfung", "Огляд сантехніки всього будинку", "Inspeksiyon ng buong tubero ng bahay"],
    [
      S(["Supply", "Alimentation", "Suministro", "Adduzione", "Zulauf", "Подача води", "Supply"], [
        sl("Main line and main shut-off", "Entrée principale et robinet principal", "Línea principal y llave de paso", "Linea principale e rubinetto generale", "Hauptleitung und Hauptabsperrung", "Ввід і головний кран", "Main line at main shut-off"),
        sl("Visible supply lines", "Conduites d'alimentation visibles", "Líneas de suministro visibles", "Tubazioni visibili", "Sichtbare Zuleitungen", "Видимі труби подачі", "Nakikitang supply line"),
        sl("Outdoor hose valves", "Robinets extérieurs", "Llaves de manguera exteriores", "Rubinetti esterni", "Außenwasserhähne", "Зовнішні крани", "Gripo sa labas"),
      ]),
      S(["Water heater", "Chauffe-eau", "Calentador", "Scaldabagno", "Warmwasserbereiter", "Бойлер", "Water heater"], [
        sl("Inlet and outlet connections", "Raccords d'entrée et de sortie", "Conexiones de entrada y salida", "Raccordi di ingresso e uscita", "Zu- und Ablaufanschlüsse", "Вхідні й вихідні з'єднання", "Koneksyon ng pasok at labas"),
        sl("Tank and relief valve", "Réservoir et soupape de sûreté", "Tanque y válvula de alivio", "Serbatoio e valvola di sicurezza", "Speicher und Sicherheitsventil", "Бак і запобіжний клапан", "Tangke at relief valve"),
      ]),
      S(["Fixtures and drains", "Appareils et drains", "Aparatos y drenajes", "Sanitari e scarichi", "Objekte und Abflüsse", "Прилади й зливи", "Fixture at drain"], [
        sl("Kitchen sink and dishwasher", "Évier de cuisine et lave-vaisselle", "Fregadero y lavavajillas", "Lavello e lavastoviglie", "Spüle und Geschirrspüler", "Мийка й посудомийка", "Lababo at dishwasher"),
        sl("Bathroom sinks", "Lavabos", "Lavabos", "Lavabi", "Waschbecken", "Умивальники", "Lababo sa banyo"),
        sl("Toilets", "Toilettes", "Inodoros", "WC", "WCs", "Унітази", "Inidoro"),
        sl("Tubs and showers", "Bains et douches", "Tinas y duchas", "Vasche e docce", "Wannen und Duschen", "Ванни й душі", "Tub at shower"),
        sl("Laundry hot, cold and drain", "Lessive : chaud, froid et drain", "Lavadero: caliente, fría y drenaje", "Lavanderia: calda, fredda e scarico", "Waschmaschine: warm, kalt, Ablauf", "Пральня: гаряча, холодна й злив", "Labahan: mainit, malamig at drain"),
        sl("Main drain and cleanouts", "Drain principal et regards", "Drenaje principal y registros", "Scarico principale e ispezioni", "Hauptabfluss und Reinigungsöffnungen", "Головний злив і ревізії", "Main drain at cleanout"),
      ]),
      S(T_WRAP, [I(TX, R, "Findings and recommendations", "Constats et recommandations", "Hallazgos y recomendaciones", "Esiti e raccomandazioni", "Befunde und Empfehlungen", "Висновки й рекомендації", "Nakita at mga payo")]),
    ]),

  C("fq.cl.plumbing.septic", { trades: ["sewer_septic", "plumbing"], autoAddFor: ["sewer_septic"] },
    ["Septic system inspection", "Inspection de fosse septique", "Inspección de fosa séptica", "Ispezione della fossa settica", "Prüfung der Kleinkläranlage", "Огляд септика", "Inspeksiyon ng septic system"],
    [
      S(["Locate", "Repérage", "Ubicación", "Individuazione", "Lage", "Розташування", "Paghanap"], [
        I(CK, R, "Tank, distribution box and drain field located", "Fosse, boîte de distribution et champ d'épuration repérés", "Tanque, caja de distribución y campo de drenaje ubicados", "Vasca, pozzetto e campo drenante individuati", "Grube, Verteiler und Versickerung gefunden", "Резервуар, розподільчий колодязь і поле знайдено", "Natukoy ang tangke, D-box at drain field"),
        I(CK, R, "Lids exposed and safe access set", "Couvercles dégagés et accès sécurisé", "Tapas expuestas y acceso seguro", "Coperchi scoperti e accesso sicuro", "Deckel freigelegt, sicherer Zugang", "Кришки відкрито, доступ безпечний", "Nakalantad ang takip at ligtas ang daanan"),
      ]),
      S(["Tank", "Fosse", "Tanque", "Vasca", "Grube", "Резервуар", "Tangke"], [
        I(NU, R, "Sludge depth", "Épaisseur des boues", "Profundidad de lodos", "Spessore dei fanghi", "Schlammhöhe", "Товщина мулу", "Lalim ng sludge"),
        I(NU, R, "Scum depth", "Épaisseur de l'écume", "Profundidad de natas", "Spessore della crosta", "Schwimmschichthöhe", "Товщина кірки", "Lalim ng scum"),
        sl("Inlet and outlet baffles", "Chicanes d'entrée et de sortie", "Deflectores de entrada y salida", "Deflettori di ingresso e uscita", "Zu- und Ablauf-Tauchrohre", "Вхідні й вихідні перегородки", "Baffle sa pasok at labas"),
        sl("Effluent filter", "Filtre à effluent", "Filtro de efluente", "Filtro dell'effluente", "Ablauffilter", "Фільтр стоків", "Effluent filter"),
        sl("Leaks or cracks in the tank", "Fuites ou fissures", "Fugas o grietas", "Perdite o crepe", "Undichtigkeiten oder Risse", "Протікання чи тріщини", "Tagas o bitak sa tangke"),
      ]),
      S(["Drain field and pump", "Champ d'épuration et pompe", "Campo de drenaje y bomba", "Campo drenante e pompa", "Versickerung und Pumpe", "Поле фільтрації й насос", "Drain field at pump"], [
        sl("Even distribution", "Distribution uniforme", "Distribución pareja", "Distribuzione uniforme", "Gleichmäßige Verteilung", "Рівномірний розподіл", "Pantay na pamamahagi"),
        sl("Signs of field failure: ponding, odour, lush grass", "Signes de défaillance : flaques, odeur, herbe drue", "Señales de falla: charcos, olor, pasto exuberante", "Segni di guasto: ristagni, odori, erba rigogliosa", "Versagensanzeichen: Pfützen, Geruch, üppiges Gras", "Ознаки відмови: калюжі, запах, густа трава", "Senyales ng sira: tubig, amoy, luntiang damo"),
        I(SL, O, "Pump, float and alarm", "Pompe, flotteur et alarme", "Bomba, flotador y alarma", "Pompa, galleggiante e allarme", "Pumpe, Schwimmer und Alarm", "Насос, поплавок і сигналізація", "Pump, float at alarm"),
      ]),
      S(T_WRAP, [
        I(TX, R, "Findings and recommendations", "Constats et recommandations", "Hallazgos y recomendaciones", "Esiti e raccomandazioni", "Befunde und Empfehlungen", "Висновки й рекомендації", "Nakita at mga payo"),
        photoAfter(),
        clientSignature(O),
      ]),
    ]),
];
