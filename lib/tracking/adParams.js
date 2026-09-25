// lib/tracking/adParams.js
//
// Meta's ad parameters, read, cleaned and grouped — ONE module for both
// audiences that run ads to FieldQuo pages:
//
//   · FieldQuo itself, on fieldquo.com → /platform/analytics
//     (lib/analytics/track.js reads, lib/analytics/product/events.js cleans,
//     lib/analytics/product/campaigns.js reports);
//   · a contractor, on their own funnel / instant estimate / booking page /
//     website → Leads › Visits & unfinished (lib/tracking/attribution.js
//     cleans onto FunnelVisit, the traffic report groups).
//
// No imports: the beacon and the /app link builder pull it into a client
// bundle, and scripts/check-ad-params.mjs executes every function here
// against hostile input.
//
// ══ What Meta actually sends ═══════════════════════════════════════════════
//
// Meta's "Specifications for dynamic URL parameters"
// (https://www.facebook.com/business/help/2360940870872492) lists the macros
// Ads Manager substitutes per click — {{campaign.id}} {{campaign.name}}
// {{adset.id}} {{adset.name}} {{ad.id}} {{ad.name}} {{placement}}
// {{site_source_name}} — and the site_source_name values: fb, ig, msg, an,
// th. It also says Meta MAY add its own parameters automatically: source =
// facebook or instagram, medium = paid, and the campaign / ad set / ad ids.
// That automatic set is what /platform/analytics was showing as a campaign
// called "120254631999170581": Meta's campaign id in utm_campaign, with no
// name anywhere on the link. Absent a name we print the id and say the name
// was not sent — we never invent one.
//
// Name macros are substituted with spaces encoded as %20; some builders (and
// some people typing into the field) encode them as "+", and a value that
// went through two encoders arrives as %2520 or %2B. "new+traffic+campaign"
// and "new traffic campaign" were one campaign split in two on the console.
// decodeAdValue() undoes all of that before anything is compared.
//
// ══ Grouping is by id when there is one ════════════════════════════════════
//
// A campaign is the same campaign whatever its name was spelled like, so the
// group key is its id when ANY landing carried the id — a landing carrying
// only the name joins the id it was seen with elsewhere (name → id, only when
// the name maps to exactly one id). Without an id, the key is the name
// case-folded, and the name DISPLAYED is the spelling most landings used.

/** The query parameters a landing is read for. */
export const AD_QUERY_PARAMS = Object.freeze([
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id",
  "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
  "placement", "site_source_name",
]);

/** A name as kept: this many code points at most. */
export const AD_VALUE_MAX = 150;
/** What the browser forwards per raw value before the server cleans it. */
export const AD_RAW_MAX = 500;

/** Meta's site_source_name values → the one-word source the reports use. */
export const SITE_SOURCES = Object.freeze({
  fb: "facebook",
  ig: "instagram",
  msg: "messenger",
  an: "audience_network",
  th: "threads",
});

/** Meta's placement values begin with the network they ran on. */
const PLACEMENT_PREFIXES = [
  ["audience_network", "audience_network"],
  ["facebook", "facebook"],
  ["instagram", "instagram"],
  ["messenger", "messenger"],
  ["threads", "threads"],
];

/** A Meta object id: digits only. Real ones are 15–18; 10 keeps a stray number out. */
const META_ID = /^\d{10,25}$/;
const PLACEMENT = /^[a-z0-9_]{2,60}$/;

/**
 * A raw parameter value as a person would read it, or null.
 *
 *   "+" and %20 become a space, double encoding is undone (%2520, %2B), an
 *   unsubstituted macro ("{{campaign.name}}", from someone opening the link
 *   by hand) is dropped, control and markup characters are removed, spaces
 *   collapse, and the result is bounded to AD_VALUE_MAX code points (never
 *   half an emoji).
 *
 * Rendered only as React text; the character strip is defence in depth, not
 * the escaping.
 */
