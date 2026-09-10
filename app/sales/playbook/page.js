// app/sales/playbook/page.js
//
// The playbook a rep reads BEFORE the call, and the battlecards they reach for
// during it.
//
// ══ Why this exists beside CallPlaybook ═══════════════════════════════════
//
// app/components/sales/CallPlaybook.js puts one stage at a time in front of a
// rep with a prospect on the line, and it is right to: nine stages at once is
// a wall nobody reads at speed. But it only exists inside a claimed prospect's
// card, which means the objection library, the four scripts and everything we
// know about the five competitors were reachable ONLY while dialling somebody.
// A new rep on their first morning, or the same rep the night before a
// meeting, had nowhere to read any of it.
//
// So this is the reading surface and that one is the working surface. Nothing
// is duplicated: both render the same rows out of lib/sales/playbook.
//
// ══ A server component, and deliberately no API route ═════════════════════
//
// Everything here is a read of rows this process can already reach, and
// middleware.js has already refused anybody without a `sales-token` before
// this file runs. An /api/sales/playbook/library route would be a second door
// onto the same data with a second gate to keep in step, and — the failure
// docs/sales/OPEN-WORK.md keeps recording — one more route whose only caller
// is one screen. The one client-side island below (the "what did they just
// say" filter) takes the rows as props rather than fetching them.
//
// ══ Database first, seeds second, and it says which ═══════════════════════
//
// loadPlaybooks/loadObjections read the SalesPlaybook and SalesObjection
// tables and fall back to the built-in library when the models are not
// deployed. A rep must not read one script here and hear a different one come
// out of the call console, so this screen renders exactly what that one does —
// including an empty table, which stays empty. store.js's own comment argues
// it: somebody who deleted every playbook meant to.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";

import { battlecards } from "@/lib/sales/playbook/battlecards";
import { playbookMoments } from "@/lib/sales/playbook/moments";
import { loadObjections, loadPlaybooks } from "@/lib/sales/playbook/store";
import { STAGES, orderStages } from "@/lib/sales/playbook/stages";

import PlaybookSearch from "./PlaybookSearch";

const CARD = "rounded-xl border border-border bg-card";

/** A stage row as the rep reads it. Nothing is padded — see stages.js. */
function Stage({ stage, row }) {
  const say = (row?.say || "").trim();
  const prompts = Array.isArray(row?.prompts) ? row.prompts.filter(Boolean) : [];
  return (
    <div className="border-t border-border pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text">
        {stage.name}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{stage.purpose}</p>
      {say ? (
        <p className="text-sm text-foreground mt-2 whitespace-pre-line break-words">{say}</p>
      ) : null}
      {prompts.length ? (
        <ul className="mt-2 space-y-1.5">
          {prompts.map((q, i) => (
            <li key={i} className="text-sm text-foreground break-words pl-4 -indent-4">
              — {q}
            </li>
          ))}
        </ul>
      ) : null}
      {/* An unwritten stage says so. A blank that reads as "nothing to say
          here" is the padding failure AGENTS.md names, on a script somebody
          reads out loud. */}
      {!say && !prompts.length ? (
        <p className="text-sm text-muted-foreground mt-2 italic">
          {stage.usesObjections
            ? "Rendered from the objection library below, per prospect — never written into a script."
            : "Nothing written for this stage yet."}
        </p>
      ) : null}
    </div>
  );
}

