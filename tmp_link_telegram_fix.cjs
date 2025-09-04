const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = "https://enyewzeskpiqueogmssp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  const telegramId = 481890;
  const chatId = 481890; // for user chats, chat_id == user_id
  const username = "traf4444"; // from your logs
  const fullName = "Rss";
  const email = `telegram_${telegramId}@electroservice.by`;
  const password = `telegram_${telegramId}`;
  try {
    // Ensure auth session as this telegram user (RLS requires auth.uid())
    let { data: si, error: sie } = await supabase.auth.signInWithPassword({ email, password });
    if (sie) {
      const { data: su, error: sue } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, telegram_id: telegramId } } });
      if (sue && !String(sue.message||"").toLowerCase().includes("already")) throw sue;
      const res2 = await supabase.auth.signInWithPassword({ email, password });
      si = res2.data; sie = res2.error;
      if (sie) throw sie;
    }
    const user = si.user;

    // Upsert mapping with required non-null chat_id
    const { error: linkErr } = await supabase.from("telegram_users").upsert({
      telegram_id: telegramId,
      user_id: user.id,
      chat_id: chatId,
      first_name: fullName,
      telegram_username: username,
      is_active: true,
      notifications_enabled: true
    }, { onConflict: "telegram_id" });
    if (linkErr) throw linkErr;

    console.log(JSON.stringify({ ok: true, userId: user.id }));
  } catch (e) {
    console.error("ERR", e.message || e);
    process.exit(1);
  }
})();
