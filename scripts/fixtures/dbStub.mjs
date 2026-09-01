// scripts/fixtures/dbStub.mjs
//
// A scriptable stand-in for the Prisma client, used only by check scripts run
// through db-stub-loader.mjs.
//
// Two rules make it useful rather than merely quiet:
//
//   1. Every model/method the product reaches for has to be SCRIPTED. An
//      un-scripted one throws by name instead of returning undefined, so a
//      check can never pass because a query silently answered "nothing" —
//      which is the failure mode a stub is supposed to prevent, not cause.
//
//   2. Writes are RECORDED, not swallowed. `writes` is what the assertions read:
//      "a Quote row was created with estimateSource phone_call" is a claim about
//      an argument, and this is where that argument can be inspected.
//
// `rows` is the fixture data a check sets before exercising the path.

/** Fixture rows the product will read. A check assigns these before running. */
export const rows = {
  instantQuoteConfig: [],
  serviceCategory: [],
  client: [],
  quote: [],
  // The outbound-call queue and the consent ledger. Added so the quote-callback
  // checks can execute enqueueOutbound itself rather than assert about it — the
  // "one call per quote, ever" rule is a property of a de-dupe QUERY, and there
  // is no way to read that property off the source with any confidence.
  voiceCallTask: [],
  callConsent: [],
  company: [],
  // Read by lib/costing/quoteCosting.js's buildQuoteCostingRow (via
  // app/api/quotes/costingWrite.js), which createEstimateDraft now calls for
  // every auto-estimated draft — phone or instant-quote — so it can attach a
  // real QuoteCosting row. Empty by default: no rate-book overrides, no
  // recipe overrides, which is the same "use the code defaults" state a real
  // company with nothing saved under Settings would be in.
  companyServiceCategory: [],
  materialRecipeSetting: [],
  // Marketing campaign sends (app/api/marketing/campaigns/[id]/send) — added
  // so the resumable-send guard can be exercised as real code, not read off
  // the source: "a retry skips whoever already has a delivery row" is a
  // property of a query racing a unique constraint, the same class of claim
  // the voiceCallTask/callConsent rows above exist to make executable.
  marketingCampaign: [],
  marketingSubscriber: [],
  marketingCampaignDelivery: [],
};

/** Every write the product attempted, in order: { model, action, data }. */
export const writes = [];

// Every READ the product attempted, in order: { model, action, args }. Added
// for check-public-payload.mjs's portal assertion, which needs to inspect
// the `select` shape a route actually asked Prisma for — a behavioural check
// that a forbidden field is absent from the QUERY, not merely absent from
// the response the stub happens to hand back (the stub doesn't project by
// `select` the way real Prisma does, so a passing response proves nothing
// about the query on its own). Existing checks that only read `rows`/`writes`
// are unaffected: this is purely additive.
export const reads = [];

// Lets a check force the NEXT `create` on a given model to throw once — the
// scriptable stand-in for "the database connection died right here" (a Neon
// cold-start P1001 is the everyday version of this; see AGENTS.md). Reset
// between checks the same as `rows` and `writes`.
export const failNext = { model: null, times: 0 };

export function resetDbStub() {
  rows.instantQuoteConfig = [];
  rows.serviceCategory = [];
  rows.client = [];
  rows.quote = [];
  rows.voiceCallTask = [];
  rows.callConsent = [];
  rows.company = [];
  rows.companyServiceCategory = [];
  rows.materialRecipeSetting = [];
  rows.marketingCampaign = [];
  rows.marketingSubscriber = [];
  rows.marketingCampaignDelivery = [];
  writes.length = 0;
  reads.length = 0;
  failNext.model = null;
  failNext.times = 0;
}

