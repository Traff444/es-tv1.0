import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixUserProfile() {
  console.log('🔧 Fixing user profile setup...')
  
  const userId = '58202ece-1f98-4118-aba2-60be54cae94a'
  const telegramId = 481890
  
  try {
    // 1. Check if auth user exists
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    
    if (authError || !authUser) {
      console.log('📝 Creating auth user...')
      const { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
        id: userId,
        email: 'test.worker@electroservice.by',
        password: `telegram_${telegramId}`,
        email_confirm: true
      })
      
      if (createError) {
        console.error('❌ Error creating auth user:', createError.message)
        return
      }
      console.log('✅ Auth user created')
    } else {
      console.log('✅ Auth user exists')
    }
    
    // 2. Create user profile
    console.log('📝 Creating user profile...')
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: 'test.worker@electroservice.by',
        full_name: 'Тестовый Рабочий (Telegram ID: 481890)',
        role: 'worker',
        hourly_rate: 15.00,
        is_active: true
      }, { onConflict: 'id' })
    
    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message)
      return
    }
    console.log('✅ User profile created')
    
    // 3. Verify telegram_users link
    console.log('🔗 Verifying Telegram connection...')
    const { data: telegramUser, error: telegramError } = await supabase
      .from('telegram_users')
      .select('*, users(*)')
      .eq('telegram_id', telegramId)
      .single()
    
    if (telegramError) {
      console.error('❌ Telegram user error:', telegramError.message)
      return
    }
    
    if (telegramUser.users) {
      console.log('✅ Telegram connection working!')
      console.log('👤 User:', telegramUser.users.full_name)
      console.log('📧 Email:', telegramUser.users.email)
      console.log('🆔 Telegram ID:', telegramUser.telegram_id)
    } else {
      console.log('⚠️ Telegram connection exists but user link is null')
    }
    
    // 4. Test authentication
    console.log('🔐 Testing authentication...')
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test.worker@electroservice.by',
      password: `telegram_${telegramId}`
    })
    
    if (signInError) {
      console.error('❌ Sign in error:', signInError.message)
    } else {
      console.log('✅ Authentication test successful')
      // Sign out after test
      await supabase.auth.signOut()
    }
    
    console.log('')
    console.log('🎉 Setup complete!')
    console.log('📱 Test credentials:')
    console.log('   Email: test.worker@electroservice.by')
    console.log('   Password: telegram_481890')
    console.log('   Telegram ID: 481890')
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message)
  }
}

fixUserProfile()