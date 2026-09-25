// lib/signup/creatingProgress.js
//
// The browser half of the signup progress screen: the stage list, the bar's
// value, and the run that drives both from what the server reports. No React
// and no fetch of its own — the page hands in the two requests — so
// scripts/check-signup-creating.mjs executes the real run against a timeout,
// a repeat submit and a failing stage without a browser.
//
// ── The rules the screen is held to ─────────────────────────────────────────
//
//   * The bar is completed stages over total stages (progressOf). A stage is
//     "done" only when the server said so — the company when /api/companies
//     answered, each seeding stage when /api/signup/setup streamed its "done".
//     Nothing here advances on a timer.
//   * Nothing waits forever. Every request is under a deadline; a stream that
//     goes quiet for `setupIdleMs` is abandoned; a stream that ENDS without
//     its "complete" event is a failure, not a success.
//   * Retry never makes a second company. The company POST is only re-sent
//     when the first attempt's outcome is unknown (timed out, or the network
//     dropped), and a 409 already_has_company on THAT resend means the first
//     attempt landed — the run carries on to the seeding instead of stopping.
//     (The route itself also serialises the create per user; see the
//     advisory lock in app/api/companies/route.js.) The seeding is idempotent
//     and locked per company server-side, and a "busy" answer waits and asks
//     again rather than seeding beside a run still in progress.

/** Deadlines, in ms. Exported so the check can shrink them. */
export const CREATING_TIMEOUTS = Object.freeze({
  // Company + member + org + referral bookkeeping; measured well under a second.
  companyMs: 30_000,
  // No event from the seeding stream for this long = stalled.
  setupIdleMs: 30_000,
  // A whole seeding run, however chatty, gives up here.
  setupTotalMs: 120_000,
  // How long to wait before asking again when another run holds the lock.
  busyRetryMs: 2_000,
  // After the browser was sent to the dashboard: if this page is still here
  // this much later, the screen offers the link by hand.
  navigateSlowMs: 15_000,
});

/**
 * The stages the screen shows before the server has said anything: the
 * company, one per ticked trade, the checklists, the templates, and the
 * dashboard itself. The server's own plan replaces the middle when it arrives
 * (adoptServerPlan), so this list only has to be right about its shape.
 *
 * @param trades  [{ id, label }] — the quote types ticked on the last step
 */
export function initialStages(trades = []) {
  const seen = new Set();
  const services = [];
  for (const t of Array.isArray(trades) ? trades : []) {
    if (!t || typeof t.id !== "string" || !t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    services.push({ key: `services:${t.id}`, kind: "services", categoryId: t.id, label: t.label || "", status: "pending" });
  }
  return [
    { key: "company", kind: "company", status: "pending" },
    ...services,
    { key: "checklists", kind: "checklists", status: "pending" },
    { key: "templates", kind: "templates", status: "pending" },
    { key: "dashboard", kind: "dashboard", status: "pending" },
  ];
}

/**
 * The bar. `done` counts only stages the server reported done; `percent` is
 * the rounded share of the total, 0–100, and never 100 until every stage —
 * the dashboard included — is done.
 */
export function progressOf(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const total = list.length;
  const done = list.filter((s) => s?.status === "done").length;
  const percent = total ? Math.floor((done * 100) / total) : 0;
  return { done, total, percent };
}

/** The stage the screen names as "now": the active one, else the first not done. */
export function currentStage(stages) {
  const list = Array.isArray(stages) ? stages : [];
  return list.find((s) => s.status === "active") || list.find((s) => s.status !== "done") || null;
}

/** A copy with one stage's status changed. Unknown keys change nothing. */
export function withStatus(stages, key, status) {
  return stages.map((s) => (s.key === key ? { ...s, status } : s));
}

/**
 * One streamed stage event applied to the list. A stage already done stays
 * done: a Retry re-runs every stage and the server reports each "active"
 * again before its "done", and the bar going backwards for a stage whose rows
 * already exist would be the screen contradicting itself.
 */
export function applyStageEvent(stages, key, status) {
  return stages.map((s) => (s.key === key && s.status !== "done" ? { ...s, status } : s));
}

/**
 * Replace the middle of the list with the server's plan — the server read the
 * trades from the database, so it is the authority on what will run — while
 * keeping the company and dashboard ends, any status already reported, and the
 * page's own (translated) trade label where it has one.
 */
export function adoptServerPlan(stages, planStages) {
  if (!Array.isArray(planStages)) return stages;
  const byKey = new Map(stages.map((s) => [s.key, s]));
  const middle = [];
  for (const p of planStages) {
    if (!p || typeof p.key !== "string" || p.key === "company" || p.key === "dashboard") continue;
    const mine = byKey.get(p.key);
    middle.push({
      key: p.key,
      kind: typeof p.kind === "string" ? p.kind : "services",
      ...(p.categoryId ? { categoryId: p.categoryId } : {}),
      label: mine?.label || (typeof p.label === "string" ? p.label : ""),
      status: mine?.status || "pending",
    });
  }
  const first = byKey.get("company") || { key: "company", kind: "company", status: "pending" };
  const last = byKey.get("dashboard") || { key: "dashboard", kind: "dashboard", status: "pending" };
  return [first, ...middle, last];
}

/**
 * Split a chunk of NDJSON into whole events and the unfinished tail. A line
 * that is not JSON is dropped, not thrown: one garbled line must not end a
 * run whose next line would have said "done".
 */
export function readNdjson(buffer) {
  const text = String(buffer ?? "");
  const cut = text.lastIndexOf("\n");
  if (cut === -1) return { events: [], rest: text };
  const events = [];
  for (const line of text.slice(0, cut).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") events.push(parsed);
    } catch {
      // garbled line — see above
    }
  }
  return { events, rest: text.slice(cut + 1) };
}

