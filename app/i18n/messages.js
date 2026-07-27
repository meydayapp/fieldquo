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
  "nav.product": "Product",
  "nav.pricing": "Pricing",
  "nav.industries": "Industries",
  "nav.resources": "Resources",
  "nav.contact": "Contact",
  "nav.login": "Log in",
  "nav.signup": "Start free trial",
  "nav.dashboard": "Go to dashboard",

  // Product menu
  "product.quoting.label": "Quotes & Invoicing",
  "product.quoting.description": "Build and send professional quotes in minutes",
  "product.scheduling.label": "Scheduling & Dispatch",
  "product.scheduling.description":
    "Calendly-style booking, appointments, and job assignment",
  "product.team.label": "Team & Payroll",
  "product.team.description":
    "Timesheets, contractor payouts, role-based access",
  "product.analytics.label": "Analytics & AI",
  "product.analytics.description":
    "Know your numbers — and what to do about them",

  // Hero
  "hero.title": "Quotes, invoices and scheduling for field service teams",
  "hero.subtitle":
    "Build a quote on site, send it before you leave the driveway, and get paid without chasing anyone.",
  "hero.cta": "Start free trial",
  "hero.ctaSecondary": "See how it works",
  "hero.noCard": "No credit card required",
  "hero.emailPlaceholder": "you@yourcompany.com",
  "hero.requestDemo": "Request a demo",
  "hero.sending": "Sending…",
  "hero.demoThanks": "Thanks — we'll be in touch shortly to set up your demo.",
  "hero.tabs.quotes.label": "Quotes",
  "hero.tabs.quotes.headline": "Send a professional quote in minutes, not hours",
  "hero.tabs.quotes.body":
    "Build quotes with your own pricing, service categories, and photos — client approves online, no back-and-forth.",
  "hero.tabs.scheduling.label": "Scheduling",
  "hero.tabs.scheduling.headline":
    "Let clients book you directly from your website",
  "hero.tabs.scheduling.body":
    "A booking page that shows your real availability, assigns the right person on your team, and confirms automatically.",
  "hero.tabs.invoicing.label": "Invoicing",
  "hero.tabs.invoicing.headline": "Get paid without chasing anyone down",
  "hero.tabs.invoicing.body":
    "Turn an accepted quote into an invoice with one click, and let clients pay online the moment it lands in their inbox.",
  "hero.tabs.analytics.label": "Analytics",
  "hero.tabs.analytics.headline": "Know what to charge, before you're guessing",
  "hero.tabs.analytics.body":
    "See your real overhead, your minimum price per job, and how you compare to other shops in your trade.",

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

  // Pricing card
  "pricing.popular": "Most popular",
  "pricing.selected": "Selected",
  "pricing.firstMonth": "First month",
  "pricing.then": "Then",
  "pricing.perMonthShort": "/mo",
  "pricing.perLicense": "(${amount}/license)",
  "pricing.seatsUnlimited": "Unlimited employee accounts",
  "pricing.seatsOne": "1 employee account",
  "pricing.seatsMany": "{count} employee accounts",
  "pricing.rbacSeats": "1 master account + {count} RBAC seats",
  "pricing.fullAccess":
    "Full access — quotes, invoicing, scheduling, analytics",
  "pricing.quoteLimit": "Up to {count} quotes per month",
  "pricing.aiIncluded": "AI copilot included",

  // FAQ
  "faq.title": "Frequently asked questions",
  "faq.items.install.q": "Do I need to install anything?",
  "faq.items.install.a":
    "No — FieldQuo runs entirely in your browser. You can also access it from your phone.",
  "faq.items.onlinePayment.q": "Can my clients pay their invoices online?",
  "faq.items.onlinePayment.a":
    "Yes. Connect your own Stripe account and clients can pay directly from the invoice email — the money goes straight to you.",
  "faq.items.permissions.q":
    "Can I control what my employees can see and do?",
  "faq.items.permissions.a":
    "Yes. Every team member has a role — employee, supervisor, or admin — that determines what they can create, assign, and access.",
  "faq.items.trade.q": "What if my trade isn't listed?",
  "faq.items.trade.a":
    "FieldQuo works for any contracting or home service business. You can enable or disable specific service categories and set your own pricing regardless of trade.",
  "faq.items.contract.q": "Is there a contract or long-term commitment?",
  "faq.items.contract.a": "No. Plans are month-to-month — cancel anytime.",

  // Footer
  "footer.product": "Product",
  "footer.company": "Company",
  "footer.legal": "Legal",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.rights": "All rights reserved.",
  "footer.tagline":
    "The all-in-one platform for contractors and home service pros — quotes, scheduling, invoicing, and payments in one place.",
  "footer.links.help": "Help Center",
  "footer.links.faq": "FAQ",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Contact us",
  "footer.links.about": "About",
  "footer.links.careers": "Careers",
  "footer.links.privacy": "Privacy Policy",
  "footer.links.terms": "Terms of Service",

  // Shared
  "common.loading": "Loading…",
  "common.learnMore": "Learn more",
  "common.getStarted": "Get started",
  "common.back": "Back",
};

