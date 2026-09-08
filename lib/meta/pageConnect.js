// lib/meta/pageConnect.js
//
// The two Graph reads that finish a Page connection, shared by the two routes
// that can finish one: app/api/settings/social/callback (a single Page, no
// chooser) and app/api/settings/social/finalize (the contractor picked one).
//
// They live here rather than being written twice because a Next.js route file
// may only export HTTP handlers — and because the copy is the one that rots
// (AGENTS.md failure class 4). Both are best-effort by contract, and both say
// below what "best effort" costs when it fails.
import { getPageInstagramAccount, listGrantedPermissions, grantedScopeString } from "./client";

/**
 * The Instagram professional account linked to a Page, or two nulls.
 *
 * Failing here is NOT failing the connect: a Page whose Instagram lookup
 * errors still publishes to Facebook, and refusing the whole connection over
 * it would trade a working half for nothing. The contractor sees "no Instagram
 * account linked to this Page" either way — the same honest end state, reached
 * two ways, and reconnecting re-runs this read.
 *
 * Runs with the PAGE token, so a success here also proves the token about to
 * be stored can see the account about to be recorded beside it.
 */
export async function resolveInstagram({ pageToken, pageId }) {
  const res = await getPageInstagramAccount({ accessToken: pageToken, pageId }).catch(() => null);
  const ig = res?.ok ? res.data?.instagram_business_account : null;
  return { id: ig?.id || null, username: ig?.username || null };
}

/**
 * What Meta GRANTED, or null.
 *
 * Null when the read fails — never the list FieldQuo asked for. The whole
 * value of MetaPageConnection.scopes is that it records Meta's answer;
 * substituting our own question for it would let the settings panel
 * confidently report a permission the contractor un-ticked on the consent
 * screen, which is the failure this column exists to catch.
 */
export async function resolveGrantedScopes(userToken) {
  const res = await listGrantedPermissions({ accessToken: userToken }).catch(() => null);
  return res?.ok ? grantedScopeString(res.data) : null;
}
