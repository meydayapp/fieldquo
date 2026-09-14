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
//
// ══ The second tab: "All conversations (audit)" ═══════════════════════════
//
// Only for "chat:audit" — superadmin-only (lib/platform/permissions.js). It
// is a DIFFERENT component on a DIFFERENT API: the Team chat tab is the
// admin as a participant (membership is the permission, lib/staff/store.js);
// the audit tab is the owner as a reader of rooms they are not in, read-only,
// with every open recorded and announced in the room
// (lib/staff/auditRules.js). The tab is hidden below superadmin — not
// disabled, hidden — because a control that only refuses is the thing this
// codebase is swept for; and the routes refuse regardless, because hiding a
// tab is not access control.
//
// The identity comes from usePlatformAdmin, which keeps "still checking"
// and "could not check" apart from "no": the audit tab is simply absent
// until the role is read, and a failed check draws the gate's own
// explanation rather than a silent absence.
import { useState } from "react";
import { Eye, MessageSquare } from "lucide-react";
import StaffChat from "@/app/components/staff/StaffChat";
import ChatAudit from "@/app/components/platform/ChatAudit";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";
import { useTranslation } from "@/app/hooks/useTranslation";

const TAB_CHAT = "chat";
const TAB_AUDIT = "audit";

export default function PlatformChatPage() {
  const { t } = useTranslation();
  const { status, error, can } = usePlatformAdmin();
  const [tab, setTab] = useState(TAB_CHAT);
  const canAudit = can("chat:audit");
  // Shown for a superadmin, and ALSO when the role could not be read — the
  // tab then opens the gate's "couldn't check, reload" block rather than
  // vanishing, so a real superadmin on a flaky connection is told why.
  const tabsVisible = canAudit || status === "failed";
  const showAudit = tab === TAB_AUDIT && tabsVisible;

  return (
    <div className="p-6 space-y-3">
      {tabsVisible ? (
        <div role="tablist" aria-label="Team chat views" className="flex flex-wrap gap-1 border-b border-border">
          <button
            type="button"
            role="tab"
            aria-selected={tab === TAB_CHAT}
            onClick={() => setTab(TAB_CHAT)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 border-b-2 px-3 text-sm font-medium ${
              tab === TAB_CHAT ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare size={14} aria-hidden="true" /> {t("app.teamChat.heading")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === TAB_AUDIT}
            onClick={() => setTab(TAB_AUDIT)}
            data-audit-tab
            className={`inline-flex min-h-[40px] items-center gap-1.5 border-b-2 px-3 text-sm font-medium ${
              tab === TAB_AUDIT ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye size={14} aria-hidden="true" /> All conversations (audit)
          </button>
        </div>
      ) : null}

      {showAudit ? (
        <PlatformWriteGate
          status={status}
          allowed={canAudit}
          error={error}
          action="Reading conversations you are not part of"
          who="The owner (superadmin) only"
        >
          <ChatAudit />
        </PlatformWriteGate>
      ) : (
        <StaffChat heading={t("app.teamChat.heading")} />
      )}
    </div>
  );
}
