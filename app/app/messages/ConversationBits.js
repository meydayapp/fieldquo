"use client";

// app/app/messages/ConversationBits.js
//
// The pieces of the inbox that are THIS screen's and not the chat kit's: the
// platform badge, everything a customer can attach and the control that
// attaches one, the private-note wash, the waiting badge, and the four
// judgement controls (outcome, status, assignee, template).
//
// ── What moved to app/components/chat, and why ────────────────────────────
//
// The frame, the room list, the thread rows, the day and unread dividers and
// the compose box are the shared kit — the same components /sales/messages
// and the team chat render, so the three screens feel the same because they
// ARE the same code. The initials avatar, the day label, the clock time, the
// left/right bubbles and the status-filter chips that used to live here were
// the kit's job drawn a second time, and the second copy is the one that
// rots. Nothing here draws a row; it draws what goes INSIDE one.
//
// ── Why the rest lives here and not in app/components/ ────────────────────
//
// scripts/check-mobile-surfaces.mjs walks `app/app` and `app/components/mobile`
// — it does NOT walk the rest of app/components. Its own header says so and
// calls it a real remaining gap. Putting a chat bubble, a 44px chip row and a
// composer button behind that gap would mean the one screen in this feature
// most likely to be read on a phone is the one part of it nothing measures.
// So they sit under app/app, where the mobile rules apply to them.

import { useState } from "react";
import {
  AlertTriangle, Clock, EyeOff, MessageSquare, StickyNote,
  Paperclip, Film, Mic, FileText, Loader2, X, MapPin, User, Phone, Mail,
  ExternalLink, UserPlus, Home, Smile,
} from "lucide-react";
// lucide ships NO brand marks — `Facebook` and `Instagram` do not exist in it
// and the build says so. The bio-link page already needed these two and drew
// them as inline SVG; one set of glyphs, not two that drift apart.
import { SocialGlyph } from "@/app/components/links/linkIcons";
import {
  THREAD_OUTCOMES,
  THREAD_STATUSES,
  outcomeLabelKey,
  statusLabelKey,
} from "@/lib/messaging/outcomes";
import { waitedLabel, isWaiting } from "@/lib/messaging/waiting";
import {
  attachmentTypeKey,
  attachmentLabelKey,
  formatBytes,
} from "@/lib/messaging/attachments";
// Pure string surgery on a Cloudinary URL — the poster frame a <video> shows
// before anybody presses play. From lib/media/cloudinaryUrl.js and NOT
// lib/cloudinary.js, whose top-level config() call would drag the Node SDK
// into this "use client" bundle; that file's own header records the trap.
import { videoPosterUrl } from "@/lib/media/cloudinaryUrl";
import { staticMapUrl, mapsLinkUrl, addressFromLocation } from "@/lib/messaging/locationLink";

/**
 * Which network this conversation came in on. An icon AND the word: two
 * companies' worth of support calls in this repo have started with somebody
 * unable to tell two grey glyphs apart.
 */
export function PlatformBadge({ platform, t }) {
  if (!platform) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <SocialGlyph platform={platform} size={12} />
      {t("app.messages.platform." + platform)}
    </span>
  );
}

/**
 * Everything a customer attached to one message.
 *
 * ══ Why this is one renderer for three platforms ═══════════════════════════
 *
 * Because a photo of a kitchen is a photo of a kitchen. One network hands the
 * webhook a media id with no bytes; the other two hand it a signed CDN link
 * that expires. Both are re-hosted to Cloudinary out of band
 * (lib/messaging/mediaFetch.js), and by the time anything reaches here the
 * only questions left are WHAT KIND it is and which of four STATES it is in —
 * never which network it came from. A renderer that asked would have three
 * paths and two of them untested.
 *
 * ══ Every kind is drawn, and none of them is a count ═══════════════════════
 *
 * This is the whole point of the file. A customer can send a photo, a clip, a
 * voice note, a PDF, a spreadsheet, a sticker, a contact card or a dropped pin
 * — and until 2026-09-08 six of those eight arrived as a bordered row reading
 * "Attachment". A voice note is how a homeowner describes a leak; a pin is
 * very often the job address. So:
 *
 *   image     the picture, tappable, full size in a new tab
 *   video     a player with a poster frame, native controls, tappable to full
 *   audio     a player, with the length once the browser knows it
 *   document  the REAL filename and a human size, opening in a new tab
 *   sticker   a small image — animated WebP just works
 *   contact   a card with the name and each number, ringable
 *   location  a map, the address, a link out, and the two things a contractor
 *             would do with it next
 *   other     NAMED. Never silence, never a count.
 *
 * ══ The four states, and why none of them is "nothing" ═════════════════════
 *
 *   ready        there is something to draw. For a file that means the bytes
 *                landed; for a pin or a card it means the payload parsed, and
 *                nothing was ever going to be fetched.
 *   pending      "still arriving". NOT an <img> with a null src, which renders
 *                as a broken-image glyph and reads as a photo we lost — and
 *                NOT silence, which reads as a message that had no photo.
 *   failed       the reason, in full, and a way to try again. A photo that
 *                silently vanished is the failure this repo cares most about,
 *                so the one thing this must never do is stop mentioning it.
 *   unavailable  nothing to fetch and nothing to draw: a "fallback", a pin
 *                whose coordinates did not parse. Named, with no Retry,
 *                because a retry for something that was never fetchable is a
 *                dead control.
 *
 * ══ Colour ═════════════════════════════════════════════════════════════════
 *
 * Everything here inherits `currentColor` from the row it sits in. Today
 * that row is the kit's (app/components/chat/Thread.js, in the app's own
 * foreground token); it used to be a bubble painted in a measured brand
 * pair, and the rule that let the same renderer serve both is that nothing
 * below introduces a colour — the borders are `border-current`, the icons
 * inherit, and the map thumbnail is a photograph. Keep it that way: a
 * `text-muted-foreground` dropped in here would be the one unmeasured pair
 * on whatever surface this is next drawn on.
 *
 * @param media  the two things a card can DO, and whether this member may do
 *               them: { canEditClients, client, onAddClient, onSaveAddress }.
 *               Absent or false means the card draws without the button, which
 *               is the rule for a control we cannot wire — never a button that
 *               403s.
 */
