#!/bin/sh
# Shoots every screenshot in docs/screens/{platform-payouts,platform-reps,sales-settings}.
#   sh docs/screens/platform-payouts/harness/shoot.sh /tmp/payout-harness
set -e
ROOT=/Users/emilioboves/StudioProjects/fieldquo
H=$ROOT/docs/screens/platform-payouts/harness
OUT=${1:-/tmp/payout-harness}
U="file://$OUT/pages.html"
shot() { node --experimental-websocket "$H/cdp-shot.mjs" "$@"; }
D=$ROOT/docs/screens
shot "$D/platform-payouts/payouts-1280.png"       1280 1400 1 "$U?page=payouts&do=1&scene=payouts-form"
shot "$D/platform-payouts/payouts-marked-paid-1280.png" 1280 1400 1 "$U?page=payouts&do=1&scene=payouts-paid"
shot "$D/platform-payouts/payouts-by-month-1280.png" 1280 900 1 "$U?page=payouts&do=1&scene=payouts-month"
shot "$D/platform-payouts/payouts-375.png"        375 1400 2 "$U?page=payouts&do=1&scene=payouts-form" mobile
shot "$D/platform-reps/reps-collapsed-1280.png"   1280 900 1 "$U?page=reps&path=/platform/sales/reps"
shot "$D/platform-reps/reps-open-payments-1280.png" 1280 1500 1 "$U?page=reps&path=/platform/sales/reps&do=1&scene=reps-open#rep-repana"
shot "$D/platform-reps/reps-open-payments-375.png" 375 1500 2 "$U?page=reps&path=/platform/sales/reps&do=1&scene=reps-open#rep-repana" mobile
shot "$D/sales-settings/settings-1280.png"        1280 2300 1 "$U?page=settings&path=/sales/settings"
shot "$D/sales-settings/settings-1280.fr.png"     1280 2300 1 "$U?page=settings&path=/sales/settings&lang=fr"
shot "$D/sales-settings/settings-375.png"         375 2600 2 "$U?page=settings&path=/sales/settings" mobile
