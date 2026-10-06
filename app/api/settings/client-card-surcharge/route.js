// app/api/settings/client-card-surcharge/route.js
//
// Settings → Payments → "Pass the card fee on to clients who pay by credit
// card" (Company.clientCardSurcharge). The one writer of the three columns.
//
// GET   the card's whole state: whether it is shown at all (a Canadian
//       company — rule 8 in lib/stripe/clientCardSurcharge.js: no switch for
//       a US company, no dead control), whether this company may switch it
//       on (not Quebec; province known), whether the portal's card form can
//       exist (the Stripe.js key is configured), and — when on — who
//       confirmed the processor notice, and when.
// PATCH { enabled: true, noticeConfirmed: true } | { enabled: false }
//       Switching on REQUIRES noticeConfirmed: Visa and Mastercard require
//       the merchant to give its processor 30 days' written notice before
//       surcharging, and the merchant is the contractor (on_behalf_of in
//       lib/stripe.js). Who confirmed and when are recorded; switching off
//       clears them, so switching back on asks again.
//
// Owners and admins (user:manage), the same people who edit business info.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  clientCardSurchargeShown,
  companySurchargeStanding,
  clientCardSurchargeSettingOn,
} from "@/lib/stripe/clientCardSurcharge";
import { stripePublishableKey } from "@/lib/stripe/clientCardOffer";

const SELECT = {
  country: true,
  province: true,
  address: true,
  postalCode: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
  clientCardSurcharge: true,
  clientCardSurchargeNoticeConfirmedAt: true,
  clientCardSurchargeNoticeConfirmedById: true,
};

async function stateFor(company) {
  const shown = clientCardSurchargeShown(company);
  if (!shown) return { shown: false };
  const standing = companySurchargeStanding(company);
  const on = clientCardSurchargeSettingOn(company);
  let confirmedByName = null;
  if (on && company.clientCardSurchargeNoticeConfirmedById) {
    const user = await db.user.findUnique({
      where: { id: company.clientCardSurchargeNoticeConfirmedById },
      select: { name: true, email: true },
    });
    confirmedByName = user?.name || user?.email || null;
  }
  return {
    shown: true,
    allowed: standing.allowed,
    reason: standing.reason,
    formReady: Boolean(stripePublishableKey()),
    stripeConnected: Boolean(company.stripeAccountId && company.stripeChargesEnabled),
    on,
    confirmedAt: on ? company.clientCardSurchargeNoticeConfirmedAt : null,
    confirmedByName,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: SELECT });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await stateFor(company));
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "We couldn't read that request. Please try again." }, { status: 400 });
  }

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: SELECT });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.enabled === false) {
    await db.company.update({
      where: { id: member.companyId },
      data: {
        clientCardSurcharge: false,
        clientCardSurchargeNoticeConfirmedAt: null,
        clientCardSurchargeNoticeConfirmedById: null,
      },
    });
    await recordActivity(member, {
      action: "settings.client_card_surcharge_off",
      entityType: "settings",
      summary: "Stopped passing the credit card fee on to clients",
    });
    return NextResponse.json(
      await stateFor({ ...company, clientCardSurcharge: false, clientCardSurchargeNoticeConfirmedAt: null, clientCardSurchargeNoticeConfirmedById: null }),
    );
  }

  // ── Switching ON: every condition, server-side ──────────────────────────
  // The card hides or disables the switch for each of these too; hiding a
  // switch is not access control.
  if (!clientCardSurchargeShown(company)) {
    return NextResponse.json({ error: "A credit card fee can only be set up for a company in Canada." }, { status: 400 });
  }
  const standing = companySurchargeStanding(company);
  if (!standing.allowed) {
    return NextResponse.json(
      {
        error:
          standing.reason === "company_quebec"
            ? "Quebec's Consumer Protection Act does not allow a credit card fee, so it can't be switched on for a company in Quebec."
            : "Add your business province in Settings → Business info first — the fee depends on where you are.",
        reason: standing.reason,
      },
      { status: 400 },
    );
  }
  if (!stripePublishableKey()) {
    return NextResponse.json(
      { error: "Card payments with a fee aren't available yet — nothing would be charged, so the switch stays off." },
      { status: 409 },
    );
  }
  if (body.noticeConfirmed !== true) {
    return NextResponse.json(
      { error: "Confirm you gave your payment processor 30 days' written notice before switching this on." },
      { status: 400 },
    );
  }
  if (!member.userId) {
    // A read-only support session has no user of its own to record.
    return NextResponse.json({ error: "Only a signed-in owner or admin can confirm this." }, { status: 403 });
  }

  // Already on: the first confirmation stands (re-saving must not move the
  // date the notice was confirmed).
  if (clientCardSurchargeSettingOn(company)) return NextResponse.json(await stateFor(company));

  const now = new Date();
  await db.company.update({
    where: { id: member.companyId },
    data: {
      clientCardSurcharge: true,
      clientCardSurchargeNoticeConfirmedAt: now,
      clientCardSurchargeNoticeConfirmedById: member.userId,
    },
  });
  await recordActivity(member, {
    action: "settings.client_card_surcharge_on",
    entityType: "settings",
    summary: "Started passing the credit card fee on to clients (processor notice confirmed)",
    metadata: { noticeConfirmedAt: now.toISOString() },
  });
  return NextResponse.json(
    await stateFor({
      ...company,
      clientCardSurcharge: true,
      clientCardSurchargeNoticeConfirmedAt: now,
      clientCardSurchargeNoticeConfirmedById: member.userId,
    }),
  );
}