export function Attachments({ message, onRetry, media, t }) {
  const list = Array.isArray(message?.attachments) ? message.attachments : [];
  if (!list.length) return null;
  return (
    <span className="mt-2 block space-y-1.5">
      {list.map((attachment, i) => (
        <AttachmentItem
          key={`${message.id}:${attachment.index ?? i}`}
          messageId={message.id}
          attachment={attachment}
          onRetry={onRetry}
          media={media}
          t={t}
        />
      ))}
    </span>
  );
}

/**
 * Keep a thread pinned to its bottom when a late-loading attachment grows it.
 *
 * The kit's Thread pins to the bottom when ROWS arrive (app/components/chat/
 * Thread.js) — it has no way to know that a row got taller a second later
 * because a 640px photo finished downloading. Without this, opening a
 * conversation whose last message is a picture lands the reader a screen
 * above the newest row, which the harness screenshot showed. The rule is
 * the kit's own: only a reader who was at the bottom is moved; somebody
 * scrolled up to read is left alone. "Was at the bottom" is measured
 * against the height the element just gained, since the growth already
 * happened by the time `load` fires.
 */
function repinAfterGrowth(el) {
  const scroller = el?.closest?.("[data-chat-scroller]");
  if (!scroller) return;
  const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  if (gap <= (el.clientHeight || 0) + 48) scroller.scrollTo({ top: scroller.scrollHeight });
}

/** The glyph for a kind of file. An icon AND the word, for the same reason
 *  PlatformBadge draws both: two grey glyphs are not a distinction. */
function AttachmentIcon({ type, size = 14 }) {
  const Glyph =
    type === "video"
      ? Film
      : type === "audio"
        ? Mic
        : type === "document"
          ? FileText
          : type === "location"
            ? MapPin
            : type === "contact"
              ? User
              : type === "sticker"
                ? Smile
                : Paperclip;
  return <Glyph size={size} className="shrink-0" aria-hidden="true" />;
}

