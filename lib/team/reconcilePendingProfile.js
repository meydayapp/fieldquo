// lib/team/reconcilePendingProfile.js
//
// See the long note in schema-additions-team.prisma for why this exists: the
// New User page captures phone/address/labor-cost/permissions before the
// invited person has accepted and gotten a real Member row. This copies any
// matching PendingTeamProfile onto the real Member row once it exists,
// matched by email, and deletes the pending row afterward. Called from
// GET /api/settings/members so it self-heals on the next page load.
//
// The ACCEPT route no longer relies on this. It applies the profile — role
// and grid included, replacing what the row held — inside the same
// transaction that admits the member (lib/invitations/acceptMember.js), so a
// leftover pending row for an existing member should not arise any more.
// What this still meets is a row left by the old two-step accept. For those
// the row's own grid wins (an owner may have edited it since — replacing it
// would silently undo that edit), with one exception: a gridded role is
// never left with NO grid, because enforce.js reads none as the whole
// coarse role.
import { db } from "@/lib/db";
import { gridForInvitedRole, hasGrid } from "@/lib/invitations/acceptMember";

export async function reconcilePendingProfiles(companyId) {
  const pending = await db.pendingTeamProfile.findMany({
    where: { companyId },
  });
  if (pending.length === 0) return;

  const members = await db.member.findMany({
    where: { companyId },
    include: { user: { select: { id: true, email: true } } },
  });

  for (const p of pending) {
    const match = members.find(
      (m) => m.user.email?.toLowerCase() === p.email.toLowerCase(),
    );
    if (!match) continue; // invite not accepted yet — leave the pending row alone

    // Don't clobber anything the person may have already set themselves —
    // only fill in fields that are still empty on the real Member row.
    await db.member.update({
      where: { id: match.id },
      data: {
        phone: match.phone ?? p.phone,
        address: match.address ?? p.address,
        city: match.city ?? p.city,
        province: match.province ?? p.province,
        postalCode: match.postalCode ?? p.postalCode,
        country: match.country ?? p.country,
        imageUrl: match.imageUrl ?? p.imageUrl,
        laborCostPerHour: match.laborCostPerHour ?? p.laborCostPerHour,
        permissions: hasGrid(match.permissions)
          ? match.permissions
          : (gridForInvitedRole(match.role, p.permissions) ?? undefined),
        invitationLanguage: match.invitationLanguage ?? p.invitationLanguage,
      },
    });

    await db.pendingTeamProfile.delete({ where: { id: p.id } });
  }
}
