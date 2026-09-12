#!/bin/sh
# Bundle app/components/company/CompanyChat.js with esbuild, aliasing the
# Next-only modules to harness stubs, and compile app/globals.css.
set -e
cd /Users/emilioboves/StudioProjects/fieldquo
SP=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad
H=$SP/cchat/harness
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$H/chat.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$SP/harness/stubs/link.js \
  --alias:next/navigation=$SP/harness/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$SP/harness/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=$H/chatFetch.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$H/chat.js"
cp $SP/harness/css.mjs ./_css-harness.mjs && node ./_css-harness.mjs $H/app.css; rm -f ./_css-harness.mjs
