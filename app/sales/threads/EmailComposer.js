"use client";
// app/sales/threads/EmailComposer.js
//
// The box a rep writes an email in — a new one to a lead, or a reply,
// reply-all or forward on a thread. Used by the inbox (/sales/threads) and
// the lead screen, so the two cannot drift.
//
// ══ What it decides, and what it does not ═════════════════════════════════
//
// It decides nothing about whether mail may go. The server's readiness
// (lib/sales/outreachReadiness.js) is printed above it by OutreachNotice
// and the send route refuses again on its own; the recipient set is the
// server's closed list (lib/sales/emailRecipients.js) and the box only
// offers those addresses; the quoted text is never typed here — the message
// being answered is named by id and quoted from the stored copy on the
// server. What the box does is: hold the words, keep them (autosave 1.5 s
// after the last keystroke, lib/sales/emailDrafts.js), and send on a press
// or Ctrl/⌘+Enter.
//
// ══ Plain text with four marks ════════════════════════════════════════════
//
// A textarea, not a rich editor. Zero ships TipTap (docs/sales-intel/
// ZERO-STUDY.md §4); a floor whose every sentence the console can audit
// keeps the typed text as the record and renders **bold**, _italic_,
// "- list" and links at send time (lib/sales/emailFormat.js). The hint under
// the box says so.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Paperclip, Send, Trash2, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { useTranslation } from "@/app/hooks/useTranslation";

export const AUTOSAVE_MS = 1500;

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] lg:min-h-[36px] px-3 rounded-lg text-sm font-semibold disabled:opacity-60";
const CHIP = "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground";

