// app/platform/sales/plans/page.js
//
// What FieldQuo pays its own salespeople, and the screen that had never
// existed.
//
// ══ The defect this closes ════════════════════════════════════════════════
//
// `SalesCommissionPlan` holds every figure that decides a rep's earnings, and
// `salesCommissionPlan.create` appeared nowhere in the repository — no route,
// no screen, no seed. amountForMilestone() returns null without a plan and
// earnMilestone() refuses a null amount, so a rep with no plan earned NOTHING,
// silently, on every milestone. /platform/sales/performance already said
// "assign a plan and the stages fill in" — with nothing anywhere to assign.
//
// One hundred and one passing assertions proved the commission rules correct.
// None of them proved a plan could be created. That is the failure class this
// codebase is swept for, at the top of the stack.
//
// ══ Dollars here, cents in the column ═════════════════════════════════════
//
// Every box on this screen takes DOLLARS, because that is what a person types,
// and posts the string as typed. The single conversion into whole cents
// happens on the server, in lib/sales/commissionPlanAdmin.js's
// centsFromDollars — the screen imports the same function only to refuse
// before the request goes out, so the sentence a field goes red with is
// literally the sentence the server would have refused with.
//
// A cleared box is not a zero: Number("") is 0 and 0 is finite, which is the
// bug lib/platform/numericField.js was written for. It is used underneath.
//
// ══ What editing a plan does NOT do ═══════════════════════════════════════
//
// It never changes what has already been earned. SalesCommissionEntry rows
// carry their own amountCents, written at earn time, and every total downstream
// is a sum of rows. The screen says this beside the editor rather than leaving
// somebody to hope — "edit the plan, last month's payouts change" is the kind
// of thing people assume when nothing says otherwise.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";
import { centsOrNull, UNKNOWN } from "@/lib/platform/metricFormat";
import { PLAN_MONEY_FIELDS, planDraftProblem } from "@/lib/sales/commissionPlanAdmin";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const BTN_PRIMARY = `${BTN} bg-inverted text-inverted-foreground`;
const BTN_QUIET = `${BTN} border border-border text-foreground`;
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const LABEL = "block text-sm font-medium text-foreground mb-1";
const HELP = "mt-1 text-xs text-muted-foreground";
const CARD = "rounded-xl border border-border bg-card p-4";

/**
 * Cents to dollars, with "we don't know" kept apart from zero.
 *
 * Same rule as the performance screen's money(): `Number(cents) || 0` prints a
 * confident $0.00 for a field that never arrived, and on a screen about what
 * FieldQuo owes people that is the one substitution that must not happen.
 */
