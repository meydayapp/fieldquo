// lib/callbacks/build.js
//
// The weekly build: for every enabled CallbackRule whose day it is, gather
// the company's own past clients, run lib/callbacks/rules.js over them, and
// write one CallbackList with its entries. Called from the follow-ups cron
// (app/api/cron/follow-ups) — same schedule, same secret, one more thing
// that looks back through a company's book once a day.
//
// Everything read here is scoped to ONE company at a time and never crosses
// it (non-negotiable #8). The candidates are the company's Client rows with
// their most recent Job and their most recent Invoice; "last ticket" is the
// latest invoice's total, falling back to the last job's quote total when
// no invoice was raised (a historical import, say).

import { db } from "@/lib/db";
import { normaliseRule, isDue, selectCandidates, weekOfKey } from "./rules";
import { readPolygon } from "@/lib/workAreas/polygon";

/** The Date the weekOf column stores for a key. */
function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * The company's candidates in the shape selectCandidates wants. One query
 * per table, joined in memory — a client book is hundreds of rows, not
 * millions, and three plain queries are easier to reason about than one
 * correlated subquery per client.
 */
export async function gatherCandidates(companyId) {
  const [clients, jobs, invoices, entries] = await Promise.all([
    db.client.findMany({
      where: { companyId },
      select: { id: true, name: true, phone: true, city: true, postalCode: true, doNotContactAt: true },
    }),
    db.job.findMany({
      where: { companyId, status: { not: "cancelled" }, archivedAt: null },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, clientId: true, title: true, completedAt: true, endDate: true, createdAt: true,
        siteCity: true, sitePostalCode: true, siteLatitude: true, siteLongitude: true, latitude: true, longitude: true,
        quote: { select: { total: true } },
      },
    }),
    db.invoice.findMany({
      where: { companyId, parentInvoiceId: null },
      orderBy: { createdAt: "desc" },
      select: { clientId: true, total: true, createdAt: true },
    }),
    db.callbackEntry.findMany({
      where: { companyId },
      select: { clientId: true, outcome: true, callBackOn: true, outcomeAt: true, list: { select: { weekOf: true, createdAt: true } } },
    }),
  ]);

  const lastJob = new Map();
  for (const j of jobs) {
    const at = new Date(j.completedAt || j.endDate || j.createdAt).getTime();
    const cur = lastJob.get(j.clientId);
    if (!cur || at > cur.at) lastJob.set(j.clientId, { ...j, at });
  }
  const lastInvoice = new Map();
  for (const inv of invoices) if (!lastInvoice.has(inv.clientId)) lastInvoice.set(inv.clientId, inv);
  const history = new Map();
  for (const e of entries) {
    const list = history.get(e.clientId) || [];
    list.push({ weekOf: e.list?.weekOf, listedAt: e.list?.createdAt, outcome: e.outcome, callBackOn: e.callBackOn, outcomeAt: e.outcomeAt });
    history.set(e.clientId, list);
  }

  return clients.map((client) => {
    const job = lastJob.get(client.id) || null;
    const inv = lastInvoice.get(client.id);
    const ticket = inv ? Number(inv.total) : job?.quote?.total != null ? Number(job.quote.total) : null;
    return { client, lastJob: job, lastTicket: Number.isFinite(ticket) ? ticket : null, history: history.get(client.id) || [] };
  });
}

/**
 * Build the list for one rule if it is due. Returns what happened, for the
 * cron's tally. Never throws on a race: the (ruleId, weekOf) unique makes
 * the second builder's create fail with P2002, which is reported as
 * "already_built".
 */
export async function buildListForRule(ruleRow, { now = new Date(), timezone } = {}) {
  const rule = normaliseRule(ruleRow);
  const existing = await db.callbackList.findMany({ where: { ruleId: ruleRow.id }, select: { weekOf: true } });
  const existingWeeks = existing.map((l) => weekOfKey(new Date(l.weekOf.getTime() + 12 * 3600 * 1000), "UTC"));
  const due = isDue(rule, now, timezone, existingWeeks);
  if (!due.due) return { ruleId: ruleRow.id, built: false, reason: due.reason };

  let polygon = null;
  if (rule.areaKind === "work_area" && rule.areaValue) {
    const area = await db.workArea.findFirst({ where: { id: rule.areaValue, companyId: ruleRow.companyId }, select: { polygon: true } });
    polygon = area ? readPolygon(area.polygon) : null;
    if (!polygon) return { ruleId: ruleRow.id, built: false, reason: "work_area_has_no_polygon" };
  }

  const candidates = await gatherCandidates(ruleRow.companyId);
  const { picked, excluded } = selectCandidates({ rule, now, candidates, workAreaPolygon: polygon });

  try {
    const list = await db.callbackList.create({
      data: {
        companyId: ruleRow.companyId,
        ruleId: ruleRow.id,
        weekOf: keyToDate(due.weekOf),
        entries: {
          create: picked.map((c) => ({
            companyId: ruleRow.companyId,
            clientId: c.client.id,
            lastJobAt: c.lastJob ? new Date(c.lastAt) : null,
            lastJobTitle: c.lastJob?.title || null,
            lastTicket: c.ticket,
          })),
        },
      },
      select: { id: true },
    });
    return { ruleId: ruleRow.id, built: true, listId: list.id, weekOf: due.weekOf, picked: picked.length, excluded: excluded.length };
  } catch (err) {
    if (err?.code === "P2002") return { ruleId: ruleRow.id, built: false, reason: "already_built" };
    throw err;
  }
}

/** Every company's rules, once. The cron's entry point. */
export async function runCallbackRotation({ now = new Date() } = {}) {
  const rules = await db.callbackRule.findMany({
    where: { enabled: true },
    include: { company: { select: { timezone: true } } },
  });
  const results = [];
  for (const rule of rules) {
    try {
      results.push(await buildListForRule(rule, { now, timezone: rule.company?.timezone || undefined }));
    } catch (err) {
      console.error("[callbacks] rule build failed:", rule.id, err?.message);
      results.push({ ruleId: rule.id, built: false, reason: "error", error: err?.message });
    }
  }
  return { rules: rules.length, built: results.filter((r) => r.built).length, results };
}
