#!/bin/sh
# Bundle the real /app/messages page against fixture stubs, then compile the
# app's Tailwind CSS. Output: appmsg.js + app.css beside this script.
set -e
cd /Users/emilioboves/StudioProjects/fieldquo
SP=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/harness/appmsg
NODE_PATH=/Users/emilioboves/StudioProjects/fieldquo/node_modules npx esbuild "$SP/appmsg.jsx" --bundle --format=iife --platform=browser --jsx=automatic --loader:.js=jsx \
  --alias:@=. \
  --alias:next/link=$SP/stubs/link.js \
  --alias:next/navigation=$SP/stubs/navigation.js \
  --alias:@/app/hooks/useTranslation=$SP/stubs/useTranslation.js \
  --alias:@/app/providers/PermissionProvider=$SP/stubs/permission.js \
  --alias:@/app/providers/CompanyPreferencesProvider=$SP/stubs/companyPrefs.js \
  --alias:@/lib/clientErrors=$SP/stubs/clientErrors.js \
  --define:process.env.NODE_ENV='"development"' \
  --define:process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='""' \
  --log-level=warning --outfile="$SP/appmsg.js"
cp $SP/../css.mjs ./_css-harness.mjs && node ./_css-harness.mjs $SP/app.css; rm -f ./_css-harness.mjs
