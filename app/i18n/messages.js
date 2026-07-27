// app/i18n/messages.js
//
// The message catalog. One flat object per language, dot-namespaced keys.
//
// Flat rather than nested on purpose: `t("nav.pricing")` is a single lookup,
// keys grep cleanly (search the codebase for "nav.pricing" and you find both
// the use and every translation), and there's no merge logic to get wrong.
//
// English is the source of truth. Any key missing from another language falls
// back to English rather than rendering the raw key — a French visitor seeing
// one English sentence is a much smaller failure than seeing "nav.pricing".
//
// Interpolation uses {name} placeholders — see t() in useTranslation.js.

const en = {
  // Navigation
  "nav.features": "Features",
  "nav.pricing": "Pricing",
  "nav.industries": "Industries",
  "nav.resources": "Resources",
  "nav.contact": "Contact",
  "nav.login": "Log in",
  "nav.signup": "Start free trial",

  // Hero
  "hero.title": "Quotes, invoices and scheduling for field service teams",
  "hero.subtitle":
    "Build a quote on site, send it before you leave the driveway, and get paid without chasing anyone.",
  "hero.cta": "Start free trial",
  "hero.ctaSecondary": "See how it works",
  "hero.noCard": "No credit card required",

  // Features
  "features.title": "Everything you need to run the job",
  "features.quotes.title": "Quotes in minutes",
  "features.quotes.body":
    "Price from your own catalogue, add photos, and send a quote your client can approve on their phone.",
  "features.invoices.title": "Invoices that get paid",
  "features.invoices.body":
    "Turn an approved quote into an invoice in one click, take card payments, and track what's outstanding.",
  "features.scheduling.title": "Scheduling that holds up",
  "features.scheduling.body":
    "Book jobs, assign crews, and let clients pick a slot from your real availability.",
  "features.followups.title": "Follow-ups on autopilot",
  "features.followups.body":
    "Quiet quotes and overdue invoices get chased automatically, in your words.",

  // Pricing
  "pricing.title": "Simple, transparent pricing",
  "pricing.subtitle":
    "Every plan includes quotes, invoicing, and scheduling. Pick the plan that matches the size of your team.",
  "pricing.month": "/month",
  "pricing.cta": "Start free trial",
  "pricing.empty":
    "Pricing plans are being finalized — check back shortly, or contact us for early access pricing.",

  // Contact
  "contact.title": "Talk to us",
  "contact.subtitle": "Questions about the product, pricing, or migrating your data.",
  "contact.name": "Your name",
  "contact.email": "Email",
  "contact.message": "Message",
  "contact.send": "Send message",
  "contact.sending": "Sending…",
  "contact.sent": "Thanks — we'll be in touch shortly.",
  "contact.error": "Something went wrong. Try again, or email us directly.",

  // Footer
  "footer.product": "Product",
  "footer.company": "Company",
  "footer.legal": "Legal",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.rights": "All rights reserved.",

  // Shared
  "common.loading": "Loading…",
  "common.learnMore": "Learn more",
  "common.getStarted": "Get started",
  "common.back": "Back",
};

