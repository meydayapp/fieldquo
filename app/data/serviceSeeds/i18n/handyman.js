// app/data/serviceSeeds/i18n/handyman.js
//
// The languages handyman.js does not write inline — Italian, German,
// Ukrainian, Punjabi (Gurmukhi) and Tagalog for its categories and services,
// and Punjabi for its template lines (keyed by the English line name) — merged
// by withLanguages in ../_templateLines.js. Hand-written trade wording, no
// machine translation; checked by scripts/check-seed-languages.mjs.
export const I18N = {
 "categories": {
  "assembly": {
   "it": "Montaggio e installazione",
   "de": "Montage und Einbau",
   "uk": "Збирання та монтаж",
   "pa": "ਜੋੜਨਾ ਅਤੇ ਲਾਉਣਾ",
   "tl": "Pag-assemble at pagkakabit"
  },
  "carpentry": {
   "it": "Falegnameria, mobili e finiture",
   "de": "Tischlerei, Schränke und Leisten",
   "uk": "Столярка, шафи та оздоблення",
   "pa": "ਤਰਖਾਣੀ, ਕੈਬਨਿਟ ਅਤੇ ਟ੍ਰਿਮ",
   "tl": "Karpinterya, kabinet at trim"
  },
  "labour": {
   "it": "Pulizia e lavori generici",
   "de": "Aufräumen und allgemeine Arbeiten",
   "uk": "Прибирання та загальні роботи",
   "pa": "ਸਫ਼ਾਈ ਅਤੇ ਆਮ ਮਜ਼ਦੂਰੀ",
   "tl": "Paglilinis at pangkalahatang trabaho"
  },
  "doors_windows": {
   "it": "Porte, finestre e ferramenta",
   "de": "Türen, Fenster und Beschläge",
   "uk": "Двері, вікна та фурнітура",
   "pa": "ਦਰਵਾਜ਼ੇ, ਖਿੜਕੀਆਂ ਅਤੇ ਹਾਰਡਵੇਅਰ",
   "tl": "Pinto, bintana at hardware"
  },
  "electrical": {
   "it": "Elettricità e illuminazione",
   "de": "Elektro und Beleuchtung",
   "uk": "Електрика та освітлення",
   "pa": "ਬਿਜਲੀ ਅਤੇ ਰੋਸ਼ਨੀ",
   "tl": "Kuryente at ilaw"
  },
  "exterior": {
   "it": "Esterni, deck e recinzioni",
   "de": "Außenbereich, Decks und Zäune",
   "uk": "Зовнішні роботи, тераси та паркани",
   "pa": "ਬਾਹਰੀ ਕੰਮ, ਡੈੱਕ ਅਤੇ ਵਾੜਾਂ",
   "tl": "Labas, deck at bakod"
  },
  "flooring": {
   "it": "Pavimenti e piastrelle",
   "de": "Böden und Fliesen",
   "uk": "Підлога та плитка",
   "pa": "ਫ਼ਰਸ਼ ਅਤੇ ਟਾਈਲ",
   "tl": "Sahig at tile"
  },
  "hvac": {
   "it": "Climatizzazione e ventilazione",
   "de": "Heizung/Klima und Lüftung",
   "uk": "Опалення/кондиціювання та вентиляція",
   "pa": "HVAC ਅਤੇ ਹਵਾਦਾਰੀ",
   "tl": "HVAC at bentilasyon"
  },
  "painting": {
   "it": "Tinteggiatura, cartongesso e finiture",
   "de": "Malerarbeiten, Trockenbau und Oberflächen",
   "uk": "Фарбування, гіпсокартон та оздоблення",
   "pa": "ਪੇਂਟ, ਡ੍ਰਾਈਵਾਲ ਅਤੇ ਫ਼ਿਨਿਸ਼",
   "tl": "Pintura, drywall at finishing"
  },
  "plumbing": {
   "it": "Idraulica",
   "de": "Sanitär",
   "uk": "Сантехніка",
   "pa": "ਪਲੰਬਿੰਗ",
   "tl": "Tubero"
  }
 },
 "services": {
  "fq.handyman.assembly.furniture": {
   "pa": [
    "ਫ਼ਰਨੀਚਰ ਜੋੜਨਾ ਅਤੇ ਲਾਉਣਾ",
    "ਫ਼ਲੈਟ-ਪੈਕ ਫ਼ਰਨੀਚਰ, ਸ਼ੈਲਫ਼ਾਂ ਅਤੇ ਫ਼ਿਕਸਚਰ ਜੋੜੇ, ਪੱਧਰੇ ਅਤੇ ਜਿੱਥੇ ਲੋੜ ਹੋਵੇ ਕੰਧ ਨਾਲ ਪੱਕੇ ਕੀਤੇ।"
   ]
  },
  "fq.handyman.assembly.hot_tub": {
   "it": [
    "Installazione vasca idromassaggio",
    "Vasca idromassaggio posata sulla base, livellata e collegata al sezionatore predisposto dall'elettricista."
   ],
   "de": [
    "Whirlpool aufstellen",
    "Ein Whirlpool auf sein Fundament gesetzt, ausgerichtet und an den vom Elektriker vorbereiteten Trennschalter angeschlossen."
   ],
   "uk": [
    "Встановлення гідромасажної ванни",
    "Гідромасажну ванну встановлено на основу, вирівняно й під'єднано до вимикача, підготовленого електриком."
   ],
   "pa": [
    "ਹੌਟ ਟੱਬ ਲਾਉਣਾ",
    "ਹੌਟ ਟੱਬ ਆਪਣੇ ਪੈਡ ਉੱਤੇ ਰੱਖ ਕੇ ਪੱਧਰਾ ਅਤੇ ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ ਦੇ ਛੱਡੇ ਡਿਸਕਨੈਕਟ ਨਾਲ ਜੋੜਿਆ।"
   ],
   "tl": [
    "Pagkakabit ng hot tub",
    "Inilagay sa pad ang hot tub, pinantay at ikinonekta sa disconnect na iniwan ng elektrisyan."
   ]
  },
  "fq.handyman.carpentry.siding_trim_repair": {
   "it": [
    "Riparazione rivestimento e finiture esterne",
    "Rivestimento, finiture e legno marcio danneggiati tagliati e sostituiti in tinta."
   ],
   "de": [
    "Reparatur von Fassade und Außenleisten",
    "Beschädigte Verkleidung, Leisten und morsches Holz herausgeschnitten und passend ersetzt."
   ],
   "uk": [
    "Ремонт зовнішнього облицювання та оздоблення",
    "Пошкоджене облицювання, планки й гнилу деревину вирізано й замінено в тон."
   ],
   "pa": [
    "ਬਾਹਰੀ ਸਾਈਡਿੰਗ ਅਤੇ ਟ੍ਰਿਮ ਦੀ ਮੁਰੰਮਤ",
    "ਖ਼ਰਾਬ ਸਾਈਡਿੰਗ, ਟ੍ਰਿਮ ਅਤੇ ਸੜੀ ਲੱਕੜ ਕੱਟ ਕੇ ਮੇਲ ਖਾਂਦੀ ਨਾਲ ਬਦਲੀ।"
   ],
   "tl": [
    "Pagkukumpuni ng siding at trim sa labas",
    "Ginupit at pinalitan nang katugma ang sirang siding, trim at bulok na kahoy."
   ]
  },
  "fq.handyman.carpentry.cabinet_install": {
   "pa": [
    "ਕੈਬਨਿਟ ਲਾਉਣਾ",
    "ਕੈਬਨਿਟ ਪੱਧਰੇ ਅਤੇ ਸਿੱਧੇ ਟੰਗੇ, ਸਟੱਡਾਂ ਅਤੇ ਇੱਕ-ਦੂਜੇ ਨਾਲ ਕੱਸੇ, ਦਰਵਾਜ਼ੇ ਸਿੱਧੇ।"
   ]
  },
  "fq.handyman.carpentry.crown_molding": {
   "pa": [
    "ਕ੍ਰਾਊਨ ਮੋਲਡਿੰਗ ਲਾਉਣਾ",
    "ਛੱਤ ਦੀ ਲਾਈਨ ਉੱਤੇ ਕ੍ਰਾਊਨ ਮੋਲਡਿੰਗ ਕੱਟ ਕੇ ਲਾਈ, ਕਿੱਲਾਂ ਦੇ ਛੇਕ ਭਰੇ ਅਤੇ ਕੌਕ।"
   ]
  },
  "fq.handyman.labour.hourly": {
   "pa": [
    "ਹੈਂਡੀਮੈਨ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਘੰਟਾ",
    "ਛੋਟੀਆਂ ਮੁਰੰਮਤਾਂ ਅਤੇ ਫੁਟਕਲ ਕੰਮਾਂ ਲਈ ਆਮ ਮਜ਼ਦੂਰੀ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "fq.handyman.labour.site_prep_debris": {
   "it": [
    "Preparazione area e rimozione detriti",
    "Vegetazione tolta, area preparata e detriti portati via."
   ],
   "de": [
    "Flächenvorbereitung und Schuttabfuhr",
    "Bewuchs entfernt, die Fläche vorbereitet und Schutt abtransportiert."
   ],
   "uk": [
    "Підготовка ділянки та вивезення сміття",
    "Рослинність прибрано, ділянку підготовлено, сміття вивезено."
   ],
   "pa": [
    "ਥਾਂ ਦੀ ਤਿਆਰੀ ਅਤੇ ਮਲਬਾ ਹਟਾਉਣਾ",
    "ਝਾੜੀਆਂ ਸਾਫ਼, ਥਾਂ ਤਿਆਰ ਅਤੇ ਮਲਬਾ ਲਿਜਾਇਆ।"
   ],
   "tl": [
    "Paghahanda ng lugar at pag-aalis ng debris",
    "Nilinis ang halaman, inihanda ang lugar at hinakot ang debris."
   ]
  },
  "fq.handyman.doors_windows.closet_doors": {
   "it": [
    "Installazione o riparazione ante e ripiani dell'armadio a muro",
    "Ante dell'armadio rimontate o sostituite e sistemi di ripiani installati."
   ],
   "de": [
    "Schranktüren und Regale einbauen oder reparieren",
    "Schranktüren neu eingehängt oder ersetzt und Regalsysteme eingebaut."
   ],
   "uk": [
    "Монтаж чи ремонт дверей і полиць гардероба",
    "Двері гардероба перевішено чи замінено, системи полиць встановлено."
   ],
   "pa": [
    "ਅਲਮਾਰੀ ਦੇ ਦਰਵਾਜ਼ੇ ਅਤੇ ਸ਼ੈਲਫ਼ਾਂ ਲਾਉਣਾ ਜਾਂ ਮੁਰੰਮਤ",
    "ਅਲਮਾਰੀ ਦੇ ਦਰਵਾਜ਼ੇ ਮੁੜ ਟੰਗੇ ਜਾਂ ਬਦਲੇ ਅਤੇ ਸ਼ੈਲਫ਼ ਸਿਸਟਮ ਲਾਏ।"
   ],
   "tl": [
    "Pagkakabit o pagkukumpuni ng pinto at estante ng closet",
    "Muling isinabit o pinalitan ang pinto ng closet at ikinabit ang estante."
   ]
  },
  "fq.handyman.doors_windows.closet_remodel": {
   "it": [
    "Rifacimento armadio a muro con ripiani, ante e ferramenta",
    "Armadio a muro ricostruito con nuovi ripiani, ante e ferramenta."
   ],
   "de": [
    "Schrankumbau mit Regalen, Türen und Beschlägen",
    "Ein Einbauschrank mit neuen Regalen, Türen und Beschlägen neu aufgebaut."
   ],
   "uk": [
    "Переобладнання гардероба з полицями, дверима й фурнітурою",
    "Гардероб перебудовано з новими полицями, дверима й фурнітурою."
   ],
   "pa": [
    "ਅਲਮਾਰੀ ਦਾ ਨਵੀਨੀਕਰਨ — ਸ਼ੈਲਫ਼ਾਂ, ਦਰਵਾਜ਼ੇ ਅਤੇ ਹਾਰਡਵੇਅਰ",
    "ਨਵੀਆਂ ਸ਼ੈਲਫ਼ਾਂ, ਦਰਵਾਜ਼ਿਆਂ ਅਤੇ ਹਾਰਡਵੇਅਰ ਨਾਲ ਅਲਮਾਰੀ ਮੁੜ ਬਣਾਈ।"
   ],
   "tl": [
    "Pag-remodel ng closet na may estante, pinto at hardware",
    "Muling itinayo ang closet na may bagong estante, pinto at hardware."
   ]
  },
  "fq.handyman.doors_windows.hardware_alignment": {
   "it": [
    "Riparazione e regolazione ferramenta di porte e mobili",
    "Cerniere, serrature, maniglie e ferramenta dei mobili regolate, riparate o sostituite."
   ],
   "de": [
    "Tür- und Schrankbeschläge reparieren und einstellen",
    "Scharniere, Schlösser, Griffe und Schrankbeschläge eingestellt, repariert oder ersetzt."
   ],
   "uk": [
    "Ремонт і регулювання фурнітури дверей та шаф",
    "Петлі, засувки, ручки й фурнітуру шаф відрегульовано, відремонтовано чи замінено."
   ],
   "pa": [
    "ਦਰਵਾਜ਼ੇ ਅਤੇ ਕੈਬਨਿਟ ਹਾਰਡਵੇਅਰ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਸੈਟਿੰਗ",
    "ਕਬਜ਼ੇ, ਕੁੰਡੇ, ਹੈਂਡਲ ਅਤੇ ਕੈਬਨਿਟ ਹਾਰਡਵੇਅਰ ਸੈੱਟ, ਠੀਕ ਜਾਂ ਬਦਲੇ।"
   ],
   "tl": [
    "Pagkukumpuni at pag-align ng hardware ng pinto at kabinet",
    "In-adjust, inayos o pinalitan ang bisagra, trangka, hawakan at hardware ng kabinet."
   ]
  },
  "fq.handyman.doors_windows.exterior_door_rot": {
   "it": [
    "Riparazione porta esterna e finiture con trattamento anti-marcio",
    "Telai e finiture della porta marciti riparati o sostituiti, trattati e rifiniti."
   ],
   "de": [
    "Außentür- und Leistenreparatur mit Fäulnisbehandlung",
    "Morsche Türrahmen und Leisten repariert oder ersetzt, behandelt und endbearbeitet."
   ],
   "uk": [
    "Ремонт вхідних дверей і лиштви з обробкою від гнилі",
    "Гнилі дверні коробки й лиштву відремонтовано чи замінено, оброблено й оздоблено."
   ],
   "pa": [
    "ਸੜਨ ਦੇ ਇਲਾਜ ਸਮੇਤ ਬਾਹਰੀ ਦਰਵਾਜ਼ਾ ਅਤੇ ਟ੍ਰਿਮ ਮੁਰੰਮਤ",
    "ਸੜੇ ਦਰਵਾਜ਼ੇ ਦੇ ਫ਼ਰੇਮ ਅਤੇ ਟ੍ਰਿਮ ਠੀਕ ਜਾਂ ਬਦਲੇ, ਇਲਾਜ ਕਰਕੇ ਮੁਕੰਮਲ।"
   ],
   "tl": [
    "Pagkukumpuni ng pinto sa labas at trim na may gamot sa bulok",
    "Inayos o pinalitan, ginamot at tinapos ang bulok na frame at trim ng pinto."
   ]
  },
  "fq.handyman.doors_windows.interior_door_install": {
   "pa": [
    "ਅੰਦਰੂਨੀ ਦਰਵਾਜ਼ਾ ਲਾਉਣਾ",
    "ਅੰਦਰਲਾ ਦਰਵਾਜ਼ਾ ਫ਼ਰੇਮ ਵਿੱਚ ਟੰਗਿਆ, ਹਾਰਡਵੇਅਰ ਲਾਇਆ ਅਤੇ ਸਾਫ਼ ਬੰਦ ਹੋਣ ਲਈ ਸੈੱਟ।"
   ]
  },
  "fq.handyman.doors_windows.tv_mount": {
   "pa": [
    "TV ਮਾਊਂਟ ਲਾਉਣਾ",
    "TV ਬ੍ਰੈਕਟ ਸਟੱਡਾਂ ਵਿੱਚ ਪੱਕੀ ਅਤੇ ਟੈਲੀਵਿਜ਼ਨ ਟੰਗ ਕੇ ਪੱਧਰਾ।"
   ]
  },
  "fq.handyman.doors_windows.screens": {
   "pa": [
    "ਖਿੜਕੀ ਅਤੇ ਦਰਵਾਜ਼ੇ ਦੀ ਜਾਲੀ ਲਾਉਣਾ ਅਤੇ ਮੁਰੰਮਤ",
    "ਤੂਫ਼ਾਨ, ਧੁੱਪ ਅਤੇ ਮੋਟਰ ਵਾਲੀਆਂ ਜਾਲੀਆਂ ਦੇ ਕੇ ਲਾਈਆਂ ਜਾਂ ਠੀਕ ਕੀਤੀਆਂ।"
   ]
  },
  "fq.handyman.doors_windows.blinds": {
   "it": [
    "Installazione tende a lamelle interne",
    "Tende fornite e montate dentro o fuori il telaio, cordini e aste inclusi."
   ],
   "de": [
    "Jalousien innen montieren",
    "Jalousien geliefert und innerhalb oder außerhalb des Rahmens montiert, mit Schnüren und Stäben."
   ],
   "uk": [
    "Встановлення внутрішніх жалюзі",
    "Жалюзі постачено й змонтовано в рамі чи поза нею, шнури й тростини встановлено."
   ],
   "pa": [
    "ਅੰਦਰਲੀਆਂ ਖਿੜਕੀ ਬਲਾਇੰਡ ਲਾਉਣਾ",
    "ਬਲਾਇੰਡ ਦੇ ਕੇ ਫ਼ਰੇਮ ਦੇ ਅੰਦਰ ਜਾਂ ਬਾਹਰ ਲਾਏ, ਡੋਰੀਆਂ ਅਤੇ ਛੜੀਆਂ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit ng blinds sa loob",
    "Nagbigay at ikinabit ang blinds sa loob o labas ng frame, kasama ang tali at wand."
   ]
  },
  "fq.handyman.doors_windows.door_sill_trim": {
   "it": [
    "Installazione soglie e cornici delle porte",
    "Soglie e cornici attorno fornite e installate."
   ],
   "de": [
    "Türschwellen und Leisten einbauen",
    "Türschwellen und die umgebenden Leisten geliefert und eingebaut."
   ],
   "uk": [
    "Встановлення порогів і лиштви",
    "Пороги й лиштву навколо постачено й встановлено."
   ],
   "pa": [
    "ਦਰਵਾਜ਼ੇ ਦੀ ਦਹਿਲੀਜ਼ ਅਤੇ ਟ੍ਰਿਮ ਲਾਉਣਾ",
    "ਦਰਵਾਜ਼ਿਆਂ ਦੀਆਂ ਦਹਿਲੀਜ਼ਾਂ ਅਤੇ ਆਲੇ-ਦੁਆਲੇ ਦੀ ਟ੍ਰਿਮ ਦੇ ਕੇ ਲਾਈ।"
   ],
   "tl": [
    "Pagkakabit ng sill at trim ng pinto",
    "Nagbigay at ikinabit ang sill ng pinto at trim sa paligid nito."
   ]
  },
  "fq.handyman.doors_windows.storm_doors": {
   "it": [
    "Installazione controporta e guarnizioni",
    "Controporta montata e guarnizioni e paraspifferi sostituiti."
   ],
   "de": [
    "Vorsatztür einbauen und abdichten",
    "Eine Vorsatztür eingehängt und Dichtungen sowie Türbesen ersetzt."
   ],
   "uk": [
    "Встановлення штормових дверей і ущільнення",
    "Штормові двері навішено, ущільнювачі й щітки замінено."
   ],
   "pa": [
    "ਸਟੌਰਮ ਦਰਵਾਜ਼ਾ ਲਾਉਣਾ ਅਤੇ ਮੌਸਮ ਸੀਲਿੰਗ",
    "ਸਟੌਰਮ ਦਰਵਾਜ਼ਾ ਟੰਗਿਆ ਅਤੇ ਵੈਦਰ ਸਟ੍ਰਿਪਿੰਗ ਅਤੇ ਸਵੀਪ ਬਦਲੇ।"
   ],
   "tl": [
    "Pagkakabit ng storm door at weather sealing",
    "Isinabit ang storm door at pinalitan ang weather stripping at sweep."
   ]
  },
  "fq.handyman.doors_windows.garage_control_kits": {
   "it": [
    "Installazione kit di comando porta garage",
    "Kit di comando della porta garage forniti e installati."
   ],
   "de": [
    "Steuersets für Garagentore einbauen",
    "Steuersets für das Garagentor geliefert und eingebaut."
   ],
   "uk": [
    "Встановлення комплектів керування гаражними воротами",
    "Комплекти керування воротами постачено й встановлено."
   ],
   "pa": [
    "ਗੈਰਾਜ ਦਰਵਾਜ਼ਾ ਕੰਟਰੋਲ ਕਿੱਟ ਲਾਉਣਾ",
    "ਗੈਰਾਜ ਦਰਵਾਜ਼ੇ ਦੀਆਂ ਕੰਟਰੋਲ ਕਿੱਟਾਂ ਦੇ ਕੇ ਲਾਈਆਂ।"
   ],
   "tl": [
    "Pagkakabit ng control kit ng garage door",
    "Nagbigay at ikinabit ang control kit ng garage door."
   ]
  },
  "fq.handyman.doors_windows.grab_bars": {
   "pa": [
    "ਗ੍ਰੈਬ ਬਾਰ ਅਤੇ ਕੰਧ ਹਾਰਡਵੇਅਰ ਲਾਉਣਾ",
    "ਗ੍ਰੈਬ ਬਾਰ ਬਲੌਕਿੰਗ ਜਾਂ ਸਟੱਡਾਂ ਵਿੱਚ ਪੱਕੇ ਤਾਂ ਜੋ ਬੰਦੇ ਦਾ ਭਾਰ ਝੱਲਣ।"
   ]
  },
  "fq.handyman.doors_windows.brackets_mounting": {
   "pa": [
    "ਹਾਰਡਵੇਅਰ, ਬ੍ਰੈਕਟ ਅਤੇ ਮਾਊਂਟਿੰਗ ਸਮਾਨ",
    "ਬ੍ਰੈਕਟ, ਹੁੱਕ ਅਤੇ ਮਾਊਂਟਿੰਗ ਹਾਰਡਵੇਅਰ ਦੇ ਕੇ ਲਾਏ।"
   ]
  },
  "fq.handyman.doors_windows.cabinet_repair_refinish": {
   "it": [
    "Riparazione e rinnovo mobili cucina",
    "Ante e scocche dei mobili riparate e rifinite."
   ],
   "de": [
    "Küchenschränke reparieren und aufarbeiten",
    "Schranktüren und Korpusse repariert und neu behandelt."
   ],
   "uk": [
    "Ремонт і оновлення кухонних шаф",
    "Фасади й корпуси шаф відремонтовано й оновлено."
   ],
   "pa": [
    "ਰਸੋਈ ਕੈਬਨਿਟ ਮੁਰੰਮਤ ਅਤੇ ਰੀਫ਼ਿਨਿਸ਼",
    "ਕੈਬਨਿਟ ਦੇ ਦਰਵਾਜ਼ੇ ਅਤੇ ਬਾਕਸ ਠੀਕ ਅਤੇ ਰੀਫ਼ਿਨਿਸ਼।"
   ],
   "tl": [
    "Pagkukumpuni at refinishing ng kabinet sa kusina",
    "Inayos at ni-refinish ang pinto at kahon ng kabinet."
   ]
  },
  "fq.handyman.doors_windows.rekey_opener": {
   "it": [
    "Ricodifica serrature e installazione motore porta garage",
    "Serrature di casa e cassetta postale ricodificate e motore della porta garage installato."
   ],
   "de": [
    "Schlösser umschlüsseln und Garagentorantrieb montieren",
    "Haus- und Briefkastenschlösser umgeschlüsselt und ein Garagentorantrieb eingebaut."
   ],
   "uk": [
    "Перекодування замків і встановлення приводу воріт",
    "Замки дому й поштової скриньки перекодовано, привід гаражних воріт встановлено."
   ],
   "pa": [
    "ਤਾਲਿਆਂ ਦੀ ਨਵੀਂ ਚਾਬੀ ਅਤੇ ਗੈਰਾਜ ਓਪਨਰ ਲਾਉਣਾ",
    "ਘਰ ਅਤੇ ਮੇਲਬਾਕਸ ਦੇ ਤਾਲਿਆਂ ਦੀ ਨਵੀਂ ਚਾਬੀ ਅਤੇ ਗੈਰਾਜ ਓਪਨਰ ਲਾਇਆ।"
   ],
   "tl": [
    "Pag-rekey ng kandado at pagkakabit ng garage opener",
    "Ni-rekey ang kandado ng bahay at mailbox at ikinabit ang garage door opener."
   ]
  },
  "fq.handyman.doors_windows.interior_door_repair": {
   "pa": [
    "ਅੰਦਰੂਨੀ ਦਰਵਾਜ਼ੇ ਦੀ ਮੁਰੰਮਤ",
    "ਅੜਦਾ, ਲਟਕਦਾ ਜਾਂ ਖ਼ਰਾਬ ਦਰਵਾਜ਼ਾ ਰੰਦਾ ਕੀਤਾ, ਮੁੜ ਟੰਗਿਆ ਜਾਂ ਭਰਿਆ।"
   ]
  },
  "fq.handyman.doors_windows.sliding_door_rollers": {
   "it": [
    "Riparazione rotelle di porte scorrevoli e zanzariere",
    "Rotelle, rete e ferramenta di porte scorrevoli e zanzariere riparate o sostituite perché scorrano di nuovo."
   ],
   "de": [
    "Laufrollen an Schiebetür und Fliegengitter reparieren",
    "Rollen, Gewebe und Beschläge an Schiebetüren und Gittern repariert oder ersetzt, damit sie wieder gleiten."
   ],
   "uk": [
    "Ремонт роликів розсувних дверей і сіток",
    "Ролики, сітку й фурнітуру розсувних дверей і сіток відремонтовано чи замінено — знову ковзають."
   ],
   "pa": [
    "ਸਲਾਈਡਿੰਗ ਦਰਵਾਜ਼ੇ ਅਤੇ ਜਾਲੀ ਦੇ ਰੋਲਰ ਦੀ ਮੁਰੰਮਤ",
    "ਸਲਾਈਡਿੰਗ ਦਰਵਾਜ਼ਿਆਂ ਅਤੇ ਜਾਲੀਆਂ ਦੇ ਰੋਲਰ, ਜਾਲ ਅਤੇ ਹਾਰਡਵੇਅਰ ਠੀਕ ਜਾਂ ਬਦਲੇ ਤਾਂ ਜੋ ਮੁੜ ਸੌਖੇ ਚੱਲਣ।"
   ],
   "tl": [
    "Pagkukumpuni ng roller ng sliding door at screen",
    "Inayos o pinalitan ang roller, mesh at hardware para dumausdos ulit ang sliding door at screen."
   ]
  },
  "fq.handyman.electrical.duplex_receptacle_breaker": {
   "it": [
    "Presa doppia e interruttore 20 A",
    "Una presa doppia fornita e installata con un interruttore da 20 A per il suo circuito."
   ],
   "de": [
    "Doppelsteckdose mit 20-A-Automat",
    "Eine Doppelsteckdose geliefert und mit einem 20-A-Automaten für ihren Kreis eingebaut."
   ],
   "uk": [
    "Подвійна розетка та автомат 20 А",
    "Подвійну розетку постачено й встановлено з автоматом 20 А для її лінії."
   ],
   "pa": [
    "ਡੁਪਲੈਕਸ ਸਾਕਟ ਅਤੇ 20 A ਬ੍ਰੇਕਰ ਲਾਉਣਾ",
    "ਇੱਕ ਡੁਪਲੈਕਸ ਸਾਕਟ ਉਸਦੇ ਸਰਕਟ ਲਈ 20 A ਬ੍ਰੇਕਰ ਸਮੇਤ ਦੇ ਕੇ ਲਾਇਆ।"
   ],
   "tl": [
    "Duplex na saksakan at 20 A na breaker",
    "Nagbigay at ikinabit ang duplex na saksakan kasama ang 20 A na breaker para sa circuit nito."
   ]
  },
  "fq.handyman.electrical.outlet_switch_repair": {
   "it": [
    "Sostituzione e riparazione prese e interruttori",
    "Prese, interruttori e placche sostituiti o riparati."
   ],
   "de": [
    "Steckdosen und Schalter tauschen und reparieren",
    "Steckdosen, Schalter und Abdeckungen ersetzt oder repariert."
   ],
   "uk": [
    "Заміна й ремонт розеток і вимикачів",
    "Розетки, вимикачі й рамки замінено чи відремонтовано."
   ],
   "pa": [
    "ਸਾਕਟ ਅਤੇ ਸਵਿੱਚ ਬਦਲਣਾ ਅਤੇ ਮੁਰੰਮਤ",
    "ਸਾਕਟ, ਸਵਿੱਚ ਅਤੇ ਕਵਰ ਪਲੇਟਾਂ ਬਦਲੀਆਂ ਜਾਂ ਠੀਕ।"
   ],
   "tl": [
    "Pagpapalit at pagkukumpuni ng saksakan at switch",
    "Pinalitan o inayos ang saksakan, switch at cover plate."
   ]
  },
  "fq.handyman.electrical.gas_burner_parts": {
   "it": [
    "Ricambi e montaggio bruciatori di caminetto e cucina a gas",
    "Ricambi per bruciatori di caminetti e cucine a gas forniti e montati."
   ],
   "de": [
    "Brennerteile für Gaskamin und Gasherd",
    "Ersatzteile für Brenner von Gaskaminen und Gasherden geliefert und eingebaut."
   ],
   "uk": [
    "Запчастини пальників газового каміна й плити",
    "Запчастини для пальників газових камінів і плит постачено й встановлено."
   ],
   "pa": [
    "ਗੈਸ ਫ਼ਾਇਰਪਲੇਸ ਅਤੇ ਰੇਂਜ ਬਰਨਰ ਪੁਰਜ਼ੇ ਅਤੇ ਲਾਉਣਾ",
    "ਗੈਸ ਫ਼ਾਇਰਪਲੇਸ ਅਤੇ ਚੁੱਲ੍ਹੇ ਦੇ ਬਰਨਰਾਂ ਲਈ ਬਦਲਵੇਂ ਪੁਰਜ਼ੇ ਦੇ ਕੇ ਲਾਏ।"
   ],
   "tl": [
    "Piyesa at pagkakabit ng burner ng gas na fireplace at kalan",
    "Nagbigay at ikinabit ang pamalit na piyesa ng burner ng gas na fireplace at kalan."
   ]
  },
  "fq.handyman.electrical.hourly_bulbs": {
   "it": [
    "Lavori elettrici a ore e cambio lampadine",
    "Piccoli lavori elettrici e cambio lampadine fatturati a ore."
   ],
   "de": [
    "Elektroarbeiten nach Stunden und Leuchtmitteltausch",
    "Kleine Elektroarbeiten und Leuchtmittelwechsel nach Stunden abgerechnet."
   ],
   "uk": [
    "Погодинні електророботи та заміна ламп",
    "Дрібні електророботи й заміна ламп погодинно."
   ],
   "pa": [
    "ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਬਿਜਲੀ ਕੰਮ ਅਤੇ ਬਲਬ ਬਦਲਣਾ",
    "ਛੋਟੇ ਬਿਜਲੀ ਕੰਮ ਅਤੇ ਬਲਬ ਬਦਲੀ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ ਬਿੱਲ।"
   ],
   "tl": [
    "Trabahong elektrikal kada oras at pagpapalit ng bombilya",
    "Maliit na trabahong elektrikal at pagpapalit ng bombilya, sinisingil kada oras."
   ]
  },
  "fq.handyman.electrical.doorbell_install": {
   "it": [
    "Installazione campanello",
    "Campanello cablato o smart installato e collegato al trasformatore."
   ],
   "de": [
    "Türklingel montieren",
    "Eine kabelgebundene oder smarte Türklingel montiert und an den Trafo angeschlossen."
   ],
   "uk": [
    "Встановлення дверного дзвінка",
    "Провідний чи розумний дзвінок встановлено й під'єднано до трансформатора."
   ],
   "pa": [
    "ਦਰਵਾਜ਼ੇ ਦੀ ਘੰਟੀ ਲਾਉਣਾ",
    "ਤਾਰ ਵਾਲੀ ਜਾਂ ਸਮਾਰਟ ਘੰਟੀ ਲਾ ਕੇ ਟ੍ਰਾਂਸਫ਼ਾਰਮਰ ਨਾਲ ਜੋੜੀ।"
   ],
   "tl": [
    "Pagkakabit ng doorbell",
    "Ikinabit at ikinonekta sa transformer ang wired o smart na doorbell."
   ]
  },
  "fq.handyman.electrical.popcorn_drywall": {
   "it": [
    "Rimozione soffitto a buccia d'arancia e riparazione cartongesso",
    "Intonaco a spruzzo raschiato via, soffitto e fori dei faretti stuccati e levigati."
   ],
   "de": [
    "Spritzputzdecke entfernen und Trockenbau ausbessern",
    "Spritzputz abgekratzt, Decke und Ausschnitte der Einbauleuchten gespachtelt und geglättet."
   ],
   "uk": [
    "Зняття «попкорн»-стелі та ремонт гіпсокартону",
    "Фактурне покриття зішкрябано, стелю й отвори світильників зашпакльовано й вирівняно."
   ],
   "pa": [
    "ਪੌਪਕੌਰਨ ਛੱਤ ਹਟਾਉਣਾ ਅਤੇ ਡ੍ਰਾਈਵਾਲ ਮੁਰੰਮਤ",
    "ਪੌਪਕੌਰਨ ਟੈਕਸਚਰ ਖੁਰਚਿਆ, ਛੱਤ ਅਤੇ ਲਾਈਟਾਂ ਦੇ ਛੇਕ ਪੈਚ ਅਤੇ ਮੁਲਾਇਮ।"
   ],
   "tl": [
    "Pag-alis ng popcorn ceiling at pagkukumpuni ng drywall",
    "Kinayod ang popcorn texture, tinapalan at pinakinis ang kisame at butas ng recessed light."
   ]
  },
  "fq.handyman.electrical.exhaust_fan_repair": {
   "pa": [
    "ਬਾਥਰੂਮ ਐਗਜ਼ੌਸਟ ਪੱਖੇ ਦੀ ਮੁਰੰਮਤ",
    "ਰੌਲਾ ਪਾਉਂਦਾ ਜਾਂ ਬੰਦ ਬਾਥਰੂਮ ਪੱਖਾ ਠੀਕ ਜਾਂ ਮੋਟਰ ਬਦਲੀ।"
   ]
  },
  "fq.handyman.electrical.doorbell_repair": {
   "it": [
    "Riparazione campanello",
    "Pulsante, suoneria, cablaggio o trasformatore riparati perché il campanello suoni di nuovo."
   ],
   "de": [
    "Türklingelreparatur",
    "Taster, Gong, Verkabelung oder Trafo repariert, damit die Klingel wieder läutet."
   ],
   "uk": [
    "Ремонт дверного дзвінка",
    "Кнопку, дзвінок, проводку чи трансформатор відремонтовано — дзвінок знову дзвонить."
   ],
   "pa": [
    "ਦਰਵਾਜ਼ੇ ਦੀ ਘੰਟੀ ਦੀ ਮੁਰੰਮਤ",
    "ਬਟਨ, ਚਾਈਮ, ਤਾਰਾਂ ਜਾਂ ਟ੍ਰਾਂਸਫ਼ਾਰਮਰ ਠੀਕ ਤਾਂ ਜੋ ਘੰਟੀ ਮੁੜ ਵੱਜੇ।"
   ],
   "tl": [
    "Pagkukumpuni ng doorbell",
    "Inayos ang button, chime, wiring o transformer para tumunog ulit ang doorbell."
   ]
  },
  "fq.handyman.electrical.smoke_detector_repair": {
   "it": [
    "Riparazione rilevatore di fumo",
    "Rilevatore che emette bip o non funziona riparato o sostituito."
   ],
   "de": [
    "Rauchmelderreparatur",
    "Ein piepender oder nicht funktionierender Rauchmelder repariert oder ersetzt."
   ],
   "uk": [
    "Ремонт датчика диму",
    "Датчик, що пищить чи не працює, відремонтовано чи замінено."
   ],
   "pa": [
    "ਧੂੰਆਂ ਡਿਟੈਕਟਰ ਦੀ ਮੁਰੰਮਤ",
    "ਚੀਂ-ਚੀਂ ਕਰਦਾ ਜਾਂ ਬੰਦ ਧੂੰਆਂ ਡਿਟੈਕਟਰ ਠੀਕ ਜਾਂ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagkukumpuni ng smoke detector",
    "Inayos o pinalitan ang tumutunog o hindi gumaganang smoke detector."
   ]
  },
  "fq.handyman.electrical.window_recessed": {
   "it": [
    "Sostituzione finestre e faretti da incasso",
    "Finestre sostitutive montate e faretti da incasso installati."
   ],
   "de": [
    "Fenstertausch und Einbauleuchten",
    "Ersatzfenster eingebaut und Einbauleuchten montiert."
   ],
   "uk": [
    "Заміна вікон і вбудовані світильники",
    "Нові вікна встановлено й вбудовані світильники змонтовано."
   ],
   "pa": [
    "ਖਿੜਕੀ ਬਦਲਣਾ ਅਤੇ ਧੱਸੀਆਂ ਲਾਈਟਾਂ",
    "ਬਦਲਵੀਆਂ ਖਿੜਕੀਆਂ ਲਾਈਆਂ ਅਤੇ ਛੱਤ ਵਿੱਚ ਧੱਸੀਆਂ ਲਾਈਟਾਂ।"
   ],
   "tl": [
    "Pagpapalit ng bintana at recessed na ilaw",
    "Ikinabit ang pamalit na bintana at recessed na ilaw."
   ]
  },
  "fq.handyman.exterior.deck_work": {
   "pa": [
    "ਡੈੱਕ ਬਣਾਉਣਾ, ਮੁਰੰਮਤ ਅਤੇ ਬਦਲਣਾ",
    "ਡੈੱਕ ਦੀ ਫ਼ਰੇਮਿੰਗ, ਫੱਟੇ, ਪੌੜੀਆਂ ਅਤੇ ਰੇਲਿੰਗ ਬਣਾਈ, ਠੀਕ ਜਾਂ ਬਦਲੀ।"
   ]
  },
  "fq.handyman.exterior.fence_repair_labour": {
   "pa": [
    "ਵਾੜ ਮੁਰੰਮਤ ਅਤੇ ਜਾਂਚ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਵਾੜ ਦੀ ਸਮੱਸਿਆ ਦੇਖਣ ਲਈ ਸਰਵਿਸ ਕਾਲ ਅਤੇ ਠੀਕ ਕਰਨ ਦੀ ਮਜ਼ਦੂਰੀ।"
   ]
  },
  "fq.handyman.exterior.fence_gate_repair": {
   "pa": [
    "ਵਾੜ ਅਤੇ ਗੇਟ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਬਦਲੀ",
    "ਥੰਮ੍ਹ, ਪੈਨਲ ਅਤੇ ਗੇਟ ਠੀਕ ਜਾਂ ਬਦਲੇ, ਮਜ਼ਦੂਰੀ ਅਤੇ ਸਮਾਨ ਸਮੇਤ।"
   ]
  },
  "fq.handyman.exterior.power_wash_deck_refinish": {
   "pa": [
    "ਪ੍ਰੈਸ਼ਰ ਵਾਸ਼ਿੰਗ ਅਤੇ ਡੈੱਕ ਰੀਫ਼ਿਨਿਸ਼",
    "ਡੈੱਕ ਪ੍ਰੈਸ਼ਰ ਵਾਸ਼ ਕਰਕੇ ਸਟੇਨ ਜਾਂ ਰੀਫ਼ਿਨਿਸ਼।"
   ]
  },
  "fq.handyman.flooring.materials_install": {
   "it": [
    "Fornitura e posa pavimenti",
    "Materiali per pavimenti forniti e posati."
   ],
   "de": [
    "Bodenmaterial liefern und verlegen",
    "Bodenmaterial geliefert und verlegt."
   ],
   "uk": [
    "Постачання та укладання підлоги",
    "Матеріали для підлоги постачено й укладено."
   ],
   "pa": [
    "ਫ਼ਰਸ਼ ਦਾ ਸਮਾਨ ਅਤੇ ਲਾਉਣਾ",
    "ਫ਼ਰਸ਼ ਦਾ ਸਮਾਨ ਦੇ ਕੇ ਲਾਇਆ।"
   ],
   "tl": [
    "Materyales at pagkakabit ng sahig",
    "Nagbigay at ikinabit ang materyales ng sahig."
   ]
  },
  "fq.handyman.flooring.lvp": {
   "it": [
    "Posa vinile di lusso a listoni",
    "Listoni in vinile posati su sottofondo preparato con profili e battiscopa."
   ],
   "de": [
    "Designvinyl-Dielen verlegen",
    "Vinyl-Designdielen auf vorbereitetem Unterboden mit Übergängen und Leisten verlegt."
   ],
   "uk": [
    "Укладання вінілової планки LVP",
    "Вінілову планку покладено на підготовлену основу з порогами й плінтусами."
   ],
   "pa": [
    "ਲਗਜ਼ਰੀ ਵਿਨਾਇਲ ਪਲੈਂਕ ਲਾਉਣਾ",
    "ਤਿਆਰ ਸਬਫ਼ਲੋਰ ਉੱਤੇ ਲਗਜ਼ਰੀ ਵਿਨਾਇਲ ਪਲੈਂਕ, ਟ੍ਰਾਂਜ਼ਿਸ਼ਨ ਅਤੇ ਟ੍ਰਿਮ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit ng luxury vinyl plank",
    "Inilatag ang luxury vinyl plank sa inihandang subfloor na may transition at trim."
   ]
  },
  "fq.handyman.flooring.materials_coverings": {
   "it": [
    "Materiali per pavimenti e protezioni",
    "Pavimento fornito e posato con coperture protettive per le superfici finite."
   ],
   "de": [
    "Bodenmaterial und Schutzabdeckungen",
    "Boden geliefert und verlegt, mit Schutzabdeckungen für die fertigen Flächen."
   ],
   "uk": [
    "Матеріали для підлоги та захисні покриття",
    "Підлогу постачено й укладено з захисними покриттями для готових поверхонь."
   ],
   "pa": [
    "ਫ਼ਰਸ਼ ਦਾ ਸਮਾਨ ਅਤੇ ਸੁਰੱਖਿਆ ਢੱਕਣ",
    "ਮੁਕੰਮਲ ਸਤਹਾਂ ਲਈ ਸੁਰੱਖਿਆ ਢੱਕਣਾਂ ਸਮੇਤ ਫ਼ਰਸ਼ ਦੇ ਕੇ ਲਾਇਆ।"
   ],
   "tl": [
    "Materyales ng sahig at pantakip",
    "Nagbigay at ikinabit ang sahig kasama ang pantakip na proteksyon sa tapos na surface."
   ]
  },
  "fq.handyman.flooring.vinyl_plank_prep": {
   "it": [
    "Pavimento in vinile a listoni con preparazione e materiali",
    "Listoni in vinile posati con preparazione del sottofondo, materassino e materiali inclusi."
   ],
   "de": [
    "Vinyldielen mit Vorbereitung und Material",
    "Vinyldielen mit Unterbodenvorbereitung, Unterlage und Material verlegt."
   ],
   "uk": [
    "Вінілова планка з підготовкою та матеріалами",
    "Вінілову планку укладено з підготовкою основи, підкладкою й матеріалами."
   ],
   "pa": [
    "ਤਿਆਰੀ ਅਤੇ ਸਮਾਨ ਸਮੇਤ ਵਿਨਾਇਲ ਪਲੈਂਕ ਫ਼ਰਸ਼",
    "ਸਬਫ਼ਲੋਰ ਤਿਆਰੀ, ਅੰਡਰਲੇਅ ਅਤੇ ਸਮਾਨ ਸਮੇਤ ਵਿਨਾਇਲ ਪਲੈਂਕ ਲਾਇਆ।"
   ],
   "tl": [
    "Vinyl plank na may paghahanda at materyales",
    "Ikinabit ang vinyl plank kasama ang paghahanda ng subfloor, underlayment at materyales."
   ]
  },
  "fq.handyman.flooring.basement_carpentry": {
   "it": [
    "Ristrutturazione seminterrato e falegnameria interna",
    "Manodopera per falegnameria interna, finiture e pavimenti nella finitura di un seminterrato."
   ],
   "de": [
    "Kellerausbau und Innentischlerei",
    "Handwerksarbeit für Innentischlerei, Leisten und Böden beim Kellerausbau."
   ],
   "uk": [
    "Облаштування підвалу та внутрішня столярка",
    "Роботи з внутрішньої столярки, оздоблення й підлоги при облаштуванні підвалу."
   ],
   "pa": [
    "ਬੇਸਮੈਂਟ ਨਵੀਨੀਕਰਨ ਅਤੇ ਅੰਦਰੂਨੀ ਤਰਖਾਣੀ",
    "ਬੇਸਮੈਂਟ ਮੁਕੰਮਲ ਕਰਨ ਵਿੱਚ ਅੰਦਰੂਨੀ ਤਰਖਾਣੀ, ਟ੍ਰਿਮ ਅਤੇ ਫ਼ਰਸ਼ ਦੀ ਮਜ਼ਦੂਰੀ।"
   ],
   "tl": [
    "Remodel ng basement at karpinterya sa loob",
    "Trabaho sa karpinterya, trim at sahig sa pagtatapos ng basement."
   ]
  },
  "fq.handyman.flooring.carpet_removal": {
   "it": [
    "Rimozione e smaltimento moquette e sottofondo",
    "Vecchia moquette e sottofondo tolti, listelli rimossi e tutto portato via."
   ],
   "de": [
    "Teppich und Unterlage entfernen und entsorgen",
    "Alter Teppich und Unterlage herausgenommen, Nagelleisten entfernt und alles abtransportiert."
   ],
   "uk": [
    "Зняття й вивезення ковроліну та підкладки",
    "Старий ковролін і підкладку знято, рейки прибрано, усе вивезено."
   ],
   "pa": [
    "ਕਾਰਪੈੱਟ ਅਤੇ ਪੈਡ ਹਟਾਉਣਾ ਅਤੇ ਨਿਪਟਾਰਾ",
    "ਪੁਰਾਣਾ ਕਾਰਪੈੱਟ ਅਤੇ ਪੈਡ ਚੁੱਕਿਆ, ਟੈਕ ਸਟ੍ਰਿੱਪ ਕੱਢੀਆਂ ਅਤੇ ਸਭ ਲਿਜਾਇਆ।"
   ],
   "tl": [
    "Pag-alis at pagtatapon ng karpet at pad",
    "Inalis ang lumang karpet at pad, tinanggal ang tack strip at hinakot lahat."
   ]
  },
  "fq.handyman.flooring.mortar_supply": {
   "it": [
    "Fornitura e posa malta tipo S e premiscelata",
    "Malta fornita e usata per riparazioni di muratura o piastrelle."
   ],
   "de": [
    "Mörtel Typ S und Fertigmörtel liefern und verarbeiten",
    "Mörtel geliefert und für Mauerwerks- oder Fliesenreparaturen verwendet."
   ],
   "uk": [
    "Постачання й використання розчину типу S і готового",
    "Розчин постачено й використано для ремонту кладки чи плитки."
   ],
   "pa": [
    "ਟਾਈਪ S ਅਤੇ ਤਿਆਰ ਮਸਾਲਾ ਦੇਣਾ ਅਤੇ ਲਾਉਣਾ",
    "ਚਿਣਾਈ ਜਾਂ ਟਾਈਲ ਮੁਰੰਮਤ ਲਈ ਮਸਾਲਾ ਦੇ ਕੇ ਵਰਤਿਆ।"
   ],
   "tl": [
    "Suplay at paggamit ng Type S at premix na mortar",
    "Nagbigay at ginamit ang mortar para sa pagkukumpuni ng masonry o tile."
   ]
  },
  "fq.handyman.flooring.tile_install_grout": {
   "pa": [
    "ਟਾਈਲ ਫ਼ਰਸ਼ ਲਾਉਣਾ, ਸਫ਼ਾਈ ਅਤੇ ਗ੍ਰਾਊਟ ਸੀਲਿੰਗ",
    "ਪੁਰਾਣੀ ਟਾਈਲ ਹਟਾਈ, ਨਵੀਂ ਲਾਈ, ਗ੍ਰਾਊਟ ਸਾਫ਼ ਅਤੇ ਸੀਲ।"
   ]
  },
  "fq.handyman.hvac.ac_repair_recharge": {
   "it": [
    "Riparazione climatizzatore e ricarica refrigerante",
    "Climatizzatore riparato e refrigerante rabboccato."
   ],
   "de": [
    "Klimaanlagenreparatur und Kältemittel nachfüllen",
    "Die Klimaanlage repariert und Kältemittel nachgefüllt."
   ],
   "uk": [
    "Ремонт кондиціонера та дозаправка",
    "Кондиціонер відремонтовано, холодоагент долито."
   ],
   "pa": [
    "ਏਸੀ ਮੁਰੰਮਤ ਅਤੇ ਰੈਫ਼ਰਿਜਰੈਂਟ ਭਰਨਾ",
    "ਏਸੀ ਠੀਕ ਅਤੇ ਰੈਫ਼ਰਿਜਰੈਂਟ ਭਰਿਆ।"
   ],
   "tl": [
    "Pagkukumpuni ng aircon at pagdagdag ng refrigerant",
    "Inayos ang aircon at dinagdagan ang refrigerant."
   ]
  },
  "fq.handyman.hvac.duct_cleaning_labour": {
   "it": [
    "Pulizia condotti e lavori generici",
    "Condotti puliti, filtri sostituiti e lavori generici sulla ventilazione."
   ],
   "de": [
    "Kanalreinigung und allgemeine Arbeiten",
    "Kanäle gereinigt, Filter ersetzt und allgemeine Arbeiten an der Lüftung."
   ],
   "uk": [
    "Чищення повітроводів і загальні роботи",
    "Повітроводи почищено, фільтри замінено, загальні роботи з вентиляцією."
   ],
   "pa": [
    "ਏਅਰ ਡਕਟ ਸਫ਼ਾਈ ਅਤੇ ਆਮ ਮਜ਼ਦੂਰੀ",
    "ਡਕਟਾਂ ਸਾਫ਼, ਫ਼ਿਲਟਰ ਬਦਲੇ ਅਤੇ ਹਵਾਦਾਰੀ ਉੱਤੇ ਆਮ ਕੰਮ।"
   ],
   "tl": [
    "Paglilinis ng duct at pangkalahatang trabaho",
    "Nilinis ang duct, pinalitan ang filter at pangkalahatang trabaho sa bentilasyon."
   ]
  },
  "fq.handyman.hvac.dryer_vent": {
   "pa": [
    "ਡ੍ਰਾਇਰ ਵੈਂਟ ਦੀ ਸਫ਼ਾਈ ਅਤੇ ਸੰਭਾਲ",
    "ਡ੍ਰਾਇਰ ਵੈਂਟ ਸਿਰੇ ਤੋਂ ਸਿਰੇ ਤੱਕ ਰੂੰ ਤੋਂ ਸਾਫ਼।"
   ]
  },
  "fq.handyman.hvac.high_efficiency_install": {
   "it": [
    "Installazione impianti e componenti HVAC ad alta efficienza",
    "Nuovi climatizzatori, generatori d'aria calda e batterie evaporanti installati."
   ],
   "de": [
    "Einbau hocheffizienter HLK-Anlagen und Komponenten",
    "Neue Klimageräte, Öfen und Verdampferregister eingebaut."
   ],
   "uk": [
    "Монтаж високоефективних систем і вузлів HVAC",
    "Нові кондиціонери, печі й випарники встановлено."
   ],
   "pa": [
    "ਉੱਚ-ਕੁਸ਼ਲਤਾ HVAC ਸਿਸਟਮ ਅਤੇ ਪੁਰਜ਼ੇ ਲਾਉਣਾ",
    "ਨਵੇਂ ਏਅਰ ਕੰਡੀਸ਼ਨਰ, ਫ਼ਰਨੇਸ ਅਤੇ ਇਵੈਪੋਰੇਟਰ ਕੌਇਲਾਂ ਲਾਈਆਂ।"
   ],
   "tl": [
    "Pagkakabit ng high-efficiency na HVAC at piyesa",
    "Ikinabit ang bagong aircon, furnace at evaporator coil."
   ]
  },
  "fq.handyman.painting.exterior_caulking": {
   "pa": [
    "ਬਾਹਰੀ ਕੌਕਿੰਗ ਅਤੇ ਸੀਲਿੰਗ",
    "ਖਿੜਕੀਆਂ, ਦਰਵਾਜ਼ਿਆਂ ਅਤੇ ਸਾਈਡਿੰਗ ਦੁਆਲੇ ਬਾਹਰੀ ਜੋੜਾਂ ਉੱਤੇ ਕੌਕ ਅਤੇ ਸੀਲੈਂਟ।"
   ]
  },
  "fq.handyman.painting.drywall_patch": {
   "pa": [
    "ਡ੍ਰਾਈਵਾਲ ਅਤੇ ਕੰਧ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਪੈਚ",
    "ਛੇਕ ਅਤੇ ਤਰੇੜਾਂ ਪੈਚ, ਟੇਪ, ਰਗੜ ਕੇ ਪੇਂਟ ਲਈ ਤਿਆਰ।"
   ]
  },
  "fq.handyman.painting.baseboards": {
   "it": [
    "Posa e finitura battiscopa interni",
    "Battiscopa rimossi, posati e rifiniti."
   ],
   "de": [
    "Innensockelleisten montieren und fertigstellen",
    "Sockelleisten abgenommen, montiert und fertig behandelt."
   ],
   "uk": [
    "Монтаж і оздоблення внутрішніх плінтусів",
    "Плінтуси знято, встановлено й оздоблено."
   ],
   "pa": [
    "ਅੰਦਰੂਨੀ ਬੇਸਬੋਰਡ ਲਾਉਣਾ ਅਤੇ ਮੁਕੰਮਲ",
    "ਬੇਸਬੋਰਡ ਉਤਾਰੇ, ਲਾਏ ਅਤੇ ਮੁਕੰਮਲ।"
   ],
   "tl": [
    "Pagkakabit at pagtatapos ng baseboard sa loob",
    "Tinanggal, ikinabit at tinapos ang baseboard."
   ]
  },
  "fq.handyman.painting.bathroom_finishing": {
   "it": [
    "Finiture e manutenzione del bagno",
    "Tinteggiatura, mobili e lavori di finitura in un bagno."
   ],
   "de": [
    "Badfertigstellung und -pflege",
    "Malerarbeiten, Schränke und Ausbauarbeiten in einem Bad."
   ],
   "uk": [
    "Оздоблення та догляд у ванній",
    "Фарбування, шафи й оздоблювальні роботи у ванній."
   ],
   "pa": [
    "ਬਾਥਰੂਮ ਦਾ ਮੁਕੰਮਲ ਕੰਮ ਅਤੇ ਸੰਭਾਲ",
    "ਬਾਥਰੂਮ ਵਿੱਚ ਪੇਂਟ, ਕੈਬਨਿਟ ਅਤੇ ਫ਼ਿਨਿਸ਼ ਦਾ ਕੰਮ।"
   ],
   "tl": [
    "Pagtatapos at maintenance ng banyo",
    "Pintura, kabinet at finishing sa loob ng banyo."
   ]
  },
  "fq.handyman.painting.drywall_surface_repair": {
   "it": [
    "Riparazione cartongesso e superfici interne",
    "Cartongesso e superfici interne riparati e rifiniti lisci."
   ],
   "de": [
    "Reparatur von Trockenbau und Innenflächen",
    "Trockenbau und Innenflächen repariert und glatt fertiggestellt."
   ],
   "uk": [
    "Ремонт гіпсокартону та внутрішніх поверхонь",
    "Гіпсокартон і внутрішні поверхні відремонтовано й вирівняно."
   ],
   "pa": [
    "ਡ੍ਰਾਈਵਾਲ ਅਤੇ ਅੰਦਰਲੀ ਸਤਹ ਦੀ ਮੁਰੰਮਤ",
    "ਡ੍ਰਾਈਵਾਲ ਅਤੇ ਅੰਦਰਲੀਆਂ ਸਤਹਾਂ ਠੀਕ ਕਰਕੇ ਮੁਲਾਇਮ।"
   ],
   "tl": [
    "Pagkukumpuni ng drywall at surface sa loob",
    "Inayos at pinakinis ang drywall at surface sa loob."
   ]
  },
  "fq.handyman.painting.touch_up": {
   "pa": [
    "ਅੰਦਰੂਨੀ ਪੇਂਟ ਟੱਚ-ਅੱਪ ਅਤੇ ਮੁਰੰਮਤ",
    "ਰਗੜਾਂ ਅਤੇ ਛੋਟੇ ਨੁਕਸਾਨ ਕੰਧ ਨਾਲ ਮਿਲਾ ਕੇ ਟੱਚ-ਅੱਪ।"
   ]
  },
  "fq.handyman.painting.paint_supplies_units": {
   "it": [
    "Forniture per tinteggiatura interna e fissaggi",
    "Pittura e minuteria per il cambio inquilino forniti e utilizzati."
   ],
   "de": [
    "Material für Innenanstrich und Befestigung",
    "Farbe und Befestigungsmaterial für eine Wohnungsübergabe geliefert und verarbeitet."
   ],
   "uk": [
    "Матеріали для фарбування та кріплення",
    "Фарбу й кріплення для підготовки квартири постачено й використано."
   ],
   "pa": [
    "ਅੰਦਰੂਨੀ ਪੇਂਟ ਅਤੇ ਪੇਚਾਂ ਦਾ ਸਮਾਨ",
    "ਯੂਨਿਟ ਬਦਲਣ ਲਈ ਪੇਂਟ ਅਤੇ ਪੇਚਾਂ ਦਾ ਸਮਾਨ ਦੇ ਕੇ ਵਰਤਿਆ।"
   ],
   "tl": [
    "Suplay ng pintura sa loob at pako",
    "Nagbigay at ginamit ang pintura at fastener para sa turnover ng unit."
   ]
  },
  "fq.handyman.painting.patching_finishing": {
   "it": [
    "Tinteggiatura, stuccatura e finiture interne",
    "Ritocchi di pittura, stuccatura e piccoli lavori di finitura interna."
   ],
   "de": [
    "Innenanstrich, Spachteln und Ausbesserung",
    "Ausbesserungsanstrich, Spachteln und kleine Innenarbeiten."
   ],
   "uk": [
    "Фарбування, шпаклювання та оздоблення",
    "Підфарбування, шпаклювання й дрібні оздоблювальні роботи."
   ],
   "pa": [
    "ਅੰਦਰੂਨੀ ਪੇਂਟ, ਪੈਚਿੰਗ ਅਤੇ ਮੁਕੰਮਲ ਕੰਮ",
    "ਟੱਚ-ਅੱਪ ਪੇਂਟ, ਸਪੈਕਲਿੰਗ ਅਤੇ ਅੰਦਰਲੇ ਛੋਟੇ ਫ਼ਿਨਿਸ਼ ਕੰਮ।"
   ],
   "tl": [
    "Pintura, pagtatapal at finishing sa loob",
    "Touch-up na pintura, spackling at maliliit na finishing sa loob."
   ]
  },
  "fq.handyman.painting.wall_paint_materials": {
   "it": [
    "Tinteggiatura pareti interne — materiali e manodopera",
    "Pareti interne tinteggiate con pittura di qualità, materiali inclusi."
   ],
   "de": [
    "Innenwandanstrich — Material und Arbeit",
    "Innenwände mit Qualitätsfarbe gestrichen, Material inklusive."
   ],
   "uk": [
    "Фарбування внутрішніх стін — матеріали та робота",
    "Внутрішні стіни пофарбовано якісною фарбою, матеріали включено."
   ],
   "pa": [
    "ਅੰਦਰੂਨੀ ਕੰਧ ਪੇਂਟ — ਸਮਾਨ ਅਤੇ ਮਜ਼ਦੂਰੀ",
    "ਅੰਦਰਲੀਆਂ ਕੰਧਾਂ ਵਧੀਆ ਪੇਂਟ ਨਾਲ, ਸਮਾਨ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagpipinta ng pader sa loob — materyales at trabaho",
    "Pininturahan ang pader sa loob ng de-kalidad na pintura, kasama ang materyales."
   ]
  },
  "fq.handyman.painting.wall_ceiling_prep": {
   "it": [
    "Tinteggiatura pareti e soffitti con preparazione",
    "Pareti e soffitti preparati e tinteggiati."
   ],
   "de": [
    "Wand- und Deckenanstrich mit Vorbereitung",
    "Wände und Decken vorbereitet und gestrichen."
   ],
   "uk": [
    "Фарбування стін і стель із підготовкою",
    "Стіни й стелі підготовлено й пофарбовано."
   ],
   "pa": [
    "ਤਿਆਰੀ ਸਮੇਤ ਕੰਧ ਅਤੇ ਛੱਤ ਪੇਂਟ",
    "ਕੰਧਾਂ ਅਤੇ ਛੱਤਾਂ ਤਿਆਰ ਕਰਕੇ ਪੇਂਟ।"
   ],
   "tl": [
    "Pagpipinta ng pader at kisame na may paghahanda",
    "Inihanda at pininturahan ang pader at kisame."
   ]
  },
  "fq.handyman.plumbing.angle_stop": {
   "it": [
    "Sostituzione rubinetto sottolavello e flessibile",
    "Rubinetto sotto un sanitario sostituito con uno nuovo e un flessibile intrecciato."
   ],
   "de": [
    "Eckventil und Anschlussschlauch tauschen",
    "Das Absperrventil unter einer Armatur durch ein neues mit Panzerschlauch ersetzt."
   ],
   "uk": [
    "Заміна кутового крана та шланга",
    "Кран під приладом замінено новим з обплетеним шлангом."
   ],
   "pa": [
    "ਐਂਗਲ ਸਟੌਪ ਵਾਲਵ ਅਤੇ ਸਪਲਾਈ ਲਾਈਨ ਬਦਲਣਾ",
    "ਫ਼ਿਕਸਚਰ ਹੇਠਲਾ ਵਾਲਵ ਨਵੇਂ ਸਟੌਪ ਅਤੇ ਬ੍ਰੇਡਡ ਸਪਲਾਈ ਲਾਈਨ ਨਾਲ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng angle stop at supply line",
    "Pinalitan ng bagong stop at braided na supply line ang shut-off sa ilalim ng fixture."
   ]
  },
  "fq.handyman.plumbing.bathroom_fixtures_wallpaper": {
   "it": [
    "Sanitari, accessori e carta da parati del bagno",
    "Lavabi, rubinetti, soffioni, portasciugamani e carta da parati installati in un rinnovo del bagno."
   ],
   "de": [
    "Badarmaturen, Accessoires und Tapete",
    "Waschbecken, Armaturen, Brausen, Handtuchhalter und Tapete bei einer Badauffrischung montiert."
   ],
   "uk": [
    "Сантехніка, аксесуари й шпалери для ванної",
    "Раковини, змішувачі, лійки, тримачі рушників і шпалери встановлено при оновленні ванної."
   ],
   "pa": [
    "ਬਾਥਰੂਮ ਫ਼ਿਕਸਚਰ, ਹਾਰਡਵੇਅਰ ਅਤੇ ਵਾਲਪੇਪਰ ਲਾਉਣਾ",
    "ਬਾਥਰੂਮ ਨਵਾਂ ਕਰਨ ਵਿੱਚ ਸਿੰਕ, ਟੂਟੀਆਂ, ਸ਼ਾਵਰ ਹੈੱਡ, ਤੌਲੀਆ ਬਾਰ ਅਤੇ ਵਾਲਪੇਪਰ।"
   ],
   "tl": [
    "Fixture, hardware at wallpaper ng banyo",
    "Ikinabit ang lababo, gripo, shower head, towel bar at wallpaper sa pagpapaganda ng banyo."
   ]
  },
  "fq.handyman.plumbing.bathroom_plumbing_fixtures": {
   "it": [
    "Idraulica del bagno e sostituzione sanitari",
    "Sanitari del bagno installati, riparati o sostituiti."
   ],
   "de": [
    "Badsanitär und Armaturentausch",
    "Sanitärobjekte im Bad eingebaut, repariert oder ersetzt."
   ],
   "uk": [
    "Сантехніка ванної та заміна приладів",
    "Сантехприлади ванної встановлено, відремонтовано чи замінено."
   ],
   "pa": [
    "ਬਾਥਰੂਮ ਪਲੰਬਿੰਗ ਅਤੇ ਫ਼ਿਕਸਚਰ ਬਦਲਣਾ",
    "ਬਾਥਰੂਮ ਦੇ ਪਲੰਬਿੰਗ ਫ਼ਿਕਸਚਰ ਲਾਏ, ਠੀਕ ਜਾਂ ਬਦਲੇ।"
   ],
   "tl": [
    "Tubero ng banyo at pagpapalit ng fixture",
    "Ikinabit, inayos o pinalitan ang fixture ng tubero sa banyo."
   ]
  },
  "fq.handyman.plumbing.bathroom_remodel": {
   "it": [
    "Ristrutturazione bagno con sanitari, mobili e finiture",
    "Mobile, lavabo, sanitari e finiture sostituiti in una ristrutturazione del bagno."
   ],
   "de": [
    "Badsanierung mit Armaturen, Möbeln und Oberflächen",
    "Waschtisch, Becken, Armaturen und Oberflächen bei einer Badsanierung ersetzt."
   ],
   "uk": [
    "Ремонт ванної з приладами, меблями та оздобленням",
    "Тумбу, раковину, прилади й оздоблення замінено під час ремонту ванної."
   ],
   "pa": [
    "ਫ਼ਿਕਸਚਰ, ਕੈਬਨਿਟ ਅਤੇ ਫ਼ਿਨਿਸ਼ ਸਮੇਤ ਬਾਥਰੂਮ ਨਵੀਨੀਕਰਨ",
    "ਬਾਥਰੂਮ ਨਵੀਨੀਕਰਨ ਵਿੱਚ ਵੈਨਿਟੀ, ਸਿੰਕ, ਫ਼ਿਕਸਚਰ ਅਤੇ ਫ਼ਿਨਿਸ਼ ਬਦਲੇ।"
   ],
   "tl": [
    "Renobasyon ng banyo na may fixture, kabinet at finishing",
    "Pinalitan ang vanity, lababo, fixture at finishing sa renobasyon ng banyo."
   ]
  },
  "fq.handyman.plumbing.tub_shower_drain": {
   "it": [
    "Pulizia e riparazione scarichi di vasca e doccia",
    "Scarichi di vasca e doccia liberati e tappi e filtri riparati."
   ],
   "de": [
    "Wannen- und Duschabfluss reinigen und reparieren",
    "Wannen- und Duschabläufe freigemacht, Stopfen und Siebe repariert."
   ],
   "uk": [
    "Прочищення й ремонт зливів ванни та душу",
    "Зливи ванни й душу прочищено, пробки й сітки відремонтовано."
   ],
   "pa": [
    "ਟੱਬ ਅਤੇ ਸ਼ਾਵਰ ਡਰੇਨ ਸਫ਼ਾਈ ਅਤੇ ਮੁਰੰਮਤ",
    "ਟੱਬ ਅਤੇ ਸ਼ਾਵਰ ਡਰੇਨਾਂ ਖੋਲ੍ਹੀਆਂ ਅਤੇ ਸਟੌਪਰ ਅਤੇ ਸਟ੍ਰੇਨਰ ਠੀਕ।"
   ],
   "tl": [
    "Paglilinis at pagkukumpuni ng drain ng tub at shower",
    "Binuksan ang drain ng tub at shower at inayos ang stopper at strainer."
   ]
  },
  "fq.handyman.plumbing.ceiling_fan_bath_fixtures": {
   "it": [
    "Installazione ventilatori a soffitto e sanitari del bagno",
    "Ventilatori a soffitto appesi e rubinetteria della vasca sostituita."
   ],
   "de": [
    "Deckenventilatoren und Badarmaturen",
    "Deckenventilatoren montiert und Wannenarmaturen ersetzt."
   ],
   "uk": [
    "Стельові вентилятори та прилади ванної",
    "Стельові вентилятори повішено, прилади ванни замінено."
   ],
   "pa": [
    "ਛੱਤ ਦੇ ਪੱਖੇ ਅਤੇ ਬਾਥਰੂਮ ਫ਼ਿਕਸਚਰ ਸੇਵਾਵਾਂ",
    "ਛੱਤ ਦੇ ਪੱਖੇ ਟੰਗੇ ਅਤੇ ਬਾਥਟੱਬ ਫ਼ਿਕਸਚਰ ਬਦਲੇ।"
   ],
   "tl": [
    "Pagkakabit ng ceiling fan at fixture ng banyo",
    "Isinabit ang ceiling fan at pinalitan ang fixture ng bathtub."
   ]
  },
  "fq.handyman.plumbing.ceramic_chrome_fixtures": {
   "it": [
    "Installazione e riparazione sanitari in ceramica e cromati",
    "Piastrelle in ceramica e rubinetteria cromata installate, riparate o sostituite."
   ],
   "de": [
    "Keramik- und Chromarmaturen einbauen und reparieren",
    "Keramikfliesen und verchromte Sanitärarmaturen eingebaut, repariert oder ersetzt."
   ],
   "uk": [
    "Монтаж і ремонт керамічних і хромованих приладів",
    "Керамічну плитку й хромовану сантехніку встановлено, відремонтовано чи замінено."
   ],
   "pa": [
    "ਸਿਰੈਮਿਕ ਅਤੇ ਕ੍ਰੋਮ ਫ਼ਿਕਸਚਰ ਲਾਉਣਾ ਅਤੇ ਮੁਰੰਮਤ",
    "ਸਿਰੈਮਿਕ ਟਾਈਲ ਅਤੇ ਕ੍ਰੋਮ ਪਲੰਬਿੰਗ ਫ਼ਿਕਸਚਰ ਲਾਏ, ਠੀਕ ਜਾਂ ਬਦਲੇ।"
   ],
   "tl": [
    "Pagkakabit at pagkukumpuni ng ceramic at chrome na fixture",
    "Ikinabit, inayos o pinalitan ang ceramic tile at chrome na fixture."
   ]
  },
  "fq.handyman.plumbing.door_replacement": {
   "it": [
    "Sostituzione e installazione porte",
    "Una porta interna o esterna sostituita e montata."
   ],
   "de": [
    "Türtausch und -einbau",
    "Eine Innen- oder Außentür ersetzt und eingehängt."
   ],
   "uk": [
    "Заміна та встановлення дверей",
    "Внутрішні чи зовнішні двері замінено й навішено."
   ],
   "pa": [
    "ਦਰਵਾਜ਼ਾ ਬਦਲਣਾ ਅਤੇ ਲਾਉਣਾ",
    "ਅੰਦਰਲਾ ਜਾਂ ਬਾਹਰਲਾ ਦਰਵਾਜ਼ਾ ਬਦਲ ਕੇ ਟੰਗਿਆ।"
   ],
   "tl": [
    "Pagpapalit at pagkakabit ng pinto",
    "Pinalitan at isinabit ang pinto sa loob o labas."
   ]
  },
  "fq.handyman.plumbing.drain_sewer_clearing": {
   "it": [
    "Pulizia scarichi e condotta fognaria",
    "Scarichi e condotta fognaria liberati, diramazioni incluse."
   ],
   "de": [
    "Abfluss- und Kanalreinigung",
    "Abflüsse und Abwasserleitung freigemacht, Abzweige inklusive."
   ],
   "uk": [
    "Прочищення стоків і каналізації",
    "Стоки й каналізаційну лінію прочищено, гілки включно."
   ],
   "pa": [
    "ਡਰੇਨ ਸਫ਼ਾਈ ਅਤੇ ਸੀਵਰ ਲਾਈਨ ਖੋਲ੍ਹਣਾ",
    "ਡਰੇਨਾਂ ਅਤੇ ਸੀਵਰ ਲਾਈਨ ਖੋਲ੍ਹੀਆਂ, ਬ੍ਰਾਂਚ ਲਾਈਨਾਂ ਸਮੇਤ।"
   ],
   "tl": [
    "Paglilinis ng drain at imburnal",
    "Binuksan ang drain at linya ng imburnal, kasama ang branch line."
   ]
  },
  "fq.handyman.plumbing.disposal_replacement": {
   "it": [
    "Sostituzione e installazione tritarifiuti",
    "Vecchio tritarifiuti rimosso e nuovo installato e collegato."
   ],
   "de": [
    "Müllzerkleinerer tauschen und einbauen",
    "Der alte Zerkleinerer ausgebaut, ein neuer eingebaut und angeschlossen."
   ],
   "uk": [
    "Заміна й встановлення подрібнювача",
    "Старий подрібнювач знято, новий встановлено й підключено."
   ],
   "pa": [
    "ਗਾਰਬੇਜ ਡਿਸਪੋਜ਼ਲ ਬਦਲਣਾ ਅਤੇ ਲਾਉਣਾ",
    "ਪੁਰਾਣਾ ਡਿਸਪੋਜ਼ਲ ਕੱਢ ਕੇ ਨਵਾਂ ਲਾਇਆ ਅਤੇ ਤਾਰਾਂ ਜੋੜੀਆਂ।"
   ],
   "tl": [
    "Pagpapalit at pagkakabit ng garbage disposal",
    "Tinanggal ang lumang disposal at ikinabit at ikinonekta ang bago."
   ]
  },
  "fq.handyman.plumbing.hvac_water_heater_maintenance": {
   "it": [
    "Manutenzione HVAC e scaldacqua",
    "Messe a punto e interventi su riscaldamento, raffrescamento e scaldacqua."
   ],
   "de": [
    "HLK- und Warmwasserwartung",
    "Inspektionen und Serviceeinsätze an Heizung, Kühlung und Warmwasserbereiter."
   ],
   "uk": [
    "Обслуговування HVAC і водонагрівача",
    "Налаштування й виклики щодо опалення, охолодження та водонагрівача."
   ],
   "pa": [
    "HVAC ਅਤੇ ਵਾਟਰ ਹੀਟਰ ਸੰਭਾਲ",
    "ਹੀਟਿੰਗ, ਕੂਲਿੰਗ ਅਤੇ ਵਾਟਰ ਹੀਟਰ ਦੀ ਟਿਊਨ-ਅੱਪ ਅਤੇ ਸਰਵਿਸ ਕਾਲ।"
   ],
   "tl": [
    "Maintenance ng HVAC at water heater",
    "Tune-up at service call sa pampainit, pampalamig at water heater."
   ]
  },
  "fq.handyman.plumbing.riser_extensions_valves": {
   "it": [
    "Prolunghe per colonne e valvole di intercettazione",
    "Prolunghe in PVC e metallo e valvole di intercettazione fornite e installate."
   ],
   "de": [
    "Steigleitungsverlängerungen und Absperrventile",
    "Verlängerungen aus PVC und Metall sowie Absperrventile geliefert und eingebaut."
   ],
   "uk": [
    "Подовжувачі стояків і запірні крани",
    "Подовжувачі з ПВХ і металу та запірні крани постачено й встановлено."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਰਾਈਜ਼ਰ ਐਕਸਟੈਂਸ਼ਨ ਅਤੇ ਬੰਦ ਵਾਲਵ",
    "PVC ਅਤੇ ਧਾਤ ਦੇ ਰਾਈਜ਼ਰ ਐਕਸਟੈਂਸ਼ਨ ਅਤੇ ਬੰਦ ਵਾਲਵ ਦੇ ਕੇ ਲਾਏ।"
   ],
   "tl": [
    "Riser extension at cut-off valve",
    "Nagbigay at ikinabit ang PVC at metal na riser extension at shut-off valve."
   ]
  },
  "fq.handyman.plumbing.faucet_install": {
   "it": [
    "Installazione rubinetti di cucina e bagno",
    "Rubinetti installati o sostituiti e provati per perdite."
   ],
   "de": [
    "Küchen- und Badarmaturen montieren",
    "Armaturen montiert oder ersetzt und auf Dichtheit geprüft."
   ],
   "uk": [
    "Встановлення змішувачів кухні та ванної",
    "Змішувачі встановлено чи замінено й перевірено на протікання."
   ],
   "pa": [
    "ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਟੂਟੀ ਲਾਉਣਾ",
    "ਟੂਟੀਆਂ ਲਾਈਆਂ ਜਾਂ ਬਦਲੀਆਂ ਅਤੇ ਲੀਕ ਲਈ ਜਾਂਚੀਆਂ।"
   ],
   "tl": [
    "Pagkakabit ng gripo sa kusina at banyo",
    "Ikinabit o pinalitan ang gripo at sinuri sa tagas."
   ]
  },
  "fq.handyman.plumbing.sink_install_repair": {
   "it": [
    "Installazione lavelli e riparazioni idrauliche",
    "Lavelli installati, collegati e idraulica riparata."
   ],
   "de": [
    "Spülen und Becken einbauen, Sanitär reparieren",
    "Becken eingebaut, angeschlossen und die Installation repariert."
   ],
   "uk": [
    "Встановлення мийок і ремонт сантехніки",
    "Мийки встановлено, під'єднано, сантехніку відремонтовано."
   ],
   "pa": [
    "ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਸਿੰਕ ਲਾਉਣਾ ਅਤੇ ਪਲੰਬਿੰਗ ਮੁਰੰਮਤ",
    "ਸਿੰਕ ਲਾਏ, ਜੋੜੇ ਅਤੇ ਉਹਨਾਂ ਦੀ ਪਲੰਬਿੰਗ ਠੀਕ।"
   ],
   "tl": [
    "Pagkakabit ng lababo at pagkukumpuni ng tubero",
    "Ikinabit at ikinonekta ang lababo at inayos ang tubero nito."
   ]
  },
  "fq.handyman.plumbing.install_repair": {
   "it": [
    "Installazione e riparazione idraulica",
    "Impianti idraulici residenziali installati, riparati o ispezionati."
   ],
   "de": [
    "Sanitärinstallation und -reparatur",
    "Wohnhaus-Sanitär eingebaut, repariert oder geprüft."
   ],
   "uk": [
    "Монтаж і ремонт сантехніки",
    "Побутову сантехніку встановлено, відремонтовано чи перевірено."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਲਾਉਣਾ ਅਤੇ ਮੁਰੰਮਤ",
    "ਘਰੇਲੂ ਪਲੰਬਿੰਗ ਲਾਈ, ਠੀਕ ਜਾਂ ਜਾਂਚੀ।"
   ],
   "tl": [
    "Pagkakabit at pagkukumpuni ng tubero",
    "Ikinabit, inayos o siniyasat ang tubero ng bahay."
   ]
  },
  "fq.handyman.plumbing.repair_fixture_replacement": {
   "it": [
    "Riparazioni idrauliche e sostituzione sanitari",
    "Riparazioni, sostituzione sanitari, lavori sugli scarichi e siliconature."
   ],
   "de": [
    "Sanitärreparatur und Armaturentausch",
    "Reparaturen, Armaturentausch, Abflussarbeiten und Verfugen."
   ],
   "uk": [
    "Ремонт сантехніки та заміна приладів",
    "Ремонти, заміна приладів, роботи зі стоками й герметизація."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਮੁਰੰਮਤ ਅਤੇ ਫ਼ਿਕਸਚਰ ਬਦਲਣਾ",
    "ਮੁਰੰਮਤਾਂ, ਫ਼ਿਕਸਚਰ ਬਦਲੀ, ਡਰੇਨ ਕੰਮ ਅਤੇ ਕੌਕਿੰਗ।"
   ],
   "tl": [
    "Pagkukumpuni ng tubero at pagpapalit ng fixture",
    "Pagkukumpuni, pagpapalit ng fixture, trabaho sa drain at caulking."
   ]
  },
  "fq.handyman.plumbing.repair_fixture_service": {
   "it": [
    "Riparazioni idrauliche e assistenza sanitari",
    "Rubinetti, WC e sanitari riparati e manutenuti."
   ],
   "de": [
    "Sanitärreparatur und Armaturenservice",
    "Armaturen, WCs und Sanitärobjekte repariert und gewartet."
   ],
   "uk": [
    "Ремонт сантехніки й обслуговування приладів",
    "Змішувачі, унітази й прилади відремонтовано й обслуговано."
   ],
   "pa": [
    "ਪਲੰਬਿੰਗ ਮੁਰੰਮਤ ਅਤੇ ਫ਼ਿਕਸਚਰ ਸਰਵਿਸ",
    "ਟੂਟੀਆਂ, ਟਾਇਲਟ ਅਤੇ ਫ਼ਿਕਸਚਰ ਠੀਕ ਅਤੇ ਸੰਭਾਲ।"
   ],
   "tl": [
    "Pagkukumpuni ng tubero at serbisyo ng fixture",
    "Inayos at inalagaan ang gripo, inidoro at fixture."
   ]
  },
  "fq.handyman.plumbing.pipe_materials": {
   "it": [
    "Fornitura e posa tubazioni idrauliche residenziali",
    "Tubi in polietilene, PVC e flessibili forniti e installati."
   ],
   "de": [
    "Rohrmaterial für Wohnhäuser liefern und verlegen",
    "Poly-, PVC- und Flexrohre geliefert und verlegt."
   ],
   "uk": [
    "Постачання й монтаж побутових труб",
    "Поліетиленові, ПВХ і гнучкі труби постачено й змонтовано."
   ],
   "pa": [
    "ਘਰੇਲੂ ਪਲੰਬਿੰਗ ਪਾਈਪ ਦੇਣਾ ਅਤੇ ਲਾਉਣਾ",
    "ਪੌਲੀ, PVC ਅਤੇ ਲਚਕੀਲੀ ਟਿਊਬਿੰਗ ਦੇ ਕੇ ਲਾਈ।"
   ],
   "tl": [
    "Suplay at pagkakabit ng tubo sa bahay",
    "Nagbigay at ikinabit ang poly, PVC at flexible na tubo."
   ]
  },
  "fq.handyman.plumbing.toilet_install_repair": {
   "it": [
    "Installazione e riparazione WC",
    "WC installati, riparati o sostituiti."
   ],
   "de": [
    "WC-Einbau und -Reparatur",
    "WCs eingebaut, repariert oder ersetzt."
   ],
   "uk": [
    "Встановлення й ремонт унітазів",
    "Унітази встановлено, відремонтовано чи замінено."
   ],
   "pa": [
    "ਟਾਇਲਟ ਲਾਉਣਾ ਅਤੇ ਮੁਰੰਮਤ",
    "ਟਾਇਲਟ ਲਾਏ, ਠੀਕ ਜਾਂ ਬਦਲੇ।"
   ],
   "tl": [
    "Pagkakabit at pagkukumpuni ng inidoro",
    "Ikinabit, inayos o pinalitan ang inidoro."
   ]
  },
  "fq.handyman.plumbing.toilet_install_seat_valve": {
   "it": [
    "Installazione WC con sedile, valvola di carico e accessori",
    "WC installato completo di sedile, valvola di carico, bulloni della flangia e flessibile."
   ],
   "de": [
    "WC-Einbau mit Sitz, Füllventil und Zubehör",
    "Ein WC komplett mit Sitz, Füllventil, Flanschschrauben und Anschlussschlauch eingebaut."
   ],
   "uk": [
    "Встановлення унітаза з сидінням, клапаном і фурнітурою",
    "Унітаз встановлено разом із сидінням, наливним клапаном, болтами фланця й шлангом."
   ],
   "pa": [
    "ਸੀਟ, ਫ਼ਿੱਲ ਵਾਲਵ ਅਤੇ ਹਾਰਡਵੇਅਰ ਸਮੇਤ ਟਾਇਲਟ ਲਾਉਣਾ",
    "ਸੀਟ, ਫ਼ਿੱਲ ਵਾਲਵ, ਫ਼ਲੈਂਜ ਬੋਲਟ ਅਤੇ ਸਪਲਾਈ ਲਾਈਨ ਸਮੇਤ ਪੂਰਾ ਟਾਇਲਟ ਲਾਇਆ।"
   ],
   "tl": [
    "Pagkakabit ng inidoro na may upuan, fill valve at hardware",
    "Ikinabit ang buong inidoro kasama ang upuan, fill valve, flange bolt at supply line."
   ]
  },
  "fq.handyman.plumbing.toilet_labour": {
   "it": [
    "Manodopera per riparazione, sostituzione e installazione WC",
    "Manodopera per riparare, sostituire o installare un WC."
   ],
   "de": [
    "Arbeit für WC-Reparatur, -Tausch und -Einbau",
    "Arbeitszeit für Reparatur, Austausch oder Einbau eines WCs."
   ],
   "uk": [
    "Роботи з ремонту, заміни й встановлення унітаза",
    "Робота з ремонту, заміни чи встановлення унітаза."
   ],
   "pa": [
    "ਟਾਇਲਟ ਮੁਰੰਮਤ, ਬਦਲੀ ਅਤੇ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਟਾਇਲਟ ਠੀਕ ਕਰਨ, ਬਦਲਣ ਜਾਂ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ।"
   ],
   "tl": [
    "Trabaho sa pagkukumpuni, pagpapalit at pagkakabit ng inidoro",
    "Trabaho para ayusin, palitan o ikabit ang inidoro."
   ]
  },
  "fq.handyman.electrical.light_fixture_replacement": {
   "pa": [
    "ਲਾਈਟ ਫ਼ਿਕਸਚਰ ਬਦਲਣਾ",
    "ਪੁਰਾਣੀ ਲਾਈਟ ਉਤਾਰੀ ਅਤੇ ਗਾਹਕ ਦੀ ਖ਼ਰੀਦੀ ਨਵੀਂ ਮੌਜੂਦਾ ਬਾਕਸ ਉੱਤੇ ਟੰਗ ਕੇ ਜੋੜੀ ਅਤੇ ਜਾਂਚੀ।"
   ]
  },
  "fq.handyman.labour.home_walkthrough": {
   "pa": [
    "ਘਰ ਦੀ ਸੰਭਾਲ ਦਾ ਚੱਕਰ ਅਤੇ ਕੰਮਾਂ ਦੀ ਸੂਚੀ",
    "ਗਾਹਕ ਨਾਲ ਹਰ ਕਮਰੇ ਅਤੇ ਬਾਹਰ ਦਾ ਚੱਕਰ, ਛੋਟੇ ਨੁਕਸ ਨੋਟ ਅਤੇ ਰੇਟ ਸਮੇਤ ਮੁਰੰਮਤਾਂ ਦੀ ਸੂਚੀ।"
   ]
  },
  "fq.handyman.labour.estimate_visit": {
   "pa": [
    "ਮੌਕੇ ਉੱਤੇ ਅੰਦਾਜ਼ਾ ਵਿਜ਼ਿਟ",
    "ਕੰਮ ਆਪ ਦੇਖਿਆ ਤਾਂ ਜੋ ਰੇਟ ਅਸਲ ਹਾਲਤ ਦਾ ਹੋਵੇ, ਫ਼ੋਟੋ ਤੋਂ ਅੰਦਾਜ਼ਾ ਨਹੀਂ।"
   ]
  },
  "fq.handyman.labour.seasonal_checklist": {
   "pa": [
    "ਮੌਸਮੀ ਘਰ ਸੰਭਾਲ ਵਿਜ਼ਿਟ",
    "ਇੱਕ ਵਿਜ਼ਿਟ ਵਿੱਚ ਮੌਸਮੀ ਸੂਚੀ: ਪਰਨਾਲੇ ਜਾਂਚੇ, ਬਾਹਰੀ ਕੌਕ ਠੀਕ, ਫ਼ਿਲਟਰ ਬਦਲੇ, ਡਿਟੈਕਟਰ ਟੈਸਟ, ਬਾਹਰਲੀਆਂ ਟੂਟੀਆਂ ਖੋਲ੍ਹੀਆਂ ਜਾਂ ਬੰਦ।"
   ]
  },
  "fq.handyman.labour.diagnostic_visit": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਹੈਂਡੀਮੈਨ ਆ ਕੇ ਦੇਖਦਾ ਹੈ ਕਿ ਕੀ ਗ਼ਲਤ ਹੈ ਅਤੇ ਕੰਮ ਤੋਂ ਪਹਿਲਾਂ ਦੱਸਦਾ ਹੈ ਕਿ ਠੀਕ ਕਰਨ ਲਈ ਕੀ ਲੱਗੇਗਾ।"
   ]
  },
  "fq.handyman.labour.repair_visit": {
   "pa": [
    "ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਘਰ ਦੀ ਕੋਈ ਚੀਜ਼ ਠੀਕ ਕਰਨ ਲਈ ਸੱਦਾ, ਹੋ ਸਕੇ ਤਾਂ ਉਸੇ ਵਿਜ਼ਿਟ ਵਿੱਚ ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ।"
   ]
  },
  "fq.handyman.doors_windows.glass_pane": {
   "pa": [
    "ਸ਼ੀਸ਼ਾ ਬਦਲਣਾ",
    "ਤਿੜਕਿਆ ਜਾਂ ਟੁੱਟਿਆ ਸ਼ੀਸ਼ਾ ਕੱਢ ਕੇ ਨਵਾਂ ਤਾਜ਼ੀ ਗਲੇਜ਼ਿੰਗ ਵਿੱਚ ਲਾਇਆ ਅਤੇ ਫ਼ਰੇਮ ਸਾਫ਼।"
   ]
  },
  "fq.handyman.exterior.deck_board_replacement": {
   "pa": [
    "ਡੈੱਕ ਫੱਟਾ ਬਦਲਣਾ — ਪ੍ਰਤੀ ਫੱਟਾ",
    "ਸੜਿਆ, ਪਾਟਿਆ ਜਾਂ ਢਿੱਲਾ ਫੱਟਾ ਕੱਢ ਕੇ ਨਵਾਂ ਕੱਟਿਆ, ਕੱਸਿਆ ਅਤੇ ਮਿਲਾਇਆ।"
   ]
  },
  "fq.handyman.flooring.floor_patch": {
   "pa": [
    "ਫ਼ਰਸ਼ ਦੀ ਮੁਰੰਮਤ ਅਤੇ ਪੈਚ",
    "ਫ਼ਰਸ਼ ਦਾ ਖ਼ਰਾਬ ਹਿੱਸਾ ਕੱਟਿਆ, ਹੇਠਲਾ ਸਬਫ਼ਲੋਰ ਜਾਂਚਿਆ ਅਤੇ ਨਵਾਂ ਫ਼ਰਸ਼ ਜੋੜਿਆ।"
   ]
  },
  "fq.handyman.flooring.tile_replacement": {
   "pa": [
    "ਟਾਈਲ ਬਦਲਣਾ — ਛੋਟਾ ਹਿੱਸਾ",
    "ਕੁਝ ਤਿੜਕੀਆਂ ਜਾਂ ਢਿੱਲੀਆਂ ਟਾਈਲਾਂ ਕੱਢ ਕੇ ਬਦਲੀਆਂ ਅਤੇ ਮੇਲ ਖਾਂਦਾ ਗ੍ਰਾਊਟ।"
   ]
  },
  "fq.handyman.exterior.gutter_repair": {
   "pa": [
    "ਪਰਨਾਲੇ ਦੀ ਮੁਰੰਮਤ",
    "ਝੁਕਿਆ, ਲੀਕ ਜਾਂ ਉੱਖੜਿਆ ਪਰਨਾਲਾ ਮੁੜ ਜੋੜਿਆ, ਸੀਲ ਅਤੇ ਨਿਕਾਸ ਲਈ ਢਲਾਣ।"
   ]
  }
 },
 "lines": {
  "Furniture assembly — per item": {
   "pa": [
    "ਫ਼ਰਨੀਚਰ ਜੋੜਨਾ — ਪ੍ਰਤੀ ਚੀਜ਼",
    "ਇੱਕ ਚੀਜ਼ ਜੋੜੀ, ਸਿੱਧੀ ਕੀਤੀ ਅਤੇ ਜਿੱਥੇ ਡਿੱਗ ਸਕਦੀ ਹੈ ਕੰਧ ਨਾਲ ਬੰਨ੍ਹੀ।"
   ]
  },
  "Cabinet installation — per cabinet": {
   "pa": [
    "ਕੈਬਨਿਟ ਲਾਉਣਾ — ਪ੍ਰਤੀ ਕੈਬਨਿਟ",
    "ਇੱਕ ਕੈਬਨਿਟ ਪੱਧਰਾ, ਸਟੱਡਾਂ ਅਤੇ ਨਾਲ ਵਾਲੇ ਨਾਲ ਕੱਸਿਆ, ਦਰਵਾਜ਼ੇ ਸੈੱਟ।"
   ]
  },
  "Crown moulding installation — per linear ft": {
   "pa": [
    "ਕ੍ਰਾਊਨ ਮੋਲਡਿੰਗ ਲਾਉਣਾ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਮੋਲਡਿੰਗ ਕੋਪ ਕਰਕੇ ਪਲੇਟਾਂ ਅਤੇ ਸਟੱਡਾਂ ਨਾਲ ਕਿੱਲਾਂ, ਜੋੜ ਭਰੇ ਅਤੇ ਕੌਕ।"
   ]
  },
  "Primed MDF crown — per linear ft": {
   "pa": [
    "ਪ੍ਰਾਈਮ MDF ਕ੍ਰਾਊਨ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "3-5/8 ਇੰਚ ਪ੍ਰਾਈਮ MDF ਕ੍ਰਾਊਨ ਮੋਲਡਿੰਗ, ਕਿੱਲਾਂ ਅਤੇ ਕੌਕ।"
   ]
  },
  "Service call and travel": {
   "pa": [
    "ਸਰਵਿਸ ਕਾਲ ਅਤੇ ਸਫ਼ਰ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਜਾਇਦਾਦ ਉੱਤੇ ਭੇਜਿਆ; ਸਫ਼ਰ ਅਤੇ ਸਮੱਸਿਆ ਦੀ ਪਹਿਲੀ ਜਾਂਚ ਸ਼ਾਮਲ।"
   ]
  },
  "Handyman labour — per hour": {
   "pa": [
    "ਹੈਂਡੀਮੈਨ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਘੰਟਾ",
    "ਪਹਿਲੀ ਵਿਜ਼ਿਟ ਤੋਂ ਬਾਅਦ ਮੌਕੇ ਦਾ ਕੰਮ ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Door installation labour": {
   "pa": [
    "ਦਰਵਾਜ਼ਾ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣਾ ਦਰਵਾਜ਼ਾ ਲਾਹਿਆ, ਨਵਾਂ ਲਾਇਆ, ਕਬਜ਼ੇ ਅਤੇ ਕੁੰਡਾ ਸੈੱਟ ਅਤੇ ਵਿੱਥ ਠੀਕ।"
   ]
  },
  "Lockset and hinges": {
   "pa": [
    "ਤਾਲਾ ਅਤੇ ਕਬਜ਼ੇ",
    "ਲੰਘਣ ਜਾਂ ਨਿੱਜਤਾ ਵਾਲਾ ਤਾਲਾ ਅਤੇ ਮੇਲ ਖਾਂਦੇ ਤਿੰਨ ਕਬਜ਼ੇ।"
   ]
  },
  "TV mounting labour": {
   "pa": [
    "TV ਟੰਗਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਸਟੱਡ ਲੱਭੇ, ਬ੍ਰੈਕਟ ਕੱਸੀ, TV ਟੰਗ ਕੇ ਪੱਧਰਾ ਅਤੇ ਤਾਰਾਂ ਸੰਵਾਰੀਆਂ।"
   ]
  },
  "Tilting TV wall mount": {
   "pa": [
    "ਝੁਕਣ ਵਾਲਾ TV ਕੰਧ ਮਾਊਂਟ",
    "32–70 ਇੰਚ ਸਕ੍ਰੀਨਾਂ ਲਈ ਝੁਕਣ ਵਾਲਾ ਮਾਊਂਟ, ਲੈਗ ਬੋਲਟਾਂ ਸਮੇਤ।"
   ]
  },
  "Window screen repair — per screen": {
   "pa": [
    "ਖਿੜਕੀ ਜਾਲੀ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਜਾਲੀ",
    "ਨਵੀਂ ਸਪਲਾਈਨ ਨਾਲ ਜਾਲ ਮੁੜ ਪਾਇਆ, ਸਿੱਧਾ ਕਰਕੇ ਮੁੜ ਲਾਇਆ।"
   ]
  },
  "Grab bar installation labour — per bar": {
   "pa": [
    "ਗ੍ਰੈਬ ਬਾਰ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਬਾਰ",
    "ਸਟੱਡ ਜਾਂ ਬਲੌਕਿੰਗ ਲੱਭੀ, ਡਾਇਮੰਡ ਬਿੱਟ ਨਾਲ ਟਾਈਲ ਵਿੱਚ ਛੇਕ, ਬਾਰ ਪੱਕਾ ਅਤੇ ਭਾਰ ਟੈਸਟ।"
   ]
  },
  "Stainless grab bar — 24 in": {
   "pa": [
    "ਸਟੇਨਲੈੱਸ ਗ੍ਰੈਬ ਬਾਰ — 24 ਇੰਚ",
    "ਲੁਕਵੇਂ ਫ਼ਲੈਂਜਾਂ ਅਤੇ ਐਂਕਰਾਂ ਵਾਲਾ ADA ਦਰਜੇ ਦਾ 24 ਇੰਚ ਸਟੇਨਲੈੱਸ ਬਾਰ।"
   ]
  },
  "Shelf or fixture mounting — per item": {
   "pa": [
    "ਸ਼ੈਲਫ਼ ਜਾਂ ਫ਼ਿਕਸਚਰ ਟੰਗਣਾ — ਪ੍ਰਤੀ ਚੀਜ਼",
    "ਥਾਂ ਲੱਭੀ, ਪੱਧਰੀ ਕਰਕੇ ਸਟੱਡਾਂ ਜਾਂ ਮਜ਼ਬੂਤ ਐਂਕਰਾਂ ਨਾਲ ਕੱਸੀ।"
   ]
  },
  "Door repair labour": {
   "pa": [
    "ਦਰਵਾਜ਼ਾ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਕਬਜ਼ੇ ਮੁੜ ਸੈੱਟ, ਸਟ੍ਰਾਈਕ ਹਿਲਾਈ, ਕਿਨਾਰਾ ਰੰਦਾ ਜਾਂ ਨੁਕਸਾਨ ਭਰਿਆ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Fasteners, sealant and consumables": {
   "pa": [
    "ਪੇਚ, ਸੀਲੈਂਟ ਅਤੇ ਖਪਤ ਵਾਲਾ ਸਮਾਨ",
    "ਪੇਚ, ਐਂਕਰ, ਸੀਲੈਂਟ, ਟੇਪ ਅਤੇ ਕੰਮ ਵਿੱਚ ਲੱਗਣ ਵਾਲੇ ਛੋਟੇ ਪੁਰਜ਼ੇ।"
   ]
  },
  "Fan motor replacement labour": {
   "pa": [
    "ਪੱਖਾ ਮੋਟਰ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਗਰਿੱਲ ਅਤੇ ਮੋਟਰ ਪਲੇਟ ਕੱਢੀ, ਨਵੀਂ ਮੋਟਰ ਅਤੇ ਵ੍ਹੀਲ ਲਾਏ, ਡਕਟ ਕਨੈਕਸ਼ਨ ਜਾਂਚਿਆ।"
   ]
  },
  "Replacement fan motor and wheel": {
   "pa": [
    "ਬਦਲਵੀਂ ਪੱਖਾ ਮੋਟਰ ਅਤੇ ਵ੍ਹੀਲ",
    "ਬਲੋਅਰ ਵ੍ਹੀਲ ਸਮੇਤ ਯੂਨੀਵਰਸਲ ਬਾਥਰੂਮ ਪੱਖਾ ਮੋਟਰ, 50–80 CFM।"
   ]
  },
  "Deck structural repair": {
   "pa": [
    "ਡੈੱਕ ਦੀ ਢਾਂਚਾਗਤ ਮੁਰੰਮਤ",
    "ਲੈਜਰ ਬੋਰਡ ਢਾਂਚਾਗਤ ਪੇਚਾਂ ਨਾਲ ਘਰ ਨਾਲ ਮੁੜ ਕੱਸਿਆ ਅਤੇ ਫ਼ਲੈਸ਼ਿੰਗ ਮੁੜ।"
   ]
  },
  "Diagnostic visit": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਘਰ ਆ ਕੇ ਸਮੱਸਿਆ ਦਾ ਕਾਰਨ ਲੱਭਦਾ ਅਤੇ ਮੁਰੰਮਤ ਤੋਂ ਪਹਿਲਾਂ ਹੱਲ ਸਮਝਾਉਂਦਾ ਹੈ।"
   ]
  },
  "Fence repair labour": {
   "pa": [
    "ਵਾੜ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਥੰਮ੍ਹ ਮੁੜ ਗੱਡੇ, ਰੇਲਾਂ ਕੱਸੀਆਂ ਅਤੇ ਫੱਟੇ ਬਦਲੇ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Fence panel repair — per panel": {
   "pa": [
    "ਵਾੜ ਪੈਨਲ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਪੈਨਲ",
    "ਖ਼ਰਾਬ ਪੈਨਲ ਜਾਂ ਹਿੱਸਾ ਮੁੜ ਬਣਾਇਆ ਜਾਂ ਬਦਲ ਕੇ ਥੰਮ੍ਹਾਂ ਨਾਲ ਕੱਸਿਆ।"
   ]
  },
  "Privacy fence panel — per panel": {
   "pa": [
    "ਪਰਦਾ ਵਾੜ ਪੈਨਲ — ਪ੍ਰਤੀ ਪੈਨਲ",
    "ਗੈਲਵਨਾਈਜ਼ਡ ਪੇਚਾਂ ਸਮੇਤ 6 × 8 ਫੁੱਟ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਪਰਦਾ ਪੈਨਲ।"
   ]
  },
  "Deck staining and sealing — per sq ft": {
   "pa": [
    "ਡੈੱਕ ਸਟੇਨ ਅਤੇ ਸੀਲ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਡੈੱਕ ਧੋਤਾ, ਸੁਕਾਇਆ ਅਤੇ ਸਟੇਨ ਜਾਂ ਸੀਲ।"
   ]
  },
  "Deck stain — per gallon": {
   "pa": [
    "ਡੈੱਕ ਸਟੇਨ — ਪ੍ਰਤੀ ਗੈਲਨ",
    "ਅਰਧ-ਪਾਰਦਰਸ਼ੀ ਅੰਦਰ ਰਚਣ ਵਾਲਾ ਸਟੇਨ; ਇੱਕ ਗੈਲਨ ਲਗਭਗ 200 ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Grout repair — per section": {
   "pa": [
    "ਗ੍ਰਾਊਟ ਮੁਰੰਮਤ — ਪ੍ਰਤੀ ਹਿੱਸਾ",
    "ਤਿੜਕਿਆ ਗ੍ਰਾਊਟ ਕੱਢ ਕੇ ਇੱਕ ਹਿੱਸੇ ਵਿੱਚ ਮੁੜ ਭਰਿਆ ਅਤੇ ਸੀਲ।"
   ]
  },
  "Dryer vent cleaning": {
   "pa": [
    "ਡ੍ਰਾਇਰ ਵੈਂਟ ਦੀ ਸਫ਼ਾਈ",
    "ਡ੍ਰਾਇਰ ਤੋਂ ਬਾਹਰਲੇ ਹੁੱਡ ਤੱਕ ਡਕਟ ਬੁਰਸ਼ ਅਤੇ ਵੈਕਿਊਮ, ਹਵਾ ਜਾਂਚੀ।"
   ]
  },
  "Semi-rigid transition duct": {
   "pa": [
    "ਅਰਧ-ਸਖ਼ਤ ਜੋੜ ਡਕਟ",
    "ਕਲੈਂਪਾਂ ਸਮੇਤ 4 ਇੰਚ ਅਰਧ-ਸਖ਼ਤ ਐਲੂਮੀਨੀਅਮ ਜੋੜ ਡਕਟ।"
   ]
  },
  "Caulk removal and re-caulking — per linear ft": {
   "pa": [
    "ਕੌਕ ਹਟਾਉਣਾ ਅਤੇ ਮੁੜ ਕੌਕ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਖ਼ਰਾਬ ਕੌਕ ਕੱਢੀ, ਜੋੜ ਸਾਫ਼ ਅਤੇ ਨਵੀਂ ਲਾਈਨ ਲਾਈ।"
   ]
  },
  "Caulk — per tube": {
   "pa": [
    "ਕੌਕ — ਪ੍ਰਤੀ ਟਿਊਬ",
    "ਪੇਂਟ ਹੋਣ ਵਾਲਾ ਲਚਕੀਲਾ ਸੀਲੈਂਟ; ਇੱਕ ਟਿਊਬ ਲਗਭਗ 40 ਲੀਨੀਅਰ ਫੁੱਟ।"
   ]
  },
  "Patch repair labour — per patch": {
   "pa": [
    "ਪੈਚ ਮੁਰੰਮਤ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਪੈਚ",
    "ਛੇਕ ਚੌਰਸ, ਪਿੱਛੇ ਸਹਾਰਾ ਅਤੇ ਪੈਚ, ਤਿੰਨ ਕੋਟ ਕੰਪਾਊਂਡ ਅਤੇ ਰਗੜਾਈ, ਪੇਂਟ ਲਈ ਤਿਆਰ।"
   ]
  },
  "Patch, compound and tape — per patch": {
   "pa": [
    "ਪੈਚ, ਕੰਪਾਊਂਡ ਅਤੇ ਟੇਪ — ਪ੍ਰਤੀ ਪੈਚ",
    "ਡ੍ਰਾਈਵਾਲ ਟੁਕੜਾ ਜਾਂ ਜਾਲੀ ਪੈਚ, ਸੈਟਿੰਗ ਕੰਪਾਊਂਡ ਅਤੇ ਟੇਪ।"
   ]
  },
  "Paint touch-up — one room or area": {
   "pa": [
    "ਪੇਂਟ ਟੱਚ-ਅੱਪ — ਇੱਕ ਕਮਰਾ ਜਾਂ ਹਿੱਸਾ",
    "ਨਿਸ਼ਾਨਾਂ ਉੱਤੇ ਪ੍ਰਾਈਮਰ ਅਤੇ ਮੇਲ ਖਾਂਦਾ ਰੰਗ ਮਿਲਾ ਕੇ।"
   ]
  },
  "Fixture swap labour": {
   "pa": [
    "ਫ਼ਿਕਸਚਰ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਬਿਜਲੀ ਬੰਦ, ਪੁਰਾਣੀ ਲਾਈਟ ਉਤਾਰੀ, ਨਵੀਂ ਜੋੜ ਕੇ ਲਾਈ ਅਤੇ ਟੈਸਟ।"
   ]
  },
  "Wire nuts, box strap and bulbs": {
   "pa": [
    "ਵਾਇਰ ਨੱਟ, ਬਾਕਸ ਪੱਟੀ ਅਤੇ ਬਲਬ",
    "ਕਨੈਕਟਰ, ਮਾਊਂਟਿੰਗ ਪੱਟੀ ਅਤੇ LED ਬਲਬ ਜੇ ਲਾਈਟ ਨਾਲ ਨਾ ਆਉਣ।"
   ]
  },
  "Walkthrough and punch list": {
   "pa": [
    "ਚੱਕਰ ਅਤੇ ਕੰਮਾਂ ਦੀ ਸੂਚੀ",
    "ਪੂਰੇ ਘਰ ਦਾ ਚੱਕਰ, ਨੁਕਸਾਂ ਦੀਆਂ ਫ਼ੋਟੋਆਂ ਅਤੇ ਰੇਟ ਸਮੇਤ ਮੁਰੰਮਤਾਂ ਦੀ ਸੂਚੀ।"
   ]
  },
  "Estimate visit": {
   "pa": [
    "ਅੰਦਾਜ਼ਾ ਵਿਜ਼ਿਟ",
    "ਮੌਕੇ ਉੱਤੇ ਕੰਮ ਦੇਖ ਕੇ ਲਿਖਤੀ ਰੇਟ; ਦਸਤਖ਼ਤ ਕੀਤੇ ਕੋਟ ਨਾਲ ਮੁਫ਼ਤ।"
   ]
  },
  "Seasonal maintenance labour": {
   "pa": [
    "ਮੌਸਮੀ ਸੰਭਾਲ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਅੰਦਰ ਕਮਰਾ-ਦਰ-ਕਮਰਾ ਅਤੇ ਬਾਹਰ ਸੂਚੀ ਦੇ ਕੰਮ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Filters, batteries and caulk": {
   "pa": [
    "ਫ਼ਿਲਟਰ, ਬੈਟਰੀਆਂ ਅਤੇ ਕੌਕ",
    "ਫ਼ਰਨੇਸ ਫ਼ਿਲਟਰ, ਡਿਟੈਕਟਰ ਬੈਟਰੀਆਂ ਅਤੇ ਬਾਹਰੀ ਕੌਕ ਦੀ ਟਿਊਬ।"
   ]
  },
  "Repair": {
   "pa": [
    "ਮੁਰੰਮਤ",
    "ਮੌਕੇ ਉੱਤੇ ਨੁਕਸ ਲੱਭ ਕੇ ਠੀਕ ਕੀਤਾ।"
   ]
  },
  "Glass pane replacement — per pane": {
   "pa": [
    "ਸ਼ੀਸ਼ਾ ਬਦਲਣਾ — ਪ੍ਰਤੀ ਸ਼ੀਸ਼ਾ",
    "ਟੁੱਟਿਆ ਸ਼ੀਸ਼ਾ ਸੁਰੱਖਿਅਤ ਕੱਢਿਆ, ਨਵਾਂ ਨਾਪ ਦਾ ਕੱਟ ਕੇ ਗਲੇਜ਼ ਕੀਤਾ।"
   ]
  },
  "Deck board replacement — per board": {
   "pa": [
    "ਡੈੱਕ ਫੱਟਾ ਬਦਲਣਾ — ਪ੍ਰਤੀ ਫੱਟਾ",
    "ਪੁਰਾਣਾ ਫੱਟਾ ਕੱਢਿਆ, ਜੋਇਸਟ ਜਾਂਚਿਆ, ਨਵਾਂ ਕੱਟ ਕੇ ਕੱਸਿਆ।"
   ]
  },
  "Pressure-treated deck board — per board": {
   "pa": [
    "ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਡੈੱਕ ਫੱਟਾ — ਪ੍ਰਤੀ ਫੱਟਾ",
    "ਡੈੱਕ ਪੇਚਾਂ ਸਮੇਤ 5/4 × 6 ਇੰਚ ਪ੍ਰੈਸ਼ਰ-ਟ੍ਰੀਟਡ ਫੱਟਾ, 8 ਫੁੱਟ।"
   ]
  },
  "Flooring patch repair": {
   "pa": [
    "ਫ਼ਰਸ਼ ਪੈਚ ਮੁਰੰਮਤ",
    "ਖ਼ਰਾਬ ਹਿੱਸਾ ਕੱਟਿਆ, ਸਬਫ਼ਲੋਰ ਜਾਂਚਿਆ ਅਤੇ ਨਵਾਂ ਫ਼ਰਸ਼ ਜੋੜਿਆ।"
   ]
  },
  "Materials allowance": {
   "pa": [
    "ਸਮਾਨ ਦਾ ਅੰਦਾਜ਼ਾ",
    "ਸਮਾਨ ਲਈ ਅੰਦਾਜ਼ਨ ਰਕਮ, ਬਿੱਲ ਉੱਤੇ ਰਸੀਦਾਂ ਨਾਲ ਮਿਲਾਈ ਜਾਂਦੀ ਹੈ।"
   ]
  },
  "Tile replacement": {
   "pa": [
    "ਟਾਈਲ ਬਦਲਣਾ",
    "ਟੁੱਟੀਆਂ ਟਾਈਲਾਂ ਕੱਢੀਆਂ, ਥਾਂ ਸਾਫ਼ ਅਤੇ ਨਵੀਆਂ ਲਾ ਕੇ ਗ੍ਰਾਊਟ।"
   ]
  },
  "Gutter section repair": {
   "pa": [
    "ਪਰਨਾਲੇ ਦੇ ਹਿੱਸੇ ਦੀ ਮੁਰੰਮਤ",
    "ਹੈਂਗਰ ਬਦਲੇ, ਜੋੜ ਮੁੜ ਸੀਲ ਅਤੇ ਹਿੱਸੇ ਨੂੰ ਮੁੜ ਢਲਾਣ।"
   ]
  }
 }
};
