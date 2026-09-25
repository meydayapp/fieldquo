// app/components/receipts/ReceiptReview.js
//
// One receipt: the paper beside what was read off it, the checks, the likely
// duplicate, where it probably belongs and why — and the one control that
// books it.
//
// ══ Nothing is linked without a tap ════════════════════════════════════════
//
// The suggestion PRE-SELECTS the picker when it is confident ("high"), and
// only then; a medium or low suggestion is shown with its reasons and leaves
// the choice empty. Either way nothing is booked until Confirm, and the
// server re-checks where this person may put it (app/api/receipts/[id]/confirm).
//
// ══ Printed figures are shown as printed ═══════════════════════════════════
//
// Line amounts are the characters off the paper; the one computed figure —
// what the lines add up to — is labelled as such. Same discipline as
// app/components/purchasing/ReceiptScanner.js, for the same reason: a
// transcription reformatted stops being evidence.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, AlertTriangle, FileText, ExternalLink, Loader2, Sparkles, Copy, RotateCcw } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney, useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchJson } from "@/lib/fetchJson";
import { toCents } from "@/lib/receipts/money";
import {
  categoryLabel,
  kindLabel,
  statusLabel,
  reasonText,
  flagText,
  confidenceLabel,
  refusalText,
  CATEGORY_OPTIONS,
} from "./labels";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-base sm:text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring/10";

const centsText = (c) => (Number.isInteger(c) ? (c / 100).toFixed(2) : "");

/** The picker's starting point — the suggestion only when it is confident. */
function initialParts(d) {
  const s = d?.suggestions;
  const top = s?.jobs?.[0];
  const linkable = new Set((d?.jobs || []).map((j) => j.id));
  if (s?.best === "job" && top?.confidence === "high" && linkable.has(top.jobId)) {
    return [{ kind: "job", jobId: top.jobId, category: "Materials", amount: "" }];
  }
  if (s?.best === "overhead" && s.overhead?.confidence === "high" && d?.access?.canChooseOverhead) {
    return [{ kind: "overhead", jobId: "", category: s.overhead.category || "Other", amount: "" }];
  }
  return [{ kind: "job", jobId: "", category: "Materials", amount: "" }];
}

