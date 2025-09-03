### CONTEXT RESET BOOTSTRAP PROMPT (for next window)

IMPORTANT: Before any actions, close/kill all running processes (vite, ngrok, node, supabase) to avoid parallel runtimes. Start fresh each time.

Goals for this session:
1) Verify manager/worker Telegram flows and notifications
2) Stabilize web login (no hanging), realtime tasks for workers
3) Prepare production deploy (Vercel/Cloudflare) and update bot menus

Environment notes:
- Repo: ElectroService1.1-telegram-
- Supabase (cloud): https://enyewzeskpiqueogmssp.supabase.co
- Edge Functions deployed: telegram-webhook (JWT off), telegram-notifications (with fallback)
- Bots:
  - Worker: @ElectroServiceBot (token in update_bot_url.sh)
  - Manager: @ElectroServiceManagerBot (token 8004824610:...) — webhook with ?bot=manager
- Current web preview URL (ngrok): see NGROK_URL.txt

Hard requirements:
- Always start by stopping processes: pkill -f "vite\|ngrok\|node\|supabase" || true
- Run start_testing.sh to spin up local + ngrok (or use vite preview + custom ngrok)
- Save new NGROK URL to NGROK_URL.txt and update bot menus with cache-busting

Session checklist:
A) Web auth stability
- Confirm supabase client opts: persistSession, autoRefreshToken, detectSessionInUrl=false
- useAuth: refreshSession fallback, 8s timeout, auto signOut on broken profile
- Auth UI: show email form in web, add “Сбросить вход” button

B) Worker realtime tasks
- WorkerSuperScreen: realtime subscription on public.tasks where assigned_to=eq.{workerId}
- Confirm new tasks appear without reload. If not, check RLS and supabase.channel filters.

C) Telegram flows
- telegram-webhook: /start, /help, /ping, split texts manager vs worker via ?bot=manager
- telegram-notifications: fallback to task.created_by and optional manager_telegram_id override; send photos; log via log_task_notification
- Verify both webhooks return 200 (synthetic POST) and live bot responses

D) Prod prep (optional if time)
- Deploy frontend to Vercel/Cloudflare; set index.html no-store, assets cache-busting
- Update bot menus to production URL

Debug commands to remember:
- curl http://127.0.0.1:4040/api/tunnels (get ngrok URL)
- Telegram getWebhookInfo for both bots; synthetic POST to functions/v1 endpoints

Deliverables this session:
- Confirm working: manager notification on task completion with photos + inline buttons
- Confirm worker realtime task appearance
- Summarize any code edits, update PROJECT_STATUS.md
