import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, MapPin } from 'lucide-react';
import { Task } from '../../types';

interface ObjectsListProps {
  tasks: Task[];
  onMoveStart: (taskId: string) => void;
  loading: boolean;
}

const ObjectsListComponent = ({ tasks, onMoveStart, loading }: ObjectsListProps) => {
  // Фильтруем задачи, у которых есть target_location и которые ожидают начала (только pending)
  const tasksWithLocation = tasks.filter(task => 
    task.target_location && 
    task.status === 'pending'
  );

  // Группируем задачи по target_location (уникальные объекты)
  const uniqueLocations = new Map<string, { 
    location: string, 
    tasks: Task[], 
    firstTask: Task 
  }>();

  tasksWithLocation.forEach(task => {
    const location = task.target_location!;
    if (!uniqueLocations.has(location)) {
      uniqueLocations.set(location, {
        location,
        tasks: [task],
        firstTask: task
      });
    } else {
      uniqueLocations.get(location)!.tasks.push(task);
    }
  });

  const objects = Array.from(uniqueLocations.values());

  if (objects.length === 0) {
    return (
      <Card className="p-4">
        <div className="mb-2">
          <h2 className="text-lg font-semibold">Объекты</h2>
        </div>
        <div className="text-center py-4 text-slate-500">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">Нет незавершенных объектов</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Объекты</h2>
        <p className="text-sm text-slate-500">Незавершенные объекты для посещения</p>
      </div>
      
      <div className="space-y-3">
        {objects.map((obj) => (
          <div
            key={obj.location}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900 mb-1">
                Объект: {obj.location}
              </div>
              <div className="flex items-center space-x-1 text-xs text-slate-600">
                <MapPin className="w-3 h-3" />
                <span>{obj.location}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Задач на объекте: {obj.tasks.length}
                {obj.tasks.length > 1 && (
                  <div className="text-xs text-slate-400 mt-1">
                    {obj.tasks.map(t => t.title).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={() => onMoveStart(obj.firstTask.id)}
              disabled={loading}
            >
              <Truck className="w-4 h-4 mr-1" />
              В путь
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const ObjectsList = React.memo(ObjectsListComponent);