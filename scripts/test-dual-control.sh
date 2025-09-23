#!/bin/bash

# Quick test scripts for Eight Sleep dual-side control
# Run these to verify the endpoints work

echo "🧪 Testing Eight Sleep Dual-Side Control Endpoints"
echo "=================================================="

# Make the main script executable
chmod +x ./scripts/eight-sleep-dual-control.sh

echo ""
echo "1️⃣  Testing device status..."
./scripts/eight-sleep-dual-control.sh status

echo ""
echo "2️⃣  Testing temperature settings for both sides..."
./scripts/eight-sleep-dual-control.sh get-temp both

echo ""
echo "3️⃣  Testing turn on both sides..."
./scripts/eight-sleep-dual-control.sh on both

echo ""
echo "4️⃣  Testing manual heating - Left side to 10 for 30 seconds..."
./scripts/eight-sleep-dual-control.sh set-manual left 10 300

echo ""
echo "5️⃣  Testing manual heating - Right side to -5 for 30 seconds..."
./scripts/eight-sleep-dual-control.sh set-manual right -50 300

echo ""
echo "⏳ Waiting 5 seconds..."
sleep 5

echo ""
echo "6️⃣  Checking status after manual heating..."
./scripts/eight-sleep-dual-control.sh get-temp both

echo ""
echo "7️⃣  Testing turn off both sides..."
./scripts/eight-sleep-dual-control.sh off both

echo ""
echo "✅ Test complete! Check the responses above for any errors."
echo ""
echo "💡 If all responses look good, the dual-side control is working!"
echo "   You can now use the main script to control each side independently."
