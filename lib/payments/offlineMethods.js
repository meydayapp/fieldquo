// lib/payments/offlineMethods.js
//
// The ways a client can pay WITHOUT a card, by country: what each one is
// called, what a company has to tell the client for it to work, and the one
// sentence the invoice prints so the client knows what to do.
//
// ── Why a catalogue by country ──────────────────────────────────────────────
//
// The owner's brief: "the USA doesn't have e-transfer, so if an American
// company signs up it should show the equivalent — Venmo or whatever they
// use." Interac is a Canadian network; a US contractor hands a homeowner a
// Zelle phone number, a Venmo handle, a $cashtag or a paper CHECK (their
// spelling). Offering "E-transfer" to a US company is a control that appears
// to work and doesn't — the client cannot send one. So the list a company can
// switch on is decided by `Company.country`, and a stored method that does
// not exist in the company's country is silently dropped on read rather than
// printed on a document. See `enabledMethods()`.
//
// ── Why detail fields, and why they are required ────────────────────────────
//
// "Accepted: E-transfer" on an invoice tells the client that a method exists
// and nothing about how to use it — they still have to phone and ask for the
// address. A "How to pay" block is only useful if it carries the address, so
// switching a method on without the detail it needs is refused on save
// (`validateDetails`), in a sentence. A method that has been on since before
// details existed (the schema default) prints its label alone until the
// company fills it in — that is what the old line said too, so nothing the
// document used to say is lost.
//
// ── What is printed where ───────────────────────────────────────────────────
//
// `buildHowToPay()` renders the block ONCE, in the document's language, as
// plain strings. The PDF section, the invoice email, the client portal and
// the public quote page all paint that same model, so they cannot disagree.
// The send route stores it on `Invoice.howToPay` (non-negotiable #6: a
// document keeps what it said).
//
// One exception to "every surface prints the same lines": ACH is a bank
// account number. It goes on the PDF and the portal, which the client opens
// on purpose, and NOT into an email body, which gets forwarded, quoted and
// archived by mail servers the company does not control. The email says the
// bank details are on the invoice (`documentOnly` below).
//
// Pure: no database, no React, no theme. Executed by
// scripts/check-offline-payment-methods.mjs against every language.

import { resolveCountry } from "@/lib/company/resolveCountry";
import { companyBankDebitMethod } from "@/lib/stripe/bankDebit";
import { offlineDiscountInvoiceNote } from "@/lib/payments/offlineDiscount";

/**
 * The Company columns buildHowToPay reads — for every route that emails an
 * invoice with a narrow `select`. Spread it in rather than listing columns
 * by hand: the send route, the chaser, the payment-schedule cron and the
 * service-plan cron each had their own copy of "what the invoice email
 * needs from the company", and each copy was the one that rotted (the
 * chaser once formatted every GBP invoice in CAD for want of `currency`).
 */
export const HOW_TO_PAY_COMPANY_SELECT = Object.freeze({
  name: true,
  country: true,
  address: true,
  province: true,
  currency: true,
  paymentMethods: true,
  paymentMethodDetails: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
  stripeBankDebitEnabled: true,
  offerFinancing: true,
  stripeAffirmStatus: true,
});

/** The document languages every label and sentence below must cover. */
export const OFFLINE_METHOD_LANGUAGES = Object.freeze(["en", "fr", "es", "uk", "pa", "tl", "de", "it"]);

// Field kinds decide validation, nothing else. `secret` marks a value that
// must never appear in a log line or an email body.
//   email_or_phone — an Interac / Zelle / PayPal destination
//   handle         — a Venmo username, stored without the @
//   cashtag        — a Cash App $cashtag, stored without the $
//   routing        — a nine-digit ABA number, checksum-verified
//   account        — a bank account number, digits only
//   text           — a name or a sentence
//   address        — a postal address, may span lines
//   bool           — a switch
const F = (key, kind, opts = {}) => Object.freeze({ key, kind, required: false, secret: false, ...opts });

/**
 * The closed catalogue. `countries` is where the method exists; "*" means
 * everywhere. Order is display order on the document.
 */
