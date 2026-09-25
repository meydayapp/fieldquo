// app/data/checklistSeeds/interior_painting.js — see ./_build.js for the format.
// The full painting job: seven sections in the order a painting day runs.
import { C, S, I, CK, TX, SL, SG, R, O } from "./_build.js";

export const CHECKLISTS = [
  C("fq.cl.painting.job", { trades: ["interior_painting", "exterior_painting"], autoAddFor: ["interior_painting", "exterior_painting"] },
    ["Painting job", "Chantier de peinture", "Trabajo de pintura", "Lavoro di pittura", "Malerauftrag", "Малярні роботи", "Trabaho sa pagpipinta"],
    [
      S(["Preparation", "Préparation", "Preparación", "Preparazione", "Vorbereitung", "Підготовка", "Paghahanda"], [
        I(CK, R, "Scope walked through with the client", "Portée des travaux revue avec le client", "Alcance revisado con el cliente", "Lavori concordati con il cliente", "Umfang mit dem Kunden durchgegangen", "Обсяг робіт узгоджено з клієнтом", "Nirebyu ang saklaw kasama ang kliyente"),
        I(TX, R, "Colours, sheen and product confirmed", "Couleurs, lustre et produit confirmés", "Colores, brillo y producto confirmados", "Colori, finitura e prodotto confermati", "Farben, Glanzgrad und Produkt bestätigt", "Кольори, ступінь блиску й продукт підтверджено", "Kumpirmado ang kulay, kinang at produkto"),
        I(TX, O, "Existing colour", "Couleur actuelle", "Color actual", "Colore attuale", "Bisherige Farbe", "Поточний колір", "Kasalukuyang kulay"),
        I(TX, O, "Surface type", "Type de surface", "Tipo de superficie", "Tipo di superficie", "Untergrund", "Тип поверхні", "Uri ng ibabaw"),
        I(CK, R, "Floors and furniture covered", "Planchers et meubles protégés", "Pisos y muebles cubiertos", "Pavimenti e mobili coperti", "Böden und Möbel abgedeckt", "Підлогу й меблі накрито", "Natakpan ang sahig at muwebles"),
        I(CK, R, "Outlets, switch plates and hardware masked or removed", "Prises, plaques et quincaillerie masquées ou retirées", "Enchufes, placas y herrajes cubiertos o retirados", "Prese, placche e ferramenta coperte o rimosse", "Steckdosen, Schalterblenden und Beschläge abgeklebt oder abgebaut", "Розетки, накладки й фурнітуру заклеєно або знято", "Tinakpan o tinanggal ang saksakan, switch plate at hardware"),
      ]),
      S(["Surface inspection", "Inspection des surfaces", "Inspección de superficies", "Ispezione delle superfici", "Untergrundprüfung", "Огляд поверхонь", "Inspeksiyon ng ibabaw"], [
        I(TX, R, "Nail pops, cracks, holes, peeling or water stains found", "Clous ressortis, fissures, trous, écaillage ou taches d'eau relevés", "Clavos salidos, grietas, agujeros, descascarado o manchas de agua encontrados", "Chiodi sporgenti, crepe, fori, sfogliature o macchie d'acqua rilevati", "Nagelköpfe, Risse, Löcher, Abplatzungen oder Wasserflecken festgestellt", "Виявлені цвяхи, тріщини, отвори, лущення чи сліди води", "Nakitang lumitaw na pako, bitak, butas, pagbabalat o mantsa ng tubig"),
        I(SL, R, "Damage to the substrate", "Dommages au support", "Daño en el sustrato", "Danni al supporto", "Schäden am Untergrund", "Пошкодження основи", "Sira sa ilalim na ibabaw"),
        I(TX, O, "Damage already there that is not in scope", "Dommages existants hors contrat", "Daños existentes fuera del alcance", "Danni preesistenti non compresi nei lavori", "Vorhandene Schäden außerhalb des Auftrags", "Наявні пошкодження поза обсягом робіт", "Dating sira na wala sa saklaw"),
        I(SL, O, "Moisture concerns", "Problèmes d'humidité", "Problemas de humedad", "Problemi di umidità", "Feuchtigkeitsprobleme", "Проблеми з вологою", "Problema sa halumigmig"),
      ]),
      S(["Safety", "Sécurité", "Seguridad", "Sicurezza", "Sicherheit", "Безпека", "Kaligtasan"], [
        I(CK, R, "Protective gear on", "Équipement de protection porté", "Equipo de protección puesto", "Dispositivi di protezione indossati", "Schutzausrüstung getragen", "Засоби захисту вдягнено", "Suot ang proteksiyon"),
        I(CK, O, "Room ventilated", "Pièce ventilée", "Habitación ventilada", "Stanza aerata", "Raum belüftet", "Приміщення провітрено", "May bentilasyon ang silid"),
        I(CK, R, "Ladders and staging checked and footed", "Échelles et échafaudages vérifiés et calés", "Escaleras y andamios revisados y asegurados", "Scale e ponteggi controllati e stabili", "Leitern und Gerüste geprüft und gesichert", "Драбини й риштування перевірено та закріплено", "Nasuri at matatag ang hagdan at plataporma"),
        I(CK, O, "Fall protection in place where needed", "Protection antichute en place au besoin", "Protección anticaídas donde haga falta", "Protezione anticaduta dove serve", "Absturzsicherung wo nötig", "Захист від падіння там, де потрібно", "May proteksiyon sa pagkahulog kung kailangan"),
        I(CK, O, "Work area safe for the people living there", "Zone de travail sûre pour les occupants", "Zona de trabajo segura para los ocupantes", "Area di lavoro sicura per chi ci abita", "Arbeitsbereich sicher für die Bewohner", "Робоча зона безпечна для мешканців", "Ligtas ang lugar para sa mga nakatira"),
      ]),
      S(["The work", "Les travaux", "El trabajo", "Il lavoro", "Die Arbeit", "Роботи", "Ang trabaho"], [
        I(CK, O, "Repairs and patching done", "Réparations et rebouchage faits", "Reparaciones y resanes hechos", "Riparazioni e stuccature fatte", "Reparaturen und Spachtelarbeiten erledigt", "Ремонт і шпаклювання виконано", "Tapos ang ayos at tapal"),
        I(CK, O, "Sanded", "Poncé", "Lijado", "Carteggiato", "Geschliffen", "Відшліфовано", "Nailiha"),
        I(CK, O, "Caulked", "Calfeutré", "Sellado", "Sigillato", "Verfugt", "Загерметизовано", "Na-caulk"),
        I(CK, R, "Primer applied where needed", "Apprêt appliqué au besoin", "Imprimación aplicada donde hacía falta", "Primer applicato dove serve", "Grundierung wo nötig aufgetragen", "Ґрунт нанесено де потрібно", "Nilagyan ng primer kung kailangan"),
        I(TX, O, "Application method", "Méthode d'application", "Método de aplicación", "Metodo di applicazione", "Auftragsverfahren", "Спосіб нанесення", "Paraan ng paglalagay"),
        I(TX, O, "Coats applied", "Couches appliquées", "Manos aplicadas", "Mani applicate", "Aufgetragene Schichten", "Нанесено шарів", "Bilang ng patong"),
        I(SL, R, "Coverage even, no thin spots", "Couvrance uniforme, sans manques", "Cobertura pareja, sin zonas delgadas", "Copertura uniforme, senza zone scoperte", "Deckung gleichmäßig, keine dünnen Stellen", "Покриття рівне, без просвітів", "Pantay ang kulay, walang manipis"),
        I(SL, R, "Lines and edges clean", "Lignes et bordures nettes", "Líneas y bordes limpios", "Linee e bordi netti", "Kanten und Linien sauber", "Лінії та краї чисті", "Malinis ang linya at gilid"),
      ]),
      S(["Record", "Registre", "Registro", "Registro", "Dokumentation", "Записи", "Tala"], [
        I(TX, O, "Changes to the scope", "Changements à la portée", "Cambios al alcance", "Modifiche ai lavori", "Änderungen am Umfang", "Зміни в обсязі робіт", "Pagbabago sa saklaw"),
        I(TX, O, "Paint product and batch number", "Produit et numéro de lot", "Producto y número de lote", "Prodotto e numero di lotto", "Farbprodukt und Chargennummer", "Фарба та номер партії", "Produkto at batch number ng pintura"),
      ]),
      S(["Cleanup", "Nettoyage", "Limpieza", "Pulizia", "Aufräumen", "Прибирання", "Paglilinis"], [
        I(CK, R, "Work area cleaned", "Zone de travail nettoyée", "Área de trabajo limpia", "Area di lavoro pulita", "Arbeitsbereich gereinigt", "Робочу зону прибрано", "Nalinis ang lugar"),
        I(CK, R, "Spills and overspray removed", "Éclaboussures et surpulvérisation enlevées", "Derrames y salpicaduras eliminados", "Macchie e spruzzi rimossi", "Kleckse und Sprühnebel entfernt", "Бризки й патьоки прибрано", "Natanggal ang tulo at talsik"),
        I(CK, R, "Covers and masking removed", "Protections et ruban retirés", "Cubiertas y cinta retiradas", "Coperture e nastro rimossi", "Abdeckungen und Klebeband entfernt", "Укриття й стрічку знято", "Tinanggal ang takip at tape"),
        I(CK, O, "Leftover paint labelled with room and colour", "Reste de peinture étiqueté (pièce et couleur)", "Pintura sobrante etiquetada con cuarto y color", "Vernice avanzata etichettata con stanza e colore", "Restfarbe mit Raum und Farbton beschriftet", "Залишки фарби підписано: кімната й колір", "May label ang natirang pintura: silid at kulay"),
        I(CK, R, "Final walk-through done", "Visite finale faite", "Recorrido final hecho", "Sopralluogo finale fatto", "Abschlussbegehung erledigt", "Фінальний огляд проведено", "Tapos ang huling paglibot"),
      ]),
      S(["Client handover", "Remise au client", "Entrega al cliente", "Consegna al cliente", "Übergabe an den Kunden", "Передача клієнту", "Pagbibigay sa kliyente"], [
        I(CK, R, "Work explained to the client", "Travaux expliqués au client", "Trabajo explicado al cliente", "Lavoro spiegato al cliente", "Arbeit dem Kunden erklärt", "Роботу пояснено клієнту", "Naipaliwanag ang trabaho sa kliyente"),
        I(CK, O, "Touch-up process explained", "Processus de retouche expliqué", "Proceso de retoques explicado", "Procedura dei ritocchi spiegata", "Ablauf für Ausbesserungen erklärt", "Порядок підфарбування пояснено", "Naipaliwanag ang proseso ng retoke"),
        I(CK, O, "Drying and curing times explained", "Temps de séchage et de cure expliqués", "Tiempos de secado y curado explicados", "Tempi di asciugatura e indurimento spiegati", "Trocken- und Aushärtezeiten erklärt", "Час висихання й затвердіння пояснено", "Naipaliwanag ang tagal ng pagkatuyo"),
        I(SG, R, "Client approval", "Approbation du client", "Aprobación del cliente", "Approvazione del cliente", "Abnahme durch den Kunden", "Підтвердження клієнта", "Pag-apruba ng kliyente"),
      ]),
    ]),
];
