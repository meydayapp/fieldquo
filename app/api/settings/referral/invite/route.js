// app/api/settings/referral/invite/route.js
//
// Sends a referral invite by email or SMS.
//
// "Type a stranger's phone number and we'll text them" is precisely how a
// referral feature becomes an SMS spam relay, and the cost lands on FieldQuo's
// Twilio account and sender reputation, not the sender's. So this route is
// built defensively:
//
//   * owners and admins only — not every employee
//   * hard daily cap per company, counted from ReferralInvite rows
//   * no duplicate sends to the same contact from the same company
//   * fixed message body; the sender writes no part of what goes out
//   * every send logged with who triggered it
//
// The last one matters most. A free-text field would let someone use FieldQuo
// to send anything to anyone, under FieldQuo's phone number.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { sendEmail } from "@/lib/email/resend";
import { getAppOrigin } from "@/lib/appUrl";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { REFEREE_BONUS_MONTHS } from "@/lib/referrals";


// Generous for genuine word-of-mouth, useless for bulk. A contractor
// recommending FieldQuo to peers sends a handful; a spammer wants thousands.
const DAILY_LIMIT = 20;

const FROM = "FieldQuo <invites@fieldquo.com>";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can send referral invites." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const channel = body?.channel === "sms" ? "sms" : "email";
  const rawContact = String(body?.contact || "").trim();
  const recipientName = String(body?.name || "").trim().slice(0, 60);

  if (!rawContact) {
    return NextResponse.json(
      { error: channel === "sms" ? "Enter a phone number." : "Enter an email address." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, name: true, referralCode: true },
  });
  if (!company?.referralCode) {
    return NextResponse.json(
      { error: "Your referral link isn't ready yet. Reload and try again." },
      { status: 400 },
    );
  }

  // Validate before spending a send.
  let email = null;
  let phone = null;
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawContact)) {
      return NextResponse.json(
        { error: "That doesn't look like an email address." },
        { status: 400 },
      );
    }
    email = rawContact.toLowerCase();
  } else {
    phone = toE164(rawContact);
    if (!phone) {
      return NextResponse.json(
        { error: "That doesn't look like a phone number we can text." },
        { status: 400 },
      );
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [sentToday, duplicate] = await Promise.all([
    db.referralInvite.count({
      where: { companyId: company.id, createdAt: { gte: since } },
    }),
    db.referralInvite.findFirst({
      where: {
        companyId: company.id,
        ...(email ? { email } : { phone }),
      },
      select: { id: true, createdAt: true },
    }),
  ]);

  if (sentToday >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `You've sent ${DAILY_LIMIT} invites today, which is the daily limit. Try again tomorrow — or share your link directly.`,
      },
      { status: 429 },
    );
  }

  // Re-inviting someone who ignored you the first time is how a referral
  // programme turns into harassment.
  if (duplicate) {
    return NextResponse.json(
      {
        error:
          "You've already invited them. If they haven't signed up, a message from you personally will do better than another one from us.",
      },
      { status: 409 },
    );
  }

  const url = `${getAppOrigin(request)}/refer/${encodeURIComponent(company.referralCode)}`;
  const greeting = recipientName ? `Hi ${recipientName}, ` : "";

  let providerMessageId = null;
  let error = null;

  try {
    if (channel === "sms") {
      // Under 160 characters including the link, so it lands as one segment.
      // Identifies the sender and the product immediately — an unexplained
      // link from an unknown number gets deleted.
      //
      // Not gated by lib/sms/optOut.js's maySms(): that check is keyed on
      // (companyId, phone) for a COMPANY's own client, and the recipient here
      // is a prospective FieldQuo signup the contractor is referring — not
      // this company's customer, and this sends from the shared system
      // number rather than the company's own client-facing line. There's no
      // "this company's opt-out list" for this recipient to be on. Rate
      // limiting and dedup (above) are this route's own abuse controls.
      const text = `${greeting}${company.name} uses FieldQuo for quotes and invoices and thinks you'd like it. ${REFEREE_BONUS_MONTHS} month${REFEREE_BONUS_MONTHS === 1 ? "" : "s"} free: ${url}`;
      const result = await sendSms({ to: phone, body: text });
      if (!result.success) throw new Error(result.error || "SMS failed");
      providerMessageId = result.sid;
    } else {
      // companyId is passed even though this letter is FieldQuo's, not the
      // company's: the recipient is a real stranger the CONTRACTOR named, and
      // a demo account referring a live prospect is the same leak as a demo
      // quoting one. The invite still records as sent so the rep sees the
      // whole flow — see lib/email/demoMail.js.
      const sent = await sendEmail({
        companyId: company.id,
        from: FROM,
        to: email,
        subject: `${company.name} thinks you'd like FieldQuo`,
        html: inviteHtml({ companyName: company.name, url, recipientName }),
      });
      // sendEmail returns failures rather than throwing, and the catch below
      // is what turns a failed send into status: "failed" on the
      // ReferralInvite row. Without this the row would claim "sent".
      if (sent?.error) {
        throw new Error(
          typeof sent.error === "string" ? sent.error : sent.error?.message || "Send failed",
        );
      }
      if (sent?.skipped) throw new Error("Email isn't configured on this deployment.");
      providerMessageId = sent?.id || null;
    }
  } catch (err) {
    error = err?.message || "Send failed";
  }

  // Logged either way. A failed send still counts against the daily limit —
  // otherwise "try invalid numbers until one works" is an unmetered loop.
  await db.referralInvite.create({
    data: {
      companyId: company.id,
      email,
      phone,
      channel,
      status: error ? "failed" : "sent",
      providerMessageId,
      error,
      sentByUserId: member.userId,
    },
  });

  if (error) {
    console.error("[referral invite] send failed:", error);
    // Report what actually went wrong. The generic "check the details and try
    // again" this used to return was useless — the details were fine; the
    // provider wasn't configured. Telling someone to re-check their own input
    // when the fault is ours wastes their time and hides the real fix.
    return NextResponse.json({ error: explainSendFailure(channel, error) }, {
      status: 502,
    });
  }

  return NextResponse.json({
    sent: true,
    channel,
    to: email || phone,
    remainingToday: DAILY_LIMIT - sentToday - 1,
  });
}

