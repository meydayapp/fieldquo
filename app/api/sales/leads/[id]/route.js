// app/api/sales/leads/[id]/route.js
//
// One prospect, with every conversation FieldQuo holds about them.
//
// The whole thread history comes back with the lead rather than behind a second
// fetch: this is the screen where a rep decides what to write next, and a
// conversation split across two round trips is a conversation that renders half
// empty on a bad connection.
//
// `params` is a Promise — Next 16. Awaited, not destructured.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { outreachStatus } from "@/lib/sales/outreachSender";
import {
  isLeadStatus,
  isPlausibleEmail,
  leadWhere,
  sanitiseHeaderText,
} from "@/lib/sales/outreach";
import { contactOptedOut } from "@/lib/sales/outreachInbound";
import { leadCallingContext, leadDialView } from "@/lib/sales/leadDial";
import { windowPolicyForProspect } from "@/lib/sales/windowOverrides";
import { publicWindowPolicy } from "@/lib/sales/windowPolicy";
import { isSalesSmsTimeZone } from "@/lib/sales/smsWindow";
import { normaliseCountry, normaliseSubdivision } from "@/lib/sales/callingRules";
import { ownNumbers } from "@/lib/sales/calls/store";
import { CHANNEL_TEXT, CHANNEL_VOICE } from "@/lib/sales/contact/numbers";
import { loadContactNumbers, pickContactNumber } from "@/lib/sales/contact/resolve";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { assignedCompanyWhere } from "@/lib/sales/scope";
import { decideUnlink } from "@/lib/sales/leadLink";
import { getOnboardingStatus } from "@/lib/onboarding";
import { onboardingProgress, walkthroughGate } from "@/lib/sales/nextSteps";

/**
 * The company a lead is linked to, as the rep may see it, plus whether the
 * rep can still undo the link themselves.
 *
 * The name is read through assignedCompanyWhere, like every other rep-facing
 * company read: convertedCompanyId is a pointer, not a grant
 * (lib/sales/checkin/store.js says the same). A link written by the old
 * pick-from-a-list path was always to a company in the rep's book, and the
 * email path only links to one that is or becomes theirs, so a null here
 * means the attribution moved since — which is worth the rep seeing as
 * "linked, but not in your book" rather than a name they are no longer
 * entitled to.
 */
async function linkedCompanyFor(rep, lead) {
  if (!lead?.convertedCompanyId) return null;
  const company = await db.company.findFirst({
    where: { id: lead.convertedCompanyId, ...assignedCompanyWhere(rep.id) },
    select: { id: true, name: true, createdAt: true },
  });
  const unlink = decideUnlink({ lead });

  // ── How far the company has got with setup ───────────────────────────
  //
  // The owner's rule: once a lead has been sent to sign up, the REP is
  // responsible for the company finishing onboarding. So the card says
  // "3 of 8 setup steps done" from the same checklist the company's own
  // dashboard reads (lib/onboarding.js), read only for a company in the
  // rep's book — the same boundary the name above is read through. Null,
  // never zeros, when the company is not theirs to see or the read failed:
  // "0 of 0" would print as a company that has done nothing.
  let onboarding = null;
  if (company) {
    try {
      onboarding = await getOnboardingStatus(company.id);
    } catch {
      onboarding = null;
    }
  }
  const walkthrough = walkthroughGate({ lead, onboarding });
  return {
    id: lead.convertedCompanyId,
    name: company?.name || null,
    createdAt: company?.createdAt || null,
    canUnlink: unlink.allowed,
    unlinkRefusal: unlink.reason,
    onboarding: onboardingProgress(onboarding),
    // Whether the one-hour walkthrough may be booked, and why not when not.
    walkthrough: { allowed: walkthrough.allowed, reasonKey: walkthrough.reasonKey, reason: walkthrough.reason },
  };
}

/**
 * Every number this lead can be reached on, per channel.
 *
 * Built for both handlers so a PATCH answers the same question a GET does —
 * two copies of "which numbers may be used" is how a screen ends up offering a
 * choice the send path refuses.
 *
 * `blocked` carries the do-not-contact and the opt-out, so a refusal covers
 * every number of theirs rather than only the one on the lead. A cell somebody
 * gave us after they said stop is the same call they refused.
 */
