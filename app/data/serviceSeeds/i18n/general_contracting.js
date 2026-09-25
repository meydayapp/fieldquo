// app/data/serviceSeeds/i18n/general_contracting.js
//
// The languages general_contracting.js does not write inline — Italian, German,
// Ukrainian, Punjabi (Gurmukhi) and Tagalog for its categories and services,
// and Punjabi for its template lines (keyed by the English line name) — merged
// by withLanguages in ../_templateLines.js. Hand-written trade wording, no
// machine translation; checked by scripts/check-seed-languages.mjs.
export const I18N = {
 "categories": {
  "bathroom": {
   "it": "Ristrutturazione bagno",
   "de": "Badsanierung",
   "uk": "Ремонт ванної кімнати",
   "pa": "ਬਾਥਰੂਮ ਦੀ ਮੁਰੰਮਤ-ਨਵੀਨੀਕਰਨ",
   "tl": "Renobasyon ng banyo"
  },
  "concrete_masonry": {
   "it": "Calcestruzzo, fondazioni e muratura",
   "de": "Beton, Fundament und Mauerwerk",
   "uk": "Бетон, фундамент і кладка",
   "pa": "ਕੰਕਰੀਟ, ਨੀਂਹ ਅਤੇ ਚਿਣਾਈ",
   "tl": "Kongkreto, pundasyon at masonry"
  },
  "site_prep": {
   "it": "Demolizione, preparazione del cantiere e pulizia",
   "de": "Abbruch, Baustellenvorbereitung und Reinigung",
   "uk": "Демонтаж, підготовка ділянки та прибирання",
   "pa": "ਢਾਹੁਣਾ, ਥਾਂ ਦੀ ਤਿਆਰੀ ਅਤੇ ਸਫ਼ਾਈ",
   "tl": "Demolisyon, paghahanda ng lugar at paglilinis"
  },
  "electrical": {
   "it": "Impianti elettrici e illuminazione",
   "de": "Elektro und Beleuchtung",
   "uk": "Електрика та освітлення",
   "pa": "ਬਿਜਲੀ ਅਤੇ ਰੋਸ਼ਨੀ",
   "tl": "Kuryente at ilaw"
  },
  "outdoor": {
   "it": "Recinzioni, deck e strutture esterne",
   "de": "Zäune, Decks und Außenbauten",
   "uk": "Паркани, тераси та зовнішні споруди",
   "pa": "ਵਾੜਾਂ, ਡੈੱਕ ਅਤੇ ਬਾਹਰੀ ਢਾਂਚੇ",
   "tl": "Bakod, deck at estruktura sa labas"
  },
  "flooring": {
   "it": "Pavimenti e piastrelle",
   "de": "Böden und Fliesen",
   "uk": "Підлога та плитка",
   "pa": "ਫ਼ਰਸ਼ ਅਤੇ ਟਾਈਲ",
   "tl": "Sahig at tile"
  },
  "framing": {
   "it": "Struttura, carpenteria e finiture in legno",
   "de": "Rahmenbau, Zimmerei und Leisten",
   "uk": "Каркас, столярка та оздоблення",
   "pa": "ਫ਼ਰੇਮਿੰਗ, ਤਰਖਾਣੀ ਅਤੇ ਟ੍ਰਿਮ",
   "tl": "Framing, karpinterya at trim"
  },
  "hvac": {
   "it": "Climatizzazione, isolamento e ventilazione",
   "de": "Heizung/Klima, Dämmung und Lüftung",
   "uk": "Опалення/кондиціювання, ізоляція та вентиляція",
   "pa": "HVAC, ਇੰਸੂਲੇਸ਼ਨ ਅਤੇ ਹਵਾਦਾਰੀ",
   "tl": "HVAC, insulasyon at bentilasyon"
  },
  "kitchen": {
   "it": "Ristrutturazione cucina",
   "de": "Küchensanierung",
   "uk": "Ремонт кухні",
   "pa": "ਰਸੋਈ ਦੀ ਮੁਰੰਮਤ-ਨਵੀਨੀਕਰਨ",
   "tl": "Renobasyon ng kusina"
  },
  "painting": {
   "it": "Tinteggiatura, cartongesso e finiture",
   "de": "Malerarbeiten, Trockenbau und Oberflächen",
   "uk": "Фарбування, гіпсокартон та оздоблення",
   "pa": "ਪੇਂਟ, ਡ੍ਰਾਈਵਾਲ ਅਤੇ ਫ਼ਿਨਿਸ਼",
   "tl": "Pintura, drywall at finishing"
  },
  "plumbing": {
   "it": "Idraulica e scarichi",
   "de": "Sanitär und Entwässerung",
   "uk": "Сантехніка та водовідведення",
   "pa": "ਪਲੰਬਿੰਗ ਅਤੇ ਨਿਕਾਸ",
   "tl": "Tubero at drainage"
  },
  "roofing": {
   "it": "Tetti, grondaie e camini",
   "de": "Dach, Dachrinnen und Kamine",
   "uk": "Покрівля, ринви та димарі",
   "pa": "ਛੱਤਾਂ, ਪਰਨਾਲੇ ਅਤੇ ਚਿਮਨੀਆਂ",
   "tl": "Bubong, alulod at tsimenea"
  },
  "waterproofing": {
   "it": "Impermeabilizzazione e ripristino",
   "de": "Abdichtung und Sanierung",
   "uk": "Гідроізоляція та відновлення",
   "pa": "ਵਾਟਰਪਰੂਫ਼ਿੰਗ ਅਤੇ ਬਹਾਲੀ",
   "tl": "Waterproofing at restorasyon"
  },
  "openings": {
   "it": "Finestre, porte e garage",
   "de": "Fenster, Türen und Garage",
   "uk": "Вікна, двері та гараж",
   "pa": "ਖਿੜਕੀਆਂ, ਦਰਵਾਜ਼ੇ ਅਤੇ ਗੈਰਾਜ",
   "tl": "Bintana, pinto at garahe"
  },
  "consulting": {
   "it": "Progettazione, consulenza e gestione lavori",
   "de": "Planung, Beratung und Projektleitung",
   "uk": "Проєктування, консультації та управління проєктом",
   "pa": "ਡਿਜ਼ਾਈਨ, ਸਲਾਹ ਅਤੇ ਪ੍ਰੋਜੈਕਟ ਪ੍ਰਬੰਧ",
   "tl": "Disenyo, konsultasyon at pamamahala ng proyekto"
  },
  "renovation": {
   "it": "Ristrutturazione completa e finitura seminterrati",
   "de": "Komplettsanierung und Kellerausbau",
   "uk": "Повний ремонт і облаштування підвалу",
   "pa": "ਪੂਰੇ ਘਰ ਦਾ ਨਵੀਨੀਕਰਨ ਅਤੇ ਬੇਸਮੈਂਟ ਮੁਕੰਮਲ ਕਰਨਾ",
   "tl": "Buong renobasyon at pagtatapos ng basement"
  }
 },
 "services": {
  "fq.general_contracting.bathroom.demolition": {
   "pa": [
    "ਬਾਥਰੂਮ ਢਾਹੁਣਾ ਅਤੇ ਹਟਾਉਣਾ",
    "ਫ਼ਿਕਸਚਰ, ਵੈਨਿਟੀ, ਟਾਈਲ ਅਤੇ ਫ਼ਿਨਿਸ਼ ਕੱਢ ਕੇ ਲਿਜਾਏ ਜਾਂਦੇ ਹਨ ਤਾਂ ਜੋ ਕਮਰਾ ਨਵੀਂ ਉਸਾਰੀ ਲਈ ਤਿਆਰ ਹੋਵੇ।"
   ]
  },
  "fq.general_contracting.bathroom.plumbing_fixtures": {
   "it": [
    "Idraulica e sanitari del bagno",
    "WC, mobile lavabo, rubinetto e doccia installati e collegati, manodopera e materiali inclusi."
   ],
   "de": [
    "Badsanitär und Armaturenmontage",
    "WC, Waschtisch, Armatur und Duschkomponenten montiert und angeschlossen, Arbeit und Material inklusive."
   ],
   "uk": [
    "Сантехніка та монтаж приладів у ванній",
    "Унітаз, тумбу, змішувач і душ встановлено й під'єднано, робота й матеріали включені."
   ],
   "pa": [
    "ਬਾਥਰੂਮ ਪਲੰਬਿੰਗ ਅਤੇ ਫ਼ਿਕਸਚਰ ਲਾਉਣਾ",
    "ਟਾਇਲਟ, ਵੈਨਿਟੀ, ਟੂਟੀ ਅਤੇ ਸ਼ਾਵਰ ਲਾ ਕੇ ਜੋੜੇ ਜਾਂਦੇ ਹਨ, ਮਜ਼ਦੂਰੀ ਅਤੇ ਸਮਾਨ ਸਮੇਤ।"
   ],
   "tl": [
    "Tubero at pagkakabit ng fixture sa banyo",
    "Ikinabit at ikinonekta ang inidoro, vanity, gripo at shower, kasama ang trabaho at materyales."
   ]
  },
  "fq.general_contracting.bathroom.remodel_refinish": {
   "it": [
    "Ristrutturazione bagno con rismaltatura vasca e rivestimento",
    "Piastrelle vecchie rimosse, vasca e pareti doccia rismaltate e nuovi sanitari montati per un bagno rinnovato senza demolizione totale."
   ],
   "de": [
    "Badsanierung mit Wannen- und Wandneuglasur",
    "Alte Fliesen entfernt, Wanne und Duschwände neu glasiert und neue Armaturen montiert — ein renoviertes Bad ohne Kernsanierung."
   ],
   "uk": [
    "Ремонт ванної з реставрацією ванни та стін",
    "Стару плитку знято, ванну й стіни душу покрито новою емаллю, встановлено нові прилади — оновлена ванна без повного демонтажу."
   ],
   "pa": [
    "ਟੱਬ ਅਤੇ ਕੰਧਾਂ ਦੀ ਰੀਗਲੇਜ਼ਿੰਗ ਨਾਲ ਬਾਥਰੂਮ ਨਵੀਨੀਕਰਨ",
    "ਪੁਰਾਣੀ ਟਾਈਲ ਹਟਾਈ, ਟੱਬ ਅਤੇ ਸ਼ਾਵਰ ਦੀਆਂ ਕੰਧਾਂ ਮੁੜ ਗਲੇਜ਼ ਅਤੇ ਨਵੇਂ ਫ਼ਿਕਸਚਰ — ਪੂਰੀ ਤੋੜ-ਫੋੜ ਤੋਂ ਬਿਨਾਂ ਨਵਾਂ ਬਾਥਰੂਮ।"
   ],
   "tl": [
    "Renobasyon ng banyo na may reglazing ng tub at pader",
    "Inalis ang lumang tile, ni-reglaze ang tub at pader ng shower at ikinabit ang bagong fixture — bagong banyo nang hindi binabakbak lahat."
   ]
  },
  "fq.general_contracting.bathroom.remodel_shower_system": {
   "it": [
    "Ristrutturazione bagno con nuovo sistema doccia",
    "Nuovo rivestimento doccia, nicchia e miscelatore installati nella ristrutturazione, pareti rifinite in accordo."
   ],
   "de": [
    "Badsanierung mit neuem Duschsystem",
    "Neue Duschverkleidung, Nische und Mischventil im Zuge der Badsanierung eingebaut, Wände passend fertiggestellt."
   ],
   "uk": [
    "Ремонт ванної з новою душовою системою",
    "Нове облицювання душу, ніша та змішувач у межах ремонту, стіни оздоблено в тон."
   ],
   "pa": [
    "ਨਵੇਂ ਸ਼ਾਵਰ ਸਿਸਟਮ ਨਾਲ ਬਾਥਰੂਮ ਨਵੀਨੀਕਰਨ",
    "ਬਾਥਰੂਮ ਨਵੀਨੀਕਰਨ ਵਿੱਚ ਨਵੀਂ ਸ਼ਾਵਰ ਕੰਧ, ਆਲਾ ਅਤੇ ਵਾਲਵ ਲਾਏ ਜਾਂਦੇ ਹਨ, ਕੰਧਾਂ ਮੇਲ ਖਾਂਦੀਆਂ ਮੁਕੰਮਲ।"
   ],
   "tl": [
    "Renobasyon ng banyo na may bagong shower system",
    "Bagong pader ng shower, niche at valve bilang bahagi ng renobasyon, tinapos ang pader nang tugma."
   ]
  },
  "fq.general_contracting.bathroom.tub_repair_refinish": {
   "it": [
    "Riparazione, smaltatura e impermeabilizzazione vasca",
    "Scheggiature e crepe riparate, vasca rismaltata e rivestimento sigillato con uno strato protettivo."
   ],
   "de": [
    "Wannenreparatur, Neubeschichtung und Abdichtung",
    "Abplatzer und Risse repariert, die Wanne neu beschichtet und die Wandverkleidung mit Schutzschicht versiegelt."
   ],
   "uk": [
    "Ремонт, реставрація та гідроізоляція ванни",
    "Сколи й тріщини відремонтовано, ванну відреставровано, облицювання загерметизовано захисним покриттям."
   ],
   "pa": [
    "ਬਾਥਟੱਬ ਦੀ ਮੁਰੰਮਤ, ਰੀਫ਼ਿਨਿਸ਼ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ਿੰਗ",
    "ਝੜੇ ਹਿੱਸੇ ਅਤੇ ਤਰੇੜਾਂ ਠੀਕ, ਟੱਬ ਰੀਫ਼ਿਨਿਸ਼ ਅਤੇ ਆਲੇ-ਦੁਆਲੇ ਸੁਰੱਖਿਆ ਕੋਟਿੰਗ ਨਾਲ ਸੀਲ।"
   ],
   "tl": [
    "Pagkukumpuni, refinishing at waterproofing ng bathtub",
    "Inayos ang tapyas at bitak, ni-refinish ang tub at sinelyuhan ang paligid ng protektibong coating."
   ]
  },
  "fq.general_contracting.bathroom.resurfacing_plumbing": {
   "it": [
    "Rivestimento vasca e doccia con lavori idraulici",
    "Vasca e pareti doccia rivestite in resina epossidica e nuovo rubinetto, miscelatore e scarico installati insieme."
   ],
   "de": [
    "Wannen- und Duschbeschichtung mit Sanitärarbeiten",
    "Wanne und Duschwände mit Epoxid beschichtet und gleichzeitig neue Armatur, Ventil und Ablauf montiert."
   ],
   "uk": [
    "Оновлення ванни й душу з сантехнічними роботами",
    "Ванну й стіни душу покрито епоксидом, водночас встановлено новий змішувач, клапан і злив."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਸਮੇਤ ਟੱਬ ਅਤੇ ਸ਼ਾਵਰ ਦੀ ਨਵੀਂ ਸਤਹ",
    "ਟੱਬ ਅਤੇ ਸ਼ਾਵਰ ਦੀਆਂ ਕੰਧਾਂ 'ਤੇ ਐਪੌਕਸੀ ਦੀ ਨਵੀਂ ਸਤਹ ਅਤੇ ਨਾਲ ਹੀ ਨਵੀਂ ਟੂਟੀ, ਵਾਲਵ ਅਤੇ ਡਰੇਨ।"
   ],
   "tl": [
    "Resurfacing ng tub at shower na may tubero",
    "Ni-resurface sa epoxy ang tub at pader ng shower at sabay ikinabit ang bagong gripo, valve at drain."
   ]
  },
  "fq.general_contracting.bathroom.complete_remodel": {
   "pa": [
    "ਪੂਰੇ ਬਾਥਰੂਮ ਦਾ ਨਵੀਨੀਕਰਨ",
    "ਵੈਨਿਟੀ, ਫ਼ਿਕਸਚਰ, ਬਿਜਲੀ, ਟਾਈਲ ਅਤੇ ਫ਼ਿਨਿਸ਼ ਸਟੱਡਾਂ ਤੱਕ ਬਦਲੇ ਜਾਂਦੇ ਹਨ, ਹਰ ਕਾਰੀਗਰ ਦਾ ਤਾਲਮੇਲ ਕਰਕੇ।"
   ]
  },
  "fq.general_contracting.bathroom.full_remodel_framing": {
   "it": [
    "Ristrutturazione totale del bagno con struttura e predisposizioni",
    "Pareti rifatte, impianti idraulico ed elettrico predisposti per la nuova disposizione, poi doccia, sanitari e finiture."
   ],
   "de": [
    "Komplette Badsanierung mit Rahmenbau und Rohinstallation",
    "Wände neu gestellt, Sanitär und Elektro für das neue Layout vorinstalliert, danach Dusche, Armaturen und Oberflächen."
   ],
   "uk": [
    "Повний ремонт ванної з каркасом і прокладанням комунікацій",
    "Стіни перебудовано, сантехніку й електрику прокладено під нове планування, потім душ, прилади й оздоблення."
   ],
   "pa": [
    "ਫ਼ਰੇਮਿੰਗ ਅਤੇ ਰਫ਼-ਇਨ ਸਮੇਤ ਪੂਰਾ ਬਾਥਰੂਮ ਨਵੀਨੀਕਰਨ",
    "ਕੰਧਾਂ ਮੁੜ ਫ਼ਰੇਮ, ਨਵੇਂ ਨਕਸ਼ੇ ਮੁਤਾਬਕ ਪਲੰਬਿੰਗ ਅਤੇ ਬਿਜਲੀ ਰਫ਼-ਇਨ, ਫਿਰ ਸ਼ਾਵਰ, ਫ਼ਿਕਸਚਰ ਅਤੇ ਫ਼ਿਨਿਸ਼।"
   ],
   "tl": [
    "Buong renobasyon ng banyo na may framing at rough-in",
    "Muling ini-frame ang pader, rough-in ng tubero at kuryente para sa bagong layout, saka shower, fixture at finishing."
   ]
  },
  "fq.general_contracting.bathroom.exhaust_fan": {
   "it": [
    "Aspiratore bagno e scarico",
    "Nuovo aspiratore fornito, installato e canalizzato all'esterno perché l'umidità esca dalla stanza."
   ],
   "de": [
    "Badlüfter und Abluftführung",
    "Neuer Lüfter geliefert, montiert und nach außen geführt, damit die Feuchtigkeit den Raum verlässt."
   ],
   "uk": [
    "Витяжний вентилятор у ванній і вентиляція",
    "Новий вентилятор постачено, встановлено й виведено назовні, щоб волога виходила з кімнати."
   ],
   "pa": [
    "ਬਾਥਰੂਮ ਐਗਜ਼ੌਸਟ ਪੱਖਾ ਅਤੇ ਵੈਂਟ",
    "ਨਵਾਂ ਐਗਜ਼ੌਸਟ ਪੱਖਾ ਦੇ ਕੇ ਲਾਇਆ ਅਤੇ ਬਾਹਰ ਤੱਕ ਡਕਟ ਕੀਤਾ ਜਾਂਦਾ ਹੈ ਤਾਂ ਜੋ ਨਮੀ ਕਮਰੇ 'ਚੋਂ ਨਿਕਲੇ।"
   ],
   "tl": [
    "Exhaust fan at bentilasyon ng banyo",
    "Nagbigay, ikinabit at dinaluyan palabas ang bagong exhaust fan para lumabas ang halumigmig."
   ]
  },
  "fq.general_contracting.bathroom.custom_vanity": {
   "it": [
    "Mobile bagno su misura e accessori",
    "Mobile bagno su misura fornito e installato con piano, lavabo, rubinetto e maniglie."
   ],
   "de": [
    "Maßgefertigter Waschtisch mit Beschlägen",
    "Ein maßgefertigter Waschtisch geliefert und montiert, mit Platte, Becken, Armatur und Griffen."
   ],
   "uk": [
    "Тумба для ванної на замовлення з фурнітурою",
    "Тумбу на замовлення постачено й встановлено зі стільницею, раковиною, змішувачем і ручками."
   ],
   "pa": [
    "ਨਾਪ ਦੀ ਬਾਥਰੂਮ ਵੈਨਿਟੀ ਅਤੇ ਹਾਰਡਵੇਅਰ",
    "ਨਾਪ ਦੀ ਵੈਨਿਟੀ ਉਸਦੇ ਟੌਪ, ਸਿੰਕ, ਟੂਟੀ ਅਤੇ ਹਾਰਡਵੇਅਰ ਸਮੇਤ ਦੇ ਕੇ ਲਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Custom na vanity ng banyo at hardware",
    "Nagbigay at ikinabit ang custom na vanity kasama ang top, lababo, gripo at hardware."
   ]
  },
  "fq.general_contracting.bathroom.shower_doors": {
   "it": [
    "Porte doccia e box in vetro",
    "Porte doccia con o senza telaio e pannelli in vetro forniti, montati e sigillati."
   ],
   "de": [
    "Duschtüren und Glasabtrennungen",
    "Gerahmte oder rahmenlose Duschtüren und Glaswände geliefert, montiert und abgedichtet."
   ],
   "uk": [
    "Душові двері та скляні кабіни",
    "Двері з рамою чи без та скляні панелі постачено, встановлено й загерметизовано."
   ],
   "pa": [
    "ਸ਼ਾਵਰ ਦਰਵਾਜ਼ੇ ਅਤੇ ਸ਼ੀਸ਼ੇ ਦੇ ਘੇਰੇ",
    "ਫ਼ਰੇਮ ਵਾਲੇ ਜਾਂ ਬਿਨਾਂ ਫ਼ਰੇਮ ਸ਼ਾਵਰ ਦਰਵਾਜ਼ੇ ਅਤੇ ਸ਼ੀਸ਼ੇ ਦੇ ਪੈਨਲ ਦੇ ਕੇ, ਲਾ ਕੇ ਸੀਲ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pinto ng shower at salaming enclosure",
    "Nagbigay, ikinabit at sinelyuhan ang may frame o frameless na pinto ng shower at salaming panel."
   ]
  },
  "fq.general_contracting.bathroom.cabinet_refinishing_hardware": {
   "it": [
    "Rinnovo mobili cucina e bagno e maniglie",
    "Mobili rinnovati o verniciati e nuove maniglie montate, in cucina e nei bagni."
   ],
   "de": [
    "Schrankaufarbeitung und Beschläge für Küche und Bad",
    "Schränke aufgearbeitet oder lackiert und neue Griffe montiert, in Küche und Bädern."
   ],
   "uk": [
    "Оновлення шаф кухні та ванної з фурнітурою",
    "Шафи оновлено чи пофарбовано, нову фурнітуру встановлено — на кухні та у ванних."
   ],
   "pa": [
    "ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਕੈਬਨਿਟ ਰੀਫ਼ਿਨਿਸ਼ ਅਤੇ ਹਾਰਡਵੇਅਰ",
    "ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮਾਂ ਵਿੱਚ ਕੈਬਨਿਟ ਰੀਫ਼ਿਨਿਸ਼ ਜਾਂ ਪੇਂਟ ਅਤੇ ਨਵਾਂ ਹਾਰਡਵੇਅਰ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Refinishing ng kabinet sa kusina at banyo at hardware",
    "Ni-refinish o pininturahan ang kabinet at ikinabit ang bagong hardware, sa kusina at mga banyo."
   ]
  },
  "fq.general_contracting.bathroom.sink_plumbing": {
   "it": [
    "Installazione lavello cucina o bagno con idraulica",
    "Lavello sottopiano montato con sifone, gruppo di scarico e piletta, collegato e collaudato."
   ],
   "de": [
    "Spülen- oder Waschbeckeneinbau mit Sanitär",
    "Unterbaubecken mit Siphon, Ablaufgarnitur und Stopfen eingebaut, angeschlossen und geprüft."
   ],
   "uk": [
    "Встановлення мийки на кухні чи у ванній із сантехнікою",
    "Мийку під стільницю встановлено із сифоном, зливом і клапаном, під'єднано й перевірено."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਸਮੇਤ ਰਸੋਈ ਜਾਂ ਬਾਥਰੂਮ ਸਿੰਕ ਲਾਉਣਾ",
    "ਅੰਡਰਮਾਊਂਟ ਸਿੰਕ ਟ੍ਰੈਪ, ਡਰੇਨ ਅਤੇ ਪੌਪ-ਅੱਪ ਸਮੇਤ ਲਾ ਕੇ ਜੋੜਿਆ ਅਤੇ ਜਾਂਚਿਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkakabit ng lababo sa kusina o banyo na may tubero",
    "Ikinabit ang undermount na lababo kasama ang trap, drain at pop-up, ikinonekta at sinubukan."
   ]
  },
  "fq.general_contracting.bathroom.master_custom_tile": {
   "it": [
    "Ristrutturazione bagno padronale e doccia con piastrelle su misura",
    "Doccia piastrellata su misura, rivestimento e box realizzati in una ristrutturazione completa del bagno padronale."
   ],
   "de": [
    "Sanierung von Hauptbad und Dusche mit individuellen Fliesen",
    "Eine individuell geflieste Dusche mit Verkleidung und Abtrennung im Zuge einer kompletten Hauptbadsanierung."
   ],
   "uk": [
    "Ремонт головної ванної та душу з плиткою на замовлення",
    "Душ із плиткою на замовлення, облицювання й кабіну зроблено в межах повного ремонту головної ванної."
   ],
   "pa": [
    "ਮੁੱਖ ਬਾਥਰੂਮ ਅਤੇ ਸ਼ਾਵਰ ਦਾ ਨਵੀਨੀਕਰਨ ਖ਼ਾਸ ਟਾਈਲ ਨਾਲ",
    "ਪੂਰੇ ਮੁੱਖ ਬਾਥਰੂਮ ਦੇ ਨਵੀਨੀਕਰਨ ਵਿੱਚ ਖ਼ਾਸ ਟਾਈਲਾਂ ਵਾਲਾ ਸ਼ਾਵਰ, ਕੰਧਾਂ ਅਤੇ ਘੇਰਾ ਬਣਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Renobasyon ng master bathroom at shower na may custom na tile",
    "Custom na tile na shower, pader at enclosure bilang bahagi ng buong renobasyon ng master bathroom."
   ]
  },
  "fq.general_contracting.bathroom.tile_finishing": {
   "pa": [
    "ਬਾਥਰੂਮ ਅਤੇ ਸ਼ਾਵਰ ਲਈ ਟਾਈਲ ਲਾਉਣਾ ਅਤੇ ਮੁਕੰਮਲ ਕਰਨਾ",
    "ਫ਼ਰਸ਼, ਸ਼ਾਵਰ ਦੀਆਂ ਕੰਧਾਂ ਅਤੇ ਆਲੇ ਦੀਆਂ ਟਾਈਲਾਂ ਲਾ ਕੇ, ਗ੍ਰਾਊਟ ਭਰ ਕੇ ਸੀਲ ਕੀਤੀਆਂ ਜਾਂਦੀਆਂ ਹਨ।"
   ]
  },
  "fq.general_contracting.bathroom.tile_shower_assembly": {
   "it": [
    "Posa piastrelle e montaggio sistema doccia",
    "Piatto doccia posato, pareti piastrellate e sistema doccia assemblato e collegato."
   ],
   "de": [
    "Fliesenverlegung und Duschsystemmontage",
    "Duschwanne gesetzt, Wände gefliest und das Duschsystem montiert und angeschlossen."
   ],
   "uk": [
    "Укладання плитки та збирання душової системи",
    "Піддон встановлено, стіни обкладено плиткою, душову систему зібрано й під'єднано."
   ],
   "pa": [
    "ਟਾਈਲ ਲਾਉਣਾ ਅਤੇ ਸ਼ਾਵਰ ਸਿਸਟਮ ਜੋੜਨਾ",
    "ਸ਼ਾਵਰ ਪੈਨ ਰੱਖਿਆ, ਕੰਧਾਂ 'ਤੇ ਟਾਈਲ ਅਤੇ ਸ਼ਾਵਰ ਸਿਸਟਮ ਜੋੜ ਕੇ ਕਨੈਕਟ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkakabit ng tile at pag-assemble ng shower system",
    "Inilagay ang shower pan, tinilean ang pader at binuo at ikinonekta ang shower system."
   ]
  },
  "fq.general_contracting.concrete_masonry.block_fence": {
   "it": [
    "Muratura in blocchi e costruzione recinzioni",
    "Muri in blocchi per recinzione, cancello o muro portante, su fondazione, armati e riempiti."
   ],
   "de": [
    "Blocksteinmauern und Zaunbau",
    "Blocksteinmauern für Zaun, Tor oder tragende Wand auf Fundament gesetzt, bewehrt und verfüllt."
   ],
   "uk": [
    "Кладка з блоків і будівництво огорож",
    "Стіни з блоків для огорожі, воріт чи несучої стіни на фундаменті, армовані й заповнені."
   ],
   "pa": [
    "ਕੰਕਰੀਟ ਬਲਾਕ ਲਾਉਣਾ ਅਤੇ ਵਾੜ ਬਣਾਉਣਾ",
    "ਵਾੜ, ਗੇਟ ਜਾਂ ਢਾਂਚਾਗਤ ਕੰਧ ਲਈ ਨੀਂਹ 'ਤੇ ਬਲਾਕ ਦੀਆਂ ਕੰਧਾਂ, ਸਰੀਏ ਅਤੇ ਗ੍ਰਾਊਟ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit ng concrete block at paggawa ng bakod",
    "Pader na block para sa bakod, gate o estruktural na pader, sa pundasyon, may bakal at grout."
   ]
  },
  "fq.general_contracting.concrete_masonry.driveway_patio_curb": {
   "it": [
    "Vialetti, patii e cordoli in calcestruzzo",
    "Calcestruzzo casserato, gettato e rifinito per vialetto, patio o cordolo, con giunti di controllo tagliati."
   ],
   "de": [
    "Betoneinfahrt, Terrasse und Randsteine",
    "Beton geschalt, gegossen und abgezogen für Einfahrt, Terrasse oder Bordstein, mit geschnittenen Dehnfugen."
   ],
   "uk": [
    "Бетонні під'їзди, патіо та бордюри",
    "Бетон в опалубці залито й оброблено для під'їзду, патіо чи бордюру, з нарізаними деформаційними швами."
   ],
   "pa": [
    "ਕੰਕਰੀਟ ਡਰਾਈਵਵੇ, ਵੇਹੜਾ ਅਤੇ ਕਰਬ",
    "ਡਰਾਈਵਵੇ, ਵੇਹੜੇ ਜਾਂ ਕਰਬ ਲਈ ਕੰਕਰੀਟ ਦਾ ਸਾਂਚਾ, ਢਲਾਈ ਅਤੇ ਫ਼ਿਨਿਸ਼, ਕੰਟਰੋਲ ਜੋੜ ਕੱਟ ਕੇ।"
   ],
   "tl": [
    "Kongkretong driveway, patio at gilid",
    "Hinulma, ibinuhos at tinapos ang kongkreto para sa driveway, patio o gilid, may hiwang control joint."
   ]
  },
  "fq.general_contracting.concrete_masonry.foundation_slab": {
   "it": [
    "Fondazioni e platee in calcestruzzo, posa e demolizione",
    "Plinti, platee e pilastri casserati e gettati, con demolizione e preparazione dove si toglie il vecchio calcestruzzo."
   ],
   "de": [
    "Betonfundamente und Bodenplatten, Neubau und Abbruch",
    "Fundamentplatten, Sohlen und Pfeiler geschalt und gegossen, mit Abbruch und Vorbereitung, wo alter Beton weicht."
   ],
   "uk": [
    "Бетонні фундаменти й плити: влаштування та демонтаж",
    "Фундаментні подушки, плити й опори в опалубці залито, з демонтажем і підготовкою там, де прибирають старий бетон."
   ],
   "pa": [
    "ਕੰਕਰੀਟ ਨੀਂਹ ਅਤੇ ਸਲੈਬ ਲਾਉਣਾ ਅਤੇ ਢਾਹੁਣਾ",
    "ਨੀਂਹ ਦੇ ਪੈਡ, ਸਲੈਬ ਅਤੇ ਥੰਮ੍ਹ ਸਾਂਚੇ ਵਿੱਚ ਢਾਲੇ, ਜਿੱਥੇ ਪੁਰਾਣੀ ਕੰਕਰੀਟ ਨਿਕਲਦੀ ਹੈ ਉੱਥੇ ਢਾਹੁਣ ਅਤੇ ਤਿਆਰੀ ਸਮੇਤ।"
   ],
   "tl": [
    "Pundasyon at slab na kongkreto, pagkakabit at demolisyon",
    "Hinulma at ibinuhos ang pad, slab at pier ng pundasyon, may demolisyon at paghahanda kung saan inaalis ang lumang kongkreto."
   ]
  },
  "fq.general_contracting.concrete_masonry.leveling": {
   "it": [
    "Livellamento e sollevamento del calcestruzzo",
    "Lastre di vialetti, camminamenti o patii ribassate sollevate e livellate per iniezione invece di rifarle."
   ],
   "de": [
    "Betonnivellierung und -anhebung",
    "Abgesackte Platten von Einfahrt, Weg oder Terrasse per Injektion angehoben und nivelliert statt ersetzt."
   ],
   "uk": [
    "Вирівнювання та підйом бетону",
    "Просілі плити під'їзду, доріжки чи патіо піднято й вирівняно ін'єкцією замість заміни."
   ],
   "pa": [
    "ਕੰਕਰੀਟ ਨੂੰ ਪੱਧਰਾ ਕਰਨਾ ਅਤੇ ਚੁੱਕਣਾ",
    "ਧੱਸੀਆਂ ਡਰਾਈਵਵੇ, ਰਸਤੇ ਜਾਂ ਵੇਹੜੇ ਦੀਆਂ ਸਲੈਬਾਂ ਬਦਲਣ ਦੀ ਥਾਂ ਇੰਜੈਕਸ਼ਨ ਨਾਲ ਚੁੱਕ ਕੇ ਪੱਧਰੀਆਂ।"
   ],
   "tl": [
    "Pagpapantay at pag-angat ng kongkreto",
    "Inangat at pinantay sa injection ang lumubog na slab ng driveway, daanan o patio sa halip na palitan."
   ]
  },
  "fq.general_contracting.concrete_masonry.crack_repair": {
   "pa": [
    "ਨੀਂਹ ਅਤੇ ਕੰਕਰੀਟ ਦੀਆਂ ਤਰੇੜਾਂ ਦੀ ਮੁਰੰਮਤ",
    "ਤਰੇੜਾਂ ਵਿੱਚ ਇੰਜੈਕਸ਼ਨ, ਪੈਚ ਅਤੇ ਸੀਲ ਕੀਤੀ ਜਾਂਦੀ ਹੈ ਤਾਂ ਜੋ ਪਾਣੀ ਅਤੇ ਹੋਰ ਹਿਲਜੁਲ ਰੁਕੇ।"
   ]
  },
  "fq.general_contracting.concrete_masonry.masonry_stabilization": {
   "it": [
    "Riparazione e consolidamento di fondazioni e murature esterne",
    "Calcestruzzo rotto rimosso, giunti ristilati e crepe stabilizzate su fondazioni e murature esterne."
   ],
   "de": [
    "Reparatur und Stabilisierung von Fundament und Außenmauerwerk",
    "Gebrochener Beton herausgeschnitten, Fugen neu verfugt und Risse an Fundament und Außenmauerwerk stabilisiert."
   ],
   "uk": [
    "Ремонт і стабілізація фундаменту та зовнішньої кладки",
    "Зруйнований бетон вирізано, шви перешито, тріщини у фундаменті й зовнішній кладці стабілізовано."
   ],
   "pa": [
    "ਨੀਂਹ ਅਤੇ ਬਾਹਰੀ ਚਿਣਾਈ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਮਜ਼ਬੂਤੀ",
    "ਟੁੱਟੀ ਕੰਕਰੀਟ ਕੱਟੀ, ਜੋੜਾਂ ਵਿੱਚ ਨਵਾਂ ਮਸਾਲਾ ਅਤੇ ਨੀਂਹ ਅਤੇ ਬਾਹਰੀ ਚਿਣਾਈ ਦੀਆਂ ਤਰੇੜਾਂ ਸਥਿਰ ਕੀਤੀਆਂ ਜਾਂਦੀਆਂ ਹਨ।"
   ],
   "tl": [
    "Pagkukumpuni at pagpapatibay ng pundasyon at masonry sa labas",
    "Inalis ang sirang kongkreto, nire-tuckpoint ang dugtungan at pinatatag ang bitak sa pundasyon at masonry."
   ]
  },
  "fq.general_contracting.concrete_masonry.piers_helical": {
   "it": [
    "Micropali e pali elicoidali per fondazioni",
    "Pali elicoidali o micropali in acciaio infissi per sostenere e sollevare una fondazione che cede, scavo incluso."
   ],
   "de": [
    "Fundamentpfeiler und Schraubpfähle",
    "Schraubpfähle oder Stahlpfeiler eingebracht, um ein setzendes Fundament zu stützen und anzuheben, Aushub inklusive."
   ],
   "uk": [
    "Опори та гвинтові палі для фундаменту",
    "Гвинтові палі чи сталеві опори занурено, щоб підтримати й підняти осідаючий фундамент, земляні роботи включено."
   ],
   "pa": [
    "ਨੀਂਹ ਦੇ ਥੰਮ੍ਹ ਅਤੇ ਹੈਲੀਕਲ ਪਾਈਲ",
    "ਧੱਸਦੀ ਨੀਂਹ ਨੂੰ ਸਹਾਰਾ ਦੇਣ ਅਤੇ ਚੁੱਕਣ ਲਈ ਹੈਲੀਕਲ ਪਾਈਲ ਜਾਂ ਸਟੀਲ ਥੰਮ੍ਹ ਗੱਡੇ ਜਾਂਦੇ ਹਨ, ਖੁਦਾਈ ਸਮੇਤ।"
   ],
   "tl": [
    "Pier at helical pile ng pundasyon",
    "Ibinaon ang helical pile o bakal na pier para suportahan at iangat ang lumulubog na pundasyon, kasama ang paghuhukay."
   ]
  },
  "fq.general_contracting.concrete_masonry.pavers_asphalt": {
   "it": [
    "Autobloccanti e asfalto: posa e ripristino",
    "Superfici in autobloccanti e asfalto posate, riparate o ripristinate, sottofondo e bordure inclusi."
   ],
   "de": [
    "Pflaster und Asphalt: Verlegung und Instandsetzung",
    "Pflaster- und Asphaltflächen verlegt, repariert oder instand gesetzt, Unterbau und Einfassung inklusive."
   ],
   "uk": [
    "Бруківка та асфальт: укладання й відновлення",
    "Поверхні з бруківки й асфальту укладено, відремонтовано чи відновлено, основа й бордюри включені."
   ],
   "pa": [
    "ਹਾਰਡਸਕੇਪ ਪੇਵਰ ਅਤੇ ਅਸਫ਼ਾਲਟ ਲਾਉਣਾ ਅਤੇ ਬਹਾਲੀ",
    "ਕੰਕਰੀਟ ਪੇਵਰ ਅਤੇ ਅਸਫ਼ਾਲਟ ਸਤਹਾਂ ਲਾਈਆਂ, ਠੀਕ ਜਾਂ ਬਹਾਲ ਕੀਤੀਆਂ ਜਾਂਦੀਆਂ ਹਨ, ਬੇਸ ਅਤੇ ਕਿਨਾਰੀ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit at restorasyon ng paver at aspalto",
    "Inilatag, inayos o ibinalik ang paver at aspalto, kasama ang base at edging."
   ]
  },
  "fq.general_contracting.concrete_masonry.vinyl_metal_fence": {
   "it": [
    "Installazione recinzioni in vinile e metallo",
    "Pannelli e cancelli in vinile, PVC, alluminio o acciaio forniti e montati su pali fissati."
   ],
   "de": [
    "Montage von Vinyl- und Metallzäunen",
    "Zaunfelder und Tore aus Vinyl, PVC, Aluminium oder Stahl geliefert und an gesetzten Pfosten montiert."
   ],
   "uk": [
    "Монтаж вінілових і металевих парканів",
    "Панелі й хвіртки з вінілу, ПВХ, алюмінію чи сталі постачено й змонтовано на встановлених стовпах."
   ],
   "pa": [
    "ਵਿਨਾਇਲ ਅਤੇ ਧਾਤ ਦੀ ਵਾੜ ਲਾਉਣਾ",
    "ਵਿਨਾਇਲ, PVC, ਐਲੂਮੀਨੀਅਮ ਜਾਂ ਸਟੀਲ ਦੇ ਪੈਨਲ ਅਤੇ ਗੇਟ ਗੱਡੇ ਥੰਮ੍ਹਾਂ 'ਤੇ ਦੇ ਕੇ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit ng bakod na vinyl at metal",
    "Nagbigay at ikinabit ang panel at gate na vinyl, PVC, aluminyo o bakal sa nakabaong poste."
   ]
  },
  "fq.general_contracting.concrete_masonry.truss_anchors_rebar": {
   "it": [
    "Ancoraggi per capriate in acciaio e armature",
    "Acciaio strutturale — ancoraggi per capriate, tirafondi e barre d'armatura — fornito e posato prima del getto."
   ],
   "de": [
    "Stahl-Binderanker und Bewehrung",
    "Baustahl — Binderanker, J-Bolzen und Bewehrungsstahl — vor dem Betonieren geliefert und gesetzt."
   ],
   "uk": [
    "Сталеві анкери для ферм і арматура",
    "Конструкційну сталь — анкери ферм, J-болти й арматуру — постачено й встановлено до заливки."
   ],
   "pa": [
    "ਸਟੀਲ ਟ੍ਰੱਸ ਐਂਕਰ ਅਤੇ ਸਰੀਆ",
    "ਢਾਂਚਾਗਤ ਸਟੀਲ — ਟ੍ਰੱਸ ਐਂਕਰ, J-ਬੋਲਟ ਅਤੇ ਸਰੀਆ — ਢਲਾਈ ਤੋਂ ਪਹਿਲਾਂ ਦੇ ਕੇ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Bakal na truss anchor at rebar",
    "Nagbigay at ikinabit bago magbuhos ang estruktural na bakal — truss anchor, J-bolt at rebar."
   ]
  },
  "fq.general_contracting.concrete_masonry.structural_framing_foundation": {
   "it": [
    "Struttura portante, livellamento e riparazione fondazioni",
    "Struttura riparata, solai livellati e pilastri posati dove la fondazione si è mossa."
   ],
   "de": [
    "Tragwerk, Nivellierung und Fundamentreparatur",
    "Tragwerk repariert, Böden nivelliert und Pfeiler gesetzt, wo sich das Fundament bewegt hat."
   ],
   "uk": [
    "Несучий каркас, вирівнювання та ремонт фундаменту",
    "Каркас відремонтовано, підлоги вирівняно, опори встановлено там, де фундамент зрушився."
   ],
   "pa": [
    "ਢਾਂਚਾਗਤ ਫ਼ਰੇਮਿੰਗ, ਪੱਧਰ ਅਤੇ ਨੀਂਹ ਦੀ ਮੁਰੰਮਤ",
    "ਫ਼ਰੇਮਿੰਗ ਠੀਕ, ਫ਼ਰਸ਼ ਪੱਧਰੇ ਅਤੇ ਜਿੱਥੇ ਨੀਂਹ ਹਿੱਲੀ ਹੈ ਉੱਥੇ ਥੰਮ੍ਹ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Estruktural na framing, pagpapantay at pagkukumpuni ng pundasyon",
    "Inayos ang framing, pinantay ang sahig at naglagay ng pier kung saan gumalaw ang pundasyon."
   ]
  },
  "fq.general_contracting.site_prep.demolition": {
   "it": [
    "Demolizione e preparazione del cantiere",
    "Strutture abbattute, macerie rimosse e cantiere pronto per la costruzione."
   ],
   "de": [
    "Abbruch und Baustellenvorbereitung",
    "Bauten abgerissen, Schutt entfernt und die Baustelle für den Neubau vorbereitet."
   ],
   "uk": [
    "Демонтаж і підготовка ділянки",
    "Споруди знесено, будівельне сміття вивезено, ділянку підготовлено до будівництва."
   ],
   "pa": [
    "ਢਾਹੁਣਾ ਅਤੇ ਥਾਂ ਦੀ ਤਿਆਰੀ",
    "ਢਾਂਚੇ ਢਾਹੇ, ਮਲਬਾ ਹਟਾਇਆ ਅਤੇ ਥਾਂ ਉਸਾਰੀ ਲਈ ਤਿਆਰ ਕੀਤੀ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Demolisyon at paghahanda ng lugar",
    "Giniba ang estruktura, inalis ang debris at inihanda ang lugar para sa pagtatayo."
   ]
  },
  "fq.general_contracting.site_prep.excavation_grading": {
   "it": [
    "Scavo e livellamento per vialetti e giardini",
    "Terreno scavato, riportato e livellato per il drenaggio, pronto per il sottofondo del vialetto o il giardino."
   ],
   "de": [
    "Aushub und Planierung für Einfahrt und Garten",
    "Boden abgetragen, aufgefüllt und mit Gefälle planiert, bereit für den Einfahrtsunterbau oder die Gartengestaltung."
   ],
   "uk": [
    "Земляні роботи та планування під під'їзд і ландшафт",
    "Ґрунт вибрано, підсипано й сплановано під стік, готово під основу під'їзду чи озеленення."
   ],
   "pa": [
    "ਡਰਾਈਵਵੇ ਅਤੇ ਬਗ਼ੀਚੇ ਲਈ ਖੁਦਾਈ ਅਤੇ ਪੱਧਰ",
    "ਜ਼ਮੀਨ ਕੱਟੀ, ਭਰੀ ਅਤੇ ਨਿਕਾਸ ਲਈ ਢਲਾਣ ਦਿੱਤੀ, ਡਰਾਈਵਵੇ ਬੇਸ ਜਾਂ ਬਗ਼ੀਚੇ ਲਈ ਤਿਆਰ।"
   ],
   "tl": [
    "Paghuhukay at grading para sa driveway at landscaping",
    "Hinukay, tinambakan at ini-grade ang lupa para dumaloy ang tubig, handa para sa base ng driveway o landscaping."
   ]
  },
  "fq.general_contracting.site_prep.final_cleanup": {
   "it": [
    "Pulizia finale e sopralluogo di fine lavori",
    "Cantiere pulito, macerie rimosse e sopralluogo con il proprietario prima della consegna."
   ],
   "de": [
    "Endreinigung und Abnahmebegehung",
    "Baustelle gereinigt, Schutt entfernt und vor der Übergabe mit dem Eigentümer begangen."
   ],
   "uk": [
    "Фінальне прибирання й огляд після будівництва",
    "Ділянку прибрано, сміття вивезено, огляд із власником перед передачею."
   ],
   "pa": [
    "ਆਖ਼ਰੀ ਸਫ਼ਾਈ ਅਤੇ ਉਸਾਰੀ ਤੋਂ ਬਾਅਦ ਦਾ ਚੱਕਰ",
    "ਥਾਂ ਸਾਫ਼, ਮਲਬਾ ਹਟਾਇਆ ਅਤੇ ਸੌਂਪਣ ਤੋਂ ਪਹਿਲਾਂ ਮਾਲਕ ਨਾਲ ਚੱਕਰ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Huling paglilinis at walkthrough pagkatapos ng konstruksyon",
    "Nilinis ang lugar, inalis ang debris at nilibot kasama ang may-ari bago iabot."
   ]
  },
  "fq.general_contracting.site_prep.debris_hauling": {
   "it": [
    "Rimozione e trasporto macerie di cantiere",
    "Rifiuti di cantiere caricati, trasportati e smaltiti, costi di discarica inclusi."
   ],
   "de": [
    "Bauschuttentsorgung und Abtransport",
    "Bauabfälle verladen, abtransportiert und entsorgt, Deponiegebühren inklusive."
   ],
   "uk": [
    "Вивезення будівельного сміття",
    "Будівельні відходи завантажено, вивезено й утилізовано, плату за полігон включено."
   ],
   "pa": [
    "ਉਸਾਰੀ ਦਾ ਮਲਬਾ ਹਟਾਉਣਾ ਅਤੇ ਢੋਆਈ",
    "ਉਸਾਰੀ ਦਾ ਕੂੜਾ ਲੱਦ ਕੇ ਲਿਜਾਇਆ ਅਤੇ ਨਿਪਟਾਇਆ ਜਾਂਦਾ ਹੈ, ਡੰਪ ਫ਼ੀਸ ਸਮੇਤ।"
   ],
   "tl": [
    "Pag-aalis at paghakot ng debris ng konstruksyon",
    "Ikinarga, hinakot at itinapon ang basura ng konstruksyon, kasama ang bayad sa tapunan."
   ]
  },
  "fq.general_contracting.electrical.panel_upgrade": {
   "it": [
    "Aggiornamento quadro elettrico e interruttori",
    "Quadro aggiornato con nuovi interruttori e protezione da sovratensioni, da un elettricista abilitato nel cantiere del GC."
   ],
   "de": [
    "Verteilererneuerung und Sicherungseinbau",
    "Der Verteiler mit neuen Leitungsschutzschaltern und Überspannungsschutz erneuert, durch einen zugelassenen Elektriker auf der Baustelle."
   ],
   "uk": [
    "Модернізація електрощита та автоматів",
    "Щит оновлено новими автоматами й захистом від перенапруги, силами ліцензованого електрика на об'єкті."
   ],
   "pa": [
    "ਬਿਜਲੀ ਪੈਨਲ ਅੱਪਗ੍ਰੇਡ ਅਤੇ ਬ੍ਰੇਕਰ ਲਾਉਣਾ",
    "ਲਾਇਸੈਂਸਸ਼ੁਦਾ ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ ਵੱਲੋਂ ਨਵੇਂ ਬ੍ਰੇਕਰਾਂ ਅਤੇ ਸਰਜ ਸੁਰੱਖਿਆ ਨਾਲ ਪੈਨਲ ਅੱਪਗ੍ਰੇਡ।"
   ],
   "tl": [
    "Pag-upgrade ng panel at pagkakabit ng breaker",
    "In-upgrade ang panel na may bagong breaker at surge protection, ng lisensyadong elektrisyan sa proyekto."
   ]
  },
  "fq.general_contracting.electrical.wiring_fixtures_fans": {
   "it": [
    "Cablaggi, punti luce e ventilatori a soffitto",
    "Cavi posati, collegamenti eseguiti e lampade e ventilatori a soffitto montati durante la ristrutturazione."
   ],
   "de": [
    "Verkabelung, Leuchten und Deckenventilatoren",
    "Leitungen verlegt, Anschlüsse gemacht und Leuchten sowie Deckenventilatoren im Zuge der Renovierung montiert."
   ],
   "uk": [
    "Проводка, світильники та стельові вентилятори",
    "Проводку прокладено, з'єднання виконано, світильники й стельові вентилятори встановлено під час ремонту."
   ],
   "pa": [
    "ਬਿਜਲੀ ਵਾਇਰਿੰਗ, ਫ਼ਿਕਸਚਰ ਅਤੇ ਛੱਤ ਦੇ ਪੱਖੇ",
    "ਨਵੀਨੀਕਰਨ ਦੌਰਾਨ ਤਾਰਾਂ ਵਿਛਾਈਆਂ, ਜੋੜ ਬਣਾਏ ਅਤੇ ਲਾਈਟਾਂ ਅਤੇ ਛੱਤ ਦੇ ਪੱਖੇ ਟੰਗੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Wiring, fixture at ceiling fan",
    "Inilatag ang wiring, ikinonekta at ikinabit ang ilaw at ceiling fan bilang bahagi ng renobasyon."
   ]
  },
  "fq.general_contracting.electrical.dehumidifier_controls": {
   "it": [
    "Deumidificatore centralizzato e comandi HVAC",
    "Deumidificatore per tutta la casa installato su linea dedicata con termostato e comandi necessari."
   ],
   "de": [
    "Zentraler Luftentfeuchter und HLK-Steuerung",
    "Ein Luftentfeuchter für das ganze Haus auf eigenem Stromkreis installiert, mit Thermostat und Steuerung."
   ],
   "uk": [
    "Осушувач для всього будинку та керування HVAC",
    "Осушувач для всього будинку встановлено на окрему лінію з потрібним термостатом і керуванням."
   ],
   "pa": [
    "ਪੂਰੇ ਘਰ ਦਾ ਡੀਹਿਊਮਿਡੀਫ਼ਾਇਰ ਅਤੇ HVAC ਕੰਟਰੋਲ",
    "ਪੂਰੇ ਘਰ ਦਾ ਡੀਹਿਊਮਿਡੀਫ਼ਾਇਰ ਆਪਣੇ ਸਰਕਟ 'ਤੇ ਲੋੜੀਂਦੇ ਥਰਮੋਸਟੈਟ ਅਤੇ ਕੰਟਰੋਲਾਂ ਸਮੇਤ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Whole-home dehumidifier at kontrol ng HVAC",
    "Ikinabit ang dehumidifier para sa buong bahay sa sariling circuit kasama ang thermostat at kontrol."
   ]
  },
  "fq.general_contracting.electrical.holiday_lighting": {
   "it": [
    "Installazione luci natalizie",
    "Luci LED, ghirlande e corone appese alla casa per la stagione e tolte al termine."
   ],
   "de": [
    "Montage der Festtagsbeleuchtung",
    "LED-Lichter, Girlanden und Kränze für die Saison am Haus angebracht und danach wieder abgenommen."
   ],
   "uk": [
    "Монтаж святкового освітлення",
    "LED-гірлянди й вінки розвішано на будинку на сезон і знято після нього."
   ],
   "pa": [
    "ਤਿਉਹਾਰੀ ਲਾਈਟਾਂ ਲਾਉਣਾ",
    "ਮੌਸਮ ਲਈ ਘਰ 'ਤੇ LED ਲਾਈਟਾਂ, ਹਾਰ ਅਤੇ ਰੀਥ ਟੰਗੇ ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਉਤਾਰੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit ng pailaw sa holiday",
    "Isinabit sa bahay ang LED na ilaw, garland at wreath para sa season at ibinaba pagkatapos."
   ]
  },
  "fq.general_contracting.electrical.lighting_fixtures": {
   "it": [
    "Corpi illuminanti residenziali e componenti",
    "Lampade, kit e componenti elettrici necessari forniti e installati."
   ],
   "de": [
    "Wohnraumleuchten und Komponenten",
    "Leuchten, Sets und die nötigen Elektroteile geliefert und montiert."
   ],
   "uk": [
    "Побутові світильники та комплектуючі",
    "Світильники, комплекти та потрібні електродеталі постачено й встановлено."
   ],
   "pa": [
    "ਘਰੇਲੂ ਲਾਈਟ ਫ਼ਿਕਸਚਰ ਅਤੇ ਪੁਰਜ਼ੇ",
    "ਲਾਈਟ ਫ਼ਿਕਸਚਰ, ਕਿੱਟਾਂ ਅਤੇ ਲੋੜੀਂਦੇ ਬਿਜਲੀ ਪੁਰਜ਼ੇ ਦੇ ਕੇ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Ilaw sa bahay at mga piyesa",
    "Nagbigay at ikinabit ang ilaw, kit at mga piyesang elektrikal na kailangan."
   ]
  },
  "fq.general_contracting.electrical.smoke_co_detectors": {
   "it": [
    "Rilevatori di fumo e monossido di carbonio",
    "Rilevatori forniti e installati dove la normativa li richiede, testati prima di partire."
   ],
   "de": [
    "Rauch- und Kohlenmonoxidmelder",
    "Melder geliefert und dort montiert, wo die Vorschriften sie verlangen, vor dem Gehen geprüft."
   ],
   "uk": [
    "Датчики диму та чадного газу",
    "Датчики постачено й встановлено там, де вимагають норми, перевірено перед від'їздом."
   ],
   "pa": [
    "ਧੂੰਏਂ ਅਤੇ ਕਾਰਬਨ ਮੋਨੋਆਕਸਾਈਡ ਦੇ ਡਿਟੈਕਟਰ",
    "ਜਿੱਥੇ ਨਿਯਮ ਮੰਗਦੇ ਹਨ ਉੱਥੇ ਡਿਟੈਕਟਰ ਦੇ ਕੇ ਲਾਏ ਅਤੇ ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਜਾਂਚੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Smoke at carbon monoxide detector",
    "Nagbigay at ikinabit ang detector kung saan hinihingi ng code, sinubukan bago umalis."
   ]
  },
  "fq.general_contracting.outdoor.structures_patio_covers": {
   "it": [
    "Strutture esterne e coperture per patio",
    "Pergole, coperture per patio e strutture simili costruite su plinti e rifinite."
   ],
   "de": [
    "Außenbauten und Terrassenüberdachungen",
    "Pergolen, Terrassenüberdachungen und ähnliche Außenbauten auf Fundamenten errichtet und fertiggestellt."
   ],
   "uk": [
    "Зовнішні споруди та навіси для патіо",
    "Перголи, навіси для патіо й подібні споруди зведено на фундаментах і оздоблено."
   ],
   "pa": [
    "ਬਾਹਰੀ ਢਾਂਚੇ ਅਤੇ ਵੇਹੜੇ ਦੀਆਂ ਛੱਤਾਂ",
    "ਪਰਗੋਲੇ, ਵੇਹੜੇ ਦੀਆਂ ਛੱਤਾਂ ਅਤੇ ਅਜਿਹੇ ਬਾਹਰੀ ਢਾਂਚੇ ਨੀਂਹਾਂ 'ਤੇ ਬਣਾ ਕੇ ਮੁਕੰਮਲ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Estruktura sa labas at bubong ng patio",
    "Itinayo sa pundasyon at tinapos ang pergola, bubong ng patio at katulad na estruktura."
   ]
  },
  "fq.general_contracting.flooring.attic_insulation_removal": {
   "it": [
    "Rimozione isolamento dal sottotetto e pulizia",
    "Vecchio isolamento sfuso o in pannelli aspirato dal sottotetto con i detriti, insaccato e smaltito."
   ],
   "de": [
    "Entfernung alter Dachbodendämmung und Reinigung",
    "Alte Einblas- oder Mattendämmung samt Schmutz vom Dachboden abgesaugt, eingesackt und entsorgt."
   ],
   "uk": [
    "Видалення утеплювача з горища та прибирання",
    "Старий насипний чи матовий утеплювач висмоктано з горища разом зі сміттям, запаковано й утилізовано."
   ],
   "pa": [
    "ਅਟਾਰੀ ਦੀ ਇੰਸੂਲੇਸ਼ਨ ਹਟਾਉਣਾ ਅਤੇ ਸਫ਼ਾਈ",
    "ਪੁਰਾਣੀ ਉਡਾਈ ਜਾਂ ਬੈਟ ਇੰਸੂਲੇਸ਼ਨ ਕੂੜੇ ਸਮੇਤ ਅਟਾਰੀ 'ਚੋਂ ਵੈਕਿਊਮ, ਬੈਗਾਂ ਵਿੱਚ ਪਾ ਕੇ ਨਿਪਟਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Pag-alis ng insulasyon sa attic at paglilinis",
    "Hinigop mula sa attic ang lumang blown o batt na insulasyon kasama ang dumi, isinako at itinapon."
   ]
  },
  "fq.general_contracting.flooring.carpet_subfloor": {
   "it": [
    "Posa moquette e preparazione del sottofondo",
    "Vecchia moquette rimossa, sottofondo preparato e nuova moquette con sottostrato posata."
   ],
   "de": [
    "Teppichverlegung und Unterbodenvorbereitung",
    "Alter Teppich entfernt, Unterboden vorbereitet und neuer Teppich mit Unterlage verlegt."
   ],
   "uk": [
    "Укладання ковроліну та підготовка основи",
    "Старий ковролін знято, основу підготовлено, новий ковролін із підкладкою укладено."
   ],
   "pa": [
    "ਕਾਰਪੈੱਟ ਲਾਉਣਾ ਅਤੇ ਸਬਫ਼ਲੋਰ ਦੀ ਤਿਆਰੀ",
    "ਪੁਰਾਣਾ ਕਾਰਪੈੱਟ ਹਟਾਇਆ, ਸਬਫ਼ਲੋਰ ਤਿਆਰ ਅਤੇ ਨਵਾਂ ਕਾਰਪੈੱਟ ਅਤੇ ਪੈਡ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkakabit ng karpet at paghahanda ng subfloor",
    "Inalis ang lumang karpet, inihanda ang subfloor at ikinabit ang bagong karpet at pad."
   ]
  },
  "fq.general_contracting.flooring.carpet_hardwood": {
   "it": [
    "Posa e riparazione moquette e parquet",
    "Moquette, parquet e sottostrato forniti e posati o riparati, profili e battiscopa inclusi."
   ],
   "de": [
    "Teppich- und Parkettverlegung und -reparatur",
    "Teppich, Parkett und Unterlage geliefert und verlegt oder repariert, Übergänge und Leisten inklusive."
   ],
   "uk": [
    "Укладання та ремонт ковроліну й паркету",
    "Ковролін, паркет і підкладку постачено й укладено чи відремонтовано, пороги й плінтуси включено."
   ],
   "pa": [
    "ਕਾਰਪੈੱਟ ਅਤੇ ਹਾਰਡਵੁੱਡ ਫ਼ਰਸ਼ ਲਾਉਣਾ ਅਤੇ ਮੁਰੰਮਤ",
    "ਕਾਰਪੈੱਟ, ਹਾਰਡਵੁੱਡ ਅਤੇ ਪੈਡਿੰਗ ਦੇ ਕੇ ਲਾਏ ਜਾਂ ਠੀਕ ਕੀਤੇ ਜਾਂਦੇ ਹਨ, ਟ੍ਰਾਂਜ਼ਿਸ਼ਨ ਅਤੇ ਟ੍ਰਿਮ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit at pagkukumpuni ng karpet at hardwood",
    "Nagbigay at ikinabit o inayos ang karpet, hardwood at padding, kasama ang transition at trim."
   ]
  },
  "fq.general_contracting.flooring.vinyl_laminate_epoxy": {
   "it": [
    "Posa di pavimenti in vinile, laminato e resina",
    "Listoni in vinile, laminato o resina epossidica posati su sottofondo preparato."
   ],
   "de": [
    "Verlegung von Vinyldielen, Laminat und Epoxidböden",
    "Vinyldielen, Laminat oder Epoxidboden auf vorbereitetem Unterboden verlegt."
   ],
   "uk": [
    "Укладання вінілу, ламінату та епоксидної підлоги",
    "Вінілову планку, ламінат чи епоксидну підлогу укладено на підготовлену основу."
   ],
   "pa": [
    "ਵਿਨਾਇਲ ਪਲੈਂਕ, ਲੈਮੀਨੇਟ ਅਤੇ ਐਪੌਕਸੀ ਫ਼ਰਸ਼ ਲਾਉਣਾ",
    "ਤਿਆਰ ਸਬਫ਼ਲੋਰ 'ਤੇ ਵਿਨਾਇਲ ਪਲੈਂਕ, ਲੈਮੀਨੇਟ ਜਾਂ ਐਪੌਕਸੀ ਫ਼ਰਸ਼ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkakabit ng vinyl plank, laminate at epoxy na sahig",
    "Ikinabit ang vinyl plank, laminate o epoxy na sahig sa inihandang subfloor."
   ]
  },
  "fq.general_contracting.flooring.install_repair_refinish": {
   "it": [
    "Posa, riparazione pavimenti e levigatura parquet",
    "Pavimenti posati o riparati, parquet levigato e riverniciato, lavori sul sottofondo se necessari."
   ],
   "de": [
    "Bodenverlegung, Reparatur und Parkettrenovierung",
    "Böden verlegt oder repariert, Parkett geschliffen und neu versiegelt, Unterbodenarbeiten nach Bedarf."
   ],
   "uk": [
    "Укладання, ремонт підлоги та реставрація паркету",
    "Підлогу укладено чи відремонтовано, паркет відшліфовано й покрито заново, роботи з основою за потреби."
   ],
   "pa": [
    "ਫ਼ਰਸ਼ ਲਾਉਣਾ, ਮੁਰੰਮਤ ਅਤੇ ਹਾਰਡਵੁੱਡ ਰੀਫ਼ਿਨਿਸ਼",
    "ਫ਼ਰਸ਼ ਲਾਏ ਜਾਂ ਠੀਕ, ਹਾਰਡਵੁੱਡ ਰਗੜ ਕੇ ਮੁੜ ਫ਼ਿਨਿਸ਼, ਲੋੜ ਅਨੁਸਾਰ ਸਬਫ਼ਲੋਰ ਦਾ ਕੰਮ।"
   ],
   "tl": [
    "Pagkakabit, pagkukumpuni ng sahig at refinishing ng hardwood",
    "Ikinabit o inayos ang sahig, liniha at ni-refinish ang hardwood, may trabaho sa subfloor kung kailangan."
   ]
  },
  "fq.general_contracting.flooring.garage_coating_crack": {
   "it": [
    "Rivestimento pavimento garage e riparazione crepe",
    "Crepe riparate e pavimento del garage sigillato con rivestimento poliaspartico o epossidico."
   ],
   "de": [
    "Garagenbodenbeschichtung und Rissreparatur",
    "Risse repariert und der Garagenboden mit Polyaspartik- oder Epoxidbeschichtung versiegelt."
   ],
   "uk": [
    "Покриття підлоги гаража та ремонт тріщин",
    "Тріщини відремонтовано, підлогу гаража покрито полиаспарагіновим чи епоксидним покриттям."
   ],
   "pa": [
    "ਗੈਰਾਜ ਫ਼ਰਸ਼ ਕੋਟਿੰਗ ਅਤੇ ਤਰੇੜਾਂ ਦੀ ਮੁਰੰਮਤ",
    "ਤਰੇੜਾਂ ਠੀਕ ਅਤੇ ਗੈਰਾਜ ਦਾ ਫ਼ਰਸ਼ ਪੌਲੀਐਸਪਾਰਟਿਕ ਜਾਂ ਐਪੌਕਸੀ ਕੋਟਿੰਗ ਨਾਲ ਸੀਲ।"
   ],
   "tl": [
    "Coating ng sahig ng garahe at pagkukumpuni ng bitak",
    "Inayos ang bitak at sinelyuhan ang sahig ng garahe ng polyaspartic o epoxy na coating."
   ]
  },
  "fq.general_contracting.flooring.garage_epoxy_prep": {
   "it": [
    "Rivestimento epossidico garage e preparazione",
    "Soletta levigata e livellata, vecchio rivestimento rimosso e resina applicata nel colore e nelle scaglie scelti."
   ],
   "de": [
    "Epoxidbeschichtung des Garagenbodens mit Vorbereitung",
    "Bodenplatte geschliffen und egalisiert, alte Beschichtung entfernt und Epoxid in gewählter Farbe und Chips aufgetragen."
   ],
   "uk": [
    "Епоксидне покриття гаража з підготовкою",
    "Плиту відшліфовано й вирівняно, старе покриття знято, епоксид нанесено в обраному кольорі з крихтою."
   ],
   "pa": [
    "ਗੈਰਾਜ ਫ਼ਰਸ਼ ਐਪੌਕਸੀ ਕੋਟਿੰਗ ਅਤੇ ਤਿਆਰੀ",
    "ਸਲੈਬ ਘਸਾ ਕੇ ਪੱਧਰੀ, ਪੁਰਾਣੀ ਕੋਟਿੰਗ ਉਤਾਰੀ ਅਤੇ ਤੈਅ ਰੰਗ ਅਤੇ ਫ਼ਲੇਕ ਵਿੱਚ ਐਪੌਕਸੀ ਲਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Epoxy coating ng sahig ng garahe at paghahanda",
    "Giniling at pinantay ang slab, tinanggal ang lumang coating at inilagay ang epoxy sa napiling kulay at flake."
   ]
  },
  "fq.general_contracting.flooring.hardwood_furniture_moving": {
   "it": [
    "Posa parquet con spostamento mobili",
    "Mobili spostati, vecchio pavimento rimosso, sottofondo preparato e parquet posato e rifinito."
   ],
   "de": [
    "Parkettverlegung mit Möbelrücken",
    "Möbel umgestellt, alter Boden entfernt, Unterboden vorbereitet und Parkett verlegt und versiegelt."
   ],
   "uk": [
    "Укладання паркету з перенесенням меблів",
    "Меблі переставлено, стару підлогу знято, основу підготовлено, паркет укладено й оздоблено."
   ],
   "pa": [
    "ਫ਼ਰਨੀਚਰ ਹਿਲਾਉਣ ਸਮੇਤ ਹਾਰਡਵੁੱਡ ਫ਼ਰਸ਼ ਲਾਉਣਾ",
    "ਫ਼ਰਨੀਚਰ ਹਿਲਾਇਆ, ਪੁਰਾਣਾ ਫ਼ਰਸ਼ ਹਟਾਇਆ, ਸਬਫ਼ਲੋਰ ਤਿਆਰ ਅਤੇ ਹਾਰਡਵੁੱਡ ਲਾ ਕੇ ਮੁਕੰਮਲ।"
   ],
   "tl": [
    "Pagkakabit ng hardwood na may paglipat ng muwebles",
    "Inilipat ang muwebles, inalis ang lumang sahig, inihanda ang subfloor at ikinabit at tinapos ang hardwood."
   ]
  },
  "fq.general_contracting.framing.baseboard_finish_repair": {
   "it": [
    "Posa, finitura e riparazione battiscopa",
    "Battiscopa rimossi, posati, stuccati e verniciati, materiali inclusi."
   ],
   "de": [
    "Sockelleisten: Montage, Endbearbeitung und Reparatur",
    "Sockelleisten abgenommen, montiert, gespachtelt und gestrichen, Material inklusive."
   ],
   "uk": [
    "Монтаж, оздоблення та ремонт плінтусів",
    "Плінтуси знято, встановлено, зашпакльовано й пофарбовано, матеріали включено."
   ],
   "pa": [
    "ਬੇਸਬੋਰਡ ਲਾਉਣਾ, ਮੁਕੰਮਲ ਕਰਨਾ ਅਤੇ ਮੁਰੰਮਤ",
    "ਬੇਸਬੋਰਡ ਉਤਾਰੇ, ਲਾਏ, ਭਰੇ ਅਤੇ ਪੇਂਟ ਕੀਤੇ ਜਾਂਦੇ ਹਨ, ਸਮਾਨ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit, finishing at pagkukumpuni ng baseboard",
    "Inalis, ikinabit, pinuno at pininturahan ang baseboard, kasama ang materyales."
   ]
  },
  "fq.general_contracting.framing.deck_with_railing": {
   "it": [
    "Costruzione deck con ringhiera",
    "Deck strutturato, pavimentato e rifinito con scale e ringhiera, finitura esterna applicata."
   ],
   "de": [
    "Deckbau mit Geländer",
    "Ein Deck mit Unterkonstruktion, Belag, Treppe und Geländer gebaut und außen beschichtet."
   ],
   "uk": [
    "Будівництво тераси з поруччям",
    "Терасу змонтовано, настелено й оздоблено зі сходами та поруччям, нанесено зовнішнє покриття."
   ],
   "pa": [
    "ਰੇਲਿੰਗ ਸਮੇਤ ਡੈੱਕ ਬਣਾਉਣਾ",
    "ਡੈੱਕ ਦੀ ਫ਼ਰੇਮਿੰਗ, ਫੱਟੇ, ਪੌੜੀਆਂ ਅਤੇ ਰੇਲਿੰਗ ਬਣਾ ਕੇ ਬਾਹਰੀ ਫ਼ਿਨਿਸ਼ ਲਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Paggawa ng deck na may rehas",
    "Ini-frame, nilatagan at tinapos ang deck na may hagdan at rehas, may panlabas na finish."
   ]
  },
  "fq.general_contracting.framing.finish_carpentry": {
   "it": [
    "Falegnameria di finitura e modanature",
    "Modanature, lavori in legno su misura e falegnameria di finitura interna o esterna, a ore."
   ],
   "de": [
    "Innenausbau und Leistenarbeiten",
    "Leisten, individuelle Holzarbeiten und Tischlerarbeiten innen oder außen, nach Stunden abgerechnet."
   ],
   "uk": [
    "Оздоблювальна столярка та молдинги",
    "Молдинги, столярні роботи на замовлення та оздоблювальна столярка всередині чи зовні, погодинно."
   ],
   "pa": [
    "ਫ਼ਿਨਿਸ਼ ਤਰਖਾਣੀ ਅਤੇ ਟ੍ਰਿਮ ਦਾ ਕੰਮ",
    "ਟ੍ਰਿਮ, ਖ਼ਾਸ ਲੱਕੜ ਦਾ ਕੰਮ ਅਤੇ ਅੰਦਰਲੀ ਜਾਂ ਬਾਹਰਲੀ ਫ਼ਿਨਿਸ਼ ਤਰਖਾਣੀ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ],
   "tl": [
    "Finish carpentry at trim",
    "Trim, custom na gawa sa kahoy at finish carpentry sa loob o labas, sinisingil kada oras."
   ]
  },
  "fq.general_contracting.framing.deck_structure": {
   "it": [
    "Struttura e posa del deck",
    "Struttura del deck, doghe, fasce e gradini realizzati, materiali inclusi."
   ],
   "de": [
    "Deckunterkonstruktion und Montage",
    "Deckunterbau, Belag, Stirnbretter und Stufen gebaut, Material inklusive."
   ],
   "uk": [
    "Каркас і монтаж тераси",
    "Каркас тераси, настил, фронтальні дошки й сходинки зроблено, матеріали включено."
   ],
   "pa": [
    "ਡੈੱਕ ਫ਼ਰੇਮਿੰਗ ਅਤੇ ਲਾਉਣਾ",
    "ਡੈੱਕ ਦੀ ਫ਼ਰੇਮਿੰਗ, ਫੱਟੇ, ਫ਼ੇਸ਼ੀਆ ਬੋਰਡ ਅਤੇ ਪੌੜੀਆਂ ਬਣਾਈਆਂ ਜਾਂਦੀਆਂ ਹਨ, ਸਮਾਨ ਸਮੇਤ।"
   ],
   "tl": [
    "Framing at pagkakabit ng deck",
    "Ginawa ang framing ng deck, sahig, fascia at baitang, kasama ang materyales."
   ]
  },
  "fq.general_contracting.framing.baseboards_trim": {
   "it": [
    "Posa battiscopa e modanature",
    "Battiscopa e modanature forniti, posati e rifiniti."
   ],
   "de": [
    "Montage von Sockelleisten und Zierleisten",
    "Sockel- und Zierleisten geliefert, montiert und fertig bearbeitet."
   ],
   "uk": [
    "Монтаж плінтусів і молдингів",
    "Плінтуси й молдинги постачено, встановлено й оздоблено."
   ],
   "pa": [
    "ਬੇਸਬੋਰਡ ਅਤੇ ਟ੍ਰਿਮ ਲਾਉਣਾ",
    "ਬੇਸਬੋਰਡ ਅਤੇ ਟ੍ਰਿਮ ਦੇ ਕੇ, ਲਾ ਕੇ ਮੁਕੰਮਲ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit ng baseboard at trim",
    "Nagbigay, ikinabit at tinapos ang baseboard at trim."
   ]
  },
  "fq.general_contracting.framing.fencing_gates": {
   "it": [
    "Installazione recinzioni e cancelli",
    "Recinzioni e cancelli a maglie, in ferro ornamentale o legno montati su pali fissati."
   ],
   "de": [
    "Zaun- und Tormontage",
    "Maschendraht-, Schmiedeeisen- oder Holzzäune und Tore an gesetzten Pfosten montiert."
   ],
   "uk": [
    "Монтаж парканів і воріт",
    "Паркани й ворота з рабиці, кованого заліза чи дерева змонтовано на встановлених стовпах."
   ],
   "pa": [
    "ਵਾੜ ਅਤੇ ਗੇਟ ਲਾਉਣਾ",
    "ਚੇਨ-ਲਿੰਕ, ਸਜਾਵਟੀ ਲੋਹੇ ਜਾਂ ਲੱਕੜ ਦੀ ਵਾੜ ਅਤੇ ਗੇਟ ਗੱਡੇ ਥੰਮ੍ਹਾਂ 'ਤੇ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit ng bakod at gate",
    "Ikinabit sa nakabaong poste ang chain-link, ornamental na bakal o kahoy na bakod at gate."
   ]
  },
  "fq.general_contracting.framing.privacy_fence": {
   "it": [
    "Recinzione privacy e posa pali",
    "Buche scavate e pali fissati, e recinzione privacy in legno o composito costruita, materiali e manodopera inclusi."
   ],
   "de": [
    "Sichtschutzzaun und Pfostenmontage",
    "Pfostenlöcher gegraben und Pfosten gesetzt, ein Sichtschutzzaun aus Holz oder WPC gebaut, Material und Arbeit inklusive."
   ],
   "uk": [
    "Приватний паркан і встановлення стовпів",
    "Ями викопано, стовпи встановлено, суцільний паркан із дерева чи композиту збудовано, матеріали й робота включені."
   ],
   "pa": [
    "ਪਰਦਾ ਵਾੜ ਅਤੇ ਥੰਮ੍ਹ ਲਾਉਣਾ",
    "ਥੰਮ੍ਹਾਂ ਲਈ ਟੋਏ ਪੁੱਟੇ ਅਤੇ ਗੱਡੇ, ਲੱਕੜ ਜਾਂ ਕੰਪੋਜ਼ਿਟ ਦੀ ਪਰਦਾ ਵਾੜ ਬਣਾਈ ਜਾਂਦੀ ਹੈ, ਸਮਾਨ ਅਤੇ ਮਜ਼ਦੂਰੀ ਸਮੇਤ।"
   ],
   "tl": [
    "Privacy na bakod at pagkakabit ng poste",
    "Hinukay at itinayo ang poste at ginawa ang kahoy o composite na privacy na bakod, kasama ang materyales at trabaho."
   ]
  },
  "fq.general_contracting.framing.raw_wood_refinishing": {
   "it": [
    "Ripristino del legno grezzo e falegnameria",
    "Legno grezzo o invecchiato restaurato, rifinito e riparato dove serve un intervento di falegnameria."
   ],
   "de": [
    "Aufarbeitung von Rohholz und Tischlerarbeiten",
    "Rohes oder verwittertes Holz restauriert, neu behandelt und wo nötig tischlerisch repariert."
   ],
   "uk": [
    "Відновлення необробленої деревини та столярка",
    "Необроблену чи вивітрену деревину відновлено, оздоблено й відремонтовано там, де потрібна столярка."
   ],
   "pa": [
    "ਕੱਚੀ ਲੱਕੜ ਦੀ ਰੀਫ਼ਿਨਿਸ਼ਿੰਗ ਅਤੇ ਤਰਖਾਣੀ",
    "ਕੱਚੀ ਜਾਂ ਮੌਸਮ ਨਾਲ ਖ਼ਰਾਬ ਲੱਕੜ ਬਹਾਲ, ਰੀਫ਼ਿਨਿਸ਼ ਅਤੇ ਜਿੱਥੇ ਲੋੜ ਹੋਵੇ ਤਰਖਾਣੀ ਨਾਲ ਠੀਕ।"
   ],
   "tl": [
    "Refinishing ng hilaw na kahoy at karpinterya",
    "Ibinalik, ni-refinish at inayos ang hilaw o lumang kahoy kung saan kailangan ng karpinterya."
   ]
  },
  "fq.general_contracting.framing.dock_boards": {
   "it": [
    "Sostituzione tavole del pontile",
    "Tavole del pontile marce o rotte sostituite, manodopera e materiali inclusi."
   ],
   "de": [
    "Austausch von Stegbrettern",
    "Morsche oder gebrochene Stegbretter ersetzt, Arbeit und Material inklusive."
   ],
   "uk": [
    "Заміна дошок причалу",
    "Гнилі чи зламані дошки причалу замінено, робота й матеріали включені."
   ],
   "pa": [
    "ਡੌਕ ਦੇ ਫੱਟੇ ਬਦਲਣਾ",
    "ਸੜੇ ਜਾਂ ਟੁੱਟੇ ਡੌਕ ਫੱਟੇ ਬਦਲੇ ਜਾਂਦੇ ਹਨ, ਮਜ਼ਦੂਰੀ ਅਤੇ ਸਮਾਨ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagpapalit ng tabla ng daungan",
    "Pinalitan ang bulok o sirang tabla ng daungan, kasama ang trabaho at materyales."
   ]
  },
  "fq.general_contracting.framing.electrical_rough_trim": {
   "it": [
    "Impianto elettrico: predisposizione e finitura",
    "Cavi predisposti durante la costruzione della struttura e frutti e lampade montati in finitura, materiali inclusi."
   ],
   "de": [
    "Elektro-Rohinstallation und Endmontage",
    "Leitungen während des Rahmenbaus vorinstalliert und Schalter, Dosen und Leuchten bei der Fertigstellung montiert, Material inklusive."
   ],
   "uk": [
    "Прокладання та чистовий монтаж електрики",
    "Проводку прокладено під час каркасних робіт, прилади й світильники встановлено на оздобленні, матеріали включено."
   ],
   "pa": [
    "ਬਿਜਲੀ ਰਫ਼-ਇਨ ਅਤੇ ਟ੍ਰਿਮ-ਆਊਟ",
    "ਫ਼ਰੇਮਿੰਗ ਦੌਰਾਨ ਤਾਰਾਂ ਰਫ਼-ਇਨ ਅਤੇ ਮੁਕੰਮਲ ਹੋਣ 'ਤੇ ਸਵਿੱਚ, ਸਾਕਟ ਅਤੇ ਲਾਈਟਾਂ ਲਾਈਆਂ ਜਾਂਦੀਆਂ ਹਨ, ਸਮਾਨ ਸਮੇਤ।"
   ],
   "tl": [
    "Rough-in at trim-out ng kuryente",
    "Rough-in ng wiring habang nagfa-frame at ikinabit ang device at ilaw sa pagtatapos, kasama ang materyales."
   ]
  },
  "fq.general_contracting.hvac.annual_maintenance": {
   "pa": [
    "ਸਾਲਾਨਾ HVAC ਰੱਖ-ਰਖਾਅ ਅਤੇ ਜਾਂਚ",
    "ਹੀਟਿੰਗ ਅਤੇ ਕੂਲਿੰਗ ਸਾਲ ਵਿੱਚ ਇੱਕ ਵਾਰ ਟਿਊਨ-ਅੱਪ, ਸਾਫ਼ ਅਤੇ ਜਾਂਚੇ ਜਾਂਦੇ ਹਨ।"
   ]
  },
  "fq.general_contracting.hvac.attic_sealing_insulation": {
   "it": [
    "Sigillatura e isolamento del sottotetto",
    "Passaggi nel sottotetto sigillati, condotti e apparecchi sistemati e isolamento portato al livello concordato."
   ],
   "de": [
    "Luftdichtung und Dämmung des Dachbodens",
    "Durchdringungen im Dachboden abgedichtet, Kanäle und Einbauten berücksichtigt und die Dämmung auf das vereinbarte Niveau gebracht."
   ],
   "uk": [
    "Герметизація та утеплення горища",
    "Проходи на горищі загерметизовано, повітроводи й прилади враховано, утеплення доведено до погодженого рівня."
   ],
   "pa": [
    "ਅਟਾਰੀ ਦੀ ਹਵਾ ਸੀਲਿੰਗ ਅਤੇ ਇੰਸੂਲੇਸ਼ਨ",
    "ਅਟਾਰੀ ਦੇ ਛੇਕ ਸੀਲ, ਡਕਟ ਅਤੇ ਫ਼ਿਕਸਚਰ ਠੀਕ ਅਤੇ ਇੰਸੂਲੇਸ਼ਨ ਤੈਅ ਪੱਧਰ ਤੱਕ ਵਧਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Air sealing at insulasyon ng attic",
    "Sinelyuhan ang butas sa attic, inayos ang duct at fixture at itinaas ang insulasyon sa napagkasunduang antas."
   ]
  },
  "fq.general_contracting.hvac.crawlspace": {
   "it": [
    "Ispezione, riparazione e preparazione invernale del vespaio",
    "Vespaio ispezionato, isolamento riparato o aggiunto e spazio sigillato per l'inverno."
   ],
   "de": [
    "Kriechkeller: Inspektion, Reparatur und Winterfestmachung",
    "Der Kriechkeller geprüft, Dämmung repariert oder ergänzt und gegen den Winter abgedichtet."
   ],
   "uk": [
    "Огляд, ремонт і утеплення технічного підпілля",
    "Підпілля оглянуто, утеплення відремонтовано чи додано, простір загерметизовано на зиму."
   ],
   "pa": [
    "ਕ੍ਰੌਲਸਪੇਸ ਦੀ ਜਾਂਚ, ਮੁਰੰਮਤ ਅਤੇ ਸਰਦੀ ਦੀ ਤਿਆਰੀ",
    "ਕ੍ਰੌਲਸਪੇਸ ਜਾਂਚੀ, ਇੰਸੂਲੇਸ਼ਨ ਠੀਕ ਜਾਂ ਵਧਾਈ ਅਤੇ ਸਰਦੀ ਲਈ ਸੀਲ ਕੀਤੀ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Inspeksyon, pagkukumpuni at winterization ng crawlspace",
    "Siniyasat ang crawlspace, inayos o dinagdagan ang insulasyon at sinelyuhan laban sa taglamig."
   ]
  },
  "fq.general_contracting.hvac.mini_split": {
   "it": [
    "Installazione split e configurazione termostato",
    "Split senza canali montato, linee posate e termostato configurato."
   ],
   "de": [
    "Split-Klimagerät montieren und Thermostat einrichten",
    "Ein kanalloses Split-Gerät montiert, Leitungen verlegt und das Thermostat eingerichtet."
   ],
   "uk": [
    "Монтаж спліт-системи та налаштування термостата",
    "Безканальну спліт-систему встановлено, траси прокладено, термостат налаштовано."
   ],
   "pa": [
    "ਮਿੰਨੀ-ਸਪਲਿਟ ਲਾਉਣਾ ਅਤੇ ਥਰਮੋਸਟੈਟ ਸੈਟਿੰਗ",
    "ਬਿਨਾਂ ਡਕਟ ਮਿੰਨੀ-ਸਪਲਿਟ ਲਾਇਆ, ਲਾਈਨਾਂ ਵਿਛਾਈਆਂ ਅਤੇ ਥਰਮੋਸਟੈਟ ਸੈੱਟ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkakabit ng mini-split at setup ng thermostat",
    "Ikinabit ang ductless na mini-split, inilatag ang linya at sinet-up ang thermostat."
   ]
  },
  "fq.general_contracting.hvac.system_install_replace": {
   "it": [
    "Installazione e sostituzione impianto HVAC",
    "Impianto di riscaldamento e raffrescamento installato o sostituito con i canali e i componenti necessari."
   ],
   "de": [
    "Einbau und Austausch von HLK-Anlagen",
    "Eine Heiz- und Kühlanlage mit den nötigen Kanälen und Komponenten eingebaut oder ersetzt."
   ],
   "uk": [
    "Монтаж і заміна системи HVAC",
    "Систему опалення й охолодження встановлено чи замінено з потрібними повітроводами й вузлами."
   ],
   "pa": [
    "HVAC ਸਿਸਟਮ ਲਾਉਣਾ ਅਤੇ ਬਦਲਣਾ",
    "ਹੀਟਿੰਗ ਅਤੇ ਕੂਲਿੰਗ ਸਿਸਟਮ ਲੋੜੀਂਦੇ ਡਕਟ ਅਤੇ ਪੁਰਜ਼ਿਆਂ ਸਮੇਤ ਲਾਇਆ ਜਾਂ ਬਦਲਿਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkakabit at pagpapalit ng HVAC system",
    "Ikinabit o pinalitan ang sistema ng init at lamig kasama ang duct at piyesang kailangan."
   ]
  },
  "fq.general_contracting.hvac.install_repair_maintain": {
   "it": [
    "Installazione, riparazione e manutenzione HVAC",
    "Installazione, riparazione, sostituzione e preventivi su riscaldamento e raffrescamento residenziali."
   ],
   "de": [
    "HLK-Einbau, Reparatur und Wartung",
    "Einbau, Reparatur, Austausch und Kostenvoranschläge für Heizung und Kühlung im Wohnbereich."
   ],
   "uk": [
    "Монтаж, ремонт і обслуговування HVAC",
    "Монтаж, ремонт, заміна й кошториси для побутового опалення та охолодження."
   ],
   "pa": [
    "HVAC ਲਾਉਣਾ, ਮੁਰੰਮਤ ਅਤੇ ਰੱਖ-ਰਖਾਅ",
    "ਘਰੇਲੂ ਹੀਟਿੰਗ ਅਤੇ ਕੂਲਿੰਗ ਲਈ ਲਾਉਣਾ, ਮੁਰੰਮਤ, ਬਦਲਣਾ ਅਤੇ ਅੰਦਾਜ਼ੇ।"
   ],
   "tl": [
    "Pagkakabit, pagkukumpuni at maintenance ng HVAC",
    "Pagkakabit, pagkukumpuni, pagpapalit at estimate sa pampainit at pampalamig ng bahay."
   ]
  },
  "fq.general_contracting.hvac.filter_replacement": {
   "it": [
    "Sostituzione filtri HVAC",
    "Filtri e cartucce di ricambio forniti e montati."
   ],
   "de": [
    "HLK-Filterwechsel",
    "Ersatzfilter und Kartuschen geliefert und eingesetzt."
   ],
   "uk": [
    "Заміна фільтрів HVAC",
    "Змінні фільтри й картриджі постачено й встановлено."
   ],
   "pa": [
    "HVAC ਫ਼ਿਲਟਰ ਬਦਲਣਾ",
    "ਬਦਲਵੇਂ ਫ਼ਿਲਟਰ ਅਤੇ ਕਾਰਟ੍ਰਿਜ ਦੇ ਕੇ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagpapalit ng filter ng HVAC",
    "Nagbigay at ikinabit ang pamalit na filter at cartridge."
   ]
  },
  "fq.general_contracting.hvac.service_call_diagnostic": {
   "it": [
    "Intervento HVAC ed elettrodomestici con diagnosi",
    "Uscita, diagnosi e manodopera di riparazione per un guasto di riscaldamento, raffrescamento o elettrodomestico."
   ],
   "de": [
    "HLK- und Geräte-Serviceeinsatz mit Diagnose",
    "Anfahrt, Diagnose und Reparaturarbeit für einen Heizungs-, Kühl- oder Gerätedefekt."
   ],
   "uk": [
    "Виклик майстра HVAC і техніки з діагностикою",
    "Виїзд, діагностика та ремонтні роботи при несправності опалення, охолодження чи техніки."
   ],
   "pa": [
    "HVAC ਅਤੇ ਉਪਕਰਣ ਸਰਵਿਸ ਕਾਲ, ਜਾਂਚ ਸਮੇਤ",
    "ਹੀਟਿੰਗ, ਕੂਲਿੰਗ ਜਾਂ ਉਪਕਰਣ ਦੇ ਨੁਕਸ ਲਈ ਸਰਵਿਸ ਕਾਲ, ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ।"
   ],
   "tl": [
    "Service call sa HVAC at appliance na may diagnostic",
    "Service call, diagnosis at trabaho sa pagkukumpuni ng sira sa init, lamig o appliance."
   ]
  },
  "fq.general_contracting.hvac.commercial_dehumidifiers": {
   "it": [
    "Deumidificatori e ventilatori professionali",
    "Deumidificatori e ventilatori professionali installati e noleggiati per l'asciugatura dopo danni d'acqua."
   ],
   "de": [
    "Gewerbliche Luftentfeuchter und Ventilatoren",
    "Gewerbliche Entfeuchter und Luftbewegungsgeräte aufgestellt und zur Trocknung nach Wasserschäden vermietet."
   ],
   "uk": [
    "Промислові осушувачі та вентилятори",
    "Промислові осушувачі й вентилятори встановлено й надано в оренду для сушіння після затоплення."
   ],
   "pa": [
    "ਵਪਾਰਕ ਡੀਹਿਊਮਿਡੀਫ਼ਾਇਰ ਅਤੇ ਏਅਰ ਮੂਵਰ",
    "ਪਾਣੀ ਦੇ ਨੁਕਸਾਨ ਤੋਂ ਬਾਅਦ ਸੁਕਾਉਣ ਲਈ ਵਪਾਰਕ ਡੀਹਿਊਮਿਡੀਫ਼ਾਇਰ ਅਤੇ ਏਅਰ ਮੂਵਰ ਲਾਏ ਅਤੇ ਕਿਰਾਏ 'ਤੇ ਦਿੱਤੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Komersyal na dehumidifier at air mover",
    "Inilagay at pinaupahan ang komersyal na dehumidifier at air mover para magpatuyo pagkatapos ng pinsala sa tubig."
   ]
  },
  "fq.general_contracting.hvac.fiberglass_batts": {
   "it": [
    "Isolamento in pannelli di fibra di vetro — sottotetto e vespaio",
    "Pannelli isolanti del valore R concordato posati in sottotetto, vespaio, pareti e travi di bordo."
   ],
   "de": [
    "Glaswolledämmung — Dachboden und Kriechkeller",
    "Dämmmatten mit vereinbartem R-Wert in Dachboden, Kriechkeller, Wänden und Randbalken verlegt."
   ],
   "uk": [
    "Утеплення скловатою — горище та підпілля",
    "Мати з погодженим R-значенням укладено на горищі, у підпіллі, стінах і обв'язці."
   ],
   "pa": [
    "ਫ਼ਾਈਬਰਗਲਾਸ ਬੈਟ ਇੰਸੂਲੇਸ਼ਨ — ਅਟਾਰੀ ਅਤੇ ਕ੍ਰੌਲਸਪੇਸ",
    "ਤੈਅ R-ਮੁੱਲ ਵਾਲੀ ਬੈਟ ਇੰਸੂਲੇਸ਼ਨ ਅਟਾਰੀ, ਕ੍ਰੌਲਸਪੇਸ, ਕੰਧਾਂ ਅਤੇ ਰਿਮ ਜੋਇਸਟਾਂ ਵਿੱਚ ਲਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Fiberglass batt na insulasyon — attic at crawlspace",
    "Ikinabit ang batt na insulasyon sa napagkasunduang R-value sa attic, crawlspace, pader at rim joist."
   ]
  },
  "fq.general_contracting.kitchen.demolition": {
   "pa": [
    "ਰਸੋਈ ਕੈਬਨਿਟ ਅਤੇ ਕਾਊਂਟਰਟੌਪ ਢਾਹੁਣਾ",
    "ਮੌਜੂਦਾ ਕੈਬਨਿਟ ਅਤੇ ਕਾਊਂਟਰਟੌਪ ਹਟਾ ਕੇ ਲਿਜਾਏ ਜਾਂਦੇ ਹਨ, ਪਲੰਬਿੰਗ ਅਤੇ ਬਿਜਲੀ ਬੰਦ ਕਰਕੇ।"
   ]
  },
  "fq.general_contracting.kitchen.countertops": {
   "it": [
    "Realizzazione e posa piani cucina",
    "Piani rilevati, realizzati con il bordo scelto e posati con l'alzatina."
   ],
   "de": [
    "Fertigung und Montage von Küchenarbeitsplatten",
    "Arbeitsplatten aufgemessen, mit der gewählten Kante gefertigt und mit Rückwand montiert."
   ],
   "uk": [
    "Виготовлення та монтаж кухонних стільниць",
    "Стільниці заміряно, виготовлено з обраним краєм і встановлено з фартухом."
   ],
   "pa": [
    "ਰਸੋਈ ਕਾਊਂਟਰਟੌਪ ਬਣਾਉਣਾ ਅਤੇ ਲਾਉਣਾ",
    "ਕਾਊਂਟਰਟੌਪ ਦਾ ਨਮੂਨਾ ਲੈ ਕੇ ਚੁਣੇ ਕਿਨਾਰੇ ਨਾਲ ਬਣਾਇਆ ਅਤੇ ਬੈਕਸਪਲੈਸ਼ ਸਮੇਤ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Paggawa at pagkakabit ng countertop sa kusina",
    "Kinuha ang template, ginawa sa napiling gilid at ikinabit ang countertop kasama ang backsplash."
   ]
  },
  "fq.general_contracting.kitchen.hood_cleaning": {
   "it": [
    "Pulizia e manutenzione cappa",
    "Cappa aspirante e filtri sgrassati, ventola e condotto controllati."
   ],
   "de": [
    "Dunstabzugshaube reinigen und warten",
    "Dunstabzugshaube und Filter entfettet, Lüfter und Abluftkanal geprüft."
   ],
   "uk": [
    "Чищення та обслуговування витяжки",
    "Витяжку й фільтри знежирено, вентилятор і канал перевірено."
   ],
   "pa": [
    "ਰੇਂਜ ਹੁੱਡ ਦੀ ਸਫ਼ਾਈ ਅਤੇ ਸੰਭਾਲ",
    "ਰਸੋਈ ਦਾ ਐਗਜ਼ੌਸਟ ਹੁੱਡ ਅਤੇ ਫ਼ਿਲਟਰ ਚਿਕਨਾਈ-ਰਹਿਤ ਅਤੇ ਪੱਖਾ ਅਤੇ ਡਕਟ ਜਾਂਚੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Paglilinis at maintenance ng range hood",
    "Tinanggalan ng mantika ang hood at filter at chineck ang fan at duct."
   ]
  },
  "fq.general_contracting.kitchen.cabinet_painting": {
   "it": [
    "Verniciatura e rinnovo mobili cucina",
    "Ante, scocche e maniglie rinnovate con un rivestimento resistente."
   ],
   "de": [
    "Küchenschränke lackieren und aufarbeiten",
    "Fronten, Korpusse und Beschläge mit einer strapazierfähigen Beschichtung aufgearbeitet."
   ],
   "uk": [
    "Фарбування та оновлення кухонних шаф",
    "Фасади, корпуси й фурнітуру оновлено міцним покриттям."
   ],
   "pa": [
    "ਰਸੋਈ ਕੈਬਨਿਟ ਪੇਂਟ ਅਤੇ ਰੀਫ਼ਿਨਿਸ਼",
    "ਦਰਵਾਜ਼ੇ, ਬਾਕਸ ਅਤੇ ਹਾਰਡਵੇਅਰ ਮਜ਼ਬੂਤ ਕੋਟਿੰਗ ਨਾਲ ਰੀਫ਼ਿਨਿਸ਼ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagpipinta at refinishing ng kabinet sa kusina",
    "Ni-refinish sa matibay na coating ang pinto, kahon at hardware."
   ]
  },
  "fq.general_contracting.kitchen.remodel_pavers": {
   "it": [
    "Ristrutturazione cucina e posa autobloccanti",
    "Ristrutturazione della cucina con piani di lavoro, abbinata ad autobloccanti, bordure e passi da giardino all'esterno."
   ],
   "de": [
    "Küchensanierung und Pflasterverlegung",
    "Eine Küchensanierung mit Arbeitsplatten, kombiniert mit Pflaster, Einfassungen und Trittplatten im Außenbereich."
   ],
   "uk": [
    "Ремонт кухні та укладання бруківки",
    "Ремонт кухні зі стільницями разом із бруківкою, бордюрами й доріжкою з плит надворі."
   ],
   "pa": [
    "ਰਸੋਈ ਨਵੀਨੀਕਰਨ ਅਤੇ ਪੇਵਰ ਲਾਉਣਾ",
    "ਕਾਊਂਟਰਟੌਪਾਂ ਸਮੇਤ ਰਸੋਈ ਨਵੀਨੀਕਰਨ, ਨਾਲ ਬਾਹਰ ਪੇਵਰ, ਕਿਨਾਰੀਆਂ ਅਤੇ ਪੈਰ ਰੱਖਣ ਵਾਲੇ ਪੱਥਰ।"
   ],
   "tl": [
    "Renobasyon ng kusina at pagkakabit ng paver",
    "Renobasyon ng kusina na may countertop, kasama ang paver, border at stepping stone sa labas."
   ]
  },
  "fq.general_contracting.kitchen.remodel_full": {
   "pa": [
    "ਰਸੋਈ ਨਵੀਨੀਕਰਨ — ਕੈਬਨਿਟ, ਕਾਊਂਟਰਟੌਪ ਅਤੇ ਬੈਕਸਪਲੈਸ਼",
    "ਕੈਬਨਿਟ ਲਾਏ, ਕਾਊਂਟਰਟੌਪ ਬਣਾ ਕੇ ਲਾਏ ਅਤੇ ਬੈਕਸਪਲੈਸ਼ 'ਤੇ ਟਾਈਲ ਲਾਈ ਜਾਂਦੀ ਹੈ।"
   ]
  },
  "fq.general_contracting.painting.drywall_repair_debris": {
   "pa": [
    "ਡ੍ਰਾਈਵਾਲ ਮੁਰੰਮਤ ਅਤੇ ਮਲਬਾ ਹਟਾਉਣਾ",
    "ਡ੍ਰਾਈਵਾਲ ਠੀਕ ਅਤੇ ਉਸਦਾ ਉਸਾਰੀ ਕੂੜਾ ਨਿਪਟਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ]
  },
  "fq.general_contracting.painting.primer": {
   "it": [
    "Applicazione di fondo su cartongesso e superfici",
    "Cartongesso nuovo, soffitti e superfici interne trattati con fondo e sigillati prima della pittura finale."
   ],
   "de": [
    "Grundierung von Trockenbau und Oberflächen",
    "Neuer Trockenbau, Decken und Innenflächen vor dem Schlussanstrich grundiert und versiegelt."
   ],
   "uk": [
    "Нанесення ґрунтовки на гіпсокартон і поверхні",
    "Новий гіпсокартон, стелі й внутрішні поверхні заґрунтовано й загерметизовано перед фінішним фарбуванням."
   ],
   "pa": [
    "ਡ੍ਰਾਈਵਾਲ ਅਤੇ ਸਤਹਾਂ 'ਤੇ ਪ੍ਰਾਈਮਰ",
    "ਨਵੀਂ ਡ੍ਰਾਈਵਾਲ, ਛੱਤਾਂ ਅਤੇ ਅੰਦਰਲੀਆਂ ਸਤਹਾਂ ਫ਼ਾਈਨਲ ਪੇਂਟ ਤੋਂ ਪਹਿਲਾਂ ਪ੍ਰਾਈਮ ਅਤੇ ਸੀਲ।"
   ],
   "tl": [
    "Paglalagay ng primer sa drywall at surface",
    "Prinimer at sinelyuhan ang bagong drywall, kisame at surface sa loob bago ang huling pintura."
   ]
  },
  "fq.general_contracting.painting.mold_remediation_painting": {
   "it": [
    "Preparazione interna, bonifica muffa e tinteggiatura",
    "Muffa rimossa con attrezzature HEPA, qualità dell'aria verificata, poi superfici preparate e tinteggiate."
   ],
   "de": [
    "Innenvorbereitung, Schimmelsanierung und Anstrich",
    "Schimmel mit HEPA-Geräten entfernt, Luftqualität geprüft, danach Flächen vorbereitet und gestrichen."
   ],
   "uk": [
    "Підготовка, видалення цвілі та фарбування",
    "Цвіль прибрано HEPA-обладнанням, якість повітря перевірено, потім поверхні підготовлено й пофарбовано."
   ],
   "pa": [
    "ਅੰਦਰੂਨੀ ਤਿਆਰੀ, ਉੱਲੀ ਹਟਾਉਣਾ ਅਤੇ ਪੇਂਟ",
    "HEPA ਸਾਜ਼ੋ-ਸਮਾਨ ਨਾਲ ਉੱਲੀ ਹਟਾਈ, ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਜਾਂਚੀ, ਫਿਰ ਸਤਹਾਂ ਤਿਆਰ ਕਰਕੇ ਪੇਂਟ।"
   ],
   "tl": [
    "Paghahanda sa loob, pag-alis ng amag at pagpipinta",
    "Inalis ang amag gamit ang HEPA, sinuri ang kalidad ng hangin, saka inihanda at pininturahan ang surface."
   ]
  },
  "fq.general_contracting.painting.paint_supply_application": {
   "it": [
    "Fornitura e applicazione pitture interne ed esterne",
    "Pittura acrilica di qualità fornita e applicata su superfici interne ed esterne."
   ],
   "de": [
    "Lieferung und Auftrag von Innen- und Außenfarbe",
    "Hochwertige Acryl-Latexfarbe geliefert und auf Innen- und Außenflächen aufgetragen."
   ],
   "uk": [
    "Постачання та нанесення фарби всередині й зовні",
    "Якісну акрилову фарбу постачено й нанесено на внутрішні та зовнішні поверхні."
   ],
   "pa": [
    "ਅੰਦਰੂਨੀ ਅਤੇ ਬਾਹਰੀ ਪੇਂਟ ਦੇਣਾ ਅਤੇ ਲਾਉਣਾ",
    "ਵਧੀਆ ਐਕ੍ਰੇਲਿਕ ਲੇਟੈਕਸ ਅੰਦਰਲੀਆਂ ਅਤੇ ਬਾਹਰਲੀਆਂ ਸਤਹਾਂ 'ਤੇ ਦੇ ਕੇ ਲਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Suplay at paglalagay ng pintura sa loob at labas",
    "Nagbigay at naglagay ng de-kalidad na acrylic latex sa loob at labas."
   ]
  },
  "fq.general_contracting.painting.stucco_repair": {
   "it": [
    "Riparazione e rappezzi di intonaco esterno",
    "Intonaco crepato o danneggiato rappezzato, strutturato come l'esistente e ritinteggiato con pittura elastomerica."
   ],
   "de": [
    "Putzreparatur und Ausbesserung",
    "Gerissener oder beschädigter Außenputz ausgebessert, passend strukturiert und mit elastomerer Farbe neu gestrichen."
   ],
   "uk": [
    "Ремонт і латання штукатурки",
    "Тріснуту чи пошкоджену штукатурку залатано, фактуру підібрано, перефарбовано еластомерною фарбою."
   ],
   "pa": [
    "ਸਟੱਕੋ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਪੈਚਿੰਗ",
    "ਤਿੜਕਿਆ ਜਾਂ ਖ਼ਰਾਬ ਸਟੱਕੋ ਪੈਚ, ਮੇਲ ਖਾਂਦਾ ਟੈਕਸਚਰ ਅਤੇ ਲਚਕੀਲੀ ਕੋਟਿੰਗ ਨਾਲ ਮੁੜ ਪੇਂਟ।"
   ],
   "tl": [
    "Pagkukumpuni at pagtatapal ng stucco",
    "Tinapalan ang bitak o sirang stucco, itinugma ang tekstura at pininturahang muli ng elastomeric na coating."
   ]
  },
  "fq.general_contracting.painting.wallpaper": {
   "it": [
    "Posa e rimozione carta da parati",
    "Vecchia carta rimossa e pareti preparate, oppure nuova carta posata, materiali inclusi."
   ],
   "de": [
    "Tapezieren und Tapetenentfernung",
    "Alte Tapete entfernt und Wände vorbereitet oder neue Tapete geklebt, Material inklusive."
   ],
   "uk": [
    "Поклейка та зняття шпалер",
    "Старі шпалери знято й стіни підготовлено або наклеєно нові, матеріали включено."
   ],
   "pa": [
    "ਵਾਲਪੇਪਰ ਲਾਉਣਾ ਅਤੇ ਹਟਾਉਣਾ",
    "ਪੁਰਾਣਾ ਵਾਲਪੇਪਰ ਉਤਾਰ ਕੇ ਕੰਧਾਂ ਤਿਆਰ, ਜਾਂ ਨਵਾਂ ਵਾਲਪੇਪਰ ਲਾਇਆ ਜਾਂਦਾ ਹੈ, ਸਮਾਨ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit at pag-alis ng wallpaper",
    "Tinanggal ang lumang wallpaper at inihanda ang pader, o ikinabit ang bago, kasama ang materyales."
   ]
  },
  "fq.general_contracting.plumbing.backflow_testing": {
   "it": [
    "Prova e certificazione antiriflusso",
    "Dispositivo antiriflusso provato, ispezionato e certificato per l'ente idrico."
   ],
   "de": [
    "Rückflussverhinderer prüfen und zertifizieren",
    "Ein Rückflussverhinderer geprüft, inspiziert und für den Wasserversorger zertifiziert."
   ],
   "uk": [
    "Перевірка та сертифікація зворотного клапана",
    "Пристрій від зворотного потоку перевірено, оглянуто й сертифіковано для водоканалу."
   ],
   "pa": [
    "ਬੈਕਫ਼ਲੋ ਟੈਸਟਿੰਗ ਅਤੇ ਪ੍ਰਮਾਣ-ਪੱਤਰ",
    "ਬੈਕਫ਼ਲੋ ਰੋਕੂ ਯੰਤਰ ਜਲ ਵਿਭਾਗ ਲਈ ਟੈਸਟ, ਜਾਂਚ ਅਤੇ ਪ੍ਰਮਾਣਿਤ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagsubok at sertipikasyon ng backflow",
    "Sinubukan, siniyasat at sinertipikahan para sa water authority ang backflow preventer."
   ]
  },
  "fq.general_contracting.plumbing.repair_leak_repipe": {
   "it": [
    "Riparazioni idrauliche, ricerca perdite e rifacimento tubazioni",
    "Perdite trovate e riparate, tubazioni dell'acqua sostituite e impianto riportato in buono stato."
   ],
   "de": [
    "Sanitärreparatur, Lecksuche und Rohrerneuerung",
    "Lecks gefunden und repariert, Wasserleitungen ersetzt und die Anlage wieder in einwandfreien Zustand gebracht."
   ],
   "uk": [
    "Сантехремонт, пошук протікань і заміна труб",
    "Протікання знайдено й усунуто, водопровід замінено, систему повернуто в справний стан."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਮੁਰੰਮਤ, ਲੀਕ ਲੱਭਣਾ ਅਤੇ ਨਵੀਆਂ ਪਾਈਪਾਂ",
    "ਲੀਕ ਲੱਭ ਕੇ ਠੀਕ, ਪਾਣੀ ਦੀਆਂ ਲਾਈਨਾਂ ਬਦਲੀਆਂ ਅਤੇ ਸਿਸਟਮ ਮੁੜ ਠੀਕ ਹਾਲਤ ਵਿੱਚ।"
   ],
   "tl": [
    "Pagkukumpuni ng tubero, paghahanap ng tagas at repiping",
    "Hinanap at inayos ang tagas, pinalitan ang linya ng tubig at ibinalik sa maayos na kondisyon ang sistema."
   ]
  },
  "fq.general_contracting.plumbing.service_call_drain": {
   "it": [
    "Intervento idraulico e pulizia scarichi",
    "Manodopera idraulica per un intervento, pulizia di scarichi o manutenzione generale."
   ],
   "de": [
    "Sanitär-Serviceeinsatz und Abflussreinigung",
    "Sanitärarbeit für einen Serviceeinsatz, Abflussreinigung oder allgemeine Wartung."
   ],
   "uk": [
    "Виклик сантехніка та прочищення стоків",
    "Сантехнічні роботи на виклику, прочищення стоків чи загальне обслуговування."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਸਰਵਿਸ ਕਾਲ ਅਤੇ ਡਰੇਨ ਸਫ਼ਾਈ",
    "ਸਰਵਿਸ ਕਾਲ, ਡਰੇਨ ਸਫ਼ਾਈ ਜਾਂ ਆਮ ਰੱਖ-ਰਖਾਅ ਲਈ ਪਲੰਬਰ ਦੀ ਮਜ਼ਦੂਰੀ।"
   ],
   "tl": [
    "Service call ng tubero at paglilinis ng drain",
    "Trabaho ng tubero para sa service call, paglilinis ng drain o pangkalahatang maintenance."
   ]
  },
  "fq.general_contracting.plumbing.service_call_leak": {
   "it": [
    "Intervento idraulico e riparazione perdite — prima ora",
    "La prima ora dell'idraulico per un intervento, la diagnosi di una perdita o la riparazione."
   ],
   "de": [
    "Sanitär-Serviceeinsatz und Leckreparatur — erste Stunde",
    "Die erste Stunde des Installateurs für Serviceeinsatz, Leckdiagnose oder Reparatur."
   ],
   "uk": [
    "Виклик сантехніка та ремонт протікання — перша година",
    "Перша година роботи сантехніка на виклику, діагностиці чи ремонті протікання."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਸਰਵਿਸ ਕਾਲ ਅਤੇ ਲੀਕ ਮੁਰੰਮਤ — ਪਹਿਲਾ ਘੰਟਾ",
    "ਸਰਵਿਸ ਕਾਲ, ਲੀਕ ਜਾਂਚ ਜਾਂ ਮੁਰੰਮਤ 'ਤੇ ਪਲੰਬਰ ਦਾ ਪਹਿਲਾ ਘੰਟਾ।"
   ],
   "tl": [
    "Service call ng tubero at pag-aayos ng tagas — unang oras",
    "Ang unang oras ng tubero sa service call, pagsusuri o pag-aayos ng tagas."
   ]
  },
  "fq.general_contracting.plumbing.spring_startup": {
   "pa": [
    "ਬਸੰਤ ਵਿੱਚ ਪਲੰਬਿੰਗ ਚਾਲੂ ਕਰਨਾ ਅਤੇ ਵਾਟਰ ਹੀਟਰ ਸਰਵਿਸ",
    "ਮੌਸਮੀ ਪਲੰਬਿੰਗ ਮੁੜ ਚਾਲੂ, ਵਾਟਰ ਹੀਟਰ ਸ਼ੁਰੂ ਅਤੇ ਸਿਸਟਮ ਜਾਂਚਿਆ ਜਾਂਦਾ ਹੈ।"
   ]
  },
  "fq.general_contracting.roofing.chimney_cap_liner": {
   "it": [
    "Comignolo, canna fumaria e rivestimento protettivo",
    "Cappelli, canne, cappe e coperture installati e sigillati sul camino."
   ],
   "de": [
    "Kaminhaube, Innenrohr und Schutzverkleidung",
    "Hauben, Innenrohre, Abdeckungen und Schachtabdeckungen am Kamin montiert und abgedichtet."
   ],
   "uk": [
    "Ковпак, гільза та захисне облицювання димаря",
    "Ковпаки, гільзи, дашки й кришки встановлено та загерметизовано на димарі."
   ],
   "pa": [
    "ਚਿਮਨੀ ਕੈਪ, ਲਾਈਨਰ ਅਤੇ ਸੁਰੱਖਿਆ ਕਵਰ",
    "ਚਿਮਨੀ 'ਤੇ ਕੈਪ, ਲਾਈਨਰ, ਹੁੱਡ ਅਤੇ ਚੇਜ਼ ਕਵਰ ਲਾ ਕੇ ਸੀਲ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Takip, liner at proteksyon ng tsimenea",
    "Ikinabit at sinelyuhan ang takip, liner, hood at chase cover ng tsimenea."
   ]
  },
  "fq.general_contracting.roofing.chimney_repair_flashing": {
   "it": [
    "Riparazione camino, scossaline e impermeabilizzazione",
    "Riparazioni strutturali del camino, nuove scossaline, sigillatura della corona e impermeabilizzazione."
   ],
   "de": [
    "Kaminreparatur, Anschlussbleche und Abdichtung",
    "Bauliche Kaminreparaturen, neue Anschlussbleche, Abdichtung der Kaminkrone und Imprägnierung."
   ],
   "uk": [
    "Ремонт димаря, фартухи та гідроізоляція",
    "Конструктивний ремонт димаря, нові фартухи, герметизація короны й гідроізоляція."
   ],
   "pa": [
    "ਚਿਮਨੀ ਮੁਰੰਮਤ, ਫ਼ਲੈਸ਼ਿੰਗ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ਿੰਗ",
    "ਚਿਮਨੀ ਦੀ ਢਾਂਚਾਗਤ ਮੁਰੰਮਤ, ਨਵੀਂ ਫ਼ਲੈਸ਼ਿੰਗ, ਕ੍ਰਾਊਨ ਸੀਲਿੰਗ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ਿੰਗ।"
   ],
   "tl": [
    "Pagkukumpuni ng tsimenea, flashing at waterproofing",
    "Estruktural na pagkukumpuni ng tsimenea, bagong flashing, pagselyo ng crown at waterproofing."
   ]
  },
  "fq.general_contracting.roofing.flat_roof_replacement": {
   "it": [
    "Rifacimento e rivestimento tetto piano",
    "Tetto piano rifatto con nuovo sottostrato e membrana e finito con un rivestimento protettivo."
   ],
   "de": [
    "Flachdacherneuerung und Beschichtung",
    "Ein Flachdach mit neuer Unterlage und Bahn erneuert und mit einer Schutzbeschichtung abgeschlossen."
   ],
   "uk": [
    "Заміна та покриття плоскої покрівлі",
    "Плоский дах замінено з новим підкладковим шаром і мембраною та захисним покриттям."
   ],
   "pa": [
    "ਸਮਤਲ ਛੱਤ ਬਦਲਣਾ ਅਤੇ ਕੋਟਿੰਗ",
    "ਸਮਤਲ ਛੱਤ ਨਵੀਂ ਅੰਡਰਲੇਅ ਅਤੇ ਝਿੱਲੀ ਨਾਲ ਬਦਲ ਕੇ ਸੁਰੱਖਿਆ ਕੋਟਿੰਗ ਨਾਲ ਮੁਕੰਮਲ।"
   ],
   "tl": [
    "Pagpapalit at coating ng patag na bubong",
    "Pinalitan ang patag na bubong ng bagong underlayment at membrane at tinapos ng protektibong coating."
   ]
  },
  "fq.general_contracting.roofing.downspout_reinstall": {
   "it": [
    "Smontaggio e rimontaggio pluviali",
    "Pluviali in alluminio smontati per altri lavori e rimontati al termine."
   ],
   "de": [
    "Fallrohre abbauen und wieder montieren",
    "Aluminium-Fallrohre für andere Arbeiten abgenommen und danach wieder montiert."
   ],
   "uk": [
    "Демонтаж і повторний монтаж водостічних труб",
    "Алюмінієві труби знято на час інших робіт і встановлено назад після них."
   ],
   "pa": [
    "ਡਾਊਨਸਪਾਊਟ ਉਤਾਰਨਾ ਅਤੇ ਮੁੜ ਲਾਉਣਾ",
    "ਹੋਰ ਕੰਮ ਲਈ ਐਲੂਮੀਨੀਅਮ ਡਾਊਨਸਪਾਊਟ ਉਤਾਰੇ ਅਤੇ ਬਾਅਦ ਵਿੱਚ ਮੁੜ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagtanggal at muling pagkakabit ng downspout",
    "Tinanggal ang aluminyong downspout para sa ibang trabaho at ikinabit ulit pagkatapos."
   ]
  },
  "fq.general_contracting.roofing.foundation_drainage": {
   "it": [
    "Drenaggio di fondazioni e seminterrati",
    "Drenaggi francesi, pompe di sollevamento e linee di scarico installati all'interno o all'esterno delle fondazioni."
   ],
   "de": [
    "Fundament- und Kellerentwässerung",
    "Sickerdrainagen, Sumpfpumpen und Entwässerungsleitungen innen oder außen am Fundament eingebaut."
   ],
   "uk": [
    "Дренаж фундаменту та підвалу",
    "Французькі дренажі, дренажні насоси й лінії відведення встановлено всередині чи зовні фундаменту."
   ],
   "pa": [
    "ਨੀਂਹ ਅਤੇ ਬੇਸਮੈਂਟ ਨਿਕਾਸ ਸਿਸਟਮ",
    "ਨੀਂਹ ਦੇ ਅੰਦਰ ਜਾਂ ਬਾਹਰ ਫ਼ਰੈਂਚ ਡਰੇਨ, ਸੰਪ ਪੰਪ ਅਤੇ ਨਿਕਾਸ ਲਾਈਨਾਂ ਲਾਈਆਂ ਜਾਂਦੀਆਂ ਹਨ।"
   ],
   "tl": [
    "Drainage ng pundasyon at basement",
    "Ikinabit ang French drain, sump pump at linya ng drainage sa loob o labas ng pundasyon."
   ]
  },
  "fq.general_contracting.roofing.gutter_cleaning": {
   "pa": [
    "ਪਰਨਾਲਿਆਂ ਦੀ ਸਫ਼ਾਈ ਅਤੇ ਸੰਭਾਲ",
    "ਪਰਨਾਲੇ ਅਤੇ ਡਾਊਨਸਪਾਊਟ ਕੂੜੇ ਤੋਂ ਸਾਫ਼ ਅਤੇ ਲੀਕ ਅਤੇ ਝੁਕਾਅ ਲਈ ਜਾਂਚੇ ਜਾਂਦੇ ਹਨ।"
   ]
  },
  "fq.general_contracting.roofing.downspout_install": {
   "it": [
    "Installazione e ricollegamento pluviali",
    "Pluviali in alluminio o acciaio di misura standard forniti, installati e ricollegati alle grondaie."
   ],
   "de": [
    "Fallrohre montieren und anschließen",
    "Fallrohre aus Aluminium oder Stahl in Standardgrößen geliefert, montiert und wieder an die Rinnen angeschlossen."
   ],
   "uk": [
    "Монтаж і під'єднання водостічних труб",
    "Алюмінієві чи сталеві труби стандартних розмірів постачено, встановлено й під'єднано до ринв."
   ],
   "pa": [
    "ਡਾਊਨਸਪਾਊਟ ਲਾਉਣਾ ਅਤੇ ਮੁੜ ਜੋੜਨਾ",
    "ਆਮ ਨਾਪ ਦੇ ਐਲੂਮੀਨੀਅਮ ਜਾਂ ਸਟੀਲ ਡਾਊਨਸਪਾਊਟ ਦੇ ਕੇ ਲਾਏ ਅਤੇ ਪਰਨਾਲਿਆਂ ਨਾਲ ਮੁੜ ਜੋੜੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit at muling pagkonekta ng downspout",
    "Nagbigay, ikinabit at ikinonekta ulit sa alulod ang standard na aluminyo o bakal na downspout."
   ]
  },
  "fq.general_contracting.roofing.seamless_gutters": {
   "it": [
    "Grondaie e pluviali in alluminio senza giunte",
    "Grondaie in alluminio senza giunte da 5 a 7 pollici formate in cantiere e installate con pluviali abbinati."
   ],
   "de": [
    "Nahtlose Aluminiumrinnen und Fallrohre",
    "Nahtlose Aluminiumrinnen von 5 bis 7 Zoll vor Ort geformt und mit passenden Fallrohren montiert."
   ],
   "uk": [
    "Безшовні алюмінієві ринви та труби",
    "Безшовні алюмінієві ринви 5–7 дюймів сформовано на місці й встановлено з відповідними трубами."
   ],
   "pa": [
    "ਬਿਨਾਂ ਜੋੜ ਵਾਲੇ ਐਲੂਮੀਨੀਅਮ ਪਰਨਾਲੇ ਅਤੇ ਡਾਊਨਸਪਾਊਟ",
    "5 ਤੋਂ 7 ਇੰਚ ਦੇ ਬਿਨਾਂ ਜੋੜ ਐਲੂਮੀਨੀਅਮ ਪਰਨਾਲੇ ਮੌਕੇ 'ਤੇ ਬਣਾ ਕੇ ਮੇਲ ਖਾਂਦੇ ਡਾਊਨਸਪਾਊਟਾਂ ਸਮੇਤ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Seamless na aluminyong alulod at downspout",
    "Hinubog sa lugar ang 5 hanggang 7 pulgadang seamless na aluminyong alulod at ikinabit kasama ang katugmang downspout."
   ]
  },
  "fq.general_contracting.roofing.asphalt_shingles": {
   "it": [
    "Posa tetto in tegole bituminose",
    "Barriera anti-ghiaccio, tegole di partenza, di campo, di colmo e aeratori posati per il rifacimento completo."
   ],
   "de": [
    "Dacheindeckung mit Bitumenschindeln",
    "Eis- und Wassersperre, Traufschindeln, Flächenschindeln, First und Lüfter für eine komplette Dacherneuerung verlegt."
   ],
   "uk": [
    "Покрівля з бітумної черепиці",
    "Захист від льоду й води, стартова, рядова, конькова черепиця та вентиляція для повної заміни даху."
   ],
   "pa": [
    "ਐਸਫ਼ਾਲਟ ਸ਼ਿੰਗਲ ਛੱਤ ਲਾਉਣਾ",
    "ਪੂਰੀ ਛੱਤ ਬਦਲਣ ਲਈ ਆਈਸ ਅਤੇ ਵਾਟਰ ਬੈਰੀਅਰ, ਸਟਾਰਟਰ, ਮੁੱਖ ਸ਼ਿੰਗਲ, ਰਿੱਜ ਅਤੇ ਵੈਂਟ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit ng bubong na asphalt shingle",
    "Ikinabit ang ice at water barrier, starter, shingle, ridge at vent para sa buong pagpapalit ng bubong."
   ]
  },
  "fq.general_contracting.roofing.chimney_flashing_sealing": {
   "it": [
    "Scossaline del camino e sigillatura del tetto",
    "Scossaline, cappelli e scossaline a gradino del camino installati e sigillati con sigillante per coperture."
   ],
   "de": [
    "Kaminanschluss und Dachabdichtung",
    "Kaminanschlussbleche, Hauben und Kehlbleche montiert und mit Dachdichtstoff abgedichtet."
   ],
   "uk": [
    "Фартухи димаря та герметизація даху",
    "Фартухи, ковпаки й ступінчасті фартухи димаря встановлено й загерметизовано покрівельним герметиком."
   ],
   "pa": [
    "ਚਿਮਨੀ ਫ਼ਲੈਸ਼ਿੰਗ ਅਤੇ ਛੱਤ ਸੀਲਿੰਗ",
    "ਚਿਮਨੀ ਫ਼ਲੈਸ਼ਿੰਗ, ਕੈਪ ਅਤੇ ਸਟੈੱਪ ਫ਼ਲੈਸ਼ਿੰਗ ਲਾ ਕੇ ਛੱਤ ਵਾਲੀ ਕੌਕ ਨਾਲ ਸੀਲ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Flashing ng tsimenea at pagselyo ng bubong",
    "Ikinabit ang flashing, takip at step flashing ng tsimenea at sinelyuhan ng roofing caulk."
   ]
  },
  "fq.general_contracting.roofing.drip_edge_fascia": {
   "it": [
    "Gocciolatoio e fascia del tetto",
    "Gocciolatoio e fascia installati lungo il perimetro del tetto per portare l'acqua nelle grondaie."
   ],
   "de": [
    "Tropfkante und Traufblende",
    "Tropfkante und Blende entlang des Dachrands montiert, um das Wasser in die Rinnen zu leiten."
   ],
   "uk": [
    "Капельник і лобова дошка даху",
    "Капельник і лобову дошку встановлено по периметру даху, щоб вода йшла в ринви."
   ],
   "pa": [
    "ਛੱਤ ਦੀ ਡ੍ਰਿੱਪ ਐਜ ਅਤੇ ਫ਼ੇਸ਼ੀਆ",
    "ਛੱਤ ਦੇ ਘੇਰੇ 'ਤੇ ਡ੍ਰਿੱਪ ਐਜ ਅਤੇ ਫ਼ੇਸ਼ੀਆ ਲਾਏ ਜਾਂਦੇ ਹਨ ਤਾਂ ਜੋ ਪਾਣੀ ਪਰਨਾਲਿਆਂ ਵਿੱਚ ਜਾਵੇ।"
   ],
   "tl": [
    "Drip edge at fascia ng bubong",
    "Ikinabit ang drip edge at fascia sa paligid ng bubong para dumaloy ang tubig sa alulod."
   ]
  },
  "fq.general_contracting.roofing.roof_vents": {
   "it": [
    "Aeratori del tetto e ventilazione di colmo",
    "Aeratori di falda, di colmo e di timpano installati per ventilare il sottotetto."
   ],
   "de": [
    "Dachlüfter und Firstentlüftung",
    "Dach-, First- und Giebellüfter montiert, um den Dachboden zu belüften."
   ],
   "uk": [
    "Вентиляція даху та конька",
    "Покрівельні, конькові й фронтонні вентилятори встановлено для провітрювання горища."
   ],
   "pa": [
    "ਛੱਤ ਦੇ ਵੈਂਟ ਅਤੇ ਰਿੱਜ ਹਵਾਦਾਰੀ",
    "ਅਟਾਰੀ ਦੀ ਹਵਾਦਾਰੀ ਲਈ ਛੱਤ, ਰਿੱਜ ਅਤੇ ਗੇਬਲ ਵੈਂਟ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Vent ng bubong at ridge ventilation",
    "Ikinabit ang vent sa bubong, ridge at gable para mahanginan ang attic."
   ]
  },
  "fq.general_contracting.roofing.sump_condensation": {
   "it": [
    "Pompa di sollevamento e scarico condensa",
    "Pompe di sollevamento e di condensa installate con le tubazioni di scarico."
   ],
   "de": [
    "Sumpfpumpe und Kondensatableitung",
    "Sumpf- und Kondensatpumpen mit ihren Ablaufleitungen eingebaut."
   ],
   "uk": [
    "Дренажний насос і відведення конденсату",
    "Дренажні й конденсатні насоси встановлено з трубами відведення."
   ],
   "pa": [
    "ਸੰਪ ਪੰਪ ਅਤੇ ਕੰਡੈਂਸੇਟ ਨਿਕਾਸ",
    "ਸੰਪ ਅਤੇ ਕੰਡੈਂਸੇਟ ਪੰਪ ਉਹਨਾਂ ਦੀਆਂ ਨਿਕਾਸ ਪਾਈਪਾਂ ਸਮੇਤ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Sump pump at drainage ng condensation",
    "Ikinabit ang sump at condensate pump kasama ang tubo ng labasan."
   ]
  },
  "fq.general_contracting.roofing.roof_repair_shingles": {
   "it": [
    "Riparazione tetto e sostituzione tegole",
    "Tegole danneggiate sostituite, aeratore di colmo installato e riparazione sigillata."
   ],
   "de": [
    "Dachreparatur und Schindelaustausch",
    "Beschädigte Schindeln ersetzt, Firstlüfter montiert und die Reparatur abgedichtet."
   ],
   "uk": [
    "Ремонт даху та заміна черепиці",
    "Пошкоджену черепицю замінено, коньковий вентилятор встановлено, ремонт загерметизовано."
   ],
   "pa": [
    "ਛੱਤ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਸ਼ਿੰਗਲ ਬਦਲਣਾ",
    "ਖ਼ਰਾਬ ਸ਼ਿੰਗਲ ਬਦਲੇ, ਰਿੱਜ ਵੈਂਟ ਲਾਇਆ ਅਤੇ ਮੁਰੰਮਤ ਸੀਲ ਕੀਤੀ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Pagkukumpuni ng bubong at pagpapalit ng shingle",
    "Pinalitan ang sirang shingle, ikinabit ang ridge vent at sinelyuhan ang ayos."
   ]
  },
  "fq.general_contracting.roofing.architectural_replacement": {
   "it": [
    "Rifacimento tetto con tegole architettoniche",
    "Rimozione completa e rifacimento con tegole architettoniche."
   ],
   "de": [
    "Dacherneuerung mit Architekturschindeln",
    "Kompletter Rückbau und Neueindeckung mit Architekturschindeln."
   ],
   "uk": [
    "Заміна даху архітектурною черепицею",
    "Повний демонтаж і нове покриття архітектурною черепицею."
   ],
   "pa": [
    "ਆਰਕੀਟੈਕਚਰਲ ਸ਼ਿੰਗਲਾਂ ਨਾਲ ਛੱਤ ਬਦਲਣਾ",
    "ਪੂਰੀ ਪੁਰਾਣੀ ਛੱਤ ਉਤਾਰ ਕੇ ਆਰਕੀਟੈਕਚਰਲ ਸ਼ਿੰਗਲਾਂ ਨਾਲ ਨਵੀਂ।"
   ],
   "tl": [
    "Pagpapalit ng bubong na architectural shingle",
    "Buong pagtanggal at pagpapalit gamit ang architectural shingle."
   ]
  },
  "fq.general_contracting.roofing.install_materials_fasteners": {
   "it": [
    "Posa tetto con materiali e fissaggi",
    "Tegole, sottostrato, guaina anti-ghiaccio, scossaline e fissaggi forniti e posati."
   ],
   "de": [
    "Dacheindeckung mit Material und Befestigung",
    "Schindeln, Unterdeckbahn, Eis- und Wasserschutz, Bleche und Befestigungsmittel geliefert und verlegt."
   ],
   "uk": [
    "Монтаж покрівлі з матеріалами та кріпленням",
    "Черепицю, підкладку, захист від льоду, фартухи й кріплення постачено й змонтовано."
   ],
   "pa": [
    "ਸਮਾਨ ਅਤੇ ਕਿੱਲਾਂ ਸਮੇਤ ਛੱਤ ਲਾਉਣਾ",
    "ਸ਼ਿੰਗਲ, ਅੰਡਰਲੇਅ, ਆਈਸ ਅਤੇ ਵਾਟਰ ਸ਼ੀਲਡ, ਫ਼ਲੈਸ਼ਿੰਗ ਅਤੇ ਕਿੱਲਾਂ ਦੇ ਕੇ ਲਾਈਆਂ ਜਾਂਦੀਆਂ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit ng bubong na may materyales at pako",
    "Nagbigay at ikinabit ang shingle, underlayment, ice and water shield, flashing at pako."
   ]
  },
  "fq.general_contracting.roofing.repair_maintenance": {
   "it": [
    "Riparazione e manutenzione tetto",
    "Infiltrazioni sigillate, sottostrato e materiali sostituiti dove il tetto lo richiede."
   ],
   "de": [
    "Dachreparatur und Wartung",
    "Undichtigkeiten abgedichtet, Unterdeckung und Material ersetzt, wo das Dach es braucht."
   ],
   "uk": [
    "Ремонт і обслуговування даху",
    "Протікання загерметизовано, підкладку й матеріали замінено там, де дах цього потребує."
   ],
   "pa": [
    "ਛੱਤ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਸੰਭਾਲ",
    "ਲੀਕ ਸੀਲ, ਜਿੱਥੇ ਛੱਤ ਨੂੰ ਲੋੜ ਹੋਵੇ ਉੱਥੇ ਅੰਡਰਲੇਅ ਅਤੇ ਸਮਾਨ ਬਦਲਿਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkukumpuni at maintenance ng bubong",
    "Sinelyuhan ang tagas at pinalitan ang underlayment at materyales kung saan kailangan."
   ]
  },
  "fq.general_contracting.roofing.tear_off_shingling": {
   "it": [
    "Rimozione, rifacimento e posa tegole",
    "Tegole esistenti rimosse, tavolato preparato e nuove tegole posate."
   ],
   "de": [
    "Abdecken, Erneuern und Neueindecken",
    "Alte Schindeln abgetragen, Schalung vorbereitet und neue Schindeln verlegt."
   ],
   "uk": [
    "Демонтаж, заміна та укладання черепиці",
    "Стару черепицю знято, основу підготовлено й укладено нову."
   ],
   "pa": [
    "ਛੱਤ ਉਤਾਰਨਾ, ਬਦਲਣਾ ਅਤੇ ਸ਼ਿੰਗਲ ਲਾਉਣਾ",
    "ਮੌਜੂਦਾ ਸ਼ਿੰਗਲ ਉਤਾਰੇ, ਡੈੱਕ ਤਿਆਰ ਅਤੇ ਨਵੇਂ ਸ਼ਿੰਗਲ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagtanggal, pagpapalit at pag-shingle ng bubong",
    "Tinanggal ang lumang shingle, inihanda ang deck at ikinabit ang bagong shingle."
   ]
  },
  "fq.general_contracting.roofing.soffit_fascia_gutter": {
   "it": [
    "Riparazione e sostituzione di tetto, sottogronda, fascia e grondaie",
    "Copertura, sottogronda, fascia e grondaie riparati o sostituiti insieme."
   ],
   "de": [
    "Dach, Untersicht, Blende und Rinnen: Reparatur und Austausch",
    "Dach, Dachuntersicht, Blende und Rinnen gemeinsam repariert oder ersetzt."
   ],
   "uk": [
    "Ремонт і заміна даху, софітів, лобових дошок і ринв",
    "Покрівлю, софіти, лобові дошки й ринви відремонтовано чи замінено разом."
   ],
   "pa": [
    "ਛੱਤ, ਸੌਫ਼ਿਟ, ਫ਼ੇਸ਼ੀਆ ਅਤੇ ਪਰਨਾਲਿਆਂ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਬਦਲੀ",
    "ਛੱਤ, ਸੌਫ਼ਿਟ, ਫ਼ੇਸ਼ੀਆ ਅਤੇ ਪਰਨਾਲੇ ਇਕੱਠੇ ਠੀਕ ਜਾਂ ਬਦਲੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagkukumpuni at pagpapalit ng bubong, soffit, fascia at alulod",
    "Sabay na inayos o pinalitan ang bubong, soffit, fascia at alulod."
   ]
  },
  "fq.general_contracting.roofing.materials_waterproofing": {
   "it": [
    "Sottostrati e impermeabilizzazione della copertura",
    "Sottostrati, scossaline e membrane impermeabilizzanti forniti e posati."
   ],
   "de": [
    "Unterdeckung und Dachabdichtung",
    "Unterdeckbahnen, Bleche und Abdichtungsbahnen geliefert und verlegt."
   ],
   "uk": [
    "Підкладковий шар і гідроізоляція покрівлі",
    "Підкладку, фартухи й гідроізоляційні мембрани постачено й укладено."
   ],
   "pa": [
    "ਛੱਤ ਦੀ ਅੰਡਰਲੇਅ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ਿੰਗ",
    "ਅੰਡਰਲੇਅ, ਫ਼ਲੈਸ਼ਿੰਗ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ ਝਿੱਲੀਆਂ ਦੇ ਕੇ ਲਾਈਆਂ ਜਾਂਦੀਆਂ ਹਨ।"
   ],
   "tl": [
    "Underlayment at waterproofing ng bubong",
    "Nagbigay at ikinabit ang underlayment, flashing at waterproofing membrane."
   ]
  },
  "fq.general_contracting.roofing.vapor_barrier_coating": {
   "it": [
    "Impermeabilizzazione, barriera al vapore e rivestimento protettivo",
    "Membrane impermeabili, barriere al vapore e protezioni dall'umidità applicate dove l'edificio ne ha bisogno."
   ],
   "de": [
    "Abdichtung, Dampfsperre und Schutzbeschichtung",
    "Abdichtungsbahnen, Dampfsperren und Feuchteschutz dort aufgebracht, wo das Gebäude sie braucht."
   ],
   "uk": [
    "Гідроізоляція, пароізоляція та захисне покриття",
    "Гідроізоляційні мембрани, пароізоляцію й захист від вологи нанесено там, де будівля цього потребує."
   ],
   "pa": [
    "ਵਾਟਰਪਰੂਫ਼ਿੰਗ, ਵੇਪਰ ਬੈਰੀਅਰ ਅਤੇ ਸੁਰੱਖਿਆ ਕੋਟਿੰਗ",
    "ਜਿੱਥੇ ਇਮਾਰਤ ਨੂੰ ਲੋੜ ਹੋਵੇ ਉੱਥੇ ਵਾਟਰਪਰੂਫ਼ ਝਿੱਲੀਆਂ, ਵੇਪਰ ਬੈਰੀਅਰ ਅਤੇ ਨਮੀ ਤੋਂ ਸੁਰੱਖਿਆ ਲਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Waterproofing, vapor barrier at protektibong coating",
    "Inilagay ang waterproofing membrane, vapor barrier at proteksyon sa halumigmig kung saan kailangan ng gusali."
   ]
  },
  "fq.general_contracting.waterproofing.antimicrobial_odor": {
   "it": [
    "Trattamento antimicrobico ed eliminazione odori",
    "Nebulizzazione antimicrobica, trattamento enzimatico e fogging per igienizzare ed eliminare gli odori dopo un danno."
   ],
   "de": [
    "Antimikrobielle Behandlung und Geruchsbeseitigung",
    "Antimikrobielles Sprühen, Enzymbehandlung und Vernebelung, um nach einem Schaden zu desinfizieren und Gerüche zu entfernen."
   ],
   "uk": [
    "Антимікробна обробка та усунення запахів",
    "Антимікробне обприскування, ферментна обробка й туманування для санітарної обробки та усунення запахів після пошкодження."
   ],
   "pa": [
    "ਰੋਗਾਣੂ-ਰੋਧੀ ਇਲਾਜ ਅਤੇ ਬਦਬੂ ਖ਼ਤਮ ਕਰਨਾ",
    "ਨੁਕਸਾਨ ਤੋਂ ਬਾਅਦ ਕੀਟਾਣੂ-ਰਹਿਤ ਕਰਨ ਅਤੇ ਬਦਬੂ ਹਟਾਉਣ ਲਈ ਰੋਗਾਣੂ-ਰੋਧੀ ਛਿੜਕਾਅ, ਐਨਜ਼ਾਈਮ ਇਲਾਜ ਅਤੇ ਫੌਗਿੰਗ।"
   ],
   "tl": [
    "Antimicrobial na gamot at pag-alis ng amoy",
    "Antimicrobial na pag-spray, enzyme treatment at fogging para mag-sanitize at mag-alis ng amoy pagkatapos ng pinsala."
   ]
  },
  "fq.general_contracting.waterproofing.containment": {
   "it": [
    "Barriere di contenimento e teli protettivi",
    "Contenimenti in plastica, zone filtro e camere di decontaminazione allestiti per isolare l'area di lavoro."
   ],
   "de": [
    "Abschottungen und Schutzfolien",
    "Kunststoffabschottungen, Schleusen und Dekontaminationskammern aufgebaut, um den Arbeitsbereich abzutrennen."
   ],
   "uk": [
    "Захисні бар'єри та плівки",
    "Пластикові бар'єри, шлюзи й камери дезактивації встановлено, щоб ізолювати робочу зону."
   ],
   "pa": [
    "ਰੋਕ ਵਾਲੀਆਂ ਰੁਕਾਵਟਾਂ ਅਤੇ ਸੁਰੱਖਿਆ ਚਾਦਰਾਂ",
    "ਕੰਮ ਵਾਲੀ ਥਾਂ ਵੱਖ ਕਰਨ ਲਈ ਪਲਾਸਟਿਕ ਘੇਰੇ, ਏਅਰਲੌਕ ਅਤੇ ਡੀਕੰਟੈਮੀਨੇਸ਼ਨ ਕਮਰੇ ਬਣਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Containment barrier at protektibong sheeting",
    "Nagtayo ng plastic containment, airlock at decontamination chamber para ihiwalay ang lugar ng trabaho."
   ]
  },
  "fq.general_contracting.openings.garage_opener_hardware": {
   "it": [
    "Ferramenta e fissaggio motore porta garage",
    "Guide del motore, angolari di fissaggio e alloggiamenti forniti e installati."
   ],
   "de": [
    "Beschläge und Montage für Garagentorantriebe",
    "Antriebsschienen, Montagewinkel und Gehäuse geliefert und montiert."
   ],
   "uk": [
    "Фурнітура та кріплення приводу гаражних воріт",
    "Напрямні приводу, монтажні кутники й корпуси постачено й встановлено."
   ],
   "pa": [
    "ਗੈਰਾਜ ਓਪਨਰ ਹਾਰਡਵੇਅਰ ਅਤੇ ਮਾਊਂਟਿੰਗ",
    "ਓਪਨਰ ਟ੍ਰੈਕ, ਮਾਊਂਟਿੰਗ ਐਂਗਲ ਅਤੇ ਹਾਊਸਿੰਗ ਦੇ ਕੇ ਲਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Hardware at pagkakabit ng garage door opener",
    "Nagbigay at ikinabit ang track ng opener, mounting angle at housing."
   ]
  },
  "fq.general_contracting.openings.windows_glass": {
   "it": [
    "Installazione finestre e vetrate residenziali",
    "Finestre a ghigliottina, scorrevoli e fisse fornite e installate, con scossaline e sigillatura."
   ],
   "de": [
    "Einbau von Wohnhausfenstern und Glaseinheiten",
    "Schiebe-, Hebe- und Festfenster geliefert und eingebaut, mit Anschlussblechen und Abdichtung."
   ],
   "uk": [
    "Встановлення вікон і склопакетів у житло",
    "Підйомні, розсувні й глухі вікна постачено й встановлено з відливами та герметизацією."
   ],
   "pa": [
    "ਘਰੇਲੂ ਖਿੜਕੀਆਂ ਅਤੇ ਸ਼ੀਸ਼ਾ ਯੂਨਿਟ ਲਾਉਣਾ",
    "ਡਬਲ-ਹੰਗ, ਸਲਾਈਡਰ ਅਤੇ ਪਿਕਚਰ ਖਿੜਕੀਆਂ ਦੇ ਕੇ ਲਾਈਆਂ, ਫ਼ਲੈਸ਼ ਅਤੇ ਸੀਲ ਕੀਤੀਆਂ ਜਾਂਦੀਆਂ ਹਨ।"
   ],
   "tl": [
    "Pagkakabit ng bintana at salamin sa bahay",
    "Nagbigay at ikinabit ang double-hung, slider at picture window, may flashing at selyo."
   ]
  },
  "fq.general_contracting.consulting.diagnostic_visit": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਘਰ ਵਿੱਚ ਕੁਝ ਠੀਕ ਨਹੀਂ ਚੱਲ ਰਿਹਾ: ਟੈਕਨੀਸ਼ੀਅਨ ਆ ਕੇ ਕਾਰਨ ਲੱਭਦਾ ਹੈ ਅਤੇ ਦੱਸਦਾ ਹੈ ਕਿ ਠੀਕ ਕਰਨ ਲਈ ਕੀ ਲੱਗੇਗਾ।"
   ]
  },
  "fq.general_contracting.consulting.repair_visit": {
   "pa": [
    "ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਘਰ ਦੇ ਕਿਸੇ ਨੁਕਸ ਦੀ ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ ਲਈ ਸੱਦਾ, ਹੋ ਸਕੇ ਤਾਂ ਉਸੇ ਵਿਜ਼ਿਟ ਵਿੱਚ ਠੀਕ।"
   ]
  },
  "fq.general_contracting.consulting.kitchen_design": {
   "pa": [
    "ਰਸੋਈ ਡਿਜ਼ਾਈਨ ਅਤੇ ਯੋਜਨਾ ਸਲਾਹ",
    "ਮੌਕੇ 'ਤੇ ਰਸੋਈ ਮਾਪੀ, ਗਾਹਕ ਨਾਲ ਕੰਮ ਦਾ ਦਾਇਰਾ ਤੈਅ ਅਤੇ ਮੁੱਢਲੇ ਲੇਆਊਟ ਵਿਕਲਪ ਬਣਾਏ ਜਾਂਦੇ ਹਨ।"
   ]
  },
  "fq.general_contracting.consulting.kitchen_project_management": {
   "pa": [
    "ਰਸੋਈ ਨਵੀਨੀਕਰਨ ਦਾ ਪ੍ਰੋਜੈਕਟ ਪ੍ਰਬੰਧ",
    "ਪਰਮਿਟ ਲਏ, ਉਪ-ਠੇਕੇਦਾਰਾਂ ਦਾ ਸਮਾਂ ਤੈਅ ਅਤੇ ਢਾਹੁਣ ਤੋਂ ਆਖ਼ਰੀ ਚੱਕਰ ਤੱਕ ਹਰ ਜਾਂਚ ਦਾ ਤਾਲਮੇਲ।"
   ]
  },
  "fq.general_contracting.renovation.whole_home_scope": {
   "pa": [
    "ਪੂਰੇ ਘਰ ਦਾ ਡਿਜ਼ਾਈਨ ਅਤੇ ਕੰਮ ਦਾ ਦਾਇਰਾ",
    "ਪੂਰੇ ਨਵੀਨੀਕਰਨ ਲਈ ਕਈ ਕਾਰੀਗਰਾਂ ਦਾ ਦਾਇਰਾ ਦਸਤਾਵੇਜ਼, ਕੰਮ ਦਾ ਕ੍ਰਮ ਅਤੇ ਖ਼ਰਚ ਹੱਦਾਂ ਦੀ ਸੂਚੀ ਤਿਆਰ ਕੀਤੀ ਜਾਂਦੀ ਹੈ।"
   ]
  },
  "fq.general_contracting.renovation.whole_home_finish_labour": {
   "pa": [
    "ਪੂਰੇ ਘਰ ਦੇ ਨਵੀਨੀਕਰਨ ਦੀ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਨਵੀਨੀਕਰਨ ਵਾਲੇ ਹਿੱਸੇ ਵਿੱਚ ਫ਼ਰੇਮਿੰਗ ਸੁਧਾਰ, ਡ੍ਰਾਈਵਾਲ, ਪੇਂਟ ਅਤੇ ਟ੍ਰਿਮ, ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ; ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਦਾ ਖ਼ਾਸ ਕੰਮ ਵੱਖਰਾ।"
   ]
  },
  "fq.general_contracting.renovation.whole_home_project_management": {
   "pa": [
    "ਪੂਰੇ ਘਰ ਦੇ ਨਵੀਨੀਕਰਨ ਦਾ ਪ੍ਰੋਜੈਕਟ ਪ੍ਰਬੰਧ",
    "ਨਵੀਨੀਕਰਨ ਦੇ ਹਰ ਕਮਰੇ ਵਿੱਚ ਕਾਰੀਗਰਾਂ ਦਾ ਕ੍ਰਮ, ਪਰਮਿਟ ਅਤੇ ਜਾਂਚਾਂ ਮੁਕੰਮਲ ਹੋਣ ਤੱਕ ਸੰਭਾਲੀਆਂ ਜਾਂਦੀਆਂ ਹਨ।"
   ]
  },
  "fq.general_contracting.renovation.basement_moisture_prep": {
   "pa": [
    "ਬੇਸਮੈਂਟ ਨਮੀ ਅਤੇ ਢਾਂਚਾਗਤ ਤਿਆਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਬੇਸਮੈਂਟ ਮੁਕੰਮਲ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਨਮੀ ਜਾਂਚੀ, ਵੇਪਰ ਬੈਰੀਅਰ ਵਿਛਾਇਆ ਅਤੇ ਕੰਕਰੀਟ ਨਾਲ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਫ਼ਰੇਮਿੰਗ ਤਿਆਰ।"
   ]
  },
  "fq.general_contracting.renovation.basement_framing_rough_in": {
   "pa": [
    "ਬੇਸਮੈਂਟ ਫ਼ਰੇਮਿੰਗ ਅਤੇ ਰਫ਼-ਇਨ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਮੁਕੰਮਲ ਬੇਸਮੈਂਟ ਲਈ ਕੰਧਾਂ ਫ਼ਰੇਮ ਅਤੇ ਬਿਜਲੀ ਅਤੇ ਪਲੰਬਿੰਗ ਰਫ਼-ਇਨ ਦਾ ਤਾਲਮੇਲ, ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "fq.general_contracting.renovation.basement_finish": {
   "pa": [
    "ਬੇਸਮੈਂਟ ਮੁਕੰਮਲ ਕਰਨ ਦੀ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਪੂਰੀ ਬੇਸਮੈਂਟ ਵਿੱਚ ਡ੍ਰਾਈਵਾਲ, ਪੇਂਟ, ਟ੍ਰਿਮ ਅਤੇ ਫ਼ਰਸ਼, ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "fq.general_contracting.renovation.egress_window": {
   "pa": [
    "ਬੇਸਮੈਂਟ ਐਗ੍ਰੈੱਸ ਖਿੜਕੀ ਜੋੜਨਾ",
    "ਨੀਂਹ ਕੱਟੀ, ਨਿਯਮਾਂ ਮੁਤਾਬਕ ਐਗ੍ਰੈੱਸ ਖਿੜਕੀ ਲਾਈ ਅਤੇ ਖਿੜਕੀ ਦਾ ਖੂਹ ਬਣਾਇਆ, ਪ੍ਰਤੀ ਖਿੜਕੀ।"
   ]
  },
  "fq.general_contracting.renovation.whole_home_demolition": {
   "pa": [
    "ਪੂਰੇ ਘਰ ਦੀ ਢਾਹ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਨਵੀਨੀਕਰਨ ਦੇ ਹਰ ਕਮਰੇ ਵਿੱਚੋਂ ਮੌਜੂਦਾ ਫ਼ਿਨਿਸ਼ ਉਤਾਰ ਕੇ ਲਿਜਾਏ, ਨਵੀਨੀਕਰਨ ਵਾਲੇ ਹਿੱਸੇ ਦੇ ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ।"
   ]
  }
 },
 "lines": {
  "Demolition and waterproofing prep": {
   "pa": [
    "ਢਾਹੁਣਾ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ਿੰਗ ਦੀ ਤਿਆਰੀ",
    "ਫ਼ਿਕਸਚਰ ਅਤੇ ਟਾਈਲ ਕੱਢੇ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ ਝਿੱਲੀ ਲਈ ਸਤਹ ਤਿਆਰ।"
   ]
  },
  "Bathroom remodel installation labour — builder grade": {
   "pa": [
    "ਬਾਥਰੂਮ ਨਵੀਨੀਕਰਨ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ — ਬਿਲਡਰ ਗ੍ਰੇਡ",
    "ਟੱਬ ਜਾਂ ਸ਼ਾਵਰ, ਵੈਨਿਟੀ, ਟਾਈਲ ਅਤੇ ਫ਼ਿਕਸਚਰ ਆਮ ਫ਼ਿਨਿਸ਼ ਵਿੱਚ ਲਾਏ।"
   ]
  },
  "Tile setting labour — per sq ft": {
   "pa": [
    "ਟਾਈਲ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਤਿਆਰ ਅਤੇ ਵਾਟਰਪਰੂਫ਼ ਸਤਹ 'ਤੇ ਟਾਈਲ, ਗ੍ਰਾਊਟ ਅਤੇ ਕੋਨਿਆਂ 'ਤੇ ਕੌਕ।"
   ]
  },
  "Thinset mortar — per bag": {
   "pa": [
    "ਥਿਨਸੈੱਟ ਮਸਾਲਾ — ਪ੍ਰਤੀ ਬੈਗ",
    "ਮੋਡੀਫ਼ਾਈਡ ਥਿਨਸੈੱਟ, 50 lb; 1/4 ਇੰਚ ਨੌਚ ਨਾਲ ਇੱਕ ਬੈਗ ਲਗਭਗ 95 ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Sanded grout": {
   "pa": [
    "ਰੇਤ ਵਾਲਾ ਗ੍ਰਾਊਟ",
    "ਜੋੜਾਂ ਲਈ ਰੇਤ ਵਾਲਾ ਗ੍ਰਾਊਟ; ਮਾਤਰਾ ਸਟੋਰ ਵਾਲੇ ਬੈਗ ਦੀ ਢਕਾਈ ਮੁਤਾਬਕ।"
   ]
  },
  "Waterproofing membrane — per sq ft": {
   "pa": [
    "ਵਾਟਰਪਰੂਫ਼ ਝਿੱਲੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਸ਼ਾਵਰ ਦੀਆਂ ਕੰਧਾਂ ਅਤੇ ਫ਼ਰਸ਼ 'ਤੇ ਸ਼ੀਟ ਜਾਂ ਤਰਲ ਵਾਟਰਪਰੂਫ਼ਿੰਗ।"
   ]
  },
  "Crack injection labour — per linear ft": {
   "pa": [
    "ਤਰੇੜ ਇੰਜੈਕਸ਼ਨ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਤਰੇੜ ਖੋਲ੍ਹੀ, ਪੋਰਟ ਲਾਏ ਅਤੇ ਪੂਰੀ ਡੂੰਘਾਈ ਤੱਕ ਐਪੌਕਸੀ ਜਾਂ ਪੌਲੀਯੂਰੀਥੇਨ ਭਰਿਆ।"
   ]
  },
  "Injection resin and ports — per linear ft": {
   "pa": [
    "ਇੰਜੈਕਸ਼ਨ ਰੈਜ਼ਿਨ ਅਤੇ ਪੋਰਟ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਐਪੌਕਸੀ ਜਾਂ ਪੌਲੀਯੂਰੀਥੇਨ ਰੈਜ਼ਿਨ, ਸਤਹ ਪੇਸਟ ਅਤੇ ਇੰਜੈਕਸ਼ਨ ਪੋਰਟ।"
   ]
  },
  "Heating and cooling tune-up": {
   "pa": [
    "ਹੀਟਿੰਗ ਅਤੇ ਕੂਲਿੰਗ ਟਿਊਨ-ਅੱਪ",
    "ਦੋਵੇਂ ਸਿਸਟਮ ਜਾਂਚੇ, ਸਾਫ਼ ਅਤੇ ਠੀਕ ਕੀਤੇ, ਫ਼ਿਲਟਰ ਬਦਲੇ ਅਤੇ ਰੀਡਿੰਗਾਂ ਲਿਖੀਆਂ।"
   ]
  },
  "Pleated air filter": {
   "pa": [
    "ਪਲੀਟਿਡ ਏਅਰ ਫ਼ਿਲਟਰ",
    "1 ਇੰਚ ਪਲੀਟਿਡ ਫ਼ਿਲਟਰ, MERV 11, ਸਿਸਟਮ ਦੇ ਨਾਪ ਦਾ।"
   ]
  },
  "Demolition labour — per sq ft": {
   "pa": [
    "ਢਾਹੁਣ ਦੀ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਕੈਬਨਿਟ, ਕਾਊਂਟਰਟੌਪ ਅਤੇ ਫ਼ਰਸ਼ ਕੱਢ ਕੇ ਲਿਜਾਏ, ਰਸੋਈ ਦੇ ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Cabinetry and countertop installation labour — builder grade": {
   "pa": [
    "ਕੈਬਨਿਟ ਅਤੇ ਕਾਊਂਟਰਟੌਪ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ — ਬਿਲਡਰ ਗ੍ਰੇਡ",
    "ਤਿਆਰ ਕੈਬਨਿਟ ਲਾ ਕੇ ਪੱਧਰੇ, ਕਾਊਂਟਰਟੌਪ ਦਾ ਨਮੂਨਾ ਲੈ ਕੇ ਲਾਇਆ; ਸਮਾਨ ਵੱਖਰਾ ਬਿੱਲ।"
   ]
  },
  "Backsplash tile installation": {
   "pa": [
    "ਬੈਕਸਪਲੈਸ਼ ਟਾਈਲ ਲਾਉਣਾ",
    "ਬੈਕਸਪਲੈਸ਼ 'ਤੇ ਟਾਈਲ, ਗ੍ਰਾਊਟ ਅਤੇ ਕਾਊਂਟਰ ਕੋਲ ਕੌਕ।"
   ]
  },
  "Drywall patch and finish — per sq ft": {
   "pa": [
    "ਡ੍ਰਾਈਵਾਲ ਪੈਚ ਅਤੇ ਫ਼ਿਨਿਸ਼ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਖ਼ਰਾਬ ਬੋਰਡ ਕੱਟਿਆ, ਨਵਾਂ ਲਾਇਆ, ਟੇਪ, ਤਿੰਨ ਕੋਟ ਕੰਪਾਊਂਡ ਅਤੇ ਪੇਂਟ ਲਈ ਰਗੜਾਈ।"
   ]
  },
  "Drywall sheet — 1/2 in 4 × 8": {
   "pa": [
    "ਡ੍ਰਾਈਵਾਲ ਸ਼ੀਟ — 1/2 ਇੰਚ 4 × 8",
    "ਹਲਕਾ 1/2 ਇੰਚ ਬੋਰਡ; ਇੱਕ ਸ਼ੀਟ 32 ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Joint compound": {
   "pa": [
    "ਜੋੜ ਕੰਪਾਊਂਡ",
    "ਆਮ ਵਰਤੋਂ ਵਾਲਾ ਤਿਆਰ ਮਿਸ਼ਰਣ; ਇੱਕ ਬਾਲਟੀ ਜਾਂ ਡੱਬਾ ਤਿੰਨ ਕੋਟਾਂ ਵਿੱਚ ਲਗਭਗ 350 ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Paper joint tape — per roll": {
   "pa": [
    "ਕਾਗ਼ਜ਼ੀ ਜੋੜ ਟੇਪ — ਪ੍ਰਤੀ ਰੋਲ",
    "500 ਫੁੱਟ ਰੋਲ; ਲਗਭਗ 13 ਸ਼ੀਟਾਂ ਲਈ ਕਾਫ਼ੀ।"
   ]
  },
  "Spring start-up visit": {
   "pa": [
    "ਬਸੰਤ ਚਾਲੂ ਕਰਨ ਦੀ ਵਿਜ਼ਿਟ",
    "ਬਾਹਰੀ ਲਾਈਨਾਂ ਅਤੇ ਹੋਜ਼ ਟੂਟੀਆਂ ਖੋਲ੍ਹ ਕੇ ਜਾਂਚੀਆਂ, ਵਾਟਰ ਹੀਟਰ ਚਾਲੂ, ਫ਼ਲੱਸ਼ ਅਤੇ ਸੈੱਟ।"
   ]
  },
  "Anode rod": {
   "pa": [
    "ਐਨੋਡ ਰਾਡ",
    "ਮੈਗਨੀਸ਼ੀਅਮ ਜਾਂ ਐਲੂਮੀਨੀਅਮ ਐਨੋਡ ਰਾਡ, ਜੇ ਪੁਰਾਣੀ ਖ਼ਤਮ ਹੋਵੇ ਤਾਂ ਲਾਈ।"
   ]
  },
  "Gutter cleaning — per linear ft": {
   "pa": [
    "ਪਰਨਾਲਿਆਂ ਦੀ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਪਰਨਾਲੇ ਖ਼ਾਲੀ ਅਤੇ ਫ਼ਲੱਸ਼, ਡਾਊਨਸਪਾਊਟ ਸਾਫ਼ ਅਤੇ ਢਲਾਣ ਅਤੇ ਲੀਕ ਲਈ ਜਾਂਚ।"
   ]
  },
  "Repair": {
   "pa": [
    "ਮੁਰੰਮਤ",
    "ਮੌਕੇ 'ਤੇ ਨੁਕਸ ਲੱਭ ਕੇ ਠੀਕ ਕੀਤਾ।"
   ]
  },
  "Design and planning fee": {
   "pa": [
    "ਡਿਜ਼ਾਈਨ ਅਤੇ ਯੋਜਨਾ ਫ਼ੀਸ",
    "ਮੌਕੇ 'ਤੇ ਪਹਿਲੀ ਡਿਜ਼ਾਈਨ ਸਲਾਹ ਅਤੇ ਕੰਮ ਦਾ ਦਾਇਰਾ।"
   ]
  },
  "Project management and permit coordination fee": {
   "pa": [
    "ਪ੍ਰੋਜੈਕਟ ਪ੍ਰਬੰਧ ਅਤੇ ਪਰਮਿਟ ਤਾਲਮੇਲ ਫ਼ੀਸ",
    "ਮੁਕੰਮਲ ਹੋਣ ਤੱਕ ਪਰਮਿਟ, ਕਾਰੀਗਰਾਂ ਦਾ ਸਮਾਂ ਅਤੇ ਜਾਂਚਾਂ ਦਾ ਪ੍ਰਬੰਧ।"
   ]
  },
  "Design and scope development fee": {
   "pa": [
    "ਡਿਜ਼ਾਈਨ ਅਤੇ ਦਾਇਰਾ ਤਿਆਰ ਕਰਨ ਦੀ ਫ਼ੀਸ",
    "ਪੂਰੇ ਘਰ ਦਾ ਦਾਇਰਾ, ਕਾਰੀਗਰਾਂ ਦਾ ਕ੍ਰਮ ਅਤੇ ਖ਼ਰਚ ਹੱਦਾਂ ਲਿਖੀਆਂ।"
   ]
  },
  "Renovation installation labour — per sq ft, builder grade": {
   "pa": [
    "ਨਵੀਨੀਕਰਨ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ, ਬਿਲਡਰ ਗ੍ਰੇਡ",
    "ਨਵੀਨੀਕਰਨ ਵਾਲੇ ਹਿੱਸੇ ਵਿੱਚ ਫ਼ਰੇਮਿੰਗ ਸੁਧਾਰ, ਡ੍ਰਾਈਵਾਲ, ਪੇਂਟ ਅਤੇ ਟ੍ਰਿਮ।"
   ]
  },
  "Moisture prep and vapour barrier labour — per sq ft": {
   "pa": [
    "ਨਮੀ ਦੀ ਤਿਆਰੀ ਅਤੇ ਵੇਪਰ ਬੈਰੀਅਰ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਨਮੀ ਜਾਂਚੀ, ਵੇਪਰ ਬੈਰੀਅਰ ਲਾਇਆ ਅਤੇ ਕੰਕਰੀਟ ਨਾਲ ਫ਼ਰੇਮਿੰਗ ਤਿਆਰ।"
   ]
  },
  "Framing and rough-in labour — per sq ft": {
   "pa": [
    "ਫ਼ਰੇਮਿੰਗ ਅਤੇ ਰਫ਼-ਇਨ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਕੰਧਾਂ ਫ਼ਰੇਮ ਅਤੇ ਰਫ਼-ਇਨ ਕਾਰੀਗਰਾਂ ਦਾ ਤਾਲਮੇਲ।"
   ]
  },
  "Basement finish labour — per sq ft, builder grade": {
   "pa": [
    "ਬੇਸਮੈਂਟ ਮੁਕੰਮਲ ਕਰਨ ਦੀ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ, ਬਿਲਡਰ ਗ੍ਰੇਡ",
    "ਡ੍ਰਾਈਵਾਲ, ਪੇਂਟ, ਟ੍ਰਿਮ ਅਤੇ ਫ਼ਰਸ਼ ਲਾਏ।"
   ]
  },
  "Egress window addition labour": {
   "pa": [
    "ਐਗ੍ਰੈੱਸ ਖਿੜਕੀ ਜੋੜਨ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਨੀਂਹ ਵਿੱਚ ਮੋਰੀ ਕੱਟੀ, ਖਿੜਕੀ ਲਾ ਕੇ ਫ਼ਲੈਸ਼, ਖੂਹ ਲਾਇਆ ਅਤੇ ਮਿੱਟੀ ਭਰੀ।"
   ]
  },
  "Egress window and well": {
   "pa": [
    "ਐਗ੍ਰੈੱਸ ਖਿੜਕੀ ਅਤੇ ਖੂਹ",
    "ਨਿਯਮਾਂ ਦੇ ਨਾਪ ਦੀ ਕੇਸਮੈਂਟ ਖਿੜਕੀ, ਖਿੜਕੀ ਦਾ ਖੂਹ, ਢੱਕਣ ਅਤੇ ਨਿਕਾਸੀ ਬਜਰੀ।"
   ]
  }
 }
};
