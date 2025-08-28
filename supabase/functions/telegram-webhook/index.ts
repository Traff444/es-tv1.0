import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Интерфейсы для Telegram API
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN не настроен')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase конфигурация не настроена')
    }

    // Инициализируем Supabase клиент
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Парсим webhook данные от Telegram
    const update: TelegramUpdate = await req.json()
    console.log('Получен webhook от Telegram:', update.update_id)

    // Обрабатываем callback query (нажатие на inline кнопки)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, supabase, TELEGRAM_BOT_TOKEN)
    }

    // Обрабатываем обычные сообщения
    if (update.message) {
      await handleMessage(update.message, supabase, TELEGRAM_BOT_TOKEN)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Ошибка в telegram-webhook function:', error)
    
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

// Функция обработки callback query (нажатия на кнопки)
async function handleCallbackQuery(
  callbackQuery: CallbackQuery, 
  supabase: any, 
  botToken: string
) {
  const { id, from, message, data } = callbackQuery

  if (!data || !message) {
    console.log('Callback query без data или message')
    return
  }

  console.log('Обработка callback:', data, 'от пользователя:', from.id)

  // Парсим данные из callback_data
  const [action, taskId] = data.split('_')

  if (!action || !taskId) {
    console.error('Неверный формат callback_data:', data)
    await answerCallbackQuery(id, '❌ Ошибка обработки команды', botToken)
    return
  }

  try {
    // Проверяем, что пользователь имеет права на действие
    const { data: telegramUser, error: userError } = await supabase
      .from('telegram_users')
      .select(`
        user_id,
        users (
          id,
          role,
          full_name,
          is_active
        )
      `)
      .eq('telegram_id', from.id)
      .eq('is_active', true)
      .single()

    if (userError || !telegramUser) {
      console.error('Пользователь Telegram не найден:', from.id)
      await answerCallbackQuery(
        id, 
        '❌ Ваш аккаунт не связан с системой', 
        botToken
      )
      return
    }

    const user = telegramUser.users
    if (!user?.is_active || !['manager', 'director', 'admin'].includes(user.role)) {
      console.error('Пользователь не имеет прав:', user)
      await answerCallbackQuery(
        id, 
        '❌ У вас нет прав для выполнения этого действия', 
        botToken
      )
      return
    }

    // Выполняем действие в зависимости от команды
    let responseText = ''
    let newMessageText = ''

    switch (action) {
      case 'approve':
        await approveTask(taskId, user.id, supabase)
        responseText = '✅ Задача принята'
        newMessageText = `✅ *ЗАДАЧА ПРИНЯТА*\n\nПринято менеджером: ${user.full_name}\nВремя: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`
        break

      case 'reject':
        await rejectTask(taskId, user.id, supabase)
        responseText = '❌ Задача отклонена'
        newMessageText = `❌ *ЗАДАЧА ОТКЛОНЕНА*\n\nОтклонено менеджером: ${user.full_name}\nВремя: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}\n\n_Рабочий получил уведомление_`
        break

      case 'request':
        await requestMorePhotos(taskId, user.id, supabase)
        responseText = '📸 Запрошены дополнительные фото'
        newMessageText = `📸 *ЗАПРОШЕНЫ ДОПОЛНИТЕЛЬНЫЕ ФОТО*\n\nЗапросил: ${user.full_name}\nВремя: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}\n\n_Рабочий получил уведомление_`
        break

      case 'details':
        await sendTaskDetails(taskId, from.id, supabase, botToken)
        responseText = '👁 Подробная информация отправлена'
        break

      default:
        responseText = '❌ Неизвестная команда'
    }

    // Отвечаем на callback query
    await answerCallbackQuery(id, responseText, botToken)

    // Обновляем сообщение (убираем кнопки и показываем результат)
    if (newMessageText && action !== 'details') {
      await editMessageText(
        message.chat.id,
        message.message_id,
        newMessageText,
        botToken
      )
    }

  } catch (error) {
    console.error('Ошибка обработки callback query:', error)
    await answerCallbackQuery(
      id, 
      '❌ Произошла ошибка при обработке команды', 
      botToken
    )
  }
}

// Функция обработки обычных сообщений
async function handleMessage(
  message: TelegramMessage, 
  supabase: any, 
  botToken: string
) {
  const { from, chat, text } = message

  console.log('Получено сообщение:', text, 'от пользователя:', from.id)

  // Обрабатываем команду /start
  if (text === '/start') {
    await handleStartCommand(chat.id, from, supabase, botToken)
    return
  }

  // Обрабатываем другие команды
  if (text?.startsWith('/')) {
    await handleUnknownCommand(chat.id, botToken)
    return
  }

  // Для обычных сообщений отправляем справку
  await sendHelpMessage(chat.id, botToken)
}

// Обработка команды /start
async function handleStartCommand(
  chatId: number,
  from: TelegramUser,
  supabase: any,
  botToken: string
) {
  const welcomeMessage = `👋 Добро пожаловать в *ЭлектроСервис*!

Этот бот предназначен для менеджеров и директоров компании.

🔗 *Для связи аккаунта:*
1. Войдите в веб-интерфейс системы
2. Перейдите в "Настройки профиля"  
3. Введите ваш Telegram ID: \`${from.id}\`
4. Нажмите "Связать аккаунт"

📱 *После связки вы будете получать:*
• Уведомления о завершенных задачах
• Фото-отчеты от рабочих
• Возможность принимать/отклонять работы

❓ Для справки отправьте /help`

  await sendTelegramMessage(chatId, welcomeMessage, 'Markdown', botToken)
}

// Обработка неизвестной команды
async function handleUnknownCommand(chatId: number, botToken: string) {
  const message = `❓ Неизвестная команда.

📋 *Доступные команды:*
/start - Начать работу с ботом
/help - Справка

Для получения уведомлений о задачах свяжите ваш аккаунт в веб-интерфейсе системы.`

  await sendTelegramMessage(chatId, message, 'Markdown', botToken)
}

// Отправка справки
async function sendHelpMessage(chatId: number, botToken: string) {
  const helpMessage = `📋 *Справка по ЭлектроСервис боту*

🎯 *Назначение:*
Этот бот предназначен для уведомлений менеджеров о завершенных задачах.

⚡ *Функции:*
• Получение уведомлений о завершенных задачах
• Просмотр фото-отчетов
• Принятие/отклонение работ
• Запрос дополнительных фото

🔗 *Настройка:*
Для получения уведомлений свяжите ваш Telegram аккаунт в веб-интерфейсе системы (Настройки → Telegram ID: \`${chatId}\`)

❓ Вопросы? Обратитесь к администратору системы.`

  await sendTelegramMessage(chatId, helpMessage, 'Markdown', botToken)
}

// Функции действий с задачами
async function approveTask(taskId: string, managerId: string, supabase: any) {
  console.log('Принятие задачи:', taskId, 'менеджером:', managerId)

  // Вызываем функцию приемки задачи
  const { error } = await supabase.rpc('process_task_approval', {
    task_uuid: taskId,
    action: 'approve',
    comment: 'Принято через Telegram'
  })

  if (error) {
    console.error('Ошибка принятия задачи:', error)
    throw new Error(`Ошибка принятия задачи: ${error.message}`)
  }

  // Уведомляем рабочего о принятии
  await notifyWorker(taskId, 'approved', 'Ваша задача принята менеджером!', supabase)
}

async function rejectTask(taskId: string, managerId: string, supabase: any) {
  console.log('Отклонение задачи:', taskId, 'менеджером:', managerId)

  // Вызываем функцию отклонения задачи
  const { error } = await supabase.rpc('process_task_approval', {
    task_uuid: taskId,
    action: 'return',
    comment: 'Отклонено через Telegram'
  })

  if (error) {
    console.error('Ошибка отклонения задачи:', error)
    throw new Error(`Ошибка отклонения задачи: ${error.message}`)
  }

  // Уведомляем рабочего об отклонении
  await notifyWorker(taskId, 'rejected', 'Ваша задача возвращена на доработку.', supabase)
}

async function requestMorePhotos(taskId: string, managerId: string, supabase: any) {
  console.log('Запрос дополнительных фото для задачи:', taskId)

  // Изменяем статус задачи на требующий дополнительных фото
  const { error } = await supabase
    .from('tasks')
    .update({ 
      status: 'awaiting_photos',
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)

  if (error) {
    console.error('Ошибка обновления статуса задачи:', error)
    throw new Error(`Ошибка обновления статуса: ${error.message}`)
  }

  // Уведомляем рабочего о необходимости дополнительных фото
  await notifyWorker(
    taskId, 
    'photos_requested', 
    'Требуются дополнительные фотографии. Пожалуйста, добавьте фото и отправьте задачу заново.', 
    supabase
  )
}

async function sendTaskDetails(
  taskId: string, 
  telegramId: number, 
  supabase: any, 
  botToken: string
) {
  console.log('Отправка подробностей задачи:', taskId)

  // Получаем подробную информацию о задаче
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      *,
      assigned_user:users!assigned_to(full_name, email),
      task_photos(photo_url, photo_type),
      task_checklist(item_name, is_completed, notes)
    `)
    .eq('id', taskId)
    .single()

  if (error || !task) {
    console.error('Ошибка получения данных задачи:', error)
    await sendTelegramMessage(
      telegramId,
      '❌ Не удалось получить подробности задачи',
      undefined,
      botToken
    )
    return
  }

  // Формируем подробное сообщение
  const details = `📋 *Подробности задачи*

*Название:* ${task.title}
*Описание:* ${task.description || 'Не указано'}
*Исполнитель:* ${task.assigned_user?.full_name || 'Не назначен'}
*Приоритет:* ${task.priority || 'Обычный'}
*Адрес:* ${task.address || 'Не указан'}

⏰ *Время выполнения:*
• Начато: ${task.started_at ? new Date(task.started_at).toLocaleString('ru-RU') : 'Не начато'}
• Завершено: ${task.completed_at ? new Date(task.completed_at).toLocaleString('ru-RU') : 'Не завершено'}

📸 *Фотографии:* ${task.task_photos?.length || 0} шт.
✅ *Чек-лист:* ${task.task_checklist?.filter((item: any) => item.is_completed).length || 0}/${task.task_checklist?.length || 0}`

  await sendTelegramMessage(telegramId, details, 'Markdown', botToken)
}

// Функция уведомления рабочего
async function notifyWorker(
  taskId: string, 
  notificationType: string, 
  message: string, 
  supabase: any
) {
  console.log('Уведомление рабочего о задаче:', taskId, 'тип:', notificationType)

  // Здесь можно добавить логику отправки уведомления рабочему
  // Пока просто логируем в базу данных
  const { error } = await supabase
    .from('task_notifications')
    .insert({
      task_id: taskId,
      notification_type: notificationType,
      status: 'sent'
    })

  if (error) {
    console.error('Ошибка логирования уведомления рабочему:', error)
  }
}

// Вспомогательные функции для Telegram API
async function answerCallbackQuery(
  callbackQueryId: string, 
  text: string, 
  botToken: string
) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: false
    })
  })
}

async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  botToken: string
) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'Markdown'
    })
  })
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  parseMode?: string,
  botToken?: string
) {
  if (!botToken) {
    console.error('Bot token не предоставлен для отправки сообщения')
    return
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode
    })
  })
}