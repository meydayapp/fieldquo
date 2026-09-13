#!/bin/sh
set -e
cd /Users/emilioboves/StudioProjects/fieldquo
H=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/board-harness
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$H/board.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$H/stubs/link.js \
  --alias:next/navigation=$H/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$H/stubs/useTranslation.js \
  --alias:@/app/providers/PermissionProvider=$H/stubs/permissions.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$H/board.js"
cp /private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/harness/css.mjs ./_css-harness.mjs && node ./_css-harness.mjs $H/app.css; rm -f ./_css-harness.mjs
