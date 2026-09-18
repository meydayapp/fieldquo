"use client";

// app/sales/agency/call-quality/page.js
//
// The agency's review queue: its employees' recorded calls, the recording,
// the transcript with flagged lines, the scorecard, and the agency's own
// pass — recorded under its name, and shown to the platform as such.
//
// The screen is app/components/sales/CallQualityReview.js, the same one
// the owner uses at /platform/sales/call-quality; the routes behind it
// (app/api/sales/agency/call-quality/*) scope every read to the team, read
// fresh. The words come from the catalogue.
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import CallQualityReview from "@/app/components/sales/CallQualityReview";

const STATE_KEY = {
  scored: "app.salesCallQa.state.scored",
  awaiting_score: "app.salesCallQa.state.awaiting_score",
  awaiting_transcript: "app.salesCallQa.state.awaiting_transcript",
  transcript_failed: "app.salesCallQa.state.transcript_failed",
  score_failed: "app.salesCallQa.state.score_failed",
  unscorable: "app.salesCallQa.state.unscorable",
};

function reviewLabelsFor(t) {
  return {
    queueHeading: t("app.salesCallQa.queueHeading"),
    queueIntro: t("app.salesCallQa.queueIntro"),
    refresh: t("app.salesAgency.refresh"),
    loading: t("app.salesCallQa.loading"),
    loadFailed: t("app.salesCallQa.loadFailed"),
    empty: t("app.salesCallQa.empty"),
    pickOne: t("app.salesCallQa.pickOne"),
    noScore: t("app.salesCallQa.noScore"),
    state: (s) => (STATE_KEY[s] ? t(STATE_KEY[s]) : s),
    reviewedShort: (name) => t("app.salesCallQa.reviewedShort", { name }),
    bannedCount: (n) => t("app.salesCallQa.bannedCount", { n }),
    noPlaybook: t("app.salesCallQa.noPlaybook"),
    modelSaid: (n) => t("app.salesCallQa.modelSaid", { n }),
    scorecard: t("app.salesCallQa.scorecard"),
    notScoredYet: t("app.salesCallQa.notScoredYet"),
    playbookMoved: t("app.salesCallQa.playbookMoved"),
    disclosure: t("app.salesCallQa.disclosure"),
    identity: t("app.salesCallQa.identity"),
    identityParts: (f) =>
      [
        f.companyNamed ? t("app.salesCallQa.companyNamed") : t("app.salesCallQa.companyNotNamed"),
        f.repNamed ? t("app.salesCallQa.repNamed") : t("app.salesCallQa.repNotNamed"),
        f.businessNamed ? t("app.salesCallQa.businessNamed") : t("app.salesCallQa.businessNotNamed"),
      ].join(", "),
    permission: t("app.salesCallQa.permission"),
    forYes: t("app.salesCallQa.forYes"),
    notForYes: t("app.salesCallQa.notForYes"),
    candour: t("app.salesCallQa.candour"),
    bannedMoves: t("app.salesCallQa.bannedMoves"),
    none: t("app.salesCallQa.none"),
    pivot: t("app.salesCallQa.pivot"),
    afterAnswer: t("app.salesCallQa.afterAnswer"),
    beforeAnswer: t("app.salesCallQa.beforeAnswer"),
    discovery: t("app.salesCallQa.discovery"),
    questions: (n) => t("app.salesCallQa.questions", { n }),
    turnaround: t("app.salesCallQa.turnaround"),
    objections: t("app.salesCallQa.objections"),
    noObjection: t("app.salesCallQa.noObjection"),
    libraryAnswer: t("app.salesCallQa.libraryAnswer"),
    ownAnswer: t("app.salesCallQa.ownAnswer"),
    notHandled: t("app.salesCallQa.notHandled"),
    nextStep: t("app.salesCallQa.nextStep"),
    dated: t("app.salesCallQa.dated"),
    notDated: t("app.salesCallQa.notDated"),
    closeAsk: t("app.salesCallQa.closeAsk"),
    talkRatio: t("app.salesCallQa.talkRatio"),
    talkSplit: (rep, contractor) => t("app.salesCallQa.talkSplit", { rep, contractor }),
    coaching: t("app.salesCallQa.coaching"),
    rubric: t("app.salesCallQa.rubric"),
    humanPass: t("app.salesCallQa.humanPass"),
    humanPassIntro: t("app.salesCallQa.humanPassIntro"),
    reviewedBy: (name, when) => t("app.salesCallQa.reviewedBy", { name, when }),
    yourScore: t("app.salesCallQa.yourScore"),
    yourNote: t("app.salesCallQa.yourNote"),
    saveReview: t("app.salesCallQa.saveReview"),
    reviewSaved: t("app.salesCallQa.reviewSaved"),
    reviewFailed: t("app.salesCallQa.reviewFailed"),
    transcript: t("app.salesCallQa.transcript"),
    transcriptFailed: t("app.salesCallQa.transcriptFailed"),
    transcriptPending: t("app.salesCallQa.transcriptPending"),
    speaker: (s) => (s === "rep" ? t("app.salesCallQa.speakerRep") : s === "contractor" ? t("app.salesCallQa.speakerContractor") : t("app.salesCallQa.speakerUnknown")),
    yes: t("app.salesCallQa.yes"),
    no: t("app.salesCallQa.no"),
    inScript: t("app.salesCallQa.inScript"),
    repsOwnWords: t("app.salesCallQa.repsOwnWords"),
    reasonAt: t("app.salesCallQa.reasonAt"),
    reasonLate: t("app.salesCallQa.reasonLate"),
    gatekeeper: t("app.salesCallQa.gatekeeper"),
    decisionMaker: t("app.salesCallQa.decisionMaker"),
    notDecisionMaker: t("app.salesCallQa.notDecisionMaker"),
    nameObtained: t("app.salesCallQa.nameObtained"),
    timeObtained: t("app.salesCallQa.timeObtained"),
    calendarAsked: t("app.salesCallQa.calendarAsked"),
    inviteMade: t("app.salesCallQa.inviteMade"),
    inviteNotMade: t("app.salesCallQa.inviteNotMade"),
    pitchBurst: t("app.salesCallQa.pitchBurst"),
    burstShort: t("app.salesCallQa.burstShort"),
  };
}

export default function AgencyCallQualityPage() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const repId = params.get("repId") || null;
  const labels = useMemo(() => reviewLabelsFor(t), [t]);

  return (
    <div className="space-y-4 max-w-6xl" data-agency-call-quality>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck size={20} aria-hidden="true" /> {t("app.salesCallQa.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("app.salesCallQa.agencyIntro")}</p>
        <p className="text-sm">
          <Link href="/sales/agency" className="underline text-foreground">
            {t("app.salesAgency.title")}
          </Link>
          {" · "}
          <Link href="/sales/agency/performance" className="underline text-foreground">
            {t("app.salesAgencyPerf.title")}
          </Link>
          {repId ? (
            <>
              {" · "}
              <Link href="/sales/agency/call-quality" className="underline text-foreground">
                {t("app.salesCallQa.showEveryone")}
              </Link>
            </>
          ) : null}
        </p>
      </header>
      <CallQualityReview
        listUrl="/api/sales/agency/call-quality"
        detailUrl={(id) => `/api/sales/agency/call-quality/${encodeURIComponent(id)}`}
        labels={labels}
        repFilter={repId}
      />
    </div>
  );
}