function AddressChips({ label, chosen, options, onChange, hint }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const remaining = options.filter((o) => !chosen.includes(o.address));
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="w-8 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {chosen.map((a) => (
        <span key={a} className={CHIP}>
          {a}
          <button
            type="button"
            onClick={() => onChange(chosen.filter((x) => x !== a))}
            aria-label={t("app.chat.close")}
            className="grid h-5 w-5 place-items-center rounded-full hover:bg-background"
          >
            <X size={11} aria-hidden="true" />
          </button>
        </span>
      ))}
      {remaining.length ? (
        <span className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("app.salesInbox.compose.pickRecipient")} <ChevronDown size={12} aria-hidden="true" />
          </button>
          {open ? (
            <ul className="absolute left-0 top-full z-10 mt-1 max-h-48 w-72 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
              {remaining.map((o) => (
                <li key={o.address}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...chosen, o.address]);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="text-sm text-foreground break-all">{o.address}</span>
                    <span className="text-[11px] text-muted-foreground">{t(`app.salesInbox.recipient.${o.source}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </span>
      ) : null}
      {hint ? <span className="basis-full text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/**
 * @param kind        "new" | "reply" | "replyAll" | "forward"
 * @param leadId      the lead (required for "new"; a draft needs it)
 * @param threadId    the thread (reply / replyAll / forward)
 * @param quoted      the message being answered or forwarded — { id, subject }
 * @param recipients  the server's closed set — [{ address, source }]
 * @param initialTo / initialCc  the addresses to start with
 * @param subjectPrefill  for "new": the lead's name for the heading only
 * @param attachable  files on the thread — [{ url, filename, bytes }]
 * @param from        the rep's work mailbox, for the "From" line
 * @param draft       an existing draft row to continue, or null
 * @param onSent(result)  after a 201
 * @param onClose()   the Discard / Esc
 * @param autoFocus
 */
export default function EmailComposer({
  kind = "new",
  leadId = null,
  threadId = null,
  quoted = null,
  recipients = [],
  initialTo = [],
  initialCc = [],
  attachable = [],
  from = null,
  draft = null,
  onSent,
  onClose,
  autoFocus = true,
  heading = null,
}) {
  const { t } = useTranslation();
  const [to, setTo] = useState(draft?.toAddresses ? draft.toAddresses.split(/,\s*/) : initialTo);
  const [cc, setCc] = useState(draft?.ccAddresses ? draft.ccAddresses.split(/,\s*/) : initialCc);
  const [showCc, setShowCc] = useState(Boolean(initialCc.length || draft?.ccAddresses));
  const [subject, setSubject] = useState(draft?.subject || "");
  const [body, setBody] = useState(draft?.body || "");
  const [picked, setPicked] = useState(Array.isArray(draft?.attachments) ? draft.attachments.map((a) => a.url) : []);
  const [draftId, setDraftId] = useState(draft?.id || null);
  const [saveState, setSaveState] = useState(draft ? "saved" : "idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const textareaRef = useRef(null);
  const timer = useRef(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // ── Templates, on demand ────────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    if (!leadId || templates) return;
    try {
      const data = await fetchJson(`/api/sales/threads/templates?leadId=${encodeURIComponent(leadId)}`);
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.message);
    }
  }, [leadId, templates]);

  // ── Autosave ────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!leadId && !threadId) return;
    setSaveState("saving");
    try {
      const data = await fetchJson("/api/sales/email-drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(
          {
            id: draftId,
            leadId,
            threadId,
            kind,
            toAddresses: to,
            ccAddresses: cc,
            subject,
            body,
            quotedMessageId: quoted?.id || null,
            attachments: attachable.filter((a) => picked.includes(a.url)),
          },
          "draft",
        ),
      });
      setDraftId(data.draft?.id || null);
      setSaveState(data.draft ? "saved" : "idle");
      dirty.current = false;
    } catch (err) {
      // A draft that could not be kept is said, not hidden: the rep may be
      // about to close the tab.
      setSaveState("failed");
      setError(err.message);
    }
  }, [leadId, threadId, draftId, kind, to, cc, subject, body, quoted, attachable, picked]);

  useEffect(() => {
    if (!dirty.current) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_MS);
    return () => clearTimeout(timer.current);
  }, [to, cc, subject, body, picked, save]);

  const touch = (setter) => (value) => {
    dirty.current = true;
    setSaveState("unsaved");
    setter(value);
  };

  // ── Send ────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    clearTimeout(timer.current);
    try {
      const payload =
        kind === "new"
          ? { leadId, subject, body, to, cc, draftId }
          : { kind, body, to, cc, quotedMessageId: quoted?.id || null, attachments: picked.map((url) => ({ url })), draftId };
      const url = kind === "new" ? "/api/sales/threads" : `/api/sales/threads/${encodeURIComponent(threadId)}/messages`;
      const result = await fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: jsonBody(payload, "email") });
      setBody("");
      setSubject("");
      setDraftId(null);
      setSaveState("idle");
      onSent?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [busy, kind, leadId, threadId, subject, body, to, cc, quoted, picked, draftId, onSent]);

  const discard = useCallback(async () => {
    clearTimeout(timer.current);
    if (draftId) {
      await fetchJson(`/api/sales/email-drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" }).catch(() => null);
    }
    onClose?.();
  }, [draftId, onClose]);

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
    }
  };

  const canSend = Boolean(body.trim()) && to.length > 0 && (kind !== "new" || subject.trim());
  const savedLine = useMemo(() => {
    if (saveState === "saving") return t("app.salesInbox.compose.saving");
    if (saveState === "saved") return t("app.salesInbox.compose.saved");
    if (saveState === "unsaved") return t("app.salesInbox.compose.unsaved");
    if (saveState === "failed") return t("app.salesInbox.compose.saveFailed");
    return "";
  }, [saveState, t]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-2 border-t border-border bg-card p-3"
      data-email-composer={kind}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {heading || t(`app.salesInbox.compose.${kind}`)}
        </span>
        {from ? <span className="truncate text-xs text-muted-foreground">{t("app.salesInbox.compose.from", { from })}</span> : null}
      </div>

      <AddressChips
        label={t("app.salesInbox.compose.to")}
        chosen={to}
        options={recipients}
        onChange={touch(setTo)}
        hint={recipients.length > 1 ? t("app.salesInbox.compose.recipientHint") : null}
      />
      {showCc ? (
        <AddressChips label={t("app.salesInbox.compose.cc")} chosen={cc} options={recipients.filter((r) => !to.includes(r.address))} onChange={touch(setCc)} />
      ) : recipients.length > 1 ? (
        <button type="button" onClick={() => setShowCc(true)} className="self-start text-xs text-muted-foreground underline">
          {t("app.salesInbox.compose.addCc")}
        </button>
      ) : null}

      {kind === "new" ? (
        <input
          value={subject}
          onChange={(e) => touch(setSubject)(e.target.value)}
          placeholder={t("app.salesInbox.compose.subject")}
          aria-label={t("app.salesInbox.compose.subject")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      ) : null}

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => touch(setBody)(e.target.value)}
        rows={kind === "new" ? 8 : 5}
        placeholder={t("app.salesInbox.compose.placeholder")}
        aria-label={t("app.salesInbox.compose.placeholder")}
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed"
      />

      {attachable.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("app.salesInbox.compose.attach")}
          </span>
          {attachable.map((a) => {
            const on = picked.includes(a.url);
            return (
              <button
                key={a.url}
                type="button"
                aria-pressed={on}
                onClick={() => touch(setPicked)(on ? picked.filter((u) => u !== a.url) : [...picked, a.url])}
                className={`${CHIP} ${on ? "border-primary" : ""}`}
              >
                <Paperclip size={11} aria-hidden="true" /> {a.filename}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !canSend} className={`${BTN} bg-inverted text-inverted-foreground`}>
          {busy ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          {busy ? t("app.salesInbox.compose.sending") : t("app.salesInbox.compose.send")}
        </button>
        {leadId ? (
          <span className="relative">
            <button
              type="button"
              onClick={() => {
                loadTemplates();
                setTemplatesOpen((v) => !v);
              }}
              className={`${BTN} border border-border text-foreground`}
            >
              {t("app.salesInbox.compose.templates")} <ChevronDown size={14} aria-hidden="true" />
            </button>
            {templatesOpen ? (
              <ul className="absolute bottom-full left-0 z-10 mb-1 w-72 rounded-md border border-border bg-card p-1 shadow-lg">
                {templates === null ? (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground">{t("app.salesNotes.loading")}</li>
                ) : templates.length === 0 ? (
                  <li className="px-2 py-1.5 text-xs text-muted-foreground">{t("app.salesInbox.compose.noTemplates")}</li>
                ) : (
                  templates.map((tpl) => (
                    <li key={tpl.key}>
                      <button
                        type="button"
                        onClick={() => {
                          if (tpl.subject && kind === "new" && !subject.trim()) touch(setSubject)(tpl.subject);
                          touch(setBody)(body.trim() ? `${body.replace(/\s+$/, "")}\n\n${tpl.body}` : tpl.body);
                          setTemplatesOpen(false);
                          textareaRef.current?.focus();
                        }}
                        className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                      >
                        {tpl.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </span>
        ) : null}
        <button type="button" onClick={discard} className={`${BTN} text-muted-foreground hover:text-foreground`}>
          <Trash2 size={14} aria-hidden="true" /> {t("app.salesInbox.compose.discard")}
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">{savedLine}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("app.salesInbox.compose.formattingHint")} · {t("app.salesInbox.compose.sendHint")}
      </p>
    </form>
  );
}
