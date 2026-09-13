#!/bin/sh
# Bundle the employee-home harness with esbuild and compile the app's CSS.
#   sh docs/screens/employee-home/harness/build.sh <out-dir>
set -e
ROOT=/Users/emilioboves/StudioProjects/fieldquo
H=$ROOT/docs/screens/employee-home/harness
OUT=${1:-/tmp/employee-home-harness}
mkdir -p "$OUT"
cd "$ROOT"
NODE_PATH=$ROOT/node_modules npx esbuild "$H/home.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$H/stubs/link.js \
  --alias:next/navigation=$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$H/stubs/useTranslation.js \
  --alias:@/app/providers/PermissionProvider=$H/stubs/permissions.js \
  --alias:@/app/providers/CompanyPreferencesProvider=$H/stubs/prefs.js \
  --alias:@/lib/auth-client=$H/stubs/auth-client.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$OUT/home.js"
cp "$H/home.html" "$OUT/home.html"
# app.css: Tailwind v4 compiled from app/globals.css over the whole tree
# (docs/screens/scheduler-board/harness/build.sh does the same).
cp "$H/css.mjs" ./_css-harness.mjs && node ./_css-harness.mjs "$OUT/app.css"; rm -f ./_css-harness.mjs
echo "built $OUT"
