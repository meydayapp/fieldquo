// Fixture for scripts/check-tenant-scope.mjs — NOT a route. A COMPANY-surface
// handler that names a variable `rep` and hands it to a helper with a request
// id. Off the sales surface that proves nothing — the rep rule is a boundary,
// not a magic word — so the scanner must still report the foreign key.
import { db } from "@/lib/db";
import { requireCalendarRep } from "@/lib/sales/calendar/gate";
import { leadContactSnapshot } from "@/lib/sales/calendar/leadContact";

export async function POST(request) {
  const { rep, refusal } = await requireCalendarRep(request);
  if (refusal) return refusal;
  const body = await request.json();
  let leadId = null;
  const snapshot = await leadContactSnapshot(body.leadId, rep.id);
  if (snapshot) leadId = snapshot.id;
  return db.salesEvent.create({ data: { salesRepId: rep.id, leadId } });
}
