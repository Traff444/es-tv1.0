## ЭлектроСервис — запуск и проверка

### Production (Vercel)
- Worker Mini App: https://electroservice-telegram.vercel.app/mini
- Manager Web: https://electroservice-telegram.vercel.app/manager

Порядок проверки:
1) Откройте из Telegram меню рабочего → Mini App (автовход по Telegram ID, без email формы).
2) Откройте менеджерскую веб-страницу → войдите по email/паролю.
3) Создайте задачу на рабочего с Telegram ID 481890 → задача появляется у рабочего сразу (realtime).

### Development (локально + ngrok)
1) Остановите старые процессы: `pkill -f "vite|ngrok|node|supabase" || true`
2) Запустите: `chmod +x ./start_testing.sh && ./start_testing.sh`
3) Dev URL и текущий ngrok URL выведутся в консоль.

Важно: чтобы не переписывать меню ботов на ngrok, перед запуском экспортируйте:
```bash
export VERCEL_PROD=1
```

### Переменные окружения
- `.env.local` создаётся скриптом запуска из валидных значений.
- Полный список ключей и токенов см. `CORRECT_KEYS.txt` (Supabase URL/Anon Key, Vercel Token, Telegram bot tokens, прод-URL).

### Telegram
- Worker: @ElectroServiceBot (кнопка ведёт на /mini)
- Manager: @ElectroServiceManagerBot (кнопка ведёт на /manager)

### Замечания
- В Mini App выключен email/пароль, вход — только по Telegram ID.
- В Web — только email/пароль.

