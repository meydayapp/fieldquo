// lib/i18n/accountNoticeCopy.js
//
// FieldQuo → company letters about the company's own account that are not
// the subscription letters (those are lib/i18n/billingEmailCopy.js):
//
//   referrer.* / referee.*   the referral month landing (lib/referrals/rewardEmail.js)
//   ai.*                     AI credit running low (lib/ai/creditLow.js)
//   winBack.*                two weeks after a cancellation took effect
//   updates.*                the monthly product-updates letter
//
// The last two are CONTENT ONLY (lib/lifecycle/winBack.js,
// lib/lifecycle/productNewsletter.js): they are marketing, and they wait for
// the email-preferences / List-Unsubscribe system before anything sends them
// (docs/ROADMAP.md says so).
//
// Every language the app catalogue carries (APP_MESSAGES: en fr es uk pa tl
// de zh it); scripts/check-billing-lifecycle-emails.mjs holds every language to the
// English keys and to the same {placeholders}. Values are TEXT — the builders
// escape them, and bold the placeholder values — except none here carry
// markup at all, so a translator never has to think about HTML.
//
// Careful translations of short transactional copy, not a native speaker's —
// the standing APP_REVIEW_PENDING gives the same languages in the app.
// Never machine-translated at send time.

const en = {
  "referrer.subject": "You earned a free month of FieldQuo",
  "referrer.heading": "You earned a free month",
  "referrer.intro": "{referred}, the business you referred to FieldQuo, has made its first payment — so {company} gets a month of FieldQuo free.",
  "referrer.subscription": "There's nothing to do: your next charge has moved to {date}.",
  "referrer.trial": "There's nothing to do: your free trial now runs to {date}.",
  "referrer.more": "Every business you refer that becomes a paying FieldQuo customer can earn you another month.",
  "referrer.cta": "Refer another business",
  "referee.subject": "Your free month of FieldQuo is applied",
  "referee.heading": "Your free month is applied",
  "referee.intro": "You joined FieldQuo through {referrer}'s referral link, so {company} gets a month of FieldQuo free.",
  "referee.subscription": "There's nothing to do: your first charge has moved to {date}.",
  "referee.trial": "There's nothing to do: your free trial now runs to {date}.",
  "referee.cta": "View your plan",
  "ai.subject": "Your FieldQuo AI credit is running low",
  "ai.heading": "AI credit is running low",
  "ai.balance": "{company} has {balance} of AI credit left.",
  "ai.what":
    "When it runs out, the AI features paid from it stop until you top up: your AI employee hands its conversations to you, and AI pictures, photo review, material lists and drawing reads wait for credit. Everything else in FieldQuo keeps working.",
  "ai.topups": "Top-ups don't expire.",
  "ai.once": "You'll get this email again only after a top-up, if the balance runs low again.",
  "ai.cta": "Top up AI credit",
  "winBack.subject": "Your FieldQuo account is still here",
  "winBack.preheader": "Nothing was deleted — choose a plan and everything comes back.",
  "winBack.heading": "Everything you left is still here",
  "winBack.intro": "It's been two weeks since {company}'s FieldQuo plan ended. Your quotes, clients, invoices and photos are exactly where you left them — nothing has been deleted.",
  "winBack.readonly": "You can still look at everything until {date}. After that the account locks until a plan is chosen, and still nothing is deleted.",
  "winBack.updates": "New in FieldQuo since you left:",
  "winBack.cta": "Choose a plan",
  "updates.subject": "What's new in FieldQuo — {month}",
  "updates.heading": "What's new in FieldQuo",
  "updates.intro": "Here's what changed in FieldQuo in {month}.",
  "updates.readMore": "Read the full update",
  "updates.cta": "See all product updates",
};

