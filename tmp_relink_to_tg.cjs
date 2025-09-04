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
  try {
    const { data: si, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      console.log(ERR
