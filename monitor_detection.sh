#!/bin/bash

echo "=========================================="
echo "MONITORING ROULETTE DETECTION"
echo "=========================================="
echo ""
echo "Watching backend.log for detection activity..."
echo "Press Ctrl+C to stop"
echo ""

tail -f backend.log | grep --line-buffered -E "STATUS|DETECTION|BALL DROPPED|PREDICTION MADE|SPIN FINISHED|Ball Found|Wheel Found|Ball RPM|Wheel RPM" | while read line; do
    echo "[$(date +%H:%M:%S)] $line"
done
