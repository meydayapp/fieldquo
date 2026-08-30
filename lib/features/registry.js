// lib/features/registry.js
//
// What FieldQuo OFFERS a company — a closed list, not a key/value store.
//
// ══ Why closed ═════════════════════════════════════════════════════════════
//
// AGENTS.md names "feature flags for features that don't exist" as a recurring
// failure class. A registry anyone can type a new key into is that failure with
// a UI on top: the key gets written, nothing reads it, and six months later
// somebody flips it and nothing happens.
//
// So the list lives here, in code, and it is the only list. The platform
// console renders THESE entries and cannot invent one. Every write validates
// against `assertKnownFeature`. And `npm run check:features` fails the build if
// a key here has no consumer — no gate mount, no guard call — so an entry that
// gates nothing cannot survive a single run of the checks.
//
// Adding a feature is therefore two deliberate steps, in this order:
//   1. build the thing, and mount the gate on it;
//   2. add its entry here.
// Doing it the other way round fails check:features, which is the point.
//
// ══ AVAILABILITY, not ADOPTION ═════════════════════════════════════════════
//
// Company already carries per-company booleans: aiCopilotEnabled,
// outboundCallsEnabled, crewInboxEnabled, reviewRequestsEnabled, offerFinancing,
// travelCheckEnabled, discoverable, sitePublished. Those are ADOPTION — the
// contractor found the switch and turned it on. This file is AVAILABILITY —
// whether FieldQuo offers it to them at all.
//
// The two are deliberately NOT merged. A company cannot adopt what FieldQuo has
// not made available, so the axes look redundant until a support ticket arrives:
// "where is the receptionist?" has two completely different answers — "we
// haven't switched it on for you yet" and "you haven't switched it on" — and
// collapsing them into one column destroys the ability to tell which. Each
// entry names its adoption field so the console can show both side by side.
//
// ══ Four states, because "off" means four different things ═════════════════
//
//   on       normal.
//   preview  usable, and labelled as such. For a company that opted into a beta.
//   locked   visible, refused, with a reason the contractor can read.
//   hidden   no trace. Not in the nav, not reachable by URL, not admitted to by
//            any error body. For a feature that is not ready.
//
// `hidden` is the strict one: a 403 that says "voice_receptionist is disabled"
// would announce the existence of the thing we are hiding, so the guard returns
// an ordinary 404 with no feature name in it. See lib/features/gate.js.
//
// ══ Turning a feature off never deletes anything ═══════════════════════════
//
// Same rule as unpublishing a website: the content survives, it just stops being
// reachable. Funnels, campaigns, call records, site blocks and instant-quote
// rate cards are untouched by any state here, and come back exactly as they were
// when the feature comes back. Nothing in lib/features/ writes to a tenant table.

/**
 * The four states, ordered most-open to most-closed.
 *
 * Order is load-bearing: `mostClosed()` uses it to pick a verdict when two
 * sources disagree, and the check script asserts an unknown value resolves to
 * the last element rather than the first.
 */
export const FEATURE_STATES = ["on", "preview", "locked", "hidden"];

/** The state a malformed or unknown value collapses to. Fail closed, always. */
export const CLOSED_STATE = "hidden";

/**
 * Every feature FieldQuo can withhold, and exactly what withholding it means.
 *
 * Fields:
 *   key            stable id. Snake_case, never renamed — it is a database value.
 *   label / blurb  English, for the platform console only. NOT contractor-facing
 *                  (the /app strings live in app/i18n/appMessages.js and are
 *                  translated); FieldQuo's own staff read this console.
 *   defaultState   what applies when FieldQuo has said nothing. See below.
 *   adoptionField  the Company column the CONTRACTOR controls, or null. Named
 *                  here so the console can show availability and adoption
 *                  together instead of implying one is the other.
 *   navKeys        i18n keys of the nav rows that vanish when hidden.
 *   routePrefixes  /app page prefixes. Each must mount the gate — check:features
 *                  fails if one doesn't.
 *   apiPrefixes    /api prefixes. Gated centrally in lib/currentMember.js, so
 *                  every route under them is covered including ones written
 *                  before this existed.
 *   apiExempt      paths under apiPrefixes that deliberately do NOT go through
 *                  getCurrentMember, each with the reason and the guard that
 *                  covers them instead. check:features requires every such route
 *                  to be listed — an unlisted one fails.
 *   cronPaths      scheduled work this feature owns. These have no member and no
 *                  session, so they call featureAllowsSpend() per company.
 *   spends         true when the feature costs FieldQuo money at a vendor. Those
 *                  get the extra money rules in gate.js.
 *
 * ── Why every defaultState is "on" ─────────────────────────────────────────
 *
 * These features all ship today. A registry that arrived defaulting them to
 * hidden would take working screens away from the owner the moment it deployed
 * — a silent, product-wide regression dressed as infrastructure. "FieldQuo has
 * said nothing" must mean "carry on exactly as before"; withholding is a
 * decision somebody makes in the console, and the console records who and when.
 *
 * A feature built in FUTURE should be added here with defaultState "hidden",
 * because for an unfinished thing "nobody has said anything" genuinely does mean
 * "not ready".
 */
