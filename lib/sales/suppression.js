// lib/sales/suppression.js
//
// Reading and writing FieldQuo's own do-not-contact list.
//
// ══ The database client is a parameter ═════════════════════════════════════
//
// lib/marketing/unsubscribe.js and lib/sales/outreachInbound.js both do this,
// and the reason applies with more force here: the properties worth asserting
// are properties of a QUERY plus a decision — "the send path re-read the list
// in the same request", "a removal without a reason was refused", "a phone
// opt-out closed the email channel too". Reading the source and agreeing with
// it proves none of them. Taking the client as an argument lets
// scripts/check-sales-suppression.mjs run these exact functions against a fake
// client, and costs each caller one import it already has.
//
// ══ Re-read at the moment of the send, never carried ═══════════════════════
//
// checkSuppression() is modelled on lib/migrations/state.js's canWrite(): the
// gate runs on rows read fresh in the request that performs the action, not on
// a verdict the screen computed when it rendered. An opt-out that arrived
// while a rep was typing has to win, and the two-minute-old "canSend: true"
// sitting in their browser is exactly the value that would let it lose.
//
// ══ Nothing here deletes ═══════════════════════════════════════════════════
//
// There is no delete function in this file and there must not be one. Canada's
// internal do-not-call obligation runs for three years and fourteen days
// (internalDncRetainUntil in ./suppressionRules.js says why), and FieldQuo
// keeps these rows past that rather than writing a sweep it would then have to
// prove correct. Removal is `removedAt` plus a mandatory reason, which lifts
// the block and keeps the evidence.

import {
  ALL_CHANNELS,
  internalDncRetainUntil,
  isSuppressionChannel,
  isSuppressionKind,
  isSuppressionSource,
  normaliseEmail,
  normaliseSuppressionValue,
  suppressionLookupKeys,
  suppressionVerdict,
} from "./suppressionRules";

// Re-exported so a screen or a route that needs to SAY why a channel is closed
// imports it from the same place it imports the gate. Two import paths to one
// rule is how a screen and a send path end up disagreeing about the law.
export { contactBasisFor, prohibitedChannelsFor, SOURCE_CONTACT_BASIS } from "./suppressionRules";

/** The columns every read needs. One list, so a reader and the verdict agree. */
export const SUPPRESSION_SELECT = {
  id: true,
  kind: true,
  value: true,
  rawValue: true,
  channels: true,
  source: true,
  reason: true,
  evidenceUrl: true,
  requestedAt: true,
  retainUntil: true,
  removedAt: true,
  removedByAdminId: true,
  removedReason: true,
  createdAt: true,
};

/**
 * Every live-or-removed row matching this contact's keys.
 *
 * Removed rows come back too, deliberately: suppressionVerdict() filters them,
 * and a screen that showed nothing for a contact whose suppression a
 * superadmin lifted last week would hide the one fact a rep most needs before
 * dialling them.
 */
export async function findSuppressions(db, contact = {}) {
  const keys = suppressionLookupKeys(contact);
  if (!keys.length) return [];

  return db.salesSuppression.findMany({
    where: { OR: keys.map((k) => ({ kind: k.kind, value: k.value })) },
    select: SUPPRESSION_SELECT,
  });
}

/**
 * May FieldQuo contact this person on this channel, right now?
 *
 * THE function every outbound path calls immediately before contacting anyone.
 *
 * @param contact { email?, phone?, domain? } — as typed; normalised here
 * @param channel "email" | "phone" | "sms"
 * @returns { suppressed, hit, reason }
 */
export async function checkSuppression(db, { channel, sourceProvider = null, ...contact } = {}) {
  // An unknown channel is refused by suppressionVerdict rather than waved
  // through, so this stays a single exit rather than a special case.
  //
  // `sourceProvider` is destructured out BEFORE `contact` is built, because it
  // is not a contact detail and suppressionLookupKeys would silently ignore
  // it — an argument that looks passed and does nothing is the failure this
  // whole file is written against.
  const rows = await findSuppressions(db, contact);
  return suppressionVerdict({ rows, channel, sourceProvider });
}

