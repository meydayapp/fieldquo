// lib/email/authEmails.js
//
// The two emails Better Auth sends about a FieldQuo LOGIN: "reset your
// password" and "confirm your email address".
//
// ── Whose brand is this? FieldQuo's. Deliberately. ──────────────────────────
//
// Almost everything this product sends is white-labelled, because the reader is
// a homeowner and they should not be able to tell what software the contractor
// bought. These two are the other case, the same one lib/email/billingEmail.js
// documents: FieldQuo is the vendor, the reader is the customer, and the thing
// being talked about is FieldQuo's own account system.
//
// The obvious alternative — skin them in the company's logo and brand colour,
// since `company` is right there — was rejected for three reasons:
//
//   1. It would be a lie about who is writing. The password lives in
//      FieldQuo's database, the link lands on a fieldquo.com form, and the
//      From line is FieldQuo's platform sender (getPlatformFrom) because a
//      company's own verified domain cannot be used to write to the person who
//      owns that domain about their access to it. Branding the body as the
//      contractor while the sender and the destination say FieldQuo is a
//      mismatch inside one message.
//
//   2. That mismatch is precisely the shape of a phishing email. An unexpected
//      message, in a familiar logo, asking you to click through and type a
//      password on a domain that isn't the one in the logo, is the exact
//      pattern every security awareness course teaches people to distrust —
//      and the exact pattern a real attacker would forge. A reset email has to
//      be boringly, consistently one identity, all the way through.
//
//   3. It removes a contrast problem instead of solving one. Contractors pick
//      silver, yellow and white; lib/documents/theme.js and the fillPair /
//      contrastText machinery in emailTheme.js exist because those mid-tones
//      break the naive "dark background, white text" rule. Both were read
//      before this decision. None of it is used here, because the safest
//      colour for a security email is not a computed one — it is the same
//      fixed near-black every FieldQuo-to-contractor email already uses, so
//      these two look like the billing mail and the invitation the same person
//      has already received from us.
//
// `company` is still used, as PLAIN TEXT only: "the FieldQuo login you use at
// Northline Refinishing". Someone who works for two companies needs to know
// which account this is about, and that question is answered by the name, not
// by a logo.
//
// ── Why a local COPY map and not app/i18n/appMessages.js ────────────────────
//
// Same reason inviteEmail.js and lib/i18n/emailCopy.js keep theirs local:
// appMessages is the /app runtime catalogue, loaded by React components with a
// bound `t`. These render server-side inside a Better Auth hook with nothing
// bound, and adding auth strings there would put six locales' worth of copy
// that no page ever displays under the check:translations gate. A local map
// keyed by language, with an English fallback, is what every other email
// module in this directory does.
//
// ── The copy map holds no markup ────────────────────────────────────────────
//
// Every string below is plain text. inviteEmail.js embeds <strong> in its
// sentences, which means those strings can only ever be used in the HTML part
// and anything interpolated into them has to be pre-escaped by hand. Here the
// same sentence has to appear in both the HTML and the plain-text alternative,
// so keeping the map markup-free lets the renderer escape once on the way into
// the HTML and reuse the identical string verbatim for text. It also means no
// path exists by which a company name reaches an email as live markup.

import { escapeHtml, escapeAttr, safeUrl } from "@/lib/email/emailTheme";

