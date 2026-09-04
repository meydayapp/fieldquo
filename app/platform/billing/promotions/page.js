// app/platform/billing/promotions/page.js
//
// FieldQuo's own promotional pricing: create one, scope it, switch it on, and
// see what it does to every rung of the ladder before anybody is charged.
//
// ── Why a page and not a panel on Plans ────────────────────────────────────
//
// Plans edits WHAT WE CHARGE — a permanent number, one row at a time, warned
// about because the public pricing page reads it live. A promotion is a
// temporary rule that crosses every row at once and expires on a date. They
// are different objects with different lifecycles, and the one screen where
// both were editable would be the screen where somebody changes a price
// intending to run a sale. They are linked in both directions instead.
//
// ── Every number on this page comes from priceFor() ────────────────────────
//
// Not one line of this file multiplies a price by a discount. priceFor() in
// lib/pricing/ladder.js is the only thing that knows how, it is covered by the
// seat-ladder check, and it already refuses the cases a naive renderer gets
// wrong — a 100% discount rendered as free (Stripe rejects a zero
// unit_amount), a discount larger than the price, a promotion outside its
// dates. A second implementation here would be a second set of those bugs, in
// the surface an operator uses to decide.
//
// Likewise the running/not-running question goes to promotionIsLive() via
// lib/pricing/promotionStatus.js, so the badge and the checkout cannot
// disagree about whether a discount is happening.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  AlertCircle,
  Percent,
  CreditCard,
  CalendarClock,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import {
  SEAT_LADDER,
  SUPPORTED_CURRENCIES,
  priceFor,
  currencyLabel,
} from "@/lib/pricing/ladder";
import { promotionStatus } from "@/lib/pricing/promotionStatus";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

const BLANK = {
  label: "",
  notes: "",
  discountKind: "percent",
  discountValue: "30",
  durationMonths: "3",
  startsAt: "",
  endsAt: "",
  tierKeys: [],
  currencies: [],
  active: false,
};

/** ISO → the value a datetime-local input wants, in the browser's own zone. */
function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

const TONE_BADGE = {
  positive:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  info: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900",
  warning:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  muted: "bg-muted text-muted-foreground border-border",
};

