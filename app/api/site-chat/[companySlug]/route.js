// app/api/site-chat/[companySlug]/route.js
//
// The site chat widget's one endpoint. Public: the visitor has no account.
//
//   GET  ?token=…   the widget's config (is chat on, who fronts it) and,
//                   with a token, the transcript so far — the poll.
//   POST { token?, text, language? }
//                   one message from the visitor. Stored through the same
//                   ingest a Messenger message uses (lib/aiEmployee/webChat.js),
//                   answered by the employee if one is on and the mode lets
//                   it, and the transcript comes back with a STATE the widget
//                   prints a sentence for.
//
// Nothing here returns a price, a phone or an email (non-negotiable #4), and
// the browser sends words only — never an amount, never a companyId. The
// company is the slug; the visitor is the token.
//
// Rate limited per IP here and per visitor token inside postWebChat, because
// every POST that reaches an enabled employee is a model call on the
// company's allowance.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { webChatConfig, readWebChat, postWebChat, MAX_VISITOR_TEXT } from "@/lib/aiEmployee/webChat";

export async function GET(request, { params }) {
  const { companySlug } = await params;
  const token = new URL(request.url).searchParams.get("token") || null;

  const config = await webChatConfig(companySlug);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const read = token ? await readWebChat({ companySlug, visitorToken: token }) : { ok: true, messages: [], threadId: null };
  return NextResponse.json(
    { ...config, threadId: read.threadId || null, messages: read.messages || [] },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request, { params }) {
  const { companySlug } = await params;

  const limited = rateLimit(request, "site-chat", {
    limit: 40,
    windowMs: 10 * 60 * 1000,
    message: "Too many messages from this connection. Give it a few minutes.",
  });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Type a message first." }, { status: 400 });
  if (text.length > MAX_VISITOR_TEXT) {
    return NextResponse.json({ error: `Messages can be up to ${MAX_VISITOR_TEXT} characters.` }, { status: 400 });
  }

  const result = await postWebChat({
    companySlug,
    visitorToken: typeof body.token === "string" ? body.token : null,
    text,
    language: typeof body.language === "string" ? body.language : null,
  });

  if (!result.ok) {
    const status =
      result.reason === "unknown_company" ? 404 : result.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json({ error: result.reason, token: result.visitorToken || null }, { status });
  }

  return NextResponse.json(
    { token: result.visitorToken, threadId: result.threadId, state: result.state, messages: result.messages },
    { headers: { "cache-control": "no-store" } },
  );
}
