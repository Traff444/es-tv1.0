import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Task, User } from '../types';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

type KanbanStatus = 'pending' | 'in_progress' | 'paused' | 'awaiting_photos' | 'awaiting_approval' | 'returned' | 'completed';

const STATUS_TITLES: Record<KanbanStatus, string> = {
  pending: 'Новые',
  in_progress: 'В работе',
  paused: 'На паузе',
  awaiting_photos: 'Ожидают фото',
  awaiting_approval: 'На приёмке',
  returned: 'Возвращены',
  completed: 'Завершены',
};

const STATUS_ORDER: KanbanStatus[] = [
  'pending',
  'in_progress',
  'paused',
  'awaiting_photos',
  'awaiting_approval',
  'returned',
  'completed',
];

interface TaskWithUsers extends Task {
  assignee?: User;
  creator?: User;
}

export const KanbanBoard: React.FC = () => {
  const [tasks, setTasks] = useState<TaskWithUsers[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<string | 'ALL'>('ALL');
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const loadTasks = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:users!assigned_to(*),
          creator:users!created_by(*)
        `)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setTasks((data as any) || []);
    } catch (e) {
      console.error('[Kanban] loadTasks error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const objects = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.target_location && t.target_location.trim().length > 0) {
        set.add(t.target_location.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedObject === 'ALL') return true;
      return (t.target_location || '').trim() === selectedObject;
    });
  }, [tasks, selectedObject]);

  const columns = useMemo(() => {
    const map: Record<KanbanStatus, TaskWithUsers[]> = {
      pending: [], in_progress: [], paused: [], awaiting_photos: [], awaiting_approval: [], returned: [], completed: [],
    };
    for (const t of filteredTasks) {
      const status = (t.status || 'pending') as KanbanStatus;
      if (map[status]) map[status].push(t);
    }
    return map;
  }, [filteredTasks]);

  const onDragStart = (taskId: string) => {
    setDragTaskId(taskId);
  };

  const onDropToStatus = async (status: KanbanStatus) => {
    if (!dragTaskId || !supabase) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', dragTaskId);
      if (error) throw error;
      setDragTaskId(null);
      await loadTasks();
    } catch (e) {
      console.error('[Kanban] update status error', e);
    }
  };

  const onAllowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const renderTaskCard = (task: TaskWithUsers) => {
    return (
      <div
        key={task.id}
        className="p-3 rounded-lg border bg-white hover:shadow-sm cursor-move"
        draggable
        onDragStart={() => onDragStart(task.id)}
        title={task.description}
      >
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm line-clamp-2">{task.title}</div>
          <Badge variant="secondary">{task.priority}</Badge>
        </div>
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
          {task.assignee?.full_name && (<span>👤 {task.assignee.full_name}</span>)}
          {task.target_location && (<span>📍 {task.target_location}</span>)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Канбан — задачи по объектам</CardTitle>
            <div className="flex items-center gap-2">
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={selectedObject}
                onChange={(e) => setSelectedObject(e.target.value as any)}
              >
                <option value="ALL">Все объекты</option>
                {objects.map(obj => (
                  <option key={obj} value={obj}>{obj}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={loadTasks} disabled={loading}>
                Обновить
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {STATUS_ORDER.map((st) => (
                <div key={st} className="bg-gray-50 rounded-lg border min-h-[240px] flex flex-col">
                  <div className="px-3 py-2 border-b bg-white rounded-t-lg flex items-center justify-between">
                    <span className="text-sm font-medium">{STATUS_TITLES[st]}</span>
                    <Badge variant="outline">{columns[st].length}</Badge>
                  </div>
                  <div
                    className="p-3 flex-1 space-y-2"
                    onDragOver={onAllowDrop}
                    onDrop={() => onDropToStatus(st)}
                  >
                    {columns[st].map(renderTaskCard)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KanbanBoard;


