// app/api/sales/push-subscription/route.js
//
// The /sales mount of lib/notify/pushSubscriptionRoute.js.
//
// requireOutreachRep, not requireSalesRep, for the reason
// app/api/sales/language/route.js gives at length: requireSalesRep refuses
// every non-GET under /api/sales by design, and requireOutreachRep is the
// named exception in front of writes that are the rep's own — a fact about
// themselves that decides no money. Which browser rings for them is that
// shape exactly. pushSubscription is not on REP_FORBIDDEN_WRITES and is not
// a table the outreach scan lists; scripts/check-browser-notifications.mjs
// asserts this route writes that table and nothing else.
export const runtime = "nodejs";

import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { pushSubscriptionHandlers } from "@/lib/notify/pushSubscriptionRoute";

const handlers = pushSubscriptionHandlers(
  async (request) => {
    const { rep, refusal } = await requireOutreachRep(request);
    if (refusal) return { refusal };
    return { owner: { salesRepId: rep.id } };
  },
  { testUrl: "/sales/pay" },
);

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
