"use client";

// app/platform/sales/outcomes/page.js
//
// The second pass on call outcomes, in one place:
//
//   1. The callback agenda — every open promise on the floor, due today,
//      overdue, per rep — with the grace and the two limits beside it
//      (lib/sales/calls/callbackAgenda.js).
//   2. The sub-reason lists under each outcome, editable
//      (lib/sales/calls/subDispositions.js). The defaults are in code; an
//      edited list replaces the default for that one outcome; "Reset"
//      writes the default back rather than deleting anything.
//   3. The settings, each with its cost printed beside the control
//      (lib/sales/calls/outcomeSettings.js). Answering-machine detection is
//      the one that costs money per call and is off until the owner flips
//      it — the price is on the switch.
//
// Superadmin writes, every admin reads; every save is audit-logged with
// the values before and after. English only, like every /platform screen.
// Mobile-first: single column, 44px targets, no table wider than a phone.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarClock, ListChecks, Loader2, Save, SlidersHorizontal } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const BTN = "inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} bg-primary text-primary-foreground`;
const BTN_QUIET = `${BTN} border border-border text-foreground`;
const FIELD = "w-full min-h-[44px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

function when(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

const STATE_LABEL = { upcoming: "upcoming", due: "due", overdue: "overdue", flagged: "overdue > 24 h" };
const STATE_CLASS = {
  upcoming: "border-border",
  due: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  overdue: "border-amber-500 bg-amber-100 dark:bg-amber-950/50",
  flagged: "border-red-500 bg-red-50 dark:bg-red-950/40",
};

// ── 1. The agenda ────────────────────────────────────────────────────────
function Agenda() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/outcomes/callbacks"));
    } catch (err) {
      setError(err?.message || "Could not load the callbacks.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "today") return data.dueToday;
    if (filter === "overdue") return data.overdue;
    return data.items;
  }, [data, filter]);

  return (
    <section className={CARD} data-callback-agenda>
      <div className="flex items-center gap-2">
        <CalendarClock size={16} className="text-muted-foreground shrink-0" />
        <h2 className="text-base font-semibold text-foreground">Callback agenda</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Every open callback a rep promised, fourteen days either side of now. A callback is personal to the rep who promised it; when that rep is off at the hour it waits the grace below and then goes to the next available rep who can take the call — the same reachability and language rule as the inbound line — with the prospect&apos;s claim. Overdue past a day is flagged here and on the floor board.
      </p>
      {error ? (
        <p className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> Loading…
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Grace {data.graceMinutes} min · at most {data.maxOpenPerRep} open per rep · at most {data.maxDaysAhead} days ahead · {data.closedCount} kept or closed since promised (not listed).
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              ["open", `Open (${data.items.length})`],
              ["today", `Due today (${data.dueToday.length})`],
              ["overdue", `Overdue (${data.overdue.length}${data.flagged.length ? `, ${data.flagged.length} past a day` : ""})`],
            ].map(([key, label]) => (
              <button key={key} type="button" className={`${BTN} min-h-[40px] ${filter === key ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`} onClick={() => setFilter(key)} aria-pressed={filter === key}>
                {label}
              </button>
            ))}
            <button type="button" className={`${BTN_QUIET} min-h-[40px]`} onClick={load}>
              Refresh
            </button>
          </div>
          {data.perRep.length ? (
            <ul className="flex flex-wrap gap-2 text-xs" data-callback-per-rep>
              {data.perRep.map((r) => (
                <li key={r.repId || "none"} className="rounded-full border border-border px-2.5 py-1 text-foreground">
                  {r.name || "unassigned"}: {r.open} open{r.due ? `, ${r.due} due` : ""}{r.overdue ? `, ${r.overdue} overdue` : ""}{r.flagged ? `, ${r.flagged} past a day` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((c) => (
                <li key={c.id} className={`rounded-lg border p-2.5 text-sm ${STATE_CLASS[c.state] || "border-border"}`} data-callback-item={c.id} data-callback-state={c.state}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-medium text-foreground break-words">{c.businessName || c.toE164}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {when(c.callbackAt)} · {STATE_LABEL[c.state] || c.state}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground break-words">
                    {c.scope === "global" ? `Global — handed to ${c.deliveredTo || "—"} (promised by ${c.promisedBy || "—"}${c.reassignedAt ? `, at ${when(c.reassignedAt)}` : ""})` : `Personal — ${c.deliveredTo || c.promisedBy || "—"}`}
                    {c.notifiedAt ? ` · pushed ${when(c.notifiedAt)}` : " · not pushed yet"}
                    {c.prospectId ? (
                      <>
                        {" · "}
                        <Link href={`/platform/sales/prospects?id=${encodeURIComponent(c.prospectId)}`} className="underline">
                          prospect
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {c.note ? <p className="text-xs italic text-foreground break-words">“{c.note}”</p> : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// ── 2. Sub-reasons ───────────────────────────────────────────────────────
function SubReasons({ data, canWrite, onSaved }) {
  const [lists, setLists] = useState(data.lists);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => setLists(data.lists), [data.lists]);

  const patch = (code, index, field, value) =>
    setLists((cur) => ({
      ...cur,
      [code]: cur[code].map((e, i) => (i === index ? { ...e, ...(field === "label" ? { label: { ...(e.label || {}), ...value } } : { [field]: value }) } : e)),
    }));
  const add = (code) => setLists((cur) => ({ ...cur, [code]: [...cur[code], { key: "", label: { en: "", fr: "", es: "" }, askDetail: false }] }));
  const remove = (code, index) => setLists((cur) => ({ ...cur, [code]: cur[code].filter((_, i) => i !== index) }));
  const reset = (code) => setLists((cur) => ({ ...cur, [code]: data.defaults[code].map((e) => ({ ...e, label: { ...e.label } })) }));

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const next = await fetchJson("/api/platform/sales/outcomes/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subDispositions: lists }),
      });
      setNotice("Saved. The rep's sheet draws the new list on its next load.");
      onSaved(next);
    } catch (err) {
      setNotice(err?.message || "The lists could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD} data-sub-dispositions>
      <div className="flex items-center gap-2">
        <ListChecks size={16} className="text-muted-foreground shrink-0" />
        <h2 className="text-base font-semibold text-foreground">Sub-reasons under each outcome</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        The one thing about outcomes a superadmin may edit: the outcomes themselves carry code behaviour and stay closed (lib/sales/calls/dispositions.js). A rep picks one of these under the outcome — required whenever the list is not empty — and the performance page counts them. Keys are lowercase with underscores; the English label is required, French and Spanish are what a rep in that language sees. &ldquo;Asks a name&rdquo; draws a text field (the competitor&apos;s name).
      </p>
      {data.fallbacks?.length ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">Stored lists that did not survive validation are running on their defaults: {data.fallbacks.join("; ")}</p>
      ) : null}
      {data.codes.map((code) => (
        <div key={code} className="rounded-lg border border-border p-3 space-y-2" data-sub-list={code}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {code} <span className="text-xs font-normal text-muted-foreground">({data.source[code] === "custom" ? "edited" : "default"} · {lists[code].length} {lists[code].length === 1 ? "entry" : "entries"})</span>
            </p>
            {canWrite ? (
              <div className="flex gap-2">
                <button type="button" className={`${BTN_QUIET} min-h-[36px] px-3`} onClick={() => add(code)}>
                  Add
                </button>
                <button type="button" className={`${BTN_QUIET} min-h-[36px] px-3`} onClick={() => reset(code)}>
                  Reset to default
                </button>
              </div>
            ) : null}
          </div>
          {lists[code].length === 0 ? <p className="text-xs text-muted-foreground">No sub-reasons: the rep is not asked why.</p> : null}
          {lists[code].map((e, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center" data-sub-entry={e.key || i}>
              <input className={FIELD} value={e.key} placeholder="key_like_this" disabled={!canWrite} onChange={(ev) => patch(code, i, "key", ev.target.value)} aria-label="Key" />
              <input className={FIELD} value={e.label?.en || ""} placeholder="English label" disabled={!canWrite} onChange={(ev) => patch(code, i, "label", { en: ev.target.value })} aria-label="English label" />
              <input className={FIELD} value={e.label?.fr || ""} placeholder="Français" disabled={!canWrite} onChange={(ev) => patch(code, i, "label", { fr: ev.target.value })} aria-label="French label" />
              <input className={FIELD} value={e.label?.es || ""} placeholder="Español" disabled={!canWrite} onChange={(ev) => patch(code, i, "label", { es: ev.target.value })} aria-label="Spanish label" />
              <div className="flex items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 min-h-[44px]">
                  <input type="checkbox" checked={e.askDetail === true} disabled={!canWrite} onChange={(ev) => patch(code, i, "askDetail", ev.target.checked)} /> asks a name
                </label>
                {canWrite ? (
                  <button type="button" className="underline text-muted-foreground min-h-[44px]" onClick={() => remove(code, i)}>
                    remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ))}
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <Save size={14} />} Save the lists
          </button>
          {notice ? (
            <span className="text-sm text-foreground" role="status">
              {notice}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ── 3. Settings ──────────────────────────────────────────────────────────
function Settings({ data, canWrite, onSaved }) {
  const [values, setValues] = useState(Object.fromEntries(data.settings.map((r) => [r.key, r.value])));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => setValues(Object.fromEntries(data.settings.map((r) => [r.key, r.value]))), [data.settings]);

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const next = await fetchJson("/api/platform/sales/outcomes/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values }),
      });
      setNotice("Saved. Every setting applies from the next call, sweep or reconcile.");
      onSaved(next);
    } catch (err) {
      setNotice(err?.message || "The settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD} data-outcome-settings>
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={16} className="text-muted-foreground shrink-0" />
        <h2 className="text-base font-semibold text-foreground">Settings</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Each one says what it changes and what it costs. Answering-machine detection is billed by Twilio per call — ${data.amdUsdPerCall} — and is off until you switch it on here; the switch is the approval. The transcription and review shares are printed beside the spend on <Link href="/platform/costs" className="underline">Costs</Link>.
      </p>
      {data.fallbacks?.length ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">Stored values outside their bounds are running on the default: {data.fallbacks.map((f) => `${f.key} (${f.reason})`).join(", ")}</p>
      ) : null}
      <div className="space-y-3">
        {data.settings.map((r) => (
          <div key={r.key} className="rounded-lg border border-border p-3 space-y-1.5" data-outcome-setting={r.key}>
            <label className="block text-sm font-medium text-foreground" htmlFor={`s-${r.key}`}>
              {r.label} <span className="text-xs font-normal text-muted-foreground">({r.key}{r.isDefault ? "" : " · changed"})</span>
            </label>
            <p className="text-xs text-muted-foreground break-words">{r.help}</p>
            {r.kind === "bool" ? (
              <label className="inline-flex items-center gap-2 min-h-[44px] text-sm">
                <input id={`s-${r.key}`} type="checkbox" checked={values[r.key] === true} disabled={!canWrite} onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.checked }))} data-setting-toggle={r.key} />
                {values[r.key] === true ? "On" : "Off"}
              </label>
            ) : r.kind === "url" ? (
              <input id={`s-${r.key}`} type="url" className={FIELD} value={values[r.key] || ""} placeholder="https://… (empty: the rep leaves the message)" disabled={!canWrite} onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))} />
            ) : (
              <div className="flex items-center gap-2">
                <input id={`s-${r.key}`} type="number" className={`${FIELD} max-w-[10rem]`} min={r.min ?? undefined} max={r.max ?? undefined} step={1} value={values[r.key]} disabled={!canWrite} onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value === "" ? "" : Number(e.target.value) }))} />
                <span className="text-sm text-muted-foreground">
                  {r.unit} · {r.min}–{r.max} · default {r.default}
                </span>
              </div>
            )}
            {r.cost ? (
              <p className="text-xs text-amber-900 dark:text-amber-200 break-words" data-setting-cost={r.key}>
                {r.cost}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <Save size={14} />} Save settings
          </button>
          {notice ? (
            <span className="text-sm text-foreground" role="status">
              {notice}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function OutcomesScreen({ canWrite }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/outcomes/settings"));
    } catch (err) {
      setError(err?.message || "Could not load the outcome settings.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Agenda />
      {error ? (
        <p className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> Loading…
        </p>
      ) : (
        <>
          {data.readFailed ? <p className="text-sm text-amber-800 dark:text-amber-200">The settings row could not be read; what is shown is the defaults the floor is running on.</p> : null}
          <SubReasons data={data.subDispositions} canWrite={canWrite} onSaved={setData} />
          <Settings data={data} canWrite={canWrite} onSaved={setData} />
        </>
      )}
    </div>
  );
}

export default function PlatformSalesOutcomesPage() {
  const { status, error, isSuperadmin } = usePlatformAdmin();
  const canWrite = isSuperadmin;
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-muted-foreground shrink-0" />
          <h1 className="text-lg font-semibold text-foreground">Call outcomes</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          The callback agenda, the sub-reasons a rep picks under an outcome, and the settings behind the service level, the transcription and review samples and answering-machine detection. Reviewing a rep&apos;s outcome — approve, reject, observe — happens on{" "}
          <Link href="/platform/sales/call-quality" className="underline">Call quality</Link>, beside the recording and the transcript. docs/SALES-OUTCOMES.md has the model each piece came from.
        </p>
      </header>
      <PlatformWriteGate status={status} allowed={status === "ready"} error={error} action="Reading the call-outcome settings" who="Platform admins">
        <OutcomesScreen canWrite={canWrite} />
      </PlatformWriteGate>
    </div>
  );
}