/**
 * Where FieldQuo got this contact, so the send path can refuse on provenance.
 *
 * ══ Why this asks the database instead of trusting the caller ══════════════
 *
 * `suppressionVerdict` will refuse a channel a source's provenance prohibits,
 * but only if somebody tells it which source. Leaving that to each caller is
 * how the rule ends up enforced in the one place that remembered — and the
 * addresses this exists to protect are 45,831 rows that look exactly like a
 * mailing list and legally are not one.
 *
 * Two ways of asking, because there are two ways the link exists:
 *
 *   1. The lead points at a prospect. The direct answer, and the cheap one.
 *   2. Nothing points anywhere, and we have only the address a rep typed.
 *      Then ask the evidence: an address FieldQuo ingested from a register is
 *      recorded as a ProspectEvidence row naming the provider that supplied
 *      it. A rep who read an address off the prospect screen and pasted it
 *      into a lead has produced exactly this case, and it is the case a
 *      lead-to-prospect foreign key would not catch.
 *
 * Returns null when nothing is known — which imposes no restriction, and must
 * not: absence of provenance is not a finding, and refusing every hand-typed
 * lead because we could not trace it would be over-blocking dressed as rigour.
 *
 * @returns {Promise<string|null>} a Prospect.sourceProvider key, or null
 */
export async function sourceProviderForContact(db, { leadId = null, email = null } = {}) {
  // ── Each lookup fails on its own, and a failure is not a verdict ────────
  //
  // Two decisions here, both worth arguing:
  //
  // Separately, because the two lookups are independent — a client that
  // cannot answer the first must still get to try the second, and an early
  // throw would skip it.
  //
  // And soft, because this is a BACKSTOP rather than the gate. Failing closed
  // would refuse every email FieldQuo sends the moment this query hiccups,
  // which is over-blocking on an infrastructure fault; and failing loudly
  // would make a provenance error indistinguishable from the suppression list
  // being unreadable, which is a different and more serious state that
  // salesSmsReadiness already refuses on by name. So a failure is logged, and
  // imposes no restriction.
  //
  // The durable fix is provenance ON the prospect rather than inferred from
  // its evidence — see the schema note accompanying this work.
  const attempt = async (label, run) => {
    try {
      return await run();
    } catch (err) {
      console.error(`[sales] couldn't read contact provenance (${label}):`, err?.message);
      return null;
    }
  };

  if (leadId) {
    const lead = await attempt("lead", () =>
      db.salesLead.findUnique({
        where: { id: leadId },
        select: { prospect: { select: { sourceProvider: true } } },
      }),
    );
    const provider = lead?.prospect?.sourceProvider || null;
    if (provider) return provider;
  }

  const address = normaliseEmail(email);
  if (!address) return null;

  // Exact equality on both spellings, because evidence stores the raw value
  // and the normalised one and a register's raw value is not always lowercase.
  // See the schema note accompanying this work: this wants an index on
  // ProspectEvidence(rawValue) to stay a lookup rather than a scan.
  const evidence = await attempt("evidence", () =>
    db.prospectEvidence.findFirst({
      where: {
        type: "source_field",
        OR: [{ normalizedValue: address }, { rawValue: address }, { rawValue: String(email).trim() }],
      },
      select: { source: true },
      orderBy: { observedAt: "asc" },
    }),
  );
  return evidence?.source || null;
}

/**
 * The same question, as a refusal a route can return directly.
 *
 * 409 rather than 403: the caller is perfectly entitled to be here, and the
 * request conflicts with a standing instruction. The same status
 * app/api/sales/threads/route.js already returns for the per-lead opt-out, so
 * the screens need no new branch.
 *
 * @returns null when the send may proceed, or { status, body }.
 */
export async function suppressionRefusal(db, { channel, sourceProvider = null, ...contact } = {}) {
  const verdict = await checkSuppression(db, { channel, sourceProvider, ...contact });
  if (!verdict.suppressed) return null;
  return {
    status: 409,
    body: { error: verdict.reason, suppressed: true, optedOut: true },
  };
}

/**
 * Record that somebody asked FieldQuo to stop.
 *
 * Idempotent on (kind, value): asking twice re-evidences the existing row and
 * reopens it if a superadmin had removed it, rather than creating a second row
 * that a lookup might find and a screen might not. Both the mutation and its
 * history entry are written in one transaction — a suppression with no event
 * behind it is a record whose provenance we cannot show, which for this table
 * is the whole point.
 *
 * @returns { ok: true, suppression, action } | { ok: false, error }
 */
export async function suppress(db, options = {}) {
  return db.$transaction((tx) => suppressWithin(tx, options));
}

/**
 * The same write, against a transaction that is already open.
 *
 * Split out because the most important caller is inside one: filing an inbound
 * reply that says "unsubscribe" has to write the message and the suppression
 * together or not at all — a message stored without its suppression is an
 * opt-out we can prove we received and did not act on. Prisma's interactive
 * transaction client has no `$transaction` of its own, so a nested call would
 * throw rather than join, which is why the seam is here rather than a runtime
 * check for "is this a tx".
 */
