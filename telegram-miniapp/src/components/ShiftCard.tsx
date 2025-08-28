import React from 'react';

type ShiftStatus = 'running' | 'pause' | 'idle';

interface ShiftCardProps {
  status: ShiftStatus;
  outside: boolean;
  currentTime: string;
  onMainAction: () => void;
  loading: boolean;
  workSessionDuration?: string;
}

// Simple Card component for Mini App
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
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
  variant?: 'default' | 'destructive';
  className?: string;
}) {
  const variantClasses = {
    default: 'bg-blue-600 hover:bg-blue-700 text-white',
    destructive: 'bg-red-600 hover:bg-red-700 text-white'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
        disabled 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
          : variantClasses[variant]
      } ${className}`}
    >
      {children}
    </button>
  );
}

function mainCtaLabel(status: ShiftStatus, outside: boolean): string {
  if (status === 'idle') return outside ? 'Начать (unverified)' : 'Начать работу';
  if (status === 'running') return 'Завершить смену';
  return 'Вернуться к работе';
}

export function ShiftCard({ 
  status, 
  outside, 
  currentTime, 
  onMainAction, 
  loading,
  workSessionDuration 
}: ShiftCardProps) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Текущая смена</h2>
        <div className="text-sm text-gray-500">
          {status === 'running' && workSessionDuration 
            ? `в смене ${workSessionDuration}` 
            : '—'
          }
        </div>
      </div>

      <div className="mb-4 text-gray-600">
        <div className="flex items-center justify-between text-sm">
          <span>Статус смены</span>
          <span className={`flex items-center gap-1 ${outside ? 'text-red-600' : 'text-green-600'}`}>
            <span className="text-xs">📍</span>
            {outside ? 'Вне геозоны' : 'В геозоне'}
          </span>
        </div>
      </div>

      <Button
        variant={status === 'running' ? 'destructive' : 'default'}
        onClick={onMainAction}
        disabled={loading}
      >
        {loading ? 'Загрузка...' : mainCtaLabel(status, outside)}
      </Button>
    </Card>
  );
}
