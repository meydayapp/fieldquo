// app/app/time-off/page.js
//
// Time off. One page, two audiences, decided by permission — same shape as
// /app/payroll:
//
//   • Everyone sees their own balances, can request time off, and can withdraw
//     a request they haven't taken yet.
//   • A manager also gets a Team tab: who's off when, and pending requests to
//     approve or decline.
//
// ── Why the remaining figure is shown but not trusted ───────────────────────
//
// The balance card shows accrued − used − pending so someone can see what they
// have before asking. The server re-checks it on submit AND again on approval,
// because between those two moments other requests can be approved. The number
// here is information, not authorisation.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CalendarDays,
  Plus,
  Check,
  X,
  Info,
  AlertTriangle,
  Users,
  User,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const STATUS_STYLE = {
  pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const KIND_LABEL = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  unpaid: "Unpaid",
  other: "Other",
};

function date(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function range(a, b) {
  const sameDay = new Date(a).toDateString() === new Date(b).toDateString();
  return sameDay ? date(a) : `${date(a)} → ${date(b)}`;
}
function money(n) {
  return `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function iso(d) {
  return d.toISOString().slice(0, 10);
}

function Pill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
        STATUS_STYLE[status] || "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export default function TimeOffPage() {
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState(null);
  const [team, setTeam] = useState(null);
  const [canSeeTeam, setCanSeeTeam] = useState(false);
  const [error, setError] = useState("");

  const loadMine = useCallback(async () => {
    try {
      const d = await fetchJson("/api/leave");
      setMine(d);
    } catch (err) {
      setError(err.message);
      setMine({ policies: [], requests: [], balances: [] });
    }
  }, []);

  // The team tab is offered only if the server actually returns it. Rendering
  // it from a guessed role and then getting a 403 is the sort of dead control
  // this codebase keeps finding.
  const loadTeam = useCallback(async () => {
    try {
      const d = await fetchJson("/api/leave?scope=team");
      setTeam(d);
      setCanSeeTeam(true);
    } catch (err) {
      if (err.status !== 403) setError(err.message);
      setCanSeeTeam(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
    loadTeam();
  }, [loadMine, loadTeam]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays size={22} /> Time off
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Request time off and see what you have left.
          </p>
        </div>
        {canSeeTeam && (
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              onClick={() => setTab("mine")}
              className={`px-3 py-1.5 flex items-center gap-1.5 ${
                tab === "mine" ? "bg-inverted text-inverted-foreground" : "hover:bg-muted"
              }`}
            >
              <User size={14} /> Mine
            </button>
            <button
              onClick={() => setTab("team")}
              className={`px-3 py-1.5 flex items-center gap-1.5 ${
                tab === "team" ? "bg-inverted text-inverted-foreground" : "hover:bg-muted"
              }`}
            >
              <Users size={14} /> Team
              {team?.requests?.some((r) => r.status === "pending") && (
                <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5">
                  {team.requests.filter((r) => r.status === "pending").length}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {tab === "mine" ? (
        <MyTimeOff data={mine} reload={() => { loadMine(); loadTeam(); }} />
      ) : (
        <TeamTimeOff data={team} reload={() => { loadTeam(); loadMine(); }} />
      )}
    </div>
  );
}

// ── My time off ────────────────────────────────────────────────────────────

function MyTimeOff({ data, reload }) {
  const [open, setOpen] = useState(false);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="animate-spin" size={16} /> Loading your time off…
      </div>
    );
  }

  if (data.reason === "no_worker_record") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground flex items-start gap-2">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          Your login is already linked to a team member record at another
          company, so leave can&apos;t be tracked against it here. An owner or
          admin needs to add you as a separate team member from Settings → Manage
          Team.
        </div>
      </div>
    );
  }

  if (!data.policies?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground flex items-start gap-2">
        <Info size={16} className="mt-0.5 shrink-0" />
        <div>
          No leave policies have been set up yet. An owner or admin can add them
          in Settings → Time off policies.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.balances?.length ? (
          data.balances.map((b) => <BalanceCard key={b.id} balance={b} />)
        ) : (
          <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            No balance has accrued yet this year.
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-foreground">Your requests</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground px-3 py-2 text-sm font-medium"
        >
          <Plus size={15} /> Request time off
        </button>
      </div>

      {open && (
        <RequestForm
          policies={data.policies}
          balances={data.balances || []}
          onDone={() => {
            setOpen(false);
            reload();
          }}
          onCancel={() => setOpen(false)}
        />
      )}

      <div className="space-y-2">
        {data.requests?.length ? (
          data.requests.map((r) => (
            <RequestRow key={r.id} request={r} reload={reload} canCancel />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t requested any time off yet.
          </p>
        )}
      </div>
    </div>
  );
}

function BalanceCard({ balance }) {
  const isMoney = balance.policy?.accrualMethod === "percent_of_gross";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-foreground truncate">
            {balance.policy?.name}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[balance.policy?.kind] || balance.policy?.kind}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-foreground leading-none">
            {isMoney ? money(balance.remainingAmount) : balance.remainingDays}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isMoney ? "accrued" : "days left"}
          </div>
        </div>
      </div>
      {!isMoney && (
        <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>Accrued</span>
            <span>{balance.accruedDays}</span>
          </div>
          <div className="flex justify-between">
            <span>Taken</span>
            <span>{balance.usedDays}</span>
          </div>
          {balance.pendingDays > 0 && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>Awaiting approval</span>
              <span>{balance.pendingDays}</span>
            </div>
          )}
        </div>
      )}
      {isMoney && (
        <p className="mt-3 text-xs text-muted-foreground">
          Vacation pay accrues as money at{" "}
          {Number(balance.policy?.percentOfGross || 0)}% of gross, not as days.
        </p>
      )}
    </div>
  );
}

function RequestForm({ policies, balances, onDone, onCancel }) {
  const today = iso(new Date());
  const [form, setForm] = useState({
    policyId: policies[0]?.id || "",
    startDate: today,
    endDate: today,
    halfDay: false,
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const policy = policies.find((p) => p.id === form.policyId);
  const balance = balances.find((b) => b.policyId === form.policyId);
  const sameDay = form.startDate === form.endDate;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, halfDay: sameDay && form.halfDay }),
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select
            value={form.policyId}
            onChange={(e) => setForm({ ...form, policyId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.paid === false ? " (unpaid)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          {policy?.paid === false ? (
            <p className="text-xs text-muted-foreground">
              Unpaid leave isn&apos;t limited by a balance.
            </p>
          ) : balance ? (
            <p className="text-xs text-muted-foreground">
              {policy?.accrualMethod === "percent_of_gross"
                ? `${money(balance.remainingAmount)} of vacation pay accrued.`
                : `${balance.remainingDays} day(s) available.`}
            </p>
          ) : null}
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">First day</span>
          <input
            type="date"
            required
            value={form.startDate}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                startDate: e.target.value,
                // Keep the range valid without silently moving the user's end
                // date backwards.
                endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
              }))
            }
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Last day</span>
          <input
            type="date"
            required
            min={form.startDate}
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      {sameDay && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.halfDay}
            onChange={(e) => setForm({ ...form, halfDay: e.target.checked })}
            className="rounded border-border"
          />
          Half day only
        </label>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          Note (optional)
        </span>
        <textarea
          rows={2}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="Anything your manager should know"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {policy && !policy.requiresApproval && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info size={13} className="mt-0.5 shrink-0" />
          This type is approved automatically — submitting books it.
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
          Cancel
        </button>
        <button
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Submit request
        </button>
      </div>
    </form>
  );
}

function RequestRow({ request, reload, canCancel, canReview, showWho }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function act(action) {
    setBusy(action);
    setError("");
    try {
      await fetchJson(`/api/leave/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const cancellable =
    canCancel && ["pending", "approved"].includes(request.status);

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {showWho && (
              <span className="font-semibold text-foreground">
                {request.worker?.name}
              </span>
            )}
            <span className="text-sm text-foreground">{request.policy?.name}</span>
            <Pill status={request.status} />
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {range(request.startDate, request.endDate)} ·{" "}
            {Number(request.days)} day{Number(request.days) === 1 ? "" : "s"}
            {request.policy?.paid === false && " · unpaid"}
          </div>
          {request.reason && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              “{request.reason}”
            </p>
          )}
          {request.reviewNote && (
            <p className="text-xs text-muted-foreground mt-1">
              Manager note: {request.reviewNote}
            </p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {canReview && request.status === "pending" && (
            <>
              <button
                onClick={() => act("approve")}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {busy === "approve" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                Approve
              </button>
              <button
                onClick={() => act("decline")}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-60"
              >
                {busy === "decline" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <X size={13} />
                )}
                Decline
              </button>
            </>
          )}
          {cancellable && (
            <button
              onClick={() => act("cancel")}
              disabled={Boolean(busy)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {busy === "cancel" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                "Withdraw"
              )}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

// ── Team ───────────────────────────────────────────────────────────────────

function TeamTimeOff({ data, reload }) {
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="animate-spin" size={16} /> Loading the team&apos;s time off…
      </div>
    );
  }

  const pending = (data.requests || []).filter((r) => r.status === "pending");
  const now = new Date();
  const upcoming = (data.requests || [])
    .filter((r) => r.status === "approved" && new Date(r.endDate) >= now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const past = (data.requests || []).filter(
    (r) => !pending.includes(r) && !upcoming.includes(r),
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold text-foreground mb-2">
          Awaiting approval
          {pending.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length ? (
          <div className="space-y-2">
            {pending.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                reload={reload}
                canReview={data.canApprove}
                showWho
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to approve.</p>
        )}
        {!data.canApprove && pending.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            You can see requests but not approve them.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-foreground mb-2">Who&apos;s off next</h2>
        {upcoming.length ? (
          <div className="space-y-2">
            {upcoming.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                reload={reload}
                canCancel={data.canApprove}
                showWho
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nobody has approved time off coming up.
          </p>
        )}
      </section>

      {data.balances?.length > 0 && (
        <section>
          <h2 className="font-semibold text-foreground mb-2">Balances this year</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Policy</th>
                  <th className="px-3 py-2 text-right">Accrued</th>
                  <th className="px-3 py-2 text-right">Taken</th>
                  <th className="px-3 py-2 text-right">Left</th>
                </tr>
              </thead>
              <tbody>
                {data.balances.map((b) => {
                  const isMoney = b.policy?.accrualMethod === "percent_of_gross";
                  return (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{b.worker?.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {b.policy?.name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isMoney ? money(b.accruedAmount) : b.accruedDays}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isMoney ? money(b.usedAmount) : b.usedDays}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">
                        {isMoney ? money(b.remainingAmount) : b.remainingDays}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-semibold text-foreground mb-2">Earlier</h2>
          <div className="space-y-2">
            {past.slice(0, 20).map((r) => (
              <RequestRow key={r.id} request={r} reload={reload} showWho />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
