"use client";

// app/app/settings/messages/page.js
//
// The wording of the text messages clients receive.
//
// ── Only messages that actually send are here ──────────────────────────────
//
// Today that's nine: "on my way", the appointment reminder, the booking
// confirmation, the moved / cancelled texts, the two document-link texts, and
// the two follow-up chases. The API returns only editable types,
// so this page can't grow an editor for a message that never goes out — the
// dead control this codebase keeps deleting. When another message gets a real
// send path, it appears here automatically.
//
// The moved and cancelled texts have no switch of their own: the booking
// confirmation's switch governs all three (lib/schedule/changeText.js), and
// their cards say so and show its state rather than offering a second
// toggle that could disagree with the first.
//
// ── The preview is the honesty ─────────────────────────────────────────────
//
// Every edit shows exactly what a customer would receive, filled with sample
// values. A template with an unknown field can't be saved — the server checks
// too — so nobody ever texts a customer a raw "{price}".

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Loader2, Check, RotateCcw, Video, ExternalLink } from "lucide-react";
import { normalisePreQuoteVideoUrl } from "@/lib/followUps/preQuoteVideo";
import { reportResponseError } from "@/lib/clientErrors";
import AutoTranslateBanner from "@/app/components/settings/AutoTranslateBanner";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ClientMessagesPage() {
  const { t } = useTranslation();
  const [types, setTypes] = useState(null);
  const [loading, setLoading] = useState(true);
  // A toast fades; a title over an empty page does not. `types` stayed null on
  // failure and the render did `(types || []).map(...)`, so a refused read
  // produced a heading, a subtitle and nothing else — which reads as "there
  // are no editable messages", not as "we couldn't ask".
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/message-templates");
      if (!res.ok) {
        setLoadError(
          await reportResponseError(res, t("app.setMessages.loadError")),
        );
        return;
      }
      const data = await res.json();
      setTypes(Array.isArray(data.types) ? data.types : []);
      setLoadError("");
    } catch {
      setLoadError(t("app.setMessages.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare size={22} /> {t("app.settings.messages")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setMessages.subtitle")}{" "}
          {t("app.setMessages.languageHint")}
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      <ConversationLinking />

      {/* Above the wording that uses it: the enquiry follow-up's {video}
          token and the enquiry follow-up EMAIL both read this one field, so
          a company setting it sees, immediately below, the texts it appears
          in. `onSaved` reloads the editors because their previews stand in
          the company's real video — a saved link changes what the preview of
          the enquiry text says. */}
      <PreQuoteVideo onSaved={load} />

      {(types || []).map((type) => (
        <MessageEditor key={type.key} type={type} onSaved={load} />
      ))}
    </div>
  );
}

/**
 * "Link conversations to clients automatically" (owner, 2026-10-05) —
 * Company.autoLinkConversations, read by lib/conversations/autoLink.js on
 * every message that arrives. Optimistic, reconciled from the server's
 * answer, put back with the server's sentence on a refusal. A member who may
 * not change it (the route answers 403) sees the state and no live switch.
 */
