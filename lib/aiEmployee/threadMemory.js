// lib/aiEmployee/threadMemory.js
//
// What the AI employee already KNOWS about the person on a thread, so it
// never makes them say it twice: the contact details on file for THIS
// conversation, and the part of the conversation older than the chat window.
//
// ══ Why this exists (TrueFinish, Tony, 2026-10-10) ═════════════════════════
//
// Tony had written "29 Rialto way" and "613-262-7407" in the same Messenger
// thread in July; the lead the thread is linked to carried both. In October he
// asked "are you free tomorrow morning", the receptionist offered times, and
// then asked him THREE times for "the best phone number for you and the job
// address" — until the reply cap stopped it. The model never saw either fact:
//
//   - respond.js's conversation() shows the model the last 12 messages. The
//     address was 25 messages back, the phone 19 — imported history was NOT
//     excluded, it simply fell out of the window (Meta's own "Your AI agent
//     will respond." / "Auto-label added" lines took up a third of it);
//   - the linked LeadRequest (thread.leadId) was not read at all, and the
//     client card (clientContext.js) exists only for a thread tied to a
//     Client, only for the troubleshooter's prompt;
//   - book_appointment REQUIRED a phone, so the model had to obtain one in
//     the conversation before it could book.
//
// ══ Only this thread's own records, read under the company ═════════════════
//
// The lead is read by the thread's leadId AND companyId; the client by the
// thread's clientId AND companyId; the conversation's own lead capture is a
// column of the thread respond.js read under companyId. Nothing here takes an
// id from the model, and nothing reads a second thread, a second lead or a
// second company. Contact columns only — never money (the same rule as
// clientContext.js).
//
// ══ Said here, or only on file ═════════════════════════════════════════════
//
// A value the customer TYPED in this conversation (imported history counts)
// is theirs to have read back: "I have 613-262-7407 and 29 Rialto Way — still
// right?". A value that is only on a record — a client matched from an email
// somebody typed into a web chat, a lead a person linked — may belong to
// somebody else, so its VALUE never enters the prompt. The model is told it
// exists and asks "can we use the number we have on file?"; the booking tools
// fill it in server-side (withOnFile). That is the same caution
// clientContext.js's WEB_MATCH_NOTE takes, applied per field.

import { leadAddressLine } from "@/lib/leads/intakeShape";

/** Messages shown to the model as chat turns — unchanged from respond.js. */
export const HISTORY_LIMIT = 12;
/** Older messages summarised into the EARLIER block, at most. */
export const EARLIER_LIMIT = 40;
/** Character budget for the EARLIER block (≈1,000 tokens at worst). */
export const EARLIER_MAX_CHARS = 4000;
/** One older message, at most, inside that block. */
export const EARLIER_LINE_CHARS = 300;

const str = (v, n = 300) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, n) : null);
const digits = (v) => String(v || "").replace(/\D/g, "");
const flat = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();

/** Did the customer type this phone number in the conversation? The last
 *  ten digits, so "+1 613 262 7407" matches "613-262-7407". */
export function phoneSaid(value, texts = []) {
  const d = digits(value);
  if (d.length < 7) return false;
  const tail = d.slice(-10);
  return texts.some((t) => digits(t).includes(tail));
}

/** …this email? Case-insensitive, whole address. */
export function emailSaid(value, texts = []) {
  const v = String(value || "").trim().toLowerCase();
  if (!v.includes("@")) return false;
  return texts.some((t) => String(t || "").toLowerCase().includes(v));
}

/** …this address? Its first part (before the first comma — the number and
 *  street a person actually types), at least two words, flattened. */
export function addressSaid(value, texts = []) {
  const head = flat(String(value || "").split(",")[0]);
  if (head.split(" ").filter(Boolean).length < 2) return false;
  return texts.some((t) => flat(t).includes(head));
}

/**
 * The contact details on file for one conversation. Pure: the check hands it
 * rows directly.
 *
 * Precedence per field: the linked client, then the linked lead, then what
 * the conversation's own lead capture read out of the messages. A company
 * client's address is its office, not a job site (schema note on
 * Client.type), so it is not offered as the job address.
 *
 * @returns null when nothing is on file, else
 *   { name, phone, email, address } each { value, source, said } or null.
 */
