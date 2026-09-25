// lib/mailbox/addresses.js
//
// Who an email is between, and whether that is one of the company's clients.
//
// ══ Deterministic, on purpose ═════════════════════════════════════════════
//
// Filing is address matching and nothing else — no model reads a message to
// decide whose it is. That keeps it free, explainable ("filed because
// dana@x.com is Dana Cole's email") and testable: scripts/check-mailbox.mjs
// executes every rule below against hostile headers.
//
// ══ The canonical form, and exactly how far it goes ═══════════════════════
//
//   · lowercase, whitespace and angle brackets off;
//   · plus-addressing: "dana+quotes@x.com" is dana@x.com. Every major host
//     delivers the tagged form to the same mailbox, and a client who signs
//     up as dana+reno@ and writes from dana@ is one person;
//   · Gmail only: dots in the local part are ignored and googlemail.com is
//     gmail.com — Google's documented behaviour for consumer accounts. NOT
//     applied to other domains: at most hosts j.smith@ and jsmith@ are two
//     different people, and merging them would file one client's email under
//     another.
//
// ══ The mailbox owner is never a counterpart ══════════════════════════════
//
// A contractor often puts their OWN address on a test client ("Me Test"),
// or a client record carries the office's address. If that address counted,
// every email in the mailbox would match that client and the whole inbox —
// personal mail included — would be filed. So the company's own addresses
// (every connected mailbox, the company's contact email) are removed from
// the index before anything is matched, and a message's own-side addresses
// are removed before its counterparts are read.

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** "Dana <DANA+x@Gmail.com>" → "dana+x@gmail.com" (bare, lowercase), or null. */
export function bareAddress(value) {
  const s = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!s) return null;
  const angled = s.match(/<([^<>]*)>\s*$/) || s.match(/<([^<>]*)>/);
  const raw = (angled ? angled[1] : s).trim().replace(/^mailto:/i, "").toLowerCase();
  // One @, a non-empty local part, a dotted domain, no spaces or separators.
  if (!/^[^\s@<>,;"()]+@[a-z0-9.-]+\.[a-z0-9-]{2,}$/i.test(raw)) return null;
  if (raw.length > 254) return null;
  return raw;
}

/** The matching key for one address — see the header for how far it goes. */
export function canonicalAddress(value) {
  const bare = bareAddress(value);
  if (!bare) return null;
  const at = bare.lastIndexOf("@");
  let local = bare.slice(0, at);
  let domain = bare.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    local = local.replace(/\./g, "");
  }
  if (!local) return null;
  return `${local}@${domain}`;
}

/**
 * Split a stored "email" field that may hold several addresses ("a@x.com;
 * b@y.com", "a@x.com, b@y.com") into canonical keys. Client.email is one
 * column, and people type two into it.
 */
export function addressesInField(value) {
  return String(value ?? "")
    .split(/[,;\s]+/)
    .map((part) => canonicalAddress(part))
    .filter(Boolean);
}

/**
 * The company's own addresses, canonical — see the header.
 * @param mailboxes  [{ address }]
 * @param extra      more own addresses (Company.email)
 */
export function ownAddressSet(mailboxes = [], extra = []) {
  const set = new Set();
  for (const m of mailboxes) for (const a of addressesInField(m?.address)) set.add(a);
  for (const e of extra) for (const a of addressesInField(e)) set.add(a);
  return set;
}

/**
 * canonical address → { kind: "client"|"lead", id, name }.
 *
 * Clients win over leads (a lead that became a client is the client now).
 * Among clients, an address on two client rows is AMBIGUOUS and maps to
 * nothing: guessing would file one household's email into another's history,
 * which is worse than not filing it. The newest lead wins among leads — the
 * same person enquiring twice is one conversation.
 *
 * @param clients  [{ id, name, email }]
 * @param leads    [{ id, name, email, createdAt }]  (optional)
 * @param own      Set of the company's own canonical addresses (excluded)
 */
