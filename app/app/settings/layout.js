// app/app/settings/layout.js
//
// `lg:flex`, not `flex`. Below lg the sidebar becomes a sticky bar plus a sheet
// (see SettingsSidebar), and that bar has to be a full-width block ABOVE the
// page rather than a 256px column beside it. As a permanent flex row this
// layout left 119px of a 375px phone for the actual settings screen.
//
// The drill-down provider is mounted HERE rather than on any page because this
// layout is the only thing that survives a navigation from one settings page to
// the next — which is what makes "where did you come from" answerable at all.
// See SettingsDrillDown.js.
//
// The access provider is mounted HERE for the same reason the drill-down
// provider is: this layout is the only thing that survives a navigation from
// one settings page to the next, and the sidebar it renders has to know the
// member's role before its first paint. Resolving it on the server costs one
// query and means no settings row is ever drawn and then taken away.
//
// Never throws. A role lookup failing must not take the settings area down, and
// the fallback (null → show everything, editable) is exactly today's behaviour
// — every screen behind these rows is gated server-side regardless.
import { headers } from "next/headers";
import SettingsSidebar from "@/app/components/layout/SettingsSidebar";
import {
  SettingsDrillDownProvider,
  SettingsBackBar,
} from "@/app/components/settings/SettingsDrillDown";
import { SettingsAccessProvider } from "@/app/providers/SettingsAccessProvider";
import { getCurrentMember } from "@/lib/currentMember";
import { companyTradeGate } from "@/lib/settings/tradeGate";

async function getAccess() {
  try {
    const member = await getCurrentMember(
      { headers: await headers(), method: "GET", url: "http://x/app/settings" },
      // The billing gate would throw for an overdue company, and settings is
      // where they go to fix it. AppLayout skips it for the same reason.
      { skipBillingGate: true },
    );
    if (!member?.role) return null;
    return { role: member.role, impersonation: !!member.impersonation };
  } catch (err) {
    console.error("[SettingsLayout] couldn't resolve the member's role:", err);
    return null;
  }
}

/**
 * Which trade-specific rows (Cabinet Rates, Material Costs) this company has
 * a reason to see — see lib/settings/tradeGate.js for the full reasoning.
 * Resolved here for the same reason `getAccess` is: the sidebar needs the
 * answer before its FIRST paint, or it draws all thirty-six rows and then
 * removes some, which is worse than never hiding them.
 *
 * Never throws, and null (not member.companyId, or the lookup failing) reads
 * as "unresolved" everywhere this is consumed — which the trade-gate nav
 * filter treats as "show it", the same fail-open posture featureFlags and
 * access carry on this exact layout.
 */
async function getTradeGate() {
  try {
    const member = await getCurrentMember(
      { headers: await headers(), method: "GET", url: "http://x/app/settings" },
      { skipBillingGate: true },
    );
    if (!member?.companyId) return null;
    return await companyTradeGate(member.companyId);
  } catch (err) {
    console.error("[SettingsLayout] couldn't resolve the company's trade gate:", err);
    return null;
  }
}

export default async function SettingsLayout({ children }) {
  const [access, tradeGate] = await Promise.all([getAccess(), getTradeGate()]);

  return (
    <SettingsAccessProvider access={access}>
      <SettingsDrillDownProvider>
        <div className="lg:flex min-h-screen">
          <SettingsSidebar tradeGate={tradeGate} />
          <main className="flex-1 min-w-0">
            {/* Renders nothing unless this visit was a confirmed drill-down. */}
            <SettingsBackBar />
            {children}
          </main>
        </div>
      </SettingsDrillDownProvider>
    </SettingsAccessProvider>
  );
}
