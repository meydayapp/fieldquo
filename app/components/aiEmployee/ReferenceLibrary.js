"use client";

// app/components/aiEmployee/ReferenceLibrary.js
//
// Settings › AI employee › Reference library — what every employee reads:
// the company's policy and notes (text, pasted or uploaded), and its
// manufacturers' manuals (PDF, .xlsx), read page by page.
//
// ── Every control does the thing it says ────────────────────────────────────
//
//   Upload a file     .txt/.md/.csv → read as text (POST multipart, as ever);
//                     .pdf/.xlsx → straight to PRIVATE storage
//                     (uploadFile purpose "reference") and read page by page
//                     by the server (POST { file }).
//   Read N of M pages the server's own count (referencePages.js); unread
//                     pages are named, never hidden behind "ready".
//   Read scanned pages with AI — about X
//                     the price is the server's ceiling (ocrEstimateCents),
//                     shown before the click; the pages are rendered HERE from
//                     the person's own copy (the stored file's SHA-256 must
//                     match, or nothing is sent) and posted four at a time.
//   Extract error codes — about X
//                     the server's price from the same pages it will read;
//                     the codes arrive "not checked yet" for the owner below.
//   Tags              brand / model / equipment / trade — what the retrieval
//                     ranks a manual by for a client who has that equipment.
//   Looks right / Don't use / Use again / Edit
//                     the owner's decision on each extracted code, saved.

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, Trash2, ScanText, ListChecks, Tag, Check, X, ExternalLink, Pencil } from "lucide-react";
import { uploadFile } from "@/lib/media/uploadClient";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { formatAppMoney } from "@/lib/format/money";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";
import { pageRanges, ocrBatches, MAX_REFERENCE_PAGES, OCR_RENDER_WIDTH_PX } from "@/lib/aiEmployee/referencePages";
import { renderPagesAsJpeg, fileSha256 } from "@/app/components/planRead/pdfPages";

const LIBRARY_EXTENSIONS = ["pdf", "xlsx"];
const ext = (name) => String(name || "").toLowerCase().split(".").pop();
/** A copy of `obj` without `key` — closing an editor. */
const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

