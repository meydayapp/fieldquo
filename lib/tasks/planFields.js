// lib/tasks/planFields.js
//
// The plan fields a task request may carry, validated once for both
// POST /api/tasks and PATCH /api/tasks/[id]. Pure. Same discipline as
// normaliseRequiredPhotoCount in lib/tasks/completion.js: omitted means
// unchanged, blank means null, and anything that is not a number where a
// number belongs is refused rather than coerced — `Number([3]) === 3` and
// `Number(true) === 1` are not estimates anyone typed.

export const ESTIMATED_HOURS_MAX = 999;
export const WAITING_REASON_MAX = 300;

const isPlainNumber = (v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "");

/**
 * @returns {{ ok: true, value: object, data: object } | { ok: false, error: string }}
 *   `value` — every field, normalised (dependsOn always an array)
 *   `data`  — only the fields the body mentioned, ready to spread into a
 *             Prisma write (dependsOn excluded; it is a relation write)
 */
export function normalisePlanFields(body = {}) {
  const b = body && typeof body === "object" ? body : {};
  const value = { dependsOn: [] };
  const data = {};

  if ("estimatedHours" in b) {
    const raw = b.estimatedHours;
    if (raw === null || raw === undefined || raw === "") {
      value.estimatedHours = null;
    } else {
      if (!isPlainNumber(raw)) return { ok: false, error: "estimatedHours must be a number of hours." };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > ESTIMATED_HOURS_MAX) {
        return { ok: false, error: `estimatedHours must be between 0 and ${ESTIMATED_HOURS_MAX}.` };
      }
      value.estimatedHours = Math.round(n * 100) / 100;
    }
    data.estimatedHours = value.estimatedHours;
  }

  if ("sortOrder" in b) {
    const n = Number(b.sortOrder);
    if (!isPlainNumber(b.sortOrder) || !Number.isInteger(n) || n < 0 || n > 100000) {
      return { ok: false, error: "sortOrder must be a whole number." };
    }
    value.sortOrder = n;
    data.sortOrder = n;
  }

  if ("waitingReason" in b) {
    const raw = b.waitingReason;
    if (raw !== null && raw !== undefined && typeof raw !== "string") {
      return { ok: false, error: "waitingReason must be text." };
    }
    value.waitingReason = String(raw ?? "").trim().slice(0, WAITING_REASON_MAX) || null;
    data.waitingReason = value.waitingReason;
  }

  for (const flag of ["clientVisible", "planStep"]) {
    if (flag in b) {
      if (typeof b[flag] !== "boolean") return { ok: false, error: `${flag} must be true or false.` };
      value[flag] = b[flag];
      data[flag] = b[flag];
    }
  }

  for (const when of ["scheduledStart", "scheduledEnd"]) {
    if (when in b) {
      const raw = b[when];
      if (raw === null || raw === undefined || raw === "") {
        value[when] = null;
      } else {
        const d = new Date(raw);
        if (typeof raw !== "string" || Number.isNaN(d.getTime())) {
          return { ok: false, error: `${when} must be a date and time.` };
        }
        value[when] = d;
      }
      data[when] = value[when];
    }
  }
  if (value.scheduledStart && value.scheduledEnd && value.scheduledEnd <= value.scheduledStart) {
    return { ok: false, error: "The block has to end after it starts." };
  }

  if ("dependsOn" in b) {
    const raw = b.dependsOn;
    if (raw !== null && raw !== undefined && !Array.isArray(raw)) {
      return { ok: false, error: "dependsOn must be a list of step ids." };
    }
    const ids = (raw || []).filter((v) => typeof v === "string" && v.trim());
    if (ids.length !== (raw || []).length) return { ok: false, error: "dependsOn must be a list of step ids." };
    if (ids.length > 50) return { ok: false, error: "A step can wait on at most 50 others." };
    value.dependsOn = ids;
  }

  return { ok: true, value, data };
}
