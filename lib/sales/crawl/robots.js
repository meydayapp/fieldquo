// lib/sales/crawl/robots.js
//
// A robots.txt parser, and the rule matcher that goes with it. Pure.
//
// ══ Why parse it properly rather than grep for "Disallow: /" ═══════════════
//
// Because the interesting robots.txt files are not that one. A WordPress site
// ships `Disallow: /wp-admin/` with `Allow: /wp-admin/admin-ajax.php`, and a
// naive reader either refuses the whole site (and we crawl nobody) or ignores
// the file (and we crawl /wp-admin, which is the fact a plaintiff's lawyer
// reads aloud — AUDIT-compliance.md §10). Getting the group selection and the
// longest-match rule right is the difference between obeying the file and
// merely having read it.
//
// Follows RFC 9309 where it is specific:
//
//   · lines are `field: value`, `#` starts a comment
//   · consecutive `user-agent` lines share one group of rules
//   · a group naming our product token wins over the `*` group entirely —
//     the two are NOT merged, which matters because a site that disallows `*`
//     and allows `FieldQuoBot` means the second thing
//   · the LONGEST matching rule wins; a tie goes to Allow
//   · `*` matches any run of characters, `$` at the end anchors
//   · an empty `Disallow:` is not a rule, it is the absence of one
//
// `Crawl-delay` is NOT in RFC 9309 — it is a de-facto directive that Bing and
// Yandex honour and Google ignores. We honour it, because the whole posture
// here is to do more than the standard requires rather than the minimum it
// permits.
import { CRAWLER_TOKEN, clampCrawlDelay } from "./policy";

/** Bound on how much of a hostile robots.txt is parsed. */
const MAX_LINES = 5_000;
const MAX_RULES_PER_GROUP = 1_000;

/**
 * Split robots.txt into groups.
 *
 * @returns { groups: [{ agents: string[], rules: [{ allow, path }], crawlDelay }],
 *            sitemaps: string[], lines: number, truncated: boolean }
 */
export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  // A group is "open" while consecutive user-agent lines are still arriving.
  // The moment a rule lands, the next user-agent line starts a NEW group —
  // this is the rule that keeps `User-agent: *` + `Disallow: /` followed by
  // `User-agent: FieldQuoBot` + `Allow: /` from collapsing into one group.
  let acceptingAgents = false;

  const all = String(text ?? "").split(/\r\n|\r|\n/);
  const lines = all.slice(0, MAX_LINES);

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const colon = line.indexOf(":");
    if (colon === -1) continue;

    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent" || field === "useragent") {
      if (!current || !acceptingAgents) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
        acceptingAgents = true;
      }
      if (value) current.agents.push(value.toLowerCase());
      continue;
    }

    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    // Any non-user-agent directive closes the group to further agent lines.
    if (!current) {
      // Rules before any user-agent line belong to nobody. RFC 9309 says to
      // ignore them; inventing a `*` group for them would apply one site's
      // stray line to us and to nobody else.
      continue;
    }
    acceptingAgents = false;

    if (field === "disallow" || field === "allow") {
      if (current.rules.length >= MAX_RULES_PER_GROUP) continue;
      // An empty `Disallow:` is the documented way to say "nothing is
      // disallowed". Storing it as a rule with an empty path would make it
      // match every URL at length zero, which is harmless for Allow and
      // catastrophic for Disallow — so it is dropped rather than stored.
      if (!value) continue;
      current.rules.push({ allow: field === "allow", path: value });
      continue;
    }

    if (field === "crawl-delay" || field === "crawldelay") {
      const ms = clampCrawlDelay(value);
      if (ms !== null) current.crawlDelay = ms;
    }
  }

  return { groups, sitemaps, lines: lines.length, truncated: all.length > MAX_LINES };
}

/**
 * The group that applies to us.
 *
 * Specific token first, `*` only as a fallback, and never both. If several
 * groups name the same token their rules are merged, because a file that says
 * `User-agent: FieldQuoBot` twice means both sets.
 *
 * @returns { agent: "fieldquobot" | "*" | null, rules, crawlDelay }
 */
export function groupFor(parsed, token = CRAWLER_TOKEN) {
  const want = String(token || "").toLowerCase();
  const groups = parsed?.groups || [];

  const pick = (predicate) => {
    const matched = groups.filter((g) => (g.agents || []).some(predicate));
    if (!matched.length) return null;
    return {
      rules: matched.flatMap((g) => g.rules || []),
      // The first stated delay wins rather than the smallest: two groups
      // naming us is a formatting accident, and picking the smaller number
      // would be reading the file to our own advantage.
      crawlDelay: matched.map((g) => g.crawlDelay).find((d) => d !== null && d !== undefined) ?? null,
    };
  };

  const specific = pick((a) => a === want);
  if (specific) return { agent: want, ...specific };

  const wildcard = pick((a) => a === "*");
  if (wildcard) return { agent: "*", ...wildcard };

  return { agent: null, rules: [], crawlDelay: null };
}

