// The rep SOP as a meeting deck. Content is lifted from docs/sales/SOP.md —
// nothing here claims a capability the software does not have.
//
// ══ Where this deck had drifted, corrected 2026-09-10 ══════════════════════
//
// Facts come from the code, not from the prose. Five claims in here were true
// when they were written and are not now, and two slides contradicted each
// other, which is worse than either being wrong alone:
//
//   1. TWO calling-window slides. One said 09:00–21:30 flat and NOT enforced;
//      the other said 08:00–21:00 flat and enforced. Neither is the rule.
//      lib/sales/callingRules.js is a per-jurisdiction table and it IS
//      enforced — dialHref() cannot produce a target from a refusal and
//      app/api/sales/calls re-checks server-side. 08:00–21:00 is the TEXTING
//      window (SALES_SMS_WINDOW). There is one calling slide now, and the
//      second slot carries the two do-not-contact controls instead, which
//      nothing covered.
//   2. "The five screens you have" — there are twelve tabs.
//   3. "Nothing turns a claimed prospect into a lead" — "Work this one as a
//      lead" does, and links the records.
//   4. The texts slide said a rep's own number sends and receives. Texts go
//      from one shared sales-purpose number; CALLS present an area-code match.
//   5. The pay slide was missing Wise, which is the answer for a rep outside
//      Canada.
//
// Voicemail, the second job (check-ins at day 1 and day 7, support, demo) and
// the language honesty had no slide at all and now do.
//
// The slides were also reordered to the sequence a rep actually works — call,
// inbound, transfer, voicemail, then closing out — and the "Your first day"
// close moved to the end, which it was not: it sat in the middle with eight
// slides behind it, so the meeting ended twice.
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

// 2 — the five rules
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Five things you can't get wrong", "Not because we're watching — because the software won't let you. You don't have to memorise any of it.");

  const rules = [
    ["Nobody can touch your commission — including us", "Your attribution and payouts refuse every write from a rep account. That cuts both ways: you can't adjust your own record, and neither can anybody else quietly adjust it for you."],
    ["If somebody says stop, we stop", "A STOP text is recorded the second it lands and covers calls, texts and email — the dial button simply isn't there next time. You don't have to remember who said it. Undoing one takes a superadmin and a written reason, so it never happens by accident."],
    ["You can't accidentally sign up your own company", "If your email matches the company, or you're already a member of it, the system says no before it checks anything else. It saves an awkward conversation three months later."],
    ["Write notes like a colleague will read them", "Because one will. Superadmins can see everything you write, and the screen tells you so rather than letting you find out."],
    ["The prospect's rules win, not yours", "Wherever they are decides what's legal — the hours you may ring, the registrations we need. The screen works it out and just won't offer you the button outside it."],
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
  s.addNotes("Lead with rule 1 — it is the one that lands, because it protects THEM. Do not read these out like a policy; the point of the slide is that nobody has to remember any of it.");
}

// 3 — the tabs
//
// This was "The five screens you have" and there are twelve. Read straight off
// app/sales/SalesShell.js — Voicemail, Support, Pay and Texts are the newest.
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Twelve tabs, and four of them are your morning", "The rest you open when something happens. Nobody learns them all on day one.");

  const tabs = [
    ["Today", "Daily", "One sentence: what to do next. It refuses to guess when a count failed to load."],
    ["Queue", "Daily", "Claim a prospect, read the research, call, close the claim out."],
    ["Leads", "Daily", "Businesses you typed in or carried across. Email and the first text go from here."],
    ["Conversations", "Daily", "Email replies. Somebody is waiting on you."],
    ["Texts", "When it buzzes", "Two-way threads, and your check-in drafts."],
    ["Voicemail", "When it buzzes", "Messages left on the number you rang from."],
    ["Calendar", "When it buzzes", "Your appointments and callbacks."],
    ["My companies", "Weekly", "The contractors you signed up. Your retention book."],
    ["Support", "When it breaks", "Send a technical problem to FieldQuo."],
    ["Notes", "Whenever", "Autosaves. Archive only — nothing deletes."],
    ["Demo", "On a call", "The account you drive in front of a prospect."],
    ["Pay", "Day one, then never", "How you want the money, and your language."],
  ];

  const cw = 2.73;
  tabs.forEach((t, i) => {
    const x = M + (i % 4) * 2.99;
    const y = 2.0 + Math.floor(i / 4) * 1.6;
    s.addShape(p.ShapeType.roundRect, { x, y, w: cw, h: 1.45, rectRadius: 0.1, fill: { color: CARD } });
    s.addText(t[0], {
      x: x + 0.22, y: y + 0.12, w: cw - 0.44, h: 0.32, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY,
    });
    s.addText(t[1], {
      x: x + 0.22, y: y + 0.44, w: cw - 0.44, h: 0.26, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 9.5, bold: true, color: GOLD, charSpacing: 1,
    });
    s.addText(t[2], {
      x: x + 0.22, y: y + 0.72, w: cw - 0.44, h: 0.66, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 10.5, color: MUTED,
    });
  });
  s.addNotes(
    "Read straight off app/sales/SalesShell.js. Say out loud that older material calls this \"the five screens you have\" — " +
    "it is out of date, and Voicemail, Support, Pay and Texts are the new ones.\n\nOn a phone the tabs wrap into rows of " +
    "three rather than scrolling sideways. Tell them the portal is built to work in a phone browser, because they will be " +
    "on one.",
  );
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

