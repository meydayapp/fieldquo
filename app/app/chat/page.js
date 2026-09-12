"use client";

// app/app/chat/page.js
//
// The company's crew chat. The screen is app/components/company/CompanyChat.js
// — the same kit /app/messages, /sales/team and /platform/chat draw, so the
// four feel like one product rather than four.
//
// `?room=<id>` opens that room on first paint: it is the URL a push
// notification lands on (lib/company/chat/store.js), and a person tapping
// "Ana mentioned you in #Nguyen kitchen" on a lock screen should land IN the
// room, not on the list. useSearchParams reads it; the server still decides
// whether the room is theirs.
//
// Full-height on purpose: the composer is the last child of the thread's
// flex column rather than a fixed bar, so it never fights the mobile tab bar
// or the keyboard — the reasoning app/app/messages/page.js gives.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CompanyChat from "@/app/components/company/CompanyChat";
import { useTranslation } from "@/app/hooks/useTranslation";

function ChatScreen() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const initialRoomId = params?.get("room") || null;
  return <CompanyChat heading={t("app.companyChat.heading")} initialRoomId={initialRoomId} />;
}

export default function ChatPage() {
  return (
    <div data-tour="app-chat">
      <Suspense fallback={null}>
        <ChatScreen />
      </Suspense>
    </div>
  );
}