function AttachmentItem({ messageId, attachment, onRetry, media, t }) {
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState("");

  // The name for THIS entry, not merely for its type: a voice note and an
  // attached audio file differ here and nowhere else, and a document with no
  // filename says "PDF" rather than "Document". See attachmentLabelKey.
  const named = attachmentLabelKey(attachment);
  const typeLabel = t(named.key, named.params);
  // The filename when there is one, the kind when there is not. Never a
  // Cloudinary id: a row reading "kx91v2zt" tells a contractor nothing.
  const label = attachment.filename || typeLabel;

  // ── The two kinds that were never a file ────────────────────────────────
  //
  // Drawn before the state ladder, because their `ready` means something
  // different: the payload arrived with the webhook and there is nothing
  // outstanding. A pin or a card that did NOT parse falls through to the
  // named `unavailable` row at the bottom, which is the honest place for it.
  if (attachment.state === "ready" && attachment.type === "location") {
    return <LocationCard attachment={attachment} media={media} t={t} />;
  }
  if (attachment.state === "ready" && attachment.type === "contact") {
    return <ContactCard attachment={attachment} media={media} t={t} />;
  }

  if (attachment.state === "ready" && attachment.type === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        // A 44px minimum even though the thumbnail is far taller: the rule is
        // about the TARGET, and a one-line landscape crop on a narrow phone
        // can fall under it.
        className="block min-h-[44px] overflow-hidden rounded-lg"
        aria-label={t("app.messages.media.open", { name: label })}
      >
        {/* max-h rather than a fixed box: a portrait phone photo and a
            landscape one both have to fit a bubble that is at most 85% of a
            375px screen, and object-cover on a fixed height would crop the
            thing the homeowner was pointing at. */}
        <img
          src={attachment.url}
          alt={label}
          onLoad={(e) => repinAfterGrowth(e.currentTarget)}
          className="max-h-64 w-auto max-w-full rounded-lg"
        />
      </a>
    );
  }

  // ── A sticker is a small picture and must stay small ────────────────────
  //
  // Same bytes as an image, a different size on purpose: a sticker blown up to
  // the 256px an image gets would dominate a conversation the way it never
  // does in the app the customer sent it from. No border and no link either —
  // there is no "full size" worth opening for a 512px WebP.
  if (attachment.state === "ready" && attachment.type === "sticker") {
    return (
      <span className="block">
        <img src={attachment.url} alt={label} onLoad={(e) => repinAfterGrowth(e.currentTarget)} className="max-h-28 w-auto max-w-full" />
      </span>
    );
  }

  if (attachment.state === "ready" && attachment.type === "video") {
    return <VideoPlayer attachment={attachment} label={label} t={t} />;
  }

  if (attachment.state === "ready" && attachment.type === "audio") {
    return <AudioPlayer attachment={attachment} label={typeLabel} />;
  }

  if (attachment.state === "ready") {
    // A document, or anything else that landed as bytes. The filename the
    // customer's phone gave it, and a size, so a contractor on a driveway
    // connection knows whether to open the 40 MB one now or later.
    const size = formatBytes(attachment.bytes);
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-[44px] items-center gap-2 rounded-lg border border-current px-2.5 py-2 text-xs font-medium"
      >
        <AttachmentIcon type={attachment.type} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {/* Never "0 KB": formatBytes returns null for anything it has not
            actually measured, and no size at all beats a wrong one. */}
        {size && <span className="shrink-0 tabular-nums opacity-80">{size}</span>}
        <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
      </a>
    );
  }

  if (attachment.state === "pending") {
    return (
      // Said out loud, with a moving spinner, because the honest answer here
      // is "not yet" and the alternatives are both lies: a broken image says
      // it is gone, and silence says it never existed.
      <span className="flex items-center gap-2 rounded-lg border border-current px-2.5 py-2 text-xs">
        <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
        <span className="truncate">{t("app.messages.media.pending", { kind: typeLabel })}</span>
      </span>
    );
  }

  if (attachment.state === "failed") {
    return (
      <span className="block rounded-lg border border-current px-2.5 py-2 text-xs">
        <span className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{t("app.messages.media.failed", { kind: typeLabel })}</span>
        </span>
        {/* Meta's own words, in full. A contractor who cannot see WHY has no
            way to tell "the file expired" from "the number needs
            reconnecting" — the same argument the failed-bubble reason makes. */}
        {attachment.error && <span className="mt-1 block">{attachment.error}</span>}
        {retryError && <span className="mt-1 block font-medium">{retryError}</span>}
        <button
          type="button"
          disabled={busy || !onRetry}
          onClick={async () => {
            setBusy(true);
            setRetryError("");
            try {
              const failure = await onRetry?.(messageId, attachment.index);
              // The verdict, on the bubble that asked for it. A Retry whose
              // result the person who pressed it never sees is the dead
              // control in its quietest form.
              if (failure) setRetryError(failure);
            } finally {
              setBusy(false);
            }
          }}
          className="mt-1.5 inline-flex min-h-[44px] items-center gap-1.5 font-semibold underline disabled:opacity-60"
        >
          {busy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
          {busy ? t("app.messages.media.retrying") : t("app.messages.media.retry")}
        </button>
      </span>
    );
  }

  // unavailable — named, and offered nothing, because there is nothing to
  // offer. A location share and a Messenger "fallback" both land here.
  return (
    <span className="flex items-center gap-2 rounded-lg border border-current px-2.5 py-2 text-xs">
      <AttachmentIcon type={attachment.type} />
      <span className="truncate">{t("app.messages.media.unavailable", { kind: typeLabel })}</span>
    </span>
  );
}

/**
 * The attach control, and what is waiting to go with the next message.
 *
 * ══ Why it is only on a WhatsApp thread ════════════════════════════════════
 *
 * Because that is the only platform this build can actually send a file on —
 * lib/messaging/send.js refuses `media` on Facebook and Instagram BY NAME, and
 * a paperclip that produced "this conversation is on Facebook" after a
 * contractor had picked a photo and watched it upload is the control that
 * appears to work. The refusal in the send path is the guard that survives;
 * this is the courtesy that stops anybody meeting it.
 *
 * The file is uploaded the moment it is picked, not at Send: a driveway
 * connection takes real seconds, and a Send button that silently blocked on an
 * upload would look frozen. What is drawn here is the state of that upload,
 * with the server's own refusal on it when it fails.
 *
 * ══ The second control beside the paperclip ════════════════════════════════
 *
 * A pin — the company's own address, sent as a real location message rather
 * than as a line of text. `location` is null when the server said this company
 * has no coordinates, and then no button is drawn at all; there is nothing to
 * upload and nothing to fail, so its whole state is "attached or not".
 */
