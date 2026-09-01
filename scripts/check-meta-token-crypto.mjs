// scripts/check-meta-token-crypto.mjs
//
// The encryption around a contractor's Meta OAuth token, EXECUTED.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// The agent that built lib/meta/tokenCrypto.js said, plainly and to its
// credit, that it had exercised the module by hand and that no automated
// check covered it. That is exactly the gap worth closing rather than
// admiring: this is the only thing standing between a database read and a
// live credential that can spend a contractor's advertising budget.
//
// Everything here runs the real functions. There is no source-grepping in
// this file at all — a regex confirming the string "aes-256-gcm" appears
// would prove nothing about whether the ciphertext round-trips, whether a
// tampered blob is rejected, or whether a wrong key fails closed.
//
// ══ The key is set and restored around every case ══════════════════════════
//
// META_TOKEN_ENCRYPTION_KEY is read at call time, not at import, so each case
// can set it, assert, and put the environment back. The original value is
// captured once and restored in a finally, so running this locally with a
// real key configured cannot leave the shell holding a test key.
import { encryptToken, decryptToken, tokenCryptoConfigured } from "../lib/meta/tokenCrypto.js";

let checks = 0;
let failures = 0;
const ok = (name, pass, detail = "") => {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail && !pass ? `  — ${detail}` : ""}`);
};
const section = (t) => console.log(`\n${t}\n`);

const ORIGINAL = process.env.META_TOKEN_ENCRYPTION_KEY;
const setKey = (v) => {
  if (v === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY;
  else process.env.META_TOKEN_ENCRYPTION_KEY = v;
};
const threw = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

// Two valid keys in the two accepted encodings, and a third for the
// wrong-key case. Test values only — never a real key.
const HEX_KEY = "a".repeat(64);
const B64_KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = "b".repeat(64);

try {
  section("1. A token survives the round trip, in both key encodings");

  for (const [label, key] of [["hex", HEX_KEY], ["base64", B64_KEY]]) {
    setKey(key);
    const secret = "EAAG_a_meta_access_token_with_symbols_/+=_and_ünïcode";
    const blob = encryptToken(secret);
    ok(`${label} key: round-trips exactly`, decryptToken(blob) === secret);
    ok(`${label} key: the blob is not the plaintext`, !String(blob).includes("meta_access_token"));
  }

  section("2. The same token twice does not produce the same ciphertext");

  setKey(HEX_KEY);
  // A fresh IV per call. Without it, two contractors with the same token —
  // or one contractor re-saving — would produce identical blobs, and equal
  // ciphertext is itself a disclosure.
  const a = encryptToken("same-token");
  const b = encryptToken("same-token");
  ok("two encryptions of one value differ", a !== b);
  ok("...and both still decrypt", decryptToken(a) === "same-token" && decryptToken(b) === "same-token");

  section("3. Tampering is detected rather than absorbed");

  setKey(HEX_KEY);
  const good = encryptToken("token-to-tamper-with");
  const flipLast = good.slice(0, -1) + (good.slice(-1) === "a" ? "b" : "a");
  ok("a single flipped character fails to decrypt", threw(() => decryptToken(flipLast)));
  ok("truncated input fails", threw(() => decryptToken(good.slice(0, 10))));
  ok("empty string fails", threw(() => decryptToken("")));
  ok("null fails", threw(() => decryptToken(null)));
  ok("arbitrary text fails", threw(() => decryptToken("not-a-blob-at-all")));

  section("4. A different key cannot read it — GCM fails closed");

  setKey(HEX_KEY);
  const sealed = encryptToken("only-for-the-first-key");
  setKey(OTHER_KEY);
  // The point of an AEAD: the wrong key must THROW, never return plausible
  // garbage that a caller might hand to Meta as a bearer token.
  ok("the wrong key throws rather than returning garbage", threw(() => decryptToken(sealed)));

  section("5. A missing or malformed key refuses, and says so");

  setKey(undefined);
  ok("no key at all: tokenCryptoConfigured() is false", tokenCryptoConfigured() === false);
  ok("no key at all: encrypt refuses", threw(() => encryptToken("x")));
  ok("no key at all: decrypt refuses", threw(() => decryptToken(sealed)));

  for (const [label, bad] of [
    ["too short", "abcd"],
    ["63 hex chars", "a".repeat(63)],
    ["65 hex chars", "a".repeat(65)],
    ["not hex, not base64", "zzzz!!!!"],
    ["empty", ""],
    ["whitespace", "   "],
  ]) {
    setKey(bad);
    ok(`malformed key (${label}) is refused, not silently used`, tokenCryptoConfigured() === false);
    ok(`malformed key (${label}) makes encrypt throw`, threw(() => encryptToken("x")));
  }

  section("6. A whitespace-padded valid key still works");

  // Deploy panels add trailing newlines. Refusing a key that is correct but
  // padded would look like a broken integration rather than a config typo.
  setKey(`  ${HEX_KEY}\n`);
  ok("a padded hex key is accepted", tokenCryptoConfigured() === true);
  ok("...and round-trips", decryptToken(encryptToken("padded")) === "padded");
} finally {
  setKey(ORIGINAL);
}

console.log(
  failures
    ? `\n✗ meta token crypto: ${failures} of ${checks} failed\n`
    : `\n✓ meta token crypto: ${checks} checks, a contractor's ad credential is sealed\n`,
);
process.exit(failures ? 1 : 0);
