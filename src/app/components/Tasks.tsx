import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { Task, TaskPriority } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { Pagination, usePagination } from './Pagination';

interface TasksProps {
  tasksList: Task[];
  setTasksList: (tasksList: Task[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'tasks', summary: string, count?: number) => void;
}

const PRIORITIES: { value: TaskPriority; labelKey: TranslationKey; badgeClass: string; dotClass: string }[] = [
  { value: 'high', labelKey: 'tasks.priority.high', badgeClass: 'bg-red-100 text-red-700', dotClass: 'bg-red-500' },
  { value: 'medium', labelKey: 'tasks.priority.medium', badgeClass: 'bg-amber-100 text-amber-700', dotClass: 'bg-amber-500' },
  { value: 'low', labelKey: 'tasks.priority.low', badgeClass: 'bg-blue-100 text-blue-700', dotClass: 'bg-blue-500' },
  { value: 'note', labelKey: 'tasks.priority.note', badgeClass: 'bg-purple-100 text-purple-700', dotClass: 'bg-purple-500' },
];

const emptyForm = {
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
};

export function Tasks({ tasksList, setTasksList, canEdit, canDelete, onLog }: TasksProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [dateFilter, setDateFilter] = useState('');

  const priorityInfo = (p: TaskPriority) => PRIORITIES.find(pr => pr.value === p) || PRIORITIES[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      setTasksList(tasksList.map(task =>
        task.id === editingId
          ? { ...task, title: formData.title, description: formData.description, priority: formData.priority }
          : task
      ));
      onLog('update', 'tasks', formData.title);
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        createdAt: new Date().toISOString(),
      };
      setTasksList([...tasksList, newTask]);
      onLog('create', 'tasks', formData.title);
    }

    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (task: Task) => {
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
    });
    setEditingId(task.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('tasks.confirmDelete'))) {
      const target = tasksList.find(task => task.id === id);
      setTasksList(tasksList.filter(task => task.id !== id));
      if (target) onLog('delete', 'tasks', target.title);
    }
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const filteredTasks = useMemo(() => {
    return [...tasksList]
      .filter(task => priorityFilter === 'all' || task.priority === priorityFilter)
      .filter(task => !dateFilter || task.createdAt.slice(0, 10) === dateFilter)
      .filter(task => !searchTerm.trim() || task.title.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasksList, priorityFilter, dateFilter, searchTerm]);

  const pagination = usePagination(filteredTasks);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
            >
              <Plus size={20} />
              {t('tasks.addNew')}
            </button>
          )
        }
        total={`${t('common.total')}: ${tasksList.length}`}
      >
        {t('tasks.pageTitle')}
      </PageHeading>

      {/* Form */}
      {canEdit && showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? t('tasks.editTask') : t('tasks.addNew')}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('tasks.title')} *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('tasks.titlePlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('tasks.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('tasks.descriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('tasks.priority')} *</label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                {editingId ? t('common.update') : t('common.add')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('tasks.filterByName')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white flex-1 min-w-[160px]"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
        >
          <option value="all">{t('tasks.allPriorities')}</option>
          {PRIORITIES.map(p => (
            <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
        />
        {(searchTerm || priorityFilter !== 'all' || dateFilter) && (
          <button
            onClick={() => { setSearchTerm(''); setPriorityFilter('all'); setDateFilter(''); }}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors"
          >
            {t('common.clearFilters')}
          </button>
        )}
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('tasks.title')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('tasks.description')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('tasks.priority')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('tasks.createdAt')}</th>
                {(canEdit || canDelete) && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagination.pageItems.map((task) => {
                const p = priorityInfo(task.priority);
                return (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">{task.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{task.description || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${p.badgeClass}`}>
                        <span className={`w-2 h-2 rounded-full ${p.dotClass}`} />
                        {t(p.labelKey)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(task.createdAt).toLocaleString(locale)}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(task)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('tasks.empty')}
            </div>
          )}
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.setPageSize}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
        />
      </div>
    </div>
  );
}
