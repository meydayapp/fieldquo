// app/app/settings/leave/page.js
//
// Leave policies — what kinds of time off exist and how entitlement builds up.
// Owner/admin only; the server enforces that and this page reflects it.
//
// The three accrual methods are genuinely different and the form says so
// inline, because picking the wrong one silently produces a balance that looks
// plausible and isn't:
//
//   • A fixed number of days each year — the whole allowance is available now.
//   • Accrues each pay period — earned gradually, so it's lower in January.
//   • Vacation pay as % of gross — accrues MONEY, not days (Canada's 4% model).
//
// ══ The starter sets lead with the company's own country ═══════════════════
//
// This screen used to list Canada, the United States and the United Kingdom as
// three equal choices, to a company whose address we have held since signup.
// The server now says which country the record states (see the GET route) and
// the picker leads with that one.
//
// Led with, NOT applied. Seeding writes LeavePolicy rows and accrues balances
// against every worker immediately — those are employment terms, and a company
// that opened a settings page must not come back to find them set. It is the
// same call the owner made on seats: no auto add, because anything that moves a
// customer's position without a press comes back as a support thread about what
// the software did on its own. The country picks the default answer; the human
// still presses the button.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  CalendarClock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { COUNTRIES } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";

const METHOD_LABEL = {
  annual_allotment: "Fixed days per year",
  per_period: "Accrues each pay period",
  percent_of_gross: "Vacation pay (% of gross)",
};

const KINDS = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

const BLANK = {
  name: "",
  kind: "vacation",
  paid: true,
  accrualMethod: "annual_allotment",
  annualDays: 10,
  percentOfGross: 4,
  carryoverMaxDays: "",
  requiresApproval: true,
};

