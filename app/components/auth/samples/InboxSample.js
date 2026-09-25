// app/components/auth/samples/InboxSample.js
//
// "Win more jobs"'s sample: the two screens that answer it, drawn by
// themselves.
//
//   1. The Messages inbox list — the chat kit's RoomList with the rows the
//      inbox builds (app/app/messages/threadRooms.js), over the harness's
//      three conversations (fixtures/routes-grow.js THREADS, summarised by
//      the same `summary` the fixture's GET /api/messaging/threads uses):
//      a Facebook enquiry about a walk-in pantry waiting on a reply, an
//      Instagram question about an island, a WhatsApp client confirming an
//      install day.
//   2. The AI team's routing — TeamFlow (app/components/aiEmployee/
//      TeamFlow.js), the picture on Settings › AI team: the channels, the
//      front desk sorting each first message by intent, the employee each
//      intent goes to, the hand-offs, and the person at the end — with the
//      harness's week of counts (fixtures/ai-team.js).
//
// Until 2026-09-25 this was a hand-drawn "Calls / Texts / Web form → Front
// desk → You" diagram. TeamFlow is that diagram as the product draws it.
"use client";

import { useMemo } from "react";
import RoomList from "@/app/components/chat/RoomList";
import TeamFlow from "@/app/components/aiEmployee/TeamFlow";
import { threadRoomGroups } from "@/app/app/messages/threadRooms";
import { useTranslation } from "@/app/hooks/useTranslation";
import { TODAY } from "@/docs/screens/app-guide/harness/fixtures/company.js";
import { THREADS, summary } from "@/docs/screens/app-guide/harness/fixtures/routes-grow.js";
import { AI_EMPLOYEE, AI_PROPOSALS } from "@/docs/screens/app-guide/harness/fixtures/ai-team.js";
import SampleFrame from "./SampleFrame";

/** The inbox rows and the AI team payload the sample renders — for the check. */
export function inboxSample() {
  return { threads: THREADS.map(summary), team: AI_EMPLOYEE, proposals: AI_PROPOSALS.proposals || [] };
}

export default function InboxSample() {
  const { t } = useTranslation();
  const { threads, team, proposals } = useMemo(() => inboxSample(), []);
  const groups = useMemo(() => threadRoomGroups(threads, { t, now: TODAY }), [threads, t]);
  return (
    <div className="space-y-3" data-inbox-sample>
      <SampleFrame width={380} maxHeight={420} label={t("app.signup.aside.ai.inboxLabel", "the inbox — every conversation in one list")}>
        <div className="bg-card">
          <RoomList groups={groups} onSelect={() => {}} onToggleGroup={() => {}} ariaLabel={t("app.signup.aside.ai.inboxLabel", "the inbox — every conversation in one list")} />
        </div>
      </SampleFrame>
      <SampleFrame width={980} maxHeight={760} label={t("app.signup.aside.ai.flowLabel", "your AI team: who answers which message, and when it comes to you")}>
        <div className="bg-background p-4">
          <TeamFlow data={team} proposals={proposals} onEmployees={() => {}} t={t} />
        </div>
      </SampleFrame>
    </div>
  );
}