// Ukrainian needs three forms and gets them wrong silently otherwise:
// "24 годин" reads as broken to a native speaker the way "24 hour" does.
const ukPlural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const COPY = {
  en: {
    greeting: (name) => `Hi ${name},`,

    resetSubject: "Reset your FieldQuo password",
    resetHeading: "Reset your password",
    resetBody: (company) =>
      company
        ? `Someone asked to reset the password for the FieldQuo login you use at ${company}.`
        : "Someone asked to reset the password for your FieldQuo login.",
    resetCta: "Choose a new password",
    resetNotYou:
      "If that wasn't you, ignore this email. Your password stays exactly as it is unless the link above is used.",

    verifySubject: "Confirm your email address",
    verifyHeading: "Confirm your email address",
    verifyBody: (company) =>
      company
        ? `Confirm this address to finish setting up the FieldQuo login you use at ${company}.`
        : "Confirm this address to finish setting up your FieldQuo login.",
    verifyCta: "Confirm my email address",
    verifyNotYou:
      "If you didn't sign up for FieldQuo, ignore this email. Nothing happens until the link is opened.",

    once: "The link can only be used once.",
    expiry: (n, unit, lead) =>
      `${lead ? "This link expires" : "It expires"} in ${n} ${
        unit === "hours" ? (n === 1 ? "hour" : "hours") : n === 1 ? "minute" : "minutes"
      }.`,
    fallback:
      "If the button doesn't work, copy and paste this link into your browser:",
    neverAsk: "Sent by FieldQuo. We will never ask you for your password by email.",
  },

  fr: {
    greeting: (name) => `Bonjour ${name},`,

    resetSubject: "Réinitialiser votre mot de passe FieldQuo",
    resetHeading: "Réinitialiser votre mot de passe",
    resetBody: (company) =>
      company
        ? `Quelqu'un a demandé la réinitialisation du mot de passe de votre accès FieldQuo chez ${company}.`
        : "Quelqu'un a demandé la réinitialisation du mot de passe de votre accès FieldQuo.",
    resetCta: "Choisir un nouveau mot de passe",
    resetNotYou:
      "Si ce n'était pas vous, ignorez ce message. Votre mot de passe reste inchangé tant que le lien ci-dessus n'est pas utilisé.",

    verifySubject: "Confirmez votre adresse courriel",
    verifyHeading: "Confirmez votre adresse courriel",
    verifyBody: (company) =>
      company
        ? `Confirmez cette adresse pour terminer la configuration de votre accès FieldQuo chez ${company}.`
        : "Confirmez cette adresse pour terminer la configuration de votre accès FieldQuo.",
    verifyCta: "Confirmer mon adresse",
    verifyNotYou:
      "Si vous n'avez pas créé de compte FieldQuo, ignorez ce message. Rien ne se produit tant que le lien n'est pas ouvert.",

    once: "Le lien ne fonctionne qu'une seule fois.",
    expiry: (n, unit, lead) =>
      `${lead ? "Ce lien expire" : "Il expire"} dans ${n} ${
        unit === "hours" ? (n === 1 ? "heure" : "heures") : n === 1 ? "minute" : "minutes"
      }.`,
    fallback:
      "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    neverAsk:
      "Envoyé par FieldQuo. Nous ne vous demanderons jamais votre mot de passe par courriel.",
  },

  es: {
    greeting: (name) => `Hola ${name}:`,

    resetSubject: "Restablecer su contraseña de FieldQuo",
    resetHeading: "Restablecer su contraseña",
    resetBody: (company) =>
      company
        ? `Alguien solicitó restablecer la contraseña de su acceso a FieldQuo en ${company}.`
        : "Alguien solicitó restablecer la contraseña de su acceso a FieldQuo.",
    resetCta: "Elegir una contraseña nueva",
    resetNotYou:
      "Si no fue usted, ignore este mensaje. Su contraseña seguirá igual mientras no se use el enlace de arriba.",

    verifySubject: "Confirme su dirección de correo",
    verifyHeading: "Confirme su dirección de correo",
    verifyBody: (company) =>
      company
        ? `Confirme esta dirección para terminar de configurar su acceso a FieldQuo en ${company}.`
        : "Confirme esta dirección para terminar de configurar su acceso a FieldQuo.",
    verifyCta: "Confirmar mi dirección",
    verifyNotYou:
      "Si usted no creó una cuenta de FieldQuo, ignore este mensaje. No ocurre nada hasta que se abra el enlace.",

    once: "El enlace funciona una sola vez.",
    expiry: (n, unit, lead) =>
      `${lead ? "Este enlace caduca" : "Caduca"} en ${n} ${
        unit === "hours" ? (n === 1 ? "hora" : "horas") : n === 1 ? "minuto" : "minutos"
      }.`,
    fallback: "Si el botón no funciona, copie este enlace en su navegador:",
    neverAsk:
      "Enviado por FieldQuo. Nunca le pediremos su contraseña por correo electrónico.",
  },

  uk: {
    greeting: (name) => `Вітаємо, ${name},`,

    resetSubject: "Скидання пароля FieldQuo",
    resetHeading: "Скидання пароля",
    resetBody: (company) =>
      company
        ? `Надійшов запит на скидання пароля до вашого входу FieldQuo у ${company}.`
        : "Надійшов запит на скидання пароля до вашого входу FieldQuo.",
    resetCta: "Обрати новий пароль",
    resetNotYou:
      "Якщо це були не ви, просто проігноруйте цей лист. Пароль залишиться незмінним, доки посиланням вище не скористаються.",

    verifySubject: "Підтвердьте свою електронну адресу",
    verifyHeading: "Підтвердьте свою електронну адресу",
    verifyBody: (company) =>
      company
        ? `Підтвердьте цю адресу, щоб завершити налаштування вашого входу FieldQuo у ${company}.`
        : "Підтвердьте цю адресу, щоб завершити налаштування вашого входу FieldQuo.",
    verifyCta: "Підтвердити адресу",
    verifyNotYou:
      "Якщо ви не реєструвалися у FieldQuo, проігноруйте цей лист. Нічого не відбудеться, доки посилання не відкриють.",

    once: "Посилання спрацює лише один раз.",
    expiry: (n, unit, lead) =>
      `${lead ? "Посилання діє" : "Воно діє"} ${n} ${
        unit === "hours"
          ? ukPlural(n, "годину", "години", "годин")
          : ukPlural(n, "хвилину", "хвилини", "хвилин")
      }.`,
    fallback: "Якщо кнопка не працює, скопіюйте це посилання у браузер:",
    neverAsk:
      "Надіслано FieldQuo. Ми ніколи не запитуємо ваш пароль електронною поштою.",
  },

  pa: {
    greeting: (name) => `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name},`,

    resetSubject: "ਆਪਣਾ FieldQuo ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਕਰੋ",
    resetHeading: "ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਕਰੋ",
    resetBody: (company) =>
      company
        ? `${company} ਵਿੱਚ ਤੁਹਾਡੇ FieldQuo ਲਾਗਇਨ ਦਾ ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਕਰਨ ਦੀ ਬੇਨਤੀ ਆਈ ਹੈ।`
        : "ਤੁਹਾਡੇ FieldQuo ਲਾਗਇਨ ਦਾ ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਕਰਨ ਦੀ ਬੇਨਤੀ ਆਈ ਹੈ।",
    resetCta: "ਨਵਾਂ ਪਾਸਵਰਡ ਚੁਣੋ",
    resetNotYou:
      "ਜੇ ਇਹ ਤੁਸੀਂ ਨਹੀਂ ਸੀ, ਤਾਂ ਇਸ ਈਮੇਲ ਨੂੰ ਅਣਡਿੱਠਾ ਕਰੋ। ਜਦੋਂ ਤੱਕ ਉੱਪਰਲਾ ਲਿੰਕ ਨਹੀਂ ਵਰਤਿਆ ਜਾਂਦਾ, ਤੁਹਾਡਾ ਪਾਸਵਰਡ ਉਹੀ ਰਹੇਗਾ।",

    verifySubject: "ਆਪਣਾ ਈਮੇਲ ਪਤਾ ਪੁਸ਼ਟ ਕਰੋ",
    verifyHeading: "ਆਪਣਾ ਈਮੇਲ ਪਤਾ ਪੁਸ਼ਟ ਕਰੋ",
    verifyBody: (company) =>
      company
        ? `${company} ਵਿੱਚ ਆਪਣਾ FieldQuo ਲਾਗਇਨ ਪੂਰਾ ਕਰਨ ਲਈ ਇਸ ਪਤੇ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।`
        : "ਆਪਣਾ FieldQuo ਲਾਗਇਨ ਪੂਰਾ ਕਰਨ ਲਈ ਇਸ ਪਤੇ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।",
    verifyCta: "ਮੇਰਾ ਪਤਾ ਪੁਸ਼ਟ ਕਰੋ",
    verifyNotYou:
      "ਜੇ ਤੁਸੀਂ FieldQuo ਲਈ ਸਾਈਨ ਅੱਪ ਨਹੀਂ ਕੀਤਾ, ਤਾਂ ਇਸ ਈਮੇਲ ਨੂੰ ਅਣਡਿੱਠਾ ਕਰੋ। ਲਿੰਕ ਖੋਲ੍ਹਣ ਤੋਂ ਬਿਨਾਂ ਕੁਝ ਨਹੀਂ ਹੁੰਦਾ।",

    once: "ਇਹ ਲਿੰਕ ਸਿਰਫ਼ ਇੱਕ ਵਾਰ ਕੰਮ ਕਰਦਾ ਹੈ।",
    expiry: (n, unit, lead) =>
      `${lead ? "ਇਹ ਲਿੰਕ" : "ਇਹ"} ${n} ${
        unit === "hours" ? "ਘੰਟੇ" : "ਮਿੰਟ"
      } ਬਾਅਦ ਖ਼ਤਮ ਹੋ ਜਾਂਦਾ ਹੈ।`,
    fallback: "ਜੇ ਬਟਨ ਕੰਮ ਨਾ ਕਰੇ, ਤਾਂ ਇਹ ਲਿੰਕ ਆਪਣੇ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਪੇਸਟ ਕਰੋ:",
    neverAsk:
      "FieldQuo ਵੱਲੋਂ ਭੇਜਿਆ ਗਿਆ। ਅਸੀਂ ਕਦੇ ਵੀ ਈਮੇਲ ਰਾਹੀਂ ਤੁਹਾਡਾ ਪਾਸਵਰਡ ਨਹੀਂ ਮੰਗਦੇ।",
  },

  tl: {
    greeting: (name) => `Kumusta ${name},`,

    resetSubject: "I-reset ang iyong FieldQuo password",
    resetHeading: "I-reset ang iyong password",
    resetBody: (company) =>
      company
        ? `May humiling na i-reset ang password ng FieldQuo login mo sa ${company}.`
        : "May humiling na i-reset ang password ng iyong FieldQuo login.",
    resetCta: "Pumili ng bagong password",
    resetNotYou:
      "Kung hindi ikaw ito, balewalain ang email na ito. Hindi magbabago ang password mo hangga't hindi nagagamit ang link sa itaas.",

    verifySubject: "Kumpirmahin ang iyong email address",
    verifyHeading: "Kumpirmahin ang iyong email address",
    verifyBody: (company) =>
      company
        ? `Kumpirmahin ang address na ito para matapos ang setup ng FieldQuo login mo sa ${company}.`
        : "Kumpirmahin ang address na ito para matapos ang setup ng iyong FieldQuo login.",
    verifyCta: "Kumpirmahin ang aking address",
    verifyNotYou:
      "Kung hindi ka nag-sign up sa FieldQuo, balewalain ang email na ito. Walang mangyayari hangga't hindi bubuksan ang link.",

    once: "Isang beses lang gumagana ang link.",
    expiry: (n, unit, lead) =>
      `Mag-e-expire ${lead ? "ang link na ito" : "ito"} sa loob ng ${n} ${
        unit === "hours" ? "oras" : "minuto"
      }.`,
    fallback:
      "Kung hindi gumana ang button, kopyahin ang link na ito sa iyong browser:",
    neverAsk:
      "Ipinadala ng FieldQuo. Hindi namin kailanman hihingin ang password mo sa email.",
  },
};

