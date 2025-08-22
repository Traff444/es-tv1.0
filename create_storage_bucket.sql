-- Создание storage bucket для фото задач
-- Выполнить в Supabase SQL Editor

-- Создаем bucket для фото задач
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  true,
  5242880, -- 5MB лимит на файл
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Создаем политики RLS для bucket
CREATE POLICY "Публичный доступ к фото задач" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-photos');

CREATE POLICY "Авторизованные пользователи могут загружать фото" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'task-photos' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Авторизованные пользователи могут обновлять свои фото" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'task-photos' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Авторизованные пользователи могут удалять свои фото" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'task-photos' 
    AND auth.role() = 'authenticated'
  );