const fr = {
  "nav.features": "Fonctionnalités",
  "nav.product": "Produit",
  "nav.pricing": "Tarifs",
  "nav.industries": "Secteurs",
  "nav.resources": "Ressources",
  "nav.contact": "Contact",
  "nav.login": "Connexion",
  "nav.signup": "Essai gratuit",
  "nav.dashboard": "Aller au tableau de bord",

  "product.quoting.label": "Soumissions et facturation",
  "product.quoting.description":
    "Préparez et envoyez des soumissions professionnelles en quelques minutes",
  "product.scheduling.label": "Planification et répartition",
  "product.scheduling.description":
    "Réservation en ligne, rendez-vous et attribution des chantiers",
  "product.team.label": "Équipe et paie",
  "product.team.description":
    "Feuilles de temps, versements aux sous-traitants, accès par rôle",
  "product.analytics.label": "Analytique et IA",
  "product.analytics.description":
    "Connaissez vos chiffres — et quoi en faire",

  "hero.title":
    "Soumissions, factures et planification pour les équipes de terrain",
  "hero.subtitle":
    "Préparez une soumission sur place, envoyez-la avant de quitter le stationnement, et faites-vous payer sans relancer personne.",
  "hero.cta": "Essai gratuit",
  "hero.ctaSecondary": "Voir comment ça marche",
  "hero.noCard": "Aucune carte de crédit requise",
  "hero.emailPlaceholder": "vous@votreentreprise.com",
  "hero.requestDemo": "Demander une démo",
  "hero.sending": "Envoi…",
  "hero.demoThanks":
    "Merci — nous vous contacterons sous peu pour organiser votre démo.",
  "hero.tabs.quotes.label": "Soumissions",
  "hero.tabs.quotes.headline":
    "Envoyez une soumission professionnelle en minutes, pas en heures",
  "hero.tabs.quotes.body":
    "Créez des soumissions avec vos propres prix, catégories de services et photos — le client approuve en ligne, sans échanges interminables.",
  "hero.tabs.scheduling.label": "Planification",
  "hero.tabs.scheduling.headline":
    "Laissez vos clients réserver directement depuis votre site",
  "hero.tabs.scheduling.body":
    "Une page de réservation qui affiche vos vraies disponibilités, assigne la bonne personne et confirme automatiquement.",
  "hero.tabs.invoicing.label": "Facturation",
  "hero.tabs.invoicing.headline": "Faites-vous payer sans relancer personne",
  "hero.tabs.invoicing.body":
    "Transformez une soumission acceptée en facture en un clic, et laissez le client payer en ligne dès sa réception.",
  "hero.tabs.analytics.label": "Analytique",
  "hero.tabs.analytics.headline":
    "Sachez quoi facturer, au lieu de deviner",
  "hero.tabs.analytics.body":
    "Voyez vos vrais frais généraux, votre prix minimum par chantier, et votre position face aux autres entreprises de votre métier.",

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

  "pricing.popular": "Le plus populaire",
  "pricing.selected": "Sélectionné",
  "pricing.firstMonth": "Premier mois",
  "pricing.then": "Ensuite",
  "pricing.perMonthShort": "/mois",
  "pricing.perLicense": "({amount} $/licence)",
  "pricing.seatsUnlimited": "Comptes employés illimités",
  "pricing.seatsOne": "1 compte employé",
  "pricing.seatsMany": "{count} comptes employés",
  "pricing.rbacSeats": "1 compte principal + {count} accès par rôle",
  "pricing.fullAccess":
    "Accès complet — soumissions, facturation, planification, analytique",
  "pricing.quoteLimit": "Jusqu'à {count} soumissions par mois",
  "pricing.aiIncluded": "Copilote IA inclus",

  "faq.title": "Questions fréquentes",
  "faq.items.install.q": "Dois-je installer quelque chose?",
  "faq.items.install.a":
    "Non — FieldQuo fonctionne entièrement dans votre navigateur. Vous pouvez aussi y accéder depuis votre téléphone.",
  "faq.items.onlinePayment.q":
    "Mes clients peuvent-ils payer leurs factures en ligne?",
  "faq.items.onlinePayment.a":
    "Oui. Connectez votre propre compte Stripe et vos clients paient directement depuis le courriel de facture — l'argent vous revient directement.",
  "faq.items.permissions.q":
    "Puis-je contrôler ce que mes employés voient et font?",
  "faq.items.permissions.a":
    "Oui. Chaque membre de l'équipe a un rôle — employé, superviseur ou administrateur — qui détermine ce qu'il peut créer, assigner et consulter.",
  "faq.items.trade.q": "Et si mon métier n'est pas dans la liste?",
  "faq.items.trade.a":
    "FieldQuo convient à toute entreprise de construction ou de services à domicile. Vous pouvez activer ou désactiver des catégories de services et fixer vos propres prix, peu importe le métier.",
  "faq.items.contract.q": "Y a-t-il un contrat ou un engagement à long terme?",
  "faq.items.contract.a":
    "Non. Les forfaits sont mensuels — annulez quand vous voulez.",

  "footer.product": "Produit",
  "footer.company": "Entreprise",
  "footer.legal": "Légal",
  "footer.privacy": "Confidentialité",
  "footer.terms": "Conditions",
  "footer.rights": "Tous droits réservés.",
  "footer.tagline":
    "La plateforme tout-en-un pour les entrepreneurs et les services à domicile — soumissions, planification, facturation et paiements au même endroit.",
  "footer.links.help": "Centre d'aide",
  "footer.links.faq": "FAQ",
  "footer.links.blog": "Blogue",
  "footer.links.contact": "Nous joindre",
  "footer.links.about": "À propos",
  "footer.links.careers": "Carrières",
  "footer.links.privacy": "Politique de confidentialité",
  "footer.links.terms": "Conditions d'utilisation",

  "common.loading": "Chargement…",
  "common.learnMore": "En savoir plus",
  "common.getStarted": "Commencer",
  "common.back": "Retour",
};

