// lib/permissions/costBasis.js
//
// One gate for the company's COST BASIS: what the business costs to run, and
// therefore what its margin is.
//
//   Settings → Overhead        fixed costs, overhead salaries, debt,
//                              cost per job, target margin
//   Settings → Material Costs  per-gallon material cost, labour cost per hour
//   /api/analytics/minimum-price   the price floor those three add up to
//
// ── Why this file exists ───────────────────────────────────────────────────
//
// Every one of those endpoints was gated on `user:manage`, which a supervisor
// holds. QA signed in as a Dispatcher — showPricing:true, jobCosting:FALSE —
// and read COST PER JOB $2,886, a 20% target margin, $12,495 of monthly fixed
// costs, the itemised rent/insurance rows and the truck loan. The jobCosting
// toggle says "no margin, no cost basis, anywhere"; five endpoints had never
// heard of it.
//
// Worse, the READ gate and the WRITE gate disagreed. GET /api/salaries refuses
// anyone below payroll:view_all, and POST /api/salaries accepted a row from
// the same caller because it checked `user:manage` instead — so a Dispatcher
// could CREATE and DELETE the company's salary records on an endpoint whose
// reads he was refused. A write that succeeds where the read 403s is the
// sharpest version of this bug: the record moves the price floor on every
// quote the company writes afterwards, and its author cannot see what he did.
//
// So both halves are declared here, together, and the invariant
//
//     write(member) ⇒ read(member)
//
// is asserted by scripts/check-cost-basis.mjs against every preset rather than
// left to whoever edits one handler next.
//
// ── What was NOT changed ───────────────────────────────────────────────────
//
// Nothing is relaxed. Each resource keeps the authority check it already had —
// `user:manage` for the company's commitments, payroll:view_all for salaries,
// showPricing for the computed floor — and jobCosting is added ON TOP. A
// Manager holds jobCosting and keeps everything a Manager had; an owner or
// admin bypasses the grid entirely, as everywhere else.
//
// lib/permissions/settingsAccess.js records the pre-existing intent for the
// Overhead SIDEBAR ROW ("user:manage": a supervisor holds it). That intent was
// about which row to draw, chosen because the settings layout carried a role
// and no grid — the file says so, and names passing the grid in as the proper
// fix. It was never a decision that a Dispatcher may read the margin. The row
// rule now consults the grid too; see SETTINGS_ROW_REQUIREMENTS there.

import { can } from "@/lib/permissions";
import { hasLevel, hasToggle } from "./enforce";

/** May this member manage company-level records at all? */
function manages(member) {
  return !!member && can(member.role, "user:manage");
}

/** The toggle every surface below shares. */
function costing(member) {
  return hasToggle(member, "jobCosting");
}

/** Salaries are pay, whatever screen they are entered from. */
function seesAllPay(member) {
  return hasLevel(member, "payroll", "view_all");
}

/**
 * resource → { read, write }.
 *
 * `write: null` means the resource has no write handler at all — not that
 * writing is open. The check script asserts the route file agrees.
 */
export const COST_BASIS_RESOURCES = {
  // Rent, insurance, the phone bill. Stored as recurring overhead Expense
  // rows; the burn rate and the price floor both count them.
  fixedCosts: {
    read: (m) => costing(m) && manages(m),
    write: (m) => costing(m) && manages(m),
  },

  // The truck loan: principal, rate, monthly payment.
  debt: {
    read: (m) => costing(m) && manages(m),
    write: (m) => costing(m) && manages(m),
  },

  // The owner's draw and the office wage. These carry an optional worker and
  // an amount, so the READ has always been payroll:view_all rather than
  // user:manage — a Dispatcher and a Manager both sit below it. The write now
  // requires the same thing plus user:manage, which is what closes the
  // create-what-you-cannot-read hole. Nobody who could read a salary loses
  // the ability to write one.
  salaries: {
    read: (m) => costing(m) && seesAllPay(m),
    write: (m) => costing(m) && seesAllPay(m) && manages(m),
  },

  // Per-gallon paint cost, consumables, labour minutes. The screen says out
  // loud that these "drive the internal Cost / Margin estimate on every quote
  // — what you actually pay for materials and labour, separate from the price
  // you charge the client", which is the definition of a cost basis. Its GET
  // had no check of any kind.
  materialRecipes: {
    read: (m) => costing(m) && manages(m),
    write: (m) => costing(m) && manages(m),
  },

  // costPerJob, targetMargin and the overhead/salaries/debt breakdown — the
  // three lists above, summed. showPricing was already required (see the note
  // in the route); jobCosting joins it, because a price FLOOR is a cost, not a
  // price.
  minimumPrice: {
    read: (m) => costing(m) && hasToggle(m, "showPricing"),
    write: null,
  },

  // The same three lists again, summed a different way: monthly burn and
  // runway. Nothing in the UI fetches /api/analytics/burn-rate today — QA
  // never tried it, and neither did the sweep that gated its two siblings —
  // but an orphan is not proof nothing reaches it, and what it returns is the
  // $12,495 of monthly fixed costs from the Overhead screen with the itemised
  // rows taken off. Gated, not deleted, for the reason the templates routes
  // were.
  burnRate: {
    read: (m) => costing(m) && hasToggle(m, "showPricing"),
    write: null,
  },
};

export const COST_BASIS_KEYS = Object.keys(COST_BASIS_RESOURCES);

/** May this member READ this cost-basis resource? */
export function canReadCostBasis(member, resource) {
  const rule = COST_BASIS_RESOURCES[resource];
  // An unknown resource refuses. Everywhere else in this codebase an unknown
  // key falls open so a missing map can't lock people out of working screens;
  // here the map is five hand-written entries and a typo means a cost figure
  // served to anyone who asks.
  if (!rule) return false;
  return rule.read(member);
}

/** May this member WRITE it? */
export function canWriteCostBasis(member, resource) {
  const rule = COST_BASIS_RESOURCES[resource];
  if (!rule || !rule.write) return false;
  return rule.write(member);
}

// What a refused caller is told. Deliberately the same sentence whichever half
// of the gate failed: "you hold user:manage but not jobCosting" is a map of
// the permission model, handed to the person probing it.
//
// It does not name a role, because the set that qualifies differs per resource
// (a Manager may edit fixed costs and may not read salaries). "Ask an owner or
// admin" is true for all of them — they are who grants the toggle.
const READ_DENIAL =
  "You don't have access to the company's cost basis — what the business costs to run, and the margin on it. Ask an owner or admin.";
const WRITE_DENIAL =
  "You don't have access to change the company's cost basis. Ask an owner or admin.";

function refuse(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

/** Throws a 403-shaped error, matching requireToggle/requireLevel's contract. */
export function requireCostBasisRead(member, resource) {
  if (!canReadCostBasis(member, resource)) throw refuse(READ_DENIAL);
}

export function requireCostBasisWrite(member, resource) {
  if (!canWriteCostBasis(member, resource)) throw refuse(WRITE_DENIAL);
}
