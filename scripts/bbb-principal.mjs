// scripts/bbb-principal.mjs
//
// Read BBB profiles for worked leads from a real browser on a real
// machine, at a human pace, and record who to ask for.
//
//   node --experimental-websocket --env-file-if-exists=.env --import ./scripts/alias-loader.mjs scripts/bbb-principal.mjs --claimed
//   ... --next 60            # then the trades being worked, in dispatch order
//   ... --ids a,b,c          # specific prospects
//   ... --plan               # print who it would visit, in order; open nothing
//   ... --headless           # no window (the first run should be visible — see below)
//   ... --resume             # skip prospects already in the JSONL output
//   ... --out /path/file.jsonl
//   ... --no-db --batch b.json   # no database here: the batch JSON saved from
//                            # /api/platform/sales/prospects/bbb-batch; upload the
//                            # JSONL afterwards on /platform/sales/prospects
//
// `--experimental-websocket` is needed on Node 20 (Node 22 has WebSocket
// built in); the browser is driven over Chrome's DevTools socket, the way
// docs/screens/app-guide/harness/shoot.mjs drives it. `npm run bbb:principal`
// wraps the whole command.
//
// ══ Why a browser on the owner's Mac ══════════════════════════════════════
//
// bbb.org answers 403 with a Cloudflare challenge to anything that is not
// a browser (lib/sales/intel/bbbProfile.js's header has the measurement),
// and its robots.txt allows the profile pages. A Chrome window on a home
// connection, opening one search and one profile every few seconds, is a
// person reading BBB — which is what this is: a batch tool for the leads
// reps are dialling this week, never the pool, run at the pace of a hand.
// Nothing here retries a challenge, rotates anything, or hides. On the
// first challenge it STOPS and says how many it did.
//
// ══ Direct to the database, the way every scripts/check-*.mjs runs ════════
//
// With DATABASE_URL in .env the batch is read through the same
// lib/sales/intel/enrichmentOrder.js every pass uses, and each result is
// written through lib/sales/intel/bbbApply.js — the same server-side
// re-match and the same never-overwrite path the upload route uses. The
// JSONL file is written as it goes regardless, so a run can resume and a
// run without the database can be uploaded.
//
// ══ The match ═════════════════════════════════════════════════════════════
//
// The search page's JSON-LD lists every result with its city and phone.
// The one to open is chosen by lib/sales/intel/listingMatch.js — the
// Places rule: name overlap AND city/postal/phone agreement — and nothing
// else is opened. No confident match: the top candidate is recorded and
// refused. Two candidates that both pass: the better score, as the rule
// sorts them. The profile page is then parsed (bbbProfile.js) and re-
// matched server-side by bbbApply.js before anything is written.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { parseBbbProfile, parseBbbSearch, searchResultAsListing, bbbSearchUrlFor } from "@/lib/sales/intel/bbbProfile";
import { matchListings } from "@/lib/sales/intel/listingMatch";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d = null) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1] ?? d;
};

const CHROME =
  process.env.CHROME_BIN ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
/** A persistent profile, so a challenge passed once by hand stays passed. */
const PROFILE_DIR = process.env.BBB_PROFILE_DIR || path.join(os.homedir(), "Library", "Application Support", "fieldquo-bbb-profile");
const OUT = val("--out", path.join(process.cwd(), `bbb-principal-${new Date().toISOString().slice(0, 10)}.jsonl`));
const HEADLESS = flag("--headless");
const NO_DB = flag("--no-db");
const PLAN = flag("--plan");
const RESUME = flag("--resume");
/** Between pages: 3–5 s, jittered. A hand, not a loop. */
const PAUSE_MIN_MS = 3000;
const PAUSE_MAX_MS = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS));

function looksChallenged(html, title) {
  return /just a moment|cf-mitigated|challenge-platform|cf-chl|attention required/i.test(`${title}\n${String(html).slice(0, 5000)}`);
}

