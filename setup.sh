#!/bin/bash

echo "🚀 Настройка ElectroService 1.1"
echo "================================"

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 18+ с https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js найден: $(node --version)"

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не найден"
    exit 1
fi

echo "✅ npm найден: $(npm --version)"

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..."
npm install

# Проверяем наличие Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "📦 Устанавливаем Supabase CLI..."
    npm install -g supabase
else
    echo "✅ Supabase CLI найден: $(supabase --version)"
fi

# Инициализируем Supabase (если еще не инициализирован)
if [ ! -f "supabase/config.toml" ]; then
    echo "🔧 Инициализируем Supabase..."
    supabase init
fi

# Запускаем Supabase
echo "🚀 Запускаем локальную Supabase..."
supabase start

# Получаем данные для .env.local
echo "📝 Создаем .env.local файл..."

# Извлекаем URL и ключ из вывода supabase start
SUPABASE_URL=$(supabase status | grep "API URL" | awk '{print $3}')
SUPABASE_ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')

# Создаем .env.local файл
cat > .env.local << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF

echo "✅ .env.local создан с данными:"
echo "   URL: $SUPABASE_URL"
echo "   Key: ${SUPABASE_ANON_KEY:0:20}..."

# Применяем миграции
echo "🗄️ Применяем миграции базы данных..."
supabase db reset

echo ""
echo "🎉 Настройка завершена!"
echo "================================"
echo "📱 Запустите приложение: npm run dev"
echo "🌐 Приложение будет доступно: http://localhost:5173"
echo "🗄️ Supabase Studio: http://127.0.0.1:54323"
echo ""
echo "📋 Тестовые данные:"
echo "   - Админ: admin@test.com / password"
echo "   - Менеджер: manager@test.com / password"
echo "   - Рабочий: worker@test.com / password"
echo ""
echo "🔗 Документация: README.md"
