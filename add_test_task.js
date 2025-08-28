import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addTestTask() {
  console.log('📋 Adding test task for worker...')
  
  // Find worker
  const { data: worker } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'test.worker@electroservice.by')
    .single()
    
  if (!worker) {
    console.error('❌ Worker not found')
    return
  }
  
  // Find or create manager
  let { data: manager } = await supabase
    .from('users')
    .select('*')
    .in('role', ['manager', 'director', 'admin'])
    .limit(1)
    .single()
    
  if (!manager) {
    console.log('Creating test manager...')
    const { data: managerAuth } = await supabase.auth.admin.createUser({
      email: 'test.manager@electroservice.by',
      password: 'manager123',
      email_confirm: true
    })

    if (managerAuth?.user) {
      const { error: managerProfileError } = await supabase
        .from('users')
        .insert({
          id: managerAuth.user.id,
          email: 'test.manager@electroservice.by',
          full_name: 'Тестовый Менеджер',
          role: 'manager',
          is_active: true
        })

      if (!managerProfileError) {
        manager = { id: managerAuth.user.id }
        console.log('✅ Test manager created')
      }
    }
  }
  
  if (!manager) {
    console.error('❌ Could not create or find manager')
    return
  }
  
  // Create test task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      title: 'Тестовая задача - Telegram Mini App',
      description: 'Установка розетки с фото-отчетом через Telegram Mini App. Проверьте систему фотографий "до" и "после".',
      priority: 'medium',
      status: 'pending',
      assigned_to: worker.id,
      created_by: manager.id,
      target_location: 'ул. Тестовая, 1, Минск',
      estimated_hours: 2.0
    })
    .select()
    
  if (taskError) {
    console.error('❌ Task creation error:', taskError.message)
  } else {
    console.log('✅ Test task created:', task[0].id)
    console.log('📝 Task details:')
    console.log('   Title:', task[0].title)
    console.log('   Status:', task[0].status)
    console.log('   Location:', task[0].target_location)
  }
}

addTestTask()