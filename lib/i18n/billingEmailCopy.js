// lib/i18n/billingEmailCopy.js
//
// Every sentence of FieldQuo's subscription letters (lib/email/billingEmail.js)
// in every language the app catalogue carries — app/i18n/appMessages.js's
// APP_MESSAGES keys, which scripts/check-billing-lifecycle-emails.mjs holds this file
// to, key for key and placeholder for placeholder. The letter's own words
// only: the envelope's chrome and footer ("A service email about your
// FieldQuo account…") are the shared layout's (lib/i18n/lifecycleEmailCopy.js)
// since the letters moved onto it.
//
// ── Why its own file and not more app.* keys ────────────────────────────────
//
// appMessages.js is the INTERFACE catalogue and ships to the browser; these
// sentences are only ever read on the server, by a cron or a webhook. The
// same reason lib/i18n/emailCopy.js holds the client emails' sentences rather
// than the interface catalogue.
//
// ── Two kinds of value ──────────────────────────────────────────────────────
//
//   PLAIN  subject, heading, cta, fact, yourCompany, days.*, the two
//          *Word keys — text. The builder escapes them where they go into
//          HTML, exactly as it always escaped the English literals.
//   HTML   every other key — a paragraph body. Written as HTML on purpose,
//          because the English payload is pinned byte-for-byte (an md5 per
//          kind in the check): the English "Account &amp; Billing" in one
//          sentence and the bare "Account & Billing" in two others are what
//          the letters said before this file existed, and both render the
//          same. A new sentence writes `&amp;`. Placeholders in an HTML
//          sentence are filled with ESCAPED values wrapped in <strong> — the
//          same bolding the English letters used.
//
// Placeholders: {company} {plan} {previous} {date} {last4} {amount} {days}
// {n} {readOnly} {nothingDeleted}. A sentence's placeholders are the same in
// every language; the check fails on a missing or an extra one.
//
// ── Honest limits ───────────────────────────────────────────────────────────
//
// Careful translations of short transactional copy, not a native speaker's —
// the same standing as the app catalogue's APP_REVIEW_PENDING languages.
// Plain and correct, no idiom. Never machine-translated at send time: the
// letter a company receives is one of these strings, filled in.

const en = {
  yourCompany: "Your company",
  "cta.viewPlan": "View your plan",
  "cta.manageBilling": "Manage billing",
  "cta.updateCard": "Update your card",
  "cta.resumeMyPlan": "Resume my plan",
  "cta.resume": "Resume",
  "fact.plan": "Plan",
  "fact.usersIncluded": "Users included",
  "fact.status": "Status",
  "fact.freeTrial": "Free trial",
  "fact.trialEnds": "Trial ends",
  "fact.nextBilling": "Next billing date",
  "started.subject": "You're subscribed to FieldQuo — {plan}",
  "started.heading": "You're all set",
  "started.body": "Thanks for subscribing. {company} is now on the {plan} plan.",
  "started.small":
    "Your receipt and invoices come from Stripe — they're the record for your accountant. You can change or cancel your plan at any time from Account &amp; Billing.",
  "changed.subject": "Your FieldQuo plan changed to {plan}",
  "changed.heading": "Your plan changed",
  "changed.moved": "You've moved from {previous} to {plan}.",
  "changed.now": "You're now on the {plan} plan.",
  "changed.small": "Stripe works out any difference for the rest of your current period and will show it on your next invoice.",
  "renewal.subject": "Your FieldQuo subscription renews on {date}",
  "renewal.heading": "Your subscription renews soon",
  "renewal.renews": "Your {plan} plan renews on {date}.",
  "renewal.cardLast4": "The card on file ending in {last4} will be charged {amount}.",
  "renewal.card": "Your card on file will be charged {amount}.",
  "renewal.small":
    "You can change plans or cancel any time before then from Account &amp; Billing — nothing is charged until the renewal date above.",
  "grace.subjectStart": "We couldn't charge the card for your FieldQuo account",
  "grace.subjectRemind": "Your FieldQuo account locks on {date}",
  "grace.headingStart": "We couldn't charge your card",
  "grace.headingRemind": "Your account locks on {date}",
  "grace.what":
    "We weren't able to charge the card on file for {company}. This is almost always a bank's fraud hold or a card that's expired — not something anyone did wrong.",
  "grace.readonly":
    "Right now the account is {readOnly}: everyone can still see every quote, invoice, client and photo exactly as it is. Nobody can create or send anything new until it's fixed, and {nothingDeleted}.",
  "grace.readOnlyWord": "read-only",
  "grace.nothingDeletedWord": "nothing has been deleted",
  "grace.remind":
    "The account locks on {date} — that's {days} from now. Update the card before then and everything keeps working exactly as it does today.",
  "grace.start": "You have {days} to update the card before the account locks.",
  "grace.days.one": "1 day",
  "grace.days.other": "{n} days",
  "grace.small": "Updating the card takes about a minute, and everything comes back the moment it's done.",
  "cancelled.subjectEnding": "Your FieldQuo plan ends on {date}",
  "cancelled.subjectEnded": "Your FieldQuo plan has been cancelled",
  "cancelled.headingEnding": "Your plan is ending",
  "cancelled.headingEnded": "Your plan has ended",
  "cancelled.ending":
    "Your {plan} plan ends on {date}; nothing more will be charged. Everything keeps working until then, and you can resume any time before that date from Account &amp; Billing.",
  "cancelled.ended": "Your {plan} plan has been cancelled.",
  "cancelled.nothingDeleted":
    "Nothing is deleted. Your quotes, clients, invoices and website content stay exactly as they are, and picking a plan again turns everything back on.",
  "cancelled.changedMind": "Changed your mind? Press Resume on Account & Billing before that date and the plan simply continues.",
  "cancelled.mistake": "If you cancelled by mistake, press Resume on Account & Billing to pick up where you left off.",
};

