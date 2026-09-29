// lib/dashboard/crewHome.js
//
// Who gets "My day" on /app instead of the office dashboard, and what "My
// day" is allowed to carry. Pure, so scripts/check-dashboard-home.mjs can run
// the decision over every permission preset and push a payload stuffed with
// money through the shaper to prove none of it comes out.
//
// ── Who ────────────────────────────────────────────────────────────────────
//
// Crew: not an owner or admin, not somebody who runs a schedule (the same
// rule that hands a person the manager tabs on /app/me — lib/me/tabs.js),
// and holding none of the office documents — requests, quotes or invoices
// all below view_only. That is the Crew preset exactly, and any custom grid
// shaped like it. An Estimator (quotes) or a Dispatcher (schedule edit_all)
// keeps the office dashboard, whose panels already gate themselves.
//
// A member with no grid is hasLevel's fall-open case (lib/permissions/
// enforce.js): pre-grid accounts keep what they had, which is the office
// dashboard. An unresolved provider (null) is the same — the panels behind
// it refuse on their own, and a home screen that flips when a lookup is slow
// is worse than one that waits for the server to say no.
//
// ── What ───────────────────────────────────────────────────────────────────
//
// Where to be, when, how to get there, the clock, and the job's photos and
// checklist. NO money and no company numbers — not the shift estimate
// lib/me/home.js offers a worker who may see their own pay, not a job
// total, not a count of the company's work. The shaper below builds each
// item from a whitelist, so a field the timeline grows tomorrow cannot ride
// through to this screen by accident.

import { hasLevel } from "@/lib/permissions/enforce";
import { meTabSetFor } from "@/lib/me/tabs";
import { directionsLinks } from "@/lib/maps/streetView";

export function isCrewHome(caller) {
  if (!caller || typeof caller.role !== "string") return false;
  if (caller.role === "owner" || caller.role === "admin") return false;
  if (meTabSetFor(caller) === "manager") return false;
  for (const category of ["requests", "quotes", "invoices"]) {
    if (hasLevel(caller, category, "view_only")) return false;
  }
  return true;
}

/** Keys that must never appear anywhere in a My day payload. The check scans for them. */
export const CREW_FORBIDDEN_KEYS = Object.freeze([
  "amount", "total", "subtotal", "price", "unitPrice", "rate", "hourlyRate", "estimate",
  "earnedToday", "earned", "wage", "wages", "pay", "cost", "revenue", "owed", "tax", "discount", "margin",
]);

/** The kinds of item that are the person's own day. Open shifts and company events are not. */
export const MY_DAY_KINDS = Object.freeze(["shift", "visit", "appointment", "task"]);

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const str = (v) => (typeof v === "string" ? v : null);
const at = (v) => {
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};

/** One timeline item, rebuilt from the fields My day draws. Nothing else survives. */
export function crewItem(item, extras = {}) {
  if (!item || typeof item !== "object" || !MY_DAY_KINDS.includes(item.kind)) return null;
  const id = str(item.id);
  const start = at(item.start);
  if (!id || !ID.test(id) || !start) return null;
  const jobIdRaw = str(item.jobId) || str(item.job?.id);
  const jobId = jobIdRaw && ID.test(jobIdRaw) ? jobIdRaw : null;
  const address = str(item.address);
  const links = address ? directionsLinks(address) : null;
  const out = {
    kind: item.kind,
    id,
    start,
    end: at(item.end),
    title: str(item.title),
    subtitle: str(item.subtitle),
    address,
    directions: links?.google || null,
    status: str(item.status),
    jobId,
    jobHref: jobId ? `/app/jobs/${jobId}` : null,
  };
  const x = extras[id];
  if (item.kind === "visit" && x && typeof x === "object") {
    const n = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    out.photos = n(x.photos);
    out.checklistDone = n(x.checklistDone);
    out.checklistTotal = n(x.checklistTotal);
  }
  return out;
}

/**
 * The whole My day payload.
 *
 * @param items       lib/me/timeline.js items for today → +7 days
 * @param nextId      the id nextUp() chose, or null
 * @param todayEnd    the end of the company's today (ISO or Date)
 * @param clock       { onRoster, open: { clockIn, onBreak } | null }
 * @param visitExtras { [visitId]: { photos, checklistDone, checklistTotal } }
 */
export function shapeMyDay({ items = [], nextId = null, todayEnd = null, clock = null, visitExtras = {}, name = null } = {}) {
  const shaped = (Array.isArray(items) ? items : []).map((i) => crewItem(i, visitExtras)).filter(Boolean);
  shaped.sort((a, b) => a.start.localeCompare(b.start));
  const cut = at(todayEnd);
  const today = cut ? shaped.filter((i) => i.start < cut) : shaped;
  const week = cut ? shaped.filter((i) => i.start >= cut) : [];
  const next = shaped.find((i) => i.id === nextId) || null;
  const open = clock?.open && typeof clock.open === "object" ? clock.open : null;
  return {
    name: str(name),
    next,
    today,
    week,
    clock: {
      onRoster: clock?.onRoster === true,
      open: open ? { since: at(open.clockIn), onBreak: open.onBreak === true } : null,
    },
  };
}

/** Every key anywhere in a value, for the check's money scan. */
export function deepKeys(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const v of value) deepKeys(v, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      deepKeys(v, out);
    }
  }
  return out;
}
