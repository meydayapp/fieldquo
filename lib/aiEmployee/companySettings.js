// lib/aiEmployee/companySettings.js
//
// The company's own switches for how its AI team handles trouble (owner,
// 2026-10-04: "this can be manually selected by the company") — the row
// AiEmployeeCompanySettings, its defaults, and the one function that decides
// what a save may write.
//
// ══ Defaults are the owner's, and every one is on the screen ═══════════════
//
// SAFETY_DEFAULTS below is what a company with no row gets, and it is what
// the owner decided on 2026-10-04: probe first; water, heat, roof, sewage
// and a hot outlet are urgent; text the on-call person; give vetted safe
// first steps; match web-chat visitors to clients; read FieldQuo's shared
// manual library; offer real appointment times. Settings › AI employee
// shows each of them as a switch, so a default is a visible choice.
//
// The one thing a default never supplies is a PERSON. onCallMemberIds is
// empty until the owner picks somebody, and empty means "nobody is on call"
// — the screen says urgent texts are not going out and why (AGENTS.md
// failure class 5: absence of a statement is not a statement).
//
// ══ Refuse rather than coerce ══════════════════════════════════════════════
//
// The same rule lib/aiEmployee/settings.js follows for the employee row: a
// save touches only the keys in the body, and an unknown value is a 400
// naming the field, never a silent rewrite. The READ side (mergeSettings)
// fails closed on whatever a row holds.

import { URGENT_CATEGORIES } from "./triage";

export const ON_CALL_HOURS = Object.freeze(["always", "after_hours", "custom"]);
export const MIN_ACK_MINUTES = 2;
export const MAX_ACK_MINUTES = 120;
export const MAX_ON_CALL = 10;

export const SAFETY_DEFAULTS = Object.freeze({
  triageProbeFirst: true,
  urgentCategories: Object.freeze([...URGENT_CATEGORIES]),
  urgentAlertsEnabled: true,
  onCallMemberIds: Object.freeze([]),
  onCallHours: "always",
  onCallDays: Object.freeze([]),
  onCallStartMinute: null,
  onCallEndMinute: null,
  ackTimeoutMinutes: 10,
  safeStepsEnabled: true,
  matchWebChatClients: true,
  useSharedManuals: true,
  bookTechSlots: true,
});

/** Every column one save may change. */
export const SAFETY_FIELDS = Object.freeze(Object.keys(SAFETY_DEFAULTS));

const BOOLEANS = new Set(["triageProbeFirst", "urgentAlertsEnabled", "safeStepsEnabled", "matchWebChatClients", "useSharedManuals", "bookTechSlots"]);

const bool = (v, d) => (typeof v === "boolean" ? v : d);
const minute = (v) => (Number.isInteger(v) && v >= 0 && v < 1440 ? v : null);

/**
 * A row (or null) as the settings every reader uses. Fails closed on a
 * corrupt value — towards the default, never towards a person nobody chose.
 */