// 5 — the three layers
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

// 7 — the calling window
//
// This slide used to be red, headed "The calling window is on you", and it
// said the software would happily let a rep dial at three in the morning. That
// was true when it was written and it is not true now: lib/sales/callingRules.js
// decides, dialHref() cannot produce a dial target from a refusal, and
// app/api/sales/calls/route.js re-checks server-side. It also taught ONE window
// — Canada's — as though it governed everywhere, and there is no single window.
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "The hours you may ring — the screen works them out", "There is no one window. Whose rule applies depends on where THEY are, and it is read on their clock.");

  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.05, w: 5.6, h: 1.75, rectRadius: 0.14, fill: { color: CARD } });
  s.addText([
    { text: "Canada, every province\n", options: { fontSize: 14, color: MUTED } },
    { text: "09:00 – 21:30 weekdays\n", options: { fontSize: 21, bold: true, color: NAVY, fontFace: "Cambria" } },
    { text: "10:00 – 18:00 weekends", options: { fontSize: 16, bold: true, color: NAVY, fontFace: "Cambria" } },
  ], { x: M + 0.32, y: 2.25, w: 5.0, h: 1.4, isTextBox: true, margin: 0, fontFace: "Calibri" });

  s.addShape(p.ShapeType.roundRect, { x: M + 6.1, y: 2.05, w: 5.6, h: 1.75, rectRadius: 0.14, fill: { color: CARD } });
  s.addText([
    { text: "The commonest US state window\n", options: { fontSize: 14, color: MUTED } },
    { text: "08:00 – 21:00\n", options: { fontSize: 21, bold: true, color: NAVY, fontFace: "Cambria" } },
    { text: "Several are narrower. Arizona forbids the call outright. Nevada imposes none, so our own 08:00–20:00 applies — and the screen says it is OUR rule, not the state's.", options: { fontSize: 11.5, color: MUTED } },
  ], { x: M + 6.42, y: 2.25, w: 5.0, h: 1.4, isTextBox: true, margin: 0, fontFace: "Calibri" });

  const rules = [
    ["You do not do this maths", "It reads their country and state, converts to their clock, and decides. Outside the window there is no dial control — not greyed out, gone."],
    ["The server checks again", "Pressing Call re-reads the whole decision from the database, so a screen you left open an hour ago cannot authorise anything."],
    ["Some refusals are honest ignorance", "Two states have not been read to our standard, and an unread rule says “we cannot confirm this is allowed” rather than defaulting to yes."],
    ["Two things it cannot do for you", "Oklahoma and Florida cap you at three calls to one business in 24 hours, and nothing counts them yet. Alabama and Rhode Island also ban holidays."],
  ];
  let y = 4.0;
  rules.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.76, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y, w: 3.4, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 3.8, y, w: 7.6, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12, color: MUTED, valign: "middle",
    });
    y += 0.85;
  });
  s.addNotes(
    "The framing that matters: this is not a rule anybody has to remember, it is a rule you cannot break by accident. A rep " +
    "who finds a way around it is creating a legal problem for FieldQuo, not showing initiative.\n\nIf somebody in the room " +
    "has the old deck or the old SOP, say the correction out loud — it used to teach a flat 09:00-21:30 and it used to say " +
    "the window was not enforced. Both were true once and neither is now.\n\nStill on the rep, and worth saying: identify " +
    "yourself and give a callback number on every call, and a human dials, one call at a time. The US TCPA has no business " +
    "exemption for autodialled calls to mobiles and small contractors answer on mobiles.",
  );
}

