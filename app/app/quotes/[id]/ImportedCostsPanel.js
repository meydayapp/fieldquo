// app/app/quotes/[id]/ImportedCostsPanel.js
//
// Importer (GC) side, on the GC's own quote detail. Lists the subcontractor
// quotes pulled INTO this quote as costs — the sub's price, the markup, the
// resulting client price — grouped by trade, so several subs quoting the same
// work sit SIDE BY SIDE with their insurance and WSIB/WCB clearance from the
// GC's own roster. The owner, 2026-10-05: "the contractor should be able to
// select the one they want to work with, add it to their quote, and it would
// be pending until their client approves it."
//
// What each price can do depends on where it stands (the server says, per
// row — lib/quotes/importOptions.js importPlacement):
//
//   On your quote    a line on the client's quote. Markup and remove while
//                    the quote is open, as before.
//   Option           held to compare; the client never sees it. "Use this
//                    one" puts it on an open quote (swapping out the trade's
//                    current line), or — on an approved quote — "Offer as
//                    extra work" raises a pending change order the client
//                    signs. Markup and remove on any quote.
//   On CO-n          carried by a change order. Its price is the client's
//                    now; nothing here changes it — withdraw the change
//                    order on the list below to free it.
//
// Every button posts an id. No figure leaves the browser: the client price
// shown while editing is a preview, and the server reprices from its rows.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Trash2, Loader2, Clock, CheckCircle2, MinusCircle, Pencil, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { hasLevel, hasToggle } from "@/lib/permissions/enforce";

const STATUS = {
  pending: { key: "app.quoteImports.pending", Icon: Clock, cls: "text-amber-600 dark:text-amber-400" },
  confirmed: { key: "app.quoteImports.confirmed", Icon: CheckCircle2, cls: "text-green-600 dark:text-green-400" },
  cancelled: { key: "app.quoteImports.cancelled", Icon: MinusCircle, cls: "text-muted-foreground" },
};

const MARKUP_PRESETS = [0, 10, 20, 30];

const CO_STATUS_KEY = {
  pending: "app.importedCosts.coNotSent",
  waiting_client: "app.importedCosts.coWaiting",
  approved: "app.importedCosts.coApproved",
};

