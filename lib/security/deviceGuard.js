// lib/security/deviceGuard.js
//
// Seat-sharing guard: is ONE login being used by a whole crew?
//
// ── What this must not do ──────────────────────────────────────────────────
//
// The two obvious signals are both wrong for this product:
//
//   "Two sessions at once"  — one estimator routinely has the app open on a
//   phone in the driveway and a laptop back at the shop. That is the normal
//   case, not abuse.
//
//   "The IP changed"        — a crew moves between job sites on mobile data.
//   A single phone can pick up a dozen addresses in a morning. Flagging IP
//   churn flags the customers who use the product hardest.
//
// So neither is used. What IS used is the pattern that has no innocent
// explanation: a large number of genuinely DIFFERENT setups on one login
// inside a week, and — separately — several different devices on several
// different networks all live at the same moment.
//
// ── Everything here is deliberately biased toward missing abuse ────────────
//
// A false positive lands on a paying contractor's screen and, at three
// strikes, on a support queue. A false negative costs a seat. The thresholds
// below are set well past "unusual" and into "cannot be one person", and every
// borderline judgement resolves toward doing nothing. Under-flagging is the
// intended failure mode.
//
// ── And nothing here locks anybody out ─────────────────────────────────────
//
// A strike is a recorded suspicion. Three of them inside 30 days set
// Company.accountStatus = "under_review" and page a FieldQuo admin. That is
// the whole enforcement story — a human decides what happens next. No code
// reads accountStatus to deny anything, and it must stay that way without a
// product decision (see the comment on the column).

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// ── Thresholds ─────────────────────────────────────────────────────────────

/** Rolling window for the distinct-device count. */
const DEVICE_WINDOW_DAYS = 7;

/**
 * Distinct device fingerprints on ONE login inside that window before it
 * counts as a strike. Strike at MORE than this, so 7+ devices in 7 days.
 *
 * Six, not the four that first suggested itself. Four is genuinely reachable
 * by one person: Chrome and Safari on the same laptop are two fingerprints,
 * the same two browsers on their phone are another two, and that is the limit
 * hit before anyone has shared anything. Add the shop iPad and a browser that
 * updated mid-week and a single heavy user is at six. Seven distinct setups on
 * one login inside a week is where the innocent explanations run out.
 */
const DEVICE_LIMIT = 6;

/**
 * How close together two devices must be seen to count as "at the same time".
 *
 * Twenty minutes rather than the two or three that "concurrent" suggests,
 * because of THROTTLE_MS below: a device is only recorded once per half hour,
 * so its lastSeenAt is stale by up to that much. Pretending to a finer
 * resolution than the sampling supports would just mean the signal never
 * fires. Stated plainly here so nobody later reads "concurrent" as "to the
 * second".
 */
const CONCURRENT_WINDOW_MS = 20 * MINUTE;

/**
 * Distinct /16 networks live in that window before it counts as a strike.
 * Strike at MORE than this, so four or more networks at once.
 *
 * /16 rather than an exact match: one office can egress from several
 * addresses, and a phone changing cell towers moves inside its carrier's
 * block. Three is already generous for one person — home wifi, mobile data,
 * and a site's guest network they left connected. Four different devices on
 * four different networks within the same twenty minutes is not one person.
 *
 * Note this counts NETWORKS ACROSS DEVICES, never addresses over time on one
 * device: each AccountDevice row holds a single lastIp, so a phone roaming all
 * morning contributes exactly one network. That is the whole reason IP churn
 * can't trip this.
 */
const CONCURRENT_NETWORK_LIMIT = 3;

/** At most one strike per user per this long, whatever the evidence says. */
const STRIKE_DEDUPE_MS = DAY;

/** Strikes inside this window that add up to a review. */
const REVIEW_WINDOW_DAYS = 30;

/** How many. Three, per the approved design. */
const REVIEW_STRIKE_COUNT = 3;

/**
 * How long to leave a (user, device) alone before recording it again.
 *
 * This is SAMPLING, not attendance. getCurrentMember runs on every
 * authenticated request — several times per page in the app layout alone — and
 * a write plus two counts on each of those would be the most expensive thing
 * in the request path, to measure something that changes on the scale of days.
 */
const THROTTLE_MS = 30 * MINUTE;

// ── Fingerprint ────────────────────────────────────────────────────────────

