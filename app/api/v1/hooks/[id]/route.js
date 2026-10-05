// app/api/v1/hooks/[id]/route.js
//
// DELETE /api/v1/hooks/{id} — Zapier's REST-hook unsubscribe. Ends the
// subscription (never deletes it — the delivery log stays) and cancels what
// was still pending for it. Only the key that made it can end it.
// Docs: /developers/marketing-api.
export const runtime = "nodejs";

import { agencyResponse } from "@/lib/agency/route";
import { SCOPE_READ } from "@/lib/agency/keys";
import { unsubscribeHook } from "@/lib/agency/api";

export async function DELETE(request, { params }) {
  const { id } = await params;
  return agencyResponse(request, SCOPE_READ, (ctx) => unsubscribeHook({ ...ctx, id }));
}
