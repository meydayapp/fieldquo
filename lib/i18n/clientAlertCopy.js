// lib/i18n/clientAlertCopy.js
//
// The words of the TEXT MESSAGE a company's own staff get when a client opens
// a quote, approves one, approves a change order or sends a request — the
// owner, 2026-10-14: "send me a text when the client has opened / approved a
// quote / change order / request" — and, since 2026-11-03, when a new enquiry
// arrives: "a text notification to the company owner for when a lead arrives
// and their collected information — Name, Email, phone, Intent etc." The
// enquiry's details are read fresh at send time and arrive here as params;
// see lib/notifications/alertFacts.js for why they are not feed-row params.
// Built by lib/notifications/staffTexts.js
// in the READER's language (lib/i18n/letterLanguage.js: their own, then the
// company's, then English).
//
// Nine languages, like lib/i18n/teamNoticeCopy.js and for its reason: the
// reader is staff, and staff read the app in nine (zh included). Held
// key-for-key with English by scripts/check-language-completeness.mjs
// (TABLES) and executed in every language by scripts/check-client-alerts.mjs.
//
// ── Why the English is plain ASCII ─────────────────────────────────────────
//
// FieldQuo pays per SEGMENT. A plain-ASCII text is 160 characters a segment;
// one character outside it (an em dash, a curly quote) turns the whole
// message into UCS-2 at 70 a segment and roughly doubles the bill. So the
// furniture here uses straight quotes and hyphens. The languages themselves
// are written correctly — "a approuvé", not "a approuve" — because a
// misspelt alert to save half a cent is the wrong trade; French, Spanish,
// German and Italian with an accent, and Ukrainian, Punjabi and Chinese
// always, are billed as UCS-2, and scripts/check-client-alerts.mjs prints
// the segment count for every language.

import { timesOrdinal } from "./timesOrdinal.js";

