"use client";

// Payment methods you accept — Settings → Payments.
//
// The one screen that writes Company.paymentMethods. The column had a schema
// default ("cash", "e_transfer", "cheque") and three readers — the invoice
// email, the client portal and the invoice PDF all print it as an
// "Accepted: …" line — but nothing let a contractor change it, so every
// company told every homeowner it took cheques whether or not it did. This
// card is the missing writer.
//
// Only the values in lib/payments/paymentMethodOptions.js are offered, and the
// route filters to the same list, because whatever is stored is printed
// verbatim on documents carrying the company's name.
//
// Saved through the existing business-info PATCH with a Save button rather
// than on every tick: three checkboxes saved individually would send three
// requests for one decision, and a half-applied set ("cash saved, cheque
// failed") is worse than the previous set staying put.

import { useState } from "react";
import { Banknote } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payments/paymentMethodOptions";

// Literal keys per method rather than a lookup table, so check:translations
// can see each one is referenced; a key that is only ever built at runtime is
// indistinguishable from a dead one to it.
function methodLabel(t, method) {
  switch (method) {
    case "cash":
      return t("app.setPayments.methodsCash");
    case "e_transfer":
      return t("app.setPayments.methodsETransfer");
    case "cheque":
      return t("app.setPayments.methodsCheque");
    default:
      return method;
  }
}

function fromCompany(company) {
  const stored = Array.isArray(company?.paymentMethods) ? company.paymentMethods : [];
  return PAYMENT_METHOD_OPTIONS.filter((m) => stored.includes(m));
}

/**
 * @param company  the /api/settings/business-info GET payload (or null while
 *                 the page is still loading it)
 * @param onSaved  called with the saved list once the server has accepted it,
 *                 so the page can fold it back into its own company state
 */
export default function PaymentMethodsCard({ company, onSaved }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(() => fromCompany(company));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // The page loads the company after this card first renders, so the ticks
  // follow the payload when it arrives. Reset during render (React's
  // "adjusting state when a prop changes" pattern) rather than in an effect,
  // and keyed on the joined list rather than the array identity, so a
  // re-render of the parent with the same methods does not wipe an unsaved
  // edit.
  const storedKey = fromCompany(company).join(",");
  const [seenKey, setSeenKey] = useState(storedKey);
  if (seenKey !== storedKey) {
    setSeenKey(storedKey);
    setSelected(storedKey ? storedKey.split(",") : []);
    setSaved(false);
  }

  const dirty = selected.join(",") !== storedKey;

  function toggle(method) {
    setSaved(false);
    setError("");
    setSelected((cur) =>
      cur.includes(method)
        ? cur.filter((m) => m !== method)
        : PAYMENT_METHOD_OPTIONS.filter((m) => m === method || cur.includes(m)),
    );
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await fetchJson("/api/settings/business-info", {
        method: "PATCH",
        body: { paymentMethods: selected },
      });
      // What the server kept, not what was sent — the route filters to the
      // known set, and the ticks must show what the documents will print.
      const kept = fromCompany(updated);
      setSelected(kept);
      setSaved(true);
      onSaved?.(kept);
    } catch (err) {
      setError(err.message || t("app.setPayments.methodsError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-tour="payments-methods" className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start gap-3">
        <Banknote size={22} className="text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground">{t("app.setPayments.methodsTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("app.setPayments.methodsIntro")}</p>

          <div className="mt-4 flex flex-col gap-2">
            {PAYMENT_METHOD_OPTIONS.map((method) => (
              <label key={method} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selected.includes(method)}
                  disabled={saving || !company}
                  onChange={() => toggle(method)}
                />
                {methodLabel(t, method)}
              </label>
            ))}
          </div>

          {error && (
            <div className="mt-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !company || !dirty}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {t("app.setPayments.methodsSave")}
            </button>
            {saved && !dirty && (
              <span className="text-sm text-green-700 dark:text-green-400">
                {t("app.setPayments.methodsSaved")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