export default function PlatformPromotionsPage() {
  // null, not []. "No promotions. Plans are being sold at their full price" is
  // a statement about what customers are being charged today, and an empty
  // array printed it whenever the request failed.
  const [promotions, setPromotions] = useState(null);
  const [plans, setPlans] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // plan:manage — the same permission the promotions routes enforce, held by
  // admin and superadmin and refused for support. The editor used to be drawn
  // for everyone and the 403 arrived after Save.
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const canManage = can("plan:manage");

  // Recomputed on load rather than held in a ticking state: "is it running" is
  // answered against the moment you opened the screen, and a badge that
  // silently changes under the cursor is worse than one you refresh.
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Both, together: the promotion list is meaningless without the prices it
      // acts on, and the preview must use the rows an operator has actually
      // edited — not SEAT_LADDER's defaults, which are only what a row is
      // minted with.
      const [promos, planRows] = await Promise.all([
        fetchJson("/api/platform/billing/promotions"),
        fetchJson("/api/platform/billing/plans"),
      ]);
      setPromotions(Array.isArray(promos) ? promos : []);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setNow(new Date());
    } catch (err) {
      setError(err.message || "Couldn't load promotions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The ladder rows only. Legacy and bespoke plans carry no tierKey, and
  // promotionApplies() scopes by tierKey — so a promotion cannot reach them,
  // and showing them in a preview would promise a discount that never lands.
  const ladderPlans = useMemo(
    () =>
      plans
        .filter((p) => p.tierKey)
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(a.currency).localeCompare(String(b.currency)),
        ),
    [plans],
  );

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        label: draft.label,
        notes: draft.notes,
        discountKind: draft.discountKind,
        discountValue: draft.discountValue,
        durationMonths: draft.durationMonths,
        // A datetime-local value has no zone; new Date() reads it as local,
        // which is what the operator typed and meant.
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
        tierKeys: draft.tierKeys,
        currencies: draft.currencies,
        active: draft.active,
      };
      await fetchJson(
        draft.id
          ? `/api/platform/billing/promotions/${draft.id}`
          : "/api/platform/billing/promotions",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message || "Couldn't save the promotion.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(promo) {
    const turningOn = !promo.active;
    const status = promotionStatus(promo, now);
    if (
      turningOn &&
      status.key === "expired" &&
      !confirm(
        `"${promo.label}" ended on ${new Date(promo.endsAt).toLocaleDateString("en-CA")}. ` +
          "Switching it on will NOT start it again — the end date wins. Change " +
          "the end date instead. Turn it on anyway?",
      )
    )
      return;

    setBusyId(promo.id);
    setError("");
    try {
      await fetchJson(`/api/platform/billing/promotions/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: turningOn }),
      });
      await load();
    } catch (err) {
      setError(err.message || "Couldn't change that.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promotions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Temporary discounts on FieldQuo&apos;s own plans. Every one has an
            end date — a discount without one is a price change, and belongs on{" "}
            <Link href="/platform/billing/plans" className="underline">
              Plans
            </Link>
            .
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setDraft({ ...BLANK })}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={14} /> New promotion
          </button>
        )}
      </div>

      <PlatformWriteGate
        status={roleStatus}
        allowed={canManage}
        error={roleError}
        action="Creating, editing or switching a promotion"
        who="admins and superadmins"
      >
        {null}
      </PlatformWriteGate>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {draft && (
        <PromotionEditor
          draft={draft}
          setDraft={setDraft}
          plans={ladderPlans}
          saving={saving}
          onSave={save}
          onCancel={() => setDraft(null)}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : promotions === null ? (
        /* Never loaded. "Plans are being sold at their full price" is a claim
           about what every customer is charged today; a failed request is not
           entitled to make it. Nothing was switched off. */
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Percent size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            The promotions didn&apos;t load, so none are listed. That is not the
            same as none running — no promotion has been switched off or
            deleted. Reload the page.
          </p>
        </div>
      ) : promotions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Percent size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            No promotions. Plans are being sold at their full price.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {promotions.map((promo) => (
            <PromotionRow
              key={promo.id}
              promo={promo}
              plans={ladderPlans}
              now={now}
              busy={busyId === promo.id}
              canManage={canManage}
              onToggle={() => toggle(promo)}
              onEdit={() =>
                setDraft({
                  id: promo.id,
                  label: promo.label || "",
                  notes: promo.notes || "",
                  discountKind: promo.discountKind || "percent",
                  discountValue: String(promo.discountValue ?? ""),
                  durationMonths: String(promo.durationMonths ?? 3),
                  startsAt: toLocalInput(promo.startsAt),
                  endsAt: toLocalInput(promo.endsAt),
                  tierKeys: Array.isArray(promo.tierKeys) ? promo.tierKeys : [],
                  currencies: Array.isArray(promo.currencies)
                    ? promo.currencies
                    : [],
                  active: !!promo.active,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PromotionRow({ promo, plans, now, busy, canManage, onToggle, onEdit }) {
  const status = promotionStatus(promo, now);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{promo.label}</h3>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TONE_BADGE[status.tone]}`}
            >
              {status.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{status.detail}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {describeDiscount(promo)} for {promo.durationMonths}{" "}
            {promo.durationMonths === 1 ? "month" : "months"}, then the plan
            reverts. {describeScope(promo)}
          </p>
          {promo.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {promo.notes}
            </p>
          )}
        </div>

        {/* Read-only for support. Both controls 403, and "Switch off" in
            particular is a price change for everyone mid-promotion. */}
        {canManage && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="border border-border text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            Edit
          </button>
          <button
            onClick={onToggle}
            disabled={busy}
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 inline-flex items-center gap-2 ${
              promo.active
                ? "border border-border text-foreground hover:bg-muted"
                : "bg-inverted text-inverted-foreground"
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {promo.active ? "Switch off" : "Switch on"}
          </button>
        </div>
        )}
      </div>

      <LadderPreview
        promo={promo}
        plans={plans}
        // The row's preview answers "what is happening right now", so it uses
        // the real clock and the real switch. A row that is off, scheduled or
        // expired therefore shows every price unchanged, which is the true
        // answer — the editor below is where you preview the hypothetical.
        now={now}
        caption="What customers are charged right now"
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PromotionEditor({ draft, setDraft, plans, saving, onSave, onCancel }) {
  const set = (patch) => setDraft({ ...draft, ...patch });
  const toggleIn = (key, value) => {
    const list = draft[key] || [];
    set({
      [key]: list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    });
  };

  // ── The preview clock ────────────────────────────────────────────────────
  //
  // The editor answers a different question from the list: not "is this
  // discounting anyone today" but "what will it do while it runs". So it picks
  // a moment inside the promotion's own window and prices there, and says so
  // in the caption. Pricing at the real clock would show every unsaved draft —
  // which is switched off and not yet started — as changing nothing, which is
  // both true and useless.
  const previewMoment = useMemo(() => {
    const start = draft.startsAt ? new Date(draft.startsAt).getTime() : NaN;
    const base = Number.isFinite(start) ? Math.max(start, Date.now()) : Date.now();
    return new Date(base);
  }, [draft.startsAt]);

  const windowIsEmpty = useMemo(() => {
    const ends = draft.endsAt ? new Date(draft.endsAt).getTime() : NaN;
    return !Number.isFinite(ends) || ends <= previewMoment.getTime();
  }, [draft.endsAt, previewMoment]);

  // A copy that is switched on and dateless-in-effect, purely so priceFor can
  // be asked the hypothetical. The stored row is untouched; nothing about this
  // object is saved.
  const hypothetical = { ...draft, active: true };

  return (
    <div className="bg-card border border-inverted rounded-xl p-5 space-y-5">
      <h2 className="font-semibold text-foreground">
        {draft.id ? `Edit ${draft.label || "promotion"}` : "New promotion"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Label"
          hint="Goes on the pricing page, and it's how you'll find this row later"
        >
          <input
            value={draft.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="30% off for 3 months"
            className={inputClass}
          />
        </Field>

        <Field label="Notes" hint="Internal — why we ran it">
          <input
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="Discount">
          <div className="flex gap-2">
            <select
              value={draft.discountKind}
              onChange={(e) => set({ discountKind: e.target.value })}
              className={`${inputClass} w-32`}
            >
              <option value="percent">Percent off</option>
              <option value="amount">Amount off</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.discountValue}
              onChange={(e) => set({ discountValue: e.target.value })}
              className={inputClass}
            />
          </div>
        </Field>

        <Field
          label="Promotional months"
          hint="How long the reduced price lasts before the plan reverts. Zero would mean forever, and is refused."
        >
          <input
            type="number"
            min="1"
            value={draft.durationMonths}
            onChange={(e) => set({ durationMonths: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="Starts" hint="Blank = as soon as it's switched on">
          <input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(e) => set({ startsAt: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field
          label="Ends — required"
          hint="A discount with no end is a price. The server refuses a blank one, and refuses a date in the past on a new promotion."
        >
          <input
            type="datetime-local"
            value={draft.endsAt}
            onChange={(e) => set({ endsAt: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="Tiers" hint="None ticked = every tier">
          <div className="flex flex-wrap gap-3 pt-1">
            {SEAT_LADDER.map((t) => (
              <label
                key={t.tierKey}
                className="flex items-center gap-1.5 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={(draft.tierKeys || []).includes(t.tierKey)}
                  onChange={() => toggleIn("tierKeys", t.tierKey)}
                  className="rounded border-border accent-primary"
                />
                {t.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Currencies" hint="None ticked = every currency">
          <div className="flex flex-wrap gap-3 pt-1">
            {SUPPORTED_CURRENCIES.map((c) => (
              <label
                key={c}
                className="flex items-center gap-1.5 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={(draft.currencies || []).includes(c)}
                  onChange={() => toggleIn("currencies", c)}
                  className="rounded border-border accent-primary"
                />
                {currencyLabel(c)} {c}
              </label>
            ))}
          </div>
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={!!draft.active}
          onChange={(e) => set({ active: e.target.checked })}
          className="rounded border-border accent-primary mt-0.5"
        />
        <span>
          Switched on
          <span className="block text-xs text-muted-foreground">
            On its own this changes nothing — the dates decide. Inside the
            window and switched on is the only combination that discounts
            anybody.
          </span>
        </span>
      </label>

      {windowIsEmpty ? (
        <div className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <CalendarClock size={16} className="shrink-0 mt-0.5" />
          <span>
            No end date yet, or it lands before the start — so there is no
            window to price. Fill in an end date to see what this does.
          </span>
        </div>
      ) : (
        <LadderPreview
          promo={hypothetical}
          plans={plans}
          now={previewMoment}
          caption={`What each plan costs while this promotion is running (priced at ${previewMoment.toLocaleDateString("en-CA")})`}
        />
      )}

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !draft.label.trim() || !draft.endsAt}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Every rung, priced by priceFor(). No arithmetic in this component.
 */
function LadderPreview({ promo, plans, now, caption }) {
  if (!plans.length) {
    return (
      <div className="mt-4 border border-border rounded-lg p-4 text-sm text-muted-foreground flex items-start gap-2">
        <CreditCard size={16} className="shrink-0 mt-0.5" />
        <span>
          No ladder plans exist yet, so there is nothing to price. Run{" "}
          <code className="font-mono text-xs">npm run seed:seat-ladder</code>,
          then reload.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {caption}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm min-w-[34rem]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="font-medium py-1.5 pr-3">Plan</th>
              <th className="font-medium py-1.5 pr-3">Regular</th>
              <th className="font-medium py-1.5 pr-3">While running</th>
              <th className="font-medium py-1.5 pr-3">Saving</th>
              <th className="font-medium py-1.5">Then reverts to</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              // priceFor owns the arithmetic, the clamps and the date rules.
              // The row supplies the CURRENT price — the operator's edit, not
              // SEAT_LADDER's default — which is what customers actually pay.
              const pricing = priceFor({
                tier: { tierKey: plan.tierKey, price: plan.priceMonthly },
                currency: plan.currency,
                promotion: promo,
                now,
              });
              const sym = currencyLabel(plan.currency);
              return (
                <tr key={plan.id} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-foreground">{plan.name}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {sym}
                    {pricing.regular.toFixed(2)}
                  </td>
                  <td
                    className={`py-1.5 pr-3 font-medium ${
                      pricing.promoApplied
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {sym}
                    {pricing.now.toFixed(2)}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {pricing.promoApplied
                      ? `${sym}${pricing.saving.toFixed(2)}/mo`
                      : "—"}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {sym}
                    {pricing.revertsTo.toFixed(2)}
                    {pricing.promoApplied
                      ? ` after ${pricing.durationMonths} mo`
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function describeDiscount(promo) {
  // `Number(promo.discountValue || 0)` said "0% off" for a promotion whose
  // discount did not come back — a running sale described as no sale at all,
  // in the same grey as a real one. Say we don't know instead.
  const raw = promo.discountValue;
  const value =
    typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")
      ? Number(raw)
      : NaN;
  if (!Number.isFinite(value))
    return "Discount didn't load — this is not a 0% promotion";
  return promo.discountKind === "amount"
    ? `${value.toFixed(2)} off in the plan's own currency`
    : `${value}% off`;
}

function describeScope(promo) {
  const tiers = Array.isArray(promo.tierKeys) ? promo.tierKeys : [];
  const currencies = Array.isArray(promo.currencies) ? promo.currencies : [];
  const tierText = tiers.length
    ? tiers
        .map((k) => SEAT_LADDER.find((t) => t.tierKey === k)?.label || k)
        .join(", ")
    : "every tier";
  const currencyText = currencies.length ? currencies.join(", ") : "both currencies";
  return `Applies to ${tierText} in ${currencyText}.`;
}

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
