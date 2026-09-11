#!/bin/sh
set -e
cd /Users/emilioboves/StudioProjects/fieldquo
SP=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/harness
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$SP/team.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$SP/stubs/link.js \
  --alias:next/navigation=$SP/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$SP/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=$SP/stubs/staffFetch.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$SP/team.js"
cp $SP/css.mjs ./_css-harness.mjs && node ./_css-harness.mjs $SP/app.css; rm -f ./_css-harness.mjs
