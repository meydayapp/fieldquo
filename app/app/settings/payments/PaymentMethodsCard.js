"use client";

// Payment methods you accept — Settings → Payments.
//
// The one screen that writes Company.paymentMethods and
// Company.paymentMethodDetails. The owner's brief: "In the payment options
// offered (e-transfer, cash, cheque), if those are selected the options
// should also appear in the invoice — pay online or via those options. When
// the e-transfer option is checked, a text field with the e-transfer email
// address or phone number should be entered. Also the USA doesn't have
// e-transfer, so if an American company signs up it should show the
// equivalent — Venmo or whatever they use."
//
// So: the list is the catalogue for the company's COUNTRY
// (lib/payments/offlineMethods.js — a Canadian company never sees Zelle, a
// US one never sees Interac), each method is a switch, and switching one on
// reveals the fields the invoice needs to print a usable instruction. A
// method that is on without its required detail cannot be saved: the route
// refuses with a sentence, and this card says the same sentence before
// asking, so the Save button is never a surprise.
//
// Saved through the existing business-info PATCH with a Save button rather
// than on every keystroke: a half-applied set ("e-transfer on, address
// failed") is worse than the previous set staying put.

import { useState } from "react";
import { Banknote, AlertCircle } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  OFFLINE_METHODS,
  methodsForCountry,
  paymentCountry,
  enabledMethods,
  validateAllDetails,
  offlineMethodLabel,
} from "@/lib/payments/offlineMethods";
import { offlineDiscountAvailable, OFFLINE_PAYMENT_DISCOUNT_PCT } from "@/lib/payments/offlineDiscount";

// Literal keys per field rather than a lookup table, so check:translations
// can see each one is referenced; a key only ever built at runtime is
// indistinguishable from a dead one to it.
function fieldLabel(t, method, key) {
  switch (key) {
    case "address":
      return method === "paypal"
        ? t("app.setPayments.field.paypalAddress")
        : t("app.setPayments.field.address");
    case "autoDeposit":
      return t("app.setPayments.field.autoDeposit");
    case "securityQuestion":
      return t("app.setPayments.field.securityQuestion");
    case "securityAnswer":
      return t("app.setPayments.field.securityAnswer");
    case "payee":
      return t("app.setPayments.field.payee");
    case "mailingAddress":
      return t("app.setPayments.field.mailingAddress");
    case "handle":
      return t("app.setPayments.field.handle");
    case "cashtag":
      return t("app.setPayments.field.cashtag");
    case "bankName":
      return t("app.setPayments.field.bankName");
    case "routingNumber":
      return t("app.setPayments.field.routingNumber");
    case "accountNumber":
      return t("app.setPayments.field.accountNumber");
    default:
      return key;
  }
}

// What the invoice will say for each method, so the owner sees the
// consequence of the switch before a client does.
function methodHint(t, method) {
  switch (method) {
    case "e_transfer":
      return t("app.setPayments.hint.eTransfer");
    case "zelle":
      return t("app.setPayments.hint.zelle");
    case "venmo":
      return t("app.setPayments.hint.venmo");
    case "cash_app":
      return t("app.setPayments.hint.cashApp");
    case "ach":
      return t("app.setPayments.hint.ach");
    case "paypal":
      return t("app.setPayments.hint.paypal");
    case "cheque":
    case "check":
      return t("app.setPayments.hint.cheque");
    case "cash":
      return t("app.setPayments.hint.cash");
    default:
      return "";
  }
}

function fromCompany(company) {
  const details = company?.paymentMethodDetails && typeof company.paymentMethodDetails === "object" ? company.paymentMethodDetails : {};
  return {
    on: enabledMethods(company),
    details: Object.fromEntries(Object.entries(details).map(([m, d]) => [m, { ...(d || {}) }])),
    // The Canada-only discount switch (lib/payments/offlineDiscount.js).
    // Read as the route stores it; a US company's row is always false.
    offlineDiscount: company?.offlinePaymentDiscount === true,
  };
}

const stateKey = (st) => JSON.stringify([st.on, st.details, st.offlineDiscount]);

/**
 * @param company  the /api/settings/business-info GET payload (or null while
 *                 the page is still loading it)
 * @param onSaved  called once the server has accepted the save, so the page
 *                 reloads its own company state
 */
