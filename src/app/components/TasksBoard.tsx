import { useState } from 'react';
import { Task, TaskPriority, Member } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { PRIORITIES } from './Tasks';

interface TasksBoardProps {
  tasks: Task[];
  members: Member[];
  canEditTask: (task: Task) => boolean;
  onPriorityChange: (task: Task, newPriority: TaskPriority) => void;
  onCardClick: (task: Task) => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];

export function TasksBoard({ tasks, members, canEditTask, onPriorityChange, onCardClick }: TasksBoardProps) {
  const { t, locale } = useLanguage();
  const [dragOverColumn, setDragOverColumn] = useState<TaskPriority | null>(null);

  const memberName = (id: string) => members.find(m => m.id === id)?.name || t('tasks.unknownMember');
  const memberInitials = (id: string) => {
    const name = members.find(m => m.id === id)?.name || '?';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?';
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, priority: TaskPriority) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(tk => tk.id === taskId);
    if (task) onPriorityChange(task, priority);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {PRIORITIES.map((p) => {
        const columnTasks = tasks.filter(task => task.priority === p.value);
        return (
          <div
            key={p.value}
            onDragOver={(e) => { e.preventDefault(); setDragOverColumn(p.value); }}
            onDragLeave={() => setDragOverColumn(prev => (prev === p.value ? null : prev))}
            onDrop={(e) => handleDrop(e, p.value)}
            className={`flex flex-col w-72 shrink-0 bg-gray-50 dark:bg-gray-900 rounded-xl border transition-colors ${
              dragOverColumn === p.value
                ? 'border-orange-400 ring-2 ring-orange-200 dark:ring-orange-500/30'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${p.dotClass}`} />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t(p.labelKey)}</span>
              </div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 rounded-full px-2 py-0.5">
                {columnTasks.length}
              </span>
            </div>

            <div className="flex-1 min-h-[80px] max-h-[70vh] overflow-y-auto p-2 space-y-2">
              {columnTasks.map((task) => {
                const editable = canEditTask(task);
                const isExpired = task.expiryDate && task.expiryDate < todayISO();
                return (
                  <div
                    key={task.id}
                    draggable={editable}
                    onDragStart={editable ? (e) => handleDragStart(e, task) : undefined}
                    onClick={() => onCardClick(task)}
                    className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                      editable ? 'active:cursor-grabbing' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className={`text-xs whitespace-nowrap ${isExpired ? 'text-red-600 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                        {task.expiryDate ? new Date(task.expiryDate).toLocaleDateString(locale) : '-'}
                      </span>
                      {task.assignedMemberIds.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {task.assignedMemberIds.slice(0, 3).map(id => (
                            <span
                              key={id}
                              title={memberName(id)}
                              className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-[10px] font-semibold flex items-center justify-center border-2 border-white dark:border-gray-800"
                            >
                              {memberInitials(id)}
                            </span>
                          ))}
                          {task.assignedMemberIds.length > 3 && (
                            <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold flex items-center justify-center border-2 border-white dark:border-gray-800">
                              +{task.assignedMemberIds.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {columnTasks.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">
                  {t('tasks.empty')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