function money(cents) {
  const n = centsOrNull(cents);
  if (n === null) return UNKNOWN;
  return `${n < 0 ? "-" : ""}$${Math.abs(n / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const BLANK = {
  name: "",
  activation: "",
  firstPayment: "",
  retention: "",
  retentionDays: "60",
};

export default function PlatformCommissionPlansPage() {
  const [plans, setPlans] = useState([]);
  const [fields, setFields] = useState([]);
  const [standard, setStandard] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/platform/sales/plans");
      setPlans(data.plans || []);
      setFields(data.fields || []);
      setStandard(data.standard || null);
    } catch (err) {
      // Never an empty list on a failed read: "no plans exist" and "the list
      // did not load" are the same pixels otherwise, and one of them means
      // every rep is currently earning nothing.
      setError(err.message);
      setPlans(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();

  // The same refusal the server would give, asked before the request goes out.
  const draftProblem = useMemo(() => (draft ? planDraftProblem(draft) : null), [draft]);
  const editProblem = useMemo(
    () => (editing ? planDraftProblem(editing) : null),
    [editing],
  );

  function clearBanners() {
    setError("");
    setNotice("");
  }

  async function create() {
    setBusy(true);
    clearBanners();
    try {
      const created = await fetchJson("/api/platform/sales/plans", {
        method: "POST",
        body: {
          name: draft.name,
          activation: draft.activation,
          firstPayment: draft.firstPayment,
          retention: draft.retention,
          retentionDays: draft.retentionDays,
        },
      });
      setDraft(null);
      setNotice(
        `${created.plan.name} created — ${money(created.plan.totalCents)} per company across the three milestones. Assign it to a rep on the sales reps screen.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    clearBanners();
    try {
      const saved = await fetchJson(`/api/platform/sales/plans/${editing.id}`, {
        method: "PATCH",
        body: {
          name: editing.name,
          activation: editing.activation,
          firstPayment: editing.firstPayment,
          retention: editing.retention,
          retentionDays: editing.retentionDays,
        },
      });
      setEditing(null);
      setNotice(
        `${saved.plan.name} saved. Milestones earned before now keep the amounts they were written with — only the next one pays the new figures.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(plan, active) {
    const onIt = (plan.reps || []).filter((r) => r.active);
    if (
      !active &&
      !confirm(
        onIt.length
          ? `Deactivate ${plan.name}? It stops being offered for new assignments. ${onIt
              .map((r) => r.name)
              .join(", ")} stay on it and keep earning it — what they were promised does not change.`
          : `Deactivate ${plan.name}? It stops being offered when you assign a plan to a rep. Nothing is deleted.`,
      )
    ) {
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/plans/${plan.id}`, {
        method: "PATCH",
        body: { active },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function fieldLabel(dollarKey) {
    const f = fields.find((x) => x.dollarKey === dollarKey);
    const fallback = PLAN_MONEY_FIELDS.find((x) => x.dollarKey === dollarKey);
    return f?.label || fallback?.label || dollarKey;
  }

  function milestoneLabel(dollarKey) {
    // From MILESTONE_LABELS via the route, never invented here: milestone 2 is
    // "Renewed" because it fires on a billing cycle, free or paid.
    return fields.find((x) => x.dollarKey === dollarKey)?.milestoneLabel || "";
  }

  function moneyFields(state, setState) {
    return (
      <>
        {(fields.length ? fields : PLAN_MONEY_FIELDS).map((f, i) => (
          <div key={f.dollarKey}>
            <label htmlFor={`plan-${f.dollarKey}`} className={LABEL}>
              {i + 1}. {fieldLabel(f.dollarKey)}
              {milestoneLabel(f.dollarKey) ? ` — “${milestoneLabel(f.dollarKey)}”` : ""}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                id={`plan-${f.dollarKey}`}
                inputMode="decimal"
                value={state[f.dollarKey]}
                onChange={(e) => setState({ ...state, [f.dollarKey]: e.target.value })}
                placeholder="0.00"
                className={FIELD}
              />
            </div>
          </div>
        ))}
        <div>
          <label htmlFor="plan-retention-days" className={LABEL}>
            Retention window, in days
          </label>
          <input
            id="plan-retention-days"
            inputMode="numeric"
            value={state.retentionDays}
            onChange={(e) => setState({ ...state, retentionDays: e.target.value })}
            className={FIELD}
          />
          <p className={HELP}>
            Counted from when the subscription STARTS, trial included — the
            owner&apos;s wording is &ldquo;still subscribed after 60 days
            (including trial)&rdquo;. The nightly sweep uses this number, so
            changing it moves when the third milestone can be earned from here
            on.
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Commission plans</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            What FieldQuo pays a sales rep for a company they brought in, in
            three stages. A rep with no plan earns nothing at all — no ledger row
            is written, deliberately, because paying an invented figure is worse
            than paying late. Assign a plan on{" "}
            <Link href="/platform/sales/reps" className="underline">
              sales reps
            </Link>
            .
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() => {
              clearBanners();
              setEditing(null);
              setDraft({ ...BLANK });
            }}
            className={BTN_PRIMARY}
          >
            <Plus size={14} /> New plan
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Creating or editing a commission plan"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {/* ── New plan ───────────────────────────────────────────────────── */}
      {draft && (
        <div className={`${CARD} space-y-4`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">New commission plan</h2>
            {standard ? (
              <button
                onClick={() => setDraft({ ...standard })}
                className={BTN_QUIET}
                type="button"
              >
                Use the standard terms
              </button>
            ) : null}
          </div>

          <div>
            <label htmlFor="plan-name" className={LABEL}>
              Name
            </label>
            <input
              id="plan-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Standard closer plan"
              className={FIELD}
            />
            <p className={HELP}>What you pick from on a rep&apos;s row.</p>
          </div>

          {moneyFields(draft, setDraft)}

          <p className="text-xs text-muted-foreground">
            Amounts are per company, paid once each, in dollars. Every one must
            be more than $0: a milestone worth nothing writes no ledger row at
            all, so it would look like a setting and behave exactly like a rep
            with no plan.
          </p>

          {draftProblem ? (
            <p className="text-xs text-red-700 dark:text-red-300">{draftProblem}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={create}
              disabled={busy || Boolean(draftProblem)}
              className={BTN_PRIMARY}
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Create plan
            </button>
            <button onClick={() => setDraft(null)} className={BTN_QUIET}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── The plans ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : plans === null ? null : plans.length === 0 ? (
        <div className={`${CARD} space-y-3`}>
          <p className="text-sm text-foreground font-medium">No commission plans yet.</p>
          <p className="text-sm text-muted-foreground">
            Until one exists and a rep is assigned to it, every milestone earns
            $0 — the ledger writes nothing at all rather than guessing an amount.
            The owner&apos;s stated terms are $20 on activation, $40 at the next
            billing cycle and $65 at 60 days.
          </p>
          {isSuperadmin && standard ? (
            <button
              onClick={() => {
                clearBanners();
                setDraft({ ...standard });
              }}
              className={BTN_PRIMARY}
            >
              <Plus size={14} /> Start from the standard terms
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) =>
            editing?.id === plan.id ? (
              <div key={plan.id} className={`${CARD} space-y-4`}>
                <h2 className="text-base font-semibold text-foreground">Edit {plan.name}</h2>
                <div>
                  <label htmlFor="plan-edit-name" className={LABEL}>
                    Name
                  </label>
                  <input
                    id="plan-edit-name"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className={FIELD}
                  />
                </div>
                {moneyFields(editing, setEditing)}
                <p className="text-xs text-muted-foreground">
                  Changing these amounts does not change what has already been
                  earned. Every commission entry stores the amount it was written
                  with, and payouts sum those rows — the plan is only ever read
                  for the next milestone.
                </p>
                {editProblem ? (
                  <p className="text-xs text-red-700 dark:text-red-300">{editProblem}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={busy || Boolean(editProblem)}
                    className={BTN_PRIMARY}
                  >
                    {busy && <Loader2 size={14} className="animate-spin" />} Save
                  </button>
                  <button onClick={() => setEditing(null)} className={BTN_QUIET}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={plan.id} className={`${CARD} space-y-3`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-foreground">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {plan.active ? "Offered for new assignments" : "Not offered — kept for the reps on it"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {money(plan.totalCents)} per company
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 text-sm">
                  {(fields.length ? fields : PLAN_MONEY_FIELDS).map((f) => (
                    <div key={f.dollarKey}>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {milestoneLabel(f.dollarKey) || fieldLabel(f.dollarKey)}
                      </div>
                      {/* activation → activationCents, and so on. The suffix
                          is the schema's own naming, and money() prints "—"
                          rather than $0.00 if a field never arrived. */}
                      <div className="text-foreground">{money(plan[`${f.dollarKey}Cents`])}</div>
                    </div>
                  ))}
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Retention window
                    </div>
                    <div className="text-foreground">{plan.retentionDays} days</div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {plan.repCount === 0 ? (
                    <>
                      No reps on this plan.{" "}
                      <Link href="/platform/sales/reps" className="underline">
                        Assign it
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      {plan.repCount} {plan.repCount === 1 ? "rep" : "reps"}:{" "}
                      {(plan.reps || [])
                        .map((r) => (r.active ? r.name : `${r.name} (deactivated)`))
                        .join(", ")}
                    </>
                  )}
                </div>

                {isSuperadmin && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => {
                        clearBanners();
                        setDraft(null);
                        setEditing({
                          id: plan.id,
                          name: plan.name,
                          ...plan.dollars,
                          retentionDays: String(plan.retentionDays),
                        });
                      }}
                      className={BTN_QUIET}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setActive(plan, !plan.active)}
                      disabled={busy}
                      className={BTN_QUIET}
                    >
                      {plan.active ? (
                        <>
                          <ToggleLeft size={13} /> Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight size={13} /> Reactivate
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground max-w-2xl">
        Plans are deactivated, never deleted. A rep already on one keeps earning
        it — what they were promised does not change when FieldQuo stops
        offering it to new hires — and their commission entries carry the amounts
        they were written with, so nothing here can rewrite a payout that has
        already happened.
      </p>
    </div>
  );
}
