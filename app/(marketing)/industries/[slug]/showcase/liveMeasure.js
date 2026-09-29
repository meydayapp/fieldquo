// app/(marketing)/industries/[slug]/showcase/liveMeasure.js
//
// POST /api/showcase/roof-measure — the roofing walk-through measuring a
// house the visitor names (app/api/showcase/roof-measure/route.js is this
// handler with the real store and the real measurement plugged in). Server-
// only.
//
// ══ What it does, and all it does ═════════════════════════════════════════
//
// Address in; the house out: its roof as lib/measure/roofMeasurement.js
// measureRoof() measures it — the product's own geocode + Solar path,
// unchanged and called as the public instant quote calls it — its country
// and province, and the tax that province's rules give a draft
// (./buildRoofingShowcase.js showcaseTax, the sample's own path). NEVER a
// price: the prices are the sample company's preset, already on the page,
// and the browser runs them through ./roofingRun.js as it does for the
// sample. No lead, no draft, no email, no SMS — and no tenant anywhere near
// it.
//
// ══ Every Google call costs FieldQuo money, so ═════════════════════════════
//
//   1. Same origin only. The browser's own Origin and Referer must both be
//      this host, and the Referer the showcase page. A script can forge
//      both; what this stops is somebody else's page using ours as a free
//      roof-measuring API from their visitors' browsers.
//   2. One request per ten seconds per IP (lib/rateLimit.js, in memory —
//      a burst guard, and honest about being one per instance).
//   3. Canada and the US only, asked BEFORE any call on the country the
//      address picker reported, and confirmed AFTER from the geocode itself —
//      the browser's word saves the call, the geocode's word is the verdict.
//   4. The cache: one answer per normalised address for 30 days, in the
//      database (./liveStore.js) so it holds across instances. A cached
//      answer spends nothing and counts against nothing.
//   5. The durable caps, in one atomic statement before the first call:
//      SHOWCASE_MEASURE_DAILY_CAP measurements a day in total (default 100)
//      and three per visitor per day. Full → the page's "try the sample
//      house" sentence. The store failing refuses too: an unmetered call is
//      exactly what the cap exists to prevent.
//
// No CAPTCHA and nothing that fingerprints a browser: the caps bound the
// bill whatever a bot does, and a bot gets what the page gets.
//
// ══ What one try costs (counted by check:roofing-example, part four) ══════
//
// Server, per address NOT in the cache:
//   Geocoding                      1 call      $5.00 / 1,000
//   Solar buildingInsights         1 call      $10.00 / 1,000
//     …9 when the pin's own building is implausible (measureRoof's
//     eight-point ring) — the worst case, e.g. no model at all
// Browser, per measured house shown:
//   Static Maps still              1 load      $2.00 / 1,000 (public key;
//                                  the same URL in every preview, cached)
//   Places Autocomplete            1 session   ≈ $5–17 / 1,000, depending on
//                                  which Places SKU the key bills
// Google list prices, pre-free-tier; the monthly free usage per SKU covers
// much of this at the default cap. Typical try ≈ $0.022–0.034, worst ≈ $0.11.
// At SHOWCASE_MEASURE_DAILY_CAP=100 for 30 days: ≈ $66–102 typical, ≈ $342
// if every try were a worst case. NOT bounded by this cap: autocomplete
// sessions of visitors who open the panel and type but are then capped or
// served from the cache, and stills of cached houses (one per view, behind
// the burst limit) — the browser key's own daily quota in Google Cloud is
// the cap for those.

import { NextResponse } from "next/server";
import { createHash, createHmac } from "node:crypto";
import { hit, clientIp } from "@/lib/rateLimit";
import { regionFromAddressText } from "@/lib/tax/addressRegion";
import { satelliteImageUrl } from "@/lib/measure/roofMeasurement";
import { showcaseTax } from "./buildRoofingShowcase";
import { currencyForCountry } from "./houseFixture";

/** The one page allowed to ask. */
export const SHOWCASE_PATH = "/industries/roofing";
export const DEFAULT_DAILY_CAP = 100;
export const PER_VISITOR_PER_DAY = 3;
export const BURST_WINDOW_MS = 10 * 1000;
export const CACHE_DAYS = 30;
const CACHE_VERSION = 1;
const LIVE_COUNTRIES = new Set(["CA", "US"]);

/** SHOWCASE_MEASURE_DAILY_CAP, or the default when unset or not a count. 0 turns live measuring off. */
export function dailyCap(env = process.env) {
  const raw = env.SHOWCASE_MEASURE_DAILY_CAP;
  if (raw === undefined || raw === null || String(raw).trim() === "") return DEFAULT_DAILY_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_CAP;
}

