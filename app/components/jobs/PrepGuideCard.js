// app/components/jobs/PrepGuideCard.js
//
// The job page's card for the client preparation guide: what will happen
// and why, in one sentence, plus the two controls — "Send now" and "Don't
// send for this job" — and a preview.
//
// Every state is spelled out. "Will go on 12 October", "Sent 9 October to
// x@y.com", "Won't go: this job has no start date" — because the cron's
// silence is indistinguishable from the cron's success unless the page says
// which. Reads GET /api/jobs/[id]/prep-guide, which returns the SAME
// decision the cron makes (lib/prepGuide/schedule.js), so the sentence here
// is a statement of what the cron will do, not a guess about it.
"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Send, BellOff, Bell, Eye } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";

export default function PrepGuideCard({ jobId }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchJson(`/api/jobs/${jobId}/prep-guide`));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const date = (v) =>
    v ? new Date(v).toLocaleDateString(language, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "";
  const stamp = (v) => (v ? new Date(v).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) : "");

  async function sendNow() {
    setBusy(true);
    try {
      const next = await fetchJson(`/api/jobs/${jobId}/prep-guide`, { method: "POST" });
      setData(next);
      showToast({ message: t("app.prepGuide.job.sentToast", "Preparation guide sent to {email}.", { email: next.result?.to || "" }), tone: "success" });
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function setSuppressed(suppressed) {
    setBusy(true);
    try {
      setData(await fetchJson(`/api/jobs/${jobId}/prep-guide`, { method: "PATCH", body: { suppressed } }));
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        {t("app.prepGuide.job.loadFailed", "The preparation guide's status couldn't be loaded.")}
      </div>
    );
  }
  if (!data) return null;

  // The sentence. One per reason, none of them "skipped".
  let line;
  if (data.sentAt) {
    line = t("app.prepGuide.job.sent", "Sent {when} to the client.", { when: stamp(data.sentAt) });
  } else if (data.suppressedAt) {
    line = t("app.prepGuide.job.suppressed", "Won't be sent for this job — switched off on {when}.", { when: stamp(data.suppressedAt) });
  } else if (data.reason === "no_start_date") {
    line = t("app.prepGuide.job.noStartDate", "Won't be sent: this job has no start date yet. Set one and it goes out {days} days before.", { days: data.leadDays });
  } else if (data.reason === "no_client_email") {
    line = t("app.prepGuide.job.noEmail", "Won't be sent: the client has no email address on file.");
  } else if (data.reason === "started") {
    line = t("app.prepGuide.job.started", "Not sent: the start date has passed.");
  } else if (data.reason === "cancelled" || data.reason === "archived" || data.reason === "historical") {
    line = t("app.prepGuide.job.inactive", "Not sent: this job is not active.");
  } else if (data.reason === "due") {
    line = t("app.prepGuide.job.dueNow", "Due now — it goes out with the next scheduled send, or send it yourself.");
  } else {
    line = t("app.prepGuide.job.scheduled", "Will be sent on {date} ({days} days before the start date).", {
      date: date(data.dueAt),
      days: data.leadDays,
    });
  }

  const sendable = data.canSend && data.hasClientEmail && Boolean(data.startDate) && data.reason !== "started" && !["cancelled", "archived", "historical"].includes(data.reason);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText size={16} className="text-muted-foreground" />
          {t("app.prepGuide.job.title", "Client preparation guide")}
        </h2>
        <a
          href={`/api/jobs/${jobId}/prep-guide/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Eye size={13} /> {t("app.prepGuide.job.preview", "Preview")}
        </a>
      </div>

      <p className="text-sm text-foreground">{line}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {[
          data.trades.length ? data.trades.join(", ") : null,
          t("app.prepGuide.job.language", "In {lang}", { lang: data.language.toUpperCase() }),
        ]
          .filter(Boolean)
          .join(" · ")}
        {data.document?.url && (
          <>
            {" · "}
            <a href={data.document.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {t("app.prepGuide.job.openSent", "Open the copy that was sent")}
            </a>
          </>
        )}
      </p>

      {data.canSend && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {sendable && (
            <button
              type="button"
              onClick={sendNow}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded bg-inverted px-3 py-1.5 text-sm font-medium text-inverted-foreground disabled:opacity-50"
            >
              <Send size={14} />
              {data.sentAt ? t("app.prepGuide.job.sendAgain", "Send again") : t("app.prepGuide.job.sendNow", "Send now")}
            </button>
          )}
          {!data.sentAt && (
            <button
              type="button"
              onClick={() => setSuppressed(!data.suppressedAt)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              {data.suppressedAt ? <Bell size={14} /> : <BellOff size={14} />}
              {data.suppressedAt ? t("app.prepGuide.job.allow", "Allow sending") : t("app.prepGuide.job.dontSend", "Don't send for this job")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
