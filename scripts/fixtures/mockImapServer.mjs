// scripts/fixtures/mockImapServer.mjs
//
// A tiny IMAP4rev1 server, in-process, on 127.0.0.1 — enough of RFC 3501 for
// imapflow to connect, LOGIN, LIST, EXAMINE, UID SEARCH, UID FETCH (ENVELOPE,
// RFC822.SIZE, BODY.PEEK[]) and LOGOUT against it. No Docker, no network, no
// real credentials: the one account it knows is the one the check invents.
//
// It RECORDS what the client asked for, which is the point: the check
// asserts that lib/mailbox/providers/imap.js
//   · opens mailboxes with EXAMINE, never SELECT (read-only),
//   · never issues STORE / COPY / MOVE / EXPUNGE / APPEND / DELETE,
//   · downloads a body (BODY[]) ONLY for the messages that matched a client —
//     the privacy rule, proven on the wire rather than read off the source.

import net from "node:net";

function quote(s) {
  if (s === null || s === undefined) return "NIL";
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function addrList(list) {
  if (!list || !list.length) return "NIL";
  return `(${list
    .map((a) => {
      const [mailbox, host] = String(a.address).split("@");
      return `(${quote(a.name || null)} NIL ${quote(mailbox)} ${quote(host)})`;
    })
    .join("")})`;
}

function envelope(m) {
  return `(${quote(m.date.toUTCString())} ${quote(m.subject)} ${addrList(m.from)} ${addrList(m.from)} ${addrList(m.from)} ${addrList(m.to)} ${addrList(m.cc)} NIL ${quote(m.inReplyTo ? `<${m.inReplyTo}>` : null)} ${quote(`<${m.messageId}>`)})`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function parseImapDate(s) {
  const m = String(s).replace(/"/g, "").match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), MONTHS.indexOf(m[2].toLowerCase()), Number(m[1])));
}

function inSet(uid, set, max) {
  return String(set)
    .split(",")
    .some((part) => {
      const [a, b] = part.split(":");
      const lo = a === "*" ? max : Number(a);
      if (b === undefined) return uid === lo;
      const hi = b === "*" ? max : Number(b);
      return uid >= Math.min(lo, hi) && uid <= Math.max(lo, hi);
    });
}

/**
 * @param user, pass   the one account
 * @param folders      { INBOX: { uidValidity, messages: [{ uid, raw: Buffer, date, subject, from, to, cc, messageId, inReplyTo }] }, Sent: {...} }
 * @returns { port, close(), log: [commands], bodyFetches: [{ folder, uid }] }
 */
export async function startMockImap({ user, pass, folders }) {
  const log = [];
  const bodyFetches = [];
  const server = net.createServer((sock) => {
    let buf = "";
    let selected = null;
    let authed = false;
    const send = (line) => sock.write(line + "\r\n");
    send("* OK [CAPABILITY IMAP4rev1 LITERAL+] mock ready");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let idx;
      while ((idx = buf.indexOf("\r\n")) >= 0) {
        let line = buf.slice(0, idx);
        // A synchronising literal {n} (or non-sync {n+}): take n more bytes.
        const lit = line.match(/\{(\d+)(\+?)\}$/);
        if (lit) {
          const n = Number(lit[1]);
          if (!lit[2]) sock.write("+ go ahead\r\n");
          if (buf.length < idx + 2 + n) return; // wait for the rest
          line = line.slice(0, -lit[0].length) + JSON.stringify(buf.slice(idx + 2, idx + 2 + n));
          buf = buf.slice(idx + 2 + n);
          const end = buf.indexOf("\r\n");
          if (end < 0) { buf = line + buf; return; }
          line += buf.slice(0, end);
          buf = buf.slice(end + 2);
        } else {
          buf = buf.slice(idx + 2);
        }
        handle(line);
      }
    });
    sock.on("error", () => {});

    function handle(line) {
      const m = line.match(/^(\S+)\s+(\S+)\s*(.*)$/);
      if (!m) return;
      const [, tag, cmdRaw, rest] = m;
      const cmd = cmdRaw.toUpperCase();
      log.push(`${cmd} ${cmd === "LOGIN" ? "<redacted>" : rest}`.trim());
      if (cmd === "CAPABILITY") {
        send("* CAPABILITY IMAP4rev1 LITERAL+");
        return send(`${tag} OK CAPABILITY completed`);
      }
      if (cmd === "NOOP") return send(`${tag} OK NOOP completed`);
      if (cmd === "LOGOUT") {
        send("* BYE logging out");
        send(`${tag} OK LOGOUT completed`);
        return sock.end();
      }
      if (cmd === "LOGIN") {
        const args = [...rest.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((x) => (x[1] !== undefined ? x[1].replace(/\\(.)/g, "$1") : x[2]));
        if (args[0] === user && args[1] === pass) {
          authed = true;
          return send(`${tag} OK [CAPABILITY IMAP4rev1 LITERAL+] LOGIN completed`);
        }
        return send(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials`);
      }
      if (!authed) return send(`${tag} BAD not authenticated`);
      if (cmd === "LIST" || cmd === "LSUB") {
        // `LIST "" ""` asks for the hierarchy delimiter, not the folders.
        if (/""\s*""\s*$/.test(rest)) {
          send(`* ${cmd} (\\Noselect) "/" ""`);
          return send(`${tag} OK ${cmd} completed`);
        }
        for (const name of Object.keys(folders)) {
          const flags = name === "Sent" ? "(\\HasNoChildren \\Sent)" : "(\\HasNoChildren)";
          send(`* ${cmd} ${flags} "/" ${quote(name)}`);
        }
        return send(`${tag} OK ${cmd} completed`);
      }
      if (cmd === "SELECT" || cmd === "EXAMINE") {
        const name = rest.replace(/^"|"$/g, "");
        const f = folders[name];
        if (!f) return send(`${tag} NO no such mailbox`);
        selected = name;
        const maxUid = f.messages.reduce((a, x) => Math.max(a, x.uid), 0);
        send(`* ${f.messages.length} EXISTS`);
        send("* 0 RECENT");
        send("* FLAGS (\\Seen \\Answered \\Flagged \\Deleted \\Draft)");
        send(`* OK [UIDVALIDITY ${f.uidValidity}] UIDs valid`);
        send(`* OK [UIDNEXT ${maxUid + 1}] next uid`);
        send("* OK [PERMANENTFLAGS ()] read-only");
        return send(`${tag} OK [${cmd === "EXAMINE" ? "READ-ONLY" : "READ-WRITE"}] ${cmd} completed`);
      }
      if (cmd === "STATUS") {
        const name = rest.match(/^"?([^"\s]+)"?/)[1];
        const f = folders[name];
        send(`* STATUS ${quote(name)} (MESSAGES ${f.messages.length} UIDNEXT ${f.messages.reduce((a, x) => Math.max(a, x.uid), 0) + 1} UIDVALIDITY ${f.uidValidity})`);
        return send(`${tag} OK STATUS completed`);
      }
      if (cmd === "UID") {
        const sub = rest.match(/^(\S+)\s*(.*)$/);
        const op = sub[1].toUpperCase();
        const args = sub[2];
        const f = folders[selected];
        const max = f.messages.reduce((a, x) => Math.max(a, x.uid), 0);
        if (op === "SEARCH") {
          let hits = f.messages;
          const since = args.match(/SINCE\s+(\S+)/i);
          if (since) {
            const d = parseImapDate(since[1]);
            hits = hits.filter((x) => x.date >= d);
          }
          const uidSet = args.match(/UID\s+(\S+)/i);
          if (uidSet) hits = hits.filter((x) => inSet(x.uid, uidSet[1], max));
          send(`* SEARCH${hits.map((x) => ` ${x.uid}`).join("")}`);
          return send(`${tag} OK SEARCH completed`);
        }
        if (op === "FETCH") {
          const [set, ...itemsParts] = args.split(" ");
          const items = itemsParts.join(" ").toUpperCase();
          const wantBody = /BODY(\.PEEK)?\[\]/.test(items);
          const wantEnv = items.includes("ENVELOPE");
          const wantSize = items.includes("RFC822.SIZE");
          f.messages.forEach((x, i) => {
            if (!inSet(x.uid, set, max)) return;
            const parts = [`UID ${x.uid}`];
            if (wantSize) parts.push(`RFC822.SIZE ${x.raw.length}`);
            if (items.includes("FLAGS")) parts.push("FLAGS ()");
            if (wantEnv) parts.push(`ENVELOPE ${envelope(x)}`);
            if (wantBody) {
              bodyFetches.push({ folder: selected, uid: x.uid, peek: /BODY\.PEEK\[\]/.test(items) });
              sock.write(`* ${i + 1} FETCH (${parts.join(" ")} BODY[] {${x.raw.length}}\r\n`);
              sock.write(x.raw);
              sock.write(")\r\n");
            } else {
              send(`* ${i + 1} FETCH (${parts.join(" ")})`);
            }
          });
          return send(`${tag} OK FETCH completed`);
        }
        return send(`${tag} BAD unsupported UID ${op}`);
      }
      return send(`${tag} BAD unsupported ${cmd}`);
    }
  });
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  return {
    port: server.address().port,
    log,
    bodyFetches,
    close: () => new Promise((res) => server.close(() => res())),
  };
}
