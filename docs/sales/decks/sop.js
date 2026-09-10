// The rep SOP as a meeting deck. Content is lifted from docs/sales/SOP.md —
// nothing here claims a capability the software does not have.
const pptxgen = require("pptxgenjs");

const NAVY = "1E2761";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const INK = "1B1B1F";
const MUTED = "5A6070";
const GOLD = "C8A44D";
const CARD = "F4F6FB";
const RED = "8C2F39";

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "FieldQuo";
p.title = "How you work — sales rep SOP";

const M = 0.8;

function heading(s, text, sub) {
  s.addText(text, {
    x: M, y: 0.55, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 36, bold: true, color: NAVY,
  });
  if (sub) {
    s.addText(sub, {
      x: M, y: 1.32, w: 11.7, h: 0.45, isTextBox: true,
      fontFace: "Calibri", fontSize: 15, color: MUTED,
    });
  }
}

// 1 — title
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("How you work", {
    x: M, y: 2.3, w: 9.5, h: 1.1, isTextBox: true,
    fontFace: "Cambria", fontSize: 54, bold: true, color: WHITE,
  });
  s.addText("The rep's standard operating procedure, in one sitting", {
    x: M, y: 3.5, w: 9.5, h: 0.6, isTextBox: true,
    fontFace: "Calibri", fontSize: 20, color: ICE,
  });
  s.addText("Keep the full SOP open on your second screen. This is the shape of it.", {
    x: M, y: 4.5, w: 9.5, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 14, italic: true, color: ICE,
  });
  s.addNotes("Twenty minutes. The written SOP is the reference; this is the orientation.");
}

// 2 — five rules
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Five rules that are not negotiable", "These are enforced in code, not by trust. You cannot breach them by accident.");

  const rules = [
    ["You cannot write to your own commission", "Attribution, payouts and subscriptions refuse every write from a rep account. You cannot pay yourself and you cannot correct your own record. This protects you as much as us."],
    ["An opt-out is final", "Once somebody says stop, only a superadmin can lift it, with a written reason."],
    ["You cannot self-attribute", "If your email matches the company, or you are a member of it, the system refuses before it checks anything else."],
    ["Every note you write is readable", "Superadmins can read all of it, and the screen says so. There is no private space in the portal."],
    ["The prospect's rules govern", "Whichever country the prospect is in decides what is legal — not where you are sitting."],
  ];

  let y = 1.95;
  rules.forEach((r, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y: y + 0.02, w: 0.4, h: 0.4, fill: { color: i === 0 ? RED : NAVY } });
    s.addText(String(i + 1), {
      x: M, y: y + 0.02, w: 0.4, h: 0.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle",
    });
    s.addText(r[0], {
      x: M + 0.62, y, w: 11.1, h: 0.34, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 17, bold: true, color: INK,
    });
    s.addText(r[1], {
      x: M + 0.62, y: y + 0.34, w: 11.1, h: 0.5, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, color: MUTED,
    });
    y += 0.94;
  });
  s.addNotes("Rule 1 is the one reps care about once they understand it: nobody can quietly adjust their commission either.");
}

// 3 — the five screens
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "The five screens you have", "That is the whole product from your side.");

  const screens = [
    ["/sales", "Read only", "Your companies, their signup date, subscription status and milestone pills. No button here writes anything."],
    ["/sales/queue", "Claim and call", "Claim prospects, read the research, call, then mark worked, release, or do-not-contact."],
    ["/sales/leads", "Work a lead", "Add and work leads. Compose and send email. Text your signup link."],
    ["/sales/threads", "Conversations", "Read and reply."],
    ["/sales/notes", "Your notes", "Autosaves. Archive only — nothing deletes."],
  ];

  let y = 2.0;
  screens.forEach((sc, i) => {
    s.addShape(p.ShapeType.roundRect, {
      x: M, y, w: 11.7, h: 0.82, rectRadius: 0.1,
      fill: { color: i % 2 === 0 ? CARD : WHITE },
    });
    s.addText(sc[0], {
      x: M + 0.28, y, w: 2.5, h: 0.82, isTextBox: true, margin: 0,
      fontFace: "Courier New", fontSize: 15, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(sc[1], {
      x: M + 2.85, y, w: 2.1, h: 0.82, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: GOLD, valign: "middle",
    });
    s.addText(sc[2], {
      x: M + 5.0, y, w: 6.4, h: 0.82, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, color: MUTED, valign: "middle",
    });
    y += 0.9;
  });
  s.addNotes("Point out that /sales is deliberately read-only — it is the screen they will check most and it cannot be broken.");
}

// 4 — the queue
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Working the queue", "Claim before you call. Always.");

  const cards = [
    { big: "39", cap: "trades in the picker", body: "Pick a trade, then press Claim the next one." },
    { big: "48h", cap: "before a claim lapses", body: "If you do not work it, the prospect returns to the pool for somebody else." },
    { big: "0", cap: "prospects you can browse", body: "You get a count per trade, never a list. A count is not a list — it stops one rep claiming two hundred and calling nine." },
  ];

  let x = M;
  const cw = 3.7, gap = 0.4;
  cards.forEach((c) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.0, w: cw, h: 2.6, rectRadius: 0.14, fill: { color: CARD } });
    s.addText(c.big, {
      x: x + 0.32, y: 2.18, w: cw - 0.64, h: 0.9, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 46, bold: true, color: NAVY,
    });
    s.addText(c.cap, {
      x: x + 0.32, y: 3.05, w: cw - 0.64, h: 0.35, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: GOLD,
    });
    s.addText(c.body, {
      x: x + 0.32, y: 3.45, w: cw - 0.64, h: 1.0, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, color: MUTED,
    });
    x += cw + gap;
  });

  s.addText("You cannot trigger discovery. It runs on a schedule. If a trade is empty, the screen tells you which of three reasons applies.", {
    x: M, y: 4.95, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, italic: true, color: NAVY,
  });
  s.addNotes("The 48-hour lapse is the answer to 'how locked are leads' — nothing sits reserved by someone not working it.");
}

