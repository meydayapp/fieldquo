"use client";

// app/sales/agency/page.js
//
// The call-centre agency's screen: its team, adding a rep, deactivating and
// re-inviting one, and its own floor — only its team's.
//
// ══ Who sees this ═════════════════════════════════════════════════════════
//
// A SalesRep of kind "agency" (lib/sales/agency.js quotes the owner's brief
// in full). The rail draws the My team row for that account alone
// (lib/sales/portalTabs.js portalTabsFor), and every route behind this page
// refuses anyone else with 403 — the row is a convenience, the route is the
// gate. A rep who types the URL sees the refusal sentence, not a blank team.
//
// ══ What the agency can and cannot do from here ═══════════════════════════
//
// Add a rep: a name, an email, the languages they sell in. Nothing else —
// the kind, the engagement, the manager and the commission plan are forced
// server-side, and the form does not draw controls for them because a
// control the server ignores is a control that appears to work and doesn't.
// Deactivate / reactivate: the platform's own gate, with the same hand-off
// when the rep holds prospects or open leads, narrowed so work moves only
// inside the team. Resend an invitation. Read the team's results and floor.
// The phone number and the work mailbox are FieldQuo's to assign; the row
// says so until both are there.
import { useCallback, useEffect, useState } from "react";
import { Building2, Copy, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { centsToMoney } from "@/lib/sales/money";
import { describeDuration } from "@/lib/sales/calls/agentState";
import { LANGUAGES } from "@/app/i18n/languages";

// 44px on a phone, the portal's rule since the 2026-09-13 audit
// (docs/screens/sales-mobile/README.md); the denser 40px from lg up.
const BTN =
  "inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} bg-primary text-primary-foreground`;
const BTN_QUIET = `${BTN} border border-border text-foreground`;
const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
const CARD = "rounded-xl border border-border bg-card p-4";

/** The catalogue key for a floor state or a pause reason. */
const STATE_KEY = {
  offline: "app.salesAgency.state.offline",
  available: "app.salesAgency.state.available",
  on_call: "app.salesAgency.state.on_call",
  after_call: "app.salesAgency.state.after_call",
  paused: "app.salesAgency.state.paused",
};
const PAUSE_KEY = {
  break: "app.salesAgency.pause.break",
  lunch: "app.salesAgency.pause.lunch",
  dinner: "app.salesAgency.pause.dinner",
  meeting: "app.salesAgency.pause.meeting",
  training: "app.salesAgency.pause.training",
  admin: "app.salesAgency.pause.admin",
  technical: "app.salesAgency.pause.technical",
  other: "app.salesAgency.pause.other",
};

function setupSentence(m, t) {
  if (m.hasNumber && m.hasWorkEmail) return t("app.salesAgency.setupReady");
  const missing =
    !m.hasNumber && !m.hasWorkEmail
      ? t("app.salesAgency.missingBoth")
      : !m.hasNumber
        ? t("app.salesAgency.missingNumber")
        : t("app.salesAgency.missingMailbox");
  return t("app.salesAgency.setupPending", { missing });
}

export default function SalesAgencyPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", sellsIn: [] });
  // rep id → the hand-off panel the 409 opened: counts and the choice.
  const [handoff, setHandoff] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/sales/agency"));
      setFailed("");
    } catch (err) {
      setFailed(err?.code === "not_agency" ? "not_agency" : "load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addRep(e) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const created = await fetchJson("/api/sales/agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, email: draft.email, sellsIn: draft.sellsIn }),
      });
      setNotice(
        created.invite?.sent
          ? t("app.salesAgency.addedSent", { email: created.rep.email })
          : t("app.salesAgency.addedNotSent", { email: created.rep.email, error: created.invite?.error || "" }),
      );
      setDraft({ name: "", email: "", sellsIn: [] });
      await load();
    } catch (err) {
      setNotice(err?.message || t("app.salesAgency.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function setActive(m, active, chosen = null) {
    setBusy(true);
    setNotice("");
    try {
      const body = { active };
      if (chosen) body.handoff = chosen;
      await fetchJson(`/api/sales/agency/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setHandoff(null);
      setNotice(active ? t("app.salesAgency.reactivated", { name: m.name }) : t("app.salesAgency.deactivated", { name: m.name }));
      await load();
    } catch (err) {
      // 409 with counts: the rep holds work. Open the hand-off panel with
      // the server's numbers rather than the screen's, which may be stale.
      if (err?.status === 409 && err?.data?.counts) {
        setHandoff({ repId: m.id, counts: err.data.counts, mode: "release", toRepId: "" });
      } else {
        setNotice(err?.message || t("app.salesAgency.actionFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend(m) {
    setBusy(true);
    setNotice("");
    try {
      await fetchJson(`/api/sales/agency/${m.id}/invite`, { method: "POST" });
      setNotice(t("app.salesAgency.resent", { email: m.email }));
      await load();
    } catch (err) {
      setNotice(err?.message || t("app.salesAgency.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text, id) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* the link is on screen; a failed copy is not worth a banner */
    }
  }

  if (failed === "not_agency") {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesAgency.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.salesAgency.notAgency")}</p>
      </div>
    );
  }

  const team = data?.team || [];
  const active = team.filter((m) => m.active);

  return (
    <div className="space-y-8 max-w-4xl" data-agency-page>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Building2 size={20} aria-hidden="true" /> {t("app.salesAgency.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("app.salesAgency.intro")}</p>
      </header>

      {failed === "load" ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="alert">{t("app.salesAgency.loadFailed")}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-foreground" role="status" data-agency-notice>
          {notice}
        </p>
      ) : null}

      {/* ── Add a rep ────────────────────────────────────────────────── */}
      <form onSubmit={addRep} className={`${CARD} space-y-3`} data-agency-add>
        <h2 className="text-base font-semibold text-foreground">{t("app.salesAgency.addHeading")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium text-foreground mb-1">{t("app.salesAgency.addName")}</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD} required />
          </label>
          <label className="block text-sm">
            <span className="block font-medium text-foreground mb-1">{t("app.salesAgency.addEmail")}</span>
            <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={FIELD} required />
          </label>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-foreground">{t("app.salesAgency.addSellsIn")}</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => {
              const on = draft.sellsIn.includes(l.code);
              return (
                <label key={l.code} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm cursor-pointer ${on ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setDraft({ ...draft, sellsIn: on ? draft.sellsIn.filter((c) => c !== l.code) : [...draft.sellsIn, l.code] })
                    }
                  />
                  {l.nativeName}
                </label>
              );
            })}
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">{t("app.salesAgency.addNote")}</p>
        <button type="submit" disabled={busy || !draft.name.trim() || !draft.email.trim()} className={BTN_PRIMARY}>
          {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : null}
          {t("app.salesAgency.addSubmit")}
        </button>
      </form>

      {/* ── The team ─────────────────────────────────────────────────── */}
      <section className="space-y-3" data-agency-team>
        <h2 className="text-base font-semibold text-foreground">
          {t("app.salesAgency.teamHeading")} {data ? `(${team.length})` : ""}
        </h2>
        {!data && !failed ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> {t("app.salesAgency.loading")}
          </p>
        ) : team.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.salesAgency.teamEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {team.map((m) => (
              <div key={m.id} className={`${CARD} space-y-2`} data-team-member={m.id} data-active={m.active ? "true" : "false"}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground break-words">
                      {m.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {!m.active
                          ? t("app.salesAgency.inactive")
                          : m.inviteState === "accepted"
                            ? t("app.salesAgency.active")
                            : m.inviteState === "expired"
                              ? t("app.salesAgency.inviteExpired")
                              : t("app.salesAgency.invited")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground break-all">{m.email}</p>
                    <p className={`text-xs ${m.needsSetup ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`} data-setup={m.needsSetup ? "pending" : "ready"}>
                      {setupSentence(m, t)}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-xs text-right shrink-0">
                    <dt className="text-muted-foreground">{t("app.salesAgency.colCallsToday")}</dt>
                    <dd className="tabular-nums text-foreground">{m.calls ? m.calls.today : "—"}</dd>
                    <dt className="text-muted-foreground">{t("app.salesAgency.colCallsWeek")}</dt>
                    <dd className="tabular-nums text-foreground">{m.calls ? m.calls.thisWeek : "—"}</dd>
                    <dt className="text-muted-foreground">{t("app.salesAgency.colSignups")}</dt>
                    <dd className="tabular-nums text-foreground">{m.signups.thisWeek} / {m.signups.total}</dd>
                    <dt className="text-muted-foreground">{t("app.salesAgency.colEarned")}</dt>
                    <dd className="tabular-nums text-foreground">{centsToMoney(m.earned.lifetimeCents)}</dd>
                  </dl>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input readOnly value={m.signupLink || ""} className={`${FIELD} sm:max-w-md font-mono text-xs`} aria-label={t("app.salesAgency.colLink")} />
                  <button type="button" onClick={() => copy(m.signupLink || "", m.id)} className={BTN_QUIET} disabled={!m.signupLink}>
                    <Copy size={14} aria-hidden="true" /> {copied === m.id ? t("app.salesAgency.copied") : t("app.salesAgency.copyLink")}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {m.active ? (
                    <button type="button" onClick={() => setActive(m, false)} disabled={busy} className={BTN_QUIET} data-deactivate={m.id}>
                      {t("app.salesAgency.deactivate")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => setActive(m, true)} disabled={busy} className={BTN_QUIET} data-reactivate={m.id}>
                      {t("app.salesAgency.reactivate")}
                    </button>
                  )}
                  {m.active && m.inviteState !== "accepted" ? (
                    <button type="button" onClick={() => resend(m)} disabled={busy} className={BTN_QUIET} data-resend={m.id}>
                      {t("app.salesAgency.resendInvite")}
                    </button>
                  ) : null}
                </div>

                {/* The hand-off, when the 409 said the rep holds work. The
                    counts are the server's. Work moves only inside the team
                    — the picker lists the other active reps here. */}
                {handoff?.repId === m.id ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-sm" data-handoff={m.id}>
                    <p className="text-foreground">
                      {t("app.salesAgency.handoffTitle", { name: m.name, prospects: handoff.counts.leased, leads: handoff.counts.openLeads })}
                    </p>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="handoff-mode" checked={handoff.mode === "release"} onChange={() => setHandoff({ ...handoff, mode: "release" })} />
                      {t("app.salesAgency.handoffRelease")}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="handoff-mode" checked={handoff.mode === "move"} onChange={() => setHandoff({ ...handoff, mode: "move" })} />
                      {t("app.salesAgency.handoffMove")}
                    </label>
                    {handoff.mode === "move" || handoff.counts.openLeads > 0 ? (
                      <select value={handoff.toRepId} onChange={(e) => setHandoff({ ...handoff, toRepId: e.target.value })} className={FIELD} aria-label={t("app.salesAgency.handoffPick")}>
                        <option value="">{t("app.salesAgency.handoffPick")}</option>
                        {active.filter((o) => o.id !== m.id).map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    ) : null}
                    {handoff.counts.openLeads > 0 ? (
                      <p className="text-xs text-muted-foreground">{t("app.salesAgency.handoffLeadsNeedRep")}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || ((handoff.mode === "move" || handoff.counts.openLeads > 0) && !handoff.toRepId)}
                        onClick={() => setActive(m, false, { prospects: handoff.mode, toRepId: handoff.toRepId || undefined })}
                        className={BTN_PRIMARY}
                      >
                        {t("app.salesAgency.handoffConfirm")}
                      </button>
                      <button type="button" onClick={() => setHandoff(null)} className={BTN_QUIET}>
                        {t("app.salesAgency.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <TeamFloor t={t} />
    </div>
  );
}

/**
 * The agency's floor — its team, live, from /api/sales/agency/floor. The
 * platform's board, narrowed (lib/sales/calls/floorBoard.js). Fifteen-second
 * refresh for the platform screen's reason: current enough for "on a call",
 * slow enough that a board left open all day is not a load test.
 */
function TeamFloor({ t }) {
  const [board, setBoard] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await fetchJson("/api/sales/agency/floor"));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="space-y-3" data-agency-floor>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("app.salesAgency.floorHeading")}</h2>
          <p className="text-sm text-muted-foreground">{t("app.salesAgency.floorIntro")}</p>
        </div>
        <button type="button" onClick={load} className={BTN_QUIET}>
          <RefreshCw size={14} aria-hidden="true" /> {t("app.salesAgency.refresh")}
        </button>
      </div>

      {failed ? <p className="text-sm text-amber-800 dark:text-amber-200" role="alert">{t("app.salesAgency.floorLoadFailed")}</p> : null}
      {board && !board.store?.ready ? (
        <p className="text-sm text-muted-foreground">{t("app.salesAgency.floorNotReady")}</p>
      ) : null}

      {board?.store?.ready ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {(board.reps || []).map((rep) => {
              const p = rep.presence;
              const declared = p?.everSeen !== false;
              const seenNotOnFloor = !declared && p?.everSignedIn === true;
              const state = p?.state || "offline";
              const s = rep.stats;
              return (
                <div key={rep.id} className={`${CARD} space-y-2`} data-floor-rep={rep.id} data-state={state}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground break-words">{rep.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {declared
                          ? `${t(STATE_KEY[state] || STATE_KEY.offline)}${p?.pauseReason ? ` — ${t(PAUSE_KEY[p.pauseReason] || PAUSE_KEY.other)}` : ""}${p?.forMs != null ? ` · ${describeDuration(p.forMs)}` : ""}`
                          : seenNotOnFloor
                            ? t("app.salesAgency.signedInNotOnFloor")
                            : t("app.salesAgency.neverSignedIn")}
                      </p>
                      {p?.stale ? (
                        <p className="text-xs text-muted-foreground">
                          {t("app.salesAgency.stale", { time: p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleTimeString() : "—" })}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-2xl font-semibold tabular-nums text-foreground shrink-0" title={t("app.salesAgency.dials")}>{s?.dials ?? 0}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">{t("app.salesAgency.reached")}</dt>
                    <dd className="text-right tabular-nums text-foreground">
                      {s?.reportedReachRate?.value != null
                        ? `${s.reportedReachRate.value}%`
                        : `${s?.reportedReachRate?.hit ?? 0} / ${s?.reportedReachRate?.sampleSize ?? 0}`}
                    </dd>
                    <dt className="text-muted-foreground">{t("app.salesAgency.notWrittenUp")}</dt>
                    <dd className="text-right tabular-nums text-foreground">{s?.dispositions?.pending ?? 0}</dd>
                    <dt className="text-muted-foreground">{t("app.salesAgency.timeOnCalls")}</dt>
                    <dd className="text-right tabular-nums text-foreground">{s?.onCallText || "—"}</dd>
                    <dt className="text-muted-foreground">{t("app.salesAgency.paused")}</dt>
                    <dd className="text-right tabular-nums text-foreground">{s?.pausedText || "—"}</dd>
                  </dl>
                </div>
              );
            })}
          </div>

          <div className={`${CARD} space-y-2`}>
            <h3 className="text-sm font-semibold text-foreground">{t("app.salesAgency.outcomesByTrade")}</h3>
            {(board.campaigns || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("app.salesAgency.floorEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3">{t("app.salesAgency.trade")}</th>
                      <th className="py-1 pr-3 text-right">{t("app.salesAgency.dials")}</th>
                      <th className="py-1 pr-3 text-right">{t("app.salesAgency.notWrittenUp")}</th>
                      <th className="py-1 text-right">{t("app.salesAgency.reached")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.campaigns.map((c) => (
                      <tr key={c.key} className="border-t border-border">
                        <td className="py-1.5 pr-3 break-words text-foreground">{c.label}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{c.dials}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{c.dispositions.pending}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {c.reportedReachRate?.value != null
                            ? `${c.reportedReachRate.value}%`
                            : `${c.reportedReachRate?.hit ?? 0} / ${c.reportedReachRate?.sampleSize ?? 0}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
