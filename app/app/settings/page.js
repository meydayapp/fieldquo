// app/app/settings/page.js
import { redirect } from "next/navigation";

// The settings index has no content of its own — land on Company Settings,
// same as clicking the first item in the secondary sidebar.
export default function SettingsIndexPage() {
  redirect("/app/settings/company");
}
