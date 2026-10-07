"use client";

// app/components/planRead/ReviewPanel.js
//
// "What this price includes / Check before sending" (lib/planRead/review.js)
// and the read's material list — at the top of the price summary. Office-only:
// the estimator and the manager see it; no client document does.
//
//   included   what the price rests on, each with its basis
//   checks     at most eight things worth a person's eye, ranked by price
//              impact — each "Looks right" / "Change", recorded on the read
//              with who and when (PATCH op review_check); a check with
//              `choices` answers in one tap too (the building state priced,
//              PATCH op set_plan_state)
//   access     every access line's status, and a one-tap reason for a line
//              left out or set to $0 (PATCH op set_access_reason)
//   materials  item, quantity, unit, unit price and its source, total — the
//              quantity editable (PATCH op set_material_qty)
//
// Every figure arrives computed by the server (lib/planRead/view.js).

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Package, Pencil } from "lucide-react";

const card = "bg-card border border-border rounded-xl p-4 sm:p-5";

export function AccessReasonPicker({ accessId, reasons, onOp, t }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 mt-1">
      <span className="text-[11px] text-muted-foreground">{t("app.planRead.accessReason.ask", "Why no rental cost?")}</span>
      {reasons.map((r) => (
        <button key={r} type="button" onClick={() => onOp({ op: "set_access_reason", accessId, reason: r })} className="min-h-[32px] px-2 rounded-md border border-border text-[11px] hover:bg-accent">
          {t(`app.planRead.accessReason.${r}`, r.replace(/_/g, " "))}
        </button>
      ))}
    </span>
  );
}