export function AttachControl({
  supported, pending, uploading, errorText, onPick, onClear, accept, disabled,
  location, sendingLocation, onPickLocation, onClearLocation, t,
}) {
  if (!supported) return null;

  if (pending) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-2 text-xs text-foreground">
        <AttachmentIcon type={pending.type} />
        <span className="min-w-0 flex-1 truncate">{pending.name}</span>
        <button
          type="button"
          onClick={onClear}
          aria-label={t("app.messages.media.remove")}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-card"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  // The pin waiting to go, shown the same way a chosen file is. Nothing was
  // uploaded and nothing can fail here — the coordinates are read from the
  // company's own row by the server at send time — so this is a label and a
  // way to change your mind.
  if (sendingLocation && location) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-2 text-xs text-foreground">
        <MapPin size={14} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{location.label}</span>
        <button
          type="button"
          onClick={onClearLocation}
          aria-label={t("app.messages.media.remove")}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-card"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={
            "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground " +
            (disabled || uploading ? "opacity-50" : "cursor-pointer hover:bg-muted")
          }
        >
          {uploading ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip size={15} aria-hidden="true" />
          )}
          {uploading ? t("app.messages.media.attaching") : t("app.messages.media.attach")}
          <input
            type="file"
            className="sr-only"
            // The types WhatsApp will actually take, from the one table that
            // knows them — a picker offering a format the send refuses is the
            // dead control with a file dialog in front of it.
            accept={accept}
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared so picking the SAME file twice still fires a change
              // event — otherwise a contractor who dismissed an error and
              // re-picked the photo would get nothing at all.
              e.target.value = "";
              if (file) onPick(file);
            }}
          />
        </label>

        {/* ── "Send our address" ──────────────────────────────────────────
            Drawn ONLY when the server said this company has map coordinates
            on file, and the label names the address it is about to send — a
            button that will not say what it sends is a button nobody can
            check before pressing. A company whose address was typed rather
            than picked from the autocomplete has no coordinates and gets no
            button, rather than one that fails at Meta. */}
        {location && (
          <button
            type="button"
            onClick={onPickLocation}
            disabled={disabled || uploading}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <MapPin size={15} aria-hidden="true" />
            {t("app.messages.media.sendLocation")}
          </button>
        )}
      </div>

      {/* ── What may be sent, and what may only be received ──────────────
          The owner's instruction was "don't limit it", and three of the types
          a customer can send back cannot be sent from here: there is no voice
          recorder, no sticker maker, and no contact picker. Meta would carry
          all three. Saying so in one line is the honest version — the
          alternative is three silent gaps a contractor discovers by looking
          for a control that is not there. See UNBUILT_OUTBOUND_TYPES. */}
      <p className="mt-1 text-xs text-muted-foreground">{t("app.messages.media.attachNote")}</p>

      {errorText && (
        // The server's sentence, naming WhatsApp's real limit. Not "upload
        // failed" — the point of reading Meta's published table is to be able
        // to say "pictures up to 5 MB" instead.
        <p className="mt-1 text-xs text-destructive">{errorText}</p>
      )}
    </div>
  );
}

/**
 * A clip, played where it arrived.
 *
 * ── Why a poster frame is not a nicety ────────────────────────────────────
 *
 * A <video> with no poster is a black rectangle until the browser has pulled
 * enough of the file to decode a frame, and iOS Safari will not decode one at
 * all before the user interacts — so on the device this screen is most read
 * on, the black box is permanent. The poster is derived from the same
 * Cloudinary asset by URL (videoPosterUrl), so there is no second file that
 * can be missing while the video is present.
 *
 * `preload="metadata"` rather than "auto": a contractor scrolling a thread on
 * a driveway connection must not silently download four 16 MB clips they never
 * pressed play on. Metadata is a few kilobytes and is what gives the scrubber
 * its length.
 *
 * `playsInline` because without it iOS takes the video full-screen the instant
 * it starts, which throws the reader out of the conversation.
 */
function VideoPlayer({ attachment, label, t }) {
  const poster = videoPosterUrl(attachment.url);
  return (
    <span className="block">
      <video
        src={attachment.url}
        // Null poster is fine and means "no poster attribute" — a plainer
        // bubble, never a broken image.
        poster={poster || undefined}
        controls
        preload="metadata"
        playsInline
        aria-label={label}
        onLoadedMetadata={(e) => repinAfterGrowth(e.currentTarget)}
        className="max-h-64 w-full max-w-full rounded-lg bg-black"
      />
      {/* The way to see it properly. A <video> in a bubble that is at most 85%
          of a 375px screen is a thumbnail with controls, and the thing the
          homeowner was pointing at is often smaller than the play button. */}
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold underline"
      >
        <ExternalLink size={12} aria-hidden="true" />
        {t("app.messages.media.open", { name: label })}
      </a>
    </span>
  );
}

