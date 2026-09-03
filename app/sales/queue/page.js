// app/sales/queue/page.js
//
// Today's queue. One prospect at a time, everything already researched.
//
// ══ Why one at a time and not a list ══════════════════════════════════════
//
// This is the spec's §54 screen and the shape is the point: a rep is holding a
// phone, about to say this out loud to a stranger. A list invites scanning and
// cherry-picking; a single card with a call button and three labelled layers
// invites reading the thing they are about to say. The queue strip at the top
// says how many are behind this one, which is the only list information that
// changes what a rep does next.
//
// ══ The three layers are three sections, in the same order, every time ════
//
// Facts, then inferences, then recommendations. A rep must be able to tell at a
// glance which is which, because the difference is what they are entitled to
// ASSERT. So:
//
//   - a fact is a plain sentence;
//   - a fact we could not establish says so, in its own tone, and never in the
//     same words as a fact we established to be absent — "no online booking"
//     and "we don't know" are different sentences, and confusing them means
//     telling a contractor they lack a booking page while they are looking at
//     one;
//   - an inference is prefixed "We think" and NEVER appears without its
//     confidence — lib/sales/prospectView.js refuses to render one that has
//     none, and this page prints that refusal;
//   - a recommendation leads with its reason, not with the feature name.
//
// None of those decisions live in this file. They live in
// lib/sales/prospectView.js, which calls the presenters in
// lib/sales/intel/confidence.js, so a fourth screen cannot re-decide them.
//
// ══ Single-trade ══════════════════════════════════════════════════════════
//
// The owner's reasoning: a rep who says the same script forty times gets better
// at it. The trade picker is the spine of the screen and there is no "all
// trades" option to pick by accident.
//
// ══ English-only, like the rest of the outreach portal ════════════════════
//
// /sales/leads and /sales/threads are English-only (docs/sales-intel/STATUS.md
// records it); the shell and the companies list are translated. This follows
// the outreach screens rather than the shell, because it is the same audience
// doing the same job, and half a translated screen is worse than none.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px targets, no table and no modal.
// This file is in scripts/check-mobile-surfaces.mjs's STRICT list.
//
// ══ There is no `tel:` string in this file, and that is deliberate ════════
//
// Until 2026-09-03 this page rendered `href={`tel:${current.phoneE164}`}` with
// no check of any kind, so a rep could dial an Oklahoma contractor at three in
// the morning against a statute with a $500 trebled private right of action.
// The href is now built by dialHref() in lib/sales/callingRules.js, which
// cannot return one from a refusal or an unknown. Adding a condition around
// the old link would have been one careless edit from regressing, and a check
// script arguing with JSX about which branch a string sits in has produced a
// false pass in this project before. Taking the string away entirely makes the
// rule executable instead of textual —
// scripts/check-sales-calling-window.mjs calls dialHref with each decision and
// reads the answer, and separately asserts no `tel:` anywhere under app/sales.
//
// ══ The decision is re-asked on a timer ═══════════════════════════════════
//
// The window closes while the page is open. A decision computed by the server
// at 19:59 and left on screen until midnight is a dial button that looks live
// and is not — the same dead control in the other direction. So the page
// re-evaluates the same pure function every thirty seconds, against the
// SERVER's clock plus elapsed time rather than the rep's own, because a laptop
// an hour fast would otherwise open the window an hour early.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Loader2,
  Phone,
  Plus,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { LAYER_HEADINGS } from "@/lib/sales/prospectView";
import { CALL_ALLOWED, CALL_REFUSED, dialHref, salesCallReadiness } from "@/lib/sales/callingRules";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

/**
 * Three tones, because there are three states.
 *
 * `gap` is a finding — we looked and it is not there. `unknown` is not a
 * finding at all. Rendering them in one colour is the single most damaging
 * thing this screen could do, so they differ in colour, in border style and in
 * wording.
 */
const TONE_CLASS = {
  has: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
  gap: "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800",
  unknown: "bg-muted text-muted-foreground border-border border-dashed",
};

