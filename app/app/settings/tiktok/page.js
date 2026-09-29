// app/app/settings/tiktok/page.js
//
// Settings › TikTok — connect the company's TikTok account, see which account
// is connected, disconnect it. The states and their rules live in
// app/components/settings/TikTokPanel.js; this file is the page frame and the
// same "billing" gate the other connection screens on this shelf use
// (lib/permissions/settingsAccess.js), matching the routes behind it:
// app/api/tiktok/status, connect and disconnect all require isBillingAdmin.
"use client";

import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import TikTokPanel from "@/app/components/settings/TikTokPanel";

export default function TikTokSettingsPage() {
  const access = useSettingsAccess();
  if (!access.canSee("billing")) return <NoAccessPanel capability="billing" />;
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <TikTokPanel />
    </div>
  );
}
