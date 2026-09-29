// lib/media/chunkedUpload.js
//
// Send one large file straight from the browser to Cloudinary in chunks.
// Cloudinary refuses a single upload request over 100 MB ("413 Request entity
// too large"), and a 2:30 4K phone clip is 400 MB–1.1 GB, so a video post's
// clip goes up this way (cloudinary.com/documentation/client_side_uploading,
// "chunked upload"): every chunk is a POST of the SAME signed fields plus
// its slice of the file, tied together by an X-Unique-Upload-Id header and
// placed by a Content-Range header ("bytes <start>-<end>/<total>"). Every
// chunk but the last must be at least 5 MB.
//
// Each chunk is retried a few times with a pause — a phone on a job site
// drops a request now and then, and restarting a gigabyte from zero over one
// dropped chunk is the failure this exists to avoid.
//
// No React. Progress is reported per byte uploaded, across all chunks.

const RETRIES = 3;

function sendChunk({ url, fields, blob, uploadId, start, end, total, onProgress }) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", blob);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("X-Unique-Upload-Id", uploadId);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${total}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(start + Math.min(e.loaded, blob.size));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText || "null");
      } catch {
        // Cloudinary answers JSON; an HTML error page is a failure below.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else {
        const err = new Error(data?.error?.message || `Upload failed (${xhr.status})`);
        err.status = xhr.status;
        err.retryable = xhr.status >= 500 || xhr.status === 429 || xhr.status === 0;
        reject(err);
      }
    };
    xhr.onerror = () => {
      const err = new Error("network");
      err.status = 0;
      err.retryable = true;
      reject(err);
    };
    xhr.send(form);
  });
}

/**
 * @param {File|Blob} file
 * @param {{ url: string, fields: object, chunkBytes: number, onProgress?: (loaded:number,total:number)=>void }} opts
 * @returns {Promise<object>} Cloudinary's answer to the LAST chunk (for an
 *   async upload, `{ status: "pending", ... }` — the result arrives later).
 */
export async function uploadInChunks(file, { url, fields, chunkBytes, onProgress }) {
  const total = file.size;
  const size = Math.max(5 * 1024 * 1024, Number(chunkBytes) || 20 * 1024 * 1024);
  const uploadId = `fq-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  let last = null;
  for (let start = 0; start < total; start += size) {
    const end = Math.min(start + size, total);
    const blob = file.slice(start, end);
    let attempt = 0;
    for (;;) {
      try {
        last = await sendChunk({ url, fields, blob, uploadId, start, end, total, onProgress: (loaded) => onProgress?.(loaded, total) });
        break;
      } catch (err) {
        attempt += 1;
        if (!err.retryable || attempt > RETRIES) throw err;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    onProgress?.(end, total);
  }
  return last;
}