// 8 — placing a call
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Placing a call", "Everything happens on one screen. You never leave the record.");

  const steps = [
    ["Claim one", "One at a time. A claim stops every other rep phoning the same business — that is what makes it fair."],
    ["Read all four layers first", "Fact, inference, what to pitch, and what we do not know. Never repair a missing one by guessing on the call."],
    ["Press Call", "It rings in your browser. They see a FieldQuo number matched to their area code, and the screen shows you which."],
    ["Say who you are, and the number", "Required, every call. The screen shows the number being presented so you can read it out."],
    ["Type while they talk", "The note box sits beside the dial, and the playbook beside that. A note written afterwards is a summary of a memory."],
    ["Close the claim out", "Pick what happened from the list. Some choices will not save without the note first."],
  ];
  let y = 2.25;
  steps.forEach((t, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y, w: 0.42, h: 0.42, fill: { color: i === 5 ? GOLD : NAVY } });
    s.addText(String(i + 1), {
      x: M, y, w: 0.42, h: 0.42, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: i === 5 ? NAVY : WHITE, align: "center", valign: "middle",
    });
    s.addText(t[0], {
      x: M + 0.68, y: y - 0.06, w: 3.3, h: 0.55, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: INK, valign: "middle",
    });
    s.addText(t[1], {
      x: M + 4.05, y: y - 0.06, w: 7.45, h: 0.55, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED, valign: "middle",
    });
    y += 0.75;
  });

  s.addText("Ten ways a call can end, and the screen keeps the unfinished one in front of you until you say which it was. Calls are never recorded — that is consent law, not a setting.", {
    x: M, y: 6.55, w: 11.7, h: 0.55, isTextBox: true,
    fontFace: "Cambria", fontSize: 16, italic: true, color: NAVY,
  });
  s.addNotes(
    "Demonstrate this live rather than describing it — open the queue, claim one, walk the six steps, then hand the headset " +
    "over.\n\nThe number they see comes from the pool and is matched on area code, because a local number gets answered. It " +
    "is always a number FieldQuo actually owns; nothing here invents a plausible local one, which is spoofing. Two calls to " +
    "the same business come from the same number so they do not see two strangers.\n\nStress the note box. The single " +
    "biggest difference between reps is whether the next person can pick up the thread six weeks later.\n\nThe playbook — " +
    "nine stages and eight written objection answers — sits on the same screen. Note it only exists for a prospect from the " +
    "queue; a lead typed in by hand has no discovery behind it and the screen says so rather than showing a blank one.",
  );
}

// 9 — inbound
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("When they ring you back", {
    x: M, y: 0.9, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  s.addText("A contractor who calls the number you rang them from reaches YOU first — the call log knows who rang them. Not a switchboard, not whoever is nearest.", {
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

// 10 — transfer and hold
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

// 11 — voicemail
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Voicemail, and the message with no words in it", "The Voicemail tab — messages left on the number you rang from, playable by you.");

  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.1, w: 5.4, h: 2.5, rectRadius: 0.14, fill: { color: NAVY } });
  s.addText("0s", {
    x: M + 0.4, y: 2.32, w: 4.6, h: 1.0, isTextBox: true, margin: 0,
    fontFace: "Cambria", fontSize: 52, bold: true, color: GOLD,
  });
  s.addText("no words spoken", {
    x: M + 0.4, y: 3.28, w: 4.6, h: 0.4, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 15, bold: true, color: WHITE,
  });
  s.addText("They rang back, heard the beep and thought better of it. Warmer than a missed call, colder than a message — and worth a callback the same day.", {
    x: M + 0.4, y: 3.7, w: 4.6, h: 0.8, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 12.5, color: ICE,
  });

  const rows = [
    ["It is yours if they rang your number", "Even when we cannot work out who called. It says “Not matched to a business” rather than hiding it — a contractor ringing from a mobile we have never seen is exactly the callback worth having."],
    ["We serve the audio, not the phone company", "You play it inside FieldQuo. There is no transcription: listening to a ninety-second message is cheaper than transcribing every wrong number."],
  ];
  let y = 4.9;
  rows.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.85, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.06, w: 3.9, h: 0.73, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 4.3, y: y + 0.06, w: 7.1, h: 0.73, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 11.5, color: MUTED, valign: "middle",
    });
    y += 0.95;
  });

  s.addText("Ring a zero-second message back the same day. Somebody dialled you on purpose.", {
    x: M + 5.9, y: 2.7, w: 5.8, h: 1.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 21, italic: true, color: NAVY,
  });
  s.addNotes(
    "The recorder fires after a few seconds of silence, so a zero-length recording is somebody who rang, heard the beep and " +
    "hung up. Hiding it as \"empty\" would throw away the warmest signal on the screen, and most reps ignore it.\n\nBefore " +
    "this screen existed the only place a sales voicemail could be played was the superadmin board — so the person the " +
    "message was FOR could not hear it. Worth telling the room as an example of the standard here.",
  );
}

