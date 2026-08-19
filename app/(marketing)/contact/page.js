// app/(marketing)/contact/page.js
//
// Server half: metadata only. The form is in ContactForm.
import { marketingMetadata } from "@/lib/marketing/metadata";
import ContactForm from "./ContactForm";

export const metadata = marketingMetadata({
  path: "/contact",
  title: "Contact FieldQuo",
  description:
    "Have a question, or want a demo? Send us a message and talk to a real person.",
});

export default function ContactPage() {
  return <ContactForm />;
}
