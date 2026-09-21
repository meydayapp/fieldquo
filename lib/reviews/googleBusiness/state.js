// lib/reviews/googleBusiness/state.js
//
// The OAuth state for the Business Profile connect flow: the SAME signed
// nonce lib/calendar/googleState.js mints (same secret, same tamper checks —
// the check script there already covers every mutation), under its own
// cookie name so a calendar connect and a business connect started in the
// same browser cannot answer each other's callback. The member id in the
// state is who STARTED the flow; the callback refuses a session that
// changed in between.
export { signState, verifyState, stateCookieOptions } from "@/lib/calendar/googleState";

export const GOOGLE_BUSINESS_STATE_COOKIE = "google_business_oauth_state";
