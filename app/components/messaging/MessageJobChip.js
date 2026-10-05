"use client";

// app/components/messaging/MessageJobChip.js
//
// Under a client's message in Messages: the job it is about, or — when the
// automatic rule could not tell (lib/conversations/autoLink.js: a contractor,
// several active jobs, two overlapping) — "Which job?", one tap.
//
//   tagged       "Job: Kitchen repaint" → opens the job; "Change" re-files it
//   asked        "Which job?" → the client's jobs, plus "Not about a job"
//   decided none nothing — a person said so, and it is not asked again
//
// The choice goes to POST /api/messaging/threads/[id]/messages/[messageId]/job,
// which proves the job is this company's AND this client's. Drawn only when
// the thread route sent `jobChoices` (a member who reads jobs and is not
// scoped to their own), and the picker only for somebody who may edit
// conversations — a support session and a read-only member see the tag only.

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Loader2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

function jobLabel(job, t) {
  if (!job) return t("app.messages.jobTag.unknownJob", "a job");
  return job.title || (job.quoteNumber ? t("app.messages.jobTag.fromQuote", "Job from {number}", { number: job.quoteNumber }) : t("app.messages.jobTag.unknownJob", "a job"));
}

export default function MessageJobChip({ item, thread, canEdit, onChanged, t }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const choices = Array.isArray(thread?.jobChoices) ? thread.jobChoices : null;
  if (!choices || item?.direction !== "in" || item?.kind !== "message") return null;
  const job = item.jobId ? choices.find((j) => j.id === item.jobId) || { id: item.jobId } : null;
  if (!job && !item.jobAsk) return null;

  async function choose(value) {
    if (value === "") return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/messaging/threads/${encodeURIComponent(thread.id)}/messages/${encodeURIComponent(item.id)}/job`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: value === "none" ? null : value }),
        },
      );
      if (!res.ok) {
        await reportResponseError(res, t("app.messages.jobTag.saveError", "Couldn't file this message to the job."));
        return;
      }
      setPicking(false);
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  const selectId = `job-pick-${item.id}`;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs" data-message-job>
      {job ? (
        <Link
          href={`/app/jobs/${encodeURIComponent(job.id)}`}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-border bg-card px-2.5 font-medium text-foreground hover:bg-muted"
        >
          <Briefcase size={12} aria-hidden="true" />
          {t("app.messages.jobTag.job", "Job: {name}", { name: jobLabel(job, t) })}
        </Link>
      ) : null}
      {job && item.jobLinkedBy && item.jobLinkedBy !== "person" ? (
        <span className="text-muted-foreground">
          {item.jobLinkedBy === "auto_date" ? t("app.messages.jobTag.byDate", "by date") : t("app.messages.jobTag.onlyJob", "their only active job")}
        </span>
      ) : null}
      {canEdit && !picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-dashed border-border px-2.5 font-medium text-foreground hover:bg-muted"
        >
          {job ? t("app.messages.jobTag.change", "Change") : (
            <>
              <Briefcase size={12} aria-hidden="true" />
              {t("app.messages.jobTag.which", "Which job?")}
            </>
          )}
        </button>
      ) : null}
      {!canEdit && !job ? <span className="text-muted-foreground">{t("app.messages.jobTag.unfiled", "Not filed to a job yet")}</span> : null}
      {canEdit && picking ? (
        <span className="inline-flex items-center gap-1.5">
          <label htmlFor={selectId} className="sr-only">
            {t("app.messages.jobTag.which", "Which job?")}
          </label>
          <select
            id={selectId}
            disabled={busy}
            defaultValue=""
            onChange={(e) => choose(e.target.value)}
            className="min-h-[36px] max-w-[16rem] rounded-lg border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="" disabled>
              {t("app.messages.jobTag.pick", "Pick a job…")}
            </option>
            {choices.map((j) => (
              <option key={j.id} value={j.id}>
                {jobLabel(j, t)}
              </option>
            ))}
            <option value="none">{t("app.messages.jobTag.none", "Not about a job")}</option>
          </select>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          <button type="button" onClick={() => setPicking(false)} className="min-h-[32px] px-1.5 text-muted-foreground hover:text-foreground">
            {t("app.action.cancel", "Cancel")}
          </button>
        </span>
      ) : null}
    </div>
  );
}
