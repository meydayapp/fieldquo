// app/data/serviceSeeds/i18n/lawn_care.js
//
// The languages lawn_care.js does not write inline — Italian, German,
// Ukrainian, Punjabi (Gurmukhi) and Tagalog for its categories and services,
// and Punjabi for its template lines (keyed by the English line name) — merged
// by withLanguages in ../_templateLines.js. Hand-written trade wording, no
// machine translation; checked by scripts/check-seed-languages.mjs.
export const I18N = {
 "categories": {
  "core": {
   "it": "Servizi principali",
   "de": "Hauptleistungen",
   "uk": "Основні послуги",
   "pa": "ਮੁੱਖ ਸੇਵਾਵਾਂ",
   "tl": "Pangunahing serbisyo"
  },
  "additional": {
   "it": "Servizi aggiuntivi",
   "de": "Zusatzleistungen",
   "uk": "Додаткові послуги",
   "pa": "ਵਾਧੂ ਸੇਵਾਵਾਂ",
   "tl": "Karagdagang serbisyo"
  },
  "maintenance": {
   "it": "Manutenzione e ispezione",
   "de": "Wartung und Inspektion",
   "uk": "Обслуговування та огляд",
   "pa": "ਰੱਖ-ਰਖਾਅ ਅਤੇ ਜਾਂਚ",
   "tl": "Maintenance at inspeksyon"
  }
 },
 "services": {
  "fq.lawn_care.core.lawn_mowing": {
   "pa": [
    "ਘਾਹ ਦੀ ਕਟਾਈ",
    "ਨਿਯਮਤ ਵਿਜ਼ਿਟ 'ਤੇ ਘਾਹ ਸਿਹਤਮੰਦ ਉਚਾਈ ਤੱਕ ਕੱਟਿਆ, ਰਸਤਿਆਂ ਅਤੇ ਕਿਆਰੀਆਂ ਦੇ ਕੰਢੇ ਤਰਾਸ਼ੇ, ਕਤਰਨਾਂ ਮਲਚ ਜਾਂ ਬੈਗ ਵਿੱਚ।"
   ]
  },
  "fq.lawn_care.core.landscape_maintenance": {
   "pa": [
    "ਬਗ਼ੀਚੇ ਦਾ ਰੱਖ-ਰਖਾਅ",
    "ਘਾਹ, ਕਿਆਰੀਆਂ ਅਤੇ ਪੌਦਿਆਂ ਦੀ ਨਿਯਮਤ ਦੇਖਭਾਲ — ਨਦੀਨ, ਕੰਢੇ, ਹਲਕੀ ਛੰਗਾਈ ਅਤੇ ਸਫ਼ਾਈ — ਤਾਂ ਜੋ ਵਿਜ਼ਿਟਾਂ ਵਿਚਕਾਰ ਕੁਝ ਵੀ ਬੇਤਰਤੀਬ ਨਾ ਵਧੇ।"
   ]
  },
  "fq.lawn_care.core.sod_installation": {
   "pa": [
    "ਘਾਹ ਦੀਆਂ ਤਹਿਆਂ (ਸੋਡ) ਲਾਉਣਾ",
    "ਜ਼ਮੀਨ ਪੱਧਰੀ ਅਤੇ ਤਿਆਰ ਕਰਕੇ ਤਾਜ਼ਾ ਸੋਡ ਕੱਸ ਕੇ ਵਿਛਾਇਆ, ਰੋਲ ਕੀਤਾ ਅਤੇ ਪਾਣੀ ਦਿੱਤਾ — ਉਸੇ ਦਿਨ ਤਿਆਰ ਘਾਹ।"
   ]
  },
  "fq.lawn_care.additional.seasonal_yard_cleanup": {
   "pa": [
    "ਮੌਸਮੀ ਵਿਹੜੇ ਦੀ ਸਫ਼ਾਈ",
    "ਪੱਤੇ, ਡਿੱਗੀਆਂ ਟਾਹਣੀਆਂ ਅਤੇ ਮੌਸਮ ਦਾ ਜਮ੍ਹਾਂ ਕੂੜਾ ਇਕੱਠਾ ਕਰਕੇ ਲਿਜਾਇਆ ਜਾਂਦਾ ਹੈ ਤਾਂ ਜੋ ਵਿਹੜਾ ਅਗਲੇ ਮੌਸਮ ਲਈ ਤਿਆਰ ਹੋਵੇ।"
   ]
  },
  "fq.lawn_care.additional.mulch_installation": {
   "pa": [
    "ਮਲਚ ਵਿਛਾਉਣਾ",
    "ਕਿਆਰੀਆਂ ਦੇ ਕੰਢੇ ਬਣਾ ਕੇ ਤਾਜ਼ਾ ਮਲਚ ਦੀ ਤਹਿ, ਨਮੀ ਰੱਖਣ, ਨਦੀਨ ਰੋਕਣ ਅਤੇ ਸਾਫ਼ ਦਿੱਖ ਲਈ।"
   ]
  },
  "fq.lawn_care.additional.landscape_design": {
   "pa": [
    "ਬਗ਼ੀਚੇ ਦਾ ਡਿਜ਼ਾਈਨ",
    "ਬਾਹਰਲੀ ਥਾਂ ਦੀ ਯੋਜਨਾ — ਕਿਆਰੀਆਂ, ਪੌਦੇ, ਰਸਤੇ ਅਤੇ ਘਾਹ — ਜਾਇਦਾਦ ਦੀ ਵਰਤੋਂ ਮੁਤਾਬਕ ਅਤੇ ਦਿੱਖ ਸੁਧਾਰਨ ਲਈ।"
   ]
  },
  "fq.lawn_care.additional.irrigation_install": {
   "pa": [
    "ਸਿੰਚਾਈ ਸਿਸਟਮ ਲਾਉਣਾ",
    "ਜ਼ਮੀਨਦੋਜ਼ ਪਾਈਪਾਂ, ਹੈੱਡ ਅਤੇ ਕੰਟਰੋਲਰ ਜ਼ੋਨਾਂ ਵਿੱਚ ਲਾਏ ਜਾਂਦੇ ਹਨ ਤਾਂ ਜੋ ਘਾਹ ਅਤੇ ਕਿਆਰੀਆਂ ਨੂੰ ਸਮੇਂ ਸਿਰ ਬਰਾਬਰ ਪਾਣੀ ਮਿਲੇ।"
   ]
  },
  "fq.lawn_care.additional.drainage_solutions": {
   "pa": [
    "ਪਾਣੀ ਦੇ ਨਿਕਾਸ ਦੇ ਹੱਲ",
    "ਖੜ੍ਹਾ ਪਾਣੀ ਅਤੇ ਵਹਾਅ ਦੀਆਂ ਸਮੱਸਿਆਵਾਂ ਢਲਾਣ ਬਦਲ ਕੇ, ਫ਼ਰੈਂਚ ਡਰੇਨ ਜਾਂ ਕੈਚ ਬੇਸਿਨ ਨਾਲ ਠੀਕ ਤਾਂ ਜੋ ਨੀਂਹ ਸੁੱਕੀ ਰਹੇ।"
   ]
  },
  "fq.lawn_care.additional.hardscape_install": {
   "pa": [
    "ਹਾਰਡਸਕੇਪ ਲਾਉਣਾ — ਵੇਹੜੇ, ਰਸਤੇ ਅਤੇ ਪੱਥਰ ਦੇ ਕੰਮ",
    "ਪੇਵਰ, ਫ਼ਲੈਗਸਟੋਨ ਜਾਂ ਰਿਟੇਨਿੰਗ ਕੰਧਾਂ ਦੱਬੇ ਹੋਏ ਬੇਸ 'ਤੇ, ਟਿਕਾਊ ਵੇਹੜਾ, ਰਸਤਾ ਜਾਂ ਬਗ਼ੀਚੇ ਦਾ ਹਿੱਸਾ ਬਣਾਉਣ ਲਈ।"
   ]
  },
  "fq.lawn_care.maintenance.irrigation_service": {
   "pa": [
    "ਸਿੰਚਾਈ ਸਿਸਟਮ ਦੀ ਸਰਵਿਸ ਅਤੇ ਮੁਰੰਮਤ",
    "ਜ਼ੋਨ ਚਲਾ ਕੇ ਜਾਂਚੇ, ਟੁੱਟੇ ਹੈੱਡ ਅਤੇ ਲੀਕ ਪਾਈਪਾਂ ਬਦਲੀਆਂ, ਕੰਟਰੋਲਰ ਮੁੜ ਪ੍ਰੋਗਰਾਮ ਤਾਂ ਜੋ ਬਿਨਾਂ ਬਰਬਾਦੀ ਪਾਣੀ ਲੱਗੇ।"
   ]
  },
  "fq.lawn_care.maintenance.lawn_health_inspection": {
   "pa": [
    "ਘਾਹ ਦੀ ਸਿਹਤ ਦੀ ਜਾਂਚ",
    "ਘਾਹ ਦੀ ਘਣਤਾ, ਮਿੱਟੀ ਦੀ ਹਾਲਤ, ਪਤਲੇ ਜਾਂ ਭੂਰੇ ਹਿੱਸੇ ਅਤੇ ਕੀੜਿਆਂ ਦੇ ਨਿਸ਼ਾਨ ਜਾਂਚ ਕੇ ਇਲਾਜ ਦੀ ਲਿਖਤੀ ਯੋਜਨਾ।"
   ]
  },
  "fq.lawn_care.maintenance.inspection_visit": {
   "pa": [
    "ਘਾਹ ਅਤੇ ਬਗ਼ੀਚੇ ਦੀ ਜਾਂਚ ਵਿਜ਼ਿਟ",
    "ਪੂਰੀ ਜਾਇਦਾਦ ਦੇਖਣ ਅਤੇ ਕੰਮ ਦੀ ਸਾਫ਼ ਸਲਾਹ ਦੇਣ ਲਈ ਦੋ ਘੰਟਿਆਂ ਦੀ ਬੁੱਕ ਕੀਤੀ ਵਿਜ਼ਿਟ।"
   ]
  },
  "fq.lawn_care.additional.repair_visit": {
   "pa": [
    "ਘਾਹ ਅਤੇ ਬਗ਼ੀਚੇ ਦੀ ਮੁਰੰਮਤ ਵਿਜ਼ਿਟ",
    "ਜੋ ਠੀਕ ਨਹੀਂ ਉਹ ਠੀਕ ਕਰਨ ਲਈ ਦੋ ਘੰਟਿਆਂ ਦੀ ਬੁੱਕ ਕੀਤੀ ਵਿਜ਼ਿਟ — ਖ਼ਾਲੀ ਥਾਂ, ਰੁੜ੍ਹੀ ਕਿਆਰੀ, ਧੱਸਿਆ ਰਸਤਾ।"
   ]
  },
  "fq.lawn_care.core.fertilization": {
   "it": [
    "Concimazione del prato",
    "Concime granulare o liquido distribuito su tutto il prato per infittire il manto, scurirne il colore e mantenere la crescita uniforme."
   ],
   "de": [
    "Rasendüngung",
    "Granulat- oder Flüssigdünger auf dem ganzen Rasen ausgebracht, damit er dichter, satter grün und gleichmäßig wächst."
   ],
   "uk": [
    "Підживлення газону",
    "Гранульоване або рідке добриво по всьому газону, щоб він густішав, мав насичений колір і рівно ріс."
   ],
   "pa": [
    "ਘਾਹ ਨੂੰ ਖਾਦ",
    "ਪੂਰੇ ਘਾਹ 'ਤੇ ਦਾਣੇਦਾਰ ਜਾਂ ਤਰਲ ਖਾਦ ਤਾਂ ਜੋ ਘਾਹ ਸੰਘਣਾ, ਗੂੜ੍ਹਾ ਹਰਾ ਅਤੇ ਬਰਾਬਰ ਵਧੇ।"
   ],
   "tl": [
    "Pag-aabono ng damuhan",
    "Granular o likidong pataba sa buong damuhan para kumapal, lumalim ang kulay at pantay ang tubo."
   ]
  },
  "fq.lawn_care.core.weed_control": {
   "it": [
    "Trattamento contro le erbacce",
    "Erbacce a foglia larga e graminacee trattate dove crescono, così il prato tiene acqua e nutrienti per sé."
   ],
   "de": [
    "Unkrautbekämpfung",
    "Breitblättrige und grasartige Unkräuter gezielt behandelt, damit Wasser und Nährstoffe dem Rasen bleiben."
   ],
   "uk": [
    "Боротьба з бур'янами",
    "Широколисті та злакові бур'яни оброблено там, де ростуть, щоб вода й поживні речовини лишались газону."
   ],
   "pa": [
    "ਨਦੀਨ ਰੋਕੂ ਇਲਾਜ",
    "ਚੌੜੇ ਪੱਤੇ ਅਤੇ ਘਾਹ ਵਰਗੇ ਨਦੀਨ ਜਿੱਥੇ ਉੱਗਦੇ ਹਨ ਉੱਥੇ ਇਲਾਜ ਤਾਂ ਜੋ ਪਾਣੀ ਅਤੇ ਖ਼ੁਰਾਕ ਘਾਹ ਨੂੰ ਮਿਲੇ।"
   ],
   "tl": [
    "Paggamot laban sa damo",
    "Ginagamot ang malapad na dahon at mala-damong damo kung saan tumutubo para sa damuhan ang tubig at sustansya."
   ]
  },
  "fq.lawn_care.core.tree_shrub_trimming": {
   "it": [
    "Potatura di alberi e arbusti",
    "Alberi e arbusti accorciati e sagomati, legno secco rimosso, perché restino sani e in proporzione al giardino."
   ],
   "de": [
    "Baum- und Strauchschnitt",
    "Bäume und Sträucher zurückgeschnitten und geformt, Totholz entfernt, damit sie gesund und im Maß bleiben."
   ],
   "uk": [
    "Обрізка дерев і кущів",
    "Дерева й кущі вкорочено та сформовано, сухі гілки прибрано, щоб вони були здорові й пропорційні подвір'ю."
   ],
   "pa": [
    "ਰੁੱਖਾਂ ਅਤੇ ਝਾੜੀਆਂ ਦੀ ਛੰਗਾਈ",
    "ਰੁੱਖ ਅਤੇ ਝਾੜੀਆਂ ਛਾਂਟ ਕੇ ਆਕਾਰ ਦਿੱਤਾ, ਸੁੱਕੀ ਲੱਕੜ ਕੱਢੀ, ਤਾਂ ਜੋ ਸਿਹਤਮੰਦ ਅਤੇ ਵਿਹੜੇ ਦੇ ਅਨੁਪਾਤ ਵਿੱਚ ਰਹਿਣ।"
   ],
   "tl": [
    "Pagputol ng puno at palumpong",
    "Pinuputol at hinuhubog ang puno at palumpong, inaalis ang patay na sanga, para manatiling malusog at bagay sa bakuran."
   ]
  },
  "fq.lawn_care.maintenance.seasonal_lawn_treatment": {
   "it": [
    "Trattamento stagionale del prato",
    "Un'applicazione di primavera, estate o autunno — concime, diserbo o prodotto invernale — per preparare il prato alla stagione."
   ],
   "de": [
    "Saisonale Rasenbehandlung",
    "Eine Frühjahrs-, Sommer- oder Herbstanwendung — Dünger, Unkrautmittel oder Winterdünger — passend zur kommenden Witterung."
   ],
   "uk": [
    "Сезонна обробка газону",
    "Весняне, літнє чи осіннє внесення — добриво, гербіцид або зимове підживлення — щоб газон пережив наступну погоду."
   ],
   "pa": [
    "ਮੌਸਮੀ ਘਾਹ ਦਾ ਇਲਾਜ",
    "ਬਸੰਤ, ਗਰਮੀ ਜਾਂ ਪਤਝੜ ਦੀ ਖੁਰਾਕ — ਖਾਦ, ਨਦੀਨ ਰੋਕੂ ਜਾਂ ਸਰਦੀ ਦੀ ਤਿਆਰੀ — ਆਉਣ ਵਾਲੇ ਮੌਸਮ ਲਈ।"
   ],
   "tl": [
    "Pana-panahong gamot sa damuhan",
    "Aplikasyon sa tagsibol, tag-init o taglagas — pataba, pamatay-damo o winterizer — para sa darating na panahon."
   ]
  },
  "fq.lawn_care.maintenance.lawn_pest_control": {
   "it": [
    "Controllo parassiti del prato",
    "Larve, cimici e altri insetti del prato trattati prima che rodano le radici e lascino chiazze morte."
   ],
   "de": [
    "Rasenschädlingsbekämpfung",
    "Engerlinge, Wanzen und andere Rasenschädlinge behandelt, bevor sie Wurzeln fressen und kahle Stellen hinterlassen."
   ],
   "uk": [
    "Боротьба зі шкідниками газону",
    "Личинки, клопи та інші шкідники газону оброблено, поки вони не з'їли коріння й не лишили мертвих плям."
   ],
   "pa": [
    "ਘਾਹ ਦੇ ਕੀੜਿਆਂ ਦਾ ਇਲਾਜ",
    "ਗਰੱਬ, ਚਿੰਚ ਬੱਗ ਅਤੇ ਹੋਰ ਕੀੜੇ ਜੜ੍ਹਾਂ ਖਾ ਕੇ ਮਰੇ ਹਿੱਸੇ ਛੱਡਣ ਤੋਂ ਪਹਿਲਾਂ ਖ਼ਤਮ।"
   ],
   "tl": [
    "Pagkontrol ng peste sa damuhan",
    "Ginagamot ang grub, chinch bug at iba pang insekto bago nila kainin ang ugat at mag-iwan ng patay na bahagi."
   ]
  },
  "fq.lawn_care.maintenance.landscape_maintenance_plan": {
   "it": [
    "Piano di manutenzione del giardino",
    "Un calendario di visite per tutta la stagione che nutre il prato, ordina le aiuole e pota le piante, con un prezzo unico."
   ],
   "de": [
    "Gartenpflegeplan",
    "Ein Besuchsplan für die ganze Saison — Rasen gedüngt, Beete gepflegt, Pflanzen geschnitten — zu einem Gesamtpreis."
   ],
   "uk": [
    "План догляду за ділянкою",
    "Графік візитів на весь сезон — газон підживлено, клумби доглянуто, рослини обрізано — однією ціною."
   ],
   "pa": [
    "ਬਗ਼ੀਚੇ ਦੇ ਰੱਖ-ਰਖਾਅ ਦੀ ਯੋਜਨਾ",
    "ਪੂਰੇ ਮੌਸਮ ਦੀਆਂ ਵਿਜ਼ਿਟਾਂ — ਘਾਹ ਨੂੰ ਖਾਦ, ਕਿਆਰੀਆਂ ਸਾਫ਼, ਪੌਦੇ ਛਾਂਟੇ — ਇੱਕ ਯੋਜਨਾ ਵਜੋਂ ਇੱਕ ਰੇਟ।"
   ],
   "tl": [
    "Plano sa pag-aalaga ng landscape",
    "Iskedyul ng visit sa buong season — may pataba ang damuhan, malinis ang taniman, pinutulan ang halaman — iisang presyo."
   ]
  },
  "fq.lawn_care.additional.install_upgrade_visit": {
   "it": [
    "Installazione o miglioria del giardino — visita",
    "Visita prenotata di due ore per installare qualcosa di nuovo o migliorare l'esistente — piante, bordure, un'aiuola, un piccolo elemento."
   ],
   "de": [
    "Gartenanlage oder -aufwertung — Termin",
    "Gebuchter Zwei-Stunden-Termin, um Neues anzulegen oder Bestehendes zu verbessern — Pflanzen, Kanten, ein Beet, ein kleines Element."
   ],
   "uk": [
    "Облаштування або оновлення ділянки — візит",
    "Запланований двогодинний візит, щоб додати нове чи покращити наявне — рослини, бордюри, клумбу, невеликий елемент."
   ],
   "pa": [
    "ਬਗ਼ੀਚਾ ਲਾਉਣਾ ਜਾਂ ਸੁਧਾਰ — ਵਿਜ਼ਿਟ",
    "ਕੁਝ ਨਵਾਂ ਲਾਉਣ ਜਾਂ ਮੌਜੂਦਾ ਸੁਧਾਰਨ ਲਈ ਦੋ ਘੰਟਿਆਂ ਦੀ ਬੁੱਕ ਕੀਤੀ ਵਿਜ਼ਿਟ — ਪੌਦੇ, ਕੰਢੇ, ਕਿਆਰੀ, ਛੋਟਾ ਹਿੱਸਾ।"
   ],
   "tl": [
    "Pagkakabit o upgrade ng landscape — visit",
    "Naka-book na dalawang oras na visit para maglagay ng bago o pagandahin ang dati — halaman, edging, taniman, maliit na feature."
   ]
  }
 },
 "lines": {
  "Mowing and trimming": {
   "pa": [
    "ਕਟਾਈ ਅਤੇ ਤਰਾਸ਼",
    "ਘਾਹ ਕੱਟਿਆ, ਰੁਕਾਵਟਾਂ ਦੁਆਲੇ ਟ੍ਰਿਮਰ ਅਤੇ ਪੱਕੀਆਂ ਸਤਹਾਂ ਉਡਾ ਕੇ ਸਾਫ਼।"
   ]
  },
  "Edging — per linear ft": {
   "pa": [
    "ਕੰਢੇ ਬਣਾਉਣਾ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਰਸਤੇ, ਡਰਾਈਵਵੇ ਅਤੇ ਕਿਆਰੀਆਂ ਦੇ ਕੰਢੇ ਬਲੇਡ ਐਜਰ ਨਾਲ।"
   ]
  },
  "Bed maintenance — per sq ft of bed": {
   "pa": [
    "ਕਿਆਰੀ ਦੀ ਸੰਭਾਲ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ ਕਿਆਰੀ",
    "ਨਦੀਨ ਪੁੱਟੇ, ਸੁੱਕਾ ਵਾਧਾ ਕੱਟਿਆ ਅਤੇ ਕਿਆਰੀਆਂ ਸਾਫ਼।"
   ]
  },
  "Soil prep and grading — per sq ft": {
   "pa": [
    "ਮਿੱਟੀ ਦੀ ਤਿਆਰੀ ਅਤੇ ਪੱਧਰ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਪੁਰਾਣਾ ਘਾਹ ਉਖਾੜਿਆ, ਮਿੱਟੀ ਪੋਲੀ, ਪੱਧਰੀ ਅਤੇ ਰੋਲ ਕੀਤੀ।"
   ]
  },
  "Sod laying — per sq ft": {
   "pa": [
    "ਸੋਡ ਵਿਛਾਉਣਾ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਰੋਲ ਜੋੜ ਬਦਲ-ਬਦਲ ਕੇ ਵਿਛਾਏ, ਕੰਢਿਆਂ 'ਤੇ ਕੱਟੇ, ਰੋਲ ਕਰਕੇ ਪਾਣੀ ਦਿੱਤਾ।"
   ]
  },
  "Sod — per pallet": {
   "pa": [
    "ਸੋਡ — ਪ੍ਰਤੀ ਪੈਲੇਟ",
    "ਬਲੂਗ੍ਰਾਸ ਸੋਡ; ਇੱਕ ਪੈਲੇਟ 500 ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Leaf and debris cleanup — per crew hour": {
   "pa": [
    "ਪੱਤਿਆਂ ਅਤੇ ਕੂੜੇ ਦੀ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਟੀਮ ਘੰਟਾ",
    "ਘਾਹ ਅਤੇ ਕਿਆਰੀਆਂ ਰੇਕ ਜਾਂ ਬਲੋਅਰ ਨਾਲ, ਕੂੜਾ ਬੈਗਾਂ ਜਾਂ ਤਰਪਾਲ ਵਿੱਚ।"
   ]
  },
  "Mulch spreading — per sq ft of bed": {
   "pa": [
    "ਮਲਚ ਖਿਲਾਰਨਾ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ ਕਿਆਰੀ",
    "ਕਿਆਰੀਆਂ ਦੇ ਨਦੀਨ ਕੱਢੇ, ਕੰਢੇ ਬਣਾਏ ਅਤੇ ਤਿੰਨ ਇੰਚ ਮਲਚ ਵਿਛਾਇਆ।"
   ]
  },
  "Mulch — per bag": {
   "pa": [
    "ਮਲਚ — ਪ੍ਰਤੀ ਬੈਗ",
    "2 ਘਣ ਫੁੱਟ ਕੱਟੇ ਮਲਚ ਦਾ ਬੈਗ; ਤਿੰਨ ਇੰਚ 'ਤੇ ਲਗਭਗ 8 ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Bed edging — per kit": {
   "pa": [
    "ਕਿਆਰੀ ਦੀ ਕਿਨਾਰੀ — ਪ੍ਰਤੀ ਕਿੱਟ",
    "ਬਿਨਾਂ ਖੁਦਾਈ ਵਾਲੀ ਕਿਨਾਰੀ; ਇੱਕ ਕਿੱਟ 20 ਲੀਨੀਅਰ ਫੁੱਟ।"
   ]
  },
  "Design consultation and plan": {
   "pa": [
    "ਡਿਜ਼ਾਈਨ ਸਲਾਹ ਅਤੇ ਯੋਜਨਾ",
    "ਥਾਂ ਮਾਪੀ, ਲੋੜਾਂ ਬਾਰੇ ਗੱਲ ਕੀਤੀ ਅਤੇ ਪੌਦਿਆਂ ਅਤੇ ਹਾਰਡਸਕੇਪ ਦਾ ਪੈਮਾਨੇ ਵਾਲਾ ਨਕਸ਼ਾ ਬਣਾਇਆ।"
   ]
  },
  "Irrigation zone installation — per zone": {
   "pa": [
    "ਸਿੰਚਾਈ ਜ਼ੋਨ ਲਾਉਣਾ — ਪ੍ਰਤੀ ਜ਼ੋਨ",
    "ਇੱਕ ਜ਼ੋਨ ਲਈ ਖਾਈ, ਪਾਈਪ, ਹੈੱਡ ਅਤੇ ਵਾਲਵ, ਢਕਾਈ ਲਈ ਜਾਂਚਿਆ।"
   ]
  },
  "Controller and backflow parts": {
   "pa": [
    "ਕੰਟਰੋਲਰ ਅਤੇ ਬੈਕਫ਼ਲੋ ਪੁਰਜ਼ੇ",
    "ਸਮਾਰਟ ਕੰਟਰੋਲਰ, ਤਾਰ ਅਤੇ ਬੈਕਫ਼ਲੋ ਕਨੈਕਸ਼ਨ ਫ਼ਿਟਿੰਗਾਂ।"
   ]
  },
  "French drain — per linear ft": {
   "pa": [
    "ਫ਼ਰੈਂਚ ਡਰੇਨ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ",
    "ਢਲਾਣ ਨਾਲ ਖਾਈ ਪੁੱਟੀ, ਕੱਪੜਾ ਵਿਛਾਇਆ, ਛੇਕਾਂ ਵਾਲੀ ਪਾਈਪ ਬਜਰੀ ਵਿੱਚ ਰੱਖ ਕੇ ਭਰਿਆ।"
   ]
  },
  "Drainage gravel — per bag": {
   "pa": [
    "ਨਿਕਾਸੀ ਬਜਰੀ — ਪ੍ਰਤੀ ਬੈਗ",
    "0.5 ਘਣ ਫੁੱਟ ਪੱਥਰ ਦਾ ਬੈਗ; 12 × 12 ਇੰਚ ਖਾਈ ਦਾ ਅੱਧਾ ਫੁੱਟ।"
   ]
  },
  "Paver installation — per sq ft": {
   "pa": [
    "ਪੇਵਰ ਲਾਉਣਾ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਖੁਦਾਈ, ਬੇਸ ਤਹਿ-ਦਰ-ਤਹਿ ਦੱਬਿਆ, ਪੇਵਰ ਵਿਛਾਏ, ਕਿਨਾਰੀ ਅਤੇ ਜੋੜਾਂ ਵਿੱਚ ਰੇਤ।"
   ]
  },
  "Paver base — per bag": {
   "pa": [
    "ਪੇਵਰ ਬੇਸ — ਪ੍ਰਤੀ ਬੈਗ",
    "0.5 ਘਣ ਫੁੱਟ ਪੇਵਰ ਬੇਸ ਦਾ ਬੈਗ; ਚਾਰ ਇੰਚ 'ਤੇ ਲਗਭਗ 1.5 ਵਰਗ ਫੁੱਟ।"
   ]
  },
  "Concrete pavers — per sq ft": {
   "pa": [
    "ਕੰਕਰੀਟ ਪੇਵਰ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਆਮ ਕੰਕਰੀਟ ਪੇਵਰ, ਕਿਨਾਰੀ ਰੋਕ ਅਤੇ ਪੌਲੀਮਰਿਕ ਜੋੜ ਰੇਤ।"
   ]
  },
  "Replacement spray head — per head": {
   "pa": [
    "ਬਦਲਵਾਂ ਸਪਰੇਅ ਹੈੱਡ — ਪ੍ਰਤੀ ਹੈੱਡ",
    "ਨੋਜ਼ਲ ਸਮੇਤ ਪੌਪ-ਅੱਪ ਸਪਰੇਅ ਜਾਂ ਰੋਟਰ ਹੈੱਡ।"
   ]
  },
  "Lawn assessment and soil test": {
   "pa": [
    "ਘਾਹ ਦੀ ਜਾਂਚ ਅਤੇ ਮਿੱਟੀ ਟੈਸਟ",
    "ਘਾਹ ਅਤੇ ਮਿੱਟੀ ਜਾਂਚੀ, ਮਿੱਟੀ ਦਾ ਨਮੂਨਾ ਲਿਆ ਅਤੇ ਇਲਾਜ ਦੀ ਯੋਜਨਾ ਲਿਖੀ।"
   ]
  },
  "Soil test kit": {
   "pa": [
    "ਮਿੱਟੀ ਟੈਸਟ ਕਿੱਟ",
    "pH ਅਤੇ ਖ਼ੁਰਾਕੀ ਤੱਤਾਂ ਲਈ ਲੈਬ ਮਿੱਟੀ ਟੈਸਟ।"
   ]
  },
  "Property walkthrough": {
   "pa": [
    "ਜਾਇਦਾਦ ਦਾ ਚੱਕਰ",
    "ਘਾਹ, ਕਿਆਰੀਆਂ, ਰੁੱਖ ਅਤੇ ਨਿਕਾਸ ਦੇਖੇ ਅਤੇ ਸਲਾਹਾਂ ਦੀ ਲਿਖਤੀ ਸੂਚੀ ਦਿੱਤੀ।"
   ]
  },
  "Landscape repair labour": {
   "pa": [
    "ਬਗ਼ੀਚੇ ਦੀ ਮੁਰੰਮਤ ਦੀ ਮਜ਼ਦੂਰੀ",
    "ਥਾਂ-ਥਾਂ ਬੀਜ, ਕਿਆਰੀ ਮੁੜ ਬਣਾਉਣਾ ਜਾਂ ਰਸਤਾ ਪੱਧਰਾ, ਘੰਟੇ ਦੇ ਹਿਸਾਬ ਨਾਲ।"
   ]
  },
  "Grass seed": {
   "pa": [
    "ਘਾਹ ਦਾ ਬੀਜ",
    "ਘਾਹ ਦੇ ਬੀਜਾਂ ਦਾ ਮਿਸ਼ਰਣ; ਮਾਤਰਾ ਸਟੋਰ ਵਾਲੇ ਬੈਗ ਦੀ ਲਿਖੀ ਢਕਾਈ ਮੁਤਾਬਕ।"
   ]
  }
 }
};