/**
 * A voice note, played where it arrived.
 *
 * This is the one the owner called out by name, and the reason is that a
 * homeowner describing a leak talks for forty seconds rather than typing four
 * words. It used to render as the words "Voice message" beside a download
 * link, which is a message described instead of heard.
 *
 * ── Where the length comes from ───────────────────────────────────────────
 *
 * From the browser, once it has the metadata — not from us. Meta's webhook
 * carries no duration and neither does the Cloudinary upload response, so the
 * alternatives were a probe request per clip or a made-up number. It appears
 * when it is known and is absent until then, which is the same rule the file
 * size beside a document follows: no figure beats a wrong one.
 *
 * A native <audio> rather than a custom transport: the browser's own control
 * is keyboard-reachable, screen-reader-labelled and already familiar, and a
 * hand-rolled play button is three accessibility bugs waiting to be written.
 */
function AudioPlayer({ attachment, label }) {
  const [duration, setDuration] = useState(null);
  return (
    <span className="block rounded-lg border border-current px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-xs font-medium">
        <Mic size={13} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
        {duration && <span className="ml-auto shrink-0 tabular-nums opacity-80">{duration}</span>}
      </span>
      <audio
        src={attachment.url}
        controls
        preload="metadata"
        aria-label={label}
        onLoadedMetadata={(e) => setDuration(clockDuration(e.currentTarget.duration))}
        // h-11 is the 44px rule applied to a native control: Chrome's default
        // audio element is 54px, Safari's is 31px, and the shorter one is the
        // one a thumb misses.
        className="mt-1.5 h-11 w-full"
      />
    </span>
  );
}

/** Seconds -> m:ss, or null when the browser could not work it out (a stream,
 *  a file it cannot decode). Infinity and NaN both land on null rather than
 *  printing "Infinity:NaN" into a bubble. */
function clockDuration(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  const total = Math.round(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A dropped pin.
 *
 * ══ Why this is a card and not a line of coordinates ═══════════════════════
 *
 * Because a pin is very often THE JOB ADDRESS. It is how a homeowner answers
 * "where are you?" when the street number is missing off the house, and it was
 * arriving in this inbox as a bordered row reading "Location — nothing to
 * open". The map says where; the address says it in words a quote can carry;
 * the link hands off to the maps app that will actually navigate there.
 *
 * ══ The second control, and when it is NOT drawn ═══════════════════════════
 *
 * "Save this as the client's address" is offered only when all four of these
 * hold, and it is absent — not disabled, not present-and-403ing — otherwise:
 *
 *   1. this conversation is linked to a client, so there is a row to write to;
 *   2. the pin carried an ADDRESS STRING (see addressFromLocation: a bare pin
 *      gives coordinates, and coordinates are not a postal address to print on
 *      an invoice — reverse-geocoding one would be a billable guess);
 *   3. this member may edit clients, decided by the SERVER;
 *   4. a handler is wired.
 *
 * ══ Why no map is still a card ═════════════════════════════════════════════
 *
 * The thumbnail needs the browser Maps key and a deployment may not have one.
 * Missing key means no <img> — never a broken one — and the name, the address
 * and the link out are all still there. A pin that renders as nothing because
 * a key was unset is the dead row this change exists to remove.
 */
function LocationCard({ attachment, media, t }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const location = attachment.location;
  const mapUrl = staticMapUrl(location, {
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  });
  const link = mapsLinkUrl(location);
  const address = addressFromLocation(location);
  const title = location?.name || t(attachmentTypeKey("location"));

  const client = media?.client || null;
  const canSave = Boolean(address && client && media?.canEditClients && media?.onSaveAddress);

  return (
    <span className="block overflow-hidden rounded-lg border border-current">
      {mapUrl && (
        <a href={link} target="_blank" rel="noreferrer" className="block min-h-[44px]">
          <img
            src={mapUrl}
            alt={t("app.messages.media.mapAlt")}
            onLoad={(e) => repinAfterGrowth(e.currentTarget)}
            className="h-32 w-full object-cover"
          />
        </a>
      )}
      <span className="block px-2.5 py-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold">
          <MapPin size={13} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </span>
        {location?.address && <span className="mt-0.5 block">{location.address}</span>}
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 font-semibold underline"
        >
          <ExternalLink size={12} aria-hidden="true" />
          {t("app.messages.media.openInMaps")}
        </a>
        {canSave && !saved && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                // The verdict lands on the card that asked for it, exactly as
                // the Retry button's does — a control whose result the person
                // who pressed it never sees is the quietest dead control.
                const failure = await media.onSaveAddress(client.id, address);
                if (failure) setError(failure);
                else setSaved(true);
              } finally {
                setBusy(false);
              }
            }}
            className="mt-1 flex min-h-[44px] w-full items-center gap-1.5 font-semibold underline disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <Home size={12} aria-hidden="true" />
            )}
            {t("app.messages.media.useAsClientAddress", { name: client.name })}
          </button>
        )}
        {saved && <span className="mt-1 block font-medium">{t("app.messages.media.addressSaved")}</span>}
        {error && <span className="mt-1 block font-medium">{error}</span>}
      </span>
    </span>
  );
}

