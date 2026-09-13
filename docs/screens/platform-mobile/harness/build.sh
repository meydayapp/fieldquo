#!/bin/sh
# Bundles the platform harness (platform.jsx + every real /platform page) into
# $OUT/platform.js and compiles the app's Tailwind into $OUT/app.css.
#   OUT=/tmp/somewhere sh docs/screens/platform-mobile/harness/build.sh
set -e
cd "$(dirname "$0")/../../../.."
H=docs/screens/platform-mobile/harness
OUT=${OUT:-/tmp/fq-platform-harness}
mkdir -p "$OUT"
NODE_PATH=$PWD/node_modules npx esbuild "$H/platform.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=./$H/stubs/link.js \
  --alias:next/navigation=./$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=./$H/stubs/useTranslation.js \
  --alias:@/app/providers/LanguageProvider=./$H/stubs/languageProvider.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$OUT/platform.js"
if [ -z "$SKIP_CSS" ]; then
  cp "$H/css.mjs" ./_css-harness.mjs && node ./_css-harness.mjs "$OUT/app.css"; rm -f ./_css-harness.mjs
fi
cp "$H/platform.html" "$OUT/platform.html"
echo "built into $OUT"
