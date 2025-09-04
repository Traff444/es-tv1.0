const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "https://enyewzeskpiqueogmssp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE",
  { auth: { persistSession: false } }
);
(async () => {
  const telegramId = 481890;
  const email = `telegram_${telegramId}@electroservice.by`;
  const password = `telegram_${telegramId}`;
  const username = "traf4444";
  const firstName = "Rss";
  try {
    const { data: si, error: sie } = await supabase.auth.signInWithPassword({ email, password });
    if (sie) throw new Error("Sign-in failed: " + sie.message);
    const uid = si.user.id;
    await supabase.from(users).upsert({ id: uid, email, full_name: firstName, role: worker, is_active: true }).eq(id, uid);
    const { error: upErr } = await supabase.from(telegram_users).upsert({
      telegram_id: telegramId,
      user_id: uid,
      chat_id: telegramId,
      first_name: firstName,
      telegram_username: username,
      is_active: true,
      notifications_enabled: true
    }, { onConflict: telegram_id });
    if (upErr) throw new Error(upErr.message);
    console.log(JSON.stringify({ ok: true, userId: uid }));
  } catch (e) {
    console.error(ERR, e.message || e);
    process.exit(1);
  }
})();
