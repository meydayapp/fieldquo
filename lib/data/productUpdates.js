// lib/data/productUpdates.js
//
// The changelog shown at /app/settings/product-updates. Hardcoded on purpose:
// it is written by us, changes when we deploy, and is identical for every
// tenant — a Prisma model would mean a migration and an admin screen to
// maintain content that already ships with the code.
//
// ── Shape ───────────────────────────────────────────────────────────────────
//
//   date   ISO day. Newest first; the list does not sort, it prints.
//   title  One line, in the list and as the <h1> of the post.
//   body   The summary. Always shown. Must stand alone — most entries never
//          get a longer write-up and must still read as a complete note.
//   slug   Optional. URL segment for the full post.
//   post   Optional. Array of paragraphs, rendered at
//          /app/settings/product-updates/<slug>.
//
// slug and post are a pair. An entry with one and not the other is a dead
// link or an unreachable page, so `hasPost()` requires both and the list only
// renders "Read the full update" when it returns true — the alternative is a
// link that navigates to nothing, which is the failure AGENTS.md is about.
// scripts/check-product-updates.mjs enforces the pairing and slug uniqueness.
//
//   translations  Optional. { <lang>: { title, body, post? } } — the entry in
//          another app language. `t()` still covers the page's chrome; the
//          entries stay out of the message catalogue because they are prose
//          that ships once, not strings a screen reuses.
//
// ── Language ────────────────────────────────────────────────────────────────
//
// This used to be English-only on the reasoning that nobody would keep six
// translations of a changelog current, and a half-translated one is worse than
// an honest English one. The owner then asked for the write-up "in the
// language of the user" (2026-09-24), so an entry MAY now carry translations —
// and the half-translated fear is handled per entry, not by refusing:
// `localizedUpdate()` takes a language's title, body and post TOGETHER or not
// at all. A translation with fewer paragraphs than the English post falls
// back to English whole, never a French title over English paragraphs.
// Entries written before this (the two below the newest) stay English, and
// the Help article says so. scripts/check-product-updates.mjs asserts every
// translation is complete.

