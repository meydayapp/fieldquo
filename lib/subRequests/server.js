// lib/subRequests/server.js
//
// The reads and writes behind a GC's price request to their subs. Every
// decision is made in ./model.js (pure); this file applies them.
//
// No import of @/lib/db, the mailer or the lead creator: callers pass `db`
// and the side effects, so scripts/check-sub-price-requests.mjs runs every
// branch against an in-memory database whose $transaction really rolls back.
//
// ══ Whose action writes whose tenant ═══════════════════════════════════════
//
//   createPriceRequest  the GC, signed in → the GC's own rows (the request,
//                       one recipient per sub).
//   acceptRequest       a signed-in member of the SUB's company, pressing
//                       "Price it in FieldQuo" → the sub's own rows (a
//                       business client for the GC, a lead), plus the link on
//                       the GC's recipient row and — when blank — on the GC's
//                       roster row: the link the GC asked for by sending.
//   submitReply /       the token holder (no account) → their OWN recipient
//   declineRequest      row, nothing else.
//   confirmReply        the GC → a compare OPTION on the GC's quote, from the
//                       stored reply. No amount is read from the browser.
//   landRequestedQuote  the sub sending their quote → a compare OPTION on the
//                       GC's quote (never a line), through performImport —
//                       the same writer a pasted quote link uses.

import { randomBytes } from "node:crypto";
import {
  GC_REQUEST_LEAD_SOURCE,
  awaitingConfirmation,
  canAccept,
  canDecline,
  canReply,
  gcClientData,
  leadMessageFor,
  recipientStatus,
  reminderDue,
  signupPrefill,
  subFacingRequest,
} from "@/lib/subRequests/model";
import { comparisonKey, NO_LINE, scrubCompanyName } from "@/lib/quotes/importOptions";
import { performImport } from "@/lib/quotes/importQuote";

export class RequestError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** 32 CSPRNG bytes, base64url — the same strength as a quote's share token. */
export function mintRequestToken() {
  return randomBytes(32).toString("base64url");
}

/** The GC company fields a request needs, for the page, the email and the sub's client row. */
export const GC_COMPANY_SELECT = Object.freeze({
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  logoUrl: true,
  currency: true,
  brandColor: true,
  defaultLanguage: true,
  emailDomain: true,
  emailDomainStatus: true,
  emailFromLocal: true,
});

// ── The GC's side ───────────────────────────────────────────────────────────

/**
 * Where a request from this screen would land, and what it may carry: the
 * quote (the compare lives there), its job address, the photos on file, and
 * the GC's subs. A request raised from a job page lands on the job's quote.
 *
 * @returns { quote, jobId, photosOnFile, subs }
 */
export async function loadRequestContext(db, { companyId, quoteId = null, jobId = null }) {
  let job = null;
  if (jobId) {
    job = await db.job.findFirst({ where: { id: jobId, companyId }, select: { id: true, quoteId: true } });
    if (!job) throw new RequestError("That job wasn't found.", 404);
    if (!job.quoteId)
      throw new RequestError("This job has no quote to compare prices on. Requests start from a quote.", 400, "no_quote");
    quoteId = job.quoteId;
  }
  if (!quoteId) throw new RequestError("Pick a quote.", 400);
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId },
    select: {
      id: true,
      status: true,
      quoteNumber: true,
      siteAddress: true,
      clientPhotos: true,
      client: { select: { address: true, city: true, province: true, postalCode: true } },
      jobs: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (!quote) throw new RequestError("That quote wasn't found.", 404);
  const jobIdForPhotos = job?.id || quote.jobs?.[0]?.id || null;
  const jobPhotos = jobIdForPhotos
    ? await db.jobPhoto.findMany({
        where: { jobId: jobIdForPhotos, companyId },
        select: { url: true },
        orderBy: { createdAt: "asc" },
        take: 60,
      })
    : [];
  const photosOnFile = [
    ...(Array.isArray(quote.clientPhotos) ? quote.clientPhotos : [])
      .filter((p) => p && typeof p.url === "string")
      .map((p) => ({ url: p.url, kind: p.kind === "video" ? "video" : "photo" })),
    ...jobPhotos.map((p) => ({ url: p.url, kind: "photo" })),
  ];
  const subs = await db.subcontractor.findMany({
    where: { companyId, active: true },
    select: { id: true, name: true, trade: true, email: true, linkedCompanyId: true },
    orderBy: { name: "asc" },
  });
  return { quote, jobId: job?.id || null, photosOnFile, subs };
}

