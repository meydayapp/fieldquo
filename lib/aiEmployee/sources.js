// lib/aiEmployee/sources.js
//
// The resource material a contractor uploads, and — more importantly — what
// FieldQuo will honestly admit it cannot read.
//
// ══ The refusal is the feature ═════════════════════════════════════════════
//
// The obvious build here accepts a PDF, stores it, marks the source "ready",
// and hands the model whatever fell out of a hand-rolled stream scan. A tool
// manual is a PDF far more often than it is anything else, so that path is the
// one a contractor will actually take — and it produces a source row that says
// READY beside a document nobody read. Every question about it then comes back
// "that isn't in your material", which is indistinguishable from the feature
// being broken, and the contractor has no way to tell which.
//
// package.json has no PDF or DOCX reader in it, and adding one is a dependency
// decision that is not mine to make in this session. So the honest boundary is
// drawn here, in code, and printed in the UI in the same words:
//
//   READ:    .txt .md .markdown .csv .text, and anything text/*
//   REFUSED: .pdf .doc .docx .rtf .odt .pages .xls .xlsx and every binary,
//            BY NAME, with a reason the screen shows and a suggestion that
//            actually works (paste it in, or export as text).
//
// A refused file is still WRITTEN — status "failed", with its size and its
// reason — rather than rejected at the door with a toast. A contractor who
// uploaded a 40-page manual needs to see that it arrived and was not read; a
// disappearing upload reads as a bug.
//
// ══ Retrieval is keyword selection, and this file says so ══════════════════
//
// There is no embedding path anywhere in this codebase (grep: nothing outside
// a PDF font comment and three unrelated "embedding a widget" sentences), so
// there is nothing to reuse and building a vector store is a much larger
// decision than one slice of one feature. selectChunks() below scores chunks
// on the words in the customer's message. That is weaker than embeddings and
// it is written down as weaker; what it is NOT is unbounded, and it is not
// cross-tenant — every chunk it can ever return came from rows the caller read
// under one companyId, which is what scripts/check-ai-employee.mjs proves.

/** Extensions whose bytes ARE their text. The complete list. */
export const READABLE_EXTENSIONS = Object.freeze([
  "txt",
  "text",
  "md",
  "markdown",
  "csv",
]);

/**
 * Extensions FieldQuo refuses BY NAME, each with the key of the sentence the
 * screen prints. Named individually rather than caught by an "is it binary?"
 * fallback because these are the formats a contractor will actually try, and
 * "we cannot read a PDF yet — paste the text or export it as .txt" is a
 * different, far more useful message than "unsupported file".
 */
export const REFUSED_EXTENSIONS = Object.freeze({
  pdf: "app.aiEmployee.source.failed.pdf",
  doc: "app.aiEmployee.source.failed.word",
  docx: "app.aiEmployee.source.failed.word",
  rtf: "app.aiEmployee.source.failed.word",
  odt: "app.aiEmployee.source.failed.word",
  pages: "app.aiEmployee.source.failed.word",
  xls: "app.aiEmployee.source.failed.spreadsheet",
  xlsx: "app.aiEmployee.source.failed.spreadsheet",
  numbers: "app.aiEmployee.source.failed.spreadsheet",
  ppt: "app.aiEmployee.source.failed.other",
  pptx: "app.aiEmployee.source.failed.other",
  zip: "app.aiEmployee.source.failed.other",
});

/** Every failure key, so the check can assert all nine languages carry them. */
export const SOURCE_FAILURE_KEYS = Object.freeze([
  ...new Set([
    ...Object.values(REFUSED_EXTENSIONS),
    "app.aiEmployee.source.failed.binary",
    "app.aiEmployee.source.failed.empty",
    "app.aiEmployee.source.failed.tooLarge",
  ]),
]);

/** The filing a contractor puts a source under. Order matters — see rankKinds. */
export const SOURCE_KINDS = Object.freeze([
  "policy",
  "troubleshooting",
  "manual",
  "pricing",
  "other",
]);

/**
 * 400 KB of TEXT per source, and it is a real limit rather than a round number.
 *
 * A prompt is capped at MAX_CONTEXT_CHARS below; anything past that is never
 * sent, so storing megabytes would be storing something nothing can read. This
 * leaves a comfortable multiple of what one prompt can hold, so a long manual
 * still has plenty for selectChunks to choose between.
 */
export const MAX_SOURCE_BYTES = 400 * 1024;

