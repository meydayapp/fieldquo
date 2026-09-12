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
// Dynamic on purpose (it reads a request header); every page beneath it is
// static.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pickHelpLang } from "@/lib/help/lang";
import { helpPath } from "@/lib/help/urls";

export const dynamic = "force-dynamic";

export default async function HelpRoot() {
  const h = await headers();
  redirect(helpPath(pickHelpLang(h.get("accept-language"))));
}
