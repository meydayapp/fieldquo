// content/help/fr/jobs-and-scheduling.js
//
// The “jobs-and-scheduling” category in fr, composed from 3 part files so several
// writers can work in parallel without touching the same file. Each part
// carries the slugs lib/help/tree.js assigns it; the check reads THIS module.
import { ARTICLES as PART_1 } from "./jobs-and-scheduling-1.js";
import { ARTICLES as PART_2 } from "./jobs-and-scheduling-2.js";
import { ARTICLES as PART_3 } from "./jobs-and-scheduling-3.js";

export const ARTICLES = { ...PART_1, ...PART_2, ...PART_3 };
