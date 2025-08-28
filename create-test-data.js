#!/usr/bin/env node

/**
 * Скрипт для создания тестовых данных для Telegram Mini App
 */

import { createClient } from '@supabase/supabase-js'

// Конфигурация Supabase
const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createTestData() {
  console.log('🚀 Создание тестовых данных для Telegram Mini App...\n')

  try {
    // 1. Создаем тестового рабочего
    console.log('👤 Создание тестового рабочего...')
    const { data: worker, error: workerError } = await supabase.auth.signUp({
      email: 'test.worker@electroservice.by',
      password: 'telegram_481890'
    })

    if (workerError && !workerError.message.includes('already registered')) {
      throw workerError
    }

    if (worker.user) {
      console.log(`✅ Рабочий создан: ${worker.user.email}`)

      // Обновляем профиль рабочего
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: worker.user.id,
          email: worker.user.email,
          full_name: 'Тестовый Рабочий',
          role: 'worker',
          is_active: true
        })

      if (profileError) {
        console.error('❌ Ошибка создания профиля рабочего:', profileError)
      } else {
        console.log('✅ Профиль рабочего обновлен')
      }
    }

    // 2. Получаем всех пользователей для создания задач
    console.log('\n📊 Получение списка пользователей...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')

    if (usersError) {
      throw usersError
    }

    console.log(`✅ Найдено пользователей: ${users.length}`)
    users.forEach(user => {
      console.log(`   ${user.role}: ${user.email}`)
    })

    // 3. Создаем тестовые задачи
    console.log('\n📋 Создание тестовых задач...')

    const workerUser = users.find(u => u.role === 'worker')
    const managerUser = users.find(u => u.role === 'manager')

    if (!workerUser) {
      console.error('❌ Рабочий не найден!')
      return
    }

    const tasks = [
      {
        title: 'Установка розетки в офисе',
        description: 'Установить двойную розетку в кабинете директора',
        priority: 'high',
        status: 'pending',
        assigned_to: workerUser.id,
        created_by: managerUser?.id || workerUser.id,
        estimated_hours: 1.5,
        target_location: 'Кабинет директора, 3 этаж'
      },
      {
        title: 'Замена выключателя в коридоре',
        description: 'Заменить старый выключатель на новый с подсветкой',
        priority: 'medium',
        status: 'in_progress',
        assigned_to: workerUser.id,
        created_by: managerUser?.id || workerUser.id,
        estimated_hours: 1,
        started_at: new Date().toISOString(),
        target_location: 'Коридор, 2 этаж'
      },
      {
        title: 'Монтаж распределительной коробки',
        description: 'Установить и подключить распределительную коробку в подвале',
        priority: 'low',
        status: 'pending',
        assigned_to: workerUser.id,
        created_by: managerUser?.id || workerUser.id,
        estimated_hours: 3,
        target_location: 'Подвал, помещение электроснабжения'
      }
    ]

    for (const taskData of tasks) {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()

      if (taskError) {
        console.error(`❌ Ошибка создания задачи "${taskData.title}":`, taskError)
      } else {
        console.log(`✅ Задача создана: ${task[0].title}`)
      }
    }

    // 4. Создаем тестовую смену
    console.log('\n⏰ Создание тестовой смены...')

    const { data: session, error: sessionError } = await supabase
      .from('work_sessions')
      .insert({
        user_id: workerUser.id,
        start_time: new Date().toISOString(),
        start_location: '53.902284,27.561831' // Минск, случайные координаты
      })
      .select()

    if (sessionError) {
      console.error('❌ Ошибка создания смены:', sessionError)
    } else {
      console.log('✅ Смена создана для рабочего')
    }

    // 5. Проверяем созданные данные
    console.log('\n📊 Проверка созданных данных...')

    const { data: finalTasks, error: finalTasksError } = await supabase
      .from('tasks')
      .select('id, title, status, assigned_to')

    if (!finalTasksError) {
      console.log(`📋 Всего задач: ${finalTasks.length}`)
      finalTasks.forEach(task => {
        console.log(`   - ${task.title} (${task.status})`)
      })
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('work_sessions')
      .select('id, start_time, end_time')
      .is('end_time', null)

    if (!sessionsError) {
      console.log(`⏰ Активных смен: ${sessions.length}`)
    }

    console.log('\n🎉 Тестовые данные созданы успешно!')
    console.log('\n📝 Тестовые аккаунты:')
    console.log('   Рабочий: test.worker@electroservice.by / telegram_481890')
    console.log('\n🌐 Telegram Mini App доступен по адресу:')
    console.log('   http://localhost:5175')
    console.log('\n🧪 Тестовая страница:')
    console.log('   http://localhost:5175/test-standalone.html')

  } catch (error) {
    console.error('❌ Ошибка создания тестовых данных:', error)
    process.exit(1)
  }
}

// Запуск скрипта
createTestData()
