// app/data/serviceSeeds/i18n/electrical.js
//
// The languages electrical.js does not write inline — Italian, German,
// Ukrainian, Punjabi (Gurmukhi) and Tagalog for its categories and services,
// and Punjabi for its template lines (keyed by the English line name) — merged
// by withLanguages in ../_templateLines.js. Hand-written trade wording, no
// machine translation; checked by scripts/check-seed-languages.mjs.
export const I18N = {
 "categories": {
  "visits": {
   "it": "Interventi",
   "de": "Serviceeinsätze",
   "uk": "Сервісні виїзди",
   "pa": "ਸਰਵਿਸ ਵਿਜ਼ਿਟਾਂ",
   "tl": "Service visit"
  },
  "appliances": {
   "it": "Circuiti e collegamenti elettrodomestici",
   "de": "Gerätestromkreise und Anschlüsse",
   "uk": "Лінії та підключення техніки",
   "pa": "ਉਪਕਰਣ ਸਰਕਟ ਅਤੇ ਕਨੈਕਸ਼ਨ",
   "tl": "Circuit at koneksyon ng appliance"
  },
  "ballasts": {
   "it": "Sostituzione reattori",
   "de": "Vorschaltgerätetausch",
   "uk": "Заміна баластів",
   "pa": "ਬੈਲਾਸਟ ਬਦਲਣਾ",
   "tl": "Pagpapalit ng ballast"
  },
  "fans": {
   "it": "Ventilatori a soffitto e aspiratori",
   "de": "Decken- und Abluftventilatoren",
   "uk": "Стельові та витяжні вентилятори",
   "pa": "ਛੱਤ ਅਤੇ ਐਗਜ਼ੌਸਟ ਪੱਖੇ",
   "tl": "Ceiling at exhaust fan"
  },
  "panels": {
   "it": "Quadri e interruttori",
   "de": "Verteiler und Sicherungsautomaten",
   "uk": "Щити та автомати",
   "pa": "ਪੈਨਲ ਅਤੇ ਬ੍ਰੇਕਰ",
   "tl": "Panel at breaker"
  },
  "dimmers": {
   "it": "Dimmer",
   "de": "Dimmer",
   "uk": "Диммери",
   "pa": "ਡਿਮਰ",
   "tl": "Dimmer"
  },
  "lighting": {
   "it": "Installazione illuminazione",
   "de": "Beleuchtungsinstallation",
   "uk": "Монтаж освітлення",
   "pa": "ਲਾਈਟਾਂ ਲਾਉਣਾ",
   "tl": "Pagkakabit ng ilaw"
  },
  "outdoor": {
   "it": "Illuminazione esterna",
   "de": "Außenbeleuchtung",
   "uk": "Зовнішнє освітлення",
   "pa": "ਬਾਹਰੀ ਲਾਈਟਾਂ",
   "tl": "Ilaw sa labas"
  },
  "receptacles": {
   "it": "Prese",
   "de": "Steckdosen",
   "uk": "Розетки",
   "pa": "ਸਾਕਟ ਅਤੇ ਆਊਟਲੈੱਟ",
   "tl": "Saksakan"
  },
  "recessed": {
   "it": "Faretti da incasso",
   "de": "Einbauleuchten",
   "uk": "Вбудовані світильники",
   "pa": "ਛੱਤ ਵਿੱਚ ਧੱਸੀਆਂ ਲਾਈਟਾਂ",
   "tl": "Recessed na ilaw"
  },
  "detectors": {
   "it": "Rilevatori di fumo e CO",
   "de": "Rauch- und CO-Melder",
   "uk": "Датчики диму та CO",
   "pa": "ਧੂੰਏਂ ਅਤੇ CO ਡਿਟੈਕਟਰ",
   "tl": "Smoke at CO detector"
  },
  "specialty": {
   "it": "Colonnine EV e generatori",
   "de": "Wallboxen und Generatoren",
   "uk": "Зарядні станції EV та генератори",
   "pa": "EV ਚਾਰਜਰ ਅਤੇ ਜਨਰੇਟਰ",
   "tl": "EV charger at generator"
  },
  "switches": {
   "it": "Interruttori",
   "de": "Schalter",
   "uk": "Вимикачі",
   "pa": "ਸਵਿੱਚ",
   "tl": "Switch"
  }
 },
 "services": {
  "fq.electrical.appliances.install_contactor": {
   "it": [
    "Installazione contattore",
    "Un contattore montato e cablato per comandare in sicurezza un carico pesante — riscaldatore, pompa o climatizzatore."
   ],
   "de": [
    "Schützeinbau",
    "Ein Schütz montiert und verdrahtet, um eine große Last — Heizung, Pumpe oder Klimagerät — sicher zu schalten."
   ],
   "uk": [
    "Встановлення контактора",
    "Контактор встановлено й підключено, щоб безпечно вмикати потужне навантаження — обігрівач, насос чи кондиціонер."
   ],
   "pa": [
    "ਕੌਂਟੈਕਟਰ ਲਾਉਣਾ",
    "ਭਾਰੀ ਲੋਡ — ਹੀਟਰ, ਪੰਪ ਜਾਂ ਏਸੀ — ਸੁਰੱਖਿਅਤ ਚਾਲੂ-ਬੰਦ ਕਰਨ ਲਈ ਕੌਂਟੈਕਟਰ ਲਾ ਕੇ ਜੋੜਿਆ।"
   ],
   "tl": [
    "Pagkakabit ng contactor",
    "Ikinabit at ikinonekta ang contactor para ligtas na i-on at off ang mabigat na karga — heater, pump o aircon."
   ]
  },
  "fq.electrical.appliances.install_pressure_switch": {
   "it": [
    "Installazione pressostato",
    "Pressostato installato e tarato perché pompa o compressore si avviino e fermino ai valori giusti."
   ],
   "de": [
    "Druckschalter einbauen",
    "Ein Druckschalter eingebaut und eingestellt, damit Pumpe oder Kompressor an den richtigen Punkten ein- und ausschalten."
   ],
   "uk": [
    "Встановлення реле тиску",
    "Реле тиску встановлено й налаштовано, щоб насос чи компресор вмикався й вимикався в потрібних точках."
   ],
   "pa": [
    "ਪ੍ਰੈਸ਼ਰ ਸਵਿੱਚ ਲਾਉਣਾ",
    "ਪ੍ਰੈਸ਼ਰ ਸਵਿੱਚ ਲਾ ਕੇ ਸੈੱਟ ਤਾਂ ਜੋ ਪੰਪ ਜਾਂ ਕੰਪ੍ਰੈਸਰ ਸਹੀ ਦਬਾਅ 'ਤੇ ਚੱਲੇ ਅਤੇ ਰੁਕੇ।"
   ],
   "tl": [
    "Pagkakabit ng pressure switch",
    "Ikinabit at itinakda ang pressure switch para umandar at huminto ang pump o compressor sa tamang punto."
   ]
  },
  "fq.electrical.appliances.dryer_cord": {
   "pa": [
    "ਡ੍ਰਾਇਰ ਕੋਰਡ — 4-ਤਾਰ, 6 ਫੁੱਟ ਤੱਕ",
    "ਉਪਕਰਣ 'ਤੇ ਚਾਰ-ਤਾਰ ਕੋਰਡ ਲਾ ਕੇ ਸਾਕਟ ਜਾਂਚਿਆ ਤਾਂ ਜੋ ਡ੍ਰਾਇਰ ਸਹੀ ਅਰਥ ਹੋਵੇ।"
   ]
  },
  "fq.electrical.appliances.water_softener_outlet": {
   "it": [
    "Presa per addolcitore — GFCI, da circuito esistente",
    "Presa protetta GFCI aggiunta per l'addolcitore, derivata da un circuito vicino."
   ],
   "de": [
    "Steckdose für Wasserenthärter — FI, von vorhandenem Kreis",
    "Eine FI-geschützte Steckdose für den Enthärter, von einem nahen Stromkreis abgezweigt."
   ],
   "uk": [
    "Розетка для пом'якшувача — GFCI, від наявної лінії",
    "Розетку з GFCI додано для пом'якшувача води, від найближчої наявної лінії."
   ],
   "pa": [
    "ਵਾਟਰ ਸੌਫ਼ਨਰ ਲਈ ਸਾਕਟ — GFCI, ਮੌਜੂਦਾ ਸਰਕਟ ਤੋਂ",
    "ਵਾਟਰ ਸੌਫ਼ਨਰ ਲਈ GFCI ਵਾਲਾ ਸਾਕਟ, ਨੇੜਲੇ ਸਰਕਟ ਤੋਂ।"
   ],
   "tl": [
    "Saksakan para sa water softener — GFCI, mula sa dating circuit",
    "Nagdagdag ng GFCI na saksakan para sa water softener, kinuha sa malapit na circuit."
   ]
  },
  "fq.electrical.appliances.dishwasher_hardwire": {
   "it": [
    "Collegamento fisso lavastoviglie con sezionatore",
    "Lavastoviglie collegata direttamente al suo circuito con sezionatore sotto il lavello."
   ],
   "de": [
    "Festanschluss Geschirrspüler mit Trennschalter",
    "Geschirrspüler direkt an seinen Kreis angeschlossen, mit Trennschalter unter der Spüle."
   ],
   "uk": [
    "Пряме підключення посудомийки з вимикачем",
    "Посудомийку підключено напряму до лінії з вимикачем під мийкою."
   ],
   "pa": [
    "ਡਿਸ਼ਵਾਸ਼ਰ ਸਿੱਧਾ ਜੋੜਨਾ, ਡਿਸਕਨੈਕਟ ਸਮੇਤ",
    "ਡਿਸ਼ਵਾਸ਼ਰ ਸਿੱਧਾ ਸਰਕਟ ਨਾਲ ਜੋੜਿਆ, ਸਿੰਕ ਹੇਠ ਡਿਸਕਨੈਕਟ।"
   ],
   "tl": [
    "Direktang wiring ng dishwasher na may disconnect",
    "Direktang ikinabit ang dishwasher sa circuit na may disconnect sa ilalim ng lababo."
   ]
  },
  "fq.electrical.appliances.disposal_cord": {
   "it": [
    "Cavo per tritarifiuti — fino a 3 ft",
    "Tritarifiuti dotato di cavo e spina alla presa sotto il lavello, interruttore verificato."
   ],
   "de": [
    "Kabelanschluss Müllzerkleinerer — bis 3 ft",
    "Müllzerkleinerer mit Kabel und Stecker an die Steckdose unter der Spüle, Schalter geprüft."
   ],
   "uk": [
    "Шнур для подрібнювача — до 3 футів",
    "Подрібнювач обладнано шнуром і вилкою до розетки під мийкою, вимикач перевірено."
   ],
   "pa": [
    "ਗਾਰਬੇਜ ਡਿਸਪੋਜ਼ਲ ਕੋਰਡ — 3 ਫੁੱਟ ਤੱਕ",
    "ਡਿਸਪੋਜ਼ਲ 'ਤੇ ਕੋਰਡ ਅਤੇ ਪਲੱਗ, ਸਿੰਕ ਹੇਠਲੇ ਸਾਕਟ ਨਾਲ ਅਤੇ ਸਵਿੱਚ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Kordon ng garbage disposal — hanggang 3 ft",
    "Nilagyan ng kordon at plug ang disposal sa saksakan sa ilalim ng lababo at sinuri ang switch."
   ]
  },
  "fq.electrical.appliances.range_cord": {
   "it": [
    "Cavo per cucina — 4 fili, 6 ft",
    "Cavo a quattro fili montato sulla cucina e presa verificata."
   ],
   "de": [
    "Herdkabel — 4-adrig, 6 ft",
    "Ein vieradriges Herdkabel montiert und die Steckdose auf festen Kontakt geprüft."
   ],
   "uk": [
    "Шнур для плити — 4 жили, 6 футів",
    "Чотирижильний шнур встановлено на плиту, розетку перевірено."
   ],
   "pa": [
    "ਰੇਂਜ ਕੋਰਡ — 4-ਤਾਰ, 6 ਫੁੱਟ",
    "ਚੁੱਲ੍ਹੇ 'ਤੇ ਚਾਰ-ਤਾਰ ਕੋਰਡ ਅਤੇ ਸਾਕਟ ਪੱਕਾ ਜਾਂਚਿਆ।"
   ],
   "tl": [
    "Kordon ng range — 4-wire, 6 ft",
    "Ikinabit ang 4-wire na kordon sa kalan at sinuri ang saksakan."
   ]
  },
  "fq.electrical.appliances.microwave_circuit": {
   "it": [
    "Presa microonde su nuovo circuito 20 A — fino a 40 ft",
    "Circuito dedicato 20 A, 120 V posato fino a 40 ft dal quadro a una nuova presa per il microonde, percorso accessibile."
   ],
   "de": [
    "Mikrowellensteckdose an neuem 20-A-Kreis — bis 40 ft",
    "Eigener 20-A-, 120-V-Kreis bis 40 ft vom Verteiler zu einer neuen Steckdose für die Mikrowelle, zugänglicher Weg."
   ],
   "uk": [
    "Розетка для мікрохвильовки на новій лінії 20 А — до 40 футів",
    "Окрема лінія 20 А, 120 В до 40 футів від щита до нової розетки, доступна траса."
   ],
   "pa": [
    "ਮਾਈਕ੍ਰੋਵੇਵ ਲਈ ਨਵੇਂ 20 A ਸਰਕਟ 'ਤੇ ਸਾਕਟ — 40 ਫੁੱਟ ਤੱਕ",
    "ਪੈਨਲ ਤੋਂ 40 ਫੁੱਟ ਤੱਕ ਖ਼ਾਸ 20 A, 120 V ਸਰਕਟ ਨਵੇਂ ਸਾਕਟ ਤੱਕ, ਪਹੁੰਚ ਵਾਲਾ ਰਸਤਾ।"
   ],
   "tl": [
    "Saksakan ng microwave sa bagong 20 A circuit — hanggang 40 ft",
    "Nakalaang 20 A, 120 V na circuit hanggang 40 ft mula sa panel papunta sa bagong saksakan, madaling daanan."
   ]
  },
  "fq.electrical.visits.power_issue": {
   "pa": [
    "ਬਿਜਲੀ ਸਮੱਸਿਆ ਵਿਜ਼ਿਟ",
    "ਪੂਰੇ ਘਰ ਦੀ ਬਿਜਲੀ ਬੰਦ, ਇੱਕ ਕਮਰਾ ਬੰਦ, ਟਿਮਟਿਮਾਉਂਦੀਆਂ ਲਾਈਟਾਂ ਜਾਂ ਵਾਰ-ਵਾਰ ਡਿੱਗਦਾ ਬ੍ਰੇਕਰ: ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ ਕਾਰਨ ਲੱਭ ਕੇ ਹੋ ਸਕੇ ਤਾਂ ਉਸੇ ਵਿਜ਼ਿਟ ਵਿੱਚ ਠੀਕ ਕਰਦਾ ਹੈ।"
   ]
  },
  "fq.electrical.visits.fixtures": {
   "it": [
    "Installazione o riparazione punti luce — visita",
    "Visita prenotata per montare una nuova lampada, ripararne una guasta o spostarla."
   ],
   "de": [
    "Leuchte montieren oder reparieren — Termin",
    "Gebuchter Termin, um eine neue Leuchte anzubringen, eine defekte zu reparieren oder zu versetzen."
   ],
   "uk": [
    "Монтаж чи ремонт світильника — візит",
    "Запланований візит, щоб повісити новий світильник, відремонтувати чи перенести наявний."
   ],
   "pa": [
    "ਫ਼ਿਕਸਚਰ ਲਾਉਣਾ ਜਾਂ ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਨਵੀਂ ਲਾਈਟ ਟੰਗਣ, ਖ਼ਰਾਬ ਠੀਕ ਕਰਨ ਜਾਂ ਥਾਂ ਬਦਲਣ ਲਈ ਬੁੱਕ ਕੀਤੀ ਵਿਜ਼ਿਟ।"
   ],
   "tl": [
    "Visit sa pagkakabit o pagkukumpuni ng ilaw",
    "Naka-book na visit para magkabit ng bagong ilaw, ayusin ang sira o ilipat ito."
   ]
  },
  "fq.electrical.visits.switch_outlet": {
   "pa": [
    "ਸਵਿੱਚ ਜਾਂ ਸਾਕਟ ਵਿਜ਼ਿਟ",
    "ਸਵਿੱਚ ਅਤੇ ਸਾਕਟ ਠੀਕ, ਬਦਲੇ ਜਾਂ ਨਵੇਂ — ਬੰਦ ਸਾਕਟ, ਢਿੱਲਾ ਪਲੱਗ ਜਾਂ ਰੀਸੈੱਟ ਨਾ ਹੋਣ ਵਾਲਾ GFCI ਸਮੇਤ।"
   ]
  },
  "fq.electrical.visits.panel": {
   "it": [
    "Visita per quadro elettrico",
    "Interruttore che scatta o ronza, quadro caldo o che richiede più potenza: verificato, con riparazioni o potenziamento quotati."
   ],
   "de": [
    "Termin am Verteiler",
    "Ein auslösender oder brummender Automat, ein warmer Verteiler oder zu wenig Kapazität geprüft, Reparatur oder Erweiterung angeboten."
   ],
   "uk": [
    "Візит щодо електрощита",
    "Автомат вибиває чи гуде, щит гріється чи потрібна більша потужність — огляд і ціна ремонту чи модернізації."
   ],
   "pa": [
    "ਬਿਜਲੀ ਪੈਨਲ ਵਿਜ਼ਿਟ",
    "ਡਿੱਗਦਾ ਜਾਂ ਘੂੰ-ਘੂੰ ਕਰਦਾ ਬ੍ਰੇਕਰ, ਗਰਮ ਪੈਨਲ ਜਾਂ ਵੱਧ ਸਮਰੱਥਾ ਦੀ ਲੋੜ ਦੇਖੀ, ਮੁਰੰਮਤ ਜਾਂ ਅੱਪਗ੍ਰੇਡ ਦਾ ਰੇਟ।"
   ],
   "tl": [
    "Visit sa electrical panel",
    "Sinusuri ang tumitripa o umuugong na breaker, mainit na panel o kulang na kapasidad, may presyo ng pagkukumpuni o upgrade."
   ]
  },
  "fq.electrical.fans.bathroom_exhaust": {
   "it": [
    "Installazione aspiratore bagno — fornito dal cliente",
    "Aspiratore del cliente montato a soffitto, collegato all'interruttore e canalizzato all'esterno."
   ],
   "de": [
    "Badlüfter einbauen — vom Kunden",
    "Ein vom Kunden gelieferter Lüfter in die Decke eingebaut, an den Schalter angeschlossen und nach außen geführt."
   ],
   "uk": [
    "Встановлення витяжки у ванній — від клієнта",
    "Вентилятор клієнта встановлено в стелю, підключено до вимикача й виведено назовні."
   ],
   "pa": [
    "ਬਾਥਰੂਮ ਐਗਜ਼ੌਸਟ ਪੱਖਾ ਲਾਉਣਾ — ਗਾਹਕ ਦਾ",
    "ਗਾਹਕ ਦਾ ਪੱਖਾ ਛੱਤ ਵਿੱਚ ਲਾਇਆ, ਸਵਿੱਚ ਨਾਲ ਜੋੜਿਆ ਅਤੇ ਬਾਹਰ ਤੱਕ ਡਕਟ।"
   ],
   "tl": [
    "Pagkakabit ng exhaust fan sa banyo — dala ng kliyente",
    "Ikinabit sa kisame ang exhaust fan ng kliyente, ikinonekta sa switch at dinaluyan palabas."
   ]
  },
  "fq.electrical.fans.supply_install_fan": {
   "it": [
    "Ventilatore a soffitto — fornito e installato, attacco standard",
    "Ventilatore standard fornito e appeso su scatola idonea, cablato e bilanciato."
   ],
   "de": [
    "Deckenventilator — geliefert und montiert, Standard",
    "Ein Standard-Deckenventilator geliefert, an einer tragfähigen Dose montiert, angeschlossen und ausgewuchtet."
   ],
   "uk": [
    "Стельовий вентилятор — постачання й монтаж, стандарт",
    "Стандартний вентилятор постачено, повішено на відповідну коробку, підключено й збалансовано."
   ],
   "pa": [
    "ਛੱਤ ਦਾ ਪੱਖਾ — ਦੇ ਕੇ ਲਾਇਆ, ਆਮ ਮਾਊਂਟ",
    "ਆਮ ਛੱਤ ਦਾ ਪੱਖਾ ਦੇ ਕੇ ਪੱਖੇ ਵਾਲੇ ਬਾਕਸ 'ਤੇ ਟੰਗਿਆ, ਜੋੜਿਆ ਅਤੇ ਸੰਤੁਲਿਤ।"
   ],
   "tl": [
    "Ceiling fan — ibinigay at ikinabit, standard",
    "Nagbigay at isinabit sa fan-rated na kahon ang standard na ceiling fan, ikinonekta at binalanse."
   ]
  },
  "fq.electrical.fans.supply_install_fan_light": {
   "it": [
    "Ventilatore a soffitto con luce — fornito e installato",
    "Ventilatore con luce fornito, appeso su scatola idonea e collegato all'interruttore."
   ],
   "de": [
    "Deckenventilator mit Leuchte — geliefert und montiert",
    "Ein Ventilator mit Leuchte geliefert, an einer tragfähigen Dose montiert und an den Schalter angeschlossen."
   ],
   "uk": [
    "Стельовий вентилятор зі світлом — постачання й монтаж",
    "Вентилятор зі світильником постачено, повішено на відповідну коробку й підключено до вимикача."
   ],
   "pa": [
    "ਲਾਈਟ ਵਾਲਾ ਛੱਤ ਦਾ ਪੱਖਾ — ਦੇ ਕੇ ਲਾਇਆ",
    "ਲਾਈਟ ਵਾਲਾ ਪੱਖਾ ਦੇ ਕੇ ਪੱਖੇ ਵਾਲੇ ਬਾਕਸ 'ਤੇ ਟੰਗਿਆ ਅਤੇ ਸਵਿੱਚ ਨਾਲ ਜੋੜਿਆ।"
   ],
   "tl": [
    "Ceiling fan na may ilaw — ibinigay at ikinabit",
    "Nagbigay, isinabit sa fan-rated na kahon at ikinonekta sa switch ang fan na may ilaw."
   ]
  },
  "fq.electrical.fans.fan_control_switch": {
   "it": [
    "Installazione comando ventilatore",
    "Comando di velocità e luce a parete, così il ventilatore non dipende più dalle catenelle."
   ],
   "de": [
    "Ventilatorsteuerung einbauen",
    "Eine Drehzahl- und Lichtsteuerung an der Wand montiert, damit der Ventilator nicht mehr von den Zugketten abhängt."
   ],
   "uk": [
    "Встановлення регулятора вентилятора",
    "На стіні встановлено регулятор швидкості й світла — більше не треба тягнути ланцюжки."
   ],
   "pa": [
    "ਪੱਖਾ ਕੰਟਰੋਲ ਸਵਿੱਚ ਲਾਉਣਾ",
    "ਕੰਧ 'ਤੇ ਰਫ਼ਤਾਰ ਅਤੇ ਲਾਈਟ ਕੰਟਰੋਲ ਤਾਂ ਜੋ ਪੱਖਾ ਚੇਨਾਂ 'ਤੇ ਨਿਰਭਰ ਨਾ ਰਹੇ।"
   ],
   "tl": [
    "Pagkakabit ng fan control switch",
    "Ikinabit sa pader ang kontrol ng bilis at ilaw para hindi na umasa sa pull chain."
   ]
  },
  "fq.electrical.fans.customer_fan_existing_box": {
   "it": [
    "Ventilatore a soffitto su scatola esistente — fornito dal cliente",
    "Ventilatore del cliente appeso su una scatola idonea esistente, cablato e bilanciato."
   ],
   "de": [
    "Deckenventilator an vorhandener Dose — vom Kunden",
    "Der Ventilator des Kunden an einer vorhandenen tragfähigen Dose montiert, angeschlossen und ausgewuchtet."
   ],
   "uk": [
    "Стельовий вентилятор на наявну коробку — від клієнта",
    "Вентилятор клієнта повішено на наявну відповідну коробку, підключено й збалансовано."
   ],
   "pa": [
    "ਮੌਜੂਦਾ ਬਾਕਸ 'ਤੇ ਛੱਤ ਦਾ ਪੱਖਾ — ਗਾਹਕ ਦਾ",
    "ਗਾਹਕ ਦਾ ਪੱਖਾ ਮੌਜੂਦਾ ਪੱਖੇ ਵਾਲੇ ਬਾਕਸ 'ਤੇ ਟੰਗਿਆ, ਜੋੜਿਆ ਅਤੇ ਸੰਤੁਲਿਤ।"
   ],
   "tl": [
    "Ceiling fan sa dating kahon — dala ng kliyente",
    "Isinabit sa dating fan-rated na kahon ang fan ng kliyente, ikinonekta at binalanse."
   ]
  },
  "fq.electrical.fans.customer_fan_light_existing_box": {
   "it": [
    "Ventilatore con luce su scatola esistente — fornito dal cliente",
    "Ventilatore con luce del cliente appeso su scatola esistente e cablato per entrambi."
   ],
   "de": [
    "Deckenventilator mit Leuchte an vorhandener Dose — vom Kunden",
    "Die Ventilator-Leuchten-Einheit des Kunden an einer vorhandenen Dose montiert und für beides angeschlossen."
   ],
   "uk": [
    "Вентилятор зі світлом на наявну коробку — від клієнта",
    "Вентилятор зі світлом клієнта повішено на наявну коробку й підключено для обох функцій."
   ],
   "pa": [
    "ਮੌਜੂਦਾ ਬਾਕਸ 'ਤੇ ਲਾਈਟ ਵਾਲਾ ਪੱਖਾ — ਗਾਹਕ ਦਾ",
    "ਗਾਹਕ ਦਾ ਪੱਖਾ-ਲਾਈਟ ਯੂਨਿਟ ਮੌਜੂਦਾ ਬਾਕਸ 'ਤੇ ਟੰਗ ਕੇ ਦੋਵਾਂ ਲਈ ਜੋੜਿਆ।"
   ],
   "tl": [
    "Fan na may ilaw sa dating kahon — dala ng kliyente",
    "Isinabit sa dating kahon ang fan-at-ilaw ng kliyente at ikinonekta para sa dalawa."
   ]
  },
  "fq.electrical.panels.whole_house_surge": {
   "it": [
    "Installazione scaricatore di sovratensioni per tutta la casa",
    "Dispositivo contro le sovratensioni montato al quadro per proteggere ogni circuito da fulmini e picchi di rete."
   ],
   "de": [
    "Überspannungsschutz für das ganze Haus",
    "Ein Überspannungsschutz am Verteiler montiert, der jeden Kreis vor Blitz und Netzspitzen schützt."
   ],
   "uk": [
    "Захист від перенапруги для всього будинку",
    "Пристрій захисту від перенапруги встановлено в щиті для захисту всіх ліній від блискавки та стрибків."
   ],
   "pa": [
    "ਪੂਰੇ ਘਰ ਲਈ ਸਰਜ ਪ੍ਰੋਟੈਕਟਰ",
    "ਪੈਨਲ 'ਤੇ ਸਰਜ ਸੁਰੱਖਿਆ ਯੰਤਰ ਜੋ ਹਰ ਸਰਕਟ ਨੂੰ ਬਿਜਲੀ ਡਿੱਗਣ ਅਤੇ ਵੋਲਟੇਜ ਝਟਕਿਆਂ ਤੋਂ ਬਚਾਉਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Surge protector para sa buong bahay",
    "Ikinabit sa panel ang surge protection para protektahan ang bawat circuit sa kidlat at biglang lakas ng kuryente."
   ]
  },
  "fq.electrical.panels.replace_faulty_breakers": {
   "pa": [
    "ਖ਼ਰਾਬ ਬ੍ਰੇਕਰ ਬਦਲਣਾ",
    "ਬਿਨਾਂ ਨੁਕਸ ਡਿੱਗਣ ਵਾਲਾ, ਰੀਸੈੱਟ ਨਾ ਹੋਣ ਵਾਲਾ ਜਾਂ ਗਰਮ ਹੁੰਦਾ ਬ੍ਰੇਕਰ ਸਹੀ ਕਿਸਮ ਅਤੇ ਦਰਜੇ ਨਾਲ ਬਦਲਿਆ।"
   ]
  },
  "fq.electrical.panels.install_breakers": {
   "it": [
    "Installazione interruttore automatico",
    "Nuovo interruttore montato nel quadro per un circuito aggiunto ed etichettato."
   ],
   "de": [
    "Sicherungsautomat einbauen",
    "Ein neuer Automat für einen zusätzlichen Kreis in den Verteiler gesetzt und beschriftet."
   ],
   "uk": [
    "Встановлення автомата",
    "Новий автомат встановлено в щит для додаткової лінії й підписано."
   ],
   "pa": [
    "ਸਰਕਟ ਬ੍ਰੇਕਰ ਲਾਉਣਾ",
    "ਨਵੇਂ ਸਰਕਟ ਲਈ ਪੈਨਲ ਵਿੱਚ ਨਵਾਂ ਬ੍ਰੇਕਰ ਅਤੇ ਸੂਚੀ 'ਤੇ ਲੇਬਲ।"
   ],
   "tl": [
    "Pagkakabit ng circuit breaker",
    "Ikinabit sa panel ang bagong breaker para sa dagdag na circuit at nilagyan ng label."
   ]
  },
  "fq.electrical.panels.mc_cable_connectors": {
   "it": [
    "Installazione raccordi per cavo armato",
    "Raccordi montati dove il cavo armato entra negli apparecchi, fissato e collegato a terra."
   ],
   "de": [
    "Verschraubungen für Panzerkabel",
    "Verschraubungen dort gesetzt, wo Panzerkabel in Geräte eintritt, damit es gesichert und geerdet ist."
   ],
   "uk": [
    "Встановлення з'єднувачів броньованого кабелю",
    "З'єднувачі встановлено там, де броньований кабель входить в обладнання — кабель закріплено й заземлено."
   ],
   "pa": [
    "MC ਕੇਬਲ ਕਨੈਕਟਰ ਲਾਉਣਾ",
    "ਜਿੱਥੇ ਬਖ਼ਤਰਬੰਦ ਕੇਬਲ ਉਪਕਰਣ ਵਿੱਚ ਜਾਂਦੀ ਹੈ ਉੱਥੇ ਕਨੈਕਟਰ, ਕੇਬਲ ਪੱਕੀ ਅਤੇ ਅਰਥ।"
   ],
   "tl": [
    "Pagkakabit ng MC cable connector",
    "Ikinabit ang connector kung saan pumapasok ang armored cable para nakakabit at naka-ground."
   ]
  },
  "fq.electrical.panels.outdoor_main_200a_40": {
   "it": [
    "Sostituzione quadro esterno con generale — 200 A, 40 circuiti",
    "Quadro esterno 200 A da 40 circuiti con interruttore generale installato al posto del vecchio, circuiti ricollegati ed etichettati."
   ],
   "de": [
    "Außenverteiler mit Hauptschalter tauschen — 200 A, 40 Kreise",
    "Ein 200-A-Außenverteiler mit 40 Plätzen und Hauptschalter anstelle des alten, jeder Kreis neu angeschlossen und beschriftet."
   ],
   "uk": [
    "Заміна зовнішнього щита з головним автоматом — 200 А, 40 ліній",
    "Зовнішній щит 200 А на 40 ліній із головним автоматом замість старого, лінії перепідключено й підписано."
   ],
   "pa": [
    "ਬਾਹਰੀ ਮੇਨ ਬ੍ਰੇਕਰ ਪੈਨਲ ਬਦਲਣਾ — 200 A, 40 ਸਰਕਟ",
    "ਪੁਰਾਣੇ ਦੀ ਥਾਂ ਬਾਹਰੀ 40-ਸਰਕਟ 200 A ਮੇਨ ਬ੍ਰੇਕਰ ਪੈਨਲ, ਹਰ ਸਰਕਟ ਮੁੜ ਜੋੜਿਆ ਅਤੇ ਲੇਬਲ।"
   ],
   "tl": [
    "Pagpapalit ng outdoor main breaker panel — 200 A, 40 circuit",
    "Ikinabit ang outdoor na 40-circuit, 200 A main breaker panel kapalit ng luma, ikinonekta at nilagyan ng label ang bawat circuit."
   ]
  },
  "fq.electrical.panels.all_breakers_200a_40": {
   "it": [
    "Sostituzione quadro e interruttori — 200 A, 40 circuiti",
    "Quadro 200 A da 40 circuiti con tutti interruttori nuovi, circuiti ricollegati ed elenco etichettato."
   ],
   "de": [
    "Verteiler- und Automatentausch — 200 A, 40 Kreise",
    "Ein 200-A-Verteiler mit 40 Plätzen und lauter neuen Automaten, Kreise neu angeschlossen und beschriftet."
   ],
   "uk": [
    "Заміна щита й автоматів — 200 А, 40 ліній",
    "Щит 200 А на 40 ліній з усіма новими автоматами, лінії перепідключено, перелік підписано."
   ],
   "pa": [
    "ਪੈਨਲ ਅਤੇ ਬ੍ਰੇਕਰ ਬਦਲਣਾ — 200 A, 40 ਸਰਕਟ",
    "ਸਾਰੇ ਨਵੇਂ ਬ੍ਰੇਕਰਾਂ ਵਾਲਾ 40-ਸਰਕਟ 200 A ਪੈਨਲ, ਸਰਕਟ ਮੁੜ ਜੋੜੇ ਅਤੇ ਸੂਚੀ ਲੇਬਲ।"
   ],
   "tl": [
    "Pagpapalit ng panel at breaker — 200 A, 40 circuit",
    "Ikinabit ang 40-circuit, 200 A na panel na bago lahat ng breaker, muling ikinonekta ang circuit at nilagyan ng label."
   ]
  },
  "fq.electrical.panels.main_lug_125a_20": {
   "it": [
    "Sostituzione quadro senza generale — 125 A, 20 circuiti",
    "Quadro 125 A da 20 circuiti senza generale installato ed etichettato, alimentato da un sezionatore a monte."
   ],
   "de": [
    "Unterverteiler ohne Hauptschalter tauschen — 125 A, 20 Kreise",
    "Ein 125-A-Unterverteiler mit 20 Plätzen eingebaut und beschriftet, versorgt über einen vorgeschalteten Trennschalter."
   ],
   "uk": [
    "Заміна щита без головного автомата — 125 А, 20 ліній",
    "Щит 125 А на 20 ліній без головного автомата встановлено й підписано, живлення від вимикача вище."
   ],
   "pa": [
    "ਮੇਨ ਲੱਗ ਪੈਨਲ ਬਦਲਣਾ — 125 A, 20 ਸਰਕਟ",
    "20-ਸਰਕਟ 125 A ਮੇਨ ਲੱਗ ਪੈਨਲ ਲਾ ਕੇ ਲੇਬਲ, ਉੱਪਰਲੇ ਡਿਸਕਨੈਕਟ ਤੋਂ ਸਪਲਾਈ।"
   ],
   "tl": [
    "Pagpapalit ng main lug panel — 125 A, 20 circuit",
    "Ikinabit at nilagyan ng label ang 20-circuit, 125 A main lug panel, pinapakain mula sa disconnect sa itaas."
   ]
  },
  "fq.electrical.panels.all_breakers_200a_30": {
   "pa": [
    "ਪੈਨਲ ਅਤੇ ਬ੍ਰੇਕਰ ਬਦਲਣਾ — 200 A, 30 ਸਰਕਟ",
    "ਨਵੇਂ ਬ੍ਰੇਕਰਾਂ ਵਾਲਾ 30-ਸਰਕਟ 200 A ਪੈਨਲ, ਸਰਕਟ ਮੁੜ ਜੋੜੇ ਅਤੇ ਲੇਬਲ।"
   ]
  },
  "fq.electrical.panels.all_breakers_150a_30": {
   "it": [
    "Sostituzione quadro e interruttori — 150 A, 30 circuiti",
    "Quadro 150 A da 30 circuiti con interruttori nuovi, circuiti ricollegati ed etichettati."
   ],
   "de": [
    "Verteiler- und Automatentausch — 150 A, 30 Kreise",
    "Ein 150-A-Verteiler mit 30 Plätzen und neuen Automaten, Kreise neu angeschlossen und beschriftet."
   ],
   "uk": [
    "Заміна щита й автоматів — 150 А, 30 ліній",
    "Щит 150 А на 30 ліній з новими автоматами, лінії перепідключено й підписано."
   ],
   "pa": [
    "ਪੈਨਲ ਅਤੇ ਬ੍ਰੇਕਰ ਬਦਲਣਾ — 150 A, 30 ਸਰਕਟ",
    "ਨਵੇਂ ਬ੍ਰੇਕਰਾਂ ਵਾਲਾ 30-ਸਰਕਟ 150 A ਪੈਨਲ, ਸਰਕਟ ਮੁੜ ਜੋੜੇ ਅਤੇ ਲੇਬਲ।"
   ],
   "tl": [
    "Pagpapalit ng panel at breaker — 150 A, 30 circuit",
    "Ikinabit ang 30-circuit, 150 A na panel na may bagong breaker, muling ikinonekta at nilagyan ng label."
   ]
  },
  "fq.electrical.panels.main_lug_200a_30": {
   "it": [
    "Sostituzione quadro senza generale — 200 A, 30 circuiti",
    "Quadro 200 A da 30 circuiti senza generale installato ed etichettato."
   ],
   "de": [
    "Unterverteiler ohne Hauptschalter tauschen — 200 A, 30 Kreise",
    "Ein 200-A-Unterverteiler mit 30 Plätzen eingebaut und beschriftet."
   ],
   "uk": [
    "Заміна щита без головного автомата — 200 А, 30 ліній",
    "Щит 200 А на 30 ліній без головного автомата встановлено й підписано."
   ],
   "pa": [
    "ਮੇਨ ਲੱਗ ਪੈਨਲ ਬਦਲਣਾ — 200 A, 30 ਸਰਕਟ",
    "30-ਸਰਕਟ 200 A ਮੇਨ ਲੱਗ ਪੈਨਲ ਲਾ ਕੇ ਲੇਬਲ।"
   ],
   "tl": [
    "Pagpapalit ng main lug panel — 200 A, 30 circuit",
    "Ikinabit at nilagyan ng label ang 30-circuit, 200 A main lug panel."
   ]
  },
  "fq.electrical.panels.all_breakers_100a_20": {
   "it": [
    "Sostituzione quadro e interruttori — 100 A, 20 circuiti",
    "Quadro 100 A da 20 circuiti con interruttori nuovi, circuiti ricollegati ed etichettati."
   ],
   "de": [
    "Verteiler- und Automatentausch — 100 A, 20 Kreise",
    "Ein 100-A-Verteiler mit 20 Plätzen und neuen Automaten, Kreise neu angeschlossen und beschriftet."
   ],
   "uk": [
    "Заміна щита й автоматів — 100 А, 20 ліній",
    "Щит 100 А на 20 ліній з новими автоматами, лінії перепідключено й підписано."
   ],
   "pa": [
    "ਪੈਨਲ ਅਤੇ ਬ੍ਰੇਕਰ ਬਦਲਣਾ — 100 A, 20 ਸਰਕਟ",
    "ਨਵੇਂ ਬ੍ਰੇਕਰਾਂ ਵਾਲਾ 20-ਸਰਕਟ 100 A ਪੈਨਲ, ਸਰਕਟ ਮੁੜ ਜੋੜੇ ਅਤੇ ਲੇਬਲ।"
   ],
   "tl": [
    "Pagpapalit ng panel at breaker — 100 A, 20 circuit",
    "Ikinabit ang 20-circuit, 100 A na panel na may bagong breaker, muling ikinonekta at nilagyan ng label."
   ]
  },
  "fq.electrical.ballasts.two_8ft": {
   "it": [
    "Sostituzione reattore — due tubi da 8 ft, elettronico",
    "Il reattore di una plafoniera fluorescente da 8 ft a due lampade, ad altezza standard, sostituito con uno elettronico, 120 V o 277 V."
   ],
   "de": [
    "Vorschaltgerätetausch — zwei 8-ft-Röhren, elektronisch",
    "Das Vorschaltgerät einer 8-ft-Leuchtstoffleuchte mit zwei Röhren in Standardhöhe durch ein elektronisches ersetzt, 120 V oder 277 V."
   ],
   "uk": [
    "Заміна баласту — дві лампи 8 футів, електронний",
    "Баласт у люмінесцентному світильнику на дві лампи 8 футів на стандартній висоті замінено електронним, 120 В чи 277 В."
   ],
   "pa": [
    "ਬੈਲਾਸਟ ਬਦਲਣਾ — ਦੋ 8 ਫੁੱਟ ਟਿਊਬ, ਇਲੈਕਟ੍ਰਾਨਿਕ",
    "ਆਮ ਉਚਾਈ ਉੱਤੇ ਦੋ-ਲੈਂਪ 8 ਫੁੱਟ ਫ਼ਲੋਰੋਸੈਂਟ ਲਾਈਟ ਦਾ ਬੈਲਾਸਟ ਇਲੈਕਟ੍ਰਾਨਿਕ ਨਾਲ ਬਦਲਿਆ, 120 V ਜਾਂ 277 V।"
   ],
   "tl": [
    "Pagpapalit ng ballast — dalawang 8 ft na tubo, electronic",
    "Pinalitan ng electronic ang ballast ng 8 ft na fluorescent na may dalawang lampara sa karaniwang taas, 120 V o 277 V."
   ]
  },
  "fq.electrical.ballasts.single_4ft": {
   "it": [
    "Sostituzione reattore — un tubo da 4 ft, elettronico",
    "Il reattore di una plafoniera fluorescente da 4 ft a una lampada, ad altezza standard, sostituito con uno elettronico, 120 V o 277 V."
   ],
   "de": [
    "Vorschaltgerätetausch — eine 4-ft-Röhre, elektronisch",
    "Das Vorschaltgerät einer 4-ft-Leuchtstoffleuchte mit einer Röhre in Standardhöhe durch ein elektronisches ersetzt, 120 V oder 277 V."
   ],
   "uk": [
    "Заміна баласту — одна лампа 4 футів, електронний",
    "Баласт у люмінесцентному світильнику на одну лампу 4 футів на стандартній висоті замінено електронним, 120 В чи 277 В."
   ],
   "pa": [
    "ਬੈਲਾਸਟ ਬਦਲਣਾ — ਇੱਕ 4 ਫੁੱਟ ਟਿਊਬ, ਇਲੈਕਟ੍ਰਾਨਿਕ",
    "ਆਮ ਉਚਾਈ ਉੱਤੇ ਇੱਕ-ਲੈਂਪ 4 ਫੁੱਟ ਫ਼ਲੋਰੋਸੈਂਟ ਲਾਈਟ ਦਾ ਬੈਲਾਸਟ ਇਲੈਕਟ੍ਰਾਨਿਕ ਨਾਲ ਬਦਲਿਆ, 120 V ਜਾਂ 277 V।"
   ],
   "tl": [
    "Pagpapalit ng ballast — isang 4 ft na tubo, electronic",
    "Pinalitan ng electronic ang ballast ng 4 ft na fluorescent na may isang lampara sa karaniwang taas, 120 V o 277 V."
   ]
  },
  "fq.electrical.ballasts.two_4ft": {
   "it": [
    "Sostituzione reattore — due tubi da 4 ft, elettronico",
    "Il reattore di una plafoniera fluorescente da 4 ft a due lampade, ad altezza standard, sostituito con uno elettronico, 120 V o 277 V."
   ],
   "de": [
    "Vorschaltgerätetausch — zwei 4-ft-Röhren, elektronisch",
    "Das Vorschaltgerät einer 4-ft-Leuchtstoffleuchte mit zwei Röhren in Standardhöhe durch ein elektronisches ersetzt, 120 V oder 277 V."
   ],
   "uk": [
    "Заміна баласту — дві лампи 4 футів, електронний",
    "Баласт у люмінесцентному світильнику на дві лампи 4 футів на стандартній висоті замінено електронним, 120 В чи 277 В."
   ],
   "pa": [
    "ਬੈਲਾਸਟ ਬਦਲਣਾ — ਦੋ 4 ਫੁੱਟ ਟਿਊਬ, ਇਲੈਕਟ੍ਰਾਨਿਕ",
    "ਆਮ ਉਚਾਈ ਉੱਤੇ ਦੋ-ਲੈਂਪ 4 ਫੁੱਟ ਫ਼ਲੋਰੋਸੈਂਟ ਲਾਈਟ ਦਾ ਬੈਲਾਸਟ ਇਲੈਕਟ੍ਰਾਨਿਕ ਨਾਲ ਬਦਲਿਆ, 120 V ਜਾਂ 277 V।"
   ],
   "tl": [
    "Pagpapalit ng ballast — dalawang 4 ft na tubo, electronic",
    "Pinalitan ng electronic ang ballast ng 4 ft na fluorescent na may dalawang lampara sa karaniwang taas, 120 V o 277 V."
   ]
  },
  "fq.electrical.ballasts.single_8ft": {
   "it": [
    "Sostituzione reattore — un tubo da 8 ft, elettronico",
    "Il reattore di una plafoniera fluorescente da 8 ft a una lampada, ad altezza standard, sostituito con uno elettronico, 120 V o 277 V."
   ],
   "de": [
    "Vorschaltgerätetausch — eine 8-ft-Röhre, elektronisch",
    "Das Vorschaltgerät einer 8-ft-Leuchtstoffleuchte mit einer Röhre in Standardhöhe durch ein elektronisches ersetzt, 120 V oder 277 V."
   ],
   "uk": [
    "Заміна баласту — одна лампа 8 футів, електронний",
    "Баласт у люмінесцентному світильнику на одну лампу 8 футів на стандартній висоті замінено електронним, 120 В чи 277 В."
   ],
   "pa": [
    "ਬੈਲਾਸਟ ਬਦਲਣਾ — ਇੱਕ 8 ਫੁੱਟ ਟਿਊਬ, ਇਲੈਕਟ੍ਰਾਨਿਕ",
    "ਆਮ ਉਚਾਈ ਉੱਤੇ ਇੱਕ-ਲੈਂਪ 8 ਫੁੱਟ ਫ਼ਲੋਰੋਸੈਂਟ ਲਾਈਟ ਦਾ ਬੈਲਾਸਟ ਇਲੈਕਟ੍ਰਾਨਿਕ ਨਾਲ ਬਦਲਿਆ, 120 V ਜਾਂ 277 V।"
   ],
   "tl": [
    "Pagpapalit ng ballast — isang 8 ft na tubo, electronic",
    "Pinalitan ng electronic ang ballast ng 8 ft na fluorescent na may isang lampara sa karaniwang taas, 120 V o 277 V."
   ]
  },
  "fq.electrical.dimmers.three_way_1000w": {
   "it": [
    "Dimmer — 1000 W, deviato",
    "Dimmer da 1000 W installato o sostituito per regolare la luce da due punti."
   ],
   "de": [
    "Dimmer — 1000 W, Wechsel",
    "Ein 1000-W-Dimmer eingebaut oder ersetzt, um Licht von zwei Stellen zu dimmen."
   ],
   "uk": [
    "Диммер — 1000 Вт, прохідний",
    "Диммер 1000 Вт встановлено чи замінено для керування світлом із двох місць."
   ],
   "pa": [
    "ਡਿਮਰ — 1000 W, 3-ਵੇਅ",
    "1000 W ਡਿਮਰ ਲਾਇਆ ਜਾਂ ਬਦਲਿਆ, ਦੋ ਥਾਵਾਂ ਤੋਂ ਲਾਈਟ ਘੱਟ-ਵੱਧ ਕਰਨ ਲਈ।"
   ],
   "tl": [
    "Dimmer — 1000 W, 3-way",
    "Ikinabit o pinalitan ang 1000 W na dimmer para ma-dim ang ilaw mula sa dalawang lugar."
   ]
  },
  "fq.electrical.dimmers.single_pole_600w_slide": {
   "it": [
    "Dimmer — 600 W, unipolare, a cursore",
    "Dimmer da 600 W installato o sostituito su un circuito luce."
   ],
   "de": [
    "Dimmer — 600 W, einpolig, Schieber",
    "Ein 600-W-Dimmer eingebaut oder ersetzt, an einem Lichtkreis."
   ],
   "uk": [
    "Диммер — 600 Вт, однополюсний, з повзунком",
    "Диммер 600 Вт встановлено чи замінено на одній лінії освітлення."
   ],
   "pa": [
    "ਡਿਮਰ — 600 W, ਸਿੰਗਲ ਪੋਲ, ਸਲਾਈਡ",
    "600 W ਡਿਮਰ ਲਾਇਆ ਜਾਂ ਬਦਲਿਆ, ਇੱਕ ਲਾਈਟ ਸਰਕਟ ਉੱਤੇ।"
   ],
   "tl": [
    "Dimmer — 600 W, single pole, slide",
    "Ikinabit o pinalitan ang 600 W na dimmer sa isang circuit ng ilaw."
   ]
  },
  "fq.electrical.dimmers.three_way_600w_toggle": {
   "it": [
    "Dimmer — 600 W, deviato, a levetta",
    "Dimmer da 600 W installato o sostituito per regolare la luce da due punti."
   ],
   "de": [
    "Dimmer — 600 W, Wechsel, Kippschalter",
    "Ein 600-W-Dimmer eingebaut oder ersetzt, um Licht von zwei Stellen zu dimmen."
   ],
   "uk": [
    "Диммер — 600 Вт, прохідний, клавішний",
    "Диммер 600 Вт встановлено чи замінено для керування світлом із двох місць."
   ],
   "pa": [
    "ਡਿਮਰ — 600 W, 3-ਵੇਅ, ਟੌਗਲ",
    "600 W ਡਿਮਰ ਲਾਇਆ ਜਾਂ ਬਦਲਿਆ, ਦੋ ਥਾਵਾਂ ਤੋਂ ਲਾਈਟ ਘੱਟ-ਵੱਧ ਕਰਨ ਲਈ।"
   ],
   "tl": [
    "Dimmer — 600 W, 3-way, toggle",
    "Ikinabit o pinalitan ang 600 W na dimmer para ma-dim ang ilaw mula sa dalawang lugar."
   ]
  },
  "fq.electrical.dimmers.single_pole_600w_toggle": {
   "it": [
    "Dimmer — 600 W, unipolare, a levetta",
    "Dimmer da 600 W installato o sostituito su un circuito luce."
   ],
   "de": [
    "Dimmer — 600 W, einpolig, Kippschalter",
    "Ein 600-W-Dimmer eingebaut oder ersetzt, an einem Lichtkreis."
   ],
   "uk": [
    "Диммер — 600 Вт, однополюсний, клавішний",
    "Диммер 600 Вт встановлено чи замінено на одній лінії освітлення."
   ],
   "pa": [
    "ਡਿਮਰ — 600 W, ਸਿੰਗਲ ਪੋਲ, ਟੌਗਲ",
    "600 W ਡਿਮਰ ਲਾਇਆ ਜਾਂ ਬਦਲਿਆ, ਇੱਕ ਲਾਈਟ ਸਰਕਟ ਉੱਤੇ।"
   ],
   "tl": [
    "Dimmer — 600 W, single pole, toggle",
    "Ikinabit o pinalitan ang 600 W na dimmer sa isang circuit ng ilaw."
   ]
  },
  "fq.electrical.dimmers.single_pole_1000w_slide": {
   "it": [
    "Dimmer — 1000 W, unipolare, a cursore",
    "Dimmer da 1000 W installato o sostituito su un circuito luce."
   ],
   "de": [
    "Dimmer — 1000 W, einpolig, Schieber",
    "Ein 1000-W-Dimmer eingebaut oder ersetzt, an einem Lichtkreis."
   ],
   "uk": [
    "Диммер — 1000 Вт, однополюсний, з повзунком",
    "Диммер 1000 Вт встановлено чи замінено на одній лінії освітлення."
   ],
   "pa": [
    "ਡਿਮਰ — 1000 W, ਸਿੰਗਲ ਪੋਲ, ਸਲਾਈਡ",
    "1000 W ਡਿਮਰ ਲਾਇਆ ਜਾਂ ਬਦਲਿਆ, ਇੱਕ ਲਾਈਟ ਸਰਕਟ ਉੱਤੇ।"
   ],
   "tl": [
    "Dimmer — 1000 W, single pole, slide",
    "Ikinabit o pinalitan ang 1000 W na dimmer sa isang circuit ng ilaw."
   ]
  },
  "fq.electrical.recessed.six_inch_access_above": {
   "it": [
    "Faretto da incasso — 6 in tondo, accesso dal sottotetto",
    "Faretto tondo da 6 in, cornice nera o bianca, installato dove il soffitto è raggiungibile dall'alto."
   ],
   "de": [
    "Einbauleuchte — 6 in rund, Dachbodenzugang",
    "Eine runde 6-in-Einbauleuchte, Rahmen schwarz oder weiß, eingebaut, wo die Decke von oben erreichbar ist."
   ],
   "uk": [
    "Вбудований світильник — 6 дюйм., круглий, доступ згори",
    "Круглий світильник 6 дюйм., чорна чи біла рамка, там, де стеля доступна згори."
   ],
   "pa": [
    "ਧੱਸੀ ਲਾਈਟ — 6 ਇੰਚ ਗੋਲ, ਅਟਾਰੀ ਤੋਂ ਪਹੁੰਚ",
    "6 ਇੰਚ ਗੋਲ ਲਾਈਟ, ਕਾਲੀ ਜਾਂ ਚਿੱਟੀ ਟ੍ਰਿਮ, ਜਿੱਥੇ ਛੱਤ ਉੱਪਰੋਂ ਪਹੁੰਚਯੋਗ ਹੈ।"
   ],
   "tl": [
    "Recessed na ilaw — 6 in bilog, may access sa attic",
    "6 in na bilog na recessed na ilaw, itim o puting trim, kung saan maaabot ang kisame mula sa itaas."
   ]
  },
  "fq.electrical.recessed.four_inch_no_access": {
   "it": [
    "Faretto da incasso — 4 in tondo, senza accesso",
    "Faretto tondo da 4 in per ristrutturazione inserito in un soffitto finito."
   ],
   "de": [
    "Einbauleuchte — 4 in rund, ohne Zugang",
    "Eine runde 4-in-Renovierungs-Einbauleuchte in eine fertige Decke gesetzt."
   ],
   "uk": [
    "Вбудований світильник — 4 дюйм., круглий, без доступу",
    "Круглий ремонтний світильник 4 дюйм. врізано в готову стелю."
   ],
   "pa": [
    "ਧੱਸੀ ਲਾਈਟ — 4 ਇੰਚ ਗੋਲ, ਬਿਨਾਂ ਪਹੁੰਚ",
    "4 ਇੰਚ ਗੋਲ ਰੀਮਾਡਲ ਲਾਈਟ ਤਿਆਰ ਛੱਤ ਵਿੱਚ ਕੱਟ ਕੇ ਲਾਈ।"
   ],
   "tl": [
    "Recessed na ilaw — 4 in bilog, walang access",
    "4 in na bilog na remodel na recessed na ilaw na ikinabit sa tapos na kisame."
   ]
  },
  "fq.electrical.recessed.five_inch_no_access": {
   "it": [
    "Faretto da incasso — 5 in tondo, senza accesso",
    "Faretto tondo da 5 in per ristrutturazione inserito in un soffitto finito."
   ],
   "de": [
    "Einbauleuchte — 5 in rund, ohne Zugang",
    "Eine runde 5-in-Renovierungs-Einbauleuchte in eine fertige Decke gesetzt."
   ],
   "uk": [
    "Вбудований світильник — 5 дюйм., круглий, без доступу",
    "Круглий ремонтний світильник 5 дюйм. врізано в готову стелю."
   ],
   "pa": [
    "ਧੱਸੀ ਲਾਈਟ — 5 ਇੰਚ ਗੋਲ, ਬਿਨਾਂ ਪਹੁੰਚ",
    "5 ਇੰਚ ਗੋਲ ਰੀਮਾਡਲ ਲਾਈਟ ਤਿਆਰ ਛੱਤ ਵਿੱਚ ਕੱਟ ਕੇ ਲਾਈ।"
   ],
   "tl": [
    "Recessed na ilaw — 5 in bilog, walang access",
    "5 in na bilog na remodel na recessed na ilaw na ikinabit sa tapos na kisame."
   ]
  },
  "fq.electrical.recessed.six_inch_no_access": {
   "it": [
    "Faretto da incasso — 6 in tondo, senza accesso",
    "Faretto tondo da 6 in per ristrutturazione inserito in un soffitto finito."
   ],
   "de": [
    "Einbauleuchte — 6 in rund, ohne Zugang",
    "Eine runde 6-in-Renovierungs-Einbauleuchte in eine fertige Decke gesetzt."
   ],
   "uk": [
    "Вбудований світильник — 6 дюйм., круглий, без доступу",
    "Круглий ремонтний світильник 6 дюйм. врізано в готову стелю."
   ],
   "pa": [
    "ਧੱਸੀ ਲਾਈਟ — 6 ਇੰਚ ਗੋਲ, ਬਿਨਾਂ ਪਹੁੰਚ",
    "6 ਇੰਚ ਗੋਲ ਰੀਮਾਡਲ ਲਾਈਟ ਤਿਆਰ ਛੱਤ ਵਿੱਚ ਕੱਟ ਕੇ ਲਾਈ।"
   ],
   "tl": [
    "Recessed na ilaw — 6 in bilog, walang access",
    "6 in na bilog na remodel na recessed na ilaw na ikinabit sa tapos na kisame."
   ]
  },
  "fq.electrical.recessed.wall_washer_no_access": {
   "it": [
    "Faretto da incasso wall-washer — senza accesso",
    "Faretto orientabile da incasso inserito in un soffitto finito per illuminare una parete o un'opera."
   ],
   "de": [
    "Wandfluter-Einbauleuchte — ohne Zugang",
    "Eine schwenkbare Wandfluter-Einbauleuchte in eine fertige Decke gesetzt, um eine Wand oder ein Bild zu beleuchten."
   ],
   "uk": [
    "Вбудований світильник для підсвітки стін — без доступу",
    "Спрямований світильник врізано в готову стелю, щоб підсвітити стіну чи картину."
   ],
   "pa": [
    "ਕੰਧ ਰੋਸ਼ਨ ਕਰਨ ਵਾਲੀ ਧੱਸੀ ਲਾਈਟ — ਬਿਨਾਂ ਪਹੁੰਚ",
    "ਕੰਧ ਜਾਂ ਤਸਵੀਰ ਰੋਸ਼ਨ ਕਰਨ ਲਈ ਦਿਸ਼ਾ ਵਾਲੀ ਲਾਈਟ ਤਿਆਰ ਛੱਤ ਵਿੱਚ ਕੱਟ ਕੇ ਲਾਈ।"
   ],
   "tl": [
    "Recessed na wall-washer — walang access",
    "Ikinabit sa tapos na kisame ang nakatutok na recessed na ilaw para ilawan ang pader o larawan."
   ]
  },
  "fq.electrical.lighting.install_fixtures": {
   "pa": [
    "ਲਾਈਟ ਫ਼ਿਕਸਚਰ ਲਾਉਣਾ — ਗਾਹਕ ਦਾ",
    "ਗਾਹਕ ਦੀ ਖ਼ਰੀਦੀ ਲਾਈਟ — ਝੂਮਰ, ਪੈਂਡੈਂਟ ਜਾਂ ਫ਼ਲੱਸ਼ ਮਾਊਂਟ — ਮੌਜੂਦਾ ਬਾਕਸ ਉੱਤੇ ਟੰਗ ਕੇ ਜੋੜੀ।"
   ]
  },
  "fq.electrical.lighting.led_install": {
   "pa": [
    "LED ਲਾਈਟਾਂ ਲਾਉਣਾ",
    "ਪੁਰਾਣੀਆਂ ਲਾਈਟਾਂ ਦੀ ਥਾਂ LED ਫ਼ਿਕਸਚਰ ਜਾਂ ਲੈਂਪ, ਡਿਮਰ ਨਾਲ ਮੇਲ ਜਾਂਚਿਆ।"
   ]
  },
  "fq.electrical.outdoor.exterior_prewire": {
   "it": [
    "Predisposizione luce esterna con interruttore",
    "Alimentazione 120 V e scatola predisposte per una futura lampada esterna, con l'interruttore finito all'interno."
   ],
   "de": [
    "Vorverkabelung Außenleuchte mit Schalter",
    "120-V-Zuleitung und Dose für eine künftige Außenleuchte vorbereitet, Schalter innen fertig montiert."
   ],
   "uk": [
    "Підведення під зовнішній світильник з вимикачем",
    "Живлення 120 В і коробку прокладено під майбутній зовнішній світильник, вимикач змонтовано всередині."
   ],
   "pa": [
    "ਬਾਹਰੀ ਲਾਈਟ ਲਈ ਪਹਿਲਾਂ ਤਾਰਾਂ, ਸਵਿੱਚ ਸਮੇਤ",
    "ਭਵਿੱਖ ਦੀ ਬਾਹਰੀ ਲਾਈਟ ਲਈ 120 V ਤਾਰ ਅਤੇ ਬਾਕਸ, ਅੰਦਰ ਸਵਿੱਚ ਮੁਕੰਮਲ।"
   ],
   "tl": [
    "Pre-wire ng ilaw sa labas na may switch",
    "Inihanda ang 120 V na linya at kahon para sa ilaw sa labas sa hinaharap, tapos ang switch sa loob."
   ]
  },
  "fq.electrical.outdoor.porch_light_existing": {
   "it": [
    "Lampada da parete per portico nel punto esistente",
    "Nuova lanterna a parete montata al posto della vecchia, sigillata al muro contro le intemperie."
   ],
   "de": [
    "Wandleuchte am Eingang an vorhandener Stelle",
    "Eine neue Wandlaterne anstelle der alten montiert und gegen Witterung zur Wand abgedichtet."
   ],
   "uk": [
    "Настінний ліхтар на ґанку на наявному місці",
    "Новий настінний ліхтар встановлено замість старого й загерметизовано від негоди."
   ],
   "pa": [
    "ਮੌਜੂਦਾ ਥਾਂ ਉੱਤੇ ਕੰਧ ਵਾਲੀ ਵਰਾਂਡਾ ਲਾਈਟ",
    "ਪੁਰਾਣੀ ਦੀ ਥਾਂ ਨਵੀਂ ਕੰਧ ਲਾਲਟੈਣ, ਮੌਸਮ ਤੋਂ ਕੰਧ ਨਾਲ ਸੀਲ।"
   ],
   "tl": [
    "Ilaw sa beranda sa dating puwesto",
    "Ikinabit ang bagong wall lantern kapalit ng luma at sinelyuhan laban sa panahon."
   ]
  },
  "fq.electrical.outdoor.motion_detector_existing": {
   "it": [
    "Sensore di movimento su lampada esistente",
    "Sensore di movimento collegato a una luce esterna esistente, che si accende quando qualcuno si avvicina."
   ],
   "de": [
    "Bewegungsmelder an vorhandener Leuchte",
    "Ein Bewegungsmelder an eine vorhandene Außenleuchte angeschlossen, damit sie bei Annäherung angeht."
   ],
   "uk": [
    "Датчик руху на наявний світильник",
    "Датчик руху підключено до наявного зовнішнього світильника — вмикається, коли хтось підходить."
   ],
   "pa": [
    "ਮੌਜੂਦਾ ਲਾਈਟ ਉੱਤੇ ਮੋਸ਼ਨ ਸੈਂਸਰ",
    "ਮੌਜੂਦਾ ਬਾਹਰੀ ਲਾਈਟ ਨਾਲ ਮੋਸ਼ਨ ਸੈਂਸਰ ਜੋੜਿਆ ਤਾਂ ਜੋ ਕੋਈ ਆਵੇ ਤਾਂ ਜਗੇ।"
   ],
   "tl": [
    "Motion sensor sa dating ilaw",
    "Ikinonekta ang motion sensor sa dating ilaw sa labas para bumukas kapag may lumapit."
   ]
  },
  "fq.electrical.outdoor.quartz_flood_500w": {
   "it": [
    "Proiettore al quarzo a parete nel punto esistente — 500 W",
    "Proiettore al quarzo da 500 W montato dove c'è già un punto luce e orientato sull'area da illuminare."
   ],
   "de": [
    "Quarz-Strahler an vorhandener Stelle — 500 W",
    "Ein 500-W-Quarzstrahler an einer vorhandenen Leuchtenstelle montiert und auf die Fläche ausgerichtet."
   ],
   "uk": [
    "Кварцовий прожектор на наявному місці — 500 Вт",
    "Кварцовий прожектор 500 Вт встановлено на наявну точку й спрямовано на потрібну зону."
   ],
   "pa": [
    "ਮੌਜੂਦਾ ਥਾਂ ਉੱਤੇ ਕੁਆਰਟਜ਼ ਫ਼ਲੱਡ ਲਾਈਟ — 500 W",
    "ਮੌਜੂਦਾ ਲਾਈਟ ਵਾਲੀ ਥਾਂ ਉੱਤੇ 500 W ਕੁਆਰਟਜ਼ ਫ਼ਲੱਡ ਲਾਈਟ, ਰੋਸ਼ਨ ਕਰਨ ਵਾਲੀ ਥਾਂ ਵੱਲ।"
   ],
   "tl": [
    "Quartz floodlight sa dating puwesto — 500 W",
    "Ikinabit ang 500 W na quartz floodlight sa dating puwesto at itinutok sa lugar na iilawan."
   ]
  },
  "fq.electrical.outdoor.post_light_25ft": {
   "it": [
    "Lampione con testa 100 W — fino a 25 ft dalla casa",
    "Lampione nero o bianco posato e cablato interrato fino a 25 ft dalla casa, con testa da 100 W."
   ],
   "de": [
    "Mastleuchte mit 100-W-Kopf — bis 25 ft vom Haus",
    "Ein schwarzer oder weißer Leuchtenmast gesetzt und bis 25 ft vom Haus unterirdisch verkabelt, mit 100-W-Kopf."
   ],
   "uk": [
    "Стовпчиковий ліхтар 100 Вт — до 25 футів від дому",
    "Чорний чи білий стовпчик встановлено й підключено під землею до 25 футів від дому, голова 100 Вт."
   ],
   "pa": [
    "100 W ਵਾਲੀ ਪੋਸਟ ਲਾਈਟ — ਘਰ ਤੋਂ 25 ਫੁੱਟ ਤੱਕ",
    "ਕਾਲਾ ਜਾਂ ਚਿੱਟਾ ਲੈਂਪ ਖੰਭਾ ਘਰ ਤੋਂ 25 ਫੁੱਟ ਤੱਕ ਜ਼ਮੀਨਦੋਜ਼ ਤਾਰਾਂ ਨਾਲ, 100 W ਲਾਈਟ ਸਮੇਤ।"
   ],
   "tl": [
    "Post light na may 100 W — hanggang 25 ft mula sa bahay",
    "Itinayo at dinaluyan ng kawad sa ilalim ng lupa ang itim o puting poste hanggang 25 ft mula sa bahay, may 100 W na ilaw."
   ]
  },
  "fq.electrical.outdoor.new_feed_box": {
   "it": [
    "Nuova alimentazione e scatola per lampada esterna",
    "Nuova scatola stagna collegata a un circuito esistente per mettere una luce esterna dove non c'era."
   ],
   "de": [
    "Neue Zuleitung und Dose für eine Außenleuchte",
    "Eine neue wetterfeste Dose von einem vorhandenen Kreis versorgt, damit eine Außenleuchte dorthin kann, wo keine war."
   ],
   "uk": [
    "Нове живлення й коробка для зовнішнього світильника",
    "Нову герметичну коробку підключено від наявної лінії, щоб поставити світильник там, де його не було."
   ],
   "pa": [
    "ਬਾਹਰੀ ਲਾਈਟ ਲਈ ਨਵੀਂ ਤਾਰ ਅਤੇ ਬਾਕਸ",
    "ਮੌਜੂਦਾ ਸਰਕਟ ਤੋਂ ਨਵਾਂ ਮੌਸਮ-ਰੋਧੀ ਬਾਕਸ ਤਾਂ ਜੋ ਜਿੱਥੇ ਲਾਈਟ ਨਹੀਂ ਸੀ ਉੱਥੇ ਲੱਗੇ।"
   ],
   "tl": [
    "Bagong linya at kahon para sa ilaw sa labas",
    "Bagong weatherproof na kahon mula sa dating circuit para malagyan ng ilaw kung saan wala dati."
   ]
  },
  "fq.electrical.receptacles.install_outlets": {
   "it": [
    "Installazione prese",
    "Nuova presa aggiunta nel punto scelto, alimentata da un circuito vicino, con scatola incassata e finita."
   ],
   "de": [
    "Steckdosen setzen",
    "Eine neue Steckdose an gewünschter Stelle, von einem nahen Kreis versorgt, Dose eingesetzt und fertig."
   ],
   "uk": [
    "Встановлення розеток",
    "Нову розетку додано в обраному місці від найближчої лінії, коробку врізано й оздоблено."
   ],
   "pa": [
    "ਸਾਕਟ ਲਾਉਣਾ",
    "ਚੁਣੀ ਥਾਂ ਉੱਤੇ ਨਵਾਂ ਸਾਕਟ, ਨੇੜਲੇ ਸਰਕਟ ਤੋਂ, ਬਾਕਸ ਕੱਟ ਕੇ ਮੁਕੰਮਲ।"
   ],
   "tl": [
    "Pagkakabit ng saksakan",
    "Nagdagdag ng saksakan sa napiling lugar mula sa malapit na circuit, ginupitan at tinapos ang kahon."
   ]
  },
  "fq.electrical.receptacles.whole_house_outlets": {
   "it": [
    "Sostituzione di tutte le prese della casa",
    "Ogni presa della casa sostituita con dispositivi antimanomissione e placche nuove, cablaggio controllato a ciascuna."
   ],
   "de": [
    "Austausch aller Steckdosen im Haus",
    "Jede Steckdose im Haus durch neue kindersichere Geräte und Rahmen ersetzt, Verdrahtung an jeder geprüft."
   ],
   "uk": [
    "Заміна всіх розеток у будинку",
    "Кожну розетку замінено новою із захистом від дітей і рамкою, проводку перевірено на кожній."
   ],
   "pa": [
    "ਪੂਰੇ ਘਰ ਦੇ ਸਾਕਟ ਬਦਲਣਾ",
    "ਘਰ ਦਾ ਹਰ ਸਾਕਟ ਨਵੇਂ ਛੇੜ-ਛਾੜ ਰੋਧੀ ਸਾਕਟ ਅਤੇ ਪਲੇਟ ਨਾਲ, ਹਰ ਇੱਕ ਦੀ ਵਾਇਰਿੰਗ ਜਾਂਚੀ।"
   ],
   "tl": [
    "Pagpapalit ng lahat ng saksakan sa bahay",
    "Pinalitan ang bawat saksakan ng bagong tamper-resistant at plate, sinuri ang wiring sa bawat isa."
   ]
  },
  "fq.electrical.receptacles.whole_house_old_work_boxes": {
   "it": [
    "Sostituzione scatole in tutta la casa",
    "Scatole crepate o troppo piccole sostituite in tutta la casa perché i dispositivi stiano a filo e ben fissati."
   ],
   "de": [
    "Austausch der Unterputzdosen im ganzen Haus",
    "Gerissene oder zu kleine Dosen im ganzen Haus ersetzt, damit Geräte bündig und fest sitzen."
   ],
   "uk": [
    "Заміна монтажних коробок у всьому будинку",
    "Тріснуті чи замалі коробки замінено по всьому будинку — прилади сидять рівно й міцно."
   ],
   "pa": [
    "ਪੂਰੇ ਘਰ ਦੇ ਪੁਰਾਣੇ ਬਾਕਸ ਬਦਲਣਾ",
    "ਪੂਰੇ ਘਰ ਵਿੱਚ ਤਿੜਕੇ ਜਾਂ ਛੋਟੇ ਬਾਕਸ ਬਦਲੇ ਤਾਂ ਜੋ ਸਵਿੱਚ-ਸਾਕਟ ਬਰਾਬਰ ਅਤੇ ਪੱਕੇ ਬੈਠਣ।"
   ],
   "tl": [
    "Pagpapalit ng kahon sa buong bahay",
    "Pinalitan ang bitak o maliit na kahon sa buong bahay para pantay at matibay ang device."
   ]
  },
  "fq.electrical.receptacles.replace_15_20a": {
   "it": [
    "Sostituzione presa — 15 o 20 A, 120 V",
    "Presa usurata o danneggiata sostituita con una nuova del valore giusto per il circuito."
   ],
   "de": [
    "Steckdosentausch — 15 oder 20 A, 120 V",
    "Eine abgenutzte oder beschädigte Steckdose durch eine neue mit passender Stromstärke ersetzt."
   ],
   "uk": [
    "Заміна розетки — 15 чи 20 А, 120 В",
    "Зношену чи пошкоджену розетку замінено новою відповідного номіналу."
   ],
   "pa": [
    "ਸਾਕਟ ਬਦਲਣਾ — 15 ਜਾਂ 20 A, 120 V",
    "ਘਿਸਿਆ ਜਾਂ ਖ਼ਰਾਬ ਸਾਕਟ ਸਰਕਟ ਦੇ ਸਹੀ ਦਰਜੇ ਵਾਲੇ ਨਵੇਂ ਨਾਲ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng saksakan — 15 o 20 A, 120 V",
    "Pinalitan ng bagong tamang rating ang gasgas o sirang saksakan."
   ]
  },
  "fq.electrical.receptacles.two_wire_to_three_wire": {
   "it": [
    "Presa a due poli sostituita con presa con terra",
    "Presa senza terra sostituita con una a tre poli, collegata a terra o protetta GFCI secondo il cablaggio."
   ],
   "de": [
    "Zweipolige Steckdose auf Schutzkontakt umgerüstet",
    "Eine ungeerdete Steckdose durch eine mit Schutzkontakt ersetzt, geerdet oder FI-geschützt je nach Leitung."
   ],
   "uk": [
    "Заміна розетки без заземлення на заземлену",
    "Розетку без заземлення замінено на тримісну, заземлену чи з GFCI залежно від проводки."
   ],
   "pa": [
    "ਦੋ-ਪਿੰਨ ਸਾਕਟ ਨੂੰ ਤਿੰਨ-ਪਿੰਨ ਵਿੱਚ ਬਦਲਣਾ",
    "ਬਿਨਾਂ ਅਰਥ ਦੋ-ਛੇਕ ਸਾਕਟ ਤਿੰਨ-ਛੇਕ ਨਾਲ ਬਦਲਿਆ, ਵਾਇਰਿੰਗ ਮੁਤਾਬਕ ਅਰਥ ਜਾਂ GFCI।"
   ],
   "tl": [
    "Pag-upgrade ng 2-prong na saksakan sa 3-prong",
    "Pinalitan ng 3-prong ang walang ground na 2-prong, naka-ground o may GFCI ayon sa wiring."
   ]
  },
  "fq.electrical.receptacles.reverse_polarity": {
   "it": [
    "Correzione presa a polarità invertita",
    "Presa cablata al contrario corretta perché fase e neutro siano dove ogni apparecchio li aspetta."
   ],
   "de": [
    "Steckdose mit vertauschter Polarität korrigieren",
    "Eine verkehrt angeschlossene Steckdose korrigiert, damit Phase und Neutralleiter richtig liegen."
   ],
   "uk": [
    "Виправлення розетки з переплутаною полярністю",
    "Неправильно підключену розетку виправлено — фаза й нуль на своїх місцях."
   ],
   "pa": [
    "ਉਲਟੀ ਪੋਲੈਰਿਟੀ ਵਾਲੇ ਸਾਕਟ ਦੀ ਮੁਰੰਮਤ",
    "ਉਲਟਾ ਜੁੜਿਆ ਸਾਕਟ ਠੀਕ ਕੀਤਾ ਤਾਂ ਜੋ ਫ਼ੇਜ਼ ਅਤੇ ਨਿਊਟ੍ਰਲ ਸਹੀ ਥਾਂ ਹੋਣ।"
   ],
   "tl": [
    "Pag-aayos ng saksakang baligtad ang polarity",
    "Itinama ang baligtad na wiring para nasa tamang lugar ang hot at neutral."
   ]
  },
  "fq.electrical.receptacles.two_wire_to_gfci_indoor": {
   "pa": [
    "ਦੋ-ਪਿੰਨ ਸਾਕਟ ਨੂੰ GFCI ਵਿੱਚ ਬਦਲਣਾ — ਅੰਦਰ",
    "ਬਿਨਾਂ ਅਰਥ ਸਾਕਟ GFCI ਨਾਲ ਬਦਲਿਆ, ਬਿਨਾਂ ਅਰਥ ਵਾਲੇ ਸਰਕਟ ਦੀ ਸੁਰੱਖਿਆ ਦਾ ਮੰਨਿਆ ਢੰਗ।"
   ]
  },
  "fq.electrical.receptacles.gfci_outdoor_cover": {
   "it": [
    "Presa GFCI con coperchio esterno",
    "Presa esterna sostituita con una GFCI e un coperchio stagno utilizzabile a spina inserita."
   ],
   "de": [
    "FI-Steckdose mit Außenabdeckung",
    "Eine Außensteckdose durch eine FI-Steckdose mit wetterfester Abdeckung ersetzt."
   ],
   "uk": [
    "Розетка GFCI із зовнішньою кришкою",
    "Зовнішню розетку замінено на GFCI з герметичною кришкою."
   ],
   "pa": [
    "ਬਾਹਰੀ ਕਵਰ ਵਾਲਾ GFCI ਸਾਕਟ",
    "ਬਾਹਰਲਾ ਸਾਕਟ GFCI ਅਤੇ ਮੌਸਮ-ਰੋਧੀ ਕਵਰ ਨਾਲ ਬਦਲਿਆ।"
   ],
   "tl": [
    "GFCI na saksakan na may takip sa labas",
    "Pinalitan ng GFCI at weatherproof na takip ang saksakan sa labas."
   ]
  },
  "fq.electrical.detectors.co_hardwired": {
   "it": [
    "Rilevatore di CO cablato — nuovo",
    "Rilevatore di monossido 120 V cablato in una nuova posizione, interconnesso con gli altri se presenti."
   ],
   "de": [
    "Festverdrahteter CO-Melder — neu",
    "Ein 120-V-CO-Melder an neuer Stelle verdrahtet und mit vorhandenen vernetzt."
   ],
   "uk": [
    "Провідний датчик CO — новий",
    "Датчик чадного газу 120 В підключено в новому місці й з'єднано з іншими, якщо є."
   ],
   "pa": [
    "ਤਾਰ ਵਾਲਾ CO ਡਿਟੈਕਟਰ — ਨਵਾਂ",
    "ਨਵੀਂ ਥਾਂ ਉੱਤੇ 120 V CO ਡਿਟੈਕਟਰ, ਹੋਰਾਂ ਨਾਲ ਜੁੜਿਆ ਜਿੱਥੇ ਹਨ।"
   ],
   "tl": [
    "Hardwired na CO detector — bago",
    "Ikinabit ang 120 V na CO detector sa bagong puwesto, konektado sa iba kung mayroon."
   ]
  },
  "fq.electrical.detectors.smoke_hardwired_new": {
   "it": [
    "Rilevatore di fumo cablato con batteria — nuovo",
    "Rilevatore di fumo 120 V con batteria tampone cablato in nuova posizione e interconnesso."
   ],
   "de": [
    "Festverdrahteter Rauchmelder mit Akku — neu",
    "Ein 120-V-Rauchmelder mit Pufferbatterie an neuer Stelle verdrahtet und vernetzt."
   ],
   "uk": [
    "Провідний датчик диму з батареєю — новий",
    "Датчик диму 120 В з резервною батареєю підключено в новому місці й з'єднано."
   ],
   "pa": [
    "ਬੈਟਰੀ ਬੈਕਅੱਪ ਵਾਲਾ ਤਾਰ ਵਾਲਾ ਧੂੰਆਂ ਡਿਟੈਕਟਰ — ਨਵਾਂ",
    "ਨਵੀਂ ਥਾਂ ਉੱਤੇ ਬੈਟਰੀ ਬੈਕਅੱਪ ਵਾਲਾ 120 V ਧੂੰਆਂ ਡਿਟੈਕਟਰ, ਆਪਸ ਵਿੱਚ ਜੁੜਿਆ।"
   ],
   "tl": [
    "Hardwired na smoke detector na may baterya — bago",
    "Ikinabit sa bagong puwesto ang 120 V na smoke detector na may backup na baterya at pinagkonekta."
   ]
  },
  "fq.electrical.detectors.smoke_hardwired_replace": {
   "pa": [
    "ਤਾਰ ਵਾਲਾ ਧੂੰਆਂ ਡਿਟੈਕਟਰ ਬੈਟਰੀ ਸਮੇਤ — ਬਦਲੀ",
    "ਮਿਆਦ ਪੁੱਗਿਆ ਜਾਂ ਖ਼ਰਾਬ ਡਿਟੈਕਟਰ ਮੌਜੂਦਾ ਤਾਰਾਂ ਉੱਤੇ ਬਦਲਿਆ।"
   ]
  },
  "fq.electrical.specialty.ev_charger": {
   "pa": [
    "EV ਚਾਰਜਰ ਲਾਉਣਾ",
    "ਪੈਨਲ ਤੋਂ ਖ਼ਾਸ 240 V ਸਰਕਟ ਅਤੇ ਚਾਰਜਰ ਲਾ ਕੇ ਜੋੜਿਆ, ਕਾਰ ਲਈ ਤਿਆਰ।"
   ]
  },
  "fq.electrical.specialty.generator": {
   "it": [
    "Installazione generatore",
    "Generatore fisso o portatile collegato tramite presa e interblocco o commutatore perché la casa funzioni in sicurezza."
   ],
   "de": [
    "Generatoranschluss",
    "Ein Stand- oder Mobilgenerator über Einspeisedose und Verriegelung oder Umschalter angeschlossen, damit das Haus sicher darüber läuft."
   ],
   "uk": [
    "Підключення генератора",
    "Стаціонарний чи переносний генератор підключено через ввід і блокування чи перемикач, щоб дім безпечно працював від нього."
   ],
   "pa": [
    "ਜਨਰੇਟਰ ਲਾਉਣਾ",
    "ਸਟੈਂਡਬਾਈ ਜਾਂ ਪੋਰਟੇਬਲ ਜਨਰੇਟਰ ਇਨਲੈੱਟ ਅਤੇ ਇੰਟਰਲੌਕ ਜਾਂ ਟ੍ਰਾਂਸਫ਼ਰ ਸਵਿੱਚ ਨਾਲ ਜੋੜਿਆ ਤਾਂ ਜੋ ਘਰ ਸੁਰੱਖਿਅਤ ਚੱਲੇ।"
   ],
   "tl": [
    "Pagkakabit ng generator",
    "Ikinonekta ang standby o portable na generator sa inlet at interlock o transfer switch para ligtas na tumakbo ang bahay dito."
   ]
  },
  "fq.electrical.switches.four_way": {
   "it": [
    "Sostituzione invertitore",
    "Invertitore sostituito in un circuito comandato da tre o più punti."
   ],
   "de": [
    "Kreuzschalter tauschen",
    "Ein Kreuzschalter in einem Kreis mit drei oder mehr Schaltstellen ersetzt."
   ],
   "uk": [
    "Заміна перехресного вимикача",
    "Перехресний вимикач замінено в лінії з трьома й більше місцями керування."
   ],
   "pa": [
    "4-ਵੇਅ ਸਵਿੱਚ ਬਦਲਣਾ",
    "ਤਿੰਨ ਜਾਂ ਵੱਧ ਥਾਵਾਂ ਤੋਂ ਚੱਲਣ ਵਾਲੇ ਸਰਕਟ ਵਿੱਚ 4-ਵੇਅ ਸਵਿੱਚ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng 4-way switch",
    "Pinalitan ang 4-way switch sa circuit na kinokontrol mula sa tatlo o higit pang lugar."
   ]
  },
  "fq.electrical.switches.three_way": {
   "it": [
    "Sostituzione deviatore",
    "Deviatore sostituito in un circuito comandato da due punti."
   ],
   "de": [
    "Wechselschalter tauschen",
    "Ein Wechselschalter in einem Kreis mit zwei Schaltstellen ersetzt."
   ],
   "uk": [
    "Заміна прохідного вимикача",
    "Прохідний вимикач замінено в лінії з двома місцями керування."
   ],
   "pa": [
    "3-ਵੇਅ ਸਵਿੱਚ ਬਦਲਣਾ",
    "ਦੋ ਥਾਵਾਂ ਤੋਂ ਚੱਲਣ ਵਾਲੇ ਸਰਕਟ ਵਿੱਚ 3-ਵੇਅ ਸਵਿੱਚ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng 3-way switch",
    "Pinalitan ang 3-way switch sa circuit na kinokontrol mula sa dalawang lugar."
   ]
  },
  "fq.electrical.switches.double_pole": {
   "it": [
    "Sostituzione interruttore bipolare",
    "Interruttore bipolare sostituito su un carico a 240 V, come un termoconvettore o uno scaldabagno."
   ],
   "de": [
    "Zweipoligen Schalter tauschen",
    "Ein zweipoliger Schalter an einer 240-V-Last wie Sockelheizung oder Boiler ersetzt."
   ],
   "uk": [
    "Заміна двополюсного вимикача",
    "Двополюсний вимикач замінено на навантаженні 240 В — плінтусному обігрівачі чи бойлері."
   ],
   "pa": [
    "ਡਬਲ-ਪੋਲ ਸਵਿੱਚ ਬਦਲਣਾ",
    "ਬੇਸਬੋਰਡ ਹੀਟਰ ਜਾਂ ਵਾਟਰ ਹੀਟਰ ਵਰਗੇ 240 V ਲੋਡ ਉੱਤੇ ਡਬਲ-ਪੋਲ ਸਵਿੱਚ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng double-pole switch",
    "Pinalitan ang double-pole switch sa 240 V na karga gaya ng baseboard heater o water heater."
   ]
  },
  "fq.electrical.switches.single_pole": {
   "it": [
    "Sostituzione interruttore unipolare",
    "Interruttore della luce usurato o rotto sostituito con uno nuovo e placca."
   ],
   "de": [
    "Einpoligen Schalter tauschen",
    "Ein abgenutzter oder defekter Lichtschalter samt Rahmen durch einen neuen ersetzt."
   ],
   "uk": [
    "Заміна однополюсного вимикача",
    "Зношений чи зламаний вимикач світла замінено новим із рамкою."
   ],
   "pa": [
    "ਸਿੰਗਲ-ਪੋਲ ਸਵਿੱਚ ਬਦਲਣਾ",
    "ਘਿਸਿਆ ਜਾਂ ਟੁੱਟਿਆ ਲਾਈਟ ਸਵਿੱਚ ਨਵੇਂ ਅਤੇ ਪਲੇਟ ਨਾਲ ਬਦਲਿਆ।"
   ],
   "tl": [
    "Pagpapalit ng single-pole switch",
    "Pinalitan ng bago at may plate ang gasgas o sirang switch ng ilaw."
   ]
  },
  "fq.electrical.switches.digital_timer": {
   "it": [
    "Timer digitale da parete 24 ore — unipolare",
    "Interruttore programmabile a tempo al posto di uno standard, perché luci o ventilatore funzionino a orario."
   ],
   "de": [
    "Digitale 24-Stunden-Zeitschaltuhr — einpolig",
    "Ein programmierbarer Zeitschalter anstelle eines normalen Schalters, damit Licht oder Lüfter nach Plan laufen."
   ],
   "uk": [
    "Цифровий настінний таймер 24 год — однополюсний",
    "Програмований таймер замість звичайного вимикача — світло чи вентилятор за розкладом."
   ],
   "pa": [
    "24-ਘੰਟੇ ਡਿਜੀਟਲ ਕੰਧ ਟਾਈਮਰ — ਸਿੰਗਲ ਪੋਲ",
    "ਆਮ ਸਵਿੱਚ ਦੀ ਥਾਂ ਪ੍ਰੋਗਰਾਮ ਹੋਣ ਵਾਲਾ ਟਾਈਮਰ ਤਾਂ ਜੋ ਲਾਈਟਾਂ ਜਾਂ ਪੱਖਾ ਸਮਾਂ-ਸਾਰਣੀ ਉੱਤੇ ਚੱਲਣ।"
   ],
   "tl": [
    "24-oras na digital wall timer — single pole",
    "Programmable na timer kapalit ng karaniwang switch para tumakbo ang ilaw o fan ayon sa iskedyul."
   ]
  },
  "fq.electrical.visits.standard_install": {
   "it": [
    "Installazione standard",
    "Nuova apparecchiatura o lampada scelta dal cliente installata e collegata, prezzo a lavoro."
   ],
   "de": [
    "Standardmontage",
    "Vom Kunden gewähltes Gerät oder Leuchte montiert und angeschlossen, Preis pro Auftrag."
   ],
   "uk": [
    "Стандартний монтаж",
    "Обране клієнтом обладнання чи світильник встановлено й підключено, ціна за роботу."
   ],
   "pa": [
    "ਆਮ ਇੰਸਟਾਲੇਸ਼ਨ",
    "ਗਾਹਕ ਦਾ ਚੁਣਿਆ ਨਵਾਂ ਸਾਜ਼ੋ-ਸਮਾਨ ਜਾਂ ਲਾਈਟ ਲਾ ਕੇ ਜੋੜੀ, ਕੰਮ ਦੇ ਹਿਸਾਬ ਰੇਟ।"
   ],
   "tl": [
    "Standard na pagkakabit",
    "Ikinabit at ikinonekta ang napiling kagamitan o ilaw ng kliyente, presyo kada trabaho."
   ]
  },
  "fq.electrical.visits.diagnostic_visit": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਇਲੈਕਟ੍ਰੀਸ਼ੀਅਨ ਲੱਭਦਾ ਹੈ ਕਿ ਕੀ ਖ਼ਰਾਬ ਹੈ ਅਤੇ ਕੰਮ ਤੋਂ ਪਹਿਲਾਂ ਮੁਰੰਮਤ ਦਾ ਲਿਖਤੀ ਰੇਟ ਦਿੰਦਾ ਹੈ।"
   ]
  },
  "fq.electrical.visits.service_visit": {
   "pa": [
    "ਸਰਵਿਸ ਵਿਜ਼ਿਟ",
    "ਬੰਦ ਹੋਈ ਚੀਜ਼ ਠੀਕ ਕਰਨ ਲਈ ਸੱਦਾ, ਹੋ ਸਕੇ ਤਾਂ ਮੌਕੇ ਉੱਤੇ ਠੀਕ।"
   ]
  },
  "fq.electrical.visits.preventative_maintenance": {
   "pa": [
    "ਰੋਕਥਾਮ ਵਾਲਾ ਰੱਖ-ਰਖਾਅ",
    "ਪੈਨਲ, ਕਨੈਕਸ਼ਨਾਂ ਅਤੇ ਸੁਰੱਖਿਆ ਯੰਤਰਾਂ ਦੀ ਤੈਅ ਜਾਂਚ ਤਾਂ ਜੋ ਛੋਟੇ ਨੁਕਸ ਖ਼ਰਾਬ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਫੜੇ ਜਾਣ।"
   ]
  },
  "fq.electrical.visits.safety_inspection": {
   "pa": [
    "ਬਿਜਲੀ ਸੁਰੱਖਿਆ ਜਾਂਚ",
    "ਪੈਨਲ, ਵਾਇਰਿੰਗ, ਸਾਕਟ, GFCI ਅਤੇ AFCI ਯੰਤਰ ਅਤੇ ਧੂੰਆਂ ਡਿਟੈਕਟਰ ਕਮਰਾ-ਦਰ-ਕਮਰਾ ਜਾਂਚੇ, ਲੋੜੀਂਦੇ ਕੰਮਾਂ ਦੀ ਲਿਖਤੀ ਸੂਚੀ।"
   ]
  },
  "fq.electrical.visits.annual_maintenance": {
   "pa": [
    "ਸਾਲਾਨਾ ਪੈਨਲ ਅਤੇ GFCI ਸੰਭਾਲ",
    "ਸਾਲਾਨਾ ਵਿਜ਼ਿਟ: ਬ੍ਰੇਕਰ ਕਨੈਕਸ਼ਨ ਕੱਸੇ, ਪੈਨਲ ਲੇਬਲ ਜਾਂਚੇ ਅਤੇ ਹਰ ਧੂੰਆਂ, CO ਅਤੇ GFCI ਯੰਤਰ ਟੈਸਟ ਕਰਕੇ ਦਰਜ।"
   ]
  }
 },
 "lines": {
  "Dryer cord installation": {
   "pa": [
    "ਡ੍ਰਾਇਰ ਕੋਰਡ ਲਾਉਣਾ",
    "ਗਰਾਊਂਡ ਪੱਟੀ ਹਟਾਈ, ਚਾਰ-ਤਾਰ ਕੋਰਡ ਜੋੜੀ ਅਤੇ ਸਾਕਟ ਜਾਂਚਿਆ।"
   ]
  },
  "4-wire dryer cord — 6 ft": {
   "pa": [
    "4-ਤਾਰ ਡ੍ਰਾਇਰ ਕੋਰਡ — 6 ਫੁੱਟ",
    "ਖਿੱਚ-ਰੋਕੂ ਸਮੇਤ 30 A, 4-ਤਾਰ ਡ੍ਰਾਇਰ ਕੋਰਡ।"
   ]
  },
  "Diagnostic visit": {
   "pa": [
    "ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਟੈਕਨੀਸ਼ੀਅਨ ਘਰ ਆ ਕੇ ਸਮੱਸਿਆ ਦਾ ਕਾਰਨ ਲੱਭਦਾ ਅਤੇ ਮੁਰੰਮਤ ਤੋਂ ਪਹਿਲਾਂ ਹੱਲ ਸਮਝਾਉਂਦਾ ਹੈ।"
   ]
  },
  "Troubleshooting labour": {
   "pa": [
    "ਨੁਕਸ ਲੱਭਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਨੁਕਸ ਲੱਭਣ ਤੱਕ ਸਰਕਟ ਟਰੇਸ ਅਤੇ ਟੈਸਟ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Outlet or switch repair labour": {
   "pa": [
    "ਸਾਕਟ ਜਾਂ ਸਵਿੱਚ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਖ਼ਰਾਬ ਸਾਕਟ ਜਾਂ ਸਵਿੱਚ ਜਾਂਚ ਕੇ ਬਦਲਿਆ।"
   ]
  },
  "Duplex outlet or rocker switch": {
   "pa": [
    "ਡੁਪਲੈਕਸ ਸਾਕਟ ਜਾਂ ਰੌਕਰ ਸਵਿੱਚ",
    "ਆਮ 15 A, 125 V ਡੁਪਲੈਕਸ ਸਾਕਟ ਜਾਂ ਮੇਲ ਖਾਂਦਾ ਰੌਕਰ ਸਵਿੱਚ।"
   ]
  },
  "Circuit breaker replacement labour": {
   "pa": [
    "ਸਰਕਟ ਬ੍ਰੇਕਰ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਡਿੱਗਿਆ ਜਾਂ ਖ਼ਰਾਬ ਬ੍ਰੇਕਰ ਸੁਰੱਖਿਅਤ ਬਦਲਿਆ ਅਤੇ ਸਰਕਟ ਮੁੜ ਜਾਂਚਿਆ।"
   ]
  },
  "Single-pole circuit breaker": {
   "pa": [
    "ਸਿੰਗਲ-ਪੋਲ ਸਰਕਟ ਬ੍ਰੇਕਰ",
    "ਪੈਨਲ ਨਾਲ ਮੇਲ ਖਾਂਦਾ 15 A ਜਾਂ 20 A ਸਿੰਗਲ-ਪੋਲ ਬ੍ਰੇਕਰ।"
   ]
  },
  "Existing panel removal": {
   "pa": [
    "ਮੌਜੂਦਾ ਪੈਨਲ ਹਟਾਉਣਾ",
    "ਪੁਰਾਣਾ ਪੈਨਲ ਕੱਟ ਕੇ ਹਟਾਇਆ ਅਤੇ ਸੁਰੱਖਿਅਤ ਨਿਪਟਾਇਆ।"
   ]
  },
  "200 A panel installation": {
   "pa": [
    "200 A ਪੈਨਲ ਲਾਉਣਾ",
    "ਨਵਾਂ 200 A ਮੇਨ ਪੈਨਲ ਲਾਇਆ, ਹਰ ਸਰਕਟ ਮੁੜ ਜੋੜਿਆ ਅਤੇ ਲੇਬਲ, ਪਰਮਿਟ ਤਾਲਮੇਲ ਸਮੇਤ।"
   ]
  },
  "200 A main breaker panel": {
   "pa": [
    "200 A ਮੇਨ ਬ੍ਰੇਕਰ ਪੈਨਲ",
    "30 ਬ੍ਰੇਕਰ ਥਾਵਾਂ ਵਾਲਾ 200 A ਮੇਨ-ਬ੍ਰੇਕਰ ਲੋਡ ਸੈਂਟਰ।"
   ]
  },
  "Old fixtures removal": {
   "pa": [
    "ਪੁਰਾਣੀਆਂ ਲਾਈਟਾਂ ਹਟਾਉਣਾ",
    "ਮੌਜੂਦਾ ਲਾਈਟਾਂ ਉਤਾਰ ਕੇ ਨਿਪਟਾਈਆਂ।"
   ]
  },
  "Light fixture installation": {
   "pa": [
    "ਲਾਈਟ ਫ਼ਿਕਸਚਰ ਲਾਉਣਾ",
    "ਛੇ ਲਾਈਟਾਂ ਲਾ ਕੇ ਪੱਕੀਆਂ ਅਤੇ ਮੌਜੂਦਾ ਕਨੈਕਸ਼ਨਾਂ ਨਾਲ ਜੋੜੀਆਂ।"
   ]
  },
  "36 W LED flush mount — 12 in": {
   "pa": [
    "36 W LED ਫ਼ਲੱਸ਼ ਮਾਊਂਟ — 12 ਇੰਚ",
    "ਬਿਜਲੀ ਬਚਾਉਣ ਵਾਲੀ 36 W LED ਛੱਤ ਲਾਈਟ, 12 ਇੰਚ, ਸੁਨਹਿਰੀ।"
   ]
  },
  "36 W LED flush mount — 14 in, premium": {
   "pa": [
    "36 W LED ਫ਼ਲੱਸ਼ ਮਾਊਂਟ — 14 ਇੰਚ, ਪ੍ਰੀਮੀਅਮ",
    "ਬਿਜਲੀ ਬਚਾਉਣ ਵਾਲੀ 36 W LED ਛੱਤ ਲਾਈਟ, 14 ਇੰਚ, ਸੁਨਹਿਰੀ।"
   ]
  },
  "GFCI upgrade labour — per receptacle": {
   "pa": [
    "GFCI ਅੱਪਗ੍ਰੇਡ ਮਜ਼ਦੂਰੀ — ਪ੍ਰਤੀ ਸਾਕਟ",
    "ਪੁਰਾਣਾ ਸਾਕਟ ਕੱਢਿਆ, GFCI ਲਾਈਨ ਅਤੇ ਲੋਡ ਜੋੜਿਆ, 'ਅਰਥ ਨਹੀਂ' ਲੇਬਲ ਅਤੇ ਟੈਸਟ।"
   ]
  },
  "Self-test GFCI receptacle — 15 A": {
   "pa": [
    "ਆਪੇ ਟੈਸਟ ਕਰਨ ਵਾਲਾ GFCI ਸਾਕਟ — 15 A",
    "ਪਲੇਟ ਅਤੇ ਲੇਬਲਾਂ ਸਮੇਤ ਛੇੜ-ਛਾੜ ਰੋਧੀ ਆਪੇ-ਟੈਸਟ GFCI।"
   ]
  },
  "Smoke detector replacement labour": {
   "pa": [
    "ਧੂੰਆਂ ਡਿਟੈਕਟਰ ਬਦਲਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਮਿਆਦ ਪੁੱਗਿਆ ਡਿਟੈਕਟਰ ਉਤਾਰਿਆ, ਨਵਾਂ ਮੌਜੂਦਾ ਬੇਸ ਉੱਤੇ ਲਾਇਆ ਅਤੇ ਪੂਰੀ ਲੜੀ ਟੈਸਟ।"
   ]
  },
  "Hard-wired smoke detector with battery backup": {
   "pa": [
    "ਬੈਟਰੀ ਬੈਕਅੱਪ ਵਾਲਾ ਤਾਰ ਵਾਲਾ ਧੂੰਆਂ ਡਿਟੈਕਟਰ",
    "10 ਸਾਲ ਦੀ ਸੀਲ ਬੈਟਰੀ ਵਾਲਾ ਜੁੜਨਯੋਗ 120 V ਡਿਟੈਕਟਰ।"
   ]
  },
  "EV charger installation labour": {
   "pa": [
    "EV ਚਾਰਜਰ ਲਾਉਣ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਆਪਣੇ ਖ਼ਾਸ ਸਰਕਟ ਉੱਤੇ ਲੈਵਲ 2 ਚਾਰਜਿੰਗ ਸਟੇਸ਼ਨ, ਪਰਮਿਟ ਤਾਲਮੇਲ ਸਮੇਤ।"
   ]
  },
  "Level 2 EV charger — 48 A": {
   "pa": [
    "ਲੈਵਲ 2 EV ਚਾਰਜਰ — 48 A",
    "NEMA 14-50 ਕਨੈਕਸ਼ਨ ਵਾਲਾ 240 V, 48 A ਲੈਵਲ 2 ਚਾਰਜਰ, ਹਰ EV ਨਾਲ ਚੱਲਦਾ।"
   ]
  },
  "Damaged GFCI outlet repair": {
   "pa": [
    "ਖ਼ਰਾਬ GFCI ਸਾਕਟ ਦੀ ਮੁਰੰਮਤ",
    "ਸਾਕਟ ਮੁੜ ਚਾਲੂ — ਤਾਰਾਂ ਮੁੜ ਜੋੜੀਆਂ, ਖ਼ਰਾਬ ਪੁਰਜ਼ੇ ਬਦਲੇ ਜਾਂ ਢਿੱਲੇ ਕਨੈਕਸ਼ਨ ਠੀਕ।"
   ]
  },
  "Routine electrical inspection and maintenance visit": {
   "pa": [
    "ਨਿਯਮਤ ਬਿਜਲੀ ਜਾਂਚ ਅਤੇ ਸੰਭਾਲ ਵਿਜ਼ਿਟ",
    "ਤੈਅ ਵਿਜ਼ਿਟ ਉੱਤੇ ਪੈਨਲ ਸਾਫ਼, ਕਨੈਕਸ਼ਨ ਕੱਸੇ ਅਤੇ ਪੂਰਾ ਸਿਸਟਮ ਜਾਂਚਿਆ।"
   ]
  },
  "Electrical safety inspection": {
   "pa": [
    "ਬਿਜਲੀ ਸੁਰੱਖਿਆ ਜਾਂਚ",
    "ਪੈਨਲ, ਵਾਇਰਿੰਗ, ਸਾਕਟ, GFCI ਅਤੇ AFCI ਯੰਤਰ ਅਤੇ ਧੂੰਆਂ ਡਿਟੈਕਟਰਾਂ ਦੀ ਪੂਰੀ ਜਾਂਚ।"
   ]
  },
  "Panel inspection and connection tightening": {
   "pa": [
    "ਪੈਨਲ ਜਾਂਚ ਅਤੇ ਕਨੈਕਸ਼ਨ ਕੱਸਣਾ",
    "ਹਰ ਬ੍ਰੇਕਰ ਕਨੈਕਸ਼ਨ ਜਾਂਚ ਕੇ ਕੱਸਿਆ ਅਤੇ ਪੈਨਲ ਲੇਬਲ ਪੱਕੇ ਕੀਤੇ।"
   ]
  },
  "Smoke detector and GFCI testing": {
   "pa": [
    "ਧੂੰਆਂ ਡਿਟੈਕਟਰ ਅਤੇ GFCI ਟੈਸਟ",
    "ਹਰ ਧੂੰਆਂ ਡਿਟੈਕਟਰ, CO ਡਿਟੈਕਟਰ ਅਤੇ GFCI ਜਾਂ AFCI ਸਾਕਟ ਟੈਸਟ ਕਰਕੇ ਦਰਜ।"
   ]
  }
 }
};
