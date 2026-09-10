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
import CallPanel from "./CallPanel";
import CallConsolePreview from "./CallConsolePreview";

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
export function Notice({ tone, icon: Icon, title, fix }) {
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
export default function DialRegion({ space, compliance = null, target = null, onWorked }) {
  const { t } = useTranslation();
  return (
    <>
      {space.state === DIAL_READY && space.href && target ? (
        <>
          <CallPanel
            prospectId={target.prospectId || null}
            leadId={target.leadId || null}
            phoneE164={target.phoneE164}
            contactNumberId={target.contactNumberId || null}
            businessName={target.businessName}
            fallbackHref={space.href}
            onWorked={onWorked}
          />
          <p className="text-xs text-muted-foreground break-words">{space.detail}</p>
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
              <p className="font-semibold break-words">{space.title}</p>
              <p className="break-words">{space.detail}</p>
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
            title={space.title}
            fix={space.detail}
          />
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
          title={b.title}
          fix={b.fix}
        />
      ))}

      {/* Said beside a working button on purpose. A cap nothing counts, and a
          registration nobody has filed, are facts about THIS call — burying
          them in a document is how they stop being true. */}
      {(compliance?.unenforced || []).map((u) => (
        <Notice key={u.code} tone="gap" icon={ShieldAlert} title={u.title} fix={u.fix} />
      ))}
      {(compliance?.warnings || []).map((w) => (
        <Notice key={w.code} tone="gap" icon={ShieldAlert} title={w.title} fix={w.fix} />
      ))}

      {compliance?.decision === CALL_ALLOWED && compliance.windowText ? (
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
      ) : null}

      {/* ── The citation, shown rather than stored ──────────────────────────
          `citation` was carried on every row and reached a human only through
          the "nobody has read this" blocker — so the verified half of the
          table, which is the half that lets a call happen, cited its statute
          to nobody. That is AGENTS.md failure class #1 with the safe-looking
          sign: written and never read.

          Folded shut because a rep dialling their fortieth painter does not
          want a statute number, and open in one click because the day they are
          asked "what makes this legal?" they need the answer on the screen
          they are already on. */}
      {compliance?.jurisdiction?.verified && compliance.citation ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {t("app.salesDial.whatJurisdictionSays", { jurisdiction: compliance.jurisdiction.name })}
          </summary>
          <p className="mt-1 break-words">{compliance.citation}</p>
        </details>
      ) : null}
    </>
  );
}
