// lib/platform/errorKinds.js
//
// Two facts about a PlatformErrorLog row that its columns do not state:
// what KIND of entry it is, and WHERE it was written. Pure — no imports —
// so the /platform/errors page and the route read the same answer.
//
// ══ Kind: Errors · Notices · Security ═════════════════════════════════════
//
// The log had one bucket, and the owner read a voice credit running out, a
// QA send to example.com and a scanner knocking on the voice webhook as
// "things that are broken". They are not. Three kinds:
//
//   error     something failed and somebody should fix it. The default.
//   notice    worth knowing, nothing to fix: a balance ran out, a test
//             address was not mailed.
//   security  somebody sent us something we refused on purpose — a bad
//             webhook signature, a shared seat.
//
// ONE map, by (area, code), read at READ time. Not a column: the rows
// already written (26,000 of them on 2026-09-29) are classified by the same
// rule as the next one, with no backfill, and moving a code between kinds
// is an edit here that re-files its whole history at once. A code this map
// does not name is an error — the safe default, because a new failure must
// never land in a tab nobody opens.
//
// Every rule is also expressible as a Prisma WHERE (kindWhere), so the tabs
// filter in the database rather than after a 100-row page.
//
// ══ Environment ═══════════════════════════════════════════════════════════
//
// `next dev` and every script on the owner's Mac run against the PRODUCTION
// database (.env is production), so their failures land in this log beside
// fieldquo.com's. "RESEND_API_KEY is not set on this deployment" came from
// local runs — production has the key. recordError now stamps
// detail.env = VERCEL_ENV ("production" | "preview") or "local" when that
// is absent. It lives in `detail`, the Json column whose schema comment
// says it exists so an area can record what is useful "without a schema
// change". Rows written before 2026-09-29 carry no stamp; the list shows
// them under Production labelled "not recorded", rather than guessing
// where they came from.

export const ERROR_KINDS = Object.freeze(["error", "notice", "security"]);
export const KIND_LABELS = Object.freeze({ error: "Errors", notice: "Notices", security: "Security" });

/**
 * The map. First match wins; no match is "error". Each rule names an area,
 * a code, a code prefix and/or a message substring — all that is set must
 * hold.
 */
export const KIND_RULES = Object.freeze([
  // The voice webhook turning away an unsigned or mis-signed delivery —
  // lib/voice/webhookHealth.js recordRejectedDelivery. Probes, not faults.
  { kind: "security", area: "voice_webhook", codePrefix: "webhook_rejected_" },
  // The sales inbound webhook's Twilio signature check (app/api/rep-dial/inbound).
  { kind: "security", code: "signature_rejected" },
  // Seat sharing (lib/security/deviceGuard.js) — "nothing broke", its own
  // label on the page already says.
  { kind: "security", area: "account_abuse" },
  // "Voice credit exhausted — the agent was detached" (app/api/voice/webhook).
  // The spend gate doing its job; the company is told by its own flow.
  { kind: "notice", area: "voice_credit" },
  // A send to an RFC 2606 reserved domain, not attempted (lib/email/resend.js).
  { kind: "notice", area: "email", code: "email_reserved_domain" },
  // …and the same thing before it was refused up front: Resend's own
  // "use our testing email address instead of domains like example.com".
  { kind: "notice", area: "email", code: "resend_rejected", messageContains: "@example." },
]);

function ruleMatches(rule, row) {
  const code = typeof row?.code === "string" ? row.code : null;
  if (rule.area && row?.area !== rule.area) return false;
  if (rule.code && code !== rule.code) return false;
  if (rule.codePrefix && !(code && code.startsWith(rule.codePrefix))) return false;
  if (rule.messageContains && !(typeof row?.message === "string" && row.message.includes(rule.messageContains))) return false;
  return true;
}

/** The kind of one row. Pure. */
export function kindOf(row) {
  for (const rule of KIND_RULES) if (ruleMatches(rule, row)) return rule.kind;
  return "error";
}

/**
 * One rule as a Prisma WHERE that is safe under NOT. `code` is nullable,
 * and SQL's NOT over a comparison with NULL is NULL — a row with no code
 * would silently vanish from the Errors tab. Pairing each code test with
 * `code IS NOT NULL` makes the rule FALSE, not NULL, for such a row.
 */
function ruleWhere(rule) {
  const and = [];
  if (rule.area) and.push({ area: rule.area });
  if (rule.code || rule.codePrefix) and.push({ code: { not: null } });
  if (rule.code) and.push({ code: rule.code });
  if (rule.codePrefix) and.push({ code: { startsWith: rule.codePrefix } });
  if (rule.messageContains) and.push({ message: { contains: rule.messageContains } });
  return { AND: and };
}

/** Prisma WHERE for one tab. Unknown kind → null (the caller refuses it). */
export function kindWhere(kind) {
  if (!ERROR_KINDS.includes(kind)) return null;
  if (kind === "error") {
    // Everything no rule claims. First-match order does not matter here:
    // any rule matching makes a row not-an-error.
    return { NOT: { OR: KIND_RULES.map(ruleWhere) } };
  }
  // A row claimed by an EARLIER rule of another kind is that kind's. The
  // rules today do not overlap; this keeps the database and kindOf agreeing
  // if two ever do.
  const clauses = [];
  const earlier = [];
  for (const rule of KIND_RULES) {
    if (rule.kind === kind) clauses.push(earlier.length ? { AND: [ruleWhere(rule), { NOT: { OR: [...earlier] } }] } : ruleWhere(rule));
    else earlier.push(ruleWhere(rule));
  }
  return { OR: clauses };
}

// ── Environment ─────────────────────────────────────────────────────────────

export const ENVIRONMENTS = Object.freeze(["production", "preview", "local"]);
export const ENVIRONMENT_FILTERS = Object.freeze(["production", "preview", "local", "all"]);

/** Where this process is running: VERCEL_ENV when Vercel says, else "local". */
export function currentEnvironment(env = typeof process !== "undefined" ? process.env : {}) {
  const v = typeof env?.VERCEL_ENV === "string" ? env.VERCEL_ENV.trim() : "";
  if (v === "production" || v === "preview") return v;
  // Vercel's third value is "development" (`vercel dev`) — the owner's
  // machine, like no value at all.
  return "local";
}

/** The environment a row was written in, or null for a row from before the stamp. */
export function environmentOf(row) {
  const v = row?.detail && typeof row.detail === "object" && !Array.isArray(row.detail) ? row.detail.env : null;
  return ENVIRONMENTS.includes(v) ? v : null;
}

/**
 * Prisma WHERE for the environment filter. "production" includes the rows
 * that recorded nothing (written before the stamp) — they are shown and
 * labelled, not hidden. "all" → {}. Unknown → null.
 *
 * `anyNull` is Prisma.AnyNull, passed in so this file stays import-free:
 * a JSON path that is absent compares as AnyNull, and a NOT over the path
 * would drop those rows instead (measured on production, 2026-09-29: NOT
 * env∈{preview,local} matched 0 of 25,976 rows; path = AnyNull matched all).
 */
export function environmentWhere(filter, { anyNull } = {}) {
  if (filter === "all") return {};
  if (!ENVIRONMENTS.includes(filter)) return null;
  const is = (v) => ({ detail: { path: ["env"], equals: v } });
  if (filter !== "production") return is(filter);
  return { OR: [is("production"), ...(anyNull !== undefined ? [is(anyNull)] : [])] };
}
