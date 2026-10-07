// app/app/quotes/[id]/SubQuoteUploads.js
//
// "Upload a sub's quote (PDF or photo)" — the compare panel's way in for a
// subcontractor who is NOT on FieldQuo (ImportedCostsPanel mounts it; kept in
// its own file so the panel only gains a few lines).
//
//   1. Pick the PDF or photos (direct upload, purpose "quotes").
//   2. "Read it — about N AI credits" (POST …/sub-uploads/read). The answer
//      comes back to this screen and nothing is stored. Or "Type the figures"
//      and nothing is read or charged.
//   3. The confirm card: every read figure in an editable field with what the
//      document printed beside it; the paid deep read of every line, with its
//      price on the button; the sub on the GC's roster (matched or added).
//      Confirm stays off until the GC ticks that they checked every figure.
//   4. Confirm (POST …/sub-uploads) creates the price — a source-less import
//      tagged "Read from an uploaded quote" — in the compare above, or on the
//      quote as a line. The server validates the figures again and derives
//      the client price; the browser posts no price.
//
// The read lives only on this screen until Confirm: leaving before then
// loses it (an upload is read again, and charged again, next time) — the
// price of storing no AI figure anywhere unconfirmed.
"use client";

import { useState } from "react";
import { FileUp, Loader2, ScanText, AlertTriangle, FileText, Keyboard } from "lucide-react";
import MediaUploader from "@/app/components/MediaUploader";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { formatMoney } from "@/lib/currency";
import { parseMoneyInput } from "@/lib/quotes/moneyInput";
import { matchSubcontractor } from "@/lib/quotes/subMatch";

const MARKUP_PRESETS = [0, 10, 20, 30];

const base = (quoteId) => `/api/quotes/${encodeURIComponent(quoteId)}/sub-uploads`;

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