const es = {
  "nav.features": "Funciones",
  "nav.product": "Producto",
  "nav.pricing": "Precios",
  "nav.industries": "Sectores",
  "nav.resources": "Recursos",
  "nav.contact": "Contacto",
  "nav.login": "Iniciar sesión",
  "nav.signup": "Prueba gratis",
  "nav.dashboard": "Ir al panel",

  "product.quoting.label": "Presupuestos y facturación",
  "product.quoting.description":
    "Arma y envía presupuestos profesionales en minutos",
  "product.scheduling.label": "Agenda y despacho",
  "product.scheduling.description":
    "Reservas en línea, citas y asignación de trabajos",
  "product.team.label": "Equipo y nómina",
  "product.team.description":
    "Hojas de horas, pagos a contratistas, accesos por rol",
  "product.analytics.label": "Analítica e IA",
  "product.analytics.description": "Conoce tus números — y qué hacer con ellos",

  "hero.title":
    "Presupuestos, facturas y agenda para equipos de servicio en campo",
  "hero.subtitle":
    "Arma el presupuesto en el sitio, envíalo antes de salir, y cobra sin tener que perseguir a nadie.",
  "hero.cta": "Prueba gratis",
  "hero.ctaSecondary": "Ver cómo funciona",
  "hero.noCard": "No se requiere tarjeta",
  "hero.emailPlaceholder": "tu@tuempresa.com",
  "hero.requestDemo": "Solicitar una demo",
  "hero.sending": "Enviando…",
  "hero.demoThanks":
    "Gracias — te contactaremos pronto para coordinar tu demo.",
  "hero.tabs.quotes.label": "Presupuestos",
  "hero.tabs.quotes.headline":
    "Envía un presupuesto profesional en minutos, no en horas",
  "hero.tabs.quotes.body":
    "Arma presupuestos con tus propios precios, categorías de servicio y fotos — el cliente aprueba en línea, sin idas y vueltas.",
  "hero.tabs.scheduling.label": "Agenda",
  "hero.tabs.scheduling.headline":
    "Deja que los clientes te reserven desde tu sitio web",
  "hero.tabs.scheduling.body":
    "Una página de reservas que muestra tu disponibilidad real, asigna a la persona correcta de tu equipo y confirma automáticamente.",
  "hero.tabs.invoicing.label": "Facturación",
  "hero.tabs.invoicing.headline": "Cobra sin tener que perseguir a nadie",
  "hero.tabs.invoicing.body":
    "Convierte un presupuesto aprobado en factura con un clic, y deja que el cliente pague en línea apenas lo recibe.",
  "hero.tabs.analytics.label": "Analítica",
  "hero.tabs.analytics.headline": "Sabe cuánto cobrar, en vez de adivinar",
  "hero.tabs.analytics.body":
    "Ve tus gastos reales, tu precio mínimo por trabajo, y cómo te comparas con otros negocios de tu oficio.",

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

  "pricing.popular": "Más popular",
  "pricing.selected": "Seleccionado",
  "pricing.firstMonth": "Primer mes",
  "pricing.then": "Luego",
  "pricing.perMonthShort": "/mes",
  "pricing.perLicense": "(${amount}/licencia)",
  "pricing.seatsUnlimited": "Cuentas de empleado ilimitadas",
  "pricing.seatsOne": "1 cuenta de empleado",
  "pricing.seatsMany": "{count} cuentas de empleado",
  "pricing.rbacSeats": "1 cuenta principal + {count} accesos por rol",
  "pricing.fullAccess":
    "Acceso completo — presupuestos, facturación, agenda, analítica",
  "pricing.quoteLimit": "Hasta {count} presupuestos por mes",
  "pricing.aiIncluded": "Copiloto de IA incluido",

  "faq.title": "Preguntas frecuentes",
  "faq.items.install.q": "¿Necesito instalar algo?",
  "faq.items.install.a":
    "No — FieldQuo funciona completamente en tu navegador. También puedes usarlo desde tu teléfono.",
  "faq.items.onlinePayment.q": "¿Mis clientes pueden pagar en línea?",
  "faq.items.onlinePayment.a":
    "Sí. Conecta tu propia cuenta de Stripe y tus clientes pagan directamente desde el correo de la factura — el dinero llega directo a ti.",
  "faq.items.permissions.q":
    "¿Puedo controlar lo que ven y hacen mis empleados?",
  "faq.items.permissions.a":
    "Sí. Cada miembro del equipo tiene un rol — empleado, supervisor o administrador — que determina lo que puede crear, asignar y consultar.",
  "faq.items.trade.q": "¿Y si mi oficio no aparece en la lista?",
  "faq.items.trade.a":
    "FieldQuo sirve para cualquier negocio de contratación o servicios a domicilio. Puedes activar o desactivar categorías de servicio y fijar tus propios precios, sea cual sea tu oficio.",
  "faq.items.contract.q": "¿Hay contrato o compromiso a largo plazo?",
  "faq.items.contract.a":
    "No. Los planes son mes a mes — cancela cuando quieras.",

  "footer.product": "Producto",
  "footer.company": "Empresa",
  "footer.legal": "Legal",
  "footer.privacy": "Privacidad",
  "footer.terms": "Términos",
  "footer.rights": "Todos los derechos reservados.",
  "footer.tagline":
    "La plataforma todo en uno para contratistas y servicios a domicilio — presupuestos, agenda, facturación y pagos en un solo lugar.",
  "footer.links.help": "Centro de ayuda",
  "footer.links.faq": "Preguntas frecuentes",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Contáctanos",
  "footer.links.about": "Acerca de",
  "footer.links.careers": "Empleo",
  "footer.links.privacy": "Política de privacidad",
  "footer.links.terms": "Términos del servicio",

  "common.loading": "Cargando…",
  "common.learnMore": "Saber más",
  "common.getStarted": "Comenzar",
  "common.back": "Atrás",
};

