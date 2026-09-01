"use client";

// app/components/jobs/JobPhotoComments.js
//
// One photo's comment thread, and the @mention picker beside it.
//
// ── Internal, and it looks it ───────────────────────────────────────────────
//
// There is nothing client-facing anywhere near this component — it only ever
// renders inside /app, behind the same session gate as the rest of the job
// page. See prisma/schema.prisma's JobPhotoComment doc comment for the two
// guards that keep a comment off the public gallery, the portal and every PDF.
//
// ── Flat thread, chip-style mentions ────────────────────────────────────────
//
// No reply-to-reply nesting (see the JobPhotoComment doc comment for why) and
// no "@" parsed out of free text either: the composer offers eligible people
// as tappable chips instead of expecting someone typing on a phone in a
// driveway to type an exact name and trust autocomplete to catch it. The chip
// list IS the mention list the server receives — there is no separate parsing
// step that could disagree with what's shown, which is the same "the browser
// never invents what the server enforces" shape as the add-on picker.
//
// ── Who can be mentioned is fetched, not assumed ────────────────────────────
//
// /api/jobs/[id]/mentionable already applies the same "can this member see
// this job" rule the comment route uses to VALIDATE the mention server-side —
// so the chip list can only ever offer people the send will actually accept.
import { useEffect, useState, useCallback } from "react";
import { X, Send, Loader2, AtSign } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function JobPhotoComments({ jobId, photo, onClose }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState(null);
  const [mentionable, setMentionable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState([]); // memberIds
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [commentsRes, mentionableRes] = await Promise.all([
      fetch(`/api/jobs/${jobId}/photos/${photo.id}/comments`),
      fetch(`/api/jobs/${jobId}/mentionable`),
    ]);
    if (!commentsRes.ok) {
      await reportResponseError(
        commentsRes,
        t("app.jobPhotoComments.loadFailed", "Couldn't load this photo's comments."),
      );
      return;
    }
    const commentsData = await commentsRes.json();
    setComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
    // Non-fatal if this one fails — the thread still reads fine without a
    // mention picker, it just can't tag anyone new.
    if (mentionableRes.ok) {
      const mentionableData = await mentionableRes.json();
      setMentionable(Array.isArray(mentionableData.members) ? mentionableData.members : []);
    }
  }, [jobId, photo.id, t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function toggleMention(memberId) {
    setSelected((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  }

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/photos/${photo.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, mentionMemberIds: selected }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || t("app.jobPhotoComments.sendFailed", "That comment didn't save."));
        return;
      }
      setBody("");
      setSelected([]);
      // Re-read rather than splicing the response in locally — the server
      // decides which mentions actually landed (some may have been dropped:
      // scoped off the job, deactivated, another tenant's id), and a list
      // built from what was SENT would disagree with what was SAVED.
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">
            {t("app.jobPhotoComments.title", "Photo comments")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted"
            aria-label={t("app.jobPhotoComments.close", "Close")}
          >
            <X size={16} />
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption || ""} className="w-full aspect-video object-cover" />

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-accent rounded w-3/4" />
              <div className="h-4 bg-accent rounded w-1/2" />
            </div>
          ) : comments && comments.length > 0 ? (
            comments.map((c) => (
              <div key={c.id} className="text-sm">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-semibold text-foreground">{c.author.name || "—"}</span>
                  <span className="text-[11px] text-muted-foreground">{formatWhen(c.createdAt)}</span>
                </div>
                <p className="text-foreground whitespace-pre-wrap break-words">{c.body}</p>
                {c.mentions.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t("app.jobPhotoComments.taggedLabel", "Tagged:")}{" "}
                    {c.mentions.map((m) => m.name || "—").join(", ")}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("app.jobPhotoComments.empty", "No comments yet on this photo.")}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          {mentionable.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mentionable.map((m) => {
                const active = selected.includes(m.memberId);
                return (
                  <button
                    key={m.memberId}
                    type="button"
                    onClick={() => toggleMention(m.memberId)}
                    className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    <AtSign size={11} />
                    {m.name || t("app.jobPhotoComments.unnamed", "Team member")}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("app.jobPhotoComments.placeholder", "Add a comment…")}
              rows={2}
              maxLength={2000}
              className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 resize-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !body.trim()}
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 shrink-0"
              aria-label={t("app.jobPhotoComments.send", "Send")}
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
