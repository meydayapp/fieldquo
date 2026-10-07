// lib/subRequests/model.js
//
// A general contractor asking the subs they already have to price a job —
// the owner, 2026-10-06:
//
//   "the GC sending a request for quote to the subs they have; the sub gets
//    an email asking them to log into FieldQuo to ease the linkage between
//    the two."
//
// This file is every DECISION in that flow, pure: no database, no request,
// no crypto — so scripts/check-sub-price-requests.mjs runs each one against
// hostile input, and the browser can import the cookie and status helpers.
// lib/subRequests/server.js does the reads and writes these decide.
//
// ══ The three boundaries ═══════════════════════════════════════════════════
//
//   1. WHAT THE SUB SEES (subFacingRequest). An allow-list: the trade, the
//      GC's scope text, the job address, the photos the GC ticked, the
//      wanted-by date, and the GC's own name and brand. The homeowner's name,
//      phone and email are not parameters of anything here — a request row
//      never holds them, so there is nothing to leak by mistake.
//
//   2. WHO WRITES WHERE. The GC's action writes the GC's tenant (the request,
//      the recipients). The SUB's action — pressing "Price it in FieldQuo"
//      while signed in — is the only thing that writes the sub's tenant (a
//      business client for the GC, a lead). canAccept decides who that may be.
//
//   3. MONEY. The reply form for a sub with no account sets an amount on ONE
//      thing: its own pending reply (canReply). It reaches the GC's compare
//      only when the GC confirms it, and the confirm route reads no amount
//      from the browser (AGENTS.md #5). A linked sub's sent quote lands as an
//      OPTION in the compare, never on the GC's quote — choosing stays the
//      GC's ("Use this one" / "Offer as extra work", lib/quotes/importQuote.js).

/** The statuses the GC's panel shows, in the order a request moves through them. */
export const RECIPIENT_STATUSES = Object.freeze(["not_sent", "sent", "opened", "quoting", "quoted", "declined"]);

/** Lead source for a request accepted into the sub's FieldQuo (lib/leads/sourceLabel.js). */
export const GC_REQUEST_LEAD_SOURCE = "gc_request";

export const LIMITS = Object.freeze({
  trade: 80,
  scope: 4000,
  subs: 20,
  photos: 20,
  note: 2000,
  reason: 500,
  // The largest single price a reply may carry. A typo with three extra
  // zeros is caught by the GC's confirm step; this only stops absurd input.
  amount: 10_000_000,
  // A wanted-by date is for THIS job. Two years out is not a date anybody meant.
  wantedByDays: 730,
});

const DAY = 24 * 60 * 60 * 1000;

const asDate = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** One line of text: control characters out, whitespace collapsed, capped. */
export function cleanLine(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** A paragraph: control characters out (newlines kept), capped. */
export function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
    .trim();
}

// ── Status ──────────────────────────────────────────────────────────────────

/**
 * Where one sub stands, from the timestamps alone. Precedence is the order a
 * GC would want to read it: a decline is final; a price (from either path)
 * outranks "working on it"; "working on it" outranks "opened".
 *
 *   quoted  — their FieldQuo quote arrived (sourceQuoteId / quoteImportId),
 *             or they replied with a price (repliedAt). A reply the GC has not
 *             confirmed is still "quoted" — awaitingConfirmation says the rest.
 *   quoting — they accepted it into their own FieldQuo.
 */
export function recipientStatus(r) {
  if (!r || typeof r !== "object") return "not_sent";
  if (r.declinedAt) return "declined";
  if (r.quoteImportId || r.sourceQuoteId || r.repliedAt) return "quoted";
  if (r.acceptedAt) return "quoting";
  if (r.openedAt) return "opened";
  if (r.sentAt) return "sent";
  return "not_sent";
}

/** A no-account reply waiting for the GC to put it in the compare. */
export function awaitingConfirmation(r) {
  return Boolean(r && r.repliedAt && !r.quoteImportId && !r.declinedAt && r.replyAmount != null);
}

// ── The GC's request ────────────────────────────────────────────────────────

/**
 * Read what the "Request prices from subs" dialog posted. Pure.
 *
 * Ids and text only — no figure of any kind is part of a request. Photos
 * arrive as URLs and are checked against what is on file (pickOnFilePhotos);
 * the subs as ids, checked against the GC's own roster by the server.
 *
 * @returns {{ ok: true, data } | { ok: false, error }}
 */
