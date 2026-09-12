#!/bin/sh
# usage: shot.sh <out.png> <width> <height> "<url>"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=$2,$3 --virtual-time-budget=6000 --screenshot="$1" "$4" 2>/dev/null | grep -v TASK_SUPPRESSION