/**
 * One header, or "" — never null, never a non-string.
 *
 * The type check is not paranoia about real Headers (which always returns
 * string|null). getCurrentMember is called with a SYNTHETIC request in the app
 * layout — `{ headers: await headers() }` — and other callers are free to hand
 * it anything header-shaped. `.trim()` on whatever that returns is how a
 * "never throws" helper stops being one.
 */
function headerOf(request, name) {
  try {
    const value = request?.headers?.get?.(name);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

/**
 * A coarse, non-PII fingerprint of the browser/OS setup a request came from.
 *
 * SHA-256 over user-agent + accept-language, truncated to 32 hex characters.
 * Truncated because this is a bucket label, not a key — the full digest is
 * more precision than the inputs deserve and more to store.
 *
 * BE HONEST ABOUT WHAT THIS IS. It identifies a SETUP, not a person or a
 * machine, and it is wrong in both directions:
 *
 *   Collides — two crew members with the same iPhone model, same iOS, same
 *   language settings produce the SAME hash. A uniform crew sharing one login
 *   is the case this is worst at seeing, and it will under-count them.
 *
 *   Splits — one person changes browser, clears it, takes an OS update, or
 *   switches their phone's language, and the hash changes. That is why the
 *   device threshold has so much headroom.
 *
 * No IP, no cookie, no canvas or font probing. A cookie-based device id would
 * be far more accurate and was rejected: it is a tracking identifier planted
 * on a user's browser for our commercial benefit, and it survives exactly
 * until someone clears their cookies anyway.
 *
 * Returns "" when there is nothing to hash — a request with no user-agent is
 * not a device we know anything about, and hashing the empty string would file
 * every one of them under a single shared fingerprint.
 */
export function deviceHashFrom(request) {
  const ua = headerOf(request, "user-agent").trim();
  if (!ua) return "";
  const lang = headerOf(request, "accept-language").trim();
  return createHash("sha256").update(`${ua}\n${lang}`).digest("hex").slice(0, 32);
}

/**
 * The client's address, as best the proxy will tell us.
 *
 * x-forwarded-for is a comma-separated chain; the FIRST entry is the client.
 * Anything downstream is a proxy, and treating one of those as the client
 * would put every customer behind the same address.
 */
function ipFrom(request) {
  const chain = headerOf(request, "x-forwarded-for");
  const first = chain.split(",")[0]?.trim();
  return first || headerOf(request, "x-real-ip").trim() || null;
}

/**
 * The /16 an address sits in — "203.0.113.7" -> "203.0". IPv6 keeps its first
 * two groups, which is the rough equivalent.
 *
 * Returns null for anything unparseable rather than a made-up bucket. That
 * direction is load-bearing: an address we can't read must not become a
 * "network unknown" bucket that then counts as a distinct network alongside
 * the real ones, because the count of networks is what raises a strike.
 *
 * The normalising above the match is not tidiness. Both of these forms turn up
 * in x-forwarded-for depending on the proxy, and both used to fall through to
 * the IPv6 branch — where the whole HOST address became the "network", so one
 * machine reconnecting on a new source port read as a second network. That is
 * precisely the false positive this file exists to avoid, so it is tested.
 */
export function networkOf(ip) {
  if (typeof ip !== "string") return null;
  let addr = ip.trim();
  if (!addr) return null;

  // "[2001:db8::1]:443" — the bracketed form puts the port outside.
  const bracketed = addr.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) addr = bracketed[1];

  // "203.0.113.7:52413" — some proxies append the client's source port.
  const v4WithPort = addr.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (v4WithPort) addr = v4WithPort[1];

  // "::ffff:203.0.113.7" — a v4 client arriving over a v6 socket. It IS a v4
  // address, and reading it as v6 takes the entire host as its network.
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) addr = mapped[1];

  const v4 = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    if (v4.slice(1).some((octet) => Number(octet) > 255)) return null;
    return `${v4[1]}.${v4[2]}`;
  }

  if (addr.includes(":")) {
    const groups = addr.split(":").filter(Boolean);
    // Every group must actually be hex. Without this, "junk:junk" is a network.
    if (groups.length >= 2 && groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) {
      return `${groups[0].toLowerCase()}:${groups[1].toLowerCase()}`;
    }
  }
  return null;
}

// ── Throttle ───────────────────────────────────────────────────────────────
//
// In-process, per (user, device). Serverless means this is per INSTANCE — a
// cold start or a second lambda forgets everything and re-records straight
// away. That's fine and is not worth a Redis dependency: over-recording writes
// the same upsert twice, which changes nothing, and the counts this feeds are
// over days. It is sampling, not accounting. Nothing here is allowed to become
// a number anyone quotes.
const lastChecked = new Map();
const THROTTLE_MAX_KEYS = 5000;

