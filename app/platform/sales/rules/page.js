// app/platform/sales/rules/page.js
//
// When a capability gap becomes something a rep says out loud.
//
// ══ Why this screen exists ════════════════════════════════════════════════
//
// `OpportunityRule` had a table, a seed and a validator, and no way to write a
// row except by hand in the database. The owner's standing rule names exactly
// that: shipping the table and the seed and calling it configurable because a
// superadmin COULD edit the row is not a UI.
//
// ══ The conditions editor, and why there are two of them ═════════════════
//
// A raw JSON textarea is acceptable here only because the save runs the
// evaluator's own `validateRule` and prints its refusals — a textarea that
// swallowed a malformed condition and failed at evaluation time, on a call,
// is the dead control AGENTS.md forbids. But raw JSON on a phone is miserable,
// so the default is a structured editor: one condition per row, three selects,
// no typing.
//
// The structured editor appears only when it can represent the rule EXACTLY.
// `canBuild` below refuses anything with a key it does not know, and the raw
// textarea takes over with a line saying why. The alternative — a builder that
// quietly drops the key it did not understand — would silently rewrite a rule
// somebody is only editing the name of.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px touch targets, no modal and no
// table. scripts/check-mobile-surfaces.mjs holds this file to that; what it
// can and cannot prove is in its own header.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { blankNumberMessage, numberOrNull } from "@/lib/platform/numericField";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

/** Every key each condition kind may carry. Anything else and the builder stands down. */
const CONDITION_SHAPE = {
  capability: ["kind", "code", "is"],
  capabilityUnknown: ["kind", "code"],
  technology: ["kind", "code", "present"],
  competitor: ["kind", "present"],
};

/** What each kind means, in the words the evaluator's own header uses. */
const KIND_LABEL = {
  capability: "They have / do not have",
  capabilityUnknown: "We have not been able to check",
  technology: "A specific technology is / is not installed",
  competitor: "Any competitor platform is / is not installed",
};

/** Variables renderReason can ever fill. A template naming anything else is refused. */
const TEMPLATE_VARS = ["{capabilityName}", "{competitor}", "{competitorCount}"];

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

/** Can the structured editor represent these conditions without losing anything? */
function canBuild(conditions) {
  if (!conditions || typeof conditions !== "object" || Array.isArray(conditions)) return false;
  const keys = Object.keys(conditions);
  if (keys.some((k) => k !== "all" && k !== "any")) return false;
  for (const group of [conditions.all, conditions.any]) {
    if (group === undefined) continue;
    if (!Array.isArray(group)) return false;
    for (const c of group) {
      if (!c || typeof c !== "object" || Array.isArray(c)) return false;
      const shape = CONDITION_SHAPE[c.kind];
      if (!shape) return false;
      if (Object.keys(c).some((k) => !shape.includes(k))) return false;
      if (c.kind === "capability" && typeof c.is !== "boolean") return false;
      if ("present" in c && typeof c.present !== "boolean") return false;
      if (shape.includes("code") && typeof c.code !== "string") return false;
    }
  }
  return true;
}

function blankCondition(kind, firstCode) {
  if (kind === "capability") return { kind, code: firstCode, is: false };
  if (kind === "capabilityUnknown") return { kind, code: firstCode };
  if (kind === "technology") return { kind, code: "", present: true };
  return { kind: "competitor", present: false };
}

