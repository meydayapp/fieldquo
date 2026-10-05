"use client";

// app/components/conversations/SentEmailViewer.js
//
// One kept document email, as it was sent (GET /api/sent-emails/[id] —
// lib/email/sentEmailHistory.js): who sent it, from which address, to whom,
// when, what was attached, and the text.
//
// The HTML is the email's own bytes, so it is drawn in an iframe with an
// EMPTY sandbox: no script runs, nothing navigates the app, nothing reads
// the app's cookies — it is shown, never executed. The plain-text copy is
// beside it for an email whose HTML a reader would rather not open.
//
// A refusal (no access, prices hidden for this role) is the route's own
// sentence, not an empty box.

import { useEffect, useState } from "react";
import { X, Loader2, Paperclip, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

function when(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(language || undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(value);
  }
}

export default function SentEmailViewer({ emailId, onClose }) {
  const { t, language } = useTranslation();
  const [email, setEmail] = useState(null);
  const [error, setError] = useState("");
  const [asText, setAsText] = useState(false);

  useEffect(() => {
    let live = true;
    setEmail(null);
    setError("");
    fetchJson(`/api/sent-emails/${encodeURIComponent(emailId)}`)
      .then((d) => live && setEmail(d.email || null))
      .catch((err) => live && setError(err.message || t("app.emailHistory.viewError")));
    return () => {
      live = false;
    };
  }, [emailId, t]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = email?.subject || t("app.emailHistory.viewTitle");
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-card shadow-xl sm:max-w-2xl sm:rounded-2xl" data-sent-email-viewer>
        <header className="flex items-start gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 flex-1 break-words text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.emailHistory.close")}
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!email && !error ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> {t("app.emailHistory.loading")}
            </p>
          ) : null}
          {error ? (
            <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
            </p>
          ) : null}
          {email ? (
            <>
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("app.emailHistory.sentAt")}</dt>
                <dd className="text-foreground">{when(email.at, language)}</dd>
                <dt className="text-muted-foreground">{t("app.emailHistory.sentBy")}</dt>
                <dd className="text-foreground break-words">{email.by || t("app.emailHistory.automatic")}</dd>
                {email.from ? (
                  <>
                    <dt className="text-muted-foreground">{t("app.emailHistory.from")}</dt>
                    <dd className="text-foreground break-all">{email.from}</dd>
                  </>
                ) : null}
                {email.to ? (
                  <>
                    <dt className="text-muted-foreground">{t("app.emailHistory.to")}</dt>
                    <dd className="text-foreground break-all">{email.to}</dd>
                  </>
                ) : null}
                {email.cc ? (
                  <>
                    <dt className="text-muted-foreground">{t("app.emailHistory.cc")}</dt>
                    <dd className="text-foreground break-all">{email.cc}</dd>
                  </>
                ) : null}
              </dl>
              {email.attachments?.length ? (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Paperclip size={12} aria-hidden="true" />
                  {email.attachments.map((a) => a.filename).join(", ")}
                </p>
              ) : null}
              {email.via === "demo" ? <p className="text-xs text-muted-foreground">{t("app.emailHistory.demoNote")}</p> : null}
              {email.html && email.text ? (
                <button
                  type="button"
                  onClick={() => setAsText((v) => !v)}
                  className="inline-flex min-h-[44px] items-center text-xs font-medium text-primary hover:underline"
                >
                  {asText ? t("app.emailHistory.showFormatted") : t("app.emailHistory.showText")}
                </button>
              ) : null}
              {email.html && !asText ? (
                <iframe
                  title={title}
                  sandbox=""
                  srcDoc={email.html}
                  className="h-[60vh] w-full rounded-lg border border-border bg-white"
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground font-sans">
                  {email.text || ""}
                </pre>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
