#!/bin/bash
# Double-click this file in Finder to launch the FUSE portfolio + admin.
cd "$(dirname "$0")" || exit 1

# Open the portfolio in your browser once the server is up.
( sleep 1.5; open "http://localhost:8080" ) &

echo "Starting FUSE portfolio backend…"
echo "Leave this window open. Press Ctrl+C here to stop the server."
python3 fuse_server.py
