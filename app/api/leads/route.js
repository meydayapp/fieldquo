// app/api/leads/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  loadEnforceableMember,
  requireLevel,
  redactLeads,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  isValidLeadStatus,
  canSetLeadStatus,
  isValidLostReason,
  LEAD_QUOTE_EVIDENCE_SELECT,
  quoteEvidence,
} from "@/lib/leads/pipeline";
import { canSeeMoney } from "@/lib/permissions/enforce";
import { potentialValueForLead } from "@/lib/leads/potentialValue";
import { loadScopePricing } from "@/lib/leads/scopeEstimate";
import { publicQualification } from "@/lib/leads/qualification";
import { followUpsForThreads } from "@/lib/leads/followUpTask";
import { inferLeadQuotes } from "@/lib/analytics/campaignRollupData";
import { createScoredLead } from "@/lib/leads/createLead";
import { buildLeadIntake } from "@/lib/leads/intakeShape";
import { emailRefusal } from "@/lib/validation";
import { deleteLeads, cleanLeadIds, supportSessionRefusal, MAX_DELETE_BATCH } from "@/lib/leads/deleteLead";
import { nudgeAgencyEvents } from "@/lib/agency/nudge";
import { captureDeletedNotALead } from "@/lib/meta/capi/capture";
import { afterResponse } from "@/lib/meta/capi/afterResponse";