const fr = {
  yourCompany: "Votre entreprise",
  "cta.viewPlan": "Voir votre forfait",
  "cta.manageBilling": "Gérer la facturation",
  "cta.updateCard": "Mettre à jour votre carte",
  "cta.resumeMyPlan": "Reprendre mon forfait",
  "cta.resume": "Reprendre",
  "fact.plan": "Forfait",
  "fact.usersIncluded": "Utilisateurs inclus",
  "fact.status": "Statut",
  "fact.freeTrial": "Essai gratuit",
  "fact.trialEnds": "Fin de l'essai",
  "fact.nextBilling": "Prochaine facturation",
  "started.subject": "Vous êtes abonné à FieldQuo — {plan}",
  "started.heading": "Tout est prêt",
  "started.body": "Merci de votre abonnement. {company} est maintenant au forfait {plan}.",
  "started.small":
    "Votre reçu et vos factures viennent de Stripe — c'est le document à remettre à votre comptable. Vous pouvez changer ou annuler votre forfait en tout temps depuis Compte et facturation.",
  "changed.subject": "Votre forfait FieldQuo est passé à {plan}",
  "changed.heading": "Votre forfait a changé",
  "changed.moved": "Vous êtes passé du forfait {previous} au forfait {plan}.",
  "changed.now": "Vous êtes maintenant au forfait {plan}.",
  "changed.small": "Stripe calcule la différence pour le reste de la période en cours et l'affichera sur votre prochaine facture.",
  "renewal.subject": "Votre abonnement FieldQuo se renouvelle le {date}",
  "renewal.heading": "Votre abonnement se renouvelle bientôt",
  "renewal.renews": "Votre forfait {plan} se renouvelle le {date}.",
  "renewal.cardLast4": "La carte enregistrée se terminant par {last4} sera débitée de {amount}.",
  "renewal.card": "Votre carte enregistrée sera débitée de {amount}.",
  "renewal.small":
    "Vous pouvez changer de forfait ou annuler à tout moment d'ici là depuis Compte et facturation — rien n'est facturé avant la date de renouvellement ci-dessus.",
  "grace.subjectStart": "Nous n'avons pas pu débiter la carte de votre compte FieldQuo",
  "grace.subjectRemind": "Votre compte FieldQuo sera verrouillé le {date}",
  "grace.headingStart": "Nous n'avons pas pu débiter votre carte",
  "grace.headingRemind": "Votre compte sera verrouillé le {date}",
  "grace.what":
    "Nous n'avons pas pu débiter la carte enregistrée pour {company}. C'est presque toujours un blocage antifraude de la banque ou une carte expirée — personne n'a rien fait de mal.",
  "grace.readonly":
    "Pour l'instant, le compte est en {readOnly} : tout le monde peut encore voir chaque soumission, facture, client et photo tels quels. Personne ne peut créer ni envoyer quoi que ce soit de nouveau tant que ce n'est pas réglé, et {nothingDeleted}.",
  "grace.readOnlyWord": "lecture seule",
  "grace.nothingDeletedWord": "rien n'a été supprimé",
  "grace.remind":
    "Le compte sera verrouillé le {date} — dans {days}. Mettez la carte à jour d'ici là et tout continue de fonctionner exactement comme aujourd'hui.",
  "grace.start": "Vous avez {days} pour mettre la carte à jour avant que le compte soit verrouillé.",
  "grace.days.one": "{n} jour",
  "grace.days.other": "{n} jours",
  "grace.small": "La mise à jour de la carte prend environ une minute, et tout revient dès qu'elle est faite.",
  "cancelled.subjectEnding": "Votre forfait FieldQuo prend fin le {date}",
  "cancelled.subjectEnded": "Votre forfait FieldQuo a été annulé",
  "cancelled.headingEnding": "Votre forfait prend fin",
  "cancelled.headingEnded": "Votre forfait a pris fin",
  "cancelled.ending":
    "Votre forfait {plan} prend fin le {date}; rien de plus ne sera facturé. Tout continue de fonctionner d'ici là, et vous pouvez le reprendre à tout moment avant cette date depuis Compte et facturation.",
  "cancelled.ended": "Votre forfait {plan} a été annulé.",
  "cancelled.nothingDeleted":
    "Rien n'est supprimé. Vos soumissions, clients, factures et le contenu de votre site Web restent exactement tels quels, et choisir un forfait de nouveau rallume tout.",
  "cancelled.changedMind": "Vous avez changé d'avis? Appuyez sur Reprendre dans Compte et facturation avant cette date et le forfait continue simplement.",
  "cancelled.mistake": "Si vous avez annulé par erreur, appuyez sur Reprendre dans Compte et facturation pour reprendre là où vous en étiez.",
};

const es = {
  yourCompany: "Su empresa",
  "cta.viewPlan": "Ver su plan",
  "cta.manageBilling": "Administrar facturación",
  "cta.updateCard": "Actualizar su tarjeta",
  "cta.resumeMyPlan": "Reanudar mi plan",
  "cta.resume": "Reanudar",
  "fact.plan": "Plan",
  "fact.usersIncluded": "Usuarios incluidos",
  "fact.status": "Estado",
  "fact.freeTrial": "Prueba gratuita",
  "fact.trialEnds": "Fin de la prueba",
  "fact.nextBilling": "Próxima facturación",
  "started.subject": "Está suscrito a FieldQuo — {plan}",
  "started.heading": "Todo listo",
  "started.body": "Gracias por suscribirse. {company} ahora tiene el plan {plan}.",
  "started.small":
    "Su recibo y sus facturas los emite Stripe: son el comprobante para su contador. Puede cambiar o cancelar su plan en cualquier momento desde Cuenta y facturación.",
  "changed.subject": "Su plan de FieldQuo cambió a {plan}",
  "changed.heading": "Su plan cambió",
  "changed.moved": "Pasó del plan {previous} al plan {plan}.",
  "changed.now": "Ahora tiene el plan {plan}.",
  "changed.small": "Stripe calcula cualquier diferencia para el resto del período actual y la mostrará en su próxima factura.",
  "renewal.subject": "Su suscripción a FieldQuo se renueva el {date}",
  "renewal.heading": "Su suscripción se renueva pronto",
  "renewal.renews": "Su plan {plan} se renueva el {date}.",
  "renewal.cardLast4": "A la tarjeta registrada que termina en {last4} se le cobrará {amount}.",
  "renewal.card": "A su tarjeta registrada se le cobrará {amount}.",
  "renewal.small":
    "Puede cambiar de plan o cancelar en cualquier momento antes de esa fecha desde Cuenta y facturación; no se cobra nada hasta la fecha de renovación indicada arriba.",
  "grace.subjectStart": "No pudimos cobrar la tarjeta de su cuenta de FieldQuo",
  "grace.subjectRemind": "Su cuenta de FieldQuo se bloquea el {date}",
  "grace.headingStart": "No pudimos cobrar su tarjeta",
  "grace.headingRemind": "Su cuenta se bloquea el {date}",
  "grace.what":
    "No pudimos cobrar la tarjeta registrada de {company}. Casi siempre se trata de un bloqueo antifraude del banco o de una tarjeta vencida, no de algo que alguien hizo mal.",
  "grace.readonly":
    "Por ahora la cuenta está en {readOnly}: todos pueden seguir viendo cada presupuesto, factura, cliente y foto tal como están. Nadie puede crear ni enviar nada nuevo hasta que se resuelva, y {nothingDeleted}.",
  "grace.readOnlyWord": "solo lectura",
  "grace.nothingDeletedWord": "no se ha eliminado nada",
  "grace.remind":
    "La cuenta se bloquea el {date}, dentro de {days}. Actualice la tarjeta antes de esa fecha y todo seguirá funcionando exactamente como hoy.",
  "grace.start": "Tiene {days} para actualizar la tarjeta antes de que la cuenta se bloquee.",
  "grace.days.one": "{n} día",
  "grace.days.other": "{n} días",
  "grace.small": "Actualizar la tarjeta toma alrededor de un minuto, y todo vuelve en cuanto está hecho.",
  "cancelled.subjectEnding": "Su plan de FieldQuo termina el {date}",
  "cancelled.subjectEnded": "Su plan de FieldQuo fue cancelado",
  "cancelled.headingEnding": "Su plan está por terminar",
  "cancelled.headingEnded": "Su plan terminó",
  "cancelled.ending":
    "Su plan {plan} termina el {date}; no se cobrará nada más. Todo sigue funcionando hasta entonces, y puede reanudarlo en cualquier momento antes de esa fecha desde Cuenta y facturación.",
  "cancelled.ended": "Su plan {plan} fue cancelado.",
  "cancelled.nothingDeleted":
    "No se elimina nada. Sus presupuestos, clientes, facturas y el contenido de su sitio web quedan exactamente como están, y elegir un plan de nuevo vuelve a activarlo todo.",
  "cancelled.changedMind": "¿Cambió de opinión? Pulse Reanudar en Cuenta y facturación antes de esa fecha y el plan simplemente continúa.",
  "cancelled.mistake": "Si canceló por error, pulse Reanudar en Cuenta y facturación para continuar donde lo dejó.",
};

