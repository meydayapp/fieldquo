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
};

/** Every write the product attempted, in order: { model, action, data }. */
export const writes = [];

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
  writes.length = 0;
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

function model(name) {
  return {
    findUnique: async ({ where } = {}) => rows[name].find((r) => matches(r, where)) || null,
    findFirst: async ({ where } = {}) => rows[name].find((r) => matches(r, where)) || null,
    findMany: async ({ where } = {}) => rows[name].filter((r) => matches(r, where)),
    create: async ({ data } = {}) => {
      writes.push({ model: name, action: "create", data });
      const row = { id: `${name}_${rows[name].length + 1}`, ...data };
      rows[name].push(row);
      return row;
    },
    update: async ({ where, data } = {}) => {
      writes.push({ model: name, action: "update", where, data });
      return { ...(rows[name].find((r) => matches(r, where)) || {}), ...data };
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