export async function suppressWithin(
  tx,
  {
    kind,
    value,
    channels = ALL_CHANNELS,
    source,
    reason = null,
    evidenceUrl = null,
    salesLeadId = null,
    prospectId = null,
    salesMessageId = null,
    requestedAt = null,
    adminId = null,
    salesRepId = null,
  } = {},
) {
  if (!isSuppressionKind(kind)) {
    return { ok: false, error: `"${kind}" isn't an email, a phone number or a domain.` };
  }
  const normalised = normaliseSuppressionValue(kind, value);
  if (!normalised) {
    return {
      ok: false,
      error: `"${String(value ?? "").slice(0, 80)}" isn't a usable ${kind}, so nothing was suppressed.`,
    };
  }
  if (!isSuppressionSource(source)) {
    // No default. Where a request came from is part of what the retention
    // obligation is retaining, and "manual" applied silently to a regulator's
    // list would misdescribe the one record most likely to be asked about.
    return { ok: false, error: `"${source}" isn't a source this list records.` };
  }

  const wanted = (Array.isArray(channels) ? channels : []).filter(isSuppressionChannel);
  if (!wanted.length) {
    return {
      ok: false,
      error: "A suppression has to close at least one channel, or it does nothing.",
    };
  }

  const asked = requestedAt ? new Date(requestedAt) : new Date();
  const when = Number.isNaN(asked.getTime()) ? new Date() : asked;

  const existing = await tx.salesSuppression.findUnique({
    where: { kind_value: { kind, value: normalised } },
    select: { id: true, channels: true, removedAt: true, requestedAt: true },
  });

  // The union, never a replacement. A prospect who said "stop emailing" in
  // March and "stop calling" in June has asked for both, and overwriting the
  // channel list with the latest request would silently reopen the first.
  const merged = existing
    ? Array.from(new Set([...(existing.channels || []), ...wanted]))
    : wanted;

  // The retention clock runs from the EARLIEST request, so a later re-add
  // can only ever extend the obligation, never restart it shorter.
  const earliest =
    existing?.requestedAt && new Date(existing.requestedAt) < when
      ? new Date(existing.requestedAt)
      : when;

  const data = {
    channels: merged,
    source,
    reason,
    evidenceUrl,
    salesLeadId,
    prospectId,
    salesMessageId,
    requestedAt: earliest,
    retainUntil: internalDncRetainUntil(earliest),
    // A re-add lifts a previous removal. Left set, a superadmin's old
    // removal would outrank a fresh "stop" from the person themselves.
    removedAt: null,
    removedByAdminId: null,
    removedReason: null,
    createdBySalesRepId: salesRepId,
    createdByAdminId: adminId,
  };

  const suppression = await tx.salesSuppression.upsert({
    where: { kind_value: { kind, value: normalised } },
    create: { kind, value: normalised, rawValue: String(value ?? "").slice(0, 320), ...data },
    update: data,
    select: SUPPRESSION_SELECT,
  });

  const action = existing ? "resuppressed" : "suppressed";

  await tx.salesSuppressionEvent.create({
    data: {
      suppressionId: suppression.id,
      action,
      source,
      reason,
      channels: merged,
      actorAdminId: adminId,
      actorSalesRepId: salesRepId,
    },
  });

  return { ok: true, suppression, action };
}

/**
 * Lift a suppression. Superadmin-only, and the reason is mandatory.
 *
 * ══ Why the row survives ═══════════════════════════════════════════════════
 *
 * The block goes; the record of the request does not. Deleting would destroy
 * the evidence the internal-DNC obligation exists to preserve, and would also
 * make the removal itself unauditable — the one action on this table most
 * likely to be questioned later.
 *
 * The caller is responsible for having established that the actor is a
 * superadmin; this refuses an absent actor id so that a route which forgot to
 * pass one fails loudly rather than writing an unattributed removal.
 *
 * @returns { ok: true, suppression } | { ok: false, error, status }
 */
export async function unsuppress(db, { kind, value, adminId, reason } = {}) {
  const trimmed = String(reason ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 400,
      error:
        "Removing someone from the do-not-contact list needs a reason on the " +
        "record. This is the one action on this list nobody can undo for them.",
    };
  }
  if (!adminId) {
    return { ok: false, status: 403, error: "A removal has to be attributed to a superadmin." };
  }
  if (!isSuppressionKind(kind)) {
    return { ok: false, status: 400, error: `"${kind}" isn't a kind this list holds.` };
  }

  const normalised = normaliseSuppressionValue(kind, value);
  if (!normalised) {
    return { ok: false, status: 400, error: `"${String(value ?? "").slice(0, 80)}" isn't a usable ${kind}.` };
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.salesSuppression.findUnique({
      where: { kind_value: { kind, value: normalised } },
      select: { id: true, removedAt: true },
    });
    if (!existing) {
      return { ok: false, status: 404, error: "That isn't on the list." };
    }
    if (existing.removedAt) {
      return { ok: false, status: 409, error: "That was already removed from the list." };
    }

    const suppression = await tx.salesSuppression.update({
      where: { id: existing.id },
      data: {
        removedAt: new Date(),
        removedByAdminId: adminId,
        removedReason: trimmed.slice(0, 1000),
      },
      select: SUPPRESSION_SELECT,
    });

    await tx.salesSuppressionEvent.create({
      data: {
        suppressionId: suppression.id,
        action: "removed",
        reason: trimmed.slice(0, 1000),
        channels: [],
        actorAdminId: adminId,
      },
    });

    return { ok: true, suppression };
  });
}

