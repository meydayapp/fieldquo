"use client";

// app/sales/team/page.js
//
// A rep's view of FieldQuo's staff chat, with the People card above it.
//
// The screen is app/components/staff/StaffChat.js, rendered identically in
// /platform — see its header for why that is one component and not two.
// Everything a rep reads in the chat is StaffChat's own copy, translated
// there or not at all; a second wording here would be the copy that rots.
//
// Above it, since 2026-09-21, app/components/sales/PeopleCard.js: the
// floor with a dot for who is at their desk, a Call that rings a
// colleague's browser (no carrier cost), and — for a rep the owner has
// allowed it — a field to dial a number outside the queue. Its copy is
// its own and keyed.
import StaffChat from "@/app/components/staff/StaffChat";
import PeopleCard from "@/app/components/sales/PeopleCard";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SalesTeamPage() {
  const { t } = useTranslation();
  // The wrapper exists for one attribute: the portal tour's anchor. StaffChat
  // is shared with /platform and must not carry a sales-only data-tour.
  return (
    <div data-tour="sales-team" className="space-y-4">
      <PeopleCard />
      <StaffChat heading={t("app.salesNotes.teamHeading")} height="fq-sales-fill" />
    </div>
  );
}