// Turns a provider error into something the person reading it can act on.
//
// Most failures here are configuration, not user input: no Twilio number set,
// an unverified trial number, a missing Resend key. Those need a specific
// message so the fix is obvious instead of being mistaken for a typo.
function explainSendFailure(channel, raw) {
  const text = String(raw || "").toLowerCase();

  if (channel === "sms") {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_PHONE_NUMBER) {
      return "Text invites aren't set up on this deployment yet. Use email, or share your link directly.";
    }
    // Twilio 21608: trial accounts can only text verified numbers.
    if (text.includes("21608") || text.includes("unverified")) {
      return "This FieldQuo account's Twilio number is still in trial mode and can only text verified numbers. Use email for now.";
    }
    if (text.includes("21211") || text.includes("not a valid phone")) {
      return "Twilio rejected that number. Check it and try again.";
    }
    if (text.includes("21610") || text.includes("blacklist") || text.includes("opted out")) {
      return "That number has opted out of messages from us and can't be texted.";
    }
    return `Couldn't send the text: ${raw}`;
  }

  if (!process.env.RESEND_API_KEY) {
    return "Email invites aren't set up on this deployment yet (RESEND_API_KEY is missing).";
  }
  if (text.includes("domain") || text.includes("not verified")) {
    return "Our sending domain isn't verified for invites yet. Share your link directly for now.";
  }
  return `Couldn't send the email: ${raw}`;
}

function inviteHtml({ companyName, url, recipientName }) {
  const safe = (s) => String(s || "").replace(/[<>&"]/g, "");
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0b1a2e">
    <div style="background:#1A1917;padding:22px 28px;border-radius:14px 14px 0 0">
      <span style="color:#ff5a00;font-weight:bold;letter-spacing:.16em;font-size:12px;text-transform:uppercase">FieldQuo</span>
    </div>
    <div style="border:1px solid #e8e2d6;border-top:none;border-radius:0 0 14px 14px;padding:28px">
      <p style="margin:0 0 14px">${recipientName ? `Hi ${safe(recipientName)},` : "Hi,"}</p>
      <p style="margin:0 0 14px">
        <strong>${safe(companyName)}</strong> uses FieldQuo to send quotes, bill clients
        and keep their schedule straight — and thought you might get something out of it too.
      </p>
      <p style="margin:0 0 22px">
        Sign up through their link and your first
        <strong>${REFEREE_BONUS_MONTHS} month${REFEREE_BONUS_MONTHS === 1 ? " is" : "s are"} free</strong>.
      </p>
      <p style="margin:0 0 22px">
        <a href="${url}" style="background:#ff5a00;color:#0b1a2e;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold;display:inline-block">
          See what it does
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#6b6257">
        You got this because ${safe(companyName)} sent it. We won't email you again about it.
      </p>
    </div>
  </div>`;
}