// Authed — the pipeline view for staff
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Leads ARE the requests grid. The board used to be a screen every crew
  // member was shown, redacted rather than refused, because view_only was the
  // bottom of the ladder. It no longer is: somebody set to No access is
  // refused the board entirely.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_only",
    "see requests",
  );
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const temperature = searchParams.get("temperature");
  const source = searchParams.get("source");
  const assignedToId = searchParams.get("assignedToId");
  const q = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort"); // "score" | default recent

  // "score" sorts hottest-first (nulls — unscored legacy leads — sink to the
  // bottom), then most recent within a tier. Default stays newest-first.
  const orderBy =
    sort === "score"
      ? [{ score: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];

  const leads = await db.leadRequest.findMany({
    where: {
      companyId: member.companyId,
      ...(status && { status }),
      ...(temperature && { temperature }),
      ...(source && { source }),
      ...(assignedToId && {
        assignedToId: assignedToId === "unassigned" ? null : assignedToId,
      }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { message: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      category: { select: { label: true } },
      assignedTo: { select: { id: true, name: true } },
      quote: {
        select: {
          // id, quoteNumber, status and the Won rule's evidence — the board
          // asks canSetLeadStatus before a drop, so it needs the same facts
          // the PATCH below decides on (lib/leads/pipeline.js).
          ...LEAD_QUOTE_EVIDENCE_SELECT,
          // What the quote is worth and whether a human has confirmed it —
          // read by potentialValueForLead below, and stripped again before
          // the response so the board never carries a quote's money to
          // someone whose pricing toggle is off.
          total: true,
          acceptedTotal: true,
          autoEstimated: true,
          needsReview: true,
          estimateData: true,
        },
      },
    },
    orderBy,
  });

  // ── What each lead is probably worth ─────────────────────────────────────
  //
  // Computed here rather than in the browser because the "scope" basis
  // prices the homeowner's counts from this company's own price book, which
  // the board has no business downloading (lib/leads/scopeEstimate.js). No
  // scope, no figure — the "average" basis is gone (lib/leads/
  // potentialValue.js says why). Only a member who may see prices gets a
  // figure at all: the pricing toggle hides quote totals everywhere else
  // (redactQuoteMoney), and a lead chip that said "≈ $12,000 · from quote"
  // would hand that same total to someone the toggle exists to keep it from.
  const showMoney = canSeeMoney(full);
  const pricing = showMoney ? await loadScopePricing(db, member.companyId).catch(() => ({})) : {};

  // ── The quote a lead became, when nobody linked it (2026-10-05) ─────────
  //
  // "A quote for the same client created after the lead" — by the SAME rule
  // the campaign rollup counts one (inferLeadQuotes: an exact phone or
  // email, or a name plus an agreeing address; never a name alone, never a
  // tie). Only for open leads from the last year: the board loads all day,
  // and a quote scan back to a lead from 2023 is a cost nobody asked for.
  const YEAR = 365 * 24 * 60 * 60 * 1000;
  const inferable = leads
    .filter((l) => !l.quoteId && (l.status === "new" || l.status === "contacted") && new Date(l.createdAt).getTime() > Date.now() - YEAR)
    .map((l) => ({ id: l.id, quoteId: null, name: l.name, email: l.email, phone: l.phone, intake: l.intake, createdAt: l.createdAt }));
  if (inferable.length) await inferLeadQuotes({ db, companyId: member.companyId, leads: inferable }).catch(() => null);
  const inferredIds = [...new Set(inferable.map((l) => l.inferredQuoteId).filter(Boolean))];
  const inferredRows = inferredIds.length
    ? await db.quote.findMany({
        where: { companyId: member.companyId, id: { in: inferredIds } },
        select: { id: true, quoteNumber: true, status: true, total: true, acceptedTotal: true },
      })
    : [];
  const inferredById = new Map(inferredRows.map((q) => [q.id, q]));
  const inferredForLead = new Map(inferable.filter((l) => l.inferredQuoteId).map((l) => [l.id, inferredById.get(l.inferredQuoteId)]));

  // ── The conversation each lead came from: its tier, and a follow-up ─────
  const evidenceThreadIds = leads.map((l) => l.conversationEvidence?.threadId).filter((x) => typeof x === "string" && x);
  const threads = await db.messageThread
    .findMany({
      where: { companyId: member.companyId, OR: [{ leadId: { in: leads.map((l) => l.id) } }, ...(evidenceThreadIds.length ? [{ id: { in: evidenceThreadIds } }] : [])] },
      select: { id: true, leadId: true, leadCapture: true },
    })
    .catch(() => []);
  const threadForLead = new Map();
  for (const t of threads) if (t.leadId && !threadForLead.has(t.leadId)) threadForLead.set(t.leadId, t);
  for (const l of leads) {
    const tid = l.conversationEvidence?.threadId;
    if (!threadForLead.has(l.id) && tid) {
      const t = threads.find((x) => x.id === tid);
      if (t) threadForLead.set(l.id, t);
    }
  }
  const followUps = await followUpsForThreads(db, member.companyId, threads.map((t) => t.id)).catch(() => new Map());

  const quoteMoney = (q) => (showMoney && q ? Number(q.acceptedTotal ?? q.total) || null : undefined);
  const withPotential = leads.map((l) => {
    const { quote, ...rest } = l;
    // A whitelist on both branches. quoteEvidence spreads the whole row
    // (total, acceptedTotal, estimateData ride along), so the four fields are
    // picked by name; and a row it declines is dropped to null rather than
    // passed through raw, which would hand those same totals to the board.
    // The total joins them only for a member who may see prices.
    const evidence = quoteEvidence(quote);
    const publicQuote = evidence
      ? {
          id: evidence.id,
          quoteNumber: evidence.quoteNumber,
          status: evidence.status,
          hasWork: evidence.hasWork,
          ...(showMoney && { total: quoteMoney(quote) }),
        }
      : null;
    const inferred = inferredForLead.get(l.id) || null;
    const thread = threadForLead.get(l.id) || null;
    const followUp = thread ? followUps.get(thread.id) || null : null;
    return {
      ...rest,
      quote: publicQuote,
      // Not linked, but a confirmed match: shown as "probably" with the
      // number, never written onto the lead.
      inferredQuote: inferred
        ? { id: inferred.id, quoteNumber: inferred.quoteNumber, status: inferred.status, ...(showMoney && { total: quoteMoney(inferred) }) }
        : null,
      quoted: Boolean(publicQuote || inferred),
      threadId: thread?.id || null,
      qualification: thread ? publicQualification(thread.leadCapture?.qualification || null) : null,
      followUp: followUp ? { taskId: followUp.id, dueDate: followUp.dueDate } : null,
      ...(showMoney && { potential: potentialValueForLead(l, { pricing }) }),
    };
  });

  // ── Who has asked not to be called ──────────────────────────────────────
  //
  // Shown on the list so a contractor knows BEFORE they pick up the phone.
  // Someone who asked us to stop and then gets rung anyway is the complaint
  // that ends in a regulator, and the person dialling had no way to know.
  //
  // One query for the whole page rather than one per lead: this list can be
  // hundreds long, and N+1 on a page people open all day is how it gets slow.
  const numbers = [...new Set(leads.map((l) => l.phone).filter(Boolean))];
  const optedOut = numbers.length
    ? await db.callConsent.findMany({
        where: { companyId: member.companyId, e164: { in: numbers }, optedOutAt: { not: null } },
        select: { e164: true },
      })
    : [];
  const blocked = new Set(optedOut.map((c) => c.e164));

  // ── The one pipeline stage the redaction sweep never reached ────────────
  //
  // Clients, quotes, invoices, appointments and jobs were all filtered for a
  // member on clientsProperties "name_address_only"; leads were not looked at,
  // because a LeadRequest is not a Client row. It carries the same personal
  // data one step earlier — QA read a real email, a real phone number and a
  // stated budget of 15k_plus straight out of this list — and the pipeline
  // board is a screen a crew member is legitimately shown, so it is the
  // payload that narrows rather than the endpoint that refuses.
  //
  // Note the ORDER: doNotCall is derived from the phone first, then
  // redactLead drops both together. Deriving it after the redaction would
  // silently mark every restricted lead as callable.
  return NextResponse.json(
    redactLeads(
      full,
      withPotential.map((l) => ({
        ...l,
        doNotCall: Boolean(l.phone && blocked.has(l.phone)),
      })),
    ),
  );
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── Leads ARE the "Requests" category ───────────────────────────────────
  //
  // lib/permissions/nav.js has said so since it was written ("Leads are the
  // requests grid") and hides the quick-add control at view_only. The control
  // was hidden and the endpoint behind it was open: dragging a card across the
  // pipeline board is this PATCH — the leads board now actually does that,
  // with @dnd-kit — and a Worker set to "Requests: view only" could move
  // anyone's lead to Lost.
  //
  // Hiding a button is not access control — and of the four grid categories in
  // the Worker presets, requests was the one whose route had no check at all.
  // The drag handler on the client checks the SAME rule below before it ever
  // sends a request (so a refused drop never leaves the network), but this is
  // the gate that actually matters: it runs independently of whatever the
  // client chose to check, or skipped.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "requests", "view_create_edit", "change a request");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id, status, lostReason } = await request.json();
  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 },
    );
  }
  // Same allow-list as the per-lead route — an arbitrary string here would be
  // stored and then silently bucketed into "new" by the board.
  if (!isValidLeadStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (lostReason !== undefined && lostReason !== null && !isValidLostReason(lostReason)) {
    return NextResponse.json({ error: "Invalid lost reason" }, { status: 400 });
  }

  const existing = await db.leadRequest.findFirst({
    where: { id, companyId: member.companyId },
    // The Won rule's evidence — see the per-lead route's PATCH.
    include: { quote: { select: LEAD_QUOTE_EVIDENCE_SELECT } },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // "Converted" is Won, and nothing may land there on nothing but the enum
  // being poked — see lib/leads/pipeline.js. This is what makes a drag drop
  // onto the Converted column an honest refusal rather than a lead marked Won
  // with no quote behind it, and it applies to the drawer's own status button
  // exactly the same way, for the exact same reason. The "lost" branch of the
  // same function is what makes a drag drop onto Lost require a real reason
  // rather than accepting a bare status flip.
  const statusCheck = canSetLeadStatus(existing, status, { lostReason });
  if (!statusCheck.ok) {
    return NextResponse.json(
      { error: statusCheck.reason, code: statusCheck.code || null },
      { status: 409 },
    );
  }

  const updated = await db.leadRequest.update({
    where: { id },
    data: {
      status,
      // See app/api/leads/[id]/route.js's PATCH for why this clears outside
      // "lost" rather than only ever being set.
      lostReason: status === "lost" ? (lostReason ?? existing.lostReason) : null,
    },
  });
  // lead.stage_changed for the marketing agency, after the response.
  nudgeAgencyEvents(member.companyId);
  return NextResponse.json(updated);
}

// ── A lead typed in by staff (Create › Request, /app/leads/new) ─────────────
//
// Somebody rang the office, stopped the van in a driveway, or was handed a
// number at a trade show. The board had search, filters, Traffic and Import
// and no way to write that one person down, so the Create menu's Request row
// landed on the board and created nothing.
//
// Through createScoredLead, the creator every inbound path already uses — the
// self-quote form, the embed form, the portal, the phone assistant, Meta, the
// CSV import. A second hand-rolled create here would be the copy that rots:
// unscored, un-notified, and one more intake layout. Same rules as that
// path, too: a name and at least one of phone/email (the self-quote and embed
// routes' own rule); an email that could never be delivered to is refused
// while the person is still on the form; and no dedupe — createScoredLead
// writes one row per call on every channel, and a second enquiry from the
// same household is a second enquiry until a person decides otherwise.
//
// `source: "manual"` is not a new word. lib/analytics/kpis.js already names it
// ("a staff member typing in a walk-in customer") and keeps it out of the
// blended cost-per-lead, which is right: no ad spend caused this row.
//
// What it deliberately does NOT do, unlike the public routes beside it:
//   - email the homeowner a confirmation. They filled in nothing — a staff
//     member did — and a surprise "we received your request" is not theirs;
//   - record call consent or queue the outbound follow-up call. A public form
//     is the person asking to be rung; a number a staff member typed is not
//     evidence of that, and no consent only means a human dials instead,
//     which is the safe direction (app/api/leads/public/route.js says so).
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The level the Create row is shown at ("app.quickAdd.request" in
  // lib/permissions/nav.js) and the level the board's own PATCH asks. The
  // page asks the same pair; this is the one that decides. A read-only
  // support session never gets this far — middleware refuses the POST, and
  // its stand-in member has no row for loadEnforceableMember to find.
  const { response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit",
    "add a request",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 },
    );
  }

  const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = text(body.name, 200);
  const email = text(body.email, 320);
  const phone = text(body.phone, 40);
  const address = text(body.address, 500);
  const note = text(body.note, 4000);

  if (!name) {
    return NextResponse.json(
      { error: "A name is required.", code: "name_required" },
      { status: 400 },
    );
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Provide at least an email or phone number.", code: "contact_required" },
      { status: 400 },
    );
  }
  const badEmail = emailRefusal(email);
  if (badEmail) return NextResponse.json(badEmail, { status: 400 });

  // A service must be one this company has switched on — the portal request
  // route's rule, and the list the form was drawn from
  // (CompanyServiceCategory.enabled). Absent is fine: "they want something
  // done, I didn't catch what" is still a lead.
  let categoryId = null;
  if (body.categoryId) {
    const enabled = await db.companyServiceCategory.findFirst({
      where: { companyId: member.companyId, enabled: true, categoryId: String(body.categoryId) },
      select: { categoryId: true },
    });
    if (!enabled) {
      return NextResponse.json(
        { error: "That service isn't one this company offers.", code: "bad_categoryId" },
        { status: 400 },
      );
    }
    categoryId = enabled.categoryId;
  }

  const lead = await createScoredLead({
    companyId: member.companyId,
    name,
    email: email || null,
    phone: phone || null,
    categoryId,
    // The note is the staff member's own words about the enquiry, and the
    // drawer prints `message` as the lead's one free-text block. The address
    // is NOT copied in as the self-quote does: it rides in intake, where the
    // card's address line and convertLead both read it, and printing it twice
    // says nothing new.
    message: note || null,
    source: "manual",
    // city/province/country arrive only from a Places pick — the structured
    // halves of the one address field, not fields of their own — so a
    // converted client gets a tax jurisdiction. A typed address sends none,
    // and buildLeadIntake stores none rather than blanks.
    intake: buildLeadIntake({
      address,
      city: text(body.city, 120),
      province: text(body.province, 120),
      country: text(body.country, 8),
    }),
    // No `language`: the household was never asked which one they want, and
    // null is the column's "fall back to the company default" (see
    // LeadRequest.language). Stamping the staff member's screen language on
    // it would fix a document language nobody chose.
    //
    // The person who typed it, so the "New enquiry" feed does not tell them
    // about the lead they just entered — lib/notifications/recipients.js never
    // tells the actor.
    actorUserId: member.userId || null,
  });

  return NextResponse.json({ id: lead.id }, { status: 201 });
}

