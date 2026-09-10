// How you get paid — the deck for a recruiting / kickoff meeting.
// Palette: Midnight Executive. Motif: numbered circles + card blocks.
const pptxgen = require("pptxgenjs");

const NAVY = "1E2761";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const INK = "1B1B1F";
const MUTED = "5A6070";
const GOLD = "C8A44D";
const CARD = "F4F6FB";

const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
p.author = "FieldQuo";
p.title = "How you get paid";

const W = 13.3;
const M = 0.8;

function titleSlide() {
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("How you get paid", {
    x: M, y: 2.3, w: 9.5, h: 1.1, isTextBox: true,
    fontFace: "Cambria", fontSize: 54, bold: true, color: WHITE,
  });
  s.addText("Commission structure for FieldQuo sales closers · all amounts in Canadian dollars", {
    x: M, y: 3.5, w: 9.5, h: 0.6, isTextBox: true,
    fontFace: "Calibri", fontSize: 20, color: ICE,
  });
  s.addShape(p.ShapeType.roundRect, {
    x: M, y: 4.6, w: 3.4, h: 0.85, rectRadius: 0.12,
    fill: { color: GOLD },
  });
  s.addText("$125 CAD per customer", {
    x: M, y: 4.6, w: 3.4, h: 0.85, isTextBox: true, margin: 0,
    fontFace: "Calibri", fontSize: 20, bold: true, color: NAVY,
    align: "center", valign: "middle",
  });
  s.addNotes("Open here. The number is real but it arrives in three stages — that is the whole point of the next slide.");
  return s;
}

