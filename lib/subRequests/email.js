// lib/subRequests/email.js
//
// The email a sub receives when a GC asks for their price — and the one
// reminder. From the GC's company (resolveSender: their verified domain, or
// the platform sender wearing their NAME), on the GC's own stationery
// (documentTheme / documentEmailHtml), so to the sub it is a message from the
// contractor they work with.
//
// What it says is the owner's list (2026-10-06): the trade, the area of the
// job, the scope, that there are photos, the wanted-by date, and three ways
// to answer — log in to FieldQuo, create a free account (prefilled from what
// the GC holds about them), or reply with a price without an account. Plus a
// decline.
//
// What it never says: anything about the homeowner. It is built from
// model.js subFacingRequest — the allow-list — and nothing else; the full
// address is on the request page behind the token, the email carries the
// AREA only (an email gets forwarded).
//
// FieldQuo is named, on purpose: the owner asked for the sub to be invited
// to FieldQuo, and the sub is not the GC's client — the white-label rule is
// about the homeowner. The GC's brand still carries the message.
//
// Pure: no I/O. Eight languages, the same set as lib/i18n/emailCopy.js
// (scripts/check-sub-price-requests.mjs fails if one is missing).

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { documentEmailHtml, emailButton, escapeHtml, EMAIL_FONT } from "@/lib/email/documentEmailLayout";
import { TRIAL_DAYS } from "@/lib/pricing";

