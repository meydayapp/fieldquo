// lib/reviews/wallet/config.js
//
// The two signing identities behind "Add to Apple Wallet" and "Add to Google
// Wallet", read from env, and the one question every caller asks first: is
// this deployment able to sign a pass at all?
//
// ── Why the answer is asked, not assumed ──────────────────────────────────────
//
// Both buttons ship before the owner has done the developer-portal work in
// docs/WALLET-PASS.md. Until then the settings page must say "not set up yet"
// rather than offer a download that 500s — and it must say WHICH variable is
// missing, because "not configured" sends the owner to a checklist and a
// variable name sends them to the Vercel row. The routes ask the same
// question again before signing; a hidden button is not access control.
//
// ── Apple ─────────────────────────────────────────────────────────────────────
//
// APPLE_PASS_TYPE_ID         pass.com.fieldquo.review — the identifier the
//                            owner registers; it is printed inside every pass.
// APPLE_TEAM_ID              the ten-character team id, also not secret.
// APPLE_PASS_CERT_P12_BASE64 the Pass Type ID certificate AND its private key,
//                            as one PKCS#12 bundle, base64 — a serverless
//                            function has no file to read a key from and a
//                            PEM with newlines does not survive an env form.
// APPLE_PASS_CERT_PASSWORD   the .p12 password.
//
// The bundle is parsed once per cold start (PKCS#12 decryption is slow enough
// to notice on a phone) and the parsed pair cached. `node-forge` does the
// parse and, in applePass.js, the PKCS#7 signature; Node's own crypto has
// neither a PKCS#12 reader nor a CMS signer.
//
// ── Google ────────────────────────────────────────────────────────────────────
//
// GOOGLE_WALLET_ISSUER_ID            the issuer number from the Wallet console.
// GOOGLE_WALLET_SERVICE_ACCOUNT_JSON the service account's key file, base64
//                                    (raw JSON tolerated). Only client_email
//                                    and private_key are read: the pass is a
//                                    JWT signed by the service account, and
//                                    Google creates the class and object from
//                                    the JWT itself — no Wallet API call, no
//                                    auth library.

import forge from "node-forge";
import { WWDR_G4_PEM } from "./wwdrG4";

const trim = (value) => (value || "").trim() || null;

// Read by name, one line each, so scripts/check-env-docs.mjs — which greps
// for `process.env.NAME` — sees every variable this file depends on.
const READERS = {
  APPLE_PASS_TYPE_ID: () => trim(process.env.APPLE_PASS_TYPE_ID),
  APPLE_TEAM_ID: () => trim(process.env.APPLE_TEAM_ID),
  APPLE_PASS_CERT_P12_BASE64: () => trim(process.env.APPLE_PASS_CERT_P12_BASE64),
  APPLE_PASS_CERT_PASSWORD: () => trim(process.env.APPLE_PASS_CERT_PASSWORD),
  GOOGLE_WALLET_ISSUER_ID: () => trim(process.env.GOOGLE_WALLET_ISSUER_ID),
  GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: () => trim(process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON),
};
const env = (name) => READERS[name]();

export const APPLE_ENV = Object.freeze([
  "APPLE_PASS_TYPE_ID",
  "APPLE_TEAM_ID",
  "APPLE_PASS_CERT_P12_BASE64",
  "APPLE_PASS_CERT_PASSWORD",
]);
export const GOOGLE_ENV = Object.freeze(["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON"]);

export function appleWalletMissing() {
  return APPLE_ENV.filter((name) => !env(name));
}
export function appleWalletConfigured() {
  return appleWalletMissing().length === 0;
}
export function googleWalletMissing() {
  return GOOGLE_ENV.filter((name) => !env(name));
}
export function googleWalletConfigured() {
  return googleWalletMissing().length === 0;
}

let appleCache = null;
let appleCacheKey = null;

/**
 * The parsed Apple signing identity: { passTypeId, teamId, cert, key, wwdr }
 * with `cert`/`key`/`wwdr` as node-forge objects. Null when unconfigured.
 * Throws when the bundle is present but unusable — wrong password, exported
 * without its key — because that is a deployment mistake the owner needs to
 * see, not a "not set up yet" the screen would otherwise print.
 */
export function loadAppleSigner() {
  if (!appleWalletConfigured()) return null;
  const b64 = env("APPLE_PASS_CERT_P12_BASE64");
  const password = env("APPLE_PASS_CERT_PASSWORD");
  const cacheKey = `${b64.length}:${b64.slice(0, 24)}:${password.length}`;
  if (appleCache && appleCacheKey === cacheKey) return appleCache;

  const der = forge.util.decode64(b64);
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(der));
  const bundle = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const certBags = bundle.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags =
    bundle.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const cert = certBags.find((b) => b.cert)?.cert;
  const key = keyBags.find((b) => b.key)?.key;
  if (!cert || !key) {
    throw new Error(
      "APPLE_PASS_CERT_P12_BASE64 parsed but holds no certificate/key pair — the .p12 was exported without its private key.",
    );
  }

  appleCache = {
    passTypeId: env("APPLE_PASS_TYPE_ID"),
    teamId: env("APPLE_TEAM_ID"),
    cert,
    key,
    wwdr: forge.pki.certificateFromPem(WWDR_G4_PEM),
  };
  appleCacheKey = cacheKey;
  return appleCache;
}

let googleCache = null;

/** { issuerId, clientEmail, privateKey } or null. Throws on a malformed key file. */
export function loadGoogleWalletIssuer() {
  if (!googleWalletConfigured()) return null;
  if (googleCache) return googleCache;
  const raw = env("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON parsed but has no client_email/private_key.");
  }
  googleCache = {
    issuerId: env("GOOGLE_WALLET_ISSUER_ID"),
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
  return googleCache;
}

/** For the check: forget the parsed identities so a new env is read. */
export function resetWalletCachesForChecks() {
  appleCache = null;
  appleCacheKey = null;
  googleCache = null;
}
