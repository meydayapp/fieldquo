#!/bin/sh
# usage: shot.sh <out.png> <width> <height> "<query>"  — e.g. "page=pay&lang=fr&scroll=[data-tour=sales-pay] form"
H="$(cd "$(dirname "$0")" && pwd)"
OUT=${OUT:-/tmp/fq-portal-harness}
node --experimental-websocket "$H/cdp-shot.mjs" "$1" "$2" "$3" 1 "file://$OUT/portal.html?do=1&$4" 2>&1 | grep -v ExperimentalWarning | grep -v "^(Use"
