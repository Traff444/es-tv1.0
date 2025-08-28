import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTestTask() {
  console.log('📋 Creating test task...')
  
  const workerId = '58202ece-1f98-4118-aba2-60be54cae94a'
  
  try {
    // Create test task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: 'Тестовая задача - Установка розетки',
        description: 'Установка новой розетки в офисе. Требуется фото "до" и "после" работы.',
        priority: 'medium',
        status: 'pending',
        assigned_to: workerId,
        created_by: workerId, // Self-assigned for testing
        target_location: 'ул. Тестовая, 1, Минск',
        estimated_hours: 2.0
      })
      .select()
    
    if (taskError) {
      console.error('❌ Task creation error:', taskError.message)
      return
    }
    
    console.log('✅ Test task created successfully!')
    console.log('📝 Task ID:', task[0].id)
    console.log('📝 Title:', task[0].title)
    console.log('📝 Status:', task[0].status)
    console.log('📍 Location:', task[0].target_location)
    
    // Verify task is assigned to worker
    const { data: workerTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', workerId)
    
    if (fetchError) {
      console.error('❌ Error fetching tasks:', fetchError.message)
    } else {
      console.log(`✅ Worker now has ${workerTasks.length} task(s) assigned`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

createTestTask()