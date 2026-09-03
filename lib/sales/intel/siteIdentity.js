// lib/sales/intel/siteIdentity.js
//
// Does this website belong to this prospect?
//
// ══ Why the question suddenly matters ══════════════════════════════════════
//
// Until now it did not. Every website FieldQuo crawled was one the SOURCE had
// published against the business — Overture's `websites` column — so "is this
// their site" was answered before the crawler opened a socket, and
// tradeDetect.js could read a page and believe what it said.
//
// lib/sales/discovery/rbq/derivedSite.js breaks that. Quebec's licence
// register publishes no website, so a domain is DERIVED from the licence
// email. A derived domain is a hypothesis, and it is wrong in two very
// different ways:
//
//   the domain is dead        harmless. Nothing loads, nothing is inferred,
//                             the prospect stays exactly as it was.
//   the domain is LIVE and    the expensive one. The site loads, it is
//   belongs to someone else   well-marked-up, tradeDetect reads it
//                             confidently, and a rep opens a call about the
//                             wrong trade. A confident wrong answer costs
//                             more than no answer — trades.js, ingest.js and
//                             classify.js all say so, in those words.
//
// This is not hypothetical and it is not rare. Measured on a 200-domain sample
// of the derived set (see docs/sales-intel/RBQ-DERIVED-SITES.md):
//
//   ge.com                from AP&C Revêtements & Poudres Avancées inc., a GE
//                         subsidiary. The site is General Electric's.
//   crh.com               from Les Matériaux de Construction Oldcastle Canada
//                         inc. The site is CRH plc's, the Irish parent.
//   c3.farm               from Ébénisterie Architecturale Labelle, a CABINET
//                         MAKER. The site is a multinational's brand portal.
//   tree9structures.com   from Tonewood Consulting Inc. The site is a timber-
//                         frame business the same owner also runs.
//
// Four of 166 pages that loaded — 2.4% — and every one of them a live site
// that a detector would have read successfully and reported the wrong trade
// from. The last is the exact shape the brief for this work named: not a dead
// domain, but a second business behind the same mailbox.
//
// ══ What corroborates, and why the bar is DETERMINISTIC ════════════════════
//
// The temptation is to accept a name match: `groupepapineau.com` is titled
// "Groupe Papineau Construction" and the register says "Groupe Papineau
// Construction inc." Obviously the same business. The measurement agrees —
// 43 of the 166 corroborate on name alone and every one inspected was right.
//
// It is still not the bar, and lib/sales/intel/confidence.js is why. That file
// classes `identity.similar_name` as `identity_fuzzy` and caps a pile of
// fuzzy signals at FUZZY_CEILING (0.6), strictly below MATCH_THRESHOLD (0.8),
// so that no number of resemblances at any tunable weight can settle that two
// records are the same business. Its header spells out the failure that rule
// exists to prevent, and a second file quietly deciding that a resemblance is
// good enough THIS time would be that rule with a hole in it — the hole being
// the one place in the product where the identity was never asserted by
// anybody in the first place.
//
// So this module does not invent a scale. It gathers signals, hands them to
// `identityConfidence()`, and reports `corroborated` only when that function
// says `decision === "match"` — which it says only on a deterministic signal.
// Raising FUZZY_CEILING would not open a back door here; it would raise the
// ceiling and still leave fuzzy below the threshold, and the `tier` guard
// there catches even that.
//
// The cost is stated rather than hidden: 43 of 166 corroborate on name alone
// and are refused, and the businesses refused are real ones whose site simply
// does not print a phone number in its markup. They keep a `derived_site`
// inference with the name match recorded on it, so a rep can look at the
// screen and take thirty seconds to decide what software would not. That is
// the conservative direction, and it is the same one tradeDetect.js takes for
// a contested trade.
//
// ══ What DOES corroborate ══════════════════════════════════════════════════
//
//   identity.exact_phone     the register's number, on the site. Deterministic.
//   identity.exact_address   the register's postal code AND its civic number,
//                            both on the site. A Canadian postal code covers
//                            one side of one block; with the street number it
//                            is an address, not a coincidence. Deterministic.
//   identity.similar_name    recorded, shown, and never decisive.
//   identity.same_city       likewise.
import { identityConfidence } from "./confidence";
import { loadedPages, normaliseCrawl } from "./technology";

export const SITE_IDENTITY_DETECTOR = "site_identity";
export const SITE_IDENTITY_DETECTOR_VERSION = "1";

/**
 * Lowercase, unaccented, non-alphanumerics collapsed to one space.
 *
 * The same transform as tradeDetect.js's `fold`, written here rather than
 * imported because importing it would couple two detectors that happen to
 * agree today — and a change made for the trade vocabulary would silently move
 * this identity bar.
 */
