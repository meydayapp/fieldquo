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
  // The three rosters/plans getOnboardingStatus() counts. Added so
  // check-onboarding-solo.mjs can execute the real function instead of reading
  // it: "a one-person company can finish onboarding" is a claim about a step
  // ARRAY that gets built from five queries, and every previous attempt to
  // assert that by regex would have passed on the version that couldn't.
  member: [],
  pendingTeamProfile: [],
  // "Was this helpful?" votes from the public help centre
  // (app/api/help/feedback). check-help-centre.mjs executes the route and
  // reads the write back to prove the row carries slug/lang/helpful and
  // nothing about the sender.
  helpFeedback: [],
  // No `include` support here, so a fixture row carries its plan inline:
  // { companyId, plan: { maxUsers: 20 } }.
  subscription: [],
  // Plan rows, for check-plan-change.mjs: the webhook refuses to move a
  // subscription onto a plan that no longer exists (a foreign key would throw
  // and Stripe would retry for ever), and that refusal is a query.
  plan: [],
  // Page messaging (check-messaging.mjs). The claims that need executing here
  // are "a re-delivered webhook does not post the message twice" and "the
  // company comes from the CHANNEL row, never from the payload" — both are
  // properties of an upsert keyed on a compound unique, which no amount of
  // reading lib/messaging/ingest.js can establish.
  messagingChannel: [],
  // Lead-ad forms and the ad-account connection, read by
  // lib/meta/leadsWebhookIngest.js — check-meta-leads-webhook executes the
  // Page-webhook `leadgen` loop against these rather than asserting about it.
  metaLeadForm: [],
  metaAdConnection: [],
  messageThread: [],
  message: [],
  // The Facebook Page / Instagram PUBLISHING connection
  // (check-meta-pages-connect.mjs). The claims that need executing are
  // "a disconnected row can never answer connected" and "the token that comes
  // back out is the one that went in, and it was never at rest in plain
  // text" — both are properties of a query plus a decrypt, which reading
  // lib/social/metaConnection.js cannot establish.
  metaPageConnection: [],
  // WhatsApp's approved message templates (check-whatsapp.mjs). The claim that
  // needs executing is "a template sync writes Meta's verdict and never
  // invents one", which is a property of an upsert keyed on
  // (companyId, name, language) — reading lib/messaging/templates.js cannot
  // establish it.
  whatsAppTemplate: [],
  // Inbound enquiries (check-lead-intake.mjs). The claim that needs executing
  // is "converting an instant-quote lead gives the client an address" — that
  // is a property of convertLeadToQuote reading LeadRequest.intake and writing
  // Client.address/city/province/country, and it is exactly the regression a
  // source-level check would keep passing through.
  leadRequest: [],
  // The tenant activity trail and the actor lookup lib/activity/log.js makes
  // before writing it (check-whatsapp.mjs). The claim that needs executing is
  // "the connection is logged and the token is not in the row" — a property
  // of the `data` a create() received, which reading the route cannot settle.
  user: [],
  activityLog: [],
  // ── The sales retry pool (scripts/check-sales-retry-pool.mjs) ──────────
  // Prospect rows for the claim scan and the platform's Exhausted list, the
  // claim log the batch writes, the attempt rows a disposition updates, the
  // presence ledger the shift start is read from, and the audit row a
  // recycle writes. Fixture rows carry `_count` for the relation filters
  // (`capabilities: { some: {} }`) and `leads` for the zone read.
  prospect: [],
  salesQueueClaim: [],
  salesCallAttempt: [],
  salesRepActivity: [],
  platformAuditLog: [],
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
  rows.member = [];
  rows.pendingTeamProfile = [];
  rows.subscription = [];
  rows.plan = [];
  rows.messagingChannel = [];
  rows.metaLeadForm = [];
  rows.metaAdConnection = [];
  rows.messageThread = [];
  rows.message = [];
  rows.metaPageConnection = [];
  rows.whatsAppTemplate = [];
  rows.leadRequest = [];
  rows.user = [];
  rows.activityLog = [];
  rows.prospect = [];
  rows.salesQueueClaim = [];
  rows.salesCallAttempt = [];
  rows.salesRepActivity = [];
  rows.platformAuditLog = [];
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
    // Prisma's OR: any branch matching is a match. Added for the billing
    // webhook's schedule-event query, which finds a row by schedule id OR by
    // subscription id — a stub that answered "no row" to an OR would let the
    // clear pass vacuously.
    if (key === "OR" && Array.isArray(value)) return value.some((branch) => matches(row, branch));
    // Prisma's AND: every branch. lib/sales/prospectView.js's claim WHERE
    // carries the retry-pool clause and the language rule's as an AND
    // beside the lease's OR, and a stub that skipped it would hand out an
    // exhausted row — the thing the clause exists to stop.
    if (key === "AND" && Array.isArray(value)) return value.every((branch) => matches(row, branch));
    // Relation filters, answered from the row's own `_count` the way
    // check-sales-batch-claim's matcher does: `{ some: {} }` is "has any",
    // `{ none: {} }` is "has none". A relation the fixture does not count
    // is read as empty.
    if (value && typeof value === "object" && !Array.isArray(value) && ("some" in value || "none" in value)) {
      const n = Number(row._count?.[key]) || 0;
      if ("some" in value) return n > 0;
      return n === 0;
    }
    // `where: { disconnectedAt: null }` must match a row that never set the
    // column. In Postgres an unwritten nullable column IS null, and a fixture
    // row is an object literal — so without this, a `create` that omitted the
    // field produced a row no `disconnectedAt: null` query could find, and a
    // check asking "is this channel live" got "no such row" for a channel that
    // is live. The stub answered a question the database would answer the
    // other way, which is the one thing a stub must not do.
    if (value === null) return row[key] === null || row[key] === undefined;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if ("in" in value) return value.in.includes(row[key]);
      // Postgres semantics: NOT IN over a NULL is NULL, i.e. false.
      if ("notIn" in value) return row[key] != null && !value.notIn.includes(row[key]);
      if ("not" in value) {
        if (value.not === null) return row[key] !== null && row[key] !== undefined;
        return row[key] !== value.not;
      }
      // Comparisons over dates or numbers. A NULL never satisfies one — the
      // lease clause `claimExpiresAt: { lt: now }` must not hand out a live
      // claim, and `nextAttemptAt: { lt: now }` must not offer a row that
      // has no instant (the OR's other branch is what admits those).
      const cmp = (a, b) => {
        if (a == null || b == null) return null;
        const x = a instanceof Date ? a.getTime() : Number(a);
        const y = b instanceof Date ? b.getTime() : Number(b);
        return Number.isFinite(x) && Number.isFinite(y) ? x - y : null;
      };
      if ("lt" in value) { const d = cmp(row[key], value.lt); return d !== null && d < 0; }
      if ("lte" in value) { const d = cmp(row[key], value.lte); return d !== null && d <= 0; }
      if ("gt" in value) { const d = cmp(row[key], value.gt); return d !== null && d > 0; }
      if ("gte" in value) { const d = cmp(row[key], value.gte); return d !== null && d >= 0; }
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

