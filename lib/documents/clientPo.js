// lib/documents/clientPo.js
//
// The CLIENT's purchase-order number — Quote / Job / Invoice.clientPoNumber
// and Client.requiresPo — decided in one place.
//
// ══ Not the supplier PO ═════════════════════════════════════════════════════
//
// FieldQuo already has purchase orders: PurchaseOrder, raised BY the
// contractor TO a supplier for materials (lib/purchasing/poNumber.js,
// "PO-001"). This is the other direction. A property manager or a general
// contractor issues the contractor a PO, and their accounts payable will not
// pay an invoice that does not quote it back. Nothing here reads or writes a
// PurchaseOrder row, and the generated reference below has its own shape
// ("PO-2026-0042", with the year) so the two series can never be mistaken for
// one another on a job page that shows both.
//
// ══ The pipeline ════════════════════════════════════════════════════════════
//
//   Quote.clientPoNumber ──accept──▶ Job.clientPoNumber ──raise──▶ Invoice
//
// Carried, never re-derived: each document holds its own copy, so a client
// that issues a different PO per phase can have one on each invoice, and a
// sent invoice keeps saying what it said. `carriedClientPo` is the one rule
// for "which value does a new document start with" — the job's (the newer of
// the two: a PO is usually issued AFTER the quote is approved) and then the
// quote's.
//
// ══ Absence ═════════════════════════════════════════════════════════════════
//
// No PO is null, and null prints NOTHING — no "PO #" label with a blank beside
// it (AGENTS.md failure class 5). Every printer goes through `clientPoFact`,
// which returns null for null, so a document without one renders exactly as
// it did before the column existed.
//
// JSX-free and import-free on purpose: the email builders, the PDF sections,
// the portal page and the check scripts all import it.

/** Long enough for any real PO ("4500012345-0010/REV2"), short enough for a header. */
export const CLIENT_PO_MAX = 60;

/**
 * Whatever a browser sent → the stored value, or null.
 *
 * Trimmed, inner whitespace collapsed, control characters removed (a pasted
 * tab or newline would break the one-line header it prints in), capped. A
 * number is accepted as its digits — a spreadsheet paste often arrives as
 * one. Anything else is null.
 */
export function normaliseClientPo(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    value = String(value);
  }
  if (typeof value !== "string") return null;
  const cleaned = value
    // Zero-width marks vanish (they sit INSIDE a pasted number, "44\u200b71");
    // control characters and line separators become a space (they sit
    // BETWEEN words) — then whitespace collapses to one line.
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CLIENT_PO_MAX)
    .trim();
  return cleaned || null;
}

/**
 * A request body's field → what to write.
 *
 *   absent (undefined)   → undefined: the request said nothing, leave it
 *   "" / null / junk     → null: the field was cleared
 *   text                 → the normalised text
 *
 * The three-way split is the same care taxEnabled gets in the routes: a
 * status-only PATCH must never wipe a PO somebody typed.
 */
export function readClientPoInput(body, key = "clientPoNumber") {
  if (!body || typeof body !== "object" || !(key in body) || body[key] === undefined) return undefined;
  return normaliseClientPo(body[key]);
}

/**
 * The PO a NEW document starts with: the first of `sources` that has one.
 * Callers pass them newest-first — the job, then the quote.
 */
export function carriedClientPo(...sources) {
  for (const s of sources) {
    const v = normaliseClientPo(s && typeof s === "object" ? s.clientPoNumber : s);
    if (v) return v;
  }
  return null;
}

/**
 * The ["PO #", "4471"] pair for a document's details, or null when there is
 * no PO. `labels` is documentLabels(language) — the label is the DOCUMENT's
 * language (non-negotiable #6), never the reader's UI.
 */
export function clientPoFact(data, labels) {
  const value = normaliseClientPo(data?.clientPoNumber);
  if (!value) return null;
  const label = (labels && typeof labels.poNumber === "string" && labels.poNumber) || "PO #";
  return [label, value];
}

/**
 * The same fact as one run of text — "PO # 4471" — for the places that print
 * a single line rather than a label/value table (the work order's sub-line).
 * Null when there is no PO, so `[…].filter(Boolean).join(" · ")` drops it.
 */
export function clientPoLine(data, labels) {
  const fact = clientPoFact(data, labels);
  return fact ? `${fact[0]} ${fact[1]}` : null;
}

/**
 * Does a list row match the search box on its PO? Case-insensitive, and
 * blind to spaces and dashes so "po 4471", "PO-4471" and "4471" all find
 * "PO-4471". An empty search matches nothing here — the caller ORs this with
 * its other fields, and an empty box already matches on those.
 */
