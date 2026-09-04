// app/platform/sales/reps/page.js
//
// FieldQuo's own sales team. Reads like /app/settings/team on purpose — that
// was the owner's requirement, and it is a statement about the EXPERIENCE:
// type a name and an email, click Invite, they get a link.
//
// None of the tenant invite machinery is underneath it, and none could be:
// lib/sales/invite.js's header lists every assumption POST
// /api/settings/members makes that is false for FieldQuo hiring its own staff
// (a member as the actor, a seat charged to a company's plan, a role from the
// per-company permission grid, a Better Auth organization invitation).
//
// ══ What the owner found missing, and what each gap now is ════════════════
//
// He added a rep and asked: "asks me for a name email and code? what is the
// code for? where do i enter their work email? where can i assign them a
// number for callbacks etc?" Every one of those was real.
//
//   the code       is the slug in /signup?sales=<code> — the ONLY mechanism by
//                  which a signup is credited to a rep. It is now generated
//                  from the name, shown before the invite goes out, and
//                  overridable. The screen and the server agree because both
//                  call lib/sales/repAdmin.js's codeCandidates().
//   the work email is SalesRep.workEmail, the mailbox outreach is sent from and
//                  replies come back to. The column existed and had no writer
//                  anywhere in the product, while lib/sales/outreachSender.js
//                  refuses every send without one. Both halves are wired now,
//                  and the row says so in the blocker's own words.
//   the plan       is SalesCommissionPlan, and it was the same shape of gap one
//                  layer down: this screen READ commissionPlan.name to display
//                  it and nothing anywhere in the product could write it —
//                  `salesCommissionPlan.create` appeared in no route, no screen
//                  and no seed. A rep with no plan earns NOTHING (earnMilestone
//                  refuses a null amount and writes no row at all), so the
//                  picker below, and /platform/sales/plans behind it, are what
//                  make hiring a closer mean anything.
//   a number       is two different answers and is given as two: texting is
//                  real and SHARED (one first-party number, not one per rep),
//                  and a per-rep voice callback number does not exist. There is
//                  no picker for the second, because there is nothing behind
//                  it. See NUMBER_CAPABILITIES.
//
// ══ Deactivate, never delete ══════════════════════════════════════════════
//
// There is no delete control here, and the screen says why rather than leaving
// its absence to be noticed: a rep's attributions and ledger are history.
// Deactivating closes the door within one request — lib/sales/gate.js re-reads
// `active` on every call — and leaves the record standing.
//
// ══ Cards, not a table ════════════════════════════════════════════════════
//
// A rep's row now carries a signup link, a mailbox, a code, a status, a
// company count and a sending verdict. Six columns of that in a table is a
// horizontal scroll on every phone, and the standing rule says the console has
// to work on one. A card per rep reads down instead of across.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Copy,
  HandCoins,
  Loader2,
  Mail,
  Phone,
  Plus,
  UserCheck,
  UserX,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";
import { codeProblem, suggestCode, workEmailProblem } from "@/lib/sales/repAdmin";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const BTN_PRIMARY = `${BTN} bg-inverted text-inverted-foreground`;
const BTN_QUIET = `${BTN} border border-border text-foreground`;
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const LABEL = "block text-sm font-medium text-foreground mb-1";
const HELP = "mt-1 text-xs text-muted-foreground";
const CARD = "rounded-xl border border-border bg-card p-4";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

/**
 * "Standard closer plan — $125 per company", for the picker.
 *
 * The three amounts are summed rather than a stored total being trusted,
 * and a plan missing any of them prints its name alone instead of a confident
 * "$0.00" — the same rule the performance screen's money() follows, for the
 * same reason: on a screen about what FieldQuo owes people, a fabricated zero
 * and a real one look identical.
 */
function planOptionLabel(plan) {
  const parts = [plan.activationCents, plan.firstPaymentCents, plan.retentionCents];
  if (!parts.every((n) => typeof n === "number" && Number.isFinite(n))) return plan.name;
  const total = parts.reduce((a, b) => a + b, 0) / 100;
  const suffix = plan.active ? "" : " — no longer offered";
  return `${plan.name} — $${total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} per company${suffix}`;
}

