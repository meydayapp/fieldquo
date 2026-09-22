// app/components/jobs/JobMaterials.js
//
// The material list: what this job needs, grouped, with a reason per line,
// what is on the shelf, and a tick when it has been bought.
//
// INTERNAL. Nothing here reaches the client — it is the yard's list, not the
// quote.
//
// ── Two builders, one list ──────────────────────────────────────────────────
//
// "Rebuild from the quote" derives the paint, the bundles and the cubic yards
// from the takeoff with the company's own rates. Free, and what it has always
// done. "Build the material list" asks FieldQuo AI for the COMPLETE list —
// the tape, the plastic, the caulk, the sanding sponges — grouped Primary ·
// Sundries · Consumables · Fasteners · Transitions, with one line of
// reasoning each and compared against stock. It costs AI credit each run and
// the banner says so, with the price and the balance, before the button is
// pressed (lib/materials/build.js, app/api/jobs/[id]/materials/build).
//
// Both keep bought lines, hand-added lines and lines somebody removed. The
// takeoff's own quantities are never overruled by the model.
//
// ── The tick is the point, the receipt is optional ──────────────────────────
//
// Someone standing in a supply yard with one hand free ticks a box. Asking for
// a price and a supplier before the tick will register is how a list like this
// stops being used by the second job. So the checkbox commits on its own, and
// the cost and supplier are an expansion beside it for whoever does the
// paperwork afterwards.
//
// A price entered on the tick is not decoration: it writes into the company's
// own MaterialPriceEntry history, which is how the unit costs the price books
// ship UNSET get filled in with real numbers instead of guesses.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Check, Loader2, Plus, Printer, RefreshCw, ShoppingCart, Sparkles, Trash2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchJson } from "@/lib/fetchJson";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import ReceiptScanner from "@/app/components/purchasing/ReceiptScanner";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatAppMoney } from "@/lib/format/money";
import { formatShortDate, formatTimeOfDay } from "@/lib/format/localeDate";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { MATERIAL_LIST_CENTS } from "@/lib/ai/imageEconomics";
import { MATERIAL_GROUP_LABEL_KEYS, groupRows } from "@/lib/materials/list";
import { PURCHASING_CATEGORY, PURCHASING_LEVEL } from "@/lib/purchasing/access";
import { AiCreditTopupDialog, useAiCreditTopup } from "@/app/components/ai/AiCreditTopupDialog";

const inputClass =
  "w-full border border-border rounded px-2 py-1 text-sm bg-background";

// The empty draft for a tick. `actualQty` is pre-filled from the estimate
// when a line is opened, and `actualQtyTyped` records whether a person has
// actually edited it — a pre-fill is not a statement, and the receipt scanner
// needs to know the difference (see existingFromDraft in ReceiptScanner).
const EMPTY_DRAFT = { actualCost: "", supplier: "", actualQty: "", actualQtyTyped: false };

const GROUP_FALLBACK = {
  primary: "Primary",
  sundries: "Sundries",
  consumables: "Consumables",
  fasteners: "Fasteners / adhesives",
  transitions: "Transitions / trim",
  other: "Other",
};

