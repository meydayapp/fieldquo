// app/api/quotes/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { readTaxResolution, resolutionMatchesAmount, manualTaxResolution } from "@/lib/tax/taxResolution";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can, permissionDenialMessage } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { normaliseMediaList } from "@/lib/media/validate";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  redactQuote,
} from "@/lib/permissions/enforce";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import {
  reconcileScopeGroups,
  reconcileImportsForQuote,
} from "@/lib/quotes/importQuote";
import {
  onQuoteAccepted,
  onQuoteDeclined,
  onQuoteSent,
} from "@/lib/quotes/quoteLifecycle";
import {
  buildQuoteCostingRow,
  shouldWriteQuoteCosting,
  mayCost,
  requireCost,
} from "../costingWrite";
import { syncTakeoffAddOns } from "@/lib/quotes/takeoffAddOns";
import { shareTokenData } from "@/lib/quotes/shareToken";
import { withCapturedMeasureImages } from "@/lib/measure/measureImages";
import { normaliseSiteAddress } from "@/lib/geo/geocodeJob";
import { offlineDiscountPctFor } from "@/lib/payments/offlineDiscount";
import { canUseKitchenDesigner } from "@/lib/kitchen/access";
import { linkInstantVisits } from "@/lib/quotes/linkInstantVisits";
import {
  parseExpectedVersion,
  versionWhere,
  runGuardedWrite,
  settleGuardedWrite,
} from "@/lib/concurrency/staleWrite";

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
      company: {
        select: {
          currency: true,
          // ── So the "call this client" button is never a dead control ─────
          //
          // The page runs manualQuoteCallGate itself and only draws the button
          // when it would work. Without this field the gate could not see the
          // company's outbound master switch, so it assumed ON — and a company
          // that had deliberately switched outbound calling off got a button
          // that refused with a 409 every time. One field turns the last
          // foreseeable refusal into a sentence explaining where the switch is.
          outboundCallsEnabled: true,
        },
      },
      assignedTo: { select: { id: true, name: true } },
      // The on-site measures scheduled from this quote — Appointment rows
      // with quoteId set (lib/quotes/siteVisit.js). Oldest first, so the
      // panel reads as the story of the visits; cancelled rows are kept
      // because a called-off measure is a fact about the quote, the same
      // reason the calendar keeps them. Only the assignee's name rides
      // along: the client is already on the quote, redacted below.
      appointments: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          location: true,
          notes: true,
          cancelReason: true,
          assignedToId: true,
          assignedTo: { select: { id: true, name: true } },
        },
      },
      // The job this quote became, if it has. One per quote in practice
      // (ensureJobForAcceptedQuote's own lock), but the relation is a list —
      // see that file for why it was left one — so the first is taken.
      jobs: { select: { id: true, title: true }, take: 1 },
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── The visit the homeowner booked off this estimate ─────────────────────
  //
  // An instant-estimate draft's visit was written to the calendar with the
  // quote's id on the Booking row and NOT on the Appointment row this include
  // reads, so the panel below said "No visit scheduled yet" under a visit that
  // was on the calendar. The creators now write it; this attaches the rows
  // written before they did — the verified booking, and a visit booked for
  // the same client within a day of the draft — and re-reads the list only
  // when something changed. Idempotent, drafts only, see the module.
  if (quote.autoEstimated) {
    try {
      const linked = await linkInstantVisits(db, quote);
      if (linked > 0) {
        quote.appointments = await db.appointment.findMany({
          where: { quoteId: quote.id },
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            location: true,
            notes: true,
            cancelReason: true,
            assignedToId: true,
            assignedTo: { select: { id: true, name: true } },
          },
        });
      }
    } catch (err) {
      // The read is the thing that matters; a failed repair shows the old
      // list, which is what the page showed before this existed.
      console.error("[quotes GET] link instant visits:", err?.message);
    }
  }

  // Which scope groups came from an import — the editor renders these read-only
  // (the received cost is fixed; the markup is edited from the quote page). The
  // targetLineId of each import is the scope group id it created.
  const imports = await db.quoteImport.findMany({
    where: { targetQuoteId: id },
    select: { targetLineId: true },
  });
  const importedGroupIds = imports.map((i) => i.targetLineId);

  // Computed here, once, from the company's actual CompanyServiceCategory
  // rows — not re-derived client-side from a regex over this quote's own
  // scope groups, which is what let a company selling only countertops see
  // "Kitchen Designer" on every countertop quote. See lib/kitchen/access.js.
  const canOpenKitchenDesigner = await canUseKitchenDesigner(quote, member.companyId);

  // The automated chases the cron sent for this quote, from FollowUpLog — the
  // same rows that stop a rule sending twice — so the trail on the quote page
  // prints "Follow-up sent (day 7)" from the record of the send, not from a
  // counter. Scoped through the rule's company: a log row is keyed only by the
  // entity id, and the join is what keeps another tenant's rule out.
  const automatedFollowUps = await db.followUpLog.findMany({
    where: { entityType: "quote", entityId: quote.id, rule: { companyId: member.companyId } },
    orderBy: { sentAt: "asc" },
    select: {
      sentAt: true,
      rule: { select: { name: true, builtInKey: true, delayValue: true, delayUnit: true } },
    },
  });

  // Shaped by the same entry point the list route uses. GET /api/quotes has
  // been redacting for a while and this route wasn't, which made the
  // restriction cosmetic: the token and the client's email were one click away
  // on the detail endpoint. Redacting after the spread rather than before it so
  // importedGroupIds can't reintroduce a key the redactor just removed.
  return NextResponse.json(
    redactQuote(full, { ...quote, importedGroupIds, canOpenKitchenDesigner, automatedFollowUps }),
  );
}

