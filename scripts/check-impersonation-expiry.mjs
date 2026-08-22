// scripts/check-impersonation-expiry.mjs
//
// QA polled /api/impersonation/status twice, three seconds apart, and got
// expiresInSeconds: 1800 both times — the banner read "29:5x left" across
// dozens of navigations. Their conclusion was reasonable and alarming: either
// the 30-minute cap over a customer's data is not enforced, or the number is
// meaningless.
//
// It was the second. The cap IS enforced — impersonate.js sets a JWT exp and
// jwtVerify rejects anything past it — but verifyImpersonationToken dropped the
// exp claim, so the status route had nothing to compute from and returned a
// constant.
//
// These assert the enforcement itself, not the display, because "is the cap
// real" was the actual question.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-impersonation-expiry.mjs

process.env.IMPERSONATION_JWT_SECRET ||= "test-secret-for-guard-only-not-a-real-key";

import { SignJWT } from "jose";
import {
  verifyImpersonationToken,
  impersonationSecret,
  IMPERSONATION_DURATION_SECONDS,
  allowsWrites,
  isReadOnlyMethod,
} from "@/lib/platform/impersonationToken";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};

const mint = (expSecondsFromNow, mode = "read_only") =>
  new SignJWT({ impersonation: true, mode, companyId: "c1", platformAdminId: "a1" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expSecondsFromNow)
    .sign(impersonationSecret());

console.log("\nThe cap is real — this is the question QA actually raised");
t("a token 60s from expiry still verifies", Boolean(await verifyImpersonationToken(await mint(60))));
t("a token 1s PAST expiry is refused", await verifyImpersonationToken(await mint(-1)), null);
t("a token an hour past expiry is refused", await verifyImpersonationToken(await mint(-3600)), null);
t("a token expiring right now is refused", await verifyImpersonationToken(await mint(0)), null);

console.log("\nThe remaining time is now derivable, not invented");
const claims = await verifyImpersonationToken(await mint(600));
t("verified claims carry exp", typeof claims.expiresAt === "number");
const remaining = claims.expiresAt - Math.floor(Date.now() / 1000);
t("...and it describes reality (~600s)", remaining > 595 && remaining <= 600);
const nearly = await verifyImpersonationToken(await mint(2));
t("a nearly-dead token reports seconds, not 1800",
  nearly.expiresAt - Math.floor(Date.now() / 1000) <= 2);

console.log("\nThe status route computes it rather than hardcoding it");
const route = readFileSync(new URL("../app/api/impersonation/status/route.js", import.meta.url), "utf8");
t("no hardcoded 30 * 60", !/expiresInSeconds:\s*30 \* 60/.test(route));
t("derived from the claim", /claims\.expiresAt/.test(route));
t("never renders a negative countdown", /Math\.max\(0,/.test(route));

console.log("\nA tampered or unknown-mode token is still refused");
t("unknown mode refused", await verifyImpersonationToken(await mint(600, "full_access")), null);
t("garbage refused", await verifyImpersonationToken("not.a.jwt"), null);
t("empty refused", await verifyImpersonationToken(""), null);

console.log("\nMode still decides writes — unchanged, asserted so it stays that way");
t("read_only cannot write", allowsWrites("read_only"), false);
t("demo_sandbox can write", allowsWrites("demo_sandbox"), true);
t("GET is a read-only method", isReadOnlyMethod("GET"), true);
t("POST is not", isReadOnlyMethod("POST"), false);
t("the documented cap is still 30 minutes", IMPERSONATION_DURATION_SECONDS, 1800);

console.log("\nThe banner describes the mode it is actually in");
const banner = readFileSync(new URL("../app/components/ImpersonationBanner.js", import.meta.url), "utf8");
t("demo sessions are not labelled read-only", /demo_sandbox/.test(banner));
t("read-only sessions still say so", /nothing can be changed/.test(banner));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — the cap is enforced and the countdown tells the truth\n");
process.exit(fail ? 1 : 0);
