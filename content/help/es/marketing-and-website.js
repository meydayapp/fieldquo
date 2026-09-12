// content/help/es/marketing-and-website.js
//
// The “marketing-and-website” category in es, composed from 2 part files so several
// writers can work in parallel without touching the same file. Each part
// carries the slugs lib/help/tree.js assigns it; the check reads THIS module.
import { ARTICLES as PART_1 } from "./marketing-and-website-1.js";
import { ARTICLES as PART_2 } from "./marketing-and-website-2.js";

export const ARTICLES = { ...PART_1, ...PART_2 };
