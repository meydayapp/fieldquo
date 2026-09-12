#!/bin/sh
# Renders every sales-portal figure the training manual embeds, in the
# three manual languages, into docs/screens/sales-portal/NN-<key>.<lang>.png.
# Run build.sh first. The NN prefix is the manual chapter the figure sits in.
set -e
H="$(cd "$(dirname "$0")" && pwd)"
D="$H/.."
S="$H/shot.sh"
PAY='page=pay&scroll=%5Bdata-tour%3Dsales-pay%5D%20%3E%20section%3Anth-of-type(3)&scrollPad=100'
for L in ${LANGS:-en fr es}; do
  sh "$S" "$D/01-pay-languages.$L.png" 1280 1450 "$PAY&lang=$L"
  sh "$S" "$D/02-demo.$L.png"          1280 1000 "page=demo&lang=$L"
  sh "$S" "$D/06-voicemail.$L.png"     1280 1000 "page=voicemail&lang=$L"
  sh "$S" "$D/08-my-companies.$L.png"  1280 1000 "page=companies&lang=$L"
  sh "$S" "$D/10-today.$L.png"         1280 1500 "page=today&lang=$L"
  sh "$S" "$D/10-my-leads.$L.png"      1280 1000 "page=leads&lang=$L"
  sh "$S" "$D/10-my-lead-detail.$L.png" 1280 1500 "page=lead&lang=$L"
  sh "$S" "$D/10-calendar.$L.png"      1280 1000 "page=calendar&lang=$L"
  sh "$S" "$D/10-notes.$L.png"         1280 1000 "page=notes&lang=$L"
  sh "$S" "$D/10-note-open.$L.png"     1280 1000 "page=note&lang=$L"
  sh "$S" "$D/10-playbook.$L.png"      1280 1000 "page=playbook&lang=$L"
  sh "$S" "$D/10-support.$L.png"       1280 1250 "page=support&lang=$L"
  sh "$S" "$D/10-pay-earnings.$L.png"  1280 1500 "page=pay&lang=$L"
done
