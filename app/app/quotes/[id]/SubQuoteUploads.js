// app/app/quotes/[id]/SubQuoteUploads.js
//
// "Upload a sub's quote (PDF or photo)" — the parts of the compare screen
// (ImportedCostsPanel) that belong to a subcontractor who is NOT on FieldQuo.
// Kept in its own file so the panel only gains a few lines — another change
// ("Request prices from subs") is landing in the same panel.
//
//   SubQuoteUploadArea   the upload button, and one confirm card per upload
//                        not yet confirmed
//   UploadedOptionRow    a confirmed upload, drawn inside the same trade
//                        group as the FieldQuo subs' prices
//
// ══ Nothing read is used until the GC confirms it ══════════════════════════
//
// The read fills the confirm form; it is labelled as read from the document,
// every figure stays editable, and Confirm stays off until the GC ticks that
// they checked the figures against the sub's quote. Only the confirmed values
// are posted, and the server validates them again
// (lib/quotes/subQuoteUpload.js readConfirmation) and derives the client price.
"use client";

import { useEffect, useState } from "react";
import { FileUp, Loader2, Trash2, Pencil, ScanText, AlertTriangle, FileText } from "lucide-react";
import MediaUploader from "@/app/components/MediaUploader";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { formatMoney } from "@/lib/currency";
import { parseMoneyInput } from "@/lib/quotes/moneyInput";

const MARKUP_PRESETS = [0, 10, 20, 30];

const base = (quoteId) => `/api/quotes/${encodeURIComponent(quoteId)}/sub-uploads`;

/* ── The upload button and the confirm cards ─────────────────────────────── */

