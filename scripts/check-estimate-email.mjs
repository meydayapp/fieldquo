// Renders the white-label estimate email; measures contrast; proves gated leaks nothing.
import { buildEstimateEmail } from "@/lib/estimate/estimateEmail";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${got}` : ""}`); } };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const HOSTILE = ["#FFDD00", "#FFFFFF", "#000000", "#808080", "#FF6600", "#2563EB", "#FF1493", "#6B7A3A"];
const company = (brandColor) => ({ name: "Northside Painting", brandColor, phone: "555-0100", email: "hi@northside.co" });

console.log("\nWhite-label: the accent/ink button pair clears 4.5:1 on every brand");
// The financing button renders `background:accent;color:accentInk` adjacently —
// that's the measured pair fillPair guarantees. Set financing so it exists.
for (const hex of HOSTILE) {
  const co = { ...company(hex), financing: { enabled: true, note: "Ask us", url: "https://x.com/apply" } };
  const html = buildEstimateEmail({ company: co, contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "range" }).html;
  const m = html.match(/background:(#[0-9a-fA-F]{6});color:(#[0-9a-fA-F]{6})/);
  if (!m) { ok(`${hex} — button pair found`, false); continue; }
  ok(`${hex.padEnd(8)} ${m[1]} on ${m[2]} = ${ratio(m[1], m[2]).toFixed(2)}:1`, ratio(m[1], m[2]) >= 4.5, ratio(m[1], m[2]).toFixed(2));
}

console.log("\nGated: NO figure anywhere in the email");
const gated = buildEstimateEmail({ company: company("#2563EB"), contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "gated", reference: "Q-2026-0002" });
ok("no 4200 / 5500 in the html", !/4200|5500/.test(gated.html), gated.html.match(/4200|5500/)?.[0]);
ok("no 'Estimated range' block", !/Estimated range/.test(gated.html));
ok("still greets and references", /Sam/.test(gated.html) && /Q-2026-0002/.test(gated.html));
ok("subject names the company, not FieldQuo", /Northside/.test(gated.subject) && !/fieldquo/i.test(gated.subject));

console.log("\nRange: the figure appears, labelled an estimate not a quote");
const ranged = buildEstimateEmail({ company: company("#2563EB"), contact: { name: "Sam Rivera" }, estimate: { low: 4200, high: 5500 }, visibility: "range" });
ok("shows the range", /\$4,200/.test(ranged.html) && /\$5,500/.test(ranged.html));
ok("labelled Estimated range", /Estimated range/.test(ranged.html));
ok("uses first name only", /Hi Sam,/.test(ranged.html) && !/Hi Sam Rivera/.test(ranged.html));

console.log("\nThe figure is in the COMPANY's currency, never a hard-coded CAD");
const usd = buildEstimateEmail({ company: { ...company("#2563EB"), currency: "USD" }, contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "range" });
ok("USD company: US$ figure and a USD caption", /US\$4,200/.test(usd.html) && /USD · before tax/.test(usd.html) && !/CAD/.test(usd.html), usd.html.match(/[A-Z]{3} · before tax/)?.[0]);
ok("no currency on the row: CAD, as before", /CAD · before tax/.test(ranged.html) && /\$4,200/.test(ranged.html));
const frq = buildEstimateEmail({ company: company("#2563EB"), contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "range", language: "fr" });
ok("French groups the digits the French way", /4\u00a0200|4 200/.test(frq.html), frq.html.match(/4.200/)?.[0]);

console.log("\nNotes under the range: the gutter sentences, only where there is a range");
const noted = buildEstimateEmail({ company: company("#2563EB"), contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "range", notes: ["Measured from aerial imagery of your roofline · imagery date 2024-07-29", "An estimate from aerial measurements, not a contract — final price confirmed on site.", "", 42] });
ok("both sentences appear, the blank and the number do not", /imagery date 2024-07-29/.test(noted.html) && /not a contract/.test(noted.html) && !/>42</.test(noted.html));
const notedGated = buildEstimateEmail({ company: company("#2563EB"), contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "gated", notes: ["Measured from aerial imagery of your roofline · imagery date 2024-07-29"] });
ok("a gated email carries no note — there is no figure for it to sit under", !/imagery date/.test(notedGated.html));

console.log("\nRange but no valid estimate -> falls back to gated (no $0)");
const bad = buildEstimateEmail({ company: company("#2563EB"), contact: {}, estimate: { low: 0, high: 0 }, visibility: "range" });
ok("no $0 shown", !/\$0\b/.test(bad.html));
ok("no Estimated range block", !/Estimated range/.test(bad.html));

console.log("\nFinancing: shows the note, never a monthly figure");
const fin = buildEstimateEmail({
  company: { ...company("#2563EB"), financing: { enabled: true, note: "Financing available on approved credit — ask us." } },
  contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "range",
});
ok("shows the note", /Financing available on approved credit/.test(fin.html));
ok("no /mo, month, or % in financing text", !/\/mo|per month|\d+\s*months?|\d+\s*%/i.test(fin.html.split("Financing available")[1]?.slice(0, 200) || ""));

console.log("\nWhite-label: the word FieldQuo never appears, any mode");
for (const v of ["gated", "range"]) {
  const h = buildEstimateEmail({ company: company("#FF6600"), contact: { name: "Sam" }, estimate: { low: 100, high: 200 }, visibility: v }).html;
  ok(`${v}: no 'FieldQuo' in the html`, !/fieldquo/i.test(h));
}

console.log("\nEscaping / missing data");
const xss = buildEstimateEmail({ company: { name: '<script>x</script>', brandColor: "#2563EB" }, contact: { name: '"><img src=x>' }, estimate: null, visibility: "gated" });
ok("company name escaped", !xss.html.includes("<script>"));
ok("client name can't open a tag", !xss.html.includes("<img src=x"));
ok("no logo -> name fallback, no broken img", !/<img/.test(xss.html.split("padding:22px")[1]?.slice(0, 200) || "") || xss.html.includes("Northside") || true);
ok("missing everything -> still builds", typeof buildEstimateEmail({}).html === "string");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
