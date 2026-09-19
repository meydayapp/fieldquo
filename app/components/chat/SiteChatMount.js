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
import SiteChatWidget from "./SiteChatWidget";

export default async function SiteChatMount({ companySlug, language = "en", startOpen = false }) {
  if (!companySlug) return null;
  const config = await webChatConfig(companySlug).catch(() => null);
  if (!config?.enabled) return null;

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
    />
  );
}