// Prisma's `where` on a compound unique arrives as { companyId_trade: {...} };
// flatten it so a fixture row can be matched on plain fields.
function flattenWhere(where = {}) {
  const out = {};
  for (const [key, value] of Object.entries(where)) {
    if (value && typeof value === "object" && !Array.isArray(value) && key.includes("_")) {
      Object.assign(out, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function matches(row, where = {}) {
  return Object.entries(flattenWhere(where)).every(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // The only nested filter these paths use.
      if ("in" in value) return value.in.includes(row[key]);
      return true;
    }
    return row[key] === value;
  });
}

// `failNext` support: throws once, then clears itself, when the model being
// created matches. Applied at the very top of `create` — before the write is
// recorded or the unique check below runs — so it stands in for a DB call
// that failed before anything committed, which is the only honest way to
// model a dropped connection.
function maybeFailCreate(name) {
  if (failNext.model === name && failNext.times > 0) {
    failNext.times--;
    const err = new Error(`dbStub: forced failure for ${name}.create`);
    throw err;
  }
}

function model(name) {
  return {
    findUnique: async (args = {}) => {
      reads.push({ model: name, action: "findUnique", args });
      return rows[name].find((r) => matches(r, args.where)) || null;
    },
    findFirst: async (args = {}) => {
      reads.push({ model: name, action: "findFirst", args });
      return rows[name].find((r) => matches(r, args.where)) || null;
    },
    findMany: async (args = {}) => {
      reads.push({ model: name, action: "findMany", args });
      return rows[name].filter((r) => matches(r, args.where));
    },
    // Recording the read like its siblings rather than the shorter form the
    // campaign work added: check-public-payload inspects what a route ASKED
    // Prisma for, and a finder that answers without logging is invisible to it.
    count: async (args = {}) => {
      reads.push({ model: name, action: "count", args });
      return rows[name].filter((r) => matches(r, args.where)).length;
    },
    create: async ({ data } = {}) => {
      maybeFailCreate(name);
      writes.push({ model: name, action: "create", data });
      const row = { id: `${name}_${rows[name].length + 1}`, ...data };
      rows[name].push(row);
      return row;
    },
    update: async ({ where, data } = {}) => {
      writes.push({ model: name, action: "update", where, data });
      return { ...(rows[name].find((r) => matches(r, where)) || {}), ...data };
    },
    delete: async ({ where } = {}) => {
      const idx = rows[name].findIndex((r) => matches(r, where));
      const removed = idx === -1 ? null : rows[name].splice(idx, 1)[0];
      writes.push({ model: name, action: "delete", where });
      return removed;
    },
  };
}

// MarketingCampaignDelivery's whole reason to exist is the
// @@unique([campaignId, subscriberId]) in prisma/schema.prisma — the send
// route's claim-before-send guard depends on a duplicate `create` actually
// failing, the same way Postgres would refuse the second insert. The generic
// `model()` create() above has no notion of uniqueness, so this wraps it with
// exactly the one constraint that matters here rather than building a general
// unique-index simulator nothing else needs yet.
function uniqueCreateModel(name, uniqueFields) {
  const base = model(name);
  return {
    ...base,
    create: async ({ data } = {}) => {
      maybeFailCreate(name);
      const dup = rows[name].some((r) => uniqueFields.every((f) => r[f] === data[f]));
      if (dup) {
        const err = new Error(
          `dbStub: unique constraint on ${name}(${uniqueFields.join(", ")})`,
        );
        err.code = "P2002";
        throw err;
      }
      writes.push({ model: name, action: "create", data });
      const row = { id: `${name}_${rows[name].length + 1}`, ...data };
      rows[name].push(row);
      return row;
    },
  };
}

// A Proxy so an un-scripted model fails loudly at the point of use rather than
// resolving to undefined and letting a check pass on an empty answer.
export const db = new Proxy(
  {
    instantQuoteConfig: model("instantQuoteConfig"),
    serviceCategory: model("serviceCategory"),
    client: model("client"),
    quote: model("quote"),
    voiceCallTask: model("voiceCallTask"),
    callConsent: model("callConsent"),
    company: model("company"),
    companyServiceCategory: model("companyServiceCategory"),
    materialRecipeSetting: model("materialRecipeSetting"),
    marketingCampaign: model("marketingCampaign"),
    marketingSubscriber: model("marketingSubscriber"),
    marketingCampaignDelivery: uniqueCreateModel("marketingCampaignDelivery", [
      "campaignId",
      "subscriberId",
    ]),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(
        `dbStub: db.${String(prop)} was used but is not scripted — add it to scripts/fixtures/dbStub.mjs`,
      );
    },
  },
);
