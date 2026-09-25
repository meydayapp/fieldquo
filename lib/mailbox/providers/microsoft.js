// lib/mailbox/providers/microsoft.js
//
// Microsoft 365 / Outlook.com (and GoDaddy's Microsoft-hosted email), over
// the Microsoft identity platform (v2.0 endpoint, tenant "common" by default
// so work AND personal accounts can sign in) and Microsoft Graph, plain fetch.
//
// ══ Scopes ════════════════════════════════════════════════════════════════
//
//   Mail.Read        delegated — read the signed-in user's mail. Admin
//                    consent is NOT required for it; a tenant that has
//                    switched off user consent will show the person an
//                    "approval required" screen, which the card explains.
//   offline_access   the refresh token.
//   User.Read openid email   who connected ("Connected as …").
//   Mail.Send        asked for only when sending is switched on.
//
// ══ Delta queries ═════════════════════════════════════════════════════════
//
// Per folder (inbox, sentitems): the first call filters by
// receivedDateTime ≥ the backfill date; Graph pages it with @odata.nextLink
// and finishes with an @odata.deltaLink. The cursor stores whichever link is
// next — a nextLink mid-backfill, the deltaLink once caught up — and the
// sync saves it only after the page's messages are filed. Graph refresh
// tokens ROTATE: every refresh may return a new one, which the sync re-seals
// onto the row (onRotate) so the next tick is not holding a dead token.

export const MS_READ_SCOPES = Object.freeze(["offline_access", "User.Read", "Mail.Read", "openid", "email"]);
export const MS_SEND_SCOPES = Object.freeze([...MS_READ_SCOPES, "Mail.Send"]);
const GRAPH = "https://graph.microsoft.com/v1.0";
export const PAGE_SIZE = 40;
const SELECT = "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isDraft";

export function msClientId() {
  return (process.env.MICROSOFT_OAUTH_CLIENT_ID || "").trim() || null;
}
function msClientSecret() {
  return (process.env.MICROSOFT_OAUTH_CLIENT_SECRET || "").trim() || null;
}
/** "common" unless the owner pins a tenant (single-tenant app registration). */
export function msTenant() {
  return (process.env.MICROSOFT_OAUTH_TENANT || "").trim() || "common";
}
export function microsoftMailConfigured() {
  return Boolean(msClientId() && msClientSecret());
}
export function microsoftMissing() {
  const out = [];
  if (!msClientId()) out.push("MICROSOFT_OAUTH_CLIENT_ID");
  if (!msClientSecret()) out.push("MICROSOFT_OAUTH_CLIENT_SECRET");
  return out;
}
/** The state signing key: the client secret, as Google's flow uses its own. */
export function msStateSecret() {
  return msClientSecret();
}

function authBase() {
  return `https://login.microsoftonline.com/${encodeURIComponent(msTenant())}/oauth2/v2.0`;
}

