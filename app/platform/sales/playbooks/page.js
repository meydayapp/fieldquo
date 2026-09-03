// app/platform/sales/playbooks/page.js
//
// The words a rep says, and the three tables behind them.
//
// ══ One screen, three tabs, and why they are not three screens ═══════════
//
// A playbook, the objection library and the experiments running over them are
// one editorial job. Nobody rewrites the "too expensive" answer without
// thinking about the call it comes up in, and nobody starts an experiment
// without reading the stage it varies. Three separate screens would make each
// edit a navigation problem.
//
// ══ The banner is COMPUTED ═══════════════════════════════════════════════
//
// `store.ready` comes from probing the generated Prisma client, not from a
// constant in this file. That is the direct lesson of the technology
// signatures screen, whose hard-coded "nothing reads these patterns yet" went
// stale the day a detector shipped and left a check asserting the wrong thing.
// While the tables are absent this screen shows the built-in library, states
// exactly which models are missing, and renders NO write control at all —
// a `Coming soon` panel is honest and a dead button is not.
//
// ══ Mobile-first ═════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px touch targets, no modal and no
// table. scripts/check-mobile-surfaces.mjs holds this file to that; what it can
// and cannot prove is in its own header.
//
// ══ English only ═════════════════════════════════════════════════════════
//
// Zero of the /platform pages use i18n — the console is English-only by
// convention, and checked rather than assumed: /sales, the REP portal, does
// use useTranslation, and that is the surface a rep reads. This one is read by
// FieldQuo staff.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const AREA =
  "w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground disabled:opacity-60";

const TABS = [
  { key: "playbooks", label: "Playbooks" },
  { key: "objections", label: "Objections" },
  { key: "experiments", label: "Experiments" },
];

function Problems({ problems }) {
  if (!problems?.length) return null;
  return (
    <ul className="mt-2 space-y-1 pl-6 list-disc text-sm text-red-700 dark:text-red-300">
      {problems.map((p) => (
        <li key={p.code}>{p.text}</li>
      ))}
    </ul>
  );
}