/**
 * The six languages these emails exist in. Exported so a guard can assert
 * coverage without rendering any HTML.
 */
export const AUTH_EMAIL_LANGUAGES = Object.keys(COPY);

/**
 * Copy for one language, English-backed.
 *
 * Shaped like inviteCopy(), but spread over English rather than returning
 * `COPY[lang] || COPY.en`. That form only falls back for a language we have
 * never heard of; a language we DO have, missing a key added later, returns an
 * object whose value for that key is undefined — which prints the word
 * "undefined" in the middle of a security email. emailCopy() learned this the
 * same way. Spreading means the worst case is one English sentence.
 */
export function authEmailCopy(language) {
  const key = String(language || "en").toLowerCase();
  return { ...COPY.en, ...(COPY[key] || {}) };
}

// FieldQuo's own near-black, matching billingEmail.js and inviteEmail.js so a
// contractor's three FieldQuo-to-me emails look like they came from one place.
const INK = "#111827";
const MUTED = "#4b5563"; // 7.56:1 on the white card
//
// The two greys below are the one place these emails deliberately DON'T match
// their siblings. billingEmail.js and inviteEmail.js both set their small
// print to #9ca3af, which measures 2.54:1 on the white card and 2.33:1 on the
// page — well under 4.5, at 12px, on a phone in daylight. Copying it here
// would have put the "we will never ask for your password" line and the
// paste-this-link fallback, the two sentences someone reads precisely when the
// button didn't work, in the least legible type in the message. Measured with
// lib/brand/colour's contrastRatio rather than eyeballed:
const FAINT = "#6b7280"; // 4.83:1 on #ffffff — small print inside the card
const FOOT = "#5b6472"; // 5.49:1 on #f5f5f5 — the darker page background

