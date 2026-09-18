// lib/assets/create.js
//
// Reading an asset row off a request, and writing one — the cost-basis rules
// in one place.
//
// ══ Why this left app/api/assets/route.js ══════════════════════════════════
//
// POST /api/fleet gained a second door onto the register: "Add a vehicle"
// creates the Asset and its fleet record in one transaction, because the
// owner opened /app/fleet, saw no way to add a van, and did not know vans are
// born in Settings → Overhead. That door has to apply exactly the rules the
// register applies — salvage below cost, a life between 1 and 600 months, no
// invented life — and a second copy of those rules is the copy that rots
// (AGENTS.md failure class #4). So the register's parse and write live here
// and both routes call them.
//
// ══ The one relaxation, and who may use it ═════════════════════════════════
//
// The register refuses a zero cost: "a zero-cost asset depreciates nothing
// and would sit in the register changing no number on the screen it was
// entered from — a row that appears to work and doesn't." That is right for
// the Overhead screen, whose whole point is the number.
//
// The fleet screen's point is the plate, the insurance date and who has the
// van. A van whose purchase price nobody remembers still needs to be on it,
// and refusing the van until the invoice turns up hides an expiring insurance
// certificate behind a bookkeeping question. So `costOptional` lets a blank
// price through as 0, and lib/accounting/depreciation.js reports that row as
// `no_cost_recorded` — its own reason, never "fully depreciated" — so every
// screen that shows the number says why it is nothing. The price can be
// added later through PATCH /api/assets/[id] (partial mode below), which is
// what the fleet card offers; without that door the blank would be permanent
// and "optional" would be a dead end.
//
// The blank is never filled with a guess. A $0 that says "no price recorded"
// is honest; a $45,000 that somebody's category average produced is not.

import { assetCharge } from "@/lib/accounting/depreciation";
import { isAssetCategory } from "@/lib/costing/assetLifeSuggestions";

/** The columns every asset screen renders. */
export const ASSET_SELECT = {
  id: true,
  name: true,
  cost: true,
  salvageValue: true,
  inServiceDate: true,
  usefulLifeMonths: true,
  disposedOn: true,
  active: true,
  debtId: true,
  notes: true,
  category: true,
  debt: { select: { id: true, name: true, monthlyPayment: true } },
};

/** The fifty-year ceiling, past which this is a building, not equipment. */
export const MAX_LIFE_MONTHS = 600;

/**
 * The row plus what it currently charges.
 *
 * Computed here rather than left to the browser: the same maths already
 * decides the company's price floor on the server, and a second copy in
 * client JavaScript is the copy that drifts — the screen would then disagree
 * with the number it is explaining.
 */
export function withCharge(row, asOf) {
  const charge = assetCharge(row, asOf);
  return {
    ...row,
    monthlyDepreciation: Math.round(charge.monthly * 100) / 100,
    accumulatedDepreciation: Math.round(charge.accumulated * 100) / 100,
    bookValue: Math.round(charge.bookValue * 100) / 100,
    chargeable: charge.chargeable,
    // Why the charge is what it is. A $0 with no reason beside it reads as a
    // broken screen; "sold in March" reads as an answer.
    chargeReason: charge.reason,
  };
}

const isBlank = (v) => v === undefined || v === null || v === "";

/**
 * Read an asset body.
 *
 * @param body
 * @param {object} opts
 * @param {boolean} [opts.partial=false]  PATCH mode: an ABSENT key leaves the
 *                  column alone; only what is present is validated. Create
 *                  mode requires name, cost (unless costOptional) and life.
 * @param {boolean} [opts.costOptional=false]  a blank cost becomes 0 and is
 *                  reported as `no_cost_recorded`. Only the fleet door passes
 *                  this — see the header.
 * @returns {{ data }} or {{ error }}
 *
 * In partial mode the salvage-below-cost rule is checked against whichever of
 * the two the request did NOT send, supplied by the caller as `existing`, so
 * a PATCH that only lowers the cost cannot leave the salvage value above it.
 */
