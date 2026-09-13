// content/help/es/team-and-access.js
//
// The “team-and-access” category in es, composed from 3 part files so several
// writers can work in parallel without touching the same file. Each part
// carries the slugs lib/help/tree.js assigns it; the check reads THIS module.
import { ARTICLES as PART_1 } from "./team-and-access-1.js";
import { ARTICLES as PART_2 } from "./team-and-access-2.js";
import { ARTICLES as PART_3 } from "./team-and-access-3.js";

export const ARTICLES = { ...PART_1, ...PART_2, ...PART_3 };
