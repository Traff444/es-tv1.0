#!/bin/bash

# 🤖 Telegram Bot Configuration Update Script
# Updates the Mini App URL in your Telegram bot

# Use the provided URL or default to the current one
NGROK_URL="${1:-https://732e7dfe7822.ngrok.app}"
BOT_TOKEN="8173248287:AAGxAxX7SGRpxHvu5BpHswGn7G5_K198P5s"

echo "🤖 Updating Telegram Bot Configuration..."
echo "📱 New Mini App URL: $NGROK_URL"
echo "🔑 Bot Token: $BOT_TOKEN"
echo ""

echo "🔧 Setting up Mini App URL via Telegram Bot API..."

# Set the Mini App URL for the bot
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_button\": {
      \"type\": \"web_app\",
      \"text\": \"🔧 ЭлектроСервис UNIFIED\",
      \"web_app\": {
        \"url\": \"$NGROK_URL\"
      }
    }
  }"

echo ""
echo ""
echo "✅ Bot configuration updated!"
echo ""
echo "📱 How to test:"
echo "1. Open Telegram"
echo "2. Find @ElectroServiceBot"
echo "3. Send /start"
echo "4. Click the 'ElectroService App' button"
echo "5. The Mini App should now open with the new URL"
echo ""
echo "🔗 Current Mini App URL: $NGROK_URL"
echo "🌐 ngrok Web Interface: http://127.0.0.1:4040"