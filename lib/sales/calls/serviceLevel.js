// lib/sales/calls/serviceLevel.js
//
// How fast the inbound line is answered — the contact-centre service level,
// over FieldQuo's own inbound rows.
//
// ══ The definition, from OMniLeads ════════════════════════════════════════
//
// Queue.servicelevel (ominicontacto_app/models.py ~1786) is handed to
// Asterisk's queue (asterisk_config_generador_de_partes.py ~303:
// `servicelevel={oml_servicelevel}`), which counts a call as inside the
// level when it is answered within that many seconds of entering the
// queue. reportes_app/reportes/reporte_llamadas_entrantes.py (~46–103)
// counts the rest from LlamadaLog events: CONNECT is answered (with
// bridge_wait_time, the wait), ABANDON and ABANDONWEL are the caller
// hanging up while waiting (with their wait accumulated separately), and
// EXITWITHTIMEOUT is the queue giving up on them. reportes_app/models.py
// (~368–372) keeps ABANDON / EXITWITHTIMEOUT / AMD together as
// EVENTOS_NO_DIALOGO — a call that reached us and produced no conversation,
// as opposed to EVENTOS_NO_CONTACTACION, a call that never reached anybody.
//
// ══ The same facts on our rows ════════════════════════════════════════════
//
//   ENTERQUEUE       dialledAt on an inbound row — written the moment the
//                    call arrives (store.js recordInbound), before any ring.
//   CONNECT          answeredAt — stamped by the desk leg's DialCallDuration
//                    (app/api/rep-dial/inbound after-dial, answeredAtFrom),
//                    so the wait is arrival to pickup, not arrival to hang-up.
//   ABANDON          missedAt set, no answeredAt, no voicemail — they hung
//                    up while it rang or held.
//   EXITWITHTIMEOUT  voicemailUrl set (or voicemailSeconds not null) and no
//                    answeredAt — the queue ran out and offered the machine.
//   still open       none of the above — the call is in progress or the
//                    carrier has not reported; kept out of every denominator.
//
// Pure. scripts/check-sales-outcomes.mjs drives every branch.

function when(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** One inbound row's verdict and wait. */
export function inboundWaitOf(row) {
  if (!row || row.direction !== "in") return null;
  const arrived = when(row.dialledAt);
  if (!arrived) return null;
  const answered = when(row.answeredAt);
  if (answered) {
    const wait = Math.max(0, Math.round((answered.getTime() - arrived.getTime()) / 1000));
    return { kind: "answered", waitSeconds: wait };
  }
  const voicemail = (typeof row.voicemailUrl === "string" && row.voicemailUrl.trim()) || Number.isFinite(row.voicemailSeconds);
  if (voicemail) return { kind: "expired", waitSeconds: null };
  if (when(row.missedAt)) return { kind: "abandoned", waitSeconds: null };
  return { kind: "open", waitSeconds: null };
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function fresh() {
  return { offered: 0, answered: 0, withinLevel: 0, abandoned: 0, expired: 0, open: 0, waitSum: 0, longestWait: 0 };
}

function finish(o, level) {
  return {
    ...o,
    answeredWithinRate: o.answered > 0 ? Math.round((o.withinLevel / o.answered) * 100) : null,
    averageWaitSeconds: o.answered > 0 ? Math.round(o.waitSum / o.answered) : null,
    serviceLevelSeconds: level,
  };
}

/**
 * The figures over a set of inbound attempts.
 *
 * "Answered within 20 s: 71% (17 of 24)" is withinLevel of ANSWERED — the
 * share of picked-up calls that were picked up in time, which is what a
 * rep can move. `offered` is everything that arrived; `abandoned` and
 * `expired` are the two ways a call that arrived produced no conversation.
 *
 * @param rows   SalesCallAttempt rows, any direction; only `in` is read
 * @param level  sales.inbound.serviceLevelSeconds
 */
export function serviceLevelFigures(rows = [], { serviceLevelSeconds = 20 } = {}) {
  const level = Number.isFinite(Number(serviceLevelSeconds)) && Number(serviceLevelSeconds) > 0 ? Number(serviceLevelSeconds) : 20;
  const total = fresh();
  const perDay = new Map();
  const perRep = new Map();
  const add = (o, v) => {
    o.offered += 1;
    if (v.kind === "answered") {
      o.answered += 1;
      o.waitSum += v.waitSeconds;
      if (v.waitSeconds > o.longestWait) o.longestWait = v.waitSeconds;
      if (v.waitSeconds <= level) o.withinLevel += 1;
    } else if (v.kind === "abandoned") o.abandoned += 1;
    else if (v.kind === "expired") o.expired += 1;
    else o.open += 1;
  };
  for (const row of Array.isArray(rows) ? rows : []) {
    const v = inboundWaitOf(row);
    if (!v) continue;
    add(total, v);
    const day = dayKey(when(row.dialledAt));
    if (!perDay.has(day)) perDay.set(day, { day, ...fresh() });
    add(perDay.get(day), v);
    // Per rep: the rep who PICKED UP (answeredByRepId), else the rep the
    // call was filed to. A missed call is counted against whoever it was
    // filed to — that is who it was ringing.
    const repId = row.answeredByRepId || row.salesRepId || null;
    const key = repId || "none";
    if (!perRep.has(key)) perRep.set(key, { repId, ...fresh() });
    add(perRep.get(key), v);
  }
  return {
    serviceLevelSeconds: level,
    total: finish(total, level),
    perDay: [...perDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).map((o) => finish(o, level)),
    perRep: [...perRep.values()].sort((a, b) => b.offered - a.offered).map((o) => finish(o, level)),
  };
}
