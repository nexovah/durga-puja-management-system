import { useEffect, useRef, useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { X, GripVertical, Download } from 'lucide-react';

export interface ExportColumnOption {
  id: string;
  label: string;
}

interface ExportColumnSelectorModalProps {
  open: boolean;
  title?: string;
  columns: ExportColumnOption[];
  storageKey: string; // remembers selection/order per table, e.g. `puja_export_cols_chanda`
  onClose: () => void;
  onExport: (orderedSelectedIds: string[]) => void;
}

interface RowState {
  id: string;
  label: string;
  selected: boolean;
}

function loadSavedOrder(storageKey: string, columns: ExportColumnOption[]): RowState[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw) as { order: string[]; selected: string[] };
      const byId = new Map(columns.map(c => [c.id, c]));
      const ordered: RowState[] = [];
      for (const id of saved.order) {
        const col = byId.get(id);
        if (col) {
          ordered.push({ id: col.id, label: col.label, selected: saved.selected.includes(id) });
          byId.delete(id);
        }
      }
      // Any new columns added since the last save (not in the saved order) — append, selected by default.
      for (const col of byId.values()) {
        ordered.push({ id: col.id, label: col.label, selected: true });
      }
      return ordered;
    }
  } catch {}
  return columns.map(c => ({ id: c.id, label: c.label, selected: true }));
}

const DND_ITEM_TYPE = 'export-column-row';

function DraggableRow({
  row,
  index,
  onToggle,
  onMove,
}: {
  row: RowState;
  index: number;
  onToggle: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [, drop] = useDrop({
    accept: DND_ITEM_TYPE,
    hover(item: { index: number }) {
      if (!ref.current || item.index === index) return;
      onMove(item.index, index);
      item.index = index;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: DND_ITEM_TYPE,
    item: { index },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-40 border-orange-300 dark:border-orange-500/40'
          : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60'
      }`}
    >
      <span className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={16} />
      </span>
      <label className="flex items-center gap-2.5 flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={row.selected}
          onChange={() => onToggle(row.id)}
          className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
        />
        {row.label}
      </label>
    </div>
  );
}

// Lets the tenant choose exactly which columns land in an exported CSV
// and in what order, via checkboxes + drag-to-reorder — opened in place
// of a direct download on every Export button across the app. Selection
// and order are remembered per table in localStorage so a tenant doesn't
// have to re-pick it on every export.
export function ExportColumnSelectorModal({
  open,
  title = 'Choose columns to export',
  columns,
  storageKey,
  onClose,
  onExport,
}: ExportColumnSelectorModalProps) {
  const [rows, setRows] = useState<RowState[]>(() => loadSavedOrder(storageKey, columns));

  useEffect(() => {
    if (open) setRows(loadSavedOrder(storageKey, columns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => setRows(prev => prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r)));
  const move = (fromIndex: number, toIndex: number) =>
    setRows(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  const selectAll = () => setRows(prev => prev.map(r => ({ ...r, selected: true })));
  const clearAll = () => setRows(prev => prev.map(r => ({ ...r, selected: false })));

  const selectedCount = rows.filter(r => r.selected).length;

  const handleExportClick = () => {
    const orderedSelectedIds = rows.filter(r => r.selected).map(r => r.id);
    if (orderedSelectedIds.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ order: rows.map(r => r.id), selected: orderedSelectedIds }));
    } catch {}
    onExport(orderedSelectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Drag to reorder — the order here is the column order in your CSV.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X size={22} />
          </button>
        </div>

        <div className="px-6 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 shrink-0">
          <button type="button" onClick={selectAll} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
            Select all
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button type="button" onClick={clearAll} className="text-xs font-medium text-gray-500 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 hover:underline">
            Clear all
          </button>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{selectedCount} of {rows.length} selected</span>
        </div>

        <DndProvider backend={HTML5Backend}>
          <div className="px-4 py-3 overflow-y-auto space-y-1 flex-1">
            {rows.map((row, i) => (
              <DraggableRow key={row.id} row={row} index={i} onToggle={toggle} onMove={move} />
            ))}
          </div>
        </DndProvider>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={handleExportClick}
            disabled={selectedCount === 0}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            <Download size={18} />
            Export {selectedCount} column{selectedCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
