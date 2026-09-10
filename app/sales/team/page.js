"use client";

// app/sales/team/page.js
//
// A rep's view of FieldQuo's staff chat. The screen is
// app/components/staff/StaffChat.js, rendered identically in /platform — see
// its header for why that is one component and not two.
import StaffChat from "@/app/components/staff/StaffChat";

export default function SalesTeamPage() {
  return <StaffChat heading="Team" />;
}
