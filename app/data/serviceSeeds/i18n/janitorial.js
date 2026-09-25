// app/data/serviceSeeds/i18n/janitorial.js
//
// The languages janitorial.js does not write inline — Italian, German,
// Ukrainian, Punjabi (Gurmukhi) and Tagalog for its categories and services,
// and Punjabi for its template lines (keyed by the English line name) — merged
// by withLanguages in ../_templateLines.js. Hand-written trade wording, no
// machine translation; checked by scripts/check-seed-languages.mjs.
export const I18N = {
 "categories": {
  "recurring": {
   "it": "Pulizie commerciali ricorrenti",
   "de": "Regelmäßige Unterhaltsreinigung",
   "uk": "Регулярне комерційне прибирання",
   "pa": "ਨਿਯਮਤ ਵਪਾਰਕ ਸਫ਼ਾਈ",
   "tl": "Regular na komersyal na paglilinis"
  },
  "one_time": {
   "it": "Pulizie commerciali una tantum",
   "de": "Einmalige gewerbliche Reinigung",
   "uk": "Разове комерційне прибирання",
   "pa": "ਇੱਕ ਵਾਰ ਦੀ ਵਪਾਰਕ ਸਫ਼ਾਈ",
   "tl": "Isang beses na komersyal na paglilinis"
  },
  "visits": {
   "it": "Sopralluoghi",
   "de": "Begehungen",
   "uk": "Огляди приміщень",
   "pa": "ਥਾਂ ਦੇ ਚੱਕਰ",
   "tl": "Paglibot sa lugar"
  }
 },
 "services": {
  "fq.janitorial.recurring.office": {
   "pa": [
    "ਦਫ਼ਤਰ ਅਤੇ ਵਪਾਰਕ ਸਫ਼ਾਈ — ਨਿਯਮਤ",
    "ਡੈਸਕ, ਸਤਹਾਂ, ਛੋਟੀ ਰਸੋਈ, ਬਾਥਰੂਮ ਅਤੇ ਫ਼ਰਸ਼ ਸਾਫ਼ ਅਤੇ ਡੱਬੇ ਖ਼ਾਲੀ ਕੀਤੇ ਜਾਂਦੇ ਹਨ ਤੈਅ ਸਮਾਂ-ਸਾਰਣੀ 'ਤੇ।"
   ]
  },
  "fq.janitorial.recurring.lobby": {
   "it": [
    "Pulizia reception e ingresso — ricorrente",
    "Ingresso, bancone reception, porte a vetri e area d'attesa mantenuti presentabili per i visitatori."
   ],
   "de": [
    "Empfangs- und Foyerreinigung — regelmäßig",
    "Eingang, Empfangstresen, Glastüren und Wartebereich für Besucher vorzeigbar gehalten."
   ],
   "uk": [
    "Прибирання рецепції та холу — регулярно",
    "Вхід, стійка рецепції, скляні двері й зона очікування доглянуті для відвідувачів."
   ],
   "pa": [
    "ਰਿਸੈਪਸ਼ਨ ਅਤੇ ਲਾਬੀ ਦੀ ਸਫ਼ਾਈ — ਨਿਯਮਤ",
    "ਦਾਖ਼ਲਾ, ਰਿਸੈਪਸ਼ਨ ਡੈਸਕ, ਸ਼ੀਸ਼ੇ ਦੇ ਦਰਵਾਜ਼ੇ ਅਤੇ ਬੈਠਣ ਦੀ ਥਾਂ ਆਉਣ ਵਾਲਿਆਂ ਲਈ ਸਾਫ਼-ਸੁਥਰੀ ਰੱਖੀ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Paglilinis ng reception at lobby — regular",
    "Pinananatiling maayos para sa bisita ang pasukan, reception desk, salaming pinto at upuan."
   ]
  },
  "fq.janitorial.recurring.kitchen_restroom": {
   "pa": [
    "ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਦੀ ਸਫ਼ਾਈ — ਨਿਯਮਤ",
    "ਬ੍ਰੇਕ-ਰੂਮ ਦੀ ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਰਗੜ ਕੇ ਕੀਟਾਣੂ-ਰਹਿਤ, ਫ਼ਿਕਸਚਰ ਚਮਕਾਏ ਅਤੇ ਸਮਾਨ ਮੁੜ ਭਰਿਆ ਜਾਂਦਾ ਹੈ।"
   ]
  },
  "fq.janitorial.recurring.daytime": {
   "it": [
    "Pulizia diurna con addetto — ricorrente",
    "Un addetto presente in orario d'ufficio per versamenti, bagni, punti di contatto e area d'ingresso."
   ],
   "de": [
    "Tagesreinigung vor Ort — regelmäßig",
    "Eine Reinigungskraft während der Geschäftszeiten vor Ort für Verschüttetes, Sanitärräume, Kontaktflächen und den Eingangsbereich."
   ],
   "uk": [
    "Денне прибирання з черговим — регулярно",
    "Прибиральник на місці в робочі години — розлиття, вбиральні, поверхні дотику та вхідна зона."
   ],
   "pa": [
    "ਦਿਨ ਵੇਲੇ ਸਫ਼ਾਈ ਕਰਮਚਾਰੀ — ਨਿਯਮਤ",
    "ਕੰਮ ਦੇ ਸਮੇਂ ਦੌਰਾਨ ਮੌਕੇ 'ਤੇ ਸਫ਼ਾਈ ਕਰਮਚਾਰੀ — ਡੁੱਲ੍ਹੀਆਂ ਚੀਜ਼ਾਂ, ਬਾਥਰੂਮ, ਛੂਹਣ ਵਾਲੀਆਂ ਥਾਵਾਂ ਅਤੇ ਮੂਹਰਲਾ ਹਿੱਸਾ।"
   ],
   "tl": [
    "Daytime na tagalinis — regular",
    "May tagalinis sa lugar sa oras ng negosyo para sa natapon, banyo, madalas hawakan at harapan."
   ]
  },
  "fq.janitorial.recurring.dusting": {
   "it": [
    "Spolveratura in alto e di dettaglio — ricorrente",
    "Bocchette, mensole, tende, lampade e sommità degli armadi spolverati, i punti che la pulizia serale salta."
   ],
   "de": [
    "Hoch- und Detailstaubwischen — regelmäßig",
    "Lüftungsgitter, Simse, Jalousien, Leuchten und Schrankoberseiten abgestaubt — die Stellen, die die Abendreinigung auslässt."
   ],
   "uk": [
    "Витирання пилу на висоті та в деталях — регулярно",
    "Решітки, виступи, жалюзі, світильники й верх шаф протерто від пилу — місця, які вечірнє прибирання пропускає."
   ],
   "pa": [
    "ਉੱਚੀਆਂ ਅਤੇ ਬਾਰੀਕ ਥਾਵਾਂ ਦੀ ਧੂੜ — ਨਿਯਮਤ",
    "ਵੈਂਟ, ਕਿਨਾਰੇ, ਬਲਾਇੰਡ, ਲਾਈਟਾਂ ਅਤੇ ਅਲਮਾਰੀਆਂ ਦੇ ਉੱਪਰੋਂ ਧੂੜ ਸਾਫ਼ — ਉਹ ਥਾਵਾਂ ਜੋ ਰਾਤ ਦੀ ਸਫ਼ਾਈ ਛੱਡ ਦਿੰਦੀ ਹੈ।"
   ],
   "tl": [
    "Pagpupunas ng alikabok sa matataas at detalye — regular",
    "Pinunasan ang vent, gilid, blinds, ilaw at ibabaw ng kabinet — mga lugar na nalalampasan sa gabi-gabing linis."
   ]
  },
  "fq.janitorial.recurring.windows": {
   "it": [
    "Pulizia vetri interni — ricorrente",
    "Vetri interni, divisori e vetri delle porte puliti senza aloni."
   ],
   "de": [
    "Innenreinigung von Fenstern und Glas — regelmäßig",
    "Innenglas, Trennwände und Türglas streifenfrei gereinigt."
   ],
   "uk": [
    "Миття вікон і скла всередині — регулярно",
    "Внутрішнє скло, перегородки й скло дверей вимито без розводів."
   ],
   "pa": [
    "ਅੰਦਰਲੀਆਂ ਖਿੜਕੀਆਂ ਅਤੇ ਸ਼ੀਸ਼ੇ ਦੀ ਸਫ਼ਾਈ — ਨਿਯਮਤ",
    "ਅੰਦਰਲਾ ਸ਼ੀਸ਼ਾ, ਪਾਰਟੀਸ਼ਨ ਅਤੇ ਦਰਵਾਜ਼ਿਆਂ ਦਾ ਸ਼ੀਸ਼ਾ ਬਿਨਾਂ ਧਾਰੀਆਂ ਸਾਫ਼ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Paglilinis ng bintana at salamin sa loob — regular",
    "Nilinis nang walang guhit ang salamin sa loob, partisyon at salamin ng pinto."
   ]
  },
  "fq.janitorial.recurring.carpet": {
   "it": [
    "Pulizia moquette commerciale — ricorrente",
    "Moquette dell'ufficio lavata a estrazione o incapsulata, corsie di passaggio pretrattate e macchie rimosse."
   ],
   "de": [
    "Gewerbliche Teppichreinigung — regelmäßig",
    "Büroteppich sprühextrahiert oder verkapselt, Laufwege vorbehandelt und Flecken entfernt."
   ],
   "uk": [
    "Чищення комерційного ковроліну — регулярно",
    "Офісний ковролін почищено екстракцією чи капсулюванням, доріжки попередньо оброблено, плями виведено."
   ],
   "pa": [
    "ਵਪਾਰਕ ਕਾਰਪੈੱਟ ਦੀ ਸਫ਼ਾਈ — ਨਿਯਮਤ",
    "ਦਫ਼ਤਰ ਦਾ ਕਾਰਪੈੱਟ ਐਕਸਟ੍ਰੈਕਸ਼ਨ ਜਾਂ ਇਨਕੈਪਸੂਲੇਸ਼ਨ ਨਾਲ ਸਾਫ਼, ਆਵਾਜਾਈ ਵਾਲੇ ਰਸਤੇ ਪਹਿਲਾਂ ਟ੍ਰੀਟ ਅਤੇ ਦਾਗ਼ ਹਟਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Paglilinis ng komersyal na karpet — regular",
    "Na-extract o na-encapsulate ang karpet ng opisina, pre-treated ang daanan at inalis ang mantsa."
   ]
  },
  "fq.janitorial.recurring.hard_floor": {
   "it": [
    "Cura dei pavimenti duri — ricorrente",
    "Ceramica, vinile e calcestruzzo sigillato lavati a macchina e, se trattati, lucidati."
   ],
   "de": [
    "Hartbodenpflege — regelmäßig",
    "Fliesen, Vinyl und versiegelter Beton maschinell geschrubbt und, wo beschichtet, poliert."
   ],
   "uk": [
    "Догляд за твердою підлогою — регулярно",
    "Плитку, вініл і запечатаний бетон вимито машиною, а з покриттям — відполіровано."
   ],
   "pa": [
    "ਸਖ਼ਤ ਫ਼ਰਸ਼ ਦੀ ਸੰਭਾਲ — ਨਿਯਮਤ",
    "ਟਾਈਲ, ਵਿਨਾਇਲ ਅਤੇ ਸੀਲ ਕੀਤੀ ਕੰਕਰੀਟ ਮਸ਼ੀਨ ਨਾਲ ਰਗੜੀ ਅਤੇ ਜਿੱਥੇ ਫ਼ਿਨਿਸ਼ ਹੈ ਉੱਥੇ ਚਮਕਾਈ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Pag-aalaga ng matigas na sahig — regular",
    "Makinang kinuskos ang tile, vinyl at selyadong kongkreto at, kung may finish, pinakintab."
   ]
  },
  "fq.janitorial.recurring.restocking": {
   "it": [
    "Rifornimento materiali di consumo — ricorrente",
    "Carta, sapone, sacchi e igienizzante riforniti in ogni bagno e cucina."
   ],
   "de": [
    "Nachfüllen von Verbrauchsmaterial — regelmäßig",
    "Papier, Seife, Müllbeutel und Desinfektionsmittel in jedem Sanitärraum und jeder Küche aufgefüllt."
   ],
   "uk": [
    "Поповнення витратних матеріалів — регулярно",
    "Папір, мило, пакети й антисептик поповнено в кожній вбиральні та кухні."
   ],
   "pa": [
    "ਸਮਾਨ ਮੁੜ ਭਰਨਾ — ਨਿਯਮਤ",
    "ਹਰ ਬਾਥਰੂਮ ਅਤੇ ਰਸੋਈ ਵਿੱਚ ਕਾਗ਼ਜ਼, ਸਾਬਣ, ਲਾਈਨਰ ਅਤੇ ਸੈਨੀਟਾਈਜ਼ਰ ਮੁੜ ਭਰੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagpupuno ng supply — regular",
    "Pinunan ang papel, sabon, liner at sanitizer sa bawat banyo at kusina."
   ]
  },
  "fq.janitorial.recurring.waste": {
   "it": [
    "Raccolta rifiuti e riciclo — ricorrente",
    "Cestini svuotati, sacchi sostituiti e rifiuti e riciclo portati al punto di raccolta dell'edificio."
   ],
   "de": [
    "Abfall- und Wertstoffentsorgung — regelmäßig",
    "Behälter geleert, Beutel ersetzt und Abfall sowie Wertstoffe zur Sammelstelle des Gebäudes gebracht."
   ],
   "uk": [
    "Винесення сміття та вторсировини — регулярно",
    "Кошики спорожнено, пакети замінено, сміття й вторсировину винесено до пункту збору будівлі."
   ],
   "pa": [
    "ਕੂੜਾ ਅਤੇ ਰੀਸਾਈਕਲਿੰਗ ਹਟਾਉਣਾ — ਨਿਯਮਤ",
    "ਡੱਬੇ ਖ਼ਾਲੀ, ਲਾਈਨਰ ਬਦਲੇ ਅਤੇ ਕੂੜਾ ਅਤੇ ਰੀਸਾਈਕਲਿੰਗ ਇਮਾਰਤ ਦੀ ਇਕੱਠ ਵਾਲੀ ਥਾਂ ਲਿਜਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagtatapon ng basura at recycling — regular",
    "Inalisan ng laman ang basurahan, pinalitan ang liner at dinala ang basura at recycling sa tapunan ng gusali."
   ]
  },
  "fq.janitorial.recurring.sanitation": {
   "it": [
    "Disinfezione dei punti di contatto — ricorrente",
    "Maniglie, interruttori, corrimano, telefoni e attrezzature comuni disinfettati con un prodotto registrato."
   ],
   "de": [
    "Desinfektion von Kontaktflächen — regelmäßig",
    "Griffe, Schalter, Handläufe, Telefone und gemeinsam genutzte Geräte mit einem zugelassenen Mittel desinfiziert."
   ],
   "uk": [
    "Дезінфекція поверхонь дотику — регулярно",
    "Ручки, вимикачі, поручні, телефони й спільне обладнання продезінфіковано зареєстрованим засобом."
   ],
   "pa": [
    "ਛੂਹਣ ਵਾਲੀਆਂ ਥਾਵਾਂ ਦੀ ਕੀਟਾਣੂ-ਰਹਿਤ ਸਫ਼ਾਈ — ਨਿਯਮਤ",
    "ਹੈਂਡਲ, ਸਵਿੱਚ, ਰੇਲਿੰਗ, ਫ਼ੋਨ ਅਤੇ ਸਾਂਝਾ ਸਮਾਨ ਰਜਿਸਟਰਡ ਉਤਪਾਦ ਨਾਲ ਕੀਟਾਣੂ-ਰਹਿਤ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagdidisimpekta ng madalas hawakan — regular",
    "Dinisimpekta gamit ang rehistradong produkto ang hawakan, switch, barandilya, telepono at pinagsasaluhang gamit."
   ]
  },
  "fq.janitorial.recurring.other": {
   "it": [
    "Altre pulizie commerciali — ricorrente, descrivi cosa serve",
    "Lavori di pulizia non elencati sopra, con prezzo dopo un sopralluogo dei locali."
   ],
   "de": [
    "Andere gewerbliche Reinigung — regelmäßig, beschreiben Sie den Bedarf",
    "Reinigungsarbeiten, die oben fehlen, mit Preis nach einer Begehung der Räume."
   ],
   "uk": [
    "Інше комерційне прибирання — регулярно, опишіть потребу",
    "Прибирання, якого немає вище, з ціною після огляду приміщень."
   ],
   "pa": [
    "ਹੋਰ ਵਪਾਰਕ ਸਫ਼ਾਈ — ਨਿਯਮਤ, ਦੱਸੋ ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ",
    "ਉੱਪਰ ਨਾ ਲਿਖਿਆ ਸਫ਼ਾਈ ਦਾ ਕੰਮ, ਥਾਂ ਦਾ ਚੱਕਰ ਲਾਉਣ ਤੋਂ ਬਾਅਦ ਰੇਟ।"
   ],
   "tl": [
    "Ibang komersyal na paglilinis — regular, sabihin ang kailangan",
    "Paglilinis na wala sa itaas, may presyo pagkatapos libutin ang lugar."
   ]
  },
  "fq.janitorial.one_time.office": {
   "pa": [
    "ਦਫ਼ਤਰ ਅਤੇ ਵਪਾਰਕ ਸਫ਼ਾਈ — ਇੱਕ ਵਾਰ",
    "ਡੈਸਕ, ਸਤਹਾਂ, ਛੋਟੀ ਰਸੋਈ, ਬਾਥਰੂਮ ਅਤੇ ਫ਼ਰਸ਼ ਸਾਫ਼ ਅਤੇ ਡੱਬੇ ਖ਼ਾਲੀ ਕੀਤੇ ਜਾਂਦੇ ਹਨ ਇੱਕੋ ਵਿਜ਼ਿਟ ਵਿੱਚ।"
   ]
  },
  "fq.janitorial.one_time.lobby": {
   "it": [
    "Pulizia reception e ingresso — una tantum",
    "Ingresso, bancone reception, porte a vetri e area d'attesa mantenuti presentabili per i visitatori."
   ],
   "de": [
    "Empfangs- und Foyerreinigung — einmalig",
    "Eingang, Empfangstresen, Glastüren und Wartebereich für Besucher vorzeigbar gehalten."
   ],
   "uk": [
    "Прибирання рецепції та холу — разово",
    "Вхід, стійка рецепції, скляні двері й зона очікування доглянуті для відвідувачів."
   ],
   "pa": [
    "ਰਿਸੈਪਸ਼ਨ ਅਤੇ ਲਾਬੀ ਦੀ ਸਫ਼ਾਈ — ਇੱਕ ਵਾਰ",
    "ਦਾਖ਼ਲਾ, ਰਿਸੈਪਸ਼ਨ ਡੈਸਕ, ਸ਼ੀਸ਼ੇ ਦੇ ਦਰਵਾਜ਼ੇ ਅਤੇ ਬੈਠਣ ਦੀ ਥਾਂ ਆਉਣ ਵਾਲਿਆਂ ਲਈ ਸਾਫ਼-ਸੁਥਰੀ ਰੱਖੀ ਜਾਂਦੀ ਹੈ।"
   ],
   "tl": [
    "Paglilinis ng reception at lobby — isang beses",
    "Pinananatiling maayos para sa bisita ang pasukan, reception desk, salaming pinto at upuan."
   ]
  },
  "fq.janitorial.one_time.kitchen_restroom": {
   "it": [
    "Pulizia cucina e bagni — una tantum",
    "Cucina della sala pausa e bagni puliti a fondo e disinfettati, sanitari lucidati e materiali riforniti."
   ],
   "de": [
    "Küchen- und Sanitärreinigung — einmalig",
    "Teeküche und Sanitärräume geschrubbt und desinfiziert, Armaturen poliert und Verbrauchsmaterial aufgefüllt."
   ],
   "uk": [
    "Прибирання кухні та вбиралень — разово",
    "Кухню кімнати відпочинку та вбиральні вичищено й продезінфіковано, сантехніку відполіровано, матеріали поповнено."
   ],
   "pa": [
    "ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਦੀ ਸਫ਼ਾਈ — ਇੱਕ ਵਾਰ",
    "ਬ੍ਰੇਕ-ਰੂਮ ਦੀ ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਰਗੜ ਕੇ ਕੀਟਾਣੂ-ਰਹਿਤ, ਫ਼ਿਕਸਚਰ ਚਮਕਾਏ ਅਤੇ ਸਮਾਨ ਮੁੜ ਭਰਿਆ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Paglilinis ng kusina at banyo — isang beses",
    "Kinuskos at dinisimpekta ang kusina ng break room at banyo, pinakintab ang fixture at pinunan ang supply."
   ]
  },
  "fq.janitorial.one_time.daytime": {
   "it": [
    "Pulizia diurna con addetto — una tantum",
    "Un addetto presente in orario d'ufficio per versamenti, bagni, punti di contatto e area d'ingresso."
   ],
   "de": [
    "Tagesreinigung vor Ort — einmalig",
    "Eine Reinigungskraft während der Geschäftszeiten vor Ort für Verschüttetes, Sanitärräume, Kontaktflächen und den Eingangsbereich."
   ],
   "uk": [
    "Денне прибирання з черговим — разово",
    "Прибиральник на місці в робочі години — розлиття, вбиральні, поверхні дотику та вхідна зона."
   ],
   "pa": [
    "ਦਿਨ ਵੇਲੇ ਸਫ਼ਾਈ ਕਰਮਚਾਰੀ — ਇੱਕ ਵਾਰ",
    "ਕੰਮ ਦੇ ਸਮੇਂ ਦੌਰਾਨ ਮੌਕੇ 'ਤੇ ਸਫ਼ਾਈ ਕਰਮਚਾਰੀ — ਡੁੱਲ੍ਹੀਆਂ ਚੀਜ਼ਾਂ, ਬਾਥਰੂਮ, ਛੂਹਣ ਵਾਲੀਆਂ ਥਾਵਾਂ ਅਤੇ ਮੂਹਰਲਾ ਹਿੱਸਾ।"
   ],
   "tl": [
    "Daytime na tagalinis — isang beses",
    "May tagalinis sa lugar sa oras ng negosyo para sa natapon, banyo, madalas hawakan at harapan."
   ]
  },
  "fq.janitorial.one_time.dusting": {
   "it": [
    "Spolveratura in alto e di dettaglio — una tantum",
    "Bocchette, mensole, tende, lampade e sommità degli armadi spolverati, i punti che la pulizia serale salta."
   ],
   "de": [
    "Hoch- und Detailstaubwischen — einmalig",
    "Lüftungsgitter, Simse, Jalousien, Leuchten und Schrankoberseiten abgestaubt — die Stellen, die die Abendreinigung auslässt."
   ],
   "uk": [
    "Витирання пилу на висоті та в деталях — разово",
    "Решітки, виступи, жалюзі, світильники й верх шаф протерто від пилу — місця, які вечірнє прибирання пропускає."
   ],
   "pa": [
    "ਉੱਚੀਆਂ ਅਤੇ ਬਾਰੀਕ ਥਾਵਾਂ ਦੀ ਧੂੜ — ਇੱਕ ਵਾਰ",
    "ਵੈਂਟ, ਕਿਨਾਰੇ, ਬਲਾਇੰਡ, ਲਾਈਟਾਂ ਅਤੇ ਅਲਮਾਰੀਆਂ ਦੇ ਉੱਪਰੋਂ ਧੂੜ ਸਾਫ਼ — ਉਹ ਥਾਵਾਂ ਜੋ ਰਾਤ ਦੀ ਸਫ਼ਾਈ ਛੱਡ ਦਿੰਦੀ ਹੈ।"
   ],
   "tl": [
    "Pagpupunas ng alikabok sa matataas at detalye — isang beses",
    "Pinunasan ang vent, gilid, blinds, ilaw at ibabaw ng kabinet — mga lugar na nalalampasan sa gabi-gabing linis."
   ]
  },
  "fq.janitorial.one_time.windows": {
   "it": [
    "Pulizia vetri interni — una tantum",
    "Vetri interni, divisori e vetri delle porte puliti senza aloni."
   ],
   "de": [
    "Innenreinigung von Fenstern und Glas — einmalig",
    "Innenglas, Trennwände und Türglas streifenfrei gereinigt."
   ],
   "uk": [
    "Миття вікон і скла всередині — разово",
    "Внутрішнє скло, перегородки й скло дверей вимито без розводів."
   ],
   "pa": [
    "ਅੰਦਰਲੀਆਂ ਖਿੜਕੀਆਂ ਅਤੇ ਸ਼ੀਸ਼ੇ ਦੀ ਸਫ਼ਾਈ — ਇੱਕ ਵਾਰ",
    "ਅੰਦਰਲਾ ਸ਼ੀਸ਼ਾ, ਪਾਰਟੀਸ਼ਨ ਅਤੇ ਦਰਵਾਜ਼ਿਆਂ ਦਾ ਸ਼ੀਸ਼ਾ ਬਿਨਾਂ ਧਾਰੀਆਂ ਸਾਫ਼ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Paglilinis ng bintana at salamin sa loob — isang beses",
    "Nilinis nang walang guhit ang salamin sa loob, partisyon at salamin ng pinto."
   ]
  },
  "fq.janitorial.one_time.carpet": {
   "pa": [
    "ਵਪਾਰਕ ਕਾਰਪੈੱਟ ਦੀ ਸਫ਼ਾਈ — ਇੱਕ ਵਾਰ",
    "ਦਫ਼ਤਰ ਦਾ ਕਾਰਪੈੱਟ ਐਕਸਟ੍ਰੈਕਸ਼ਨ ਜਾਂ ਇਨਕੈਪਸੂਲੇਸ਼ਨ ਨਾਲ ਸਾਫ਼, ਆਵਾਜਾਈ ਵਾਲੇ ਰਸਤੇ ਪਹਿਲਾਂ ਟ੍ਰੀਟ ਅਤੇ ਦਾਗ਼ ਹਟਾਏ ਜਾਂਦੇ ਹਨ।"
   ]
  },
  "fq.janitorial.one_time.hard_floor": {
   "pa": [
    "ਸਖ਼ਤ ਫ਼ਰਸ਼ ਦੀ ਸੰਭਾਲ — ਇੱਕ ਵਾਰ",
    "ਟਾਈਲ, ਵਿਨਾਇਲ ਅਤੇ ਸੀਲ ਕੀਤੀ ਕੰਕਰੀਟ ਮਸ਼ੀਨ ਨਾਲ ਰਗੜੀ ਅਤੇ ਜਿੱਥੇ ਫ਼ਿਨਿਸ਼ ਹੈ ਉੱਥੇ ਚਮਕਾਈ ਜਾਂਦੀ ਹੈ।"
   ]
  },
  "fq.janitorial.one_time.restocking": {
   "it": [
    "Rifornimento materiali di consumo — una tantum",
    "Carta, sapone, sacchi e igienizzante riforniti in ogni bagno e cucina."
   ],
   "de": [
    "Nachfüllen von Verbrauchsmaterial — einmalig",
    "Papier, Seife, Müllbeutel und Desinfektionsmittel in jedem Sanitärraum und jeder Küche aufgefüllt."
   ],
   "uk": [
    "Поповнення витратних матеріалів — разово",
    "Папір, мило, пакети й антисептик поповнено в кожній вбиральні та кухні."
   ],
   "pa": [
    "ਸਮਾਨ ਮੁੜ ਭਰਨਾ — ਇੱਕ ਵਾਰ",
    "ਹਰ ਬਾਥਰੂਮ ਅਤੇ ਰਸੋਈ ਵਿੱਚ ਕਾਗ਼ਜ਼, ਸਾਬਣ, ਲਾਈਨਰ ਅਤੇ ਸੈਨੀਟਾਈਜ਼ਰ ਮੁੜ ਭਰੇ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagpupuno ng supply — isang beses",
    "Pinunan ang papel, sabon, liner at sanitizer sa bawat banyo at kusina."
   ]
  },
  "fq.janitorial.one_time.waste": {
   "it": [
    "Raccolta rifiuti e riciclo — una tantum",
    "Cestini svuotati, sacchi sostituiti e rifiuti e riciclo portati al punto di raccolta dell'edificio."
   ],
   "de": [
    "Abfall- und Wertstoffentsorgung — einmalig",
    "Behälter geleert, Beutel ersetzt und Abfall sowie Wertstoffe zur Sammelstelle des Gebäudes gebracht."
   ],
   "uk": [
    "Винесення сміття та вторсировини — разово",
    "Кошики спорожнено, пакети замінено, сміття й вторсировину винесено до пункту збору будівлі."
   ],
   "pa": [
    "ਕੂੜਾ ਅਤੇ ਰੀਸਾਈਕਲਿੰਗ ਹਟਾਉਣਾ — ਇੱਕ ਵਾਰ",
    "ਡੱਬੇ ਖ਼ਾਲੀ, ਲਾਈਨਰ ਬਦਲੇ ਅਤੇ ਕੂੜਾ ਅਤੇ ਰੀਸਾਈਕਲਿੰਗ ਇਮਾਰਤ ਦੀ ਇਕੱਠ ਵਾਲੀ ਥਾਂ ਲਿਜਾਏ ਜਾਂਦੇ ਹਨ।"
   ],
   "tl": [
    "Pagtatapon ng basura at recycling — isang beses",
    "Inalisan ng laman ang basurahan, pinalitan ang liner at dinala ang basura at recycling sa tapunan ng gusali."
   ]
  },
  "fq.janitorial.one_time.sanitation": {
   "it": [
    "Disinfezione dei punti di contatto — una tantum",
    "Maniglie, interruttori, corrimano, telefoni e attrezzature comuni disinfettati con un prodotto registrato."
   ],
   "de": [
    "Desinfektion von Kontaktflächen — einmalig",
    "Griffe, Schalter, Handläufe, Telefone und gemeinsam genutzte Geräte mit einem zugelassenen Mittel desinfiziert."
   ],
   "uk": [
    "Дезінфекція поверхонь дотику — разово",
    "Ручки, вимикачі, поручні, телефони й спільне обладнання продезінфіковано зареєстрованим засобом."
   ],
   "pa": [
    "ਛੂਹਣ ਵਾਲੀਆਂ ਥਾਵਾਂ ਦੀ ਕੀਟਾਣੂ-ਰਹਿਤ ਸਫ਼ਾਈ — ਇੱਕ ਵਾਰ",
    "ਹੈਂਡਲ, ਸਵਿੱਚ, ਰੇਲਿੰਗ, ਫ਼ੋਨ ਅਤੇ ਸਾਂਝਾ ਸਮਾਨ ਰਜਿਸਟਰਡ ਉਤਪਾਦ ਨਾਲ ਕੀਟਾਣੂ-ਰਹਿਤ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।"
   ],
   "tl": [
    "Pagdidisimpekta ng madalas hawakan — isang beses",
    "Dinisimpekta gamit ang rehistradong produkto ang hawakan, switch, barandilya, telepono at pinagsasaluhang gamit."
   ]
  },
  "fq.janitorial.one_time.other": {
   "it": [
    "Altre pulizie commerciali — una tantum, descrivi cosa serve",
    "Lavori di pulizia non elencati sopra, con prezzo dopo un sopralluogo dei locali."
   ],
   "de": [
    "Andere gewerbliche Reinigung — einmalig, beschreiben Sie den Bedarf",
    "Reinigungsarbeiten, die oben fehlen, mit Preis nach einer Begehung der Räume."
   ],
   "uk": [
    "Інше комерційне прибирання — разово, опишіть потребу",
    "Прибирання, якого немає вище, з ціною після огляду приміщень."
   ],
   "pa": [
    "ਹੋਰ ਵਪਾਰਕ ਸਫ਼ਾਈ — ਇੱਕ ਵਾਰ, ਦੱਸੋ ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ",
    "ਉੱਪਰ ਨਾ ਲਿਖਿਆ ਸਫ਼ਾਈ ਦਾ ਕੰਮ, ਥਾਂ ਦਾ ਚੱਕਰ ਲਾਉਣ ਤੋਂ ਬਾਅਦ ਰੇਟ।"
   ],
   "tl": [
    "Ibang komersyal na paglilinis — isang beses, sabihin ang kailangan",
    "Paglilinis na wala sa itaas, may presyo pagkatapos libutin ang lugar."
   ]
  },
  "fq.janitorial.visits.site_walkthrough": {
   "pa": [
    "ਵਪਾਰਕ ਸਫ਼ਾਈ ਲਈ ਥਾਂ ਦਾ ਚੱਕਰ ਅਤੇ ਬੋਲੀ",
    "ਮੈਨੇਜਰ ਨਾਲ ਥਾਂ ਦਾ ਚੱਕਰ, ਵਰਗ ਫੁੱਟ ਅਤੇ ਬਾਥਰੂਮ ਗਿਣੇ, ਆਉਣ-ਜਾਣ ਦਾ ਸਮਾਂ ਨੋਟ ਕੀਤਾ ਅਤੇ ਲਿਖਤੀ ਬੋਲੀ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ।"
   ]
  }
 },
 "lines": {
  "Recurring office clean — per sq ft per visit": {
   "pa": [
    "ਨਿਯਮਤ ਦਫ਼ਤਰ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ ਪ੍ਰਤੀ ਵਿਜ਼ਿਟ",
    "ਹਰ ਵਿਜ਼ਿਟ 'ਤੇ ਫ਼ਰਸ਼, ਸਤਹਾਂ ਅਤੇ ਬ੍ਰੇਕ ਏਰੀਆ ਸਾਫ਼ ਅਤੇ ਕੂੜਾ ਬਾਹਰ।"
   ]
  },
  "Restroom — per restroom": {
   "pa": [
    "ਬਾਥਰੂਮ — ਪ੍ਰਤੀ ਬਾਥਰੂਮ",
    "ਫ਼ਿਕਸਚਰ, ਪਾਰਟੀਸ਼ਨ, ਸ਼ੀਸ਼ੇ ਅਤੇ ਫ਼ਰਸ਼ ਕੀਟਾਣੂ-ਰਹਿਤ, ਸਮਾਨ ਮੁੜ ਭਰਿਆ।"
   ]
  },
  "Break-room kitchen": {
   "pa": [
    "ਬ੍ਰੇਕ-ਰੂਮ ਰਸੋਈ",
    "ਕਾਊਂਟਰ, ਸਿੰਕ, ਉਪਕਰਣ ਅਤੇ ਫ਼ਰਸ਼ ਸਾਫ਼।"
   ]
  },
  "Initial office clean — per sq ft": {
   "pa": [
    "ਪਹਿਲੀ ਦਫ਼ਤਰ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਦਫ਼ਤਰ ਦੇ ਫ਼ਰਸ਼ ਵਾਲੇ ਹਿੱਸੇ ਦੀ ਉੱਪਰ ਤੋਂ ਹੇਠਾਂ ਤੱਕ ਪਹਿਲੀ ਸਫ਼ਾਈ।"
   ]
  },
  "Commercial carpet extraction — per sq ft": {
   "pa": [
    "ਵਪਾਰਕ ਕਾਰਪੈੱਟ ਐਕਸਟ੍ਰੈਕਸ਼ਨ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਪਹਿਲਾਂ ਸਪਰੇਅ, ਐਕਸਟ੍ਰੈਕਟ ਅਤੇ ਸੰਵਾਰਿਆ, ਫ਼ਰਨੀਚਰ ਦੇ ਦੁਆਲੇ।"
   ]
  },
  "Strip and refinish — per sq ft": {
   "pa": [
    "ਪੁਰਾਣੀ ਫ਼ਿਨਿਸ਼ ਉਤਾਰਨਾ ਅਤੇ ਨਵੀਂ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਪੁਰਾਣੀ ਫ਼ਿਨਿਸ਼ ਉਤਾਰੀ, ਫ਼ਰਸ਼ ਧੋਤਾ, ਤਿੰਨ ਕੋਟ ਫ਼ਿਨਿਸ਼ ਅਤੇ ਚਮਕਾਇਆ।"
   ]
  },
  "Floor finish and stripper — per sq ft": {
   "pa": [
    "ਫ਼ਰਸ਼ ਫ਼ਿਨਿਸ਼ ਅਤੇ ਸਟ੍ਰਿਪਰ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ",
    "ਵਪਾਰਕ ਫ਼ਰਸ਼ ਸਟ੍ਰਿਪਰ ਅਤੇ ਗਾੜ੍ਹੀ ਫ਼ਿਨਿਸ਼।"
   ]
  },
  "Walkthrough and bid": {
   "pa": [
    "ਚੱਕਰ ਅਤੇ ਬੋਲੀ",
    "ਥਾਵਾਂ ਮਾਪੀਆਂ ਅਤੇ ਲਿਖਤੀ ਬੋਲੀ ਦਿੱਤੀ; ਮੁਫ਼ਤ।"
   ]
  }
 }
};