export function parseRequestInput(body, { now = new Date() } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "bad_body" };
  const ids = Array.isArray(body.subcontractorIds) ? body.subcontractorIds : [];
  const subcontractorIds = [
    ...new Set(ids.filter((v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v))),
  ];
  if (!subcontractorIds.length) return { ok: false, error: "no_subs" };
  if (subcontractorIds.length > LIMITS.subs) return { ok: false, error: "too_many_subs" };
  const trade = cleanLine(body.trade, LIMITS.trade);
  if (!trade) return { ok: false, error: "no_trade" };
  const scope = cleanText(body.scope, LIMITS.scope);
  if (!scope) return { ok: false, error: "no_scope" };
  const photoUrls = (Array.isArray(body.photoUrls) ? body.photoUrls : [])
    .filter((u) => typeof u === "string" && u.length <= 2048)
    .slice(0, LIMITS.photos);
  let wantedBy = null;
  if (body.wantedBy !== undefined && body.wantedBy !== null && body.wantedBy !== "") {
    // A calendar day, "YYYY-MM-DD". Stored at noon UTC so it is the same day
    // in every timezone the two companies might be in.
    const m = typeof body.wantedBy === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(body.wantedBy) : null;
    const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[3])) return { ok: false, error: "bad_date" };
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (d.getTime() < today) return { ok: false, error: "date_past" };
    if (d.getTime() > today + LIMITS.wantedByDays * DAY) return { ok: false, error: "bad_date" };
    wantedBy = d;
  }
  return { ok: true, data: { subcontractorIds, trade, scope, photoUrls, wantedBy } };
}

/**
 * The photos a request may carry: the ones the GC ticked, and only if they
 * are among the quote's / job's own photos. A URL the browser invented is
 * not a photo on file and is dropped, not trusted.
 *
 * @param urls    what was ticked
 * @param onFile  [{ url, kind? }] the quote's clientPhotos + the job's photos
 */
export function pickOnFilePhotos(urls, onFile) {
  const byUrl = new Map();
  for (const p of Array.isArray(onFile) ? onFile : []) {
    if (p && typeof p.url === "string" && p.url && !byUrl.has(p.url)) {
      byUrl.set(p.url, { url: p.url, kind: p.kind === "video" ? "video" : "photo" });
    }
  }
  const out = [];
  const seen = new Set();
  for (const u of Array.isArray(urls) ? urls : []) {
    if (seen.has(u) || !byUrl.has(u)) continue;
    seen.add(u);
    out.push(byUrl.get(u));
    if (out.length >= LIMITS.photos) break;
  }
  return out;
}

/**
 * The job address a request carries: the quote's own site address, else the
 * client's address line. Nothing else of the client — this is the one field
 * of the homeowner's record the owner chose to share.
 */
export function jobAddressFor(quote) {
  const site = cleanLine(quote?.siteAddress, 300);
  if (site) return site;
  const c = quote?.client || {};
  const parts = [c.address, c.city, c.province, c.postalCode].map((p) => cleanLine(p, 120)).filter(Boolean);
  // Join without repeating what the address line already says.
  const out = [];
  for (const p of parts) if (!out.some((o) => o.toLowerCase().includes(p.toLowerCase()))) out.push(p);
  return out.join(", ") || null;
}

