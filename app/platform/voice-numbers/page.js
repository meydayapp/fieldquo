// app/platform/voice-numbers/page.js
//
// FieldQuo's Retell phone estate: what we are billed for, and who is using it.
//
// ── The question this page was built to answer ─────────────────────────────
//
// "If a number is released, do we get to keep it, because we bought it — or do
// we go on paying every month?" We go on paying, right up until someone calls
// delete-phone-number, at which point the number is gone for good. Which means
// the expensive state is the silent one: a number Retell holds that no tenant
// holds. Nobody complains about it, no tenant screen shows it, and our own
// tables agree with themselves for ever.
//
// So the important column here is the one that reads "nobody". Same shape as
// /platform/crew-lines on the Twilio side, and for the same reason.
//
// ── No money total, deliberately ───────────────────────────────────────────
//
// Retell's published list price is not an invoice line, and lib/voice/
// providerCost.js is emphatic that a provider cost we have not READ must never
// be padded with a constant — the first real invoice anyone checked was 8.8%
// off the number this codebase had assumed. So this counts numbers and names
// them; the invoice is the authority on what they cost.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, AlertTriangle, Check, PhoneOff, Phone, Copy,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function VoiceNumbersPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/platform/voice-numbers"));
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
        <p className="text-sm text-foreground">{error || "Couldn't load the number estate."}</p>
      </div>
    );

  const { deployment, lines, orphans, counts, providerError, multiHolders } = data;
  const unheld = lines.filter((l) => l.unheld);
  const holders = lines.filter((l) => !l.unheld);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Phone size={20} /> Voice numbers
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every number FieldQuo&apos;s Retell account is billed for, and which company holds
          it. Read-only — releasing a number destroys a contractor&apos;s phone line for
          good, so it is done by the owner from their own settings, never from here.
        </p>
      </div>

      {!deployment.voiceConfigured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          <code className="px-1 py-0.5 rounded bg-background border border-border text-xs">
            {deployment.missingEnv.join(", ")}
          </code>{" "}
          isn&apos;t set on this deployment, so Retell was never asked anything. The list
          below is empty because nothing was asked, not because the account is empty.
        </div>
      )}

      {providerError && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          Retell refused the number list: {providerError}. Nothing below can be trusted as
          a comparison — the provider side is missing, not empty.
        </div>
      )}

      {/* The pagination stopped early. Said out loud, because a partial provider
          list read as a whole account reports live numbers as orphaned — which
          is the alarm this page is for, fired at the wrong thing. */}
      {deployment.voiceConfigured && !providerError && !deployment.listComplete && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-foreground">
          Retell had more numbers than this read fetched, so the comparison below is
          incomplete. Anything shown as orphaned may simply be on a page nobody asked for.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="At Retell" value={counts.atProvider} />
        <Stat label="Held by a company" value={counts.held} />
        <Stat label="Nobody holds" value={counts.unheld} bad={counts.unheld > 0} />
        <Stat label="Said released" value={counts.markedReleased} bad={counts.markedReleased > 0} />
        <Stat label="Gone at Retell" value={counts.orphaned} bad={counts.orphaned > 0} />
      </div>

      {/* ── The column the whole page is for ──────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-foreground">
          Numbers no company holds — FieldQuo pays, nobody uses
        </h2>
        <p className="text-xs text-muted-foreground">
          Retell bills this account for every one of these every month and no tenant is
          being charged rent for any of them. Retell&apos;s invoice is the authority on
          what each costs; releasing one is permanent and is done in the Retell dashboard
          after checking there is genuinely no company behind it.
        </p>
        {unheld.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            {deployment.voiceConfigured && !providerError
              ? "None. Every number Retell holds is held by a company."
              : "Nothing to compare — the provider side wasn't read."}
          </p>
        ) : (
          unheld.map((l) => <NumberRow key={l.e164} line={l} copy={copy} copied={copied} />)
        )}
      </section>

      {/* ── The other direction ───────────────────────────────────────────── */}
      {orphans.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">
            Numbers a company holds that Retell does not have
          </h2>
          <p className="text-xs text-muted-foreground">
            Their line can never ring. The contractor&apos;s own settings screen diagnoses
            this as a ghost and offers a Fix, but only if they open it — and an{" "}
            <strong>active</strong> row is still being charged rent every month for a
            number that does not exist.
          </p>
          {orphans.map((o) => (
            <div
              key={o.e164}
              className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold text-foreground tabular-nums">{o.e164}</span>
                <Company companyId={o.companyId} name={o.companyName} />
                <span className="text-xs text-muted-foreground">{o.status}</span>
              </div>
              <p className="text-sm text-foreground mt-2 flex items-start gap-1.5">
                <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                {o.billingRent
                  ? `Active on our side, absent at Retell — and the rent cron charges this company ${money(o.monthlyCents)} a month for it.`
                  : `Held on our side (${o.status}), absent at Retell. No rent is taken while it is not active.`}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* ── One company, two numbers ──────────────────────────────────────── */}
      {multiHolders.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-foreground">Companies holding more than one</h2>
          <p className="text-xs text-muted-foreground">
            Not necessarily wrong — a second trade or an ads line is a real product. Worth
            reading anyway, because the duplicate guard only started counting stalled rows
            after one company bought two numbers 31 seconds apart, and nothing reconciles
            the ones bought before that.
          </p>
          {multiHolders.map((m) => (
            <div key={m.companyId} className="rounded-xl border border-border bg-card p-4">
              <Company companyId={m.companyId} name={m.companyName} />
              <ul className="mt-2 space-y-1">
                {m.numbers.map((n) => (
                  <li key={n.e164} className="text-xs text-muted-foreground">
                    <span className="tabular-nums text-foreground">{n.e164}</span> · {n.status} ·{" "}
                    {n.source} · {money(n.monthlyCents)}/mo ·{" "}
                    {n.atProvider ? (
                      <span className="text-emerald-700 dark:text-emerald-400">at Retell</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">not at Retell</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Everything that is fine, last and quiet. */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-foreground">Held and accounted for</h2>
        {holders.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No number Retell holds is held by a company.
          </p>
        ) : (
          holders.map((l) => <NumberRow key={l.e164} line={l} copy={copy} copied={copied} />)
        )}
      </section>
    </div>
  );
}

function money(cents) {
  if (!Number.isFinite(Number(cents))) return "—";
  return `$${(Number(cents) / 100).toFixed(2)}`;
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

function Company({ companyId, name }) {
  if (!companyId) return <span className="text-xs text-muted-foreground">no company</span>;
  return (
    <Link
      href={`/platform/companies/${companyId}`}
      className="text-xs text-muted-foreground underline"
    >
      {name || companyId}
    </Link>
  );
}

/** Why nobody holds this number, in the terms that decide what to do about it. */
const UNHELD_COPY = {
  no_row:
    "No row of ours has ever mentioned this number. Either a purchase that completed at Retell and died before writing its row, or a number bought by hand in the Retell dashboard.",
  marked_released:
    "We marked this released and never told Retell. FieldQuo has been paying for it ever since, and no screen anywhere would have shown it.",
  row_failed:
    "The only row for this number is marked failed, so nothing on our side believes it exists — while Retell bills for it.",
};

function NumberRow({ line, copy, copied }) {
  const alarm = line.unheld;
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
        {line.holder ? (
          <>
            <Company companyId={line.holder.companyId} name={line.holder.companyName} />
            <span className="text-xs text-muted-foreground">
              {line.holder.status} · {line.holder.source} · {money(line.holder.monthlyCents)}/mo
              charged
            </span>
          </>
        ) : (
          <span className="text-xs font-medium text-red-700 dark:text-red-400 inline-flex items-center gap-1">
            <PhoneOff size={12} /> nobody holds this
          </span>
        )}
        <button
          type="button"
          onClick={() => copy(line.e164, line.e164)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Copy ${line.e164}`}
        >
          {copied === line.e164 ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {line.unheld && (
        <p className="text-sm text-foreground mt-2 flex items-start gap-1.5">
          <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
          {UNHELD_COPY[line.unheldReason] ||
            `No live row holds this number (last row: ${line.unheldReason}).`}
        </p>
      )}

      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline font-medium">Answering: </dt>
          <dd className="inline">
            {line.answering ? (
              <span className="break-all">agent {line.boundAgent || "(unnamed)"}</span>
            ) : (
              // Detached is how the on/off switch works — see attachAgent. So
              // "no agent" is a normal state for a switched-off receptionist and
              // is not by itself a fault.
              <span className="italic">
                no agent attached — the receptionist is off, or out of credit
              </span>
            )}
          </dd>
        </div>
        {line.nickname && (
          <div>
            <dt className="inline font-medium">Nickname at Retell: </dt>
            <dd className="inline break-all">{line.nickname}</dd>
          </div>
        )}
        {line.lapsed?.releasedAt && (
          <div>
            <dt className="inline font-medium">We marked it released: </dt>
            <dd className="inline">{new Date(line.lapsed.releasedAt).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
