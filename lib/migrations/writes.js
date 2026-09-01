// lib/migrations/writes.js
//
// The ONLY functions in this codebase that let a superadmin create rows
// inside a company's own tenant data. This is the sanctioned exception to
// non-negotiable #3 the owner asked for, and everything about this file is
// written to keep the exception as narrow as the brief demanded:
//
//   * CREATE only. Nothing here updates or deletes a row that already
//     existed — a migrated Client or Quote is a brand-new row, and every
//     write here is a straight `create`, never an `update`/`upsert` against
//     an id the caller supplies. A superadmin cannot use this path to touch
//     a quote the company already had.
//   * Gated on the state machine, re-checked HERE against a value read fresh
//     inside the same transaction — never trusted from a caller who read the
//     status a request ago. See lib/migrations/state.js's canWrite().
//   * Every write is wrapped with exactly one MigrationWrite row, in the SAME
//     transaction as the write it describes, so "the write happened" and
//     "the write is logged" can never come apart. That row is the audit
//     trail the brief requires — who (platformAdminId), when (createdAt),
//     which migration (migrationRequestId), what changed (entityType,
//     entityId, snapshot).
//
// ── Why Client and Quote, and not Invoice/Job yet ───────────────────────────
//
// The owner's brief named quotes, invoices and jobs. Client and Quote are the
// two that can be created with a handful of scalar fields and no dependency
// on data this feature doesn't otherwise create — an Invoice needs a Job or a
// Quote to mirror (AGENTS.md: "invoices mirror quotes"), and a Job carries
// scheduling, materials and costing that a hand-entered legacy record has no
// honest values for. Building a half-populated Invoice/Job would be exactly
// the "control that appears to work and doesn't" AGENTS.md warns about — see
// docs/MIGRATION-SERVICE.md for what's next.
import { db } from "@/lib/db";
import { canWrite, assertWritable } from "@/lib/migrations/state";
import { nextQuoteNumberForCompany } from "@/lib/quotes/quoteNumber";

/**
 * Re-reads the MigrationRequest fresh and throws unless a write is legal
 * right now. Every write function below calls this FIRST, inside its own
 * transaction, rather than trusting a status the route handler read earlier
 * in the request — the two are usually the same query apart, but "usually"
 * is not the guarantee this file exists to make.
 */
async function loadWritableMigration(tx, migrationRequestId, companyId) {
  const migration = await tx.migrationRequest.findUnique({
    where: { id: migrationRequestId },
  });
  if (!migration || migration.companyId !== companyId) {
    const err = new Error("No such migration for this company.");
    err.status = 404;
    throw err;
  }
  assertWritable(migration.status);
  return migration;
}

/**
 * Create a Client row inside `companyId`, attributed to `migrationRequestId`.
 *
 * @param {object} input  { name, type, contactName, email, phone, address,
 *                           city, province, country, notes, language }
 *                         Only `name` is required — same as the Client model
 *                         itself, so a sparse legacy record (a name and a
 *                         phone number scrawled on an invoice) is still a
 *                         real, usable row rather than one padded with
 *                         invented values (AGENTS.md failure class #5).
 */
export async function writeMigratedClient({
  migrationRequestId,
  companyId,
  platformAdminId,
  input,
}) {
  const name = String(input?.name || "").trim();
  if (!name) {
    const err = new Error("A client needs a name.");
    err.status = 400;
    throw err;
  }

  return db.$transaction(async (tx) => {
    await loadWritableMigration(tx, migrationRequestId, companyId);

    const client = await tx.client.create({
      data: {
        companyId,
        name,
        type: input?.type === "company" ? "company" : "individual",
        contactName: str(input?.contactName),
        email: str(input?.email),
        phone: str(input?.phone),
        address: str(input?.address),
        city: str(input?.city),
        province: str(input?.province),
        country: str(input?.country),
        notes: str(input?.notes),
        language: str(input?.language),
      },
    });

    await tx.migrationWrite.create({
      data: {
        migrationRequestId,
        platformAdminId,
        entityType: "Client",
        entityId: client.id,
        snapshot: client,
      },
    });

    // First write on a freshly-paid migration advances it to `in_progress`
    // automatically — see lib/migrations/state.js: paid and in_progress are
    // both writable, so this is a courtesy status change, not a gate. A
    // superadmin never has to remember a separate "start" button before
    // their first real write.
    await tx.migrationRequest.updateMany({
      where: { id: migrationRequestId, status: "paid" },
      data: { status: "in_progress", startedAt: new Date() },
    });

    return client;
  });
}

/**
 * Create a Quote row inside `companyId`, attributed to `migrationRequestId`.
 * Deliberately minimal — no scope groups, no costing, no line items beyond a
 * single free-text description on `notes`, mirroring what a superadmin can
 * actually read off a paper quote or a QuickBooks line: what it was for and
 * what it totalled. `status` is always `draft`: this path creates a RECORD of
 * historical work, not a live document sent to a client, and nothing here
 * should be mistaken for one — a migrated quote reaching a client's inbox
 * would be FieldQuo re-sending something on the company's behalf without
 * being asked to, which is a different feature this one is not.
 */
export async function writeMigratedQuote({
  migrationRequestId,
  companyId,
  platformAdminId,
  input,
}) {
  const clientId = String(input?.clientId || "").trim();
  if (!clientId) {
    const err = new Error("A quote needs a client.");
    err.status = 400;
    throw err;
  }
  const totalCents = Number(input?.totalCents);
  if (!Number.isFinite(totalCents) || totalCents < 0) {
    const err = new Error("Enter a total for this quote (0 or more).");
    err.status = 400;
    throw err;
  }

  return db.$transaction(async (tx) => {
    await loadWritableMigration(tx, migrationRequestId, companyId);

    // The client must belong to THIS company — including one just created by
    // this same migration a moment ago, but never a client from anywhere
    // else. Prisma's FK alone would refuse a bogus id; this refuses a real
    // id that belongs to the wrong tenant, which the FK cannot see.
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, companyId: true },
    });
    if (!client || client.companyId !== companyId) {
      const err = new Error("That client isn't part of this company.");
      err.status = 400;
      throw err;
    }

    const quoteNumber = await nextQuoteNumberForCompany(tx, companyId);
    const total = (totalCents / 100).toFixed(2);

    const quote = await tx.quote.create({
      data: {
        companyId,
        clientId,
        quoteNumber,
        status: "draft",
        subtotal: total,
        total,
        taxEnabled: false, // a historical total, not a re-priced document — see the header
        notes: str(input?.description),
        // What this record actually is, for anyone who opens it later —
        // reviewNotes is the internal-only field (never rendered to a
        // client, see the Quote model's own comment), which is exactly
        // where "this is a migrated record, not a live quote" belongs.
        reviewNotes: `Migrated from prior records by FieldQuo (migration ${migrationRequestId}).`,
      },
    });

    await tx.migrationWrite.create({
      data: {
        migrationRequestId,
        platformAdminId,
        entityType: "Quote",
        entityId: quote.id,
        snapshot: quote,
      },
    });

    await tx.migrationRequest.updateMany({
      where: { id: migrationRequestId, status: "paid" },
      data: { status: "in_progress", startedAt: new Date() },
    });

    return quote;
  });
}

function str(v) {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

// Re-exported so route handlers that only need the gate (e.g. a read screen
// deciding whether to show the "add a record" forms at all) don't have to
// import two modules for one question.
export { canWrite };
