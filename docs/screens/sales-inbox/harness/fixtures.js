// Fixture data for the /sales/threads harness — what the routes would answer
// for a rep (Rachel) whose Namecheap mailbox is connected, plus a scenario
// where it is not. Shapes mirror app/api/sales/threads/route.js and
// app/api/sales/threads/[id]/route.js exactly.
const H = 60 * 60 * 1000;
const now = Date.now();
const at = (h) => new Date(now - h * H).toISOString();

const OUTREACH_OK = { canSend: true, blockers: [], warnings: [], from: "rachel.koudoyor@fieldquo.com", domain: "fieldquo.com", inboundConfigured: true, mailboxState: "connected" };
const OUTREACH_NONE = {
  canSend: false,
  blockers: [{ code: "mailbox_not_connected", title: "Your mailbox hasn't been connected yet — ask the owner.", fix: "Nothing is sent or received here until rachel.koudoyor@fieldquo.com is connected. The owner does it on the rep's row under Sales reps in the platform console: the mailbox address and its password, tested on save. The rep has no step to do." }],
  warnings: [], from: "rachel.koudoyor@fieldquo.com", domain: "fieldquo.com", inboundConfigured: false, mailboxState: "none",
};

const LEAD_ACME = { id: "lead-acme", businessName: "Acme Painting", contactName: "Dana Cole", email: "dana@acmepainting.ca", phone: "+15145550134", status: "contacted", province: "QC", country: "CA", timeZone: "America/Toronto", prospectId: "p-acme", convertedCompanyId: null, prospect: { email: "info@acmepainting.ca", tradeKey: "painting", city: "Gatineau", province: "QC" } };
const LEAD_MELTON = { id: "lead-melton", businessName: "Melton Electric", contactName: "Rob Melton", email: "rob@meltonelectric.com", phone: "+16135550187", status: "demoed", province: "ON", country: "CA", timeZone: "America/Toronto", prospectId: "p-melton", convertedCompanyId: null, prospect: { email: null, tradeKey: "electrical", city: "Ottawa", province: "ON" } };
const LEAD_OUELLET = { id: "lead-ouellet", businessName: "Toitures Ouellet", contactName: "Marc Ouellet", email: "marc@toituresouellet.ca", phone: null, status: "new", province: "QC", country: "CA", timeZone: "America/Toronto", prospectId: "p-ouellet", convertedCompanyId: null, prospect: { email: null, tradeKey: "roofing", city: "Lévis", province: "QC" } };

const M = (id, direction, from, to, subject, body, h, extra = {}) => ({ id, direction, fromAddress: from, toAddress: to, ccAddresses: null, subject, body, sentAt: at(h), seen: true, filedBy: "mailbox", attachments: [], forwardedToMailbox: false, ...extra });