export default function PlatformSalesRulesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState("");
  const [draft, setDraft] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/rules"));
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

  // Was a hand-rolled `fetchJson("/api/platform/me").catch(() => null)` whose
  // failure left `me` null — read here as "not a superadmin" and answered with
  // a refusal, shown to a superadmin, for a power they hold. The shared hook
  // keeps never-loaded apart from refused; see PlatformWriteGate's header.
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();
  const rules = data?.rules || [];
  const capabilities = data?.capabilities || [];
  const observable = data?.observableCapabilityCodes || [];

  function beginEdit(rule) {
    setOpen(rule.code);
    setDraft({
      code: rule.code,
      name: rule.name,
      capabilityCode: rule.capabilityCode,
      priority: rule.priority,
      reasonTemplate: rule.reasonTemplate,
      conditions: rule.conditions,
      raw: JSON.stringify(rule.conditions, null, 2),
      useRaw: !canBuild(rule.conditions),
      isNew: false,
    });
    setError("");
    setProblems([]);
  }

  function beginAdd() {
    const first = observable[0] || "";
    setAdding(true);
    setOpen("");
    setDraft({
      code: "",
      name: "",
      capabilityCode: capabilities.find((c) => c.active)?.code || "",
      priority: 50,
      reasonTemplate: "",
      conditions: { all: [blankCondition("capability", first)] },
      raw: JSON.stringify({ all: [blankCondition("capability", first)] }, null, 2),
      useRaw: false,
      isNew: true,
    });
    setError("");
    setProblems([]);
  }

  function cancel() {
    setDraft(null);
    setAdding(false);
    setOpen("");
    setError("");
    setProblems([]);
  }

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
      setAdding(false);
      setOpen("");
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      setProblems(err.data?.problems || []);
      return false;
    } finally {
      setBusy("");
    }
  }

  function bodyFromDraft() {
    // numberOrNull, not Number(). Number("") is 0, and priority 0 is not a
    // no-op here: buildOpportunities resolves two rules recommending the same
    // capability by priority and refuses the loser, so an empty box silently
    // demoted a rule below every other one. save() refuses on null rather than
    // posting it — the route would accept 0 happily.
    const body = {
      name: draft.name,
      capabilityCode: draft.capabilityCode,
      priority: numberOrNull(draft.priority),
      reasonTemplate: draft.reasonTemplate,
      // The raw text is sent as text so the server's JSON.parse produces the
      // error message, with its position, rather than the browser swallowing it.
      conditions: draft.useRaw ? draft.raw : draft.conditions,
    };
    if (draft.isNew) body.code = draft.code;
    return body;
  }

  async function save() {
    const body = bodyFromDraft();
    if (body.priority === null) {
      setError(blankNumberMessage("Priority"));
      setProblems([]);
      return;
    }
    if (draft.isNew) {
      await send(
        "/api/platform/sales/rules",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        (r) => `${r.rule.code} added at version ${r.rule.version}. It is on.`,
      );
      return;
    }
    await send(
      `/api/platform/sales/rules/${draft.code}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      (r) =>
        r.bumped
          ? `Saved. What this rule decides changed, so it is now version ${r.rule.version} — recommendations already stored still cite the version that produced them.`
          : "Saved. Nothing about what this rule decides changed, so the version is unchanged.",
    );
  }

  async function toggle(rule) {
    const turningOff = rule.active;
    if (
      turningOff &&
      !confirm(
        `Switch off "${rule.name}"?\n\n` +
          "It stops producing recommendations immediately. It is not deleted, the " +
          `${rule.resultCount} recommendation${rule.resultCount === 1 ? "" : "s"} it has already ` +
          "produced stay where they are, and switching it back on resumes it unchanged.",
      )
    ) {
      return;
    }
    await send(
      `/api/platform/sales/rules/${rule.code}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rule.active }),
      },
      turningOff ? `${rule.code} is off.` : `${rule.code} is on.`,
    );
  }

  async function remove(rule) {
    if (
      !confirm(
        `Delete "${rule.name}" for good?\n\n` +
          "It has produced nothing, so there is no history to lose. This cannot be undone.",
      )
    ) {
      return;
    }
    await send(
      `/api/platform/sales/rules/${rule.code}`,
      { method: "DELETE" },
      `${rule.code} deleted.`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Opportunity rules</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          A rule turns something we observed about a business into a sentence a
          rep says. Rules are data, not code — this screen is the only place
          they are written. What a rule may recommend comes from the{" "}
          <Link
            href="/platform/sales/capabilities"
            className="underline font-medium text-foreground"
          >
            capability matrix
          </Link>
          ; every recommendation carries a foreign key into it.
        </p>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Nothing here can invent a recommendation out of nothing: a rule built
          only from &ldquo;they do not have X&rdquo; cites no evidence and is
          refused when it runs. Saving runs the same validator the evaluator
          does, so a rule that could never fire is refused here rather than
          discovered by a rep at the top of a call.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {problems.length > 0 && (
            <ul className="mt-2 space-y-1 pl-6 list-disc">
              {problems.map((p) => (
                <li key={p.code}>{p.text}</li>
              ))}
            </ul>
          )}
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
        action="Writing an opportunity rule"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {isSuperadmin && !adding && (
        <button onClick={beginAdd} className={`${BTN} w-full sm:w-auto bg-inverted text-inverted-foreground`}>
          <Plus size={16} /> Add a rule
        </button>
      )}

      {adding && draft && (
        <RuleForm
          draft={draft}
          setDraft={setDraft}
          capabilities={capabilities}
          observable={observable}
          onSave={save}
          onCancel={cancel}
          busy={Boolean(busy)}
          title="New rule"
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
          There are no rules, so no prospect can ever be given a recommendation.
          The seven starter rules live in code and are written by{" "}
          <Link
            href="/platform/sales/capabilities"
            className="underline font-medium text-foreground"
          >
            Seed / refresh from code
          </Link>{" "}
          on the capability matrix screen.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const editing = open === rule.code && draft && !draft.isNew;
            return (
              <div
                key={rule.code}
                className={`bg-card border rounded-xl ${
                  rule.valid ? "border-border" : "border-red-300 dark:border-red-900"
                } ${rule.active ? "" : "opacity-75"}`}
              >
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <h2 className="text-sm font-semibold text-foreground min-w-0 break-words">
                        {rule.name}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono break-all">{rule.code}</span>
                      <span>v{rule.version}</span>
                      <span>priority {rule.priority}</span>
                      <span
                        className={
                          rule.active
                            ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                            : "text-red-700 dark:text-red-400 font-semibold"
                        }
                      >
                        {rule.active ? "On" : "Off"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      Recommends{" "}
                      <span className="font-mono">{rule.capabilityCode}</span> ·{" "}
                      {rule.resultCount === 0
                        ? "has produced nothing yet"
                        : `has produced ${rule.resultCount} recommendation${rule.resultCount === 1 ? "" : "s"}`}
                    </p>
                  </div>

                  {!rule.valid && (
                    <div className="border border-red-200 dark:border-red-900 rounded-lg p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
                      <div className="font-semibold">
                        As written, this rule can never produce a recommendation.
                      </div>
                      {rule.problems.map((p) => (
                        <div key={p.code}>• {p.text}</div>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground break-words">
                    {rule.reasonTemplate}
                  </p>

                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold text-foreground min-h-[44px] flex items-center gap-1">
                      <ChevronRight size={13} /> Conditions
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-muted text-muted-foreground text-xs overflow-x-auto">
                      {JSON.stringify(rule.conditions, null, 2)}
                    </pre>
                  </details>

                  {isSuperadmin && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => (editing ? cancel() : beginEdit(rule))}
                        className={`${BTN} border border-border text-foreground`}
                      >
                        <ChevronDown size={14} /> {editing ? "Close" : "Edit"}
                      </button>
                      <button
                        onClick={() => toggle(rule)}
                        disabled={Boolean(busy)}
                        className={`${BTN} border border-border text-foreground`}
                      >
                        {rule.active ? (
                          <>
                            <Ban size={14} /> Switch off
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Switch on
                          </>
                        )}
                      </button>
                      {rule.deletable ? (
                        <button
                          onClick={() => remove(rule)}
                          disabled={Boolean(busy)}
                          className={`${BTN} border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300`}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      ) : (
                        // Not a disabled button: a control that is visible and
                        // refuses is a control that appears to work. The
                        // sentence says what to do instead.
                        <p className="text-xs text-muted-foreground sm:self-center">
                          Cannot be deleted — it is the provenance of{" "}
                          {rule.resultCount} recommendation
                          {rule.resultCount === 1 ? "" : "s"}. Switch it off
                          instead.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {editing && (
                  <div className="border-t border-border p-4">
                    <RuleForm
                      draft={draft}
                      setDraft={setDraft}
                      capabilities={capabilities}
                      observable={observable}
                      onSave={save}
                      onCancel={cancel}
                      busy={Boolean(busy)}
                      title={`Editing ${rule.code}`}
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
          Editing the capability, the conditions, the reason or the priority
          changes what the rule DECIDES, so the version is bumped. Every
          recommendation is stored with the version that produced it, and a
          version edited in place would make last month&rsquo;s history a
          citation of something that no longer exists.
        </p>
        <p>
          Renaming a rule, or switching it on and off, does not bump it. A label
          is not a decision, and a rule switched back on means exactly what it
          meant before.
        </p>
      </div>
    </div>
  );
}

/**
 * One rule's form. Split out because the add and edit paths are the same form
 * — a second copy is the one that would drift.
 */
function RuleForm({ draft, setDraft, capabilities, observable, onSave, onCancel, busy, title }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const built = !draft.useRaw;

  function setGroup(group, next) {
    const conditions = { ...draft.conditions, [group]: next };
    if (next.length === 0) delete conditions[group];
    set({ conditions, raw: JSON.stringify(conditions, null, 2) });
  }

  function renderGroup(group) {
    const list = Array.isArray(draft.conditions?.[group]) ? draft.conditions[group] : [];
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-foreground">
          {group === "all"
            ? "All of these must be true"
            : "At least one of these must be true (optional)"}
        </div>
        {list.map((c, i) => (
          <ConditionRow
            key={`${group}-${i}`}
            condition={c}
            observable={observable}
            onChange={(next) =>
              setGroup(
                group,
                list.map((x, j) => (j === i ? next : x)),
              )
            }
            onRemove={() =>
              setGroup(
                group,
                list.filter((_, j) => j !== i),
              )
            }
          />
        ))}
        <button
          type="button"
          onClick={() => setGroup(group, [...list, blankCondition("capability", observable[0] || "")])}
          className={`${BTN} w-full sm:w-auto border border-border text-foreground`}
        >
          <Plus size={14} /> Add a condition
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>

      {draft.isNew && (
        <div>
          <label htmlFor="rule-code" className="block text-xs font-medium text-muted-foreground mb-1">
            Code — permanent, and stamped on every recommendation
          </label>
          <input
            id="rule-code"
            value={draft.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            placeholder="NO_ONLINE_PAYMENT"
            className={`${FIELD} font-mono`}
          />
        </div>
      )}

      <div>
        <label htmlFor="rule-name" className="block text-xs font-medium text-muted-foreground mb-1">
          Name
        </label>
        <input
          id="rule-name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          className={FIELD}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="rule-capability"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Recommends
          </label>
          <select
            id="rule-capability"
            value={draft.capabilityCode}
            onChange={(e) => set({ capabilityCode: e.target.value })}
            className={FIELD}
          >
            <option value="">Choose a capability…</option>
            {capabilities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.active ? "" : " (switched off)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="rule-priority"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Priority (0–1000) — higher wins a tie
          </label>
          <input
            id="rule-priority"
            type="number"
            min={0}
            max={1000}
            step={1}
            value={draft.priority}
            onChange={(e) => set({ priority: e.target.value })}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="rule-reason"
          className="block text-xs font-medium text-muted-foreground mb-1"
        >
          What the rep reads
        </label>
        <textarea
          id="rule-reason"
          rows={5}
          value={draft.reasonTemplate}
          onChange={(e) => set({ reasonTemplate: e.target.value })}
          className={FIELD}
        />
        <p className="text-xs text-muted-foreground mt-1">
          You may use {TEMPLATE_VARS.join(", ")}. Any other placeholder is
          refused — a sentence with a hole in it is worse on a call than no
          sentence.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Conditions</span>
          <button
            type="button"
            onClick={() => {
              if (built) {
                set({ useRaw: true, raw: JSON.stringify(draft.conditions, null, 2) });
                return;
              }
              // Back to the builder only if the JSON it would edit is one the
              // builder can hold without dropping anything.
              try {
                const parsed = JSON.parse(draft.raw);
                if (!canBuild(parsed)) return;
                set({ useRaw: false, conditions: parsed });
              } catch {
                // Unparseable: stay in the textarea, where the error is visible.
              }
            }}
            disabled={!built && !safeCanBuild(draft.raw)}
            className={`${BTN} border border-border text-foreground text-xs`}
          >
            {built ? "Edit as JSON" : "Back to the builder"}
          </button>
        </div>

        {built ? (
          <>
            {renderGroup("all")}
            {renderGroup("any")}
          </>
        ) : (
          <>
            <textarea
              id="rule-conditions"
              rows={12}
              value={draft.raw}
              onChange={(e) => set({ raw: e.target.value })}
              className={`${FIELD} font-mono`}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              {safeCanBuild(draft.raw)
                ? "This is valid JSON the builder can hold."
                : "The builder cannot hold this — it is either not valid JSON yet, or it uses a shape the builder would have to drop something to show. Saving runs the real validator either way."}
            </p>
          </>
        )}
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

function safeCanBuild(raw) {
  try {
    return canBuild(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** One condition: a kind, and whichever of code/is/present that kind carries. */
function ConditionRow({ condition, observable, onChange, onRemove }) {
  const kind = condition.kind;
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <select
        value={kind}
        onChange={(e) => onChange(blankCondition(e.target.value, observable[0] || ""))}
        className={FIELD}
        aria-label="Condition kind"
      >
        {Object.keys(CONDITION_SHAPE).map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>

      {(kind === "capability" || kind === "capabilityUnknown") && (
        <select
          value={condition.code || ""}
          onChange={(e) => onChange({ ...condition, code: e.target.value })}
          className={FIELD}
          aria-label="Capability code"
        >
          <option value="">Choose what was observed…</option>
          {observable.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      )}

      {kind === "technology" && (
        <input
          value={condition.code || ""}
          onChange={(e) => onChange({ ...condition, code: e.target.value.toUpperCase() })}
          placeholder="JOBBER"
          className={`${FIELD} font-mono`}
          aria-label="Technology code"
        />
      )}

      {kind === "capability" && (
        <select
          value={condition.is === true ? "true" : "false"}
          onChange={(e) => onChange({ ...condition, is: e.target.value === "true" })}
          className={FIELD}
          aria-label="Observed value"
        >
          <option value="true">…and we saw that they DO</option>
          <option value="false">…and we saw that they do NOT</option>
        </select>
      )}

      {(kind === "technology" || kind === "competitor") && (
        <select
          value={condition.present === false ? "false" : "true"}
          onChange={(e) => onChange({ ...condition, present: e.target.value === "true" })}
          className={FIELD}
          aria-label="Present or absent"
        >
          <option value="true">…is installed</option>
          <option value="false">…is not installed</option>
        </select>
      )}

      {kind === "capabilityUnknown" && (
        <p className="text-xs text-muted-foreground">
          Matches when we have no reading at all. It cites no evidence, so a
          rule built only out of these can never produce a recommendation.
        </p>
      )}

      <button
        type="button"
        onClick={onRemove}
        className={`${BTN} w-full sm:w-auto border border-border text-foreground text-xs`}
      >
        <Trash2 size={13} /> Remove this condition
      </button>
    </div>
  );
}