const ENTRIES = [
  {
    key: "voice_receptionist",
    label: "AI phone receptionist",
    blurb:
      "Retell-backed inbound answering, outbound confirmation calls, number " +
      "provisioning and the call review queue. FieldQuo holds the vendor " +
      "account, so this one costs money per company.",
    defaultState: "on",
    // outboundCallsEnabled is the contractor's own switch for the OUTBOUND half
    // only; inbound answering has no single boolean (it follows whether a number
    // is provisioned). Named anyway, because it is the closest thing to an
    // adoption signal and the console should not pretend there is a cleaner one.
    adoptionField: "outboundCallsEnabled",
    navKeys: ["app.nav.receptionist", "app.settings.voice"],
    routePrefixes: ["/app/receptionist", "/app/settings/voice"],
    apiPrefixes: ["/api/settings/voice", "/api/voice"],
    apiExempt: [
      {
        path: "/api/voice/webhook",
        guard: "none — deliberately ungated",
        reason:
          "Retell reporting a call that ALREADY happened. The minutes are " +
          "spent whether or not we accept the callback; refusing it would " +
          "lose the record and the billing entry without saving a cent. " +
          "Signature-verified, bills once per call.",
      },
      {
        path: "/api/voice/tools/[tool]",
        guard: "none — deliberately ungated",
        reason:
          "The agent mid-call, asking to check availability or save a caller. " +
          "The call is already connected and already being paid for; cutting " +
          "the tools off would leave a homeowner talking to an assistant that " +
          "has stopped being able to do anything.",
      },
    ],
    cronPaths: ["/api/cron/voice-rent", "/api/cron/voice-outbound"],
    spends: true,
  },
  {
    key: "crew_inbox",
    label: "Crew inbox",
    blurb:
      "Crew text photos and updates to a number; the assistant files them to " +
      "the right job. Unfiled messages land in a queue a person clears.",
    defaultState: "on",
    adoptionField: "crewInboxEnabled",
    navKeys: ["app.nav.crewInbox"],
    routePrefixes: ["/app/crew-inbox"],
    apiPrefixes: ["/api/crew"],
    apiExempt: [
      {
        path: "/api/crew/inbound",
        guard: "Company.crewInboxEnabled, checked in the route before filing",
        reason:
          "Twilio delivering an inbound SMS. No session exists and the message " +
          "has already been sent — dropping it at the door would lose a crew " +
          "member's job photo permanently. It is filed or held either way; the " +
          "back-office queue is what the gate hides.",
      },
    ],
    cronPaths: [],
    spends: false,
  },
  {
    key: "ai_copilot",
    label: "FieldQuo AI copilot",
    blurb:
      "The chat assistant over the company's own data. Metered against the " +
      "plan's token cap in lib/ai/usage.js.",
    defaultState: "on",
    adoptionField: "aiCopilotEnabled",
    navKeys: ["app.nav.ai"],
    routePrefixes: ["/app/copilot"],
    // Only /api/ai/copilot. /api/ai/quote-suggestions and /api/ai/ai-summary are
    // different features living under the same prefix — gating "/api/ai" would
    // silently take out AI quote review and the dashboard summary as well, which
    // is exactly the sloppy blast radius a prefix list makes easy to get wrong.
    apiPrefixes: ["/api/ai/copilot"],
    apiExempt: [],
    cronPaths: [],
    spends: false,
  },
  {
    key: "funnels",
    label: "Lead funnels",
    blurb:
      "Multi-step public lead funnels with per-step analytics, generated from " +
      "a channel template or by AI.",
    defaultState: "on",
    adoptionField: null,
    navKeys: ["app.nav.funnels"],
    routePrefixes: ["/app/funnels"],
    apiPrefixes: ["/api/funnels"],
    apiExempt: [
      {
        path: "/api/funnels/public/[companySlug]/[funnelSlug]",
        guard: "FunnelStatus — a funnel serves only while it is published",
        reason:
          "A stranger who clicked the contractor's ad. Availability is a " +
          "FieldQuo-to-contractor decision; a homeowner halfway through a form " +
          "is not part of that conversation and must not be dropped by it.",
      },
      {
        path: "/api/funnels/public/[companySlug]/[funnelSlug]/submit",
        guard: "FunnelStatus",
        reason: "Same: the homeowner's answers, already typed.",
      },
      {
        path: "/api/funnels/public/[companySlug]/[funnelSlug]/event",
        guard: "FunnelStatus",
        reason: "Same: step-view telemetry for a form already on screen.",
      },
      {
        path: "/api/funnels/public/[companySlug]/[funnelSlug]/estimate",
        guard: "FunnelStatus, plus the instant-quote readiness check",
        reason:
          "The instant-estimate step, priced for a stranger mid-funnel. Same " +
          "reasoning as the three above, and one more: it returns a BAND, " +
          "never a rate card, so refusing it protects nothing a published " +
          "funnel was not already handing out.",
      },
    ],
    cronPaths: [],
    spends: false,
  },
  {
    key: "website_builder",
    label: "Website builder",
    blurb:
      "The block-based tenant site, its AI copy generation, photo library and " +
      "per-language variants. Serves at <slug>.fieldquo.com.",
    defaultState: "on",
    adoptionField: "sitePublished",
    navKeys: ["app.settings.website"],
    routePrefixes: ["/app/settings/website"],
    apiPrefixes: ["/api/settings/website"],
    apiExempt: [],
    cronPaths: [],
    spends: false,
  },
  {
    key: "instant_quotes",
    label: "Instant quotes",
    blurb:
      "The per-trade rate card behind the self-serve instant estimate, plus " +
      "the measure and request steps on the public page.",
    defaultState: "on",
    adoptionField: null,
    navKeys: ["app.settings.instantQuotes"],
    routePrefixes: ["/app/settings/instant-quotes"],
    // The CONFIGURATION route only. /api/instant-quote/[companySlug] and
    // /api/self-quote/* are the public surfaces; see the note above apiExempt in
    // `funnels` for why those are not withdrawn under a homeowner mid-estimate.
    apiPrefixes: ["/api/settings/instant-quote"],
    apiExempt: [],
    cronPaths: [],
    spends: false,
  },
  {
    key: "marketing_campaigns",
    label: "Marketing campaigns",
    blurb:
      "Email and door-hanger campaigns, the subscriber list, and pamphlet " +
      "route stops.",
    defaultState: "on",
    adoptionField: null,
    navKeys: ["app.nav.marketing"],
    routePrefixes: ["/app/marketing"],
    // Not "/api/marketing": /api/marketing/contact and /api/marketing/plans are
    // the PUBLIC marketing-site contact form and plan list. They have no member,
    // belong to fieldquo.com rather than to a tenant, and gating them on a
    // tenant's feature state is nonsense.
    apiPrefixes: [
      "/api/marketing/campaigns",
      "/api/marketing/subscribers",
      "/api/marketing/stops",
    ],
    apiExempt: [],
    cronPaths: [],
    spends: false,
  },
  {
    key: "ai_vision",
    label: "AI deep photo read",
    blurb:
      "A paid, closer read over a quote's photos at higher detail than the " +
      "free review that runs on every quote — VISION_PASS_CENTS off the " +
      "company's AI credit wallet, not the plan's included allowance.",
    defaultState: "on",
    adoptionField: null,
    navKeys: [],
    // No dedicated page — the deep read is a button inside the quote builder's
    // existing add-ons panel (app/components/quotes/SuggestAddOns.js), which
    // already lives under a route no feature claims. Nothing to gate there.
    routePrefixes: [],
    apiPrefixes: ["/api/quotes/[id]/vision"],
    apiExempt: [],
    cronPaths: [],
    spends: true,
  },
  {
    key: "marketing_designer",
    label: "Marketing Designer",
    blurb:
      "The multi-ratio ad canvas editor (app/components/designer/) — " +
      "templates, uploads, stock photos, shapes, text and exports are free; " +
      "AI background removal and AI image generation are the one premium " +
      "piece, per the owner's 2026-08-30 correction. Now reachable: " +
      "/app/marketing/designer mounts the editor and the campaign/design " +
      "CRUD routes below it, per the owner's follow-up correction that a " +
      "ported editor nothing can open is not a shipped feature.",
    // ON: the editor is mounted (DesignerLoader, ssr:false) at
    // /app/marketing/designer, the save/load CRUD routes are real, and
    // aiImageAdapter.js's vendor seam is closed (AI_IMAGE_VENDOR_READY =
    // true). Nothing left standing behind this flag is scaffolding.
    defaultState: "on",
    // No per-company adoption boolean: unlike the receptionist (a number
    // someone provisions) or the site builder (a page someone publishes),
    // there is nothing to switch ON beyond FieldQuo offering it — a
    // company either can afford the next generation or it can't, and that
    // is the spend gate's question, not this one's.
    adoptionField: null,
    navKeys: ["app.nav.marketingDesigner"],
    // The campaign/editor pages only — NOT "/app/marketing" wholesale, which
    // marketing_campaigns already owns. featureForRoutePath's longest-prefix
    // rule means this carves out exactly this sub-tree without touching the
    // pamphlet/email pages one level up.
    routePrefixes: ["/app/marketing/designer"],
    // The two AI-costing routes, plus the design CRUD (create/list/load/
    // save/delete) added for the owner's follow-up correction — NOT
    // "/api/designer" or "/api/marketing/designer" wholesale. The template
    // gallery, uploads and stock photos must stay reachable exactly as they
    // are when this feature is hidden or locked, because none of them is
    // the thing being withheld. Scoping narrowly here is the same call
    // marketing_campaigns makes above for its own public routes.
    //
    // Two worktrees built the AI half of this feature from opposite ends —
    // the editor's own sidebars call /api/designer/*, and the standalone
    // generation endpoint is /api/marketing/designer/images. Both exist, so
    // both are gated; listing only one set would leave a billable route
    // ungated, which is worse than either half alone.
    apiPrefixes: [
      "/api/designer/remove-bg",
      "/api/designer/generate",
      "/api/marketing/designer/images",
      "/api/marketing/designer/designs",
    ],
    apiExempt: [],
    cronPaths: [],
    spends: true,
  },
  {
    key: "kpi_dashboard",
    label: "KPI dashboard",
    blurb:
      "Sales, profit, execution and cash on one screen, rolled up from the " +
      "quote, job and invoice tables the rest of the product already writes.",
    defaultState: "on",
    adoptionField: null,
    navKeys: ["app.nav.kpis"],
    routePrefixes: ["/app/analytics/kpis"],
    apiPrefixes: ["/api/analytics/kpis"],
    apiExempt: [],
    cronPaths: [],
    spends: false,
  },
];

