// scripts/check-notifications.mjs
//
//   npm run check:notifications
//
// The notification feed's guarantees, EXECUTED.
//
// ══ What this proves, and what it cannot ═══════════════════════════════════
//
// It runs the real catalog, the real recipient resolver, the real notifyEvent
// and the real route handlers against a scripted database. It proves:
//
//   1. every catalog type is sound, and an unrecognised audience REFUSES —
//      the opposite of hasLevel's fail-open, which is the trap the feed is
//      most likely to fall into (see the header of lib/notifications/catalog.js
//      and app/api/settings/notification-rules/route.js:35-44);
//   2. fan-out reaches exactly the declared audience and nobody else, for
//      every type, against a Crew member, an Estimator, a Dispatcher, a
//      Manager, an admin, an owner and a legacy member with no grid at all;
//   3. a money event never reaches a showPricing:false member — at fan-out AND
//      again at render, because a grid can be edited after a row exists;
//   4. nobody is ever told what they themselves just did;
//   5. an event with no eligible recipient writes NOTHING;
//   6. a second delivery of the same event is a no-op — the @@unique the
//      retried-webhook case depends on;
//   7. read state does not leak between two companies for one user;
//   8. mark-as-read cannot touch another member's row, in the same company or
//      a different one;
//   9. no route accepts a recipient id, and sending one changes nothing;
//  10. money is never inside a stored string — a hostile `params` object
//      cannot smuggle a figure into the row.
//
// It cannot prove that the bell renders, that a real Postgres unique index
// behaves like the one modelled here, or that the six emit call sites fire on
// the real events — sections 11 and 12 assert the call sites STRUCTURALLY,
// which is weaker, and say so.
//
// ══ Every string rule is scoped to ONE brace-matched function ══════════════
//
// `src.includes(x)` over a whole file passes as soon as the string appears
// anywhere, including inside the comment explaining why it must not. Worse,
// `src.indexOf(a) < src.indexOf(b)` FALSE-PASSES when `a` is absent, because
// indexOf returns -1 and -1 is less than everything. So section 11 slices out
// the named function first and asserts inside that slice only.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// The scripted database, and the module hooks that make the product use it
// ═══════════════════════════════════════════════════════════════════════════
//
// Same technique scripts/check-crew-access.mjs uses on the job routes: swap
// "@/lib/db", "@/lib/currentMember" and "next/server" for stubs behind a
// resolver hook, then import the REAL handlers. Nothing here is a copy of the
// product; the only fakes are the database, the session and NextResponse.

const ROWS = {
  member: [],
  notificationEvent: [],
  notificationDelivery: [],
  user: [],
  company: [],
};

const RELATIONS = new Set(["event", "member", "company", "client", "deliveries"]);

/** A small Prisma `where` evaluator: equality, null, in, lt, nested relations. */
function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("lt" in cond) {
        if (!(new Date(value) < new Date(cond.lt))) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function projectRelation(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => projectRow(v, spec));
  if (value == null) return null;
  return projectRow(value, spec);
}

function projectRow(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
    }
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!RELATIONS.has(key)) out[key] = value;
  }
  for (const [key, sub] of Object.entries(spec.include || {})) {
    out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
  }
  return out;
}

/** Every write the product attempted, so an assertion can read the ARGUMENTS. */
const WRITES = [];

/**
 * The @@unique([eventId, memberId]) that makes fan-out idempotent, modelled
 * explicitly rather than assumed. A stub with no uniqueness would let the
 * "a retried webhook must not deliver twice" assertion pass on code that
 * dropped skipDuplicates.
 */
const UNIQUE = { notificationDelivery: ["eventId", "memberId"] };

let seq = 0;

/**
 * Attach the one relation these routes traverse.
 *
 * The GET handler asks for `include: { event: {...} }`, and a stub that
 * answered `undefined` there would let every assertion about what a feed row
 * SAYS pass against a route returning nothing at all.
 */
function hydrate(name, row) {
  if (name !== "notificationDelivery") return row;
  return { ...row, event: ROWS.notificationEvent.find((e) => e.id === row.eventId) || null };
}

