// app/components/HelpButton.js
"use client";
import { HelpCircle } from "lucide-react";

export default function HelpButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-inverted text-inverted-foreground flex items-center justify-center shadow-lg"
      aria-label="Help"
    >
      <HelpCircle size={20} />
    </button>
  );
}
