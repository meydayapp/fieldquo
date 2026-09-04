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
  ArrowUpRight,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatDateOnly, isoDateOnly } from "@/lib/format/companyDate";

import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
const STATUS_STYLE = {
  pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  declined: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

// English fallbacks only — the displayed string comes from
// app.setLeave.kind.* in the catalogue, which Settings → Time off policies
// already uses for the same five values. One wording, nine languages, rather
// than a second English-only map that drifts from it.
const KIND_LABEL = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  unpaid: "Unpaid",
  other: "Other",
};

// LeaveRequest.status is a free string column (prisma/schema.prisma: pending |
// approved | declined | cancelled). It used to be printed raw under a
// `capitalize` class, so a French user read "Pending" and a value nobody
// anticipated would have rendered as itself, lowercase, in grey.
const STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
};

// Leave dates are calendar DAYS stored as midnight UTC. A local formatter
// renders 3 August as 2 August for anyone west of UTC — see the note in
// lib/format/companyDate.js.
const date = (d) => formatDateOnly(d);
function range(a, b) {
  const sameDay = isoDateOnly(a) === isoDateOnly(b);
  return sameDay ? date(a) : `${date(a)} → ${date(b)}`;
}
function iso(d) {
  return d.toISOString().slice(0, 10);
}

