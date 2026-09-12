#!/bin/sh
set -e
cd /Users/emilioboves/StudioProjects/fieldquo
SP=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/notif
for f in app sales; do
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$SP/$f.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$SP/stubs/link.js \
  --alias:next/navigation=$SP/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$SP/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=$SP/stubs/fetchJson.js \
  --alias:@/lib/notifications/render=$SP/stubs/render.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$SP/$f.js"
done
cp $SP/css.mjs ./_css-harness.mjs && node ./_css-harness.mjs $SP/app.css; rm -f ./_css-harness.mjs
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$SP/settings.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$SP/stubs/link.js \
  --alias:next/navigation=$SP/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$SP/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=$SP/stubs/fetchJsonSettings.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$SP/settings.js"
