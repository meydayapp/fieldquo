#!/bin/sh
# Bundle every screen in screens.js against the harness stubs, then compile
# the app's Tailwind CSS. Output goes to $OUT (default: a scratch dir), never
# into the repo — the PNGs are the artefact, not the bundle.
set -e
ROOT=/Users/emilioboves/StudioProjects/fieldquo
H=$ROOT/docs/screens/app-guide/harness
OUT=${OUT:-/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/app-guide}
mkdir -p "$OUT"
cd "$ROOT"
node "$H/gen-pages.mjs"
NODE_PATH=$ROOT/node_modules npx esbuild "$H/guide.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$H/stubs/link.js \
  --alias:next/navigation=$H/stubs/navigation.js \
  --alias:next/image=$H/stubs/image.js \
  --alias:next/dynamic=$H/stubs/dynamic.js \
  --alias:@/lib/auth-client=$H/stubs/auth-client.js \
  --alias:@/lib/notify/swClient=$H/stubs/swClient.js \
  --define:process.env.NODE_ENV='"development"' \
  --define:process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='""' \
  --define:process.env.NEXT_PUBLIC_APP_URL='"https://app.fieldquo.com"' \
  --log-level=warning --outfile="$OUT/guide.js"
cp "$H/guide.html" "$OUT/guide.html"
if [ ! -f "$OUT/app.css" ] || [ "$1" = "--css" ]; then
  cp "$H/css.mjs" "$ROOT/_css-harness.mjs" && node "$ROOT/_css-harness.mjs" "$OUT/app.css"; rm -f "$ROOT/_css-harness.mjs"
fi
ls -la "$OUT/guide.js" | awk '{print "bundle bytes", $5}'