const fr = {
  "referrer.subject": "Vous avez gagné un mois gratuit de FieldQuo",
  "referrer.heading": "Vous avez gagné un mois gratuit",
  "referrer.intro": "{referred}, l'entreprise que vous avez parrainée sur FieldQuo, a fait son premier paiement — {company} obtient donc un mois de FieldQuo gratuit.",
  "referrer.subscription": "Vous n'avez rien à faire : votre prochain prélèvement est reporté au {date}.",
  "referrer.trial": "Vous n'avez rien à faire : votre essai gratuit dure maintenant jusqu'au {date}.",
  "referrer.more": "Chaque entreprise que vous parrainez et qui devient cliente payante de FieldQuo peut vous valoir un autre mois.",
  "referrer.cta": "Parrainer une autre entreprise",
  "referee.subject": "Votre mois gratuit de FieldQuo est appliqué",
  "referee.heading": "Votre mois gratuit est appliqué",
  "referee.intro": "Vous vous êtes inscrit à FieldQuo par le lien de parrainage de {referrer}, donc {company} obtient un mois de FieldQuo gratuit.",
  "referee.subscription": "Vous n'avez rien à faire : votre premier prélèvement est reporté au {date}.",
  "referee.trial": "Vous n'avez rien à faire : votre essai gratuit dure maintenant jusqu'au {date}.",
  "referee.cta": "Voir votre forfait",
  "ai.subject": "Votre crédit IA FieldQuo est presque épuisé",
  "ai.heading": "Le crédit IA est presque épuisé",
  "ai.balance": "Il reste {balance} de crédit IA à {company}.",
  "ai.what":
    "Quand il sera épuisé, les fonctions IA qu'il paie s'arrêteront jusqu'à ce que vous rechargiez : votre employé IA vous confiera ses conversations, et les images IA, la revue de photos, les listes de matériaux et la lecture de plans attendront du crédit. Tout le reste de FieldQuo continue de fonctionner.",
  "ai.topups": "Les recharges n'expirent pas.",
  "ai.once": "Vous ne recevrez ce courriel de nouveau qu'après une recharge, si le solde redevient bas.",
  "ai.cta": "Recharger le crédit IA",
  "winBack.subject": "Votre compte FieldQuo est toujours là",
  "winBack.preheader": "Rien n'a été supprimé — choisissez un forfait et tout revient.",
  "winBack.heading": "Tout ce que vous avez laissé est toujours là",
  "winBack.intro": "Cela fait deux semaines que le forfait FieldQuo de {company} a pris fin. Vos soumissions, clients, factures et photos sont exactement là où vous les avez laissés — rien n'a été supprimé.",
  "winBack.readonly": "Vous pouvez encore tout consulter jusqu'au {date}. Ensuite, le compte est verrouillé jusqu'au choix d'un forfait, et rien n'est supprimé pour autant.",
  "winBack.updates": "Nouveau dans FieldQuo depuis votre départ :",
  "winBack.cta": "Choisir un forfait",
  "updates.subject": "Quoi de neuf dans FieldQuo — {month}",
  "updates.heading": "Quoi de neuf dans FieldQuo",
  "updates.intro": "Voici ce qui a changé dans FieldQuo en {month}.",
  "updates.readMore": "Lire la mise à jour complète",
  "updates.cta": "Voir toutes les nouveautés",
};

const es = {
  "referrer.subject": "Ganó un mes gratis de FieldQuo",
  "referrer.heading": "Ganó un mes gratis",
  "referrer.intro": "{referred}, el negocio que usted refirió a FieldQuo, hizo su primer pago, así que {company} recibe un mes de FieldQuo gratis.",
  "referrer.subscription": "No tiene que hacer nada: su próximo cobro pasó al {date}.",
  "referrer.trial": "No tiene que hacer nada: su prueba gratuita ahora dura hasta el {date}.",
  "referrer.more": "Cada negocio que refiera y que se convierta en cliente de pago de FieldQuo puede darle otro mes.",
  "referrer.cta": "Referir otro negocio",
  "referee.subject": "Su mes gratis de FieldQuo está aplicado",
  "referee.heading": "Su mes gratis está aplicado",
  "referee.intro": "Se unió a FieldQuo con el enlace de referido de {referrer}, así que {company} recibe un mes de FieldQuo gratis.",
  "referee.subscription": "No tiene que hacer nada: su primer cobro pasó al {date}.",
  "referee.trial": "No tiene que hacer nada: su prueba gratuita ahora dura hasta el {date}.",
  "referee.cta": "Ver su plan",
  "ai.subject": "Su crédito de IA de FieldQuo se está agotando",
  "ai.heading": "El crédito de IA se está agotando",
  "ai.balance": "A {company} le quedan {balance} de crédito de IA.",
  "ai.what":
    "Cuando se agote, las funciones de IA que se pagan con él se detienen hasta que recargue: su empleado de IA le pasará sus conversaciones, y las imágenes con IA, la revisión de fotos, las listas de materiales y la lectura de planos esperarán crédito. Todo lo demás en FieldQuo sigue funcionando.",
  "ai.topups": "Las recargas no vencen.",
  "ai.once": "Solo volverá a recibir este correo después de una recarga, si el saldo vuelve a bajar.",
  "ai.cta": "Recargar crédito de IA",
  "winBack.subject": "Su cuenta de FieldQuo sigue aquí",
  "winBack.preheader": "No se eliminó nada: elija un plan y todo vuelve.",
  "winBack.heading": "Todo lo que dejó sigue aquí",
  "winBack.intro": "Han pasado dos semanas desde que terminó el plan de FieldQuo de {company}. Sus presupuestos, clientes, facturas y fotos están exactamente donde los dejó: no se eliminó nada.",
  "winBack.readonly": "Puede seguir consultándolo todo hasta el {date}. Después, la cuenta se bloquea hasta que se elija un plan, y aun así no se elimina nada.",
  "winBack.updates": "Novedades en FieldQuo desde que se fue:",
  "winBack.cta": "Elegir un plan",
  "updates.subject": "Novedades de FieldQuo — {month}",
  "updates.heading": "Novedades de FieldQuo",
  "updates.intro": "Esto es lo que cambió en FieldQuo en {month}.",
  "updates.readMore": "Leer la actualización completa",
  "updates.cta": "Ver todas las novedades",
};