const fr = {
  "nav.features": "Fonctionnalités",
  "nav.pricing": "Tarifs",
  "nav.industries": "Secteurs",
  "nav.resources": "Ressources",
  "nav.contact": "Contact",
  "nav.login": "Connexion",
  "nav.signup": "Essai gratuit",

  "hero.title":
    "Soumissions, factures et planification pour les équipes de terrain",
  "hero.subtitle":
    "Préparez une soumission sur place, envoyez-la avant de quitter le stationnement, et faites-vous payer sans relancer personne.",
  "hero.cta": "Essai gratuit",
  "hero.ctaSecondary": "Voir comment ça marche",
  "hero.noCard": "Aucune carte de crédit requise",

  "features.title": "Tout ce qu'il faut pour gérer le chantier",
  "features.quotes.title": "Des soumissions en minutes",
  "features.quotes.body":
    "Tarifez à partir de votre propre catalogue, ajoutez des photos, et envoyez une soumission que votre client approuve depuis son téléphone.",
  "features.invoices.title": "Des factures qui se règlent",
  "features.invoices.body":
    "Convertissez une soumission approuvée en facture en un clic, acceptez les paiements par carte, et suivez les sommes dues.",
  "features.scheduling.title": "Une planification fiable",
  "features.scheduling.body":
    "Planifiez les chantiers, assignez les équipes, et laissez vos clients choisir une plage selon vos vraies disponibilités.",
  "features.followups.title": "Relances automatiques",
  "features.followups.body":
    "Les soumissions sans réponse et les factures en retard sont relancées automatiquement, dans vos mots.",

  "pricing.title": "Tarification simple et transparente",
  "pricing.subtitle":
    "Chaque forfait comprend les soumissions, la facturation et la planification. Choisissez celui qui correspond à la taille de votre équipe.",
  "pricing.month": "/mois",
  "pricing.cta": "Essai gratuit",
  "pricing.empty":
    "Les forfaits sont en cours de finalisation — revenez bientôt, ou contactez-nous pour un tarif d'accès anticipé.",

  "contact.title": "Parlez-nous",
  "contact.subtitle":
    "Questions sur le produit, les tarifs ou la migration de vos données.",
  "contact.name": "Votre nom",
  "contact.email": "Courriel",
  "contact.message": "Message",
  "contact.send": "Envoyer",
  "contact.sending": "Envoi…",
  "contact.sent": "Merci — nous vous répondrons sous peu.",
  "contact.error": "Une erreur est survenue. Réessayez ou écrivez-nous directement.",

  "footer.product": "Produit",
  "footer.company": "Entreprise",
  "footer.legal": "Légal",
  "footer.privacy": "Confidentialité",
  "footer.terms": "Conditions",
  "footer.rights": "Tous droits réservés.",

  "common.loading": "Chargement…",
  "common.learnMore": "En savoir plus",
  "common.getStarted": "Commencer",
  "common.back": "Retour",
};

const es = {
  "nav.features": "Funciones",
  "nav.pricing": "Precios",
  "nav.industries": "Sectores",
  "nav.resources": "Recursos",
  "nav.contact": "Contacto",
  "nav.login": "Iniciar sesión",
  "nav.signup": "Prueba gratis",

  "hero.title":
    "Presupuestos, facturas y agenda para equipos de servicio en campo",
  "hero.subtitle":
    "Arma el presupuesto en el sitio, envíalo antes de salir, y cobra sin tener que perseguir a nadie.",
  "hero.cta": "Prueba gratis",
  "hero.ctaSecondary": "Ver cómo funciona",
  "hero.noCard": "No se requiere tarjeta",

  "features.title": "Todo lo necesario para manejar el trabajo",
  "features.quotes.title": "Presupuestos en minutos",
  "features.quotes.body":
    "Cotiza desde tu propio catálogo, agrega fotos, y envía un presupuesto que tu cliente aprueba desde el teléfono.",
  "features.invoices.title": "Facturas que se cobran",
  "features.invoices.body":
    "Convierte un presupuesto aprobado en factura con un clic, acepta pagos con tarjeta, y controla lo pendiente.",
  "features.scheduling.title": "Agenda que se sostiene",
  "features.scheduling.body":
    "Programa trabajos, asigna cuadrillas, y deja que los clientes elijan un horario según tu disponibilidad real.",
  "features.followups.title": "Seguimientos automáticos",
  "features.followups.body":
    "Los presupuestos sin respuesta y las facturas vencidas se recuerdan solos, con tus palabras.",

  "pricing.title": "Precios simples y transparentes",
  "pricing.subtitle":
    "Todos los planes incluyen presupuestos, facturación y agenda. Elige el que se ajuste al tamaño de tu equipo.",
  "pricing.month": "/mes",
  "pricing.cta": "Prueba gratis",
  "pricing.empty":
    "Estamos finalizando los planes — vuelve pronto, o contáctanos para precios de acceso anticipado.",

  "contact.title": "Hablemos",
  "contact.subtitle":
    "Preguntas sobre el producto, precios o migración de tus datos.",
  "contact.name": "Tu nombre",
  "contact.email": "Correo",
  "contact.message": "Mensaje",
  "contact.send": "Enviar mensaje",
  "contact.sending": "Enviando…",
  "contact.sent": "Gracias — te contactaremos pronto.",
  "contact.error": "Algo salió mal. Inténtalo de nuevo o escríbenos directamente.",

  "footer.product": "Producto",
  "footer.company": "Empresa",
  "footer.legal": "Legal",
  "footer.privacy": "Privacidad",
  "footer.terms": "Términos",
  "footer.rights": "Todos los derechos reservados.",

  "common.loading": "Cargando…",
  "common.learnMore": "Saber más",
  "common.getStarted": "Comenzar",
  "common.back": "Atrás",
};

