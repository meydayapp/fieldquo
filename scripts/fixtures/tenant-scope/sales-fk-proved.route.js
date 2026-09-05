// Fixture for scripts/check-tenant-scope.mjs — NOT a route. Mirrors the shape
// of app/api/sales/events/route.js: a request id handed to a rep-scoped helper
// together with `rep`, then written as a foreign key. The scanner's rule 4
// must read this as PROVED. Kept under scripts/ so routeFiles() never sees it.
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