const uk = {
  yourCompany: "Ваша компанія",
  "cta.viewPlan": "Переглянути план",
  "cta.manageBilling": "Керувати оплатою",
  "cta.updateCard": "Оновити картку",
  "cta.resumeMyPlan": "Відновити мій план",
  "cta.resume": "Відновити",
  "fact.plan": "План",
  "fact.usersIncluded": "Користувачів включено",
  "fact.status": "Статус",
  "fact.freeTrial": "Безкоштовний пробний період",
  "fact.trialEnds": "Пробний період закінчується",
  "fact.nextBilling": "Наступна оплата",
  "started.subject": "Ви підписалися на FieldQuo — {plan}",
  "started.heading": "Усе готово",
  "started.body": "Дякуємо за підписку. {company} тепер на плані {plan}.",
  "started.small":
    "Квитанцію та рахунки надсилає Stripe — це документи для вашого бухгалтера. Змінити або скасувати план можна будь-коли в розділі «Обліковий запис і оплата».",
  "changed.subject": "Ваш план FieldQuo змінено на {plan}",
  "changed.heading": "Ваш план змінено",
  "changed.moved": "Ви перейшли з плану {previous} на план {plan}.",
  "changed.now": "Тепер ви на плані {plan}.",
  "changed.small": "Stripe розрахує різницю за решту поточного періоду й покаже її у вашому наступному рахунку.",
  "renewal.subject": "Ваша підписка FieldQuo поновлюється {date}",
  "renewal.heading": "Ваша підписка скоро поновиться",
  "renewal.renews": "Ваш план {plan} поновлюється {date}.",
  "renewal.cardLast4": "З картки, що закінчується на {last4}, буде списано {amount}.",
  "renewal.card": "З вашої збереженої картки буде списано {amount}.",
  "renewal.small":
    "До цієї дати ви можете змінити план або скасувати його в розділі «Обліковий запис і оплата» — до дати поновлення нічого не списується.",
  "grace.subjectStart": "Не вдалося списати кошти з картки вашого облікового запису FieldQuo",
  "grace.subjectRemind": "Ваш обліковий запис FieldQuo буде заблоковано {date}",
  "grace.headingStart": "Не вдалося списати кошти з вашої картки",
  "grace.headingRemind": "Ваш обліковий запис буде заблоковано {date}",
  "grace.what":
    "Нам не вдалося списати кошти зі збереженої картки {company}. Майже завжди це антишахрайське блокування банку або прострочена картка — ніхто нічого не зробив неправильно.",
  "grace.readonly":
    "Зараз обліковий запис працює в режимі {readOnly}: усі й далі бачать кожен кошторис, рахунок, клієнта й фото без змін. Ніхто не може створити чи надіслати нічого нового, доки це не виправлено, і {nothingDeleted}.",
  "grace.readOnlyWord": "лише для читання",
  "grace.nothingDeletedWord": "нічого не видалено",
  "grace.remind":
    "Обліковий запис буде заблоковано {date} — через {days}. Оновіть картку до цього часу, і все працюватиме так само, як сьогодні.",
  "grace.start": "У вас є {days}, щоб оновити картку, перш ніж обліковий запис буде заблоковано.",
  "grace.days.one": "{n} день",
  "grace.days.few": "{n} дні",
  "grace.days.many": "{n} днів",
  "grace.days.other": "{n} дня",
  "grace.small": "Оновлення картки займає близько хвилини, і все повертається, щойно це зроблено.",
  "cancelled.subjectEnding": "Ваш план FieldQuo закінчується {date}",
  "cancelled.subjectEnded": "Ваш план FieldQuo скасовано",
  "cancelled.headingEnding": "Ваш план закінчується",
  "cancelled.headingEnded": "Ваш план закінчився",
  "cancelled.ending":
    "Ваш план {plan} закінчується {date}; більше нічого не буде списано. До того часу все працює, і ви можете відновити план будь-коли до цієї дати в розділі «Обліковий запис і оплата».",
  "cancelled.ended": "Ваш план {plan} скасовано.",
  "cancelled.nothingDeleted":
    "Нічого не видаляється. Ваші кошториси, клієнти, рахунки та вміст сайту залишаються без змін, а вибір плану знову все вмикає.",
  "cancelled.changedMind": "Передумали? Натисніть «Відновити» в розділі «Обліковий запис і оплата» до цієї дати, і план просто продовжиться.",
  "cancelled.mistake": "Якщо ви скасували помилково, натисніть «Відновити» в розділі «Обліковий запис і оплата», щоб продовжити з того самого місця.",
};