// 5 — three layers
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Read the three layers. Keep them separate.", {
    x: M, y: 0.7, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 36, bold: true, color: WHITE,
  });
  s.addText("The research screen never merges fact with guesswork. Neither should you on a call.", {
    x: M, y: 1.5, w: 11.7, h: 0.45, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, color: ICE,
  });

  const layers = [
    ["What we observed", "Fact. A crawler actually saw it.", "Safe to state directly."],
    ["What we infer", "Inference, with a confidence.", "Say it as a question, never a claim."],
    ["What to pitch", "A recommendation.", "A suggestion, not a script."],
    ["What we do not know", "Named gaps.", "Ask about these."],
  ];

  let y = 2.25;
  layers.forEach((l) => {
    s.addShape(p.ShapeType.roundRect, { x: M, y, w: 11.7, h: 0.78, rectRadius: 0.1, fill: { color: "2A3A78" } });
    s.addText(l[0], {
      x: M + 0.3, y, w: 3.1, h: 0.78, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 16, bold: true, color: GOLD, valign: "middle",
    });
    s.addText(l[1], {
      x: M + 3.5, y, w: 3.8, h: 0.78, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: WHITE, valign: "middle",
    });
    s.addText(l[2], {
      x: M + 7.5, y, w: 4.0, h: 0.78, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: ICE, valign: "middle",
    });
    y += 0.88;
  });

  s.addText("If a confidence is missing, the screen refuses to make the claim. Do not repair it by guessing.", {
    x: M, y: 6.0, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 18, italic: true, color: WHITE,
  });
  s.addNotes("This is the slide that keeps a rep out of trouble on a call. Fact, inference, recommendation — never blended.");
}

// 6 — three inversions
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Three things the research does NOT mean", "Getting these backwards is how a call goes wrong in the first ten seconds.");

  const inv = [
    ["A website that will not load", "is not a business without a website"],
    ["A page with no links", "is not proof they offer nothing — it is usually a site our crawler cannot read"],
    ["“We could not look today”", "never overwrites what we saw last week"],
  ];

  let y = 2.15;
  inv.forEach((r) => {
    s.addShape(p.ShapeType.roundRect, { x: M, y, w: 11.7, h: 1.05, rectRadius: 0.12, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.35, y: y + 0.06, w: 4.6, h: 0.9, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 17, bold: true, color: RED, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 5.1, y: y + 0.06, w: 6.3, h: 0.9, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, color: INK, valign: "middle",
    });
    y += 1.25;
  });

  s.addText("A capability marked false is a real observation. Null means we did not find out — they are not the same thing.", {
    x: M, y: 5.95, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, italic: true, color: NAVY,
  });
  s.addNotes("Absence of a statement is not a statement. This is the single most common way a rep says something untrue without meaning to.");
}

