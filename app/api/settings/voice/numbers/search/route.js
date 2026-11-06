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
import { findNumbersForCity } from "@/lib/voice/cityNumbers";
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
  // text asks the question the contractor is actually asking, and gives
  // lib/voice/cityNumbers.js the province and the municipality it needs to
  // recognise Twilio's spelling when it sees it. Null on any failure (no key,
  // no match), and the area-code search below still runs, so a geocoding
  // outage degrades to the older behaviour instead of breaking.
  //
  // ── Why the company's country is a SECOND attempt and not a prefix ─────
  //
  // Appending it always is wrong the moment the contractor types a city
  // somewhere else: "New York City, ON, CA" is not a place, and a company in
  // Ontario asking for Vancouver would be steered to the wrong one.
  //
  // Not appending it at all is wrong too, and the owner found that one: an
  // Ottawa contractor typing "Orleans" — a suburb of his own city — was sent
  // to Orléans, FRANCE, which Google returns with a perfectly good region and
  // country and no sign at all that it is absurd.
  //
  // Google itself settles which is which. It flags a match where it had to
  // IGNORE part of the query as a partial one:
  //
  //   "Orleans, ON, CA"         → Orléans, Ottawa, ON    partial_match false
  //   "New York City, ON, CA"   → New York, NY, USA      partial_match TRUE
  //
  // The flag alone is not enough, and the case that proves it is Miami: there
  // is a Miami in MANITOBA, and "Miami, ON, CA" returns it with partial_match
  // FALSE even though Google quietly dropped the province. Taking that would
  // send a contractor who meant Florida to a village of 500 people.
  //
  // So the hint is tried only when the bare text lands outside the company's
  // own country (or nowhere at all), and taken only when Google honoured the
  // WHOLE hint — province included — and said so. A contractor who really
  // means another country keeps getting it; one who means the next
  // neighbourhood over stops getting France.
  let near = null;
  if (askedCity) {
    const homeCountry = String(company?.country || "CA").toUpperCase();
    const homeRegion = company?.province ? String(company.province).toUpperCase() : null;
    let point = await geocodeAddress(askedCity).catch(() => null);
    if (!point?.region || String(point.country || "").toUpperCase() !== homeCountry) {
      const hint = [askedCity, company?.province, homeCountry].filter(Boolean).join(", ");
      const hinted = await geocodeAddress(hint).catch(() => null);
      const honoured =
        hinted?.region &&
        !hinted.partialMatch &&
        String(hinted.country || "").toUpperCase() === homeCountry &&
        (!homeRegion || String(hinted.region).toUpperCase() === homeRegion);
      if (honoured) point = hinted;
      else if (!point) point = hinted;
    }
    if (point) {
      near = {
        lat: point.lat,
        lng: point.lng,
        place: point.formattedAddress || askedCity,
        // Google's own answer for which province/state and country this city
        // is in. Both are load-bearing below; neither is guessed.
        region: point.region || null,
        country: point.country || null,
        // And the municipality, which is how a suburb reaches its city's
        // exchange: "Kanata" geocodes with locality "Ottawa".
        locality: point.locality || null,
      };
    }
  }

  try {
    // ── The city by NAME first, and the point only after ───────────────
    //
    // Three things were wrong here and all three were visible from Ottawa.
    //
    // The radius loop stopped at the first non-empty answer, so it filled up
    // on the Gatineau inventory 25 miles away — Quebec, and the very area code
    // the contractor is trying to escape. Widening past that got the province
    // right and the city wrong: Brockville and Hawkesbury 343s, an hour out.
    //
    // And it could never have got Ottawa right, because Twilio holds no
    // latitude, longitude or postal code for the OTTAWAHULL rate centre that
    // actually serves the city. A point search is structurally blind to it.
    // lib/voice/cityNumbers.js has the measurements and the order it searches
    // in; the province check that used to live here is now its last step but
    // one, unchanged, so nothing it adds can return less than this did.
    //
    // The country still comes from the CITY, not the company. It was pinned to
    // the company's, so a Canadian contractor typing "New York City" asked
    // Twilio for Canadian numbers near Manhattan and was told, accurately and
    // uselessly, that there were none.
    const searchCountry = near?.country || company?.country || "CA";
    let result = null;
    if (near) {
      result = await findNumbersForCity({
        typed: askedCity,
        near: { ...near, country: searchCountry },
      });
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