/**
 * The address as a cache key sees it: case, accents' composition,
 * punctuation and spacing do not make a different house. Deliberately no
 * cleverer than that — "St" and "Street" stay different keys, which costs
 * one extra measurement, where a wrong merge would show one house's roof
 * for another's.
 */
export function normaliseAddress(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function cacheKeyFor(address) {
  return `showcase.roofMeasure.cache.${createHash("sha256").update(normaliseAddress(address)).digest("hex").slice(0, 40)}`;
}

/** The UTC day a request counts against. */
export function dayKeyFor(now) {
  return `showcase.roofMeasure.day.${now.toISOString().slice(0, 10)}`;
}

/**
 * Who a visitor is, for their three a day: a keyed hash of the IP and the
 * day, so the stored tag cannot be walked back to an address across the IPv4
 * space, nor matched to the same visitor tomorrow.
 */
export function visitorTag(ip, day, secret = "") {
  return createHmac("sha256", String(secret || "showcase")).update(`${day}|${ip}`).digest("hex").slice(0, 24);
}

/** Origin and Referer both this host, and the Referer the showcase page. */
export function fromShowcasePage(request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!host || !origin || !referer) return false;
  let o;
  let r;
  try {
    o = new URL(origin);
    r = new URL(referer);
  } catch {
    return false;
  }
  if (o.host !== host || r.host !== host || o.protocol !== r.protocol) return false;
  return r.pathname.replace(/\/+$/, "") === SHOWCASE_PATH;
}

/** "CA" / "US" from whatever the picker sent, or null. */
function countryHint(value) {
  const c = String(value || "").trim().toUpperCase();
  return c.length === 2 ? c : null;
}

/** The address a request carries, or null when it is not one worth a call. */
function cleanAddress(value) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length >= 6 && s.length <= 200 ? s : null;
}

/**
 * What is kept of a measurement: the verdict and the facts the page shows —
 * never the image URL (it carries the public key, which can rotate; it is
 * rebuilt from the pin on every answer) and never anything priced.
 * Returns null for a failure that says nothing about the address (no key, a
 * network blip, an unreadable model): those are not cached, so the next ask
 * tries again.
 */
export function verdictFrom(result, at) {
  const formattedAddress = result?.formattedAddress || null;
  const where = regionFromAddressText(formattedAddress);
  const inside = LIVE_COUNTRIES.has(where.country) && Boolean(where.region);
  const geo = result?.location
    ? {
        formattedAddress,
        lat: result.location.lat,
        lng: result.location.lng,
        zoom: result.still?.zoom ?? null,
        country: where.country,
        region: where.region,
      }
    : null;
  const base = { v: CACHE_VERSION, at: at.toISOString() };
  if (result?.ok) {
    if (!inside) return { ...base, outcome: "outside", geo: null, roof: null };
    return {
      ...base,
      outcome: "ok",
      geo,
      roof: {
        areaSqft: result.areaSqft,
        squares: result.squares,
        predominantPitch: result.predominantPitch
          ? { rise: result.predominantPitch.rise, run: 12, degrees: result.predominantPitch.degrees }
          : null,
        steepness: result.steepness || null,
        segmentCount: result.segmentCount ?? null,
        footprintSqft: result.footprintSqft ?? null,
        imageryDate: result.imageryDate || null,
        trustworthy: result.trustworthy !== false,
        warnings: Array.isArray(result.warnings) ? result.warnings.map((w) => w.code).filter(Boolean) : [],
      },
    };
  }
  if (result?.reason === "no_roof_coverage") {
    if (!geo || !inside) return { ...base, outcome: "outside", geo: null, roof: null };
    return { ...base, outcome: "no_roof_coverage", geo, roof: null };
  }
  return null;
}

/** Is a cached verdict still one to serve? */
export function freshVerdict(value, now) {
  if (!value || value.v !== CACHE_VERSION || typeof value.at !== "string") return null;
  const age = now.getTime() - new Date(value.at).getTime();
  if (!Number.isFinite(age) || age < 0 || age > CACHE_DAYS * 24 * 60 * 60 * 1000) return null;
  return value;
}

/**
 * The house as the page receives it (./houseFixture.js fixtureForHouse reads
 * this): address, jurisdiction, currency, the draft's tax, the roof in the
 * shape the sample's measurement has, and the still. The still is Static
 * Maps with the PUBLIC, referrer-restricted browser key — measureRoof()'s own
 * satelliteImageUrl(), the image the real instant quote shows a homeowner.
 * The server key never leaves: it is in the calls this handler makes, not in
 * anything it returns.
 */
