// app/components/tax/TaxUnresolvedModal.js
//
// What the person sees when a send is refused because the document says tax
// applies and charges none.
//
// ── Why a refusal needs a dialog and not a red banner ──────────────────────
//
// The stop itself is easy to justify: Q-2026-0011 went out reading "Tax $0.00
// / TOTAL $5,250.00" with taxEnabled true, and $682.50 of Ontario HST is money
// the contractor either eats or has to go back to a homeowner for, after they
// have already been shown a total. There is no unsend.
//
// A refusal on its own, though, leaves someone holding a quote they need out
// today and a sentence about a client record they may not have created. So the
// two ways forward are the whole point of stopping, and both are one action:
//
//   Set the location  → PATCHes the CLIENT, right here. Two fields. It fixes
//                       this quote and every future one for that client, and
//                       the dialog then says what the rate resolved to so the
//                       number is confirmed before the send rather than after.
//   Send with no tax  → PATCHes THIS document only. The company's settings and
//                       every other quote are untouched. The document then
//                       states that no tax was charged instead of showing a
//                       zero that means nothing.
//
// ── Why the retry is a button and not automatic ────────────────────────────
//
// Same reasoning as EmailSectionsBlockedModal, which this deliberately mirrors:
// they confirmed a send, but the thing they confirmed has changed underneath
// them. One more press, deliberately — and this time with the tax figure they
// are about to send in front of them.
"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { supportedCountryOptions } from "@/lib/tax/jurisdictions";

/**
 * @param blocked   the 409 payload from a send route:
 *                  { clientId, clientName, missing: ["country","province"] }
 * @param docPath   "quotes" | "invoices" — which collection to PATCH for the
 *                  "no tax" route. Passed rather than inferred so an invoice
 *                  can never accidentally PATCH a quote id.
 * @param docId     the document being sent.
 * @param onRetry   fires the send again.
 */
export default function TaxUnresolvedModal({
  isOpen,
  blocked,
  docPath,
  docId,
  onClose,
  onRetry,
  sending = false,
}) {
  const { t } = useTranslation();
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // What changed, so the dialog can say what the rate came out at rather than
  // just going quiet. Null until something is saved.
  const [resolved, setResolved] = useState(null);

  if (!isOpen) return null;

  const clientName = blocked?.clientName || "";
  const missing = Array.isArray(blocked?.missing) ? blocked.missing : [];
  const fields = missing
    .map((f) =>
      t(
        f === "country"
          ? "app.tax.blocked.fieldCountry"
          : "app.tax.blocked.fieldProvince",
      ),
    )
    .join(t("app.tax.blocked.fieldJoin"));

  async function saveLocation() {
    setBusy("client");
    setError("");
    try {
      // PATCH /api/clients/[id] already normalises the country and stores the
      // province — this dialog carries no copy of that logic, and no ability
      // to write a country the tax tables don't recognise.
      await fetchJson(`/api/clients/${blocked.clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, province }),
      });

      // Ask the server what that actually resolved to rather than working it
      // out here. A dialog that computes its own rate is a second opinion, and
      // the send route's is the one that decides.
      const check = await fetchJson(
        `/api/clients/${blocked.clientId}/tax-preview`,
      );
      setResolved(check);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function sendWithoutTax() {
    setBusy("notax");
    setError("");
    try {
      await fetchJson(`/api/${docPath}/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxEnabled: false }),
      });
      onRetry?.();
    } catch (err) {
      setError(err.message);
      setBusy("");
    }
  }

  // Cleared once the client resolves to a real rate. Until then the send is
  // still refused, so offering the button would be offering a 409.
  const canRetry = resolved?.rate > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-card border border-border w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">
              {t("app.tax.blocked.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("app.tax.blocked.body")}
            </p>
            {fields && (
              <p className="text-sm text-muted-foreground mt-2">
                {t("app.tax.blocked.missing", { client: clientName, fields })}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* ── Route one: give the client a location ───────────────────────── */}
        {blocked?.clientId && (
          <div className="border border-border rounded-lg p-3 space-y-2.5">
            <div className="text-sm font-medium text-foreground">
              {t("app.tax.blocked.setAddress", { client: clientName })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  {t("app.tax.blocked.countryLabel")}
                </span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full mt-1 border border-border bg-background rounded-md px-2 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  {/* Only countries we hold rates for. Offering the other 180
                      would be offering a choice that resolves to nothing. */}
                  {supportedCountryOptions().map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  {t("app.tax.blocked.provinceLabel")}
                </span>
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="ON"
                  className="w-full mt-1 border border-border bg-background rounded-md px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={saveLocation}
              disabled={Boolean(busy) || !country}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-inverted text-inverted-foreground font-medium disabled:opacity-50"
            >
              {busy === "client" && (
                <Loader2 size={12} className="animate-spin" />
              )}
              {t("app.tax.blocked.save")}
            </button>

            {resolved && (
              <p
                className={`text-xs leading-snug ${
                  resolved.rate > 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-amber-700 dark:text-amber-300"
                }`}
              >
                {resolved.rate > 0
                  ? t("app.tax.blocked.saved", { rate: resolved.rate })
                  : t("app.tax.blocked.stillUnknown")}
              </p>
            )}

            <Link
              href={`/app/clients/${blocked.clientId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
            >
              {t("app.tax.blocked.openClient")}
              <ExternalLink size={11} />
            </Link>
          </div>
        )}

        {/* ── Route two: there is genuinely no tax on this one ────────────── */}
        <div className="border border-border rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium text-foreground">
            {t("app.tax.blocked.noTaxTitle")}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("app.tax.blocked.noTaxBody")}
          </p>
          <button
            type="button"
            onClick={sendWithoutTax}
            disabled={Boolean(busy) || sending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-foreground disabled:opacity-50"
          >
            {busy === "notax" && <Loader2 size={12} className="animate-spin" />}
            {t("app.tax.blocked.noTaxAction")}
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-border text-foreground"
          >
            {t("app.common.cancel", "Cancel")}
          </button>
          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={sending}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-inverted text-inverted-foreground font-medium disabled:opacity-50"
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              {t("app.tax.blocked.retry")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
