#!/bin/sh
# Bundle the real WhatsApp settings card against fixture stubs, then compile
# the app's Tailwind CSS. Output: whatsapp.js + app.css + whatsapp.html in $OUT.
#   OUT=/some/dir sh docs/screens/app-settings/harness/build.sh
set -e
cd "$(dirname "$0")/../../../.."
H=docs/screens/app-settings/harness
OUT=${OUT:-/tmp/fq-whatsapp-harness}
mkdir -p "$OUT"
NODE_PATH=$PWD/node_modules npx esbuild "$H/whatsapp.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=./$H/stubs/link.js \
  --alias:next/navigation=./$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=./$H/stubs/useTranslation.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$OUT/whatsapp.js"
cp "$H/css.mjs" ./_css-harness.mjs && node ./_css-harness.mjs "$OUT/app.css"; rm -f ./_css-harness.mjs
cp "$H/whatsapp.html" "$OUT/whatsapp.html"
echo "built into $OUT"