export default function JobMaterials({ jobId }) {
  const money = useCompanyMoney();
  const { t, language } = useTranslation();
  // The same question the route asks, asked of the same grid. Every write here
  // needs jobs:view_create_edit, and without this every viewer got a page full
  // of checkboxes that 403 on the first tap — a control that appears to work
  // and doesn't, which is the one rule this codebase is swept for.
  //
  // Reading the list is deliberately NOT gated beyond seeing the job: a crew
  // member who can open the job should be able to see what was meant to be
  // bought for it.
  const caller = usePermissions();
  const canEdit = hasLevel(caller, "jobs", "view_create_edit");
  // Putting lines on a purchase order is purchasing, and the shopping-list
  // route asks purchasing's level; the link is only drawn for someone it
  // would answer.
  const canOrder = hasLevel(caller, PURCHASING_CATEGORY, PURCHASING_LEVEL);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // A bought line whose used quantity is being recorded after the fact:
  // { id, value }. The close-out asks for this when it is missing.
  const [usedEdit, setUsedEdit] = useState(null);
  // An AI or hand-added line whose NEED is being corrected: { id, value }.
  const [qtyEdit, setQtyEdit] = useState(null);
  // Which line's receipt scanner is open. One at a time, and only inside the
  // expansion that already asks for a cost — the scan exists to fill in those
  // two boxes, so it belongs where they are rather than as a separate screen.
  const [scanning, setScanning] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newLine, setNewLine] = useState({ name: "", qty: 1, unit: "each" });
  const [error, setError] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildNote, setBuildNote] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderNote, setOrderNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/materials`);
      if (!res.ok) {
        // A job with no materials is not an error; a 404 here means the job
        // itself is gone, and the panel says nothing rather than shouting.
        setData({ materials: [], progress: null });
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  // The 402 with an offer opens the top-up dialog rather than printing a
  // shortfall at somebody who cannot act on it — the same path the deep photo
  // read takes. Nothing is re-run on the way back: spending on arrival is a
  // charge nobody pressed a button for.
  const topup = useAiCreditTopup({
    pendingKey: "job.materialList",
    onCredited: () => {
      setBuildNote("");
      load();
    },
  });

  async function send(method, body, query = "") {
    setError("");
    const res = await fetch(`/api/jobs/${jobId}/materials${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      // Was the failure mode this codebase gets swept for: a tick that looked
      // like it worked, reverted on reload.
      await reportResponseError(res).catch(() => {});
      setError(t("app.jobMaterials.saveFailed", "That didn't save. Try again."));
      return null;
    }
    const next = await res.json();
    // A write answers with the list and no wallet verdict; keep the one we have.
    setData((d) => ({ ...next, spend: next.spend || d?.spend || null }));
    return next;
  }

  async function build() {
    setBuildNote("");
    setError("");
    setBuilding(true);
    try {
      const result = await fetchJson(`/api/jobs/${jobId}/materials/build`, { method: "POST" });
      await load();
      const b = result?.build || {};
      setBuildNote(
        t("app.materialList.built", "Built: {created} lines added, {overruled} quantities kept at the takeoff's figure, {refused} rows refused.", {
          created: b.created ?? 0,
          overruled: b.overruled ?? 0,
          refused: b.refused ?? 0,
        }),
      );
      if (result?.spend) setData((d) => (d ? { ...d, spend: result.spend } : d));
    } catch (err) {
      if (err.status === 402 && err.data?.topup) {
        topup.open(err.data);
        return;
      }
      setError(err.message);
    } finally {
      setBuilding(false);
    }
  }

  async function addToShoppingList(materialIds) {
    setOrderNote("");
    setError("");
    setOrdering(true);
    try {
      const result = await fetchJson(`/api/jobs/${jobId}/materials/shopping-list`, {
        method: "POST",
        body: materialIds ? { materialIds } : {},
      });
      const number = result?.order?.number || "";
      setOrderNote(
        result?.appended
          ? t("app.materialList.appendedToPo", "{added} added to draft {number} — price and send it on the Purchasing page.", { added: result.added, number })
          : t("app.materialList.raisedPo", "Draft {number} raised with {added} lines — price and send it on the Purchasing page.", { added: result.added, number }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setOrdering(false);
    }
  }

  // Opening a line's tick pre-fills "how many did you use" with the
  // estimate. Editable, and sent only as what the box says when the tick is
  // confirmed — so a person who never looks at it records the estimate as
  // the actual, which is the honest reading of "I bought what the list said".
  function open(m) {
    setDraft({ ...EMPTY_DRAFT, actualQty: String(m.qty ?? "") });
    setExpanded(m.id);
  }

  async function toggle(m) {
    setBusyId(m.id);
    try {
      if (m.purchasedAt) {
        await send("PATCH", { materialId: m.id, purchased: false });
        setExpanded(null);
      } else {
        const qty = Number(draft.actualQty);
        await send("PATCH", {
          materialId: m.id,
          purchased: true,
          actualCost: draft.actualCost === "" ? null : Number(draft.actualCost),
          supplier: draft.supplier,
          actualQty:
            draft.actualQty === "" || !Number.isFinite(qty) ? null : qty,
        });
        setDraft(EMPTY_DRAFT);
        setExpanded(null);
        setScanning(null);
      }
    } finally {
      setBusyId(null);
    }
  }

  // Recording the used quantity on a line that is already bought. A PATCH
  // without `purchased` leaves the receipt fields alone — see the route.
  async function saveUsed(m) {
    const qty = Number(usedEdit?.value);
    if (!Number.isFinite(qty) || qty < 0) {
      setError(t("app.jobMaterials.usedInvalid", "Enter how many were used as a number."));
      return;
    }
    setBusyId(m.id);
    try {
      const ok = await send("PATCH", { materialId: m.id, actualQty: qty });
      if (ok) setUsedEdit(null);
    } finally {
      setBusyId(null);
    }
  }

  // Correcting the NEED on an AI or hand-added line. The route refuses it on
  // a takeoff line (that quantity is the recipe's prediction), so the box is
  // only offered where it would save.
  async function saveQty(m) {
    const qty = Number(qtyEdit?.value);
    if (!Number.isFinite(qty) || qty < 0) {
      setError(t("app.materialList.qtyInvalid", "Enter how many are needed as a number."));
      return;
    }
    setBusyId(m.id);
    try {
      const ok = await send("PATCH", { materialId: m.id, qty });
      if (ok) setQtyEdit(null);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const materials = data?.materials || [];
  const p = data?.progress;
  const built = data?.built;
  const spend = data?.spend;
  const groups = groupRows(materials);
  const shortCount = materials.filter((m) => m.status === "short" && !m.purchasedAt).length;
  const price = formatAppMoney(MATERIAL_LIST_CENTS / 100, CREDIT_CURRENCY, language);
  const balance = spend ? formatAppMoney((spend.balanceCents || 0) / 100, CREDIT_CURRENCY, language) : null;

  return (
    <div id="job-materials" className="bg-card border border-border rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.jobMaterials.title", "Materials to buy")}
          {p?.total > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {t("app.materialList.summary", "{total} lines · {bought} bought · {short} short in stock", {
                total: p.total,
                bought: p.bought,
                short: shortCount,
              })}
            </span>
          )}
        </h2>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => send("POST", { regenerate: true })}
              className="flex items-center gap-1 rounded border border-transparent px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw size={12} />
              {t("app.jobMaterials.rebuild", "Rebuild from the quote")}
            </button>
            <button
              type="button"
              onClick={build}
              disabled={building}
              data-material-list-build
              className="flex items-center gap-1 rounded bg-brand-accent px-2.5 py-1 text-xs font-semibold text-brand-accent-foreground disabled:opacity-60"
            >
              {building ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {building
                ? t("app.materialList.building", "Building…")
                : t("app.materialList.build", "Build the material list")}
            </button>
          </div>
        )}
      </div>

      {/* The banner: what the build reads, which model, what it costs, what
          the balance is, when it last ran and by whom. Every figure is read
          back — the price from the one constant, the balance from the wallet,
          the model from the job row the build wrote. Mirrors the deep photo
          read's wording so the two paid features read as one product. */}
      {canEdit && (
        <div className="mt-3 border border-border border-l-[3px] border-l-brand-accent bg-muted px-3 py-2 text-xs text-muted-foreground">
          <b className="text-foreground">{t("app.materialList.bannerWho", "FieldQuo AI")}</b>{" "}
          {t("app.materialList.bannerWhat", "reads the approved lines, the takeoff, your Material Costs rates and what is on the shelf, and lists everything the job consumes — grouped, with a reason per line.")}{" "}
          {built?.model && (
            <>
              {t("app.materialList.bannerModel", "Model:")} <b className="text-foreground">{built.model}</b> ·{" "}
            </>
          )}
          {t("app.materialList.bannerCost", "Costs {price} of AI credit each time it runs, separate from your phone balance.", { price })}
          {balance && (
            <>
              {" "}
              {t("app.materialList.bannerBalance", "Balance {balance}.", { balance })}
            </>
          )}
          {built?.at && (
            <>
              {" "}
              {t("app.materialList.bannerLast", "Last built {date} {time}{by}.", {
                date: formatShortDate(built.at, language),
                time: formatTimeOfDay(built.at, language),
                by: built.by ? ` ${t("app.materialList.bannerBy", "by {name}", { name: built.by })}` : "",
              })}
            </>
          )}{" "}
          {t("app.materialList.bannerCheck", "Quantities are estimates — check them before you order.")}
        </div>
      )}
      {buildNote && <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">{buildNote}</p>}

      {materials.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {canEdit
            ? t("app.materialList.emptyEdit", "Nothing here yet. Build the material list for the complete list — the paint from your rates plus the tape, plastic, caulk and sundries — or Rebuild from the quote for the takeoff's own lines, or add a line by hand.")
            : t("app.jobMaterials.emptyView", "Nothing here yet. Whoever priced this job can build the list from the quote.")}
        </p>
      ) : (
        <div className="mt-3">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="mt-2 bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(MATERIAL_GROUP_LABEL_KEYS[g.group], GROUP_FALLBACK[g.group])}
              </div>
              <ul className="divide-y divide-border">
                {g.rows.map((m) => (
                  <MaterialRow
                    key={m.id}
                    m={m}
                    t={t}
                    money={money}
                    canEdit={canEdit}
                    canOrder={canOrder}
                    busy={busyId === m.id}
                    isOpen={expanded === m.id}
                    draft={draft}
                    setDraft={setDraft}
                    usedEdit={usedEdit}
                    setUsedEdit={setUsedEdit}
                    qtyEdit={qtyEdit}
                    setQtyEdit={setQtyEdit}
                    scanning={scanning}
                    setScanning={setScanning}
                    onOpen={() => open(m)}
                    onToggle={() => toggle(m)}
                    onCancel={() => {
                      setExpanded(null);
                      setScanning(null);
                    }}
                    onSaveUsed={() => saveUsed(m)}
                    onSaveQty={() => saveQty(m)}
                    onRemove={() => send("DELETE", null, `?materialId=${encodeURIComponent(m.id)}`)}
                    onShop={() => addToShoppingList([m.id])}
                    ordering={ordering}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* `costHidden` means the server removed the two money totals. Rendering
          the block anyway would print "Estimated $0.00" — money(undefined) is
          $0.00 — which claims the job's materials cost nothing. A withheld
          figure and a zero are different statements, and the zero is the more
          dangerous of the two. */}
      {p?.total > 0 && !p.costHidden && (
        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>{t("app.jobMaterials.estimated", "Estimated")}</span>
            <span className="tabular-nums">{money(p.estimatedTotal)}</span>
          </div>
          {p.actualTotal > 0 && (
            <div className="flex justify-between text-foreground">
              <span>{t("app.jobMaterials.actualSoFar", "Actually paid, so far")}</span>
              <span className="tabular-nums">{money(p.actualTotal)}</span>
            </div>
          )}
          {p.unpriced > 0 && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              {t("app.materialList.unpriced", "{count} lines have no price, so the estimate above is an understatement. Enter what you pay as you tick them off and it builds your own price history.", { count: p.unpriced })}
            </p>
          )}
        </div>
      )}

      {/* The foot: what is short, and the things to do about the list.
          "Send to supplier" is deliberately absent — there is no supplier
          email path in the product yet, and a button that set a status and
          emailed nobody is the first example in AGENTS.md. */}
      {materials.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {shortCount > 0
              ? t("app.materialList.shortNote", "Shopping list: {count} lines short. Lines you remove stay removed on the next build.", { count: shortCount })
              : t("app.materialList.nothingShort", "Nothing tracked is short. Lines you remove stay removed on the next build.")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && !adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-semibold text-foreground min-h-[36px]"
              >
                <Plus size={13} /> {t("app.jobMaterials.addLine", "Add a line")}
              </button>
            )}
            <a
              href={`/api/jobs/${jobId}/materials/print`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-semibold text-foreground min-h-[36px]"
            >
              <Printer size={13} /> {t("app.materialList.print", "Print list")}
            </a>
            {canOrder && shortCount > 0 && (
              <button
                type="button"
                onClick={() => addToShoppingList(null)}
                disabled={ordering}
                className="flex items-center gap-1 rounded bg-foreground px-2.5 py-1 text-xs font-semibold text-background disabled:opacity-60 min-h-[36px]"
              >
                {ordering ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
                {t("app.materialList.addAllShort", "Add short lines to shopping list")}
              </button>
            )}
          </div>
        </div>
      )}
      {orderNote && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          {orderNote}{" "}
          <Link href="/app/purchasing" className="underline">
            {t("app.materialList.openPurchasing", "Open Purchasing")}
          </Link>
        </p>
      )}

      {adding && canEdit && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newLine.name.trim()) return;
            const ok = await send("POST", newLine);
            if (ok) {
              setNewLine({ name: "", qty: 1, unit: "each" });
              setAdding(false);
            }
          }}
        >
          <input
            autoFocus
            value={newLine.name}
            onChange={(e) =>
              setNewLine((n) => ({ ...n, name: e.target.value }))
            }
            placeholder={t("app.jobMaterials.addPlaceholder", "What else does this job need?")}
            className={`${inputClass} flex-1 min-w-[12rem]`}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newLine.qty}
            onChange={(e) => setNewLine((n) => ({ ...n, qty: e.target.value }))}
            className={`${inputClass} w-20`}
          />
          <input
            value={newLine.unit}
            onChange={(e) =>
              setNewLine((n) => ({ ...n, unit: e.target.value }))
            }
            className={`${inputClass} w-24`}
          />
          <button
            type="submit"
            className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background"
          >
            {t("app.action.add", "Add")}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("app.action.cancel", "Cancel")}
          </button>
        </form>
      )}

      {/* The crew's way in to purchasing: a request from the field for this
          job, on their phone — see app/app/me/supplies. Offered to everyone
          who can see the job; the request route scopes to assigned jobs. */}
      <p className="mt-3 text-xs text-muted-foreground">
        <Link href={`/app/me/supplies?jobId=${encodeURIComponent(jobId)}`} className="underline">
          {t("app.supplies.requestFromJob", "Short of something on site? Request a supply")}
        </Link>
      </p>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <AiCreditTopupDialog {...topup.dialogProps} />
    </div>
  );
}