// 12 — closing out a claim
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Closing out a claim", "Three buttons, plus the ten ways a call itself can end.");

  const outs = [
    ["I spoke to them — keep this one", "The claim stops lapsing and the prospect stays yours. Fair warning: worked ones stay in your queue rather than clearing out of it.", NAVY],
    ["Put it back in the pool", "Somebody else can claim it. Use this the moment you know you are not working it — the claim is a lease on everybody's ability to ring them.", "4A6FA5"],
    ["Stop working this one", "Needs a written reason and it is permanent on that business. It is housekeeping, not an opt-out — see the next slide for the one that binds every rep.", RED],
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
  s.addNotes(
    "The labels here are the ones on the screen today. \"Stop working this one\" used to say \"They asked not to be " +
    "contacted\", which promised something it does not do — worth mentioning, because it is the reason the next slide " +
    "exists.\n\nThe ten call dispositions live beside the dial rather than here: no answer, busy, voicemail left, someone " +
    "answered but not the owner, ring back, spoke-interested, spoke-not-interested, asked not to be called, wrong number, " +
    "not a business we can sell to. \"Wrong number\" releases the claim AND flags the record, so the pool cannot hand the " +
    "same dead number to the next rep.",
  );
}

// 13 — the two do-not-contact controls
//
// This slot used to hold a SECOND calling-window slide teaching a flat
// 08:00–21:00. That is the TEXTING window (SALES_SMS_WINDOW), not the calling
// one, and two slides in one deck giving different answers to the same
// question is worse than either of them alone. Slide 6b is now the only
// calling-window slide. This one covers the thing that was actually missing.
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Two buttons that sound identical and are not", "Both stop you contacting somebody. Only one of them stops everybody else.");

  const cards = [
    {
      big: "Stop working this one",
      cap: "On the queue",
      body: "Writes a flag on that one business. Permanent, nothing lifts it, and it follows the record everywhere. But it does NOT put the number on FieldQuo's do-not-contact list.",
      colour: NAVY,
    },
    {
      big: "Asked not to be called again",
      cap: "Closing a call",
      body: "This is the one to use when they said it out loud. It writes the flag AND the list, in the same breath — every rep, every channel, calls and texts and email. Their words go in the note; it will not save without them.",
      colour: RED,
    },
  ];
  let x = M;
  cards.forEach((c) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.15, w: 5.65, h: 2.9, rectRadius: 0.14, fill: { color: CARD } });
    s.addShape(p.ShapeType.roundRect, { x: x + 0.32, y: 2.45, w: 0.14, h: 0.5, rectRadius: 0.07, fill: { color: c.colour } });
    s.addText(c.big, {
      x: x + 0.62, y: 2.4, w: 4.7, h: 0.6, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 20, bold: true, color: c.colour,
    });
    s.addText(c.cap, {
      x: x + 0.62, y: 3.0, w: 4.7, h: 0.32, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 11, bold: true, color: GOLD, charSpacing: 1,
    });
    s.addText(c.body, {
      x: x + 0.62, y: 3.36, w: 4.7, h: 1.5, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED,
    });
    x += 6.05;
  });

  s.addText("Either way you never have to remember who said it. The list is read fresh at the moment of every call, text and email — a STOP text closes the phone too, and the dial button simply is not there next time.", {
    x: M, y: 5.35, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 16, italic: true, color: NAVY,
  });
  s.addNotes(
    "This is the single easiest thing on the whole product to get wrong, and the screen now says so above both controls — " +
    "until 2026-09-03 the queue button was labelled \"They asked not to be contacted\" and promised something it did not do.\n\n" +
    "How to teach it: the queue button is housekeeping — sold the business, wrong trade, gone bust. The disposition is what " +
    "you press when a human said the words. If in doubt, press the disposition; over-suppression is the failure this list is " +
    "allowed to have.\n\nAnd tell them plainly that nine opt-outs a week is a rep working the phone properly. A rep who gets " +
    "nervous about them starts fudging them, and a fudged one is the expensive kind.",
  );
}

