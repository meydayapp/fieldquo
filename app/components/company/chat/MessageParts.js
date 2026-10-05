"use client";

// app/components/company/chat/MessageParts.js
//
// What a team-chat message can carry beyond its words, drawn: the reply
// quote above it, its photos and files, a shared job / work order / quote
// card, "(edited)", "Message removed" — plus the pieces around the thread
// that work on messages: the pinned bar, the photo viewer, the message menu
// on a phone, the job picker and room search.
//
// Everything here draws what the SERVER put in the thread payload and
// nothing else. A removed message arrives with no words (rules.js
// threadMessages) and is drawn as "Message removed"; a file arrives as a
// short-lived, reader-bound link (lib/company/chat/fileLinks.js), never a
// storage URL; a card arrives already resolved for THIS reader
// (lib/company/chat/cards.js) — "Office only" is what the server decided,
// not what this file hides.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  ClipboardList,
  CornerUpLeft,
  FileText,
  ImagePlus,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { ChatText } from "@/app/components/chat/Thread";
import { megabytes } from "@/lib/media/validate";
import { chatApi } from "@/lib/company/chat/client";
import { searchTerm } from "@/lib/company/chat/rules";
import { Modal, Button, useSay } from "./parts";

const JOB_STATUS_KEYS = {
  unscheduled: "app.companyChat.card.status.unscheduled",
  scheduled: "app.companyChat.card.status.scheduled",
  in_progress: "app.companyChat.card.status.in_progress",
  completed: "app.companyChat.card.status.completed",
  cancelled: "app.companyChat.card.status.cancelled",
};

function dateLabel(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// ── The reply quote ─────────────────────────────────────────────────────────

/** The grey strip above a reply. Tapping it scrolls to the original. */
export function ReplyStrip({ reply, onJump }) {
  const { t } = useTranslation();
  if (!reply) return null;
  const words = reply.deleted
    ? t("app.companyChat.messageRemoved")
    : reply.body || (reply.attachments > 0 ? t("app.companyChat.attachmentCount", { count: reply.attachments }) : "");
  return (
    <button
      type="button"
      onClick={() => onJump?.(reply.id)}
      className="mb-1 flex w-full max-w-[520px] items-center gap-1.5 truncate border-l-[3px] border-border bg-muted px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/70"
      data-reply-strip
    >
      <CornerUpLeft size={12} aria-hidden="true" className="shrink-0" />
      <b className="shrink-0 font-semibold text-foreground">{reply.who || t("app.companyChat.someoneWhoLeft")}</b>
      <span className={`truncate ${reply.deleted ? "italic" : ""}`}>{words}</span>
    </button>
  );
}

// ── Photos and files ────────────────────────────────────────────────────────

/** A photo tile. A link that has run out answers 410; `onExpired` re-reads the thread for fresh ones. */
function PhotoTile({ a, onOpen, onExpired, more = 0, alt }) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative block aspect-square w-full overflow-hidden rounded-md border border-border bg-muted"
      data-chat-photo
    >
      {a.thumb && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.thumb}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => {
            setBroken(true);
            onExpired?.();
          }}
        />
      ) : (
        <span className="grid h-full w-full place-items-center text-muted-foreground">
          <ImagePlus size={20} aria-hidden="true" />
        </span>
      )}
      {more > 0 ? (
        <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-semibold text-white">+{more}</span>
      ) : null}
    </button>
  );
}

