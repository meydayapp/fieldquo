#!/bin/sh
# usage: shot.sh <out.png> <width> <height> "<query>"  — desktop via CDP
node --experimental-websocket /private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/harness/cdp-shot.mjs "$1" "$2" "$3" 1 "file:///private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/hc/console.html?do=1&$4" 2>&1 | grep -v ExperimentalWarning | grep -v "^(Use"
