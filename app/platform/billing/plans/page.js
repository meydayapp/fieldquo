// app/platform/billing/plans/page.js
//
// Plans are the only screen here that edits something customers see directly:
// the public /pricing page reads this table live. So it warns before saving a
// price change, and shows how many companies each plan affects.
//
// ── The prices in SEAT_LADDER are defaults, not law ────────────────────────
//
// scripts/seed-seat-ladder.mjs mints one row per tier per currency at the
// ladder's number and then never touches them again. This screen is where the
// owner changes a price without a deploy, so everything the ladder cares about
// — monthly, annual, seats, crew — has to be editable here or the constant
// wins by default.
//
// tierKey and currency are shown but NOT editable: they are the row's
// identity, the unique key the seeder and every ladder reader find a row by.
// A text box that let somebody retype "solo" as "Solo" would orphan the row
// from the code looking for it with nothing on screen to say so.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  CreditCard,
  Sparkles,
  Percent,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { count } from "@/app/components/platform/MetricCard";
import { fetchJson } from "@/lib/fetchJson";
// planMoney lives in the ladder beside currencyLabel: one place decides how a
// price is written, and it is executable by check:platform-truth there.
import { planMoney, isCustomPlan, CUSTOM_SEAT_PRICE, CUSTOM_MIN_SEATS, CUSTOM_MAX_SEATS, MAX_COMPANY_PEOPLE } from "@/lib/pricing/ladder";
// The card says what THIS says, and nothing else, about whether a plan can be
// bought. See the note on PlanCard's status line.
import { planStatus, isRetired } from "@/lib/platform/sellablePlans";
import ProcessingRatesCard from "./ProcessingRatesCard";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

const BLANK = {
  name: "",
  priceMonthly: "",
  priceAnnual: "",
  seats: "1",
  crewSeats: "0",
  stripePriceId: "",
  stripePriceIdAnnual: "",
  maxUsers: "",
  maxQuotesPerMonth: "",
  aiCopilotEnabled: false,
  // ── Private by default, and that is not the cautious choice — it is the
  //    only correct one for THIS form ──────────────────────────────────────
  //
  // Plan.isPublic defaults to true in the schema, and this payload never sent
  // the field, so parsePlanFields' `has("isPublic")` was false and Prisma
  // applied that default. Every plan an operator created here was PUBLIC, with
  // no control to say otherwise — it appeared on /pricing and in the
  // company-facing picker for everyone, which for a rate negotiated with one
  // company hands a private discount to every competitor in their city.
  //
  // lib/billing/customPlan.js used to set isPublic: false automatically when
  // it minted a bespoke row. That protection went with the file when the
  // per-licence model was retired (docs/PRICING-CLEANUP.md), and it had never
  // covered this path anyway.
  //
  // Defaulting FALSE rather than true, because a ladder tier cannot be born
  // here: tierKey is display-only in this form (see the header note), and the
  // four public tiers come from scripts/seed-seat-ladder.mjs, which sets
  // tierKey and isPublic: true explicitly. So every row created on this screen
  // is tierKey-less — bespoke by construction. Defaulting true would recreate
  // the bug for the exact case the form exists to serve.
  isPublic: false,
};

