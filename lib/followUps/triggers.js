// lib/followUps/triggers.js
//
// The trigger events the Follow-up automation cron (app/api/cron/follow-ups/
// route.js) knows how to check, shared with the settings API routes and the
// Follow-ups page's dropdown. triggerEvent on FollowUpRule is a plain string
// rather than a Prisma enum specifically so a new trigger can be added here
// (plus a matching branch in the cron route) with no migration.
export const SUPPORTED_TRIGGERS = ["quote_no_response", "invoice_overdue", "job_completed"];

// `entityType` and `stopsWhen` describe what the cron route ACTUALLY does, and
// exist so the flow diagram on the settings page can be derived rather than
// drawn. A hand-drawn picture of an automation drifts from the automation the
// first time someone edits the cron; this way the picture and the behaviour
// share one definition, and scripts/check-follow-up-flow.mjs fails the build if
// the two lists stop matching.
//
// `stopsWhen` names the condition that takes an entity OUT of the cron's
// `where` clause — i.e. the reason a rule stops chasing it. It is a machine key
// so the UI can translate it; the English wording lives in appMessages.js.
export const TRIGGER_META = {
  quote_no_response: {
    label: "Quote sent, no response",
    description: "Fires once the quote has been sitting at 'sent' for the delay period with no accept/decline.",
    defaultDelay: { value: 3, unit: "days" },
    entityType: "quote",
    // findQuoteNoResponse: status must still be "sent".
    stopsWhen: "quote_answered",
  },
  invoice_overdue: {
    label: "Invoice overdue",
    description: "Fires once an unpaid invoice is past its due date by the delay period.",
    defaultDelay: { value: 5, unit: "days" },
    entityType: "invoice",
    // findInvoiceOverdue: status must still be "sent" or "overdue".
    stopsWhen: "invoice_paid",
  },
  job_completed: {
    label: "Job completed",
    description: "Fires once a job has been marked complete for the delay period (e.g. a thank-you / review request).",
    defaultDelay: { value: 2, unit: "days" },
    entityType: "job",
    // findJobCompleted: status must still be "completed" and completedAt set.
    stopsWhen: "job_reopened",
  },
};

// Every rule sends exactly one thing, by one channel. Stated once here rather
// than assumed in the diagram: the cron calls sendEmail() and nothing else, so
// a diagram that drew an SMS branch would be describing a feature that isn't
// there. Add to this only when the cron genuinely gains a channel.
export const FOLLOW_UP_CHANNEL = "email";