export function matchesClientPo(row, search) {
  const fold = (s) => String(s || "").toLowerCase().replace(/[\s\-_/.#]+/g, "");
  const q = fold(search);
  if (!q) return false;
  const po = fold(row?.clientPoNumber);
  return Boolean(po) && po.includes(q);
}

// ── "This client requires a PO" ────────────────────────────────────────────

/**
 * Should sending this invoice stop and ask about the PO?
 *
 * Null when it may simply go: the client does not require one, the invoice
 * has one, or the person already chose "send anyway". Otherwise the shape the
 * send routes answer with (409, code "po_required") and the screen draws its
 * dialog from — the client's name, and whether the invoice can still take a
 * PO in place (a draft) or only by amendment (sent).
 */
export function clientPoSendPrompt({ client, invoice, sendWithoutPo = false } = {}) {
  if (!client?.requiresPo) return null;
  if (normaliseClientPo(invoice?.clientPoNumber)) return null;
  if (sendWithoutPo === true) return null;
  const name = String(client?.name || "").trim() || "This client";
  return {
    code: "po_required",
    clientName: name,
    editable: invoice?.status === "draft",
    error: `${name} requires a PO number on invoices. Add it, or send without one.`,
  };
}

// ── The generated reference ────────────────────────────────────────────────
//
// For the client who asks the contractor to quote "against a reference": the
// "Generate" button fills the field with the company's next reference. It is
// only a suggestion in a text box — the person saves it, or types over it.
// The client-issued number is the main path.
//
// The shape is the company's (Company.clientPoPrefix / clientPoIncludeYear /
// clientPoDigits, Settings → Company): "PO-2026-0042" by default. Changing
// it never rewrites a reference already on a document — the sequence is
// simply counted among the values of the NEW shape, so a switch from
// "PO-2026-0042" to "REF-0001" starts REF at 1 and every PO-2026 stays as it
// was printed.
//
// The sequence is the same shape lib/invoices/invoiceNumber.js uses: every
// value the company already holds (on quotes, jobs and invoices — the same
// reference rides down the pipeline, so it is counted once), the highest of
// the current shape, plus one, checked free. Per company, never global, for
// the reason lib/purchasing/poNumber.js gives: a painter's first reference
// must not tell their client how many other companies use this software.

export const CLIENT_PO_FORMAT_DEFAULT = Object.freeze({ prefix: "PO-", includeYear: true, digits: 4 });
export const CLIENT_PO_PREFIX_MAX = 12;
export const CLIENT_PO_DIGITS_MIN = 1;
export const CLIENT_PO_DIGITS_MAX = 8;
// Letters, digits and the separators a reference is normally written with.
// No spaces at either end, nothing that breaks a one-line header.
const PREFIX_CHARS = /^[A-Za-z0-9 _./#-]*$/;

/**
 * What a browser sent for the format → { ok, format } or { ok: false, error }.
 * Every field is optional and falls back to the CURRENT value (or the
 * default), so a form that sends only the prefix changes only the prefix.
 */
export function validateClientPoFormat(input = {}, current = CLIENT_PO_FORMAT_DEFAULT) {
  const base = readClientPoFormat(current);
  const prefix = input.prefix === undefined ? base.prefix : typeof input.prefix === "string" ? input.prefix.trim() : null;
  if (prefix === null || prefix.length > CLIENT_PO_PREFIX_MAX || !PREFIX_CHARS.test(prefix)) {
    return { ok: false, error: `The prefix can be up to ${CLIENT_PO_PREFIX_MAX} letters, digits, spaces or - _ . / #.` };
  }
  const includeYear = input.includeYear === undefined ? base.includeYear : input.includeYear;
  if (typeof includeYear !== "boolean") return { ok: false, error: "Include the year: yes or no." };
  const digits = input.digits === undefined ? base.digits : Number(input.digits);
  if (!Number.isInteger(digits) || digits < CLIENT_PO_DIGITS_MIN || digits > CLIENT_PO_DIGITS_MAX) {
    return { ok: false, error: `The number is padded to ${CLIENT_PO_DIGITS_MIN}–${CLIENT_PO_DIGITS_MAX} digits.` };
  }
  // A bare number ("0042") would be read as the next of every numeric PO a
  // client ever issued — "4471" would move the sequence. Something has to
  // mark a reference as ours.
  if (!prefix && !includeYear) {
    return { ok: false, error: "Give the reference a prefix or the year, so it can't be mistaken for a client's own number." };
  }
  return { ok: true, format: { prefix, includeYear, digits } };
}

/**
 * A Company row (or a stored/partial format) → the format, defaults filling
 * anything missing or unreadable. Never throws: a broken row generates the
 * default shape rather than nothing.
 */
export function readClientPoFormat(row) {
  const src = row || {};
  const prefix = src.clientPoPrefix ?? src.prefix;
  const includeYear = src.clientPoIncludeYear ?? src.includeYear;
  const digits = Number(src.clientPoDigits ?? src.digits);
  const out = {
    prefix: typeof prefix === "string" && prefix.length <= CLIENT_PO_PREFIX_MAX && PREFIX_CHARS.test(prefix) ? prefix : CLIENT_PO_FORMAT_DEFAULT.prefix,
    includeYear: typeof includeYear === "boolean" ? includeYear : CLIENT_PO_FORMAT_DEFAULT.includeYear,
    digits: Number.isInteger(digits) && digits >= CLIENT_PO_DIGITS_MIN && digits <= CLIENT_PO_DIGITS_MAX ? digits : CLIENT_PO_FORMAT_DEFAULT.digits,
  };
  if (!out.prefix && !out.includeYear) out.prefix = CLIENT_PO_FORMAT_DEFAULT.prefix;
  return out;
}

/** The stem every reference of this shape and year starts with: "PO-2026-". */
export function clientPoStem(format, year) {
  const f = readClientPoFormat(format);
  return `${f.prefix}${f.includeYear ? `${year}-` : ""}`;
}

/** One reference: format + year + sequence → "PO-2026-0042". Padding is a floor. */
export function formatGeneratedClientPo(format, year, seq) {
  const f = readClientPoFormat(format);
  return `${clientPoStem(f, year)}${String(Math.max(1, Math.trunc(Number(seq) || 1))).padStart(f.digits, "0")}`;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Pure: the next reference of `format` for `year`, given every client PO the company holds. */
export function nextGeneratedClientPo(takenValues, year = new Date().getFullYear(), format = CLIENT_PO_FORMAT_DEFAULT) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1970 || y > 9999) {
    throw new Error(`nextGeneratedClientPo: "${year}" is not a year`);
  }
  const f = readClientPoFormat(format);
  // The stem, then digits and nothing else — "PO-2026-0042" counts for the
  // default shape, "PO-2026-0042-A" and "PO 2026 0042" do not.
  const shape = new RegExp(`^${escapeRe(clientPoStem(f, y).toUpperCase())}(\\d+)$`);
  const taken = new Set();
  let highest = 0;
  for (const raw of Array.isArray(takenValues) ? takenValues : []) {
    const v = normaliseClientPo(raw);
    if (!v) continue;
    taken.add(v.toUpperCase());
    const m = shape.exec(v.toUpperCase());
    if (m) highest = Math.max(highest, Number(m[1]) || 0);
  }
  let seq = highest + 1;
  for (let guard = 0; guard < 10000; guard++) {
    const candidate = formatGeneratedClientPo(f, y, seq);
    if (!taken.has(candidate.toUpperCase())) return candidate;
    seq++;
  }
  // Unreachable short of 10,000 consecutive collisions; throwing beats
  // returning a value we know is taken.
  throw new Error("Could not allocate a free PO reference");
}

/**
 * Read this company's format and its client POs of that shape and year, and
 * return the next one. Takes a Prisma client or transaction. Supplier
 * PurchaseOrder rows are deliberately NOT read — a different series, see the
 * header.
 */
export async function allocateGeneratedClientPo(db, { companyId, year = new Date().getFullYear(), format } = {}) {
  const f = format
    ? readClientPoFormat(format)
    : readClientPoFormat(
        await db.company.findUnique({
          where: { id: companyId },
          select: { clientPoPrefix: true, clientPoIncludeYear: true, clientPoDigits: true },
        }),
      );
  const where = { companyId, clientPoNumber: { startsWith: clientPoStem(f, year), mode: "insensitive" } };
  const select = { clientPoNumber: true };
  const [quotes, jobs, invoices] = await Promise.all([
    db.quote.findMany({ where, select }),
    db.job.findMany({ where, select }),
    db.invoice.findMany({ where, select }),
  ]);
  return nextGeneratedClientPo(
    [...quotes, ...jobs, ...invoices].map((r) => r.clientPoNumber),
    year,
    f,
  );
}

// ── "No PO, no invoice": the held payment request ─────────────────────────

/**
 * Should an AUTOMATIC payment request (the deposit on acceptance, a stage the
 * cron finds due) be held instead of sent? Only for a client that requires a
 * PO, on an invoice that has none and has never gone out. An invoice already
 * sent keeps being asked for — the owner's decision: reminders and stage
 * requests are about the invoice, which the client already holds.
 */
export function holdPaymentRequestForPo({ client, invoice } = {}) {
  return Boolean(client?.requiresPo) && !normaliseClientPo(invoice?.clientPoNumber) && !invoice?.sentAt;
}

/** The sourceKey of the "add the PO" task for one invoice — one per invoice. */
export const poHoldTaskKey = (invoiceId) => `po_hold:${invoiceId}`;

// ── A job's PO, onto its draft invoices ────────────────────────────────────

/**
 * The where-clause for "this job's invoices that a PO change on the job may
 * still rewrite": DRAFT roots only (a sent invoice changes by amendment and
 * nothing else), not a past job typed in after the fact, linked to the job
 * or raised from its quote without a job link, and holding no PO or the
 * job's OLD one — a draft somebody gave its own PO keeps it.
 */
export function draftInvoicesFollowingJobPo({ job, previousPo }) {
  const links = [{ jobId: job.id }];
  if (job.quoteId) links.push({ jobId: null, quoteId: job.quoteId });
  const holding = [{ clientPoNumber: null }];
  const prev = normaliseClientPo(previousPo);
  if (prev) holding.push({ clientPoNumber: prev });
  return {
    companyId: job.companyId,
    status: "draft",
    parentInvoiceId: null,
    historicalImportedAt: null,
    AND: [{ OR: links }, { OR: holding }],
  };
}
