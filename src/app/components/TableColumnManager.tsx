import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Columns3, RotateCcw, Check, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export interface ColumnDef<T = any> {
  id: string;
  label: string;
  required?: boolean; // If true, cannot be hidden (e.g. primary identifier or actions)
  defaultVisible?: boolean; // Defaults to true
  sortable?: boolean; // Defaults to true unless explicitly false (e.g. actions)
  sortValue?: (item: T) => string | number | Date | boolean | null | undefined;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  columnId: string | null;
  direction: SortDirection;
}

export interface UseTableColumnsOptions<T> {
  tableId: string;
  columns: ColumnDef<T>[];
  defaultSort?: { columnId: string; direction: 'asc' | 'desc' };
}

export interface UseTableColumnsReturn<T> {
  columns: ColumnDef<T>[];
  visibleColumns: ColumnDef<T>[];
  isColumnVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;
  setColumnVisible: (id: string, visible: boolean) => void;
  showAllColumns: () => void;
  resetColumns: () => void;
  hasCustomVisibility: boolean;
  hiddenCount: number;
  totalCount: number;
  visibleCount: number;

  // Sorting
  sortState: SortState;
  setSortState: (sort: SortState) => void;
  toggleSort: (columnId: string) => void;
  resetSort: () => void;
  sortItems: (items: T[]) => T[];
  activeSortColumn: ColumnDef<T> | undefined;
}

function compareValues(a: any, b: any, direction: 'asc' | 'desc'): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1; // blanks/nulls to bottom
  if (b === null || b === undefined || b === '') return -1;

  let comp = 0;
  if (typeof a === 'number' && typeof b === 'number') {
    comp = a - b;
  } else if (a instanceof Date && b instanceof Date) {
    comp = a.getTime() - b.getTime();
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    comp = a === b ? 0 : a ? 1 : -1;
  } else {
    // Check if both might be date strings (e.g. YYYY-MM-DD)
    const isDateA = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a);
    const isDateB = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b);
    if (isDateA && isDateB) {
      comp = a.localeCompare(b);
    } else {
      const sa = String(a).trim();
      const sb = String(b).trim();
      comp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
    }
  }

  return direction === 'asc' ? comp : -comp;
}

export function useTableColumns<T = any>({
  tableId,
  columns,
  defaultSort,
}: UseTableColumnsOptions<T>): UseTableColumnsReturn<T> {
  const colStorageKey = `puja_table_cols_${tableId}`;
  const sortStorageKey = `puja_table_sort_${tableId}`;

  // Visibility state
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(colStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        const merged: Record<string, boolean> = {};
        for (const col of columns) {
          if (col.required) {
            merged[col.id] = true;
          } else if (col.id in parsed) {
            merged[col.id] = Boolean(parsed[col.id]);
          } else {
            merged[col.id] = col.defaultVisible !== false;
          }
        }
        return merged;
      }
    } catch (e) {
      console.warn('Failed to parse table column visibility:', e);
    }
    const defaults: Record<string, boolean> = {};
    for (const col of columns) {
      defaults[col.id] = col.required ? true : col.defaultVisible !== false;
    }
    return defaults;
  });

  // Sort state
  const [sortState, setSortState] = useState<SortState>(() => {
    try {
      const saved = localStorage.getItem(sortStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as SortState;
        if (parsed.columnId && (parsed.direction === 'asc' || parsed.direction === 'desc')) {
          const found = columns.find(c => c.id === parsed.columnId);
          if (found && found.sortable !== false) {
            return parsed;
          }
        }
      }
    } catch (e) {}
    if (defaultSort) {
      return { columnId: defaultSort.columnId, direction: defaultSort.direction };
    }
    return { columnId: null, direction: null };
  });

  // Save visibility to localStorage
  const updateVisibility = useCallback((newVis: Record<string, boolean>) => {
    setVisibility(newVis);
    try {
      localStorage.setItem(colStorageKey, JSON.stringify(newVis));
    } catch (e) {}
  }, [colStorageKey]);

  // Save sort to localStorage
  const updateSort = useCallback((newSort: SortState) => {
    setSortState(newSort);
    try {
      if (newSort.columnId && newSort.direction) {
        localStorage.setItem(sortStorageKey, JSON.stringify(newSort));
      } else {
        localStorage.removeItem(sortStorageKey);
      }
    } catch (e) {}
  }, [sortStorageKey]);

  const isColumnVisible = useCallback((id: string) => {
    const col = columns.find(c => c.id === id);
    if (col?.required) return true;
    return visibility[id] !== false;
  }, [columns, visibility]);

  const toggleColumn = useCallback((id: string) => {
    const col = columns.find(c => c.id === id);
    if (col?.required) return;
    const current = visibility[id] !== false;
    updateVisibility({
      ...visibility,
      [id]: !current,
    });
  }, [columns, visibility, updateVisibility]);

  const setColumnVisible = useCallback((id: string, visible: boolean) => {
    const col = columns.find(c => c.id === id);
    if (col?.required && !visible) return;
    updateVisibility({
      ...visibility,
      [id]: visible,
    });
  }, [columns, visibility, updateVisibility]);

  const showAllColumns = useCallback(() => {
    const allVisible: Record<string, boolean> = {};
    for (const col of columns) {
      allVisible[col.id] = true;
    }
    updateVisibility(allVisible);
  }, [columns, updateVisibility]);

  const resetColumns = useCallback(() => {
    try {
      localStorage.removeItem(colStorageKey);
    } catch (e) {}
    const defaults: Record<string, boolean> = {};
    for (const col of columns) {
      defaults[col.id] = col.required ? true : col.defaultVisible !== false;
    }
    setVisibility(defaults);
  }, [colStorageKey, columns]);

  const toggleSort = useCallback((columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    if (!col || col.sortable === false) return;

    if (sortState.columnId !== columnId) {
      updateSort({ columnId, direction: 'asc' });
    } else if (sortState.direction === 'asc') {
      updateSort({ columnId, direction: 'desc' });
    } else {
      updateSort({ columnId: null, direction: null });
    }
  }, [columns, sortState, updateSort]);

  const resetSort = useCallback(() => {
    updateSort({ columnId: null, direction: null });
  }, [updateSort]);

  const visibleColumns = useMemo(() => {
    return columns.filter(c => c.required || visibility[c.id] !== false);
  }, [columns, visibility]);

  const hiddenCount = columns.length - visibleColumns.length;

  const hasCustomVisibility = useMemo(() => {
    for (const col of columns) {
      const defaultState = col.required ? true : col.defaultVisible !== false;
      const currentState = col.required ? true : visibility[col.id] !== false;
      if (defaultState !== currentState) return true;
    }
    return false;
  }, [columns, visibility]);

  const sortItems = useCallback((items: T[]): T[] => {
    if (!sortState.columnId || !sortState.direction) return items;
    const col = columns.find(c => c.id === sortState.columnId);
    if (!col || col.sortable === false) return items;

    const dir = sortState.direction;
    const getVal = col.sortValue || ((item: any) => item[col.id]);

    return [...items].sort((itemA, itemB) => {
      const valA = getVal(itemA);
      const valB = getVal(itemB);
      return compareValues(valA, valB, dir);
    });
  }, [columns, sortState]);

  const activeSortColumn = useMemo(() => {
    if (!sortState.columnId) return undefined;
    return columns.find(c => c.id === sortState.columnId);
  }, [columns, sortState]);

  return {
    columns,
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    setColumnVisible,
    showAllColumns,
    resetColumns,
    hasCustomVisibility,
    hiddenCount,
    totalCount: columns.length,
    visibleCount: visibleColumns.length,
    sortState,
    setSortState: updateSort,
    toggleSort,
    resetSort,
    sortItems,
    activeSortColumn,
  };
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnDef<any>[];
  isColumnVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;
  showAllColumns: () => void;
  resetColumns: () => void;
  hasCustomVisibility: boolean;
  hiddenCount: number;
}