const MESSAGES = {
  "t-acme": [
    M("m1", "out", "rachel.koudoyor@fieldquo.com", "dana@acmepainting.ca", "Quick question about your quotes", "Hi Dana,\n\nI came across Acme Painting while looking at painters in Gatineau — nice work on the Aylmer heritage house.\n\nQuick question: how are you sending quotes today? Most painters we talk to are still on Word or a text with a number in it, and losing jobs to whoever answers first.\n\nWould a five-minute look at how FieldQuo does it be worth your time this week?\n\nRachel\n\n—\nRachel Koudoyor · FieldQuo · rachel.koudoyor@fieldquo.com\n1 Rue Example, Gatineau QC J8X 1A1\nDon't want to hear from me again? Reply with \"unsubscribe\" and I'll stop.\nRef: fqs3f9a2c1d4e5b6a7", 52),
    M("m2", "in", "Dana Cole <dana@acmepainting.ca>", "rachel.koudoyor@fieldquo.com", "Re: Quick question about your quotes", "Sure, send it over. We do everything in Word right now and it takes forever.\n\nAttached is the kind of quote we send, so you can see what I mean.\n\nDana\n\nOn Wed, 16 Sep 2026, Rachel Koudoyor wrote:\n> Hi Dana,\n>\n> I came across Acme Painting while looking at painters in Gatineau\n> — nice work on the Aylmer heritage house.", 30, { ccAddresses: "office@acmepainting.ca", attachments: [{ index: 0, type: "document", state: "stored", url: "https://res.cloudinary.com/demo/raw/upload/sales-mailbox/mb1/kitchen-quote.pdf", mimeType: "application/pdf", filename: "kitchen-quote.pdf", bytes: 184320, retryable: false, error: null }] }),
    M("m3", "out", "rachel.koudoyor@fieldquo.com", "dana@acmepainting.ca", "Re: Quick question about your quotes", "Thanks Dana — that's exactly the shape we replace. Here's what the same quote looks like in FieldQuo, and the link to start (first month free):\n\nhttps://www.fieldquo.com/signup?sales=rachel\n\nWant me to walk you through it Thursday at 10?\n\nRachel\n\nOn Thu, 17 Sep 2026, Dana Cole wrote:\n> Sure, send it over. We do everything in Word right now and it takes forever.", 28),
    M("m4", "in", "Dana Cole <dana@acmepainting.ca>", "rachel.koudoyor@fieldquo.com", "Re: Quick question about your quotes", "Thursday at 10 works. Can you send a calendar invite? My partner Luc would like to join — cc'd.\n\nDana\n\nOn Thu, 17 Sep 2026, Rachel Koudoyor wrote:\n> Thanks Dana — that's exactly the shape we replace.", 2, { seen: false, ccAddresses: "luc@acmepainting.ca" }),
  ],
  "t-melton": [
    M("m5", "out", "rachel.koudoyor@fieldquo.com", "rob@meltonelectric.com", "Your FieldQuo demo — Tuesday 2pm", "Hi Rob,\n\nLooking forward to Tuesday. The invite is attached; reply if the time stops suiting you.\n\nRachel", 70),
    M("m6", "in", "Rob Melton <rob@meltonelectric.com>", "rachel.koudoyor@fieldquo.com", "Re: Your FieldQuo demo — Tuesday 2pm", "Great demo, thanks. Two questions before I sign up:\n\n- can my apprentice log hours from his phone?\n- does the invoice take e-transfer?\n\nRob", 26),
  ],
  "t-ouellet": [
    M("m7", "out", "rachel.koudoyor@fieldquo.com", "marc@toituresouellet.ca", "Petite question sur vos soumissions", "Bonjour Marc,\n\nJe suis tombée sur Toitures Ouellet en cherchant des couvreurs à Lévis. Petite question : comment envoyez-vous vos soumissions aujourd'hui ?\n\nRachel", 96),
  ],
  "t-supplier": [
    M("m8", "in", "Namecheap <support@namecheap.com>", "rachel.koudoyor@fieldquo.com", "Your Private Email subscription renews on Oct 1", "This is a reminder that your Private Email Business subscription for fieldquo.com renews on October 1, 2026.\n\nNo action is needed.", 5, { seen: false }),
  ],
  "t-colleague": [
    M("m9", "in", "Daniel <daniel@fieldquo.com>", "rachel.koudoyor@fieldquo.com", "Ottawa roofers list", "Hey — the Ottawa roofers list is in the review folder, 433 rows. Take the east side?\n\nD", 8),
    M("m10", "out", "rachel.koudoyor@fieldquo.com", "daniel@fieldquo.com", "Re: Ottawa roofers list", "East side is mine. Thanks!\n\nOn Fri, Daniel wrote:\n> Hey — the Ottawa roofers list is in the review folder", 7),
  ],
};

const THREADS = {
  "t-acme": { id: "t-acme", subject: "Quick question about your quotes", lastMessageAt: at(2), lastInboundAt: at(2), readAt: at(27), archivedAt: null, counterpart: "dana@acmepainting.ca", createdAt: at(52), lead: LEAD_ACME },
  "t-melton": { id: "t-melton", subject: "Your FieldQuo demo — Tuesday 2pm", lastMessageAt: at(26), lastInboundAt: at(26), readAt: at(25), archivedAt: null, counterpart: "rob@meltonelectric.com", createdAt: at(70), lead: LEAD_MELTON },
  "t-ouellet": { id: "t-ouellet", subject: "Petite question sur vos soumissions", lastMessageAt: at(96), lastInboundAt: null, readAt: null, archivedAt: null, counterpart: "marc@toituresouellet.ca", createdAt: at(96), lead: LEAD_OUELLET },
  "t-supplier": { id: "t-supplier", subject: "Your Private Email subscription renews on Oct 1", lastMessageAt: at(5), lastInboundAt: at(5), readAt: null, archivedAt: null, counterpart: "support@namecheap.com", createdAt: at(5), lead: null },
  "t-colleague": { id: "t-colleague", subject: "Ottawa roofers list", lastMessageAt: at(7), lastInboundAt: at(8), readAt: at(7), archivedAt: null, counterpart: "daniel@fieldquo.com", createdAt: at(8), lead: null },
};

const CHECKINS = { "lead-melton": [{ id: "ci-1", scheduledFor: at(-20), draftText: "Hi Rob, Rachel from FieldQuo — did the apprentice hours question get answered? Happy to show you on a two-minute call." }] };
const DRAFTS = [{ id: "d-1", leadId: "lead-melton", threadId: "t-melton", kind: "reply", toAddresses: "rob@meltonelectric.com", ccAddresses: null, subject: null, body: "Hi Rob,\n\nYes to both — the apprentice clocks in from his phone and", quotedMessageId: "m6", attachments: null, updatedAt: at(1) }];

function snippet(body) {
  const cut = body.split(/\n(On .+ wrote:|Le .+ a écrit ?:)/)[0];
  return cut.replace(/\s+/g, " ").trim().slice(0, 140);
}

