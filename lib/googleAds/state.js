// lib/googleAds/state.js
//
// The OAuth state for the Google Ads connect flow: the SAME signed nonce
// lib/calendar/googleState.js mints (same secret, same tamper checks — its
// check covers every mutation), under its own cookie name so a calendar, a
// Business Profile and a Google Ads connect started in one browser cannot
// answer each other's callback. The member id in the state is who STARTED
// the flow; the callback refuses a session that changed in between.
export { signState, verifyState, stateCookieOptions } from "@/lib/calendar/googleState";

export const GOOGLE_ADS_STATE_COOKIE = "google_ads_oauth_state";
