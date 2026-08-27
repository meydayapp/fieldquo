// app/api/quotes/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { normaliseMediaList } from "@/lib/media/validate";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  redactQuote,
} from "@/lib/permissions/enforce";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  reconcileScopeGroups,
  reconcileImportsForQuote,
} from "@/lib/quotes/importQuote";
import {
  onQuoteAccepted,
  onQuoteDeclined,
} from "@/lib/quotes/quoteLifecycle";
import {
  buildQuoteCostingRow,
  shouldWriteQuoteCosting,
  mayCost,
  requireCost,
} from "../costingWrite";
import { syncTakeoffAddOns } from "@/lib/quotes/takeoffAddOns";

export async function GET(request, { params }) {
  // Next 16: params is a Promise. Read synchronously it's undefined, so every
  // lookup on this route returned "not found".
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Refused before the row is read, not redacted after it. The list route is
  // gated the same way; a detail endpoint that answers what the list refuses is
  // the side door this sweep keeps finding.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_only",
    "see quotes",
  );
  if (denied) return denied;

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: {
      client: true,
      scopeGroups: {
        include: { category: true },
        orderBy: { sortOrder: "asc" },
      },
      addOns: { orderBy: { sortOrder: "asc" } },
      invoices: { select: { id: true, invoiceNumber: true, status: true } },
      // Just the billing currency, so the page can format money the way the
      // client's own document does. Without it the page falls back to CAD and
      // a US contractor's totals read as Canadian dollars — the same silent
      // default that put "$2100.00" on the document in the first place.
      company: { select: { currency: true } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Which scope groups came from an import — the editor renders these read-only
  // (the received cost is fixed; the markup is edited from the quote page). The
  // targetLineId of each import is the scope group id it created.
  const imports = await db.quoteImport.findMany({
    where: { targetQuoteId: id },
    select: { targetLineId: true },
  });
  const importedGroupIds = imports.map((i) => i.targetLineId);

  // Shaped by the same entry point the list route uses. GET /api/quotes has
  // been redacting for a while and this route wasn't, which made the
  // restriction cosmetic: the token and the client's email were one click away
  // on the detail endpoint. Redacting after the spread rather than before it so
  // importedGroupIds can't reintroduce a key the redactor just removed.
  return NextResponse.json(redactQuote(full, { ...quote, importedGroupIds }));
}

// Quotes are edited directly, not versioned — unlike invoices, there's no signed
// commitment yet before acceptance, so a straight PATCH is the right model.
export async function PATCH(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Hoisted out of the try because the response below is redacted with it too.
  // Re-querying the member for that would be a second round trip to learn
  // something already known.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "edit quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: {
      // Whether a cost row already exists decides what an EMPTY costing block
      // means, and the stored groups are what a costing re-price runs over
      // when the request is only changing a number on the totals bar.
      costing: { select: { id: true } },
      scopeGroups: {
        select: {
          id: true,
          categoryId: true,
          label: true,
          takeoff: true,
          // Read because a status-only PATCH rebuilds the cost row from these
          // groups (see `scopeGroups ?? existing.scopeGroups` below). Omitted,
          // accepting a quote re-costed it from no intake and wrote zeroes over
          // the figures it was priced at.
          intakeValues: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    status,
    subtotal,
    discount,
    tax,
    total,
    // Whether tax applies at all, as opposed to the tax AMOUNT.
    //
    // This was read in two places and written in none: the edit page restored
    // the checkbox from it and the public quote route consulted it, but no route
    // ever stored it, so it sat at its schema default of `true` forever. A
    // contractor who unticked "Apply tax", saved, and reopened the quote found
    // the box ticked again — and the next edit silently put the tax back on a
    // price they had deliberately set without it.
    taxEnabled,
    notes,
    // Internal — see the Quote.reviewNotes comment in the schema. Editable so
    // an estimator who has dealt with what the caller asked for can clear it;
    // a note nobody can tick off is a note people stop reading.
    reviewNotes,
    processNotes,
    validUntil,
    scopeGroups,
    clientPhotos,
    // The internal cost estimate. See the note below on why `undefined` and an
    // empty object have to mean different things here.
    costing,
  } = body;

  // Line-item edits are only valid while the quote is open. Editing scope groups
  // on a decided (accepted/declined) quote would rewrite what was agreed and —
  // through reconcileImportsForQuote below — could delete a subcontractor cost
  // already materialised into a job expense, silently corrupting job costing.
  // Status-only changes (accept/decline/send) carry no scopeGroups and are fine.
  if (scopeGroups && !["draft", "sent"].includes(existing.status)) {
    return NextResponse.json(
      { error: "This quote is already decided — its line items can't be changed." },
      { status: 400 },
    );
  }

  const scalarData = {
    ...(status !== undefined && {
      status,
      ...(status === "sent" && { sentAt: new Date() }),
    }),
    ...(subtotal !== undefined && { subtotal }),
    ...(discount !== undefined && { discount }),
    ...(tax !== undefined && { tax }),
    ...(total !== undefined && { total }),
    ...(taxEnabled !== undefined && { taxEnabled: Boolean(taxEnabled) }),
    ...(notes !== undefined && { notes }),
    ...(reviewNotes !== undefined && { reviewNotes }),
    ...(processNotes !== undefined && { processNotes }),
    ...(validUntil !== undefined && {
      validUntil: validUntil ? new Date(validUntil) : null,
    }),
    // Re-sanitised on every save, not just on create — an edit is just as much
    // a browser-supplied list as the original was.
    ...(clientPhotos !== undefined && {
      clientPhotos: normaliseMediaList(clientPhotos),
    }),
  };

  try {
    // A costing block from someone without the toggle used to be dropped right
    // below and the save answered 200 — the panel's contents gone, nothing
    // said. See requireCost: silence stays silence, an actual block is
    // refused.
    if (costing !== undefined) requireCost(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // ── What happens to the cost estimate ────────────────────────────────────
  //
  // `undefined` means the request said NOTHING about costing, which is not the
  // same as sending an empty one. Most PATCHes to this route are a status
  // change — accept, decline, send — and every one of them would otherwise
  // wipe the crew, the hours and the margin the quote was priced at. The
  // invoice route documents the same trap; it is worse here, because
  // "accepted" is precisely the moment the estimate becomes worth keeping.
  //
  // An empty block over an EXISTING row is different: that is somebody
  // clearing the panel, and refusing it would be a Save button that doesn't.
  //
  // Costed against the pre-tax subtotal minus discount, falling back to what
  // the quote already carries so a re-save of the panel alone doesn't reprice
  // it against 0.
  const costingRow =
    costing !== undefined && mayCost(full)
      ? await buildQuoteCostingRow({
          companyId: member.companyId,
          costing,
          price:
            (subtotal !== undefined
              ? Number(subtotal) || 0
              : Number(existing.subtotal) || 0) -
            (discount !== undefined
              ? Number(discount) || 0
              : Number(existing.discount) || 0),
          // The groups being saved, or the ones already stored when this PATCH
          // isn't touching them. Either way the estimate runs over the scope
          // that will exist after this request, never over a stale one.
          scopeGroups: scopeGroups ?? existing.scopeGroups,
        })
      : null;

  // Scope groups are reconciled by id rather than wiped and recreated: an editor
  // save used to regenerate every group id, which silently orphaned a
  // QuoteImport's targetLineId (breaking its Remove control). Preserving ids
  // keeps the linkage valid, and reconcileImportsForQuote then drops any import
  // whose group the GC deleted — so a removed subcontractor line can't leave a
  // dangling "imported" state on the sub's side. One transaction so a partial
  // write can't leave groups and imports disagreeing.
  const updated = await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id },
      data: {
        ...scalarData,
        // Upsert: the panel is often filled in long after the quote was first
        // saved, so there is frequently no row to update yet.
        //
        // shouldWriteQuoteCosting holds the three-case rule, including the one
        // that matters most here — a PATCH that said nothing about costing
        // leaves the existing row exactly where it was.
        ...(shouldWriteQuoteCosting({
          costingSent: costing !== undefined,
          may: mayCost(full),
          hasExistingRow: Boolean(existing.costing),
          row: costingRow,
        }) && {
          costing: { upsert: { create: costingRow, update: costingRow } },
        }),
      },
    });
    if (scopeGroups) {
      await reconcileScopeGroups(tx, id, scopeGroups);
      await reconcileImportsForQuote(tx, id);
    }
    return tx.quote.findUnique({
      where: { id },
      include: { client: true, scopeGroups: { include: { category: true } } },
    });
  });

  // The takeoff's optional scope, rewritten to match what was just saved. A
  // takeoff-sourced add-on is a VIEW of the takeoff, so editing the room has to
  // move the offer — otherwise the client ticks a price for work the scope no
  // longer describes. Manual and AI extras are untouched; see
  // lib/quotes/takeoffAddOns.js. Outside the transaction and best-effort, on
  // the same contract as the post-decision hooks below: the scope has
  // committed, and a hiccup here must not report the save as failed.
  if (scopeGroups) {
    try {
      await syncTakeoffAddOns({
        companyId: member.companyId,
        quoteId: id,
        scopeGroups,
      });
    } catch (err) {
      console.error("[quotes PATCH] takeoff add-ons:", err?.message);
    }
  }

  // A decision recorded in the back office has to set the same things in motion
  // as the identical decision clicked by the client on the public link — a job
  // to schedule, a draft invoice to bill, a task to diary, and the lead behind
  // it moved on. Until this was here, "They approved" on the quote-approval
  // screen changed one word and left the pipeline dead: no job, no invoice, and
  // a lead still sitting in the column it started in.
  //
  // Only on an actual TRANSITION — re-saving notes on an already-accepted quote
  // must not re-run any of it. Best-effort by the shared contract: the status
  // change above has committed, and a hiccup here must not report it as failed.
  if (status !== undefined && status !== existing.status) {
    try {
      if (status === "accepted") {
        const { job, invoice } = await onQuoteAccepted(id, {
          createdById: member.userId,
        });
        await recordActivity(member, {
          action: "quote.accepted",
          entityType: "quote",
          entityId: id,
          summary: `Quote ${existing.quoteNumber} marked accepted${job ? " — job created, ready to schedule" : ""}${invoice ? `, invoice ${invoice.invoiceNumber} drafted` : ""}`,
          metadata: { jobId: job?.id || null, invoiceId: invoice?.id || null },
        });
      } else if (status === "declined") {
        // The reason is optional and free text — a required dropdown collects
        // whatever is nearest the cursor, which is worse than nothing.
        await onQuoteDeclined(id, { reason: body?.declineReason || null });
        await recordActivity(member, {
          action: "quote.declined",
          entityType: "quote",
          entityId: id,
          summary: `Quote ${existing.quoteNumber} marked declined`,
        });
      }
    } catch (err) {
      console.error("[quotes PATCH] post-decision hooks:", err?.message);
    }
  }

  // Redacted as well as GET. The share token passes through here by definition
  // — this handler already required view_create_edit, which is exactly what
  // redactShareToken gates on — but `include: { client: true }` is a whole
  // client row, so an editor restricted to name_address_only would otherwise
  // read the email back out of their own save. Making the save response differ
  // from the GET would also leave the page holding fields it can't refetch.
  return NextResponse.json(redactQuote(full, updated));
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Delete is a distinct level above edit — someone trusted to revise a quote
  // isn't automatically trusted to make it disappear.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit_delete", "delete quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: { invoices: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.invoices.length > 0) {
    return NextResponse.json(
      {
        // Was "Cannot delete a quote that has an invoice" — true, and it left
        // the reader to work out both why and what to do instead. A quote that
        // reached an invoice is an accounting record; the honest alternative
        // is to void the invoice or mark the quote declined, and saying so
        // beats a refusal that reads like a malfunction.
        error:
          `This quote has already become invoice ${existing.invoices[0].invoiceNumber || ""}`.trim() +
          ", so it can't be deleted — it's part of your billing record now. " +
          "Delete or void the invoice first if you really need it gone.",
      },
      { status: 409 },
    );
  }

  await db.quote.delete({ where: { id } });
  await recordActivity(member, {
    action: "quote.deleted",
    entityType: "quote",
    entityId: id,
    summary: `Deleted quote ${existing.quoteNumber}`,
    metadata: { total: existing.total },
  });
  return NextResponse.json({ success: true });
}
