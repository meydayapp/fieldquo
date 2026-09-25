// scripts/check-signup-creating.mjs
//
// The signup progress screen: the owner pressed "Start my free trial", saw a
// pause before the dashboard, and asked for a real progress bar (2026-09-25).
// This check holds the screen to "real":
//
//   A. the stage plan, from hostile category input
//   B. each stage, run against seeders that throw, throw synchronously, or are
//      missing — a failure is reported, never thrown, and never costs the
//      neighbouring seeder
//   C. who may run the stages (owner, fresh company only)
//   D. the per-company lock: a second run while one is going is told "busy"
//   E. the REAL POST /api/signup/setup, executed with the REAL seeders against
//      an in-memory database (scripts/fixtures/signupSetupDb.mjs): the event
//      stream, a stage failure recorded on /platform/errors, "busy", the
//      refusals — and a second run creates NOTHING (idempotent)
//   F. the browser's run (lib/signup/creatingProgress.js) against a hanging
//      company POST, a Retry after it (no second company), a first-attempt
//      409, a stalled stream, a stream cut short, busy-then-done, a failed
//      stage and its Retry — the bar never moves on a timer and never goes
//      backwards
//   G. the component's wiring: progressbar value = completed/total, the live
//      region, the timeout message, Retry / Back / Continue, reduced motion
//   H. the page and the route are wired to all of the above, and every
//      string exists in the nine app languages
//
// Bundled with esbuild (JSX; `@/lib/db` → signupSetupDb, `@/lib/auth` →
// authStub) — see the package.json script.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { state, resetSignupSetupDb } from "@/lib/db";
import { authStub } from "@/lib/auth";
import {
  planSetupStages,
  publicStage,
  runSetupStage,
  runSetupInline,
  setupStagesAllowed,
  withSetupLock,
  SETUP_WINDOW_MS,
} from "@/lib/signup/setupStages";
import {
  CREATING_TIMEOUTS,
  adoptServerPlan,
  applyStageEvent,
  currentStage,
  initialStages,
  progressOf,
  readNdjson,
  runSignupCreation,
  withDeadline,
} from "@/lib/signup/creatingProgress";
import SignupCreating, { problemText, stageLabel } from "@/app/components/auth/SignupCreating";
import { POST as setupPOST } from "@/app/api/signup/setup/route";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(label + (detail !== undefined ? ` — ${String(detail).slice(0, 300)}` : ""));
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${String(detail).slice(0, 300)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);
const read = (p) => readFileSync(p, "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const render = (node, lang = "en") => renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: lang }, node));
const textOf = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const en = (key, params = {}) => String(APP_MESSAGES.en[key] || "").replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
const tEn = (key, fallback, params) => {
  const s = APP_MESSAGES.en[key] ?? (typeof fallback === "string" ? fallback : key);
  const p = typeof fallback === "object" ? fallback : params || {};
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (k in p ? String(p[k]) : `{${k}}`));
};

// ── Tiny fakes for the browser run ───────────────────────────────────────────
const enc = new TextEncoder();
function streamResponse(chunks, { hangAfter = false, status = 200 } = {}) {
  let i = 0;
  let cancelled = false;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => null,
    body: {
      getReader: () => ({
        read: () => {
          if (cancelled) return Promise.resolve({ done: true });
          if (i < chunks.length) return Promise.resolve({ value: enc.encode(chunks[i++]), done: false });
          if (hangAfter) return new Promise(() => {});
          return Promise.resolve({ done: true });
        },
        cancel: () => {
          cancelled = true;
        },
      }),
    },
  };
}
const jsonResponse = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const lines = (...events) => events.map((e) => `${JSON.stringify(e)}\n`).join("");
const FAST = { ...CREATING_TIMEOUTS, companyMs: 25, setupIdleMs: 25, setupTotalMs: 400, busyRetryMs: 1 };
const TRADES = [
  { id: "cat_int", label: "Interior Painting" },
  { id: "cat_ext", label: "Exterior Painting" },
];
const SERVER_PLAN = [
  { key: "services:cat_int", kind: "services", categoryId: "cat_int", label: "Interior Painting" },
  { key: "services:cat_ext", kind: "services", categoryId: "cat_ext", label: "Exterior Painting" },
  { key: "checklists", kind: "checklists" },
  { key: "templates", kind: "templates" },
];
const happyStream = () =>
  lines(
    { type: "plan", stages: SERVER_PLAN },
    ...SERVER_PLAN.flatMap((s) => [
      { type: "stage", key: s.key, status: "active" },
      { type: "stage", key: s.key, status: "done" },
    ]),
    { type: "complete", failed: [] },
  );