export function shapeOnFile({ client = null, lead = null, capture = null, participantName = null, smsNumber = null, inboundTexts = [] } = {}) {
  const texts = (Array.isArray(inboundTexts) ? inboundTexts : []).map((t) => String(t || "")).filter(Boolean);
  const contacts = capture && typeof capture === "object" && capture.contacts && typeof capture.contacts === "object" ? capture.contacts : {};
  const clientAddress = client && client.type !== "company" ? [str(client.address, 200), str(client.city, 80)].filter(Boolean).join(", ") || null : null;

  const pick = (candidates) => {
    for (const [value, source] of candidates) {
      const v = str(value, 200);
      if (v) return { value: v, source };
    }
    return null;
  };

  const name = pick([
    [client?.type === "company" ? client?.contactName || client?.name : client?.name, "client"],
    [lead?.name, "lead"],
    [participantName, "conversation"],
  ]);
  const phone = pick([
    [client?.phone, "client"],
    [lead?.phone, "lead"],
    [contacts.phone, "conversation"],
    [smsNumber, "conversation"],
  ]);
  const email = pick([
    [client?.email, "client"],
    [lead?.email, "lead"],
    [contacts.email, "conversation"],
  ]);
  const address = pick([
    [clientAddress, "client"],
    [lead ? leadAddressLine(lead.intake) : null, "lead"],
    [contacts.address, "conversation"],
  ]);

  // An SMS thread's number IS the person writing — said, by construction.
  if (phone) phone.said = (smsNumber && digits(smsNumber).slice(-10) === digits(phone.value).slice(-10)) || phoneSaid(phone.value, texts);
  if (email) email.said = emailSaid(email.value, texts);
  if (address) address.said = addressSaid(address.value, texts);
  // The name they message under, or one they typed, is theirs. A record's
  // name that is neither (a client matched from somebody's typed email) is
  // treated like any other on-file value.
  if (name) {
    const n = flat(name.value);
    name.said = (participantName && flat(participantName) === n) || texts.some((t) => flat(t).includes(n));
  }

  if (!name && !phone && !email && !address) return null;
  return { name, phone, email, address };
}

/** The fields a booking needs that are NOT on file, in the order to ask. */
export function missingForBooking(onFile, { visit = true } = {}) {
  const out = [];
  if (!onFile?.name) out.push("name");
  if (!onFile?.phone) out.push("phone");
  if (visit && !onFile?.address) out.push("address");
  return out;
}

const FIELD_LABEL = { name: "Name", phone: "Phone", email: "Email", address: "Job address" };

/**
 * The block the prompt carries — or null when nothing is on file. Fenced by
 * the caller (roles.js), like every other block of data.
 */
export function onFileCardText(onFile) {
  if (!onFile) return null;
  const lines = [];
  for (const key of ["name", "phone", "email", "address"]) {
    const f = onFile[key];
    if (!f) continue;
    lines.push(
      f.said
        ? `${FIELD_LABEL[key]}: ${f.value} (they gave this themselves)`
        : `${FIELD_LABEL[key]}: on file, but not given in this conversation — do not read it out`,
    );
  }
  const missing = missingForBooking(onFile).map((k) => FIELD_LABEL[k].toLowerCase());
  lines.push(missing.length ? `Not on file: ${missing.join(", ")}.` : "Nothing a booking needs is missing.");
  return lines.join("\n");
}

/** The instructions that go with the card. Ours, so outside the fence. */
export const ON_FILE_RULES = `USING WHAT IS ON FILE
The details above are part of this conversation's record — you may use them
exactly as you use what they wrote. Never ask for one of them from scratch.
- Before you book, CONFIRM what is on file in one short question instead of
  asking for it: "I have 613-262-7407 and 29 Rialto Way — is that still
  right?" (with their real details). If one is marked "do not read it out",
  ask "can we use the number we have on file for you?" instead of saying it.
- If they correct one, use the correction. If they say yes, book: leave a
  detail that is on file out of book_appointment / book_callback and it is
  filled in for you.
- Ask ONLY for what is not on file, one item at a time.`;

