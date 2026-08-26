// app/api/settings/voice/numbers/search/route.js
//
// Which numbers are actually free, in the area code the contractor asked for.
//
//   GET ?areaCode=819           → numbers in 819
//   GET            (no areaCode) → numbers near the company's own city/province
//
// Read-only. Nothing here reserves, holds or buys anything — Twilio has no
// concept of holding an available number, and pretending otherwise ("reserved
// for you for 10 minutes") would be a promise no API call backs. The purchase
// route re-checks the chosen number immediately before it spends a penny.
//
// ── Why the search runs on the SERVER ──────────────────────────────────────
//
// The obvious alternative is to let the browser talk to Twilio. It cannot: the
// credentials are account-wide (lib/sms/twilioClient.js) and they send SMS and
// manage this account's numbers. They never reach a client bundle.
//
// ── Not a price list ───────────────────────────────────────────────────────
//
// Non-negotiable #4 is about PUBLIC endpoints, and this is behind an admin
// session, so returning the rental here would break nothing. It still doesn't:
// the monthly price is already on the screen from /api/settings/voice, priced
// from our own rows, and a second source for the same number is how the price
// shown and the price charged come apart. One number, one origin.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import {
  searchLocalNumbers,
  defaultAreaCode,
  isUsableAreaCode,
} from "@/lib/voice/numberSearch";

export async function GET(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  // `Plain` means a plain OBJECT — `{ error, status }`, not a Response. Returning
  // it straight from a route handler hands Next a bare object and the refusal
  // never becomes a 401. Wrapped, the way every other caller of this helper does.
  if (refusal) {
    const { status, ...body } = refusal;
    return NextResponse.json(body, { status });
  }

  // Same gate as buying one. This is a step INSIDE the purchase flow, not a
  // browsable directory, and an employee who cannot buy a number has no reason
  // to be shopping for one. Impersonation gets no carve-out either: the
  // platform console views a company's settings, and a live inventory search is
  // not one of them.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const asked = searchParams.get("areaCode");

  // A typed area code that isn't one is refused rather than quietly ignored.
  // Dropping it would search the company's city instead and return numbers in a
  // different area code entirely — which looks exactly like a search that
  // worked, and is the failure this whole feature exists to remove.
  if (asked && !isUsableAreaCode(asked)) {
    return NextResponse.json(
      {
        errorKey: "app.setVoice.pick.badAreaCode",
        error: "An area code is three digits, and doesn't start with 0 or 1.",
      },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    // Everything the search may key on, and nothing else. `phone` is the only
    // field that STATES an area code; city and province narrow a search without
    // naming one. See lib/voice/numberSearch.js for why there is no table here.
    select: { phone: true, city: true, province: true, country: true },
  });

  const fallback = defaultAreaCode(company);
  const areaCode = asked ? String(asked).replace(/[^\d]/g, "") : fallback.areaCode;

  try {
    const result = await searchLocalNumbers({
      country: company?.country || "CA",
      areaCode,
      // Only consulted when there is no area code at all — a company with no
      // phone on file. The area codes then come back from real inventory near
      // their city rather than from a guess of ours.
      locality: company?.city || null,
      region: company?.province || null,
    });

    return NextResponse.json({
      numbers: result.numbers,
      searched: result.searched,
      configured: result.configured,
      // Which area code the box should show, and why. Sent back on every
      // search so a contractor who cleared the box and got city results can see
      // that we fell back rather than ignored them.
      defaultAreaCode: fallback.areaCode,
      defaultAreaCodeFrom: fallback.from,
    });
  } catch (err) {
    // An empty list means "we looked and there is nothing free", which is a
    // routine answer for a busy area code — 416 and 514 both return zero
    // against real Twilio inventory. A THROWN search means we could not look at
    // all. The screen renders those two differently, so they must not arrive
    // looking the same. See scripts/check-empty-vs-error.mjs.
    console.error("[voice/numbers/search] failed", err?.message || err);
    return NextResponse.json(
      {
        errorKey: "app.setVoice.pick.searchFailed",
        error: "We couldn't check which numbers are free just now. Nothing has been charged.",
      },
      { status: 502 },
    );
  }
}
