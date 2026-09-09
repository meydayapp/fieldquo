// app/api/platform/sales/registrations/route.js
//
// Recording a telemarketer registration certificate FieldQuo actually holds.
//
// ══ Why this is a route and not a code edit ═══════════════════════════════
//
// It used to be a code edit. The campaigns screen listed thirteen gated
// jurisdictions and ended with "flip registration.done in
// lib/sales/callingRules.js when a certificate is in hand, citing the number in
// the commit" — which is a screen telling its own owner to go and edit source.
// He said so.
//
// The instinct behind it was right and is kept: nothing in this software can
// know whether a certificate exists. What was wrong is the conclusion. A
// constant in a source file records no number, no date, no author, and above
// all no EXPIRY — and most of these registrations renew annually. A boolean
// goes on saying "registered" for as long as nobody re-reads the file, which is
// exactly the shape of failure the calling gate exists to prevent.
//
// So a human still attests, and now the attestation is a row with a number on
// it, a date it runs from, a date it runs out, and the admin who recorded it.
//
// ══ Superadmin, not admin ═════════════════════════════════════════════════
//
// This is the control that decides whether FieldQuo may lawfully telephone
// people in a state, and getting it wrong in the permissive direction is a
// criminal offence in Vermont and a fifth-degree felony in Ohio. It sits
// behind the same gate as the pricing of a migration — SUPERADMIN_ONLY, via
// superadminOrRefusal, the way every other irreversible platform control does.
//
// ══ What it refuses ═══════════════════════════════════════════════════════
//
// A key the law file has never read; a blank certificate number; a
// registration date that is not a date. It does NOT refuse a certificate dated
// in the future or one that has already expired — both are things a person may
// legitimately need to record, and lib/sales/registrations.js makes them gate
// nothing until they are live. Refusing to record a fact is not the same as
// refusing to act on it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { CALLING_JURISDICTIONS } from "@/lib/sales/callingRules";
import { isKnownJurisdictionKey, registrationStatus, expiringSoon } from "@/lib/sales/registrations";

const MAX_NUMBER = 120;
const MAX_NOTE = 2000;
const MAX_REASON = 500;

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/** Every row, plus what each one means, so the screen computes nothing itself. */
async function payload(now = new Date()) {
  const rows = await db.salesTelemarketerRegistration.findMany({
    orderBy: { jurisdictionKey: "asc" },
    include: { recordedBy: { select: { email: true } } },
  });

  // Every jurisdiction the law file says requires one — not just the ones with
  // a row. A screen built from the rows alone would show the registrations we
  // hold and silently omit the twelve we do not, which is the list that
  // matters.
  const required = Object.keys(CALLING_JURISDICTIONS).filter(
    (code) => CALLING_JURISDICTIONS[code]?.registration?.required === true,
  );

  return {
    jurisdictions: required.map((code) => ({
      ...registrationStatus(code, rows, { now }),
      name: CALLING_JURISDICTIONS[code].name,
      what: CALLING_JURISDICTIONS[code].registration?.what || null,
      recordedBy: rows.find((r) => r.jurisdictionKey === code)?.recordedBy?.email || null,
    })),
    expiringSoon: expiringSoon(rows, { now }).map((r) => ({
      jurisdictionKey: r.jurisdictionKey,
      name: CALLING_JURISDICTIONS[r.jurisdictionKey]?.name || r.jurisdictionKey,
      expiresAt: r.expiresAt,
    })),
    serverNow: now.toISOString(),
  };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  return NextResponse.json(await payload());
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");

  const jurisdictionKey = String(body.jurisdictionKey ?? "").trim();
  // Checked against the LAW FILE, not against a list of strings. A typo'd key
  // would store cleanly and then match nothing in the overlay — a filing that
  // looks recorded on this screen and gates precisely nothing at the dial.
  if (!isKnownJurisdictionKey(jurisdictionKey)) {
    return bad("That is not a jurisdiction the calling rules have read.");
  }
  if (CALLING_JURISDICTIONS[jurisdictionKey]?.registration?.required !== true) {
    return bad(
      `${CALLING_JURISDICTIONS[jurisdictionKey].name} does not require a telemarketer registration, ` +
        "so there is nothing to record against it.",
    );
  }

  const certificateNumber = String(body.certificateNumber ?? "").trim().slice(0, MAX_NUMBER);
  // The field that makes somebody go and look at the document. A tick box with
  // no number is a tick box anybody can tick from memory.
  if (!certificateNumber) {
    return bad("The certificate or registration number is required — it is what makes this auditable.");
  }

  const registeredAt = body.registeredAt ? new Date(body.registeredAt) : null;
  if (!registeredAt || Number.isNaN(registeredAt.getTime())) {
    return bad("Give the date the registration took effect, as printed on the certificate.");
  }

  // Three-valued on purpose. `expiresAt: null` sent WITH `neverExpires: true`
  // means "this one does not lapse"; sent without it, the screen has not asked.
  // Absence of a statement is not a statement — AGENTS.md failure class #5, and
  // the one that would quietly make an annual registration permanent.
  const neverExpires = body.neverExpires === true;
  let expiresAt = null;
  if (!neverExpires) {
    expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
      return bad(
        "Give the date it lapses, or say it does not expire. Most of these renew annually, and a " +
          "registration with no end date recorded is one nobody renews.",
      );
    }
    if (expiresAt <= registeredAt) {
      return bad("It cannot lapse before it takes effect.");
    }
  }

  const note = typeof body.note === "string" ? body.note.slice(0, MAX_NOTE) : null;

  const data = {
    certificateNumber,
    registeredAt,
    expiresAt,
    note: note || null,
    recordedByAdminId: admin.id,
    // A renewal REPLACES, and clears any earlier revocation: recording a new
    // certificate for a jurisdiction whose last one was surrendered is exactly
    // what a renewal after a lapse looks like.
    revokedAt: null,
    revokedReason: null,
  };

  await db.salesTelemarketerRegistration.upsert({
    where: { jurisdictionKey },
    create: { jurisdictionKey, ...data },
    update: data,
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_telemarketer_registration_recorded",
      details: {
        jurisdictionKey,
        name: CALLING_JURISDICTIONS[jurisdictionKey].name,
        certificateNumber,
        registeredAt: registeredAt.toISOString(),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        neverExpires,
      },
    },
  });

  return NextResponse.json(await payload());
}

/**
 * Withdraw a certificate. Never a delete.
 *
 * Surrendered, refused on renewal, or entered against the wrong state. The row
 * stays — what FieldQuo believed about its own compliance, and when, is the
 * history a regulator asks for, and it is the same argument SalesSuppression
 * makes for keeping rows nobody wants any more.
 */
export async function DELETE(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const jurisdictionKey = String(body?.jurisdictionKey ?? "").trim();
  if (!isKnownJurisdictionKey(jurisdictionKey)) {
    return bad("That is not a jurisdiction the calling rules have read.");
  }
  const reason = String(body?.reason ?? "").trim().slice(0, MAX_REASON);
  // The same rule the do-not-contact write follows: a permanent-feeling change
  // with no reason recorded cannot be reviewed by anybody later.
  if (!reason) return bad("Say why it is being withdrawn — surrendered, lapsed, or recorded in error.");

  const { count } = await db.salesTelemarketerRegistration.updateMany({
    where: { jurisdictionKey, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  if (!count) return bad("There is no live certificate recorded for that jurisdiction.", 404);

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_telemarketer_registration_withdrawn",
      details: { jurisdictionKey, name: CALLING_JURISDICTIONS[jurisdictionKey].name, reason },
    },
  });

  return NextResponse.json(await payload());
}
