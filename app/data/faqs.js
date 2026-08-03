// app/data/faqs.js
//
// Only the stable IDs live here — the question and answer text lives in the
// message catalog under faq.items.<id>.q / .a, so adding a language doesn't
// mean duplicating this array.
//
// IDs are deliberately descriptive rather than numeric: renumbering a list
// after inserting an entry silently reassigns every translation below it.
export const FAQS = [
  { id: "install" },
  { id: "onlinePayment" },
  { id: "financing" },
  { id: "permissions" },
  { id: "trade" },
  { id: "contract" },
];
