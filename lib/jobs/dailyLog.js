// lib/jobs/dailyLog.js
//
// What happened on a job on a given day — the rules, with no database.
//
// ══ The day is a DAY, not an instant ═══════════════════════════════════════
//
// JobDailyLog.logDate is UTC midnight of the calendar day being REPORTED ON,
// and the schema comment says why: "a crew member filling yesterday's log at
// 6am is normal and must not create a second Tuesday." The unique index
// (jobId, logDate) is what enforces that, and it only works if every writer
// lands on the same instant for the same Tuesday.
//
// So the wire format is "YYYY-MM-DD" and nothing else. An ISO instant is
// refused, deliberately:
//
//   A crew member in Vancouver finishing at 20:00 on Tuesday sends an instant
//   of 2026-09-02T03:00:00Z — WEDNESDAY in UTC. The office in Montreal opens
//   the same log next morning and sends 2026-09-01T13:00:00Z — Tuesday. Two
//   rows, two half-written logs, one Tuesday. That is the exact failure the
//   unique index exists to prevent, arriving through the front door.
//
// The browser knows which calendar day the person means; it is the only party
// that does. It says so in words, and this file refuses anything else rather
// than guessing a timezone on the server. Same discipline as
// parseExpectedVersion in lib/concurrency/staleWrite.js: a value that is
// present but unreadable is a 400, never a silent default.
//
// ══ Null is not zero ═══════════════════════════════════════════════════════
//
// crewCount, hoursOnSite, weather and delays are all optional and all
// nullable, and an unanswered question is not an answer of zero. "Crew: 0" is
// a statement that nobody was on site — a claim with consequences on a
// disputed delay — and nothing here or in the renderer may invent it. But 0
// itself is a legitimate ANSWER, so the normalisers preserve a typed 0 and
// return null only for a blank.
//
// ══ No imports, on purpose ═════════════════════════════════════════════════
//
// Same reason lib/concurrency/staleWrite.js has none: scripts/check-daily-log.mjs
// EXECUTES this exact file rather than a copy or a stub-loaded shape.

/** The only shape a client may send for a day. */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Refusals carry a status so a route can hand them straight back. */
function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "bad_log_date";
  return err;
}

/**
 * "2026-09-01" → the Date at 2026-09-01T00:00:00.000Z.
 *
 * @throws a 400-carrying Error for anything that is not a real calendar day.
 *
 * Date.UTC is used rather than `new Date(string)` because the latter's
 * handling of a bare date is correct today and has been changed twice by the
 * spec; and because the round-trip below catches "2026-02-30", which Date.UTC
 * would silently roll forward to 2026-03-02 — a log filed against a day that
 * does not exist, on the wrong day.
 */
export function parseLogDate(raw) {
  if (typeof raw !== "string" || !DAY_RE.test(raw)) {
    throw badRequest(
      "That log needs a day in YYYY-MM-DD form. Reload the page and try again.",
    );
  }
  const [y, m, d] = raw.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  if (
    at.getUTCFullYear() !== y ||
    at.getUTCMonth() !== m - 1 ||
    at.getUTCDate() !== d
  ) {
    throw badRequest(`There is no such day as ${raw}.`);
  }
  return at;
}