const uk = {
  "referrer.subject": "Ви отримали безкоштовний місяць FieldQuo",
  "referrer.heading": "Ви отримали безкоштовний місяць",
  "referrer.intro": "{referred}, бізнес, який ви запросили до FieldQuo, здійснив перший платіж — тож {company} отримує місяць FieldQuo безкоштовно.",
  "referrer.subscription": "Нічого робити не потрібно: наступне списання перенесено на {date}.",
  "referrer.trial": "Нічого робити не потрібно: ваш безкоштовний пробний період тепер триває до {date}.",
  "referrer.more": "Кожен запрошений вами бізнес, який стане платним клієнтом FieldQuo, може принести вам ще один місяць.",
  "referrer.cta": "Запросити інший бізнес",
  "referee.subject": "Ваш безкоштовний місяць FieldQuo застосовано",
  "referee.heading": "Ваш безкоштовний місяць застосовано",
  "referee.intro": "Ви приєдналися до FieldQuo за реферальним посиланням {referrer}, тож {company} отримує місяць FieldQuo безкоштовно.",
  "referee.subscription": "Нічого робити не потрібно: перше списання перенесено на {date}.",
  "referee.trial": "Нічого робити не потрібно: ваш безкоштовний пробний період тепер триває до {date}.",
  "referee.cta": "Переглянути план",
  "ai.subject": "Ваш кредит ШІ у FieldQuo закінчується",
  "ai.heading": "Кредит ШІ закінчується",
  "ai.balance": "У {company} залишилося {balance} кредиту ШІ.",
  "ai.what":
    "Коли він закінчиться, функції ШІ, які з нього оплачуються, зупиняться, доки ви не поповните баланс: ваш ШІ-працівник передасть розмови вам, а зображення ШІ, перевірка фото, списки матеріалів і читання креслень чекатимуть на кредит. Усе інше у FieldQuo працює далі.",
  "ai.topups": "Поповнення не згорають.",
  "ai.once": "Цей лист прийде знову лише після поповнення, якщо баланс знову стане низьким.",
  "ai.cta": "Поповнити кредит ШІ",
  "winBack.subject": "Ваш обліковий запис FieldQuo досі тут",
  "winBack.preheader": "Нічого не видалено — оберіть план, і все повернеться.",
  "winBack.heading": "Усе, що ви залишили, досі тут",
  "winBack.intro": "Минуло два тижні відтоді, як закінчився план FieldQuo для {company}. Ваші кошториси, клієнти, рахунки й фото там, де ви їх залишили, — нічого не видалено.",
  "winBack.readonly": "Ви ще можете все переглядати до {date}. Після цього обліковий запис блокується, доки не буде обрано план, і все одно нічого не видаляється.",
  "winBack.updates": "Нове у FieldQuo відтоді, як ви пішли:",
  "winBack.cta": "Обрати план",
  "updates.subject": "Що нового у FieldQuo — {month}",
  "updates.heading": "Що нового у FieldQuo",
  "updates.intro": "Ось що змінилося у FieldQuo за {month}.",
  "updates.readMore": "Читати повністю",
  "updates.cta": "Усі оновлення продукту",
};

