#!/bin/sh
# usage: build.sh <out-dir>   — bundles the real inbox page against the stubs
set -e
ROOT=/Users/emilioboves/StudioProjects/fq-wt-email
H=$ROOT/docs/screens/sales-inbox/harness
OUT=${1:-/tmp/sales-inbox-harness}
mkdir -p "$OUT"
cd $ROOT
NODE_PATH=$ROOT/node_modules npx esbuild "$H/inbox.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$H/stubs/link.js \
  --alias:next/navigation=$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$H/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=$H/stubs/fetchJson.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$OUT/inbox.js"
cp "$H/inbox.html" "$H/actions.js" "$OUT/"
node "$H/css.mjs" "$OUT/app.css"
echo "built into $OUT"