export const PRODUCT_UPDATES = [
  {
    date: "2026-09-24",
    slug: "services-checklists-client-portal",
    title: "Services and estimate templates for 24 trades, job checklists, and a client portal",
    body: "Your trade's services now come with preset prices and estimate templates, your crew fills in checklists on the job, and your clients get a portal for their plans, visits and requests. Also new: See the property, Directions, a refreshed tour and a website step at signup.",
    post: [
      "Services for 24 trades. Plumbing, electrical, HVAC, flooring, painting, roofing, gutters, fences, decks, garage doors, cleaning, lawn care, snow removal, tree care and more now come with a full list of services. Each service has a preset price you can change, with the typical low-to-high range beside it as a guide, and many carry an estimate template: the labour, material and other lines the job usually needs.",
      "Signed up before today? Go to Settings › Services & Pricing and press “Add missing services for my trade” under each of your trades. Nothing is added until you press it, and a service you have already renamed or repriced is left exactly as it is. The services then appear among the line items you can add to a quote for that trade, and each one's template is under “Estimate templates” on the same screen, ready to review and adjust.",
      "Checklists for your trade. A checklist item can now be a tick box, text, a number, pick one, pick any, Good / Watch / Problem, a photo or a signature, grouped in sections. Starter lists are written for your trades: Settings › Checklists › “Add the starter checklists for my trades” (the services button above adds them too). A list can be added automatically to new jobs for the services you choose, and can be set so that everything on it must be done before the job can be closed.",
      "Your crew fills the checklists in on the job, in their own language, and the office sees the answers on the job's Checklists card.",
      "A client portal for plans and visits. The link you send a client now shows their next visit with its arrival window, their service plans with the next dates and what is included, and their upcoming and past visits with the photos from each. From it they can ask to reschedule or skip a visit, report an issue with photos, request new work or recurring maintenance, and book the next visit their plan includes. Nothing is booked or changed until you confirm: every request lands in More › Client tickets, where you reply and set the status, and a repair or warranty issue becomes a job in one step. Send the link from a client's page with Copy portal link or Email portal link.",
      "Client login on your website. Switch on “Client login on your website” in Settings › Your website › Fine-tune, and your site's header and footer carry a Client login link. A client enters their email address and receives their own portal link — no passwords.",
      "See the property and Directions. Leads, clients, jobs and quotes have a See the property button that opens a Street View of the front of the house when you tap it, wherever Google has imagery, and your client sees it on their quote too. On a job, Directions opens the route in Google Maps, or in Apple Maps on an Apple device.",
      "A refreshed tour and set-up. The product tour now walks the new menu — press Take the tour on your dashboard to run it again — and each set-up step shows roughly how many minutes it takes. New companies are asked “Do you have a website?” when they sign up; if you don't have one, “Create your website” appears in your set-up steps and opens the website builder.",
    ],
    translations: {
      fr: {
        title: "Services et modèles d'estimation pour 24 métiers, listes de vérification de chantier et portail client",
        body: "Les services de votre métier arrivent maintenant avec des prix préétablis et des modèles d'estimation, votre équipe remplit des listes de vérification sur le chantier, et vos clients ont un portail pour leurs forfaits, leurs visites et leurs demandes. Aussi : Voir la propriété, Itinéraire, une visite guidée refaite et une étape site Web à l'inscription.",
        post: [
          "Des services pour 24 métiers. Plomberie, électricité, CVC, revêtements de sol, peinture, toiture, gouttières, clôtures, terrasses, portes de garage, nettoyage, entretien de pelouse, déneigement, entretien des arbres et plus encore ont maintenant une liste complète de services. Chaque service a un prix préétabli que vous pouvez modifier, avec la fourchette habituelle, du plus bas au plus haut, affichée à côté comme repère, et beaucoup ont un modèle d'estimation : les lignes de main-d'œuvre, de matériaux et autres dont le travail a habituellement besoin.",
          "Inscrit avant aujourd'hui? Allez dans Paramètres › Services et tarifs et appuyez sur « Ajouter les services manquants de mon métier » sous chacun de vos métiers. Rien n'est ajouté tant que vous n'appuyez pas, et un service que vous avez déjà renommé ou dont vous avez changé le prix reste exactement tel quel. Les services apparaissent ensuite parmi les lignes que vous pouvez ajouter à une soumission pour ce métier, et le modèle de chacun se trouve sous « Modèles d'estimation » sur le même écran, prêt à être revu et ajusté.",
          "Des listes de vérification pour votre métier. Un élément peut maintenant être une case à cocher, un texte, un nombre, un choix unique, un choix multiple, Bon / À surveiller / Problème, une photo ou une signature, regroupés en sections. Des listes de départ sont rédigées pour vos métiers : Paramètres › Listes de vérification › « Ajouter les listes de départ de mes métiers » (le bouton des services ci-dessus les ajoute aussi). Une liste peut être ajoutée automatiquement aux nouveaux chantiers des services que vous choisissez, et réglée pour que tout y soit fait avant que le chantier puisse être fermé.",
          "Votre équipe remplit les listes sur le chantier, dans sa propre langue, et le bureau voit les réponses dans la carte Listes de vérification du chantier.",
          "Un portail client pour les forfaits et les visites. Le lien que vous envoyez à un client affiche maintenant sa prochaine visite avec sa plage d'arrivée, ses forfaits d'entretien avec les prochaines dates et ce qui est inclus, et ses visites à venir et passées avec les photos de chacune. Il peut y demander de déplacer ou de sauter une visite, signaler un problème avec photos, demander de nouveaux travaux ou un entretien récurrent, et réserver la prochaine visite incluse dans son forfait. Rien n'est réservé ni modifié avant que vous confirmiez : chaque demande arrive dans Plus › Billets clients, où vous répondez et changez le statut, et un problème de réparation ou de garantie devient un chantier en une étape. Envoyez le lien depuis la fiche du client avec Copier le lien du portail ou Envoyer le lien du portail.",
          "Espace client sur votre site Web. Activez « Espace client sur votre site web » dans Paramètres › Votre site web › Ajuster, et l'en-tête et le pied de page de votre site affichent un lien Espace client. Le client entre son adresse courriel et reçoit son propre lien vers le portail, sans mot de passe.",
          "Voir la propriété et Itinéraire. Les prospects, les clients, les chantiers et les soumissions ont un bouton Voir la propriété qui ouvre une vue Street View de la façade quand vous le touchez, là où Google a des images, et votre client la voit aussi sur sa soumission. Sur un chantier, Itinéraire ouvre le trajet dans Google Maps, ou dans Plans d'Apple sur un appareil Apple.",
          "Une visite guidée et une configuration refaites. La visite guidée parcourt maintenant le nouveau menu — appuyez sur Faire la visite dans votre tableau de bord pour la relancer — et chaque étape de configuration indique à peu près combien de minutes elle prend. Les nouvelles entreprises se font demander « Avez-vous un site Web? » à l'inscription; si vous n'en avez pas, « Créez votre site Web » apparaît dans vos étapes de configuration et ouvre le créateur de site.",
        ],
      },
      es: {
        title: "Servicios y plantillas de presupuesto para 24 oficios, listas de verificación de trabajo y un portal para clientes",
        body: "Los servicios de tu oficio ahora vienen con precios predefinidos y plantillas de presupuesto, tu equipo llena listas de verificación en el trabajo y tus clientes tienen un portal para sus planes, visitas y solicitudes. Además: Ver la propiedad, Cómo llegar, un recorrido renovado y un paso de sitio web al registrarte.",
        post: [
          "Servicios para 24 oficios. Plomería, electricidad, climatización, pisos, pintura, techos, canaletas, cercas, terrazas, puertas de garaje, limpieza, cuidado del césped, remoción de nieve, cuidado de árboles y más ahora traen una lista completa de servicios. Cada servicio tiene un precio predefinido que puedes cambiar, con el rango típico de bajo a alto al lado como guía, y muchos traen una plantilla de presupuesto: las líneas de mano de obra, materiales y otras que el trabajo suele necesitar.",
          "¿Te registraste antes de hoy? Ve a Configuración › Servicios y precios y pulsa «Agregar los servicios que faltan para mi oficio» debajo de cada uno de tus oficios. No se agrega nada hasta que lo pulses, y un servicio al que ya le cambiaste el nombre o el precio queda exactamente como está. Los servicios aparecen entonces entre las líneas que puedes agregar a un presupuesto de ese oficio, y la plantilla de cada uno está en «Plantillas de presupuesto» en la misma pantalla, lista para revisar y ajustar.",
          "Listas de verificación para tu oficio. Un elemento ahora puede ser una casilla, un texto, un número, elegir uno, elegir varios, Bien / Vigilar / Problema, una foto o una firma, agrupados en secciones. Hay listas iniciales escritas para tus oficios: Configuración › Listas de verificación › «Agregar las listas iniciales de mis oficios» (el botón de servicios de arriba también las agrega). Una lista puede agregarse automáticamente a los trabajos nuevos de los servicios que elijas, y configurarse para que todo en ella deba estar hecho antes de poder cerrar el trabajo.",
          "Tu equipo llena las listas en el trabajo, en su propio idioma, y la oficina ve las respuestas en la tarjeta Listas de verificación del trabajo.",
          "Un portal para clientes con planes y visitas. El enlace que le envías a un cliente ahora muestra su próxima visita con su franja de llegada, sus planes de servicio con las próximas fechas y lo que incluyen, y sus visitas próximas y pasadas con las fotos de cada una. Desde ahí puede pedir cambiar o saltar una visita, informar un problema con fotos, solicitar trabajo nuevo o mantenimiento recurrente, y reservar la próxima visita incluida en su plan. No se reserva ni se cambia nada hasta que tú lo confirmes: cada solicitud llega a Más › Tickets de clientes, donde respondes y cambias el estado, y un problema de reparación o garantía se convierte en trabajo en un paso. Envía el enlace desde la página del cliente con Copiar enlace del portal o Enviar enlace del portal.",
          "Acceso de clientes en tu sitio web. Activa «Acceso de clientes en su sitio web» en Configuración › Tu sitio web › Ajustar, y el encabezado y el pie de tu sitio muestran un enlace de Acceso de clientes. El cliente escribe su correo y recibe su propio enlace al portal, sin contraseñas.",
          "Ver la propiedad y Cómo llegar. Los prospectos, clientes, trabajos y presupuestos tienen un botón Ver la propiedad que abre una vista de Street View del frente de la casa cuando lo tocas, donde Google tenga imágenes, y tu cliente también la ve en su presupuesto. En un trabajo, Cómo llegar abre la ruta en Google Maps, o en Mapas de Apple en un dispositivo Apple.",
          "Un recorrido y una configuración renovados. El recorrido del producto ahora pasa por el nuevo menú —pulsa Hacer el recorrido en tu panel para verlo otra vez— y cada paso de configuración muestra más o menos cuántos minutos toma. A las empresas nuevas se les pregunta «¿Tienes sitio web?» al registrarse; si no tienes, «Crea tu sitio web» aparece en tus pasos de configuración y abre el creador de sitios.",
        ],
      },
      uk: {
        title: "Послуги й шаблони кошторисів для 24 галузей, контрольні списки робіт і клієнтський портал",
        body: "Послуги вашої галузі тепер мають готові ціни й шаблони кошторисів, ваша бригада заповнює контрольні списки на об'єкті, а ваші клієнти отримують портал для своїх планів, візитів і запитів. Також нове: перегляд об'єкта, маршрут, оновлена екскурсія і крок про вебсайт під час реєстрації.",
        post: [
          "Послуги для 24 галузей. Сантехніка, електрика, опалення й кондиціювання, підлога, фарбування, покрівля, водостоки, паркани, тераси, гаражні ворота, прибирання, догляд за газоном, прибирання снігу, догляд за деревами та інше тепер мають повний перелік послуг. Кожна послуга має готову ціну, яку ви можете змінити, з типовим діапазоном від низької до високої поруч як орієнтиром, а багато з них мають шаблон кошторису: рядки роботи, матеріалів та інші, які зазвичай потрібні для такої роботи.",
          "Зареєструвалися раніше? Відкрийте Налаштування › Послуги та ціни й натисніть «Додати відсутні послуги для моєї галузі» під кожною своєю галуззю. Нічого не додається, доки ви не натиснете, а послуга, яку ви вже перейменували чи змінили їй ціну, залишається точно такою, як є. Після цього послуги з'являються серед рядків, які можна додати до кошторису для цієї галузі, а шаблон кожної — у розділі «Шаблони кошторисів» на тому самому екрані, готовий до перегляду й змін.",
          "Контрольні списки для вашої галузі. Пункт списку тепер може бути позначкою, текстом, числом, вибором одного, вибором кількох, Добре / Стежити / Проблема, фото або підписом, згрупованими в розділи. Стартові списки написано для ваших галузей: Налаштування › Контрольні списки › «Додати стартові списки для моїх ремесел» (кнопка послуг вище теж їх додає). Список можна автоматично додавати до нових робіт для вибраних послуг і налаштувати так, щоб усе в ньому було виконано, перш ніж роботу можна закрити.",
          "Бригада заповнює списки на об'єкті своєю мовою, а офіс бачить відповіді на картці «Контрольні списки» цієї роботи.",
          "Клієнтський портал для планів і візитів. Посилання, яке ви надсилаєте клієнту, тепер показує його наступний візит із вікном прибуття, його плани обслуговування з наступними датами й тим, що до них входить, а також майбутні й минулі візити з фото кожного. Звідти клієнт може попросити перенести чи пропустити візит, повідомити про проблему з фото, замовити нову роботу чи регулярне обслуговування і забронювати наступний візит, що входить у його план. Нічого не бронюється і не змінюється, доки ви не підтвердите: кожен запит потрапляє в Більше › Звернення клієнтів, де ви відповідаєте й змінюєте статус, а проблема з ремонтом чи гарантією стає роботою за один крок. Надішліть посилання зі сторінки клієнта кнопкою «Копіювати посилання на портал» або «Надіслати посилання на портал».",
          "Вхід для клієнтів на вашому сайті. Увімкніть «Вхід для клієнтів на вашому сайті» в Налаштування › Ваш вебсайт › Тонке налаштування, і в шапці та підвалі сайту з'явиться посилання для входу клієнтів. Клієнт вводить свою електронну адресу й отримує власне посилання на портал — без паролів.",
          "Перегляд об'єкта і маршрут. Ліди, клієнти, роботи й кошториси мають кнопку «Переглянути об'єкт», яка після натискання відкриває Street View фасаду будинку, якщо в Google є знімки, і ваш клієнт бачить її у своєму кошторисі. У роботі кнопка «Маршрут» відкриває шлях у Google Maps, а на пристрої Apple — в Apple Картах.",
          "Оновлені екскурсія й налаштування. Екскурсія продуктом тепер проходить новим меню — натисніть «Пройти екскурсію» на панелі, щоб запустити її знову, — а кожен крок налаштування показує, скільки приблизно хвилин він займає. Нових компаній під час реєстрації запитують «У вас є вебсайт?»; якщо сайту немає, у кроках налаштування з'являється «Створіть свій вебсайт», що відкриває конструктор сайту.",
        ],
      },
      pa: {
        title: "24 ਕਿੱਤਿਆਂ ਲਈ ਸੇਵਾਵਾਂ ਤੇ ਅਨੁਮਾਨ ਟੈਂਪਲੇਟ, ਕੰਮ ਦੀਆਂ ਚੈੱਕਲਿਸਟਾਂ, ਅਤੇ ਗਾਹਕ ਪੋਰਟਲ",
        body: "ਤੁਹਾਡੇ ਕਿੱਤੇ ਦੀਆਂ ਸੇਵਾਵਾਂ ਹੁਣ ਪਹਿਲਾਂ ਤੋਂ ਤੈਅ ਕੀਮਤਾਂ ਅਤੇ ਅਨੁਮਾਨ ਟੈਂਪਲੇਟਾਂ ਨਾਲ ਆਉਂਦੀਆਂ ਹਨ, ਤੁਹਾਡਾ ਅਮਲਾ ਕੰਮ 'ਤੇ ਚੈੱਕਲਿਸਟਾਂ ਭਰਦਾ ਹੈ, ਅਤੇ ਤੁਹਾਡੇ ਗਾਹਕਾਂ ਨੂੰ ਆਪਣੇ ਪਲਾਨਾਂ, ਵਿਜ਼ਿਟਾਂ ਅਤੇ ਬੇਨਤੀਆਂ ਲਈ ਪੋਰਟਲ ਮਿਲਦਾ ਹੈ। ਨਾਲ ਹੀ ਨਵਾਂ: ਜਾਇਦਾਦ ਵੇਖੋ, ਰਸਤਾ, ਨਵਾਂ ਟੂਰ, ਅਤੇ ਸਾਈਨ-ਅੱਪ ਵੇਲੇ ਵੈੱਬਸਾਈਟ ਵਾਲਾ ਕਦਮ।",
        post: [
          "24 ਕਿੱਤਿਆਂ ਲਈ ਸੇਵਾਵਾਂ। ਪਲੰਬਿੰਗ, ਬਿਜਲੀ, HVAC, ਫ਼ਰਸ਼, ਪੇਂਟਿੰਗ, ਛੱਤ, ਪਰਨਾਲੇ, ਵਾੜਾਂ, ਡੈੱਕ, ਗੈਰਾਜ ਦਰਵਾਜ਼ੇ, ਸਫ਼ਾਈ, ਘਾਹ ਦੀ ਦੇਖਭਾਲ, ਬਰਫ਼ ਹਟਾਉਣਾ, ਰੁੱਖਾਂ ਦੀ ਦੇਖਭਾਲ ਅਤੇ ਹੋਰ ਕਈ ਕਿੱਤਿਆਂ ਲਈ ਹੁਣ ਸੇਵਾਵਾਂ ਦੀ ਪੂਰੀ ਸੂਚੀ ਹੈ। ਹਰ ਸੇਵਾ ਦੀ ਪਹਿਲਾਂ ਤੋਂ ਤੈਅ ਕੀਮਤ ਹੈ ਜੋ ਤੁਸੀਂ ਬਦਲ ਸਕਦੇ ਹੋ, ਉਸਦੇ ਨਾਲ ਅਗਵਾਈ ਵਜੋਂ ਘੱਟ ਤੋਂ ਵੱਧ ਤੱਕ ਆਮ ਰੇਂਜ ਦਿਖਦੀ ਹੈ, ਅਤੇ ਕਈਆਂ ਨਾਲ ਅਨੁਮਾਨ ਟੈਂਪਲੇਟ ਹੈ: ਮਜ਼ਦੂਰੀ, ਸਮਾਨ ਅਤੇ ਹੋਰ ਲਾਈਨਾਂ ਜੋ ਆਮ ਤੌਰ 'ਤੇ ਉਸ ਕੰਮ ਵਿੱਚ ਲੱਗਦੀਆਂ ਹਨ।",
          "ਅੱਜ ਤੋਂ ਪਹਿਲਾਂ ਸਾਈਨ ਅੱਪ ਕੀਤਾ ਸੀ? ਸੈਟਿੰਗਾਂ › ਸੇਵਾਵਾਂ ਤੇ ਕੀਮਤਾਂ 'ਤੇ ਜਾਓ ਅਤੇ ਆਪਣੇ ਹਰ ਕਿੱਤੇ ਹੇਠਾਂ “ਮੇਰੇ ਕਿੱਤੇ ਦੀਆਂ ਗੁੰਮ ਸੇਵਾਵਾਂ ਸ਼ਾਮਲ ਕਰੋ” ਦਬਾਓ। ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ਨਹੀਂ ਦਬਾਉਂਦੇ, ਕੁਝ ਵੀ ਨਹੀਂ ਜੁੜਦਾ, ਅਤੇ ਜਿਸ ਸੇਵਾ ਦਾ ਨਾਂ ਜਾਂ ਕੀਮਤ ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਬਦਲ ਚੁੱਕੇ ਹੋ, ਉਹ ਬਿਲਕੁਲ ਉਵੇਂ ਹੀ ਰਹਿੰਦੀ ਹੈ। ਫਿਰ ਸੇਵਾਵਾਂ ਉਹਨਾਂ ਲਾਈਨਾਂ ਵਿੱਚ ਆ ਜਾਂਦੀਆਂ ਹਨ ਜੋ ਤੁਸੀਂ ਉਸ ਕਿੱਤੇ ਦੇ ਕੋਟੇ ਵਿੱਚ ਜੋੜ ਸਕਦੇ ਹੋ, ਅਤੇ ਹਰ ਇੱਕ ਦਾ ਟੈਂਪਲੇਟ ਉਸੇ ਸਕ੍ਰੀਨ 'ਤੇ “ਅਨੁਮਾਨ ਟੈਂਪਲੇਟ” ਹੇਠਾਂ ਹੈ, ਵੇਖਣ ਅਤੇ ਬਦਲਣ ਲਈ ਤਿਆਰ।",
          "ਤੁਹਾਡੇ ਕਿੱਤੇ ਲਈ ਚੈੱਕਲਿਸਟਾਂ। ਚੈੱਕਲਿਸਟ ਦੀ ਕੋਈ ਚੀਜ਼ ਹੁਣ ਟਿੱਕ ਬਾਕਸ, ਲਿਖਤ, ਨੰਬਰ, ਇੱਕ ਚੁਣੋ, ਕਈ ਚੁਣੋ, ਠੀਕ / ਧਿਆਨ / ਸਮੱਸਿਆ, ਫ਼ੋਟੋ ਜਾਂ ਦਸਤਖ਼ਤ ਹੋ ਸਕਦੀ ਹੈ, ਹਿੱਸਿਆਂ ਵਿੱਚ ਵੰਡੀ ਹੋਈ। ਤੁਹਾਡੇ ਕਿੱਤਿਆਂ ਲਈ ਸ਼ੁਰੂਆਤੀ ਸੂਚੀਆਂ ਲਿਖੀਆਂ ਗਈਆਂ ਹਨ: ਸੈਟਿੰਗਾਂ › ਚੈੱਕਲਿਸਟ › “ਮੇਰੇ ਕਿੱਤਿਆਂ ਦੀਆਂ ਸ਼ੁਰੂਆਤੀ ਸੂਚੀਆਂ ਜੋੜੋ” (ਉੱਪਰ ਵਾਲਾ ਸੇਵਾਵਾਂ ਦਾ ਬਟਨ ਵੀ ਇਹਨਾਂ ਨੂੰ ਜੋੜਦਾ ਹੈ)। ਕੋਈ ਸੂਚੀ ਤੁਹਾਡੀਆਂ ਚੁਣੀਆਂ ਸੇਵਾਵਾਂ ਦੇ ਨਵੇਂ ਕੰਮਾਂ ਵਿੱਚ ਆਪੇ ਜੁੜ ਸਕਦੀ ਹੈ, ਅਤੇ ਇਉਂ ਸੈੱਟ ਕੀਤੀ ਜਾ ਸਕਦੀ ਹੈ ਕਿ ਕੰਮ ਬੰਦ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਉਸਦਾ ਸਭ ਕੁਝ ਪੂਰਾ ਹੋਵੇ।",
          "ਤੁਹਾਡਾ ਅਮਲਾ ਕੰਮ 'ਤੇ ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਚੈੱਕਲਿਸਟਾਂ ਭਰਦਾ ਹੈ, ਅਤੇ ਦਫ਼ਤਰ ਕੰਮ ਦੇ ਚੈੱਕਲਿਸਟਾਂ ਕਾਰਡ 'ਤੇ ਜਵਾਬ ਵੇਖਦਾ ਹੈ।",
          "ਪਲਾਨਾਂ ਅਤੇ ਵਿਜ਼ਿਟਾਂ ਲਈ ਗਾਹਕ ਪੋਰਟਲ। ਜੋ ਲਿੰਕ ਤੁਸੀਂ ਗਾਹਕ ਨੂੰ ਭੇਜਦੇ ਹੋ, ਉਹ ਹੁਣ ਉਸਦੀ ਅਗਲੀ ਵਿਜ਼ਿਟ ਪਹੁੰਚਣ ਦੇ ਸਮੇਂ ਨਾਲ, ਉਸਦੇ ਸੇਵਾ ਪਲਾਨ ਅਗਲੀਆਂ ਤਾਰੀਖ਼ਾਂ ਅਤੇ ਸ਼ਾਮਲ ਚੀਜ਼ਾਂ ਨਾਲ, ਅਤੇ ਆਉਣ ਵਾਲੀਆਂ ਤੇ ਪਿਛਲੀਆਂ ਵਿਜ਼ਿਟਾਂ ਹਰ ਇੱਕ ਦੀਆਂ ਫ਼ੋਟੋਆਂ ਨਾਲ ਦਿਖਾਉਂਦਾ ਹੈ। ਉੱਥੋਂ ਗਾਹਕ ਵਿਜ਼ਿਟ ਬਦਲਣ ਜਾਂ ਛੱਡਣ ਦੀ ਬੇਨਤੀ ਕਰ ਸਕਦਾ ਹੈ, ਫ਼ੋਟੋਆਂ ਨਾਲ ਸਮੱਸਿਆ ਦੱਸ ਸਕਦਾ ਹੈ, ਨਵਾਂ ਕੰਮ ਜਾਂ ਨਿਯਮਤ ਦੇਖਭਾਲ ਮੰਗ ਸਕਦਾ ਹੈ, ਅਤੇ ਆਪਣੇ ਪਲਾਨ ਵਿੱਚ ਸ਼ਾਮਲ ਅਗਲੀ ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰ ਸਕਦਾ ਹੈ। ਤੁਹਾਡੀ ਪੁਸ਼ਟੀ ਤੋਂ ਬਿਨਾਂ ਕੁਝ ਵੀ ਬੁੱਕ ਜਾਂ ਬਦਲਿਆ ਨਹੀਂ ਜਾਂਦਾ: ਹਰ ਬੇਨਤੀ ਹੋਰ › ਗਾਹਕ ਟਿਕਟਾਂ ਵਿੱਚ ਆਉਂਦੀ ਹੈ, ਜਿੱਥੇ ਤੁਸੀਂ ਜਵਾਬ ਦਿੰਦੇ ਹੋ ਅਤੇ ਸਥਿਤੀ ਬਦਲਦੇ ਹੋ, ਅਤੇ ਮੁਰੰਮਤ ਜਾਂ ਵਾਰੰਟੀ ਦੀ ਸਮੱਸਿਆ ਇੱਕ ਕਦਮ ਵਿੱਚ ਕੰਮ ਬਣ ਜਾਂਦੀ ਹੈ। ਗਾਹਕ ਦੇ ਪੰਨੇ ਤੋਂ ਪੋਰਟਲ ਲਿੰਕ ਕਾਪੀ ਕਰੋ ਜਾਂ ਪੋਰਟਲ ਲਿੰਕ ਈਮੇਲ ਕਰੋ ਨਾਲ ਲਿੰਕ ਭੇਜੋ।",
          "ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ 'ਤੇ ਗਾਹਕ ਲੌਗਇਨ। ਸੈਟਿੰਗਾਂ › ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ › ਬਾਰੀਕ ਸੈਟਿੰਗ ਵਿੱਚ “ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ 'ਤੇ ਗਾਹਕ ਲੌਗਇਨ” ਚਾਲੂ ਕਰੋ, ਅਤੇ ਤੁਹਾਡੀ ਸਾਈਟ ਦੇ ਉੱਪਰਲੇ ਅਤੇ ਹੇਠਲੇ ਹਿੱਸੇ ਵਿੱਚ ਗਾਹਕ ਲੌਗਇਨ ਦਾ ਲਿੰਕ ਆ ਜਾਂਦਾ ਹੈ। ਗਾਹਕ ਆਪਣਾ ਈਮੇਲ ਪਤਾ ਲਿਖਦਾ ਹੈ ਅਤੇ ਆਪਣਾ ਪੋਰਟਲ ਲਿੰਕ ਪ੍ਰਾਪਤ ਕਰਦਾ ਹੈ — ਕੋਈ ਪਾਸਵਰਡ ਨਹੀਂ।",
          "ਜਾਇਦਾਦ ਵੇਖੋ ਅਤੇ ਰਸਤਾ। ਲੀਡਾਂ, ਗਾਹਕਾਂ, ਕੰਮਾਂ ਅਤੇ ਕੋਟਿਆਂ 'ਤੇ ਜਾਇਦਾਦ ਵੇਖੋ ਬਟਨ ਹੈ ਜੋ ਦਬਾਉਣ 'ਤੇ ਘਰ ਦੇ ਅਗਲੇ ਪਾਸੇ ਦਾ Street View ਖੋਲ੍ਹਦਾ ਹੈ, ਜਿੱਥੇ ਵੀ Google ਕੋਲ ਤਸਵੀਰਾਂ ਹਨ, ਅਤੇ ਤੁਹਾਡਾ ਗਾਹਕ ਵੀ ਇਸਨੂੰ ਆਪਣੇ ਕੋਟੇ 'ਤੇ ਵੇਖਦਾ ਹੈ। ਕਿਸੇ ਕੰਮ 'ਤੇ, ਰਸਤਾ Google Maps ਵਿੱਚ, ਜਾਂ Apple ਡਿਵਾਈਸ 'ਤੇ Apple Maps ਵਿੱਚ ਰੂਟ ਖੋਲ੍ਹਦਾ ਹੈ।",
          "ਨਵਾਂ ਟੂਰ ਅਤੇ ਸੈੱਟ-ਅੱਪ। ਉਤਪਾਦ ਟੂਰ ਹੁਣ ਨਵੇਂ ਮੀਨੂ ਵਿੱਚੋਂ ਲੰਘਦਾ ਹੈ — ਇਸਨੂੰ ਦੁਬਾਰਾ ਚਲਾਉਣ ਲਈ ਆਪਣੇ ਡੈਸ਼ਬੋਰਡ 'ਤੇ ਟੂਰ ਸ਼ੁਰੂ ਕਰੋ ਦਬਾਓ — ਅਤੇ ਹਰ ਸੈੱਟ-ਅੱਪ ਕਦਮ ਦੱਸਦਾ ਹੈ ਕਿ ਉਸ ਵਿੱਚ ਲਗਭਗ ਕਿੰਨੇ ਮਿੰਟ ਲੱਗਦੇ ਹਨ। ਨਵੀਆਂ ਕੰਪਨੀਆਂ ਨੂੰ ਸਾਈਨ ਅੱਪ ਵੇਲੇ ਪੁੱਛਿਆ ਜਾਂਦਾ ਹੈ “ਕੀ ਤੁਹਾਡੀ ਕੋਈ ਵੈੱਬਸਾਈਟ ਹੈ?”; ਜੇ ਨਹੀਂ ਹੈ, ਤਾਂ “ਆਪਣੀ ਵੈੱਬਸਾਈਟ ਬਣਾਓ” ਤੁਹਾਡੇ ਸੈੱਟ-ਅੱਪ ਕਦਮਾਂ ਵਿੱਚ ਆਉਂਦਾ ਹੈ ਅਤੇ ਵੈੱਬਸਾਈਟ ਬਿਲਡਰ ਖੋਲ੍ਹਦਾ ਹੈ।",
        ],
      },
      tl: {
        title: "Mga serbisyo at template ng estimate para sa 24 na trade, mga checklist sa trabaho, at client portal",
        body: "May nakatakdang presyo at template ng estimate na ang mga serbisyo ng trade mo, pinupunan ng crew mo ang mga checklist sa trabaho, at may portal na ang mga kliyente mo para sa kanilang mga plan, pagbisita at request. Bago rin: Tingnan ang property, Direksyon, bagong tour, at hakbang para sa website sa pag-sign up.",
        post: [
          "Mga serbisyo para sa 24 na trade. Ang plumbing, electrical, HVAC, flooring, pagpipinta, bubong, alulod, bakod, deck, pinto ng garahe, paglilinis, pag-aalaga ng damuhan, pag-alis ng niyebe, pag-aalaga ng puno at iba pa ay may kumpletong listahan na ng mga serbisyo. May nakatakdang presyo ang bawat serbisyo na puwede mong baguhin, kasama ang karaniwang saklaw mula mababa hanggang mataas sa tabi bilang gabay, at marami ang may template ng estimate: ang mga linya ng labor, materyales at iba pa na karaniwang kailangan ng trabaho.",
          "Nag-sign up bago ngayon? Pumunta sa Mga Setting › Mga serbisyo at presyo at pindutin ang “Idagdag ang mga kulang na serbisyo para sa aking trade” sa ilalim ng bawat trade mo. Walang maidadagdag hangga't hindi mo pinipindot, at ang serbisyong napalitan mo na ng pangalan o presyo ay mananatiling eksaktong gaya ng dati. Lalabas na ang mga serbisyo sa mga linyang puwede mong idagdag sa quote para sa trade na iyon, at ang template ng bawat isa ay nasa “Mga template ng estimate” sa parehong screen, handang suriin at ayusin.",
          "Mga checklist para sa trade mo. Ang isang item ay puwede nang maging tick box, text, numero, pumili ng isa, pumili ng ilan, Maayos / Bantayan / Problema, larawan o pirma, nakagrupo sa mga seksyon. May mga panimulang listahan na isinulat para sa mga trade mo: Mga Setting › Mga checklist › “Idagdag ang mga panimulang checklist ng aking mga trade” (idinadagdag din ito ng button ng serbisyo sa itaas). Puwedeng awtomatikong idagdag ang isang listahan sa mga bagong trabaho para sa mga serbisyong pipiliin mo, at itakda na dapat tapos ang lahat dito bago maisara ang trabaho.",
          "Pinupunan ng crew mo ang mga checklist sa trabaho, sa sarili nilang wika, at nakikita ng opisina ang mga sagot sa card na Mga checklist ng trabaho.",
          "Client portal para sa mga plan at pagbisita. Ipinapakita na ngayon ng link na ipinapadala mo sa kliyente ang susunod niyang pagbisita kasama ang oras ng pagdating, ang kanyang mga service plan kasama ang mga susunod na petsa at kung ano ang kasama, at ang mga paparating at nakaraang pagbisita kasama ang mga larawan ng bawat isa. Mula roon, puwede siyang humiling na ilipat o laktawan ang isang pagbisita, mag-ulat ng problema na may larawan, humiling ng bagong trabaho o regular na maintenance, at mag-book ng susunod na pagbisitang kasama sa kanyang plan. Walang nabu-book o nababago hangga't hindi mo kinukumpirma: dumarating ang bawat request sa Higit pa › Mga ticket ng kliyente, kung saan ka sumasagot at nagpapalit ng status, at nagiging trabaho sa isang hakbang ang problema sa repair o warranty. Ipadala ang link mula sa page ng kliyente gamit ang Kopyahin ang portal link o I-email ang portal link.",
          "Client login sa iyong website. I-on ang “Client login sa iyong website” sa Mga Setting › Ang iyong website › I-fine-tune, at magkakaroon ng link na Client login ang header at footer ng site mo. Ilalagay ng kliyente ang kanyang email at matatanggap niya ang sarili niyang portal link — walang password.",
          "Tingnan ang property at Direksyon. May button na Tingnan ang property ang mga lead, kliyente, trabaho at quote na nagbubukas ng Street View ng harap ng bahay kapag pinindot mo, kung saan may larawan ang Google, at nakikita rin ito ng kliyente mo sa kanyang quote. Sa isang trabaho, binubuksan ng Direksyon ang ruta sa Google Maps, o sa Apple Maps sa Apple device.",
          "Bagong tour at setup. Dumadaan na ang product tour sa bagong menu — pindutin ang Simulan ang tour sa dashboard mo para patakbuhin ito ulit — at ipinapakita ng bawat hakbang ng setup kung humigit-kumulang ilang minuto ito. Tinatanong ang mga bagong kumpanya ng “May website ka ba?” sa pag-sign up; kung wala ka pa, lalabas ang “Gumawa ng iyong website” sa mga hakbang ng setup mo at bubuksan nito ang website builder.",
        ],
      },
      de: {
        title: "Leistungen und Angebotsvorlagen für 24 Gewerke, Auftrags-Checklisten und ein Kundenportal",
        body: "Die Leistungen Ihres Gewerks kommen jetzt mit voreingestellten Preisen und Angebotsvorlagen, Ihr Team füllt Checklisten direkt beim Auftrag aus, und Ihre Kunden bekommen ein Portal für ihre Pläne, Besuche und Anfragen. Außerdem neu: Immobilie ansehen, Route, ein überarbeiteter Rundgang und ein Website-Schritt bei der Anmeldung.",
        post: [
          "Leistungen für 24 Gewerke. Sanitär, Elektro, Heizung und Klima, Bodenbeläge, Malerarbeiten, Dach, Dachrinnen, Zäune, Terrassen, Garagentore, Reinigung, Rasenpflege, Winterdienst, Baumpflege und mehr haben jetzt eine vollständige Leistungsliste. Jede Leistung hat einen voreingestellten Preis, den Sie ändern können, mit der üblichen Spanne von niedrig bis hoch daneben als Orientierung, und viele haben eine Angebotsvorlage: die Positionen für Arbeit, Material und Sonstiges, die der Auftrag üblicherweise braucht.",
          "Schon vor heute angemeldet? Öffnen Sie Einstellungen › Leistungen & Preise und tippen Sie unter jedem Ihrer Gewerke auf „Fehlende Leistungen für mein Gewerk hinzufügen“. Nichts wird hinzugefügt, bevor Sie tippen, und eine Leistung, die Sie bereits umbenannt oder neu bepreist haben, bleibt genau so, wie sie ist. Danach erscheinen die Leistungen unter den Positionen, die Sie einem Angebot für dieses Gewerk hinzufügen können, und die Vorlage jeder Leistung finden Sie unter „Angebotsvorlagen“ auf demselben Bildschirm, bereit zum Prüfen und Anpassen.",
          "Checklisten für Ihr Gewerk. Ein Punkt kann jetzt ein Häkchen, Text, eine Zahl, Einfachauswahl, Mehrfachauswahl, Gut / Beobachten / Problem, ein Foto oder eine Unterschrift sein, gegliedert in Abschnitte. Startlisten sind für Ihre Gewerke geschrieben: Einstellungen › Checklisten › „Startlisten für meine Gewerke hinzufügen“ (die Leistungs-Schaltfläche oben fügt sie ebenfalls hinzu). Eine Liste kann neuen Aufträgen für die von Ihnen gewählten Leistungen automatisch hinzugefügt und so eingestellt werden, dass alles darauf erledigt sein muss, bevor der Auftrag abgeschlossen werden kann.",
          "Ihr Team füllt die Checklisten beim Auftrag aus, in der eigenen Sprache, und das Büro sieht die Antworten auf der Karte „Checklisten“ des Auftrags.",
          "Ein Kundenportal für Pläne und Besuche. Der Link, den Sie einem Kunden schicken, zeigt jetzt seinen nächsten Besuch mit Ankunftsfenster, seine Servicepläne mit den nächsten Terminen und dem, was enthalten ist, sowie kommende und vergangene Besuche mit den Fotos von jedem. Dort kann der Kunde bitten, einen Besuch zu verschieben oder auszulassen, ein Problem mit Fotos melden, neue Arbeiten oder regelmäßige Wartung anfragen und den nächsten in seinem Plan enthaltenen Besuch buchen. Nichts wird gebucht oder geändert, bevor Sie bestätigen: Jede Anfrage landet unter Mehr › Kundentickets, wo Sie antworten und den Status setzen, und ein Reparatur- oder Garantiefall wird mit einem Schritt zum Auftrag. Senden Sie den Link von der Seite des Kunden mit „Portal-Link kopieren“ oder „Portal-Link per E-Mail senden“.",
          "Kundenlogin auf Ihrer Website. Schalten Sie „Kundenlogin auf Ihrer Website“ unter Einstellungen › Ihre Website › Feinschliff ein, und Kopf- und Fußzeile Ihrer Seite zeigen einen Link zum Kundenlogin. Der Kunde gibt seine E-Mail-Adresse ein und erhält seinen eigenen Portal-Link — ohne Passwörter.",
          "Immobilie ansehen und Route. Leads, Kunden, Aufträge und Angebote haben eine Schaltfläche „Immobilie ansehen“, die beim Antippen eine Street-View-Ansicht der Hausfront öffnet, wo Google Bilder hat, und Ihr Kunde sieht sie auch in seinem Angebot. Bei einem Auftrag öffnet „Route“ den Weg in Google Maps oder, auf einem Apple-Gerät, in Apple Karten.",
          "Überarbeiteter Rundgang und Einrichtung. Der Produktrundgang führt jetzt durch das neue Menü — tippen Sie auf Ihrem Dashboard auf „Rundgang starten“, um ihn erneut zu sehen — und jeder Einrichtungsschritt zeigt, wie viele Minuten er ungefähr dauert. Neue Firmen werden bei der Anmeldung gefragt: „Haben Sie eine Website?“; wenn nicht, erscheint „Erstellen Sie Ihre Website“ in Ihren Einrichtungsschritten und öffnet den Website-Baukasten.",
        ],
      },
      zh: {
        title: "24 个行业的服务与报价模板、工单检查清单，以及客户门户",
        body: "你所在行业的服务现在自带预设价格和报价模板，你的团队在现场填写检查清单，你的客户也有了查看服务计划、上门服务和请求的门户。另有新功能：查看房产、路线、全新导览，以及注册时的网站步骤。",
        post: [
          "24 个行业的服务。水管、电工、暖通空调、地板、油漆、屋顶、排水槽、围栏、露台、车库门、清洁、草坪养护、除雪、树木养护等行业现在都有完整的服务清单。每项服务都有可修改的预设价格，旁边显示从低到高的常见价格区间作为参考；许多服务还带有报价模板：这类工作通常需要的人工、材料及其他明细行。",
          "今天之前注册的？前往 设置 › 服务与定价，在每个行业下点按“为我的行业添加缺少的服务”。在你点按之前不会添加任何内容；你已改名或改价的服务会保持原样。之后，这些服务会出现在该行业报价可添加的明细行中，每项服务的模板位于同一页面的“报价模板”下，可随时查看和调整。",
          "适合你行业的检查清单。清单项目现在可以是勾选框、文字、数字、单选、多选、良好 / 留意 / 问题、照片或签名，并可分节归组。我们为你的行业准备了入门清单：设置 › 检查清单 › “添加我所属行业的入门清单”（上面的服务按钮也会一并添加）。清单可以自动加到你所选服务的新工单上，也可以设置为清单上所有项目完成后工单才能关闭。",
          "你的团队在现场用自己的语言填写清单，办公室在工单的“检查清单”卡片上查看答案。",
          "用于服务计划和上门服务的客户门户。你发给客户的链接现在会显示下一次上门服务及到达时段、服务计划的后续日期和包含内容，以及即将进行和已完成的上门服务及每次的照片。客户可以在门户中申请改期或跳过一次上门服务、附照片报告问题、申请新工作或定期维护，并预约计划内包含的下一次上门服务。在你确认之前，不会预约或更改任何内容：每个请求都会进入 更多 › 客户工单，你可以在那里回复、设置状态，维修或保修问题一步即可转为工单。在客户页面用“复制门户链接”或“邮件发送门户链接”发送链接。",
          "网站上的客户登录。在 设置 › 你的网站 › 微调 中开启“网站上的客户登录”，你网站的页眉和页脚就会出现客户登录链接。客户输入电子邮件地址，即可收到自己的门户链接——无需密码。",
          "查看房产和路线。潜在客户、客户、工单和报价上都有“查看房产”按钮，点按后会打开房屋正面的街景（只要 Google 有该处影像），你的客户在他们的报价上也能看到。在工单上，“路线”会在 Google 地图中打开路线，在 Apple 设备上则用 Apple 地图打开。",
          "全新的导览和设置。产品导览现在会带你走一遍新菜单——在仪表板上点按“开始导览”即可再看一次——每个设置步骤也会显示大约需要几分钟。新公司注册时会被问到“你有网站吗？”；如果还没有，“创建你的网站”会出现在设置步骤中，并打开网站生成器。",
        ],
      },
      it: {
        title: "Servizi e modelli di preventivo per 24 mestieri, checklist di lavoro e un portale clienti",
        body: "I servizi del tuo mestiere ora arrivano con prezzi preimpostati e modelli di preventivo, la tua squadra compila le checklist sul lavoro e i tuoi clienti hanno un portale per i loro piani, le visite e le richieste. Inoltre: Vedi la proprietà, Indicazioni, un tour rinnovato e un passaggio sul sito web alla registrazione.",
        post: [
          "Servizi per 24 mestieri. Idraulica, impianti elettrici, climatizzazione, pavimenti, tinteggiatura, tetti, grondaie, recinzioni, terrazze, porte da garage, pulizie, cura del prato, sgombero neve, cura degli alberi e altro ora hanno un elenco completo di servizi. Ogni servizio ha un prezzo preimpostato che puoi cambiare, con accanto la fascia tipica dal più basso al più alto come riferimento, e molti hanno un modello di preventivo: le righe di manodopera, materiali e altro che il lavoro richiede di solito.",
          "Ti sei registrato prima di oggi? Vai in Impostazioni › Servizi e prezzi e premi «Aggiungi i servizi mancanti per il mio mestiere» sotto ciascuno dei tuoi mestieri. Non viene aggiunto nulla finché non premi, e un servizio che hai già rinominato o a cui hai cambiato prezzo resta esattamente com'è. I servizi compaiono poi tra le righe che puoi aggiungere a un preventivo per quel mestiere, e il modello di ciascuno è in «Modelli di preventivo» nella stessa schermata, pronto da rivedere e modificare.",
          "Checklist per il tuo mestiere. Una voce ora può essere una casella di spunta, un testo, un numero, una scelta singola, una scelta multipla, Bene / Da tenere d'occhio / Problema, una foto o una firma, raggruppate in sezioni. Ci sono liste di partenza scritte per i tuoi mestieri: Impostazioni › Liste di controllo › «Aggiungi le checklist di partenza dei miei mestieri» (anche il pulsante dei servizi qui sopra le aggiunge). Una lista può essere aggiunta automaticamente ai nuovi lavori per i servizi che scegli, e impostata in modo che tutto ciò che contiene vada fatto prima di poter chiudere il lavoro.",
          "La tua squadra compila le checklist sul lavoro, nella propria lingua, e l'ufficio vede le risposte nella scheda Checklist del lavoro.",
          "Un portale clienti per piani e visite. Il link che mandi a un cliente ora mostra la sua prossima visita con la fascia di arrivo, i suoi piani di servizio con le prossime date e cosa includono, e le visite future e passate con le foto di ciascuna. Da lì il cliente può chiedere di spostare o saltare una visita, segnalare un problema con foto, richiedere nuovi lavori o manutenzione periodica e prenotare la prossima visita inclusa nel suo piano. Niente viene prenotato o cambiato finché non confermi: ogni richiesta arriva in Altro › Ticket clienti, dove rispondi e imposti lo stato, e un problema di riparazione o garanzia diventa un lavoro in un passaggio. Invia il link dalla pagina del cliente con Copia link del portale o Invia link del portale.",
          "Area clienti sul tuo sito. Attiva «Area clienti sul suo sito» in Impostazioni › Il suo sito web › Rifinisci, e l'intestazione e il piè di pagina del sito mostrano un link all'area clienti. Il cliente inserisce il suo indirizzo email e riceve il proprio link al portale, senza password.",
          "Vedi la proprietà e Indicazioni. Contatti, clienti, lavori e preventivi hanno un pulsante Vedi la proprietà che, quando lo tocchi, apre uno Street View della facciata della casa, dove Google ha immagini, e anche il tuo cliente lo vede sul suo preventivo. In un lavoro, Indicazioni apre il percorso in Google Maps, o in Mappe di Apple su un dispositivo Apple.",
          "Tour e configurazione rinnovati. Il tour del prodotto ora percorre il nuovo menu — premi Fai il tour nella tua dashboard per rivederlo — e ogni passaggio di configurazione indica quanti minuti richiede, più o meno. Alle nuove aziende viene chiesto «Hai un sito web?» alla registrazione; se non ce l'hai, «Crea il tuo sito web» compare tra i passaggi di configurazione e apre il costruttore di siti.",
        ],
      },
    },
  },
  {
    date: "2026-07-21",
    slug: "company-settings-manage-team",
    title: "Company Settings, Manage Team, and more",
    body: "Rebuilt Settings with a proper Business Management section: Company Settings (hours, tax, regional), a granular Manage Team permission editor, Products & Services, Custom Fields, and Expense Tracking with an AI summary and burn rate.",
    post: [
      "Settings had grown into one long list where the screen you needed was wherever it happened to have been added. It is now grouped by what a business is actually trying to do, and several of the screens behind those groups were rebuilt rather than moved.",
      "Company Settings is the one place your business details live: opening hours, tax registration and rates, and your regional preferences. These are company-level and public — your opening hours are what a client sees, and they are deliberately separate from any one person's booking availability, which lives under Availability.",
      "Manage Team is now a permission editor rather than a role dropdown. You can decide, per person, what they can see and change — useful when a subcontractor should be able to close out a job but never see what the job was priced at.",
      "Products & Services is where your catalogue lives, and Custom Fields lets you add the questions your trade asks that ours does not. Both feed straight into quoting, so anything you add here is available the next time you build a quote.",
      "Expense Tracking now summarises where the money went and shows your burn rate, so the answer to 'what did we spend last month' is on the screen instead of in a shoebox.",
    ],
  },
  {
    date: "2026-07-18",
    slug: "redesigned-navigation",
    title: "Redesigned navigation",
    body: "The sidebar now has a quick-add shortcut, a collapsible layout, and a proper mobile drawer.",
    post: [
      "The sidebar was built for a desktop and behaved like one on a phone, which is where a lot of this product is actually used — in a driveway, one-handed.",
      "There is now a quick-add shortcut at the top, so starting a quote, a client or a job is one tap from anywhere instead of a trip back to a list screen.",
      "The rail collapses. On a laptop that gives the page back the width it needs for a quote with a lot of line items, and the icons stay, so you do not lose your place.",
      "On a phone the navigation is a drawer that opens over the page and closes when you pick something, rather than a column permanently eating a third of the screen.",
    ],
  },
];

