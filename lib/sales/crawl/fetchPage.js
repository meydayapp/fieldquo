// lib/sales/crawl/fetchPage.js
//
// The one place in the crawler that opens a socket. Everything decidable
// without one was decided in url.js, robots.js and policy.js; this file is the
// thin IO wrapper those pure functions exist to keep thin.
//
// ══ GET, and only GET ══════════════════════════════════════════════════════
//
// No POST, no form submission, no login, no cookie jar, no credentials, no
// stored session, and `redirect: "manual"` so that not even the runtime
// follows something on our behalf. AUDIT-compliance.md §10 is precise about
// why: the CFAA question and the CONTRACT question are different questions,
// hiQ won the first and lost the second, and it lost it by creating accounts.
// Everything this file can do, a stranger with a browser and no account can
// do.
//
// ══ Redirects are followed by hand ═════════════════════════════════════════
//
// Two reasons, and the second is the important one.
//
//   1. Every hop is re-vetted. `redirect: "follow"` would let a public
//      hostname redirect to 169.254.169.254 and hand us the metadata service,
//      which is the standard SSRF bypass and the reason a single up-front
//      check is not a check.
//   2. An off-host redirect is a FINDING, not a detour. Prospect.websiteUrl
//      comes from a dataset and may point at a parked domain, a registrar
//      holding page, or a redirect straight to Facebook — and "this
//      contractor's website is a Facebook page" is one of the more useful
//      things the whole pipeline can learn. Following it silently would
//      replace that finding with a crawl of facebook.com, which is both
//      useless and against the hard rule that only the prospect's own site is
//      fetched.
//
// So an off-host Location is RECORDED and not followed. We know where it went
// from the header; we do not need to go there to say so.
//
// ══ The size cap counts bytes off the stream ═══════════════════════════════
//
// Not Content-Length. A header is a claim, and a 200 MB body announced as 1200
// bytes is the exact shape of the failure the brief names. The reader below
// stops at MAX_PAGE_BYTES whatever any header said, cancels the stream, and
// marks the page truncated — the head of an HTML document carries the title,
// the meta and the script tags, so a truncated page is still worth most of
// what §8 asks for.
import { lookup as dnsLookup } from "node:dns/promises";
import {
  ACCEPT_HEADER,
  MAX_PAGE_BYTES,
  MAX_REDIRECTS,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
} from "./policy";
import { isPrivateAddress, safeCrawlUrl, sameSiteAs } from "./url";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Does this hostname resolve to somewhere public?
 *
 * The string checks in url.js catch a URL that NAMES a private address. This
 * catches a public-looking name that RESOLVES to one, which is how the
 * interesting version of the attack is written — and how a stale dataset row
 * for a defunct contractor whose domain now points at 127.0.0.1 would
 * otherwise reach our own loopback.
 *
 * The honest limit: this does not close DNS rebinding. Between this lookup and
 * the socket the name can be re-answered, and closing that needs a custom HTTP
 * agent that checks the peer address after connect. Stated rather than
 * implied — this narrows the window to the realistic case and does not claim
 * to eliminate it.
 */
export async function hostResolvesPublic(host, { lookup = dnsLookup } = {}) {
  try {
    const addresses = await lookup(host, { all: true });
    const list = Array.isArray(addresses) ? addresses : [addresses];
    if (!list.length) return { ok: false, reason: "dns_no_address", addresses: [] };
    const found = list.map((a) => (typeof a === "string" ? a : a?.address)).filter(Boolean);
    if (!found.length) return { ok: false, reason: "dns_no_address", addresses: [] };
    const bad = found.find((a) => isPrivateAddress(a));
    if (bad) return { ok: false, reason: "resolves_private", addresses: found, offending: bad };
    return { ok: true, reason: "public", addresses: found };
  } catch (err) {
    return { ok: false, reason: `dns_error:${err?.code || err?.message || "unknown"}`, addresses: [] };
  }
}

/** The charset a response asked for, defaulting to utf-8. */
function charsetOf(contentType) {
  const m = /charset\s*=\s*"?([a-z0-9_:.-]+)"?/i.exec(String(contentType || ""));
  const raw = (m?.[1] || "utf-8").toLowerCase();
  // TextDecoder knows these names; anything it does not know falls back rather
  // than throwing, because a bad charset label must not lose a whole page.
  return raw;
}