export function decodeAdValue(raw) {
  if (typeof raw !== "string") return null;
  let v = raw.slice(0, 2000).replace(/\+/g, " ");
  for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(v); i += 1) {
    try {
      v = decodeURIComponent(v).replace(/\+/g, " ");
    } catch {
      break;
    }
  }
  if (v.includes("{{") || v.includes("}}")) return null;
  v = v
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f<>"'`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!v) return null;
  const points = Array.from(v);
  if (points.length > AD_VALUE_MAX) v = points.slice(0, AD_VALUE_MAX).join("").trim();
  return v || null;
}

/** A Meta id, or null. */
export function cleanAdId(raw) {
  const v = decodeAdValue(raw);
  return v && META_ID.test(v) ? v : null;
}

export function isMetaId(value) {
  return typeof value === "string" && META_ID.test(value);
}

/** The grouping form of a name: case-folded, spaces collapsed. */
export function foldName(name) {
  return typeof name === "string" ? name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim() : "";
}

export function cleanSiteSource(raw) {
  const v = decodeAdValue(raw);
  const k = v ? v.toLowerCase() : null;
  return k && SITE_SOURCES[k] ? k : null;
}

export function cleanPlacement(raw) {
  const v = decodeAdValue(raw);
  const k = v ? v.toLowerCase() : null;
  return k && PLACEMENT.test(k) ? k : null;
}

/** The network a placement ran on, from its prefix, or null. */
export function networkOfPlacement(placement) {
  if (typeof placement !== "string") return null;
  for (const [prefix, network] of PLACEMENT_PREFIXES) {
    if (placement === prefix || placement.startsWith(`${prefix}_`)) return network;
  }
  return null;
}

/**
 * The Meta network a click came through, when the link says so — and only
 * then. site_source_name first (Meta's own statement), then the placement's
 * prefix, then a utm_source that names Instagram / Messenger / Threads (Meta's
 * automatic parameters use "ig"; the owner's template hard-codes "facebook",
 * which is exactly why site_source_name must win over it).
 *
 * null means "not stated", and the caller falls back to its existing rule
 * (click id, utm_source, referrer). This exists so an Instagram placement
 * that also carries an fbclid is not counted as Facebook.
 */
export function metaNetwork({ siteSource = null, placement = null, utmSource = null } = {}) {
  if (siteSource && SITE_SOURCES[siteSource]) return SITE_SOURCES[siteSource];
  const byPlacement = networkOfPlacement(placement);
  if (byPlacement) return byPlacement;
  const u = typeof utmSource === "string" ? utmSource.trim().toLowerCase() : "";
  if (u === "ig" || u === "instagram") return "instagram";
  if (u === "msg" || u === "messenger") return "messenger";
  if (u === "th" || u === "threads") return "threads";
  if (u === "an" || u === "audience_network") return "audience_network";
  return null;
}

/**
 * Browser half: the raw ad parameters of a query string, each bounded to
 * AD_RAW_MAX, plus whether an fbclid was present (its presence only — the
 * id itself is not forwarded by this reader). Nothing is cleaned here; the
 * server is the boundary.
 */
export function readAdQuery(search = "") {
  const out = {};
  try {
    const q = new URLSearchParams(typeof search === "string" ? search : "");
    for (const k of AD_QUERY_PARAMS) {
      const v = q.get(k);
      if (v) out[k] = v.slice(0, AD_RAW_MAX);
    }
    if (q.has("fbclid")) out.fbclid = true;
  } catch {
    /* a malformed query string is no ad data, not an error */
  }
  return out;
}

