// app/help/page.js
//
// /help has no language, so it sends the browser to the one it asked for —
// among the three the articles are WRITTEN in (en, fr, es), English when
// Accept-Language names none of them. The six other chrome languages are one
// click away in the picker; they are not auto-selected because landing a
// Ukrainian reader on a page whose body is English with a notice is a worse
// first impression than landing them on the English page and letting them
// choose.
//
// On help.fieldquo.com the target is the SHORT form (/en) — the canonical
// spelling on that host — so the first request lands in one hop rather than
// bouncing through the /help → /en redirect in middleware.js.
//
// Dynamic on purpose (it reads request headers); every page beneath it is
// static.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pickHelpLang } from "@/lib/help/lang";
import { isHelpHost } from "@/lib/help/host";
import { helpPath, shortHelpPath } from "@/lib/help/urls";

export const dynamic = "force-dynamic";

export default async function HelpRoot() {
  const h = await headers();
  const lang = pickHelpLang(h.get("accept-language"));
  redirect(isHelpHost(h.get("host")) ? shortHelpPath(lang) : helpPath(lang));
}
