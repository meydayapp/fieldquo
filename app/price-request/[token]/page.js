// app/price-request/[token]/page.js
//
// Where a sub lands from a general contractor's price request email
// (lib/subRequests/). Three ways to answer — price it in FieldQuo (signed in,
// or after logging in / creating a free account), reply with a price without
// an account, or decline — on the GC's own colours and name.
//
// ══ What this page may show ════════════════════════════════════════════════
//
// The allow-list and nothing else (lib/subRequests/model.js
// subFacingRequest): the trade, the GC's scope text, the job address, the
// photos the GC ticked, the wanted-by date, the GC's name, logo and contact
// line. The homeowner's name, phone and email are not on a request row, so
// they cannot reach this page.
//
// FieldQuo is named here deliberately — the owner asked for the sub to be
// invited to it; the sub is the GC's supplier, not the homeowner.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { loadRecipientByToken, viewForRecipient } from "@/lib/subRequests/server";
import PriceRequestFlow from "./PriceRequestFlow";

export const metadata = {
  title: "Price request",
  // A token in a search index defeats it — the same rule as /q/<token>.
  robots: { index: false, follow: false },
};

export default async function PriceRequestPage({ params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const r = await loadRecipientByToken(db, String(token || ""));
  if (!r) notFound();
  const gc = r.request.company;
  // The button colour measured against its text (lib/documents/theme.js) —
  // contractors pick yellow, white and mid-grey.
  const fill = fillPair(documentTheme(gc));
  return (
    <PriceRequestFlow
      token={r.token}
      language={resolveClientLanguage({ company: gc })}
      initialView={viewForRecipient(r)}
      fill={{ bg: fill.bg, fg: fill.fg }}
    />
  );
}
