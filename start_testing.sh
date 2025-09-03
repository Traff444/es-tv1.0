#!/bin/bash

echo "🚀 ЭлектроСервис - Автоматический запуск для тестирования"
echo "=========================================================="

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 18+"
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"

# Проверяем наличие ngrok
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok не установлен. Установите ngrok"
    exit 1
fi

echo "✅ ngrok найден: $(ngrok version)"

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..."
npm install

# Создаем .env.local с правильными настройками
echo "📝 Создаем .env.local..."
cat > .env.local << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=https://enyewzeskpiqueogmssp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE
EOF

echo "✅ .env.local создан"

# Запускаем сервер разработки
echo "🚀 Запускаем сервер разработки..."
echo "📱 Сервер будет доступен на: http://localhost:5173"
echo ""
echo "⏳ Запускаем ngrok в фоне..."
ngrok http 5173 > /dev/null 2>&1 &

# Ждем запуска ngrok
sleep 5

# Получаем ngrok URL
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data['tunnels']:
    print(data['tunnels'][0]['public_url'])
else:
    print('')
")

if [ -z "$NGROK_URL" ]; then
    echo "❌ Не удалось получить ngrok URL"
    exit 1
fi

echo "✅ ngrok запущен: $NGROK_URL"

# Обновляем URL бота
echo "🤖 Обновляем URL бота..."
./update_bot_url.sh "$NGROK_URL"

echo ""
echo "🎉 Система готова к тестированию!"
echo "=================================="
echo ""
echo "📱 Веб-версия: $NGROK_URL"
echo "🤖 Telegram бот: @ElectroServiceBot"
echo ""
echo "👷 Тестовые данные:"
echo "   Рабочий: test.worker@electroservice.by / telegram_481890"
echo "   Менеджер: test.manager@electroservice.by / manager123"
echo ""
echo "🔧 Мониторинг:"
echo "   ngrok: http://127.0.0.1:4040"
echo "   Локальный сервер: http://localhost:5173"
echo ""
echo "📋 Подробная инструкция: START_TESTING.md"
echo ""
echo "🚀 Начинайте тестирование!"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запускаем сервер разработки
npm run dev
