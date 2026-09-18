// lib/sales/intel/people.js
//
// Who to ask for. The named humans at a business, from whichever source
// named them, and the one rule that picks which name leads the rep card.
//
// ══ The problem ═══════════════════════════════════════════════════════════
//
// A register-sourced lead is a business name and a phone. The rep dials,
// somebody answers, and the rep has nobody to ask for — "is the owner
// there?" is the sentence every gatekeeper is trained to end. The
// regulators know the owner's name (a licence is held by a person), BBB
// prints "Principal Contacts", and a rep sometimes hears a name on the
// first call and needs to keep it for the second. Three sources, three
// levels of trust, one line on the card.
//
// ══ Never overwritten ═════════════════════════════════════════════════════
//
// A ProspectPerson row is one (prospect, source, name). A second load of the
// same file finds the row already there (the unique key) and adds nothing;
// a source that names a NEW person adds a row beside the old one. Nothing
// here ever UPDATEs a person row. What a rep typed sits beside what BBB
// said, and the card says which is which. "Typed beats fetched" is a READ
// rule — principalFor() below — never a write that replaces.
//
// ══ Which name leads ══════════════════════════════════════════════════════
//
//   1. typed     — the rep heard it. The most recent typed name leads.
//   2. bbb       — BBB's "Principal Contacts" is curated by the business
//                  itself, and its title is the one the business uses.
//   3. a register's personnel — the qualifying individual / owner /
//                  officers, by ROLE_RANK: the sole owner and the RMO/CEO
//                  before a plain officer, a Responsible Managing EMPLOYEE
//                  last (an employee qualifies the licence; they do not
//                  own the business).
//   4. crawl     — a name the site said, as a last resort.
//
// Within a source, the role decides, then the newest `seenAt`.
//
// PURE: no import that reaches lib/db. lib/sales/prospectView.js imports
// this and is itself imported by the rep's client page; a `pg` import here
// would put the Postgres driver in the browser bundle (the build refuses).

export const PEOPLE_SOURCES = Object.freeze({
  typed: { rank: 0, label: "typed by the rep", short: "rep" },
  bbb: { rank: 1, label: "BBB profile", short: "BBB" },
  cslb_personnel: { rank: 2, label: "CSLB personnel file", short: "CSLB" },
  us_wa_lni: { rank: 2, label: "Washington L&I register", short: "L&I" },
  us_or_ccb: { rank: 2, label: "Oregon CCB register", short: "CCB" },
  crawl: { rank: 3, label: "their website", short: "site" },
});

/** Roles that mean "this is the person who owns or runs it", best first.
 *  Matched by substring against the lowercased role, so CSLB's compound
 *  "Responsible Managing Officer/Chief Executive Officer/President" ranks
 *  with the owners and BBB's "Owner" ranks first. */
export const ROLE_RANK = Object.freeze([
  ["owner", 0],
  ["sole", 0],
  ["proprietor", 0],
  ["president", 1],
  ["chief executive", 1],
  ["ceo", 1],
  ["principal", 1],
  ["founder", 1],
  ["qualifying partner", 2],
  ["general partner", 2],
  ["partner", 2],
  ["managing member", 2],
  ["llc manager", 2],
  ["llc member", 3],
  ["responsible managing officer", 3],
  ["responsible managing manager", 3],
  ["manager", 3],
  ["director", 4],
  ["vice president", 4],
  ["secretary", 5],
  ["treasurer", 5],
  ["officer", 5],
  ["responsible managing employee", 7],
  ["employee", 8],
]);

