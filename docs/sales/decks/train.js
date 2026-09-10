// Day-one training. The deck you TEACH FROM, out loud, in a room.
//
// The other three decks in this folder are read: sop.js is the reference a rep
// keeps open, pay.js is the compensation maths, recruit.js is the pitch to
// somebody who has not said yes yet. This one is a session. So every slide
// carries speaker notes — the notes are half the deck, and several slides are
// deliberately thin on the screen because the words belong in the trainer's
// mouth, not behind their head.
//
// Three PRACTICE slides put the prompt on the screen and keep the coaching
// answer in the notes. A trainee who reads the answer off the wall has not
// practised anything.
//
// Facts are pulled from the code, not from docs/sales/SOP.md, which has drifted
// in three places (recorded in the notes on the slides that correct it):
//   · the calling window IS enforced now — lib/sales/callingRules.js +
//     dialHref(), and app/api/sales/calls/route.js re-checks it server-side.
//   · there are twelve tabs in app/sales/SalesShell.js, not five screens.
//   · texts are two-way now (app/api/sales/messages POST), not one fixed send.
const pptxgen = require("pptxgenjs");

const NAVY = "1E2761";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const INK = "1B1B1F";
const MUTED = "5A6070";
const GOLD = "C8A44D";
const CARD = "F4F6FB";
const RED = "8C2F39";
// Two navy shades used for banded rows on a navy ground. Same values sop.js
// uses, so a row on slide 14 here matches a row on slide 5 there.
const NAVY_ROW = "2A3A78";
const NAVY_ROW_DEEP = "27346B";

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "FieldQuo";
p.title = "Training — day one";

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

/** A banded list of [label, body] rows. The workhorse of this deck. */
function rows(s, list, { y0 = 2.35, h = 0.92, labelW = 3.3, dark = false } = {}) {
  let y = y0;
  list.forEach((r, i) => {
    s.addShape(p.ShapeType.rect, {
      x: M, y, w: 11.7, h,
      fill: { color: dark ? (i % 2 === 0 ? NAVY_ROW : NAVY_ROW_DEEP) : CARD },
    });
    s.addText(r[0], {
      x: M + 0.25, y: y + 0.06, w: labelW, h: h - 0.12, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: dark ? GOLD : NAVY, valign: "middle",
    });
    s.addText(r[1], {
      x: M + labelW + 0.45, y: y + 0.06, w: 11.0 - labelW - 0.45, h: h - 0.12, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: dark ? ICE : MUTED, valign: "middle",
    });
    y += h + 0.13;
  });
  return y;
}

/**
 * A practice slide. Prompt on the wall, answer in the notes — deliberately.
 *
 * The trainee says their answer before anybody reads a coaching line. A slide
 * carrying both is a slide the room reads instead of a room that talks.
 */
