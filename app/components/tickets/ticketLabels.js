// app/components/tickets/ticketLabels.js
//
// Words and chip colours for a client ticket's type, status and priority on
// the office screens. Keys written out in full (check:translations cannot see
// a key built at runtime); colours are Tailwind ramps whose -50/-800 pairs
// measure well past 4.5:1 in light mode and -950/-300 in dark.

export const TYPE_KEYS = {
  repair: ["app.clientTickets.type.repair", "Repair"],
  warranty: ["app.clientTickets.type.warranty", "Warranty"],
  question: ["app.clientTickets.type.question", "Question"],
  billing: ["app.clientTickets.type.billing", "Billing"],
  reschedule: ["app.clientTickets.type.reschedule", "Reschedule"],
  maintenance: ["app.clientTickets.type.maintenance", "Maintenance visit"],
};

export const STATUS_KEYS = {
  open: ["app.clientTickets.status.open", "Open"],
  in_progress: ["app.clientTickets.status.in_progress", "In progress"],
  waiting_on_client: ["app.clientTickets.status.waiting_on_client", "Waiting on client"],
  resolved: ["app.clientTickets.status.resolved", "Resolved"],
  closed: ["app.clientTickets.status.closed", "Closed"],
};

export const PRIORITY_KEYS = {
  low: ["app.clientTickets.priority.low", "Low"],
  normal: ["app.clientTickets.priority.normal", "Normal"],
  high: ["app.clientTickets.priority.high", "High"],
  urgent: ["app.clientTickets.priority.urgent", "Urgent"],
};

export const STATUS_CLASSES = {
  open: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  in_progress: "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300",
  waiting_on_client: "bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300",
  resolved: "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300",
  closed: "bg-muted text-muted-foreground",
};

export function label(t, pair) {
  return pair ? t(pair[0], pair[1]) : "";
}