function Pill({ status }) {
  const { t } = useTranslation();
  // An unmapped value keeps a coloured chip and its own raw text rather than
  // rendering blank: a status nobody anticipated is a bug report, and a blank
  // badge is the one rendering that hides it.
  const label = STATUS_LABEL[status]
    ? t(`app.status.${status}`, STATUS_LABEL[status])
    : status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        STATUS_STYLE[status] || "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

export default function TimeOffPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState(null);
  const [team, setTeam] = useState(null);
  const [canSeeTeam, setCanSeeTeam] = useState(false);
  const [error, setError] = useState("");
  // Kept apart from `error` so the "Mine" panel can refuse in place rather
  // than drawing an empty-looking screen under a red banner — two unrelated
  // things on one page is exactly the shape the brief calls out.
  const [mineError, setMineError] = useState("");

  const loadMine = useCallback(async () => {
    try {
      const d = await fetchJson("/api/leave");
      setMineError("");
      setMine(d);
    } catch (err) {
      // The failure is recorded and `mine` is left as it was. It used to be
      // replaced with `{ policies: [], requests: [], balances: [] }`, which
      // rendered "No leave policies have been set up yet. An owner or admin
      // can add them in Settings → Time off policies." — a sentence about a
      // company's configuration, printed because a request 500'd. That is the
      // /app/clients bug ListState exists for: an empty state that fires on a
      // failed request is a lie about the business, and this one sends
      // somebody to re-create policies they already have.
      setMineError(err.message);
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
      <header data-tour="timeoff-header" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays size={22} />{t("app.timeOff.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("app.timeOff.subtitle")}
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
              <User size={14} />{t("app.timeOff.mine")}</button>
            <button
              onClick={() => setTab("team")}
              className={`px-3 py-1.5 flex items-center gap-1.5 ${
                tab === "team" ? "bg-inverted text-inverted-foreground" : "hover:bg-muted"
              }`}
            >
              <Users size={14} /> {t("app.crewInbox.teamLink", "Team")}
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
        <MyTimeOff
          data={mine}
          errorMessage={mineError}
          onRetry={loadMine}
          reload={() => { loadMine(); loadTeam(); }}
        />
      ) : (
        <TeamTimeOff data={team} reload={() => { loadTeam(); loadMine(); }} />
      )}
    </div>
  );
}

// ── My time off ────────────────────────────────────────────────────────────

function MyTimeOff({ data, errorMessage, onRetry, reload }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sentTo, setSentTo] = useState("");

  // Failed BEFORE empty, and it returns — an if/else chain, not a stack of
  // `&&` fragments, for the reason app/components/ListState.js spells out.
  // Whatever `data` is holding, a refused read must not be redrawn as "your
  // company has no leave policies".
  if (errorMessage) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 dark:border-red-900 bg-card p-6 text-center"
      >
        <AlertTriangle
          size={28}
          className="mx-auto text-red-600 dark:text-red-400 mb-3"
        />
        <p className="text-sm font-semibold text-foreground">{t("app.load.title")}</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          {errorMessage}
        </p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          {t("app.load.reassure")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 border border-border px-4 py-2 rounded-full text-sm font-semibold text-foreground min-h-[44px]"
        >
          {t("app.load.retry")}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="animate-spin" size={16} /> {t("app.state.loading")}
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
            {t("app.timeOff.noBalance")}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-foreground">{t("app.timeOff.yourRequests")}</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground px-3 py-2 text-sm font-medium"
        >
          <Plus size={15} />{t("app.timeOff.request")}</button>
      </div>

      {open && (
        <RequestForm
          policies={data.policies}
          balances={data.balances || []}
          onDone={(created) => {
            setOpen(false);
            // The new row lands in a list sorted by date, which may be a long
            // way down. Say where the request went at the point of asking.
            setSentTo(created?.routing?.label || "");
            reload();
          }}
          onCancel={() => setOpen(false)}
        />
      )}

      {sentTo && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0" />
          Request submitted. {sentTo}
        </div>
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
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const isMoney = balance.policy?.accrualMethod === "percent_of_gross";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-foreground truncate">
            {balance.policy?.name}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[balance.policy?.kind]
              ? t(
                  `app.setLeave.kind.${balance.policy.kind}`,
                  KIND_LABEL[balance.policy.kind],
                )
              : balance.policy?.kind}
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
            <span>{t("app.timeOff.accrued")}</span>
            <span>{balance.accruedDays}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("app.timeOff.taken")}</span>
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
  const money = useCompanyMoney();
  const { t } = useTranslation();
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
      const created = await fetchJson("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, halfDay: sameDay && form.halfDay }),
      });
      onDone(created);
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
          <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.type")}</span>
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
          <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.firstDay")}</span>
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
          <span className="text-xs font-medium text-muted-foreground">{t("app.timeOff.lastDay")}</span>
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
          {t("app.timeOff.halfDayOnly")}
        </label>
      )}

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          {t("app.timeOff.note")}
        </span>
        <textarea
          rows={2}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder={t("app.timeOff.notePlaceholder")}
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
          {t("app.action.cancel")}
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
          {/* Only pending requests carry routing — an approved one is waiting
              on nobody, and saying otherwise would be noise. */}
          {request.status === "pending" && request.routing?.label && (
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
              <ArrowUpRight size={13} className="mt-0.5 shrink-0" />
              <span>
                {request.routing.label}
                {request.routing.note && (
                  <span className="block text-amber-600 dark:text-amber-400">
                    {request.routing.note}
                  </span>
                )}
              </span>
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
  const money = useCompanyMoney();
  const { t } = useTranslation();
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="animate-spin" size={16} /> {t("app.state.loading")}
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
          {t("app.timeOff.awaitingApproval")}
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
                // Per request, not per role. The PATCH route already refuses a
                // supervisor who isn't above this person, and a button that
                // renders only to return 403 is the dead control this codebase
                // keeps finding. Falls back to the role when routing couldn't
                // be computed, which is the behaviour that was here before.
                canReview={r.routing ? r.routing.canAct : data.canApprove}
                showWho
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("app.timeOff.nothingToApprove")}</p>
        )}
        {pending.length > 0 &&
          !pending.some((r) => (r.routing ? r.routing.canAct : data.canApprove)) && (
          <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            {t("app.timeOff.viewOnly")}
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
            {t("app.timeOff.noneUpcoming")}
          </p>
        )}
      </section>

      {data.balances?.length > 0 && (
        <section>
          <h2 className="font-semibold text-foreground mb-2">{t("app.timeOff.balances")}</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">{t("app.timeOff.person")}</th>
                  <th className="px-3 py-2">{t("app.timeOff.policy")}</th>
                  <th className="px-3 py-2 text-right">Accrued</th>
                  <th className="px-3 py-2 text-right">Taken</th>
                  <th className="px-3 py-2 text-right">{t("app.timeOff.left")}</th>
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
          <h2 className="font-semibold text-foreground mb-2">{t("app.timeOff.earlier")}</h2>
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
