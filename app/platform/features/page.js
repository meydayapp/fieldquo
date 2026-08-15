"use client";

// app/platform/features/page.js
//
// What FieldQuo offers, and to whom. The kill switch, and the beta list.
//
// ── This screen edits, and that is not a mistake ───────────────────────────
//
// Everywhere else in this console FieldQuo looks at a company's data and does
// not touch it. Nothing here is a company's data: these are FieldQuo's own
// decisions about what it sells, exactly like /platform/demo-availability is
// FieldQuo's own sales calendar. Editing is the point. Do not "fix" the API
// behind this page by making it read-only.
//
// ── Availability is not adoption ──────────────────────────────────────────
//
// Each card names the Company column the CONTRACTOR controls, next to the state
// FieldQuo controls. They answer different questions and the screen says so out
// loud, because the whole reason both exist is that "we don't offer this" and
// "they haven't switched it on" are the two answers a support ticket needs to
// tell apart.
//
// ── The list is closed ────────────────────────────────────────────────────
//
// There is no "add a feature" button, and there never should be. The cards are
// rendered from lib/features/registry.js, which is code, and a key with no
// consumer fails `npm run check:features`. A console that let someone type a new
// key would be a flag store for features that don't exist.

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  ToggleLeft,
  Plus,
  Trash2,
  Building2,
  Coins,
  Info,
} from "lucide-react";

