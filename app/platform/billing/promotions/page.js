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
// ── Every number on this page comes from planOffer() ──────────────────────
//
// Not one line of this file multiplies a price by a discount. planOffer() in
// lib/pricing/planOffer.js (which asks priceFor() in lib/pricing/ladder.js
// for the monthly side) is the only thing that knows how — the SAME function
// the customer surfaces and the Stripe checkout are priced with, so the
// preview here is what a customer will be shown and charged. It already
// refuses the cases a naive renderer gets wrong — a 100% discount rendered as
// free (Stripe rejects a zero unit_amount), a discount larger than the price,
// a promotion outside its dates, a 1-year sale that would charge more than
// the standing 1-year offer. A second implementation here would be a second
// set of those bugs, in the surface an operator uses to decide.
//
// ── The standing 1-year offer is on this page too ─────────────────────────
//
// The owner (2026-09-28): the monthly price is the only regular price; the
// 1-year commitment's "pay 10 months, get 12" is a standing promotion, the
// one promotion with no end date. It is stored on the plan rows
// (Plan.priceAnnual) and edited in the panel at the top of this page, for
// every plan at once; a time-limited sale on the year replaces it for the
// first year and never stacks on it.
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
  currencyLabel,
  customTier,
  CUSTOM_TIER_KEY,
  CUSTOM_LABEL,
  planMoney,
} from "@/lib/pricing/ladder";
import {
  planOffer,
  standingOfferSummary,
  standingAnnualFor,
} from "@/lib/pricing/planOffer";
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
  // The 1-year commitment by default: the owner's promotions are annual-first.
  // The server's default for a body without the field stays "month", which
  // is what every row saved before the field existed means.
  appliesTo: "year",
  active: false,
};

const APPLIES_TO_LABEL = {
  year: "1-year commitment",
  month: "Monthly",
  both: "Both",
};