const pa = {
  "referrer.subject": "ਤੁਸੀਂ FieldQuo ਦਾ ਇੱਕ ਮੁਫ਼ਤ ਮਹੀਨਾ ਕਮਾਇਆ ਹੈ",
  "referrer.heading": "ਤੁਸੀਂ ਇੱਕ ਮੁਫ਼ਤ ਮਹੀਨਾ ਕਮਾਇਆ ਹੈ",
  "referrer.intro": "{referred}, ਜਿਸ ਕਾਰੋਬਾਰ ਨੂੰ ਤੁਸੀਂ FieldQuo ਲਈ ਰੈਫ਼ਰ ਕੀਤਾ ਸੀ, ਨੇ ਆਪਣਾ ਪਹਿਲਾ ਭੁਗਤਾਨ ਕਰ ਦਿੱਤਾ ਹੈ — ਇਸ ਲਈ {company} ਨੂੰ FieldQuo ਦਾ ਇੱਕ ਮਹੀਨਾ ਮੁਫ਼ਤ ਮਿਲਦਾ ਹੈ।",
  "referrer.subscription": "ਤੁਹਾਨੂੰ ਕੁਝ ਨਹੀਂ ਕਰਨਾ ਪਵੇਗਾ: ਤੁਹਾਡਾ ਅਗਲਾ ਭੁਗਤਾਨ {date} 'ਤੇ ਚਲਾ ਗਿਆ ਹੈ।",
  "referrer.trial": "ਤੁਹਾਨੂੰ ਕੁਝ ਨਹੀਂ ਕਰਨਾ ਪਵੇਗਾ: ਤੁਹਾਡਾ ਮੁਫ਼ਤ ਟ੍ਰਾਇਲ ਹੁਣ {date} ਤੱਕ ਚੱਲਦਾ ਹੈ।",
  "referrer.more": "ਤੁਹਾਡੇ ਵੱਲੋਂ ਰੈਫ਼ਰ ਕੀਤਾ ਹਰ ਕਾਰੋਬਾਰ ਜੋ FieldQuo ਦਾ ਭੁਗਤਾਨ ਕਰਨ ਵਾਲਾ ਗਾਹਕ ਬਣਦਾ ਹੈ, ਤੁਹਾਨੂੰ ਇੱਕ ਹੋਰ ਮਹੀਨਾ ਦਿਵਾ ਸਕਦਾ ਹੈ।",
  "referrer.cta": "ਇੱਕ ਹੋਰ ਕਾਰੋਬਾਰ ਰੈਫ਼ਰ ਕਰੋ",
  "referee.subject": "FieldQuo ਦਾ ਤੁਹਾਡਾ ਮੁਫ਼ਤ ਮਹੀਨਾ ਲਾਗੂ ਹੋ ਗਿਆ ਹੈ",
  "referee.heading": "ਤੁਹਾਡਾ ਮੁਫ਼ਤ ਮਹੀਨਾ ਲਾਗੂ ਹੋ ਗਿਆ ਹੈ",
  "referee.intro": "ਤੁਸੀਂ {referrer} ਦੇ ਰੈਫ਼ਰਲ ਲਿੰਕ ਰਾਹੀਂ FieldQuo ਨਾਲ ਜੁੜੇ, ਇਸ ਲਈ {company} ਨੂੰ FieldQuo ਦਾ ਇੱਕ ਮਹੀਨਾ ਮੁਫ਼ਤ ਮਿਲਦਾ ਹੈ।",
  "referee.subscription": "ਤੁਹਾਨੂੰ ਕੁਝ ਨਹੀਂ ਕਰਨਾ ਪਵੇਗਾ: ਤੁਹਾਡਾ ਪਹਿਲਾ ਭੁਗਤਾਨ {date} 'ਤੇ ਚਲਾ ਗਿਆ ਹੈ।",
  "referee.trial": "ਤੁਹਾਨੂੰ ਕੁਝ ਨਹੀਂ ਕਰਨਾ ਪਵੇਗਾ: ਤੁਹਾਡਾ ਮੁਫ਼ਤ ਟ੍ਰਾਇਲ ਹੁਣ {date} ਤੱਕ ਚੱਲਦਾ ਹੈ।",
  "referee.cta": "ਆਪਣਾ ਪਲਾਨ ਦੇਖੋ",
  "ai.subject": "ਤੁਹਾਡਾ FieldQuo AI ਕ੍ਰੈਡਿਟ ਘੱਟ ਰਿਹਾ ਹੈ",
  "ai.heading": "AI ਕ੍ਰੈਡਿਟ ਘੱਟ ਰਿਹਾ ਹੈ",
  "ai.balance": "{company} ਕੋਲ {balance} ਦਾ AI ਕ੍ਰੈਡਿਟ ਬਾਕੀ ਹੈ।",
  "ai.what":
    "ਜਦੋਂ ਇਹ ਖ਼ਤਮ ਹੋ ਜਾਵੇਗਾ, ਇਸ ਤੋਂ ਭੁਗਤਾਨ ਹੋਣ ਵਾਲੀਆਂ AI ਸਹੂਲਤਾਂ ਟੌਪ-ਅੱਪ ਤੱਕ ਰੁਕ ਜਾਣਗੀਆਂ: ਤੁਹਾਡਾ AI ਕਰਮਚਾਰੀ ਆਪਣੀਆਂ ਗੱਲਬਾਤਾਂ ਤੁਹਾਨੂੰ ਸੌਂਪ ਦੇਵੇਗਾ, ਅਤੇ AI ਤਸਵੀਰਾਂ, ਫ਼ੋਟੋ ਸਮੀਖਿਆ, ਸਮੱਗਰੀ ਸੂਚੀਆਂ ਅਤੇ ਡਰਾਇੰਗ ਪੜ੍ਹਨਾ ਕ੍ਰੈਡਿਟ ਦੀ ਉਡੀਕ ਕਰਨਗੇ। FieldQuo ਵਿੱਚ ਬਾਕੀ ਸਭ ਕੁਝ ਚੱਲਦਾ ਰਹਿੰਦਾ ਹੈ।",
  "ai.topups": "ਟੌਪ-ਅੱਪ ਦੀ ਮਿਆਦ ਨਹੀਂ ਪੁੱਗਦੀ।",
  "ai.once": "ਇਹ ਈਮੇਲ ਤੁਹਾਨੂੰ ਦੁਬਾਰਾ ਸਿਰਫ਼ ਟੌਪ-ਅੱਪ ਤੋਂ ਬਾਅਦ ਮਿਲੇਗੀ, ਜੇ ਬਕਾਇਆ ਫਿਰ ਘੱਟ ਹੋ ਜਾਵੇ।",
  "ai.cta": "AI ਕ੍ਰੈਡਿਟ ਟੌਪ-ਅੱਪ ਕਰੋ",
  "winBack.subject": "ਤੁਹਾਡਾ FieldQuo ਖਾਤਾ ਅਜੇ ਵੀ ਇੱਥੇ ਹੈ",
  "winBack.preheader": "ਕੁਝ ਵੀ ਮਿਟਾਇਆ ਨਹੀਂ ਗਿਆ — ਪਲਾਨ ਚੁਣੋ ਅਤੇ ਸਭ ਕੁਝ ਵਾਪਸ ਆ ਜਾਂਦਾ ਹੈ।",
  "winBack.heading": "ਜੋ ਕੁਝ ਤੁਸੀਂ ਛੱਡ ਕੇ ਗਏ ਸੀ, ਉਹ ਅਜੇ ਵੀ ਇੱਥੇ ਹੈ",
  "winBack.intro": "{company} ਦਾ FieldQuo ਪਲਾਨ ਖ਼ਤਮ ਹੋਏ ਦੋ ਹਫ਼ਤੇ ਹੋ ਗਏ ਹਨ। ਤੁਹਾਡੇ ਕੋਟ, ਗਾਹਕ, ਇਨਵੌਇਸ ਅਤੇ ਫ਼ੋਟੋਆਂ ਬਿਲਕੁਲ ਉੱਥੇ ਹੀ ਹਨ ਜਿੱਥੇ ਤੁਸੀਂ ਛੱਡੀਆਂ ਸਨ — ਕੁਝ ਵੀ ਮਿਟਾਇਆ ਨਹੀਂ ਗਿਆ।",
  "winBack.readonly": "ਤੁਸੀਂ {date} ਤੱਕ ਸਭ ਕੁਝ ਦੇਖ ਸਕਦੇ ਹੋ। ਉਸ ਤੋਂ ਬਾਅਦ ਪਲਾਨ ਚੁਣੇ ਜਾਣ ਤੱਕ ਖਾਤਾ ਲਾਕ ਰਹਿੰਦਾ ਹੈ, ਅਤੇ ਫਿਰ ਵੀ ਕੁਝ ਨਹੀਂ ਮਿਟਾਇਆ ਜਾਂਦਾ।",
  "winBack.updates": "ਤੁਹਾਡੇ ਜਾਣ ਤੋਂ ਬਾਅਦ FieldQuo ਵਿੱਚ ਨਵਾਂ:",
  "winBack.cta": "ਪਲਾਨ ਚੁਣੋ",
  "updates.subject": "FieldQuo ਵਿੱਚ ਨਵਾਂ ਕੀ ਹੈ — {month}",
  "updates.heading": "FieldQuo ਵਿੱਚ ਨਵਾਂ ਕੀ ਹੈ",
  "updates.intro": "{month} ਵਿੱਚ FieldQuo ਵਿੱਚ ਇਹ ਬਦਲਿਆ।",
  "updates.readMore": "ਪੂਰਾ ਅੱਪਡੇਟ ਪੜ੍ਹੋ",
  "updates.cta": "ਸਾਰੇ ਉਤਪਾਦ ਅੱਪਡੇਟ ਦੇਖੋ",
};