// Delete a selection of leads — the board's "Delete N leads". The same gate,
// the same rules and the same audit row per lead as DELETE /api/leads/[id];
// the work is lib/leads/deleteLead.js, called once for the whole selection so
// it is one transaction.
//
// Body: { ids: string[], notALead?: boolean }. Only ids of the caller's own
// company are touched; anything else is counted back as notFound and left
// alone — never "deleted" for what wasn't.
export async function DELETE(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const support = supportSessionRefusal(member);
  if (support) return NextResponse.json(support.body, { status: support.status });

  const { response: denied } = await levelOrRefusal(
    member,
    "requests",
    "view_create_edit_delete",
    "delete requests",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const { ids, tooMany } = cleanLeadIds(body?.ids);
  if (tooMany)
    return NextResponse.json(
      { error: `Select at most ${MAX_DELETE_BATCH} leads at a time.` },
      { status: 400 },
    );
  if (!ids.length)
    return NextResponse.json({ error: "No leads selected." }, { status: 400 });

  const result = await deleteLeads(db, {
    companyId: member.companyId,
    ids,
    actor: { userId: member.userId, memberId: member.id, role: member.role },
    notALead: body?.notALead === true,
    bulk: true,
  });
  if (!result.deleted.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Deleted as "not a lead": a Facebook lead-form lead is a Disqualified
  // stage for Meta ("Send lead results to Meta", lib/meta/capi/capture.js).
  // Queued after the response — Meta never slows or fails a delete.
  if (result.metaDisqualify?.length) {
    afterResponse(() => captureDeletedNotALead(db, { companyId: member.companyId, leads: result.metaDisqualify }));
  }

  return NextResponse.json({
    ok: true,
    deleted: result.deleted.map((l) => l.id),
    notFound: result.notFound.length,
    markedThreads: result.markedThreads,
    noConversation: result.noConversation,
  });
}
