import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enyewzeskpiqueogmssp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBaltiktreydUser() {
  const email = 'baltiktreyd@gmail.com';
  const password = '327856';
  
  console.log('🔍 Диагностика пользователя baltiktreyd@gmail.com');
  console.log('=' .repeat(50));
  
  // 1. Проверяем существование в таблице users
  console.log('\n📋 Шаг 1: Проверка в таблице users...');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
    
  if (userError) {
    console.log('❌ Пользователь НЕ найден в таблице users');
    console.log('   Ошибка:', userError.message);
  } else {
    console.log('✅ Пользователь найден в таблице users:');
    console.log(`   - ID: ${userData.id}`);
    console.log(`   - Email: ${userData.email}`);
    console.log(`   - Имя: ${userData.full_name}`);
    console.log(`   - Роль: ${userData.role}`);
    console.log(`   - Активен: ${userData.is_active}`);
    console.log(`   - Создан: ${userData.created_at}`);
  }
  
  // 2. Проверяем связь в telegram_users
  console.log('\n📱 Шаг 2: Проверка в telegram_users...');
  if (userData) {
    const { data: telegramData, error: telegramError } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('user_id', userData.id)
      .single();
      
    if (telegramError) {
      console.log('❌ Связь с Telegram НЕ найдена');
      console.log('   Ошибка:', telegramError.message);
    } else {
      console.log('✅ Связь с Telegram найдена:');
      console.log(`   - Telegram ID: ${telegramData.telegram_id}`);
      console.log(`   - User ID: ${telegramData.user_id}`);
    }
  }
  
  // 3. Пробуем войти с паролем
  console.log('\n🔐 Шаг 3: Попытка входа с паролем...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });
  
  if (signInError) {
    console.log('❌ Ошибка входа:', signInError.message);
    
    // Если пользователь не найден в auth, пробуем создать
    if (signInError.message.includes('Invalid login credentials')) {
      console.log('\n🔄 Попытка создания пользователя в auth.users...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: 'Baltik Treyd'
          }
        }
      });
      
      if (signUpError) {
        console.log('❌ Ошибка создания пользователя:', signUpError.message);
      } else {
        console.log('✅ Пользователь создан в auth.users');
        console.log(`   - ID: ${signUpData.user.id}`);
        
        // Создаем профиль в users, если его нет
        if (!userData) {
          console.log('\n🔄 Создание профиля в таблице users...');
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .insert({
              id: signUpData.user.id,
              email: email,
              full_name: 'Baltik Treyd',
              role: 'worker',
              is_active: true,
              hourly_rate: 2.0
            })
            .select()
            .single();
            
          if (profileError) {
            console.log('❌ Ошибка создания профиля:', profileError.message);
          } else {
            console.log('✅ Профиль создан в таблице users');
          }
        }
        
        // Выходим из системы
        await supabase.auth.signOut();
      }
    }
  } else {
    console.log('✅ Вход успешен!');
    console.log(`   - ID: ${signInData.user.id}`);
    console.log(`   - Email: ${signInData.user.email}`);
    console.log(`   - Имя: ${signInData.user.user_metadata?.full_name || 'Не указано'}`);
    
    // Выходим из системы
    await supabase.auth.signOut();
  }
  
  // 4. Финальная проверка
  console.log('\n🔍 Шаг 4: Финальная проверка...');
  const { data: finalUserData, error: finalUserError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
    
  if (finalUserError) {
    console.log('❌ Пользователь все еще не найден в таблице users');
  } else {
    console.log('✅ Пользователь найден в таблице users:');
    console.log(`   - ID: ${finalUserData.id}`);
    console.log(`   - Email: ${finalUserData.email}`);
    console.log(`   - Имя: ${finalUserData.full_name}`);
    console.log(`   - Роль: ${finalUserData.role}`);
    console.log(`   - Активен: ${finalUserData.is_active}`);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎯 РЕКОМЕНДАЦИИ:');
  
  if (!userData) {
    console.log('1. Пользователь отсутствует в таблице users');
    console.log('2. Нужно создать профиль в таблице users');
  }
  
  if (userData && !userData.is_active) {
    console.log('1. Пользователь неактивен');
    console.log('2. Нужно установить is_active = true');
  }
  
  if (signInError && signInError.message.includes('Invalid login credentials')) {
    console.log('1. Неверный пароль или пользователь не существует в auth.users');
    console.log('2. Нужно создать пользователя в auth.users или сбросить пароль');
  }
  
  console.log('\n💡 Для исправления используйте скрипт create_telegram_user.mjs');
}

// Запускаем диагностику
checkBaltiktreydUser();