const BLANK = {
  name: "",
  email: "",
  workEmail: "",
  code: "",
  codeTouched: false,
  // "" is "no plan", which is a real (and expensive) state rather than a
  // missing field — a rep without one earns nothing on every milestone and no
  // ledger row is written at all. The form says so instead of defaulting to
  // whichever plan happens to be first.
  commissionPlanId: "",
};

export default function PlatformSalesRepsPage() {
  const [reps, setReps] = useState([]);
  const [salesNumber, setSalesNumber] = useState(null);
  const [numberCapabilities, setNumberCapabilities] = useState([]);
  const [plans, setPlans] = useState([]);
  const [draft, setDraft] = useState(null);
  const [mailboxDraft, setMailboxDraft] = useState({});
  const [planDraft, setPlanDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/platform/sales/reps");
      setReps(data.reps || []);
      setSalesNumber(data.salesNumber || null);
      setNumberCapabilities(data.numberCapabilities || []);
      setPlans(data.plans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const takenCodes = useMemo(() => reps.map((r) => r.code), [reps]);

  function clearBanners() {
    setError("");
    setNotice("");
    setWarning("");
  }

  /**
   * Retype the name, and the code follows — until somebody edits the code, at
   * which point it stops following. A field that silently overwrites what a
   * person typed is the same class of surprise as a control that does nothing.
   */
  function setName(name) {
    setDraft((d) => ({
      ...d,
      name,
      code: d.codeTouched ? d.code : (suggestCode(name, takenCodes) ?? ""),
    }));
  }

  const draftCodeProblem = draft ? codeProblem(draft.code) : null;
  const draftMailboxProblem = draft ? workEmailProblem(draft.workEmail, draft.email) : null;

  async function invite() {
    setBusy(true);
    clearBanners();
    try {
      const created = await fetchJson("/api/platform/sales/reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          email: draft.email,
          workEmail: draft.workEmail,
          code: draft.code,
          // "" would be a string the route has to interpret; null is the state
          // itself. resolvePlanAssignment treats both as "no plan", but sending
          // the state rather than the empty box is what keeps the two apart on
          // this side too.
          commissionPlanId: draft.commissionPlanId || null,
        }),
      });
      setDraft(null);
      // The send outcome is reported separately from the row being created,
      // because they genuinely can differ — lib/email/teamInvite.js's header is
      // the story of an invite that looked sent from every angle except the
      // recipient's inbox. "Invited" over a refused send would be the same lie.
      if (created.invite?.sent) {
        setNotice(
          `Invitation sent to ${created.email}. Their signup link is ${created.signupLink}.`,
        );
      } else {
        setWarning(
          `${created.email} was added, but the invitation email didn't go out: ${created.invite?.error || "no reason given"} — use Resend invite once that's fixed.`,
        );
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(rep, active) {
    if (
      !confirm(
        active
          ? `Reactivate ${rep.email}?`
          : `Deactivate ${rep.email}? They'll be signed out of the sales portal on their next request. Their attributed companies and commission history stay exactly as they are.`,
      )
    )
      return;

    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMailbox(rep) {
    const value = mailboxDraft[rep.id] ?? "";
    const problem = workEmailProblem(value, rep.email);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workEmail: value }),
      });
      setMailboxDraft((d) => {
        const next = { ...d };
        delete next[rep.id];
        return next;
      });
      setNotice(
        value
          ? `${rep.name} now sends from ${value.trim().toLowerCase()}.`
          : `${rep.name}'s work mailbox was cleared. They can't send until another one is set.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Put a rep on a commission plan, or take them off one.
   *
   * The same draft-then-Save shape as the mailbox rather than a select that
   * saves on change: this field decides what somebody is paid, and a stray
   * click on a dropdown is not a decision.
   */
  async function savePlan(rep) {
    const value = planDraft[rep.id] ?? "";
    if (
      !value &&
      !confirm(
        `Leave ${rep.name} with no commission plan? They earn nothing — no ledger row is written at all for any milestone their companies reach, and there is no record afterwards that one should have been.`,
      )
    ) {
      return;
    }
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionPlanId: value || null }),
      });
      setPlanDraft((d) => {
        const next = { ...d };
        delete next[rep.id];
        return next;
      });
      const chosen = plans.find((p) => p.id === value);
      setNotice(
        chosen
          ? `${rep.name} is on ${chosen.name}. Milestones already earned keep the amounts they were written with.`
          : `${rep.name} now has no commission plan and earns nothing until one is assigned.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend(rep) {
    setBusy(true);
    clearBanners();
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}/invite`, { method: "POST" });
      setNotice(
        `A fresh invitation went to ${rep.email}. Any earlier link has stopped working.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Copy, and say whether it worked.
   *
   * navigator.clipboard is unavailable on an insecure origin and can be denied
   * by permission, so the failure is reported rather than swallowed — a Copy
   * button that silently does nothing is precisely the dead control this
   * codebase keeps being swept for. The link is also rendered in a selectable
   * read-only field beside it, so there is always a way to get it by hand.
   */
  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("This browser wouldn't let the page copy. Select the link and copy it by hand.");
    }
  }

  // Was a hand-rolled `fetchJson("/api/platform/me").catch(() => null)` whose
  // failure left `me` null — read here as "not a superadmin" and answered with
  // a refusal, shown to a superadmin, for a power they hold. The shared hook
  // keeps never-loaded apart from refused; see PlatformWriteGate's header.
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales reps</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            FieldQuo&apos;s own salespeople. A rep signs in at /sales and sees
            only the companies attributed to them — never a contractor&apos;s
            quotes, clients or revenue, and never anything they can write to.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            <Link href="/platform/sales/performance" className="underline">
              Sales performance
            </Link>{" "}
            has the signups, milestones, commission and leads.
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() => setDraft({ ...BLANK })}
            className={BTN_PRIMARY}
          >
            <Plus size={14} /> Add rep
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Adding or editing a sales rep"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {warning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          {warning}
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300 break-words">
          {notice}
        </div>
      )}

      {/* ── Add a rep ──────────────────────────────────────────────────── */}
      {draft && (
        <div className={`${CARD} space-y-4`}>
          <h2 className="text-base font-semibold text-foreground">Invite a sales rep</h2>

          <div>
            <label htmlFor="rep-name" className={LABEL}>
              Name
            </label>
            <input
              id="rep-name"
              value={draft.name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="rep-email" className={LABEL}>
              Sign-in email
            </label>
            <input
              id="rep-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className={FIELD}
            />
            <p className={HELP}>
              Where the invitation goes, and the address they sign in with. It
              can be a personal one — it is never used to send outreach.
            </p>
          </div>

          <div>
            <label htmlFor="rep-work-email" className={LABEL}>
              Work mailbox — optional now, required to send
            </label>
            <input
              id="rep-work-email"
              type="email"
              value={draft.workEmail}
              onChange={(e) => setDraft({ ...draft, workEmail: e.target.value })}
              placeholder="dana@fieldquo.com"
              className={FIELD}
            />
            <p className={HELP}>
              The mailbox their outreach is sent from and prospects&apos; replies
              come back to. You buy it separately and assign it here once it
              exists. Until it is set,{" "}
              <strong className="font-semibold">
                this rep cannot send a single email
              </strong>{" "}
              — the compose box in their portal refuses to render and says the
              same thing. It is deliberately not their sign-in address: a
              stranger&apos;s reply has to land somewhere they are happy to
              receive it.
            </p>
            {draftMailboxProblem ? (
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">{draftMailboxProblem}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="rep-code" className={LABEL}>
              Attribution code
            </label>
            <input
              id="rep-code"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value, codeTouched: true })}
              className={FIELD}
            />
            <p className={HELP}>
              This is the whole of how a signup gets credited to them: their link
              is{" "}
              <span className="font-mono break-all">
                /signup?sales={draft.code || "…"}
              </span>
              , and a company that signs up through it is theirs. Generated from
              the name and already checked against the codes in use — change it
              if you have a reason, but it is fixed once the rep exists, because
              the link will be on a card by then.
            </p>
            {draftCodeProblem ? (
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">{draftCodeProblem}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="rep-plan" className={LABEL}>
              Commission plan
            </label>
            <select
              id="rep-plan"
              value={draft.commissionPlanId}
              onChange={(e) => setDraft({ ...draft, commissionPlanId: e.target.value })}
              className={FIELD}
            >
              <option value="">No plan — earns nothing</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {planOptionLabel(p)}
                </option>
              ))}
            </select>
            <p className={HELP}>
              What this rep is paid for a company they bring in, in three
              stages. Until a plan is assigned{" "}
              <strong className="font-semibold">
                every milestone earns them $0
              </strong>{" "}
              — the ledger writes no row at all, deliberately, because paying an
              invented figure is worse than paying late, and there is no record
              afterwards that one was missed. Set it up on{" "}
              <Link href="/platform/sales/plans" className="underline">
                commission plans
              </Link>
              .
            </p>
            {plans.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No commission plans exist yet, so there is nothing to assign.{" "}
                <Link href="/platform/sales/plans" className="underline">
                  Create one first
                </Link>{" "}
                — it takes a minute, and it is the difference between this rep
                earning $125 a sale and $0.
              </p>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            They&apos;ll get an emailed link and choose their own password. The
            link works once and expires in seven days.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={invite}
              disabled={
                busy ||
                !draft.name.trim() ||
                !draft.email.trim() ||
                !draft.code.trim() ||
                Boolean(draftCodeProblem) ||
                Boolean(draftMailboxProblem)
              }
              className={BTN_PRIMARY}
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Send invitation
            </button>
            <button onClick={() => setDraft(null)} className={BTN_QUIET}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Numbers: what can be assigned, and what cannot ─────────────── */}
      <section className={`${CARD} space-y-3`}>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Phone size={16} className="shrink-0" /> Phone numbers
        </h2>
        {salesNumber ? (
          <p className="text-sm text-muted-foreground">{salesNumber.detail}</p>
        ) : null}
        <ul className="space-y-3">
          {numberCapabilities.map((c) => (
            <li key={c.key} className="rounded-lg border border-border p-3">
              <div className="text-sm font-medium text-foreground">
                {c.label} — {c.available ? "available" : "not built"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
              {c.where ? (
                <Link href={c.where} className="mt-2 inline-block text-sm underline">
                  Open {c.where}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* ── The team ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : reps.length === 0 ? (
        <div className={`${CARD} text-center text-sm text-muted-foreground`}>
          No sales reps yet.
        </div>
      ) : (
        <div className="space-y-4">
          {reps.map((rep) => {
            const editingMailbox = rep.id in mailboxDraft;
            return (
              <div key={rep.id} className={`${CARD} space-y-3`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-foreground">{rep.name}</div>
                    <div className="text-xs text-muted-foreground break-all">{rep.email}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {!rep.active ? (
                      <span>Deactivated {formatDate(rep.endedAt)}</span>
                    ) : rep.acceptedAt ? (
                      <span>Active since {formatDate(rep.acceptedAt)}</span>
                    ) : (
                      <span>Invited {formatDate(rep.invitedAt)} — not accepted yet</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Code
                    </div>
                    <div className="font-mono text-foreground break-all">{rep.code}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Companies attributed
                    </div>
                    <div className="text-foreground">{rep.companyCount}</div>
                  </div>
                </div>

                <div>
                  <label htmlFor={`link-${rep.id}`} className={LABEL}>
                    Signup link
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id={`link-${rep.id}`}
                      readOnly
                      value={rep.signupLink || ""}
                      className={`${FIELD} flex-1 font-mono`}
                    />
                    <button
                      onClick={() => copy(rep.signupLink || "", rep.id)}
                      disabled={!rep.signupLink}
                      className={BTN_QUIET}
                    >
                      {copied === rep.id ? <Check size={14} /> : <Copy size={14} />}
                      {copied === rep.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className={HELP}>
                    A company that signs up through this link is credited to{" "}
                    {rep.name}, at signup, permanently.
                  </p>
                </div>

                <div>
                  <div className={LABEL}>Work mailbox</div>
                  {editingMailbox && isSuperadmin ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        aria-label={`Work mailbox for ${rep.name}`}
                        type="email"
                        value={mailboxDraft[rep.id]}
                        onChange={(e) =>
                          setMailboxDraft({ ...mailboxDraft, [rep.id]: e.target.value })
                        }
                        placeholder="dana@fieldquo.com"
                        className={`${FIELD} flex-1`}
                      />
                      <button
                        onClick={() => saveMailbox(rep)}
                        disabled={busy}
                        className={BTN_PRIMARY}
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          setMailboxDraft((d) => {
                            const next = { ...d };
                            delete next[rep.id];
                            return next;
                          })
                        }
                        className={BTN_QUIET}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground break-all">
                        {rep.workEmail || "Not assigned"}
                      </span>
                      {isSuperadmin ? (
                        <button
                          onClick={() =>
                            setMailboxDraft({ ...mailboxDraft, [rep.id]: rep.workEmail || "" })
                          }
                          className={BTN_QUIET}
                        >
                          <Mail size={13} /> {rep.workEmail ? "Change" : "Assign"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* ── What they're paid ──────────────────────────────────
                    The row already SHOWED commissionPlan.name and had no way
                    to set it, which is the readable half of a column with no
                    writer: SalesCommissionPlan decides every figure in this
                    rep's ledger, and until this picker existed there was no
                    screen anywhere in the product that could fill it. */}
                <div>
                  <div className={LABEL}>Commission plan</div>
                  {rep.id in planDraft && isSuperadmin ? (
                    <div className="flex flex-wrap gap-2">
                      <select
                        aria-label={`Commission plan for ${rep.name}`}
                        value={planDraft[rep.id]}
                        onChange={(e) =>
                          setPlanDraft({ ...planDraft, [rep.id]: e.target.value })
                        }
                        className={`${FIELD} flex-1`}
                      >
                        <option value="">No plan — earns nothing</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {planOptionLabel(p)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => savePlan(rep)}
                        disabled={busy}
                        className={BTN_PRIMARY}
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          setPlanDraft((d) => {
                            const next = { ...d };
                            delete next[rep.id];
                            return next;
                          })
                        }
                        className={BTN_QUIET}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">
                        {rep.commissionPlan || "None — earns nothing"}
                      </span>
                      {isSuperadmin ? (
                        <button
                          onClick={() =>
                            setPlanDraft({
                              ...planDraft,
                              [rep.id]: rep.commissionPlanId || "",
                            })
                          }
                          className={BTN_QUIET}
                        >
                          <HandCoins size={13} />{" "}
                          {rep.commissionPlan ? "Change" : "Assign"}
                        </button>
                      ) : null}
                    </div>
                  )}
                  {!rep.commissionPlan ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      No ledger row is written for any milestone this rep&apos;s
                      companies reach. Assigning a plan starts recording from the
                      next milestone onwards — it does not backfill the ones that
                      passed while there was none.
                    </p>
                  ) : null}
                </div>

                {/* The sending verdict, from the same function the rep's own
                    portal asks. Never a local guess: two opinions is how the
                    console reports a rep as ready while their compose box
                    refuses to render. */}
                {rep.sending?.canSend ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Can send outreach.
                  </p>
                ) : (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                    <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      Cannot send outreach yet.
                    </div>
                    {(rep.sending?.blockers || []).map((b) => (
                      <div key={b.code} className="text-sm text-amber-900 dark:text-amber-200">
                        <div className="font-medium">{b.title}</div>
                        <div className="text-xs">{b.fix}</div>
                      </div>
                    ))}
                  </div>
                )}

                {isSuperadmin && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Only rendered when it would actually work: the route
                        refuses a resend for a rep who has already set a
                        password, or one who is deactivated. */}
                    {rep.active && !rep.acceptedAt && (
                      <button onClick={() => resend(rep)} disabled={busy} className={BTN_QUIET}>
                        <Mail size={13} /> Resend invite
                      </button>
                    )}
                    <button
                      onClick={() => setActive(rep, !rep.active)}
                      disabled={busy}
                      className={BTN_QUIET}
                    >
                      {rep.active ? (
                        <>
                          <UserX size={13} /> Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck size={13} /> Reactivate
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground max-w-2xl">
        Reps are deactivated, never deleted — their attributions and commission
        ledger are the record of who brought which company in and what FieldQuo
        owed for it. The attribution code is fixed after creation for the same
        kind of reason: changing it would stop crediting every link already
        handed out, silently.
      </p>
    </div>
  );
}
