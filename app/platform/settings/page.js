// app/platform/settings/page.js
//
// A platform admin's own settings — today, one block: browser notifications
// for the console (a new support ticket, a Jennifer escalation). The
// console had no settings screen before this; the two things an admin
// could set about themselves lived nowhere. Under "Admin" in the rail,
// beside Platform team, because it is about the person at the console and
// not about any company.
//
// English only, like the rest of the console — the block itself reads the
// shared catalogue, so it will follow a language switch if the console ever
// grows one.
"use client";

import BrowserNotifications from "@/app/components/notifications/BrowserNotifications";

export default function PlatformSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preferences for you at this console. Nothing here changes a company&apos;s data.
        </p>
      </div>
      <BrowserNotifications endpoint="/api/platform/push-subscription" />
    </div>
  );
}
