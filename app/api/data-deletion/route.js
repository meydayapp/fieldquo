// app/api/data-deletion/route.js
//
// The form on /data-deletion posts here. Public — a stranger, no session.
//
// What it does, in order, and why the order matters:
//
//   1. Rate-limit, honeypot, body guard, validate. Cheap refusals first, before
//      anything is written or sent. 5 an hour per connection: a real person
//      files one request, maybe two if they mistype the address; a script
//      files hundreds, and every one of them would send two emails.
//   2. Create the DataDeletionRequest row. This is the record the owner works
//      from, so it is written BEFORE the emails: a request that reached the
//      database and whose receipt bounced is a request we still have and will
//      still act on. The reverse — a receipt sent for a row that failed to
//      write — would be a promise about nothing.
//   3. Email the requester the acknowledgement, then FieldQuo's own inbox.
//      Either may fail; neither failure is hidden. The response carries the
//      reference either way and says plainly when the receipt did not go out,
//      so the page can show the code AND the warning. A `{ ok: true }` on a
//      request whose acknowledgement reached nobody is the silent-success
//      failure AGENTS.md is about.
//
// What it does NOT do: delete anything. See lib/dataDeletion/requests.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import {
  generateConfirmationCode,
  isPlausibleEmail,
  cleanText,
  HONEYPOT_FIELD,
} from "@/lib/dataDeletion/requests";
import {
  buildDeletionAcknowledgement,
  buildDeletionNotice,
  sendDataDeletionEmail,
} from "@/lib/email/dataDeletionEmail";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * Creates the row, retrying ONCE on a confirmation-code collision. Six
 * characters over thirty symbols makes a collision a once-in-hundreds-of-
 * millions event; a second collision in a row is a bug, and surfaces as one.
 */
async function createRequest(data) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await db.dataDeletionRequest.create({
        data: { ...data, confirmationCode: generateConfirmationCode() },
      });
    } catch (err) {
      if (err?.code !== "P2002" || attempt === 1) throw err;
    }
  }
  // Unreachable — the loop returns or throws — but a function that can fall
  // off its end returns undefined, and undefined here would be read as a row.
  throw new Error("createRequest: could not allocate a confirmation code");
}

function failureMessage(result) {
  if (result?.skipped) return "email sending is not configured on this server";
  const e = result?.error;
  return typeof e === "string" ? e : e?.message || "the mail provider refused the message";
}

export async function POST(request) {
  const limited = rateLimit(request, "data-deletion", {
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message:
      "Too many requests from this connection. Please wait an hour and try again, " +
      `or email ${SUPPORT_EMAIL} directly.`,
  });
  if (limited) return limited;

  // A truncated or non-JSON body is a 400 with a sentence, not a 500 with a
  // stack — the same guard every other public POST in this repo carries.
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return bad("The request body could not be read. Please try again.");
  }

  // A filled honeypot is answered with a 200 that does nothing, on purpose.
  // A 4xx tells the bot which field tripped it; a silent success tells it
  // nothing and costs us nothing — no row, no mail.
  if (cleanText(body[HONEYPOT_FIELD], 10)) {
    return NextResponse.json({ ok: true, confirmationCode: null });
  }

  const email = String(body.email ?? "").trim();
  if (!isPlausibleEmail(email)) {
    return bad("Enter the email address we should send the confirmation to.");
  }

  const row = await createRequest({
    email,
    name: cleanText(body.name, 200),
    companyName: cleanText(body.companyName, 200),
    message: cleanText(body.message, 4000),
    source: "form",
  });

  // ── The receipt ─────────────────────────────────────────────────────────
  const ack = buildDeletionAcknowledgement(row);
  const ackResult = await sendDataDeletionEmail({ to: row.email, ...ack });
  const ackSent = !ackResult?.error && !ackResult?.skipped;
  if (ackSent) {
    await db.dataDeletionRequest.update({
      where: { id: row.id },
      data: { acknowledgedAt: new Date() },
    });
  } else {
    console.error(
      `[data-deletion] acknowledgement for ${row.confirmationCode} not sent: ${failureMessage(ackResult)}`,
    );
  }

  // ── The notice to us ────────────────────────────────────────────────────
  const notice = buildDeletionNotice(row);
  const noticeResult = await sendDataDeletionEmail({ to: SUPPORT_EMAIL, ...notice });
  const noticeSent = !noticeResult?.error && !noticeResult?.skipped;
  if (!noticeSent) {
    console.error(
      `[data-deletion] internal notice for ${row.confirmationCode} not sent: ${failureMessage(noticeResult)}`,
    );
  }

  return NextResponse.json(
    {
      ok: true,
      confirmationCode: row.confirmationCode,
      receivedAt: row.receivedAt,
      acknowledgementSent: ackSent,
      // Present only when something did not go out. The page renders it
      // beside the reference, so the person leaves with the code AND the
      // knowledge that no email is coming — and the fallback address.
      ...(!ackSent && {
        warning:
          `Your request is recorded under reference ${row.confirmationCode}, but the ` +
          `confirmation email could not be sent (${failureMessage(ackResult)}). ` +
          `Keep the reference, and email ${SUPPORT_EMAIL} if you want it in writing.`,
      }),
    },
    { status: 201 },
  );
}
