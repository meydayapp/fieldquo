#!/bin/sh
# Bundles the queue-console harness (console.jsx + the real SalesShell and
# queue page) into $OUT/console.js and compiles the app's Tailwind into
# $OUT/app.css. Repo-relative since the phone audit (docs/screens/sales-mobile)
# builds it beside the portal harness; it used to point at one session's
# scratchpad.
#   OUT=/tmp/somewhere sh docs/screens/sales-console/harness/build.sh
set -e
cd "$(dirname "$0")/../../../.."
H=docs/screens/sales-console/harness
OUT=${OUT:-/tmp/fq-console-harness}
mkdir -p "$OUT"
NODE_PATH=$PWD/node_modules npx esbuild "$H/console.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=./$H/stubs/link.js \
  --alias:next/navigation=./$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=./$H/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=./$H/stubs/fetchJson.js \
  --alias:@twilio/voice-sdk=./$H/stubs/twilio.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$OUT/console.js"
if [ -z "$SKIP_CSS" ]; then
  cp "$H/css.mjs" ./_css-harness.mjs && node ./_css-harness.mjs "$OUT/app.css"; rm -f ./_css-harness.mjs
fi
cp "$H/console.html" "$OUT/console.html"
cp "$H/mobile.html" "$OUT/mobile.html"
echo "built into $OUT"