async function contactNumbersFor(lead, { optedOut = null } = {}) {
  const [rows, ours] = await Promise.all([
    loadContactNumbers({ prospectId: lead?.prospect?.id || null, salesLeadId: lead?.id || null }),
    ownNumbers().catch(() => []),
  ]);
  const args = {
    target: { phoneE164: normalisePhone(lead?.phone) || lead?.prospect?.phoneE164 || null },
    rows,
    ourNumbers: ours,
    blocked: Boolean(lead?.prospect?.doNotContactAt) || Boolean(optedOut?.optedOut),
    blockedReason: optedOut?.reason || null,
  };
  const voice = pickContactNumber({ ...args, channel: CHANNEL_VOICE });
  const text = pickContactNumber({ ...args, channel: CHANNEL_TEXT });
  return {
    stored: rows.map((r) => ({
      id: r.id, e164: r.e164, kind: r.kind, label: r.label,
      canCall: r.canCall, canText: r.canText, preferred: r.preferred,
      note: r.note, createdAt: r.createdAt,
    })),
    voice: { choices: voice.choices, refused: voice.refused, reason: voice.code },
    text: { choices: text.choices, refused: text.refused, reason: text.code },
  };
}

/** The shape both handlers return, so the screen never sees two versions of a lead. */
const LEAD_SELECT = {
  id: true,
  businessName: true,
  contactName: true,
  email: true,
  phone: true,
  timeZone: true,
  country: true,
  province: true,
  status: true,
  notes: true,
  // The discovered business behind this lead, when there is one. Selected
  // rather than fetched separately because the dial region needs its
  // do-not-contact flag and its location in the same render as the number —
  // a second round trip here is a call button that appears a beat late.
  prospect: {
    select: {
      id: true,
      phoneE164: true,
      country: true,
      province: true,
      doNotContactAt: true,
      doNotContactReason: true,
    },
  },
  convertedCompanyId: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  threads: {
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      subject: true,
      lastMessageAt: true,
      createdAt: true,
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          body: true,
          sentAt: true,
        },
      },
    },
  },
};

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;

  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, id),
    select: LEAD_SELECT,
  });

  // 404 rather than 403 for another rep's lead. Telling a caller that a row
  // exists but is not theirs confirms the row exists — the same reason
  // lib/sales/gate.js gives 401 for three different failures.
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Asked through contactOptedOut so the screen and the send path cannot
  // disagree. It still recomputes from the messages (see leadOptedOut's note
  // on why that half is derived rather than stored) — it now also reads
  // FieldQuo's platform-wide list, which is where an opt-out given by phone,
  // or to a different rep holding the same prospect, actually lives.
  const optOut = await contactOptedOut(db, {
    leadId: lead.id,
    email: lead.email,
    phone: lead.phone,
    channel: "email",
  });

  // Asked again for the phone channel. An opt-out given by email does suppress
  // every channel by default — SUPPRESSION_CHANNELS' header argues why — but
  // the two questions are asked separately so a NARROW suppression ("email is
  // fine, don't ring me") shows on the dial and not on the compose box.
  const phoneOptOut = lead.phone
    ? await contactOptedOut(db, {
        leadId: lead.id,
        email: lead.email,
        phone: lead.phone,
        channel: "phone",
      })
    : { optedOut: false, reason: null };

  return NextResponse.json({
    lead,
    linkedCompany: await linkedCompanyFor(rep, lead),
    optedOut: optOut.optedOut,
    optedOutReason: optOut.reason,
    // See the same pair in app/api/sales/threads/[id]/route.js: the sentence
    // is still composed here, where the source that closed the channel is
    // known, and the key travels with it so the screen can say it in the rep's
    // language rather than in this file's.
    optedOutReasonKey: optOut.reasonKey || null,
    optedOutReasonParams: optOut.reasonParams || null,
    // Everything the dial region reads, in the shape dialSpace() expects off a
    // queue row. Computed server-side for the same reason the queue's is: a
    // screen that worked out for itself whether a lead was callable would be a
    // second opinion, and a second opinion that disagreed with the gate is how
    // a Call button appears on a number nobody may ring.
    call: leadDialView(lead, {
      optedOut: phoneOptOut,
      windowPolicy: publicWindowPolicy(await windowPolicyForProspect(leadCallingContext(lead))),
    }),
    // The picker beside the dial. Same shape the queue sends, so
    // app/components/sales/ContactNumbers.js renders one thing on both screens.
    numbers: await contactNumbersFor(lead, { optedOut: phoneOptOut }),
    // The server's clock, so the screen judges the calling window against it
    // and not against a laptop whose time zone is wrong — the same reason the
    // queue payload carries one. A rep's own clock is the substitute this
    // whole feature exists to avoid.
    serverNow: new Date().toISOString(),
    outreach: await outreachStatus(rep),
  });
}

