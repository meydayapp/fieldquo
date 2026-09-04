// app/components/purchasing/ReceiptScanner.js
//
// Photograph a till receipt; fill in what it says.
//
// ── Photos only, and it says so before you pick a file ─────────────────────
//
// lib/receipts/media.js carries the two reasons a PDF cannot work on this path
// and the sentence a person gets when they try one. The hint below is printed
// UP FRONT, not as a failure message afterwards — a limit stated in advance is
// just how a feature works; the same limit stated after an upload is a dead
// control that already wasted a trip to the van.
//
// ── The model reads; this component computes nothing ───────────────────────
//
// Every number on screen came out of lib/receipts/reconcile.js on the server.
// There is no arithmetic in this file — deliberately, because the moment a
// total is recomputed in the browser there are two answers to "what did this
// cost" and no way to know which one is on screen.
//
// ── Prefill, never replace ─────────────────────────────────────────────────
//
// prefillMaterial() decides, and it is the SAME function the server ran
// against the stored row. A figure somebody typed wins over a figure a model
// read off a photograph, every time — and when the two disagree the scan's
// number is shown beside it rather than discarded, so a person can choose.
"use client";

import { useState } from "react";
import { Camera, ScanLine, AlertTriangle, Check } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
import MediaUploader from "@/app/components/MediaUploader";
import { receiptImageOrRefusal } from "@/lib/receipts/media";
import { prefillMaterial } from "@/lib/receipts/prefill";