export default function LeaveSettingsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchJson("/api/settings/leave-policies");
      setData(d);
      setError("");
    } catch (err) {
      setError(err.message);
      setData({ policies: [], templates: [] });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function seed(region) {
    setBusy(`seed-${region}`);
    setError("");
    try {
      const r = await fetchJson("/api/settings/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedRegion: region }),
      });
      setNotice(
        r.created
          ? t("app.setLeave.seeded", { count: r.created }) +
              (r.skipped
                ? t("app.setLeave.seededSkipped", { skipped: r.skipped })
                : "") +
              "."
          : t("app.setLeave.seedNoChange"),
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function roll(fromYear) {
    setBusy("roll");
    setError("");
    try {
      const r = await fetchJson("/api/settings/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollFromYear: fromYear }),
      });
      setNotice(
        r.rolled
          ? t("app.setLeave.rolled", { year: r.intoYear, count: r.rolled })
          : t("app.setLeave.rollNothing"),
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function remove(policy) {
    const used = policy._count?.requests > 0;
    const ok = window.confirm(
      used
        ? t("app.setLeave.removeUsed", {
            name: policy.name,
            count: policy._count.requests,
          })
        : t("app.setLeave.removeUnused", { name: policy.name }),
    );
    if (!ok) return;
    setBusy(`del-${policy.id}`);
    try {
      await fetchJson(
        `/api/settings/leave-policies?id=${encodeURIComponent(policy.id)}`,
        { method: "DELETE" },
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="animate-spin" size={16} /> {t("app.setLeave.loading")}
      </div>
    );
  }

  const active = data.policies.filter((p) => p.active);
  const inactive = data.policies.filter((p) => !p.active);
  const lastYear = (data.year || new Date().getUTCFullYear()) - 1;

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarClock size={20} /> {t("app.setLeave.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setLeave.intro")}{" "}
          <Link href="/app/time-off" className="underline">
            {t("app.setLeave.introTimeOffLink")}
          </Link>
          .
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          {notice}
        </div>
      )}

      {/* Only when the templates actually arrived. A failed load leaves
          `templates` empty, and an empty picker saying "we don't know which
          country your business is in" would turn a server error into a question
          about the customer's address — the mistake the billing page made. */}
      {!active.length && data.templates.length > 0 && (
        <TemplatePicker
          templates={data.templates}
          home={data.home}
          busy={busy}
          onSeed={seed}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{t("app.setLeave.policiesHeading")}</h2>
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground px-3 py-1.5 text-sm font-medium"
          >
            <Plus size={14} /> {t("app.setLeave.addPolicy")}
          </button>
        </div>

        {adding && (
          <PolicyForm
            initial={BLANK}
            onSaved={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {active.length ? (
          <div className="space-y-2">
            {active.map((p) => (
              <PolicyCard
                key={p.id}
                policy={p}
                onSaved={load}
                onRemove={() => remove(p)}
                removing={busy === `del-${p.id}`}
              />
            ))}
          </div>
        ) : (
          !adding && (
            <p className="text-sm text-muted-foreground">
              {t("app.setLeave.noPolicies")}
            </p>
          )
        )}

        {inactive.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
              {t("app.setLeave.retired")}
            </h3>
            <div className="space-y-1.5">
              {inactive.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground flex items-center justify-between gap-2"
                >
                  <span>
                    {p.name} ·{" "}
                    {t("app.setLeave.pastRequests", {
                      count: p._count?.requests || 0,
                    })}
                  </span>
                  <span className="text-[11px]">{t("app.setLeave.notBookable")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {active.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold text-foreground">{t("app.setLeave.yearEnd")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("app.setLeave.yearEndDesc", { from: lastYear, to: lastYear + 1 })}
          </p>
          <button
            onClick={() => roll(lastYear)}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
          >
            {busy === "roll" && <Loader2 size={14} className="animate-spin" />}
            {t("app.setLeave.carryButton", { from: lastYear, to: lastYear + 1 })}
          </button>
        </section>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        {t("app.setLeave.statutoryNote")}
      </p>
    </div>
  );
}

/**
 * The starter sets, with the company's own country first.
 *
 * Three states, because there are genuinely three answers and flattening them
 * loses the honest one:
 *
 *   country known, set exists   lead with it, say where we read it, keep the
 *                               others one line below for a company hiring
 *                               abroad.
 *   country known, no set       say plainly that there is no starter for
 *                               Australia, then offer the three as borrowed
 *                               starting points rather than a list that looks
 *                               chosen for them.
 *   country unknown             exactly what this screen did before, plus where
 *                               to fill the address in. NOT Canada by default:
 *                               absence of a statement is not a statement, and
 *                               a company nudged into another country's leave
 *                               terms would have no idea why.
 */
function TemplatePicker({ templates, home, busy, onSeed }) {
  const { t } = useTranslation();

  const homeTemplate =
    (home?.templateKey &&
      templates.find((tpl) => tpl.key === home.templateKey)) ||
    null;
  const others = templates.filter((tpl) => tpl !== homeTemplate);
  // The same lookup Company Settings and the signup funnel use for this, so a
  // country reads as "Australia" and not as "AU". Falls back to the code rather
  // than to nothing — an unmapped code is still an answer we were given.
  const countryName = home?.country
    ? COUNTRIES.find((c) => c.code === home.country)?.name || home.country
    : null;

  // Which field answered it. Shown because a company being led towards one
  // country's employment terms should be able to see why, and disagree.
  const sourceLine = {
    column: t(
      "app.setLeave.templateFromCountry",
      "Chosen from the country on your company profile.",
    ),
    address: t(
      "app.setLeave.templateFromAddress",
      "Chosen from your business address.",
    ),
    province: t(
      "app.setLeave.templateFromProvince",
      "Chosen from your business province.",
    ),
  }[home?.source];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Sparkles size={16} />
        {homeTemplate
          ? t("app.setLeave.startTemplateHome", "Start from the {country} set", {
              country: homeTemplate.label,
            })
          : t("app.setLeave.startTemplate")}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("app.setLeave.templateDesc")}
      </p>

      {homeTemplate ? (
        <>
          <TemplateButton
            tpl={homeTemplate}
            isHome
            busy={busy}
            onSeed={onSeed}
          />
          {sourceLine && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>
                {sourceLine}{" "}
                <Link href="/app/settings/company" className="underline">
                  {t(
                    "app.setLeave.templateChangeCountry",
                    "Change it in Company settings",
                  )}
                </Link>
              </span>
            </p>
          )}
          {others.length > 0 && (
            <div className="pt-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                {t(
                  "app.setLeave.templateElsewhere",
                  "Hiring in another country? These are here too.",
                )}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {others.map((tpl) => (
                  <TemplateButton
                    key={tpl.key}
                    tpl={tpl}
                    busy={busy}
                    onSeed={onSeed}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-foreground rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
            {countryName
              ? t(
                  "app.setLeave.templateNoneForCountry",
                  "We don't have a starter set for {country} yet. These are the ones we do have — borrow one as a starting point and check the rules where you are.",
                  { country: countryName },
                )
              : t(
                  "app.setLeave.templateNoCountry",
                  "We don't know which country your business is in, so none of these is chosen for you.",
                )}
            {!countryName && (
              <>
                {" "}
                <Link href="/app/settings/company" className="underline">
                  {t(
                    "app.setLeave.templateNoCountryCta",
                    "Add your business address in Company settings",
                  )}
                </Link>
              </>
            )}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {templates.map((tpl) => (
              <TemplateButton
                key={tpl.key}
                tpl={tpl}
                busy={busy}
                onSeed={onSeed}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One starter set. Shared by the leading card and the rest deliberately: the
 * note under each ("28 days INCLUDES bank holidays…") is the honesty of this
 * feature, and a second copy of this markup is the one that would eventually
 * lose it.
 */
function TemplateButton({ tpl, isHome = false, busy, onSeed }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => onSeed(tpl.key)}
      disabled={Boolean(busy)}
      className={`w-full rounded-lg border p-3 text-left hover:bg-muted disabled:opacity-60 ${
        isHome ? "border-foreground bg-muted/40" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">
          {tpl.label}
          {isHome && (
            <span className="ml-2 rounded-full bg-background border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
              {t("app.setLeave.templateHomeBadge", "Your country")}
            </span>
          )}
        </span>
        {busy === `seed-${tpl.key}` ? (
          <Loader2 size={14} className="animate-spin shrink-0" />
        ) : (
          <ArrowRight size={14} className="text-muted-foreground shrink-0" />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        {t("app.setLeave.templateMeta", {
          count: tpl.policies.length,
          year: tpl.sourceYear,
        })}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
        {tpl.note}
      </p>
    </button>
  );
}

function PolicyCard({ policy, onSaved, onRemove, removing }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <PolicyForm
        initial={{
          ...policy,
          annualDays: policy.annualDays == null ? "" : Number(policy.annualDays),
          percentOfGross:
            policy.percentOfGross == null ? "" : Number(policy.percentOfGross),
          carryoverMaxDays:
            policy.carryoverMaxDays == null ? "" : Number(policy.carryoverMaxDays),
        }}
        onSaved={() => {
          setEditing(false);
          onSaved();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const entitlement =
    policy.accrualMethod === "percent_of_gross"
      ? t("app.setLeave.entitlementPercent", {
          percent: Number(policy.percentOfGross || 0),
        })
      : t("app.setLeave.entitlementDays", {
          days: Number(policy.annualDays || 0),
        });

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{policy.name}</span>
            {!policy.paid && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t("app.setLeave.unpaidBadge")}
              </span>
            )}
            {!policy.requiresApproval && (
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                {t("app.setLeave.autoApproved")}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {t(`app.setLeave.method.${policy.accrualMethod}`)} · {entitlement} ·{" "}
            {t("app.setLeave.carryoverLabel")}{" "}
            {policy.carryoverMaxDays == null
              ? t("app.setLeave.unlimited")
              : t("app.setLeave.nDays", { n: Number(policy.carryoverMaxDays) })}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
          >
            {t("app.action.edit")}
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-red-600 dark:text-red-400 disabled:opacity-60"
            aria-label={t("app.setLeave.removeAria", { name: policy.name })}
          >
            {removing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyForm({ initial, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isMoney = form.accrualMethod === "percent_of_gross";

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/settings/leave-policies", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  return (
    <form
      onSubmit={save}
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">{t("app.field.name")}</span>
          <input
            required
            value={form.name}
            onChange={set("name")}
            placeholder={t("app.setLeave.namePlaceholder")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.setLeave.kindLabel")}</span>
          <select
            value={form.kind}
            onChange={set("kind")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {t(`app.setLeave.kind.${k.value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            {t("app.setLeave.howItBuilds")}
          </span>
          <select
            value={form.accrualMethod}
            onChange={set("accrualMethod")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(METHOD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {t(`app.setLeave.method.${v}`)}
              </option>
            ))}
          </select>
        </label>

        {isMoney ? (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setLeave.percentOfGrossLabel")}
            </span>
            <input
              type="number"
              step="0.001"
              min="0"
              max="100"
              value={form.percentOfGross}
              onChange={set("percentOfGross")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {t("app.setLeave.daysPerYear")}
            </span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.annualDays}
              onChange={set("annualDays")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        )}

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            {t("app.setLeave.carryoverCap")}
          </span>
          <input
            type="number"
            step="0.5"
            min="0"
            value={form.carryoverMaxDays}
            onChange={set("carryoverMaxDays")}
            placeholder={t("app.setLeave.blankUnlimited")}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {t("app.setLeave.carryoverHint")}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.paid !== false}
            onChange={(e) => setForm({ ...form, paid: e.target.checked })}
            className="rounded border-border"
          />
          {t("app.setLeave.paid")}
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.requiresApproval !== false}
            onChange={(e) =>
              setForm({ ...form, requiresApproval: e.target.checked })
            }
            className="rounded border-border"
          />
          {t("app.setLeave.needsApproval")}
        </label>
      </div>

      {isMoney && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          {t("app.setLeave.moneyInfo")}
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          {t("app.action.cancel")}
        </button>
        <button
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {form.id ? t("app.setLeave.saveChanges") : t("app.setLeave.addPolicy")}
        </button>
      </div>
    </form>
  );
}
