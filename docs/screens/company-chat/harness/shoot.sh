#!/bin/sh
# The ten captures in this folder, from the harness beside this file:
#   sh docs/screens/company-chat/harness/shoot.sh
# build.sh bundles app/components/company/CompanyChat.js with esbuild (the
# Next-only modules aliased to stubs, @/lib/fetchJson to chatFetch.js) and
# compiles app/globals.css; cdp-shot.mjs drives headless Chrome over the
# DevTools protocol with real device emulation for the 375 frames.
set -e
H=$(cd "$(dirname "$0")" && pwd)
OUT=$(dirname "$H")
for s in list job members mention new; do
  node --experimental-websocket "$H/cdp-shot.mjs" "$OUT/$s-1280.png" 1280 900 1 "file://$H/chat.html?scene=$s&do=1"
  node --experimental-websocket "$H/cdp-shot.mjs" "$OUT/$s-375.png" 375 812 2 "file://$H/chat.html?scene=$s&do=1" mobile
done
