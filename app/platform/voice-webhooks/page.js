// app/platform/voice-webhooks/page.js
//
// Where Retell is posting call events, and a way to put it right.
//
// The dashboard banner reported "calls billed by the hourly reconciler because
// Retell's webhook never delivered them" and gave nobody anything to press.
// This is the other half of that sentence.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const STATE_COPY = {
  ok: { label: "Posting here", tone: "text-emerald-700 dark:text-emerald-400" },
  wrong: { label: "Posting elsewhere", tone: "text-red-700 dark:text-red-400" },
  unknown: { label: "Couldn't read", tone: "text-muted-foreground" },
};

// Each reason gets its own sentence. "Wrong" is useless to somebody deciding
// whether to press a button that rewrites every agent they own.
const REASON_COPY = {
  points_elsewhere: "still pointed at a deployment that no longer exists",
  never_set: "never had a webhook URL written at all",
  empty: "has an empty webhook URL",
  // Deliberately empty: the row carries its own named diagnosis now, and one
  // generic sentence covering an unset key, a 401, a 429 and a timeout was the
  // whole complaint. See `problem` on each agent in the route.
  unreadable: "",
  no_expected_url: "we can't tell what it should be from here",
  matches: "",
};

/**
 * The reason most of the unreadable agents give, when they agree.
 *
 * Returns null when they DON'T agree — a mixture of causes is not one headline,
 * and inventing one would be the same overreach as inventing a verdict.
 */
function dominantProblem(rows = []) {
  const messages = rows
    .flatMap((r) => r.agents || [])
    .filter((a) => a?.state === "unknown" && a?.problem?.message)
    .map((a) => a.problem.message);
  if (messages.length === 0) return null;
  const first = messages[0];
  return messages.every((m) => m === first) ? first : null;
}

export default function VoiceWebhooksPage() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [errorText, setErrorText] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // ── The bug behind "Couldn't check the agents just now" ──────────────────
  //
  // Identical to the one on /platform/voice-economics, copied along with the
  // shape: `if (!res.ok)` against fetchJson, which returns the parsed BODY and
  // throws on failure. `.ok` was always undefined, so the error branch was the
  // only branch, and the fallback string was the only thing this page could
  // render. Nothing was ever wrong with the agents; nothing was ever checked.
  const load = useCallback(async () => {
    setState("loading");
    setErrorText(null);
    try {
      setData(await fetchJson("/api/platform/voice-webhooks"));
      setState("ready");
    } catch (err) {
      setErrorText(err.message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function repair() {
    setBusy(true);
    setResult(null);
    try {
      const body = await fetchJson("/api/platform/voice-webhooks", { method: "POST" });
      setResult({
        ok: true,
        text:
          `${body.repaired} repaired, ${body.alreadyOk} already correct` +
          (body.failed ? `, ${body.failed} couldn't be done` : "") +
          ".",
      });
      load();
    } catch (err) {
      // The route's own refusal sentence when it has one — "run this from the
      // live site" is the most likely, and it is a reason, not a fault.
      setResult({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const s = data?.summary;

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/platform" className="text-sm text-muted-foreground underline underline-offset-2">
        ← Platform
      </Link>
      <h1 className="text-2xl font-bold text-foreground mt-3">Call event delivery</h1>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
        Retell posts every call to us when it ends. An agent set up from a
        preview deployment or a laptop keeps that address forever — the phone
        still answers perfectly, and the events go nowhere. That is what the
        hourly reconciler is picking up afterwards.
      </p>

      {state === "loading" && (
        <p className="text-sm text-muted-foreground mt-6 flex items-center gap-2">
          <Loader2 size={15} className="animate-spin" /> Asking the provider about each agent…
        </p>
      )}

      {state === "error" && <p className="text-sm text-red-700 dark:text-red-400 mt-6">{errorText}</p>}

      {state === "ready" && data?.configured === false && (
        <p className="text-sm text-muted-foreground mt-6">
          The phone provider isn&apos;t configured on this deployment, so there are no agents to check.
        </p>
      )}

      {state === "ready" && data?.configured && (
        <>
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-foreground">
              {s.total === 0
                ? "No agents exist yet."
                : `${s.ok} of ${s.total} posting here` +
                  (s.wrong ? ` · ${s.wrong} posting elsewhere` : "") +
                  (s.unknown ? ` · ${s.unknown} couldn't be read` : "")}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 font-mono break-all">
              this deployment: {data.expected}
            </p>

            {/* One cause, said once. When the key is refused every agent is
                unreadable for the same reason, and repeating it per row buries
                the fact that it is a single fix. */}
            {s.unknown > 0 && dominantProblem(data.rows) && (
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-2">
                {dominantProblem(data.rows)}
              </p>
            )}

            {/* The refusal, explained rather than greyed out. Repairing from a
                preview would point every live agent at an address that stops
                existing — the same fault, inflicted on every tenant at once by
                the tool meant to cure it. */}
            {!data.canRepair && (
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-3 flex gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>
                  Repairing is only possible from the live site. From here it would write{" "}
                  <span className="font-mono">{data.expected}</span> onto every agent, and that
                  address stops existing when this deployment does.
                </span>
              </p>
            )}

            {data.canRepair && s.wrong > 0 && (
              <button
                type="button"
                onClick={repair}
                disabled={busy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-3.5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Point {s.wrong} agent{s.wrong === 1 ? "" : "s"} back here
              </button>
            )}

            {data.canRepair && s.wrong === 0 && s.total > 0 && s.unknown === 0 && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-3 flex items-center gap-1.5">
                <Check size={15} /> Every agent is posting to this deployment.
              </p>
            )}

            {result && (
              <p
                className={`text-sm mt-3 ${
                  result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                }`}
              >
                {result.text}
              </p>
            )}
          </div>

          {data.rows.length > 0 && (
            <div className="mt-5 space-y-2">
              {data.rows.map((row) => (
                <div key={row.companyId} className="rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {row.companyName || row.companyId}
                    </p>
                    {/* The symptom, per company, so the ones actually losing
                        events are the ones a human looks at first. */}
                    {row.recoveredCalls > 0 && (
                      <p className="text-xs text-amber-800 dark:text-amber-300 shrink-0">
                        {row.recoveredCalls} call{row.recoveredCalls === 1 ? "" : "s"} recovered in 7 days
                      </p>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {row.agents.map((a) => (
                      <li key={a.agentId} className="text-xs flex flex-wrap gap-x-2">
                        <span className={STATE_COPY[a.state]?.tone}>{STATE_COPY[a.state]?.label}</span>
                        {/* The named cause wins over the generic reason: a 401
                            and a timeout used to read the same, and one of them
                            means every other row says it too. */}
                        {a.problem?.message ? (
                          <span className="text-muted-foreground">— {a.problem.message}</span>
                        ) : REASON_COPY[a.reason] ? (
                          <span className="text-muted-foreground">— {REASON_COPY[a.reason]}</span>
                        ) : null}
                        {a.state === "wrong" && a.holds ? (
                          <span className="font-mono text-muted-foreground/70 break-all">{a.holds}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
