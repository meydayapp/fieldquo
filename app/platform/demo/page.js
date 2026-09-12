"use client";

// app/platform/demo/page.js
//
// The sales demo accounts, and the control that re-dresses one as a different
// trade.
//
// ── Why the trade is switchable at all ────────────────────────────────────
//
// An agent demoing to a landscaper should not be walking a prospect through a
// kitchen refinishing quote. The prospect spends the call translating every
// screen into their own trade instead of listening, and the question that
// decides the sale — "does this handle MY work?" — never gets answered.
//
// ── Switching is destructive, and says so ─────────────────────────────────
//
// It wipes that demo's quotes, jobs, clients and invoices. The button says
// that before you press it, with the counts, because a control that quietly
// destroys work is the failure this codebase keeps finding.
//
// ── A demo has no login UNTIL somebody makes one ──────────────────────────
//
// scripts/seed-demos.mjs creates the companies and NOT the logins: this
// codebase has no general server-side sign-up path (non-negotiable #1 — people
// arrive by invitation). So demo1@fieldquo.com starts as a label on the
// company, not an account.
//
// "Run the demo" below is how a PLATFORM ADMIN gets in without one: a signed,
// time-boxed session in demo_sandbox mode, which is the one impersonation mode
// allowed to WRITE — because running a demo means building a quote in front of
// a prospect, and a read-only session cannot. The mode is decided from
// Company.isDemo read out of the database, so it can never be minted for a
// real customer.
//
// A SALES REP cannot use that door — impersonation is superadmin-only — so a
// rep needs the second thing: a real login, minted by a superadmin through
// lib/demo/demoLogin.js, whose header carries the argument for why that one
// user creation does not breach non-negotiable #1.
//
// ── Who has which demo ────────────────────────────────────────────────────
//
// /sales/demo has always told a rep with no demo to "ask a FieldQuo admin to
// assign you one on the platform demo screen — it takes them a click". There
// was no click: SalesRep.demoCompanyId was read in three places and written in
// none. It is the "Assign" control below, and it does the whole chain in one
// press — assign the demo AND mint its login — because half the chain is a rep
// who has a demo they cannot sign into.