const pa = {
  yourCompany: "ਤੁਹਾਡੀ ਕੰਪਨੀ",
  "cta.viewPlan": "ਆਪਣਾ ਪਲਾਨ ਦੇਖੋ",
  "cta.manageBilling": "ਬਿਲਿੰਗ ਸੰਭਾਲੋ",
  "cta.updateCard": "ਆਪਣਾ ਕਾਰਡ ਅੱਪਡੇਟ ਕਰੋ",
  "cta.resumeMyPlan": "ਮੇਰਾ ਪਲਾਨ ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ",
  "cta.resume": "ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ",
  "fact.plan": "ਪਲਾਨ",
  "fact.usersIncluded": "ਸ਼ਾਮਲ ਯੂਜ਼ਰ",
  "fact.status": "ਸਥਿਤੀ",
  "fact.freeTrial": "ਮੁਫ਼ਤ ਟ੍ਰਾਇਲ",
  "fact.trialEnds": "ਟ੍ਰਾਇਲ ਖ਼ਤਮ ਹੁੰਦਾ ਹੈ",
  "fact.nextBilling": "ਅਗਲੀ ਬਿਲਿੰਗ ਮਿਤੀ",
  "started.subject": "ਤੁਸੀਂ FieldQuo ਦੇ ਗਾਹਕ ਬਣ ਗਏ ਹੋ — {plan}",
  "started.heading": "ਸਭ ਤਿਆਰ ਹੈ",
  "started.body": "ਗਾਹਕ ਬਣਨ ਲਈ ਧੰਨਵਾਦ। {company} ਹੁਣ {plan} ਪਲਾਨ 'ਤੇ ਹੈ।",
  "started.small":
    "ਤੁਹਾਡੀ ਰਸੀਦ ਅਤੇ ਇਨਵੌਇਸ Stripe ਤੋਂ ਆਉਂਦੇ ਹਨ — ਇਹ ਤੁਹਾਡੇ ਅਕਾਊਂਟੈਂਟ ਲਈ ਰਿਕਾਰਡ ਹਨ। ਤੁਸੀਂ ਖਾਤਾ ਅਤੇ ਬਿਲਿੰਗ ਤੋਂ ਕਿਸੇ ਵੀ ਸਮੇਂ ਆਪਣਾ ਪਲਾਨ ਬਦਲ ਜਾਂ ਰੱਦ ਕਰ ਸਕਦੇ ਹੋ।",
  "changed.subject": "ਤੁਹਾਡਾ FieldQuo ਪਲਾਨ ਬਦਲ ਕੇ {plan} ਹੋ ਗਿਆ ਹੈ",
  "changed.heading": "ਤੁਹਾਡਾ ਪਲਾਨ ਬਦਲ ਗਿਆ ਹੈ",
  "changed.moved": "ਤੁਸੀਂ {previous} ਤੋਂ {plan} 'ਤੇ ਚਲੇ ਗਏ ਹੋ।",
  "changed.now": "ਤੁਸੀਂ ਹੁਣ {plan} ਪਲਾਨ 'ਤੇ ਹੋ।",
  "changed.small": "Stripe ਤੁਹਾਡੀ ਮੌਜੂਦਾ ਮਿਆਦ ਦੇ ਬਾਕੀ ਸਮੇਂ ਦਾ ਫ਼ਰਕ ਕੱਢਦਾ ਹੈ ਅਤੇ ਉਸਨੂੰ ਤੁਹਾਡੇ ਅਗਲੇ ਇਨਵੌਇਸ 'ਤੇ ਦਿਖਾਏਗਾ।",
  "renewal.subject": "ਤੁਹਾਡੀ FieldQuo ਗਾਹਕੀ {date} ਨੂੰ ਨਵੀਂ ਹੁੰਦੀ ਹੈ",
  "renewal.heading": "ਤੁਹਾਡੀ ਗਾਹਕੀ ਜਲਦੀ ਨਵੀਂ ਹੋਵੇਗੀ",
  "renewal.renews": "ਤੁਹਾਡਾ {plan} ਪਲਾਨ {date} ਨੂੰ ਨਵਾਂ ਹੁੰਦਾ ਹੈ।",
  "renewal.cardLast4": "{last4} 'ਤੇ ਖ਼ਤਮ ਹੋਣ ਵਾਲੇ ਸੰਭਾਲੇ ਕਾਰਡ ਤੋਂ {amount} ਲਏ ਜਾਣਗੇ।",
  "renewal.card": "ਤੁਹਾਡੇ ਸੰਭਾਲੇ ਕਾਰਡ ਤੋਂ {amount} ਲਏ ਜਾਣਗੇ।",
  "renewal.small":
    "ਉਸ ਤੋਂ ਪਹਿਲਾਂ ਤੁਸੀਂ ਕਿਸੇ ਵੀ ਸਮੇਂ ਖਾਤਾ ਅਤੇ ਬਿਲਿੰਗ ਤੋਂ ਪਲਾਨ ਬਦਲ ਜਾਂ ਰੱਦ ਕਰ ਸਕਦੇ ਹੋ — ਉੱਪਰ ਦਿੱਤੀ ਨਵਿਆਉਣ ਦੀ ਮਿਤੀ ਤੱਕ ਕੁਝ ਨਹੀਂ ਲਿਆ ਜਾਂਦਾ।",
  "grace.subjectStart": "ਅਸੀਂ ਤੁਹਾਡੇ FieldQuo ਖਾਤੇ ਦੇ ਕਾਰਡ ਤੋਂ ਭੁਗਤਾਨ ਨਹੀਂ ਲੈ ਸਕੇ",
  "grace.subjectRemind": "ਤੁਹਾਡਾ FieldQuo ਖਾਤਾ {date} ਨੂੰ ਲਾਕ ਹੋ ਜਾਵੇਗਾ",
  "grace.headingStart": "ਅਸੀਂ ਤੁਹਾਡੇ ਕਾਰਡ ਤੋਂ ਭੁਗਤਾਨ ਨਹੀਂ ਲੈ ਸਕੇ",
  "grace.headingRemind": "ਤੁਹਾਡਾ ਖਾਤਾ {date} ਨੂੰ ਲਾਕ ਹੋ ਜਾਵੇਗਾ",
  "grace.what":
    "ਅਸੀਂ {company} ਲਈ ਸੰਭਾਲੇ ਕਾਰਡ ਤੋਂ ਭੁਗਤਾਨ ਨਹੀਂ ਲੈ ਸਕੇ। ਇਹ ਲਗਭਗ ਹਮੇਸ਼ਾ ਬੈਂਕ ਦੀ ਧੋਖਾਧੜੀ ਰੋਕ ਜਾਂ ਮਿਆਦ ਪੁੱਗ ਚੁੱਕਿਆ ਕਾਰਡ ਹੁੰਦਾ ਹੈ — ਕਿਸੇ ਨੇ ਕੁਝ ਗ਼ਲਤ ਨਹੀਂ ਕੀਤਾ।",
  "grace.readonly":
    "ਇਸ ਵੇਲੇ ਖਾਤਾ {readOnly} ਹੈ: ਹਰ ਕੋਈ ਹਰ ਕੋਟ, ਇਨਵੌਇਸ, ਗਾਹਕ ਅਤੇ ਫ਼ੋਟੋ ਨੂੰ ਪਹਿਲਾਂ ਵਾਂਗ ਹੀ ਦੇਖ ਸਕਦਾ ਹੈ। ਜਦੋਂ ਤੱਕ ਇਹ ਠੀਕ ਨਹੀਂ ਹੁੰਦਾ, ਕੋਈ ਵੀ ਨਵਾਂ ਕੁਝ ਬਣਾ ਜਾਂ ਭੇਜ ਨਹੀਂ ਸਕਦਾ, ਅਤੇ {nothingDeleted}।",
  "grace.readOnlyWord": "ਸਿਰਫ਼-ਪੜ੍ਹਨ ਲਈ",
  "grace.nothingDeletedWord": "ਕੁਝ ਵੀ ਮਿਟਾਇਆ ਨਹੀਂ ਗਿਆ",
  "grace.remind":
    "ਖਾਤਾ {date} ਨੂੰ ਲਾਕ ਹੋ ਜਾਵੇਗਾ — ਯਾਨੀ ਹੁਣ ਤੋਂ {days} ਬਾਅਦ। ਉਸ ਤੋਂ ਪਹਿਲਾਂ ਕਾਰਡ ਅੱਪਡੇਟ ਕਰੋ ਅਤੇ ਸਭ ਕੁਝ ਅੱਜ ਵਾਂਗ ਹੀ ਚੱਲਦਾ ਰਹੇਗਾ।",
  "grace.start": "ਖਾਤਾ ਲਾਕ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਕਾਰਡ ਅੱਪਡੇਟ ਕਰਨ ਲਈ ਤੁਹਾਡੇ ਕੋਲ {days} ਹਨ।",
  "grace.days.one": "{n} ਦਿਨ",
  "grace.days.other": "{n} ਦਿਨ",
  "grace.small": "ਕਾਰਡ ਅੱਪਡੇਟ ਕਰਨ ਵਿੱਚ ਲਗਭਗ ਇੱਕ ਮਿੰਟ ਲੱਗਦਾ ਹੈ, ਅਤੇ ਹੁੰਦੇ ਹੀ ਸਭ ਕੁਝ ਵਾਪਸ ਆ ਜਾਂਦਾ ਹੈ।",
  "cancelled.subjectEnding": "ਤੁਹਾਡਾ FieldQuo ਪਲਾਨ {date} ਨੂੰ ਖ਼ਤਮ ਹੁੰਦਾ ਹੈ",
  "cancelled.subjectEnded": "ਤੁਹਾਡਾ FieldQuo ਪਲਾਨ ਰੱਦ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ",
  "cancelled.headingEnding": "ਤੁਹਾਡਾ ਪਲਾਨ ਖ਼ਤਮ ਹੋ ਰਿਹਾ ਹੈ",
  "cancelled.headingEnded": "ਤੁਹਾਡਾ ਪਲਾਨ ਖ਼ਤਮ ਹੋ ਗਿਆ ਹੈ",
  "cancelled.ending":
    "ਤੁਹਾਡਾ {plan} ਪਲਾਨ {date} ਨੂੰ ਖ਼ਤਮ ਹੁੰਦਾ ਹੈ; ਹੋਰ ਕੁਝ ਨਹੀਂ ਲਿਆ ਜਾਵੇਗਾ। ਉਦੋਂ ਤੱਕ ਸਭ ਕੁਝ ਚੱਲਦਾ ਰਹੇਗਾ, ਅਤੇ ਤੁਸੀਂ ਉਸ ਮਿਤੀ ਤੋਂ ਪਹਿਲਾਂ ਕਿਸੇ ਵੀ ਸਮੇਂ ਖਾਤਾ ਅਤੇ ਬਿਲਿੰਗ ਤੋਂ ਇਸਨੂੰ ਮੁੜ ਸ਼ੁਰੂ ਕਰ ਸਕਦੇ ਹੋ।",
  "cancelled.ended": "ਤੁਹਾਡਾ {plan} ਪਲਾਨ ਰੱਦ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।",
  "cancelled.nothingDeleted":
    "ਕੁਝ ਵੀ ਮਿਟਾਇਆ ਨਹੀਂ ਜਾਂਦਾ। ਤੁਹਾਡੇ ਕੋਟ, ਗਾਹਕ, ਇਨਵੌਇਸ ਅਤੇ ਵੈੱਬਸਾਈਟ ਦੀ ਸਮੱਗਰੀ ਬਿਲਕੁਲ ਉਵੇਂ ਹੀ ਰਹਿੰਦੀ ਹੈ, ਅਤੇ ਦੁਬਾਰਾ ਪਲਾਨ ਚੁਣਨ ਨਾਲ ਸਭ ਕੁਝ ਫਿਰ ਚਾਲੂ ਹੋ ਜਾਂਦਾ ਹੈ।",
  "cancelled.changedMind": "ਮਨ ਬਦਲ ਗਿਆ? ਉਸ ਮਿਤੀ ਤੋਂ ਪਹਿਲਾਂ ਖਾਤਾ ਅਤੇ ਬਿਲਿੰਗ ਵਿੱਚ ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ ਦਬਾਓ ਅਤੇ ਪਲਾਨ ਬਸ ਜਾਰੀ ਰਹੇਗਾ।",
  "cancelled.mistake": "ਜੇ ਤੁਸੀਂ ਗ਼ਲਤੀ ਨਾਲ ਰੱਦ ਕੀਤਾ ਹੈ, ਤਾਂ ਜਿੱਥੇ ਛੱਡਿਆ ਸੀ ਉੱਥੋਂ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਖਾਤਾ ਅਤੇ ਬਿਲਿੰਗ ਵਿੱਚ ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ ਦਬਾਓ।",
};

