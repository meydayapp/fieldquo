import { contrastRatio } from "@/lib/brand/colour";
const pairs = [
  ["#ffffff", "#111827", "header text on ink"],
  ["#111827", "#ffffff", "body ink on card"],
  ["#4b5563", "#ffffff", "MUTED warning on card"],
  ["#9ca3af", "#ffffff", "FAINT fallback on card"],
  ["#9ca3af", "#f5f5f5", "FAINT footnote on page"],
  ["#6b7280", "#ffffff", "grey-500 on card"],
  ["#6b7280", "#f5f5f5", "grey-500 on page"],
  ["#5b6472", "#f5f5f5", "darker on page"],
  ["#57606f", "#f5f5f5", "darker2 on page"],
  ["#ffffff", "#111827", "cta text on ink"],
];
for (const [fg, bg, label] of pairs) console.log(contrastRatio(fg, bg).toFixed(2).padStart(6), label, `${fg} on ${bg}`);