export function houseView(verdict, { still = satelliteImageUrl } = {}) {
  const g = verdict.geo;
  const image = g && g.lat != null && g.lng != null ? still(g.lat, g.lng, g.zoom != null ? { zoom: g.zoom } : {}) : null;
  const r = verdict.roof;
  return {
    address: g.formattedAddress,
    country: g.country,
    region: g.region,
    currency: currencyForCountry(g.country),
    tax: showcaseTax({ province: g.region, country: g.country, address: g.formattedAddress }),
    satelliteImageUrl: image,
    trustworthy: r ? r.trustworthy : null,
    warnings: r ? r.warnings : [],
    measurement: r
      ? {
          source: "google_solar",
          areaSqft: r.areaSqft,
          squares: r.squares,
          predominantPitch: r.predominantPitch,
          steepness: r.steepness,
          segmentCount: r.segmentCount,
          footprintSqft: r.footprintSqft,
          formattedAddress: g.formattedAddress,
          imageryDate: r.imageryDate,
          satelliteImageUrl: image,
        }
      : null,
  };
}

// English here; the page words each reason in the reader's language
// (industryShowcaseFor: live*), keyed on `reason`.
const REFUSALS = {
  bad_origin: [403, "This measurement is only available from the FieldQuo roofing example."],
  bad_request: [400, "Enter a street address."],
  rate_limited: [429, "One address every few seconds, please."],
  outside: [422, "The live example measures Canadian and US addresses only."],
  capped: [429, "The live example has reached today's limit — try the sample house."],
  daily_limit: [429, "You have tried today's three addresses — try the sample house."],
  not_found: [404, "We couldn't find that address."],
  no_roof_coverage: [422, "Google has no roof model for this building."],
  unavailable: [503, "The live example can't measure right now — try the sample house."],
};

function refuse(reason, extra = {}, headers = undefined) {
  const [status, error] = REFUSALS[reason];
  return NextResponse.json({ ok: false, reason, error, ...extra }, { status, headers });
}

/** The verdict as a response — the same for a fresh measurement and a cached one. */
function answer(verdict, cached, deps) {
  if (verdict.outcome === "ok") return NextResponse.json({ ok: true, cached, house: houseView(verdict, deps) });
  if (verdict.outcome === "no_roof_coverage") return refuse("no_roof_coverage", { cached, house: houseView(verdict, deps) });
  return refuse("outside", { cached });
}

/**
 * The handler, with what it touches passed in: `store` (./liveStore.js
 * platformSettingStore), `measure` (measureRoof), the clock, the environment
 * and the burst limiter — so the check runs it against a stubbed Google and
 * an in-memory store, and the route is one line.
 */
export function createShowcaseMeasureHandler({ store, measure, now = () => new Date(), env = process.env, burst = hit, still = satelliteImageUrl }) {
  const deps = { still };
  return async function POST(request) {
    if (!fromShowcasePage(request)) return refuse("bad_origin");

    let body;
    try {
      body = await request.json();
    } catch {
      return refuse("bad_request");
    }
    const address = cleanAddress(body?.address);
    if (!address) return refuse("bad_request");

    const ip = clientIp(request);
    const b = burst(`showcase-roof-measure:${ip}`, { limit: 1, windowMs: BURST_WINDOW_MS });
    if (!b.ok) return refuse("rate_limited", {}, { "retry-after": String(b.retryAfter) });

    // The picker's country, when it sent one: an address it placed abroad is
    // refused before anything is spent. Absent, the geocode decides below.
    const hint = countryHint(body?.country);
    if (hint && !LIVE_COUNTRIES.has(hint)) return refuse("outside");

    const at = now();
    const cacheKey = cacheKeyFor(address);
    try {
      const hitValue = freshVerdict(await store.readCache(cacheKey), at);
      if (hitValue) return answer(hitValue, true, deps);
    } catch {
      // A cache that cannot be read is a miss; the reservation below still
      // has to succeed before anything is spent.
    }

    const day = dayKeyFor(at);
    let reserved;
    try {
      reserved = await store.reserve({
        dayKey: day,
        visitor: visitorTag(ip, day, env.BETTER_AUTH_SECRET),
        cap: dailyCap(env),
        perVisitor: PER_VISITOR_PER_DAY,
      });
    } catch (err) {
      console.warn(`[showcase/roof-measure] could not reserve a measurement: ${err?.message || err}`);
      return refuse("unavailable");
    }
    if (!reserved?.ok) return refuse(reserved?.why === "visitor" ? "daily_limit" : "capped");

    const result = await measure(address);
    const verdict = verdictFrom(result, at);
    if (!verdict) {
      if (result?.reason === "geocode_failed") return refuse("not_found");
      console.warn(`[showcase/roof-measure] measurement unavailable (${result?.reason || "unknown"})`);
      return refuse("unavailable");
    }
    try {
      await store.writeCache(cacheKey, verdict);
    } catch (err) {
      // The answer is still true; the next ask for this address pays again.
      console.warn(`[showcase/roof-measure] could not cache: ${err?.message || err}`);
    }
    return answer(verdict, false, deps);
  };
}