function throttled(key, now) {
  const at = lastChecked.get(key);
  if (at && now - at < THROTTLE_MS) return true;
  // Bounded so a long-lived instance serving many users can't grow this
  // without limit. Insertion order = oldest first, and dropping an old key
  // costs one extra upsert, never a wrong answer.
  if (lastChecked.size >= THROTTLE_MAX_KEYS) {
    const oldest = lastChecked.keys().next().value;
    if (oldest !== undefined) lastChecked.delete(oldest);
  }
  lastChecked.set(key, now);
  return false;
}

// ── Recording ──────────────────────────────────────────────────────────────

/**
 * Record that this login was seen from this setup.
 *
 * Same contract as recordError: NEVER throws, never blocks anything. It runs
 * beside real work on the authenticated request path, and an abuse heuristic
 * that can 500 a contractor's schedule is a far worse bug than the seat it was
 * trying to protect.
 *
 * @returns {Promise<string>} the deviceHash it recorded, or "" if it did
 *   nothing (no user-agent, missing ids, or a failed write).
 */
export async function touchDevice({ userId, companyId, request } = {}) {
  try {
    if (!userId || !companyId) return "";
    const deviceHash = deviceHashFrom(request);
    if (!deviceHash) return "";

    const now = new Date();
    const lastIp = ipFrom(request);
    // Long user-agents exist and none of the tail is informative once it's
    // been hashed anyway; the column is only kept so support can recognise
    // "that's an iPhone" without decoding a digest.
    const userAgent = headerOf(request, "user-agent").slice(0, 400) || null;

    await db.accountDevice.upsert({
      where: { userId_deviceHash: { userId, deviceHash } },
      // companyId is NOT updated on the way through. Someone who moves company
      // gets a fresh row via the create path there; rewriting the old row would
      // quietly move historical evidence between tenants.
      update: { lastSeenAt: now, lastIp, userAgent },
      create: { userId, companyId, deviceHash, lastIp, userAgent, firstSeenAt: now, lastSeenAt: now },
    });
    return deviceHash;
  } catch (err) {
    // Terminal, like errorLog's own catch. This is a background nicety on a
    // request that has real work to do.
    console.error("[deviceGuard] couldn't record device:", err?.message);
    return "";
  }
}

/**
 * Look at what's been recorded for this login and decide whether it's a strike.
 *
 * Never throws. Returns a small summary for tests and for anyone debugging why
 * a strike did or didn't land; no caller is expected to act on it.
 */
