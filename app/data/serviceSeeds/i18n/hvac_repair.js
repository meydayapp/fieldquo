// app/data/serviceSeeds/i18n/hvac_repair.js
//
// The languages hvac_repair.js does not write inline — Italian, German,
// Ukrainian, Punjabi (Gurmukhi) and Tagalog for its categories and services,
// and Punjabi for its template lines (keyed by the English line name) — merged
// by withLanguages in ../_templateLines.js. Hand-written trade wording, no
// machine translation; checked by scripts/check-seed-languages.mjs.
export const I18N = {
 "categories": {
  "blower": {
   "it": "Motori ventilatore",
   "de": "Gebläsemotoren",
   "uk": "Двигуни вентилятора",
   "pa": "ਬਲੋਅਰ ਮੋਟਰਾਂ",
   "tl": "Blower motor"
  },
  "coils": {
   "it": "Batterie",
   "de": "Register (Wärmetauscher)",
   "uk": "Теплообмінники",
   "pa": "ਕੌਇਲਾਂ",
   "tl": "Coil"
  },
  "compressor": {
   "it": "Compressori",
   "de": "Verdichter",
   "uk": "Компресори",
   "pa": "ਕੰਪ੍ਰੈਸਰ",
   "tl": "Compressor"
  },
  "condensate": {
   "it": "Scarico condensa",
   "de": "Kondensatablauf",
   "uk": "Відведення конденсату",
   "pa": "ਕੰਡੈਂਸੇਟ ਡਰੇਨ",
   "tl": "Drain ng condensate"
  },
  "condenser": {
   "it": "Unità esterna",
   "de": "Verflüssiger",
   "uk": "Конденсатор",
   "pa": "ਕੰਡੈਂਸਰ",
   "tl": "Condenser"
  },
  "belts": {
   "it": "Cinghie e pulegge",
   "de": "Keilriemen und Riemenscheiben",
   "uk": "Паси та шківи",
   "pa": "ਬੈਲਟਾਂ ਅਤੇ ਪੁਲੀਆਂ",
   "tl": "Belt at pulley"
  },
  "air_quality": {
   "it": "Filtri e qualità dell'aria",
   "de": "Filter und Luftqualität",
   "uk": "Фільтри та якість повітря",
   "pa": "ਫ਼ਿਲਟਰ ਅਤੇ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ",
   "tl": "Filter at kalidad ng hangin"
  },
  "controls": {
   "it": "Parte elettrica e comandi",
   "de": "Elektrik und Steuerung",
   "uk": "Електрика та керування",
   "pa": "ਬਿਜਲੀ ਅਤੇ ਕੰਟਰੋਲ",
   "tl": "Kuryente at kontrol"
  },
  "maintenance": {
   "it": "Manutenzione e messe a punto",
   "de": "Wartung und Inspektion",
   "uk": "Обслуговування та налаштування",
   "pa": "ਰੱਖ-ਰਖਾਅ ਅਤੇ ਟਿਊਨ-ਅੱਪ",
   "tl": "Maintenance at tune-up"
  },
  "heat_exchanger": {
   "it": "Scambiatori di calore e scarichi fumi",
   "de": "Wärmetauscher und Abgasführung",
   "uk": "Теплообмінники та димовідведення",
   "pa": "ਹੀਟ ਐਕਸਚੇਂਜਰ ਅਤੇ ਧੂੰਏਂ ਦਾ ਨਿਕਾਸ",
   "tl": "Heat exchanger at venting"
  },
  "refrigerant": {
   "it": "Refrigerante e perdite",
   "de": "Kältemittel und Lecks",
   "uk": "Холодоагент і витоки",
   "pa": "ਰੈਫ਼ਰਿਜਰੈਂਟ ਅਤੇ ਲੀਕ",
   "tl": "Refrigerant at tagas"
  },
  "diagnostics": {
   "it": "Diagnosi e interventi di riparazione",
   "de": "Diagnose und Reparatureinsätze",
   "uk": "Діагностика та ремонтні виїзди",
   "pa": "ਜਾਂਚ ਅਤੇ ਮੁਰੰਮਤ ਵਿਜ਼ਿਟਾਂ",
   "tl": "Diagnostic at visit sa pagkukumpuni"
  }
 },
 "services": {
  "fq.hvac_repair.blower.replace_motor": {
   "pa": [
    "ਬਲੋਅਰ ਮੋਟਰ ਬਦਲਣਾ",
    "ਖ਼ਰਾਬ ਅੰਦਰਲੀ ਬਲੋਅਰ ਮੋਟਰ ਨਵੀਂ ਨਾਲ ਬਦਲ ਕੇ ਤਾਰਾਂ ਜੋੜੀਆਂ, ਡਕਟਾਂ ਵਿੱਚ ਹਵਾ ਦਾ ਵਹਾਅ ਮੁੜ ਆਮ।"
   ]
  },
  "fq.hvac_repair.blower.replace_motor_module": {
   "it": [
    "Sostituzione modulo di controllo del motore ventilatore",
    "Il modulo elettronico che regola la velocità del ventilatore rimosso e sostituito, così l'impianto modula di nuovo la portata come previsto."
   ],
   "de": [
    "Austausch des Gebläsemotor-Steuermoduls",
    "Das Elektronikmodul, das die Gebläsedrehzahl regelt, ausgebaut und ersetzt, damit die Anlage die Luftmenge wieder wie vorgesehen regelt."
   ],
   "uk": [
    "Заміна модуля керування двигуном вентилятора",
    "Електронний модуль, що задає швидкість вентилятора, знято й замінено, тож система знову регулює потік повітря як задумано."
   ],
   "pa": [
    "ਬਲੋਅਰ ਮੋਟਰ ਕੰਟਰੋਲ ਮਾਡਿਊਲ ਬਦਲਣਾ",
    "ਪੱਖੇ ਦੀ ਰਫ਼ਤਾਰ ਤੈਅ ਕਰਨ ਵਾਲਾ ਇਲੈਕਟ੍ਰਾਨਿਕ ਮਾਡਿਊਲ ਕੱਢ ਕੇ ਨਵਾਂ ਲਾਇਆ, ਤਾਂ ਜੋ ਸਿਸਟਮ ਮੁੜ ਹਵਾ ਘੱਟ-ਵੱਧ ਕਰ ਸਕੇ।"
   ],
   "tl": [
    "Pagpapalit ng control module ng blower motor",
    "Tinanggal at pinalitan ang elektronikong module na nagtatakda ng bilis ng fan, para muling makontrol ng sistema ang daloy ng hangin."
   ]
  },
  "fq.hvac_repair.blower.replace_wheel": {
   "it": [
    "Sostituzione girante del ventilatore",
    "Una girante usurata, crepata o sbilanciata tolta dall'albero e sostituita, per un flusso d'aria di nuovo silenzioso e uniforme."
   ],
   "de": [
    "Austausch des Gebläserads",
    "Ein abgenutztes, gerissenes oder unwuchtiges Gebläserad von der Welle genommen und ersetzt — für wieder leisen, gleichmäßigen Luftstrom."
   ],
   "uk": [
    "Заміна крильчатки вентилятора",
    "Зношену, тріснуту чи розбалансовану крильчатку знято з вала й замінено, повітря знову йде тихо й рівно."
   ],
   "pa": [
    "ਬਲੋਅਰ ਵ੍ਹੀਲ ਬਦਲਣਾ",
    "ਘਿਸਿਆ, ਤਿੜਕਿਆ ਜਾਂ ਅਸੰਤੁਲਿਤ ਬਲੋਅਰ ਵ੍ਹੀਲ ਮੋਟਰ ਦੇ ਧੁਰੇ ਤੋਂ ਲਾਹ ਕੇ ਬਦਲਿਆ, ਹਵਾ ਮੁੜ ਸ਼ਾਂਤ ਅਤੇ ਬਰਾਬਰ।"
   ],
   "tl": [
    "Pagpapalit ng blower wheel",
    "Tinanggal sa shaft at pinalitan ang gasgas, bitak o hindi balanseng blower wheel, tahimik at pantay ulit ang hangin."
   ]
  },
  "fq.hvac_repair.blower.clean_motor": {
   "it": [
    "Pulizia motore e gruppo ventilatore",
    "Motore, girante e chiocciola smontati e puliti da polvere e lanugine che riducono l'aria e affaticano il motore."
   ],
   "de": [
    "Reinigung von Gebläsemotor und -baugruppe",
    "Motor, Rad und Gehäuse ausgebaut und von festsitzendem Staub und Flusen befreit, die den Luftstrom drosseln und den Motor belasten."
   ],
   "uk": [
    "Чищення двигуна та вузла вентилятора",
    "Двигун, крильчатку й корпус знято й очищено від пилу та ворсу, що зменшують потік і перевантажують двигун."
   ],
   "pa": [
    "ਬਲੋਅਰ ਮੋਟਰ ਅਤੇ ਅਸੈਂਬਲੀ ਦੀ ਸਫ਼ਾਈ",
    "ਬਲੋਅਰ ਮੋਟਰ, ਵ੍ਹੀਲ ਅਤੇ ਹਾਊਸਿੰਗ ਕੱਢ ਕੇ ਜੰਮੀ ਧੂੜ ਅਤੇ ਰੂੰ ਤੋਂ ਸਾਫ਼, ਜੋ ਹਵਾ ਘਟਾਉਂਦੇ ਅਤੇ ਮੋਟਰ 'ਤੇ ਜ਼ੋਰ ਪਾਉਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Paglilinis ng blower motor at assembly",
    "Tinanggal at nilinis ang motor, wheel at housing mula sa alikabok at lint na nagpapahina sa hangin at nagpapabigat sa motor."
   ]
  },
  "fq.hvac_repair.blower.evaporator_motor": {
   "it": [
    "Sostituzione o installazione motore ventilatore evaporatore",
    "Il motore che spinge l'aria attraverso la batteria evaporante interna sostituito o installato e provato sotto carico."
   ],
   "de": [
    "Austausch oder Einbau des Verdampfer-Lüftermotors",
    "Der Motor, der Luft über das innere Verdampferregister zieht, ersetzt oder neu eingebaut und unter Last geprüft."
   ],
   "uk": [
    "Заміна чи встановлення двигуна вентилятора випарника",
    "Двигун, що жене повітря крізь внутрішній випарник, замінено чи встановлено й перевірено під навантаженням."
   ],
   "pa": [
    "ਇਵੈਪੋਰੇਟਰ ਪੱਖਾ ਮੋਟਰ ਬਦਲਣਾ ਜਾਂ ਲਾਉਣਾ",
    "ਅੰਦਰਲੀ ਇਵੈਪੋਰੇਟਰ ਕੌਇਲ ਤੋਂ ਹਵਾ ਖਿੱਚਣ ਵਾਲੀ ਪੱਖਾ ਮੋਟਰ ਬਦਲੀ ਜਾਂ ਨਵੀਂ ਲਾ ਕੇ ਭਾਰ ਹੇਠ ਜਾਂਚੀ।"
   ],
   "tl": [
    "Pagpapalit o pagkakabit ng fan motor ng evaporator",
    "Pinalitan o bagong ikinabit ang motor na humihila ng hangin sa evaporator coil at sinubukan habang may karga."
   ]
  },
  "fq.hvac_repair.air_quality.air_quality_visit": {
   "it": [
    "Visita per la qualità dell'aria interna",
    "Visita di due ore per polvere, allergeni, umidità, scarsa ventilazione o problemi di filtri: si trova la causa e si fa il prezzo sul posto."
   ],
   "de": [
    "Termin zur Raumluftqualität",
    "Ein Zwei-Stunden-Termin bei Staub, Allergenen, Feuchte, schlechter Lüftung oder Filterproblemen: Ursache gefunden, Lösung vor Ort bepreist."
   ],
   "uk": [
    "Візит щодо якості повітря в приміщенні",
    "Двогодинний візит через пил, алергени, вологість, погану вентиляцію чи фільтри: причину знайдено, ціну названо на місці."
   ],
   "pa": [
    "ਅੰਦਰਲੀ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਲਈ ਵਿਜ਼ਿਟ",
    "ਧੂੜ, ਐਲਰਜੀ ਕਾਰਕ, ਨਮੀ, ਮਾੜੀ ਹਵਾਦਾਰੀ ਜਾਂ ਫ਼ਿਲਟਰ ਦੀ ਸਮੱਸਿਆ ਲਈ ਦੋ ਘੰਟਿਆਂ ਦੀ ਵਿਜ਼ਿਟ: ਕਾਰਨ ਲੱਭ ਕੇ ਮੌਕੇ 'ਤੇ ਰੇਟ।"
   ],
   "tl": [
    "Visit para sa kalidad ng hangin sa loob",
    "Dalawang oras na visit para sa alikabok, allergen, halumigmig, mahinang bentilasyon o filter: hinahanap ang sanhi at binibigyan ng presyo sa lugar."
   ]
  },
  "fq.hvac_repair.air_quality.duct_cleaning_visit": {
   "it": [
    "Pulizia condotti — visita prenotata",
    "Polvere, allergeni e detriti estratti dai condotti di mandata e ripresa, per un'aria più pulita e un impianto meno affaticato."
   ],
   "de": [
    "Kanalreinigung — gebuchter Termin",
    "Staub, Allergene und Schmutz aus Zu- und Rückluftkanälen entfernt, für sauberere Luft und eine entlastete Anlage."
   ],
   "uk": [
    "Чищення повітроводів — запланований візит",
    "Пил, алергени й сміття видалено з припливних і зворотних повітроводів — повітря чистіше, система менше навантажена."
   ],
   "pa": [
    "ਡਕਟ ਸਫ਼ਾਈ — ਬੁੱਕ ਕੀਤੀ ਵਿਜ਼ਿਟ",
    "ਸਪਲਾਈ ਅਤੇ ਰਿਟਰਨ ਡਕਟਾਂ ਵਿੱਚੋਂ ਧੂੜ, ਐਲਰਜੀ ਕਾਰਕ ਅਤੇ ਕੂੜਾ ਕੱਢਿਆ ਜਾਂਦਾ ਹੈ, ਹਵਾ ਸਾਫ਼ ਅਤੇ ਸਿਸਟਮ 'ਤੇ ਘੱਟ ਜ਼ੋਰ।"
   ],
   "tl": [
    "Paglilinis ng duct — naka-book",
    "Hinigop ang alikabok, allergen at dumi sa supply at return duct, mas malinis ang hangin at mas magaan ang trabaho ng sistema."
   ]
  },
  "fq.hvac_repair.diagnostics.heating_repair_visit": {
   "pa": [
    "ਹੀਟਿੰਗ ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਗਰਮੀ ਨਾ ਹੋਣਾ, ਕਮਰਿਆਂ ਦਾ ਬਰਾਬਰ ਨਾ ਹੋਣਾ, ਫ਼ਰਨੇਸ ਦੀਆਂ ਨਵੀਆਂ ਆਵਾਜ਼ਾਂ ਜਾਂ ਵੱਧ ਬਿੱਲ: ਟੈਕਨੀਸ਼ੀਅਨ ਨੁਕਸ ਲੱਭ ਕੇ ਹੋ ਸਕੇ ਤਾਂ ਉਸੇ ਵਿਜ਼ਿਟ ਵਿੱਚ ਠੀਕ ਕਰਦਾ ਹੈ।"
   ]
  },
  "fq.hvac_repair.diagnostics.cooling_repair_visit": {
   "pa": [
    "ਕੂਲਿੰਗ ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਠੰਢ ਨਾ ਹੋਣਾ, ਕਮਰੇ ਬਰਾਬਰ ਨਾ ਹੋਣਾ, ਏਸੀ ਦੀਆਂ ਨਵੀਆਂ ਆਵਾਜ਼ਾਂ ਜਾਂ ਵੱਧ ਬਿੱਲ: ਨੁਕਸ ਲੱਭ ਕੇ ਹੋ ਸਕੇ ਤਾਂ ਉਸੇ ਵਿਜ਼ਿਟ ਵਿੱਚ ਠੀਕ।"
   ]
  },
  "fq.hvac_repair.controls.thermostat_visit": {
   "it": [
    "Riparazione o sostituzione termostato — visita",
    "Un termostato che legge male, non mantiene l'impostazione, ha il display spento o ignora le modifiche viene riparato o sostituito."
   ],
   "de": [
    "Thermostatreparatur oder -tausch — Termin",
    "Ein Thermostat, das falsch misst, die Einstellung nicht hält, ein dunkles Display hat oder nicht reagiert, repariert oder ersetzt."
   ],
   "uk": [
    "Ремонт чи заміна термостата — візит",
    "Термостат, що хибно показує, не тримає налаштування, має згаслий дисплей чи не реагує, ремонтують або замінюють."
   ],
   "pa": [
    "ਥਰਮੋਸਟੈਟ ਮੁਰੰਮਤ ਜਾਂ ਬਦਲੀ ਵਿਜ਼ਿਟ",
    "ਗ਼ਲਤ ਪੜ੍ਹਨ ਵਾਲਾ, ਸੈਟਿੰਗ ਨਾ ਫੜਨ ਵਾਲਾ, ਬੰਦ ਸਕ੍ਰੀਨ ਜਾਂ ਬਦਲਾਅ ਨਾ ਮੰਨਣ ਵਾਲਾ ਥਰਮੋਸਟੈਟ ਠੀਕ ਜਾਂ ਬਦਲਿਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Visit sa pagkukumpuni o pagpapalit ng thermostat",
    "Inaayos o pinapalitan ang thermostat na mali ang basa, hindi humahawak ng setting, patay ang display o hindi sumusunod."
   ]
  },
  "fq.hvac_repair.coils.inspect": {
   "pa": [
    "ਕੌਇਲ ਦੀ ਜਾਂਚ",
    "ਇਵੈਪੋਰੇਟਰ ਅਤੇ ਕੰਡੈਂਸਰ ਕੌਇਲਾਂ ਜੰਗਾਲ, ਮੁੜੇ ਫ਼ਿਨ, ਤੇਲ ਦੇ ਦਾਗ਼ ਅਤੇ ਲੀਕ ਲਈ ਜਾਂਚੀਆਂ, ਮੁਰੰਮਤ ਦੇ ਰੇਟ ਤੋਂ ਪਹਿਲਾਂ ਨਤੀਜੇ ਦੱਸੇ ਜਾਂਦੇ ਹਨ।"
   ]
  },
  "fq.hvac_repair.coils.clean": {
   "pa": [
    "ਕੌਇਲ ਸਫ਼ਾਈ — ਇਵੈਪੋਰੇਟਰ ਅਤੇ ਕੰਡੈਂਸਰ",
    "ਦੋਵੇਂ ਕੌਇਲਾਂ ਤੋਂ ਗਰਮੀ ਰੋਕਣ ਵਾਲੀ ਗੰਦਗੀ ਅਤੇ ਰੂੰ ਦੀ ਪਰਤ ਸਾਫ਼, ਸਿਸਟਮ ਮੁੜ ਪੂਰੀ ਸਮਰੱਥਾ ਨਾਲ।"
   ]
  },
  "fq.hvac_repair.coils.chemical_clean": {
   "it": [
    "Pulizia chimica delle batterie",
    "Batterie molto sporche trattate con un detergente sicuro che scioglie lo sporco incrostato che il solo risciacquo non toglie, poi risciacquate."
   ],
   "de": [
    "Chemische Registerreinigung",
    "Stark verschmutzte Register mit einem registerverträglichen Reiniger behandelt, der eingebrannten Schmutz löst, dann klar gespült."
   ],
   "uk": [
    "Хімічне чищення теплообмінників",
    "Сильно забруднені теплообмінники оброблено безпечним засобом, що знімає пригорілий бруд, потім промито."
   ],
   "pa": [
    "ਕੌਇਲ ਦੀ ਰਸਾਇਣਕ ਸਫ਼ਾਈ",
    "ਬਹੁਤ ਗੰਦੀਆਂ ਕੌਇਲਾਂ 'ਤੇ ਸੁਰੱਖਿਅਤ ਕਲੀਨਰ ਜੋ ਜੰਮੀ ਮੈਲ ਚੁੱਕਦਾ ਹੈ, ਫਿਰ ਸਾਫ਼ ਧੋਤੀਆਂ।"
   ],
   "tl": [
    "Kemikal na paglilinis ng coil",
    "Ginamot ng ligtas na panlinis ang napakaruming coil para matanggal ang kapit na dumi, saka binanlawan."
   ]
  },
  "fq.hvac_repair.coils.replace": {
   "it": [
    "Sostituzione batteria",
    "Una batteria corrosa o che perde, non più riparabile, rimossa e sostituita con una nuova abbinata, brasata, messa sotto vuoto e ricaricata."
   ],
   "de": [
    "Registertausch",
    "Ein korrodiertes oder undichtes, nicht mehr reparables Register ausgebaut, ein passendes neues eingelötet, evakuiert und neu befüllt."
   ],
   "uk": [
    "Заміна теплообмінника",
    "Корозійний чи протікаючий теплообмінник знято, новий відповідний впаяно, вакуумовано й заправлено."
   ],
   "pa": [
    "ਕੌਇਲ ਬਦਲਣਾ",
    "ਮੁਰੰਮਤ ਤੋਂ ਬਾਹਰ ਜੰਗਾਲੀ ਜਾਂ ਲੀਕ ਕੌਇਲ ਕੱਢ ਕੇ ਮੇਲ ਖਾਂਦੀ ਨਵੀਂ ਬ੍ਰੇਜ਼, ਖ਼ਾਲੀ ਅਤੇ ਮੁੜ ਚਾਰਜ।"
   ],
   "tl": [
    "Pagpapalit ng coil",
    "Tinanggal ang kinakalawang o tumatagas na coil na hindi na maayos at ibinrazed ang bagong katugma, vinacuum at kinargahan."
   ]
  },
  "fq.hvac_repair.coils.protective_coating": {
   "it": [
    "Rivestimento protettivo delle batterie",
    "Un rivestimento applicato su batterie pulite per rallentare la corrosione e impedire allo sporco di aderire alle alette."
   ],
   "de": [
    "Schutzbeschichtung für Register",
    "Eine Schutzschicht auf saubere Register aufgetragen, die Korrosion bremst und Schmutz nicht an den Lamellen haften lässt."
   ],
   "uk": [
    "Захисне покриття теплообмінника",
    "Захисне покриття на чистий теплообмінник, щоб сповільнити корозію й не дати бруду прилипати до ламелей."
   ],
   "pa": [
    "ਕੌਇਲ ਦੀ ਸੁਰੱਖਿਆ ਕੋਟਿੰਗ",
    "ਸਾਫ਼ ਕੌਇਲਾਂ 'ਤੇ ਕੋਟਿੰਗ ਜੋ ਜੰਗਾਲ ਹੌਲੀ ਕਰਦੀ ਅਤੇ ਫ਼ਿਨਾਂ 'ਤੇ ਗੰਦਗੀ ਨਹੀਂ ਜੰਮਣ ਦਿੰਦੀ।"
   ],
   "tl": [
    "Protektibong coating ng coil",
    "Coating sa malinis na coil para pabagalin ang kalawang at pigilan ang dumi sa pagdikit sa fins."
   ]
  },
  "fq.hvac_repair.coils.repair": {
   "it": [
    "Riparazione batteria",
    "Una perdita o un tratto danneggiato su batteria evaporante o condensante brasato e provato a pressione, salvando una batteria ancora valida."
   ],
   "de": [
    "Registerreparatur",
    "Ein Leck oder beschädigter Abschnitt am Verdampfer- oder Verflüssigerregister gelötet und druckgeprüft — statt Austausch."
   ],
   "uk": [
    "Ремонт теплообмінника",
    "Витік чи пошкоджену ділянку випарника або конденсатора запаяно й перевірено тиском замість заміни."
   ],
   "pa": [
    "ਕੌਇਲ ਦੀ ਮੁਰੰਮਤ",
    "ਇਵੈਪੋਰੇਟਰ ਜਾਂ ਕੰਡੈਂਸਰ ਕੌਇਲ ਦਾ ਲੀਕ ਜਾਂ ਖ਼ਰਾਬ ਹਿੱਸਾ ਬ੍ਰੇਜ਼ ਕਰਕੇ ਦਬਾਅ ਟੈਸਟ, ਬਦਲਣ ਦੀ ਥਾਂ।"
   ],
   "tl": [
    "Pagkukumpuni ng coil",
    "Ibinrazed at pressure-test ang tagas o sirang bahagi ng evaporator o condenser coil sa halip na palitan."
   ]
  },
  "fq.hvac_repair.coils.evaporator_clean": {
   "pa": [
    "ਇਵੈਪੋਰੇਟਰ ਕੌਇਲ ਦੀ ਸਫ਼ਾਈ",
    "ਅੰਦਰਲੀ ਇਵੈਪੋਰੇਟਰ ਕੌਇਲ ਖੋਲ੍ਹ ਕੇ ਸਾਫ਼ ਕੀਤੀ ਜਾਂਦੀ ਹੈ ਤਾਂ ਜੋ ਹਵਾ ਆਸਾਨੀ ਨਾਲ ਲੰਘੇ ਅਤੇ ਬਰਫ਼ ਨਾ ਜੰਮੇ।"
   ]
  },
  "fq.hvac_repair.coils.evaporator_install": {
   "it": [
    "Installazione batteria evaporante",
    "Nuova batteria evaporante montata nell'unità interna o sopra la caldaia, con scarico, linee e valvola collegati e controllo dopo l'avvio."
   ],
   "de": [
    "Einbau eines Verdampferregisters",
    "Ein neues Verdampferregister im Innengerät oder über dem Ofen eingebaut, Ablauf, Leitungen und Expansionsventil angeschlossen und nach dem Start geprüft."
   ],
   "uk": [
    "Встановлення випарника",
    "Новий випарник встановлено в блок чи над піччю, під'єднано дренаж, траси й ТРВ, систему перевірено після запуску."
   ],
   "pa": [
    "ਇਵੈਪੋਰੇਟਰ ਕੌਇਲ ਲਾਉਣਾ",
    "ਏਅਰ ਹੈਂਡਲਰ ਵਿੱਚ ਜਾਂ ਫ਼ਰਨੇਸ ਉੱਪਰ ਨਵੀਂ ਕੌਇਲ, ਡਰੇਨ, ਲਾਈਨ ਸੈੱਟ ਅਤੇ ਐਕਸਪੈਂਸ਼ਨ ਵਾਲਵ ਜੋੜ ਕੇ ਚਾਲੂ ਹੋਣ ਤੋਂ ਬਾਅਦ ਜਾਂਚ।"
   ],
   "tl": [
    "Pagkakabit ng evaporator coil",
    "Bagong evaporator coil sa air handler o sa ibabaw ng furnace, ikinonekta ang drain, linya at expansion valve at sinuri pagkatapos paandarin."
   ]
  },
  "fq.hvac_repair.compressor.replace": {
   "it": [
    "Sostituzione compressore",
    "Un compressore grippato o bruciato tolto dall'unità esterna e uno nuovo brasato, poi impianto messo sotto vuoto e ricaricato."
   ],
   "de": [
    "Verdichtertausch",
    "Ein festgefressener oder durchgebrannter Verdichter aus dem Außengerät ausgebaut, ein neuer eingelötet, dann evakuiert und neu befüllt."
   ],
   "uk": [
    "Заміна компресора",
    "Заклинений чи згорілий компресор знято з зовнішнього блока, новий впаяно, систему вакуумовано й заправлено."
   ],
   "pa": [
    "ਕੰਪ੍ਰੈਸਰ ਬਦਲਣਾ",
    "ਜਾਮ ਜਾਂ ਸੜਿਆ ਕੰਪ੍ਰੈਸਰ ਬਾਹਰੀ ਯੂਨਿਟ 'ਚੋਂ ਕੱਢ ਕੇ ਨਵਾਂ ਬ੍ਰੇਜ਼, ਫਿਰ ਸਿਸਟਮ ਖ਼ਾਲੀ ਅਤੇ ਮੁੜ ਚਾਰਜ।"
   ],
   "tl": [
    "Pagpapalit ng compressor",
    "Tinanggal ang stuck o sunog na compressor sa outdoor unit at ibinrazed ang bago, saka vinacuum at kinargahan."
   ]
  },
  "fq.hvac_repair.compressor.repair": {
   "it": [
    "Riparazione compressore",
    "Riparazione di un compressore in difficoltà o fermo: parti danneggiate sostituite, perdite riparate e refrigerante rabboccato, evitando dove possibile la sostituzione."
   ],
   "de": [
    "Verdichterreparatur",
    "Reparatur eines schwächelnden oder stehenden Verdichters: beschädigte Teile ersetzt, Lecks behoben, Kältemittel ergänzt — wo möglich ohne Komplettaustausch."
   ],
   "uk": [
    "Ремонт компресора",
    "Ремонт компресора, що слабне чи зупинився: деталі замінено, витоки усунено, холодоагент долито — без повної заміни, де можливо."
   ],
   "pa": [
    "ਕੰਪ੍ਰੈਸਰ ਦੀ ਮੁਰੰਮਤ",
    "ਔਖੇ ਚੱਲਦੇ ਜਾਂ ਰੁਕੇ ਕੰਪ੍ਰੈਸਰ ਦੀ ਮੁਰੰਮਤ: ਖ਼ਰਾਬ ਪੁਰਜ਼ੇ ਬਦਲੇ, ਲੀਕ ਠੀਕ ਅਤੇ ਰੈਫ਼ਰਿਜਰੈਂਟ ਭਰਿਆ, ਹੋ ਸਕੇ ਤਾਂ ਪੂਰੀ ਬਦਲੀ ਤੋਂ ਬਿਨਾਂ।"
   ],
   "tl": [
    "Pagkukumpuni ng compressor",
    "Pagkukumpuni ng nahihirapan o tumigil na compressor: pinalitan ang sirang piyesa, inayos ang tagas at dinagdagan ang refrigerant, iniiwasan ang buong pagpapalit."
   ]
  },
  "fq.hvac_repair.compressor.acid_test": {
   "it": [
    "Test di acidità del refrigerante",
    "Un campione di refrigerante testato per l'acido che si forma dopo una bruciatura del motore e corrode il compressore se non viene scoperto presto."
   ],
   "de": [
    "Säuretest des Kältemittels",
    "Eine Kältemittelprobe auf Säure getestet, die nach einem Motorbrand entsteht und den Verdichter angreift, wenn sie nicht früh erkannt wird."
   ],
   "uk": [
    "Тест холодоагенту на кислотність",
    "Пробу холодоагенту перевірено на кислоту, що утворюється після перегоряння двигуна й роз'їдає компресор."
   ],
   "pa": [
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਐਸਿਡ ਟੈਸਟ",
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਦਾ ਨਮੂਨਾ ਐਸਿਡ ਲਈ ਜਾਂਚਿਆ, ਜੋ ਮੋਟਰ ਸੜਨ ਤੋਂ ਬਾਅਦ ਬਣ ਕੇ ਜਲਦੀ ਨਾ ਫੜਿਆ ਜਾਵੇ ਤਾਂ ਕੰਪ੍ਰੈਸਰ ਨੂੰ ਖਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Acid test ng refrigerant",
    "Sinuri sa asido ang sample ng refrigerant, na nabubuo pagkasunog ng motor at kumakain sa compressor kung hindi maagapan."
   ]
  },
  "fq.hvac_repair.compressor.replace_and_startup": {
   "it": [
    "Sostituzione compressore con verifica all'avvio",
    "Vecchio compressore sostituito, poi l'intero impianto verificato all'avvio: pressioni, assorbimenti e temperature prima della riconsegna."
   ],
   "de": [
    "Verdichtertausch mit Inbetriebnahmeprüfung",
    "Alter Verdichter ersetzt, dann die ganze Anlage bei der Inbetriebnahme geprüft: Drücke, Stromaufnahme und Temperaturen vor der Übergabe."
   ],
   "uk": [
    "Заміна компресора з перевіркою запуску",
    "Старий компресор замінено, потім усю систему перевірено при запуску: тиски, струм і температури перед передачею."
   ],
   "pa": [
    "ਚਾਲੂ ਜਾਂਚ ਸਮੇਤ ਕੰਪ੍ਰੈਸਰ ਬਦਲਣਾ",
    "ਪੁਰਾਣਾ ਕੰਪ੍ਰੈਸਰ ਬਦਲ ਕੇ ਪੂਰਾ ਸਿਸਟਮ ਚਾਲੂ ਜਾਂਚ ਵਿੱਚੋਂ: ਦਬਾਅ, ਐਂਪੀਅਰ ਅਤੇ ਤਾਪਮਾਨ ਸੌਂਪਣ ਤੋਂ ਪਹਿਲਾਂ।"
   ],
   "tl": [
    "Pagpapalit ng compressor na may start-up check",
    "Pinalitan ang lumang compressor, saka sinuri ang buong sistema sa start-up: pressure, amperage at temperatura bago iabot."
   ]
  },
  "fq.hvac_repair.compressor.hard_start_kit": {
   "it": [
    "Installazione kit di avviamento",
    "Condensatore e relè di avviamento aggiunti all'unità esterna perché il compressore parta al primo colpo assorbendo meno corrente."
   ],
   "de": [
    "Einbau eines Anlaufhilfe-Kits",
    "Anlaufkondensator und Relais am Außengerät nachgerüstet, damit der Verdichter beim ersten Versuch und mit weniger Strom anläuft."
   ],
   "uk": [
    "Встановлення пускового комплекту",
    "Пусковий конденсатор і реле додано до зовнішнього блока, щоб компресор стартував з першого разу з меншим струмом."
   ],
   "pa": [
    "ਹਾਰਡ ਸਟਾਰਟ ਕਿੱਟ ਲਾਉਣਾ",
    "ਬਾਹਰੀ ਯੂਨਿਟ 'ਤੇ ਹਾਰਡ ਸਟਾਰਟ ਕੈਪੇਸੀਟਰ ਅਤੇ ਰਿਲੇ ਤਾਂ ਜੋ ਕੰਪ੍ਰੈਸਰ ਪਹਿਲੀ ਵਾਰ ਘੱਟ ਕਰੰਟ ਨਾਲ ਚੱਲੇ।"
   ],
   "tl": [
    "Pagkakabit ng hard start kit",
    "Nagdagdag ng hard start capacitor at relay sa outdoor unit para umandar agad ang compressor at mas kaunti ang kuryente."
   ]
  },
  "fq.hvac_repair.condensate.clean_drain_pan": {
   "it": [
    "Pulizia bacinella condensa",
    "Fanghi, alghe e detriti rimossi dalla bacinella perché l'acqua defluisca invece di traboccare su pavimento o soffitto."
   ],
   "de": [
    "Reinigung der Kondensatwanne",
    "Schlamm, Algen und Schmutz aus der Kondensatwanne entfernt, damit das Wasser abläuft statt auf Boden oder Decke überzulaufen."
   ],
   "uk": [
    "Чищення піддона конденсату",
    "Мул, водорості й сміття вичищено з піддона, щоб вода стікала, а не переливалася на підлогу чи стелю."
   ],
   "pa": [
    "ਡਰੇਨ ਪੈਨ ਦੀ ਸਫ਼ਾਈ",
    "ਕੰਡੈਂਸੇਟ ਪੈਨ ਵਿੱਚੋਂ ਗਾਰ, ਕਾਈ ਅਤੇ ਕੂੜਾ ਕੱਢਿਆ ਤਾਂ ਜੋ ਪਾਣੀ ਫ਼ਰਸ਼ ਜਾਂ ਛੱਤ 'ਤੇ ਡੁੱਲ੍ਹਣ ਦੀ ਥਾਂ ਨਿਕਲੇ।"
   ],
   "tl": [
    "Paglilinis ng drain pan",
    "Inalis ang putik, lumot at dumi sa condensate pan para dumaloy ang tubig at hindi umapaw sa sahig o kisame."
   ]
  },
  "fq.hvac_repair.condensate.clean_pump": {
   "it": [
    "Pulizia pompa condensa",
    "Serbatoio e galleggiante della pompa puliti e pompa provata, così solleva l'acqua in modo affidabile."
   ],
   "de": [
    "Reinigung der Kondensatpumpe",
    "Pumpenbehälter und Schwimmer gereinigt und die Pumpe probegefahren, damit sie das Wasser zuverlässig fördert."
   ],
   "uk": [
    "Чищення конденсатного насоса",
    "Резервуар і поплавок насоса почищено, насос перевірено — воду відкачує надійно."
   ],
   "pa": [
    "ਕੰਡੈਂਸੇਟ ਪੰਪ ਦੀ ਸਫ਼ਾਈ",
    "ਪੰਪ ਦੀ ਟੈਂਕੀ ਅਤੇ ਫ਼ਲੋਟ ਸਾਫ਼ ਅਤੇ ਪੰਪ ਚਲਾ ਕੇ ਦੇਖਿਆ, ਤਾਂ ਜੋ ਗਾਰ ਵਿੱਚ ਅਟਕਣ ਦੀ ਥਾਂ ਪਾਣੀ ਚੁੱਕੇ।"
   ],
   "tl": [
    "Paglilinis ng condensate pump",
    "Nilinis ang reservoir at float ng pump at pinaandar, para maaasahang itaas ang tubig."
   ]
  },
  "fq.hvac_repair.condensate.clear_flush_line": {
   "it": [
    "Stasatura e lavaggio linea condensa",
    "Linea condensa ostruita liberata con aspirazione o pressione e lavata, fine di gocciolamenti e blocchi."
   ],
   "de": [
    "Kondensatleitung freimachen und spülen",
    "Eine verstopfte Kondensatleitung per Saugen oder Druck freigemacht und durchgespült — Schluss mit Tropfen und Abschaltungen."
   ],
   "uk": [
    "Прочищення й промивання дренажної лінії",
    "Забиту лінію конденсату прочищено вакуумом чи тиском і промито — без крапель і відключень."
   ],
   "pa": [
    "ਕੰਡੈਂਸੇਟ ਲਾਈਨ ਖੋਲ੍ਹਣਾ ਅਤੇ ਫ਼ਲੱਸ਼",
    "ਬੰਦ ਕੰਡੈਂਸੇਟ ਲਾਈਨ ਵੈਕਿਊਮ ਜਾਂ ਦਬਾਅ ਨਾਲ ਖੋਲ੍ਹ ਕੇ ਫ਼ਲੱਸ਼, ਟਪਕਣਾ ਅਤੇ ਬੰਦ ਹੋਣਾ ਖ਼ਤਮ।"
   ],
   "tl": [
    "Paglilinis at pag-flush ng condensate line",
    "Binuksan sa vacuum o presyon at in-flush ang baradong linya, tapos na ang tulo at pagpatay ng sistema."
   ]
  },
  "fq.hvac_repair.condensate.replace_pump": {
   "it": [
    "Sostituzione pompa condensa",
    "Pompa condensa usurata o guasta sostituita, collegata e cablata, con il suo interruttore di sicurezza."
   ],
   "de": [
    "Austausch der Kondensatpumpe",
    "Eine verschlissene oder defekte Kondensatpumpe ersetzt, angeschlossen und verkabelt, inklusive Sicherheitsabschaltung."
   ],
   "uk": [
    "Заміна конденсатного насоса",
    "Зношений чи несправний насос замінено, під'єднано й підключено разом із запобіжним вимикачем."
   ],
   "pa": [
    "ਕੰਡੈਂਸੇਟ ਪੰਪ ਬਦਲਣਾ",
    "ਘਿਸਿਆ ਜਾਂ ਖ਼ਰਾਬ ਪੰਪ ਨਵੇਂ ਨਾਲ ਬਦਲ ਕੇ ਪਾਈਪ ਅਤੇ ਤਾਰਾਂ ਜੋੜੀਆਂ, ਸੇਫ਼ਟੀ ਕੱਟ-ਆਫ਼ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagpapalit ng condensate pump",
    "Pinalitan, ikinonekta at ikinabit ang sirang condensate pump, kasama ang safety cut-off."
   ]
  },
  "fq.hvac_repair.condensate.replace_line": {
   "it": [
    "Sostituzione linea condensa",
    "Linea di scarico crepata, cedevole o ostruita per sempre rimossa e rifatta con pendenza corretta e sifone."
   ],
   "de": [
    "Austausch der Kondensatleitung",
    "Eine gerissene, durchhängende oder dauerhaft verstopfte Leitung entfernt und mit richtigem Gefälle und Siphon neu verlegt."
   ],
   "uk": [
    "Заміна дренажної лінії",
    "Тріснуту, провислу чи безнадійно забиту лінію знято й прокладено нову з правильним ухилом і сифоном."
   ],
   "pa": [
    "ਕੰਡੈਂਸੇਟ ਲਾਈਨ ਬਦਲਣਾ",
    "ਤਿੜਕੀ, ਝੁਕੀ ਜਾਂ ਪੱਕੀ ਬੰਦ ਲਾਈਨ ਕੱਢ ਕੇ ਸਹੀ ਢਲਾਣ ਅਤੇ ਟ੍ਰੈਪ ਨਾਲ ਨਵੀਂ।"
   ],
   "tl": [
    "Pagpapalit ng condensate line",
    "Tinanggal ang bitak, lubog o permanenteng baradong linya at naglatag ng bago na may tamang hilig at trap."
   ]
  },
  "fq.hvac_repair.condensate.maintain_drainage": {
   "it": [
    "Manutenzione del sistema di scarico",
    "Bacinella, sifone, linea e pompa puliti e controllati in una visita, perché la condensa scorra per tutta la stagione."
   ],
   "de": [
    "Wartung des Ablaufsystems",
    "Wanne, Siphon, Leitung und Pumpe in einem Termin gereinigt und geprüft, damit das Kondensat die ganze Saison abläuft."
   ],
   "uk": [
    "Обслуговування дренажної системи",
    "Піддон, сифон, лінію й насос почищено й перевірено за один візит на весь сезон."
   ],
   "pa": [
    "ਨਿਕਾਸ ਸਿਸਟਮ ਦੀ ਸੰਭਾਲ",
    "ਪੈਨ, ਟ੍ਰੈਪ, ਲਾਈਨ ਅਤੇ ਪੰਪ ਇੱਕ ਵਿਜ਼ਿਟ ਵਿੱਚ ਸਾਫ਼ ਅਤੇ ਜਾਂਚੇ, ਤਾਂ ਜੋ ਪੂਰੇ ਮੌਸਮ ਪਾਣੀ ਨਿਕਲਦਾ ਰਹੇ।"
   ],
   "tl": [
    "Maintenance ng drainage",
    "Nilinis at sinuri sa iisang visit ang pan, trap, linya at pump para tuloy ang daloy buong season."
   ]
  },
  "fq.hvac_repair.condensate.drain_pan_switch": {
   "pa": [
    "ਡਰੇਨ ਪੈਨ ਓਵਰਫ਼ਲੋ ਸਵਿੱਚ ਲਾਉਣਾ",
    "ਡਰੇਨ ਪੈਨ ਵਿੱਚ ਫ਼ਲੋਟ ਸਵਿੱਚ ਜੋ ਪਾਣੀ ਚੜ੍ਹਨ 'ਤੇ ਸਿਸਟਮ ਬੰਦ ਕਰਦਾ ਹੈ, ਤਾਂ ਜੋ ਰੁਕਾਵਟ ਛੱਤ ਦਾ ਦਾਗ਼ ਨਾ ਬਣੇ।"
   ]
  },
  "fq.hvac_repair.condenser.clean_coil": {
   "it": [
    "Pulizia batteria dell'unità esterna",
    "Batteria esterna lavata da sporco, lanugine e erba perché smaltisca il calore e il compressore non lavori oltre il dovuto."
   ],
   "de": [
    "Reinigung des Verflüssigerregisters",
    "Das Außenregister von Schmutz, Pappelwolle und Grasschnitt freigewaschen, damit es Wärme abgibt und der Verdichter nicht überlastet."
   ],
   "uk": [
    "Чищення теплообмінника конденсатора",
    "Зовнішній теплообмінник відмито від бруду, пуху й трави, щоб віддавав тепло, а компресор не перевантажувався."
   ],
   "pa": [
    "ਕੰਡੈਂਸਰ ਕੌਇਲ ਦੀ ਸਫ਼ਾਈ",
    "ਬਾਹਰਲੀ ਕੌਇਲ ਗੰਦਗੀ, ਰੂੰ ਅਤੇ ਘਾਹ ਤੋਂ ਧੋਤੀ ਤਾਂ ਜੋ ਗਰਮੀ ਕੱਢੇ ਅਤੇ ਕੰਪ੍ਰੈਸਰ ਵਾਧੂ ਨਾ ਚੱਲੇ।"
   ],
   "tl": [
    "Paglilinis ng condenser coil",
    "Hinugasan ang outdoor coil mula sa dumi, bulak at damo para makapaglabas ng init at hindi mapagod ang compressor."
   ]
  },
  "fq.hvac_repair.condenser.level_risers": {
   "it": [
    "Livellamento unità esterna su rialzi",
    "Unità esterna sprofondata o inclinata sollevata e messa in piano su rialzi, perché l'olio torni al compressore e la ventola non strisci."
   ],
   "de": [
    "Verflüssiger auf Füßen nivellieren",
    "Ein abgesacktes oder schiefes Außengerät angehoben und auf Füßen waagerecht gesetzt, damit Öl zum Verdichter zurückläuft und der Lüfter nicht schleift."
   ],
   "uk": [
    "Вирівнювання конденсатора на підставках",
    "Просілий чи нахилений блок піднято й вирівняно на підставках, щоб олива поверталася в компресор, а вентилятор не терся."
   ],
   "pa": [
    "ਰਾਈਜ਼ਰਾਂ 'ਤੇ ਕੰਡੈਂਸਰ ਪੱਧਰਾ ਕਰਨਾ",
    "ਧੱਸਿਆ ਜਾਂ ਟੇਢਾ ਬਾਹਰੀ ਯੂਨਿਟ ਚੁੱਕ ਕੇ ਰਾਈਜ਼ਰਾਂ 'ਤੇ ਪੱਧਰਾ, ਤਾਂ ਜੋ ਤੇਲ ਕੰਪ੍ਰੈਸਰ ਵਿੱਚ ਮੁੜੇ ਅਤੇ ਪੱਖਾ ਨਾ ਰਗੜੇ।"
   ],
   "tl": [
    "Pagpapantay ng condenser sa riser",
    "Inangat at pinantay sa riser ang lumubog o nakahilig na outdoor unit para bumalik ang langis sa compressor at hindi kumiskis ang fan."
   ]
  },
  "fq.hvac_repair.condenser.leak_check": {
   "it": [
    "Verifica perdite unità esterna",
    "Batteria, raccordi e valvole dell'unità esterna controllati per perdite di refrigerante prima che la carica bassa bruci il compressore."
   ],
   "de": [
    "Dichtheitsprüfung am Verflüssiger",
    "Register, Verbindungen und Ventile des Außengeräts auf Kältemittelverlust geprüft, bevor wenig Füllung den Verdichter tötet."
   ],
   "uk": [
    "Перевірка конденсатора на витоки",
    "Теплообмінник, з'єднання й клапани зовнішнього блока перевірено на витік, поки нестача не вбила компресор."
   ],
   "pa": [
    "ਕੰਡੈਂਸਰ ਲੀਕ ਜਾਂਚ",
    "ਬਾਹਰੀ ਯੂਨਿਟ ਦੀ ਕੌਇਲ, ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਵਾਲਵ ਰੈਫ਼ਰਿਜਰੈਂਟ ਘਟਣ ਲਈ ਜਾਂਚੇ, ਘੱਟ ਚਾਰਜ ਕੰਪ੍ਰੈਸਰ ਖ਼ਰਾਬ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ।"
   ],
   "tl": [
    "Pagsuri ng tagas sa condenser",
    "Sinuri ang coil, fitting at valve ng outdoor unit sa tagas bago masira ng kulang na karga ang compressor."
   ]
  },
  "fq.hvac_repair.condenser.replace_service_valve": {
   "it": [
    "Sostituzione valvola di servizio liquido o aspirazione",
    "Valvola di servizio che perde o bloccata sull'unità esterna sostituita, poi impianto messo sotto vuoto e ricaricato."
   ],
   "de": [
    "Austausch des Flüssigkeits- oder Saugserviceventils",
    "Ein undichtes oder festsitzendes Serviceventil am Außengerät ausgelötet und ersetzt, danach evakuiert und neu befüllt."
   ],
   "uk": [
    "Заміна сервісного клапана рідини чи всмоктування",
    "Негерметичний чи заклинений сервісний клапан випаяно й замінено, систему вакуумовано й заправлено."
   ],
   "pa": [
    "ਲਿਕੁਇਡ ਜਾਂ ਸਕਸ਼ਨ ਸਰਵਿਸ ਵਾਲਵ ਬਦਲਣਾ",
    "ਬਾਹਰੀ ਯੂਨਿਟ ਦਾ ਲੀਕ ਜਾਂ ਜਾਮ ਸਰਵਿਸ ਵਾਲਵ ਬਦਲ ਕੇ ਸਿਸਟਮ ਖ਼ਾਲੀ ਅਤੇ ਮੁੜ ਚਾਰਜ।"
   ],
   "tl": [
    "Pagpapalit ng liquid o suction service valve",
    "Pinalitan ang tumatagas o stuck na service valve sa outdoor unit, saka vinacuum at kinargahan."
   ]
  },
  "fq.hvac_repair.condenser.fan_motor_service": {
   "it": [
    "Riparazione o sostituzione motore ventola esterna",
    "Motore che ronza, si blocca o scalda riparato se possibile, altrimenti sostituito, così la batteria esterna riprende aria."
   ],
   "de": [
    "Reparatur oder Tausch des Verflüssiger-Lüftermotors",
    "Ein brummender, stockender oder heißlaufender Lüftermotor repariert, wo möglich, sonst ersetzt, damit das Außenregister wieder Luft bekommt."
   ],
   "uk": [
    "Ремонт чи заміна двигуна вентилятора конденсатора",
    "Двигун, що гуде, зупиняється чи перегрівається, ремонтують або замінюють, щоб теплообмінник знову отримував повітря."
   ],
   "pa": [
    "ਕੰਡੈਂਸਰ ਪੱਖਾ ਮੋਟਰ ਮੁਰੰਮਤ ਜਾਂ ਬਦਲੀ",
    "ਘੂੰ-ਘੂੰ ਕਰਦੀ, ਰੁਕਦੀ ਜਾਂ ਗਰਮ ਹੁੰਦੀ ਮੋਟਰ ਜਿੱਥੇ ਹੋ ਸਕੇ ਠੀਕ, ਨਹੀਂ ਤਾਂ ਬਦਲੀ, ਤਾਂ ਜੋ ਬਾਹਰਲੀ ਕੌਇਲ ਨੂੰ ਹਵਾ ਮਿਲੇ।"
   ],
   "tl": [
    "Pagkukumpuni o pagpapalit ng fan motor ng condenser",
    "Inaayos kung kaya, kung hindi ay pinapalitan, ang motor na umuugong, humihinto o umiinit, para bumalik ang hangin sa coil."
   ]
  },
  "fq.hvac_repair.condenser.fan_motor_and_blade": {
   "it": [
    "Sostituzione motore e pala ventola esterna",
    "Motore e pala sostituiti insieme come coppia, la scelta giusta quando la pala è piegata o il mozzo è grippato sul vecchio albero."
   ],
   "de": [
    "Tausch von Lüftermotor und Flügel am Verflüssiger",
    "Motor und Lüfterflügel zusammen ersetzt — richtig, wenn der Flügel verbogen oder die Nabe auf der alten Welle festsitzt."
   ],
   "uk": [
    "Заміна двигуна й лопаті вентилятора конденсатора",
    "Двигун і лопать замінено парою — правильно, коли лопать погнута чи маточина прикипіла до старого вала."
   ],
   "pa": [
    "ਕੰਡੈਂਸਰ ਪੱਖਾ ਮੋਟਰ ਅਤੇ ਬਲੇਡ ਬਦਲਣਾ",
    "ਮੋਟਰ ਅਤੇ ਬਲੇਡ ਇਕੱਠੇ ਬਦਲੇ, ਜਦੋਂ ਬਲੇਡ ਮੁੜਿਆ ਹੋਵੇ ਜਾਂ ਹੱਬ ਪੁਰਾਣੇ ਧੁਰੇ 'ਤੇ ਜਾਮ ਹੋਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng fan motor at blade ng condenser",
    "Sabay na pinalitan ang motor at blade, tama kapag baluktot ang blade o stuck ang hub sa lumang shaft."
   ]
  },
  "fq.hvac_repair.condenser.replace_fan_blade": {
   "it": [
    "Sostituzione pala ventola esterna",
    "Pala crepata o piegata sostituita e bilanciata, fine di oscillazioni e rumore."
   ],
   "de": [
    "Tausch des Verflüssiger-Lüfterflügels",
    "Ein gerissener oder verbogener Außenlüfterflügel ersetzt und ausgewuchtet — Schluss mit Wackeln und Lärm."
   ],
   "uk": [
    "Заміна лопаті вентилятора конденсатора",
    "Тріснуту чи погнуту лопать замінено й збалансовано — без хитання й шуму."
   ],
   "pa": [
    "ਕੰਡੈਂਸਰ ਪੱਖਾ ਬਲੇਡ ਬਦਲਣਾ",
    "ਤਿੜਕਿਆ ਜਾਂ ਮੁੜਿਆ ਬਲੇਡ ਬਦਲ ਕੇ ਸੰਤੁਲਿਤ, ਹਿੱਲਣਾ ਅਤੇ ਰੌਲਾ ਖ਼ਤਮ।"
   ],
   "tl": [
    "Pagpapalit ng fan blade ng condenser",
    "Pinalitan at binalanse ang bitak o baluktot na blade, tapos ang yugyog at ingay."
   ]
  },
  "fq.hvac_repair.condenser.remount_fan_blade": {
   "it": [
    "Rimontaggio e riallineamento pala ventola",
    "Pala scivolata sull'albero o fuori asse rimessa, allineata e bloccata perché giri libera dalla griglia."
   ],
   "de": [
    "Lüfterflügel neu setzen und ausrichten",
    "Ein auf der Welle verrutschter oder schlagender Flügel neu gesetzt, ausgerichtet und fixiert, damit er frei von der Blende dreht."
   ],
   "uk": [
    "Переустановлення й вирівнювання лопаті",
    "Лопать, що зсунулася чи б'є, переставлено, вирівняно й зафіксовано, щоб оберталася вільно."
   ],
   "pa": [
    "ਪੱਖਾ ਬਲੇਡ ਮੁੜ ਲਾਉਣਾ ਅਤੇ ਸਿੱਧਾ ਕਰਨਾ",
    "ਧੁਰੇ 'ਤੇ ਖਿਸਕਿਆ ਜਾਂ ਟੇਢਾ ਬਲੇਡ ਮੁੜ ਲਾ ਕੇ ਸਿੱਧਾ ਅਤੇ ਕੱਸਿਆ, ਤਾਂ ਜੋ ਖੁੱਲ੍ਹ ਕੇ ਘੁੰਮੇ।"
   ],
   "tl": [
    "Muling pagkabit at pag-align ng fan blade",
    "Muling ikinabit, in-align at ikinandado ang dumulas o hindi tuwid na blade para malayang umikot."
   ]
  },
  "fq.hvac_repair.condenser.install_fan_motor": {
   "it": [
    "Installazione motore ventola esterna",
    "Nuovo motore della potenza, velocità e rotazione corrette montato sull'unità esterna e collegato al condensatore."
   ],
   "de": [
    "Einbau eines Verflüssiger-Lüftermotors",
    "Ein neuer Lüftermotor mit richtiger Leistung, Drehzahl und Drehrichtung am Außengerät montiert und an den Kondensator angeschlossen."
   ],
   "uk": [
    "Встановлення двигуна вентилятора конденсатора",
    "Новий двигун потрібної потужності, обертів і напрямку встановлено й під'єднано до конденсатора."
   ],
   "pa": [
    "ਕੰਡੈਂਸਰ ਪੱਖਾ ਮੋਟਰ ਲਾਉਣਾ",
    "ਸਹੀ ਹਾਰਸਪਾਵਰ, RPM ਅਤੇ ਘੁੰਮਣ ਵਾਲੀ ਨਵੀਂ ਮੋਟਰ ਬਾਹਰੀ ਯੂਨਿਟ 'ਤੇ ਲਾ ਕੇ ਕੈਪੇਸੀਟਰ ਨਾਲ ਜੋੜੀ।"
   ],
   "tl": [
    "Pagkakabit ng fan motor ng condenser",
    "Ikinabit sa outdoor unit ang bagong motor na tamang horsepower, RPM at ikot at ikinonekta sa capacitor."
   ]
  },
  "fq.hvac_repair.condenser.install_condenser": {
   "it": [
    "Installazione unità condensante",
    "Unità esterna posata sul basamento, collegata a linee e impianto elettrico, avviata e verificata."
   ],
   "de": [
    "Einbau des Verflüssigers",
    "Ein Außengerät auf den Sockel gesetzt, an Leitungen und Elektrik angeschlossen, gestartet und geprüft."
   ],
   "uk": [
    "Встановлення конденсаторного блока",
    "Зовнішній блок встановлено на підставку, під'єднано до трас і електрики, запущено й перевірено."
   ],
   "pa": [
    "ਕੰਡੈਂਸਰ ਯੂਨਿਟ ਲਾਉਣਾ",
    "ਬਾਹਰੀ ਯੂਨਿਟ ਪੈਡ 'ਤੇ ਰੱਖ ਕੇ ਲਾਈਨ ਸੈੱਟ ਅਤੇ ਬਿਜਲੀ ਨਾਲ ਜੋੜਿਆ, ਚਾਲੂ ਕਰਕੇ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Pagkakabit ng condenser unit",
    "Inilagay sa pad ang outdoor unit, ikinonekta sa linya at kuryente, pinaandar at sinuri."
   ]
  },
  "fq.hvac_repair.belts.adjust_belt_pulley": {
   "it": [
    "Regolazione cinghia e puleggia",
    "Tensione della cinghia e allineamento delle pulegge corretti, fine dello stridio e dell'usura."
   ],
   "de": [
    "Riemen und Riemenscheibe einstellen",
    "Riemenspannung und Scheibenflucht am riemengetriebenen Gebläse korrigiert — kein Quietschen, weniger Verschleiß."
   ],
   "uk": [
    "Регулювання паса та шківа",
    "Натяг паса й співвісність шківів виправлено — без вереску й зайвого зносу."
   ],
   "pa": [
    "ਬੈਲਟ ਅਤੇ ਪੁਲੀ ਦੀ ਸੈਟਿੰਗ",
    "ਬੈਲਟ ਵਾਲੇ ਬਲੋਅਰ ਦਾ ਕੱਸਾਅ ਅਤੇ ਪੁਲੀ ਸਿੱਧੀ ਕੀਤੀ, ਚੀਂ-ਚੀਂ ਅਤੇ ਘਿਸਾਈ ਬੰਦ।"
   ],
   "tl": [
    "Pag-adjust ng belt at pulley",
    "Itinama ang higpit ng belt at pagkakahanay ng pulley, tapos ang langitngit at pagkasira."
   ]
  },
  "fq.hvac_repair.belts.replace_belt": {
   "it": [
    "Sostituzione cinghia ventilatore",
    "Cinghia crepata, lucida o allungata sostituita con una della misura giusta e tesa."
   ],
   "de": [
    "Austausch des Gebläseriemens",
    "Ein rissiger, glasiger oder gedehnter Riemen durch einen passenden ersetzt und gespannt."
   ],
   "uk": [
    "Заміна паса вентилятора",
    "Тріснутий, заполірований чи розтягнутий пас замінено потрібним і натягнуто."
   ],
   "pa": [
    "ਬਲੋਅਰ ਬੈਲਟ ਬਦਲਣਾ",
    "ਤਿੜਕੀ, ਚਿਕਨੀ ਜਾਂ ਖਿੱਚੀ ਬੈਲਟ ਸਹੀ ਨਾਪ ਦੀ ਨਾਲ ਬਦਲ ਕੇ ਕੱਸੀ।"
   ],
   "tl": [
    "Pagpapalit ng blower belt",
    "Pinalitan ng tamang sukat at hinigpitan ang bitak, makintab o banat na belt."
   ]
  },
  "fq.hvac_repair.belts.replace_pulley": {
   "it": [
    "Sostituzione puleggia ventilatore",
    "Puleggia usurata o oscillante sostituita e cinghia ritesa perché la trasmissione giri dritta."
   ],
   "de": [
    "Austausch der Gebläse-Riemenscheibe",
    "Eine abgenutzte oder schlagende Scheibe ersetzt und der Riemen nachgespannt, damit der Antrieb rund läuft."
   ],
   "uk": [
    "Заміна шківа вентилятора",
    "Зношений чи биттям шків замінено, пас перетягнуто — привід іде рівно."
   ],
   "pa": [
    "ਬਲੋਅਰ ਪੁਲੀ ਬਦਲਣਾ",
    "ਘਿਸੀ ਜਾਂ ਹਿੱਲਦੀ ਪੁਲੀ ਬਦਲ ਕੇ ਬੈਲਟ ਮੁੜ ਕੱਸੀ ਤਾਂ ਜੋ ਡਰਾਈਵ ਸਿੱਧੀ ਚੱਲੇ।"
   ],
   "tl": [
    "Pagpapalit ng blower pulley",
    "Pinalitan ang gasgas o umuugang pulley at muling hinigpitan ang belt para tuwid ang takbo."
   ]
  },
  "fq.hvac_repair.air_quality.replace_filter": {
   "pa": [
    "ਏਅਰ ਫ਼ਿਲਟਰ ਬਦਲਣਾ",
    "ਸਿਸਟਮ ਦਾ ਫ਼ਿਲਟਰ ਸਹੀ ਨਾਪ ਅਤੇ ਦਰਜੇ ਦੇ ਨਵੇਂ ਨਾਲ ਬਦਲਿਆ, ਹਵਾ ਸਾਫ਼ ਅਤੇ ਬਲੋਅਰ 'ਤੇ ਜ਼ੋਰ ਨਹੀਂ।"
   ]
  },
  "fq.hvac_repair.air_quality.clean_ducts": {
   "pa": [
    "ਏਅਰ ਡਕਟ ਦੀ ਸਫ਼ਾਈ",
    "ਸਪਲਾਈ ਅਤੇ ਰਿਟਰਨ ਡਕਟਾਂ ਧੂੜ ਅਤੇ ਕੂੜੇ ਤੋਂ ਵੈਕਿਊਮ ਅਤੇ ਬੁਰਸ਼ ਨਾਲ ਸਾਫ਼, ਰਜਿਸਟਰ ਪੂੰਝੇ।"
   ]
  },
  "fq.hvac_repair.air_quality.iaq_testing": {
   "pa": [
    "ਅੰਦਰਲੀ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਦਾ ਟੈਸਟ",
    "ਘਰ ਵਿੱਚ ਕਣ, ਨਮੀ, ਕਾਰਬਨ ਡਾਈਆਕਸਾਈਡ ਅਤੇ ਅਸਥਿਰ ਰਸਾਇਣ ਮਾਪੇ, ਲਿਖਤੀ ਨਤੀਜਾ ਅਤੇ ਹਰ ਰੀਡਿੰਗ ਦਾ ਹੱਲ।"
   ]
  },
  "fq.hvac_repair.air_quality.uv_purifier_install": {
   "pa": [
    "UV ਹਵਾ ਸ਼ੁੱਧ ਕਰਨ ਵਾਲਾ ਲਾਉਣਾ",
    "ਏਅਰ ਹੈਂਡਲਰ ਜਾਂ ਡਕਟ ਵਿੱਚ UV ਲੈਂਪ ਤਾਂ ਜੋ ਕੌਇਲ 'ਤੇ ਉੱਲੀ ਅਤੇ ਬੈਕਟੀਰੀਆ ਨਾ ਰਹਿਣ।"
   ]
  },
  "fq.hvac_repair.air_quality.seal_insulate_ducts": {
   "it": [
    "Sigillatura e isolamento condotti",
    "Giunti che perdono sigillati con mastice e tratti esposti rivestiti, perché l'aria arrivi nelle stanze e non in soffitta."
   ],
   "de": [
    "Kanäle abdichten und dämmen",
    "Undichte Stöße mit Mastix abgedichtet und freiliegende Strecken ummantelt, damit die Luft in die Räume statt auf den Dachboden gelangt."
   ],
   "uk": [
    "Герметизація та утеплення повітроводів",
    "Негерметичні стики замащено мастикою, відкриті ділянки обгорнуто — повітря йде в кімнати, а не на горище."
   ],
   "pa": [
    "ਡਕਟਾਂ ਦੀ ਸੀਲਿੰਗ ਅਤੇ ਇੰਸੂਲੇਸ਼ਨ",
    "ਲੀਕ ਜੋੜ ਮਸਤਕੀ ਨਾਲ ਸੀਲ ਅਤੇ ਖੁੱਲ੍ਹੀਆਂ ਡਕਟਾਂ ਲਪੇਟੀਆਂ, ਤਾਂ ਜੋ ਹਵਾ ਅਟਾਰੀ ਦੀ ਥਾਂ ਕਮਰਿਆਂ ਤੱਕ ਜਾਵੇ।"
   ],
   "tl": [
    "Pagselyo at pag-insulate ng duct",
    "Sinelyuhan ng mastic ang tumatagas na dugtungan at binalot ang lantad na duct, para sa silid pumunta ang hangin at hindi sa attic."
   ]
  },
  "fq.hvac_repair.air_quality.replace_uv_bulbs": {
   "it": [
    "Sostituzione lampade UV",
    "Lampade UV esaurite del purificatore sostituite: perdono efficacia molto prima di smettere di accendersi."
   ],
   "de": [
    "Austausch der UV-Lampen",
    "Verbrauchte UV-Lampen im Luftreiniger ersetzt — sie verlieren ihre Wirkung lange bevor sie aufhören zu leuchten."
   ],
   "uk": [
    "Заміна УФ-ламп",
    "Відпрацьовані УФ-лампи очищувача замінено — вони втрачають дію задовго до того, як згаснуть."
   ],
   "pa": [
    "UV ਬਲਬ ਬਦਲਣਾ",
    "ਹਵਾ ਸ਼ੁੱਧ ਕਰਨ ਵਾਲੇ ਦੇ ਖ਼ਤਮ UV ਲੈਂਪ ਬਦਲੇ — ਉਹ ਬਲਣਾ ਬੰਦ ਕਰਨ ਤੋਂ ਬਹੁਤ ਪਹਿਲਾਂ ਅਸਰ ਗੁਆ ਲੈਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagpapalit ng UV bulb",
    "Pinalitan ang ubos na UV lamp ng purifier — nawawalan sila ng bisa bago pa tumigil sa pag-ilaw."
   ]
  },
  "fq.hvac_repair.maintenance.furnace_cleaning": {
   "it": [
    "Pulizia caldaia ad aria",
    "Bruciatori, vano ventilatore e condotti puliti da polvere e fuliggine per una combustione più pulita e silenziosa."
   ],
   "de": [
    "Ofenreinigung",
    "Brenner, Gebläseraum und Abzüge von Staub und Ruß gereinigt — sauberere Verbrennung, leiserer Lauf."
   ],
   "uk": [
    "Чищення печі",
    "Пальники, відсік вентилятора й канали очищено від пилу й сажі — чистіше горіння й тихіша робота."
   ],
   "pa": [
    "ਫ਼ਰਨੇਸ ਦੀ ਸਫ਼ਾਈ",
    "ਬਰਨਰ, ਬਲੋਅਰ ਵਾਲਾ ਹਿੱਸਾ ਅਤੇ ਵੈਂਟ ਧੂੜ ਅਤੇ ਕਾਲਖ ਤੋਂ ਸਾਫ਼, ਸਾਫ਼ ਬਲਣਾ ਅਤੇ ਸ਼ਾਂਤ ਚੱਲਣਾ।"
   ],
   "tl": [
    "Paglilinis ng furnace",
    "Nilinis ang burner, blower compartment at vent mula sa alikabok at uling para mas malinis at tahimik."
   ]
  },
  "fq.hvac_repair.controls.maintain_capacitors": {
   "it": [
    "Test e manutenzione condensatori",
    "Condensatori di avvio e marcia testati rispetto al valore nominale e quelli deboli segnalati prima che blocchino il motore."
   ],
   "de": [
    "Prüfung und Wartung der Kondensatoren",
    "Anlauf- und Betriebskondensatoren gegen ihren Nennwert gemessen, schwache gemeldet, bevor sie den Motor an einem heißen Tag lahmlegen."
   ],
   "uk": [
    "Перевірка й обслуговування конденсаторів",
    "Пускові й робочі конденсатори виміряно проти номіналу, слабкі позначено, поки не зупинили двигун у спеку."
   ],
   "pa": [
    "ਕੈਪੇਸੀਟਰ ਟੈਸਟ ਅਤੇ ਸੰਭਾਲ",
    "ਸਟਾਰਟ ਅਤੇ ਰਨ ਕੈਪੇਸੀਟਰ ਉਹਨਾਂ ਦੇ ਦਰਜੇ ਨਾਲ ਜਾਂਚੇ, ਕਮਜ਼ੋਰ ਵਾਲੇ ਗਰਮੀ ਵਿੱਚ ਮੋਟਰ ਰੋਕਣ ਤੋਂ ਪਹਿਲਾਂ ਦੱਸੇ।"
   ],
   "tl": [
    "Pagsubok at maintenance ng capacitor",
    "Sinukat ang start at run capacitor laban sa rating at iniulat ang mahina bago mapatigil ang motor sa mainit na araw."
   ]
  },
  "fq.hvac_repair.controls.repair_defrost_board": {
   "it": [
    "Riparazione scheda di sbrinamento",
    "Pompa di calore che ghiaccia o non sbrina mai: scheda di sbrinamento diagnosticata e riparata."
   ],
   "de": [
    "Reparatur der Abtauplatine",
    "Eine Wärmepumpe, die vereist oder nie abtaut: Abtausteuerplatine diagnostiziert und repariert."
   ],
   "uk": [
    "Ремонт плати відтавання",
    "Тепловий насос обмерзає чи не відтає: плату відтавання продіагностовано й відремонтовано."
   ],
   "pa": [
    "ਡੀਫ਼ਰੌਸਟ ਬੋਰਡ ਦੀ ਮੁਰੰਮਤ",
    "ਬਰਫ਼ ਜੰਮਣ ਵਾਲੇ ਜਾਂ ਕਦੇ ਨਾ ਪਿਘਲਣ ਵਾਲੇ ਹੀਟ ਪੰਪ ਦਾ ਡੀਫ਼ਰੌਸਟ ਬੋਰਡ ਜਾਂਚ ਕੇ ਠੀਕ।"
   ],
   "tl": [
    "Pagkukumpuni ng defrost board",
    "Heat pump na nagyeyelo o hindi nagde-defrost: sinuri at inayos ang defrost control board."
   ]
  },
  "fq.hvac_repair.maintenance.seal_attic_crawlspace": {
   "it": [
    "Sigillatura di sottotetto e vespaio",
    "Fessure, passaggi e aperture in sottotetto e vespaio sigillati contro spifferi e ingresso di roditori."
   ],
   "de": [
    "Luftdichtung von Dachboden und Kriechkeller",
    "Spalten, Durchdringungen und Öffnungen in Dachboden und Kriechkeller gegen Luftverlust und Nager abgedichtet."
   ],
   "uk": [
    "Герметизація горища й підпілля",
    "Щілини, проходи й отвори на горищі та в підпіллі закрито від протягів і гризунів."
   ],
   "pa": [
    "ਅਟਾਰੀ ਅਤੇ ਕ੍ਰੌਲਸਪੇਸ ਦੀ ਹਵਾ ਸੀਲਿੰਗ",
    "ਅਟਾਰੀ ਅਤੇ ਕ੍ਰੌਲਸਪੇਸ ਦੀਆਂ ਦਰਾਰਾਂ, ਛੇਕ ਅਤੇ ਖੁੱਲ੍ਹੀਆਂ ਥਾਵਾਂ ਹਵਾ ਅਤੇ ਚੂਹਿਆਂ ਤੋਂ ਸੀਲ।"
   ],
   "tl": [
    "Air sealing ng attic at crawlspace",
    "Sinelyuhan ang siwang, butas at bukana sa attic at crawlspace laban sa tagas ng hangin at daga."
   ]
  },
  "fq.hvac_repair.controls.replace_capacitor": {
   "pa": [
    "ਕੈਪੇਸੀਟਰ ਬਦਲਣਾ",
    "ਖ਼ਰਾਬ ਰਨ ਜਾਂ ਸਟਾਰਟ ਕੈਪੇਸੀਟਰ ਮੇਲ ਖਾਂਦੇ ਦਰਜੇ ਵਾਲੇ ਨਾਲ ਬਦਲਿਆ ਤਾਂ ਜੋ ਕੰਪ੍ਰੈਸਰ ਜਾਂ ਪੱਖਾ ਮੁੜ ਚੱਲੇ।"
   ]
  },
  "fq.hvac_repair.controls.replace_contactor": {
   "it": [
    "Sostituzione contattore",
    "Contattore butterato o incollato sostituito perché l'unità esterna si accenda e spenga in modo netto."
   ],
   "de": [
    "Austausch des Schützes",
    "Ein verbranntes oder verschweißtes Schütz ersetzt, damit das Außengerät sauber ein- und ausschaltet."
   ],
   "uk": [
    "Заміна контактора",
    "Обгорілий чи зварений контактор замінено — зовнішній блок чітко вмикається й вимикається."
   ],
   "pa": [
    "ਕੌਂਟੈਕਟਰ ਬਦਲਣਾ",
    "ਖੁਰਿਆ ਜਾਂ ਚਿਪਕਿਆ ਕੌਂਟੈਕਟਰ ਬਦਲਿਆ ਤਾਂ ਜੋ ਬਾਹਰੀ ਯੂਨਿਟ ਸਾਫ਼ ਚਾਲੂ-ਬੰਦ ਹੋਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng contactor",
    "Pinalitan ang sunog o dikit na contactor para malinis ang pag-on at off ng outdoor unit."
   ]
  },
  "fq.hvac_repair.maintenance.blown_in_insulation": {
   "it": [
    "Isolamento insufflato nel sottotetto",
    "Fibra di vetro sfusa insufflata nel sottotetto fino al valore R concordato, uniforme su tutto il solaio e attorno alle botole."
   ],
   "de": [
    "Eingeblasene Dachbodendämmung",
    "Loser Glaswollefüllstoff bis zum vereinbarten R-Wert gleichmäßig auf den Dachboden und um die Luken geblasen."
   ],
   "uk": [
    "Задувне утеплення горища",
    "Насипну скловату задуто на горище до погодженого R-значення рівно по всій площі й навколо люків."
   ],
   "pa": [
    "ਅਟਾਰੀ ਵਿੱਚ ਉਡਾਈ ਇੰਸੂਲੇਸ਼ਨ",
    "ਢਿੱਲਾ ਫ਼ਾਈਬਰਗਲਾਸ ਅਟਾਰੀ ਵਿੱਚ ਤੈਅ R-ਮੁੱਲ ਤੱਕ ਬਰਾਬਰ ਉਡਾਇਆ, ਢੱਕਣਾਂ ਦੁਆਲੇ ਵੀ।"
   ],
   "tl": [
    "Blown-in na insulasyon sa attic",
    "Hinipan sa attic ang loose-fill na fiberglass hanggang sa napagkasunduang R-value, pantay sa buong sahig at paligid ng hatch."
   ]
  },
  "fq.hvac_repair.maintenance.ac_tune_up": {
   "pa": [
    "ਏਸੀ ਟਿਊਨ-ਅੱਪ",
    "ਕੂਲਿੰਗ ਸਿਸਟਮ ਦੀ ਮੌਸਮੀ ਜਾਂਚ: ਰੈਫ਼ਰਿਜਰੈਂਟ ਦਬਾਅ, ਬਿਜਲੀ ਕਨੈਕਸ਼ਨ, ਕੈਪੇਸੀਟਰ, ਕੌਇਲ ਅਤੇ ਡਰੇਨ, ਜੋ ਗ਼ਲਤ ਹੋਵੇ ਨੋਟ।"
   ]
  },
  "fq.hvac_repair.controls.thermostat_wiring": {
   "it": [
    "Verifica o sostituzione cablaggio termostato",
    "Cavo del termostato controllato da capo a capo e sostituito dove interrotto, in corto o con troppi pochi conduttori."
   ],
   "de": [
    "Prüfung oder Austausch der Thermostatverkabelung",
    "Das Thermostatkabel durchgehend geprüft und ersetzt, wo es unterbrochen, kurzgeschlossen oder zu dünn besetzt ist."
   ],
   "uk": [
    "Перевірка чи заміна проводки термостата",
    "Кабель термостата перевірено по всій довжині й замінено там, де обрив, замикання чи замало жил."
   ],
   "pa": [
    "ਥਰਮੋਸਟੈਟ ਵਾਇਰਿੰਗ ਦੀ ਜਾਂਚ ਜਾਂ ਬਦਲੀ",
    "ਥਰਮੋਸਟੈਟ ਦੀ ਤਾਰ ਸਿਰੇ ਤੋਂ ਸਿਰੇ ਜਾਂਚੀ ਅਤੇ ਜਿੱਥੇ ਟੁੱਟੀ, ਸ਼ਾਰਟ ਜਾਂ ਨਵੇਂ ਥਰਮੋਸਟੈਟ ਲਈ ਘੱਟ ਤਾਰਾਂ ਹੋਣ, ਬਦਲੀ।"
   ],
   "tl": [
    "Pagsuri o pagpapalit ng wiring ng thermostat",
    "Sinuri ang wire ng thermostat mula dulo hanggang dulo at pinalitan kung putol, short o kulang ang conductor."
   ]
  },
  "fq.hvac_repair.controls.install_control_board": {
   "it": [
    "Installazione scheda di controllo",
    "Nuova scheda di controllo della caldaia o dell'unità interna montata, cablata e configurata perché ogni stadio risponda."
   ],
   "de": [
    "Einbau einer Steuerplatine",
    "Eine neue Ofen- oder Innengerät-Steuerplatine eingebaut, verdrahtet und konfiguriert, damit jede Stufe wieder reagiert."
   ],
   "uk": [
    "Встановлення плати керування",
    "Нову плату печі чи внутрішнього блока встановлено, підключено й налаштовано — кожен ступінь знову реагує."
   ],
   "pa": [
    "ਕੰਟਰੋਲ ਬੋਰਡ ਲਾਉਣਾ",
    "ਫ਼ਰਨੇਸ ਜਾਂ ਏਅਰ ਹੈਂਡਲਰ ਦਾ ਨਵਾਂ ਕੰਟਰੋਲ ਬੋਰਡ ਲਾ ਕੇ ਤਾਰਾਂ ਅਤੇ ਸੈਟਿੰਗ, ਹਰ ਪੜਾਅ ਮੁੜ ਜਵਾਬ ਦਿੰਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkakabit ng control board",
    "Ikinabit, ikinonekta at kinompigura ang bagong control board ng furnace o air handler para tumugon ulit ang bawat stage."
   ]
  },
  "fq.hvac_repair.controls.replace_fuses": {
   "it": [
    "Sostituzione fusibili",
    "Fusibili bruciati sostituiti con il valore corretto, trovando prima il motivo per cui sono saltati."
   ],
   "de": [
    "Austausch der Sicherungen",
    "Durchgebrannte Sicherungen durch die richtige Stärke ersetzt — und zuerst die Ursache gefunden."
   ],
   "uk": [
    "Заміна запобіжників",
    "Перегорілі запобіжники замінено потрібного номіналу, спершу знайшовши причину."
   ],
   "pa": [
    "ਫ਼ਿਊਜ਼ ਬਦਲਣਾ",
    "ਸੜੇ ਫ਼ਿਊਜ਼ ਸਹੀ ਦਰਜੇ ਵਾਲਿਆਂ ਨਾਲ ਬਦਲੇ, ਨਵੇਂ ਲਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਸੜਨ ਦਾ ਕਾਰਨ ਲੱਭਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng fuse",
    "Pinalitan ng tamang rating ang putok na fuse, at hinanap muna kung bakit pumutok."
   ]
  },
  "fq.hvac_repair.controls.surge_protector": {
   "pa": [
    "HVAC ਸਰਜ ਪ੍ਰੋਟੈਕਟਰ ਲਾਉਣਾ",
    "ਬਾਹਰੀ ਯੂਨਿਟ ਜਾਂ ਏਅਰ ਹੈਂਡਲਰ 'ਤੇ ਸਰਜ ਸੁਰੱਖਿਆ ਯੰਤਰ ਤਾਂ ਜੋ ਬਿਜਲੀ ਡਿੱਗਣ ਜਾਂ ਵੋਲਟੇਜ ਝਟਕੇ ਨਾਲ ਕੰਟਰੋਲ ਬੋਰਡ ਨਾ ਸੜੇ।"
   ]
  },
  "fq.hvac_repair.maintenance.repair_insulation": {
   "it": [
    "Riparazione isolamento di linee e condotti",
    "Isolamento bruciato dal sole o strappato su linee frigorifere e condotti sostituito, così l'impianto non disperde ciò che ha appena raffreddato o scaldato."
   ],
   "de": [
    "Reparatur der Leitungs- und Kanaldämmung",
    "Sonnenzerfressene oder gerissene Dämmung an Kältemittelleitung und Kanälen ersetzt, damit keine gerade erzeugte Kälte oder Wärme verloren geht."
   ],
   "uk": [
    "Ремонт ізоляції трас і повітроводів",
    "Зруйновану сонцем чи порвану ізоляцію трас і повітроводів замінено — система не втрачає щойно вироблене."
   ],
   "pa": [
    "ਲਾਈਨ ਸੈੱਟ ਅਤੇ ਡਕਟ ਇੰਸੂਲੇਸ਼ਨ ਦੀ ਮੁਰੰਮਤ",
    "ਧੁੱਪ ਨਾਲ ਖ਼ਰਾਬ ਜਾਂ ਪਾਟੀ ਇੰਸੂਲੇਸ਼ਨ ਬਦਲੀ, ਤਾਂ ਜੋ ਸਿਸਟਮ ਠੰਢੀ ਜਾਂ ਗਰਮ ਕੀਤੀ ਹਵਾ ਨਾ ਗੁਆਏ।"
   ],
   "tl": [
    "Pagkukumpuni ng insulasyon ng linya at duct",
    "Pinalitan ang nasunog sa araw o punit na insulasyon ng linya at duct para hindi masayang ang pinalamig o pinainit."
   ]
  },
  "fq.hvac_repair.maintenance.generator_maintenance": {
   "it": [
    "Manutenzione generatore di emergenza",
    "Olio, filtro, batteria e prova sotto carico del generatore che mantiene il riscaldamento durante un blackout."
   ],
   "de": [
    "Wartung des Notstromaggregats",
    "Öl, Filter, Batterie und Lasttest am Notstromaggregat, das die Heizung bei Stromausfall am Laufen hält."
   ],
   "uk": [
    "Обслуговування резервного генератора",
    "Олива, фільтр, акумулятор і тест під навантаженням генератора, що тримає опалення під час відключень."
   ],
   "pa": [
    "ਬੈਕਅੱਪ ਜਨਰੇਟਰ ਦੀ ਸੰਭਾਲ",
    "ਬਿਜਲੀ ਜਾਣ 'ਤੇ ਹੀਟਿੰਗ ਚਲਾਉਣ ਵਾਲੇ ਜਨਰੇਟਰ ਦਾ ਤੇਲ, ਫ਼ਿਲਟਰ, ਬੈਟਰੀ ਅਤੇ ਲੋਡ ਟੈਸਟ।"
   ],
   "tl": [
    "Maintenance ng backup generator",
    "Langis, filter, baterya at load test ng generator na nagpapatakbo ng heater kapag brownout."
   ]
  },
  "fq.hvac_repair.controls.thermostat_repair": {
   "it": [
    "Riparazione termostato",
    "Termostato che legge male, non mantiene l'impostazione o non risponde riparato e ricalibrato."
   ],
   "de": [
    "Thermostatreparatur",
    "Ein Thermostat, das falsch misst, die Einstellung nicht hält oder nicht reagiert, repariert und neu kalibriert."
   ],
   "uk": [
    "Ремонт термостата",
    "Термостат, що хибно показує, не тримає налаштування чи не реагує, відремонтовано й відкалібровано."
   ],
   "pa": [
    "ਥਰਮੋਸਟੈਟ ਦੀ ਮੁਰੰਮਤ",
    "ਗ਼ਲਤ ਪੜ੍ਹਨ ਵਾਲਾ, ਸੈਟਿੰਗ ਨਾ ਫੜਨ ਵਾਲਾ ਜਾਂ ਜਵਾਬ ਨਾ ਦੇਣ ਵਾਲਾ ਥਰਮੋਸਟੈਟ ਠੀਕ ਅਤੇ ਮੁੜ ਕੈਲੀਬ੍ਰੇਟ।"
   ],
   "tl": [
    "Pagkukumpuni ng thermostat",
    "Inayos at kinalibrate ang thermostat na mali ang basa, hindi humahawak ng setting o hindi tumutugon."
   ]
  },
  "fq.hvac_repair.controls.repair_control_board": {
   "it": [
    "Riparazione scheda di controllo",
    "Scheda con relè bruciato, saldatura crepata o ingresso sensore guasto diagnosticata e riparata invece che sostituita."
   ],
   "de": [
    "Reparatur der Steuerplatine",
    "Eine Platine mit verbranntem Relais, gerissener Lötstelle oder defektem Sensoreingang diagnostiziert und repariert statt ersetzt."
   ],
   "uk": [
    "Ремонт плати керування",
    "Плату з обгорілим реле, тріснутою пайкою чи несправним входом датчика продіагностовано й відремонтовано замість заміни."
   ],
   "pa": [
    "ਕੰਟਰੋਲ ਬੋਰਡ ਦੀ ਮੁਰੰਮਤ",
    "ਸੜੇ ਰਿਲੇ, ਤਿੜਕੇ ਸੋਲਡਰ ਜਾਂ ਖ਼ਰਾਬ ਸੈਂਸਰ ਇਨਪੁਟ ਵਾਲਾ ਬੋਰਡ ਬਦਲਣ ਦੀ ਥਾਂ ਜਾਂਚ ਕੇ ਠੀਕ।"
   ],
   "tl": [
    "Pagkukumpuni ng control board",
    "Sinuri at inayos sa halip na palitan ang board na may sunog na relay, bitak na solder o sirang sensor input."
   ]
  },
  "fq.hvac_repair.maintenance.furnace_maintenance": {
   "pa": [
    "ਫ਼ਰਨੇਸ ਦੀ ਸੰਭਾਲ",
    "ਫ਼ਰਨੇਸ ਦੀ ਮੌਸਮੀ ਜਾਂਚ: ਬਰਨਰ, ਇਗਨੀਸ਼ਨ, ਹੀਟ ਐਕਸਚੇਂਜਰ, ਬਲੋਅਰ, ਸੇਫ਼ਟੀ ਅਤੇ ਵੈਂਟ, ਜੋ ਗ਼ਲਤ ਹੋਵੇ ਨੋਟ।"
   ]
  },
  "fq.hvac_repair.heat_exchanger.clean_check_burners": {
   "it": [
    "Pulizia e controllo bruciatori",
    "Bruciatori puliti, fiamma controllata e superficie dello scambiatore ispezionata a bruciatori smontati."
   ],
   "de": [
    "Brennerreinigung und -prüfung",
    "Ofenbrenner gereinigt, das Flammenbild geprüft und die Wärmetauscherfläche bei ausgebauten Brennern inspiziert."
   ],
   "uk": [
    "Чищення й перевірка пальників",
    "Пальники почищено, полум'я перевірено, поверхню теплообмінника оглянуто, поки пальники зняті."
   ],
   "pa": [
    "ਬਰਨਰ ਸਫ਼ਾਈ ਅਤੇ ਜਾਂਚ",
    "ਫ਼ਰਨੇਸ ਬਰਨਰ ਸਾਫ਼, ਲਾਟ ਦਾ ਨਮੂਨਾ ਜਾਂਚਿਆ ਅਤੇ ਬਰਨਰ ਬਾਹਰ ਹੋਣ ਵੇਲੇ ਐਕਸਚੇਂਜਰ ਦੀ ਸਤਹ ਦੇਖੀ।"
   ],
   "tl": [
    "Paglilinis at pagsuri ng burner",
    "Nilinis ang burner, sinuri ang apoy at siniyasat ang heat exchanger habang tanggal ang burner."
   ]
  },
  "fq.hvac_repair.heat_exchanger.replace": {
   "it": [
    "Sostituzione scambiatore di calore",
    "Scambiatore crepato sostituito, in garanzia o no, perché i fumi restino nella canna e fuori casa."
   ],
   "de": [
    "Wärmetauschertausch",
    "Ein gerissener Wärmetauscher mit oder ohne Garantie ersetzt, damit Abgase im Abzug und aus dem Haus bleiben."
   ],
   "uk": [
    "Заміна теплообмінника",
    "Тріснутий теплообмінник замінено, за гарантією чи без, щоб продукти згоряння йшли в димохід, а не в дім."
   ],
   "pa": [
    "ਹੀਟ ਐਕਸਚੇਂਜਰ ਬਦਲਣਾ",
    "ਤਿੜਕਿਆ ਹੀਟ ਐਕਸਚੇਂਜਰ ਵਾਰੰਟੀ ਵਿੱਚ ਜਾਂ ਬਾਹਰ ਬਦਲਿਆ ਤਾਂ ਜੋ ਧੂੰਆਂ ਚਿਮਨੀ ਵਿੱਚ ਰਹੇ, ਘਰ ਵਿੱਚ ਨਹੀਂ।"
   ],
   "tl": [
    "Pagpapalit ng heat exchanger",
    "Pinalitan ang bitak na heat exchanger, may warranty man o wala, para manatili sa flue ang usok at wala sa bahay."
   ]
  },
  "fq.hvac_repair.heat_exchanger.replace_face_plate": {
   "it": [
    "Sostituzione piastra frontale dello scambiatore",
    "Piastra deformata o corrosa sostituita e risigillata perché lo scambiatore aspiri e trasferisca il calore come previsto."
   ],
   "de": [
    "Tausch der Wärmetauscher-Frontplatte",
    "Eine verzogene oder korrodierte Frontplatte ersetzt und neu abgedichtet, damit der Tauscher wie vorgesehen zieht und Wärme überträgt."
   ],
   "uk": [
    "Заміна лицьової пластини теплообмінника",
    "Деформовану чи роз'їдену пластину замінено й загерметизовано — теплообмінник знову тягне й передає тепло."
   ],
   "pa": [
    "ਹੀਟ ਐਕਸਚੇਂਜਰ ਫ਼ੇਸ ਪਲੇਟ ਬਦਲਣਾ",
    "ਟੇਢੀ ਜਾਂ ਜੰਗਾਲੀ ਫ਼ੇਸ ਪਲੇਟ ਬਦਲ ਕੇ ਮੁੜ ਸੀਲ, ਤਾਂ ਜੋ ਐਕਸਚੇਂਜਰ ਠੀਕ ਖਿੱਚੇ ਅਤੇ ਗਰਮੀ ਦੇਵੇ।"
   ],
   "tl": [
    "Pagpapalit ng face plate ng heat exchanger",
    "Pinalitan at muling sinelyuhan ang baluktot o kinalawang na face plate para gumana ang heat exchanger gaya ng disenyo."
   ]
  },
  "fq.hvac_repair.heat_exchanger.flue_pipe": {
   "it": [
    "Sostituzione o installazione canna fumaria",
    "Tubo fumi arrugginito, scollegato o con pendenza errata sostituito con materiale e pendenza corretti perché i fumi escano dall'edificio."
   ],
   "de": [
    "Austausch oder Einbau des Abgasrohrs",
    "Rostiges, getrenntes oder falsch geneigtes Abgasrohr durch richtiges Material mit korrektem Gefälle ersetzt."
   ],
   "uk": [
    "Заміна чи монтаж димової труби",
    "Іржаву, роз'єднану чи з неправильним ухилом трубу замінено правильним матеріалом із правильним ухилом."
   ],
   "pa": [
    "ਫ਼ਲੂ ਪਾਈਪ ਬਦਲਣਾ ਜਾਂ ਲਾਉਣਾ",
    "ਜੰਗਾਲੀ, ਖੁੱਲ੍ਹੀ ਜਾਂ ਗ਼ਲਤ ਢਲਾਣ ਵਾਲੀ ਫ਼ਲੂ ਪਾਈਪ ਸਹੀ ਸਮੱਗਰੀ ਅਤੇ ਢਲਾਣ ਨਾਲ ਬਦਲੀ ਤਾਂ ਜੋ ਧੂੰਆਂ ਇਮਾਰਤ ਤੋਂ ਬਾਹਰ ਜਾਵੇ।"
   ],
   "tl": [
    "Pagpapalit o pagkakabit ng flue pipe",
    "Pinalitan ng tamang materyal at hilig ang kalawangin, hiwalay o maling hilig na flue pipe para lumabas ang usok."
   ]
  },
  "fq.hvac_repair.refrigerant.check_levels": {
   "pa": [
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਪੱਧਰ ਦੀ ਜਾਂਚ",
    "ਬਾਹਰੀ ਯੂਨਿਟ 'ਤੇ ਦਬਾਅ ਅਤੇ ਤਾਪਮਾਨ ਪੜ੍ਹ ਕੇ ਚਾਰਜ ਪੱਕਾ, ਘਾਟ ਹੋਵੇ ਤਾਂ ਭਰਨ ਤੋਂ ਪਹਿਲਾਂ ਦੱਸੀ ਜਾਂਦੀ ਹੈ।"
   ]
  },
  "fq.hvac_repair.refrigerant.add_r410a": {
   "it": [
    "Carica refrigerante R-410A — al chilo",
    "R-410A pesato nell'impianto libbra per libbra finché le pressioni corrispondono alla tabella del costruttore."
   ],
   "de": [
    "R-410A-Kältemittel — pro Pfund",
    "R-410A pfundweise eingewogen, bis die Drücke der Herstellertabelle entsprechen."
   ],
   "uk": [
    "Заправка R-410A — за фунт",
    "R-410A зважено в систему пофунтово, доки тиски не відповідатимуть таблиці виробника."
   ],
   "pa": [
    "R-410A ਰੈਫ਼ਰਿਜਰੈਂਟ ਚਾਰਜ — ਪ੍ਰਤੀ ਪੌਂਡ",
    "R-410A ਪੌਂਡ-ਦਰ-ਪੌਂਡ ਤੋਲ ਕੇ ਭਰਿਆ ਜਦੋਂ ਤੱਕ ਦਬਾਅ ਨਿਰਮਾਤਾ ਦੇ ਚਾਰਟ ਨਾਲ ਨਾ ਮਿਲੇ।"
   ],
   "tl": [
    "Karga ng R-410A — kada libra",
    "Tinimbang kada libra ang R-410A hanggang tumugma ang pressure sa tsart ng gumawa."
   ]
  },
  "fq.hvac_repair.refrigerant.add_r410a_additional": {
   "it": [
    "R-410A aggiuntivo — a libbra",
    "Ogni libbra di R-410A oltre la prima, per impianti che richiedono un rabbocco maggiore."
   ],
   "de": [
    "Zusätzliches R-410A — pro Pfund",
    "Jedes weitere Pfund R-410A nach dem ersten, für Anlagen mit größerem Nachfüllbedarf."
   ],
   "uk": [
    "Додатковий R-410A — за фунт",
    "Кожен наступний фунт R-410A після першого для систем, яким треба більше."
   ],
   "pa": [
    "ਵਾਧੂ R-410A — ਪ੍ਰਤੀ ਪੌਂਡ",
    "ਪਹਿਲੇ ਤੋਂ ਬਾਅਦ ਹਰ ਵਾਧੂ ਪੌਂਡ R-410A, ਵੱਡੀ ਭਰਾਈ ਵਾਲੇ ਸਿਸਟਮ ਲਈ।"
   ],
   "tl": [
    "Dagdag na R-410A — kada libra",
    "Bawat dagdag na libra ng R-410A pagkatapos ng una, para sa sistemang kailangan ng mas maraming karga."
   ]
  },
  "fq.hvac_repair.refrigerant.add_r22": {
   "it": [
    "Carica refrigerante R-22 — a libbra",
    "R-22 aggiunto a libbra in un impianto più vecchio, segnalando che è fuori produzione e sempre più costoso."
   ],
   "de": [
    "R-22-Kältemittel — pro Pfund",
    "R-22 pfundweise in eine ältere Anlage gefüllt, mit dem Hinweis, dass es ausläuft und teurer wird."
   ],
   "uk": [
    "Заправка R-22 — за фунт",
    "R-22 додано пофунтово в стару систему з приміткою, що його знято з виробництва й він дорожчає."
   ],
   "pa": [
    "R-22 ਰੈਫ਼ਰਿਜਰੈਂਟ ਚਾਰਜ — ਪ੍ਰਤੀ ਪੌਂਡ",
    "ਪੁਰਾਣੇ ਸਿਸਟਮ ਵਿੱਚ R-22 ਪੌਂਡ ਦੇ ਹਿਸਾਬ ਨਾਲ, ਨੋਟ ਸਮੇਤ ਕਿ ਇਹ ਬੰਦ ਹੋ ਰਿਹਾ ਅਤੇ ਮਹਿੰਗਾ ਹੈ।"
   ],
   "tl": [
    "Karga ng R-22 — kada libra",
    "Dinagdagan ng R-22 kada libra ang lumang sistema, may paalalang itinitigil na ito at mas mahal."
   ]
  },
  "fq.hvac_repair.refrigerant.add_r22_additional": {
   "it": [
    "R-22 aggiuntivo — a libbra",
    "Ogni libbra di R-22 oltre la prima."
   ],
   "de": [
    "Zusätzliches R-22 — pro Pfund",
    "Jedes weitere Pfund R-22 nach dem ersten."
   ],
   "uk": [
    "Додатковий R-22 — за фунт",
    "Кожен наступний фунт R-22 після першого."
   ],
   "pa": [
    "ਵਾਧੂ R-22 — ਪ੍ਰਤੀ ਪੌਂਡ",
    "ਪਹਿਲੇ ਤੋਂ ਬਾਅਦ ਹਰ ਵਾਧੂ ਪੌਂਡ R-22।"
   ],
   "tl": [
    "Dagdag na R-22 — kada libra",
    "Bawat dagdag na libra ng R-22 pagkatapos ng una."
   ]
  },
  "fq.hvac_repair.refrigerant.leak_search": {
   "it": [
    "Ricerca perdite di refrigerante",
    "Tutto il circuito controllato con rilevatore elettronico, tracciante o prova in azoto, e ogni perdita segnata."
   ],
   "de": [
    "Kältemittel-Lecksuche",
    "Der ganze Kreislauf mit elektronischem Detektor, Farbstoff oder Stickstoffdruckprobe geprüft und jede Leckstelle markiert."
   ],
   "uk": [
    "Пошук витоків холодоагенту",
    "Увесь контур перевірено детектором, барвником чи тиском азоту, кожне місце витоку позначено."
   ],
   "pa": [
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਲੀਕ ਦੀ ਖੋਜ",
    "ਪੂਰਾ ਸਰਕਟ ਇਲੈਕਟ੍ਰਾਨਿਕ ਡਿਟੈਕਟਰ, ਡਾਈ ਜਾਂ ਨਾਈਟ੍ਰੋਜਨ ਦਬਾਅ ਨਾਲ ਜਾਂਚਿਆ ਅਤੇ ਹਰ ਲੀਕ ਨਿਸ਼ਾਨਬੱਧ।"
   ],
   "tl": [
    "Paghahanap ng tagas ng refrigerant",
    "Sinuri ang buong circuit gamit ang electronic detector, dye o nitrogen pressure test at minarkahan ang bawat tagas."
   ]
  },
  "fq.hvac_repair.refrigerant.repair_leaks": {
   "it": [
    "Riparazione perdite di refrigerante",
    "Punti di perdita trovati brasati o con componenti nuovi, poi prova a pressione per confermare la tenuta."
   ],
   "de": [
    "Reparatur von Kältemittellecks",
    "Gefundene Leckstellen gelötet oder mit neuen Teilen versehen, dann druckgeprüft, ob die Anlage dicht hält."
   ],
   "uk": [
    "Усунення витоків холодоагенту",
    "Знайдені витоки запаяно чи замінено деталі, потім перевірено тиском на герметичність."
   ],
   "pa": [
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਲੀਕ ਦੀ ਮੁਰੰਮਤ",
    "ਲੱਭੇ ਲੀਕ ਬ੍ਰੇਜ਼ ਜਾਂ ਨਵੇਂ ਪੁਰਜ਼ਿਆਂ ਨਾਲ ਠੀਕ, ਫਿਰ ਦਬਾਅ ਟੈਸਟ ਨਾਲ ਪੱਕਾ ਕਿ ਸਿਸਟਮ ਫੜਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagkukumpuni ng tagas ng refrigerant",
    "Ibinrazed o pinalitan ng bagong piyesa ang natagpuang tagas, saka pressure-test para matiyak na hindi na tumatagas."
   ]
  },
  "fq.hvac_repair.refrigerant.leak_repair_recharge": {
   "pa": [
    "ਲੀਕ ਮੁਰੰਮਤ, ਖ਼ਾਲੀ ਕਰਨਾ ਅਤੇ ਮੁੜ ਚਾਰਜ",
    "ਲੀਕ ਠੀਕ ਕਰਨ ਤੋਂ ਬਾਅਦ ਨਮੀ ਕੱਢਣ ਲਈ ਪੂਰਾ ਵੈਕਿਊਮ ਅਤੇ ਨੇਮਪਲੇਟ ਮਾਤਰਾ ਤੱਕ ਤੋਲ ਕੇ ਚਾਰਜ।"
   ]
  },
  "fq.hvac_repair.refrigerant.electronic_leak_search": {
   "it": [
    "Rilevamento elettronico delle perdite",
    "Rapida verifica di batterie, raccordi e linee con rilevatore elettronico per localizzare una perdita sospetta."
   ],
   "de": [
    "Elektronische Lecksuche",
    "Ein schneller Durchgang über Register, Verbindungen und Leitungen mit elektronischem Lecksucher, um einen vermuteten Verlust zu orten."
   ],
   "uk": [
    "Електронний пошук витоків",
    "Швидка перевірка теплообмінників, з'єднань і трас електронним детектором, щоб знайти підозрюваний витік."
   ],
   "pa": [
    "ਇਲੈਕਟ੍ਰਾਨਿਕ ਲੀਕ ਖੋਜ",
    "ਸ਼ੱਕੀ ਲੀਕ ਲੱਭਣ ਲਈ ਕੌਇਲਾਂ, ਫ਼ਿਟਿੰਗਾਂ ਅਤੇ ਲਾਈਨ ਸੈੱਟ 'ਤੇ ਇਲੈਕਟ੍ਰਾਨਿਕ ਡਿਟੈਕਟਰ ਨਾਲ ਤੇਜ਼ ਜਾਂਚ।"
   ],
   "tl": [
    "Electronic na paghahanap ng tagas",
    "Mabilis na pagsuri sa coil, fitting at linya gamit ang electronic detector para mahanap ang hinihinalang tagas."
   ]
  },
  "fq.hvac_repair.refrigerant.walk_in_reversing_valve": {
   "it": [
    "Sostituzione valvola di inversione cella frigorifera",
    "Valvola di inversione di una cella frigorifera sostituita, con controllo di sbrinamento e sensori verificati e sostituiti se serve."
   ],
   "de": [
    "Tausch des Umschaltventils einer Kühlzelle",
    "Das Umschaltventil einer begehbaren Tiefkühlzelle ersetzt, Abtausteuerung und Fühler geprüft und bei Bedarf ersetzt."
   ],
   "uk": [
    "Заміна 4-ходового клапана холодильної камери",
    "Реверсивний клапан камери замінено, керування відтаванням і датчики перевірено й замінено за потреби."
   ],
   "pa": [
    "ਵਾਕ-ਇਨ ਫ਼ਰੀਜ਼ਰ ਰਿਵਰਸਿੰਗ ਵਾਲਵ ਬਦਲਣਾ",
    "ਵਾਕ-ਇਨ ਫ਼ਰੀਜ਼ਰ ਦਾ ਰਿਵਰਸਿੰਗ ਵਾਲਵ ਬਦਲਿਆ, ਡੀਫ਼ਰੌਸਟ ਕੰਟਰੋਲ ਅਤੇ ਸੈਂਸਰ ਜਾਂਚੇ ਅਤੇ ਲੋੜ ਹੋਵੇ ਤਾਂ ਬਦਲੇ।"
   ],
   "tl": [
    "Pagpapalit ng reversing valve ng walk-in freezer",
    "Pinalitan ang reversing valve ng walk-in freezer, sinuri at pinalitan kung kailangan ang defrost control at sensor."
   ]
  },
  "fq.hvac_repair.refrigerant.repair_lineset": {
   "it": [
    "Riparazione linee frigorifere",
    "Linea schiacciata, corrosa o che perde riparata o sostituita in parte, con le modifiche a condotti o pareti che il nuovo percorso richiede."
   ],
   "de": [
    "Reparatur der Kältemittelleitung",
    "Eine geknickte, korrodierte oder undichte Leitung repariert oder teilweise ersetzt, inklusive nötiger Kanal- oder Wandanpassung."
   ],
   "uk": [
    "Ремонт фреонової траси",
    "Зігнуту, роз'їдену чи негерметичну трасу відремонтовано чи частково замінено, з потрібними змінами повітроводів або стін."
   ],
   "pa": [
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਲਾਈਨ ਸੈੱਟ ਦੀ ਮੁਰੰਮਤ",
    "ਮੁੜੀ, ਜੰਗਾਲੀ ਜਾਂ ਲੀਕ ਲਾਈਨ ਠੀਕ ਜਾਂ ਕੁਝ ਹਿੱਸਾ ਬਦਲਿਆ, ਨਵੇਂ ਰਸਤੇ ਲਈ ਡਕਟ ਜਾਂ ਕੰਧ ਦੀ ਤਬਦੀਲੀ ਸਮੇਤ।"
   ],
   "tl": [
    "Pagkukumpuni ng refrigerant line set",
    "Inayos o bahagyang pinalitan ang baluktot, kinakalawang o tumatagas na linya, kasama ang pagbabago sa duct o pader."
   ]
  },
  "fq.hvac_repair.refrigerant.flush_lineset": {
   "it": [
    "Lavaggio linee frigorifere",
    "Linee esistenti lavate da olio vecchio e contaminanti prima di collegare le nuove apparecchiature."
   ],
   "de": [
    "Spülen der Kältemittelleitung",
    "Die vorhandene Leitung von altem Öl und Verunreinigungen freigespült, bevor neue Geräte angeschlossen werden."
   ],
   "uk": [
    "Промивання фреонової траси",
    "Наявну трасу промито від старої оливи й забруднень перед під'єднанням нового обладнання."
   ],
   "pa": [
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਲਾਈਨ ਸੈੱਟ ਫ਼ਲੱਸ਼",
    "ਨਵਾਂ ਸਾਜ਼ੋ-ਸਮਾਨ ਜੋੜਨ ਤੋਂ ਪਹਿਲਾਂ ਮੌਜੂਦਾ ਲਾਈਨ ਪੁਰਾਣੇ ਤੇਲ ਅਤੇ ਗੰਦਗੀ ਤੋਂ ਫ਼ਲੱਸ਼।"
   ],
   "tl": [
    "Pag-flush ng refrigerant line set",
    "Nilinis ang dating linya mula sa lumang langis at dumi bago ikonekta ang bagong kagamitan."
   ]
  },
  "fq.hvac_repair.refrigerant.txv_replacement": {
   "it": [
    "Sostituzione valvola termostatica",
    "Valvola di espansione bloccata o guasta rimossa e una nuova brasata, poi impianto messo sotto vuoto e ricaricato."
   ],
   "de": [
    "Tausch des thermostatischen Expansionsventils",
    "Ein klemmendes oder defektes Expansionsventil ausgebaut, ein neues eingelötet, dann evakuiert und neu befüllt."
   ],
   "uk": [
    "Заміна терморегулюючого вентиля",
    "Заклинений чи несправний ТРВ знято, новий впаяно, систему вакуумовано й заправлено."
   ],
   "pa": [
    "ਥਰਮਲ ਐਕਸਪੈਂਸ਼ਨ ਵਾਲਵ ਬਦਲਣਾ",
    "ਜਾਮ ਜਾਂ ਖ਼ਰਾਬ ਐਕਸਪੈਂਸ਼ਨ ਵਾਲਵ ਕੱਢ ਕੇ ਨਵਾਂ ਬ੍ਰੇਜ਼, ਫਿਰ ਸਿਸਟਮ ਖ਼ਾਲੀ ਅਤੇ ਮੁੜ ਚਾਰਜ।"
   ],
   "tl": [
    "Pagpapalit ng thermal expansion valve",
    "Tinanggal ang stuck o sirang expansion valve at ibinrazed ang bago, saka vinacuum at kinargahan."
   ]
  },
  "fq.hvac_repair.diagnostics.residential": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਰਿਹਾਇਸ਼ੀ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਸਿਸਟਮ ਜਾਂਚ ਕੇ ਨੁਕਸ ਲੱਭਦਾ ਅਤੇ ਮੁਰੰਮਤ ਦਾ ਲਿਖਤੀ ਰੇਟ ਦਿੰਦਾ ਹੈ; ਮੁਰੰਮਤ ਹੋਵੇ ਤਾਂ ਫ਼ੀਸ ਕੱਟੀ ਜਾਂਦੀ ਹੈ।"
   ]
  },
  "fq.hvac_repair.diagnostics.commercial": {
   "it": [
    "Visita diagnostica — commerciale",
    "La stessa diagnosi su un impianto commerciale a tetto o split, con la riparazione quotata prima di iniziare."
   ],
   "de": [
    "Diagnosetermin — gewerblich",
    "Dieselbe Diagnose an einer gewerblichen Dach- oder Splitanlage, mit Angebot vor Beginn der Reparatur."
   ],
   "uk": [
    "Діагностичний візит — комерційний",
    "Та сама діагностика комерційної дахової чи спліт-системи, з ціною ремонту до початку робіт."
   ],
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਵਪਾਰਕ",
    "ਵਪਾਰਕ ਛੱਤ ਵਾਲੇ ਜਾਂ ਸਪਲਿਟ ਸਿਸਟਮ ਦੀ ਉਹੀ ਜਾਂਚ, ਕੰਮ ਸ਼ੁਰੂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਮੁਰੰਮਤ ਦਾ ਰੇਟ।"
   ],
   "tl": [
    "Diagnostic visit — komersyal",
    "Parehong diagnostic sa komersyal na rooftop o split system, may presyo ng pagkukumpuni bago magsimula."
   ]
  },
  "fq.hvac_repair.diagnostics.emergency": {
   "it": [
    "Visita diagnostica — fuori orario",
    "Un tecnico reperibile interviene fuori orario, trova il guasto e rimette in funzione l'impianto o quota la riparazione."
   ],
   "de": [
    "Diagnosetermin — außerhalb der Geschäftszeiten",
    "Ein Bereitschaftstechniker kommt außerhalb der Zeiten, findet den Fehler und bringt die Anlage zum Laufen oder bepreist die Reparatur."
   ],
   "uk": [
    "Діагностичний візит — у неробочий час",
    "Черговий технік приїжджає поза робочим часом, знаходить несправність і запускає систему чи називає ціну ремонту."
   ],
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਛੁੱਟੀ ਦੇ ਸਮੇਂ",
    "ਆਨ-ਕਾਲ ਟੈਕਨੀਸ਼ੀਅਨ ਆਮ ਸਮੇਂ ਤੋਂ ਬਾਹਰ ਆ ਕੇ ਨੁਕਸ ਲੱਭਦਾ ਅਤੇ ਸਿਸਟਮ ਚਲਾਉਂਦਾ ਜਾਂ ਮੁਰੰਮਤ ਦਾ ਰੇਟ ਦਿੰਦਾ ਹੈ।"
   ],
   "tl": [
    "Diagnostic visit — lampas oras",
    "Dumarating ang on-call na technician lampas sa oras, hinahanap ang sira at pinapaandar o binibigyan ng presyo."
   ]
  },
  "fq.hvac_repair.diagnostics.out_of_range": {
   "it": [
    "Visita diagnostica — fuori zona",
    "La visita diagnostica per un indirizzo oltre la zona abituale, trasferta inclusa nella tariffa."
   ],
   "de": [
    "Diagnosetermin — außerhalb des Einsatzgebiets",
    "Der Diagnosetermin für eine Adresse außerhalb des üblichen Gebiets, Anfahrt im Preis enthalten."
   ],
   "uk": [
    "Діагностичний візит — поза зоною обслуговування",
    "Діагностичний візит за адресою поза звичайною зоною, дорогу включено в плату."
   ],
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ — ਸੇਵਾ ਖੇਤਰ ਤੋਂ ਬਾਹਰ",
    "ਆਮ ਸੇਵਾ ਖੇਤਰ ਤੋਂ ਬਾਹਰ ਪਤੇ ਲਈ ਜਾਂਚ ਵਿਜ਼ਿਟ, ਸਫ਼ਰ ਫ਼ੀਸ ਵਿੱਚ ਸ਼ਾਮਲ।"
   ],
   "tl": [
    "Diagnostic visit — labas ng service area",
    "Diagnostic visit para sa address na lampas sa karaniwang lugar, kasama sa bayad ang biyahe."
   ]
  },
  "fq.hvac_repair.diagnostics.system_inspection": {
   "pa": [
    "HVAC ਸਿਸਟਮ ਦੀ ਜਾਂਚ",
    "ਕੌਇਲ, ਫ਼ਿਲਟਰ, ਰੈਫ਼ਰਿਜਰੈਂਟ ਦਬਾਅ, ਬਿਜਲੀ ਕਨੈਕਸ਼ਨ ਅਤੇ ਥਰਮੋਸਟੈਟ ਸੁਰੱਖਿਆ ਅਤੇ ਕਾਰਗੁਜ਼ਾਰੀ ਲਈ ਜਾਂਚੇ, ਨਤੀਜੇ ਲਿਖੇ।"
   ]
  },
  "fq.hvac_repair.diagnostics.diagnostic_visit": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਲੱਭਦਾ ਹੈ ਕਿ ਹੀਟਿੰਗ ਜਾਂ ਕੂਲਿੰਗ ਕਿਉਂ ਨਹੀਂ ਚੱਲ ਰਹੀ ਅਤੇ ਮੁਰੰਮਤ ਤੋਂ ਪਹਿਲਾਂ ਲਿਖਤੀ ਰੇਟ ਦਿੰਦਾ ਹੈ।"
   ]
  },
  "fq.hvac_repair.diagnostics.service_visit": {
   "pa": [
    "ਸਰਵਿਸ ਵਿਜ਼ਿਟ",
    "ਹੀਟਿੰਗ ਜਾਂ ਕੂਲਿੰਗ ਮੁੜ ਚਲਾਉਣ ਲਈ ਸੱਦਾ, ਪੁਰਜ਼ਾ ਟਰੱਕ ਵਿੱਚ ਹੋਵੇ ਤਾਂ ਮੌਕੇ 'ਤੇ ਮੁਰੰਮਤ।"
   ]
  },
  "fq.hvac_repair.maintenance.preventative_maintenance": {
   "pa": [
    "ਰੋਕਥਾਮ ਵਾਲਾ ਰੱਖ-ਰਖਾਅ",
    "ਮੌਸਮ ਤੋਂ ਪਹਿਲਾਂ ਸਿਸਟਮ ਸਾਫ਼, ਠੀਕ ਅਤੇ ਜਾਂਚਣ ਲਈ ਤੈਅ ਵਿਜ਼ਿਟ, ਤਾਂ ਜੋ ਛੋਟੇ ਨੁਕਸ ਗਰਮੀ ਬੰਦ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਫੜੇ ਜਾਣ।"
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
  "Blower motor replacement labour": {
   "pa": [
    "ਬਲੋਅਰ ਮੋਟਰ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਬਲੋਅਰ ਅਸੈਂਬਲੀ ਕੱਢੀ, ਮੋਟਰ ਅਤੇ ਕੈਪੇਸੀਟਰ ਬਦਲੇ, ਵ੍ਹੀਲ ਸੰਤੁਲਿਤ ਅਤੇ ਹਵਾ ਜਾਂਚੀ।"
   ]
  },
  "PSC blower motor with capacitor": {
   "pa": [
    "ਕੈਪੇਸੀਟਰ ਸਮੇਤ PSC ਬਲੋਅਰ ਮੋਟਰ",
    "ਡਾਇਰੈਕਟ-ਡਰਾਈਵ PSC ਬਲੋਅਰ ਮੋਟਰ, 1/2 HP, ਮੇਲ ਖਾਂਦੇ ਰਨ ਕੈਪੇਸੀਟਰ ਨਾਲ।"
   ]
  },
  "Furnace repair": {
   "pa": [
    "ਫ਼ਰਨੇਸ ਦੀ ਮੁਰੰਮਤ",
    "ਵਧੀਆ ਪੁਰਜ਼ਿਆਂ ਨਾਲ ਫ਼ਰਨੇਸ ਦਾ ਨੁਕਸ ਠੀਕ, ਫਿਰ ਪੂਰਾ ਹੀਟਿੰਗ ਚੱਕਰ ਚਲਾ ਕੇ ਜਾਂਚ।"
   ]
  },
  "Coil inspection": {
   "pa": [
    "ਕੌਇਲ ਦੀ ਜਾਂਚ",
    "ਦੋਵੇਂ ਕੌਇਲਾਂ ਖੋਲ੍ਹ ਕੇ ਗੰਦਗੀ, ਜੰਗਾਲ ਅਤੇ ਲੀਕ ਦਰਸਾਉਂਦੇ ਤੇਲ ਦੇ ਨਿਸ਼ਾਨ ਲਈ ਦੇਖੀਆਂ।"
   ]
  },
  "Evaporator and condenser coil cleaning": {
   "pa": [
    "ਇਵੈਪੋਰੇਟਰ ਅਤੇ ਕੰਡੈਂਸਰ ਕੌਇਲ ਸਫ਼ਾਈ",
    "ਕੰਡੈਂਸਰ ਕੌਇਲ ਅੰਦਰੋਂ ਧੋਤੀ, ਇਵੈਪੋਰੇਟਰ 'ਤੇ ਝੱਗ, ਧੁਆਈ ਅਤੇ ਡਰੇਨ ਫ਼ਲੱਸ਼।"
   ]
  },
  "Coil cleaner": {
   "pa": [
    "ਕੌਇਲ ਕਲੀਨਰ",
    "ਝੱਗ ਵਾਲਾ ਇਵੈਪੋਰੇਟਰ ਕਲੀਨਰ ਅਤੇ ਕੰਡੈਂਸਰ ਡਿਟਰਜੈਂਟ, ਇੱਕ ਸਰਵਿਸ ਲਈ।"
   ]
  },
  "Coil cleaning": {
   "pa": [
    "ਕੌਇਲ ਸਫ਼ਾਈ",
    "ਆਲੇ-ਦੁਆਲੇ ਦੇ ਪੁਰਜ਼ੇ ਢਕੇ, ਕਲੀਨਰ ਲਾ ਕੇ ਧੋਤਾ, ਡਰੇਨ ਪੈਨ ਸਾਫ਼, ਫ਼ਿਨ ਸਿੱਧੇ ਅਤੇ ਸਿਸਟਮ ਜਾਂਚਿਆ।"
   ]
  },
  "Float switch installation labour": {
   "pa": [
    "ਫ਼ਲੋਟ ਸਵਿੱਚ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਡਰੇਨ ਪੈਨ ਜਾਂ ਲਾਈਨ ਵਿੱਚ ਸਵਿੱਚ ਲਾ ਕੇ ਘੱਟ-ਵੋਲਟੇਜ ਸਰਕਟ ਨਾਲ ਜੋੜਿਆ ਅਤੇ ਜਾਂਚਿਆ।"
   ]
  },
  "Condensate overflow float switch": {
   "pa": [
    "ਕੰਡੈਂਸੇਟ ਓਵਰਫ਼ਲੋ ਫ਼ਲੋਟ ਸਵਿੱਚ",
    "ਪੈਨ ਵਿੱਚ ਜਾਂ ਲਾਈਨ ਵਿੱਚ ਲੱਗਣ ਵਾਲਾ ਫ਼ਲੋਟ ਸਵਿੱਚ, 24 V।"
   ]
  },
  "Filter change and return cleaning": {
   "pa": [
    "ਫ਼ਿਲਟਰ ਬਦਲੀ ਅਤੇ ਰਿਟਰਨ ਸਫ਼ਾਈ",
    "ਪੁਰਾਣਾ ਫ਼ਿਲਟਰ ਕੱਢਿਆ, ਰਿਟਰਨ ਗਰਿੱਲ ਵੈਕਿਊਮ, ਨਵਾਂ ਫ਼ਿਲਟਰ ਅਤੇ ਹਵਾ ਦਾ ਤੀਰ ਜਾਂਚਿਆ।"
   ]
  },
  "High-efficiency pleated filter": {
   "pa": [
    "ਉੱਚ-ਕੁਸ਼ਲਤਾ ਪਲੀਟਿਡ ਫ਼ਿਲਟਰ",
    "ਸਿਸਟਮ ਦੇ ਨਾਪ ਦਾ MERV 11 ਪਲੀਟਿਡ ਫ਼ਿਲਟਰ।"
   ]
  },
  "Air duct cleaning": {
   "pa": [
    "ਏਅਰ ਡਕਟ ਸਫ਼ਾਈ",
    "ਮੁੱਖ ਅਤੇ ਬ੍ਰਾਂਚ ਡਕਟਾਂ ਨੈਗੇਟਿਵ ਦਬਾਅ ਹੇਠ ਘੁੰਮਦੇ ਬੁਰਸ਼ਾਂ ਨਾਲ ਸਾਫ਼।"
   ]
  },
  "Vent and register cleaning": {
   "pa": [
    "ਵੈਂਟ ਅਤੇ ਰਜਿਸਟਰ ਦੀ ਸਫ਼ਾਈ",
    "ਹਰ ਵੈਂਟ ਅਤੇ ਰਜਿਸਟਰ ਉਤਾਰਿਆ, ਧੋਤਾ ਅਤੇ ਮੁੜ ਲਗਾਇਆ।"
   ]
  },
  "Air quality measurement": {
   "pa": [
    "ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਦਾ ਮਾਪ",
    "ਮੁੱਖ ਰਹਿਣ ਵਾਲੀਆਂ ਥਾਵਾਂ 'ਤੇ ਕਣ, ਨਮੀ, CO2 ਅਤੇ VOC ਰੀਡਿੰਗਾਂ।"
   ]
  },
  "Written report with photos": {
   "pa": [
    "ਫ਼ੋਟੋਆਂ ਸਮੇਤ ਲਿਖਤੀ ਰਿਪੋਰਟ",
    "ਨਤੀਜੇ ਫ਼ੋਟੋਆਂ ਨਾਲ ਦਰਜ ਅਤੇ ਤਰਜੀਹ ਅਨੁਸਾਰ ਸਲਾਹਾਂ ਦੀ ਸੂਚੀ।"
   ]
  },
  "UV lamp installation labour": {
   "pa": [
    "UV ਲੈਂਪ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਪਲੀਨਮ ਕੱਟ ਕੇ ਕੌਇਲ ਉੱਪਰ ਲੈਂਪ ਲਾਇਆ, ਆਪਣੇ ਟ੍ਰਾਂਸਫ਼ਾਰਮਰ ਨਾਲ ਜੋੜ ਕੇ ਜਾਂਚਿਆ।"
   ]
  },
  "Coil-mount UV air purifier": {
   "pa": [
    "ਕੌਇਲ 'ਤੇ ਲੱਗਣ ਵਾਲਾ UV ਹਵਾ ਸ਼ੁੱਧੀਕਰਨ",
    "24 V ਟ੍ਰਾਂਸਫ਼ਾਰਮਰ ਅਤੇ ਇੱਕ ਸਾਲ ਦੇ ਲੈਂਪ ਵਾਲਾ ਦੋ-ਲੈਂਪ UV ਯੰਤਰ।"
   ]
  },
  "Capacitor replacement labour": {
   "pa": [
    "ਕੈਪੇਸੀਟਰ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਬਿਜਲੀ ਬੰਦ, ਕੈਪੇਸੀਟਰ ਡਿਸਚਾਰਜ ਕਰਕੇ ਬਦਲਿਆ ਅਤੇ ਸਟਾਰਟ ਐਂਪੀਅਰ ਜਾਂਚੇ।"
   ]
  },
  "Dual run capacitor": {
   "pa": [
    "ਡੂਅਲ ਰਨ ਕੈਪੇਸੀਟਰ",
    "ਡੂਅਲ ਰਨ ਕੈਪੇਸੀਟਰ, 35/5 ਤੋਂ 50/5 µF, 440 V।"
   ]
  },
  "Cooling system tune-up": {
   "pa": [
    "ਕੂਲਿੰਗ ਸਿਸਟਮ ਟਿਊਨ-ਅੱਪ",
    "ਦਬਾਅ, ਐਂਪੀਅਰ, ਕੈਪੇਸੀਟਰ ਅਤੇ ਕੌਂਟੈਕਟਰ ਜਾਂਚੇ, ਕੰਡੈਂਸਰ ਕੌਇਲ ਧੋਤੀ ਅਤੇ ਡਰੇਨ ਖੋਲ੍ਹੀ।"
   ]
  },
  "Pleated air filter": {
   "pa": [
    "ਪਲੀਟਿਡ ਏਅਰ ਫ਼ਿਲਟਰ",
    "ਸਿਸਟਮ ਦੇ ਨਾਪ ਦਾ 1 ਇੰਚ ਪਲੀਟਿਡ ਫ਼ਿਲਟਰ, MERV 8।"
   ]
  },
  "Surge protector installation labour": {
   "pa": [
    "ਸਰਜ ਪ੍ਰੋਟੈਕਟਰ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਡਿਸਕਨੈਕਟ 'ਤੇ ਯੰਤਰ ਲਾਇਆ, ਜੋੜਿਆ ਅਤੇ ਇੰਡੀਕੇਟਰ ਜਾਂਚਿਆ।"
   ]
  },
  "HVAC surge protection device": {
   "pa": [
    "HVAC ਸਰਜ ਸੁਰੱਖਿਆ ਯੰਤਰ",
    "240 V ਕੰਡੈਂਸਰ ਜਾਂ ਹੀਟ ਪੰਪ ਲਈ ਬਾਹਰ ਲੱਗਣ ਵਾਲਾ ਸਰਜ ਪ੍ਰੋਟੈਕਟਰ।"
   ]
  },
  "Furnace maintenance visit": {
   "pa": [
    "ਫ਼ਰਨੇਸ ਸੰਭਾਲ ਵਿਜ਼ਿਟ",
    "ਬਰਨਰ ਸਾਫ਼, ਫ਼ਲੇਮ ਸੈਂਸਰ ਚਮਕਾਇਆ, ਹੀਟ ਐਕਸਚੇਂਜਰ ਦੇਖਿਆ, ਸੇਫ਼ਟੀ ਅਤੇ ਵੈਂਟ ਜਾਂਚੇ ਅਤੇ ਬਲੋਅਰ ਸਾਫ਼।"
   ]
  },
  "Refrigerant charge check": {
   "pa": [
    "ਰੈਫ਼ਰਿਜਰੈਂਟ ਚਾਰਜ ਜਾਂਚ",
    "ਗੇਜ ਲਾਏ, ਸੁਪਰਹੀਟ ਅਤੇ ਸਬਕੂਲਿੰਗ ਕੱਢੇ ਅਤੇ ਰੀਡਿੰਗ ਟਿਕਟ 'ਤੇ ਲਿਖੀ।"
   ]
  },
  "Leak repair, evacuation and recharge labour": {
   "pa": [
    "ਲੀਕ ਮੁਰੰਮਤ, ਖ਼ਾਲੀ ਕਰਨ ਅਤੇ ਮੁੜ ਚਾਰਜ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਲੀਕ ਬ੍ਰੇਜ਼ ਜਾਂ ਫ਼ਿਟਿੰਗ ਬਦਲੀ, ਸਿਸਟਮ 500 ਮਾਈਕ੍ਰੋਨ ਤੱਕ ਖ਼ਾਲੀ ਅਤੇ ਚਾਰਜ ਤੋਲ ਕੇ ਭਰਿਆ।"
   ]
  },
  "R-410A refrigerant — per pound": {
   "pa": [
    "R-410A ਰੈਫ਼ਰਿਜਰੈਂਟ — ਪ੍ਰਤੀ ਪੌਂਡ",
    "R-410A ਰੈਫ਼ਰਿਜਰੈਂਟ, ਪੌਂਡ ਦੇ ਹਿਸਾਬ ਨਾਲ ਤੋਲ ਕੇ।"
   ]
  },
  "Full HVAC system inspection": {
   "pa": [
    "ਪੂਰੇ HVAC ਸਿਸਟਮ ਦੀ ਜਾਂਚ",
    "ਕੌਇਲ, ਫ਼ਿਲਟਰ, ਰੈਫ਼ਰਿਜਰੈਂਟ ਪੱਧਰ, ਬਿਜਲੀ ਕਨੈਕਸ਼ਨ ਅਤੇ ਥਰਮੋਸਟੈਟ ਜਾਂਚੇ।"
   ]
  },
  "Service call and travel": {
   "pa": [
    "ਸਰਵਿਸ ਕਾਲ ਅਤੇ ਸਫ਼ਰ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਜਾਇਦਾਦ 'ਤੇ ਭੇਜਿਆ; ਸਫ਼ਰ ਅਤੇ ਸਮੱਸਿਆ ਦੀ ਪਹਿਲੀ ਜਾਂਚ ਸ਼ਾਮਲ।"
   ]
  },
  "Technician labour": {
   "pa": [
    "ਟੈਕਨੀਸ਼ੀਅਨ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਹੁਨਰਮੰਦ ਮਜ਼ਦੂਰੀ ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ, ਇੱਕ ਟੈਕਨੀਸ਼ੀਅਨ।"
   ]
  },
  "Seasonal tune-up": {
   "pa": [
    "ਮੌਸਮੀ ਟਿਊਨ-ਅੱਪ",
    "ਕੌਇਲ ਸਫ਼ਾਈ, ਬੈਲਟ ਜਾਂਚ, ਥਰਮੋਸਟੈਟ ਕੈਲੀਬ੍ਰੇਸ਼ਨ, ਡਰੇਨ ਫ਼ਲੱਸ਼ ਅਤੇ ਸੁਰੱਖਿਆ ਜਾਂਚ।"
   ]
  }
 }
};
