// app/components/sales/DialRegion.js
//
// The one place on a rep's screen where the phone is, whichever screen it is.
//
// ══ Why this is shared and not two copies ═════════════════════════════════
//
// The queue grew this region first: seven states out of lib/sales/dialSpace.js,
// each with its own tone, plus the blockers, the unenforced caveats, the
// warnings and the statute. Then the owner opened /sales/leads and there was
// no dial at all — the leads he had actually typed in were the ones he could
// not ring. The obvious fix was to paste the queue's JSX onto the lead screen,
// and that is AGENTS.md failure class #4: the copy is the one that rots,
// because it is the one nobody looks at. When a jurisdiction's citation
// changes shape, or a new dialSpace state lands, a pasted second copy keeps
// rendering last year's answer beside a live Call button.
//
// So the whole region is here, both screens call it, and there is exactly one
// renderer for "may this call happen, and if not, why not".
//
// ══ It decides nothing ════════════════════════════════════════════════════
//
// dialSpace() already made the decision and re-gated the href against it; this
// file only chooses an icon. That split is deliberate and is why the decision
// is testable without a browser: scripts/check-sales-console.mjs forges an
// href against a refused decision and reads dialSpace's answer, which it could
// not do if the branch lived in JSX.
//
// ══ Never blank ═══════════════════════════════════════════════════════════
//
// Every state renders something. The owner's original complaint about the
// queue — "I don't even know where to go to dial" — was an empty region on an
// empty queue, and absence of UI is indistinguishable from absence of feature.
// That rule now travels with the component instead of being a note in one page.
"use client";

import { Ban, CircleHelp, Clock, PhoneOff, ShieldAlert } from "lucide-react";
import { CALL_ALLOWED, CALL_REFUSED } from "@/lib/sales/callingRules";
import {
  DIAL_DO_NOT_CONTACT,
  DIAL_NO_NUMBER,
  DIAL_NO_PROSPECT,
  DIAL_READY,
  DIAL_REFUSED,
} from "@/lib/sales/dialSpace";
import { useTranslation } from "@/app/hooks/useTranslation";
import { weekdayName } from "@/lib/format/localeDate";
import CallPanel from "./CallPanel";
import CallConsolePreview from "./CallConsolePreview";

// ══ Resolving what the server composed ═════════════════════════════════════
//
// Every sentence in this region is decided elsewhere — lib/sales/dialSpace.js
// and lib/sales/callingRules.js — because a decision written in JSX is a
// decision a check script has to argue with a regex about. That has not
// changed. What changed is that those modules now name the CATALOGUE KEY each
// sentence was written from, alongside the English, so a rep reading the
// portal in Spanish reads Spanish here too instead of a Spanish frame around
// English refusal copy.
//
// This helper is the whole mechanism: prefer the key, fall back to the words.
// The fallback is not decoration — a payload from a build that predates a key
// still has to say something, and an English sentence is a far smaller failure
// than a blank space where the reason a call cannot happen used to be.
const say = (t, key, params, fallback) => {
  if (!key) return fallback;
  const values = params || {};
  // ── The one convention worth having ────────────────────────────────────
  //
  // A branch whose sentence contains a COUNT names the counted noun's own key
  // in `countKey` and the number in `countValue`, and this resolves the pair
  // before interpolating it as {count}. That keeps the number and its noun
  // declined together by the catalogue — countedNoun, through
  // Intl.PluralRules — while the lib module that decided the branch never has
  // to name a noun in any language, including English.
  //
  // Written here rather than at the one call site that needs it today,
  // because the next branch with a count in it will otherwise reach for a
  // ternary, and that ternary is what put a bare Latin "s" on a Mandarin
  // screen the last time.
  if (values.countKey) {
    return t(key, { ...values, count: t(values.countKey, { value: values.countValue }) });
  }
  return t(key, values);
};

/**
 * The suppression sentence's values, with a date that is always sayable.
 *
 * A row with no requestedAt cannot be written by suppress() — it always sets
 * one — but the column is nullable, so a hand-made row can reach here. The
 * placeholder gets a translated "date not recorded" rather than the word
 * "null" or, worse, an invented day on a compliance notice.
 */
function suppressionValues(t, params) {
  const p = params || {};
  return { ...p, date: p.date || t("app.salesSuppression.dateNotRecorded") };
}

/** The three tones the sales surfaces already paint. Has / gap / unknown. */
const TONE_CLASS = {
  has: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
  gap: "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800",
  unknown: "bg-muted text-muted-foreground border-border border-dashed",
};

