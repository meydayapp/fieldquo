"use client";

// app/platform/sales-agent/page.js
//
// FieldQuo's own phone agent, end to end: what it knows, whether it is actually
// live, and what people have said to it.
//
// ── Why this screen exists ────────────────────────────────────────────────
//
// Two questions that had no answer anywhere.
//
// "What does it know?" — a sales agent that invents a feature costs a refund
// and a review, and the only way to catch that before a customer does is to
// read what it was given. So the literal prompt is on this page, in the same
// words the caller would hear. Not a summary, not a checklist of what we
// intended it to say.
//
// "Where are the transcripts?" — until now, nowhere. A call to FieldQuo's own
// number was not a tenant's VoicePhoneNumber, so the webhook logged it as an
// unknown number and threw it away. The call log below is the other half of
// that fix.
//
// ── The chain is the tenant one ──────────────────────────────────────────
//
// Same ten links, same resolver (lib/voice/readiness.js), same copy table
// (readinessCopy.js). A second opinion that disagreed with the first would be
// worse than none — and the failure mode this area is climbing out of is
// exactly a screen that reassured on the strength of our own columns.
//
// ── What may be edited here ───────────────────────────────────────────────
//
// The switch and the tone notes. Nothing else: the facts come from the feature
// registry and the Plan rows, and a text box to override them would be a home
// for a claim with no evidence behind it. Change a plan, or hide a feature, and
// this page changes with it.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  PhoneCall,
  Info,
  Sparkles,
  RefreshCw,
  Save,
} from "lucide-react";
import { LINK_LABEL, REASON_TEXT } from "@/lib/voice/readinessCopy";

