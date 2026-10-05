"use client";

// app/components/company/chat/RoomSettings.js
//
// The right-hand panel for one conversation: its settings (a channel's
// name, topic, who can see it, who can post, "include everyone"; a group's
// name), YOUR notifications for it, the people in it, and Archive / Leave.
//
// What is drawn follows `room.can` — the server's answer for THIS viewer
// (lib/company/chat/store.js readThread) — so a crew member sees the people
// and their own notifications, and no rename box they could not save. The
// server decides every write again regardless; hiding a control is not the
// access control (AGENTS.md non-negotiable #2's rule, applied everywhere).
//
// #general and job rooms are kept by FieldQuo from the roster and the
// schedule, and a DM is two people: for those the people list explains
// rather than offering Add or Remove.
import { useCallback, useEffect, useState } from "react";
import { Archive, BellOff, Briefcase, Loader2, LogOut, Star, UserPlus } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { chatApi } from "@/lib/company/chat/client";
import { slugify, CHANNEL_NAME_MAX } from "@/lib/chat/channelName";
import { ContextBar, Avatar, initialsOf } from "@/app/components/chat";
import { Button, RadioRow, ToggleRow, personLine, useSay } from "./parts";
import { ConfirmModal } from "./ChatDialogs";

/** "Until tomorrow at 7 AM" in the reader's own zone, as an ISO instant. */
export function tomorrowAtSeven(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 7, 0, 0, 0);
  return d.toISOString();
}

function Section({ title, children, dataKey }) {
  return (
    <section className="border-b border-border pb-4 pt-3 first:pt-0 last:border-b-0" data-settings-section={dataKey}>
      {title ? <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3> : null}
      {children}
    </section>
  );
}

/**
 * @param room        the thread payload (readThread)
 * @param onChanged() re-read the room and the list after a change
 * @param onGone()    the viewer left or hid it — close the room
 * @param onAddPeople()  open the Add people dialog
 * @param peopleKey   bump to re-read the people (after Add people)
 */
