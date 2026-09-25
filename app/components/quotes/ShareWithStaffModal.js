// app/components/quotes/ShareWithStaffModal.js
//
// "Share with staff": a link to this quote's back-office page, posted into
// the company's own crew chat — a room (#general, a job room) or a direct
// message to one person — with an optional line from the sender.
//
// ── Why chat, and not a new "internal note" ─────────────────────────────────
//
// The company already has a place its people read (app/app/chat, backed by
// lib/company/chat/store.js): rooms, DMs, mentions, web push to the person
// named. A second inbox for "somebody sent you a quote" would be the copy
// that rots. So this posts a real message through the real route — POST
// /api/chat/rooms/[id] — and the recipient sees it exactly where every other
// message lands, push and all. The link is the app page, never the client's
// public /q/ link: staff open the quote, they do not approve it.
"use client";

import { useEffect, useState } from "react";
import { Share2, X, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

export default function ShareWithStaffModal({ isOpen, onClose, quoteId, quoteNumber, onShared }) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState(null);
  const [people, setPeople] = useState([]);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError("");
    setTarget("");
    setMessage("");
    Promise.all([fetchJson("/api/chat/rooms"), fetchJson("/api/chat/directory")])
      .then(([r, d]) => {
        if (cancelled) return;
        const list = Array.isArray(r?.rooms) ? r.rooms : [];
        setRooms(list);
        setPeople((Array.isArray(d?.people) ? d.people : []).filter((p) => !p.isYou));
        // #general first when it exists — the one room everybody is in.
        const general = list.find((x) => x.kind === "general");
        if (general) setTarget(`room:${general.id}`);
      })
      .catch((err) => {
        if (cancelled) return;
        setRooms([]);
        setError(err.message || t("app.shareStaff.loadError", "Couldn't load your team chat."));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, t]);

  if (!isOpen) return null;

  const link = typeof window !== "undefined" ? `${window.location.origin}/app/quotes/${quoteId}` : `/app/quotes/${quoteId}`;

  async function share() {
    if (!target) {
      setError(t("app.shareStaff.pickTarget", "Pick a room or a person."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      let roomId = target.startsWith("room:") ? target.slice(5) : null;
      if (!roomId) {
        // A person: open (or reuse) the direct room with them first.
        const made = await fetchJson("/api/chat/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ with: target.slice(7) }),
        });
        roomId = made?.roomId;
        if (!roomId) throw new Error(t("app.shareStaff.noRoom", "Couldn't open a conversation with them."));
      }
      const body = [message.trim(), `${t("app.shareStaff.quoteWord", "Quote")} ${quoteNumber}: ${link}`].filter(Boolean).join("\n");
      await fetchJson(`/api/chat/rooms/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      onShared?.(roomId);
      onClose();
    } catch (err) {
      setError(err.message || t("app.shareStaff.error", "Couldn't share this quote."));
    } finally {
      setBusy(false);
    }
  }

  const roomLabel = (r) => (r.kind === "general" ? "#general" : r.kind === "job" ? `#${r.name || t("app.shareStaff.jobRoom", "job")}` : r.name || t("app.shareStaff.direct", "Direct message"));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true" onClick={busy ? undefined : onClose}>
      <div className="fq-dialog-card bg-card text-foreground w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border shadow-xl" onClick={(e) => e.stopPropagation()} data-share-staff-modal>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2"><Share2 size={16} /> {t("app.shareStaff.title", "Share with staff")}</h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close", "Close")} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">{t("app.shareStaff.hint", "Posts a link to this quote in your team chat. Only people in your company can open it.")}</p>
          <div>
            <label htmlFor="share-staff-target" className="block text-xs font-medium text-muted-foreground mb-1">{t("app.shareStaff.to", "To")}</label>
            {rooms === null ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {t("app.shareStaff.loading", "Loading…")}</p>
            ) : (
              <select id="share-staff-target" value={target} onChange={(e) => setTarget(e.target.value)} className="w-full border border-border rounded px-2 py-2 text-sm bg-background">
                <option value="">{t("app.shareStaff.pickTarget", "Pick a room or a person.")}</option>
                {rooms.filter((r) => r.kind !== "dm").length > 0 && (
                  <optgroup label={t("app.shareStaff.rooms", "Rooms")}>
                    {rooms.filter((r) => r.kind !== "dm").map((r) => (
                      <option key={r.id} value={`room:${r.id}`}>{roomLabel(r)}</option>
                    ))}
                  </optgroup>
                )}
                {people.length > 0 && (
                  <optgroup label={t("app.shareStaff.people", "People")}>
                    {people.map((p) => (
                      <option key={p.id} value={`member:${p.id}`}>{p.name || p.email}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>
          <div>
            <label htmlFor="share-staff-message" className="block text-xs font-medium text-muted-foreground mb-1">{t("app.shareStaff.message", "Message (optional)")}</label>
            <textarea id="share-staff-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full border border-border rounded px-2 py-2 text-sm bg-background resize-none" placeholder={t("app.shareStaff.messagePlaceholder", "Can you check the ceiling price before this goes out?")} />
          </div>
          <p className="text-[11px] text-muted-foreground break-all">{link}</p>
          {error ? <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-full text-sm font-semibold border border-border text-foreground">{t("app.action.cancel", "Cancel")}</button>
          <button type="button" onClick={share} disabled={busy || rooms === null} className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60" data-share-staff-send>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            {t("app.shareStaff.send", "Share")}
          </button>
        </div>
      </div>
    </div>
  );
}