const uk = {
  "nav.features": "Можливості",
  "nav.product": "Продукт",
  "nav.pricing": "Ціни",
  "nav.industries": "Галузі",
  "nav.resources": "Ресурси",
  "nav.contact": "Контакти",
  "nav.login": "Увійти",
  "nav.signup": "Безкоштовна пробна версія",
  "nav.dashboard": "До панелі керування",

  "product.quoting.label": "Кошториси та рахунки",
  "product.quoting.description":
    "Створюйте та надсилайте професійні кошториси за хвилини",
  "product.scheduling.label": "Планування та розподіл",
  "product.scheduling.description":
    "Онлайн-бронювання, зустрічі та призначення робіт",
  "product.team.label": "Команда та зарплата",
  "product.team.description":
    "Табелі, виплати підрядникам, доступ за ролями",
  "product.analytics.label": "Аналітика та ШІ",
  "product.analytics.description": "Знайте свої цифри — і що з ними робити",

  "hero.title":
    "Кошториси, рахунки та планування для виїзних бригад",
  "hero.subtitle":
    "Складіть кошторис на місці, надішліть його ще до від'їзду та отримайте оплату без нагадувань.",
  "hero.cta": "Почати безкоштовно",
  "hero.ctaSecondary": "Як це працює",
  "hero.noCard": "Картка не потрібна",
  "hero.emailPlaceholder": "ви@вашакомпанія.com",
  "hero.requestDemo": "Замовити демо",
  "hero.sending": "Надсилання…",
  "hero.demoThanks":
    "Дякуємо — ми зв'яжемося з вами найближчим часом, щоб домовитися про демо.",
  "hero.tabs.quotes.label": "Кошториси",
  "hero.tabs.quotes.headline":
    "Надсилайте професійний кошторис за хвилини, а не години",
  "hero.tabs.quotes.body":
    "Складайте кошториси з власними цінами, категоріями послуг і фото — клієнт затверджує онлайн, без нескінченного листування.",
  "hero.tabs.scheduling.label": "Планування",
  "hero.tabs.scheduling.headline":
    "Дозвольте клієнтам бронювати вас прямо з вашого сайту",
  "hero.tabs.scheduling.body":
    "Сторінка бронювання показує вашу реальну доступність, призначає потрібного працівника та підтверджує автоматично.",
  "hero.tabs.invoicing.label": "Рахунки",
  "hero.tabs.invoicing.headline": "Отримуйте оплату без нагадувань",
  "hero.tabs.invoicing.body":
    "Перетворіть затверджений кошторис на рахунок одним кліком, а клієнт оплатить онлайн щойно отримає його.",
  "hero.tabs.analytics.label": "Аналітика",
  "hero.tabs.analytics.headline": "Знайте, скільки брати, замість здогадок",
  "hero.tabs.analytics.body":
    "Побачте свої реальні накладні витрати, мінімальну ціну за роботу та як ви виглядаєте на тлі інших у вашій галузі.",

  "pricing.popular": "Найпопулярніший",
  "pricing.selected": "Обрано",
  "pricing.firstMonth": "Перший місяць",
  "pricing.then": "Потім",
  "pricing.perMonthShort": "/міс",
  "pricing.perLicense": "({amount} $/ліцензія)",
  "pricing.seatsUnlimited": "Необмежена кількість облікових записів",
  "pricing.seatsOne": "1 обліковий запис працівника",
  "pricing.seatsMany": "Облікових записів працівників: {count}",
  "pricing.rbacSeats": "1 головний обліковий запис + {count} доступів за ролями",
  "pricing.fullAccess":
    "Повний доступ — кошториси, рахунки, планування, аналітика",
  "pricing.quoteLimit": "До {count} кошторисів на місяць",
  "pricing.aiIncluded": "ШІ-помічник включено",

  "faq.title": "Часті запитання",
  "faq.items.install.q": "Чи потрібно щось встановлювати?",
  "faq.items.install.a":
    "Ні — FieldQuo працює повністю у вашому браузері. Ви також можете користуватися ним з телефона.",
  "faq.items.onlinePayment.q": "Чи можуть клієнти оплачувати рахунки онлайн?",
  "faq.items.onlinePayment.a":
    "Так. Підключіть власний обліковий запис Stripe, і клієнти зможуть платити прямо з листа з рахунком — гроші надходять безпосередньо вам.",
  "faq.items.permissions.q":
    "Чи можу я контролювати, що бачать і роблять мої працівники?",
  "faq.items.permissions.a":
    "Так. Кожен член команди має роль — працівник, керівник або адміністратор — яка визначає, що він може створювати, призначати та переглядати.",
  "faq.items.trade.q": "А якщо моєї галузі немає у списку?",
  "faq.items.trade.a":
    "FieldQuo підходить для будь-якого підрядного бізнесу або послуг для дому. Ви можете вмикати чи вимикати категорії послуг і встановлювати власні ціни незалежно від галузі.",
  "faq.items.contract.q": "Чи є контракт або довгострокові зобов'язання?",
  "faq.items.contract.a":
    "Ні. Тарифи помісячні — скасуйте будь-коли.",

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
  "footer.tagline":
    "Універсальна платформа для підрядників і послуг для дому — кошториси, планування, рахунки та оплати в одному місці.",
  "footer.links.help": "Довідковий центр",
  "footer.links.faq": "Часті запитання",
  "footer.links.blog": "Блог",
  "footer.links.contact": "Зв'язатися з нами",
  "footer.links.about": "Про нас",
  "footer.links.careers": "Кар'єра",
  "footer.links.privacy": "Політика конфіденційності",
  "footer.links.terms": "Умови використання",

  "common.loading": "Завантаження…",
  "common.learnMore": "Дізнатися більше",
  "common.getStarted": "Почати",
  "common.back": "Назад",
};

