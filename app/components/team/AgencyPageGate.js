"use client";

// app/components/team/AgencyPageGate.js
//
// The PAGE half of the marketing agency's boundary
// (lib/permissions/marketingAgency.js). Mounted once, around every /app page,
// by app/app/layout.js — beside PersonalPageGate and for the same reason: one
// gate for every page, so a page outside the agency's scope never mounts and
// never asks its endpoints for anything.
//
// ── Why a client component, re-read on every navigation ────────────────────
//
// The /app layout persists across client-side navigation, and so does a
// server template's output for a parent segment (Next renders a soft
// navigation from the segment that changed, downwards). A server-side gate
// there would be decided once, on the first page load, and then wave through
// every page reached by a link. usePathname changes on every navigation, so
// this decides for every page the agency opens.
//
// It is the cosmetic half, and says so. The API refusal in
// lib/currentMember.js is the boundary: every /app page is a client
// component that loads its data from /api, and those calls are refused to the
// agency whether or not this ever renders. What this adds is that no page
// renders its shell and then fills with refusals — the dead-control failure
// AGENTS.md names — and the three server pages that read the database
// directly each refuse the agency themselves (see check-marketing-agency-role).
//
// Falls open while PermissionProvider is unresolved, like every nav filter —
// for everybody EXCEPT an identified agency member, nothing here changes.

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Lock, BarChart3, Users, Filter } from "lucide-react";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { agencyPageDecision } from "@/lib/permissions/marketingAgency";

const PLACES = [
  { key: "app.nav.marketingResults", href: "/app/marketing/results", Icon: BarChart3 },
  { key: "app.nav.marketingLeads", href: "/app/marketing/leads", Icon: Users },
  { key: "app.nav.funnels", href: "/app/funnels", Icon: Filter },
];

export default function AgencyPageGate({ children }) {
  const caller = usePermissions();
  const pathname = usePathname();
  const router = useRouter();
  const decision = agencyPageDecision(caller, pathname);

  // /app itself is the dashboard: money, jobs, the day's visits. The agency's
  // home is their results, so they are sent there rather than shown a refusal
  // on the page every login lands on.
  useEffect(() => {
    if (decision.action === "redirect") router.replace(decision.path);
  }, [decision.action, decision.path, router]);

  if (decision.action === "allow") return children;
  if (decision.action === "redirect") return null;
  return <AgencyScopePanel />;
}

/** "This screen isn't part of your access" — with the three places that are. */
export function AgencyScopePanel() {
  const { t } = useTranslation();
  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto" data-agency-scope-panel>
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <Lock size={18} className="text-muted-foreground shrink-0" />
          <h1 className="text-lg font-bold text-foreground">{t("app.agencyRole.gateTitle")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("app.agencyRole.gateBody")}</p>
        <ul className="space-y-1.5">
          {PLACES.map(({ key, href, Icon }) => (
            <li key={href}>
              <Link href={href} className="inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-foreground underline">
                <Icon size={15} aria-hidden="true" /> {t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
