// lib/team/separationRecord.js
//
// The server half of lib/team/separation.js: the words that go into a
// person's HR file when their employment ends or restarts. Kept apart from
// the pure module because this one reads the catalogue and the database, and
// the pure one is imported by the browser.
//
// ══ Which language the note is written in ═══════════════════════════════════
//
// The company's default language — the one it keeps its own records in. Not
// the clicking manager's interface language: an HR file read by three
// managers in two languages should not switch language halfway down the
// timeline depending on who pressed the button. The manager's explanation
// underneath is verbatim, in whatever language they typed it, and is never
// translated (a record that changes what it says is not a record).
import { db as defaultDb } from "@/lib/db";
import { appSentence } from "@/lib/notify/push";
import {
  calendarDayOf,
  separationNoteBody,
  separationTypeKey,
} from "@/lib/team/separation";

/** The company's record-keeping language, "en" when it states none. */
export async function recordLanguage(companyId, { db = defaultDb } = {}) {
  if (!companyId) return "en";
  const row = await db.company.findUnique({
    where: { id: companyId },
    select: { defaultLanguage: true },
  });
  return row?.defaultLanguage || "en";
}

/** The acting member's display name, for "recorded by". */
export async function actorDisplayName(member, { db = defaultDb } = {}) {
  if (!member?.userId) return null;
  const user = await db.user.findUnique({
    where: { id: member.userId },
    select: { name: true, email: true },
  });
  return user?.name || user?.email || null;
}

/**
 * The separation note's body — header of facts, blank line, explanation.
 * @param data  parseSeparation's `data`
 */
export async function separationNoteText({ language, data, recordedBy }) {
  const [typeLabel, rehire] = await Promise.all([
    appSentence(language, separationTypeKey(data.type)),
    appSentence(
      language,
      data.rehireEligible === true
        ? "app.separation.rehireYes"
        : data.rehireEligible === false
          ? "app.separation.rehireNo"
          : "app.separation.rehireUnset",
    ),
  ]);
  const header = await appSentence(language, "app.separation.noteHeader", {
    type: typeLabel || data.type,
    date: calendarDayOf(data.lastDay),
    rehire: rehire || "",
    name: recordedBy || "—",
  });
  return separationNoteBody(header, data.explanation);
}

/** The re-activation note's body: who switched them back on, and when. */
export async function reactivationNoteText({ language, on = new Date(), by }) {
  return (
    (await appSentence(language, "app.separation.reactivatedNote", {
      date: calendarDayOf(on),
      name: by || "—",
    })) || `Re-activated on ${calendarDayOf(on)} by ${by || "—"}.`
  );
}