const COPY = {
  en: {
    aClient: "A client",
    viewed: (client, number) => `${client} opened quote ${number}`,
    viewedAgain: (client, number, nth) => `${client} opened quote ${number} (${nth})`,
    accepted: (client, number) => `${client} approved quote ${number}`,
    changeOrder: (client, label) => `${client} approved change order ${label}`,
    request: (client, subject) => `${client} sent a request: "${subject}"`,
    lead: (client, temp) => (temp ? `New enquiry: ${client} (${temp})` : `New enquiry: ${client}`),
    tel: "Tel",
    mail: "Email",
    wants: "Wants",
    temp: { hot: "Hot", warm: "Warm", cold: "Cold" },
    open: "Open",
    stop: "Reply STOP to opt out.",
  },
  fr: {
    aClient: "Un client",
    viewed: (client, number) => `${client} a ouvert la soumission ${number}`,
    viewedAgain: (client, number, nth) => `${client} a ouvert la soumission ${number} (${nth})`,
    accepted: (client, number) => `${client} a approuvé la soumission ${number}`,
    changeOrder: (client, label) => `${client} a approuvé l'avenant ${label}`,
    request: (client, subject) => `${client} a envoyé une demande : "${subject}"`,
    lead: (client, temp) => (temp ? `Nouvelle demande : ${client} (${temp})` : `Nouvelle demande : ${client}`),
    tel: "Tél",
    mail: "Courriel",
    wants: "Veut",
    temp: { hot: "chaude", warm: "tiède", cold: "froide" },
    open: "Ouvrir",
    stop: "Répondez STOP pour arrêter.",
  },
  es: {
    aClient: "Un cliente",
    viewed: (client, number) => `${client} abrió el presupuesto ${number}`,
    viewedAgain: (client, number, nth) => `${client} abrió el presupuesto ${number} (${nth})`,
    accepted: (client, number) => `${client} aprobó el presupuesto ${number}`,
    changeOrder: (client, label) => `${client} aprobó la orden de cambio ${label}`,
    request: (client, subject) => `${client} envió una solicitud: "${subject}"`,
    lead: (client, temp) => (temp ? `Nueva consulta: ${client} (${temp})` : `Nueva consulta: ${client}`),
    tel: "Tel",
    mail: "Correo",
    wants: "Quiere",
    temp: { hot: "caliente", warm: "tibio", cold: "frío" },
    open: "Abrir",
    stop: "Responda STOP para cancelar.",
  },
  uk: {
    aClient: "Клієнт",
    viewed: (client, number) => `${client} відкрив(ла) кошторис ${number}`,
    viewedAgain: (client, number, nth) => `${client} відкрив(ла) кошторис ${number} (${nth})`,
    accepted: (client, number) => `${client} схвалив(ла) кошторис ${number}`,
    changeOrder: (client, label) => `${client} погодив(ла) зміну замовлення ${label}`,
    request: (client, subject) => `${client} надіслав(ла) запит: "${subject}"`,
    lead: (client, temp) => (temp ? `Новий запит: ${client} (${temp})` : `Новий запит: ${client}`),
    tel: "Тел",
    mail: "Email",
    wants: "Потрібно",
    temp: { hot: "гарячий", warm: "теплий", cold: "холодний" },
    open: "Відкрити",
    stop: "STOP — щоб відписатися.",
  },
  pa: {
    aClient: "ਇੱਕ ਗਾਹਕ",
    viewed: (client, number) => `${client} ਨੇ ਕੋਟ ${number} ਖੋਲ੍ਹਿਆ`,
    viewedAgain: (client, number, nth) => `${client} ਨੇ ਕੋਟ ${number} ਖੋਲ੍ਹਿਆ (${nth})`,
    accepted: (client, number) => `${client} ਨੇ ਕੋਟ ${number} ਮਨਜ਼ੂਰ ਕੀਤਾ`,
    changeOrder: (client, label) => `${client} ਨੇ ਤਬਦੀਲੀ ਆਰਡਰ ${label} ਮਨਜ਼ੂਰ ਕੀਤਾ`,
    request: (client, subject) => `${client} ਨੇ ਬੇਨਤੀ ਭੇਜੀ: "${subject}"`,
    lead: (client, temp) => (temp ? `ਨਵੀਂ ਪੁੱਛਗਿੱਛ: ${client} (${temp})` : `ਨਵੀਂ ਪੁੱਛਗਿੱਛ: ${client}`),
    tel: "ਫ਼ੋਨ",
    mail: "ਈਮੇਲ",
    wants: "ਚਾਹੀਦਾ",
    temp: { hot: "ਗਰਮ", warm: "ਨਿੱਘਾ", cold: "ਠੰਢਾ" },
    open: "ਖੋਲ੍ਹੋ",
    stop: "ਬੰਦ ਕਰਨ ਲਈ STOP ਭੇਜੋ।",
  },
  tl: {
    aClient: "Isang kliyente",
    viewed: (client, number) => `Binuksan ni ${client} ang quote ${number}`,
    viewedAgain: (client, number, nth) => `Binuksan ni ${client} ang quote ${number} (${nth})`,
    accepted: (client, number) => `Inaprubahan ni ${client} ang quote ${number}`,
    changeOrder: (client, label) => `Inaprubahan ni ${client} ang change order ${label}`,
    request: (client, subject) => `Nagpadala si ${client} ng request: "${subject}"`,
    lead: (client, temp) => (temp ? `Bagong tanong: ${client} (${temp})` : `Bagong tanong: ${client}`),
    tel: "Tel",
    mail: "Email",
    wants: "Kailangan",
    temp: { hot: "mainit", warm: "malamig-init", cold: "malamig" },
    open: "Buksan",
    stop: "I-reply ang STOP para huminto.",
  },
  de: {
    aClient: "Ein Kunde",
    viewed: (client, number) => `${client} hat Angebot ${number} geöffnet`,
    viewedAgain: (client, number, nth) => `${client} hat Angebot ${number} geöffnet (${nth})`,
    accepted: (client, number) => `${client} hat Angebot ${number} angenommen`,
    changeOrder: (client, label) => `${client} hat Nachtrag ${label} freigegeben`,
    request: (client, subject) => `${client} hat eine Anfrage gesendet: "${subject}"`,
    lead: (client, temp) => (temp ? `Neue Anfrage: ${client} (${temp})` : `Neue Anfrage: ${client}`),
    tel: "Tel",
    mail: "E-Mail",
    wants: "Will",
    temp: { hot: "heiß", warm: "warm", cold: "kalt" },
    open: "Öffnen",
    stop: "STOP zum Abmelden.",
  },
  zh: {
    aClient: "一位客户",
    viewed: (client, number) => `${client} 打开了报价单 ${number}`,
    viewedAgain: (client, number, nth) => `${client} 打开了报价单 ${number}（${nth}）`,
    accepted: (client, number) => `${client} 批准了报价单 ${number}`,
    changeOrder: (client, label) => `${client} 批准了变更单 ${label}`,
    request: (client, subject) => `${client} 发来请求："${subject}"`,
    lead: (client, temp) => (temp ? `新询价：${client}（${temp}）` : `新询价：${client}`),
    tel: "电话",
    mail: "邮箱",
    wants: "需求",
    temp: { hot: "热", warm: "温", cold: "冷" },
    open: "打开",
    stop: "回复 STOP 退订。",
  },
  it: {
    aClient: "Un cliente",
    viewed: (client, number) => `${client} ha aperto il preventivo ${number}`,
    viewedAgain: (client, number, nth) => `${client} ha aperto il preventivo ${number} (${nth})`,
    accepted: (client, number) => `${client} ha approvato il preventivo ${number}`,
    changeOrder: (client, label) => `${client} ha approvato la variante ${label}`,
    request: (client, subject) => `${client} ha inviato una richiesta: "${subject}"`,
    lead: (client, temp) => (temp ? `Nuova richiesta: ${client} (${temp})` : `Nuova richiesta: ${client}`),
    tel: "Tel",
    mail: "Email",
    wants: "Vuole",
    temp: { hot: "calda", warm: "tiepida", cold: "fredda" },
    open: "Apri",
    stop: "Rispondi STOP per disattivare.",
  },
};

