// Fixture for scripts/check-tenant-scope.mjs — NOT a route. The same shape as
// sales-fk-proved.route.js with one difference: the helper is NOT handed the
// rep, so nothing scoped the id, and the scanner must report the foreign key.
import { db } from "@/lib/db";
import { requireCalendarRep } from "@/lib/sales/calendar/gate";
import { leadContactSnapshot } from "@/lib/sales/calendar/leadContact";

export async function POST(request) {
  const { rep, refusal } = await requireCalendarRep(request);
  if (refusal) return refusal;
  const body = await request.json();
  let leadId = null;
  const snapshot = await leadContactSnapshot(body.leadId);
  if (snapshot) leadId = snapshot.id;
  return db.salesEvent.create({ data: { salesRepId: rep.id, leadId } });
}