export default function ReceiptReview({ id, onClose, onChanged, onOpen }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const { formatDate, formatDateTime } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [mode, setMode] = useState("one");
  const [parts, setParts] = useState([]);
  const [lineAssign, setLineAssign] = useState({});
  const [totalText, setTotalText] = useState("");
  const [taxText, setTaxText] = useState("");
  const [vendor, setVendor] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [askDuplicate, setAskDuplicate] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await fetchJson(`/api/receipts/${id}`);
      setData(d);
      setParts(initialParts(d));
      setMode("one");
      setLineAssign({});
      setTotalText(centsText(d.validation?.totalCents));
      setTaxText(centsText(d.validation?.taxCents));
      setVendor(d.receipt.vendorName || "");
    } catch (err) {
      setError(refusalText(t, err));
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const r = data?.receipt;
  const v = data?.validation;
  const access = data?.access || {};
  const settled = r && (r.status === "confirmed" || r.status === "void");
  const jobs = data?.jobs || [];
  const jobTitle = useMemo(() => Object.fromEntries((data?.jobs || []).map((j) => [j.id, j.title])), [data]);

  async function act(label, fn) {
    setBusy(label);
    setError("");
    try {
      await fn();
      onChanged?.();
      await load();
    } catch (err) {
      setError(refusalText(t, err));
    } finally {
      setBusy("");
    }
  }

  function applySplit() {
    const groups = data?.suggestions?.split?.groups || [];
    if (!groups.length) return;
    setMode("lines");
    setParts(groups.map((g) => ({ kind: g.kind, jobId: g.jobId || "", category: g.category || "Other", amount: "" })));
    const assign = {};
    groups.forEach((g, pi) => g.lineIndexes.forEach((li) => (assign[li] = pi)));
    setLineAssign(assign);
  }

  function body(acknowledgeDuplicate = false) {
    const printedTotal = v?.totalCents ?? null;
    const printedTax = v?.taxCents ?? null;
    const typedTotal = toCents(totalText);
    const typedTax = taxText.trim() === "" ? null : toCents(taxText);
    const shaped = parts.map((p, i) => {
      const base = { kind: p.kind, jobId: p.kind === "job" ? p.jobId : null, category: p.category };
      if (mode === "lines") {
        return { ...base, lineIndexes: Object.entries(lineAssign).filter(([, pi]) => pi === i).map(([li]) => Number(li)) };
      }
      if (mode === "amount") return { ...base, amountCents: toCents(p.amount) };
      return base;
    });
    return {
      parts: shaped,
      ...(typedTotal !== null && typedTotal !== printedTotal ? { totalCents: typedTotal } : {}),
      ...(typedTax !== printedTax && typedTax !== null ? { taxCents: typedTax } : {}),
      ...(vendor.trim() && vendor.trim() !== (r?.vendorName || "") ? { vendorName: vendor.trim() } : {}),
      ...(acknowledgeDuplicate ? { acknowledgeDuplicate: true } : {}),
    };
  }

  async function confirm(acknowledgeDuplicate = false) {
    setBusy("confirm");
    setError("");
    try {
      await fetchJson(`/api/receipts/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body(acknowledgeDuplicate)),
      });
      setAskDuplicate(false);
      onChanged?.();
      await load();
    } catch (err) {
      if (err?.data?.duplicate) setAskDuplicate(true);
      else setError(refusalText(t, err));
    } finally {
      setBusy("");
    }
  }

  const setPart = (i, patch) => setParts((prev) => prev.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  const amountSum = parts.reduce((s, p) => s + (toCents(p.amount) || 0), 0);
  const totalCents = toCents(totalText);

  // A render helper, not a component: defined inside the render, a component
  // would be a NEW type every render and React would remount its selects.
  function targetPicker(part, index) {
    return (
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className={inputClass}
          aria-label={t("app.receipts.review.where")}
          value={part.kind === "job" ? `job:${part.jobId}` : part.kind}
          onChange={(e) => {
            const val = e.target.value;
            if (val.startsWith("job:")) setPart(index, { kind: "job", jobId: val.slice(4), category: part.kind === "job" ? part.category : "Materials" });
            else setPart(index, { kind: val, jobId: "", category: val === "overhead" ? part.category || "Other" : part.category });
          }}
        >
          <option value="job:">{t("app.receipts.review.chooseJob")}</option>
          {jobs.map((j) => (
            <option key={j.id} value={`job:${j.id}`}>
              {j.title}
              {j.clientName ? ` — ${j.clientName}` : ""}
            </option>
          ))}
          {access.canChooseOverhead && <option value="overhead">{t("app.receipts.review.overhead")}</option>}
          {access.canChooseOverhead && <option value="general">{t("app.receipts.review.general")}</option>}
        </select>
        <select
          className={inputClass}
          aria-label={t("app.receipts.review.category")}
          value={part.category || "Other"}
          onChange={(e) => setPart(index, { category: e.target.value })}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(t, c)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("app.receipts.review.title")}
        className="bg-card w-full sm:max-w-4xl sm:rounded-2xl max-h-full sm:max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-2 z-10">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              {r?.vendorName || t("app.receipts.review.title")}
            </h2>
            {r && (
              <p className="text-xs text-muted-foreground">
                {statusLabel(t, r.status)}
                {r.createdByName ? ` · ${t("app.receipts.review.capturedBy", { name: r.createdByName })}` : ""}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={t("app.action.close")} className="p-2 -mr-2 text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {!data && !error && <div className="p-6 animate-pulse h-64" />}
        {error && (
          <p className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {data && (
          <div className="p-4 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {/* ── The paper ─────────────────────────────────────────────── */}
            <div className="space-y-2">
              {r.files.map((f, i) =>
                f.kind === "document" ? (
                  <a
                    key={f.url + i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-foreground hover:bg-muted"
                  >
                    <FileText size={16} /> {f.filename || "PDF"} <ExternalLink size={12} className="ml-auto" />
                  </a>
                ) : (
                  <a key={f.url + i} href={f.url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={t("app.receipts.review.photoAlt", { n: i + 1 })} className="w-full rounded-lg border border-border" />
                  </a>
                ),
              )}
              <p className="text-xs text-muted-foreground">{t("app.receipts.review.keptForever")}</p>
            </div>

            {/* ── What was read, and what to do with it ─────────────────── */}
            <div className="space-y-4 min-w-0">
              {r.status === "reading" && (
                <p className="text-sm text-muted-foreground">{t("app.receipts.review.stillReading")}</p>
              )}
              {r.status === "unreadable" && (
                <p className="text-sm text-amber-700 dark:text-amber-300">{t("app.receipts.review.unreadable")}</p>
              )}
              {r.status === "void" && (
                <p className="text-sm text-muted-foreground">
                  {t("app.receipts.review.voided", { reason: t(`app.receipts.void.${String(r.voidReason || "other").split(":")[0]}`) })}
                </p>
              )}

              {/* Duplicates: a warning, with the other receipt one tap away. */}
              {data.duplicates?.length > 0 && !settled && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Copy size={14} /> {t("app.receipts.review.duplicateTitle")}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {data.duplicates.map((d) => (
                      <li key={d.id}>
                        {t(`app.receipts.duplicate.${d.reason}`)}{" "}
                        {onOpen && (
                          <button type="button" className="underline" onClick={() => onOpen(d.id)}>
                            {t("app.receipts.review.openOther")}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.extract && (
                <div className="space-y-1 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground" htmlFor="receipt-vendor">{t("app.receipts.review.vendor")}</label>
                    {settled ? (
                      <p className="text-foreground">{r.vendorName || "—"}</p>
                    ) : (
                      <input id="receipt-vendor" className={inputClass} value={vendor} onChange={(e) => setVendor(e.target.value)} />
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                    {r.vendorAddress && (<><dt className="text-muted-foreground">{t("app.receipts.review.address")}</dt><dd className="text-foreground">{r.vendorAddress}</dd></>)}
                    {r.vendorPhone && (<><dt className="text-muted-foreground">{t("app.receipts.review.phone")}</dt><dd className="text-foreground">{r.vendorPhone}</dd></>)}
                    <dt className="text-muted-foreground">{t("app.receipts.review.when")}</dt>
                    <dd className="text-foreground">
                      {r.purchasedAt ? formatDateTime(r.purchasedAt) : r.purchasedDate ? `${formatDate(`${r.purchasedDate}T12:00:00Z`)} · ${t("app.receipts.review.noTime")}` : t("app.receipts.review.noDate")}
                    </dd>
                    {r.receiptNumber && (<><dt className="text-muted-foreground">{t("app.receipts.review.number")}</dt><dd className="text-foreground">{r.receiptNumber}</dd></>)}
                    {(r.paymentMethod || r.cardLast4) && (
                      <><dt className="text-muted-foreground">{t("app.receipts.review.paidWith")}</dt>
                      <dd className="text-foreground">{[r.paymentMethod, r.cardLast4 ? `····${r.cardLast4}` : null].filter(Boolean).join(" ")}</dd></>
                    )}
                    {r.currency && (<><dt className="text-muted-foreground">{t("app.receipts.review.currency")}</dt><dd className="text-foreground">{r.currency}</dd></>)}
                  </dl>
                  {r.extract.summary && <p className="text-xs text-muted-foreground mt-1">{r.extract.summary}</p>}
                </div>
              )}

              {v && (
                <div>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {v.lines.map((line) => (
                      <li key={line.index} className="px-2 py-1.5 text-xs flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-foreground">
                          {line.description}
                          {line.sku ? <span className="text-muted-foreground"> · {line.sku}</span> : null}
                          {line.quantityText ? <span className="text-muted-foreground"> · {line.quantityText}{line.unitPriceText ? ` × ${line.unitPriceText}` : ""}</span> : null}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{kindLabel(t, line.kind)}</span>
                        <span className="tabular-nums text-foreground">{line.lineTotalText || t("app.receipt.unreadableAmount")}</span>
                        {mode === "lines" && !settled && (
                          <select
                            className="border border-border rounded px-1 py-1 text-xs bg-background"
                            aria-label={t("app.receipts.review.lineGoesTo")}
                            value={lineAssign[line.index] ?? ""}
                            onChange={(e) => setLineAssign((prev) => ({ ...prev, [line.index]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                          >
                            <option value="">{t("app.receipts.review.unassigned")}</option>
                            {parts.map((p, pi) => (
                              <option key={pi} value={pi}>
                                {t("app.receipts.review.partN", { n: pi + 1 })}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-2 space-y-0.5 text-xs">
                    {r.extract?.printedSubtotal && (
                      <div className="flex justify-between"><dt className="text-muted-foreground">{t("app.receipt.printedSubtotal")}</dt><dd className="tabular-nums">{r.extract.printedSubtotal}</dd></div>
                    )}
                    {(r.extract?.taxLines || []).map((tl, i) => (
                      <div key={i} className="flex justify-between"><dt className="text-muted-foreground">{tl.label}</dt><dd className="tabular-nums">{tl.amount || t("app.receipt.unreadableAmount")}</dd></div>
                    ))}
                    {r.extract?.printedTax && (
                      <div className="flex justify-between"><dt className="text-muted-foreground">{t("app.receipt.printedTax")}</dt><dd className="tabular-nums">{r.extract.printedTax}</dd></div>
                    )}
                    <div className="flex justify-between"><dt className="text-muted-foreground">{t("app.receipt.printedTotal")}</dt><dd className="tabular-nums">{r.extract?.printedTotal || t("app.receipt.unreadableAmount")}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">{t("app.receipt.itemsTotal")}</dt><dd className="tabular-nums">{v.itemsTotalCents === null ? t("app.receipt.unreadableAmount") : money(v.itemsTotalCents / 100)}</dd></div>
                  </dl>

                  {v.flags.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {v.flags.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          {flagText(t, f, v)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ── Where it probably belongs, and why ─────────────────── */}
              {!settled && data.suggestions && (data.suggestions.jobs.length > 0 || data.suggestions.overhead) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles size={14} className="text-muted-foreground" /> {t("app.receipts.review.suggestions")}
                  </h3>
                  {data.suggestions.jobs.map((s) => (
                    <button
                      type="button"
                      key={s.jobId}
                      onClick={() => {
                        setMode("one");
                        setParts([{ kind: "job", jobId: s.jobId, category: "Materials", amount: "" }]);
                      }}
                      disabled={!jobTitle[s.jobId]}
                      className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted disabled:opacity-70"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{s.title || s.place}</span>
                        <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{confidenceLabel(t, s.confidence)}</span>
                      </div>
                      <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                        {s.reasons.map((rs, i) => (
                          <li key={i}>{reasonText(t, rs)}</li>
                        ))}
                      </ul>
                    </button>
                  ))}
                  {data.suggestions.overhead && (
                    <button
                      type="button"
                      disabled={!access.canChooseOverhead}
                      onClick={() => {
                        setMode("one");
                        setParts([{ kind: "overhead", jobId: "", category: data.suggestions.overhead.category, amount: "" }]);
                      }}
                      className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted disabled:opacity-70"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {t("app.receipts.review.overheadAs", { category: categoryLabel(t, data.suggestions.overhead.category) })}
                        </span>
                        <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{confidenceLabel(t, data.suggestions.overhead.confidence)}</span>
                      </div>
                      <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                        {data.suggestions.overhead.reasons.map((rs, i) => (
                          <li key={i}>{reasonText(t, rs)}</li>
                        ))}
                      </ul>
                      {!access.canChooseOverhead && <p className="mt-1 text-xs text-muted-foreground">{t("app.receipts.review.officeDecidesOverhead")}</p>}
                    </button>
                  )}
                  {data.suggestions.split && v?.canSplitByLines && access.canChooseOverhead && (
                    <button type="button" onClick={applySplit} className="text-sm underline text-foreground">
                      {t("app.receipts.review.useSplit", { n: data.suggestions.split.groups.length })}
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground">{t("app.receipts.review.noGeocode")}</p>
                </div>
              )}

              {/* ── Book it ───────────────────────────────────────────── */}
              {!settled && r.status !== "reading" && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <h3 className="text-sm font-semibold text-foreground">{t("app.receipts.review.bookTitle")}</h3>

                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("app.receipts.review.bookTitle")}>
                    {[
                      ["one", t("app.receipts.review.modeOne")],
                      ...(v?.canSplitByLines ? [["lines", t("app.receipts.review.modeLines")]] : []),
                      ["amount", t("app.receipts.review.modeAmount")],
                    ].map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setMode(m);
                          if (m === "one") setParts((prev) => prev.slice(0, 1));
                          if (m !== "one" && parts.length < 2) setParts((prev) => [...prev, { kind: "job", jobId: "", category: "Materials", amount: "" }]);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full border ${mode === m ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {parts.map((p, i) => (
                    <div key={i} className="space-y-1">
                      {mode !== "one" && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t("app.receipts.review.partN", { n: i + 1 })}</span>
                          {parts.length > 2 && (
                            <button
                              type="button"
                              className="underline"
                              onClick={() => {
                                setParts((prev) => prev.filter((_, n) => n !== i));
                                setLineAssign((prev) => Object.fromEntries(Object.entries(prev).filter(([, pi]) => pi !== i).map(([li, pi]) => [li, pi > i ? pi - 1 : pi])));
                              }}
                            >
                              {t("app.receipts.review.removePart")}
                            </button>
                          )}
                        </div>
                      )}
                      {targetPicker(p, i)}
                      {mode === "amount" && (
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          placeholder={t("app.receipts.review.amount")}
                          aria-label={t("app.receipts.review.amount")}
                          value={p.amount}
                          onChange={(e) => setPart(i, { amount: e.target.value })}
                        />
                      )}
                    </div>
                  ))}
                  {mode !== "one" && parts.length < 12 && (
                    <button
                      type="button"
                      className="text-xs underline text-foreground"
                      onClick={() => setParts((prev) => [...prev, { kind: "job", jobId: "", category: "Materials", amount: "" }])}
                    >
                      {t("app.receipts.review.addPart")}
                    </button>
                  )}
                  {mode === "amount" && Number.isInteger(totalCents) && (
                    <p className={`text-xs ${amountSum === totalCents ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}>
                      {t("app.receipts.review.amountLeft", { left: money((totalCents - amountSum) / 100) })}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground" htmlFor="receipt-total">{t("app.receipts.review.total")}</label>
                      <input id="receipt-total" className={inputClass} inputMode="decimal" value={totalText} onChange={(e) => setTotalText(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground" htmlFor="receipt-tax">{t("app.receipts.review.tax")}</label>
                      <input id="receipt-tax" className={inputClass} inputMode="decimal" value={taxText} onChange={(e) => setTaxText(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t("app.receipts.review.totalHint")}</p>

                  {askDuplicate && (
                    <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
                      <p>{t("app.receipts.review.duplicateAsk")}</p>
                      <button type="button" className="mt-2 underline font-medium" onClick={() => confirm(true)}>
                        {t("app.receipts.review.bookAnyway")}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => confirm(false)}
                      disabled={busy !== "" || (mode === "one" && parts[0]?.kind === "job" && !parts[0]?.jobId)}
                      className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
                    >
                      {busy === "confirm" && <Loader2 size={14} className="animate-spin" />}
                      {t("app.receipts.review.confirm")}
                    </button>
                    {!access.seesAll && !r.officeDecides && (
                      <button
                        type="button"
                        disabled={busy !== ""}
                        onClick={() =>
                          act("office", () =>
                            fetchJson(`/api/receipts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "office" }) }),
                          )
                        }
                        className="px-4 py-2.5 rounded-full text-sm font-semibold border border-border text-foreground"
                      >
                        {t("app.receipts.review.letOffice")}
                      </button>
                    )}
                  </div>
                  {r.officeDecides && <p className="text-xs text-muted-foreground">{t("app.receipts.review.officeAsked")}</p>}
                </div>
              )}

              {/* ── Booked: where each part went; the office can move it ── */}
              {r.status === "confirmed" && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{t("app.receipts.review.booked")}</h3>
                  {r.expenses.map((e) => (
                    <BookedPart key={e.id} receiptId={id} expense={e} jobs={jobs} canRelink={access.canRelink} money={money} t={t} onDone={() => { onChanged?.(); load(); }} />
                  ))}
                </div>
              )}

              {/* ── The quieter actions ────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-sm">
                {!settled && (
                  <button
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => act("read", () => fetchJson(`/api/receipts/${id}/read`, { method: "POST" }))}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {busy === "read" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    {t("app.receipts.review.readAgain")}
                  </button>
                )}
                {!settled && (
                  <span className="inline-flex items-center gap-1.5">
                    <select
                      className="border border-border rounded px-2 py-1 text-xs bg-background"
                      aria-label={t("app.receipts.review.voidReason")}
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                    >
                      <option value="">{t("app.receipts.review.dontBook")}</option>
                      {["duplicate", "not_a_receipt", "personal", "other"].map((k) => (
                        <option key={k} value={k}>{t(`app.receipts.void.${k}`)}</option>
                      ))}
                    </select>
                    {voidReason && (
                      <button
                        type="button"
                        disabled={busy !== ""}
                        className="text-xs underline text-foreground"
                        onClick={() =>
                          act("void", () =>
                            fetchJson(`/api/receipts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "void", reason: voidReason }) }),
                          )
                        }
                      >
                        {t("app.receipts.review.voidConfirm")}
                      </button>
                    )}
                  </span>
                )}
                {r.status === "void" && access.seesAll && (
                  <button
                    type="button"
                    disabled={busy !== ""}
                    className="text-xs underline text-foreground"
                    onClick={() =>
                      act("restore", () =>
                        fetchJson(`/api/receipts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) }),
                      )
                    }
                  >
                    {t("app.receipts.review.restore")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** One booked part — where it went, and (for the office) where to move it. */
function BookedPart({ receiptId, expense, jobs, canRelink, money, t, onDone }) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(expense.kind === "job" ? `job:${expense.jobId}` : expense.kind);
  const [category, setCategory] = useState(expense.category || "Other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const kind = target.startsWith("job:") ? "job" : target;
      await fetchJson(`/api/receipts/${receiptId}/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, jobId: kind === "job" ? target.slice(4) : null, category }),
      });
      setEditing(false);
      onDone?.();
    } catch (err) {
      setError(refusalText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const where =
    expense.kind === "job"
      ? expense.jobTitle || t("app.receipts.review.aJob")
      : expense.kind === "overhead"
        ? t("app.receipts.review.overhead")
        : t("app.receipts.review.general");

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-foreground">
          {where} · {categoryLabel(t, expense.category)}
          {Array.isArray(expense.receiptLines) ? ` · ${t("app.receipts.review.lineCount", { n: expense.receiptLines.length })}` : ""}
        </span>
        <span className="tabular-nums text-foreground">
          {money(expense.amount)}
          {expense.taxAmount !== null ? <span className="text-xs text-muted-foreground"> · {t("app.receipts.review.taxIn", { tax: money(expense.taxAmount) })}</span> : null}
        </span>
      </div>
      {canRelink && !editing && (
        <button type="button" className="mt-1 text-xs underline text-muted-foreground" onClick={() => setEditing(true)}>
          {t("app.receipts.review.move")}
        </button>
      )}
      {editing && (
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <select className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} aria-label={t("app.receipts.review.where")}>
            <option value="job:">{t("app.receipts.review.chooseJob")}</option>
            {jobs.map((j) => (
              <option key={j.id} value={`job:${j.id}`}>{j.title}</option>
            ))}
            <option value="overhead">{t("app.receipts.review.overhead")}</option>
            <option value="general">{t("app.receipts.review.general")}</option>
          </select>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("app.receipts.review.category")}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{categoryLabel(t, c)}</option>
            ))}
          </select>
          <button type="button" disabled={busy || target === "job:"} onClick={save} className="px-3 py-2 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-60">
            {t("app.action.save")}
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
