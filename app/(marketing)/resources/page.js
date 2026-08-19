// app/(marketing)/resources/page.js
//
// Server half: metadata only. See ResourcesContent for the rendering and for
// why the FAQ section on this page was blank.
import { marketingMetadata } from "@/lib/marketing/metadata";
import ResourcesContent from "./ResourcesContent";

export const metadata = marketingMetadata({
  path: "/resources",
  title: "Resources & FAQ — FieldQuo",
  description:
    "Setup guides, answers to the questions contractors ask most, and a way to reach a real person. Getting paid online, permissions, contracts and more.",
});

export default function ResourcesPage() {
  return <ResourcesContent />;
}