class Timeout extends Error {
  constructor() {
    super("timeout");
    this.timeout = true;
  }
}

/**
 * `promise`, or a Timeout after `ms`. `onTimeout` runs first so the caller can
 * abort the request it was waiting on.
 */
export function withDeadline(promise, ms, { setTimer = setTimeout, clearTimer = clearTimeout, onTimeout } = {}) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimer(timer)),
    new Promise((_, reject) => {
      timer = setTimer(() => {
        try {
          onTimeout?.();
        } catch {
          // aborting is best-effort
        }
        reject(new Timeout());
      }, ms);
    }),
  ]);
}

/**
 * Drive the whole screen: create the company (unless an earlier attempt
 * already did), then stream the seeding. Resolves — never rejects — with
 *
 *   { outcome: "done", appUrl, stages }
 *   { outcome: "timeout" | "failed", stage, message?, stages,
 *     companyCreated, companyUnknown, appUrl? }
 *
 * `appUrl` rides on a failure once the company exists, so a Retry (which
 * does not re-post the company) and "Go to my dashboard anyway" still land
 * where the route said — the quote a signup began from, not a default.
 *
 * `companyUnknown` is the flag the page must hand back on the next Retry
 * (`companyMaybeCreated`): it is what lets a 409 on the resend mean "the first
 * one worked".
 *
 * @param stages              the current list (initialStages, or the list a
 *                            failed run returned — done stages stay done)
 * @param postCompany(signal) → Response   POST /api/companies
 * @param openSetup(signal)   → Response   POST /api/signup/setup
 * @param companyMaybeCreated a previous attempt's outcome was unknown
 * @param fallbackAppUrl      where to go when the company POST's own answer
 *                            was lost (the 409-on-resend case)
 * @param onStages(stages)    called on every change, for the render
 */