import { useEffect, useState, useCallback } from "react";
import { Loader2, RotateCcw, Beaker, AlertTriangle, PlayCircle, ExternalLink, UserPlus, UserMinus } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function PlatformDemoPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null); // `${companyId}:${industry}`
  const [entering, setEntering] = useState(null);
  // Which demo's "set a login" form is open, and what's typed in it.
  const [loginFor, setLoginFor] = useState(null);
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState(null);
  // Which demo's "assign to a rep" form is open, and what's chosen in it.
  const [assignFor, setAssignFor] = useState(null);
  const [assignRepId, setAssignRepId] = useState("");
  const [assignPassword, setAssignPassword] = useState("");
  const [assignMsg, setAssignMsg] = useState(null);
  const [reps, setReps] = useState([]);
  // A separate failure flag from loadFailed, and separately reported. The rep
  // list failing must not make the demo list look empty, and it must not fail
  // silently either — a dropdown with no reps in it reads as "no reps exist".
  const [repsFailed, setRepsFailed] = useState(false);

  // `loadFailed` is a state of its own. Without it a failed GET left `data`
  // null, `demos` fell back to [], and the page printed "No demo accounts yet"
  // with instructions to run the seed script — telling an agent between calls
  // that their demos are gone, and inviting them to re-seed over demos that
  // are in fact still there.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/demo");
    if (!res.ok) {
      setLoadFailed(true);
      await reportResponseError(res, "Couldn't load the demo accounts.");
      return;
    }
    setLoadFailed(false);
    setData(await res.json());
  }, []);

  const loadReps = useCallback(async () => {
    const res = await fetch("/api/platform/demo/assign");
    if (!res.ok) {
      setRepsFailed(true);
      await reportResponseError(res, "Couldn't load the sales reps.");
      return;
    }
    setRepsFailed(false);
    const body = await res.json();
    setReps(body.reps || []);
  }, []);

  useEffect(() => {
    Promise.all([load(), loadReps()]).finally(() => setLoading(false));
  }, [load, loadReps]);

  async function act(companyId, body, method) {
    setBusy(companyId);
    setConfirming(null);
    try {
      const res = await fetch("/api/platform/demo", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await reportResponseError(res, "That didn't work.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  /**
   * Open a demo company as its owner.
   *
   * Same endpoint the company detail page uses — the difference is entirely in
   * what comes back: for a company flagged isDemo, startImpersonation mints
   * demo_sandbox mode instead of read_only, which is the one mode allowed to
   * write. Nothing about the request asks for that; the server decides it from
   * the database.
   */
  async function enterDemo(company) {
    setEntering(company.id);
    try {
      const res = await fetch(
        `/api/platform/companies/${company.id}/impersonate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: `Sales demo — ${company.name}` }),
        },
      );
      if (!res.ok) {
        await reportResponseError(res, "Couldn't open that demo.");
        return;
      }
      // A new tab, so the platform console stays open behind it. An agent
      // mid-demo who needs to switch the trade or reset the data should not
      // have to navigate back out of the tenant app to do it.
      window.open("/app", "_blank", "noopener");
    } finally {
      setEntering(null);
    }
  }

  async function createLogin(company) {
    setLoginMsg(null);
    try {
      const res = await fetch("/api/platform/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginMsg({ tone: "bad", text: data.error || "Couldn't create that login." });
        return;
      }
      setLoginMsg({
        tone: "good",
        text: `Login created: ${data.email}. Sign in at /login with the password you just set.`,
      });
      setPassword("");
      await load();
    } catch {
      setLoginMsg({ tone: "bad", text: "Couldn't reach the server." });
    }
  }

  /**
   * Hand this demo to a rep — and, if a password was typed, mint its login in
   * the same press.
   *
   * The two halves are reported separately because they can genuinely differ:
   * assignment is any platform admin's to make, minting a credential is
   * superadmin-only, and an admin who is not a superadmin gets the assignment
   * plus an honest sentence about the login rather than a 403 that loses both.
   */
  async function assignDemo(company) {
    setBusy(company.id);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/platform/demo/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          salesRepId: assignRepId,
          // Empty string, not undefined, when nothing was typed — the route
          // skips the login half on a falsy password rather than inventing a
          // credential nobody asked for.
          password: assignPassword || "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssignMsg({ id: company.id, tone: "bad", text: body.error || "Couldn't assign that demo." });
        return;
      }
      setAssignMsg({
        // Carries the demo it is about. One piece of state for ten cards would
        // otherwise print "Assigned to Daniel" under every one of them.
        id: company.id,
        tone: body.loginError ? "bad" : "good",
        text: body.loginError
          ? `Assigned to ${body.rep.name}. The login was NOT created: ${body.loginError}`
          : body.loginReady
            ? `Assigned to ${body.rep.name}, and they can sign in as ${body.loginEmail}.`
            : `Assigned to ${body.rep.name}. They still have no login — set one below, or they cannot sign in.`,
      });
      setAssignPassword("");
      setAssignFor(null);
      await Promise.all([load(), loadReps()]);
    } catch {
      setAssignMsg({ id: company.id, tone: "bad", text: "Couldn't reach the server." });
    } finally {
      setBusy(null);
    }
  }

  /** Take a demo back into the pool. Clears one pointer; destroys nothing. */
  async function releaseDemo(company) {
    setBusy(company.id);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/platform/demo/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesRepId: company.salesRepDemo?.id }),
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't release that demo.");
        return;
      }
      await Promise.all([load(), loadReps()]);
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-32 bg-accent rounded-xl" />
      </div>
    );
  }

  const demos = data?.demos || [];
  const industries = data?.industries || [];

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      {/* Said once, at the top, because "what's the password" is the first
          thing anyone asks — and the answer is now "whichever one you set",
          which is a different answer from the one this panel used to give. */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm text-foreground font-medium">
          You do not need a password. A sales rep does.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use <strong>Run the demo</strong> on any card below: it opens that
          company in a new tab as its owner, for 30 minutes, and you can create
          quotes and invoices normally. A rep cannot use that door —
          impersonation is superadmin-only — so a rep signs into a demo of
          their <strong>own</strong>: seeded for them the first time they open
          their Demo page, one per trade, with a login they set the password
          on themselves (listed below, read-only). The pool on this screen is
          the platform’s; <strong>Assign</strong> still points a rep at one of
          these by hand if you ever need to, and mints its login. Switching the
          trade is what wipes a pool demo’s data — nothing is cleared by opening
          it, and nothing is cleared by releasing it.
        </p>
      </div>

      {repsFailed && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-sm text-foreground">
            The sales reps could not be read, so the assign controls are hidden
            rather than shown empty.
          </p>
          <button
            onClick={loadReps}
            className="mt-2 text-sm font-semibold text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Beaker size={22} /> Demo accounts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          One per sales agent. Switch the trade to match whoever they&apos;re
          showing it to.
        </p>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            The demo accounts could not be read.
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            They have not been deleted and no seed is needed — this is a failed
            request. Do not run the seed script on the strength of this screen.
          </p>
          <button
            onClick={load}
            className="mt-3 text-sm font-semibold text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {!loadFailed && demos.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">No demo accounts yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Create them by running the seed script, then invite each agent from
            Settings → Team on their company.
          </p>
          <code className="inline-block mt-3 text-xs bg-muted px-3 py-1.5 rounded">
            node --import ./scripts/alias-loader.mjs scripts/seed-demos.mjs
          </code>
        </div>
      )}

      <div className="space-y-3">
        {demos.map((d) => {
          const hasContent = d._count.quotes + d._count.jobs + d._count.clients > 0;
          return (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="w-9 h-9 rounded-lg shrink-0"
                  style={{ backgroundColor: d.brandColor || "#64748b" }}
                  aria-hidden
                />
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-semibold text-foreground">{d.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <code>{d.slug}</code> · {d.demoIndustry || "no trade set"} ·{" "}
                    {d._count.quotes} quotes, {d._count.jobs} jobs, {d._count.clients} clients
                  </p>
                </div>
                {/* ── Reset is the MORE destructive of the two, and had the
                    weaker guard ─────────────────────────────────────────────
                    Switching the trade asks twice and prints the counts;
                    Reset — which calls resetDemo() and clears exactly the same
                    quotes, jobs, clients and invoices — went on the first
                    click, labelled with one neutral word, with the only
                    warning in a `title` attribute that a touch device never
                    shows and a mouse shows after half a second of hovering.
                    Same speed bump as its sibling now, for the same reason:
                    the destructive thing must not be the easy one. */}
                <button
                  type="button"
                  disabled={busy === d.id}
                  onClick={() =>
                    hasContent && confirming !== `${d.id}:reset`
                      ? setConfirming(`${d.id}:reset`)
                      : act(d.id, { companyId: d.id }, "POST")
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-muted disabled:opacity-50 ${
                    confirming === `${d.id}:reset`
                      ? "border-amber-500 text-amber-700 dark:text-amber-400 font-semibold"
                      : "border-border text-foreground"
                  }`}
                >
                  {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {confirming === `${d.id}:reset` ? "Press again to clear it" : "Reset"}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Change trade
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {industries.map((ind) => {
                    const current = d.demoIndustry === ind.key;
                    const key = `${d.id}:${ind.key}`;
                    return (
                      <button
                        key={ind.key}
                        type="button"
                        disabled={busy === d.id || current}
                        onClick={() =>
                          // Confirm only when there's something to lose. An
                          // empty demo doesn't need a speed bump, and a
                          // confirmation people always dismiss stops being one.
                          hasContent && confirming !== key
                            ? setConfirming(key)
                            : act(d.id, { companyId: d.id, industry: ind.key }, "PATCH")
                        }
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                          current
                            ? "bg-inverted text-inverted-foreground border-transparent"
                            : confirming === key
                              ? "border-amber-500 text-amber-700 dark:text-amber-400 font-semibold"
                              : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {confirming === key ? "Press again to confirm" : ind.label}
                      </button>
                    );
                  })}
                </div>

                {/* ── The client-facing surfaces, clickable ────────────────
                    Half a demo is showing the prospect what THEIR customer
                    sees — the booking page, the instant quote, the website.
                    Those all live at public URLs derived from the slug, and
                    finding them meant knowing the URL shape by heart.

                    Opened in new tabs, and deliberately NOT behind the
                    impersonation session: a homeowner reaching these is signed
                    out, which is exactly the state they should be demoed in. */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    // The website only exists once somebody publishes one.
                    // Linked conditionally rather than always: a dead link
                    // mid-demo is worse than no link, and every demo 404'd
                    // here until this was checked against production.
                    ...(d.sitePublished && d.site
                      ? [["Website", `https://${d.slug}.fieldquo.com`]]
                      : []),
                    ["Booking page", `/book/${d.slug}`],
                    ["Instant quote", `/instant-quote/${d.slug}`],
                    ["Request a quote", `/quote/${d.slug}`],
                  ].map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-full px-2.5 py-1"
                    >
                      {label}
                      <ExternalLink size={11} />
                    </a>
                  ))}
                  {!(d.sitePublished && d.site) && (
                    <span className="inline-flex items-center text-xs text-muted-foreground px-2.5 py-1">
                      No website published — build one in the demo to show it
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => enterDemo(d)}
                    disabled={entering === d.id}
                    className="inline-flex items-center gap-2 bg-foreground text-background text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    {entering === d.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <PlayCircle size={14} />
                    )}
                    Run the demo
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Opens this company as its owner. You can create quotes and
                    invoices — it&apos;s a fixture, not a customer.
                  </span>

                  {d.members?.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Login: <code>{d.members[0].user?.email}</code>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setLoginFor(loginFor === d.id ? null : d.id);
                        setLoginMsg(null);
                        setPassword("");
                      }}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                    >
                      {loginFor === d.id ? "Cancel" : "Set a login"}
                    </button>
                  )}
                </div>

                {loginFor === d.id && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Creates <code>{d.slug}@fieldquo.com</code> as an owner of
                      this demo. The address is derived from the slug — it
                      can&apos;t be pointed anywhere else.
                    </p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password — at least 12 characters"
                        className="flex-1 min-w-[16rem] text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={() => createLogin(d)}
                        disabled={password.length < 12}
                        className="text-sm font-semibold bg-foreground text-background rounded-lg px-3 py-1.5 disabled:opacity-40"
                      >
                        Create
                      </button>
                    </div>
                    {loginMsg && (
                      <p
                        className={`text-xs mt-2 ${
                          loginMsg.tone === "good"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {loginMsg.text}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Who has it, and can they sign in ──────────────────────
                    The two facts that decide whether /sales/demo is usable,
                    side by side, because they fail independently: a demo can
                    be assigned with no login (the rep sees an address they
                    cannot use) or have a login with nobody assigned (nobody
                    can reach it through the portal at all). */}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Assigned to
                  </p>
                  {d.salesRepDemo ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-foreground">
                        {d.salesRepDemo.name}{" "}
                        <span className="text-muted-foreground text-xs">
                          ({d.salesRepDemo.email})
                        </span>
                      </span>
                      {d.members?.length ? null : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle size={12} />
                          No login yet — they cannot sign in
                        </span>
                      )}
                      {/* Two presses, like every other control on this card.
                          Releasing destroys nothing, but it does pull a demo
                          out from under whoever is holding it. */}
                      <button
                        type="button"
                        disabled={busy === d.id}
                        onClick={() =>
                          confirming === `${d.id}:release`
                            ? releaseDemo(d)
                            : setConfirming(`${d.id}:release`)
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs hover:bg-muted disabled:opacity-50 ${
                          confirming === `${d.id}:release`
                            ? "border-amber-500 text-amber-700 dark:text-amber-400 font-semibold"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {busy === d.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserMinus size={12} />
                        )}
                        {confirming === `${d.id}:release`
                          ? "Press again to release"
                          : "Release"}
                      </button>
                    </div>
                  ) : repsFailed ? (
                    <p className="text-xs text-muted-foreground">
                      Nobody. The rep list could not be read, so there is
                      nothing to choose from — retry it above.
                    </p>
                  ) : reps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nobody, and there are no sales reps who can sign in yet.
                      Add one under Platform → Sales.
                    </p>
                  ) : assignFor === d.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={assignRepId}
                          onChange={(e) => setAssignRepId(e.target.value)}
                          className="flex-1 min-w-[12rem] text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-foreground"
                        >
                          <option value="">Choose a rep…</option>
                          {reps.map((r) => (
                            <option key={r.id} value={r.id} disabled={Boolean(r.demoCompanyId)}>
                              {r.name}
                              {r.demoCompanyId ? " — already has one" : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={assignPassword}
                          onChange={(e) => setAssignPassword(e.target.value)}
                          placeholder={
                            d.members?.length
                              ? "Login already exists — leave blank"
                              : "Password for their login — 12+ characters"
                          }
                          disabled={Boolean(d.members?.length)}
                          className="flex-1 min-w-[16rem] text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground disabled:opacity-50"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => assignDemo(d)}
                          disabled={
                            !assignRepId ||
                            busy === d.id ||
                            // A password that is present but too short would be
                            // refused by the route AFTER assigning — better to
                            // refuse it here than to half-succeed.
                            (assignPassword.length > 0 && assignPassword.length < 12)
                          }
                          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-foreground text-background rounded-lg px-3 py-1.5 disabled:opacity-40"
                        >
                          {busy === d.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <UserPlus size={13} />
                          )}
                          {d.members?.length || !assignPassword
                            ? "Assign"
                            : "Assign + create login"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignFor(null);
                            setAssignMsg(null);
                          }}
                          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                        {!d.members?.length && !assignPassword && (
                          <span className="text-xs text-muted-foreground">
                            Without a password they get the demo but no way in.
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignFor(d.id);
                        setAssignRepId("");
                        setAssignPassword("");
                        setAssignMsg(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted"
                    >
                      <UserPlus size={12} /> Assign to a rep
                    </button>
                  )}
                  {assignMsg?.id === d.id && busy !== d.id && (
                    <p
                      className={`text-xs mt-2 ${
                        assignMsg.tone === "good"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {assignMsg.text}
                    </p>
                  )}
                </div>

                {/* Release is confirmed with the same `confirming` key shape
                    but must NOT print this: it clears no quotes, no jobs and
                    no clients, and a warning that says it does is the
                    destructive-operation-labelled-as-cosmetic failure running
                    backwards. Its own warning is on its own button. */}
                {confirming?.startsWith(`${d.id}:`) && confirming !== `${d.id}:release` && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-1.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    This clears {d._count.quotes} quotes, {d._count.jobs} jobs and{" "}
                    {d._count.clients} clients on this demo. The login and the{" "}
                    <code>{d.slug}</code> address stay the same
                    {confirming === `${d.id}:reset`
                      ? `, and so does the trade (${d.demoIndustry || "none set"}).`
                      : "."}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── The reps' own demos — visible, not editable ─────────────────────
          Since 2026-09-12 a rep gets a company seeded FOR them (one per
          trade) instead of a pool demo — lib/sales/repDemo.js. They appear
          here so the console can see everything (non-negotiable #3), and
          carry no Reset, Assign or Switch trade: those are the rep's own
          controls on /sales/demo, and a reset from here would land
          mid-walkthrough with nothing on the rep's screen to explain it.
          Retired copies are listed too, because nothing is deleted. */}
      {!loadFailed && (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Reps’ own demos</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Seeded automatically for each rep, one per trade, from the same
              presets as the pool above. Read-only here: a rep opens, resets and
              adds trades from their own Demo page, and a reset retires the copy
              rather than wiping it — retired copies stay listed and count
              nowhere.
            </p>
          </div>
          {(data?.repDemos || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet — a rep’s first demo is created the first time they open
              their Demo page or accept their invitation.
            </p>
          ) : (
            (data?.repDemos || []).map((d) => (
              <div
                key={d.id}
                className={`rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${d.demoRetiredAt ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground break-words">
                    {d.name}
                    {d.demoRetiredAt ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        retired {new Date(d.demoRetiredAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <code>{d.slug}</code> · {d.demoIndustry || "no trade"} ·{" "}
                    {d.demoOwnerRep ? `${d.demoOwnerRep.name} (${d.demoOwnerRep.email})` : "owner rep unknown"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {d._count.quotes} quotes · {d._count.jobs} jobs · {d._count.clients} clients
                  {d.authOrgId ? "" : " · no login yet"}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