/**
 * Server half: raw parameters (readAdQuery's shape, or FunnelVisit-style
 * raw landing) → the cleaned ad context, every field null when absent.
 *
 *   campaignId  campaign_id, else utm_id, else a utm_campaign that is only
 *               digits (Meta's automatic parameters)
 *   campaignName campaign_name, else a utm_campaign that is NOT an id
 *   adsetId/Name  adset_id / adset_name, else utm_term (id if digits, name if not)
 *   adId/Name     ad_id / ad_name, else utm_content (same rule)
 *
 * The owner's template puts {{adset.name}} in utm_term and {{ad.name}} in
 * utm_content; Meta's automatic set puts the ids there. Both read right.
 */
export function cleanAdParams(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const utmSource = decodeAdValue(r.utm_source);
  const utmMedium = decodeAdValue(r.utm_medium);
  const utmCampaign = decodeAdValue(r.utm_campaign);
  const utmContent = decodeAdValue(r.utm_content);
  const utmTerm = decodeAdValue(r.utm_term);
  const split = (explicitId, explicitName, slot) => {
    const id = cleanAdId(explicitId) || (isMetaId(slot) ? slot : null);
    const name = decodeAdValue(explicitName) || (slot && !isMetaId(slot) ? slot : null);
    return { id, name };
  };
  const campaign = split(r.campaign_id, r.campaign_name, utmCampaign);
  const campaignId = campaign.id || cleanAdId(r.utm_id);
  const adset = split(r.adset_id, r.adset_name, utmTerm);
  const ad = split(r.ad_id, r.ad_name, utmContent);
  const siteSource = cleanSiteSource(r.site_source_name);
  const placement = cleanPlacement(r.placement);
  return {
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    campaignId,
    campaignName: campaign.name,
    adsetId: adset.id,
    adsetName: adset.name,
    adId: ad.id,
    adName: ad.name,
    placement,
    siteSource,
    network: metaNetwork({ siteSource, placement, utmSource }),
    hasFbclid: r.fbclid === true || (typeof r.fbclid === "string" && r.fbclid.length > 0),
  };
}

/** True when the cleaned context names any campaign / ad set / ad at all. */
export function hasAdIdentity(ad) {
  return Boolean(ad && (ad.campaignId || ad.campaignName || ad.adsetId || ad.adsetName || ad.adId || ad.adName));
}

/**
 * The compact form stored beside a landing (AnalyticsEvent.meta.ad, a
 * SignupLead's first touch): only the fields that say something, short keys.
 */
const COMPACT = [
  ["campaignId", "cid"], ["campaignName", "cn"], ["adsetId", "sid"], ["adsetName", "sn"],
  ["adId", "aid"], ["adName", "an"], ["placement", "pl"], ["siteSource", "ss"],
  ["utmSource", "us"], ["utmMedium", "um"], ["utmContent", "uct"], ["utmTerm", "ut"],
];
export function compactAd(ad) {
  if (!ad || typeof ad !== "object") return null;
  const out = {};
  for (const [long, short] of COMPACT) if (ad[long]) out[short] = ad[long];
  if (ad.hasFbclid) out.fb = 1;
  return Object.keys(out).length ? out : null;
}

/** compactAd's inverse, re-cleaned: a stored JSON is read as untrusted. */
export function expandAd(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const s = (k) => (typeof stored[k] === "string" ? stored[k] : undefined);
  const out = {
    campaignId: cleanAdId(s("cid")),
    campaignName: decodeAdValue(s("cn")),
    adsetId: cleanAdId(s("sid")),
    adsetName: decodeAdValue(s("sn")),
    adId: cleanAdId(s("aid")),
    adName: decodeAdValue(s("an")),
    placement: cleanPlacement(s("pl")),
    siteSource: cleanSiteSource(s("ss")),
    utmSource: decodeAdValue(s("us")),
    utmMedium: decodeAdValue(s("um")),
    utmContent: decodeAdValue(s("uct")),
    utmTerm: decodeAdValue(s("ut")),
    hasFbclid: stored.fb === 1 || stored.fb === true,
  };
  out.network = metaNetwork(out);
  return out;
}

