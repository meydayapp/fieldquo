// app/welcome/page.js
//
// A bare /welcome: to the first screen, where app/welcome/[step]/page.js
// moves them on to the first UNANSWERED one (or to /app when there is none).
import { redirect } from "next/navigation";
import { welcomePath } from "@/lib/signup/welcome";

export const dynamic = "force-dynamic";

export default function WelcomeIndex() {
  redirect(welcomePath("profile"));
}