/** Prices can be compared on an open quote, and on an approved one (as extra work). */
export function quoteTakesRequests(status) {
  return ["draft", "sent", "accepted"].includes(status);
}

/**
 * Write the request and one recipient per sub. Sending is the caller's next
 * step (sentAt is stamped only once the mail provider accepted it).
 *
 * Refuses, before writing anything:
 *   · a sub not on THIS company's roster (an id from another tenant is "not found")
 *   · a sub with no email — there is nobody to send it to
 *   · a sub already asked to price the same trade on this quote and not
 *     declined — a second email for the same thing is noise
 *
 * @param input   parseRequestInput().data
 * @param context loadRequestContext() result
 */
export async function createPriceRequest(db, { member, input, context, photos, siteAddress, mint = mintRequestToken }) {
  if (!quoteTakesRequests(context.quote.status))
    throw new RequestError("That quote is already decided — prices can't be compared on it.", 400);
  const roster = await db.subcontractor.findMany({
    where: { companyId: member.companyId, id: { in: input.subcontractorIds }, active: true },
    select: { id: true, name: true, email: true },
  });
  if (roster.length !== input.subcontractorIds.length)
    throw new RequestError("One of those subcontractors isn't on your list.", 404);
  const noEmail = roster.filter((s) => !s.email || !String(s.email).includes("@"));
  if (noEmail.length)
    throw new RequestError(`Add an email for ${noEmail.map((s) => s.name).join(", ")} first.`, 400, "no_email");

  const key = comparisonKey(input.trade);
  const earlier = await db.subPriceRequestRecipient.findMany({
    where: {
      companyId: member.companyId,
      subcontractorId: { in: input.subcontractorIds },
      declinedAt: null,
      request: { quoteId: context.quote.id },
    },
    select: { subcontractorId: true, request: { select: { trade: true } } },
  });
  const again = earlier.filter((r) => comparisonKey(r.request?.trade) === key).map((r) => r.subcontractorId);
  if (again.length) {
    const names = roster.filter((s) => again.includes(s.id)).map((s) => s.name);
    throw new RequestError(`Already asked on this quote: ${names.join(", ")}.`, 409, "already_asked");
  }

  return db.$transaction(async (tx) => {
    const request = await tx.subPriceRequest.create({
      data: {
        companyId: member.companyId,
        quoteId: context.quote.id,
        jobId: context.jobId,
        trade: input.trade,
        scope: input.scope,
        siteAddress: siteAddress || null,
        photos: photos.length ? photos : undefined,
        wantedBy: input.wantedBy,
        createdById: member.userId ?? null,
      },
    });
    const recipients = [];
    for (const sub of roster) {
      recipients.push(
        await tx.subPriceRequestRecipient.create({
          data: {
            requestId: request.id,
            companyId: member.companyId,
            subcontractorId: sub.id,
            token: mint(),
          },
        }),
      );
    }
    return { request, recipients };
  });
}

/** Stamp a recipient sent — only after the mail provider accepted it. */
export async function markSent(db, { recipientId, email, now = new Date(), reminder = false }) {
  return db.subPriceRequestRecipient.update({
    where: { id: recipientId },
    data: reminder ? { remindedAt: now } : { sentAt: now, sentToEmail: email },
  });
}

/**
 * The GC panel's rows for one quote — every request, every sub, where each
 * stands. `mayCost` decides whether a reply's figure is included (the sub's
 * price is the GC's COST: jobCosting, like the compare's cost column).
 */
