"use client";

// app/components/messaging/WebMatchBar.js
//
// On a website-chat conversation the AI team tied to a client on file
// (lib/aiEmployee/webChatMatch.js): who, on what, and the undo — "Not this
// client" — which removes the link and never proposes the pair again.
//
// Drawn only when there IS a live match (GET .../client-match answers one);
// a link a person made by hand has no match row and gets no bar, because
// there is nothing of the assistant's to undo.

import { useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function WebMatchBar({ thread, canEdit, onChanged, t }) {
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const eligible = thread?.platform === "web" && Boolean(thread?.clientId);

  useEffect(() => {
    let live = true;
    if (!eligible) {
      setMatch(null);
      return undefined;
    }
    fetch(`/api/messaging/threads/${encodeURIComponent(thread.id)}/client-match`)
      .then(async (res) => {
        if (!res.ok) {
          // A bar that can't load is not drawn — the conversation itself is
          // unaffected — but the failure is reported, never swallowed.
          await reportResponseError(res, t("app.messages.webMatch.loadError", "Couldn't check how this chat was linked."));
          return null;
        }
        return res.json();
      })
      .then((out) => {
        if (live) setMatch(out?.match || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [eligible, thread?.id, thread?.clientId, t]);

  if (!eligible || !match) return null;

  async function undo() {
    setBusy(true);
    try {
      const res = await fetch(`/api/messaging/threads/${encodeURIComponent(thread.id)}/client-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo", matchId: match.id }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.messages.webMatch.undoError", "Couldn't remove the link."));
        return;
      }
      setMatch(null);
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  const on = (match.matchedOn || []).map((k) => t(`app.messages.webMatch.on.${k}`, k)).join(" + ");
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 text-sm text-muted-foreground">
      <Link2 size={15} className="shrink-0" />
      <span className="flex-1 min-w-0">
        {t("app.messages.webMatch.line", "Linked to {client} by your AI assistant — they gave their {on} in the chat.", {
          client: match.clientName || t("app.messages.webMatch.aClient", "a client"),
          on: on || t("app.messages.webMatch.on.details", "details"),
        })}
      </span>
      {canEdit ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 min-h-[44px] text-foreground disabled:opacity-50"
          disabled={busy}
          onClick={undo}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {t("app.messages.webMatch.undo", "Not this client")}
        </button>
      ) : null}
    </div>
  );
}
