// lib/voice/cityNumbers.js
//
// "I typed Ottawa and you showed me Brockville."
//
// ══ Why the obvious search cannot answer that ══════════════════════════════
//
// The picker used to hand Twilio a geocoded POINT and a radius, which is the
// question a contractor is actually asking — what is near me — and for most
// cities it works. It cannot work for Ottawa, and the reason is not tuning.
//
// Measured against live Twilio on 2026-11-05:
//
//   Ottawa's free inventory is rate-centred OTTAWAHULL, 28 numbers in 343,
//   and every one of them comes back with
//
//       latitude: null, longitude: null, postal_code: null
//
//   Twilio holds NO geodata for that rate centre. `NearLatLong` can therefore
//   never return it, at any radius — confirmed at 1, 2, 5, 10, 25, 40 and 60
//   miles — and `NearNumber` with a real Ottawa landline is refused outright
//   with "Geodata not available for number". The one exchange that serves the
//   city is invisible to the only search the picker was making.
//
// So the point search filled up on what it COULD see: 30 Gatineau numbers at
// 25 miles (Quebec, across the river, the very area code TrueFinish is trying
// to leave), and at 60 miles the 343s of Brockville, Smiths Falls and
// Hawkesbury — right area code, right province, an hour's drive away, and not
// the contractor's city. A list that looks like it worked.
//
// ══ What replaces it ═══════════════════════════════════════════════════════
//
// The name, before the point. Twilio can be asked for a city by name and
// answers exactly — the trouble is only that its vocabulary is not the one
// anybody types:
//
//   inLocality "Ottawa"            → 0
//   inLocality "Ottawahull"        → 30, of which 28 are 343 ON
//   inLocality "Houston"           → Missouri and Mississippi numbers
//   inLocality "Houston Suburban"  → the 346s that are actually Houston
//
// There is no table of those here, and there must not be: lib/voice/
// numberSearch.js refuses to carry a city→area-code table for a reason that
// applies just as hard to a city→rate-centre one — a wrong entry is a number
// that gets BOUGHT and printed on a van. Every name used here is read back out
// of Twilio's own inventory first, and kept only if Twilio also agrees it is
// in the province Google put the city in.
//
// ══ The order, and why each step is below the one above it ═════════════════
//
//   1. a name we LEARNED from Twilio on an earlier search (see below)
//   2. the typed name, and the municipality Google says it belongs to,
//      searched exactly and constrained to the province
//   3. the point, widening, keeping only numbers whose city IS the city
//   4. the sweep: ask Twilio for the area codes its own inventory shows near
//      this place, read the cities off those numbers, and take one whose name
//      matches — this is what turns "Ottawa" into "Ottawahull"
//   5. anything in the right province (what the picker did before)
//   6. the widest point search (what it did before that)
//
// Steps 5 and 6 are the old behaviour, untouched, underneath. Nothing above
// them can make the picker emptier than it was: every new step either finds a
// better answer or falls through.
//
// ══ Why the learned name is remembered ═════════════════════════════════════
//
// The sweep reads a random 30 of an area code's inventory, so it finds
// Ottawahull about three times in four. Three attempts make that ~98%, which
// is not 100%, and "the right city, usually" is the kind of control AGENTS.md
// is about. So the first time a name is discovered it is written down, and
// every later search for that city is a single exact query.
//
// In PlatformSetting, not a new model: it is key/value and deliberately dull,
// and this is FieldQuo's own note about Twilio's vocabulary — no tenant's data
// is in it, no company's row is touched, and it is as true for one contractor
// as for the next. A lost or stale entry costs a sweep, never a wrong number,
// because the name is re-verified against the province on every use.
import { db } from "@/lib/db";
import { searchLocalNumbers, cityNameMatches, numberChoiceAvailable } from "./numberSearch";

const ALIAS_KEY = "voice.localityAlias";

// Warm-instance copy, so a busy picker does not read the same row per search.
// Seeded from the database, never instead of it — a cold instance that has
// never read the row must not conclude the alias does not exist.
//
// It expires, because a serverless instance can stay warm for hours and
// another one discovering a new city must eventually reach this one. Five
// minutes is far shorter than that and far longer than a picker session.
const ALIAS_TTL_MS = 5 * 60 * 1000;
let aliasCache = null;
let aliasCacheAt = 0;

/** Drop the warm copy. For the check script, which runs each scenario cold. */
export function forgetLearnedNames() {
  aliasCache = null;
  aliasCacheAt = 0;
}

const aliasSlot = (country, region, name) =>
  `${String(country || "").toUpperCase()}|${String(region || "").toUpperCase()}|${String(name || "").toLowerCase().trim()}`;

async function readAliases() {
  if (aliasCache && Date.now() - aliasCacheAt < ALIAS_TTL_MS) return aliasCache;
  try {
    const row = await db.platformSetting.findUnique({ where: { key: ALIAS_KEY } });
    aliasCache = row?.value && typeof row.value === "object" ? { ...row.value } : {};
    aliasCacheAt = Date.now();
  } catch (err) {
    // A learned name is an optimisation, never the only path — the sweep below
    // finds it again. Failing the whole search because a cache row would not
    // read would turn a slow answer into no answer.
    console.error("[voice/cityNumbers] alias read failed", err?.message || err);
    aliasCache = {};
    aliasCacheAt = Date.now();
  }
  return aliasCache;
}