export async function listRequestsForQuote(db, { companyId, quoteId, mayCost = false }) {
  const requests = await db.subPriceRequest.findMany({
    where: { companyId, quoteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      trade: true,
      scope: true,
      wantedBy: true,
      photos: true,
      createdAt: true,
      recipients: {
        select: {
          id: true,
          sentAt: true,
          openedAt: true,
          remindedAt: true,
          acceptedAt: true,
          sourceQuoteId: true,
          quoteImportId: true,
          repliedAt: true,
          replyAmount: true,
          replyNote: true,
          replyFile: true,
          declinedAt: true,
          declineReason: true,
          linkedCompanyId: true,
          subcontractor: { select: { id: true, name: true } },
        },
      },
    },
  });
  return requests.map((r) => ({
    id: r.id,
    trade: r.trade,
    scope: r.scope,
    wantedBy: r.wantedBy ? new Date(r.wantedBy).toISOString().slice(0, 10) : null,
    photoCount: Array.isArray(r.photos) ? r.photos.length : 0,
    createdAt: r.createdAt,
    recipients: (r.recipients || []).map((x) => ({
      id: x.id,
      subcontractorId: x.subcontractor?.id || null,
      name: x.subcontractor?.name || "",
      status: recipientStatus(x),
      sentAt: x.sentAt,
      openedAt: x.openedAt,
      remindedAt: x.remindedAt,
      onFieldQuo: Boolean(x.linkedCompanyId),
      inCompare: Boolean(x.quoteImportId),
      awaitingConfirmation: awaitingConfirmation(x),
      reply: x.repliedAt
        ? {
            note: x.replyNote || "",
            file: x.replyFile && typeof x.replyFile === "object" ? x.replyFile : null,
            ...(mayCost ? { amount: x.replyAmount == null ? null : Number(x.replyAmount) } : { amountHidden: true }),
          }
        : null,
      declineReason: x.declinedAt ? x.declineReason || "" : null,
    })),
  }));
}

/**
 * "Add to compare" on a reply from a sub with no account: the GC confirms
 * the figure they typed and it becomes an OPTION beside the other prices for
 * the trade — never a line on the quote, never a change order. The figure
 * is the STORED reply; the route reads no body.
 *
 * Once only: the recipient's quoteImportId is claimed in the same
 * transaction, conditionally on it being null.
 */
export async function confirmReply(db, { member, recipientId }) {
  const r = await db.subPriceRequestRecipient.findFirst({
    where: { id: recipientId, companyId: member.companyId },
    select: {
      id: true,
      repliedAt: true,
      replyAmount: true,
      quoteImportId: true,
      declinedAt: true,
      subcontractorId: true,
      subcontractor: { select: { name: true } },
      request: { select: { quoteId: true, trade: true, companyId: true } },
    },
  });
  if (!r || r.request?.companyId !== member.companyId) throw new RequestError("That reply wasn't found.", 404);
  if (r.quoteImportId) throw new RequestError("That price is already in your compare.", 409);
  if (!awaitingConfirmation(r)) throw new RequestError("There's no price from them to add.", 400);
  const amount = Math.round(Number(r.replyAmount) * 100) / 100;
  if (!(amount > 0)) throw new RequestError("There's no price from them to add.", 400);
  const quote = await db.quote.findFirst({
    where: { id: r.request.quoteId, companyId: member.companyId },
    select: { id: true, status: true },
  });
  if (!quote) throw new RequestError("That quote wasn't found.", 404);
  if (!quoteTakesRequests(quote.status))
    throw new RequestError("That quote is already decided — its prices can't change.", 400);

  // The trade label goes on the client's document if the GC uses this
  // price — never the sub's name (white-label).
  const label = scrubCompanyName(String(r.request.trade || "").slice(0, 120), r.subcontractor?.name) || "Subcontracted work";
  return db.$transaction(async (tx) => {
    const imp = await tx.quoteImport.create({
      data: {
        sourceQuoteId: null,
        sourceCompanyId: null,
        subcontractorId: r.subcontractorId,
        targetQuoteId: quote.id,
        targetCompanyId: member.companyId,
        targetLineId: NO_LINE,
        placement: "option",
        snapshotAmount: amount,
        markupPercent: 0,
        display: "blended",
        label,
        createdById: member.userId ?? null,
      },
    });
    const claimed = await tx.subPriceRequestRecipient.updateMany({
      where: { id: r.id, companyId: member.companyId, quoteImportId: null, declinedAt: null },
      data: { quoteImportId: imp.id },
    });
    if (claimed.count !== 1) throw new RequestError("That price is already in your compare.", 409);
    return { import: imp, placement: "option" };
  });
}

// ── The sub's side ──────────────────────────────────────────────────────────

/** A recipient by its token, with what the page, the email and accept need. */
export async function loadRecipientByToken(db, token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) return null;
  return db.subPriceRequestRecipient.findFirst({
    where: { token },
    select: {
      id: true,
      token: true,
      companyId: true,
      subcontractorId: true,
      sentAt: true,
      openedAt: true,
      remindedAt: true,
      acceptedAt: true,
      linkedCompanyId: true,
      leadId: true,
      sourceQuoteId: true,
      quoteImportId: true,
      repliedAt: true,
      replyAmount: true,
      replyNote: true,
      declinedAt: true,
      subcontractor: {
        select: { id: true, name: true, contactName: true, email: true, phone: true, trade: true, linkedCompanyId: true },
      },
      request: {
        select: {
          id: true,
          companyId: true,
          quoteId: true,
          trade: true,
          scope: true,
          siteAddress: true,
          photos: true,
          wantedBy: true,
          company: { select: GC_COMPANY_SELECT },
        },
      },
    },
  });
}