// 6b — the calling window (the compliance slide)
{
  const s = p.addSlide();
  s.background = { color: RED };
  s.addText("The calling window is on you", {
    x: M, y: 0.7, w: 11.7, h: 0.85, isTextBox: true,
    fontFace: "Cambria", fontSize: 38, bold: true, color: WHITE,
  });
  s.addText("The software will let you dial at 3 a.m. their time. It does not stop you. This is the single largest compliance exposure in your job.", {
    x: M, y: 1.55, w: 11.7, h: 0.55, isTextBox: true,
    fontFace: "Calibri", fontSize: 16, color: "F6DADA",
  });

  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.35, w: 5.6, h: 1.9, rectRadius: 0.14, fill: { color: WHITE } });
  s.addText([
    { text: "Weekdays\n", options: { fontSize: 15, color: MUTED } },
    { text: "09:00 – 21:30\n", options: { fontSize: 30, bold: true, color: RED, fontFace: "Cambria" } },
    { text: "Weekends  10:00 – 18:00", options: { fontSize: 15, color: MUTED } },
  ], { x: M + 0.35, y: 2.6, w: 5.0, h: 1.5, isTextBox: true, margin: 0, fontFace: "Calibri" });

  s.addShape(p.ShapeType.roundRect, { x: M + 6.1, y: 2.35, w: 5.6, h: 1.9, rectRadius: 0.14, fill: { color: WHITE } });
  s.addText([
    { text: "In the PROSPECT's time zone\n", options: { fontSize: 17, bold: true, color: INK } },
    { text: "Not yours. Check the clock in their zone, every time, before you dial.", options: { fontSize: 14, color: MUTED } },
  ], { x: M + 6.45, y: 2.65, w: 5.0, h: 1.4, isTextBox: true, margin: 0, fontFace: "Calibri" });

  const rules = [
    "Identify yourself and give a callback number on every call. It is required.",
    "A human dials, one call at a time. Never automate it — the US TCPA has no B2B exemption for autodialled calls to mobiles, and small contractors answer on mobiles.",
  ];
  let y = 4.55;
  rules.forEach((r) => {
    s.addText(r, {
      x: M, y, w: 11.7, h: 0.62, isTextBox: true,
      fontFace: "Calibri", fontSize: 15, color: WHITE, bullet: true,
    });
    y += 0.72;
  });
  s.addNotes("Do not soften this slide. The window is documented and not enforced in code — the rep is the control. Say so plainly.");
}

// 6c — closing out a claim
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Closing out a claim", "Three buttons. One of them is permanent.");

  const outs = [
    ["I spoke to them — keep this one", "The claim never lapses. The prospect stays yours.", NAVY],
    ["Put it back in the pool", "Somebody else can claim it. Use this the moment you know you are not working it.", "4A6FA5"],
    ["They asked not to be contacted", "Permanent, and it needs a written reason. Only a superadmin can ever lift it — not you.", RED],
  ];

  let y = 2.1;
  outs.forEach((o) => {
    s.addShape(p.ShapeType.roundRect, { x: M, y, w: 11.7, h: 1.15, rectRadius: 0.12, fill: { color: CARD } });
    s.addShape(p.ShapeType.roundRect, { x: M + 0.3, y: y + 0.3, w: 0.14, h: 0.55, rectRadius: 0.07, fill: { color: o[2] } });
    s.addText(o[0], {
      x: M + 0.65, y: y + 0.16, w: 4.6, h: 0.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 17, bold: true, color: o[2],
    });
    s.addText(o[1], {
      x: M + 0.65, y: y + 0.56, w: 10.6, h: 0.5, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: MUTED,
    });
    y += 1.32;
  });
  s.addNotes("Do-not-contact is the one to slow down on. It binds FieldQuo, not just their own view, and they cannot undo it.");
}

// 6d — two things to expect
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Two things that will surprise you", "Told upfront so you do not think something is broken.");

  const gaps = [
    ["Worked prospects stay in your queue", "Marking one “worked” clears its expiry, and the queue matches on exactly that. So your queue accumulates rather than emptying. That is how it behaves today — it is not a bug you have found."],
    ["Nothing turns a claimed prospect into a lead", "There is no button for it. If you want to email or text somebody you found in the queue, you retype them on the leads screen. Annoying, known, and being fixed."],
  ];

  let y = 2.15;
  gaps.forEach((g) => {
    s.addShape(p.ShapeType.roundRect, { x: M, y, w: 11.7, h: 1.55, rectRadius: 0.14, fill: { color: CARD } });
    s.addText(g[0], {
      x: M + 0.35, y: y + 0.2, w: 11.0, h: 0.42, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 19, bold: true, color: NAVY,
    });
    s.addText(g[1], {
      x: M + 0.35, y: y + 0.64, w: 11.0, h: 0.8, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: MUTED,
    });
    y += 1.8;
  });

  s.addText("You will find others. Tell us — the written SOP records every one of these honestly, and it is kept that way on purpose.", {
    x: M, y: 5.95, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 17, italic: true, color: NAVY,
  });
  s.addNotes("Naming the rough edges in the first meeting buys more trust than pretending the product is finished. They will find them in week one either way.");
}

