#!/bin/bash

cd /Users/mjhmatt/roulette

echo "=========================================="
echo "MANUAL DETECTION TEST"
echo "=========================================="
echo ""
echo "Monitoring backend for spin detection..."
echo "This will watch for 2 minutes for spins to be detected"
echo ""

TIMEOUT=120
START_TIME=$(date +%s)
INITIAL_SPINS=$(tail -1 backend/spin_results.csv 2>/dev/null | wc -l || echo "0")

echo "Starting spin count: Checking CSV..."
echo ""

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo ""
        echo "Test timeout reached (2 minutes)"
        break
    fi

    # Check for new spin finished events
    NEW_SPINS=$(grep -c "SPIN FINISHED" backend.log 2>/dev/null || echo "0")

    # Check CSV for new entries
    CURRENT_CSV_LINES=$(wc -l < backend/spin_results.csv 2>/dev/null || echo "0")

    # Show recent activity
    if [ -f backend.log ]; then
        RECENT=$(tail -3 backend.log | grep -E "SPIN FINISHED|PREDICTION MADE" | tail -1)
        if [ ! -z "$RECENT" ]; then
            echo "[$(date +%H:%M:%S)] $RECENT"
        fi
    fi

    sleep 2
done

echo ""
echo "=========================================="
echo "TEST RESULTS"
echo "=========================================="
echo ""

# Count spins detected
SPIN_COUNT=$(grep -c "SPIN FINISHED" backend.log 2>/dev/null || echo "0")
echo "Total spins detected: $SPIN_COUNT"

if [ $SPIN_COUNT -gt 0 ]; then
    echo ""
    echo "Recent spin results:"
    tail -10 backend.log | grep "SPIN FINISHED" | tail -5
    echo ""

    echo "CSV file entries:"
    tail -5 backend/spin_results.csv
    echo ""

    echo "Running accuracy analysis..."
    python3 backend/analyze_results.py
else
    echo ""
    echo "⚠️  No spins detected during test period"
    echo "Check that:"
    echo "  1. Backend is running (check backend.log)"
    echo "  2. Video is playing and visible"
    echo "  3. Wheel is spinning in the video"
    echo ""
    echo "Recent backend activity:"
    tail -10 backend.log
fi

echo ""
echo "=========================================="
