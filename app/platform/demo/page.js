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
// ── There is no login for a demo, and that is deliberate ──────────────────
//
// scripts/seed-demos.mjs creates the companies and NOT the logins: this
// codebase has no server-side sign-up path (non-negotiable #1 — people arrive
// by invitation), and adding a second user-creation route would be a hole in
// the rule it protects. So demo1@fieldquo.com is a label on the company, not
// an account, and no password for it exists anywhere.
//
// "Run the demo" below is how you get in: a signed, time-boxed session in
// demo_sandbox mode, which is the one impersonation mode allowed to WRITE —
// because running a demo means building a quote in front of a prospect, and a
// read-only session cannot. The mode is decided from Company.isDemo read out
// of the database, so it can never be minted for a real customer.

import { useEffect, useState, useCallback } from "react";
import { Loader2, RotateCcw, Beaker, AlertTriangle, PlayCircle, ExternalLink } from "lucide-react";
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

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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
          thing anyone asks and the honest answer is "there isn't one". */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm text-foreground font-medium">
          There is no demo login or password.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          The demos have no user accounts —{" "}
          <code className="text-[11px]">demo1@fieldquo.com</code> is a label on
          the company, not something you can sign in as. Use{" "}
          <strong>Run the demo</strong> on any card below: it opens that company
          in a new tab as its owner, for 30 minutes, and you can create quotes
          and invoices normally. Switching the trade is what wipes the data —
          nothing is cleared by opening it.
        </p>
      </div>

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

                {confirming?.startsWith(`${d.id}:`) && (
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
    </div>
  );
}