const HONORIFICS = /^(mr|mrs|ms|miss|mx|dr|sr|sra|srta|m|mme|mlle)\.?\s+/i;
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function stripDiacritics(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** The idempotency key: lowercased, de-accented, letters and digits only. */
export function nameKeyFor(name) {
  return stripDiacritics(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** "SANCHEZ-LOPEZ" → "Sanchez-Lopez", "o'brien" → "O'Brien", "mcdonald" left
 *  as "Mcdonald" — we do not guess Scottish capitalisation. */
export function titleCaseName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

/**
 * One free-text name as a source printed it → { name, givenName, familyName }.
 *
 * Honorifics dropped ("Mr. Alexander Singer" → "Alexander Singer"); a
 * trailing generational suffix kept on the name but never taken as a
 * family name. `givenName` is the first token only when there are at least
 * two tokens — a one-word name is a name we cannot split.
 */
export function tidyPersonName(raw) {
  let text = String(raw ?? "").replace(/\s+/g, " ").trim().replace(HONORIFICS, "");
  if (!text) return null;
  // Already in "Given Family" order. Title-case an ALL-CAPS name only; a
  // mixed-case name is how the source wrote it and stays.
  const allCaps = text === text.toUpperCase() && /[A-Z]/.test(text);
  if (allCaps) text = titleCaseName(text);
  const tokens = text.split(" ");
  const bare = tokens.filter((t) => !SUFFIXES.has(t.toLowerCase().replace(/\./g, "")));
  const givenName = bare.length >= 2 ? bare[0] : null;
  const familyName = bare.length >= 2 ? bare[bare.length - 1] : null;
  return { name: text, givenName, familyName };
}

/**
 * CSLB's fixed-width "LAST  FIRST  MIDDLE  SUFFIX" column → the same shape,
 * in "First Middle Last Suffix" order.
 *
 * The file pads each part to a column with runs of spaces; a single space
 * is a space INSIDE a part ("DE LA CRUZ", "MARY ANN"). So the split is on
 * two-or-more spaces, and a one-part name (no run at all) is returned as
 * it stands: a business name in the Business rows, a mononym otherwise.
 */
export function cslbPersonName(raw) {
  const text = String(raw ?? "").replace(/[\u0000-\u001f]/g, " ").trim();
  if (!text) return null;
  const parts = text.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    const one = titleCaseName(parts[0]);
    return { name: one, givenName: null, familyName: null };
  }
  const [last, first, ...rest] = parts;
  // A trailing JR/SR/III is a suffix, whatever column it landed in.
  const tail = rest.length && SUFFIXES.has(rest[rest.length - 1].toLowerCase()) ? rest.pop() : null;
  const middle = rest.join(" ");
  const name = titleCaseName([first, middle, last].filter(Boolean).join(" ")) + (tail ? ` ${tail.charAt(0) + tail.slice(1).toLowerCase()}` : "");
  return { name, givenName: titleCaseName(first), familyName: titleCaseName(last) };
}

/** A role's rank for principalFor. Unknown roles sit behind every known one. */
export function roleRank(role) {
  const r = String(role ?? "").toLowerCase();
  if (!r) return 9;
  let best = 9;
  for (const [needle, rank] of ROLE_RANK) {
    if (r.includes(needle) && rank < best) best = rank;
  }
  return best;
}

function sourceRank(source) {
  return PEOPLE_SOURCES[source]?.rank ?? 9;
}

function at(value) {
  const d = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * The people, best first: source rank, then role rank, then newest.
 * Pure; the check drives it.
 */
export function rankPeople(people = []) {
  return (Array.isArray(people) ? people : [])
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .slice()
    .sort((a, b) => {
      const s = sourceRank(a.source) - sourceRank(b.source);
      if (s) return s;
      const r = roleRank(a.role) - roleRank(b.role);
      if (r) return r;
      return at(b.seenAt) - at(a.seenAt);
    });
}

/** The one person to ask for, or null. */
export function principalFor(people = []) {
  return rankPeople(people)[0] || null;
}

/**
 * The "Who to ask for" line: { name, givenName, role, source, sourceLabel,
 * text, others } — `others` are the remaining names, for the card's
 * expander and the platform page.
 */
export function whoToAskFor(people = []) {
  const ranked = rankPeople(people);
  const lead = ranked[0];
  if (!lead) return null;
  const src = PEOPLE_SOURCES[lead.source] || { label: lead.source, short: lead.source };
  const role = lead.role ? String(lead.role) : null;
  const seen = lead.seenAt ? new Date(lead.seenAt) : null;
  const day = seen && !Number.isNaN(seen.getTime()) ? seen.toISOString().slice(0, 10) : null;
  const text = `${lead.name}${role ? ` — ${role}` : ""} (per ${src.label}${day ? `, ${day}` : ""})`;
  return {
    name: lead.name,
    givenName: lead.givenName || tidyPersonName(lead.name)?.givenName || null,
    role,
    source: lead.source,
    sourceLabel: src.label,
    sourceShort: src.short,
    seenAt: day,
    text,
    others: ranked.slice(1).map((p) => ({
      name: p.name,
      role: p.role || null,
      source: p.source,
      sourceLabel: (PEOPLE_SOURCES[p.source] || { label: p.source }).label,
    })),
  };
}

/**
 * Everything a batch of people from ONE source writes, decided without a
 * database: the ProspectPerson rows not already present, and one evidence
 * row per person so the brief can cite "CSLB lists Maria Sanchez as owner".
 *
 * @param prospectId
 * @param people     [{ name, givenName?, role? }] as the source said
 * @param source     a PEOPLE_SOURCES key
 * @param sourceUrl  where a human can see it
 * @param seenAt     when the source said it
 * @param existing   this prospect's ProspectPerson rows (source + nameKey)
 * @param detector   the evidence detector ("cslb.personnel", "bbb.profile")
 */
export function planPeopleWrite({ prospectId, people = [], source, sourceUrl = null, seenAt = new Date(), existing = [], detector = null, detectorVersion = "1", typedBySalesRepId = null } = {}) {
  if (!prospectId || !PEOPLE_SOURCES[source]) return { rows: [], evidence: [], skipped: 0 };
  const have = new Set((Array.isArray(existing) ? existing : []).map((e) => `${e.source}|${e.nameKey}`));
  const rows = [];
  const evidence = [];
  let skipped = 0;
  const seenKeys = new Set();
  for (const person of Array.isArray(people) ? people : []) {
    const tidy = person?.name ? { name: String(person.name).replace(/\s+/g, " ").trim(), givenName: person.givenName || null } : null;
    if (!tidy?.name) continue;
    const nameKey = nameKeyFor(tidy.name);
    if (!nameKey || seenKeys.has(nameKey)) continue;
    seenKeys.add(nameKey);
    if (have.has(`${source}|${nameKey}`)) {
      skipped += 1;
      continue;
    }
    const role = person.role ? String(person.role).replace(/\s+/g, " ").trim().slice(0, 120) : null;
    rows.push({
      prospectId,
      name: tidy.name.slice(0, 160),
      givenName: tidy.givenName ? String(tidy.givenName).slice(0, 80) : null,
      role,
      source,
      sourceUrl: sourceUrl || null,
      seenAt,
      typedBySalesRepId: source === "typed" ? typedBySalesRepId || null : null,
      nameKey,
    });
    const label = PEOPLE_SOURCES[source].label;
    evidence.push({
      prospectId,
      type: "person",
      source,
      sourceUrl: sourceUrl || null,
      rawValue: `${label[0].toUpperCase()}${label.slice(1)} lists ${tidy.name}${role ? ` as ${role}` : ""}`.slice(0, 2000),
      normalizedValue: nameKey.slice(0, 500),
      observedAt: seenAt,
      confidence: source === "typed" ? 0.9 : 1.0,
      detector: detector || `people.${source}`,
      detectorVersion,
    });
  }
  return { rows, evidence, skipped };
}

/**
 * Write a source's people onto a prospect. Creates only; the unique key
 * makes a repeat a no-op (`skipDuplicates`), so a load can be re-run.
 *
 * @returns { added, skipped }
 */
export async function recordPeople({ db, prospectId, people = [], source, sourceUrl = null, seenAt = new Date(), detector = null, detectorVersion = "1", typedBySalesRepId = null } = {}) {
  // A scripted fake db without the table (the older checks) is "nothing to
  // write to", not an error — the ingest must not fail its check over a
  // name it could not store.
  if (!db || !prospectId || typeof db.prospectPerson?.findMany !== "function") return { added: 0, skipped: 0 };
  const existing = await db.prospectPerson.findMany({ where: { prospectId }, select: { source: true, nameKey: true } });
  const plan = planPeopleWrite({ prospectId, people, source, sourceUrl, seenAt, existing, detector, detectorVersion, typedBySalesRepId });
  if (!plan.rows.length) return { added: 0, skipped: plan.skipped };
  await db.$transaction(async (tx) => {
    await tx.prospectPerson.createMany({ data: plan.rows, skipDuplicates: true });
    if (plan.evidence.length) await tx.prospectEvidence.createMany({ data: plan.evidence });
  });
  return { added: plan.rows.length, skipped: plan.skipped };
}

/** The select the card and the script read. */
export const PEOPLE_SELECT = Object.freeze({
  id: true,
  name: true,
  givenName: true,
  role: true,
  source: true,
  sourceUrl: true,
  seenAt: true,
  typedBySalesRepId: true,
});

/** The BBB search a rep opens by hand when nothing matched automatically. */
export function bbbSearchUrl(prospect = {}) {
  const name = String(prospect?.businessName || "").trim();
  if (!name) return null;
  const loc = [prospect?.city, prospect?.province].filter(Boolean).join(", ");
  const params = new URLSearchParams({ find_text: name });
  if (loc) params.set("find_loc", loc);
  return `https://www.bbb.org/search?${params.toString()}`;
}

/** What BBB said about the business, in one line for the card, or null. */
export function bbbFactLine(prospect = {}) {
  const bits = [];
  if (prospect?.employeeRange) bits.push(`${prospect.employeeRange} employees`);
  if (prospect?.businessStartedYear) bits.push(`in business since ${prospect.businessStartedYear}`);
  if (prospect?.bbbRating) {
    bits.push(prospect.bbbAccredited === true ? `${prospect.bbbRating} accredited` : prospect.bbbAccredited === false ? `${prospect.bbbRating}, not accredited` : `rated ${prospect.bbbRating}`);
  } else if (prospect?.bbbAccredited === true) bits.push("BBB accredited");
  if (prospect?.entityType) bits.push(String(prospect.entityType).toLowerCase());
  if (!bits.length) return null;
  return bits.join(" · ");
}

