const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = "https://enyewzeskpiqueogmssp.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE";
const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

(async () => {
  const telegramId = 481890;
  const tgEmail = `telegram_${telegramId}@electroservice.by`;
  const tgPass = `telegram_${telegramId}`;
  const managerEmail = "baltiktreyd@gmail.com";
  const managerPass = "327856";
  const username = "traf4444";
  const firstName = "Rss";

  try {
    // 1) Sign in as current Telegram-linked user and delete mapping
    let { data: si1, error: e1 } = await supabase.auth.signInWithPassword({ email: tgEmail, password: tgPass });
    if (e1) throw new Error("Cannot sign in as telegram user: "+e1.message);
    const tgUserId = si1.user.id;
    let del = await supabase.from("telegram_users").delete().eq("telegram_id", telegramId);
    if (del.error) throw del.error;
    await supabase.auth.signOut();

    // 2) Sign in as manager/worker target user and create mapping
    let { data: si2, error: e2 } = await supabase.auth.signInWithPassword({ email: managerEmail, password: managerPass });
    if (e2) throw new Error("Cannot sign in as target user: "+e2.message);
    const targetUserId = si2.user.id;
    let up = await supabase.from("telegram_users").upsert({
      telegram_id: telegramId,
      user_id: targetUserId,
      chat_id: telegramId,
      first_name: firstName,
      telegram_username: username,
      is_active: true,
      notifications_enabled: true
    }, { onConflict: "telegram_id" });
    if (up.error) throw up.error;

    console.log(JSON.stringify({ ok: true, targetUserId }));
  } catch (e) {
    console.error("ERR", e);
    process.exit(1);
  }
})();