const uk = {
  "nav.features": "Можливості",
  "nav.pricing": "Ціни",
  "nav.industries": "Галузі",
  "nav.resources": "Ресурси",
  "nav.contact": "Контакти",
  "nav.login": "Увійти",
  "nav.signup": "Безкоштовна пробна версія",

  "hero.title":
    "Кошториси, рахунки та планування для виїзних бригад",
  "hero.subtitle":
    "Складіть кошторис на місці, надішліть його ще до від'їзду та отримайте оплату без нагадувань.",
  "hero.cta": "Почати безкоштовно",
  "hero.ctaSecondary": "Як це працює",
  "hero.noCard": "Картка не потрібна",

  "features.title": "Усе необхідне для роботи",
  "features.quotes.title": "Кошториси за хвилини",
  "features.quotes.body":
    "Формуйте ціни з власного каталогу, додавайте фото та надсилайте кошторис, який клієнт затвердить із телефона.",
  "features.invoices.title": "Рахунки, які оплачують",
  "features.invoices.body":
    "Перетворіть затверджений кошторис на рахунок одним кліком, приймайте оплату карткою та відстежуйте заборгованість.",
  "features.scheduling.title": "Надійне планування",
  "features.scheduling.body":
    "Плануйте роботи, призначайте бригади та дозвольте клієнтам обирати час із вашої реальної доступності.",
  "features.followups.title": "Автоматичні нагадування",
  "features.followups.body":
    "Кошториси без відповіді та прострочені рахунки нагадують про себе самі — вашими словами.",

  "pricing.title": "Прості та прозорі ціни",
  "pricing.subtitle":
    "Кожен тариф включає кошториси, виставлення рахунків і планування. Оберіть той, що відповідає розміру вашої команди.",
  "pricing.month": "/місяць",
  "pricing.cta": "Почати безкоштовно",
  "pricing.empty":
    "Тарифи ще формуються — завітайте пізніше або зв'яжіться з нами щодо умов раннього доступу.",

  "contact.title": "Зв'яжіться з нами",
  "contact.subtitle":
    "Питання про продукт, ціни або перенесення даних.",
  "contact.name": "Ваше ім'я",
  "contact.email": "Електронна пошта",
  "contact.message": "Повідомлення",
  "contact.send": "Надіслати",
  "contact.sending": "Надсилання…",
  "contact.sent": "Дякуємо — ми скоро відповімо.",
  "contact.error": "Щось пішло не так. Спробуйте ще раз або напишіть нам напряму.",

  "footer.product": "Продукт",
  "footer.company": "Компанія",
  "footer.legal": "Правова інформація",
  "footer.privacy": "Конфіденційність",
  "footer.terms": "Умови",
  "footer.rights": "Усі права захищено.",

  "common.loading": "Завантаження…",
  "common.learnMore": "Дізнатися більше",
  "common.getStarted": "Почати",
  "common.back": "Назад",
};

