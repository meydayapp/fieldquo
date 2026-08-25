// lib/quotes/emailSections.js
//
// The two OPTIONAL sections of the quote email — references and before/after
// photos — and the rule that stops an empty one being sent.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// A section that is switched on and has nothing in it must never reach a
// homeowner. There are two obvious ways to handle that and both are wrong:
//
//   * Drop it silently at render time. The sender ticked "include references",
//     saw the tick, and the client got an email with no references in it. That
//     is a control that appears to work and doesn't — the failure this
//     codebase is swept for.
//   * Refuse the send with an error. The person has a quote to get out and a
//     message telling them something is missing but not what to do about it.
//
// So: the send is BLOCKED, and the block names the section and carries the two
// things that unblock it — fill it, or remove it. Both actions exist as real
// endpoints; see `sectionActions()` below and the 409 body the send route
// returns.
//
// ── Where the rule is enforced ──────────────────────────────────────────────
//
// Twice, on purpose, the same way impersonation is:
//
//   1. `POST /api/quotes/[id]/send` calls `quoteEmailSectionGate()` before it
//      builds anything, and returns 409 with the blocked sections so the UI
//      can offer the two buttons.
//   2. `buildQuoteEmail()` calls `assertQuoteEmailSectionsReady()` and THROWS.
//      That second one is not belt-and-braces for the route above — it is for
//      the send path that doesn't exist yet. Any future route that composes a
//      quote email and forgets the gate fails loudly instead of quietly
//      posting an email with a heading over a blank space.
//
// The follow-up cron (app/api/cron/follow-ups/route.js) renders a company's
// own DocumentTemplate blocks and carries neither of these sections, so it has
// nothing to gate. scripts/check-quote-email-sections.mjs asserts that stays
// true — the moment someone wires these sections into the cron, that check
// fails and this comment stops being a promise nobody kept.
//
// ── Pure ────────────────────────────────────────────────────────────────────
//
// No Prisma, no fetch, no rendering. It takes a Company row and a Quote row
// and answers questions about them, which is what makes it executable against
// hostile input in the check script.

/** The stable identifiers. Used as object keys, API field names and i18n suffixes. */
export const QUOTE_EMAIL_SECTION_KEYS = ["references", "beforeAfter"];

/**
 * Everything each section needs, in one place, so the resolver, the API, the
 * settings page and the check script cannot disagree about it.
 *
 * `companyItemsField` / `companyIncludeField` are Company columns;
 * `quoteItemsField` / `quoteIncludeField` are Quote columns.
 */
export const QUOTE_EMAIL_SECTIONS = {
  references: {
    key: "references",
    companyItemsField: "quoteEmailReferences",
    companyIncludeField: "quoteEmailIncludeReferences",
    quoteItemsField: "emailReferences",
    quoteIncludeField: "emailIncludeReferences",
    // Keys the UI translates. The strings themselves live in
    // app/i18n/appMessages.js (staff-facing) and lib/i18n/documentLabels.js
    // (the heading the client reads).
    labelKey: "app.quoteEmail.references",
    emptyKey: "app.quoteEmail.referencesEmpty",
    fillHref: "/app/settings/quote-email#references",
    // How many the email will print. More than this is a wall of phone
    // numbers, and nobody rings the sixth one.
    max: 6,
  },
  beforeAfter: {
    key: "beforeAfter",
    companyItemsField: "quoteEmailBeforeAfter",
    companyIncludeField: "quoteEmailIncludeBeforeAfter",
    quoteItemsField: "emailBeforeAfter",
    quoteIncludeField: "emailIncludeBeforeAfter",
    labelKey: "app.quoteEmail.beforeAfter",
    emptyKey: "app.quoteEmail.beforeAfterEmpty",
    fillHref: "/app/settings/quote-email#before-after",
    // Four pairs is eight images. Gmail clips a message at 102KB of HTML and
    // a phone on a driveway loads eight remote images slowly enough already.
    max: 4,
  },
};

const str = (v) => (typeof v === "string" ? v.trim() : "");

// Only http(s). A Cloudinary URL is what these are, and letting `data:` or
// `javascript:` through would put whatever a company admin pasted into an
// <img src> on a stranger's screen.
const HTTP_URL = /^https?:\/\//i;

function id(seed, index) {
  const given = str(seed);
  return given || `s${index}`;
}

/**
 * A phone number as a `tel:` target.
 *
 * Kept separate from the display string. A referee's number is typed by a
 * human as "(819) 238-7263" and must PRINT that way — reformatting someone's
 * phone number into E.164 on a client-facing surface is the sort of tidying
 * that turns an extension into a wrong number. The dial string is derived,
 * the display string is not touched.
 *
 * Returns "" when there is nothing dialable left, and the renderer prints the
 * number as plain text rather than a dead link.
 */
