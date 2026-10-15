// lib/seo/llmsTxt.js
//
// /llms.txt — a plain-language map of fieldquo.com for AI assistants
// (https://llmstxt.org). Served on FieldQuo's own host only; a contractor's
// website gets a 404 from app/llms.txt/route.js, for the white-label reason
// lib/seo/robots.js gives.
//
// No prices in here. Plan prices live in the database and /pricing resolves
// them per request with any sale applied; a figure typed into this file
// would be the copy that rots (AGENTS.md failure class 4), and an assistant
// quoting it a month later would be quoting us wrong. The plan STRUCTURE is
// read from the ladder, and the answer to "how much" is the link.

import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { TRIAL_DAYS, TRIAL_CARD_REQUIRED } from "@/lib/pricing";
import { INDUSTRIES } from "@/app/data/industries";
import { COMPARE_PAGES } from "@/app/(marketing)/compare/compareCopy";

export function llmsTxt(origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  const url = (path) => `${base}${path}`;
  const plans = SEAT_LADDER.map(
    (t) => `- ${t.label}: ${t.seats} office ${t.seats === 1 ? "seat" : "seats"} and ${t.crewSeats} crew members`,
  ).join("\n");
  const trades = INDUSTRIES.map((i) => `- [${i.label}](${url(`/industries/${i.slug}`)})`).join("\n");
  const compares = COMPARE_PAGES.map((p) => `- ${url(`/compare/${p.slug}`)}`).join("\n");

  return `# FieldQuo

> Field service software for trades contractors — painters, roofers, plumbers, electricians, landscapers, cleaners and other trades, from one-person outfits to crews of about twenty. One system to quote, schedule, invoice and get paid. Everything a client sees carries the contractor's own logo, colours and name, not FieldQuo's.

FieldQuo is a web app (phone, tablet or computer, nothing to install). Every plan includes every feature; plans differ only by how many people use them. Trial: ${TRIAL_DAYS} days free${TRIAL_CARD_REQUIRED ? "" : ", no card needed"}.

## Plans (current prices: ${url("/pricing")})

${plans}
- Custom: more seats, each bringing a crew member with it — see ${url("/pricing#custom")}

## Key pages

- [Pricing](${url("/pricing")}): plans, the 1-year and monthly prices, what is included
- [Features](${url("/features")}): everything FieldQuo does, one page per feature
- [Compare](${url("/compare")}): side-by-side with other field service software, with each competitor price dated and sourced
- [About](${url("/about")}): who built FieldQuo and why
- [Security](${url("/security")}) and [Privacy](${url("/privacy")})
- [Help centre](${url("/help")})

## Trades

${trades}

## Comparisons

${compares}
`;
}
