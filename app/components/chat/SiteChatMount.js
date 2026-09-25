// app/components/chat/SiteChatMount.js
//
// Server component: decides whether a company's public site gets the chat
// button at all, and hands the client widget everything it needs — the
// employee's face and name, the brand fill at a measured contrast, and the
// words in the visitor's language. Renders NOTHING when no employee answers
// the web channel: an off switch is a button that is not there, never one
// that opens on "nobody is here".

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { webChatConfig } from "@/lib/aiEmployee/webChat";
import { webChatCopy } from "@/lib/aiEmployee/webChatCopy";
import SiteChatWidget, { ChatDisabledSignal } from "./SiteChatWidget";

/**
 * @param hosted  true only on /embed/<slug>/chat?host=loader — the chat.js
 *                loader owns the iframe and sizes it from the widget's
 *                messages (lib/embed/chatLoader.js).
 * @param side    "right" | "left", the corner the loader was told to use.
 */
export default async function SiteChatMount({ companySlug, language = "en", startOpen = false, hosted = false, side = "right" }) {
  if (!companySlug) return null;
  const config = await webChatConfig(companySlug).catch(() => null);
  // Off is a button that is not there. Under the loader, "not there" has to
  // be SAID: the loader cannot see into the frame, and a frame that stays
  // silent stays mounted (hidden) for the life of the page. The signal
  // renders nothing and tells the loader to remove the iframe.
  if (!config?.enabled) return hosted ? <ChatDisabledSignal /> : null;

  const theme = documentTheme({ brandColor: config.company.brandColor });
  const fill = fillPair(theme);

  return (
    <SiteChatWidget
      companySlug={companySlug}
      language={language}
      company={{ name: config.company.name, logoUrl: config.company.logoUrl }}
      employee={config.employee}
      fill={fill}
      copy={webChatCopy(language, config.company.name)}
      startOpen={startOpen}
      hosted={hosted}
      side={side === "left" ? "left" : "right"}
    />
  );
}
