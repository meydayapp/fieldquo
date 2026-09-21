// app/api/reviews/google/locations/route.js
//
// GET  the listings the connected Google account can manage, for the pick
//      list — every account, every location, live from Google.
// POST { accountName, locationName, locationTitle } — the one the company
//      chose. Stored on the connection; the first refresh follows.
//
// Both answer Google's refusal as the honest sentence lib/reviews/
// googleBusiness/sync.js quotaMessage() builds: a project whose quota is
// still 0 fails HERE, on the very first list, and the screen must say why.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { refuseUnlessAdmin } from "@/lib/reviews/testimonialAccess";
import { getBusinessConnection, setBusinessLocation, recordBusinessSyncOutcome } from "@/lib/reviews/googleBusiness/connection";
import { defaultBusinessGoogle } from "@/lib/reviews/googleBusiness/client";
import { quotaMessage, refreshCompanyReviews } from "@/lib/reviews/googleBusiness/sync";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const connection = await getBusinessConnection(member.companyId);
  if (!connection) return NextResponse.json({ error: "Google Business Profile is not connected." }, { status: 404 });

  const google = defaultBusinessGoogle;
  let token;
  try {
    token = await google.accessTokenFor(connection);
  } catch (err) {
    return NextResponse.json({ error: `Stored token could not be read: ${err?.message || "unknown"}`, kind: "auth" }, { status: 502 });
  }
  if (!token?.ok) {
    const { kind, message } = quotaMessage(token);
    await recordBusinessSyncOutcome(member.companyId, { error: message });
    return NextResponse.json({ error: message, kind }, { status: 502 });
  }

  const accounts = await google.listAccounts({ accessToken: token.accessToken });
  if (!accounts.ok) {
    const { kind, message } = quotaMessage(accounts);
    await recordBusinessSyncOutcome(member.companyId, { error: message });
    return NextResponse.json({ error: message, kind }, { status: 502 });
  }

  const out = [];
  for (const account of Array.isArray(accounts.data?.accounts) ? accounts.data.accounts : []) {
    let pageToken = null;
    do {
      const page = await google.listLocations({ accessToken: token.accessToken, accountName: account.name, pageToken });
      if (!page.ok) {
        const { kind, message } = quotaMessage(page);
        await recordBusinessSyncOutcome(member.companyId, { error: message });
        return NextResponse.json({ error: message, kind }, { status: 502 });
      }
      for (const loc of Array.isArray(page.data?.locations) ? page.data.locations : []) {
        const addr = loc.storefrontAddress || {};
        out.push({
          accountName: account.name,
          accountLabel: account.accountName || account.name,
          locationName: loc.name,
          title: loc.title || loc.name,
          address: [...(Array.isArray(addr.addressLines) ? addr.addressLines : []), addr.locality, addr.administrativeArea]
            .filter(Boolean)
            .join(", "),
        });
      }
      pageToken = page.data?.nextPageToken || null;
    } while (pageToken);
  }

  await recordBusinessSyncOutcome(member.companyId, {});
  return NextResponse.json({ locations: out });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const connection = await getBusinessConnection(member.companyId);
  if (!connection) return NextResponse.json({ error: "Google Business Profile is not connected." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
  const locationName = typeof body.locationName === "string" ? body.locationName.trim() : "";
  if (!/^accounts\/[^/]+$/.test(accountName) || !/^(accounts\/[^/]+\/)?locations\/[^/]+$/.test(locationName)) {
    return NextResponse.json({ error: "Pick a listing from the list." }, { status: 400 });
  }

  const updated = await setBusinessLocation(member.companyId, {
    accountName,
    locationName,
    locationTitle: typeof body.locationTitle === "string" ? body.locationTitle.trim().slice(0, 200) : null,
  });
  const result = await refreshCompanyReviews(updated);
  return NextResponse.json({ ok: true, refresh: result });
}