export function mergeSettings(row = null) {
  const r = row && typeof row === "object" ? row : {};
  const cats = Array.isArray(r.urgentCategories)
    ? r.urgentCategories.filter((c) => URGENT_CATEGORIES.includes(c))
    : [...SAFETY_DEFAULTS.urgentCategories];
  const members = Array.isArray(r.onCallMemberIds)
    ? [...new Set(r.onCallMemberIds.filter((m) => typeof m === "string" && m))].slice(0, MAX_ON_CALL)
    : [];
  const hours = ON_CALL_HOURS.includes(r.onCallHours) ? r.onCallHours : SAFETY_DEFAULTS.onCallHours;
  const ack = Number(r.ackTimeoutMinutes);
  return {
    triageProbeFirst: bool(r.triageProbeFirst, SAFETY_DEFAULTS.triageProbeFirst),
    urgentCategories: cats,
    urgentAlertsEnabled: bool(r.urgentAlertsEnabled, SAFETY_DEFAULTS.urgentAlertsEnabled),
    onCallMemberIds: members,
    onCallHours: hours,
    onCallDays: Array.isArray(r.onCallDays) ? [...new Set(r.onCallDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [],
    onCallStartMinute: minute(r.onCallStartMinute),
    onCallEndMinute: minute(r.onCallEndMinute),
    ackTimeoutMinutes: Number.isFinite(ack) ? Math.max(MIN_ACK_MINUTES, Math.min(MAX_ACK_MINUTES, Math.round(ack))) : SAFETY_DEFAULTS.ackTimeoutMinutes,
    safeStepsEnabled: bool(r.safeStepsEnabled, SAFETY_DEFAULTS.safeStepsEnabled),
    matchWebChatClients: bool(r.matchWebChatClients, SAFETY_DEFAULTS.matchWebChatClients),
    useSharedManuals: bool(r.useSharedManuals, SAFETY_DEFAULTS.useSharedManuals),
    bookTechSlots: bool(r.bookTechSlots, SAFETY_DEFAULTS.bookTechSlots),
    saved: Boolean(row),
  };
}

/** Read under the company. Never throws: a failed read is the defaults. */
export async function loadCompanySettings(prisma, companyId) {
  if (!companyId || !prisma?.aiEmployeeCompanySettings?.findUnique) return mergeSettings(null);
  try {
    const row = await prisma.aiEmployeeCompanySettings.findUnique({ where: { companyId } });
    return mergeSettings(row);
  } catch (err) {
    console.error("[aiEmployee] company settings read failed:", err?.message);
    return mergeSettings(null);
  }
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const refuse = (field, error) => ({ ok: false, status: 400, reason: "bad_value", field, error });

/** "18:30" → 1110; a number of minutes passes through. Null when neither. */
export function toMinute(v) {
  if (Number.isInteger(v)) return minute(v);
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h < 24 && mm < 60 ? h * 60 + mm : null;
}

/**
 * Plan one save. Pure.
 *
 * @param current        the merged settings as they stand
 * @param body           only the fields to change
 * @param memberIds      the ids of THIS company's active members — an
 *                       on-call id from anywhere else is refused, never kept
 * @returns {{ ok: true, data, fields } | { ok: false, status, reason, field, error }}
 */
export function planSafetySave({ current = mergeSettings(null), body = {}, memberIds = [] } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const fields = SAFETY_FIELDS.filter((f) => has(b, f));
  if (!fields.length) return { ok: false, status: 400, reason: "nothing", error: "Nothing to change." };
  const own = new Set(memberIds);
  const data = {};
  for (const f of fields) {
    const v = b[f];
    if (BOOLEANS.has(f)) {
      if (typeof v !== "boolean") return refuse(f, "That should be on or off.");
      data[f] = v;
    } else if (f === "urgentCategories") {
      if (!Array.isArray(v) || v.some((c) => !URGENT_CATEGORIES.includes(c))) return refuse(f, "Pick from the list.");
      data[f] = URGENT_CATEGORIES.filter((c) => v.includes(c));
    } else if (f === "onCallMemberIds") {
      if (!Array.isArray(v) || v.some((m) => typeof m !== "string")) return refuse(f, "Pick people from your team.");
      const list = [...new Set(v)];
      if (list.length > MAX_ON_CALL) return refuse(f, `At most ${MAX_ON_CALL} people.`);
      if (list.some((m) => !own.has(m))) return refuse(f, "That person isn't on your team.");
      data[f] = list;
    } else if (f === "onCallHours") {
      if (!ON_CALL_HOURS.includes(v)) return refuse(f, "Pick when they're on call.");
      data[f] = v;
    } else if (f === "onCallDays") {
      if (!Array.isArray(v) || v.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return refuse(f, "Pick days of the week.");
      data[f] = [...new Set(v)].sort();
    } else if (f === "onCallStartMinute" || f === "onCallEndMinute") {
      const m = v === null ? null : toMinute(v);
      if (v !== null && m === null) return refuse(f, "That should be a time like 18:00.");
      data[f] = m;
    } else if (f === "ackTimeoutMinutes") {
      const n = Number(v);
      if (v === null || v === "" || !Number.isFinite(n)) return refuse(f, `That should be a number of minutes (${MIN_ACK_MINUTES}–${MAX_ACK_MINUTES}).`);
      data[f] = Math.max(MIN_ACK_MINUTES, Math.min(MAX_ACK_MINUTES, Math.round(n)));
    }
  }
  // ── A custom window must be a window ─────────────────────────────────
  // Saved half-filled it would be read as "never on call" — so it is
  // refused, naming what is missing, rather than stored as a trap.
  const merged = { ...current, ...data };
  if (merged.onCallHours === "custom") {
    if (!merged.onCallDays?.length) return refuse("onCallDays", "Pick at least one day.");
    if (merged.onCallStartMinute === null || merged.onCallEndMinute === null) return refuse("onCallStartMinute", "Set a start and an end time.");
    if (merged.onCallStartMinute === merged.onCallEndMinute) return refuse("onCallEndMinute", "The start and end can't be the same time.");
  }
  return { ok: true, data, fields };
}
