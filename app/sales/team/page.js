"use client";

// app/sales/team/page.js
//
// A rep's view of FieldQuo's staff chat. The screen is
// app/components/staff/StaffChat.js, rendered identically in /platform — see
// its header for why that is one component and not two.
//
// Only the heading belongs to this file. Everything else a rep reads on this
// screen is StaffChat's own copy, and it is translated there or not at all —
// the same component serves /platform, so a second wording here would be the
// copy that rots.
import StaffChat from "@/app/components/staff/StaffChat";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SalesTeamPage() {
  const { t } = useTranslation();
  // The wrapper exists for one attribute: the portal tour's anchor. StaffChat
  // is shared with /platform and must not carry a sales-only data-tour.
  return (
    <div data-tour="sales-team">
      <StaffChat heading={t("app.salesNotes.teamHeading")} />
    </div>
  );
}
