// app/app/quotes/[id]/kitchen/page.js
//
// Server shell. Its only job is to fetch the company's brand colour so the
// drawing is themed on the FIRST paint — fetching it client-side would repaint
// the whole designer in front of the user a beat after it appears, which on a
// technical drawing looks like a rendering fault rather than a load.
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import KitchenPage from "./KitchenPage";

export default async function Page() {
  let company = null;
  try {
    const member = await getCurrentMember({ headers: await headers() });
    if (member?.companyId) {
      company = await db.company.findUnique({
        where: { id: member.companyId },
        select: { brandColor: true },
      });
    }
  } catch {
    // A missing brand colour means the designer uses FieldQuo's, which is
    // exactly what an unbranded company gets anyway. Never worth a 500.
  }
  return <KitchenPage company={company} />;
}