const tl = {
  yourCompany: "Ang iyong kompanya",
  "cta.viewPlan": "Tingnan ang iyong plan",
  "cta.manageBilling": "Pamahalaan ang billing",
  "cta.updateCard": "I-update ang iyong card",
  "cta.resumeMyPlan": "Ituloy ang aking plan",
  "cta.resume": "Ituloy",
  "fact.plan": "Plan",
  "fact.usersIncluded": "Kasamang user",
  "fact.status": "Status",
  "fact.freeTrial": "Libreng trial",
  "fact.trialEnds": "Matatapos ang trial",
  "fact.nextBilling": "Susunod na billing",
  "started.subject": "Naka-subscribe ka na sa FieldQuo — {plan}",
  "started.heading": "Handa na ang lahat",
  "started.body": "Salamat sa pag-subscribe. Nasa {plan} plan na ngayon ang {company}.",
  "started.small":
    "Galing sa Stripe ang iyong resibo at mga invoice — iyon ang rekord para sa iyong accountant. Maaari mong palitan o kanselahin ang iyong plan anumang oras mula sa Account at Billing.",
  "changed.subject": "Napalitan ang iyong FieldQuo plan sa {plan}",
  "changed.heading": "Napalitan ang iyong plan",
  "changed.moved": "Lumipat ka mula {previous} papuntang {plan}.",
  "changed.now": "Nasa {plan} plan ka na ngayon.",
  "changed.small": "Kinukuwenta ng Stripe ang anumang diperensya para sa natitirang bahagi ng kasalukuyang period at ipapakita ito sa susunod mong invoice.",
  "renewal.subject": "Magre-renew ang iyong FieldQuo subscription sa {date}",
  "renewal.heading": "Malapit nang mag-renew ang iyong subscription",
  "renewal.renews": "Magre-renew ang iyong {plan} plan sa {date}.",
  "renewal.cardLast4": "Sisingilin ng {amount} ang naka-file na card na nagtatapos sa {last4}.",
  "renewal.card": "Sisingilin ng {amount} ang iyong naka-file na card.",
  "renewal.small":
    "Maaari kang magpalit ng plan o magkansela anumang oras bago iyon mula sa Account at Billing — walang sisingilin hanggang sa petsa ng renewal sa itaas.",
  "grace.subjectStart": "Hindi namin masingil ang card ng iyong FieldQuo account",
  "grace.subjectRemind": "Mala-lock ang iyong FieldQuo account sa {date}",
  "grace.headingStart": "Hindi namin masingil ang iyong card",
  "grace.headingRemind": "Mala-lock ang iyong account sa {date}",
  "grace.what":
    "Hindi namin nasingil ang naka-file na card ng {company}. Halos palagi itong fraud hold ng bangko o expired na card — hindi ito pagkakamali ng kahit sino.",
  "grace.readonly":
    "Sa ngayon, {readOnly} ang account: makikita pa rin ng lahat ang bawat quote, invoice, kliyente at larawan nang eksakto. Walang makakagawa o makakapagpadala ng anumang bago hangga't hindi ito naaayos, at {nothingDeleted}.",
  "grace.readOnlyWord": "read-only",
  "grace.nothingDeletedWord": "walang binura",
  "grace.remind":
    "Mala-lock ang account sa {date} — {days} mula ngayon. I-update ang card bago iyon at gagana pa rin ang lahat gaya ngayon.",
  "grace.start": "May {days} ka para i-update ang card bago ma-lock ang account.",
  "grace.days.one": "{n} araw",
  "grace.days.other": "{n} araw",
  "grace.small": "Mga isang minuto lang ang pag-update ng card, at babalik ang lahat sa sandaling matapos ito.",
  "cancelled.subjectEnding": "Matatapos ang iyong FieldQuo plan sa {date}",
  "cancelled.subjectEnded": "Nakansela na ang iyong FieldQuo plan",
  "cancelled.headingEnding": "Matatapos na ang iyong plan",
  "cancelled.headingEnded": "Natapos na ang iyong plan",
  "cancelled.ending":
    "Matatapos ang iyong {plan} plan sa {date}; wala nang sisingilin pa. Gagana ang lahat hanggang noon, at maaari mo itong ituloy anumang oras bago ang petsang iyon mula sa Account at Billing.",
  "cancelled.ended": "Nakansela na ang iyong {plan} plan.",
  "cancelled.nothingDeleted":
    "Walang binubura. Mananatili nang eksakto ang iyong mga quote, kliyente, invoice at nilalaman ng website, at ang pagpili muli ng plan ay magbubukas muli ng lahat.",
  "cancelled.changedMind": "Nagbago ang isip mo? Pindutin ang Ituloy sa Account at Billing bago ang petsang iyon at magpapatuloy lang ang plan.",
  "cancelled.mistake": "Kung nagkansela ka nang hindi sinasadya, pindutin ang Ituloy sa Account at Billing para ipagpatuloy kung saan ka tumigil.",
};

