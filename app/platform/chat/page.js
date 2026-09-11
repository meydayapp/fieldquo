"use client";

// app/platform/chat/page.js
//
// Platform staff's view of the same conversations a rep sees at /sales/team.
// One component, one API, one set of rooms — the whole point of the feature is
// that the two sides can reach each other.
//
// NOT /platform/team. That route already exists and is FieldQuo's staff
// ACCOUNTS screen — creating admins, setting roles. This was briefly written
// over it; the two are different enough that sharing a word was never going to
// end well, so the chat is "chat" and the account admin keeps "team".
import StaffChat from "@/app/components/staff/StaffChat";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PlatformChatPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <StaffChat heading={t("app.teamChat.heading")} />
    </div>
  );
}