const pa = {
  "nav.features": "ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ",
  "nav.product": "ਉਤਪਾਦ",
  "nav.pricing": "ਕੀਮਤਾਂ",
  "nav.industries": "ਉਦਯੋਗ",
  "nav.resources": "ਸਰੋਤ",
  "nav.contact": "ਸੰਪਰਕ",
  "nav.login": "ਲੌਗ ਇਨ",
  "nav.signup": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼",
  "nav.dashboard": "ਡੈਸ਼ਬੋਰਡ 'ਤੇ ਜਾਓ",

  "product.quoting.label": "ਕੋਟ ਅਤੇ ਇਨਵੌਇਸਿੰਗ",
  "product.quoting.description":
    "ਮਿੰਟਾਂ ਵਿੱਚ ਪੇਸ਼ੇਵਰ ਕੋਟ ਬਣਾਓ ਅਤੇ ਭੇਜੋ",
  "product.scheduling.label": "ਸ਼ਡਿਊਲਿੰਗ ਅਤੇ ਡਿਸਪੈਚ",
  "product.scheduling.description":
    "ਆਨਲਾਈਨ ਬੁਕਿੰਗ, ਮੁਲਾਕਾਤਾਂ ਅਤੇ ਕੰਮ ਦੀ ਵੰਡ",
  "product.team.label": "ਟੀਮ ਅਤੇ ਪੇਰੋਲ",
  "product.team.description":
    "ਟਾਈਮਸ਼ੀਟਾਂ, ਠੇਕੇਦਾਰਾਂ ਦੀ ਅਦਾਇਗੀ, ਭੂਮਿਕਾ ਅਨੁਸਾਰ ਪਹੁੰਚ",
  "product.analytics.label": "ਵਿਸ਼ਲੇਸ਼ਣ ਅਤੇ AI",
  "product.analytics.description":
    "ਆਪਣੇ ਅੰਕੜੇ ਜਾਣੋ — ਅਤੇ ਉਨ੍ਹਾਂ ਨਾਲ ਕੀ ਕਰਨਾ ਹੈ",

  "hero.title": "ਫ਼ੀਲਡ ਸਰਵਿਸ ਟੀਮਾਂ ਲਈ ਕੋਟ, ਇਨਵੌਇਸ ਅਤੇ ਸ਼ਡਿਊਲਿੰਗ",
  "hero.subtitle":
    "ਮੌਕੇ 'ਤੇ ਕੋਟ ਬਣਾਓ, ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਭੇਜੋ, ਅਤੇ ਕਿਸੇ ਦੇ ਪਿੱਛੇ ਪਏ ਬਿਨਾਂ ਭੁਗਤਾਨ ਲਵੋ।",
  "hero.cta": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼ ਸ਼ੁਰੂ ਕਰੋ",
  "hero.ctaSecondary": "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
  "hero.noCard": "ਕ੍ਰੈਡਿਟ ਕਾਰਡ ਦੀ ਲੋੜ ਨਹੀਂ",
  "hero.emailPlaceholder": "tuhada@tuhadikampani.com",
  "hero.requestDemo": "ਡੈਮੋ ਮੰਗੋ",
  "hero.sending": "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  "hero.demoThanks":
    "ਧੰਨਵਾਦ — ਅਸੀਂ ਤੁਹਾਡਾ ਡੈਮੋ ਤੈਅ ਕਰਨ ਲਈ ਜਲਦੀ ਸੰਪਰਕ ਕਰਾਂਗੇ।",
  "hero.tabs.quotes.label": "ਕੋਟ",
  "hero.tabs.quotes.headline":
    "ਘੰਟਿਆਂ ਵਿੱਚ ਨਹੀਂ, ਮਿੰਟਾਂ ਵਿੱਚ ਪੇਸ਼ੇਵਰ ਕੋਟ ਭੇਜੋ",
  "hero.tabs.quotes.body":
    "ਆਪਣੀਆਂ ਕੀਮਤਾਂ, ਸੇਵਾ ਸ਼੍ਰੇਣੀਆਂ ਅਤੇ ਫ਼ੋਟੋਆਂ ਨਾਲ ਕੋਟ ਬਣਾਓ — ਗਾਹਕ ਆਨਲਾਈਨ ਮਨਜ਼ੂਰੀ ਦਿੰਦਾ ਹੈ, ਵਾਰ-ਵਾਰ ਗੱਲਬਾਤ ਦੀ ਲੋੜ ਨਹੀਂ।",
  "hero.tabs.scheduling.label": "ਸ਼ਡਿਊਲਿੰਗ",
  "hero.tabs.scheduling.headline":
    "ਗਾਹਕਾਂ ਨੂੰ ਸਿੱਧਾ ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ ਤੋਂ ਬੁਕਿੰਗ ਕਰਨ ਦਿਓ",
  "hero.tabs.scheduling.body":
    "ਇੱਕ ਬੁਕਿੰਗ ਪੰਨਾ ਜੋ ਤੁਹਾਡੀ ਅਸਲ ਉਪਲਬਧਤਾ ਦਿਖਾਉਂਦਾ ਹੈ, ਸਹੀ ਟੀਮ ਮੈਂਬਰ ਨੂੰ ਸੌਂਪਦਾ ਹੈ, ਅਤੇ ਆਪਣੇ-ਆਪ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ।",
  "hero.tabs.invoicing.label": "ਇਨਵੌਇਸਿੰਗ",
  "hero.tabs.invoicing.headline": "ਕਿਸੇ ਦੇ ਪਿੱਛੇ ਪਏ ਬਿਨਾਂ ਭੁਗਤਾਨ ਲਵੋ",
  "hero.tabs.invoicing.body":
    "ਮਨਜ਼ੂਰ ਕੋਟ ਨੂੰ ਇੱਕ ਕਲਿੱਕ ਵਿੱਚ ਇਨਵੌਇਸ ਬਣਾਓ, ਅਤੇ ਗਾਹਕ ਇਨਬਾਕਸ ਵਿੱਚ ਪਹੁੰਚਦੇ ਹੀ ਆਨਲਾਈਨ ਭੁਗਤਾਨ ਕਰ ਸਕਦਾ ਹੈ।",
  "hero.tabs.analytics.label": "ਵਿਸ਼ਲੇਸ਼ਣ",
  "hero.tabs.analytics.headline": "ਅੰਦਾਜ਼ਾ ਲਗਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਜਾਣੋ ਕਿ ਕੀ ਵਸੂਲਣਾ ਹੈ",
  "hero.tabs.analytics.body":
    "ਆਪਣਾ ਅਸਲ ਖਰਚਾ, ਹਰ ਕੰਮ ਲਈ ਘੱਟੋ-ਘੱਟ ਕੀਮਤ, ਅਤੇ ਆਪਣੇ ਖੇਤਰ ਦੀਆਂ ਹੋਰ ਦੁਕਾਨਾਂ ਨਾਲ ਤੁਲਨਾ ਵੇਖੋ।",

  "pricing.popular": "ਸਭ ਤੋਂ ਪ੍ਰਸਿੱਧ",
  "pricing.selected": "ਚੁਣਿਆ ਗਿਆ",
  "pricing.firstMonth": "ਪਹਿਲਾ ਮਹੀਨਾ",
  "pricing.then": "ਫਿਰ",
  "pricing.perMonthShort": "/ਮਹੀਨਾ",
  "pricing.perLicense": "(${amount}/ਲਾਇਸੰਸ)",
  "pricing.seatsUnlimited": "ਅਸੀਮਤ ਕਰਮਚਾਰੀ ਖਾਤੇ",
  "pricing.seatsOne": "1 ਕਰਮਚਾਰੀ ਖਾਤਾ",
  "pricing.seatsMany": "{count} ਕਰਮਚਾਰੀ ਖਾਤੇ",
  "pricing.rbacSeats": "1 ਮੁੱਖ ਖਾਤਾ + {count} ਭੂਮਿਕਾ-ਆਧਾਰਿਤ ਪਹੁੰਚਾਂ",
  "pricing.fullAccess":
    "ਪੂਰੀ ਪਹੁੰਚ — ਕੋਟ, ਇਨਵੌਇਸਿੰਗ, ਸ਼ਡਿਊਲਿੰਗ, ਵਿਸ਼ਲੇਸ਼ਣ",
  "pricing.quoteLimit": "ਹਰ ਮਹੀਨੇ {count} ਕੋਟ ਤੱਕ",
  "pricing.aiIncluded": "AI ਸਹਾਇਕ ਸ਼ਾਮਲ",

  "faq.title": "ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ",
  "faq.items.install.q": "ਕੀ ਮੈਨੂੰ ਕੁਝ ਇੰਸਟਾਲ ਕਰਨਾ ਪਵੇਗਾ?",
  "faq.items.install.a":
    "ਨਹੀਂ — FieldQuo ਪੂਰੀ ਤਰ੍ਹਾਂ ਤੁਹਾਡੇ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਚੱਲਦਾ ਹੈ। ਤੁਸੀਂ ਇਸਨੂੰ ਆਪਣੇ ਫ਼ੋਨ ਤੋਂ ਵੀ ਵਰਤ ਸਕਦੇ ਹੋ।",
  "faq.items.onlinePayment.q": "ਕੀ ਮੇਰੇ ਗਾਹਕ ਆਨਲਾਈਨ ਭੁਗਤਾਨ ਕਰ ਸਕਦੇ ਹਨ?",
  "faq.items.onlinePayment.a":
    "ਹਾਂ। ਆਪਣਾ Stripe ਖਾਤਾ ਜੋੜੋ ਅਤੇ ਗਾਹਕ ਸਿੱਧਾ ਇਨਵੌਇਸ ਈਮੇਲ ਤੋਂ ਭੁਗਤਾਨ ਕਰ ਸਕਦੇ ਹਨ — ਪੈਸੇ ਸਿੱਧੇ ਤੁਹਾਨੂੰ ਜਾਂਦੇ ਹਨ।",
  "faq.items.permissions.q":
    "ਕੀ ਮੈਂ ਕੰਟਰੋਲ ਕਰ ਸਕਦਾ ਹਾਂ ਕਿ ਮੇਰੇ ਕਰਮਚਾਰੀ ਕੀ ਵੇਖਣ ਤੇ ਕਰਨ?",
  "faq.items.permissions.a":
    "ਹਾਂ। ਹਰ ਟੀਮ ਮੈਂਬਰ ਦੀ ਇੱਕ ਭੂਮਿਕਾ ਹੁੰਦੀ ਹੈ — ਕਰਮਚਾਰੀ, ਸੁਪਰਵਾਈਜ਼ਰ ਜਾਂ ਐਡਮਿਨ — ਜੋ ਤੈਅ ਕਰਦੀ ਹੈ ਕਿ ਉਹ ਕੀ ਬਣਾ, ਸੌਂਪ ਅਤੇ ਵੇਖ ਸਕਦਾ ਹੈ।",
  "faq.items.trade.q": "ਜੇ ਮੇਰਾ ਕੰਮ ਸੂਚੀ ਵਿੱਚ ਨਾ ਹੋਵੇ ਤਾਂ?",
  "faq.items.trade.a":
    "FieldQuo ਕਿਸੇ ਵੀ ਠੇਕੇਦਾਰੀ ਜਾਂ ਘਰੇਲੂ ਸੇਵਾ ਕਾਰੋਬਾਰ ਲਈ ਕੰਮ ਕਰਦਾ ਹੈ। ਤੁਸੀਂ ਸੇਵਾ ਸ਼੍ਰੇਣੀਆਂ ਚਾਲੂ ਜਾਂ ਬੰਦ ਕਰ ਸਕਦੇ ਹੋ ਅਤੇ ਆਪਣੀਆਂ ਕੀਮਤਾਂ ਤੈਅ ਕਰ ਸਕਦੇ ਹੋ।",
  "faq.items.contract.q": "ਕੀ ਕੋਈ ਇਕਰਾਰਨਾਮਾ ਜਾਂ ਲੰਮੀ ਵਚਨਬੱਧਤਾ ਹੈ?",
  "faq.items.contract.a":
    "ਨਹੀਂ। ਪਲਾਨ ਮਹੀਨਾਵਾਰ ਹਨ — ਕਿਸੇ ਵੀ ਵੇਲੇ ਰੱਦ ਕਰੋ।",

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
  "footer.tagline":
    "ਠੇਕੇਦਾਰਾਂ ਅਤੇ ਘਰੇਲੂ ਸੇਵਾ ਪੇਸ਼ੇਵਰਾਂ ਲਈ ਸਭ-ਇੱਕ-ਥਾਂ ਪਲੇਟਫਾਰਮ — ਕੋਟ, ਸ਼ਡਿਊਲਿੰਗ, ਇਨਵੌਇਸਿੰਗ ਅਤੇ ਭੁਗਤਾਨ ਇੱਕੋ ਥਾਂ।",
  "footer.links.help": "ਮਦਦ ਕੇਂਦਰ",
  "footer.links.faq": "ਅਕਸਰ ਪੁੱਛੇ ਸਵਾਲ",
  "footer.links.blog": "ਬਲੌਗ",
  "footer.links.contact": "ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ",
  "footer.links.about": "ਸਾਡੇ ਬਾਰੇ",
  "footer.links.careers": "ਨੌਕਰੀਆਂ",
  "footer.links.privacy": "ਪਰਦੇਦਾਰੀ ਨੀਤੀ",
  "footer.links.terms": "ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ",

  "common.loading": "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
  "common.learnMore": "ਹੋਰ ਜਾਣੋ",
  "common.getStarted": "ਸ਼ੁਰੂ ਕਰੋ",
  "common.back": "ਵਾਪਸ",
};