// Quotes are edited directly, not versioned — unlike invoices, there's no signed
// commitment yet before acceptance, so a straight PATCH is the right model.
//
// That reasoning is about VERSION HISTORY and it still holds. It was silent on
// CONCURRENT WRITERS, which is a different problem and the one that was
// actually losing work: an estimator prices a quote in a driveway while the
// owner reviews the same quote in the office, and whoever saves second wipes
// the other silently. The quote is the document in this product most worth
// money, so it is the first to carry the stale-write guard — see
// lib/concurrency/staleWrite.js. Callers that send no expectedUpdatedAt are
// unaffected.
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
      // The client's kind decides whether a blank job address is allowed.
      client: { select: { type: true } },
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
    // Where the work is — editable on every save; required for a company
    // client (checked below against the client's kind, the same gate POST
    // runs). See Quote.siteAddress.
    siteAddress,
    scopeGroups: rawScopeGroups,
    clientPhotos,
    // The internal cost estimate. See the note below on why `undefined` and an
    // empty object have to mean different things here.
    costing,
    // Who's working the quote now. `undefined` leaves it exactly where it
    // was — a status-only PATCH (accept/decline/send) must not silently
    // unassign a quote a colleague is already carrying.
    assignedToId,
  } = body;

  // The satellite still behind a measured group, captured to Cloudinary
  // before anything is written — outside any transaction, because it is a
  // network round trip and best-effort (lib/measure/measureImages.js). A
  // roof panel or a lawn trace hands in a Static Maps `sourceUrl`; the
  // document prints only our copy.
  const scopeGroups = Array.isArray(rawScopeGroups)
    ? await withCapturedMeasureImages(rawScopeGroups, { companyId: member.companyId })
    : rawScopeGroups;

  // The version the browser is editing FROM. Absent means this caller doesn't
  // participate and the save behaves exactly as it did before the guard
  // existed; unreadable is a 400, never a silent downgrade to unguarded.
  let expected = null;
  try {
    expected = parseExpectedVersion(body?.expectedUpdatedAt);
  } catch (err) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status || 400 },
    );
  }

  // Reassigning to someone else requires quote:assign, same as create. Taking
  // it for yourself, or clearing it, doesn't.
  if (
    assignedToId !== undefined &&
    assignedToId &&
    assignedToId !== member.userId &&
    !can(member.role, "quote:assign")
  ) {
    return NextResponse.json(
      { error: permissionDenialMessage("quote:assign") },
      { status: 403 },
    );
  }
  if (assignedToId) {
    const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
      assignedToId,
    });
    if (notOurs) return notOurs;
  }

  // A company client's quote must name the site — see POST /api/quotes. Only
  // checked when the address is being written: a status-only PATCH on an
  // old quote with no address must still go through.
  const siteAddressValue = siteAddress === undefined ? undefined : normaliseSiteAddress(siteAddress);
  if (siteAddressValue === null && existing.client?.type === "company") {
    return NextResponse.json(
      { error: "A job address is required for a company client — their own address is an office, not the site." },
      { status: 400 },
    );
  }

  // ── The e-transfer / cheque offer, re-frozen while still a draft ────────
  //
  // A builder save (one that carries scopeGroups) on a DRAFT re-reads the
  // company's switch, so turning the offer on then finishing a draft puts
  // it on that draft. Once sent, the quote keeps what it offered: the
  // client is deciding on a document, not on a setting.
  let offlineDiscountPct;
  if (scopeGroups && existing.status === "draft") {
    const companyOffer = await db.company.findUnique({
      where: { id: member.companyId },
      select: { country: true, address: true, province: true, paymentMethods: true, offlinePaymentDiscount: true },
    });
    offlineDiscountPct = offlineDiscountPctFor(companyOffer);
  }

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

  // ── Which status moves are real ──────────────────────────────────────────
  //
  // The column was written with whatever arrived. Two of the moves a browser
  // can name are not decisions anyone is entitled to make from here:
  //
  //   • Leaving `accepted`. onQuoteAccepted created a job and, with a payment
  //     schedule, a deposit invoice — records with their own lives now. A
  //     status flip back would leave both standing against a quote that says
  //     nobody agreed to them. Cancel the job; the quote stays what it was.
  //   • Deciding a `draft`. A client cannot accept or decline a quote nobody
  //     has shown them; the approval page greys these out for a draft and
  //     the route now says the same thing, because a greyed button is not
  //     access control.
  //
  // One move that IS real and had no door: `declined` → `sent`, the reopen.
  // A client who said no in June and calls back in September has a quote
  // that is live again. It clears the decision so a second decline stamps
  // afresh (stampDecision writes only into a null column), and it does NOT
  // re-stamp sentAt — the quote was issued when it was issued.
  const reopening = status === "sent" && existing.status === "declined";
  if (status !== undefined && status !== existing.status) {
    if (!["draft", "sent", "accepted", "declined"].includes(status)) {
      return NextResponse.json({ error: "Unknown quote status." }, { status: 400 });
    }
    if (existing.status === "accepted") {
      return NextResponse.json(
        {
          error:
            "This quote was accepted and a job came from it, so it can't be reopened or declined here. " +
            "Cancel the job instead; the quote stays as the record of what was agreed.",
        },
        { status: 409 },
      );
    }
    if (existing.status === "draft" && (status === "accepted" || status === "declined")) {
      return NextResponse.json(
        { error: "Send the quote first — a client can't accept or decline a quote they haven't seen." },
        { status: 400 },
      );
    }
  }

  const scalarData = {
    // ── The client's link, lazily ────────────────────────────────────────
    //
    // Quotes created before the token moved to save-time (and those created by
    // the paths that don't mint one — an instant estimate, a converted lead, a
    // duplicate) have no link yet. Rather than a migration script over every
    // row in the product, each one picks its token up on its next save. Empty
    // object when there already is one, so a link already sitting in a
    // client's inbox is never rewritten by an edit: see shareTokenData.
    ...shareTokenData(existing.shareToken),
    ...(status !== undefined && {
      status,
      ...(status === "sent" && !reopening && { sentAt: new Date() }),
      ...(reopening && { declinedAt: null, declineReason: null }),
    }),
    ...(subtotal !== undefined && { subtotal }),
    ...(discount !== undefined && { discount }),
    ...(tax !== undefined && { tax }),
    ...(total !== undefined && { total }),
    ...(taxEnabled !== undefined && { taxEnabled: Boolean(taxEnabled) }),
    // An edit never re-resolves the jurisdiction — the quote keeps the rate it
    // was written with. But if the money on the tax line changed to a figure
    // the stored record no longer explains, the record must not keep saying
    // "8.875% New York sales tax" under a 7% figure: it becomes "typed by
    // hand" at the new rate, or nothing when tax was switched off.
    ...(tax !== undefined || subtotal !== undefined || discount !== undefined || taxEnabled !== undefined
      ? (() => {
          const on = taxEnabled !== undefined ? Boolean(taxEnabled) : existing.taxEnabled !== false;
          if (!on) return { taxResolution: Prisma.DbNull };
          const amount = Number(tax !== undefined ? tax : existing.tax) || 0;
          const base =
            (Number(subtotal !== undefined ? subtotal : existing.subtotal) || 0) -
            (Number(discount !== undefined ? discount : existing.discount) || 0);
          const kept = readTaxResolution(existing.taxResolution);
          if (kept && resolutionMatchesAmount(kept, amount, base)) return {};
          if (base <= 0) return {};
          return { taxResolution: manualTaxResolution((amount / base) * 100) ?? Prisma.DbNull };
        })()
      : {}),
    ...(notes !== undefined && { notes }),
    ...(reviewNotes !== undefined && { reviewNotes }),
    ...(processNotes !== undefined && { processNotes }),
    ...(siteAddressValue !== undefined && { siteAddress: siteAddressValue }),
    ...(offlineDiscountPct !== undefined && { offlineDiscountPct }),
    ...(validUntil !== undefined && {
      validUntil: validUntil ? new Date(validUntil) : null,
    }),
    ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
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
  //
  // ── Where the stale-write guard sits ────────────────────────────────────
  //
  // Inside the WHERE of the real write, not in an `if` above it. An `if` has a
  // window between reading the version and writing over it, which is precisely
  // the race being closed; the codebase's existing claims (the review-request
  // cron, lib/migrations/payment.js) put their guard in the where for the same
  // reason. Prisma raises P2025 when nothing matches, and runGuardedWrite
  // re-reads to tell "a colleague saved first" apart from "this write failed
  // for some unrelated reason" before it blames anybody.
  //
  // Inside the transaction, so a lost race rolls the scope groups and the
  // costing row back with it rather than leaving half a save behind.
  const outcome = await runGuardedWrite({
    expected,
    readVersion: () =>
      db.quote.findFirst({
        where: { id, companyId: member.companyId },
        select: { updatedAt: true },
      }),
    write: () => db.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id, ...versionWhere(expected) },
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
        include: {
          client: true,
          scopeGroups: { include: { category: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });
    }),
  });

  // Refusals first: a 409 here means the write never happened, so nothing
  // below it (the takeoff sync, the post-decision hooks) may run.
  const refusal = await settleGuardedWrite(outcome, {
    client: db,
    companyId: member.companyId,
    entityType: "quote",
    entityId: id,
    label: "quote",
    expected,
    member,
    // The version this save PRODUCED, so the next conflict can prove it was
    // this person who produced it. See the RecordEdit model comment.
    versionAt: outcome.result?.updatedAt,
  });
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const updated = outcome.result;

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
      // Named in the summary, not only in the actor column: "marked accepted
      // by Dana" on the activity feed is the sentence the owner reads when a
      // job appears that no client clicked for.
      const actor = await db.user.findUnique({
        where: { id: member.userId },
        select: { name: true, email: true },
      });
      const by = actor?.name || actor?.email || "a team member";
      if (status === "accepted") {
        const { job, invoice } = await onQuoteAccepted(id, {
          createdById: member.userId,
        });
        await recordActivity(member, {
          action: "quote.accepted",
          entityType: "quote",
          entityId: id,
          summary: `Quote ${existing.quoteNumber} marked accepted by ${by}${job ? " — job created, ready to schedule" : ""}${invoice ? `, invoice ${invoice.invoiceNumber} drafted` : ""}`,
          metadata: { jobId: job?.id || null, invoiceId: invoice?.id || null },
        });
      } else if (status === "declined") {
        // The reason is optional and free text — a required dropdown collects
        // whatever is nearest the cursor, which is worse than nothing.
        const reason = typeof body?.declineReason === "string" ? body.declineReason.trim().slice(0, 500) : "";
        await onQuoteDeclined(id, { reason: reason || null });
        await recordActivity(member, {
          action: "quote.declined",
          entityType: "quote",
          entityId: id,
          summary: `Quote ${existing.quoteNumber} marked declined by ${by}${reason ? ` — ${reason}` : ""}`,
        });
      } else if (reopening) {
        await onQuoteSent(id);
        await recordActivity(member, {
          action: "quote.reopened",
          entityType: "quote",
          entityId: id,
          summary: `Quote ${existing.quoteNumber} reopened by ${by} — the client is reconsidering`,
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