const pa = {
  "nav.features": "ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ",
  "nav.pricing": "ਕੀਮਤਾਂ",
  "nav.industries": "ਉਦਯੋਗ",
  "nav.resources": "ਸਰੋਤ",
  "nav.contact": "ਸੰਪਰਕ",
  "nav.login": "ਲੌਗ ਇਨ",
  "nav.signup": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼",

  "hero.title": "ਫ਼ੀਲਡ ਸਰਵਿਸ ਟੀਮਾਂ ਲਈ ਕੋਟ, ਇਨਵੌਇਸ ਅਤੇ ਸ਼ਡਿਊਲਿੰਗ",
  "hero.subtitle":
    "ਮੌਕੇ 'ਤੇ ਕੋਟ ਬਣਾਓ, ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਭੇਜੋ, ਅਤੇ ਕਿਸੇ ਦੇ ਪਿੱਛੇ ਪਏ ਬਿਨਾਂ ਭੁਗਤਾਨ ਲਵੋ।",
  "hero.cta": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼ ਸ਼ੁਰੂ ਕਰੋ",
  "hero.ctaSecondary": "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
  "hero.noCard": "ਕ੍ਰੈਡਿਟ ਕਾਰਡ ਦੀ ਲੋੜ ਨਹੀਂ",

  "features.title": "ਕੰਮ ਚਲਾਉਣ ਲਈ ਸਭ ਕੁਝ",
  "features.quotes.title": "ਮਿੰਟਾਂ ਵਿੱਚ ਕੋਟ",
  "features.quotes.body":
    "ਆਪਣੇ ਕੈਟਾਲਾਗ ਤੋਂ ਕੀਮਤ ਲਗਾਓ, ਫ਼ੋਟੋਆਂ ਜੋੜੋ, ਅਤੇ ਅਜਿਹਾ ਕੋਟ ਭੇਜੋ ਜਿਸ ਨੂੰ ਗਾਹਕ ਫ਼ੋਨ ਤੋਂ ਮਨਜ਼ੂਰ ਕਰ ਸਕੇ।",
  "features.invoices.title": "ਇਨਵੌਇਸ ਜਿਨ੍ਹਾਂ ਦਾ ਭੁਗਤਾਨ ਹੁੰਦਾ ਹੈ",
  "features.invoices.body":
    "ਮਨਜ਼ੂਰ ਕੋਟ ਨੂੰ ਇੱਕ ਕਲਿੱਕ ਵਿੱਚ ਇਨਵੌਇਸ ਬਣਾਓ, ਕਾਰਡ ਭੁਗਤਾਨ ਲਵੋ, ਅਤੇ ਬਕਾਇਆ ਰਕਮ ਟਰੈਕ ਕਰੋ।",
  "features.scheduling.title": "ਭਰੋਸੇਯੋਗ ਸ਼ਡਿਊਲਿੰਗ",
  "features.scheduling.body":
    "ਕੰਮ ਬੁੱਕ ਕਰੋ, ਟੀਮਾਂ ਸੌਂਪੋ, ਅਤੇ ਗਾਹਕਾਂ ਨੂੰ ਤੁਹਾਡੀ ਅਸਲ ਉਪਲਬਧਤਾ ਵਿੱਚੋਂ ਸਮਾਂ ਚੁਣਨ ਦਿਓ।",
  "features.followups.title": "ਆਪਣੇ-ਆਪ ਫਾਲੋ-ਅੱਪ",
  "features.followups.body":
    "ਜਵਾਬ ਤੋਂ ਬਿਨਾਂ ਕੋਟ ਅਤੇ ਬਕਾਇਆ ਇਨਵੌਇਸ ਆਪਣੇ-ਆਪ ਯਾਦ ਕਰਵਾਏ ਜਾਂਦੇ ਹਨ, ਤੁਹਾਡੇ ਸ਼ਬਦਾਂ ਵਿੱਚ।",

  "pricing.title": "ਸਧਾਰਨ, ਪਾਰਦਰਸ਼ੀ ਕੀਮਤਾਂ",
  "pricing.subtitle":
    "ਹਰ ਪਲਾਨ ਵਿੱਚ ਕੋਟ, ਇਨਵੌਇਸਿੰਗ ਅਤੇ ਸ਼ਡਿਊਲਿੰਗ ਸ਼ਾਮਲ ਹੈ। ਆਪਣੀ ਟੀਮ ਦੇ ਆਕਾਰ ਮੁਤਾਬਕ ਚੁਣੋ।",
  "pricing.month": "/ਮਹੀਨਾ",
  "pricing.cta": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼ ਸ਼ੁਰੂ ਕਰੋ",
  "pricing.empty":
    "ਪਲਾਨ ਤਿਆਰ ਕੀਤੇ ਜਾ ਰਹੇ ਹਨ — ਜਲਦੀ ਵਾਪਸ ਆਓ, ਜਾਂ ਸ਼ੁਰੂਆਤੀ ਕੀਮਤ ਲਈ ਸੰਪਰਕ ਕਰੋ।",

  "contact.title": "ਸਾਡੇ ਨਾਲ ਗੱਲ ਕਰੋ",
  "contact.subtitle": "ਉਤਪਾਦ, ਕੀਮਤ ਜਾਂ ਡਾਟਾ ਤਬਦੀਲੀ ਬਾਰੇ ਸਵਾਲ।",
  "contact.name": "ਤੁਹਾਡਾ ਨਾਮ",
  "contact.email": "ਈਮੇਲ",
  "contact.message": "ਸੁਨੇਹਾ",
  "contact.send": "ਸੁਨੇਹਾ ਭੇਜੋ",
  "contact.sending": "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  "contact.sent": "ਧੰਨਵਾਦ — ਅਸੀਂ ਜਲਦੀ ਸੰਪਰਕ ਕਰਾਂਗੇ।",
  "contact.error": "ਕੁਝ ਗ਼ਲਤ ਹੋ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਸਿੱਧਾ ਈਮੇਲ ਕਰੋ।",

  "footer.product": "ਉਤਪਾਦ",
  "footer.company": "ਕੰਪਨੀ",
  "footer.legal": "ਕਾਨੂੰਨੀ",
  "footer.privacy": "ਪਰਦੇਦਾਰੀ",
  "footer.terms": "ਸ਼ਰਤਾਂ",
  "footer.rights": "ਸਾਰੇ ਹੱਕ ਰਾਖਵੇਂ ਹਨ।",

  "common.loading": "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
  "common.learnMore": "ਹੋਰ ਜਾਣੋ",
  "common.getStarted": "ਸ਼ੁਰੂ ਕਰੋ",
  "common.back": "ਵਾਪਸ",
};

