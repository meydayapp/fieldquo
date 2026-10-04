// lib/i18n/funnelStarterCopy.js
//
// The words of FieldQuo's starter funnels (lib/funnels/templates.js), in every
// document language.
//
// A starter funnel is copy FieldQuo hands a company to edit: the hook, the
// timeline and budget questions, the photo step, the contact form, the
// thank-you. It was English for every company until 2026-10-03, which put an
// English headline over French chrome on a Québec contractor's public page —
// the page's own words follow the COMPANY's language (lib/i18n/funnelCopy.js's
// funnelPageLanguage), so the starter is written in that language too.
//
// Only words. The answer VALUES ("asap", "5k_15k" …) are the scoring keys and
// are the same in every language — a French funnel scores a lead exactly like
// an English one.

export const FUNNEL_STARTER_COPY = {
  en: {
    templates: {
      web_quote: { name: "Website — get a quote", hook: (co) => `Get your ${co} quote`, hookNoName: "Get your quote", sub: "Answer a few quick questions and we'll get you a price." },
      tiktok_quiz: { name: "TikTok — 60-second quiz", hook: () => "Get your price in 60 seconds", hookNoName: "Get your price in 60 seconds", sub: "Tap through — no calls, no obligation." },
      instagram_estimate: { name: "Instagram — free estimate", hook: (co) => `Free estimate from ${co}`, hookNoName: "Free estimate from us", sub: "A few taps and we'll be in touch with your number." },
      youtube_leadmagnet: { name: "YouTube — book your visit", hook: (co) => `Work with ${co}`, hookNoName: "Work with us", sub: "Tell us about the job and book a time that suits you." },
    },
    introButton: "Get started",
    service: "What can we help with?",
    timeline: { question: "When are you hoping to start?", asap: "As soon as possible", twoWeeks: "Within 2 weeks", months: "In the next 1–3 months", exploring: "Just exploring" },
    budget: { question: "Roughly what's your budget?", under: (a) => `Under ${a}`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a}+`, unsure: "Not sure yet" },
    photos: { headline: "Add a few photos (optional)", subhead: "A picture of the job helps us give you an accurate price faster.", button: "Continue" },
    contact: { headline: "Where should we send your quote?", subhead: "One of email or phone is enough.", button: "Get my quote" },
    done: { headline: "Thanks — we've got everything we need", subhead: (co) => `${co} will be in touch shortly with your price. No obligation.`, subheadNoName: "We will be in touch shortly with your price. No obligation." },
    blank: { introHeadline: "Get a quote", introButton: "Get started", contactHeadline: "Your details", contactButton: "Submit", doneHeadline: "Thanks — we'll be in touch.", untitled: "Untitled funnel" },
  },

  fr: {
    templates: {
      web_quote: { name: "Site web — obtenir une soumission", hook: (co) => `Votre soumission avec ${co}`, hookNoName: "Obtenez votre soumission", sub: "Répondez à quelques questions rapides et nous vous donnerons un prix." },
      tiktok_quiz: { name: "TikTok — quiz de 60 secondes", hook: () => "Votre prix en 60 secondes", hookNoName: "Votre prix en 60 secondes", sub: "Quelques touches — sans appel, sans engagement." },
      instagram_estimate: { name: "Instagram — estimation gratuite", hook: (co) => `Estimation gratuite de ${co}`, hookNoName: "Estimation gratuite", sub: "Quelques touches et nous vous revenons avec votre prix." },
      youtube_leadmagnet: { name: "YouTube — réservez votre visite", hook: (co) => `Travaillez avec ${co}`, hookNoName: "Travaillez avec nous", sub: "Parlez-nous du projet et réservez le moment qui vous convient." },
    },
    introButton: "Commencer",
    service: "Comment pouvons-nous vous aider ?",
    timeline: { question: "Quand aimeriez-vous commencer ?", asap: "Dès que possible", twoWeeks: "D'ici 2 semaines", months: "Dans les 1 à 3 prochains mois", exploring: "Je me renseigne" },
    budget: { question: "Quel est votre budget approximatif ?", under: (a) => `Moins de ${a}`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a} et plus`, unsure: "Je ne sais pas encore" },
    photos: { headline: "Ajoutez quelques photos (facultatif)", subhead: "Une photo du projet nous aide à vous donner un prix précis plus rapidement.", button: "Continuer" },
    contact: { headline: "Où devons-nous envoyer votre soumission ?", subhead: "Un courriel ou un numéro de téléphone suffit.", button: "Recevoir ma soumission" },
    done: { headline: "Merci — nous avons tout ce qu'il nous faut", subhead: (co) => `${co} vous contactera sous peu avec votre prix. Sans engagement.`, subheadNoName: "Nous vous contacterons sous peu avec votre prix. Sans engagement." },
    blank: { introHeadline: "Obtenez une soumission", introButton: "Commencer", contactHeadline: "Vos coordonnées", contactButton: "Envoyer", doneHeadline: "Merci — nous vous contacterons.", untitled: "Tunnel sans titre" },
  },

  es: {
    templates: {
      web_quote: { name: "Sitio web — pida un presupuesto", hook: (co) => `Su presupuesto de ${co}`, hookNoName: "Pida su presupuesto", sub: "Responda unas preguntas rápidas y le daremos un precio." },
      tiktok_quiz: { name: "TikTok — quiz de 60 segundos", hook: () => "Su precio en 60 segundos", hookNoName: "Su precio en 60 segundos", sub: "Solo toque — sin llamadas, sin compromiso." },
      instagram_estimate: { name: "Instagram — estimado gratis", hook: (co) => `Estimado gratis de ${co}`, hookNoName: "Estimado gratis", sub: "Unos toques y le enviaremos su precio." },
      youtube_leadmagnet: { name: "YouTube — reserve su visita", hook: (co) => `Trabaje con ${co}`, hookNoName: "Trabaje con nosotros", sub: "Cuéntenos sobre el trabajo y reserve el horario que le convenga." },
    },
    introButton: "Empezar",
    service: "¿En qué podemos ayudarle?",
    timeline: { question: "¿Cuándo le gustaría empezar?", asap: "Lo antes posible", twoWeeks: "En las próximas 2 semanas", months: "En los próximos 1 a 3 meses", exploring: "Solo estoy explorando" },
    budget: { question: "¿Cuál es su presupuesto aproximado?", under: (a) => `Menos de ${a}`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a} o más`, unsure: "Aún no lo sé" },
    photos: { headline: "Agregue algunas fotos (opcional)", subhead: "Una foto del trabajo nos ayuda a darle un precio preciso más rápido.", button: "Continuar" },
    contact: { headline: "¿A dónde le enviamos su presupuesto?", subhead: "Basta con un correo o un teléfono.", button: "Recibir mi presupuesto" },
    done: { headline: "Gracias — tenemos todo lo que necesitamos", subhead: (co) => `${co} se pondrá en contacto pronto con su precio. Sin compromiso.`, subheadNoName: "Nos pondremos en contacto pronto con su precio. Sin compromiso." },
    blank: { introHeadline: "Pida un presupuesto", introButton: "Empezar", contactHeadline: "Sus datos", contactButton: "Enviar", doneHeadline: "Gracias — nos pondremos en contacto.", untitled: "Embudo sin título" },
  },

  uk: {
    templates: {
      web_quote: { name: "Сайт — отримати кошторис", hook: (co) => `Ваш кошторис від ${co}`, hookNoName: "Отримайте кошторис", sub: "Дайте відповідь на кілька коротких запитань, і ми назвемо вам ціну." },
      tiktok_quiz: { name: "TikTok — тест на 60 секунд", hook: () => "Ваша ціна за 60 секунд", hookNoName: "Ваша ціна за 60 секунд", sub: "Кілька дотиків — без дзвінків і зобов'язань." },
      instagram_estimate: { name: "Instagram — безкоштовна оцінка", hook: (co) => `Безкоштовна оцінка від ${co}`, hookNoName: "Безкоштовна оцінка", sub: "Кілька дотиків — і ми зв'яжемося з вами щодо ціни." },
      youtube_leadmagnet: { name: "YouTube — запишіться на візит", hook: (co) => `Працюйте з ${co}`, hookNoName: "Працюйте з нами", sub: "Розкажіть про роботу й оберіть зручний для вас час." },
    },
    introButton: "Почати",
    service: "Чим ми можемо допомогти?",
    timeline: { question: "Коли ви хотіли б почати?", asap: "Якомога швидше", twoWeeks: "Протягом 2 тижнів", months: "Протягом наступних 1–3 місяців", exploring: "Поки що просто дивлюся" },
    budget: { question: "Який у вас приблизний бюджет?", under: (a) => `До ${a}`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a}+`, unsure: "Ще не знаю" },
    photos: { headline: "Додайте кілька фото (необов'язково)", subhead: "Фото об'єкта допоможе нам швидше назвати точну ціну.", button: "Продовжити" },
    contact: { headline: "Куди надіслати ваш кошторис?", subhead: "Достатньо електронної пошти або телефону.", button: "Отримати кошторис" },
    done: { headline: "Дякуємо — у нас є все необхідне", subhead: (co) => `${co} незабаром зв'яжеться з вами щодо ціни. Без зобов'язань.`, subheadNoName: "Ми незабаром зв'яжемося з вами щодо ціни. Без зобов'язань." },
    blank: { introHeadline: "Отримайте кошторис", introButton: "Почати", contactHeadline: "Ваші дані", contactButton: "Надіслати", doneHeadline: "Дякуємо — ми зв'яжемося з вами.", untitled: "Воронка без назви" },
  },

  pa: {
    templates: {
      web_quote: { name: "ਵੈੱਬਸਾਈਟ — ਹਵਾਲਾ ਲਓ", hook: (co) => `${co} ਤੋਂ ਆਪਣਾ ਹਵਾਲਾ ਲਓ`, hookNoName: "ਆਪਣਾ ਹਵਾਲਾ ਲਓ", sub: "ਕੁਝ ਛੋਟੇ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ ਅਤੇ ਅਸੀਂ ਤੁਹਾਨੂੰ ਕੀਮਤ ਦੱਸਾਂਗੇ।" },
      tiktok_quiz: { name: "TikTok — 60 ਸਕਿੰਟ ਦਾ ਕੁਇਜ਼", hook: () => "60 ਸਕਿੰਟਾਂ ਵਿੱਚ ਆਪਣੀ ਕੀਮਤ ਜਾਣੋ", hookNoName: "60 ਸਕਿੰਟਾਂ ਵਿੱਚ ਆਪਣੀ ਕੀਮਤ ਜਾਣੋ", sub: "ਬੱਸ ਟੈਪ ਕਰੋ — ਕੋਈ ਫ਼ੋਨ ਨਹੀਂ, ਕੋਈ ਜ਼ਿੰਮੇਵਾਰੀ ਨਹੀਂ।" },
      instagram_estimate: { name: "Instagram — ਮੁਫ਼ਤ ਅੰਦਾਜ਼ਾ", hook: (co) => `${co} ਵੱਲੋਂ ਮੁਫ਼ਤ ਅੰਦਾਜ਼ਾ`, hookNoName: "ਮੁਫ਼ਤ ਅੰਦਾਜ਼ਾ", sub: "ਕੁਝ ਟੈਪ ਕਰੋ ਅਤੇ ਅਸੀਂ ਤੁਹਾਡੀ ਕੀਮਤ ਲੈ ਕੇ ਸੰਪਰਕ ਕਰਾਂਗੇ।" },
      youtube_leadmagnet: { name: "YouTube — ਆਪਣੀ ਮੁਲਾਕਾਤ ਬੁੱਕ ਕਰੋ", hook: (co) => `${co} ਨਾਲ ਕੰਮ ਕਰੋ`, hookNoName: "ਸਾਡੇ ਨਾਲ ਕੰਮ ਕਰੋ", sub: "ਸਾਨੂੰ ਕੰਮ ਬਾਰੇ ਦੱਸੋ ਅਤੇ ਆਪਣੀ ਸਹੂਲਤ ਦਾ ਸਮਾਂ ਬੁੱਕ ਕਰੋ।" },
    },
    introButton: "ਸ਼ੁਰੂ ਕਰੋ",
    service: "ਅਸੀਂ ਕਿਸ ਕੰਮ ਵਿੱਚ ਮਦਦ ਕਰੀਏ?",
    timeline: { question: "ਤੁਸੀਂ ਕਦੋਂ ਸ਼ੁਰੂ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?", asap: "ਜਿੰਨੀ ਜਲਦੀ ਹੋ ਸਕੇ", twoWeeks: "2 ਹਫ਼ਤਿਆਂ ਦੇ ਅੰਦਰ", months: "ਅਗਲੇ 1–3 ਮਹੀਨਿਆਂ ਵਿੱਚ", exploring: "ਬੱਸ ਜਾਣਕਾਰੀ ਲੈ ਰਹੇ ਹਾਂ" },
    budget: { question: "ਤੁਹਾਡਾ ਅੰਦਾਜ਼ਨ ਬਜਟ ਕਿੰਨਾ ਹੈ?", under: (a) => `${a} ਤੋਂ ਘੱਟ`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a}+`, unsure: "ਅਜੇ ਪੱਕਾ ਨਹੀਂ" },
    photos: { headline: "ਕੁਝ ਫ਼ੋਟੋਆਂ ਜੋੜੋ (ਵਿਕਲਪਿਕ)", subhead: "ਕੰਮ ਦੀ ਫ਼ੋਟੋ ਨਾਲ ਅਸੀਂ ਤੁਹਾਨੂੰ ਸਹੀ ਕੀਮਤ ਜਲਦੀ ਦੱਸ ਸਕਦੇ ਹਾਂ।", button: "ਜਾਰੀ ਰੱਖੋ" },
    contact: { headline: "ਅਸੀਂ ਤੁਹਾਡਾ ਹਵਾਲਾ ਕਿੱਥੇ ਭੇਜੀਏ?", subhead: "ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ ਵਿੱਚੋਂ ਇੱਕ ਹੀ ਕਾਫ਼ੀ ਹੈ।", button: "ਮੇਰਾ ਹਵਾਲਾ ਭੇਜੋ" },
    done: { headline: "ਧੰਨਵਾਦ — ਸਾਨੂੰ ਲੋੜੀਂਦੀ ਸਾਰੀ ਜਾਣਕਾਰੀ ਮਿਲ ਗਈ ਹੈ", subhead: (co) => `${co} ਜਲਦੀ ਹੀ ਤੁਹਾਡੀ ਕੀਮਤ ਲੈ ਕੇ ਸੰਪਰਕ ਕਰੇਗਾ। ਕੋਈ ਜ਼ਿੰਮੇਵਾਰੀ ਨਹੀਂ।`, subheadNoName: "ਅਸੀਂ ਜਲਦੀ ਹੀ ਤੁਹਾਡੀ ਕੀਮਤ ਲੈ ਕੇ ਸੰਪਰਕ ਕਰਾਂਗੇ। ਕੋਈ ਜ਼ਿੰਮੇਵਾਰੀ ਨਹੀਂ।" },
    blank: { introHeadline: "ਹਵਾਲਾ ਲਓ", introButton: "ਸ਼ੁਰੂ ਕਰੋ", contactHeadline: "ਤੁਹਾਡੇ ਵੇਰਵੇ", contactButton: "ਭੇਜੋ", doneHeadline: "ਧੰਨਵਾਦ — ਅਸੀਂ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰਾਂਗੇ।", untitled: "ਬਿਨਾਂ ਨਾਮ ਦਾ ਫ਼ਨਲ" },
  },

  tl: {
    templates: {
      web_quote: { name: "Website — kumuha ng quote", hook: (co) => `Ang inyong quote mula sa ${co}`, hookNoName: "Kunin ang inyong quote", sub: "Sagutin ang ilang mabilis na tanong at bibigyan namin kayo ng presyo." },
      tiktok_quiz: { name: "TikTok — 60-segundong quiz", hook: () => "Alamin ang presyo sa loob ng 60 segundo", hookNoName: "Alamin ang presyo sa loob ng 60 segundo", sub: "I-tap lang — walang tawag, walang obligasyon." },
      instagram_estimate: { name: "Instagram — libreng estimate", hook: (co) => `Libreng estimate mula sa ${co}`, hookNoName: "Libreng estimate", sub: "Ilang tap lang at ipapaalam namin sa inyo ang presyo." },
      youtube_leadmagnet: { name: "YouTube — i-book ang inyong pagbisita", hook: (co) => `Makipagtrabaho sa ${co}`, hookNoName: "Makipagtrabaho sa amin", sub: "Ikuwento ang trabaho at pumili ng oras na babagay sa inyo." },
    },
    introButton: "Magsimula",
    service: "Ano ang maitutulong namin?",
    timeline: { question: "Kailan ninyo gustong magsimula?", asap: "Sa lalong madaling panahon", twoWeeks: "Sa loob ng 2 linggo", months: "Sa susunod na 1–3 buwan", exploring: "Nagtitingin-tingin pa lang" },
    budget: { question: "Mga magkano ang inyong budget?", under: (a) => `Mas mababa sa ${a}`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a} pataas`, unsure: "Hindi pa sigurado" },
    photos: { headline: "Magdagdag ng ilang larawan (opsyonal)", subhead: "Makatutulong ang larawan ng trabaho para mabigyan namin kayo ng tamang presyo nang mas mabilis.", button: "Magpatuloy" },
    contact: { headline: "Saan namin ipapadala ang inyong quote?", subhead: "Sapat na ang email o numero ng telepono.", button: "Kunin ang aking quote" },
    done: { headline: "Salamat — nasa amin na ang lahat ng kailangan namin", subhead: (co) => `Makikipag-ugnayan ang ${co} sa inyo sa lalong madaling panahon para sa presyo. Walang obligasyon.`, subheadNoName: "Makikipag-ugnayan kami sa inyo sa lalong madaling panahon para sa presyo. Walang obligasyon." },
    blank: { introHeadline: "Kumuha ng quote", introButton: "Magsimula", contactHeadline: "Ang inyong detalye", contactButton: "Ipadala", doneHeadline: "Salamat — makikipag-ugnayan kami.", untitled: "Funnel na walang pangalan" },
  },

  de: {
    templates: {
      web_quote: { name: "Website — Angebot anfordern", hook: (co) => `Ihr Angebot von ${co}`, hookNoName: "Ihr Angebot anfordern", sub: "Beantworten Sie ein paar kurze Fragen und Sie erhalten einen Preis." },
      tiktok_quiz: { name: "TikTok — 60-Sekunden-Quiz", hook: () => "Ihr Preis in 60 Sekunden", hookNoName: "Ihr Preis in 60 Sekunden", sub: "Einfach durchtippen — keine Anrufe, unverbindlich." },
      instagram_estimate: { name: "Instagram — kostenlose Schätzung", hook: (co) => `Kostenlose Schätzung von ${co}`, hookNoName: "Kostenlose Schätzung", sub: "Ein paar Tipps und wir melden uns mit Ihrem Preis." },
      youtube_leadmagnet: { name: "YouTube — Termin buchen", hook: (co) => `Arbeiten Sie mit ${co}`, hookNoName: "Arbeiten Sie mit uns", sub: "Erzählen Sie uns vom Auftrag und buchen Sie einen passenden Termin." },
    },
    introButton: "Los geht's",
    service: "Wobei können wir helfen?",
    timeline: { question: "Wann möchten Sie beginnen?", asap: "So bald wie möglich", twoWeeks: "Innerhalb von 2 Wochen", months: "In den nächsten 1–3 Monaten", exploring: "Ich informiere mich nur" },
    budget: { question: "Wie hoch ist Ihr ungefähres Budget?", under: (a) => `Unter ${a}`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a} und mehr`, unsure: "Noch unklar" },
    photos: { headline: "Ein paar Fotos hinzufügen (optional)", subhead: "Ein Foto der Arbeit hilft uns, Ihnen schneller einen genauen Preis zu nennen.", button: "Weiter" },
    contact: { headline: "Wohin sollen wir Ihr Angebot schicken?", subhead: "E-Mail oder Telefon genügt.", button: "Angebot erhalten" },
    done: { headline: "Danke — wir haben alles, was wir brauchen", subhead: (co) => `${co} meldet sich in Kürze mit Ihrem Preis. Unverbindlich.`, subheadNoName: "Wir melden uns in Kürze mit Ihrem Preis. Unverbindlich." },
    blank: { introHeadline: "Angebot anfordern", introButton: "Los geht's", contactHeadline: "Ihre Angaben", contactButton: "Absenden", doneHeadline: "Danke — wir melden uns.", untitled: "Unbenannter Funnel" },
  },

  it: {
    templates: {
      web_quote: { name: "Sito web — richiedi un preventivo", hook: (co) => `Il Suo preventivo da ${co}`, hookNoName: "Richieda il Suo preventivo", sub: "Risponda a qualche domanda veloce e Le daremo un prezzo." },
      tiktok_quiz: { name: "TikTok — quiz da 60 secondi", hook: () => "Il Suo prezzo in 60 secondi", hookNoName: "Il Suo prezzo in 60 secondi", sub: "Basta qualche tocco — niente chiamate, nessun impegno." },
      instagram_estimate: { name: "Instagram — stima gratuita", hook: (co) => `Stima gratuita da ${co}`, hookNoName: "Stima gratuita", sub: "Pochi tocchi e La ricontatteremo con il Suo prezzo." },
      youtube_leadmagnet: { name: "YouTube — prenoti il sopralluogo", hook: (co) => `Lavori con ${co}`, hookNoName: "Lavori con noi", sub: "Ci parli del lavoro e prenoti l'orario che preferisce." },
    },
    introButton: "Inizia",
    service: "Come possiamo aiutarLa?",
    timeline: { question: "Quando vorrebbe iniziare?", asap: "Il prima possibile", twoWeeks: "Entro 2 settimane", months: "Nei prossimi 1–3 mesi", exploring: "Sto solo valutando" },
    budget: { question: "Qual è il Suo budget indicativo?", under: (a) => `Meno di ${a}`, range: (a, b) => `${a} – ${b}`, plus: (a) => `${a} e oltre`, unsure: "Non so ancora" },
    photos: { headline: "Aggiunga qualche foto (facoltativo)", subhead: "Una foto del lavoro ci aiuta a darLe un prezzo preciso più in fretta.", button: "Continua" },
    contact: { headline: "Dove Le inviamo il preventivo?", subhead: "Basta un'email o un numero di telefono.", button: "Ricevi il mio preventivo" },
    done: { headline: "Grazie — abbiamo tutto ciò che ci serve", subhead: (co) => `${co} La contatterà a breve con il Suo prezzo. Senza impegno.`, subheadNoName: "La contatteremo a breve con il Suo prezzo. Senza impegno." },
    blank: { introHeadline: "Richieda un preventivo", introButton: "Inizia", contactHeadline: "I Suoi dati", contactButton: "Invia", doneHeadline: "Grazie — La contatteremo.", untitled: "Funnel senza titolo" },
  },
};

/** The starter words for one language; English for a language not carried. */
export function funnelStarterCopy(language) {
  const code = String(language || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(FUNNEL_STARTER_COPY, code) ? FUNNEL_STARTER_COPY[code] : FUNNEL_STARTER_COPY.en;
}
