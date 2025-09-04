import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://enyewzeskpiqueogmssp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueWV3emVza3BpcXVlb2dtc3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTA4MDcsImV4cCI6MjA3MTg2NjgwN30.KdkzBPdw6lrCE2LW2epl9JDtcOjSccW8rkon4DVrINE'
const TARGET_TELEGRAM_ID = 112959758

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })

async function main() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, description, assigned_to, submitted_at')
    .eq('status', 'awaiting_approval')
    .order('submitted_at', { ascending: false })
    .limit(1)

  if (error) throw error
  if (!tasks || tasks.length === 0) {
    console.log('Нет задач в awaiting_approval — завершите любую задачу с фото и повторите')
    process.exit(0)
  }

  const task = tasks[0]

  const { data: photos } = await supabase
    .from('task_photos')
    .select('photo_url')
    .eq('task_id', task.id)
    .limit(10)

  const photoUrls = (photos || []).map(p => p.photo_url).filter(Boolean)

  const { data: worker } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', task.assigned_to)
    .maybeSingle()

  const payload = {
    task_id: task.id,
    worker_id: worker?.id || 'unknown',
    worker_name: worker?.full_name || 'Рабочий',
    task_title: task.title,
    task_description: task.description || '',
    completed_at: new Date().toISOString(),
    photos: photoUrls,
    manager_telegram_id: TARGET_TELEGRAM_ID
  }

  const { data: invokeData, error: invokeError } = await supabase.functions.invoke('telegram-notifications', { body: payload })

  if (invokeError) {
    console.error('Invoke error:', invokeError)
    process.exit(1)
  }

  console.log('OK:', invokeData)
}

main().catch(e => { console.error(e); process.exit(1) })
