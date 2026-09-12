// content/help/es/settings.js
//
// The “settings” category in es, composed from 4 part files so several
// writers can work in parallel without touching the same file. Each part
// carries the slugs lib/help/tree.js assigns it; the check reads THIS module.
import { ARTICLES as PART_1 } from "./settings-1.js";
import { ARTICLES as PART_2 } from "./settings-2.js";
import { ARTICLES as PART_3 } from "./settings-3.js";
import { ARTICLES as PART_4 } from "./settings-4.js";

export const ARTICLES = { ...PART_1, ...PART_2, ...PART_3, ...PART_4 };
