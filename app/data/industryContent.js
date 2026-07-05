// app/data/industryContent.js
import { INDUSTRIES } from "./industries";

// Extends the base INDUSTRIES list (used by the nav) with page-specific copy.
// Kept separate so the nav dropdown doesn't have to import a heavier content file.
export const INDUSTRY_CONTENT = Object.fromEntries(
  INDUSTRIES.map((ind) => [
    ind.slug,
    {
      ...ind,
      headline: `Software built for ${ind.label.toLowerCase()} businesses`,
      description: `Run your ${ind.label.toLowerCase()} business without the back-office chaos — quotes, scheduling, invoicing, and payments, built around how this trade actually works.`,
      painPoints: [
        "Quotes that take too long to put together",
        "Missed appointments and scheduling conflicts",
        "Chasing clients for payment after the job's done",
        "No real visibility into what a job actually costs you",
      ],
    },
  ]),
);
