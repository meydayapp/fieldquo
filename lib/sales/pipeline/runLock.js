// lib/sales/pipeline/runLock.js
//
// One sales-pipeline run at a time.
//
// ══ Why the cron needs this ═══════════════════════════════════════════════
//
// The route fires every minute and, measured on 2026-09-28 (Vercel
// Observability, 18:15–21:15 EDT), each run took p50 156 s, p95 237 s, max
// 292 s — so about three invocations were alive at any moment, and they spent
// 27,914 of the project's 30,079 function-seconds in that window (93%). They
// were slow largely BECAUSE they overlapped: every run makes the same
// full-table Prospect reads, three at once pushed the table out of Neon's
// shared_buffers, and each read then went to disk. The runner's leases made
// the overlap SAFE (no task runs twice) but never made it cheap.
//
// So a run that finds another run still going leaves at once: 200,
// { skipped: "running" }, one connection and two statements. Nothing is lost —
// every step of the run is state-driven (queued tasks, rows missing a stamp),
// so the next minute's tick picks up whatever this one would have done.
//
// ══ Why a TRANSACTION-level lock on a dedicated client ════════════════════
//
// The obvious tool is pg_try_advisory_lock, the session-level lock. It is
// wrong here twice over:
//
//   1. lib/db's Prisma client runs over a pg Pool, and each query may take a
//      different pooled connection. A session lock taken on one connection
//      must be released on the SAME one; pg_advisory_unlock on another
//      connection returns false and the lock stays held by an idle pooled
//      connection for as long as the lambda stays warm.
//   2. DATABASE_URL is Neon's PgBouncer endpoint (-pooler), in TRANSACTION
//      mode: between transactions the server connection goes back to
//      PgBouncer's pool, so even a single client's session lock would be
//      stranded on a server connection some other client then inherits.
//
// A transaction-scoped lock (pg_try_advisory_xact_lock) inside a BEGIN that
// stays open for the whole run avoids both: PgBouncer pins one server
// connection to an open transaction, the lock lives exactly as long as that
// transaction, COMMIT releases it, and if the lambda is killed mid-run (the
// 300 s maxDuration) the socket closes, PgBouncer drops the transaction and
// the lock goes with it — no stale lock can outlive its run.
//
// It is a dedicated pg Client, not a connection taken from lib/db's pool, so
// the run keeps all five pooled connections for its own work. The open
// transaction does no reads or writes after taking the lock: it holds no
// snapshot and no transaction id, so it does not hold back vacuum.
//
// One ceiling to know: Postgres's idle_in_transaction_session_timeout on this
// database is 300 s (read 2026-09-29). The lock transaction is idle for the
// whole run, so a run longer than that would lose its lock while still
// working. The route's time budget ends every run well inside 300 s, and
// Vercel kills the function at maxDuration = 300 s regardless.
import { Client } from "pg";

/**
 * The advisory-lock key for the sales-pipeline cron. Fixed and documented,
 * never derived at runtime: 0x53414C4553 is "SALES" in ASCII.
 *
 * Deliberately above 2^31. Every other advisory lock in this codebase keys on
 * hashtext(…), which is an int4, so no hashtext key can ever equal this one.
 */
export const SALES_PIPELINE_LOCK_KEY = 0x53414c4553n; // 357,577,803,091

function defaultConnect() {
  return new Client({ connectionString: process.env.DATABASE_URL });
}

async function endQuietly(client) {
  try {
    await client.end();
  } catch {
    // Already closed, or closing: either way the connection is done with.
  }
}

/**
 * Try to take the run lock without waiting.
 *
 * @param key      the bigint advisory key
 * @param connect  () => an unconnected pg Client (a check passes a fake)
 * @param log      where a failed release is reported
 * @returns a lock with `release()`, or null when another run holds it.
 *          Throws only when the database cannot be reached at all (after one
 *          retry, for Neon's cold start) — the run could not have worked either.
 */
export async function tryTakeRunLock({ key = SALES_PIPELINE_LOCK_KEY, connect = defaultConnect, log = (line) => console.error(line) } = {}) {
  let client;
  for (let attempt = 1; ; attempt++) {
    client = connect();
    // An idle client the server disconnects (the timeout above, a Neon
    // restart) emits 'error'. Unhandled, that event crashes the process; here
    // it only means the lock is already gone, which release() tolerates.
    client.on?.("error", (err) => log(`[sales-pipeline lock] connection error: ${err?.message || err}`));
    try {
      await client.connect();
      break;
    } catch (err) {
      await endQuietly(client);
      // Neon scales to zero; the first connection after idle can fail. Once.
      if (attempt >= 2) throw err;
    }
  }

  let locked = false;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT pg_try_advisory_xact_lock($1::bigint) AS locked", [String(key)]);
    locked = rows?.[0]?.locked === true;
  } catch (err) {
    await endQuietly(client);
    throw err;
  }

  if (!locked) {
    // Nothing was taken; end the transaction and the connection now, so a
    // skipped tick costs a connection for milliseconds and nothing more.
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is going away on the next line either way.
    }
    await endQuietly(client);
    return null;
  }

  let released = false;
  return {
    key,
    /** COMMIT on the connection that took the lock — the only one that can
     *  release it. Never throws: it runs in the route's `finally`, and a
     *  failure here must not replace the run's own result or error. */
    async release() {
      if (released) return;
      released = true;
      try {
        await client.query("COMMIT");
      } catch (err) {
        // The session was already gone (and the lock with it).
        log(`[sales-pipeline lock] release: ${err?.message || err}`);
      } finally {
        await endQuietly(client);
      }
    },
  };
}
