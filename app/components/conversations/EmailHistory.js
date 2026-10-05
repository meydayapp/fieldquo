"use client";

// app/components/conversations/EmailHistory.js
//
// The "History" tab on the client page and the job page: every document
// email sent — quote, follow-up, signed copy, invoice, deposit request,
// reminder, receipt — newest first, each opening its kept text
// (SentEmailViewer). Read from GET /api/clients/[id]/email-history or
// /api/jobs/[id]/email-history (lib/email/sentEmailHistory.js).
//
// Sends from before the text was kept are listed as what they are: "Sent on …
// to … — the email text wasn't kept before 5 Oct 2026." No button pretends to
// open them.
//
// A member below showPricing sees what went, when and to whom, and a line
// saying the text is hidden for their role — every document email names a
// figure. A member the route refuses (the crew) gets nothing drawn, and the
// parent is told (onHidden) so it does not draw a tab for it.

import { useCallback, useEffect, useState } from "react";
import { Mail, Loader2, AlertTriangle, Eye } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import SentEmailViewer from "./SentEmailViewer";

const BTN = "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60";

function when(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(language || undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(value);
  }
}

function day(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(language || undefined, { dateStyle: "medium" });
  } catch {
    return String(value);
  }
}

/** "Quote Q-2026-0014", "Reminder for INV-12" — the row's name, in the reader's language. */
export function kindLabel(t, kind, number) {
  const n = number || "";
  return t(`app.emailHistory.kind.${kind}`, { number: n });
}

export default function EmailHistory({ clientId = null, jobId = null, onHidden = null, embedded = false }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(null);

  const url = clientId
    ? `/api/clients/${encodeURIComponent(clientId)}/email-history`
    : `/api/jobs/${encodeURIComponent(jobId)}/email-history`;

  const load = useCallback(async () => {
    try {
      setData(await fetchJson(url));
      setFailed(false);
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        setHidden(true);
        onHidden?.();
      } else setFailed(true);
    }
  }, [url, onHidden]);

  useEffect(() => {
    load();
  }, [load]);

  if (hidden) return null;
  const headingId = `email-history-${clientId || jobId}`;

  return (
    <section className={embedded ? "space-y-3" : "bg-card border border-border rounded-xl p-4 space-y-3"} aria-labelledby={headingId} data-email-history>
      <div>
        <h2 id={headingId} className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Mail size={16} aria-hidden="true" />
          {t("app.emailHistory.title")}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{jobId ? t("app.emailHistory.intro.job") : t("app.emailHistory.intro.client")}</p>
      </div>

      {!data && !failed ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> {t("app.emailHistory.loading")}
        </p>
      ) : null}

      {failed ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={14} aria-hidden="true" />
          {t("app.emailHistory.loadFailed")}
          <button type="button" className={BTN} onClick={load}>
            {t("app.conversation.retry")}
          </button>
        </div>
      ) : null}

      {data ? (
        data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.emailHistory.empty")}</p>
        ) : (
          <ol className="divide-y divide-border">
            {data.entries.map((e) => (
              <li key={e.key} className="py-2.5 space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium text-foreground break-words">{kindLabel(t, e.kind, e.number)}</p>
                  <span className="text-xs text-muted-foreground">{when(e.at, language)}</span>
                </div>
                {e.subject ? <p className="text-sm text-foreground break-words">{e.subject}</p> : null}
                <p className="text-xs text-muted-foreground break-words">
                  {e.to ? t("app.emailHistory.toLine", { to: e.to }) : null}
                  {e.to ? " · " : null}
                  {e.by ? t("app.emailHistory.byLine", { name: e.by }) : e.automatic ? t("app.emailHistory.automatic") : null}
                </p>
                {e.kept && e.textHidden ? <p className="text-xs text-muted-foreground">{t("app.emailHistory.textHidden")}</p> : null}
                {!e.kept ? (
                  <p className="text-xs text-muted-foreground">
                    {e.beforeKeeping
                      ? t("app.emailHistory.notKept", { date: day(e.keptSince || data.since, language) })
                      : t("app.emailHistory.notKeptAfter")}
                  </p>
                ) : null}
                {e.kept && !e.textHidden && e.id ? (
                  <button type="button" className={BTN} onClick={() => setOpen(e.id)}>
                    <Eye size={14} aria-hidden="true" />
                    {t("app.emailHistory.view")}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        )
      ) : null}

      {data?.truncated ? <p className="text-xs text-muted-foreground">{t("app.emailHistory.truncated")}</p> : null}

      {open ? <SentEmailViewer emailId={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}