/**
 * The entry as a reader in `language` sees it: that language's title, body
 * and post together, or the English entry whole.
 *
 * All-or-nothing on purpose (see "Language" at the top): a translation
 * missing its title or body, or whose post does not have the English post's
 * paragraph count, is ignored rather than mixed with English. Own-property
 * lookup, so `language = "__proto__"` reads English, not Object.prototype.
 */
export function localizedUpdate(update, language) {
  if (!update) return update;
  const lang = typeof language === "string" ? language.toLowerCase() : "";
  const tr =
    lang && update.translations && Object.prototype.hasOwnProperty.call(update.translations, lang)
      ? update.translations[lang]
      : null;
  if (!translationComplete(update, tr)) return update;
  return { ...update, title: tr.title, body: tr.body, post: update.post?.length ? tr.post : update.post };
}

/** Does this translation carry everything the English entry prints? */
export function translationComplete(update, tr) {
  if (!tr || typeof tr !== "object") return false;
  if (typeof tr.title !== "string" || !tr.title.trim()) return false;
  if (typeof tr.body !== "string" || !tr.body.trim()) return false;
  if (update?.post?.length) {
    if (!Array.isArray(tr.post) || tr.post.length !== update.post.length) return false;
    if (tr.post.some((p) => typeof p !== "string" || !p.trim())) return false;
  }
  return true;
}

/** The full post exists and is reachable. Both halves, or neither. */
export function hasPost(update) {
  return Boolean(update?.slug && update?.post?.length);
}

/** The entry for a URL segment, or null. Callers render a not-found state. */
export function findProductUpdate(slug) {
  if (!slug) return null;
  return PRODUCT_UPDATES.find((u) => u.slug === slug) || null;
}

/**
 * "July 21, 2026" in the interface language.
 *
 * Shared by the list and the post so the two can't drift — the list used to
 * carry its own copy pinned to en-US, which meant a French interface printed
 * an American date beside every entry. A bad locale falls back rather than
 * throwing a RangeError into the middle of a settings page.
 *
 * `T00:00:00` is not decoration: a bare "2026-07-21" parses as UTC midnight
 * and prints as the 20th anywhere west of Greenwich, which is most of this
 * product's users.
 */
export function formatUpdateDate(date, locale = "en-US") {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  const options = { month: "long", day: "numeric", year: "numeric" };
  try {
    return parsed.toLocaleDateString(locale, options);
  } catch {
    return parsed.toLocaleDateString("en-US", options);
  }
}
