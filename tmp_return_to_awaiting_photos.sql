set search_path = public;

create or replace function public.process_task_approval(
  task_uuid uuid,
  action text,
  comment text default null
)
returns jsonb language plpgsql security definer as $$
declare task_record tasks%rowtype;
begin
  if not exists (select 1 from users u where u.id=auth.uid() and u.role in ('manager','director','admin')) then
    return jsonb_build_object('success',false,'error','Недостаточно прав для приёмки задач');
  end if;

  select * into task_record from tasks where id=task_uuid;
  if not found then return jsonb_build_object('success',false,'error','Задача не найдена'); end if;

  if task_record.status <> 'awaiting_approval' then
    return jsonb_build_object('success',false,'error','Задача должна быть в статусе "На приёмке"');
  end if;

  if action='approve' then
    update tasks 
      set status='completed', 
          approved_at=now(), 
          approved_by=auth.uid(), 
          approval_comment=comment,
          updated_at=now()
    where id=task_uuid;

    perform update_reliability_score(task_record.assigned_to);

    return jsonb_build_object('success',true,'message','Задача принята','task_id',task_uuid,'approved_at',now(),'approved_by',auth.uid());

  elsif action='return' then
    if comment is null or btrim(comment)='' then
      return jsonb_build_object('success',false,'error','Комментарий обязателен при возврате задачи');
    end if;

    update tasks 
      set status='awaiting_photos', 
          revision_comment=comment,
          returned_for_revision_at=now(),
          updated_at=now()
    where id=task_uuid;

    perform update_reliability_score(task_record.assigned_to);

    return jsonb_build_object('success',true,'message','Задача возвращена на доработку','task_id',task_uuid,'returned_at',now(),'returned_by',auth.uid(),'comment',comment);

  else
    return jsonb_build_object('success',false,'error','Неверное действие. Допустимые значения: approve, return');
  end if;
end $$;
