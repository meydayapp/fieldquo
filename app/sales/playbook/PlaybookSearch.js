// app/sales/playbook/PlaybookSearch.js
//
// "What did they just say?" — the only part of the playbook screen that has to
// be interactive, and the reason is that a rep opens this page mid-call.
//
// ══ Why it filters instead of searching ═══════════════════════════════════
//
// It runs the SAME two matchers the rest of the system runs — matchObjectionText
// and matchBattlecard — rather than a fuzzy text search over the responses. A
// near-match here is not a slightly worse result: the rep reads the answer out
// loud to a customer, and an answer to a question nobody asked is worse than
// scrolling. objections.js makes exactly this argument for why its cues are
// lower-cased substrings with no stemming, and this screen must not be looser
// than the console that dials.
//
// ══ No network ═══════════════════════════════════════════════════════════
//
// The rows arrive as props from the server component. Both matchers are pure
// functions over data already on the page, so a rep in a basement with one bar
// of signal gets the same answer as one at a desk — which is the whole point
// of putting it in front of somebody who is on a call.
"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { matchBattlecard } from "@/lib/sales/playbook/battlecards";
import { matchObjectionText } from "@/lib/sales/playbook/objections";
import { useTranslation } from "@/app/hooks/useTranslation";

const CARD = "rounded-xl border border-border bg-card";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground";

export default function PlaybookSearch({ objections = [], cards = [] }) {
  const { t } = useTranslation();
  const [heard, setHeard] = useState("");

  const { hits, named } = useMemo(() => {
    const text = heard.trim();
    if (!text) return { hits: [], named: [] };
    const ids = new Set(matchBattlecard(text));
    return {
      hits: matchObjectionText(text, objections),
      named: cards.filter((c) => ids.has(c.competitorId)),
    };
  }, [heard, objections, cards]);

  const typed = heard.trim().length > 0;

  return (
    <section className={`${CARD} p-4 space-y-3`}>
      <label htmlFor="heard" className="block text-sm font-semibold text-foreground">
        {t("app.salesPlay.heardLabel")}
      </label>
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="heard"
          value={heard}
          onChange={(e) => setHeard(e.target.value)}
          // The one English string on this screen that must stay English.
          // matchObjectionText and matchBattlecard compare against lower-cased
          // ENGLISH substring cues with no stemming (lib/sales/playbook/
          // objections.js argues why), so a translated example would invite a
          // rep to type French and match nothing — an example demonstrating an
          // input that cannot work. The label above and the hint below ARE
          // translated, which is what makes this read as the contractor's own
          // words rather than as a string somebody missed.
          // scripts/check-sales-portal-i18n.mjs exempts it by name.
          placeholder="we already use jobber"
          className={`${FIELD} pl-9`}
          autoComplete="off"
        />
      </div>

      {/* Nothing typed is not the same as nothing found, and the screen says
          which. An empty result under an empty box would read as "we have no
          answer to that", which is a lie about a library of twenty. */}
      {!typed ? (
        <p className="text-xs text-muted-foreground">{t("app.salesPlay.heardHint")}</p>
      ) : null}

      {typed && !hits.length && !named.length ? (
        <p className="text-sm text-muted-foreground">{t("app.salesPlay.heardNoMatch")}</p>
      ) : null}

      {named.map((c) => (
        <div key={c.competitorId} className="border-t border-border pt-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text">
            {c.name}
          </p>
          <ol className="mt-2 space-y-2">
            {c.saidOutLoud.map((l, i) => (
              <li key={i} className="text-sm text-foreground break-words">
                {l.text}
              </li>
            ))}
          </ol>
        </div>
      ))}

      {hits.map((o) => (
        <div key={o.code} className="border-t border-border pt-3">
          <p className="text-sm font-semibold text-foreground break-words">{o.label}</p>
          <p className="text-sm text-foreground mt-1 break-words">{o.response}</p>
        </div>
      ))}
    </section>
  );
}