/**
 * A shared contact card.
 *
 * A homeowner forwarding their property manager's number, or the neighbour
 * whose fence the job runs along. The numbers are `tel:` links because on the
 * phone this is read on, that is the whole point of receiving one.
 *
 * "Add as a client" is drawn only when the member may create clients — the
 * server decides that (see the thread route's canEditClients) and
 * /api/clients refuses anyone else regardless, so this is what stops somebody
 * meeting a 403 rather than what enforces it. A card with no name AND no
 * number never reaches here: lib/messaging/attachments.js drops it, because an
 * empty bordered box is worse than a named row.
 */
function ContactCard({ attachment, media, t }) {
  const contacts = Array.isArray(attachment.contacts) ? attachment.contacts : [];
  return (
    <span className="block rounded-lg border border-current px-2.5 py-2 text-xs">
      {contacts.map((contact, i) => (
        <ContactEntry
          key={i}
          contact={contact}
          media={media}
          fallbackName={t(attachmentTypeKey("contact"))}
          divider={i > 0}
          t={t}
        />
      ))}
    </span>
  );
}

function ContactEntry({ contact, media, fallbackName, divider, t }) {
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const name = contact?.name || fallbackName;
  const phones = Array.isArray(contact?.phones) ? contact.phones : [];
  const emails = Array.isArray(contact?.emails) ? contact.emails : [];
  const canAdd = Boolean(media?.canEditClients && media?.onAddClient && contact?.name);

  return (
    <span className={divider ? "mt-2 block border-t border-current pt-2" : "block"}>
      <span className="flex items-center gap-1.5 font-semibold">
        <User size={13} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{name}</span>
      </span>
      {contact?.org && <span className="mt-0.5 block opacity-80">{contact.org}</span>}
      {phones.map((p, i) => (
        <a
          key={i}
          // Stripped to digits and a leading plus: a vCard number arrives with
          // spaces, brackets and dashes in it, and a `tel:` href that keeps
          // them dials nothing on some Android handsets.
          href={`tel:${String(p.phone).replace(/[^\d+]/g, "")}`}
          className="flex min-h-[44px] items-center gap-1.5 underline"
        >
          <Phone size={12} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{p.phone}</span>
        </a>
      ))}
      {emails.map((e, i) => (
        <a key={i} href={`mailto:${e}`} className="flex min-h-[44px] items-center gap-1.5 underline">
          <Mail size={12} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{e}</span>
        </a>
      ))}
      {canAdd && !added && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const failure = await media.onAddClient(contact);
              if (failure) setError(failure);
              else setAdded(true);
            } finally {
              setBusy(false);
            }
          }}
          className="mt-1 flex min-h-[44px] w-full items-center gap-1.5 font-semibold underline disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus size={12} aria-hidden="true" />
          )}
          {t("app.messages.media.addAsClient")}
        </button>
      )}
      {added && <span className="mt-1 block font-medium">{t("app.messages.media.clientAdded")}</span>}
      {error && <span className="mt-1 block font-medium">{error}</span>}
    </span>
  );
}

/**
 * A private note's body, inside a kit row, styled so it can never be
 * mistaken for a message that went to the homeowner.
 *
 * Four separate signals say so at once, deliberately — colour alone is not
 * enough for the one control on this screen whose failure mode is a customer
 * reading what the company thinks of them:
 *
 *   1. a fixed amber wash that derives from nothing (lib/messaging/noteTheme.js
 *      — measured, and provably never the brand colour);
 *   2. a solid left edge in the same family, so the card has an outline even
 *      where the wash is nearly the card's own colour;
 *   3. the word, in a label, in the reader's own language;
 *   4. an eye-off icon.
 *
 * The colours arrive MEASURED from the server, exactly as they did when this
 * was a bubble, so scripts/check-messaging.mjs tests the values this paints
 * rather than a copy of them. The row around it — gutter, avatar, name, time
 * — is the kit's (app/components/chat/Thread.js, through `renderBody`); this
 * is only what goes in the words' box.
 */
