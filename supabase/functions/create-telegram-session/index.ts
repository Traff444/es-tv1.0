import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type User, type Session } from 'https://esm.sh/@supabase/supabase-js@2';

interface SessionResponse {
  user: User;
  session: Session;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function validateInitData(initData: string, telegramId: number, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const userParam = params.get('user');
  if (!hash || !userParam) {
    throw new Error('invalid_init_data');
  }
  const user = JSON.parse(userParam);
  if (user.id !== telegramId) {
    throw new Error('telegram_id_mismatch');
  }
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataCheckString));
  const hex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex !== hash) {
    throw new Error('invalid_hash');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { initData, telegram_id } = await req.json();
    if (!initData || !telegram_id) {
      throw new Error('missing_params');
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_MANAGER_BOT_TOKEN') || Deno.env.get('TELEGRAM_BOT_TOKEN');
    const SUPABASE_URL = Deno.env.get('PROJECT_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('bot_token_not_set');
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('supabase_env_not_set');
    }

    await validateInitData(initData, telegram_id, TELEGRAM_BOT_TOKEN);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: record, error: tgError } = await supabase
      .from('telegram_users')
      .select('user_id, users(email)')
      .eq('telegram_id', telegram_id)
      .maybeSingle();

    if (tgError || !record) {
      throw new Error('telegram_user_not_found');
    }

    const email = record.users?.email;
    if (!email) {
      throw new Error('email_not_found');
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkError || !linkData?.properties?.email_otp) {
      throw linkError || new Error('generate_link_failed');
    }

    const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      email,
      token: linkData.properties.email_otp,
    });
    if (verifyError || !sessionData?.session) {
      throw verifyError || new Error('verify_otp_failed');
    }

    const response: SessionResponse = {
      user: sessionData.user,
      session: sessionData.session,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('create-telegram-session error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