async function loadBatch() {
  if (NO_DB) {
    // No database on this machine: the batch is the JSON a superadmin saved
    // from GET /api/platform/sales/prospects/bbb-batch?scope=claimed, and
    // the results go back through "Upload BBB results" on the console.
    const file = val("--batch");
    if (!file) throw new Error("--no-db needs --batch <file>: the JSON saved from /api/platform/sales/prospects/bbb-batch (docs/sales/BBB-LOCAL-RUN.md).");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return { db: null, rows: parsed.rows || [], meta: { scope: parsed.scope || "file", skippedRecent: parsed.skippedRecent || 0 } };
  }
  const { db } = await import("@/lib/db");
  const { bbbBatch } = await import("@/lib/sales/intel/bbbBatch");
  const ids = (val("--ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const limit = Number(val("--next")) || Number(val("--limit")) || 60;
  let out;
  if (ids.length) out = await bbbBatch({ db, scope: "ids", ids });
  else if (flag("--next")) out = await bbbBatch({ db, scope: "next", limit });
  else out = await bbbBatch({ db, scope: "claimed", limit: Number(val("--limit")) || 500 });
  return { db, rows: out.rows, meta: out };
}

function alreadyDone() {
  const done = new Set();
  if (!RESUME || !existsSync(OUT)) return done;
  for (const line of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.prospectId) done.add(r.prospectId);
    } catch {
      // A torn last line from an interrupted run is not a result.
    }
  }
  return done;
}

async function openChrome() {
  if (!CHROME) throw new Error("No Chrome found. Set CHROME_BIN to the browser binary.");
  if (typeof WebSocket === "undefined") throw new Error("This Node has no WebSocket: run with `node --experimental-websocket …` (or `npm run bbb:principal -- …`).");
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const port = 9444 + Math.floor(Math.random() * 400);
  const chromeArgs = [`--remote-debugging-port=${port}`, `--user-data-dir=${PROFILE_DIR}`, "--no-first-run", "--no-default-browser-check", "--window-size=1200,900", "about:blank"];
  if (HEADLESS) chromeArgs.unshift("--headless=new");
  const chrome = spawn(CHROME, chromeArgs, { stdio: "ignore" });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {
      // not up yet
    }
  }
  if (!target) {
    chrome.kill();
    throw new Error("Chrome did not start (is another run using the same profile? close it first).");
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;
  await send("Page.enable");
  await send("Runtime.enable");
  const open = async (url) => {
    await send("Page.navigate", { url });
    // Wait for the document, then a beat for the JSON-LD scripts.
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      if ((await evaluate("document.readyState")) === "complete") break;
    }
    await sleep(800);
    const html = await evaluate("document.documentElement.outerHTML");
    const title = await evaluate("document.title");
    return { html: String(html || ""), title: String(title || ""), url: await evaluate("location.href") };
  };
  const close = () => {
    try {
      ws.close();
    } catch {
      // closing
    }
    chrome.kill();
  };
  return { open, close };
}