export default function ReferenceLibrary({ t, language, sources, sourceKinds = [], reload, ui }) {
  const { FIELD, BTN_PRIMARY, BTN_QUIET } = ui;
  const fileInput = useRef(null);
  const repick = useRef(null);
  // The File each manual was uploaded from, kept for this visit so "Read
  // scanned pages" needs no second pick. Gone on reload — then the person
  // picks the same PDF again and its hash is checked.
  const files = useRef(new Map());
  const pendingRepick = useRef(null);
  const [busy, setBusy] = useState(null); // { id, what, done, total }
  const [note, setNote] = useState(null); // { id, text }
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState({ title: "", kind: "policy", text: "" });
  const [codes, setCodes] = useState([]);
  const [openCodes, setOpenCodes] = useState({});
  const [tagDraft, setTagDraft] = useState({});
  const [editCode, setEditCode] = useState({});

  const credits = (cents) => t("app.planRead.credits", "{n} credits ({money})", { n: cents, money: formatAppMoney(cents / 100, CREDIT_CURRENCY, language) });

  const loadCodes = useCallback(async () => {
    const res = await fetch("/api/ai-employee/codes");
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.reference.codesLoadError", "Couldn't load the error codes."));
      return;
    }
    setCodes((await res.json()).codes || []);
  }, [t]);

  useEffect(() => {
    loadCodes().catch(() => showError(t("app.aiEmployee.reference.codesLoadError", "Couldn't load the error codes.")));
  }, [loadCodes, t]);

  async function upload(file) {
    if (!file) return;
    setBusy({ id: "upload", what: "upload" });
    try {
      if (LIBRARY_EXTENSIONS.includes(ext(file.name))) {
        let entry;
        try {
          entry = await uploadFile(file, { purpose: "reference" });
        } catch (err) {
          showError(err?.message || t("app.aiEmployee.uploadError", "Couldn't add that file."));
          return;
        }
        setBusy({ id: "upload", what: "reading" });
        const res = await fetch("/api/ai-employee/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: { url: entry.url, filename: file.name, mimeType: file.type || entry.mimeType || null, bytes: file.size },
            title: file.name,
            kind: ext(file.name) === "pdf" ? "manual" : "other",
          }),
        });
        if (!res.ok) {
          await reportResponseError(res, t("app.aiEmployee.uploadError", "Couldn't add that file."));
          return;
        }
        const { source } = await res.json();
        if (source?.id) files.current.set(source.id, file);
      } else {
        const body = new FormData();
        body.append("file", file);
        body.append("kind", "manual");
        body.append("title", file.name);
        const res = await fetch("/api/ai-employee/sources", { method: "POST", body });
        if (!res.ok) {
          await reportResponseError(res, t("app.aiEmployee.uploadError", "Couldn't add that file."));
          return;
        }
      }
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function addPaste() {
    if (!paste.text.trim()) return;
    const res = await fetch("/api/ai-employee/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paste),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.uploadError", "Couldn't add that file."));
      return;
    }
    setPaste({ title: "", kind: "policy", text: "" });
    setPasteOpen(false);
    await reload();
  }

  async function removeSource(id) {
    const res = await fetch(`/api/ai-employee/sources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.deleteError", "Couldn't remove that."));
      return;
    }
    files.current.delete(id);
    await Promise.all([reload(), loadCodes()]);
  }

  async function saveTags(s) {
    const draft = tagDraft[s.id] || s.tags || {};
    const res = await fetch(`/api/ai-employee/sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: draft }),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.reference.saveTagsError", "Couldn't save the tags."));
      return;
    }
    setTagDraft((d) => without(d, s.id));
    setNote({ id: s.id, text: t("app.aiEmployee.reference.tagsSaved", "Saved") });
    await reload();
  }

  // ── Read scanned pages with AI ─────────────────────────────────────────
  async function readScanned(s, picked = null) {
    const file = picked || files.current.get(s.id);
    if (!file) {
      // Not uploaded on this visit — ask for the same PDF again.
      pendingRepick.current = s;
      setNote({ id: s.id, text: t("app.aiEmployee.reference.ocrPickAgain", "Choose the same PDF again — the scanned pages are read from your copy.") });
      repick.current?.click();
      return;
    }
    const hash = await fileSha256(file);
    if (s.fileHash && hash !== s.fileHash) {
      showError(t("app.aiEmployee.reference.ocrWrongFile", "That isn't the same file. Pick the PDF you uploaded as \"{title}\".", { title: s.title }));
      return;
    }
    files.current.set(s.id, file);
    const pages = [...(s.unreadPages || [])];
    let done = 0;
    let readCount = 0;
    setBusy({ id: s.id, what: "ocr", done, total: pages.length });
    try {
      for (const batch of ocrBatches(pages)) {
        const images = [];
        await renderPagesAsJpeg(file, batch, {
          width: OCR_RENDER_WIDTH_PX,
          onPage: (page, base64) => {
            images.push({ page, mimeType: "image/jpeg", base64 });
          },
        });
        const res = await fetch(`/api/ai-employee/sources/${s.id}/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileHash: hash, pages: images }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showError(
            err?.error === "no_credit"
              ? t("app.aiEmployee.reference.noCredit", "Not enough AI credit for this. Top up and try again.")
              : err?.error === "wrong_file"
                ? t("app.aiEmployee.reference.ocrWrongFile", "That isn't the same file. Pick the PDF you uploaded as \"{title}\".", { title: s.title })
                : t("app.aiEmployee.reference.ocrError", "Reading the scanned pages stopped. What was read is kept — try again for the rest."),
          );
          return;
        }
        const out = await res.json();
        readCount += Number(out.read) || 0;
        done += batch.length;
        setBusy({ id: s.id, what: "ocr", done, total: pages.length });
      }
      setNote({ id: s.id, text: t("app.aiEmployee.reference.ocrDone", "Read {n} more pages.", { n: readCount }) });
    } catch {
      showError(t("app.aiEmployee.reference.ocrError", "Reading the scanned pages stopped. What was read is kept — try again for the rest."));
    } finally {
      setBusy(null);
      await reload();
    }
  }

  // ── Extract error codes ────────────────────────────────────────────────
  async function extract(s) {
    if (!s.tags?.brand) {
      setTagDraft((d) => ({ ...d, [s.id]: { ...(s.tags || {}) } }));
      showError(t("app.aiEmployee.reference.codesNeedBrand", "Add the brand tag first — a code means different things on different brands."));
      return;
    }
    setBusy({ id: s.id, what: "codes" });
    try {
      const res = await fetch(`/api/ai-employee/sources/${s.id}/codes`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showError(
          err?.error === "no_credit"
            ? t("app.aiEmployee.reference.noCredit", "Not enough AI credit for this. Top up and try again.")
            : t("app.aiEmployee.reference.codesError", "Couldn't extract codes from this manual."),
        );
        return;
      }
      const out = await res.json();
      setNote({
        id: s.id,
        text:
          out.reason === "no_candidates"
            ? t("app.aiEmployee.reference.codesNone", "No pages in this manual look like an error-code table.")
            : t("app.aiEmployee.reference.codesDone", "Found {n} codes. Check them below.", { n: out.created }),
      });
      setOpenCodes((o) => ({ ...o, [s.id]: true }));
    } finally {
      setBusy(null);
      await Promise.all([reload(), loadCodes()]);
    }
  }

  async function decide(code, body) {
    const res = await fetch(`/api/ai-employee/codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.aiEmployee.reference.codeSaveError", "Couldn't save that."));
      return;
    }
    setEditCode((e) => without(e, code.id));
    await loadCodes();
  }

  const statusLine = (s) => {
    if (s.pageCount) {
      const parts = [t("app.aiEmployee.reference.pagesRead", "Read {read} of {total} pages", { read: s.pagesRead ?? 0, total: s.pageCount })];
      const looked = Math.min(s.pageCount, MAX_REFERENCE_PAGES);
      if ((s.pagesRead ?? 0) + (s.unreadPages?.length || 0) < looked) parts.push(t("app.aiEmployee.reference.someBlank", "the other pages have no text on them"));
      return parts.join(" · ");
    }
    return s.status === "ready" ? t("app.aiEmployee.sourceReady", "read, about {n} tokens", { n: s.tokenCount }) : "";
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {t(
          "app.aiEmployee.formatsHonest",
          "Upload a PDF manual, an .xlsx or .csv code list, or plain text (.txt, .md), or paste text in. PDFs are read page by page and stored privately — never shown to your clients. Scanned pages can't be read for free: you'll see which ones, and can have them read with AI. Word files can't be read yet — paste the text or export it as .txt.",
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {t("app.aiEmployee.reference.tagsHint", "Tag a manual with the brand and model it covers, and it's read first for a client who has that equipment.")}
      </p>

      <div className="flex flex-wrap gap-3 mt-4">
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept=".pdf,.xlsx,.txt,.md,.markdown,.csv,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={repick}
          type="file"
          className="hidden"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            const s = pendingRepick.current;
            pendingRepick.current = null;
            if (f && s) readScanned(s, f);
          }}
        />
        <button type="button" className={BTN_QUIET} disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}>
          <Upload size={15} /> {t("app.aiEmployee.uploadFile", "Upload a file")}
        </button>
        <button type="button" className={BTN_QUIET} onClick={() => setPasteOpen((v) => !v)}>
          <FileText size={15} /> {t("app.aiEmployee.pasteText", "Paste text instead")}
        </button>
      </div>
      {busy?.id === "upload" && (
        <p className="text-sm text-muted-foreground mt-2" role="status">
          {busy.what === "reading" ? t("app.aiEmployee.reference.reading", "Reading every page…") : t("app.aiEmployee.reference.uploading", "Uploading…")}
        </p>
      )}

      {pasteOpen && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
          <input className={FIELD} placeholder={t("app.aiEmployee.pasteTitle", "What is this? e.g. Warranty policy")} value={paste.title} onChange={(e) => setPaste((p) => ({ ...p, title: e.target.value }))} />
          <select className={FIELD} value={paste.kind} onChange={(e) => setPaste((p) => ({ ...p, kind: e.target.value }))}>
            {sourceKinds.map((k) => (
              <option key={k} value={k}>
                {t(`app.aiEmployee.kind.${k}`, k)}
              </option>
            ))}
          </select>
          <textarea className={`${FIELD} min-h-[160px]`} value={paste.text} onChange={(e) => setPaste((p) => ({ ...p, text: e.target.value }))} />
          <button type="button" className={BTN_PRIMARY} onClick={addPaste}>
            {t("app.aiEmployee.pasteAdd", "Add it")}
          </button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {sources.length === 0 && (
          <li className="text-sm text-muted-foreground">
            {t("app.aiEmployee.noMaterial", "Nothing yet. Without material it answers from your instructions and your price book only — which is fine for a receptionist and not enough for a troubleshooter.")}
          </li>
        )}
        {sources.map((s) => {
          const mine = codes.filter((c) => c.sourceId === s.id);
          const draft = tagDraft[s.id];
          const working = busy?.id === s.id;
          return (
            <li key={s.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground break-words">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`app.aiEmployee.kind.${s.kind}`, s.kind)}
                    {statusLine(s) ? ` · ${statusLine(s)}` : ""}
                    {[s.tags?.brand, s.tags?.modelPattern, s.tags?.category].filter(Boolean).length ? ` · ${[s.tags.brand, s.tags.modelPattern, s.tags.category].filter(Boolean).join(" ")}` : ""}
                  </p>
                  {s.unreadPages?.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      {t("app.aiEmployee.reference.unreadPages", "Couldn't read pages {pages} (scanned)", { pages: pageRanges(s.unreadPages) })}
                    </p>
                  )}
                  {s.pageCount > MAX_REFERENCE_PAGES && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      {t("app.aiEmployee.reference.skippedPages", "Pages after {max} weren't read — split the PDF to add the rest.", { max: MAX_REFERENCE_PAGES })}
                    </p>
                  )}
                  {s.status === "failed" && s.failureReason && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t(s.failureReason, "We couldn't read this one.")}</p>
                  )}
                  {note?.id === s.id && <p className="text-xs text-muted-foreground mt-1" role="status">{note.text}</p>}
                  {working && busy.what === "ocr" && (
                    <p className="text-xs text-muted-foreground mt-1" role="status">
                      {t("app.aiEmployee.reference.ocrProgress", "Reading page {done} of {total}…", { done: Math.min(busy.done + 1, busy.total), total: busy.total })}
                    </p>
                  )}
                  {working && busy.what === "codes" && (
                    <p className="text-xs text-muted-foreground mt-1" role="status">{t("app.aiEmployee.reference.codesWorking", "Looking for error codes…")}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {s.stored && (
                    <a className={BTN_QUIET} href={`/api/ai-employee/sources/${s.id}/file`} target="_blank" rel="noreferrer" aria-label={t("app.aiEmployee.reference.open", "Open the file")}>
                      <ExternalLink size={15} />
                    </a>
                  )}
                  <button type="button" className={BTN_QUIET} onClick={() => removeSource(s.id)} aria-label={t("app.aiEmployee.removeSource", "Remove")}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {s.stored && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {s.unreadPages?.length > 0 && s.pageCount > 0 && (
                    <button type="button" className={BTN_QUIET} disabled={Boolean(busy)} onClick={() => readScanned(s)}>
                      <ScanText size={15} />
                      {t("app.aiEmployee.reference.ocrButton", "Read scanned pages with AI — about {credits}", { credits: credits(s.ocrEstimateCents) })}
                    </button>
                  )}
                  {s.codeExtractEstimateCents > 0 && (
                    <button type="button" className={BTN_QUIET} disabled={Boolean(busy)} onClick={() => extract(s)}>
                      <ListChecks size={15} />
                      {t("app.aiEmployee.reference.codesButton", "Extract error codes — about {credits}", { credits: credits(s.codeExtractEstimateCents) })}
                    </button>
                  )}
                  {mine.length > 0 && (
                    <button type="button" className={BTN_QUIET} onClick={() => setOpenCodes((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                      {t("app.aiEmployee.reference.codesCount", "{n} error codes", { n: mine.length })}
                    </button>
                  )}
                </div>
              )}
              <div className="mt-2">
                <button type="button" className={BTN_QUIET} onClick={() => setTagDraft((d) => (d[s.id] ? without(d, s.id) : { ...d, [s.id]: { ...(s.tags || {}) } }))}>
                  <Tag size={15} /> {t("app.aiEmployee.reference.tags", "Tags")}
                </button>
              </div>

              {draft && (
                <div className="grid gap-2 sm:grid-cols-2 mt-3">
                  {[
                    ["brand", t("app.aiEmployee.reference.tagBrand", "Brand")],
                    ["modelPattern", t("app.aiEmployee.reference.tagModel", "Model (or how it starts)")],
                    ["category", t("app.aiEmployee.reference.tagCategory", "Equipment, e.g. furnace")],
                    ["trade", t("app.aiEmployee.reference.tagTrade", "Trade")],
                  ].map(([key, label]) => (
                    <label key={key} className="text-xs text-muted-foreground">
                      {label}
                      <input className={FIELD} value={draft[key] || ""} onChange={(e) => setTagDraft((d) => ({ ...d, [s.id]: { ...d[s.id], [key]: e.target.value } }))} />
                    </label>
                  ))}
                  <div className="sm:col-span-2">
                    <button type="button" className={BTN_PRIMARY} onClick={() => saveTags(s)}>
                      <Check size={15} /> {t("app.aiEmployee.reference.saveTags", "Save tags")}
                    </button>
                  </div>
                </div>
              )}

              {openCodes[s.id] && mine.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("app.aiEmployee.reference.codesHint", "Read from this manual by AI. Until you mark one as right, the assistant only uses it while naming the manual and page. Your codes are used before FieldQuo's own.")}
                  </p>
                  <ul className="space-y-2">
                    {mine.map((c) => (
                      <li key={c.id} className={`text-sm rounded-lg border border-border p-2 ${c.rejected ? "opacity-60" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-foreground">{c.code}</span>
                          {c.page ? <span className="text-xs text-muted-foreground">{t("app.aiEmployee.reference.codePage", "p.{page}", { page: c.page })}</span> : null}
                          <span className="text-xs text-muted-foreground">{t(`app.aiEmployee.reference.urgency.${c.urgency}`, c.urgency)}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.rejected
                              ? t("app.aiEmployee.reference.codeRejected", "not used")
                              : c.reviewed
                                ? t("app.aiEmployee.reference.codeReviewed", "checked")
                                : t("app.aiEmployee.reference.codeUnreviewed", "not checked yet")}
                          </span>
                        </div>
                        {editCode[c.id] !== undefined ? (
                          <div className="mt-2 space-y-2">
                            <textarea className={`${FIELD} min-h-[80px]`} value={editCode[c.id]} onChange={(e) => setEditCode((x) => ({ ...x, [c.id]: e.target.value }))} />
                            <button type="button" className={BTN_PRIMARY} onClick={() => decide(c, { meaning: editCode[c.id], action: "review" })}>
                              <Check size={15} /> {t("app.aiEmployee.reference.codeSave", "Save")}
                            </button>
                          </div>
                        ) : (
                          <p className="text-foreground mt-1">{c.meaning}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {!c.rejected && !c.reviewed && (
                            <button type="button" className={BTN_QUIET} onClick={() => decide(c, { action: "review" })}>
                              <Check size={15} /> {t("app.aiEmployee.reference.codeReview", "Looks right")}
                            </button>
                          )}
                          {!c.rejected && (
                            <button type="button" className={BTN_QUIET} onClick={() => setEditCode((x) => ({ ...x, [c.id]: c.meaning }))}>
                              <Pencil size={15} /> {t("app.aiEmployee.reference.codeEdit", "Edit")}
                            </button>
                          )}
                          {c.rejected ? (
                            <button type="button" className={BTN_QUIET} onClick={() => decide(c, { action: "restore" })}>
                              {t("app.aiEmployee.reference.codeRestore", "Use again")}
                            </button>
                          ) : (
                            <button type="button" className={BTN_QUIET} onClick={() => decide(c, { action: "reject" })}>
                              <X size={15} /> {t("app.aiEmployee.reference.codeReject", "Don't use")}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
