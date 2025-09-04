const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = "https://enyewzeskpiqueogmssp.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE";
const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

(async () => {
  const telegramId = 481890;
  const tgEmail = `telegram_${telegramId}@electroservice.by`;
  const tgPass = `telegram_${telegramId}`;
  const username = "traf4444";
  const firstName = "Rss";
  try {
    const { data: si, error: e1 } = await supabase.auth.signInWithPassword({ email: tgEmail, password: tgPass });
    if (e1) throw new Error("Cannot sign in as telegram user: "+e1.message);
    const uid = si.user.id;

    await supabase.from(users).upsert({ id: uid, email: tgEmail, full_name: firstName, role: worker, is_active: true }).eq(id, uid);

    const up = await supabase.from(telegram_users).upsert({
      telegram_id: telegramId,
      user_id: uid,
      chat_id: telegramId,
      first_name: firstName,
      telegram_username: username,
      is_active: true,
      notifications_enabled: true
    }, { onConflict: telegram_id });
    if (up.error) throw up.error;

    console.log(JSON.stringify({ ok: true, userId: uid }));
  } catch (e) {
    console.error(ERR, e.message || e);
    process.exit(1);
  }
})();
