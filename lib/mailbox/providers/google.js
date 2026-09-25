// lib/mailbox/providers/google.js
//
// Gmail and Google Workspace, over the Gmail REST API with plain fetch — the
// same no-SDK choice lib/calendar/googleClient.js made (0 bytes added), and
// through the SAME OAuth client: one Cloud project, one client id, a second
// redirect URI and a second set of scopes.
//
// ══ gmail.readonly is a RESTRICTED scope — said plainly ═══════════════════
//
// Google classes gmail.readonly (and gmail.send) as restricted. Until the
// app passes Google's verification AND the annual third-party security
// assessment (CASA), the OAuth client works only for the accounts listed as
// test users on the consent screen — 100 at most — and each sees Google's
// "unverified app" warning. That is written on the settings card, on
// /platform, and in docs/GMAIL-MAILBOX.md; nothing here pretends otherwise.
//
// ══ Two phases ════════════════════════════════════════════════════════════
//
//   backfill   messages.list with q="after:<backfill date>", page by page
//              (backfillPageToken), until the list is exhausted.
//   live       users.history.list from the historyId captured AT CONNECT —
//              so nothing that arrives during a long backfill is missed —
//              historyTypes=messageAdded. A historyId Google no longer keeps
//              (404, typically after a week idle) restarts a bounded backfill
//              from the last sync; the Message-ID index absorbs the overlap.
//
// Every listed id is read with format=metadata (headers only) and only a
// match is read again with format=raw — see lib/mailbox/parse.js.

import {
  googleOAuthClientId,
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  decodeIdTokenEmail,
} from "@/lib/calendar/googleClient";

export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_SCOPES = Object.freeze([GMAIL_READ_SCOPE, "openid", "email"]);
export const GMAIL_SEND_SCOPES = Object.freeze([GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, "openid", "email"]);

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const PAGE_SIZE = 40;
const HEADERS = ["From", "To", "Cc", "Message-ID", "Subject", "Date", "In-Reply-To", "References"];
const SKIP_LABELS = new Set(["SPAM", "TRASH", "DRAFT", "CHAT"]);

