// lib/sales/calls/callbackAgenda.js
//
// A callback is a promise with a time in it. This is the half that KEEPS the
// promise: the push when the hour comes, the hand-over when the rep who made
// it is not there, and the list the owner reads.
//
// ══ What existed, and what did not ════════════════════════════════════════
//
// The `callback` outcome wrote callbackAt on the attempt and nextAttemptAt
// on the prospect (lib/sales/retryPool.js), the retry pool put a DUE row at
// the front of "Callable now", queueBatch.js's spokenFor() kept the row from
// being released while the promise was open, and CallbacksStrip.js listed
// the rep's own promises with a Call-now button. That is the exclusion half
// and the rep's own list. What did not exist: anything that happened AT the
// hour if the rep was not looking at the queue, and anything at all if the
// rep was not at work.
//
// ══ The model, from OMniLeads ═════════════════════════════════════════════
//
// AgendaContacto (ominicontacto_app/models.py ~3252–3300): fecha, hora,
// tipo_agenda PERSONAL or GLOBAL, observaciones, telefono. A personal agenda
// belongs to the agent who made it; a global one is the campaign's and the
// dialler rings it for whoever is free (views_agenda_contacto.py ~92–100:
// a global agenda on a dialler campaign is handed to the dialler service).
// The limits sit on the agent's Grupo (~297–305) and are enforced at save
// (~3272–3285: "Ud. ya ha alcanzado el número límite de Agendas Personales",
// "La fecha de agenda propuesta supera la ventana permitida") — FieldQuo's
// planDisposition does the same with the platform's numbers. The supervisor
// views (~205–300) list agendas by campaign, by agent and by date.
//
// What is ADDED here, because FieldQuo has no dialler to hand a global
// callback to: the GRACE. A callback stays personal for
// `sales.callback.graceMinutes` past its hour; if the rep is still not
// reachable then, it goes global to the next available rep who may take the
// call — the same reachability (inboundDistribution.js reachable) and the
// same language rule (leadLanguage.js) the inbound line uses, longest idle
// first, the way that module ranks the free sweep. The prospect's claim moves
// with it, because a rep's queue is what they hold, and a callback that is
// not in anybody's queue is not delivered.
//
// ══ Every write fires once ═══════════════════════════════════════════════
//
// callbackNotifiedAt and callbackReassignedAt are `null` guards on updateMany,
// the shape lib/sales/calls/missed.js uses for the same reason: the cron
// runs every minute and two overlapping ticks must not push twice or hand
// one promise to two reps.

import { db } from "@/lib/db";
import { CLAIM_HOURS } from "../prospectView";
import { logSingleClaim } from "../queueBatch";
import { requiredLanguageFor, effectiveSellsIn } from "../leadLanguage";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { presenceOf, reachable } from "./inboundDistribution";
import { presenceFor } from "./store";
import { outcomeSettingValues } from "./outcomeSettingsStore";

/** A promise older than this is not pushed or handed over by the sweep — it is on the platform list as overdue. */
export const AGENDA_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** On the floor board, an overdue callback older than this is flagged. */
export const OVERDUE_FLAG_MS = 24 * 60 * 60 * 1000;

const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());

/** The rep a callback is delivered to right now. */
export function callbackRepOf(row) {
  return row?.callbackRepId || row?.salesRepId || null;
}

/**
 * Which rep a global callback should go to — pure.
 *
 * @param candidates  `[{ id, sellsIn }]` active reps other than the one who is off
 * @param presence    presenceFor() rows for those reps
 * @param prospect    the row, for the language rule; null for a lead-only callback
 * @returns the rep id, or null with the reason
 */
export function pickGlobalRep({ candidates = [], presence = [], prospect = null, excludeRepId = null, now = new Date() } = {}) {
  const need = requiredLanguageFor(prospect);
  const byId = new Map((Array.isArray(presence) ? presence : []).filter((p) => p?.salesRepId).map((p) => [p.salesRepId, presenceOf(p)]));
  const free = (Array.isArray(candidates) ? candidates : [])
    .filter((r) => r?.id && r.id !== excludeRepId)
    .filter((r) => !need || effectiveSellsIn(r).includes(need))
    .filter((r) => reachable(byId.get(r.id), now))
    .sort((a, b) => new Date(byId.get(a.id)?.lastSeenAt || 0) - new Date(byId.get(b.id)?.lastSeenAt || 0));
  if (free.length) return { repId: free[0].id, reason: "available", language: need };
  const anyFree = (Array.isArray(candidates) ? candidates : []).some((r) => r?.id !== excludeRepId && reachable(byId.get(r.id), now));
  return { repId: null, reason: anyFree && need ? `nobody_${need}` : "nobody_free", language: need };
}