export async function evaluateAbuse({ userId, companyId } = {}) {
  try {
    if (!userId || !companyId) return null;

    const now = Date.now();
    const deviceSince = new Date(now - DEVICE_WINDOW_DAYS * DAY);

    const devices = await db.accountDevice.findMany({
      where: { userId, lastSeenAt: { gte: deviceSince } },
      select: { deviceHash: true, lastIp: true, lastSeenAt: true },
    });

    // ── Signal 1: too many distinct setups this week ──────────────────────
    const distinctDevices = new Set(devices.map((d) => d.deviceHash)).size;

    // ── Signal 2: several networks live at once ───────────────────────────
    //
    // Anchored on the most recent sighting rather than on `now`: the request
    // being served IS one of these devices, so the newest lastSeenAt is
    // effectively the present. Using wall-clock would work identically here
    // and break the moment this is ever called from a cron.
    const newest = devices.reduce(
      (max, d) => Math.max(max, new Date(d.lastSeenAt).getTime()),
      0,
    );
    const liveNetworks = new Set(
      devices
        .filter((d) => newest - new Date(d.lastSeenAt).getTime() <= CONCURRENT_WINDOW_MS)
        .map((d) => networkOf(d.lastIp))
        .filter(Boolean),
    );

    const summary = {
      distinctDevices,
      deviceLimit: DEVICE_LIMIT,
      liveNetworks: liveNetworks.size,
      networkLimit: CONCURRENT_NETWORK_LIMIT,
      struck: false,
    };

    let kind = null;
    let detail = null;
    if (distinctDevices > DEVICE_LIMIT) {
      kind = "distinct_devices";
      detail = { distinctDevices, limit: DEVICE_LIMIT, windowDays: DEVICE_WINDOW_DAYS };
    } else if (liveNetworks.size > CONCURRENT_NETWORK_LIMIT) {
      kind = "concurrent_networks";
      detail = {
        networks: liveNetworks.size,
        limit: CONCURRENT_NETWORK_LIMIT,
        windowMinutes: CONCURRENT_WINDOW_MS / MINUTE,
        // /16s only. Support needs to see that these are four unrelated
        // networks, not who was on them.
        prefixes: [...liveNetworks].slice(0, 8),
      };
    }
    if (!kind) return summary;

    // Deduped per user per day. Without this a busy Tuesday on a genuinely
    // multi-device account burns all three strikes before anyone has had a
    // chance to notice the first one — the escalation is meant to measure
    // "this keeps happening", and three readings of one afternoon is one
    // observation, not three.
    const recent = await db.accountAbuseStrike.findFirst({
      where: { userId, createdAt: { gte: new Date(now - STRIKE_DEDUPE_MS) } },
      select: { id: true },
    });
    if (recent) return summary;

    await db.accountAbuseStrike.create({ data: { companyId, userId, kind, detail } });
    summary.struck = true;
    summary.kind = kind;

    // ── Escalation ────────────────────────────────────────────────────────
    const strikes = await db.accountAbuseStrike.count({
      where: { companyId, createdAt: { gte: new Date(now - REVIEW_WINDOW_DAYS * DAY) } },
    });
    summary.strikes30 = strikes;
    if (strikes < REVIEW_STRIKE_COUNT) return summary;

    // updateMany with accountStatus: "active" in the WHERE, not a read-then-
    // write. Two requests can land here at once, and the condition is the
    // guard: whichever one matches a row did the flagging, the other matches
    // nothing and stays quiet. It also means a company a human already moved
    // to "restricted" is never dragged back to "under_review" by the detector.
    const flagged = await db.company.updateMany({
      where: { id: companyId, accountStatus: "active" },
      data: {
        accountStatus: "under_review",
        accountReviewedAt: new Date(),
        accountReviewReason: `${strikes} seat-sharing signals in ${REVIEW_WINDOW_DAYS} days (latest: ${kind})`,
      },
    });
    summary.flagged = flagged.count > 0;
    if (flagged.count === 0) return summary;

    // The alert is the point of the whole feature. Everything above is
    // bookkeeping; this is the part where a person finds out.
    await recordError({
      area: "account_abuse",
      code: kind,
      message:
        `Possible seat sharing: ${strikes} signals in ${REVIEW_WINDOW_DAYS} days. ` +
        `Account moved to under_review — NOT locked. Someone needs to look and decide.`,
      companyId,
      detail: { ...detail, userId, strikes30: strikes },
    });

    return summary;
  } catch (err) {
    console.error("[deviceGuard] couldn't evaluate:", err?.message);
    return null;
  }
}

/**
 * The whole check, throttled and fire-and-forget, for the authenticated
 * request path.
 *
 * Returns immediately. The caller must NOT await the work — that would put a
 * write and two counts in front of the response for a signal measured in days.
 */
export function noteAccountActivity({ userId, companyId, request } = {}) {
  try {
    if (!userId || !companyId) return;
    const deviceHash = deviceHashFrom(request);
    if (!deviceHash) return;

    // Keyed by device, not just user: keying by user alone would mean only the
    // FIRST setup of each half hour ever got recorded, so the second device —
    // the entire thing being measured — would be invisible.
    if (throttled(`${userId}:${deviceHash}`, Date.now())) return;

    void (async () => {
      const seen = await touchDevice({ userId, companyId, request });
      if (seen) await evaluateAbuse({ userId, companyId });
    })().catch((err) => {
      console.error("[deviceGuard] background check failed:", err?.message);
    });
  } catch (err) {
    console.error("[deviceGuard] couldn't schedule check:", err?.message);
  }
}

/** Read-only view of the tuning, for the platform console and for tests. */
export const DEVICE_GUARD_THRESHOLDS = {
  deviceWindowDays: DEVICE_WINDOW_DAYS,
  deviceLimit: DEVICE_LIMIT,
  concurrentWindowMinutes: CONCURRENT_WINDOW_MS / MINUTE,
  concurrentNetworkLimit: CONCURRENT_NETWORK_LIMIT,
  strikeDedupeHours: STRIKE_DEDUPE_MS / (60 * MINUTE),
  reviewWindowDays: REVIEW_WINDOW_DAYS,
  reviewStrikeCount: REVIEW_STRIKE_COUNT,
  throttleMinutes: THROTTLE_MS / MINUTE,
};
