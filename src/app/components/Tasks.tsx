import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, X, ChevronDown, CheckCircle2, Eye } from 'lucide-react';
import { Task, TaskPriority, Member } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { Pagination, usePagination } from './Pagination';
import { FormModal, FormModalCancelButton } from './FormModal';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface TasksProps {
  tasksList: Task[];
  setTasksList: (tasksList: Task[]) => void;
  members: Member[];
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'tasks', summary: string, count?: number) => void;
}

const PRIORITIES: { value: TaskPriority; labelKey: TranslationKey; badgeClass: string; dotClass: string }[] = [
  { value: 'high', labelKey: 'tasks.priority.high', badgeClass: 'bg-red-100 text-red-700', dotClass: 'bg-red-500' },
  { value: 'medium', labelKey: 'tasks.priority.medium', badgeClass: 'bg-amber-100 text-amber-700', dotClass: 'bg-amber-500' },
  { value: 'low', labelKey: 'tasks.priority.low', badgeClass: 'bg-blue-100 text-blue-700', dotClass: 'bg-blue-500' },
  { value: 'note', labelKey: 'tasks.priority.note', badgeClass: 'bg-purple-100 text-purple-700', dotClass: 'bg-purple-500' },
  { value: 'completed', labelKey: 'tasks.priority.completed', badgeClass: 'bg-green-100 text-green-700', dotClass: 'bg-green-500' },
];

const DEFAULT_EXPIRY_DAYS = 15;

const todayISO = () => new Date().toISOString().split('T')[0];
const addDaysISO = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Fresh each time it's called (not a module constant) so "today" / "+15
// days" stays correct if the app is left open across midnight.
const getEmptyForm = () => ({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  createdDate: todayISO(),
  expiryDate: addDaysISO(todayISO(), DEFAULT_EXPIRY_DAYS),
  assignedMemberIds: [] as string[],
});

