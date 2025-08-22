@echo off
chcp 65001 >nul

echo 🚀 Настройка ElectroService 1.1
echo ================================

REM Проверяем наличие Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не установлен. Установите Node.js 18+ с https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js найден

REM Проверяем наличие npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm не найден
    pause
    exit /b 1
)

echo ✅ npm найден

REM Устанавливаем зависимости
echo 📦 Устанавливаем зависимости...
npm install

REM Проверяем наличие Supabase CLI
supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Устанавливаем Supabase CLI...
    npm install -g supabase
) else (
    echo ✅ Supabase CLI найден
)

REM Инициализируем Supabase (если еще не инициализирован)
if not exist "supabase\config.toml" (
    echo 🔧 Инициализируем Supabase...
    supabase init
)

REM Запускаем Supabase
echo 🚀 Запускаем локальную Supabase...
supabase start

REM Создаем .env.local файл
echo 📝 Создаем .env.local файл...

REM Получаем данные из supabase status
for /f "tokens=3" %%i in ('supabase status ^| findstr "API URL"') do set SUPABASE_URL=%%i
for /f "tokens=3" %%i in ('supabase status ^| findstr "anon key"') do set SUPABASE_ANON_KEY=%%i

REM Создаем .env.local файл
(
echo VITE_SUPABASE_URL=%SUPABASE_URL%
echo VITE_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%
) > .env.local

echo ✅ .env.local создан с данными:
echo    URL: %SUPABASE_URL%
echo    Key: %SUPABASE_ANON_KEY:~0,20%...

REM Применяем миграции
echo 🗄️ Применяем миграции базы данных...
supabase db reset

echo.
echo 🎉 Настройка завершена!
echo ================================
echo 📱 Запустите приложение: npm run dev
echo 🌐 Приложение будет доступно: http://localhost:5173
echo 🗄️ Supabase Studio: http://127.0.0.1:54323
echo.
echo 📋 Тестовые данные:
echo    - Админ: admin@test.com / password
echo    - Менеджер: manager@test.com / password
echo    - Рабочий: worker@test.com / password
echo.
echo 🔗 Документация: README.md
pause