/** 1–4 photo tiles ("+n" on the fourth), then one row per document. */
export function AttachmentGrid({ attachments, onOpenPhoto, onExpired }) {
  const { t } = useTranslation();
  const photos = (attachments || []).filter((a) => a.type === "photo");
  const docs = (attachments || []).filter((a) => a.type !== "photo");
  if (!photos.length && !docs.length) return null;
  const shown = photos.slice(0, 4);
  const cols = shown.length === 1 ? "grid-cols-1 max-w-[280px]" : "grid-cols-2 max-w-[320px]";
  return (
    <div className="mt-1 space-y-1.5" data-chat-attachments>
      {shown.length ? (
        <div className={`grid gap-1 ${cols}`}>
          {shown.map((a, i) => (
            <PhotoTile
              key={a.index}
              a={a}
              alt={a.name || t("app.companyChat.photo")}
              more={i === 3 ? photos.length - 4 : 0}
              onOpen={() => onOpenPhoto?.(a.index)}
              onExpired={onExpired}
            />
          ))}
        </div>
      ) : null}
      {docs.map((a) =>
        a.full ? (
          <a
            key={a.index}
            href={a.full}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-[360px] items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
            data-chat-file
          >
            <FileText size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{a.name || t("app.companyChat.file")}</span>
            {a.bytes ? <span className="shrink-0 text-xs text-muted-foreground">{megabytes(a.bytes)}</span> : null}
          </a>
        ) : (
          <p key={a.index} className="text-xs text-muted-foreground">{t("app.companyChat.fileUnavailable")}</p>
        ),
      )}
    </div>
  );
}