const de = {
  yourCompany: "Ihr Betrieb",
  "cta.viewPlan": "Tarif ansehen",
  "cta.manageBilling": "Abrechnung verwalten",
  "cta.updateCard": "Karte aktualisieren",
  "cta.resumeMyPlan": "Meinen Tarif fortsetzen",
  "cta.resume": "Fortsetzen",
  "fact.plan": "Tarif",
  "fact.usersIncluded": "Enthaltene Benutzer",
  "fact.status": "Status",
  "fact.freeTrial": "Kostenlose Testphase",
  "fact.trialEnds": "Testphase endet",
  "fact.nextBilling": "Nächste Abrechnung",
  "started.subject": "Sie haben FieldQuo abonniert — {plan}",
  "started.heading": "Alles bereit",
  "started.body": "Danke für Ihr Abonnement. {company} ist jetzt im Tarif {plan}.",
  "started.small":
    "Ihre Quittung und Ihre Rechnungen kommen von Stripe — sie sind der Beleg für Ihre Buchhaltung. Sie können Ihren Tarif jederzeit unter Konto &amp; Abrechnung ändern oder kündigen.",
  "changed.subject": "Ihr FieldQuo-Tarif wurde auf {plan} geändert",
  "changed.heading": "Ihr Tarif wurde geändert",
  "changed.moved": "Sie sind vom Tarif {previous} in den Tarif {plan} gewechselt.",
  "changed.now": "Sie sind jetzt im Tarif {plan}.",
  "changed.small": "Stripe berechnet eine etwaige Differenz für den Rest des laufenden Zeitraums und zeigt sie auf Ihrer nächsten Rechnung.",
  "renewal.subject": "Ihr FieldQuo-Abonnement verlängert sich am {date}",
  "renewal.heading": "Ihr Abonnement verlängert sich bald",
  "renewal.renews": "Ihr Tarif {plan} verlängert sich am {date}.",
  "renewal.cardLast4": "Die hinterlegte Karte mit der Endung {last4} wird mit {amount} belastet.",
  "renewal.card": "Ihre hinterlegte Karte wird mit {amount} belastet.",
  "renewal.small":
    "Bis dahin können Sie unter Konto &amp; Abrechnung jederzeit den Tarif wechseln oder kündigen — vor dem oben genannten Verlängerungsdatum wird nichts belastet.",
  "grace.subjectStart": "Wir konnten die Karte Ihres FieldQuo-Kontos nicht belasten",
  "grace.subjectRemind": "Ihr FieldQuo-Konto wird am {date} gesperrt",
  "grace.headingStart": "Wir konnten Ihre Karte nicht belasten",
  "grace.headingRemind": "Ihr Konto wird am {date} gesperrt",
  "grace.what":
    "Wir konnten die hinterlegte Karte für {company} nicht belasten. Das ist fast immer eine Betrugssperre der Bank oder eine abgelaufene Karte — niemand hat etwas falsch gemacht.",
  "grace.readonly":
    "Im Moment ist das Konto {readOnly}: Alle sehen weiterhin jedes Angebot, jede Rechnung, jeden Kunden und jedes Foto unverändert. Niemand kann etwas Neues erstellen oder senden, bis es behoben ist, und {nothingDeleted}.",
  "grace.readOnlyWord": "schreibgeschützt",
  "grace.nothingDeletedWord": "es wurde nichts gelöscht",
  "grace.remind":
    "Das Konto wird am {date} gesperrt — Sie haben also noch {days} Zeit. Aktualisieren Sie die Karte vorher, und alles funktioniert weiter genau wie heute.",
  "grace.start": "Sie haben noch {days} Zeit, die Karte zu aktualisieren, bevor das Konto gesperrt wird.",
  "grace.days.one": "{n} Tag",
  "grace.days.other": "{n} Tage",
  "grace.small": "Die Karte zu aktualisieren dauert etwa eine Minute, und alles ist wieder da, sobald es erledigt ist.",
  "cancelled.subjectEnding": "Ihr FieldQuo-Tarif endet am {date}",
  "cancelled.subjectEnded": "Ihr FieldQuo-Tarif wurde gekündigt",
  "cancelled.headingEnding": "Ihr Tarif endet",
  "cancelled.headingEnded": "Ihr Tarif ist beendet",
  "cancelled.ending":
    "Ihr Tarif {plan} endet am {date}; es wird nichts mehr berechnet. Bis dahin funktioniert alles weiter, und Sie können ihn jederzeit vor diesem Datum unter Konto &amp; Abrechnung fortsetzen.",
  "cancelled.ended": "Ihr Tarif {plan} wurde gekündigt.",
  "cancelled.nothingDeleted":
    "Es wird nichts gelöscht. Ihre Angebote, Kunden, Rechnungen und Website-Inhalte bleiben genau so, wie sie sind, und mit einem neuen Tarif ist alles wieder eingeschaltet.",
  "cancelled.changedMind": "Anders entschieden? Drücken Sie vor diesem Datum unter Konto &amp; Abrechnung auf Fortsetzen, und der Tarif läuft einfach weiter.",
  "cancelled.mistake": "Wenn Sie versehentlich gekündigt haben, drücken Sie unter Konto &amp; Abrechnung auf Fortsetzen, um dort weiterzumachen, wo Sie aufgehört haben.",
};