export default function RoomSettings({ room, roomName, onClose, onChanged, onGone, onAddPeople, peopleKey = 0 }) {
  const { t } = useTranslation();
  const say = useSay();
  const can = room?.can || {};
  const mine = room?.mine || null;
  const isChannel = room?.kind === "channel";
  const isGroup = room?.kind === "group";
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, body, label, danger, run }

  // ── Name and topic: typed, then saved together ─────────────────────────
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  useEffect(() => {
    // A group's OWN name, not the "Ana, Bob, Cat" it is called without one.
    setName(isChannel ? room?.title || "" : isGroup ? room?.groupName || "" : "");
    setTopic(room?.topic || "");
  }, [room?.id, room?.title, room?.topic, room?.groupName, isChannel, isGroup]);

  const run = useCallback(
    async (fn) => {
      setSaving(true);
      setError("");
      try {
        await fn();
        await onChanged();
        return true;
      } catch (err) {
        setError(say(err, "app.companyChat.refusal.notSent"));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onChanged, say],
  );

  const saveNameTopic = () => {
    const patch = {};
    if (can.rename) patch.name = name;
    if (isChannel && can.manage) patch.topic = topic;
    return run(() => chatApi.update(room.id, patch));
  };

  // ── People: a page at a time ───────────────────────────────────────────
  const [people, setPeople] = useState(null);
  const [peopleError, setPeopleError] = useState("");
  const [cursor, setCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reread, setReread] = useState(0);
  useEffect(() => {
    let alive = true;
    setPeople(null);
    setPeopleError("");
    chatApi
      .members(room.id)
      .then((d) => {
        if (!alive) return;
        setPeople(d);
        setCursor(d.nextCursor || null);
      })
      .catch((err) => alive && setPeopleError(say(err, "app.companyChat.roomLoadError")));
    return () => {
      alive = false;
    };
  }, [room.id, peopleKey, reread, say]);
  const more = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await chatApi.members(room.id, { cursor });
      setPeople((d) => ({ ...next, members: [...(d?.members || []), ...(next.members || [])] }));
      setCursor(next.nextCursor || null);
    } catch (err) {
      setPeopleError(say(err, "app.companyChat.roomLoadError"));
    } finally {
      setLoadingMore(false);
    }
  };

  const explain =
    room.kind === "general"
      ? t("app.companyChat.membersGeneral")
      : room.kind === "job"
        ? t("app.companyChat.membersJob")
        : room.kind === "dm"
          ? t("app.companyChat.membersDirect")
          : isChannel
            ? t("app.companyChat.membersChannel")
            : t("app.companyChat.membersGroup");

  const title = isChannel ? t("app.companyChat.channelSettings") : isGroup ? t("app.companyChat.groupSettings") : t("app.companyChat.roomSettings");
  const notifyDefaultKey = room.kind === "dm" || isGroup ? "app.companyChat.notify.defaultAll" : "app.companyChat.notify.defaultMentions";
  const slug = isChannel ? slugify(name, { unicode: true }) : "";

  return (
    <ContextBar title={title} subtitle={roomName} onClose={onClose}>
      <div data-room-settings>
        {error ? (
          <p className="mb-3 text-sm text-red-700 dark:text-red-300" data-action-error>
            {error}
          </p>
        ) : null}

        {/* ── The room itself ──────────────────────────────────────────── */}
        {(isChannel || isGroup) && (can.rename || can.manage) ? (
          <Section dataKey="about">
            {can.rename ? (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">{isChannel ? t("app.companyChat.channelName") : t("app.companyChat.groupName")}</span>
                <input
                  type="text"
                  value={name}
                  maxLength={isChannel ? CHANNEL_NAME_MAX : 80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isGroup ? t("app.companyChat.groupNamePlaceholder") : ""}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-rename
                />
                {isChannel ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {slug ? t("app.companyChat.channelNamePreview", { slug }) : t("app.companyChat.channelNameHint")}
                  </span>
                ) : null}
              </label>
            ) : null}
            {isChannel && can.manage ? (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t("app.companyChat.topic")}</span>
                <input
                  type="text"
                  value={topic}
                  maxLength={250}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("app.companyChat.topicPlaceholder")}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-topic
                />
              </label>
            ) : null}
            <Button primary onClick={saveNameTopic} disabled={saving || (isChannel && can.rename && !slug)} data-save-room>
              {saving ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {t("app.companyChat.save")}
            </Button>

            {isChannel && can.manage ? (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("app.companyChat.visibility")}</p>
                <RadioRow
                  name={`visibility-${room.id}`}
                  value="public"
                  checked={!room.private}
                  disabled={saving}
                  onChange={() => run(() => chatApi.update(room.id, { private: false }))}
                  title={t("app.companyChat.public")}
                  hint={t("app.companyChat.publicHint")}
                />
                <RadioRow
                  name={`visibility-${room.id}`}
                  value="private"
                  checked={Boolean(room.private)}
                  disabled={saving}
                  onChange={() => run(() => chatApi.update(room.id, { private: true }))}
                  title={t("app.companyChat.private")}
                  hint={t("app.companyChat.privateHint")}
                />
                <div className="mt-2 divide-y divide-border/60">
                  <ToggleRow
                    checked={room.postingPolicy === "office"}
                    disabled={saving}
                    onChange={(on) => run(() => chatApi.update(room.id, { postingPolicy: on ? "office" : "everyone" }))}
                    title={t("app.companyChat.officeOnly")}
                    hint={t("app.companyChat.officeOnlyHint")}
                    dataKey="office-only"
                  />
                  {!room.private ? (
                    <ToggleRow
                      checked={Boolean(room.autoJoin)}
                      disabled={saving}
                      onChange={(on) => run(() => chatApi.update(room.id, { autoJoin: on }))}
                      title={t("app.companyChat.autoJoin")}
                      hint={t("app.companyChat.autoJoinHint")}
                      dataKey="auto-join"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </Section>
        ) : null}

        {/* ── Your notifications — yours only ──────────────────────────── */}
        {mine && can.settings ? (
          <Section title={t("app.companyChat.yourNotifications")} dataKey="notifications">
            {["default", "all", "mentions", "none"].map((level) => (
              <RadioRow
                key={level}
                name={`notify-${room.id}`}
                value={level}
                checked={mine.notify === level}
                disabled={saving}
                onChange={(v) => run(() => chatApi.updateMine(room.id, { notify: v }))}
                title={level === "default" ? t(notifyDefaultKey) : t(`app.companyChat.notify.${level}`)}
              />
            ))}
            <div className="mt-3">
              {mine.mutedUntil ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" data-muted-until>
                    <BellOff size={14} aria-hidden="true" />
                    {t("app.companyChat.mutedUntil", {
                      time: new Date(mine.mutedUntil).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }),
                    })}
                  </span>
                  <Button onClick={() => run(() => chatApi.updateMine(room.id, { mutedUntil: null }))} disabled={saving}>
                    {t("app.companyChat.unmute")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{t("app.companyChat.snooze")}</span>
                  <Button
                    onClick={() => run(() => chatApi.updateMine(room.id, { mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() }))}
                    disabled={saving}
                    data-snooze="1h"
                  >
                    {t("app.companyChat.snooze1h")}
                  </Button>
                  <Button onClick={() => run(() => chatApi.updateMine(room.id, { mutedUntil: tomorrowAtSeven() }))} disabled={saving} data-snooze="tomorrow">
                    {t("app.companyChat.snoozeTomorrow")}
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => run(() => chatApi.updateMine(room.id, { starred: !mine.starred }))} disabled={saving} data-star>
                <Star size={14} aria-hidden="true" className={mine.starred ? "fill-current" : ""} />
                {mine.starred ? t("app.companyChat.unstar") : t("app.companyChat.star")}
              </Button>
              {can.hide ? (
                <Button
                  onClick={async () => {
                    if (await run(() => chatApi.updateMine(room.id, { hidden: true }))) onGone();
                  }}
                  disabled={saving}
                  data-hide
                >
                  {t("app.companyChat.hide")}
                </Button>
              ) : null}
            </div>
            {can.hide ? <p className="mt-1 text-xs text-muted-foreground">{t("app.companyChat.hideHint")}</p> : null}
          </Section>
        ) : null}

        {/* ── People ───────────────────────────────────────────────────── */}
        <Section title={people ? `${t("app.companyChat.people")} · ${people.total}` : t("app.companyChat.people")} dataKey="people">
          {peopleError ? <p className="text-sm text-red-700 dark:text-red-300">{peopleError}</p> : null}
          {!people && !peopleError ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
            </p>
          ) : null}
          {people ? (
            <>
              {people.can?.add ? (
                <Button className="mb-2 w-full" onClick={onAddPeople} data-add-people>
                  <UserPlus size={14} aria-hidden="true" /> {t("app.companyChat.addPeople")}
                </Button>
              ) : null}
              <ul className="divide-y divide-border/60" data-members-list>
                {people.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2" data-member={m.id}>
                    <Avatar initials={initialsOf(m.name || m.email || "?")} size="sm" tone={m.isYou ? "us" : "them"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <span className="truncate">{m.name || m.email || t("app.companyChat.someoneWhoLeft")}</span>
                        {m.isYou ? <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{t("app.companyChat.you")}</span> : null}
                        {m.manager ? <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("app.companyChat.manager")}</span> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.departed ? t("app.companyChat.departed") : personLine(t, m)}
                        {m.addedBy ? ` · ${t("app.companyChat.addedBy", { name: m.addedBy })}` : ""}
                      </span>
                    </span>
                    {people.can?.remove && !m.isYou ? (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirm({
                            title: t("app.companyChat.remove"),
                            body: t("app.companyChat.removeConfirm", { name: m.name || m.email || "" }),
                            label: t("app.companyChat.remove"),
                            danger: true,
                            run: () => run(() => chatApi.removeMember(room.id, m.id)).then((ok) => ok && setReread((n) => n + 1)),
                          })
                        }
                        className="min-h-[36px] shrink-0 rounded-lg px-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                        data-remove-member={m.id}
                      >
                        {t("app.companyChat.remove")}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {cursor ? (
                <Button className="mt-2 w-full" onClick={more} disabled={loadingMore}>
                  {t("app.companyChat.loadMore")}
                </Button>
              ) : null}
            </>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground" data-members-explain>
            {explain}
          </p>
          {room.kind === "job" && room.jobId ? (
            <Link href={`/app/jobs/${encodeURIComponent(room.jobId)}`} className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline">
              <Briefcase size={14} aria-hidden="true" /> {t("app.companyChat.openJob")}
            </Link>
          ) : null}
        </Section>

        {/* ── Archive and leave ────────────────────────────────────────── */}
        {can.archive || can.leave || (isChannel && room.autoJoin && mine) ? (
          <Section dataKey="danger">
            {can.archive ? (
              <>
                <Button
                  danger={!room.archived}
                  className="w-full"
                  onClick={() =>
                    room.archived
                      ? run(() => chatApi.unarchive(room.id))
                      : setConfirm({
                          title: t("app.companyChat.archive"),
                          body: t("app.companyChat.archiveConfirm", { name: room.title }),
                          label: t("app.companyChat.archive"),
                          danger: true,
                          run: () => run(() => chatApi.archive(room.id)),
                        })
                  }
                  disabled={saving}
                  data-archive={room.archived ? "unarchive" : "archive"}
                >
                  <Archive size={14} aria-hidden="true" />
                  {room.archived ? t("app.companyChat.unarchive") : t("app.companyChat.archive")}
                </Button>
                <p className="mt-1 mb-3 text-xs text-muted-foreground">{t("app.companyChat.archiveHint")}</p>
              </>
            ) : null}
            {can.leave ? (
              <Button
                danger
                className="w-full"
                onClick={() =>
                  setConfirm({
                    title: isChannel ? t("app.companyChat.leaveChannel") : t("app.companyChat.leaveGroup"),
                    body: t("app.companyChat.leaveConfirm", { name: roomName }),
                    label: isChannel ? t("app.companyChat.leaveChannel") : t("app.companyChat.leaveGroup"),
                    danger: true,
                    run: async () => {
                      setSaving(true);
                      setError("");
                      try {
                        await chatApi.leave(room.id);
                        onGone();
                      } catch (err) {
                        setError(say(err, "app.companyChat.refusal.notSent"));
                      } finally {
                        setSaving(false);
                      }
                    },
                  })
                }
                disabled={saving}
                data-leave-button
              >
                <LogOut size={14} aria-hidden="true" />
                {isChannel ? t("app.companyChat.leaveChannel") : t("app.companyChat.leaveGroup")}
              </Button>
            ) : isChannel && room.autoJoin && mine ? (
              <p className="text-xs text-muted-foreground">{t("app.companyChat.autoJoinNoLeave")}</p>
            ) : null}
          </Section>
        ) : null}
      </div>

      {confirm ? (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await confirm.run();
            setConfirm(null);
          }}
        />
      ) : null}
    </ContextBar>
  );
}
