#!/bin/sh
# usage: build.sh <entry.jsx> <out.js>
set -e
cd /Users/emilioboves/StudioProjects/fieldquo
SP=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/harness
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$1" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$SP/stubs/link.js \
  --alias:next/navigation=$SP/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$SP/stubs/useTranslation.js \
  --alias:@/lib/fetchJson=$SP/stubs/fetchJson.js \
  --define:process.env.NODE_ENV='"development"' \
  --log-level=warning --outfile="$2"
