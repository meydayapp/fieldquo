// app/data/serviceSeeds/i18n/plumbing.js
//
// The languages plumbing.js does not write inline — Italian, German,
// Ukrainian, Punjabi (Gurmukhi) and Tagalog for its categories and services,
// and Punjabi for its template lines (keyed by the English line name) — merged
// by withLanguages in ../_templateLines.js. Hand-written trade wording, no
// machine translation; checked by scripts/check-seed-languages.mjs.
export const I18N = {
 "categories": {
  "visits": {
   "it": "Interventi e diagnosi",
   "de": "Serviceeinsätze und Diagnose",
   "uk": "Виклики та діагностика",
   "pa": "ਸਰਵਿਸ ਵਿਜ਼ਿਟਾਂ ਅਤੇ ਜਾਂਚ",
   "tl": "Service visit at diagnostic"
  },
  "appliances": {
   "it": "Lavastoviglie, tritarifiuti e lavanderia",
   "de": "Geschirrspüler, Müllzerkleinerer und Wäsche",
   "uk": "Посудомийка, подрібнювач і пральня",
   "pa": "ਡਿਸ਼ਵਾਸ਼ਰ, ਡਿਸਪੋਜ਼ਲ ਅਤੇ ਲਾਂਡਰੀ",
   "tl": "Dishwasher, disposal at labahan"
  },
  "drains": {
   "it": "Pulizia scarichi",
   "de": "Abflussreinigung",
   "uk": "Прочищення стоків",
   "pa": "ਡਰੇਨ ਦੀ ਸਫ਼ਾਈ",
   "tl": "Paglilinis ng drain"
  },
  "faucets": {
   "it": "Rubinetti e sanitari",
   "de": "Armaturen und Sanitärobjekte",
   "uk": "Змішувачі та сантехприлади",
   "pa": "ਟੂਟੀਆਂ ਅਤੇ ਫ਼ਿਕਸਚਰ",
   "tl": "Gripo at fixture"
  },
  "toilets": {
   "it": "WC",
   "de": "WCs",
   "uk": "Унітази",
   "pa": "ਟਾਇਲਟ",
   "tl": "Inidoro"
  },
  "tub_shower": {
   "it": "Vasca e doccia",
   "de": "Wanne und Dusche",
   "uk": "Ванна та душ",
   "pa": "ਟੱਬ ਅਤੇ ਸ਼ਾਵਰ",
   "tl": "Bathtub at shower"
  },
  "lines": {
   "it": "Tubazioni acqua, fognatura e gas",
   "de": "Wasser-, Abwasser- und Gasleitungen",
   "uk": "Водопровід, каналізація та газ",
   "pa": "ਪਾਣੀ, ਸੀਵਰ ਅਤੇ ਗੈਸ ਲਾਈਨਾਂ",
   "tl": "Linya ng tubig, imburnal at gas"
  },
  "sump": {
   "it": "Pompe di sollevamento",
   "de": "Sumpfpumpen",
   "uk": "Дренажні насоси",
   "pa": "ਸੰਪ ਪੰਪ",
   "tl": "Sump pump"
  },
  "valves": {
   "it": "Valvole e regolazione dell'acqua",
   "de": "Ventile und Wasserregelung",
   "uk": "Клапани та регулювання води",
   "pa": "ਵਾਲਵ ਅਤੇ ਪਾਣੀ ਨਿਯੰਤਰਣ",
   "tl": "Valve at regulasyon ng tubig"
  },
  "water_heaters": {
   "it": "Scaldacqua",
   "de": "Warmwasserbereiter",
   "uk": "Водонагрівачі",
   "pa": "ਵਾਟਰ ਹੀਟਰ",
   "tl": "Water heater"
  }
 },
 "services": {
  "fq.plumbing.water_heaters.repair_visit": {
   "it": [
    "Riparazione scaldacqua — visita",
    "Visita di due ore per riparare uno scaldacqua che non funziona bene o consigliare la sostituzione, con prezzo sul posto."
   ],
   "de": [
    "Reparatur Warmwasserbereiter — Termin",
    "Ein Zwei-Stunden-Termin, um einen schwächelnden Warmwasserbereiter zu reparieren oder zum Austausch zu beraten, Preis vor Ort."
   ],
   "uk": [
    "Ремонт водонагрівача — візит",
    "Двогодинний візит, щоб відремонтувати водонагрівач чи порадити заміну старого, ціна на місці."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਖ਼ਰਾਬ ਹੁੰਦੇ ਵਾਟਰ ਹੀਟਰ ਦੀ ਮੁਰੰਮਤ ਜਾਂ ਪੁਰਾਣਾ ਬਦਲਣ ਦੀ ਸਲਾਹ ਲਈ ਦੋ ਘੰਟੇ ਦੀ ਵਿਜ਼ਿਟ, ਮੌਕੇ ਉੱਤੇ ਰੇਟ।"
   ],
   "tl": [
    "Visit sa pagkukumpuni ng water heater",
    "Dalawang oras na visit para ayusin ang sirang water heater o payuhan sa pagpapalit, may presyo sa lugar."
   ]
  },
  "fq.plumbing.visits.leak_detection_repair": {
   "pa": [
    "ਲੀਕ ਲੱਭਣ ਅਤੇ ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਟਪਕਦੀਆਂ ਟੂਟੀਆਂ, ਲੀਕ ਪਾਈਪਾਂ, ਚੱਲਦਾ ਟਾਇਲਟ ਜਾਂ ਅਣਜਾਣ ਗਿੱਲੀ ਥਾਂ: ਸਰੋਤ ਲੱਭ ਕੇ ਹੋ ਸਕੇ ਤਾਂ ਉਸੇ ਵਿਜ਼ਿਟ ਵਿੱਚ ਠੀਕ।"
   ]
  },
  "fq.plumbing.drains.drain_cleaning_visit": {
   "it": [
    "Pulizia scarichi — visita",
    "Lavandino lento, WC intasato o doccia bloccata liberati con lo strumento adatto alla tubazione, spiegando la causa."
   ],
   "de": [
    "Abflussreinigung — Termin",
    "Langsames Waschbecken, verstopftes WC oder Duschabfluss mit dem passenden Werkzeug freigemacht und die Ursache erklärt."
   ],
   "uk": [
    "Прочищення стоків — візит",
    "Повільну мийку, забитий унітаз чи душ прочищено відповідним інструментом, причину пояснено."
   ],
   "pa": [
    "ਡਰੇਨ ਸਫ਼ਾਈ ਵਿਜ਼ਿਟ",
    "ਹੌਲੀ ਸਿੰਕ, ਬੰਦ ਟਾਇਲਟ ਜਾਂ ਸ਼ਾਵਰ ਡਰੇਨ ਲਾਈਨ ਮੁਤਾਬਕ ਸੰਦ ਨਾਲ ਖੋਲ੍ਹਿਆ ਅਤੇ ਕਾਰਨ ਦੱਸਿਆ।"
   ],
   "tl": [
    "Visit sa paglilinis ng drain",
    "Binuksan ang mabagal na lababo, baradong inidoro o drain ng shower gamit ang tamang gamit, at ipinaliwanag ang sanhi."
   ]
  },
  "fq.plumbing.appliances.dishwasher_tailpiece": {
   "it": [
    "Sostituzione codolo lavastoviglie",
    "Codolo corroso o che perde sotto il lavello sostituito con uno in ottone, così la lavastoviglie scarica senza gocciolare."
   ],
   "de": [
    "Austausch des Geschirrspüler-Anschlussstutzens",
    "Der korrodierte oder undichte Stutzen unter der Spüle durch einen aus Messing ersetzt, damit der Spüler tropffrei abläuft."
   ],
   "uk": [
    "Заміна патрубка посудомийки",
    "Роз'їдений чи протікаючий патрубок під мийкою замінено латунним — злив без крапель у шафу."
   ],
   "pa": [
    "ਡਿਸ਼ਵਾਸ਼ਰ ਟੇਲਪੀਸ ਬਦਲਣਾ",
    "ਸਿੰਕ ਹੇਠ ਜੰਗਾਲੀ ਜਾਂ ਲੀਕ ਟੇਲਪੀਸ ਪਿੱਤਲ ਵਾਲੇ ਨਾਲ ਬਦਲਿਆ ਤਾਂ ਜੋ ਡਿਸ਼ਵਾਸ਼ਰ ਬਿਨਾਂ ਟਪਕੇ ਨਿਕਾਸ ਕਰੇ।"
   ],
   "tl": [
    "Pagpapalit ng tailpiece ng dishwasher",
    "Pinalitan ng tanso ang kinalawang o tumutulong tailpiece sa ilalim ng lababo para hindi tumulo sa kabinet."
   ]
  },
  "fq.plumbing.appliances.remove_disposal_install_strainer": {
   "it": [
    "Rimozione tritarifiuti e posa piletta",
    "Tritarifiuti guasto o non voluto rimosso e lavello riportato a piletta e scarico standard."
   ],
   "de": [
    "Müllzerkleinerer entfernen, Siebkorb einbauen",
    "Ein defekter oder unerwünschter Zerkleinerer ausgebaut und die Spüle auf Standardsiebkorb und Ablauf zurückgebaut."
   ],
   "uk": [
    "Демонтаж подрібнювача й установка сітчастого зливу",
    "Несправний чи непотрібний подрібнювач знято, мийку переведено на звичайний сітчастий злив."
   ],
   "pa": [
    "ਗਾਰਬੇਜ ਡਿਸਪੋਜ਼ਲ ਹਟਾਉਣਾ ਅਤੇ ਸਟ੍ਰੇਨਰ ਲਾਉਣਾ",
    "ਖ਼ਰਾਬ ਜਾਂ ਅਣਚਾਹਿਆ ਡਿਸਪੋਜ਼ਲ ਕੱਢ ਕੇ ਸਿੰਕ ਆਮ ਸਟ੍ਰੇਨਰ ਅਤੇ ਡਰੇਨ ਵਿੱਚ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pag-alis ng garbage disposal at pagkakabit ng strainer",
    "Tinanggal ang sira o hindi gustong disposal at ibinalik ang lababo sa karaniwang strainer at drain."
   ]
  },
  "fq.plumbing.appliances.dishwasher_trap_tailpiece": {
   "it": [
    "Sostituzione sifone e codolo lavastoviglie",
    "Sifone e codolo sotto il lavello sostituiti insieme per un collegamento di scarico sicuro da capo a capo."
   ],
   "de": [
    "Siphon und Stutzen für Geschirrspüler tauschen",
    "Siphon und Stutzen unter der Spüle zusammen ersetzt, damit der Ablaufanschluss durchgehend dicht ist."
   ],
   "uk": [
    "Заміна сифона й патрубка посудомийки",
    "Сифон і патрубок під мийкою замінено разом — злив посудомийки надійний від краю до краю."
   ],
   "pa": [
    "ਡਿਸ਼ਵਾਸ਼ਰ ਟ੍ਰੈਪ ਅਤੇ ਟੇਲਪੀਸ ਬਦਲਣਾ",
    "ਸਿੰਕ ਹੇਠ ਟ੍ਰੈਪ ਅਤੇ ਟੇਲਪੀਸ ਇਕੱਠੇ ਬਦਲੇ ਤਾਂ ਜੋ ਡਿਸ਼ਵਾਸ਼ਰ ਨਿਕਾਸ ਪੂਰਾ ਪੱਕਾ ਹੋਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng trap at tailpiece ng dishwasher",
    "Sabay na pinalitan ang trap at tailpiece sa ilalim ng lababo para matibay ang koneksyon ng drain."
   ]
  },
  "fq.plumbing.appliances.dishwasher_flex_line": {
   "it": [
    "Posa tubo di alimentazione lavastoviglie e prova di tenuta",
    "Tubo in acciaio intrecciato montato sulla lavastoviglie e raccordo provato in pressione prima di chiudere il mobile."
   ],
   "de": [
    "Zulaufschlauch Geschirrspüler mit Dichtheitsprüfung",
    "Ein Edelstahl-Panzerschlauch am Spüler montiert und die Verbindung unter Druck geprüft, bevor der Schrank geschlossen wird."
   ],
   "uk": [
    "Шланг подачі посудомийки з перевіркою на витік",
    "Обплетений сталевий шланг встановлено й з'єднання перевірено під тиском, перш ніж закрити шафу."
   ],
   "pa": [
    "ਡਿਸ਼ਵਾਸ਼ਰ ਸਪਲਾਈ ਲਾਈਨ ਲਾਉਣਾ ਅਤੇ ਲੀਕ ਟੈਸਟ",
    "ਸਟੇਨਲੈੱਸ ਬ੍ਰੇਡਡ ਲਾਈਨ ਲਾਈ ਅਤੇ ਅਲਮਾਰੀ ਬੰਦ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਦਬਾਅ ਹੇਠ ਜਾਂਚੀ।"
   ],
   "tl": [
    "Pagkakabit ng supply line ng dishwasher at leak test",
    "Ikinabit ang braided na stainless na linya at sinubukan sa presyon bago isara ang kabinet."
   ]
  },
  "fq.plumbing.drains.septic_pumping": {
   "it": [
    "Svuotamento fossa settica — fino a 1.000 galloni",
    "Fossa settica svuotata e setti di ingresso e uscita controllati a coperchio aperto."
   ],
   "de": [
    "Klärgrube abpumpen — bis 1.000 Gallonen",
    "Die Klärgrube abgepumpt und Zu- und Ablauftauchwände bei offenem Deckel geprüft."
   ],
   "uk": [
    "Відкачування септика — до 1000 галонів",
    "Септик відкачано, вхідні й вихідні перегородки перевірено при відкритій кришці."
   ],
   "pa": [
    "ਸੈਪਟਿਕ ਟੈਂਕ ਖ਼ਾਲੀ ਕਰਨਾ — 1,000 ਗੈਲਨ ਤੱਕ",
    "ਸੈਪਟਿਕ ਟੈਂਕ ਖ਼ਾਲੀ ਅਤੇ ਢੱਕਣ ਖੁੱਲ੍ਹਾ ਹੋਣ ਵੇਲੇ ਅੰਦਰ-ਬਾਹਰ ਦੇ ਬੈਫ਼ਲ ਜਾਂਚੇ।"
   ],
   "tl": [
    "Pag-pump ng septic tank — hanggang 1,000 galon",
    "Hinigop ang laman ng septic tank at sinuri ang inlet at outlet baffle habang bukas ang takip."
   ]
  },
  "fq.plumbing.drains.cable_cleaning": {
   "pa": [
    "ਕੇਬਲ ਨਾਲ ਡਰੇਨ ਸਫ਼ਾਈ",
    "ਬੰਦ ਲਾਈਨ ਮੋਟਰ ਵਾਲੀ ਕੇਬਲ ਨਾਲ ਖੋਲ੍ਹੀ ਜੋ ਰੁਕਾਵਟ ਕੱਟ ਕੇ ਬਾਹਰ ਖਿੱਚਦੀ ਹੈ।"
   ]
  },
  "fq.plumbing.drains.grease_trap": {
   "it": [
    "Manutenzione separatore di grassi",
    "Separatore di grassi commerciale svuotato e lavato ad alta pressione perché la linea della cucina non rigurgiti."
   ],
   "de": [
    "Fettabscheider-Service",
    "Ein gewerblicher Fettabscheider abgepumpt und hochdruckgereinigt, damit die Küchenleitung nicht mehr zurückstaut."
   ],
   "uk": [
    "Обслуговування жировловлювача",
    "Комерційний жировловлювач відкачано й промито під тиском — кухонна лінія більше не підтоплює."
   ],
   "pa": [
    "ਗ੍ਰੀਸ ਟ੍ਰੈਪ ਸਰਵਿਸ",
    "ਵਪਾਰਕ ਗ੍ਰੀਸ ਇੰਟਰਸੈਪਟਰ ਖ਼ਾਲੀ ਅਤੇ ਤੇਜ਼ ਪਾਣੀ ਨਾਲ ਧੋਤਾ ਤਾਂ ਜੋ ਰਸੋਈ ਲਾਈਨ ਵਾਪਸ ਨਾ ਆਵੇ।"
   ],
   "tl": [
    "Serbisyo sa grease trap",
    "Hinigop at pinressure-wash ang komersyal na grease interceptor para hindi umatras ang linya ng kusina."
   ]
  },
  "fq.plumbing.drains.clean_ice_machine": {
   "it": [
    "Pulizia macchina del ghiaccio",
    "Macchina del ghiaccio commerciale disincrostata, igienizzata e scarico liberato per igiene e buon funzionamento."
   ],
   "de": [
    "Eismaschinenreinigung",
    "Eine gewerbliche Eismaschine entkalkt, desinfiziert und der Ablauf freigemacht — für Hygiene und richtigen Betrieb."
   ],
   "uk": [
    "Чищення льодогенератора",
    "Комерційний льодогенератор очищено від накипу, продезінфіковано, злив прочищено."
   ],
   "pa": [
    "ਆਈਸ ਮਸ਼ੀਨ ਦੀ ਸਫ਼ਾਈ",
    "ਵਪਾਰਕ ਆਈਸ ਮਸ਼ੀਨ ਤੋਂ ਪੱਥਰੀ ਹਟਾਈ, ਕੀਟਾਣੂ-ਰਹਿਤ ਅਤੇ ਡਰੇਨ ਖੋਲ੍ਹੀ।"
   ],
   "tl": [
    "Paglilinis ng ice machine",
    "Tinanggalan ng kaliskis, dinisimpekta at binuksan ang drain ng komersyal na ice machine."
   ]
  },
  "fq.plumbing.drains.clean_main_line": {
   "pa": [
    "ਮੁੱਖ ਲਾਈਨ ਦੀ ਸਫ਼ਾਈ",
    "ਕਲੀਨਆਊਟ ਤੋਂ ਸੜਕ ਤੱਕ ਮੁੱਖ ਸੀਵਰ ਲਾਈਨ ਖੋਲ੍ਹੀ ਤਾਂ ਜੋ ਘਰ ਦੀ ਹਰ ਡਰੇਨ ਮੁੜ ਚੱਲੇ।"
   ]
  },
  "fq.plumbing.drains.clean_drain": {
   "pa": [
    "ਡਰੇਨ ਸਫ਼ਾਈ — ਇੱਕ ਫ਼ਿਕਸਚਰ",
    "ਇੱਕ ਸਿੰਕ, ਟੱਬ ਜਾਂ ਫ਼ਰਸ਼ ਡਰੇਨ ਖੋਲ੍ਹ ਕੇ ਵਹਾਅ ਜਾਂਚਿਆ।"
   ]
  },
  "fq.plumbing.drains.kitchen_sink_line": {
   "it": [
    "Stasatura linea lavello cucina",
    "Diramazione della cucina pulita con sonda dal sifone alla colonna per togliere grasso e residui."
   ],
   "de": [
    "Küchenspülenleitung freimachen",
    "Die Küchenleitung vom Siphon bis zum Fallrohr mit der Spirale von Fett und Speiseresten befreit."
   ],
   "uk": [
    "Прочищення лінії кухонної мийки",
    "Кухонну гілку прочищено тросом від сифона до стояка від жиру й залишків їжі."
   ],
   "pa": [
    "ਰਸੋਈ ਸਿੰਕ ਲਾਈਨ ਖੋਲ੍ਹਣਾ",
    "ਟ੍ਰੈਪ ਤੋਂ ਸਟੈਕ ਤੱਕ ਰਸੋਈ ਲਾਈਨ ਕੇਬਲ ਨਾਲ ਚਿਕਨਾਈ ਅਤੇ ਖਾਣੇ ਦੀ ਗੰਦਗੀ ਤੋਂ ਸਾਫ਼।"
   ],
   "tl": [
    "Pagbukas ng linya ng lababo sa kusina",
    "Kinable mula trap hanggang stack ang linya ng kusina para alisin ang mantika at tirang pagkain."
   ]
  },
  "fq.plumbing.drains.hydro_jetting": {
   "it": [
    "Idropulizia ad alta pressione",
    "Acqua ad alta pressione pulisce l'intero diametro della tubazione, togliendo grasso, calcare e radici che una sonda si limita a bucare."
   ],
   "de": [
    "Hochdruckspülung",
    "Hochdruckwasser reinigt den ganzen Rohrquerschnitt und entfernt Fett, Kalk und Wurzeln, die eine Spirale nur durchstößt."
   ],
   "uk": [
    "Гідродинамічне прочищення",
    "Вода під високим тиском очищає весь переріз труби від жиру, накипу й коренів, які трос лише проколює."
   ],
   "pa": [
    "ਹਾਈਡ੍ਰੋ ਜੈਟਿੰਗ",
    "ਤੇਜ਼ ਦਬਾਅ ਵਾਲਾ ਪਾਣੀ ਪਾਈਪ ਦੀ ਪੂਰੀ ਚੌੜਾਈ ਸਾਫ਼ ਕਰਦਾ, ਚਿਕਨਾਈ, ਪੱਥਰੀ ਅਤੇ ਜੜ੍ਹਾਂ ਹਟਾਉਂਦਾ ਜਿਨ੍ਹਾਂ ਵਿੱਚ ਕੇਬਲ ਸਿਰਫ਼ ਛੇਕ ਕਰਦੀ ਹੈ।"
   ],
   "tl": [
    "Hydro jetting",
    "Nililinis ng malakas na presyon ng tubig ang buong loob ng tubo, inaalis ang mantika, kaliskis at ugat na binubutas lang ng cable."
   ]
  },
  "fq.plumbing.drains.tub_shower_manual": {
   "it": [
    "Stasatura vasca o doccia — attrezzo manuale",
    "Capelli e sapone rimossi dallo scarico di vasca o doccia con sonda manuale, senza chimici."
   ],
   "de": [
    "Wannen- oder Duschabfluss freimachen — Handwerkzeug",
    "Haare und Seifenreste mit einer Handspirale aus dem Wannen- oder Duschabfluss entfernt, ohne Chemie."
   ],
   "uk": [
    "Прочищення зливу ванни чи душу — ручний трос",
    "Волосся й мильний наліт прибрано ручним тросом, без хімії."
   ],
   "pa": [
    "ਟੱਬ ਜਾਂ ਸ਼ਾਵਰ ਡਰੇਨ ਖੋਲ੍ਹਣਾ — ਹੱਥ ਵਾਲਾ ਸੰਦ",
    "ਹੱਥ ਵਾਲੇ ਔਗਰ ਨਾਲ ਟੱਬ ਜਾਂ ਸ਼ਾਵਰ ਡਰੇਨ ਤੋਂ ਵਾਲ ਅਤੇ ਸਾਬਣ ਦੀ ਮੈਲ, ਬਿਨਾਂ ਰਸਾਇਣ।"
   ],
   "tl": [
    "Pagbukas ng drain ng tub o shower — hand tool",
    "Inalis ang buhok at sabon sa drain gamit ang hand auger, walang kemikal."
   ]
  },
  "fq.plumbing.drains.main_drum_machine": {
   "it": [
    "Stasatura colonna principale — macchina a tamburo grande",
    "Linea principale liberata con grande macchina a tamburo e testa di taglio adatta al tubo e all'ostruzione."
   ],
   "de": [
    "Hauptleitung freimachen — große Trommelmaschine",
    "Die Hauptleitung mit großer Trommelmaschine und passendem Schneidkopf freigemacht."
   ],
   "uk": [
    "Прочищення головної лінії — великий барабанний апарат",
    "Головну лінію прочищено великим барабанним апаратом із відповідною ріжучою головкою."
   ],
   "pa": [
    "ਮੁੱਖ ਡਰੇਨ ਖੋਲ੍ਹਣਾ — ਵੱਡੀ ਡਰੰਮ ਮਸ਼ੀਨ",
    "ਪਾਈਪ ਅਤੇ ਰੁਕਾਵਟ ਮੁਤਾਬਕ ਕੱਟਣ ਵਾਲੇ ਸਿਰ ਨਾਲ ਵੱਡੀ ਡਰੰਮ ਮਸ਼ੀਨ ਰਾਹੀਂ ਮੁੱਖ ਲਾਈਨ ਖੋਲ੍ਹੀ।"
   ],
   "tl": [
    "Pagbukas ng main drain — malaking drum machine",
    "Binuksan ang main line gamit ang malaking drum machine at cutting head na angkop sa tubo."
   ]
  },
  "fq.plumbing.drains.sink_electric_jetting": {
   "it": [
    "Stasatura lavello — idropulitrice elettrica",
    "Linea del lavello ostinata liberata con idropulitrice elettrica compatta che lava le pareti del tubo."
   ],
   "de": [
    "Waschbeckenabfluss freimachen — Elektrospüler",
    "Eine hartnäckige Waschbeckenleitung mit kompaktem Elektrospüler freigemacht, der die Rohrwände reinigt."
   ],
   "uk": [
    "Прочищення мийки — електричний гідроапарат",
    "Затяту лінію мийки прочищено компактним електричним гідроапаратом, що миє стінки труби."
   ],
   "pa": [
    "ਸਿੰਕ ਡਰੇਨ ਖੋਲ੍ਹਣਾ — ਬਿਜਲੀ ਜੈਟਿੰਗ",
    "ਜ਼ਿੱਦੀ ਸਿੰਕ ਲਾਈਨ ਛੋਟੇ ਬਿਜਲੀ ਜੈਟਰ ਨਾਲ ਖੋਲ੍ਹੀ ਜੋ ਪਾਈਪ ਦੀਆਂ ਕੰਧਾਂ ਧੋਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagbukas ng lababo — electric jetting",
    "Binuksan ang matigas na barado sa lababo gamit ang maliit na electric jetter na naghuhugas ng loob ng tubo."
   ]
  },
  "fq.plumbing.drains.toilet_auger": {
   "pa": [
    "ਟਾਇਲਟ ਖੋਲ੍ਹਣਾ — ਕਲੋਜ਼ੈੱਟ ਔਗਰ",
    "ਟਾਇਲਟ ਉਖਾੜੇ ਬਿਨਾਂ ਕਲੋਜ਼ੈੱਟ ਔਗਰ ਨਾਲ ਖੋਲ੍ਹਿਆ ਅਤੇ ਫ਼ਲੱਸ਼ ਕਰਕੇ ਪੱਕਾ ਕੀਤਾ।"
   ]
  },
  "fq.plumbing.drains.camera_inspection": {
   "pa": [
    "ਡਰੇਨ ਕੈਮਰਾ ਜਾਂਚ",
    "ਲਾਈਨ ਵਿੱਚ ਕੈਮਰਾ ਚਲਾ ਕੇ ਦਿਖਾਇਆ ਕਿ ਸਮੱਸਿਆ ਕਿੱਥੇ, ਕੀ ਅਤੇ ਕਿੰਨੀ ਡੂੰਘੀ ਹੈ, ਫੁਟੇਜ ਰਿਕਾਰਡ ਲਈ ਰੱਖੀ।"
   ]
  },
  "fq.plumbing.drains.branch_small_drum": {
   "it": [
    "Stasatura diramazione — macchina a tamburo piccola",
    "Diramazione di bagno o lavanderia liberata con piccola macchina a tamburo adatta al tubo più stretto."
   ],
   "de": [
    "Abzweigleitung freimachen — kleine Trommelmaschine",
    "Eine Bad- oder Waschküchenleitung mit kleiner Trommelmaschine für das engere Rohr freigemacht."
   ],
   "uk": [
    "Прочищення гілки — малий барабанний апарат",
    "Гілку ванної чи пральні прочищено малим барабанним апаратом для вужчої труби."
   ],
   "pa": [
    "ਬ੍ਰਾਂਚ ਡਰੇਨ ਖੋਲ੍ਹਣਾ — ਛੋਟੀ ਡਰੰਮ ਮਸ਼ੀਨ",
    "ਬਾਥਰੂਮ ਜਾਂ ਲਾਂਡਰੀ ਬ੍ਰਾਂਚ ਲਾਈਨ ਪਤਲੀ ਪਾਈਪ ਵਾਲੀ ਛੋਟੀ ਡਰੰਮ ਮਸ਼ੀਨ ਨਾਲ ਖੋਲ੍ਹੀ।"
   ],
   "tl": [
    "Pagbukas ng branch drain — maliit na drum machine",
    "Binuksan ang branch line ng banyo o labahan gamit ang maliit na drum machine para sa makitid na tubo."
   ]
  },
  "fq.plumbing.drains.root_treatment": {
   "pa": [
    "ਮੁੱਖ ਡਰੇਨ ਵਿੱਚ ਜੜ੍ਹਾਂ ਦਾ ਇਲਾਜ",
    "ਸਫ਼ਾਈ ਤੋਂ ਬਾਅਦ ਮੁੱਖ ਲਾਈਨ ਵਿੱਚ ਝੱਗ ਵਾਲੀ ਜੜ੍ਹ-ਰੋਕੂ ਦਵਾਈ, ਸਫ਼ਾਈਆਂ ਵਿਚਕਾਰ ਜੜ੍ਹਾਂ ਹੌਲੀ ਵਧਣ।"
   ]
  },
  "fq.plumbing.faucets.replace_two_handle": {
   "it": [
    "Sostituzione rubinetto a due manopole",
    "Vecchio rubinetto a due manopole rimosso e nuovo montato, collegato e verificato per perdite."
   ],
   "de": [
    "Zweigriffarmatur tauschen",
    "Die alte Zweigriffarmatur ausgebaut, eine neue montiert, angeschlossen und auf Dichtheit geprüft."
   ],
   "uk": [
    "Заміна двовентильного змішувача",
    "Старий двовентильний змішувач знято, новий встановлено, під'єднано й перевірено на протікання."
   ],
   "pa": [
    "ਦੋ-ਹੱਥੀ ਟੂਟੀ ਬਦਲਣਾ",
    "ਪੁਰਾਣੀ ਦੋ-ਹੱਥੀ ਟੂਟੀ ਕੱਢ ਕੇ ਨਵੀਂ ਲਾਈ, ਜੋੜੀ ਅਤੇ ਲੀਕ ਲਈ ਜਾਂਚੀ।"
   ],
   "tl": [
    "Pagpapalit ng gripong may dalawang hawakan",
    "Tinanggal ang lumang gripo at ikinabit, ikinonekta at sinuri sa tagas ang bago."
   ]
  },
  "fq.plumbing.faucets.washers_seats": {
   "it": [
    "Sostituzione guarnizioni e sedi del rubinetto",
    "Guarnizioni e sedi usurate di un rubinetto a vite sostituite per fermare il gocciolio senza cambiare rubinetto."
   ],
   "de": [
    "Dichtungen und Ventilsitze der Armatur tauschen",
    "Abgenutzte Dichtungen und Sitze einer Spindelarmatur ersetzt, um das Tropfen ohne neue Armatur zu stoppen."
   ],
   "uk": [
    "Заміна прокладок і сідел змішувача",
    "Зношені прокладки й сідла вентильного змішувача замінено — крапання зупинено без заміни змішувача."
   ],
   "pa": [
    "ਟੂਟੀ ਦੇ ਵਾੱਸ਼ਰ ਅਤੇ ਸੀਟ ਬਦਲਣਾ",
    "ਕੰਪਰੈਸ਼ਨ ਟੂਟੀ ਦੇ ਘਿਸੇ ਵਾੱਸ਼ਰ ਅਤੇ ਸੀਟਾਂ ਬਦਲ ਕੇ ਟੂਟੀ ਬਦਲੇ ਬਿਨਾਂ ਟਪਕਣਾ ਬੰਦ।"
   ],
   "tl": [
    "Pagpapalit ng washer at seat ng gripo",
    "Pinalitan ang gasgas na washer at seat ng compression na gripo para tumigil ang tulo nang hindi pinapalitan ang gripo."
   ]
  },
  "fq.plumbing.faucets.aerator": {
   "it": [
    "Sostituzione aeratore del rubinetto lavabo",
    "Aeratore intasato o danneggiato sostituito perché il getto torni uniforme e pieno."
   ],
   "de": [
    "Strahlregler am Waschtisch tauschen",
    "Ein verstopfter oder beschädigter Strahlregler ersetzt, damit der Strahl wieder gleichmäßig und voll läuft."
   ],
   "uk": [
    "Заміна аератора змішувача",
    "Забитий чи пошкоджений аератор замінено — струмінь знову рівний і повний."
   ],
   "pa": [
    "ਵਾਸ਼ਬੇਸਿਨ ਟੂਟੀ ਦਾ ਏਰੇਟਰ ਬਦਲਣਾ",
    "ਬੰਦ ਜਾਂ ਖ਼ਰਾਬ ਏਰੇਟਰ ਬਦਲਿਆ ਤਾਂ ਜੋ ਧਾਰ ਮੁੜ ਬਰਾਬਰ ਅਤੇ ਪੂਰੀ ਆਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng aerator ng gripo",
    "Pinalitan ang barado o sirang aerator para pantay at buo ulit ang daloy."
   ]
  },
  "fq.plumbing.faucets.replace_single_lever": {
   "it": [
    "Sostituzione rubinetto monocomando",
    "Vecchio rubinetto rimosso e nuovo monocomando montato, flessibili collegati e provati."
   ],
   "de": [
    "Einhebelarmatur tauschen",
    "Die alte Armatur ausgebaut und eine neue Einhebelarmatur montiert, Anschlüsse verbunden und geprüft."
   ],
   "uk": [
    "Заміна одноважільного змішувача",
    "Старий змішувач знято, новий одноважільний встановлено, шланги під'єднано й перевірено."
   ],
   "pa": [
    "ਇੱਕ-ਲੀਵਰ ਟੂਟੀ ਬਦਲਣਾ",
    "ਪੁਰਾਣੀ ਟੂਟੀ ਕੱਢ ਕੇ ਨਵੀਂ ਇੱਕ-ਲੀਵਰ ਟੂਟੀ ਲਾਈ, ਸਪਲਾਈ ਲਾਈਨਾਂ ਜੋੜੀਆਂ ਅਤੇ ਜਾਂਚੀਆਂ।"
   ],
   "tl": [
    "Pagpapalit ng single-lever na gripo",
    "Tinanggal ang lumang gripo at ikinabit ang bagong single-lever, ikinonekta at sinubukan ang supply line."
   ]
  },
  "fq.plumbing.appliances.install_customer_parts": {
   "it": [
    "Installazione elettrodomestico — ricambi del cliente",
    "Lavatrice, asciugatrice o lavastoviglie collegata con tubi e raccordi forniti dal cliente e verificata per perdite."
   ],
   "de": [
    "Geräteanschluss — Teile vom Kunden",
    "Waschmaschine, Trockner oder Geschirrspüler mit vom Kunden gelieferten Schläuchen und Fittings angeschlossen und auf Dichtheit geprüft."
   ],
   "uk": [
    "Підключення техніки — деталі клієнта",
    "Пральну, сушильну чи посудомийну машину під'єднано шлангами й фітингами клієнта й перевірено на протікання."
   ],
   "pa": [
    "ਉਪਕਰਣ ਲਾਉਣਾ — ਗਾਹਕ ਦੇ ਪੁਰਜ਼ੇ",
    "ਗਾਹਕ ਦੀਆਂ ਹੋਜ਼ਾਂ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ ਨਾਲ ਵਾਸ਼ਰ, ਡ੍ਰਾਇਰ ਜਾਂ ਡਿਸ਼ਵਾਸ਼ਰ ਜੋੜਿਆ ਅਤੇ ਲੀਕ ਲਈ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Pagkakabit ng appliance — piyesa ng kliyente",
    "Ikinonekta ang washer, dryer o dishwasher gamit ang hose at fitting ng kliyente at sinuri sa tagas."
   ]
  },
  "fq.plumbing.appliances.dryer_reconnect": {
   "it": [
    "Scollegamento e ricollegamento asciugatrice",
    "Asciugatrice scollegata per un trasloco o lavori al pavimento e ricollegata a scarico fumi e alimentazione con i pezzi esistenti."
   ],
   "de": [
    "Trockner ab- und wieder anschließen",
    "Der Trockner für Umzug oder Bodenarbeiten abgeklemmt und mit vorhandenen Teilen wieder an Abluft und Versorgung angeschlossen."
   ],
   "uk": [
    "Від'єднання й повторне підключення сушарки",
    "Сушарку від'єднано на час переїзду чи робіт із підлогою й знову під'єднано до витяжки та живлення."
   ],
   "pa": [
    "ਡ੍ਰਾਇਰ ਲਾਹੁਣਾ ਅਤੇ ਮੁੜ ਲਾਉਣਾ",
    "ਘਰ ਬਦਲਣ ਜਾਂ ਫ਼ਰਸ਼ ਦੇ ਕੰਮ ਲਈ ਡ੍ਰਾਇਰ ਲਾਹਿਆ ਅਤੇ ਮੌਜੂਦਾ ਪੁਰਜ਼ਿਆਂ ਨਾਲ ਵੈਂਟ ਅਤੇ ਸਪਲਾਈ ਨਾਲ ਮੁੜ ਜੋੜਿਆ।"
   ],
   "tl": [
    "Pagtanggal at muling pagkabit ng dryer",
    "Tinanggal ang dryer para sa paglipat o trabaho sa sahig at muling ikinonekta sa vent at supply gamit ang dating piyesa."
   ]
  },
  "fq.plumbing.appliances.dryer_vent_hood": {
   "it": [
    "Sostituzione bocchetta esterna asciugatrice a parete",
    "Bocchetta esterna rotta o ostruita da nidi tagliata e sostituita, sigillata al muro perché la lanugine esca e il maltempo resti fuori."
   ],
   "de": [
    "Trockner-Abluftklappe in der Wand tauschen",
    "Eine defekte oder von Vögeln verstopfte Außenklappe herausgeschnitten und ersetzt, zur Wand abgedichtet."
   ],
   "uk": [
    "Заміна зовнішньої решітки сушарки в стіні",
    "Зламану чи забиту птахами решітку вирізано й замінено, загерметизовано до стіни."
   ],
   "pa": [
    "ਕੰਧ ਰਾਹੀਂ ਡ੍ਰਾਇਰ ਵੈਂਟ ਹੁੱਡ ਬਦਲਣਾ",
    "ਟੁੱਟਿਆ ਜਾਂ ਪੰਛੀਆਂ ਨਾਲ ਬੰਦ ਬਾਹਰੀ ਹੁੱਡ ਕੱਟ ਕੇ ਬਦਲਿਆ ਅਤੇ ਕੰਧ ਨਾਲ ਸੀਲ, ਰੂੰ ਬਾਹਰ ਅਤੇ ਮੌਸਮ ਅੰਦਰ ਨਹੀਂ।"
   ],
   "tl": [
    "Pagpapalit ng dryer vent hood sa pader",
    "Ginupit at pinalitan ang sira o baradong vent hood at sinelyuhan sa pader para lumabas ang lint at hindi pumasok ang panahon."
   ]
  },
  "fq.plumbing.appliances.clean_dryer_vent": {
   "pa": [
    "ਡ੍ਰਾਇਰ ਵੈਂਟ ਦੀ ਸਫ਼ਾਈ",
    "ਡ੍ਰਾਇਰ ਵੈਂਟ ਦੀ ਪੂਰੀ ਲੰਬਾਈ ਤੋਂ ਰੂੰ ਸਾਫ਼, ਜੋ ਲੰਮੇ ਸੁਕਾਉਣ ਅਤੇ ਡ੍ਰਾਇਰ ਅੱਗ ਦਾ ਮੁੱਖ ਕਾਰਨ ਹੈ।"
   ]
  },
  "fq.plumbing.appliances.appliance_flex_line": {
   "it": [
    "Sostituzione tubo di alimentazione in acciaio e prova di tenuta",
    "Tubi in gomma sostituiti con tubi in acciaio intrecciato e raccordi provati in pressione."
   ],
   "de": [
    "Edelstahl-Zulaufschlauch tauschen mit Dichtheitsprüfung",
    "Gummischläuche durch Edelstahl-Panzerschläuche ersetzt und die Verbindungen unter Druck geprüft."
   ],
   "uk": [
    "Заміна шланга подачі на сталевий з перевіркою",
    "Гумові шланги замінено обплетеними сталевими, з'єднання перевірено під тиском."
   ],
   "pa": [
    "ਉਪਕਰਣ ਸਟੇਨਲੈੱਸ ਸਪਲਾਈ ਲਾਈਨ ਬਦਲਣਾ ਅਤੇ ਲੀਕ ਟੈਸਟ",
    "ਰਬੜ ਦੀਆਂ ਹੋਜ਼ਾਂ ਬ੍ਰੇਡਡ ਸਟੇਨਲੈੱਸ ਨਾਲ ਬਦਲੀਆਂ ਅਤੇ ਦਬਾਅ ਹੇਠ ਜਾਂਚੀਆਂ।"
   ],
   "tl": [
    "Pagpapalit ng stainless na supply line at leak test",
    "Pinalitan ng braided stainless ang goma na hose at sinubukan sa presyon ang koneksyon."
   ]
  },
  "fq.plumbing.appliances.appliance_reconnect": {
   "it": [
    "Scollegamento e ricollegamento elettrodomestico",
    "Elettrodomestico scollegato, spostato e ricollegato con i pezzi esistenti, poi avviato per verificare l'assenza di perdite."
   ],
   "de": [
    "Gerät ab- und wieder anschließen",
    "Ein Gerät abgeklemmt, versetzt und mit vorhandenen Teilen wieder angeschlossen, dann auf Dichtheit getestet."
   ],
   "uk": [
    "Від'єднання й повторне підключення техніки",
    "Техніку від'єднано, переставлено й під'єднано наявними деталями, потім перевірено на протікання."
   ],
   "pa": [
    "ਉਪਕਰਣ ਲਾਹੁਣਾ ਅਤੇ ਮੁੜ ਲਾਉਣਾ",
    "ਉਪਕਰਣ ਲਾਹਿਆ, ਹਿਲਾਇਆ ਅਤੇ ਮੌਜੂਦਾ ਪੁਰਜ਼ਿਆਂ ਨਾਲ ਮੁੜ ਜੋੜ ਕੇ ਲੀਕ ਲਈ ਚਲਾਇਆ।"
   ],
   "tl": [
    "Pagtanggal at muling pagkabit ng appliance",
    "Tinanggal, inilipat at muling ikinonekta ang appliance gamit ang dating piyesa, saka pinaandar para matiyak na walang tagas."
   ]
  },
  "fq.plumbing.appliances.appliance_drain_hose": {
   "it": [
    "Sostituzione tubo di scarico elettrodomestico e prova",
    "Tubo di scarico crepato o piegato sostituito e fissato, poi ciclo completo per verificarne la tenuta."
   ],
   "de": [
    "Ablaufschlauch tauschen mit Dichtheitsprüfung",
    "Ein rissiger oder geknickter Ablaufschlauch ersetzt und befestigt, dann ein voller Zyklus zur Kontrolle."
   ],
   "uk": [
    "Заміна зливного шланга з перевіркою",
    "Тріснутий чи зламаний зливний шланг замінено й закріплено, прогнано повний цикл."
   ],
   "pa": [
    "ਉਪਕਰਣ ਡਰੇਨ ਹੋਜ਼ ਬਦਲਣਾ ਅਤੇ ਲੀਕ ਟੈਸਟ",
    "ਤਿੜਕੀ ਜਾਂ ਮੁੜੀ ਡਰੇਨ ਹੋਜ਼ ਬਦਲ ਕੇ ਪੱਕੀ ਕੀਤੀ ਅਤੇ ਪੂਰਾ ਚੱਕਰ ਚਲਾ ਕੇ ਜਾਂਚੀ।"
   ],
   "tl": [
    "Pagpapalit ng drain hose ng appliance at leak test",
    "Pinalitan at ikinabit ang bitak o baluktot na drain hose at pinaandar ang buong cycle para matiyak."
   ]
  },
  "fq.plumbing.toilets.repair": {
   "pa": [
    "ਟਾਇਲਟ ਦੀ ਮੁਰੰਮਤ",
    "ਅੰਦਰਲੇ ਘਿਸੇ ਪੁਰਜ਼ੇ ਬਦਲੇ ਅਤੇ ਟਾਇਲਟ ਸੈੱਟ ਕੀਤਾ ਤਾਂ ਜੋ ਭਰੇ, ਫ਼ਲੱਸ਼ ਕਰੇ ਅਤੇ ਚੱਲਣਾ ਬੰਦ ਕਰੇ।"
   ]
  },
  "fq.plumbing.faucets.install_kitchen_sink": {
   "it": [
    "Installazione lavello cucina",
    "Nuovo lavello incassato nel piano e collegato a scarico e alimentazioni, con rubinetto e piletta montati."
   ],
   "de": [
    "Küchenspüle einbauen",
    "Eine neue Spüle in die Arbeitsplatte gesetzt und an Ablauf und Versorgung angeschlossen, Armatur und Sieb montiert."
   ],
   "uk": [
    "Встановлення кухонної мийки",
    "Нову мийку вбудовано в стільницю, під'єднано до зливу й води, змішувач і злив встановлено."
   ],
   "pa": [
    "ਰਸੋਈ ਸਿੰਕ ਲਾਉਣਾ",
    "ਨਵਾਂ ਰਸੋਈ ਸਿੰਕ ਕਾਊਂਟਰ ਵਿੱਚ ਲਾ ਕੇ ਡਰੇਨ ਅਤੇ ਸਪਲਾਈ ਨਾਲ ਜੋੜਿਆ, ਟੂਟੀ ਅਤੇ ਸਟ੍ਰੇਨਰ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkakabit ng lababo sa kusina",
    "Inilagay sa counter ang bagong lababo at ikinonekta sa drain at supply, kasama ang gripo at strainer."
   ]
  },
  "fq.plumbing.tub_shower.install_shower_faucet": {
   "it": [
    "Installazione miscelatore doccia",
    "Nuove finiture e soffione montati sulla valvola esistente e verificati per gocciolii."
   ],
   "de": [
    "Duscharmatur montieren",
    "Neue Duschblende und Brause an das vorhandene Ventil montiert und auf Tropfen geprüft."
   ],
   "uk": [
    "Встановлення душового змішувача",
    "Нову накладку й лійку встановлено на наявний клапан і перевірено на крапання."
   ],
   "pa": [
    "ਸ਼ਾਵਰ ਟੂਟੀ ਲਾਉਣਾ",
    "ਮੌਜੂਦਾ ਵਾਲਵ ਉੱਤੇ ਨਵੀਂ ਸ਼ਾਵਰ ਟ੍ਰਿਮ ਅਤੇ ਹੈੱਡ ਲਾ ਕੇ ਟਪਕਣ ਲਈ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Pagkakabit ng gripo ng shower",
    "Ikinabit sa dating valve ang bagong trim at shower head at sinuri sa tulo."
   ]
  },
  "fq.plumbing.tub_shower.cartridge": {
   "it": [
    "Sostituzione cartuccia doccia",
    "Cartuccia della valvola sostituita per fermare il gocciolio o ripristinare il controllo caldo-freddo, senza aprire il muro."
   ],
   "de": [
    "Duschkartusche tauschen",
    "Die Ventilkartusche ersetzt, um Tropfen zu stoppen oder die Warm-kalt-Regelung wiederherzustellen, ohne die Wand zu öffnen."
   ],
   "uk": [
    "Заміна картриджа душу",
    "Картридж клапана замінено, щоб зупинити крапання чи повернути регулювання температури без розкриття стіни."
   ],
   "pa": [
    "ਸ਼ਾਵਰ ਕਾਰਟ੍ਰਿਜ ਬਦਲਣਾ",
    "ਕੰਧ ਖੋਲ੍ਹੇ ਬਿਨਾਂ ਵਾਲਵ ਕਾਰਟ੍ਰਿਜ ਬਦਲਿਆ, ਟਪਕਣਾ ਬੰਦ ਜਾਂ ਗਰਮ-ਠੰਢਾ ਕੰਟਰੋਲ ਮੁੜ।"
   ],
   "tl": [
    "Pagpapalit ng cartridge ng shower",
    "Pinalitan ang cartridge ng valve para tumigil ang tulo o bumalik ang kontrol ng init at lamig, hindi binubuksan ang pader."
   ]
  },
  "fq.plumbing.toilets.flapper_parts": {
   "it": [
    "Sostituzione batacchio del WC",
    "Batacchio usurato sostituito perché la cassetta non perda nel vaso e non scorra tra uno scarico e l'altro."
   ],
   "de": [
    "Spülkastenklappe tauschen",
    "Eine abgenutzte Klappe ersetzt, damit der Spülkasten nicht mehr ins Becken leckt und nachläuft."
   ],
   "uk": [
    "Заміна клапана бачка",
    "Зношений клапан замінено — бачок не протікає в унітаз і не шумить між зливами."
   ],
   "pa": [
    "ਟਾਇਲਟ ਫ਼ਲੈਪਰ ਬਦਲਣਾ",
    "ਘਿਸਿਆ ਫ਼ਲੈਪਰ ਬਦਲਿਆ ਤਾਂ ਜੋ ਟੈਂਕੀ ਕਟੋਰੇ ਵਿੱਚ ਨਾ ਚੋਵੇ ਅਤੇ ਫ਼ਲੱਸ਼ਾਂ ਵਿਚਕਾਰ ਨਾ ਚੱਲੇ।"
   ],
   "tl": [
    "Pagpapalit ng flapper ng inidoro",
    "Pinalitan ang gasgas na flapper para hindi tumagas ang tangke sa bowl at hindi tumakbo sa pagitan ng flush."
   ]
  },
  "fq.plumbing.faucets.install_kitchen_faucet": {
   "pa": [
    "ਰਸੋਈ ਟੂਟੀ ਲਾਉਣਾ — ਗਾਹਕ ਦੀ",
    "ਗਾਹਕ ਦੀ ਖ਼ਰੀਦੀ ਰਸੋਈ ਟੂਟੀ ਪੁਰਾਣੀ ਦੀ ਥਾਂ ਲਾ ਕੇ ਜੋੜੀ ਅਤੇ ਜਾਂਚੀ।"
   ]
  },
  "fq.plumbing.toilets.valve_replacement": {
   "it": [
    "Sostituzione valvola di carico o scarico del WC",
    "Valvola di carico o di scarico della cassetta sostituita e livello dell'acqua regolato per un riempimento silenzioso e uno scarico completo."
   ],
   "de": [
    "Füll- oder Spülventil tauschen",
    "Füll- oder Spülventil des Spülkastens ersetzt und der Wasserstand eingestellt, für leises Füllen und volles Spülen."
   ],
   "uk": [
    "Заміна наливного чи зливного клапана",
    "Наливний чи зливний клапан бачка замінено, рівень води виставлено — тихе наповнення, повний злив."
   ],
   "pa": [
    "ਟਾਇਲਟ ਫ਼ਿੱਲ ਜਾਂ ਫ਼ਲੱਸ਼ ਵਾਲਵ ਬਦਲਣਾ",
    "ਟੈਂਕੀ ਦਾ ਫ਼ਿੱਲ ਜਾਂ ਫ਼ਲੱਸ਼ ਵਾਲਵ ਬਦਲਿਆ ਅਤੇ ਪਾਣੀ ਦਾ ਪੱਧਰ ਸੈੱਟ, ਸ਼ਾਂਤ ਭਰਾਈ ਅਤੇ ਪੂਰਾ ਫ਼ਲੱਸ਼।"
   ],
   "tl": [
    "Pagpapalit ng fill o flush valve ng inidoro",
    "Pinalitan ang fill o flush valve ng tangke at itinakda ang lebel ng tubig para tahimik mapuno at buo ang flush."
   ]
  },
  "fq.plumbing.tub_shower.shower_valve_install": {
   "it": [
    "Installazione valvola doccia",
    "Nuova valvola doccia a pressione bilanciata o termostatica installata a muro con le finiture, apertura lasciata pronta per la finitura."
   ],
   "de": [
    "Duschventil einbauen",
    "Ein neues druckausgleichendes oder thermostatisches Duschventil mit Blende in der Wand eingebaut, Öffnung für den Abschluss vorbereitet."
   ],
   "uk": [
    "Встановлення душового клапана",
    "Новий балансувальний чи термостатичний клапан вбудовано в стіну з накладкою, отвір готовий до оздоблення."
   ],
   "pa": [
    "ਸ਼ਾਵਰ ਵਾਲਵ ਲਾਉਣਾ",
    "ਕੰਧ ਵਿੱਚ ਨਵਾਂ ਦਬਾਅ-ਸੰਤੁਲਿਤ ਜਾਂ ਥਰਮੋਸਟੈਟਿਕ ਸ਼ਾਵਰ ਵਾਲਵ ਟ੍ਰਿਮ ਸਮੇਤ, ਕੰਧ ਦੀ ਮੋਰੀ ਮੁਕੰਮਲ ਕਰਨ ਲਈ ਤਿਆਰ।"
   ],
   "tl": [
    "Pagkakabit ng shower valve",
    "Ikinabit sa pader ang bagong pressure-balanced o thermostatic na valve kasama ang trim, handa ang butas para tapusin."
   ]
  },
  "fq.plumbing.toilets.install": {
   "pa": [
    "ਟਾਇਲਟ ਲਾਉਣਾ",
    "ਪੁਰਾਣਾ ਟਾਇਲਟ ਹਟਾ ਕੇ ਲਿਜਾਇਆ, ਨਵਾਂ ਤਾਜ਼ੀ ਵੈਕਸ ਰਿੰਗ ਉੱਤੇ ਰੱਖ ਕੇ ਜੋੜਿਆ ਅਤੇ ਜਾਂਚਿਆ।"
   ]
  },
  "fq.plumbing.tub_shower.tub_spout": {
   "it": [
    "Sostituzione bocca vasca",
    "Bocca della vasca che perde o rotta sostituita, deviatore incluso, perché l'acqua vada dove indica la leva."
   ],
   "de": [
    "Wannenauslauf tauschen",
    "Ein undichter oder defekter Wannenauslauf samt Umsteller ersetzt, damit das Wasser dorthin fließt, wo der Hebel es schickt."
   ],
   "uk": [
    "Заміна виливу ванни",
    "Протікаючий чи зламаний вилив замінено разом із перемикачем — вода йде туди, куди вказує важіль."
   ],
   "pa": [
    "ਟੱਬ ਸਪਾਊਟ ਬਦਲਣਾ",
    "ਲੀਕ ਜਾਂ ਟੁੱਟਿਆ ਟੱਬ ਸਪਾਊਟ ਡਾਇਵਰਟਰ ਸਮੇਤ ਬਦਲਿਆ ਤਾਂ ਜੋ ਪਾਣੀ ਲੀਵਰ ਮੁਤਾਬਕ ਜਾਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng tub spout",
    "Pinalitan ang tumutulo o sirang tub spout kasama ang diverter para dumaloy ang tubig kung saan itinuro ng lever."
   ]
  },
  "fq.plumbing.visits.diagnostic_commercial": {
   "it": [
    "Visita diagnostica — commerciale",
    "Un idraulico interviene in un'attività, trova il guasto e dà un prezzo scritto per la riparazione."
   ],
   "de": [
    "Diagnosetermin — gewerblich",
    "Ein Installateur kommt in einen Betrieb, findet den Fehler und nennt einen schriftlichen Reparaturpreis."
   ],
   "uk": [
    "Діагностичний візит — комерційний",
    "Сантехнік приїжджає на комерційний об'єкт, знаходить несправність і дає письмову ціну ремонту."
   ],
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਵਪਾਰਕ",
    "ਪਲੰਬਰ ਕਾਰੋਬਾਰੀ ਜਾਇਦਾਦ 'ਤੇ ਆ ਕੇ ਨੁਕਸ ਲੱਭਦਾ ਅਤੇ ਮੁਰੰਮਤ ਦਾ ਲਿਖਤੀ ਰੇਟ ਦਿੰਦਾ ਹੈ।"
   ],
   "tl": [
    "Diagnostic visit — komersyal",
    "Pumupunta ang tubero sa negosyo, hinahanap ang sira at nagbibigay ng nakasulat na presyo."
   ]
  },
  "fq.plumbing.visits.diagnostic_out_of_range": {
   "it": [
    "Visita diagnostica — fuori zona",
    "La visita diagnostica per un indirizzo oltre la zona abituale, trasferta inclusa."
   ],
   "de": [
    "Diagnosetermin — außerhalb des Einsatzgebiets",
    "Der Diagnosetermin für eine Adresse außerhalb des üblichen Gebiets, Anfahrt inklusive."
   ],
   "uk": [
    "Діагностичний візит — поза зоною",
    "Діагностичний візит за адресою поза звичайною зоною, дорогу включено."
   ],
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਸੇਵਾ ਖੇਤਰ ਤੋਂ ਬਾਹਰ",
    "ਆਮ ਖੇਤਰ ਤੋਂ ਬਾਹਰ ਪਤੇ ਲਈ ਜਾਂਚ ਵਿਜ਼ਿਟ, ਸਫ਼ਰ ਸਮੇਤ।"
   ],
   "tl": [
    "Diagnostic visit — labas ng service area",
    "Diagnostic visit sa address na lampas sa karaniwang lugar, kasama ang biyahe."
   ]
  },
  "fq.plumbing.visits.diagnostic_weekend": {
   "it": [
    "Visita diagnostica — fine settimana",
    "Una visita di sabato o domenica per trovare il problema e fare il prezzo della riparazione."
   ],
   "de": [
    "Diagnosetermin — Wochenende",
    "Ein Termin am Samstag oder Sonntag, um das Problem zu finden und die Reparatur zu bepreisen."
   ],
   "uk": [
    "Діагностичний візит — вихідні",
    "Візит у суботу чи неділю, щоб знайти проблему й назвати ціну ремонту."
   ],
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਹਫ਼ਤੇ ਦਾ ਅਖ਼ੀਰ",
    "ਸ਼ਨੀਵਾਰ ਜਾਂ ਐਤਵਾਰ ਦੀ ਵਿਜ਼ਿਟ ਸਮੱਸਿਆ ਲੱਭਣ ਅਤੇ ਮੁਰੰਮਤ ਦਾ ਰੇਟ ਦੇਣ ਲਈ।"
   ],
   "tl": [
    "Diagnostic visit — weekend",
    "Visit sa Sabado o Linggo para hanapin ang problema at bigyan ng presyo ang pagkukumpuni."
   ]
  },
  "fq.plumbing.visits.diagnostic_emergency": {
   "it": [
    "Visita diagnostica — emergenza",
    "Intervento fuori orario per tubo scoppiato, rigurgito fognario o mancanza d'acqua, con la riparazione urgente fatta e il resto quotato."
   ],
   "de": [
    "Diagnosetermin — Notfall",
    "Ein Einsatz außerhalb der Zeiten bei Rohrbruch, Abwasserrückstau oder ohne Wasser, Sofortmaßnahme erledigt, Rest angeboten."
   ],
   "uk": [
    "Діагностичний візит — аварійний",
    "Виклик у неробочий час через прорив труби, зворотний потік каналізації чи відсутність води, термінове зроблено, решту оцінено."
   ],
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਐਮਰਜੈਂਸੀ",
    "ਫਟੀ ਪਾਈਪ, ਸੀਵਰ ਵਾਪਸੀ ਜਾਂ ਪਾਣੀ ਨਾ ਹੋਣ 'ਤੇ ਛੁੱਟੀ ਦੇ ਸਮੇਂ ਸੱਦਾ, ਫ਼ੌਰੀ ਕੰਮ ਕੀਤਾ ਅਤੇ ਬਾਕੀ ਦਾ ਰੇਟ।"
   ],
   "tl": [
    "Diagnostic visit — emergency",
    "Tawag lampas oras para sa pumutok na tubo, umatras na imburnal o walang tubig, ginawa ang agarang ayos at binigyan ng presyo ang iba."
   ]
  },
  "fq.plumbing.visits.diagnostic_residential": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਰਿਹਾਇਸ਼ੀ",
    "ਪਲੰਬਰ ਘਰ ਆ ਕੇ ਲੱਭਦਾ ਹੈ ਕਿ ਕੀ ਗ਼ਲਤ ਹੈ ਅਤੇ ਮੁਰੰਮਤ ਤੋਂ ਪਹਿਲਾਂ ਲਿਖਤੀ ਰੇਟ ਦਿੰਦਾ ਹੈ।"
   ]
  },
  "fq.plumbing.lines.sewer_replacement": {
   "it": [
    "Sostituzione condotta fognaria",
    "Condotta crollata o danneggiata da radici scavata o rivestita e sostituita con tubo nuovo, poi reinterrata."
   ],
   "de": [
    "Abwasserleitung erneuern",
    "Eine eingebrochene oder verwurzelte Leitung aufgegraben oder inliniert und durch neues Rohr ersetzt, dann verfüllt."
   ],
   "uk": [
    "Заміна каналізаційної лінії",
    "Обвалену чи пошкоджену корінням лінію розкопано чи санаційно замінено новою трубою й засипано."
   ],
   "pa": [
    "ਸੀਵਰ ਲਾਈਨ ਬਦਲਣਾ",
    "ਢਹੀ ਜਾਂ ਜੜ੍ਹਾਂ ਨਾਲ ਖ਼ਰਾਬ ਸੀਵਰ ਲਾਈਨ ਪੁੱਟ ਕੇ ਜਾਂ ਲਾਈਨਿੰਗ ਕਰਕੇ ਨਵੀਂ ਪਾਈਪ ਨਾਲ ਬਦਲੀ ਅਤੇ ਮਿੱਟੀ ਭਰੀ।"
   ],
   "tl": [
    "Pagpapalit ng linya ng imburnal",
    "Hinukay o nilagyan ng liner at pinalitan ng bagong tubo ang gumuho o sinirang linya ng ugat, saka tinabunan."
   ]
  },
  "fq.plumbing.lines.water_line_install": {
   "pa": [
    "ਪਾਣੀ ਦੀ ਲਾਈਨ ਲਾਉਣਾ",
    "ਫ਼ਿਕਸਚਰ ਜਾਂ ਨਵੇਂ ਹਿੱਸੇ ਤੱਕ ਨਵੀਆਂ ਤਾਂਬੇ ਜਾਂ PEX ਲਾਈਨਾਂ, ਜਾਂ ਪੁਰਾਣੀਆਂ ਬਦਲੀਆਂ, ਬੰਦ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਦਬਾਅ ਟੈਸਟ।"
   ]
  },
  "fq.plumbing.lines.sewer_install": {
   "it": [
    "Posa condotta fognaria con pozzetti d'ispezione",
    "Nuova condotta posata in pendenza con pozzetti d'ispezione dove la linea potrà essere manutenuta."
   ],
   "de": [
    "Abwasserleitung mit Reinigungsöffnungen verlegen",
    "Eine neue Abwasserleitung mit Gefälle verlegt, mit Reinigungsöffnungen, wo sie später gewartet werden kann."
   ],
   "uk": [
    "Прокладання каналізації з ревізіями",
    "Нову лінію прокладено з ухилом і ревізіями там, де її згодом обслуговуватимуть."
   ],
   "pa": [
    "ਕਲੀਨਆਊਟਾਂ ਸਮੇਤ ਸੀਵਰ ਲਾਈਨ ਲਾਉਣਾ",
    "ਢਲਾਣ ਨਾਲ ਨਵੀਂ ਸੀਵਰ ਲਾਈਨ, ਜਿੱਥੇ ਬਾਅਦ ਵਿੱਚ ਸਰਵਿਸ ਹੋ ਸਕੇ ਉੱਥੇ ਕਲੀਨਆਊਟ।"
   ],
   "tl": [
    "Pagkakabit ng linya ng imburnal na may cleanout",
    "Inilatag nang may tamang hilig ang bagong linya, may cleanout kung saan maseserbisyuhan sa hinaharap."
   ]
  },
  "fq.plumbing.lines.leak_repair": {
   "pa": [
    "ਲੀਕ ਦੀ ਮੁਰੰਮਤ",
    "ਲੀਕ ਜੋੜ, ਫ਼ਿਟਿੰਗ ਜਾਂ ਪਾਈਪ ਦਾ ਛੋਟਾ ਹਿੱਸਾ ਠੀਕ ਕਰਕੇ ਲਾਈਨ ਜਾਂਚੀ।"
   ]
  },
  "fq.plumbing.lines.gas_line_install": {
   "it": [
    "Posa tubazione gas",
    "Nuova linea gas verso cucina, asciugatrice, barbecue o riscaldatore, con valvola di intercettazione, prova di tenuta e permesso dove richiesto."
   ],
   "de": [
    "Gasleitung verlegen",
    "Eine neue Gasleitung zu Herd, Trockner, Grill oder Heizgerät, mit Absperrhahn, Druckprüfung und Genehmigung, wo nötig."
   ],
   "uk": [
    "Прокладання газової лінії",
    "Нову газову лінію до плити, сушарки, барбекю чи обігрівача з краном, перевіркою тиску й дозволом, де треба."
   ],
   "pa": [
    "ਗੈਸ ਲਾਈਨ ਲਾਉਣਾ",
    "ਚੁੱਲ੍ਹੇ, ਡ੍ਰਾਇਰ, ਬਾਰਬੀਕਿਊ ਜਾਂ ਹੀਟਰ ਤੱਕ ਨਵੀਂ ਗੈਸ ਲਾਈਨ, ਬੰਦ ਕਰਨ ਵਾਲਾ ਵਾਲਵ, ਦਬਾਅ ਟੈਸਟ ਅਤੇ ਲੋੜ ਹੋਵੇ ਤਾਂ ਪਰਮਿਟ।"
   ],
   "tl": [
    "Pagkakabit ng linya ng gas",
    "Bagong linya ng gas papunta sa kalan, dryer, ihawan o heater, may shut-off, pressure test at permit kung kailangan."
   ]
  },
  "fq.plumbing.lines.main_water_replacement": {
   "it": [
    "Sostituzione allaccio idrico principale",
    "Linea dal contatore o dalla saracinesca alla casa sostituita, in trincea o tirata, e prato ripristinato."
   ],
   "de": [
    "Hauptwasserleitung erneuern",
    "Die Leitung vom Zähler oder Absperrschieber zum Haus erneuert, im Graben oder eingezogen, und der Rasen wiederhergestellt."
   ],
   "uk": [
    "Заміна вводу водопроводу",
    "Лінію від лічильника чи засувки до будинку замінено траншейно чи протяжкою, газон відновлено."
   ],
   "pa": [
    "ਮੁੱਖ ਪਾਣੀ ਲਾਈਨ ਬਦਲਣਾ",
    "ਮੀਟਰ ਜਾਂ ਕਰਬ ਸਟੌਪ ਤੋਂ ਘਰ ਤੱਕ ਲਾਈਨ ਖਾਈ ਜਾਂ ਖਿੱਚ ਕੇ ਬਦਲੀ ਅਤੇ ਘਾਹ ਮੁੜ ਠੀਕ।"
   ],
   "tl": [
    "Pagpapalit ng main na linya ng tubig",
    "Pinalitan ang linya mula metro o curb stop hanggang bahay, hinukay o hinila, at ibinalik ang damuhan."
   ]
  },
  "fq.plumbing.lines.water_line_repair": {
   "it": [
    "Riparazione tubazione dell'acqua",
    "Foro, spaccatura o raccordo guasto su una linea dell'acqua tagliato e riparato, poi provato in pressione."
   ],
   "de": [
    "Wasserleitungsreparatur",
    "Ein Loch, Riss oder defekter Fitting an einer Wasserleitung herausgeschnitten und repariert, dann druckgeprüft."
   ],
   "uk": [
    "Ремонт водопровідної лінії",
    "Нориця, тріщина чи несправний фітинг вирізано й відремонтовано, потім перевірено тиском."
   ],
   "pa": [
    "ਪਾਣੀ ਲਾਈਨ ਦੀ ਮੁਰੰਮਤ",
    "ਪਾਣੀ ਲਾਈਨ ਦਾ ਛੇਕ, ਤਰੇੜ ਜਾਂ ਖ਼ਰਾਬ ਫ਼ਿਟਿੰਗ ਕੱਟ ਕੇ ਠੀਕ ਅਤੇ ਦਬਾਅ ਟੈਸਟ।"
   ],
   "tl": [
    "Pagkukumpuni ng linya ng tubig",
    "Ginupit at inayos ang butas, bitak o sirang fitting sa linya ng tubig, saka pressure-test."
   ]
  },
  "fq.plumbing.sump.float_switch": {
   "it": [
    "Sostituzione galleggiante pompa di sollevamento e prova",
    "Galleggiante guasto sostituito e pompa fatta ciclare per verificare avvio e arresto ai livelli giusti."
   ],
   "de": [
    "Schwimmerschalter der Sumpfpumpe tauschen und prüfen",
    "Ein defekter Schwimmerschalter ersetzt und die Pumpe durchgetaktet, um Ein- und Ausschalten zu prüfen."
   ],
   "uk": [
    "Заміна поплавця дренажного насоса з перевіркою",
    "Несправний поплавець замінено, насос прогнано, щоб перевірити вмикання й вимикання на потрібних рівнях."
   ],
   "pa": [
    "ਸੰਪ ਪੰਪ ਫ਼ਲੋਟ ਸਵਿੱਚ ਬਦਲਣਾ ਅਤੇ ਟੈਸਟ",
    "ਖ਼ਰਾਬ ਫ਼ਲੋਟ ਸਵਿੱਚ ਬਦਲਿਆ ਅਤੇ ਪੰਪ ਚਲਾ ਕੇ ਸਹੀ ਪੱਧਰਾਂ 'ਤੇ ਚਾਲੂ-ਬੰਦ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng float switch ng sump pump at test",
    "Pinalitan ang sirang float switch at pinaandar ang pump para matiyak na umaandar at humihinto sa tamang lebel."
   ]
  },
  "fq.plumbing.sump.discharge_line": {
   "it": [
    "Riparazione linea di mandata pompa e prova",
    "Linea di mandata crepata, gelata o scollegata riparata perché la pompa porti davvero l'acqua fuori dal pozzetto."
   ],
   "de": [
    "Druckleitung der Sumpfpumpe reparieren und prüfen",
    "Eine gerissene, gefrorene oder getrennte Druckleitung repariert, damit die Pumpe das Wasser wirklich abführt."
   ],
   "uk": [
    "Ремонт напірної лінії насоса з перевіркою",
    "Тріснуту, замерзлу чи від'єднану напірну лінію відремонтовано — насос справді виводить воду з приямка."
   ],
   "pa": [
    "ਸੰਪ ਪੰਪ ਡਿਸਚਾਰਜ ਲਾਈਨ ਮੁਰੰਮਤ ਅਤੇ ਟੈਸਟ",
    "ਤਿੜਕੀ, ਜੰਮੀ ਜਾਂ ਖੁੱਲ੍ਹੀ ਡਿਸਚਾਰਜ ਲਾਈਨ ਠੀਕ ਤਾਂ ਜੋ ਪੰਪ ਸੱਚਮੁੱਚ ਪਾਣੀ ਟੋਏ 'ਚੋਂ ਬਾਹਰ ਕੱਢੇ।"
   ],
   "tl": [
    "Pagkukumpuni ng discharge line ng sump pump at test",
    "Inayos ang bitak, nagyelo o nahiwalay na discharge line para talagang mailabas ng pump ang tubig."
   ]
  },
  "fq.plumbing.sump.battery_backup": {
   "it": [
    "Installazione pompa di riserva a batteria — pompa esclusa",
    "Pompa di riserva a batteria montata accanto alla principale perché il seminterrato resti asciutto durante un blackout; l'unità è fatturata a parte."
   ],
   "de": [
    "Batterie-Reservepumpe einbauen — ohne Pumpe",
    "Eine batteriebetriebene Reservepumpe neben der Hauptpumpe eingebaut, damit der Keller bei Stromausfall trocken bleibt; das Gerät wird separat berechnet."
   ],
   "uk": [
    "Встановлення резервного насоса на батареї — без насоса",
    "Резервний насос на батареї встановлено біля основного, щоб підвал лишався сухим без світла; сам агрегат оплачується окремо."
   ],
   "pa": [
    "ਬੈਟਰੀ ਬੈਕਅੱਪ ਸੰਪ ਪੰਪ ਲਾਉਣਾ — ਪੰਪ ਸ਼ਾਮਲ ਨਹੀਂ",
    "ਮੁੱਖ ਪੰਪ ਕੋਲ ਬੈਟਰੀ ਵਾਲਾ ਬੈਕਅੱਪ ਪੰਪ ਤਾਂ ਜੋ ਬਿਜਲੀ ਜਾਣ 'ਤੇ ਬੇਸਮੈਂਟ ਸੁੱਕੀ ਰਹੇ; ਯੂਨਿਟ ਵੱਖਰਾ ਬਿੱਲ।"
   ],
   "tl": [
    "Pagkakabit ng battery backup na sump pump — hindi kasama ang pump",
    "Ikinabit ang pump na de-baterya sa tabi ng pangunahing pump para tuyo ang basement kapag brownout; hiwalay ang singil ng unit."
   ]
  },
  "fq.plumbing.sump.check_valve": {
   "it": [
    "Sostituzione valvola di non ritorno — fino a 1½ in",
    "Valvola di non ritorno usurata sostituita perché l'acqua non ricada nel pozzetto facendo ciclare la pompa."
   ],
   "de": [
    "Rückschlagventil tauschen — bis 1½ in",
    "Ein verschlissenes Rückschlagventil ersetzt, damit das Wasser nicht in den Schacht zurückfällt und die Pumpe taktet."
   ],
   "uk": [
    "Заміна зворотного клапана — до 1½ дюйма",
    "Зношений зворотний клапан замінено — вода не повертається в приямок і насос не вмикається зайвий раз."
   ],
   "pa": [
    "ਸੰਪ ਪੰਪ ਚੈੱਕ ਵਾਲਵ ਬਦਲਣਾ — 1½ ਇੰਚ ਤੱਕ",
    "ਘਿਸਿਆ ਚੈੱਕ ਵਾਲਵ ਬਦਲਿਆ ਤਾਂ ਜੋ ਪਾਣੀ ਟੋਏ ਵਿੱਚ ਵਾਪਸ ਨਾ ਡਿੱਗੇ ਅਤੇ ਪੰਪ ਵਾਰ-ਵਾਰ ਨਾ ਚੱਲੇ।"
   ],
   "tl": [
    "Pagpapalit ng check valve ng sump pump — hanggang 1½ in",
    "Pinalitan ang gasgas na check valve para hindi bumalik ang tubig sa hukay at hindi paulit-ulit umandar ang pump."
   ]
  },
  "fq.plumbing.sump.replace_customer_pump": {
   "it": [
    "Sostituzione pompa di sollevamento — pompa del cliente",
    "Vecchia pompa rimossa e quella nuova del cliente posata, collegata alla mandata e provata per un ciclo completo."
   ],
   "de": [
    "Sumpfpumpe tauschen — Pumpe vom Kunden",
    "Die alte Pumpe ausgebaut, die neue des Kunden gesetzt, an die Druckleitung angeschlossen und einen vollen Zyklus getestet."
   ],
   "uk": [
    "Заміна дренажного насоса — насос клієнта",
    "Старий насос знято, новий насос клієнта встановлено, під'єднано до напірної лінії й перевірено повним циклом."
   ],
   "pa": [
    "ਸੰਪ ਪੰਪ ਬਦਲਣਾ — ਗਾਹਕ ਦਾ ਪੰਪ",
    "ਪੁਰਾਣਾ ਪੰਪ ਕੱਢ ਕੇ ਗਾਹਕ ਦਾ ਨਵਾਂ ਪੰਪ ਲਾਇਆ, ਡਿਸਚਾਰਜ ਨਾਲ ਜੋੜਿਆ ਅਤੇ ਪੂਰਾ ਚੱਕਰ ਟੈਸਟ।"
   ],
   "tl": [
    "Pagpapalit ng sump pump — pump ng kliyente",
    "Tinanggal ang lumang pump at inilagay ang bagong pump ng kliyente, ikinonekta sa discharge at sinubukan sa buong cycle."
   ]
  },
  "fq.plumbing.toilets.tank_replacement": {
   "it": [
    "Sostituzione cassetta del WC",
    "Cassetta crepata o usurata sostituita con una nuova abbinata, con nuova guarnizione e bulloni cassetta-vaso."
   ],
   "de": [
    "Spülkastentausch",
    "Ein gerissener oder abgenutzter Spülkasten durch einen passenden neuen ersetzt, mit neuer Dichtung und Schrauben."
   ],
   "uk": [
    "Заміна бачка унітаза",
    "Тріснутий чи зношений бачок замінено відповідним новим із новою прокладкою й болтами."
   ],
   "pa": [
    "ਟਾਇਲਟ ਟੈਂਕੀ ਬਦਲਣਾ",
    "ਤਿੜਕੀ ਜਾਂ ਘਿਸੀ ਟੈਂਕੀ ਮੇਲ ਖਾਂਦੀ ਨਵੀਂ ਨਾਲ ਬਦਲੀ, ਨਵੀਂ ਗੈਸਕਟ ਅਤੇ ਬੋਲਟਾਂ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagpapalit ng tangke ng inidoro",
    "Pinalitan ng katugmang bago ang bitak o lumang tangke, may bagong gasket at bolt."
   ]
  },
  "fq.plumbing.toilets.flapper_test": {
   "it": [
    "Sostituzione batacchio e prova",
    "Nuovo batacchio montato e cassetta testata con colorante per confermare che la perdita nel vaso si è fermata."
   ],
   "de": [
    "Klappe tauschen und prüfen",
    "Eine neue Klappe eingesetzt und der Spülkasten mit Farbstoff geprüft, ob das Lecken ins Becken aufgehört hat."
   ],
   "uk": [
    "Заміна клапана бачка з перевіркою",
    "Новий клапан встановлено, бачок перевірено барвником — протікання в унітаз зупинено."
   ],
   "pa": [
    "ਫ਼ਲੈਪਰ ਬਦਲਣਾ ਅਤੇ ਟੈਸਟ",
    "ਨਵਾਂ ਫ਼ਲੈਪਰ ਲਾਇਆ ਅਤੇ ਰੰਗ ਨਾਲ ਟੈਂਕੀ ਜਾਂਚੀ ਕਿ ਕਟੋਰੇ ਵਿੱਚ ਚੋਣਾ ਬੰਦ ਹੋਇਆ।"
   ],
   "tl": [
    "Pagpapalit ng flapper at pagsubok",
    "Ikinabit ang bagong flapper at sinubukan ang tangke sa dye para matiyak na tumigil ang tagas sa bowl."
   ]
  },
  "fq.plumbing.toilets.fill_valve_test": {
   "it": [
    "Sostituzione valvola di carico e prova",
    "Nuova valvola di carico installata, livello dell'acqua regolato e riempimento controllato per fischi e traboccamenti."
   ],
   "de": [
    "Füllventil tauschen und prüfen",
    "Ein neues Füllventil eingebaut, der Wasserstand eingestellt und das Nachfüllen auf Zischen und Überlauf geprüft."
   ],
   "uk": [
    "Заміна наливного клапана з перевіркою",
    "Новий наливний клапан встановлено, рівень виставлено, наповнення перевірено на шипіння й перелив."
   ],
   "pa": [
    "ਟੈਂਕੀ ਫ਼ਿੱਲ ਵਾਲਵ ਬਦਲਣਾ ਅਤੇ ਟੈਸਟ",
    "ਨਵਾਂ ਫ਼ਿੱਲ ਵਾਲਵ ਲਾਇਆ, ਪਾਣੀ ਦਾ ਪੱਧਰ ਸੈੱਟ ਅਤੇ ਭਰਾਈ ਸ਼ੂਕ ਅਤੇ ਓਵਰਫ਼ਲੋ ਲਈ ਜਾਂਚੀ।"
   ],
   "tl": [
    "Pagpapalit ng fill valve at pagsubok",
    "Ikinabit ang bagong fill valve, itinakda ang lebel at sinuri ang pagpuno sa sitsit at pag-apaw."
   ]
  },
  "fq.plumbing.toilets.tank_rebuild": {
   "pa": [
    "ਟਾਇਲਟ ਟੈਂਕੀ ਦੀ ਮੁੜ ਉਸਾਰੀ — ਫ਼ਲੈਪਰ ਅਤੇ ਫ਼ਿੱਲ ਵਾਲਵ",
    "ਫ਼ਲੈਪਰ ਅਤੇ ਫ਼ਿੱਲ ਵਾਲਵ ਇਕੱਠੇ ਬਦਲੇ, ਉਹ ਦੋ ਪੁਰਜ਼ੇ ਜੋ ਲਗਭਗ ਹਰ ਚੱਲਦੇ ਟਾਇਲਟ ਦਾ ਕਾਰਨ ਹਨ।"
   ]
  },
  "fq.plumbing.toilets.reset_seal": {
   "it": [
    "Riposizionamento e sigillatura WC",
    "WC che traballa o perde sollevato, rimesso su nuovo anello di cera e bulloni e sigillato al pavimento."
   ],
   "de": [
    "WC neu setzen und abdichten",
    "Ein wackelndes oder undichtes WC abgehoben, auf neuen Wachsring und Schrauben gesetzt und zum Boden abgedichtet."
   ],
   "uk": [
    "Переустановлення й герметизація унітаза",
    "Хиткий чи протікаючий унітаз знято, поставлено на нове воскове кільце й болти, загерметизовано до підлоги."
   ],
   "pa": [
    "ਟਾਇਲਟ ਮੁੜ ਬਿਠਾਉਣਾ ਅਤੇ ਸੀਲ",
    "ਹਿੱਲਦਾ ਜਾਂ ਲੀਕ ਟਾਇਲਟ ਚੁੱਕ ਕੇ ਨਵੀਂ ਵੈਕਸ ਰਿੰਗ ਅਤੇ ਬੋਲਟਾਂ ਉੱਤੇ ਰੱਖਿਆ ਅਤੇ ਫ਼ਰਸ਼ ਨਾਲ ਸੀਲ।"
   ],
   "tl": [
    "Muling pagtayo at pagselyo ng inidoro",
    "Inangat ang umuuga o tumutulong inidoro, ipinatong sa bagong wax ring at bolt at sinelyuhan sa sahig."
   ]
  },
  "fq.plumbing.toilets.install_best": {
   "pa": [
    "ਟਾਇਲਟ ਬਦਲਣਾ — ਪ੍ਰੀਮੀਅਮ ਡੂਅਲ-ਫ਼ਲੱਸ਼",
    "ਪੁਰਾਣਾ ਟਾਇਲਟ ਹਟਾ ਕੇ ਪ੍ਰੀਮੀਅਮ ਡੂਅਲ-ਫ਼ਲੱਸ਼, ਆਰਾਮਦਾਇਕ ਉਚਾਈ ਵਾਲਾ ਟਾਇਲਟ ਲਾਇਆ, ਜੋੜਿਆ ਅਤੇ ਜਾਂਚਿਆ।"
   ]
  },
  "fq.plumbing.valves.sweat_valve": {
   "it": [
    "Installazione o sostituzione valvola a saldare",
    "Valvola di intercettazione saldata su linea in rame, o una bloccata tagliata e sostituita."
   ],
   "de": [
    "Lötventil einbauen oder tauschen",
    "Ein gelötetes Absperrventil an einer Kupferleitung gesetzt oder ein festsitzendes herausgeschnitten und ersetzt."
   ],
   "uk": [
    "Встановлення чи заміна паяного крана",
    "Паяний запірний кран встановлено на мідну лінію або заклинений вирізано й замінено."
   ],
   "pa": [
    "ਸਵੈੱਟ ਵਾਲਵ ਲਾਉਣਾ ਜਾਂ ਬਦਲਣਾ",
    "ਤਾਂਬੇ ਦੀ ਲਾਈਨ ਉੱਤੇ ਸੋਲਡਰ ਵਾਲਾ ਬੰਦ ਵਾਲਵ ਲਾਇਆ ਜਾਂ ਜਾਮ ਵਾਲਾ ਕੱਟ ਕੇ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagkakabit o pagpapalit ng sweat valve",
    "Ikinabit ang soldered na shut-off sa tansong linya, o ginupit at pinalitan ang stuck na valve."
   ]
  },
  "fq.plumbing.tub_shower.shower_base_no_tile": {
   "it": [
    "Sostituzione piatto doccia — senza piastrelle",
    "Piatto doccia sostituito e ricollegato allo scarico dove le piastrelle circostanti possono restare."
   ],
   "de": [
    "Duschwanne tauschen — ohne Fliesenarbeiten",
    "Die Duschwanne ersetzt und an den Ablauf angeschlossen, wo die umliegenden Fliesen bleiben können."
   ],
   "uk": [
    "Заміна піддона — без плиткових робіт",
    "Піддон замінено й під'єднано до зливу там, де навколишня плитка може лишитися."
   ],
   "pa": [
    "ਸ਼ਾਵਰ ਬੇਸ ਬਦਲਣਾ — ਟਾਈਲ ਕੰਮ ਤੋਂ ਬਿਨਾਂ",
    "ਸ਼ਾਵਰ ਪੈਨ ਬਦਲ ਕੇ ਡਰੇਨ ਨਾਲ ਜੋੜਿਆ ਜਿੱਥੇ ਆਲੇ-ਦੁਆਲੇ ਦੀ ਟਾਈਲ ਰਹਿ ਸਕਦੀ ਹੈ।"
   ],
   "tl": [
    "Pagpapalit ng shower base — walang tile",
    "Pinalitan ang shower pan at ikinonekta sa drain kung saan maiiwan ang tile sa paligid."
   ]
  },
  "fq.plumbing.tub_shower.pop_up_drain": {
   "it": [
    "Sostituzione piletta a scatto",
    "Piletta a scatto bloccata o corrosa di lavabo o vasca sostituita con un gruppo nuovo."
   ],
   "de": [
    "Ablaufgarnitur mit Stopfen tauschen",
    "Eine festsitzende oder korrodierte Ablaufgarnitur in Waschbecken oder Wanne durch eine neue ersetzt."
   ],
   "uk": [
    "Заміна зливу клік-клак",
    "Заклинений чи роз'їдений злив мийки чи ванни замінено новим комплектом."
   ],
   "pa": [
    "ਪੌਪ-ਅੱਪ ਡਰੇਨ ਬਦਲਣਾ",
    "ਸਿੰਕ ਜਾਂ ਟੱਬ ਦੀ ਜਾਮ ਜਾਂ ਜੰਗਾਲੀ ਪੌਪ-ਅੱਪ ਡਰੇਨ ਨਵੀਂ ਨਾਲ ਬਦਲੀ।"
   ],
   "tl": [
    "Pagpapalit ng pop-up drain",
    "Pinalitan ng bagong assembly ang stuck o kinakalawang na pop-up drain ng lababo o tub."
   ]
  },
  "fq.plumbing.tub_shower.shower_base": {
   "it": [
    "Sostituzione piatto doccia",
    "Vecchio piatto rimosso, scarico rifatto e nuovo piatto posato in piano e sigillato."
   ],
   "de": [
    "Duschwanne tauschen",
    "Die alte Duschwanne entfernt, der Ablauf überarbeitet und eine neue Wanne waagerecht gesetzt und abgedichtet."
   ],
   "uk": [
    "Заміна душового піддона",
    "Старий піддон знято, злив перероблено, новий встановлено рівно й загерметизовано."
   ],
   "pa": [
    "ਸ਼ਾਵਰ ਬੇਸ ਬਦਲਣਾ",
    "ਪੁਰਾਣਾ ਸ਼ਾਵਰ ਪੈਨ ਕੱਢਿਆ, ਡਰੇਨ ਠੀਕ ਅਤੇ ਨਵਾਂ ਬੇਸ ਪੱਧਰਾ ਲਾ ਕੇ ਸੀਲ।"
   ],
   "tl": [
    "Pagpapalit ng shower base",
    "Tinanggal ang lumang pan, inayos ang drain at inilagay nang pantay at sinelyuhan ang bagong base."
   ]
  },
  "fq.plumbing.tub_shower.tub_waste_overflow": {
   "it": [
    "Sostituzione scarico e troppopieno vasca",
    "Gruppo di scarico e troppopieno della vasca sostituito da sotto o da un pannello d'ispezione e provato a vasca piena."
   ],
   "de": [
    "Wannen-Ab- und Überlauf tauschen",
    "Die Ab- und Überlaufgarnitur der Wanne von unten oder über eine Revisionsöffnung ersetzt und bei voller Wanne geprüft."
   ],
   "uk": [
    "Заміна зливу-переливу ванни",
    "Злив і перелив ванни замінено знизу чи через ревізійний люк і перевірено на повній ванні."
   ],
   "pa": [
    "ਟੱਬ ਵੇਸਟ ਅਤੇ ਓਵਰਫ਼ਲੋ ਬਦਲਣਾ",
    "ਹੇਠੋਂ ਜਾਂ ਪਹੁੰਚ ਪੈਨਲ ਰਾਹੀਂ ਟੱਬ ਦਾ ਡਰੇਨ ਅਤੇ ਓਵਰਫ਼ਲੋ ਬਦਲਿਆ ਅਤੇ ਭਰ ਕੇ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng waste at overflow ng tub",
    "Pinalitan mula sa ilalim o access panel ang drain at overflow ng tub at sinubukang puno."
   ]
  },
  "fq.plumbing.valves.main_valve": {
   "it": [
    "Sostituzione valvola generale",
    "Valvola generale della casa sostituita con una a sfera a un quarto di giro che si chiude davvero quando serve."
   ],
   "de": [
    "Hauptabsperrventil tauschen",
    "Das Hauptabsperrventil durch einen Viertelumdrehungs-Kugelhahn ersetzt, der im Ernstfall wirklich schließt."
   ],
   "uk": [
    "Заміна головного крана",
    "Головний кран замінено кульовим на чверть оберту, який справді закриється, коли треба."
   ],
   "pa": [
    "ਮੁੱਖ ਬੰਦ ਵਾਲਵ ਬਦਲਣਾ",
    "ਘਰ ਦਾ ਮੁੱਖ ਵਾਲਵ ਚੌਥਾਈ ਮੋੜ ਵਾਲੇ ਬਾਲ ਵਾਲਵ ਨਾਲ ਬਦਲਿਆ ਜੋ ਲੋੜ ਵੇਲੇ ਸੱਚਮੁੱਚ ਬੰਦ ਹੋਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng main shut-off valve",
    "Pinalitan ang main shut-off ng bahay ng quarter-turn na ball valve na talagang sasara kapag kailangan."
   ]
  },
  "fq.plumbing.valves.gas_valve": {
   "it": [
    "Installazione valvola gas",
    "Valvola di intercettazione montata sulla linea gas di un apparecchio e provata per perdite."
   ],
   "de": [
    "Gasabsperrhahn einbauen",
    "Ein Absperrhahn an der Gasleitung eines Geräts eingebaut und auf Dichtheit geprüft."
   ],
   "uk": [
    "Встановлення газового крана",
    "Запірний кран встановлено на газовій лінії приладу й перевірено на витік."
   ],
   "pa": [
    "ਗੈਸ ਵਾਲਵ ਲਾਉਣਾ",
    "ਉਪਕਰਣ ਦੀ ਗੈਸ ਲਾਈਨ ਉੱਤੇ ਬੰਦ ਵਾਲਵ ਲਾ ਕੇ ਲੀਕ ਟੈਸਟ।"
   ],
   "tl": [
    "Pagkakabit ng gas valve",
    "Ikinabit ang shut-off valve sa linya ng gas ng appliance at sinuri sa tagas."
   ]
  },
  "fq.plumbing.valves.water_softener": {
   "it": [
    "Installazione addolcitore",
    "Addolcitore collegato all'alimentazione principale con bypass, scarico e serbatoio del sale, programmato sulla durezza dell'acqua."
   ],
   "de": [
    "Wasserenthärter einbauen",
    "Ein Enthärter mit Bypass, Ablauf und Salzbehälter in die Hauptleitung eingebunden und auf die Wasserhärte programmiert."
   ],
   "uk": [
    "Встановлення пом'якшувача води",
    "Пом'якшувач підключено до основного вводу з байпасом, зливом і сольовим баком, запрограмовано під жорсткість води."
   ],
   "pa": [
    "ਵਾਟਰ ਸੌਫ਼ਨਰ ਲਾਉਣਾ",
    "ਮੁੱਖ ਸਪਲਾਈ ਵਿੱਚ ਬਾਈਪਾਸ, ਡਰੇਨ ਅਤੇ ਲੂਣ ਟੈਂਕੀ ਸਮੇਤ ਸੌਫ਼ਨਰ, ਪਾਣੀ ਦੀ ਕਠੋਰਤਾ ਮੁਤਾਬਕ ਪ੍ਰੋਗਰਾਮ।"
   ],
   "tl": [
    "Pagkakabit ng water softener",
    "Ikinabit sa pangunahing supply ang softener na may bypass, drain at tangke ng asin, naka-program sa katigasan ng tubig."
   ]
  },
  "fq.plumbing.valves.water_valve": {
   "it": [
    "Installazione valvola dell'acqua",
    "Nuova valvola di intercettazione aggiunta su una linea dell'acqua dove mancava o serviva."
   ],
   "de": [
    "Wasserabsperrventil einbauen",
    "Ein neues Absperrventil an einer Wasserleitung gesetzt, wo eines fehlte oder gebraucht wurde."
   ],
   "uk": [
    "Встановлення водяного крана",
    "Новий запірний кран додано на водяну лінію, де його бракувало чи він потрібен."
   ],
   "pa": [
    "ਪਾਣੀ ਵਾਲਵ ਲਾਉਣਾ",
    "ਪਾਣੀ ਦੀ ਲਾਈਨ ਉੱਤੇ ਨਵਾਂ ਬੰਦ ਵਾਲਵ ਜਿੱਥੇ ਨਹੀਂ ਸੀ ਜਾਂ ਲੋੜ ਸੀ।"
   ],
   "tl": [
    "Pagkakabit ng water valve",
    "Nagdagdag ng bagong shut-off valve sa linya ng tubig kung saan wala o kailangan."
   ]
  },
  "fq.plumbing.valves.water_purification": {
   "pa": [
    "ਪਾਣੀ ਸ਼ੁੱਧੀਕਰਨ ਸਿਸਟਮ ਦੀ ਸਰਵਿਸ",
    "ਸ਼ੁੱਧ ਜਾਂ ਡਿਸਟਿਲਡ ਪਾਣੀ ਸਿਸਟਮ ਦੇ ਫ਼ਿਲਟਰ ਬਦਲੇ ਅਤੇ ਸਿਸਟਮ ਜਾਂਚਿਆ।"
   ]
  },
  "fq.plumbing.valves.angle_stop": {
   "it": [
    "Sostituzione rubinetto sottolavello e flessibile",
    "Rubinetto sotto lavello o WC sostituito con uno nuovo a un quarto di giro e un flessibile intrecciato."
   ],
   "de": [
    "Eckventil und Anschlussschlauch tauschen",
    "Das Absperrventil unter Waschbecken oder WC durch ein neues Viertelumdrehungsventil mit Panzerschlauch ersetzt."
   ],
   "uk": [
    "Заміна кутового крана та шланга",
    "Кран під мийкою чи унітазом замінено новим на чверть оберту з обплетеним шлангом."
   ],
   "pa": [
    "ਐਂਗਲ ਸਟੌਪ ਅਤੇ ਸਪਲਾਈ ਲਾਈਨ ਬਦਲਣਾ",
    "ਸਿੰਕ ਜਾਂ ਟਾਇਲਟ ਹੇਠਲਾ ਵਾਲਵ ਨਵੇਂ ਚੌਥਾਈ-ਮੋੜ ਸਟੌਪ ਅਤੇ ਬ੍ਰੇਡਡ ਸਪਲਾਈ ਲਾਈਨ ਨਾਲ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng angle stop at supply line",
    "Pinalitan ang shut-off sa ilalim ng lababo o inidoro ng bagong quarter-turn stop at braided na supply line."
   ]
  },
  "fq.plumbing.valves.hose_bib": {
   "it": [
    "Sostituzione rubinetto esterno",
    "Rubinetto esterno che perde o spaccato dal gelo sostituito, antigelo dove il muro lo consente."
   ],
   "de": [
    "Außenwasserhahn tauschen",
    "Ein undichter oder frostgeplatzter Außenhahn ersetzt, frostsicher, wo die Wand es erlaubt."
   ],
   "uk": [
    "Заміна зовнішнього крана",
    "Протікаючий чи розірваний морозом зовнішній кран замінено, морозостійким, де дозволяє стіна."
   ],
   "pa": [
    "ਹੋਜ਼ ਬਿਬ ਬਦਲਣਾ",
    "ਲੀਕ ਜਾਂ ਠੰਢ ਨਾਲ ਫਟੀ ਬਾਹਰੀ ਟੂਟੀ ਬਦਲੀ, ਜਿੱਥੇ ਕੰਧ ਇਜਾਜ਼ਤ ਦੇਵੇ ਉੱਥੇ ਠੰਢ-ਰੋਧੀ।"
   ],
   "tl": [
    "Pagpapalit ng hose bib",
    "Pinalitan ang tumutulo o nabiyak sa lamig na gripo sa labas, frost-free kung papayagan ng pader."
   ]
  },
  "fq.plumbing.valves.pressure_reducing_valve": {
   "it": [
    "Installazione riduttore di pressione",
    "Riduttore montato sulla linea in ingresso e tarato perché l'alta pressione di rete non martelli tubi ed elettrodomestici."
   ],
   "de": [
    "Druckminderer einbauen",
    "Ein Druckminderer an der Zuleitung eingebaut und eingestellt, damit hoher Netzdruck Rohre und Geräte nicht schlägt."
   ],
   "uk": [
    "Встановлення редуктора тиску",
    "Редуктор встановлено на вводі й налаштовано, щоб високий тиск мережі не бив труби й техніку."
   ],
   "pa": [
    "ਦਬਾਅ ਘਟਾਉਣ ਵਾਲਾ ਵਾਲਵ ਲਾਉਣਾ",
    "ਆਉਣ ਵਾਲੀ ਲਾਈਨ ਉੱਤੇ ਰੈਗੂਲੇਟਰ ਲਾ ਕੇ ਸੈੱਟ ਤਾਂ ਜੋ ਸੜਕ ਦਾ ਉੱਚਾ ਦਬਾਅ ਪਾਈਪਾਂ ਅਤੇ ਉਪਕਰਣਾਂ ਨੂੰ ਨਾ ਮਾਰੇ।"
   ],
   "tl": [
    "Pagkakabit ng pressure-reducing valve",
    "Ikinabit at itinakda ang regulator sa papasok na linya para hindi masira ng mataas na presyon ang tubo at appliance."
   ]
  },
  "fq.plumbing.water_heaters.gas_install_service": {
   "it": [
    "Installazione e assistenza scaldacqua a gas",
    "Scaldacqua a gas fornito o revisionato, collegato a gas, acqua e scarico fumi, acceso e verificato."
   ],
   "de": [
    "Einbau und Service Gas-Warmwasserbereiter",
    "Ein Gas-Warmwasserbereiter geliefert oder gewartet, an Gas, Wasser und Abgas angeschlossen, gezündet und geprüft."
   ],
   "uk": [
    "Монтаж і обслуговування газового водонагрівача",
    "Газовий водонагрівач постачено чи обслуговано, під'єднано до газу, води й димоходу, запущено й перевірено."
   ],
   "pa": [
    "ਗੈਸ ਵਾਟਰ ਹੀਟਰ ਲਾਉਣਾ ਅਤੇ ਸਰਵਿਸ",
    "ਗੈਸ ਵਾਟਰ ਹੀਟਰ ਦੇ ਕੇ ਜਾਂ ਸਰਵਿਸ ਕਰਕੇ ਗੈਸ, ਪਾਣੀ ਅਤੇ ਵੈਂਟ ਨਾਲ ਜੋੜਿਆ, ਬਾਲ ਕੇ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Pagkakabit at serbisyo ng gas na water heater",
    "Nagbigay o nagserbisyo ng gas na water heater, ikinonekta sa gas, tubig at vent, sinindihan at sinuri."
   ]
  },
  "fq.plumbing.water_heaters.electric_50_gallon": {
   "pa": [
    "ਬਿਜਲੀ ਵਾਟਰ ਹੀਟਰ ਲਾਉਣਾ — 50 ਗੈਲਨ ਅਤੇ ਵੱਧ",
    "50 ਗੈਲਨ ਜਾਂ ਵੱਧ ਦੀ ਨਵੀਂ ਬਿਜਲੀ ਟੈਂਕੀ ਨਵੇਂ ਕਨੈਕਸ਼ਨ, ਪੈਨ ਅਤੇ ਲੋੜ ਹੋਵੇ ਤਾਂ ਐਕਸਪੈਂਸ਼ਨ ਟੈਂਕੀ ਸਮੇਤ।"
   ]
  },
  "fq.plumbing.water_heaters.tankless_install": {
   "pa": [
    "ਟੈਂਕ-ਰਹਿਤ ਵਾਟਰ ਹੀਟਰ ਲਾਉਣਾ",
    "ਲੋੜ ਵੇਲੇ ਗਰਮ ਕਰਨ ਵਾਲਾ ਹੀਟਰ ਲਾ ਕੇ ਗੈਸ ਲਾਈਨ, ਵੈਂਟ ਅਤੇ ਕੰਡੈਂਸੇਟ ਸਮੇਤ ਜੋੜਿਆ।"
   ]
  },
  "fq.plumbing.water_heaters.install_generic": {
   "it": [
    "Installazione scaldacqua",
    "Serbatoio sostitutivo installato con nuovi raccordi e vecchia unità rimossa."
   ],
   "de": [
    "Warmwasserbereiter einbauen",
    "Ein Ersatzspeicher mit neuen Anschlüssen eingebaut und das alte Gerät entfernt."
   ],
   "uk": [
    "Встановлення водонагрівача",
    "Новий бак встановлено з новими з'єднаннями, старий знято."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਲਾਉਣਾ",
    "ਨਵੇਂ ਕਨੈਕਸ਼ਨਾਂ ਨਾਲ ਬਦਲਵੀਂ ਟੈਂਕੀ ਲਾਈ ਅਤੇ ਪੁਰਾਣਾ ਯੂਨਿਟ ਹਟਾਇਆ।"
   ],
   "tl": [
    "Pagkakabit ng water heater",
    "Ikinabit ang pamalit na tangke na may bagong koneksyon at tinanggal ang luma."
   ]
  },
  "fq.plumbing.water_heaters.emergency_shutoff": {
   "it": [
    "Sostituzione valvola di intercettazione dello scaldacqua",
    "Valvola dell'acqua fredda allo scaldacqua sostituita per poter isolare il serbatoio in emergenza."
   ],
   "de": [
    "Absperrventil am Warmwasserbereiter tauschen",
    "Das Kaltwasser-Absperrventil am Speicher ersetzt, damit er im Notfall abgesperrt werden kann."
   ],
   "uk": [
    "Заміна запірного крана водонагрівача",
    "Кран холодної води на водонагрівачі замінено, щоб бак можна було перекрити в аварії."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਬੰਦ ਵਾਲਵ ਬਦਲਣਾ",
    "ਹੀਟਰ ਦਾ ਠੰਢੇ ਪਾਣੀ ਵਾਲਾ ਵਾਲਵ ਬਦਲਿਆ ਤਾਂ ਜੋ ਐਮਰਜੈਂਸੀ ਵਿੱਚ ਟੈਂਕੀ ਬੰਦ ਹੋ ਸਕੇ।"
   ],
   "tl": [
    "Pagpapalit ng shut-off valve ng water heater",
    "Pinalitan ang shut-off ng malamig na tubig sa heater para maihiwalay ang tangke kapag emergency."
   ]
  },
  "fq.plumbing.water_heaters.thermostat": {
   "it": [
    "Sostituzione termostato dello scaldacqua",
    "Termostato o controllo della resistenza guasto sostituito perché l'acqua torni alla temperatura impostata."
   ],
   "de": [
    "Thermostat am Warmwasserbereiter tauschen",
    "Ein defekter Thermostat oder Heizstabregler ersetzt, damit das Wasser wieder die eingestellte Temperatur erreicht."
   ],
   "uk": [
    "Заміна термостата водонагрівача",
    "Несправний термостат чи керування ТЕНом замінено — вода знову гріється до заданої температури."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਥਰਮੋਸਟੈਟ ਬਦਲਣਾ",
    "ਖ਼ਰਾਬ ਥਰਮੋਸਟੈਟ ਜਾਂ ਐਲੀਮੈਂਟ ਕੰਟਰੋਲ ਬਦਲਿਆ ਤਾਂ ਜੋ ਪਾਣੀ ਮੁੜ ਤੈਅ ਤਾਪਮਾਨ ਤੱਕ ਗਰਮ ਹੋਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng thermostat ng water heater",
    "Pinalitan ang sirang thermostat o kontrol ng element para uminit ulit ang tubig sa itinakdang temperatura."
   ]
  },
  "fq.plumbing.water_heaters.drain_valve": {
   "it": [
    "Sostituzione rubinetto di scarico dello scaldacqua",
    "Rubinetto di scarico che gocciola o bloccato sostituito con uno in ottone per poter spurgare il serbatoio."
   ],
   "de": [
    "Entleerungshahn am Warmwasserbereiter tauschen",
    "Ein tropfender oder festsitzender Entleerungshahn durch einen aus Messing ersetzt, damit der Speicher gespült werden kann."
   ],
   "uk": [
    "Заміна зливного крана водонагрівача",
    "Крапаючий чи заклинений зливний кран замінено латунним, щоб бак можна було промити."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਡਰੇਨ ਵਾਲਵ ਬਦਲਣਾ",
    "ਟਪਕਦਾ ਜਾਂ ਜਾਮ ਡਰੇਨ ਵਾਲਵ ਪਿੱਤਲ ਵਾਲੇ ਨਾਲ ਬਦਲਿਆ ਤਾਂ ਜੋ ਟੈਂਕੀ ਫ਼ਲੱਸ਼ ਹੋ ਸਕੇ।"
   ],
   "tl": [
    "Pagpapalit ng drain valve ng water heater",
    "Pinalitan ng tanso ang tumutulo o stuck na drain valve para ma-flush ang tangke."
   ]
  },
  "fq.plumbing.water_heaters.service_burners": {
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਬਰਨਰ ਸਰਵਿਸ",
    "ਗੈਸ ਬਰਨਰ ਸਾਫ਼ ਅਤੇ ਸੈੱਟ ਕੀਤਾ ਤਾਂ ਜੋ ਲਾਟ ਸਥਿਰ ਨੀਲੀ ਅਤੇ ਪਾਇਲਟ ਠੀਕ ਹੋਵੇ।"
   ]
  },
  "fq.plumbing.water_heaters.expansion_tank": {
   "it": [
    "Sostituzione vaso di espansione",
    "Vaso di espansione pieno d'acqua sostituito e precaricato alla pressione della casa."
   ],
   "de": [
    "Ausdehnungsgefäß tauschen",
    "Ein wassergefülltes Ausdehnungsgefäß ersetzt und auf den Hausdruck vorgespannt."
   ],
   "uk": [
    "Заміна розширювального бака",
    "Заповнений водою розширювальний бак замінено й накачано під тиск будинку."
   ],
   "pa": [
    "ਐਕਸਪੈਂਸ਼ਨ ਟੈਂਕੀ ਬਦਲਣਾ",
    "ਪਾਣੀ ਨਾਲ ਭਰੀ ਐਕਸਪੈਂਸ਼ਨ ਟੈਂਕੀ ਬਦਲ ਕੇ ਘਰ ਦੇ ਦਬਾਅ ਮੁਤਾਬਕ ਪਹਿਲਾਂ ਚਾਰਜ।"
   ],
   "tl": [
    "Pagpapalit ng expansion tank",
    "Pinalitan ang puno ng tubig na expansion tank at pre-charge sa presyon ng bahay."
   ]
  },
  "fq.plumbing.water_heaters.leak_above": {
   "it": [
    "Riparazione perdita sopra lo scaldacqua",
    "Perdita a raccordi, valvole o flessibili sopra il serbatoio individuata e riparata."
   ],
   "de": [
    "Leckreparatur über dem Warmwasserbereiter",
    "Ein Leck an Anschlüssen, Ventilen oder Flexleitungen über dem Speicher gefunden und behoben."
   ],
   "uk": [
    "Ремонт протікання над водонагрівачем",
    "Протікання на з'єднаннях, кранах чи шлангах над баком знайдено й усунено."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਉੱਪਰ ਲੀਕ ਦੀ ਮੁਰੰਮਤ",
    "ਟੈਂਕੀ ਉੱਪਰ ਕਨੈਕਸ਼ਨਾਂ, ਵਾਲਵਾਂ ਜਾਂ ਫ਼ਲੈਕਸ ਲਾਈਨਾਂ ਦਾ ਲੀਕ ਲੱਭ ਕੇ ਠੀਕ।"
   ],
   "tl": [
    "Pagkukumpuni ng tagas sa ibabaw ng water heater",
    "Hinanap at inayos ang tagas sa koneksyon, valve o flex line sa ibabaw ng tangke."
   ]
  },
  "fq.plumbing.water_heaters.safety_sensor": {
   "it": [
    "Sostituzione sensore di sicurezza dello scaldacqua",
    "Sensore di vapori infiammabili o termico scattato o guasto sostituito perché lo scaldacqua si riaccenda."
   ],
   "de": [
    "Sicherheitssensor am Warmwasserbereiter tauschen",
    "Ein ausgelöster oder defekter Brenngas- oder Temperatursensor ersetzt, damit der Speicher wieder zündet."
   ],
   "uk": [
    "Заміна датчика безпеки водонагрівача",
    "Спрацьований чи несправний датчик парів чи температури замінено — нагрівач знову запалюється."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਸੇਫ਼ਟੀ ਸੈਂਸਰ ਬਦਲਣਾ",
    "ਡਿੱਗਿਆ ਜਾਂ ਖ਼ਰਾਬ ਜਲਣਸ਼ੀਲ-ਭਾਫ਼ ਜਾਂ ਗਰਮੀ ਸੈਂਸਰ ਬਦਲਿਆ ਤਾਂ ਜੋ ਹੀਟਰ ਮੁੜ ਬਲੇ।"
   ],
   "tl": [
    "Pagpapalit ng safety sensor ng water heater",
    "Pinalitan ang na-trip o sirang flammable-vapor o thermal sensor para muling magsindi ang heater."
   ]
  },
  "fq.plumbing.water_heaters.hot_surface_igniter": {
   "it": [
    "Sostituzione accenditore a superficie calda",
    "Accenditore guasto sostituito perché il bruciatore si accenda sempre senza fiamma pilota permanente."
   ],
   "de": [
    "Glühzünder tauschen",
    "Ein defekter Glühzünder ersetzt, damit der Brenner ohne Dauerzündflamme zuverlässig zündet."
   ],
   "uk": [
    "Заміна запальника",
    "Несправний розжарювальний запальник замінено — пальник надійно запалюється без постійного запальника."
   ],
   "pa": [
    "ਹੌਟ ਸਰਫ਼ੇਸ ਇਗਨਾਈਟਰ ਬਦਲਣਾ",
    "ਖ਼ਰਾਬ ਇਗਨਾਈਟਰ ਬਦਲਿਆ ਤਾਂ ਜੋ ਬਰਨਰ ਲਗਾਤਾਰ ਪਾਇਲਟ ਤੋਂ ਬਿਨਾਂ ਭਰੋਸੇ ਨਾਲ ਬਲੇ।"
   ],
   "tl": [
    "Pagpapalit ng hot surface igniter",
    "Pinalitan ang sirang igniter para mapagkakatiwalaang magsindi ang burner nang walang standing pilot."
   ]
  },
  "fq.plumbing.visits.custom_job": {
   "it": [
    "Lavoro su misura — prezzo sul posto",
    "Lavoro che non rientra in un servizio standard: descrivilo e il prezzo si fa dopo aver visto il lavoro."
   ],
   "de": [
    "Sonderauftrag — Preis vor Ort",
    "Arbeit, die in keinen Standardservice passt: beschreiben Sie sie, der Preis folgt nach Besichtigung."
   ],
   "uk": [
    "Індивідуальна робота — ціна на місці",
    "Робота поза стандартними послугами: опишіть її, ціну назвуть після огляду."
   ],
   "pa": [
    "ਖ਼ਾਸ ਕੰਮ — ਮੌਕੇ ਉੱਤੇ ਰੇਟ",
    "ਜੋ ਕੰਮ ਆਮ ਸੇਵਾ ਵਿੱਚ ਨਹੀਂ ਆਉਂਦਾ: ਦੱਸੋ ਅਤੇ ਕੰਮ ਦੇਖਣ ਤੋਂ ਬਾਅਦ ਰੇਟ।"
   ],
   "tl": [
    "Custom na trabaho — presyo sa lugar",
    "Trabahong wala sa karaniwang serbisyo: ilarawan at bibigyan ng presyo pagkatapos makita."
   ]
  },
  "fq.plumbing.water_heaters.repair_any_brand": {
   "it": [
    "Riparazione scaldacqua — qualsiasi marca o modello",
    "Riparazione di scaldacqua ad accumulo o istantaneo di qualunque marca, quotata a lavoro e non a ore."
   ],
   "de": [
    "Reparatur Warmwasserbereiter — jede Marke",
    "Reparatur von Speicher- oder Durchlauferhitzern jeder Marke, pro Auftrag statt nach Stunden berechnet."
   ],
   "uk": [
    "Ремонт водонагрівача — будь-яка марка",
    "Ремонт бакового чи проточного нагрівача будь-якої марки, ціна за роботу, а не погодинно."
   ],
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਮੁਰੰਮਤ — ਕੋਈ ਵੀ ਬ੍ਰਾਂਡ",
    "ਕਿਸੇ ਵੀ ਬ੍ਰਾਂਡ ਦੇ ਟੈਂਕ ਜਾਂ ਟੈਂਕ-ਰਹਿਤ ਹੀਟਰ ਦੀ ਮੁਰੰਮਤ, ਘੰਟੇ ਦੀ ਥਾਂ ਕੰਮ ਦੇ ਹਿਸਾਬ ਰੇਟ।"
   ],
   "tl": [
    "Pagkukumpuni ng water heater — anumang brand",
    "Pagkukumpuni ng tangke o tankless na heater ng anumang brand, presyo kada trabaho at hindi kada oras."
   ]
  },
  "fq.plumbing.water_heaters.symptom_no_hot_water": {
   "it": [
    "Niente acqua calda — diagnosi e riparazione",
    "Scaldacqua senza acqua calda: fiamma pilota, accenditore, resistenza, termostato o gas controllati e guasto riparato."
   ],
   "de": [
    "Kein Warmwasser — Diagnose und Reparatur",
    "Ein Speicher ohne Warmwasser: Zündflamme, Zünder, Heizstab, Thermostat oder Gasversorgung geprüft und der Fehler behoben."
   ],
   "uk": [
    "Немає гарячої води — діагностика й ремонт",
    "Нагрівач без гарячої води: запальник, ТЕН, термостат чи газ перевірено, несправність усунено."
   ],
   "pa": [
    "ਗਰਮ ਪਾਣੀ ਨਹੀਂ — ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ",
    "ਬਿਲਕੁਲ ਗਰਮ ਪਾਣੀ ਨਾ ਦੇਣ ਵਾਲਾ ਹੀਟਰ: ਪਾਇਲਟ, ਇਗਨਾਈਟਰ, ਐਲੀਮੈਂਟ, ਥਰਮੋਸਟੈਟ ਜਾਂ ਗੈਸ ਜਾਂਚ ਕੇ ਨੁਕਸ ਠੀਕ।"
   ],
   "tl": [
    "Walang mainit na tubig — diagnosis at pagkukumpuni",
    "Heater na walang mainit na tubig: sinuri ang pilot, igniter, element, thermostat o gas at inayos ang sira."
   ]
  },
  "fq.plumbing.water_heaters.symptom_not_hot_enough": {
   "it": [
    "Acqua non abbastanza calda — diagnosi e riparazione",
    "Acqua tiepida ricondotta a resistenza guasta, tubo pescante, termostato o sedimenti, e corretta."
   ],
   "de": [
    "Wasser nicht heiß genug — Diagnose und Reparatur",
    "Lauwarmes Wasser auf defekten Heizstab, Tauchrohr, Thermostateinstellung oder Ablagerungen zurückgeführt und behoben."
   ],
   "uk": [
    "Вода недостатньо гаряча — діагностика й ремонт",
    "Ледь теплу воду пов'язано з ТЕНом, трубкою, термостатом чи осадом і виправлено."
   ],
   "pa": [
    "ਪਾਣੀ ਕਾਫ਼ੀ ਗਰਮ ਨਹੀਂ — ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ",
    "ਕੋਸਾ ਪਾਣੀ ਖ਼ਰਾਬ ਐਲੀਮੈਂਟ, ਡਿੱਪ ਟਿਊਬ, ਥਰਮੋਸਟੈਟ ਜਾਂ ਗਾਰ ਤੱਕ ਲੱਭ ਕੇ ਠੀਕ।"
   ],
   "tl": [
    "Hindi sapat ang init ng tubig — diagnosis at pagkukumpuni",
    "Natunton sa sirang element, dip tube, setting ng thermostat o latak ang maligamgam na tubig at inayos."
   ]
  },
  "fq.plumbing.water_heaters.symptom_too_hot": {
   "it": [
    "Acqua troppo calda — diagnosi e riparazione",
    "Acqua ustionante ricondotta a termostato bloccato o miscelatrice guasta e messa in sicurezza."
   ],
   "de": [
    "Wasser zu heiß — Diagnose und Reparatur",
    "Verbrühend heißes Wasser auf klemmenden Thermostat oder defektes Mischventil zurückgeführt und sicher gemacht."
   ],
   "uk": [
    "Вода надто гаряча — діагностика й ремонт",
    "Окріп пов'язано із заклиненим термостатом чи змішувачем і зроблено безпечно."
   ],
   "pa": [
    "ਪਾਣੀ ਬਹੁਤ ਗਰਮ — ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ",
    "ਝੁਲਸਾਉਣ ਵਾਲਾ ਗਰਮ ਪਾਣੀ ਜਾਮ ਥਰਮੋਸਟੈਟ ਜਾਂ ਖ਼ਰਾਬ ਮਿਕਸਿੰਗ ਵਾਲਵ ਤੱਕ ਲੱਭ ਕੇ ਸੁਰੱਖਿਅਤ।"
   ],
   "tl": [
    "Sobrang init ng tubig — diagnosis at pagkukumpuni",
    "Natunton sa stuck na thermostat o sirang mixing valve ang napakainit na tubig at ginawang ligtas."
   ]
  },
  "fq.plumbing.water_heaters.symptom_noise": {
   "it": [
    "Scaldacqua rumoroso — diagnosi e riparazione",
    "Brontolii, schiocchi o fischi ricondotti a sedimenti, resistenza difettosa o valvola, e serbatoio spurgato o pezzo sostituito."
   ],
   "de": [
    "Lauter Warmwasserbereiter — Diagnose und Reparatur",
    "Rumpeln, Knacken oder Pfeifen auf Ablagerungen, einen schwachen Heizstab oder ein Ventil zurückgeführt, gespült oder Teil ersetzt."
   ],
   "uk": [
    "Шумний водонагрівач — діагностика й ремонт",
    "Гуркіт, клацання чи свист пов'язано з осадом, ТЕНом чи клапаном, бак промито чи деталь замінено."
   ],
   "pa": [
    "ਰੌਲਾ ਪਾਉਂਦਾ ਵਾਟਰ ਹੀਟਰ — ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ",
    "ਗੜਗੜਾਹਟ, ਪਟਾਕੇ ਜਾਂ ਸੀਟੀ ਗਾਰ, ਖ਼ਰਾਬ ਐਲੀਮੈਂਟ ਜਾਂ ਵਾਲਵ ਤੱਕ ਲੱਭੀ, ਟੈਂਕੀ ਫ਼ਲੱਸ਼ ਜਾਂ ਪੁਰਜ਼ਾ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Maingay na water heater — diagnosis at pagkukumpuni",
    "Natunton sa latak, sirang element o valve ang ugong, putok o sipol, at na-flush ang tangke o pinalitan ang piyesa."
   ]
  },
  "fq.plumbing.water_heaters.symptom_leaking": {
   "it": [
    "Scaldacqua che perde — diagnosi e riparazione",
    "Perdita a un raccordo, valvola o al serbatoio stesso individuata e riparata, o consigliata la sostituzione se il serbatoio ha ceduto."
   ],
   "de": [
    "Undichter Warmwasserbereiter — Diagnose und Reparatur",
    "Ein Leck an Fitting, Ventil oder Speicher selbst gefunden und behoben oder, bei defektem Speicher, ein Austausch empfohlen."
   ],
   "uk": [
    "Водонагрівач протікає — діагностика й ремонт",
    "Протікання на з'єднанні, клапані чи самому баку знайдено й усунено або рекомендовано заміну, якщо бак вийшов з ладу."
   ],
   "pa": [
    "ਲੀਕ ਹੁੰਦਾ ਵਾਟਰ ਹੀਟਰ — ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ",
    "ਫ਼ਿਟਿੰਗ, ਵਾਲਵ ਜਾਂ ਟੈਂਕੀ ਦਾ ਲੀਕ ਲੱਭ ਕੇ ਠੀਕ, ਜਾਂ ਟੈਂਕੀ ਖ਼ਰਾਬ ਹੋਵੇ ਤਾਂ ਬਦਲਣ ਦੀ ਸਲਾਹ।"
   ],
   "tl": [
    "Tumutulong water heater — diagnosis at pagkukumpuni",
    "Hinanap at inayos ang tagas sa fitting, valve o mismong tangke, o inirekomenda ang pagpapalit kung sira na ang tangke."
   ]
  },
  "fq.plumbing.water_heaters.symptom_water_condition": {
   "it": [
    "Acqua calda scolorita o maleodorante — diagnosi e riparazione",
    "Acqua calda arrugginita o con odore di uova marce ricondotta all'anodo o ai sedimenti, e anodo sostituito o serbatoio spurgato."
   ],
   "de": [
    "Verfärbtes oder riechendes Warmwasser — Diagnose und Reparatur",
    "Rostiges oder nach faulen Eiern riechendes Warmwasser auf Anode oder Ablagerungen zurückgeführt, Anode ersetzt oder gespült."
   ],
   "uk": [
    "Знебарвлена чи смердюча гаряча вода — діагностика й ремонт",
    "Іржаву чи з запахом тухлих яєць воду пов'язано з анодом чи осадом, анод замінено чи бак промито."
   ],
   "pa": [
    "ਰੰਗ ਬਦਲਿਆ ਜਾਂ ਬਦਬੂਦਾਰ ਗਰਮ ਪਾਣੀ — ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ",
    "ਜੰਗਾਲੀ ਜਾਂ ਸੜੇ ਅੰਡੇ ਵਰਗੀ ਬਦਬੂ ਵਾਲਾ ਪਾਣੀ ਐਨੋਡ ਰਾਡ ਜਾਂ ਗਾਰ ਤੱਕ ਲੱਭਿਆ, ਰਾਡ ਬਦਲੀ ਜਾਂ ਟੈਂਕੀ ਫ਼ਲੱਸ਼।"
   ],
   "tl": [
    "Kupas o mabahong mainit na tubig — diagnosis at pagkukumpuni",
    "Natunton sa anode rod o latak ang kalawangin o amoy-bulok na itlog na tubig, pinalitan ang rod o na-flush ang tangke."
   ]
  },
  "fq.plumbing.water_heaters.symptom_low_pressure": {
   "it": [
    "Bassa pressione dell'acqua calda — diagnosi e riparazione",
    "Flusso debole ricondotto a calcare, valvola semichiusa o linea ostruita, e liberato."
   ],
   "de": [
    "Niedriger Warmwasserdruck — Diagnose und Reparatur",
    "Schwacher Warmwasserfluss auf Kalk, ein halb geschlossenes Ventil oder eine verstopfte Leitung zurückgeführt und behoben."
   ],
   "uk": [
    "Слабкий тиск гарячої води — діагностика й ремонт",
    "Слабкий потік пов'язано з накипом, напівзакритим краном чи засміченою лінією й усунено."
   ],
   "pa": [
    "ਗਰਮ ਪਾਣੀ ਦਾ ਘੱਟ ਦਬਾਅ — ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ",
    "ਕਮਜ਼ੋਰ ਗਰਮ ਪਾਣੀ ਪੱਥਰੀ, ਅੱਧੇ ਬੰਦ ਵਾਲਵ ਜਾਂ ਬੰਦ ਲਾਈਨ ਤੱਕ ਲੱਭ ਕੇ ਖੋਲ੍ਹਿਆ।"
   ],
   "tl": [
    "Mahinang presyon ng mainit na tubig — diagnosis at pagkukumpuni",
    "Natunton sa kaliskis, halos saradong valve o baradong linya ang mahinang daloy at binuksan."
   ]
  },
  "fq.plumbing.water_heaters.symptom_no_hot_water_2": {
   "it": [
    "Niente acqua calda — visita di riparazione",
    "Visita per diagnosticare uno scaldacqua che ha smesso di dare acqua calda e ripararlo sul posto."
   ],
   "de": [
    "Kein Warmwasser — Reparaturtermin",
    "Ein Termin, um einen Speicher ohne Warmwasser zu diagnostizieren und vor Ort zu reparieren."
   ],
   "uk": [
    "Немає гарячої води — ремонтний візит",
    "Візит, щоб продіагностувати нагрівач без гарячої води й відремонтувати на місці."
   ],
   "pa": [
    "ਗਰਮ ਪਾਣੀ ਨਹੀਂ — ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਗਰਮ ਪਾਣੀ ਦੇਣਾ ਬੰਦ ਕਰ ਚੁੱਕੇ ਹੀਟਰ ਦੀ ਜਾਂਚ ਅਤੇ ਮੌਕੇ ਉੱਤੇ ਮੁਰੰਮਤ ਲਈ ਵਿਜ਼ਿਟ।"
   ],
   "tl": [
    "Walang mainit na tubig — visit sa pagkukumpuni",
    "Visit para suriin at ayusin sa lugar ang heater na tumigil sa pagbibigay ng mainit na tubig."
   ]
  }
 },
 "lines": {
  "Diagnostic visit": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਘਰ ਆ ਕੇ ਸਮੱਸਿਆ ਦਾ ਕਾਰਨ ਲੱਭਦਾ ਅਤੇ ਮੁਰੰਮਤ ਤੋਂ ਪਹਿਲਾਂ ਹੱਲ ਸਮਝਾਉਂਦਾ ਹੈ।"
   ]
  },
  "Leak detection labour": {
   "pa": [
    "ਲੀਕ ਲੱਭਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਸਰੋਤ ਲੱਭਣ ਤੱਕ ਦਬਾਅ ਟੈਸਟ, ਆਵਾਜ਼ ਜਾਂ ਗਰਮੀ ਨਾਲ ਖੋਜ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Pipe cleaning": {
   "pa": [
    "ਪਾਈਪ ਸਫ਼ਾਈ",
    "ਲਾਈਨ ਹਾਈਡ੍ਰੋ-ਜੈੱਟ ਜਾਂ ਕੇਬਲ ਨਾਲ ਸਾਫ਼ ਅਤੇ ਫ਼ਲੱਸ਼।"
   ]
  },
  "Service call and travel": {
   "pa": [
    "ਸਰਵਿਸ ਕਾਲ ਅਤੇ ਸਫ਼ਰ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਜਾਇਦਾਦ ਉੱਤੇ ਭੇਜਿਆ; ਸਫ਼ਰ ਅਤੇ ਸਮੱਸਿਆ ਦੀ ਪਹਿਲੀ ਜਾਂਚ ਸ਼ਾਮਲ।"
   ]
  },
  "Main line cabling": {
   "pa": [
    "ਮੁੱਖ ਲਾਈਨ ਕੇਬਲਿੰਗ",
    "ਕਲੀਨਆਊਟ ਤੋਂ ਸੜਕ ਤੱਕ ਮੁੱਖ ਲਾਈਨ ਡਰੰਮ ਮਸ਼ੀਨ ਨਾਲ ਖੁੱਲ੍ਹਣ ਤੱਕ ਕੇਬਲ।"
   ]
  },
  "Single-fixture drain clearing": {
   "pa": [
    "ਇੱਕ ਫ਼ਿਕਸਚਰ ਦੀ ਡਰੇਨ ਖੋਲ੍ਹਣਾ",
    "ਹੱਥ ਜਾਂ ਛੋਟੀ ਡਰੰਮ ਕੇਬਲ ਨਾਲ ਰੁਕਾਵਟ ਹਟਾਈ ਅਤੇ ਪੂਰਾ ਵਹਾਅ ਜਾਂਚਿਆ।"
   ]
  },
  "Trap and tailpiece washers": {
   "pa": [
    "ਟ੍ਰੈਪ ਅਤੇ ਟੇਲਪੀਸ ਵਾੱਸ਼ਰ",
    "ਟ੍ਰੈਪ ਖੋਲ੍ਹਣ ਵਾਲੀ ਥਾਂ ਨਵੇਂ ਵਾੱਸ਼ਰ ਤਾਂ ਜੋ ਬਿਨਾਂ ਟਪਕੇ ਮੁੜ ਜੁੜੇ।"
   ]
  },
  "Unclog toilet": {
   "pa": [
    "ਟਾਇਲਟ ਖੋਲ੍ਹਣਾ",
    "ਕਲੋਜ਼ੈੱਟ ਔਗਰ ਨਾਲ ਰੁਕਾਵਟ ਹਟਾਈ ਅਤੇ ਫ਼ਲੱਸ਼ ਜਾਂਚਿਆ।"
   ]
  },
  "Camera inspection": {
   "pa": [
    "ਕੈਮਰਾ ਜਾਂਚ",
    "ਲੋਕੇਟਿੰਗ ਕੈਮਰੇ ਨਾਲ ਲਾਈਨ ਦੇਖੀ, ਨੁਕਸ ਦੀ ਥਾਂ ਜ਼ਮੀਨ ਉੱਤੇ ਨਿਸ਼ਾਨ ਅਤੇ ਫੁਟੇਜ ਰੱਖੀ।"
   ]
  },
  "Written report with photos": {
   "pa": [
    "ਫ਼ੋਟੋਆਂ ਸਮੇਤ ਲਿਖਤੀ ਰਿਪੋਰਟ",
    "ਨਤੀਜੇ ਫ਼ੋਟੋਆਂ ਨਾਲ ਦਰਜ ਅਤੇ ਤਰਜੀਹ ਅਨੁਸਾਰ ਸਲਾਹਾਂ ਦੀ ਸੂਚੀ।"
   ]
  },
  "Root treatment application": {
   "pa": [
    "ਜੜ੍ਹ ਇਲਾਜ ਲਾਉਣਾ",
    "ਲਾਈਨ ਖੁੱਲ੍ਹਣ ਤੋਂ ਬਾਅਦ ਕਲੀਨਆਊਟ ਰਾਹੀਂ ਝੱਗ ਵਾਲੀ ਜੜ੍ਹ-ਰੋਕੂ ਦਵਾਈ।"
   ]
  },
  "Foaming root inhibitor": {
   "pa": [
    "ਝੱਗ ਵਾਲੀ ਜੜ੍ਹ-ਰੋਕੂ ਦਵਾਈ",
    "ਘਰੇਲੂ ਮੁੱਖ ਲਾਈਨ ਲਈ ਝੱਗ ਵਾਲੀ ਜੜ੍ਹ-ਨਾਸ਼ਕ ਦੀ ਇੱਕ ਖੁਰਾਕ।"
   ]
  },
  "Dryer vent cleaning": {
   "pa": [
    "ਡ੍ਰਾਇਰ ਵੈਂਟ ਦੀ ਸਫ਼ਾਈ",
    "ਡ੍ਰਾਇਰ ਤੋਂ ਬਾਹਰਲੇ ਹੁੱਡ ਤੱਕ ਪੂਰੀ ਲਾਈਨ ਬੁਰਸ਼ ਅਤੇ ਵੈਕਿਊਮ, ਬਾਅਦ ਵਿੱਚ ਹਵਾ ਮਾਪੀ।"
   ]
  },
  "Foil transition duct and clamps": {
   "pa": [
    "ਫ਼ੌਇਲ ਜੋੜ ਡਕਟ ਅਤੇ ਕਲੈਂਪ",
    "ਡ੍ਰਾਇਰ ਪਿੱਛੇ ਨਵੀਂ ਜੋੜ ਡਕਟ ਜਦੋਂ ਪੁਰਾਣੀ ਦੱਬੀ ਜਾਂ ਰੂੰ ਨਾਲ ਭਰੀ ਹੋਵੇ।"
   ]
  },
  "Toilet repair labour": {
   "pa": [
    "ਟਾਇਲਟ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਚੱਲਦਾ, ਲੀਕ ਜਾਂ ਕਮਜ਼ੋਰ ਫ਼ਲੱਸ਼ ਜਾਂਚ ਕੇ ਟੈਂਕੀ ਦੇ ਘਿਸੇ ਪੁਰਜ਼ੇ ਬਦਲੇ।"
   ]
  },
  "Fill valve and flapper kit": {
   "pa": [
    "ਫ਼ਿੱਲ ਵਾਲਵ ਅਤੇ ਫ਼ਲੈਪਰ ਕਿੱਟ",
    "ਯੂਨੀਵਰਸਲ ਫ਼ਿੱਲ ਵਾਲਵ ਅਤੇ ਫ਼ਲੈਪਰ, ਸਭ ਤੋਂ ਵੱਧ ਖ਼ਰਾਬ ਹੋਣ ਵਾਲੇ ਦੋ ਪੁਰਜ਼ੇ।"
   ]
  },
  "Faucet replacement labour": {
   "pa": [
    "ਟੂਟੀ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣੀ ਟੂਟੀ ਕੱਢੀ, ਥਾਂ ਸਾਫ਼, ਗਾਹਕ ਦੀ ਟੂਟੀ ਲਾਈ, ਜੋੜੀ ਅਤੇ ਲੀਕ ਲਈ ਜਾਂਚੀ।"
   ]
  },
  "Braided supply line": {
   "pa": [
    "ਬ੍ਰੇਡਡ ਸਪਲਾਈ ਲਾਈਨ",
    "ਸਟੇਨਲੈੱਸ ਬ੍ਰੇਡਡ ਸਪਲਾਈ ਲਾਈਨ, 20 ਇੰਚ, ਗਰਮ ਜਾਂ ਠੰਢੀ।"
   ]
  },
  "Old toilet removal and disposal": {
   "pa": [
    "ਪੁਰਾਣਾ ਟਾਇਲਟ ਹਟਾਉਣਾ ਅਤੇ ਨਿਪਟਾਰਾ",
    "ਪੁਰਾਣਾ ਟਾਇਲਟ ਲਾਹ ਕੇ ਕੱਢਿਆ ਅਤੇ ਲਿਜਾਇਆ।"
   ]
  },
  "New toilet installation": {
   "pa": [
    "ਨਵਾਂ ਟਾਇਲਟ ਲਾਉਣਾ",
    "ਫ਼ਲੈਂਜ ਜਾਂਚਿਆ, ਨਵਾਂ ਟਾਇਲਟ ਤਾਜ਼ੀ ਵੈਕਸ ਰਿੰਗ ਉੱਤੇ ਰੱਖ ਕੇ ਜੋੜਿਆ ਅਤੇ ਜਾਂਚਿਆ।"
   ]
  },
  "High-efficiency toilet — standard": {
   "pa": [
    "ਉੱਚ-ਕੁਸ਼ਲਤਾ ਟਾਇਲਟ — ਆਮ",
    "ਲੰਮਾ, ਆਰਾਮਦਾਇਕ ਉਚਾਈ ਵਾਲਾ ਦੋ-ਹਿੱਸੇ ਟਾਇਲਟ, 1.28 gpf, ਹੌਲੀ ਬੰਦ ਹੋਣ ਵਾਲੀ ਸੀਟ।"
   ]
  },
  "Water line installation — per linear ft": {
   "pa": [
    "ਪਾਣੀ ਲਾਈਨ ਲਾਉਣਾ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "PEX ਲਾਈਨ, ਸਹਾਰੇ ਨਾਲ, ਦੋਵੇਂ ਸਿਰੇ ਜੋੜੇ ਅਤੇ ਦਬਾਅ ਟੈਸਟ।"
   ]
  },
  "1/2 in PEX — per coil": {
   "pa": [
    "1/2 ਇੰਚ PEX — ਪ੍ਰਤੀ ਕੌਇਲ",
    "PEX-B ਟਿਊਬਿੰਗ, 100 ਫੁੱਟ ਕੌਇਲ।"
   ]
  },
  "Fasteners, sealant and consumables": {
   "pa": [
    "ਪੇਚ, ਸੀਲੈਂਟ ਅਤੇ ਖਪਤ ਵਾਲਾ ਸਮਾਨ",
    "ਪੇਚ, ਐਂਕਰ, ਸੀਲੈਂਟ, ਟੇਪ ਅਤੇ ਕੰਮ ਵਿੱਚ ਲੱਗਣ ਵਾਲੇ ਛੋਟੇ ਪੁਰਜ਼ੇ।"
   ]
  },
  "Leak repair labour": {
   "pa": [
    "ਲੀਕ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਲੀਕ ਵਾਲਾ ਹਿੱਸਾ ਕੱਟ ਕੇ ਬਦਲਿਆ ਜਾਂ ਫ਼ਿਟਿੰਗ ਮੁੜ ਬਣਾਈ, ਲਾਈਨ ਦਬਾਅ ਟੈਸਟ।"
   ]
  },
  "Pipe, fittings and solder": {
   "pa": [
    "ਪਾਈਪ, ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਸੋਲਡਰ",
    "ਮੁਰੰਮਤ ਲਈ ਤਾਂਬਾ ਜਾਂ PEX, ਫ਼ਿਟਿੰਗਾਂ, ਸੋਲਡਰ ਜਾਂ ਕ੍ਰਿੰਪ ਰਿੰਗ।"
   ]
  },
  "Tank rebuild labour": {
   "pa": [
    "ਟੈਂਕੀ ਮੁੜ ਉਸਾਰੀ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਟੈਂਕੀ ਖ਼ਾਲੀ, ਫ਼ਲੈਪਰ ਅਤੇ ਫ਼ਿੱਲ ਵਾਲਵ ਬਦਲੇ, ਪਾਣੀ ਦਾ ਪੱਧਰ ਸੈੱਟ ਅਤੇ ਫ਼ਲੱਸ਼ ਜਾਂਚਿਆ।"
   ]
  },
  "Filter change and system check": {
   "pa": [
    "ਫ਼ਿਲਟਰ ਬਦਲੀ ਅਤੇ ਸਿਸਟਮ ਜਾਂਚ",
    "ਹਰ ਕਾਰਟ੍ਰਿਜ ਬਦਲਿਆ, ਹਾਊਸਿੰਗ ਕੀਟਾਣੂ-ਰਹਿਤ, ਸਿਸਟਮ ਮੁੜ ਦਬਾਅ ਵਿੱਚ ਅਤੇ ਲੀਕ ਜਾਂਚ।"
   ]
  },
  "Filter cartridge set": {
   "pa": [
    "ਫ਼ਿਲਟਰ ਕਾਰਟ੍ਰਿਜ ਸੈੱਟ",
    "ਆਮ ਸਿੰਕ-ਹੇਠ ਸਿਸਟਮ ਲਈ ਸੈਡੀਮੈਂਟ, ਕਾਰਬਨ ਅਤੇ ਝਿੱਲੀ ਕਾਰਟ੍ਰਿਜ।"
   ]
  },
  "Removal and disposal of the old unit": {
   "pa": [
    "ਪੁਰਾਣੇ ਯੂਨਿਟ ਨੂੰ ਹਟਾਉਣਾ ਅਤੇ ਨਿਪਟਾਉਣਾ",
    "ਮੌਜੂਦਾ ਯੂਨਿਟ ਦਾ ਕਨੈਕਸ਼ਨ ਕੱਟ ਕੇ ਹਟਾਇਆ ਅਤੇ ਨਿਪਟਾਰੇ ਲਈ ਲਿਜਾਇਆ ਜਾਂਦਾ ਹੈ।"
   ]
  },
  "Water heater installation labour": {
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਨਵੀਂ ਟੈਂਕੀ ਰੱਖੀ, ਨਵੇਂ ਫ਼ਲੈਕਸ ਕਨੈਕਟਰਾਂ ਨਾਲ ਜੋੜੀ, ਤਾਰਾਂ ਜੋੜੀਆਂ ਅਤੇ ਤਾਪਮਾਨ ਤੱਕ ਗਰਮ।"
   ]
  },
  "50-gallon electric water heater": {
   "pa": [
    "50-ਗੈਲਨ ਬਿਜਲੀ ਵਾਟਰ ਹੀਟਰ",
    "ਆਮ ਕੁਸ਼ਲਤਾ ਵਾਲੀ 50-ਗੈਲਨ ਬਿਜਲੀ ਟੈਂਕੀ, 4500 W ਐਲੀਮੈਂਟ, 6 ਸਾਲ ਟੈਂਕੀ ਵਾਰੰਟੀ।"
   ]
  },
  "Drain pan, expansion tank and connectors": {
   "pa": [
    "ਡਰੇਨ ਪੈਨ, ਐਕਸਪੈਂਸ਼ਨ ਟੈਂਕੀ ਅਤੇ ਕਨੈਕਟਰ",
    "ਐਲੂਮੀਨੀਅਮ ਡਰੇਨ ਪੈਨ, ਥਰਮਲ ਐਕਸਪੈਂਸ਼ਨ ਟੈਂਕੀ ਅਤੇ ਦੋ ਸਟੇਨਲੈੱਸ ਫ਼ਲੈਕਸ ਕਨੈਕਟਰ।"
   ]
  },
  "Tankless installation labour": {
   "pa": [
    "ਟੈਂਕ-ਰਹਿਤ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਯੂਨਿਟ ਲਾਇਆ, ਲੋੜ ਹੋਵੇ ਤਾਂ ਗੈਸ ਲਾਈਨ ਵੱਡੀ, ਵੈਂਟ ਅਤੇ ਕੰਡੈਂਸੇਟ ਲਾਈਨ ਅਤੇ ਸਿਸਟਮ ਚਾਲੂ।"
   ]
  },
  "Condensing tankless water heater — 199,000 BTU": {
   "pa": [
    "ਕੰਡੈਂਸਿੰਗ ਟੈਂਕ-ਰਹਿਤ ਵਾਟਰ ਹੀਟਰ — 199,000 BTU",
    "ਆਈਸੋਲੇਸ਼ਨ ਵਾਲਵ ਕਿੱਟ ਸਮੇਤ ਕੰਡੈਂਸਿੰਗ ਗੈਸ ਟੈਂਕ-ਰਹਿਤ ਯੂਨਿਟ, 199,000 BTU।"
   ]
  },
  "Venting, gas fittings and condensate kit": {
   "pa": [
    "ਵੈਂਟ, ਗੈਸ ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਕੰਡੈਂਸੇਟ ਕਿੱਟ",
    "PVC ਜਾਂ ਪੌਲੀਪ੍ਰੋਪਲੀਨ ਵੈਂਟ ਕਿੱਟ, ਗੈਸ ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਕੰਡੈਂਸੇਟ ਨਿਊਟ੍ਰਲਾਈਜ਼ਰ।"
   ]
  },
  "Burner service and tank flush": {
   "pa": [
    "ਬਰਨਰ ਸਰਵਿਸ ਅਤੇ ਟੈਂਕੀ ਫ਼ਲੱਸ਼",
    "ਬਰਨਰ ਸਾਫ਼ ਅਤੇ ਸੈੱਟ, ਟੈਂਕੀ ਵਿੱਚੋਂ ਗਾਰ ਫ਼ਲੱਸ਼ ਅਤੇ ਐਨੋਡ ਜਾਂਚਿਆ।"
   ]
  },
  "Thermocouple": {
   "pa": [
    "ਥਰਮੋਕਪਲ",
    "ਯੂਨੀਵਰਸਲ ਥਰਮੋਕਪਲ, ਜੇ ਪਾਇਲਟ ਨਾ ਟਿਕੇ ਤਾਂ ਲਾਇਆ।"
   ]
  },
  "Premium dual-flush toilet": {
   "pa": [
    "ਪ੍ਰੀਮੀਅਮ ਡੂਅਲ-ਫ਼ਲੱਸ਼ ਟਾਇਲਟ",
    "ਹੌਲੀ ਬੰਦ ਹੋਣ ਵਾਲੀ ਸੀਟ ਨਾਲ ਡੂਅਲ-ਫ਼ਲੱਸ਼, ਆਰਾਮਦਾਇਕ ਉਚਾਈ ਵਾਲਾ ਇੱਕ-ਹਿੱਸਾ ਟਾਇਲਟ।"
   ]
  },
  "Water heater repair labour": {
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਹੀਟਰ ਦਾ ਨੁਕਸ ਲੱਭਣਾ ਅਤੇ ਮੁਰੰਮਤ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Water heater repair parts": {
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਦੇ ਮੁਰੰਮਤ ਪੁਰਜ਼ੇ",
    "ਜਾਂਚ ਮੁਤਾਬਕ ਐਲੀਮੈਂਟ, ਥਰਮੋਸਟੈਟ, ਥਰਮੋਕਪਲ, ਇਗਨਾਈਟਰ ਜਾਂ ਵਾਲਵ।"
   ]
  },
  "Drain clearing labour": {
   "pa": [
    "ਡਰੇਨ ਖੋਲ੍ਹਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਲਾਈਨ ਮੁਤਾਬਕ ਕੇਬਲ ਜਾਂ ਔਗਰ ਨਾਲ ਰੁਕਾਵਟ ਹਟਾਈ ਅਤੇ ਵਹਾਅ ਜਾਂਚਿਆ।"
   ]
  },
  "Tailpiece replacement labour": {
   "pa": [
    "ਟੇਲਪੀਸ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਸਿੰਕ ਹੇਠੋਂ ਪੁਰਾਣਾ ਟੇਲਪੀਸ ਲਾਹਿਆ, ਨਵਾਂ ਲਾਇਆ ਅਤੇ ਡਿਸ਼ਵਾਸ਼ਰ ਚਲਾ ਕੇ ਟਪਕਾ ਜਾਂਚਿਆ।"
   ]
  },
  "Brass dishwasher tailpiece": {
   "pa": [
    "ਪਿੱਤਲ ਦਾ ਡਿਸ਼ਵਾਸ਼ਰ ਟੇਲਪੀਸ",
    "ਡਿਸ਼ਵਾਸ਼ਰ ਇਨਲੈੱਟ, ਵਾੱਸ਼ਰ ਅਤੇ ਸਲਿੱਪ ਨੱਟ ਸਮੇਤ ਪਿੱਤਲ ਦਾ ਟੇਲਪੀਸ।"
   ]
  },
  "Garbage disposal removal": {
   "pa": [
    "ਗਾਰਬੇਜ ਡਿਸਪੋਜ਼ਲ ਹਟਾਉਣਾ",
    "ਡਿਸਪੋਜ਼ਲ ਦਾ ਕਨੈਕਸ਼ਨ ਕੱਟਿਆ, ਮਾਊਂਟ ਤੋਂ ਲਾਹਿਆ ਅਤੇ ਲਿਜਾਇਆ।"
   ]
  },
  "Strainer and drain conversion labour": {
   "pa": [
    "ਸਟ੍ਰੇਨਰ ਅਤੇ ਡਰੇਨ ਬਦਲੀ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਸਿੰਕ ਵਿੱਚ ਸਟ੍ਰੇਨਰ ਬਾਸਕਟ ਲਾਈ ਅਤੇ ਡਰੇਨ ਆਮ ਟ੍ਰੈਪ ਨਾਲ ਮੁੜ ਜੋੜੀ।"
   ]
  },
  "Strainer basket, tailpiece and trap": {
   "pa": [
    "ਸਟ੍ਰੇਨਰ ਬਾਸਕਟ, ਟੇਲਪੀਸ ਅਤੇ ਟ੍ਰੈਪ",
    "ਸਟੇਨਲੈੱਸ ਸਟ੍ਰੇਨਰ ਬਾਸਕਟ, ਟੇਲਪੀਸ, ਟ੍ਰੈਪ ਅਤੇ ਸਲਿੱਪ-ਜੋੜ ਵਾੱਸ਼ਰ।"
   ]
  },
  "Trap and tailpiece replacement labour": {
   "pa": [
    "ਟ੍ਰੈਪ ਅਤੇ ਟੇਲਪੀਸ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣਾ ਟ੍ਰੈਪ ਅਤੇ ਟੇਲਪੀਸ ਕੱਢੇ, ਨਵੇਂ ਲਾਏ ਅਤੇ ਡਿਸ਼ਵਾਸ਼ਰ ਡਰੇਨ ਲੀਕ ਲਈ ਜਾਂਚੀ।"
   ]
  },
  "Trap and dishwasher tailpiece kit": {
   "pa": [
    "ਟ੍ਰੈਪ ਅਤੇ ਡਿਸ਼ਵਾਸ਼ਰ ਟੇਲਪੀਸ ਕਿੱਟ",
    "P-ਟ੍ਰੈਪ, ਡਿਸ਼ਵਾਸ਼ਰ ਟੇਲਪੀਸ, ਸਲਿੱਪ ਨੱਟ ਅਤੇ ਵਾੱਸ਼ਰ।"
   ]
  },
  "Supply line installation and leak test": {
   "pa": [
    "ਸਪਲਾਈ ਲਾਈਨ ਲਾਉਣਾ ਅਤੇ ਲੀਕ ਟੈਸਟ",
    "ਸਪਲਾਈ ਸਟੌਪ ਅਤੇ ਉਪਕਰਣ ਨਾਲ ਜੋੜੀ ਅਤੇ ਦਬਾਅ ਹੇਠ ਰੱਖ ਕੇ ਲੀਕ ਨਾ ਹੋਣ ਦੀ ਪੁਸ਼ਟੀ।"
   ]
  },
  "Braided dishwasher supply line": {
   "pa": [
    "ਬ੍ਰੇਡਡ ਡਿਸ਼ਵਾਸ਼ਰ ਸਪਲਾਈ ਲਾਈਨ",
    "90° ਐਲਬੋ ਸਮੇਤ ਸਟੇਨਲੈੱਸ ਬ੍ਰੇਡਡ ਡਿਸ਼ਵਾਸ਼ਰ ਕਨੈਕਟਰ।"
   ]
  },
  "Septic tank pump-out — up to 1,000 gallons": {
   "pa": [
    "ਸੈਪਟਿਕ ਟੈਂਕ ਖ਼ਾਲੀ ਕਰਨਾ — 1,000 ਗੈਲਨ ਤੱਕ",
    "ਢੱਕਣ ਰਾਹੀਂ ਟੈਂਕ ਪੂਰਾ ਖ਼ਾਲੀ ਅਤੇ ਅੰਦਰ-ਬਾਹਰ ਦੇ ਬੈਫ਼ਲ ਜਾਂਚੇ।"
   ]
  },
  "Locating and uncovering the lid": {
   "pa": [
    "ਢੱਕਣ ਲੱਭਣਾ ਅਤੇ ਨੰਗਾ ਕਰਨਾ",
    "ਟੈਂਕ ਦਾ ਢੱਕਣ ਲੱਭ ਕੇ ਪੁੱਟਿਆ ਤਾਂ ਜੋ ਟਰੱਕ ਪਹੁੰਚ ਸਕੇ।"
   ]
  },
  "Septage disposal fee": {
   "pa": [
    "ਸੈਪਟੇਜ ਨਿਪਟਾਰਾ ਫ਼ੀਸ",
    "ਕੱਢੇ ਗੰਦ ਲਈ ਟ੍ਰੀਟਮੈਂਟ ਪਲਾਂਟ ਦੀ ਫ਼ੀਸ, ਲਾਗਤ ਮੁੱਲ 'ਤੇ।"
   ]
  },
  "Grease trap pump-out and wash": {
   "pa": [
    "ਗਰੀਸ ਟ੍ਰੈਪ ਖ਼ਾਲੀ ਕਰਨਾ ਅਤੇ ਧੋਣਾ",
    "ਇੰਟਰਸੈਪਟਰ ਖ਼ਾਲੀ, ਖੁਰਚਿਆ ਅਤੇ ਪ੍ਰੈਸ਼ਰ ਨਾਲ ਧੋਤਾ, ਬੈਫ਼ਲ ਜਾਂਚੇ।"
   ]
  },
  "Grease waste disposal fee": {
   "pa": [
    "ਗਰੀਸ ਕਚਰਾ ਨਿਪਟਾਰਾ ਫ਼ੀਸ",
    "ਲਾਇਸੈਂਸ ਵਾਲੀ ਥਾਂ 'ਤੇ ਗਰੀਸ ਅਤੇ ਠੋਸ ਕਚਰੇ ਦਾ ਨਿਪਟਾਰਾ, ਲਾਗਤ ਮੁੱਲ 'ਤੇ।"
   ]
  },
  "Ice machine descale and sanitise": {
   "pa": [
    "ਆਈਸ ਮਸ਼ੀਨ ਦੀ ਡੀਸਕੇਲਿੰਗ ਅਤੇ ਸੈਨੀਟਾਈਜ਼",
    "ਮਸ਼ੀਨ ਖ਼ਾਲੀ, ਡੀਸਕੇਲ, ਅੰਦਰੋਂ-ਬਾਹਰੋਂ ਸੈਨੀਟਾਈਜ਼ ਅਤੇ ਨਵੀਂ ਬਰਫ਼ ਬਣਾ ਕੇ ਜਾਂਚੀ।"
   ]
  },
  "Descaler and sanitiser": {
   "pa": [
    "ਡੀਸਕੇਲਰ ਅਤੇ ਸੈਨੀਟਾਈਜ਼ਰ",
    "ਇੱਕ ਮਸ਼ੀਨ ਲਈ ਨਿੱਕਲ-ਸੁਰੱਖਿਅਤ ਡੀਸਕੇਲਰ ਅਤੇ ਖਾਣ-ਯੋਗ ਸੈਨੀਟਾਈਜ਼ਰ।"
   ]
  },
  "Ice machine drain clearing": {
   "pa": [
    "ਆਈਸ ਮਸ਼ੀਨ ਦੀ ਡਰੇਨ ਖੋਲ੍ਹਣਾ",
    "ਡਰੇਨ ਲਾਈਨ ਅਤੇ ਏਅਰ ਗੈਪ ਵਿੱਚੋਂ ਚਿਕਨਾਈ ਹਟਾਈ ਤਾਂ ਜੋ ਮਸ਼ੀਨ ਖੁੱਲ੍ਹ ਕੇ ਖ਼ਾਲੀ ਹੋਵੇ।"
   ]
  },
  "Kitchen line cabling": {
   "pa": [
    "ਰਸੋਈ ਲਾਈਨ ਕੇਬਲਿੰਗ",
    "ਟ੍ਰੈਪ ਤੋਂ ਸਟੈਕ ਤੱਕ ਰਸੋਈ ਲਾਈਨ ਕੇਬਲ ਅਤੇ ਗਰਮ ਪਾਣੀ ਨਾਲ ਫ਼ਲੱਸ਼।"
   ]
  },
  "Hydro-jetting labour": {
   "pa": [
    "ਹਾਈਡ੍ਰੋ-ਜੈਟਿੰਗ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਕਲੀਨਆਊਟ ਤੋਂ ਮੁੱਖ ਲਾਈਨ ਤੱਕ ਤੇਜ਼ ਦਬਾਅ ਵਾਲੇ ਪਾਣੀ ਨਾਲ ਸਫ਼ਾਈ; ਗਰੀਸ, ਪਪੜੀ ਅਤੇ ਜੜ੍ਹਾਂ ਵਹਾਈਆਂ।"
   ]
  },
  "Drain machine equipment fee": {
   "pa": [
    "ਡਰੇਨ ਮਸ਼ੀਨ ਉਪਕਰਣ ਫ਼ੀਸ",
    "ਇਸ ਕੰਮ ਵਿੱਚ ਮਸ਼ੀਨ, ਕੇਬਲ ਅਤੇ ਕਟਿੰਗ ਹੈੱਡਾਂ ਦੀ ਘਸਾਈ।"
   ]
  },
  "Camera check after cleaning": {
   "pa": [
    "ਸਫ਼ਾਈ ਤੋਂ ਬਾਅਦ ਕੈਮਰਾ ਜਾਂਚ",
    "ਸਫ਼ਾਈ ਮਗਰੋਂ ਲਾਈਨ ਵਿੱਚ ਕੈਮਰਾ ਪਾ ਕੇ ਖੁੱਲ੍ਹੀ ਹੋਣ ਦੀ ਪੁਸ਼ਟੀ ਅਤੇ ਹਾਲਤ ਦਿਖਾਈ।"
   ]
  },
  "Hand-auger drain clearing": {
   "pa": [
    "ਹੱਥ ਔਗਰ ਨਾਲ ਡਰੇਨ ਖੋਲ੍ਹਣਾ",
    "ਹੱਥ ਔਗਰ ਨਾਲ ਟੱਬ ਜਾਂ ਸ਼ਾਵਰ ਡਰੇਨ ਵਿੱਚੋਂ ਵਾਲ ਅਤੇ ਸਾਬਣ ਕੱਢਿਆ, ਬਿਨਾਂ ਕੈਮੀਕਲ।"
   ]
  },
  "Main line clearing — large drum machine": {
   "pa": [
    "ਮੁੱਖ ਲਾਈਨ ਖੋਲ੍ਹਣਾ — ਵੱਡੀ ਡਰੰਮ ਮਸ਼ੀਨ",
    "ਕਲੀਨਆਊਟ ਤੋਂ ਵੱਡੀ ਡਰੰਮ ਮਸ਼ੀਨ ਅਤੇ ਪਾਈਪ ਦੇ ਨਾਪ ਦੇ ਕਟਿੰਗ ਹੈੱਡ ਨਾਲ ਮੁੱਖ ਲਾਈਨ ਕੇਬਲ।"
   ]
  },
  "Sink line jetting": {
   "pa": [
    "ਸਿੰਕ ਲਾਈਨ ਜੈਟਿੰਗ",
    "ਛੋਟੇ ਬਿਜਲਈ ਜੈਟਰ ਨਾਲ ਟ੍ਰੈਪ ਤੋਂ ਸਟੈਕ ਤੱਕ ਸਿੰਕ ਲਾਈਨ ਧੋਤੀ।"
   ]
  },
  "Branch line clearing — small drum machine": {
   "pa": [
    "ਬ੍ਰਾਂਚ ਲਾਈਨ ਖੋਲ੍ਹਣਾ — ਛੋਟੀ ਡਰੰਮ ਮਸ਼ੀਨ",
    "ਬਾਥਰੂਮ ਜਾਂ ਲਾਂਡਰੀ ਦੀ ਲਾਈਨ ਪਤਲੀ ਪਾਈਪ ਵਿੱਚ ਜਾਣ ਵਾਲੀ ਛੋਟੀ ਡਰੰਮ ਮਸ਼ੀਨ ਨਾਲ ਖੋਲ੍ਹੀ।"
   ]
  },
  "Faucet removal and installation labour": {
   "pa": [
    "ਟੂਟੀ ਲਾਹੁਣ ਅਤੇ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣੀ ਟੂਟੀ ਕੱਢੀ, ਥਾਂ ਸਾਫ਼, ਨਵੀਂ ਲਾਈ, ਜੋੜੀ ਅਤੇ ਲੀਕ ਲਈ ਜਾਂਚੀ।"
   ]
  },
  "Two-handle faucet": {
   "pa": [
    "ਦੋ-ਹੈਂਡਲ ਟੂਟੀ",
    "ਕ੍ਰੋਮ ਜਾਂ ਬ੍ਰੱਸ਼ਡ ਨਿੱਕਲ ਵਿੱਚ ਦਰਮਿਆਨੇ ਦਰਜੇ ਦੀ ਦੋ-ਹੈਂਡਲ ਟੂਟੀ।"
   ]
  },
  "Faucet rebuild labour": {
   "pa": [
    "ਟੂਟੀ ਮੁੜ ਠੀਕ ਕਰਨ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਟੂਟੀ ਖੋਲ੍ਹੀ, ਘਿਸੇ ਵਾੱਸ਼ਰ ਅਤੇ ਸੀਟਾਂ ਬਦਲੀਆਂ ਅਤੇ ਹੈਂਡਲ ਮੁੜ ਲਾਏ।"
   ]
  },
  "Washer and seat kit": {
   "pa": [
    "ਵਾੱਸ਼ਰ ਅਤੇ ਸੀਟ ਕਿੱਟ",
    "ਟੂਟੀ ਮੁਤਾਬਕ ਸੀਟ ਵਾੱਸ਼ਰ, ਸੀਟਾਂ, O-ਰਿੰਗ ਅਤੇ ਪੇਚ।"
   ]
  },
  "Aerator replacement labour": {
   "pa": [
    "ਏਰੇਟਰ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਜਾਮ ਏਰੇਟਰ ਕੱਢਿਆ, ਟੂਟੀ ਦੀਆਂ ਚੂੜੀਆਂ ਸਾਫ਼ ਅਤੇ ਨਵਾਂ ਏਰੇਟਰ ਲਾਇਆ।"
   ]
  },
  "Faucet aerator": {
   "pa": [
    "ਟੂਟੀ ਏਰੇਟਰ",
    "ਟੂਟੀ ਦੀ ਚੂੜੀ ਮੁਤਾਬਕ ਘੱਟ-ਵਹਾਅ ਏਰੇਟਰ।"
   ]
  },
  "Single-lever faucet": {
   "pa": [
    "ਇੱਕ-ਲੀਵਰ ਟੂਟੀ",
    "ਸਿਰੈਮਿਕ ਕਾਰਟ੍ਰਿਜ ਵਾਲੀ ਦਰਮਿਆਨੇ ਦਰਜੇ ਦੀ ਇੱਕ-ਲੀਵਰ ਟੂਟੀ।"
   ]
  },
  "Appliance hook-up labour": {
   "pa": [
    "ਉਪਕਰਣ ਜੋੜਨ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਗਾਹਕ ਦੀਆਂ ਹੋਜ਼ਾਂ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ ਨਾਲ ਉਪਕਰਣ ਜੋੜਿਆ, ਪੱਧਰਾ ਕੀਤਾ ਅਤੇ ਚਲਾ ਕੇ ਲੀਕ ਜਾਂਚੀ।"
   ]
  },
  "Appliance disconnect and reconnect labour": {
   "pa": [
    "ਉਪਕਰਣ ਲਾਹੁਣ ਅਤੇ ਮੁੜ ਜੋੜਨ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਉਪਕਰਣ ਲਾਹਿਆ, ਹਿਲਾਇਆ, ਪੁਰਾਣੇ ਪੁਰਜ਼ਿਆਂ ਨਾਲ ਮੁੜ ਜੋੜਿਆ ਅਤੇ ਚਲਾ ਕੇ ਲੀਕ ਜਾਂਚੀ।"
   ]
  },
  "Vent hood replacement labour": {
   "pa": [
    "ਵੈਂਟ ਹੁੱਡ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣਾ ਹੁੱਡ ਕੱਟ ਕੇ ਕੱਢਿਆ, ਨਵਾਂ ਕੰਧ ਰਾਹੀਂ ਡਕਟ ਨਾਲ ਜੋੜਿਆ ਅਤੇ ਸਾਈਡਿੰਗ ਨਾਲ ਸੀਲ ਕੀਤਾ।"
   ]
  },
  "Exterior dryer vent hood": {
   "pa": [
    "ਬਾਹਰਲਾ ਡ੍ਰਾਇਰ ਵੈਂਟ ਹੁੱਡ",
    "ਡਕਟ ਦੇ ਨਾਪ ਦੇ ਕਾਲਰ ਵਾਲਾ ਲੂਵਰ ਜਾਂ ਜਾਨਵਰ-ਰੋਕੂ ਵੈਂਟ ਹੁੱਡ।"
   ]
  },
  "Braided appliance supply lines": {
   "pa": [
    "ਬ੍ਰੇਡਡ ਉਪਕਰਣ ਸਪਲਾਈ ਲਾਈਨਾਂ",
    "ਉਪਕਰਣ ਲਈ ਸਟੇਨਲੈੱਸ ਬ੍ਰੇਡਡ ਹੋਜ਼ਾਂ ਦਾ ਜੋੜਾ, ਗਰਮ ਅਤੇ ਠੰਢਾ।"
   ]
  },
  "Drain hose replacement labour": {
   "pa": [
    "ਡਰੇਨ ਹੋਜ਼ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਤਿੜਕੀ ਹੋਜ਼ ਲਾਹੀ, ਨਵੀਂ ਦੋਵੇਂ ਸਿਰਿਆਂ ਤੋਂ ਕੱਸੀ ਅਤੇ ਪੂਰਾ ਚੱਕਰ ਚਲਾਇਆ।"
   ]
  },
  "Appliance drain hose": {
   "pa": [
    "ਉਪਕਰਣ ਡਰੇਨ ਹੋਜ਼",
    "ਉਪਕਰਣ ਦੇ ਨਾਪ ਦੀ ਕਲੈਂਪ ਸਮੇਤ ਮਜ਼ਬੂਤ ਡਰੇਨ ਹੋਜ਼।"
   ]
  },
  "Kitchen sink installation labour": {
   "pa": [
    "ਰਸੋਈ ਸਿੰਕ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਕਾਊਂਟਰ ਵਿੱਚ ਸਿੰਕ ਰੱਖ ਕੇ ਸੀਲ, ਟੂਟੀ ਅਤੇ ਸਟ੍ਰੇਨਰ ਲਾਏ ਅਤੇ ਡਰੇਨ ਅਤੇ ਸਪਲਾਈ ਜੋੜੀ।"
   ]
  },
  "Strainers, trap and plumber's putty": {
   "pa": [
    "ਸਟ੍ਰੇਨਰ, ਟ੍ਰੈਪ ਅਤੇ ਪਲੰਬਰ ਪੁੱਟੀ",
    "ਦੋ ਸਟ੍ਰੇਨਰ ਬਾਸਕਟ, ਟੇਲਪੀਸ, ਟ੍ਰੈਪ ਅਤੇ ਸੀਲ ਲਈ ਪੁੱਟੀ ਅਤੇ ਵਾੱਸ਼ਰ।"
   ]
  },
  "Shower trim installation labour": {
   "pa": [
    "ਸ਼ਾਵਰ ਟ੍ਰਿਮ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣਾ ਟ੍ਰਿਮ ਅਤੇ ਹੈੱਡ ਲਾਹਿਆ, ਨਵਾਂ ਟ੍ਰਿਮ ਮੌਜੂਦਾ ਵਾਲਵ 'ਤੇ ਲਾਇਆ ਅਤੇ ਟਪਕਾ ਜਾਂਚਿਆ।"
   ]
  },
  "Shower trim kit and head": {
   "pa": [
    "ਸ਼ਾਵਰ ਟ੍ਰਿਮ ਕਿੱਟ ਅਤੇ ਹੈੱਡ",
    "ਵਾਲਵ ਦੇ ਬ੍ਰਾਂਡ ਮੁਤਾਬਕ ਹੈਂਡਲ, ਪਲੇਟ ਅਤੇ ਸ਼ਾਵਰਹੈੱਡ।"
   ]
  },
  "Cartridge replacement labour": {
   "pa": [
    "ਕਾਰਟ੍ਰਿਜ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪਾਣੀ ਬੰਦ, ਪੁਰਾਣਾ ਕਾਰਟ੍ਰਿਜ ਕੱਢਿਆ, ਨਵਾਂ ਲਾਇਆ ਅਤੇ ਗਰਮ-ਠੰਢੇ ਦੀ ਹੱਦ ਸੈੱਟ।"
   ]
  },
  "Shower valve cartridge": {
   "pa": [
    "ਸ਼ਾਵਰ ਵਾਲਵ ਕਾਰਟ੍ਰਿਜ",
    "ਨਿਰਮਾਤਾ ਮੁਤਾਬਕ ਪ੍ਰੈਸ਼ਰ-ਬੈਲੈਂਸ ਕਾਰਟ੍ਰਿਜ।"
   ]
  },
  "Toilet part replacement labour": {
   "pa": [
    "ਟਾਇਲਟ ਪੁਰਜ਼ਾ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪਾਣੀ ਬੰਦ, ਟੈਂਕੀ ਖ਼ਾਲੀ, ਪੁਰਜ਼ਾ ਬਦਲਿਆ, ਪਾਣੀ ਦਾ ਪੱਧਰ ਸੈੱਟ ਅਤੇ ਫ਼ਲੱਸ਼ ਜਾਂਚਿਆ।"
   ]
  },
  "Toilet flapper": {
   "pa": [
    "ਟਾਇਲਟ ਫ਼ਲੈਪਰ",
    "ਚੇਨ ਸਮੇਤ ਯੂਨੀਵਰਸਲ ਜਾਂ ਬ੍ਰਾਂਡ ਮੁਤਾਬਕ ਫ਼ਲੈਪਰ।"
   ]
  },
  "Fill or flush valve": {
   "pa": [
    "ਫ਼ਿੱਲ ਜਾਂ ਫ਼ਲੱਸ਼ ਵਾਲਵ",
    "ਟੈਂਕੀ ਮੁਤਾਬਕ ਯੂਨੀਵਰਸਲ ਫ਼ਿੱਲ ਵਾਲਵ ਜਾਂ ਫ਼ਲੱਸ਼ ਵਾਲਵ।"
   ]
  },
  "Shower valve installation labour": {
   "pa": [
    "ਸ਼ਾਵਰ ਵਾਲਵ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਕੰਧ ਪਿੱਛੋਂ ਜਾਂ ਅੱਗੋਂ ਖੋਲ੍ਹੀ, ਨਵਾਂ ਵਾਲਵ ਸੋਲਡਰ ਜਾਂ ਕ੍ਰਿੰਪ ਕੀਤਾ ਅਤੇ ਦਬਾਅ ਟੈਸਟ।"
   ]
  },
  "Pressure-balanced shower valve and trim": {
   "pa": [
    "ਪ੍ਰੈਸ਼ਰ-ਬੈਲੈਂਸ ਸ਼ਾਵਰ ਵਾਲਵ ਅਤੇ ਟ੍ਰਿਮ",
    "ਟ੍ਰਿਮ ਕਿੱਟ ਸਮੇਤ ਪ੍ਰੈਸ਼ਰ-ਬੈਲੈਂਸ ਜਾਂ ਥਰਮੋਸਟੈਟਿਕ ਵਾਲਵ ਬਾਡੀ।"
   ]
  },
  "Tub spout replacement labour": {
   "pa": [
    "ਟੱਬ ਸਪਾਊਟ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣਾ ਸਪਾਊਟ ਲਾਹਿਆ, ਪਾਈਪ ਸਾਫ਼ ਅਤੇ ਨਵਾਂ ਸਪਾਊਟ ਲਾ ਕੇ ਕੰਧ ਨਾਲ ਸੀਲ।"
   ]
  },
  "Diverter tub spout": {
   "pa": [
    "ਡਾਇਵਰਟਰ ਵਾਲਾ ਟੱਬ ਸਪਾਊਟ",
    "ਪਾਈਪ ਮੁਤਾਬਕ ਸਲਿੱਪ-ਔਨ ਜਾਂ ਚੂੜੀਦਾਰ, ਲਿਫ਼ਟ ਡਾਇਵਰਟਰ ਵਾਲਾ ਸਪਾਊਟ।"
   ]
  },
  "After-hours emergency dispatch": {
   "pa": [
    "ਸਮੇਂ ਤੋਂ ਬਾਅਦ ਐਮਰਜੈਂਸੀ ਭੇਜਣਾ",
    "ਰਾਤ, ਹਫ਼ਤੇ ਦੇ ਅਖ਼ੀਰ ਜਾਂ ਛੁੱਟੀ ਵਾਲੇ ਦਿਨ ਪਲੰਬਰ ਭੇਜਣ ਦਾ ਵਾਧੂ ਖ਼ਰਚਾ।"
   ]
  },
  "Sewer line excavation and replacement — per linear ft": {
   "pa": [
    "ਸੀਵਰ ਲਾਈਨ ਪੁਟਾਈ ਅਤੇ ਬਦਲੀ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਖਾਈ ਪੁੱਟੀ, ਪੁਰਾਣੀ ਪਾਈਪ ਕੱਢੀ, ਨਵੀਂ ਢਲਾਣ ਨਾਲ ਵਿਛਾਈ ਅਤੇ ਖਾਈ ਭਰੀ।"
   ]
  },
  "4 in PVC sewer pipe and fittings — per linear ft": {
   "pa": [
    "4 ਇੰਚ PVC ਸੀਵਰ ਪਾਈਪ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਕਪਲਿੰਗਾਂ, ਹੇਠਲੀ ਭਰਤੀ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ ਸਮੇਤ SDR-35 ਜਾਂ ਸ਼ਡਿਊਲ 40 PVC।"
   ]
  },
  "Camera inspection before and after": {
   "pa": [
    "ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ ਕੈਮਰਾ ਜਾਂਚ",
    "ਨੁਕਸ ਲੱਭਣ ਲਈ ਕੰਮ ਤੋਂ ਪਹਿਲਾਂ ਅਤੇ ਨਵੀਂ ਪਾਈਪ ਦਿਖਾਉਣ ਲਈ ਬਾਅਦ ਵਿੱਚ ਲਾਈਨ ਦੀ ਫ਼ਿਲਮ।"
   ]
  },
  "Cleanout installation": {
   "pa": [
    "ਕਲੀਨਆਊਟ ਲਾਉਣਾ",
    "ਲਾਈਨ ਵਿੱਚ ਦੋ-ਪਾਸੀ ਕਲੀਨਆਊਟ, ਜ਼ਮੀਨੀ ਪੱਧਰ 'ਤੇ ਰਾਈਜ਼ਰ ਅਤੇ ਢੱਕਣ ਸਮੇਤ।"
   ]
  },
  "Gas line installation labour": {
   "pa": [
    "ਗੈਸ ਲਾਈਨ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਸਪਲਾਈ ਤੋਂ ਉਪਕਰਣ ਤੱਕ ਲਾਈਨ, ਸਹਾਰੇ ਨਾਲ, ਬੰਦ ਕਰਨ ਵਾਲਾ ਵਾਲਵ ਲਾਇਆ ਅਤੇ ਦਬਾਅ ਟੈਸਟ।"
   ]
  },
  "Black iron or CSST pipe and fittings": {
   "pa": [
    "ਕਾਲੇ ਲੋਹੇ ਜਾਂ CSST ਪਾਈਪ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ",
    "ਲਾਈਨ ਲਈ ਗੈਸ ਪਾਈਪ, ਫ਼ਿਟਿੰਗਾਂ, ਸੀਲੈਂਟ ਅਤੇ ਬੰਦ ਕਰਨ ਵਾਲਾ ਵਾਲਵ।"
   ]
  },
  "Water service trenching and pipe — per linear ft": {
   "pa": [
    "ਪਾਣੀ ਸਰਵਿਸ ਖਾਈ ਅਤੇ ਪਾਈਪ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਖਾਈ ਪੁੱਟੀ ਜਾਂ ਪਾਈਪ ਖਿੱਚੀ, ਨਵੀਂ ਸਰਵਿਸ ਕੋਰੇ ਦੀ ਡੂੰਘਾਈ ਤੋਂ ਹੇਠਾਂ ਅਤੇ ਖਾਈ ਭਰੀ।"
   ]
  },
  "1 in water service pipe — per linear ft": {
   "pa": [
    "1 ਇੰਚ ਪਾਣੀ ਸਰਵਿਸ ਪਾਈਪ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਜ਼ਮੀਨ ਹੇਠ ਦੱਬਣ ਯੋਗ ਟਾਈਪ K ਤਾਂਬਾ ਜਾਂ PE/PEX ਟਿਊਬਿੰਗ।"
   ]
  },
  "Main shut-off and fittings at the house": {
   "pa": [
    "ਘਰ 'ਤੇ ਮੁੱਖ ਵਾਲਵ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ",
    "ਜਿੱਥੇ ਸਰਵਿਸ ਘਰ ਵਿੱਚ ਵੜਦੀ ਹੈ ਉੱਥੇ ਨਵਾਂ ਮੁੱਖ ਵਾਲਵ, ਅਡੈਪਟਰ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ।"
   ]
  },
  "Lawn and trench restoration": {
   "pa": [
    "ਘਾਹ ਅਤੇ ਖਾਈ ਦੀ ਮੁੜ ਬਹਾਲੀ",
    "ਖਾਈ ਭਰੀ, ਦਬਾਈ ਅਤੇ ਉੱਤੇ ਮਿੱਟੀ ਅਤੇ ਬੀਜ ਪਾਇਆ।"
   ]
  },
  "Water line repair labour": {
   "pa": [
    "ਪਾਣੀ ਲਾਈਨ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਖ਼ਰਾਬ ਹਿੱਸਾ ਕੱਟਿਆ, ਰਿਪੇਅਰ ਕਪਲਿੰਗ ਜਾਂ ਨਵੀਂ ਪਾਈਪ ਲਾਈ ਅਤੇ ਲਾਈਨ ਦਾ ਦਬਾਅ ਟੈਸਟ।"
   ]
  },
  "Pipe, couplings and fittings": {
   "pa": [
    "ਪਾਈਪ, ਕਪਲਿੰਗਾਂ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ",
    "ਹਿੱਸੇ ਲਈ ਤਾਂਬਾ ਜਾਂ PEX, ਰਿਪੇਅਰ ਕਪਲਿੰਗਾਂ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ।"
   ]
  },
  "Float switch replacement labour": {
   "pa": [
    "ਫ਼ਲੋਟ ਸਵਿੱਚ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੰਪ ਕੱਢਿਆ, ਫ਼ਲੋਟ ਬਦਲਿਆ ਅਤੇ ਪੰਪ ਚਲਾ ਕੇ ਸਹੀ ਪੱਧਰਾਂ 'ਤੇ ਚੱਲਣਾ-ਰੁਕਣਾ ਜਾਂਚਿਆ।"
   ]
  },
  "Sump pump float switch": {
   "pa": [
    "ਸੰਪ ਪੰਪ ਫ਼ਲੋਟ ਸਵਿੱਚ",
    "ਪੰਪ ਮੁਤਾਬਕ ਤਾਰ ਵਾਲਾ ਜਾਂ ਖੜ੍ਹਵਾਂ ਫ਼ਲੋਟ ਸਵਿੱਚ।"
   ]
  },
  "Discharge line repair labour": {
   "pa": [
    "ਡਿਸਚਾਰਜ ਲਾਈਨ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਤਿੜਕਿਆ, ਜੰਮਿਆ ਜਾਂ ਢਿੱਲਾ ਹਿੱਸਾ ਬਦਲਿਆ ਅਤੇ ਪੰਪ ਚਲਾ ਕੇ ਪਾਣੀ ਬਾਹਰ ਜਾਣਾ ਜਾਂਚਿਆ।"
   ]
  },
  "Discharge pipe, couplings and clamps": {
   "pa": [
    "ਡਿਸਚਾਰਜ ਪਾਈਪ, ਕਪਲਿੰਗਾਂ ਅਤੇ ਕਲੈਂਪ",
    "ਡਿਸਚਾਰਜ ਲਈ 1-1/2 ਇੰਚ PVC, ਰਬੜ ਕਪਲਿੰਗਾਂ ਅਤੇ ਹੈਂਗਰ।"
   ]
  },
  "Backup pump installation labour": {
   "pa": [
    "ਬੈਕਅੱਪ ਪੰਪ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਬੈਕਅੱਪ ਪੰਪ ਮੁੱਖ ਪੰਪ ਕੋਲ ਰੱਖਿਆ, ਆਪਣੇ ਚੈੱਕ ਵਾਲਵ ਨਾਲ ਡਿਸਚਾਰਜ ਵਿੱਚ ਜੋੜਿਆ ਅਤੇ ਬੈਟਰੀ ਨਾਲ ਜੋੜਿਆ।"
   ]
  },
  "Check valves, tee and discharge fittings": {
   "pa": [
    "ਚੈੱਕ ਵਾਲਵ, ਟੀ ਅਤੇ ਡਿਸਚਾਰਜ ਫ਼ਿਟਿੰਗਾਂ",
    "ਦੋ ਚੈੱਕ ਵਾਲਵ, ਇੱਕ ਟੀ ਅਤੇ ਬੈਕਅੱਪ ਨੂੰ ਡਿਸਚਾਰਜ ਨਾਲ ਜੋੜਨ ਵਾਲੀਆਂ PVC ਫ਼ਿਟਿੰਗਾਂ।"
   ]
  },
  "Battery box and mounting hardware": {
   "pa": [
    "ਬੈਟਰੀ ਬਕਸਾ ਅਤੇ ਲਾਉਣ ਦਾ ਸਮਾਨ",
    "ਹਵਾਦਾਰ ਬੈਟਰੀ ਬਕਸਾ, ਤਾਰਾਂ ਅਤੇ ਫ਼ਰਸ਼ ਤੋਂ ਉੱਚਾ ਰੱਖਣ ਵਾਲਾ ਬ੍ਰੈਕਟ।"
   ]
  },
  "Check valve replacement labour": {
   "pa": [
    "ਚੈੱਕ ਵਾਲਵ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਟੋਆ ਖ਼ਾਲੀ, ਪੁਰਾਣਾ ਚੈੱਕ ਵਾਲਵ ਕੱਟਿਆ, ਨਵਾਂ ਲਾਇਆ ਅਤੇ ਪੰਪ ਚਲਾਇਆ।"
   ]
  },
  "Sump check valve — up to 1½ in": {
   "pa": [
    "ਸੰਪ ਚੈੱਕ ਵਾਲਵ — 1½ ਇੰਚ ਤੱਕ",
    "ਰਬੜ ਕਪਲਿੰਗਾਂ ਸਮੇਤ ਚੁੱਪ-ਬੰਦ ਹੋਣ ਵਾਲਾ ਚੈੱਕ ਵਾਲਵ।"
   ]
  },
  "Sump pump installation labour": {
   "pa": [
    "ਸੰਪ ਪੰਪ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਗਾਹਕ ਦਾ ਪੰਪ ਟੋਏ ਵਿੱਚ ਰੱਖਿਆ, ਡਿਸਚਾਰਜ ਨਾਲ ਜੋੜਿਆ ਅਤੇ ਪੂਰਾ ਚੱਕਰ ਚਲਾਇਆ।"
   ]
  },
  "Discharge adapter and fittings": {
   "pa": [
    "ਡਿਸਚਾਰਜ ਅਡੈਪਟਰ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ",
    "ਨਵਾਂ ਪੰਪ ਜੋੜਨ ਲਈ ਅਡੈਪਟਰ, ਯੂਨੀਅਨ ਅਤੇ PVC ਫ਼ਿਟਿੰਗਾਂ।"
   ]
  },
  "Replacement toilet tank": {
   "pa": [
    "ਬਦਲਵੀਂ ਟਾਇਲਟ ਟੈਂਕੀ",
    "ਬਾਊਲ ਦੇ ਬ੍ਰਾਂਡ ਅਤੇ ਮਾਡਲ ਮੁਤਾਬਕ ਢੱਕਣ ਸਮੇਤ ਟੈਂਕੀ।"
   ]
  },
  "Tank-to-bowl gasket and bolts": {
   "pa": [
    "ਟੈਂਕੀ-ਬਾਊਲ ਗੈਸਕੇਟ ਅਤੇ ਬੋਲਟ",
    "ਟੈਂਕੀ-ਬਾਊਲ ਜੋੜ ਲਈ ਨਵੀਂ ਗੈਸਕੇਟ, ਬੋਲਟ, ਵਾੱਸ਼ਰ ਅਤੇ ਨੱਟ।"
   ]
  },
  "Dye test": {
   "pa": [
    "ਰੰਗ ਟੈਸਟ",
    "ਮੁਰੰਮਤ ਤੋਂ ਬਾਅਦ ਬਾਊਲ ਵਿੱਚ ਪਾਣੀ ਨਾ ਰਿਸਣ ਦੀ ਪੁਸ਼ਟੀ ਲਈ ਟੈਂਕੀ ਵਿੱਚ ਰੰਗ ਦੀਆਂ ਗੋਲੀਆਂ।"
   ]
  },
  "Toilet pull and reset labour": {
   "pa": [
    "ਟਾਇਲਟ ਲਾਹੁਣ ਅਤੇ ਮੁੜ ਬਿਠਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਟਾਇਲਟ ਚੁੱਕਿਆ, ਫ਼ਲੈਂਜ ਸਾਫ਼ ਅਤੇ ਜਾਂਚਿਆ, ਬਾਊਲ ਪੱਧਰਾ ਬਿਠਾ ਕੇ ਕੱਸਿਆ।"
   ]
  },
  "Wax ring with closet bolts": {
   "pa": [
    "ਬੋਲਟਾਂ ਸਮੇਤ ਵੈਕਸ ਰਿੰਗ",
    "ਟਾਇਲਟ ਨੂੰ ਫ਼ਲੈਂਜ 'ਤੇ ਬਿਠਾਉਣ ਲਈ ਬੋਲਟਾਂ ਸਮੇਤ ਵੈਕਸ ਰਿੰਗ।"
   ]
  },
  "Bolt caps and floor caulk": {
   "pa": [
    "ਬੋਲਟ ਕੈਪ ਅਤੇ ਫ਼ਰਸ਼ ਕੌਕ",
    "ਬੋਲਟ ਕੈਪ ਅਤੇ ਬੇਸ ਦੁਆਲੇ ਕੌਕ ਦੀ ਲਕੀਰ।"
   ]
  },
  "Valve installation labour": {
   "pa": [
    "ਵਾਲਵ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪਾਣੀ ਬੰਦ ਅਤੇ ਖ਼ਾਲੀ, ਵਾਲਵ ਸੋਲਡਰ ਜਾਂ ਕ੍ਰਿੰਪ ਕੀਤਾ ਅਤੇ ਲਾਈਨ ਦਾ ਦਬਾਅ ਟੈਸਟ।"
   ]
  },
  "Brass ball valve": {
   "pa": [
    "ਪਿੱਤਲ ਬਾਲ ਵਾਲਵ",
    "ਲਾਈਨ ਦੇ ਨਾਪ ਦਾ ਪੂਰੇ-ਰਸਤੇ ਵਾਲਾ ਚੌਥਾਈ-ਮੋੜ ਪਿੱਤਲ ਬਾਲ ਵਾਲਵ।"
   ]
  },
  "Fittings and solder or crimp rings": {
   "pa": [
    "ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਸੋਲਡਰ ਜਾਂ ਕ੍ਰਿੰਪ ਰਿੰਗ",
    "ਜੋੜ ਲਈ ਤਾਂਬੇ ਜਾਂ PEX ਫ਼ਿਟਿੰਗਾਂ, ਸੋਲਡਰ ਜਾਂ ਕ੍ਰਿੰਪ ਰਿੰਗ।"
   ]
  },
  "Shower base installation labour": {
   "pa": [
    "ਸ਼ਾਵਰ ਬੇਸ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਡਰੇਨ ਠੀਕ ਕੀਤੀ, ਨਵਾਂ ਬੇਸ ਮਸਾਲੇ ਵਿੱਚ ਪੱਧਰਾ ਬਿਠਾਇਆ, ਜੋੜਿਆ ਅਤੇ ਕੰਧਾਂ ਨਾਲ ਸੀਲ।"
   ]
  },
  "Shower base": {
   "pa": [
    "ਸ਼ਾਵਰ ਬੇਸ",
    "ਥਾਂ ਦੇ ਨਾਪ ਦਾ ਐਕ੍ਰਿਲਿਕ ਜਾਂ ਕੰਪੋਜ਼ਿਟ ਸ਼ਾਵਰ ਬੇਸ।"
   ]
  },
  "Shower drain assembly": {
   "pa": [
    "ਸ਼ਾਵਰ ਡਰੇਨ ਅਸੈਂਬਲੀ",
    "ਜਾਲੀ ਸਮੇਤ ਕੰਪ੍ਰੈਸ਼ਨ ਜਾਂ ਗੂੰਦ ਵਾਲੀ ਸ਼ਾਵਰ ਡਰੇਨ।"
   ]
  },
  "Pop-up drain replacement labour": {
   "pa": [
    "ਪੌਪ-ਅੱਪ ਡਰੇਨ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣੀ ਡਰੇਨ ਹੇਠੋਂ ਕੱਢੀ, ਨਵੀਂ ਪੁੱਟੀ ਵਿੱਚ ਬਿਠਾਈ ਅਤੇ ਲਿੰਕੇਜ ਠੀਕ ਕੀਤਾ।"
   ]
  },
  "Pop-up drain assembly": {
   "pa": [
    "ਪੌਪ-ਅੱਪ ਡਰੇਨ ਅਸੈਂਬਲੀ",
    "ਮਿਲਦੀ ਫ਼ਿਨਿਸ਼ ਵਿੱਚ ਟੇਲਪੀਸ ਅਤੇ ਲਿੰਕੇਜ ਸਮੇਤ ਪੌਪ-ਅੱਪ ਡਰੇਨ।"
   ]
  },
  "Old shower pan removal": {
   "pa": [
    "ਪੁਰਾਣਾ ਸ਼ਾਵਰ ਪੈਨ ਹਟਾਉਣਾ",
    "ਜਿੱਥੋਂ ਤੱਕ ਹੋ ਸਕੇ ਕੰਧਾਂ ਨੂੰ ਛੇੜੇ ਬਿਨਾਂ ਪੁਰਾਣਾ ਪੈਨ ਤੋੜ ਕੇ ਲਿਜਾਇਆ।"
   ]
  },
  "Tub drain and overflow replacement labour": {
   "pa": [
    "ਟੱਬ ਡਰੇਨ ਅਤੇ ਓਵਰਫ਼ਲੋ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣੀ ਡਰੇਨ ਅਤੇ ਓਵਰਫ਼ਲੋ ਹੇਠੋਂ ਜਾਂ ਐਕਸੈੱਸ ਪੈਨਲ ਰਾਹੀਂ ਕੱਢੇ, ਨਵੇਂ ਲਾਏ ਅਤੇ ਭਰੇ ਟੱਬ ਨਾਲ ਜਾਂਚੇ।"
   ]
  },
  "Tub waste and overflow kit": {
   "pa": [
    "ਟੱਬ ਵੇਸਟ ਅਤੇ ਓਵਰਫ਼ਲੋ ਕਿੱਟ",
    "ਮਿਲਦੀ ਫ਼ਿਨਿਸ਼ ਦੇ ਟ੍ਰਿਮ ਸਮੇਤ ਪਿੱਤਲ ਜਾਂ PVC ਵੇਸਟ ਅਤੇ ਓਵਰਫ਼ਲੋ।"
   ]
  },
  "Main shut-off replacement labour": {
   "pa": [
    "ਮੁੱਖ ਵਾਲਵ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਗਲੀ ਵਾਲੀ ਸਪਲਾਈ ਕਰਬ ਸਟੌਪ ਜਾਂ ਮੀਟਰ 'ਤੇ ਬੰਦ, ਪੁਰਾਣਾ ਮੁੱਖ ਵਾਲਵ ਕੱਟਿਆ ਅਤੇ ਨਵਾਂ ਬਾਲ ਵਾਲਵ ਲਾਇਆ।"
   ]
  },
  "Gas valve installation and leak test": {
   "pa": [
    "ਗੈਸ ਵਾਲਵ ਲਾਉਣਾ ਅਤੇ ਲੀਕ ਟੈਸਟ",
    "ਗੈਸ ਬੰਦ, ਉਪਕਰਣ 'ਤੇ ਵਾਲਵ ਲਾਇਆ, ਜੋੜਾਂ ਦਾ ਲੀਕ ਟੈਸਟ ਅਤੇ ਉਪਕਰਣ ਮੁੜ ਬਾਲਿਆ।"
   ]
  },
  "Gas shut-off valve and fittings": {
   "pa": [
    "ਗੈਸ ਬੰਦ ਕਰਨ ਵਾਲਾ ਵਾਲਵ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ",
    "ਗੈਸ ਲਈ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਬਾਲ ਵਾਲਵ, ਨਿੱਪਲ ਅਤੇ ਚੂੜੀ ਸੀਲੈਂਟ।"
   ]
  },
  "Water softener installation labour": {
   "pa": [
    "ਵਾਟਰ ਸਾਫ਼ਟਨਰ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਬਾਈਪਾਸ ਸਮੇਤ ਸਾਫ਼ਟਨਰ ਮੁੱਖ ਲਾਈਨ ਵਿੱਚ ਜੋੜਿਆ, ਡਰੇਨ ਅਤੇ ਓਵਰਫ਼ਲੋ ਲਾਏ ਅਤੇ ਯੂਨਿਟ ਪ੍ਰੋਗਰਾਮ ਕੀਤਾ।"
   ]
  },
  "Water softener — 48,000 grain": {
   "pa": [
    "ਵਾਟਰ ਸਾਫ਼ਟਨਰ — 48,000 ਗ੍ਰੇਨ",
    "ਬ੍ਰਾਈਨ ਟੈਂਕੀ ਸਮੇਤ ਮੀਟਰ ਵਾਲਾ 48,000-ਗ੍ਰੇਨ ਸਾਫ਼ਟਨਰ।"
   ]
  },
  "Bypass, fittings and drain line": {
   "pa": [
    "ਬਾਈਪਾਸ, ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਡਰੇਨ ਲਾਈਨ",
    "ਬਾਈਪਾਸ ਵਾਲਵ, ਕਨੈਕਟਰ, ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਡਰੇਨ ਅਤੇ ਓਵਰਫ਼ਲੋ ਟਿਊਬਿੰਗ।"
   ]
  },
  "Softener salt — first fill": {
   "pa": [
    "ਸਾਫ਼ਟਨਰ ਲੂਣ — ਪਹਿਲੀ ਭਰਾਈ",
    "ਬ੍ਰਾਈਨ ਟੈਂਕੀ ਦੀ ਪਹਿਲੀ ਭਰਾਈ ਲਈ ਲੂਣ ਦੀਆਂ ਗੋਲੀਆਂ।"
   ]
  },
  "Stop and supply line replacement labour": {
   "pa": [
    "ਸਟੌਪ ਅਤੇ ਸਪਲਾਈ ਲਾਈਨ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪਾਣੀ ਬੰਦ, ਪੁਰਾਣਾ ਸਟੌਪ ਕੱਟਿਆ ਜਾਂ ਖੋਲ੍ਹਿਆ, ਨਵਾਂ ਚੌਥਾਈ-ਮੋੜ ਸਟੌਪ ਲਾਇਆ ਅਤੇ ਸਪਲਾਈ ਲਾਈਨ ਜੋੜੀ।"
   ]
  },
  "Quarter-turn angle stop": {
   "pa": [
    "ਚੌਥਾਈ-ਮੋੜ ਐਂਗਲ ਸਟੌਪ",
    "1/2 × 3/8 ਇੰਚ ਚੌਥਾਈ-ਮੋੜ ਐਂਗਲ ਸਟੌਪ ਵਾਲਵ।"
   ]
  },
  "Hose bib replacement labour": {
   "pa": [
    "ਬਾਹਰਲੀ ਟੂਟੀ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣੀ ਟੂਟੀ ਕੱਢੀ, ਜਿੱਥੇ ਹੋ ਸਕੇ ਕੰਧ ਰਾਹੀਂ ਕੋਰਾ-ਰੋਕੂ ਟੂਟੀ ਲਾਈ, ਸੀਲ ਅਤੇ ਜਾਂਚੀ।"
   ]
  },
  "Frost-free hose bib": {
   "pa": [
    "ਕੋਰਾ-ਰੋਕੂ ਬਾਹਰਲੀ ਟੂਟੀ",
    "ਕੰਧ ਮੁਤਾਬਕ ਲੰਬਾਈ ਵਾਲੀ, ਵੈਕਿਊਮ ਬ੍ਰੇਕਰ ਸਮੇਤ ਕੋਰਾ-ਰੋਕੂ ਟੂਟੀ।"
   ]
  },
  "Pressure-reducing valve installation labour": {
   "pa": [
    "ਪ੍ਰੈਸ਼ਰ ਘਟਾਊ ਵਾਲਵ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਆਉਂਦੀ ਮੁੱਖ ਲਾਈਨ 'ਤੇ ਰੈਗੂਲੇਟਰ ਲਾਇਆ, ਘਰ ਦੇ ਦਬਾਅ 'ਤੇ ਸੈੱਟ ਅਤੇ ਗੇਜ ਨਾਲ ਜਾਂਚਿਆ।"
   ]
  },
  "Pressure-reducing valve and gauge": {
   "pa": [
    "ਪ੍ਰੈਸ਼ਰ ਘਟਾਊ ਵਾਲਵ ਅਤੇ ਗੇਜ",
    "ਯੂਨੀਅਨ ਅਤੇ ਟੈਸਟ ਗੇਜ ਸਮੇਤ ਕਾਂਸੀ ਦਾ ਪ੍ਰੈਸ਼ਰ ਘਟਾਊ ਵਾਲਵ।"
   ]
  },
  "Gas water heater installation or service labour": {
   "pa": [
    "ਗੈਸ ਵਾਟਰ ਹੀਟਰ ਲਾਉਣ ਜਾਂ ਸਰਵਿਸ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਹੀਟਰ ਗੈਸ, ਪਾਣੀ ਅਤੇ ਵੈਂਟ ਨਾਲ ਜੋੜਿਆ, ਬਾਲਿਆ, ਡਰਾਫ਼ਟ ਜਾਂਚਿਆ ਅਤੇ ਤਾਪਮਾਨ ਸੈੱਟ।"
   ]
  },
  "Gas connector, fittings and sealant": {
   "pa": [
    "ਗੈਸ ਕਨੈਕਟਰ, ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਸੀਲੈਂਟ",
    "ਲਚਕੀਲਾ ਗੈਸ ਕਨੈਕਟਰ, ਸੈਡੀਮੈਂਟ ਟ੍ਰੈਪ ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਪਾਈਪ ਸੀਲੈਂਟ।"
   ]
  },
  "Tank installation labour": {
   "pa": [
    "ਟੈਂਕੀ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਬਦਲਵੀਂ ਟੈਂਕੀ ਰੱਖੀ, ਨਵੇਂ ਕਨੈਕਟਰਾਂ ਨਾਲ ਪਾਣੀ ਨਾਲ ਜੋੜੀ ਅਤੇ ਤਾਪਮਾਨ ਤੱਕ ਗਰਮ ਕੀਤੀ।"
   ]
  },
  "Flex connectors, valve and fittings": {
   "pa": [
    "ਫ਼ਲੈਕਸ ਕਨੈਕਟਰ, ਵਾਲਵ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ",
    "ਟੈਂਕੀ 'ਤੇ ਪਾਣੀ ਦੇ ਫ਼ਲੈਕਸ ਕਨੈਕਟਰ, ਬੰਦ ਕਰਨ ਵਾਲਾ ਵਾਲਵ ਅਤੇ ਫ਼ਿਟਿੰਗਾਂ।"
   ]
  },
  "Heater part replacement labour": {
   "pa": [
    "ਹੀਟਰ ਪੁਰਜ਼ਾ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਹੀਟਰ ਬੰਦ ਅਤੇ ਵੱਖ ਕੀਤਾ, ਖ਼ਰਾਬ ਪੁਰਜ਼ਾ ਬਦਲਿਆ ਅਤੇ ਯੂਨਿਟ ਚਲਾ ਕੇ ਜਾਂਚਿਆ।"
   ]
  },
  "Water heater thermostat or element": {
   "pa": [
    "ਵਾਟਰ ਹੀਟਰ ਥਰਮੋਸਟੈਟ ਜਾਂ ਐਲੀਮੈਂਟ",
    "ਹੀਟਰ ਮੁਤਾਬਕ ਥਰਮੋਸਟੈਟ, ਐਲੀਮੈਂਟ ਜਾਂ ਗੈਸ ਕੰਟਰੋਲ।"
   ]
  },
  "Brass drain valve": {
   "pa": [
    "ਪਿੱਤਲ ਡਰੇਨ ਵਾਲਵ",
    "ਟੈਂਕੀ ਲਈ ਪੂਰੇ-ਰਸਤੇ ਵਾਲਾ ਪਿੱਤਲ ਡਰੇਨ ਵਾਲਵ।"
   ]
  },
  "Thermal expansion tank — 2 gal": {
   "pa": [
    "ਥਰਮਲ ਐਕਸਪੈਂਸ਼ਨ ਟੈਂਕੀ — 2 ਗੈਲਨ",
    "2-ਗੈਲਨ ਐਕਸਪੈਂਸ਼ਨ ਟੈਂਕੀ, ਮੌਕੇ 'ਤੇ ਘਰ ਦੇ ਦਬਾਅ ਮੁਤਾਬਕ ਹਵਾ ਭਰੀ।"
   ]
  },
  "Flammable-vapour or thermal sensor": {
   "pa": [
    "ਜਲਣਸ਼ੀਲ-ਭਾਫ਼ ਜਾਂ ਥਰਮਲ ਸੈਂਸਰ",
    "ਹੀਟਰ ਲਈ ਨਿਰਮਾਤਾ ਮੁਤਾਬਕ ਸੁਰੱਖਿਆ ਸੈਂਸਰ।"
   ]
  },
  "Hot surface igniter": {
   "pa": [
    "ਹੌਟ ਸਰਫ਼ੇਸ ਇਗਨਾਈਟਰ",
    "ਨਿਰਮਾਤਾ ਮੁਤਾਬਕ ਹੌਟ ਸਰਫ਼ੇਸ ਇਗਨਾਈਟਰ।"
   ]
  },
  "Tank flush and sediment removal": {
   "pa": [
    "ਟੈਂਕੀ ਫ਼ਲੱਸ਼ ਅਤੇ ਗਾਰ ਕੱਢਣਾ",
    "ਪਾਣੀ ਸਾਫ਼ ਆਉਣ ਤੱਕ ਟੈਂਕੀ ਖ਼ਾਲੀ ਅਤੇ ਫ਼ਲੱਸ਼, ਡਰੇਨ ਵਾਲਵ ਜਾਂਚਿਆ।"
   ]
  },
  "Anode rod replacement labour": {
   "pa": [
    "ਐਨੋਡ ਰਾਡ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪੁਰਾਣੀ ਐਨੋਡ ਰਾਡ ਕੱਢੀ ਅਤੇ ਨਵੀਂ ਲਾ ਕੇ ਸੀਲ ਕੀਤੀ।"
   ]
  },
  "Anode rod": {
   "pa": [
    "ਐਨੋਡ ਰਾਡ",
    "ਟੈਂਕੀ ਦੇ ਨਾਪ ਦੀ ਮੈਗਨੀਸ਼ੀਅਮ ਜਾਂ ਬਿਜਲਈ ਐਨੋਡ ਰਾਡ।"
   ]
  },
  "Descaler and line-clearing supplies": {
   "pa": [
    "ਡੀਸਕੇਲਰ ਅਤੇ ਲਾਈਨ ਸਾਫ਼ ਕਰਨ ਦਾ ਸਮਾਨ",
    "ਗਰਮ ਲਾਈਨ ਵਿੱਚੋਂ ਪਪੜੀ ਹਟਾਉਣ ਲਈ ਡੀਸਕੇਲਿੰਗ ਘੋਲ ਅਤੇ ਛੋਟੀਆਂ ਫ਼ਿਟਿੰਗਾਂ।"
   ]
  }
 }
};
