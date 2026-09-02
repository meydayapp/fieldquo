// lib/sales/suppressionRules.js
//
// The rules of FieldQuo's own do-not-contact list, with no database in them.
//
// ══ Why the rules are separated from the queries ═══════════════════════════
//
// Every real bug this file could contain is a NORMALISATION bug, and a
// normalisation bug is invisible by reading. "+1 (613) 555-0142" and
// "613-555-0142" are one phone; "Bob <BOB@Acme.com>" and "bob@acme.com" are
// one person; "https://www.Acme.com/contact" and "acme.com" are one domain. A
// list that stores one spelling and looks up another is a suppression list
// that answers "not suppressed" to the person who asked us to stop — which is
// worse than having no list at all, because it looks like it works.
//
// So the whole of it is plain functions, executed by
// scripts/check-sales-suppression.mjs against the ways each could be wrong.
// lib/sales/suppression.js holds the queries and takes its Prisma client as an
// argument, the shape lib/marketing/unsubscribe.js and lib/sales/
// outreachInbound.js already use for exactly this reason.
//
// ══ The one import, and why it is not a local copy ═════════════════════════
//
// toE164 comes from lib/voice/numbers.js rather than being reimplemented here.
// A second phone normaliser is not a style question: if the suppression list
// normalises "+16135550142" and the dialler normalises "16135550142", the
// lookup misses and the call goes out. AGENTS.md's failure class #4 — the copy
// is the one that rots — has an unusually expensive version here.
import { toE164 } from "@/lib/voice/numbers";

/** The three ways a suppression can be keyed. */
export const SUPPRESSION_KINDS = ["email", "phone", "domain"];

/**
 * The channels a suppression can close.
 *
 * "sms" is separate from "phone" because a person can mean either — "stop
 * texting me" is not "stop calling me" — and collapsing them would make a
 * narrow request silently broader than what was asked, which is the same
 * class of dishonesty as making it narrower.
 */
export const SUPPRESSION_CHANNELS = ["email", "phone", "sms"];

/**
 * What an unqualified "stop" means.
 *
 * Every channel. This is the audit's central point stated as a constant: a
 * prospect who says "stop" by phone must also stop receiving email, so the
 * default is the WIDEST reading rather than the channel the request happened
 * to arrive on. Over-suppression costs FieldQuo a prospect it was told to drop
 * anyway; under-suppression is the violation.
 *
 * A caller that genuinely knows the request was narrow ("email is fine, don't
 * ring me at work") passes the narrower list explicitly. Nothing infers one.
 */
export const ALL_CHANNELS = [...SUPPRESSION_CHANNELS];

/** How a request reached us. Stored, never guessed. */
export const SUPPRESSION_SOURCES = [
  "reply", // they replied to an email and said stop
  "call", // they said it on the phone
  "sms", // they texted STOP
  "form", // a web form
  "manual", // a human recorded it from somewhere else, with a note
  "import", // loaded in bulk from a list FieldQuo already held
  "regulator", // a DNC list or a complaint
];

export function isSuppressionKind(value) {
  return SUPPRESSION_KINDS.includes(value);
}

export function isSuppressionChannel(value) {
  return SUPPRESSION_CHANNELS.includes(value);
}

export function isSuppressionSource(value) {
  return SUPPRESSION_SOURCES.includes(value);
}

// ── Normalisation ──────────────────────────────────────────────────────────

/**
 * An email address as the list stores it.
 *
 * Angle brackets stripped, lowercased, trimmed. Plus-tags are KEPT — see
 * emailLookupKeys() for why the widening happens at lookup time and not here:
 * what we store should be what the person actually gave us, because that is
 * the evidence.
 *
 * Returns null rather than a best guess for anything that is not an address.
 * A null key would otherwise be stored as the empty string and match every
 * lookup that also failed to parse — a suppression list that blocks everyone
 * is discovered fast, but a check is cheaper.
 */
