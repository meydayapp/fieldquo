// lib/mailbox/config.js
//
// Which of the three connection routes this deployment can offer, and — for
// each one it cannot — exactly which variable is missing, so the settings
// card says "Not set up yet" with the reason instead of drawing a button
// that leads to an error page. Every route asks again before doing anything:
// a hidden button is not access control.

import { mailCryptoConfigured, MAIL_KEY_VAR } from "./crypto";
import { googleMailConfigured } from "./providers/google";
import { microsoftMailConfigured, microsoftMissing } from "./providers/microsoft";

export function providerAvailability() {
  const key = mailCryptoConfigured();
  const keyMissing = key ? [] : [MAIL_KEY_VAR];
  const googleMissing = [
    ...(googleMailConfigured() ? [] : ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"]),
    ...keyMissing,
  ];
  const msMissing = [...microsoftMissing(), ...keyMissing];
  return {
    keyConfigured: key,
    google: { available: googleMissing.length === 0, missing: googleMissing },
    microsoft: { available: msMissing.length === 0, missing: msMissing },
    imap: { available: key, missing: keyMissing },
  };
}

export function providerAvailable(provider) {
  if (provider === "google") return googleMailConfigured() && mailCryptoConfigured();
  if (provider === "microsoft") return microsoftMailConfigured() && mailCryptoConfigured();
  if (provider === "imap") return mailCryptoConfigured();
  return false;
}