/**
 * The list, for the superadmin screen.
 *
 * Removed rows are included by default and flagged rather than hidden: a
 * console that quietly dropped them would make "was this person ever on the
 * list" unanswerable from the screen that exists to answer it.
 */
export async function listSuppressions(db, { query = "", take = 100, skip = 0 } = {}) {
  const q = String(query ?? "").trim().toLowerCase();
  const where = q
    ? {
        OR: [
          { value: { contains: q } },
          { rawValue: { contains: q, mode: "insensitive" } },
          { reason: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    db.salesSuppression.findMany({
      where,
      select: SUPPRESSION_SELECT,
      orderBy: [{ removedAt: "asc" }, { requestedAt: "desc" }],
      take: Math.min(Math.max(Number(take) || 100, 1), 500),
      skip: Math.max(Number(skip) || 0, 0),
    }),
    db.salesSuppression.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Bulk import, so a list FieldQuo already holds can be loaded before the first
 * call rather than after the first complaint.
 *
 * Every line is reported individually. A silent count of "412 imported" over a
 * file where 90 lines were unparseable is the shape of a control that appears
 * to work: the operator would believe those 90 people are suppressed.
 *
 * @param entries [{ kind, value, channels?, reason? }]
 * @returns { added, updated, failed: [{ line, value, error }] }
 */
export async function importSuppressions(
  db,
  { entries = [], source = "import", adminId = null, reason = null } = {},
) {
  const result = { added: 0, updated: 0, failed: [] };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] || {};
    // Sequentially, not Promise.all: two lines carrying the same address would
    // race on the upsert, and one of them would come back a P2002 that reads
    // to the operator as "this address failed to import".
    const outcome = await suppress(db, {
      kind: entry.kind,
      value: entry.value,
      channels: Array.isArray(entry.channels) && entry.channels.length ? entry.channels : ALL_CHANNELS,
      source,
      reason: entry.reason ?? reason,
      requestedAt: entry.requestedAt ?? null,
      adminId,
    }).catch((err) => ({ ok: false, error: err?.message || "Failed to write." }));

    if (!outcome.ok) {
      result.failed.push({ line: i + 1, value: entry.value ?? null, error: outcome.error });
    } else if (outcome.action === "suppressed") {
      result.added++;
    } else {
      result.updated++;
    }
  }

  return result;
}

/**
 * Parse a pasted list into entries.
 *
 * Pure and deliberately forgiving about SHAPE while strict about VALUES: one
 * per line, optionally `kind,value`, optionally `value` alone with the kind
 * inferred from an "@". Inference is safe in exactly this one direction — an
 * address contains an "@" and neither a phone nor a domain can — and anything
 * ambiguous is returned as an error line rather than filed under a guess.
 */
export function parseSuppressionImport(text) {
  const entries = [];
  const errors = [];
  const lines = String(text ?? "").split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(",").map((p) => p.trim());
    let kind = null;
    let value = null;

    if (parts.length >= 2 && isSuppressionKind(parts[0].toLowerCase())) {
      kind = parts[0].toLowerCase();
      value = parts.slice(1).join(",").trim();
    } else {
      value = parts.join(",").trim();
      if (value.includes("@")) kind = "email";
      else if (/[0-9]/.test(value.replace(/[^0-9]/g, "")) && !/[a-z]/i.test(value)) kind = "phone";
      else kind = "domain";
    }

    if (!value) {
      errors.push({ line: i + 1, raw: lines[i], error: "No value on this line." });
      continue;
    }
    if (!normaliseSuppressionValue(kind, value)) {
      errors.push({
        line: i + 1,
        raw: lines[i],
        error: `Couldn't read "${value.slice(0, 60)}" as ${kind}. Prefix the line with "email,", "phone," or "domain," to say which it is.`,
      });
      continue;
    }
    entries.push({ kind, value });
  }

  return { entries, errors };
}