export function telHref(phone) {
  const digits = str(phone).replace(/[^\d+]/g, "");
  // A leading + is meaningful; any other + is a typo. Strip all but the first.
  const cleaned = digits.startsWith("+")
    ? `+${digits.slice(1).replace(/\+/g, "")}`
    : digits.replace(/\+/g, "");
  const bare = cleaned.replace(/\D/g, "");
  if (bare.length < 7) return "";
  return `tel:${cleaned}`;
}

/**
 * One reference row, cleaned.
 *
 * A row with no name or no phone is dropped rather than repaired. "Call our
 * past client (no name given)" is worse than one fewer reference, and a name
 * with no number is not a reference at all — it is a stranger the homeowner
 * cannot reach.
 */
export function sanitiseReferences(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r, i) => {
      if (!r || typeof r !== "object") return null;
      const name = str(r.name);
      const phone = str(r.phone);
      if (!name || !phone) return null;
      if (!telHref(phone)) return null;
      const note = str(r.note);
      return { id: id(r.id, i), name, phone, ...(note ? { note } : {}) };
    })
    .filter(Boolean);
}

/**
 * One before/after pair, cleaned.
 *
 * BOTH images or neither. A pair with one photo is not a before-and-after, and
 * padding the missing half with the one that exists would show a homeowner the
 * same picture twice under two different labels.
 */
export function sanitiseBeforeAfter(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p, i) => {
      if (!p || typeof p !== "object") return null;
      const beforeUrl = str(p.beforeUrl);
      const afterUrl = str(p.afterUrl);
      if (!HTTP_URL.test(beforeUrl) || !HTTP_URL.test(afterUrl)) return null;
      const caption = str(p.caption);
      const beforePublicId = str(p.beforePublicId);
      const afterPublicId = str(p.afterPublicId);
      return {
        id: id(p.id, i),
        beforeUrl,
        afterUrl,
        ...(beforePublicId ? { beforePublicId } : {}),
        ...(afterPublicId ? { afterPublicId } : {}),
        ...(caption ? { caption } : {}),
      };
    })
    .filter(Boolean);
}

const SANITISERS = {
  references: sanitiseReferences,
  beforeAfter: sanitiseBeforeAfter,
};

export function sanitiseSectionItems(key, raw) {
  const fn = SANITISERS[key];
  return fn ? fn(raw) : [];
}

/**
 * What this quote's email will actually contain for both optional sections.
 *
 * @param company  a Company row (or the selected subset — see COMPANY_SELECT)
 * @param quote    a Quote row; may be omitted to resolve the company defaults
 *                 alone, which is what the settings preview does
 *
 * Returns, per key:
 *   included  did somebody switch this on
 *   items     the sanitised rows that would print
 *   source    "quote" when this quote overrode the list, else "company"
 *   inherited true when `included` came from the company default rather than
 *             from a decision made on this quote — the settings page and the
 *             quote panel both say which, because "on because you set it here"
 *             and "on because it's on for everything" are different facts.
 */
export function resolveQuoteEmailSections({ company = {}, quote = null } = {}) {
  const out = {};

  for (const key of QUOTE_EMAIL_SECTION_KEYS) {
    const meta = QUOTE_EMAIL_SECTIONS[key];

    const quoteInclude = quote ? quote[meta.quoteIncludeField] : null;
    const inherited = quoteInclude === null || quoteInclude === undefined;
    const included = inherited
      ? Boolean(company[meta.companyIncludeField])
      : Boolean(quoteInclude);

    const quoteItems = quote ? quote[meta.quoteItemsField] : null;
    // Array.isArray, not truthiness: `[]` on the quote is a real override and
    // means "this quote's own list, which is empty" — the state the gate
    // exists to catch. Falling back to the company list there would send the
    // company's references on a quote that deliberately replaced them.
    const overridden = Array.isArray(quoteItems);
    const items = sanitiseSectionItems(
      key,
      overridden ? quoteItems : company[meta.companyItemsField],
    ).slice(0, meta.max);

    out[key] = {
      key,
      included,
      inherited,
      source: overridden ? "quote" : "company",
      items,
    };
  }

  return out;
}

/**
 * What a renderer should actually print for one section.
 *
 * `resolved[key].items` deliberately answers a different question — "what
 * WOULD print if this were included" — because the settings panel and the
 * quote panel both need to show a list for a section that is currently off.
 * Handing that array straight to the email renderer prints a section somebody
 * switched OFF, which is what the first version of buildQuoteEmail did and
 * what the check script caught: a company default of "on", turned off on one
 * quote, still emailed its references.
 *
 * So the two questions get two functions rather than one array that means
 * whichever the reader assumed.
 */
export function renderableItems(resolved, key) {
  const section = resolved?.[key];
  if (!section?.included) return [];
  return section.items;
}

/** The Company columns resolveQuoteEmailSections needs. For Prisma selects. */
export const QUOTE_EMAIL_COMPANY_SELECT = {
  quoteEmailReferences: true,
  quoteEmailBeforeAfter: true,
  quoteEmailIncludeReferences: true,
  quoteEmailIncludeBeforeAfter: true,
};