export default function PaymentMethodsCard({ company, onSaved }) {
  const { t, language } = useTranslation();
  const [state, setState] = useState(() => fromCompany(company));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // The page loads the company after this card first renders, so the switches
  // follow the payload when it arrives. Reset during render (React's
  // "adjusting state when a prop changes" pattern), keyed on the content
  // rather than the object identity, so a parent re-render with the same
  // company does not wipe an unsaved edit.
  const storedKey = stateKey(fromCompany(company));
  const [seenKey, setSeenKey] = useState(storedKey);
  if (seenKey !== storedKey) {
    setSeenKey(storedKey);
    setState(fromCompany(company));
    setSaved(false);
  }

  const country = paymentCountry(company || {});
  const offered = methodsForCountry(country);
  const dirty = stateKey(state) !== storedKey;
  // The same refusal the route will give, shown before the request is made.
  const problem = dirty ? validateAllDetails(state.details, { country, enabled: state.on }).error || "" : "";

  function toggle(method) {
    setSaved(false);
    setError("");
    setState((cur) => ({
      ...cur,
      on: cur.on.includes(method) ? cur.on.filter((m) => m !== method) : offered.filter((m) => m === method || cur.on.includes(m)),
    }));
  }

  function setField(method, key, value) {
    setSaved(false);
    setError("");
    setState((cur) => ({
      ...cur,
      details: { ...cur.details, [method]: { ...(cur.details[method] || {}), [key]: value } },
    }));
  }

  async function handleSave() {
    if (saving || problem) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await fetchJson("/api/settings/business-info", {
        method: "PATCH",
        body: {
          paymentMethods: state.on,
          paymentMethodDetails: state.details,
          // Only where the switch was offered; a US card never sends it.
          ...(offlineDiscountAvailable(company || {}) ? { offlinePaymentDiscount: state.offlineDiscount } : {}),
        },
      });
      // What the server kept, not what was sent — the route filters to the
      // country's catalogue and normalises each value (@ and $ stripped),
      // and the switches must show what the documents will print.
      setState(fromCompany(updated));
      setSaved(true);
      onSaved?.(updated);
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

          <div className="mt-4 divide-y divide-border">
            {offered.map((method) => {
              const on = state.on.includes(method);
              const spec = OFFLINE_METHODS[method];
              const details = state.details[method] || {};
              return (
                <div key={method} className="py-3 first:pt-0 last:pb-0" data-method={method}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{offlineMethodLabel(method, language)}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{methodHint(t, method)}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={offlineMethodLabel(method, language)}
                      onClick={() => toggle(method)}
                      disabled={saving || !company}
                      className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                        on ? "bg-green-600" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          on ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {on && spec.fields.length > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {spec.fields.map((field) =>
                        field.kind === "bool" ? (
                          <label key={field.key} className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={Boolean(details[field.key])}
                              disabled={saving}
                              onChange={(e) => setField(method, field.key, e.target.checked)}
                            />
                            {fieldLabel(t, method, field.key)}
                          </label>
                        ) : (
                          <label key={field.key} className={`block text-xs text-muted-foreground ${field.kind === "address" ? "sm:col-span-2" : ""}`}>
                            {fieldLabel(t, method, field.key)}
                            {field.required ? " *" : ""}
                            {field.kind === "address" ? (
                              <textarea
                                rows={2}
                                value={details[field.key] || ""}
                                disabled={saving}
                                onChange={(e) => setField(method, field.key, e.target.value)}
                                className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background"
                              />
                            ) : (
                              <input
                                type="text"
                                inputMode={field.kind === "routing" || field.kind === "account" ? "numeric" : field.kind === "email_or_phone" ? "email" : "text"}
                                autoComplete="off"
                                value={details[field.key] || ""}
                                disabled={saving}
                                onChange={(e) => setField(method, field.key, e.target.value)}
                                className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background"
                              />
                            )}
                          </label>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── "Offer 3% off for e-transfer or cheque" ──────────────────
              Rendered for a Canadian company only, and inert on the server
              for any other (lib/payments/offlineDiscount.js on why it is a
              discount and never a card surcharge — Quebec). Needs e-transfer
              or cheque switched on above: a discount for a method the client
              cannot use is a control that appears to work. */}
          {offlineDiscountAvailable(company || {}) && (
            <div className="mt-4 pt-4 border-t border-border" data-offline-discount>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {t("app.setPayments.offlineDiscountTitle", "Offer {pct}% off for e-transfer or cheque", { pct: OFFLINE_PAYMENT_DISCOUNT_PCT })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      "app.setPayments.offlineDiscountHint",
                      "Quotes show \u201cPay by e-transfer or cheque \u2014 {pct}% off\u201d as an option the client picks when approving. The discount lands on their invoice and the card link comes off it. Framed as a discount, never a card fee \u2014 a card surcharge is not allowed in Quebec. Canada only.",
                      { pct: OFFLINE_PAYMENT_DISCOUNT_PCT },
                    )}
                  </p>
                  {state.offlineDiscount && !state.on.some((m) => m === "e_transfer" || m === "cheque") && (
                    <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                      {t("app.setPayments.offlineDiscountNeedsMethod", "Switch on e-transfer or cheque above, or the offer will not appear on quotes.")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={state.offlineDiscount}
                  aria-label={t("app.setPayments.offlineDiscountTitle", "Offer {pct}% off for e-transfer or cheque", { pct: OFFLINE_PAYMENT_DISCOUNT_PCT })}
                  onClick={() => {
                    setSaved(false);
                    setError("");
                    setState((cur) => ({ ...cur, offlineDiscount: !cur.offlineDiscount }));
                  }}
                  disabled={saving || !company}
                  className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                    state.offlineDiscount ? "bg-green-600" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      state.offlineDiscount ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {(problem || error) && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error || problem}</span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !company || !dirty || Boolean(problem)}
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
