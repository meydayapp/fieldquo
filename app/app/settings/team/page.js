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
import AccessEditor, {
  emptyPermissionValues,
  presetForValues,
} from "@/app/components/team/AccessEditor";
import { describeAccess } from "@/lib/permissions/accessPresets";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import {
  ROLE_LABELS,
  ROLE_RANK,
  canRevokeAccess,
  tierNote,
  canGrantAccess,
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
  // Workers with no linked login. See the section that renders them.
  const [unlinkedWorkers, setUnlinkedWorkers] = useState([]);
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
    canGrantAccess: false,
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
        r.ok ? r.json() : { assignableRoles: [], canGrantAccess: false },
      ),
      // Worker and Member are separate rosters and they have drifted. A worker
      // with userId: null is schedulable and payable — QA found one sitting in
      // a $232.17 pay-run line — and did not appear on this page at all.
      fetch("/api/workers").then((r) => (r.ok ? r.json() : [])),
    ]).then(([memberData, pendingData, grantData, workerData]) => {
      setMembers(Array.isArray(memberData) ? memberData : []);
      setPending(Array.isArray(pendingData.pending) ? pendingData.pending : []);
      setSeats(pendingData.seats || { used: 0, limit: null });
      setGrants(grantData);
      setUnlinkedWorkers(
        (Array.isArray(workerData) ? workerData : []).filter((w) => !w.userId),
      );
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

  // ── Editing an existing member's access ────────────────────────────────
  //
  // Manage Team could change a member's ROLE and nothing else, so the
  // permission grid was write-once: a "Worker (limited access)" could never
  // become a full-view Worker, a Dispatcher and a Manager were
  // indistinguishable afterwards, and "Custom" was unreachable for anyone
  // already on the team. The New User page offered all of it; this one offered
  // a dropdown with three entries.
  //
  // Same editor component as New User, so the two screens cannot drift again.
  const [editing, setEditing] = useState(null);

  // ── The one list of choices, shared with the New User screen ───────────
  //
  // A "choice" is a preset, Administrator, or Custom. NOT a role: two presets
  // can produce the same role (Worker/Worker-limited are both `employee`,
  // Dispatcher/Manager are both `supervisor`), so a role dropdown could never
  // express what the invite screen offers. That mismatch is exactly what the
  // owner kept running into.
  const CUSTOM = "__custom__";
  const ADMIN = "__admin__";

  function choicesFor(member) {
    const assignable = grants.assignableRoles || [];
    const out = [];

    for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
      if (!assignable.includes(PRESET_TO_ROLE[key])) continue;
      out.push({ value: key, label: preset.label });
    }
    if (assignable.includes("admin")) {
      out.push({ value: ADMIN, label: ROLE_LABELS.admin });
    }
    out.push({ value: CUSTOM, label: t("app.setTeam.customChoice", "Custom…") });

    // Whatever they are RIGHT NOW must be selectable even if this caller
    // couldn't assign it — otherwise the select renders with no valid value
    // and silently shows the first option as though it were the truth.
    const current = currentChoice(member);
    if (!out.some((c) => c.value === current)) {
      out.unshift({
        value: current,
        label:
          current === ADMIN
            ? ROLE_LABELS.admin
            : PERMISSION_PRESETS[current]?.label || accessBadge(member).label,
        disabled: true,
      });
    }
    return out;
  }

  /**
   * What to print on a row this viewer can't edit.
   *
   * It used to be `ROLE_LABELS[member.role]`, which cannot answer the question
   * — two presets share the `supervisor` tier, so every Dispatcher read
   * "Manager" and an owner had no way to tell one from the other. The dropdown
   * one cell over already reverse-matched the grid and got it right; this now
   * asks describeAccess(), the single answer both use.
   *
   * The tooltip carries the TIER as well, because the tier is the thing that
   * gates API routes and it is not 1:1 with what the presets offer. Nothing on
   * this screen used to say either half of that.
   */
  function accessBadge(member) {
    const a = describeAccess(member);
    return {
      label:
        a.kind === "custom" ? t("app.setTeam.customBadge", "Custom") : a.label,
      tier: a.role ? tierNote(a.role) : null,
    };
  }

  /** Which choice describes this member as they stand. */
  function currentChoice(member) {
    if (member.role === "admin" || member.permissions?.isAdministrator === true) {
      return ADMIN;
    }
    const values = { ...emptyPermissionValues(), ...(member.permissions || {}) };
    return presetForValues(values, member.role) || CUSTOM;
  }

  async function applyChoice(member, choice) {
    // Custom is not a thing to apply — it is the door to the grid.
    if (choice === CUSTOM) return openAccess(member);

    const isAdmin = choice === ADMIN;
    const role = isAdmin ? "admin" : PRESET_TO_ROLE[choice];
    const permissions = isAdmin
      ? { isAdministrator: true }
      : { ...emptyPermissionValues(), ...PERMISSION_PRESETS[choice].values };

    setSavingUserId(member.userId);
    setError("");
    try {
      const res = await fetch(`/api/settings/members/${member.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(role !== member.role ? { role } : {}),
          permissions,
        }),
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

  function openAccess(member) {
    const stored = member.permissions || {};
    const isAdmin = stored.isAdministrator === true || member.role === "admin";
    const values = { ...emptyPermissionValues(), ...stored };
    setEditing({
      member,
      isAdministrator: isAdmin,
      // Which preset this grid corresponds to, so the panel opens showing
      // "Dispatcher" for someone created as one — the question the owner was
      // actually asking. Null means genuinely custom.
      preset: presetForValues(values, member.role),
      values,
    });
  }

  async function saveAccess() {
    if (!editing) return;
    const { member, isAdministrator, values } = editing;
    setSavingUserId(member.userId);
    setError("");
    try {
      // Role follows the preset, exactly as it does on create — the preset IS
      // a role plus a grid, and letting the two disagree is what produced a
      // "Manager" holding admin.
      const role = isAdministrator
        ? "admin"
        : PRESET_TO_ROLE[editing.preset] || member.role;
      const res = await fetch(`/api/settings/members/${member.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(role !== member.role ? { role } : {}),
          permissions: isAdministrator ? { isAdministrator: true } : values,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.setTeam.errRole"));
      setEditing(null);
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
  // Two rules, and both have to hold. Rank stops a Manager re-grading someone
  // senior; canGrantAccess stops a supervisor re-grading anyone at all — see
  // lib/permissions/roleManagement.js for why that is the owner's call. Same
  // shape as canToggleActive below, because it is the same kind of authority.
  function canEdit(member) {
    if (!canGrantAccess(grants.yourRole)) return false;
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

      {/* ── Tabs only for pages this person can open ────────────────────────
          Workers and Payroll both refuse anyone without payroll access, and
          the settings sidebar already hides them correctly — this row did not,
          so a Manager saw two tabs that answered "Not available to your
          account". A link to a refusal is a dead control with extra steps. */}
      <div className="flex gap-2 text-sm">
        {access.canSee("payroll") && (
          <Link
            href="/app/settings/team/workers"
            className="border border-border rounded-full px-4 py-2"
          >
            {t("app.setTeam.workers")}
          </Link>
        )}
        <Link
          href="/app/settings/team/timesheets"
          className="border border-border rounded-full px-4 py-2"
        >
          {t("app.nav.timesheets")}
        </Link>
        {access.canSee("payroll") && (
          <Link
            href="/app/settings/team/payroll"
            className="border border-border rounded-full px-4 py-2"
          >
            {t("app.nav.payroll")}
          </Link>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        {/* ── Why "last login" hides first ────────────────────────────────
            Below ~1250px this table scrolled sideways and cut off ACTIVE — the
            last column, and the one a manager came here to click. A control
            you have to discover a horizontal scrollbar to reach is a control
            most people won't find.
            Last login is the only column here nobody acts on, so it is the one
            that gives way. Dropping a column beats a scrollbar hiding the
            checkbox. */}
        <div className="grid grid-cols-[1fr_auto_auto] lg:grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-[420px]">
          <span>{t("app.setTeam.nameEmail")}</span>
          <span>{t("app.setTeam.role")}</span>
          <span className="hidden lg:inline">{t("app.setTeam.lastLogin")}</span>
          <span>{t("app.status.active")}</span>
        </div>

        <div className="divide-y divide-border min-w-[420px]">
          {members.map((m) => (
            <div
              key={m.userId}
              className="grid grid-cols-[1fr_auto_auto] lg:grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 items-center"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {m.user.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
              </div>

              {/* Read-only badge when this member is at or above the viewer's
                  rank — including their own row. Showing a dropdown that then
                  403s is worse than showing none.
                  The label comes from the same grid the dropdown reads, not
                  from the role enum — see accessBadge above. */}
              {!canEdit(m) ? (
                <span
                  className="text-xs bg-muted px-2.5 py-1 rounded-full w-fit"
                  title={[
                    !canGrantAccess(grants.yourRole)
                      ? t("app.setTeam.accessOwnerOnlyHint")
                      : m.role === "owner"
                        ? t("app.setTeam.ownerChangeHint")
                        : t("app.setTeam.roleBelowHint"),
                    accessBadge(m).tier,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  {accessBadge(m).label}
                </span>
              ) : (
                /* ── One control, offering exactly what New User offers ─────
                   This used to be a three-entry ROLE dropdown sitting next to
                   a separate "Edit access" link — two controls for one
                   concept, and neither matched the five presets on the invite
                   screen. The owner asked twice why the two screens disagreed;
                   the answer was that this one was listing tiers while the
                   other listed presets.
                   Same list now: the presets, Administrator, and Custom…,
                   which opens the full grid. Picking a preset applies its role
                   AND its permissions in one go, exactly as creating someone
                   with it does. */
                <select
                  value={currentChoice(m)}
                  disabled={savingUserId === m.userId}
                  onChange={(e) => applyChoice(m, e.target.value)}
                  className="text-xs border border-border rounded-full px-2.5 py-1 bg-card"
                >
                  {choicesFor(m).map((c) => (
                    <option key={c.value} value={c.value} disabled={c.disabled}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Hidden with its header below lg — see the note above. */}
              <span className="hidden lg:flex text-xs text-muted-foreground items-center gap-1 whitespace-nowrap">
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
              className="grid grid-cols-[1fr_auto_auto] lg:grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 items-center bg-muted/60"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {p.name || p.email}
                </div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </div>
              {/* The ROLE column showed only "Invited", so an owner scanning
                  this page could not tell an Administrator invite from a
                  Worker one — which removed their last chance to catch a
                  queued escalation before it was accepted. The role check on
                  create closes that door; showing the role is the defence in
                  depth behind it. */}
              <span className="flex items-center gap-1.5 w-fit flex-wrap">
                <span className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Mail size={11} /> {t("app.setTeam.invited")}
                </span>
                {p.role && (
                  <span
                    className="text-xs text-muted-foreground"
                    title={tierNote(p.role)}
                  >
                    {/* Same derivation as an accepted member. A caller without
                        user:view gets no grid in this payload (the invite form
                        captures pay rate and permissions, and neither is
                        theirs to read), so for them this falls back to the
                        tier — which the tooltip then names as a tier. */}
                    {accessBadge(p).label}
                  </span>
                )}
              </span>
              {/* The pending row's last-login cell. Hidden with the column
                  itself below lg, or the grid would be one cell out of step
                  with the member rows above it. */}
              <span className="hidden lg:inline text-xs text-muted-foreground">—</span>
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

      {/* ── People on the books with no login ───────────────────────────────
          Worker and Member are separate rosters, and they drift: a worker
          created without a linked user is selectable in the shift scheduler
          and the timesheet form, and gets paid — QA found one carrying a
          $232.17 pay-run line — while being completely absent from this page.
          A manager could schedule and pay someone they could not see.
          Listed read-only. There is no role and no access to toggle, because
          there is no login; that is the whole point, and inventing controls
          for it would be worse than the omission. */}
      {unlinkedWorkers.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {t("app.setTeam.noLoginTitle", "On the payroll, no login")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                "app.setTeam.noLoginBody",
                "They can be scheduled and paid, but they can't sign in. Manage them under Workers.",
              )}
            </p>
          </div>
          <div className="divide-y divide-border">
            {unlinkedWorkers.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {w.name}
                  </div>
                  {w.email && (
                    <div className="text-xs text-muted-foreground truncate">
                      {w.email}
                    </div>
                  )}
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
                  {t("app.setTeam.noLoginBadge", "No login")}
                </span>
              </div>
            ))}
          </div>
          {/* Workers is a payroll page now, so this link is only offered to
              someone who can open it — otherwise the section would point at a
              refusal, which is the same dead-control shape as the tab row
              above. The list itself stays visible: knowing WHO is on the books
              is roster information; their pay rate is not. */}
          {access.canSee("payroll") && (
            <div className="px-5 py-3 border-t border-border">
              <Link
                href="/app/settings/team/workers"
                className="text-sm font-medium underline underline-offset-2"
              >
                {t("app.setTeam.openWorkers", "Open Workers")}
              </Link>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("app.setTeam.ownerNote")}
      </p>

      {/* ── Edit access ──────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
          <div className="bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl my-0 sm:my-8 max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border sticky top-0 bg-card">
              <h2 className="font-semibold text-foreground">
                {t("app.setTeam.editAccessTitle", "Access for {name}", {
                  name: editing.member.user?.name || editing.member.user?.email,
                })}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "app.setTeam.editAccessBody",
                  "Pick a starting point, then change anything you like. They keep the same login.",
                )}
              </p>
            </div>

            <div className="p-5">
              <AccessEditor
                grants={grants}
                t={t}
                isAdministrator={editing.isAdministrator}
                onAdministratorChange={(v) =>
                  setEditing((e) => ({ ...e, isAdministrator: v }))
                }
                activePreset={editing.preset}
                onPresetChange={(key) =>
                  setEditing((e) => ({
                    ...e,
                    preset: key,
                    // Choosing a preset replaces the grid; choosing Custom
                    // keeps whatever is there, because "custom" describes the
                    // dials you already set rather than a set of its own.
                    values: key
                      ? { ...emptyPermissionValues(), ...PERMISSION_PRESETS[key].values }
                      : e.values,
                  }))
                }
                values={editing.values}
                onValueChange={(key, value) =>
                  setEditing((e) => ({
                    ...e,
                    // Touching any dial means this is no longer that preset.
                    preset: null,
                    values: { ...e.values, [key]: value },
                  }))
                }
              />
            </div>

            <div className="px-5 py-4 border-t border-border flex gap-3 sticky bottom-0 bg-card">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                {t("app.common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={saveAccess}
                disabled={savingUserId === editing.member.userId}
                className="flex-1 bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {t("app.common.save", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

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