const tl = {
  "referrer.subject": "Nakakuha ka ng isang libreng buwan ng FieldQuo",
  "referrer.heading": "Nakakuha ka ng isang libreng buwan",
  "referrer.intro": "Nagbayad na sa unang pagkakataon ang {referred}, ang negosyong ni-refer mo sa FieldQuo — kaya may isang buwan ng FieldQuo nang libre ang {company}.",
  "referrer.subscription": "Wala kang kailangang gawin: inilipat sa {date} ang susunod mong singil.",
  "referrer.trial": "Wala kang kailangang gawin: tatagal na ngayon ang iyong libreng trial hanggang {date}.",
  "referrer.more": "Bawat negosyong ni-refer mo na nagiging nagbabayad na customer ng FieldQuo ay maaaring magbigay sa iyo ng isa pang buwan.",
  "referrer.cta": "Mag-refer ng isa pang negosyo",
  "referee.subject": "Nailapat na ang iyong libreng buwan ng FieldQuo",
  "referee.heading": "Nailapat na ang iyong libreng buwan",
  "referee.intro": "Sumali ka sa FieldQuo gamit ang referral link ng {referrer}, kaya may isang buwan ng FieldQuo nang libre ang {company}.",
  "referee.subscription": "Wala kang kailangang gawin: inilipat sa {date} ang iyong unang singil.",
  "referee.trial": "Wala kang kailangang gawin: tatagal na ngayon ang iyong libreng trial hanggang {date}.",
  "referee.cta": "Tingnan ang iyong plan",
  "ai.subject": "Paubos na ang iyong FieldQuo AI credit",
  "ai.heading": "Paubos na ang AI credit",
  "ai.balance": "May natitirang {balance} na AI credit ang {company}.",
  "ai.what":
    "Kapag naubos ito, titigil ang mga AI feature na binabayaran nito hanggang mag-top up ka: ipapasa sa iyo ng iyong AI employee ang mga usapan nito, at maghihintay ng credit ang mga AI na larawan, pagsusuri ng larawan, listahan ng materyales at pagbasa ng drawing. Patuloy na gagana ang lahat ng iba pa sa FieldQuo.",
  "ai.topups": "Hindi nag-e-expire ang mga top-up.",
  "ai.once": "Matatanggap mo lang ulit ang email na ito pagkatapos ng isang top-up, kung bumaba ulit ang balanse.",
  "ai.cta": "Mag-top up ng AI credit",
  "winBack.subject": "Nandito pa rin ang iyong FieldQuo account",
  "winBack.preheader": "Walang binura — pumili ng plan at babalik ang lahat.",
  "winBack.heading": "Nandito pa rin ang lahat ng iniwan mo",
  "winBack.intro": "Dalawang linggo na mula nang matapos ang FieldQuo plan ng {company}. Nasa eksaktong lugar pa rin ang iyong mga quote, kliyente, invoice at larawan — walang binura.",
  "winBack.readonly": "Makikita mo pa rin ang lahat hanggang {date}. Pagkatapos noon, mala-lock ang account hanggang may mapiling plan, at wala pa ring binubura.",
  "winBack.updates": "Bago sa FieldQuo mula nang umalis ka:",
  "winBack.cta": "Pumili ng plan",
  "updates.subject": "Ano ang bago sa FieldQuo — {month}",
  "updates.heading": "Ano ang bago sa FieldQuo",
  "updates.intro": "Ito ang nagbago sa FieldQuo noong {month}.",
  "updates.readMore": "Basahin ang buong update",
  "updates.cta": "Tingnan ang lahat ng product update",
};