export function ColumnVisibilityDropdown({
  columns,
  isColumnVisible,
  toggleColumn,
  showAllColumns,
  resetColumns,
  hasCustomVisibility,
  hiddenCount,
}: ColumnVisibilityDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-all shadow-sm ${
          open || hiddenCount > 0
            ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 text-orange-600 dark:text-orange-400'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'
        }`}
        title="Customize visible columns"
      >
        <Columns3 size={15} className="shrink-0" />
        <span>Columns</span>
        {hiddenCount > 0 ? (
          <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
            {columns.length - hiddenCount}/{columns.length}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-[11px]">({columns.length})</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 sm:w-72 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 sm:p-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Customize Columns
            </span>
            <div className="flex items-center gap-1.5">
              {hasCustomVisibility && (
                <button
                  type="button"
                  onClick={resetColumns}
                  className="flex items-center gap-1 text-[11px] font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:underline"
                  title="Reset to default columns"
                >
                  <RotateCcw size={11} />
                  Reset
                </button>
              )}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={showAllColumns}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline ml-1"
                >
                  Show All
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
            {columns.map((col) => {
              const visible = isColumnVisible(col.id);
              const isRequired = !!col.required;

              return (
                <label
                  key={col.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    isRequired
                      ? 'opacity-80 cursor-default bg-gray-50/60 dark:bg-gray-800/40'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={visible}
                      disabled={isRequired}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                    />
                    <span>{col.label}</span>
                  </span>
                  {isRequired && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                      Required
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-[11px] text-gray-400 dark:text-gray-500">
            <span>Saved in browser</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface SortableThProps {
  column?: ColumnDef<any>;
  columnId?: string;
  sortState: SortState;
  onSort?: (columnId: string) => void;
  onToggleSort?: (columnId: string) => void;
  align?: 'left' | 'center' | 'right';
  children?: React.ReactNode;
  className?: string;
}

export function SortableTh({
  column,
  columnId,
  sortState,
  onSort,
  onToggleSort,
  align,
  children,
  className = '',
}: SortableThProps) {
  const colId = column?.id || columnId || '';
  const colAlign = align || column?.align || 'left';
  const isSortable = column ? column.sortable !== false : true;
  const isSorted = sortState.columnId === colId;
  const direction = isSorted ? sortState.direction : null;
  const handleSort = () => {
    if (onSort) onSort(colId);
    else if (onToggleSort) onToggleSort(colId);
  };

  const alignClass =
    colAlign === 'right'
      ? 'text-right justify-end'
      : colAlign === 'center'
      ? 'text-center justify-center'
      : 'text-left justify-start';

  if (!isSortable) {
    return (
      <th
        className={`px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 ${
          colAlign === 'right' ? 'text-right' : colAlign === 'center' ? 'text-center' : 'text-left'
        } ${column?.headerClassName || ''} ${className}`}
      >
        {children || column?.label || ''}
      </th>
    );
  }

  return (
    <th
      onClick={handleSort}
      className={`px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none group transition-colors hover:bg-gray-100/70 dark:hover:bg-gray-800/80 ${
        isSorted ? 'bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400' : ''
      } ${column?.headerClassName || ''} ${className}`}
      title={`Click to sort by ${column?.label || (typeof children === 'string' ? children : colId)}`}
    >
      <div className={`flex items-center gap-1.5 ${alignClass}`}>
        <span className={isSorted ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}>
          {children || column?.label || ''}
        </span>
        {direction === 'asc' ? (
          <ArrowUp size={14} className="text-orange-600 dark:text-orange-400 shrink-0" />
        ) : direction === 'desc' ? (
          <ArrowDown size={14} className="text-orange-600 dark:text-orange-400 shrink-0" />
        ) : (
          <ArrowUpDown
            size={13}
            className="text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          />
        )}
      </div>
    </th>
  );
}

export interface DataTableToolbarProps<T = any> {
  totalItems?: number;
  filteredItemsCount?: number;
  startIndex?: number;
  endIndex?: number;
  columnDropdown?: React.ReactNode;
  activeSortLabel?: string;
  sortDirection?: SortDirection;
  onResetSort?: () => void;
  // Direct props alternative
  columns?: ColumnDef<T>[];
  isColumnVisible?: (id: string) => boolean;
  onToggleColumn?: (id: string) => void;
  onResetColumns?: () => void;
  onShowAllColumns?: () => void;
  sortState?: SortState;
  onClearSort?: () => void;
  extraActions?: React.ReactNode;
  children?: React.ReactNode;
}

export function DataTableToolbar<T = any>({
  totalItems,
  startIndex,
  endIndex,
  columnDropdown,
  activeSortLabel,
  sortDirection,
  onResetSort,
  columns,
  isColumnVisible,
  onToggleColumn,
  onResetColumns,
  onShowAllColumns,
  sortState,
  onClearSort,
  extraActions,
  children,
}: DataTableToolbarProps<T>) {
  const hasEntries = totalItems !== undefined && startIndex !== undefined && endIndex !== undefined && totalItems > 0;

  // Resolve sort label & direction if sortState was provided
  const resolvedSortLabel = activeSortLabel || (sortState?.columnId && columns ? columns.find(c => c.id === sortState.columnId)?.label : undefined);
  const resolvedSortDirection = sortDirection || sortState?.direction;
  const handleResetSort = onResetSort || onClearSort;

  // Resolve dropdown
  let resolvedDropdown = columnDropdown;
  if (!resolvedDropdown && columns && isColumnVisible && onToggleColumn && onResetColumns && onShowAllColumns) {
    const hiddenCount = columns.filter(c => !isColumnVisible(c.id)).length;
    const hasCustomVisibility = columns.some(c => {
      const def = c.required ? true : c.defaultVisible !== false;
      return def !== isColumnVisible(c.id);
    });

    resolvedDropdown = (
      <ColumnVisibilityDropdown
        columns={columns}
        isColumnVisible={isColumnVisible}
        toggleColumn={onToggleColumn}
        showAllColumns={onShowAllColumns}
        resetColumns={onResetColumns}
        hasCustomVisibility={hasCustomVisibility}
        hiddenCount={hiddenCount}
      />
    );
  }

  return (
    <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2 bg-gray-50/60 dark:bg-gray-800/40 text-xs sm:text-sm">
      <div className="flex items-center gap-2 flex-wrap text-gray-500 dark:text-gray-400">
        {hasEntries && (
          <span>
            Showing <strong className="font-semibold text-gray-700 dark:text-gray-200">{startIndex}</strong>–
            <strong className="font-semibold text-gray-700 dark:text-gray-200">{endIndex}</strong> of{' '}
            <strong className="font-semibold text-gray-700 dark:text-gray-200">{totalItems}</strong> entries
          </span>
        )}

        {resolvedSortLabel && resolvedSortDirection && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
            <span>
              Sorted: {resolvedSortLabel} {resolvedSortDirection === 'asc' ? '↑' : '↓'}
            </span>
            {handleResetSort && (
              <button
                type="button"
                onClick={handleResetSort}
                className="hover:text-red-600 dark:hover:text-red-400 ml-0.5"
                title="Clear sort"
              >
                <X size={12} />
              </button>
            )}
          </span>
        )}

        {extraActions}
        {children}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {resolvedDropdown}
      </div>
    </div>
  );
}
