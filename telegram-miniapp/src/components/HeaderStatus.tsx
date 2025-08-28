import React from 'react';

type ShiftStatus = 'running' | 'pause' | 'idle';

interface HeaderStatusProps {
  status: ShiftStatus;
  geoVerified: boolean;
  outside: boolean;
  currentTime: string;
  userName?: string;
}

function geoBadgeText(geoVerified: boolean, outside: boolean): string {
  if (!geoVerified) return 'gps off';
  return outside ? 'вне зоны' : 'verified';
}

function getStatusLabel(status: ShiftStatus): string {
  switch (status) {
    case 'running': return 'Смена идёт';
    case 'pause': return 'Пауза';
    default: return 'Смена не начата';
  }
}

// Simple Badge component for Mini App
function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'muted' }) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    muted: 'bg-gray-100 text-gray-500'
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

export function HeaderStatus({ status, geoVerified, outside, currentTime, userName }: HeaderStatusProps) {
  const statusLabel = getStatusLabel(status);
  
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <span className="text-lg">⚡</span>
          </div>
          <div>
            <div className="text-xs text-gray-500">ЭлектроСервис • Worker</div>
            <div className="text-base font-semibold">Рабочий экран</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
            status === 'running'
              ? 'bg-green-100 text-green-800'
              : status === 'pause'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {statusLabel}
            <Badge 
              variant={geoVerified && !outside ? 'success' : outside ? 'warning' : 'muted'}
            >
              {geoBadgeText(geoVerified, outside)}
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Время и приветствие */}
      <div className="px-4 pb-2 text-center">
        {userName && (
          <div className="text-sm text-gray-600 mb-1">
            ⚡ Welcome, {userName}
          </div>
        )}
        <div className="flex items-center justify-center text-sm text-gray-500">
          <span className="mr-1">🕐</span>
          {currentTime}
        </div>
      </div>
    </header>
  );
}
