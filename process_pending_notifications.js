/**
 * Автоматический обработчик ожидающих Telegram уведомлений
 * 
 * Этот скрипт:
 * 1. Получает все ожидающие уведомления из БД
 * 2. Отправляет их через Edge Function
 * 3. Обновляет статус на 'success' или 'error'
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function processPendingNotifications() {
  console.log('🔄 Ищу ожидающие уведомления...');
  
  try {
    // Получаем ожидающие уведомления
    const { data: pendingCalls, error } = await supabase
      .from('edge_function_calls')
      .select('*')
      .eq('function_name', 'telegram-notifications')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('❌ Ошибка получения ожидающих уведомлений:', error);
      return;
    }

    if (!pendingCalls || pendingCalls.length === 0) {
      console.log('✅ Нет ожидающих уведомлений');
      return;
    }

    console.log(`📋 Найдено ${pendingCalls.length} ожидающих уведомлений`);

    for (const call of pendingCalls) {
      console.log(`📤 Обрабатываю уведомление для задачи: ${call.payload.task_title}`);
      
      try {
        // Вызываем Edge Function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/telegram-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify(call.payload)
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Обновляем статус на success
          await supabase
            .from('edge_function_calls')
            .update({ 
              status: 'success',
              response: result,
              completed_at: new Date().toISOString()
            })
            .eq('id', call.id);

          console.log(`✅ Уведомление отправлено! Message ID: ${result.telegram_message_id}`);
        } else {
          // Обновляем статус на error
          await supabase
            .from('edge_function_calls')
            .update({ 
              status: 'error',
              error_message: result.error || 'Неизвестная ошибка',
              completed_at: new Date().toISOString()
            })
            .eq('id', call.id);

          console.log(`❌ Ошибка отправки: ${result.error || 'Неизвестная ошибка'}`);
        }
      } catch (err) {
        console.error(`❌ Ошибка обработки уведомления ${call.id}:`, err);
        
        // Обновляем статус на error
        await supabase
          .from('edge_function_calls')
          .update({ 
            status: 'error',
            error_message: err.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', call.id);
      }
    }

    console.log('🎉 Обработка завершена!');

  } catch (error) {
    console.error('❌ Общая ошибка:', error);
  }
}

// Запускаем обработчик
processPendingNotifications();