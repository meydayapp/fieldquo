// app/app/settings/cabinet-rates/layout.js
//
// The server-side half of the Cabinet Rates trade gate. SettingsSidebar hides
// this row for a company with no reason to see it (lib/settings/tradeGateNav.js)
// and GET/PUT/DELETE /api/settings/cabinet-rates refuse independently of the
// row — but AGENTS.md is explicit that hiding a row is not access control, and
// a bookmarked /app/settings/cabinet-rates was reachable regardless of either.
// Mirrors app/app/quotes/[id]/kitchen/page.js, which closed the identical hole
// for the designer itself: fetches render a full shell and then 403 without
// this, which is the dead-screen failure AGENTS.md names.
//
// See lib/settings/tradeGate.js for why this screen is gated whole rather than
// per-field the way Material Costs is next door.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/currentMember";
import { canUseCabinetRatesSettings } from "@/lib/settings/tradeGate";

export default async function CabinetRatesLayout({ children }) {
  let member;
  try {
    // skipBillingGate, same as the settings layout one level up: an overdue
    // company must still be able to reach settings, and this is not the
    // screen that explains why they can't pay.
    member = await getCurrentMember(
      {
        headers: await headers(),
        method: "GET",
        url: "http://x/app/settings/cabinet-rates",
      },
      { skipBillingGate: true },
    );
  } catch (err) {
    console.error("[CabinetRatesLayout] couldn't resolve the member:", err);
    notFound();
  }
  if (!member?.companyId) notFound();

  // Non-negotiable #3: a read-only support session sees everything. The API
  // route carves impersonation out of its GET the same way (see the comment
  // on requireAdmin there) — this is the page half of that same decision, not
  // a separate one. Writes still refuse for impersonation at the API, same as
  // they always have.
  if (member.impersonation) return children;

  const allowed = await canUseCabinetRatesSettings(member.companyId);
  if (!allowed) notFound();

  return children;
}