// 14 — texts
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Texts", "The first one is written for you. Everything after it is yours.");

  const rows = [
    ["The first message is fixed", "Your name, FieldQuo, your signup link, our mailing address, “Reply STOP to opt out”. You cannot compose it, and that is what makes a first contact legal. It goes from the lead."],
    ["Then it is a conversation", "They write back, you reply in your own words. You cannot open a free-text thread with a stranger — the first message has to be the one above, and trying it is refused in words."],
    ["08:00 – 21:00, their clock", "Flat, every day. 20:59 is in and 21:00 is out. Different from the calling window on purpose: nothing in Canadian law times a commercial text, so the US rule is what binds it."],
    ["Not the number that rang them", "Texts go out on one shared FieldQuo sales number. Your CALLS present a number matched to their area code, and a callback to that reaches you. Never tell a contractor to text back the number that rang them."],
    ["Every refusal is the server's", "The compose box does not decide. The do-not-contact list, the window and the mailing address are all re-read at the moment you press send."],
  ];
  let y = 2.1;
  rows.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.88, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.06, w: 3.5, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14.5, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 3.9, y: y + 0.06, w: 7.5, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12, color: MUTED, valign: "middle",
    });
    y += 1.0;
  });
  s.addNotes(
    "Two corrections worth saying out loud, because both used to be taught the other way.\n\nOne: the old material said you " +
    "get exactly one fixed message and nothing comes back. Free-text replies are real now — /sales/messages, and the server " +
    "adds the identification line so nobody can delete it out of the box.\n\nTwo: calls and texts do NOT share a number. " +
    "Calls present a sales number matched to the contractor's area code; texts all go out on one shared sales-purpose " +
    "number. The reason it is shared is cost, not compliance — every sending number has to be registered for A2P/10DLC " +
    "before it may text a US contractor, so numbers are not free to add. An older comment claimed sharing was needed so a " +
    "STOP could not fragment; that was false and has been corrected in the code. The opt-out is recorded against THEIR " +
    "number and is already global.\n\nKeep replies short. Two segments is the ceiling and one emoji re-encodes the whole " +
    "message.",
  );
}

// 15 — the second job
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Your second job starts the day they sign", {
    x: M, y: 0.8, w: 11.7, h: 0.85, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  s.addText("A signup that cancels in five weeks pays you twice. One still there at day 60 pays you three times.", {
    x: M, y: 1.65, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 16, color: ICE,
  });

  const beats = [
    ["Day 1", "About SETUP. Did anything stop them finishing? Somebody who hit a wall on their first evening will not come back to it alone."],
    ["Day 7", "About USE. They have had a working week on a real job, so “is everything okay” is finally a question with an answer."],
    ["Then by reason", "Payment failing, free period ending early, onboarding never finished, set-up steps open — ranked, with the reason printed."],
    ["Day 60", "The retention milestone. The third and largest commission, and the only one you can still influence."],
  ];
  let x = M;
  beats.forEach((b) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.45, w: 2.75, h: 2.5, rectRadius: 0.14, fill: { color: "27346B" } });
    s.addText(b[0], {
      x: x + 0.26, y: 2.65, w: 2.23, h: 0.5, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 22, bold: true, color: GOLD,
    });
    s.addText(b[1], {
      x: x + 0.26, y: 3.2, w: 2.23, h: 1.6, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12, color: ICE,
    });
    x += 2.95;
  });

  s.addText("Every check-in is a DRAFT. Nothing sends on a schedule — the screen writes it, you read it, edit it and press send. It will not invent a number, a price or a link about somebody's business.", {
    x: M, y: 5.25, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 16, italic: true, color: ICE,
  });
  s.addText("Something actually broken goes to the Support tab — a ticket about one of your own companies, with a thread you can follow, raised while you are still on the phone. And the Demo tab holds one account, yours permanently, to drive in front of a prospect.", {
    x: M, y: 6.1, w: 11.7, h: 0.75, isTextBox: true,
    fontFace: "Calibri", fontSize: 13, color: ICE,
  });
  s.addNotes(
    "The two touchpoints are the owner's own words: \"1 day after they sign up to see if they have any questions and make " +
    "sure they completed the onboarding process. and 7 days after they sign up ... to see if everything is okay.\" They do " +
    "different jobs, which is why they are two entries rather than a repeat.\n\nThe framing: sixty days is a long time to " +
    "remember thirty companies by hand. This screen is not management watching, it is the thing that stops good customers " +
    "quietly falling off the end of a rep's memory.\n\n\"Nothing looks wrong — say hello\" is a legitimate reason on that " +
    "list, not filler. Do not let a rep treat it as one.",
  );
}

