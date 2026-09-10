// app/api/sales/calls/numbers/route.js
//
// "Call him on his cell, 613-555-0142" — written down, and then dialable.
//
// ══ Why this route exists ═════════════════════════════════════════════════
//
// The owner named the gap: "in the queue there's no ability to update and make
// changes to the lead, no ability to free dial and call a different number."
// That is the ordinary shape of a real call — the number on the listing is the
// shop, somebody answers and hands you the owner's mobile — and until now a
// rep could neither record it nor ring it. They wrote it in a note nothing
// could dial, or lost it.
//
// ══ Why it sits under /calls and rides the CALLING gate ═══════════════════
//
// lib/sales/calls/gate.js already argues the shape of this exception, for
// SalesSuppression: "the rep on the phone is the person who HEARS 'take me off
// your list'". The same sentence with a different object is the whole case
// here — the rep on the phone is the person who hears "call him on his cell".
// A number given during a call is a product of that call, recorded by the
// person who took it, and it belongs on the same short list rather than in a
// gate of its own. REP_CALL_WRITES names `salesContactNumber`, and
// scripts/check-sales-call-handling.mjs holds these routes to that list.
//
// It is NOT on the queue gate's list, which stays exactly one model
// (`prospect`) — check:prospect-ui asserts that, and widening it would make
// the narrowest list in the sales portal the widest.
//
// ══ What it never does ════════════════════════════════════════════════════
//
// It never touches Prospect.phoneE164 or SalesLead.phone. Those are IDENTITY:
// the dedupe key discovery matches on and the number every existing suppression
// row, call attempt and text is keyed against. A rep correcting one on the
// strength of a phone call would silently re-point the deduplication of an
// org-wide row and orphan its history. A new number is a new row, and the
// picker decides which one gets used.
//
// It also deletes nothing. Correcting what a number IS — a label, whether it
// takes texts — is a PATCH on that row; a number recorded in error stays on
// the record with `canCall: false` / `canText: false`, which is a statement a
// later rep can read, rather than a gap that invites re-typing it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { queueWhere } from "@/lib/sales/prospectView";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { ownNumbers } from "@/lib/sales/calls/store";
import {
  CHANNEL_TEXT,
  CHANNEL_VOICE,
  KINDS,
  KIND_UNKNOWN,
  isKind,
} from "@/lib/sales/contact/numbers";
import {
  contactNumberStoreReady,
  loadContactNumbers,
  pickContactNumber,
} from "@/lib/sales/contact/resolve";

const MAX_LABEL = 80;
const MAX_NOTE = 500;

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * The record this rep may hang a number on, read fresh and scoped to them.
 *
 * The scoping fragments are the shared ones — queueWhere() for a claim,
 * salesRepId for a lead — rather than an inline copy, because an inline copy
 * is the one that rots. A record held by somebody else matches nothing and
 * comes back 404, which is also what it should say: a 403 confirms it exists.
 *
 * A number given about a business that HAS a discovered row hangs on the
 * business, with the lead recorded beside it. That is not bookkeeping: the
 * number is a fact about the contractor, not about one rep's piece of paper,
 * and hanging it on the lead alone would hide it from the queue screen where
 * the next rep to claim them is about to dial.
 */
async function ownerFor(repId, { prospectId, leadId }) {
  if (prospectId) {
    const prospect = await db.prospect.findFirst({
      where: { id: prospectId, ...queueWhere(repId) },
      select: { id: true, businessName: true, phoneE164: true, doNotContactAt: true },
    });
    if (!prospect) return null;
    return {
      prospectId: prospect.id,
      salesLeadId: null,
      name: prospect.businessName,
      phoneE164: prospect.phoneE164,
      doNotContactAt: prospect.doNotContactAt,
    };
  }
  if (leadId) {
    const lead = await db.salesLead.findFirst({
      where: { id: leadId, salesRepId: repId },
      select: {
        id: true,
        businessName: true,
        phone: true,
        prospectId: true,
        prospect: { select: { id: true, phoneE164: true, doNotContactAt: true } },
      },
    });
    if (!lead) return null;
    return {
      prospectId: lead.prospect?.id || null,
      salesLeadId: lead.id,
      name: lead.businessName,
      phoneE164: normalisePhone(lead.phone) || lead.prospect?.phoneE164 || null,
      doNotContactAt: lead.prospect?.doNotContactAt || null,
    };
  }
  return null;
}