function decodeBody(bytes, contentType) {
  const charset = charsetOf(contentType);
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

/**
 * One HTTP GET, with a timeout and a hard byte cap. No redirect following.
 *
 * @returns { ok, status, headers, body, bytes, truncated, contentType, error,
 *            timedOut }
 *          `ok` is about the transaction, not the status: a 404 is ok:true
 *          with status 404, because the request succeeded and told us the page
 *          is not there. Only a network failure or a timeout is ok:false.
 */
export async function fetchOnce(url, {
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxBytes = MAX_PAGE_BYTES,
  fetchImpl = fetch,
  accept = ACCEPT_HEADER,
} = {}) {
  const controller = new AbortController();
  // One timer over headers AND body. A timeout that only covered the response
  // headers would leave a slow-loris body trickling until the lambda died.
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetchImpl(String(url), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      // No cookies, no referrer, no credentials. A crawler that carried a
      // session would be doing the thing §10 calls not defensible.
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "user-agent": USER_AGENT, accept, "accept-language": "en" },
    });

    const headers = {
      contentType: res.headers?.get?.("content-type") ?? null,
      retryAfter: res.headers?.get?.("retry-after") ?? null,
      location: res.headers?.get?.("location") ?? null,
      contentLength: res.headers?.get?.("content-length") ?? null,
    };

    const { bytes, truncated } = await readCapped(res, maxBytes);

    return {
      ok: true,
      status: res.status,
      headers,
      contentType: headers.contentType,
      body: bytes.length ? decodeBody(bytes, headers.contentType) : "",
      bytes: bytes.length,
      truncated,
      error: null,
      timedOut: false,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      headers: {},
      contentType: null,
      body: "",
      bytes: 0,
      truncated: false,
      error: timedOut ? "timeout" : String(err?.code || err?.name || err?.message || "fetch_failed"),
      timedOut,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Read a response body, stopping dead at `maxBytes`. */
async function readCapped(res, maxBytes) {
  const reader = res.body?.getReader?.();
  if (!reader) {
    // No stream (an empty 304, or a runtime that gave us none). arrayBuffer is
    // the fallback and is still capped afterwards, because a runtime without a
    // stream is exactly the one we cannot stop mid-flight.
    const buf = new Uint8Array(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
    return buf.byteLength > maxBytes
      ? { bytes: buf.slice(0, maxBytes), truncated: true }
      : { bytes: buf, truncated: false };
  }

  const chunks = [];
  let total = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = maxBytes - total;
    if (value.byteLength >= remaining) {
      chunks.push(value.subarray(0, Math.max(remaining, 0)));
      total += Math.max(remaining, 0);
      truncated = true;
      // Cancel rather than break: leaving the socket draining is what turns a
      // 200 MB body into a bill and a held connection.
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes: out, truncated };
}

/**
 * Fetch one URL, following same-site redirects and recording everything.
 *
 * @param startUrl  must already have passed safeCrawlUrl — it is re-vetted
 *                  here anyway, because "the caller checked" is how a guard
 *                  ends up not running
 * @param baseHost  the host the crawl is anchored on; a redirect that leaves
 *                  it is recorded and NOT followed
 *
 * @returns an attempt record, always. This function does not throw for a site
 *          that is down — a dead site is a result, and a throw here would cost
 *          the pipeline task an attempt and a retry ladder for a domain that
 *          will never resolve.
 */
export async function fetchCrawlPage({
  startUrl,
  baseHost,
  maxRedirects = MAX_REDIRECTS,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxBytes = MAX_PAGE_BYTES,
  deps = {},
} = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const lookup = deps.lookup || dnsLookup;
  const onRequest = deps.onRequest || (async () => {});

  const attempt = {
    requestedUrl: String(startUrl),
    finalUrl: null,
    status: null,
    contentType: null,
    body: "",
    bytes: 0,
    truncated: false,
    redirects: [],
    offHost: false,
    offHostUrl: null,
    error: null,
    timedOut: false,
    retryAfter: null,
  };

  let current = String(startUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const vetted = safeCrawlUrl(current);
    if (!vetted.ok) {
      attempt.error = `unsafe_url:${vetted.reason}`;
      attempt.finalUrl = current;
      return attempt;
    }

    // Re-checked on EVERY hop, not once at the start. See the header.
    const dns = await hostResolvesPublic(vetted.host, { lookup });
    if (!dns.ok) {
      attempt.error = `unsafe_host:${dns.reason}`;
      attempt.finalUrl = vetted.url.toString();
      return attempt;
    }

    // The politeness reservation, taken immediately before the socket opens
    // rather than once per page: a redirect is a second request to a server
    // and spacing that says otherwise is spacing that is not happening.
    const permitted = await onRequest({ url: vetted.url.toString(), host: vetted.host, hop });
    if (permitted && permitted.ok === false) {
      attempt.error = `not_permitted:${permitted.reason || "host_policy"}`;
      attempt.finalUrl = vetted.url.toString();
      return attempt;
    }

    const res = await fetchOnce(vetted.url.toString(), { timeoutMs, maxBytes, fetchImpl });
    attempt.finalUrl = vetted.url.toString();
    attempt.status = res.status;
    attempt.contentType = res.contentType;
    attempt.retryAfter = res.headers?.retryAfter ?? null;
    attempt.timedOut = res.timedOut;

    if (!res.ok) {
      attempt.error = res.error;
      return attempt;
    }

    if (!REDIRECT_STATUSES.has(res.status) || !res.headers.location) {
      attempt.body = res.body;
      attempt.bytes = res.bytes;
      attempt.truncated = res.truncated;
      return attempt;
    }

    let next;
    try {
      next = new URL(res.headers.location, vetted.url);
    } catch {
      attempt.error = "bad_redirect_location";
      return attempt;
    }

    attempt.redirects.push({ from: vetted.url.toString(), to: next.toString(), status: res.status });

    if (!sameSiteAs(baseHost, next.hostname)) {
      // The finding. Recorded with both ends of the hop and no further
      // request — see the header on why this is not a detour to follow.
      attempt.offHost = true;
      attempt.offHostUrl = next.toString();
      attempt.finalUrl = next.toString();
      return attempt;
    }

    current = next.toString();
  }

  attempt.error = "too_many_redirects";
  return attempt;
}