export function listRows(fx, folder, q) {
  return Object.values(fx.threads)
    .filter((t) => (folder === "archived" ? t.archivedAt : folder === "all" ? true : !t.archivedAt))
    .filter((t) => !q || [t.subject, t.lead?.businessName, t.lead?.contactName, t.counterpart, ...(fx.messages[t.id] || []).map((m) => m.body)].some((v) => String(v || "").toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    .map((t) => {
      const msgs = fx.messages[t.id] || [];
      const last = msgs[msgs.length - 1] || null;
      const unread = Boolean(t.lastInboundAt) && (!t.readAt || new Date(t.readAt) < new Date(t.lastInboundAt));
      return {
        id: t.id, subject: t.subject, lastMessageAt: t.lastMessageAt, lastInboundAt: t.lastInboundAt, readAt: t.readAt, archivedAt: t.archivedAt,
        lead: t.lead ? { id: t.lead.id, businessName: t.lead.businessName, contactName: t.lead.contactName, email: t.lead.email, status: t.lead.status } : null,
        counterpart: t.counterpart, section: t.lead ? "leads" : "other", messageCount: msgs.length,
        last: last ? { direction: last.direction, sentAt: last.sentAt, fromAddress: last.fromAddress, snippet: snippet(last.body), hasAttachments: last.attachments.length > 0 } : null,
        labels: { unread, needsReply: last?.direction === "in", waiting: last?.direction === "out", checkInDue: Boolean(t.lead && CHECKINS[t.lead.id]), stage: t.lead?.status || null, archived: Boolean(t.archivedAt) },
        draftId: fx.drafts.find((d) => d.threadId === t.id)?.id || null,
      };
    });
}

export function detailOf(fx, id) {
  const t = fx.threads[id];
  if (!t) return null;
  const msgs = (fx.messages[id] || []).map((m) => {
    const parts = m.body.split(/\n(?=On .+ wrote:|Le .+ a écrit ?:)/);
    return { ...m, visible: parts[0].trim(), quoted: parts.slice(1).join("\n").trim() };
  });
  const last = msgs[msgs.length - 1];
  const rows = listRows(fx, "all", "").find((r) => r.id === id);
  const recipients = [];
  const add = (address, source) => { if (address && !recipients.some((r) => r.address === address)) recipients.push({ address, source }); };
  add(t.lead?.email, "lead"); add(t.lead?.prospect?.email, "prospect"); add(t.counterpart, "counterpart");
  for (const m of msgs) if (m.direction === "in") add(m.fromAddress.match(/<([^>]+)>/)?.[1] || m.fromAddress, "wroteIn");
  for (const m of msgs) for (const c of String(m.ccAddresses || "").split(/,\s*/).filter(Boolean)) add(c, "copied");
  add("rachel.koudoyor@fieldquo.com", "self");
  const bare = (a) => a?.match(/<([^>]+)>/)?.[1] || a;
  return {
    thread: { ...t, messages: msgs, labels: rows.labels },
    recipients,
    replyAll: last ? { to: last.direction === "in" ? [bare(last.fromAddress)] : [last.toAddress], cc: String(last.ccAddresses || "").split(/,\s*/).filter(Boolean) } : { to: [], cc: [] },
    attachable: msgs.flatMap((m) => m.attachments.filter((a) => a.url).map((a) => ({ url: a.url, filename: a.filename, mimeType: a.mimeType, bytes: a.bytes, messageId: m.id }))),
    drafts: fx.drafts.filter((d) => d.threadId === id),
    calls: t.lead?.id === "lead-acme" ? [{ id: "c1", direction: "out", at: at(50), answered: true, disposition: "interested" }, { id: "c2", direction: "out", at: at(75), answered: false, disposition: "no_answer" }] : [],
    otherThreads: t.lead?.id === "lead-acme" ? [{ id: "t-acme-old", subject: "Following up on the Aylmer job", lastMessageAt: at(400) }] : [],
    checkIns: t.lead ? CHECKINS[t.lead.id] || [] : [],
    reviewedByOwner: null,
    optedOut: false, optedOutReason: null, optedOutReasonKey: null, optedOutReasonParams: null,
    outreach: fx.outreach,
  };
}

export const FIXTURES = {
  default: { threads: THREADS, messages: MESSAGES, drafts: DRAFTS, outreach: OUTREACH_OK, mailbox: { connected: true, state: "connected", address: "rachel.koudoyor@fieldquo.com" }, leads: [LEAD_ACME, LEAD_MELTON, LEAD_OUELLET] },
  notConnected: { threads: {}, messages: {}, drafts: [], outreach: OUTREACH_NONE, mailbox: { connected: false, state: "none", address: "rachel.koudoyor@fieldquo.com" }, leads: [LEAD_ACME] },
};
