// Every text/background pair an email can produce, measured across the brand
// colours contractors actually pick. AGENTS.md rule 6.
import { renderTemplateSections } from "@/lib/email/renderTemplateSections";
import { buildReviewEmail } from "@/lib/reviews/reviewEmail";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${got}` : ""}`); } };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const HOSTILE = {
  "school-bus yellow": "#FFDD00", "pure white": "#FFFFFF", "pure black": "#000000",
  "mid grey": "#808080", "safety orange": "#FF6600", "lime": "#CCFF00",
  "navy": "#001F3F", "default blue": "#2563EB", "pale mint": "#D9F2E6",
  "hot pink": "#FF1493", "olive": "#6B7A3A", "mid teal": "#3F8F8F",
};

// The pairs a real email actually renders, pulled out of the HTML rather than
// recomputed — a check that recomputes the maths can agree with a bug.
const buttonPair = (html) => {
  const m = html.match(/background:(#[0-9a-fA-F]{6});color:(#[0-9a-fA-F]{6})/);
  return m ? [m[1], m[2]] : null;
};

console.log("\nCustom template CTA button (the block companies edit)");
for (const [name, hex] of Object.entries(HOSTILE)) {
  const html = renderTemplateSections(
    [{ type: "button", label: "View your quote", url: "https://x.com" }],
    {},
    { company: { name: "Acme", brandColor: hex } },
  );
  const p = buttonPair(html);
  if (!p) { ok(`${name} — button rendered`, false); continue; }
  const r = ratio(p[0], p[1]);
  ok(`${name.padEnd(18)} ${p[0]} on ${p[1]} = ${r.toFixed(2)}:1`, r >= 4.5, r.toFixed(2));
}

console.log("\nA company's explicitly chosen button colour");
for (const [name, hex] of Object.entries(HOSTILE)) {
  const html = renderTemplateSections(
    [{ type: "button", label: "Pay now", url: "https://x.com", bg: hex }],
    {}, { company: { name: "Acme", brandColor: "#2563EB" } },
  );
  const p = buttonPair(html);
  const r = ratio(p[0], p[1]);
  ok(`bg=${name.padEnd(18)} = ${r.toFixed(2)}:1`, r >= 4.5, r.toFixed(2));
}

console.log("\nAn explicit TEXT colour is still honoured, even if poor");
const forced = renderTemplateSections(
  [{ type: "button", label: "Go", url: "https://x.com", bg: "#FFDD00", color: "#FFFFFF" }],
  {}, { company: { name: "Acme" } },
);
ok("their colour is used, not overruled", forced.includes("#FFDD00") && forced.includes("#FFFFFF"));

console.log("\nReview email button (already fixed, kept honest)");
for (const [name, hex] of Object.entries(HOSTILE)) {
  const out = buildReviewEmail({ company: { name: "Acme", brandColor: hex, reviewUrl: "https://g.page/r/x" }, client: {} });
  const p = buttonPair(out.html);
  const r = ratio(p[0], p[1]);
  ok(`${name.padEnd(18)} = ${r.toFixed(2)}:1`, r >= 4.5, r.toFixed(2));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
