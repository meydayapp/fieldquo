// app/platform/sales/call-quality/page.js
//
// The review queue: every recorded sales call, lowest-scored and unreviewed
// first, with the recording, the transcript (flagged lines marked), the
// scorecard, and the owner's own pass — which is the number the
// performance page shows from then on.
//
// The screen is app/components/sales/CallQualityReview.js, shared with the
// agency's /sales/agency/call-quality; only the URLs and the words differ.
// English only, like every /platform screen (app/i18n/appMessages.js says
// why the catalogue stops where it does).
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import CallQualityReview from "@/app/components/sales/CallQualityReview";

const BTN = "inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium border border-border text-foreground disabled:opacity-50";

const STATE = {
  scored: "scored",
  awaiting_score: "awaiting a score",
  awaiting_transcript: "awaiting the transcript",
  transcript_failed: "transcript failed",
  score_failed: "scoring failed",
  unscorable: "unscorable",
  not_sampled: "not in the sample — opening it transcribes it on demand",
};

const LABELS = {
  queueHeading: "Review queue",
  queueIntro: "Unreviewed calls first, lowest score at the top; then the ones with no score yet; reviewed calls last.",
  refresh: "Refresh",
  loading: "Loading…",
  loadFailed: "Could not load the calls.",
  empty: "No recorded calls yet.",
  pickOne: "Pick a call from the queue.",
  noScore: "no score",
  state: (s) => STATE[s] || s,
  reviewedShort: (name) => `reviewed by ${name}`,
  bannedCount: (n) => `${n} banned ${n === 1 ? "move" : "moves"}`,
  noPlaybook: "no playbook recorded",
  modelSaid: (n) => `the model said ${n}`,
  scorecard: "Scorecard",
  notScoredYet: "Not scored yet. The scorer runs after the transcript lands; use \"Score the missing ones\" above if it did not.",
  playbookMoved: "The playbook has been edited since this call — the comparison was against its current lines.",
  disclosure: "Recording disclosure",
  identity: "Name, company, business in 20 s",
  identityParts: (f) => `${f.companyNamed ? "FieldQuo" : "no FieldQuo"}, ${f.repNamed ? "rep named" : "rep not named"}, ${f.businessNamed ? "business named" : "business not named"}`,
  permission: "Permission asked",
  forYes: "phrased for a yes",
  notForYes: "not phrased for a yes",
  candour: "Candour line",
  bannedMoves: "Banned moves",
  none: "none",
  pivot: "Reason for the call",
  afterAnswer: "after the contractor answered",
  beforeAnswer: "before the contractor answered",
  discovery: "Discovery",
  questions: (n) => `${n} ${n === 1 ? "question" : "questions"}`,
  turnaround: "turnaround asked",
  objections: "Objections",
  noObjection: "none raised",
  libraryAnswer: "library answer",
  ownAnswer: "own answer",
  notHandled: "not handled",
  nextStep: "Next step",
  dated: "with a date",
  notDated: "no date on it",
  closeAsk: "Close ask",
  talkRatio: "Rep talk share",
  talkSplit: (rep, contractor) => `rep ${rep} s, contractor ${contractor} s`,
  coaching: "Coaching",
  rubric: "How the score adds up",
  humanPass: "Your pass",
  humanPassIntro: "Your score replaces the model's on the performance page. Say why in the note — the rep reads it.",
  reviewedBy: (name, when) => `Reviewed by ${name} on ${when}.`,
  yourScore: "Score (0–100)",
  yourNote: "Note",
  saveReview: "Save review",
  reviewSaved: "Saved. The performance page now shows your score for this call.",
  reviewFailed: "The review could not be saved.",
  transcript: "Transcript",
  transcriptFailed: "The transcript failed:",
  transcriptPending: "No transcript yet.",
  speaker: (s) => (s === "rep" ? "REP" : s === "contractor" ? "CONTRACTOR" : "UNKNOWN"),
  yes: "yes",
  no: "no",
  inScript: "in the script",
  repsOwnWords: "the rep's own words",
  reasonAt: "reason said at",
  reasonLate: "after the first minute",
  gatekeeper: "Who answered",
  decisionMaker: "the decision-maker",
  notDecisionMaker: "not the decision-maker",
  nameObtained: "name",
  timeObtained: "time to call back",
  calendarAsked: "calendar asked for",
  inviteMade: "invite created on the call",
  inviteNotMade: "no invite created on the call",
  pitchBurst: "Longest pitch",
  burstShort: "under 25 s — a pitch this short halves the odds of a booked call",
  // ── The recording marks and the disposition audit (docs/SALES-OUTCOMES.md) ──
  markByRep: "the rep, during the call",
  markByReviewer: "a reviewer",
  markPlaceholder: "What is at this second (optional)",
  markHere: "Mark here",
  onDemandTranscribing: "This call was outside the transcription sample. Opening it started the transcript on demand — reopen it in a minute.",
  onDemandScoring: "This call was outside the review sample. Opening it started the scorecard on demand — reopen it in a minute.",
  auditTitle: "Audit the outcome",
  auditIntro: "Was what the rep LOGGED the truth? This is your verdict on the outcome, not on how they spoke — the scorecard above is that. Rejected and observed need a note; the rep reads it on the call's own row and sees a count on their dashboard.",
  auditOutcome: "Rep logged",
  auditAutoLogged: "auto",
  auditNote: "Their note",
  auditAmd: "Carrier's AMD",
  auditAiScore: "AI score",
  auditCurrent: "Current verdict",
  auditOutcomeMoved: (was) => `the outcome was “${was}” when this verdict was given`,
  auditNotes: "Note to the rep",
  auditApprove: "Approve",
  auditReject: "Reject",
  auditObserve: "Observe",
  auditNoOutcome: "No outcome has been logged on this call yet, so there is nothing to audit.",
  auditSaved: "Saved. The rep sees this on the call in their history.",
  auditFailed: "The verdict could not be saved.",
};

