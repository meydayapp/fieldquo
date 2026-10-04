// scripts/check-new-seed-notice.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-new-seed-notice.mjs
//
// Executes lib/services/newSeedNotice.js — the "N new services for your
// trade" notice — against fixtures and a stub database: the count is what
// "Add missing services for my trade" would add (never a takeoff-priced
// reference row, a shared service once), only owners and admins are told,
// each in their own language with the trade's name in it, nobody twice, and
// nothing ever writes a Product.
import fs from "node:fs";
import { newSeedKeysFor, planCompanyNotice, planNewSeedNotices, tradeLabelIn, joinTrades, readerLanguage, announceableKeys, NEW_SEEDS_TYPE, NEW_SEEDS_RELEASE, NEW_SEEDS_RELEASES } from "@/lib/services/newSeedNotice";
import { serviceSeedsForCompanyTrade, seedableServices, seededTrades } from "@/lib/services/seeds";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { typeMeta } from "@/lib/notifications/catalog";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let passed = 0;
let failed = 0;
function ok(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}${detail !== undefined ? `  got: ${JSON.stringify(detail)}` : ""}`);
  }
}

// ── The count is the button's count ───────────────────────────────────────
const plumbing = serviceSeedsForCompanyTrade("plumbing");
ok("plumbing ships a seed", Boolean(plumbing));
{
  const r = newSeedKeysFor({ tradeKeys: ["plumbing"], existingSeedKeys: [] });
  ok("a company holding nothing is told every seedable plumbing service", r.total === seedableServices(plumbing).length, r.total);
  const all = seedableServices(plumbing).map((s) => s.seedKey);
  ok("a company holding every key is told nothing", newSeedKeysFor({ tradeKeys: ["plumbing"], existingSeedKeys: all }).total === 0);
  const r2 = newSeedKeysFor({ tradeKeys: ["plumbing"], existingSeedKeys: all.slice(3) });
  ok("holding all but three → three", r2.total === 3 && r2.byTrade[0].keys.length === 3, r2.total);
}
{
  const paint = serviceSeedsForCompanyTrade("interior_painting");
  const priced = paint.services.filter((s) => s.pricedBy).length;
  const r = newSeedKeysFor({ tradeKeys: ["interior_painting"] });
  ok("takeoff-priced reference rows are never counted (the button never adds them)", priced > 0 && r.total === paint.services.length - priced, { total: r.total, priced });
}
{
  // A service shared by two trades is one Product row — counted once.
  let pair = null;
  const trades = seededTrades();
  outer: for (const a of trades) {
    const ka = new Set(seedableServices(serviceSeedsForCompanyTrade(a)).map((s) => s.seedKey));
    for (const b of trades) {
      if (a === b) continue;
      if (seedableServices(serviceSeedsForCompanyTrade(b)).some((s) => ka.has(s.seedKey))) {
        pair = [a, b];
        break outer;
      }
    }
  }
  ok("the seeds carry at least one service shared by two trades", Boolean(pair));
  if (pair) {
    const union = new Set(pair.flatMap((t) => seedableServices(serviceSeedsForCompanyTrade(t)).map((s) => s.seedKey)));
    const r = newSeedKeysFor({ tradeKeys: pair });
    const sumPerTrade = r.byTrade.reduce((n, t) => n + t.keys.length, 0);
    ok(`a shared service counts once across ${pair.join(" + ")}`, r.total === union.size && sumPerTrade > r.total, { total: r.total, union: union.size, sumPerTrade });
  }
}
for (const bad of ["custom_abc123", "__proto__", "constructor", "", null, undefined, "stairs"]) {
  ok(`a trade with no seed (${JSON.stringify(bad)}) adds nothing`, newSeedKeysFor({ tradeKeys: [bad] }).total === 0);
}
ok("a repeated trade is one trade", newSeedKeysFor({ tradeKeys: ["plumbing", "plumbing"] }).byTrade.length === 1);
ok("hostile inputs do not throw", newSeedKeysFor({ tradeKeys: "plumbing", existingSeedKeys: "x" }).total === 0);

// ── Language ──────────────────────────────────────────────────────────────
ok("reader's own language first", readerLanguage("fr", "en") === "fr");
ok("company default when the user has none", readerLanguage(null, "es") === "es");
ok("English when neither is stated", readerLanguage(null, null) === "en");
const PLUMB = { key: "plumbing", label: "Plumbing", labelTranslations: { fr: "Plomberie", es: "Plomería" } };
const ELEC = { key: "electrical", label: "Electrical", labelTranslations: { fr: "Électricité" } };
ok("trade name in the reader's language", tradeLabelIn(PLUMB, "fr") === "Plomberie");
ok("trade name falls back to the English label, never blank", tradeLabelIn(ELEC, "es") === "Electrical");
ok("a blank translation is not a name", tradeLabelIn({ key: "x", label: "X", labelTranslations: { fr: "  " } }, "fr") === "X");
ok("lists join in the reader's grammar (fr)", joinTrades(["Plomberie", "Électricité"], "fr") === "Plomberie et Électricité", joinTrades(["Plomberie", "Électricité"], "fr"));
ok("a bad locale still joins", joinTrades(["A", "B"], "zz-bogus-!!") !== "");

// ── Who is told ───────────────────────────────────────────────────────────
const person = (id, role, preset, extra = {}) => ({
  id,
  userId: `u_${id}`,
  role,
  active: true,
  permissions: preset ? { ...PERMISSION_PRESETS[preset].values } : null,
  language: null,
  ...extra,
});
const CAST = [
  person("m_owner", "owner", null),
  person("m_admin", "admin", null, { language: "es" }),
  person("m_manager", "supervisor", "manager"),
  person("m_dispatcher", "supervisor", "dispatcher"),
  person("m_estimator", "employee", "estimator"),
  person("m_crew", "employee", "worker"),
  person("m_inactive_admin", "admin", null, { active: false }),
  person("m_no_user", "owner", null, { userId: null }),
];
const COMPANY = { id: "co_a", name: "Plomberie A", defaultLanguage: "fr", categories: [PLUMB, ELEC] };
const plan = planCompanyNotice({ company: COMPANY, seedKeys: [], members: CAST });
ok("a company with new services gets a plan", Boolean(plan));
const told = plan ? plan.groups.flatMap((g) => g.memberIds).sort() : [];
ok("only the active owner and admin with a login are told", JSON.stringify(told) === JSON.stringify(["m_admin", "m_owner"]), told);
const fr = plan?.groups.find((g) => g.language === "fr");
const es = plan?.groups.find((g) => g.language === "es");
ok("the owner (no stated language) reads the company's French", fr && fr.memberIds.join() === "m_owner");
ok("the admin reads their own Spanish", es && es.memberIds.join() === "m_admin");
ok("French group names the trades in French", fr && fr.params.trades === "Plomberie et Électricité", fr?.params.trades);
ok("Spanish group falls back per trade, never blank", es && es.params.trades === "Plomería y Electrical", es?.params.trades);
ok("every group carries the same count", plan && plan.groups.every((g) => g.params.count === plan.total));
ok("params are exactly what the catalog declares", plan && plan.groups.every((g) => JSON.stringify(Object.keys(g.params).sort()) === JSON.stringify([...typeMeta(NEW_SEEDS_TYPE).params].sort())));
ok("each member is in exactly one group", plan && new Set(told).size === told.length);

const again = planCompanyNotice({ company: COMPANY, seedKeys: [], members: CAST, alreadyTold: new Set(["m_owner"]) });
ok("a member already told is not told again", again && again.groups.flatMap((g) => g.memberIds).join() === "m_admin");
ok("everyone told → no plan", planCompanyNotice({ company: COMPANY, seedKeys: [], members: CAST, alreadyTold: new Set(["m_owner", "m_admin"]) }) === null);
ok("no owner or admin → no plan", planCompanyNotice({ company: COMPANY, seedKeys: [], members: CAST.slice(2) }) === null);
ok("nothing new → no plan", planCompanyNotice({ company: { ...COMPANY, categories: [{ key: "stairs", label: "Stairs" }] }, members: CAST }) === null);

// ── The sentence exists in every app language and interpolates both params ─
for (const lang of Object.keys(APP_MESSAGES)) {
  const s = APP_MESSAGES[lang][`app.notif.type.${NEW_SEEDS_TYPE}`];
  ok(`the notice reads in ${lang}`, typeof s === "string" && s.includes("{trades}") && s.includes("{count}"), s);
}

// ── The database half, against a stub ─────────────────────────────────────
{
  const calls = [];
  const stub = {
    company: {
      findMany: async (q) => {
        calls.push(["company", q]);
        return [
          { id: "co_a", name: "A", defaultLanguage: "fr", serviceCategories: [{ category: PLUMB }] },
          { id: "co_b", name: "B", defaultLanguage: "en", serviceCategories: [{ category: PLUMB }] },
        ];
      },
    },
    product: {
      findMany: async (q) => {
        calls.push(["product", q]);
        return seedableServices(plumbing).map((s) => ({ companyId: "co_b", seedKey: s.seedKey }));
      },
    },
    member: {
      findMany: async () => [
        { ...person("a_owner", "owner", null), companyId: "co_a", user: { language: "fr" } },
        { ...person("a_admin", "admin", null), companyId: "co_a", user: { language: null } },
        { ...person("b_owner", "owner", null), companyId: "co_b", user: { language: "en" } },
      ],
    },
    notificationDelivery: {
      findMany: async (q) => {
        calls.push(["delivery", q]);
        return [{ memberId: "a_admin", companyId: "co_a", event: { entityId: NEW_SEEDS_RELEASE } }];
      },
    },
  };
  const plans = await planNewSeedNotices({ db: stub });
  const companyQ = calls.find((c) => c[0] === "company")?.[1];
  ok("demo companies are excluded in the query", companyQ?.where?.isDemo === false);
  ok("only ENABLED trades are read", companyQ?.select?.serviceCategories?.where?.enabled === true);
  const deliveryQ = calls.find((c) => c[0] === "delivery")?.[1];
  ok("the marker is this type, read across every release (to know what a company was already told)",
    deliveryQ?.where?.event?.type === NEW_SEEDS_TYPE &&
      JSON.stringify(deliveryQ?.where?.event?.entityId?.in) === JSON.stringify(NEW_SEEDS_RELEASES.map((r) => r.id)) &&
      deliveryQ?.select?.event?.select?.entityId === true && deliveryQ?.select?.companyId === true);
  ok("a company holding every key is not planned", !plans.some((p) => p.companyId === "co_b"));
  const a = plans.find((p) => p.companyId === "co_a");
  ok("the member already told is skipped, the other is planned", a && a.groups.flatMap((g) => g.memberIds).join() === "a_owner");
}

// ── Releases: the handyman rows are announced once, and only they are new ──
{
  const HANDYMAN_KEYS = NEW_SEEDS_RELEASES.find((r) => r.id === NEW_SEEDS_RELEASE)?.keys || [];
  ok("the current release is the handyman one, after 2026-09-24", NEW_SEEDS_RELEASE === "service-seeds-2026-09-25-handyman" && NEW_SEEDS_RELEASES[0].id === "service-seeds-2026-09-24" && NEW_SEEDS_RELEASES[0].keys === null);
  ok("it announces the twelve rows 40d8375b6 added", HANDYMAN_KEYS.length === 12 && new Set(HANDYMAN_KEYS).size === 12);
  const handyman = serviceSeedsForCompanyTrade("handyman");
  const handymanSeedable = new Set(seedableServices(handyman).map((x) => x.seedKey));
  ok("every announced key is a live, seedable handyman row (the button would add it)", HANDYMAN_KEYS.every((k) => handymanSeedable.has(k)), HANDYMAN_KEYS.filter((k) => !handymanSeedable.has(k)));
  ok("release ids are unique", new Set(NEW_SEEDS_RELEASES.map((r) => r.id)).size === NEW_SEEDS_RELEASES.length);

  ok("never told → no restriction (everything the button would add)", announceableKeys(null) === null);
  ok("told 09-24 → only the keys introduced since", announceableKeys("service-seeds-2026-09-24") instanceof Set && [...announceableKeys("service-seeds-2026-09-24")].join() === HANDYMAN_KEYS.join());
  ok("told the current release → nothing left to announce", announceableKeys(NEW_SEEDS_RELEASE)?.size === 0);
  ok("an unknown release id counts as never told", announceableKeys("bogus") === null);

  const HANDY = { key: "handyman", label: "Handyman", labelTranslations: { fr: "Homme à tout faire" } };
  const allHandyman = [...handymanSeedable];
  const oldOnly = allHandyman.filter((k) => !HANDYMAN_KEYS.includes(k));
  const owner = [person("h_owner", "owner", null)];
  // Told on 09-24, holds none of the handyman book: hears about the 12 only,
  // never the old rows again as "new".
  const told = planCompanyNotice({ company: { id: "co_h", name: "H", defaultLanguage: "en", categories: [HANDY] }, seedKeys: [], members: owner, onlyKeys: announceableKeys("service-seeds-2026-09-24") });
  ok("a company told on 09-24 is told about exactly the 12 handyman rows", told?.total === 12 && told.groups[0].params.count === 12, told?.total);
  // Never told: the full count, as the first release would have.
  const never = planCompanyNotice({ company: { id: "co_n", name: "N", defaultLanguage: "en", categories: [HANDY] }, seedKeys: [], members: owner, onlyKeys: announceableKeys(null) });
  ok("a company never told hears every row the button would add", never?.total === newSeedKeysFor({ tradeKeys: ["handyman"] }).total && never.total > 12);
  // Holds the old rows, lacks the new: 12 either way.
  const upToDate = planCompanyNotice({ company: { id: "co_u", name: "U", defaultLanguage: "en", categories: [HANDY] }, seedKeys: oldOnly, members: owner, onlyKeys: announceableKeys(null) });
  ok("a company holding the old book and not the new is told 12", upToDate?.total === 12);
  // Already holds the 12 (added by hand): nothing to say.
  ok("a company already holding the 12 is told nothing", planCompanyNotice({ company: { id: "co_d", name: "D", defaultLanguage: "en", categories: [HANDY] }, seedKeys: HANDYMAN_KEYS, members: owner, onlyKeys: announceableKeys("service-seeds-2026-09-24") }) === null);
  // A trade the 12 are not tagged for, told 09-24: nothing new for it.
  ok("a plumber told on 09-24 is not told again", planCompanyNotice({ company: { id: "co_p", name: "P", defaultLanguage: "en", categories: [PLUMB] }, seedKeys: [], members: owner, onlyKeys: announceableKeys("service-seeds-2026-09-24") }) === null);

  // The database half: the newest release a company was told about decides.
  const stub = {
    company: { findMany: async () => [
      { id: "co_told", name: "Told", defaultLanguage: "en", serviceCategories: [{ category: HANDY }] },
      { id: "co_new", name: "New", defaultLanguage: "en", serviceCategories: [{ category: HANDY }] },
      { id: "co_done", name: "Done", defaultLanguage: "en", serviceCategories: [{ category: HANDY }] },
    ] },
    product: { findMany: async () => [] },
    member: { findMany: async () => [
      { ...person("t_owner", "owner", null), companyId: "co_told", user: { language: "en" } },
      { ...person("n_owner", "owner", null), companyId: "co_new", user: { language: "en" } },
      { ...person("d_owner", "owner", null), companyId: "co_done", user: { language: "en" } },
    ] },
    notificationDelivery: { findMany: async () => [
      { memberId: "t_owner", companyId: "co_told", event: { entityId: "service-seeds-2026-09-24" } },
      { memberId: "d_owner", companyId: "co_done", event: { entityId: "service-seeds-2026-09-24" } },
      { memberId: "d_owner", companyId: "co_done", event: { entityId: NEW_SEEDS_RELEASE } },
    ] },
  };
  const plans = await planNewSeedNotices({ db: stub });
  ok("planner: told on 09-24 → the 12", plans.find((p) => p.companyId === "co_told")?.total === 12);
  ok("planner: never told → the whole book", plans.find((p) => p.companyId === "co_new")?.total === newSeedKeysFor({ tradeKeys: ["handyman"] }).total);
  ok("planner: already told this release → not planned (once)", !plans.some((p) => p.companyId === "co_done"));
}

// ── It tells; it never adds ───────────────────────────────────────────────
{
  const lib = fs.readFileSync("lib/services/newSeedNotice.js", "utf8").replace(/\/\/[^\n]*/g, "");
  ok("the planner writes nothing", !/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/.test(lib));
  const script = fs.readFileSync("scripts/notify-new-service-seeds.mjs", "utf8").replace(/\/\/[^\n]*/g, "");
  ok("the script writes no Product", !/product\.(create|createMany|update|upsert)/.test(script) && !/seedServicesForTrade/.test(script));
  ok("the script is a dry run unless --send", /const send = process\.argv\.includes\("--send"\)/.test(script));
  const sendAt = script.indexOf("if (send)");
  const notifyAt = script.indexOf("await notifyEvent(");
  ok("notifyEvent is called only inside `if (send)`", sendAt > -1 && notifyAt > sendAt && script.indexOf("notifyEvent(") === notifyAt + "await ".length);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