export default function PlatformPlansPage() {
  // null, not []. On a failed load an empty array claimed "No plans yet. The
  // public pricing page shows its empty state until you add one" — a statement
  // about FieldQuo's rate card, printed because a request failed, directly
  // under the red banner saying the request failed.
  const [plans, setPlans] = useState(null);
  const [usage, setUsage] = useState({});
  const [usageError, setUsageError] = useState("");
  const [draft, setDraft] = useState(null); // null = form closed
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // plan:manage — held by admin and superadmin, refused for support. This
  // screen drew the whole editor for a support agent and let the API say no
  // after they had typed a price in.
  const { status: roleStatus, error: roleError, can, isSuperadmin } = usePlatformAdmin();
  const canManage = can("plan:manage");
  // Retire / un-retire is superadmin-only — the route says so with an inline
  // role check, and the flag here is read off the same role. plan:manage
  // (admin) edits prices; withdrawing a plan from sale, or putting a
  // withdrawn one back, is the owner's call.
  const canRetire = isSuperadmin;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setUsageError("");
    try {
      setPlans(await fetchJson("/api/platform/billing/plans"));
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Subscriber counts are a nice-to-have on this screen, so a failure here
    // must not blank the plan list — but it must not be silent either. This was
    // `if (subRes.ok) { … }` with no else, so when the overview endpoint failed
    // every card said "0 companies" and the delete button lit up on plans that
    // people were paying for.
    try {
      const overview = await fetchJson("/api/platform/analytics/overview");
      setUsage(overview.planMix || {});
    } catch (err) {
      setUsage({});
      setUsageError(
        `Subscriber counts are unavailable (${err.message}) — the company ` +
          "numbers below are not being shown, so don't read a blank as zero.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Ladder rows first, then everything else. The legacy per-headcount plans and
  // the bespoke "Custom (N employees)" rows are real and still billing people,
  // so they are shown — but they are not the menu, and mixing them into one
  // grid is how somebody edits the wrong "1 Employee".
  // Custom sizes ("custom-20") are a third group: derived from Scale, minted
  // on first use, and repriced from Scale on every use — editing one here is
  // editing a number the next checkout overwrites, which the note says.
  const { ladder, custom, legacy } = useMemo(() => {
    const all = Array.isArray(plans) ? plans : [];
    return {
      ladder: all.filter((p) => p.tierKey && !isCustomPlan(p)),
      custom: all.filter((p) => isCustomPlan(p)),
      legacy: all.filter((p) => !p.tierKey),
    };
  }, [plans]);

  async function save() {
    const isEdit = Boolean(draft.id);
    const subscribers = usage[draft.name] || 0;

    if (isEdit && subscribers > 0) {
      const original = plans.find((p) => p.id === draft.id);
      if (String(original?.priceMonthly) !== String(draft.priceMonthly)) {
        if (
          !confirm(
            `${subscribers} ${subscribers === 1 ? "company is" : "companies are"} on "${draft.name}". ` +
              `Changing the price here updates what the public pricing page shows, but does NOT change ` +
              `existing Stripe subscriptions — those keep billing the old amount until changed in Stripe. Continue?`,
          )
        )
          return;
      }
    }

    setBusy(true);
    setError("");
    try {
      const payload = {
        name: draft.name.trim(),
        priceMonthly: Number(draft.priceMonthly) || 0,
        // Blank stays blank. Null means "no annual option on this tier", which
        // is a different product from an annual plan costing nothing, and
        // coercing it to 0 would publish the second.
        priceAnnual: draft.priceAnnual === "" ? null : Number(draft.priceAnnual),
        seats: draft.seats === "" ? undefined : Number(draft.seats),
        crewSeats: draft.crewSeats === "" ? undefined : Number(draft.crewSeats),
        stripePriceId: draft.stripePriceId?.trim() || null,
        stripePriceIdAnnual: draft.stripePriceIdAnnual?.trim() || null,
        maxUsers: draft.maxUsers === "" ? null : Number(draft.maxUsers),
        maxQuotesPerMonth:
          draft.maxQuotesPerMonth === ""
            ? null
            : Number(draft.maxQuotesPerMonth),
        aiCopilotEnabled: !!draft.aiCopilotEnabled,
        // Always sent, never conditional. parsePlanFields only writes the
        // column when the KEY is present, so omitting it on a create silently
        // takes the schema default and omitting it on an edit silently keeps
        // whatever was there. Sending it every time makes the checkbox mean
        // what it looks like it means.
        isPublic: !!draft.isPublic,
      };

      await fetchJson(
        isEdit
          ? `/api/platform/billing/plans/${draft.id}`
          : "/api/platform/billing/plans",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setRetired(plan, retired) {
    const question = retired
      ? `Retire "${plan.name}"? It stays for the companies already on it and ` +
        "can't be bought or switched to by anybody — not from the pricing page, " +
        "not from a signup link. You can un-retire it later."
      : `Put "${plan.name}" back on sale? Links carrying its id will work again.`;
    if (!confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/platform/billing/plans/${plan.id}/retire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retired }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(plan) {
    if (!confirm(`Delete the "${plan.name}" plan?`)) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/platform/billing/plans/${plan.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function edit(p) {
    setDraft({
      id: p.id,
      tierKey: p.tierKey,
      currency: p.currency,
      name: p.name,
      priceMonthly: String(p.priceMonthly),
      priceAnnual: p.priceAnnual === null || p.priceAnnual === undefined ? "" : String(p.priceAnnual),
      seats: String(p.seats ?? 1),
      crewSeats: String(p.crewSeats ?? 0),
      stripePriceId: p.stripePriceId || "",
      stripePriceIdAnnual: p.stripePriceIdAnnual || "",
      maxUsers: p.maxUsers ?? "",
      maxQuotesPerMonth: p.maxQuotesPerMonth ?? "",
      aiCopilotEnabled: p.aiCopilotEnabled,
      // The row's OWN value, not the create-time default. An edit that
      // silently re-published a plan somebody had deliberately made private
      // would be worse than the bug this fixes. `!== false` rather than
      // Boolean(): a legacy row predating the column reads undefined, and
      // undefined here means "nobody ever said", which for an EXISTING row
      // matches the schema default it was created under.
      isPublic: p.isPublic !== false,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What companies can buy. The public pricing page reads these live.
            Temporary discounts live on{" "}
            <Link href="/platform/billing/promotions" className="underline">
              Promotions
            </Link>{" "}
            — change a price here only when it is meant to stay changed.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/platform/billing/promotions"
            className="inline-flex items-center gap-2 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:bg-muted"
          >
            <Percent size={14} /> Promotions
          </Link>
          {canManage && (
            <button
              onClick={() => setDraft({ ...BLANK })}
              className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              <Plus size={14} /> New plan
            </button>
          )}
        </div>
      </div>

      <PlatformWriteGate
        status={roleStatus}
        allowed={canManage}
        error={roleError}
        action="Adding, editing or deleting a plan"
        who="admins and superadmins"
      >
        {null}
      </PlatformWriteGate>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <ProcessingRatesCard />

      {usageError && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {usageError}
        </div>
      )}

      {draft && (
        <div className="bg-card border border-inverted rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">
            {draft.id ? `Edit ${draft.name}` : "New plan"}
          </h2>

          {draft.tierKey && (
            <p className="text-xs text-muted-foreground">
              Ladder row{" "}
              <span className="font-mono">
                {draft.tierKey} / {draft.currency}
              </span>
              . Tier and currency are the row&apos;s identity and aren&apos;t
              editable here — the seeder and every pricing reader find this row
              by that pair.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Starter"
                className={inputClass}
              />
            </Field>

            <Field
              label={`Price per month${draft.currency ? ` (${draft.currency})` : ""}`}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.priceMonthly}
                onChange={(e) =>
                  setDraft({ ...draft, priceMonthly: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            <Field
              label={`Price per year${draft.currency ? ` (${draft.currency})` : ""}`}
              hint="Blank = this tier has no annual option. Annual is the interval, not a discount — a saving has to be typed in."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.priceAnnual}
                onChange={(e) =>
                  setDraft({ ...draft, priceAnnual: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="Billable seats"
              hint="People who can create or change a quote, job or invoice — read off the permission grid, not the role name"
            >
              <input
                type="number"
                min="1"
                value={draft.seats}
                onChange={(e) => setDraft({ ...draft, seats: e.target.value })}
                className={inputClass}
              />
            </Field>

            <Field
              label="Free crew"
              hint="Everybody else: schedule, clock-in, photos. Included at no charge."
            >
              <input
                type="number"
                min="0"
                value={draft.crewSeats}
                onChange={(e) =>
                  setDraft({ ...draft, crewSeats: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            <Field
              label="Max users (legacy)"
              hint="The old PEOPLE count. Still read by the company-facing plan picker. Blank = unlimited."
            >
              <input
                type="number"
                min="1"
                value={draft.maxUsers ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, maxUsers: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            <Field label="Max quotes / month" hint="Blank = unlimited">
              <input
                type="number"
                min="1"
                value={draft.maxQuotesPerMonth ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, maxQuotesPerMonth: e.target.value })
                }
                className={inputClass}
              />
            </Field>

            {/* ── What this field is actually for ─────────────────────────
                The hint said "without it, checkout can't bill this plan",
                which stopped being true when both checkout builders moved to
                inline `price_data` (lib/platform/stripeBilling.js, point 2).
                Every production plan has a blank id and every one of them
                bills.

                Its remaining job is the reverse direction: recoverPlanId()
                maps a Stripe subscription back to a Plan row by price id when
                the checkout session carries no planId metadata — which only
                helps for a subscription started from the Stripe dashboard
                against a catalog price, because a session opened by FieldQuo
                gets an ad-hoc Price Stripe mints itself. Blank is the normal
                state and costs nothing. */}
            <Field
              label="Stripe price ID — monthly"
              hint="Optional. Checkout prices this plan from the monthly figure above, not from Stripe's catalogue — this id only helps match a subscription created in the Stripe dashboard back to this plan."
            >
              <input
                value={draft.stripePriceId ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, stripePriceId: e.target.value })
                }
                placeholder="price_1A2b3C…"
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>

            <Field
              label="Stripe price ID — annual"
              hint="Optional, same as above. The annual price field is what decides whether the 1-year commitment is offered — not this."
            >
              <input
                value={draft.stripePriceIdAnnual ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, stripePriceIdAnnual: e.target.value })
                }
                placeholder="price_1A2b3C…"
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>

            <Field label="FieldQuo AI">
              <label className="flex items-center gap-2 text-sm text-foreground pt-2">
                <input
                  type="checkbox"
                  checked={!!draft.aiCopilotEnabled}
                  onChange={(e) =>
                    setDraft({ ...draft, aiCopilotEnabled: e.target.checked })
                  }
                  className="rounded border-border accent-primary"
                />
                Included in this plan
              </label>
            </Field>
          </div>

          {/* Full width, below the grid, because this is the only field on the
              form whose consequence is visible to people outside the company
              it was created for — and it is worth more than a half-column. */}
          <Field label="Who can see this plan">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={!!draft.isPublic}
                onChange={(e) =>
                  setDraft({ ...draft, isPublic: e.target.checked })
                }
                className="mt-0.5 rounded border-border accent-primary"
              />
              <span>
                Offer this plan publicly
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {draft.isPublic
                    ? "Anyone will see this on the pricing page and in the plan picker."
                    : "Only a company already on this plan will see it. Leave this off for a rate you negotiated with one customer."}
                </span>
              </span>
            </label>
          </Field>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy || !draft.name.trim()}
              className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
            <button
              onClick={() => setDraft(null)}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : plans === null ? (
        /* Never loaded. The sentence below is a claim about what FieldQuo
           sells, so it must not be printed because a request failed — the
           error banner above says what went wrong, and this says what is NOT
           being claimed. No plan was deleted. */
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <CreditCard size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            The plan list didn&apos;t load, so nothing is shown here. This is
            not an empty rate card — no plan has been deleted and the public
            pricing page is unaffected. Reload the page.
          </p>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <CreditCard size={28} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            No plans yet. The public pricing page shows its empty state until
            you add one. Run{" "}
            <code className="font-mono text-xs">npm run seed:seat-ladder</code>{" "}
            to create the four tiers in both currencies.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <Group
            title="The seat ladder"
            note="One row per tier per currency. Same number in CAD and USD on purpose — a conversion would make a Canadian pay their sticker plus FX."
            plans={ladder}
            usage={usage}
            usageKnown={!usageError}
            canManage={canManage}
            canRetire={canRetire}
            busy={busy}
            onEdit={edit}
            onRemove={remove}
            onRetire={setRetired}
            empty={
              <>
                Nothing seeded yet. Run{" "}
                <code className="font-mono text-xs">
                  npm run seed:seat-ladder
                </code>
                .
              </>
            }
          />
          <Group
            title="Custom sizes"
            note={`The fifth card: Scale plus $${CUSTOM_SEAT_PRICE} a seat a month (the same number in CAD and USD, like every rung), ${CUSTOM_MIN_SEATS} to ${CUSTOM_MAX_SEATS} seats, crew = seats + 5, never more than ${MAX_COMPANY_PEOPLE} people. A row appears the first time a company picks that size and is repriced from this currency's Scale row every time one is bought — so reprice Scale, not these. At Stripe each is two items: Scale's price and "Extra seat" × the seats past ten.`}
            plans={custom}
            usage={usage}
            usageKnown={!usageError}
            canManage={canManage}
            canRetire={canRetire}
            busy={busy}
            onEdit={edit}
            onRemove={remove}
            onRetire={setRetired}
            empty="None yet — nobody has picked a custom size."
          />
          <Group
            title="Legacy and bespoke plans"
            note="Per-headcount rows from the old pricing model, and rates negotiated with one company. Still billing real subscriptions — leave them alone unless you are moving somebody off one."
            plans={legacy}
            usage={usage}
            usageKnown={!usageError}
            canManage={canManage}
            canRetire={canRetire}
            busy={busy}
            onEdit={edit}
            onRemove={remove}
            onRetire={setRetired}
            empty="None."
          />
        </div>
      )}
    </div>
  );
}

function Group({ title, note, plans, usage, usageKnown, canManage, canRetire, busy, onEdit, onRemove, onRetire, empty }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {title}
      </h2>
      <p className="text-xs text-muted-foreground mt-1 max-w-3xl">{note}</p>
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-3">{empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              subscribers={usage[p.name] || 0}
              usageKnown={usageKnown}
              canManage={canManage}
              canRetire={canRetire}
              busy={busy}
              onEdit={() => onEdit(p)}
              onRemove={() => onRemove(p)}
              onRetire={(retired) => onRetire(p, retired)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanCard({ plan: p, subscribers, usageKnown, canManage, canRetire, busy, onEdit, onRemove, onRetire }) {
  const status = planStatus(p);
  // The badge is derived from the same predicate the sell paths refuse on,
  // not from a second reading of the column.
  const retired = isRetired(p);
  return (
    <div className={`bg-card border border-border rounded-xl p-5 flex flex-col${retired ? " opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground">{p.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {retired && (
            <span
              className="text-[10px] uppercase tracking-wide text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded px-1.5 py-0.5"
              title="Kept for the companies on it; cannot be bought or switched to, listed or by link"
            >
              Retired
            </span>
          )}
          {!p.isPublic && (
            <span
              className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5"
              title="Not offered in the company-facing picker"
            >
              Private
            </span>
          )}
          {p.aiCopilotEnabled && (
            <span className="text-[#ff5a00]" title="FieldQuo AI included">
              <Sparkles size={14} />
            </span>
          )}
        </div>
      </div>

      {p.tierKey && (
        <p className="text-xs font-mono text-muted-foreground mt-0.5">
          {p.tierKey} · {p.currency}
        </p>
      )}

      <div className="mt-2 text-2xl font-bold text-foreground">
        {planMoney(p.priceMonthly, p.currency)}
        <span className="text-sm font-normal text-muted-foreground">/mo</span>
      </div>

      <dl className="mt-3 space-y-1 text-sm text-muted-foreground flex-1">
        <div>
          {p.priceAnnual === null || p.priceAnnual === undefined
            ? "No annual price"
            : `${planMoney(p.priceAnnual, p.currency)}/yr`}
        </div>
        <div>
          {p.seats} {p.seats === 1 ? "seat" : "seats"} + {p.crewSeats} crew
          {" · "}
          {p.seats + p.crewSeats} people
        </div>
        <div>
          {p.maxQuotesPerMonth
            ? `${count(p.maxQuotesPerMonth)} quotes/mo`
            : "Unlimited quotes"}
        </div>
        <div className={subscribers > 0 ? "text-foreground font-medium" : ""}>
          {usageKnown
            ? `${count(subscribers)} ${subscribers === 1 ? "company" : "companies"}`
            : "Company count unavailable"}
        </div>
        {/* ── One status line, and it is not written here ──────────────────
            This card used to print "No Stripe price ID — checkout will fail"
            and "Annual price with no Stripe ID — annual checkout will fail".
            Both were false on every plan that has ever existed: neither
            checkout builder has looked a Stripe Price up by id since
            stripeBilling.js started building `price_data` inline, so all four
            production plans — none of which has ever carried an id — sell
            perfectly on both cadences.

            They were false because they were a second opinion about a
            question lib/platform/sellablePlans.js already answers for the
            public pricing page. Deriving the sentence from THAT is what stops
            the two drifting again, and it is why the text lives in a module a
            check script can execute. */}
        {status.text && (
          <div
            className={
              status.tone === "warning"
                ? "text-amber-700 dark:text-amber-300 text-xs"
                : "text-muted-foreground text-xs"
            }
          >
            {status.text}
          </div>
        )}
      </dl>

      {/* Read-only for support: plan:manage is admin-and-above, and the two
          controls below both 403 for anyone else. The card still shows every
          number — knowing what a plan costs is not the same permission as
          changing it. */}
      {canManage && (
      <div className="flex gap-2 mt-4">
        <button
          onClick={onEdit}
          className="flex-1 border border-border text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
        >
          Edit
        </button>
        {/* Retire / un-retire: superadmin only, and absent (not disabled)
            for everyone else — the route 403s an admin, and a greyed button
            with no explanation is the dead-control shape this repo keeps
            removing. Delete stays: it is the right answer for a plan nobody
            is on, and retire is the answer for one somebody is. */}
        {canRetire && (
          <button
            onClick={() => onRetire(!retired)}
            disabled={busy}
            title={retired ? "Put this plan back on sale" : "Retire — keep it for its subscribers, sell it to nobody"}
            className="border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted hover:text-foreground disabled:opacity-40 inline-flex items-center gap-1.5 text-sm font-semibold"
          >
            {retired ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {retired ? "Un-retire" : "Retire"}
          </button>
        )}
        <button
          onClick={onRemove}
          disabled={busy}
          title={
            subscribers > 0 ? "Companies are on this plan" : "Delete plan"
          }
          // `dark:bg-` and `dark:text-` where `dark:hover:` was meant. In dark
          // mode that gave a delete button a permanent red wash and red label —
          // armed-looking at rest, and identical before and after the cursor
          // arrives, because Tailwind v4 emits `dark:` after `hover:` at equal
          // specificity so the hover fill never won. Light mode meanwhile had
          // no fill until hover. Two themes disagreeing about the idle state of
          // a destructive control.
          // hover:text-red-600 is #e7000b on red-50, which measures 4.36:1 —
          // just under the floor. red-700 is 5.87:1.
          className="border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
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
