// content/help/en/marketing-and-website.js
//
// The “marketing-and-website” category in en, composed from 3 part files so several
// writers can work in parallel without touching the same file. Each part
// carries the slugs lib/help/tree.js assigns it; the check reads THIS module.
import { ARTICLES as PART_1 } from "./marketing-and-website-1.js";
import { ARTICLES as PART_2 } from "./marketing-and-website-2.js";
import { ARTICLES as PART_3 } from "./marketing-and-website-3.js";
import { ARTICLES as PART_4 } from "./marketing-and-website-4.js";

export const ARTICLES = { ...PART_1, ...PART_2, ...PART_3, ...PART_4 };