async function main() {
  // ══ A. The stage plan ══════════════════════════════════════════════════════
  section("A. The stage plan is built from real trades only");
  {
    const hostile = [
      null,
      undefined,
      7,
      "cat_x",
      {},
      { id: "", key: "painting" },
      { id: "cat_a", key: "" },
      { id: 5, key: "painting" },
      { id: "cat_a", key: "interior_painting", label: "Interior" },
      { id: "cat_a", key: "interior_painting", label: "Duplicate" },
      { id: "__proto__", key: "__proto__", label: 9 },
      { id: "cat_b", key: "exterior_painting", label: "<b>Exterior</b>" },
    ];
    const plan = planSetupStages(hostile);
    const keys = plan.map((s) => s.key);
    ok("only entries with a string id AND key make a services stage, once each", keys.filter((k) => k.startsWith("services:")).join(",") === "services:cat_a,services:__proto__,services:cat_b", keys.join(","));
    ok("a non-string label becomes empty, never a number on screen", plan.find((s) => s.key === "services:__proto__")?.label === "");
    ok("the checklists come after every trade's services (plans link services)", keys.indexOf("checklists") > Math.max(...keys.map((k, i) => (k.startsWith("services:") ? i : -1))));
    ok("templates last", keys[keys.length - 1] === "templates");
    ok("the checklists stage carries every trade", plan.find((s) => s.key === "checklists").trades.length === 3);
    ok("non-array input → just checklists + templates", planSetupStages(null).map((s) => s.key).join(",") === "checklists,templates" && planSetupStages("x").length === 2);
    const pub = publicStage(plan[0]);
    ok("the browser is told key/kind/categoryId/label — no category key, no trade list", JSON.stringify(Object.keys(pub).sort()) === JSON.stringify(["categoryId", "key", "kind", "label"]) && !("trades" in publicStage(plan.find((s) => s.key === "checklists"))));
  }

  // ══ B. Each stage against hostile seeders ══════════════════════════════════
  section("B. A stage reports failure — never throws, never costs its neighbour");
  {
    const calls = [];
    const good = {
      seedStandardAddOns: async (t) => (calls.push(["addons", t.categoryKey]), { created: 2 }),
      seedServicesForTrade: async (t, opts) => (calls.push(["services", t.categoryKey, opts]), { created: 5 }),
      seedChecklistTemplatesForTrade: async (t) => (calls.push(["checklists", t.categoryKey]), { created: 1 }),
      seedPlanTemplatesForTrade: async (t) => (calls.push(["plans", t.categoryKey]), { created: 1 }),
      seedDefaultTemplates: async () => (calls.push(["templates"]), 1),
      ensureDefaultFollowUps: async (client, id) => (calls.push(["followups", client === "CLIENT", id]), 3),
    };
    const [svc, chk, tpl] = planSetupStages([{ id: "c1", key: "plumbing" }, { id: "c2", key: "hvac" }]).filter((s, i) => i === 0 || s.kind !== "services");
    let r = await runSetupStage(svc, { companyId: "co", client: "CLIENT", seeders: good });
    ok("services stage succeeds and counts", r.ok && r.detail.addOns === 2 && r.detail.services === 5, JSON.stringify(r));
    const svcCall = calls.find((c) => c[0] === "services");
    ok("…the trade's services are seeded WITHOUT their checklists/plans (those are their own stage)", svcCall && svcCall[2]?.checklists === false && svcCall[2]?.plans === false, JSON.stringify(svcCall));

    calls.length = 0;
    r = await runSetupStage(svc, { companyId: "co", seeders: { ...good, seedStandardAddOns: async () => { throw new Error("addon boom"); } } });
    ok("add-ons throwing fails the stage with the reason…", !r.ok && /addon boom/.test(r.error), JSON.stringify(r));
    ok("…and the services were still seeded", calls.some((c) => c[0] === "services"));

    r = await runSetupStage(svc, { companyId: "co", seeders: { ...good, seedServicesForTrade: () => { throw new Error("sync boom"); } } });
    ok("a seeder that throws SYNCHRONOUSLY is a failed stage, not a crash", !r.ok && /sync boom/.test(r.error));
    r = await runSetupStage(svc, { companyId: "co", seeders: { ...good, seedServicesForTrade: undefined } });
    ok("a missing seeder is a failed stage, not a crash", !r.ok && /services/.test(r.error));

    calls.length = 0;
    r = await runSetupStage(chk, { companyId: "co", seeders: { ...good, seedChecklistTemplatesForTrade: async (t) => { if (t.categoryKey === "plumbing") throw new Error("chk boom"); return { created: 4 }; } } });
    ok("one trade's checklists failing fails the stage…", !r.ok && /checklists plumbing: chk boom/.test(r.error), r.error);
    ok("…while the other trade's checklists AND both trades' plans still ran", calls.filter((c) => c[0] === "plans").length === 2);

    calls.length = 0;
    r = await runSetupStage(tpl, { companyId: "co", client: "CLIENT", seeders: { ...good, seedDefaultTemplates: async () => { throw new Error("tpl boom"); } } });
    ok("email templates failing fails the stage, follow-ups still ensured with the client", !r.ok && calls.some((c) => c[0] === "followups" && c[1] === true && c[2] === "co"));

    for (const bad of [null, undefined, {}, { kind: "nope" }, { kind: "__proto__" }]) {
      r = await runSetupStage(bad, { companyId: "co", seeders: good });
      ok(`an unknown stage ${JSON.stringify(bad)} fails, never runs a seeder`, !r.ok);
    }
    r = await runSetupStage(svc, { companyId: "", seeders: good });
    ok("no company id → failure, not a seed into nothing", !r.ok);

    const failures = [];
    const out = await runSetupInline({
      companyId: "co",
      categories: [{ id: "c1", key: "plumbing" }],
      client: "CLIENT",
      seeders: { ...good, seedServicesForTrade: async () => { throw new Error("inline boom"); } },
      onFailure: (stage, message) => failures.push([stage.key, message]),
    });
    ok("the inline path (old pages, the plan step) runs every stage past a failure…", out.length === 3 && out[1].ok && out[2].ok);
    ok("…and reports the failure instead of only logging it", failures.length === 1 && failures[0][0] === "services:c1" && /inline boom/.test(failures[0][1]));
  }

  // ══ C. Who may run the stages ══════════════════════════════════════════════
  section("C. Only the owner, only while the company is fresh");
  {
    const now = new Date("2026-09-25T12:00:00Z");
    const fresh = new Date(now.getTime() - 60_000);
    ok("no membership → 409 no_company", setupStagesAllowed({ member: null, now }).code === "no_company");
    ok("an employee → 403", setupStagesAllowed({ member: { role: "employee", company: { createdAt: fresh } }, now }).status === 403);
    ok("an admin → 403 (owner only)", setupStagesAllowed({ member: { role: "admin", company: { createdAt: fresh } }, now }).status === 403);
    ok("a fresh owner → allowed", setupStagesAllowed({ member: { role: "owner", company: { createdAt: fresh } }, now }).ok);
    const old = new Date(now.getTime() - SETUP_WINDOW_MS - 1);
    ok("an established company → refused (re-seeding would resurrect deleted services)", setupStagesAllowed({ member: { role: "owner", company: { createdAt: old } }, now }).code === "setup_window_closed");
    ok("an unreadable createdAt → refused, not allowed", !setupStagesAllowed({ member: { role: "owner", company: { createdAt: "yesterday-ish" } }, now }).ok);
  }

  // ══ D. The lock ════════════════════════════════════════════════════════════
  section("D. One run per company at a time");
  {
    let ran = 0;
    let opts = null;
    const client = (free) => ({
      $transaction: async (fn, o) => ((opts = o), fn({ $queryRaw: async () => [{ locked: free }] })),
    });
    let r = await withSetupLock(client(false), "co", async () => ran++);
    ok("lock held elsewhere → { acquired: false } and the work does NOT run", r.acquired === false && ran === 0);
    r = await withSetupLock(client(true), "co", async () => (ran++, "value"));
    ok("lock free → the work runs once and its value comes back", r.acquired && r.value === "value" && ran === 1);
    ok("the transaction has a deadline inside the route's maxDuration", opts?.timeout > 0 && opts.timeout < 60_000, JSON.stringify(opts));
  }

  // ══ E. The real route, the real seeders, an in-memory database ═════════════
  section("E. POST /api/signup/setup — executed");
  const seedCompany = ({ role = "owner", createdAt = new Date(Date.now() - 30_000), trades = ["plumbing", "hvac"] } = {}) => {
    resetSignupSetupDb();
    state.rows.company = [{ id: "co1", defaultLanguage: "en", currency: "CAD", country: "CA", createdAt }];
    state.rows.member = [{ id: "m1", userId: "u1", companyId: "co1", role, createdAt, company: { id: "co1", createdAt } }];
    state.rows.serviceCategory = trades.map((key) => ({ id: `cat_${key}`, key, label: key, companyId: null }));
    state.rows.companyServiceCategory = trades.map((key, i) => ({ id: `csc${i}`, companyId: "co1", categoryId: `cat_${key}`, enabled: true, createdAt: new Date(i), category: { id: `cat_${key}`, key, label: key.toUpperCase() } }));
    authStub.session = { user: { id: "u1", email: "o@example.com" } };
  };
  const call = async () => {
    const res = await setupPOST(new Request("https://app.example/api/signup/setup", { method: "POST" }));
    const type = res.headers.get("content-type") || "";
    if (!type.includes("ndjson")) return { res, json: await res.json(), events: null };
    const text = await res.text();
    return { res, events: readNdjson(text + "\n").events };
  };
  {
    authStub.session = null;
    let out = await call();
    ok("no session → 401, no stream", out.res.status === 401 && !out.events);

    seedCompany({ role: "employee" });
    out = await call();
    ok("an employee has no OWNER membership → 409 no_company, nothing seeded", out.res.status === 409 && out.json.code === "no_company" && !(state.rows.product || []).length, JSON.stringify(out.json));

    seedCompany({ createdAt: new Date(Date.now() - SETUP_WINDOW_MS - 60_000) });
    out = await call();
    ok("an established company → 409 setup_window_closed, nothing seeded", out.res.status === 409 && out.json.code === "setup_window_closed" && !(state.rows.product || []).length);

    seedCompany();
    out = await call();
    const ev = out.events || [];
    ok("a fresh owner gets an NDJSON stream, no-store", out.res.headers.get("cache-control") === "no-store" && Array.isArray(out.events));
    ok("the first event is the plan, from the company's own trades", ev[0]?.type === "plan" && ev[0].stages.map((s) => s.key).join(",") === "services:cat_plumbing,services:cat_hvac,checklists,templates", JSON.stringify(ev[0]));
    const order = ev.filter((e) => e.type === "stage").map((e) => `${e.key}:${e.status}`);
    const expected = ["services:cat_plumbing", "services:cat_hvac", "checklists", "templates"].flatMap((k) => [`${k}:active`, `${k}:done`]);
    ok("every stage is reported active then done, in order", order.join("|") === expected.join("|"), order.join("|"));
    ok("the last event is complete with nothing failed", ev[ev.length - 1]?.type === "complete" && ev[ev.length - 1].failed.length === 0);
    const products = (state.rows.product || []).length;
    const checklists = (state.rows.jobChecklistTemplate || []).length;
    const plans = (state.rows.servicePlanTemplate || []).length;
    const templates = (state.rows.documentTemplate || []).length;
    const rules = (state.rows.followUpRule || []).length;
    console.log(`    (seeded: ${JSON.stringify({ products, checklists, plans, templates, rules })})`);
    ok("the REAL seeders wrote services, checklists, plans, a template and the three rules", products > 20 && checklists > 0 && plans > 0 && templates > 0 && rules === 3, JSON.stringify({ products, checklists, plans, templates, rules }));
    const firstChecklistWrite = state.writes.findIndex((w) => w.model === "jobChecklistTemplate");
    const lastProductWrite = state.writes.map((w) => w.model === "product" && w.action === "create").lastIndexOf(true);
    ok("checklists and plans are written in THEIR stage, after every trade's services (the screen names what is happening)", firstChecklistWrite > lastProductWrite && lastProductWrite > -1, `${firstChecklistWrite} vs ${lastProductWrite}`);
    ok("the advisory lock was asked for", state.lockQueries === 1 && state.writes.some((w) => w.model === "$queryRaw" && /pg_try_advisory_xact_lock/.test(w.sql)));

    // Repeat submit: a Retry re-runs the whole thing. Nothing new may appear.
    const before = JSON.stringify({ products, checklists, plans, templates, rules });
    out = await call();
    const after = JSON.stringify({
      products: state.rows.product.length,
      checklists: state.rows.jobChecklistTemplate.length,
      plans: state.rows.servicePlanTemplate.length,
      templates: state.rows.documentTemplate.length,
      rules: state.rows.followUpRule.length,
    });
    ok("a SECOND run creates nothing — every stage is idempotent", before === after, `${before} → ${after}`);
    ok("…and still reports every stage done", (out.events || []).filter((e) => e.type === "stage" && e.status === "done").length === 4 && out.events.at(-1)?.type === "complete");

    // Concurrent run: the lock is held elsewhere.
    state.lockFree = false;
    const productsNow = state.rows.product.length;
    out = await call();
    ok("while another run holds the lock → one 'busy' event and no seeding", out.events?.length === 1 && out.events[0].type === "busy" && state.rows.product.length === productsNow, JSON.stringify(out.events));

    // A stage failure: the first product write throws.
    seedCompany();
    state.failNext = { model: "product", method: "create", times: 1000, message: "product insert refused" };
    out = await call();
    const ev2 = out.events || [];
    ok("a failing services stage is reported failed…", ev2.some((e) => e.type === "stage" && e.key === "services:cat_plumbing" && e.status === "failed"));
    ok("…the later stages still run and report done", ["checklists", "templates"].every((k) => ev2.some((e) => e.type === "stage" && e.key === k && e.status === "done")));
    ok("…complete names the failed stages", ev2.at(-1)?.type === "complete" && ev2.at(-1).failed.includes("services:cat_plumbing"), JSON.stringify(ev2.at(-1)));
    const logged = (state.rows.platformErrorLog || []).filter((r) => r.code === "setup_stage_failed");
    ok("…and each failure is on /platform/errors with the stage and the reason", logged.length >= 1 && logged.every((r) => r.companyId === "co1" && r.detail?.stage && /product insert refused/.test(r.message)), JSON.stringify(logged[0]));
  }

  // ══ F. The browser's run ═══════════════════════════════════════════════════
  section("F. The browser's run: deadlines, Retry, and a bar only the server moves");
  {
    // readNdjson on hostile chunks
    let r = readNdjson('{"type":"plan"}\n{"type":"sta');
    ok("a half line is kept for the next chunk", r.events.length === 1 && r.rest === '{"type":"sta');
    r = readNdjson('garbage\n[1,2]\n"str"\n{"type":"complete","failed":[]}\n');
    ok("garbage lines are dropped; objects kept", r.events.length === 2 && r.events[1].type === "complete");
    ok("null / numbers do not throw", readNdjson(null).events.length === 0 && readNdjson(42).events.length === 0);

    // progressOf
    const s0 = initialStages(TRADES);
    ok("initial stages: company, one per trade, checklists, templates, dashboard", s0.map((s) => s.key).join(",") === "company,services:cat_int,services:cat_ext,checklists,templates,dashboard");
    ok("nothing done → 0%", progressOf(s0).percent === 0 && progressOf(s0).done === 0);
    ok("active does not count as done", progressOf(applyStageEvent(s0, "company", "active")).done === 0);
    ok("progressOf of garbage is 0/0, not NaN", progressOf(null).percent === 0 && progressOf(undefined).total === 0);
    ok("100% needs EVERY stage done, the dashboard included", progressOf(s0.map((s) => (s.key === "dashboard" ? s : { ...s, status: "done" }))).percent < 100);
    ok("a done stage is never moved back by a later 'active'", applyStageEvent(applyStageEvent(s0, "company", "done"), "company", "active")[0].status === "done");
    ok("a hostile trade list gives the fixed ends only", initialStages([null, { id: 3 }, "x"]).length === 4);
    const adopted = adoptServerPlan(applyStageEvent(s0, "company", "done"), [...SERVER_PLAN, { key: "company", kind: "x" }, null, { key: 7 }]);
    ok("the server's plan replaces the middle, keeps company/dashboard ends and 'done'", adopted[0].status === "done" && adopted.at(-1).key === "dashboard" && adopted.length === 6);

    const trace = (arr) => (stages) => arr.push(progressOf(stages).percent);

    // 1) Happy path, stream split mid-line.
    let percents = [];
    let setupCalls = 0;
    const whole = happyStream();
    const chunks = [whole.slice(0, 17), whole.slice(17, 130), whole.slice(130)];
    let out = await runSignupCreation({
      stages: initialStages(TRADES),
      postCompany: async () => jsonResponse(200, { appUrl: "/app?welcome=true", setup: "staged" }),
      openSetup: async () => (setupCalls++, streamResponse(chunks)),
      onStages: trace(percents),
      timeouts: FAST,
    });
    ok("happy path → done, to the route's appUrl", out.outcome === "done" && out.appUrl === "/app?welcome=true", JSON.stringify(out.outcome));
    ok("…every stage but the dashboard done, dashboard active", out.stages.filter((s) => s.status === "done").length === 5 && out.stages.at(-1).status === "active");
    ok("…the bar never went backwards", percents.every((p, i) => i === 0 || p >= percents[i - 1]), percents.join(","));
    ok("…and ended short of 100 while the dashboard loads", percents.at(-1) === Math.floor((5 * 100) / 6), percents.at(-1));
    ok("…one setup request", setupCalls === 1);

    // 2) A server without the staged path (a deploy in between).
    setupCalls = 0;
    out = await runSignupCreation({
      stages: initialStages(TRADES),
      postCompany: async () => jsonResponse(200, { appUrl: "/q/abc" }),
      openSetup: async () => (setupCalls++, streamResponse([])),
      timeouts: FAST,
    });
    ok("no 'staged' in the answer → the server already seeded: done, no setup call", out.outcome === "done" && setupCalls === 0 && out.appUrl === "/q/abc");

    // 3) The company POST hangs → timeout; the signal is aborted.
    let aborted = false;
    let serverCompanies = 0;
    let serverHasMember = false;
    const hangingButLanding = (signal) => {
      signal?.addEventListener?.("abort", () => (aborted = true));
      // The server does create it — the browser simply never hears back.
      serverCompanies++;
      serverHasMember = true;
      return new Promise(() => {});
    };
    out = await runSignupCreation({ stages: initialStages(TRADES), postCompany: hangingButLanding, openSetup: async () => streamResponse([]), timeouts: FAST });
    ok("a hanging company POST times out — never an endless spinner", out.outcome === "timeout" && out.stage === "company");
    ok("…the request is aborted", aborted);
    ok("…the outcome is UNKNOWN (it may have landed), not 'created' and not 'not created'", out.companyUnknown === true && out.companyCreated === false);
    ok("…the company stage shows failed, not done", out.stages[0].status === "failed");
    ok("…the timeout sentence says Retry never makes a second one", /never creates a second one/.test(problemText(tEn, out, out.stages)));

    // 4) Retry: the same POST, now answered by the server's one-business guard.
    const serverPost = async () => {
      if (serverHasMember) return jsonResponse(409, { error: "You're already signed in…", code: "already_has_company" });
      serverCompanies++;
      serverHasMember = true;
      return jsonResponse(200, { appUrl: "/app?welcome=true", setup: "staged" });
    };
    percents = [];
    const retried = await runSignupCreation({
      stages: out.stages,
      postCompany: serverPost,
      openSetup: async () => streamResponse([happyStream()]),
      companyMaybeCreated: true,
      fallbackAppUrl: "/app?welcome=true",
      onStages: trace(percents),
      timeouts: FAST,
    });
    ok("Retry after an unknown outcome: the 409 means 'it landed' → carries on to done", retried.outcome === "done", JSON.stringify(retried.outcome));
    ok("…and exactly ONE company exists", serverCompanies === 1, serverCompanies);
    ok("…using the fallback app URL (the first answer was lost)", retried.appUrl === "/app?welcome=true");

    // 5) A 409 on the FIRST attempt is a real refusal.
    setupCalls = 0;
    out = await runSignupCreation({
      stages: initialStages(TRADES),
      postCompany: async () => jsonResponse(409, { error: "Already signed in to Acme.", code: "already_has_company" }),
      openSetup: async () => (setupCalls++, streamResponse([])),
      timeouts: FAST,
    });
    ok("a first-attempt 409 stops with the server's sentence, and seeds nothing", out.outcome === "failed" && out.message === "Already signed in to Acme." && setupCalls === 0 && out.companyCreated === false && !out.companyUnknown);

    // 6) A 400 (bad website) is shown, nothing else runs.
    out = await runSignupCreation({ stages: initialStages(TRADES), postCompany: async () => jsonResponse(400, { error: "That website address doesn't look right" }), openSetup: async () => streamResponse([]), timeouts: FAST });
    ok("a 400 comes back as the route's own message", out.outcome === "failed" && /website/.test(out.message));
    // 7) Network error → unknown.
    out = await runSignupCreation({ stages: initialStages(TRADES), postCompany: async () => { throw new TypeError("Failed to fetch"); }, openSetup: async () => streamResponse([]), timeouts: FAST });
    ok("a dropped connection is 'failed' with the outcome unknown (Retry is safe)", out.outcome === "failed" && out.companyUnknown === true);
    // 8) Non-JSON body on 500.
    out = await runSignupCreation({ stages: initialStages(TRADES), postCompany: async () => ({ ok: false, status: 500, json: async () => { throw new SyntaxError("<html>"); } }), openSetup: async () => streamResponse([]), timeouts: FAST });
    ok("a 500 with an HTML body is a failure with no crash", out.outcome === "failed" && out.message === null);

    const created = () => applyStageEvent(initialStages(TRADES), "company", "done");

    // 9) The stream goes quiet.
    out = await runSignupCreation({ stages: created(), postCompany: async () => { throw new Error("must not be re-sent"); }, openSetup: async () => streamResponse([lines({ type: "plan", stages: SERVER_PLAN }, { type: "stage", key: "services:cat_int", status: "active" })], { hangAfter: true }), timeouts: FAST });
    ok("a stalled stream times out on the idle deadline", out.outcome === "timeout" && out.companyCreated === true);
    ok("…the stage it stalled on is marked failed, the company stays done", out.stages.find((s) => s.key === "services:cat_int").status === "failed" && out.stages[0].status === "done");
    ok("…and the company POST was NOT re-sent (it throws if it is)", out.stage !== "company" && out.outcome !== "failed");
    // 10) Setup request itself never answers.
    out = await runSignupCreation({ stages: created(), postCompany: async () => jsonResponse(500, {}), openSetup: () => new Promise(() => {}), timeouts: FAST });
    ok("a setup request that never answers times out", out.outcome === "timeout");
    // 11) The stream ends without 'complete'.
    out = await runSignupCreation({ stages: created(), postCompany: async () => jsonResponse(500, {}), openSetup: async () => streamResponse([lines({ type: "plan", stages: SERVER_PLAN }, { type: "stage", key: "services:cat_int", status: "done" })]), timeouts: FAST });
    ok("a stream that ends without 'complete' is a failure, never success", out.outcome === "failed");
    // 12) The route refuses (window closed).
    out = await runSignupCreation({ stages: created(), postCompany: async () => jsonResponse(500, {}), openSetup: async () => jsonResponse(409, { error: "This business was set up a while ago", code: "setup_window_closed" }), timeouts: FAST });
    ok("a refusal from the setup route shows its sentence", out.outcome === "failed" && /a while ago/.test(out.message));
    // 13) An 'error' event.
    out = await runSignupCreation({ stages: created(), postCompany: async () => jsonResponse(500, {}), openSetup: async () => streamResponse([lines({ type: "error", error: "We couldn't finish" })]), timeouts: FAST });
    ok("an error event stops the run with its sentence", out.outcome === "failed" && out.message === "We couldn't finish");

    // 14) Busy, then done.
    let opened = 0;
    const slept = [];
    out = await runSignupCreation({
      stages: created(),
      postCompany: async () => jsonResponse(500, {}),
      openSetup: async () => (++opened === 1 ? streamResponse([lines({ type: "busy" })]) : streamResponse([happyStream()])),
      sleep: async (ms) => slept.push(ms),
      timeouts: FAST,
    });
    ok("'busy' waits and asks again — never seeds beside a running run", out.outcome === "done" && opened === 2 && slept[0] === FAST.busyRetryMs);
    // 15) Busy forever → the total deadline ends it.
    let clock = 0;
    out = await runSignupCreation({
      stages: created(),
      postCompany: async () => jsonResponse(500, {}),
      openSetup: async () => streamResponse([lines({ type: "busy" })]),
      sleep: async () => (clock += 100),
      now: () => clock,
      timeouts: FAST,
    });
    ok("busy forever still ends on the total deadline", out.outcome === "timeout");

    // 16) A failed stage, then Retry.
    const failing = lines(
      { type: "plan", stages: SERVER_PLAN },
      { type: "stage", key: "services:cat_int", status: "active" },
      { type: "stage", key: "services:cat_int", status: "done" },
      { type: "stage", key: "services:cat_ext", status: "active" },
      { type: "stage", key: "services:cat_ext", status: "failed" },
      { type: "stage", key: "checklists", status: "active" },
      { type: "stage", key: "checklists", status: "done" },
      { type: "stage", key: "templates", status: "active" },
      { type: "stage", key: "templates", status: "done" },
      { type: "complete", failed: ["services:cat_ext"] },
    );
    out = await runSignupCreation({ stages: created(), postCompany: async () => jsonResponse(500, {}), openSetup: async () => streamResponse([failing]), timeouts: FAST });
    ok("a failed stage → outcome failed, naming it", out.outcome === "failed" && out.stage === "services:cat_ext" && out.companyCreated === true);
    const carried = await runSignupCreation({ stages: initialStages(TRADES), postCompany: async () => jsonResponse(200, { appUrl: "/q/abc", setup: "staged" }), openSetup: async () => streamResponse([failing]), timeouts: FAST });
    ok("…and carries the route's appUrl, so Retry / 'anyway' land where the signup began", carried.outcome === "failed" && carried.appUrl === "/q/abc");
    ok("the page hands that appUrl to the next run", /if \(result\.appUrl\) creationRef\.current\.appUrl = result\.appUrl;/.test(read("app/signup/page.js")) && /fallbackAppUrl: creationRef\.current\.appUrl \|\| signupAppUrl,/.test(read("app/signup/page.js")));
    ok("…the others stay done", out.stages.filter((s) => s.status === "done").length === 4);
    ok("…the sentence names the stage and offers Settings", problemText(tEn, out, out.stages).includes("Adding your services for Exterior Painting") && /Settings/.test(problemText(tEn, out, out.stages)));
    percents = [];
    const again = await runSignupCreation({ stages: out.stages, postCompany: async () => { throw new Error("must not re-post"); }, openSetup: async () => streamResponse([happyStream()]), onStages: trace(percents), timeouts: FAST });
    ok("Retry re-runs the setup only (no company POST) and finishes", again.outcome === "done");
    ok("…and the bar never dips while the server re-reports finished stages", percents.every((p, i) => i === 0 || p >= percents[i - 1]) && percents[0] >= Math.floor((4 * 100) / 6), percents.join(","));
    // A stage that failed on the re-run but was done before is still done.
    const flaky = lines({ type: "plan", stages: SERVER_PLAN }, ...SERVER_PLAN.map((s) => ({ type: "stage", key: s.key, status: s.key === "checklists" ? "failed" : "done" })), { type: "complete", failed: ["checklists"] });
    const flakyOut = await runSignupCreation({ stages: again.stages, postCompany: async () => jsonResponse(500, {}), openSetup: async () => streamResponse([flaky]), timeouts: FAST });
    ok("a stage done on an earlier run and failing on a later one is still done (its rows exist)", flakyOut.outcome === "done");

    // withDeadline itself
    let fired = false;
    try {
      await withDeadline(new Promise(() => {}), 5, { onTimeout: () => (fired = true) });
      ok("withDeadline rejects a promise that never settles", false);
    } catch (e) {
      ok("withDeadline rejects a promise that never settles, after calling onTimeout", e?.timeout === true && fired);
    }
    ok("withDeadline passes a quick value through", (await withDeadline(Promise.resolve(3), 50)) === 3);
    ok("currentStage prefers the active stage", currentStage(applyStageEvent(created(), "checklists", "active")).key === "checklists");
  }

  // ══ G. The component ═══════════════════════════════════════════════════════
  section("G. The screen: bar = completed / total, spoken, and stoppable");
  {
    const cases = [
      initialStages(TRADES),
      applyStageEvent(initialStages(TRADES), "company", "active"),
      applyStageEvent(applyStageEvent(initialStages(TRADES), "company", "done"), "services:cat_int", "active"),
      initialStages(TRADES).map((s) => (s.key === "dashboard" ? { ...s, status: "active" } : { ...s, status: "done" })),
    ];
    for (const stages of cases) {
      const html = render(createElement(SignupCreating, { stages, companyName: "Acme Painting", running: true }));
      const { percent, done, total } = progressOf(stages);
      const now = /aria-valuenow="(\d+)"/.exec(html)?.[1];
      ok(`progressbar aria-valuenow=${percent} (${done}/${total} done)`, now === String(percent), now);
      ok(`…the fill is ${percent}% wide`, html.includes(`width:${percent}%`));
      ok("…spoken as 'N of M steps done'", html.includes(`aria-valuetext="${en("app.signup.progress.count", { done, total })}"`));
    }
    const running = cases[2];
    const html = render(createElement(SignupCreating, { stages: running, companyName: "Acme Painting", running: true }));
    ok("role=progressbar with min 0 / max 100", /role="progressbar"/.test(html) && /aria-valuemin="0"/.test(html) && /aria-valuemax="100"/.test(html));
    ok("a polite live region names the step under way", /aria-live="polite"/.test(html) && textOf(html).includes("Now: Adding your services for Interior Painting"));
    ok("the title names the company", textOf(html).includes("Setting up Acme Painting"));
    ok("every stage is listed by name", ["Creating your company", "Adding your services for Interior Painting", "Adding your services for Exterior Painting", en("app.signup.progress.checklists"), en("app.signup.progress.templates"), en("app.signup.progress.dashboard")].every((s) => textOf(html).includes(s)));
    ok("the bar's slide stops under prefers-reduced-motion", /transition-\[width\][^"]*motion-reduce:transition-none/.test(html));
    ok("the spinner stops under prefers-reduced-motion", /animate-spin motion-reduce:animate-none/.test(html));
    ok("design tokens only — no hex colours", /bg-card/.test(html) && /border-border/.test(html) && /text-foreground/.test(html) && !/#[0-9a-f]{3,6}\b/i.test(html.replace(/&#x?[0-9a-f]+;/gi, "")));
    ok("no Retry while running", !/Retry/.test(textOf(html)));

    const timeoutHtml = render(createElement(SignupCreating, { stages: applyStageEvent(initialStages(TRADES), "company", "failed"), problem: { outcome: "timeout", stage: "company", companyCreated: false, companyUnknown: true }, running: false }));
    ok("a company timeout: role=alert with the timeout sentence", /role="alert"/.test(timeoutHtml) && textOf(timeoutHtml).includes(en("app.signup.progress.timeoutCompany")));
    ok("…Retry and 'Back to the form' (no company is known to exist)", textOf(timeoutHtml).includes("Retry") && textOf(timeoutHtml).includes("Back to the form") && !textOf(timeoutHtml).includes("Go to my dashboard anyway"));
    ok("…and the live region goes quiet (the alert speaks instead)", !/Now:/.test(textOf(timeoutHtml)));
    const stageFail = applyStageEvent(applyStageEvent(initialStages(TRADES), "company", "done"), "checklists", "failed");
    const failHtml = render(createElement(SignupCreating, { stages: stageFail, problem: { outcome: "failed", stage: "checklists", companyCreated: true }, running: false }));
    ok("a stage failure after the company exists: Retry + 'Go to my dashboard anyway', no Back", textOf(failHtml).includes("Retry") && textOf(failHtml).includes("Go to my dashboard anyway") && !textOf(failHtml).includes("Back to the form"));
    ok("…the failed stage is named", textOf(failHtml).includes(`“${en("app.signup.progress.checklists")}”`));
    const setupTimeout = render(createElement(SignupCreating, { stages: stageFail, problem: { outcome: "timeout", stage: "checklists", companyCreated: true }, running: false }));
    ok("a seeding timeout says the business IS created", textOf(setupTimeout).includes(en("app.signup.progress.timeoutSetup")));
    const retrying = render(createElement(SignupCreating, { stages: stageFail, problem: { outcome: "failed", stage: "checklists", companyCreated: true }, running: true }));
    ok("Retry is disabled while a run is in flight (no double submit)", /<button[^>]*disabled=""[^>]*>Retry/.test(retrying));
    const slow = render(createElement(SignupCreating, { stages: cases[3], slowNavigation: true, appUrl: "/q/abc" }));
    ok("a slow navigation offers the dashboard link by hand", /href="\/q\/abc"/.test(slow) && textOf(slow).includes("Open your dashboard"));
    const fr = render(createElement(SignupCreating, { stages: running, companyName: "Acme", running: true }), "fr");
    ok("French renders French", textOf(fr).includes("Création de votre entreprise") && textOf(fr).includes("Ajout de vos services pour Interior Painting"));
    ok("a services stage with no label still reads as a sentence", stageLabel(tEn, { kind: "services", label: "" }) === "Adding your services");
    ok("the server's own sentence wins for a definite company refusal", problemText(tEn, { stage: "company", outcome: "failed", message: "Company name is required" }, []) === "Company name is required");
  }

  // ══ H. Wiring and strings ══════════════════════════════════════════════════
  section("H. The page and the routes are wired to it; the strings exist in nine languages");
  {
    const page = code("app/signup/page.js");
    const finish = page.slice(page.indexOf("async function handleFinish"), page.indexOf("function leaveCreating"));
    ok("the page renders SignupCreating", /<SignupCreating\b/.test(page) && /import SignupCreating from "@\/app\/components\/auth\/SignupCreating"/.test(page));
    ok("the no-plan finish goes through runCreation", /if \(withoutPlan\) \{[\s\S]*?await runCreation\(\);/.test(finish));
    ok("runCreation drives runSignupCreation with the stream route", /runSignupCreation\(\{/.test(finish) && /fetch\("\/api\/signup\/setup", \{ method: "POST", signal \}\)/.test(finish));
    ok("the company POST can be aborted and asks for staging on the no-plan path", /signal,\n\s+body: JSON\.stringify\(\{/.test(finish) && /stagedSetup: withoutPlan \? true : undefined,/.test(finish));
    ok("a Retry re-sends the SAME request and carries the unknown outcome", /onRetry=\{runCreation\}/.test(page) && /postCompany: creationRef\.current\.postCompany/.test(finish) && /companyMaybeCreated: creationRef\.current\.companyMaybeCreated/.test(finish) && /if \(result\.companyUnknown\) creationRef\.current\.companyMaybeCreated = true;/.test(finish));
    ok("the services card is hidden while the screen shows (no second press)", /step === "services" && !creating && \(/.test(page));
    ok("no timer moves a stage: the page's only timeout is the slow-navigation link", (finish.match(/setTimeout\(/g) || []).length === 1 && /slowNavigation: true/.test(finish));
    ok("Back is only for a company that does not exist; Continue goes to the app", /onBack=\{leaveCreating\}/.test(page) && /onContinue=\{\(\) => \{\s*window\.location\.href = creating\.appUrl \|\| signupAppUrl;/.test(page));

    const route = code("app/api/companies/route.js");
    ok("/api/companies reads stagedSetup and seeds inline otherwise", /stagedSetup,\n\s*\} = await request\.json\(\);/.test(route) && /const staged = stagedSetup === true && !plan;/.test(route) && /if \(!staged\) \{[\s\S]*?runSetupInline\(/.test(route));
    ok("…answers setup: 'staged' | 'done'", /setup: staged \? "staged" : "done",/.test(route));
    ok("…serialises company creation per USER and re-checks membership under the lock", /pg_advisory_xact_lock\(hashtext\(\$\{`signup-company:\$\{session\.user\.id\}`\}\)\)/.test(route) && /const raced = await tx\.member\.findFirst\(/.test(route) && /if \(raced\) return null;/.test(route));
    ok("…a raced second request gets the same 409 already_has_company", /if \(!company\) \{\s*return NextResponse\.json\([\s\S]*?code: "already_has_company"[\s\S]*?status: 409/.test(route));
    ok("…the lock is taken before the company row is written", route.indexOf("pg_advisory_xact_lock") < route.indexOf("tx.company.create("));
    ok("…the sales-floor bookkeeping runs in after(), after the org exists", /after\(async \(\) => \{\s*const completion = await recordSignupCompletion\(/.test(route) && route.indexOf("after(async () =>") > route.indexOf("data: { authOrgId: org.id }"));
    ok("…recordSignupOrigin was NOT moved (the rollback needs it before the org)", route.indexOf("recordSignupOrigin({") < route.indexOf("auth.api.createOrganization"));

    const setup = code("app/api/signup/setup/route.js");
    ok("the setup route takes the trades from the database, not the body", !/request\.json\(\)/.test(setup) && /companyServiceCategory\.findMany\(/.test(setup));
    ok("…runs under the per-company lock and records every failed stage", /withSetupLock\(db, companyId,/.test(setup) && /code: "setup_stage_failed"/.test(setup));
    ok("…has a maxDuration above the lock's deadline", /export const maxDuration = 60;/.test(setup));

    const comp = read("app/components/auth/SignupCreating.js");
    const used = [...new Set([...comp.matchAll(/"(app\.signup\.progress\.[A-Za-z]+)"/g)].map((m) => m[1]))];
    ok("the component uses the app.signup.progress.* namespace only", used.length >= 15 && !/"app\.signup\.creating\./.test(comp), used.length);
    const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
    for (const lang of LANGS) {
      const missing = used.filter((k) => typeof APP_MESSAGES[lang]?.[k] !== "string" || !APP_MESSAGES[lang][k].trim());
      ok(`${lang}: every key present`, missing.length === 0, missing.join(", "));
      const badParams = used.filter((k) => {
        const want = (APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join();
        const got = (String(APP_MESSAGES[lang]?.[k] || "").match(/\{\w+\}/g) || []).sort().join();
        return want !== got;
      });
      ok(`${lang}: placeholders match English`, badParams.length === 0, badParams.join(", "));
    }
    const fallbackKeys = [...comp.matchAll(/t\(\s*"(app\.signup\.progress\.[A-Za-z]+)",\s*"([^"]+)"/g)];
    ok("each in-code English fallback matches the catalogue", fallbackKeys.every(([, k, f]) => APP_MESSAGES.en[k] === f), fallbackKeys.filter(([, k, f]) => APP_MESSAGES.en[k] !== f).map(([, k]) => k).join(", "));
  }

  console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}` : `\nPASSED — ${pass}/${pass} assertions`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
