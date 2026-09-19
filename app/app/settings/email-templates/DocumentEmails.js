"use client";

// app/app/settings/email-templates/DocumentEmails.js
//
// The "Document emails" group on Settings → Email templates: the quote,
// invoice, reminder, receipt and deposit-request emails, each shown as the
// read-only ORIGINAL with a preview rendered by the real builder against a
// real document of the company's, and a "Customise" that makes the company
// a copy of the five wording slots — never of the scope, totals, process or
// legal lines, which stay derived (lib/email/documentEmailWording.js).
//
// A copy is per language. A document in a language with no copy, or with a
// copy that is not switched on, uses the original. The original is never
// written: there is no control here that could.
//
// Item 3's two modes apply to a copy: Blocks (the five typed slots) or
// Canvas (the greeting and intro drawn on the designer's canvas, compiled to
// email HTML — lib/email/canvasEmail.js). The copy records which one is sent
// (`sentMode`), keeps both bodies, and the preview renders the one that would
// go out.

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Pencil, RotateCcw, Trash2, Check, Undo2, LayoutList, Brush } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import EmailCanvasEditor from "@/app/components/emailCanvas/EmailCanvasEditor";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

const SLOT_LABEL_KEYS = {
  subject: "app.docEmails.slotSubject",
  greeting: "app.docEmails.slotGreeting",
  intro: "app.docEmails.slotIntro",
  closing: "app.docEmails.slotClosing",
  signature: "app.docEmails.slotSignature",
};

const TOKEN_LABEL_KEYS = {
  clientName: "app.docEmails.tokenClientName",
  companyName: "app.docEmails.tokenCompanyName",
  companyPhone: "app.docEmails.tokenCompanyPhone",
  quoteNumber: "app.docEmails.tokenQuoteNumber",
  invoiceNumber: "app.docEmails.tokenInvoiceNumber",
  amount: "app.docEmails.tokenAmount",
};

function Preview({ kind, language, copy, onMeta }) {
  const { t } = useTranslation();
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);
  // The body of the request, as a string, so an unchanged draft does not
  // re-render and a changed one re-renders once, 400ms after the last key.
  const body = useMemo(() => JSON.stringify({ kind, language, copy }), [kind, language, copy]);

  useEffect(() => {
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/settings/document-emails/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) {
          setError(await reportResponseError(res));
          setHtml("");
          return;
        }
        const data = await res.json();
        setHtml(data.html || "");
        setError("");
        onMeta?.(data);
      } catch {
        setError(t("app.load.network"));
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  return (
    <div className="bg-muted border border-border rounded-xl p-3">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <iframe
          title={t("app.docEmails.previewTitle")}
          srcDoc={html}
          sandbox=""
          className={`bg-card rounded-lg border border-border w-full transition-opacity ${loading ? "opacity-60" : ""}`}
          style={{ height: 620 }}
        />
      )}
    </div>
  );
}

