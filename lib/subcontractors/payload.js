// lib/subcontractors/payload.js
//
// Reading a subcontractor, a document, a job assignment and a payment off a
// request — and the columns a screen gets back.
//
// Shared between the create and update routes for the reason
// lib/fleet/payload.js is shared: a Next 16 route module may only export
// handlers, and two copies of "what does a blank expiry date mean" is how one
// of them ends up answering "expired".
//
// ══ The rule every optional field follows ══════════════════════════════════
//
//   ABSENT key       → leave the column alone.
//   PRESENT and blank → NULL, i.e. "we no longer claim to know".
//
// Nothing here substitutes a default for a blank. An invented insurance date
// is a sub somebody thinks is covered.
//
// ══ Money is refused, not clamped ══════════════════════════════════════════
//
// Same stance as lib/costing/actualJobCost.js's `sane`: an agreed amount past
// what Decimal(12,2) holds is a paste, and rewriting it as the largest number
// the column happens to hold invents a figure the person never typed. Zero and
// negatives are refused on a PAYMENT for a different reason — money paid TO a
// sub is a positive amount by definition, and a "negative payment" is a credit
// note this feature does not model. A GC who overpaid records the refund as
// an expense correction, not as a payment of minus four hundred dollars that
// would then reduce the sub's T5018 total.

import { JOB_SUBCONTRACTOR_STATUSES } from "./money";

/** Decimal(12,2) — see prisma/schema.prisma. */
export const MAX_MONEY = 9_999_999_999.99;

/** coi | clearance | agreement | other — the schema comment's four. */
export const DOCUMENT_KINDS = Object.freeze(["coi", "clearance", "agreement", "other"]);

/**
 * The two document kinds whose expiresAt is copied onto the sub's own
 * columns, and which column each one feeds. The schema says "the sub's own
 * insuranceExpiresAt / clearanceExpiresAt are updated from the newest document
 * of that kind, so the panel and the paper agree" — this table is that rule.
 */
export const EXPIRY_KIND_FIELD = Object.freeze({
  coi: "insuranceExpiresAt",
  clearance: "clearanceExpiresAt",
});

/**
 * The PaymentMethod values that can mean money going OUT.
 *
 * The enum is shared with client payments, and four of its seven values only
 * make sense inbound: `stripe` is FieldQuo's own Stripe Connect taking a
 * client's card (the payout, refund and dispute paths read it as such);
 * `visit_credit` is a booking fee the client already paid; `card_elsewhere`
 * is a client's card on somebody else's terminal; `shop` is Shop Pay, a
 * checkout wallet — nobody pays a roofer through Shop Pay. Recording any of
 * them against a sub would put "the client paid by card" into a column that
 * means "we paid the sub", and the T5018 export would total it.
 */
export const OUTBOUND_PAYMENT_METHODS = Object.freeze(["cash", "e_transfer", "cheque"]);
export const INBOUND_ONLY_PAYMENT_METHODS = Object.freeze([
  "stripe",
  "visit_credit",
  "card_elsewhere",
  "shop",
]);

export function isOutboundMethod(method) {
  return OUTBOUND_PAYMENT_METHODS.includes(method);
}

const text = (body, key, max = 200) => {
  if (body?.[key] === undefined) return undefined;
  const v = body[key];
  if (v === null) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/** A Date, null for blank, or `false` when the input is not a date at all. */
function dateOrNull(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw === 0) return false;
  const when = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(when.getTime()) ? false : when;
}

/** A positive money amount within the column, or an error sentence. */
function money(raw, { allowZero = false } = {}) {
  const n = typeof raw === "string" ? Number(raw.replace(/[,\s]/g, "")) : Number(raw);
  if (!Number.isFinite(n)) return { error: "Enter an amount." };
  if (n < 0) return { error: "An amount can't be negative." };
  if (n === 0 && !allowZero) return { error: "Enter an amount above zero." };
  if (n > MAX_MONEY) return { error: "That amount is larger than a record can hold — check for a stray digit." };
  return { value: Math.round(n * 100) / 100 };
}

/**
 * Read a subcontractor create/update body.
 *
 * @returns {{ data }} or {{ error }}
 */
