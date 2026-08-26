// app/platform/crew-lines/page.js
//
// Crew texting, from the side that owns the Twilio account.
//
// ── Why this page exists ───────────────────────────────────────────────────
//
// Every fact on it used to be on the CONTRACTOR's screen, under a "Setup
// details" disclosure on /app/crew-inbox: the number's raw Twilio smsUrl, and
// this deployment's `/api/crew/inbound` webhook URL rendered as if it were a
// link. The owner clicked it and got a blank page — it is POST-only — and then
// asked the better question: why is a contractor being shown FieldQuo's
// internal plumbing at all? He isn't, any more. FieldQuo buys the numbers and
// lends them, the way it does with Retell on the voice side.
//
// ── The failure it is really here for ──────────────────────────────────────
//
// Webhook drift. A number whose smsUrl points at a preview deployment keeps a
// green tick in our own row and delivers a tenant's crew photos into a branch
// database — invisible from inside the tenant account, invisible from our row,
// visible only by asking Twilio and comparing. The voice side learned this the
// expensive way. The comparison is lib/crew/lineAudit.js, executed by
// check:crew-inbox rather than trusted to a person opening this page.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, AlertTriangle, MessageSquare, Check, Copy, ShieldAlert,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function CrewLinesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/platform/crew-lines"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function copy(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  if (loading) return <div className="animate-pulse h-96 bg-accent rounded-xl" />;

  if (!data)
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">{error || "Couldn't load crew lines."}</p>
      </div>
    );

  const { deployment, lines, orphans, counts, numbersError } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare size={20} /> Crew lines
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The numbers FieldQuo&apos;s Twilio account holds, who is holding each one, and
          where its texts are actually being delivered. Read-only — repointing a number
          decides which tenant receives which crew&apos;s photos, so it is done through the
          claim flow, not from here.
        </p>
      </div>

      {/* ── Can this deployment run the feature at all ──────────────────────
          The blocker a contractor now reads as "FieldQuo is still getting it set
          up". This is the same state with the cause attached, in front of the
          person who can clear it. */}
      {!deployment.signatureConfigured && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
          <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground space-y-1">
            <p className="font-bold">
              Crew texting is off for EVERY tenant on this deployment.
            </p>
            <p>
              <code className="px-1 py-0.5 rounded bg-background border border-border">
                {deployment.missingEnv.join(", ")}
              </code>{" "}
              isn&apos;t set, so <code>/api/crew/inbound</code> refuses every inbound
              message with a 401. An API key can send texts and manage numbers but
              cannot verify an inbound signature — it is an HMAC keyed on the
              account&apos;s auth token specifically — which is why this is checked
              apart from the rest of the Twilio credentials.
            </p>
            <p className="text-muted-foreground">
              Set it in Vercel and redeploy. Until then no number can be claimed:
              claiming would repoint it at an endpoint that rejects everything.
            </p>
          </div>
        </div>
      )}

      {!deployment.twilioConfigured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          No Twilio credentials on this deployment, so the number list below could not
          be read at all. It is empty because nothing was asked, not because the account
          is empty.
        </div>
      )}

      {numbersError && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          Twilio refused the number list: {numbersError}
        </div>
      )}

      {/* ── The address to paste into Twilio ────────────────────────────────
          Not a link, and labelled with what it is. It is a POST-only webhook
          endpoint: a browser opening it renders nothing, which is exactly how it
          came to look like a broken page on the tenant screen. */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-foreground">Inbound webhook</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Paste this into a number&apos;s <em>A message comes in</em> field in the Twilio
          console (method POST). It is an API endpoint, not a page — opening it in a
          browser correctly shows nothing. Claiming a number from a tenant&apos;s crew
          inbox sets it automatically; this is here for a number wired by hand.
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <code className="px-2 py-1 rounded bg-background border border-border text-xs break-all">
            {deployment.webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => copy(deployment.webhookUrl, "hook")}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            {copied === "hook" ? <Check size={13} /> : <Copy size={13} />}
            {copied === "hook" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Numbers held" value={counts.held} />
        <Stat label="Claimed" value={counts.claimed} />
        <Stat label="Free to lend" value={counts.free} />
        <Stat label="Drifting" value={counts.drifting} bad={counts.drifting > 0} />
        <Stat label="Orphaned" value={counts.orphaned} bad={counts.orphaned > 0} />
      </div>

      {/* The env var names a number; naming is not owning. Probing the account
          once found it holding none, which is the whole reason every path here
          asks Twilio instead of trusting configuration. */}
      {deployment.sharedLineEnv && !deployment.sharedLineHeld && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          <code className="px-1 py-0.5 rounded bg-background border border-border text-xs">
            TWILIO_PHONE_NUMBER
          </code>{" "}
          names {deployment.sharedLineEnv}, and this Twilio account does not hold an
          SMS-capable number with that address. The &quot;shared test line&quot; that
          variable describes is not there to lend.
        </div>
      )}

      {lines.length === 0 && !orphans.length ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MessageSquare size={20} className="mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mt-3">
            This Twilio account holds no SMS-capable numbers.
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Every tenant&apos;s crew inbox correctly says FieldQuo hasn&apos;t got a
            number to give them. Buy one in the Twilio console and it appears here and
            on their screens.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...lines, ...orphans].map((l) => (
            <LineRow key={l.e164} line={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, bad }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div
        className={`text-xl font-bold tabular-nums ${
          bad ? "text-red-600 dark:text-red-400" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function LineRow({ line }) {
  const alarm = line.drift || line.missingAtProvider;
  return (
    <div
      className={`rounded-xl border p-4 ${
        alarm
          ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold text-foreground tabular-nums">{line.e164}</span>
        {/* null is "we couldn't ask", not "no". Padding an unknown with a
            default is how an absent statement becomes an invented one. */}
        {line.mms === false && (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            SMS only — no MMS, so no photos
          </span>
        )}
        {line.claim ? (
          <Link
            href={`/platform/companies/${line.claim.companyId}`}
            className="text-xs text-muted-foreground underline"
          >
            {line.claim.companyName || line.claim.companyId}
          </Link>
        ) : (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            free to lend
          </span>
        )}
        {line.claim?.source === "shared_test" && (
          <span className="text-xs text-muted-foreground">
            shared test loan
            {line.claim.expiresAt
              ? ` · ${line.claim.expired ? "expired" : "until"} ${new Date(
                  line.claim.expiresAt,
                ).toLocaleDateString()}`
              : ""}
          </span>
        )}
      </div>

      {line.missingAtProvider && (
        <p className="text-sm text-foreground mt-2 flex items-start gap-1.5">
          <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
          Claimed by a company, and Twilio does not list it. Either it was released at
          the provider without releasing the row, or these credentials now point at a
          different Twilio account. Their crew line can never receive anything.
        </p>
      )}

      {/* The drift sentence comes from the audit, not from the capability
          verdict. In a drift the verdict reads "ready" — our row says connected,
          to the URL we expect — and that agreement with itself IS the failure. */}
      {line.driftMessage && (
        <p className="text-sm text-foreground mt-2 flex items-start gap-1.5">
          <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
          {line.driftMessage}
        </p>
      )}

      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium">Twilio delivers to: </dt>
          <dd className="inline break-all">
            {line.smsUrl || (
              <span className="italic">
                nothing — no message webhook is set on this number
              </span>
            )}
          </dd>
        </div>
        {line.claim && (
          <div>
            <dt className="inline font-medium">Verdict: </dt>
            <dd className="inline">
              {line.claim.ready ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  <Check size={11} className="inline" /> {line.claim.opsMessage}
                </span>
              ) : (
                <span>
                  {line.claim.reason} — {line.claim.opsMessage}
                </span>
              )}
            </dd>
          </div>
        )}
        {line.claim && !line.claim.enabled && (
          <div className="text-amber-700 dark:text-amber-400">
            Company.crewInboxEnabled is false, so the inbound webhook drops their
            messages even when everything else lines up.
          </div>
        )}
        {line.sid && (
          <div>
            <dt className="inline font-medium">SID: </dt>
            <dd className="inline break-all">{line.sid}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