/** Roughly 1,500 words per chunk — small enough that several fit in a prompt. */
export const CHUNK_CHARS = 1200;

/**
 * The ceiling on how much uploaded material reaches one prompt.
 *
 * ~8k characters is ~2k tokens. Chosen against the METER, not against the
 * model's window: every reply is billed to the company's AI allowance
 * (lib/ai/usage.js), and a 3-round tool loop resends the whole prompt each
 * round, so an unbounded context is a way to spend a contractor's month on one
 * chatty conversation.
 */
export const MAX_CONTEXT_CHARS = 8000;

/** Lowercased extension, or "". */
export function extensionOf(filename) {
  const name = String(filename || "");
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/**
 * May this file be read at all?
 *
 * @returns {{ ok: true }} or {{ ok: false, reason: <i18n key> }}
 *
 * Decided on the EXTENSION first and the mime type second, deliberately in
 * that order: browsers report application/octet-stream for .md often enough
 * that trusting the mime type alone refuses files this can genuinely read, and
 * a mime type is client-supplied anyway. The bytes are checked separately by
 * extractText, which is where a file that lied about being text is caught.
 */
export function classifySourceFile({ filename, mimeType, bytes } = {}) {
  const ext = extensionOf(filename);

  if (Object.hasOwn(REFUSED_EXTENSIONS, ext)) {
    return { ok: false, reason: REFUSED_EXTENSIONS[ext] };
  }

  if (Number(bytes) > MAX_SOURCE_BYTES) {
    return { ok: false, reason: "app.aiEmployee.source.failed.tooLarge" };
  }

  if (READABLE_EXTENSIONS.includes(ext)) return { ok: true };

  // No extension, or an unfamiliar one. A declared text/* mime is enough —
  // extractText still has to find readable bytes.
  if (String(mimeType || "").toLowerCase().startsWith("text/")) return { ok: true };

  return { ok: false, reason: "app.aiEmployee.source.failed.binary" };
}

/**
 * The text of a file whose bytes are supposed to be text.
 *
 * The last line of defence against a .txt that is really a PDF somebody
 * renamed: a NUL byte, or a run of control characters, means this is not text
 * whatever the name said, and the source fails rather than filling a prompt
 * with mojibake the model will treat as content.
 *
 * @param raw  a string (already decoded) or a Buffer/Uint8Array.
 * @returns {{ ok: true, text }} or {{ ok: false, reason }}
 */
export function extractText(raw) {
  let text;
  if (typeof raw === "string") {
    text = raw;
  } else if (raw && typeof raw.byteLength === "number") {
    text = new TextDecoder("utf-8", { fatal: false }).decode(raw);
  } else {
    return { ok: false, reason: "app.aiEmployee.source.failed.empty" };
  }

  // A PDF renamed .txt starts "%PDF-"; a DOCX starts "PK". Both are caught by
  // the control-character test below too, but naming them gives the contractor
  // the message that tells them what to do instead.
  if (text.startsWith("%PDF-")) {
    return { ok: false, reason: "app.aiEmployee.source.failed.pdf" };
  }
  if (text.startsWith("PK")) {
    return { ok: false, reason: "app.aiEmployee.source.failed.word" };
  }

  // eslint-disable-next-line no-control-regex
  // Tab, newline and carriage return are excluded from the class: they are
  // ordinary in a text file. A NUL byte settles it on its own; a run of the
  // others settles it statistically.
  const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
  const control = (text.match(CONTROL) || []).length;
  if (text.includes("\u0000") || (text.length > 0 && control / text.length > 0.01)) {
    return { ok: false, reason: "app.aiEmployee.source.failed.binary" };
  }

  const cleaned = text
    // Normalise line endings before anything counts characters, so a CRLF file
    // does not read as 6% longer than the same file saved on a Mac.
    .replace(/\r\n?/g, "\n")
    // Collapse runs of blank lines — a manual pasted out of a word processor is
    // half empty lines, and every one of them is a token somebody pays for.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return { ok: false, reason: "app.aiEmployee.source.failed.empty" };

  return { ok: true, text: cleaned.slice(0, MAX_SOURCE_BYTES) };
}

/** Rough token count. An estimate, and every surface that shows it says so. */
export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

/**
 * Split a document into retrievable pieces.
 *
 * Split on blank lines first so a paragraph stays whole, and only fall back to
 * a hard cut for a paragraph longer than a chunk (a CSV with no blank lines is
 * exactly that). A chunk that ends mid-sentence is a chunk the model quotes
 * mid-sentence, which is how "your warranty covers" becomes an answer.
 */
export function chunkText(text, { maxChars = CHUNK_CHARS } = {}) {
  const body = String(text || "").trim();
  if (!body) return [];

  const chunks = [];
  let current = "";

  for (const para of body.split(/\n{2,}/)) {
    const piece = para.trim();
    if (!piece) continue;

    if (piece.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < piece.length; i += maxChars) {
        chunks.push(piece.slice(i, i + maxChars));
      }
      continue;
    }

    if (current.length + piece.length + 2 > maxChars) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

// Words that appear in every message and would otherwise dominate the score.
// Short and English-only on purpose: a longer list, or one per language, would
// be a translation task nobody has done, and an unstopped word costs a little
// precision where a wrongly-stopped one loses a real match.
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "been", "to", "of", "in", "on", "for", "with", "at", "by", "from", "it",
  "this", "that", "these", "those", "i", "you", "we", "they", "my", "your",
  "our", "do", "does", "did", "can", "could", "would", "should", "have",
  "has", "had", "how", "what", "when", "where", "why", "please", "hi",
  "hello", "thanks", "thank",
]);

