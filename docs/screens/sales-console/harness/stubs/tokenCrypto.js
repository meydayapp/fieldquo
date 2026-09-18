// @/lib/meta/tokenCrypto for the harnesses. The real module imports
// node:crypto (AES-256-GCM for intro-email links), which a browser bundle
// cannot carry; the shell reaches it through lib/sales/outreach/introLink's
// asksIntroEmail(), a pure table lookup that needs none of it. Everything
// here answers "not configured" and seals nothing.
export const tokenCryptoConfigured = () => false;
export const encryptToken = () => { throw new Error("harness: token crypto is not available"); };
export const decryptToken = () => { throw new Error("harness: token crypto is not available"); };
