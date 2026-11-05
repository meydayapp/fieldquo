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
import { geocodeAddress } from "@/lib/measure/roofMeasurement";

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
  // ── A typed city, because an area code is not a place ──────────────────
  //
  // 819 runs from Gatineau to Rouyn-Noranda, a five-hour drive apart, and a
  // contractor handed "the right area code" from the far end of it gets taken
  // for a spammer by his own neighbours. The picker already PRINTS each
  // number's city, but with only an area code to search on there was no way to
  // ask for one: you got six of whatever 819 inventory was free and hoped.
  //
  // Capped rather than validated against a list of cities. Twilio's inventory
  // is the authority on what it will match, and a table of ours would be the
  // city→area-code guess lib/voice/numberSearch.js refuses to keep.
  const askedCity = String(searchParams.get("city") || "").trim().slice(0, 60);

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
  // The city WINS, and the area code is dropped rather than ANDed with it.
  // searchLocalNumbers explains why (a Gatineau search should return its 873
  // numbers too, which an AND would hide) — and here it is also the point: the
  // area code is the thing the contractor is trying to get away from.
  const areaCode = askedCity
    ? null
    : asked
      ? String(asked).replace(/[^\d]/g, "")
      : fallback.areaCode;

  // ── A typed city becomes a POINT, not a name ──────────────────────────
  //
  // Twilio matches localities exactly against its own rate-centre vocabulary,
  // and "Ottawa" is not in it — the rate centre is "Ottawahull", so the city
  // this most needs to serve returns nothing for its own name. Geocoding the
  // text asks the question the contractor is actually asking. Null on any
  // failure (no key, no match), and the exact-name search below still runs,
  // so a geocoding outage degrades to today's behaviour instead of breaking.
  //
  // The city is geocoded on its OWN first. The company's province used to be
  // appended always, which is wrong the moment the contractor types a city
  // somewhere else: "New York City, ON, CA" is not a place, and a company in
  // Ontario asking for Vancouver would be steered to the wrong one. So the
  // hint is a SECOND attempt, used only when the bare text does not resolve
  // to a locality — "Kanata" alone comes back as just "Ontario, Canada".
  let near = null;
  if (askedCity) {
    const attempts = [askedCity, [askedCity, company?.province, company?.country || "CA"].filter(Boolean).join(", ")];
    for (const hint of attempts) {
      const point = await geocodeAddress(hint).catch(() => null);
      if (!point) continue;
      near = {
        lat: point.lat,
        lng: point.lng,
        place: point.formattedAddress || askedCity,
        // Google's own answer for which province/state and country this city
        // is in. Both are load-bearing below; neither is guessed.
        region: point.region || null,
        country: point.country || null,
      };
      if (point.region) break;
    }
  }

  try {
    // ── Near the city, and in the city's OWN province ──────────────────
    //
    // Two things were wrong here and both were visible from Ottawa.
    //
    // The radius loop stopped at the first non-empty answer. Twilio's free
    // inventory within 25 miles of downtown Ottawa is ENTIRELY Gatineau and
    // Buckingham — 819 and 873, across the river in Quebec — so the loop
    // filled up on the very area code the contractor is trying to escape and
    // never widened. At 60 miles the same search is mostly Ontario 343, the
    // Ottawa overlay. So the loop now keeps widening until it has numbers
    // whose REGION matches the city's, and only settles for out-of-region
    // ones when no radius produced any.
    //
    // Region, not area code, is the test. lib/voice/numberSearch.js refuses
    // to carry a city→area-code table and it is right to: naming 613 here
    // would be a guess that gets BOUGHT. But Google says which province the
    // typed city is in and Twilio says which province each number is in, so
    // matching them is two pieces of real data agreeing, not an invention.
    // A homeowner reads the area code, and a 343 rate-centred in Hawkesbury
    // is an Ottawa number to them in a way an 819 in Gatineau is not.
    //
    // And the country comes from the CITY, not the company. It was pinned to
    // the company's, so a Canadian contractor typing "New York City" asked
    // Twilio for Canadian numbers near Manhattan and was told, accurately
    // and uselessly, that there were none.
    const searchCountry = near?.country || company?.country || "CA";
    let result = null;
    if (near) {
      let widest = null;
      for (const distanceMiles of [25, 60, 150]) {
        const tried = await searchLocalNumbers({ country: searchCountry, near: { ...near, distanceMiles } });
        if (tried.numbers?.length) widest = tried;
        const inRegion = near.region
          ? (tried.numbers || []).filter((n) => n.region && n.region === near.region)
          : tried.numbers || [];
        if (inRegion.length) {
          result = { ...tried, numbers: inRegion };
          break;
        }
      }
      // Nothing in the city's own province at any radius. Better to show the
      // neighbours than an empty list — the screen names the place and the
      // radius, so what is on offer is never mistaken for a local number.
      if (!result) result = widest;
    }
    if (!result) result = await searchLocalNumbers({
      country: searchCountry,
      areaCode,
      // Only consulted when there is no area code at all — a company with no
      // phone on file. The area codes then come back from real inventory near
      // their city rather than from a guess of ours.
      // The typed city when there is one, else the company's own — the
      // latter still only consulted when no area code was derived either.
      locality: askedCity || company?.city || null,
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
