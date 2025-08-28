import React from 'react';
import type { Task } from '../types';

interface CurrentTaskCardProps {
  task: Task | null;
  taskElapsedTime: string;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onPause: () => void;
  onPhotoReport: () => void;
  loading: boolean;
}

// Simple Card component for Mini App
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

// Simple Badge component for Mini App
function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'warning' | 'secondary' | 'success' }) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    warning: 'bg-red-100 text-red-800',
    secondary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800'
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

// Simple Button component for Mini App
function Button({ 
  children, 
  onClick, 
  disabled, 
  variant = 'default',
  className = '' 
}: { 
  children: React.ReactNode; 
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline';
  className?: string;
}) {
  const variantClasses = {
    default: 'bg-blue-600 hover:bg-blue-700 text-white',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-3 px-4 rounded-lg font-medium transition-colors ${
        disabled 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300' 
          : variantClasses[variant]
      } ${className}`}
    >
      {children}
    </button>
  );
}

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'high': return 'Высокий';
    case 'medium': return 'Средний';
    case 'low': return 'Низкий';
    default: return 'Средний';
  }
};

export function CurrentTaskCard({ 
  task, 
  taskElapsedTime, 
  onStartTask, 
  onCompleteTask, 
  onPause, 
  onPhotoReport, 
  loading 
}: CurrentTaskCardProps) {
  if (!task) {
    return (
      <Card className="p-4">
        <div className="text-center py-8">
          <div className="text-2xl mb-3">📝</div>
          <div className="text-lg font-medium text-gray-900 mb-2">Нет текущей задачи</div>
          <div className="text-sm text-gray-500">Задачи будут назначены менеджером</div>
        </div>
      </Card>
    );
  }

  const priorityVariant = task.priority === 'high' ? 'warning' : 
                         task.priority === 'medium' ? 'secondary' : 'success';

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Текущая задача</h2>
        <Badge variant={priorityVariant}>
          {getPriorityLabel(task.priority)}
        </Badge>
      </div>
      
      <div className="text-gray-900 font-medium mb-1">{task.title}</div>
      {task.description && (
        <div className="text-sm text-gray-600 mb-2">{task.description}</div>
      )}
      
      {task.target_location && (
        <div className="text-sm text-gray-600 mb-2 flex items-center space-x-1">
          <span>📍</span>
          <span>Объект: {task.target_location}</span>
        </div>
      )}
      
      {(task.status === 'in_progress' || task.status === 'paused') && (
        <div className="text-sm text-gray-500 mb-4 bg-gray-50 p-2 rounded">
          ⏱️ Время в работе: <span className="font-medium">{taskElapsedTime}</span>
        </div>
      )}

      {/* Task Control Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Button
          variant="outline"
          onClick={() => {
            if (task.status === 'pending') {
              onStartTask(task.id);
            } else if (task.status === 'in_progress') {
              onPause();
            } else if (task.status === 'paused') {
              onStartTask(task.id);
            }
          }}
          disabled={loading || task.status === 'completed'}
        >
          {task.status === 'pending' ? '▶️ Начать' : 
           task.status === 'in_progress' ? '⏸️ Пауза' : 
           task.status === 'paused' ? '▶️ Продолжить' : 'В работу'}
        </Button>
        <Button
          variant="default"
          onClick={() => onCompleteTask(task.id)}
          disabled={loading || task.status !== 'in_progress'}
        >
          ✅ Завершить
        </Button>
      </div>

      {/* Photo Report Button */}
      <Button
        variant="outline"
        onClick={onPhotoReport}
        disabled={loading}
        className="w-full mb-2"
      >
        📷 Фото-отчёт
      </Button>

      {/* Status Info */}
      <div className="text-xs text-gray-500 text-center">
        Статус: <span className="font-medium">{
          task.status === 'pending' ? 'Ожидает начала' :
          task.status === 'in_progress' ? 'В работе' :
          task.status === 'paused' ? 'Приостановлено' :
          task.status === 'completed' ? 'Завершено' : task.status
        }</span>
      </div>
    </Card>
  );
}
