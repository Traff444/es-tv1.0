const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = "https://enyewzeskpiqueogmssp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

(async () => {
  const telegramId = 481890;
  const email = `telegram_${telegramId}@electroservice.by`;
  const password = `telegram_${telegramId}`;
  const fullName = "Rss";
  try {
    // Try sign in
    let { data: si, error: sie } = await supabase.auth.signInWithPassword({ email, password });
    if (sie) {
      // Create auth user
      const { data: su, error: sue } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, telegram_id: telegramId } } });
      if (sue && !String(sue.message||"").toLowerCase().includes("already")) throw sue;
      // Sign in again
      const res2 = await supabase.auth.signInWithPassword({ email, password });
      si = res2.data; sie = res2.error;
      if (sie) throw sie;
    }
    const user = si.user;
    if (!user) throw new Error("No auth user after sign-in");

    // Ensure users profile exists
    const { data: prof, error: profErr } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
    if (!profErr && !prof) {
      await supabase.from("users").insert({ id: user.id, email, full_name: fullName, role: "worker", is_active: true, hourly_rate: 15.0 });
    }

    // Upsert telegram_users link as the same auth user (RLS ok)
    const { data: link, error: linkErr } = await supabase.from("telegram_users").upsert({ telegram_id: telegramId, user_id: user.id }, { onConflict: "telegram_id" });
    if (linkErr) throw linkErr;

    console.log(JSON.stringify({ ok: true, userId: user.id }));
  } catch (e) {
    console.error("ERR", e.message || e);
    process.exit(1);
  }
})();
