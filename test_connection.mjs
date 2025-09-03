import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enyewzeskpiqueogmssp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE';

console.log('🔍 Тестирование подключения к Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey.length);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('📡 Тестирование подключения...');
    
    // Тест базового подключения
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Ошибка подключения к БД:', error);
      return;
    }
    
    console.log('✅ Подключение к БД успешно!');
    
    // Тест аутентификации
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.log('⚠️ Ошибка аутентификации (ожидаемо):', authError.message);
    } else {
      console.log('✅ Аутентификация работает');
    }
    
    console.log('🎉 Все тесты пройдены!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

testConnection();