async function rememberAlias(slot, locality) {
  const current = await readAliases();
  if (current[slot] === locality) return;
  current[slot] = locality;
  try {
    // Read-modify-write, so two searches discovering two different cities at
    // the same instant can lose one of them. The cost of that is one extra
    // sweep the next time somebody types it, which is the same cost as never
    // having learned it — so a transaction here would buy nothing.
    await db.platformSetting.upsert({
      where: { key: ALIAS_KEY },
      create: { key: ALIAS_KEY, value: current },
      update: { value: current },
    });
  } catch (err) {
    console.error("[voice/cityNumbers] alias write failed", err?.message || err);
  }
}

/** Numbers Twilio lists in this exact city, dropped unless it agrees on the province. */
async function numbersInLocality({ country, region, locality, limit }) {
  const result = await searchLocalNumbers({ country, locality, inRegion: region, limit });
  const numbers = region
    ? (result.numbers || []).filter((n) => n.region === region)
    : result.numbers || [];
  return { ...result, numbers };
}

/**
 * The best real numbers for a place a contractor typed.
 *
 * @param typed  the contractor's own words, already trimmed and capped
 * @param near   a geocode: { lat, lng, place, region, country, locality }
 * @returns the shape searchLocalNumbers returns, plus `via` naming the step
 *          that answered — which is what the check script asserts on.
 */
export async function findNumbersForCity({ typed, near, limit = 6 } = {}) {
  // Without Twilio there is no inventory to look in, and every step below
  // would return an empty list that is indistinguishable from a city with
  // nothing free. The screen renders those two differently, so the difference
  // has to survive the walk down.
  if (!numberChoiceAvailable()) {
    return { numbers: [], searched: null, configured: false, via: "unconfigured" };
  }
  const country = near?.country || null;
  const region = near?.region || null;
  // What was typed, and the municipality Google says it sits in. The second is
  // what makes a suburb work: "Kanata" is not a Twilio rate centre and never
  // will be, but Google calls its locality Ottawa and Ottawa is reachable.
  const names = [...new Set([typed, near?.locality].filter(Boolean).map((n) => String(n).trim()))].filter(Boolean);

  const headline = (result) => ({
    ...result,
    // The place GOOGLE matched heads the list, not Twilio's rate-centre
    // spelling — "Free numbers near Ottawahull" would name an exchange the
    // contractor has never heard of. Each ROW still prints Twilio's own city,
    // because that is the number's actual city and inventing a prettier one is
    // the thing this file exists to stop.
    searched: { areaCode: null, locality: near?.place || names[0] || null, region, near: null },
  });

  // ── 1. A name learned from Twilio on an earlier search ─────────────────
  const aliases = await readAliases();
  for (const name of names) {
    const known = aliases[aliasSlot(country, region, name)];
    if (!known) continue;
    const hit = await numbersInLocality({ country, region, locality: known, limit });
    if (hit.numbers.length) return { ...headline(hit), via: `alias:${known}` };
  }

  // ── 2. The name as typed, and the municipality it belongs to ───────────
  for (const name of names) {
    const hit = await numbersInLocality({ country, region, locality: name, limit });
    if (hit.numbers.length) return { ...headline(hit), via: `exact:${name}` };
  }

  // ── 3. Near the point, widening, but only a number whose city IS the city
  const seen = [];
  let widest = null;
  if (near && Number.isFinite(Number(near.lat)) && Number.isFinite(Number(near.lng))) {
    for (const distanceMiles of [25, 60, 150]) {
      const tried = await searchLocalNumbers({
        country,
        near: { lat: near.lat, lng: near.lng, place: near.place, distanceMiles },
        limit: 30,
      });
      if (tried.numbers?.length) widest = tried;
      seen.push(...(tried.numbers || []));
      const matched = (tried.numbers || []).filter(
        (n) => n.region === region && names.some((name) => cityNameMatches(name, n.locality)),
      );
      if (matched.length) {
        return { ...tried, numbers: matched.slice(0, limit), via: `point:${distanceMiles}mi` };
      }
    }
  }

  // ── 4. Ask Twilio what it calls this place ─────────────────────────────
  //
  // The area codes come from the numbers the point search already returned in
  // this province, so they are observed inventory rather than a guess — the
  // distinction lib/voice/numberSearch.js draws. The most common one is tried
  // twice when it is the only one, because the page is a random sample and one
  // look at it is three chances in four, not a certainty.
  const frequency = new Map();
  for (const n of seen) {
    if (n.region === region && n.areaCode) frequency.set(n.areaCode, (frequency.get(n.areaCode) || 0) + 1);
  }
  const ranked = [...frequency.entries()].sort((a, b) => b[1] - a[1]).map(([ac]) => ac).slice(0, 3);
  const attempts = ranked.length ? Array.from({ length: 3 }, (_, i) => ranked[i] || ranked[0]) : [];
  for (const areaCode of attempts) {
    const sample = await searchLocalNumbers({ country, areaCode, inRegion: region, limit: 30 });
    const found = (sample.numbers || []).find(
      (n) => n.region === region && names.some((name) => cityNameMatches(name, n.locality)),
    );
    if (!found?.locality) continue;
    const hit = await numbersInLocality({ country, region, locality: found.locality, limit });
    if (!hit.numbers.length) continue;
    for (const name of names) await rememberAlias(aliasSlot(country, region, name), found.locality);
    return { ...headline(hit), via: `discovered:${found.locality}` };
  }

  // ── 5. Anything in the right province, and 6. the widest search ────────
  const inRegion = region ? seen.filter((n) => n.region === region) : seen;
  if (inRegion.length && widest) {
    return { ...widest, numbers: inRegion.slice(0, limit), via: "region" };
  }
  if (widest) return { ...widest, numbers: (widest.numbers || []).slice(0, limit), via: "widest" };
  return { numbers: [], searched: null, configured: true, via: "none" };
}