/** `company` may be a Company row or just its name; callers differ. */
function companyName(company) {
  const name = typeof company === "string" ? company : company?.name;
  return String(name || "").trim();
}

/**
 * Minutes → the pair the copy functions want.
 *
 * Whole hours are said as hours because "expires in 60 minutes" reads like a
 * countdown and "in 1 hour" reads like a fact. Anything else stays in minutes
 * rather than being rounded — a rounded expiry on a security link is a number
 * that can be wrong in the direction that locks someone out.
 */
function expiryParts(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return null;
  const whole = Math.round(n);
  return whole >= 60 && whole % 60 === 0
    ? { n: whole / 60, unit: "hours" }
    : { n: whole, unit: "minutes" };
}

/**
 * The shared envelope. One shell for both emails on purpose: they differ by
 * four sentences, and two near-identical copies of an email layout is the
 * duplication that rots, because the copy nobody looks at is the one that
 * drifts.
 *
 * `lines` are plain strings and get escaped here.
 */
function shell({ heading, greeting, lines, cta, ctaUrl, fallback, footnote, warning }) {
  const p = (text, style) =>
    `<p style="${style}">${escapeHtml(text)}</p>`;

  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <div style="max-width:560px;margin:0 auto;">
      <div style="background:${INK};color:#ffffff;padding:32px 30px;text-align:center;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">${escapeHtml(heading)}</h1>
        <p style="margin:8px 0 0 0;opacity:0.85;font-size:14px;">FieldQuo</p>
      </div>
      <div style="background:#ffffff;padding:32px 30px;">
        ${greeting ? p(greeting, `font-size:15px;line-height:1.7;margin:0 0 16px 0;`) : ""}
        ${lines
          .filter(Boolean)
          .map((line) => p(line, `font-size:15px;line-height:1.7;margin:0 0 16px 0;`))
          .join("")}
        <div style="text-align:center;margin:28px 0;">
          <a href="${escapeAttr(ctaUrl)}"
             style="display:inline-block;padding:14px 32px;background:${INK};color:#ffffff !important;
                    text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">${escapeHtml(cta)}</a>
        </div>
        <p style="font-size:12px;color:${FAINT};line-height:1.6;margin:0 0 20px 0;">
          ${escapeHtml(fallback)}<br/>
          <a href="${escapeAttr(ctaUrl)}" style="color:${FAINT};word-break:break-all;">${escapeHtml(ctaUrl)}</a>
        </p>
        ${p(warning, `font-size:14px;line-height:1.7;color:${MUTED};margin:0;padding-top:16px;border-top:1px solid #e5e7eb;`)}
      </div>
      <div style="text-align:center;padding:20px;color:${FOOT};font-size:12px;">
        ${escapeHtml(footnote)}
      </div>
    </div>
  </body>
</html>`;
}

/** The plain-text alternative, built from the same strings as the HTML. */
function plain({ greeting, lines, cta, ctaUrl, warning, footnote }) {
  return [
    greeting,
    "",
    ...lines.filter(Boolean),
    "",
    `${cta}:`,
    ctaUrl,
    "",
    warning,
    "",
    footnote,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n")
    .trim();
}

/**
 * Both builders take the same URL and it is the entire point of the message,
 * so an unusable one throws rather than producing an email with a dead button.
 * That is the house rule — never ship a control that appears to work — and the
 * realistic cause is a misconfigured BETTER_AUTH_URL, which is a deployment
 * fault that should be loud in the logs rather than dressed up as a delivered
 * security email.
 */
function requireLink(url, what) {
  const link = safeUrl(url);
  if (!link) {
    throw new Error(
      `[authEmails] ${what} was asked for with no usable link (got ${JSON.stringify(url)}). ` +
        `Check BETTER_AUTH_URL — an email with a dead button is worse than a failed send.`,
    );
  }
  return link;
}

/**
 * "Reset your password."
 *
 * @param url             the one-time reset link, from Better Auth
 * @param userName        optional; omitted rather than replaced with "there"
 * @param language        en | fr | es | uk | pa | tl, anything else → en
 * @param company         Company row or name, used as plain text context only
 * @param expiresMinutes  optional. Rendered ONLY when supplied — lib/auth.js
 *                        owns `resetPasswordTokenExpiresIn` and is the only
 *                        thing that knows the real number, so passing it from
 *                        there keeps one source of truth. Better Auth's own
 *                        default is 3600s, but hardcoding that here would be a
 *                        second copy that goes quietly wrong the day the
 *                        option is set, and a wrong expiry on a security email
 *                        is worse than no expiry at all.
 * @returns {{subject: string, html: string, text: string}}
 */
export function resetPasswordEmail({ url, userName, language, company, expiresMinutes } = {}) {
  const c = authEmailCopy(language);
  const link = requireLink(url, "resetPasswordEmail");
  const name = String(userName || "").trim();
  const org = companyName(company);
  const expiry = expiryParts(expiresMinutes);

  const parts = {
    greeting: name ? c.greeting(name) : "",
    lines: [
      c.resetBody(org),
      // `once` leads, so the expiry sentence can use a pronoun and read as
      // prose rather than as two clipped facts.
      [c.once, expiry ? c.expiry(expiry.n, expiry.unit, false) : ""]
        .filter(Boolean)
        .join(" "),
    ],
    cta: c.resetCta,
    ctaUrl: link,
    // The sentence that separates a security email from a scam-shaped one:
    // what to do if you did NOT ask for this, and what happens if you do
    // nothing (nothing).
    warning: c.resetNotYou,
    footnote: c.neverAsk,
  };

  return {
    subject: c.resetSubject,
    html: shell({ heading: c.resetHeading, fallback: c.fallback, ...parts }),
    text: plain(parts),
  };
}

/**
 * "Confirm your email address."
 *
 * Same envelope, same identity, same not-you sentence. Someone whose address
 * was typed into a signup by mistake deserves the same "ignore this and
 * nothing happens" that a reset gets.
 *
 * @returns {{subject: string, html: string, text: string}}
 */
export function verifyEmail({ url, userName, language, company, expiresMinutes } = {}) {
  const c = authEmailCopy(language);
  const link = requireLink(url, "verifyEmail");
  const name = String(userName || "").trim();
  const org = companyName(company);
  const expiry = expiryParts(expiresMinutes);

  const parts = {
    greeting: name ? c.greeting(name) : "",
    lines: [
      c.verifyBody(org),
      // No `once` here, unlike the reset. The reset token is genuinely
      // single-use — Better Auth calls consumeVerificationValue on it
      // (node_modules/better-auth/dist/api/routes/password.mjs) — but the
      // verification token is a stateless signed JWT that nothing consumes:
      // reopening the link after the address is confirmed just no-ops. Saying
      // "the link works once" here would be a claim about our own system that
      // is false, and the person it misleads is the one whose first tap was
      // eaten by a mail client's link scanner.
      // `lead` is true here: with no `once` in front of it this is the only
      // sentence on the line, and "It expires in 24 hours" has nothing to
      // refer back to.
      expiry ? c.expiry(expiry.n, expiry.unit, true) : "",
    ],
    cta: c.verifyCta,
    ctaUrl: link,
    warning: c.verifyNotYou,
    footnote: c.neverAsk,
  };

  return {
    subject: c.verifySubject,
    html: shell({ heading: c.verifyHeading, fallback: c.fallback, ...parts }),
    text: plain(parts),
  };
}