async function main() {
  const { db, rows, meta } = await loadBatch();
  const done = alreadyDone();
  const todo = rows.filter((r) => !done.has(r.id));
  process.stdout.write(`${rows.length} prospects in the batch (${meta.scope}${meta.skippedRecent ? `, ${meta.skippedRecent} checked in the last 180 days left out` : ""}); ${todo.length} to visit${RESUME ? ` (${done.size} already in ${OUT})` : ""}.\n`);
  if (PLAN) {
    for (const [i, r] of todo.entries()) process.stdout.write(`${String(i + 1).padStart(4)}  ${r.tier || "ids"}  ${r.businessName}  —  ${[r.city, r.province].filter(Boolean).join(", ")}  ${r.phoneE164 || ""}\n     ${r.searchUrl}\n`);
    process.stdout.write(`\nPlan only: nothing opened, nothing written. Estimated ${(todo.length * 2 * 4) / 60 | 0} minutes at a human pace.\n`);
    await db?.$disconnect?.();
    return;
  }
  if (!todo.length) {
    await db?.$disconnect?.();
    return;
  }
  const applyRow = NO_DB ? null : (await import("@/lib/sales/intel/bbbApply")).applyBbbRow;
  const out = fs.createWriteStream(OUT, { flags: "a" });
  const summary = { visited: 0, matched: 0, noMatch: 0, refusedByServer: 0, alreadyKnown: 0, peopleAdded: 0, challenged: false, errors: 0 };
  const browser = await openChrome();
  const started = Date.now();
  try {
    for (const p of todo) {
      const search = await browser.open(p.searchUrl);
      if (looksChallenged(search.html, search.title)) {
        summary.challenged = true;
        process.stdout.write(`\nBBB challenged the browser on the search for "${p.businessName}". Stopping here${HEADLESS ? " — run again WITHOUT --headless and pass the challenge in the window, then --resume" : " — pass the challenge in the window and run again with --resume"}.\n`);
        break;
      }
      const results = parseBbbSearch(search.html);
      const m = matchListings(p, results.map(searchResultAsListing));
      let record;
      if (m.verdict === "matched" && m.listing?.externalId) {
        await pause();
        const page = await browser.open(m.listing.externalId);
        if (looksChallenged(page.html, page.title)) {
          summary.challenged = true;
          process.stdout.write(`\nBBB challenged the browser on the profile for "${p.businessName}". Stopping here.\n`);
          break;
        }
        const profile = parseBbbProfile(page.html, { url: m.listing.externalId });
        record = { prospectId: p.id, businessName: p.businessName, at: new Date().toISOString(), profile, score: m.score, searchUrl: p.searchUrl };
      } else {
        const top = m.score ? { name: m.score.name, url: m.score.placeId, reason: m.score.reason, city: results.find((r) => r.url === m.score.placeId)?.city || null } : null;
        record = { prospectId: p.id, businessName: p.businessName, at: new Date().toISOString(), profile: null, reason: m.verdict, topCandidate: top, results: results.length, searchUrl: p.searchUrl };
      }
      summary.visited += 1;
      if (applyRow) {
        try {
          const r = await applyRow({ db, row: record });
          record.applied = r;
          if (r.outcome === "matched") {
            summary.matched += 1;
            summary.peopleAdded += r.peopleAdded || 0;
          } else if (r.outcome === "no_match") summary.noMatch += 1;
          else if (r.outcome === "already_known") summary.alreadyKnown += 1;
          else summary.refusedByServer += 1;
        } catch (err) {
          summary.errors += 1;
          record.applied = { outcome: "error", message: err?.message || String(err) };
        }
      } else if (record.profile) summary.matched += 1;
      else summary.noMatch += 1;
      out.write(`${JSON.stringify(record)}\n`);
      const who = record.profile?.people?.find((x) => x.kind === "principal") || record.profile?.people?.[0];
      process.stdout.write(`${String(summary.visited).padStart(4)}/${todo.length}  ${p.businessName} — ${record.profile ? `${who ? `${who.name}${who.role ? ` (${who.role})` : ""}` : "profile, nobody named"}${record.applied ? ` · ${record.applied.outcome}` : ""}` : `no match (${record.reason}${record.topCandidate?.name ? `; top: ${record.topCandidate.name}` : ""})`}\n`);
      await pause();
    }
  } finally {
    browser.close();
    await new Promise((r) => out.end(r));
    await db?.$disconnect?.();
  }
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  process.stdout.write(
    `\nDone in ${mins} min: ${summary.visited} visited, ${summary.matched} matched, ${summary.noMatch} no match, ${summary.refusedByServer} refused by the server's re-match, ${summary.alreadyKnown} already known, ${summary.peopleAdded} people added${summary.errors ? `, ${summary.errors} errors` : ""}${summary.challenged ? " — STOPPED on a challenge" : ""}.\nResults: ${OUT}${NO_DB ? " — upload it on /platform/sales/prospects → Upload BBB results." : ""}\n`,
  );
  if (summary.challenged) process.exitCode = 3;
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exitCode = 1;
});