export function NoteBody({ message, note, t }) {
  const palette = note || {};
  const style = palette.bg
    ? {
        backgroundColor: palette.bg,
        color: palette.fg,
        borderColor: palette.border,
      }
    : undefined;

  return (
    <div
      style={style}
      data-note-body
      className="max-w-prose rounded-lg border-l-4 border border-transparent px-3 py-2 text-sm whitespace-pre-wrap break-words"
    >
      <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
        <EyeOff size={12} aria-hidden="true" />
        {t("app.messages.note.label")}
        <span className="font-normal normal-case tracking-normal opacity-80">· {t("app.messages.note.onlyYourTeam")}</span>
      </span>
      {message.body || ""}
    </div>
  );
}

/**
 * How long somebody has been waiting, on the list row.
 *
 * The whole reason MessageThread.waitingSince is a column: this sentence has
 * to be sayable NOW, on a list of two hundred, not once a month in a report.
 *
 * Draws nothing when nobody is waiting — a null is not a zero, and "waiting
 * 0 min" on an answered conversation would train people to ignore the badge.
 */
export function WaitingBadge({ thread, t, now }) {
  if (!isWaiting(thread)) return null;
  const label = waitedLabel(thread.waitingSince, now);
  if (!label) return null;
  // The clock and the duration are what the eye needs on a 280px row; the
  // whole sentence ("Waiting 4 h") is what a screen reader gets.
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground tabular-nums"
      title={t("app.messages.waiting.for", { duration: t(label.key, label.params) })}
      data-waiting-badge
    >
      <Clock size={11} aria-hidden="true" />
      <span aria-hidden="true">{t(label.key, label.params)}</span>
      <span className="sr-only">{t("app.messages.waiting.for", { duration: t(label.key, label.params) })}</span>
    </span>
  );
}

/**
 * The four states, on the conversation.
 *
 * Snoozing asks for a date, and the picker will not let it be saved without
 * one — a thread parked with no return date is a lead deleted with a friendly
 * label on it. That refusal lives in the route as well
 * (app/api/messaging/threads/[id]/route.js), because hiding a control is not
 * validation.
 */
