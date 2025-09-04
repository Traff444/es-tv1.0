### CONTEXT RESET BOOTSTRAP PROMPT (next window)

IMPORTANT: First, stop ALL processes to avoid parallel runtimes.
- pkill -f "vite\|ngrok\|node\|supabase" || true

Scope of this session
1) Verify mini-app Telegram ID-only auth (no email form)
2) Verify worker realtime tasks (new task appears instantly)
3) Keep bot menus on Vercel stable URLs (/mini, /manager)

Environment
- Repo: ElectroService1.1-telegram-
- Supabase (cloud): https://enyewzeskpiqueogmssp.supabase.co
- Edge Functions: telegram-webhook (JWT verify disabled), telegram-notifications (fallbacks enabled)
- Bots:
  - @ElectroServiceBot (worker)
  - @ElectroServiceManagerBot (manager, webhook uses ?bot=manager)
- Current dev URL: read NGROK_URL.txt

Startup (dev)
1) export VERCEL_PROD=1; chmod +x ./start_testing.sh && ./start_testing.sh
2) Extract https ngrok URL via 127.0.0.1:4040 API; persist to NGROK_URL.txt
3) Update both bot menus with cache-busting (?v=TIMESTAMP)

Checks A — Web auth stability
- Supabase client: persistSession, autoRefreshToken, detectSessionInUrl=false
- useAuth: refreshSession fallback, 8s timeout, auto signOut on broken profile
- Auth UI: “Сбросить вход” button works (clears sb-*-auth-token and reloads)

Checks B — Worker realtime
- WorkerSuperScreen subscribes to public.tasks (assigned_to=current worker)
- Create a task for the worker → appears instantly without page reload

Checks C — Telegram flows
- telegram-webhook: supports /start, /help, /ping; different texts for manager vs worker via ?bot=manager
- telegram-notifications: if RPC fails, fallback to created_by; supports manager_telegram_id override; sends photos; logs via log_task_notification
- mini-app auth: no email fallback; if telegram_id not linked → show not-registered screen
- Validate webhooks with synthetic POST (expect HTTP 200). Validate getWebhookInfo for both bots.

Deploy (Vercel)
1) Build: npm run build
2) Deploy frontend to Vercel (or Cloudflare Pages). Set env vars:
   - VITE_SUPABASE_URL=https://enyewzeskpiqueogmssp.supabase.co
   - VITE_SUPABASE_ANON_KEY=<anon key>
3) Ensure index.html has Cache-Control: no-store (framework headers) and assets use cache-busting (already handled)
4) Update both bot menus to the new production URL with cache-busting (?v=TIMESTAMP), stable alias recommended

Diagnostics quick refs
- curl -s http://127.0.0.1:4040/api/tunnels (ngrok URL)
- Telegram getWebhookInfo for both tokens; synthetic POST to /functions/v1/telegram-webhook[?bot=manager]

Deliverables
- Manager receives Telegram card with photos + inline buttons on task completion
- Worker sees new tasks in realtime
- Production URL live on Vercel and bot menus updated
- PROJECT_STATUS.md updated with outcomes