export default function ImportedCostsPanel({ quoteId, currency, onTotalChange, onChanged, refreshKey = 0 }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  // Both routes behind the markup and remove buttons require
  // quotes:view_create_edit; "Use this one" also showPricing (and, on an
  // approved quote, the jobs level — the route checks; a refusal is shown).
  const caller = usePermissions();
  const canEditQuote = hasLevel(caller, "quotes", "view_create_edit");
  const canChoose = canEditQuote && hasToggle(caller, "showPricing");
  const [rows, setRows] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Inline markup editing. The received cost is fixed; only this moves.
  const [editingId, setEditingId] = useState("");
  const [mk, setMk] = useState(0);
  const [savingMk, setSavingMk] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/quotes/${quoteId}/imports`);
      const d = r.ok ? await r.json() : null;
      setRows(d?.asImporter || []);
      setCtx(d?.quoteContext || null);
    } catch {
      setRows([]);
    }
  }, [quoteId]);

  // refreshKey: bumped by the page when a price arrives from elsewhere — a
  // sub's emailed price added on the price-requests panel.
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!rows || rows.length === 0) return null;

  const money = (n) => formatMoney(n, currency);
  const open = ["draft", "sent"].includes(ctx?.status);
  const approvedWithJob = ctx?.status === "accepted" && ctx?.hasJob;

  // Grouped by trade (the server's comparison key), in the order they came.
  const groups = [];
  const byKey = new Map();
  for (const r of rows) {
    const key = r.comparisonKey || r.id;
    if (!byKey.has(key)) {
      const g = { key, label: r.label, rows: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    byKey.get(key).rows.push(r);
  }
  const competing = groups.some((g) => g.rows.length > 1);

  async function remove(importId) {
    if (busy) return;
    setBusy(importId);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/imports/${importId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.importedCosts.removeFailed"));
      setRows((prev) => prev.filter((r) => r.id !== importId));
      if (typeof onTotalChange === "function" && data?.targetTotal != null) onTotalChange(data.targetTotal);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function choose(r) {
    if (busy) return;
    setBusy(r.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/imports/${r.id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.importedCosts.selectFailed"));
      if (typeof onTotalChange === "function" && data?.targetTotal != null) onTotalChange(data.targetTotal);
      if (data?.changeOrder?.label) setNotice(t("app.importedCosts.offerExtraDone", { co: data.changeOrder.label }));
      await load();
      // The quote's lines (open quote) or its change orders (approved) moved.
      if (typeof onChanged === "function") await onChanged(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  function startEdit(r) {
    setError("");
    setEditingId(r.id);
    setMk(Math.round(Number(r.markupPercent) || 0));
  }

  async function saveMarkup(r) {
    if (savingMk) return;
    setSavingMk(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/imports/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markupPercent: Math.max(0, Number(mk) || 0) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.importedCosts.markupFailed"));
      setRows((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, markupPercent: data.markupPercent, clientPrice: data.clientPrice } : x)),
      );
      if (typeof onTotalChange === "function" && data?.targetTotal != null) onTotalChange(data.targetTotal);
      setEditingId("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingMk(false);
    }
  }

  // What this row may do, from where it stands. A control is drawn only when
  // the route behind it will accept it.
  function controls(r, group) {
    const option = r.placement === "option";
    const line = r.placement === "line";
    const lineInGroup = group.rows.some((x) => x.placement === "line");
    return {
      editMarkup: canEditQuote && !r.costHidden && ((line && open) || option),
      remove: canEditQuote && ((line && open) || option),
      use: canChoose && option && open,
      useLabel: lineInGroup ? t("app.importedCosts.useInstead") : t("app.importedCosts.useThis"),
      offer: canChoose && option && approvedWithJob,
    };
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t("app.importedCosts.title")}</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {competing || rows.some((r) => r.placement === "option")
          ? t("app.importedCosts.compareHint")
          : t("app.importedCosts.subtitle")}
      </p>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-2">{notice}</p>}

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            {groups.length > 1 || g.rows.length > 1 ? (
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">{g.label}</p>
            ) : null}
            <ul className={`grid gap-2 ${g.rows.length > 1 ? "sm:grid-cols-2 xl:grid-cols-3" : ""}`}>
              {g.rows.map((r) => {
                const s = STATUS[r.status] || STATUS.pending;
                const { Icon } = s;
                const isEditing = editingId === r.id;
                const can = controls(r, g);
                const previewPrice = Math.round(Number(r.costAmount) * (1 + Math.max(0, Number(mk) || 0) / 100) * 100) / 100;
                return (
                  <li
                    key={r.id}
                    className={`rounded-lg border px-3 py-2.5 ${r.placement === "option" ? "border-dashed border-border" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {/* The sub's name: the GC's own screen, never a client's. */}
                        <p className="text-sm font-medium text-foreground truncate">{r.sourceCompanyName || r.label || "—"}</p>
                        {r.sourceCompanyName && r.label && g.rows.length === 1 && groups.length === 1 && (
                          <p className="text-xs text-muted-foreground truncate">{r.label}</p>
                        )}
                        {/* A price the sub typed into a price request's reply
                            form — no FieldQuo quote behind it. */}
                        {r.viaReply && (
                          <p className="text-[11px] text-muted-foreground">{t("app.importedCosts.viaReply")}</p>
                        )}
                        {/* Cost and markup only for a reader with jobCosting — the
                            server withholds them otherwise (costHidden) and the
                            client price stands alone. */}
                        <p className="text-xs text-muted-foreground">
                          {!r.costHidden && (
                            <>
                              {money(r.costAmount)} + {Math.round(r.markupPercent)}% ={" "}
                            </>
                          )}
                          <span className="font-medium text-foreground">{money(r.clientPrice)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.cls}`}>
                          <Icon size={13} />
                          {t(s.key)}
                        </span>
                        {can.editMarkup && !isEditing && (
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            aria-label={t("app.importedCosts.editMarkup")}
                            className="p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {can.remove && !isEditing && (
                          <button
                            type="button"
                            onClick={() => remove(r.id)}
                            disabled={busy === r.id}
                            aria-label={t("app.importedCosts.remove")}
                            className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                          >
                            {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Where it stands, in words. */}
                    <p className="text-xs mt-1.5">
                      {r.placement === "line" && (
                        <span className="font-medium text-foreground">{t("app.importedCosts.onQuote")}</span>
                      )}
                      {r.placement === "option" && (
                        <span className="text-muted-foreground">{t("app.importedCosts.option")}</span>
                      )}
                      {r.placement === "change_order" && r.changeOrder && (
                        <span className="font-medium text-foreground">
                          {t("app.importedCosts.onChangeOrder", { co: r.changeOrder.label })}
                          {CO_STATUS_KEY[r.changeOrder.status] ? ` · ${t(CO_STATUS_KEY[r.changeOrder.status])}` : ""}
                        </span>
                      )}
                    </p>

                    <Credentials r={r} t={t} formatDate={formatDate} />

                    {(can.use || can.offer) && !isEditing && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => choose(r)}
                          disabled={Boolean(busy)}
                          className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                        >
                          {busy === r.id && <Loader2 size={12} className="animate-spin" />}
                          {can.offer ? t("app.importedCosts.offerExtra") : can.useLabel}
                        </button>
                        {can.offer && (
                          <p className="text-[11px] text-muted-foreground mt-1">{t("app.importedCosts.offerExtraHint")}</p>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{t("app.importedCosts.editMarkup")}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {MARKUP_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setMk(p)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                Number(mk) === p
                                  ? "bg-inverted text-inverted-foreground border-transparent"
                                  : "border-border text-foreground"
                              }`}
                            >
                              {p}%
                            </button>
                          ))}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={mk}
                              onChange={(e) => setMk(e.target.value)}
                              className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="text-xs text-muted-foreground">
                            {money(r.costAmount)} → <span className="font-semibold text-foreground">{money(previewPrice)}</span>
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingId("")}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-foreground"
                            >
                              {t("app.action.cancel")}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveMarkup(r)}
                              disabled={savingMk}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                              {savingMk && <Loader2 size={12} className="animate-spin" />}
                              {t("app.action.save")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// Insurance and WSIB/WCB clearance, from the GC's own roster row for this
// sub. "Not recorded" is said as such — never as expired, never as fine.
function Credentials({ r, t, formatDate }) {
  const c = r.credentials;
  if (!c) return null;
  if (!c.onRoster) {
    return (
      <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
        <ShieldQuestion size={12} />
        {t("app.importedCosts.notOnRoster")}
      </p>
    );
  }
  const line = (what, cred) => {
    const date = cred?.endsAt ? formatDate(cred.endsAt) : "";
    switch (cred?.state) {
      case "ok":
        return { cls: "text-muted-foreground", Icon: ShieldCheck, text: t("app.importedCosts.credOk", { what, date }) };
      case "due_soon":
        return { cls: "text-amber-700 dark:text-amber-400", Icon: ShieldAlert, text: t("app.importedCosts.credSoon", { what, date }) };
      case "expired":
        return { cls: "text-red-700 dark:text-red-400", Icon: ShieldAlert, text: t("app.importedCosts.credExpired", { what, date }) };
      default:
        return { cls: "text-muted-foreground", Icon: ShieldQuestion, text: t("app.importedCosts.credUnknown", { what }) };
    }
  };
  const items = [line(t("app.subcontractors.insurance"), c.insurance), line(t("app.importedCosts.clearance"), c.clearance)];
  return (
    <div className="mt-1 space-y-0.5">
      {items.map((it, i) => (
        <p key={i} className={`text-[11px] inline-flex items-center gap-1 mr-3 ${it.cls}`}>
          <it.Icon size={12} />
          {it.text}
        </p>
      ))}
    </div>
  );
}