const zh = {
  yourCompany: "你的公司",
  "cta.viewPlan": "查看你的套餐",
  "cta.manageBilling": "管理账单",
  "cta.updateCard": "更新你的银行卡",
  "cta.resumeMyPlan": "恢复我的套餐",
  "cta.resume": "恢复",
  "fact.plan": "套餐",
  "fact.usersIncluded": "包含用户数",
  "fact.status": "状态",
  "fact.freeTrial": "免费试用",
  "fact.trialEnds": "试用结束",
  "fact.nextBilling": "下次扣款日期",
  "started.subject": "你已订阅 FieldQuo — {plan}",
  "started.heading": "一切就绪",
  "started.body": "感谢订阅。{company} 现在使用 {plan} 套餐。",
  "started.small": "收据和发票由 Stripe 发出，是交给会计的凭证。你可以随时在“账户与账单”中更改或取消套餐。",
  "changed.subject": "你的 FieldQuo 套餐已更改为 {plan}",
  "changed.heading": "你的套餐已更改",
  "changed.moved": "你已从 {previous} 套餐换到 {plan} 套餐。",
  "changed.now": "你现在使用 {plan} 套餐。",
  "changed.small": "Stripe 会计算本期剩余时间的差额，并显示在你的下一张发票上。",
  "renewal.subject": "你的 FieldQuo 订阅将于 {date} 续订",
  "renewal.heading": "你的订阅即将续订",
  "renewal.renews": "你的 {plan} 套餐将于 {date} 续订。",
  "renewal.cardLast4": "尾号为 {last4} 的已存银行卡将被扣款 {amount}。",
  "renewal.card": "你的已存银行卡将被扣款 {amount}。",
  "renewal.small": "在此之前，你可以随时在“账户与账单”中更换套餐或取消 — 在上面的续订日期之前不会扣任何费用。",
  "grace.subjectStart": "我们无法从你的 FieldQuo 账户银行卡扣款",
  "grace.subjectRemind": "你的 FieldQuo 账户将于 {date} 锁定",
  "grace.headingStart": "我们无法从你的银行卡扣款",
  "grace.headingRemind": "你的账户将于 {date} 锁定",
  "grace.what": "我们无法从 {company} 的已存银行卡扣款。这几乎总是银行的防欺诈冻结或银行卡已过期，并不是谁做错了什么。",
  "grace.readonly":
    "目前账户处于{readOnly}状态：每个人仍然可以原样查看每份报价、发票、客户和照片。在问题解决之前，任何人都不能创建或发送新的内容，而且{nothingDeleted}。",
  "grace.readOnlyWord": "只读",
  "grace.nothingDeletedWord": "没有删除任何内容",
  "grace.remind": "账户将于 {date} 锁定 — 距今还有 {days}。在此之前更新银行卡，一切都会像今天一样正常运作。",
  "grace.start": "在账户锁定之前，你有 {days} 的时间更新银行卡。",
  "grace.days.other": "{n} 天",
  "grace.small": "更新银行卡大约只需一分钟，完成后一切立即恢复。",
  "cancelled.subjectEnding": "你的 FieldQuo 套餐将于 {date} 结束",
  "cancelled.subjectEnded": "你的 FieldQuo 套餐已取消",
  "cancelled.headingEnding": "你的套餐即将结束",
  "cancelled.headingEnded": "你的套餐已结束",
  "cancelled.ending": "你的 {plan} 套餐将于 {date} 结束，之后不会再扣任何费用。在那之前一切照常运作，你也可以在该日期之前随时在“账户与账单”中恢复。",
  "cancelled.ended": "你的 {plan} 套餐已取消。",
  "cancelled.nothingDeleted": "不会删除任何内容。你的报价、客户、发票和网站内容都会原样保留，重新选择套餐即可全部恢复。",
  "cancelled.changedMind": "改变主意了？在该日期之前到“账户与账单”中按“恢复”，套餐就会继续。",
  "cancelled.mistake": "如果你是误取消的，到“账户与账单”中按“恢复”即可从中断的地方继续。",
};

