// app/platform/companies/[id]/CompanyPresence.js
//
// "Is anybody from this company actually in the product?" — the badge beside
// the company's name, and the per-member list under it: name, role, and when
// each person was last in.
//
// Read-only, and deliberately without a single control. It reads
// GET /api/platform/companies/[id]/presence every minute while the tab is
// visible, and the words come from lib/platform/companyPresence.js — the same
// function behind the list's badge, so a company never reads "Online now" on
// one screen and "Active 7 min ago" on the other.
"use client";

import { Users } from "lucide-react";
import PresenceBadge, { usePresencePoll } from "@/app/components/platform/PresenceBadge";
import { latestOf, presenceBadge } from "@/lib/platform/companyPresence";

/** The company-level badge, from the same member rows the list below prints. */
function companyBadge(data, now) {
  if (!data) return null;
  const members = data.members || [];
  return presenceBadge({
    lastActiveAt: latestOf(members.map((m) => m.lastActiveAt)),
    signedInAt: latestOf(members.map((m) => m.signedInAt)),
    companyCreatedAt: data.companyCreatedAt,
    memberCount: members.length,
    now,
  });
}

/** The badge for the header, polled. Renders nothing until the first answer. */
export function useCompanyPresence(companyId) {
  const poll = usePresencePoll(companyId ? `/api/platform/companies/${companyId}/presence` : null);
  return { ...poll, badge: companyBadge(poll.data, poll.now) };
}

/**
 * The per-member breakdown. Takes the poll's result from the page rather
 * than polling again, so the header badge and this list are one reading.
 */
export default function CompanyPresence({ data, error, now }) {
  if (!data && !error) return null;
  const members = data?.members || [];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <Users size={16} className="text-muted-foreground" />
        Who&apos;s been in
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        &quot;Online now&quot; and &quot;Active&quot; come from someone using
        FieldQuo in a visible tab, recorded since Sep 24, 2026. &quot;Signed
        in&quot; means we can see they were signed in then (a login, or their
        browser reaching the app) — shown only when there is no activity
        record yet, and not a claim they were using it. &quot;Never&quot;
        means nothing after the signup visit that we can see. Viewing this
        account as support never counts.
      </p>

      {error && (
        <p className="text-sm text-muted-foreground mb-2">
          {data
            ? `Didn't refresh (${error}); showing the last reading.`
            : `Couldn't load who's been in (${error}).`}
        </p>
      )}

      {data && members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No members yet — nobody has an account on this company.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {members.map((m) => {
            const badge = presenceBadge({
              lastActiveAt: m.lastActiveAt,
              signedInAt: m.signedInAt,
              // Per person, "since signup" is since they joined: an invited
              // employee's own account and first session come into being
              // when they accept, just before their membership does.
              companyCreatedAt: m.joinedAt,
              memberCount: 1,
              now,
              subject: "member",
            });
            return (
              <div key={m.id} className="flex items-center justify-between py-2.5 gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {m.name || m.email || "Unnamed"}
                    {!m.active && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(deactivated)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.role}</div>
                </div>
                <PresenceBadge badge={badge} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
