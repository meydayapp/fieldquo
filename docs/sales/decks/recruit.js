// docs/sales/decks/recruit.js
//
// The deck you put in front of somebody you are trying to hire.
//
// ══ Why it is separate from How-you-get-paid ══════════════════════════════
//
// That deck explains a compensation plan to somebody who has already said yes.
// This one is read by somebody deciding whether to say yes at all, and the two
// audiences want opposite things first: a candidate wants to know what the work
// IS and whether the money is real before any milestone arithmetic, and a rep
// on payroll wants the arithmetic. Merging them produces a deck that opens with
// a payout table for a stranger.
//
//   node recruit.js       (needs pptxgenjs on NODE_PATH)
const pptxgen = require("pptxgenjs");

const NAVY = "1E2761";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const INK = "1B1B1F";
const MUTED = "5A6070";
const GOLD = "C8A44D";
const CARD = "F4F6FB";

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
const M = 0.8;

function heading(s, text, sub) {
  s.addText(text, {
    x: M, y: 0.85, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 32, bold: true, color: NAVY,
  });
  if (sub) {
    s.addText(sub, {
      x: M, y: 1.65, w: 11.7, h: 0.6, isTextBox: true,
      fontFace: "Calibri", fontSize: 15, color: MUTED,
    });
  }
}

function rows(s, list, startY, labelW) {
  let y = startY;
  list.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.92, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.08, w: labelW, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + labelW + 0.5, y: y + 0.08, w: 11.2 - labelW - 0.5, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED, valign: "middle",
    });
    y += 1.05;
  });
  return y;
}

// ── Title ───────────────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Sell FieldQuo", {
    x: M, y: 2.0, w: 11.7, h: 1.1, isTextBox: true,
    fontFace: "Cambria", fontSize: 52, bold: true, color: WHITE,
  });
  s.addText("Phone contractors. Show them software that wins them work. Get paid when they stay.", {
    x: M, y: 3.15, w: 11.0, h: 0.7, isTextBox: true,
    fontFace: "Calibri", fontSize: 19, color: ICE,
  });
  s.addText("What the job is, what you earn, and how the first month actually goes.", {
    x: M, y: 4.2, w: 11.0, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 16, italic: true, color: GOLD,
  });
  s.addNotes("Fifteen minutes. Do not open with the commission table — open with what the work is.");
}

// ── What the job is ─────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "What the job actually is", "Outbound, by phone, to small contractors — painters, cabinet makers, roofers, landscapers");
  rows(s, [
    ["You do NOT find the leads", "FieldQuo's own pipeline finds contractors, reads their website and writes you a brief before you dial. You are not scraping directories at 7am."],
    ["One at a time", "You claim a prospect and it is yours. No two reps phone the same business — that is enforced by the product, not by goodwill."],
    ["You know why you are calling", "Every prospect arrives with what they are missing: no online booking, no way to quote, no reviews. You open with their problem, not a script."],
    ["Phone and text, from your own number", "Your number. They ring it back, it reaches you."],
  ], 2.35, 3.4);
  s.addNotes("The strongest thing about this role is that the research is done. Say it early — every rep they have been has had to prospect cold.");
}

