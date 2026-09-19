// lib/aiEmployee/webChatCopy.js
//
// The words on the site chat widget, in the visitor's language.
//
// Client-facing copy, so it lives beside lib/site/siteCopy.js's languages
// rather than in the app catalogue: a homeowner on a contractor's French site
// reads French here whatever language the contractor's staff work in. Nine
// languages — the app's full set — because the widget is also served on the
// embed, where the host page's language is whatever the company set.
//
// Nothing here names FieldQuo. White-label by default.

const COPY = {
  en: {
    open: "Chat with us",
    close: "Close chat",
    title: "Chat with {company}",
    intro: "Ask about a quote, a booking, or anything else.",
    placeholder: "Type a message…",
    send: "Send",
    waiting: "Thanks — someone will reply shortly.",
    person: "Talk to a person",
    personMessage: "I'd like to talk to a person, please.",
    error: "That didn't send. Please try again.",
    tooMany: "Too many messages for now. Please wait a few minutes.",
    you: "You",
  },
  fr: {
    open: "Discuter avec nous",
    close: "Fermer la discussion",
    title: "Discuter avec {company}",
    intro: "Une soumission, un rendez-vous, une question — écrivez-nous.",
    placeholder: "Écrivez un message…",
    send: "Envoyer",
    waiting: "Merci — quelqu'un vous répondra sous peu.",
    person: "Parler à une personne",
    personMessage: "J'aimerais parler à une personne, s'il vous plaît.",
    error: "Le message n'est pas parti. Réessayez.",
    tooMany: "Trop de messages pour l'instant. Patientez quelques minutes.",
    you: "Vous",
  },
  es: {
    open: "Chatea con nosotros",
    close: "Cerrar el chat",
    title: "Chat con {company}",
    intro: "Pregunte por un presupuesto, una cita o cualquier otra cosa.",
    placeholder: "Escriba un mensaje…",
    send: "Enviar",
    waiting: "Gracias — alguien le responderá en breve.",
    person: "Hablar con una persona",
    personMessage: "Quisiera hablar con una persona, por favor.",
    error: "No se envió. Inténtelo de nuevo.",
    tooMany: "Demasiados mensajes por ahora. Espere unos minutos.",
    you: "Usted",
  },
  uk: {
    open: "Написати нам",
    close: "Закрити чат",
    title: "Чат з {company}",
    intro: "Запитайте про кошторис, запис чи будь-що інше.",
    placeholder: "Введіть повідомлення…",
    send: "Надіслати",
    waiting: "Дякуємо — хтось незабаром вам відповість.",
    person: "Поговорити з людиною",
    personMessage: "Я хотів би поговорити з людиною, будь ласка.",
    error: "Не надіслано. Спробуйте ще раз.",
    tooMany: "Забагато повідомлень. Зачекайте кілька хвилин.",
    you: "Ви",
  },
  pa: {
    open: "ਸਾਡੇ ਨਾਲ ਗੱਲ ਕਰੋ",
    close: "ਚੈਟ ਬੰਦ ਕਰੋ",
    title: "{company} ਨਾਲ ਚੈਟ",
    intro: "ਕੋਟ, ਬੁਕਿੰਗ ਜਾਂ ਕਿਸੇ ਹੋਰ ਬਾਰੇ ਪੁੱਛੋ।",
    placeholder: "ਸੁਨੇਹਾ ਲਿਖੋ…",
    send: "ਭੇਜੋ",
    waiting: "ਧੰਨਵਾਦ — ਕੋਈ ਜਲਦੀ ਹੀ ਜਵਾਬ ਦੇਵੇਗਾ।",
    person: "ਕਿਸੇ ਵਿਅਕਤੀ ਨਾਲ ਗੱਲ ਕਰੋ",
    personMessage: "ਮੈਂ ਕਿਸੇ ਵਿਅਕਤੀ ਨਾਲ ਗੱਲ ਕਰਨੀ ਚਾਹਾਂਗਾ, ਕਿਰਪਾ ਕਰਕੇ।",
    error: "ਭੇਜਿਆ ਨਹੀਂ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    tooMany: "ਹੁਣ ਲਈ ਬਹੁਤ ਸਾਰੇ ਸੁਨੇਹੇ। ਕੁਝ ਮਿੰਟ ਉਡੀਕ ਕਰੋ।",
    you: "ਤੁਸੀਂ",
  },
  tl: {
    open: "Makipag-chat sa amin",
    close: "Isara ang chat",
    title: "Chat sa {company}",
    intro: "Magtanong tungkol sa quote, booking, o kahit ano.",
    placeholder: "Mag-type ng mensahe…",
    send: "Ipadala",
    waiting: "Salamat — may sasagot sa lalong madaling panahon.",
    person: "Makipag-usap sa tao",
    personMessage: "Gusto kong makipag-usap sa isang tao, pakiusap.",
    error: "Hindi naipadala. Subukan muli.",
    tooMany: "Masyadong maraming mensahe. Maghintay ng ilang minuto.",
    you: "Ikaw",
  },
  de: {
    open: "Mit uns chatten",
    close: "Chat schließen",
    title: "Chat mit {company}",
    intro: "Fragen Sie nach einem Angebot, einem Termin oder etwas anderem.",
    placeholder: "Nachricht eingeben…",
    send: "Senden",
    waiting: "Danke — jemand antwortet Ihnen in Kürze.",
    person: "Mit einer Person sprechen",
    personMessage: "Ich möchte bitte mit einer Person sprechen.",
    error: "Nicht gesendet. Bitte erneut versuchen.",
    tooMany: "Zu viele Nachrichten. Bitte einige Minuten warten.",
    you: "Sie",
  },
  zh: {
    open: "与我们聊天",
    close: "关闭聊天",
    title: "与 {company} 聊天",
    intro: "询问报价、预约或其他任何问题。",
    placeholder: "输入消息…",
    send: "发送",
    waiting: "谢谢——工作人员会尽快回复您。",
    person: "与真人交谈",
    personMessage: "我想和真人交谈，谢谢。",
    error: "发送失败，请重试。",
    tooMany: "消息太多，请稍等几分钟。",
    you: "您",
  },
  it: {
    open: "Chatta con noi",
    close: "Chiudi la chat",
    title: "Chat con {company}",
    intro: "Chiedi un preventivo, un appuntamento o qualsiasi altra cosa.",
    placeholder: "Scrivi un messaggio…",
    send: "Invia",
    waiting: "Grazie — qualcuno ti risponderà a breve.",
    person: "Parla con una persona",
    personMessage: "Vorrei parlare con una persona, per favore.",
    error: "Non inviato. Riprova.",
    tooMany: "Troppi messaggi per ora. Attendi qualche minuto.",
    you: "Tu",
  },
};

export const WEB_CHAT_LANGUAGES = Object.freeze(Object.keys(COPY));

/** The widget's words for a language, with the company's name filled in. */
export function webChatCopy(language, companyName) {
  const base = COPY[language] || COPY.en;
  return { ...base, title: base.title.replace("{company}", String(companyName || "").trim() || base.open) };
}