export function normaliseEmail(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // "Ada Lovelace <ada@acme.com>" — take what is inside the brackets.
  const angled = raw.match(/<([^>]+)>/);
  const address = (angled ? angled[1] : raw).trim().toLowerCase();

  // Control characters, spaces and the header-injection set are refused rather
  // than stripped: unlike an inbound subject line (which must be stored
  // whatever arrives), a malformed suppression key has no value worth keeping
  // and every reason not to be silently reshaped into a different address.
  if (/[\s\r\n<>,;"\\]/.test(address)) return null;
  if (address.length > 254) return null;

  const at = address.lastIndexOf("@");
  if (at <= 0 || at === address.length - 1) return null;
  const local = address.slice(0, at);
  const domain = normaliseDomain(address.slice(at + 1));
  if (!domain || !local) return null;

  return `${local}@${domain}`;
}

/**
 * A registrable domain: no scheme, no www., no port, no path, lowercased.
 *
 * Accepts a bare domain, a URL, or an email address's right-hand side, because
 * a superadmin pasting a bulk import will produce all three and refusing two
 * of them would mean a list loaded with silent gaps in it.
 *
 * Deliberately does NOT reduce to an eTLD+1. "support.acme.com" and "acme.com"
 * are different keys, and collapsing them would need a public-suffix list this
 * repo does not have — inventing one would make `co.uk` suppress every British
 * business FieldQuo will ever contact.
 */
export function normaliseDomain(value) {
  let raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;

  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // scheme
  const at = raw.lastIndexOf("@");
  if (at !== -1) raw = raw.slice(at + 1); // an address was pasted
  raw = raw.split("/")[0].split("?")[0].split("#")[0]; // path, query, fragment
  raw = raw.split(":")[0]; // port
  raw = raw.replace(/^www\./, "");
  raw = raw.replace(/\.$/, ""); // the fully-qualified trailing dot

  if (!raw || raw.length > 253) return null;
  // Labels of letters, digits and hyphens, at least two of them, and a TLD
  // that is not numeric — which is what keeps an IP address out of the domain
  // column, where it would be a key nothing ever matches.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(raw)) {
    return null;
  }
  if (/^[0-9.]+$/.test(raw)) return null;
  return raw;
}

/** A phone number as the list stores it: E.164, or null. */
export function normalisePhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const e164 = toE164(raw);
  if (!e164) return null;
  // toE164 will happily return "+0" for pathological input; a key that short
  // is not a number anyone can be reached on.
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/**
 * Normalise a value for a stated kind. Returns null when it is not one.
 *
 * The kind is required rather than sniffed. An address and a domain are
 * distinguishable, but "6135550142" sniffs as a phone and "acme" sniffs as
 * nothing, and a bulk import that guessed wrong would file a prospect's phone
 * number in the domain column, where no lookup would ever find it.
 */
export function normaliseSuppressionValue(kind, value) {
  if (kind === "email") return normaliseEmail(value);
  if (kind === "phone") return normalisePhone(value);
  if (kind === "domain") return normaliseDomain(value);
  return null;
}

// ── Lookup keys ────────────────────────────────────────────────────────────

/**
 * Every email key a lookup should consider for one address.
 *
 * Three, in widening order:
 *
 *   1. the address itself, normalised
 *   2. the same address with any plus-tag removed — "bob+fieldquo@acme.com"
 *      reaches the mailbox "bob@acme.com", so a person who opted out as one
 *      must not be reachable as the other
 *   3. its domain, so a suppressed company is suppressed at every address
 *
 * The widening is here, at lookup, and NOT in what gets stored: storing the
 * plus-stripped form would throw away the address the person actually used,
 * which is the evidence of what they asked. Reading widely and writing
 * narrowly is the right way round.
 *
 * Sub-addressing is not universal, so stripping the tag can in principle
 * suppress a second real mailbox on a provider that treats "+" as an ordinary
 * character. That is over-suppression, and over-suppression is the failure
 * this list is allowed to have.
 */
export function emailLookupKeys(value) {
  const email = normaliseEmail(value);
  if (!email) return [];

  const keys = [{ kind: "email", value: email }];

  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const plus = local.indexOf("+");
  if (plus > 0) {
    keys.push({ kind: "email", value: `${local.slice(0, plus)}@${domain}` });
  }

  keys.push({ kind: "domain", value: domain });
  return keys;
}

/** Every key a lookup should consider for one contact. */
export function suppressionLookupKeys({ email, phone, domain } = {}) {
  const keys = [];
  const seen = new Set();
  const add = (kind, value) => {
    if (!value) return;
    const id = `${kind}:${value}`;
    if (seen.has(id)) return;
    seen.add(id);
    keys.push({ kind, value });
  };

  for (const k of emailLookupKeys(email)) add(k.kind, k.value);
  add("phone", normalisePhone(phone));
  add("domain", normaliseDomain(domain));
  return keys;
}

// ── The verdict ────────────────────────────────────────────────────────────

/**
 * Given rows already read, may FieldQuo contact this person on this channel?
 *
 * Split out of the query the same way lib/voice/outbound.js's consentVerdict
 * is split out of mayCall, and for the same reason: this is the decision worth
 * executing — a removed row, a row that closes a different channel, a domain
 * hit standing in for an address that was never listed — and none of it is
 * reachable through an async function that queries Postgres.
 *
 * @param rows    SalesSuppression rows matching the contact's lookup keys
 * @param channel "email" | "phone" | "sms"
 * @returns { suppressed, hit, reason }
 */
export function suppressionVerdict({ rows = [], channel } = {}) {
  if (!isSuppressionChannel(channel)) {
    // An unrecognised channel is refused, not waved through. A typo'd channel
    // name silently bypassing the whole list is precisely the "control that
    // appears to work and doesn't" this exists to prevent.
    return {
      suppressed: true,
      hit: null,
      reason: `"${channel}" isn't a channel this list knows about, so nothing is sent on it.`,
    };
  }

  const live = rows.filter(
    (r) => r && !r.removedAt && Array.isArray(r.channels) && r.channels.includes(channel),
  );
  if (!live.length) return { suppressed: false, hit: null, reason: null };

  // The most specific hit is the one a human should be shown: "this person
  // asked us to stop" is actionable where "somebody at this domain did" needs
  // a different conversation.
  const rank = { email: 0, phone: 1, domain: 2 };
  const hit = live.slice().sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9))[0];

  return { suppressed: true, hit, reason: describeSuppression(hit) };
}

