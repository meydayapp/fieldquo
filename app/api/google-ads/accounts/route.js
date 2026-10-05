// app/api/google-ads/accounts/route.js
//
// GET   the ad accounts the connected Google user can import from — the ones
//       it reaches directly and the client accounts under any manager (MCC)
//       it reaches — live from Google, for the picker.
// POST  { customerId } — the one the company chose. The choice is checked
//       against a FRESH list from Google, and the login-customer-id, name and
//       currency are taken from Google's answer, never from the browser: a
//       body cannot point the sync at an account this grant cannot read, or
//       name a manager it is not under. The first sync (90 days) follows.
//
// Owner/admin only, like every write under app/api/google-ads.
export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { defaultGoogleAds, listAdAccountOptions, cleanCustomerId } from "@/lib/googleAds/client";
import { getGoogleAdsConnection, setGoogleAdsAccount, recordGoogleAdsSync } from "@/lib/googleAds/connection";
import { syncGoogleAdsCompany, statusForKind, MAX_SYNC_DAYS } from "@/lib/googleAds/sync";
import { recordActivity } from "@/lib/activity/log";

async function optionsFor(connection) {
  let token;
  try {
    token = await defaultGoogleAds.accessTokenFor(connection);
  } catch {
    return { ok: false, kind: "decrypt", message: "The stored Google Ads token could not be read. Disconnect and connect again." };
  }
  if (!token?.ok) return token;
  return listAdAccountOptions({ accessToken: token.accessToken });
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // Not for a read-only support session, even though it reads as the owner:
  // this GET spends the COMPANY's Google credential on a live call to Google
  // (and stamps the connection on failure). Everything support needs to SEE —
  // the chosen account, the last sync, Google's last refusal — is on
  // /api/google-ads/status, which does admit it.
  if (member.impersonation) {
    return NextResponse.json({ error: "Support sessions don't call Google with the company's credentials." }, { status: 403 });
  }
  if (!isBillingAdmin(member.role)) return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });

  const connection = await getGoogleAdsConnection(member.companyId);
  if (!connection) return NextResponse.json({ error: "Google Ads is not connected." }, { status: 404 });

  const res = await optionsFor(connection);
  if (!res.ok) {
    await recordGoogleAdsSync(member.companyId, { status: statusForKind(res.kind), error: res.message });
    return NextResponse.json({ error: res.message, kind: res.kind }, { status: 502 });
  }
  return NextResponse.json({ options: res.options, failures: res.failures });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });

  const connection = await getGoogleAdsConnection(member.companyId);
  if (!connection) return NextResponse.json({ error: "Google Ads is not connected." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const wanted = cleanCustomerId(body?.customerId);
  if (!wanted) return NextResponse.json({ error: "Pick an account from the list." }, { status: 400 });

  const res = await optionsFor(connection);
  if (!res.ok) return NextResponse.json({ error: res.message, kind: res.kind }, { status: 502 });
  const chosen = res.options.find((o) => o.customerId === wanted);
  if (!chosen) {
    return NextResponse.json({ error: "That account isn't one this Google login can read. Pick one from the list." }, { status: 400 });
  }

  const updated = await setGoogleAdsAccount(member.companyId, {
    customerId: chosen.customerId,
    loginCustomerId: chosen.loginCustomerId,
    customerName: chosen.name,
    currencyCode: chosen.currency,
  });
  await recordActivity(member, {
    action: "marketing_spend.google_ads_account_chosen",
    entityType: "company",
    entityId: member.companyId,
    summary: `Chose Google Ads account ${chosen.name || chosen.customerId} to import spend from`,
  });

  // The first import covers the longest window a sync allows, behind the
  // response — the card says "Sync running" and the next status read shows
  // its outcome.
  after(async () => {
    try {
      await syncGoogleAdsCompany(updated, { days: MAX_SYNC_DAYS });
    } catch (err) {
      console.error("[google-ads] first sync after account pick failed:", err?.message);
    }
  });

  return NextResponse.json({ ok: true, account: { customerId: chosen.customerId, name: chosen.name, currency: chosen.currency } });
}