function stagesSlide() {
  const s = p.addSlide();
  s.background = { color: WHITE };
  s.addText("Three stages, not one payment", {
    x: M, y: 0.55, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 38, bold: true, color: NAVY,
  });
  s.addText("Each stage is a funded Upwork milestone, released as it is earned. All amounts CAD.", {
    x: M, y: 1.35, w: 11.7, h: 0.45, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, color: MUTED,
  });

  const stages = [
    { n: "1", amt: "$20", label: "Activation", when: "They finish payment setup", day: "Day 0" },
    { n: "2", amt: "$40", label: "First billing cycle", when: "Their first real payment succeeds", day: "~Day 30" },
    { n: "3", amt: "$65", label: "Retention", when: "Still subscribed 60 days after signing up", day: "Day 60" },
  ];

  let x = M;
  const cw = 3.7, gap = 0.4;
  stages.forEach((st) => {
    s.addShape(p.ShapeType.roundRect, {
      x, y: 2.1, w: cw, h: 3.2, rectRadius: 0.14,
      fill: { color: CARD },
      shadow: { type: "outer", angle: 90, blur: 10, offset: 2, opacity: 0.10, color: NAVY },
    });
    s.addShape(p.ShapeType.ellipse, { x: x + 0.32, y: 2.42, w: 0.62, h: 0.62, fill: { color: NAVY } });
    s.addText(st.n, {
      x: x + 0.32, y: 2.42, w: 0.62, h: 0.62, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 20, bold: true, color: WHITE, align: "center", valign: "middle",
    });
    s.addText(st.amt, {
      x: x + 1.08, y: 2.34, w: 2.3, h: 0.8, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 44, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(st.label, {
      x: x + 0.32, y: 3.28, w: cw - 0.64, h: 0.4, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 17, bold: true, color: INK,
    });
    s.addText(st.when, {
      x: x + 0.32, y: 3.72, w: cw - 0.64, h: 0.9, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: MUTED,
    });
    s.addText(st.day, {
      x: x + 0.32, y: 4.72, w: cw - 0.64, h: 0.35, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, bold: true, color: GOLD,
    });
    x += cw + gap;
  });

  s.addText("One sale therefore pays out across roughly two months — as three separate releases.", {
    x: M, y: 5.6, w: 11.7, h: 0.4, isTextBox: true,
    fontFace: "Calibri", fontSize: 16, italic: true, color: NAVY,
  });
  s.addNotes("Stress that stage 3 is 60 days out. This is why the first month of earnings looks thinner than the run rate.");
  return s;
}

function timingSlide() {
  const s = p.addSlide();
  s.background = { color: WHITE };
  s.addText("What it builds to", {
    x: M, y: 0.55, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 38, bold: true, color: NAVY,
  });
  s.addText("100 activations a month — about 5 a working day — and when the money actually lands. CAD.", {
    x: M, y: 1.35, w: 11.7, h: 0.4, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, color: MUTED,
  });

  s.addChart(p.ChartType.bar, [
    { name: "Activation ($20)", labels: ["Month 1", "Month 2", "Month 3", "Month 4"], values: [2000, 2000, 2000, 2000] },
    { name: "First cycle ($40)", labels: ["Month 1", "Month 2", "Month 3", "Month 4"], values: [0, 4000, 4000, 4000] },
    { name: "Retention ($65)", labels: ["Month 1", "Month 2", "Month 3", "Month 4"], values: [0, 0, 6500, 6500] },
  ], {
    x: M, y: 1.95, w: 7.4, h: 4.3,
    barGrouping: "stacked",
    chartColors: [NAVY, "4A6FA5", GOLD],
    showTitle: false,
    showValue: true, dataLabelPosition: "ctr", dataLabelColor: WHITE, dataLabelFontSize: 10,
    showLegend: true, legendPos: "b", legendFontSize: 11,
    catAxisLabelColor: MUTED, valAxisLabelColor: MUTED,
    valGridLine: { color: "E4E8F0", size: 1 },
    catGridLine: { style: "none" },
  });

  s.addShape(p.ShapeType.roundRect, { x: 8.6, y: 2.0, w: 3.9, h: 1.45, rectRadius: 0.14, fill: { color: CARD } });
  s.addText([
    { text: "$12,500\n", options: { fontSize: 36, bold: true, color: NAVY, fontFace: "Cambria" } },
    { text: "CAD a month, from month three", options: { fontSize: 13, color: MUTED } },
  ], { x: 8.85, y: 2.15, w: 3.4, h: 1.15, isTextBox: true, margin: 0, fontFace: "Calibri" });

  s.addShape(p.ShapeType.roundRect, { x: 8.6, y: 3.6, w: 3.9, h: 1.15, rectRadius: 0.14, fill: { color: NAVY } });
  s.addText([
    { text: "$150,000\n", options: { fontSize: 28, bold: true, color: WHITE, fontFace: "Cambria" } },
    { text: "CAD annualised at that rate", options: { fontSize: 12, color: ICE } },
  ], { x: 8.85, y: 3.75, w: 3.4, h: 0.9, isTextBox: true, margin: 0, fontFace: "Calibri" });

  s.addText([
    { text: "Month three is when you are whole.", options: { bold: true, color: INK }, breakLine: true },
    { text: "Months one and two are not a worse rate — they are the same rate, with two thirds of it still in transit.", options: { color: MUTED } },
  ], { x: 8.6, y: 4.95, w: 3.9, h: 1.3, isTextBox: true, fontFace: "Calibri", fontSize: 13 });

  s.addNotes("100 a month is 5 a working day. Be straight that months one and two are the ramp: the rate never changes, but the retention third has not arrived yet. A closer who is not told this concludes in week six that the offer was oversold.");
  return s;
}

function upworkSlide() {
  const s = p.addSlide();
  s.background = { color: WHITE };
  s.addText("How it is paid through Upwork", {
    x: M, y: 0.55, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 38, bold: true, color: NAVY,
  });
  s.addText("Funded milestones on one contract — the same way Upwork works for any fixed-price project.", {
    x: M, y: 1.35, w: 11.7, h: 0.45, isTextBox: true,
    fontFace: "Calibri", fontSize: 15, color: MUTED,
  });

  const rows = [
    { h: "One contract, many milestones", b: "Your contract stays open while you sell. Each customer you close adds three milestones to it — you are not re-hired per sale." },
    { h: "Each milestone is funded before it is released", b: "The money sits in Upwork escrow with your name on it. You can see it is there before you have been paid, which is the point of using milestones rather than a bonus." },
    { h: "Named so you can check it", b: "Northline Painting — Activation. Northline Painting — First cycle. You always know which customer and which stage a payment is for." },
    { h: "Five days from release to available", b: "Upwork holds released funds for a five-day security period. That is Upwork's rule, not ours — plan your first month around it." },
  ];

  let y = 1.95;
  rows.forEach((r, i) => {
    s.addShape(p.ShapeType.ellipse, { x: M, y: y + 0.06, w: 0.44, h: 0.44, fill: { color: i % 2 ? "4A6FA5" : NAVY } });
    s.addText(String(i + 1), {
      x: M, y: y + 0.06, w: 0.44, h: 0.44, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle",
    });
    s.addText(r.h, {
      x: M + 0.7, y, w: 11.0, h: 0.38, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 18, bold: true, color: INK,
    });
    s.addText(r.b, {
      x: M + 0.7, y: y + 0.38, w: 11.0, h: 0.72, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: MUTED,
    });
    y += 1.22;
  });

  s.addNotes("Milestones, not bonuses — deliberately. A bonus needs no escrow, which means the rep has no way to see the money exists before it arrives. Escrow is the reassurance a good closer asks for.");
  return s;
}

function honestSlide() {
  const s = p.addSlide();
  s.background = { color: NAVY };
  s.addText("Three things worth saying out loud", {
    x: M, y: 0.7, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Cambria", fontSize: 38, bold: true, color: WHITE,
  });

  const cards = [
    { h: "The third stage can be reversed", b: "If a customer refunds or charges back after you have been paid, that amount is netted against your next week. It is rare. You will always see why." },
    { h: "Paid in Canadian dollars", b: "Every figure here is CAD. Upwork also takes its own service fee from your side — ask what you actually receive on $125 CAD before you start, not after." },
    { h: "Month one is the thin one", b: "Two thirds of a sale pays out on days 30 and 60. Your first month understates your run rate by design." },
  ];

  let x = M;
  const cw = 3.7, gap = 0.4;
  cards.forEach((c) => {
    s.addShape(p.ShapeType.roundRect, {
      x, y: 2.0, w: cw, h: 3.3, rectRadius: 0.14, fill: { color: "2A3A78" },
    });
    s.addText(c.h, {
      x: x + 0.34, y: 2.3, w: cw - 0.68, h: 0.8, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 18, bold: true, color: GOLD,
    });
    s.addText(c.b, {
      x: x + 0.34, y: 3.15, w: cw - 0.68, h: 1.9, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 14, color: ICE,
    });
    x += cw + gap;
  });

  s.addText("We would rather lose you at the interview than at your first payout.", {
    x: M, y: 5.7, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 19, italic: true, color: WHITE,
  });
  s.addNotes("Do not skip this slide. A closer who finds out about the fee or the 60-day lag later will disengage, and they will be right to.");
  return s;
}

titleSlide();
stagesSlide();
timingSlide();
upworkSlide();
honestSlide();


// A local heading, matching How-you-work-SOP.pptx so the two decks read as one
// pack. Defined here rather than imported: these generators are standalone
// scripts on purpose — a shared module would need a build step to run them.
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

// ── Choosing how you are paid ───────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Choosing how you are paid", "The Pay tab in the portal. Set it on day one — nobody is paid until it is set.");

  const methods = [
    ["Upwork", "Released against the contract's milestones. Upwork's own fee comes off what lands, so the figure in the ledger is what FieldQuo sends, not what arrives."],
    ["PayPal", "A PayPal transfer. Fees depend on the receiving account's country and type."],
    ["Interac e-Transfer", "Canadian accounts only. Usually free and same-day."],
    ["Bank transfer", "Slowest to arrive, cheapest to send. Best if you are being paid a large batch at once."],
  ];
  let y = 2.35;
  methods.forEach((m) => {
    s.addShape(p.ShapeType.rect, { x: M, y, w: 11.7, h: 0.92, fill: { color: CARD } });
    s.addText(m[0], {
      x: M + 0.25, y: y + 0.08, w: 3.2, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 15, bold: true, color: NAVY, valign: "middle",
    });
    s.addText(m[1], {
      x: M + 3.6, y: y + 0.08, w: 7.8, h: 0.76, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 12.5, color: MUTED, valign: "middle",
    });
    y += 1.05;
  });
  s.addText("Each trade-off is printed beside the choice, before you make it — not discovered when the money arrives short.", {
    x: M, y: 6.15, w: 11.7, h: 0.5, isTextBox: true,
    fontFace: "Cambria", fontSize: 15, italic: true, color: INK,
  });
  s.addNotes("A method with no destination is refused rather than saved. Half-set details read as done on every other screen, and that is how money goes nowhere.");
}

// ── Freelancer or employee ──────────────────────────────────────────────────
{
  const s = p.addSlide();
  s.background = { color: WHITE };
  heading(s, "Freelancer or employee", "FieldQuo sets this. You can see it, and query it, but you do not pick it.");

  const cols = [
    { t: "Freelancer", body: "You invoice for your commission. No paid leave, no vacation accrual, and no statutory deductions withheld by FieldQuo — you account for your own." },
    { t: "Employee", body: "On payroll. Paid leave accrues, and statutory deductions are FieldQuo's to withhold and remit." },
  ];
  let x = M;
  cols.forEach((c) => {
    s.addShape(p.ShapeType.rect, { x, y: 2.4, w: 5.65, h: 2.6, fill: { color: CARD } });
    s.addText(c.t, {
      x: x + 0.35, y: 2.7, w: 5.0, h: 0.6, isTextBox: true, margin: 0,
      fontFace: "Cambria", fontSize: 24, bold: true, color: NAVY,
    });
    s.addText(c.body, {
      x: x + 0.35, y: 3.35, w: 5.0, h: 1.5, isTextBox: true, margin: 0,
      fontFace: "Calibri", fontSize: 13, color: MUTED,
    });
    x += 6.05;
  });
  s.addText("It is an employment classification with tax and leave consequences, so it is not something to choose for yourself. If what the screen shows is wrong, say so and it is corrected.", {
    x: M, y: 5.35, w: 11.7, h: 0.8, isTextBox: true,
    fontFace: "Calibri", fontSize: 14, color: INK,
  });
  s.addNotes("Say this plainly in the interview. Getting classification wrong is FieldQuo's problem, not the rep's, which is exactly why the rep does not set it.");
}

p.writeFile({ fileName: "How-you-get-paid.pptx" }).then((f) => console.log("wrote", f));
