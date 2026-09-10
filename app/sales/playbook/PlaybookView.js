// app/sales/playbook/PlaybookView.js
//
// Everything the playbook screen DRAWS. page.js still does the reading.
//
// ══ Why the presentation is a separate file ═══════════════════════════════
//
// page.js is a server component and stays one — it reads SalesPlaybook and
// SalesObjection through this process, and its own header argues why an API
// route for the same rows would be a second door with a second gate. But
// useTranslation() is a client hook: a server component cannot resolve the
// rep's language, and half a portal in the rep's language beside half in
// English is the inconsistency the owner asked to end. So the rows still load
// on the server, in the same order, and arrive here as props. Only the chrome
// moved.
//
// ══ What is deliberately NOT translated ═══════════════════════════════════
//
// Every script line, stage name, objection, rebuttal, moment and battlecard
// sentence is DATA — a SalesPlaybook/SalesObjection row, or the seed library in
// lib/sales/playbook. The call console renders the same rows, and a rep must
// not read one sentence here and hear a different one come out of the dialler,
// so translating them here would put this screen and that one out of step. The
// headings, labels, empty states and notices around them are this screen's own
// words and are keyed.
"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { STAGES, orderStages } from "@/lib/sales/playbook/stages";

import PlaybookSearch from "./PlaybookSearch";

const CARD = "rounded-xl border border-border bg-card";

/** A stage row as the rep reads it. Nothing is padded — see stages.js. */
function Stage({ stage, row }) {
  const { t } = useTranslation();
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
            ? t("app.salesPlay.stageFromObjectionLibrary")
            : t("app.salesPlay.stageUnwritten")}
        </p>
      ) : null}
    </div>
  );
}

export default function PlaybookView({
  playbooks = [],
  objections = [],
  cards = [],
  moments = [],
}) {
  const { t } = useTranslation();

  return (
    <div className="py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("app.salesPlay.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("app.salesPlay.intro")}
        </p>
      </header>

      {/* The mid-call surface first. A rep who opens this page while somebody
          is talking wants one thing: the answer to what they just heard. */}
      <PlaybookSearch objections={objections} cards={cards} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t("app.salesPlay.callHeading")}</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("app.salesPlay.callIntro")}</p>
        {playbooks.length === 0 ? (
          <div className={`${CARD} p-4 flex items-start gap-3`}>
            <AlertTriangle size={16} className="text-brand-accent-text shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">{t("app.salesPlay.noPlaybookInstalled")}</p>
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
                  {p.source === "db"
                    ? t("app.salesPlay.sourceSaved")
                    : t("app.salesPlay.sourceBuiltIn")}
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
        <h2 className="text-lg font-semibold text-foreground">
          {t("app.salesPlay.momentsHeading")}
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("app.salesPlay.momentsIntro")}</p>
        {moments.map((m) => (
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
          {t("app.salesPlay.battlecardsHeading")}
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t("app.salesPlay.battlecardsIntro")}
        </p>
        {cards.map((c) => (
          <details key={c.competitorId} className={CARD}>
            <summary className="cursor-pointer list-none px-4 py-3 min-h-[44px] flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {c.price.unitLabel || t("app.salesPlay.priceUnitUnknown")}
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
          {t("app.salesPlay.objectionsHeading", { count: objections.length })}
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t("app.salesPlay.objectionsIntro")}
        </p>
        {objections.length === 0 ? (
          <div className={`${CARD} p-4`}>
            <p className="text-sm text-foreground">{t("app.salesPlay.objectionsEmpty")}</p>
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
                  {t("app.salesPlay.objectionCues", { cues: o.cues.join(", ") })}
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
  const { t } = useTranslation();
  return (
    <>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text">
          {t("app.salesPlay.cardSayThis")}
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
          {t("app.salesPlay.cardTheyDoWell")}
        </h3>
        {card.theyDoWell.length ? (
          <ul className="mt-2 space-y-1.5">
            {/* `strength`, not `t` — the file calls t() for translation and a
                shadow here is the exact bug check:t-shadow exists for. */}
            {card.theyDoWell.map((strength) => (
              <li key={strength.capability} className="text-sm text-foreground break-words">
                {strength.label || strength.claim}
                <span className="block text-xs text-muted-foreground">
                  “{strength.claim}” — {strength.provenance}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            {t("app.salesPlay.cardNothingVerified", { name: card.name })}
          </p>
        )}
        {card.theyDoWellWithheld ? (
          <p className="text-xs text-muted-foreground mt-2">
            {t("app.salesPlay.cardWithheldClaims", { value: card.theyDoWellWithheld.count })}{" "}
            {card.theyDoWellWithheld.reason}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("app.salesPlay.cardOurLimits")}
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
          {t("app.salesPlay.cardWhereWeWin")}
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
            {t("app.salesPlay.cardNoWinProven", { name: card.name })}
          </p>
        )}
        {card.neverListedTotal ? (
          <p className="text-sm text-foreground mt-2 break-words">
            {t("app.salesPlay.cardUnlistedLine", {
              items: t("app.salesPlay.cardUnlistedCount", { value: card.neverListedTotal }),
              examples: card.neverListed.map((e) => e.name).join(", "),
            })}
            {card.parityTier
              ? ` ${t("app.salesPlay.cardParityTier", { tier: card.parityTier.label })}`
              : ""}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("app.salesPlay.cardPriceHeading")}
        </h3>
        <p className="text-sm text-foreground mt-2 break-words">
          {card.price.countsWhom
            ? `${t("app.salesPlay.cardTheyCount", { countsWhom: card.price.countsWhom })} `
            : ""}
          {t("app.salesPlay.cardOursStartsAt", {
            price: card.price.entryTier.price,
            seats: card.price.entryTier.seats,
            crew: card.price.entryTier.crewSeats,
          })}
        </p>
        {card.price.caveat ? (
          <p className="text-xs text-muted-foreground mt-1 break-words">{card.price.caveat}</p>
        ) : null}
        {card.price.figures.length ? (
          <ul className="mt-2 space-y-1">
            {card.price.figures.map((f) => (
              <li key={f.id} className="text-sm text-foreground break-words">
                {f.label}: {f.currency} {f.amount} /{f.per}
                {f.seatsIncluded
                  ? `, ${t("app.salesPlay.cardSeatsIncluded", { count: f.seatsIncluded })}`
                  : ""}
                <span className="block text-xs text-muted-foreground">
                  {t("app.salesPlay.cardFigureRead", { date: f.checked })}
                  {f.axis ? ` — ${Object.entries(f.axis).map(([k, v]) => `${k}: ${v}`).join(", ")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">
            {t("app.salesPlay.cardNoPublishedPrice")}
          </p>
        )}
        {card.price.reported.length ? (
          <div className="mt-2">
            <p className="text-xs font-semibold text-foreground">
              {t("app.salesPlay.cardThirdHand")}
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
            {t("app.salesPlay.cardComparePage")} <ExternalLink size={14} />
          </Link>
        </p>
      ) : null}
    </>
  );
}
