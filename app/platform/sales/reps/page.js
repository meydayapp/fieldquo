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
// ══ Deactivate, never delete ══════════════════════════════════════════════
//
// There is no delete control here, and the screen says why rather than leaving
// its absence to be noticed: a rep's attributions and ledger are history.
// Deactivating closes the door within one request — lib/sales/gate.js re-reads
// `active` on every call — and leaves the record standing.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Mail,
  Plus,
  UserCheck,
  UserX,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function PlatformSalesRepsPage() {
  const [reps, setReps] = useState([]);
  const [me, setMe] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReps(await fetchJson("/api/platform/sales/reps"));
      const who = await fetchJson("/api/platform/me").catch(() => null);
      if (who) setMe(who);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    setBusy(true);
    setError("");
    setNotice("");
    setWarning("");
    try {
      const created = await fetchJson("/api/platform/sales/reps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setDraft(null);
      // The send outcome is reported separately from the row being created,
      // because they genuinely can differ — lib/email/teamInvite.js's header is
      // the story of an invite that looked sent from every angle except the
      // recipient's inbox. "Invited" over a refused send would be the same lie.
      if (created.invite?.sent) {
        setNotice(`Invitation sent to ${created.email}.`);
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
    setError("");
    setNotice("");
    setWarning("");
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

  async function resend(rep) {
    setBusy(true);
    setError("");
    setNotice("");
    setWarning("");
    try {
      await fetchJson(`/api/platform/sales/reps/${rep.id}/invite`, {
        method: "POST",
      });
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

  const isSuperadmin = me?.role === "superadmin";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales reps</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            FieldQuo&apos;s own salespeople. A rep signs in at /sales and sees
            only the companies attributed to them — never a contractor&apos;s
            quotes, clients or revenue, and never anything they can write to.
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() => setDraft({ name: "", email: "", code: "" })}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
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

      {warning && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          {warning}
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {draft && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Invite a sales rep
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="rep-name"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Name
              </label>
              <input
                id="rep-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
              />
            </div>
            <div>
              <label
                htmlFor="rep-email"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Email
              </label>
              <input
                id="rep-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
              />
            </div>
            <div>
              <label
                htmlFor="rep-code"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                Code (optional)
              </label>
              <input
                id="rep-code"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="derived from the name"
                className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            They&apos;ll get an emailed link and choose their own password. The
            link works once and expires in seven days.
          </p>
          <div className="flex gap-2">
            <button
              onClick={invite}
              disabled={busy || !draft.name.trim() || !draft.email.trim()}
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Send
              invitation
            </button>
            <button
              onClick={() => setDraft(null)}
              className="text-sm font-medium text-muted-foreground px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : reps.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          No sales reps yet.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Rep</th>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Companies</th>
                  {isSuperadmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => (
                  <tr key={rep.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {rep.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rep.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {rep.code}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {!rep.active ? (
                        <span>Deactivated {formatDate(rep.endedAt)}</span>
                      ) : rep.acceptedAt ? (
                        <span>Active since {formatDate(rep.acceptedAt)}</span>
                      ) : (
                        <span>
                          Invited {formatDate(rep.invitedAt)} — not accepted yet
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {rep.companyCount}
                    </td>
                    {isSuperadmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {/* Only rendered when it would actually work: the
                              route refuses a resend for a rep who has already
                              set a password, or one who is deactivated. */}
                          {rep.active && !rep.acceptedAt && (
                            <button
                              onClick={() => resend(rep)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
                            >
                              <Mail size={13} /> Resend invite
                            </button>
                          )}
                          <button
                            onClick={() => setActive(rep, !rep.active)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
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
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground max-w-2xl">
        Reps are deactivated, never deleted — their attributions and commission
        ledger are the record of who brought which company in and what FieldQuo
        owed for it.
      </p>
    </div>
  );
}
