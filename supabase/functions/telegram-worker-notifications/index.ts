import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Интерфейсы для уведомлений рабочих
interface WorkerNotificationData {
  worker_id: string;
  task_id: string;
  manager_response: 'approved' | 'rejected' | 'request_photos';
  task_title: string;
  manager_name?: string;
  response_comment?: string;
  custom_message?: string;
}

interface TelegramMessage {
  chat_id: number;
  text: string;
  parse_mode?: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>>;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Обработка CORS preflight запросов
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Получаем переменные окружения
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const SUPABASE_URL = Deno.env.get('PROJECT_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN не настроен')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase конфигурация не настроена')
    }

    // Инициализируем Supabase клиент
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Парсим данные запроса
    const notificationData: WorkerNotificationData = await req.json()
    console.log('Получены данные для уведомления рабочего:', notificationData)

    // Получаем данные рабочего для отправки уведомления
    const { data: workerData, error: workerError } = await supabase
      .rpc('get_worker_telegram_data', { worker_uuid: notificationData.worker_id })

    if (workerError) {
      console.error('Ошибка получения данных рабочего:', workerError)
      throw new Error(`Ошибка получения данных рабочего: ${workerError.message}`)
    }

    if (!workerData || workerData.length === 0) {
      console.log('Рабочий с Telegram не найден:', notificationData.worker_id)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Рабочий с настроенным Telegram не найден' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    const worker = workerData[0]

    if (!worker.notifications_enabled) {
      console.log('Уведомления отключены для рабочего:', worker.worker_id)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Уведомления отключены для рабочего' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Формируем сообщение в зависимости от типа ответа
    let messageText: string
    let messageIcon: string
    let keyboard = null

    switch (notificationData.manager_response) {
      case 'approved':
        messageIcon = '✅'
        messageText = `✅ *Задача принята!*

📋 **${notificationData.task_title}**

🎉 Отличная работа! Задача успешно принята менеджером.
💰 Заработок добавлен к вашей статистике.

${notificationData.manager_name ? `Принял: ${notificationData.manager_name}` : ''}
⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`

        // Добавляем кнопку для просмотра статистики
        keyboard = {
          inline_keyboard: [
            [
              { 
                text: "📊 Посмотреть статистику", 
                url: `${SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'https://electroservice.vercel.app'}/worker` 
              }
            ]
          ]
        }
        break

      case 'rejected':
        messageIcon = '❌'
        messageText = `❌ *Задача возвращена на доработку*

📋 **${notificationData.task_title}**

${notificationData.response_comment ? `📝 **Причина:** ${notificationData.response_comment}` : ''}

📞 Пожалуйста, свяжитесь с менеджером для уточнения деталей и исправьте замечания.

${notificationData.manager_name ? `Вернул: ${notificationData.manager_name}` : ''}
⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`

        // Добавляем кнопки для действий
        keyboard = {
          inline_keyboard: [
            [
              { 
                text: "📋 Открыть задачу", 
                url: `${SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'https://electroservice.vercel.app'}/worker/task/${notificationData.task_id}` 
              }
            ],
            [
              { 
                text: "📞 Связаться с менеджером", 
                callback_data: `contact_manager_${notificationData.task_id}` 
              }
            ]
          ]
        }
        break

      case 'request_photos':
        messageIcon = '📸'
        messageText = `📸 *Требуются дополнительные фотографии*

📋 **${notificationData.task_title}**

🔍 Менеджер запросил дополнительные фотографии для полной оценки выполненной работы.

${notificationData.response_comment ? `💬 **Комментарий:** ${notificationData.response_comment}` : ''}

📷 Пожалуйста, сделайте дополнительные фото и отправьте задачу заново.

${notificationData.manager_name ? `Запросил: ${notificationData.manager_name}` : ''}
⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`

        // Добавляем кнопку для добавления фото
        keyboard = {
          inline_keyboard: [
            [
              { 
                text: "📸 Добавить фото", 
                url: `${SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'https://electroservice.vercel.app'}/worker/task/${notificationData.task_id}/photos` 
              }
            ]
          ]
        }
        break

      default:
        messageIcon = 'ℹ️'
        messageText = notificationData.custom_message || `
ℹ️ *Обновление по задаче*

📋 **${notificationData.task_title}**

Статус задачи обновлен. Проверьте приложение для получения подробной информации.

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`
    }

    // Отправляем уведомление
    const message: TelegramMessage = {
      chat_id: worker.chat_id,
      text: messageText,
      parse_mode: 'Markdown',
      reply_markup: keyboard || undefined
    }

    console.log('Отправляем уведомление рабочему:', {
      chat_id: worker.chat_id,
      worker_name: worker.full_name,
      task_id: notificationData.task_id,
      response_type: notificationData.manager_response
    })

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      }
    )

    const telegramResult = await telegramResponse.json()

    if (!telegramResult.ok) {
      console.error('Ошибка отправки в Telegram:', telegramResult)
      throw new Error(`Telegram API error: ${telegramResult.description}`)
    }

    const messageId = telegramResult.result?.message_id

    console.log('Уведомление рабочему отправлено, ID:', messageId)

    // Логируем отправленное уведомление в базу данных
    if (messageId) {
      const notificationType = notificationData.manager_response === 'approved' ? 'task_approved' :
                              notificationData.manager_response === 'rejected' ? 'task_rejected' : 
                              'photos_requested'

      const { error: logError } = await supabase
        .from('task_notifications')
        .insert({
          task_id: notificationData.task_id,
          worker_id: notificationData.worker_id,
          telegram_message_id: messageId,
          notification_type: notificationType,
          status: 'sent'
        })

      if (logError) {
        console.error('Ошибка логирования уведомления рабочего:', logError)
        // Не бросаем ошибку, так как основная функция выполнена
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Уведомление рабочему отправлено',
        telegram_message_id: messageId,
        notification_type: notificationData.manager_response
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Ошибка в telegram-worker-notifications function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})