function ConversationLinking() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/settings/conversation-linking")
      .then(async (res) => {
        if (!res.ok) {
          const msg = await reportResponseError(res, t("app.setMessages.autoLink.loadError"));
          if (live) setError(msg);
          return;
        }
        const d = await res.json();
        if (live) setEnabled(d.enabled !== false);
      })
      .catch(() => live && setError(t("app.setMessages.autoLink.loadError")));
    return () => {
      live = false;
    };
  }, [t]);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/conversation-linking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        setEnabled(!next);
        const d = await res.json().catch(() => null);
        setError(d?.error || t("app.setMessages.saveError"));
        return;
      }
      const d = await res.json().catch(() => null);
      if (typeof d?.enabled === "boolean") setEnabled(d.enabled);
    } catch {
      setEnabled(!next);
      setError(t("app.setMessages.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5" data-conversation-linking>
      <h2 className="text-sm font-bold text-foreground">{t("app.setMessages.autoLink.title")}</h2>
      {enabled === null && !error ? (
        <div className="mt-3 h-6 w-40 rounded bg-accent animate-pulse" />
      ) : null}
      {enabled !== null ? (
        <div className="mt-3 flex items-start gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t("app.setMessages.autoLink.title")}
            disabled={saving}
            onClick={toggle}
            className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full border transition-colors disabled:opacity-60 ${
              enabled ? "bg-inverted border-inverted" : "bg-muted border-border"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-card shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {enabled ? t("app.setMessages.autoLink.on") : t("app.setMessages.autoLink.off")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("app.setMessages.autoLink.hint")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("app.setMessages.autoLink.jobsHint")}</p>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p> : null}
    </section>
  );
}

/**
 * The company's PRE-QUOTE video — Company.preQuoteVideoUrl, the film a
 * homeowner watches before the estimator arrives.
 *
 * ── What this field is NOT ───────────────────────────────────────────────
 *
 * Not the "About us" video on the client proposal (Company.storyVideoUrl).
 * lib/followUps/preQuoteVideo.js spends a paragraph on why they are two
 * columns; the short version is that they have two different audiences and a
 * company that has filmed one must not have it shown as the other.
 *
 * ── Why there is an "open it and check it plays" link ────────────────────
 *
 * Because the follow-ups send the homeowner to this exact url and nothing
 * else — no embed, no wrapper page (that decision is argued in
 * preQuoteVideo.js). So the only thing that can go wrong is the address, and
 * the one honest way to check an address is to open it. The same reasoning as
 * the review link on Settings › Reviews, which carries the same affordance
 * for the same reason.
 *
 * The field validates through the SAME function the server and the send path
 * use, so what saves is what sends.
 */
function PreQuoteVideo({ onSaved }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // A refused LOAD is not an empty field. Left as "" the screen would have
  // told a company that has a video that it has none, and the next save
  // would have been made against a value nobody read.
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/settings/pre-quote-video")
      .then(async (res) => {
        if (!res.ok) {
          const msg = await reportResponseError(res, t("app.setMessages.video.loadError"));
          if (live) setLoadError(msg);
          return;
        }
        const d = await res.json();
        if (!live) return;
        setUrl(d?.url || "");
        setDraft(d?.url || "");
      })
      .catch(() => live && setLoadError(t("app.setMessages.video.loadError")));
    return () => {
      live = false;
    };
  }, [t]);

  // The client-side half of the check, so a typo is named before a round
  // trip. The server runs the same function and is the one that decides —
  // this is the friendly half, exactly as the message templates' unknown-token
  // warning is.
  const trimmed = draft.trim();
  const check = normalisePreQuoteVideoUrl(trimmed);
  const dirty = trimmed !== (url || "");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/pre-quote-video", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || t("app.setMessages.video.saveError"));
        return;
      }
      const d = await res.json().catch(() => null);
      setUrl(d?.url || "");
      setDraft(d?.url || "");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch {
      setError(t("app.setMessages.video.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Video size={16} /> {t("app.setMessages.video.title")}
      </h2>
      <p className="text-xs text-muted-foreground mt-1">{t("app.setMessages.video.hint")}</p>

      {loadError ? (
        <p className="text-xs text-red-600 dark:text-red-400 mt-3">{loadError}</p>
      ) : url === null ? (
        <div className="mt-3 h-9 w-full max-w-sm rounded bg-accent animate-pulse" />
      ) : (
        <>
          <label className="block mt-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setMessages.video.label")}
            </span>
            <input
              type="url"
              inputMode="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
            />
          </label>

          {/* Only once they have typed something that isn't yet a usable
              address — an empty field is a legal state (no video), not an
              error, so it says nothing. */}
          {trimmed && !check.ok && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              {t("app.setMessages.video.invalid")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              disabled={saving || !dirty || (Boolean(trimmed) && !check.ok)}
              onClick={save}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{" "}
              {t("app.action.save")}
            </button>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline"
              >
                <ExternalLink size={12} /> {t("app.setMessages.video.open")}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">{t("app.setMessages.video.none")}</span>
            )}
            {saved && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={14} /> {t("app.action.saved")}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            {t("app.setMessages.video.rulesPre")}{" "}
            <Link href="/app/settings/follow-ups" className="underline">
              {t("app.settings.followUps")}
            </Link>{" "}
            {t("app.setMessages.video.rulesPost")}
          </p>
        </>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
    </section>
  );
}

function MessageEditor({ type, onSaved }) {
  const { t } = useTranslation();
  const [text, setText] = useState(type.custom || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(null);
  const [error, setError] = useState("");

  // Local live preview: substitute the sample values the same way the server
  // will. Kept simple — the authoritative render is the server's, shown after
  // save. Unknown fields are surfaced as an error before you can save.
  const allowed = new Set(type.tokens.map((tk) => tk.token));
  const unknown = [...new Set([...(text.matchAll(/\{(\w+)\}/g))].map((m) => m[1]))].filter(
    (tk) => !allowed.has(tk),
  );
  const preview = fillPreview(text || type.defaultPreview, type);

  async function save(nextText) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/message-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type.key, text: nextText }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || t("app.setMessages.saveError"));
        return;
      }
      const answer = await res.json().catch(() => null);
      setAutoTranslate(answer?.autoTranslate || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const isCustom = Boolean(type.custom);

  // ── The switch, for the one type that has one ──────────────────────────
  //
  // The booking confirmation is ON until the company turns it off
  // (lib/booking/bookingText.js — off-by-default meant no booking ever
  // texted), and the same switch governs the moved and cancelled texts. The
  // quote-sent text carries the second switch (lib/sms/documentText.js) and
  // the invoice follows it. Either way it sits here, beside the wording it
  // governs, so nobody edits a message that isn't going out without seeing
  // that it isn't. Optimistic, then reconciled from the server's answer; a
  // refused save puts the pill back and says why.
  //
  // The sentences come WITH the switch (`switchCopy`), not from a constant
  // here: "every client who books gets a text" describes the booking toggle
  // and would be a lie beside the document one. The old hardcoded booking
  // keys are kept as the fallback so a stale response can't render blank.
  const hasSwitch = typeof type.enabled === "boolean";
  const sc = type.switchCopy || {};
  const [enabled, setEnabled] = useState(Boolean(type.enabled));
  const [switching, setSwitching] = useState(false);
  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSwitching(true);
    setError("");
    try {
      const res = await fetch("/api/settings/message-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type.key, enabled: next }),
      });
      if (!res.ok) {
        setEnabled(!next);
        const d = await res.json().catch(() => null);
        setError(d?.error || t("app.setMessages.saveError"));
        return;
      }
      const d = await res.json().catch(() => null);
      if (typeof d?.enabled === "boolean") setEnabled(d.enabled);
      onSaved?.();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">
          {type.labelKey ? t(type.labelKey, type.label) : type.label}
        </h2>
        {isCustom && (
          <span className="text-xs text-muted-foreground">{t("app.setMessages.customised")}</span>
        )}
      </div>

      {hasSwitch && (
        <div className="mt-3 flex items-start gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={switching}
            onClick={toggle}
            className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full border transition-colors disabled:opacity-60 ${
              enabled ? "bg-inverted border-inverted" : "bg-muted border-border"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-card shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {enabled
                ? t(sc.on || "app.setMessages.bookingSmsOn")
                : t(sc.off || "app.setMessages.bookingSmsOff")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(sc.hint || "app.setMessages.bookingSmsHint")}
            </p>
          </div>
        </div>
      )}

      {type.followsSwitch && (
        <p className="mt-2 text-xs text-muted-foreground">
          {type.switchOn
            ? t(sc.followsOn || "app.setMessages.changeSmsOn")
            : t(sc.followsOff || "app.setMessages.changeSmsOff")}
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={type.defaultPreview}
        className="w-full mt-3 px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none"
      />

      {/* The tokens they're allowed to use, tappable to insert. */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {type.tokens.map((tk) => (
          <button
            key={tk.token}
            type="button"
            onClick={() => setText((prevText) => `${prevText}{${tk.token}}`)}
            title={tk.hintKey ? t(tk.hintKey, tk.hint) : tk.hint}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted font-mono"
          >
            {`{${tk.token}}`}
          </button>
        ))}
      </div>

      {unknown.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
          {unknown.length === 1 ? t("app.setMessages.unknownField") : t("app.setMessages.unknownFields")}:{" "}
          {unknown.map((u) => `{${u}}`).join(", ")}. {t("app.setMessages.unknownSuffix")}
        </p>
      )}

      {/* What the customer actually receives. */}
      <div className="mt-3">
        <p className="text-xs text-muted-foreground mb-1">{t("app.setMessages.clientSees")}</p>
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
          {preview || <span className="text-muted-foreground">{t("app.setMessages.writePrompt")}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          disabled={saving || unknown.length > 0 || text.trim() === (type.custom || "")}
          onClick={() => save(text)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("app.action.save")}
        </button>
        {isCustom && (
          <button
            type="button"
            disabled={saving}
            onClick={() => { setText(""); save(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={13} /> {t("app.setMessages.useDefault")}
          </button>
        )}
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check size={14} /> {t("app.action.saved")}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
      <AutoTranslateBanner result={autoTranslate} className="mt-3" />
    </section>
  );
}

/** Fill {token} with each token's sample value, for the local preview. */
function fillPreview(text, type) {
  const samples = Object.fromEntries(type.tokens.map((tk) => [tk.token, sampleFor(tk.token)]));
  return String(text || "")
    .replace(/\{(\w+)\}/g, (whole, tk) => (tk in samples ? samples[tk] : whole))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

// A tiny sample set mirroring the server's token samples, so the preview reads
// naturally while typing. The server's preview (shown after save) is canonical.
function sampleFor(token) {
  return (
    {
      company: "Northside Painting",
      worker: "Dave",
      name: "Sam",
      eta: "20 min",
      when: "Tue, Aug 12 at 2:00 PM",
      location: "123 Oak St",
      service: "on-site estimate",
      where: "On-site visit at 123 Oak St",
      fee: "No charge",
      previous: "Mon, Aug 11 at 9:00 AM",
      link: "https://app.fieldquo.com/visit/…",
      phone: "555-0100",
      // No stand-in for `video`: the server's preview fills it with the
      // company's OWN pre-quote video or leaves it empty, and a sample url
      // here would show a company with no video a sentence their clients
      // will never receive. "" makes the clause vanish while typing, exactly
      // as it will on the phone. The server's render, shown after save, is
      // canonical.
      video: "",
    }[token] ?? ""
  );
}