export function parseAssetBody(body, { partial = false, costOptional = false, existing = null } = {}) {
  const data = {};

  if (!partial || body?.name !== undefined) {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return { error: "Give the asset a name — the truck, the trailer, the spray rig." };
    }
    data.name = name;
  }

  if (!partial || body?.cost !== undefined) {
    if (isBlank(body?.cost) && costOptional) {
      data.cost = 0;
    } else {
      const cost = Number(body?.cost);
      // `> 0`: a zero-cost asset depreciates nothing and would sit in the
      // register changing no number on the screen it was entered from — a
      // row that appears to work and doesn't. The fleet door is the one
      // exception, and it says so on its own screen (costOptional above).
      if (!Number.isFinite(cost) || cost <= 0) {
        return { error: "Enter what it cost, greater than zero." };
      }
      data.cost = cost;
    }
  }

  if (!partial || body?.salvageValue !== undefined) {
    const salvageValue = isBlank(body?.salvageValue) ? 0 : Number(body.salvageValue);
    if (!Number.isFinite(salvageValue) || salvageValue < 0) {
      return { error: "Salvage value can't be negative." };
    }
    data.salvageValue = salvageValue;
  }

  // Refused rather than clamped. A salvage value above cost means the item
  // appreciates, the depreciable base would be negative, and a negative charge
  // would LOWER the company's price floor. The library floors it at zero as a
  // last defence; the person typing it deserves to be told instead.
  //
  // A cost of 0 (the fleet door's "not recorded") is exempt: there is nothing
  // to depreciate yet, and a salvage of 0 against it is the only value the
  // form can send.
  {
    const cost = data.cost !== undefined ? data.cost : Number(existing?.cost);
    const salvage =
      data.salvageValue !== undefined ? data.salvageValue : Number(existing?.salvageValue ?? 0);
    if (Number.isFinite(cost) && cost > 0 && Number.isFinite(salvage) && salvage >= cost) {
      return {
        error:
          "Salvage value has to be less than what it cost — otherwise there's nothing to depreciate.",
      };
    }
  }

  if (!partial || body?.usefulLifeMonths !== undefined) {
    const usefulLifeMonths = Number(body?.usefulLifeMonths);
    // No default life. Inventing five years for a blank field is padding
    // absent data with a default, and the output is a price floor (AGENTS.md
    // #5). 600 months is fifty years, past which this is a building.
    if (
      !Number.isInteger(usefulLifeMonths) ||
      usefulLifeMonths < 1 ||
      usefulLifeMonths > MAX_LIFE_MONTHS
    ) {
      return { error: `How many months will you get out of it? Between 1 and ${MAX_LIFE_MONTHS}.` };
    }
    data.usefulLifeMonths = usefulLifeMonths;
  }

  if (!partial || body?.inServiceDate !== undefined) {
    // Blank on create is "today", which is the register's long-standing
    // reading and is said on the form. Blank on a PATCH is refused rather
    // than read as today: a person clearing the field is not saying the van
    // went into service this morning.
    if (isBlank(body?.inServiceDate)) {
      if (partial) return { error: "That in-service date isn't a date." };
      data.inServiceDate = new Date();
    } else {
      const when = new Date(body.inServiceDate);
      if (Number.isNaN(when.getTime())) {
        return { error: "That in-service date isn't a date." };
      }
      data.inServiceDate = when;
    }
  }

  if (!partial || body?.notes !== undefined) {
    data.notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
  }

  if (!partial || body?.category !== undefined) {
    // A recognised key or null — never whatever string the browser sent.
    // lib/costing/assetLifeSuggestions.js is the ONLY place that offers a
    // life-months SUGGESTION for a category, and it never writes
    // usefulLifeMonths itself; the form already required the person to type
    // or accept one before this request could be sent.
    data.category = isAssetCategory(body?.category) ? body.category : null;
  }

  if (!partial) {
    data.debtId = body?.debtId || null;
  } else if (body?.debtId !== undefined) {
    data.debtId = body.debtId || null;
  }

  if (partial && Object.keys(data).length === 0) return { error: "Nothing to change." };

  return { data };
}

/**
 * Write the row. `tx` is a Prisma client OR a transaction client, so the
 * fleet door can create the asset and its VehicleDetail atomically.
 *
 * Tenant proof of `debtId` is the CALLER's — it needs a NextResponse to shape
 * the refusal, and this helper is shared with a transaction that has already
 * begun.
 */
export function createAssetRow(tx, { companyId, data }) {
  return tx.asset.create({
    data: { companyId, ...data },
    select: ASSET_SELECT,
  });
}

/** The activity row every asset creation leaves, whichever door it came in. */
export function assetAddedActivity(created, { via } = {}) {
  const cost = Number(created.cost) || 0;
  return {
    action: "settings.asset_added",
    entityType: "settings",
    entityId: created.id,
    summary:
      cost > 0
        ? `Added asset ${created.name} at $${cost} over ${created.usefulLifeMonths} months`
        : `Added asset ${created.name} with no purchase price recorded`,
    metadata: {
      name: created.name,
      cost,
      usefulLifeMonths: created.usefulLifeMonths,
      linkedToDebt: !!created.debtId,
      costRecorded: cost > 0,
      ...(via && { via }),
    },
  };
}