const COPY = {
  en: {
    word: "Price request",
    subject: (gc, trade) => `${gc} is asking for your price — ${trade}`,
    reminderSubject: (gc, trade) => `Reminder: ${gc} is waiting for your price — ${trade}`,
    greeting: (name) => (name ? `Hi ${name},` : "Hello,"),
    intro: (gc, trade) => `${gc} would like your price for ${trade} work.`,
    reminderIntro: (gc, trade) => `A quick reminder: ${gc} would still like your price for ${trade} work.`,
    trade: "Trade",
    area: "Area",
    wantedBy: "Wanted by",
    scope: "What they need",
    photos: (n) => (n === 1 ? "1 photo is on the request page." : `${n} photos are on the request page.`),
    login: "Log in to FieldQuo to price it",
    signup: "Create your free account",
    signupNote: (gc, days) => `${days} days free, no card. We fill in what ${gc} has on file for you — choose a password and press Next.`,
    reply: "Reply with a price without an account",
    why: (gc) => `Pricing it in FieldQuo links your two companies: your quote goes straight into ${gc}'s comparison, with nothing to attach or paste.`,
    decline: "Can't take it on? You can decline from the same page.",
    questions: (gc) => `Questions about the job? Reply to this email to reach ${gc}.`,
  },
  fr: {
    word: "Demande de prix",
    subject: (gc, trade) => `${gc} vous demande un prix — ${trade}`,
    reminderSubject: (gc, trade) => `Rappel : ${gc} attend votre prix — ${trade}`,
    greeting: (name) => (name ? `Bonjour ${name},` : "Bonjour,"),
    intro: (gc, trade) => `${gc} aimerait obtenir votre prix pour des travaux de ${trade}.`,
    reminderIntro: (gc, trade) => `Petit rappel : ${gc} aimerait toujours obtenir votre prix pour des travaux de ${trade}.`,
    trade: "Métier",
    area: "Secteur",
    wantedBy: "Souhaité pour le",
    scope: "Ce qu'il faut faire",
    photos: (n) => (n === 1 ? "1 photo se trouve sur la page de la demande." : `${n} photos se trouvent sur la page de la demande.`),
    login: "Se connecter à FieldQuo pour chiffrer",
    signup: "Créer votre compte gratuit",
    signupNote: (gc, days) => `${days} jours gratuits, sans carte. Nous remplissons ce que ${gc} a à votre dossier — choisissez un mot de passe et appuyez sur Suivant.`,
    reply: "Répondre avec un prix sans compte",
    why: (gc) => `Chiffrer dans FieldQuo relie vos deux entreprises : votre soumission arrive directement dans la comparaison de ${gc}, sans pièce jointe ni lien à coller.`,
    decline: "Vous ne pouvez pas le prendre? Vous pouvez refuser depuis la même page.",
    questions: (gc) => `Des questions sur les travaux? Répondez à ce courriel pour joindre ${gc}.`,
  },
  es: {
    word: "Solicitud de precio",
    subject: (gc, trade) => `${gc} le pide un precio — ${trade}`,
    reminderSubject: (gc, trade) => `Recordatorio: ${gc} espera su precio — ${trade}`,
    greeting: (name) => (name ? `Hola ${name}:` : "Hola:"),
    intro: (gc, trade) => `${gc} quisiera su precio para un trabajo de ${trade}.`,
    reminderIntro: (gc, trade) => `Un breve recordatorio: ${gc} todavía quisiera su precio para un trabajo de ${trade}.`,
    trade: "Oficio",
    area: "Zona",
    wantedBy: "Para el",
    scope: "Lo que se necesita",
    photos: (n) => (n === 1 ? "Hay 1 foto en la página de la solicitud." : `Hay ${n} fotos en la página de la solicitud.`),
    login: "Inicie sesión en FieldQuo para cotizar",
    signup: "Cree su cuenta gratuita",
    signupNote: (gc, days) => `${days} días gratis, sin tarjeta. Completamos lo que ${gc} tiene registrado sobre usted: elija una contraseña y pulse Siguiente.`,
    reply: "Responder con un precio sin cuenta",
    why: (gc) => `Cotizar en FieldQuo vincula sus dos empresas: su cotización llega directamente a la comparación de ${gc}, sin adjuntos ni enlaces que pegar.`,
    decline: "¿No puede aceptarlo? Puede rechazarlo desde la misma página.",
    questions: (gc) => `¿Preguntas sobre el trabajo? Responda a este correo para contactar a ${gc}.`,
  },
  uk: {
    word: "Запит ціни",
    subject: (gc, trade) => `${gc} просить вашу ціну — ${trade}`,
    reminderSubject: (gc, trade) => `Нагадування: ${gc} чекає на вашу ціну — ${trade}`,
    greeting: (name) => (name ? `Вітаємо, ${name}!` : "Вітаємо!"),
    intro: (gc, trade) => `${gc} хоче отримати вашу ціну на роботи: ${trade}.`,
    reminderIntro: (gc, trade) => `Коротке нагадування: ${gc} досі чекає вашу ціну на роботи: ${trade}.`,
    trade: "Спеціальність",
    area: "Район",
    wantedBy: "Потрібно до",
    scope: "Що потрібно зробити",
    photos: (n) => `Фото на сторінці запиту: ${n}.`,
    login: "Увійти у FieldQuo, щоб оцінити",
    signup: "Створити безкоштовний обліковий запис",
    signupNote: (gc, days) => `${days} днів безкоштовно, без картки. Ми заповнимо те, що ${gc} має про вас, — оберіть пароль і натисніть «Далі».`,
    reply: "Відповісти з ціною без облікового запису",
    why: (gc) => `Оцінка у FieldQuo поєднує ваші компанії: ваша пропозиція одразу потрапляє в порівняння ${gc} — нічого не треба вкладати чи вставляти.`,
    decline: "Не можете взятися? Відмовитися можна на тій самій сторінці.",
    questions: (gc) => `Питання щодо робіт? Дайте відповідь на цей лист, щоб зв'язатися з ${gc}.`,
  },
  pa: {
    word: "ਕੀਮਤ ਦੀ ਬੇਨਤੀ",
    subject: (gc, trade) => `${gc} ਤੁਹਾਡੀ ਕੀਮਤ ਮੰਗ ਰਿਹਾ ਹੈ — ${trade}`,
    reminderSubject: (gc, trade) => `ਯਾਦ ਦਿਵਾਉਣਾ: ${gc} ਤੁਹਾਡੀ ਕੀਮਤ ਦੀ ਉਡੀਕ ਕਰ ਰਿਹਾ ਹੈ — ${trade}`,
    greeting: (name) => (name ? `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name},` : "ਸਤ ਸ੍ਰੀ ਅਕਾਲ,"),
    intro: (gc, trade) => `${gc} ${trade} ਦੇ ਕੰਮ ਲਈ ਤੁਹਾਡੀ ਕੀਮਤ ਚਾਹੁੰਦਾ ਹੈ।`,
    reminderIntro: (gc, trade) => `ਇੱਕ ਛੋਟੀ ਯਾਦ: ${gc} ਹਾਲੇ ਵੀ ${trade} ਦੇ ਕੰਮ ਲਈ ਤੁਹਾਡੀ ਕੀਮਤ ਚਾਹੁੰਦਾ ਹੈ।`,
    trade: "ਕਿੱਤਾ",
    area: "ਇਲਾਕਾ",
    wantedBy: "ਇਸ ਤਾਰੀਖ ਤੱਕ",
    scope: "ਕੀ ਚਾਹੀਦਾ ਹੈ",
    photos: (n) => `ਬੇਨਤੀ ਵਾਲੇ ਪੰਨੇ 'ਤੇ ${n} ਫੋਟੋਆਂ ਹਨ।`,
    login: "ਕੀਮਤ ਲਗਾਉਣ ਲਈ FieldQuo ਵਿੱਚ ਲੌਗ ਇਨ ਕਰੋ",
    signup: "ਆਪਣਾ ਮੁਫ਼ਤ ਖਾਤਾ ਬਣਾਓ",
    signupNote: (gc, days) => `${days} ਦਿਨ ਮੁਫ਼ਤ, ਕੋਈ ਕਾਰਡ ਨਹੀਂ। ਅਸੀਂ ਉਹ ਭਰ ਦਿੰਦੇ ਹਾਂ ਜੋ ${gc} ਕੋਲ ਤੁਹਾਡੇ ਬਾਰੇ ਦਰਜ ਹੈ — ਪਾਸਵਰਡ ਚੁਣੋ ਅਤੇ ਅੱਗੇ ਦਬਾਓ।`,
    reply: "ਖਾਤੇ ਤੋਂ ਬਿਨਾਂ ਕੀਮਤ ਨਾਲ ਜਵਾਬ ਦਿਓ",
    why: (gc) => `FieldQuo ਵਿੱਚ ਕੀਮਤ ਲਗਾਉਣ ਨਾਲ ਤੁਹਾਡੀਆਂ ਦੋਵੇਂ ਕੰਪਨੀਆਂ ਜੁੜ ਜਾਂਦੀਆਂ ਹਨ: ਤੁਹਾਡਾ ਕੋਟ ਸਿੱਧਾ ${gc} ਦੀ ਤੁਲਨਾ ਵਿੱਚ ਜਾਂਦਾ ਹੈ, ਕੁਝ ਵੀ ਨੱਥੀ ਕਰਨ ਜਾਂ ਚਿਪਕਾਉਣ ਦੀ ਲੋੜ ਨਹੀਂ।`,
    decline: "ਨਹੀਂ ਲੈ ਸਕਦੇ? ਤੁਸੀਂ ਉਸੇ ਪੰਨੇ ਤੋਂ ਇਨਕਾਰ ਕਰ ਸਕਦੇ ਹੋ।",
    questions: (gc) => `ਕੰਮ ਬਾਰੇ ਸਵਾਲ? ${gc} ਨਾਲ ਸੰਪਰਕ ਕਰਨ ਲਈ ਇਸ ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ।`,
  },
  tl: {
    word: "Hiling na presyo",
    subject: (gc, trade) => `Hinihingi ng ${gc} ang inyong presyo — ${trade}`,
    reminderSubject: (gc, trade) => `Paalala: hinihintay ng ${gc} ang inyong presyo — ${trade}`,
    greeting: (name) => (name ? `Kumusta ${name},` : "Kumusta,"),
    intro: (gc, trade) => `Gusto ng ${gc} ang inyong presyo para sa trabahong ${trade}.`,
    reminderIntro: (gc, trade) => `Maikling paalala: gusto pa rin ng ${gc} ang inyong presyo para sa trabahong ${trade}.`,
    trade: "Trabaho",
    area: "Lugar",
    wantedBy: "Kailangan bago ang",
    scope: "Ang kailangan",
    photos: (n) => (n === 1 ? "May 1 larawan sa pahina ng hiling." : `May ${n} larawan sa pahina ng hiling.`),
    login: "Mag-log in sa FieldQuo para magpresyo",
    signup: "Gumawa ng libreng account",
    signupNote: (gc, days) => `${days} araw na libre, walang card. Pupunan namin ang nakatala ng ${gc} tungkol sa inyo — pumili ng password at pindutin ang Susunod.`,
    reply: "Sumagot ng presyo nang walang account",
    why: (gc) => `Ang pagpepresyo sa FieldQuo ay nag-uugnay sa inyong dalawang kumpanya: diretso ang inyong quote sa paghahambing ng ${gc}, walang kailangang i-attach o i-paste.`,
    decline: "Hindi ninyo kaya? Maaari kayong tumanggi sa parehong pahina.",
    questions: (gc) => `May tanong tungkol sa trabaho? Sumagot sa email na ito para maabot ang ${gc}.`,
  },
  de: {
    word: "Preisanfrage",
    subject: (gc, trade) => `${gc} bittet um Ihren Preis — ${trade}`,
    reminderSubject: (gc, trade) => `Erinnerung: ${gc} wartet auf Ihren Preis — ${trade}`,
    greeting: (name) => (name ? `Hallo ${name},` : "Hallo,"),
    intro: (gc, trade) => `${gc} möchte Ihren Preis für ${trade}-Arbeiten.`,
    reminderIntro: (gc, trade) => `Eine kurze Erinnerung: ${gc} möchte weiterhin Ihren Preis für ${trade}-Arbeiten.`,
    trade: "Gewerk",
    area: "Gegend",
    wantedBy: "Gewünscht bis",
    scope: "Was gebraucht wird",
    photos: (n) => (n === 1 ? "1 Foto liegt auf der Anfrageseite." : `${n} Fotos liegen auf der Anfrageseite.`),
    login: "In FieldQuo anmelden und kalkulieren",
    signup: "Kostenloses Konto erstellen",
    signupNote: (gc, days) => `${days} Tage kostenlos, ohne Karte. Wir füllen aus, was ${gc} über Sie gespeichert hat — Passwort wählen und auf Weiter tippen.`,
    reply: "Ohne Konto mit einem Preis antworten",
    why: (gc) => `Kalkulieren in FieldQuo verbindet Ihre beiden Firmen: Ihr Angebot landet direkt im Vergleich von ${gc}, ohne Anhang oder eingefügten Link.`,
    decline: "Können Sie es nicht übernehmen? Sie können auf derselben Seite absagen.",
    questions: (gc) => `Fragen zum Auftrag? Antworten Sie auf diese E-Mail, um ${gc} zu erreichen.`,
  },
  it: {
    word: "Richiesta di prezzo",
    subject: (gc, trade) => `${gc} le chiede un prezzo — ${trade}`,
    reminderSubject: (gc, trade) => `Promemoria: ${gc} attende il suo prezzo — ${trade}`,
    greeting: (name) => (name ? `Buongiorno ${name},` : "Buongiorno,"),
    intro: (gc, trade) => `${gc} vorrebbe il suo prezzo per lavori di ${trade}.`,
    reminderIntro: (gc, trade) => `Un breve promemoria: ${gc} vorrebbe ancora il suo prezzo per lavori di ${trade}.`,
    trade: "Mestiere",
    area: "Zona",
    wantedBy: "Entro il",
    scope: "Cosa serve",
    photos: (n) => (n === 1 ? "C'è 1 foto nella pagina della richiesta." : `Ci sono ${n} foto nella pagina della richiesta.`),
    login: "Acceda a FieldQuo per fare il prezzo",
    signup: "Crei il suo account gratuito",
    signupNote: (gc, days) => `${days} giorni gratis, senza carta. Compiliamo ciò che ${gc} ha registrato su di lei: scelga una password e prema Avanti.`,
    reply: "Rispondere con un prezzo senza account",
    why: (gc) => `Fare il prezzo in FieldQuo collega le vostre due aziende: il suo preventivo arriva direttamente nel confronto di ${gc}, senza allegati né link da incollare.`,
    decline: "Non può accettarlo? Può rifiutare dalla stessa pagina.",
    questions: (gc) => `Domande sul lavoro? Risponda a questa email per contattare ${gc}.`,
  },
};

