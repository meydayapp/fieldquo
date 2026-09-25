// lib/expenses/categories.js
//
// The expense category presets — one list, read by the hand-entry form on
// Settings → Expense Tracking AND by the receipts book, so a scanned receipt
// and a typed expense land in the same buckets on the P&L.
//
// Still presets, not a closed set: Expense.category is free text, anything
// already in the database shows up in the breakdown, and typing a new one
// just works. Moved here from the expense-tracking page when the receipts book
// needed the same list — a second copy is the one that rots.
//
// The strings are stored on Expense rows, so they are English values (like a
// database key); the screens translate them for display.
export const EXPENSE_CATEGORY_PRESETS = Object.freeze([
  "Materials",
  "Fuel & Vehicle",
  "Tools & Equipment",
  "Insurance",
  "Rent & Utilities",
  "Software & Subscriptions",
  "Marketing",
  "Permits & Licensing",
  "Office Supplies",
  "Meals & Travel",
  "Other",
]);