/** The photo viewer: the full photo, "Save to job photos" when allowed, and Close. */
export function Lightbox({ message, index, canSave, onSave, saving, onClose, onStep }) {
  const { t } = useTranslation();
  const photos = (message?.attachments || []).filter((a) => a.type === "photo");
  const at = photos.findIndex((a) => a.index === index);
  const a = photos[at] || null;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && at < photos.length - 1) onStep(photos[at + 1].index);
      if (e.key === "ArrowLeft" && at > 0) onStep(photos[at - 1].index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, photos, onClose, onStep]);
  if (!a) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={t("app.companyChat.photo")} data-chat-lightbox>
      <div className="flex items-center gap-2 px-3 py-2 text-white">
        <p className="min-w-0 flex-1 truncate text-sm">
          {message.who || ""} {photos.length > 1 ? `· ${at + 1}/${photos.length}` : ""}
        </p>
        {canSave ? (
          <button
            type="button"
            onClick={() => onSave(a.index)}
            disabled={saving}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-black disabled:opacity-60"
            data-save-to-job
          >
            {saving ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Briefcase size={15} aria-hidden="true" />}
            {t("app.companyChat.saveToJob")}
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label={t("app.chat.close")} className="grid h-11 w-11 place-items-center rounded-lg text-white hover:bg-white/10">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2" onClick={onClose}>
        {a.full ? (
          // The full link 302s to a Cloudinary link that expires in five
          // minutes; the browser follows it as an ordinary image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.full}
            alt={a.name || t("app.companyChat.photo")}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
            // An original only Safari can draw (a HEIC the phone could not
            // convert) falls back to the server's JPEG rendition.
            onError={(e) => {
              if (a.thumb && !e.currentTarget.dataset.fallback) {
                e.currentTarget.dataset.fallback = "1";
                e.currentTarget.src = a.thumb;
              }
            }}
          />
        ) : (
          <p className="text-sm text-white">{t("app.companyChat.fileUnavailable")}</p>
        )}
      </div>
      {photos.length > 1 ? (
        <div className="flex justify-center gap-2 pb-4">
          <Button onClick={() => at > 0 && onStep(photos[at - 1].index)} disabled={at === 0}>
            {t("app.companyChat.previous")}
          </Button>
          <Button onClick={() => at < photos.length - 1 && onStep(photos[at + 1].index)} disabled={at === photos.length - 1}>
            {t("app.companyChat.next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

/** A shared job, work order or quote, as resolved for this reader. Never a price. */
export function ChatCard({ card }) {
  const { t } = useTranslation();
  if (!card) return null;
  const kindLabel = t(`app.companyChat.card.kind.${card.type === "work_order" ? "workOrder" : card.type}`);
  const Icon = card.type === "quote" ? FileText : card.type === "work_order" ? ClipboardList : Briefcase;
  if (!card.open) {
    return (
      <div className="mt-1 max-w-[420px] border border-border bg-card" data-chat-card={card.type} data-card-restricted>
        <div className="flex items-center gap-2.5 border-l-4 border-border px-3 py-2.5">
          <Lock size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kindLabel}</p>
            <p className="text-sm text-foreground">
              {card.restricted === "office" ? t("app.companyChat.card.officeOnly") : t("app.companyChat.card.crewOnly")}
            </p>
          </div>
        </div>
      </div>
    );
  }
  const status = card.status && JOB_STATUS_KEYS[card.status] ? t(JOB_STATUS_KEYS[card.status]) : null;
  const title = card.type === "quote" ? [card.number, card.clientName].filter(Boolean).join(" · ") : card.title || kindLabel;
  return (
    <div className="mt-1 max-w-[420px] border border-border bg-card" data-chat-card={card.type}>
      <div className="flex gap-2.5 border-l-4 border-primary px-3 py-2.5">
        <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kindLabel}</p>
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {card.type !== "quote" && (status || card.nextVisitAt) ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[status, card.nextVisitAt ? t("app.companyChat.card.nextVisit", { date: dateLabel(card.nextVisitAt) }) : null].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {card.type === "work_order" ? <p className="mt-0.5 text-xs text-muted-foreground">{t("app.companyChat.card.noPrices")}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted px-3 py-2">
        {card.href ? (
          <Link href={card.href} className="inline-flex min-h-[36px] items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90" data-card-open>
            {card.type === "quote" ? t("app.companyChat.card.openQuote") : card.type === "work_order" ? t("app.companyChat.card.openWorkOrder") : t("app.companyChat.card.openJob")}
          </Link>
        ) : null}
        {card.type === "work_order" && card.quoteHref ? (
          <Link href={card.quoteHref} className="inline-flex min-h-[36px] items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted">
            {t("app.companyChat.card.openQuote")}
          </Link>
        ) : null}
        {card.type === "job" && card.workOrderHref ? (
          <Link href={card.workOrderHref} className="inline-flex min-h-[36px] items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted">
            {t("app.companyChat.card.openWorkOrder")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ── The message body ────────────────────────────────────────────────────────

/**
 * The body of one message row: reply quote, words (with the mention tint and
 * "(edited)"), files, card. A removed message is one italic line and nothing
 * else — the server sent nothing else.
 */
export function MessageBody({ m, onJump, onOpenPhoto, onExpired }) {
  const { t } = useTranslation();
  if (m.deleted) {
    return (
      <p className="text-sm italic text-muted-foreground" data-message-removed>
        {t("app.companyChat.messageRemoved")}
      </p>
    );
  }
  const failed = m.status === "failed";
  const pending = m.status === "pending";
  return (
    <div className="min-w-0">
      <ReplyStrip reply={m.replyTo} onJump={onJump} />
      {m.body ? (
        <p
          data-mentions-me={m.mentionsMe ? "true" : undefined}
          className={`whitespace-pre-wrap break-words text-sm ${
            failed ? "text-red-900 dark:text-red-200" : pending ? "text-muted-foreground" : "text-foreground"
          }${m.mentionsMe ? " -mx-1 rounded bg-amber-100 px-1 dark:bg-amber-950/40" : ""}`}
        >
          <ChatText text={m.body} />
          {m.edited ? (
            <span className="ml-1 text-[11px] text-muted-foreground" data-edited>
              {t("app.companyChat.edited")}
            </span>
          ) : null}
        </p>
      ) : m.edited ? (
        <span className="text-[11px] text-muted-foreground" data-edited>{t("app.companyChat.edited")}</span>
      ) : null}
      <AttachmentGrid attachments={m.attachments} onOpenPhoto={(index) => onOpenPhoto?.(m, index)} onExpired={onExpired} />
      <ChatCard card={m.card} />
      {m.pinned ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground" data-pinned-flag>
          <Pin size={11} aria-hidden="true" /> {t("app.companyChat.pinnedFlag")}
        </p>
      ) : null}
    </div>
  );
}

// ── Per-message actions ─────────────────────────────────────────────────────

/**
 * Which actions this reader is offered on this message. A courtesy: every
 * one is decided again by the server (rules.js canEditMessage /
 * canRemoveMessage / canPin, the 15-minute window on the server's clock).
 */
export function messageActions(m, can, { editWindowMs, now = Date.now() }) {
  if (!m || !m.id || m.kind === "system" || m.deleted || m.status) return [];
  const out = [];
  if (can.post) out.push("reply");
  if (m.mine && can.post && now - new Date(m.at).getTime() < editWindowMs) out.push("edit");
  if (can.pin) out.push(m.pinned ? "unpin" : "pin");
  if (can.saveToJob && (m.attachments || []).some((a) => a.type === "photo")) out.push("save");
  if ((m.mine && can.settings) || can.moderate) out.push("remove");
  return out;
}

const ACTION_ICON = { reply: CornerUpLeft, edit: Pencil, pin: Pin, unpin: PinOff, save: Briefcase, remove: Trash2 };
const ACTION_KEY = {
  reply: "app.companyChat.action.reply",
  edit: "app.companyChat.action.edit",
  pin: "app.companyChat.action.pin",
  unpin: "app.companyChat.action.unpin",
  save: "app.companyChat.saveToJob",
  remove: "app.companyChat.action.remove",
};

/** The hover toolbar's buttons (desktop). */
export function ActionButtons({ actions, onAction, extra = null }) {
  const { t } = useTranslation();
  return (
    <>
      {actions.map((a) => {
        const Icon = ACTION_ICON[a];
        return (
          <button
            key={a}
            type="button"
            onClick={() => onAction(a)}
            title={t(ACTION_KEY[a])}
            aria-label={t(ACTION_KEY[a])}
            className={`grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground ${a === "remove" ? "hover:text-red-700 dark:hover:text-red-300" : ""}`}
            data-message-action={a}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        );
      })}
      {extra}
    </>
  );
}

/** The "⋯" under a message on a phone, where there is no hover. */
export function MoreButton({ onClick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("app.companyChat.action.more")}
      className="inline-flex h-8 min-w-[32px] items-center justify-center rounded text-muted-foreground hover:bg-muted md:hidden"
      data-message-more
    >
      <MoreHorizontal size={16} aria-hidden="true" />
    </button>
  );
}

/** The message menu on a phone: big rows, one per action. */
export function ActionSheet({ actions, onAction, onClose, seenBy = null }) {
  const { t } = useTranslation();
  return (
    <Modal title={t("app.companyChat.action.title")} onClose={onClose}>
      <div className="flex flex-col">
        {actions.map((a) => {
          const Icon = ACTION_ICON[a];
          return (
            <button
              key={a}
              type="button"
              onClick={() => onAction(a)}
              className={`flex min-h-[52px] items-center gap-3 border-b border-border px-1 text-left text-base ${a === "remove" ? "text-red-700 dark:text-red-300" : "text-foreground"}`}
              data-sheet-action={a}
            >
              <Icon size={18} aria-hidden="true" /> {t(ACTION_KEY[a])}
            </button>
          );
        })}
        {seenBy}
      </div>
    </Modal>
  );
}

/** "Remove this message?" — said plainly: it is removed for everybody. */
export function RemoveConfirm({ busy, onConfirm, onClose, theirs }) {
  const { t } = useTranslation();
  return (
    <Modal
      title={t("app.companyChat.removeTitle")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("app.companyChat.cancel")}</Button>
          <Button danger onClick={onConfirm} disabled={busy} data-confirm-remove>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
            {t("app.companyChat.action.remove")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">{theirs ? t("app.companyChat.removeTheirsBody") : t("app.companyChat.removeBody")}</p>
    </Modal>
  );
}

// ── The pinned bar ──────────────────────────────────────────────────────────

/** Under the header: the newest pin, how many there are, and the list on tap. */
export function PinnedBar({ pinned, open, onToggle, onJump, canUnpin, onUnpin }) {
  const { t } = useTranslation();
  if (!pinned?.length) return null;
  const words = (p) => p.body || (p.attachments ? t("app.companyChat.attachmentCount", { count: p.attachments }) : p.card ? t("app.companyChat.sharedCard") : "");
  return (
    <div className="border-b border-border bg-secondary text-secondary-foreground" data-pinned-bar>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <Pin size={14} aria-hidden="true" className="shrink-0" />
        <b className="shrink-0 font-semibold">{t("app.companyChat.pinnedLabel")}</b>
        <span className="min-w-0 flex-1 truncate">{words(pinned[0])}</span>
        <span className="shrink-0 text-xs font-medium text-primary">{t("app.companyChat.pinnedCount", { count: pinned.length })}</span>
      </button>
      {open ? (
        <ul className="max-h-60 overflow-y-auto border-t border-border bg-card" data-pinned-list>
          {pinned.map((p) => (
            <li key={p.id} className="flex items-start gap-2 border-b border-border px-3 py-2 last:border-b-0">
              <button type="button" onClick={() => onJump(p.id)} className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-semibold text-foreground">{p.who || t("app.companyChat.someoneWhoLeft")}</span>
                <span className="block truncate text-sm text-muted-foreground">{words(p)}</span>
              </button>
              {canUnpin ? (
                <button
                  type="button"
                  onClick={() => onUnpin(p.id)}
                  aria-label={t("app.companyChat.action.unpin")}
                  title={t("app.companyChat.action.unpin")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <PinOff size={14} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── The job picker ──────────────────────────────────────────────────────────

/** The jobs this person can see — to save a photo to, or to share as a card. */
export function JobPickerModal({ title, onPick, onClose, busy = false }) {
  const { t } = useTranslation();
  const say = useSay();
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      chatApi
        .jobs(q)
        .then((d) => alive && (setJobs(d.jobs || []), setError("")))
        .catch((err) => alive && setError(say(err, "app.companyChat.loadError")));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q, say]);
  return (
    <Modal title={title} onClose={onClose}>
      <label className="relative mb-2 block">
        <span className="sr-only">{t("app.companyChat.jobSearch")}</span>
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("app.companyChat.jobSearch")}
          className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-base text-foreground"
        />
      </label>
      {error ? <p className="py-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      {jobs === null && !error ? (
        <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
        </p>
      ) : null}
      {jobs && !jobs.length ? <p className="py-3 text-sm text-muted-foreground">{t("app.companyChat.noJobs")}</p> : null}
      <ul className="divide-y divide-border">
        {(jobs || []).map((j) => (
          <li key={j.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(j)}
              className="flex min-h-[52px] w-full items-center gap-3 px-1 text-left hover:bg-muted disabled:opacity-60"
              data-job-pick
            >
              <Briefcase size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{j.title || t("app.companyChat.untitledJob")}</span>
              {j.status && JOB_STATUS_KEYS[j.status] ? <span className="shrink-0 text-xs text-muted-foreground">{t(JOB_STATUS_KEYS[j.status])}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────

/**
 * Search, in the context pane: this conversation, or every conversation the
 * reader can read. The server decides which rooms that is
 * (store.js searchMessages); a private channel they are not in is never a
 * result, and a removed message never is either.
 */
export function SearchPanel({ roomId, roomTitle, roomNameFor, onOpen, onClose }) {
  const { t } = useTranslation();
  const say = useSay();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState(roomId ? "room" : "all");
  const [state, setState] = useState({ q: null, results: [], loading: false, error: "" });
  const input = useRef(null);
  // Block body: a method's return value is never the effect's cleanup
  // (scripts/check-hooks.config.mjs, fieldquo/effect-returns-cleanup).
  useEffect(() => {
    input.current?.focus();
  }, []);
  const term = useMemo(() => searchTerm(q), [q]);
  useEffect(() => {
    if (!term) {
      setState({ q: null, results: [], loading: false, error: "" });
      return undefined;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const id = setTimeout(() => {
      chatApi
        .search(term, { room: scope === "room" ? roomId : null })
        .then((d) => alive && setState({ q: d.q, results: d.results || [], loading: false, error: "" }))
        .catch((err) => alive && setState({ q: term, results: [], loading: false, error: say(err, "app.companyChat.searchError") }));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [term, scope, roomId, say]);
  return (
    <div className="flex h-full min-h-0 flex-col" data-chat-search>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{t("app.companyChat.search")}</h2>
        <button type="button" onClick={onClose} aria-label={t("app.chat.close")} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="space-y-2 border-b border-border px-3 py-2">
        <label className="relative block">
          <span className="sr-only">{t("app.companyChat.search")}</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("app.companyChat.searchPlaceholder")}
            className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-base text-foreground"
            data-chat-search-input
          />
        </label>
        {roomId ? (
          <div className="flex gap-1 text-xs" role="radiogroup" aria-label={t("app.companyChat.searchScope")}>
            {["room", "all"].map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={scope === k}
                onClick={() => setScope(k)}
                className={`min-h-[32px] rounded-md border px-2.5 ${scope === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
              >
                {k === "room" ? t("app.companyChat.searchHere", { name: roomTitle }) : t("app.companyChat.searchEverywhere")}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.error ? <p className="px-3 py-3 text-sm text-red-700 dark:text-red-300">{state.error}</p> : null}
        {!term ? <p className="px-3 py-3 text-sm text-muted-foreground">{t("app.companyChat.searchHint")}</p> : null}
        {term && state.loading ? (
          <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
          </p>
        ) : null}
        {term && !state.loading && !state.error && !state.results.length ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">{t("app.companyChat.searchNothing")}</p>
        ) : null}
        <ul className="divide-y divide-border">
          {state.results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r)} className="block w-full px-3 py-2.5 text-left hover:bg-muted" data-search-result>
                <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{roomNameFor(r)}</span>
                  <span className="shrink-0">{dateLabel(r.at)}</span>
                </span>
                <span className="block text-xs text-muted-foreground">{r.mine ? t("app.chat.you") : r.who || t("app.companyChat.someoneWhoLeft")}</span>
                <span className="mt-0.5 block text-sm text-foreground break-words">{r.body}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── The files waiting in the composer ───────────────────────────────────────

/** Chips above the box: each picked file, its upload, and a way to take it back out. */
export function PendingFiles({ files, onRemove }) {
  const { t } = useTranslation();
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-2" data-pending-files>
      {files.map((f) => (
        <span
          key={f.id}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
            f.status === "failed" ? "border-red-300 text-red-800 dark:border-red-800 dark:text-red-200" : "border-border text-foreground"
          }`}
        >
          {f.status === "uploading" ? <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : f.kind === "photo" ? <ImagePlus size={12} aria-hidden="true" /> : <FileText size={12} aria-hidden="true" />}
          <span className="max-w-[160px] truncate">{f.name || t("app.companyChat.file")}</span>
          {f.status === "uploading" && f.progress ? <span className="tabular-nums text-muted-foreground">{Math.round(f.progress * 100)}%</span> : null}
          {f.status === "failed" ? <span className="truncate">{f.error}</span> : null}
          <button type="button" onClick={() => onRemove(f.id)} aria-label={t("app.companyChat.removeFile")} className="grid h-6 w-6 place-items-center rounded hover:bg-muted">
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}
