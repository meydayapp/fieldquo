// lib/signup/setupStages.js
//
// What happens to a brand-new company between "Start my free trial" and the
// dashboard, as named STAGES the signup screen can show one at a time.
//
// ── Why this is not one request any more ────────────────────────────────────
//
// POST /api/companies used to create the company AND seed it — every trade's
// services, the standard add-ons, checklists, maintenance plans, the email
// templates and the follow-up rules — and only then answer. For a painter that
// is ~120 Prisma calls and ~420 SQL statements (a handyman ~260 / ~980),
// almost all of it product rows, and the page could only say "Setting up..."
// on a disabled button while it happened. The owner noticed the wait and
// asked for a real progress bar.
//
// A bar that moves on a timer would be a control that appears to work and
// doesn't. So the work is split where the database already splits it: the
// company is created by /api/companies (stage "company"), and the seeding runs
// through POST /api/signup/setup, which streams one event per stage as the
// stage actually starts and finishes. The client's bar is completed stages
// over total stages — nothing else moves it.
//
// ── Every stage is safe to run twice ────────────────────────────────────────
//
// The Retry on the progress screen re-runs the whole setup, so each seeder
// here is create-only and keyed: services by Product.seedKey, add-ons by name,
// checklists and plans by (companyId, seedKey), email templates by type,
// follow-up rules by builtInKey. A second run creates only what the first did
// not. What keys cannot stop is two runs AT ONCE (Product has no unique on
// seedKey), so withSetupLock() below holds a Postgres advisory lock for the
// company while a run is in progress, and a second request that arrives
// meanwhile is told "busy" instead of seeding beside it.
//
// ── Who may run it, and when ────────────────────────────────────────────────
//
// setupStagesAllowed(): the company's OWNER, within SETUP_WINDOW_MS of the
// company being created. The window is the point — this route re-seeds
// whatever trades the company has switched on, and on an established company
// that would bring back a seeded service the owner deleted on purpose
// (seedKey dedupe cannot see a row that no longer exists). Settings >
// Services' "Add missing services" is the deliberate way to do that later.

import { seedStandardAddOns } from "@/lib/products/seedStandardAddOns";
import { seedServicesForTrade } from "@/lib/products/seedServices";
import { seedChecklistTemplatesForTrade } from "@/lib/checklists/seedTemplates";
import { seedPlanTemplatesForTrade } from "@/lib/servicePlans/seedTemplates";
import { seedDefaultTemplates } from "@/lib/email/seedDefaultTemplates";
import { ensureDefaultFollowUps } from "@/lib/followUps/defaults";

/** How long after creation the signup screen may still run (or re-run) setup. */
export const SETUP_WINDOW_MS = 2 * 60 * 60 * 1000;

/** The seeders, injectable so scripts/check-signup-creating.mjs can make one fail. */
export const DEFAULT_SEEDERS = Object.freeze({
  seedStandardAddOns,
  seedServicesForTrade,
  seedChecklistTemplatesForTrade,
  seedPlanTemplatesForTrade,
  seedDefaultTemplates,
  ensureDefaultFollowUps,
});

/**
 * The stages for one company, in the order they must run.
 *
 * One "services" stage per trade the company switched on (so the screen can
 * say which trade it is on), then the checklists and maintenance plans for
 * every trade — AFTER all the services, because a plan links the services each
 * visit covers and those links only resolve against rows that exist — then
 * the email templates and follow-up rules, which do not depend on the trade.
 *
 * @param categories  [{ id, key, label }] — the company's CompanyServiceCategory
 *                    rows resolved to their ServiceCategory. Anything without an
 *                    id and a key is dropped rather than guessed at.
 */
export function planSetupStages(categories = []) {
  const seen = new Set();
  const trades = [];
  for (const c of Array.isArray(categories) ? categories : []) {
    if (!c || typeof c.id !== "string" || !c.id || typeof c.key !== "string" || !c.key) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    trades.push({ id: c.id, key: c.key, label: typeof c.label === "string" ? c.label : "" });
  }
  return [
    ...trades.map((c) => ({
      key: `services:${c.id}`,
      kind: "services",
      categoryId: c.id,
      categoryKey: c.key,
      label: c.label,
    })),
    { key: "checklists", kind: "checklists", trades },
    { key: "templates", kind: "templates" },
  ];
}

// A seeder that throws synchronously (or is not a function) becomes a
// rejected promise, so every failure reaches the same catch.
const call = (fn, ...args) => Promise.resolve().then(() => fn(...args));

/** What the browser is told about a stage: no keys it does not need. */
export function publicStage(stage) {
  return {
    key: stage.key,
    kind: stage.kind,
    ...(stage.categoryId ? { categoryId: stage.categoryId, label: stage.label || "" } : {}),
  };
}

/**
 * Run one stage. Never throws — returns { ok, error?, detail } so the caller
 * decides whether a failure stops the screen (the stream route) or is only
 * logged (the inline path in /api/companies).
 *
 * @param client  the Prisma client, for ensureDefaultFollowUps (which takes it
 *                as an argument); the other seeders import lib/db themselves.
 */