export function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Words that are in half the business names in Quebec and identify nobody.
 *
 * Legal forms, articles and the two words that are in every construction
 * company's name. A name reduced to nothing but these has NO usable tokens,
 * and `nameTokens` returns an empty list rather than matching on "les" —
 * which is what stops "Les Entreprises Tremblay" from resembling every other
 * business in the register.
 */
const NAME_NOISE = new Set([
  "inc",
  "ltee",
  "ltd",
  "limitee",
  "limited",
  "enr",
  "senc",
  "sencrl",
  "cie",
  "corp",
  "corporation",
  "llc",
  "les",
  "le",
  "la",
  "du",
  "de",
  "des",
  "et",
  "and",
  "the",
  "quebec",
  "canada",
]);

/**
 * The parts of a business name that could identify it.
 *
 * Four characters minimum, and never a bare number. Both rules are about the
 * SAME failure and it is measurable in this register: a great many Quebec
 * contractors trade as "9265-1234 Québec inc.", and the digits of a numbered
 * company appear on no website — while a three-letter token like "bmp" or
 * "cis" appears on thousands of them by accident.
 *
 * The consequence is that a numbered company yields no tokens at all, and the
 * name signal simply does not fire for it. That is right: the register has
 * told us nothing nameable about that business. Its TRADING names, which
 * licence.js goes to some trouble to keep all of, are where the identifiable
 * string lives, and `corroborateSite` passes them in.
 */
export function nameTokens(name) {
  return fold(name)
    .split(" ")
    .filter((t) => t.length >= 4 && !NAME_NOISE.has(t) && !/^\d+$/.test(t));
}

