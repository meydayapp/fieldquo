// lib/i18n/trackingCopy.js
//
// The two things a homeowner reads about tracking on a company's funnel or
// instant estimate, in the eight client languages (the same eight the
// documents and emails carry — lib/i18n/emailCopy.js SUPPORTED_EMAIL_LANGUAGES):
//
//   saveNotice   beside the contact fields. The partial-lead capture
//                (lib/tracking/partial.js) only runs once this is on screen,
//                and it says exactly what happens: the company keeps what was
//                typed and may get back to them.
//   consent*     the ad-cookie notice, shown only when the company switched
//                "Ask before loading ad pixels" on. It names the platforms
//                because "cookies for marketing" is the sentence people have
//                learned to click past without reading.
//
// White-label: the company's name, never FieldQuo's. No import, so both
// public client components can use it without pulling anything else in.

const COPY = {
  en: {
    saveNotice: (c) => `We save what you type here so ${c} can get back to you, even if you don't finish.`,
    consentBody: (c) =>
      `${c} would like to use Meta, Google or TikTok ad cookies on this page to learn which of its ads bring people here. What you type is not sent to them.`,
    accept: "Accept",
    decline: "No thanks",
  },
  fr: {
    saveNotice: (c) => `Nous enregistrons ce que vous saisissez ici pour que ${c} puisse vous recontacter, même si vous ne terminez pas.`,
    consentBody: (c) =>
      `${c} aimerait utiliser des témoins publicitaires de Meta, Google ou TikTok sur cette page pour savoir quelles publicités amènent des visiteurs ici. Ce que vous saisissez ne leur est pas transmis.`,
    accept: "Accepter",
    decline: "Non merci",
  },
  es: {
    saveNotice: (c) => `Guardamos lo que escribe aquí para que ${c} pueda contactarle, aunque no termine.`,
    consentBody: (c) =>
      `${c} quiere usar cookies publicitarias de Meta, Google o TikTok en esta página para saber cuáles de sus anuncios traen visitantes. Lo que usted escribe no se les envía.`,
    accept: "Aceptar",
    decline: "No, gracias",
  },
  it: {
    saveNotice: (c) => `Salviamo ciò che scrivi qui perché ${c} possa ricontattarti, anche se non finisci.`,
    consentBody: (c) =>
      `${c} vorrebbe usare cookie pubblicitari di Meta, Google o TikTok su questa pagina per capire quali annunci portano visitatori qui. Ciò che scrivi non viene inviato a loro.`,
    accept: "Accetta",
    decline: "No, grazie",
  },
  de: {
    saveNotice: (c) => `Wir speichern, was Sie hier eingeben, damit ${c} sich bei Ihnen melden kann – auch wenn Sie nicht fertig werden.`,
    consentBody: (c) =>
      `${c} möchte auf dieser Seite Werbe-Cookies von Meta, Google oder TikTok verwenden, um zu erfahren, welche Anzeigen Besucher hierher bringen. Was Sie eingeben, wird nicht an sie gesendet.`,
    accept: "Akzeptieren",
    decline: "Nein, danke",
  },
  uk: {
    saveNotice: (c) => `Ми зберігаємо те, що ви тут вводите, щоб ${c} міг зв'язатися з вами, навіть якщо ви не завершите.`,
    consentBody: (c) =>
      `${c} хоче використовувати рекламні файли cookie Meta, Google або TikTok на цій сторінці, щоб дізнатися, яка реклама приводить сюди відвідувачів. Те, що ви вводите, їм не надсилається.`,
    accept: "Прийняти",
    decline: "Ні, дякую",
  },
  pa: {
    saveNotice: (c) => `ਤੁਸੀਂ ਇੱਥੇ ਜੋ ਲਿਖਦੇ ਹੋ ਅਸੀਂ ਉਸਨੂੰ ਸੰਭਾਲਦੇ ਹਾਂ ਤਾਂ ਜੋ ${c} ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰ ਸਕੇ, ਭਾਵੇਂ ਤੁਸੀਂ ਪੂਰਾ ਨਾ ਕਰੋ।`,
    consentBody: (c) =>
      `${c} ਇਸ ਪੰਨੇ 'ਤੇ Meta, Google ਜਾਂ TikTok ਦੀਆਂ ਇਸ਼ਤਿਹਾਰੀ ਕੂਕੀਜ਼ ਵਰਤਣਾ ਚਾਹੁੰਦਾ ਹੈ ਤਾਂ ਜੋ ਪਤਾ ਲੱਗੇ ਕਿ ਕਿਹੜੇ ਇਸ਼ਤਿਹਾਰ ਲੋਕਾਂ ਨੂੰ ਇੱਥੇ ਲਿਆਉਂਦੇ ਹਨ। ਤੁਸੀਂ ਜੋ ਲਿਖਦੇ ਹੋ ਉਹ ਉਹਨਾਂ ਨੂੰ ਨਹੀਂ ਭੇਜਿਆ ਜਾਂਦਾ।`,
    accept: "ਸਵੀਕਾਰ ਕਰੋ",
    decline: "ਨਹੀਂ, ਧੰਨਵਾਦ",
  },
  tl: {
    saveNotice: (c) => `Sine-save namin ang tina-type mo rito para makabalik sa iyo ang ${c}, kahit hindi mo matapos.`,
    consentBody: (c) =>
      `Gustong gumamit ng ${c} ng ad cookies ng Meta, Google o TikTok sa pahinang ito para malaman kung aling mga ad nito ang nagdadala ng mga tao rito. Hindi ipinapadala sa kanila ang tina-type mo.`,
    accept: "Tanggapin",
    decline: "Huwag na, salamat",
  },
};

export const TRACKING_COPY_LANGUAGES = Object.freeze(Object.keys(COPY));

/** The table for a language, English for anything not in it. */
export function trackingCopy(language = "en") {
  const code = typeof language === "string" ? language.slice(0, 2).toLowerCase() : "en";
  return COPY[code] || COPY.en;
}
