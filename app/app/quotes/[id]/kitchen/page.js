// app/app/quotes/[id]/kitchen/page.js
//
// Server shell. Fetches the company's brand colour so the drawing is themed
// on the FIRST paint — fetching it client-side would repaint the whole
// designer in front of the user a beat after it appears, which on a
// technical drawing looks like a rendering fault rather than a load.
//
// Also the server-side half of the Kitchen Designer gate. The button that
// links here (app/app/quotes/[id]/page.js) already hides itself when the
// company hasn't turned kitchen_design on and this quote has no design yet
// — but AGENTS.md is explicit that hiding a button is not access control, and
// this route was reachable by URL regardless. See lib/kitchen/access.js.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { canUseKitchenDesigner } from "@/lib/kitchen/access";
import KitchenPage from "./KitchenPage";

export default async function Page({ params }) {
  const { id } = await params;
  const member = await getCurrentMember({ headers: await headers() });
  // No member, no company — the same "not found" a mistyped quote id gets
  // below, rather than a redirect that would need its own auth story.
  if (!member?.companyId) notFound();

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      quoteType: true,
      scopeDetails: true,
      clientKitchenConfig: true,
      scopeGroups: { select: { label: true } },
    },
  });
  if (!quote) notFound();

  const allowed = await canUseKitchenDesigner(quote, member.companyId);
  if (!allowed) notFound();

  let company = null;
  try {
    company = await db.company.findUnique({
      where: { id: member.companyId },
      select: { brandColor: true },
    });
  } catch {
    // A missing brand colour means the designer uses FieldQuo's, which is
    // exactly what an unbranded company gets anyway. Never worth a 500.
  }
  return <KitchenPage company={company} />;
}
