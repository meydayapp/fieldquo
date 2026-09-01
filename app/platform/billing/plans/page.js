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
} from "lucide-react";
import { count } from "@/app/components/platform/MetricCard";
import { fetchJson } from "@/lib/fetchJson";
import { currencyLabel } from "@/lib/pricing/ladder";

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

/**
 * A plan's price, written in the plan's OWN currency.
 *
 * MetricCard's money() hardcodes en-CA/CAD, which was right when every row was
 * CAD and is a lie now: it would print CA$129 on the USD row of a tier. The two
 * prices are the same NUMBER, not a conversion, so the symbol is the only thing
 * distinguishing them — see the note in lib/pricing/ladder.js. currencyLabel is
 * the ladder's own answer to that, so there is one place that decides.
 */
function planMoney(value, currency) {
  const n = Number(value || 0);
  return `${currencyLabel(currency) || "$"}${n.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState({});
  const [usageError, setUsageError] = useState("");
  const [draft, setDraft] = useState(null); // null = form closed
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
  const { ladder, legacy } = useMemo(() => {
    const all = Array.isArray(plans) ? plans : [];
    return {
      ladder: all.filter((p) => p.tierKey),
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
          <button
            onClick={() => setDraft({ ...BLANK })}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={14} /> New plan
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

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

            <Field
              label="Stripe price ID — monthly"
              hint="From the Stripe dashboard — without it, checkout can't bill this plan"
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
              hint="Only needed if this tier has an annual price"
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
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
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
            busy={busy}
            onEdit={edit}
            onRemove={remove}
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
            title="Legacy and bespoke plans"
            note="Per-headcount rows from the old pricing model, and rates negotiated with one company. Still billing real subscriptions — leave them alone unless you are moving somebody off one."
            plans={legacy}
            usage={usage}
            usageKnown={!usageError}
            busy={busy}
            onEdit={edit}
            onRemove={remove}
            empty="None."
          />
        </div>
      )}
    </div>
  );
}

function Group({ title, note, plans, usage, usageKnown, busy, onEdit, onRemove, empty }) {
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
              busy={busy}
              onEdit={() => onEdit(p)}
              onRemove={() => onRemove(p)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanCard({ plan: p, subscribers, usageKnown, busy, onEdit, onRemove }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground">{p.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
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
        {!p.stripePriceId && (
          <div className="text-amber-700 dark:text-amber-300 text-xs">
            No Stripe price ID — checkout will fail
          </div>
        )}
        {p.priceAnnual !== null &&
          p.priceAnnual !== undefined &&
          !p.stripePriceIdAnnual && (
            <div className="text-amber-700 dark:text-amber-300 text-xs">
              Annual price with no Stripe ID — annual checkout will fail
            </div>
          )}
      </dl>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onEdit}
          className="flex-1 border border-border text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
        >
          Edit
        </button>
        <button
          onClick={onRemove}
          disabled={busy}
          title={
            subscribers > 0 ? "Companies are on this plan" : "Delete plan"
          }
          className="border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-red-50 dark:bg-red-950/40 hover:text-red-600 dark:text-red-400 disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
