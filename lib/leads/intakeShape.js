// lib/leads/intakeShape.js
//
// ONE shape for LeadRequest.intake.
//
// `intake` is a Json column, which means it has no schema and every caller was
// free to invent one — and nine of them did. The self-quote form spread the
// homeowner's answers and then laid `address`/`city`/`province`/`country` over
// the top; the kitchen designer wrote `{ address }` and nothing else; the
// instant quote wrote no intake at all and put the address in the `message`
// prose instead. Only ONE of those is readable by convertLead, which seeds a
// converted client's address, city and province straight off this blob. So the
// instant quote — the intake that arrives with a measured roof, a budget and
// photos — converted into a client with no address and therefore no tax
// jurisdiction, which is the exact defect the self-quote path was fixed for
// once already (see findOrCreateClient's comment in lib/leads/convertLead.js).
//
// A fourth address layout was one new intake route away. So the shape lives
// here, every caller builds it through buildLeadIntake(), every reader reads it
// through leadAddressFromIntake(), and check-lead-intake.mjs fails the build if
// a caller that HAS an address hand-rolls one instead.
//
// Pure on purpose: no db, no Next, no i18n. It is executed in the check rather
// than read, and the same functions run in the browser (the leads screen) and
// on the server (conversion).

/**
 * The reserved keys. Everything else in `intake` is the channel's own
 * questions, keyed however that channel keys them — a funnel uses the question
 * text, the instant quote uses the estimator's field keys.
 *
 * Kept in this order: it is the order a human reads an address in, and
 * leadAddressLine() relies on it.
 */
export const LEAD_ADDRESS_KEYS = ["address", "city", "province", "country"];

/**
 * Absent is absent.
 *
 * `""`, `null`, `undefined` and `[]` are all "we have nothing", and writing any
 * of them into intake invites a later reader to treat the key's presence as an
 * answer — AGENTS.md's "absence of a statement is not a statement". `false` is
 * NOT empty here: an unticked "needs taking apart" is a real no from someone
 * who saw the question. It is the DISPLAY layer that decides whether a no is
 * worth a row (see leadIntakeDetails), not the storage layer.
 */
function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

const trimmed = (v) => (typeof v === "string" ? v.trim() : v);

/**
 * Build the intake blob every caller of createScoredLead should pass.
 *
 * @param {object} p
 * @param {string} [p.address]   the address as the homeowner gave it — usually
 *                               Google's formatted string, sometimes typed by
 *                               hand. Stored as given; never parsed.
 * @param {string} [p.city]      only when something structured actually
 * @param {string} [p.province]  returned them (a Places pick). A homeowner who
 * @param {string} [p.country]   typed their address has no province, and
 *                               storing `province: null` beside a real address
 *                               is how an absence gets read as an answer.
 * @param {object} [p.details]   the channel's own structured answers.
 * @returns {object|null} the blob, or null when there is nothing to store —
 *                        createScoredLead only writes the column when it is an
 *                        object, so null leaves it untouched rather than
 *                        stamping `{}` onto the row.
 */
export function buildLeadIntake({ address, city, province, country, details } = {}) {
  const out = {};

  if (details && typeof details === "object" && !Array.isArray(details)) {
    for (const [k, v] of Object.entries(details)) {
      if (isEmpty(v)) continue;
      out[k] = trimmed(v);
    }
  }

  // The jurisdiction goes on LAST and wins. A funnel whose question happens to
  // be worded "address" keeps its answer when no real address was passed, and
  // loses it to the real one when there is one — the same precedence the
  // self-quote route had inline, kept because it is the right one.
  const jurisdiction = { address, city, province, country };
  for (const key of LEAD_ADDRESS_KEYS) {
    const v = jurisdiction[key];
    if (isEmpty(v)) continue;
    out[key] = trimmed(v);
  }

  return Object.keys(out).length ? out : null;
}

/**
 * The reader half. Returns the four reserved keys, nulled where absent, in the
 * shape a Client row wants.
 *
 * Nulls rather than omissions, because the caller writes these straight into
 * `db.client.create` and an omitted key there means "leave the column alone",
 * which is a different thing from "we do not know".
 */
export function leadAddressFromIntake(intake) {
  const src = intake && typeof intake === "object" ? intake : {};
  const pick = (k) => {
    const v = src[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    address: pick("address"),
    city: pick("city"),
    province: pick("province"),
    country: pick("country"),
  };
}

/**
 * One line for a lead card: "917 Littlerock St, Ottawa, ON K1A 0B1, Canada".
 *
 * The city and province are appended only when the address string does not
 * already contain them. Google's formatted_address — which is what `address`
 * usually IS — already carries both, and blindly joining produced
 * "…, Ottawa, ON, Canada, Ottawa, ON" on every lead that came from a Places
 * pick. Matched case-insensitively as a whole word so "ON" does not match
 * inside "Ontario Street".
 */
export function leadAddressLine(intake) {
  const { address, city, province } = leadAddressFromIntake(intake);
  if (!address) return [city, province].filter(Boolean).join(", ") || null;
  const haystack = address.toLowerCase();
  const missing = [city, province].filter((part) => {
    if (!part) return false;
    const needle = part.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`, "i").test(haystack);
  });
  return [address, ...missing].join(", ");
}

/**
 * The channel's own answers, for the "What they told us" panel — everything
 * that is NOT the address, since the address has its own line above it.
 *
 * Empties are dropped for the same reason they are never stored: a row reading
 * "Surface condition —" is an invented statement. `false` is dropped HERE and
 * not in storage: an unticked optional box on a form ("long carry to the
 * truck") is the default, and listing four "no"s buries the two facts that
 * matter. A false that mattered would be a question with an explicit No.
 *
 * @returns {Array<[string, unknown]>} entries in the order they were stored.
 */
export function leadIntakeDetails(intake) {
  if (!intake || typeof intake !== "object") return [];
  return Object.entries(intake).filter(
    ([k, v]) => !LEAD_ADDRESS_KEYS.includes(k) && !isEmpty(v) && v !== false,
  );
}

/**
 * Render one intake value as text.
 *
 * Exists because the values are whatever a channel put there: a number, a
 * boolean, a list of chosen options, or the junk-removal item picker's
 * `[{ key, quantity }]`. The leads screen used `String(v)` and printed
 * "[object Object]" at the homeowner the moment any of them arrived.
 */
export function formatIntakeValue(v) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(formatIntakeValue).filter(Boolean).join(", ");
  if (typeof v === "object") {
    // The one nested shape the product actually produces. Anything else is
    // rendered as its own key/value pairs rather than as JSON braces.
    if (v.key != null && v.quantity != null) return `${v.quantity} × ${humaniseKey(String(v.key))}`;
    return Object.entries(v)
      .filter(([, x]) => x !== null && x !== undefined && x !== "")
      .map(([k, x]) => `${humaniseKey(k)}: ${formatIntakeValue(x)}`)
      .join(", ");
  }
  return String(v);
}

/**
 * "doorCount" / "door_count" -> "door count". Shared so the label a key gets on
 * the leads screen is the same one it gets inside a nested value.
 */
export function humaniseKey(key) {
  return String(key)
    // Lower-cased on the way through, because the label is rendered under a
    // `capitalize` class: leaving "doorCount" as "door Count" gave "Door Count"
    // in one column and "Job type" in the next, from the same list.
    .replace(/([a-z0-9])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`)
    .replace(/[_-]+/g, " ")
    .trim();
}