export const OFFLINE_METHODS = Object.freeze({
  e_transfer: Object.freeze({
    countries: ["CA"],
    fields: [
      F("address", "email_or_phone", { required: true }),
      F("autoDeposit", "bool"),
      F("securityQuestion", "text"),
      F("securityAnswer", "text"),
    ],
  }),
  zelle: Object.freeze({ countries: ["US"], fields: [F("address", "email_or_phone", { required: true })] }),
  venmo: Object.freeze({ countries: ["US"], fields: [F("handle", "handle", { required: true })] }),
  cash_app: Object.freeze({ countries: ["US"], fields: [F("cashtag", "cashtag", { required: true })] }),
  ach: Object.freeze({
    countries: ["US"],
    documentOnly: true,
    fields: [
      F("bankName", "text", { required: true }),
      F("routingNumber", "routing", { required: true, secret: true }),
      F("accountNumber", "account", { required: true, secret: true }),
    ],
  }),
  paypal: Object.freeze({ countries: ["*"], fields: [F("address", "email_or_phone", { required: true })] }),
  // A cheque needs a payee and the payee is the company — its own name is a
  // fact already on the document, not an invention, so nothing is required
  // here and the schema default (cheque on) keeps printing a real sentence.
  cheque: Object.freeze({ countries: ["*"], except: ["US"], fields: [F("payee", "text"), F("mailingAddress", "address")] }),
  check: Object.freeze({ countries: ["US"], fields: [F("payee", "text"), F("mailingAddress", "address")] }),
  cash: Object.freeze({ countries: ["*"], fields: [] }),
});

export const OFFLINE_METHOD_KEYS = Object.freeze(Object.keys(OFFLINE_METHODS));

// The two countries the product prices in have their own lists; anywhere
// else gets what works anywhere (a UK company is not offered Interac OR
// Zelle — neither exists there). `except` is the one country where a
// world-wide method has its own spelling instead.
function inCountry(method, country) {
  const spec = OFFLINE_METHODS[method];
  if (spec.countries.includes(country)) return true;
  return spec.countries.includes("*") && !(spec.except || []).includes(country);
}

/**
 * The country the catalogue is read for: the column, else what the address
 * or province states, else Canada — the product's home market and what the
 * `paymentMethods` schema default already assumes.
 */