export function parseSubcontractorBody(body, { creating = false } = {}) {
  const data = {};

  const name = text(body, "name", 160);
  if (creating) {
    if (!name) return { error: "Give the company a name." };
    data.name = name;
  } else if (name !== undefined) {
    if (!name) return { error: "A subcontractor needs a name — clear the record by marking it inactive instead." };
    data.name = name;
  }

  for (const [key, max] of [
    ["trade", 80],
    ["contactName", 120],
    ["phone", 40],
    ["notes", 4000],
  ]) {
    const value = text(body, key, max);
    if (value !== undefined) data[key] = value;
  }

  const email = text(body, "email", 200);
  if (email !== undefined) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { error: "That email address doesn't look right." };
    data.email = email ? email.toLowerCase() : null;
  }

  for (const key of ["insuranceExpiresAt", "clearanceExpiresAt"]) {
    if (body?.[key] === undefined) continue;
    const when = dateOrNull(body[key]);
    if (when === false) return { error: "That date isn't a date." };
    data[key] = when;
  }

  if (body?.taxFormRequired !== undefined) {
    if (typeof body.taxFormRequired !== "boolean")
      return { error: "taxFormRequired must be true or false." };
    data.taxFormRequired = body.taxFormRequired;
  }

  if (body?.active !== undefined) {
    if (typeof body.active !== "boolean") return { error: "active must be true or false." };
    data.active = body.active;
  }

  // linkedCompanyId is proved by the route (it is another tenant's id, by
  // definition, so ownedIds cannot prove it — the route checks the company
  // EXISTS and is not the caller's own). Read here only so a blank clears it.
  if (body?.linkedCompanyId !== undefined) {
    const v = body.linkedCompanyId;
    data.linkedCompanyId = typeof v === "string" && v.trim() ? v.trim() : null;
  }

  if (!creating && Object.keys(data).length === 0) return { error: "Nothing to change." };
  return { data };
}

/**
 * Read a document body — the SECOND step of the upload, after /api/upload
 * has returned a URL. The bytes never reach this.
 */
export function parseDocumentBody(body) {
  const kind = DOCUMENT_KINDS.includes(body?.kind) ? body.kind : null;
  if (!kind) return { error: "Say what kind of document this is." };

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return { error: "That file hasn't been uploaded yet." };

  const name = text(body, "name", 200) || null;

  const when = dateOrNull(body?.expiresAt);
  if (when === false) return { error: "That expiry date isn't a date." };
  // A COI or clearance with no expiry is accepted — the paper may not state
  // one — but it then updates nothing on the sub, because null would mean
  // "we no longer know" and a certificate is not evidence of that.

  const sizeRaw = body?.sizeBytes;
  const size = Number(sizeRaw);
  const sizeBytes =
    sizeRaw === null || sizeRaw === undefined || !Number.isInteger(size) || size <= 0 ? null : size;

  return {
    data: {
      kind,
      url,
      name,
      expiresAt: when,
      sizeBytes,
      mimeType: typeof body?.mimeType === "string" ? body.mimeType.slice(0, 120) : null,
    },
  };
}

/**
 * Read a job-assignment create/update body.
 *
 * `status` is validated against the four strings. `agreedAmount` is refused
 * outside (0, MAX_MONEY]; zero is allowed on CREATE only when the amount is
 * still unknown — a sub put on a visit before the price is in — and the
 * status is then forced to `quoted`, since an agreement with no price is not
 * an agreement.
 */
