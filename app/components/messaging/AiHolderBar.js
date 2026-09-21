"use client";

// app/components/messaging/AiHolderBar.js
//
// One line above the composer saying who is answering this conversation:
// the AI employee that holds it, or — after a member replied — the person,
// with "Let {name} continue" to hand it back. Drawn from the thread GET's
// `ai` shape (app/api/messaging/threads/[id]/route.js aiState), which is
// computed by the same function the resume route calls, so the name on the
// button is the name that answers when it is pressed.
//
// Nothing is drawn when the company has no AI employee on the thread and
// nobody to hand it to: an empty bar would be noise, and a "Let … continue"
// with nobody behind it would be the dead control AGENTS.md opens with.

import { useState } from "react";
import { Bot, Loader2, UserRound } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function AiHolderBar({ thread, canEdit, onChanged, t }) {
  const [busy, setBusy] = useState(false);
  const ai = thread?.ai;
  if (!ai) return null;
  if (!ai.assignedEmployee && !(ai.humanTookOverAt && ai.resume)) return null;

  async function resume() {
    setBusy(true);
    try {
      const res = await fetch(`/api/messaging/threads/${encodeURIComponent(thread.id)}/ai-resume`, { method: "POST" });
      if (!res.ok) {
        await reportResponseError(res, t("app.messages.ai.resumeError", "Couldn't hand the conversation back."));
        return;
      }
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  if (ai.humanTookOverAt) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <UserRound size={13} aria-hidden="true" />
        <span className="text-foreground">
          {t("app.messages.ai.humanHolds", "You've taken this conversation; {name} is staying quiet.", { name: ai.resume?.name || "" })}
        </span>
        {canEdit && ai.resume ? (
          <button
            type="button"
            onClick={resume}
            disabled={busy}
            className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Bot size={13} aria-hidden="true" />}
            {t("app.messages.ai.letContinue", "Let {name} continue", { name: ai.resume.name })}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
      <Bot size={13} aria-hidden="true" />
      <span>
        {t("app.messages.ai.employeeHolds", "{name} (AI {role}) is answering this conversation. Reply here and it stops.", {
          name: ai.assignedEmployee.name,
          role: t(`app.aiEmployee.role.${ai.assignedEmployee.role}`, ai.assignedEmployee.role),
        })}
      </span>
    </div>
  );
}
