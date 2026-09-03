// lib/equipment/payload.js
//
// What an equipment row looks like coming out of the database, what it looks
// like going back to a browser, and how a browser's version of it is read.
//
// ══ Why not in the route file ══════════════════════════════════════════════
//
// Two routes need all three (the list/create pair and the single-row
// PATCH/DELETE pair), and a Next 16 route module may only export handlers and
// the recognised config keys — so the shared half cannot live in either of
// them. It would also be the copy-paste that rots (AGENTS.md failure class
// #4): the list route and the update route disagreeing about what a blank
// warranty date means is precisely the bug this feature is built to avoid.
import { withWarranty } from "./warranty";
import { summariseServices, sortServices } from "./history";

/** Every column a screen renders, and nothing it doesn't. */
export const EQUIPMENT_SELECT = {
  id: true,
  clientId: true,
  name: true,
  manufacturer: true,
  modelNumber: true,
  serialNumber: true,
  siteAddress: true,
  installedAt: true,
  warrantyEndsAt: true,
  warrantyProvider: true,
  warrantyNotes: true,
  installedByJobId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  services: {
    select: {
      id: true,
      jobId: true,
      servicedAt: true,
      description: true,
      underWarranty: true,
      createdAt: true,
    },
    orderBy: { servicedAt: "desc" },
  },
};

/**
 * One row, with its warranty state and history summary already computed.
 *
 * Computed on the SERVER, deliberately. The same rule is applied on the
 * expiring-soon list and on the client's own panel, and a second copy of "what
 * does a null warranty date mean" in browser JavaScript is the copy that would
 * eventually answer "expired".
 */
export function decorateEquipment(row, asOf) {
  if (!row) return null;
  const services = sortServices(row.services);
  return {
    ...withWarranty(row, { asOf }),
    services,
    history: summariseServices(services),
  };
}

/**
 * Read an equipment create/update body.
 *
 * `creating` decides only whether a missing `name` is an error (it is) or an
 * untouched field (it is).
 *
 * Every optional field follows one rule: a key that is ABSENT is left alone; a
 * key present and blank becomes NULL. That is what makes "clear the warranty
 * date I typed by mistake" possible, and it is why nothing here substitutes a
 * default for an empty value — a defaulted warranty date is a claim nobody
 * made (AGENTS.md failure class #5).
 *
 * @returns {{ data }} or {{ error }}
 */
export function parseEquipmentBody(body, { creating = false } = {}) {
  const data = {};

  const text = (key, max = 200) => {
    if (body?.[key] === undefined) return undefined;
    const v = body[key];
    if (v === null) return null;
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  };

  const name = text("name");
  if (creating) {
    if (!name)
      return { error: "Give it a name — the furnace, the panel, the water heater." };
    data.name = name;
  } else if (name !== undefined) {
    if (!name) return { error: "A name is required — it can't be blank." };
    data.name = name;
  }

  for (const key of [
    "manufacturer",
    "modelNumber",
    "serialNumber",
    "siteAddress",
    "warrantyProvider",
  ]) {
    const value = text(key);
    if (value !== undefined) data[key] = value;
  }
  for (const key of ["warrantyNotes", "notes"]) {
    const value = text(key, 2000);
    if (value !== undefined) data[key] = value;
  }

  for (const key of ["installedAt", "warrantyEndsAt"]) {
    if (body?.[key] === undefined) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      // Clearing restores "unknown", which is a real and often correct answer.
      // Refusing to clear would make a mistyped date permanent, and a WRONG
      // warranty date is worse than no warranty date.
      data[key] = null;
      continue;
    }
    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) return { error: "That date isn't a date." };
    data[key] = when;
  }

  if (body?.installedByJobId !== undefined) {
    data.installedByJobId = body.installedByJobId || null;
  }

  if (Object.keys(data).length === 0 && !creating)
    return { error: "Nothing to change." };

  return { data };
}

/** Read one service-visit body. */
export function parseServiceBody(body) {
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  if (!description)
    return { error: "Say what was done — that sentence is the service history." };

  // No default of "today". A visit logged a week later with a silently
  // defaulted date puts the wrong day in the record a warranty claim is made
  // from, and the form always sends one.
  if (!body?.servicedAt) return { error: "When was it serviced?" };
  const servicedAt = new Date(body.servicedAt);
  if (Number.isNaN(servicedAt.getTime()))
    return { error: "That date isn't a date." };

  return {
    data: {
      description: description.slice(0, 2000),
      servicedAt,
      // Strict `=== true`. The column is a non-null Boolean whose false means
      // "billed", so a missing key has to land somewhere — and "we billed
      // them" is the answer that cannot invent a warranty claim that was never
      // made. The form asks the question explicitly.
      underWarranty: body?.underWarranty === true,
      jobId: body?.jobId || null,
    },
  };
}