export async function runSignupCreation({
  stages: startStages,
  postCompany,
  openSetup,
  companyMaybeCreated = false,
  fallbackAppUrl = "/app?welcome=true",
  onStages = () => {},
  timeouts = CREATING_TIMEOUTS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
  timers = {},
}) {
  // A Retry starts from the list the failed run left: what was done stays
  // done, and what failed or was cut off mid-way is pending again.
  let stages = (Array.isArray(startStages) ? startStages : initialStages()).map((s) =>
    s.status === "failed" || s.status === "active" ? { ...s, status: "pending" } : s,
  );
  const set = (next) => {
    stages = next;
    onStages(stages);
  };
  const companyDone = () => stages.find((s) => s.key === "company")?.status === "done";
  let appUrl = fallbackAppUrl;

  // ── Stage 1: the company ────────────────────────────────────────────────
  if (!companyDone()) {
    set(withStatus(stages, "company", "active"));
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let res;
    try {
      res = await withDeadline(postCompany(controller?.signal), timeouts.companyMs, {
        ...timers,
        onTimeout: () => controller?.abort(),
      });
    } catch (err) {
      // Timed out or the network dropped: the request may have landed.
      set(withStatus(stages, "company", "failed"));
      return {
        outcome: err?.timeout ? "timeout" : "failed",
        stage: "company",
        stages,
        companyCreated: false,
        companyUnknown: true,
      };
    }
    const data = await Promise.resolve(res?.json?.()).catch(() => null);
    const landedEarlier = res?.status === 409 && data?.code === "already_has_company" && companyMaybeCreated;
    if (!res?.ok && !landedEarlier) {
      // A definite answer: nothing was created (the route refuses before
      // writing, and rolls back its own half-made company on a later failure).
      set(withStatus(stages, "company", "failed"));
      return {
        outcome: "failed",
        stage: "company",
        message: typeof data?.error === "string" ? data.error : null,
        stages,
        companyCreated: false,
        companyUnknown: false,
      };
    }
    if (data?.appUrl && typeof data.appUrl === "string") appUrl = data.appUrl;
    set(withStatus(stages, "company", "done"));

    // A server without the staged path seeded inline and says so by NOT
    // answering "staged" — everything is done; go.
    if (!landedEarlier && data?.setup !== "staged") {
      set(stages.map((s) => (s.key === "dashboard" ? { ...s, status: "active" } : { ...s, status: "done" })));
      return { outcome: "done", appUrl, stages };
    }
  }

  // ── The seeding, streamed ───────────────────────────────────────────────
  const failed = (outcome, stage, message = null) => {
    const key = stage || currentStage(stages)?.key || "templates";
    set(stages.map((s) => (s.status === "active" ? { ...s, status: "failed" } : s)));
    if (!stages.some((s) => s.status === "failed")) set(withStatus(stages, key, "failed"));
    return { outcome, stage: key, message, stages, appUrl, companyCreated: true, companyUnknown: false };
  };

  const deadline = now() + timeouts.setupTotalMs;
  for (;;) {
    const left = deadline - now();
    if (left <= 0) return failed("timeout");
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const abort = () => controller?.abort();
    let res;
    try {
      res = await withDeadline(openSetup(controller?.signal), Math.min(timeouts.setupIdleMs, left), { ...timers, onTimeout: abort });
    } catch (err) {
      return failed(err?.timeout ? "timeout" : "failed");
    }
    if (!res?.ok || !res.body?.getReader) {
      const data = await Promise.resolve(res?.json?.()).catch(() => null);
      return failed("failed", null, typeof data?.error === "string" ? data.error : null);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finished = null; // { failed: [] } on "complete"
    let busy = false;
    try {
      for (;;) {
        const room = deadline - now();
        if (room <= 0) throw new Timeout();
        const { value, done } = await withDeadline(reader.read(), Math.min(timeouts.setupIdleMs, room), {
          ...timers,
          onTimeout: abort,
        });
        if (value) buffer += decoder.decode(value, { stream: true });
        if (done) buffer += "\n";
        const { events, rest } = readNdjson(buffer);
        buffer = rest;
        for (const e of events) {
          if (e.type === "plan") set(adoptServerPlan(stages, e.stages));
          else if (e.type === "stage" && typeof e.key === "string" && ["active", "done", "failed"].includes(e.status)) {
            set(applyStageEvent(stages, e.key, e.status));
          } else if (e.type === "complete") finished = { failed: Array.isArray(e.failed) ? e.failed : [] };
          else if (e.type === "busy") busy = true;
          else if (e.type === "error") return failed("failed", null, typeof e.error === "string" ? e.error : null);
        }
        if (done) break;
      }
    } catch (err) {
      try {
        reader.cancel?.();
      } catch {
        // gone already
      }
      return failed(err?.timeout ? "timeout" : "failed");
    }

    if (busy) {
      // Another run for this company is still going (a Retry pressed while
      // the first stream's server half carried on). Wait, then ask again: the
      // next run finds its work done and reports it.
      await sleep(timeouts.busyRetryMs);
      continue;
    }
    if (!finished) {
      // The stream ended without saying it was complete: the function was
      // stopped, or the connection cut. Never read as success.
      return failed("failed");
    }
    // A stage that failed on this run but finished on an earlier one has its
    // rows (applyStageEvent kept it done), so only the rest count.
    const stillFailed = finished.failed.filter((key) => stages.find((s) => s.key === key)?.status !== "done");
    if (stillFailed.length) {
      return { outcome: "failed", stage: stillFailed[0], message: null, stages, appUrl, companyCreated: true, companyUnknown: false };
    }
    set(withStatus(stages, "dashboard", "active"));
    return { outcome: "done", appUrl, stages };
  }
}
