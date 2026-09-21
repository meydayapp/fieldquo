#!/bin/sh
# Shoots the three frames into docs/screens/sales-performance/. Run from the repo root.
#   sh docs/screens/sales-performance/harness/shoot.sh /tmp/perf-harness
set -e
ROOT=$(pwd)
H=$ROOT/docs/screens/sales-performance/harness
OUT=${1:-/tmp/perf-harness}
U="file://$OUT/pages.html"
D=$ROOT/docs/screens/sales-performance
shot() { node --experimental-websocket "$H/cdp-shot.mjs" "$@" 2>&1 | grep -v ExperimentalWarning | grep -v "^(Use"; }
shot "$D/platform-performance-1600.png" 1600 2700 1 "$U?page=platform&path=/platform/sales/performance&do=1"
shot "$D/agency-performance-1600.png"   1600 2000 1 "$U?page=agency&path=/sales/agency/performance&do=1"
shot "$D/agency-call-quality-1280.png"  1280 700 1 "$U?page=quality&path=/sales/agency/call-quality&do=1"
