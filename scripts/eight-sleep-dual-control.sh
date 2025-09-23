#!/bin/bash

# Eight Sleep Dual-Side Control Scripts
# Usage: ./eight-sleep-dual-control.sh [command] [side] [level]

# Configuration
ACCESS_TOKEN="eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyODE4N2UwNWU3NWJlZGQyNTRjMmVlNWZkMDMzOTdlZSIsImlzcyI6ImVpZ2h0OnYxIiwiYXVkIjoiMDg5NGM3ZjMzYmI5NDgwMGEwM2YxZjRkZjEzYTRmMzgiLCJzdWIiOiIwNTJhZDRlNjYzN2U0OGVhYWRkNWMzMTUxMmRlMjY1YyIsImV4cCI6MTc1ODczNzA0MCwic2NvIjpbInJlYWRfc2xlZXAiLCJ3cml0ZV9zbGVlcCIsInJlYWRfZGV2aWNlIiwid3JpdGVfZGV2aWNlIl0sInR5cCI6ImF1dGgiLCJ2ZXIiOjEsImVpZ2h0RmllbGRzIjp7fSwiaWF0IjoxNzU4NjUwNjQwfQ.fthgfk8RXAqZE1tKolipe7EEKpbB598cO8OQQUkbSjYrCi7uf6J2lM1GJJ2NpsW4ZtSdsPzCnI_UUxiRcXgxTA"
DEVICE_ID="1dba969ef54f2b40017b497ad1ae77bf9be95c86"
LEFT_USER_ID="e65df43acd664af4b16539d56ef38b0e"
RIGHT_USER_ID="052ad4e6637e48eaadd5c31512de265c"

# API URLs
APP_API_URL="https://app-api.8slp.net"
CLIENT_API_URL="https://client-api.8slp.net"

# Headers
HEADERS=(
  -H "Content-Type: application/json"
  -H "Connection: keep-alive"
  -H "User-Agent: Android App"
  -H "Accept: application/json"
  -H "Host: app-api.8slp.net"
  -H "Authorization: Bearer $ACCESS_TOKEN"
)

# Function to get device status
get_device_status() {
  echo "🔍 Getting device status..."
  curl -s -X GET "$CLIENT_API_URL/v1/devices/$DEVICE_ID" \
    -H "Content-Type: application/json" \
    -H "Connection: keep-alive" \
    -H "User-Agent: Android App" \
    -H "Accept: application/json" \
    -H "Host: client-api.8slp.net" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
}

# Function to get temperature settings for a specific user
get_temperature_settings() {
  local user_id=$1
  local side_name=$2
  
  echo "🌡️  Getting temperature settings for $side_name side (User ID: $user_id)..."
  curl -s -X GET "$APP_API_URL/v1/users/$user_id/temperature" \
    "${HEADERS[@]}" | jq '.'
}

# Function to turn on the bed (activate heating) for a specific user
turn_on_bed() {
  local user_id=$1
  local side_name=$2
  
  echo "🔌 Turning ON $side_name side..."
  curl -s -X PUT "$APP_API_URL/v1/users/$user_id/temperature" \
    "${HEADERS[@]}" \
    -d '{
      "currentState": {
        "type": "smart"
      },
      "timeBased": {
        "level": 0,
        "durationSeconds": 3600
      },
      "currentLevel": 0
    }' > /dev/null
}

# Function to set manual heating level for a specific user
set_manual_heating() {
  local user_id=$1
  local side_name=$2
  local level=$3
  local duration=${4:-3600}  # Default 1 hour
  
  # First, make sure the bed is turned on
  turn_on_bed "$user_id" "$side_name"
  
  echo "🔥 Setting $side_name side to heating level $level for $duration seconds..."
  curl -s -X PUT "$APP_API_URL/v1/users/$user_id/temperature" \
    "${HEADERS[@]}" \
    -d "{
      \"timeBased\": {
        \"level\": $level,
        \"durationSeconds\": $duration
      },
      \"currentLevel\": $level,
      \"currentState\": {
        \"type\": \"timeBased\"
      }
    }" | jq '.'
}


# Function to turn off heating for a specific user
turn_off_heating() {
  local user_id=$1
  local side_name=$2
  
  echo "❄️  Turning OFF heating for $side_name side..."
  curl -s -X PUT "$APP_API_URL/v1/users/$user_id/temperature" \
    "${HEADERS[@]}" \
    -d '{
      "currentState": {
        "type": "off"
      }
    }' | jq '.'
}