// 16 — the pay tab
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Your pay details", "The Pay tab — set it on your first day");

  const rows = [
    ["How you want the money", "Upwork, PayPal, Interac e-Transfer, Wise or a bank transfer. Each says its own trade-off before you choose, not after the money arrives short — Wise is usually the answer for a rep outside Canada."],
    ["Where it goes", "Your handle or account. A method with no destination is refused rather than saved — half-set reads as done on every other screen."],
    ["When you last confirmed it", "The date is shown, not a tick. An account confirmed two years ago is not the same claim as one confirmed last week."],
    ["Freelancer or employee", "Shown, not chosen. It decides paid leave and what is withheld, so FieldQuo sets it. If it looks wrong, say so and it is corrected."],
    ["Your language, honestly", "The picker is on this tab. It moves the menus, the sign-in screen and your companies book. The prospecting screens are still in English, and it says so rather than pretending otherwise."],
  ];
  let y = 2.15;
  rows.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.9, fill: { color: CARD } });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.06, w: 3.5, h: 0.78, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14.5, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 3.9, y: y + 0.06, w: 7.5, h: 0.78, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12, color: MUTED, valign: "middle",
    });
    y += 1.0;
  });
  s.addNotes(
    "Nobody is paid until this is set. Do it in the first ten minutes of day one — and it is also the first thing the " +
    "welcome screen asks for after an invite is accepted, alongside the language.\n\nOn the language row, do not oversell " +
    "it. Four of the twelve tabs are translated and eight are not, deliberately: a translated tab opening an English page " +
    "is the worse inconsistency. Each becomes a key the day its screen is translated.\n\nOne more thing to say out loud " +
    "before they leave the room: there is no forgotten-password flow, and re-inviting somebody who has already set one is " +
    "refused. Tell them to write it down.",
  );
}

// 17 — the rough edges
//
// The second card used to say nothing turned a claimed prospect into a lead.
// There is a button for it now — "Work this one as a lead" on the queue.
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Things that will look like bugs and are not", "Said upfront, because you will find them in week one either way.");

  const gaps = [
    ["Worked prospects stay in your queue", "Marking one “worked” stops it lapsing, and the queue matches on exactly that — so it accumulates rather than emptying. Your Today count still comes down, because worked ones are left out of it."],
    ["A contractor who texted STOP reads as “No sales number yet”", "The dial control is correctly gone and the sentence underneath is the true one. The heading above it is wrong and will send you off to look for a number they do not want you to use. Read the sentence."],
    ["A text you send may report a failure it did not have", "The message goes out and the screen says the provider refused it. Do not resend — you will text them twice. Check with somebody instead. Being fixed."],
  ];

  let y = 2.1;
  gaps.forEach((g) => {
    s.addShape(p.ShapeType.roundRect, { x: M, y, w: 11.7, h: 1.35, rectRadius: 0.14, fill: { color: CARD } });
    s.addText(g[0], {
      x: M + 0.35, y: y + 0.18, w: 11.0, h: 0.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 18, bold: true, color: NAVY,
    });
    s.addText(g[1], {
      x: M + 0.35, y: y + 0.58, w: 11.0, h: 0.7, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13.5, color: MUTED,
    });
    y += 1.55;
  });

  s.addText("You will find others. Tell us — the written SOP records every one of these honestly, and it is kept that way on purpose.", {
    x: M, y: 6.0, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 17, italic: true, color: NAVY,
  });
  s.addNotes(
    "Naming the rough edges in the first meeting buys more trust than pretending the product is finished.\n\nThe good news " +
    "to pair it with: the one that used to be on this slide — nothing turning a claimed prospect into a lead — is fixed. " +
    "\"Work this one as a lead\" carries the name, the number and where they are across and links the two records, and " +
    "pressing it twice hands back the lead that already exists.",
  );
}

// 18 — close
//
// Last, which it was not: this slide sat in the middle of the deck with eight
// slides after it, so the meeting ended twice.
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Your first day", {
    x: M, y: 1.4, w: 9.5, h: 0.9, isTextBox: true,
    fontFace: "Cambria", fontSize: 44, bold: true, color: WHITE,
  });

  const steps = [
    "Accept your invite, sign in, and write the password down — there is no reset",
    "Set the Pay tab. Nobody is paid until it is set",
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

p.writeFile({ fileName: "How-you-work-SOP.pptx" }).then((f) => console.log("wrote", f));
