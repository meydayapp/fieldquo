// app/platform/sales/capabilities/page.js
//
// What FieldQuo is allowed to promise a stranger.
//
// ══ Why this screen exists at all ═════════════════════════════════════════
//
// `ProspectOpportunity.capabilityCode` is a foreign key into this table, so
// nothing anywhere can recommend a capability that is not on this page. That
// makes the page the enforcement point for the spec's §11 — never recommend a
// capability FieldQuo does not have — and an enforcement point nobody can see
// is a rule nobody maintains.
//
// ══ Three controls, and each one does the thing ═══════════════════════════
//
//   Priority     reorders what a rep reads out first. Written and read.
//   Active       stops the capability being recommended at all. The rules that
//                depend on it stop firing, so the count travels with the row
//                and the confirmation says how many — a switch that quietly
//                disables six rules is a destructive operation labelled as a
//                toggle (AGENTS.md failure class 7).
//   Talking points  the sentences a rep says.
//
// What is deliberately NOT editable: the caveats under a partial capability,
// the plan note, the metered-usage note, and the table-stakes classification.
// They are derived from lib/marketing/featureMatrix.js, which is itself
// proof-checked by check:feature-matrix, and the API refuses them with a 400
// rather than ignoring them. They are shown here, read-only, with a line
// saying where they come from — because "you cannot edit this" is a useful
// thing to know and an unexplained missing field is not.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  Save,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function PlatformSalesCapabilitiesPage() {
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/capabilities"));
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

  const isSuperadmin = me?.role === "superadmin";

  async function runSeed() {
    setBusy("seed");
    setError("");
    setNotice("");
    try {
      const { counts } = await fetchJson("/api/platform/sales/capabilities", {
        method: "POST",
      });
      setNotice(
        `Capabilities: ${counts.capabilities.created} added, ${counts.capabilities.updated} refreshed. ` +
          `Rules: ${counts.rules.created} added. Confidence weights: ${counts.signals.created} added. ` +
          "Nothing was deleted, and no priority, switch or talking point you had edited was reset.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function patch(code, body, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(code);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/api/platform/sales/capabilities/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setDrafts((d) => {
        const next = { ...d };
        delete next[code];
        return next;
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function toggle(cap) {
    const firing = cap.rules.filter((r) => r.active).length;
    patch(
      cap.code,
      { active: !cap.active },
      cap.active
        ? `Switch off "${cap.name}"?\n\n` +
            (firing
              ? `${firing} opportunity rule${firing === 1 ? "" : "s"} recommend${firing === 1 ? "s" : ""} it. ` +
                `Those rules stop producing anything the moment you do this — they are not deleted, and they start working again if you switch it back on.`
              : "No rule recommends it today, so nothing stops firing.") +
            "\n\nExisting recommendations already stored against a prospect stay until that prospect is re-analysed."
        : null,
    );
  }

  const capabilities = data?.capabilities || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Sales capability matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            What a rep may promise a stranger. Nothing outside this list can be
            recommended to a prospect — every recommendation carries a foreign
            key into it. Each row is traceable to a claim on the public feature
            matrix, which is itself checked against the files that implement it,
            so a capability cannot outlive the code behind it.
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={runSeed}
            disabled={busy === "seed"}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {busy === "seed" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Seed / refresh from code
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {!loading && !isSuperadmin && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          You can read this list. Changing what the sales team is allowed to
          promise is superadmin-only, so the controls are not shown rather than
          shown and refused.
        </div>
      )}

      {!loading && data?.unseeded?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          {data.unseeded.length} capabilit
          {data.unseeded.length === 1 ? "y is" : "ies are"} defined in the code
          and missing from this database:{" "}
          <span className="font-mono text-xs">{data.unseeded.join(", ")}</span>.
          {isSuperadmin ? " Run the seed to add them." : ""}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : capabilities.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          The matrix is empty, so nothing can be recommended to any prospect
          yet.
          {isSuperadmin
            ? " Use Seed / refresh from code above."
            : " A superadmin needs to seed it."}
        </div>
      ) : (
        <div className="space-y-3">
          {capabilities.map((cap) => {
            const draft = drafts[cap.code];
            const points = draft?.points ?? cap.recommendedTalkingPoints.points;
            const priority = draft?.salesPriority ?? cap.salesPriority;
            const dirty =
              draft &&
              (draft.salesPriority !== cap.salesPriority ||
                (draft.points || []).join("\n") !==
                  cap.recommendedTalkingPoints.points.join("\n"));

            return (
              <div
                key={cap.code}
                className={`bg-card border border-border rounded-xl p-5 space-y-3 ${cap.active ? "" : "opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-semibold text-foreground">
                        {cap.name}
                      </h2>
                      <span className="font-mono text-xs text-muted-foreground">
                        {cap.code}
                      </span>
                      {!cap.active && (
                        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                          Switched off
                        </span>
                      )}
                      {cap.recommendedTalkingPoints.tableStakes === false && (
                        <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          survives a competitor
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                      {cap.description}
                    </p>
                  </div>

                  {isSuperadmin && (
                    <button
                      onClick={() => toggle(cap)}
                      disabled={busy === cap.code}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60 shrink-0"
                    >
                      {cap.active ? (
                        <>
                          <Ban size={13} /> Switch off
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} /> Switch on
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  {cap.rules.length === 0 ? (
                    <span>
                      No opportunity rule recommends this yet, so it can never
                      reach a rep. That is not an error — the matrix is the
                      vocabulary and rules are added to it over time.
                    </span>
                  ) : (
                    <span>
                      Recommended by{" "}
                      {cap.rules
                        .map((r) => `${r.code}${r.active ? "" : " (off)"}`)
                        .join(", ")}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <div>
                    <label
                      htmlFor={`prio-${cap.code}`}
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      Sales priority (0–100)
                    </label>
                    <input
                      id={`prio-${cap.code}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={priority}
                      disabled={!isSuperadmin}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [cap.code]: {
                            points,
                            ...d[cap.code],
                            salesPriority: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground disabled:opacity-60"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Higher is read out sooner.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor={`points-${cap.code}`}
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      Talking points — one per line
                    </label>
                    <textarea
                      id={`points-${cap.code}`}
                      rows={Math.max(3, points.length + 1)}
                      value={points.join("\n")}
                      disabled={!isSuperadmin}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [cap.code]: {
                            salesPriority: priority,
                            ...d[cap.code],
                            points: e.target.value.split("\n"),
                          },
                        }))
                      }
                      className="w-full border border-border rounded-lg px-3 py-2 text-base bg-card text-foreground disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Read-only, and said out loud. A caveat that could be deleted
                    here would be a hedge that exists on the public page and not
                    in the mouth of the person on the phone. */}
                {(cap.recommendedTalkingPoints.caveats.length > 0 ||
                  cap.recommendedTalkingPoints.usageNote) && (
                  <div className="border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Lock size={12} /> Must be said, and cannot be edited here
                    </div>
                    {cap.recommendedTalkingPoints.caveats.map((c) => (
                      <div key={c}>• {c}</div>
                    ))}
                    {cap.recommendedTalkingPoints.usageNote && (
                      <div>• {cap.recommendedTalkingPoints.usageNote}</div>
                    )}
                    <div className="pt-1">
                      {cap.recommendedTalkingPoints.planNote} These come from
                      the public feature matrix. To change one, change the claim
                      there and re-run the seed.
                    </div>
                  </div>
                )}

                {/* The composed script, in the order a rep reads it: the
                    editable sentences first, then the qualifications they may
                    not drop. Shown so nobody has to guess how the two boxes
                    above combine. */}
                {cap.script?.length > 0 && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      What a rep reads, in order ({cap.script.length})
                    </summary>
                    <ol className="mt-2 space-y-1 list-decimal list-inside">
                      {cap.script.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                  </details>
                )}

                {isSuperadmin && dirty && (
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        patch(cap.code, {
                          salesPriority: priority,
                          points: points.map((p) => p.trim()).filter(Boolean),
                        })
                      }
                      disabled={busy === cap.code}
                      className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                    >
                      {busy === cap.code ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() =>
                        setDrafts((d) => {
                          const next = { ...d };
                          delete next[cap.code];
                          return next;
                        })
                      }
                      className="text-sm font-medium text-muted-foreground px-3 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* What was deliberately left out. Same job as MATRIX_EXCLUSIONS on the
          marketing side: an absent capability should read as a decision with a
          reason, not as an oversight somebody should go and fix. */}
      {!loading && data?.excluded?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Deliberately not sellable
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            These are the things a rep must not promise, and why. A capability
            named here can never be added to the list above — the seed refuses
            to build a matrix that contains both.
          </p>
          <dl className="mt-3 space-y-3">
            {data.excluded.map((e) => (
              <div key={e.code}>
                <dt className="font-mono text-xs text-foreground">{e.code}</dt>
                <dd className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
                  {e.reason}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