/** What to tell a rep, in words they can act on. */
export function describeSuppression(row) {
  if (!row) return null;
  const when = row.requestedAt ? new Date(row.requestedAt).toISOString().slice(0, 10) : null;
  const what =
    row.kind === "domain"
      ? `Everyone at ${row.value} is on FieldQuo's do-not-contact list`
      : `${row.value} is on FieldQuo's do-not-contact list`;
  const how =
    {
      reply: "they replied asking us to stop",
      call: "they asked on the phone",
      sms: "they texted STOP",
      form: "they asked through a form",
      manual: "recorded by hand",
      import: "loaded from an existing list",
      regulator: "from a do-not-call list",
    }[row.source] || "recorded";
  return `${what} — ${how}${when ? `, ${when}` : ""}. That request binds FieldQuo, not one rep's copy of it.`;
}

// ── Retention ──────────────────────────────────────────────────────────────

/**
 * The date before which a suppression row must not be deleted by anything.
 *
 * ══ Three years and fourteen days ══════════════════════════════════════════
 *
 * Canada's Unsolicited Telecommunications Rules require a telemarketer calling
 * on its own behalf to keep an INTERNAL do-not-call list, and to retain a
 * request on it for three years and fourteen days from the date the request
 * was made. The fourteen days is not decoration: the underlying obligation is
 * to honour a request within fourteen days of receiving it, so the retention
 * window is the three-year duty plus the grace period in which a request that
 * arrived on the last day of it is still being actioned. Dropping the fourteen
 * days would make the last two weeks of every record unprovable.
 *
 * This obligation applies to FieldQuo even though the National DNCL rules do
 * not: business-to-business calls are exempt from the National DNCL, and are
 * NOT exempt from the internal-list requirement. See
 * docs/sales-intel/AUDIT-compliance.md §7.
 *
 * FieldQuo keeps these rows forever — removal is a soft `removedAt`, and
 * nothing prunes them. This function exists so the minimum is a stored,
 * checkable date on every row rather than a paragraph in a document, and so
 * any sweep written later has something concrete to refuse to cross.
 */
export const INTERNAL_DNC_RETENTION = { years: 3, days: 14 };

export function internalDncRetainUntil(requestedAt = new Date()) {
  const from = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  if (Number.isNaN(from.getTime())) return internalDncRetainUntil(new Date());

  // Calendar arithmetic, not 3 * 365 days: a leap year inside the window would
  // otherwise shorten the obligation by a day, and "a day short of the legal
  // minimum" is the only kind of wrong this can be.
  const until = new Date(from.getTime());
  until.setFullYear(until.getFullYear() + INTERNAL_DNC_RETENTION.years);
  until.setDate(until.getDate() + INTERNAL_DNC_RETENTION.days);
  return until;
}

/** Is this row still inside its legal retention window? */
export function withinRetention(row, now = new Date()) {
  if (!row?.retainUntil) return true; // unknown means keep it
  return new Date(row.retainUntil) > now;
}