/** The filtered, ordered, paged, relation-selected read behind findMany / findFirst. */
function selectMany(name, args = {}) {
  let out = rows[name].filter((r) => matches(r, args.where));

  // orderBy, take and skip, honoured so a paged or ordered read can be
  // asserted on — `{ createdAt: "asc" }` or `[{ claimedAt: "asc" },
  // { position: "asc" }]`. A stub that ignored the order would let a
  // "due retries first" claim pass on fixture order alone.
  const orders = Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : [];
  if (orders.length) {
    const val = (v) => (v instanceof Date ? v.getTime() : v == null ? null : v);
    out = [...out].sort((a, b) => {
      for (const o of orders) {
        const [k, dir] = Object.entries(o)[0] || [];
        if (!k) continue;
        const x = val(a[k]);
        const y = val(b[k]);
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        const c = x < y ? -1 : 1;
        return dir === "desc" ? -c : c;
      }
      return 0;
    });
  }
  if (Number.isFinite(args.skip) && args.skip > 0) out = out.slice(args.skip);
  if (Number.isFinite(args.take)) out = out.slice(0, args.take);
  // Relation selects the sales queue reads: a prospect's claim rows,
  // attempt rows and leads, filtered by the nested where. Answered from
  // the sibling fixture tables so the read is a join, not a copy.
  if (args.select && name === "prospect") {
    out = out.map((p) => {
      const r = { ...p };
      if (args.select.queueClaims) {
        const q = args.select.queueClaims;
        r.queueClaims = rows.salesQueueClaim.filter((c) => c.prospectId === p.id && matches(c, q.where)).slice(0, q.take || 1e9);
      }
      if (args.select.callAttempts) {
        const q = args.select.callAttempts;
        r.callAttempts = rows.salesCallAttempt.filter((a) => a.prospectId === p.id && matches(a, q.where));
      }
      if (args.select.leads) r.leads = Array.isArray(p.leads) ? p.leads : [];
      return r;
    });
  }
  if (args.select && name === "salesQueueClaim" && args.select.prospect) {
    out = out.map((c) => {
      const p = rows.prospect.find((x) => x.id === c.prospectId) || null;
      return { ...c, prospect: p ? { assignedRepId: p.assignedRepId, claimExpiresAt: p.claimExpiresAt } : null };
    });
  }
  return out;
  return out;
}