/** The sub-facing view of a loaded recipient (model.js subFacingRequest). */
export function viewForRecipient(recipient) {
  return subFacingRequest({ request: recipient?.request, gc: recipient?.request?.company, recipient });
}

/** First open only. */
export async function markOpened(db, { recipientId, now = new Date() }) {
  return db.subPriceRequestRecipient.updateMany({ where: { id: recipientId, openedAt: null }, data: { openedAt: now } });
}

/**
 * The welcome questions' prefill for a sub signing up from a request: what
 * the GC entered about THEM (model.js signupPrefill) — nothing else.
 */
export async function prefillForToken(db, token) {
  const r = await loadRecipientByToken(db, token);
  if (!r || r.declinedAt) return null;
  return signupPrefill(r.subcontractor);
}

/**
 * "Price it in FieldQuo" — a signed-in member of the sub's company links the
 * request to their account. In the sub's tenant, on their action: the GC as
 * a business client (found by Client.linkedCompanyId, never duplicated) and
 * a lead (source "gc_request") carrying the request's allow-listed view.
 *
 * Idempotent: a second press (or a race) finds the link already made and
 * returns the same lead.
 *
 * @param createLead       lib/leads/createLead.js createScoredLead
 * @param linkLeadToClient lib/leads/identityLinks.js linkLeadToClient — so
 *                         converting the lead quotes the GC's client row
 * @param leadLabels       the "Trade" / "Wanted by" words, in the sub's language
 */
export async function acceptRequest(db, { token, member, createLead, linkLeadToClient, leadLabels = {}, now = new Date() }) {
  const r = await loadRecipientByToken(db, token);
  if (!r) throw new RequestError("This request link isn't valid.", 404);
  const gc = r.request.company;
  const verdict = canAccept({
    recipient: r,
    member,
    gcCompanyId: r.request.companyId,
    rosterLinkedCompanyId: r.subcontractor?.linkedCompanyId || null,
  });
  if (!verdict.ok) {
    const messages = {
      own: "This is your own company's request.",
      declined: "This request was declined.",
      linked_elsewhere: "This request is linked to another FieldQuo account. Sign in to that one to price it.",
      read_only: "A read-only session can't accept requests.",
      no_session: "Sign in to price this in FieldQuo.",
    };
    throw new RequestError(messages[verdict.reason] || "This request can't be accepted.", verdict.reason === "no_session" ? 401 : 403, verdict.reason);
  }
  if (r.acceptedAt && r.leadId && r.linkedCompanyId === member.companyId) return { leadId: r.leadId, again: true };

  // Claim it for this company first — the one conditional write that makes a
  // double press, or two people at the sub at once, produce one lead.
  const claimed = await db.subPriceRequestRecipient.updateMany({
    where: {
      id: r.id,
      declinedAt: null,
      OR: [{ linkedCompanyId: null }, { linkedCompanyId: member.companyId }],
      leadId: null,
    },
    data: { acceptedAt: r.acceptedAt || now, acceptedByUserId: member.userId, linkedCompanyId: member.companyId },
  });
  if (claimed.count !== 1) {
    const fresh = await loadRecipientByToken(db, token);
    if (fresh?.leadId && fresh.linkedCompanyId === member.companyId) return { leadId: fresh.leadId, again: true };
    throw new RequestError("This request was just taken by another account.", 409, "linked_elsewhere");
  }

  try {
    const client = await findOrCreateGcClient(db, { gc, subCompanyId: member.companyId });
    const view = viewForRecipient(r);
    const lead = await createLead({
      companyId: member.companyId,
      name: client.name,
      email: client.email,
      phone: client.phone,
      message: leadMessageFor(view, leadLabels),
      source: GC_REQUEST_LEAD_SOURCE,
      clientPhotos: view.photos,
      // The job address — the one piece of the homeowner's record that was
      // shared — as the lead's address, the shape every lead reader uses.
      intake: view.address ? { address: view.address } : null,
      actorUserId: member.userId,
    });
    if (typeof linkLeadToClient === "function") {
      await linkLeadToClient(db, {
        companyId: member.companyId,
        leadId: lead.id,
        clientId: client.id,
        match: { confidence: "certain", matchedOn: ["price_request"] },
      });
    }
    await db.subPriceRequestRecipient.update({ where: { id: r.id }, data: { leadId: lead.id } });
    // The GC's roster row learns who this sub is on FieldQuo — only when it
    // was blank. A row the GC already linked to someone is never re-pointed.
    await db.subcontractor.updateMany({
      where: { id: r.subcontractorId, companyId: r.request.companyId, linkedCompanyId: null },
      data: { linkedCompanyId: member.companyId },
    });
    return { leadId: lead.id, clientId: client.id, again: false };
  } catch (err) {
    // Undo the claim so pressing again works; the lead (if any) stays.
    await db.subPriceRequestRecipient
      .updateMany({ where: { id: r.id, leadId: null }, data: { acceptedAt: null, acceptedByUserId: null, linkedCompanyId: r.linkedCompanyId || null } })
      .catch(() => {});
    throw err;
  }
}

