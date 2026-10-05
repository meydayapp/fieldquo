"use client";

// app/components/company/chat/ChatDialogs.js
//
// The company chat's dialogs: New message (one person → a DM, two or more →
// a group), New channel (the office only), Browse channels, Add people,
// "Seen by", and a plain confirm. Every one of them ends in a server call
// that decides again — these never decide who may do what, they only avoid
// offering what the server would refuse (lib/company/chat/rules.js).
import { useCallback, useEffect, useState } from "react";
import { Hash, Lock, Loader2, Megaphone } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { chatApi } from "@/lib/company/chat/client";
import { slugify, CHANNEL_NAME_MAX } from "@/lib/chat/channelName";
import { Avatar, initialsOf } from "@/app/components/chat";
import { Modal, Button, PeoplePicker, PickedChips, RadioRow, ToggleRow, useDirectory, useSay } from "./parts";

/** A multi-select over the directory, with chips for what is picked. */
function usePicks() {
  const [picked, setPicked] = useState([]);
  const toggle = useCallback((p) => {
    setPicked((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]));
  }, []);
  const remove = useCallback((p) => setPicked((list) => list.filter((x) => x.id !== p.id)), []);
  return { picked, toggle, remove, ids: picked.map((p) => p.id) };
}

// ═══════════════════════════════════════════════════════════════════════════
// New message
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pick one person and it is their DM; pick two or more and it is a group,
 * with an optional name. Crew get exactly this and nothing else — one
 * button, one picker (the owner: keep it simple for the crew).
 *
 * @param onOpened(roomId)  called with the room the server opened or made
 */