function Pill({ tone = "unknown", children }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs ${TONE_CLASS[tone] || TONE_CLASS.unknown}`}
    >
      {children}
    </span>
  );
}

/**
 * One reason a call cannot go ahead, or one caveat on a call that can.
 *
 * `tone` follows the same three-state discipline the pills do, and for the
 * harder version of the same reason. "It is 21:00 in Tulsa" is a finding and
 * gets the amber a finding gets; "nobody has read Colorado's statute" is not a
 * finding at all, and giving it the same colour would tell a rep we checked.
 * The dashed muted box is the one this page already uses for `unknown`.
 */
function Notice({ tone, icon: Icon, title, fix }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${TONE_CLASS[tone] || TONE_CLASS.unknown}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold break-words">{title}</p>
          {fix ? <p className="break-words">{fix}</p> : null}
        </div>
      </div>
    </div>
  );
}

function LayerHeader({ layer }) {
  const heading = LAYER_HEADINGS[layer];
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{heading.title}</h2>
      <p className="text-xs text-muted-foreground">{heading.note}</p>
    </div>
  );
}

export default function SalesQueuePage() {
  const [tradeKey, setTradeKey] = useState("");
  const [prospectId, setProspectId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dncOpen, setDncOpen] = useState(false);
  const [dncReason, setDncReason] = useState("");

  // What the server's clock read, and what ours read at the same moment. The
  // difference is applied to every window re-evaluation below.
  const [clock, setClock] = useState(null);

  const stampClock = useCallback((body) => {
    const serverMs = body?.serverNow ? Date.parse(body.serverNow) : NaN;
    setClock(Number.isFinite(serverMs) ? { serverMs, localMs: Date.now() } : null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (tradeKey) params.set("tradeKey", tradeKey);
      if (prospectId) params.set("prospectId", prospectId);
      const body = await fetchJson(`/api/sales/queue?${params.toString()}`);
      stampClock(body);
      setData(body);
    } catch (err) {
      setError(err?.message || "Could not load your queue.");
    } finally {
      setLoading(false);
    }
  }, [tradeKey, prospectId, stampClock]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    try {
      const body = await fetchJson("/api/sales/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tradeKey, ...extra }),
      });
      if (body?.claimed === null) {
        // The server has an honest answer for "nothing to give you" and it is
        // not an error. Say it, and leave the queue as it was.
        setError(body.message);
      } else {
        stampClock(body);
        setData(body);
        setProspectId(body?.current?.id || "");
      }
    } catch (err) {
      setError(err?.message || "That did not work.");
    } finally {
      setBusy("");
      setDncOpen(false);
      setDncReason("");
    }
  }

  const current = data?.current || null;
  const items = data?.queue?.items || [];
  const index = current ? items.findIndex((i) => i.id === current.id) : -1;

  // A counter, not a clock. The real time is read fresh below; this only
  // exists to make the render happen again while the page sits open.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const compliance = useMemo(() => {
    if (!current) return null;
    const ctx = current.callingContext;
    // No context means an older response shape; fall back to the server's own
    // answer rather than deciding nothing was said about it.
    if (!ctx) return current.compliance || null;
    const nowMs = clock ? clock.serverMs + (Date.now() - clock.localMs) : Date.now();
    return salesCallReadiness({
      prospect: { country: ctx.country, province: ctx.province },
      timeZone: ctx.timeZone,
      now: new Date(nowMs),
    });
    // `tick` is here to re-run this every thirty seconds; it is not read.
  }, [current, clock, tick]);

  const href = dialHref(compliance, current?.phoneE164);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Today&rsquo;s queue</h1>
        <p className="text-sm text-muted-foreground">
          One trade at a time — you get better at a script by saying it forty times, not by switching every
          call. Everything below has already been researched. What we could not establish says so.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      <section className={CARD}>
        <label className="block text-sm font-medium text-foreground mb-1" htmlFor="q-trade">
          Which trade are you calling today?
        </label>
        <select
          id="q-trade"
          className={FIELD}
          value={tradeKey}
          onChange={(e) => {
            setProspectId("");
            setTradeKey(e.target.value);
          }}
        >
          <option value="">Everything I have claimed</option>
          {(data?.trades || []).map((t) => (
            <option key={t.key} value={t.key}>
              {t.label} — {t.claimed} claimed, {t.available} free
            </option>
          ))}
        </select>
        {tradeKey ? (
          <button
            type="button"
            className={`${BTN} bg-primary text-primary-foreground w-full`}
            disabled={Boolean(busy)}
            onClick={() => act("claim")}
          >
            {busy === "claim" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            Claim the next one
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick a trade to claim a new prospect. Claiming is what stops two reps phoning the same contractor,
            so there is no way to work one without it.
          </p>
        )}
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading your queue…
        </div>
      ) : null}

      {!loading && data?.queue?.empty ? (
        <div className={CARD}>
          <p className="text-sm text-foreground break-words">{data.queue.emptyText}</p>
          <p className="text-xs text-muted-foreground">
            Nothing is invented to fill this screen. An empty queue is an empty queue.
          </p>
        </div>
      ) : null}

      {!loading && current ? (
        <>
          {items.length > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${BTN} border border-border text-foreground flex-1`}
                disabled={index <= 0}
                onClick={() => setProspectId(items[index - 1].id)}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="text-xs text-muted-foreground">
                {index + 1} of {items.length}
              </span>
              <button
                type="button"
                className={`${BTN} border border-border text-foreground flex-1`}
                disabled={index < 0 || index >= items.length - 1}
                onClick={() => setProspectId(items[index + 1].id)}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          ) : null}

          {/* ── Who this is, and whether you may ring them ──────────────── */}
          <section className={CARD}>
            <h2 className="text-lg font-semibold text-foreground break-words">{current.businessName}</h2>
            <p className="text-sm text-muted-foreground break-words">
              {[current.tradeLabel, current.territory?.name].filter(Boolean).join(" · ") ||
                "No trade or territory on this record"}
            </p>

            {!current.contact.callable ? (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
                <div className="flex items-start gap-2">
                  <Ban size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{current.contact.title}</p>
                    <p className="break-words">{current.contact.text}</p>
                    <p className="mt-1">
                      No dial control is shown, because pressing one would be a mistake rather than a refusal.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* The dial control exists only when dialHref returns one, and
                    it returns one only from an `allowed` decision. There is no
                    greyed-out version: a control that looks broken teaches a
                    rep to press it harder, so the space it would occupy carries
                    the rule and the hour instead. */}
                {href ? (
                  <a href={href} className={`${BTN} bg-primary text-primary-foreground w-full`}>
                    <Phone size={16} /> Call {current.phoneE164}
                  </a>
                ) : null}

                {/* Neither a decision nor the inputs to make one. Only reachable
                    if a stale bundle meets a newer API or the reverse, and the
                    honest answer is still an answer — a blank space here would
                    be the silent version of the dead control. */}
                {!compliance ? (
                  <Notice
                    tone="unknown"
                    icon={CircleHelp}
                    title="We cannot confirm this call is allowed."
                    fix="This screen could not work out which calling rules apply. Reload it."
                  />
                ) : null}

                {(compliance?.blockers || []).map((b) => (
                  <Notice
                    key={b.code}
                    tone={compliance.decision === CALL_REFUSED ? "gap" : "unknown"}
                    icon={compliance.decision === CALL_REFUSED ? Clock : CircleHelp}
                    title={
                      compliance.decision === CALL_REFUSED
                        ? b.title
                        : `We cannot confirm this call is allowed. ${b.title}`
                    }
                    fix={b.fix}
                  />
                ))}

                {/* Said beside a working button on purpose. A cap nothing
                    counts, and a registration nobody has filed, are facts about
                    THIS call — burying them in a document is how they stop
                    being true. */}
                {(compliance?.unenforced || []).map((u) => (
                  <Notice key={u.code} tone="gap" icon={ShieldAlert} title={u.title} fix={u.fix} />
                ))}
                {(compliance?.warnings || []).map((w) => (
                  <Notice key={w.code} tone="gap" icon={ShieldAlert} title={w.title} fix={w.fix} />
                ))}

                {compliance?.decision === CALL_ALLOWED && compliance.windowText ? (
                  <p className="text-xs text-muted-foreground break-words">
                    {compliance.jurisdiction?.name}: {compliance.windowText}. Judged in{" "}
                    {compliance.zoneSource === "stated"
                      ? "the time zone recorded on their lead"
                      : `the time zone their address implies (${compliance.zones.join(", ")})`}
                    .
                  </p>
                ) : null}
              </div>
            )}

            <p className="text-xs text-muted-foreground break-words">{current.claim.text}</p>
          </section>

          {/* ── Layer 1: facts ─────────────────────────────────────────── */}
          <section className={CARD}>
            <LayerHeader layer="fact" />
            <ul className="space-y-2">
              {current.facts.map((f) => (
                <li key={f.key} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span
                    className={`text-sm break-words ${f.known ? "text-foreground" : "text-muted-foreground italic"}`}
                  >
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="pt-2 space-y-2">
              <h3 className="text-sm font-medium text-foreground">What their site does</h3>
              {current.capabilities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing has crawled this business, so nothing is known about their site. Ask.
                </p>
              ) : (
                <ul className="space-y-2">
                  {current.capabilities.map((c) => (
                    <li key={c.code} className="space-y-1">
                      <Pill tone={c.tone}>{c.text}</Pill>
                      {c.detail ? (
                        <p className="text-xs text-muted-foreground break-words">{c.detail}</p>
                      ) : null}
                      {c.known && !c.sayable ? (
                        <p className="text-xs text-muted-foreground">
                          Not verified — say it as an impression, not as a fact.
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-2 space-y-1">
              <h3 className="text-sm font-medium text-foreground">Software they run</h3>
              <p className="text-sm text-foreground break-words">{current.competitor.text}</p>
            </div>
          </section>

          {/* ── Layer 2: inferences ────────────────────────────────────── */}
          <section className={CARD}>
            <LayerHeader layer="inference" />
            {current.inferences.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing has been inferred about this business. Do not fill the gap on the call.
              </p>
            ) : (
              <ul className="space-y-3">
                {current.inferences.map((inf, i) => (
                  <li key={`${inf.kind}-${i}`}>
                    {inf.renderable ? (
                      <>
                        <p className="text-sm text-foreground break-words">
                          We think: <strong>{inf.text}</strong> ({inf.kindText})
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {inf.confidenceText}. {inf.sourceText} This is not a fact — do not say it as one.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                        <ShieldAlert size={14} className="inline mr-1" />
                        {inf.refusal}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Layer 3: recommendations ───────────────────────────────── */}
          <section className={CARD}>
            <LayerHeader layer="recommendation" />
            {current.opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing is recommended for this prospect. A pitch needs an observation to cite, and there is
                none — open with a question instead.
              </p>
            ) : (
              <ol className="space-y-3">
                {current.opportunities.map((o, i) => (
                  <li key={`${o.capabilityCode}-${i}`} className="space-y-1">
                    {o.renderable ? (
                      <>
                        <p className="text-sm text-foreground break-words">
                          <strong>{i + 1}. {o.name}</strong>
                        </p>
                        <p className="text-sm text-foreground break-words">Because: {o.reason}</p>
                        <p className="text-xs text-muted-foreground break-words">
                          {o.confidenceText} · cites {o.evidenceIds.length} observation
                          {o.evidenceIds.length === 1 ? "" : "s"}
                          {o.ruleCode ? ` · rule ${o.ruleCode}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                        <ShieldAlert size={14} className="inline mr-1" />
                        {o.refusal}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* ── What we do not know ────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">
              <CircleHelp size={16} className="inline mr-1" />
              What we do not know
            </h2>
            <p className="text-xs text-muted-foreground">
              Said out loud here so it is not guessed at on the call.
            </p>
            {current.unknowns.length === 0 ? (
              <p className="text-sm text-foreground">Nothing outstanding on this record.</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {current.unknowns.map((u, i) => (
                  <li key={`${u}-${i}`} className="text-sm text-muted-foreground break-words">
                    {u}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── What happens next ──────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground">When you are done</h2>
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground w-full`}
              disabled={Boolean(busy)}
              onClick={() => act("worked", { prospectId: current.id })}
            >
              {busy === "worked" ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              I spoke to them — keep this one
            </button>
            <p className="text-xs text-muted-foreground">
              It stops lapsing and stays yours. A real conversation is not a lease.
            </p>

            <button
              type="button"
              className={`${BTN} border border-border text-foreground w-full`}
              disabled={Boolean(busy)}
              onClick={() => act("release", { prospectId: current.id })}
            >
              {busy === "release" ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
              Put it back in the pool
            </button>

            {dncOpen ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground" htmlFor="q-dnc">
                  Why should nobody contact them again?
                </label>
                <input
                  id="q-dnc"
                  className={FIELD}
                  value={dncReason}
                  onChange={(e) => setDncReason(e.target.value)}
                  placeholder="They asked to be taken off the list"
                />
                <button
                  type="button"
                  className={`${BTN} bg-red-600 text-white w-full`}
                  disabled={Boolean(busy) || !dncReason.trim()}
                  onClick={() => act("do_not_contact", { prospectId: current.id, reason: dncReason })}
                >
                  {busy === "do_not_contact" ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />}
                  Record do-not-contact
                </button>
                <p className="text-xs text-muted-foreground">
                  Permanent, and it survives every pipeline stage. Only a superadmin can lift it.
                </p>
              </div>
            ) : (
              <button
                type="button"
                className={`${BTN} border border-red-300 text-red-700 dark:text-red-300 w-full`}
                disabled={Boolean(busy)}
                onClick={() => setDncOpen(true)}
              >
                <Ban size={16} /> They asked not to be contacted
              </button>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
