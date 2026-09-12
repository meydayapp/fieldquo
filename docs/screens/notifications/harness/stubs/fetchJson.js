// Harness stub of @/lib/fetchJson: the bell's own requests, answered from a
// fixture so the panel has rows to draw.
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const NOTES = [
  { id: "n1", type: "quote.accepted", params: { clientName: "Maria Lopez", quoteNumber: "Q-1042" }, href: "/app/quotes/1", amount: 4820, currency: "USD", readAt: null, createdAt: new Date().toISOString() },
  { id: "n2", type: "lead.created", params: { leadName: "Dan Brooks" }, href: "/app/leads/2", readAt: null, createdAt: new Date(Date.now() - 3600e3).toISOString() },
  { id: "n3", type: "invoice.paid", params: { clientName: "The Hendersons", invoiceNumber: "INV-311" }, href: "/app/invoices/3", amount: 1200, currency: "USD", readAt: new Date().toISOString(), createdAt: new Date(Date.now() - 86400e3).toISOString() },
];
export async function fetchJson(url) {
  await delay(20);
  const u = new URL(url, "http://harness.local");
  if (u.pathname === "/api/ui-state") return { notifications: { unread: 2 } };
  if (u.pathname === "/api/notifications") return { notifications: NOTES, unread: 2 };
  if (u.pathname === "/api/notifications/read") return { unread: 0 };
  return {};
}
export default fetchJson;
