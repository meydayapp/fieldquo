// The Browser notifications block as /app/settings/notifications mounts it,
// against a stubbed subscription route: ?push=off (no VAPID keys on the
// deployment) or ?push=on (keys set, one live subscription), ?perm=granted|default|denied.
import React from "react";
import { createRoot } from "react-dom/client";
import BrowserNotifications from "@/app/components/notifications/BrowserNotifications";

const params = new URLSearchParams(window.location.search);
const perm = params.get("perm") || "default";
class FakeNotification { constructor() {} close() {} }
FakeNotification.permission = perm;
FakeNotification.requestPermission = async () => perm;
window.Notification = FakeNotification;
if (params.get("enabled") === "1") window.localStorage.setItem("fq-browser-notifications", "1");
else window.localStorage.removeItem("fq-browser-notifications");

createRoot(document.getElementById("root")).render(
  <div className="min-h-screen bg-background p-6">
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Who is told when something happens, and how.</p>
      </div>
      <BrowserNotifications endpoint="/api/notifications/push-subscription" />
    </div>
  </div>,
);
setTimeout(() => document.documentElement.setAttribute("data-harness-done", "1"), 700);