export function SubQuoteUploadArea({ quoteId, currency, ctx, onChanged, onTotalChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  // null until read (or skipped); then { reading, readBy, why }.
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!ctx?.canEdit) return null;

  function reset() {
    setOpen(false);
    setFiles([]);
    setDraft(null);
    setError("");
  }

  async function read() {
    if (busy || !files.length) return;
    setBusy(true);
    setError("");
    try {
      const data = await fetchJson(`${base(quoteId)}/read`, { method: "POST", body: { files } });
      setDraft({ reading: data.reading || null, readBy: data.reading ? "ai" : "typed", why: data.readFailed?.code || null });
    } catch (err) {
      // A refused FILE (400) is said plainly and nothing was charged; the GC
      // picks another file. Anything else: say it, and offer typing.
      if (err?.data?.code) setDraft(null);
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  if (draft) {
    return (
      <ConfirmUploadCard
        quoteId={quoteId}
        currency={currency}
        ctx={ctx}
        files={files}
        draft={draft}
        onCancel={reset}
        onDone={async (data) => {
          if (data?.targetTotal != null) onTotalChange?.(data.targetTotal);
          reset();
          await onChanged?.(data);
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
          data-sub-upload-open
        >
          <FileUp size={14} />
          {t("app.subUpload.button")}
        </button>
      ) : (
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
              onClick={() => setDraft({ reading: null, readBy: "typed", why: null })}
              disabled={busy || files.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border disabled:opacity-60"
            >
              <Keyboard size={12} />
              {t("app.subUpload.typeInstead")}
            </button>
            <button type="button" onClick={reset} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border">
              {t("app.action.cancel")}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

/** A printed string the form can start from: the number when it parses, else blank for the GC to type. */
function startFrom(printed) {
  const n = parseMoneyInput(printed);
  return n === null ? "" : String(n);
}

function linesFrom(readLines) {
  return (Array.isArray(readLines) ? readLines : []).map((l) => {
    const n = parseMoneyInput(l?.amount);
    return { description: String(l?.description || ""), amount: n === null ? "" : String(n), keep: true };
  });
}

function ConfirmUploadCard({ quoteId, currency, ctx, files, draft, onCancel, onDone }) {
  const { t } = useTranslation();
  const r = draft.reading || {};
  const [form, setForm] = useState(() => ({
    subName: r.subName || "",
    trade: r.trade || "",
    total: startFrom(r.printedTotal),
    tax: startFrom(r.printedTax),
    validUntil: r.validUntilIso || "",
  }));
  const [lines, setLines] = useState([]);
  const [useLines, setUseLines] = useState(false);
  // The roster row: the one whose name matches what the document printed, or
  // "add them" — never "nobody": the compare names the sub from this row.
  const [sub, setSub] = useState(() => matchId(ctx.roster, r.subName) || "new");
  const [markup, setMarkup] = useState(20);
  const [placement, setPlacement] = useState("option");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  const open = ["draft", "sent"].includes(ctx.quoteStatus);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setChecked(false);
  };
  const cost = parseMoneyInput(form.total);
  const preview = cost === null ? null : Math.round(cost * (1 + Math.max(0, Number(markup) || 0) / 100) * 100) / 100;
  const differentCurrency = r.currencyCode && currency && r.currencyCode !== currency;

  async function deepRead() {
    if (busy) return;
    setBusy("lines");
    setError("");
    try {
      const data = await fetchJson(`${base(quoteId)}/lines`, { method: "POST", body: { files } });
      setLines(linesFrom(data.lines));
      setUseLines(true);
      setChecked(false);
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
      const data = await fetchJson(base(quoteId), {
        method: "POST",
        body: {
          files,
          readBy: draft.readBy,
          subName: form.subName,
          trade: form.trade,
          total: form.total,
          tax: form.tax,
          validUntil: form.validUntil || null,
          lines: useLines ? lines.filter((l) => l.keep).map((l) => ({ description: l.description, amount: l.amount })) : null,
          display: useLines ? "itemized" : "blended",
          markupPercent: Math.max(0, Number(markup) || 0),
          placement,
          ...(sub === "new" ? { createSubcontractor: true } : { subcontractorId: sub }),
        },
      });
      await onDone?.(data);
    } catch (err) {
      if (err?.data?.field) setFieldError(err.data.field);
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  const fieldCls = (name) =>
    `w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm ${fieldError === name ? "border-red-500" : "border-border"}`;
  const lineEdit = (i, patch) => {
    setLines((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setChecked(false);
  };

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-800 p-3 space-y-3" data-sub-upload-confirm>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{t("app.subUpload.confirmTitle")}</p>
        <p className="text-xs text-muted-foreground">{draft.reading ? t("app.subUpload.readNote") : t("app.subUpload.typeNote")}</p>
        <ul className="mt-1 text-xs text-muted-foreground">
          {files.map((f, i) => (
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

      {draft.why && (
        <p className="text-xs text-amber-800 dark:text-amber-300 inline-flex items-start gap-1">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {t(`app.subUpload.why.${whyKey(draft.why)}`)}
        </p>
      )}
      {r.unreadable?.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("app.subUpload.unreadable", { list: r.unreadable.join(", ") })}</p>
      )}
      {differentCurrency && (
        <p className="text-xs text-amber-800 dark:text-amber-300">{t("app.subUpload.currency", { theirs: r.currencyCode, yours: currency })}</p>
      )}

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
            <option value="new">{t("app.subUpload.sub.create", { name: form.subName.trim() || "—" })}</option>
            {(ctx.roster || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === matchId(ctx.roster, r.subName) ? t("app.subUpload.sub.match", { name: s.name }) : s.name}
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
                  <input type="checkbox" checked={l.keep} aria-label={t("app.subUpload.keepLine")} onChange={(e) => lineEdit(i, { keep: e.target.checked })} />
                  <input
                    className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs"
                    value={l.description}
                    onChange={(e) => lineEdit(i, { description: e.target.value })}
                  />
                  <input
                    inputMode="decimal"
                    className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-right"
                    value={l.amount}
                    onChange={(e) => lineEdit(i, { amount: e.target.value })}
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
          <input type="radio" name="sub-upload-placement" checked={placement === "option"} onChange={() => setPlacement("option")} />
          {t("app.subUpload.placeOption")}
        </label>
        {open && (
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="sub-upload-placement" checked={placement === "line"} onChange={() => setPlacement("line")} />
            {t("app.subUpload.placeLine")}
          </label>
        )}
      </div>

      <label className="flex items-start gap-2 text-xs text-foreground">
        <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => setChecked(e.target.checked)} data-sub-upload-checked />
        <span>{t("app.subUpload.checked")}</span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
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
        <button type="button" onClick={onCancel} disabled={Boolean(busy)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border">
          {t("app.action.cancel")}
        </button>
      </div>
    </div>
  );
}

/** The roster row whose name is the printed sub's — the server's own rule (lib/quotes/subMatch.js). */
function matchId(roster, name) {
  return matchSubcontractor(name, roster)?.id || null;
}

/** A field, with what the document said beside it so the GC can compare. */
function Field({ label, read = null, children }) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-muted-foreground mb-0.5">{label}</span>
      {children}
      {read ? <span className="block text-[11px] text-muted-foreground mt-0.5">{t("app.subUpload.printed", { value: read })}</span> : null}
    </label>
  );
}
