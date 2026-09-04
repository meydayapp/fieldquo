// app/platform/sales/confidence/page.js
//
// How much each kind of evidence is worth.
//
// ══ A dial and a boundary, and the screen has to make the difference plain ═
//
// lib/sales/intel/confidence.js draws the line: WEIGHT is tunable, CATEGORY is
// not. Raising `identity.similar_name` is a reasonable thing to want — surface
// more possible matches — and reclassifying it as deterministic is not, because
// that promotes "a similar name two streets away" to "the same business" across
// the whole database. So the category is shown, read-only, next to every
// weight, with the reason. An unexplained missing field reads as an oversight;
// a stated boundary reads as a decision.
//
// ══ No create, no delete, and that is not a missing feature ══════════════
//
// The signal vocabulary is a contract with the detectors that emit the
// signals. A row naming something `SIGNALS` does not know contributes NOTHING
// to any figure — `weightsFrom` returns it as unrecognised rather than giving
// it a default — so a "new signal" button would write a row that reads back
// correctly and changes nothing. Instead, any such row already in the table is
// listed at the bottom, named, as something to remove in code.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// One card per signal, grouped by category, full-width controls, 44px targets,
// no table. scripts/check-mobile-surfaces.mjs holds this file to that.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RotateCcw, Save } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { blankNumberMessage, numberOrNull } from "@/lib/platform/numericField";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

/** What each category is allowed to conclude, in the engine's own words. */
const CATEGORY_NOTE = {
  identity_deterministic:
    "An identifier that is the same identifier. One of these can settle that two records are the same business.",
  identity_fuzzy:
    "A resemblance. Never enough to settle a match on its own, at any weight — the ceiling below is what makes that true.",
  detection_direct:
    "A machine-readable fingerprint read off the page. Can make a stated fact verified.",
  detection_soft:
    "Prose, a link, a meta tag. Real evidence, and never on its own enough to call something verified.",
  first_party: "The business itself said so, on a recorded call. Outranks any web inference.",
  human: "Somebody looked and corrected it. Top of the stack.",
};

const CATEGORY_LABEL = {
  identity_deterministic: "Identity — deterministic",
  identity_fuzzy: "Identity — fuzzy",
  detection_direct: "Detection — direct",
  detection_soft: "Detection — soft",
  first_party: "First-party",
  human: "Human correction",
};

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