function stubModel(name) {
  const all = () => ROWS[name].map((r) => hydrate(name, r));
  return {
    async findMany(args = {}) {
      let list = all().filter((r) => matchWhere(r, args.where));
      if (args.orderBy?.createdAt === "desc") {
        list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      if (args.take) list = list.slice(0, args.take);
      return list.map((r) => projectRow(r, args));
    },
    async findFirst(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async count(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).length;
    },
    async create(args = {}) {
      WRITES.push({ model: name, action: "create", args });
      const row = { id: `${name}_${++seq}`, createdAt: new Date(), readAt: null, ...args.data };
      ROWS[name].push(row);
      return projectRow(row, args);
    },
    async createMany(args = {}) {
      WRITES.push({ model: name, action: "createMany", args });
      const keys = UNIQUE[name];
      let count = 0;
      for (const data of args.data || []) {
        if (keys) {
          // Against the STORED rows, not the hydrated copies — a uniqueness
          // check that ran over a projection would be checking a snapshot.
          const dup = ROWS[name].some((r) => keys.every((k) => r[k] === data[k]));
          if (dup) {
            if (args.skipDuplicates) continue;
            const err = new Error(`unique constraint on ${name}(${keys.join(", ")})`);
            err.code = "P2002";
            throw err;
          }
        }
        ROWS[name].push({
          id: `${name}_${++seq}`,
          createdAt: new Date(),
          readAt: null,
          channels: ["in_app"],
          ...data,
        });
        count++;
      }
      return { count };
    },
    async updateMany(args = {}) {
      WRITES.push({ model: name, action: "updateMany", args });
      // The stored rows, so a mark-as-read actually sticks and the "read state
      // did not cross tenants" assertion is testing state rather than a copy.
      const hits = ROWS[name].filter((r) => matchWhere(r, args.where));
      for (const row of hits) Object.assign(row, args.data);
      return { count: hits.length };
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {
    member: stubModel("member"),
    notificationEvent: stubModel("notificationEvent"),
    notificationDelivery: stubModel("notificationDelivery"),
    user: stubModel("user"),
    company: stubModel("company"),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Loud, never quiet: a check must not pass because a query nobody
      // modelled answered "nothing".
      throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
    },
  },
);

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;
// recordError writes to the platform error log, which this check has no
// business exercising. Collected so section 1 can assert a refusal was REPORTED
// rather than swallowed.
globalThis.__FQ_ERRORS = [];

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
  "@/lib/platform/errorLog": "fq-stub:errors",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  if (url === "fq-stub:errors") {
    return { format: "module", shortCircuit: true,
      source: "export const recordError = async (e) => { globalThis.__FQ_ERRORS.push(e); }; export const errorDetail = (e, x) => ({ message: e?.message, ...x });" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const catalog = await import("@/lib/notifications/catalog");
const { NOTIFICATION_TYPES, NOTIFICATION_TYPE_KEYS, audienceProblem, satisfiesAudience, typeProblems, supervisorsIncluded } = catalog;
const { selectRecipients, resolveRecipients } = await import("@/lib/notifications/recipients");
const { notifyEvent } = await import("@/lib/notifications/notify");
const { amountFor, hrefFor, noteKeysFor, NOTE_PARAMS } = await import("@/lib/notifications/render");
const { hasLevel, hasToggle } = await import("@/lib/permissions/enforce");
const { PERMISSION_PRESETS } = await import("@/lib/permissions");

const notificationsRoute = await import("@/app/api/notifications/route.js");
const readRoute = await import("@/app/api/notifications/read/route.js");
const uiStateRoute = await import("@/app/api/ui-state/route.js");

// ── The cast ───────────────────────────────────────────────────────────────
//
// Built from the SHIPPED presets rather than from hand-written permission
// objects, so a preset edit that changes who sees money fails here instead of
// silently changing the feed. PRESET_TO_ROLE is the mapping the New User page
// uses; it is restated as literals only because these five rows also need ids.
const CO = "co_a";
const person = (id, role, presetKey, extra = {}) => ({
  id,
  userId: `u_${id}`,
  companyId: CO,
  role,
  active: true,
  permissions: presetKey ? { ...PERMISSION_PRESETS[presetKey].values } : null,
  ...extra,
});

const OWNER = person("m_owner", "owner", null);
const ADMIN = person("m_admin", "admin", null);
const MANAGER = person("m_manager", "supervisor", "manager");
const DISPATCHER = person("m_dispatcher", "supervisor", "dispatcher");
const ESTIMATOR = person("m_estimator", "employee", "estimator");
const CREW = person("m_crew", "employee", "worker");
// Somebody who predates the granular grid. hasLevel waves them through
// everywhere; the feed must not.
const LEGACY = person("m_legacy", "employee", null);

const CAST = [OWNER, ADMIN, MANAGER, DISPATCHER, ESTIMATOR, CREW, LEGACY];
const idsOf = (list) => list.map((m) => m.id).sort();

// ═══════════════════════════════════════════════════════════════════════════
section("1. The catalog is sound, and an unrecognised audience REFUSES");
// ═══════════════════════════════════════════════════════════════════════════

ok("the catalog holds exactly the six tier-1 types", NOTIFICATION_TYPE_KEYS.length === 6, NOTIFICATION_TYPE_KEYS);
ok(
  "the six are the ones the audit ranked tier 1",
  JSON.stringify([...NOTIFICATION_TYPE_KEYS].sort()) ===
    JSON.stringify(
      [
        "invoice.paid",
        "lead.created",
        "leave.requested",
        "payment.disputed",
        "quote.accepted",
        "quote.needsReview",
      ].sort(),
    ),
  NOTIFICATION_TYPE_KEYS,
);

for (const type of NOTIFICATION_TYPE_KEYS) {
  ok(`"${type}" declares a sound audience, money flag and params`, typeProblems(type).length === 0, typeProblems(type));
}

// The fail-closed half, stated four ways.
ok("an audience naming a category that does not exist is refused", Boolean(audienceProblem({ category: "nonsense", level: "view_only" })));
ok("an audience naming a level the category does not have is refused", Boolean(audienceProblem({ category: "quotes", level: "godmode" })));
ok("an audience naming a capability nobody holds is refused", Boolean(audienceProblem({ capability: "quote:teleport" })));
ok("an audience naming a toggle that does not exist is refused", Boolean(audienceProblem({ toggle: "seeEverything" })));
ok("an empty audience is refused", Boolean(audienceProblem({})));
ok("no audience at all is refused", Boolean(audienceProblem(null)));
ok(
  "an audience declaring two forms at once is refused (which rule would win?)",
  Boolean(audienceProblem({ category: "quotes", level: "view_only", toggle: "showPricing" })),
);

// And the refusal is a REFUSAL, not a shrug: nobody satisfies it.
ok(
  "nobody satisfies an unrecognised audience — not even an owner",
  CAST.every((m) => satisfiesAudience(m, { category: "nonsense", level: "view_only" }) === false),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. satisfiesAudience fails CLOSED exactly where hasLevel fails open");
// ═══════════════════════════════════════════════════════════════════════════
//
// Run side by side against the real hasLevel, so the difference is demonstrated
// rather than asserted. If hasLevel is ever fixed to fail closed, these stop
// disagreeing and this section says so instead of silently passing.

ok(
  "hasLevel returns TRUE for an unknown category (the fall-open being guarded against)",
  hasLevel(CREW, "nonsense", "view_only") === true,
);
ok(
  "satisfiesAudience returns FALSE for the same unknown category",
  satisfiesAudience(CREW, { category: "nonsense", level: "view_only" }) === false,
);

ok(
  "hasLevel returns TRUE for a member with no permissions object at all",
  hasLevel(LEGACY, "quotes", "view_only") === true,
);
ok(
  "satisfiesAudience returns FALSE for that same gridless member",
  satisfiesAudience(LEGACY, { category: "quotes", level: "view_only" }) === false,
);

const NO_QUOTES_KEY = { ...CREW, permissions: { schedule: "view_complete_own" } };
ok(
  "hasLevel returns TRUE when the grid simply never mentions the category",
  hasLevel(NO_QUOTES_KEY, "quotes", "view_only") === true,
);
ok(
  "satisfiesAudience returns FALSE for that unmentioned category",
  satisfiesAudience(NO_QUOTES_KEY, { category: "quotes", level: "view_only" }) === false,
);

ok(
  "hasToggle returns TRUE for a toggle nobody stated",
  hasToggle(NO_QUOTES_KEY, "payments") === true,
);
ok(
  "satisfiesAudience returns FALSE for that unstated toggle",
  satisfiesAudience(NO_QUOTES_KEY, { toggle: "payments" }) === false,
);

// A gridless SUPERVISOR still gets the operational events, because a capability
// audience is answered by the ROLE and needs no grid — otherwise the leave
// notice would reach nobody in a company that never opened the permission
// editor, which is most of them.
ok(
  "a capability audience still reaches a gridless supervisor",
  satisfiesAudience({ role: "supervisor", permissions: null }, { capability: "user:manage" }) === true,
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Fan-out reaches the declared audience and NOBODY else");
// ═══════════════════════════════════════════════════════════════════════════

const EXPECTED = {
  // Money. Crew and Estimator hold payments:false; Manager and Dispatcher are
  // supervisors and the catalog's conservative answer excludes them; Legacy has
  // no grid and fails closed.
  "payment.disputed": ["m_owner", "m_admin"],
  // Money, quotes ladder. Estimator sits at view_create_edit with showPricing,
  // so they qualify — which is the point of moving off the hardcoded owner+admin
  // pair. Crew is `quotes: none` AND showPricing:false, excluded twice over.
  "quote.accepted": ["m_owner", "m_admin", "m_estimator"],
  // Money, invoices ladder. Estimator is invoices:view_only with showPricing.
  "invoice.paid": ["m_owner", "m_admin", "m_estimator"],
  // Operational. Crew is requests:none; Legacy fails closed on the grid.
  "lead.created": ["m_owner", "m_admin", "m_manager", "m_dispatcher", "m_estimator"],
  // Operational, by capability: owner, admin and both supervisors.
  "leave.requested": ["m_owner", "m_admin", "m_manager", "m_dispatcher"],
  // Operational, by capability: quote:approve-estimate is supervisor and up.
  "quote.needsReview": ["m_owner", "m_admin", "m_manager", "m_dispatcher"],
};

for (const type of NOTIFICATION_TYPE_KEYS) {
  const got = idsOf(selectRecipients({ members: CAST, type }));
  ok(`"${type}" reaches exactly ${EXPECTED[type].join(", ")}`, JSON.stringify(got) === JSON.stringify([...EXPECTED[type]].sort()), got);
}

ok(
  "an inactive member is never a recipient, whatever their role",
  idsOf(selectRecipients({ members: [{ ...OWNER, active: false }], type: "quote.accepted" })).length === 0,
);
ok(
  "an unknown type reaches nobody rather than everybody",
  selectRecipients({ members: CAST, type: "quote.teleported" }).length === 0,
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. A money event never reaches a member who may not see money");
// ═══════════════════════════════════════════════════════════════════════════

const MONEY_TYPES = NOTIFICATION_TYPE_KEYS.filter((t) => NOTIFICATION_TYPES[t].money);
ok("three of the six carry money", MONEY_TYPES.length === 3, MONEY_TYPES);

for (const type of MONEY_TYPES) {
  const got = selectRecipients({ members: CAST, type });
  ok(`"${type}" does not reach the Crew member`, !got.some((m) => m.id === "m_crew"));
  ok(
    `"${type}" reaches nobody whose grid says showPricing:false`,
    got.every((m) => m.role === "owner" || m.role === "admin" || m.permissions?.showPricing === true),
    got.map((m) => m.id),
  );
}

// A crew member who is somehow handed the quotes ladder STILL gets nothing,
// because showPricing is a separate axis and is checked first.
const CREW_WITH_QUOTES = {
  ...CREW,
  permissions: { ...PERMISSION_PRESETS.worker.values, quotes: "view_create_edit_delete" },
};
ok(
  "money is withheld from a crew member granted the whole quotes ladder but not showPricing",
  selectRecipients({ members: [CREW_WITH_QUOTES], type: "quote.accepted" }).length === 0,
);

// And again at READ, because a grid can be edited after the row exists.
const MONEY_ROW = { type: "quote.accepted", amount: 12400, currency: "CAD" };
ok("an owner reading a money row gets the figure", amountFor(MONEY_ROW, OWNER) === 12400);
ok("a crew member reading the same row gets null, not a redacted string", amountFor(MONEY_ROW, CREW) === null);
ok(
  "a non-money type never yields a figure even if one was somehow stored",
  amountFor({ type: "lead.created", amount: 999 }, OWNER) === null,
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. Nobody is told what they themselves just did");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "the actor is dropped from their own event",
  !selectRecipients({ members: CAST, type: "lead.created", actorUserId: "u_m_admin" }).some((m) => m.id === "m_admin"),
);
ok(
  "everyone else still receives it",
  idsOf(selectRecipients({ members: CAST, type: "lead.created", actorUserId: "u_m_admin" })).length ===
    EXPECTED["lead.created"].length - 1,
);
// A null actor — the homeowner, or Stripe — must not silently drop every member
// whose userId happens to be null.
ok(
  "a null actor drops nobody",
  idsOf(selectRecipients({ members: CAST, type: "lead.created", actorUserId: null })).length ===
    EXPECTED["lead.created"].length,
);
ok(
  "a null actor does not match a member with a null userId either",
  selectRecipients({ members: [{ ...OWNER, userId: null }], type: "lead.created", actorUserId: null }).length === 1,
);

// ═══════════════════════════════════════════════════════════════════════════
section("6. An event with no eligible recipient writes NOTHING");
// ═══════════════════════════════════════════════════════════════════════════

function resetRows() {
  ROWS.member = [];
  ROWS.notificationEvent = [];
  ROWS.notificationDelivery = [];
  ROWS.user = [];
  ROWS.company = [];
  WRITES.length = 0;
  globalThis.__FQ_ERRORS.length = 0;
}

resetRows();
// A one-van company: the owner is the only member, and they are the actor.
ROWS.member.push({ ...OWNER });
const soloResult = await notifyEvent({
  companyId: CO,
  type: "quote.accepted",
  entityId: "q1",
  amount: 5000,
  actorUserId: "u_m_owner",
});
ok("notifyEvent reports no_recipients", soloResult.reason === "no_recipients", soloResult);
ok("no NotificationEvent row was written", ROWS.notificationEvent.length === 0);
ok("no NotificationDelivery row was written", ROWS.notificationDelivery.length === 0);
ok("and it did not throw into its caller", soloResult.created === false);

resetRows();
// A company of crew only: a money event has nowhere to land.
ROWS.member.push({ ...CREW });
const crewOnly = await notifyEvent({ companyId: CO, type: "invoice.paid", entityId: "inv1", amount: 900 });
ok("a money event in a crew-only company writes nothing", crewOnly.reason === "no_recipients" && ROWS.notificationEvent.length === 0);

// An unknown type is REPORTED, not silently successful — and it must not throw,
// because every call site catches, so a throw would reach nobody.
resetRows();
ROWS.member.push({ ...OWNER });
const unknown = await notifyEvent({ companyId: CO, type: "quote.teleported" });
ok("an unknown type is refused", unknown.created === false, unknown);
ok("and the refusal is named as such rather than as a generic error", unknown.reason === "unknown_type", unknown);
ok("and the refusal is recorded rather than swallowed", globalThis.__FQ_ERRORS.length > 0, globalThis.__FQ_ERRORS);
ok("and still nothing was written", ROWS.notificationEvent.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("7. A second delivery of the same event is a no-op (retried webhook)");
// ═══════════════════════════════════════════════════════════════════════════

resetRows();
ROWS.member.push({ ...OWNER }, { ...ADMIN }, { ...CREW });

const first = await notifyEvent({ companyId: CO, type: "quote.accepted", entityId: "q_dupe", amount: 12400, currency: "CAD" });
ok("the first fan-out delivers to the two eligible members", first.delivered === 2, first);

// Replay the EXACT arguments the product used, rather than arguments written
// here. That difference is the whole test: a hand-written replay that added
// `skipDuplicates: true` itself would pass just as happily against a fan-out
// that had dropped it, which is the false pass this assertion exists to avoid.
const createManyCall = WRITES.find((w) => w.model === "notificationDelivery" && w.action === "createMany");
ok("fan-out went through createMany", Boolean(createManyCall));

let again = null;
let replayThrew = null;
try {
  again = await globalThis.__FQ_DB.notificationDelivery.createMany(createManyCall.args);
} catch (err) {
  replayThrew = err;
}
ok("replaying the same fan-out does not violate the unique index", replayThrew === null, replayThrew?.code);
ok("re-delivering the same event inserts nothing", again?.count === 0, again);
ok("and the owner still has exactly one copy", ROWS.notificationDelivery.filter((d) => d.memberId === "m_owner").length === 1);
ok("fan-out asked for skipDuplicates", createManyCall?.args?.skipDuplicates === true);
ok(
  "fan-out uses createMany, never a create-per-recipient loop",
  !WRITES.some((w) => w.model === "notificationDelivery" && w.action === "create"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("8. Read state does not leak between two companies for one user");
// ═══════════════════════════════════════════════════════════════════════════
//
// The trap User.uiState would have walked into: it is keyed to the USER, so a
// person in two companies would carry one company's read state into the other.
// Read state lives on NotificationDelivery.memberId instead — this proves it.

resetRows();
const CO_B = "co_b";
// ONE person, TWO companies, TWO Member rows, one userId.
const AT_A = { id: "m_a", userId: "u_shared", companyId: CO, role: "owner", active: true, permissions: null };
const AT_B = { id: "m_b", userId: "u_shared", companyId: CO_B, role: "owner", active: true, permissions: null };
ROWS.member.push(AT_A, AT_B);
ROWS.user.push({ id: "u_shared", uiState: {} });

await notifyEvent({ companyId: CO, type: "lead.created", entityId: "l1", params: { leadName: "Ann" } });
await notifyEvent({ companyId: CO_B, type: "lead.created", entityId: "l2", params: { leadName: "Bo" } });

ok("each company delivered one copy", ROWS.notificationDelivery.length === 2);

globalThis.__FQ_SESSION = { id: "m_a", userId: "u_shared", companyId: CO, role: "owner" };
const feedA = await notificationsRoute.GET({ url: "http://x/api/notifications" });
ok("at company A the person sees company A's one notification", feedA.body.notifications.length === 1, feedA.body.notifications);
ok("and the sentence is company A's lead", feedA.body.notifications[0].params.leadName === "Ann");
ok("unread at company A is 1", feedA.body.unread === 1);

// Read it at company A only.
const marked = await readRoute.PATCH({
  url: "http://x/api/notifications/read",
  json: async () => ({ all: true }),
});
ok("marking read at company A marks exactly one row", marked.body.marked === 1, marked.body);

globalThis.__FQ_SESSION = { id: "m_b", userId: "u_shared", companyId: CO_B, role: "owner" };
const feedB = await notificationsRoute.GET({ url: "http://x/api/notifications" });
ok("company B's copy is STILL unread — read state did not cross", feedB.body.unread === 1, feedB.body);
ok("and company B shows only its own notification", feedB.body.notifications.length === 1 && feedB.body.notifications[0].params.leadName === "Bo");

// The same question through /api/ui-state, which is where the bell seeds itself.
const uiB = await uiStateRoute.GET({ url: "http://x/api/ui-state" });
ok("/api/ui-state reports company B's unread count, not the user's total", uiB.body.notifications.unread === 1, uiB.body.notifications);

globalThis.__FQ_SESSION = { id: "m_a", userId: "u_shared", companyId: CO, role: "owner" };
const uiA = await uiStateRoute.GET({ url: "http://x/api/ui-state" });
ok("and company A now reports 0", uiA.body.notifications.unread === 0, uiA.body.notifications);

// ═══════════════════════════════════════════════════════════════════════════
section("9. Mark-as-read cannot touch another member's row");
// ═══════════════════════════════════════════════════════════════════════════

resetRows();
const MINE = { id: "m_mine", userId: "u_mine", companyId: CO, role: "owner", active: true, permissions: null };
const THEIRS = { id: "m_theirs", userId: "u_theirs", companyId: CO, role: "admin", active: true, permissions: null };
const OTHER_TENANT = { id: "m_other", userId: "u_other", companyId: CO_B, role: "owner", active: true, permissions: null };
ROWS.member.push(MINE, THEIRS, OTHER_TENANT);

await notifyEvent({ companyId: CO, type: "lead.created", entityId: "l3", params: { leadName: "Cy" } });
await notifyEvent({ companyId: CO_B, type: "lead.created", entityId: "l4", params: { leadName: "Di" } });

const theirRow = ROWS.notificationDelivery.find((d) => d.memberId === "m_theirs");
const otherRow = ROWS.notificationDelivery.find((d) => d.memberId === "m_other");
ok("fixtures: a colleague and another tenant each have an unread row", Boolean(theirRow) && Boolean(otherRow));

globalThis.__FQ_SESSION = { id: "m_mine", userId: "u_mine", companyId: CO, role: "owner" };
const attack = await readRoute.PATCH({
  url: "http://x/api/notifications/read",
  // A colleague's delivery id and another tenant's delivery id, named directly.
  json: async () => ({ ids: [theirRow.id, otherRow.id] }),
});
ok("naming somebody else's delivery ids marks nothing", attack.body.marked === 0, attack.body);
ok("the colleague's row is still unread", theirRow.readAt === null);
ok("the other tenant's row is still unread", otherRow.readAt === null);

// And the WHERE clause is scoped on all three axes, read off the recorded call
// rather than off the source.
const upd = WRITES.filter((w) => w.model === "notificationDelivery" && w.action === "updateMany").pop();
ok("the update is an updateMany, not an update", upd?.action === "updateMany");
ok("its where names companyId", upd?.args?.where?.companyId === CO, upd?.args?.where);
ok("its where names the caller's own memberId", upd?.args?.where?.memberId === "m_mine", upd?.args?.where);
ok("its where refuses rows already read", upd?.args?.where?.readAt === null);

// The caller's own row still marks fine — the scope narrows, it does not break.
const mineRow = ROWS.notificationDelivery.find((d) => d.memberId === "m_mine");
const legit = await readRoute.PATCH({
  url: "http://x/api/notifications/read",
  json: async () => ({ ids: [mineRow.id] }),
});
ok("my own row still marks read", legit.body.marked === 1 && mineRow.readAt !== null);

// Impersonation is refused outright — non-negotiable #2.
globalThis.__FQ_SESSION = { id: "m_mine", userId: "u_mine", companyId: CO, role: "viewer", impersonation: true };
const support = await readRoute.PATCH({
  url: "http://x/api/notifications/read",
  json: async () => ({ all: true }),
});
ok("a support session cannot mark anything read", support.status === 403, support);

// ═══════════════════════════════════════════════════════════════════════════
section("10. No route accepts a recipient id");
// ═══════════════════════════════════════════════════════════════════════════

resetRows();
ROWS.member.push(MINE, THEIRS);
await notifyEvent({ companyId: CO, type: "lead.created", entityId: "l5", params: { leadName: "Ed" } });
const victim = ROWS.notificationDelivery.find((d) => d.memberId === "m_theirs");

globalThis.__FQ_SESSION = { id: "m_mine", userId: "u_mine", companyId: CO, role: "owner" };
const spoof = await readRoute.PATCH({
  url: "http://x/api/notifications/read",
  // Every name a client might reasonably guess at, all at once.
  json: async () => ({
    all: true,
    memberId: "m_theirs",
    recipientId: "m_theirs",
    recipientMemberId: "m_theirs",
    userId: "u_theirs",
    companyId: CO_B,
  }),
});
const spoofUpdate = WRITES.filter((w) => w.model === "notificationDelivery" && w.action === "updateMany").pop();
ok("a supplied memberId is not used", spoofUpdate?.args?.where?.memberId === "m_mine", spoofUpdate?.args?.where);
ok("a supplied companyId is not used", spoofUpdate?.args?.where?.companyId === CO, spoofUpdate?.args?.where);
ok("the colleague's row is untouched", victim.readAt === null);
ok("only my own row was marked", spoof.body.marked === 1, spoof.body);

// The GET side too: a recipient in the query string must reach nothing.
const spoofGet = await notificationsRoute.GET({
  url: `http://x/api/notifications?memberId=m_theirs&userId=u_theirs&recipientId=m_theirs`,
});
ok(
  "GET ignores every recipient-shaped query parameter",
  spoofGet.body.notifications.length === 1 && spoofGet.body.notifications[0].id !== victim.id,
  spoofGet.body.notifications.map((n) => n.id),
);
// Nothing addressed to this caller means an empty feed, not somebody else's.
ok("the response carries no member or user id back to the client", !JSON.stringify(spoofGet.body).includes("m_theirs") && !JSON.stringify(spoofGet.body).includes("u_mine"));

// ═══════════════════════════════════════════════════════════════════════════
section("11. Money is never inside a stored string");
// ═══════════════════════════════════════════════════════════════════════════

resetRows();
ROWS.member.push({ ...OWNER });
await notifyEvent({
  companyId: CO,
  type: "quote.accepted",
  entityId: "q_hostile",
  amount: 12400,
  currency: "CAD",
  actorUserId: null,
  // A hostile caller trying every shape of smuggling.
  params: {
    quoteNumber: "Q-204",
    clientName: "Ann",
    total: 12400,
    amount: 12400,
    price: "$12,400",
    summary: "Quote Q-204 accepted — $12,400",
    nested: { total: 12400 },
  },
});
const stored = ROWS.notificationEvent[0];
ok("the declared params survive", stored.params.quoteNumber === "Q-204" && stored.params.clientName === "Ann");
ok("`total` was dropped", stored.params.total === undefined);
ok("`amount` was dropped from params", stored.params.amount === undefined);
ok("`price` was dropped", stored.params.price === undefined);
ok("a whole pre-composed summary string was dropped", stored.params.summary === undefined);
ok("a nested object was dropped", stored.params.nested === undefined);
ok("no stored param value contains a currency symbol or a comma-grouped figure", Object.values(stored.params).every((v) => typeof v !== "string" || !/[$€£]|\d,\d{3}/.test(v)), stored.params);
ok("the figure is in its own column", Number(stored.amount) === 12400 && stored.currency === "CAD");

// A non-money type cannot carry one even if the caller passes it.
resetRows();
ROWS.member.push({ ...OWNER }, { ...DISPATCHER });
await notifyEvent({ companyId: CO, type: "leave.requested", entityId: "lv1", amount: 999, currency: "CAD", params: { workerName: "Dana", policyName: "Sick", days: 1, autoApproved: true } });
ok("a non-money type stores no amount, even when handed one", ROWS.notificationEvent[0].amount === null);
ok("and no currency", ROWS.notificationEvent[0].currency === null);

// The schema itself: no title/body/summary column to put a sentence in.
{
  const schema = read("prisma/schema.prisma");
  const start = schema.indexOf("model NotificationEvent {");
  const end = schema.indexOf("\n}", start);
  const model = schema.slice(start, end);
  ok("NotificationEvent exists in the schema", start > -1);
  ok("NotificationEvent has no `title` column", !/^\s*title\s+/m.test(model));
  ok("NotificationEvent has no `body` column", !/^\s*body\s+/m.test(model));
  ok("NotificationEvent has no `summary` column", !/^\s*summary\s+/m.test(model));
  ok("NotificationEvent stores the figure in its own column", /^\s*amount\s+Decimal\?/m.test(model));

  const dStart = schema.indexOf("model NotificationDelivery {");
  const dEnd = schema.indexOf("\n}", dStart);
  const delivery = schema.slice(dStart, dEnd);
  ok("NotificationDelivery keys read state to memberId, not userId", /^\s*memberId\s+String/m.test(delivery) && !/^\s*userId\s+String/m.test(delivery));
  ok("NotificationDelivery carries @@unique([eventId, memberId])", /@@unique\(\[eventId, memberId\]\)/.test(delivery));

  // The dead field this change removed.
  const rStart = schema.indexOf("model NotificationRule {");
  const rEnd = schema.indexOf("\n}", rStart);
  ok("NotificationRule.channel is gone — it was written and read by nothing", !/^\s*channel\s+/m.test(schema.slice(rStart, rEnd)));
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The structural claims, each scoped to ONE brace-matched function");
// ═══════════════════════════════════════════════════════════════════════════
//
// A whole-file `includes` passes as soon as a string appears anywhere,
// including in the comment saying it must not appear. And
// `src.indexOf(a) < src.indexOf(b)` false-passes when `a` is absent, because
// indexOf returns -1. So: slice the named function out first, and assert only
// inside the slice.

/** The body of `name`, brace-matched from its declaration. */
function functionBody(src, name) {
  const decl = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = decl.exec(src);
  if (!m) return null;
  // Step over the PARAMETER LIST first. Both functions asserted on below take a
  // destructured object, so `indexOf("{")` from the declaration finds the
  // parameter's own brace and returns a "body" that is really the signature —
  // which is how a scoped rule quietly stops being scoped to anything.
  let paren = 0;
  let i = m.index + m[0].length - 1;
  for (; i < src.length; i++) {
    if (src[i] === "(") paren++;
    else if (src[i] === ")" && --paren === 0) break;
  }
  const open = src.indexOf("{", i);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

/** Comments blanked, so prose about a rule is never read as the rule. */
function decomment(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

{
  const notifySrc = decomment(read("lib/notifications/notify.js"));
  const body = functionBody(notifySrc, "notifyEvent");
  ok("notifyEvent's body was located (the slice is real, not an empty string)", Boolean(body) && body.length > 200);
  // The double-notify rule, made structural: v1 adds no channel, so there is
  // nothing that could send a second copy of an email that already goes.
  ok("notifyEvent sends no email", !/sendEmail|resend|mailer/i.test(body));
  ok("notifyEvent sends no SMS", !/sendSms|twilio|chargeOutboundCrewReply/i.test(body));
  ok("notifyEvent resolves recipients through the one resolver", /resolveRecipients\s*\(/.test(body));
  ok("notifyEvent names no role of its own", !/"owner"|'owner'|"admin"|'admin'|supervisor/.test(body));

  const paramsBody = functionBody(notifySrc, "safeParams");
  ok("safeParams's body was located", Boolean(paramsBody) && paramsBody.length > 100);
  ok("safeParams iterates the ALLOWED list, not the caller's keys", /for\s*\(\s*const\s+key\s+of\s+allowed\s*\)/.test(paramsBody), paramsBody?.slice(0, 200));
}

{
  const recipientsSrc = decomment(read("lib/notifications/recipients.js"));
  const body = functionBody(recipientsSrc, "selectRecipients");
  ok("selectRecipients's body was located", Boolean(body) && body.length > 200);
  ok("selectRecipients names exactly one role, and it is the catalog's supervisor flag", (body.match(/"(owner|admin|supervisor|employee)"/g) || []).join(",") === '"supervisor"', (body.match(/"(owner|admin|supervisor|employee)"/g) || []));
  ok("selectRecipients decides through satisfiesAudience", /satisfiesAudience\s*\(/.test(body));
}

{
  const readSrc = decomment(read("app/api/notifications/read/route.js"));
  const body = functionBody(readSrc, "PATCH");
  ok("the PATCH handler's body was located", Boolean(body) && body.length > 200);
  ok("mark-as-read uses updateMany", /updateMany\s*\(/.test(body));
  ok("and never a bare update", !/\.\s*update\s*\(/.test(body));
  ok("its where names companyId", /companyId:\s*member\.companyId/.test(body));
  ok("its where names the caller's own member id", /memberId:\s*member\.id/.test(body));
  // The recipient-id rule, structurally: the handler must never read one off
  // the body. `body?.ids` and `body?.all` are the only two things it takes.
  ok("the handler reads no recipient id from the request body", !/body\??\.(memberId|recipientId|recipientMemberId|userId)/.test(body), body.match(/body\??\.[A-Za-z]+/g));
  ok("impersonation is refused here as well as in middleware", /member\.impersonation/.test(body));
}

{
  const getSrc = decomment(read("app/api/notifications/route.js"));
  const body = functionBody(getSrc, "GET");
  ok("the GET handler's body was located", Boolean(body) && body.length > 200);
  ok("every query names companyId", (body.match(/companyId:\s*member\.companyId/g) || []).length >= 2);
  ok("every query names the caller's own member id", (body.match(/memberId:\s*member\.id/g) || []).length >= 2);
  ok("GET reads no recipient id from the query string", !/searchParams\.get\(\s*["'](memberId|userId|recipientId)/.test(body));
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. The six emit call sites exist and are fire-and-forget");
// ═══════════════════════════════════════════════════════════════════════════
//
// Structural, and weaker than everything above — this reads source rather than
// running the webhook. It is here because "a route with no caller" is a
// documented failure class in this repo (three features shipped unreachable),
// and a feed whose emitters are never called is that failure exactly.

const CALL_SITES = [
  ["lib/stripe/settleChargeEvent.js", "notifyChargeEvent", "chargeback / refund"],
  ["app/api/public/quotes/[token]/route.js", '"quote.accepted"', "quote accepted"],
  ["lib/invoices/recordStripePayment.js", '"invoice.paid"', "invoice paid"],
  ["lib/leads/createLead.js", '"lead.created"', "new enquiry (all six inbound sources)"],
  ["app/api/leave/route.js", '"leave.requested"', "leave requested"],
  ["lib/estimate/createEstimateQuote.js", '"quote.needsReview"', "estimate awaiting sign-off"],
];

for (const [file, needle, label] of CALL_SITES) {
  const src = decomment(read(file));
  ok(`${label} is emitted from ${file}`, src.includes(needle));
  // Fire-and-forget: never awaited, always caught. An awaited notification
  // inside a Stripe webhook is a retried charge.
  const line = src.split("\n").find((l) => l.includes(needle.replace(/"/g, "")) || l.includes(needle));
  ok(`${label} is not awaited`, !/\bawait\s+notify/.test(src.slice(Math.max(0, src.indexOf(needle) - 200), src.indexOf(needle) + 400)), line?.trim());
}

// "New enquiry" is ONE hook, not six. If a second lead emitter appears, the
// audit's whole reason for putting it in createLead has been undone.
{
  const emitters = CALL_SITES.map(([f]) => f);
  const stray = [];
  for (const file of ["app/api/self-quote/route.js", "app/api/self-quote/kitchen/route.js", "app/api/leads/public/route.js", "app/api/portal/[token]/request/route.js"]) {
    if (decomment(read(file)).includes('"lead.created"')) stray.push(file);
  }
  ok("new enquiry is emitted from exactly one place", stray.length === 0, stray);
  ok("and that place is lib/leads/createLead.js", emitters.includes("lib/leads/createLead.js"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. Where a feed row goes when it is tapped");
// ═══════════════════════════════════════════════════════════════════════════

ok("a quote row opens the quote", hrefFor({ entityType: "quote", entityId: "q1" }) === "/app/quotes/q1");
ok("an invoice row opens the invoice", hrefFor({ entityType: "invoice", entityId: "i1" }) === "/app/invoices/i1");
ok("a leave row opens the time-off screen", hrefFor({ entityType: "leave", entityId: "l1" }) === "/app/time-off");
ok("a row with no entity is text, not a dead link", hrefFor({ entityType: "quote", entityId: null }) === null);
ok("an unknown entity type is a dead link rather than a guessed URL", hrefFor({ entityType: "spaceship", entityId: "x" }) === null);

// Every catalog entityType resolves to something, or the row is deliberately
// text — a type whose entityType nothing handles would render as plain text
// forever with nobody noticing.
for (const type of NOTIFICATION_TYPE_KEYS) {
  const et = NOTIFICATION_TYPES[type].entityType;
  ok(`"${type}" (entityType ${et}) resolves to a destination`, hrefFor({ entityType: et, entityId: "x" }) !== null, et);
}

// ═══════════════════════════════════════════════════════════════════════════
section("15. The supervisor decision is one line, and it is the conservative one");
// ═══════════════════════════════════════════════════════════════════════════

for (const type of MONEY_TYPES) {
  ok(`"${type}" excludes supervisors (open product question, answered conservatively)`, supervisorsIncluded(type) === false);
}
for (const type of NOTIFICATION_TYPE_KEYS.filter((t) => !NOTIFICATION_TYPES[t].money)) {
  ok(`"${type}" includes supervisors — the audience the owner named first`, supervisorsIncluded(type) === true);
}
ok(
  "flipping the flag is genuinely all it takes: a Manager qualifies on the grid alone",
  satisfiesAudience(MANAGER, NOTIFICATION_TYPES["quote.accepted"].audience, { requiresMoneySight: true }) === true,
);

// ═══════════════════════════════════════════════════════════════════════════
section("16. Every catalog type has an English AND a French sentence");
// ═══════════════════════════════════════════════════════════════════════════
//
// The sentence is assembled at READ time from the reader's own catalogue, so a
// type with no string renders its own key on screen. check:translations proves
// French completeness globally; this pins it to the feed, and also proves the
// key NAMES match the catalog — a mismatch is invisible to a coverage count.

{
  const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
  for (const type of NOTIFICATION_TYPE_KEYS) {
    const key = `app.notif.type.${type}`;
    ok(`${key} has English`, typeof APP_MESSAGES.en[key] === "string");
    ok(`${key} has French`, typeof APP_MESSAGES.fr[key] === "string");
    // Money never appears in a template either — the figure is rendered from
    // the `amount` the server decided to send, on its own line.
    ok(`${key} interpolates no money placeholder`, !/\{(amount|total|price|value)\}/.test(APP_MESSAGES.en[key]));
  }
  // And the placeholders a template asks for are ones the catalog declares.
  for (const type of NOTIFICATION_TYPE_KEYS) {
    const template = APP_MESSAGES.en[`app.notif.type.${type}`] || "";
    const wanted = [...template.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
    const declared = NOTIFICATION_TYPES[type].params;
    ok(
      `"${type}" only interpolates declared params`,
      wanted.every((w) => declared.includes(w)),
      { wanted, declared },
    );
  }

  // ── No param may be stored and rendered by nothing ─────────────────────
  //
  // This is failure class #1 turned into an assertion. Every key a type
  // declares must either be interpolated by the sentence or consumed by
  // noteKeysFor's secondary line. `NotificationRule.channel` was exactly this
  // fault — written by two handlers, read by none — and it sat in the table
  // this feature extends, so the feed does not get to reintroduce it.
  for (const type of NOTIFICATION_TYPE_KEYS) {
    const template = APP_MESSAGES.en[`app.notif.type.${type}`] || "";
    const interpolated = [...template.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
    const unrendered = NOTIFICATION_TYPES[type].params.filter(
      (k) => !interpolated.includes(k) && !NOTE_PARAMS.includes(k),
    );
    ok(`"${type}" declares no param that nothing renders`, unrendered.length === 0, unrendered);
  }

  // And every key noteKeysFor can produce has both languages, or the note line
  // prints its own key at somebody.
  const NOTE_SAMPLES = [
    { kind: "refund" },
    { kind: "dispute" },
    { settled: true },
    { settled: false },
    { autoApproved: true },
    { autoApproved: false },
    { fromCall: true },
    { fromCall: false },
    { temperature: "hot" },
    { temperature: "warm" },
    { temperature: "cold" },
  ];
  const noteKeys = new Set(NOTE_SAMPLES.flatMap((params) => noteKeysFor({ params })));
  ok("every NOTE_PARAMS value produces a key", noteKeys.size === NOTE_SAMPLES.length, [...noteKeys]);
  for (const key of noteKeys) {
    ok(`${key} has English and French`, typeof APP_MESSAGES.en[key] === "string" && typeof APP_MESSAGES.fr[key] === "string");
  }
  // A value outside the closed vocabulary produces NOTHING rather than a raw
  // token on screen — which is why `source` and `estimateSource` are not params.
  ok("an unknown temperature renders no note", noteKeysFor({ params: { temperature: "lukewarm" } }).length === 0);
  ok("an unknown kind renders no note", noteKeysFor({ params: { kind: "clawback" } }).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