export function paymentCountry(company) {
  const code = String(company?.country || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  return resolveCountry(company || {}).country || "CA";
}

/** The methods a company in `country` may switch on, in display order. */
export function methodsForCountry(country) {
  return OFFLINE_METHOD_KEYS.filter((m) => inCountry(m, country));
}

// What a stored value means when the company's country has no such method.
// A US company signed up with the Canadian default (`e_transfer`, `cheque`)
// because the column default is one list for everybody; `check` is the same
// paper under the US word, and Interac simply does not exist there. The demo
// seed also wrote `etransfer` and `card` for a while — `card` is the online
// button, not an offline method, so it is dropped rather than printed.
const RENAMES = Object.freeze({
  US: { cheque: "check", etransfer: null, e_transfer: null },
  CA: { check: "cheque", etransfer: "e_transfer" },
  "*": { check: "cheque", etransfer: "e_transfer" },
});

/**
 * The methods a company has ON, as the catalogue for its country reads them:
 * renamed where the country uses another word, dropped where the country has
 * no such method, deduplicated, in display order. Every reader of
 * `Company.paymentMethods` goes through this so a stale default never prints.
 */
export function enabledMethods(company) {
  const country = paymentCountry(company);
  const renames = RENAMES[country] || RENAMES["*"];
  const allowed = new Set(methodsForCountry(country));
  const on = new Set();
  for (const raw of Array.isArray(company?.paymentMethods) ? company.paymentMethods : []) {
    const key = String(raw || "").trim();
    const mapped = key in renames ? renames[key] : key;
    if (mapped && allowed.has(mapped)) on.add(mapped);
  }
  return OFFLINE_METHOD_KEYS.filter((m) => on.has(m));
}

/**
 * Keep only methods the company's country has, in canonical order, without
 * duplicates. Null when the input is not a list at all — "sent nothing
 * usable" and "sent an empty list" are different answers, and the second is
 * a real one (no offline methods).
 */
export function sanitiseMethods(input, country) {
  if (!Array.isArray(input)) return null;
  return enabledMethods({ country, paymentMethods: input });
}

// ── Detail validation ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_DIGITS = (s) => String(s).replace(/\D/g, "");
const isEmailOrPhone = (s) => EMAIL_RE.test(s) || (/^[+\d\s().-]+$/.test(s) && PHONE_DIGITS(s).length >= 10 && PHONE_DIGITS(s).length <= 15);
const isPaypal = (s) => EMAIL_RE.test(s) || /^(https?:\/\/)?(www\.)?paypal\.me\/[A-Za-z0-9_.-]{1,64}$/i.test(s);

/**
 * ABA routing-number checksum: (3,7,1) weights over nine digits sum to a
 * multiple of ten. A transposed pair fails it. Validated because a wrong
 * routing number on an invoice sends the client's money nowhere and the
 * company hears about it three weeks later.
 */
export function validRoutingNumber(s) {
  const d = String(s || "").replace(/\s/g, "");
  if (!/^\d{9}$/.test(d)) return false;
  const w = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = [...d].reduce((acc, ch, i) => acc + Number(ch) * w[i], 0);
  return sum % 10 === 0;
}

function cleanValue(field, raw) {
  if (field.kind === "bool") return raw === true || raw === "true" || raw === 1;
  if (raw === undefined || raw === null) return "";
  let s = String(raw).trim();
  if (field.kind !== "address") s = s.replace(/\s+/g, " ");
  if (field.kind === "handle") s = s.replace(/^@+/, "");
  if (field.kind === "cashtag") s = s.replace(/^\$+/, "");
  if (field.kind === "routing" || field.kind === "account") s = s.replace(/[\s-]/g, "");
  return s.slice(0, field.kind === "address" ? 300 : 120);
}

function valueError(method, field, value) {
  if (!value) return null;
  switch (field.kind) {
    case "email_or_phone":
      if (method === "paypal") return isPaypal(value) ? null : "PayPal needs an email address or a PayPal.Me link.";
      return isEmailOrPhone(value) ? null : `${METHOD_NAMES_EN[method]} needs an email address or a phone number.`;
    case "handle":
      return /^[A-Za-z0-9_-]{1,30}$/.test(value) ? null : "A Venmo handle is letters, numbers, dashes and underscores.";
    case "cashtag":
      return /^[A-Za-z][A-Za-z0-9_]{0,19}$/.test(value) ? null : "A $cashtag starts with a letter and has no spaces.";
    case "routing":
      return validRoutingNumber(value) ? null : "That routing number isn't valid — nine digits, and the check digit doesn't match.";
    case "account":
      return /^\d{4,17}$/.test(value) ? null : "An account number is 4 to 17 digits.";
    default:
      return null;
  }
}

const METHOD_NAMES_EN = Object.freeze({
  e_transfer: "E-transfer",
  zelle: "Zelle",
  venmo: "Venmo",
  cash_app: "Cash App",
  ach: "Bank transfer (ACH)",
  paypal: "PayPal",
  cheque: "Cheque",
  check: "Check",
  cash: "Cash",
});

const MISSING_EN = Object.freeze({
  address: "address",
  handle: "handle",
  cashtag: "$cashtag",
  bankName: "bank name",
  routingNumber: "routing number",
  accountNumber: "account number",
});

/**
 * Clean one method's details to the catalogue's shape. Unknown keys are
 * dropped, values trimmed and normalised (@ and $ prefixes removed, routing
 * digits only). Returns `{ details }` or `{ error }` — a value that is
 * present but wrong is refused; a required value that is absent is refused
 * only when `enabled`, so a company can keep an old address on file for a
 * method it has switched off.
 */
export function validateDetails(method, input, { enabled = true } = {}) {
  const spec = OFFLINE_METHODS[method];
  if (!spec) return { error: `"${method}" isn't a payment method.` };
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const details = {};
  for (const field of spec.fields) {
    const value = cleanValue(field, src[field.key]);
    if (field.kind === "bool") {
      if (value) details[field.key] = true;
      continue;
    }
    const bad = valueError(method, field, value);
    if (bad) return { error: bad };
    if (value) details[field.key] = value;
    else if (field.required && enabled) {
      return { error: `${METHOD_NAMES_EN[method]} is on but has no ${MISSING_EN[field.key] || field.key}.` };
    }
  }
  return { details };
}

/**
 * Clean the whole `paymentMethodDetails` object against the catalogue for a
 * country, with `enabled` saying which methods must be complete. The first
 * refusal wins — a half-saved set is worse than the old one staying put.
 */
export function validateAllDetails(input, { country, enabled = [] } = {}) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const on = new Set(enabled);
  const out = {};
  for (const method of methodsForCountry(country)) {
    if (!(method in src) && !on.has(method)) continue;
    const r = validateDetails(method, src[method], { enabled: on.has(method) });
    if (r.error) return { error: r.error };
    if (Object.keys(r.details).length) out[method] = r.details;
  }
  return { details: out };
}

