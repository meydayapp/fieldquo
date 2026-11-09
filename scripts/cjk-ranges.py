# scripts/cjk-ranges.py
#
#   python3 scripts/cjk-ranges.py ksx1001
#   python3 scripts/cjk-ranges.py gb2312-1 --count
#
# Prints a pyftsubset `--unicodes=` range list for one of the standard "common
# character" sets. Called by scripts/build-pdf-fonts.mjs.
#
# ── Why a derivation and not a 14 KB literal ───────────────────────────────
#
# A CJK face cannot ship whole: Noto Sans KR's 11,172 precomposed Hangul
# syllables are 2.7 MB per weight, and the full CJK Unified Ideographs block is
# 7.3 MB. Both have to be cut to a defensible subset, and "defensible" is the
# operative word — an arbitrary hand-picked list is a silent decision about
# whose name renders.
#
# These sets are the national standards, so the choice is auditable, and both
# are derivable from codecs that ship with CPython. That beats pasting a
# generated list of code points into the build script, where the ranges would
# be 14 KB of hex nobody can check and nobody can regenerate.
#
# The alternative considered and rejected was subsetting to the characters
# lib/i18n/documentLabels.js happens to use. That is wrong for the same reason
# build-pdf-fonts.mjs gives for the Latin ranges: a quote is mostly free text
# the contractor typed — the client's name, the job address — and the label
# catalogue is the floor a check asserts on, never the ceiling.

import sys


def ksx1001():
    """The 2,350 precomposed Hangul syllables of KS X 1001.

    Python's `euc_kr` codec is EUC-KR *plus* the UHC/cp949 extension, so "does
    it encode?" matches all 11,172 syllables and is not a discriminator. The
    KS X 1001 Hangul block proper is rows 16-40 of the standard: lead byte
    0xB0-0xC8 with a trail byte in the 0xA1-0xFE column range. The 8,822
    extension syllables encode outside that rectangle.

    2,350 syllables covers essentially all modern running Korean. The gap is
    rare given names, loanword transcriptions and onomatopoeia; those fall back
    to a blank box, which is the documented trade in lib/documents/pdfFont.js.
    """
    out = []
    for cp in range(0xAC00, 0xD7A4):
        try:
            enc = chr(cp).encode("euc_kr")
        except UnicodeEncodeError:
            continue
        if len(enc) == 2 and 0xB0 <= enc[0] <= 0xC8 and 0xA1 <= enc[1] <= 0xFE:
            out.append(cp)
    return out


def gb2312(level):
    """Common simplified Hanzi, by GB 2312 level.

    Level 1 is the 3,755 most frequent characters (rows 0xB0-0xD7, ordered by
    frequency then by pinyin); level 1+2 is 6,763. Restricted to CJK Unified
    Ideographs so GB 2312's punctuation, kana and Cyrillic rows stay out — the
    CJK furniture the face needs is listed explicitly in build-pdf-fonts.mjs
    instead, where it can be commented.

    Unused while Mandarin is held back for size; see the note in
    scripts/build-pdf-fonts.mjs for the measured numbers and the enable path.
    """
    out = []
    for cp in range(0x4E00, 0xA000):
        try:
            enc = chr(cp).encode("gb2312")
        except UnicodeEncodeError:
            continue
        if len(enc) != 2:
            continue
        if level == 1 and not (0xB0 <= enc[0] <= 0xD7):
            continue
        out.append(cp)
    return out


def ranges(cps):
    """Collapse sorted code points into `U+XXXX` / `U+XXXX-YYYY` runs."""
    spans = []
    start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        spans.append((start, prev))
        start = prev = cp
    spans.append((start, prev))
    return ",".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in spans)


SETS = {
    "ksx1001": lambda: ksx1001(),
    "gb2312-1": lambda: gb2312(1),
    "gb2312-12": lambda: gb2312(0),
}

if len(sys.argv) < 2 or sys.argv[1] not in SETS:
    raise SystemExit(f"usage: cjk-ranges.py <{'|'.join(SETS)}> [--count]")

cps = SETS[sys.argv[1]]()

# The counts are the assertion: 2,350 / 3,755 / 6,763 are published figures, so
# a codec table that ever shifts underneath this shows up as a wrong number
# rather than as a silently smaller font.
EXPECTED = {"ksx1001": 2350, "gb2312-1": 3755, "gb2312-12": 6763}
if len(cps) != EXPECTED[sys.argv[1]]:
    raise SystemExit(
        f"{sys.argv[1]}: derived {len(cps)} code points, expected {EXPECTED[sys.argv[1]]}"
    )

print(len(cps) if "--count" in sys.argv else ranges(cps))
