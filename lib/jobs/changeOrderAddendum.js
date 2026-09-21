// lib/jobs/changeOrderAddendum.js
//
// The client's side of a change order: the sanitised body, the numbering,
// the money on the one-page addendum, and the signature record. Pure — no
// database, no request — so scripts/check-job-plan.mjs can run every function
// here against hostile input.
//
// ── What a change order used to be ─────────────────────────────────────────
//
// A staff-typed description and a price, with the staff member asserting "the
// client agreed". Nothing went to the client, nothing was signed, and on the
// invoice it appeared as an unlabelled extra line. That path still exists
// ("Save without sending" — a change agreed in person), and every row written
// before this file keeps working through it. What is new is a change order
// that goes OUT: a link, an addendum page, a signature with the same audit
// shape the quote's approval has, and an invoice line that says which change
// order it is and who approved it.

import { createHash } from "crypto";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;
const text = (v) => String(v ?? "").trim();

// ── Numbering ──────────────────────────────────────────────────────────────

/**
 * "CO-2". `seq` when the row has one; otherwise its position, by age, among
 * the job's rows (`all`) — stable because a change order is never deleted.
 * A row with neither answers "CO-?" rather than inventing a number.
 */
export function changeOrderLabel(co, all = []) {
  if (co?.seq !== null && co?.seq !== undefined && Number.isInteger(Number(co.seq))) {
    return `CO-${Number(co.seq)}`;
  }
  const rows = (Array.isArray(all) ? all : [])
    .filter((r) => r && r.id)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const idx = rows.findIndex((r) => r.id === co?.id);
  return idx >= 0 ? `CO-${idx + 1}` : "CO-?";
}

// ── Rich text ──────────────────────────────────────────────────────────────
//
// The boundary between "what a browser sent" and "what a homeowner's page
// renders". A closed allow-list of inline formatting and lists, every text
// node re-escaped, every attribute dropped except a safe http(s) href. Not a
// general HTML sanitiser and not trying to be one: anything not on the list
// becomes text or vanishes, so a pasted <script>, an onclick, a javascript:
// link or an <img> that phones home cannot survive.

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "ul", "ol", "li", "p", "br", "a"]);
const VOID = new Set(["br"]);
export const CHANGE_ORDER_BODY_MAX = 8000;

