// lib/sales/calls/wavChannels.js
//
// Split a stereo WAV into two mono WAVs. That is all it does.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// A sales call is recorded dual-channel (lib/sales/calls/recording.js): rep
// on one track, contractor on the other. The transcription model takes one
// file and returns one stream of text with no idea who spoke. Handing it the
// stereo file mixes both voices into one transcript, which is exactly the
// thing the owner cannot use — the question is what the REP said. Handing it
// each track separately returns two transcripts that each know their speaker,
// and lib/sales/calls/transcribe.js merges them by time.
//
// Written by hand rather than pulled in as a dependency because the format
// Twilio produces is fixed — RIFF, PCM, 16-bit, 8 kHz, two channels — and a
// general audio library would be ten thousand lines to read forty. It refuses
// anything else in words rather than producing noise.

/**
 * @param {Buffer} wav
 * @returns {{ ok: true, sampleRate: number, seconds: number, channels: Buffer[] }
 *         | { ok: false, reason: string }}
 */
export function splitWavChannels(wav) {
  if (!Buffer.isBuffer(wav) || wav.length < 44) return { ok: false, reason: "not a WAV file (too short)" };
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    return { ok: false, reason: "not a RIFF/WAVE file" };
  }

  let fmt = null;
  let data = null;
  let at = 12;
  // Chunks are [id:4][size:4][body:size], padded to an even byte. Twilio's
  // files carry "fmt " then "data"; a LIST chunk in between is skipped like
  // any other.
  while (at + 8 <= wav.length) {
    const id = wav.toString("ascii", at, at + 4);
    const size = wav.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === "fmt ") {
      if (size < 16) return { ok: false, reason: "fmt chunk too short" };
      fmt = {
        format: wav.readUInt16LE(body),
        channels: wav.readUInt16LE(body + 2),
        sampleRate: wav.readUInt32LE(body + 4),
        bitsPerSample: wav.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = { start: body, length: Math.min(size, wav.length - body) };
      break;
    }
    at = body + size + (size % 2);
  }
  if (!fmt) return { ok: false, reason: "no fmt chunk" };
  if (!data) return { ok: false, reason: "no data chunk" };
  if (fmt.format !== 1) return { ok: false, reason: `not PCM (format ${fmt.format})` };
  if (fmt.bitsPerSample !== 16) return { ok: false, reason: `${fmt.bitsPerSample}-bit samples; only 16-bit is handled` };
  if (fmt.channels < 1 || fmt.channels > 2) return { ok: false, reason: `${fmt.channels} channels` };

  const bytesPerSample = 2;
  const frameBytes = bytesPerSample * fmt.channels;
  const frames = Math.floor(data.length / frameBytes);
  const seconds = fmt.sampleRate > 0 ? frames / fmt.sampleRate : 0;

  const channels = [];
  for (let c = 0; c < fmt.channels; c += 1) {
    const pcm = Buffer.alloc(frames * bytesPerSample);
    for (let f = 0; f < frames; f += 1) {
      const src = data.start + f * frameBytes + c * bytesPerSample;
      pcm[f * 2] = wav[src];
      pcm[f * 2 + 1] = wav[src + 1];
    }
    channels.push(monoWav(pcm, fmt.sampleRate));
  }
  return { ok: true, sampleRate: fmt.sampleRate, seconds, channels };
}

/** A minimal 16-bit mono PCM WAV around raw samples. */
export function monoWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * True when a track is silence end to end — a channel nobody spoke on. Sent
 * to the model it would cost a transcription and return nothing, or worse,
 * hallucinate a sentence out of line noise. Threshold is in 16-bit sample
 * units; 8 kHz telephone line noise sits well under 200.
 */
export function isSilentWav(wav, { threshold = 200 } = {}) {
  if (!Buffer.isBuffer(wav) || wav.length <= 44) return true;
  let peak = 0;
  for (let i = 44; i + 1 < wav.length; i += 2) {
    const v = Math.abs(wav.readInt16LE(i));
    if (v > peak) peak = v;
    if (peak >= threshold) return false;
  }
  return true;
}

/**
 * Silence the given second-ranges of a 16-bit mono WAV, in place on a
 * copy. What hold music is turned into before the model hears it: with
 * supervision on, the contractor's leg is the one recorded, and while
 * they are on hold the "rep" track carries Twilio's music
 * (lib/sales/calls/supervision.js). A transcription model handed music
 * invents words; handed silence it returns nothing. The ranges come from
 * the HOLD/UNHOLD rows, measured from the recording's own start.
 *
 * @param {Buffer} wav       a monoWav() buffer (44-byte header, 16-bit PCM)
 * @param {{start:number,end:number}[]} ranges  seconds from the start
 * @param {number} sampleRate
 */
export function silenceRanges(wav, ranges = [], sampleRate = 8000) {
  if (!Buffer.isBuffer(wav) || wav.length <= 44) return wav;
  const out = Buffer.from(wav);
  const frames = Math.floor((out.length - 44) / 2);
  for (const r of Array.isArray(ranges) ? ranges : []) {
    const a = Math.max(0, Math.floor((Number(r?.start) || 0) * sampleRate));
    const b = Math.min(frames, Math.ceil((Number(r?.end) || 0) * sampleRate));
    if (b <= a) continue;
    out.fill(0, 44 + a * 2, 44 + b * 2);
  }
  return out;
}