# Main script logic
case "$1" in
  "status")
    get_device_status
    ;;
  "get-temp")
    case "$2" in
      "left")
        get_temperature_settings "$LEFT_USER_ID" "LEFT"
        ;;
      "right")
        get_temperature_settings "$RIGHT_USER_ID" "RIGHT"
        ;;
      "both")
        echo "=== LEFT SIDE ==="
        get_temperature_settings "$LEFT_USER_ID" "LEFT"
        echo ""
        echo "=== RIGHT SIDE ==="
        get_temperature_settings "$RIGHT_USER_ID" "RIGHT"
        ;;
      *)
        echo "Usage: $0 get-temp [left|right|both]"
        exit 1
        ;;
    esac
    ;;
  "set-manual")
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo "Usage: $0 set-manual [left|right|both] [level] [duration_seconds]"
      echo "  level: -100 to 100 (negative = cooling, positive = heating)"
      echo "  duration_seconds: optional, defaults to 3600 (1 hour)"
      exit 1
    fi
    
    level=$3
    duration=${4:-3600}
    
    case "$2" in
      "left")
        set_manual_heating "$LEFT_USER_ID" "LEFT" "$level" "$duration"
        ;;
      "right")
        set_manual_heating "$RIGHT_USER_ID" "RIGHT" "$level" "$duration"
        ;;
      "both")
        echo "=== LEFT SIDE ==="
        set_manual_heating "$LEFT_USER_ID" "LEFT" "$level" "$duration"
        echo ""
        echo "=== RIGHT SIDE ==="
        set_manual_heating "$RIGHT_USER_ID" "RIGHT" "$level" "$duration"
        ;;
      *)
        echo "Usage: $0 set-manual [left|right|both] [level] [duration_seconds]"
        exit 1
        ;;
    esac
    ;;
  "on")
    case "$2" in
      "left")
        turn_on_bed "$LEFT_USER_ID" "LEFT"
        ;;
      "right")
        turn_on_bed "$RIGHT_USER_ID" "RIGHT"
        ;;
      "both")
        echo "=== LEFT SIDE ==="
        turn_on_bed "$LEFT_USER_ID" "LEFT"
        echo ""
        echo "=== RIGHT SIDE ==="
        turn_on_bed "$RIGHT_USER_ID" "RIGHT"
        ;;
      *)
        echo "Usage: $0 on [left|right|both]"
        exit 1
        ;;
    esac
    ;;
  "off")
    case "$2" in
      "left")
        turn_off_heating "$LEFT_USER_ID" "LEFT"
        ;;
      "right")
        turn_off_heating "$RIGHT_USER_ID" "RIGHT"
        ;;
      "both")
        echo "=== LEFT SIDE ==="
        turn_off_heating "$LEFT_USER_ID" "LEFT"
        echo ""
        echo "=== RIGHT SIDE ==="
        turn_off_heating "$RIGHT_USER_ID" "RIGHT"
        ;;
      *)
        echo "Usage: $0 off [left|right|both]"
        exit 1
        ;;
    esac
    ;;
  *)
    echo "🛏️  Eight Sleep Dual-Side Control Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  status                                          - Get device status"
    echo "  get-temp [left|right|both]                     - Get temperature settings"
    echo "  set-manual [left|right|both] [level] [duration] - Set manual heating"
    echo "  on [left|right|both]                           - Turn on bed (activate heating)"
    echo "  off [left|right|both]                          - Turn off heating"
    echo ""
    echo "Examples:"
    echo "  $0 status                           # Get device status"
    echo "  $0 get-temp both                    # Get temperature for both sides"
    echo "  $0 on both                          # Turn on both sides"
    echo "  $0 set-manual left 25 1800          # Heat left side to level 25 for 30 minutes"
    echo "  $0 set-manual right -15 3600        # Cool right side to level -15 for 1 hour"
    echo "  $0 off left                         # Turn off left side heating"
    echo ""
    echo "Temperature levels: -100 (coolest) to 100 (warmest)"
    echo "Duration: seconds (default: 3600 = 1 hour)"
    exit 1
    ;;
esac