/** True when every required field of `method` is present in `details`. */
export function detailsComplete(method, details) {
  const spec = OFFLINE_METHODS[method];
  if (!spec) return false;
  const d = details && typeof details === "object" ? details : {};
  return spec.fields.every((f) => !f.required || (typeof d[f.key] === "string" && d[f.key].trim()));
}

// ── Copy, per document language ─────────────────────────────────────────────
//
// Brand names (Interac, Zelle, Venmo, Cash App, PayPal) are not translated;
// generic words are. `{ref}` is the invoice or quote number.

const COPY = {
  en: {
    title: "How to pay",
    labels: { e_transfer: "Interac e-Transfer", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "Bank transfer (ACH)", paypal: "PayPal", cheque: "Cheque", check: "Check", cash: "Cash" },
    onlineWords: { card: "card", bank: "bank debit", affirm: "Affirm (pay over time)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`),
    online: (methods) => `Pay online by ${methods}`,
    onlineAt: (url) => `at ${url}`,
    reference: (ref) => `Use ${ref} as the reference.`,
    e_transfer: (a) => `Send an Interac e-Transfer to ${a}.`,
    autoDeposit: "Auto-deposit is on — no security question needed.",
    security: (q, a) => `Security question: ${q} · Answer: ${a}`,
    cheque: (p) => `Make cheques payable to ${p}.`,
    check: (p) => `Make checks payable to ${p}.`,
    mail: (addr) => `Mail to ${addr}.`,
    zelle: (a) => `Send with Zelle to ${a}.`,
    venmo: (h) => `Send on Venmo to @${h}.`,
    cash_app: (c) => `Send on Cash App to $${c}.`,
    ach: (bank, routing, account) => `Bank transfer to ${bank} — routing ${routing}, account ${account}.`,
    paypal: (a) => `Send with PayPal to ${a}.`,
    cash: "Cash, in person.",
    detailsOnInvoice: "Bank transfer details are on the invoice.",
  },
  fr: {
    title: "Comment payer",
    labels: { e_transfer: "Virement Interac", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "Virement bancaire (ACH)", paypal: "PayPal", cheque: "Chèque", check: "Chèque", cash: "Comptant" },
    onlineWords: { card: "carte", bank: "prélèvement bancaire", affirm: "Affirm (paiement échelonné)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ou ${items[items.length - 1]}`),
    online: (methods) => `Payez en ligne par ${methods}`,
    onlineAt: (url) => `à ${url}`,
    reference: (ref) => `Indiquez ${ref} comme référence.`,
    e_transfer: (a) => `Envoyez un virement Interac à ${a}.`,
    autoDeposit: "Le dépôt automatique est activé — aucune question de sécurité nécessaire.",
    security: (q, a) => `Question de sécurité : ${q} · Réponse : ${a}`,
    cheque: (p) => `Libellez les chèques à l'ordre de ${p}.`,
    check: (p) => `Libellez les chèques à l'ordre de ${p}.`,
    mail: (addr) => `Postez à ${addr}.`,
    zelle: (a) => `Envoyez par Zelle à ${a}.`,
    venmo: (h) => `Envoyez sur Venmo à @${h}.`,
    cash_app: (c) => `Envoyez sur Cash App à $${c}.`,
    ach: (bank, routing, account) => `Virement bancaire à ${bank} — numéro d'acheminement ${routing}, compte ${account}.`,
    paypal: (a) => `Envoyez par PayPal à ${a}.`,
    cash: "Comptant, en personne.",
    detailsOnInvoice: "Les coordonnées bancaires figurent sur la facture.",
  },
  es: {
    title: "Cómo pagar",
    labels: { e_transfer: "Transferencia Interac", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "Transferencia bancaria (ACH)", paypal: "PayPal", cheque: "Cheque", check: "Cheque", cash: "Efectivo" },
    onlineWords: { card: "tarjeta", bank: "débito bancario", affirm: "Affirm (pago a plazos)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`),
    online: (methods) => `Pague en línea con ${methods}`,
    onlineAt: (url) => `en ${url}`,
    reference: (ref) => `Indique ${ref} como referencia.`,
    e_transfer: (a) => `Envíe una transferencia Interac a ${a}.`,
    autoDeposit: "El depósito automático está activado — no se necesita pregunta de seguridad.",
    security: (q, a) => `Pregunta de seguridad: ${q} · Respuesta: ${a}`,
    cheque: (p) => `Haga los cheques a nombre de ${p}.`,
    check: (p) => `Haga los cheques a nombre de ${p}.`,
    mail: (addr) => `Envíelo por correo a ${addr}.`,
    zelle: (a) => `Envíe por Zelle a ${a}.`,
    venmo: (h) => `Envíe por Venmo a @${h}.`,
    cash_app: (c) => `Envíe por Cash App a $${c}.`,
    ach: (bank, routing, account) => `Transferencia bancaria a ${bank} — número de ruta ${routing}, cuenta ${account}.`,
    paypal: (a) => `Envíe por PayPal a ${a}.`,
    cash: "Efectivo, en persona.",
    detailsOnInvoice: "Los datos bancarios están en la factura.",
  },
  uk: {
    title: "Як оплатити",
    labels: { e_transfer: "Interac e-Transfer", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "Банківський переказ (ACH)", paypal: "PayPal", cheque: "Чек", check: "Чек", cash: "Готівка" },
    onlineWords: { card: "карткою", bank: "банківським списанням", affirm: "через Affirm (оплата частинами)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} або ${items[items.length - 1]}`),
    online: (methods) => `Оплатіть онлайн ${methods}`,
    onlineAt: (url) => `за адресою ${url}`,
    reference: (ref) => `Вкажіть ${ref} як призначення платежу.`,
    e_transfer: (a) => `Надішліть Interac e-Transfer на ${a}.`,
    autoDeposit: "Автодепозит увімкнено — секретне запитання не потрібне.",
    security: (q, a) => `Секретне запитання: ${q} · Відповідь: ${a}`,
    cheque: (p) => `Випишіть чек на ім’я ${p}.`,
    check: (p) => `Випишіть чек на ім’я ${p}.`,
    mail: (addr) => `Надішліть поштою на ${addr}.`,
    zelle: (a) => `Надішліть через Zelle на ${a}.`,
    venmo: (h) => `Надішліть у Venmo на @${h}.`,
    cash_app: (c) => `Надішліть у Cash App на $${c}.`,
    ach: (bank, routing, account) => `Банківський переказ до ${bank} — routing ${routing}, рахунок ${account}.`,
    paypal: (a) => `Надішліть через PayPal на ${a}.`,
    cash: "Готівкою, особисто.",
    detailsOnInvoice: "Банківські реквізити вказано в рахунку.",
  },
  pa: {
    title: "ਭੁਗਤਾਨ ਕਿਵੇਂ ਕਰਨਾ ਹੈ",
    labels: { e_transfer: "Interac e-Transfer", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "ਬੈਂਕ ਟ੍ਰਾਂਸਫਰ (ACH)", paypal: "PayPal", cheque: "ਚੈੱਕ", check: "ਚੈੱਕ", cash: "ਨਕਦ" },
    onlineWords: { card: "ਕਾਰਡ", bank: "ਬੈਂਕ ਡੈਬਿਟ", affirm: "Affirm (ਕਿਸ਼ਤਾਂ ਵਿੱਚ)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ਜਾਂ ${items[items.length - 1]}`),
    online: (methods) => `ਆਨਲਾਈਨ ਭੁਗਤਾਨ ਕਰੋ: ${methods}`,
    onlineAt: (url) => `${url} 'ਤੇ`,
    reference: (ref) => `${ref} ਨੂੰ ਹਵਾਲੇ ਵਜੋਂ ਲਿਖੋ।`,
    e_transfer: (a) => `Interac e-Transfer ${a} 'ਤੇ ਭੇਜੋ।`,
    autoDeposit: "ਆਟੋ-ਡਿਪਾਜ਼ਿਟ ਚਾਲੂ ਹੈ — ਸੁਰੱਖਿਆ ਸਵਾਲ ਦੀ ਲੋੜ ਨਹੀਂ।",
    security: (q, a) => `ਸੁਰੱਖਿਆ ਸਵਾਲ: ${q} · ਜਵਾਬ: ${a}`,
    cheque: (p) => `ਚੈੱਕ ${p} ਦੇ ਨਾਮ 'ਤੇ ਬਣਾਓ।`,
    check: (p) => `ਚੈੱਕ ${p} ਦੇ ਨਾਮ 'ਤੇ ਬਣਾਓ।`,
    mail: (addr) => `${addr} 'ਤੇ ਡਾਕ ਰਾਹੀਂ ਭੇਜੋ।`,
    zelle: (a) => `Zelle ਰਾਹੀਂ ${a} 'ਤੇ ਭੇਜੋ।`,
    venmo: (h) => `Venmo 'ਤੇ @${h} ਨੂੰ ਭੇਜੋ।`,
    cash_app: (c) => `Cash App 'ਤੇ $${c} ਨੂੰ ਭੇਜੋ।`,
    ach: (bank, routing, account) => `${bank} ਨੂੰ ਬੈਂਕ ਟ੍ਰਾਂਸਫਰ — ਰੂਟਿੰਗ ${routing}, ਖਾਤਾ ${account}।`,
    paypal: (a) => `PayPal ਰਾਹੀਂ ${a} 'ਤੇ ਭੇਜੋ।`,
    cash: "ਨਕਦ, ਆਹਮੋ-ਸਾਹਮਣੇ।",
    detailsOnInvoice: "ਬੈਂਕ ਵੇਰਵੇ ਇਨਵੌਇਸ 'ਤੇ ਹਨ।",
  },
  tl: {
    title: "Paano magbayad",
    labels: { e_transfer: "Interac e-Transfer", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "Bank transfer (ACH)", paypal: "PayPal", cheque: "Tseke", check: "Tseke", cash: "Cash" },
    onlineWords: { card: "card", bank: "bank debit", affirm: "Affirm (hulugan)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`),
    online: (methods) => `Magbayad online gamit ang ${methods}`,
    onlineAt: (url) => `sa ${url}`,
    reference: (ref) => `Ilagay ang ${ref} bilang reference.`,
    e_transfer: (a) => `Magpadala ng Interac e-Transfer sa ${a}.`,
    autoDeposit: "Naka-on ang auto-deposit — hindi na kailangan ng security question.",
    security: (q, a) => `Security question: ${q} · Sagot: ${a}`,
    cheque: (p) => `Gawing payable ang tseke kay ${p}.`,
    check: (p) => `Gawing payable ang tseke kay ${p}.`,
    mail: (addr) => `Ipadala sa koreo sa ${addr}.`,
    zelle: (a) => `Magpadala sa Zelle sa ${a}.`,
    venmo: (h) => `Magpadala sa Venmo sa @${h}.`,
    cash_app: (c) => `Magpadala sa Cash App sa $${c}.`,
    ach: (bank, routing, account) => `Bank transfer sa ${bank} — routing ${routing}, account ${account}.`,
    paypal: (a) => `Magpadala sa PayPal sa ${a}.`,
    cash: "Cash, nang personal.",
    detailsOnInvoice: "Nasa invoice ang mga detalye ng bangko.",
  },
  de: {
    title: "So bezahlen Sie",
    labels: { e_transfer: "Interac e-Transfer", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "Banküberweisung (ACH)", paypal: "PayPal", cheque: "Scheck", check: "Scheck", cash: "Bargeld" },
    onlineWords: { card: "Karte", bank: "Bankeinzug", affirm: "Affirm (Ratenzahlung)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} oder ${items[items.length - 1]}`),
    online: (methods) => `Online bezahlen per ${methods}`,
    onlineAt: (url) => `unter ${url}`,
    reference: (ref) => `Geben Sie ${ref} als Verwendungszweck an.`,
    e_transfer: (a) => `Senden Sie einen Interac e-Transfer an ${a}.`,
    autoDeposit: "Auto-Deposit ist aktiv — keine Sicherheitsfrage nötig.",
    security: (q, a) => `Sicherheitsfrage: ${q} · Antwort: ${a}`,
    cheque: (p) => `Stellen Sie Schecks aus auf ${p}.`,
    check: (p) => `Stellen Sie Schecks aus auf ${p}.`,
    mail: (addr) => `Per Post an ${addr}.`,
    zelle: (a) => `Per Zelle senden an ${a}.`,
    venmo: (h) => `Per Venmo senden an @${h}.`,
    cash_app: (c) => `Per Cash App senden an $${c}.`,
    ach: (bank, routing, account) => `Überweisung an ${bank} — Routing ${routing}, Konto ${account}.`,
    paypal: (a) => `Per PayPal senden an ${a}.`,
    cash: "Bar, vor Ort.",
    detailsOnInvoice: "Die Bankverbindung steht auf der Rechnung.",
  },
  it: {
    title: "Come pagare",
    labels: { e_transfer: "Interac e-Transfer", zelle: "Zelle", venmo: "Venmo", cash_app: "Cash App", ach: "Bonifico bancario (ACH)", paypal: "PayPal", cheque: "Assegno", check: "Assegno", cash: "Contanti" },
    onlineWords: { card: "carta", bank: "addebito bancario", affirm: "Affirm (a rate)" },
    orJoin: (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`),
    online: (methods) => `Paga online con ${methods}`,
    onlineAt: (url) => `su ${url}`,
    reference: (ref) => `Indica ${ref} come causale.`,
    e_transfer: (a) => `Invia un Interac e-Transfer a ${a}.`,
    autoDeposit: "Il deposito automatico è attivo — nessuna domanda di sicurezza.",
    security: (q, a) => `Domanda di sicurezza: ${q} · Risposta: ${a}`,
    cheque: (p) => `Intesta gli assegni a ${p}.`,
    check: (p) => `Intesta gli assegni a ${p}.`,
    mail: (addr) => `Spedisci a ${addr}.`,
    zelle: (a) => `Invia con Zelle a ${a}.`,
    venmo: (h) => `Invia su Venmo a @${h}.`,
    cash_app: (c) => `Invia su Cash App a $${c}.`,
    ach: (bank, routing, account) => `Bonifico a ${bank} — routing ${routing}, conto ${account}.`,
    paypal: (a) => `Invia con PayPal a ${a}.`,
    cash: "Contanti, di persona.",
    detailsOnInvoice: "Le coordinate bancarie sono sulla fattura.",
  },
};

/** The raw table, for the completeness check. */
export const OFFLINE_METHOD_COPY = COPY;

export function offlineMethodCopy(language = "en") {
  return COPY[language] || COPY.en;
}

/** The method's name in a document language — "Chèque", "Zelle". */
export function offlineMethodLabel(method, language = "en") {
  return offlineMethodCopy(language).labels[method] || METHOD_NAMES_EN[method] || String(method || "");
}

// ── The rendered block ──────────────────────────────────────────────────────

/**
 * The lines a document prints for one method, from its details. The label
 * alone when a required detail is missing (the schema default, never filled
 * in) — the method is still offered, and the client still has to ask, which
 * is what the old "Accepted:" line amounted to.
 */
function methodLines(method, details, company, c, reference) {
  const d = details && typeof details === "object" ? details : {};
  const lines = [];
  switch (method) {
    case "e_transfer":
      if (d.address) {
        lines.push(c.e_transfer(d.address));
        if (d.autoDeposit) lines.push(c.autoDeposit);
        else if (d.securityQuestion && d.securityAnswer) lines.push(c.security(d.securityQuestion, d.securityAnswer));
      }
      break;
    case "cheque":
    case "check": {
      const payee = d.payee || company?.name || "";
      if (payee) lines.push(c[method](payee));
      if (d.mailingAddress) lines.push(c.mail(d.mailingAddress.replace(/\s*\n\s*/g, ", ")));
      break;
    }
    case "zelle":
      if (d.address) lines.push(c.zelle(d.address));
      break;
    case "venmo":
      if (d.handle) lines.push(c.venmo(d.handle));
      break;
    case "cash_app":
      if (d.cashtag) lines.push(c.cash_app(d.cashtag));
      break;
    case "ach":
      if (d.bankName && d.routingNumber && d.accountNumber) lines.push(c.ach(d.bankName, d.routingNumber, d.accountNumber));
      break;
    case "paypal":
      if (d.address) lines.push(c.paypal(d.address));
      break;
    case "cash":
      lines.push(c.cash);
      break;
    default:
      break;
  }
  // The reference goes on anything that carries money to an account and
  // could arrive unlabelled. Cash and a cheque carry the invoice in hand.
  if (lines.length && reference && !["cash", "cheque", "check"].includes(method)) lines.push(c.reference(reference));
  return lines;
}

/**
 * The "How to pay" block, rendered once in the DOCUMENT's language.
 *
 * @param company    { name, country, address, province, paymentMethods,
 *                     paymentMethodDetails, currency, stripeBankDebitEnabled,
 *                     offerFinancing, stripeAffirmStatus }
 * @param language   the document's language (Invoice.language), never the
 *                   viewer's — see lib/i18n/resolveLanguage.js
 * @param reference  the invoice or quote number, quoted in every how-to
 * @param online     { url, card, bank, affirm } — what the pay link offers,
 *                   decided by the caller who knows Stripe's answer; null
 *                   when there is no link (a draft PDF). `bank`/`affirm` are
 *                   the company-level facts; the portal still measures the
 *                   amount cap per invoice.
 * @returns null when nothing is on — the block then prints nothing at all,
 *          rather than a heading over an empty list.
 */
export function buildHowToPay({ company, language = "en", reference = "", online = null, offlineDiscount = false } = {}) {
  const c = offlineMethodCopy(language);
  // An invoice priced with the e-transfer / cheque discount is payable by
  // those methods: the card link stays off and one sentence says why
  // (lib/payments/offlineDiscount.js). The company's settings are not
  // consulted for this — the invoice row is.
  if (offlineDiscount) online = null;
  const details = company?.paymentMethodDetails && typeof company.paymentMethodDetails === "object" ? company.paymentMethodDetails : {};
  const methods = enabledMethods(company).map((method) => ({
    method,
    label: c.labels[method],
    lines: methodLines(method, details[method], company, c, reference),
    documentOnly: Boolean(OFFLINE_METHODS[method].documentOnly),
  }));

  // The URL is optional: a quote's deposit block says the company takes
  // cards online (the link arrives with the deposit request), an invoice's
  // says where.
  let onlineBlock = null;
  if (online?.card) {
    const words = [c.onlineWords.card];
    if (online.bank) words.push(c.onlineWords.bank);
    if (online.affirm) words.push(c.onlineWords.affirm);
    onlineBlock = {
      url: online.url || null,
      card: true,
      bank: Boolean(online.bank),
      affirm: Boolean(online.affirm),
      line: c.online(c.orJoin(words)),
      at: online.url ? c.onlineAt(online.url) : "",
    };
  }

  if (!methods.length && !onlineBlock) return null;
  return {
    language: COPY[language] ? language : "en",
    title: c.title,
    reference: reference || "",
    online: onlineBlock,
    methods,
    ...(offlineDiscount ? { note: offlineDiscountInvoiceNote(COPY[language] ? language : "en") } : {}),
  };
}

/**
 * The `online` argument for buildHowToPay from the company row and the pay
 * link: card when Stripe can charge one, bank debit when the capability is
 * active in the company's currency, Affirm when opted in and active.
 */
export function onlineOptions(company, url = null) {
  const card = Boolean(company?.stripeAccountId && company?.stripeChargesEnabled);
  if (!card) return null;
  return {
    url: url || null,
    card,
    bank: Boolean(companyBankDebitMethod(company)),
    affirm: Boolean(company?.offerFinancing) && company?.stripeAffirmStatus === "active",
  };
}

/**
 * The lines an EMAIL may carry for a method: the same as the document,
 * except a bank account number, which becomes "the details are on the
 * invoice". Reads the language off the model so a stored block is rendered
 * in the language it was written in.
 */
export function emailLinesFor(howToPay, entry) {
  if (!entry?.documentOnly) return entry?.lines || [];
  return [offlineMethodCopy(howToPay?.language).detailsOnInvoice];
}

/**
 * The deposit's how-to block for a QUOTE whose payment terms parse into a
 * schedule (the first card is money due at approval): the offline methods
 * with the quote number as reference, and "pay online by card…" without a
 * URL — the link arrives with the deposit request. Null for an invoice
 * (its own section carries the block) or a quote with no schedule (nothing
 * is asked for at approval). Lives here, not in the PDF section, because
 * the public quote route builds it too and must not load a PDF engine for
 * a stranger on a phone.
 */
export function depositHowToPay({ data = {}, company = {}, language, schedule } = {}) {
  if (!schedule || data.invoiceNumber) return null;
  return buildHowToPay({
    company,
    language,
    reference: data.quoteNumber || "",
    online: onlineOptions(company),
  });
}

/**
 * A stored block if the invoice has one, else a fresh one from the company's
 * live settings. The stored one wins even if the company has since changed
 * its address: the client is paying from the copy they were sent.
 */
export function howToPayFor(invoice, { company, language, online = null } = {}) {
  if (invoice?.howToPay && typeof invoice.howToPay === "object" && Array.isArray(invoice.howToPay.methods)) {
    return invoice.howToPay;
  }
  return buildHowToPay({
    company,
    language,
    reference: invoice?.invoiceNumber || "",
    online,
    offlineDiscount: Number(invoice?.offlineDiscountAmount || 0) > 0,
  });
}