/** The last ten digits of a North American number, or null. */
export function last10(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/**
 * A Canadian postal code found in a string, without its space, or null.
 *
 * Anchored on the ANA NAN alternation rather than searched loosely: "H2X 1Y4"
 * and "H2X1Y4" are the same code and a phone number is neither.
 */
export function postalCode(value) {
  const m = String(value ?? "")
    .toUpperCase()
    .match(/([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?(\d[ABCEGHJ-NPRSTV-Z]\d)/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** The civic number at the start of a street line, or null. */
export function civicNumber(value) {
  const m = String(value ?? "").trim().match(/^(\d{1,6})\b/);
  return m ? m[1] : null;
}

/**
 * Everything on a page that could carry an identity, as one folded haystack
 * plus a digit-only stream.
 *
 * Two forms because they answer two questions. A phone number is matched
 * against the DIGITS with every separator gone, so "(514) 555-0142",
 * "514.555.0142" and "tel:+15145550142" are one value; a name is matched
 * against the folded TEXT, where separators are what keep tokens apart.
 */
function haystacks(page) {
  const parts = [
    page.meta?.title,
    page.meta?.description,
    page.meta?.["og:title"],
    page.meta?.["og:site_name"],
    ...(page.schema || []),
    page.text || "",
    ...(page.links || []).map((l) => (typeof l === "string" ? l : l?.href || l?.url || "")),
  ];
  const text = parts.filter(Boolean).join(" \n ");
  return {
    folded: ` ${fold(text)} `,
    digits: text.replace(/\D/g, ""),
    // The TITLE on its own. A name in the title is the business naming itself;
    // a name buried in body prose can be a supplier it lists or a client it
    // did work for, which is the same distinction tradeDetect.js draws between
    // structure and prose.
    titleFolded: ` ${fold(page.meta?.title)} `,
    upper: text.toUpperCase().replace(/\s+/g, " "),
  };
}

function evidenceRow({ type, sourceUrl, rawValue, normalizedValue, confidence }) {
  return {
    type,
    source: "website",
    sourceUrl: sourceUrl || null,
    rawValue: String(rawValue ?? "").slice(0, 400),
    normalizedValue: String(normalizedValue ?? "").slice(0, 2000),
    confidence,
    detector: SITE_IDENTITY_DETECTOR,
    detectorVersion: SITE_IDENTITY_DETECTOR_VERSION,
  };
}

/**
 * Does the crawled site belong to this prospect?
 *
 * @param crawl         anything normaliseCrawl understands
 * @param prospect      businessName, phoneE164, addressLine, postalCode, city
 * @param alsoKnownAs   trading names — the register's `Autre nom` values. A
 *                      numbered company's only identifiable string.
 * @param rules         ConfidenceRule rows, passed straight through
 *
 * @returns {{ corroborated: boolean, decision: string, confidence: object,
 *             signals: string[], reason: string|null, evidence: object[],
 *             pagesConsidered: number }}
 *
 * `corroborated` is the ONLY field a caller should gate on, and it is true
 * only when identityConfidence says "match". Everything else is for the screen.
 */
export function corroborateSite({ crawl = null, prospect = null, alsoKnownAs = [], rules = [] } = {}) {
  const normalised = normaliseCrawl(crawl);
  // NOT `looksRendered`: a one-line page that prints nothing but a phone number
  // in a footer still answers this question, and a page too thin for a trade
  // is not too thin for an identity. tradeDetect.js applies its own filter for
  // its own question.
  const pages = loadedPages(normalised);

  const base = {
    corroborated: false,
    decision: "no_match",
    confidence: null,
    signals: [],
    reason: null,
    evidence: [],
    pagesConsidered: pages.length,
  };

  if (pages.length === 0) {
    // "We did not manage to look", never "this is not their site". The same
    // distinction enrichBusiness.js refuses to blur for hasWebsite, and the
    // caller must not read this as a refutation.
    return { ...base, reason: normalised.blocked ? "blocked" : "no_page_rendered" };
  }

  const wantPhone = last10(prospect?.phoneE164);
  const wantPostal = postalCode(prospect?.postalCode || prospect?.addressLine);
  const wantCivic = civicNumber(prospect?.addressLine);
  const wantCity = fold(prospect?.city);
  const names = [prospect?.businessName, ...(Array.isArray(alsoKnownAs) ? alsoKnownAs : [])].filter(Boolean);

  // Distinct signal KINDS, not hits — confidence.js's `usable()` dedupes by
  // name anyway, so counting a phone found on four pages as four signals would
  // manufacture certainty the combiner then has to throw away.
  const found = new Map();
  const note = (signal, row) => {
    if (!found.has(signal)) found.set(signal, row);
  };

  for (const page of pages) {
    const url = page.finalUrl || page.url || null;
    const hay = haystacks(page);

    if (wantPhone && hay.digits.includes(wantPhone)) {
      note(
        "identity.exact_phone",
        evidenceRow({
          type: "identity_phone",
          sourceUrl: url,
          rawValue: `register phone ${wantPhone} found on the page`,
          normalizedValue: `site_identity:phone:${wantPhone}`,
          confidence: 0.95,
        }),
      );
    }

    // Both halves required. A postal code alone is one side of one block and
    // a civic number alone is on every street in Quebec; together they are an
    // address, which is what makes this deterministic rather than a third
    // resemblance dressed up as one.
    if (wantPostal && wantCivic) {
      const pagePostal = hay.upper.replace(/\s+/g, "").includes(wantPostal);
      const pageCivic = hay.folded.includes(` ${wantCivic} `);
      if (pagePostal && pageCivic) {
        note(
          "identity.exact_address",
          evidenceRow({
            type: "identity_address",
            sourceUrl: url,
            rawValue: `register address ${wantCivic} … ${wantPostal} found on the page`,
            normalizedValue: `site_identity:address:${wantPostal}`,
            confidence: 0.85,
          }),
        );
      }
    }

    for (const name of names) {
      const tokens = nameTokens(name);
      if (!tokens.length) continue;
      // Every distinctive token, in the page's own TITLE. All of them, not
      // most: "Construction Boivin" matching a page titled "Construction" is
      // the resemblance this whole file exists to refuse, and a fraction
      // threshold is a dial somebody would later turn.
      if (tokens.every((t) => hay.titleFolded.includes(` ${t} `) || hay.titleFolded.includes(` ${t}`))) {
        note(
          "identity.similar_name",
          evidenceRow({
            type: "identity_name",
            sourceUrl: url,
            rawValue: `title=${page.meta?.title || ""} matches "${name}"`,
            normalizedValue: `site_identity:name:${tokens.join(" ")}`,
            confidence: 0.35,
          }),
        );
        break;
      }
    }

    if (wantCity && hay.folded.includes(` ${wantCity} `)) {
      note(
        "identity.same_city",
        evidenceRow({
          type: "identity_city",
          sourceUrl: url,
          rawValue: `register municipality ${prospect?.city} named on the page`,
          normalizedValue: `site_identity:city:${wantCity}`,
          confidence: 0.15,
        }),
      );
    }
  }

  const signals = [...found.keys()];
  const confidence = identityConfidence({ signals, rules });

  return {
    ...base,
    // The one gate. "match" is reachable only through a deterministic signal —
    // see confidence.js's `decision`, and this file's header for why a
    // resemblance may not open it.
    corroborated: confidence.decision === "match",
    decision: confidence.decision,
    confidence,
    signals,
    reason: signals.length ? confidence.reason : "no_identity_signal",
    evidence: [...found.values()],
    pagesConsidered: pages.length,
  };
}