/** Frozen: nothing at runtime may add an entry, which is the whole point. */
export const FEATURES = Object.freeze(
  ENTRIES.map((e) =>
    Object.freeze({
      ...e,
      navKeys: Object.freeze([...e.navKeys]),
      routePrefixes: Object.freeze([...e.routePrefixes]),
      apiPrefixes: Object.freeze([...e.apiPrefixes]),
      apiExempt: Object.freeze(e.apiExempt.map((x) => Object.freeze({ ...x }))),
      cronPaths: Object.freeze([...e.cronPaths]),
    }),
  ),
);

export const FEATURE_KEYS = Object.freeze(FEATURES.map((f) => f.key));

const BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

/** The entry, or undefined. Never throws — callers that must throw use assert. */
export function featureEntry(key) {
  return BY_KEY.get(key);
}

export function isKnownFeature(key) {
  return BY_KEY.has(key);
}

/**
 * Reject an unknown key at the point of WRITE.
 *
 * The database column is a plain string, so this is what actually keeps the
 * registry closed. Without it the console could persist "voce_recptionist" and
 * the resolver would quietly ignore it forever — a flag that appears to work
 * and doesn't.
 */
export function assertKnownFeature(key) {
  if (!isKnownFeature(key)) {
    const err = new Error(
      `"${key}" is not a FieldQuo feature. Features are a closed list in ` +
        `lib/features/registry.js: ${FEATURE_KEYS.join(", ")}.`,
    );
    err.status = 400;
    throw err;
  }
  return key;
}