const de = {
  "referrer.subject": "Sie haben einen Gratismonat FieldQuo verdient",
  "referrer.heading": "Sie haben einen Gratismonat verdient",
  "referrer.intro": "{referred}, der Betrieb, den Sie FieldQuo empfohlen haben, hat seine erste Zahlung geleistet — deshalb bekommt {company} einen Monat FieldQuo gratis.",
  "referrer.subscription": "Sie müssen nichts tun: Ihre nächste Abbuchung ist auf den {date} verschoben.",
  "referrer.trial": "Sie müssen nichts tun: Ihre kostenlose Testphase läuft jetzt bis zum {date}.",
  "referrer.more": "Jeder von Ihnen empfohlene Betrieb, der zahlender FieldQuo-Kunde wird, kann Ihnen einen weiteren Monat einbringen.",
  "referrer.cta": "Weiteren Betrieb empfehlen",
  "referee.subject": "Ihr Gratismonat FieldQuo ist eingelöst",
  "referee.heading": "Ihr Gratismonat ist eingelöst",
  "referee.intro": "Sie sind über den Empfehlungslink von {referrer} zu FieldQuo gekommen, deshalb bekommt {company} einen Monat FieldQuo gratis.",
  "referee.subscription": "Sie müssen nichts tun: Ihre erste Abbuchung ist auf den {date} verschoben.",
  "referee.trial": "Sie müssen nichts tun: Ihre kostenlose Testphase läuft jetzt bis zum {date}.",
  "referee.cta": "Tarif ansehen",
  "ai.subject": "Ihr FieldQuo-KI-Guthaben wird knapp",
  "ai.heading": "Das KI-Guthaben wird knapp",
  "ai.balance": "{company} hat noch {balance} KI-Guthaben.",
  "ai.what":
    "Wenn es aufgebraucht ist, pausieren die KI-Funktionen, die daraus bezahlt werden, bis Sie aufladen: Ihr KI-Mitarbeiter übergibt seine Gespräche an Sie, und KI-Bilder, Fotoprüfung, Materiallisten und das Lesen von Plänen warten auf Guthaben. Alles andere in FieldQuo funktioniert weiter.",
  "ai.topups": "Aufladungen verfallen nicht.",
  "ai.once": "Diese E-Mail kommt erst nach einer Aufladung wieder, wenn das Guthaben erneut knapp wird.",
  "ai.cta": "KI-Guthaben aufladen",
  "winBack.subject": "Ihr FieldQuo-Konto ist noch da",
  "winBack.preheader": "Es wurde nichts gelöscht — wählen Sie einen Tarif, und alles ist wieder da.",
  "winBack.heading": "Alles, was Sie zurückgelassen haben, ist noch da",
  "winBack.intro": "Vor zwei Wochen ist der FieldQuo-Tarif von {company} geendet. Ihre Angebote, Kunden, Rechnungen und Fotos sind genau dort, wo Sie sie gelassen haben — es wurde nichts gelöscht.",
  "winBack.readonly": "Sie können sich bis zum {date} noch alles ansehen. Danach wird das Konto gesperrt, bis ein Tarif gewählt wird, und auch dann wird nichts gelöscht.",
  "winBack.updates": "Neu in FieldQuo, seit Sie gegangen sind:",
  "winBack.cta": "Tarif wählen",
  "updates.subject": "Neu in FieldQuo — {month}",
  "updates.heading": "Neu in FieldQuo",
  "updates.intro": "Das hat sich im {month} in FieldQuo geändert.",
  "updates.readMore": "Das ganze Update lesen",
  "updates.cta": "Alle Produkt-Updates ansehen",
};