function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(raw) {
  const v = text(raw).replace(/^["']|["']$/g, "");
  if (!v) return null;
  // Decode entities a browser would decode before following the link, so
  // "java&#115;cript:" cannot slip past the scheme check.
  const decoded = v.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  if (!/^https?:\/\/[^\s<>"']+$/i.test(decoded)) return null;
  if (/[\u0000-\u001f]/.test(decoded)) return null;
  return decoded;
}

/**
 * Sanitise the "What changed" body. Returns "" for nothing usable.
 *
 * Tags are matched with a deliberately simple tokeniser (`<`, an optional
 * slash, a name, anything up to `>`): a malformed tag that does not match is
 * escaped as text, which is the safe direction. Unclosed allowed tags are
 * closed at the end; stray closers are dropped.
 */
export function sanitiseChangeOrderBody(input) {
  if (typeof input !== "string") return "";
  const html = input.slice(0, CHANGE_ORDER_BODY_MAX * 4);
  const out = [];
  const open = [];
  // A tag is "<", an optional slash, a name, then either ">" or whitespace
  // and attributes — as HTML itself defines it. "a < b" is text, and a looser
  // pattern turned it into an opening <b> that swallowed the sentence.
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*|\/)?>/g;
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m.index > last) out.push(escapeText(html.slice(last, m.index)));
    last = re.lastIndex;
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    const attrs = m[3] || "";
    if (!ALLOWED.has(name)) {
      // <script> and <style> bodies are not text a reader should see either.
      if (!closing && (name === "script" || name === "style")) {
        const end = html.toLowerCase().indexOf(`</${name}`, last);
        if (end >= 0) {
          const closeEnd = html.indexOf(">", end);
          last = closeEnd >= 0 ? closeEnd + 1 : html.length;
          re.lastIndex = last;
        }
      }
      continue;
    }
    if (VOID.has(name)) {
      if (!closing) out.push("<br>");
      continue;
    }
    if (closing) {
      const at = open.lastIndexOf(name);
      if (at < 0) continue;
      // Close everything opened after it too, so the output stays well formed.
      while (open.length > at) out.push(`</${open.pop()}>`);
      continue;
    }
    if (name === "a") {
      const hrefMatch = /href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(attrs);
      const href = hrefMatch ? safeHref(hrefMatch[1]) : null;
      if (!href) {
        // A link with nowhere safe to go renders as its own text.
        open.push("span");
        out.push("<span>");
        continue;
      }
      open.push("a");
      out.push(`<a href="${escapeText(href)}" rel="noopener noreferrer">`);
      continue;
    }
    open.push(name);
    out.push(`<${name}>`);
  }
  if (last < html.length) out.push(escapeText(html.slice(last)));
  while (open.length) out.push(`</${open.pop()}>`);
  const joined = out.join("").replace(/<span><\/span>/g, "");
  // Nothing but whitespace and empty tags is nothing.
  if (!joined.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim()) return "";
  return joined.slice(0, CHANGE_ORDER_BODY_MAX);
}

/** The body as plain text for SMS, email text parts and the invoice line. */
export function changeOrderBodyText(html) {
  return String(html ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Money on the addendum ──────────────────────────────────────────────────

/**
 * The tax rate a quote actually charged, as a fraction — from the accepted
 * figures when the client's approval froze them, else the quote's own. Read
 * off the document rather than re-resolved, for the reason
 * lib/jobs/changeOrderValue.js's billChangeOrders gives: the addendum must
 * charge the rate the signed quote charged, on the same page as it.
 *
 * Null when it cannot be derived (no tax, or nothing to have charged it on).
 */
export function quoteTaxRate(quote) {
  if (!quote || typeof quote !== "object") return 0;
  const subtotal = quote.acceptedSubtotal ?? quote.subtotal;
  const tax = quote.acceptedTax ?? quote.tax;
  const base = round2(num(subtotal) - num(quote.discount));
  if (!(num(tax) > 0)) return 0;
  if (base <= 0) return null;
  return num(tax) / base;
}

/**
 * The lines the addendum prints. `quoteTotal` is the quote's total as
 * approved (acceptedTotal, else total); `priorApproved` the sum of change
 * orders already approved on the job; `delta` this one; `taxRate` from
 * quoteTaxRate. Every figure is a real statement: when the rate is unknown the
 * tax line is null and the new total is stated before tax, and the page says
 * so.
 */
export function addendumMoney({ quoteTotal, priorApproved = 0, delta, taxRate = 0 } = {}) {
  const change = round2(delta);
  const rate = taxRate === null || taxRate === undefined ? null : num(taxRate);
  const tax = rate === null ? null : round2(change * rate);
  const changeWithTax = round2(change + (tax || 0));
  const base = round2(num(quoteTotal) + num(priorApproved) * (1 + (rate || 0)));
  return {
    quoteTotal: round2(quoteTotal),
    priorApproved: round2(priorApproved),
    change,
    taxRate: rate,
    tax,
    changeWithTax,
    newTotal: round2(base + changeWithTax),
    taxKnown: rate !== null,
  };
}

// ── The signature ──────────────────────────────────────────────────────────

/**
 * What the client agrees to, canonicalised. Same construction as
 * lib/documents/signatureAudit.js's documentDigestInput: an explicitly
 * ordered array, so the hash is over the deal and not over key order.
 */
export function changeOrderDigestInput(co) {
  const c = co || {};
  return JSON.stringify([
    ["id", c.id ?? null],
    ["jobId", c.jobId ?? null],
    ["description", text(c.description)],
    ["bodyHtml", text(c.bodyHtml)],
    ["priceDelta", c.priceDelta == null ? null : String(c.priceDelta)],
    ["scheduleDeltaDays", c.scheduleDeltaDays ?? null],
    ["quoteLineKey", c.quoteLineKey ?? null],
    ["taskId", c.taskId ?? null],
    ["photos", Array.isArray(c.photos) ? c.photos : []],
  ]);
}

export function hashChangeOrder(co) {
  return createHash("sha256").update(changeOrderDigestInput(co)).digest("hex");
}

/**
 * The audit record stored on ChangeOrder.signature, or null when the minimum
 * for a signature is missing — no name, no drawn mark, consent not given. The
 * caller must treat null as "not signed" and refuse. The browser supplies the
 * name, the mark and consent; the server supplies ip and userAgent.
 *
 * The mark must be a PNG data URL of a sane size. There is no reason for a
 * signature to be a megabyte, and a Json column is not where one should land.
 */
export const SIGNATURE_MAX_BYTES = 400_000;

export function buildChangeOrderSignature({ changeOrder, name, signatureDataUrl, consent, ip, userAgent, now }) {
  const trimmedName = text(name).slice(0, 200);
  const mark = typeof signatureDataUrl === "string" ? signatureDataUrl : "";
  const hasMark = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(mark) && mark.length <= SIGNATURE_MAX_BYTES;
  if (!trimmedName || !hasMark || consent !== true) return null;
  return {
    name: trimmedName,
    signatureDataUrl: mark,
    consent: true,
    signedAt: now || new Date().toISOString(),
    ip: ip || null,
    userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
    documentHash: hashChangeOrder(changeOrder),
  };
}

/** Re-verify a stored signature against the row. True if untampered. */
export function verifyChangeOrderSignature(co, signature) {
  if (!signature?.documentHash) return false;
  return signature.documentHash === hashChangeOrder(co);
}

// ── Input validation for the staff form ────────────────────────────────────

export const SCHEDULE_DELTA_MAX_DAYS = 365;
export const CHANGE_ORDER_PHOTOS_MAX = 6;

/**
 * Normalise what the staff form posts. Returns { ok, value } or { ok, error }.
 * `scheduleDeltaDays`: omitted/blank → null (not stated); else a whole number
 * within a year either way. `photos`: https URLs only, capped.
 */
export function normaliseChangeOrderInput(body = {}) {
  const b = body && typeof body === "object" ? body : {};
  const description = text(b.description).slice(0, 300);
  if (!description) return { ok: false, error: "Describe what changed." };

  const delta = Number(b.priceDelta);
  if (!Number.isFinite(delta)) return { ok: false, error: "priceDelta must be a number." };

  let scheduleDeltaDays = null;
  if (b.scheduleDeltaDays !== undefined && b.scheduleDeltaDays !== null && b.scheduleDeltaDays !== "") {
    const d = Number(b.scheduleDeltaDays);
    if (!Number.isInteger(d) || Math.abs(d) > SCHEDULE_DELTA_MAX_DAYS) {
      return { ok: false, error: `Schedule impact must be a whole number of days within ±${SCHEDULE_DELTA_MAX_DAYS}.` };
    }
    scheduleDeltaDays = d;
  }

  const photos = (Array.isArray(b.photos) ? b.photos : [])
    .map((p) => (typeof p === "string" ? p : p?.url))
    .filter((u) => typeof u === "string" && /^https:\/\/\S+$/.test(u))
    .slice(0, CHANGE_ORDER_PHOTOS_MAX);

  const bodyHtml = sanitiseChangeOrderBody(b.bodyHtml) || null;
  const quoteLineKey = text(b.quoteLineKey).slice(0, 120) || null;
  const taskId = text(b.taskId).slice(0, 60) || null;
  if (quoteLineKey && taskId) return { ok: false, error: "A change order is against a line or a step, not both." };

  return {
    ok: true,
    value: { description, priceDelta: round2(delta), scheduleDeltaDays, photos, bodyHtml, quoteLineKey, taskId },
  };
}

/**
 * Find the quote line a key names and snapshot it for `originalLine`.
 * Keys are "<scopeGroupId>:<index>" (lib/jobs/plan.js lineKey).
 */
export function snapshotQuoteLine(quote, quoteLineKey) {
  const key = text(quoteLineKey);
  const at = key.lastIndexOf(":");
  if (at <= 0) return null;
  const groupId = key.slice(0, at);
  const index = Number(key.slice(at + 1));
  if (!Number.isInteger(index) || index < 0) return null;
  const group = (quote?.scopeGroups || []).find((g) => g?.id === groupId);
  const line = Array.isArray(group?.lineItems) ? group.lineItems[index] : null;
  if (!line || typeof line !== "object") return null;
  const description = text(line.description || line.name || line.title);
  if (!description) return null;
  return { description, amount: round2(line.amount), quantity: num(line.quantity) || 1 };
}