export async function PATCH(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const data = {};

  if (body.businessName !== undefined) {
    const businessName = sanitiseHeaderText(body.businessName, 200);
    if (!businessName) {
      return NextResponse.json({ error: "A business name is required." }, { status: 400 });
    }
    data.businessName = businessName;
  }
  if (body.contactName !== undefined) {
    data.contactName = sanitiseHeaderText(body.contactName, 200) || null;
  }
  if (body.phone !== undefined) data.phone = sanitiseHeaderText(body.phone, 40) || null;
  if (body.notes !== undefined) {
    data.notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : null;
  }
  if (body.email !== undefined) {
    const email = sanitiseHeaderText(body.email, 254).toLowerCase();
    if (email && !isPlausibleEmail(email)) {
      return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
    }
    data.email = email || null;
  }
  // ── Where the phone rings, and in which hours ─────────────────────────
  //
  // Normalised through the same functions the calling gate reads with, so a
  // rep typing "ontario" or "Texas" gets the same answer the gate will give
  // rather than a stored string that silently never matches a jurisdiction.
  // An unrecognised value is a 400, not a null: silently dropping it would
  // leave the rep looking at "we do not know which state" after they just
  // told us.
  if (body.country !== undefined) {
    const raw = sanitiseHeaderText(body.country, 40);
    if (!raw) {
      data.country = null;
    } else {
      const country = normaliseCountry(raw);
      if (!country) {
        return NextResponse.json(
          { error: "Calling rules are only written for Canada and the United States so far." },
          { status: 400 },
        );
      }
      data.country = country;
    }
  }
  if (body.province !== undefined) {
    const raw = sanitiseHeaderText(body.province, 40);
    if (!raw) {
      data.province = null;
    } else {
      const province = normaliseSubdivision(raw);
      if (!province) {
        return NextResponse.json(
          { error: "That isn't a state or province we recognise." },
          { status: 400 },
        );
      }
      data.province = province;
    }
  }
  if (body.timeZone !== undefined) {
    const raw = sanitiseHeaderText(body.timeZone, 64);
    if (!raw) {
      data.timeZone = null;
    } else if (!isSalesSmsTimeZone(raw)) {
      // The SAME closed list the texting window uses. Two lists would let a
      // rep state a zone that governs their calls and not their texts, and
      // the prospect is in one place.
      return NextResponse.json(
        { error: "Pick one of the North American zones on the list." },
        { status: 400 },
      );
    } else {
      data.timeZone = raw;
    }
  }
  if (body.status !== undefined) {
    if (!isLeadStatus(body.status)) {
      return NextResponse.json({ error: "That isn't a pipeline status." }, { status: 400 });
    }
    data.status = body.status;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  // updateMany, not update: `update` takes a unique where, which would mean
  // looking the row up by id alone and checking the rep afterwards. Two steps,
  // and the window between them is where a scoping bug lives. This writes only
  // rows that satisfy BOTH halves, and a count of 0 is the refusal.
  const { count } = await db.salesLead.updateMany({
    where: leadWhere(rep.id, id),
    data,
  });
  if (!count) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, id),
    select: LEAD_SELECT,
  });

  // The dial view comes back with the write, not on a second fetch. Saying
  // where a business is IS the fix for "we cannot confirm this call is
  // allowed", so a PATCH that returned only the lead would leave that sentence
  // on screen after the rep had just answered it — a control that looks like it
  // did nothing.
  const phoneOptOut = lead?.phone
    ? await contactOptedOut(db, {
        leadId: lead.id,
        email: lead.email,
        phone: lead.phone,
        channel: "phone",
      })
    : { optedOut: false, reason: null };

  return NextResponse.json({
    lead,
    linkedCompany: await linkedCompanyFor(rep, lead),
    call: lead
      ? leadDialView(lead, {
          optedOut: phoneOptOut,
          windowPolicy: publicWindowPolicy(await windowPolicyForProspect(leadCallingContext(lead))),
        })
      : null,
    numbers: lead ? await contactNumbersFor(lead, { optedOut: phoneOptOut }) : null,
    serverNow: new Date().toISOString(),
  });
}
