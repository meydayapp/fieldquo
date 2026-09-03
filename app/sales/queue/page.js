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
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Loader2,
  Phone,
  Plus,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { LAYER_HEADINGS } from "@/lib/sales/prospectView";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (tradeKey) params.set("tradeKey", tradeKey);
      if (prospectId) params.set("prospectId", prospectId);
      setData(await fetchJson(`/api/sales/queue?${params.toString()}`));
    } catch (err) {
      setError(err?.message || "Could not load your queue.");
    } finally {
      setLoading(false);
    }
  }, [tradeKey, prospectId]);

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

            {current.contact.callable ? (
              <a
                href={`tel:${current.phoneE164}`}
                className={`${BTN} bg-primary text-primary-foreground w-full`}
              >
                <Phone size={16} /> Call {current.phoneE164}
              </a>
            ) : (
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