/**
 * A stored state string, validated.
 *
 * Returns null for anything that is not one of the four — including null,
 * undefined, a number, a boolean and a typo. Callers decide what null means:
 * "no row" (inherit) and "a row saying nonsense" (fail closed) are different
 * situations and this function refuses to conflate them, which is why it takes
 * a value rather than a row.
 */
export function normaliseState(value) {
  return typeof value === "string" && FEATURE_STATES.includes(value)
    ? value
    : null;
}

/** The more closed of two states. Used when sources disagree. */
export function mostClosed(a, b) {
  const ia = FEATURE_STATES.indexOf(a);
  const ib = FEATURE_STATES.indexOf(b);
  if (ia < 0) return normaliseState(b) ? b : CLOSED_STATE;
  if (ib < 0) return a;
  return ia >= ib ? a : b;
}

/**
 * The resolution rule, in one pure function.
 *
 *   company override  ??  platform global  ??  the registry's own default
 *
 * ── Why rows, not strings ──────────────────────────────────────────────────
 *
 * `??` on a state string cannot tell "no override row" from "an override row
 * that says something invalid", and those must behave in opposite directions:
 * absence INHERITS, nonsense FAILS CLOSED. Taking the rows themselves is what
 * makes that distinction expressible. It is also the reason this is not written
 * as `override?.state || global?.state || def` — `||` swallows an explicit
 * refusal, which here would mean a company FieldQuo deliberately shut out
 * silently inheriting "on" from the global default.
 *
 * @param key           a registry key. Unknown keys resolve hidden, not open.
 * @param overrideRow   { state, note } | null | undefined   per-company
 * @param globalRow     { state, note } | null | undefined   platform-wide
 * @returns { key, state, source, note, known }
 *          source: "override" | "global" | "default" | "unknown"
 */
