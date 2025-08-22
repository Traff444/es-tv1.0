-- Создание storage bucket для фото задач
-- Миграция для создания bucket и политик

-- Создаем bucket для фото задач
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  true,
  5242880, -- 5MB лимит на файл
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Создаем политики RLS для bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_access_to_task_photos') THEN
    CREATE POLICY "public_access_to_task_photos" ON storage.objects
      FOR SELECT USING (bucket_id = 'task-photos');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_users_can_upload_photos') THEN
    CREATE POLICY "authenticated_users_can_upload_photos" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'task-photos' 
        AND auth.role() = 'authenticated'
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_users_can_update_photos') THEN
    CREATE POLICY "authenticated_users_can_update_photos" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'task-photos' 
        AND auth.role() = 'authenticated'
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_users_can_delete_photos') THEN
    CREATE POLICY "authenticated_users_can_delete_photos" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'task-photos' 
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;