export function buildMatchIndex({ clients = [], leads = [], own = new Set() } = {}) {
  const index = new Map();
  const clientHits = new Map();
  for (const c of clients) {
    for (const a of addressesInField(c?.email)) {
      if (own.has(a)) continue;
      if (!clientHits.has(a)) clientHits.set(a, []);
      if (!clientHits.get(a).some((x) => x.id === c.id)) clientHits.get(a).push(c);
    }
  }
  for (const [a, rows] of clientHits) {
    if (rows.length === 1) index.set(a, { kind: "client", id: rows[0].id, name: rows[0].name || null });
    else index.set(a, { kind: "ambiguous", ids: rows.map((r) => r.id) });
  }
  const sortedLeads = [...leads].sort((x, y) => new Date(y?.createdAt || 0) - new Date(x?.createdAt || 0));
  for (const l of sortedLeads) {
    for (const a of addressesInField(l?.email)) {
      if (own.has(a) || index.has(a)) continue;
      index.set(a, { kind: "lead", id: l.id, name: l.name || null });
    }
  }
  return index;
}

/**
 * Parse one address header (From / To / Cc) into [{ name, address }], where
 * `address` is bare. Accepts mailparser's { value: [...] }, imapflow's
 * envelope arrays, Graph's [{ emailAddress: { name, address } }], a raw
 * header string, or an array of any of those. Groups are flattened.
 */
export function parseAddressList(field) {
  const out = [];
  const push = (name, address) => {
    const bare = bareAddress(address);
    if (bare) out.push({ name: name ? String(name).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) : null, address: bare });
  };
  const walk = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === "string") return splitHeader(v).forEach((p) => push(p.name, p.address));
    if (typeof v === "object") {
      if (Array.isArray(v.value)) return walk(v.value);
      if (Array.isArray(v.group)) return walk(v.group);
      if (v.emailAddress) return push(v.emailAddress.name, v.emailAddress.address);
      if (v.address) return push(v.name, v.address);
    }
  };
  walk(field);
  return out;
}

/**
 * A raw header string → [{ name, address }]. Commas inside quoted display
 * names ("Cole, Dana" <dana@x.com>) do not split.
 */
function splitHeader(header) {
  const parts = [];
  let cur = "";
  let quoted = false;
  let angle = 0;
  for (const ch of String(header)) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "<") angle += 1;
    else if (!quoted && ch === ">") angle = Math.max(0, angle - 1);
    if (!quoted && angle === 0 && (ch === "," || ch === ";")) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts
    .map((p) => p.replace(/^[^:<"]*:\s*(?=.*@)/, "")) // "group: a@x.com" → "a@x.com"
    .map((p) => {
      const m = p.match(/^\s*"?([^"<]*?)"?\s*<([^<>]+)>\s*$/);
      return m ? { name: m[1].trim() || null, address: m[2] } : { name: null, address: p.trim() };
    })
    .filter((p) => p.address);
}

/**
 * Who this message is between, from the company's side.
 *
 * @param from, to, cc   parsed lists (parseAddressList)
 * @param self           the mailbox's own canonical address
 * @param own            every company-own canonical address (includes self)
 * @param sentFolder     true when the message was read from Sent — it is
 *                       outbound whoever the From says (an alias, a
 *                       "send as" address)
 * @returns { direction: "in"|"out", counterparts: [{ name, address, canonical }] }
 */
export function sidesOf({ from = [], to = [], cc = [], self, own = new Set(), sentFolder = false }) {
  const fromCanon = from.map((a) => canonicalAddress(a.address));
  const outbound = sentFolder || fromCanon.some((c) => c && (c === self || own.has(c)));
  const people = outbound ? [...to, ...cc] : [...from, ...to, ...cc];
  const seen = new Set();
  const counterparts = [];
  for (const p of people) {
    const canonical = canonicalAddress(p.address);
    if (!canonical || canonical === self || own.has(canonical) || seen.has(canonical)) continue;
    seen.add(canonical);
    counterparts.push({ ...p, canonical });
  }
  return { direction: outbound ? "out" : "in", counterparts };
}

/**
 * The one client (or lead) this message is filed to, or null.
 *
 * Order is the order of relevance: for an inbound message the SENDER first
 * (sidesOf lists From first), then the other recipients; for an outbound
 * one, To before Cc. The first counterpart the index names wins; an
 * ambiguous address is skipped, never guessed.
 */
export function matchCounterpart(counterparts, index) {
  for (const p of counterparts) {
    const hit = index.get(p.canonical);
    if (hit && (hit.kind === "client" || hit.kind === "lead")) return { ...hit, address: p.address, displayName: p.name };
  }
  return null;
}

/** "Name <addr>, addr2" for storage and display. */
export function formatAddressList(list) {
  return (Array.isArray(list) ? list : [])
    .map((a) => (a.name ? `${a.name.replace(/[<>"]/g, "")} <${a.address}>` : a.address))
    .join(", ")
    .slice(0, 4000);
}