// ── The money ───────────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("What you earn", {
    x: M, y: 0.9, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  s.addText("Paid in three stages, because a signup that never pays is not a sale.", {
    x: M, y: 1.72, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 16, color: ICE,
  });

  const stages = [
    { big: "$20", cap: "Activation", body: "They finish payment setup." },
    { big: "$40", cap: "First cycle", body: "Their first real payment succeeds." },
    { big: "$65", cap: "Retention", body: "Still subscribed 60 days after signing up." },
  ];
  let x = M;
  stages.forEach((c) => {
    s.addShape(p.ShapeType.rect, { x, y: 2.5, w: 3.7, h: 2.35, fill: { color: "27346B" } });
    s.addText(c.big, {
      x: x + 0.3, y: 2.75, w: 3.1, h: 0.9, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 44, bold: true, color: GOLD,
    });
    s.addText(c.cap, {
      x: x + 0.3, y: 3.65, w: 3.1, h: 0.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, bold: true, color: WHITE, charSpacing: 1,
    });
    s.addText(c.body, {
      x: x + 0.3, y: 4.05, w: 3.1, h: 0.6, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: ICE,
    });
    x += 4.0;
  });

  s.addText("$125 per contractor who stays. Nothing is clawed back once a stage is paid.", {
    x: M, y: 5.15, w: 11.7, h: 0.6, isTextBox: true,
    fontFace: "Cambria", fontSize: 22, bold: true, color: WHITE,
  });
  s.addText("The third stage is the one worth reading twice: it pays you for selling to somebody who needed it, rather than for closing anybody who answers.", {
    x: M, y: 5.8, w: 11.7, h: 0.7, isTextBox: true,
    fontFace: "Calibri", fontSize: 14, color: ICE,
  });
  s.addNotes("Do not promise a monthly figure. Give the per-contractor number and let them do their own arithmetic against their own closing rate.");
}

// ── What it builds to ───────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "What it builds to", "Your own honest arithmetic — not a promise, and not a best case");
  rows(s, [
    ["It is per contractor", "$125 for one who stays. Two a week is $1,000 a month; one a day, five days a week, is around $2,500."],
    ["The 60-day stage lags", "Month one pays activation and first cycles only. The retention money for month one arrives in month three."],
    ["Month three is when you are whole", "By then all three stages are landing together. Plan your first two months around that, not around a headline number."],
    ["Nothing is clawed back", "If a contractor cancels in month four, the three stages you were already paid stay paid."],
  ], 2.35, 3.9);
  s.addText("If somebody quotes you a monthly income before you have made a call, they are selling you something.", {
    x: M, y: 6.15, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 15, italic: true, color: INK,
  });
  s.addNotes("Being straight about the month-three lag is what stops a good rep quitting in week six.");
}

// ── How you are engaged ─────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "How you are engaged, and how you are paid", "Settled before you start, not after your first close");
  rows(s, [
    ["Freelancer or employee", "FieldQuo decides which, and says so before you start. A freelancer invoices and accrues no paid leave; an employee is on payroll and does."],
    ["You choose the destination", "Upwork, PayPal, Interac e-Transfer or a bank transfer. You set it yourself in the portal on day one."],
    ["Weekly", "Milestones are released as they are earned, not batched to a month end."],
    ["You can see the ledger", "Every stage that has paid, and every one still pending, is on your own screen. You never have to ask what you are owed."],
  ], 2.35, 3.9);
  s.addNotes("If they ask which one they will be, answer it in the interview. Leaving it open is what creates a classification argument later.");
}

// ── The first week ──────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Your first week", {
    x: M, y: 0.9, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  const steps = [
    "Accept the invite, sign in, set your pay details",
    "Read the SOP and the objection library — once, properly",
    "Claim one prospect, read all four research layers, and call",
    "Sit in on two calls, then take twenty of your own",
    "Review what was said with the team, and adjust",
  ];
  let y = 2.2;
  steps.forEach((t, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y: y - 0.02, w: 0.44, h: 0.44, fill: { color: GOLD } });
    s.addText(String(i + 1), {
      x: M, y: y - 0.02, w: 0.44, h: 0.44, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, align: "center", valign: "middle",
    });
    s.addText(t, {
      x: M + 0.72, y, w: 10.8, h: 0.44, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 17, color: WHITE, valign: "middle",
    });
    y += 0.8;
  });
  s.addText("Nobody is asked to sell on day one. You are asked to listen on day one.", {
    x: M, y: 6.2, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 17, italic: true, color: ICE,
  });
  s.addNotes("Close on this slide. Hand them the SOP deck and the written SOP as the next thing they read.");
}

p.writeFile({ fileName: "Sell-FieldQuo-recruitment.pptx" }).then((f) => console.log("wrote", f));
