// lib/sales/discovery/campaignGate.js
//
// Whether a discovery campaign may START, given where its territory is.
//
// ══ Why a campaign is gated at all, when the dial is already gated ═════════
//
// lib/sales/callingRules.js decides whether FieldQuo may RING one business, and
// it decides it at the moment somebody presses call. `registration.done` is a
// WARNING there, deliberately: nothing in this system can know whether a
// certificate is in the drawer, and refusing every call in a state on the
// strength of a boolean somebody forgot to flip would be worse than saying so
// beside the button.
//
// That argument does not carry to a campaign. A campaign is not a call — it is
// a decision to spend the platform's pipeline banking and researching tens of
// thousands of rows in a state where FieldQuo is not registered to solicit. The
// rows would sit in a queue where every single one shows "registration
// outstanding", and the pipeline budget would already be spent. Washington's
// register alone is 75,887 rows.
//
// So the gate is on START, which is the moment the spending begins, and the
// campaign is still CREATED. That is exactly what the manual creation script
// did by hand ("gated: left as draft") and it is the shape the owner already
// accepted; this file is that rule moved out of a script on somebody's laptop
// and into the route, where the button is.
//
// ══ Why the jurisdiction table is injected ═════════════════════════════════
//
// `jurisdictions` is a parameter with the real table as its default, so
// scripts/check-snapshot-campaigns.mjs can hand in a table with
// `registration.done` flipped and prove the answer flips with it. A gate that
// can only be read is a gate nobody can show is load-bearing — and this one has
// to be, because it is the only thing between an unregistered state and 75,887
// dials.
import { CALLING_JURISDICTIONS, jurisdictionKey } from "@/lib/sales/callingRules";

/**
 * What the calling-rules table says about registration where this territory is.
 *
 * @returns {{
 *   code: string, name: string, verified: boolean,
 *   required: boolean, done: boolean, what: string|null
 * } | null}  null when nobody has read this jurisdiction's law — which is not
 *            the same as "no registration is required", and is reported as its
 *            own state rather than folded into one.
 */
export function territoryRegistration(territory = {}, { jurisdictions = CALLING_JURISDICTIONS } = {}) {
  const key = jurisdictionKey({ country: territory?.country, province: territory?.province });
  const row = key ? jurisdictions[key] || null : null;
  if (!row) return null;
  const registration = row.registration || null;
  return {
    code: row.code,
    name: row.name,
    verified: row.verified === true,
    required: registration?.required === true,
    // A registration that is required and not done is the gate. `done` on a row
    // with no registration requirement is meaningless and is reported as true
    // so no caller has to special-case it.
    done: registration?.required === true ? registration.done === true : true,
    what: registration?.what || null,
  };
}

/**
 * Why this campaign cannot be started, as sentences somebody can act on.
 *
 * Empty means the territory is no obstacle. This does NOT repeat the source
 * checks — `startProblems` in sources.js owns those, and the start route calls
 * both, so a campaign with an unreachable snapshot AND an unregistered state
 * hears about both rather than about whichever check ran first.
 */
export function campaignStartBlockers(territory = null, { jurisdictions = CALLING_JURISDICTIONS } = {}) {
  if (!territory) {
    return [
      {
        code: "no_territory",
        title: "This campaign has no territory, so nothing can say where its calls would land.",
        fix: "Calling hours and registration are set by the place the phone rings. Give it a territory.",
      },
    ];
  }
  const registration = territoryRegistration(territory, { jurisdictions });
  if (!registration) return [];
  if (!registration.required || registration.done) return [];
  return [
    {
      code: "registration_outstanding",
      title: `FieldQuo is not registered to make sales calls into ${registration.name}.`,
      fix:
        `${registration.what || "Registration is a filing, not code."} The campaign is saved as a draft: ` +
        `banking rows here would spend the pipeline on a queue where every prospect shows the same ` +
        `warning and nobody may be dialled. Flip registration.done in lib/sales/callingRules.js when the ` +
        `certificate is in hand, citing the number, and start it then.`,
    },
  ];
}

/** Can this campaign be started? The one question the route asks. */
export function campaignCanStart(territory, options) {
  return campaignStartBlockers(territory, options).length === 0;
}

/**
 * Every jurisdiction whose registration is outstanding, with the rows each one
 * would unlock, biggest first.
 *
 * ══ Why this is ordered by rows and not alphabetically ════════════════════
 *
 * Registering is a form, a fee and a bond, one jurisdiction at a time. Ordered
 * by what each unlocks, the list answers the only question worth asking of it —
 * which one to do first. The row counts come from the snapshot library, which
 * measured them off the files; a jurisdiction the bucket holds nothing for is
 * still listed, with `rows: 0`, because it is still a place FieldQuo may not
 * call and hiding it would make the list look complete when it is not.
 *
 * @param {{rowsByRegion?: Record<string, number>}} options
 *        `rowsByRegion` is keyed the way jurisdictionKey spells it — "CA",
 *        "US-WA" — so the caller does the region arithmetic and this stays
 *        free of the snapshot data.
 */
export function outstandingRegistrations({ jurisdictions = CALLING_JURISDICTIONS, rowsByRegion = {} } = {}) {
  const rows = [];
  for (const [code, jurisdiction] of Object.entries(jurisdictions)) {
    const registration = jurisdiction?.registration;
    if (!registration?.required || registration.done === true) continue;
    rows.push({
      code,
      name: jurisdiction.name,
      rows: Number(rowsByRegion[code] || 0),
      what: registration.what || null,
    });
  }
  // Rows first, then name, so the order is stable when two unlock the same
  // number — an unstable list re-orders itself on every load and nobody can
  // tell whether anything changed.
  return rows.sort((a, b) => b.rows - a.rows || a.name.localeCompare(b.name));
}