/**
 * Does one robots.txt path pattern match this URL path?
 *
 * `*` is any run of characters and `$` anchors the end, both per RFC 9309.
 * Everything else is literal, including the regex metacharacters that appear
 * in real paths — `/search?q=` and `/a+b/` would otherwise be read as regex
 * and match the wrong things.
 */
export function patternMatches(pattern, path) {
  const p = String(pattern ?? "");
  const target = String(path ?? "");
  if (!p) return false;

  let anchored = false;
  let body = p;
  if (body.endsWith("$")) {
    anchored = true;
    body = body.slice(0, -1);
  }

  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\S]*");

  try {
    return new RegExp(`^${escaped}${anchored ? "$" : ""}`).test(target);
  } catch {
    // An unbuildable pattern is treated as not matching. It cannot be treated
    // as matching-and-disallowing either, because then a malformed file would
    // block a site its owner meant to open.
    return false;
  }
}

/**
 * May we fetch this path, according to this group?
 *
 * Longest match wins; a tie goes to Allow. Both halves matter: without the
 * length rule `Allow: /wp-admin/admin-ajax.php` loses to `Disallow: /`, and
 * without the tie rule an identical Allow and Disallow pair is decided by file
 * order, which nobody intends.
 *
 * No rules at all means allowed — that is what an empty group means, and it is
 * different from "we have not read the file", which is robotsDecision's job in
 * policy.js and is NOT decided here.
 */
export function groupAllows(group, path) {
  const rules = group?.rules || [];
  let best = null;

  for (const rule of rules) {
    if (!patternMatches(rule.path, path)) continue;
    const length = String(rule.path).length;
    if (!best || length > best.length || (length === best.length && rule.allow && !best.allow)) {
      best = { length, allow: rule.allow, path: rule.path };
    }
  }

  if (!best) return { allowed: true, rule: null, reason: "no_matching_rule" };
  return { allowed: best.allow, rule: best.path, reason: best.allow ? "allow_rule" : "disallow_rule" };
}

/**
 * The whole thing in one call: parse, pick our group, and hand back a matcher.
 *
 * @returns { agent, crawlDelayMs, allows(path), rootAllowed, ruleCount }
 *
 * `rootAllowed` is what gets cached in CrawlHostPolicy.robotsAllowed, and it
 * is deliberately the answer for "/" alone. The column is one boolean per
 * host, so it cannot hold per-path rules — and pretending it could is how a
 * cached "true" ends up authorising a path the file forbids. Every run that
 * actually crawls re-reads robots.txt and asks allows() per URL; the cached
 * boolean is only ever used to skip a host that said no at the root, which is
 * a refusal, never a permission.
 */
export function robotsFor(text, token = CRAWLER_TOKEN) {
  const parsed = parseRobots(text);
  const group = groupFor(parsed, token);

  return {
    agent: group.agent,
    crawlDelayMs: group.crawlDelay ?? null,
    ruleCount: group.rules.length,
    sitemaps: parsed.sitemaps,
    allows: (path) => groupAllows(group, path || "/"),
    rootAllowed: groupAllows(group, "/").allowed,
  };
}

/**
 * What a robots.txt fetch OUTCOME means, before any body is parsed.
 *
 * RFC 9309 §2.3.1 is specific about the failure modes and they do not all mean
 * the same thing:
 *
 *   2xx            → parse it
 *   4xx (not 429)  → "unavailable", and unavailable means allowed. A 404 is
 *                    the commonest robots.txt response on the web.
 *   429, 503       → the server is telling us to go away. That is a BLOCK, and
 *                    the one case where a robots failure is the host speaking
 *                    rather than the network failing.
 *   other 5xx      → "unreachable". NOT allowed, and not disallowed either:
 *                    we could not tell, so nothing is written to
 *                    robotsAllowed and the task retries. Writing `true` here
 *                    is the bug the three-valued column exists to prevent.
 *   network error  → same as other 5xx.
 */
export function robotsFetchOutcome({ status = null, error = null } = {}) {
  if (error) return { act: "unknown", reason: `robots_error:${error}` };
  if (status === null) return { act: "unknown", reason: "robots_no_status" };
  if (status >= 200 && status < 300) return { act: "parse", reason: "robots_ok" };
  if (status === 429 || status === 503) return { act: "blocked", reason: `robots_http_${status}` };
  if (status >= 400 && status < 500) return { act: "allow_all", reason: `robots_unavailable_${status}` };
  return { act: "unknown", reason: `robots_unreachable_${status}` };
}
