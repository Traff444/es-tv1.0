#!/bin/bash
MANAGER_BOT_TOKEN="8004824610:AAFJQATOO_IJc8l-6yw9ZOzHcufpHSFt4RI"
TEST_CHAT_ID="481890"

echo "📤 Тестируем менеджерский бот..."
curl -s -X POST "https://api.telegram.org/bot$MANAGER_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": $TEST_CHAT_ID, \"text\": \"🤖 Тест менеджерского бота! Если вы видите это сообщение - бот работает!\"}"
