// app/api/platform/push-subscription/route.js
//
// The /platform mount of lib/notify/pushSubscriptionRoute.js. Any active
// platform admin, at any role: which browser rings for a person is their
// own preference, and the EVENTS are already scoped by role at the sender
// (lib/notify/push.js pushToPlatformRoles) — a support-role admin who
// subscribes is told about nothing a superadmin-only event carries.
export const runtime = "nodejs";

import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { pushSubscriptionHandlers } from "@/lib/notify/pushSubscriptionRoute";

const handlers = pushSubscriptionHandlers(
  async (request) => {
    const admin = await getCurrentPlatformAdmin(request);
    if (!admin) return { refusal: { status: 401, body: { error: "Unauthorized" } } };
    return { owner: { platformAdminId: admin.id } };
  },
  { testUrl: "/platform/settings" },
);

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
