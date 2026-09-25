// app/app/leads/new/page.js
//
// Create › Request lands here: one lead, typed in by hand.
//
// ── A page, not a drawer on the board (?new=1) ──────────────────────────────
//
// The board does have a drawer, but it is a READ-and-work panel over a lead
// that already exists — its whole body hangs off a loaded LeadRequest (score
// reasons, assignee, notes, linked documents). A blank "new" mode inside it
// would be a second component wearing the first one's frame. And every other
// Create row opens a form page (/app/clients/new, /app/jobs/new,
// /app/quotes/new), which is also what scripts/check-mobile-surfaces.mjs
// holds each row to: a real page file. After the save the browser is sent to
// the board WITH the drawer open on the new lead (?lead=<id>), so the person
// still ends up exactly where a board-drawer design would have left them.
//
// ── Why a server shell ──────────────────────────────────────────────────────
//
// Two things are decided here before any form is drawn:
//
//   1. The gate, by the same check POST /api/leads makes — loadEnforceableMember
//      then requests:view_create_edit — so the page and the route cannot
//      disagree. The client-side PermissionProvider falls OPEN when it has no
//      grid (PermissionProvider.js says why), which is the case for a support
//      session's stand-in member; the enforceable member is null there and
//      the route refuses, so the page refuses too rather than offer a form
//      whose Save is a 403. The form asks useHasLevel as well — the same
//      shape as /app/clients/new, and what check:import-gates reads.
//   2. The service list, which is the company's ENABLED services — the same
//      CompanyServiceCategory rows the public self-quote form offers (see
//      app/api/self-quote/[companySlug]/route.js) and the route re-checks.
//      Server-rendered so the picker is complete on first paint, rather than
//      an empty select that reads as "you sell nothing" while a fetch is in
//      flight, and so no new endpoint exists just to list it.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import NewLeadForm from "./NewLeadForm";

export default async function NewLeadPage() {
  const member = await getCurrentMember({ headers: await headers() });
  if (!member?.companyId) notFound();

  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "requests", "view_create_edit")) {
    return <NoAccessPanel capability="accessLevel" />;
  }

  const enabled = await db.companyServiceCategory.findMany({
    where: { companyId: member.companyId, enabled: true },
    select: { category: { select: { id: true, label: true } } },
  });
  const services = enabled
    .map(({ category }) => category)
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));

  return <NewLeadForm services={services} />;
}
