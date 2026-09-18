// scripts/scrape/lib/browser.mjs
//
// One real Chrome, one persistent profile, one person's pace. Shared by
// the Google Maps scrape and the BBB scrape.
//
// ══ Why a real Chrome and not a bundled Chromium ═══════════════════════════
//
// The owner's decision: the scrapes run on his Mac, from his home IP, in
// the Chrome already installed, at a human pace — no proxies, no cloud, no
// headless farm. playwright-core drives the installed Chrome through the
// DevTools protocol (`channel: "chrome"`), with its own profile under
// ~/Library/Application Support/fieldquo-scrape so cookies, the consent
// choice and Google's own "this browser is fine" signals persist between
// runs and never touch the owner's personal profile. Visible by default:
// a window on the desk is the honest shape of "a person is reading Maps",
// and the owner can watch it and close it.
//
// ══ What stops a run ═══════════════════════════════════════════════════════
//
// A challenge — Google's /sorry/ page, a reCAPTCHA, the "unusual traffic"
// interstitial — stops the run at once with a ChallengeError. Nothing here
// tries to solve one, retry through one or wait one out: a home IP that has
// been asked once is a home IP that is being watched, and the right move is
// to stop for the day. The consent wall (consent.google.com, shown in some
// regions) is different: it is handled ONCE by pressing "Reject all", and
// the persistent profile remembers the answer.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { SCRAPE_HOME } from "./log.mjs";
import { humanPause, pointIn, wheelDelta } from "./pace.mjs";

export const PROFILE_DIR = path.join(SCRAPE_HOME, "chrome-profile");

export class ChallengeError extends Error {
  constructor(kind, url) {
    super(`Google showed a ${kind} page at ${url} — stopping. Wait a few hours before running again.`);
    this.name = "ChallengeError";
    this.kind = kind;
    this.url = url;
  }
}

/** The BCP-47 locale for a two-letter output language. */
export function localeFor(lang = "en") {
  return { en: "en-US", fr: "fr-CA", es: "es-US" }[lang] || "en-US";
}

/**
 * Launch (or reuse) the scrape's Chrome. Returns { context, page }.
 * `headless` is opt-in; the default is a window the owner can see.
 */
export async function launchBrowser({ headless = false, lang = "en", profileDir = PROFILE_DIR, viewport = { width: 1280, height: 900 } } = {}) {
  fs.mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless,
    viewport,
    locale: localeFor(lang),
    args: [`--lang=${localeFor(lang)}`, "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

/** Pure: what kind of wall is this page, if any. */
export function classifyWall({ url = "", text = "" } = {}) {
  const u = String(url);
  const t = String(text);
  if (/\/sorry\//.test(u) || /unusual traffic|trafic inhabituel|tráfico inusual/i.test(t)) return "unusual_traffic";
  if (/recaptcha|I'm not a robot|Je ne suis pas un robot|No soy un robot/i.test(t) && /verify|vérifi|verific/i.test(t)) return "captcha";
  if (/consent\.google\./.test(u)) return "consent";
  return null;
}

/**
 * Look at the page once: handle a consent wall, throw on a challenge.
 * Call after every navigation and every scroll pass.
 */
export async function guardPage(page, { log = null } = {}) {
  const url = page.url();
  let text = "";
  try {
    text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) || "");
  } catch {
    text = "";
  }
  const wall = classifyWall({ url, text });
  if (!wall) return null;
  if (wall === "consent") {
    const button = page.getByRole("button", { name: /reject all|tout refuser|rechazar todo/i }).first();
    if (await button.count()) {
      await humanPause(1500, 3000);
      await button.click();
      log?.event("consent_handled", { url });
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await humanPause();
      return "consent";
    }
  }
  log?.event("challenge", { kind: wall, url });
  throw new ChallengeError(wall, url);
}

/** Navigate like a person: go, wait for the DOM, pause, look at the page. */
export async function visit(page, url, { log = null, waitUntil = "domcontentloaded" } = {}) {
  await page.goto(url, { waitUntil, timeout: 60_000 });
  await humanPause(2500, 5000);
  return guardPage(page, { log });
}

/** Drift the mouse somewhere on the page, occasionally. */
export async function wander(page, { rand = Math.random } = {}) {
  if (rand() > 0.5) return;
  const vp = page.viewportSize() || { width: 1280, height: 900 };
  const p = pointIn({ x: 0, y: 0, width: vp.width, height: vp.height }, rand);
  await page.mouse.move(p.x, p.y, { steps: Math.floor(5 + rand() * 12) });
}

/**
 * One wheel scroll inside an element, from a point inside it, by a human
 * delta. Returns the delta used.
 */
export async function wheelIn(page, locator, { rand = Math.random } = {}) {
  const box = await locator.boundingBox();
  if (!box) return 0;
  const p = pointIn(box, rand);
  await page.mouse.move(p.x, p.y, { steps: Math.floor(3 + rand() * 6) });
  const delta = wheelDelta(rand);
  await page.mouse.wheel(0, delta);
  return delta;
}
