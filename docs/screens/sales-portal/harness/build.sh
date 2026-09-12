#!/bin/sh
# Bundles the portal harness (portal.jsx + the real components) into
# $OUT/portal.js and compiles the app's Tailwind into $OUT/app.css.
#   OUT=/tmp/somewhere sh docs/screens/sales-portal/harness/build.sh
set -e
cd "$(dirname "$0")/../../../.."
H=docs/screens/sales-portal/harness
OUT=${OUT:-/tmp/fq-portal-harness}
mkdir -p "$OUT"
NODE_PATH=$PWD/node_modules npx esbuild "$H/portal.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=./$H/stubs/link.js \
  --alias:next/navigation=./$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=./$H/stubs/useTranslation.js \
  --alias:@/app/providers/LanguageProvider=./$H/stubs/languageProvider.js \
  --alias:@twilio/voice-sdk=./$H/stubs/twilio.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$OUT/portal.js"
cp "$H/css.mjs" ./_css-harness.mjs && node ./_css-harness.mjs "$OUT/app.css"; rm -f ./_css-harness.mjs
cp "$H/portal.html" "$OUT/portal.html"
echo "built into $OUT"
