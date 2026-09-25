// lib/quotes/cabinetServiceSwitch.js
//
// Refinish | Reface, inside one cabinet scope group.
//
// ── What the owner asked for (2026-09-22) ───────────────────────────────────
//
// "Combine" cabinet refinishing and refacing into one cabinet scope with a
// switch inside the card. A company that sells both counts the kitchen ONCE —
// doors, drawers, complexity answers, upgrades — and then decides, often with
// the homeowner standing there, which of the two jobs it is quoting. Before
// this, changing its mind meant deleting the group and typing every count
// again into a second one.
//
// ── Why it swaps the group's service rather than merging the two trades ─────
//
// cabinet_refinishing and cabinet_refacing stay two ServiceCategory rows,
// two price books, two rate cards in Settings. Merging them would move every
// stored quote, every rate override and every instant-quote setting at once,
// which is the "replace a working control" the owner has ruled out. The
// switch instead changes WHICH of the two a still-unsaved group belongs to:
// its categoryId / categoryKey, and the per-unit base price that comes from
// that trade's book. Everything the builder already derives from the
// category — the add-on rates, the complexity grid, the scope paragraph, the
// cost estimate — then follows by itself, because each of those reads
// `group.categoryKey` at render and at save. Nothing downstream learned a
// new shape, so nothing downstream can price it differently.
//
// ── What carries, and what does not ─────────────────────────────────────────
//
// CARRIES, untouched (it is a statement about the kitchen, not about the
// service): intakeValues (doors, drawers, wood species, box linear ft and
// anything else answered), the complexity chip and its custom upcharge, the
// complexity reasons, the factor answers, the upgrade ticks and their
// counts, colour / sheen / door style, the typed extra lines, the
// estimator's custom factors.
//
// Of those, the MONEY attached is re-read from the target trade's own book:
// the add-on rates, and — on the factor model — the Moderate/High per-unit
// figures. The same answers price at the other trade's rates, which is what
// "swap the pricing model, keep the counts" means. An upgrade the target
// book does not price (a company that zeroed slides on refacing) stays
// ticked and adds nothing, exactly as it does on a fresh group of that trade
// today; switching back prices it again.
//
// SWAPPED: categoryId, categoryKey, customFields, and baseUnitPrice — the
// one figure that IS the service. Its first visit opens at what a brand-new
// group of the target trade would open at (newScopeGroup's own seeding, not
// a second copy of it), so switching is never cheaper or dearer than having
// picked that tile in the first place.
//
// RESTORED EXACTLY on the way back: the base price each service had when it
// was switched away from is kept in `serviceFigures`, keyed by trade. A
// price the estimator typed over on refinishing is still there after a look
// at refacing. `serviceFigures` lives on the builder's in-memory group only —
// scopeGroupPayload names every field it sends and this is not one of them,
// so the saved row, and therefore the client's document, carries the chosen
// service and nothing about the other.
//
// The NAME follows only while it is still the service's own name. A group the
// estimator called "Vanity" keeps "Vanity"; one still called "Cabinet
// Refinishing" becomes "Cabinet Refacing", and back.
//
// ── Why only an unsaved group ───────────────────────────────────────────────
//
// A stored group has already been flattened into priced lines — see the
// header of lib/quotes/builderPayload.js. Switching it would reprice a quote
// that may already be in the client's inbox, so the switch is offered only
// where the unit pricing card itself is (`!group.persisted`).

import { UNIT_PRICED_CATEGORIES, isUnitPriced } from "@/app/data/cabinetPricing";
import { newScopeGroup } from "@/lib/quotes/builderPayload";

/**
 * The two cabinet services this company sells, in switch order
 * (refinishing first, as UNIT_PRICED_CATEGORIES lists them), or null when
 * the switch must not render: the group is saved, is not a cabinet group, or
 * the company does not sell BOTH. Absence of a second service is not a
 * reason to draw a one-button switch.
 *
 * @param group       the builder's group
 * @param categories  the company's ENABLED service categories
 */
export function cabinetServiceOptions(group, categories) {
  if (!group || group.persisted || group.imported) return null;
  if (!isUnitPriced(group.categoryKey)) return null;
  const list = Array.isArray(categories) ? categories : [];
  const options = UNIT_PRICED_CATEGORIES.map((key) =>
    list.find((c) => c && c.key === key && c.id),
  );
  if (options.some((c) => !c)) return null;
  return options;
}

/**
 * The same group, moved onto `target`'s pricing.
 *
 * Pure: returns a new object and never mutates `group`. Returns `group`
 * itself (same reference) when there is nothing to do — the target is the
 * service it is already on, or the move is not one this switch makes — so a
 * double press cannot write a new base price.
 *
 * @param group            the builder's group
 * @param target           the service-categories row to move to
 * @param currentCategory  the row the group is on now (for its default name)
 * @param rateOverrides    the company's patch over TARGET's price book
 */
export function switchCabinetService(group, target, { currentCategory = null, rateOverrides = null } = {}) {
  if (!group || !target) return group;
  if (group.persisted || group.imported) return group;
  if (!isUnitPriced(group.categoryKey) || !isUnitPriced(target.key)) return group;
  if (target.key === group.categoryKey && target.id === group.categoryId) return group;

  const remembered = {
    ...(group.serviceFigures && typeof group.serviceFigures === "object" ? group.serviceFigures : {}),
    [group.categoryKey]: { baseUnitPrice: group.baseUnitPrice },
  };
  const back = remembered[target.key];
  // First visit to this service: what a new group of it would open at. Seeded
  // through newScopeGroup so there is one definition of that figure.
  const baseUnitPrice =
    back && back.baseUnitPrice !== undefined
      ? back.baseUnitPrice
      : newScopeGroup(target, target.label, rateOverrides, { tempId: group.tempId }).baseUnitPrice;

  const ownName = String(currentCategory?.label || "").trim();
  const label = String(group.label || "").trim();
  const followsService = !label || (ownName && label === ownName);

  return {
    ...group,
    categoryId: target.id,
    categoryKey: target.key,
    customFields: target.customFields || null,
    baseUnitPrice,
    ...(followsService ? { label: target.label } : {}),
    serviceFigures: remembered,
  };
}