/**
 * One reason a call cannot go ahead, or one caveat on a call that can.
 *
 * Exported because the queue prints caveats of its own alongside these and a
 * second box shape beside this one would read as a different kind of statement.
 */
export function Notice({ tone, icon: Icon, title, fix, legalText = false }) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-lg border p-3 text-sm ${TONE_CLASS[tone] || TONE_CLASS.unknown}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold break-words">{title}</p>
          {fix ? <p className="break-words">{fix}</p> : null}
          {/* ── Why one body here stays English in every language ──────────
              `legalText` marks a body that came out of the jurisdiction TABLE
              rather than out of our own prose: a statute number and the words
              the statute itself uses. Arizona's flat prohibition, Texas's
              registration and bond, a state's rule on how a prospect's details
              may be obtained. Machine-translating a quoted primary source
              would hand a rep a sentence that reads as the law and is not it,
              on the one question — "is this call lawful?" — where being nearly
              right is worthless. So it is quoted as written and LABELLED as
              quoted, which is the honest version of the same fact. The heading
              above it is ours and is translated. */}
          {legalText && fix ? (
            <p className="mt-1 text-xs opacity-80 break-words">{t("app.salesDial.quotedInEnglish")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The calling window, as sentences rather than as one sentence with slots.
 *
 * ── Why three lines and not one string ────────────────────────────────────
 *
 * The English this replaces read "Washington's rule: 08:00–20:00 every day, in
 * the prospect's own time zone. It opens at 08:00 on Tue 8 Sep." Three
 * separate claims that English joins with a colon. Translating the join is
 * what produces a Spanish stem wrapped around an English clause — the exact
 * defect this session was sent to remove. Each line below is a whole sentence
 * that stands up alone in every language, so the catalogue never owns a seam.
 *
 * The day names and the opening instant are NOT keys. They come from CLDR —
 * weekdayName() here, Intl inside describeLocal() — for the reason
 * /app/scheduler's translation recorded: Intl already ships those tables for
 * languages this catalogue has never been translated into, and it gets the
 * ORDER right, which seven keys per language would not.
 */
function WindowLines({ compliance }) {
  const { t, language } = useTranslation();
  if (!compliance?.windowKey) return null;

  const p = compliance.windowParams || {};
  const closed = Array.isArray(p.closedWeekdays) ? p.closedWeekdays : [];

  return (
    <>
      {compliance.jurisdiction?.name ? (
        <p className="break-words">
          {/* Two whole sentences, one per branch. "Washington's rule applies"
              and "FieldQuo's own rule applies — Washington imposes none" are
              different claims about who is imposing the hours, not one
              sentence with a swapped possessive. */}
          {t(
            compliance.statutoryWindow
              ? "app.salesDial.window.statutoryRule"
              : "app.salesDial.window.courtesyRule",
            { jurisdiction: compliance.jurisdiction.name },
          )}
        </p>
      ) : null}
      <p className="break-words">
        {t(compliance.windowKey, {
          ...p,
          closedDays: closed.map((d) => weekdayName(d, language)).join(", "),
        })}
      </p>
      {/* nextOpening() answers "now" while the window is open, so printing
          "It opens at 19:30" beside a live call button read as a closed
          window to the owner. Open is said as open. */}
      {compliance.decision === "allowed" ? (
        <p className="break-words">{t("app.salesDial.window.openNow")}</p>
      ) : compliance.opensAtText ? (
        <p className="break-words">
          {t("app.salesDial.window.opensAt", { opensAt: compliance.opensAtText })}
        </p>
      ) : null}
    </>
  );
}

/**
 * The dial, or the reason there is not one.
 *
 * @param space      what lib/sales/dialSpace.js returned. Required — there is
 *                   no "no space" branch, because the whole point is that this
 *                   region is never empty.
 * @param compliance the decision the screen recomputed on its own timer. Used
 *                   only for the caveats and the statute; the dial itself is
 *                   already decided inside `space`.
 * @param target     `{ prospectId }` or `{ leadId }`, plus the number, the
 *                   name, and `contactNumberId` when the rep has picked a
 *                   number other than the one on the listing. Passed through
 *                   to CallPanel untouched — this file decides nothing about
 *                   which number, the same way it decides nothing about
 *                   whether the call may happen.
 * @param onWorked   called after a disposition is written, so the screen that
 *                   owns the record can reload it.
 */
export default function DialRegion({
  space,
  compliance = null,
  target = null,
  // The prospect whose script to show when the TARGET is a lead — a lead
  // linked to a discovered business dials by leadId (so the attempt lands on
  // the lead) but reads the business's playbook. Null keeps today's answer.
  playbookProspectId = null,
  onWorked,
  // The autodialler's press and its answer, handed straight through to
  // CallPanel. This file still decides nothing — see the header — and the
  // queue is the only screen that passes them.
  autoDial = null,
  onAutoDialResult = null,
  // The console's slot nodes for the disposition form, the next steps and
  // the script — handed straight through to CallPanel, which portals those
  // three pieces into them. Null on the lead screen, where they render
  // inline as before. This file still decides nothing.
  slots = null,
  // The console's Dialer card: the calling-rule prose (whose rule, the
  // hours, the zone it was judged in, the citation) folds behind one
  // disclosure instead of standing as paragraphs under the Call button —
  // the owner's "the Dialer card is three times the height of the other
  // two". The DECISION is unchanged and the sentences are the same
  // sentences; only where they sit. False on the lead screen.
  compact = false,
  // Passed straight through to CallPanel — see its header for both. This
  // file decides nothing about a typed number either.
  beforeDial = null,
  onLiveCall = null,
  dialRequest = null,
}) {
  const { t } = useTranslation();

  // The window, the zone and the statute, as one block — drawn inline or
  // folded, never twice.
  const judged =
    compliance?.decision === CALL_ALLOWED && compliance.windowText ? (
      <p className="text-xs text-muted-foreground break-words">
        {/* One key per branch rather than a shared "Judged in …" stem with a
            fragment slotted in: the two halves take different cases and
            different word order in half the portal's languages, and a stem
            that only reads correctly in English is the sentence-splitting
            bug wearing a placeholder. */}
        {compliance.zoneSource === "stated"
          ? t("app.salesDial.judgedInStatedZone")
          : t("app.salesDial.judgedInImpliedZone", { zones: compliance.zones.join(", ") })}
      </p>
    ) : null;
  // ── The citation, shown rather than stored ──────────────────────────
  // `citation` was carried on every row and reached a human only through
  // the "nobody has read this" blocker — so the verified half of the
  // table, which is the half that lets a call happen, cited its statute
  // to nobody. That is AGENTS.md failure class #1 with the safe-looking
  // sign: written and never read. Same rule as `legalText` on a Notice:
  // the statute in its own words, labelled as quoted rather than
  // machine-translated into a paraphrase that would carry the authority
  // of a citation without being one.
  const citation =
    compliance?.jurisdiction?.verified && compliance.citation ? (
      <>
        <p className="mt-1 break-words">{compliance.citation}</p>
        <p className="mt-1 opacity-80">{t("app.salesDial.quotedInEnglish")}</p>
      </>
    ) : null;
  const rulesSummary = compliance?.jurisdiction?.name
    ? t("app.salesDial.whatJurisdictionSays", { jurisdiction: compliance.jurisdiction.name })
    : t("app.salesDial.callingRules");

  return (
    <>
      {space.state === DIAL_READY && space.href && target ? (
        <>
          <CallPanel
            prospectId={target.prospectId || null}
            playbookProspectId={playbookProspectId}
            leadId={target.leadId || null}
            phoneE164={target.phoneE164}
            contactNumberId={target.contactNumberId || null}
            businessName={target.businessName}
            fallbackHref={space.href}
            onWorked={onWorked}
            autoDial={autoDial}
            onAutoDialResult={onAutoDialResult}
            slots={slots}
            beforeDial={beforeDial}
            onLiveCall={onLiveCall}
            dialRequest={dialRequest}
          />
          {compact ? (
            // Folded shut because a rep dialling their fortieth electrician
            // does not want the hours and the statute above the radios; open
            // in one click because the day they are asked "what makes this
            // legal?" they need the answer on the screen they are on.
            <details className="text-xs text-muted-foreground" data-dial-rules>
              <summary className="cursor-pointer min-h-[44px] flex items-center">{rulesSummary}</summary>
              <div className="space-y-0.5 pb-1 break-words">
                {space.detailKey ? <p>{t(space.detailKey, space.params || {})}</p> : null}
                {space.showWindow ? <WindowLines compliance={compliance} /> : null}
                {!space.detailKey && !space.showWindow ? <p>{space.detail}</p> : null}
                {judged}
                {citation}
              </div>
            </details>
          ) : (
            <div className="text-xs text-muted-foreground break-words space-y-0.5">
              {space.detailKey ? <p>{t(space.detailKey, space.params || {})}</p> : null}
              {space.showWindow ? <WindowLines compliance={compliance} /> : null}
              {!space.detailKey && !space.showWindow ? <p>{space.detail}</p> : null}
            </div>
          )}
        </>
      ) : space.state === DIAL_DO_NOT_CONTACT ? (
        // Red, and not one of the three tones. The three are epistemic — we
        // found it, we found its absence, we could not look — and a
        // do-not-contact is none of those. It is a hard stop, and demoting it
        // to the amber a closed calling window gets would be the flattening
        // the tones exist to prevent.
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <Ban size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold break-words">
                {say(t, space.titleKey, space.params, space.title)}
              </p>
              <p className="break-words">{say(t, space.detailKey, space.params, space.detail)}</p>
              <p className="mt-1">{t("app.salesDial.noDialControlShown")}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Notice
            tone={space.tone}
            icon={
              space.state === DIAL_NO_NUMBER
                ? PhoneOff
                : space.state === DIAL_REFUSED
                  ? Clock
                  : CircleHelp
            }
            title={say(t, space.titleKey, space.params, space.title)}
            fix={
              // The opt-out state is the one whose body is genuinely two
              // sentences from two different authorities — the suppression
              // list's account of which entry closed the channel, then ours
              // about what an opt-out means. Printed in that order, each
              // translated whole, rather than concatenated into one string
              // that only one of them could be translated inside.
              space.reasonKey
                ? `${t(space.reasonKey, suppressionValues(t, space.reasonParams))} ${say(t, space.detailKey, space.params, space.detail)}`
                : say(t, space.detailKey, space.params, space.detail)
            }
          />
          {space.showWindow ? (
            compact ? (
              <details className="text-xs text-muted-foreground" data-dial-rules>
                <summary className="cursor-pointer min-h-[44px] flex items-center">{rulesSummary}</summary>
                <div className="space-y-0.5 pb-1 break-words">
                  <WindowLines compliance={compliance} />
                  {citation}
                </div>
              </details>
            ) : (
              <div className="text-xs text-muted-foreground break-words space-y-0.5">
                <WindowLines compliance={compliance} />
              </div>
            )
          ) : null}
          {/* ── Only when nobody is open ──────────────────────────────────
              An empty console teaches a rep nothing about what the console
              does, which is how the owner came to ask whether calling was
              switched off at all. So the no-prospect state — and ONLY that
              one — carries a labelled picture of it.

              Not the other states. A refusal, a do-not-contact or a closed
              calling window are each about THIS business, and drawing a Call
              button underneath one of them would argue with the sentence
              above it. The empty state is the only one whose subject is the
              product rather than a prospect. */}
          {space.state === DIAL_NO_PROSPECT ? <CallConsolePreview /> : null}
        </>
      )}

      {/* The blockers behind a refusal or an unknown, each in its own tone. A
          refusal is a finding; an unknown is not, and the two must not be the
          same colour — same rule the pills follow. */}
      {(space.reasons || []).map((b) => (
        <Notice
          key={b.code}
          tone={compliance?.decision === CALL_REFUSED ? "gap" : "unknown"}
          icon={compliance?.decision === CALL_REFUSED ? Clock : CircleHelp}
          title={say(t, b.titleKey, b.params, b.title)}
          fix={say(t, b.fixKey, b.params, b.fix)}
          legalText={Boolean(b.legalText)}
        />
      ))}

      {/* Said beside a working button on purpose. A cap nothing counts, and a
          registration nobody has filed, are facts about THIS call — burying
          them in a document is how they stop being true. */}
      {(compliance?.unenforced || []).map((u) => (
        <Notice
          key={u.code}
          tone="gap"
          icon={ShieldAlert}
          title={say(t, u.titleKey, u.params, u.title)}
          fix={say(t, u.fixKey, u.params, u.fix)}
          legalText={Boolean(u.legalText)}
        />
      ))}
      {(compliance?.warnings || []).map((w) => (
        <Notice
          key={w.code}
          tone="gap"
          icon={ShieldAlert}
          title={say(t, w.titleKey, w.params, w.title)}
          fix={say(t, w.fixKey, w.params, w.fix)}
          legalText={Boolean(w.legalText)}
        />
      ))}

      {/* Inline on the lead screen; inside the disclosure above on the
          console (the READY branch), where the same nodes are drawn once. */}
      {!compact || space.state !== DIAL_READY ? judged : null}
      {!compact || (space.state !== DIAL_READY && !space.showWindow) ? (
        citation ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              {t("app.salesDial.whatJurisdictionSays", { jurisdiction: compliance.jurisdiction.name })}
            </summary>
            {citation}
          </details>
        ) : null
      ) : null}
    </>
  );
}
