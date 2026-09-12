#!/bin/sh
# Bundles the three real pages with next/* and the data layer stubbed, and
# compiles app/globals.css. Output goes to $OUT (default: a scratch dir).
#   sh docs/screens/platform-payouts/harness/build.sh /tmp/payout-harness
set -e
ROOT=/Users/emilioboves/StudioProjects/fieldquo
H=$ROOT/docs/screens/platform-payouts/harness
OUT=${1:-/tmp/payout-harness}
mkdir -p "$OUT"
cd $ROOT
NODE_PATH=$ROOT/node_modules npx esbuild "$H/pages.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$H/stubs/link.js \
  --alias:next/navigation=$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$H/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=$H/stubs/fetchJson.js \
  --alias:@/app/providers/LanguageProvider=$H/stubs/languageProvider.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$OUT/pages.js"
cp "$H/pages.html" "$OUT/pages.html"
cp "$H/css.mjs" ./_css-harness.mjs && node ./_css-harness.mjs "$OUT/app.css"; rm -f ./_css-harness.mjs
echo "built $OUT"
