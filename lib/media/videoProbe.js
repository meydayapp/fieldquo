// lib/media/videoProbe.js
//
// Read a clip's shape and length in the browser BEFORE it is uploaded, so a
// video post can (a) refuse a clip over 2:30 before a gigabyte is sent, and
// (b) ask "Fit or Crop?" for a clip that isn't 9:16 so the reshape rides in the
// same Cloudinary pass as the 1080p conversion (lib/marketing/videoPost.js
// "On arrival").
//
// A <video> element's loadedmetadata gives videoWidth, videoHeight (with the
// phone's rotation already applied) and duration without decoding the file.
// Some browsers cannot read some codecs (Chrome and an iPhone's HEVC .mov on
// an older desktop) — then this answers nulls, and the caller says so rather
// than guessing: the clip uploads at a safe size and is trimmed at 2:30 by
// Cloudinary, and the person is told that before choosing to upload.
//
// Browser-only; nothing here is trusted by the server as a fact.

const TIMEOUT_MS = 15_000;

/** @returns {Promise<{ width: number|null, height: number|null, durationSec: number|null }>} */
export function probeVideo(file) {
  const none = { width: null, height: null, durationSec: null };
  if (typeof document === "undefined" || !file) return Promise.resolve(none);
  return new Promise((resolve) => {
    let url = null;
    const video = document.createElement("video");
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        // nothing to release
      }
      if (url) URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(none), TIMEOUT_MS);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const pos = (n) => (Number.isFinite(n) && n > 0 ? n : null);
      finish({ width: pos(video.videoWidth), height: pos(video.videoHeight), durationSec: pos(video.duration) });
    };
    video.onerror = () => finish(none);
    try {
      url = URL.createObjectURL(file);
      video.src = url;
    } catch {
      finish(none);
    }
  });
}