/**
 * The state of one callback row for a list — pure.
 * `state`: "upcoming" | "due" | "overdue" | "flagged" (overdue past OVERDUE_FLAG_MS).
 */
export function callbackState(row, now = new Date()) {
  const at = isDate(row?.callbackAt) ? row.callbackAt : row?.callbackAt ? new Date(row.callbackAt) : null;
  if (!at || Number.isNaN(at.getTime())) return { state: "unknown", ageMs: null };
  const age = now.getTime() - at.getTime();
  if (age < 0) return { state: "upcoming", ageMs: age };
  if (age >= OVERDUE_FLAG_MS) return { state: "flagged", ageMs: age };
  if (age >= 60 * 60 * 1000) return { state: "overdue", ageMs: age };
  return { state: "due", ageMs: age };
}

function pretty(e164) {
  const d = String(e164 || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return e164 || "";
}

function clockOf(at, language) {
  try {
    return new Intl.DateTimeFormat(language || "en", { hour: "numeric", minute: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(11, 16);
  }
}

const OPEN_WHERE = (now) => ({
  disposition: "callback",
  callbackAt: { not: null, lte: now, gte: new Date(now.getTime() - AGENDA_LOOKBACK_MS) },
});

const ROW_SELECT = {
  id: true,
  salesRepId: true,
  prospectId: true,
  leadId: true,
  toE164: true,
  callbackAt: true,
  callbackScope: true,
  callbackRepId: true,
  callbackNotifiedAt: true,
  callbackReassignedAt: true,
  dispositionNote: true,
  prospect: { select: { id: true, businessName: true, province: true, assignedRepId: true, doNotContactAt: true } },
  lead: { select: { businessName: true } },
};

/**
 * Has the promise been kept or closed since it was made? Any dial to the
 * number after the promise, or a closing outcome, or a do-not-contact. One
 * read for the batch.
 */
async function closedSince(rows, { client }) {
  const numbers = [...new Set(rows.map((r) => r.toE164))];
  if (!numbers.length) return new Set();
  const earliest = rows.reduce((m, r) => (r.callbackAt && (!m || r.callbackAt < m) ? r.callbackAt : m), null);
  const later = await client.salesCallAttempt.findMany({
    where: { toE164: { in: numbers }, direction: "out", ...(earliest ? { dialledAt: { gt: new Date(earliest.getTime() - AGENDA_LOOKBACK_MS) } } : {}) },
    select: { id: true, toE164: true, dialledAt: true },
  });
  const closed = new Set();
  for (const r of rows) {
    if (r.prospect?.doNotContactAt) closed.add(r.id);
    const since = r.callbackAt ? new Date(r.callbackAt.getTime() - 60 * 60 * 1000) : null;
    // A dial in the hour BEFORE the promised time counts as keeping it too.
    if (later.some((a) => a.id !== r.id && a.toE164 === r.toE164 && since && a.dialledAt > since)) closed.add(r.id);
  }
  return closed;
}

/**
 * The sweep, once a minute from the sales-pipeline cron.
 *
 *   1. PUSH every due callback nobody has been told about: "Callback due
 *      2:00 pm — Benchmark Painting asked for you" to the rep it is
 *      delivered to. Once.
 *   2. HAND OVER every personal callback past the grace whose rep is not
 *      reachable, to the next available rep who may take it, moving the
 *      prospect's claim with it and pushing to the new rep. Once.
 *
 * Returns counts. Never throws: the cron's other steps run whatever this does.
 */
export async function sweepCallbackAgenda({ client = db, now = new Date(), log = () => {} } = {}) {
  const out = { due: 0, pushed: 0, handedOver: 0, noRep: 0, closed: 0, errors: 0 };
  if (typeof client?.salesCallAttempt?.findMany !== "function") return out;
  const settings = await outcomeSettingValues({ client });
  const graceMs = Math.max(0, Number(settings["sales.callback.graceMinutes"]) || 0) * 60 * 1000;

  let rows;
  try {
    rows = await client.salesCallAttempt.findMany({ where: OPEN_WHERE(now), orderBy: { callbackAt: "asc" }, take: 200, select: ROW_SELECT });
  } catch (err) {
    log(`[callback agenda] read failed: ${err?.message || err}`);
    out.errors += 1;
    return out;
  }
  if (!rows.length) return out;
  const closed = await closedSince(rows, { client }).catch(() => new Set());
  const open = rows.filter((r) => !closed.has(r.id));
  out.closed = rows.length - open.length;
  out.due = open.length;
  if (!open.length) return out;

  // Presence for everybody involved, read once.
  const reps = await client.salesRep.findMany({ where: { active: true }, select: { id: true, name: true, sellsIn: true, language: true } }).catch(() => []);
  const presence = (await presenceFor(reps.map((r) => r.id), { now, client }).catch(() => null)) || [];
  const presenceById = new Map(presence.map((p) => [p.salesRepId, presenceOf(p)]));

  for (const row of open) {
    const owner = callbackRepOf(row);
    const who = row.prospect?.businessName || row.lead?.businessName || pretty(row.toE164);
    const scope = row.callbackScope || "personal";

    // ── 2. Hand over, when the grace has run out and the rep is off ─────
    const pastGrace = now.getTime() - row.callbackAt.getTime() >= graceMs;
    if (scope === "personal" && pastGrace && !row.callbackReassignedAt && !reachable(presenceById.get(owner), now) && row.prospect?.id) {
      const pick = pickGlobalRep({ candidates: reps, presence, prospect: row.prospect, excludeRepId: owner, now });
      if (!pick.repId) {
        out.noRep += 1;
      } else {
        try {
          const moved = await client.$transaction(async (tx) => {
            const r = await tx.salesCallAttempt.updateMany({
              where: { id: row.id, callbackReassignedAt: null },
              data: { callbackScope: "global", callbackRepId: pick.repId, callbackReassignedAt: now, callbackNotifiedAt: now },
            });
            if (r.count !== 1) return false;
            // The claim follows the promise. Scoped to the current holder
            // (or nobody) so a row somebody else worked meanwhile is not
            // taken off them; the lease covers the ordinary window from now.
            await tx.prospect.updateMany({
              where: { id: row.prospect.id, OR: [{ assignedRepId: owner }, { assignedRepId: null }] },
              data: { assignedRepId: pick.repId, assignedAt: now, claimExpiresAt: new Date(now.getTime() + CLAIM_HOURS * 60 * 60 * 1000) },
            });
            await logSingleClaim({ db: tx, rep: { id: pick.repId }, prospectId: row.prospect.id, now }).catch(() => null);
            return true;
          });
          if (moved) {
            out.handedOver += 1;
            const fromName = reps.find((r) => r.id === owner)?.name || null;
            await pushToReps({
              salesRepIds: [pick.repId],
              payload: async (language) => ({
                title: await appSentence(language, "app.notify.callbackHandedOver.title"),
                body: await appSentence(language, "app.notify.callbackHandedOver.body", { who, time: clockOf(row.callbackAt, language), rep: fromName || "—" }),
                tag: `sales-callback:${row.id}`,
                url: "/sales/queue",
              }),
            }).catch(() => null);
            log(`[callback agenda] ${row.id} handed from ${owner} to ${pick.repId} (${pick.reason})`);
            continue;
          }
        } catch (err) {
          out.errors += 1;
          log(`[callback agenda] hand-over of ${row.id} failed: ${err?.message || err}`);
        }
      }
    }

    // ── 1. Push, once, when the hour has come ───────────────────────────
    if (!row.callbackNotifiedAt && owner) {
      try {
        const r = await client.salesCallAttempt.updateMany({ where: { id: row.id, callbackNotifiedAt: null }, data: { callbackNotifiedAt: now } });
        if (r.count === 1) {
          out.pushed += 1;
          await pushToReps({
            salesRepIds: [owner],
            payload: async (language) => ({
              title: await appSentence(language, "app.notify.callbackDue.title"),
              body: await appSentence(language, "app.notify.callbackDue.body", { who, time: clockOf(row.callbackAt, language) }),
              tag: `sales-callback:${row.id}`,
              url: "/sales/queue",
            }),
          }).catch(() => null);
        }
      } catch (err) {
        out.errors += 1;
        log(`[callback agenda] push for ${row.id} failed: ${err?.message || err}`);
      }
    }
  }
  return out;
}

/**
 * The platform's list: every open callback, with its state, grouped for the
 * screen — due today, overdue, per rep — and the flagged count for the floor
 * board. Reads only.
 */
export async function listCallbackAgenda({ client = db, now = new Date(), limit = 500 } = {}) {
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const rows = await client.salesCallAttempt.findMany({
    where: { disposition: "callback", callbackAt: { not: null, gte: from, lte: to } },
    orderBy: { callbackAt: "asc" },
    take: limit,
    select: { ...ROW_SELECT, salesRep: { select: { id: true, name: true } } },
  });
  const closed = await closedSince(rows, { client }).catch(() => new Set());
  const reps = await client.salesRep.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => [r.salesRepId, r.callbackRepId]).filter(Boolean))] } }, select: { id: true, name: true } }).catch(() => []);
  const nameOf = new Map(reps.map((r) => [r.id, r.name]));
  const items = rows
    .filter((r) => !closed.has(r.id))
    .map((r) => {
      const st = callbackState(r, now);
      const deliveredTo = callbackRepOf(r);
      return {
        id: r.id,
        callbackAt: r.callbackAt.toISOString(),
        state: st.state,
        ageMinutes: st.ageMs === null ? null : Math.round(st.ageMs / 60000),
        scope: r.callbackScope || "personal",
        promisedByRepId: r.salesRepId,
        promisedBy: r.salesRep?.name || nameOf.get(r.salesRepId) || null,
        deliveredToRepId: deliveredTo,
        deliveredTo: nameOf.get(deliveredTo) || null,
        businessName: r.prospect?.businessName || r.lead?.businessName || null,
        toE164: r.toE164,
        note: r.dispositionNote || null,
        notifiedAt: r.callbackNotifiedAt ? r.callbackNotifiedAt.toISOString() : null,
        reassignedAt: r.callbackReassignedAt ? r.callbackReassignedAt.toISOString() : null,
        prospectId: r.prospectId,
      };
    });
  const today = now.toISOString().slice(0, 10);
  const perRep = {};
  for (const i of items) {
    const key = i.deliveredToRepId || "unassigned";
    if (!perRep[key]) perRep[key] = { repId: i.deliveredToRepId, name: i.deliveredTo, open: 0, due: 0, overdue: 0, flagged: 0 };
    perRep[key].open += 1;
    if (i.state === "due") perRep[key].due += 1;
    if (i.state === "overdue") perRep[key].overdue += 1;
    if (i.state === "flagged") perRep[key].flagged += 1;
  }
  return {
    items,
    dueToday: items.filter((i) => i.callbackAt.slice(0, 10) === today),
    overdue: items.filter((i) => i.state === "overdue" || i.state === "flagged"),
    flagged: items.filter((i) => i.state === "flagged"),
    perRep: Object.values(perRep).sort((a, b) => b.open - a.open),
    closedCount: closed.size,
  };
}

/** The floor board's line: how many overdue past the flag, and who. */
export async function overdueCallbacksForFloor({ client = db, now = new Date() } = {}) {
  try {
    const list = await listCallbackAgenda({ client, now, limit: 500 });
    return {
      flagged: list.flagged.length,
      overdue: list.overdue.length,
      byRep: list.perRep.filter((r) => r.flagged > 0).map((r) => ({ repId: r.repId, name: r.name, flagged: r.flagged })),
      flagAfterHours: OVERDUE_FLAG_MS / 3600000,
    };
  } catch (err) {
    return { flagged: null, overdue: null, byRep: [], flagAfterHours: OVERDUE_FLAG_MS / 3600000, error: err?.message || String(err) };
  }
}