export function Tasks({ tasksList, setTasksList, members, canEdit, canDelete, currentUserId, currentUserName, isAdmin, onLog }: TasksProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(getEmptyForm);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [dateFilter, setDateFilter] = useState('');

  const priorityInfo = (p: TaskPriority) => PRIORITIES.find(pr => pr.value === p) || PRIORITIES[1];
  const memberName = (id: string) => members.find(m => m.id === id)?.name || t('tasks.unknownMember');
  const completedCount = tasksList.filter(task => task.priority === 'completed').length;

  // Only the task's creator, or an admin, can edit/delete it — everyone
  // else with the Tasks permission (including assigned members) can view.
  const canEditTask = (task: Task) => canEdit && (isAdmin || task.createdBy === currentUserId);
  const canDeleteTask = (task: Task) => canDelete && (isAdmin || task.createdBy === currentUserId);

  const toggleAssignee = (memberId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedMemberIds: prev.assignedMemberIds.includes(memberId)
        ? prev.assignedMemberIds.filter(id => id !== memberId)
        : [...prev.assignedMemberIds, memberId],
    }));
  };

  const handleMarkComplete = (task: Task) => {
    if (!canEditTask(task)) return;
    setTasksList(tasksList.map(t2 => (t2.id === task.id ? { ...t2, priority: 'completed' } : t2)));
    onLog('update', 'tasks', `${task.title} — ${t('tasks.priority.completed')}`);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const saveAndAddNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'andNew';

    if (editingId) {
      setTasksList(tasksList.map(task =>
        task.id === editingId
          ? {
              ...task,
              title: formData.title,
              description: formData.description,
              priority: formData.priority,
              expiryDate: formData.expiryDate,
              assignedMemberIds: formData.assignedMemberIds,
            }
          : task
      ));
      onLog('update', 'tasks', formData.title);
      setToastMessage(t('common.updatedSuccess'));
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        createdAt: new Date().toISOString(),
        expiryDate: formData.expiryDate,
        assignedMemberIds: formData.assignedMemberIds,
        createdBy: currentUserId,
        createdByName: currentUserName,
      };
      setTasksList([...tasksList, newTask]);
      onLog('create', 'tasks', formData.title);
      setToastMessage(t('common.savedSuccess'));
    }

    const wasEditing = editingId;
    setFormData(getEmptyForm());
    setAssigneePickerOpen(false);
    setEditingId(null);
    setShowForm(saveAndAddNew && !wasEditing);
  };

  const handleEdit = (task: Task) => {
    if (!canEditTask(task)) return;
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      createdDate: task.createdAt.split('T')[0],
      expiryDate: task.expiryDate || addDaysISO(task.createdAt.split('T')[0], DEFAULT_EXPIRY_DAYS),
      assignedMemberIds: task.assignedMemberIds || [],
    });
    setEditingId(task.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const target = tasksList.find(task => task.id === id);
    if (!target || !canDeleteTask(target)) return;
    setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setTasksList(tasksList.filter(task => task.id !== deleteTarget.id));
    onLog('delete', 'tasks', deleteTarget.title);
    setDeleteTarget(null);
    setToastMessage(t('common.deletedSuccess'));
  };

  const handleCancel = () => {
    setFormData(getEmptyForm());
    setAssigneePickerOpen(false);
    setShowForm(false);
    setEditingId(null);
  };

  const handleAddNew = () => {
    setFormData(getEmptyForm());
    setShowForm(true);
  };

  const filteredTasks = useMemo(() => {
    return [...tasksList]
      .filter(task => (activeTab === 'completed' ? task.priority === 'completed' : task.priority !== 'completed'))
      .filter(task => priorityFilter === 'all' || task.priority === priorityFilter)
      .filter(task => !dateFilter || task.createdAt.slice(0, 10) === dateFilter)
      .filter(task => !searchTerm.trim() || task.title.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasksList, activeTab, priorityFilter, dateFilter, searchTerm]);

  const pagination = usePagination(filteredTasks);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          canEdit && (
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
            >
              <Plus size={20} />
              {t('tasks.addNew')}
            </button>
          )
        }
      >
        {t('tasks.pageTitle')}
      </PageHeading>

      {/* Form */}
      <FormModal
        open={canEdit && showForm}
        title={editingId ? t('tasks.editTask') : t('tasks.addNew')}
        onClose={handleCancel}
        footer={
          <>
            <button
              type="submit"
              form="tasks-form"
              className="flex-1 min-w-0 px-2 sm:px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            {!editingId && (
              <button
                type="submit"
                form="tasks-form"
                value="andNew"
                className="flex-1 min-w-0 px-2 sm:px-6 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium text-xs sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {t('common.saveAndAddNew')}
              </button>
            )}
            <FormModalCancelButton onClick={handleCancel} label={t('common.cancel')} />
          </>
        }
      >
          <form id="tasks-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tasks.title')} *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('tasks.titlePlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tasks.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('tasks.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tasks.priority')} *</label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tasks.assignTo')}</label>
              <button
                type="button"
                onClick={() => setAssigneePickerOpen(o => !o)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none flex items-center justify-between text-left"
              >
                <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                  {formData.assignedMemberIds.length === 0
                    ? t('tasks.selectMembers')
                    : formData.assignedMemberIds.map(memberName).join(', ')}
                </span>
                <ChevronDown size={16} className="shrink-0 text-gray-500 dark:text-gray-400" />
              </button>
              {assigneePickerOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg shadow-lg">
                  {members.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t('tasks.noMembers')}</p>
                  )}
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.assignedMemberIds.includes(m.id)}
                        onChange={() => toggleAssignee(m.id)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tasks.createdAt')}</label>
              <input
                type="date"
                disabled
                value={formData.createdDate}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg outline-none cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tasks.expiry')}</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>

          </form>
      </FormModal>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 font-semibold text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'all'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400'
          }`}
        >
          {t('tasks.tab.all')} ({tasksList.length - completedCount})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2.5 font-semibold text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'completed'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-green-600'
          }`}
        >
          {t('tasks.tab.completed')} ({completedCount})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('tasks.filterByName')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900 flex-1 min-w-[160px]"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900"
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
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg bg-white dark:bg-gray-900"
        />
        {(searchTerm || priorityFilter !== 'all' || dateFilter) && (
          <button
            onClick={() => { setSearchTerm(''); setPriorityFilter('all'); setDateFilter(''); }}
            className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            {t('common.clearFilters')}
          </button>
        )}
      </div>

      {/* Task List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('tasks.title')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('tasks.priority')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('tasks.assignTo')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('tasks.createdAt')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('tasks.expiry')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((task) => {
                const p = priorityInfo(task.priority);
                const isExpired = task.expiryDate && task.expiryDate < todayISO();
                const editable = canEditTask(task);
                const deletable = canDeleteTask(task);
                return (
                  <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 font-medium">
                      <button
                        onClick={() => setViewingTask(task)}
                        className="text-left hover:text-orange-600 dark:hover:text-orange-400 hover:underline transition-colors"
                      >
                        {task.title}
                      </button>
                      {task.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5 max-w-xs truncate">{task.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${p.badgeClass}`}>
                        <span className={`w-2 h-2 rounded-full ${p.dotClass}`} />
                        {t(p.labelKey)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {task.assignedMemberIds.length === 0 ? '-' : (
                        <div className="flex flex-wrap gap-1">
                          {task.assignedMemberIds.map(id => (
                            <span key={id} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs">{memberName(id)}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(task.createdAt).toLocaleString(locale)}
                    </td>
                    <td className={`px-6 py-4 text-sm whitespace-nowrap ${isExpired ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                      {task.expiryDate ? new Date(task.expiryDate).toLocaleDateString(locale) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingTask(task)}
                          title={t('tasks.view')}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Eye size={18} />
                        </button>
                        {editable && task.priority !== 'completed' && (
                          <button
                            onClick={() => handleMarkComplete(task)}
                            title={t('tasks.markComplete')}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                        {editable && (
                          <button
                            onClick={() => handleEdit(task)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {deletable && (
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTasks.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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

      {/* View modal — full task details, read-only */}
      {viewingTask && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={() => setViewingTask(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-3">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{viewingTask.title}</h3>
              <button onClick={() => setViewingTask(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${priorityInfo(viewingTask.priority).badgeClass}`}>
                  <span className={`w-2 h-2 rounded-full ${priorityInfo(viewingTask.priority).dotClass}`} />
                  {t(priorityInfo(viewingTask.priority).labelKey)}
                </span>
              </div>

              {viewingTask.description && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('tasks.description')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{viewingTask.description}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('tasks.assignTo')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {viewingTask.assignedMemberIds.length === 0
                    ? '-'
                    : viewingTask.assignedMemberIds.map(memberName).join(', ')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('tasks.createdAt')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{new Date(viewingTask.createdAt).toLocaleString(locale)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('tasks.expiry')}</p>
                  <p className={`text-sm ${viewingTask.expiryDate && viewingTask.expiryDate < todayISO() ? 'text-red-600 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                    {viewingTask.expiryDate ? new Date(viewingTask.expiryDate).toLocaleDateString(locale) : '-'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('tasks.createdBy')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{viewingTask.createdByName || '-'}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              {canEditTask(viewingTask) && (
                <button
                  onClick={() => { const task = viewingTask; setViewingTask(null); handleEdit(task); }}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  {t('common.update')}
                </button>
              )}
              <button
                onClick={() => setViewingTask(null)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.title}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
