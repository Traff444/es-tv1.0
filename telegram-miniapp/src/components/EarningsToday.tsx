import React from 'react';

interface EarningsTodayProps {
  todayEarnings: number;
  todayHours: number;
  hourlyRate?: number;
}

// Simple Card component for Mini App
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function EarningsToday({ todayEarnings, todayHours, hourlyRate = 15 }: EarningsTodayProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <span className="text-green-600 text-lg">💰</span>
          </div>
          <div>
            <div className="text-xs text-gray-500">Сегодня:</div>
            <div className="text-lg font-bold text-gray-900">{todayEarnings.toFixed(2)} BYN</div>
          </div>
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-blue-600 text-lg">🕐</span>
          </div>
          <div>
            <div className="text-xs text-gray-500">Часов:</div>
            <div className="text-lg font-bold text-gray-900">
              {todayHours.toFixed(1)}
              <span className="text-sm text-gray-500 ml-1">ч</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
