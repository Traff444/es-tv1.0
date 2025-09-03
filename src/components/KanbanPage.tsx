import React from 'react';
import KanbanBoard from './KanbanBoard';

const KanbanPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Канбан — задачи по объектам</h1>
      <KanbanBoard />
    </div>
  );
};

export default KanbanPage;