// ── Grouping ────────────────────────────────────────────────────────────────

function bump(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n);
}

/** The spelling most rows used; ties go to the one with capitals, then alphabetical. */
export function bestName(counts) {
  let best = null;
  let bestN = -1;
  for (const [name, n] of counts || []) {
    const better =
      n > bestN ||
      (n === bestN && /[A-Z]/.test(name) && !/[A-Z]/.test(best)) ||
      (n === bestN && /[A-Z]/.test(name) === /[A-Z]/.test(best) && name.localeCompare(best) < 0);
    if (better) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

/**
 * One level's identity maps: id → spellings, folded name → ids, folded
 * name → spellings. Built over every row first so a landing with only a
 * name can join the id another landing carried.
 */
function identityIndex(rows, idKey, nameKey, scopeOf) {
  const idNames = new Map();
  const nameIds = new Map();
  const nameSpellings = new Map();
  for (const r of rows) {
    const scope = scopeOf(r);
    const id = r[idKey] || null;
    const name = r[nameKey] || null;
    if (name) {
      const f = `${scope}\u001f${foldName(name)}`;
      if (!nameSpellings.has(f)) nameSpellings.set(f, new Map());
      bump(nameSpellings.get(f), name);
      if (id) {
        if (!nameIds.has(f)) nameIds.set(f, new Set());
        nameIds.get(f).add(id);
      }
    }
    if (id && name) {
      const k = `${scope}\u001f${id}`;
      if (!idNames.has(k)) idNames.set(k, new Map());
      bump(idNames.get(k), name);
    }
  }
  return {
    resolve(r) {
      const scope = scopeOf(r);
      const name = r[nameKey] || null;
      let id = r[idKey] || null;
      if (!id && name) {
        const ids = nameIds.get(`${scope}\u001f${foldName(name)}`);
        if (ids && ids.size === 1) id = [...ids][0];
      }
      if (id) {
        const spellings = idNames.get(`${scope}\u001f${id}`);
        return { key: `id:${id}`, id, name: spellings ? bestName(spellings) : null };
      }
      if (name) {
        const f = foldName(name);
        return { key: `name:${f}`, id: null, name: bestName(nameSpellings.get(`${scope}\u001f${f}`)) || name };
      }
      return { key: "none", id: null, name: null };
    },
  };
}

function newNode(ident) {
  return { key: ident.key, id: ident.id, name: ident.name, nameMissing: !ident.name && Boolean(ident.id), metrics: {}, visitorSet: new Set(), children: new Map() };
}

function addTo(node, row, metricKeys) {
  for (const k of metricKeys) node.metrics[k] = (node.metrics[k] || 0) + (Number(row.metrics?.[k]) || 0);
  if (row.visitorId) node.visitorSet.add(row.visitorId);
}

function finish(node, metricKeys, sortKey, childName) {
  const out = {
    key: node.key,
    id: node.id,
    name: node.name,
    nameMissing: node.nameMissing,
    metrics: Object.fromEntries(metricKeys.map((k) => [k, node.metrics[k] || 0])),
    visitors: node.visitorSet.size,
  };
  if (childName) {
    out[childName.name] = [...node.children.values()]
      .map((c) => finish(c, metricKeys, sortKey, childName.next))
      .sort((a, b) => (b.metrics[sortKey] || 0) - (a.metrics[sortKey] || 0) || String(a.name || a.id || "").localeCompare(String(b.name || b.id || "")));
  }
  return out;
}

/**
 * Rows → campaign ▸ ad set ▸ ad, summed.
 *
 * @param rows  [{ campaignId, campaignName, adsetId, adsetName, adId, adName,
 *                visitorId?, metrics: { [key]: number } }]
 * @param metricKeys  the metric names to sum, in display order
 * @param sortKey     the metric campaigns / ad sets / ads are ranked by
 * @returns { campaigns: [{ key, id, name, nameMissing, metrics, visitors,
 *            adsets: [{ …, ads: [{ … }] }] }], untagged: { metrics, visitors } }
 *
 * A row naming no campaign, ad set or ad is not a campaign row: it is summed
 * into `untagged` so the table's total can be reconciled against the
 * funnel's without an invented "(no campaign)" campaign.
 */
export function groupAdRows(rows, metricKeys, { sortKey = metricKeys[0] } = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
  const tagged = list.filter((r) => hasAdIdentity(r));
  const untagged = { metrics: {}, visitorSet: new Set() };
  for (const r of list) if (!hasAdIdentity(r)) addTo(untagged, r, metricKeys);

  const campaignIx = identityIndex(tagged, "campaignId", "campaignName", () => "");
  const withCampaign = tagged.map((r) => ({ ...r, _c: campaignIx.resolve(r) }));
  const adsetIx = identityIndex(withCampaign, "adsetId", "adsetName", (r) => r._c.key);
  const withAdset = withCampaign.map((r) => ({ ...r, _s: adsetIx.resolve(r) }));
  const adIx = identityIndex(withAdset, "adId", "adName", (r) => `${r._c.key}\u001f${r._s.key}`);

  const campaigns = new Map();
  for (const r of withAdset) {
    const a = adIx.resolve(r);
    let c = campaigns.get(r._c.key);
    if (!c) campaigns.set(r._c.key, (c = newNode(r._c)));
    let s = c.children.get(r._s.key);
    if (!s) c.children.set(r._s.key, (s = newNode(r._s)));
    let d = s.children.get(a.key);
    if (!d) s.children.set(a.key, (d = newNode(a)));
    addTo(c, r, metricKeys);
    addTo(s, r, metricKeys);
    addTo(d, r, metricKeys);
  }
  const shape = { name: "adsets", next: { name: "ads", next: null } };
  return {
    campaigns: [...campaigns.values()]
      .map((c) => finish(c, metricKeys, sortKey, shape))
      .sort((a, b) => (b.metrics[sortKey] || 0) - (a.metrics[sortKey] || 0) || String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""))),
    untagged: {
      metrics: Object.fromEntries(metricKeys.map((k) => [k, untagged.metrics[k] || 0])),
      visitors: untagged.visitorSet.size,
    },
  };
}

