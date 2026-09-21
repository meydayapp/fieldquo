// app/platform/sales/review/SignupsSection.js
//
// The signup section at the top of the Review folder: the leads FieldQuo's
// own signup form produced, waiting for the owner to hand each one to a rep.
//
// ══ Why a section of this screen, and not a fourth reason in its SQL ═══════
//
// The folder below is a trade-classification machine over 299,000 scraped
// rows — bulk accept, bulk reject, By-suggestion groups, funnel counters
// that must balance. A signup row is none of that: it has no trade to
// confirm, it must never be bulk-anything'd, and its only decision is WHICH
// REP. So it is its own list on the same screen (the owner's "review
// folder"), read from /api/platform/sales/review/signups, with one control
// per row: a rep picker and Assign. The assign writes the same claim the
// prospects list's hand-pick writes; the rep hears about it the same way.
//
// ═══ The badges ══════════════════════════════════════════════════════════
//
//   HOT         an abandoned signup — typed a phone number, closed the tab.
//   New signup  a company created self-serve — a welcome call.
//   Stalled     that company with no card after the grace, or no quote in a
//               week.
//
// The badge component is the rep's (app/components/sales/SignupBadge.js),
// so its word is in the reader's language; the rest of this section is
// English like the console around it.
//
// `?signups=hot` (the funnel's link) narrows to the hot ones and opens the
// section; `?signups=all` opens it unfiltered.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Phone, Mail, RefreshCw, UserPlus } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import SignupBadge from "@/app/components/sales/SignupBadge";

const BTN = "inline-flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD = "border border-border rounded-lg px-3 py-2 min-h-[40px] text-sm bg-card text-foreground disabled:opacity-60";

function readSignupsParam() {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("signups");
  return v === "hot" || v === "all" ? v : null;
}

function ago(value) {
  if (!value) return "—";
  const m = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} days ago`;
}

export default function SignupsSection() {
  const [param] = useState(() => readSignupsParam());
  const [hotOnly, setHotOnly] = useState(param === "hot");
  const [open, setOpen] = useState(param !== null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState({}); // prospectId → salesRepId
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState({}); // prospectId → { tone, text }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson(`/api/platform/sales/review/signups${hotOnly ? "?hot=1" : ""}`));
    } catch (err) {
      setData(null);
      setError(err?.message || "Couldn't load the signup leads.");
    } finally {
      setLoading(false);
    }
  }, [hotOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (prospectId) => {
    const salesRepId = choice[prospectId] || "";
    if (!salesRepId) {
      setNotes((n) => ({ ...n, [prospectId]: { tone: "warn", text: "Pick a rep first." } }));
      return;
    }
    setBusy(prospectId);
    try {
      const res = await fetchJson("/api/platform/sales/review/signups", { method: "POST", body: { prospectId, salesRepId } });
      setNotes((n) => ({ ...n, [prospectId]: { tone: "ok", text: `Assigned to ${res.rep?.name || "the rep"} — it is in their queue now.` } }));
      // The row leaves this list on the next read: it is held now.
      setTimeout(load, 600);
    } catch (err) {
      setNotes((n) => ({ ...n, [prospectId]: { tone: "warn", text: err?.message || "Couldn't assign." } }));
    } finally {
      setBusy("");
    }
  };

  const rows = data?.signups || [];
  const reps = data?.reps || [];
  const hotCount = rows.filter((r) => r.signup?.badge === "hot").length;

  return (
    <section className="rounded-xl border border-border bg-card" data-review-signups>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 flex-wrap">
          <UserPlus size={16} aria-hidden="true" />
          <span className="text-base font-semibold text-foreground">Signups to assign</span>
          {loading ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground tabular-nums">
              {rows.length} waiting{hotCount ? ` · ${hotCount} hot` : ""}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground max-w-3xl">
            People who typed into FieldQuo&apos;s own signup form. <strong>Hot</strong> stopped part-way and left a phone number;{" "}
            <strong>New signup</strong> finished and needs a welcome call; <strong>Stalled</strong> finished and then stopped (no card, or no
            quote in a week). Each goes to ONE rep, by hand — none of these is ever claimed from a queue or touched by a trade bulk.
            A signup that came in on a rep&apos;s own link is not here: it is that rep&apos;s already.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={hotOnly} onChange={(e) => setHotOnly(e.target.checked)} /> Hot only
            </label>
            <button type="button" onClick={load} disabled={loading} className={`${BTN} border border-border text-foreground`}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} /> {error}
            </div>
          ) : loading && !data ? null : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{hotOnly ? "No hot signup leads waiting." : "No signup leads waiting for a rep."}</p>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {rows.map((r) => {
                const note = notes[r.id];
                const canAssign = reps.length > 0;
                return (
                  <li key={r.id} className="px-4 py-3 flex flex-wrap gap-4 justify-between" data-review-signup-row data-kind={r.signup?.kind}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SignupBadge kind={r.signup?.badge} />
                        <span className="font-medium text-foreground break-words">{r.businessName}</span>
                        {r.contactName ? <span className="text-sm text-muted-foreground">— {r.contactName}</span> : null}
                        {r.requiredLanguage === "fr" ? (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">Français</span>
                        ) : null}
                      </div>
                      {r.signup?.fact ? <p className="text-sm text-foreground break-words">{r.signup.fact.text}</p> : null}
                      <div className="text-xs text-muted-foreground">
                        {r.where || "no address"}
                        {r.tradeKey ? ` · ${r.tradeKey}` : ""}
                        {` · ${r.signup?.kind === "abandoned" ? "last seen" : "signed up"} ${ago(r.signup?.at || r.createdAt)}`}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {r.phoneE164 ? (
                          <a href={`tel:${r.phoneE164}`} className="inline-flex items-center gap-1 text-foreground hover:underline">
                            <Phone size={12} /> {r.phoneE164}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">no phone</span>
                        )}
                        {r.email ? (
                          <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-foreground hover:underline">
                            <Mail size={12} /> {r.email}
                          </a>
                        ) : null}
                      </div>
                      {note ? (
                        <p className={`text-xs ${note.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{note.text}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label={`Rep for ${r.businessName}`}
                        className={FIELD}
                        value={choice[r.id] || ""}
                        onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
                        disabled={!canAssign || busy === r.id}
                      >
                        <option value="">{canAssign ? "Choose a rep…" : "No active reps"}</option>
                        {reps.map((rep) => (
                          <option key={rep.id} value={rep.id}>
                            {rep.name}
                            {rep.sellsIn?.length ? ` (${rep.sellsIn.join("/")})` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => assign(r.id)}
                        disabled={!canAssign || busy === r.id || !choice[r.id]}
                        className={`${BTN} bg-primary text-primary-foreground`}
                        data-assign-signup={r.id}
                      >
                        {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : null}
                        Assign
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
