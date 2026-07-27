// lib/followUps/triggers.js
//
// The trigger events the Follow-up automation cron (app/api/cron/follow-ups/
// route.js) knows how to check, shared with the settings API routes and the
// Follow-ups page's dropdown. triggerEvent on FollowUpRule is a plain string
// rather than a Prisma enum specifically so a new trigger can be added here
// (plus a matching branch in the cron route) with no migration.
export const SUPPORTED_TRIGGERS = ["quote_no_response", "invoice_overdue", "job_completed"];

export const TRIGGER_META = {
  quote_no_response: {
    label: "Quote sent, no response",
    description: "Fires once the quote has been sitting at 'sent' for the delay period with no accept/decline.",
    defaultDelay: { value: 3, unit: "days" },
  },
  invoice_overdue: {
    label: "Invoice overdue",
    description: "Fires once an unpaid invoice is past its due date by the delay period.",
    defaultDelay: { value: 5, unit: "days" },
  },
  job_completed: {
    label: "Job completed",
    description: "Fires once a job has been marked complete for the delay period (e.g. a thank-you / review request).",
    defaultDelay: { value: 2, unit: "days" },
  },
};
