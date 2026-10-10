// app/site/[subdomain]/BeforeAfter.js
//
// The slider moved to app/components/public/BeforeAfter.js on 2026-10-10 so
// the website and the quote page draw ONE component (a copy is the one that
// rots — AGENTS.md recurring failure 4). This path stays so the site's import
// is unchanged; called with the site's props, the output is byte-identical,
// which scripts/check-proposal-slider.mjs proves on every run.
export { default } from "@/app/components/public/BeforeAfter";
