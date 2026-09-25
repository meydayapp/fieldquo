// lib/aiEmployee/settings.js
//
// What one save on Settings › AI employee is allowed to change, and on WHICH
// employee. Pure: the route reads the company's rows under its own companyId,
// hands them here with the request body, and writes what comes back.
//
// ══ The bug this file exists to make impossible ════════════════════════════
//
// The owner, 2026-09-22: "it doesn't seem to save the name and voice", "the
// AI team doesn't update with the new name". Three causes, all fixed here or
// beside it:
//
//   1. The PUT fell back to `rows[0]` when the body had no id — "save the
//      oldest employee" is never what anybody asked for, and with two
//      employees it lands a receptionist's name on the closer. Now: no id is
//      a 400, an id that is not one of THIS company's rows is a 404, and there
//      is no fallback of any kind.
//   2. The PUT was a full replace: every column was rewritten from the body,
//      and a missing key meant "blank it" (a missing role meant the closed
//      preset, a missing name meant "Assistant"). A screen that saves ONE
//      field at a time — which auto-save is — would have wiped the rest. Now
//      only the keys present in the body are touched.
//   3. The screen held one form for the selected employee and re-seeded it
//      from the server whenever that employee's updatedAt moved, so a tool
//      switch in the flow view (a PATCH that bumps updatedAt) silently threw
//      away a name typed a moment earlier and never saved. The screen now
//      saves each field as it is edited and never re-seeds a form under the
//      person typing in it (app/app/settings/ai-employee/page.js).
//
// ══ Refuse rather than coerce ══════════════════════════════════════════════
//
// The old PUT resolved an unknown tone to the first tone and an unknown role
// to the closed preset. For a full-form save that was a fail-closed default;
// for a one-field save it is a silent rewrite of a field the person did not
// touch. So an unknown value is now a 400 naming the field, and the screen
// says "Couldn't save" beside that field. The READ side (roles.js roleFor,
// toneLine, voiceLine; permission.js modeOf) still fails closed on whatever a
// row holds, so a corrupt value in the database is still harmless.

import {
  AI_EMPLOYEE_ROLES,
  AI_EMPLOYEE_TONES,
  AI_EMPLOYEE_VOICES,
  instructionsFingerprint,
} from "./roles";
import { MODES, modeOf } from "./permission";
import { channelConflicts } from "./employees";
import { FACES } from "./faces";

/** How long an instruction block may be. Long enough for a real policy, short
 *  enough that it cannot be used to push the role's own rules out of context. */
export const MAX_INSTRUCTIONS = 4000;
export const MAX_SHORT = 300;
export const MAX_NAME = 60;

/** Every column one save may change. Anything else in a body is ignored —
 *  `id` included, which selects the row and is never written. */
export const EDITABLE_FIELDS = Object.freeze([
  "name",
  "displayName",
  "avatarUrl",
  "voice",
  "tone",
  "greeting",
  "instructions",
  "escalationRules",
  "handoffPhrase",
  "role",
  "mode",
  "enabled",
  "metaEnabled",
  "webChatEnabled",
  "smsEnabled",
  "businessHoursOnly",
  "maxRepliesPerThread",
]);

const BOOLEAN_FIELDS = new Set(["enabled", "metaEnabled", "webChatEnabled", "smsEnabled", "businessHoursOnly"]);
const CHANNEL_FIELDS = new Set(["enabled", "metaEnabled", "webChatEnabled", "smsEnabled"]);

export const cleanText = (v, max) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** A face is one of ours, or an https URL an upload produced. Never a data
 *  URI, never a foreign scheme. */
