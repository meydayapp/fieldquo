// app/components/links/linkIcons.js
//
// The glyphs on the bio-link page — one module, shared by the public page
// (app/l/[slug]) and the settings screen that previews it. They used to carry
// two identical ICONS maps; the copy nobody looks at is the one that rots, so
// there is one now.
//
// ── Brand glyphs are inline SVG on purpose ──────────────────────────────────
//
// lucide removed its brand icons (Instagram, Facebook, YouTube, LinkedIn) some
// versions ago and never had TikTok or X, so the six below are drawn here:
// stroked outlines in lucide's own 24-grid, 2px, round caps — so they sit next
// to a lucide `Phone` without looking borrowed — and filled paths for the two
// marks (TikTok, X) that have no outline form. No image URLs and no icon
// font: the public page is server-rendered for a stranger with JavaScript
// possibly off, and an inline path is the only kind of icon that survives
// that.
//
// Pure module: no hooks, no "use client", so a server component can import
// it and so can the client-side settings page.

import {
  Zap,
  FileText,
  CalendarDays,
  Megaphone,
  Globe,
  Phone,
  MessageCircle,
  Mail,
  Star,
  Link2,
  Link,
  Image,
  Images,
  Camera,
  Video,
  MapPin,
  Map,
  House,
  Truck,
  Wrench,
  Hammer,
  Paintbrush,
  Brush,
  Ruler,
  Droplet,
  Leaf,
  Gift,
  Percent,
  Tag,
  DollarSign,
  CreditCard,
  Clock,
  Award,
  Shield,
  Heart,
  ThumbsUp,
  Users,
  Briefcase,
  ClipboardList,
  Sparkles,
  Music,
} from "lucide-react";

const ROW_ICONS = {
  instant: Zap,
  quote: FileText,
  book: CalendarDays,
  site: Globe,
  phone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  review: Star,
};

// Keyed by the kebab-case names in lib/links/icons.js. scripts/check-bio-link.mjs
// asserts the two lists agree, so a name added there without a component
// here fails the check rather than rendering nothing.
export const CUSTOM_ICONS = {
  link: Link,
  image: Image,
  images: Images,
  camera: Camera,
  video: Video,
  "map-pin": MapPin,
  map: Map,
  house: House,
  truck: Truck,
  wrench: Wrench,
  hammer: Hammer,
  paintbrush: Paintbrush,
  brush: Brush,
  ruler: Ruler,
  droplet: Droplet,
  leaf: Leaf,
  gift: Gift,
  percent: Percent,
  tag: Tag,
  "dollar-sign": DollarSign,
  "credit-card": CreditCard,
  clock: Clock,
  award: Award,
  shield: Shield,
  heart: Heart,
  "thumbs-up": ThumbsUp,
  star: Star,
  users: Users,
  briefcase: Briefcase,
  "clipboard-list": ClipboardList,
  sparkles: Sparkles,
  music: Music,
  "file-text": FileText,
  globe: Globe,
  phone: Phone,
  mail: Mail,
  "message-circle": MessageCircle,
  "calendar-days": CalendarDays,
};

/** The lucide component for a labelled row: `{ key, icon? }`. */
export function iconForLink(link) {
  const key = String(link?.key || "");
  if (key.startsWith("custom:")) return CUSTOM_ICONS[link.icon] || Link2;
  if (key.startsWith("funnel:")) return Megaphone;
  return ROW_ICONS[key] || Link2;
}

// Outlines on lucide's grid. Each is a fragment of path data drawn with
// stroke=currentColor, fill=none — the same attributes lucide emits.
const OUTLINE = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </>
  ),
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  youtube: (
    <>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
};

// Filled marks: these two logos are solid shapes with no outline form that
// reads at 20px.
const FILLED = {
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
};

/**
 * The "opens elsewhere" arrow at the right edge of every row — nxt-lnk's
 * NewUp, drawn on its own 20-grid. A filled path rather than lucide's
 * ArrowUpRight so the row reads exactly as the reference does: a small solid
 * arrow at 80% scale, not a stroked one at 100%.
 */
export function NewUpIcon({ size = 20, style, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path d="M5.83366 5C5.37343 5 5.00033 5.3731 5.00033 5.83333C5.00033 6.29357 5.37343 6.66667 5.83366 6.66667V5ZM14.167 5.83333H15.0003C15.0003 5.3731 14.6272 5 14.167 5V5.83333ZM13.3337 14.1667C13.3337 14.6269 13.7068 15 14.167 15C14.6272 15 15.0003 14.6269 15.0003 14.1667H13.3337ZM4.41108 14.4108C4.08563 14.7362 4.08563 15.2638 4.41108 15.5893C4.73651 15.9147 5.26415 15.9147 5.58958 15.5893L4.41108 14.4108ZM5.83366 6.66667H14.167V5H5.83366V6.66667ZM13.3337 5.83333V14.1667H15.0003V5.83333H13.3337ZM13.5777 5.24408L4.41108 14.4108L5.58958 15.5893L14.7562 6.42258L13.5777 5.24408Z" />
    </svg>
  );
}

/**
 * A brand glyph, sized and coloured like a lucide icon.
 *
 * @param platform  one of lib/links/social.js's SOCIAL_PLATFORMS
 * @param size      px
 * @param style     the colour goes in here as `color`, exactly as it does for
 *                  the lucide icons on the page — measured in lib/links/theme.js
 */
export function SocialGlyph({ platform, size = 20, style, className }) {
  if (FILLED[platform]) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        style={style}
        className={className}
      >
        <path d={FILLED[platform]} />
      </svg>
    );
  }
  const body = OUTLINE[platform];
  if (!body) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      {body}
    </svg>
  );
}