export default function PlatformSalesConfidencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/confidence"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Was a hand-rolled `fetchJson("/api/platform/me").catch(() => null)` whose
  // failure left `me` null — read here as "not a superadmin" and answered with
  // a refusal, shown to a superadmin, for a power they hold. The shared hook
  // keeps never-loaded apart from refused; see PlatformWriteGate's header.
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();
  const signals = data?.signals || [];
  const thresholds = data?.thresholds;

  async function patch(signal, body, successNotice) {
    setBusy(signal);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/api/platform/sales/confidence/${encodeURIComponent(signal)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setDrafts((d) => {
        const next = { ...d };
        delete next[signal];
        return next;
      });
      setNotice(successNotice);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const byCategory = new Map();
  for (const s of signals) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category).push(s);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Confidence weights</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          How much each kind of evidence is worth. Confidence is computed per
          field, not as one score for a prospect: a rep about to dial wants to
          know whether the phone number is right and whether the &ldquo;no
          online booking&rdquo; line is safe to say, and averaging those
          produces a number that is wrong about both.
        </p>
        {thresholds && (
          <p className="text-sm text-muted-foreground max-w-3xl">
            Signals combine as 1 − Π(1 − weight). An identity match is taken
            automatically at {thresholds.matchThreshold} — but no pile of fuzzy
            signals can ever reach it, because they are capped together at{" "}
            {thresholds.fuzzyCeiling}, whatever weights are set here. That gap
            is deliberate and is not editable from this screen.
          </p>
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

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Changing a confidence weight"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {!loading && data?.missing?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          {data.missing.length} signal{data.missing.length === 1 ? " has" : "s have"} no row in the
          database yet, so {data.missing.length === 1 ? "it uses" : "they use"} the built-in
          default shown below. Saving one writes its row. Writing them all at
          once is{" "}
          <Link
            href="/platform/sales/capabilities"
            className="underline font-medium"
          >
            Seed / refresh from code
          </Link>{" "}
          on the capability matrix screen.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {(data?.categories || []).map((category) => {
            const rows = byCategory.get(category) || [];
            if (rows.length === 0) return null;
            return (
              <section key={category} className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {CATEGORY_LABEL[category] || category}
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-3xl">
                    {CATEGORY_NOTE[category]}
                  </p>
                </div>

                {rows.map((s) => {
                  const draft = drafts[s.signal];
                  const weight = draft?.weight ?? s.weight;
                  // numberOrNull, not Number(): Number("") is 0, so clearing
                  // the box made the row look edited to 0 — "this signal counts
                  // for nothing" — and Save wrote exactly that. Blank is null,
                  // which is never equal to a stored weight, so Save still
                  // appears and then refuses by name.
                  const parsedWeight = numberOrNull(weight);
                  const dirty = draft != null && parsedWeight !== Number(s.weight);
                  return (
                    <div
                      key={s.signal}
                      className={`bg-card border border-border rounded-xl p-4 space-y-3 ${
                        s.enabled ? "" : "opacity-75"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-mono text-sm text-foreground break-all">
                          {s.signal}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            in use:{" "}
                            {s.effectiveWeight == null ? "nothing — switched off" : s.effectiveWeight}
                          </span>
                          <span>default {s.defaultWeight}</span>
                          {s.version && <span>v{s.version}</span>}
                          {!s.seeded && <span>no row yet</span>}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`w-${s.signal}`}
                          className="block text-xs font-medium text-muted-foreground mb-1"
                        >
                          Weight (0–1)
                        </label>
                        <input
                          id={`w-${s.signal}`}
                          type="number"
                          min={0}
                          max={1}
                          step={0.005}
                          value={weight}
                          disabled={!isSuperadmin || !s.enabled}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [s.signal]: { weight: e.target.value } }))
                          }
                          className={FIELD}
                        />
                        {!s.enabled && (
                          <p className="text-xs text-muted-foreground mt-1">
                            This signal is switched off, so it contributes
                            nothing at any weight. Switch it back on to tune it.
                          </p>
                        )}
                      </div>

                      {isSuperadmin && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          {dirty && (
                            <button
                              onClick={() => {
                                if (parsedWeight === null) {
                                  setError(blankNumberMessage("Weight"));
                                  return;
                                }
                                patch(
                                  s.signal,
                                  { weight: parsedWeight },
                                  `${s.signal} is now worth ${parsedWeight}.`,
                                );
                              }}
                              disabled={busy === s.signal}
                              className={`${BTN} bg-inverted text-inverted-foreground`}
                            >
                              {busy === s.signal ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Save size={14} />
                              )}
                              Save
                            </button>
                          )}
                          {dirty && (
                            <button
                              onClick={() =>
                                setDrafts((d) => {
                                  const next = { ...d };
                                  delete next[s.signal];
                                  return next;
                                })
                              }
                              className={`${BTN} border border-border text-foreground`}
                            >
                              Cancel
                            </button>
                          )}
                          {!dirty && s.tunedAwayFromDefault && (
                            <button
                              onClick={() =>
                                patch(
                                  s.signal,
                                  { weight: s.defaultWeight },
                                  `${s.signal} is back to its built-in default of ${s.defaultWeight}.`,
                                )
                              }
                              disabled={busy === s.signal}
                              className={`${BTN} border border-border text-foreground`}
                            >
                              <RotateCcw size={14} /> Back to {s.defaultWeight}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              patch(
                                s.signal,
                                { enabled: !s.enabled },
                                s.enabled
                                  ? `${s.signal} is off. Nothing will count it.`
                                  : `${s.signal} is on again.`,
                              )
                            }
                            disabled={busy === s.signal}
                            className={`${BTN} border border-border text-foreground`}
                          >
                            {s.enabled ? "Switch off" : "Switch on"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {!loading && data?.unrecognised?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <div className="font-semibold">
            Rows in the table that nothing reads
          </div>
          <p>
            These name a signal the engine does not know, so they contribute
            nothing to any figure — they are not defaulted to a middle weight,
            because absence of a statement is not a statement. A signal is added
            in code, alongside the detector that emits it.
          </p>
          {data.unrecognised.map((u) => (
            <div key={u.signal} className="font-mono text-xs break-all">
              {u.signal}
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          About the version number
        </h2>
        <p>
          Changing a weight, or switching a signal off, bumps that row&rsquo;s
          version. Unlike an opportunity rule, nothing stamps a confidence
          version onto a stored figure — there is no column for one — so this is
          a change counter on the row and not a provenance trail. It is said
          here rather than implied, because a version number that looks like
          history and is not would be worse than none.
        </p>
      </div>
    </div>
  );
}