const it = {
  yourCompany: "La sua impresa",
  "cta.viewPlan": "Vedi il suo piano",
  "cta.manageBilling": "Gestisci la fatturazione",
  "cta.updateCard": "Aggiorna la carta",
  "cta.resumeMyPlan": "Riprendi il mio piano",
  "cta.resume": "Riprendi",
  "fact.plan": "Piano",
  "fact.usersIncluded": "Utenti inclusi",
  "fact.status": "Stato",
  "fact.freeTrial": "Prova gratuita",
  "fact.trialEnds": "Fine della prova",
  "fact.nextBilling": "Prossimo addebito",
  "started.subject": "Ha sottoscritto FieldQuo — {plan}",
  "started.heading": "Tutto pronto",
  "started.body": "Grazie per l'abbonamento. {company} ora ha il piano {plan}.",
  "started.small":
    "La ricevuta e le fatture arrivano da Stripe: sono il documento per il suo commercialista. Può cambiare o annullare il piano in qualsiasi momento da Account e fatturazione.",
  "changed.subject": "Il suo piano FieldQuo è passato a {plan}",
  "changed.heading": "Il suo piano è cambiato",
  "changed.moved": "È passato dal piano {previous} al piano {plan}.",
  "changed.now": "Ora ha il piano {plan}.",
  "changed.small": "Stripe calcola l'eventuale differenza per il resto del periodo in corso e la mostrerà sulla prossima fattura.",
  "renewal.subject": "Il suo abbonamento FieldQuo si rinnova il {date}",
  "renewal.heading": "Il suo abbonamento si rinnova a breve",
  "renewal.renews": "Il suo piano {plan} si rinnova il {date}.",
  "renewal.cardLast4": "Sulla carta registrata che termina con {last4} verranno addebitati {amount}.",
  "renewal.card": "Sulla sua carta registrata verranno addebitati {amount}.",
  "renewal.small":
    "Fino ad allora può cambiare piano o annullare in qualsiasi momento da Account e fatturazione: nulla viene addebitato prima della data di rinnovo indicata sopra.",
  "grace.subjectStart": "Non siamo riusciti ad addebitare la carta del suo account FieldQuo",
  "grace.subjectRemind": "Il suo account FieldQuo verrà bloccato il {date}",
  "grace.headingStart": "Non siamo riusciti ad addebitare la sua carta",
  "grace.headingRemind": "Il suo account verrà bloccato il {date}",
  "grace.what":
    "Non siamo riusciti ad addebitare la carta registrata per {company}. Quasi sempre si tratta di un blocco antifrode della banca o di una carta scaduta, non di un errore di qualcuno.",
  "grace.readonly":
    "Per ora l'account è in {readOnly}: tutti possono ancora vedere ogni preventivo, fattura, cliente e foto esattamente com'è. Nessuno può creare o inviare nulla di nuovo finché non è risolto, e {nothingDeleted}.",
  "grace.readOnlyWord": "sola lettura",
  "grace.nothingDeletedWord": "non è stato eliminato nulla",
  "grace.remind":
    "L'account verrà bloccato il {date}, tra {days}. Aggiorni la carta prima di allora e tutto continuerà a funzionare esattamente come oggi.",
  "grace.start": "Ha {days} per aggiornare la carta prima che l'account venga bloccato.",
  "grace.days.one": "{n} giorno",
  "grace.days.other": "{n} giorni",
  "grace.small": "Aggiornare la carta richiede circa un minuto, e tutto torna appena fatto.",
  "cancelled.subjectEnding": "Il suo piano FieldQuo termina il {date}",
  "cancelled.subjectEnded": "Il suo piano FieldQuo è stato annullato",
  "cancelled.headingEnding": "Il suo piano sta per terminare",
  "cancelled.headingEnded": "Il suo piano è terminato",
  "cancelled.ending":
    "Il suo piano {plan} termina il {date}; non verrà addebitato altro. Fino ad allora tutto continua a funzionare, e può riprenderlo in qualsiasi momento prima di quella data da Account e fatturazione.",
  "cancelled.ended": "Il suo piano {plan} è stato annullato.",
  "cancelled.nothingDeleted":
    "Non viene eliminato nulla. Preventivi, clienti, fatture e contenuti del sito restano esattamente come sono, e scegliendo di nuovo un piano si riattiva tutto.",
  "cancelled.changedMind": "Ha cambiato idea? Prema Riprendi in Account e fatturazione prima di quella data e il piano continua semplicemente.",
  "cancelled.mistake": "Se ha annullato per errore, prema Riprendi in Account e fatturazione per riprendere da dove si era fermato.",
};

export const BILLING_EMAIL_COPY = { en, fr, es, uk, pa, tl, de, zh, it };

/** Every key the English letters use — the set every language is held to. */
export const BILLING_EMAIL_KEYS = Object.keys(en);

/**
 * The words for one language, merged over English per KEY — the rule
 * lib/i18n/emailCopy.js learned the hard way: a language missing one new key
 * must print the English sentence, never "undefined". Own-property lookup,
 * so "__proto__" reads English.
 */
export function billingEmailCopy(language = "en") {
  const code = String(language || "en").toLowerCase();
  const dict = Object.prototype.hasOwnProperty.call(BILLING_EMAIL_COPY, code) ? BILLING_EMAIL_COPY[code] : null;
  return dict && code !== "en" ? { ...en, ...dict } : en;
}

/** True when this file has a letter in `language` (not the English fallback). */
export function hasBillingEmailLanguage(language) {
  return Object.prototype.hasOwnProperty.call(BILLING_EMAIL_COPY, String(language || "").toLowerCase());
}