function StatusPill({ m, t }) {
  if (m.purchasedAt) return null;
  if (m.status === "short") {
    return (
      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        {t("app.materialList.short", "Short {n}", { n: m.short })}
      </span>
    );
  }
  if (m.status === "covered") {
    return (
      <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        {t("app.materialList.covered", "Covered")}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {t("app.materialList.untracked", "Not tracked")}
    </span>
  );
}

function MaterialRow({
  m, t, money, canEdit, canOrder, busy, isOpen, draft, setDraft, usedEdit, setUsedEdit,
  qtyEdit, setQtyEdit, scanning, setScanning, onOpen, onToggle, onCancel, onSaveUsed,
  onSaveQty, onRemove, onShop, ordering,
}) {
  const bought = Boolean(m.purchasedAt);
  const qtyEditable = canEdit && !bought && (m.addedByHand || m.source === "ai");
  return (
    <li className="py-2">
      <div className="flex items-start gap-2.5">
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => (bought || isOpen ? onToggle() : onOpen())}
            aria-label={
              bought
                ? t("app.jobMaterials.markNotBought", "Mark {name} as not bought", { name: m.name })
                : t("app.jobMaterials.markBought", "Mark {name} as bought", { name: m.name })
            }
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
              bought
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-border hover:border-foreground/40"
            } disabled:opacity-50`}
          >
            {bought && <Check size={13} strokeWidth={3} />}
          </button>
        ) : (
          <span
            role="img"
            aria-label={bought ? t("app.jobMaterials.bought", "Bought") : t("app.jobMaterials.notBought", "Not bought yet")}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
              bought
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-border"
            }`}
          >
            {bought && <Check size={13} strokeWidth={3} />}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className={`text-sm ${bought ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {m.name}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-xs">
              {/* Need · unit · waste. The need is editable on an AI or
                  hand-added line (dotted underline), fixed on a takeoff
                  line whose quantity is the recipe's prediction. */}
              {qtyEditable && qtyEdit?.id === m.id ? (
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={qtyEdit.value}
                    onChange={(e) => setQtyEdit({ id: m.id, value: e.target.value })}
                    className={`${inputClass} w-20`}
                  />
                  <span className="text-muted-foreground">{m.unit}</span>
                  <button type="button" onClick={onSaveQty} disabled={busy} className="rounded bg-foreground px-2 py-1 text-[11px] font-medium text-background disabled:opacity-50">
                    {t("app.action.save", "Save")}
                  </button>
                  <button type="button" onClick={() => setQtyEdit(null)} className="px-1 text-[11px] text-muted-foreground">
                    {t("app.action.cancel", "Cancel")}
                  </button>
                </span>
              ) : (
                <span className="tabular-nums text-foreground">
                  {qtyEditable ? (
                    <button
                      type="button"
                      onClick={() => setQtyEdit({ id: m.id, value: String(m.qty ?? "") })}
                      className="border-b border-dashed border-muted-foreground"
                      title={t("app.materialList.editQty", "Change how many are needed")}
                    >
                      {m.qty}
                    </button>
                  ) : (
                    m.qty
                  )}{" "}
                  <span className="text-muted-foreground">{m.unit}</span>
                </span>
              )}
              {m.wastePct != null && m.wastePct > 0 && (
                <span className="text-muted-foreground" title={t("app.materialList.wasteTitle", "Waste allowance already inside the quantity")}>
                  +{m.wastePct}%
                </span>
              )}
              {m.status !== "untracked" && !bought && (
                <span className="tabular-nums text-muted-foreground" title={t("app.materialList.onHandTitle", "On hand, summed from stock movements")}>
                  {t("app.materialList.onHand", "{n} on hand", { n: m.onHand })}
                </span>
              )}
              <StatusPill m={m} t={t} />
              {canOrder && !bought && m.status === "short" && (
                <button type="button" onClick={onShop} disabled={ordering} className="underline text-foreground disabled:opacity-50">
                  {t("app.materialList.addToShopping", "Add to shopping list")}
                </button>
              )}
              <span className="shrink-0 tabular-nums">
                {/* Costs stripped by the server for a member without the
                    jobCosting toggle. Deliberately NOT the "no price set"
                    branch below: that one is a prompt to go and fill the
                    price in, and telling a crew member to price a line they
                    are not allowed to see is the absence-vs-restriction
                    confusion in its most actively misleading form. */}
                {m.costHidden ? (
                  <span className="text-muted-foreground">—</span>
                ) : bought && m.actualCost != null ? (
                  <span className="text-foreground">{money(m.actualCost)}</span>
                ) : m.estUnitCost != null ? (
                  <span className="text-muted-foreground">
                    {t("app.jobMaterials.est", "est {amount}", { amount: money(m.estUnitCost * m.qty) })}
                  </span>
                ) : (
                  // Not "$0.00". Nobody has priced this, and a zero would
                  // read as free.
                  <span className="text-amber-700 dark:text-amber-400">
                    {t("app.jobMaterials.noPrice", "no price set")}
                  </span>
                )}
              </span>
            </span>
          </div>
          {m.reason && (
            <p className="text-[11.5px] text-muted-foreground">{m.reason}</p>
          )}
          {bought && m.supplier && (
            <p className="text-xs text-muted-foreground">{m.supplier}</p>
          )}

          {/* What was actually used, once bought. Shown when known;
              otherwise an offer to record it, because the close-out
              cannot compare a rate against a blank. Never defaulted
              to the estimate on display — "not recorded" and "used
              exactly the estimate" are different facts. */}
          {bought && usedEdit?.id !== m.id && (
            <p className="text-xs text-muted-foreground">
              {m.actualQty != null
                ? t("app.jobMaterials.used", "Used {qty} {unit}", { qty: m.actualQty, unit: m.unit })
                : t("app.jobMaterials.usedUnknown", "How many were used isn't recorded.")}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setUsedEdit({ id: m.id, value: String(m.actualQty ?? m.qty ?? "") })}
                  className="ml-2 underline min-h-[44px]"
                >
                  {m.actualQty != null
                    ? t("app.jobMaterials.usedEdit", "Change")
                    : t("app.jobMaterials.usedRecord", "Record it")}
                </button>
              )}
            </p>
          )}
          {bought && canEdit && usedEdit?.id === m.id && (
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted-foreground">
                {t("app.jobMaterials.usedLabel", "How many did you actually use?")}
                <span className="ml-1">({m.unit})</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={usedEdit.value}
                  onChange={(e) => setUsedEdit({ id: m.id, value: e.target.value })}
                  className={`${inputClass} mt-0.5 w-28`}
                />
              </label>
              <button
                type="button"
                onClick={onSaveUsed}
                disabled={busy}
                className="rounded bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50 min-h-[44px]"
              >
                {t("app.action.save", "Save")}
              </button>
              <button
                type="button"
                onClick={() => setUsedEdit(null)}
                className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
            </div>
          )}

          {/* The receipt, asked for AFTER the tick is offered rather
              than before it. Skipping it still ticks the line. */}
          {isOpen && !bought && (
            <>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {/* PATCH refuses a posted actualCost without the
                    jobCosting toggle (403, not a silent drop), so
                    rendering the box would be a field that throws away
                    what you typed. Ticking the line still works, which
                    is the part of this that is crew work. */}
                {!m.costHidden && (
                  <label className="text-xs text-muted-foreground">
                    {t("app.jobMaterials.whatItCost", "What it cost")}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.actualCost}
                      onChange={(e) => setDraft((d) => ({ ...d, actualCost: e.target.value }))}
                      placeholder={t("app.jobMaterials.totalOnReceipt", "total on the receipt")}
                      className={`${inputClass} mt-0.5 w-36`}
                    />
                  </label>
                )}
                {/* Pre-filled from the estimate; a count, not money,
                    so it is offered to everyone who may tick. */}
                <label className="text-xs text-muted-foreground">
                  {t("app.jobMaterials.usedLabel", "How many did you actually use?")}
                  <span className="ml-1">({m.unit})</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={draft.actualQty}
                    onChange={(e) => setDraft((d) => ({ ...d, actualQty: e.target.value, actualQtyTyped: true }))}
                    className={`${inputClass} mt-0.5 w-28`}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  {t("app.jobMaterials.supplier", "Supplier")}
                  <input
                    value={draft.supplier}
                    onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))}
                    className={`${inputClass} mt-0.5 w-40`}
                  />
                </label>
                <button
                  type="button"
                  onClick={onToggle}
                  disabled={busy}
                  className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t("app.jobMaterials.bought", "Bought")}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("app.action.cancel", "Cancel")}
                </button>
              </div>

              {/* Offered only where a cost box is offered. The scan
                  returns money and nothing else, and the server
                  refuses it (403) for a member without the jobCosting
                  toggle — so rendering the button for them would be a
                  control that appears to work and doesn't. */}
              {!m.costHidden && scanning !== m.id && (
                <button
                  type="button"
                  onClick={() => setScanning(m.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Camera size={13} /> {t("app.jobMaterials.scanReceipt", "Scan the receipt")}
                </button>
              )}

              {!m.costHidden && scanning === m.id && (
                <ReceiptScanner
                  materialId={m.id}
                  draft={draft}
                  onClose={() => setScanning(null)}
                  onApply={({ values }) => {
                    // PREFILL, never replace: `values` already carries
                    // whatever was typed for any field a person had
                    // filled in. See lib/receipts/prefill.js.
                    setDraft((d) => ({
                      ...d,
                      actualCost: values.actualCost == null ? d.actualCost : String(values.actualCost),
                      supplier: values.supplier ?? d.supplier,
                      // A quantity read off the receipt and accepted
                      // with "Use this" is a statement from then on.
                      ...(values.actualQty != null && {
                        actualQty: String(values.actualQty),
                        actualQtyTyped: true,
                      }),
                    }));
                    setScanning(null);
                  }}
                />
              )}
            </>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("app.jobMaterials.remove", "Remove {name}", { name: m.name })}
            title={m.addedByHand ? undefined : t("app.materialList.removeTitle", "Removed lines are not offered again on the next build")}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </li>
  );
}