export async function runSetupStage(stage, { companyId, client, seeders = DEFAULT_SEEDERS } = {}) {
  try {
    if (!companyId) throw new Error("companyId is required");
    if (stage?.kind === "services") {
      const t = { companyId, categoryId: stage.categoryId, categoryKey: stage.categoryKey };
      // Add-ons, then the trade's services — each on its own catch, as they
      // were inline in /api/companies: a problem with the add-on list must not
      // cost the services. Either failing fails the STAGE, which is what the
      // screen reports and what Retry re-runs.
      const errors = [];
      const addOns = await call(seeders.seedStandardAddOns, t).catch((err) => {
        errors.push(`add-ons: ${err?.message || err}`);
        return null;
      });
      const services = await call(seeders.seedServicesForTrade, t, { checklists: false, plans: false }).catch((err) => {
        errors.push(`services: ${err?.message || err}`);
        return null;
      });
      if (errors.length) return { ok: false, error: errors.join("; ") };
      return { ok: true, detail: { addOns: addOns?.created || 0, services: services?.created || 0 } };
    }
    if (stage?.kind === "checklists") {
      // Per trade, each seeder on its own catch — one trade's checklist file
      // with a problem must not cost another trade's plans.
      const errors = [];
      let checklists = 0;
      let plans = 0;
      for (const c of stage.trades || []) {
        const t = { companyId, categoryId: c.id, categoryKey: c.key };
        checklists += (await call(seeders.seedChecklistTemplatesForTrade, t).catch((err) => {
          errors.push(`checklists ${c.key}: ${err?.message || err}`);
          return null;
        }))?.created || 0;
        plans += (await call(seeders.seedPlanTemplatesForTrade, t).catch((err) => {
          errors.push(`plans ${c.key}: ${err?.message || err}`);
          return null;
        }))?.created || 0;
      }
      if (errors.length) return { ok: false, error: errors.join("; ") };
      return { ok: true, detail: { checklists, plans } };
    }
    if (stage?.kind === "templates") {
      const errors = [];
      const templates = await call(seeders.seedDefaultTemplates, companyId).catch((err) => {
        errors.push(`email templates: ${err?.message || err}`);
        return 0;
      });
      const followUps = await call(seeders.ensureDefaultFollowUps, client, companyId).catch((err) => {
        errors.push(`follow-ups: ${err?.message || err}`);
        return 0;
      });
      if (errors.length) return { ok: false, error: errors.join("; ") };
      return { ok: true, detail: { templates: templates || 0, followUps: followUps || 0 } };
    }
    throw new Error(`Unknown setup stage: ${stage?.key || stage?.kind || "(none)"}`);
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Who may run the stages. Pure, for the check.
 *
 * @param member  { role, company: { createdAt } } or null
 */
export function setupStagesAllowed({ member, now = new Date() } = {}) {
  if (!member?.company) {
    return { ok: false, status: 409, code: "no_company", error: "There's no business on this login to set up yet." };
  }
  if (member.role !== "owner") {
    return { ok: false, status: 403, code: "not_owner", error: "Only the business owner can finish setting it up." };
  }
  const created = new Date(member.company.createdAt).getTime();
  if (!Number.isFinite(created) || now.getTime() - created > SETUP_WINDOW_MS) {
    return {
      ok: false,
      status: 409,
      code: "setup_window_closed",
      error: "This business was set up a while ago — add services from Settings › Services instead.",
    };
  }
  return { ok: true };
}

/**
 * Run `fn` while holding a transaction-scoped advisory lock for this company,
 * or return { acquired: false } at once when another run holds it.
 *
 * The lock lives on an interactive transaction that does nothing else; the
 * seeders use their own pool connections meanwhile (lib/db.js allows five), so
 * the transaction is a mutex, not the unit of work — a stage that fails half
 * way keeps what it wrote, which the next run then skips. The pattern (and the
 * hashtext key) is the one app/api/payments and lib/jobs/importPastJob.js use.
 */
export async function withSetupLock(client, companyId, fn, { timeoutMs = 55_000 } = {}) {
  return client.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${`signup-setup:${companyId}`})) AS locked`;
      if (!rows?.[0]?.locked) return { acquired: false };
      return { acquired: true, value: await fn() };
    },
    { timeout: timeoutMs, maxWait: 10_000 },
  );
}

/**
 * Every stage, in order, for a caller that is not showing progress — the
 * plan-step checkout path of /api/companies and any page older than the
 * progress screen. Best-effort exactly as the inline seeding it replaced: a
 * failed stage never blocks the signup. It is not silent either — each one is
 * on /platform/errors via `onFailure`.
 */
export async function runSetupInline({ companyId, categories, client, onFailure, seeders = DEFAULT_SEEDERS }) {
  const results = [];
  for (const stage of planSetupStages(categories)) {
    const r = await runSetupStage(stage, { companyId, client, seeders });
    if (!r.ok && onFailure) await onFailure(stage, r.error);
    results.push({ key: stage.key, ...r });
  }
  return results;
}