export default async function SalesPlaybookPage() {
  const [playbooks, objections] = await Promise.all([loadPlaybooks(), loadObjections()]);
  // Pinned to the render, not read twice: a figure goes stale at ninety days
  // and two clocks inside one page could disagree about whether it publishes.
  const asOf = new Date();
  const cards = battlecards({ asOf });
  const MOMENTS = playbookMoments();

  return (
    <div className="py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Playbook</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          The call, the twenty objections, and what to say when a contractor names a competitor.
          Everything here is what the call console reads too — if you find a sentence that is
          wrong, it is wrong on the calls as well, so say so rather than working around it.
        </p>
      </header>

      {/* The mid-call surface first. A rep who opens this page while somebody
          is talking wants one thing: the answer to what they just heard. */}
      <PlaybookSearch objections={objections} cards={cards} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">The call</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Four scripts, one spine. Which one opens is decided by what the crawl found about that
          business — a prospect nothing has been observed about gets no script at all, on purpose.
          The opener is the same in all four; the question under it is not, and that question is
          the one the rest of the call hangs off.
        </p>
        {playbooks.length === 0 ? (
          <div className={`${CARD} p-4 flex items-start gap-3`}>
            <AlertTriangle size={16} className="text-brand-accent-text shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              No playbook is installed. Nothing has been deleted here by accident — an empty
              library stays empty until a superadmin installs the starter set from the platform
              console.
            </p>
          </div>
        ) : null}
        {playbooks.map((p) => {
          const { ordered } = orderStages(p.stages || []);
          const byKey = new Map(ordered.map((s) => [s.stageKey, s]));
          return (
            <details key={p.key} className={CARD}>
              <summary className="cursor-pointer list-none px-4 py-3 min-h-[44px] flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {p.source === "db" ? "saved" : "built-in"}
                </span>
              </summary>
              <div className="px-4 pb-4">
                {STAGES.map((stage) => (
                  <Stage key={stage.key} stage={stage} row={byKey.get(stage.key)} />
                ))}
              </div>
            </details>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Either side of the call</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          The receptionist, the beep, the two follow-ups, the fifteen minutes and the ask. None of
          these is a stage of the call — they happen before it, instead of it, or after it in
          another channel — which is why they are here rather than in the scripts above.
        </p>
        {MOMENTS.map((m) => (
          <details key={m.key} className={CARD}>
            <summary className="cursor-pointer list-none px-4 py-3 min-h-[44px] flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{m.name}</span>
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{m.when}</span>
            </summary>
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground sm:hidden">{m.when}</p>
              {m.lines.map((l) => (
                <div key={l.label}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text">
                    {l.label}
                  </p>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-line break-words">
                    {l.text}
                  </p>
                </div>
              ))}
              <ul className="space-y-1 border-t border-border pt-3">
                {m.notes.map((n, i) => (
                  <li key={i} className="text-xs text-muted-foreground break-words pl-4 -indent-4">
                    — {n}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Battlecards — the five they will name
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Every line below is assembled from the same rows the public comparison pages render, so
          a contractor who reads the page and a contractor who talks to you get the same facts.
          What that also means: nothing here can be improved by rewording it. If a figure is
          wrong, it is wrong on fieldquo.com too.
        </p>
        {cards.map((c) => (
          <details key={c.competitorId} className={CARD}>
            <summary className="cursor-pointer list-none px-4 py-3 min-h-[44px] flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {c.price.unitLabel || "pricing unit not established"}
              </span>
            </summary>
            <div className="px-4 pb-4 space-y-4">
              <Battlecard card={c} />
            </div>
          </details>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Objections — all {objections.length}
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Each one is restate, then welcome it, then answer, then one small thing they can
          actually do. None of them ends the sequence — eighty-one per cent of sales happen on or
          after the fifth call, so a sentence a single word can end throws four of them away. The
          one exception is “not interested”, where the offer to stop calling is a real switch.
        </p>
        {objections.length === 0 ? (
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-foreground">
              The objection library is empty. It is not hidden and it has not failed to load —
              there is nothing saved.
            </p>
          </div>
        ) : null}
        {objections.map((o) => (
          <details key={o.code} className={CARD}>
            <summary className="cursor-pointer list-none px-4 py-3 min-h-[44px]">
              <span className="text-sm font-semibold text-foreground break-words">{o.label}</span>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              <p className="text-sm text-foreground break-words">{o.response}</p>
              {Array.isArray(o.cues) && o.cues.length ? (
                <p className="text-xs text-muted-foreground break-words">
                  You will hear it as: {o.cues.join(", ")}
                </p>
              ) : null}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

/** One battlecard, rendered. Every field comes from lib/sales/playbook/battlecards.js. */
function Battlecard({ card }) {
  return (
    <>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text">
          Say this when they name them
        </h3>
        <ol className="mt-2 space-y-2">
          {card.saidOutLoud.map((l, i) => (
            <li key={i} className="text-sm text-foreground break-words">
              {l.text}
              <span className="block text-xs text-muted-foreground mt-0.5">{l.from}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          What they genuinely do well
        </h3>
        {card.theyDoWell.length ? (
          <ul className="mt-2 space-y-1.5">
            {card.theyDoWell.map((t) => (
              <li key={t.capability} className="text-sm text-foreground break-words">
                {t.label || t.claim}
                <span className="block text-xs text-muted-foreground">
                  “{t.claim}” — {t.provenance}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            Nothing about {card.name} has been read off their own page and verified, so there is
            nothing here to repeat on a call. That is a gap in our research, not a gap in their
            product — do not read it as one out loud.
          </p>
        )}
        {card.theyDoWellWithheld ? (
          <p className="text-xs text-muted-foreground mt-2">
            {card.theyDoWellWithheld.count} further claim
            {card.theyDoWellWithheld.count === 1 ? " is" : "s are"} recorded and held back.{" "}
            {card.theyDoWellWithheld.reason}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          What we do not have, whoever you compare us with
        </h3>
        <ul className="mt-2 space-y-1">
          {card.ourOwnLimits.map((l) => (
            <li key={l.capability} className="text-sm text-foreground break-words">
              {l.label}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Where we win
        </h3>
        {card.weWin.length ? (
          <ul className="mt-2 space-y-1.5">
            {card.weWin.map((w) => (
              <li key={w.capability} className="text-sm text-foreground break-words">
                {w.claim}
                <span className="block text-xs text-muted-foreground">{w.provenance}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            No claim about what {card.name} cannot do has their own page behind it, so none may be
            made. Argue from our list instead, below.
          </p>
        )}
        {card.neverListedTotal ? (
          <p className="text-sm text-foreground mt-2 break-words">
            {card.neverListedTotal} things we ship are not listed on any tier of their pricing
            page — including {card.neverListed.map((e) => e.name).join(", ")}.
            {card.parityTier
              ? ` The tier of theirs that carries most of what we carry is ${card.parityTier.label}.`
              : ""}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          The price
        </h3>
        <p className="text-sm text-foreground mt-2 break-words">
          {card.price.countsWhom ? `They count: ${card.price.countsWhom} ` : ""}
          Ours starts at ${card.price.entryTier.price} for {card.price.entryTier.seats} seat and{" "}
          {card.price.entryTier.crewSeats} crew.
        </p>
        {card.price.caveat ? (
          <p className="text-xs text-muted-foreground mt-1 break-words">{card.price.caveat}</p>
        ) : null}
        {card.price.figures.length ? (
          <ul className="mt-2 space-y-1">
            {card.price.figures.map((f) => (
              <li key={f.id} className="text-sm text-foreground break-words">
                {f.label}: {f.currency} {f.amount} /{f.per}
                {f.seatsIncluded ? `, ${f.seatsIncluded} included` : ""}
                <span className="block text-xs text-muted-foreground">
                  read {f.checked}
                  {f.axis ? ` — ${Object.entries(f.axis).map(([k, v]) => `${k}: ${v}`).join(", ")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            They publish no price we can quote.
          </p>
        )}
        {card.price.reported.length ? (
          <div className="mt-2">
            <p className="text-xs font-semibold text-foreground">
              Third-hand, and it must be said as third-hand:
            </p>
            <ul className="mt-1 space-y-1">
              {card.price.reported.map((r) => (
                <li key={r.id} className="text-xs text-muted-foreground break-words">
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {card.comparePath ? (
        <p className="text-sm">
          <Link
            href={card.comparePath}
            className="inline-flex items-center gap-1.5 min-h-[44px] text-brand-accent-text font-medium"
          >
            The page a contractor reads <ExternalLink size={14} />
          </Link>
        </p>
      ) : null}
    </>
  );
}