export function parseJobSubcontractorBody(body, { creating = false } = {}) {
  const data = {};

  if (creating) {
    const subId = typeof body?.subcontractorId === "string" ? body.subcontractorId.trim() : "";
    if (!subId) return { error: "Pick which subcontractor." };
    data.subcontractorId = subId;
  }

  const description = text(body, "description", 500);
  if (description !== undefined) data.description = description;

  if (body?.agreedAmount !== undefined || creating) {
    const raw = body?.agreedAmount;
    const blank = raw === undefined || raw === null || raw === "";
    if (blank) {
      if (!creating) return { error: "Enter the agreed amount." };
      data.agreedAmount = 0;
    } else {
      // Zero only while creating — see the docblock. On an update a zero
      // would be a price being taken back, and the status is what says that.
      const m = money(raw, { allowZero: creating });
      if (m.error) return { error: m.error };
      data.agreedAmount = m.value;
    }
  }

  if (body?.status !== undefined) {
    if (!JOB_SUBCONTRACTOR_STATUSES.includes(body.status))
      return { error: "That isn't a status a subcontractor can have." };
    data.status = body.status;
  }

  if (body?.visitId !== undefined) {
    const v = body.visitId;
    data.visitId = typeof v === "string" && v.trim() ? v.trim() : null;
  }

  if (body?.quoteImportId !== undefined) {
    const v = body.quoteImportId;
    data.quoteImportId = typeof v === "string" && v.trim() ? v.trim() : null;
  }

  if (creating && !data.status) data.status = data.agreedAmount > 0 ? "agreed" : "quoted";
  if (data.agreedAmount === 0 && data.status && data.status !== "quoted")
    return { error: "A subcontractor can't be agreed, done or paid without an agreed amount." };

  if (!creating && Object.keys(data).length === 0) return { error: "Nothing to change." };
  return { data };
}

/**
 * Read a record-a-payment body.
 *
 * @returns {{ data: { amount, method, date, notes, jobSubcontractorId } }} or {{ error }}
 */
export function parsePaymentBody(body) {
  const m = money(body?.amount);
  if (m.error) return { error: m.error };

  const method = typeof body?.method === "string" ? body.method : "";
  if (!method) return { error: "Say how it was paid." };
  if (INBOUND_ONLY_PAYMENT_METHODS.includes(method))
    return {
      error:
        "That method is how a client pays you, not how you pay a subcontractor. Record cash, e-transfer or cheque.",
    };
  if (!isOutboundMethod(method)) return { error: "That isn't a payment method." };

  let date = new Date();
  if (body?.date !== undefined && body?.date !== null && body?.date !== "") {
    const when = dateOrNull(body.date);
    if (when === false) return { error: "That date isn't a date." };
    date = when;
  }

  const notes = text(body, "notes", 1000) ?? null;

  const js = body?.jobSubcontractorId;
  const jobSubcontractorId = typeof js === "string" && js.trim() ? js.trim() : null;

  return { data: { amount: m.value, method, date, notes, jobSubcontractorId } };
}

/** The Subcontractor columns a screen gets. Never notes on the list. */
export const SUBCONTRACTOR_SELECT = {
  id: true,
  name: true,
  trade: true,
  contactName: true,
  email: true,
  phone: true,
  linkedCompanyId: true,
  insuranceExpiresAt: true,
  clearanceExpiresAt: true,
  taxFormRequired: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

export const SUBCONTRACTOR_DETAIL_SELECT = { ...SUBCONTRACTOR_SELECT, notes: true };

export const DOCUMENT_SELECT = {
  id: true,
  name: true,
  kind: true,
  url: true,
  sizeBytes: true,
  mimeType: true,
  expiresAt: true,
  uploadedById: true,
  uploadedAt: true,
};

export const JOB_SUBCONTRACTOR_SELECT = {
  id: true,
  jobId: true,
  subcontractorId: true,
  visitId: true,
  description: true,
  agreedAmount: true,
  status: true,
  quoteImportId: true,
  createdAt: true,
  updatedAt: true,
};

export const PAYMENT_SELECT = {
  id: true,
  subcontractorId: true,
  jobSubcontractorId: true,
  amount: true,
  method: true,
  date: true,
  notes: true,
  stripeTransferId: true,
  expenseId: true,
  createdAt: true,
};

/**
 * Remove the money from a JobSubcontractor row for a member without
 * jobCosting. The row survives — who is on the job, and where it stands — so
 * the dispatcher still sees the electrician is booked; only the price goes.
 */
export function stripJobSubcontractorMoney(row) {
  if (!row || typeof row !== "object") return row;
  const { agreedAmount, payments, paid, remaining, ...rest } = row;
  void agreedAmount;
  void payments;
  void paid;
  void remaining;
  return { ...rest, restricted: true };
}
