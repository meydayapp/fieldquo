#!/bin/sh
# usage: shot.sh <out.png> <app|sales> "<query>" [mobile]
SP=/private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/notif
if [ "$4" = "mobile" ]; then W=375; H=812; S=2; M=mobile; else W=1280; H=800; S=1; M=; fi
node --experimental-websocket $SP/cdp-shot.mjs "$1" $W $H $S "file://$SP/$2.html?do=1&$3" $M 2>&1 | grep -v ExperimentalWarning | grep -v "^(Use"
