"use client";

// app/app/settings/messages/page.js
//
// The wording of the text messages clients receive.
//
// ── Only messages that actually send are here ──────────────────────────────
//
// Today that's one: the "on my way" text. The API returns only editable types,
// so this page can't grow an editor for a message that never goes out — the
// dead control this codebase keeps deleting. When another message gets a real
// send path, it appears here automatically.
//
// ── The preview is the honesty ─────────────────────────────────────────────
//
// Every edit shows exactly what a customer would receive, filled with sample
// values. A template with an unknown field can't be saved — the server checks
// too — so nobody ever texts a customer a raw "{price}".

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Loader2, Check, RotateCcw } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ClientMessagesPage() {
  const { t } = useTranslation();
  const [types, setTypes] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/message-templates");
    if (!res.ok) {
      await reportResponseError(res, t("app.setMessages.loadError"));
      return;
    }
    const data = await res.json();
    setTypes(data.types || []);
  }, []);

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
          {t("app.setMessages.subtitle")}
        </p>
      </div>

      {(types || []).map((t) => (
        <MessageEditor key={t.key} type={t} onSaved={load} />
      ))}
    </div>
  );
}

function MessageEditor({ type, onSaved }) {
  const { t } = useTranslation();
  const [text, setText] = useState(type.custom || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const isCustom = Boolean(type.custom);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">{type.label}</h2>
        {isCustom && (
          <span className="text-xs text-muted-foreground">{t("app.setMessages.customised")}</span>
        )}
      </div>

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
            onClick={() => setText((t) => `${t}{${tk.token}}`)}
            title={tk.hint}
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
    }[token] ?? ""
  );
}
