// scripts/fixtures/stripeStub.mjs
//
// A recording stand-in for `@/lib/stripe`, used only by check scripts run
// through billing-stub-loader.mjs.
//
// Same two rules as dbStub.mjs: every call is RECORDED in `calls` so an
// assertion can read the exact params the product sent to Stripe (a schedule
// phase carrying `proration_behavior: "create_prorations"` is a claim about an
// argument), and a method the product reaches for that is not scripted here
// throws by name rather than answering undefined.
//
// The subscription-schedule behaviour is the small slice of Stripe's that
// schedulePlanChange depends on: `create({ from_subscription })` answers with
// a schedule whose first phase mirrors the live subscription's current period,
// items and trial — which is what Stripe does — so the product's restatement
// of that phase can be checked against what it was given.

export const calls = [];

export const state = {
  subscriptions: new Map(),
  schedules: new Map(),
  products: [],
  // What products.search answers with. Empty = nothing found, so create runs.
  productSearchHits: [],
  nextId: 1,
};

export function resetStripeStub() {
  calls.length = 0;
  state.subscriptions.clear();
  state.schedules.clear();
  state.products.length = 0;
  state.productSearchHits = [];
  state.nextId = 1;
}

const record = (method, ...args) => calls.push({ method, args });
const id = (prefix) => `${prefix}_${state.nextId++}`;

function unscripted(ns) {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        throw new Error(`stripeStub: stripe.${ns}.${String(prop)} was used but is not scripted — add it to scripts/fixtures/stripeStub.mjs`);
      },
    },
  );
}

function phaseFromSubscription(sub) {
  return {
    start_date: sub.current_period_start,
    end_date: sub.current_period_end,
    items: (sub.items?.data || []).map((it) => ({
      price: typeof it.price === "string" ? it.price : it.price?.id,
      quantity: it.quantity ?? 1,
    })),
    trial_end: sub.trial_end || null,
    metadata: sub.metadata || {},
  };
}

export const stripe = {
  subscriptions: {
    retrieve: async (subId) => {
      record("subscriptions.retrieve", subId);
      const sub = state.subscriptions.get(subId);
      if (!sub) {
        const err = new Error(`No such subscription: ${subId}`);
        err.code = "resource_missing";
        err.statusCode = 404;
        throw err;
      }
      return sub;
    },
    update: async (subId, params) => {
      record("subscriptions.update", subId, params);
      const sub = state.subscriptions.get(subId) || { id: subId };
      Object.assign(sub, { metadata: params.metadata ?? sub.metadata });
      state.subscriptions.set(subId, sub);
      return sub;
    },
    cancel: async (subId) => {
      record("subscriptions.cancel", subId);
      return { id: subId, status: "canceled" };
    },
  },
  subscriptionSchedules: {
    create: async (params) => {
      record("subscriptionSchedules.create", params);
      const sub = state.subscriptions.get(params.from_subscription);
      if (!sub) throw new Error(`stripeStub: from_subscription ${params.from_subscription} is not in state.subscriptions`);
      const sched = {
        id: id("sub_sched"),
        status: "active",
        subscription: sub.id,
        end_behavior: "release",
        phases: [phaseFromSubscription(sub)],
      };
      state.schedules.set(sched.id, sched);
      return sched;
    },
    retrieve: async (schedId) => {
      record("subscriptionSchedules.retrieve", schedId);
      const sched = state.schedules.get(schedId);
      if (!sched) {
        const err = new Error(`No such subscription schedule: ${schedId}`);
        err.code = "resource_missing";
        err.statusCode = 404;
        throw err;
      }
      return sched;
    },
    update: async (schedId, params) => {
      record("subscriptionSchedules.update", schedId, params);
      const sched = state.schedules.get(schedId);
      if (!sched) throw new Error(`stripeStub: schedule ${schedId} does not exist`);
      if (params.phases) sched.phases = params.phases;
      if (params.end_behavior) sched.end_behavior = params.end_behavior;
      return sched;
    },
    release: async (schedId) => {
      record("subscriptionSchedules.release", schedId);
      const sched = state.schedules.get(schedId);
      if (!sched) {
        const err = new Error(`No such subscription schedule: ${schedId}`);
        err.code = "resource_missing";
        err.statusCode = 404;
        throw err;
      }
      sched.status = "released";
      return sched;
    },
  },
  products: {
    search: async (params) => {
      record("products.search", params);
      return { data: state.productSearchHits };
    },
    create: async (params) => {
      record("products.create", params);
      const product = { id: id("prod"), ...params };
      state.products.push(product);
      return product;
    },
  },
  customers: unscripted("customers"),
  checkout: unscripted("checkout"),
  prices: unscripted("prices"),
  billingPortal: unscripted("billingPortal"),
  webhooks: unscripted("webhooks"),
};

// lib/stripe.js's other exports, so a module in the import graph that names
// one of them still links. None of them may be CALLED under the stub.
const refuse = (name) => () => {
  throw new Error(`stripeStub: ${name} is not scripted`);
};
export const createConnectOnboardingLink = refuse("createConnectOnboardingLink");
export const createExpressLoginLink = refuse("createExpressLoginLink");
export const invoiceBalanceCents = refuse("invoiceBalanceCents");
export const createInvoiceCheckoutSession = refuse("createInvoiceCheckoutSession");
export const createBookingFeeCheckoutSession = refuse("createBookingFeeCheckoutSession");
export const payoutToContractor = refuse("payoutToContractor");
