// app/api/notifications/push-subscription/route.js
//
// The /app mount of lib/notify/pushSubscriptionRoute.js: a signed-in member
// subscribing (or unsubscribing) THIS browser to push for their own account.
// The owner column is User, not Member: a person with two companies is one
// browser, and the events fan out per company through
// lib/notifications/notify.js, which knows both memberships.
//
// Impersonation reaches here with `member.userId === null` and is refused —
// a support agent's browser must never be subscribed to a customer's leads.
export const runtime = "nodejs";

import { memberOrRefusalPlain } from "@/lib/apiMember";
import { pushSubscriptionHandlers } from "@/lib/notify/pushSubscriptionRoute";

const handlers = pushSubscriptionHandlers(
  async (request) => {
    const { member, refusal } = await memberOrRefusalPlain(request);
    if (refusal) {
      const { status, ...body } = refusal;
      return { refusal: { status, body } };
    }
    if (!member.userId) {
      return { refusal: { status: 403, body: { error: "A read-only support session cannot subscribe to notifications." } } };
    }
    return { owner: { userId: member.userId } };
  },
  { testUrl: "/app/settings/notifications" },
);

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