/** How a partial answer is handled — said once, for every role. */
export const PARTIAL_ANSWER_RULE = `WHEN THEY ANSWER ONLY PART OF IT
If you asked for one thing and they gave another (an email when you asked
for a phone number), thank them, keep what they gave, and ask once more for
the one thing still missing, naming it plainly. Never repeat a question they
have already answered. If they still do not give it, do not ask a third
time: book what you can, or book_callback with what you have, or hand off.`;

/**
 * Fill a booking tool's arguments from the record when the model left them
 * out. What the model supplied always wins — it is what the customer just
 * said, a correction included. Only the two booking tools are touched.
 */
export function withOnFile(name, args, onFile) {
  if (!onFile || (name !== "book_appointment" && name !== "book_callback")) return args;
  const a = { ...(args && typeof args === "object" ? args : {}) };
  const blank = (v) => !(typeof v === "string" && v.trim());
  if (blank(a.name) && onFile.name?.value) a.name = onFile.name.value;
  if (blank(a.phone) && onFile.phone?.value) a.phone = onFile.phone.value;
  if (blank(a.email) && onFile.email?.value) a.email = onFile.email.value;
  if (name === "book_appointment" && blank(a.address) && onFile.address?.value) a.address = onFile.address.value;
  return a;
}

/**
 * The conversation older than the chat window, as one block of dated lines,
 * oldest first. `rows` are the OLDER rows (already outside the window), in
 * any order; imported history is included like any other message — it is
 * the conversation, whoever's software carried it.
 *
 * Over budget, the business's own older lines go first (they are context),
 * then the customer's oldest — the customer's words are the facts the
 * employee must not ask for again.
 */
export function earlierConversationText(rows = [], { maxChars = EARLIER_MAX_CHARS, lineChars = EARLIER_LINE_CHARS } = {}) {
  const lines = (Array.isArray(rows) ? rows : [])
    .filter((m) => m && (m.direction === "in" || m.direction === "out") && !m.failedReason && str(m.body, lineChars))
    .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))
    .map((m) => {
      const t = m.sentAt ? new Date(m.sentAt) : null;
      const day = t && Number.isFinite(t.getTime()) ? t.toISOString().slice(0, 10) : "earlier";
      return { who: m.direction, text: `${m.direction === "in" ? "Customer" : "Business"} (${day}): ${str(m.body, lineChars)}` };
    });
  const size = () => lines.reduce((n, l) => n + l.text.length + 1, 0);
  while (lines.length && size() > maxChars) {
    const i = lines.findIndex((l) => l.who === "out");
    lines.splice(i >= 0 ? i : 0, 1);
  }
  return lines.length ? lines.map((l) => l.text).join("\n") : null;
}

/** Contact columns of Client the card may use. Nothing else is read. */
export const ON_FILE_CLIENT_SELECT = Object.freeze({ id: true, name: true, contactName: true, type: true, phone: true, email: true, address: true, city: true });
/** Contact columns of LeadRequest the card may use. */
export const ON_FILE_LEAD_SELECT = Object.freeze({ id: true, name: true, phone: true, email: true, intake: true });

/**
 * Read the thread's own records under the company. Never throws — a failed
 * read is "nothing on file", which only means the employee asks.
 *
 * @param thread  the row respond.js read under companyId:
 *                { clientId, leadId, leadCapture, participantName,
 *                  participantExternalId, channel: { platform } }
 */
export async function loadOnFile(prisma, { companyId, thread, inboundTexts = [] }) {
  if (!companyId || !thread) return null;
  try {
    const [client, lead] = await Promise.all([
      thread.clientId && prisma?.client?.findFirst
        ? prisma.client.findFirst({ where: { id: thread.clientId, companyId }, select: ON_FILE_CLIENT_SELECT })
        : null,
      thread.leadId && prisma?.leadRequest?.findFirst
        ? prisma.leadRequest.findFirst({ where: { id: thread.leadId, companyId }, select: ON_FILE_LEAD_SELECT })
        : null,
    ]);
    return shapeOnFile({
      client,
      lead,
      capture: thread.leadCapture || null,
      participantName: thread.participantName || null,
      smsNumber: thread.channel?.platform === "sms" ? thread.participantExternalId || null : null,
      inboundTexts,
    });
  } catch (err) {
    console.error("[aiEmployee] on-file read failed:", err?.message);
    return null;
  }
}
