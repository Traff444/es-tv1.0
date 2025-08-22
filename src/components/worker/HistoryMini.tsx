import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface HistoryEntry {
  date: string;
  hours: number;
  earnings: number;
}

interface HistoryMiniProps {
  history: HistoryEntry[];
  onShowAll: () => void;
}

export function HistoryMini({ history, onShowAll }: HistoryMiniProps) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">История смен</h2>
        <Button variant="ghost" size="sm" onClick={onShowAll}>
          Показать все
        </Button>
      </div>
      
      {history.length === 0 ? (
        <div className="text-center py-4 text-slate-500">
          Нет истории смен
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 text-sm">
          {history.slice(0, 3).map((entry, idx) => (
            <li key={idx} className="flex items-center justify-between py-3">
              <span>{entry.date} • {entry.hours} ч</span>
                              <span className="font-semibold">{entry.earnings.toLocaleString()} BYN</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}