/** Which record the caller means, from either handler's inputs. */
function idsFrom(source) {
  return {
    prospectId: typeof source?.prospectId === "string" ? source.prospectId.trim() : "",
    leadId: typeof source?.leadId === "string" ? source.leadId.trim() : "",
  };
}

/**
 * A three-valued flag off the wire.
 *
 * `undefined` and `null` both mean "nobody said", and that is NOT false —
 * AGENTS.md failure class #5. Only a real boolean becomes a real boolean, so a
 * form that leaves the question blank stores a null and lib/sales/contact/
 * numbers.js falls back to what the KIND implies.
 */
function tristate(value) {
  if (value === true || value === false) return value;
  return null;
}

const unavailable = () =>
  NextResponse.json(
    {
      error:
        "SalesContactNumber is not in the database on this deployment, so extra numbers cannot " +
        "be recorded yet. Run `npx prisma db push`.",
      missing: ["SalesContactNumber"],
    },
    { status: 503 },
  );

/** Everything both handlers return, so the screen never sees two shapes. */
async function view(owner, { client = db } = {}) {
  const [rows, ours] = await Promise.all([
    loadContactNumbers({
      prospectId: owner.prospectId,
      salesLeadId: owner.salesLeadId,
      client,
    }),
    ownNumbers({ client }).catch(() => []),
  ]);

  const target = { phoneE164: owner.phoneE164 };
  // Both channels, because they genuinely differ: a landline is offered for a
  // call and refused for a text, and a screen that showed one list would be
  // wrong on whichever channel it was not built for.
  const voice = pickContactNumber({ target, rows, channel: CHANNEL_VOICE, ourNumbers: ours });
  const text = pickContactNumber({ target, rows, channel: CHANNEL_TEXT, ourNumbers: ours });

  return {
    record: {
      prospectId: owner.prospectId,
      leadId: owner.salesLeadId,
      businessName: owner.name,
      phoneE164: owner.phoneE164,
      doNotContact: Boolean(owner.doNotContactAt),
    },
    numbers: rows.map((r) => ({
      id: r.id,
      e164: r.e164,
      kind: r.kind,
      label: r.label,
      canCall: r.canCall,
      canText: r.canText,
      preferred: r.preferred,
      note: r.note,
      createdAt: r.createdAt,
    })),
    voice: { choices: voice.choices, refused: voice.refused, reason: voice.code },
    text: { choices: text.choices, refused: text.refused, reason: text.code },
    kinds: KINDS,
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const owner = await ownerFor(rep.id, idsFrom(Object.fromEntries(url.searchParams)));
  if (!owner) return bad("That record is not yours to work.", 404);
  if (!contactNumberStoreReady(db)) return unavailable();

  return NextResponse.json(await view(owner));
}

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");

  const owner = await ownerFor(rep.id, idsFrom(body));
  if (!owner) return bad("That record is not yours to work.", 404);
  if (!contactNumberStoreReady(db)) return unavailable();

  // Refused rather than stored. A business that asked us to stop must not
  // acquire a new dialable number on our side — offering their cell because it
  // arrived later would be the same call they refused.
  if (owner.doNotContactAt) {
    return bad(
      "This business asked not to be contacted, so no further numbers are recorded for them.",
      409,
    );
  }

  // Normalised through the SAME function the suppression list, the calling gate
  // and Twilio key on. A number stored in any other shape is a number no
  // suppression row can ever match — it would look clean forever.
  const e164 = normalisePhone(body.e164 ?? body.number ?? body.phone);
  if (!e164) {
    return bad(
      "That isn't a number we can dial. Put it in full, with the country code — nothing here " +
        "guesses the missing digits.",
    );
  }

  const kind = isKind(body.kind) ? body.kind : KIND_UNKNOWN;
  const data = {
    prospectId: owner.prospectId,
    salesLeadId: owner.salesLeadId,
    e164,
    kind,
    label: typeof body.label === "string" ? body.label.trim().slice(0, MAX_LABEL) || null : null,
    canCall: tristate(body.canCall),
    canText: tristate(body.canText),
    preferred: body.preferred === true,
    addedBySalesRepId: rep.id,
    note: typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) || null : null,
  };

  // ── The same number twice, which is the ordinary case ───────────────────
  //
  // A rep is on the phone while typing. They will re-enter a number that is
  // already on the record — because they forgot, or because they are
  // correcting what they were told the first time. Two identical rows would be
  // two indistinguishable entries in the dial picker, so the second write
  // UPDATES the first rather than adding to it, and the response says which
  // happened. The database's own unique constraint is the backstop for the
  // race, not the read below.
  const existing = (
    await loadContactNumbers({
      prospectId: owner.prospectId,
      salesLeadId: owner.salesLeadId,
    })
  ).find((r) => normalisePhone(r.e164) === e164);

  let updated = false;
  if (existing) {
    await db.salesContactNumber.updateMany({
      where: { id: existing.id },
      data: { ...data, prospectId: undefined, salesLeadId: undefined },
    });
    updated = true;
  } else {
    try {
      await db.salesContactNumber.create({ data });
    } catch (err) {
      // P2002 means another tab won the race a moment ago. That is the same
      // outcome the rep asked for, so it is a success with the second write
      // folded into the first rather than an error they cannot act on.
      if (err?.code !== "P2002") throw err;
      const race = (
        await loadContactNumbers({
          prospectId: owner.prospectId,
          salesLeadId: owner.salesLeadId,
        })
      ).find((r) => normalisePhone(r.e164) === e164);
      if (!race) throw err;
      await db.salesContactNumber.updateMany({
        where: { id: race.id },
        data: { ...data, prospectId: undefined, salesLeadId: undefined },
      });
      updated = true;
    }
  }

  return NextResponse.json({ ok: true, updated, ...(await view(owner)) }, { status: updated ? 200 : 201 });
}

