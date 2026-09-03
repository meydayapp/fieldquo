// app/platform/sales/playbooks/preview/page.js
//
// One prospect, the script a rep would read, and the whole reason why.
//
// ══ This screen exists to answer one question ════════════════════════════
//
// "Why am I saying this?" §58 says the answer has to be a rule and evidence,
// never "the AI chose it", and a rule that is only inspectable in principle is
// not inspectable. So the selection trace is on the page by default — every
// playbook that was considered and the refusal for each — rather than behind a
// debug flag nobody turns on.
//
// It is also the screen that catches the failure the playbook editor cannot:
// a playbook that saves cleanly and never opens. The trace names the reason.
//
// ══ Opening the page spends nothing ══════════════════════════════════════
//
// The script renders from the rules alone. Generating with a model is an
// explicit button, metered against FieldQuo's own budget, and what comes back
// says which sentences were refused by the evidence gate and why. A page that
// billed on every load is the kind of thing found on an invoice.
//
// ══ Mobile-first ═════════════════════════════════════════════════════════
//
// Single column, 44px targets, no table. A rep will not read this screen —
// this is the console — but the same rule applies to every /platform page and
// scripts/check-mobile-surfaces.mjs holds it here too.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, Search, Sparkles } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

export default function PlaybookPreviewPage() {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [searching, setSearching] = useState(false);
  const [prospectId, setProspectId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async () => {
    setSearching(true);
    setError("");
    try {
      const data = await fetchJson(
        `/api/platform/sales/prospects?q=${encodeURIComponent(query)}`,
      );
      setCandidates(data.prospects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setResult(await fetchJson(`/api/platform/sales/playbooks/preview?prospectId=${id}`));
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (prospectId) load(prospectId);
  }, [prospectId, load]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      setResult(
        await fetchJson("/api/platform/sales/playbooks/preview", {
          method: "POST",
          // prospectId and nothing else. There is no variant parameter, and a
          // body naming one is refused by the route rather than ignored — §38.
          body: { prospectId },
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const selection = result?.selection;
  const script = result?.script;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/platform/sales/playbooks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft size={14} /> Playbooks
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Preview a call</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Exactly what a rep would see for one prospect, and every playbook that was considered
          along with the reason each one was or was not chosen.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Find a prospect</span>
          <input
            className={FIELD}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search();
            }}
            placeholder="Business name, phone or domain"
          />
        </label>
        <button
          onClick={search}
          disabled={searching}
          className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
        </button>

        {candidates.length > 0 && (
          <ul className="space-y-2 pt-2">
            {candidates.slice(0, 20).map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setProspectId(p.id)}
                  className={`w-full text-left min-h-[44px] px-3 py-2 rounded-lg border ${
                    prospectId === p.id
                      ? "border-foreground bg-muted"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="block font-medium text-foreground break-words">
                    {p.businessName}
                  </span>
                  <span className="block text-xs text-muted-foreground break-words">
                    {[p.where, p.tradeLabel, p.crawled ? "crawled" : "not crawled"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="inline mr-2 -mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Building the script…
        </div>
      )}

      {result?.found && (
        <>
          {/* ── Why this playbook ───────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-foreground">Why this playbook</h2>
            {selection?.selected ? (
              <>
                <p className="text-sm text-foreground break-words">
                  <strong>{selection.selected.name}</strong> — opened because{" "}
                  {selection.selectorLabel || selection.selected.selectorKey}.
                </p>
                <p className="text-sm text-muted-foreground break-words">
                  {selection.selected.describe}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {(selection.selected.facts || []).map((f, i) => (
                    <li key={i} className="break-words">
                      {f.label}: <strong className="text-foreground">{f.value}</strong>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Rule <span className="font-mono">{selection.selected.selectorKey}</span>, playbook{" "}
                  <span className="font-mono">{selection.selected.key}</span> v
                  {selection.selected.version}. Decided in code from the rows above — no model was
                  involved in this choice.
                </p>
              </>
            ) : (
              <p className="text-sm text-foreground break-words">{selection?.reasonText}</p>
            )}

            {(result.unchecked || []).length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300 break-words">
                Not looked at yet: {result.unchecked.join(", ")}. Anything below is short by
                whatever those would have added.
              </p>
            )}
          </div>

          {/* ── Everything that was considered ──────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h2 className="font-semibold text-foreground">Every playbook considered</h2>
            <ul className="space-y-2">
              {(selection?.trace || []).map((t) => (
                <li key={t.key} className="text-sm break-words">
                  <span className="font-mono text-xs text-muted-foreground">{t.key}</span>{" "}
                  <span className={t.refusal ? "text-muted-foreground" : "text-foreground font-semibold"}>
                    {t.refusal ? "not used" : "used"}
                  </span>
                  {t.refusalText ? (
                    <span className="block text-xs text-muted-foreground">{t.refusalText}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {/* ── The talking points ──────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
              <h2 className="font-semibold text-foreground">Talking points</h2>
              <button
                onClick={generate}
                disabled={generating || !prospectId}
                className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
              >
                {generating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Rewrite with AI
              </button>
            </div>

            <p className="text-xs text-muted-foreground break-words">
              {result.generation?.degraded
                ? result.generation.reasonText
                : `Written by ${result.generation?.model}. Every sentence cites an opportunity and its evidence; anything that did not was dropped.`}
              {result.generation?.persisted === false && result.generation?.source === "ai"
                ? " Not saved — the playbook tables are not in the database yet."
                : ""}
            </p>

            {(result.talkingPoints || []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing can be said with evidence behind it for this prospect yet.
              </p>
            )}

            {(result.talkingPoints || []).map((p, i) => (
              <div key={i} className="border-t border-border pt-3 space-y-1">
                <p className="text-sm text-foreground break-words">{p.text}</p>
                <p className="text-xs text-muted-foreground break-words">
                  {p.stageKey} · {p.capabilityName} ·{" "}
                  {p.source === "ai" ? "rephrased by a model" : "the rule's own sentence"} ·{" "}
                  {p.evidenceIds.length} piece(s) of evidence
                  {p.ruleCode ? ` · rule ${p.ruleCode}` : ""}
                </p>
              </div>
            ))}

            {(result.refusedPoints || []).length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground">Refused</p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-1">
                  {result.refusedPoints.map((r, i) => (
                    <li key={i} className="break-words">
                      {r.capabilityCode || "(no citation)"}: {r.refusalText}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── The experiment ──────────────────────────────────────────── */}
          {result.experiment && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-1">
              <h2 className="font-semibold text-foreground">Experiment</h2>
              <p className="text-sm text-foreground break-words">{result.experiment.name}</p>
              <p className="text-sm text-muted-foreground break-words">
                {result.experiment.hypothesis}
              </p>
              <p className="text-xs text-muted-foreground break-words">
                {result.experiment.variantKey
                  ? `Assigned to "${result.experiment.variantKey}" by the system, before the call. A rep cannot change this.`
                  : "Not assigned — no arm could be chosen."}
              </p>
            </div>
          )}

          {/* ── The script ──────────────────────────────────────────────── */}
          {script && (
            <div className="space-y-3">
              {script.missingStages.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 break-words">
                  Nothing is written for: {script.missingStages.join(", ")}. Those stages render
                  empty rather than being filled in with something nobody wrote.
                </div>
              )}
              {script.stages.map((s) => (
                <div key={s.stageKey} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.name}
                      {s.variantOverride ? ` · variant ${s.variantOverride}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">{s.purpose}</p>
                  </div>

                  {s.say.refusal ? (
                    <p className="text-sm text-red-700 dark:text-red-300 break-words">
                      {s.say.refusalText} Missing: {s.say.missing.join(", ")}.
                    </p>
                  ) : s.say.text ? (
                    <p className="text-base text-foreground whitespace-pre-wrap break-words">
                      {s.say.text}
                    </p>
                  ) : null}

                  {s.prompts.length > 0 && (
                    <ul className="pl-5 list-disc text-sm text-foreground space-y-1">
                      {s.prompts.map((p, i) => (
                        <li key={i} className="break-words">
                          {p.refusal ? (
                            <span className="text-red-700 dark:text-red-300">
                              This question names {p.missing.join(", ")}, which we do not have.
                            </span>
                          ) : (
                            p.text
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.points.length > 0 && (
                    <ul className="space-y-2 pt-1">
                      {s.points.map((p, i) => (
                        <li key={i} className="text-sm text-foreground break-words">
                          {p.text}
                          <span className="block text-xs text-muted-foreground">
                            {p.capabilityName} · {p.evidenceIds.length} piece(s) of evidence
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {s.objections.length > 0 && (
                    <ul className="space-y-3 pt-1">
                      {s.objections.map((o) => (
                        <li key={o.code} className="space-y-1">
                          <p className="text-sm font-semibold text-foreground break-words">
                            “{o.label}”
                          </p>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {o.response}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">
                            {o.context
                              ? `About this business: ${o.context.facts
                                  .map((f) => `${f.label} ${f.value}`)
                                  .join(", ")}`
                              : "General answer — nothing observed about this prospect attaches to it."}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