function model(name) {
  return {
    findUnique: async (args = {}) => {
      reads.push({ model: name, action: "findUnique", args });
      const row = rows[name].find((r) => matches(r, args.where)) || null;
      if (row && name === "prospect" && args.select?.leads) return { ...row, leads: Array.isArray(row.leads) ? row.leads : [] };
      return row;
    },
    findFirst: async (args = {}) => {
      reads.push({ model: name, action: "findFirst", args });
      // An ordered findFirst is the first row of the ordered read — the
      // shift-start read asks for the earliest Available row, and "first
      // in fixture order" would be a different answer.
      if (args.orderBy) return (await selectMany(name, { ...args, take: 1 }))[0] || null;
      return rows[name].find((r) => matches(r, args.where)) || null;
    },
    findMany: async (args = {}) => {
      reads.push({ model: name, action: "findMany", args });
      return selectMany(name, args);
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
    /** Prisma's createMany: every row, in order, and `{ count }` back. */
    createMany: async ({ data } = {}) => {
      const list = Array.isArray(data) ? data : [];
      writes.push({ model: name, action: "createMany", data: list });
      for (const d of list) rows[name].push({ id: `${name}_${rows[name].length + 1}`, ...d });
      return { count: list.length };
    },
    // Applies the change to the fixture row as well as recording it. The
    // original returned a merged copy and left `rows` untouched, which is fine
    // for a check that reads `writes` and wrong for one that then re-reads the
    // row — an unread badge that "cleared" only in the returned object would
    // let a broken counter pass. `{ increment }` is honoured for the same
    // reason: it is the operator the messaging ingest uses, and treating it as
    // a literal value would write `{ increment: 1 }` into the column.
    update: async ({ where, data } = {}) => {
      writes.push({ model: name, action: "update", where, data });
      const row = rows[name].find((r) => matches(r, where));
      const applied = {};
      for (const [key, value] of Object.entries(data || {})) {
        if (value && typeof value === "object" && "increment" in value) {
          applied[key] = (row?.[key] || 0) + value.increment;
        } else if (value && typeof value === "object" && "decrement" in value) {
          applied[key] = (row?.[key] || 0) - value.decrement;
        } else {
          applied[key] = value;
        }
      }
      if (row) Object.assign(row, applied);
      return { ...(row || {}), ...applied };
    },
    /**
     * Prisma's upsert, which is what every idempotent webhook in this codebase
     * is built on. Modelled honestly: find by the (possibly compound) unique,
     * UPDATE it when found and CREATE when not — so a check can deliver the
     * same webhook twice and count the rows rather than trust a comment.
     * Prisma ignores an `undefined` in `update`, and so does this: the
     * messaging ingest relies on that to mean "leave it alone".
     */
    upsert: async ({ where, create, update } = {}) => {
      const existing = rows[name].find((r) => matches(r, where));
      if (existing) {
        writes.push({ model: name, action: "upsert:update", where, data: update });
        for (const [key, value] of Object.entries(update || {})) {
          if (value !== undefined) existing[key] = value;
        }
        return existing;
      }
      writes.push({ model: name, action: "upsert:create", where, data: create });
      const row = { id: `${name}_${rows[name].length + 1}`, ...flattenWhere(where), ...create };
      rows[name].push(row);
      return row;
    },
    // The one finder-shaped WRITE, and the only method here that mutates
    // `rows`. That asymmetry with update() above is deliberate rather than an
    // oversight: updateMany exists in the product to make a guard atomic —
    // `where: { id, onboardingCompletedAt: null }` is what stops two
    // simultaneous dashboard loads both stamping a completion date — and a
    // stub that recorded the write without applying it would answer "no row
    // matched" the same way whether the guard worked or not. Applying it means
    // a check can call the real function twice and watch the second call find
    // nothing to do. Returns Prisma's own `{ count }`.
    updateMany: async ({ where, data } = {}) => {
      writes.push({ model: name, action: "updateMany", where, data });
      const hits = rows[name].filter((r) => matches(r, where));
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
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
    member: model("member"),
    pendingTeamProfile: model("pendingTeamProfile"),
    helpFeedback: model("helpFeedback"),
    subscription: model("subscription"),
    plan: model("plan"),
    messagingChannel: model("messagingChannel"),
    metaLeadForm: model("metaLeadForm"),
    metaAdConnection: model("metaAdConnection"),
    messageThread: model("messageThread"),
    message: model("message"),
    metaPageConnection: model("metaPageConnection"),
    whatsAppTemplate: model("whatsAppTemplate"),
    leadRequest: model("leadRequest"),
    user: model("user"),
    activityLog: model("activityLog"),
    prospect: model("prospect"),
    salesQueueClaim: model("salesQueueClaim"),
    salesCallAttempt: model("salesCallAttempt"),
    salesRepActivity: model("salesRepActivity"),
    platformAuditLog: model("platformAuditLog"),
    marketingCampaignDelivery: uniqueCreateModel("marketingCampaignDelivery", [
      "campaignId",
      "subscriberId",
    ]),
    // Prisma's interactive transaction, modelled as "run the callback with
    // this same client". It does NOT roll back — nothing here can — and that
    // is stated rather than implied: a check must not read a passing run as
    // proof of atomicity. What it DOES let a check prove is the thing the
    // product actually gets wrong, which is a write happening in the wrong
    // order or not at all. Added for the messaging PATCH, which puts a thread
    // update and the activity row recording it in one transaction so a status
    // cannot move with no line saying so.
    //
    // The array form ($transaction([p1, p2])) receives promises that Prisma
    // has already started; awaiting them is the honest stand-in.
    $transaction: async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(db)),
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
