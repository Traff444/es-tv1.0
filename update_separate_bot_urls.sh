#!/bin/bash

# 🤖 Separate Telegram Bots Configuration Update Script
# Updates different Mini App URLs for Worker and Manager bots

# Use the provided URL or default to the current one
BASE_URL="${1:-https://electroservice-telegram-i8pjeodw0-traffs-projects-7d036e44.vercel.app}"

# Bot tokens
WORKER_BOT_TOKEN="8173248287:AAGxAxX7SGRpxHvu5BpHswGn7G5_K198P5s"  # @ElectroServiceBot  
MANAGER_BOT_TOKEN="8004824610:AAFJQATOO_IJc8l-6yw9ZOzHcufpHSFt4RI"  # @ElectroServiceManagerBot

# Cache busting timestamp
TIMESTAMP=$(date +%s)

# URLs for different interfaces
WORKER_URL="${BASE_URL}/mini?v=${TIMESTAMP}"
MANAGER_URL="${BASE_URL}/manager?v=${TIMESTAMP}"

echo "🤖 Updating Separate Telegram Bot Configurations..."
echo "📱 Base URL: $BASE_URL"
echo "👷 Worker Bot URL: $WORKER_URL"
echo "👨‍💼 Manager Bot URL: $MANAGER_URL"
echo ""

echo "🔧 Setting up Worker Bot Mini App URL..."
curl -X POST "https://api.telegram.org/bot$WORKER_BOT_TOKEN/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_button\": {
      \"type\": \"web_app\",
      \"text\": \"👷 Рабочий\",
      \"web_app\": {
        \"url\": \"$WORKER_URL\"
      }
    }
  }"

echo ""
echo ""

echo "🔧 Setting up Manager Bot Mini App URL..."
curl -X POST "https://api.telegram.org/bot$MANAGER_BOT_TOKEN/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_button\": {
      \"type\": \"web_app\",
      \"text\": \"👨‍💼 Менеджер\",
      \"web_app\": {
        \"url\": \"$MANAGER_URL\"
      }
    }
  }"

echo ""
echo ""
echo "✅ Both bot configurations updated!"
echo ""
echo "📱 How to test:"
echo "1. Worker Interface:"
echo "   - Open @ElectroServiceBot"
echo "   - Click '👷 Рабочий' button"
echo "   - Should open: $WORKER_URL"
echo ""
echo "2. Manager Interface:"
echo "   - Open @ElectroServiceManagerBot"  
echo "   - Click '👨‍💼 Менеджер' button"
echo "   - Should open: $MANAGER_URL"
echo ""
echo "🔗 Current URLs:"
echo "   Worker: $WORKER_URL"
echo "   Manager: $MANAGER_URL"
echo "🌐 ngrok Web Interface: http://127.0.0.1:4040"