const tl = {
  "nav.features": "Mga Feature",
  "nav.product": "Produkto",
  "nav.pricing": "Presyo",
  "nav.industries": "Mga Industriya",
  "nav.resources": "Mga Resource",
  "nav.contact": "Kontak",
  "nav.login": "Mag-log in",
  "nav.signup": "Libreng subok",
  "nav.dashboard": "Pumunta sa dashboard",

  "product.quoting.label": "Quotes at Invoicing",
  "product.quoting.description":
    "Gumawa at magpadala ng propesyonal na quote sa loob ng ilang minuto",
  "product.scheduling.label": "Scheduling at Dispatch",
  "product.scheduling.description":
    "Online na booking, appointment, at pag-assign ng trabaho",
  "product.team.label": "Team at Payroll",
  "product.team.description":
    "Timesheet, bayad sa contractor, access ayon sa role",
  "product.analytics.label": "Analytics at AI",
  "product.analytics.description":
    "Alamin ang iyong mga numero — at kung ano ang gagawin dito",

  "hero.title":
    "Mga quote, invoice at scheduling para sa field service teams",
  "hero.subtitle":
    "Gumawa ng quote sa site, ipadala bago ka pa umalis, at mabayaran nang hindi na kailangang manghabol.",
  "hero.cta": "Simulan ang libreng subok",
  "hero.ctaSecondary": "Tingnan kung paano ito gumagana",
  "hero.noCard": "Walang kailangang credit card",
  "hero.emailPlaceholder": "ikaw@iyongkompanya.com",
  "hero.requestDemo": "Humiling ng demo",
  "hero.sending": "Ipinapadala…",
  "hero.demoThanks":
    "Salamat — makikipag-ugnayan kami agad para ayusin ang iyong demo.",
  "hero.tabs.quotes.label": "Mga Quote",
  "hero.tabs.quotes.headline":
    "Magpadala ng propesyonal na quote sa minuto, hindi oras",
  "hero.tabs.quotes.body":
    "Gumawa ng quote gamit ang sarili mong presyo, kategorya ng serbisyo at litrato — inaaprubahan ito online ng kliyente, walang paulit-ulit na usapan.",
  "hero.tabs.scheduling.label": "Scheduling",
  "hero.tabs.scheduling.headline":
    "Hayaang mag-book ang kliyente diretso mula sa iyong website",
  "hero.tabs.scheduling.body":
    "Isang booking page na nagpapakita ng totoo mong availability, nag-a-assign ng tamang tao sa team, at kusang nagkukumpirma.",
  "hero.tabs.invoicing.label": "Invoicing",
  "hero.tabs.invoicing.headline": "Mabayaran nang hindi na manghahabol",
  "hero.tabs.invoicing.body":
    "Gawing invoice ang aprubadong quote sa isang click, at makakabayad online ang kliyente sa oras na dumating ito sa inbox nila.",
  "hero.tabs.analytics.label": "Analytics",
  "hero.tabs.analytics.headline":
    "Alamin kung magkano ang sisingilin, bago ka manghula",
  "hero.tabs.analytics.body":
    "Tingnan ang totoong gastos mo, ang pinakamababang presyo bawat trabaho, at kung paano ka kumpara sa ibang negosyo sa larangan mo.",

  "pricing.popular": "Pinakasikat",
  "pricing.selected": "Napili",
  "pricing.firstMonth": "Unang buwan",
  "pricing.then": "Pagkatapos",
  "pricing.perMonthShort": "/buwan",
  "pricing.perLicense": "(${amount}/lisensya)",
  "pricing.seatsUnlimited": "Walang limitasyong employee account",
  "pricing.seatsOne": "1 employee account",
  "pricing.seatsMany": "{count} na employee account",
  "pricing.rbacSeats": "1 master account + {count} na RBAC seat",
  "pricing.fullAccess":
    "Buong access — quotes, invoicing, scheduling, analytics",
  "pricing.quoteLimit": "Hanggang {count} na quote bawat buwan",
  "pricing.aiIncluded": "Kasama ang AI copilot",

  "faq.title": "Mga madalas itanong",
  "faq.items.install.q": "Kailangan ko bang mag-install ng kahit ano?",
  "faq.items.install.a":
    "Hindi — gumagana ang FieldQuo nang buo sa iyong browser. Magagamit mo rin ito sa telepono.",
  "faq.items.onlinePayment.q":
    "Puwede bang magbayad online ang mga kliyente ko?",
  "faq.items.onlinePayment.a":
    "Oo. Ikonekta ang sarili mong Stripe account at makakabayad ang kliyente diretso mula sa invoice email — diretso sa iyo ang pera.",
  "faq.items.permissions.q":
    "Makokontrol ko ba kung ano ang nakikita at ginagawa ng mga empleyado ko?",
  "faq.items.permissions.a":
    "Oo. May role ang bawat miyembro ng team — employee, supervisor o admin — na nagtatakda kung ano ang puwede nilang gawin, i-assign at makita.",
  "faq.items.trade.q": "Paano kung wala sa listahan ang trabaho ko?",
  "faq.items.trade.a":
    "Gumagana ang FieldQuo para sa anumang contracting o home service na negosyo. Puwede mong buksan o isara ang mga kategorya ng serbisyo at itakda ang sarili mong presyo.",
  "faq.items.contract.q": "May kontrata ba o pangmatagalang commitment?",
  "faq.items.contract.a":
    "Wala. Buwan-buwan ang mga plano — puwedeng kanselahin anumang oras.",

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
  "footer.tagline":
    "Ang all-in-one platform para sa mga contractor at home service pro — quotes, scheduling, invoicing at bayad sa iisang lugar.",
  "footer.links.help": "Help Center",
  "footer.links.faq": "Mga madalas itanong",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Makipag-ugnayan",
  "footer.links.about": "Tungkol sa amin",
  "footer.links.careers": "Mga trabaho",
  "footer.links.privacy": "Patakaran sa privacy",
  "footer.links.terms": "Mga tuntunin ng serbisyo",

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