export function microsoftAuthorizeUrl({ redirectUri, state, withSend = false, loginHint = null }) {
  const params = new URLSearchParams({
    client_id: msClientId() || "",
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: (withSend ? MS_SEND_SCOPES : MS_READ_SCOPES).join(" "),
    state,
    prompt: "select_account",
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `${authBase()}/authorize?${params}`;
}

async function tokenCall(body, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(`${authBase()}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: msClientId() || "", client_secret: msClientSecret() || "", ...body }).toString(),
    });
  } catch (err) {
    return { ok: false, status: 0, message: `network: ${err?.message || "unreachable"}` };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, message: data?.error_description?.split("\r\n")[0] || data?.error || `HTTP ${res.status}` };
  return { ok: true, data };
}

export async function exchangeMicrosoftCode({ code, redirectUri, withSend = false }, fetchImpl) {
  return tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri, scope: (withSend ? MS_SEND_SCOPES : MS_READ_SCOPES).join(" ") }, fetchImpl);
}

/** → { ok, accessToken, refreshToken (possibly rotated), scope } */
export async function refreshMicrosoftToken(refreshToken, fetchImpl) {
  const res = await tokenCall({ grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
  if (!res.ok) return res;
  return { ok: true, accessToken: res.data?.access_token, refreshToken: res.data?.refresh_token || null, scope: res.data?.scope || "" };
}

async function graph(accessToken, url, init = {}, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(url.startsWith("http") ? url : `${GRAPH}${url}`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: `odata.maxpagesize=${PAGE_SIZE}`, ...(init.headers || {}) },
    });
  } catch (err) {
    return { ok: false, status: 0, message: `network: ${err?.message || "unreachable"}` };
  }
  if (init.raw && res.ok) return { ok: true, buffer: Buffer.from(await res.arrayBuffer()) };
  const data = res.status === 202 || res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, message: data?.error?.message || `HTTP ${res.status}` };
  return { ok: true, data };
}

/** The signed-in address — mail, else userPrincipalName. */
export async function microsoftMe(accessToken, fetchImpl) {
  const res = await graph(accessToken, "/me?$select=mail,userPrincipalName", {}, fetchImpl);
  if (!res.ok) return null;
  return String(res.data?.mail || res.data?.userPrincipalName || "").toLowerCase() || null;
}

/** Only Graph's own host may be followed from a stored link. */
export function isGraphLink(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "graph.microsoft.com" && !u.username && !u.password;
  } catch {
    return false;
  }
}

function firstLink(folder, since) {
  const params = new URLSearchParams({ $select: SELECT });
  if (since) params.set("$filter", `receivedDateTime ge ${new Date(since).toISOString()}`);
  return `${GRAPH}/me/mailFolders/${folder}/messages/delta?${params}`;
}

export function microsoftAdapter(refreshToken, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  return {
    provider: "microsoft",
    async session(fn) {
      const token = await refreshMicrosoftToken(refreshToken, fetchImpl);
      if (!token.ok) throw Object.assign(new Error(token.message || "Microsoft refused the refresh token"), { status: token.status, authenticationFailed: token.status === 400 || token.status === 401 });
      if (token.refreshToken && token.refreshToken !== refreshToken && deps.onRotate) await deps.onRotate(token.refreshToken);
      const accessToken = token.accessToken;
      // Folders that reached their deltaLink during THIS tick — kept here,
      // not in the stored cursor, so a tick that ends early leaves nothing
      // behind that would make the next one skip a folder.
      const caughtUp = new Set();
      return fn({
        async nextPage(cursor = {}, { since }) {
          const next = { ...cursor };
          for (const [key, folder, sentFolder] of [["inbox", "inbox", false], ["sent", "sentitems", true]]) {
            if (caughtUp.has(key)) continue;
            const state = next[key] || {};
            const link = state.link && isGraphLink(state.link) ? state.link : firstLink(folder, since);
            const res = await graph(accessToken, link, {}, fetchImpl);
            if (!res.ok && (res.status === 410 || res.status === 404) && state.link) {
              // A delta token Graph no longer honours: start the folder again.
              next[key] = { link: null };
              return { items: [], cursor: next, more: true };
            }
            if (!res.ok) throw Object.assign(new Error(res.message), { status: res.status });
            const items = (res.data?.value || [])
              .filter((m) => m && !m["@removed"] && !m.isDraft && m.id)
              .map((m) => ({
                ref: m.id,
                folder: key === "sent" ? "SENT" : "INBOX",
                sentFolder,
                size: 0,
                headers: {
                  from: m.from ? [m.from] : [],
                  to: m.toRecipients || [],
                  cc: m.ccRecipients || [],
                  messageId: m.internetMessageId || null,
                  inReplyTo: null,
                  references: null,
                  subject: m.subject || "",
                  date: m.sentDateTime || m.receivedDateTime || null,
                },
              }));
            const nextLink = res.data?.["@odata.nextLink"];
            const deltaLink = res.data?.["@odata.deltaLink"];
            next[key] = { link: nextLink || deltaLink || null };
            if (!nextLink) caughtUp.add(key);
            if (items.length || nextLink) return { items, cursor: next, more: true };
          }
          return { items: [], cursor: next, more: false };
        },
        async fetchRaw(item) {
          const res = await graph(accessToken, `/me/messages/${encodeURIComponent(item.ref)}/$value`, { raw: true }, fetchImpl);
          return res.ok ? res.buffer : null;
        },
      });
    },
  };
}

/** Send raw MIME as the signed-in user; Graph saves it to Sent Items. */
export async function microsoftSendRaw(refreshToken, raw, { fetchImpl = fetch, onRotate } = {}) {
  const token = await refreshMicrosoftToken(refreshToken, fetchImpl);
  if (!token.ok) return { ok: false, code: "auth_failed", error: token.message };
  if (token.refreshToken && token.refreshToken !== refreshToken && onRotate) await onRotate(token.refreshToken);
  const res = await graph(
    token.accessToken,
    "/me/sendMail",
    { method: "POST", headers: { "Content-Type": "text/plain" }, body: Buffer.from(raw).toString("base64") },
    fetchImpl,
  );
  if (!res.ok) {
    const code = res.status === 429 ? "rate_limited" : res.status === 401 || res.status === 403 ? "auth_failed" : "rejected";
    return { ok: false, code, error: res.message };
  }
  return { ok: true };
}
