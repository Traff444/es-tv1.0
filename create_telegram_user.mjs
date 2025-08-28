import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enyewzeskpiqueogmssp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTelegramUser(email, password, fullName, telegramId) {
  console.log(`🔧 Создание пользователя для Telegram...`);
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Имя: ${fullName}`);
  console.log(`📱 Telegram ID: ${telegramId}`);
  console.log('');
  
  // 1. Создаем пользователя в auth.users
  console.log('🔄 Шаг 1: Создание пользователя в auth.users...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });
  
  if (signUpError) {
    console.log('❌ Ошибка создания пользователя:', signUpError.message);
    return;
  }
  
  console.log('✅ Пользователь создан в auth.users');
  console.log(`   - ID: ${signUpData.user.id}`);
  console.log(`   - Email: ${signUpData.user.email}`);
  
  // 2. Создаем профиль в таблице users
  console.log('\n🔄 Шаг 2: Создание профиля в таблице users...');
  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .insert({
      id: signUpData.user.id,
      email: email,
      full_name: fullName,
      role: 'worker',
      is_active: true,
      hourly_rate: 2.0
    })
    .select()
    .single();
    
  if (profileError) {
    console.log('❌ Ошибка создания профиля:', profileError.message);
    
    // Если профиль уже существует, обновляем его
    if (profileError.message.includes('duplicate key')) {
      console.log('🔄 Профиль уже существует, обновляем...');
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({
          is_active: true,
          role: 'worker',
          full_name: fullName,
          hourly_rate: 2.0
        })
        .eq('id', signUpData.user.id)
        .select()
        .single();
        
      if (updateError) {
        console.log('❌ Ошибка обновления профиля:', updateError.message);
      } else {
        console.log('✅ Профиль обновлен в таблице users');
        console.log(`   - ID: ${updateData.id}`);
        console.log(`   - Email: ${updateData.email}`);
        console.log(`   - Имя: ${updateData.full_name}`);
        console.log(`   - Роль: ${updateData.role}`);
        console.log(`   - Активен: ${updateData.is_active}`);
      }
    }
  } else {
    console.log('✅ Профиль создан в таблице users');
    console.log(`   - ID: ${profileData.id}`);
    console.log(`   - Email: ${profileData.email}`);
    console.log(`   - Имя: ${profileData.full_name}`);
    console.log(`   - Роль: ${profileData.role}`);
    console.log(`   - Активен: ${profileData.is_active}`);
  }
  
  // 3. Создаем связь в telegram_users
  console.log('\n🔄 Шаг 3: Создание связи в telegram_users...');
  
  // Сначала удаляем старую связь, если есть
  const { error: deleteError } = await supabase
    .from('telegram_users')
    .delete()
    .eq('telegram_id', telegramId);
    
  if (deleteError) {
    console.log('⚠️ Ошибка удаления старой связи:', deleteError.message);
  } else {
    console.log('✅ Старая связь удалена (если была)');
  }
  
  // Создаем новую связь
  const { data: telegramData, error: telegramError } = await supabase
    .from('telegram_users')
    .insert({
      telegram_id: telegramId,
      user_id: signUpData.user.id
    })
    .select()
    .single();
    
  if (telegramError) {
    console.log('❌ Ошибка создания связи:', telegramError.message);
  } else {
    console.log('✅ Связь создана в telegram_users');
    console.log(`   - Telegram ID: ${telegramData.telegram_id}`);
    console.log(`   - User ID: ${telegramData.user_id}`);
  }
  
  // 4. Проверяем результат
  console.log('\n🔍 Шаг 4: Проверка результата...');
  
  // Проверяем профиль
  const { data: checkProfile, error: checkProfileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', signUpData.user.id)
    .single();
    
  if (checkProfileError) {
    console.log('❌ Ошибка проверки профиля:', checkProfileError.message);
  } else {
    console.log('✅ Профиль найден:');
    console.log(`   - ID: ${checkProfile.id}`);
    console.log(`   - Email: ${checkProfile.email}`);
    console.log(`   - Имя: ${checkProfile.full_name}`);
    console.log(`   - Роль: ${checkProfile.role}`);
    console.log(`   - Активен: ${checkProfile.is_active}`);
  }
  
  // Проверяем связь
  const { data: checkLink, error: checkLinkError } = await supabase
    .from('telegram_users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
    
  if (checkLinkError) {
    console.log('❌ Ошибка проверки связи:', checkLinkError.message);
  } else {
    console.log('✅ Связь найдена:');
    console.log(`   - Telegram ID: ${checkLink.telegram_id}`);
    console.log(`   - User ID: ${checkLink.user_id}`);
  }
  
  // Выходим из системы
  await supabase.auth.signOut();
  
  console.log('\n🎉 Пользователь создан успешно!');
  console.log('📱 Теперь можно войти через Telegram');
  console.log('');
  console.log('🧪 Для тестирования:');
  console.log('1. Откройте @ElectroServiceBot в Telegram');
  console.log('2. Нажмите Menu → "🔧 ЭлектроСервис UNIFIED"');
  console.log('3. Должен произойти автоматический вход');
  console.log('');
  console.log('📋 Данные для входа:');
  console.log(`   - Email: ${email}`);
  console.log(`   - Пароль: ${password}`);
  console.log(`   - Telegram ID: ${telegramId}`);
}

// Пример использования - раскомментируйте и измените данные:
// createTelegramUser('new.worker@electroservice.by', 'password123', 'Новый Рабочий', 123456789);

// Экспортируем функцию для использования в других скриптах
export { createTelegramUser };

// Если скрипт запущен напрямую, показываем инструкцию
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('📱 Скрипт для создания пользователя с Telegram связью');
  console.log('');
  console.log('💡 Использование:');
  console.log('1. Отредактируйте скрипт, указав данные пользователя');
  console.log('2. Раскомментируйте строку с вызовом createTelegramUser()');
  console.log('3. Запустите: node create_telegram_user.mjs');
  console.log('');
  console.log('📋 Пример данных:');
  console.log('   - Email: new.worker@electroservice.by');
  console.log('   - Пароль: password123');
  console.log('   - Имя: Новый Рабочий');
  console.log('   - Telegram ID: 123456789');
}
