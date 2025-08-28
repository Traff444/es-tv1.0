# 🔐 Система аутентификации ЭлектроСервис

## 📊 Архитектура базы данных

### Две таблицы пользователей:

1. **`auth.users`** - встроенная таблица Supabase Auth
   - Создается автоматически при регистрации
   - Содержит: id, email, password_hash, created_at, etc.
   - Управляется Supabase Auth

2. **`users`** - наша кастомная таблица профилей
   - Содержит: id, email, full_name, role, is_active, hourly_rate, etc.
   - Управляется нашим приложением

## 🔍 Проблема: Почему пользователь появляется в Authentication, но не в таблице users?

### Причина:
При регистрации через `supabase.auth.signUp()` пользователь автоматически создается в `auth.users`, но **НЕ** в нашей таблице `users`.

### Решение:
Обновлена функция `signUp` в `src/lib/supabase.ts` для автоматического создания профиля.

## 🛠️ Исправления

### 1. Обновленная функция регистрации (`src/lib/supabase.ts`):

```typescript
export const signUp = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  });
  
  // Если регистрация успешна, создаем профиль в таблице users
  if (data.user && !error) {
    console.log('✅ Пользователь создан в auth.users, создаем профиль...');
    
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        email: email,
        full_name: fullName.trim(),
        role: 'worker', // роль по умолчанию
        is_active: true,
        hourly_rate: 2.0
      })
      .select()
      .single();
      
    if (profileError) {
      console.log('❌ Ошибка создания профиля:', profileError.message);
      // Не возвращаем ошибку, так как пользователь уже создан в auth
    } else {
      console.log('✅ Профиль создан успешно в таблице users');
    }
  }
  
  return { data, error };
};
```

### 2. Функция Telegram аутентификации уже содержит логику создания профилей

## 📋 Где посмотреть пользователей в Supabase?

### В веб-интерфейсе:

1. **Authentication → Users** - все пользователи из `auth.users`
2. **Table Editor → users** - все профили из нашей таблицы `users`

### SQL запросы:

```sql
-- Все пользователи auth.users
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Все профили users
SELECT id, email, full_name, role, is_active FROM users ORDER BY created_at DESC;

-- Сравнение количества
SELECT 
    'auth.users' as table_name,
    COUNT(*) as user_count
FROM auth.users
UNION ALL
SELECT 
    'public.users' as table_name,
    COUNT(*) as user_count
FROM public.users;
```

## 🧪 Тестирование

### Тест прошел успешно:
- ✅ Пользователь создан в `auth.users`
- ✅ Профиль создан в таблице `users`
- ✅ Вход работает корректно

### Тестовые данные:
- Email: `test.user.1756310744705@electroservice.by`
- Пароль: `testpassword123`
- Роль: `worker`
- Статус: `active`

## 🎯 Результат

Теперь при регистрации нового пользователя:
1. Создается запись в `auth.users` (автоматически)
2. Создается профиль в таблице `users` (нашим кодом)
3. Пользователь может сразу войти в систему

## 🔧 Альтернативные решения

### 1. Database Trigger (рекомендуется для продакшена):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active, hourly_rate)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Новый пользователь'), 'worker', true, 2.0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Edge Function (для сложной логики):
- Создать Edge Function, которая срабатывает при регистрации
- Выполнять дополнительную логику (отправка email, создание профиля, etc.)

## 📝 Заключение

Проблема решена! Теперь все новые пользователи будут автоматически получать профили в таблице `users` при регистрации.
