// lib/sales/emailQuote.js
//
// Where a message stops being what the person typed and starts being what
// they quoted — and how a reply or forward quotes OUR stored copy.
//
// ══ One splitter, three readers ═══════════════════════════════════════════
//
// lib/sales/outreach.js's visibleReplyText() has always cut a reply at the
// first "On … wrote:" so that an opt-out is read only from the words the
// prospect typed and never from our own footer quoted back. The inbox now
// needs the same cut for a second reason — the thread view collapses the
// quoted tail behind a "…" the way every mail client does (Zero's
// mail-display, Gmail's trimmed content) — and a third: a reply from the
// portal quotes the message it answers. Three readers of one rule, so the
// rule lives here and visibleReplyText calls it.
//
// The markers are the ones real clients emit, English and French, plus the
// `>` prefix. Nothing is stripped that the prospect typed above the marker;
// a message with no marker is all visible, which is the safe answer — a
// quote shown is a nuisance, a sentence hidden is a lost answer.

const QUOTE_MARKERS = [
  /^\s*On .+ wrote:\s*$/i,
  /^\s*-{2,}\s*(original message|forwarded message)/i,
  /^\s*_{5,}\s*$/,
  /^\s*From:\s*.+@/i,
  /^\s*Le .+ a écrit\s*:/i,
  /^\s*El .+ escribió\s*:/i,
  /^\s*Am .+ schrieb .+:\s*$/i,
];

/**
 * @returns { visible, quoted } — both strings, `quoted` empty when nothing
 *          was quoted. visible + quoted is the body with nothing lost: the
 *          marker line itself belongs to `quoted`.
 */
export function splitQuoted(body) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  let cut = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (QUOTE_MARKERS.some((re) => re.test(line))) {
      cut = i;
      break;
    }
    if (/^\s*>/.test(line)) {
      // A run of `>` lines with no marker above them: the quote starts at the
      // first one. A single `>` line in prose ("> 50 units") is kept when the
      // next line is not quoted too.
      const next = lines[i + 1];
      if (next === undefined || /^\s*>/.test(next)) {
        cut = i;
        break;
      }
    }
  }
  if (cut < 0) return { visible: lines.join("\n").trim(), quoted: "" };
  return {
    visible: lines.slice(0, cut).join("\n").trim(),
    quoted: lines.slice(cut).join("\n").trim(),
  };
}

/**
 * The attribution line a reply carries above the quoted original.
 *
 * English, deliberately: it goes to the PROSPECT, in the thread's language —
 * and the thread's language is the language the rep wrote in. The line is
 * the conventional shape ("On <date>, <who> wrote:") so the recipient's
 * own client collapses it the way it collapses everyone else's.
 */
export function attributionLine({ at, from }) {
  const when = at ? new Date(at) : null;
  const stamp =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })
      : "";
  return `On ${stamp || "an earlier date"}, ${String(from || "").trim() || "they"} wrote:`;
}

/** The message, prefixed the way every client quotes: `> ` on each line. */
export function quoteLines(body) {
  return String(body || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => (l ? `> ${l}` : ">"))
    .join("\n");
}

/**
 * The body a reply sends: what the rep typed, a blank line, the attribution,
 * the quoted original. The original is OUR stored copy of the message being
 * answered (never a string the browser sent as "the quote"), and only its
 * visible part — quoting a quote of a quote is how a thread's fourth message
 * carries the first three.
 */
export function replyBody({ typed, quotedMessage }) {
  const own = String(typed || "").replace(/\s+$/, "");
  if (!quotedMessage) return own;
  const { visible } = splitQuoted(quotedMessage.body);
  const header = attributionLine({ at: quotedMessage.sentAt, from: quotedMessage.fromAddress });
  return `${own}\n\n${header}\n${quoteLines(visible)}`;
}

/**
 * The body a forward sends: what the rep typed, then the forwarded message
 * under the conventional header — whole, not just its visible part, because
 * a forward passes on what was received.
 */
export function forwardBody({ typed, forwardedMessage }) {
  const own = String(typed || "").replace(/\s+$/, "");
  if (!forwardedMessage) return own;
  const m = forwardedMessage;
  const when = m.sentAt ? new Date(m.sentAt) : null;
  const stamp =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })
      : "";
  const header = [
    "---------- Forwarded message ----------",
    `From: ${m.fromAddress || ""}`,
    stamp ? `Date: ${stamp}` : null,
    `Subject: ${m.subject || ""}`,
    `To: ${m.toAddress || ""}`,
  ]
    .filter(Boolean)
    .join("\n");
  return `${own}\n\n${header}\n\n${String(m.body || "").trim()}`;
}

/** "Re: x" once, never "Re: Re: x"; same for "Fwd:". */
export function prefixedSubject(subject, prefix) {
  const s = String(subject || "").trim();
  const re = prefix === "Fwd" ? /^(fwd?|tr|wg)\s*:/i : /^(re|aw|sv)\s*:/i;
  return re.test(s) ? s : `${prefix}: ${s}`;
}