// 7 — close
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Your first day", {
    x: M, y: 1.4, w: 9.5, h: 0.9, isTextBox: true,
    fontFace: "Cambria", fontSize: 44, bold: true, color: WHITE,
  });

  const steps = [
    "Accept your invite and sign in",
    "Check your signup link works — send it to yourself",
    "Claim one prospect and read all four research layers before dialling",
    "Make your first call, then close the claim out properly",
  ];

  let y = 2.6;
  steps.forEach((t, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y: y - 0.02, w: 0.44, h: 0.44, fill: { color: GOLD } });
    s.addText(String(i + 1), {
      x: M, y: y - 0.02, w: 0.44, h: 0.44, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, align: "center", valign: "middle",
    });
    s.addText(t, {
      x: M + 0.72, y, w: 10.8, h: 0.44, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 18, color: WHITE, valign: "middle",
    });
    y += 0.78;
  });

  s.addText("Everything else is in the written SOP. Keep it open for the first week.", {
    x: M, y: 6.1, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 18, italic: true, color: ICE,
  });
  s.addNotes("End here and hand out the written SOP. Do not try to cover claiming, closing out and lead work in the same meeting.");
}


// ── The calling window ──────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "The calling window is a rule, not a habit", "Read in the prospect's own time zone — never yours");

  const rows = [
    ["08:00 – 21:00", "The window, every day, in the time zone where THEIR phone rings. A prospect in New York is not open because you are."],
    ["The screen refuses", "Outside the window the queue does not offer a dial control. It is not hidden to nag you — pressing it would place a call that breaks the rule."],
    ["It names the reopening", "“The window opens at 08:00 Thu 10 Sept (America/New_York).” Work the ones that are open instead of waiting."],
    ["Do-not-contact wins", "A business that asked us to stop is never dialled, whatever the hour. That flag sits on the business, not on the paperwork."],
  ];
  let y = 2.35;
  rows.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.92, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.08, w: 3.1, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 3.5, y: y + 0.08, w: 7.9, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, color: MUTED, valign: "middle",
    });
    y += 1.05;
  });
  s.addNotes("The window is enforced by the product, so nobody has to remember it. Say plainly that a rep who finds a way around it is creating a legal problem for FieldQuo, not showing initiative.");
}

// ── Placing a call ──────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Placing a call", "Everything happens on one screen. You never leave the record.");

  const steps = [
    ["Claim one", "One at a time. A claim stops every other rep phoning the same business — that is what makes it fair."],
    ["Read all four layers first", "Facts, then what was inferred, then confidence, then the brief. Never repair a missing layer by guessing on the call."],
    ["Press Call", "It rings in your browser. Your own number shows on their handset, so a call back reaches you and not a switchboard."],
    ["Take notes while it is live", "The note box sits beside the dial. Type as close to their words as you can — a note written after the call is a summary of a memory."],
    ["Close the claim out", "Say what happened. An unclosed claim holds a prospect nobody is working."],
  ];
  let y = 2.3;
  steps.forEach((t, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y, w: 0.42, h: 0.42, fill: { color: NAVY } });
    s.addText(String(i + 1), {
      x: M, y, w: 0.42, h: 0.42, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle",
    });
    s.addText(t[0], {
      x: M + 0.68, y: y - 0.04, w: 3.2, h: 0.5, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: INK, valign: "middle",
    });
    s.addText(t[1], {
      x: M + 3.95, y: y - 0.04, w: 7.6, h: 0.5, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED, valign: "middle",
    });
    y += 0.86;
  });
  s.addNotes("Stress the note box. The single biggest difference between reps is whether the next person can pick up the thread six weeks later.");
}