export default function PlatformSalesPlaybooksPage() {
  const [tab, setTab] = useState("playbooks");
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [objectionData, setObjectionData] = useState(null);
  const [experimentData, setExperimentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState("");
  const [draft, setDraft] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [playbooks, objections, experiments] = await Promise.all([
        fetchJson("/api/platform/sales/playbooks"),
        fetchJson("/api/platform/sales/playbooks/objections"),
        fetchJson("/api/platform/sales/playbooks/experiments"),
      ]);
      setData(playbooks);
      setObjectionData(objections);
      setExperimentData(experiments);
      const who = await fetchJson("/api/platform/me").catch(() => null);
      if (who) setMe(who);
    } catch (err) {
      setError(err.message);
      setProblems(err.data?.problems || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isSuperadmin = me?.role === "superadmin";
  const store = data?.store || { ready: false, missing: [] };
  // Both halves are required before a control that writes is drawn. Hiding a
  // button is not access control — the routes check the role and the store
  // again — but rendering one that is guaranteed to 503 is the dead control
  // AGENTS.md forbids.
  const canWrite = isSuperadmin && store.ready;

  const playbooks = data?.playbooks || [];
  const selectors = data?.selectors || [];
  const stages = data?.stages || [];
  const variables = data?.variables || [];

  async function send(url, options, successNotice) {
    setBusy(url);
    setError("");
    setProblems([]);
    setNotice("");
    try {
      const result = await fetchJson(url, options);
      setNotice(
        typeof successNotice === "function" ? successNotice(result) : successNotice || "Saved.",
      );
      setDraft(null);
      await load();
      return result;
    } catch (err) {
      setError(err.message);
      setProblems(err.data?.problems || []);
      // A 503 carries the model list. Surfaced verbatim so nobody has to guess
      // which migration is missing.
      if (err.data?.missingModels) {
        setProblems(
          err.data.missingModels.map((m) => ({ code: m, text: `${m} is not in the database.` })),
        );
      }
      return null;
    } finally {
      setBusy("");
    }
  }

  // ── Playbook editing ─────────────────────────────────────────────────────

  function beginEditPlaybook(pb) {
    setOpen(pb.key);
    setDraft({
      kind: "playbook",
      isNew: false,
      key: pb.key,
      name: pb.name,
      selectorKey: pb.selectorKey,
      priority: pb.priority,
      stages: stages.map((s) => {
        const row = (pb.stages || []).find((x) => x.stageKey === s.key);
        return {
          stageKey: s.key,
          say: row?.say || "",
          prompts: (row?.prompts || []).join("\n"),
        };
      }),
    });
    setError("");
    setProblems([]);
  }

  function beginAddPlaybook() {
    setOpen("");
    setDraft({
      kind: "playbook",
      isNew: true,
      key: "",
      name: "",
      selectorKey: selectors[0]?.key || "",
      priority: 50,
      stages: stages.map((s) => ({ stageKey: s.key, say: "", prompts: "" })),
    });
    setError("");
    setProblems([]);
  }

  function playbookBody(d) {
    return {
      key: d.key,
      name: d.name,
      selectorKey: d.selectorKey,
      priority: Number(d.priority),
      stages: d.stages.map((s) => ({
        stageKey: s.stageKey,
        say: s.say,
        prompts: s.prompts.split("\n").map((p) => p.trim()).filter(Boolean),
      })),
    };
  }

  const savePlaybook = () =>
    draft.isNew
      ? send(
          "/api/platform/sales/playbooks",
          { method: "POST", body: playbookBody(draft) },
          (r) => `Created ${r.playbook.key}. It is switched off until you turn it on.`,
        )
      : send(
          `/api/platform/sales/playbooks/${draft.key}`,
          { method: "PATCH", body: playbookBody(draft) },
          (r) => (r.bumped ? `Saved as version ${r.playbook.version}.` : "Saved."),
        );

  // ── Objection editing ────────────────────────────────────────────────────

  function beginEditObjection(o) {
    setOpen(o.code);
    setDraft({
      kind: "objection",
      isNew: false,
      code: o.code,
      label: o.label,
      cues: (o.cues || []).join("\n"),
      response: o.response,
      contextSelectorKey: o.contextSelectorKey || "",
      priority: o.priority,
    });
    setError("");
    setProblems([]);
  }

  function beginAddObjection() {
    setOpen("");
    setDraft({
      kind: "objection",
      isNew: true,
      code: "",
      label: "",
      cues: "",
      response: "",
      contextSelectorKey: "",
      priority: 50,
    });
    setError("");
    setProblems([]);
  }

  const objectionBody = (d) => ({
    code: d.code,
    label: d.label,
    cues: d.cues,
    response: d.response,
    contextSelectorKey: d.contextSelectorKey || null,
    priority: Number(d.priority),
  });

  const saveObjection = () =>
    draft.isNew
      ? send(
          "/api/platform/sales/playbooks/objections",
          { method: "POST", body: objectionBody(draft) },
          (r) => `Created ${r.objection.code}.`,
        )
      : send(
          `/api/platform/sales/playbooks/objections/${draft.code}`,
          { method: "PATCH", body: objectionBody(draft) },
          "Saved.",
        );

  // ── Experiment editing ───────────────────────────────────────────────────

  function beginAddExperiment() {
    setOpen("");
    setDraft({
      kind: "experiment",
      isNew: true,
      key: "",
      name: "",
      hypothesis: "",
      playbookKey: playbooks[0]?.key || "",
      variants: JSON.stringify(
        [
          { key: "a", label: "Control", weight: 50, stages: [] },
          { key: "b", label: "Variant B", weight: 50, stages: [] },
        ],
        null,
        2,
      ),
    });
    setError("");
    setProblems([]);
  }

  const saveExperiment = () =>
    send(
      "/api/platform/sales/playbooks/experiments",
      {
        method: "POST",
        body: {
          key: draft.key,
          name: draft.name,
          hypothesis: draft.hypothesis,
          playbookKey: draft.playbookKey,
          variants: draft.variants,
        },
      },
      (r) => `Created ${r.experiment.key}. It is not running until you start it.`,
    );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Playbooks</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          What a rep says, stage by stage. Which playbook opens is decided by a{" "}
          <strong className="text-foreground">deterministic rule</strong> over what was actually
          observed — never by a model. A model may only rephrase a talking point that already cites
          an{" "}
          <Link href="/platform/sales/rules" className="underline font-medium text-foreground">
            opportunity rule
          </Link>{" "}
          and its evidence.
        </p>
        <p className="text-sm text-muted-foreground max-w-3xl">
          To see what a specific prospect would hear, and why,{" "}
          <Link
            href="/platform/sales/playbooks/preview"
            className="underline font-medium text-foreground"
          >
            open the preview
          </Link>
          .
        </p>
      </div>

      {!loading && !store.ready && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <Database size={16} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">
                The playbook tables are not in the database yet, so nothing here can be saved.
              </p>
              <p className="mt-1">
                Everything below is the built-in library, read-only, and it is what the engine is
                using right now. No edit control is drawn until the tables exist.
              </p>
              <p className="mt-2">
                Missing:{" "}
                <span className="font-mono break-words">{(store.missing || []).join(", ")}</span>.
                The definitions are ready in{" "}
                <span className="font-mono break-words">{store.pendingSchemaFile}</span> — paste
                them into <span className="font-mono">prisma/schema.prisma</span> and run{" "}
                <span className="font-mono">npx prisma db push</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !isSuperadmin && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          These decide what every rep says to a stranger, so only a superadmin can change them. You
          can read everything here.
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="min-w-0 break-words">{error}</div>
          </div>
          <Problems problems={problems} />
        </div>
      )}

      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={16} className="inline mr-2 -mt-0.5" />
          {notice}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setDraft(null);
              setOpen("");
            }}
            className={`${BTN} flex-1 sm:flex-none ${
              tab === t.key
                ? "bg-inverted text-inverted-foreground"
                : "bg-card border border-border text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {/* ── Playbooks ───────────────────────────────────────────────────── */}
      {!loading && tab === "playbooks" && (
        <div className="space-y-3">
          {canWrite && !draft && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={beginAddPlaybook}
                className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
              >
                <Plus size={16} /> New playbook
              </button>
              {(data?.availableDefaults || []).length > 0 && (
                <button
                  disabled={busy === "/api/platform/sales/playbooks/install-defaults"}
                  onClick={() =>
                    send(
                      "/api/platform/sales/playbooks/install-defaults",
                      { method: "POST" },
                      (r) =>
                        `Installed ${r.playbooksCreated.length} playbook(s) and ` +
                        `${r.objectionsCreated.length} objection(s). ` +
                        `${r.playbooksSkipped + r.objectionsSkipped} already existed and were left alone.`,
                    )
                  }
                  className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                >
                  Install the {(data?.availableDefaults || []).length} built-in playbook(s)
                </button>
              )}
            </div>
          )}

          {draft?.kind === "playbook" && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <h2 className="font-semibold text-foreground">
                {draft.isNew ? "New playbook" : draft.key}
              </h2>

              {draft.isNew && (
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-foreground">Key</span>
                  <input
                    className={FIELD}
                    value={draft.key}
                    onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                    placeholder="BOOKING_GAP"
                  />
                  <span className="block text-xs text-muted-foreground">
                    Upper case, digits and underscores. It is stamped on every talking point and
                    every experiment assignment, so it cannot be changed afterwards.
                  </span>
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Name</span>
                <input
                  className={FIELD}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Opens when</span>
                <select
                  className={FIELD}
                  value={draft.selectorKey}
                  onChange={(e) => setDraft({ ...draft, selectorKey: e.target.value })}
                >
                  {selectors.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-muted-foreground">
                  {selectors.find((s) => s.key === draft.selectorKey)?.describe}
                </span>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Priority</span>
                <input
                  className={FIELD}
                  type="number"
                  inputMode="numeric"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                />
                <span className="block text-xs text-muted-foreground">
                  Higher opens first when two rules both match. A tie is broken on the key, so the
                  answer is the same on every run.
                </span>
              </label>

              <p className="text-xs text-muted-foreground">
                You can use {variables.map((v) => `{${v}}`).join(", ")}. A line naming{" "}
                <span className="font-mono">{"{competitor}"}</span> can only be saved on a playbook
                that opens on a competitor — anywhere else it would be read out with a hole in it.
              </p>

              <div className="space-y-4">
                {draft.stages.map((s, i) => {
                  const meta = stages.find((x) => x.key === s.stageKey);
                  return (
                    <div key={s.stageKey} className="border-t border-border pt-4 space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{meta?.name}</p>
                        <p className="text-xs text-muted-foreground">{meta?.purpose}</p>
                      </div>
                      {meta?.usesObjections ? (
                        <p className="text-xs text-muted-foreground italic">
                          Rendered from the objection library, filtered to the prospect. Nothing to
                          write here.
                        </p>
                      ) : (
                        <>
                          <textarea
                            className={AREA}
                            rows={3}
                            value={s.say}
                            placeholder="What the rep says."
                            onChange={(e) => {
                              const next = [...draft.stages];
                              next[i] = { ...s, say: e.target.value };
                              setDraft({ ...draft, stages: next });
                            }}
                          />
                          <textarea
                            className={AREA}
                            rows={3}
                            value={s.prompts}
                            placeholder="Questions to ask — one per line."
                            onChange={(e) => {
                              const next = [...draft.stages];
                              next[i] = { ...s, prompts: e.target.value };
                              setDraft({ ...draft, stages: next });
                            }}
                          />
                        </>
                      )}
                      {meta?.usesTalkingPoints && (
                        <p className="text-xs text-muted-foreground">
                          Per-prospect talking points are inserted here. Each one cites an
                          opportunity and its evidence.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  disabled={Boolean(busy)}
                  onClick={savePlaybook}
                  className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
                >
                  <Save size={16} /> Save
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {playbooks.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
              There are no playbooks. Nothing will open on any prospect until at least one exists —
              deliberately, rather than falling back to a generic script that claims to know
              something about a business nobody has looked at.
            </div>
          )}

          {playbooks.map((pb) => (
            <div key={pb.key} className="bg-card border border-border rounded-xl">
              <button
                onClick={() => setOpen(open === pb.key ? "" : pb.key)}
                className="w-full text-left p-4 min-h-[44px] flex items-start gap-3"
              >
                {open === pb.key ? (
                  <ChevronDown size={18} className="shrink-0 mt-0.5" />
                ) : (
                  <ChevronRight size={18} className="shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground break-words">{pb.name}</p>
                  <p className="text-xs text-muted-foreground font-mono break-words">{pb.key}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Opens when: {selectors.find((s) => s.key === pb.selectorKey)?.label || pb.selectorKey}
                    {" · "}priority {pb.priority}
                    {" · "}v{pb.version}
                    {" · "}
                    {pb.active ? "on" : "off"}
                    {pb.source === "built-in" ? " · built-in, not saved" : ""}
                  </p>
                  {!pb.valid && (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      This playbook could never be used as written.
                    </p>
                  )}
                </div>
              </button>

              {open === pb.key && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <Problems problems={pb.problems} />
                  {(pb.stages || []).map((s) => {
                    const meta = stages.find((x) => x.key === s.stageKey);
                    return (
                      <div key={s.stageKey} className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {meta?.name || s.stageKey}
                        </p>
                        {s.say ? (
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {s.say}
                          </p>
                        ) : null}
                        {(s.prompts || []).length > 0 && (
                          <ul className="pl-5 list-disc text-sm text-muted-foreground space-y-1">
                            {s.prompts.map((p, i) => (
                              <li key={i} className="break-words">
                                {p}
                              </li>
                            ))}
                          </ul>
                        )}
                        {!s.say && !(s.prompts || []).length && !meta?.usesObjections && (
                          <p className="text-sm text-muted-foreground italic">
                            Nothing written for this stage.
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {canWrite && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <button
                        onClick={() => beginEditPlaybook(pb)}
                        className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                      >
                        Edit
                      </button>
                      <button
                        disabled={Boolean(busy)}
                        onClick={() =>
                          send(
                            `/api/platform/sales/playbooks/${pb.key}`,
                            { method: "PATCH", body: { active: !pb.active } },
                            pb.active ? "Switched off." : "Switched on.",
                          )
                        }
                        className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                      >
                        <Ban size={16} /> {pb.active ? "Switch off" : "Switch on"}
                      </button>
                      {pb.deletable && (
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete "${pb.name}" for good?\n\nIt has never produced a talking point, so nothing cites it.`,
                              )
                            ) {
                              return;
                            }
                            send(
                              `/api/platform/sales/playbooks/${pb.key}`,
                              { method: "DELETE" },
                              "Deleted.",
                            );
                          }}
                          className={`${BTN} w-full sm:w-auto bg-card border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300`}
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      )}
                      {!pb.deletable && store.ready && pb.usedCount > 0 && (
                        <p className="text-xs text-muted-foreground self-center">
                          {pb.usedCount} talking point(s) cite this playbook, so it can only be
                          switched off.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Objections ──────────────────────────────────────────────────── */}
      {!loading && tab === "objections" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground max-w-3xl">
            Every one of these is shown on every call. A context rule only decides whether the
            answer carries <em>this</em> prospect&apos;s observations — it never hides the answer,
            because hiding the reply to the commonest objection is hiding it exactly when a rep
            needs it. Nothing here is generated: these are your words, read out verbatim.
          </p>

          {canWrite && !draft && (
            <button
              onClick={beginAddObjection}
              className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
            >
              <Plus size={16} /> New objection
            </button>
          )}

          {draft?.kind === "objection" && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              {draft.isNew && (
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-foreground">Code</span>
                  <input
                    className={FIELD}
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    placeholder="TOO_EXPENSIVE"
                  />
                </label>
              )}
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">What they say</span>
                <input
                  className={FIELD}
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">
                  Cues — one per line, the words they actually use
                </span>
                <textarea
                  className={AREA}
                  rows={3}
                  value={draft.cues}
                  onChange={(e) => setDraft({ ...draft, cues: e.target.value })}
                />
                <span className="block text-xs text-muted-foreground">
                  Matched as a plain lower-case substring. No stemming — a near-match would open the
                  wrong answer and the rep would read it out.
                </span>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Response</span>
                <textarea
                  className={AREA}
                  rows={6}
                  value={draft.response}
                  onChange={(e) => setDraft({ ...draft, response: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">
                  Attach this prospect&apos;s evidence when
                </span>
                <select
                  className={FIELD}
                  value={draft.contextSelectorKey}
                  onChange={(e) => setDraft({ ...draft, contextSelectorKey: e.target.value })}
                >
                  <option value="">Never — this is the general answer</option>
                  {(objectionData?.selectors || []).map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Priority</span>
                <input
                  className={FIELD}
                  type="number"
                  inputMode="numeric"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                />
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  disabled={Boolean(busy)}
                  onClick={saveObjection}
                  className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
                >
                  <Save size={16} /> Save
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(objectionData?.objections || []).map((o) => (
            <div key={o.code} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground break-words">{o.label}</p>
                <p className="text-xs text-muted-foreground font-mono break-words">{o.code}</p>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{o.response}</p>
              <p className="text-xs text-muted-foreground break-words">
                Cues: {(o.cues || []).join(" · ") || "none"}
              </p>
              <p className="text-xs text-muted-foreground">
                {o.contextSelectorKey
                  ? `Carries this prospect's observations when: ${
                      (objectionData?.selectors || []).find((s) => s.key === o.contextSelectorKey)
                        ?.label || o.contextSelectorKey
                    }`
                  : "General answer — no prospect evidence attached."}
                {o.source === "built-in" ? " · built-in, not saved" : ""}
              </p>
              <Problems problems={o.problems} />
              {canWrite && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    onClick={() => beginEditObjection(o)}
                    className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                  >
                    Edit
                  </button>
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (!window.confirm(`Delete "${o.label}" for good?`)) return;
                      send(
                        `/api/platform/sales/playbooks/objections/${o.code}`,
                        { method: "DELETE" },
                        "Deleted.",
                      );
                    }}
                    className={`${BTN} w-full sm:w-auto bg-card border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300`}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Experiments ─────────────────────────────────────────────────── */}
      {!loading && tab === "experiments" && (
        <div className="space-y-3">
          <div className="bg-muted border border-border rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">
              Assignment happens before the call, and a rep cannot choose their arm.
            </p>
            <p className="mt-1">{experimentData?.winnerPolicy}</p>
          </div>

          {!store.ready && (
            <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
              No experiment can run: there is nowhere to store an assignment, and an assignment that
              is not stored before the call is not an experiment. No create control is drawn.
            </div>
          )}

          {canWrite && !draft && (
            <button
              onClick={beginAddExperiment}
              disabled={playbooks.length === 0}
              className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
            >
              <Plus size={16} /> New experiment
            </button>
          )}

          {draft?.kind === "experiment" && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Key</span>
                <input
                  className={FIELD}
                  value={draft.key}
                  onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                  placeholder="BOOKING_OPENER_2026Q4"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Name</span>
                <input
                  className={FIELD}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">
                  Hypothesis — written down before it runs
                </span>
                <textarea
                  className={AREA}
                  rows={3}
                  value={draft.hypothesis}
                  onChange={(e) => setDraft({ ...draft, hypothesis: e.target.value })}
                />
                <span className="block text-xs text-muted-foreground">
                  Without one, whatever the numbers do afterwards will look like it was predicted.
                </span>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Playbook</span>
                <select
                  className={FIELD}
                  value={draft.playbookKey}
                  onChange={(e) => setDraft({ ...draft, playbookKey: e.target.value })}
                >
                  {playbooks.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Variants</span>
                <textarea
                  className={`${AREA} font-mono text-sm`}
                  rows={12}
                  value={draft.variants}
                  onChange={(e) => setDraft({ ...draft, variants: e.target.value })}
                />
                <span className="block text-xs text-muted-foreground">
                  Each variant may override one of the nine stages. It cannot add or remove one —
                  two arms that do not cover the same stages are not comparable.
                </span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  disabled={Boolean(busy)}
                  onClick={saveExperiment}
                  className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}
                >
                  <Save size={16} /> Save
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(experimentData?.experiments || []).map((e) => (
            <div key={e.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground break-words">{e.name}</p>
                <p className="text-xs text-muted-foreground font-mono break-words">
                  {e.key} · {e.playbookKey} · {e.active ? "running" : "stopped"}
                </p>
              </div>
              <p className="text-sm text-foreground break-words">{e.hypothesis}</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {(e.summary?.variants || []).map((v) => (
                  <li key={v.key} className="break-words">
                    {v.label}: {v.assigned} assigned (weight {v.weight})
                  </li>
                ))}
              </ul>
              {e.summary?.orphanedAssignments > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {e.summary.orphanedAssignments} assignment(s) are filed under an arm that no
                  longer exists.
                </p>
              )}
              <p className="text-xs text-muted-foreground">{e.summary?.winnerPolicy}</p>
              <Problems problems={e.problems} />
              {canWrite && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    disabled={Boolean(busy)}
                    onClick={() =>
                      send(
                        `/api/platform/sales/playbooks/experiments/${e.id}`,
                        { method: "PATCH", body: { active: !e.active } },
                        e.active ? "Stopped. The assignments already made are kept." : "Running.",
                      )
                    }
                    className={`${BTN} w-full sm:w-auto bg-card border border-border text-foreground`}
                  >
                    {e.active ? "Stop" : "Start"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
