// lib/i18n/lawnEstimateCopy.js
//
// The homeowner-facing sentences on a lawn-care instant estimate, and the
// "this doesn't look right" control every measurement-based instant estimate
// carries — in the eight languages the instant form can be read in
// (lib/i18n/instantQuoteCopy.js INSTANT_QUOTE_LANGUAGES).
//
// Same arrangement as lib/i18n/gutterEstimateCopy.js: a closed set of short
// transactional strings, hand-written, never drafted by a model, with
// functions where a figure is interpolated because word order around a
// number does not survive concatenation across languages. Server-side and
// client-side both read it (it imports nothing), so the public form, the
// /measure response, the confirmation email and the stored draft carry the
// same words.

const COPY = {
  en: {
    // ── Lawn size ────────────────────────────────────────────────────────
    lawnSizeLabel: "Estimated lawn size",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("en-CA")} sq ft`,
    sourceParcel:
      "Estimated from the lot boundary and the roof footprint, less a driveway allowance — not a measurement. Trace your lawn to correct it.",
    sourceMinimum:
      "Estimated — we have no lot data for this address, so this is our smallest pricing band. Trace your lawn to correct it.",
    sourceTraced: "Measured from the area you traced on the map.",
    belowMinimum: "Lawns under this size are priced at the minimum band.",
    traceCta: "Trace your lawn to correct it",
    traceHint: "Click around the grass on the map. The price updates from what you trace.",
    // ── Programs ────────────────────────────────────────────────────────
    programsHeading: "Choose a program",
    addOnsHeading: "Add-ons",
    addOnProgramsHeading: "Add-on programs",
    bestValue: "Best value",
    included: "Included",
    perService: (n) => `${n} services`,
    window: "When",
    total: "Your total",
    selectProgram: "Pick a program to see your total.",
    notAContract: "Prices are per season for the estimated lawn size, not a contract — final price confirmed on site.",
    needsSiteVisit:
      "We couldn't size this property reliably from the air, so there's no instant figure — request a call back and we'll measure it on site.",
    // ── This doesn't look right ─────────────────────────────────────────
    doubtTitle: "This doesn't look right?",
    doubtBody: "Aerial measurements can miss a shed, a pool or a neighbour's fence. We'll check it by hand.",
    callUs: "Call us",
    requestCallback: "Request a call back",
    cbName: "Your name",
    cbPhone: "Phone number",
    cbTime: "Best time to call",
    cbTimeOptions: [
      ["morning", "Morning"],
      ["afternoon", "Afternoon"],
      ["evening", "Evening"],
      ["anytime", "Any time"],
    ],
    cbNote: "What looks wrong? (optional)",
    cbSend: "Request the call",
    cbSending: "Sending…",
    cbDone: "Thanks — we'll call you back to check the measurement.",
    cbPhoneRequired: "We need a phone number to call you back.",
    cbFailed: "That didn't go through. Please call us instead.",
  },
  fr: {
    lawnSizeLabel: "Superficie de pelouse estimée",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("fr-CA")} pi²`,
    sourceParcel:
      "Estimée à partir des limites du lot et de l'empreinte du toit, moins une allocation pour l'entrée — ce n'est pas une mesure. Tracez votre pelouse pour la corriger.",
    sourceMinimum:
      "Estimée — nous n'avons pas de données de lot pour cette adresse, alors il s'agit de notre plus petite tranche de prix. Tracez votre pelouse pour la corriger.",
    sourceTraced: "Mesurée à partir de la zone que vous avez tracée sur la carte.",
    belowMinimum: "Les pelouses plus petites sont facturées à la tranche minimale.",
    traceCta: "Tracer votre pelouse pour corriger",
    traceHint: "Cliquez autour du gazon sur la carte. Le prix se met à jour selon votre tracé.",
    programsHeading: "Choisissez un programme",
    addOnsHeading: "Options",
    addOnProgramsHeading: "Programmes complémentaires",
    bestValue: "Meilleure valeur",
    included: "Inclus",
    perService: (n) => `${n} services`,
    window: "Quand",
    total: "Votre total",
    selectProgram: "Choisissez un programme pour voir votre total.",
    notAContract: "Prix par saison pour la superficie estimée, pas un contrat — le prix final est confirmé sur place.",
    needsSiteVisit:
      "Nous n'avons pas pu mesurer cette propriété de façon fiable depuis les airs, alors il n'y a pas de montant instantané — demandez un rappel et nous mesurerons sur place.",
    doubtTitle: "Ça ne semble pas juste ?",
    doubtBody: "Les mesures aériennes peuvent manquer un cabanon, une piscine ou la clôture du voisin. Nous vérifierons à la main.",
    callUs: "Appelez-nous",
    requestCallback: "Demander un rappel",
    cbName: "Votre nom",
    cbPhone: "Numéro de téléphone",
    cbTime: "Meilleur moment pour appeler",
    cbTimeOptions: [
      ["morning", "Matin"],
      ["afternoon", "Après-midi"],
      ["evening", "Soir"],
      ["anytime", "N'importe quand"],
    ],
    cbNote: "Qu'est-ce qui semble incorrect ? (facultatif)",
    cbSend: "Demander l'appel",
    cbSending: "Envoi…",
    cbDone: "Merci — nous vous rappellerons pour vérifier la mesure.",
    cbPhoneRequired: "Il nous faut un numéro de téléphone pour vous rappeler.",
    cbFailed: "Ça n'a pas fonctionné. Appelez-nous plutôt.",
  },
  es: {
    lawnSizeLabel: "Tamaño estimado del césped",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("es")} pies²`,
    sourceParcel:
      "Estimado a partir del límite del lote y la huella del tejado, menos un margen para la entrada — no es una medición. Trace su césped para corregirlo.",
    sourceMinimum:
      "Estimado — no tenemos datos del lote para esta dirección, así que es nuestro tramo de precio más pequeño. Trace su césped para corregirlo.",
    sourceTraced: "Medido a partir del área que trazó en el mapa.",
    belowMinimum: "Los céspedes más pequeños se cobran al tramo mínimo.",
    traceCta: "Trace su césped para corregirlo",
    traceHint: "Haga clic alrededor de la hierba en el mapa. El precio se actualiza con su trazado.",
    programsHeading: "Elija un programa",
    addOnsHeading: "Extras",
    addOnProgramsHeading: "Programas adicionales",
    bestValue: "Mejor valor",
    included: "Incluido",
    perService: (n) => `${n} servicios`,
    window: "Cuándo",
    total: "Su total",
    selectProgram: "Elija un programa para ver su total.",
    notAContract: "Precios por temporada para el tamaño estimado, no un contrato — el precio final se confirma en el sitio.",
    needsSiteVisit:
      "No pudimos medir esta propiedad de forma fiable desde el aire, así que no hay una cifra instantánea — pida que le llamemos y lo mediremos en el sitio.",
    doubtTitle: "¿Esto no parece correcto?",
    doubtBody: "Las mediciones aéreas pueden omitir un cobertizo, una piscina o la cerca del vecino. Lo comprobaremos a mano.",
    callUs: "Llámenos",
    requestCallback: "Pedir que le llamemos",
    cbName: "Su nombre",
    cbPhone: "Número de teléfono",
    cbTime: "Mejor hora para llamar",
    cbTimeOptions: [
      ["morning", "Mañana"],
      ["afternoon", "Tarde"],
      ["evening", "Noche"],
      ["anytime", "Cualquier hora"],
    ],
    cbNote: "¿Qué parece incorrecto? (opcional)",
    cbSend: "Solicitar la llamada",
    cbSending: "Enviando…",
    cbDone: "Gracias — le llamaremos para comprobar la medición.",
    cbPhoneRequired: "Necesitamos un número de teléfono para llamarle.",
    cbFailed: "No se pudo enviar. Llámenos en su lugar.",
  },
  uk: {
    lawnSizeLabel: "Орієнтовна площа газону",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("uk-UA")} кв. фт`,
    sourceParcel:
      "Оцінено за межами ділянки та контуром даху, за вирахуванням під'їзної доріжки, — це не вимір. Обведіть свій газон, щоб уточнити.",
    sourceMinimum:
      "Оцінка — для цієї адреси в нас немає даних про ділянку, тож це наш найменший ціновий діапазон. Обведіть свій газон, щоб уточнити.",
    sourceTraced: "Виміряно за площею, яку ви обвели на карті.",
    belowMinimum: "Газони, менші за цей розмір, рахуються за мінімальним діапазоном.",
    traceCta: "Обведіть свій газон, щоб уточнити",
    traceHint: "Клацайте довкола трави на карті. Ціна оновлюється відповідно до обведеної площі.",
    programsHeading: "Оберіть програму",
    addOnsHeading: "Додатково",
    addOnProgramsHeading: "Додаткові програми",
    bestValue: "Найвигідніше",
    included: "Входить",
    perService: (n) => `${n} обробок`,
    window: "Коли",
    total: "Разом",
    selectProgram: "Оберіть програму, щоб побачити суму.",
    notAContract: "Ціни за сезон для орієнтовної площі газону, не договір — остаточну ціну підтвердимо на місці.",
    needsSiteVisit:
      "Ми не змогли надійно виміряти цю ділянку з повітря, тож миттєвої суми немає — замовте зворотний дзвінок, і ми виміряємо все на місці.",
    doubtTitle: "Щось не так?",
    doubtBody: "Аерозйомка може не врахувати сарай, басейн чи сусідський паркан. Ми перевіримо вручну.",
    callUs: "Зателефонуйте нам",
    requestCallback: "Замовити зворотний дзвінок",
    cbName: "Ваше ім'я",
    cbPhone: "Номер телефону",
    cbTime: "Коли краще зателефонувати",
    cbTimeOptions: [
      ["morning", "Зранку"],
      ["afternoon", "Удень"],
      ["evening", "Увечері"],
      ["anytime", "Будь-коли"],
    ],
    cbNote: "Що здається неправильним? (необов'язково)",
    cbSend: "Замовити дзвінок",
    cbSending: "Надсилання…",
    cbDone: "Дякуємо — ми передзвонимо, щоб перевірити вимір.",
    cbPhoneRequired: "Щоб передзвонити, нам потрібен номер телефону.",
    cbFailed: "Не вдалося надіслати. Будь ласка, зателефонуйте нам.",
  },
  pa: {
    lawnSizeLabel: "ਲਾਅਨ ਦਾ ਅਨੁਮਾਨਤ ਆਕਾਰ",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("pa-IN")} ਵਰਗ ਫੁੱਟ`,
    sourceParcel:
      "ਪਲਾਟ ਦੀ ਹੱਦ ਅਤੇ ਛੱਤ ਦੇ ਘੇਰੇ ਤੋਂ, ਡਰਾਈਵਵੇਅ ਦਾ ਹਿੱਸਾ ਘਟਾ ਕੇ ਲਾਇਆ ਅਨੁਮਾਨ — ਇਹ ਮਾਪ ਨਹੀਂ ਹੈ। ਠੀਕ ਕਰਨ ਲਈ ਆਪਣੇ ਲਾਅਨ ਦੇ ਦੁਆਲੇ ਲਕੀਰ ਖਿੱਚੋ।",
    sourceMinimum:
      "ਅਨੁਮਾਨ — ਇਸ ਪਤੇ ਲਈ ਸਾਡੇ ਕੋਲ ਪਲਾਟ ਦਾ ਡਾਟਾ ਨਹੀਂ ਹੈ, ਇਸ ਲਈ ਇਹ ਸਾਡੀ ਸਭ ਤੋਂ ਛੋਟੀ ਕੀਮਤ ਸ਼੍ਰੇਣੀ ਹੈ। ਠੀਕ ਕਰਨ ਲਈ ਆਪਣੇ ਲਾਅਨ ਦੇ ਦੁਆਲੇ ਲਕੀਰ ਖਿੱਚੋ।",
    sourceTraced: "ਨਕਸ਼ੇ ਉੱਤੇ ਤੁਹਾਡੇ ਵੱਲੋਂ ਘੇਰੇ ਖੇਤਰ ਤੋਂ ਮਾਪਿਆ ਗਿਆ।",
    belowMinimum: "ਇਸ ਤੋਂ ਛੋਟੇ ਲਾਅਨ ਘੱਟੋ-ਘੱਟ ਸ਼੍ਰੇਣੀ ਦੀ ਕੀਮਤ ਉੱਤੇ ਲਗਾਏ ਜਾਂਦੇ ਹਨ।",
    traceCta: "ਠੀਕ ਕਰਨ ਲਈ ਆਪਣੇ ਲਾਅਨ ਦੇ ਦੁਆਲੇ ਲਕੀਰ ਖਿੱਚੋ",
    traceHint: "ਨਕਸ਼ੇ ਉੱਤੇ ਘਾਹ ਦੇ ਦੁਆਲੇ ਕਲਿੱਕ ਕਰੋ। ਤੁਹਾਡੇ ਘੇਰੇ ਮੁਤਾਬਕ ਕੀਮਤ ਬਦਲ ਜਾਂਦੀ ਹੈ।",
    programsHeading: "ਕੋਈ ਪ੍ਰੋਗਰਾਮ ਚੁਣੋ",
    addOnsHeading: "ਵਾਧੂ ਸੇਵਾਵਾਂ",
    addOnProgramsHeading: "ਵਾਧੂ ਪ੍ਰੋਗਰਾਮ",
    bestValue: "ਸਭ ਤੋਂ ਵਧੀਆ ਮੁੱਲ",
    included: "ਸ਼ਾਮਲ",
    perService: (n) => `${n} ਸੇਵਾਵਾਂ`,
    window: "ਕਦੋਂ",
    total: "ਤੁਹਾਡਾ ਕੁੱਲ",
    selectProgram: "ਆਪਣਾ ਕੁੱਲ ਵੇਖਣ ਲਈ ਕੋਈ ਪ੍ਰੋਗਰਾਮ ਚੁਣੋ।",
    notAContract: "ਕੀਮਤਾਂ ਲਾਅਨ ਦੇ ਅਨੁਮਾਨਤ ਆਕਾਰ ਲਈ ਪ੍ਰਤੀ ਸੀਜ਼ਨ ਹਨ, ਇਕਰਾਰਨਾਮਾ ਨਹੀਂ — ਅੰਤਿਮ ਕੀਮਤ ਦੀ ਪੁਸ਼ਟੀ ਮੌਕੇ ਉੱਤੇ ਹੁੰਦੀ ਹੈ।",
    needsSiteVisit:
      "ਅਸੀਂ ਇਸ ਜਾਇਦਾਦ ਨੂੰ ਹਵਾਈ ਤਸਵੀਰਾਂ ਤੋਂ ਭਰੋਸੇਯੋਗ ਢੰਗ ਨਾਲ ਨਹੀਂ ਮਾਪ ਸਕੇ, ਇਸ ਲਈ ਕੋਈ ਤੁਰੰਤ ਰਕਮ ਨਹੀਂ ਹੈ — ਵਾਪਸ ਕਾਲ ਦੀ ਬੇਨਤੀ ਕਰੋ ਅਤੇ ਅਸੀਂ ਮੌਕੇ ਉੱਤੇ ਮਾਪ ਲਵਾਂਗੇ।",
    doubtTitle: "ਕੀ ਇਹ ਠੀਕ ਨਹੀਂ ਲੱਗਦਾ?",
    doubtBody: "ਹਵਾਈ ਮਾਪਾਂ ਵਿੱਚ ਸ਼ੈੱਡ, ਪੂਲ ਜਾਂ ਗੁਆਂਢੀ ਦੀ ਵਾੜ ਛੁੱਟ ਸਕਦੀ ਹੈ। ਅਸੀਂ ਹੱਥੀਂ ਜਾਂਚ ਕਰਾਂਗੇ।",
    callUs: "ਸਾਨੂੰ ਕਾਲ ਕਰੋ",
    requestCallback: "ਵਾਪਸ ਕਾਲ ਦੀ ਬੇਨਤੀ ਕਰੋ",
    cbName: "ਤੁਹਾਡਾ ਨਾਮ",
    cbPhone: "ਫ਼ੋਨ ਨੰਬਰ",
    cbTime: "ਕਾਲ ਕਰਨ ਦਾ ਸਭ ਤੋਂ ਵਧੀਆ ਸਮਾਂ",
    cbTimeOptions: [
      ["morning", "ਸਵੇਰ"],
      ["afternoon", "ਦੁਪਹਿਰ"],
      ["evening", "ਸ਼ਾਮ"],
      ["anytime", "ਕਿਸੇ ਵੇਲੇ ਵੀ"],
    ],
    cbNote: "ਕੀ ਗ਼ਲਤ ਲੱਗਦਾ ਹੈ? (ਵਿਕਲਪਿਕ)",
    cbSend: "ਕਾਲ ਦੀ ਬੇਨਤੀ ਕਰੋ",
    cbSending: "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
    cbDone: "ਧੰਨਵਾਦ — ਮਾਪ ਦੀ ਜਾਂਚ ਕਰਨ ਲਈ ਅਸੀਂ ਤੁਹਾਨੂੰ ਵਾਪਸ ਕਾਲ ਕਰਾਂਗੇ।",
    cbPhoneRequired: "ਵਾਪਸ ਕਾਲ ਕਰਨ ਲਈ ਸਾਨੂੰ ਫ਼ੋਨ ਨੰਬਰ ਚਾਹੀਦਾ ਹੈ।",
    cbFailed: "ਇਹ ਨਹੀਂ ਭੇਜਿਆ ਜਾ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਸਾਨੂੰ ਕਾਲ ਕਰੋ।",
  },
  tl: {
    lawnSizeLabel: "Tantiyang laki ng damuhan",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("fil-PH")} sq ft`,
    sourceParcel:
      "Tinantiya mula sa hangganan ng lote at sa sakop ng bubong, bawas ang daanan ng sasakyan — hindi ito sukat. Iguhit po ang inyong damuhan para maitama ito.",
    sourceMinimum:
      "Tantiya — wala kaming datos ng lote para sa address na ito, kaya ito ang aming pinakamaliit na antas ng presyo. Iguhit po ang inyong damuhan para maitama ito.",
    sourceTraced: "Sinukat mula sa lugar na iginuhit ninyo sa mapa.",
    belowMinimum: "Ang mga damuhang mas maliit dito ay sinisingil sa pinakamababang antas.",
    traceCta: "Iguhit ang inyong damuhan para maitama ito",
    traceHint: "Mag-click sa paligid ng damo sa mapa. Nag-a-update ang presyo ayon sa iginuhit ninyo.",
    programsHeading: "Pumili ng programa",
    addOnsHeading: "Mga dagdag",
    addOnProgramsHeading: "Mga dagdag na programa",
    bestValue: "Pinakasulit",
    included: "Kasama",
    perService: (n) => `${n} serbisyo`,
    window: "Kailan",
    total: "Kabuuan ninyo",
    selectProgram: "Pumili po ng programa para makita ang kabuuan.",
    notAContract: "Ang presyo ay bawat season para sa tantiyang laki ng damuhan, hindi kontrata — kukumpirmahin ang huling presyo mismo sa lugar.",
    needsSiteVisit:
      "Hindi namin maaasahang masukat ang lugar na ito mula sa itaas, kaya walang instant na halaga — humiling po ng tawag at susukatin namin ito mismo sa lugar.",
    doubtTitle: "Mukhang hindi tama?",
    doubtBody: "Maaaring hindi makita sa aerial na sukat ang kubol, pool o bakod ng kapitbahay. Susuriin namin ito nang mano-mano.",
    callUs: "Tawagan kami",
    requestCallback: "Humiling ng tawag",
    cbName: "Ang inyong pangalan",
    cbPhone: "Numero ng telepono",
    cbTime: "Pinakamagandang oras para tumawag",
    cbTimeOptions: [
      ["morning", "Umaga"],
      ["afternoon", "Hapon"],
      ["evening", "Gabi"],
      ["anytime", "Kahit anong oras"],
    ],
    cbNote: "Ano ang mukhang mali? (opsiyonal)",
    cbSend: "Humiling ng tawag",
    cbSending: "Ipinapadala…",
    cbDone: "Salamat po — tatawagan namin kayo para suriin ang sukat.",
    cbPhoneRequired: "Kailangan namin ng numero ng telepono para matawagan kayo.",
    cbFailed: "Hindi ito naipadala. Pakitawagan na lang po kami.",
  },
  de: {
    lawnSizeLabel: "Geschätzte Rasenfläche",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("de-DE")} ft²`,
    sourceParcel:
      "Geschätzt aus der Grundstücksgrenze und der Dachfläche, abzüglich einer Einfahrt – keine Messung. Zeichnen Sie Ihren Rasen ein, um sie zu korrigieren.",
    sourceMinimum:
      "Geschätzt – für diese Adresse haben wir keine Grundstücksdaten, daher ist dies unsere kleinste Preisstufe. Zeichnen Sie Ihren Rasen ein, um sie zu korrigieren.",
    sourceTraced: "Gemessen an der Fläche, die Sie auf der Karte eingezeichnet haben.",
    belowMinimum: "Kleinere Rasenflächen werden zur niedrigsten Preisstufe berechnet.",
    traceCta: "Rasen einzeichnen, um zu korrigieren",
    traceHint: "Klicken Sie auf der Karte rund um die Rasenfläche. Der Preis passt sich Ihrer Zeichnung an.",
    programsHeading: "Wählen Sie ein Programm",
    addOnsHeading: "Zusatzleistungen",
    addOnProgramsHeading: "Zusatzprogramme",
    bestValue: "Bestes Preis-Leistungs-Verhältnis",
    included: "Inbegriffen",
    perService: (n) => `${n} Einsätze`,
    window: "Wann",
    total: "Ihre Gesamtsumme",
    selectProgram: "Wählen Sie ein Programm, um Ihre Gesamtsumme zu sehen.",
    notAContract: "Preise pro Saison für die geschätzte Rasenfläche, kein Vertrag – der Endpreis wird vor Ort bestätigt.",
    needsSiteVisit:
      "Wir konnten dieses Grundstück aus der Luft nicht zuverlässig vermessen, daher gibt es keinen Sofortbetrag – bitten Sie um einen Rückruf, und wir messen vor Ort.",
    doubtTitle: "Sieht das nicht richtig aus?",
    doubtBody: "Luftbildmessungen können einen Schuppen, einen Pool oder den Zaun des Nachbarn übersehen. Wir prüfen es von Hand.",
    callUs: "Rufen Sie uns an",
    requestCallback: "Rückruf anfordern",
    cbName: "Ihr Name",
    cbPhone: "Telefonnummer",
    cbTime: "Beste Zeit für einen Anruf",
    cbTimeOptions: [
      ["morning", "Vormittags"],
      ["afternoon", "Nachmittags"],
      ["evening", "Abends"],
      ["anytime", "Jederzeit"],
    ],
    cbNote: "Was scheint nicht zu stimmen? (optional)",
    cbSend: "Anruf anfordern",
    cbSending: "Wird gesendet…",
    cbDone: "Danke – wir rufen Sie zurück, um die Messung zu prüfen.",
    cbPhoneRequired: "Für einen Rückruf benötigen wir eine Telefonnummer.",
    cbFailed: "Das hat nicht geklappt. Bitte rufen Sie uns stattdessen an.",
  },
  it: {
    lawnSizeLabel: "Superficie stimata del prato",
    lawnSize: (sqft) => `${Number(sqft).toLocaleString("it-IT")} ft²`,
    sourceParcel:
      "Stimata dai confini del lotto e dall'ingombro del tetto, meno una quota per il vialetto: non è una misura. Tracci il suo prato per correggerla.",
    sourceMinimum:
      "Stimata: per questo indirizzo non abbiamo dati sul lotto, quindi è la nostra fascia di prezzo più bassa. Tracci il suo prato per correggerla.",
    sourceTraced: "Misurata sull'area che ha tracciato sulla mappa.",
    belowMinimum: "I prati più piccoli di così sono calcolati con la fascia minima.",
    traceCta: "Tracci il suo prato per correggerla",
    traceHint: "Clicchi tutto intorno al prato sulla mappa. Il prezzo si aggiorna in base al tracciato.",
    programsHeading: "Scelga un programma",
    addOnsHeading: "Extra",
    addOnProgramsHeading: "Programmi aggiuntivi",
    bestValue: "Miglior rapporto qualità-prezzo",
    included: "Incluso",
    perService: (n) => `${n} interventi`,
    window: "Quando",
    total: "Il suo totale",
    selectProgram: "Scelga un programma per vedere il totale.",
    notAContract: "Prezzi per stagione per la superficie stimata del prato, non un contratto: il prezzo finale viene confermato sul posto.",
    needsSiteVisit:
      "Non siamo riusciti a misurare questa proprietà in modo affidabile dall'alto, quindi non c'è una cifra immediata: chieda di essere richiamato e misureremo sul posto.",
    doubtTitle: "Qualcosa non torna?",
    doubtBody: "Le misure aeree possono non vedere una casetta, una piscina o la recinzione del vicino. Controlleremo a mano.",
    callUs: "Ci chiami",
    requestCallback: "Chieda di essere richiamato",
    cbName: "Il suo nome",
    cbPhone: "Numero di telefono",
    cbTime: "Momento migliore per chiamarla",
    cbTimeOptions: [
      ["morning", "Mattina"],
      ["afternoon", "Pomeriggio"],
      ["evening", "Sera"],
      ["anytime", "In qualsiasi momento"],
    ],
    cbNote: "Cosa non le sembra corretto? (facoltativo)",
    cbSend: "Richiedi la chiamata",
    cbSending: "Invio in corso…",
    cbDone: "Grazie, la richiameremo per verificare la misura.",
    cbPhoneRequired: "Per richiamarla ci serve un numero di telefono.",
    cbFailed: "Non è andata a buon fine. Ci chiami direttamente.",
  },
};

/** The copy table for a language, falling back to English. */
export function lawnEstimateCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

/** The sentence under the lawn size, by where the figure came from. */
export function lawnSourceSentence(source, language = "en") {
  const t = lawnEstimateCopy(language);
  if (source === "traced") return t.sourceTraced;
  if (typeof source === "string" && source.startsWith("parcel")) return t.sourceParcel;
  return t.sourceMinimum;
}

/** The preferred-time keys the call-back form may post. */
export const CALLBACK_TIMES = COPY.en.cbTimeOptions.map(([k]) => k);

/** Exported for the language-completeness style checks. */
export const LAWN_ESTIMATE_COPY = COPY;