const POSTAL = /\b([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/gi;

/**
 * The "area" the EMAIL names — the address without its street line: "214 rue
 * Principale, Gatineau, QC J8X 1A1" → "Gatineau, QC". The full address is on
 * the request page behind the token; an email gets forwarded. Null when the
 * address has no part after the street (a single line can't be split without
 * guessing).
 */
export function addressArea(address) {
  const parts = String(address || "")
    .split(",")
    .map((p) => p.replace(POSTAL, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const rest = parts.slice(1).filter((p) => !/^\d/.test(p));
  return rest.join(", ") || null;
}

// ── What crosses to the sub ─────────────────────────────────────────────────

/**
 * The request as the SUB sees it — on the page, in the email, and in the lead
 * that lands in their FieldQuo. An allow-list built field by field; nothing
 * is spread from a row.
 *
 * @param request   SubPriceRequest (trade, scope, siteAddress, photos, wantedBy)
 * @param gc        the GC's Company (name, logoUrl, brandColor, email, phone)
 * @param recipient the recipient row, for its own state only
 */
export function subFacingRequest({ request, gc, recipient = null } = {}) {
  const photos = (Array.isArray(request?.photos) ? request.photos : [])
    .filter((p) => p && typeof p.url === "string" && /^https:\/\//.test(p.url))
    .map((p) => ({ url: p.url, kind: p.kind === "video" ? "video" : "photo" }))
    .slice(0, LIMITS.photos);
  const address = cleanLine(request?.siteAddress, 300) || null;
  const wantedBy = asDate(request?.wantedBy);
  return {
    trade: cleanLine(request?.trade, LIMITS.trade),
    scope: cleanText(request?.scope, LIMITS.scope),
    address,
    area: addressArea(address),
    photos,
    wantedBy: wantedBy ? wantedBy.toISOString().slice(0, 10) : null,
    gc: {
      name: cleanLine(gc?.name, 160),
      logoUrl: typeof gc?.logoUrl === "string" && /^https:\/\//.test(gc.logoUrl) ? gc.logoUrl : null,
      brandColor: typeof gc?.brandColor === "string" ? gc.brandColor : null,
      email: cleanLine(gc?.email, 200) || null,
      phone: cleanLine(gc?.phone, 40) || null,
    },
    status: recipient ? recipientStatus(recipient) : null,
    reply:
      recipient && recipient.repliedAt
        ? {
            amount: recipient.replyAmount == null ? null : Math.round(Number(recipient.replyAmount) * 100) / 100,
            note: recipient.replyNote || "",
            confirmed: Boolean(recipient.quoteImportId),
          }
        : null,
  };
}

/** The message a lead in the SUB's FieldQuo opens with — the same allow-list, as text. */
export function leadMessageFor(view, labels = {}) {
  const L = { trade: "Trade", wantedBy: "Wanted by", ...labels };
  const head = [view?.trade ? `${L.trade}: ${view.trade}` : "", view?.wantedBy ? `${L.wantedBy}: ${view.wantedBy}` : ""].filter(Boolean);
  return [head.join("\n"), view?.scope || ""].filter(Boolean).join("\n\n");
}

// ── The sub's actions ───────────────────────────────────────────────────────

/**
 * May this signed-in member link the request to their company?
 *
 *   own        the GC's own staff opening their own request — nothing to link
 *   declined   they said no; a new request is the way back
 *   linked_elsewhere  this recipient (or the GC's roster row for them) is
 *              already linked to a DIFFERENT FieldQuo company. Re-linking it
 *              would hand a competitor the request; refused.
 *   no_session / read_only  a support session never writes (AGENTS.md #2)
 *
 * Accepting twice from the same company is fine — idempotent, not refused.
 */
export function canAccept({ recipient, member, gcCompanyId, rosterLinkedCompanyId = null } = {}) {
  if (!recipient) return { ok: false, reason: "not_found" };
  if (!member || !member.companyId) return { ok: false, reason: "no_session" };
  if (!member.userId || member.impersonation) return { ok: false, reason: "read_only" };
  if (member.companyId === gcCompanyId) return { ok: false, reason: "own" };
  if (recipient.declinedAt) return { ok: false, reason: "declined" };
  const bound = recipient.linkedCompanyId || rosterLinkedCompanyId || null;
  if (bound && bound !== member.companyId) return { ok: false, reason: "linked_elsewhere" };
  return { ok: true, again: Boolean(recipient.acceptedAt) };
}

/**
 * May the no-account reply form write? Only to this recipient's own pending
 * reply, and only while nothing has superseded it:
 *
 *   declined    they said no
 *   linked      they accepted it into FieldQuo — their quote is the answer
 *   confirmed   the GC already put the reply in the compare; the figure is
 *               the GC's snapshot now and the form cannot move it
 */
export function canReply(recipient) {
  if (!recipient) return { ok: false, reason: "not_found" };
  if (recipient.declinedAt) return { ok: false, reason: "declined" };
  if (recipient.acceptedAt || recipient.sourceQuoteId) return { ok: false, reason: "linked" };
  if (recipient.quoteImportId) return { ok: false, reason: "confirmed" };
  return { ok: true };
}

/** May they decline? Not once a price has reached the GC's compare. */
export function canDecline(recipient) {
  if (!recipient) return { ok: false, reason: "not_found" };
  if (recipient.declinedAt) return { ok: true, again: true };
  if (recipient.quoteImportId || recipient.sourceQuoteId) return { ok: false, reason: "quoted" };
  return { ok: true };
}

/**
 * Read the reply form. The amount is the sub's price to the GC — a number
 * the SUB typed about their OWN work, which is exactly what a quote is, so
 * accepting it from their browser is the point of the form; what it may
 * touch is decided by canReply, and it is shown to the GC as unconfirmed.
 *
 * `file` must be an upload this token's sign step minted (the GC's
 * price-reply folder), never an arbitrary URL.
 */
export function parseReplyInput(body, { gcCompanyId, cloudName } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "bad_body" };
  const raw = typeof body.amount === "number" ? String(body.amount) : typeof body.amount === "string" ? body.amount : "";
  const cleaned = raw.replace(/[\s$€£,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false, error: "bad_amount" };
  const amount = Math.round(Number(cleaned) * 100) / 100;
  if (!(amount > 0) || amount > LIMITS.amount) return { ok: false, error: "bad_amount" };
  const note = cleanText(body.note, LIMITS.note);
  let file = null;
  if (body.file !== undefined && body.file !== null) {
    file = ownReplyUpload(body.file, { gcCompanyId, cloudName });
    if (!file) return { ok: false, error: "bad_file" };
  }
  return { ok: true, data: { amount, note, file } };
}

/** The folder lib/media/directUpload.js uploadScope("price_reply") signs into. */
export function replyUploadFolder(gcCompanyId) {
  return `fieldquo/companies/${gcCompanyId}/price-replies`;
}

/** { url, filename } when `file` is one of ours in the GC's reply folder; else null. */
export function ownReplyUpload(file, { gcCompanyId, cloudName } = {}) {
  if (!file || typeof file !== "object" || !gcCompanyId || !cloudName) return null;
  const url = typeof file.url === "string" ? file.url : "";
  if (!url.startsWith(`https://res.cloudinary.com/${cloudName}/`)) return null;
  if (!url.includes(`/${replyUploadFolder(gcCompanyId)}/`)) return null;
  if (/[\s"'<>]/.test(url) || url.length > 2048) return null;
  const filename = cleanLine(file.filename, 160) || null;
  return { url, filename };
}

/** A decline reason, cleaned. Empty is allowed — "no" needs no explanation. */
export function parseDeclineInput(body) {
  return { reason: cleanText(body && typeof body === "object" ? body.reason : "", LIMITS.reason) || null };
}

// ── The reminder ────────────────────────────────────────────────────────────

/**
 * One gentle nudge, `days` after it was sent, to a sub who has neither
 * answered nor declined. Never a second one; never after the wanted-by date
 * (a reminder about a date already gone is noise); never when the company
 * turned it off (days 0).
 */
export function reminderDue(recipient, { days, now = new Date(), wantedBy = null } = {}) {
  const n = Number(days);
  if (!Number.isInteger(n) || n <= 0) return false;
  if (!recipient || !recipient.sentAt || recipient.remindedAt) return false;
  const status = recipientStatus(recipient);
  if (status !== "sent" && status !== "opened") return false;
  const sent = asDate(recipient.sentAt);
  if (!sent || now.getTime() - sent.getTime() < n * DAY) return false;
  const by = asDate(wantedBy);
  if (by && by.getTime() + DAY < now.getTime()) return false;
  return true;
}

/** The setting's allowed values: 0 (off) to 30 days. Null for anything else. */
export function parseReminderDays(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 30) return null;
  return n;
}

// ── Signing up from the request ─────────────────────────────────────────────

/**
 * What /signup and the welcome questions may open with for a sub who has no
 * account: what the GC entered about THEM on the GC's roster, and nothing
 * else — not the GC's details, not the job, never the homeowner. Blanks stay
 * blank (absence is not a statement). The sub confirms or edits each field
 * by pressing Next; nothing is written until they do.
 */
export function signupPrefill(sub) {
  const s = sub && typeof sub === "object" ? sub : {};
  const contact = cleanLine(s.contactName, 120);
  const words = contact.split(/\s+/).filter(Boolean);
  return {
    companyName: cleanLine(s.name, 120),
    firstName: words[0] || "",
    lastName: words.slice(1).join(" "),
    email: cleanLine(s.email, 200).toLowerCase(),
    phone: cleanLine(s.phone, 40),
    trade: cleanLine(s.trade, 80),
  };
}

/**
 * The welcome flow's industry select value for the sub's trade, or "" — an
 * exact match on the trade's own name or key only. "Painting" is not
 * guessed into "Interior painting"; a near miss is left for them to pick.
 *
 * @param groups the welcome page's industry groups (options: value, tradeKey, label)
 */
export function industryForTrade(trade, groups) {
  const want = cleanLine(trade, 80).toLowerCase();
  if (!want) return "";
  for (const g of Array.isArray(groups) ? groups : []) {
    for (const o of Array.isArray(g?.options) ? g.options : []) {
      if (String(o.label || "").toLowerCase() === want || String(o.tradeKey || "").toLowerCase() === want) return o.value;
    }
  }
  return "";
}

/**
 * Fill the welcome prefill's BLANKS from the request — a value the owner
 * already typed (or the database holds) is theirs and wins.
 */
export function mergeWelcomePrefill(prefill, fromRequest, { groups = null } = {}) {
  if (!prefill || typeof prefill !== "object" || !fromRequest) return prefill;
  const user = { ...(prefill.user || {}) };
  const company = { ...(prefill.company || {}) };
  if (!user.firstName && !user.lastName) {
    user.firstName = fromRequest.firstName || "";
    user.lastName = fromRequest.lastName || "";
  }
  if (!user.phone && fromRequest.phone) user.phone = fromRequest.phone;
  if (!company.name && fromRequest.companyName) company.name = fromRequest.companyName;
  if (!company.industry && groups) {
    const v = industryForTrade(fromRequest.trade, groups);
    if (v) company.industry = v;
  }
  return { ...prefill, user, company };
}

// ── The way back after signing up ───────────────────────────────────────────

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,128}$/;

export function isRequestTokenShape(token) {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

/** The request page for a token. */
export function priceRequestPath(token) {
  return `/price-request/${encodeURIComponent(String(token || ""))}`;
}

/**
 * The cookie the request page leaves so a signup that outlives its tab
 * (email verified elsewhere, back tomorrow) still returns to the request,
 * and so the welcome questions can open prefilled — the add-to-quote page's
 * pattern (lib/quotes/addToQuoteLink.js). It carries the token, the
 * credential already in their inbox, and nothing else.
 */
export const PRICE_REQUEST_COOKIE = "fq_price_request";
export const PRICE_REQUEST_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export function priceRequestCookie(token) {
  if (!isRequestTokenShape(token)) return null;
  return `${PRICE_REQUEST_COOKIE}=${token}; Max-Age=${PRICE_REQUEST_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function clearPriceRequestCookie() {
  return `${PRICE_REQUEST_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** The token in a Cookie header, or null. */
export function priceRequestTokenFromCookie(cookieHeader) {
  for (const part of String(cookieHeader || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== PRICE_REQUEST_COOKIE) continue;
    const value = part.slice(i + 1).trim();
    return isRequestTokenShape(value) ? value : null;
  }
  return null;
}

/** Where a finished welcome flow goes when sessionStorage has nothing: the request, or null. */
export function pendingPriceRequestPath(cookieHeader) {
  const token = priceRequestTokenFromCookie(cookieHeader);
  return token ? priceRequestPath(token) : null;
}

// ── The GC as a client in the sub's FieldQuo ────────────────────────────────

/**
 * The Client row a sub's company gets for the GC: a BUSINESS client, from
 * the GC's own published business details — the same name, email and phone
 * the GC's own quotes print. Found again by linkedCompanyId, never by name.
 */
export function gcClientData({ gc, subCompanyId }) {
  const country = cleanLine(gc?.country, 2).toUpperCase();
  return {
    companyId: subCompanyId,
    name: cleanLine(gc?.name, 160) || "General contractor",
    type: "company",
    email: cleanLine(gc?.email, 200).toLowerCase() || null,
    phone: cleanLine(gc?.phone, 40) || null,
    address: cleanLine(gc?.address, 200) || null,
    city: cleanLine(gc?.city, 120) || null,
    province: cleanLine(gc?.province, 120) || null,
    postalCode: cleanLine(gc?.postalCode, 20) || null,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    linkedCompanyId: gc?.id || null,
  };
}
