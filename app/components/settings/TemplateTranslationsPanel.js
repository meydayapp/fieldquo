"use client";

// app/components/settings/TemplateTranslationsPanel.js
//
// The "Translations" card in the email template editor: one row per language
// the company's clients might read, with what it costs, who pays, and Review /
// Edit, Update and Regenerate (lib/email/templateTranslation.js says what a
// translation is and when one is used).
//
// The rule is printed, not implied: a client whose language has no approved,
// up-to-date translation gets the email as written, and nothing is ever
// translated at send time. A draft is made only when somebody presses a
// button here, and is not used until somebody approves it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Languages, RefreshCw, PencilLine, Check } from "lucide-react";
import AlertDialog from "@/app/components/AlertDialog";
import { useTranslation } from "@/app/hooks/useTranslation";
import { LANGUAGES } from "@/app/i18n/languages";
import { reportResponseError } from "@/lib/clientErrors";
import { overlayStrings, checkHumanEdit } from "@/lib/email/templateTranslation";
import { renderTemplateSections } from "@/lib/email/renderTemplateSections";
import { compileCanvasEmail } from "@/lib/email/canvasEmail";
import { sentModeOf } from "@/lib/email/templateBody";

const native = (code) => LANGUAGES.find((l) => l.code === code)?.nativeName || code;

/** Vendor cost in micros → "$0.0012" (four places under a cent, two above). */
export function formatMicros(micros) {
  const dollars = (Number(micros) || 0) / 1_000_000;
  return dollars >= 0.01 ? `$${dollars.toFixed(2)}` : `$${dollars.toFixed(4)}`;
}

const ERROR_KEYS = {
  needs_credit_large: "app.emailTranslations.error.needsCreditLarge",
  needs_credit_monthly: "app.emailTranslations.error.needsCreditMonthly",
  platform_paused: "app.emailTranslations.error.platformPaused",
  ai_unavailable: "app.emailTranslations.aiUnavailable",
  model_failed: "app.emailTranslations.error.modelFailed",
  too_long: "app.emailTranslations.error.tooLong",
  nothing_to_translate: "app.emailTranslations.nothingToTranslate",
  forbidden: "app.emailTranslations.error.forbidden",
};

function StatusBadge({ row, t }) {
  if (!row.exists) return <span className="text-xs text-muted-foreground">{t("app.emailTranslations.status.none")}</span>;
  if (row.used) {
    return (
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t("app.emailTranslations.status.approved")}</span>
    );
  }
  if (row.unusableReason === "stale") {
    return <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{t("app.emailTranslations.status.stale")}</span>;
  }
  if (row.problems > 0 || row.unusableReason === "incomplete" || row.unusableReason === "token_mismatch") {
    return (
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
        {t("app.emailTranslations.status.unfinished")}
      </span>
    );
  }
  return <span className="text-xs font-medium text-foreground">{t("app.emailTranslations.status.draft")}</span>;
}

/**
 * @param templateId    the saved template's id
 * @param template      the template AS SAVED (the panel translates the saved email)
 * @param dirty         true while the editor holds unsaved changes
 * @param company       branding for the review preview
 * @param mergeData     the editor's sample merge data
 * @param refreshKey    bumped by the editor after each save
 */
