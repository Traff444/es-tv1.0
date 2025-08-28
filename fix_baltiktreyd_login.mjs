import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enyewzeskpiqueogmssp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixBaltiktreydLogin() {
  const email = 'baltiktreyd@gmail.com';
  const password = '327856';
  const userId = 'c1042fdf-dc8f-4cee-84d5-d0162136a035';
  
  console.log('🔧 Исправление входа для baltiktreyd@gmail.com');
  console.log('=' .repeat(50));
  
  // 1. Проверяем текущее состояние
  console.log('\n📋 Шаг 1: Проверка текущего состояния...');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (userError) {
    console.log('❌ Пользователь не найден в таблице users');
    return;
  }
  
  console.log('✅ Пользователь найден в таблице users:');
  console.log(`   - ID: ${userData.id}`);
  console.log(`   - Email: ${userData.email}`);
  console.log(`   - Имя: ${userData.full_name}`);
  console.log(`   - Роль: ${userData.role}`);
  console.log(`   - Активен: ${userData.is_active}`);
  
  // 2. Пробуем разные варианты входа
  console.log('\n🔐 Шаг 2: Попытка входа с разными паролями...');
  
  const passwordsToTry = [
    '327856',
    'password123',
    'testpassword123',
    '123456',
    'password',
    'admin123'
  ];
  
  let loginSuccess = false;
  let correctPassword = null;
  
  for (const pwd of passwordsToTry) {
    console.log(`   Пробуем пароль: ${pwd}`);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: pwd
    });
    
    if (!signInError) {
      console.log(`   ✅ Успешный вход с паролем: ${pwd}`);
      correctPassword = pwd;
      loginSuccess = true;
      await supabase.auth.signOut();
      break;
    } else {
      console.log(`   ❌ Неверный пароль: ${pwd}`);
    }
  }
  
  if (!loginSuccess) {
    console.log('\n🔄 Пользователь не найден в auth.users, создаем...');
    
    // 3. Создаем пользователя в auth.users
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: userData.full_name
        }
      }
    });
    
    if (signUpError) {
      console.log('❌ Ошибка создания пользователя:', signUpError.message);
      
      // Если пользователь уже существует, пробуем сбросить пароль
      if (signUpError.message.includes('User already registered')) {
        console.log('\n🔄 Пользователь уже существует, отправляем сброс пароля...');
        
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://732e7dfe7822.ngrok.app/reset-password'
        });
        
        if (resetError) {
          console.log('❌ Ошибка отправки сброса пароля:', resetError.message);
        } else {
          console.log('✅ Email для сброса пароля отправлен');
          console.log('📧 Проверьте почту baltiktreyd@gmail.com');
        }
      }
    } else {
      console.log('✅ Пользователь создан в auth.users');
      console.log(`   - ID: ${signUpData.user.id}`);
      
      // Проверяем, что ID совпадает
      if (signUpData.user.id !== userId) {
        console.log('⚠️ ВНИМАНИЕ: ID пользователя в auth.users отличается от ID в users!');
        console.log(`   - ID в auth.users: ${signUpData.user.id}`);
        console.log(`   - ID в users: ${userId}`);
        
        // Обновляем связь в telegram_users
        console.log('\n🔄 Обновляем связь в telegram_users...');
        const { error: updateError } = await supabase
          .from('telegram_users')
          .update({ user_id: signUpData.user.id })
          .eq('telegram_id', 481890);
          
        if (updateError) {
          console.log('❌ Ошибка обновления связи:', updateError.message);
        } else {
          console.log('✅ Связь обновлена в telegram_users');
        }
      }
      
      await supabase.auth.signOut();
    }
  }
  
  // 4. Финальная проверка
  console.log('\n🔍 Шаг 3: Финальная проверка...');
  const { data: finalSignInData, error: finalSignInError } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });
  
  if (finalSignInError) {
    console.log('❌ Финальная проверка входа не удалась:', finalSignInError.message);
    console.log('\n💡 РЕКОМЕНДАЦИИ:');
    console.log('1. Проверьте правильность пароля');
    console.log('2. Если пароль забыт, используйте функцию "Забыли пароль?"');
    console.log('3. Или создайте нового пользователя через веб-интерфейс');
  } else {
    console.log('✅ Финальная проверка входа успешна!');
    console.log(`   - ID: ${finalSignInData.user.id}`);
    console.log(`   - Email: ${finalSignInData.user.email}`);
    console.log(`   - Имя: ${finalSignInData.user.user_metadata?.full_name || 'Не указано'}`);
    
    await supabase.auth.signOut();
    
    console.log('\n🎉 Проблема решена!');
    console.log('📱 Теперь можно войти через веб и Telegram');
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📋 ИТОГОВАЯ ИНФОРМАЦИЯ:');
  console.log(`   - Email: ${email}`);
  console.log(`   - Пароль: ${correctPassword || password}`);
  console.log(`   - Telegram ID: 481890`);
  console.log(`   - User ID: ${userId}`);
  console.log(`   - Имя: ${userData.full_name}`);
  console.log(`   - Роль: ${userData.role}`);
  console.log(`   - Активен: ${userData.is_active}`);
}

// Запускаем исправление
fixBaltiktreydLogin();
