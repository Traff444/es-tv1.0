-- Minimal approval functions (cloud)
set search_path = public;

create or replace function public.update_reliability_score(user_uuid uuid)
returns void language plpgsql security definer as $$
declare total_tasks int; returned_tasks int; completed_tasks int; new_score numeric;
begin
  select count(*) into total_tasks from tasks
  where assigned_to=user_uuid and created_at>=now()-interval '30 days'
    and status in ('done','awaiting_approval','returned_for_revision');

  select count(*) into returned_tasks from tasks
  where assigned_to=user_uuid and status='returned_for_revision'
    and returned_for_revision_at>=now()-interval '30 days';

  select count(*) into completed_tasks from tasks
  where assigned_to=user_uuid and status='done'
    and approved_at>=now()-interval '30 days';

  if total_tasks=0 then 
    new_score:=1.0; 
  else 
    new_score:=greatest(0.0, least(1.0, (completed_tasks-returned_tasks)::numeric/total_tasks)); 
  end if;

  insert into user_reliability_scores (user_id, score, tasks_completed, tasks_returned, last_calculated_at)
  values (user_uuid, new_score, completed_tasks, returned_tasks, now())
  on conflict (user_id) do update set
    score=excluded.score,
    tasks_completed=excluded.tasks_completed,
    tasks_returned=excluded.tasks_returned,
    last_calculated_at=now(),
    updated_at=now();
end $$;

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
  if not found then 
    return jsonb_build_object('success',false,'error','Задача не найдена'); 
  end if;

  if task_record.status <> 'awaiting_approval' then
    return jsonb_build_object('success',false,'error','Задача должна быть в статусе "На приёмке"');
  end if;

  if action='approve' then
    update tasks 
      set status='done', 
          approved_at=now(), 
          approved_by=auth.uid(), 
          approval_comment=comment 
    where id=task_uuid;

    perform update_reliability_score(task_record.assigned_to);

    return jsonb_build_object('success',true,'message','Задача принята','task_id',task_uuid,'approved_at',now(),'approved_by',auth.uid());

  elsif action='return' then
    if comment is null or btrim(comment)='' then
      return jsonb_build_object('success',false,'error','Комментарий обязателен при возврате задачи');
    end if;

    update tasks 
      set status='awaiting_photos', 
          returned_for_revision_at=now(), 
          revision_comment=comment 
    where id=task_uuid;

    perform update_reliability_score(task_record.assigned_to);

    return jsonb_build_object('success',true,'message','Задача возвращена на доработку','task_id',task_uuid,'returned_at',now(),'returned_by',auth.uid(),'comment',comment);

  else
    return jsonb_build_object('success',false,'error','Неверное действие. Допустимые значения: approve, return');
  end if;
end $$;


