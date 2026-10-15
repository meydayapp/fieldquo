// app/llms.txt/route.js
//
// /llms.txt on FieldQuo's own host (lib/seo/llmsTxt.js). Static assets and
// extension paths skip middleware.js, so this route is reached on every host
// — and on anything but FieldQuo's own it answers 404, because a contractor's
// website must not describe itself as FieldQuo to anybody, human or model.
import { llmsTxt } from "@/lib/seo/llmsTxt";
import { robotsSiteFor } from "@/lib/seo/robots";
import { siteOrigin } from "@/lib/marketing/metadata";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const site = robotsSiteFor(request.headers.get("host"));
  if (site !== "fieldquo" && site !== "preview") {
    return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(llmsTxt(siteOrigin()), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600",
      vary: "host",
    },
  });
}
