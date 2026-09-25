"use client";

// app/components/mailbox/FiledEmails.js
//
// The "Email" section on the client page and the job page: every email
// conversation filed from a connected work mailbox (lib/mailbox/), newest
// first, each with "Filed to Job … — change".
//
// Renders NOTHING when there is nothing filed and no mailbox could file
// anything here — an empty "Email" box on every client page of a company
// that never connected a mailbox would be furniture. When the member may not
// see client contact details the route refuses, and this renders nothing
// either: the page they are on already says what they can see.
//
// Bodies are TEXT (lib/mailbox/text.js stores no markup) and are rendered as
// text with whitespace kept. Never dangerouslySetInnerHTML.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Paperclip, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";

function when(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(language || undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(value);
  }
}

export default function FiledEmails({ clientId = null, jobId = null }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState({});
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const query = clientId ? `clientId=${encodeURIComponent(clientId)}` : `jobId=${encodeURIComponent(jobId)}`;
  const load = useCallback(async () => {
    try {
      setData(await fetchJson(`/api/mailbox/filed?${query}`));
    } catch (err) {
      // 403/404: not theirs to see — render nothing rather than an error box.
      if (err.status === 403 || err.status === 404) setHidden(true);
      else setData({ threads: [], loadFailed: true });
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  if (hidden || !data) return null;
  if (!data.loadFailed && data.threads.length === 0) return null;

  async function refile(threadId, value) {
    // value: "job:<id>" | "quote:<id>" | "none"
    const [kind, id] = value.split(":");
    // One target at a time: filing to a job clears a quote link and vice
    // versa, so "filed to" never names two things that disagree.
    const body = kind === "job" ? { jobId: id, quoteId: null } : kind === "quote" ? { quoteId: id, jobId: null } : { jobId: null, quoteId: null };
    setSaving(true);
    try {
      await fetchJson(`/api/messaging/threads/${encodeURIComponent(threadId)}`, { method: "PATCH", body });
      setEditing(null);
      await load();
    } catch (err) {
      showError(err.message || t("app.filedEmail.refileFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-effect rounded-xl p-4 space-y-3" aria-labelledby={`filed-email-${clientId || jobId}`}>
      <h2 id={`filed-email-${clientId || jobId}`} className="font-semibold text-foreground text-sm flex items-center gap-2">
        <Mail size={15} className="text-muted-foreground" /> {t("app.filedEmail.title")}
      </h2>
      {data.loadFailed && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{t("app.filedEmail.loadFailed")}</span>
          <button type="button" onClick={load} className="min-h-[40px] px-3 rounded-lg border border-border text-foreground">
            {t("app.action.retry")}
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {data.threads.map((th) => {
          const isOpen = Boolean(open[th.id]);
          const filed = th.filedTo.jobId
            ? t("app.filedEmail.filedToJob", { title: th.filedTo.jobTitle || "—" })
            : th.filedTo.quoteId
              ? t("app.filedEmail.filedToQuote", { number: th.filedTo.quoteNumber || "—" })
              : t("app.filedEmail.filedToClient");
          return (
            <li key={th.id} className="border border-border rounded-lg">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [th.id]: !o[th.id] }))}
                className="w-full flex items-start justify-between gap-2 p-3 text-left min-h-[44px]"
                aria-expanded={isOpen}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">{th.subject || t("app.filedEmail.noSubject")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("app.filedEmail.count", { n: th.messages.length })} · {when(th.lastMessageAt, language)}
                  </span>
                </span>
                {isOpen ? <ChevronDown size={16} className="shrink-0 mt-0.5" /> : <ChevronRight size={16} className="shrink-0 mt-0.5" />}
              </button>
              <div className="px-3 pb-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{filed}</span>
                {data.canRefile && data.targets && editing !== th.id && (
                  <button type="button" onClick={() => setEditing(th.id)} className="underline underline-offset-2 text-foreground">
                    {t("app.filedEmail.change")}
                  </button>
                )}
                {editing === th.id && (
                  <select
                    className="min-h-[36px] px-2 rounded-lg border border-border bg-card text-xs text-foreground"
                    disabled={saving}
                    defaultValue={th.filedTo.jobId ? `job:${th.filedTo.jobId}` : th.filedTo.quoteId ? `quote:${th.filedTo.quoteId}` : "none"}
                    onChange={(e) => refile(th.id, e.target.value)}
                    aria-label={t("app.filedEmail.change")}
                  >
                    <option value="none">{t("app.filedEmail.clientOnly")}</option>
                    {data.targets.jobs.map((j) => (
                      <option key={j.id} value={`job:${j.id}`}>
                        {t("app.filedEmail.optionJob", { title: j.title })}
                      </option>
                    ))}
                    {data.targets.quotes.map((q) => (
                      <option key={q.id} value={`quote:${q.id}`}>
                        {t("app.filedEmail.optionQuote", { number: q.quoteNumber })}
                      </option>
                    ))}
                  </select>
                )}
                <Link href={`/app/messages?conversation=${encodeURIComponent(th.id)}`} className="underline underline-offset-2">
                  {t("app.filedEmail.openConversation")}
                </Link>
              </div>
              {isOpen && (
                <ol className="border-t border-border divide-y divide-border">
                  {th.messages.map((m) => (
                    <li key={m.id} className="p-3 space-y-1">
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{m.direction === "in" ? t("app.filedEmail.fromClient") : t("app.filedEmail.fromUs")}</span>
                        <span>{when(m.sentAt, language)}</span>
                        {m.sentVia === "fieldquo" && <span>{t("app.filedEmail.sentViaFieldquo")}</span>}
                        {m.failed && <span className="text-red-700 dark:text-red-400">{t("app.filedEmail.failed")}</span>}
                      </div>
                      {data.seesContacts && (m.from || m.to) && (
                        <div className="text-xs text-muted-foreground break-all">
                          {m.from ? t("app.filedEmail.fromLine", { from: m.from }) : ""} {m.to ? t("app.filedEmail.toLine", { to: m.to }) : ""}
                          {m.cc ? ` ${t("app.filedEmail.ccLine", { cc: m.cc })}` : ""}
                        </div>
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">{m.body}</p>
                      {m.attachments?.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                          {m.attachments.map((a) => (
                            <li key={a.index} className="text-xs">
                              {a.url ? (
                                <a href={a.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-2 text-foreground">
                                  <Paperclip size={12} /> {a.filename || t("app.filedEmail.attachment")}
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <Paperclip size={12} /> {t("app.filedEmail.attachmentInMailbox", { name: a.filename || t("app.filedEmail.attachment") })}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