export function SubQuoteUploadArea({ quoteId, currency, ctx, uploads, onChanged, onTotalChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pending = (uploads || []).filter((u) => !u.confirmed);
  if (!ctx) return null;

  async function read() {
    if (busy || !files.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchJson(base(quoteId), { method: "POST", body: { files } });
      if (data?.readFailed?.message) setNotice(data.readFailed.message);
      setFiles([]);
      setOpen(false);
      await onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {ctx.canEdit && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
          data-sub-upload-open
        >
          <FileUp size={14} />
          {t("app.subUpload.button")}
        </button>
      )}

      {ctx.canEdit && open && (
        <div className="rounded-lg border border-border p-3 space-y-2" data-sub-upload-form>
          <MediaUploader
            uploadUrl="/api/upload"
            purpose="quotes"
            value={files}
            onChange={(next) => setFiles(next.filter((f) => f.kind !== "video"))}
            max={4}
            label={t("app.subUpload.pick")}
            hint={t("app.subUpload.pickHint")}
          />
          <p className="text-xs text-muted-foreground">{t("app.subUpload.youConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={read}
              disabled={busy || files.length === 0}
              className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
              {t("app.subUpload.read", { credits: ctx.readCredits })}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFiles([]);
              }}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border"
            >
              {t("app.action.cancel")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-amber-700 dark:text-amber-400">{notice}</p>}

      {pending.map((u) => (
        <ConfirmUploadCard
          key={u.id}
          quoteId={quoteId}
          currency={currency}
          ctx={ctx}
          upload={u}
          onChanged={onChanged}
          onTotalChange={onTotalChange}
        />
      ))}
    </div>
  );
}

/** A printed string the form can start from: the number when it parses, else blank for the GC to type. */
function startFrom(printed) {
  const n = parseMoneyInput(printed);
  return n === null ? "" : String(n);
}

function ConfirmUploadCard({ quoteId, currency, ctx, upload, onChanged, onTotalChange }) {
  const { t } = useTranslation();
  const r = upload.reading || {};
  const [form, setForm] = useState(() => ({
    subName: r.subName || "",
    trade: r.trade || "",
    total: startFrom(r.printedTotal),
    tax: startFrom(r.printedTax),
    validUntil: r.validUntilIso || "",
  }));
  const [lines, setLines] = useState(() => linesFrom(upload.readLines));
  const [useLines, setUseLines] = useState(false);
  const [sub, setSub] = useState(upload.suggestedSubcontractor?.id || (r.subName ? "new" : ""));
  const [markup, setMarkup] = useState(20);
  const [placement, setPlacement] = useState("option");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  // A deep read arriving replaces the lines on screen; nothing else moves.
  useEffect(() => {
    setLines(linesFrom(upload.readLines));
  }, [upload.readLines]);

  const open = ["draft", "sent"].includes(ctx.quoteStatus);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setChecked(false);
  };
  const cost = parseMoneyInput(form.total);
  const preview = cost === null ? null : Math.round(cost * (1 + Math.max(0, Number(markup) || 0) / 100) * 100) / 100;
  const readSentence = upload.readError ? t(`app.subUpload.why.${whyKey(upload.readError)}`) : null;
  const differentCurrency = r.currencyCode && currency && r.currencyCode !== currency;

  async function deepRead() {
    if (busy) return;
    setBusy("lines");
    setError("");
    try {
      await fetchJson(`${base(quoteId)}/${upload.id}/lines`, { method: "POST" });
      await onChanged?.();
      setUseLines(true);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function confirm() {
    if (busy || !checked) return;
    setBusy("confirm");
    setError("");
    setFieldError("");
    try {
      const data = await fetchJson(`${base(quoteId)}/${upload.id}`, {
        method: "PATCH",
        body: {
          confirm: true,
          subName: form.subName,
          trade: form.trade,
          total: form.total,
          tax: form.tax,
          validUntil: form.validUntil || null,
          lines: useLines ? lines.filter((l) => l.keep).map((l) => ({ description: l.description, amount: l.amount })) : null,
          display: useLines ? "itemized" : "blended",
          markupPercent: Math.max(0, Number(markup) || 0),
          placement,
          ...(sub === "new" ? { createSubcontractor: true } : sub ? { subcontractorId: sub } : {}),
        },
      });
      if (data?.targetTotal != null) onTotalChange?.(data.targetTotal);
      await onChanged?.(data);
    } catch (err) {
      if (err?.data?.field) setFieldError(err.data.field);
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (busy) return;
    setBusy("remove");
    setError("");
    try {
      await fetchJson(`${base(quoteId)}/${upload.id}`, { method: "DELETE" });
      await onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  const fieldCls = (name) =>
    `w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm ${fieldError === name ? "border-red-500" : "border-border"}`;

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 p-3 space-y-3" data-sub-upload-confirm>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("app.subUpload.confirmTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {upload.reading ? t("app.subUpload.readNote") : t("app.subUpload.typeNote")}
          </p>
          <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
            {upload.files.map((f, i) => (
              <li key={i} className="inline-flex items-center gap-1 mr-3">
                <FileText size={12} />
                {f.kind === "photo" && f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="underline">
                    {f.filename || t("app.subUpload.photo", { n: i + 1 })}
                  </a>
                ) : (
                  <span>{f.filename || "PDF"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {ctx.canEdit && (
          <button
            type="button"
            onClick={remove}
            disabled={Boolean(busy)}
            aria-label={t("app.subUpload.remove")}
            className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
          >
            {busy === "remove" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>

      {readSentence && (
        <p className="text-xs text-amber-800 dark:text-amber-300 inline-flex items-start gap-1">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {readSentence}
        </p>
      )}
      {r.unreadable?.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("app.subUpload.unreadable", { list: r.unreadable.join(", ") })}</p>
      )}
      {differentCurrency && (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          {t("app.subUpload.currency", { theirs: r.currencyCode, yours: currency })}
        </p>
      )}

      {ctx.canEdit && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t("app.subUpload.field.subName")} read={r.subName}>
              <input className={fieldCls("subName")} value={form.subName} onChange={(e) => set("subName", e.target.value)} />
            </Field>
            <Field label={t("app.subUpload.field.trade")} read={r.trade}>
              <input className={fieldCls("trade")} value={form.trade} onChange={(e) => set("trade", e.target.value)} />
            </Field>
            <Field label={t("app.subUpload.field.total")} read={r.printedTotal}>
              <input inputMode="decimal" className={fieldCls("total")} value={form.total} onChange={(e) => set("total", e.target.value)} />
            </Field>
            <Field label={t("app.subUpload.field.tax")} read={r.printedTax}>
              <input inputMode="decimal" className={fieldCls("tax")} value={form.tax} onChange={(e) => set("tax", e.target.value)} />
            </Field>
            <Field label={t("app.subUpload.field.validUntil")} read={r.validUntil}>
              <input type="date" className={fieldCls("validUntil")} value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
            </Field>
            <Field label={t("app.subUpload.field.sub")}>
              <select className={fieldCls("sub")} value={sub} onChange={(e) => setSub(e.target.value)}>
                <option value="">{t("app.subUpload.sub.none")}</option>
                {form.subName.trim() && <option value="new">{t("app.subUpload.sub.create", { name: form.subName.trim() })}</option>}
                {(ctx.roster || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id === upload.suggestedSubcontractor?.id ? t("app.subUpload.sub.match", { name: s.name }) : s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* The lines — the paid deep read, offered with its price first. */}
          {lines.length === 0 ? (
            <button
              type="button"
              onClick={deepRead}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-1.5 border border-border text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
              data-sub-upload-deep-read
            >
              {busy === "lines" ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
              {t("app.subUpload.readLines", { credits: ctx.linesCredits })}
            </button>
          ) : (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={useLines}
                  onChange={(e) => {
                    setUseLines(e.target.checked);
                    setChecked(false);
                  }}
                />
                {t("app.subUpload.useLines")}
              </label>
              {useLines && (
                <ul className="space-y-1">
                  {lines.map((l, i) => (
                    <li key={i} className="flex gap-1.5 items-center">
                      <input
                        type="checkbox"
                        checked={l.keep}
                        aria-label={t("app.subUpload.keepLine")}
                        onChange={(e) => {
                          setLines((prev) => prev.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)));
                          setChecked(false);
                        }}
                      />
                      <input
                        className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs"
                        value={l.description}
                        onChange={(e) => {
                          setLines((prev) => prev.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)));
                          setChecked(false);
                        }}
                      />
                      <input
                        inputMode="decimal"
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-right"
                        value={l.amount}
                        onChange={(e) => {
                          setLines((prev) => prev.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)));
                          setChecked(false);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {useLines && <p className="text-[11px] text-muted-foreground">{t("app.subUpload.linesNote")}</p>}
            </div>
          )}

          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1">{t("app.importedCosts.editMarkup")}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {MARKUP_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMarkup(p)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    Number(markup) === p ? "bg-inverted text-inverted-foreground border-transparent" : "border-border text-foreground"
                  }`}
                >
                  {p}%
                </button>
              ))}
              <input
                type="number"
                min="0"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
              {preview !== null && (
                <span className="text-xs text-muted-foreground ml-2">
                  {formatMoney(cost, currency)} → <span className="font-semibold text-foreground">{formatMoney(preview, currency)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-foreground">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name={`placement-${upload.id}`} checked={placement === "option"} onChange={() => setPlacement("option")} />
              {t("app.subUpload.placeOption")}
            </label>
            {open && (
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name={`placement-${upload.id}`} checked={placement === "line"} onChange={() => setPlacement("line")} />
                {t("app.subUpload.placeLine")}
              </label>
            )}
          </div>

          <label className="flex items-start gap-2 text-xs text-foreground">
            <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} data-sub-upload-checked />
            <span>{t("app.subUpload.checked")}</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={confirm}
            disabled={!checked || Boolean(busy)}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
            data-sub-upload-confirm-button
          >
            {busy === "confirm" && <Loader2 size={12} className="animate-spin" />}
            {t("app.subUpload.confirm")}
          </button>
        </>
      )}
    </div>
  );
}

/** The sentence for why a read did not happen — lib/quotes/subQuoteUploadServer.js reasons, in six. */
export function whyKey(code) {
  switch (code) {
    case "too_large":
    case "too_many_pages":
      return "tooBig";
    case "fetch_failed":
      return "fetch";
    case "no_credit":
    case "quota":
      return "noCredit";
    case "demo":
      return "demo";
    case "missing":
    case "notHttp":
    case "video":
    case "unknownKind":
    case "mixed":
    case "tooMany":
    case "not_ours":
    case "not_pdf":
      return "badFile";
    default:
      return "failed";
  }
}

function linesFrom(readLines) {
  return (Array.isArray(readLines) ? readLines : []).map((l) => {
    const n = parseMoneyInput(l?.amount);
    return { description: String(l?.description || ""), amount: n === null ? "" : String(n), keep: true };
  });
}

/** A field, with what the document said beside it so the GC can compare. */
function Field({ label, read = null, children }) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-muted-foreground mb-0.5">{label}</span>
      {children}
      {read ? (
        <span className="block text-[11px] text-muted-foreground mt-0.5">{t("app.subUpload.printed", { value: read })}</span>
      ) : null}
    </label>
  );
}

/* ── A confirmed upload in the compare ───────────────────────────────────── */

export function UploadedOptionRow({ r, group, quoteId, currency, ctx, canEditQuote, canChoose, Credentials, onChanged, onTotalChange }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [mk, setMk] = useState(Math.round(Number(r.markupPercent) || 0));
  const money = (n) => formatMoney(n, currency);
  const open = ["draft", "sent"].includes(ctx?.status);
  const editable = canEditQuote && !r.costHidden && (r.placement === "option" || open);
  const lineInGroup = group.rows.some((x) => x.placement === "line");

  async function call(kind, url, init) {
    if (busy) return;
    setBusy(kind);
    setError("");
    try {
      const data = await fetchJson(url, init);
      if (data?.targetTotal != null) onTotalChange?.(data.targetTotal);
      setEditing(false);
      await onChanged?.(data);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  const previewPrice = Math.round(Number(r.costAmount) * (1 + Math.max(0, Number(mk) || 0) / 100) * 100) / 100;

  return (
    <li className={`rounded-lg border px-3 py-2.5 ${r.placement === "option" ? "border-dashed border-border" : "border-border"}`} data-sub-upload-row>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{r.sourceCompanyName || r.label || "—"}</p>
          <p className="text-[11px] text-muted-foreground">{t("app.subUpload.badge")}</p>
          <p className="text-xs text-muted-foreground">
            {!r.costHidden && (
              <>
                {money(r.costAmount)} + {Math.round(r.markupPercent)}% ={" "}
              </>
            )}
            <span className="font-medium text-foreground">{money(r.clientPrice)}</span>
          </p>
          {r.validUntil && (
            <p className="text-[11px] text-muted-foreground">{t("app.subUpload.validUntil", { date: formatDate(r.validUntil) })}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editable && !editing && (
            <button type="button" onClick={() => setEditing(true)} aria-label={t("app.importedCosts.editMarkup")} className="p-1.5 text-muted-foreground hover:text-foreground">
              <Pencil size={14} />
            </button>
          )}
          {editable && !editing && (
            <button
              type="button"
              onClick={() => call("remove", `${base(quoteId)}/${r.id}`, { method: "DELETE" })}
              disabled={Boolean(busy)}
              aria-label={t("app.importedCosts.remove")}
              className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
            >
              {busy === "remove" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs mt-1.5">
        {r.placement === "line" ? (
          <span className="font-medium text-foreground">{t("app.importedCosts.onQuote")}</span>
        ) : (
          <span className="text-muted-foreground">{t("app.importedCosts.option")}</span>
        )}
      </p>
      {Credentials ? <Credentials r={r} t={t} formatDate={formatDate} /> : null}

      {canChoose && r.placement === "option" && open && !editing && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => call("use", `${base(quoteId)}/${r.id}/select`, { method: "POST" })}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
          >
            {busy === "use" && <Loader2 size={12} className="animate-spin" />}
            {lineInGroup ? t("app.importedCosts.useInstead") : t("app.importedCosts.useThis")}
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex flex-wrap items-center gap-1.5">
            {MARKUP_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMk(p)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  Number(mk) === p ? "bg-inverted text-inverted-foreground border-transparent" : "border-border text-foreground"
                }`}
              >
                {p}%
              </button>
            ))}
            <input type="number" min="0" value={mk} onChange={(e) => setMk(e.target.value)} className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs" />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-xs text-muted-foreground">
              {money(r.costAmount)} → <span className="font-semibold text-foreground">{money(previewPrice)}</span>
            </span>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-foreground">
                {t("app.action.cancel")}
              </button>
              <button
                type="button"
                onClick={() =>
                  call("markup", `${base(quoteId)}/${r.id}`, { method: "PATCH", body: { markupPercent: Math.max(0, Number(mk) || 0) } })
                }
                disabled={Boolean(busy)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {busy === "markup" && <Loader2 size={12} className="animate-spin" />}
                {t("app.action.save")}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </li>
  );
}