export function StatusPicker({ value, snoozedUntil, onPick, busy, t }) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{t("app.messages.status.question")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {THREAD_STATUSES.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => onPick(s)}
              className={
                "min-h-[44px] rounded-full border px-4 text-sm font-medium disabled:opacity-50 " +
                (active
                  ? "border-transparent bg-inverted text-inverted-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {t(statusLabelKey(s))}
            </button>
          );
        })}
      </div>
      {value === "snoozed" && snoozedUntil && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("app.messages.status.snoozedUntil", {
            date: new Date(snoozedUntil).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Reply, or note.
 *
 * Two tabs and not a checkbox, because a checkbox reads as an option on the
 * thing you are about to do and this is a choice between two different things.
 * The note tab carries the note's own measured colours, so the composer LOOKS
 * like what it is about to write before a single word is typed — which is the
 * moment the mistake would otherwise be made.
 */
export function ComposerTabs({ mode, onPick, note, disabledReplyKey, t }) {
  const tab = (key, label, Icon, active) => {
    const noteStyle = key === "note" && active && note?.bg
      ? { backgroundColor: note.bg, color: note.fg, borderColor: note.border }
      : undefined;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={active}
        onClick={() => onPick(key)}
        style={noteStyle}
        className={
          "min-h-[44px] inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold " +
          (active
            ? key === "note"
              ? "border"
              : "border-transparent bg-inverted text-inverted-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted")
        }
      >
        <Icon size={14} aria-hidden="true" />
        {label}
      </button>
    );
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {tab("reply", t("app.messages.compose.tabReply"), MessageSquare, mode === "reply")}
      {tab("note", t("app.messages.compose.tabNote"), StickyNote, mode === "note")}
      {/* The reason the Reply side is off, printed beside the tabs rather than
          only under them — a contractor who can still write a NOTE needs to see
          that it is the reply, and only the reply, that is blocked. */}
      {mode === "reply" && disabledReplyKey && (
        <span className="text-xs text-muted-foreground">{t(disabledReplyKey)}</span>
      )}
      {mode === "note" && (
        <span className="text-xs text-muted-foreground">{t("app.messages.note.hint")}</span>
      )}
    </div>
  );
}

/**
 * WhatsApp's 24-hour customer service window, said out loud.
 *
 * ── Why this is a banner and not only a disabled box ──────────────────────
 *
 * Because it is the one blocker on this screen that is NOT FieldQuo's fault,
 * NOT Meta's approval, and NOT permanent — it is a clock, it closes on its own,
 * and it reopens the moment the customer writes again. A greyed-out composer
 * with "cannot send" on it would read as the feature being broken. What a
 * contractor needs is the rule, the time, and the way through.
 *
 * Three states, and all three are drawn:
 *
 *   closing soon  open, under an hour left. A warning, not a block — the state
 *                 in which a contractor most needs to be told BEFORE they
 *                 start typing a long answer.
 *   closed        24 hours have passed. Free text is refused; a template is
 *                 offered.
 *   never opened  this person has never written. Same refusal, different
 *                 sentence, because "wait for them to reply" is not the advice
 *                 in a conversation that has not started.
 *
 * `notice` comes from the SERVER (lib/messaging/serviceWindow.js, through the
 * thread route) rather than being computed here from a timestamp. The browser
 * computing it would be a second answer, in a second clock, and the one that
 * disagrees with the refusal the send is about to get.
 */
export function ServiceWindowNotice({ notice, t }) {
  if (!notice) return null;
  const key = notice.blockKey || notice.warnKey;
  if (!key) return null;

  const blocked = Boolean(notice.blockKey);
  return (
    <p
      // Neither tone uses colour alone to carry the difference: the icon and
      // the words say it, and the border does the quiet half. A contractor in
      // a van in sunlight is the reader here.
      className={
        "mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs " +
        (blocked
          ? "border-destructive bg-card text-foreground"
          : "border-border bg-muted text-muted-foreground")
      }
    >
      {blocked ? (
        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <Clock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      {/* No parameters. `closingSoon` only ever fires with under an hour left
          (serviceWindowNotice sets it at hours < 1), so "less than an hour" is
          the whole sentence — a "{hours} hours left" that could only ever say
          "0" would be worse than the words. */}
      <span>{t(key)}</span>
    </p>
  );
}

/**
 * Pick one of the templates Meta approved, and fill it in.
 *
 * Shown only when the window is closed, because that is the only time it is
 * the answer. An always-visible template picker would invite a contractor to
 * send a pre-approved marketing message into a live conversation, which is
 * both worse writing and, for a MARKETING template, a charge.
 *
 * A company with a connected number and NO approved templates gets a sentence
 * saying so, not an empty select. An empty control with nothing in it is the
 * dead control AGENTS.md's first rule forbids, and here the honest version
 * ("you have no approved templates yet") is also the actionable one.
 */
export function TemplatePicker({ templates, value, onPick, params, onParam, t }) {
  const list = Array.isArray(templates) ? templates : [];
  if (!list.length) {
    return (
      <p className="mb-2 text-xs text-muted-foreground">{t("app.messages.template.none")}</p>
    );
  }

  const chosen = list.find((x) => x.id === value) || null;

  return (
    <div className="mb-2 space-y-2">
      <label className="block text-xs">
        <span className="text-muted-foreground">{t("app.messages.template.label")}</span>
        <select
          value={value || ""}
          onChange={(e) => onPick(e.target.value || null)}
          // text-base, not text-sm: anything smaller makes iOS Safari zoom the
          // page the moment the select is focused.
          className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-card px-2 text-base text-foreground"
        >
          <option value="">{t("app.messages.template.choose")}</option>
          {list.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} ({x.language})
            </option>
          ))}
        </select>
      </label>

      {chosen && (
        <>
          {/* The APPROVED body, shown before it is sent. A picker listing names
              alone asks a contractor to send a message they cannot read. */}
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground">
            {chosen.body}
          </p>
          {Array.from({ length: chosen.variableCount }, (_, i) => (
            <label key={i} className="block text-xs">
              <span className="text-muted-foreground">
                {t("app.messages.template.value", { number: i + 1 })}
              </span>
              <input
                type="text"
                value={params[i] || ""}
                onChange={(e) => onParam(i, e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-lg border border-border bg-background px-2 text-base text-foreground"
              />
            </label>
          ))}
        </>
      )}
    </div>
  );
}

/** Who owns this conversation. Names come from /api/leads/assignees. */
export function AssigneePicker({ value, people, onPick, busy, t }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{t("app.messages.assignee.label")}</span>
      <select
        value={value || ""}
        disabled={busy}
        onChange={(e) => onPick(e.target.value || null)}
        // text-base, not text-sm: anything smaller makes iOS Safari zoom the
        // page the moment the select is focused.
        className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-card px-2 text-base text-foreground disabled:opacity-50"
      >
        <option value="">{t("app.messages.assignee.nobody")}</option>
        {(people || []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * "Did this become a job?" — the control the month-end review is built on.
 *
 * Chips rather than a dropdown: four options, one tap, 44px targets, and the
 * current answer visible without opening anything. The selected chip can be
 * tapped again to clear it, because an outcome set by mistake must be
 * removable — and a cleared outcome goes back to "nobody has said", never to
 * "lost".
 */
export function OutcomePicker({ value, onPick, busy, t }) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{t("app.messages.outcome.question")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {THREAD_OUTCOMES.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => onPick(active ? null : o)}
              className={
                "min-h-[44px] rounded-full border px-4 text-sm font-medium disabled:opacity-50 " +
                (active
                  ? "border-transparent bg-inverted text-inverted-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {t(outcomeLabelKey(o))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