/** The raw table, for scripts/check-language-completeness.mjs. */
export const CLIENT_ALERT_COPY = COPY;

/** Does this table carry the language? letterLanguage()'s `has`. */
export function clientAlertHas(code) {
  return Object.prototype.hasOwnProperty.call(COPY, String(code || "").toLowerCase());
}

/** The copy in one language, English for anything this table does not carry. */
export function clientAlertCopy(language = "en") {
  const code = String(language || "").toLowerCase().split(/[-_]/)[0];
  return COPY[code] || COPY.en;
}

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * The text itself. PURE — scripts/check-client-alerts.mjs builds every event
 * in every language with it.
 *
 * @param event      a CLIENT_ALERTS key
 * @param params     the feed row's params (clientName, quoteNumber, count,
 *                   label, subject)
 * @param amountText the amount ALREADY formatted for this reader, or null —
 *                   the caller decides whether this reader may see money
 *                   (lib/notifications/staffTexts.js); this function never
 *                   sees a number it could print by mistake
 * @param link       the record in the app
 */
export function staffAlertSms({ event, language = "en", params = {}, amountText = null, link = "" }) {
  const c = clientAlertCopy(language);
  const client = clip(params.clientName, 40) || c.aClient;
  let sentence;
  switch (event) {
    case "quote.viewed": {
      const count = Math.trunc(Number(params.count) || 1);
      sentence = count > 1
        ? c.viewedAgain(client, clip(params.quoteNumber, 30), timesOrdinal(language, count))
        : c.viewed(client, clip(params.quoteNumber, 30));
      break;
    }
    case "quote.accepted":
      sentence = c.accepted(client, clip(params.quoteNumber, 30));
      break;
    case "changeOrder.approved":
      sentence = c.changeOrder(client, clip(params.label, 30));
      break;
    case "client_ticket.opened":
      // The client's own words, clipped: a subject line, not their essay —
      // and every character past 160 is another segment FieldQuo pays for.
      sentence = c.request(client, clip(params.subject, 50));
      break;
    case "lead.created":
      // ── A card of lines, not a sentence ──────────────────────────────
      //
      // Returned whole rather than folded into the tail below, because this
      // message is the ONLY one of the five somebody is meant to ACT on from
      // the lock screen: the agency's coaching is a call inside 60 seconds,
      // which means the number has to be readable without opening the app.
      // Lines, in the order somebody in a van reads them.
      //
      // Each line is present only if the lead actually holds it
      // (lib/notifications/alertFacts.js omits the key rather than nulling
      // it). No "Tel: -" and no invented service: a text with holes in it is
      // how a contractor learns to stop trusting these.
      return [
        // `leadName`, not `clientName`: a lead is not a client yet, and the
        // catalog's param for lead.created is the one the bell renders.
        `FieldQuo: ${c.lead(clip(params.leadName, 40) || c.aClient, c.temp?.[params.temperature] || null)}`,
        params.leadPhone ? `${c.tel}: ${clip(params.leadPhone, 24)}` : null,
        params.leadEmail ? `${c.mail}: ${clip(params.leadEmail, 48)}` : null,
        params.leadWant ? `${c.wants}: ${clip(params.leadWant, 60)}` : null,
        link ? `${c.open}: ${link}` : null,
        c.stop,
      ]
        .filter(Boolean)
        .join("\n");
    default:
      return null;
  }
  const money = amountText ? ` (${amountText})` : "";
  const open = link ? ` ${c.open}: ${link}` : "";
  return `FieldQuo: ${sentence}${money}.${open}\n${c.stop}`;
}

/**
 * Segments a text will be billed as. GSM-7 when every character is in the
 * basic set FieldQuo's copy uses (ASCII); UCS-2 otherwise. The same rule as
 * lib/aiEmployee/onCall.js alertTextSegments, which the urgent alerts meter
 * with — written once there and reused here.
 */
export { alertTextSegments as smsSegments } from "../aiEmployee/onCall.js";
