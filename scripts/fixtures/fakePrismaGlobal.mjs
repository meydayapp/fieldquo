// scripts/fixtures/fakePrismaGlobal.mjs
//
// A scriptable fake Prisma client, installed as globalThis.__prisma so that
// lib/db.js — which reuses `globalThis.__prisma` when one exists rather than
// constructing a client — hands it out as `db`.
//
// Import it FIRST, before anything that reaches lib/db.js: ES modules
// evaluate in import order, so this runs before the database module and the
// real PrismaClient is never built. That lets a check that is otherwise pure
// (scripts/check-quote-costing.mjs) also execute the server paths that read
// the company's settings — buildQuoteCostingRow, deriveQuoteCosting,
// calculateMinimumPrice — without a loader flag or a live database.
//
// Every call goes to globalThis.__FQ_DB(model, op, ...args), which the check
// assigns. Unscripted calls throw by name: a stub that quietly answers
// "nothing" is how a check passes for the wrong reason.

globalThis.__prisma = new Proxy(
  {},
  {
    get: (_t, model) =>
      // `then` is never a model: answering it would make the client look like
      // a promise to anything that awaited it.
      model === "then"
        ? undefined
        : new Proxy(
            {},
            {
              get: (_x, op) =>
                op === "then"
                  ? undefined
                  : (...args) => {
                      if (typeof globalThis.__FQ_DB !== "function") {
                        throw new Error(`unscripted db.${String(model)}.${String(op)}`);
                      }
                      return globalThis.__FQ_DB(String(model), String(op), ...args);
                    },
            },
          ),
  },
);