function practice(n, setup, ask, notes) {
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addShape(p.ShapeType.roundRect, { x: M, y: 0.55, w: 2.5, h: 0.5, rectRadius: 0.1, fill: { color: GOLD } });
  s.addText(`PRACTICE ${n}`, {
    x: M, y: 0.55, w: 2.5, h: 0.5, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 14, bold: true, color: NAVY, align: "center", valign: "middle", charSpacing: 2,
  });
  s.addText("Say it out loud. Nobody types.", {
    x: M + 2.8, y: 0.55, w: 8.9, h: 0.5, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 14, italic: true, color: ICE, valign: "middle",
  });
  s.addText(setup, {
    x: M, y: 1.5, w: 11.7, h: 1.6, isTextBox: true,
    fontFace: "Cambria", fontSize: 28, bold: true, color: WHITE,
  });
  s.addShape(p.ShapeType.roundRect, { x: M, y: 3.5, w: 11.7, h: 1.5, rectRadius: 0.14, fill: { color: NAVY_ROW } });
  s.addText(ask, {
    x: M + 0.4, y: 3.5, w: 10.9, h: 1.5, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 20, color: ICE, valign: "middle",
  });
  s.addText("The answer is not on this slide. That is the point.", {
    x: M, y: 5.4, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 14, italic: true, color: GOLD,
  });
  s.addNotes(notes);
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Day one", {
    x: M, y: 2.2, w: 10.5, h: 1.2, isTextBox: true,
    fontFace: "Cambria", fontSize: 54, bold: true, color: WHITE,
  });
  s.addText("What we sell, who we ring, and how a call actually goes", {
    x: M, y: 3.45, w: 10.5, h: 0.6, isTextBox: true,
    fontFace: "Calibri", fontSize: 20, color: ICE,
  });
  s.addText("You will make a real call before this session ends. Everything here is aimed at that.", {
    x: M, y: 4.5, w: 10.5, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 14, italic: true, color: ICE,
  });
  s.addNotes(
    "Half a day, with breaks. Say up front that they will dial somebody before they leave — it changes how they listen to " +
    "the next two hours.\n\nHouse rules for the room: interrupt whenever, and if something on screen does not match what " +
    "you say, the screen wins and we fix the deck. Three slides in here exist because the written SOP had gone stale.\n\n" +
    "Do not hand out the SOP yet. It is the reference for week one, and reading it now competes with you.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — what the product is
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "What you are selling", "One pipeline. A contractor wins the job, does the job, and gets paid, without leaving FieldQuo.");

  const stages = ["Lead", "Quote", "Job", "Invoice", "Paid"];
  let x = M;
  stages.forEach((label, i) => {
    s.addShape(p.ShapeType.roundRect, {
      x, y: 2.15, w: 2.0, h: 1.0, rectRadius: 0.12,
      fill: { color: i === stages.length - 1 ? GOLD : NAVY },
    });
    s.addText(label, {
      x, y: 2.15, w: 2.0, h: 1.0, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 22, bold: true,
      color: i === stages.length - 1 ? NAVY : WHITE, align: "center", valign: "middle",
    });
    if (i < stages.length - 1) {
      s.addText("→", {
        x: x + 2.0, y: 2.15, w: 0.42, h: 1.0, isTextBox: true, margin: 0,
        fontFace: "Calibri", fontSize: 22, bold: true, color: MUTED, align: "center", valign: "middle",
      });
    }
    x += 2.42;
  });

  rows(s, [
    ["The whole thing is theirs", "Their logo, their colour, their name in the From line. A homeowner comparing three contractors cannot tell that two of them run the same software. Nothing on a quote PDF says FieldQuo."],
    ["It answers the phone", "The AI receptionist picks up while they are on a ladder, takes the details, books the visit, and hands them a draft quote from what the caller described."],
    ["It gets them paid", "Client opens a link, ticks the extras they want, signs. Invoice, card payment, done — no printing and no phone tag."],
  ], { y0: 3.5, h: 1.0, labelW: 3.3 });

  s.addNotes(
    "Do not teach the feature list today. Teach the sentence: they win the job, do the job, get paid, and every document the " +
    "homeowner sees looks like it came from them.\n\nThe white-label point is the one that lands on a call, and it is the one " +
    "reps skip because it sounds like branding. It is not branding — it is the reason a contractor will pay 99 a month for " +
    "something rather than keep using three free things.\n\n76 features, per docs/sales/FEATURES.md. You are not going to " +
    "know them in week one and you do not need to. Know the pipeline and know where to look.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — who you are ringing
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Who picks up", "Picture them before you dial. It changes your first sentence.");

  const cards = [
    { big: "1–20", cap: "people", body: "Usually the owner answers, and the owner is also the estimator, the invoicer and sometimes the person on the ladder." },
    { big: "39", cap: "trades in the picker", body: "Painters, cabinet makers, roofers, landscapers, flooring, plumbing. DISCOVERY_TRADES, and you pick one per day." },
    { big: "0", cap: "quiet offices", body: "They are in a van, on a site, or up a ladder. Assume noise, assume two minutes, and get to the point." },
  ];
  let x = M;
  cards.forEach((c) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.05, w: 3.7, h: 2.7, rectRadius: 0.14, fill: { color: CARD } });
    s.addText(c.big, {
      x: x + 0.32, y: 2.25, w: 3.06, h: 0.9, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 46, bold: true, color: NAVY,
    });
    s.addText(c.cap, {
      x: x + 0.32, y: 3.12, w: 3.06, h: 0.35, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: GOLD,
    });
    s.addText(c.body, {
      x: x + 0.32, y: 3.52, w: 3.06, h: 1.1, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED,
    });
    x += 4.0;
  });

  s.addText("One trade a day, all day. You get better at a script by saying it forty times, not by switching every call.", {
    x: M, y: 5.15, w: 11.7, h: 0.6, isTextBox: true,
    fontFace: "Cambria", fontSize: 18, italic: true, color: NAVY,
  });
  s.addNotes(
    "Ask the room: what is this person doing at 10:40 on a Tuesday? Let them answer. The right answer is 'holding a phone in " +
    "a van with the engine running', and every rep who pictures that shortens their opening on their own.\n\nThe one-trade-a-day " +
    "rule is on the queue screen in those words. It is not a productivity trick — it is that a cabinet maker's objections are " +
    "not a landscaper's, and forty repetitions is where a rep stops reading and starts talking.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — the price, and the answer that sounds broken
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "The price, and the answer that sounds like a mistake", "Four rungs. They differ in how many people they seat and in nothing else.");

  const tiers = [
    ["Solo", "1 + 5 free crew", "99"],
    ["Crew", "3 + 8 free crew", "169"],
    ["Shop", "6 + 11 free crew", "269"],
    ["Scale", "10 + 15 free crew", "369"],
  ];
  let x = M;
  tiers.forEach((t) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.05, w: 2.75, h: 1.9, rectRadius: 0.12, fill: { color: CARD } });
    s.addText(t[0], {
      x: x + 0.25, y: 2.2, w: 2.25, h: 0.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: GOLD,
    });
    s.addText(t[2], {
      x: x + 0.25, y: 2.6, w: 2.25, h: 0.7, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 38, bold: true, color: NAVY,
    });
    s.addText(t[1], {
      x: x + 0.25, y: 3.32, w: 2.25, h: 0.45, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12, color: MUTED,
    });
    x += 2.98;
  });

  rows(s, [
    ["Every rung gets everything", "All 76 features are on every plan. The receptionist, the website, the AI quote review, the payouts. You are selling seats, not tiers."],
    ["Say the number with no currency", "A Canadian pays 99 in Canadian dollars, an American 99 in US dollars. Same number, not a conversion. The signup address decides."],
    ["Do not invent a difference", "A grid with a tick in every cell looks broken and the temptation is to make something up. There is no code anywhere that would make it true."],
  ], { y0: 4.25, h: 0.78, labelW: 3.5 });
  s.addNotes(
    "SEAT_LADDER in lib/pricing/ladder.js: solo 99, crew 169, shop 269, scale 369. A check script fails the build the day a " +
    "rung gains a feature the others do not have, so this stays true.\n\nWatch for the rep who 'helps' by inventing a " +
    "difference between Solo and Scale. It happens on about the third call, it sounds harmless, and it is a promise the " +
    "product will break in week two.\n\nA seat is somebody whose permissions let them originate money — not a job title. An " +
    "owner can call twenty estimators 'crew' and still be paying for twenty seats' worth of quote-editing.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — PRACTICE 1
// ═══════════════════════════════════════════════════════════════════════════
practice(
  1,
  "Forty seconds in, a painter says:\n“We already use Jobber.”",
  "What is your next sentence? Not your pitch — the one sentence that keeps you on the phone.",
  "Let two or three people try before you say anything. Most first attempts are a feature ('but we do X') and that is exactly " +
  "the reflex to break — arguing with a tool somebody already paid for makes you the salesman they hang up on.\n\n" +
  "What works is a question about their money, not our product. Something like: 'Fair enough — how much are you paying for " +
  "it once the add-ons are on?' Then be quiet.\n\nThe facts behind that question, from lib/marketing/competitors.js: Jobber " +
  "has no single price, it moves on team size and billing. Their AI receptionist is a 29/mo add-on at one user — 30 " +
  "conversations, then 0.79 each — or it is inside the 599/mo Plus tier. Marketing Suite 99, receptionist 29, sales pipeline " +
  "49: 177 a month stacked on top of the plan.\n\nTwo rules for the room. First: concede first. Jobber ships a real mobile " +
  "app and we do not — say it before they find it. A concession you volunteer is credibility. Second: if the compare page is " +
  "blank, the figures are older than 90 days and have stopped publishing. Do NOT quote them from memory.\n\nAnd never say our " +
  "receptionist is 'included'. Talk time is prepaid credit. The honest claim is 'no monthly minimum'.",
);

// ═══════════════════════════════════════════════════════════════════════════
// 6 — the tabs
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Twelve tabs, and only four of them are your morning", "The rest you visit when something happens. Do not try to learn them all today.");

  const tabs = [
    ["Today", "Daily", "One sentence: what to do next. It refuses to guess when a count failed to load."],
    ["Queue", "Daily", "Claim a prospect, read the research, call, close the claim out."],
    ["Leads", "Daily", "The ones you typed in yourself. Email and the first text go from here."],
    ["Conversations", "Daily", "Email replies. Somebody is waiting on you."],
    ["Texts", "When it buzzes", "Two-way SMS threads."],
    ["Voicemail", "When it buzzes", "Messages left on your number."],
    ["Calendar", "When it buzzes", "Your appointments and callbacks."],
    ["My companies", "Weekly", "The contractors you signed up. Your retention book."],
    ["Support", "When it breaks", "Send a technical problem to FieldQuo."],
    ["Notes", "Whenever", "Autosaves. Archive only — nothing deletes."],
    ["Demo", "On a call", "The account you drive in front of a prospect."],
    ["Pay", "Day one, then never", "How you want the money."],
  ];

  // Four across, three down. Twelve is too many for the three-card row the
  // rest of the pack uses, and a sideways scroll is exactly the failure the
  // real tab bar had to fix.
  const cw = 2.73;
  tabs.forEach((t, i) => {
    const x = M + (i % 4) * 2.99;
    const y = 2.0 + Math.floor(i / 4) * 1.65;
    s.addShape(p.ShapeType.roundRect, { x, y, w: cw, h: 1.5, rectRadius: 0.1, fill: { color: CARD } });
    s.addText(t[0], {
      x: x + 0.22, y: y + 0.12, w: cw - 0.44, h: 0.32, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY,
    });
    s.addText(t[1], {
      x: x + 0.22, y: y + 0.44, w: cw - 0.44, h: 0.26, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 9.5, bold: true, color: GOLD, charSpacing: 1,
    });
    s.addText(t[2], {
      x: x + 0.22, y: y + 0.72, w: cw - 0.44, h: 0.68, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 10.5, color: MUTED,
    });
  });
  s.addNotes(
    "Read straight off app/sales/SalesShell.js today: Today, Queue, Leads, Conversations, Texts, Notes, Calendar, My " +
    "companies, Demo, Support, Voicemail, Pay.\n\nThe written SOP still says 'the five screens you have'. It is out of date " +
    "and Voicemail, Support and Pay are the newest three. Say that out loud rather than letting them find the mismatch on " +
    "their own — it is also the moment to make the point that the screen always wins over the document.\n\nOn a phone the tabs " +
    "wrap into rows of three rather than scrolling sideways. Two of them used to sit off the right edge with no scrollbar, " +
    "which nobody discovers. Tell them the portal is built to work in a phone browser, because they will be on one.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — Today
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Start on Today. It answers one question.", "“What do I do next?” — computed, in this order, and refused when it cannot be computed.");

  const ladder = [
    ["Somebody wrote back", "Replies waiting on you. A person is holding while you decide what to do with your morning."],
    ["Ring the ones you hold", "Prospects you claimed and have not spoken to. A claim is a lease on everybody else's ability to call them."],
    ["Claim a new one", "The pool has stock and you are holding nothing."],
    ["Write to a lead", "Leads you typed in and never contacted."],
  ];
  let y = 2.35;
  ladder.forEach((r, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y: y + 0.14, w: 0.44, h: 0.44, fill: { color: NAVY } });
    s.addText(String(i + 1), {
      x: M, y: y + 0.14, w: 0.44, h: 0.44, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle",
    });
    s.addText(r[0], {
      x: M + 0.72, y: y + 0.02, w: 3.6, h: 0.7, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 17, bold: true, color: INK, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 4.45, y: y + 0.02, w: 7.05, h: 0.7, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, color: MUTED, valign: "middle",
    });
    y += 0.82;
  });

  s.addShape(p.ShapeType.roundRect, { x: M, y: 5.75, w: 11.7, h: 1.0, rectRadius: 0.12, fill: { color: CARD } });
  s.addText([
    { text: "An empty ladder means the day's queue is clear. ", options: { bold: true, color: NAVY } },
    { text: "It never invents busywork, and it never reads a failed fetch as a zero — if a count could not be read it says which one, rather than telling you to go home while three people wait.", options: { color: MUTED } },
  ], { x: M + 0.35, y: 5.85, w: 11.0, h: 0.8, isTextBox: true, margin: 0, fontFace: "Calibri", fontSize: 13 });
  s.addNotes(
    "app/sales/nextAction.js. Worth teaching because it is the one sentence in the portal that can be WRONG rather than " +
    "merely ugly — a rep reads it and does what it says.\n\nThe design point to make: every count is a number OR null, and " +
    "null means 'we did not get an answer', never 'none'. The ladder stops at the first unknown rung, because a rung below " +
    "an unknown one cannot be trusted to be the answer.\n\nThe thing to actually drill: rung 2 outranks rung 3. Holding " +
    "claims you are not working is the most common bad habit on this floor. It costs another rep the call.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — the queue
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "The queue hands you one. You cannot shop.", "Pick a trade, press “Claim the next one”, and work what you get.");

  rows(s, [
    ["A count, never a list", "You see how many are free in each of the 39 trades. There is no endpoint anywhere that lists them. A rep who could see the pool would cherry-pick, and one rep claiming two hundred and calling nine freezes the board for everybody."],
    ["The claim is the lock", "While you hold it, no other rep can ring that business. That is the whole fairness mechanism, and it is why holding one you are not working is not a neutral act."],
    ["48 hours of doing nothing", "An unworked claim lapses and the prospect goes back in the pool. It measures inactivity, not age — ring them twice and it keeps resetting."],
    ["You cannot summon more", "Discovery runs on a schedule. If a trade is empty, the screen names which of three reasons it is. Pick a different trade."],
  ], { y0: 2.1, h: 1.02, labelW: 3.3 });

  s.addText("Worked prospects stay in your queue rather than clearing out of it. That is how it behaves today — not a bug you have found.", {
    x: M, y: 6.6, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 13.5, italic: true, color: RED,
  });
  s.addNotes(
    "CLAIM_HOURS = 48 in lib/sales/prospectView.js. 39 trades in lib/sales/discovery/trades.js.\n\nThe claim is a " +
    "compare-and-set: two reps pressing the button in the same second cannot both get the same row, one of them goes round " +
    "again. Worth saying because reps assume a race and start hoarding to beat it.\n\nThe red line at the bottom: 'worked' " +
    "clears the expiry, and the queue matches on exactly that, so worked prospects accumulate. Tell them on day one. A rep " +
    "who discovers it alone in week two decides the software is broken and stops trusting the rest of the screen.\n\nAlso " +
    "flag the known gap: nothing turns a claimed prospect into a lead. If you want to email or text somebody from the queue " +
    "you retype them on the leads screen. Annoying, known, being fixed.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — the four layers
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Four layers. Read all four before you dial.", {
    x: M, y: 0.7, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  s.addText("The screen keeps fact, guess and suggestion apart. On the phone, so do you — and the difference is audible.", {
    x: M, y: 1.52, w: 11.7, h: 0.45, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, color: ICE,
  });

  rows(s, [
    ["What we observed", "A crawler actually saw it. Safe to say as a flat statement."],
    ["What we infer", "A guess with a confidence number on it. Say it as a question, never as a claim."],
    ["What to pitch", "A suggestion. It is not a script and it does not know they have a new baby."],
    ["What we do not know", "Named gaps. These are your questions — free material, already written for you."],
  ], { y0: 2.35, h: 0.9, labelW: 3.5, dark: true });

  s.addText("A capability marked false is an observation. Null means nobody found out. They are not the same thing, and reading null as “they don't have it” is how you say something untrue without meaning to.", {
    x: M, y: 6.5, w: 11.7, h: 0.7, isTextBox: true,
    fontFace: "Cambria", fontSize: 16, italic: true, color: GOLD,
  });
  s.addNotes(
    "lib/sales/prospectView.js. Three tables, not one wide row, precisely so the layers cannot be collapsed by a page " +
    "author in a hurry.\n\nThree inversions to say out loud: a website that will not load is not a business without a " +
    "website; a page with no links is usually a JavaScript site our crawler cannot execute, not a contractor who offers " +
    "nothing; and 'we could not look today' never overwrites what we saw last week.\n\nIf an inference has no confidence, " +
    "the screen renders a refusal string instead of the claim. Do not repair it by guessing — that is the whole reason it " +
    "refuses.\n\nNext slide is the drill for this. Do not skip it: this is the fastest way a new rep says something false.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — PRACTICE 2
// ═══════════════════════════════════════════════════════════════════════════
practice(
  2,
  "The research screen says:\n“We infer they take no online bookings — confidence 0.62.”",
  "Say that to the contractor. Out loud, in one sentence, without telling them something we did not observe.",
  "Almost everybody's first attempt is 'I see you don't take online bookings'. That is an inference read out as an " +
  "observation — 0.62 is closer to a coin toss than to a fact, and if they DO take bookings you have just told a business " +
  "owner you know their business better than they do. The call is over and you will not know why.\n\nWhat works is a " +
  "question: 'When somebody wants to book you in, how does that reach you at the moment?' Now the fact comes out of their " +
  "mouth, which makes it usable, and if we were wrong nobody has lost anything.\n\nRun the drill twice more with a fact " +
  "instead of an inference: 'What we observed: no booking page on their site.' That one you CAN say flat — 'I had a look at " +
  "your site, there's no way to book on it.' Get the room to hear the difference between the two sentences.\n\nThe test to " +
  "leave them with: if you would have to defend the sentence, ask it instead.",
);

// ═══════════════════════════════════════════════════════════════════════════
// 11 — a call end to end
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "A call, end to end", "It all happens on one screen. You never leave the record.");

  const steps = [
    ["Claim it", "One press. You get the next one in that trade, not the one you liked the look of."],
    ["Read all four layers", "Two minutes. This is where the call is won, not on the call."],
    ["Press Call", "It rings in your browser through a headset. Your own number shows on their handset."],
    ["Say who you are, and the number", "Identify yourself and give a callback number. It is required, every call, and the screen shows you the number being presented so you can read it out."],
    ["Type while they talk", "The note box sits beside the dial. As close to their words as you can get. A note written afterwards is a summary of a memory."],
    ["Close it out", "Pick what happened from the list. Some choices need the note before they will save."],
  ];
  let y = 2.15;
  steps.forEach((t, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y: y + 0.06, w: 0.42, h: 0.42, fill: { color: i === 5 ? GOLD : NAVY } });
    s.addText(String(i + 1), {
      x: M, y: y + 0.06, w: 0.42, h: 0.42, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, bold: true, color: i === 5 ? NAVY : WHITE, align: "center", valign: "middle",
    });
    s.addText(t[0], {
      x: M + 0.68, y, w: 3.3, h: 0.55, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15.5, bold: true, color: INK, valign: "middle",
    });
    s.addText(t[1], {
      x: M + 4.05, y, w: 7.45, h: 0.55, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED, valign: "middle",
    });
    y += 0.72;
  });

  s.addText("Ten ways a call can end, and the screen keeps the unfinished one in front of you until you say which it was.", {
    x: M, y: 6.5, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 17, italic: true, color: NAVY,
  });
  s.addNotes(
    "Demonstrate this live. Do not describe it — open the queue, claim one, and walk the six steps on screen while they " +
    "watch. Then hand the headset over.\n\nThe dispositions (lib/sales/calls/dispositions.js): no answer, busy, voicemail " +
    "left, gatekeeper, callback requested, spoke-interested, spoke-not-interested, asked not to be called, wrong number, not " +
    "a business we can sell to. Each one does something different to the claim behind it — 'wrong number' releases it AND " +
    "marks it for review so the pool cannot hand the same dead number to the next rep.\n\n'Asked not to be called again' " +
    "will not save without their words in the note. That is deliberate and it is permanent.\n\nThe note box is the single " +
    "biggest difference between reps. Say it plainly: whether the next person can pick up your thread six weeks later is " +
    "decided by whether you typed while they were still talking.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — the calling window
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "The hours you may ring — the screen works them out", "There is no one window. Whose rule applies depends on where THEY are, and it is judged in their clock.");

  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.1, w: 5.65, h: 1.75, rectRadius: 0.14, fill: { color: CARD } });
  s.addText([
    { text: "Canada\n", options: { fontSize: 14, color: MUTED } },
    { text: "09:00 – 21:30 weekdays\n", options: { fontSize: 22, bold: true, color: NAVY, fontFace: "Cambria" } },
    { text: "10:00 – 18:00 weekends", options: { fontSize: 16, bold: true, color: NAVY, fontFace: "Cambria" } },
  ], { x: M + 0.3, y: 2.3, w: 5.05, h: 1.4, isTextBox: true, margin: 0, fontFace: "Calibri" });

  s.addShape(p.ShapeType.roundRect, { x: M + 6.05, y: 2.1, w: 5.65, h: 1.75, rectRadius: 0.14, fill: { color: CARD } });
  s.addText([
    { text: "The commonest US state window\n", options: { fontSize: 14, color: MUTED } },
    { text: "08:00 – 21:00\n", options: { fontSize: 22, bold: true, color: NAVY, fontFace: "Cambria" } },
    { text: "Several states differ. A few impose none. One forbids the call outright.", options: { fontSize: 12.5, color: MUTED } },
  ], { x: M + 6.35, y: 2.3, w: 5.05, h: 1.4, isTextBox: true, margin: 0, fontFace: "Calibri" });

  rows(s, [
    ["You do not do this maths", "The screen reads their country and state, finds the rule, converts to their local clock, and decides. Outside it there is no Call control — not greyed out, absent."],
    ["It tells you when it opens", "“The window opens at 08:00 Thu 11 Sept.” Go and work a prospect who is open instead of sitting on the clock."],
    ["Some refusals are honest ignorance", "Two states have not been read to our standard, and an unread rule produces “we cannot confirm this is allowed” rather than a comfortable default."],
    ["The server checks again", "Pressing Call posts to a route that re-reads the whole decision from the database. A stale screen cannot authorise a call."],
  ], { y0: 3.95, h: 0.72, labelW: 3.6 });
  s.addNotes(
    "CORRECTION, and say it out loud in the room: the written SOP still carries a warning box saying the calling window is " +
    "'written down and NOT enforced' and that the product will let you dial at 3 a.m. That was true when it was written and " +
    "it is not true now. lib/sales/callingRules.js decides, dialHref() cannot produce a dial target from a refusal, and " +
    "app/api/sales/calls/route.js re-checks server-side.\n\nCanada is one federal rule for all provinces: 09:00-21:30 " +
    "weekdays, 10:00-18:00 weekends. The US is a table of states — no federal floor exists for B2B calls, so an unlisted " +
    "state is 'unknown' rather than 8-to-9. Arizona bans unsolicited sales calls to mobiles outright at any hour. Nevada was " +
    "read and imposes nothing, so FieldQuo's own 08:00-20:00 courtesy window applies there and the refusal SAYS it is our " +
    "rule, not the state's.\n\nThe framing that matters for a rep: this is not a rule you have to remember. It is a rule you " +
    "cannot break by accident. A rep who finds a way around it is creating a legal problem for FieldQuo, not showing " +
    "initiative.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 — inbound
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("When they ring you back", {
    x: M, y: 0.75, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  s.addText("A contractor who calls the number you rang them from reaches YOU. That is the whole reason a rep wants their own number.", {
    x: M, y: 1.58, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, color: ICE,
  });

  const order = [
    ["1", "You", "The number is assigned to you, so it rings you — even if you are already on a call. Your browser decides whether to show the second one."],
    ["2", "Whoever spoke to them last", "On a shared line the call log already knows who rang that contractor. They get it next."],
    ["3", "Whoever is free", "Longest idle first, so one rep does not take every call while another sits waiting."],
    ["4", "A real phone", "A handset somebody carries, for when nobody is at a desk."],
    ["5", "A message", "They hear who they were trying to reach and can leave one. Never a silent hang-up."],
  ];
  let y = 2.35;
  order.forEach((o, i) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.75, fill: { color: i % 2 === 0 ? NAVY_ROW : NAVY_ROW_DEEP } });
    s.addText(o[0], {
      x: M + 0.2, y, w: 0.5, h: 0.75, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 22, bold: true, color: GOLD, align: "center", valign: "middle",
    });
    s.addText(o[1], {
      x: M + 0.85, y, w: 3.1, h: 0.75, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: WHITE, valign: "middle",
    });
    s.addText(o[2], {
      x: M + 4.05, y, w: 7.4, h: 0.75, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: ICE, valign: "middle",
    });
    y += 0.86;
  });

  s.addText("Give out the number the product dialled from. Never your personal mobile — that call cannot be routed, recorded or picked up by anybody but you.", {
    x: M, y: 6.6, w: 11.7, h: 0.6, isTextBox: true,
    fontFace: "Cambria", fontSize: 16, italic: true, color: GOLD,
  });
  s.addNotes(
    "lib/sales/calls/inboundDistribution.js. Three things worth saying.\n\nOne: 'available' in the presence table is a claim, " +
    "not proof. A rep whose browser closed an hour ago is skipped rather than rung — otherwise a contractor listens to " +
    "twenty seconds of ringing at a dead machine.\n\nTwo: rule 2 is why the call log matters. A contractor ringing from a " +
    "mobile we have never seen matches nobody by assignment, but the log knows who rang them, so they still reach the right " +
    "person.\n\nThree: the personal-mobile line at the bottom is not a policy point, it is self-interest. Your own number is " +
    "on this ladder. Your mobile is not.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 14 — transfer and hold
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Handing a caller to somebody else", "Two ways. The caller is never let go of, either way.");

  const cards = [
    { big: "Warm", cap: "Speak first", body: "You talk to the other rep privately while the caller waits on hold, then put them through. Use it when the context has to travel with the call." },
    { big: "Cold", cap: "Straight through", body: "They go across the moment the other rep picks up. Right when the reason is obvious — wrong trade, wrong province." },
    { big: "Neither", cap: "You get them back", body: "If the person you chose does not answer, the caller returns to YOU. They hear hold music, not a dial tone." },
  ];
  let x = M;
  cards.forEach((c) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.1, w: 3.7, h: 2.85, rectRadius: 0.14, fill: { color: CARD } });
    s.addText(c.big, {
      x: x + 0.3, y: 2.32, w: 3.1, h: 0.6, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 26, bold: true, color: NAVY,
    });
    s.addText(c.cap, {
      x: x + 0.3, y: 2.94, w: 3.1, h: 0.35, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 11, bold: true, color: GOLD, charSpacing: 1,
    });
    s.addText(c.body, {
      x: x + 0.3, y: 3.32, w: 3.1, h: 1.45, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED,
    });
    x += 4.0;
  });

  rows(s, [
    ["If everybody is busy", "The caller is held and we keep looking — up to four rounds, a little over two minutes, and then a message. Never held forever, and never held in silence."],
    ["No “you are number three”", "Each caller is looked after on their own timer, so we genuinely do not know their position, and we will not invent one. The message says what is true."],
  ], { y0: 5.2, h: 0.82, labelW: 3.6 });
  s.addNotes(
    "lib/sales/calls/transfer.js and lib/sales/calls/queue.js.\n\nThe design point worth teaching: on a cold transfer you " +
    "stay in the room until the target actually answers. The obvious build — throw the caller across and drop your own leg — " +
    "was rejected because when the target does not pick up there is then nobody to give the caller back to, and they were " +
    "mid-sentence with a human thirty seconds ago.\n\nThe one case that cannot be recovered is you hanging up mid-transfer. " +
    "Then the caller goes to the hold queue instead, which ends at a voicemail rather than at nothing. So: do not hang up on " +
    "a transfer, wait the extra four seconds.\n\nTransfer only offers reps who are genuinely reachable. If a name is not in " +
    "the list, they are not there.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 15 — voicemail
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Voicemail, and the message with no words in it", "/sales/voicemail — messages left on your number, playable by you.");

  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.1, w: 5.4, h: 2.5, rectRadius: 0.14, fill: { color: NAVY } });
  s.addText("0s", {
    x: M + 0.4, y: 2.35, w: 4.6, h: 1.0, isTextBox: true, margin: 0,
    fontFace: "Cambria", fontSize: 54, bold: true, color: GOLD,
  });
  s.addText("no words spoken", {
    x: M + 0.4, y: 3.3, w: 4.6, h: 0.4, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 15, bold: true, color: WHITE,
  });
  s.addText("They rang back, heard the beep, and thought better of it. Warmer than a missed call, colder than a message — and worth a callback.", {
    x: M + 0.4, y: 3.72, w: 4.6, h: 0.8, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 12.5, color: ICE,
  });

  rows(s, [
    ["It is yours if they rang your number", "Even when we cannot work out who called. A contractor ringing from a mobile we have never seen matches nobody — the message is still for you, and dropping it would lose exactly the callbacks worth having."],
    ["The audio is served by us", "You play it inside FieldQuo, never off a link from the phone company. A provider URL carries no permission and hands a stranger's voice to whoever has it."],
  ], { y0: 5.0, h: 0.85, labelW: 3.9 });

  s.addText("Ring a zero-second message back the same day. Somebody dialled you on purpose.", {
    x: M + 5.9, y: 2.6, w: 5.8, h: 1.6, isTextBox: true,
    fontFace: "Cambria", fontSize: 22, italic: true, color: NAVY,
  });
  s.addNotes(
    "lib/sales/calls/voicemail.js and app/sales/voicemail/page.js.\n\nThis screen is new. Before it existed the only place a " +
    "sales voicemail could be played was the superadmin board — so the person the message was FOR could not hear it. The " +
    "owner's words were 'it seems kinda illogical'. Worth telling the room, because it is a good example of the standard " +
    "here: a thing that is written and never read gets fixed rather than explained away.\n\nThe zero-second message is the " +
    "teaching point. The recorder fires after a few seconds of silence, so a zero-length recording is somebody who rang, " +
    "heard the beep and hung up. Hiding it as 'empty' would throw away the warmest signal on the screen. It is the highest " +
    "intent contact a rep gets all week and most people ignore it.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 16 — texts
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Texts", "The first one is written for you. Everything after it is yours.");

  rows(s, [
    ["The first message is fixed", "Your name, FieldQuo, your signup link, our mailing address, and “Reply STOP to opt out”. You cannot compose it, and that is what makes a first contact legal. Sent from the lead."],
    ["Then it is a conversation", "They write back, you reply in your own words, in a thread that looks like your phone. You cannot start a free-text thread with a stranger — the first message has to be the one above."],
    ["08:00 – 21:00, their clock", "Flat, every day. 20:59 is in and 21:00 is out. Different from the calling window on purpose: nothing in Canadian law times a commercial text, so what binds it is the US rule."],
    ["One number for the floor", "Texts go out on FieldQuo's sales number, not your own calling number. Your conversations are still yours — no other rep can read them."],
    ["Every refusal is the server's", "The compose box does not decide. Suppression, the window and the mailing address are all re-read at the moment you press send."],
  ], { y0: 2.1, h: 0.88, labelW: 3.5 });
  s.addNotes(
    "CORRECTION: the written SOP says you can send exactly one fixed message and nothing comes back. Both halves are real " +
    "now — app/api/sales/messages POST, and /sales/messages is the screen.\n\nSecond correction, for anybody who reads the " +
    "recruitment material: your CALLS go out from your own assigned number, but your TEXTS go out from the one shared sales " +
    "number (lib/sales/salesSms.js, a 'sales'-purpose number). They are not the same number. Do not promise a contractor " +
    "they can text you back on the number that rang them.\n\nThe reason you cannot open a free-text thread cold: the first " +
    "message carries the identification the law wants on a first contact. Skipping it and typing 'hey, remember me?' is the " +
    "thing the 409 exists to stop.\n\nKeep replies short. Two SMS segments is the ceiling and one emoji re-encodes the whole " +
    "message and can quintuple its cost.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 17 — opt-outs
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "You never have to remember who said stop", "One list. Every channel. Read fresh at the moment of every send.");

  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.05, w: 11.7, h: 1.15, rectRadius: 0.14, fill: { color: NAVY } });
  s.addText("STOP", {
    x: M + 0.35, y: 2.05, w: 1.9, h: 1.15, isTextBox: true, margin: 0,
    fontFace: "Cambria", fontSize: 30, bold: true, color: GOLD, valign: "middle",
  });
  s.addText("→", {
    x: M + 2.3, y: 2.05, w: 0.6, h: 1.15, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 24, color: ICE, align: "center", valign: "middle",
  });
  ["calls", "texts", "email"].forEach((ch, i) => {
    s.addShape(p.ShapeType.roundRect, { x: M + 3.0 + i * 2.9, y: 2.3, w: 2.6, h: 0.65, rectRadius: 0.1, fill: { color: NAVY_ROW } });
    s.addText(ch, {
      x: M + 3.0 + i * 2.9, y: 2.3, w: 2.6, h: 0.65, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle",
    });
  });

  rows(s, [
    ["It lands the second it arrives", "A texted STOP is written across all three channels before anything else happens. So is “take me off your list” said on a call — pick that disposition and the same row is written, in the same transaction."],
    ["Nothing is deleted, ever", "Not by you, not by anybody. Lifting one takes a superadmin plus a written reason, and the evidence stays. So if a block looks wrong, say so rather than working around it."],
    ["One gap, and here it is", "The browser Call button refuses a suppressed number. The plain phone-link on the queue is gated on the prospect's own do-not-contact flag, not on the list. If you hear a stop, mark do-not-contact as well as texting nothing."],
  ], { y0: 3.5, h: 1.05, labelW: 3.6 });
  s.addNotes(
    "lib/sales/suppression.js. There is no delete function in that file and there must not be one — Canada's internal " +
    "do-not-call obligation runs three years and fourteen days, and removal is a 'removedAt' plus a mandatory reason, which " +
    "lifts the block and keeps the evidence.\n\nThe frame for a rep is not compliance, it is relief: thirty companies, four " +
    "channels, and you are never the person who has to remember. The list is re-read in the request that places the call or " +
    "sends the mail — a stale screen from two minutes ago cannot authorise anything.\n\nBe honest about the gap on the third " +
    "row. It is real: app/sales/queue does not read the suppression list before rendering the handset link, only the " +
    "prospect's do-not-contact flag. Marking do-not-contact when you hear one closes it. Tell them we know, and that saying " +
    "so beats pretending.\n\nIf the list cannot be read at all, the call is refused rather than risked. 'We could not check' " +
    "is not permission.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 18 — PRACTICE 3
// ═══════════════════════════════════════════════════════════════════════════
practice(
  3,
  "You are ninety seconds in and going well. He cuts across you:\n“Don't call me again.”",
  "What do you say, and what do you press?",
  "Say almost nothing. 'Understood — I'll take you off our list now. Sorry to have bothered you.' Then stop talking. Every " +
  "extra sentence is a rep trying to win back a call that is already over, and it is the sentence that turns an opt-out into " +
  "a complaint.\n\nDo NOT ask why. Do not offer to email instead. Do not say 'can I just send you the link'. Email is closed " +
  "too, the moment you press the button.\n\nWhat you press: disposition 'Asked not to be called again', and type his words " +
  "in the note — it will not save without them, and it is permanent. That writes the opt-out across calls, texts and email " +
  "in the same transaction as the disposition, and it marks the prospect do-not-contact so the dial control disappears.\n\n" +
  "Then say the thing the room needs to hear: this is not a failure and nobody is judged on it. A rep who is nervous about " +
  "opt-outs starts fudging them, and a fudged opt-out is the one that costs FieldQuo real money. Nine of these a week is a " +
  "rep working the phone properly.",
);

// ═══════════════════════════════════════════════════════════════════════════
// 19 — the second job
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Your second job starts the day they sign", {
    x: M, y: 0.85, w: 11.7, h: 0.85, isTextBox: true,
    fontFace: "Cambria", fontSize: 34, bold: true, color: WHITE,
  });
  s.addText("A signup that cancels in five weeks pays you twice. One that is still there at day 60 pays you three times.", {
    x: M, y: 1.72, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Calibri", fontSize: 16, color: ICE,
  });

  const beats = [
    ["Day 0", "They sign up. Nothing to check in on yet — they have not used it."],
    ["Day 3", "First check-in. Long enough that a first quote has either happened or conspicuously not happened."],
    ["Every ~15 days", "The cadence guard. A quarter of the retention window, so you are attentive rather than nagging."],
    ["Day 60", "The retention milestone. The third and largest commission, and the only one you can still influence."],
  ];
  let x = M;
  beats.forEach((b) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.6, w: 2.75, h: 2.4, rectRadius: 0.14, fill: { color: NAVY_ROW } });
    s.addText(b[0], {
      x: x + 0.28, y: 2.8, w: 2.19, h: 0.55, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 24, bold: true, color: GOLD,
    });
    s.addText(b[1], {
      x: x + 0.28, y: 3.4, w: 2.19, h: 1.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: ICE,
    });
    x += 2.95;
  });

  s.addText("The screen remembers all thirty companies for you, ranks them, and tells you WHY each one came up. You choose who to text and what to say.", {
    x: M, y: 5.35, w: 11.7, h: 0.7, isTextBox: true,
    fontFace: "Cambria", fontSize: 17, italic: true, color: ICE,
  });
  s.addNotes(
    "lib/sales/checkin/signals.js. FIRST_CHECKIN_DAY is 3; the cadence guard is a quarter of the retention window, clamped " +
    "between 7 and 30 days, so 15 on today's 60-day plan.\n\nThe money framing is on the pay deck and you should not " +
    "re-teach it here — just make the connection: the third stage exists because a signup that never pays is not a sale, and " +
    "it is the stage that rewards selling to somebody who needed it rather than closing anybody who answers.\n\nSixty days " +
    "is a long time to remember thirty companies by hand. That is the honest reason this screen exists, and it is how to " +
    "introduce it — not as management watching, as the thing that stops good customers quietly falling off the end of a " +
    "rep's memory.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 20 — why a check-in is due
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Why a company came up, ranked", "Work the top of the list. A card failing today outranks a set-up step outstanding since Tuesday.");

  const reasons = [
    ["Their payment is failing", "90", RED],
    ["Their free period ends before day 60", "80", RED],
    ["They cannot take a payment yet", "60", NAVY],
    ["They never finished onboarding", "55", NAVY],
    ["Set-up steps still open", "40", NAVY],
    ["The milestone is close", "35", NAVY],
    ["We cannot see how they are doing", "30", GOLD],
    ["Nothing looks wrong — say hello", "10", MUTED],
  ];
  let y = 2.1;
  reasons.forEach((r) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.47, fill: { color: CARD } });
    s.addShape(p.ShapeType.rect, { x: M, y, w: 0.12, h: 0.47, fill: { color: r[2] } });
    s.addText(r[0], {
      x: M + 0.35, y, w: 8.5, h: 0.47, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: INK, valign: "middle",
    });
    s.addText(r[1], {
      x: M + 9.2, y, w: 2.2, h: 0.47, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 15, bold: true, color: r[2], align: "right", valign: "middle",
    });
    y += 0.55;
  });

  s.addText("“We cannot see how they are doing” sits ABOVE “nothing looks wrong”, deliberately. Not knowing is a worse place to be than knowing things are fine, and the order has to say so.", {
    x: M, y: 6.55, w: 11.7, h: 0.6, isTextBox: true,
    fontFace: "Calibri", fontSize: 13.5, italic: true, color: NAVY,
  });
  s.addNotes(
    "CHECKIN_REASONS in lib/sales/checkin/signals.js, with the urgency numbers shown so the room can see it is an order, not " +
    "a mood.\n\nThe evidence is deliberately superficial — signup date, subscription status, whether payouts are connected, " +
    "which set-up steps are open. You are not reading a customer's quotes to write a 'how's it going' text, and nothing here " +
    "asks you to. That boundary is the same rule that makes the platform console read-only on a tenant's data.\n\n'Nothing " +
    "looks wrong, say hello' is a legitimate reason, not a problem dressed up as one. The owner asked for it in those words. " +
    "Do not let a rep treat it as filler — it is the check-in that keeps a happy customer happy.\n\nSome companies will not " +
    "come up at all, and the screen says why: a demo company, a subscription that already ended, or they were checked in on " +
    "recently. Absence of a row is explained, never blank.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 21 — the drafted text
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "The check-in text writes itself. You still send it.", "A draft, in words, from facts we already read. Nothing sends on a schedule.");

  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.1, w: 5.4, h: 2.35, rectRadius: 0.14, fill: { color: CARD } });
  s.addText("What it may do", {
    x: M + 0.32, y: 2.28, w: 4.76, h: 0.4, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY,
  });
  s.addText(
    "Say the same true things more like a person would say them.",
    { x: M + 0.32, y: 2.7, w: 4.76, h: 1.5, isTextBox: true, margin: 0, fontFace: "Calibri", fontSize: 13.5, color: MUTED },
  );

  s.addShape(p.ShapeType.roundRect, { x: M + 6.3, y: 2.1, w: 5.4, h: 2.35, rectRadius: 0.14, fill: { color: CARD } });
  s.addText("What it may not do", {
    x: M + 6.62, y: 2.28, w: 4.76, h: 0.4, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 15, bold: true, color: RED,
  });
  s.addText(
    "Add a number, a price, a link or an emoji. A model that decides they have “3 quotes waiting” has invented a fact about somebody's business — and you would send it, because it reads exactly like the true ones.",
    { x: M + 6.62, y: 2.7, w: 4.76, h: 1.6, isTextBox: true, margin: 0, fontFace: "Calibri", fontSize: 13, color: MUTED },
  );

  rows(s, [
    ["Refused, or the model is down?", "You get the plain version. The worst outcome is duller wording, never an empty box."],
    ["Read it before you send it", "It is a draft with your name going out on it. Edit it. The screen expects you to."],
  ], { y0: 4.75, h: 0.85, labelW: 3.9 });
  s.addNotes(
    "lib/sales/checkin/draft.js. Every fact in the message came out of rows somebody already read; the model rephrases and " +
    "learns nothing new. The gate rejects a URL, a price, an emoji, and any number that is not one of the numbers we " +
    "established.\n\nTwo SMS segments, 306 characters, and every deterministic sentence is typed with a plain hyphen and a " +
    "plain apostrophe on purpose — one curly quote re-encodes the whole message and turns two segments into five.\n\nIf " +
    "somebody asks whether this spends the customer's AI allowance: no. It is metered against FieldQuo's own platform " +
    "budget. A retention text that degraded because the contractor used their own copilot a lot would be exactly backwards.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 22 — support
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "When it is broken, not when it is a question", "/sales/support — a ticket about one of YOUR companies, with a thread you can follow.");

  rows(s, [
    ["Only your own book", "You raise a ticket about a company attributed to you. The server re-reads that attribution before it writes anything — the company id you send is a request, not a grant."],
    ["Say how urgent it is", "Low, normal, high, urgent. Leave it out and it is normal. Send something we do not recognise and it is refused rather than quietly downgraded to normal."],
    ["It tells you if nobody is on it", "“Recorded, nobody assigned yet” is a real answer and the screen says it in words. A ticket that showed “Open” either way would be the reassuring lie this channel exists to stop."],
    ["Three states, and no fourth", "Open, in progress, resolved. Something that turns out not to be fixed is reopened rather than replaced by a second ticket that loses the first one's history."],
  ], { y0: 2.15, h: 1.0, labelW: 3.6 });

  s.addText("Raise it while you are still on the phone with them. A problem you meant to write up after lunch is a problem the contractor reported to nobody.", {
    x: M, y: 6.7, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 17, italic: true, color: NAVY,
  });
  s.addNotes(
    "lib/support/repClient.js and lib/support/escalation.js.\n\nDraw the line for them: this is for something that does not " +
    "work. 'How do I add a crew member' is a question you answer, or look up in the feature reference. 'Their quote PDF is " +
    "coming out with no logo' is a ticket.\n\nThe boundary that matters: a support ticket is FieldQuo's note about a " +
    "contractor's problem. Nothing on this path touches their quotes, clients or invoices — we look, we do not edit. Same " +
    "rule as the platform console.\n\nWorth saying that the reason this exists at all is that reports were evaporating: a " +
    "rep heard something on a call, meant to mention it, and never did. The channel is the fix.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 23 — pay, one slide
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Where the money comes from", "One slide. There is a whole deck on this and we will go through it properly.");

  const stages = [
    ["Stage 1", "They sign up"],
    ["Stage 2", "They pay their first real invoice"],
    ["Stage 3", "They are still there at the milestone"],
  ];
  let x = M;
  stages.forEach((t, i) => {
    s.addShape(p.ShapeType.roundRect, { x, y: 2.15, w: 3.7, h: 1.6, rectRadius: 0.14, fill: { color: i === 2 ? NAVY : CARD } });
    s.addText(t[0], {
      x: x + 0.3, y: 2.35, w: 3.1, h: 0.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, bold: true, color: GOLD, charSpacing: 1,
    });
    s.addText(t[1], {
      x: x + 0.3, y: 2.75, w: 3.1, h: 0.8, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 16, bold: true, color: i === 2 ? WHITE : INK,
    });
    x += 4.0;
  });

  rows(s, [
    ["Set the Pay tab today", "How you want the money and where it goes. Nobody is paid until it is set, and a method with no destination is refused rather than saved half-done."],
    ["Nobody can touch your record — us included", "Your attribution, commission and payouts refuse every write from a rep account. You cannot adjust your own, and neither can anybody else quietly adjust it for you."],
    ["Ask if you have no plan", "With no commission plan assigned you earn nothing, silently. Check it on day one — it is one question to a superadmin."],
  ], { y0: 4.05, h: 0.82, labelW: 4.3 });
  s.addNotes(
    "Do not do the arithmetic here. That is the pay deck — How-you-get-paid.pptx — and it has the milestone amounts, the " +
    "timing of each release and the honest build-up maths. Say the deck exists and move on.\n\nThe two things they need " +
    "TODAY are on this slide. First, set the Pay tab in the first ten minutes: nobody is paid until it is set. Second, ask " +
    "whether a commission plan is assigned to them, because with no plan the earnings function returns nothing rather than " +
    "guessing an amount, and it does it quietly.\n\nThe rep-account write refusal is worth landing properly. It reads like a " +
    "restriction and it is a protection: the reason nobody can quietly adjust your record is the same reason you cannot " +
    "adjust it yourself.",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 24 — close
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Before you go home today", {
    x: M, y: 1.05, w: 10.5, h: 0.9, isTextBox: true,
    fontFace: "Cambria", fontSize: 42, bold: true, color: WHITE,
  });

  const steps = [
    "Set your Pay tab, and ask whether you have a commission plan",
    "Send your signup link to yourself and open it",
    "Claim one prospect and read all four layers before you touch the phone",
    "Make the call. Type while they talk",
    "Close the claim out and say what happened",
  ];
  let y = 2.35;
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
    y += 0.8;
  });

  s.addText("Nobody expects you to sell today. They expect you to listen, take a note, and close the claim out properly.", {
    x: M, y: 6.35, w: 11.7, h: 0.6, isTextBox: true,
    fontFace: "Cambria", fontSize: 18, italic: true, color: ICE,
  });
  s.addNotes(
    "Hand out the written SOP now, not earlier, and tell them what it is for: it is the reference for week one, it names the " +
    "screen or the function behind every step, and it is honest about the rough edges. Also tell them it has drifted in " +
    "three places we corrected today — the calling window, the number of screens, and texts being two-way — and that when " +
    "the screen and a document disagree, the screen wins and they should tell somebody.\n\nEnd on the last line. The " +
    "temptation on day one is to try to close, and a new rep who is trying to close is not listening. The first week's job " +
    "is fifty good notes.\n\nThen sit next to them for the first call. Do not take the headset.",
  );
}

p.writeFile({ fileName: "Training-day-one.pptx" }).then((f) => console.log("wrote", f));