/** Meaningful lowercase words, deduplicated. */
function terms(query) {
  return [
    ...new Set(
      String(query || "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
    ),
  ];
}

/**
 * Which of a role's preferred kinds ranks first.
 *
 * A troubleshooter reaches for the troubleshooting guide before the price
 * list; a closer does the reverse. This is a TIE-BREAK on top of the keyword
 * score, never a filter — a company that uploaded something meant it to be
 * read, and hiding a policy from a closer would be this file deciding what a
 * contractor's own material is for.
 */
export function rankKinds(role) {
  switch (role) {
    case "troubleshooter":
      return ["troubleshooting", "manual", "policy", "pricing", "other"];
    case "closer":
      return ["pricing", "policy", "manual", "troubleshooting", "other"];
    default:
      return ["policy", "manual", "troubleshooting", "pricing", "other"];
  }
}

/**
 * The material that goes into ONE prompt.
 *
 * @param sources  [{ id, title, kind, extractedText }] — rows the CALLER read
 *                 under one companyId. This function never queries anything:
 *                 it cannot reach a second tenant's row because it is never
 *                 handed a database. That is the tenant fence, and it is
 *                 structural rather than a filter that could be forgotten.
 * @param query    the customer's message.
 * @returns [{ id, title, kind, text }] — capped at MAX_CONTEXT_CHARS in total.
 *
 * ── Why an unmatched query still returns material ────────────────────────
 *
 * A homeowner writing "hi, is anyone there?" scores zero against every chunk.
 * Returning nothing would leave a troubleshooter with no material at all on
 * the opening message of every conversation. So a zero-scoring query falls
 * back to the START of each document in the role's kind order — the top of a
 * policy is the summary, and it is a far better default than silence.
 */
export function selectChunks({ sources = [], query = "", role = null, maxChars = MAX_CONTEXT_CHARS } = {}) {
  const words = terms(query);
  const order = rankKinds(role);

  const scored = [];
  for (const source of sources) {
    if (!source?.extractedText) continue;
    const kindRank = order.indexOf(source.kind || "other");
    const chunks = chunkText(source.extractedText);

    chunks.forEach((text, index) => {
      const haystack = text.toLowerCase();
      let score = 0;
      for (const w of words) {
        // Count occurrences, capped at 3 per term: a chunk that says "furnace"
        // forty times is a chunk about furnaces, not forty times more relevant
        // than one that explains the furnace policy once.
        let hits = 0;
        let from = 0;
        while (hits < 3) {
          const at = haystack.indexOf(w, from);
          if (at === -1) break;
          hits++;
          from = at + w.length;
        }
        score += hits;
      }
      scored.push({
        id: source.id,
        title: source.title,
        kind: source.kind || "other",
        text,
        score,
        // Ties break on the role's kind order, then on position in the
        // document, so a fallback selection is the top of each file.
        kindRank: kindRank === -1 ? order.length : kindRank,
        index,
      });
    });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.kindRank - b.kindRank || a.index - b.index,
  );

  const picked = [];
  let used = 0;
  for (const chunk of scored) {
    if (used + chunk.text.length > maxChars) continue;
    picked.push({ id: chunk.id, title: chunk.title, kind: chunk.kind, text: chunk.text });
    used += chunk.text.length;
    if (used >= maxChars) break;
  }

  return picked;
}
