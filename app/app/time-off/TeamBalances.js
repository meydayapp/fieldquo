"use client";

// app/app/time-off/TeamBalances.js
//
// Everybody's balances on the Team tab: per person, per policy, what they
// EARNED, what they TOOK (in FieldQuo and before it) and what is LEFT — and,
// opened, how each figure was reached. The owner asked for balances "shown to
// the worker (their own) and to managers/owners"; until this, the Team tab
// carried the balances in its payload and printed none of them except as a
// member count on the Policies card.
//
// Owners and admins also get the two things that change what somebody is
// owed: the opening balance ("hours since 1 January, before FieldQuo") and a
// personal accrual rate. Both are append-only on the server; this screen shows
// the trail beside the form. `canEditAccrual` comes from the server, which
// re-checks it on every POST (lib/leave/accrualAdmin.js) — the flag only keeps
// a form off the screen that would be refused.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { personTitle } from "@/lib/team/personLabel";
import {
  AccrualBasis,
  BalanceFigures,
  OpeningForm,
  OpeningSummary,
  OverrideForm,
  OverrideList,
  isHourPolicy,
} from "@/app/components/leave/AccrualPanels";

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export default function TeamBalances({ data, reload, t }) {
  const year = new Date().getUTCFullYear();
  const [open, setOpen] = useState(null);

  const people = useMemo(() => {
    const byWorker = {};
    for (const b of data.balances || []) (byWorker[b.workerId] ||= []).push(b);
    const openingsBy = {};
    for (const o of data.openings || []) (openingsBy[o.workerId] ||= []).push(o);
    const overridesBy = {};
    for (const o of data.accrualOverrides || []) (overridesBy[o.workerId] ||= []).push(o);
    return (data.workers || []).map((w) => ({
      ...w,
      balances: (byWorker[w.id] || []).sort((a, b) => (a.policy?.name || "").localeCompare(b.policy?.name || "")),
      openings: openingsBy[w.id] || [],
      overrides: overridesBy[w.id] || [],
    }));
  }, [data]);

  if (!data.policies?.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-foreground">{t("app.leaveAccrual.balancesTitle", { year })}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t("app.leaveAccrual.balancesIntro")}</p>
      </header>
      {people.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t("app.leaveAccrual.balancesEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {people.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              open={open === p.id}
              onToggle={() => setOpen(open === p.id ? null : p.id)}
              policies={data.policies}
              canEdit={Boolean(data.canEditAccrual)}
              year={year}
              reload={reload}
              t={t}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonRow({ person, open, onToggle, policies, canEdit, year, reload, t }) {
  const [editing, setEditing] = useState("");
  const hasHourPolicy = policies.some(isHourPolicy);
  const done = () => {
    setEditing("");
    reload();
  };
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-start gap-2 min-h-[44px]"
      >
        {open ? <ChevronDown size={16} className="mt-0.5 shrink-0" /> : <ChevronRight size={16} className="mt-0.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground truncate">
            {person.name}
            {personTitle(person) && <span className="font-normal text-muted-foreground"> · {personTitle(person)}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {person.balances.length === 0
              ? t("app.leaveAccrual.balancesEmpty")
              : person.balances.map((b) => (
                  <span key={b.id}>
                    {b.policy?.name}:{" "}
                    <span className="tabular-nums text-foreground">
                      {b.policy?.paid === false
                        ? t("app.leaveAccrual.takenShort", { days: n2(Number(b.approvedRequestDays) + Number(b.openingUsedDays)) })
                        : b.policy?.accrualMethod === "percent_of_gross"
                          ? t("app.leaveAccrual.moneyPolicyShort")
                          : t("app.leaveAccrual.leftShort", { days: n2(b.remainingDays) })}
                    </span>
                  </span>
                ))}
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {person.balances
              .filter((b) => b.policy?.accrualMethod !== "percent_of_gross")
              .map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-3">
                  <div className="text-sm font-semibold text-foreground mb-1.5">{b.policy?.name}</div>
                  <BalanceFigures balance={b} />
                  <AccrualBasis balance={b} />
                </div>
              ))}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("app.leaveAccrual.openingTitle")}</h3>
              {canEdit && editing !== "opening" && (
                <button
                  type="button"
                  onClick={() => setEditing("opening")}
                  className="min-h-[44px] rounded-lg border border-border px-3 text-sm"
                >
                  {person.openings.length ? t("app.leaveAccrual.openingChange") : t("app.leaveAccrual.openingEdit")}
                </button>
              )}
            </div>
            {editing === "opening" ? (
              <OpeningForm
                workerId={person.id}
                year={year}
                current={person.openings[0] || null}
                policies={policies}
                onSaved={done}
                onCancel={() => setEditing("")}
              />
            ) : (
              <OpeningSummary rows={person.openings} policies={policies} year={year} />
            )}
          </div>

          {hasHourPolicy && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{t("app.leaveAccrual.overrideTitle")}</h3>
                {canEdit && editing !== "override" && (
                  <button
                    type="button"
                    onClick={() => setEditing("override")}
                    className="min-h-[44px] rounded-lg border border-border px-3 text-sm"
                  >
                    {t("app.leaveAccrual.overrideAdd")}
                  </button>
                )}
              </div>
              {editing === "override" ? (
                <OverrideForm workerId={person.id} policies={policies} onSaved={done} onCancel={() => setEditing("")} />
              ) : person.overrides.length ? (
                <OverrideList rows={person.overrides} policies={policies} />
              ) : (
                <p className="text-xs text-muted-foreground">{t("app.leaveAccrual.overrideNone")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
