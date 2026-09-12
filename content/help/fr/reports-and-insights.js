// content/help/fr/reports-and-insights.js
//
// The “reports-and-insights” category in fr, composed from 2 part files so several
// writers can work in parallel without touching the same file. Each part
// carries the slugs lib/help/tree.js assigns it; the check reads THIS module.
import { ARTICLES as PART_1 } from "./reports-and-insights-1.js";
import { ARTICLES as PART_2 } from "./reports-and-insights-2.js";

export const ARTICLES = { ...PART_1, ...PART_2 };
