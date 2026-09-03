// lib/equipment/access.js
//
// Who may read and write a customer's equipment record.
//
// ══ Why `clientsProperties` and not a new category ═════════════════════════
//
// A furnace at 14 Rue Principale is a fact about that CLIENT'S PROPERTY, and
// the grid already has the dial for that. Its serial number, its install date
// and the note saying the access panel is behind the freezer are exactly the
// "full client and property info" the category's own labels describe.
//
// A seventh permission category for one panel would also have been the mistake
// lib/permissions/costBasis.js's header names: two gates for one subject,
// which drift until the write succeeds where the read refuses.
//
// The levels, and what each buys:
//
//   name_address_only  — refused. Crew sit here. They get an address to drive
//                        to, not a page through the company's installed base,
//                        which is a list of every asset the company could be
//                        called back to and the most portable thing an
//                        employee can walk out with.
//   full_view          — read equipment and its service history.
//   full_edit          — add, edit and log a service visit.
//   full_edit_delete   — remove a record.
//
// Delete is separated from edit because the ladder already separates them and
// because a service history is the evidence behind a warranty claim: losing it
// costs a customer money, which is a different weight of mistake from a typo
// in a model number.
import { requireLevel, hasLevel } from "@/lib/permissions/enforce";

export const EQUIPMENT_CATEGORY = "clientsProperties";
export const EQUIPMENT_READ_LEVEL = "full_view";
export const EQUIPMENT_WRITE_LEVEL = "full_edit";
export const EQUIPMENT_DELETE_LEVEL = "full_edit_delete";

export function canReadEquipment(member) {
  return hasLevel(member, EQUIPMENT_CATEGORY, EQUIPMENT_READ_LEVEL);
}

export function canWriteEquipment(member) {
  return hasLevel(member, EQUIPMENT_CATEGORY, EQUIPMENT_WRITE_LEVEL);
}

export function canDeleteEquipment(member) {
  return hasLevel(member, EQUIPMENT_CATEGORY, EQUIPMENT_DELETE_LEVEL);
}

export function requireEquipmentRead(member) {
  requireLevel(member, EQUIPMENT_CATEGORY, EQUIPMENT_READ_LEVEL, "see client equipment");
}

export function requireEquipmentWrite(member) {
  requireLevel(member, EQUIPMENT_CATEGORY, EQUIPMENT_WRITE_LEVEL, "change client equipment");
}

export function requireEquipmentDelete(member) {
  requireLevel(
    member,
    EQUIPMENT_CATEGORY,
    EQUIPMENT_DELETE_LEVEL,
    "delete a client equipment record",
  );
}
