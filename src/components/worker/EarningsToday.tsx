import React from 'react';
import { Card } from '@/components/ui/card';
import { DollarSign, Clock } from 'lucide-react';

interface EarningsTodayProps {
  todayEarnings: number;
  todayHours: number;
}

export function EarningsToday({ todayEarnings, todayHours }: EarningsTodayProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Сегодня заработано</div>
            <div className="text-2xl font-bold">{todayEarnings.toLocaleString()} BYN</div>
          </div>
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-slate-500">Часы</div>
            <div className="text-2xl font-bold">{todayHours} ч</div>
          </div>
        </div>
      </Card>
    </div>
  );
}