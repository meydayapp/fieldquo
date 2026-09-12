#!/bin/sh
set -e
cd /Users/emilioboves/StudioProjects/fieldquo
SP=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/harness
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$SP/review/review.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$SP/stubs/link.js \
  --alias:next/navigation=$SP/review/navigation.js \
  --alias:@/lib/fetchJson=$SP/review/reviewFetch.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$SP/review/review.js"