export default function TemplateTranslationsPanel({ templateId, template, dirty, company, mergeData, refreshKey }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null); // language being drafted
  const [message, setMessage] = useState(null); // { ok, text }
  const [reviewing, setReviewing] = useState(null); // language

  const load = useCallback(async () => {
    const res = await fetch(`/api/settings/document-templates/${templateId}/translations`);
    if (!res.ok) {
      await reportResponseError(res);
      return;
    }
    setData(await res.json());
  }, [templateId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load, refreshKey]);

  async function draft(language, { full = false, manual = false } = {}) {
    if (full && !window.confirm(t("app.emailTranslations.regenerateConfirm"))) return;
    setBusy(language);
    setMessage(null);
    try {
      const res = await fetch(`/api/settings/document-templates/${templateId}/translations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, full, manual }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const key = ERROR_KEYS[body.code];
        setMessage({ ok: false, text: key ? t(key, { chars: data?.chars ?? 0, max: data?.maxChars ?? 0 }) : body.error || t("app.emailTranslations.error.generic") });
      } else if (manual) {
        setReviewing(language);
      } else {
        setMessage({
          ok: true,
          text:
            body.problems?.length > 0
              ? t("app.emailTranslations.draftedWithProblems", { count: body.problems.length })
              : t("app.emailTranslations.drafted", { cost: formatMicros(body.costMicros) }),
        });
      }
    } finally {
      setBusy(null);
      await load().catch(() => {});
    }
  }

  if (!data) return null;
  // Only templates something sends get translations worth paying for — and
  // nothing at all until the translations table exists (`ready`), rather
  // than buttons that would all fail.
  if (!data.sent || !data.ready) return null;

  const fieldquoPays = data.payer === "fieldquo";
  const readers = data.readers || {};
  const sample = data.languages?.[0];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3" data-template-translations>
      <div className="flex items-center gap-2">
        <Languages size={14} className="text-muted-foreground" />
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {t("app.emailTranslations.title")}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("app.emailTranslations.rule")}</p>
      <p className="text-xs text-muted-foreground">{t("app.emailTranslations.documentRule")}</p>

      {data.strings > 0 && sample && (
        <p className="text-xs text-muted-foreground">
          {fieldquoPays
            ? t("app.emailTranslations.costFieldquo", { cost: formatMicros(sample.estimateMicros) })
            : t("app.emailTranslations.costRule", {
                cost: formatMicros(sample.estimateMicros),
                cap: formatMicros(data.monthlyAbsorbCapMicros),
                used: formatMicros(data.absorbedThisMonthMicros),
                limit: formatMicros(data.perVersionAbsorbMaxMicros),
              })}
        </p>
      )}

      {dirty && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{t("app.emailTranslations.saveFirst")}</p>
      )}
      {!data.aiAvailable && (
        <p className="text-xs text-muted-foreground">{t("app.emailTranslations.aiUnavailable")}</p>
      )}
      {data.strings === 0 && (
        <p className="text-xs text-muted-foreground">{t("app.emailTranslations.nothingToTranslate")}</p>
      )}
      {data.chars > data.maxChars && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t("app.emailTranslations.error.tooLong", { chars: data.chars, max: data.maxChars })}
        </p>
      )}

      {data.strings > 0 && (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {data.languages.map((row) => {
            const count = readers[row.language] || 0;
            const would = row.wouldBill || {};
            const canDraft = data.aiAvailable && !dirty && data.chars <= data.maxChars;
            return (
              <li key={row.language} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{native(row.language)}</span>
                    {count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t("app.emailTranslations.readers", { count })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <StatusBadge row={row} t={t} />
                    <span className="text-xs text-muted-foreground">
                      {row.exists && row.drafts > 0
                        ? t("app.emailTranslations.lastDraft", {
                            cost: formatMicros(row.costMicros),
                            payer:
                              row.billing === "wallet"
                                ? t("app.emailTranslations.paidWallet", { cents: row.chargedCents })
                                : t("app.emailTranslations.paidFieldquo"),
                          })
                        : !row.exists
                          ? t("app.emailTranslations.estimate", {
                              cost: formatMicros(row.estimateMicros),
                              payer: !would.allowed
                                ? t("app.emailTranslations.wouldNeedCredit")
                                : would.billing === "wallet"
                                  ? t("app.emailTranslations.paidWallet", { cents: would.needCents })
                                  : t("app.emailTranslations.paidFieldquo"),
                            })
                          : null}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {!row.exists && (
                    <>
                      <button
                        type="button"
                        disabled={!canDraft || busy !== null}
                        onClick={() => draft(row.language)}
                        className="text-xs font-semibold bg-inverted text-inverted-foreground px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        {busy === row.language ? t("app.emailTranslations.translating") : t("app.emailTranslations.translate")}
                      </button>
                      <button
                        type="button"
                        disabled={dirty || busy !== null}
                        onClick={() => draft(row.language, { manual: true })}
                        className="text-xs text-muted-foreground hover:text-foreground underline px-1 disabled:opacity-50"
                      >
                        {t("app.emailTranslations.writeYourself")}
                      </button>
                    </>
                  )}
                  {row.exists && (
                    <>
                      <button
                        type="button"
                        disabled={dirty}
                        onClick={() => setReviewing(row.language)}
                        className="text-xs font-semibold border border-border px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <PencilLine size={12} /> {t("app.emailTranslations.review")}
                      </button>
                      {(row.unusableReason === "stale" || row.unusableReason === "incomplete") && (
                        <button
                          type="button"
                          disabled={!canDraft || busy !== null}
                          onClick={() => draft(row.language)}
                          className="text-xs font-semibold border border-border px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {busy === row.language ? t("app.emailTranslations.translating") : t("app.emailTranslations.update")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!canDraft || busy !== null}
                        onClick={() => draft(row.language, { full: true })}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1 disabled:opacity-50"
                      >
                        <RefreshCw size={12} /> {t("app.emailTranslations.regenerate")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {message && (
        <p className={`text-xs ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} role="status">
          {message.text}
        </p>
      )}

      {reviewing && (
        <TranslationReview
          templateId={templateId}
          language={reviewing}
          template={template}
          company={company}
          mergeData={mergeData}
          onClose={async () => {
            setReviewing(null);
            await load().catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function TranslationReview({ templateId, language, template, company, mergeData, onClose }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [texts, setTexts] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const headingRef = useRef(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/settings/document-templates/${templateId}/translations/${language}`);
    if (!res.ok) {
      await reportResponseError(res);
      return;
    }
    const body = await res.json();
    setDetail(body);
    setTexts(Object.fromEntries(body.strings.map((s) => [s.path, s.text])));
  }, [templateId, language]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // The preview: the edits on screen laid over the saved email, as an
  // approved translation would be — lines still empty show the original.
  const previewHtml = useMemo(() => {
    if (!detail || !template) return "";
    const words = {};
    for (const s of detail.strings) words[s.path] = texts[s.path]?.trim() ? texts[s.path] : s.source;
    // overlayStrings, not localizeTemplate: the preview shows lines nobody has
    // approved yet, which is exactly what the send path refuses to do.
    const copy = overlayStrings(template, words);
    const opts = { preview: true, company: company || {}, theme: copy?.theme || null, language };
    return sentModeOf(copy) === "canvas"
      ? compileCanvasEmail(copy.canvas, mergeData, opts).html
      : renderTemplateSections(Array.isArray(copy.sections) ? copy.sections : [], mergeData, opts);
  }, [detail, texts, template, language, company, mergeData]);

  async function save(approve) {
    if (!detail) return;
    // The token rule, checked here first so the person sees which line before
    // the server refuses the same thing.
    const local = {};
    const edits = {};
    for (const s of detail.strings) {
      const value = texts[s.path] ?? "";
      if (value !== s.text) edits[s.path] = value;
      if (value.trim()) {
        const problem = checkHumanEdit(s.source, value);
        if (problem) local[s.path] = problem;
      }
    }
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch(`/api/settings/document-templates/${templateId}/translations/${language}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strings: edits, ...(approve !== undefined ? { approve } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.code === "token_mismatch") {
          setErrors(Object.fromEntries((body.errors || []).map((e) => [e.path, e])));
        } else if (body.code === "cannot_approve") {
          setNote({ ok: false, text: t("app.emailTranslations.cannotApprove") });
        } else {
          setNote({ ok: false, text: body.error || t("app.emailTranslations.error.generic") });
        }
        return;
      }
      setNote({
        ok: true,
        text:
          approve === true
            ? t("app.emailTranslations.approvedNote", { language: native(language) })
            : approve === false
              ? t("app.emailTranslations.stoppedNote")
              : t("app.action.saved"),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  const titleId = `translation-review-${language}`;
  return (
    <AlertDialog
      open
      labelledBy={titleId}
      onEscape={onClose}
      widthClass="sm:max-w-5xl"
      shapeClass="rounded-2xl p-4 sm:p-5 space-y-4"
      cardClass="max-h-[90vh] overflow-y-auto"
      initialFocusRef={headingRef}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-base font-semibold text-foreground">
          {t("app.emailTranslations.reviewTitle", { language: native(language) })}
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
          {t("app.action.close")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t("app.emailTranslations.reviewIntro")}</p>

      {!detail ? (
        <div className="h-40 bg-accent rounded-xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            {detail.strings.map((s) => {
              const err = errors[s.path];
              return (
                <div key={s.path} className="border border-border rounded-lg p-3 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.emailTranslations.original")}
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap break-words">{s.source}</p>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
                    {t("app.emailTranslations.translation")}
                    <textarea
                      rows={Math.min(8, Math.max(2, Math.ceil(s.source.length / 60)))}
                      value={texts[s.path] ?? ""}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [s.path]: e.target.value }))}
                      className="mt-1 w-full border border-border rounded-lg px-2.5 py-2 text-sm font-normal normal-case tracking-normal text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring/10"
                    />
                  </label>
                  {s.tokens.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("app.emailTranslations.tokenHint", { tokens: [...new Set(s.tokens)].map((x) => `{{${x}}}`).join(" ") })}
                    </p>
                  )}
                  {s.stale && <p className="text-[11px] text-amber-700 dark:text-amber-300">{t("app.emailTranslations.staleString")}</p>}
                  {s.problem && <p className="text-[11px] text-amber-700 dark:text-amber-300">{t("app.emailTranslations.refusedString")}</p>}
                  {err && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      {t("app.emailTranslations.tokenError", {
                        missing: (err.missing || []).map((x) => `{{${x}}}`).join(" ") || "—",
                        extra: (err.extra || []).map((x) => `{{${x}}}`).join(" ") || "—",
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t("app.emailTranslations.previewTitle", { language: native(language) })}
            </div>
            <iframe
              title={t("app.emailTranslations.previewTitle", { language: native(language) })}
              srcDoc={previewHtml}
              sandbox=""
              className="w-full bg-card rounded-lg border border-border"
              style={{ height: 560 }}
            />
          </div>
        </div>
      )}

      {note && (
        <p className={`text-xs ${note.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} role="status">
          {note.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {detail?.status === "approved" && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="text-sm text-muted-foreground hover:text-foreground underline px-2 disabled:opacity-50"
          >
            {t("app.emailTranslations.stopUsing")}
          </button>
        )}
        <button
          type="button"
          disabled={saving || !detail}
          onClick={() => save(undefined)}
          className="text-sm font-semibold border border-border px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? t("app.action.saving") : t("app.action.save")}
        </button>
        <button
          type="button"
          disabled={saving || !detail}
          onClick={() => save(true)}
          className="text-sm font-semibold bg-inverted text-inverted-foreground px-4 py-2 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check size={14} /> {t("app.emailTranslations.approve")}
        </button>
      </div>
    </AlertDialog>
  );
}