const zh = {
  "referrer.subject": "你获得了一个月的 FieldQuo 免费使用",
  "referrer.heading": "你获得了一个免费月",
  "referrer.intro": "你推荐到 FieldQuo 的商家 {referred} 已完成首次付款，因此 {company} 获得一个月的 FieldQuo 免费使用。",
  "referrer.subscription": "你无需做任何事：下一次扣款已推迟到 {date}。",
  "referrer.trial": "你无需做任何事：你的免费试用现在延长到 {date}。",
  "referrer.more": "你推荐的每个商家成为 FieldQuo 付费客户后，都可能为你再带来一个月。",
  "referrer.cta": "推荐另一个商家",
  "referee.subject": "你的 FieldQuo 免费月已生效",
  "referee.heading": "你的免费月已生效",
  "referee.intro": "你是通过 {referrer} 的推荐链接加入 FieldQuo 的，因此 {company} 获得一个月的 FieldQuo 免费使用。",
  "referee.subscription": "你无需做任何事：第一次扣款已推迟到 {date}。",
  "referee.trial": "你无需做任何事：你的免费试用现在延长到 {date}。",
  "referee.cta": "查看你的套餐",
  "ai.subject": "你的 FieldQuo AI 额度即将用完",
  "ai.heading": "AI 额度即将用完",
  "ai.balance": "{company} 还剩 {balance} 的 AI 额度。",
  "ai.what":
    "额度用完后，由它支付的 AI 功能会暂停，直到你充值：你的 AI 员工会把对话转交给你，AI 图片、照片审核、材料清单和图纸读取会等待额度。FieldQuo 的其他功能照常运作。",
  "ai.topups": "充值的额度不会过期。",
  "ai.once": "只有在你充值后余额再次变低时，才会再次收到这封邮件。",
  "ai.cta": "充值 AI 额度",
  "winBack.subject": "你的 FieldQuo 账户还在",
  "winBack.preheader": "没有删除任何内容 — 选择套餐即可全部恢复。",
  "winBack.heading": "你留下的一切都还在",
  "winBack.intro": "{company} 的 FieldQuo 套餐结束已经两周了。你的报价、客户、发票和照片都原样保留在原处，没有删除任何内容。",
  "winBack.readonly": "在 {date} 之前你仍然可以查看所有内容。之后账户会锁定，直到选择套餐为止，但依然不会删除任何内容。",
  "winBack.updates": "你离开后 FieldQuo 的新功能：",
  "winBack.cta": "选择套餐",
  "updates.subject": "FieldQuo 新功能 — {month}",
  "updates.heading": "FieldQuo 新功能",
  "updates.intro": "以下是 FieldQuo 在 {month} 的变化。",
  "updates.readMore": "阅读完整更新",
  "updates.cta": "查看所有产品更新",
};

