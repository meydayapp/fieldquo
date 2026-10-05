"use client";

// app/components/conversations/ConversationTabs.js
//
// "Conversation" and "History" on the client page and the job page — the
// owner's "maybe if there is a History tab…" (2026-10-05).
//
//   Conversation  every channel, one timeline (ClientConversation)
//   History       every document email as it was sent (EmailHistory)
//
// Each tab asks its own route and each route has its own rule: the timeline
// the inbox's read rung, History the office's (quotes / invoices / jobs, not
// a crew member scoped to their own jobs). A tab whose route refuses is not
// drawn; with one left there is no tab strip, just that section; with none,
// nothing. Both mount at once (two reads) so the strip never offers a tab
// that turns out to be empty-by-refusal after the click.

import { useCallback, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import ClientConversation from "./ClientConversation";
import EmailHistory from "./EmailHistory";

export default function ConversationTabs({ clientId = null, jobId = null }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("conversation");
  const [convHidden, setConvHidden] = useState(false);
  const [histHidden, setHistHidden] = useState(false);
  const hideConv = useCallback(() => setConvHidden(true), []);
  const hideHist = useCallback(() => setHistHidden(true), []);

  if (convHidden && histHidden) return null;
  const both = !convHidden && !histHidden;
  const active = convHidden ? "history" : histHidden ? "conversation" : tab;
  const tabs = [
    { key: "conversation", label: t("app.conversation.title") },
    { key: "history", label: t("app.emailHistory.tab") },
  ];

  return (
    <div className="space-y-2" data-conversation-tabs>
      {both ? (
        <div role="tablist" aria-label={t("app.emailHistory.tabsLabel")} className="flex gap-2">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              id={`ctab-${x.key}-${clientId || jobId}`}
              aria-selected={active === x.key}
              aria-controls={`cpanel-${x.key}-${clientId || jobId}`}
              onClick={() => setTab(x.key)}
              className={`min-h-[44px] px-4 rounded-full text-sm font-medium border ${
                active === x.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        role={both ? "tabpanel" : undefined}
        id={`cpanel-conversation-${clientId || jobId}`}
        aria-labelledby={both ? `ctab-conversation-${clientId || jobId}` : undefined}
        hidden={active !== "conversation"}
      >
        <ClientConversation clientId={clientId} jobId={jobId} onHidden={hideConv} />
      </div>
      <div
        role={both ? "tabpanel" : undefined}
        id={`cpanel-history-${clientId || jobId}`}
        aria-labelledby={both ? `ctab-history-${clientId || jobId}` : undefined}
        hidden={active !== "history"}
      >
        <EmailHistory clientId={clientId} jobId={jobId} onHidden={hideHist} />
      </div>
    </div>
  );
}
