#!/bin/sh
# usage: mshot.sh <out.png> "<url>"   — a 375x812 phone at 2x
node --experimental-websocket /private/tmp/claude-501/-Users-emilioboves-StudioProjects-fieldquo/6e0c5fd3-e3ee-487d-b256-ca69dbca769e/scratchpad/harness/cdp-shot.mjs "$1" 375 812 2 "$2" mobile 2>&1 | grep -v ExperimentalWarning | grep -v "^(Use"