const it = {
  "referrer.subject": "Ha guadagnato un mese gratis di FieldQuo",
  "referrer.heading": "Ha guadagnato un mese gratis",
  "referrer.intro": "{referred}, l'impresa che ha segnalato a FieldQuo, ha effettuato il primo pagamento: per questo {company} riceve un mese di FieldQuo gratis.",
  "referrer.subscription": "Non deve fare nulla: il prossimo addebito è stato spostato al {date}.",
  "referrer.trial": "Non deve fare nulla: la sua prova gratuita ora dura fino al {date}.",
  "referrer.more": "Ogni impresa che segnala e che diventa cliente pagante di FieldQuo può farle guadagnare un altro mese.",
  "referrer.cta": "Segnala un'altra impresa",
  "referee.subject": "Il suo mese gratis di FieldQuo è applicato",
  "referee.heading": "Il suo mese gratis è applicato",
  "referee.intro": "Si è iscritto a FieldQuo con il link di segnalazione di {referrer}, quindi {company} riceve un mese di FieldQuo gratis.",
  "referee.subscription": "Non deve fare nulla: il primo addebito è stato spostato al {date}.",
  "referee.trial": "Non deve fare nulla: la sua prova gratuita ora dura fino al {date}.",
  "referee.cta": "Vedi il suo piano",
  "ai.subject": "Il suo credito AI FieldQuo sta per esaurirsi",
  "ai.heading": "Il credito AI sta per esaurirsi",
  "ai.balance": "A {company} restano {balance} di credito AI.",
  "ai.what":
    "Quando finisce, le funzioni AI pagate con esso si fermano finché non ricarica: il suo dipendente AI le passa le conversazioni, e le immagini AI, la revisione delle foto, le liste dei materiali e la lettura dei disegni aspettano il credito. Tutto il resto di FieldQuo continua a funzionare.",
  "ai.topups": "Le ricariche non scadono.",
  "ai.once": "Riceverà di nuovo questa email solo dopo una ricarica, se il saldo torna basso.",
  "ai.cta": "Ricarica il credito AI",
  "winBack.subject": "Il suo account FieldQuo è ancora qui",
  "winBack.preheader": "Non è stato eliminato nulla: scelga un piano e torna tutto.",
  "winBack.heading": "Tutto ciò che ha lasciato è ancora qui",
  "winBack.intro": "Sono passate due settimane da quando il piano FieldQuo di {company} è terminato. Preventivi, clienti, fatture e foto sono esattamente dove li ha lasciati: non è stato eliminato nulla.",
  "winBack.readonly": "Può ancora consultare tutto fino al {date}. Dopo, l'account si blocca finché non viene scelto un piano, e comunque non viene eliminato nulla.",
  "winBack.updates": "Novità in FieldQuo da quando è andato via:",
  "winBack.cta": "Scegli un piano",
  "updates.subject": "Novità di FieldQuo — {month}",
  "updates.heading": "Novità di FieldQuo",
  "updates.intro": "Ecco cosa è cambiato in FieldQuo a {month}.",
  "updates.readMore": "Leggi l'aggiornamento completo",
  "updates.cta": "Vedi tutti gli aggiornamenti",
};

export const ACCOUNT_NOTICE_COPY = { en, fr, es, uk, pa, tl, de, zh, it };
export const ACCOUNT_NOTICE_KEYS = Object.keys(en);

/** The words in `language`, merged over English per key (lib/i18n/emailCopy.js's rule). */
export function accountNoticeCopy(language = "en") {
  const code = String(language || "en").toLowerCase();
  const dict = Object.prototype.hasOwnProperty.call(ACCOUNT_NOTICE_COPY, code) ? ACCOUNT_NOTICE_COPY[code] : null;
  return dict && code !== "en" ? { ...en, ...dict } : en;
}

export function hasAccountNoticeLanguage(language) {
  return Object.prototype.hasOwnProperty.call(ACCOUNT_NOTICE_COPY, String(language || "").toLowerCase());
}

/**
 * Fill {placeholders}. `wrap` turns a value into what the sentence carries —
 * escaped-and-bold for a paragraph, raw for a subject. An absent value leaves
 * the placeholder visible, which the check reads as a missing argument.
 */
export function fillNotice(template, values = {}, wrap = (v) => String(v)) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(values, k) && values[k] != null ? wrap(values[k]) : m,
  );
}