/**
 * The GC as a business client in the sub's company — one row per GC, found
 * by Client.linkedCompanyId (@@unique with companyId). A concurrent create
 * that loses the unique race reads the winner.
 */
export async function findOrCreateGcClient(db, { gc, subCompanyId }) {
  const select = { id: true, name: true, email: true, phone: true };
  const existing = await db.client.findFirst({ where: { companyId: subCompanyId, linkedCompanyId: gc.id }, select });
  if (existing) return existing;
  try {
    return await db.client.create({ data: gcClientData({ gc, subCompanyId }), select });
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const winner = await db.client.findFirst({ where: { companyId: subCompanyId, linkedCompanyId: gc.id }, select });
    if (winner) return winner;
    throw err;
  }
}

/** "Not this one" — with an optional reason. Writes only this recipient. */
export async function declineRequest(db, { token, reason = null, now = new Date() }) {
  const r = await loadRecipientByToken(db, token);
  const verdict = canDecline(r);
  if (!verdict.ok) {
    if (verdict.reason === "not_found") throw new RequestError("This request link isn't valid.", 404);
    throw new RequestError("A price is already with them — reply to them directly to withdraw it.", 409, verdict.reason);
  }
  if (verdict.again) return { already: true };
  const res = await db.subPriceRequestRecipient.updateMany({
    where: { id: r.id, declinedAt: null, quoteImportId: null, sourceQuoteId: null },
    data: { declinedAt: now, declineReason: reason },
  });
  if (res.count !== 1) throw new RequestError("A price is already with them.", 409, "quoted");
  return { already: false };
}

/**
 * The no-account reply: price, note, optional file — onto THIS recipient's
 * own pending reply and nowhere else. Conditional on nothing having
 * superseded it (canReply's rules, re-checked in the WHERE so a race with
 * the GC's confirm cannot move a confirmed figure).
 */
export async function submitReply(db, { token, input, now = new Date() }) {
  const r = await loadRecipientByToken(db, token);
  const verdict = canReply(r);
  if (!verdict.ok) {
    if (verdict.reason === "not_found") throw new RequestError("This request link isn't valid.", 404);
    const messages = {
      declined: "This request was declined.",
      linked: "This request is in your FieldQuo account — send your quote from there.",
      confirmed: "They've already added your price. Contact them directly to change it.",
    };
    throw new RequestError(messages[verdict.reason], 409, verdict.reason);
  }
  const res = await db.subPriceRequestRecipient.updateMany({
    where: { id: r.id, declinedAt: null, acceptedAt: null, sourceQuoteId: null, quoteImportId: null },
    data: {
      replyAmount: input.amount,
      replyNote: input.note || null,
      replyFile: input.file || null,
      repliedAt: now,
    },
  });
  if (res.count !== 1) throw new RequestError("They've already added your price.", 409, "confirmed");
  return { ok: true };
}

// ── The answer coming back ──────────────────────────────────────────────────

/**
 * A sub's quote was SENT. If it answers a price request (its lead came from
 * one, and the sub's company is the one that accepted it), it lands in the
 * GC's compare as an OPTION — markup 0, the GC's to set — through
 * performImport, the same writer a pasted quote link uses. Never a line,
 * never a change order: choosing is the GC's.
 *
 * Best effort and idempotent: a re-send finds quoteImportId set and does
 * nothing; a quote the GC already pasted in by link is adopted, not doubled.
 * Never throws.
 */