export default function ReceiptScanner({ materialId, draft, onApply, onClose }) {
  const { t } = useTranslation();
  // The two computed figures on this panel — what the lines add up to, and how
  // far that is from the printed total — were bare `toFixed(2)`: ungrouped,
  // unlabelled, and in no currency at all, so "2100.00" sat under a heading
  // reading "The lines added up". The number read off the receipt image
  // (`printedTotal`) is deliberately NOT put through this: it is a
  // transcription of what the paper says, symbol and all, and reformatting a
  // transcription is how a scan stops being evidence.
  const money = useCompanyMoney();
  const [files, setFiles] = useState([]);
  const [scan, setScan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const file = files[0] || null;
  // Checked in the browser too, so a PDF never costs a round trip — and the
  // sentence is the same one the server would send, from the same module.
  const usable = file ? receiptImageOrRefusal(file) : null;

  async function read() {
    if (!usable?.ok || busy) return;
    setBusy(true);
    setError("");
    setScan(null);
    try {
      const res = await fetch("/api/receipts/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, materialId: materialId || null }),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.receipt.failed"));
        return;
      }
      setScan(await res.json());
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!scan) return;
    // Against what is in the BOXES right now, not against what the server saw
    // when the scan ran — somebody may have typed a figure while the photo was
    // uploading, and that figure is a person's statement.
    const merged = prefillMaterial(
      { actualCost: draft?.actualCost ?? null, supplier: draft?.supplier ?? null },
      {
        actualCost: scan.prefill?.offered?.actualCost ?? null,
        supplier: scan.prefill?.offered?.supplier ?? null,
      },
    );
    onApply?.({ values: merged.values, kept: merged.kept, offered: merged.offered });
  }

  const rec = scan?.reconciliation;
  const kept = scan ? prefillKept(scan, draft) : [];

  return (
    <div className="mt-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <Camera size={14} className="text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">{t("app.receipt.heading")}</p>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{t("app.receipt.photosOnly")}</p>

      <div className="mt-2">
        <MediaUploader
          uploadUrl="/api/upload"
          value={files}
          onChange={(next) => {
            setFiles(next.slice(-1));
            setScan(null);
            setError("");
          }}
          max={1}
          label={t("app.receipt.upload")}
          hint={t("app.receipt.photosOnly")}
        />
      </div>

      {usable && !usable.ok && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {usable.error}
        </p>
      )}

      {usable?.ok && !scan && (
        <button
          type="button"
          onClick={read}
          disabled={busy}
          className="mt-2 flex items-center gap-1.5 rounded bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50"
        >
          <ScanLine size={13} />
          {busy ? t("app.receipt.reading") : t("app.receipt.read")}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {scan && (
        <div className="mt-3 space-y-2">
          {scan.receipt.merchantName && (
            <p className="text-xs text-foreground">
              {scan.receipt.merchantName}
              {scan.receipt.transactionDate ? ` · ${scan.receipt.transactionDate}` : ""}
            </p>
          )}
          {/* Rendered, not merely extracted. A field a schema collects and no
              screen shows is failure class #1, and a schema is the easiest
              place in this codebase to grow one. */}
          {scan.receipt.summary && (
            <p className="text-xs text-muted-foreground">{scan.receipt.summary}</p>
          )}

          <ul className="divide-y divide-border rounded border border-border">
            {rec.lines.map((line) => (
              <li key={line.index} className="flex gap-2 px-2 py-1.5 text-xs">
                <span className="min-w-0 flex-1 text-foreground">{line.description}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {/* The printed characters, not a reformatting of them. */}
                  {line.lineTotalText || t("app.receipt.unreadableAmount")}
                </span>
              </li>
            ))}
          </ul>

          <dl className="space-y-0.5 text-xs">
            {/* Every printed figure is shown as READ — the characters off the
                paper, not a reformatting of them. The one computed number is
                labelled as the lines added up, so the two are never confused. */}
            {scan.receipt.printedSubtotal && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("app.receipt.printedSubtotal")}</dt>
                <dd className="tabular-nums text-foreground">{scan.receipt.printedSubtotal}</dd>
              </div>
            )}
            {scan.receipt.printedTax && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("app.receipt.printedTax")}</dt>
                <dd className="tabular-nums text-foreground">{scan.receipt.printedTax}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("app.receipt.printedTotal")}</dt>
              <dd className="tabular-nums text-foreground">
                {scan.receipt.printedTotal || t("app.receipt.unreadableAmount")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("app.receipt.itemsTotal")}</dt>
              <dd className="tabular-nums text-foreground">
                {rec.itemsTotalCents === null
                  ? t("app.receipt.unreadableAmount")
                  : money(rec.itemsTotal)}
              </dd>
            </div>
          </dl>

          {/* The discrepancy is INFORMATION. It is not corrected, not hidden,
              and it does not block anything — a person decides. */}
          {rec.verdict === "mismatch" && (
            <p className="flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {/* Names WHICH figure the lines were compared against, because
                  on a receipt that prints a subtotal it is the subtotal — see
                  lib/receipts/reconcile.js. "It doesn't match the total" on a
                  receipt whose total includes tax would send somebody hunting
                  for a discrepancy that is just the sales tax. */}
              {t(
                rec.comparedTo === "subtotal"
                  ? "app.receipt.mismatchSubtotal"
                  : "app.receipt.mismatch",
                { amount: money(Math.abs(rec.discrepancy)) },
              )}
            </p>
          )}
          {rec.printedTotalsAgree === false && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("app.receipt.totalsDisagree")}
            </p>
          )}
          {rec.verdict === "someLinesUnreadable" && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("app.receipt.someUnreadable")}
            </p>
          )}
          {rec.verdict === "noPrintedTotal" && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("app.receipt.noPrintedTotal")}
            </p>
          )}
          {rec.verdict === "agrees" && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <Check size={13} /> {t("app.receipt.agrees")}
            </p>
          )}

          {/* The rest of the field list, shown rather than merely collected.
              Every one of these is on the paper and none of them is money, so
              they sit under the figures instead of competing with them. */}
          {(scan.receipt.receiptNumber ||
            scan.receipt.paymentMethod ||
            scan.receipt.currencyCode ||
            scan.receipt.merchantAddress ||
            scan.receipt.merchantContact) && (
            <p className="text-xs text-muted-foreground">
              {[
                scan.receipt.receiptNumber,
                scan.receipt.paymentMethod,
                scan.receipt.currencyCode,
                scan.receipt.merchantAddress,
                scan.receipt.merchantContact,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {/* What the photo did not show clearly enough to read. Named, so a
              second photo can be aimed at the part that was missing rather
              than taken again at random. */}
          {scan.receipt.unreadable.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("app.receipt.couldNotRead", {
                fields: scan.receipt.unreadable.join(", "),
              })}
            </p>
          )}

          {kept.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("app.receipt.kept", {
                fields: kept.map((k) => t(`app.receipt.field.${k}`)).join(", "),
              })}
            </p>
          )}

          {scan.simulated && (
            <p className="text-xs text-muted-foreground">{t("app.receipt.simulated")}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {/* Offered only when there is something to fill in. On a mismatch
                suggestedCostCents() returns null, so there is no cost to
                apply and no button that would appear to do something. */}
            {(scan.prefill?.offered?.actualCost != null ||
              scan.prefill?.offered?.supplier) && (
              <button
                type="button"
                onClick={apply}
                className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {t("app.receipt.use")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("app.purchasing.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Which fields the scan wanted but is not allowed to touch.
 *
 * Recomputed against the live boxes rather than read off the server's answer,
 * because the boxes can change after the scan runs. Same function, so the two
 * cannot disagree about what "already stated" means.
 */
function prefillKept(scan, draft) {
  const merged = prefillMaterial(
    { actualCost: draft?.actualCost ?? null, supplier: draft?.supplier ?? null },
    {
      actualCost: scan.prefill?.offered?.actualCost ?? null,
      supplier: scan.prefill?.offered?.supplier ?? null,
    },
  );
  return merged.kept;
}