// ── Inbound ─────────────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("When they ring you back", {
    x: M, y: 0.9, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  s.addText("A contractor who calls the number you rang them from reaches YOU first — not a switchboard, not whoever is nearest.", {
    x: M, y: 1.75, w: 11.7, h: 0.6, isTextBox: true,
    fontFace: "Calibri", fontSize: 16, color: ICE,
  });

  const order = [
    ["1", "You", "If the number is assigned to you, it rings you — even mid-call. Your browser decides whether to show it."],
    ["2", "Whoever spoke to them last", "On a shared line the call log already knows who rang that contractor. They get it next."],
    ["3", "Whoever is free", "Longest idle first, so one rep does not take every call while another sits waiting."],
    ["4", "Voicemail", "If nobody picks up they hear who they were trying to reach and can leave a message. Never a silent hang-up."],
  ];
  let y = 2.6;
  order.forEach((o) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.85, fill: { color: "27346B" } });
    s.addText(o[0], {
      x: M + 0.2, y, w: 0.5, h: 0.85, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 22, bold: true, color: GOLD, align: "center", valign: "middle",
    });
    s.addText(o[1], {
      x: M + 0.85, y, w: 3.1, h: 0.85, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: WHITE, valign: "middle",
    });
    s.addText(o[2], {
      x: M + 4.05, y, w: 7.4, h: 0.85, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: ICE, valign: "middle",
    });
    y += 0.98;
  });
  s.addNotes("This is why your own number matters. Tell reps to give out the number the product dialled from, never a personal mobile.");
}

// ── Transfer and queue ──────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Handing a call to somebody else", "Two ways, and the caller is never dropped either way");

  const cards = [
    { big: "Speak first", cap: "Warm transfer", body: "You talk to the other rep privately while the caller waits on hold. Then you put them through. Use it when context has to travel with the call." },
    { big: "Straight through", cap: "Cold transfer", body: "The caller goes to the other rep immediately. Faster, and right when the reason is obvious — wrong trade, wrong province." },
    { big: "Nobody answers", cap: "You get them back", body: "If the person you chose does not pick up, the caller comes back to YOU. They are never quietly dropped into a machine." },
  ];
  let x = M;
  cards.forEach((c) => {
    s.addShape(p.ShapeType.rect, { x, y: 2.35, w: 3.7, h: 3.1, fill: { color: CARD } });
    s.addText(c.big, {
      x: x + 0.3, y: 2.6, w: 3.1, h: 0.6, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 22, bold: true, color: NAVY,
    });
    s.addText(c.cap, {
      x: x + 0.3, y: 3.2, w: 3.1, h: 0.35, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 11, bold: true, color: GOLD, charSpacing: 1,
    });
    s.addText(c.body, {
      x: x + 0.3, y: 3.6, w: 3.1, h: 1.7, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED,
    });
    x += 4.0;
  });
  s.addText("If every rep is busy, the caller is held with a short message between rings — never silence — and goes to voicemail rather than waiting forever.", {
    x: M, y: 5.75, w: 11.7, h: 0.7, isTextBox: true,
    fontFace: "Cambria", fontSize: 16, italic: true, color: INK,
  });
  s.addNotes("Transfer is offered only when the other rep is genuinely reachable — a stale browser is not offered as a target.");
}

// ── Texts ───────────────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Texts", "Your own number, in a thread that looks like your phone");

  const rows = [
    ["Your number is yours", "The number assigned to you sends and receives. A contractor texting it back reaches you."],
    ["Threads, not an inbox", "One conversation per contractor, with the whole history — the same shape as the messaging you already use."],
    ["STOP is honoured instantly", "An opt-out is recorded the moment it arrives and covers every channel. Nothing has to be remembered by you."],
    ["Everything is on the record", "Texts sit against the business, so the next person to speak to them can read what was said."],
  ];
  let y = 2.35;
  rows.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.92, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.08, w: 3.5, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 3.9, y: y + 0.08, w: 7.5, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, color: MUTED, valign: "middle",
    });
    y += 1.05;
  });
  s.addNotes("Texts are a different channel from the email threads beside them: a reply arrives by phone number, not by thread token.");
}

// ── Pay tab ─────────────────────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Your pay details", "The Pay tab — set it on your first day");

  const rows = [
    ["How you want the money", "Upwork, PayPal, Interac e-Transfer or a bank transfer. Each one says its own trade-off before you choose, not after the money arrives short."],
    ["Where it goes", "Your handle or account. A method with no destination is refused rather than saved — half-set reads as done on every other screen."],
    ["When you last confirmed it", "The date is shown, not a tick. An account confirmed two years ago is not the same claim as one confirmed last week."],
    ["Freelancer or employee", "Shown, not chosen. It decides paid leave and what is withheld, so FieldQuo sets it. If it looks wrong, say so and it is corrected."],
  ];
  let y = 2.35;
  rows.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.95, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.08, w: 3.5, h: 0.79, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 3.9, y: y + 0.08, w: 7.5, h: 0.79, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED, valign: "middle",
    });
    y += 1.08;
  });
  s.addNotes("Nobody is paid until this is set. Do it in the first ten minutes of day one.");
}

p.writeFile({ fileName: "How-you-work-SOP.pptx" }).then((f) => console.log("wrote", f));
