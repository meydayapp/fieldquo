// scripts/fixtures/platformCancelStubs.mjs
//
// Recording stand-ins for the three things the platform cancel route talks
// to — the database, Stripe and the platform-admin session — used only by
// scripts/check-platform-cancel-lock.mjs through platform-cancel-stub-hooks.mjs.
//
// Why its own fixture rather than dbStub.mjs + stripeStub.mjs: the claim the
// check makes is "the Stripe path's calls and write set are byte-identical to
// the version before 2026-09-28", which is a claim about the ORDER and the
// ARGUMENTS of every Stripe call and every operation handed to $transaction.
// This fake records exactly those, in order, and nothing else; the reads are
// recorded separately because the new route reads more columns (that is the
// change) while writing exactly the same things.

export const calls = [];
export const reads = [];

export const state = {
  company: null,
  subscription: null,
  stripeSub: null,
  admin: { id: "adm_super", role: "superadmin" },
  // Stripe's clock for a cancel — fixed, so a replay is comparable.
  canceledAtUnix: 1790000000,
};

export function resetStubs() {
  calls.length = 0;
  reads.length = 0;
  state.company = null;
  state.subscription = null;
  state.stripeSub = null;
  state.admin = { id: "adm_super", role: "superadmin" };
}

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const op = (model, method, args) => ({ __op: `${model}.${method}`, args });

export const db = {
  company: {
    findUnique: async (args) => {
      reads.push({ model: "company", args: clone(args) });
      return state.company ? { ...state.company, subscription: state.subscription } : null;
    },
    update: (args) => op("company", "update", args),
  },
  subscription: {
    findUnique: async (args) => {
      reads.push({ model: "subscription", args: clone(args) });
      if (!state.subscription) return null;
      // The nested relation access.js asks for, when it asks.
      return args?.select?.company ? { ...state.subscription, company: state.company } : { ...state.subscription };
    },
    update: (args) => op("subscription", "update", args),
  },
  voiceAutoTopup: { updateMany: (args) => op("voiceAutoTopup", "updateMany", args) },
  platformAuditLog: { create: (args) => op("platformAuditLog", "create", args) },
  $transaction: async (ops) => {
    calls.push({ kind: "transaction", ops });
    return ops.map(() => ({}));
  },
};

export const stripe = {
  subscriptions: {
    retrieve: async (id) => {
      calls.push({ kind: "stripe", method: "subscriptions.retrieve", args: [id] });
      if (!state.stripeSub) throw new Error(`No such subscription: ${id}`);
      return clone(state.stripeSub);
    },
    update: async (id, params) => {
      calls.push({ kind: "stripe", method: "subscriptions.update", args: [id, params] });
      return { ...clone(state.stripeSub), cancel_at_period_end: true, cancel_at: state.stripeSub.current_period_end };
    },
    cancel: async (id, params) => {
      calls.push({ kind: "stripe", method: "subscriptions.cancel", args: [id, params] });
      return { ...clone(state.stripeSub), status: "canceled", canceled_at: state.canceledAtUnix, ended_at: state.canceledAtUnix };
    },
  },
};

export async function getCurrentPlatformAdmin() {
  return state.admin;
}
