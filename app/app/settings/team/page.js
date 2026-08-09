// app/app/team/settings/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Clock, Mail } from "lucide-react";
import { formatCompanyDate } from "@/lib/format/companyDate";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import SeatUpgradePanel from "@/app/components/SeatUpgradePanel";

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  supervisor: "Supervisor",
  employee: "Employee",
};

const ROLE_RANK = { owner: 3, admin: 2, supervisor: 1, employee: 0 };

function timeAgo(date, dateFormat) {
  if (!date) return "Never";
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatCompanyDate(date, dateFormat);
}

export default function TeamOverviewPage() {
  const { t } = useTranslation();
  const { dateFormat } = useCompanyPreferences();
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [seats, setSeats] = useState({ used: 0, limit: null });
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [error, setError] = useState("");

  // What THIS user is allowed to assign. Comes from the server rather than
  // being inferred client-side: the UI should offer exactly what the API will
  // accept, so a supervisor never picks a role that then bounces with a 403.
  const [grants, setGrants] = useState({
    assignableRoles: [],
    yourRole: null,
  });

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/settings/members").then((r) => r.json()),
      fetch("/api/settings/members/pending").then((r) =>
        r.ok ? r.json() : { pending: [], seats: {} },
      ),
      // The id in this path is ignored by the GET handler — it returns the
      // caller's own grants, not the target's.
      fetch("/api/settings/members/self/role").then((r) =>
        r.ok ? r.json() : { assignableRoles: [] },
      ),
    ]).then(([memberData, pendingData, grantData]) => {
      setMembers(Array.isArray(memberData) ? memberData : []);
      setPending(Array.isArray(pendingData.pending) ? pendingData.pending : []);
      setSeats(pendingData.seats || { used: 0, limit: null });
      setGrants(grantData);
    });
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Non-role fields (active, profile) still go through the general endpoint.
  async function updateMember(userId, patch) {
    setSavingUserId(userId);
    setError("");
    try {
      const res = await fetch("/api/settings/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || t("app.setTeam.errSave"));
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingUserId(null);
    }
  }

  // Role changes go to the dedicated endpoint, which enforces the hierarchy
  // rules (no self-edits, no editing peers or superiors, no granting beyond
  // your own level, last owner protected).
  async function updateRole(member, role) {
    setSavingUserId(member.userId);
    setError("");
    try {
      const res = await fetch(`/api/settings/members/${member.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.setTeam.errRole"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingUserId(null);
    }
  }

  // Mirrors canManageMember on the server. Duplicated deliberately — the
  // server is the authority, this only decides whether to render a control.
  function canEdit(member) {
    const mine = ROLE_RANK[grants.yourRole] ?? -1;
    const theirs = ROLE_RANK[member.role] ?? -1;
    return mine > theirs;
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("app.setTeam.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            {t("app.setTeam.subtitle")}
          </p>
        </div>
        <Link
          href="/app/settings/team/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold shrink-0"
        >
          <Plus size={14} /> {t("app.setTeam.addUser")}
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {seats.used}
          {seats.limit ? ` / ${seats.limit}` : ""}
        </span>{" "}
        {t("app.setTeam.activeUsers")}{" "}
        {seats.limit ? t("app.setTeam.unallocatedLicenses") : ""}
        {seats.limit && seats.used >= seats.limit && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {t("app.setTeam.atPlanLimit")}
          </span>
        )}
      </div>

      {seats.limit && seats.used >= seats.limit && (
        <SeatUpgradePanel used={seats.used} limit={seats.limit} />
      )}

      <div className="flex gap-2 text-sm">
        <Link
          href="/app/settings/team/workers"
          className="border border-border rounded-full px-4 py-2"
        >
          {t("app.setTeam.workers")}
        </Link>
        <Link
          href="/app/settings/team/timesheets"
          className="border border-border rounded-full px-4 py-2"
        >
          {t("app.nav.timesheets")}
        </Link>
        <Link
          href="/app/settings/team/payroll"
          className="border border-border rounded-full px-4 py-2"
        >
          {t("app.nav.payroll")}
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-[560px]">
          <span>{t("app.setTeam.nameEmail")}</span>
          <span>{t("app.setTeam.role")}</span>
          <span>{t("app.setTeam.lastLogin")}</span>
          <span>{t("app.status.active")}</span>
        </div>

        <div className="divide-y divide-border min-w-[560px]">
          {members.map((m) => (
            <div
              key={m.userId}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 items-center"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {m.user.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
              </div>

              {/* Read-only badge when this member is at or above the viewer's
                  rank — including their own row. Showing a dropdown that then
                  403s is worse than showing none. */}
              {!canEdit(m) ? (
                <span
                  className="text-xs bg-muted px-2.5 py-1 rounded-full w-fit"
                  title={
                    m.role === "owner"
                      ? t("app.setTeam.ownerChangeHint")
                      : t("app.setTeam.roleBelowHint")
                  }
                >
                  {ROLE_LABELS[m.role] || m.role}
                </span>
              ) : (
                <select
                  value={m.role}
                  disabled={savingUserId === m.userId}
                  onChange={(e) => updateRole(m, e.target.value)}
                  className="text-xs border border-border rounded-full px-2.5 py-1 bg-card"
                >
                  {/* Their current role is always listed even if it's not
                      assignable, so the select has a valid selected value. */}
                  {Array.from(
                    new Set([m.role, ...(grants.assignableRoles || [])]),
                  ).map((r) => (
                    <option
                      key={r}
                      value={r}
                      disabled={
                        r !== m.role && !grants.assignableRoles?.includes(r)
                      }
                    >
                      {ROLE_LABELS[r] || r}
                    </option>
                  ))}
                </select>
              )}

              <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                <Clock size={12} /> {timeAgo(m.lastLoginAt, dateFormat)}
              </span>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={m.active}
                  // Same rank rule as the role dropdown. Previously only
                  // owners were protected, which meant a supervisor could
                  // deactivate an admin — locking out someone senior to them.
                  disabled={!canEdit(m) || savingUserId === m.userId}
                  title={
                    canEdit(m)
                      ? undefined
                      : t("app.setTeam.deactivateHint")
                  }
                  onChange={(e) =>
                    updateMember(m.userId, { active: e.target.checked })
                  }
                />
              </label>
            </div>
          ))}

          {pending.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 items-center bg-muted/60"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {p.name || p.email}
                </div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </div>
              <span className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                <Mail size={11} /> {t("app.setTeam.invited")}
              </span>
              <span className="text-xs text-muted-foreground">—</span>
              <span className="text-xs text-muted-foreground">—</span>
            </div>
          ))}

          {members.length === 0 && pending.length === 0 && (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              {t("app.setTeam.noMembers")}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("app.setTeam.ownerNote")}
      </p>
    </div>
  );
}
