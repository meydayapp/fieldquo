// scripts/fixtures/promotionsStubs.mjs
//
// Recording stand-ins for the database and Stripe, used only by
// scripts/check-promotions-live.mjs through promotions-stub-hooks.mjs.
//
// Why its own fixture rather than dbStub.mjs + stripeStub.mjs: the claims the
// check makes are about ONE conversation — the promotions the checkout reads,
// the coupon it finds or mints, and the exact params of the Checkout Session,
// subscription update or schedule phase that carries it — and about a
// re-run finding the coupon instead of minting a duplicate. That needs a
// Stripe whose coupons persist across calls and can be pre-seeded (a
// matching one, a tampered one, a race), which stripeStub does not model.
//
// The database is lenient on purpose where the checkout's neighbours reach
// for it (the signup funnel stamp, analytics, referral credit): those calls
// are recorded and answered with nothing, and the assertions read only the
// models this feature owns — platformPromotion reads and the subscription
// writes that record what was sold and charged. Nothing leaves the process.

export * from "./stripeStub.mjs";

export const calls = [];
export const state = {
  promotions: [],
  subscription: null,
  coupons: new Map(),
  subscriptions: new Map(),
  schedules: new Map(),
  prices: [],
  nextId: 1,
  // One-shot behaviours for the race and failure paths.
  raceOnCreate: false,
};

export function resetStubs() {
  calls.length = 0;
  state.promotions = [];
  state.subscription = null;
  state.coupons.clear();
  state.subscriptions.clear();
  state.schedules.clear();
  state.prices.length = 0;
  state.nextId = 1;
  state.raceOnCreate = false;
}

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const record = (method, ...args) => calls.push({ method, args: clone(args) });
const nid = (p) => `${p}_${state.nextId++}`;
const missing = (what) => {
  const err = new Error(`No such ${what}`);
  err.code = "resource_missing";
  err.statusCode = 404;
  return err;
};

// ── Stripe ──────────────────────────────────────────────────────────────────
export const stripe = {
  customers: {
    search: async (params) => (record("customers.search", params), { data: [] }),
    create: async (params) => (record("customers.create", params), { id: "cus_1", ...params }),
  },
  coupons: {
    retrieve: async (id) => {
      record("coupons.retrieve", id);
      const c = state.coupons.get(id);
      if (!c) throw missing(`coupon: ${id}`);
      return clone(c);
    },
    create: async (params, opts) => {
      record("coupons.create", params, opts);
      if (state.raceOnCreate) {
        // Another checkout minted it a moment ago.
        state.raceOnCreate = false;
        state.coupons.set(params.id, { ...params, object: "coupon", valid: true });
        const err = new Error(`Coupon already exists: ${params.id}`);
        err.code = "resource_already_exists";
        throw err;
      }
      if (state.coupons.has(params.id)) {
        const err = new Error(`Coupon already exists: ${params.id}`);
        err.code = "resource_already_exists";
        throw err;
      }
      const c = { ...params, object: "coupon", valid: true };
      state.coupons.set(params.id, c);
      return clone(c);
    },
  },
  checkout: {
    sessions: {
      create: async (params) => (record("checkout.sessions.create", params), { id: nid("cs"), url: "https://checkout.stripe.test/s" }),
    },
  },
  subscriptions: {
    retrieve: async (id) => {
      record("subscriptions.retrieve", id);
      const s = state.subscriptions.get(id);
      if (!s) throw missing(`subscription: ${id}`);
      return clone(s);
    },
    update: async (id, params) => {
      record("subscriptions.update", id, params);
      const s = state.subscriptions.get(id) || { id };
      return { ...clone(s), metadata: params.metadata ?? s.metadata };
    },
  },
  subscriptionSchedules: {
    create: async (params) => {
      record("subscriptionSchedules.create", params);
      const sub = state.subscriptions.get(params.from_subscription);
      const sched = {
        id: nid("sub_sched"),
        status: "active",
        phases: [
          {
            start_date: sub.current_period_start,
            end_date: sub.current_period_end,
            items: (sub.items?.data || []).map((it) => ({ price: it.price?.id || it.price, quantity: it.quantity ?? 1 })),
            discounts: sub.discounts?.length ? sub.discounts.map((d) => ({ coupon: null, discount: d, promotion_code: null })) : [],
            automatic_tax: { enabled: true },
            metadata: sub.metadata || {},
          },
        ],
      };
      state.schedules.set(sched.id, sched);
      return clone(sched);
    },
    retrieve: async (id) => {
      record("subscriptionSchedules.retrieve", id);
      const s = state.schedules.get(id);
      if (!s) throw missing(`schedule: ${id}`);
      return clone(s);
    },
    update: async (id, params) => {
      record("subscriptionSchedules.update", id, params);
      return { id, ...clone(params) };
    },
    release: async (id) => (record("subscriptionSchedules.release", id), { id, status: "released" }),
  },
  products: {
    search: async (params) => (record("products.search", params), { data: [] }),
    create: async (params) => (record("products.create", params), { id: nid("prod"), ...params }),
  },
  prices: {
    list: async (params) => {
      record("prices.list", params);
      const keys = params?.lookup_keys || [];
      return { data: state.prices.filter((p) => keys.includes(p.lookup_key)) };
    },
    create: async (params) => {
      record("prices.create", params);
      const p = { id: nid("price"), active: true, ...params };
      state.prices.push(p);
      return clone(p);
    },
  },
};

// ── The database ────────────────────────────────────────────────────────────
function matchesPromotionWhere(p, where = {}) {
  if (where.active !== undefined && p.active !== where.active) return false;
  if (where.endsAt?.gt && !(new Date(p.endsAt).getTime() > new Date(where.endsAt.gt).getTime())) return false;
  return true;
}

function lenientModel(name, overrides = {}) {
  return new Proxy(overrides, {
    get(target, method) {
      if (method in target) return target[method];
      return async (args) => {
        record(`db.${name}.${String(method)}`, args);
        if (String(method) === "findMany") return [];
        if (String(method) === "count") return 0;
        if (String(method).startsWith("update") || String(method) === "upsert" || String(method) === "create") return { id: `${name}_1`, ...(args?.data || args?.create || {}) };
        return null;
      };
    },
  });
}

const models = {
  platformPromotion: lenientModel("platformPromotion", {
    findMany: async (args) => {
      record("db.platformPromotion.findMany", args);
      return clone(state.promotions).filter((p) => matchesPromotionWhere(p, args?.where));
    },
  }),
  subscription: lenientModel("subscription", {
    findUnique: async (args) => (record("db.subscription.findUnique", args), clone(state.subscription)),
    findFirst: async (args) => (record("db.subscription.findFirst", args), clone(state.subscription)),
    update: async (args) => (record("db.subscription.update", args), { ...clone(state.subscription), ...args.data }),
    upsert: async (args) => (record("db.subscription.upsert", args), { id: "sub_row", companyId: args.where.companyId, ...args.create }),
  }),
};

export const db = new Proxy(models, {
  get(target, name) {
    if (name === "$transaction") return async (ops) => (Array.isArray(ops) ? Promise.all(ops) : ops(db));
    if (!(name in target)) target[name] = lenientModel(String(name));
    return target[name];
  },
});