const STATE_COPY = {
  on: {
    label: "On",
    blurb: "Normal. Available to everyone it resolves to.",
    tone: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
  preview: {
    label: "Preview",
    blurb: "Usable, and labelled as an early preview on every page it owns.",
    tone: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  locked: {
    label: "Locked",
    blurb:
      "Visible in the menu, refused with your note as the reason. Use when they should know it exists.",
    tone: "bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-900",
  },
  hidden: {
    label: "Hidden",
    blurb:
      "No trace: no menu row, no reachable page, no API that admits the route exists. Use when it isn't ready.",
    tone: "bg-muted text-muted-foreground border-border",
  },
};

const inputClass =
  "border border-border rounded-lg px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10";

export default function PlatformFeaturesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState({}); // key → { state, note }
  const [adding, setAdding] = useState({}); // key → { companyId, state }

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/platform/features");
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status}).`);
      setData(body);
      setDrafts(
        Object.fromEntries(
          body.features.map((f) => [f.key, { state: f.global.state, note: f.global.note || "" }]),
        ),
      );
    } catch (err) {
      setError(err.message);
      setData({ features: [], companies: [], states: [] });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(url, body, label) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const res = await fetch(url, {
        method: body.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.payload),
      });
      const parsed = await res.json().catch(() => null);
      if (!res.ok) throw new Error(parsed?.error || `Request failed (${res.status}).`);
      setNotice(body.success);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (data === null) {
    return (
      <div className="text-sm text-muted-foreground inline-flex items-center gap-2 py-8">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Features</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What FieldQuo offers inside a contractor&apos;s back office. A company
          override wins over the platform default; no override means it inherits.
        </p>
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

      <div className="bg-muted border border-border rounded-xl p-4 text-sm text-muted-foreground flex gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">
            Turning something off never deletes anything.
          </p>
          <p className="mt-1">
            The funnels, campaigns, call records, site blocks and rate cards
            behind a withheld feature stay exactly where they are and come back
            untouched. This screen changes what is reachable, not what exists.
          </p>
        </div>
      </div>

      {data.features.map((f) => {
        const draft = drafts[f.key] || { state: f.global.state, note: "" };
        const dirty =
          draft.state !== f.global.state || (draft.note || "") !== (f.global.note || "");
        const add = adding[f.key] || { companyId: "", state: "preview" };
        const overridden = new Set(f.overrides.map((o) => o.companyId));

        return (
          <section key={f.key} className="bg-card border border-border rounded-xl overflow-hidden">
            <header className="px-5 py-4 border-b border-border">
              <div className="flex flex-wrap items-center gap-2">
                <ToggleLeft size={15} className="text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground">{f.label}</span>
                <code className="text-xs text-muted-foreground">{f.key}</code>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${STATE_COPY[f.global.state]?.tone || ""}`}
                >
                  {STATE_COPY[f.global.state]?.label || f.global.state}
                  {f.global.source === "default" && " (default)"}
                </span>
                {f.spends && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground inline-flex items-center gap-1">
                    <Coins size={11} /> costs FieldQuo money
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1.5">{f.blurb}</p>

              {/* What this state actually reaches. Printed rather than
                  described, so a reader can see the blast radius before
                  changing it — and so a feature that gates nothing is obvious. */}
              <p className="text-xs text-muted-foreground mt-2">
                Gates {f.gates.pages.length} page path
                {f.gates.pages.length === 1 ? "" : "s"} ({f.gates.pages.join(", ")}),{" "}
                {f.gates.apis.length} API prefix
                {f.gates.apis.length === 1 ? "" : "es"} ({f.gates.apis.join(", ")})
                {f.gates.crons.length > 0 && <>, and {f.gates.crons.join(", ")}</>}.
              </p>

              {/* The other axis, named. Support opens this page to answer "why
                  can't they see it", and half the time the answer is that the
                  contractor never switched it on. */}
              <p className="text-xs text-muted-foreground mt-1">
                {f.adoptionField ? (
                  <>
                    The contractor&apos;s own switch is{" "}
                    <code className="text-foreground">Company.{f.adoptionField}</code> — separate
                    from this, and theirs to set.
                  </>
                ) : (
                  <>No separate contractor switch: availability is the only gate.</>
                )}
              </p>
            </header>

            {/* ── Platform default ── */}
            <div className="px-5 py-4 border-b border-border space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Every company, unless overridden
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={draft.state}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [f.key]: { ...draft, state: e.target.value } }))
                  }
                  className={inputClass}
                >
                  {data.states.map((s) => (
                    <option key={s} value={s}>
                      {STATE_COPY[s]?.label || s}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={draft.note}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [f.key]: { ...draft, note: e.target.value } }))
                  }
                  placeholder="Reason shown to the contractor (Locked only)"
                  className={`${inputClass} flex-1 min-w-[16rem]`}
                />
                <button
                  onClick={() =>
                    send("/api/platform/features", {
                      method: "PUT",
                      payload: { key: f.key, state: draft.state, note: draft.note },
                      success: `${f.label} is now ${STATE_COPY[draft.state]?.label || draft.state} for every company without an override.`,
                    }, `g:${f.key}`)
                  }
                  disabled={!dirty || busy === `g:${f.key}`}
                  className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                >
                  {busy === `g:${f.key}` && <Loader2 size={14} className="animate-spin" />}
                  Save
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {STATE_COPY[draft.state]?.blurb}
              </p>
              {/* A note on anything but Locked is stored and never read. Say so
                  rather than letting someone write an explanation nobody sees. */}
              {draft.note.trim() && draft.state !== "locked" && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Only Locked shows this note to anyone. On {STATE_COPY[draft.state]?.label} it is
                  saved and never displayed.
                </p>
              )}
            </div>

            {/* ── Per-company overrides ── */}
            <div className="px-5 py-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company overrides ({f.overrides.length})
              </div>

              {f.overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None. Every company follows the platform default above.
                </p>
              ) : (
                <div className="divide-y divide-border border border-border rounded-lg">
                  {f.overrides.map((o) => (
                    <div
                      key={o.id}
                      className="px-3 py-2.5 flex flex-wrap items-center gap-2"
                    >
                      <Building2 size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {o.company?.name || o.companyId}
                      </span>
                      {o.malformed ? (
                        <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                          <AlertTriangle size={11} /> unreadable state &ldquo;{o.state}&rdquo; —
                          treated as Hidden
                        </span>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${STATE_COPY[o.state]?.tone || ""}`}
                        >
                          {STATE_COPY[o.state]?.label || o.state}
                        </span>
                      )}
                      {o.note && (
                        <span className="text-xs text-muted-foreground truncate">{o.note}</span>
                      )}
                      <button
                        onClick={() =>
                          send("/api/platform/features", {
                            method: "POST",
                            payload: { key: f.key, companyId: o.companyId, state: null },
                            success: `${o.company?.name || "That company"} follows the platform default for ${f.label} again.`,
                          }, `o:${o.id}`)
                        }
                        disabled={busy === `o:${o.id}`}
                        aria-label={`Clear override for ${o.company?.name || o.companyId}`}
                        className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40"
                      >
                        {busy === `o:${o.id}` ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={add.companyId}
                  onChange={(e) =>
                    setAdding((a) => ({ ...a, [f.key]: { ...add, companyId: e.target.value } }))
                  }
                  className={`${inputClass} max-w-[18rem]`}
                >
                  <option value="">Choose a company…</option>
                  {data.companies
                    .filter((c) => !overridden.has(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select
                  value={add.state}
                  onChange={(e) =>
                    setAdding((a) => ({ ...a, [f.key]: { ...add, state: e.target.value } }))
                  }
                  className={inputClass}
                >
                  {data.states.map((s) => (
                    <option key={s} value={s}>
                      {STATE_COPY[s]?.label || s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    send("/api/platform/features", {
                      method: "POST",
                      payload: { key: f.key, companyId: add.companyId, state: add.state },
                      success: `Override saved for ${f.label}.`,
                    }, `n:${f.key}`)
                  }
                  disabled={!add.companyId || busy === `n:${f.key}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold border border-border rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  {busy === `n:${f.key}` ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Add override
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
