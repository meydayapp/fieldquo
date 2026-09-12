// app/components/help-centre/CategoryIcon.js
//
// The icon a category names in lib/help/tree.js, resolved from an explicit
// map rather than lucide's whole namespace so the bundle carries sixteen
// icons, not a thousand.
import {
  Calendar, CreditCard, Eye, FileText, Gauge, Megaphone, MessageCircle, PlayCircle,
  Plug, Receipt, Rocket, Settings, Smartphone, Sparkles, UserCog, Users, BookOpen,
} from "lucide-react";

const ICONS = { Calendar, CreditCard, Eye, FileText, Gauge, Megaphone, MessageCircle, PlayCircle, Plug, Receipt, Rocket, Settings, Smartphone, Sparkles, UserCog, Users };

export default function CategoryIcon({ name, size = 18 }) {
  const Icon = ICONS[name] || BookOpen;
  return <Icon size={size} aria-hidden="true" />;
}