// ── The Ads Manager string ──────────────────────────────────────────────────

/**
 * The "URL parameters" string for Meta Ads Manager (Ad ▸ Tracking ▸ URL
 * parameters). The first ten pairs are, verbatim, what the owner pasted into
 * Ads Manager on 2026-09-25 — every one of them is read by cleanAdParams —
 * so this is a superset of it, never a rename. NOT URL-encoded: Meta expects
 * the braces raw in that field and substitutes before encoding.
 *
 * utm_source stays "facebook" for every placement on purpose (one row in a
 * utm_source report); the network is read from site_source_name, which Meta
 * fills with fb / ig / msg / an / th.
 */
export const META_URL_PARAMETERS =
  "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}" +
  "&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&site_source_name={{site_source_name}}";

/** Where the macros above are documented — cited on every screen that shows the string. */
export const META_URL_PARAMETERS_DOC = "https://www.facebook.com/business/help/2360940870872492";

/**
 * A landing-page URL with the Ads Manager string appended, for a person who
 * wants to see the whole thing (or paste it as the Website URL of an ad that
 * has no separate URL-parameters field). The macros stay raw; everything
 * already on the base URL is kept. Null for anything not http(s).
 */
export function withMetaParameters(baseUrl, params = META_URL_PARAMETERS) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const base = url.toString();
  const joiner = url.search ? "&" : "?";
  const hashAt = base.indexOf("#");
  return hashAt >= 0 ? `${base.slice(0, hashAt)}${joiner}${params}${base.slice(hashAt)}` : `${base}${joiner}${params}`;
}