// Which commitments a row or draft discounts — the same reading as
// promotionIntervals() in lib/pricing/ladder.js (unknown = monthly).
const intervalsOf = (promo) =>
  promo?.appliesTo === "both" ? ["year", "month"] : promo?.appliesTo === "year" ? ["year"] : ["month"];

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
        appliesTo: draft.appliesTo,
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
            className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
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

      {!loading && promotions !== null && (
        <StandingOfferPanel plans={ladderPlans} canManage={canManage} onSaved={load} />
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
                  appliesTo: promo.appliesTo || "month",
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
    <div className="bg-card border border-border rounded-xl p-5" data-promotion-row>
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
            {describeTerms(promo)} {describeScope(promo)}
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
            className={`min-h-[44px] lg:min-h-0 text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 inline-flex items-center gap-2 ${
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
        caption="What customers are shown and charged right now"
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
          label="Applies to"
          hint="1-year commitment: the discount is off twelve months of the monthly price, charged once for the first year, and it replaces the standing 1-year offer for that year (never stacks). Monthly: the monthly price for the promotional months."
        >
          <div className="flex flex-wrap gap-3 pt-1" role="radiogroup" aria-label="Applies to">
            {["year", "month", "both"].map((value) => (
              <label key={value} className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="radio"
                  name="appliesTo"
                  value={value}
                  checked={(draft.appliesTo || "month") === value}
                  onChange={() => set({ appliesTo: value })}
                  className="accent-primary"
                />
                {APPLIES_TO_LABEL[value]}
              </label>
            ))}
          </div>
        </Field>

        <Field
          label="Promotional months (monthly)"
          hint="How long the reduced MONTHLY price lasts before the plan reverts. Zero would mean forever, and is refused. A 1-year sale is one charge for the first year and ignores this."
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
            {[...SEAT_LADDER, { tierKey: CUSTOM_TIER_KEY, label: `${CUSTOM_LABEL} ("Need more people?")` }].map((t) => (
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
          className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
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
 * Every plan the promotion can reach — each rung in each currency, plus a
 * custom size priced from that currency's Scale row — on each commitment the
 * promotion covers, priced by planOffer(). The figures are the ones the
 * customer's card will show and the checkout will charge. No arithmetic in
 * this component.
 */
const CUSTOM_EXAMPLE_SEATS = 20;

function previewRows(plans) {
  const rows = [];
  for (const plan of plans.filter((p) => !/^custom-\d+$/.test(p.tierKey || ""))) {
    rows.push({ key: plan.id, name: plan.name, plan });
    if (plan.tierKey === "scale") {
      // The "Need more people?" plan, one example size, priced from this
      // currency's Scale row exactly as ensureCustomPlan mints it.
      const tier = customTier(CUSTOM_EXAMPLE_SEATS, { base: plan });
      if (tier) {
        rows.push({
          key: `${plan.id}-custom`,
          name: tier.name,
          plan: { tierKey: tier.tierKey, currency: plan.currency, priceMonthly: tier.price, priceAnnual: tier.priceAnnual },
        });
      }
    }
  }
  return rows;
}

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

  const rows = previewRows(plans);
  const intervals = intervalsOf(promo);
  const money = (n, currency) => planMoney(n, currency);

  return (
    <div className="mt-4 space-y-4" data-promotion-preview>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {caption}
      </p>
      {intervals.includes("year") && (
        <div>
          <p className="text-sm font-semibold text-foreground">1-year commitment</p>
          <YearNote promo={promo} rows={rows} now={now} />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm min-w-[46rem]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="font-medium py-1.5 pr-3">Plan</th>
                  <th className="font-medium py-1.5 pr-3">12 × monthly</th>
                  <th className="font-medium py-1.5 pr-3">Standing 1-year offer</th>
                  <th className="font-medium py-1.5 pr-3">Year one while running</th>
                  <th className="font-medium py-1.5 pr-3">Per month</th>
                  <th className="font-medium py-1.5 pr-3">Ribbon</th>
                  <th className="font-medium py-1.5">Then renews at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const offer = planOffer({ plan: row.plan, interval: "year", promotions: [promo], now });
                  const c = row.plan.currency;
                  if (!offer.available) {
                    return (
                      <tr key={row.key} className="border-t border-border">
                        <td className="py-1.5 pr-3 text-foreground">{row.name}</td>
                        <td colSpan={6} className="py-1.5 text-muted-foreground">
                          Not sold on a 1-year commitment — no annual price on this row.
                        </td>
                      </tr>
                    );
                  }
                  const loses = offer.outranked?.length > 0 && !offer.promo;
                  return (
                    <tr key={row.key} className="border-t border-border">
                      <td className="py-1.5 pr-3 text-foreground">{row.name}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{money(offer.twelveMonths, c)}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{money(offer.standing, c)}</td>
                      <td
                        className={`py-1.5 pr-3 font-medium ${
                          offer.promo
                            ? "text-emerald-700 dark:text-emerald-300"
                            : loses
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-muted-foreground"
                        }`}
                      >
                        {offer.promo
                          ? money(offer.charge, c)
                          : loses
                            ? `${money(offer.outranked[0].wouldCharge, c)} — loses to the standing offer`
                            : "— not applied"}
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{money(offer.perMonth, c)}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">
                        {offer.percent > 0 ? `Save ${offer.percent}%` : "—"}
                      </td>
                      <td className="py-1.5 text-muted-foreground">
                        {money(offer.renewal, c)}/yr
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {intervals.includes("month") && (
        <div>
          <p className="text-sm font-semibold text-foreground">Monthly</p>
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
                {rows.map((row) => {
                  const offer = planOffer({ plan: row.plan, interval: "month", promotions: [promo], now });
                  const c = row.plan.currency;
                  if (!offer.available) return null;
                  return (
                    <tr key={row.key} className="border-t border-border">
                      <td className="py-1.5 pr-3 text-foreground">{row.name}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{money(offer.monthly, c)}</td>
                      <td
                        className={`py-1.5 pr-3 font-medium ${
                          offer.promo ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                        }`}
                      >
                        {money(offer.charge, c)}
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">
                        {offer.promo ? `${money(offer.saves, c)}/mo` : "—"}
                      </td>
                      <td className="py-1.5 text-muted-foreground">
                        {money(offer.renewal, c)}
                        {offer.promo ? ` after ${offer.promoMonths} mo` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The sentence the owner asked for beside a 1-year sale: what it is measured
 * against, and what it beats — "40% off the monthly price — year one billed
 * CA$712.80 instead of 12 × monthly (CA$1,188.00) or the standing 1-year
 * offer (CA$990.00)". Said for the first rung, where the figures are
 * checkable in the head; the table has the rest. And a warning, in amber,
 * for every row where the sale would charge MORE than the standing offer —
 * the customer is charged the lower, so such a sale changes nothing there.
 */
function YearNote({ promo, rows, now }) {
  const first = rows.find((r) => planOffer({ plan: r.plan, interval: "year", promotions: [promo], now }).available);
  if (!first) return null;
  const offer = planOffer({ plan: first.plan, interval: "year", promotions: [promo], now });
  const c = first.plan.currency;
  const losers = rows.filter((r) => {
    const o = planOffer({ plan: r.plan, interval: "year", promotions: [promo], now });
    return o.available && !o.promo && o.outranked?.length > 0;
  });
  const what =
    promo.discountKind === "amount"
      ? `${planMoney(Number(promo.discountValue), c)} off the monthly price`
      : `${Number(promo.discountValue)}% off the monthly price`;
  return (
    <div className="mt-1 space-y-2">
      <p className="text-sm text-muted-foreground" data-year-note>
        {offer.promo
          ? `${what} — ${first.name}'s year one billed ${planMoney(offer.charge, c)} instead of 12 × monthly (${planMoney(offer.twelveMonths, c)}) or the standing 1-year offer (${planMoney(offer.standing, c)}), then renews at ${planMoney(offer.renewal, c)}/yr.`
          : offer.outranked?.length
            ? `${what} — ${first.name}'s year one would be ${planMoney(offer.outranked[0].wouldCharge, c)}, more than the standing 1-year offer (${planMoney(offer.standing, c)}). Customers pay the lower, so this sale changes nothing on the 1-year commitment.`
            : `${what} — not applying to ${first.name} at this moment.`}
      </p>
      {losers.length > 0 && (
        <div
          className="border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2"
          data-year-warning
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            On {losers.length === rows.length ? "every plan" : `${losers.length} of ${rows.length} plans`} this
            sale&apos;s first year costs more than the standing 1-year offer, so it does not apply there — the
            customer is charged the standing offer. A 1-year sale has to beat{" "}
            {planMoney(offer.standing, c)} on {first.name} to change anything.
          </span>
        </div>
      )}
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
        .map((k) => (k === CUSTOM_TIER_KEY ? CUSTOM_LABEL : SEAT_LADDER.find((t) => t.tierKey === k)?.label || k))
        .join(", ")
    : "every plan, custom sizes included";
  // "both currencies" was true until AUD joined on 2026-09-24.
  const currencyText = currencies.length ? currencies.join(", ") : "every currency";
  return `Applies to ${tierText} in ${currencyText}.`;
}

// What the promotion does, by commitment — a 1-year sale is one discounted
// first year measured against twelve monthly payments; a monthly one lasts
// its promotional months.
function describeTerms(promo) {
  const months = promo.durationMonths;
  const monthly = `${describeDiscount(promo)}, on the monthly price for ${months} ${months === 1 ? "month" : "months"}, then it reverts.`;
  const yearly = `${describeDiscount(promo)}, measured on the monthly price, on the 1-year commitment: the first year is charged at twelve discounted months (replacing the standing 1-year offer when lower), then renews at the standing offer.`;
  const intervals = intervalsOf(promo);
  if (intervals.length === 2) return `${yearly} Monthly: ${monthly}`;
  return intervals[0] === "year" ? yearly : monthly;
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The standing 1-year commitment offer — the one promotion with no end date.
 *
 * Read off the plan rows (standingOfferSummary: one statement when every row
 * carries the same deal, "varies" when a tier was given its own) and edited
 * for every ladder plan at once through /api/platform/billing/annual-offer,
 * which recomputes each row's year from its OWN monthly price. The preview
 * under the fields shows every row's new year before anything is saved.
 */
function StandingOfferPanel({ plans, canManage, onSaved }) {
  const summary = useMemo(() => standingOfferSummary(plans), [plans]);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState("months");
  const [value, setValue] = useState(String(summary.monthsFree ?? 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const offer = { kind, value: Number(value) };
  const rungs = plans.filter((p) => !/^custom-\d+$/.test(p.tierKey || ""));

  async function save() {
    setSaving(true);
    setError("");
    try {
      await fetchJson("/api/platform/billing/annual-offer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offer),
      });
      setEditing(false);
      await onSaved();
    } catch (err) {
      setError(err.message || "Couldn't save the 1-year offer.");
    } finally {
      setSaving(false);
    }
  }

  const said =
    summary.kind === "none"
      ? "No plan is sold on a 1-year commitment."
      : summary.kind === "varies"
        ? "The plans carry different 1-year deals — see each plan's card on Plans."
        : summary.monthsFree
          ? `Pay ${summary.monthsPaid} months, get 12 — ${summary.monthsFree} ${summary.monthsFree === 1 ? "month" : "months"} free (save ${summary.percent}% against twelve monthly payments).`
          : `Save ${summary.percent}% against twelve monthly payments.`;

  return (
    <div className="bg-card border border-border rounded-xl p-5" data-standing-offer>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">1-year commitment offer</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TONE_BADGE.positive}`}>
              Standing — no end date
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{said}</p>
          <p className="text-xs text-muted-foreground mt-1">
            The monthly price is the regular price. This is the standing promotion for committing to a year —
            the only promotion without an end date. A 1-year sale below replaces it for the first year and
            never stacks on it; customers always pay the lower of the two.
          </p>
        </div>
        {canManage && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="border border-border text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            Edit
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Say it as">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputClass} w-56`}>
                <option value="months">Months free (pay 12 − N)</option>
                <option value="percent">Percent off 12 × monthly</option>
              </select>
            </Field>
            <Field label={kind === "months" ? "Months free" : "Percent off"}>
              <input
                type="number"
                min={kind === "months" ? 1 : 0.01}
                max={kind === "months" ? 11 : 99.99}
                step={kind === "months" ? 1 : 0.01}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`${inputClass} w-32`}
              />
            </Field>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[30rem]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="font-medium py-1.5 pr-3">Plan</th>
                  <th className="font-medium py-1.5 pr-3">Monthly</th>
                  <th className="font-medium py-1.5 pr-3">1-year today</th>
                  <th className="font-medium py-1.5">1-year after saving</th>
                </tr>
              </thead>
              <tbody>
                {rungs.map((p) => {
                  const next = standingAnnualFor(p.priceMonthly, offer);
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-1.5 pr-3 text-foreground">{p.name}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{planMoney(p.priceMonthly, p.currency)}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">
                        {p.priceAnnual == null ? "—" : planMoney(p.priceAnnual, p.currency)}
                      </td>
                      <td className="py-1.5 font-medium text-foreground">
                        {next === null ? "—" : planMoney(next, p.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Applies to every ladder plan and custom size, from its own monthly price. Existing yearly
            subscriptions keep the price they renew on; a year sold after saving is priced from this.
          </p>
          {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save the 1-year offer
            </button>
            <button
              onClick={() => setEditing(false)}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
