// content/help/en/invoices-and-payments.js
//
// The “invoices-and-payments” category in en, composed from 3 part files so several
// writers can work in parallel without touching the same file. Each part
// carries the slugs lib/help/tree.js assigns it; the check reads THIS module.
import { ARTICLES as PART_1 } from "./invoices-and-payments-1.js";
import { ARTICLES as PART_2 } from "./invoices-and-payments-2.js";
import { ARTICLES as PART_3 } from "./invoices-and-payments-3.js";

export const ARTICLES = { ...PART_1, ...PART_2, ...PART_3 };
