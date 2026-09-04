// app/platform/sales/signatures/page.js
//
// Technology fingerprints — whose software a business is already running.
//
// ══ The banner that said nothing read this has come down ═════════════════
//
// It was true when this screen shipped: `TechnologySignature` had a table, an
// editor and no consumer. lib/sales/intel/technology.js is the consumer now,
// and the DETECT_TECHNOLOGY pipeline stage writes `ProspectTechnology` from
// what it matches — so leaving the banner up would have been the same dishonesty
// pointing the other way.
//
// What is left is narrower and computed rather than asserted: a detector needs
// crawled pages, so the route counts prospects with a `lastCrawledAt` and the
// screen says "these are live and nothing has been crawled yet" only while
// that count is zero. A sentence derived from the database cannot go stale the
// way the old hard-coded one did.
//
// The screen is still the only way to write these rows, which is the standing
// rule: every rule editable from the superadmin UI, not from a seed script.
// The seed button below is the same function the script runs, put where
// somebody can see it.
//
// ══ isCompetitor is not a label ══════════════════════════════════════════
//
// The moment a competitor is detected on a prospect, `evaluateRule` refuses
// every table-stakes capability for that prospect — a business already running
// a field-service platform does not need to be told it should have online
// booking. So marking a signature as a competitor REMOVES talking points from
// every prospect it matches. That is the safe direction, and it is still a
// consequence somebody deserves to be told about before they click.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// One card per signature, full-width controls, 44px targets, no modal and no
// table. scripts/check-mobile-surfaces.mjs holds this file to that.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

const EXAMPLE = [
  { kind: "script_src", pattern: "getjobber.com", weight: 0.9 },
  { kind: "link", pattern: "clienthub.getjobber.com", weight: 0.8 },
];

