// lib/sales/calls/contractorWordsSql.js
//
// How many words the contractor said on a call, counted INSIDE Postgres.
//
// conversation.js's rule — a conversation is a connected call whose
// contractor track carries CONVERSATION_MIN_CONTRACTOR_WORDS words — was
// first applied by reading `transcript` off every row and counting in
// JavaScript. /platform/costs stopped doing that (a month of transcripts
// leaving the database to be word-counted is the wrong shape) and counted
// in SQL, and the performance page never selected `transcript` at all, so
// its "Conversation (transcript)" column could only ever print "not yet
// known" — for every call, for ever, whatever the transcriber did. One
// fragment, used by both, so the two pages count the same way and a third
// caller cannot drift.
//
// The count is over segments whose speaker is "contractor" — the label
// lib/sales/calls/recording.js channelSpeakers writes — and null when
// there is no transcript, because conversation.js treats null as "not yet
// known" and zero as "said nothing". A mixed single-track conference
// transcript has "unknown" speakers and counts zero, exactly as the
// JavaScript counter does.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * The SELECT expression, for a query that aliases SalesCallAttempt as `a`.
 * Spliced with Prisma.raw because a column reference cannot be a
 * parameter; it contains no user input.
 */
export const CONTRACTOR_WORDS_SQL = Prisma.raw(`CASE WHEN a."transcript" IS NULL THEN NULL ELSE (
             SELECT COALESCE(SUM(array_length(regexp_split_to_array(trim(seg->>'text'), '\\s+'), 1)), 0)::int
             FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a."transcript") = 'array' THEN a."transcript" ELSE '[]'::jsonb END) seg
             WHERE seg->>'speaker' = 'contractor' AND trim(seg->>'text') <> ''
           ) END`);

/**
 * `contractorWords` for the transcribed rows among `ids`, as a Map id →
 * count. Rows without a transcript are absent from the map (not zero), so
 * a caller spreading it onto rows leaves `contractorWords` undefined for
 * them and conversation.js falls through to "unknown".
 */
export async function contractorWordCounts({ ids = [], client = db } = {}) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id))];
  if (list.length === 0) return new Map();
  const rows = await client.$queryRaw(Prisma.sql`
    SELECT a."id", ${CONTRACTOR_WORDS_SQL} AS "contractorWords"
    FROM "SalesCallAttempt" a
    WHERE a."id" IN (${Prisma.join(list)}) AND a."transcript" IS NOT NULL`);
  return new Map(rows.map((r) => [r.id, Number.isFinite(Number(r.contractorWords)) ? Number(r.contractorWords) : null]));
}