/** The languages this email is written in — must equal lib/i18n/emailCopy.js's set. */
export const PRICE_REQUEST_EMAIL_LANGUAGES = Object.freeze(Object.keys(COPY));

/** Exported for the check: every language has every key. */
export const PRICE_REQUEST_EMAIL_COPY = COPY;

const copyFor = (language) => COPY[language] || COPY.en;

/** "Trade" / "Wanted by" for the lead message in the SUB's FieldQuo. */
export function requestLabels(language) {
  const c = copyFor(language);
  return { trade: c.trade, wantedBy: c.wantedBy };
}

/**
 * @param view      model.js subFacingRequest() — the allow-list, and ONLY it
 * @param gcCompany the GC's company row, for the stationery (name, logo,
 *                  brand colour, contact line)
 * @param subName   the contact name the GC holds for the sub, for the greeting
 * @param urls      { page, login, signup, reply }
 * @param formatDate (iso) => string, in the email's language
 */
export function buildPriceRequestEmail({ view, gcCompany, subName = "", urls, language = "en", reminder = false, formatDate = (d) => d }) {
  const c = copyFor(language);
  const gc = view.gc.name || "";
  const trade = view.trade || "";
  const t = documentTheme(gcCompany || {});
  const fill = fillPair(t);

  const rows = [
    [c.trade, trade],
    view.area ? [c.area, view.area] : null,
    view.wantedBy ? [c.wantedBy, formatDate(view.wantedBy)] : null,
  ]
    .filter(Boolean)
    .map(
      ([label, value]) => `
              <tr>
                <td style="padding:2px 0;font-size:13px;line-height:1.5;color:${t.inkMutedOnWash};">${escapeHtml(label)}</td>
                <td style="padding:2px 0;font-size:13px;line-height:1.5;font-weight:700;text-align:right;color:${t.inkOnWash};">${escapeHtml(value)}</td>
              </tr>`,
    )
    .join("");

  const scopeHtml = escapeHtml(view.scope || "").replace(/\n/g, "<br />");
  const photoLine = view.photos.length ? c.photos(view.photos.length) : "";
  const link = (url, label) =>
    `<a href="${escapeHtml(url)}" style="color:${t.ink};font-weight:700;text-decoration:underline;">${escapeHtml(label)}</a>`;

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">${escapeHtml(c.greeting(subName))}</p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 18px;color:${t.inkMuted};">${escapeHtml(reminder ? c.reminderIntro(gc, trade) : c.intro(gc, trade))}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 18px;">
          <tr>
            <td bgcolor="${t.accentWash}" style="background:${t.accentWash};border-radius:8px;padding:12px 14px;font-family:${EMAIL_FONT};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${rows}</table>
              <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${t.inkMutedOnWash};padding:10px 0 4px;">${escapeHtml(c.scope.toUpperCase())}</div>
              <div style="font-size:13px;line-height:1.6;color:${t.inkOnWash};">${scopeHtml}</div>
              ${photoLine ? `<div style="font-size:12px;line-height:1.6;color:${t.inkMutedOnWash};padding-top:8px;">${escapeHtml(photoLine)}</div>` : ""}
            </td>
          </tr>
        </table>
        ${emailButton({ url: urls.login, label: c.login, fill })}
        <p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;margin:14px 0 4px;color:${t.inkMuted};">${link(urls.signup, c.signup)}</p>
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;margin:0 0 14px;color:${t.inkMuted};">${escapeHtml(c.signupNote(gc, TRIAL_DAYS))}</p>
        <p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;margin:0 0 14px;color:${t.inkMuted};">${link(urls.reply, c.reply)}</p>
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;margin:0 0 8px;color:${t.inkMuted};">${escapeHtml(c.why(gc))}</p>
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;margin:0;color:${t.inkMuted};">${escapeHtml(c.decline)}</p>`;

  const html = documentEmailHtml({
    company: gcCompany || {},
    theme: t,
    fill,
    label: c.word,
    reference: trade,
    body,
    footerNote: escapeHtml(c.questions(gc)),
  });

  const text = [
    c.greeting(subName),
    "",
    reminder ? c.reminderIntro(gc, trade) : c.intro(gc, trade),
    "",
    `${c.trade}: ${trade}`,
    view.area ? `${c.area}: ${view.area}` : "",
    view.wantedBy ? `${c.wantedBy}: ${formatDate(view.wantedBy)}` : "",
    "",
    `${c.scope}:`,
    view.scope || "",
    photoLine,
    "",
    `${c.login}: ${urls.login}`,
    `${c.signup}: ${urls.signup}`,
    c.signupNote(gc, TRIAL_DAYS),
    `${c.reply}: ${urls.reply}`,
    "",
    c.why(gc),
    c.decline,
    "",
    c.questions(gc),
    gc,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");

  return {
    subject: reminder ? c.reminderSubject(gc, trade) : c.subject(gc, trade),
    html,
    text,
  };
}
