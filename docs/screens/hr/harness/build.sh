#!/bin/sh
# Bundle the HR harness against the app-guide harness's stubs (next/link,
# next/navigation, the auth client), then compile the app's Tailwind CSS
# once. Output goes to $OUT (a scratch dir), never into the repo.
set -e
ROOT=/Users/emilioboves/StudioProjects/fieldquo
H=$ROOT/docs/screens/hr/harness
G=$ROOT/docs/screens/app-guide/harness
OUT=${OUT:-/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/hr-harness}
mkdir -p "$OUT"
cd "$ROOT"
NODE_PATH=$ROOT/node_modules npx esbuild "$H/hr.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$G/stubs/link.js \
  --alias:next/navigation=$G/stubs/navigation.js \
  --alias:next/image=$G/stubs/image.js \
  --alias:next/dynamic=$G/stubs/dynamic.js \
  --alias:@/lib/auth-client=$G/stubs/auth-client.js \
  --alias:@/lib/notify/swClient=$G/stubs/swClient.js \
  --define:process.env.NODE_ENV='"development"' \
  --define:process.env.NEXT_PUBLIC_APP_URL='"https://app.fieldquo.com"' \
  --log-level=warning --outfile="$OUT/hr.js"
cp "$H/hr.html" "$OUT/hr.html"
if [ ! -f "$OUT/app.css" ] || [ "$1" = "--css" ]; then
  cp "$G/css.mjs" "$ROOT/_css-harness.mjs" && node "$ROOT/_css-harness.mjs" "$OUT/app.css"; rm -f "$ROOT/_css-harness.mjs"
fi
ls -la "$OUT/hr.js" | awk '{print "bundle bytes", $5}'