const tl = {
  "nav.features": "Mga Feature",
  "nav.pricing": "Presyo",
  "nav.industries": "Mga Industriya",
  "nav.resources": "Mga Resource",
  "nav.contact": "Kontak",
  "nav.login": "Mag-log in",
  "nav.signup": "Libreng subok",

  "hero.title":
    "Mga quote, invoice at scheduling para sa field service teams",
  "hero.subtitle":
    "Gumawa ng quote sa site, ipadala bago ka pa umalis, at mabayaran nang hindi na kailangang manghabol.",
  "hero.cta": "Simulan ang libreng subok",
  "hero.ctaSecondary": "Tingnan kung paano ito gumagana",
  "hero.noCard": "Walang kailangang credit card",

  "features.title": "Lahat ng kailangan para patakbuhin ang trabaho",
  "features.quotes.title": "Quote sa loob ng ilang minuto",
  "features.quotes.body":
    "Magpresyo mula sa sarili mong katalogo, magdagdag ng litrato, at magpadala ng quote na maaaring aprubahan ng kliyente sa telepono.",
  "features.invoices.title": "Mga invoice na nababayaran",
  "features.invoices.body":
    "Gawing invoice ang aprubadong quote sa isang click, tumanggap ng bayad sa card, at subaybayan ang natitirang balanse.",
  "features.scheduling.title": "Scheduling na maaasahan",
  "features.scheduling.body":
    "Mag-book ng trabaho, mag-assign ng crew, at hayaan ang kliyente na pumili ng oras mula sa totoo mong availability.",
  "features.followups.title": "Awtomatikong follow-up",
  "features.followups.body":
    "Ang mga quote na walang sagot at overdue na invoice ay awtomatikong pinapaalalahanan, sa sarili mong salita.",

  "pricing.title": "Simple at malinaw na presyo",
  "pricing.subtitle":
    "Kasama sa bawat plano ang quotes, invoicing at scheduling. Piliin ang akma sa laki ng inyong team.",
  "pricing.month": "/buwan",
  "pricing.cta": "Simulan ang libreng subok",
  "pricing.empty":
    "Tinatapos pa ang mga plano — bumalik mamaya, o makipag-ugnayan para sa early access na presyo.",

  "contact.title": "Kausapin kami",
  "contact.subtitle":
    "Mga tanong tungkol sa produkto, presyo, o paglipat ng inyong data.",
  "contact.name": "Pangalan mo",
  "contact.email": "Email",
  "contact.message": "Mensahe",
  "contact.send": "Ipadala ang mensahe",
  "contact.sending": "Ipinapadala…",
  "contact.sent": "Salamat — makikipag-ugnayan kami agad.",
  "contact.error": "May nagkamali. Subukan ulit, o mag-email sa amin nang diretso.",

  "footer.product": "Produkto",
  "footer.company": "Kompanya",
  "footer.legal": "Legal",
  "footer.privacy": "Privacy",
  "footer.terms": "Mga Tuntunin",
  "footer.rights": "Nakalaan ang lahat ng karapatan.",

  "common.loading": "Naglo-load…",
  "common.learnMore": "Alamin pa",
  "common.getStarted": "Magsimula",
  "common.back": "Bumalik",
};

export const MESSAGES = { en, fr, es, uk, pa, tl };

// Every key that exists in English. Used by the coverage check in
// scripts/check-translations.mjs so a missing translation is a caught
// omission rather than something a customer discovers.
export const MESSAGE_KEYS = Object.keys(en);