export default function CallQualityPage() {
  const params = useSearchParams();
  const repId = params.get("repId") || null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  async function reconcile(what, retryFailed) {
    setBusy(true);
    setNotice("");
    try {
      const r = await fetchJson(what === "transcribe" ? "/api/platform/sales/recordings/transcribe" : "/api/platform/sales/recordings/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20, retryFailed }),
      });
      setNotice(`${what === "transcribe" ? "Transcribed" : "Scored"} ${r.done} of ${r.attempted} tried.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setNotice(err?.message || "The reconcile did not run.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Call quality</h1>
        <p className="text-sm text-muted-foreground">
          Every recorded sales call, scored against the playbook the rep had on screen, with the recording and the transcript beside it. Your pass overrides the model&apos;s number wherever it is shown. The scorecard costs FieldQuo about a tenth of a cent a call and runs on its own after each transcript; the buttons here are the reconcile.
          {repId ? (
            <>
              {" "}
              Showing one rep — <Link href="/platform/sales/call-quality" className="underline">show everyone</Link>.
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* The transcript reconcile lives here too: a call sits in this
              queue as "awaiting the transcript" and this is the button that
              moves it. It had no caller before this page existed. */}
          <button type="button" className={BTN} disabled={busy} onClick={() => reconcile("transcribe", false)}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Transcribe the missing ones
          </button>
          <button type="button" className={BTN} disabled={busy} onClick={() => reconcile("score", false)}>
            Score the missing ones
          </button>
          <button type="button" className={BTN} disabled={busy} onClick={() => reconcile("score", true)}>
            Retry the failed ones
          </button>
          <Link href="/platform/sales/performance" className="text-sm underline text-foreground">
            Sales performance
          </Link>
          {notice ? <span className="text-sm text-muted-foreground" role="status">{notice}</span> : null}
        </div>
      </header>
      <CallQualityReview
        key={reloadKey}
        listUrl="/api/platform/sales/call-quality"
        detailUrl={(id) => `/api/platform/sales/call-quality/${encodeURIComponent(id)}`}
        auditUrl={(id) => `/api/platform/sales/outcomes/audit/${encodeURIComponent(id)}`}
        marksUrl={(id) => `/api/platform/sales/outcomes/marks/${encodeURIComponent(id)}`}
        labels={LABELS}
        repFilter={repId}
      />
    </div>
  );
}