const STATE_STYLE = {
  ok: {
    tone: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  fail: {
    tone: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300",
    Icon: AlertTriangle,
  },
  unknown: {
    tone: "border-border bg-muted text-muted-foreground",
    Icon: HelpCircle,
  },
};

const OVERALL = {
  ready: "Everything checked out. It should answer.",
  ready_with_warnings: "It should answer, with something to look at.",
  not_ready: "It will not answer. Something in the chain is broken.",
  unsure: "We could not check the whole chain, so nothing is claimed.",
};

const OWNER = {
  fieldquo: "FieldQuo's end",
  company: "A decision for you",
  unknown: "Could not tell",
};

export default function PlatformSalesAgentPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [openCall, setOpenCall] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/platform/sales-agent");
      const body = await res.json().catch(() => null);
      // Every failure branch produces a message. A bare `if (res.ok)` would
      // leave the spinner up forever on a 403 and read as a slow page.
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
      setData(body);
      setNotes(body.notes || "");
      setEnabled(Boolean(body.enabled));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(payload, label, success) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/platform/sales-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) throw new Error(parsed?.error || `Request failed (${res.status}).`);
      // The push can fail after the save succeeded — say so rather than
      // reporting a clean success over a provider that refused.
      if (parsed?.provision && parsed.provision.ok === false) {
        setNotice(`Saved, but the provider push failed: ${parsed.provision.reason}`);
      } else {
        setNotice(success);
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl">
        <Banner tone="fail" title="Couldn't load the sales agent." body={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  const { readiness, knowledge, prompt, greeting, tools, calls, contactUrl } = data;
  const dirty = notes !== (data.notes || "") || enabled !== Boolean(data.enabled);

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles size={20} className="text-[#ff5a00]" />
          FieldQuo&apos;s own phone agent
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          The agent that answers FieldQuo&apos;s own number and talks to
          prospects about FieldQuo. This is <strong>not</strong> the receptionist
          a contractor gets — that one is per company, inside their account.
        </p>
      </header>

      {error && <Banner tone="fail" title="That didn't work." body={error} />}
      {notice && <Banner tone="note" title={notice} />}

      {/* The verdict, before anything that could be mistaken for a working
          feature. Three-state on purpose: "we could not check" is a legitimate
          outcome and must not be drawn as a tick. */}
      <Banner
        tone={
          readiness.overall === "ready"
            ? "ok"
            : readiness.overall === "not_ready"
              ? "fail"
              : "note"
        }
        title={OVERALL[readiness.overall] || readiness.overall}
        body={
          readiness.number
            ? `On ${readiness.numberDisplay}. ${readiness.enabled ? "Switched on." : "Switched off — it will not answer."}`
            : `No number. Set ${readiness.numberVar} to a number bought on the Retell account, then push.`
        }
      />

      {readiness.numberProblems.length > 0 && (
        <section className="space-y-2">
          {readiness.numberProblems.map((p) => (
            <Banner
              key={`${p.e164}-${p.code}`}
              tone="fail"
              title={`${p.e164} — ${p.code.replace(/_/g, " ")}`}
              body={p.detail}
            />
          ))}
        </section>
      )}

      {readiness.transferIsSharedTestNumber && (
        <Banner
          tone="fail"
          title={`${readiness.transferVar} points at the shared test number.`}
          body="A caller put through would reach whichever tenant receptionist is being tested. Change it."
        />
      )}

      {/* ── The chain ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Every link between someone dialling and us hearing about it
        </h2>
        <ul className="space-y-2">
          {readiness.links.map((l) => {
            const s = STATE_STYLE[l.state] || STATE_STYLE.unknown;
            const Icon = s.Icon;
            return (
              <li key={l.id} className={`rounded-lg border p-3 flex items-start gap-3 ${s.tone}`}>
                <Icon size={16} className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{LINK_LABEL[l.id] || l.id}</p>
                  <p className="text-sm mt-0.5">
                    {REASON_TEXT[l.reasonKey] || l.reason}
                  </p>
                  {l.state === "fail" && (
                    <p className="text-xs mt-1 opacity-80">{OWNER[l.fixer] || l.fixer}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── The two things a person decides ────────────────────────────── */}
      <section className="border border-border rounded-xl p-4 bg-card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Settings
        </h2>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-foreground">Answer calls</span>
            <span className="block text-muted-foreground">
              Attaches the agent to {readiness.numberDisplay || "the number"} at
              the provider. Unticking detaches it, so the line rings out.
            </span>
          </span>
        </label>

        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="sales-notes">
            Tone notes
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Emphasis and phrasing only. They go last in the prompt, fenced, and
            cannot override the rules — no note can make it quote a price that
            is not in the plans or promise a date.
          </p>
          <textarea
            id="sales-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={3000}
            className="w-full border border-border rounded-lg p-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10"
            placeholder="e.g. Ask what trade they're in before anything else."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => send({ action: "save", enabled, notes }, "save", "Saved and pushed.")}
            disabled={Boolean(busy) || !dirty}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save and push
          </button>
          <button
            onClick={() => send({ action: "provision" }, "provision", "Pushed to the provider.")}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {busy === "provision" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Push the current prompt again
          </button>
        </div>
      </section>

      {/* ── The call log ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Calls to FieldQuo
        </h2>
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">
            Nothing yet. A call lands here once FieldQuo&apos;s number is set and
            the provider&apos;s events are getting through — the two links above
            that say so. Until then this is empty because nobody has rung, not
            because anything was thrown away.
          </p>
        ) : (
          <ul className="space-y-2">
            {calls.map((c) => (
              <li key={c.id} className="border border-border rounded-lg bg-card">
                <button
                  onClick={() => setOpenCall(openCall === c.id ? null : c.id)}
                  className="w-full text-left p-3 flex items-start gap-3"
                >
                  <PhoneCall size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {c.fromE164 || "Unknown caller"}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {c.startedAt ? new Date(c.startedAt).toLocaleString() : "—"}
                        {c.durationSec ? ` · ${Math.round(c.durationSec)}s` : ""}
                        {c.disposition ? ` · ${c.disposition}` : ""}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {c.summary || "No summary yet — the provider sends it after the call."}
                    </p>
                  </div>
                </button>
                {openCall === c.id && (
                  <div className="border-t border-border p-3 space-y-3">
                    {c.recordingUrl && (
                      <a
                        href={c.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline"
                      >
                        Recording
                      </a>
                    )}
                    <Transcript value={c.transcript} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── What it knows ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Where the knowledge comes from
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <FactCard
            title="Optional features"
            value={`${knowledge.features.length} offered`}
            source="lib/features/registry.js, resolved against the platform feature globals. Hidden and locked features are not mentioned at all."
          />
          <FactCard
            title="Core product"
            value={`${knowledge.core.categories.length} areas`}
            source="The permission grid in lib/permissions.js — every one is enforced per request, so the screen behind it exists."
          />
          <FactCard
            title="Prices"
            value={
              knowledge.plans.length ? `${knowledge.plans.length} quotable` : "none quotable"
            }
            source="Plan rows, filtered by the same sellability rule the public pricing page uses. Change a plan and the phone changes."
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Features it will talk about
        </h2>
        {knowledge.features.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">
            None. Every registry feature is hidden or locked globally, so the
            agent would describe only the core product.
          </p>
        ) : (
          <ul className="space-y-2">
            {knowledge.features.map((f) => (
              <li key={f.key} className="border border-border rounded-lg p-3 bg-card">
                <p className="text-sm font-medium text-foreground">
                  {f.label}
                  {f.preview && (
                    <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                      preview — said out loud as one
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{f.line}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Prices it may say
        </h2>
        {knowledge.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-border rounded-lg p-4">
            No plan can be bought right now, so the agent is told to refuse the
            price question rather than estimate one. This is the same state that
            empties the public pricing page.
          </p>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Per month</th>
                  <th className="p-3">Seats</th>
                  <th className="p-3">Quotes/mo</th>
                  <th className="p-3">AI</th>
                </tr>
              </thead>
              <tbody>
                {knowledge.plans.map((p) => (
                  <tr key={p.name} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium text-foreground">{p.name}</td>
                    <td className="p-3">{p.priceMonthly}</td>
                    {/* An unstated limit is shown as unstated, never as
                        "unlimited" — the agent says nothing about it either. */}
                    <td className="p-3 text-muted-foreground">
                      {p.maxUsers === null ? "not stated — not mentioned" : p.maxUsers}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.maxQuotesPerMonth === null
                        ? "not stated — not mentioned"
                        : p.maxQuotesPerMonth}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {p.aiCopilotEnabled
                        ? p.aiMonthlyTokenCap === null
                          ? "included, no cap"
                          : `included, ${p.aiMonthlyTokenCap.toLocaleString()} tokens/mo (never said aloud)`
                        : "not included"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {knowledge.withheldPlanCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {knowledge.withheldPlanCount} plan(s) held back — no Stripe price id,
            or not public. The agent is told its list is partial.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          What it can do
        </h2>
        <p className="text-sm text-muted-foreground">
          {tools.length === 0
            ? `Nothing. It has no tools, so it can only talk — and it is told to say it cannot put anyone through, and to send people to ${contactUrl}.`
            : `${tools.length} tool: ${tools.map((t) => t.name).join(", ")}.`}{" "}
          It has no tool that can read or write any company&apos;s data, which is
          why it cannot look up an account even if a caller asks it to.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          The first thing a caller hears
        </h2>
        <pre className="border border-border rounded-lg p-4 bg-card text-sm whitespace-pre-wrap break-words">
          {greeting}
        </pre>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          The exact prompt
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Rules first, derived facts second, tone notes last and fenced — the
          same layering as a contractor&apos;s receptionist, so an instruction
          added at the bottom cannot loosen a rule at the top.
        </p>
        <pre className="border border-border rounded-lg p-4 bg-card text-xs leading-relaxed whitespace-pre-wrap break-words max-h-[32rem] overflow-y-auto">
          {prompt}
        </pre>
      </section>
    </div>
  );
}

function Banner({ tone, title, body }) {
  const s =
    tone === "ok"
      ? STATE_STYLE.ok
      : tone === "fail"
        ? STATE_STYLE.fail
        : { tone: "border-border bg-muted text-muted-foreground", Icon: Info };
  const Icon = tone === "fail" ? AlertCircle : s.Icon;
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${s.tone}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {body && <p className="text-sm mt-1">{body}</p>}
      </div>
    </div>
  );
}

/**
 * Retell sends either `transcript_object` (an array of turns) or a plain
 * string, and which one arrives depends on the agent's settings. Both are
 * rendered rather than one being assumed — an empty panel where a transcript
 * should be is indistinguishable from a call that produced none.
 */
function Transcript({ value }) {
  if (!value) {
    return (
      <p className="text-sm text-muted-foreground">
        No transcript on this call.
      </p>
    );
  }
  if (typeof value === "string") {
    return (
      <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground">
        {value}
      </pre>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ol className="space-y-1.5">
        {value.map((turn, i) => (
          <li key={i} className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">
              {turn?.role || "?"}
            </span>
            <span className="text-foreground">{turn?.content ?? ""}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FactCard({ title, value, source }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-lg font-semibold text-foreground mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-2">{source}</p>
    </div>
  );
}