/** The Quote columns it needs. */
export const QUOTE_EMAIL_QUOTE_SELECT = {
  emailReferences: true,
  emailBeforeAfter: true,
  emailIncludeReferences: true,
  emailIncludeBeforeAfter: true,
};

/**
 * The two ways out of a block, as data.
 *
 * The UI renders these as buttons. Returned from the server rather than
 * hardcoded in the page so a second surface that sends quotes (the builder's
 * "Save & Send", a future bulk send) gets the same offer without copying it.
 *
 * `remove` is a PATCH on the quote, not on the company: a company that keeps
 * meaning to collect references should not have the setting quietly switched
 * off for every future quote because one quote went out in a hurry.
 */
export function sectionActions(key, quoteId) {
  const meta = QUOTE_EMAIL_SECTIONS[key];
  return {
    fill: { kind: "link", href: meta.fillHref },
    remove: {
      kind: "patch",
      href: `/api/quotes/${quoteId}/email-sections`,
      body: { [meta.quoteIncludeField]: false },
    },
  };
}

/**
 * Which included sections have nothing to show.
 *
 * @returns [] when the quote is safe to send.
 */
export function emptyIncludedSections(resolved) {
  return QUOTE_EMAIL_SECTION_KEYS.filter(
    (key) => resolved[key]?.included && resolved[key].items.length === 0,
  );
}

/**
 * The gate, in the shape the send route returns.
 *
 * @returns { ok: true } | { ok: false, blocked: [{ key, labelKey, emptyKey, actions }] }
 */
export function quoteEmailSectionGate({ company = {}, quote = null } = {}) {
  const resolved = resolveQuoteEmailSections({ company, quote });
  const empty = emptyIncludedSections(resolved);
  if (!empty.length) return { ok: true, resolved };

  return {
    ok: false,
    resolved,
    blocked: empty.map((key) => {
      const meta = QUOTE_EMAIL_SECTIONS[key];
      return {
        key,
        labelKey: meta.labelKey,
        emptyKey: meta.emptyKey,
        actions: sectionActions(key, quote?.id || ""),
      };
    }),
  };
}

/**
 * Thrown by buildQuoteEmail when it is handed an included-but-empty section.
 *
 * A named class, not a bare Error, so a caller can tell "this quote isn't
 * ready" apart from "the renderer broke" and answer 409 rather than 500.
 */
export class QuoteEmailSectionsIncomplete extends Error {
  constructor(keys) {
    super(
      `Quote email has ${keys.length} section(s) switched on with nothing in them: ${keys.join(", ")}. Fill them or remove them before sending.`,
    );
    this.name = "QuoteEmailSectionsIncomplete";
    this.code = "email_sections_empty";
    this.sections = keys;
  }
}

/** Throws QuoteEmailSectionsIncomplete, or returns the resolved sections. */
export function assertQuoteEmailSectionsReady(resolved) {
  const empty = emptyIncludedSections(resolved);
  if (empty.length) throw new QuoteEmailSectionsIncomplete(empty);
  return resolved;
}

/**
 * That the rows we were handed can answer the question at all.
 *
 * The subtle version of the silent drop: a send path selects a narrow set of
 * Company columns, `company.quoteEmailIncludeReferences` comes back
 * `undefined`, `Boolean(undefined)` is false, and the section is quietly off
 * for every quote that route sends. Nothing fails, nothing logs, and a company
 * that switched references on gets emails without them.
 *
 * Prisma returns only the fields a `select` names, so a missing KEY (not a
 * null value) is exactly the signal that the select is wrong. Throwing here
 * turns a silent misconfiguration into a 500 in development and a logged
 * failure in production, which is the trade this codebase already makes for
 * sentAt.
 *
 * Use QUOTE_EMAIL_COMPANY_SELECT / QUOTE_EMAIL_QUOTE_SELECT to satisfy it.
 */
export function assertSectionFieldsLoaded(company = {}, quote = null) {
  const missing = [];
  for (const key of QUOTE_EMAIL_SECTION_KEYS) {
    const meta = QUOTE_EMAIL_SECTIONS[key];
    if (!(meta.companyIncludeField in company))
      missing.push(`company.${meta.companyIncludeField}`);
    if (!(meta.companyItemsField in company))
      missing.push(`company.${meta.companyItemsField}`);
    if (quote) {
      if (!(meta.quoteIncludeField in quote))
        missing.push(`quote.${meta.quoteIncludeField}`);
      if (!(meta.quoteItemsField in quote))
        missing.push(`quote.${meta.quoteItemsField}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `Quote email sections can't be resolved — these fields weren't loaded: ${missing.join(", ")}. Spread QUOTE_EMAIL_COMPANY_SELECT / QUOTE_EMAIL_QUOTE_SELECT into the Prisma select.`,
    );
  }
}
