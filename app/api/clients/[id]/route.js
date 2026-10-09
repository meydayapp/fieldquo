// app/api/clients/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  redactClient,
  redactQuotes,
  redactInvoices,
  redactJobs,
  hasLevel,
  assignedJobWhere,
  assignedClientWhere,
} from "@/lib/permissions/enforce";
import { textsForClient } from "@/lib/sms/deliveryStore";
import { isSupported } from "@/app/i18n/languages";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { cleanAddressPart } from "@/lib/format/address";
import { emailRefusal, cleanEmail } from "@/lib/validation";
import { identityChanges, loadClientUsage, editScopeRefusal } from "@/lib/clients/editScope";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Loaded first now: WHICH client, and which of its documents ride along,
  // both depend on the grid.
  const full = await loadEnforceableMember(db, member.id);

  // ── The documents follow their own dials, not the client's ───────────────
  //
  // This include used to be unconditional, so a Crew member (quotes: none,
  // invoices: none, jobs scoped to their own) opened a client and read every
  // quote and invoice the household had ever had — titles, line descriptions,
  // statuses — and every job, assigned to them or not. The money was stripped
  // by redactQuotes/redactInvoices; the documents themselves were the leak.
  // A dial at `none` means the list is not sent (an empty list would state
  // "this client has no quotes"), and the job list is the same assigned-only
  // list GET /api/jobs gives them. The client itself is scoped the same way
  // (assignedClientWhere): a crew member reaches the households they are
  // sent to, not the client book.
  const client = await db.client.findFirst({
    where: { id: id, companyId: member.companyId, ...assignedClientWhere(full) },
    include: {
      ...(hasLevel(full, "quotes", "view_only") && { quotes: { orderBy: { createdAt: "desc" } } }),
      ...(hasLevel(full, "invoices", "view_only") && { invoices: { orderBy: { createdAt: "desc" } } }),
      ...(hasLevel(full, "jobs", "view_only") && {
        jobs: { where: assignedJobWhere(full), orderBy: { createdAt: "desc" } },
      }),
    },
  });

  if (!client)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── The list redacted; this didn't ─────────────────────────────────────
  //
  // GET /api/clients runs every row through redactClients, so a member on
  // clientsProperties "name_address_only" sees a name and an address. This
  // route returned the raw row: contactName, email, phone, notes, portalToken
  // and language. QA enumerated ids from the restricted list and pulled each
  // detail — the exportable-customer-list exposure, reached through the one
  // door that wasn't checked.
  //
  // The nested quotes carry shareToken as well, which opens the priced public
  // page with no credential at all, so they go through redactQuotes rather
  // than being handed over whole.
  //
  // ── And the invoices, which that fix walked straight past ───────────────
  //
  // Half the job got done: `quotes` was redacted and `invoices` — the same
  // shape, the same money, sitting on the next line — was handed over whole.
  // QA read "INV-0009 $7,645" and "INV-0003 $6,650" off this client page as a
  // member with showPricing:false, and an invoice is the harder number of the
  // two: it is what the household actually owes, and it carries amountPaid and
  // amountDue as well as the total.
  //
  // This is why redactInvoice exists next to redactQuote rather than being
  // spelled out per route — invoices mirror quotes (AGENTS.md on
  // lib/documentSections), and their redaction is not a lesser version of it.

  // ── The texts this client was sent, and whether they arrived ────────────
  //
  // Booking confirmations, reminders, on-my-way and change-order texts
  // (model SmsDelivery). Only for a member who may see the client's phone —
  // the list is about that number, masked to its last four even so — and
  // `null` (no panel) rather than [] for anyone else, because "no texts"
  // would be a statement this member has no grounds to be shown.
  const texts = hasLevel(full, "clientsProperties", "full_view")
    ? await textsForClient(member.companyId, client.id).catch(() => null)
    : null;

  return NextResponse.json({
    ...redactClient(full, client),
    ...("quotes" in client && { quotes: redactQuotes(full, client.quotes) }),
    ...("invoices" in client && { invoices: redactInvoices(full, client.invoices) }),
    ...("jobs" in client && { jobs: redactJobs(full, client.jobs) }),
    // Which document lists were withheld by the grid, so the page can say so
    // instead of drawing "No quotes yet" for a client with ten.
    documentsHidden: ["quotes", "invoices", "jobs"].filter((k) => !(k in client)),
    texts,
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "clientsProperties", "full_edit", "edit clients");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.client.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    name,
    type,
    contactName,
    email,
    phone,
    address,
    city,
    province,
    country,
    postalCode,
    county,
    notes,
    language,
    // "Requires a PO number on invoices" (Client.requiresPo). A boolean or
    // nothing — anything else is ignored rather than read as true.
    requiresPo,
  } = body;

  // Editing a client's address is the moment a working one becomes a broken
  // one. An empty string is a deliberate clear and is allowed; anything else
  // that cannot be delivered to is refused with the fault named.
  const badEmail = email === undefined || email === "" ? null : emailRefusal(email);
  if (badEmail) return NextResponse.json(badEmail, { status: 400 });

  // The private notes are the Notes dial's, not the client dial's — see the
  // Notes section of lib/permissions/enforce.js. Refused when the request
  // would CHANGE them, rather than whenever the key is present: the edit form
  // omits the field below the level, but a member who never saw the notes
  // (redacted off the read) and posts the field anyway must not be able to
  // blank them, and must not have the change dropped on the floor either.
  // Judged against the row, not the key, so a form that echoes the notes it
  // was shown is not refused for repeating them.
  if (notes !== undefined && (notes ?? "") !== (existing.notes ?? "")) {
    try {
      const full = await loadEnforceableMember(db, member.id);
      requireLevel(full, "notes", "view_edit_all", "edit a client's notes");
    } catch (err) {
      const { body: errBody, status } = permissionErrorResponse(err);
      return NextResponse.json(errBody, { status });
    }
  }

  // ── An edit that reaches every record carrying this client ──────────────
  //
  // 2026-10-09: "Edit contact details" on a DUPLICATED draft rewrote this row,
  // and the accepted quote it was copied from — with its job, invoice and
  // appointment — began printing someone else's name, email and phone. A
  // client's identity (lib/clients/editScope.js IDENTITY_FIELDS) is shared by
  // every record that carries it, so changing it while any record does needs
  // the caller to say so: `scope: "everywhere"`. The client's own page sends
  // it (that page IS the client); a document's builder sends it only after
  // the person chose "Edit this client's details everywhere" with the count
  // in front of them. Anything else — including a tab still running the old
  // form — is refused with the records named, and nothing is written.
  const changes = identityChanges(existing, body);
  if (changes.length && body?.scope !== "everywhere") {
    const usage = await loadClientUsage(db, { companyId: member.companyId, clientId: id });
    const refusal = editScopeRefusal({ changes, usage, scope: body?.scope });
    if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  }

  const updated = await db.client.update({
    where: { id: id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && {
        type: type === "company" ? "company" : "individual",
        // Switching to individual clears any stale contact person.
        contactName: type === "company" ? contactName ?? existing.contactName : null,
      }),
      // Allow updating contactName on its own for an already-company client.
      ...(type === undefined &&
        contactName !== undefined && { contactName: contactName || null }),
      ...(email !== undefined && { email: cleanEmail(email) }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(province !== undefined && { province }),
      // "" clears it (the contractor removing a wrong country), while an
      // unparseable value writes null rather than storing junk the tax lookup
      // would later have to interpret.
      ...(country !== undefined && { country: normaliseCountry(country) }),
      ...(postalCode !== undefined && { postalCode: cleanAddressPart(postalCode) }),
      ...(county !== undefined && { county: cleanAddressPart(county) }),
      ...(notes !== undefined && { notes }),
      // "" clears it back to the company default; an unsupported code is
      // ignored rather than written, so a stale value from an older client
      // build can't quietly set a language nothing can render.
      ...(language !== undefined && {
        language: isSupported(language) ? language : null,
      }),
      ...(typeof requiresPo === "boolean" && { requiresPo }),
    },
  });

  // Client edits were unlogged — QA changed a client's email address and the
  // Activity Log recorded nothing, while the page states it keeps "clients or
  // quotes deleted, pricing and settings changes". An email or address change
  // decides where quotes and invoices are DELIVERED, so it belongs in the same
  // trail as the deletion below.
  //
  // Which fields changed, not their values: the log is visible to everyone who
  // can read it, and a client's old phone number does not need republishing
  // there. Contact details are also the fields most worth being able to ask
  // "who changed this and when" about.
  const changedFields = [
    ["name", name],
    ["contactName", contactName],
    ["email", email],
    ["phone", phone],
    ["address", address],
    ["city", city],
    ["province", province],
    ["country", country],
    ["postalCode", postalCode],
    ["county", county],
    ["language", language],
    ["requiresPo", typeof requiresPo === "boolean" ? requiresPo : undefined],
  ]
    .filter(([field, value]) => value !== undefined && value !== existing[field])
    .map(([field]) => field);

  if (changedFields.length) {
    await recordActivity(member, {
      action: "client.updated",
      entityType: "client",
      entityId: id,
      summary: `Edited ${updated.name} — changed ${changedFields.join(", ")}`,
      // Whether the identity change was confirmed as reaching every record
      // that carries this client — the trail the 2026-10-09 edit lacked.
      metadata: { fields: changedFields, ...(body?.scope === "everywhere" && { scope: "everywhere" }) },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(
      full,
      "clientsProperties",
      "full_edit_delete",
      "delete clients",
    );
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.client.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Guard: don't silently orphan financial records
  const [quoteCount, invoiceCount, jobCount] = await Promise.all([
    db.quote.count({ where: { clientId: id } }),
    db.invoice.count({ where: { clientId: id } }),
    db.job.count({ where: { clientId: id } }),
  ]);

  if (quoteCount > 0 || invoiceCount > 0 || jobCount > 0) {
    // ── Say what is in the way, and the order to clear it ─────────────────
    //
    // Was "Cannot delete a client with existing quotes or invoices", which
    // left the owner (2026-10-05, clearing his test clients) to work out
    // which, how many, and in what order. Invoices first: a quote that became
    // an invoice refuses until the invoice is gone, and an invoice with a
    // payment refuses until that payment is voided (recorded by hand) or
    // refunded. Jobs are counted too — Job.client is a required relation, so
    // a client with a job would otherwise reach the delete below and fail
    // there as a 500 instead of a sentence.
    const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
    const parts = [
      invoiceCount ? n(invoiceCount, "invoice", "invoices") : null,
      jobCount ? n(jobCount, "job", "jobs") : null,
      quoteCount ? n(quoteCount, "quote", "quotes") : null,
    ].filter(Boolean);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    return NextResponse.json(
      {
        error:
          `${existing.name} still has ${list}, so the client can't be deleted yet. ` +
          `Delete them first, from each one's own page — invoices first, then jobs, then quotes. ` +
          `An invoice with a payment recorded by hand needs that payment voided (owner or admin, under Payment History) before it can go; ` +
          `a card payment can't be voided and keeps the invoice. Then delete the client.`,
        code: "client_has_records",
        counts: { invoices: invoiceCount, jobs: jobCount, quotes: quoteCount },
      },
      { status: 409 },
    );
  }

  await db.client.delete({ where: { id: id } });
  await recordActivity(member, {
    action: "client.deleted",
    entityType: "client",
    entityId: id,
    summary: `Deleted client ${existing.name}`,
  });
  return NextResponse.json({ success: true });
}