export default function PlatformSalesSignaturesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/signatures"));
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
  const signatures = data?.signatures || [];
  const patternKinds = data?.patternKinds || [];
  // How each STARTER signature was verified, keyed by code. Empty for a row
  // somebody wrote by hand, which is correct: nobody vouched for it.
  const sourcing = data?.sourcing || {};

  async function send(url, options, successNotice, busyKey) {
    setBusy(busyKey || url);
    setError("");
    setNotice("");
    try {
      const result = await fetchJson(url, options);
      setNotice(
        typeof successNotice === "function" ? successNotice(result) : successNotice || "Saved.",
      );
      setDraft(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function seed() {
    await send(
      "/api/platform/sales/signatures",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      },
      (r) =>
        `${r.counts.created} signature${r.counts.created === 1 ? "" : "s"} loaded, ` +
        `${r.counts.existing} already here and left alone.`,
      "seed",
    );
  }

  function beginAdd() {
    setDraft({
      isNew: true,
      code: "",
      name: "",
      isCompetitor: false,
      raw: JSON.stringify(EXAMPLE, null, 2),
    });
    setError("");
  }

  function beginEdit(s) {
    setDraft({
      isNew: false,
      code: s.code,
      name: s.name,
      isCompetitor: s.isCompetitor,
      raw: JSON.stringify(s.patterns ?? [], null, 2),
    });
    setError("");
  }

  async function save() {
    const body = {
      name: draft.name,
      isCompetitor: draft.isCompetitor,
      // Sent as text so the server's JSON.parse produces the error, with its
      // position, rather than the browser swallowing it.
      patterns: draft.raw,
    };
    if (draft.isNew) {
      body.code = draft.code;
      await send(
        "/api/platform/sales/signatures",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        (r) => `${r.signature.code} added at version ${r.signature.version}.`,
      );
      return;
    }
    await send(
      `/api/platform/sales/signatures/${draft.code}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      (r) =>
        r.bumped
          ? `Saved as version ${r.signature.version} — detections already recorded still cite the version that found them.`
          : "Saved. What this signature matches did not change, so the version is unchanged.",
    );
  }

  async function toggle(s) {
    if (
      s.active &&
      !confirm(
        `Switch off "${s.name}"?\n\n` +
          "It stops being matched. The " +
          `${s.detectionCount} detection${s.detectionCount === 1 ? "" : "s"} it has already ` +
          "produced stay where they are.",
      )
    ) {
      return;
    }
    await send(
      `/api/platform/sales/signatures/${s.code}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      },
      s.active ? `${s.code} is off.` : `${s.code} is on.`,
    );
  }

  async function remove(s) {
    if (
      !confirm(
        `Delete "${s.name}" for good?\n\nIt has matched nothing, so there is no history to lose. This cannot be undone.`,
      )
    ) {
      return;
    }
    await send(
      `/api/platform/sales/signatures/${s.code}`,
      { method: "DELETE" },
      `${s.code} deleted.`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Technology signatures</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Which software a business is already running — Jobber, Housecall Pro,
          a booking widget, a chat box. Fingerprinting is deterministic on
          purpose: a model guessing at a competitor would be confidently wrong
          in a sales conversation, and the rep would have nothing to point at.
        </p>
      </div>

      {data?.detectionsPending && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <div className="font-semibold">These patterns are live. Nothing has been crawled yet.</div>
          <p>
            The detector reads them — it matches script sources, iframe and link
            hosts, meta tags, cookie names and markup, and writes what it finds
            against the prospect. What it has not had is anything to look at: no
            prospect has been crawled, so no detection exists. Run a campaign
            and the fingerprinting happens on the pages it fetches. Detections
            found before a signature was edited keep citing the version that
            found them.
          </p>
        </div>
      )}

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
        action="Writing a technology signature"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {isSuperadmin && !draft && (
        <button onClick={beginAdd} className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}>
          <Plus size={16} /> Add a signature
        </button>
      )}

      {draft?.isNew && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SignatureForm
            draft={draft}
            setDraft={setDraft}
            patternKinds={patternKinds}
            onSave={save}
            onCancel={() => setDraft(null)}
            busy={Boolean(busy)}
            title="New signature"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : signatures.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground space-y-3">
          <p>
            No signatures yet, so nothing is being fingerprinted. The starter
            set covers the field-service platforms a contractor is most likely
            to already run — Jobber, Housecall Pro, ServiceTitan, Workiz,
            Markate — plus the booking, chat, review, payment and website tools
            that sit beside them.
          </p>
          <p>
            Loading them is additive: a signature you later edit or switch off
            keeps your changes if you load them again. Three ship switched OFF
            because their fingerprint could not be verified against real markup,
            and each says so on its own card.
          </p>
          {isSuperadmin && (
            <button
              onClick={seed}
              disabled={Boolean(busy)}
              className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
            >
              {busy === "seed" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Load the starter signatures
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {signatures.map((s) => {
            const editing = draft && !draft.isNew && draft.code === s.code;
            return (
              <div
                key={s.code}
                className={`bg-card border border-border rounded-xl ${s.active ? "" : "opacity-75"}`}
              >
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-foreground break-words">{s.name}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono break-all">{s.code}</span>
                      <span>v{s.version}</span>
                      <span
                        className={
                          s.active
                            ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                            : "text-red-700 dark:text-red-400 font-semibold"
                        }
                      >
                        {s.active ? "On" : "Off"}
                      </span>
                      {s.isCompetitor && (
                        <span className="font-semibold text-foreground">Competitor</span>
                      )}
                      <span>
                        {s.detectionCount === 0
                          ? "matched nothing yet"
                          : `matched ${s.detectionCount} prospect${s.detectionCount === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>

                  {sourcing[s.code] && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-semibold text-foreground min-h-[44px] flex items-center">
                        How this fingerprint was verified
                      </summary>
                      {/* The starter row's sourcing, not this row's. Said out
                          loud because a superadmin who edits the patterns has
                          made the note untrue, and a note that quietly kept
                          vouching for somebody else's edit would be worse than
                          none. */}
                      <p className="mt-2 text-muted-foreground leading-relaxed">
                        {sourcing[s.code]}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        This describes the starter signature. If you have edited the
                        patterns below, it no longer describes them.
                      </p>
                    </details>
                  )}

                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold text-foreground min-h-[44px] flex items-center">
                      Patterns ({Array.isArray(s.patterns) ? s.patterns.length : 0})
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-muted text-muted-foreground text-xs overflow-x-auto">
                      {JSON.stringify(s.patterns, null, 2)}
                    </pre>
                  </details>

                  {isSuperadmin && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => (editing ? setDraft(null) : beginEdit(s))}
                        className={`${BTN} border border-border text-foreground`}
                      >
                        {editing ? "Close" : "Edit"}
                      </button>
                      <button
                        onClick={() => toggle(s)}
                        disabled={Boolean(busy)}
                        className={`${BTN} border border-border text-foreground`}
                      >
                        {s.active ? (
                          <>
                            <Ban size={14} /> Switch off
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Switch on
                          </>
                        )}
                      </button>
                      {s.deletable ? (
                        <button
                          onClick={() => remove(s)}
                          disabled={Boolean(busy)}
                          className={`${BTN} border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300`}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      ) : (
                        <p className="text-xs text-muted-foreground sm:self-center">
                          Cannot be deleted — {s.detectionCount} detection
                          {s.detectionCount === 1 ? "" : "s"} cite it. Switch it
                          off instead.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="border-t border-border p-4">
                    <SignatureForm
                      draft={draft}
                      setDraft={setDraft}
                      patternKinds={patternKinds}
                      onSave={save}
                      onCancel={() => setDraft(null)}
                      busy={Boolean(busy)}
                      title={`Editing ${s.code}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          What changes the version, and what does not
        </h2>
        <p>
          Editing the patterns, or changing whether this is a competitor,
          changes what a detection MEANS, so the version is bumped and every
          detection already recorded keeps citing the version that found it.
          Renaming a signature, or switching it on and off, does not.
        </p>
      </div>
    </div>
  );
}

function SignatureForm({ draft, setDraft, patternKinds, onSave, onCancel, busy, title }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>

      {draft.isNew && (
        <div>
          <label htmlFor="sig-code" className="block text-xs font-medium text-muted-foreground mb-1">
            Code — permanent, and every detection is stored against it
          </label>
          <input
            id="sig-code"
            value={draft.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            placeholder="JOBBER"
            className={`${FIELD} font-mono`}
          />
        </div>
      )}

      <div>
        <label htmlFor="sig-name" className="block text-xs font-medium text-muted-foreground mb-1">
          Name — what a rep reads
        </label>
        <input
          id="sig-name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Jobber"
          className={FIELD}
        />
      </div>

      <div className="border border-border rounded-lg p-3 space-y-2">
        <label className="flex items-start gap-3 min-h-[44px]">
          <input
            type="checkbox"
            checked={draft.isCompetitor}
            onChange={(e) => set({ isCompetitor: e.target.checked })}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span className="text-sm text-foreground">
            This is a competitor platform
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          A competitor detection changes the whole conversation: every
          capability any field-service platform would be expected to carry stops
          being offered to that prospect, because telling somebody who already
          runs one that they should have online booking says only that we did
          not look. Adjacent tools — a booking widget, a chat box — are not
          competitors and should be left unticked.
        </p>
      </div>

      <div>
        <label
          htmlFor="sig-patterns"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          Patterns
        </label>
        <textarea
          id="sig-patterns"
          rows={12}
          value={draft.raw}
          onChange={(e) => set({ raw: e.target.value })}
          className={`${FIELD} font-mono`}
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground mt-1">
          A JSON list. Each entry has a <span className="font-mono">kind</span>{" "}
          — one of {patternKinds.join(", ")} — a non-empty{" "}
          <span className="font-mono">pattern</span>, and an optional{" "}
          <span className="font-mono">weight</span> above 0 and at most 1. The
          save refuses anything else and says which entry is wrong.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          How each kind is matched: <span className="font-mono">script_src</span>,{" "}
          <span className="font-mono">iframe_host</span> and{" "}
          <span className="font-mono">link</span> match a HOST (exact or a
          subdomain — never a substring, so a lookalike domain cannot spoof one),
          plus a path fragment when you write one.{" "}
          <span className="font-mono">meta</span> takes{" "}
          <span className="font-mono">name=value</span> or a bare value.{" "}
          <span className="font-mono">cookie</span> is an exact cookie name.{" "}
          <span className="font-mono">html</span> and{" "}
          <span className="font-mono">text</span> are case-insensitive substrings
          — and on their own they can never produce a detection, because a page
          that merely mentions a competitor is not running one.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className={`${BTN} bg-inverted text-inverted-foreground`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
        <button onClick={onCancel} className={`${BTN} border border-border text-foreground`}>
          Cancel
        </button>
      </div>
    </div>
  );
}