export function NewMessageModal({ me, onClose, onOpened }) {
  const { t } = useTranslation();
  const say = useSay();
  const dir = useDirectory(true);
  const picks = usePicks();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const group = picks.picked.length >= 2;

  const start = async () => {
    if (!picks.picked.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = group ? await chatApi.createGroup(picks.ids, name.trim()) : await chatApi.openDirect(picks.ids[0]);
      onOpened(res.roomId);
    } catch (err) {
      setError(say(err, "app.companyChat.roomLoadError"));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t("app.companyChat.newMessage")}
      onClose={onClose}
      footer={
        <>
          {error ? <p className="mr-auto text-sm text-red-700 dark:text-red-300" data-action-error>{error}</p> : null}
          <Button onClick={onClose}>{t("app.companyChat.cancel")}</Button>
          <Button primary onClick={start} disabled={!picks.picked.length || busy} data-start-conversation>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {group ? t("app.companyChat.startGroup", { count: picks.picked.length + 1 }) : t("app.companyChat.startConversation")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("app.companyChat.pickHint")}</p>
        <PickedChips people={picks.picked} onRemove={picks.remove} />
        {group ? (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t("app.companyChat.groupName")}</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("app.companyChat.groupNamePlaceholder")}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-group-name
            />
          </label>
        ) : null}
        <PeoplePicker
          people={dir.people}
          loading={dir.loading}
          error={dir.error}
          query={dir.query}
          onQuery={dir.setQuery}
          selected={picks.ids}
          onToggle={picks.toggle}
          excludeIds={[me?.id]}
        />
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// New channel — the office only (the server refuses anybody else)
// ═══════════════════════════════════════════════════════════════════════════

export function NewChannelModal({ me, onClose, onOpened }) {
  const { t } = useTranslation();
  const say = useSay();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [officeOnly, setOfficeOnly] = useState(false);
  const [autoJoin, setAutoJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dir = useDirectory(true);
  const picks = usePicks();
  // The same rule the server stores the name by, shown before Create.
  const slug = slugify(name, { unicode: true });
  const isPrivate = visibility === "private";

  const create = async () => {
    if (!slug || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await chatApi.createChannel({
        name,
        topic,
        isPrivate,
        postingPolicy: officeOnly ? "office" : "everyone",
        autoJoin: !isPrivate && autoJoin,
        members: picks.ids,
      });
      onOpened(res.roomId);
    } catch (err) {
      setError(say(err, "app.companyChat.refusal.notSent"));
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={t("app.companyChat.newChannel")}
      onClose={onClose}
      footer={
        <>
          {error ? <p className="mr-auto text-sm text-red-700 dark:text-red-300" data-action-error>{error}</p> : null}
          <Button onClick={onClose}>{t("app.companyChat.cancel")}</Button>
          <Button primary onClick={create} disabled={!slug || busy} data-create-channel>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {t("app.companyChat.createChannel")}
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-new-channel>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t("app.companyChat.channelName")}</span>
          <span className="relative block">
            <Hash size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={name}
              maxLength={CHANNEL_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("app.companyChat.channelNamePlaceholder")}
              className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-channel-name
            />
          </span>
          <span className="mt-1 block text-xs text-muted-foreground" data-slug-preview>
            {slug ? t("app.companyChat.channelNamePreview", { slug }) : t("app.companyChat.channelNameHint")}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t("app.companyChat.topic")}</span>
          <input
            type="text"
            value={topic}
            maxLength={250}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("app.companyChat.topicPlaceholder")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t("app.companyChat.visibility")}</legend>
          <RadioRow name="visibility" value="public" checked={!isPrivate} onChange={setVisibility} title={t("app.companyChat.public")} hint={t("app.companyChat.publicHint")} />
          <RadioRow name="visibility" value="private" checked={isPrivate} onChange={setVisibility} title={t("app.companyChat.private")} hint={t("app.companyChat.privateHint")} />
        </fieldset>
        <div className="divide-y divide-border/60">
          <ToggleRow checked={officeOnly} onChange={setOfficeOnly} title={t("app.companyChat.officeOnly")} hint={t("app.companyChat.officeOnlyHint")} dataKey="office-only" />
          {!isPrivate ? (
            <ToggleRow checked={autoJoin} onChange={setAutoJoin} title={t("app.companyChat.autoJoin")} hint={t("app.companyChat.autoJoinHint")} dataKey="auto-join" />
          ) : null}
        </div>
        {!isPrivate ? <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t("app.companyChat.publicWarning")}</p> : null}
        {isPrivate || !autoJoin ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{isPrivate ? t("app.companyChat.addPeople") : t("app.companyChat.addPeopleOptional")}</p>
            <PickedChips people={picks.picked} onRemove={picks.remove} />
            <PeoplePicker
              people={dir.people}
              loading={dir.loading}
              error={dir.error}
              query={dir.query}
              onQuery={dir.setQuery}
              selected={picks.ids}
              onToggle={picks.toggle}
              excludeIds={[me?.id]}
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Browse channels
// ═══════════════════════════════════════════════════════════════════════════

/** The public channels you are not in, each with Join. Private ones are never listed. */
export function BrowseChannelsModal({ joinable = [], canCreate = false, onClose, onJoined, onCreate }) {
  const { t } = useTranslation();
  const say = useSay();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const join = async (room) => {
    setBusyId(room.id);
    setError("");
    try {
      const res = await chatApi.join(room.id);
      onJoined(res.roomId);
    } catch (err) {
      setError(say(err, "app.companyChat.roomLoadError"));
      setBusyId(null);
    }
  };
  return (
    <Modal
      title={t("app.companyChat.browseChannels")}
      onClose={onClose}
      footer={
        canCreate ? (
          <Button primary onClick={onCreate} data-open-new-channel>
            {t("app.companyChat.newChannel")}
          </Button>
        ) : null
      }
    >
      {error ? <p className="mb-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      {!joinable.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("app.companyChat.noChannelsToJoin")}</p>
      ) : (
        <ul className="divide-y divide-border/60" data-joinable>
          {joinable.map((room) => (
            <li key={room.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                {room.postingPolicy === "office" ? <Megaphone size={16} /> : <Hash size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">#{room.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {room.topic ? `${room.topic} · ` : ""}
                  {t("app.companyChat.memberCount", { count: room.memberCount })}
                </span>
              </span>
              <Button onClick={() => join(room)} disabled={busyId === room.id} data-join={room.id}>
                {busyId === room.id ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                {t("app.companyChat.join")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Add people
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param inIds  the people already in (as far as this screen knows — the
 *               server skips anybody already in regardless)
 */
export function AddPeopleModal({ roomId, me, inIds = [], onClose, onAdded }) {
  const { t } = useTranslation();
  const say = useSay();
  const dir = useDirectory(true);
  const picks = usePicks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async () => {
    if (!picks.ids.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await chatApi.addMembers(roomId, picks.ids);
      onAdded();
    } catch (err) {
      setError(say(err, "app.companyChat.refusal.notSent"));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t("app.companyChat.addPeople")}
      onClose={onClose}
      footer={
        <>
          {error ? <p className="mr-auto text-sm text-red-700 dark:text-red-300" data-action-error>{error}</p> : null}
          <Button onClick={onClose}>{t("app.companyChat.cancel")}</Button>
          <Button primary onClick={add} disabled={!picks.ids.length || busy} data-add-people-confirm>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {t("app.companyChat.addCount", { count: picks.ids.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <PickedChips people={picks.picked} onRemove={picks.remove} />
        <PeoplePicker
          people={dir.people}
          loading={dir.loading}
          error={dir.error}
          query={dir.query}
          onQuery={dir.setQuery}
          selected={picks.ids}
          onToggle={picks.toggle}
          excludeIds={[me?.id]}
          inIds={inIds}
        />
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Seen by
// ═══════════════════════════════════════════════════════════════════════════

/** Who has seen one message, a page at a time. Room members only — the server says 404 to anybody else. */
export function SeenByModal({ roomId, messageId, onClose }) {
  const { t } = useTranslation();
  const say = useSay();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  useEffect(() => {
    let alive = true;
    chatApi
      .seenBy(roomId, messageId)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(say(err, "app.companyChat.roomLoadError")));
    return () => {
      alive = false;
    };
  }, [roomId, messageId, say]);
  const loadMore = async () => {
    if (!data?.nextCursor || more) return;
    setMore(true);
    try {
      const next = await chatApi.seenBy(roomId, messageId, { cursor: data.nextCursor });
      setData((d) => ({ ...next, people: [...(d?.people || []), ...(next.people || [])] }));
    } catch (err) {
      setError(say(err, "app.companyChat.roomLoadError"));
    } finally {
      setMore(false);
    }
  };
  return (
    <Modal title={t("app.companyChat.seenByTitle")} onClose={onClose}>
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      {!data && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
        </p>
      ) : null}
      {data ? (
        <>
          <p className="mb-2 text-sm font-medium text-foreground">{t("app.companyChat.seenBy", { count: data.count })}</p>
          {!data.people.length ? (
            <p className="py-4 text-sm text-muted-foreground">{t("app.companyChat.seenNobody")}</p>
          ) : (
            <ul className="divide-y divide-border/60" data-seen-list>
              {data.people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Avatar initials={initialsOf(p.name || "?")} size="sm" tone={p.isYou ? "us" : "them"} />
                  <span className="truncate text-sm text-foreground">{p.name || t("app.companyChat.someoneWhoLeft")}</span>
                </li>
              ))}
            </ul>
          )}
          {data.nextCursor ? (
            <Button className="mt-2 w-full" onClick={loadMore} disabled={more}>
              {t("app.companyChat.loadMore")}
            </Button>
          ) : null}
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{t("app.companyChat.seenExplain")}</p>
        </>
      ) : null}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Confirm
// ═══════════════════════════════════════════════════════════════════════════

export function ConfirmModal({ title, body, confirmLabel, danger = false, onConfirm, onClose }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("app.companyChat.cancel")}</Button>
          <Button primary={!danger} danger={danger} onClick={go} disabled={busy} data-confirm>
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">{body}</p>
    </Modal>
  );
}

/**
 * The glyph a channel is drawn with — list rows, the header: a lock for a
 * private channel, a megaphone for an office-only one, # otherwise.
 */
export function ChannelGlyph({ room, size = 16, className = "" }) {
  if (room?.private) return <Lock size={size} aria-hidden="true" className={className} />;
  if (room?.postingPolicy === "office") return <Megaphone size={size} aria-hidden="true" className={className} />;
  return <Hash size={size} aria-hidden="true" className={className} />;
}