export async function landRequestedQuote(db, { quoteId }) {
  const out = { landed: 0 };
  if (!quoteId) return out;
  try {
    const source = await db.quote.findFirst({
      where: { id: quoteId },
      select: {
        id: true,
        companyId: true,
        status: true,
        total: true,
        acceptedTotal: true,
        lineItems: true,
        scopeGroups: { select: { lineItems: true } },
        company: { select: { name: true } },
        lead: { select: { id: true, companyId: true } },
      },
    });
    if (!source?.lead?.id || source.lead.companyId !== source.companyId) return out;
    const recipients = await db.subPriceRequestRecipient.findMany({
      where: { leadId: source.lead.id, linkedCompanyId: source.companyId, quoteImportId: null, declinedAt: null },
      select: {
        id: true,
        subcontractorId: true,
        request: { select: { companyId: true, quoteId: true, trade: true } },
      },
    });
    for (const r of recipients) {
      try {
        const target = await db.quote.findFirst({
          where: { id: r.request.quoteId, companyId: r.request.companyId },
          include: { scopeGroups: true, jobs: { select: { id: true }, orderBy: { createdAt: "asc" } } },
        });
        if (!target || !quoteTakesRequests(target.status)) continue;
        let importId = null;
        try {
          const done = await performImport({
            db,
            // The GC, by company only: nobody at the GC pressed anything, and
            // createdById stays null rather than naming someone who didn't.
            member: { companyId: r.request.companyId, userId: null },
            sourceQuote: source,
            targetQuote: target,
            targetCompany: null,
            markupPercent: 0,
            display: "blended",
            label: r.request.trade,
            asOption: true,
            subcontractorId: r.subcontractorId,
          });
          importId = done.import.id;
        } catch (err) {
          if (err?.status !== 409) throw err;
          // The GC already brought this quote in by its link — adopt that row.
          const existing = await db.quoteImport.findFirst({
            where: { targetQuoteId: target.id, sourceQuoteId: source.id, targetCompanyId: r.request.companyId },
            select: { id: true },
          });
          importId = existing?.id || null;
        }
        if (!importId) continue;
        const claimed = await db.subPriceRequestRecipient.updateMany({
          where: { id: r.id, quoteImportId: null },
          data: { quoteImportId: importId, sourceQuoteId: source.id },
        });
        if (claimed.count === 1) out.landed++;
      } catch (err) {
        console.error("[subRequests] land quote", quoteId, r.id, err?.message);
      }
    }
  } catch (err) {
    console.error("[subRequests] land quote", quoteId, err?.message);
  }
  return out;
}

// ── The reminder ────────────────────────────────────────────────────────────

/**
 * The daily pass: every sub with no answer `subRequestReminderDays` after
 * the request went out gets ONE reminder. Claimed (remindedAt) before the
 * send so two overlapping runs cannot both send; released if the send fails
 * so tomorrow's run tries again.
 *
 * @param send async (recipientId) => ({ ok })
 */
export async function runPriceRequestReminders(db, { now = new Date(), send }) {
  const out = { due: 0, sent: 0, failed: 0 };
  const candidates = await db.subPriceRequestRecipient.findMany({
    where: {
      sentAt: { not: null },
      remindedAt: null,
      declinedAt: null,
      acceptedAt: null,
      repliedAt: null,
      quoteImportId: null,
      sourceQuoteId: null,
    },
    select: {
      id: true,
      sentAt: true,
      openedAt: true,
      remindedAt: true,
      request: { select: { wantedBy: true, company: { select: { subRequestReminderDays: true } } } },
    },
    take: 500,
  });
  for (const r of candidates) {
    if (!reminderDue(r, { days: r.request?.company?.subRequestReminderDays, now, wantedBy: r.request?.wantedBy })) continue;
    out.due++;
    const claimed = await db.subPriceRequestRecipient.updateMany({
      where: { id: r.id, remindedAt: null },
      data: { remindedAt: now },
    });
    if (claimed.count !== 1) continue;
    let ok = false;
    try {
      ok = Boolean((await send(r.id))?.ok);
    } catch (err) {
      console.error("[subRequests] reminder", r.id, err?.message);
    }
    if (ok) out.sent++;
    else {
      out.failed++;
      await db.subPriceRequestRecipient.updateMany({ where: { id: r.id, remindedAt: now }, data: { remindedAt: null } });
    }
  }
  return out;
}