export function cleanAvatar(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (FACES.some((f) => f.url === s)) return s;
  return /^https:\/\/[^\s"'<>]{1,500}$/.test(s) ? s : null;
}

/**
 * The row an edit is FOR, or null. By id, inside the rows the caller read
 * under the session's companyId — so an id from another company is simply
 * not here. No fallback: not the first row, not the only row.
 */
export function targetEmployee(rows, id) {
  if (typeof id !== "string" || !id) return null;
  return (rows || []).find((r) => r && r.id === id) || null;
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const refuse = (status, reason, error, extra = {}) => ({ ok: false, status, reason, error, ...extra });

/**
 * Plan one save.
 *
 * @param rows          the company's AiEmployee rows (read under companyId)
 * @param body          the request body: { id, ...only the fields to change }
 * @param smsAvailable  does FieldQuo hold a system SMS number? Only consulted
 *                      when the body switches the text channel on.
 * @returns {{ ok: true, current, data, fields } |
 *           { ok: false, status, reason, error, field?, channels? }}
 */
export function planEmployeeSave({ rows = [], body = {}, smsAvailable = false } = {}) {
  const b = body && typeof body === "object" ? body : {};
  if (typeof b.id !== "string" || !b.id) {
    return refuse(400, "no_id", "Say which employee.");
  }
  const current = targetEmployee(rows, b.id);
  if (!current) return refuse(404, "not_found", "Not found");

  const fields = EDITABLE_FIELDS.filter((f) => has(b, f));
  if (!fields.length) return refuse(400, "nothing", "Nothing to change.");

  const data = {};
  for (const f of fields) {
    const v = b[f];
    if (f === "name") {
      const name = cleanText(v, MAX_NAME);
      // An employee with no name is introduced as "the assistant" and listed
      // as initials — so an emptied field is refused, not saved, and the
      // screen says a name is needed while the box is empty.
      if (!name) return refuse(400, "name_required", "Give it a name.", { field: f });
      data.name = name;
    } else if (f === "displayName") {
      data.displayName = cleanText(v, MAX_NAME);
    } else if (f === "avatarUrl") {
      const url = cleanAvatar(v);
      if (v && !url) return refuse(400, "bad_value", "That picture can't be used.", { field: f });
      data.avatarUrl = url;
    } else if (f === "voice") {
      if (v === null || v === "") data.voice = null;
      else if (AI_EMPLOYEE_VOICES.includes(v)) data.voice = v;
      else return refuse(400, "bad_value", "Pick a voice from the list.", { field: f });
    } else if (f === "tone") {
      if (!AI_EMPLOYEE_TONES.includes(v)) return refuse(400, "bad_value", "Pick a tone from the list.", { field: f });
      data.tone = v;
    } else if (f === "role") {
      if (!AI_EMPLOYEE_ROLES.includes(v)) return refuse(400, "bad_value", "Pick a role.", { field: f });
      if (v !== current.role && rows.some((r) => r.id !== current.id && r.role === v)) {
        return refuse(409, "role_taken", "You already have an employee in that role.", { field: f });
      }
      data.role = v;
    } else if (f === "mode") {
      // ── The mode cannot move by accident ───────────────────────────────
      // Only a value from the closed list is written. permission.js reads it
      // the same way at reply time — two checks of one rule, deliberately.
      if (!MODES.includes(v)) return refuse(400, "bad_value", "Pick one of the three settings.", { field: f });
      data.mode = v;
      // Mirrored for any reader of the old column. Nothing reads it.
      data.autoReplyEnabled = v === "auto";
    } else if (BOOLEAN_FIELDS.has(f)) {
      if (typeof v !== "boolean") return refuse(400, "bad_value", "That should be on or off.", { field: f });
      data[f] = v;
    } else if (f === "greeting" || f === "handoffPhrase") {
      data[f] = cleanText(v, MAX_SHORT);
    } else if (f === "instructions" || f === "escalationRules") {
      data[f] = cleanText(v, MAX_INSTRUCTIONS);
    } else if (f === "maxRepliesPerThread") {
      const cap = Number(v);
      if (v === null || v === "" || !Number.isFinite(cap)) {
        return refuse(400, "bad_value", "That should be a number from 0 to 10.", { field: f });
      }
      // Clamped rather than rejected once it IS a number: 0 is a legitimate
      // pause and 10 is already more of one conversation than anybody wants
      // an agent holding alone.
      data.maxRepliesPerThread = Math.max(0, Math.min(10, Math.floor(cap)));
    }
  }

  const merged = { ...current, ...data };

  // ── SMS needs a number FieldQuo holds ────────────────────────────────────
  if (data.smsEnabled === true && !smsAvailable) {
    return refuse(409, "no_system_number", "FieldQuo has no SMS number yet, so the text channel can't be switched on.", { field: "smsEnabled" });
  }

  // ── One employee per channel ─────────────────────────────────────────────
  // Only when this save touches the switch or a channel: a rename must never
  // be refused over a conflict it did not create.
  if (fields.some((f) => CHANNEL_FIELDS.has(f))) {
    const conflicts = channelConflicts(rows, { ...merged, id: current.id });
    if (conflicts.length) {
      return refuse(409, "channel_conflict", "Another employee already answers that channel. Switch it off there first.", {
        channels: conflicts,
        field: fields.find((f) => CHANNEL_FIELDS.has(f)),
      });
    }
  }

  data.instructionsFingerprint = instructionsFingerprint(merged);
  return { ok: true, current, data, fields, before: { mode: modeOf(current), enabled: current.enabled === true } };
}