export function ReviewPanel({ view, t, onOp, disabled }) {
  const rv = view.firstPass?.review;
  if (!rv) return null;
  const leftOut = (view.project?.access || []).filter((a) => a.included === false && !a.zeroReason);
  return (
    <section className={card} data-review-panel>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><ClipboardCheck className="w-4 h-4" aria-hidden />{t("app.planRead.review.title", "What this price includes")}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{t("app.planRead.review.officeOnly", "For your team only — never on the client's quote.")}</p>
      <p className="text-sm mt-2">{rv.accessSentence}</p>
      <h3 className="mt-3 text-xs font-semibold">{t("app.planRead.review.takenTitle", "Taken into account")}</h3>
      {rv.included.length === 0 && <p className="text-xs text-muted-foreground mt-1">{t("app.planRead.review.takenNone", "Nothing priced yet — the read has no quantities to rest a price on.")}</p>}
      <ul className="mt-1 space-y-1 text-sm">
        {rv.included.map((i) => (
          <li key={i.key} className="flex gap-2">
            <span className="shrink-0 w-28 text-xs font-medium text-muted-foreground">{t(`app.planRead.review.label.${i.key.split(":")[0]}`, i.label)}</span>
            <span className="min-w-0 text-xs">
              {i.text}
              {i.href ? (
                <>
                  {" "}
                  <Link href={i.href} className="underline">{t("app.planRead.review.setYours", "Set yours")}</Link>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {leftOut.map((a) => (
        <div key={a.id} className="mt-2 text-xs">
          <span className="font-medium">{`${a.label}${a.areaName ? ` — ${a.areaName}` : ""}`}</span>
          {` — ${t("app.planRead.accessReason.leftOut", "left out")}`}
          <AccessReasonPicker accessId={a.id} reasons={rv.reasons || []} onOp={onOp} t={t} />
        </div>
      ))}
      {rv.checks.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-xs font-semibold">
            {t("app.planRead.review.checkTitle", "Check before sending — {n} not reviewed", { n: rv.unreviewed })}
          </p>
          <ul className="mt-2 space-y-2">
            {rv.checks.map((c) => (
              <li key={c.key} className="text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-medium">{c.text}</span>
                    {c.why ? <span className="block text-[11px] text-muted-foreground">{t("app.planRead.review.why", "Why: {why}", { why: c.why })}</span> : null}
                    <span className="block text-[11px] text-muted-foreground">
                      {t("app.planRead.review.check", "Check: {what}", { what: c.check })}
                      {c.href ? (
                        <>
                          {" "}
                          <Link href={c.href} className="underline">{t("app.planRead.review.open", "Open")}</Link>
                        </>
                      ) : null}
                    </span>
                    {c.tick ? (
                      <span className="block text-[11px] mt-0.5">
                        {c.tick.verdict === "ok" ? t("app.planRead.review.ticked", "✓ Looks right — {who}, {when}", { who: c.tick.by || "", when: String(c.tick.at || "").slice(0, 10) }) : t("app.planRead.review.toChange", "✎ To change — {who}, {when}", { who: c.tick.by || "", when: String(c.tick.at || "").slice(0, 10) })}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap shrink-0 gap-1">
                    {(c.choices || []).map((ch) => (
                      // A check that can be answered in one tap — "Include
                      // them" re-prices the read in code (PATCH op
                      // set_plan_state), no model call.
                      <button key={`${ch.op}:${ch.value}`} type="button" disabled={disabled} onClick={() => onOp({ op: ch.op, value: ch.value })} className="min-h-[36px] px-2 rounded-md border border-border bg-background hover:bg-accent text-xs font-medium">
                        {t(`app.planRead.review.planState.${ch.value}`, ch.label)}
                      </button>
                    ))}
                    <button type="button" disabled={disabled} onClick={() => onOp({ op: "review_check", key: c.key, verdict: "ok", text: c.text })} className={`min-h-[36px] px-2 rounded-md border text-xs ${c.tick?.verdict === "ok" ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-border bg-background hover:bg-accent"}`}>
                      <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" aria-hidden />
                      {t("app.planRead.review.ok", "Looks right")}
                    </button>
                    <button type="button" disabled={disabled} onClick={() => onOp({ op: "review_check", key: c.key, verdict: "change", text: c.text })} className={`min-h-[36px] px-2 rounded-md border text-xs ${c.tick?.verdict === "change" ? "border-amber-400" : "border-border bg-background hover:bg-accent"}`}>
                      <Pencil className="inline w-3.5 h-3.5 mr-1" aria-hidden />
                      {t("app.planRead.review.change", "Change")}
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {Array.isArray(rv.more) && rv.more.length > 0 && (
            // Past the cap — lower impact, kept rather than dropped.
            <details className="mt-3">
              <summary className="text-xs cursor-pointer">{t("app.planRead.review.more", "{n} more, lower impact", { n: rv.more.length })}</summary>
              <ul className="mt-1 space-y-1">
                {rv.more.map((c) => (
                  <li key={c.key} className="text-xs">
                    <span className="font-medium">{c.text}</span>
                    {c.check ? <span className="text-muted-foreground">{` — ${c.check}`}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

/** The read's material list — paint, prep materials, sundries. */
export function MaterialsCard({ view, t, money, onOp, disabled }) {
  const m = view.draft?.materials;
  const [editing, setEditing] = useState(null);
  const [qty, setQty] = useState("");
  if (!m || !m.items?.length) return null;
  return (
    <section className={card} data-materials-card>
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Package className="w-4 h-4" aria-hidden />{t("app.planRead.materials.title", "Materials")}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{t("app.planRead.materials.note", "Worked out from the quantities: paint by coverage and coats, the conditions' prep materials, and sundries. Change a quantity if you know better.")}</p>
      <div className="overflow-x-auto -mx-4 sm:mx-0 mt-2">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 px-4 sm:px-2 font-medium">{t("app.planRead.materials.item", "Item")}</th>
              <th className="py-2 px-2 font-medium text-right">{t("app.planRead.materials.qty", "Quantity")}</th>
              {view.canSeeMoney && <th className="py-2 px-2 font-medium text-right">{t("app.planRead.materials.unitPrice", "Unit price")}</th>}
              {view.canSeeMoney && <th className="py-2 px-2 font-medium text-right">{t("app.planRead.materials.total", "Total")}</th>}
            </tr>
          </thead>
          <tbody>
            {m.items.map((i) => (
              <tr key={i.key} className="border-b border-border/60 align-top">
                <td className="py-1.5 px-4 sm:px-2">
                  {i.label}
                  {i.basis ? <span className="block text-[11px] text-muted-foreground">{i.basis}</span> : null}
                  {i.priceSource === "default" ? (
                    <span className="block text-[11px] text-amber-800 dark:text-amber-300">
                      {i.priceLabel || t("app.planRead.materials.default", "FieldQuo default price")}{" "}
                      <Link href="/app/settings/services#prep-materials" className="underline">{t("app.planRead.review.setYours", "Set yours")}</Link>
                    </span>
                  ) : i.priceLabel ? (
                    <span className="block text-[11px] text-muted-foreground">{i.priceLabel}</span>
                  ) : null}
                </td>
                <td className="py-1.5 px-2 text-right whitespace-nowrap">
                  {editing === i.key ? (
                    <span className="inline-flex items-center gap-1">
                      <input type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20 min-h-[36px] rounded-md border border-border bg-background px-2 text-right" aria-label={t("app.planRead.materials.qty", "Quantity")} />
                      <button type="button" disabled={disabled} onClick={() => { onOp({ op: "set_material_qty", key: i.key, qty: qty === "" ? null : Number(qty) }); setEditing(null); }} className="min-h-[36px] px-2 rounded-md border border-border text-xs">
                        {t("app.planRead.save", "Save")}
                      </button>
                    </span>
                  ) : (
                    <button type="button" disabled={disabled || i.key === "sundries"} onClick={() => { setEditing(i.key); setQty(String(i.qty)); }} className="underline decoration-dotted disabled:no-underline">
                      {`${i.qty} ${i.unit}`}
                    </button>
                  )}
                  {i.edited ? <span className="block text-[11px] text-muted-foreground">{t("app.planRead.materials.edited", "yours (computed {n})", { n: i.computedQty })}</span> : null}
                </td>
                {view.canSeeMoney && <td className="py-1.5 px-2 text-right">{i.unitPrice === null || i.unitPrice === undefined ? t("app.planRead.materials.noPrice", "no price") : money(i.unitPrice)}</td>}
                {view.canSeeMoney && <td className="py-1.5 px-2 text-right font-medium">{i.total === null || i.total === undefined ? "—" : money(i.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.canSeeMoney && (
        <p className="text-sm text-right mt-2 font-semibold">{t("app.planRead.materials.sum", "Materials {v}", { v: money(m.total) })}</p>
      )}
    </section>
  );
}