function KindCard({ kind, labelKey, languages, originals, copies, tokens, slots, onChanged, canManage }) {
  const { t, language: uiLanguage } = useTranslation();
  const [language, setLanguage] = useState(languages.includes(uiLanguage) ? uiLanguage : "en");
  const [open, setOpen] = useState(false); // preview / editor panel open
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null); // the copy being edited (slots, sentMode, canvas)
  const [meta, setMeta] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const copy = copies.find((c) => c.kind === kind && c.language === language) || null;
  const original = originals[kind]?.[language] || {};

  // A fresh draft whenever the stored copy changes under it (save, reset).
  useEffect(() => {
    setDraft(copy ? { slots: { ...copy.slots }, sentMode: copy.sentMode, canvas: copy.canvas } : null);
  }, [copy?.id, copy?.updatedAt, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (!copy || !draft) return false;
    return (
      JSON.stringify(draft.slots) !== JSON.stringify(copy.slots) ||
      draft.sentMode !== copy.sentMode ||
      JSON.stringify(draft.canvas || null) !== JSON.stringify(copy.canvas || null)
    );
  }, [copy, draft]);

  async function customise() {
    setBusy(true);
    const res = await fetch("/api/settings/document-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, language }),
    });
    if (res.ok) {
      await onChanged();
      setOpen(true);
    } else await reportResponseError(res);
    setBusy(false);
  }

  async function patch(body) {
    if (!copy) return;
    setBusy(true);
    const res = await fetch(`/api/settings/document-emails/${copy.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await onChanged();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } else await reportResponseError(res);
    setBusy(false);
  }

  async function remove() {
    if (!copy) return;
    setBusy(true);
    const res = await fetch(`/api/settings/document-emails/${copy.id}`, { method: "DELETE" });
    if (res.ok) await onChanged();
    else await reportResponseError(res);
    setBusy(false);
  }

  const previewCopy = copy && draft ? draft : null;
  const inUse = copy?.active ? "copy" : "original";

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-foreground">{t(labelKey)}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {inUse === "copy" ? t("app.docEmails.copyInUse") : t("app.docEmails.originalInUse")}
            {meta?.document && (
              <>
                {" · "}
                {meta.document.sample
                  ? t("app.docEmails.previewSample")
                  : t("app.docEmails.previewAgainst", { number: meta.document.number })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {languages.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                aria-pressed={language === l}
                className={`px-2.5 py-1.5 text-xs font-semibold uppercase ${
                  language === l ? "bg-inverted text-inverted-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {l}
                {copies.some((c) => c.kind === kind && c.language === l && c.active) ? " •" : ""}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <Eye size={14} /> {open ? t("app.docEmails.hidePreview") : t("app.docEmails.preview")}
          </button>
          {!copy && canManage && (
            <button
              type="button"
              onClick={customise}
              disabled={busy}
              className="flex items-center gap-1.5 text-sm font-semibold bg-inverted text-inverted-foreground px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              <Pencil size={14} /> {t("app.docEmails.customise")}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            {!copy ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("app.docEmails.originalWording")}
                </p>
                {slots.map((slot) => (
                  <div key={slot}>
                    <div className="text-xs text-muted-foreground">{t(SLOT_LABEL_KEYS[slot])}</div>
                    <div className="text-sm text-foreground bg-muted/60 rounded-lg px-3 py-2 whitespace-pre-wrap">
                      {original[slot]}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{t("app.docEmails.originalReadOnly")}</p>
              </div>
            ) : (
              draft && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("app.docEmails.yourCopy", { language: language.toUpperCase() })}
                    </p>
                    {/* Blocks / Canvas — both bodies are kept; this only
                        chooses which one a send renders. */}
                    <div className="inline-flex rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, sentMode: "blocks" }))}
                        aria-pressed={draft.sentMode === "blocks"}
                        className={`px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 ${
                          draft.sentMode === "blocks" ? "bg-inverted text-inverted-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <LayoutList size={12} /> {t("app.emailModes.blocks")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, sentMode: "canvas" }))}
                        aria-pressed={draft.sentMode === "canvas"}
                        className={`px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 ${
                          draft.sentMode === "canvas" ? "bg-inverted text-inverted-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Brush size={12} /> {t("app.emailModes.canvas")}
                      </button>
                    </div>
                  </div>

                  {draft.sentMode === "canvas" ? (
                    <>
                      <p className="text-xs text-muted-foreground">{t("app.docEmails.canvasLetterNote")}</p>
                      <EmailCanvasEditor
                        value={draft.canvas}
                        onChange={(doc) => setDraft((d) => ({ ...d, canvas: doc }))}
                        mergeFields={tokens.map((token) => ({ token, label: t(TOKEN_LABEL_KEYS[token]) }))}
                      />
                      {/* Subject, closing and signature are still typed. */}
                      {["subject", "closing", "signature"].map((slot) => (
                        <label key={slot} className="block">
                          <span className="text-xs text-muted-foreground">{t(SLOT_LABEL_KEYS[slot])}</span>
                          <input
                            className={inputClass}
                            value={draft.slots[slot] || ""}
                            onChange={(e) => setDraft((d) => ({ ...d, slots: { ...d.slots, [slot]: e.target.value } }))}
                          />
                        </label>
                      ))}
                    </>
                  ) : (
                    slots.map((slot) => (
                      <label key={slot} className="block">
                        <span className="text-xs text-muted-foreground">{t(SLOT_LABEL_KEYS[slot])}</span>
                        {slot === "intro" ? (
                          <textarea
                            rows={3}
                            className={inputClass}
                            value={draft.slots[slot] || ""}
                            onChange={(e) => setDraft((d) => ({ ...d, slots: { ...d.slots, [slot]: e.target.value } }))}
                          />
                        ) : (
                          <input
                            className={inputClass}
                            value={draft.slots[slot] || ""}
                            onChange={(e) => setDraft((d) => ({ ...d, slots: { ...d.slots, [slot]: e.target.value } }))}
                          />
                        )}
                      </label>
                    ))
                  )}

                  <p className="text-xs text-muted-foreground">
                    {t("app.docEmails.tokensHint")}{" "}
                    {tokens.map((token) => (
                      <code key={token} className="bg-muted rounded px-1 mr-1">{`{{${token}}}`}</code>
                    ))}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={busy || !dirty}
                      onClick={() => patch({ slots: draft.slots, sentMode: draft.sentMode, canvas: draft.canvas })}
                      className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      {t("app.action.save")}
                    </button>
                    {savedFlash && <span className="text-xs text-emerald-600 dark:text-emerald-400">{t("app.action.saved")}</span>}
                    {copy.active ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => patch({ active: false })}
                        className="text-sm font-medium text-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted inline-flex items-center gap-1.5"
                      >
                        <Undo2 size={14} /> {t("app.docEmails.backToOriginal")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || dirty}
                        title={dirty ? t("app.docEmails.saveFirst") : ""}
                        onClick={() => patch({ active: true })}
                        className="text-sm font-medium text-foreground border border-border px-3 py-2 rounded-lg hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check size={14} /> {t("app.docEmails.useThis")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patch({ reset: true })}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
                    >
                      <RotateCcw size={12} /> {t("app.docEmails.resetToOriginal")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={remove}
                      className="text-xs text-muted-foreground hover:text-red-500 inline-flex items-center gap-1"
                      aria-label={t("app.docEmails.deleteCopy")}
                    >
                      <Trash2 size={12} /> {t("app.docEmails.deleteCopy")}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {previewCopy ? t("app.docEmails.previewOfCopy") : t("app.docEmails.previewOfOriginal")}
              {meta?.sectionsOmitted ? ` · ${t("app.docEmails.sectionsOmitted")}` : ""}
            </div>
            <Preview kind={kind} language={language} copy={previewCopy} onMeta={setMeta} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentEmails({ canManage = true }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/settings/document-emails");
      if (!res.ok) {
        setError(await reportResponseError(res));
        return;
      }
      setData(await res.json());
      setError("");
    } catch {
      setError(t("app.load.network"));
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div id="document-emails" className="scroll-mt-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        {t("app.docEmails.group")}
      </h2>
      <p className="text-sm text-muted-foreground mb-3">{t("app.docEmails.explainer")}</p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <div className="h-24 bg-accent rounded-xl animate-pulse" />}
      {data && (
        <div className="space-y-4">
          {data.kinds.map(({ kind, labelKey }) => (
            <KindCard
              key={kind}
              kind={kind}
              labelKey={labelKey}
              languages={data.languages}
              originals={data.originals}
              copies={data.copies}
              tokens={data.tokens}
              slots={data.slots}
              onChanged={load}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