export async function PATCH(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");

  const owner = await ownerFor(rep.id, idsFrom(body));
  if (!owner) return bad("That record is not yours to work.", 404);
  if (!contactNumberStoreReady(db)) return unavailable();

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return bad("Which number?");

  // The row is found INSIDE the set already scoped to this record, the same
  // way the dial route resolves a chosen number. A number id belonging to a
  // different prospect is not in the set, so there is no comparison to forget.
  const rows = await loadContactNumbers({
    prospectId: owner.prospectId,
    salesLeadId: owner.salesLeadId,
  });
  const row = rows.find((r) => r.id === id);
  if (!row) return bad("That number is not on this record.", 404);

  const data = {};
  if (body.kind !== undefined) {
    if (!isKind(body.kind)) return bad("A number is a mobile, a landline, or unknown.");
    data.kind = body.kind;
  }
  if (body.label !== undefined) {
    data.label = typeof body.label === "string" ? body.label.trim().slice(0, MAX_LABEL) || null : null;
  }
  if (body.note !== undefined) {
    data.note = typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) || null : null;
  }
  // Explicitly settable back to null — "I was wrong, nobody actually said" is
  // a correction a rep has to be able to make, and a field that can only ever
  // go from unknown to stated is a field that records the first guess for ever.
  if (body.canCall !== undefined) data.canCall = tristate(body.canCall);
  if (body.canText !== undefined) data.canText = tristate(body.canText);
  if (body.preferred !== undefined) data.preferred = body.preferred === true;

  if (!Object.keys(data).length) return bad("Nothing to change.");

  await db.salesContactNumber.updateMany({ where: { id: row.id }, data });

  return NextResponse.json({ ok: true, ...(await view(owner)) });
}
