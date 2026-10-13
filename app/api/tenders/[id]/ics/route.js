// app/api/tenders/[id]/ics/route.js
//
// GET ?lang=xx — the tender's closing, Q&A deadline and site visit as an
// .ics file for the member's own calendar. See lib/tenders/ics.js for why a
// download rather than the company's shared calendar. Read rung only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requireTenderRead } from "@/lib/tenders/access";
import { tenderCalendar } from "@/lib/tenders/ics";
import { gateMember, findTender } from "@/lib/tenders/server";

const LANG = /^[a-z]{2}$/;

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireTenderRead);
  if (gate.response) return gate.response;

  const found = await findTender(db, member.companyId, id);
  if (found.response) return found.response;

  const asked = new URL(request.url).searchParams.get("lang") || "en";
  const language = LANG.test(asked) ? asked : "en";
  // The catalogue itself, imported lazily (it is large and only this GET
  // needs it). Not lib/notify/push's appSentence: that module carries the
  // Web Push sender, and nothing on a tender route should reach a sender.
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  const word = async (key) => {
    const v = APP_MESSAGES[language]?.[key] ?? APP_MESSAGES.en[key];
    return typeof v === "string" ? v : "";
  };
  const words = {
    closing: await word("app.tenders.ics.closing"),
    questions: await word("app.tenders.ics.questions"),
    siteVisit: await word("app.tenders.ics.siteVisit"),
    siteVisitMandatory: await word("app.tenders.ics.siteVisitMandatory"),
    dateOnly: await word("app.tenders.ics.dateOnly"),
  };
  const body = tenderCalendar(found.tender, words, new Date());
  const name = (found.tender.solicitationNumber || "tender").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) || "tender";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