export function googleMailConfigured() {
  return Boolean(googleOAuthClientId() && (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim());
}

export function gmailAuthorizeUrl({ redirectUri, state, withSend = false }) {
  return buildGoogleAuthorizeUrl({ redirectUri, state, scopes: withSend ? GMAIL_SEND_SCOPES : GMAIL_SCOPES });
}

export { exchangeGoogleCode, decodeIdTokenEmail };

export async function revokeGmail(refreshToken) {
  return revokeGoogleToken(refreshToken).catch(() => null);
}

async function gget(accessToken, path, params, fetchImpl = fetch) {
  const url = `${API}${path}${params ? `?${params}` : ""}`;
  let res;
  try {
    res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (err) {
    return { ok: false, status: 0, message: `network: ${err?.message || "unreachable"}` };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, message: data?.error?.message || `HTTP ${res.status}` };
  return { ok: true, data };
}

function headerMap(payload) {
  const out = {};
  for (const h of Array.isArray(payload?.headers) ? payload.headers : []) {
    const k = String(h?.name || "").toLowerCase();
    if (!(k in out)) out[k] = h?.value ?? "";
  }
  return out;
}

async function metadataItem(accessToken, id, fetchImpl) {
  const params = new URLSearchParams({ format: "metadata" });
  for (const h of HEADERS) params.append("metadataHeaders", h);
  const res = await gget(accessToken, `/messages/${encodeURIComponent(id)}`, params, fetchImpl);
  if (!res.ok) return res.status === 404 ? null : Promise.reject(Object.assign(new Error(res.message), { status: res.status }));
  const labels = new Set(res.data?.labelIds || []);
  if ([...labels].some((l) => SKIP_LABELS.has(l))) return null;
  const h = headerMap(res.data?.payload);
  return {
    ref: id,
    folder: labels.has("SENT") ? "SENT" : "INBOX",
    sentFolder: labels.has("SENT"),
    size: Number(res.data?.sizeEstimate || 0),
    headers: {
      from: h.from || "",
      to: h.to || "",
      cc: h.cc || "",
      messageId: h["message-id"] || null,
      inReplyTo: h["in-reply-to"] || null,
      references: h.references || null,
      subject: h.subject || "",
      date: res.data?.internalDate ? new Date(Number(res.data.internalDate)) : h.date || null,
    },
  };
}

function toBuffer(b64url) {
  return Buffer.from(String(b64url || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * @param refreshToken  plaintext, this session only
 * @param deps          { fetchImpl, refresh } — the check passes fakes
 */
export function googleAdapter(refreshToken, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const refresh = deps.refresh || refreshGoogleAccessToken;
  return {
    provider: "google",
    async session(fn) {
      const token = await refresh(refreshToken);
      if (!token.ok) throw Object.assign(new Error(token.message || "Google refused the refresh token"), { status: token.status, authenticationFailed: token.status === 400 || token.status === 401 });
      const accessToken = token.accessToken;
      return fn({
        async start() {
          const res = await gget(accessToken, "/profile", null, fetchImpl);
          if (!res.ok) throw Object.assign(new Error(res.message), { status: res.status });
          return { emailAddress: res.data?.emailAddress || null, historyId: res.data?.historyId ? String(res.data.historyId) : null };
        },
        async nextPage(cursor = {}, { since }) {
          const next = { ...cursor };
          if (!next.historyId) {
            const profile = await this.start();
            next.historyId = profile.historyId;
          }
          // ── backfill ──
          if (!next.backfillDone) {
            const after = Math.floor(new Date(next.backfillSince || since).getTime() / 1000);
            const params = new URLSearchParams({ q: `after:${after} -in:chats`, maxResults: String(PAGE_SIZE), includeSpamTrash: "false" });
            if (next.backfillPageToken) params.set("pageToken", next.backfillPageToken);
            const res = await gget(accessToken, "/messages", params, fetchImpl);
            if (!res.ok) throw Object.assign(new Error(res.message), { status: res.status });
            const ids = (res.data?.messages || []).map((m) => m.id);
            const items = (await Promise.all(ids.map((id) => metadataItem(accessToken, id, fetchImpl)))).filter(Boolean);
            next.backfillPageToken = res.data?.nextPageToken || null;
            if (!next.backfillPageToken) {
              next.backfillDone = true;
              delete next.backfillSince;
            }
            return { items, cursor: next, more: true };
          }
          // ── live ──
          const params = new URLSearchParams({ startHistoryId: next.historyId, historyTypes: "messageAdded", maxResults: "100" });
          if (next.historyPageToken) params.set("pageToken", next.historyPageToken);
          const res = await gget(accessToken, "/history", params, fetchImpl);
          if (!res.ok && res.status === 404) {
            // History expired: a bounded re-read from the last good sync.
            const profile = await this.start();
            return {
              items: [],
              cursor: { historyId: profile.historyId, backfillDone: false, backfillPageToken: null, backfillSince: deps.lastSyncAt || since },
              more: true,
            };
          }
          if (!res.ok) throw Object.assign(new Error(res.message), { status: res.status });
          const ids = [];
          for (const h of res.data?.history || []) {
            for (const added of h.messagesAdded || []) {
              const m = added.message || {};
              if ((m.labelIds || []).some((l) => SKIP_LABELS.has(l))) continue;
              if (m.id && !ids.includes(m.id)) ids.push(m.id);
            }
          }
          const items = (await Promise.all(ids.map((id) => metadataItem(accessToken, id, fetchImpl)))).filter(Boolean);
          if (res.data?.nextPageToken) {
            next.historyPageToken = res.data.nextPageToken;
            return { items, cursor: next, more: true };
          }
          next.historyPageToken = null;
          if (res.data?.historyId) next.historyId = String(res.data.historyId);
          return { items, cursor: next, more: false };
        },
        async fetchRaw(item) {
          const res = await gget(accessToken, `/messages/${encodeURIComponent(item.ref)}`, new URLSearchParams({ format: "raw" }), fetchImpl);
          if (!res.ok) return null;
          return toBuffer(res.data?.raw);
        },
      });
    },
  };
}

/** Send composed RFC 5322 bytes as the signed-in user; Gmail files it in Sent. */
export async function gmailSendRaw(refreshToken, raw, { threadId = null, fetchImpl = fetch, refresh = refreshGoogleAccessToken } = {}) {
  const token = await refresh(refreshToken);
  if (!token.ok) return { ok: false, code: "auth_failed", error: token.message || "Google refused the refresh token" };
  let res;
  try {
    res = await fetchImpl(`${API}/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), ...(threadId ? { threadId } : {}) }),
    });
  } catch (err) {
    return { ok: false, code: "network", error: err?.message || "unreachable" };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = res.status === 429 ? "rate_limited" : res.status === 401 || res.status === 403 ? "auth_failed" : "rejected";
    return { ok: false, code, error: data?.error?.message || `HTTP ${res.status}` };
  }
  return { ok: true, id: data?.id || null };
}