/** The inverse: a stored logDate back to the string the browser sent. */
export function dayKey(date) {
  const at = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(at.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${at.getUTCFullYear()}-${p(at.getUTCMonth() + 1)}-${p(at.getUTCDate())}`;
}

/**
 * The calendar day a person standing in `date`'s LOCAL timezone is living in.
 *
 * Called in the browser, where the local offset is the crew member's own. Not
 * called on the server for anything that decides which row to write — see the
 * header. It is here rather than in the component so the check script can
 * exercise the 6am-filing-yesterday case against the shipped function.
 */
export function localDayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** `offset` days from a "YYYY-MM-DD" key, in calendar days. */
export function shiftDayKey(key, offset) {
  const at = parseLogDate(key);
  at.setUTCDate(at.getUTCDate() + offset);
  return dayKey(at);
}

// ═══════════════════════════════════════════════════════════════════════════
// BODY — BlockNote's JSON, and the plain text derived from it
// ═══════════════════════════════════════════════════════════════════════════
//
// `body` is BlockNote's document JSON and `bodyText` is derived from it for
// search — "derived, never authored", as the schema says, because two sources
// of truth for the same words drift and the search index is the copy that
// loses.
//
// The editor that actually ships today is a textarea, not BlockNote — see
// docs/construction/STATUS.md and the report on this change for why (the
// registry cannot resolve @blocknote/core's own optional peer). The STORAGE
// FORMAT is BlockNote's anyway, produced by textToBody below, so swapping the
// editor in later is a component change with no data migration. That is the
// whole reason to write these two functions rather than storing a string.

/** A BlockNote paragraph carrying one line of plain text. */
function paragraph(line) {
  return {
    type: "paragraph",
    props: {},
    content: line ? [{ type: "text", text: line, styles: {} }] : [],
    children: [],
  };
}

/**
 * Plain text → BlockNote JSON. One paragraph per line, blanks preserved.
 *
 * Preserving a blank line as an empty paragraph rather than dropping it
 * matters: a crew member's log is a list separated by blank lines, and
 * collapsing them silently reformats what somebody wrote.
 */
export function textToBody(text) {
  if (typeof text !== "string" || text === "") return null;
  return text.split("\n").map((line) => paragraph(line));
}

/**
 * BlockNote JSON → the plain text bodyText stores.
 *
 * Walks `content` and `children` recursively, because BlockNote nests: a
 * bulleted list's items are `children` of the item above them, and a link's
 * words live in the link node's own `content`. A walker that only read
 * top-level `content` would index the first line of a log and none of the
 * rest, which is worse than not indexing at all — the search would look like
 * it worked.
 *
 * Hostile-input tolerant on purpose. `body` is a Json column: it holds
 * whatever the editor of the day serialised, including from a future version
 * of BlockNote with node types this function has never seen. It extracts every
 * `text` string it can reach and ignores the rest, rather than throwing and
 * taking the save down with it.
 */
export function bodyToText(body, { maxDepth = 24 } = {}) {
  const lines = [];

  const inline = (nodes, depth) => {
    if (depth > maxDepth || !Array.isArray(nodes)) return "";
    let out = "";
    for (const node of nodes) {
      if (typeof node === "string") {
        out += node;
        continue;
      }
      if (!node || typeof node !== "object") continue;
      if (typeof node.text === "string") out += node.text;
      // A link, or any future inline node that wraps more inline nodes.
      if (Array.isArray(node.content)) out += inline(node.content, depth + 1);
    }
    return out;
  };

  const walk = (blocks, depth) => {
    if (depth > maxDepth || !Array.isArray(blocks)) return;
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;

      if (Array.isArray(block.content)) {
        lines.push(inline(block.content, depth + 1));
      } else if (block.content && Array.isArray(block.content.rows)) {
        // A table. Cells are inline content; one line per row, tab-separated,
        // so a search for two words in the same row still finds them adjacent.
        for (const row of block.content.rows) {
          const cells = Array.isArray(row?.cells) ? row.cells : [];
          lines.push(
            cells.map((c) => inline(Array.isArray(c) ? c : c?.content, depth + 1)).join("\t"),
          );
        }
      }

      if (Array.isArray(block.children)) walk(block.children, depth + 1);
    }
  };

  walk(body, 0);

  // Trailing blanks are an artefact of the editor, not something anyone typed.
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const text = lines.join("\n");
  return text === "" ? null : text;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE OPTIONAL FIELDS — where null and zero are different words
// ═══════════════════════════════════════════════════════════════════════════

function badValue(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "bad_log_field";
  return err;
}

/**
 * How many people were on site.
 *
 * "" / null / undefined  → null   (nobody answered)
 * 0                      → 0      (somebody answered: nobody was there)
 * anything else invalid  → 400
 *
 * The 0 case is the reason this is a function rather than `Number(x) || null`,
 * which would erase a deliberate zero — and the null case is the reason it is
 * not `Number(x)`, which would invent one. Both directions of the same
 * mistake, and this codebase has shipped each.
 */
export function normaliseCrewCount(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 999) {
    throw badValue("Crew on site has to be a whole number of people.");
  }
  return n;
}

/** Hours on site. Same null/zero rule; two decimals, matching the column. */
export function normaliseHours(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  // 24 is the cap because logDate is one day. A 30-hour day is a typo or a
  // second day's hours filed against the first, and both are worth refusing
  // rather than quietly costing.
  if (!Number.isFinite(n) || n < 0 || n > 24) {
    throw badValue("Hours on site has to be between 0 and 24.");
  }
  return Math.round(n * 100) / 100;
}

/** Free text, trimmed. Empty becomes null — a blank box said nothing. */
export function normaliseNote(raw, { max = 2000 } = {}) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, max);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SEED — why a new log does not open empty
// ═══════════════════════════════════════════════════════════════════════════
//
// A blank box at the end of a shift gets skipped. The product already knows
// most of what happened today: JobPhoto rows carry the day's photos with their
// captions, and a completed Task carries the assignee's own completionComment
// ("what did you do?"). Both were written by the crew, on this job, on this
// day, and neither has ever met the other.
//
// So a day with no log yet opens PREFILLED from those two, as a draft the
// person edits. Nothing is stored until they save — a seeded row nobody looked
// at would be a fabricated record, which is worse than a missing one.
//
// Labels are passed in rather than translated here: this file is pure and has
// no t(). The component supplies them from the app catalogue.

/**
 * The opening draft for a day that has no log yet.
 *
 * @param {object}   day
 * @param {number}   day.photoCount   photos filed on this job on this day
 * @param {string[]} day.taskLines    one line per completed to-do
 * @param {object}   labels           { photos, tasks } — already translated
 * @returns BlockNote JSON, or null when the day has nothing to say. Null
 *          matters: an empty seed must leave the editor genuinely empty rather
 *          than pre-typing a heading over a day nobody worked.
 */
export function seedBody({ photoCount = 0, taskLines = [] } = {}, labels = {}) {
  const lines = [];

  if (photoCount > 0 && labels.photos) {
    lines.push(labels.photos.replace("{count}", String(photoCount)));
  }

  const tasks = (Array.isArray(taskLines) ? taskLines : [])
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter(Boolean);

  if (tasks.length > 0) {
    if (labels.tasks) lines.push(labels.tasks);
    for (const line of tasks) lines.push(`- ${line}`);
  }

  if (lines.length === 0) return null;

  // A blank line at the end so the cursor lands under the seeded facts rather
  // than inside them — the person is adding to this, not correcting it.
  lines.push("");
  return lines.map((line) => paragraph(line));
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ROUTES' SHARED PIECES
// ═══════════════════════════════════════════════════════════════════════════
//
// These live here rather than in app/api/jobs/[id]/daily-logs/route.js because
// Next 16 validates a route module's exports and rejects anything that is not
// an HTTP verb or a known config field — so a route file physically cannot be
// the home of something its sibling route imports. They are pure anyway, which
// means the check script executes the SHIPPED ones.

/** The entity name RecordEdit files a daily-log edit under. One spelling. */
export const DAILY_LOG_ENTITY = "jobDailyLog";

/** The columns both routes return. Never `select: undefined` — see below. */
export const LOG_SELECT = {
  id: true,
  logDate: true,
  body: true,
  bodyText: true,
  weather: true,
  crewCount: true,
  hoursOnSite: true,
  delays: true,
  authorUserId: true,
  authorName: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * A stored row, as the browser wants it.
 *
 * `hoursOnSite` is a Prisma Decimal, which JSON.stringify renders as a string
 * — so `4.5` would arrive as "4.5" and any arithmetic on it would concatenate.
 * Converted here, and NULL STAYS NULL: `Number(null)` is 0, which is exactly
 * the invented answer this whole file refuses to produce.
 */
export function shapeLog(log) {
  if (!log) return null;
  return {
    ...log,
    day: dayKey(log.logDate),
    hoursOnSite: log.hoursOnSite == null ? null : Number(log.hoursOnSite),
  };
}

/**
 * Read the writable fields off a request body.
 *
 * `bodyText` is NEVER accepted from the client. The schema calls it "derived,
 * never authored", and this is the line that makes that true: it is recomputed
 * from `body` on every write, so the search text cannot drift from the words on
 * the screen.
 *
 * `body` (BlockNote JSON) and `text` (a textarea's string) are both accepted,
 * because the editor is expected to change — see the BODY section above. The
 * STORED shape is BlockNote JSON either way, so the swap needs no migration.
 *
 * A field that is ABSENT from the request is absent from the result, so a
 * PATCH that only sends `weather` does not blank the body. A field that is
 * present and empty resolves to null, which is a person clearing it.
 *
 * @throws the 400-carrying Errors the normalisers throw.
 */
export function readLogFields(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const out = {};

  if (Array.isArray(input.body)) {
    out.body = input.body;
    out.bodyText = bodyToText(input.body);
  } else if (typeof input.text === "string") {
    out.body = textToBody(input.text);
    out.bodyText = bodyToText(out.body);
  }

  if ("weather" in input) out.weather = normaliseNote(input.weather, { max: 120 });
  if ("delays" in input) out.delays = normaliseNote(input.delays, { max: 2000 });
  if ("crewCount" in input) out.crewCount = normaliseCrewCount(input.crewCount);
  if ("hoursOnSite" in input) out.hoursOnSite = normaliseHours(input.hoursOnSite);

  return out;
}

/**
 * One line per completed to-do: its title, plus what the assignee wrote.
 *
 * Pure and separate so the check script can exercise the "a task with no
 * comment still gets a line" case, which is the one a naive
 * `${t.title}: ${t.completionComment}` gets wrong — it prints "Sand the deck:
 * null" into somebody's daily record.
 */
export function taskLine(task) {
  const title = typeof task?.title === "string" ? task.title.trim() : "";
  if (!title) return null;
  const comment =
    typeof task?.completionComment === "string"
      ? task.completionComment.trim()
      : "";
  return comment ? `${title} — ${comment}` : title;
}
