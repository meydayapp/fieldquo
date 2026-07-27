// lib/team/reconcilePendingProfile.js
//
// See the long note in schema-additions-team.prisma for why this exists: the
// New User page captures phone/address/labor-cost/permissions before the
// invited person has accepted and gotten a real Member row. This copies any
// matching PendingTeamProfile onto the real Member row once it exists,
// matched by email, and deletes the pending row afterward. Called from
// GET /api/settings/members so it self-heals on the next page load — no
// change needed to however your invite-acceptance flow currently creates
// Member rows.
import { db } from "@/lib/db";

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
        permissions: match.permissions ?? p.permissions,
        invitationLanguage: match.invitationLanguage ?? p.invitationLanguage,
      },
    });

    await db.pendingTeamProfile.delete({ where: { id: p.id } });
  }
}
