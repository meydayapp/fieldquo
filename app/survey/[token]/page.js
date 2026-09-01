// app/survey/[token]/page.js
//
// What the client sees when they tap a number in the "how did we do" email.
// Same shape as app/q/[token]/page.js: a server-side existence check so an
// unknown token is a real 404 (not a 200 that a client component then
// explains away), then a client component that does the actual fetch/render.
//
// Outside the app shell on purpose — no nav, no FieldQuo branding. This
// should read as a note from the company that did the work, not from us.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import SurveyForm from "./SurveyForm";

export const metadata = {
  title: "How did we do?",
  // A survey token in a search index would let anyone answer (or re-answer)
  // anyone else's survey who guessed a real URL.
  robots: { index: false, follow: false },
};

export default async function SurveyPage({ params }) {
  const { token } = await params;

  const exists = token
    ? await db.satisfactionResponse.findUnique({
        where: { token },
        select: { id: true },
      })
    : null;
  if (!exists) notFound();

  return <SurveyForm token={token} />;
}
