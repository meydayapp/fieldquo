// app/app/team/settings/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Clock, Mail, X } from "lucide-react";
import { formatCompanyDate } from "@/lib/format/companyDate";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import SeatUpgradePanel from "@/app/components/SeatUpgradePanel";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import {
  ROLE_LABELS,
  ROLE_RANK,
  canRevokeAccess,
} from "@/lib/permissions/roleManagement";

// Both of these were private copies of the maps in lib/permissions/roleManagement.js.
// That duplication is why this screen said "Supervisor / Admin" while the invite
// screen said "Dispatcher / Manager" for the same people — two sources of truth,
// and only one of them got updated. Imported now, so they cannot drift again.

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
  const access = useSettingsAccess();
  const canAdd = access.canChange("user:manage");
  const { dateFormat } = useCompanyPreferences();
  const [members, setMembers] = useState([]);
  const [pending, setPending] = useState([]);
  const [seats, setSeats] = useState({ used: 0, limit: null });
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [error, setError] = useState("");
  // The pending invite awaiting a confirmation, and the one being cancelled.
  // A one-click revoke on a row that looks like every other row is how the
  // wrong person gets cut off.
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

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

  // Cancel an invitation nobody has accepted. The server is the authority
  // (DELETE /api/settings/members/pending/[id] re-checks the permission and
  // the company); this only decides whether to offer the control.
  async function revokeInvite(pendingRow) {
    setRevokingId(pendingRow.id);
    setError("");
    try {
      const res = await fetch(`/api/settings/members/pending/${pendingRow.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data?.error ||
            t("app.setTeam.errRevoke", "Could not cancel that invitation."),
        );
      }
      setConfirmRevoke(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevokingId(null);
    }
  }

  const canManageInvites = ["owner", "admin", "supervisor"].includes(
    grants.yourRole,
  );

  // Mirrors canManageMember on the server. Duplicated deliberately — the
  // server is the authority, this only decides whether to render a control.
  function canEdit(member) {
    const mine = ROLE_RANK[grants.yourRole] ?? -1;
    const theirs = ROLE_RANK[member.role] ?? -1;
    return mine > theirs;
  }

  // Deactivation is narrower than editing. A Manager can invite people and fix
  // their details but cannot revoke anyone's login — see canRevokeAccess in
  // lib/permissions/roleManagement.js. Mirrored here so the checkbox is
  // disabled rather than throwing a 403 when it's clicked; a control that
  // looks live and isn't is the failure this codebase keeps getting swept for.
  function canToggleActive(member) {
    return canRevokeAccess(grants.yourRole) && canEdit(member);
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
        {/* ── Read-only, not hidden ──────────────────────────────────────
            Seeing who is on the team is reasonable for anyone on it — the roster
            is how you know who to call about a job. Managing it is not, so the
            page keeps its list and loses its controls: the role selects and the
            active switch are already disabled for members the actor outranks
            (canEdit below), and this is the last live-looking control left.

            From the provider rather than the /self/role fetch two lines below,
            which lands a moment after first paint — a hiring button that appears
            and then vanishes is worse than one that was never there. */}
        {canAdd && (
          <Link
            href="/app/settings/team/new"
            className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold shrink-0"
          >
            <Plus size={14} /> {t("app.setTeam.addUser")}
          </Link>
        )}
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

      {/* Billing is owner/admin only, so a supervisor seeing this would get a
          403 the moment they pressed Upgrade — a control that looks live and
          isn't. They still see the "at plan limit" badge above, which is the
          honest half: it tells them why they can't invite, without offering an
          action that isn't theirs to take. */}
      {seats.limit &&
        seats.used >= seats.limit &&
        ["owner", "admin"].includes(grants.yourRole) && (
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
                  // Rank AND role. The rank rule stops a Manager deactivating
                  // someone senior; canRevokeAccess stops a Manager
                  // deactivating anyone at all.
                  disabled={!canToggleActive(m) || savingUserId === m.userId}
                  title={
                    canToggleActive(m)
                      ? undefined
                      : !canRevokeAccess(grants.yourRole)
                        ? t("app.setTeam.revokeOwnerOnly")
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
              {canManageInvites ? (
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(p)}
                  disabled={revokingId === p.id}
                  className="text-xs font-semibold text-red-700 dark:text-red-300 border border-border rounded-full px-2.5 py-1 flex items-center gap-1 disabled:opacity-60"
                >
                  <X size={12} />{" "}
                  {t("app.setTeam.cancelInvite", "Cancel invite")}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
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

      {confirmRevoke && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-foreground">
              {t("app.setTeam.cancelInviteTitle", "Cancel this invitation?")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "app.setTeam.cancelInviteBody",
                "Their invitation link stops working and the licence is freed. They keep any worker record already on your books — remove that from Workers if you need to.",
              )}
            </p>
            <p className="text-sm font-medium text-foreground">
              {confirmRevoke.name
                ? `${confirmRevoke.name} — ${confirmRevoke.email}`
                : confirmRevoke.email}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmRevoke(null)}
                className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
              >
                {t("app.action.cancel")}
              </button>
              <button
                type="button"
                disabled={revokingId === confirmRevoke.id}
                onClick={() => revokeInvite(confirmRevoke)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {revokingId === confirmRevoke.id
                  ? t("app.setTeam.cancellingInvite", "Cancelling...")
                  : t("app.setTeam.confirmCancelInvite", "Cancel invitation")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