export function resolveFeature({ key, overrideRow, globalRow } = {}) {
  const entry = BY_KEY.get(key);
  if (!entry) {
    // An unknown key is not a feature, so there is nothing to permit. Hidden
    // rather than locked: a "locked" verdict for a key nobody recognises would
    // put the string on screen, and the string might be a typo of something we
    // are hiding on purpose.
    return {
      key,
      state: CLOSED_STATE,
      source: "unknown",
      note: null,
      known: false,
    };
  }

  if (overrideRow !== null && overrideRow !== undefined) {
    const state = normaliseState(overrideRow.state);
    return {
      key,
      // A row exists and says something we do not understand. It was written by
      // somebody, so it is not absence — and we cannot know what they meant, so
      // the safe reading is the closed one.
      state: state ?? CLOSED_STATE,
      source: "override",
      note: typeof overrideRow.note === "string" ? overrideRow.note : null,
      known: true,
      malformed: state === null,
    };
  }

  if (globalRow !== null && globalRow !== undefined) {
    const state = normaliseState(globalRow.state);
    return {
      key,
      state: state ?? CLOSED_STATE,
      source: "global",
      note: typeof globalRow.note === "string" ? globalRow.note : null,
      known: true,
      malformed: state === null,
    };
  }

  return {
    key,
    state: entry.defaultState,
    source: "default",
    note: null,
    known: true,
  };
}

/** May the company USE it? */
export function isAvailable(state) {
  return state === "on" || state === "preview";
}

/** May the company SEE that it exists? */
export function isVisible(state) {
  return state !== "hidden";
}

// ── Path matching ──────────────────────────────────────────────────────────
//
// A prefix matches a path only at a segment boundary. Plain startsWith would
// make "/api/voice" match "/api/voicemail-export" — a route that does not exist
// today, and precisely the kind that gets added later by someone who has never
// read this file.

function prefixMatches(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Which feature owns this API path, if any.
 *
 * Longest prefix wins, so a future "/api/settings/voice/x" belonging to a
 * different feature could be carved out without the shorter prefix eating it.
 */
export function featureForApiPath(pathname) {
  if (typeof pathname !== "string" || !pathname) return null;
  let best = null;
  let bestLen = -1;
  for (const f of FEATURES) {
    for (const p of f.apiPrefixes) {
      if (prefixMatches(pathname, p) && p.length > bestLen) {
        best = f.key;
        bestLen = p.length;
      }
    }
  }
  return best;
}

/** Which feature owns this /app page path, if any. Longest prefix wins. */
export function featureForRoutePath(pathname) {
  if (typeof pathname !== "string" || !pathname) return null;
  let best = null;
  let bestLen = -1;
  for (const f of FEATURES) {
    for (const p of f.routePrefixes) {
      if (prefixMatches(pathname, p) && p.length > bestLen) {
        best = f.key;
        bestLen = p.length;
      }
    }
  }
  return best;
}

/** Which feature a nav key belongs to, if any. Used by both sidebars. */
export function featureForNavKey(navKey) {
  for (const f of FEATURES) if (f.navKeys.includes(navKey)) return f.key;
  return null;
}
