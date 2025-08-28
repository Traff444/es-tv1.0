#!/bin/bash

# 🔧 Настройка Telegram Mini App через REST API

echo "🔧 Настройка Telegram Mini App..."

SUPABASE_URL="http://127.0.0.1:54321"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

echo ""
echo "1. Проверяем существующих пользователей с telegram_id = 481890..."

# Проверяем пользователей с telegram_id 481890
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/users?telegram_id=eq.481890&select=*" | \
  python3 -m json.tool

echo ""
echo "2. Создаем тестового пользователя (если не существует)..."

# Создаем пользователя
curl -s \
  -X POST \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "email": "worker.481890@electroservice.by",
    "full_name": "Тестовый Рабочий (Telegram ID: 481890)", 
    "role": "worker",
    "telegram_id": 481890,
    "hourly_rate": 15.00,
    "is_active": true
  }' \
  "$SUPABASE_URL/rest/v1/users" | \
  python3 -m json.tool

echo ""
echo "3. Проверяем задачи для пользователя..."

# Проверяем задачи
curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/tasks?assigned_to=eq.$(curl -s -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" "$SUPABASE_URL/rest/v1/users?telegram_id=eq.481890&select=id" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'] if json.load(sys.stdin) else '')" 2>/dev/null)&select=id,title,status,priority" | \
  python3 -m json.tool

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📱 Следующие шаги:"
echo "1. Откройте @ElectroServiceBot в Telegram"  
echo "2. Нажмите 'Launch App'"
echo "3. Если открывается форма входа, используйте:"
echo "   Email: worker.481890@electroservice.by"
echo "   Password: telegram_481890"