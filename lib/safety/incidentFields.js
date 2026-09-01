// lib/safety/incidentFields.js
//
// The closed vocabularies for SafetyIncident.kind and .status, and the
// validation/normalisation every route that touches one goes through.
//
// Pure — no database, no `t()`. The UI keys (app.safety.kind.*, .status.*)
// live in app/i18n/appMessages.js and are looked up by the SAME string this
// file returns, so a screen can translate any incident with one lookup and
// this file never needs to know a language exists.

/// injury and near_miss are singled out on purpose (see the header comment on
/// the SafetyIncident model): a trade that only logs injuries learns nothing
/// until someone is hurt. property_damage and other exist because not every
/// incident worth a record involved a person at all — a ladder through a
/// client's drywall is a safety-process failure even though nobody was hurt.
export const INCIDENT_KINDS = ["injury", "near_miss", "property_damage", "other"];

/// near_miss is the default a blank form starts from — see the model comment
/// for why defaulting toward the harmless case, not the alarming one, matters.
export const DEFAULT_INCIDENT_KIND = "near_miss";

/// open      — filed, nobody has followed up yet.
/// reviewed  — someone with authority has looked at it and (usually) left a
///             followUpNotes entry. Not the same as "resolved" — a reviewed
///             near-miss might still be waiting on a guard rail to be bought.
/// closed    — done. Nothing is ever deleted; this is as final as the record
///             gets.
export const INCIDENT_STATUSES = ["open", "reviewed", "closed"];
export const DEFAULT_INCIDENT_STATUS = "open";

export function isIncidentKind(value) {
  return INCIDENT_KINDS.includes(value);
}

export function isIncidentStatus(value) {
  return INCIDENT_STATUSES.includes(value);
}

/** Coerce a stored/submitted kind to a real one, defaulting safely. */
export function normaliseIncidentKind(value) {
  return isIncidentKind(value) ? value : DEFAULT_INCIDENT_KIND;
}

/** Coerce a stored/submitted status to a real one, defaulting safely. */
export function normaliseIncidentStatus(value) {
  return isIncidentStatus(value) ? value : DEFAULT_INCIDENT_STATUS;
}

const MAX_DESCRIPTION = 4000;
const MAX_LOCATION = 200;
const MAX_NOTE = 4000;

/**
 * The browser → database boundary for creating an incident.
 *
 * Everything here arrives as whatever a phone's form produced, so nothing is
 * trusted: strings are trimmed and length-capped, `occurredAt` is parsed and
 * refused rather than silently defaulted to "now" (a report filed an hour
 * later must be able to say when it actually happened), and `kind` falls back
 * to the safe default rather than accepting whatever string was posted.
 *
 * Returns `{ error }` for a request this cannot use, or `{ data }` ready for
 * `db.safetyIncident.create`.
 */
export function normaliseIncidentInput(input) {
  if (!input || typeof input !== "object") {
    return { error: "No incident data was submitted." };
  }

  const description = String(input.description ?? "").trim().slice(0, MAX_DESCRIPTION);
  if (!description) {
    return { error: "Say what happened — that's the one thing this report needs." };
  }

  let occurredAt = new Date();
  if (input.occurredAt !== undefined && input.occurredAt !== null && input.occurredAt !== "") {
    const parsed = new Date(input.occurredAt);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "That date and time isn't valid." };
    }
    // A report filed for a future moment is a typo, not a prediction.
    if (parsed.getTime() > Date.now() + 60 * 60 * 1000) {
      return { error: "That's in the future — check the date and time." };
    }
    occurredAt = parsed;
  }

  return {
    data: {
      kind: normaliseIncidentKind(input.kind),
      description,
      occurredAt,
      location: input.location ? String(input.location).trim().slice(0, MAX_LOCATION) || null : null,
      workStopped: !!input.workStopped,
      regulatoryNote: input.regulatoryNote
        ? String(input.regulatoryNote).trim().slice(0, MAX_NOTE) || null
        : null,
      jobId: typeof input.jobId === "string" && input.jobId ? input.jobId : null,
      involvedWorkerId:
        typeof input.involvedWorkerId === "string" && input.involvedWorkerId
          ? input.involvedWorkerId
          : null,
    },
  };
}

/**
 * The boundary for a follow-up PATCH — status, follow-up notes, the
 * regulatory note, and (if ever needed) a correction to the original facts.
 * Deliberately narrow: this is the ONLY writer that runs after the initial
 * report, and it can never touch `reportedByMemberId` or `createdAt` — who
 * filed it and when are facts about the report, not the incident.
 */
export function normaliseIncidentUpdate(input) {
  if (!input || typeof input !== "object") return { data: {} };
  const data = {};

  if (input.status !== undefined) data.status = normaliseIncidentStatus(input.status);
  if (input.followUpNotes !== undefined) {
    data.followUpNotes = input.followUpNotes
      ? String(input.followUpNotes).trim().slice(0, MAX_NOTE) || null
      : null;
  }
  if (input.regulatoryNote !== undefined) {
    data.regulatoryNote = input.regulatoryNote
      ? String(input.regulatoryNote).trim().slice(0, MAX_NOTE) || null
      : null;
  }
  if (input.workStopped !== undefined) data.workStopped = !!input.workStopped;

  return { data };
}
